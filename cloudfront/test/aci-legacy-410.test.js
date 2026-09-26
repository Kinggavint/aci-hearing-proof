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

check("regression: legacy /services/tinnitus path -> 410 Gone", () => {
    const res = handler(makeEvent("acihearing.com", "/services/tinnitus", {}));
    assert.strictEqual(res.statusCode, 410);
    assert.strictEqual(res.headers["x-legacy-410"].value, "aci-legacy-cleanup");
});

check("regression: legacy directory subpath /hearing-aids/foo/ -> 410 Gone", () => {
    const res = handler(makeEvent("acihearing.com", "/hearing-aids/affordable-hearing-aids/", {}));
    assert.strictEqual(res.statusCode, 410);
});

check("regression: flat canonical page /hearing-aids.html is NOT caught by directory-subpath 410s", () => {
    const res = handler(makeEvent("acihearing.com", "/hearing-aids.html", {}));
    assert.strictEqual(res.statusCode, undefined);
    assert.strictEqual(res.uri, "/hearing-aids.html");
});

check("www + legacy 410 path: host redirect wins first (client re-requests on apex, then 410s there)", () => {
    const res = handler(makeEvent("www.acihearing.com", "/services/tinnitus", {}));
    assert.strictEqual(res.statusCode, 301);
    assert.strictEqual(res.headers.location.value, "https://acihearing.com/services/tinnitus");
});

console.log(`\n${passed} passed`);
if (process.exitCode) {
    console.error("Some checks FAILED — see above.");
} else {
    console.log("All checks passed.");
}
