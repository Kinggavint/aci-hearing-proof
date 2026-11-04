#!/usr/bin/env python3
"""Regenerate the STEP -1 redirect data in cloudfront/aci-legacy-410.js from
redirects/legacy-redirects-*.csv (plus the three Q-0028 redirects).

Rows whose target equals the prefix default (see DEFAULTS, mirrored in the JS)
are covered by the default regex; every other row is stored as a 32-bit hash
of its normalised path (lower-case, no trailing slash) grouped by target.
Run:  python3 cloudfront/tools/gen-legacy-redirects.py
"""
import csv, glob, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
JS = os.path.join(ROOT, 'cloudfront', 'aci-legacy-410.js')
CODES = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&\'()*+-./:<=>?@[]^_`{|}~'
EXTRA = [('/locations/lafayette-la/', '/audiologist-lafayette-la.html'),
         ('/services/tinnitus/', '/tinnitus.html'),
         ('/location-contact/', '/contact.html')]
# REL, KNOWN and DEFAULTS must match the JS (same order).
DEFAULTS = [
    (r'^/(20\d\d/\d\d/|category/|author/|news/|hearing-loss-news/|hearing-loss-tips/)', '/learn-more.html'),
    (r'^/hearing-loss(-articles)?/[^/]+$', '/hearing-loss.html'),
    (r'^/hearing-aids(-news)?/[^/]+$', '/hearing-aids.html'),
    (r'^/hearing-test-info/[^/]+$', '/hearing-tests.html'),
    (r'^/tinnitus-articles/[^/]+$', '/tinnitus.html'),
]
def norm(p):
    p = p.lower()
    return p[:-1] if len(p) > 1 and p.endswith('/') else p
def h(s):
    x = 0
    for c in s: x = (x * 31 + ord(c)) % 4294967296
    return x
def b36(n):
    d = '0123456789abcdefghijklmnopqrstuvwxyz'; o = ''
    while True:
        n, r = divmod(n, 36); o = d[r] + o
        if not n: return o
def enc(t):
    return _enc(t).replace('hearing', '~')
def _enc(t):
    if t == '=': return '='
    if t == '/': return ''
    m = re.match(r'^/articles/(.+)\.html$', t)
    if m: return '*' + m.group(1)
    m = re.match(r'^/([^/]+)\.html$', t)
    assert m, t
    return m.group(1)
REL = r'^/(?:2020/07/14|hearing-aids-news/how-current-hearing-aid-tools-overcome-stigma-about-hearing-loss-aids)/([a-z0-9-]+)\.html$'
KNOWN = r'^(about|contact|custom-molds|diagnostic-testing|index|learn-more|reviews|services|team|tinnitus|cochlear-implants|hearing-(aids|protection|repair|tests))$'
def default(p):
    m = re.match(REL, p)
    if m and not re.match(KNOWN, m.group(1)): return None  # unknown slug: normal 404
    if m: return '/' if m.group(1) == 'index' else '/%s.html' % m.group(1)
    for rx, t in DEFAULTS:
        if re.search(rx, p): return t
    return None
def build():
    rows = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'redirects', 'legacy-redirects-*.csv'))):
        rows += [(r['old_url'], r['target']) for r in csv.DictReader(open(f))]
    rows += EXTRA
    targets, groups, seen = [], {}, {}
    for old, t in rows:
        n = norm(old)
        if n in seen:
            assert seen[n] == t, ('conflict', old); continue
        seen[n] = t
        if default(n) == t: continue
        if t == '/articles/%s.html' % n.rsplit('/', 1)[1]: t = '='
        if t not in targets: targets.append(t)
        k = b36(h(n))
        groups.setdefault(t, []).append(k)
    allkeys = [k for g in groups.values() for k in g]
    assert len(allkeys) == len(set(allkeys)), 'hash collision'
    assert len(targets) <= len(CODES)
    T = ' '.join(enc(t) for t in targets)
    H = ''.join(';' + CODES[i] + ',' + ','.join(groups[t]) + ',' for i, t in enumerate(targets))
    return T, H, len(rows), len(allkeys)
if __name__ == '__main__':
    T, H, n, k = build()
    src = open(JS).read()
    src2 = re.sub(r'var T = ".*?";', 'var T = "%s";' % T, src, count=1)
    src2 = re.sub(r'var H = ".*?";', 'var H = "%s";' % H, src2, count=1)
    open(JS, 'w').write(src2)
    print('rows %d, hashed %d, bytes %d' % (n, k, len(src2.encode())))
    if len(src2.encode()) > 10240: sys.exit('over the 10 KB CloudFront Functions limit')
