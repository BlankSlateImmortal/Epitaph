# Publishing a chapter

How a chapter goes from your vault to readers. The site is public on GitHub Pages; readers see only what a **published chapter** has revealed.

## The flow (about five minutes plus the test)

1. **Write the chapter** in the vault: `~/Downloads/Epitaph/Chapters/`. Drafts (`status: draft`) never leave the vault.
2. **Set its properties** at the top of the note. A reader sees a thing only from the chapter that lists it:
   - `chapter:` the number and `title:`
   - `characters:` who is introduced here (a character appears for readers from the chapter that lists them)
   - `moments:` timeline moments by id (they become visible, and dated, from this chapter)
   - `world:` places, as `Place = state`
   - `reveals:` items and marks by name, and a character's race (`Twisted` or `Orin: Twisted`)
   - `skills:` skills the chapter shows (the Dossier's Checks warn if one is still only a prospect)
   - `status: canon`  ← this is what publishes it. `publish: false` keeps a canon chapter out.
3. **Make the snapshot** in the Dossier (your browser, author mode): **Data → Publish snapshot**. Type the chapter number you are publishing through (it must equal the highest canon chapter). It downloads `epitaph-data.js` to Downloads. The Dossier's **Checks** should be clean first.
4. **Run the one command**, from the repo folder:
   ```
   python3 tools/publish.py
   ```
   It syncs the canon chapters, takes the newest `epitaph-data*.js` from Downloads, makes sure it is for the same chapter, runs the leak check, copies it into `published/`, runs the visitor test, and shows you what changed.
5. **Say yes twice** when it asks: once to commit, once to push. Nothing is pushed unless you answer yes. GitHub Pages updates in about a minute.

`python3 tools/publish.py --dry-run` does every check and changes nothing: use it to see whether you are ready.

## What "published through chapter N" does

`N` (the highest canon chapter in `chapters/index.json`) is the most a reader can ever know. Within that, each reader's own chapter ruler narrows it further. Moments, places, characters, items and marks that the published chapters do not list stay out of the file entirely: they are not hidden, they are not there.

## If it stops

| It says | Do this |
| --- | --- |
| No `epitaph-data*.js` in Downloads | Make the snapshot (step 3), then run again. |
| The snapshot is for chapter X but the chapters go up to Y | Make a new snapshot with the right number. |
| The leak check failed | Read what it lists. Usually a chapter has not listed a moment, place or race the Dossier shows; add it to the chapter's properties or mark the thing hidden, make a new snapshot, run again. |
| The visitor test failed | The snapshot is rolled back. The output names the page and the control or key that was wrong; tell Claude. |
| Not on `main` | The site is served from `main`. Merge there first, or expect the change to be live only after it is merged. |

## Things only you do

- Merging a branch into `main` (Claude never merges or pushes without your yes).
- Merging the private lore drafts into your own browser (Data → Merge): drafts live in the vault, never in the repo.
- A custom domain (plan step 5.5).

## Not planned

Uploading from the browser: a static site cannot accept an upload without a secret token, so the snapshot always goes through your computer and this script. An automatic check on GitHub (plan step 4.3) is optional and can only validate files, because it cannot read your vault.
