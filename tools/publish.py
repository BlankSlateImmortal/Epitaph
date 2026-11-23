#!/usr/bin/env python3
"""Publish: one command from the vault to the live site (docs/plans/publish-readonly.md, step 4.1).

    python3 tools/publish.py                  # sync chapters, take the newest epitaph-data*.js from Downloads, check, test, then ask
    python3 tools/publish.py --snapshot PATH  # use this snapshot file instead of the newest one in Downloads
    python3 tools/publish.py --dry-run        # do everything except copy the snapshot, commit or push (changes nothing)
    python3 tools/publish.py --skip-visitor   # skip the headless visitor test (slow; not recommended before a push)

What it does, in order (it stops at the first problem):
  1. tools/sync-chapters.py: canon chapters from the vault into chapters/ (drafts never leave the vault).
  2. Finds the snapshot you made in the Dossier (Data > Publish snapshot downloads epitaph-data.js): the newest
     epitaph-data*.js in ~/Downloads, or --snapshot PATH.
  3. Checks it is for the chapters you are publishing: its `publishedThrough` must equal the highest chapter in chapters/index.json.
  4. tools/check-snapshot.py on the candidate against the new chapters/index.json (the leak audit). Nothing is copied if it fails.
  5. Copies it to published/epitaph-data.js.
  6. tools/check-pages.py (titles, favicon, sitemap...) then tools/visitor-test/run.js: every page as a stranger (reader mode, no write controls, nothing stored, no private text).
     If it fails, the copy is rolled back.
  7. Shows what changed, then ASKS before `git commit` and again before `git push`. It stages only chapters/ and published/.
Nothing is pushed unless you answer yes to the push question. The vault's drafts are never read here.
"""
import argparse, json, re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOWNLOADS = Path.home() / 'Downloads'
TARGET = ROOT / 'published' / 'epitaph-data.js'
INDEX = ROOT / 'chapters' / 'index.json'
ATTRIBUTION = 'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'


def say(msg=''):
    print(msg, flush=True)


def die(msg):
    say('\nSTOPPED: ' + msg)
    sys.exit(1)


def run(cmd, **kw):
    return subprocess.run(cmd, cwd=ROOT, **kw)


def ask(question):
    try:
        return input(question + ' [y/N] ').strip().lower() in ('y', 'yes')
    except EOFError:
        return False


def highest_chapter():
    try:
        entries = json.loads(INDEX.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None
    nums = [e.get('chapter') for e in entries if isinstance(e, dict) and isinstance(e.get('chapter'), int)]
    return max(nums) if nums else None


def snapshot_through(path):
    """publishedThrough from an epitaph-data.js file (a script that sets window.EPITAPH_PUBLISHED = {...};)."""
    text = path.read_text(encoding='utf-8')
    m = re.search(r'window\.EPITAPH_PUBLISHED\s*=\s*(\{.*\})\s*;?\s*$', text, re.S)
    if not m:
        die(f'{path} does not look like a published snapshot (no window.EPITAPH_PUBLISHED = {{…}}).')
    try:
        data = json.loads(m.group(1))
    except ValueError as e:
        die(f'{path} is not valid: {e}')
    return data.get('publishedThrough'), data


def newest_download():
    files = sorted(DOWNLOADS.glob('epitaph-data*.js'), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--snapshot', help='a snapshot file (default: the newest epitaph-data*.js in ~/Downloads)')
    ap.add_argument('--dry-run', action='store_true', help='check everything, change nothing')
    ap.add_argument('--skip-visitor', action='store_true', help='skip the headless visitor test')
    ap.add_argument('--vault', help='another Chapters folder (passed to sync-chapters.py)')
    args = ap.parse_args()

    branch = run(['git', 'branch', '--show-current'], capture_output=True, text=True).stdout.strip()
    say(f'Branch: {branch or "(detached)"}' + ('' if branch == 'main' else '   <- the site is served from main; this is not main'))
    if run(['git', 'status', '--porcelain', '--', 'chapters', 'published'], capture_output=True, text=True).stdout.strip():
        say('Note: chapters/ or published/ already have uncommitted changes; they will be included in the commit if you say yes.')

    # 1. chapters
    say('\n1. Syncing canon chapters from the vault…')
    sync = [sys.executable, str(ROOT / 'tools' / 'sync-chapters.py')] + (['--vault', args.vault] if args.vault else [])
    if run(sync).returncode != 0:
        die('sync-chapters.py failed.')
    top = highest_chapter()
    say(f'   Published chapters go up to: {top if top is not None else "none (coming-soon site)"}')

    # 2. snapshot
    say('\n2. Finding the snapshot…')
    snap = Path(args.snapshot).expanduser() if args.snapshot else newest_download()
    if snap is None or not snap.exists():
        die('No epitaph-data*.js in ~/Downloads. In the Dossier: Data > Publish snapshot, then run this again (or pass --snapshot PATH).')
    through, data = snapshot_through(snap)
    say(f'   Using {snap} (published through chapter {through})')

    # 3. same chapters?
    if through != top:
        die(f'The snapshot is for chapter {through}, but chapters/index.json goes up to {top}. '
            'Make the snapshot again in the Dossier with the right chapter number, then re-run.')

    # 4. leak audit on the candidate
    say('\n3. Leak check (tools/check-snapshot.py)…')
    if run([sys.executable, str(ROOT / 'tools' / 'check-snapshot.py'), str(snap)]).returncode != 0:
        die('The leak check failed. Nothing was copied. Fix what it lists (in the Dossier or the chapter properties), make a new snapshot, and re-run.')

    if args.dry_run:
        say('\nDry run: everything above passed. Nothing was copied, committed or pushed.')
        return 0

    # 5. copy (keep the old one to roll back)
    say('\n4. Copying the snapshot into published/…')
    backup = TARGET.read_bytes() if TARGET.exists() else None
    if snap.resolve() != TARGET.resolve():
        shutil.copyfile(snap, TARGET)

    def roll_back():
        if backup is None:
            TARGET.unlink(missing_ok=True)
        else:
            TARGET.write_bytes(backup)
        say('   Rolled published/epitaph-data.js back to what it was.')

    # 5b. page basics (title, description, favicon, sitemap...)
    if run([sys.executable, str(ROOT / 'tools' / 'check-pages.py')]).returncode != 0:
        roll_back()
        die('The page basics check failed (see above), so the snapshot was not kept.')

    # 6. visitor test
    if args.skip_visitor:
        say('\n5. Visitor test skipped (--skip-visitor).')
    else:
        say('\n5. Visitor test (tools/visitor-test/run.js; about two minutes)…')
        if run(['node', str(ROOT / 'tools' / 'visitor-test' / 'run.js')]).returncode != 0:
            roll_back()
            die('The visitor test failed, so the snapshot was not kept. Chapters in chapters/ were still synced; see the output above.')

    # 7. show, ask, commit, ask, push
    say('\n6. What changed:')
    run(['git', 'status', '--short', '--', 'chapters', 'published'])
    run(['git', 'diff', '--stat', '--', 'chapters', 'published'])
    if not run(['git', 'status', '--porcelain', '--', 'chapters', 'published'], capture_output=True, text=True).stdout.strip():
        say('\nNothing changed: the site already has these chapters and this snapshot.')
        return 0
    if not ask('\nCommit these changes (chapters/ and published/ only)?'):
        say('Not committed. The files are in place; run again, or commit them yourself.')
        return 0
    label = f'chapter {top}' if top is not None else 'coming soon'
    run(['git', 'add', '--', 'chapters', 'published'], check=True)
    run(['git', 'commit', '-m', f'Publish: through {label}\n\n{ATTRIBUTION}'], check=True)
    if not ask(f'Push to GitHub now (branch {branch}; this makes it public)?'):
        say('Committed, not pushed. Push when you are ready: git push')
        return 0
    if run(['git', 'push', 'origin', branch]).returncode != 0:
        die('git push failed (see above).')
    say('\nPushed. GitHub Pages usually updates within a minute.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
