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
- [x] **1.3 Move the lore drafts out of public files.** *(Steps 1–4 done 2026-11-18; step 5, the history squash, turned out not to be needed: see the 2026-11-23 tweak-log line.)* (Sonnet, but read every line twice: this is about secrets.)
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
- [x] **1.2 Reader chrome.** A small "Reading" tag and a link to the author switch hidden from readers; the author sees a clear
  "Author" tag and a preview-as-reader toggle (the one that exists in `opse`).

## Phase 2 — The snapshot

- [x] **2.1 Export.** Dossier → Data → **Publish snapshot**: builds the filtered file from the author's browser data and downloads it
  (`published.json`). Reuses the filters in 0.2.
- [x] **2.2 Check.** *(Done with the reveal rule, 2026-11-18.)* `tools/check-snapshot.py`: loads the file and fails if any hidden name, secret event id or later-chapter item appears
  anywhere in it (the leak audit, kept as a script).
- [x] **2.3 Reader loading.** Each module (profiles, Library, muses, sites, timeline) loads from the snapshot when the mode is reader.

## Phase 3 — Read-only everywhere

- [x] **3.1 Dossier.** Hide or disable every control that writes: new, edit, delete, chapter markers, import/merge, checks fixes.
  Keep reading, switching characters and chapters.
- [x] **3.2 Map.** Library drawer editing, place adding, character moves: hidden. Swords can still be dragged, but nothing is saved.
- [x] **3.3 Book (`opl`, `ops`, `opse`, `opcl`).** Editors hidden; the views stay.
- [x] **3.4 Muses, Powers, Read.** Same rule.
- [x] **3.5 A test as a visitor.** Headless Chromium with empty storage: every page loads from the snapshot, no write controls exist, and
  nothing is written to localStorage except the reader chapter.

## Phase 4 — Publishing chapters

- [x] **4.1 One command.** `tools/publish.py`: runs `sync-chapters.py`, picks up the newest `published.json` from Downloads, runs the
  snapshot check, shows what changed, then **asks before** `git commit` and `git push`. Canon chapters only; drafts never leave the vault.
- [x] **4.2 Chapter flow, written down.** Write in the vault → mark `status: canon` and list `moments:` → `publish` → live in a minute.
  The published chapter number becomes `publishedThrough`, which reveals the moments and places that chapter reaches.
- [ ] **4.3 (Later, optional)** A GitHub Action that only validates (it can't read the vault); uploading from the browser is **not**
  possible on a static site without a token, so it isn't planned.

## Phase 5 — A complete web page

- [x] **5.1 Front door.** A landing page (`index.html` is the Dossier today): the title, a short "what is Epitaph", and the doors: Read,
  Dossier, Map, Book, Muses, Powers. Move the Dossier to its own path or keep it and add `home.html`: decide in this step.
- [x] **5.2 One navigation bar** on every page, and a consistent footer.
- [x] **5.3 Mobile and keyboard pass** (also site-encyclopedia 7.1): phone widths, focus order, both themes.
- [x] **5.4 Page basics.** Titles, descriptions, social preview image, favicon, `404.html`, `robots.txt`, `sitemap.xml`.
- [ ] **5.5 Custom domain (optional).** The user buys it and sets DNS; add `CNAME`; turn on HTTPS in the repo settings.
- [x] **5.6 Speed.** Lazy-load the heavy views (the 3D map, the book); check the first load on a phone.

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

- 2026-11-23 — 1.3 step 5 closed, **no squash needed** (the user said yes; I checked first). The drafts were only in the local `backup/shared-timeline-full-history` branch (13 commits). The user's merge of PR #34 was already a squash, so `origin/main` is clean: 89 phrases from the private drafts file (timeline titles and summaries, every long text field of the six sites) were searched across all remote refs (`git log --remotes -S`) and found in **0** commits; the same search finds them in 2 commits of the backup branch (positive control). Every branch the work descends from (the current branch, `item-system`, `publish-mode`, `settlement-statues`) also has 0. So nothing was rewritten and the current branch (107 commits ahead of `origin/main`) is safe to push as far as the drafts go. The backup branch stays local; never push it. Not covered by this search: other private lore (e.g. Muses text, character notes) that was never in the drafts file; the snapshot's leak check covers only the snapshot.

- 2026-11-23 — 5.6 done (Sonnet). Measured first load (`node tools/visitor-test/perf.js`: Slow 4G, 4× slower CPU, 390px, gzipped like GitHub Pages, empty snapshot): front door 137 KB / 1.6 s · Read 263 KB / 2.0 s · Powers 670 KB / 4.3 s · Dossier 801 KB / 4.4 s · Map 529 KB / 4.9 s (budget: 8 s). Changes: 37 `<img>` templates are now `loading="lazy" decoding="async"`, and every page preconnects to the font file host (Dossier 4.7→4.4 s, Map 5.1→4.9 s). **Decided against** splitting the book out of the Dossier (about 100 KB gzipped, a risky reorder of ~15 scripts and shared globals, for under a second on a slow phone), and the Map is already its own page, so its 3D library (203 KB) loads only there. **Re-measure once real chapters and portraits are published:** the numbers above have no characters in them, and a character's render (the hero video poster) is the heavy part. Fonts are the largest single cost on every page (Source Serif 4 about 170 KB on the Dossier); self-hosting a subset is the next step if it ever matters.

- 2026-11-23 — 5.4 done (Sonnet). Every public page has a description, a favicon (`favicon.svg`, an amber E), a share preview (Open Graph + Twitter card with `social.png`, a 1200×630 brand card, deliberately not a screenshot so it never goes stale) and a theme colour; `muses.html` is `noindex`; new `404.html`, `robots.txt` (disallows Muses) and `sitemap.xml` (the five public pages). `tools/check-pages.py` checks all of it and `tools/publish.py` runs it before the visitor test. **Tied to the address:** `robots.txt`, `sitemap.xml`, the `og:image` URLs and `404.html` use `https://blankslateimmortal.github.io/Epitaph/`; if a custom domain is set up (5.5) they all need the new base. **Flag for the user:** the 3D site scenes (`sites/aurelia.html`, `sites/hollow-reach.html`) are not covered by the reader gate: opening one by its address shows that place whatever chapter the reader is on.

- 2026-11-23 — 5.3 done (Sonnet). The book's own phone and keyboard pass was site-encyclopedia 7.1 (done 2026-11-22); this step covers the rest of the site. The visitor test now has a **phone check** (emulated 390px: no page scrolls sideways) and a **keyboard check** (Tab from the top: the first stop is Skip to content, every stop after is visible; 12 presses). It found one real bug: **Tab walked into the closed book and the loading popup** (invisible links: "Character Dossier", "World Map", "Muses"); both are now `visibility:hidden` when closed. Also: the front door got a skip link; the shared nav tightens to one row at 520px. Both themes: the Map's Paper theme was not re-audited here; the site-encyclopedia pass covered the book's. All pass. Not covered: screen-reader testing and the Map's canvas controls by keyboard.

- 2026-11-23 — 5.2 done (Sonnet). `assets/epitaph-nav.js`: one list of places (Home · Read · Dossier · Map · Book · Powers · Muses for the author only) drawn as a bar at the top and a footer on the Dossier, Read, Powers and Muses; on the Map it fills the header's `[data-site-links]` (no extra bar over the full-screen canvas); the 3D site scenes got a static Home link next to ← Map. Current page marked `aria-current`; a Skip-to-content link. The Dossier's own Read/Map buttons are gone (its Map link, now in the shared bar, still carries the open character via `EpitaphNavMapHref`). The front door keeps its own bar and footer (it is the hero page). Also fixed: the empty Read page told readers about the vault and Claude; readers now see "Chapter one is coming soon", the author the real steps (`publish.py`). Visitor test now checks every page's links and that readers never see Muses. All pass.

- 2026-11-23 — 5.1 done (Opus). The user chose **C, chapter first** (of three mockups: terminal boot, door grid, chapter first) and **the front door at the root**: `index.html` is the front door, the Dossier moved to `dossier.html` (git mv; every link updated, including the Atlas's `epitaph-map.js` and `epitaph-links.js`). Old `index.html?char= / ?place= / ?creature= / ?book=` links forward to the Dossier. New `dossier.html?book=1` opens the book (the Book door). The hero picks the chapter from `chapters/index.json` and the reader's `epitaph-reader-last`: Start here (ch 1) · Continue (next unread) · Latest; before any chapter, "Coming soon" with Open the map. **Muses** is in the nav for the author only (0.2: not published). **Left out on purpose:** the Dossier hero's coordinates (they would name a story place readers haven't reached). **Waiting on the user:** the pitch, one paragraph in their own words, the `PITCH` line in `index.html`; empty = readers see nothing, the author sees a red reminder. The Japanese `第N章` ("chapter N") is generated from the number. Visitor test: front door added (reader mode, shows the published chapter, never the pitch reminder), the Dossier checks moved to `dossier.html`, the root-link forwarding checked; all pass.

- 2026-11-23 — 4.2 done (Sonnet). `docs/PUBLISHING.md`: the five-step flow, what `publishedThrough` does, a table of what each stop means, what only the author does. Does not mention `published.json`; the real file is `epitaph-data.js`.

- 2026-11-23 — 4.1 done (Sonnet). `python3 tools/publish.py`: syncs canon chapters, takes the newest `epitaph-data*.js` from Downloads (the Dossier's download is named `epitaph-data.js`, not `published.json` as the plan first said; or `--snapshot PATH`), requires its `publishedThrough` to equal the highest chapter in `chapters/index.json`, runs `check-snapshot.py` on it before copying, copies it to `published/`, runs the visitor test (rolls the copy back if it fails), shows the diff, then asks before commit and again before push (stages only `chapters/` and `published/`; warns if not on main). `--dry-run` changes nothing; `--skip-visitor` skips the test. Tried: dry run, wrong chapter number, junk file, a full run answering no (all stop or ask as intended). Not tried: an actual push, and a snapshot with chapters (none are published yet).

- 2026-11-23 — 3.5 done (Opus). `node tools/visitor-test/run.js`: headless Chromium on a non-local host name (`epitaph.test`, so reader mode without `?author=0`), a fresh empty profile per page, every page plus the book's `opl`/`ops`/`opse`/`opcl`, twice (the repo's own snapshot and a synthetic one built by `fixture.js` through the real `EpitaphPublish.build`). Checks reader mode, the snapshot layer, no visible write controls, real localStorage keys, errors, and that the fixture's secrets / later-chapter text / unpublished character never reach the page. **It found two real gaps, both fixed:** the Library's upgrade backup (`epitaph-library-backup-v1`) was written to a reader's real storage (now every `epitaph-*-backup*` key stays in memory, `epitaph-reader-data.js`), and the Dossier's hidden import/merge file inputs were still reachable (hidden in reader mode). A run with the reader CSS removed fails as it should. The `sites/*.html` 3D scenes read no stored data and carry no mode; they are checked for writes and storage only. The fixture also carries two encyclopedia entries: an open one the test opens in `opse` (no edit bar or pens; the site editor is gated in its own JS too, `epitaph-site-edit.js` `c.author`), and one a chapter hasn't reached, which must not be in the snapshot. Creatures are not in the snapshot at all (readers get the Creature Log's note). **4.1 should run this test before every push.**

- 2026-11-23 — 3.4 done (Sonnet). Muses: a reader sees a short "private reference notes, not published" note instead of the page (the editors and generator settings are hidden). Powers and Read have no write controls; Read only keeps the reader's own last chapter. Checked headless with `?author=0` on all three: `mode-reader`, no errors.

- 2026-11-23 — 3.3 done (Sonnet). In reader mode the book hides the Library item editor (a read-only card instead), the skill editors and "+ Root skill", the Site Encyclopedia edit bar, pens, approve and undo, and the Creature Log add/edit/delete buttons; the help text and commands drop the author-only ones (changes, export, history rollback); the automatic save helpers do not run. Checked headless with `?author=0`: the page loads as `mode-reader` with no errors. Full visitor test is 3.5.

- 2026-11-21 — **For 3.3 (the book), the author's rule: item information updates when the author WRITES the reveal, not by the chapter version being viewed.** Pass
  the reader's position (`EpitaphTimeline.readerChapter()`, none = everything published) as `asOf` (not the viewed chapter; corrected the same day) (`EpitaphItemFields.badgesHtml(item, entry, { wip: false, asOf })`, `EpitaphLibrary.rankAt(item, entry, asOf)`), leave out states whose
  `reachedIn` is later and marks whose `revealedIn` is later (`EpitaphLibrary.revealedBy(mark, asOf)`). The Dossier's inventory monitor already does.

- 2026-11-21 — **For 3.3 (the book), from the item plan (4.1–4.3):** the snapshot now carries, per item, `rank`, `tier`, `origin`,
  `originCircumstance` (only once revealed), `history` (revealed entries, each with `revealedIn`) and `stateTracks` (reached states only); marks
  carry a binding's `rank` and a curse's reached stage names (and `stage` on chapter copies). The book's read-only Library card for readers
  should show these: the rank and tier tags (`EpitaphItemFields.badgesHtml(item, null, { wip: false })`), the origin circumstance, the
  history list (`EpitaphLibrary.whenText`), the tracks (`EpitaphStates.trackHtml`) and curse ladders (`EpitaphMarks.linesHtml(marks, { definition: true })`).
  `tools/check-snapshot.py` checks all of it.

- 2026-11-21 — New plan [item-system.md](item-system.md) (rank, tier, state tracks, curse stages, origin and history fields on Library items). **Effect here:** every new item field must be added to the snapshot builder's allowlist as hidden by default and published only when a chapter's `reveals:` names the item; `tools/check-snapshot.py` must learn them too (item-system Phase 4, Opus). Until then the builder ignores unknown fields, so nothing leaks, but new fields won't appear for readers either.
- 2026-11-18 — 3.2 done (Sonnet). **A gap the survey found:** the map draws every place from `assets/epitaph-world.js`, including the story places (fictional cities and the special sites), so a reader saw them from page 1 even though the encyclopedia hid them; that broke the reveal rule for places. **Fix:** `EpitaphWorld.places()` now consults an optional `window.EpitaphWorldGate`; in a reader's browser `epitaph-reader-data.js` sets it so a story place is listed (on the map, in every lookup and link) only once its snapshot record has been reached (`placeReached`, so it follows the reader's chapter and `revealedIn`). Real cities and the author's own places are always public; the author's browser has no gate. `atlas-3d.html` now loads `epitaph-sites.js` (the gate needs it; without it every story place was hidden, which the real-page test caught and the Node test could not). **Library drawer:** readers get no Library button, `EpitaphLibraryUI.open()` does nothing unless `EpitaphMode.canEdit()`, and the `?item=` deep link no longer opens it for them (a read-only Library for readers is a possible later addition; the book's `opl` view is 3.3). **Pins:** readers can still pick up and throw swords; with the 2.3 storage layer nothing is saved, so a reload puts them back. Verified in headless Chromium with a Chapter 1 snapshot: as a reader the map lists 38 places (Aurelia the only story place, no Hollow Reach), the legend shows the real characters placed at Aurelia, the Library button is gone and the deep link leaves the drawer shut; as the author all 44 places, the button and the drawer. **For 3.5 (Opus):** the map's static Era/lore panel text and the book's static help text are public page text, outside the snapshot, and need a read for anything that gives a twist away. **Next:** 3.3 (the book), 3.4 (Muses, Powers, Read), then 3.5.
- 2026-11-18 — **Race is held until a chapter reveals it** (the author's answer to the 3.1 question; Sonnet). The snapshot omits a character's `race` until a published chapter lists it in `reveals:` as the race alone (`Twisted`), `Name: Twisted` or `Name race`; the plain default type `person` is never held, and `faction` is unchanged. Everything the Dossier builds from the race (status line, type label, "UNWRITTEN"/"DORMANT" tags, the record's Type rows) therefore stays out of a reader's page until then; with no type the thumbnails read "UNASSIGNED" and a record's Type row says "Not yet revealed" for readers ("Unset" for the author). A distinctive race word (`twisted`, `godling`, `primordial`, `unbound`) also joins the held names, so text containing it is dropped. `tools/check-snapshot.py` now also reads the author's Dossier backup (the newest `epitaph-backup/fixed-DATE.json` beside the drafts, or `--backup PATH`) and fails on a race published before it is revealed, or on the name of a character who isn't in the snapshot but appears in it. Verified in headless Chromium by a scan of the reader's page after opening every record command and tab: no race-revealing word with the race held, 93 hits in a control run with it revealed. Open: whether `faction` should work the same way (it still shows).
- 2026-11-18 — 3.1 done (Sonnet). Found by rendering the Dossier as a reader with real data and clicking through every tab and command (not by reading markup): 29 write controls. They are hidden by one commented CSS block in `index.html` (`.mode-reader …{display:none!important}`), which covers readers **and** the author's preview; anything new that edits should get class `edit-only` (already global) or a selector in that block. Hidden: New chapter / New profile / Chapters / Checks / Export / Publish / Merge / Import and the Muses link in the Data menu, New chapter / Edit profile / Delete / "+New subject", the record's Edit command and its Edit identity, Edit power, Change portrait buttons, Edit whole sheet, Edit chapter, and every "Edit …" button inside the System tabs (marks, stats, skills, inventory, ties). The Brief section (an author's writing tool) and its link are hidden too. The **Arc and Knowledge tabs** are not offered to readers (`codexTabsFor`): what they hold is not in the snapshot. No keyboard shortcut opens an editor, so hiding is enough. Verified in headless Chromium: as a reader none of the controls is visible after clicking every tab and command; the author's view is unchanged. **Worth the author's eye:** a published character's `race` and `faction` show on the Dossier (e.g. a status line such as "Cursed · Twisted (one of a kind)"); both are in the agreed safe set, but they can hint at a twist. **Next:** 3.2 (the map), 3.3 (the book), 3.4 (Muses, Powers, Read), then 3.5 (the visitor test, Opus).
- 2026-11-18 — 2.3 done (Sonnet). **How:** instead of changing every page's loader, `assets/epitaph-reader-data.js` (loaded in every page's `<head>` after `epitaph-mode.js` and `published/epitaph-data.js`) puts a thin layer over `localStorage` in a *reader's* browser only (not `isAuthor()`): the data keys (Dossier, Library, site encyclopedia, timeline, muses) answer from the snapshot, rebuilt into the shapes the modules store; writes to them live in memory for the page and are never saved; the author's private keys (save history, chapter-marker log, sword poses, migration backups) read empty and are not saved; everything else (the reader's own chapter, view preferences) passes through. The author's browser is untouched, and without a snapshot readers get the empty coming-soon data. `published/epitaph-data.js` is committed as that empty snapshot, so the live site never asks for a missing file; **publishing = replace that file with the one Publish snapshot downloads, run `tools/check-snapshot.py` on it, commit and push** (step 4.1 will wrap this). The builder now also carries the Dossier and Library schema versions and the `open` flag, and a site record's `revealedIn` is honoured (`placeRevealChapter`). Tested: Node (readers get the snapshot, the real Library, timeline and sites modules on top of it, in-memory writes, nothing reaches real storage, private keys empty, no snapshot, the author unaffected), and the real Dossier, `opse` and map as a reader in headless Chromium with a snapshot built from real data (right characters and places, no Author toggle, and the browser's real storage held only the reader's chapter after attempted writes); all five pages load without errors in both modes. **Notes:** the mode is decided when the page loads (switching needs a reload); the Muses page gets an empty list for now (3.4 hides it). Edit controls are still visible to readers: they do nothing that lasts, and 3.x hides them. **Next:** 3.1–3.4 (hide edit controls; Sonnet), then 3.5 (the visitor test; Opus).
- 2026-11-18 — 2.2 done (Opus), with **the author's reveal rule built in**. Defaults the author left to Claude: characters are introduced by a chapter's `characters:` list (or, if no chapter lists characters yet, by their first chapter version); skills, titles and stats follow the chapter version they're recorded in; places are revealed by `world:` or by a revealed moment linked to them. **What changed:** `tools/sync-chapters.py` copies a new `reveals:` property into `chapters/index.json` (added to the vault's chapter template too). `EpitaphTimeline.isRevealed` now hides everything that no chapter reveals (`revealChapter`: `open` → 0, else `revealedAt`, else the chapter it happens in, set by hand or by `moments:`); being on the latest chapter reveals nothing extra, and `secret` is now only a note for the author. New: `applyChapterIndex` also reads `world`, `characters`, `reveals`; `firstChapter(kind, keys)`, `hasCharacterLists()`, `loadChapterIndex()` (the encyclopedia loads it, so the Author view shows "Readers see it from Ch N" or "Not revealed yet"). `EpitaphSites.placeRevealChapter` / `placeReached` follow the rule; a state's start moment that the timeline doesn't have now reveals nothing. The builder introduces characters by chapter, holds items and marks until `reveals:` names them (or they're `open`), adds `introducedIn` / `revealedIn`, and scrubs text naming a held item or mark too. **`tools/check-snapshot.py`** checks a snapshot independently from `chapters/index.json` and the private drafts (forbidden fields, anything after the last published chapter, held moments' ids and titles, held places' links and names) and exits 1 on a problem. Tested: Node on the real backup and drafts (gradual reveals across three chapters, the fallback, `open`, text naming held things, the round trip), the checker accepting clean snapshots and catching six kinds of tampering, the browser index in both views. Open questions (1), (2) and (6) of 2.1 are settled by the rule; (3), (4), (5), (7) and (8) keep their private defaults. **Next:** 2.3, readers load the snapshot (Sonnet).
- 2026-11-18 — **Rule from the user (to build in 2.2, Opus):** a reader sees something only after reading the chapter that reveals it, and things are revealed only when a chapter that explains or brings them up is written. Proposal: chapters declare reveals in their properties (`moments:`, `characters:`, `world:` already exist; add `reveals:` for items and marks); everything is hidden by default; an `open` flag marks what readers know from page 1; the Author view shows "revealed in Ch N / not revealed yet". This replaces open questions (1), (2) and (6) of the 2.1 entry below, and changes `sync-chapters.py`, `chapters/index.json` and the builder's rules.
- 2026-11-18 — 2.1 done (Sonnet): `assets/epitaph-publish.js` (`EpitaphPublish.build / toScript / throughFrom / findLeaks`) and Dossier → Data → **Publish snapshot** (author-only: class `edit-only`, which `epitaph-mode.js` hides in the reader view). The dialog reads `chapters/index.json` for the number of the last published chapter (or you type it; empty = the "coming soon" snapshot), builds, shows what was included and held back, runs a **leak check** on the finished file, and downloads `epitaph-data.js` for the `published/` folder (nothing is uploaded). The builder is an allowlist, cut at the published chapter, and runs with `EpitaphTimeline.setLatestOverride(N + 1)` so that publishing every chapter you have does **not** trigger the "secrets show at the latest chapter" rule (tested). Tested in Node on the real backup and drafts (nothing published, through ch 1, through the last chapter, hidden place, unknown location, planted leak, script round trip) and in the real page (dialog, counts, leak check, button hidden for readers). **Open questions for the author (defaults are the most private choice; widen only on a yes), for 2.2 (Opus):** (1) marks: only name, kind and image are published; source, effect, cost and ends are dropped; (2) items: published when a published chapter holds them, with their description, so a plot-central item would show; (3) power: only `threat` and `name`; (4) skills: the `corrupted` flag dropped, descriptions and title blurbs kept; (5) relationships: notes dropped, only ties to published characters kept; (6) **pre-story lore moments that are not marked `secret` are published from chapter 1**: review which timeline moments should be secret; (7) a character version with no start chapter counts as not introduced; (8) text is only caught when it *names* a held-back place or character. **Next:** 2.3 (readers load the snapshot), then 2.2, the Opus audit that turns these into rules and writes `tools/check-snapshot.py`.
- 2026-11-18 — 1.2 done (Sonnet): a small vertical tag on the **left edge**, centred, drawn by `epitaph-mode.js` on every page: readers see "Reading" (not clickable); the author sees "Author" (a button; click to preview what a reader sees) or "Preview · reader" (dashed, click to go back). Nothing on the page mentions an author view to a reader. I first put it bottom-right and moved it: on the map it covered the bottom bar's hint and a button; the map's other corners and the bottom-left panels are all in use, the left edge isn't. Checked in real Chromium: every mode, the toggle, no duplicate tags, the Dossier and map screenshots. **Next:** 2.1 (Publish snapshot export), then 2.3, then 3.x.
- 2026-11-18 — 1.1 done (Sonnet): `assets/epitaph-mode.js`, loaded in the `<head>` of all five pages. `isAuthor()` (this browser is the author's: remembered `epitaph-author`, on by default for localhost, 127.0.0.1 and `file://`, off everywhere else; `?author=1` / `?author=0` sets it once and is removed from the address bar), `authorView()` / `canEdit()` (author and not previewing; the preview flag is the old `epitaph-author-mode`), `setAuthor`, `setAuthorView`, `onChange`. Classes on `<html>`: `is-author`, `mode-author`, `mode-reader`. `EpitaphTimeline.authorMode()` / `setAuthorMode()` now ask it (same names, so the encyclopedia is unchanged); a reader cannot switch themselves into author view, and the opse toggle is hidden for readers. Tested in Node (host defaults, the address parameter, preview, change events across tabs, the timeline alias) and in headless Chromium on every page (author vs `?author=0`). **Consequence once this is live:** the author must open the live site once with `?author=1` to get the Author view there; until 3.x, the edit controls are still visible to everyone (only the encyclopedia obeys the mode). **For 1.2 and 3.x:** hide edit controls with CSS on `.mode-reader` (e.g. mark them `edit-only`) and check `EpitaphMode.canEdit()` before any write.
- 2026-11-18 — 1.3 steps 1–4 done (Sonnet). The drafts (6 places, 37 moments) are in `~/Downloads/Epitaph/Site work/files/epitaph-drafts.json` (private, backup-shaped; a round trip into a fresh browser matched the code's drafts exactly before they were removed). `DEFAULTS` in `epitaph-sites.js` and `epitaph-timeline.js` are now empty, so **the public code ships no lore**; the user imports the file once per authoring browser with Data → Merge. Tests load the drafts file instead of the code. **Two things the work found:** (1) removing the defaults changed `save`: a partial `when` now merges instead of replacing (fixed); a reset or removed draft is simply gone, since there is no code default to fall back to. (2) **My own docs leaked secrets** (the schema note and changelog named plot twists as examples): scrubbed before anything was pushed; keep examples in plan docs generic from now on, because `docs/` is public. **Still open:** step 5, the local history of `shared-timeline` still contains the drafts and the earlier docs (nothing was pushed); and the **already-public** repo has plenty of lore of its own (`docs/CHANGES.md`, `sites/*.html`, the map code), which is the user's call, not part of this plan unless they want it added.
- 2026-11-18 — Phase 0 decided (Opus). The user chose: drafts move out of public files (new step 1.3), the safe character set, Muses author-only, and a coming-soon site until the first chapter is published. Design: snapshot as a script file setting `window.EPITAPH_PUBLISHED`, an allowlist of fields, cut at the latest *published* chapter. **Next: 1.3 first** (secrets out before anything is pushed), then 1.1, 1.2, 2.1, 2.3. All Sonnet; the leak audit 2.2 is Opus.
- 2026-11-18 — Plan written. Purpose from the user (read-only Dossier, map and chapters for readers; everything editable for the author;
  then a complete web page and easy chapter uploads). Found: data is in localStorage, so readers need a published snapshot; the lore drafts
  are in public JS files today. Phase 0 is not started: it needs Opus and the user's yes.
