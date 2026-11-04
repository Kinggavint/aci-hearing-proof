#!/usr/bin/env node
// Simulates CloudFront Functions viewer-request events against
// cloudfront/aci-legacy-410.js. Plain Node, no dependencies (vm + assert
// are both built in) so this runs with just `node cloudfront/test/aci-legacy-410.test.js`.
//
// Covers the new www -> apex host 301 (path preserved, query preserved,
// multi-value query preserved, case-insensitive host match, apex host is a
// no-op) plus regression checks on the four pre-existing legacy behaviors
// so this change can't silently break them.

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const SRC_PATH = path.join(__dirname, "..", "aci-legacy-410.js");
const source = fs.readFileSync(SRC_PATH, "utf8");

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: SRC_PATH });
const handler = sandbox.handler;
assert.strictEqual(typeof handler, "function", "handler() must be defined by the function file");

function makeEvent(host, uri, querystring) {
    return {
        request: {
            uri: uri,
            querystring: querystring || {},
            headers: host ? { host: { value: host } } : {},
            method: "GET",
            clientIp: "203.0.113.1"
        }
    };
}

let passed = 0;
function check(name, fn) {
    try {
        fn();
        passed++;
        console.log("ok - " + name);
    } catch (err) {
        console.error("FAIL - " + name);
        console.error("  " + err.message);
        process.exitCode = 1;
    }
}

// ---- New behavior: www host canonicalization ----

check("www root path -> 301 to apex root, no query", () => {
    const res = handler(makeEvent("www.acihearing.com", "/", {}));
    assert.strictEqual(res.statusCode, 301);
    assert.strictEqual(res.headers.location.value, "https://acihearing.com/");
});

check("www with deep path -> 301 preserves path", () => {
    const res = handler(makeEvent("www.acihearing.com", "/hearing-aid-battery-troubleshooting.html", {}));
    assert.strictEqual(res.statusCode, 301);
    assert.strictEqual(
        res.headers.location.value,
        "https://acihearing.com/hearing-aid-battery-troubleshooting.html"
    );
});

check("www with query string -> 301 preserves query", () => {
    const res = handler(
        makeEvent("www.acihearing.com", "/tinnitus.html", {
            utm_source: { value: "google" },
            utm_medium: { value: "cpc" }
        })
    );
    assert.strictEqual(res.statusCode, 301);
    assert.strictEqual(
        res.headers.location.value,
        "https://acihearing.com/tinnitus.html?utm_source=google&utm_medium=cpc"
    );
});

check("www with multi-value query param -> 301 preserves every value", () => {
    const res = handler(
        makeEvent("www.acihearing.com", "/services.html", {
            tag: {
                multiValue: [{ value: "a" }, { value: "b" }]
            }
        })
    );
    assert.strictEqual(res.statusCode, 301);
    assert.strictEqual(res.headers.location.value, "https://acihearing.com/services.html?tag=a&tag=b");
});

check("www host match is case-insensitive", () => {
    const res = handler(makeEvent("WWW.ACIHEARING.COM", "/contact.html", {}));
    assert.strictEqual(res.statusCode, 301);
    assert.strictEqual(res.headers.location.value, "https://acihearing.com/contact.html");
});

check("www redirect carries cache-control + diagnostic header", () => {
    const res = handler(makeEvent("www.acihearing.com", "/", {}));
    assert.strictEqual(res.headers["cache-control"].value, "public, max-age=604800");
    assert.strictEqual(res.headers["x-legacy-redirect"].value, "www-to-apex-host");
});

check("apex host (no www) is untouched by step 0 for a normal page", () => {
    const res = handler(makeEvent("acihearing.com", "/hearing-aids.html", {}));
    // Falls through to `return request` at the bottom — same object back, no redirect.
    assert.strictEqual(res.statusCode, undefined);
    assert.strictEqual(res.uri, "/hearing-aids.html");
});

check("missing host header does not throw and does not redirect", () => {
    const res = handler(makeEvent(undefined, "/", {}));
    assert.strictEqual(res.statusCode, undefined);
});

// ---- Regression: pre-existing behavior must still work unchanged ----

check("regression: et_core_page_resource_* query strips to clean URL (301)", () => {
    const res = handler(
        makeEvent("acihearing.com", "/hearing-aids.html", {
            et_core_page_resource_1: { value: "1" }
        })
    );
    assert.strictEqual(res.statusCode, 301);
    assert.strictEqual(res.headers.location.value, "/hearing-aids.html");
    assert.strictEqual(res.headers["x-legacy-redirect"].value, "et-core-page-resource-strip");
});

check("regression: WordPress ?p= permalink fallback -> 301 to /", () => {
    const res = handler(makeEvent("acihearing.com", "/", { p: { value: "42" } }));
    assert.strictEqual(res.statusCode, 301);
    assert.strictEqual(res.headers.location.value, "/");
    assert.strictEqual(res.headers["x-legacy-redirect"].value, "wp-permalink-fallback");
});

check("regression: other legacy /services/hearing-aids path -> 410 Gone", () => {
    const res = handler(makeEvent("acihearing.com", "/services/hearing-aids", {}));
    assert.strictEqual(res.statusCode, 410);
    assert.strictEqual(res.headers["x-legacy-410"].value, "aci-legacy-cleanup");
});

// ---- Q-0028: legacy URLs that still rank -> 301 to closest live page, one hop ----
[
    ["/locations/lafayette-la/", "/audiologist-lafayette-la.html"],
    ["/locations/lafayette-la", "/audiologist-lafayette-la.html"],
    ["/services/tinnitus/", "/tinnitus.html"],
    ["/services/tinnitus", "/tinnitus.html"],
    ["/SERVICES/TINNITUS/", "/tinnitus.html"],
    ["/location-contact/", "/contact.html"],
    ["/location-contact", "/contact.html"]
].forEach(([from, to]) => {
    ["acihearing.com", "www.acihearing.com"].forEach((host) => {
        check(`Q-0028: ${host}${from} -> 301 https://acihearing.com${to} (one hop)`, () => {
            const res = handler(makeEvent(host, from, { utm_source: { value: "x" } }));
            assert.strictEqual(res.statusCode, 301);
            assert.strictEqual(res.headers.location.value, "https://acihearing.com" + to);
            assert.strictEqual(res.headers["x-legacy-redirect"].value, "q0028-legacy-301");
        });
    });
});

check("Q-0028: /services/tinnitus/ is no longer a 410", () => {
    const res = handler(makeEvent("acihearing.com", "/services/tinnitus/", {}));
    assert.notStrictEqual(res.statusCode, 410);
});

check("Q-0028: other /locations/ paths are not redirected by the map", () => {
    const res = handler(makeEvent("acihearing.com", "/locations/broussard-la/", {}));
    assert.strictEqual(res.statusCode, undefined);
});

// 2026-11-04: /hearing-aids/affordable-hearing-aids/ now 301s (see the CSV block below),
// so the directory-subpath 410 regression uses prefixes that have no redirect default.
check("regression: legacy directory subpath /tinnitus/foo/ -> 410 Gone", () => {
    const res = handler(makeEvent("acihearing.com", "/tinnitus/foo/", {}));
    assert.strictEqual(res.statusCode, 410);
});

check("regression: legacy directory subpath /pediatric-audiology/foo/ -> 410 Gone", () => {
    const res = handler(makeEvent("acihearing.com", "/pediatric-audiology/foo/", {}));
    assert.strictEqual(res.statusCode, 410);
});

check("regression: flat canonical page /hearing-aids.html is NOT caught by directory-subpath 410s", () => {
    const res = handler(makeEvent("acihearing.com", "/hearing-aids.html", {}));
    assert.strictEqual(res.statusCode, undefined);
    assert.strictEqual(res.uri, "/hearing-aids.html");
});

check("www + legacy 410 path: host redirect wins first (client re-requests on apex, then 410s there)", () => {
    const res = handler(makeEvent("www.acihearing.com", "/services/hearing-aids", {}));
    assert.strictEqual(res.statusCode, 301);
    assert.strictEqual(res.headers.location.value, "https://acihearing.com/services/hearing-aids");
});

// ---- 2026-11-04: every row of redirects/legacy-redirects-*.csv -> one-hop 301 ----
const REPO = path.join(__dirname, "..", "..");
function parseCsv(text) {
    const rows = [];
    let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (q) {
            if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') q = false;
            else cur += ch;
        } else if (ch === '"') q = true;
        else if (ch === ",") { row.push(cur); cur = ""; }
        else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
        else if (ch !== "\r") cur += ch;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    const head = rows.shift();
    return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const csvDir = path.join(REPO, "redirects");
const csvRows = fs.readdirSync(csvDir)
    .filter((f) => /^legacy-redirects-.*\.csv$/.test(f))
    .flatMap((f) => parseCsv(fs.readFileSync(path.join(csvDir, f), "utf8")));
assert.ok(csvRows.length > 500, "CSV rows loaded: " + csvRows.length);

function targetFile(to) {
    return path.join(REPO, to === "/" ? "index.html" : to.slice(1));
}

let csvFailures = 0;
check(`CSV: all ${csvRows.length} rows 301 to their target on apex + www, with and without trailing slash`, () => {
    const bad = [];
    csvRows.forEach((r) => {
        const variants = [r.old_url];
        if (r.old_url.endsWith("/")) variants.push(r.old_url.slice(0, -1));
        variants.forEach((from) => {
            ["acihearing.com", "www.acihearing.com"].forEach((host) => {
                const res = handler(makeEvent(host, from, { utm_source: { value: "x" } }));
                const loc = res.headers && res.headers.location && res.headers.location.value;
                if (res.statusCode !== 301 || loc !== "https://acihearing.com" + r.target ||
                    res.headers["x-legacy-redirect"].value !== "q0028-legacy-301") {
                    bad.push(`${host}${from} -> ${res.statusCode} ${loc} (want ${r.target})`);
                }
            });
        });
    });
    csvFailures = bad.length;
    assert.strictEqual(bad.length, 0, bad.slice(0, 20).join("\n  "));
});

check("CSV: match_type is exact-article / exact-page / section and every row has a reason", () => {
    csvRows.forEach((r) => {
        assert.ok(["exact-article", "exact-page", "section"].includes(r.match_type), r.old_url + " " + r.match_type);
        assert.ok(r.reason && r.reason.length > 5, "reason missing: " + r.old_url);
        if (r.match_type === "exact-article") assert.ok(r.target.startsWith("/articles/"), r.old_url);
    });
});

check("CSV: every target is a file in the repo and is served as-is (no chain, no loop)", () => {
    const targets = [...new Set(csvRows.map((r) => r.target))];
    targets.forEach((to) => {
        assert.ok(fs.existsSync(targetFile(to)), "missing file for " + to);
        const res = handler(makeEvent("acihearing.com", to, {}));
        assert.strictEqual(res.statusCode, undefined, to + " should pass through, got " + res.statusCode);
        assert.strictEqual(res.uri, to);
    });
});

check("no old URL is also a target (loop guard)", () => {
    const olds = new Set(csvRows.map((r) => r.old_url.toLowerCase().replace(/\/$/, "")));
    csvRows.forEach((r) => assert.ok(!olds.has(r.target.toLowerCase().replace(/\/$/, "")) || r.target === "/", r.target));
});

check("every live HTML page in the repo passes through untouched", () => {
    const pages = [];
    (function walk(dir, rel) {
        fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
            if (e.name.startsWith(".") || e.name === "node_modules") return;
            if (e.isDirectory()) walk(path.join(dir, e.name), rel + "/" + e.name);
            else if (e.name.endsWith(".html")) pages.push(rel + "/" + e.name);
        });
    })(REPO, "");
    assert.ok(pages.length > 100, "pages found: " + pages.length);
    pages.concat(["/", "/sitemap.xml", "/robots.txt", "/assets/logo.png"]).forEach((p) => {
        const res = handler(makeEvent("acihearing.com", p, {}));
        assert.strictEqual(res.statusCode, undefined, p + " -> " + res.statusCode);
    });
});

check("/wp-content/, /wp-includes/, /wp-admin/, /wp-json/ still 410", () => {
    ["/wp-content/uploads/2020/01/x.jpg", "/wp-includes/js/a.js", "/wp-admin/", "/wp-json/wp/v2/posts"].forEach((p) => {
        assert.strictEqual(handler(makeEvent("acihearing.com", p, {})).statusCode, 410, p);
    });
});

check("unlisted old blog posts fall back to their section (one hop)", () => {
    [["/hearing-loss-articles/some-retired-post/", "/hearing-loss.html"],
     ["/hearing-aids-news/some-retired-post/", "/hearing-aids.html"],
     ["/hearing-test-info/some-retired-post/", "/hearing-tests.html"],
     ["/tinnitus-articles/some-retired-post/", "/tinnitus.html"],
     ["/category/anything/page/9/", "/learn-more.html"],
     ["/2018/03/04/", "/learn-more.html"]].forEach(([from, to]) => {
        const res = handler(makeEvent("acihearing.com", from, {}));
        assert.strictEqual(res.statusCode, 301, from);
        assert.strictEqual(res.headers.location.value, "https://acihearing.com" + to, from);
    });
});

check("function source is under the 10 KB CloudFront Functions limit", () => {
    assert.ok(Buffer.byteLength(source) <= 10240, "size " + Buffer.byteLength(source));
});

console.log(`\n${passed} passed`);
if (process.exitCode) {
    console.error("Some checks FAILED — see above.");
} else {
    console.log("All checks passed.");
}
