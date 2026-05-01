"""Bulk update nav across all ACI HTML pages."""
import re
from pathlib import Path

ROOT = Path("/home/user/workspace/aci-hearing-proof")

REPLACEMENTS = [
    # 1. Rename "Hearing Repair" link label to "Hearing Aid Repair"
    (
        '<a href="./hearing-repair.html">Hearing Repair</a>',
        '<a href="./hearing-repair.html">Hearing Aid Repair</a>',
    ),
    # 2. Replace anchor links with dedicated pages
    (
        '<a href="./services.html#diagnostic-testing">Diagnostic Testing</a>',
        '<a href="./diagnostic-testing.html">Diagnostic Testing</a>',
    ),
    (
        '<a href="./services.html#custom-molds">Custom Molds</a>',
        '<a href="./custom-molds.html">Custom Molds</a>',
    ),
]

for html_file in sorted(ROOT.glob("*.html")):
    text = html_file.read_text()
    orig = text
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    if text != orig:
        html_file.write_text(text)
        print(f"Updated {html_file.name}")
    else:
        print(f"  unchanged {html_file.name}")
