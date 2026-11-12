# Epitaph — what changed

Two redesigns: **Atlas tracker** (newest, first) and the **chapter-state redesign** below it.

## Atlas tracker

The Atlas has one job now: show where each character is, chapter by chapter.

### New files and storage

| | |
|---|---|
| `assets/epitaph-world.js` | Built-in geography (countries, cities, the former special sites), shared by both pages. The Dossier no longer needs the Atlas to have been opened. |
| `assets/epitaph-library.js` | The **Library** store. The only code that reads or writes it. |
| `assets/epitaph-marks.js` | The mark form (blessing / curse / binding) used by the Atlas Library. |
| `assets/epitaph-checks.js` | The continuity checks, shared by both pages. |
| `epitaph-library` (browser storage) | Your countries, places and items: `{ version, countries, places, items }`. Included in Export / Import. |
| `epitaph-character-profiles-backup-v2` (browser storage) | Untouched copy of your Dossier data from before this upgrade. |

### Dossier

- **Chapters** button: one shared chapter list (`state.chapters = [{ id, number, title }]`).
- Each chapter version has a **start chapter** (its state lasts until the character's next version starts), parsed from the chapter range on upgrade ("CH 6–10" → 6). Ranges with no number are left empty and flagged.
- Each chapter version has **presence** (alive / dead / missing) and an optional **archetype reason**, shown under the archetype timeline and in the brief.
- The location picker is **Country → Place** (built-in and Library places). New locations are saved as `{ countryId, placeId }`; old `{ eraId, continentId, countryId, cityId, specialSiteId }` locations still work.
- Inventory: add items from the **Library** or with **New item…**. A chapter's entry is `{ itemId, note, boundTo, marks }`; marks start as the Library item's marks and can differ per chapter. Entries show **from <place>** and warn if the same item is held by two characters in the same chapter. Old free-text items still work and have **Add to Library**.
- **Relationship arcs** in the Ties tab (Siblings → Estranged → Enemies).
- **Checks** button with a warning count.
- Links: `index.html?char=<id>&ch=<n>` opens the version in effect at chapter n (`&snap=<id>` opens a specific version).
- If the Atlas changes data while the Dossier is open, the Dossier re-reads it (an open form is closed first) so nothing is overwritten.

### Atlas

- **Kept:** globe, terrain (always on), orbit rings, clock, World → Country → City, layers Countries / Cities / Characters, Reset, breadcrumb, character and location records.
- **Chapter slider** with ‹ › buttons; markers show each character's state at that chapter. Clusters show a count (tap to fan out). Dead = dimmed † at the death place from then on; missing = dashed marker at the last known place. **Unplaced** lists characters with no location.
- **Trail** for the selected character: numbered stops with chapter numbers, solid up to the selected chapter, dim after. The record shows archetype, chapter, presence, location path, **came from**, objective, heading toward, and Open Dossier.
- **Library** drawer: add / edit / delete your countries, places (tap a small map to drop the pin) and items (origin, pictures, marks, note, **history** of who carried it). Deleting something in use is blocked until you reassign it or confirm. Places show on the map; a place's record lists items from there.
- **Checks** drawer (same rules as the Dossier).
- Markers and trails are drawn inside the map itself, so they sit exactly on their place at every scale.
- `atlas.html?item=<id>` opens an item; `?char=<id>&ch=<n>` opens a character at a chapter.

### Removed

Continent and Special Site scales; the View grid (Physical / Political / Corruption / Characters); the Detail slider; the Terrain, Special Sites, Routes and Corruption layers; the Fullscreen button; the Era buttons (places keep their era); the special-site type filter; the character status filter (Active / Moving / Unknown / Off-map); the projections and movement-history mirror. The Atlas keeps no character data of its own.

Old browser-storage keys the Atlas used to write, now unused and left untouched: `epitaph-atlas-data`, `epitaph-world-database`. Safe to remove.

### Viewing on a phone

Your data lives in each browser. To read your story on the phone: **Export data** on the laptop, send the file to the phone, open the Dossier there and **Import data**. Import replaces everything on the phone, so treat the phone as a viewer. (Publishing the data to the public repo was skipped on purpose.)

---

# Chapter-state redesign — what changed

Five commits (phases A–E) plus this cleanup. Your data is upgraded automatically
the first time the Dossier opens. Nothing was deleted: every replaced value was
copied into a `legacy*` field (listed below) so you can decide later what to drop.

## The big idea

Almost everything about a character now lives **on each chapter** (snapshot).
A new chapter starts as a copy of the chapter you were on; you edit only what
changed, and changed sections get an amber **CHANGED** dot (new entries get a
green **NEW** tag).

| Fixed (whole character) | Per chapter |
|---|---|
| name, faction, muses, glyph | archetype, location, objective, heading toward |
| divine status, God / primordial, authority | relationships, knowledge, secrets |
| | condition, notes, marks |
| | inventory (with item marks and binding) |
| | skills, titles, stats, emotional state |
| | chapter range, blurb, backstory, portrait, generated-portrait settings |
| | locked (canon) or draft |

## What moved where

| Before | Now |
|---|---|
| Storyline (race) | **Archetype**, per chapter, picked from `assets/archetypes.js` or written by hand. Shows `UNASSIGNED` when empty. Race is gone. |
| Mythos: Blessed / Cursed | **Marks** (blessing / curse / binding) on the Marks tab. Old value became one mark named "Blessed (migrated)" or "Cursed (migrated)" on every chapter. |
| Blessed/Cursed rank names (Dormant…Divine, Beast…Titan) | Titles show a plain **Tier 1–7**. |
| Story Arc panel (objective, arc, development, turning points, completed, direction) | **Arc tab**: archetype timeline built from the chapters + one **Heading toward** line. Objective is on the **Chapter** tab. |
| Relationships, knowledge, secrets (whole character) | Per chapter (Ties and Knowledge tabs). |
| Generation section (field ledger, pending/confirm/reject, ✦ Generate, keyboard log) | **Chapter Brief**: read-only summary of the active chapter, **Copy brief** button, chapter strip, and **Lock as canon / Reopen to edit**. |
| Generation → Current Location | Chapter location (Chapter tab → Edit chapter, or Edit whole sheet). Same Era → Continent → Country → City → Special Site picker. |
| Generation → Objectives / Injuries | Chapter objective / condition. |
| Generation → other committed entries | Chapter notes, as lines starting `[from Generation: <field>]`. |
| Generation chapter "committed" | Chapter `locked: true` (canon). Locked chapters can't be edited or deleted until reopened. |
| Generated-portrait figure / style / seed (whole character) | Per chapter, so re-rolling one chapter no longer changes the others. |
| Storybook `open lib` (Generation entries) | Shows the chapter brief. |

**Gods and primordials** (any divine status, or the God / primordial box) use the
divine archetype list and keep **one archetype for every chapter**; changing it
anywhere changes it everywhere. It can't change while any of their chapters is
locked.

**Atlas** reads each chapter's `location` and `objective`. For chapters saved before
locations existed it falls back to the old Generation ledger (`legacyGenerationStates*`).

**Portrait generator**: the look now comes from divine status / primordial, the
Voided faction, and the chapter's blessing/curse marks. Angel/demon looks from the
old storyline text are gone.

## New pieces

- `assets/archetypes.js` — the archetype list (data only; the one place to rename entries).
- System sheet tabs: **Chapter** (new, first), **Marks** (new), Stats, Skills, Inventory, Ties, Arc (rebuilt), Knowledge.
- Mark shape: `{ id, kind: 'blessing'|'curse'|'binding', name, source, effect, cost, ends, image }`. `image` is an optional sigil (data URL, max 256px), set in any mark editor. Costs are text only; the site never applies them.
- Inventory items: `marks: [Mark]`, `boundTo: string`.
- **Merge data** (top bar, next to Import): adds the characters, chapters and Library entries a backup file has that this browser doesn't. Anything whose id already exists is skipped. A chapter title fills in only if yours is empty. Import data still replaces everything.
- State: `schemaVersion` (5 after this redesign; 6 after the Atlas tracker, which added chapters, start chapters, presence and archetype reasons). Upgrades run once, in order: v2 per-chapter state, v3 chapter-only lists, v4 archetype/marks, v5 brief + locks.

## Legacy fields (kept, not shown)

Drop any of these whenever you're happy nothing is missing. Fields marked
*Latest* only exist if you edited that value after the first upgrade.

### On each character

| Field | Holds |
|---|---|
| `legacyStoryline` | The old Storyline (race) text. |
| `legacyStorylineLatest` | Storyline if edited after the first upgrade. |
| `legacyMythos` | The old mythos: `''`, `'Blessed'` or `'Cursed'`. |
| `legacyMythosLatest` | Mythos if changed after the first upgrade. |
| `legacyStoryArc` | The whole old Story Arc: `currentObjective`, `currentArc`, `currentDevelopment`, `majorTurningPoints`, `completedDevelopments`, `direction`. |
| `legacyStoryArcLatest` | Story Arc if edited after the first upgrade. |
| `legacyRelationships` | Whole-character relationships before they became per chapter (they were also copied into every chapter). |
| `legacyKnowledge` | Whole-character knowledge (also copied into every chapter). |
| `legacySecrets` | Whole-character secrets (also copied into every chapter). |
| `legacyPortraitFigure`, `legacyPortraitStyle`, `legacyPortraitSeed` | Generated-portrait settings before they moved onto each chapter (also copied into every chapter). |

**Before dropping `legacyStoryline` or `legacyMythos`:** the portrait generator uses
them as part of each generated portrait's random seed, so existing generated
portraits keep their figure. Removing them changes those portraits. Uploaded
portraits are not affected.

### On the saved state

| Field | Holds |
|---|---|
| `legacyGenerationStates` | The full Generation ledger (every entry, including pending and rejected) at the first upgrade. |
| `legacyGenerationStatesLatest` | The ledger as it stood when the brief replaced it, if it changed after the first upgrade. |

### Browser storage

| Key | Holds |
|---|---|
| `epitaph-character-profiles-backup-v1` | An untouched copy of all your data from before the first upgrade. It doubles storage use; if the site ever says storage is full, Export a backup file, then this key is the first thing to remove. |
| `epitaph-character-profiles-backup-v2` | An untouched copy from before the Atlas-tracker upgrade (see above). Remove after the v1 one if space runs short. |

## Removed code

Generation ledger UI and its pending/confirm/reject logic, the ✦ Generate stub
(`window.prompt`), keyboard-only log controls, the transitional
Generation→chapter sync, the old location cascade, story-arc form helpers, rank
tracks, mythos selects, the unused mini-window summaries, and their CSS. Cache
keys bumped: `epitaph-theme.css?v=8`, `portrait-gen.js?v=8`, `archetypes.js?v=1`.

## The Book (storybook) views

Type `open` anywhere on the Dossier to open the book, then in its terminal:

- `opl` / `open library` — every Library item as tiles in a pan/zoom sandbox (left page) with a full editor for the selected item (right page): pictures, name, description, origin, marks (with images), note, who holds it. Saves on Save, on switching item, and when leaving the view. Items nobody holds can be deleted here; held items are deleted from the Atlas Library (which can reassign them). This replaces the old `opl`, which showed the chapter brief (the brief is still in the Dossier's Brief section).
- `ops` / `open skills` — one radial skill tree from every character's current chapter. Root skills branch from the centre; a skill's `parent` makes it grow from that skill. Same name under the same parent = one shared node (number inside). Select a node to edit it per holder, add a branch, or delete (branches move up to its parent). Locked (canon) chapters are read-only.
- `back` — the storybook page. `help`, `clear` as before.

Code: `assets/epitaph-book.js`, `assets/epitaph-book.css`.

## Item states

One item can have ordered states, e.g. **Seal: Locked ▸ Weakened**. It stays one item with one history.

- Library item: `states: [{ id, name, desc, marks, image }]`, edited in the book (`opl`) and the Atlas Library (add, rename, reorder, picture, marks). The item's own marks apply in every state; a state's marks are added on top.
- Inventory entry: `stateId`. Each chapter picks its state in Edit inventory. Changing it asks **Replace marks** (item marks + the new state's marks) or **Keep current marks**. A newly added item starts in its first state.
- Shown as **Seal · Locked** in the Inventory tab, a state tag in the item detail and Marks tab, and in the brief. A state's picture replaces the item's photo in that chapter.
- A state no chapter uses is shown as **not reached** on the state track (book and Atlas). The Atlas history and the book's “Held by” show the state per chapter.
- A state in use can't be removed until its chapters are moved to another state.
- Checks: `item-state` (an entry points at a removed state) and `state-back` (a later chapter goes back to an earlier state; a warning only).
- **Fold into…** (book, `opl`, on an item): makes that item a state of another item. Its description, note, marks and picture become the new state; every chapter holding it is relinked to the other item in that state; typed-in entries with the same name can be relinked too (their description moves to the chapter note unless the state already says it); if the other item had no states, its current form becomes state 01 and its holders get it; the combined item can be renamed ("Seal (locked)" → "Seal"); the folded item is removed. Shows the full plan first and needs a second click.
- Code: `assets/epitaph-states.js` (editor and track), helpers `stateOf`, `uses`, `marksFor` in `assets/epitaph-library.js`.

## Inventory tab: item monitor

The selected item shows on a bevelled CRT monitor (`itemMonitorHtml` in index.html, `.item-*` styles in epitaph-theme.css). Left: the picture on a "specimen plate" with three turning rings (the bright arc is red if the item has a curse, teal for a binding, amber otherwise) and corner labels for state, bound to, origin and marks. A picture with transparent pixels floats up and down; a solid picture sits in a smaller bevelled circle so the rings stay visible (checked once per picture in the browser, nothing to set). Right: name, state track, description, state text, note, and each mark as a row with its image on the right. Motion stops when the device asks for reduced motion. Stacks on narrow screens.

Update: the slot grid is gone. Items are picked with a **tuner** in the monitor's top line (names on a ruler under a fixed needle: click a name, swipe/scroll, or arrow keys). The left column shows the character's **chapter timeline**: each chapter's gained / lost / state changes, and a box with the selected item's state in that chapter ("not carried" otherwise). Long histories show seven chapters around the current one. On narrow screens the monitor comes first and the timeline under it.


## Full-body figures

Animated, front-view figures in the Spike style for Sils, Moinera, Universe and Antholonious (`assets/epitaph-figures2d.js`). Each is a 2D skeleton drawn as SVG, then printed as **halftone** or **pixel**. It plays an idle loop and one ability.

- Per chapter: `snap.figure2d = { char, style: 'halftone'|'pixel', seed, v }` or `null`. It carries into new chapters. Picked in Edit profile under the generated portrait ("Full-body figure"). Nothing is assigned automatically; a character named like one of the four gets a hint.
- An uploaded portrait still wins. With no upload and a figure set, the hero shows it animated (`mountHeroFigure`); click it to play the ability once. Other spots (rail, ties) show a still frame (`figureStill`).
- Abilities: Sils **Erase** (glitches out, vanishes, rebuilds from the feet up), Moinera **Shift dream** (cycles four dreams; the page's amber is re-tinted to each dream's colour while it plays, then restored), Universe **Unmake & remake** (planet explodes, debris orbits, he absorbs it and makes a new one), Antholonious **Rewrite** (the wheel of hands, Fate, spins and opens its palm eyes; pages circle him).
- Reduced motion: no autoplay; a click still plays the ability once.
