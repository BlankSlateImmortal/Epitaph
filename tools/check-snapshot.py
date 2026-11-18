#!/usr/bin/env python3
"""Leak check for the published snapshot (docs/plans/publish-readonly.md, step 2.2).

    python3 tools/check-snapshot.py                              # published/epitaph-data.js against chapters/index.json
    python3 tools/check-snapshot.py path/to/epitaph-data.js      # another file (e.g. straight from Downloads)
    python3 tools/check-snapshot.py --drafts PATH                # the private drafts (default: the vault's epitaph-drafts.json)

It does not trust the builder. From chapters/index.json (what is published) and the private drafts it works out on its
own what readers may not see yet, and fails (exit code 1) if any of it is in the file:
  - fields that are never published (secrets, notes, backstory, knowledge, ...)
  - anything dated after the last published chapter, or a snapshot that claims more chapters than are published
  - with the drafts: timeline moments no published chapter reveals (their ids and titles), and places no published
    chapter brings up (their ids and names)
  - with the author's Dossier backup (auto-detected, or --backup PATH): a character's race shown before a chapter reveals it
    (`reveals: [Twisted]`, `Orin: Twisted` or `Orin race`; the plain type `person` is never held), and characters who are not in the
    snapshot but whose names appear in it
The author's rule: a reader sees a thing only from the chapter that reveals it; chapters reveal things by listing them
(moments, characters, world, reveals). Nothing is changed; it only reads and reports.
"""
import argparse, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DRAFTS = Path.home() / 'Downloads/Epitaph/Site work/files/epitaph-drafts.json'
FORBIDDEN_KEYS = {
    'secrets', 'notes', 'backstory', 'knowledge', 'lore', 'objective', 'headingToward', 'archetype', 'archetypeReason',
    'copiedFrom', 'locked', 'museIds', 'authority', 'divineStatus', 'primordial', 'effect', 'cost', 'ends', 'source',
    'herald', 'plane', 'planeLevel', 'planeName', 'voidedRank', 'black', 'grafts', 'gift', 'rings', 'cuts', 'domain',
    'corrupted', 'boundTo', 'draft', 'removed', 'note',
}
# fields whose name starts with these are never published either
FORBIDDEN_PREFIXES = ('legacy',)
# 'note' is allowed where the builder writes a scrubbed note of its own
NOTE_OK_PARENTS = {'states', 'alliances', 'beasts'}


def norm(s):
    s = re.sub(r'\s+', ' ', str(s or '').strip().lower())
    return s[4:] if s.startswith('the ') else s


def load_snapshot(path):
    text = path.read_text(encoding='utf-8')
    m = re.search(r'window\.EPITAPH_PUBLISHED\s*=\s*', text)
    if not m:
        raise ValueError(f'{path}: not a snapshot (no window.EPITAPH_PUBLISHED)')
    return json.loads(text[m.end():].strip().rstrip(';'))


def keys_with_parents(o, parent=None):
    if isinstance(o, dict):
        for k, v in o.items():
            yield k, parent
            yield from keys_with_parents(v, k)
    elif isinstance(o, list):
        for x in o:
            yield from keys_with_parents(x, parent)


def all_values(o, key):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == key:
                yield v
            yield from all_values(v, key)
    elif isinstance(o, list):
        for x in o:
            yield from all_values(x, key)


def world_names():
    """place id -> name, read from assets/epitaph-world.js (the built-in places)."""
    src = (ROOT / 'assets/epitaph-world.js').read_text(encoding='utf-8')
    return {m.group(1): m.group(2) for m in re.finditer(r"\{\s*id:\s*'([^']+)'[^{}]*?name:\s*'((?:[^'\\]|\\.)+)'", src)}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('snapshot', nargs='?', default=str(ROOT / 'published/epitaph-data.js'))
    ap.add_argument('--index', default=str(ROOT / 'chapters/index.json'))
    ap.add_argument('--drafts', default=str(DEFAULT_DRAFTS))
    ap.add_argument('--backup', default=None, help="the author's Dossier backup (default: the newest epitaph-backup/fixed-DATE.json beside the drafts)")
    a = ap.parse_args()

    problems = []
    data = load_snapshot(Path(a.snapshot))
    n = data.get('publishedThrough')
    index_path = Path(a.index)
    index = json.loads(index_path.read_text(encoding='utf-8')) if index_path.exists() else []
    published = [c for c in index if isinstance(c.get('chapter'), int)]
    pub_max = max((c['chapter'] for c in published), default=None)
    text = json.dumps(data, ensure_ascii=False).lower()

    # 1. fields that are never published
    for k, parent in keys_with_parents(data):
        if k == 'note' and parent in NOTE_OK_PARENTS:
            continue
        if k in FORBIDDEN_KEYS or k.startswith(FORBIDDEN_PREFIXES):
            problems.append(f'field "{k}" is never published (found under "{parent}")')

    # 2. the snapshot can't be ahead of the published chapters
    if n is None:
        d = data.get('dossier', {})
        for name, part in (('characters', d.get('characters')), ('chapters', d.get('chapters')), ('timeline', data.get('timeline')), ('sites', data.get('sites'))):
            if part:
                problems.append(f'nothing is published yet, but the snapshot has {len(part)} {name}')
    elif pub_max is None or n > pub_max:
        problems.append(f'the snapshot says it is published through chapter {n}, but chapters/index.json only has {pub_max}')

    # 3. nothing dated after the last published chapter
    if n is not None:
        for c in data.get('dossier', {}).get('chapters', []):
            if c.get('number', 0) > n:
                problems.append(f'chapter {c.get("number")} is listed but not published')
        for ch in data.get('dossier', {}).get('characters', []):
            if (ch.get('introducedIn') or 0) > n:
                problems.append(f'{ch.get("name")} is introduced in chapter {ch.get("introducedIn")}, after {n}')
            for v in ch.get('snapshots', []):
                if not isinstance(v.get('startChapter'), int) or v['startChapter'] > n:
                    problems.append(f'{ch.get("name")}: a chapter version starting at {v.get("startChapter")} is published')
        for r in all_values(data, 'revealedIn'):
            if r is None or (isinstance(r, int) and r > n):
                problems.append(f'something revealed in chapter {r} is published (last published: {n})')
        for e in data.get('timeline', []):
            w = e.get('when') or {}
            rc = 0 if e.get('open') else e.get('revealedAt', w.get('chapter'))
            if rc is None or rc > n:
                problems.append(f'timeline moment "{e.get("id")}" is published, but no published chapter reveals it')

    # 4. with the private drafts: what must not be in the file at all
    drafts_path = Path(a.drafts)
    checked_drafts = False
    if drafts_path.exists():
        checked_drafts = True
        drafts = json.loads(drafts_path.read_text(encoding='utf-8'))
        upto = [c for c in published if n is not None and c['chapter'] <= n]
        moment_ch, world_ch = {}, {}
        for c in upto:
            for m in c.get('moments') or []:
                moment_ch[m] = min(moment_ch.get(m, 99999), c['chapter'])
            for w in c.get('world') or []:
                k = norm(str(w).split('=')[0])
                world_ch[k] = min(world_ch.get(k, 99999), c['chapter'])
        events = (drafts.get('timeline') or {}).get('events') or {}
        def reveal(ev, eid):
            if ev.get('open'):
                return 0
            if ev.get('revealedAt') is not None:
                return ev['revealedAt']
            w = ev.get('when') or {}
            return w['chapter'] if w.get('chapter') is not None else moment_ch.get(eid)
        shown_events = set()
        for eid, ev in events.items():
            rc = reveal(ev, eid)
            if rc is not None and n is not None and rc <= n:
                shown_events.add(eid)
                continue
            if len(eid) >= 8 and f'"{eid.lower()}"' in text:
                problems.append(f'held-back timeline moment id "{eid}" is in the file')
            title = norm(ev.get('title'))
            if len(title) >= 20 and title in text:
                problems.append(f'held-back timeline moment "{eid}" (its title) is in the file')
        names = world_names()
        for pid, rec in ((drafts.get('sites') or {}).get('places') or {}).items():
            full = names.get(pid, pid)
            keys = {norm(full), norm(re.split(r'\s+[—–-]\s+', full)[-1]), norm(pid)}
            ref_chapters = [reveal(ev, eid) for eid, ev in events.items()
                            if f'place:{pid}' in (ev.get('refs') or []) and eid in shown_events]
            cands = [world_ch[k] for k in keys if k in world_ch] + [c for c in ref_chapters if c is not None]
            rc = 0 if rec.get('open') else (min(cands) if cands else None)
            if rc is not None and n is not None and rc <= n:
                continue
            if f'place:{pid.lower()}' in text or f'"{pid.lower()}"' in text:
                problems.append(f'held-back place "{pid}" is linked in the file')
            for k in keys:
                if len(k) > 3 and k != norm(pid) and k in text:
                    problems.append(f'held-back place "{full}" is named in the file ("{k}")')

    # 5. with the author's Dossier backup: held races and characters who are not in the file
    backup_name = None
    bpath = Path(a.backup) if a.backup else None
    if bpath is None:
        found = sorted([f for f in DEFAULT_DRAFTS.parent.glob('epitaph-*.json') if re.fullmatch(r'epitaph-(backup|fixed)-\d{4}-\d{2}-\d{2}\.json', f.name)], key=lambda f: f.stat().st_mtime)
        bpath = found[-1] if found else None
    if bpath and bpath.exists() and n is not None:
        backup_name = bpath.name
        chars = json.loads(bpath.read_text(encoding='utf-8')).get('characters', [])
        revealed = set()
        for c in published:
            if c['chapter'] <= n:
                revealed.update(norm(x) for x in (c.get('reveals') or []))
        snap_chars = {c.get('id'): c for c in d.get('characters', [])} if (d := data.get('dossier', {})) else {}
        for c in chars:
            race = str(c.get('race') or '').strip()
            name = str(c.get('name') or '').strip()
            sc = snap_chars.get(c.get('id'))
            if sc is not None and sc.get('race') and race.lower() != 'person':
                if not ({norm(race), norm(f'{name}: {race}'), norm(f'{name} race')} & revealed):
                    problems.append(f'{name}: the race "{race}" is published, but no published chapter reveals it')
            if sc is None and len(name) >= 3 and re.search(r'(^|[^a-z0-9])' + re.escape(name.lower()) + r'($|[^a-z0-9])', text):
                problems.append(f'{name} is not in the snapshot\'s characters, but the name appears in it')

    d = data.get('dossier', {})
    print(f'Snapshot: published through {n if n is not None else "nothing (coming soon)"}; '
          f'{len(d.get("characters", []))} characters, {len(data.get("timeline", []))} moments, {len(data.get("sites", []))} places, '
          f'{len(data.get("library", {}).get("items", []))} items. Published chapters: {pub_max if pub_max is not None else "none"}. '
          f'Drafts checked: {"yes" if checked_drafts else "no (file not found)"}. Dossier backup checked: {backup_name or "no"}.')
    if problems:
        print(f'\nLEAK CHECK FAILED: {len(problems)} problem(s). Do not publish this file.')
        for p in dict.fromkeys(problems):
            print('  -', p)
        return 1
    print('Leak check passed.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
