# Item System — action plan

Extends the Library's items (`assets/epitaph-library.js`, `assets/epitaph-states.js`, `assets/epitaph-marks.js`) and the Dossier's
inventory. Source: the author's "Items" page (Notion, 2026-11-21).
Sister plans: [site-encyclopedia.md](site-encyclopedia.md) (places), [creature-log.md](creature-log.md), [publish-readonly.md](publish-readonly.md)
(the reveal rule and the snapshot allowlist this plan must feed).

> **`docs/` is public.** Examples in this file stay generic. The real items live only in a private Merge file under
> `~/Downloads/Epitaph/Site work/files/` (step 5.1), never in the repo.

## Status (2026-11-21)

**All 32 steps are done:** the design, the data (Library v3, Dossier schema 9), the editors and checks, the views, the reader snapshot and its checker, Merge's update option,
the author's items converted, cross-links, the phone check, the docs, and Phase 6 (the mark library, prospective skills with assign and a fit helper, and the chapters
check). Two things wait for other plans: the "items made here" list (site-encyclopedia entry view) and the Creature Log link. The lore clashes found along the way are
in the vault note `Exploratory Ideas/Lore/Continuity Issues - Items 2026-11-21.md` (kept out of this public file on purpose).

## Purpose (from the user, 2026-11-21)

Items get more than a description. Each has a **rank** (how far its effect reaches), a **tier** (who could make it), up to three
kinds of **state** (item state, usage state, connection state), and **bindings / blessings / curses** with their own rules.
Not every item has every part: a blade may have no usage states; many items have only item states.

## What the author defined (the rules this plan builds)

- **Item states** say what condition the item is in and how it can develop (Sealed → Broken, New → Worn). Most items have them.
- **Usage states** say what part of a process the item is in (Dormant → Active; or a longer chain such as Dormant → Seeding → Budding →
  Propagating). Only some items have them.
- **Connection state** (a third track) says whether the item is linked to its source (Connected → No Signal). Only some items.
- **Rank** (reach, 7 steps): 1 Soul · 2 Host · 3 Ward · 4 City · 5 Dominion · 6 A Face · 7 Planet. **Rank can change over time:** it
  comes from what the item can currently do. Each binding can carry a rank; the item's rank is the **highest** of its base rank and its
  active bindings' ranks. When a state removes a binding that gave the reach, the rank drops back (written "Planet ⇒ Soul").
- **Tier** (who could make it): Mundane (ranks 1–3) · Transcendent (4–6) · Divine (7). Tier is **not** derived from rank: a god can make
  a Divine item that only reaches one soul. The rank sets the **lowest** allowed tier; higher tiers are always allowed.
- **Binding** (items only): name, source, effect, rank. No cost, no end.
- **Blessing** (people only): name, source, effect, price, terms, breach, lasts until (0.3). Both parties must consent
  (a rule, not a field). Stable. Val's gift to the Voided is a blessing.
- **Curse** (people and items): name, source, **type** (Mutation · Enhancement · Distortion · Fragmentation), effect, stages.
  **No cost and no end** (user, 2026-11-21): a curse can't be removed, and it *is* the cost of something else.
  **Three stages with fixed broad names: Awakening · Fluctuation · Stabilization.** Each curse may give each stage its own unique name
  and text; an optional "initial state" can come before Stage I. What looks like a curse's "end" (a mark appearing in the palms after
  overuse) is really a stage. Stabilization is not recovery.
- Sources may be unknown (`???`). Items and fields may be unfinished (W.I.P).

## Rules this plan follows

- **Always 7:** rank has 7 steps; a state track holds at most 7 states. Curse stages are 3 and tiers are 3 because the author defined them
  so (they are classifications, not scales). Lock what a rule disallows instead of greying it out (memory `epitaph-always-seven`).
- **No spoilers:** every new field is hidden from readers until a chapter reveals the item (`reveals:`), the same rule as the rest of
  the site (memory `epitaph-reveal-rule`). Origin circumstance, history and curse stage text are the riskiest fields.
- **Convert what exists:** existing items, marks, inventory entries and states are **converted to the new layout**, not kept in hidden
  legacy fields (user, 2026-11-21). What can be converted automatically is converted on load; what needs judgment (a blessing on an item,
  cost/ends text on a binding or curse) is resolved by Claude in a **converted data file the user uploads** (step 5.1). Backup key bumped
  as with earlier schema changes, so the old data can always be restored.
- **One source:** items live in the Library only; nothing is duplicated into the Dossier (inventory entries point at item ids).
- **The site's patterns:** classic scripts, `window.EpitaphX`, `epitaph-…` keys, versioned `?v=` tags, `docs/CHANGES.md`,
  `edit-only` class for anything that writes (so readers never see it).
- **Settled (user, 2026-11-21):** items use the 7 ranks above, without "Realm"; the Dossier's Threat list keeps Realm at 5 and Dominion at 5½.
- **Curses are not applied by gods or Storyborn** (user, 2026-11-21): they are plain costs that follow from something. Some of the author's own
  curse entries list a god or character as source; 5.1 decides per curse whether that is really its cause.

## Status key

`[ ]` not started · `[~]` in progress · `[x]` done · `[-]` dropped (say why in the tweak log)

---

## Phase 0 — Agree the shape (Opus)

- [x] **0.1 Field list.** *(Agreed 2026-11-21.)* Kept: `name`, `desc`, `icon`, `image`, `note` (private author note, never published),
  `marks`. New: `rank` (1–7, the item's base rank; a state may override it, 0.2), `tier` (mundane / transcendent / divine; the rank's
  floor locks lower tiers; tier never changes with state), `origin` (replaces `originPlaceId`: a place id, `'none'` or `'unknown'`),
  `originCircumstance` (text), `stateTracks` (0.2), `history` (dated entries, below), `wip` (badge).
  `history: [{ id, when: timeline when (era/year or chapter), holder: charId | name, stateIds: { trackId: stateId }, text }]` covers the
  time before Chapter 1 and anything off-page; from Chapter 1 the Dossier's inventory still drives holder and state. Each entry follows the
  reveal rule by its `when`. Held-by gets no field (derived). Dropped: `rankTo` (rank changes by state instead) and a separate
  "additional properties" list (they go in `desc`; revisit only if lines need revealing one by one).
- [x] **0.2 State-track design.** *(Agreed 2026-11-21.)* Up to three tracks per item, each optional: **Item**, **Usage**, and a
  **third track the author names per item** (default "Connection"; e.g. "Hunger": Sated / Famished). Shape:
  `stateTracks: [{ id, kind: 'item'|'usage'|'custom', name, oneWay, primaryStateId, states: [State] }]`, at most 7 states per track.
  `State = { id, name, desc, image, color, marks }`; `color` from the page's 7: gray, green, yellow, orange, red, purple, blue.
  A state's marks are added on top of the item's marks (existing behaviour): a binding that is lost in a state lives on the states
  that have it, not on the item. **Rank:** a mark may carry `rank`; the item's current rank = the highest of its base `rank` and its
  active marks' ranks (states never set rank directly). **One-way** is per track per item (default on for Item, off for the others;
  a check warns when a later chapter or history entry shows an earlier state; a repurposed broken item is a new item).
  **Primary state** = the item's normal state (a phone is normally on, not dead), shown when nothing else is recorded.
  Inventory entry: `stateIds: { trackId: stateId }`. **Migration:** old `states[]` → an Item track with `oneWay: false` (no false
  warnings on existing data), old `stateId` → `stateIds[thatTrack]`.
- [x] **0.3 Mark kinds.** Agreed 2026-11-21: kinds locked by where the mark goes (item: binding or curse; character: blessing or
  curse); only bindings carry `rank`; no consent field; curse = name, source, type, effect, `initial?`, `stages: [{ name?, text }]` ×3,
  no cost or ends; current curse stage tracked per holder per chapter (inventory entry / character mark), shown "Stage 2/3 · Fluctuation"
  plus the unique name; a curse that stays on a person after the item is gone is added to the character by the author.
  **Blessing fields (agreed):** all optional: **Price** (what holding it always takes), **Terms** (the condition to keep),
  **Breach** (what happens if the terms are broken; shown only when there are terms), **Lasts until** (how it stops normally; never a
  punishment; working name for "Ends", may be renamed). Conversion: old blessing `cost` → Price or Terms, old `ends` → Lasts until or
  Breach, decided per blessing in the converted file (5.1).
- [x] **0.4 Reveal granularity.** *(Agreed 2026-11-21.)* A chapter's `reveals:` naming the item reveals it whole: name, look, desc,
  tier, and the **current rank at the reader's chapter**. **States and curse stages not yet reached don't exist for readers** (no "?"; a
  reader can't learn an item can break). Revealed separately: **origin circumstance** (`reveals: <Item>: origin`), **each binding or curse**
  (`reveals: <Item>: <mark name>`), **each history entry** (when its timeline moment is revealed; pre-story entries stay hidden until a
  chapter brings them up). `note` and W.I.P items never reach readers.

## Phase 1 — Data (Library)

- [x] **1.1 State tracks + migration.** *(Done 2026-11-21, Sonnet.)* Library version 2 in `assets/epitaph-library.js`: `stateTracks` per
  0.2 (id = kind, ≤7 states, colour, `oneWay`, `primaryStateId`), inventory `stateIds`, new helpers `trackOf`, `itemTrack`,
  `currentStates`, `normalizeStateIds`; `stateOf`, `uses`, `marksFor` read every track. v1 converts on load (Item track, not one-way),
  raw copy kept once at `epitaph-library-backup-v1`. **Temporary compatibility, removed in 2.1/2.2:** the non-stored `item.states`
  alias, an enumerable `states` write replacing the Item track, and the inventory `stateId` mirror (normalizer in `index.html`).
  `EpitaphStates` is unchanged (it still edits one list = the Item track). Tested in Node (8 tests) and in the real Dossier headless.
- [x] **1.2 Rank and tier.** *(Done 2026-11-21, Sonnet.)* Items get `rank` (1–7, 0 = unset) and `tier`; bindings get `rank` (only
  bindings keep it; the rest of 1.4 is still to do). Pure helpers in `epitaph-library.js`: `RANKS` (Soul, Host, Ward, City, Dominion, Face,
  Planet), `TIERS`, `rankName`, `tierFloor` (ranks 1–3 mundane, 4–6 transcendent, 7 divine), `allowedTiers`, `maxRank` (highest the item
  can ever reach, in any state), `rankAt(item, entry)` (highest of base rank and the ACTIVE bindings; a track an entry doesn't pick counts as
  its primary state), `tierProblem` (the tier floor follows `maxRank`, so an item that is only Planet-rank through one state still needs
  Divine). Tier is never changed silently: a bad tier is kept and reported (2.1 locks it in the editor, 2.4 flags it). 12 Node tests in all.
- [x] **1.3 Item fields.** *(Done 2026-11-21, Sonnet.)* `origin` (a place id, `'none'`, `'unknown'` or `''` = not filled in; replaces
  `originPlaceId`), `originCircumstance`, `history` (entries `{ id, when: { era BEFORE|ERA_0|ERA_1, year?, chapter? }, holder, stateIds,
  text }`), `wip`. Same temporary-alias approach as 1.1: a non-stored `item.originPlaceId` still answers for the ~15 old readers, and a
  legacy editor's write is understood (a blank can't erase `none` or `unknown`; clearing a place works). Removed with the editors in 2.1.
  History sorting and the reveal by `when` come with the views (3.x) and Phase 4. 14 Node tests in all.
- [x] **1.4 Marks by kind.** *(Done 2026-11-21, Sonnet; additive.)* `EpitaphLibrary.normalizeMark` is now the one mark shape and the
  Dossier's `normalizeMark` and `EpitaphMarks.normalize` delegate to it, so no editor strips a new field. By kind: binding `rank`;
  blessing `price`, `terms`, `breach` (cleared when there are no terms), `lastsUntil`; curse `type` (mutation, enhancement, distortion,
  fragmentation), `initial {name,text}`, `stages` ×3 `{name,text}` (Awakening, Fluctuation, Stabilization), `stage` (0 = initial, 1–3, per
  holder). Helpers `markKindsFor('item'|'character')`, `markDetailLines(mark)` (used by the read-only displays: Dossier mark lines, the
  shared `EpitaphMarks.linesHtml`, the brief text). **Not done on purpose:** the old `cost` / `ends` text is kept on every mark, not
  folded or dropped, because three editors still write it; the 2.3 editors and the converted data file (5.1) move it into the new fields
  and remove it. Publish copies only id/kind/name/image, so none of this reaches readers (Phase 4). 18 Node tests in all.
- [x] **1.5 Export, import, Merge.** *(Done 2026-11-21, Sonnet; verified, no code change.)* All three already go through the Library's
  normalizer: Export writes `Lib.get()` (version 2; the temporary aliases are not exported), Import calls `Lib.replace()`, Merge pushes
  only unseen ids through `Lib.update()`. Tested with the same calls the page makes (3 tests): a full item (tracks, rank, tier, origin,
  history, W.I.P, curse stages, blessing terms) survives export then import byte for byte; an old v1 backup converts and loses nothing
  (old `cost`/`ends` kept); Merge adds v1- and v2-shaped items, never overwrites an existing id, and a repeat adds nothing. Dossier
  snapshots already carry `stateIds` and the new mark fields (1.1, 1.4). **Consequence:** Merge never updates an item that
  already exists, so the user chose (2026-11-21) a new **"update items" option on Merge** (step 5.0) over using Import.
- [x] **1.6 Offline fields.** *(Done 2026-11-21, Sonnet.)* `weight`, `appearance`, `maker` (a name or character id) are normalized, stored,
  exported and imported like any field, so nothing is lost. `EpitaphLibrary.OFFLINE_FIELDS` (all `true` = offline) and `fieldOn(name)` are
  what the editors (2.1) and views (3.x) must check before showing them. Switching one on = set it to `false` and add a line to
  `docs/CHANGES.md`. **Phase 1 is complete.**

## Phase 2 — Editors and checks

- [x] **2.1 Item editor.** *(Done 2026-11-21, Sonnet.)* One shared module, `assets/epitaph-item-fields.js`, builds the new fields for **both**
  item editors (the book's `opl` panel and the Atlas Library drawer): origin (not filled in / none / unknown / a place), origin
  circumstance, rank (1–7) and tier (tiers the highest reachable rank forbids are **locked**, a saved tier below the floor is flagged), W.I.P,
  weight / appearance / maker only when `fieldOn(name)`, and dated **history entries** (era, year, chapter, holder, the state in each
  track, text; saved in timeline order). `EpitaphStates` gained colours, a 7-state limit and `tracksEditor` (Item, Usage and a third track
  named per item, one-way, normal state, add / remove a track; a track whose states are used by chapters can't be removed). The book's
  "Fold into…" now writes the Item track. Both detail views show rank, tier and W.I.P badges. **Removed:** the `item.originPlaceId` alias,
  and the "legacy editor write" paths (old `states[]` / `originPlaceId` convert only when the new field is absent, i.e. v1 data).
  **Kept until 2.2, on purpose:** the read-only `item.states` alias (= the Item track), because the Dossier's inventory editor, the
  chapter checks and the publish builder still read it. Tested in the real page (headless Chromium): the book panel and the drawer, with a
  v1 item, rank locks, a new usage and third track, a history entry, save, and the stored shape; 22 Node tests for the Library.
- [x] **2.2 Inventory editor.** *(Done 2026-11-21, Sonnet.)* A chapter's copy of an item now picks one state **per track** (one select per
  track the item has, labelled with the track's name, "not set (normal: X)" for none), in both the classic inventory form and the wide
  editor; a new copy starts every track in its normal state; changing a state still offers "Replace marks / Keep current marks", now with the
  marks of all current states. Entries are stored with `stateIds` only: **the `stateId` mirror and the read-only `item.states` alias are
  gone** (old saved `stateId`s convert once when the Dossier loads). The monitor shows one strip per track; the item's current state text
  and the "changes since last chapter" list read all tracks. New Library helpers `stateIdOf`, `itemStates`, `primaryStateIds`,
  `stateKeyOf`. The book's Holder web, Relic vault, item log and Fold, book-tools' "item" command, the checks and the publish builder were
  moved too. **The checks' state rules were rewritten by track** (a removed state on any track; going back only on a track marked
  one-way), which was part of 2.4. Publish still writes the Item track only, in the old snapshot format (4.1 redesigns it). Tested: 23 Node
  tests and the real inventory editor in headless Chromium (old `stateId` converted, one select per track, switching Connection to No
  Signal and replacing marks left only the Parade binding, saved with no `stateId`, rank read Soul instead of Planet).
- [x] **2.3 Mark editor.** *(Done 2026-11-21, Sonnet.)* One implementation of the mark fields, `EpitaphMarks.fieldsHtml` + `setField`
  (`assets/epitaph-marks.js`), now used by all three hosts: the shared editor (item and state marks in the book and the Atlas drawer), the
  Dossier's classic mark rows (a person's marks and a chapter's copy of an item), and the wide marks editor. The kind is locked by where
  the mark lives (`markKindsFor`: an item or a chapter copy of one takes binding or curse, a person blessing or curse); a mark already of
  another kind stays visible, flagged "not allowed here" (2.4 flags it too). Fields by kind: binding **Reach** (rank 1–7); blessing **Price,
  Terms, Breach, Lasts until**; curse **Type**, **Stage now** (chapter copies only) and a collapsible **Stages** block with an
  optional own name and text for Initial state, Awakening, Fluctuation and Stabilization. Changing a mark's kind redraws its row.
  **`cost` / `ends` are gone from the mark shape.** Existing text is folded in, nothing lost: a blessing's cost becomes its price and its ends
  "lasts until"; on a binding or curse they are added to the effect as "Cost: …" / "Ends: …" (5.1 refines each by hand). Library version 3
  (raw v2 copy kept once as `epitaph-library-backup-v2`) and **Dossier schema 9** (raw copy kept once as
  `epitaph-character-profiles-backup-v9`). Tested: 25 Node tests, and in the real page the three editors plus the upgrade of a v8 Dossier
  with old marks (folded correctly, backup written, saved shapes right).
- [x] **2.4 Checks (Opus).** *(Done 2026-11-21, Opus; the chapter part of the state rules was done in 2.2.)* New rules in
  `assets/epitaph-checks.js` (`itemSystemChecks`): **item-tier** (warn: tier below what the highest reachable rank needs), **mark-kind**
  (info, once per mark: a blessing on an item, its states or a chapter copy of it; a binding on a person), **history-back** (warn: a one-way
  track goes back inside an item's history) and **item-state** for history entries in a removed state, **curse-stage-back** (warn: a curse's
  stage goes down in a later chapter, on a person or on a carried item; "a curse doesn't recover"), **curse-gone** (warn, new, from the
  lore that curses can't be removed: a person's own curse disappears in a later chapter; a carried item's curse may leave with the item, so
  it isn't checked), **curse-stages** (info, once per curse: fewer than three stage texts). **Dropped:** "unknown source on a published
  item": the author writes `???` on purpose, so it would only be noise. Blessing consent stays a written rule (3.4). Found and fixed on
  the way: history entries were not really sorted by date (EpitaphTimeline.compare orders timeline events and ignores years); new
  `EpitaphLibrary.compareWhen` (era, then year, then chapter-only, then undated) is used by the editor and the checks. Tested: 7 Node
  tests of the checks, 25 of the Library, and the checks and the history order in the real Dossier page. **Phase 2 is complete.**

## Phase 3 — Views

- [x] **3.1 Inventory tab.** *(Done 2026-11-21, Sonnet.)* The item monitor shows **rank now** (the active bindings, so Observance reads
  "RANK 7 · PLANET" while Connected and "RANK 1 · SOUL" at No Signal), a dashed "CAN REACH 7 · PLANET" when another state reaches higher, the
  **tier**, and **W.I.P** (author only: hidden when the page is a reader's). The strips per track came in 2.2. Changing item now plays a short
  quiet animation (the screen brightens once, the plate settles in, the text slides in after it); it is skipped for "reduce motion". The item
  panel itself was not redesigned (user, 2026-11-11). Reader rank and tier wait for Phase 4 (the snapshot doesn't carry them yet, so readers
  see no badges). Tested in the real Dossier: both states of Observance, a plain item, the animation function.
- [x] **3.2 Book `opl`.** *(Done 2026-11-21, Sonnet.)* **Relic vault** tiles and **Holder web** nodes show the item's states in every track
  ("New · Connected") and its **rank in that chapter** ("R1 Soul"; a hover says what it means). The NEW / MOVED / STATE tags already followed
  a change in any track (2.2). The **item log** now includes the item's own **history** entries, merged with the chapter events in timeline
  order (before the story first; an entry tied to a chapter the ruler hasn't reached is left out). Reader mode is unchanged: the book's
  Library card for readers is built from the snapshot, which has no history. Tested in the real book: web, log, vault.
- [x] **3.3 Curse stages.** *(Done 2026-11-21, Sonnet.)* `EpitaphMarks.ladderHtml`: a four-step ladder (Initial state · Awakening · Fluctuation ·
  Stabilization) with the author's own stage names under the steps, earlier steps marked done, the current one highlighted and its text
  shown below. Used wherever marks are shown: a person's marks (Marks tab), a chapter's copy of an item and the inventory monitor (the
  stage that holder is at **in the chapter you're on**, since marks live in chapter versions), and the Library drawer's item detail (the
  curse as defined: no step marked). It shows for a curse that has stage text, or whose holder has moved past the initial state; the old
  "Stage 2/3 · …" line is not repeated next to it. The book's item log reports a curse moving ("Taint: stage 1 → stage 2 · Splitting · Orin").
  Tooltip: a curse does not recover. Tested in the real Dossier (Marks tab, monitor, drawer, log) and in Node.
- [x] **3.4 Powers page.** *(Done 2026-11-21, Sonnet; wording approved by the user.)* New **Items** section on `powers.html` (after The Voided, with a
  table-of-contents link): rank and tier (7 ranks, **no Realm**; Mundane 1–3, Transcendent 4–6, Divine 7), states, bindings, blessings (given to
  people only, with consent; Price, Terms, Breach, Lasts until) and curses (**not applied by gods or Storyborn: plain costs that follow from
  something**; no consent, cannot be removed, no cost or end of their own; four types; Awakening, Fluctuation, Stabilization after an initial
  state; each curse names its own stages). Examples were kept generic on purpose (the page is public); the Repentance story the user told is in the vault note
  `Exploratory Ideas/Power Systems/Item Curses.md`. A curse's **source** field is now labelled **Cause** in the mark editor.
## Phase 4 — Publish and reveal (Opus)

- [x] **4.1 Allowlist.** *(Done 2026-11-21, Opus.)* `assets/epitaph-publish.js`, snapshot schema 2. Items are published only when a published chapter
  holds and `reveals:` them, **never when W.I.P** (their names are held, so text naming them is scrubbed). Per item: name, desc, pictures,
  **rank, tier, origin** (a hidden place becomes "unknown"); **origin circumstance** only from the chapter that reveals `<Item>: origin`;
  **history**: an entry tied to a published chapter from that chapter, entries before the story once a chapter reveals `<Item>: history`,
  each with `revealedIn`; **stateTracks** with only the states a published chapter reached, each track's normal state, and states a
  revealed history entry names. Marks stay minimal (name, kind, picture) plus a binding's **reach** and a curse's **stage** (chapter copies)
  and the **names** of the stages reached so far (definitions: up to the furthest stage any published chapter reached). Never: note, weight,
  appearance, maker, wip, a blessing's price / terms / breach / lasts until, a curse's type or stage texts. A mark is revealed by its name or
  by `<Item>: <mark>`. Inventory entries carry `stateIds` (published states only). So a reader's rank follows only revealed bindings: a
  hidden binding hides its reach too. 7 Node tests (chapters 1, 2, 3).
- [x] **4.2 Checker.** *(Done 2026-11-21, Opus.)* `tools/check-snapshot.py` section 3b, independent of the builder (reads `chapters/index.json`
  itself): fails on item private fields, a curse type or stage text, an origin circumstance or history entry no published chapter reveals,
  a state id that isn't published (entries and history), a curse naming a stage it hasn't reached, and (with the Dossier backup) a W.I.P
  item's id or name anywhere. Tested: a clean chapter-2 snapshot passes; a tampered one fails on all 7 planted leaks; an origin circumstance
  published at chapter 1 fails.
- [x] **4.3 Reader views.** *(Done 2026-11-21, Opus; the book's reader card is the publish plan's.)* Verified in the real Dossier as a reader
  (`?author=0`) with the built chapter-2 snapshot: the inventory monitor shows rank 1 (God's Eye not revealed yet), tier, no W.I.P, only the
  reached states, the curse ladder at Fluctuation with only the reached stage names and no texts; nothing private in the page; nothing saved
  to the reader's storage but the mode. The Atlas Library drawer stays author-only (publish plan 3.2). The book's read-only Library card
  for readers is being built in publish-readonly **3.3** (another session's uncommitted work in `epitaph-book.js`); what it should show
  from items is written into that plan's tweak log instead of being built here.

## Phase 5 — Data and finish

- [x] **5.0 Merge: "update items".** *(Done 2026-11-21, Sonnet.)* The Merge dialog shows **"Also update items that already exist (N differ)"**,
  off by default. Ticking it lists each existing item the file would change, with a tick box (all ticked) and plain words for what differs
  (description, states, marks, history, note…; `EpitaphLibrary.itemChanges`). Only ticked items are replaced, as a whole, by the file's version
  (so a note the file doesn't have is gone: the list says "note" when it differs). Before anything is replaced the current Library is copied to
  `epitaph-library-backup-before-merge`; if that copy can't be kept (storage full) nothing is replaced. Characters, chapters, sites, the timeline,
  places and countries keep the old never-overwrite rule. The dialog also opens when the file only has changed items ("has nothing new to add").
  Tested in the real page by feeding a file: off = the Seal untouched and a new item added, no backup; ticked = the Seal replaced, backup holds the old one.
- [x] **5.1 Converted data file (Opus).** *(Done 2026-11-21, Opus.)* `~/Downloads/Epitaph/Site work/files/epitaph-items-converted-2026-11-21.json`
  (+ `…-notes.md` with every judgment call and the manual follow-ups), built from the 2026-11-18 export and the Notion Items page; never in the
  repo. Adds Book of the Void, Character Dossier, Mother's Necklace; updates Seal, Dot-Glass Lens, Observance, Repentance, Skull of Oblivion,
  Star of Ruin (pictures carried over; replaced descriptions kept in each item's note); leaves Conquest, Margin Book and Mother's Ration Card
  untouched (the last two flagged as probably replaced). Loaded with Merge → "Also update items that already exist". Character marks can't be
  changed by Merge: the notes list the few to tidy by hand (Yona's lens copy, Orin's Taint, Yona's Halftone). God-sourced curses kept as written,
  per the user. Verified: the real normalizer and checks (no warnings), and the real Merge flow with the 2026-11-18 data seeded.
- [x] **5.2 Cross-links.** *(Done 2026-11-21, Sonnet; the parts that depend on unbuilt pages are waiting, see below.)* An item's origin place is now a standard
  `place:<id>` link (`EpitaphLinks`): the origin tag on the book's item panel and the FROM call-out on the inventory monitor. Today it opens the
  map; once the Site Encyclopedia's entry view registers its handler (site-encyclopedia 2.2) the same links open the entry, with no change here.
  `EpitaphLibrary.itemsFromPlace(placeId, only?)` lists the items made at a place, ready for the entry's **Resources** tab (the caller passes what a
  reader may see). **Waiting on other plans:** the Resources list itself (site-encyclopedia 2.x, Opus) and the **Creature Log** link for items that are
  organisms (`creature:<id>`, creature-log plan; the links module already accepts the format). The book's reader card for items (publish 3.3, the
  other session) should render the origin the same way. Tested: Node (helper) and the real Dossier (both links call the registered handler; an item
  with no origin gets no link).
- [x] **5.3 Mobile and both themes.** *(Done 2026-11-21, Sonnet.)* Checked at 390px in the real pages (an iframe of that width): the inventory monitor
  (badges, tracks, curse ladder), the Marks tab, the wide marks editor, the book's item panel (details, tracks, history, marks with stages), the Library
  drawer's item form, and the Powers page's Items section. **No sideways overflow anywhere**; the Powers table scrolls inside its own box like the
  others. Fixed: the small checkboxes (W.I.P, one-way, ≈, the Merge options) now sit in 40px tap rows with 20px boxes. **Themes:** the Dossier and book
  have one theme (Signal). The only other, **Paper**, belongs to the Atlas map page; the Library drawer is a dark panel there too (it has no Paper
  styling of its own), and the new fields use the same palette variables, so they match in both. The Atlas page needs WebGL and a CDN, so it was
  not opened headless; the drawer's markup was tested inside the Dossier page instead.
- [x] **5.4 Docs.** *(Done 2026-11-21, Sonnet.)* `docs/CHANGES.md`: the item section was rewritten as one topic-by-topic summary (what an item has, where you see
  and edit it, what readers see, your data, what is not built) instead of step-by-step notes, dropping stale "temporary" lines. The terminal `help` needs no new
  command (Phase 6 adds `opsp`). This plan's status is below. `HANDOFF.md` is an old document from the first two pages and was left alone.

## Phase 6 — Free creation: prospective skills and a shared mark library

Asked by the user 2026-11-21: create skills and marks freely, the way items already feel ("I can create them and then assign them").
Design agreed in the same conversation (Opus):

- **Prospective skills** (`epitaph-library` gains `skillDrafts: [Skill]`, same shape as a skill in `snap.skills`). Not real until
  assigned. **Assigning moves the skill** onto one character's chapter version (lore: skills are never shared), so the draft leaves
  the shelf. Author-only: never published, never revealed, skipped by checks except for empty names.
- **Shared mark library** (`epitaph-library` gains `marks: [Mark]`). One definition, many holders (one blessing given to a whole
  people; a curse that hits many). Characters and items hold `{ markId, stage?, note? }` references; the definition lives once.
  The mark editor offers **pick from the library** or **create new** (create new can be saved to the library). Per-holder curse stage
  stays on the holder. Existing inline marks keep working; duplicates are folded into library entries in the converted file (5.1), each
  fold listed for the user.
- Reveal: a library mark is revealed by name as before (`reveals: <mark name>` or `<Item>: <mark>`).

- [x] **6.1 Storage.** *(Done 2026-11-21, Sonnet; with a design change, see below.)* The Library gains `marks` (the shared mark library: definitions) and `skillDrafts`
  (prospective skills: `id, name, desc, level, corrupted, parent, glyph, note`, the fields of a skill in a chapter version plus a private note). Both are normalized,
  stored, exported, imported and added by Merge (new ids only, never overwritten); older libraries simply have none. **Linked copies instead of references:**
  a holder (a person, a chapter's copy of an item, an item, a state) keeps an ordinary mark plus `libId`, the definition it came from, so **every existing reader
  (Dossier, inventory, book, brief, checks, publish) works unchanged** and nothing has to be "resolved everywhere". Helpers: `libraryMark`, `copyFromLibrary`
  (own id and own stage, linked), `toDefinition` (a mark saved to the library), `applyDefinition` (a copy brought up to date, keeping its id, link and stage),
  `markHolders` (every copy, with who, chapter and stage), `skillDraftById`. `libId` survives the Library, the Dossier's normalizer and the mark editor; the
  publish builder does not carry the library marks, the drafts or `libId` (tested). 32 Node tests of the Library and 10 of the snapshot builder, plus the real
  marks editor keeping a link and its stage through an edit and a save.
- [x] **6.2 Prospective skills view.** *(Done 2026-11-21, Sonnet.)* `assets/epitaph-prospects.js`: the terminal command **`opsp`** (also `open skill prospects`, and a
  "Skill prospects" link beside the book's other links, author only) opens a **board in the wide modal**: a filterable list of cards (search name / text / note,
  level, corrupted) and an editor (name, what it does, level 0–7, grows from another prospect, glyph, corrupted, a private note), with Save, Duplicate and a
  confirmed Delete. Switching cards saves; renaming a prospect renames it as a parent too. Readers get a polite refusal and no link; prospects are never
  published. **Two deviations from the plan text:** it is a modal board rather than a view inside the book (the book file is the other session's and the
  book's shell isn't reachable from outside it), and the "filter by type" became filters by level and corrupted, since a skill has no type of its own (the
  fit-by-type comparison belongs to 6.4). The module wraps the command runner like `epitaph-book-tools.js` does, and adds an `opsp` line to `help`.
  Tested in the real page: command, help line, link, create / edit / save, parent rename, the three filters, auto-save on switch, duplicate, delete with
  confirm, and the reader refusal.
- [x] **6.3 Assign.** *(Done 2026-11-21, Sonnet.)* On the prospects board an **Assign to a character** section: pick a character and one of their chapter versions and a live
  verdict says whether it fits, in plain words, using the site's own rules: the **type lock** ("A godling can't hold skills"), the **true-name caps** (one core,
  branches and depth by tier), a **locked chapter**, **name clashes**, and the **skills it grows from**: if the version doesn't have the parent, a ticked box moves the
  parent chain from the board with it (children come after parents), otherwise it is refused; a parent that is neither a skill of that version nor a prospect is
  refused. Assigning **moves** the skill(s) onto that version (same fields as any skill: name, text, level, corrupted, parent, glyph), saves the Dossier and removes
  them from the board; the private note stays behind. Also fixed a wrong label from 6.2: the site does not restrict corrupted skills to Twisted characters, so the
  checkbox now says "marked as twisted in the skill tree". Tested in the real page: a child with its missing parent (moved together, refused unticked), the
  true-name cap, the godling lock, a locked chapter, a name clash, an unknown parent, a plain fit, and the Dossier afterwards.
- [x] **6.4 Fit helper.** *(Done 2026-11-21, Opus.)* "Who could take it" on the prospects board, for the selected prospect, one row per character at their
  **latest chapter version that isn't locked**. What counts as a fit, in three layers and **no scores** (the author dislikes arbitrary numbers): **(1) the rules**,
  exactly as Assign checks them (type lock, true-name caps, name clashes, the parent chain, moved along if it is on the board); **(2) room**: core free or taken,
  branches and depth used against the true-name tier, or why the type is uncapped (a Twisted's corrupted gift tree, a god's authorities, no type set) or can't
  hold skills; **(3) hints**, shown as words: your note names them, the prospect shares words with their concept, a corrupted prospect for a Twisted character.
  Sorted: can take it first, then more hints, then name. **Use** fills the Assign section with that character and version. Not used as signals, on purpose:
  skill level against stats or Threat (no site rule ties them), and archetypes. Also: the site's "give every other skill a parent (the fifth column)" message
  is reworded on the board to "set “Grows from” to one of their skills". Tested in the real page (a Twisted with all three hints first, an untyped character,
  a godling, a capped person with the core taken, a fully locked character; Use → a valid Assign).
- [x] **6.5 Mark library UI.** *(Done 2026-11-21, Sonnet.)* **Pick-or-create in every mark editor** (the shared editor for item and state marks, the Dossier's mark rows
  for a person's marks and a chapter's copy of an item, and the wide marks editor): an **"Add from the library…"** picker with **Add a copy** at the end of the list
  (offering only kinds that holder can take), and under each mark either **Save to the library** or its link status: **in sync**, or **differs from the library** with
  **Update from the library**, and **Unlink**. New terminal command **`opmk`** (also `open mark library`, and a "Mark library" link, author only) opens the **mark
  library board**: a list (search, kind; copies and how many differ), an editor with the same fields as every mark editor, and **every copy** of the selected mark:
  who holds it, the chapter, the curse's own stage ("stage 2/3 · Budding"), in sync or differs. **Update all copies** brings the drifted ones back in line (each
  copy keeps its own id and stage); **Delete** removes the definition and leaves the copies as ordinary marks. Library items and their states are covered as holders too.
  Never published; readers are refused. Tested in the real page: all three editor paths, the board, the update and the delete.
- [x] **6.6 In chapters.** *(Done 2026-11-21, Sonnet.)* A chapter lists the skills it shows in a new **`skills:`** property (`tools/sync-chapters.py` copies it into
  `chapters/index.json` next to `status`; the vault's Chapter Template and the Chapter Pipeline note got the property). `EpitaphTimeline.chapterSkills()` returns
  what each chapter names. New Checks (`skillProspectChecks`): **skill-prospect**: a **canon** chapter naming a skill that is still only a prospect **warns**
  ("assign it to a character first (opsp)"); a **draft** chapter naming one is only information, so a prospect can be mentioned while drafting; **skill-unknown**:
  a name no character has and no prospect either is noted (a typo?). A skill a character has is never flagged, whatever its case, even if a prospect shares
  its name. The Checks module starts loading the chapter index itself. Note: the sync tool publishes canon chapters into the public `chapters/index.json`, so
  a canon chapter's `skills:` list is public there, like the chapter's text; draft chapters only appear with `--drafts`. Tested: 5 Node tests, the sync tool on a
  temporary copy (canon only, then with drafts), and the real Dossier reading a chapter index (warn, inform, then assign Hush through the board and the notices go).

---

## Which model (for Claude)

The user saves their weekly limit by running plumbing steps on **Sonnet** and switching to **Opus** only where judgment matters.
Check your model at the start of every resume.

**Opus steps** in this plan: all of Phase 0; 2.4 (what the checks flag), all of Phase 4 (spoiler rules), 5.1 (conversion judgment
calls), 6.4 (fit helper). The 1.1 migration design is settled in 0.2, so building it is Sonnet. Every
other step is a Sonnet step.

**If you are Sonnet**, stop and tell the user to switch to Opus (`/model`) before you:
- start an Opus step (listed above);
- write or change lore: item descriptions, origins, histories, curse stage text, anything that becomes canon;
- decide what counts as a spoiler, or change what the publish step allows;
- change a schema or storage format that other steps depend on, or drop a feature;
- fail at the same bug twice.

Say it in one line, like "Next is 0.2 (design). Switch to Opus with /model, then say get back to it", and stop there.
Finish or commit the work in progress first, so nothing is left half done.

**If you are Opus** and the next step is a Sonnet step, finish what you're on, then suggest switching to Sonnet in one line.

## Resume protocol (for Claude)

When the user says "get back to it" / "back to the plan":
0. Check your model against **Which model** above; if this step isn't yours, say so and stop.
1. Read this file and `docs/CHANGES.md` since the last tweak-log entry; check `git log` for commits touching the files named above.
2. Compare what was done with the next unchecked step. For every tweak since the last session, note what it changed in the plan:
   a step done early, a step now unneeded, a new step, or a schema change that ripples into later steps.
3. If nothing in the plan changed, say which step is next and go ahead. If something did, tell the user in a few lines what moved and
   what you suggest, then go ahead unless the change is a real decision for the user (a schema change, dropping a feature).
4. After working, tick the steps, and add a tweak-log line.

## Tweak log

Newest first. One line each: date, what changed, and what it does to the plan.

- 2026-11-23 — **opmk deck, revised from the user's notes**: no click menu: click selects a card and ← → cycle a selected curse's stages; the initial stage's name now shows on the card; the deck no longer feels empty: a card table with fanned spreads per kind, cards that float like the vault's relics (own light, breathing shadow), tarot numerals, a turning sigil ring, a name plate and seals for copies dealt. The stage strip on the right page is display only.

- 2026-11-23 — **opmk is a deck of cards** (Opus; the user chose cards over a jewel cabinet, then: stages as cards beneath instead of cracks, blessings gold). Inside the book the mark library is a deck on the left page, in rows: blessings upright in gold, curses reversed in red, bindings sealed with green rings (one per rank, shown on the card). A curse's written stages (initial + up to three) are cards stacked beneath it; clicking a curse offers **Cycle stages** (brings the next stage card to the top and shows its text on the right page, with a stage strip) or **Inspect**. The right page is the existing editor with copies and Update all copies. Copies show as "×N dealt". Outside the book it is still the modal board.

- 2026-11-23 — **opsp is a grimoire** (Opus; the user picked it from mockups over a card tree and a card table). Inside the book the skill prospects are an open grimoire: the left page has the contents (root to branch, so each prospect follows what it grows from; corrupted ones in red with ✕; a search box) and one spell page per prospect (sigil ring around its glyph, the name in the skill tree's blackletter, seven level diamonds, what it grows from and its branches as links, a red ribbon), turned with ◂ ▸ or the arrow keys; the right page is the existing editor (Save, Duplicate, Delete, Assign, Who could take it), unchanged. Outside the book it is still the modal board. Next: **opmk as cards** (the user chose cards over a jewel cabinet).

- 2026-11-21 — **6.6 done (Sonnet): the item plan is complete (all 32 steps).** The vault notes and the repo are updated; next is the continuity list for the user.

- 2026-11-21 — **6.5 done (Sonnet).** Next: 6.6 (Sonnet), the last step of the plan.

- 2026-11-21 — **6.4 done (Opus).** Next: 6.5 mark library UI (Sonnet), then 6.6 (Sonnet).

- 2026-11-21 — **6.3 done (Sonnet).** Next: 6.4 (Opus): the fit helper, which can reuse this module's `plan()` for the "does it fit" part and compare against every character.

- 2026-11-21 — **6.2 done (Sonnet).** Next: 6.3 Assign (Sonnet): the Assign button goes on this board's editor.

- 2026-11-21 — **6.1 done (Sonnet), and a design change to tell the user:** Phase 6's text said holders would keep `{ markId, stage?, note? }` references resolved
  "everywhere marks are read". I built **linked copies** (`libId`) instead: same user-facing result (pick from the library or create new, define once, see
  where a mark is used, update every copy, each holder keeps its own stage) with far less risk, because nothing that reads marks has to change. Effect on the
  plan: 6.5's "update copies" uses `markHolders` + `applyDefinition`; a copy can drift from its definition until you update it, and the UI should say when it has.

- 2026-11-21 — **5.4 done (Sonnet); Phase 5 complete.** Left: Phase 6 (6 steps), Sonnet except 6.4 (Opus).

- 2026-11-21 — **5.3 done (Sonnet).** Only the checkbox tap rows needed a fix. Next: 5.4 docs (Sonnet).

- 2026-11-21 — **5.2 done (Sonnet), partly forward-looking.** The Site Encyclopedia has only its index (its entry view is step 2.2), so there was no
  entry to link into or list items on yet; built the links and the helper now so they light up when it exists.

- 2026-11-21 — **5.1 done (Opus).** Two lore clashes surfaced and are in the notes for the user: "Vanishing Point" and "The Halftone" have an
  ending, which clashes with "curses can't be removed". Next: 5.2 cross-links (Sonnet).

- 2026-11-21 — **5.0 done (Sonnet).** 5.1's converted file now loads through this option. Next: 5.1 (Opus).

- 2026-11-21 — **CORRECTED by the user right after:** I first built this as "frozen per viewed chapter" (a chapter-1 version could never show more than
  chapter 1 did). The author meant the opposite: **information updates when the author WRITES the reveal in a later chapter, not by the chapter
  version being viewed** (bringing up the past may be confusing; later). So `asOf` is now the **reader's position** (`EpitaphTimeline.readerChapter()`,
  none = everything published), not the viewed version: once the chapter revealing God's Eye is published, a Connected item reads Rank 7 · Planet in
  every chapter's version; a reader who set their position earlier still sees Soul. The text below describes the mechanism (`asOf`, `revealedIn`,
  `reachedIn`), which is unchanged; only where `asOf` comes from changed.
- 2026-11-21 — **(first version, superseded above) Rule from the user: items show the way each chapter presented them** ("if chapter 2 specified rank 1 soul then keep that"). Built on top of 4.1 (Sonnet): a reader's view of a chapter counted only what was
  revealed **by that chapter**, not by the last published one. `EpitaphLibrary.rankAt / maxRank (…, asOf)` and `revealedBy`; published marks keep
  `revealedIn` and states get `reachedIn` (the first chapter that reached them; 0 = the normal state), both kept through the reader's Library; the
  inventory monitor passes `asOf = the viewed chapter` for readers and leaves out later states and later marks. The author's own data has no
  `revealedIn`, so the author sees everything. Verified in the real reader page on a chapter-3 snapshot: chapter 1 and 2 read Rank 1 · Soul
  (Connected, but God's Eye is revealed in chapter 3) with only the states reached so far; chapter 3 reads Rank 7 · Planet with all of them.
  The checker also fails on a `reachedIn` past the last published chapter. **Open (later, as the user said):** what a flashback chapter should
  show, and the book's reader card (publish plan 3.3) must pass the viewed chapter the same way (noted there).

- 2026-11-21 — **Phase 4 complete (Opus).** Judgment calls: marks stay minimal as the publish plan decided (only reach and reached stage
  names added); a hidden binding hides its reach, so a reader's rank can be lower than the author's; `<Item>: history` reveals all
  pre-story entries at once (per-entry reveal can come later if wanted). 4.3 did not touch the book's reader card (other session's work).
  User, same day: Repentance's Dormant/Seeding/Budding/Propagating and the curse stage names are the same process (maybe slang vs scholarly,
  undecided); god-sourced curses wait until the site work is finished.

- 2026-11-21 — **3.4 done; Phase 3 complete (Sonnet).** Two lore clarifications from the user while approving the text: Realm stays out of item
  ranks, and curses are not applied by gods or Storyborn. The second changes how 5.1 reads curse **sources** (causes). Repentance's
  curse story (initial / awakening / fluctuation / stabilization, and the fast-track "skip to Fluctuation" on infection) is saved in the vault for 5.1.

- 2026-11-21 — **3.3 done (Sonnet).** The ladder is for display; changing a stage is still done in the mark editor ("Stage now", 2.3).

- 2026-11-21 — **3.2 done (Sonnet).** New styles went in `epitaph-theme.css`, not `epitaph-book.css` (the other session has uncommitted edits in the latter).

- 2026-11-21 — **3.1 done (Sonnet).** The "subtle site addition" from the Notion page (animation when switching items) is in.

- 2026-11-21 — **Very old years (user: "what about −Y4219")** worked already (a negative number is stored, sorted and checked correctly) but
  displayed as "Y-4219" and had no approximate flag. History entries now take **≈** (`when.approx`, only with a year) and every view
  prints years like the timeline ("Before Epitaph · ≈ Y −4,219") through `EpitaphLibrary.whenText`. Touches 1.3 (shape), 2.1 (editor).

- 2026-11-21 — **2.4 done; Phase 2 complete (Opus).** Added curse-gone (not in the plan, follows the lore); dropped the unknown-source rule.
  Fixed history sorting from 2.1 (it kept the typed order). Next: Phase 3 (views), all Sonnet; 3.4's wording on the Powers page
  is written lore, so check it with the user.

- 2026-11-21 — **2.3 done (Sonnet).** 1.4 left old `cost` / `ends` untouched because three editors still wrote them; with one editor now, the
  fold could safely move into the code (with backups), so **5.1 no longer has to move every old cost / ends**: it only refines the automatic
  default (blessing cost → price, ends → lasts until; binding and curse text → effect) where the author wants terms, a breach or a stage
  text instead. The Dossier schema went to 9 for this. The Powers page and the classic marks form's help text still mention "Binding"
  for people (3.4 rewrites them).

- 2026-11-21 — **2.2 done (Sonnet).** Aliases and mirrors removed as promised. Moved the checks' state rules to tracks here (they had to
  change anyway); this takes the chapter part of two 2.4 rules off 2.4. One behaviour change: a **migrated** Item track is not one-way,
  so old items no longer raise "goes back" warnings until you mark the track one-way. The earlier first-draft harness that read
  `item.states` fails by design.

- 2026-11-21 — **2.1 done (Sonnet).** Deviation from the plan text: `item.states` is NOT removed yet, only `originPlaceId` is. Removing `states`
  now would break the inventory editor (`index.html`, ~3 places), the checks and the publish builder, which 2.2 / 2.4 / 4.1 move; so the
  removal now happens at the end of 2.2 (and the publish/check readers there). Another change: the publish snapshot's format is
  unchanged (it still writes `originPlaceId` and `states`); 4.1 moves it. Not exercised in a browser: nothing else (the Atlas page itself
  needs WebGL and a CDN, so the drawer was driven inside the Dossier page instead).

- 2026-11-21 — **Slip, fixed.** While ticking 1.6 my edit also deleted Phases 2–6 from this file (the file is untracked, so git had no copy).
  I rewrote them from the steps as agreed in this conversation, including every later decision (aliases to remove in 2.1/2.2, the three
  mark editors in 2.3, 5.0 and 5.1, Phase 6). If any wording differs from before, the meaning is the same; tell me if a step looks wrong.
  Worth committing this file so it has a history.

- 2026-11-21 — **1.6 done; Phase 1 complete (Sonnet).** Plan is 32 steps: 10 done. Next: Phase 2 (editors and checks). 2.1 and 2.2 are
  Sonnet but big (they remove the temporary aliases from ~10 files); 2.4 is Opus.

- 2026-11-21 — **Decision (user): converted items reach existing ones through a new Merge option, "Also update items that already exist"**
  (not Import). New step **5.0** added before 5.1 (plan is now 32 steps); 5.1 now loads its file that way.

- 2026-11-21 — **1.5 done (Sonnet), no code change:** the normalizer from 1.1–1.4 already covers Export, Import and Merge; added 3 tests (21 in
  all). Reminder logged in 5.1: Merge can't update existing items, so the converted file needs Import or a new Merge option.

- 2026-11-21 — **1.4 done (Sonnet), but additive.** 0.3 said old marks would be converted automatically; I did not fold `cost`/`ends` into
  the new fields in code, because three editors (`epitaph-marks.js`, `epitaph-editors.js`, the Dossier's own) still write them and a silent
  fold would rewrite data they keep re-writing. Effect on the plan: **2.3 must replace all three mark editors** (not one) and drop `cost` /
  `ends`; **5.1** does the judgment conversion (blessing cost → price or terms, ends → lastsUntil or breach; curse and binding text → effect
  or stage text) and lists every call. Until then those fields show as before ("Cost:", "Ends:").

- 2026-11-21 — **1.3 done (Sonnet).** Origin stays readable as `originPlaceId` until 2.1 (alias). 2.1 now also removes that alias.

- 2026-11-21 — **1.2 done (Sonnet).** Rank follows active bindings, highest wins (the Observance case is a test: Planet while Connected, Soul at
  No Signal). The tier floor uses the highest rank reachable in ANY state, not the current one, because tier is who could make the item. The
  `rank` field on bindings was pulled forward from 1.4. Display name is "Face" (the page says "A Face"; the Threat list says Face).

- 2026-11-21 — **1.1 done (Sonnet).** Data layer only; nothing changes on screen. Rather than rewrite ~50 readers of `item.states` /
  `entry.stateId` now, kept a temporary alias + mirror (documented in the file header and `docs/CHANGES.md`); 2.1 and 2.2 now say to
  remove them. Found and fixed an edge in my own code while testing (an empty track blocked a later one of the same kind). The v1 library
  stays as v1 in storage until the first Library save (the conversion happens on read, the save comes with any edit). Working tree
  also holds another session's uncommitted book/index edits (version bumps in `index.html`); not touched. Next: 1.2 (rank and tier
  helpers, Sonnet; the lock rule is decided in 0.1/0.2).

- 2026-11-21 — **Phase 6 added** (user): prospective skills shelf (`opsp`; assigning moves the skill, since skills are never shared) and a
  shared mark library (pick or create; characters and items hold references). 5.1 now also folds duplicate marks into the library.
  Which-model list updated (1.1 build is Sonnet; 5.1 and 6.4 are Opus).

- 2026-11-21 — 0.4 done; **Phase 0 complete** (Opus). Reveal syntax `<Item>: origin` / `<Item>: <mark>`; future states hidden entirely.
  Phase 4 builds this. Next: 1.1 (Sonnet plumbing; the migration design is settled in 0.2). User asked about a library for skills and
  marks not tied to a character (answer pending; would be a new phase).

- 2026-11-21 — 0.3 done (Opus). Blessings get Price · Terms · Breach · Lasts until (working name). Affects 1.4, 2.3 and the conversion
  in 5.1. Next: 0.4 (reveal granularity).

- 2026-11-21 — 0.3 mostly agreed (Opus). Curses have **no cost and no end** (the page's curse Cost/Ends fields go; their text moves
  into effect or stage text during conversion). Val's Voided gift is a blessing. Existing data is **converted**, not kept in hidden
  legacy fields; anything needing judgment goes into a converted upload file (5.1). Blessing cost/ends to be redefined. Parked lore
  idea from the user: people may avoid Cuts because Cuts grant curses (to explore later, in the vault, not here).

- 2026-11-21 — 0.2 agreed (Opus). The user corrected rank: bindings carry rank and the **highest** active one wins (Opus first proposed
  "lowest wins" from states overriding rank; dropped). Third track is author-named per item. One-way is per track per item (an item that
  fuses to its wearer has a one-way Usage track). Affects 1.1, 1.2 (rank helper now reads active marks), 1.4 (mark gets `rank`), 2.1–2.3.

- 2026-11-21 — 0.1 agreed (Opus). The user explained "Planet ⇒ Soul": the rank **dropped** when the item lost the binding that gave it
  planet-wide reach, so rank is not a range but changes with state; `rankTo` dropped, states may set the rank (moves into 0.2). History is a
  list of dated entries (pre-story progression can't live in chapter snapshots). Origin has three choices. "Additional properties" folded
  into `desc`. New step 1.6: weight, appearance, maker built but switched off.

- 2026-11-21 — Plan written from the author's Items page. Decided with the user: items use the 7 ranks (Soul … Planet); curse stages are
  broadly Awakening · Fluctuation · Stabilization, and each curse may give its stages unique names (the page's "Initial / Secondary / Finale"
  were placeholders for those); the state is spelled "Propagating"; Sonnet/Opus split as in the other plans. Nothing built yet.
