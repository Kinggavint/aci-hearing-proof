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
