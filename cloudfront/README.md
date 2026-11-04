# ACI CloudFront function: `aci-legacy-410`

## Bug this fixes

`www.acihearing.com` and `acihearing.com` are the same site behind the same
CloudFront distribution (`E1GL9UDE5Y8WGK`, origin
`aci-hearing.s3-website.us-east-2.amazonaws.com`), but nothing ever redirected
one host to the other. Google Search Console indexes and ranks them as two
separate URLs — August: 57 clicks on the www homepage, 45 on the apex
homepage, both counted as weaker pages instead of one 102-click page. Same
split shows up on growing pages (e.g. `tinnitus.html` on both hosts).

## Fix

`aci-legacy-410.js` gets a new **Step 0**, ahead of the existing
et_core/WordPress/legacy-410 logic: any request that arrives on
`www.acihearing.com` gets a `301` to the same path + query string on
`acihearing.com`. The browser then re-requests on the apex host, where the
existing steps 1-4 still apply exactly as before (verified by the regression
checks in `test/`).

`acihearing.com` is the canonical host, matching what's already in the
site's own `<link rel="canonical">` tags in the `aci-hearing-proof` repo.

Query strings are rebuilt from CloudFront's parsed `querystring` object
(the runtime never exposes a raw query string) via `buildQueryString()`,
which also handles repeated/multi-value params.

## Test

```
node cloudfront/test/aci-legacy-410.test.js
```

Simulates viewer-request events with Node's built-in `vm` module (no
dependencies to install). 14 checks: the new www->apex redirect (root path,
deep path, single query param, multi-value query param, case-insensitive
host match, apex host passthrough, missing host header) plus regressions on
all four pre-existing behaviors (et_core strip, WP permalink fallback,
legacy `/services/*` 410s, legacy directory-subpath 410s, and the flat-page
guard that must NOT 410).

## Q-0028 add-on (2026-11-02): legacy 301s + robots unblock

A new **Step -1** runs before the www step, so both hosts reach the final URL in one hop:

| Old URL (optional trailing slash, any case) | 301 to |
|---|---|
| `/locations/lafayette-la/` | `https://acihearing.com/audiologist-lafayette-la.html` |
| `/services/tinnitus/` (was 410) | `https://acihearing.com/tinnitus.html` |
| `/location-contact/` | `https://acihearing.com/contact.html` |

Query strings get dropped. Header: `x-legacy-redirect: q0028-legacy-301`. Every other `/services/*` path still 410s.
`robots.txt` no longer disallows `/services/`, `/locations/`, `/location-contact/` or `/location/`, so Google can
recrawl them and see the 301s and 410s. Both pieces ship together: the robots change does nothing useful until
the function is published.

Verify after publish (expect 301 with a single Location hop):
```
for u in /locations/lafayette-la/ /services/tinnitus/ /location-contact/; do
  curl -sI "https://acihearing.com$u" | grep -iE '^(HTTP|location)'
  curl -sI "https://www.acihearing.com$u" | grep -iE '^(HTTP|location)'
done
```
Rollback: republish the previous LIVE function version (or PR #2's version), revert robots.txt, and invalidate `/robots.txt` plus the three paths.

## NEEDS GAVIN — publishing this

I (this agent) am AWS **read-only** and cannot publish a CloudFront
function. Per `aios-private` PR #1, the scoped Apex IAM user also lacks
`cloudfront:UpdateFunction`/`PublishFunction` — this has to be done from an
account with those permissions (e.g. `gavin-admin`).

Live function ETag as of 2026-09-25: `E1F83G8C2ARO7P` (confirm with the
`describe-function` call below before updating — if it's changed, get the
current live code first and re-diff against this file rather than
overwriting blind).

```bash
set -a && source "/Users/theagency/AI OS/AIS-OS/.env" && set +a

# 1. Confirm the current live ETag hasn't moved since this branch was cut
aws cloudfront describe-function --name aci-legacy-410 --stage LIVE \
  --profile gavin-admin --query 'ETag' --output text

# 2. Push this file to the DEVELOPMENT stage (use the ETag from step 1)
aws cloudfront update-function --name aci-legacy-410 \
  --if-match <ETAG_FROM_STEP_1> \
  --function-config Comment="www-to-apex 301 + existing legacy 410/redirect logic",Runtime=cloudfront-js-1.0 \
  --function-code fileb://cloudfront/aci-legacy-410.js \
  --profile gavin-admin

# 3. Test in DEVELOPMENT stage first (CloudFront's own test-function API)
aws cloudfront test-function --name aci-legacy-410 --stage DEVELOPMENT \
  --if-match <NEW_ETAG_FROM_STEP_2> \
  --event-object fileb://cloudfront/test/sample-www-event.json \
  --profile gavin-admin

# 4. Get the new DEVELOPMENT ETag, then publish to LIVE
aws cloudfront describe-function --name aci-legacy-410 --stage DEVELOPMENT \
  --profile gavin-admin --query 'ETag' --output text

aws cloudfront publish-function --name aci-legacy-410 \
  --if-match <ETAG_FROM_STEP_4> \
  --profile gavin-admin

# 5. Confirm live
curl -sI -H "Host: www.acihearing.com" https://d34gi1lanblzfi.cloudfront.net/ | head -5
# expect: HTTP/2 301, location: https://acihearing.com/
```

No content deploy needed — this only touches the CloudFront function, not
the site files in the `content/aci-0924` branch.

After it's live, also confirm the GSC property set covers `acihearing.com`
(the task noted "confirm the GSC property covers the chosen host" — that's
a Search Console check, not an AWS one, and needs whoever holds GSC access
for this client).

## 2026-11-04: legacy 404/410 URLs -> one-hop 301s

The broken-link audit found 541 old WordPress/MyPractice URLs that returned
404 or 410. 540 of them now 301 straight to a live page (`/index.html` is a
200 home page and is left alone). QA added one more row
(`/category/tinnitus-articles/hearing-tests.html` -> `/hearing-tests.html`), for 541
rows in total. The full list, with the target, match type
and a one-line reason for every row, is `redirects/legacy-redirects-2026-11-04.csv`.

- `exact-article`: the old post covers the same topic as a live article in
  `/articles/` (checked against the archived title/body, not the slug).
- `exact-page`: the same page under a new URL (e.g. `/about.asp` -> `/about.html`,
  `/2020/07/14/custom-molds.html` -> `/custom-molds.html`).
- `section`: no matching article, so it goes to the closest section page.

### How the function stores them (10 KB limit)

CloudFront Functions code is capped at 10,240 bytes, so the map is not stored
as 541 regexes. STEP -1 (`legacyTarget()`) works on the path lower-cased with
the trailing slash removed, and checks in this order:

1. `/2020/07/14/<page>.html` and `/hearing-aids-news/how-current-…-aids/<page>.html`
   (relative-link artifacts of live pages) -> `/<page>.html` (`index.html` -> `/`), only
   for the 15 known pages (about, cochlear-implants, contact, custom-molds,
   diagnostic-testing, hearing-aids, hearing-protection, hearing-repair, hearing-tests,
   index, learn-more, reviews, services, team, tinnitus). Any other page under those
   two folders returns `null` and falls through to the normal 404, so it never 301s
   to a missing page.
2. `H`: 32-bit hash (`h = h*31 + char mod 2^32`, base 36) of the path, grouped by
   target code; `T` is the space-separated target list (`*slug` = `/articles/slug.html`,
   `~` = `hearing`, `=` = the article with the same slug as the old URL, empty = `/`).
3. `D`: prefix defaults for anything not hashed: date/category/author/news archives
   (`/20xx/xx/`, `/category/`, `/author/`, `/news/`, `/hearing-loss-news/`,
   `/hearing-loss-tips/`) -> `/learn-more.html`; `/hearing-loss(-articles)/x` -> `/hearing-loss.html`;
   `/hearing-aids(-news)/x` -> `/hearing-aids.html`; `/hearing-test-info/x` ->
   `/hearing-tests.html`; `/tinnitus-articles/x` -> `/tinnitus.html`.

STEP -1 runs before the www step, so `www.` and apex both reach the final URL
in one hop. Query strings are dropped. The three Q-0028 redirects are folded
into the same table.

Do not hand-edit `T` or `H`. Edit the CSV, then run:

```
python3 cloudfront/tools/gen-legacy-redirects.py   # rewrites T/H, fails if over 10 KB
node cloudfront/test/aci-legacy-410.test.js
```

The generator fails on a hash collision or a conflicting duplicate row.

### Behavior changes

- `/services/`, `/services/hearing-tests/`, `/services/cochlear-implants/`,
  `/services/hearing-protection/`, `/hearing-aids/`, `/hearing-loss/` and the
  `/hearing-aids/*` and `/hearing-loss/*` subpaths used to 410. They now 301 to
  their CSV target (or the prefix default). The old test that expected
  `/hearing-aids/affordable-hearing-aids/` to 410 now checks `/tinnitus/foo/` and
  `/pediatric-audiology/foo/` instead.
- `/wp-login.php`, `/xmlrpc.php`, `/wp-admin` and `/wp-content` 410 with or without
  the trailing slash.
- `/wp-content/`, `/wp-includes/`, `/wp-admin/`, `/wp-json/` and the other
  STEP 3/4 patterns still 410. The 410 body is unchanged.
- The STEP 3/4 regex lists were merged into one `GONE` list with the same
  matches. Long comments were moved here to make room.

### Tests added

Every CSV row is checked on apex and www, with and without the trailing slash
(301, exact `Location`, header). Every target must exist in the repo and pass
through untouched, so there are no chains or loops. Every live `.html` page in
the repo must pass through. `/wp-*` must still 410, unlisted old posts must
fall back to their section, and the file must stay under 10,240 bytes.
