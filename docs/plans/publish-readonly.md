# Publish: a read-only site for readers, everything editable for the author

Sister plans: [site-encyclopedia.md](site-encyclopedia.md), [creature-log.md](creature-log.md). This one changes how the whole site is shared,
so decide Phase 0 before the encyclopedias grow much further: they store their data the same way as everything else.

## Purpose (from the user, 2026-11-18)

Make the Dossier, the map and the chapters **read-only for visitors**, while **everything stays editable for the author**.
Then make the site a complete public web page, and make publishing new chapters easy.

## What is true today (checked 2026-11-18)

- Static site on GitHub Pages (`BlankSlateImmortal/Epitaph`, public): no build step, no workflow, no custom domain.
- **All data lives in each browser's localStorage** (Dossier `epitaph-character-profiles`, Library, muses, sites, timeline…).
  A visitor today would see an **empty** Dossier and map. So read-only needs a *published copy of the data*, not just hidden buttons.
- Chapters already have a publish path: `tools/sync-chapters.py` copies canon chapters from the vault into `chapters/` (drafts excluded
  because the repo is public); `read.html` fetches `chapters/index.json`.
- `assets/epitaph-sites.js` and `epitaph-timeline.js` ship the lore drafts, **readable in the page source** by anyone.
- GitHub Pages cannot log anyone in. "Author mode" can only be a convenience; the real protections are (1) secrets never being in
  published files and (2) only the author being able to push to the repo.

## Rules this plan follows

- **Secrets are removed, not hidden.** The published snapshot contains only what a reader may see at the **latest published chapter**.
  Anything later (secret moments, hidden places, their ties and any text naming them) is not in the file at all.
- **Readers keep their own chapter position** (`epitaph-reader-chapter`, in their own browser): it only narrows the snapshot further.
- **Author = everything as today**, including the Author view and the hidden-from-readers marks.
- **Always 7** still applies to any new scale or list (memory `epitaph-always-seven`).

## Status key

`[ ]` not started · `[~]` in progress · `[x]` done · `[-]` dropped (say why in the tweak log)

---

## Phase 0 — Design (decided 2026-11-18, Opus; the user chose every recommended option)

- [x] **0.1 Snapshot format.** One script file, **`published/epitaph-data.js`**, that sets `window.EPITAPH_PUBLISHED = { … }`, loaded with a
  normal `<script>` before the data modules, so they keep reading synchronously (no async refactor). Contents, all **resolved and filtered**
  (finished data, never the author's override stores):
  `{ schemaVersion: 1, publishedThrough, builtAt, dossier: { characters, chapters }, library: { places, items }, timeline: [events], sites: [records] }`.
  `publishedThrough` = the highest chapter in `chapters/index.json` (canon, published), **not** the Dossier's newest chapter.
- [x] **0.2 What is hidden.** **Allowlist, not blocklist:** only listed fields are published, so a field added later stays private until listed.
  - *Characters:* published only if a version starts at or before `publishedThrough`. Character fields: `id, name, faction, race, glyph,
    portrait*` (figure, style, seed, colour), `museIds` dropped. Per version (only versions starting ≤ `publishedThrough`): `id, startChapter,
    chapterRange, blurb, presence, location, condition, emotionalState, titles, skills, marks, inventory, relationships, stats/power, portrait
    and position fields`. **Never:** `secrets, notes, backstory, knowledge, lore, objective, headingToward, archetypeReason, copiedFrom, locked,
    legacy*`. Relationships only to published characters; inventory only items that exist in the published Library.
  - *Chapters:* number and title for chapters ≤ `publishedThrough`.
  - *Library:* places the author added (if referenced) and items held in a published version.
  - *Timeline:* events with `isRevealed(e, publishedThrough)` true for a reader (no author view), title, kind, when, refs; nothing else.
  - *Sites:* records with `placeReached(r, publishedThrough)`; only reached states; holders and founding stages whose dates are reached;
    alliances from `alliancesAt(…, author = false)`; every free-text field through `clean(…, author = false)`; `draft` flags dropped.
  - *Muses:* **not published**; the page and its links are author-only (quotes from other works never leave the author's browser).
  - *Before any chapter is published* (`chapters/index.json` empty, as now): a "coming soon" site. The map and the world (places, eras) show;
    no characters, no story moments, no story-tied encyclopedia entries.
  - Free text that hints at a secret without naming a hidden place is not caught: per-line `from` dates stay a site-encyclopedia 2.4 task.
- [x] **0.3 Who is the author?** Readers by default. Author mode once per browser with `?author=1` (remembered; `?author=0` turns it off), and
  always on `localhost`, `127.0.0.1` and `file://`. A convenience, not security.
- [x] **0.4 Where each page reads data.** One `EpitaphMode` decides. Reader: every data module's `load()` returns the snapshot's data and its
  `save()` does nothing (returns false), so nothing a visitor does survives a reload. Author: localStorage, as today. The only thing a reader's
  browser stores is their own `epitaph-reader-chapter` (and harmless view prefs like the map theme).
- [x] **0.5 What readers can still do.** View, search, filter, the chapter ruler, the map's camera and picking up swords (they return to their
  place; nothing is saved). Hidden: every form, editor, import/merge/export, delete, the Library editor, the book's editors, Muses.

**New step from 0.2 (the user chose to move the drafts out):**
- [~] **1.3 Move the lore drafts out of public files.** *(Steps 1–4 done 2026-11-18; step 5, the history squash, waits for the user's yes.)* (Sonnet, but read every line twice: this is about secrets.)
  1. Write the current `DEFAULTS` of `assets/epitaph-sites.js` and `assets/epitaph-timeline.js` into a private backup-shaped file in the vault,
     `~/Downloads/Epitaph/Site work/files/epitaph-drafts.json`: `{ characters: [], chapters: [], sites: { version, places: { <placeId>: <record minus placeId> } },
     timeline: { version, events: { <id>: <event> }, removed: [] } }`, so the Dossier's **Merge** imports it (Merge requires a `characters` array).
  2. Empty both `DEFAULTS` arrays in the code (keep the 7-sets, `KINDS`, the helpers). Keep a non-secret example only if the tests need one.
  3. Point the scratchpad tests at the drafts file instead of the code defaults.
  4. Tell the user to run Data → Merge with that file once, in every browser they author in.
  5. **History:** the drafts are in the commits of the local branch `shared-timeline`, which has **not been pushed**. Before the first push,
     ask the user to let you squash the branch into fresh commits without the drafts (`git reset --soft main` + recommit; local only, nothing on
     GitHub changes). If anything with the drafts was pushed already, stop and tell the user instead.

## Phase 1 — The mode switch

- [x] **1.1 `EpitaphMode`.** `assets/epitaph-mode.js`: `isAuthor()`, `setAuthor(on)`, `?author=1`, the `localhost` default, a body class
  (`mode-reader` / `mode-author`), an event on change. Replaces `EpitaphTimeline.authorMode` (keep that as an alias).
- [ ] **1.2 Reader chrome.** A small "Reading" tag and a link to the author switch hidden from readers; the author sees a clear
  "Author" tag and a preview-as-reader toggle (the one that exists in `opse`).

## Phase 2 — The snapshot

- [ ] **2.1 Export.** Dossier → Data → **Publish snapshot**: builds the filtered file from the author's browser data and downloads it
  (`published.json`). Reuses the filters in 0.2.
- [ ] **2.2 Check.** `tools/check-snapshot.py`: loads the file and fails if any hidden name, secret event id or later-chapter item appears
  anywhere in it (the leak audit, kept as a script).
- [ ] **2.3 Reader loading.** Each module (profiles, Library, muses, sites, timeline) loads from the snapshot when the mode is reader.

## Phase 3 — Read-only everywhere

- [ ] **3.1 Dossier.** Hide or disable every control that writes: new, edit, delete, chapter markers, import/merge, checks fixes.
  Keep reading, switching characters and chapters.
- [ ] **3.2 Map.** Library drawer editing, place adding, character moves: hidden. Swords can still be dragged, but nothing is saved.
- [ ] **3.3 Book (`opl`, `ops`, `opse`, `opcl`).** Editors hidden; the views stay.
- [ ] **3.4 Muses, Powers, Read.** Same rule.
- [ ] **3.5 A test as a visitor.** Headless Chromium with empty storage: every page loads from the snapshot, no write controls exist, and
  nothing is written to localStorage except the reader chapter.

## Phase 4 — Publishing chapters

- [ ] **4.1 One command.** `tools/publish.py`: runs `sync-chapters.py`, picks up the newest `published.json` from Downloads, runs the
  snapshot check, shows what changed, then **asks before** `git commit` and `git push`. Canon chapters only; drafts never leave the vault.
- [ ] **4.2 Chapter flow, written down.** Write in the vault → mark `status: canon` and list `moments:` → `publish` → live in a minute.
  The published chapter number becomes `publishedThrough`, which reveals the moments and places that chapter reaches.
- [ ] **4.3 (Later, optional)** A GitHub Action that only validates (it can't read the vault); uploading from the browser is **not**
  possible on a static site without a token, so it isn't planned.

## Phase 5 — A complete web page

- [ ] **5.1 Front door.** A landing page (`index.html` is the Dossier today): the title, a short "what is Epitaph", and the doors: Read,
  Dossier, Map, Book, Muses, Powers. Move the Dossier to its own path or keep it and add `home.html`: decide in this step.
- [ ] **5.2 One navigation bar** on every page, and a consistent footer.
- [ ] **5.3 Mobile and keyboard pass** (also site-encyclopedia 7.1): phone widths, focus order, both themes.
- [ ] **5.4 Page basics.** Titles, descriptions, social preview image, favicon, `404.html`, `robots.txt`, `sitemap.xml`.
- [ ] **5.5 Custom domain (optional).** The user buys it and sets DNS; add `CNAME`; turn on HTTPS in the repo settings.
- [ ] **5.6 Speed.** Lazy-load the heavy views (the 3D map, the book); check the first load on a phone.

---

## Which model (for Claude)

Same rule as the other plans: Sonnet for plumbing, Opus where judgment matters. Check your model at the start of every resume.

**Opus steps:** Phase 0 (done), 2.2 (the leak audit), 3.5 (the visitor test), 5.1 (the front door's design).
Every other step is a Sonnet step.

**If you are Sonnet**, stop and tell the user to switch to Opus (`/model`) before an Opus step, before anything that decides what is
hidden from readers, and after the same bug fails twice. Finish and commit first, and say it in one line.

## Resume protocol (for Claude)

When the user says "get back to it" and this is the active plan:
0. Check your model against **Which model**.
1. Read this file, `docs/CHANGES.md` since the last tweak-log entry, and `git log`.
2. Say which step is next and what any tweak changed in the plan; go ahead unless it is a real decision for the user.
3. After working: tick the steps, add a tweak-log line.

## Tweak log

Newest first.

- 2026-11-18 — 1.1 done (Sonnet): `assets/epitaph-mode.js`, loaded in the `<head>` of all five pages. `isAuthor()` (this browser is the author's: remembered `epitaph-author`, on by default for localhost, 127.0.0.1 and `file://`, off everywhere else; `?author=1` / `?author=0` sets it once and is removed from the address bar), `authorView()` / `canEdit()` (author and not previewing; the preview flag is the old `epitaph-author-mode`), `setAuthor`, `setAuthorView`, `onChange`. Classes on `<html>`: `is-author`, `mode-author`, `mode-reader`. `EpitaphTimeline.authorMode()` / `setAuthorMode()` now ask it (same names, so the encyclopedia is unchanged); a reader cannot switch themselves into author view, and the opse toggle is hidden for readers. Tested in Node (host defaults, the address parameter, preview, change events across tabs, the timeline alias) and in headless Chromium on every page (author vs `?author=0`). **Consequence once this is live:** the author must open the live site once with `?author=1` to get the Author view there; until 3.x, the edit controls are still visible to everyone (only the encyclopedia obeys the mode). **For 1.2 and 3.x:** hide edit controls with CSS on `.mode-reader` (e.g. mark them `edit-only`) and check `EpitaphMode.canEdit()` before any write.
- 2026-11-18 — 1.3 steps 1–4 done (Sonnet). The drafts (6 places, 37 moments) are in `~/Downloads/Epitaph/Site work/files/epitaph-drafts.json` (private, backup-shaped; a round trip into a fresh browser matched the code's drafts exactly before they were removed). `DEFAULTS` in `epitaph-sites.js` and `epitaph-timeline.js` are now empty, so **the public code ships no lore**; the user imports the file once per authoring browser with Data → Merge. Tests load the drafts file instead of the code. **Two things the work found:** (1) removing the defaults changed `save`: a partial `when` now merges instead of replacing (fixed); a reset or removed draft is simply gone, since there is no code default to fall back to. (2) **My own docs leaked secrets** (the schema note and changelog named plot twists as examples): scrubbed before anything was pushed; keep examples in plan docs generic from now on, because `docs/` is public. **Still open:** step 5, the local history of `shared-timeline` still contains the drafts and the earlier docs (nothing was pushed); and the **already-public** repo has plenty of lore of its own (`docs/CHANGES.md`, `sites/*.html`, the map code), which is the user's call, not part of this plan unless they want it added.
- 2026-11-18 — Phase 0 decided (Opus). The user chose: drafts move out of public files (new step 1.3), the safe character set, Muses author-only, and a coming-soon site until the first chapter is published. Design: snapshot as a script file setting `window.EPITAPH_PUBLISHED`, an allowlist of fields, cut at the latest *published* chapter. **Next: 1.3 first** (secrets out before anything is pushed), then 1.1, 1.2, 2.1, 2.3. All Sonnet; the leak audit 2.2 is Opus.
- 2026-11-18 — Plan written. Purpose from the user (read-only Dossier, map and chapters for readers; everything editable for the author;
  then a complete web page and easy chapter uploads). Found: data is in localStorage, so readers need a published snapshot; the lore drafts
  are in public JS files today. Phase 0 is not started: it needs Opus and the user's yes.
