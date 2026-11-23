#!/usr/bin/env python3
"""Page basics check (docs/plans/publish-readonly.md, step 5.4): every public page has a title, description, favicon and
share image; the files the site needs exist; the sitemap lists the public pages and never Muses; the share image is the right size.
    python3 tools/check-pages.py        # exit 1 and a list if anything is missing
"""
import re, struct, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ['index.html', 'dossier.html', 'atlas-3d.html', 'read.html', 'powers.html']
SCENES = ['sites/aurelia.html', 'sites/hollow-reach.html']
problems = []
bad = problems.append

for f in PUBLIC:
    s = (ROOT / f).read_text(encoding='utf-8')
    if not re.search(r'<title>[^<]+</title>', s): bad(f'{f}: no <title>')
    if 'name="description"' not in s: bad(f'{f}: no meta description')
    if 'rel="icon"' not in s: bad(f'{f}: no favicon link')
    if 'property="og:image"' not in s or 'property="og:title"' not in s: bad(f'{f}: no share preview (og:title / og:image)')
    if 'name="viewport"' not in s: bad(f'{f}: no viewport meta (phones)')
for f in SCENES:
    if 'rel="icon"' not in (ROOT / f).read_text(encoding='utf-8'): bad(f'{f}: no favicon link')
m = (ROOT / 'muses.html').read_text(encoding='utf-8')
if 'noindex' not in m: bad('muses.html: not marked noindex')

for f in ['favicon.svg', '404.html', 'robots.txt', 'sitemap.xml', 'social.png']:
    if not (ROOT / f).exists(): bad(f'{f}: missing')
png = ROOT / 'social.png'
if png.exists():
    d = png.read_bytes()
    w, h = struct.unpack('>II', d[16:24]) if d[:8] == b'\x89PNG\r\n\x1a\n' else (0, 0)
    if (w, h) != (1200, 630): bad(f'social.png is {w}x{h}, not 1200x630')
if (ROOT / 'sitemap.xml').exists():
    sm = (ROOT / 'sitemap.xml').read_text(encoding='utf-8')
    for f in PUBLIC:
        if (f if f != 'index.html' else '/</loc>') not in sm and f != 'index.html': bad(f'sitemap.xml: {f} not listed')
    if 'muses' in sm: bad('sitemap.xml lists Muses (the author\'s page)')
if (ROOT / 'robots.txt').exists() and 'muses.html' not in (ROOT / 'robots.txt').read_text(encoding='utf-8'): bad('robots.txt does not disallow muses.html')
if (ROOT / '404.html').exists() and 'Epitaph/' not in (ROOT / '404.html').read_text(encoding='utf-8'): bad('404.html does not link back to the front door')

if problems:
    print('Page basics: ' + str(len(problems)) + ' problem(s)'); [print('  - ' + p) for p in problems]; sys.exit(1)
print('Page basics passed.')
