function handler(event) {
    var request = event.request;
    var uri = request.uri;
    var qs = request.querystring || {};

    // ---- STEP 0 (NEW): www host -> apex host, 301, preserve path + query ----
    // ACI's homepage (and other pages) were ranking as two separate URLs in Search
    // Console: https://www.acihearing.com/ and https://acihearing.com/ — same page,
    // two hosts, both indexed, splitting link equity and click/impression counts.
    // acihearing.com (no www) is the chosen canonical host. Every request that
    // arrives on the www host gets redirected here before any of the existing
    // legacy-cleanup logic below runs, so a www request re-enters this function
    // a second time on the apex host and still gets steps 1-4.
    var host = (request.headers.host && request.headers.host.value) || "";
    if (host.toLowerCase() === "www.acihearing.com") {
        var qsString = buildQueryString(qs);
        var location = "https://acihearing.com" + uri + (qsString ? "?" + qsString : "");
        return {
            statusCode: 301,
            statusDescription: "Moved Permanently",
            headers: {
                "location": { value: location },
                "cache-control": { value: "public, max-age=604800" },
                "x-legacy-redirect": { value: "www-to-apex-host" }
            }
        };
    }

    // ---- STEP 1: et_core_page_resource_* query params → 301 to canonical URI ----
    // Divi/ElegantThemes tracking params. The underlying page still exists.
    // Consolidate authority by 301'ing to the clean URL.
    var hasEtCore = false;
    for (var key in qs) {
        if (key.toLowerCase().indexOf('et_core_page_resource') === 0) {
            hasEtCore = true;
            break;
        }
    }
    if (hasEtCore) {
        return {
            statusCode: 301,
            statusDescription: "Moved Permanently",
            headers: {
                "location": { value: uri },
                "cache-control": { value: "public, max-age=604800" },
                "x-legacy-redirect": { value: "et-core-page-resource-strip" }
            }
        };
    }

    // ---- STEP 2: Common WordPress permalink fallbacks → 301 to / ----
    if (uri === "/" && (qs.p || qs.page_id)) {
        return {
            statusCode: 301,
            statusDescription: "Moved Permanently",
            headers: {
                "location": { value: "/" },
                "cache-control": { value: "public, max-age=604800" },
                "x-legacy-redirect": { value: "wp-permalink-fallback" }
            }
        };
    }

    // ---- STEP 3: Legacy Divi/WordPress paths → 410 Gone (v1 patterns) ----
    var legacyPatterns = [
        /^\/services\/tinnitus\/?$/i,
        /^\/services\/hearing-aids\/?$/i,
        /^\/services\/hearing-tests?\/?$/i,
        /^\/services\/cochlear-implants?\/?$/i,
        /^\/services\/pediatric-audiology\/?$/i,
        /^\/services\/hearing-protection\/?$/i,
        /^\/services\/custom-molds?\/?$/i,
        /^\/services\/diagnostic-testing\/?$/i,
        /^\/services\/?$/i,
        /^\/wp-content\//i,
        /^\/wp-includes\//i,
        /^\/wp-admin\//i,
        /^\/wp-json\//i
    ];
    for (var i = 0; i < legacyPatterns.length; i++) {
        if (legacyPatterns[i].test(uri)) {
            return legacy410Response();
        }
    }

    // ---- STEP 4 (NEW v3): Legacy Divi/MyPractice directory subpaths → 410 Gone ----
    // These are pre-migration directory URLs (e.g. /hearing-aids/affordable-hearing-aids/).
    // Canonical pages now live at flat .html files (/hearing-aids.html, /tinnitus.html, etc.).
    // Directory-style subpaths under these prefixes are all legacy and should 410.
    // Guard: these patterns REQUIRE a subpath segment, so /hearing-aids.html will NOT match.
    var legacyDirectorySubpaths = [
        /^\/hearing-aids\/[^\/]+\/?$/i,
        /^\/tinnitus\/[^\/]+\/?$/i,
        /^\/cochlear-implants?\/[^\/]+\/?$/i,
        /^\/pediatric-audiology\/[^\/]+\/?$/i,
        /^\/hearing-protection\/[^\/]+\/?$/i,
        /^\/hearing-loss\/[^\/]+\/?$/i,
        /^\/hearing-tests?\/[^\/]+\/?$/i,
        /^\/services\/[^\/]+\/[^\/]+\/?$/i,
        /^\/hearing-aids\/?$/i,
        /^\/tinnitus\/?$/i,
        /^\/cochlear-implants?\/?$/i,
        /^\/pediatric-audiology\/?$/i
    ];
    for (var j = 0; j < legacyDirectorySubpaths.length; j++) {
        if (legacyDirectorySubpaths[j].test(uri)) {
            return legacy410Response();
        }
    }

    return request;
}

// Rebuilds a query string from a CloudFront Functions querystring object,
// which arrives pre-parsed (no raw string is exposed to the runtime).
// Handles both single-value and multiValue (repeated key) params.
function buildQueryString(qs) {
    var parts = [];
    for (var key in qs) {
        var entry = qs[key];
        if (entry.multiValue) {
            for (var i = 0; i < entry.multiValue.length; i++) {
                parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(entry.multiValue[i].value));
            }
        } else if (entry.value !== undefined && entry.value !== "") {
            parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(entry.value));
        } else {
            parts.push(encodeURIComponent(key));
        }
    }
    return parts.join("&");
}

function legacy410Response() {
    return {
        statusCode: 410,
        statusDescription: "Gone",
        headers: {
            "content-type": { value: "text/html; charset=utf-8" },
            "cache-control": { value: "public, max-age=604800" },
            "x-legacy-410": { value: "aci-legacy-cleanup" }
        },
        body: "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><title>Page removed | ACI Hearing Center</title><meta name=\"robots\" content=\"noindex\"></head><body style=\"font-family:sans-serif;max-width:640px;margin:60px auto;padding:20px;\"><h1>This page has been permanently removed.</h1><p>The page you were looking for was part of our old website and no longer exists. Please visit <a href=\"https://acihearing.com/\">our home page</a> or use one of these direct links:</p><ul><li><a href=\"https://acihearing.com/hearing-aids.html\">Hearing aids</a></li><li><a href=\"https://acihearing.com/lenire-tinnitus-treatment.html\">Tinnitus treatment (Lenire)</a></li><li><a href=\"https://acihearing.com/cochlear-implants.html\">Cochlear implants</a></li><li><a href=\"https://acihearing.com/pediatric-audiology.html\">Pediatric audiology</a></li><li><a href=\"https://acihearing.com/hearing-tests.html\">Hearing tests</a></li><li><a href=\"https://acihearing.com/financing.html\">Financing</a></li><li><a href=\"https://acihearing.com/team.html\">Meet our audiologists</a></li><li><a href=\"https://acihearing.com/contact.html\">Contact us: 337-223-9448</a></li></ul></body></html>"
    };
}
