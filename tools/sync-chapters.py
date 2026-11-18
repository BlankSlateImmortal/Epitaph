#!/usr/bin/env python3
"""Copy chapters written in the Obsidian vault into the site, for read.html.

    python3 tools/sync-chapters.py                 # canon chapters only (the safe default: the repo is public)
    python3 tools/sync-chapters.py --drafts        # also publish chapters with status: draft (marked DRAFT)
    python3 tools/sync-chapters.py --vault PATH    # another Chapters folder (default ~/Downloads/Epitaph/Chapters)

Reads every .md note in the vault's Chapters/ folder except the template, takes the
properties at the top (chapter, title, arc, pov, location, characters, moments, world,
reveals, status) and writes:
    chapters/<NNN>-<slug>.md   the chapter text (properties removed, markers kept: the
                               reader turns %% at: X %% into scene breaks and hides the rest)
    chapters/index.json        one entry per chapter, in chapter order
Chapters that are no longer in the vault (or are now drafts) are removed from chapters/.
A chapter can opt out with `publish: false`. Nothing else in the site is touched.
"""
import argparse, json, os, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'chapters'
LIST_KEYS = {'characters', 'moments', 'world', 'reveals'}


def parse_front(text):
    """A small reader for Obsidian's flat properties (no nested YAML needed)."""
    if not text.startswith('---'):
        return {}, text
    end = text.find('\n---', 3)
    if end == -1:
        return {}, text
    block, body = text[3:end].strip('\n'), text[end + 4:].lstrip('\n')
    data, key = {}, None
    for raw in block.split('\n'):
        line = raw.rstrip()
        if not line.strip():
            continue
        m = re.match(r'^([A-Za-z_][\w-]*):\s*(.*)$', line)
        if m:
            key, val = m.group(1), m.group(2).strip()
            if val.startswith('[') and val.endswith(']'):
                inner = val[1:-1].strip()
                data[key] = [clean(x) for x in split_inline(inner)] if inner else []
            elif val == '':
                data[key] = [] if key in LIST_KEYS else ''
            else:
                data[key] = clean(val)
        elif key and re.match(r'^\s*-\s+', line):
            if not isinstance(data.get(key), list):
                data[key] = []
            data[key].append(clean(re.sub(r'^\s*-\s+', '', line)))
    return data, body


def split_inline(s):
    out, depth, cur = [], 0, ''
    for ch in s:
        if ch == '[':
            depth += 1
        elif ch == ']':
            depth -= 1
        if ch == ',' and depth == 0:
            out.append(cur); cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return out


def clean(v):
    v = v.strip().strip('"').strip("'")
    v = re.sub(r'^\[\[([^\]|]+)(\|[^\]]+)?\]\]$', r'\1', v)   # [[Orin]] -> Orin
    return v


def as_int(v):
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return None


def slug(s):
    s = re.sub(r'[^a-z0-9]+', '-', (s or '').lower()).strip('-')
    return s[:48] or 'untitled'


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--vault', default=str(Path.home() / 'Downloads' / 'Epitaph' / 'Chapters'))
    ap.add_argument('--drafts', action='store_true', help='also publish draft chapters (marked DRAFT)')
    args = ap.parse_args()
    vault = Path(os.path.expanduser(args.vault))
    if not vault.is_dir():
        sys.exit(f'No Chapters folder at {vault}')

    entries, problems = [], []
    for f in sorted(vault.glob('*.md')):
        if 'template' in f.stem.lower():
            continue
        meta, body = parse_front(f.read_text(encoding='utf-8'))
        if meta.get('type') not in (None, '', 'chapter'):
            continue
        n = as_int(meta.get('chapter'))
        status = (meta.get('status') or 'draft').lower()
        if str(meta.get('publish', '')).lower() == 'false':
            continue
        if status != 'canon' and not args.drafts:
            continue
        if not n or n < 1:
            problems.append(f'{f.name}: no chapter number (set `chapter:` in its properties)')
            continue
        if any(e['chapter'] == n for e in entries):
            problems.append(f'{f.name}: chapter {n} is used twice')
            continue
        title = meta.get('title') or ''
        words = len(re.findall(r"[\w'’-]+", re.sub(r'%%.*?%%', ' ', body, flags=re.S)))
        entries.append({
            'chapter': n, 'title': title, 'arc': as_int(meta.get('arc')),
            'pov': meta.get('pov') or '', 'location': meta.get('location') or '',
            'characters': meta.get('characters') or [], 'moments': meta.get('moments') or [],
            'world': meta.get('world') or [], 'reveals': meta.get('reveals') or [], 'status': status, 'words': words,
            'file': f'{n:03d}-{slug(title)}.md', 'source': f.name, '_body': body
        })

    entries.sort(key=lambda e: e['chapter'])
    OUT.mkdir(exist_ok=True)
    keep = {e['file'] for e in entries} | {'index.json'}
    for old in OUT.glob('*.md'):
        if old.name not in keep:
            old.unlink()
    for e in entries:
        (OUT / e['file']).write_text(e.pop('_body'), encoding='utf-8')
    (OUT / 'index.json').write_text(json.dumps(entries, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    print(f'{len(entries)} chapter(s) published to chapters/' + (' (drafts included)' if args.drafts else ' (canon only)'))
    for e in entries:
        print(f"  CH {e['chapter']:>3}  {e['title'] or '(untitled)'}  [{e['status']}]  {e['words']} words")
    for p in problems:
        print('  ⚠ ' + p)


if __name__ == '__main__':
    main()
