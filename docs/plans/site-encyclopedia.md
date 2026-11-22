# Site Encyclopedia — action plan

Command: **`opse`** (also `open site encyclopedia`, `open sites`), opened from the book's terminal like `opl` / `ops`.
Sister plan: [creature-log.md](creature-log.md). Both share Phase 0 (the timeline and links). Build it once.

## Purpose (from the user, 2026-11-17)

The written side of every place on the map: what it is, how it's **run** (politics), its **alliances** with start and end dates,
including endings still to come, the **resources** it uses, the **beasts** common there or that it fights, and **how it was built**.
It should show how deeply the world has been thought through, not just list places.

## Rules this plan follows

- **Always 7:** every scale or list in the system has exactly 7 entries (see memory `epitaph-always-seven`). An entry has **7 tabs**:
  Overview · Rule · Alliances · Resources · Beasts · Founding · In the story. Any scale (power, stability, wealth…) has 7 steps,
  each tied to a rule, never an arbitrary number.
- **No spoilers:** anything dated after the chapter the reader is on stays hidden or shows as "?" (same rule as the Creature Log).
- **One source of places:** places come from `assets/epitaph-world.js` (`World.places()`, `SITES`, `STATUES`); the encyclopedia
  adds data keyed by place id and never duplicates names or coordinates.
- **Lore first:** read the lore (vault `Exploratory Ideas/Lore/`: Storyborn Settlements, The Calamity, Orin's Seal, Open Threads;
  `~/Downloads/Epitaph/World Buildinig/`) before writing defaults. Lore is fluid: defaults are drafts the user edits.
- **The site's patterns:** a classic script exposing `window.EpitaphX`, localStorage key `epitaph-…`, defaults and user edits
  merged (like `assets/epitaph-muses.js`), the editor in the book (like the Library, `assets/epitaph-book.js`), entries in
  `docs/CHANGES.md`, versioned `?v=` script tags.

## Status key

`[ ]` not started · `[~]` in progress · `[x]` done · `[-]` dropped (say why in the tweak log)

---

## Phase 0 — Shared foundations (with the Creature Log)

- [x] **0.1 Shared timeline.** `assets/epitaph-timeline.js` (`window.EpitaphTimeline`): one ordered history from Era 0 → the impact →
  Era 1 → chapters 1…N. Each event: `{ id, when: { era, year?, chapter? }, title, kind, refs: [placeId|creatureId|charId] }`.
  Helpers: `isRevealed(when, readerChapter)`, `compare(a, b)`, `label(when)`.
  *Done when:* both systems and the map's chapter slider can ask "is this visible at chapter N?" from one function.
- [~] **0.2 Reader position.** One "chapter I'm on" value shared by the book, map and both encyclopedias (key `epitaph-reader-chapter`),
  defaulting to the latest chapter. *Done when:* changing it in one place hides or shows spoilers everywhere.
- [~] **0.3 Cross-links.** A link format `place:<id>`, `creature:<id>`, `char:<id>`, and one `EpitaphLinks.open(ref)` that opens the right
  book page (or the map). *Done when:* a link to any of the three opens it from any page.
- [x] **0.4 Commands.** Register `opse` / `opcl` in the terminal (index.html, next to `opl`/`ops`), add them to `help`, and to the
  book-links list. *Done when:* both commands open a placeholder page.

## Phase 1 — Data

- [x] **1.1 Schema.** *(Agreed 2026-11-18; the final version is [site-schema.md](site-schema.md), which replaces the sketch below.)* `assets/epitaph-sites.js` (`window.EpitaphSites`, key `epitaph-sites`). One record per place id:
  ```
  { placeId,
    overview: { summary, status, image? },
    rule: { form, holders: [{ name|charId, from, to }], laws, outsiders, factionStance },
    alliances: [{ withPlaceId, kind: 'alliance'|'rivalry'|'war'|'trade'|'vassal'|…(7 kinds), from, to, endsHidden, note }],
    resources: { produces, needs, scarce, guards },
    beasts: [{ creatureId, relation: 'common'|'hunted'|'feared'|'kept'|'worshipped'|… }],
    founding: [{ stage, when, why, who, materials, change, scene? }],
    story: (derived from the Dossier and sword trails, not stored) }
  ```
  Every `from`/`to`/`when` is a timeline `when` (0.1). *Done when:* the user agrees the fields and the 7 alliance kinds.
- [~] **1.2 Defaults from the lore.** Draft entries for the statue sites first (Aurelia, the Temple of the Voided, the Hollow Reach,
  the Church of the Storyborn, Verdant Reach, the Forgotten Grove), then the cities that matter to the story. Mark each field
  `draft: true` until the user approves it. *Done when:* the six statue sites have all 7 tabs drafted.
- [x] **1.3 Storage, merge, backup.** Defaults plus user edits, export and import with the Dossier backup, and a schema version for later
  upgrades. *Done when:* an edit survives a reload and an export/import round trip.
- [x] **1.4 Checks.** Add to `assets/epitaph-checks.js`: alliances that point at missing places, an alliance whose end comes before its
  start, beasts that point at missing creatures, places with no entry. *Done when:* the checks page lists them.
- [ ] **1.5 Schema v2.** *(Added 2026-11-22.)* Build [site-schema-v2.md](site-schema-v2.md) in `assets/epitaph-sites.js`: tabs Overview · History ·
  Domestic · Foreign · Economy · Beasts · Intrigue, the new 7-sets and scales, refs for factions, figures, ties, blocs, secrets, rumours and
  scenarios, and the v1 → v2 upgrade with a backup. *Done when:* v1 data loads as v2 with nothing lost, and the checks know the new refs.
- [ ] **1.6 Redraft the statue sites in v2 (Opus).** Fill the new tabs for the six statue sites from the lore, all marked draft.

## Phase 2 — The book page (reading)

- [x] **2.1 Index.** The `opse` page: every place, grouped by faction (Storyborn · Voided · Fallen · others), filters for era, region,
  form of rule and status, and search that also finds places by ally, resource or beast ("who trades salt").
- [ ] **2.2 Entry view, 7 tabs.** Overview, Rule, Alliances, Resources, Beasts, Founding, In the story, styled like the book (CRT and paper
  themes, the 7-step scales drawn the same way as the skill tree's).
- [ ] **2.3 In the story (derived).** Chapters where something happened there, and the characters who passed through, pulled from
  Dossier locations (the same data the map's sword trails use). *Done when:* no hand entry is needed for it.
- [~] **2.4 Spoiler gate.** *(Started in 2.1: places, alliances and the index search are gated, and an Author view exists. The tabs still need it.)* Apply 0.2 across every tab: future rulers, alliances' hidden endings and later founding stages show as "?".
- [ ] **2.5 Intrigue links.** Markers in every tab for the secrets and rumours pinned to a field, rumour origin and spread (drawn on the map
  as it spreads by chapter), evidence and unanswered questions linked to their secrets.
- [ ] **2.6 Dossier knowledge link.** A Dossier secret or fact can point at an encyclopedia secret; "known by X since chapter N" is derived from
  the per-chapter knowledge; "could be discovered here" from Dossier locations.
- [ ] **2.7 Setup → payoff check.** Setup and payoff chapters on secrets, foreshadowing, evidence and scenario warning signs; the Checks list
  shows loaded guns (set up, never paid off) and payoffs with no setup.

## Phase 3 — Editing

- [ ] **3.1 Editor.** Edit every tab in place in the book, the same way the Library edits items (`assets/epitaph-editors.js` patterns),
  with timeline pickers for dates and pickers for places, creatures and characters.
- [ ] **3.2 Approve drafts.** One click marks a drafted field as approved; a filter shows what's still draft.

## Phase 4 — Politics views

- [ ] **4.1 Alliance timeline.** A horizontal timeline per place: bars from `from` to `to`, coloured by kind, with hidden endings dashed until
  revealed.
- [ ] **4.2 Relations web.** All places as nodes, lines coloured by relation, changing with the reader's chapter (scrubbable).
- [ ] **4.3 On the map.** A "Politics" toggle in `atlas-3d.html` draws the same relation lines between places at the current chapter.
- [ ] **4.4 Blocs.** Named pacts of three or more places, members joining and leaving on dates, shown on every member and in the web.
- [ ] **4.5 What-if board (Opus design).** Scenarios per place and across places: trigger, causes weighed, fallout per place, warning signs,
  likelihood, status; the cause and outcome menus from the schema as suggestions.

## Phase 5 — Founding ("how it was built")

- [ ] **5.1 Stage timeline.** Founding stages in order: why there, who built it, materials (and what was reused from the drowned
  old world), growth, disasters. Each stage dated on the shared timeline.
- [ ] **5.2 Built scenes by stage.** For places with a 3D site (`sites/aurelia.html`, `sites/hollow-reach.html`): an `?stage=N` mode that
  shows only what existed by that stage (tag scene parts with a stage number; hide later ones). A stage slider in the entry.
- [ ] **5.3 Illustrated stages** for places without a 3D site: an image or a simple block diorama per stage.

## Phase 6 — Links into the rest of the site

- [ ] **6.1 From the map.** Clicking a grave or city dot offers "Read the entry" (next to the close-up); the record panel links to it.
- [ ] **6.2 From the Dossier.** A character's locations link to the place entries.
- [ ] **6.3 With the Creature Log.** The Beasts tab and the log's Range tab link both ways (needs Creature Log Phase 1).
- [ ] **6.4 Resources from creatures.** A resource can name its creature source (hides, venom, bone); show it on both sides.

## Phase 7 — Finish

- [ ] **7.1 Mobile layout and keyboard use.** Phone width, focus order, readable in both themes.
- [ ] **7.2 Performance.** Lazy-load the views; the index stays fast with every place.
- [ ] **7.3 Docs.** `docs/CHANGES.md` entries, the help text, this plan's status updated.

---

## Which model (for Claude)

The user saves their weekly limit by running plumbing steps on **Sonnet** and switching to **Opus** only where judgment matters.
Check your model at the start of every resume.

**Opus steps** in this plan: 1.1 (schema), 1.6 (v2 redraft), 4.5 (what-if board design), 1.2 (lore defaults), 2.2 (entry view design), 4.2 (relations web), 5.1 (founding stages from the lore), 5.2 (built scenes by stage), 5.3 (illustrated stages). Every other step is a Sonnet step.

**If you are Sonnet**, stop and tell the user to switch to Opus (`/model`) before you:
- start an Opus step (listed above);
- write or change lore: defaults drafted from the vault, names, causes, anything that becomes canon;
- decide what counts as a spoiler, or mark something `secret`;
- change a schema or a storage format that other steps depend on, or drop a feature;
- build 3D or Blender work, or a new kind of view (tree, web, scene);
- fail at the same bug twice.

Say it in one line, like "Next is 1.2 (drafting lore). Switch to Opus with /model, then say get back to it", and stop there.
Finish or commit the work in progress first, so nothing is left half done.

**If you are Opus** and the next step is a Sonnet step, finish what you're on, then suggest switching to Sonnet in one line.
Keep working if the user prefers.

## Resume protocol (for Claude)

When the user says "get back to it" / "back to the plan":
0. Check your model against **Which model** above; if this step isn't yours, say so and stop.
1. Read this file and `docs/CHANGES.md` since the last tweak-log entry; check `git log` for commits touching the files above.
2. Compare what was done with the next unchecked step. For every tweak since the last session, note what it changed in the plan:
   a step done early, a step now unneeded, a new step, or a schema change that ripples into later steps.
3. If nothing in the plan changed, say which step is next and go ahead. If something did, tell the user in a few lines what moved and
   what you suggest, then go ahead unless the change is a real decision for the user (a schema change, dropping a feature).
4. After working, tick the steps, and add a tweak-log line.

## Tweak log

Newest first. One line each: date, what changed, and what it does to the plan.

- 2026-11-22 — **Schema v2 drafted (Opus) from the user's picks:** [site-schema-v2.md](site-schema-v2.md). Tabs become Overview · History · Domestic · Foreign · Economy · Beasts · Intrigue (In the story moves into Overview). Intrigue pins every secret and rumour to the field it is about; rumours record origin, intent and spread; secrets get setup and payoff chapters (a Chekhov check) and link to the Dossier's per-chapter knowledge, which gives "known by X since chapter N" for free. **Lists over seven were merged into sevens (motives, faction kinds, tie endings, temperament, social shape), waiting on the user's yes**, plus four new scales (technology, faction strength, resource importance, scenario likelihood). **New steps:** 1.5, 1.6, 2.5, 2.6, 2.7, 4.4, 4.5 (34 steps now). 2.2 resumes after 1.5, with the new tabs.
- 2026-11-22 — **User approved three design rules:** multi-place **blocs** (one named pact, members join and leave on dates), beast **ranges on the creature** with places deriving who else is affected, and **founding models only for places switched on** (statue sites by default) until the world is fully fleshed out. The rest of schema v2 waits on the tick-box picks.
- 2026-11-22 — **Schema v2 under discussion (Opus), 2.2 paused.** The user wants a place entry as detailed as the Dossier or more: **domestic affairs** (factions and parties, key figures and their goals, unrest and rebellion, technology, education, faith, military), **history** (original purpose, founders and first members, chronicle, official story vs truth), richer **foreign affairs** (motive, terms, target, renewal, how it ends, multi-place blocs), a deeper **economy** (core exports, partners, routes, what happens if cut off), **what-if scenarios** with many causes, and **beast dynamics** (temperament, nests, wards, sapient monster nations that could have their own entries). Decided: beast ranges live on the creature (Creature Log) and places work out who else is affected; **founding models only for places the user switches on, statue sites on by default**. The options are on a tick-box page for the user; the schema rewrite (1.1 again, Opus) waits for their picks and will change the seven tabs.
- 2026-11-22 — **2.2 design, round 3 (Opus).** The user wants everything **inside the book** (the `opse` spread), with a simpler **dither map** in the style of their Webdesign refs (halftone dot map, campaign-book map with locks, dossier page beside a line map, tactical range rings, stacked contour terrain). Layout G: entry on the left page with the seven tabs as a numbered rail; the right page's empty panel holds the map above the terminal, and each tab picks the zoom (world for ties and story trails, region for resources and beasts, a contour model of the site for rule and founding). The dither maps come from the Atlas's own `earth.png` heightmap (Equal Earth, same projection), so a 2D canvas can draw them with no WebGL. The scales are drawn as 7 growing dots, the map's own language. Waiting on the user's verdict. Mockup scripts: `~/Downloads/claude-info/dither-mockups/`.
- 2026-11-22 — **2.2 design, round 2 (Opus).** The user found the first three layouts (tabs, tab rail, one scroll) lacklustre and wants **map integration**. Three new options built on real renders of the Atlas and the 3D Aurelia site: **D** the entry opens as a drawer on the Atlas (ties drawn as arcs, a time ruler that changes map and drawer together), **E** the entry opens inside the built 3D site (resources pinned in the scene, founding stages build the city up), **F** a zoom ladder (each tab picks world, region or site). Waiting on the user's pick. Places without a built site would fall back to the region close-up scene (`closeup.js`). Also found: headless chromium renders the WebGL pages with `--use-angle=swiftshader --enable-unsafe-swiftshader`, so the map can now be tested and screenshotted.
- 2026-11-21 — **0.2 checked in a browser (Sonnet), still `[~]`.** In the real Dossier with 30 chapters: the book's Library ruler **starts at the shared reader chapter**
  (set to 12, it opened at 12) and **follows a change made elsewhere** (`setReaderChapter(20)` moved it to 20). Not exercised headless, so the author should try them by hand:
  a user's own swipe on the ruler **saving** the position (the code path is `pick()` in `epitaph-book.js`: it saves, and saves "latest" for the newest chapter, but scroll
  events don't fire in a headless browser), and the **map's** slider (the Atlas page needs WebGL). **Next step is 2.2 (Opus)**: design the entry view's seven tabs; I will show
  two or three layouts to pick from before building (the author reacts better to concrete options). Suggested branch: `site-encyclopedia-entries`, cut from `item-system`
  (the entry needs the items helper `EpitaphLibrary.itemsFromPlace`).

- 2026-11-21 — **From the item plan (5.2), for the entry view and the Resources tab:** items' origin links already use `place:<id>` and will open the
  entry once it registers `EpitaphLinks.register('place', …)`. For "made here" call `EpitaphLibrary.itemsFromPlace(placeId, only)`; in the Reader view pass a
  filter that keeps only items a published chapter has revealed (the snapshot only contains those, so it is just the list), and tag items as made, not
  produced (an item's origin is where it came from, not a resource flow).

- 2026-11-21 — New plan [item-system.md](item-system.md) (Library items get rank, tier, state tracks, curse stages, origin circumstance). **Effect here:** an item's origin place links to its place entry, and the **Resources** tab (2.x) can list items made at a place, both only once the item is revealed (item-system step 5.2). No change to the 7 tabs or the schema yet.
- 2026-11-18 — **Visibility rule from the user (applies to every step from here on):** until a place is reached, readers don't see it at all; the author sees everything. Built into 2.1: **Author view** (default, per browser; `EpitaphTimeline.authorMode()` / `setAuthorMode()`) lists every place and marks the ones readers haven't reached "Hidden from readers"; **Reader view** (the toggle in the index's tool bar previews it) lists only places whose first state is reached, so a place with no entry or an unreached first state is gone, not shown as "No entry yet". `EpitaphSites.placeReached`, `alliancesAt` (now also hides a tie to a place the reader hasn't reached, which had leaked that place's name through a neighbour), and `clean(text, chapter)` (drops free text that names an unreached place) are the helpers **2.2–2.4 must use for every tab**. **Limit:** free text can only be gated by naming an unreached place; a sentence that hints at a secret without naming it is not caught, so per-line `from` dates on resources and laws are worth adding in 2.4. **Open decision:** the drafts ship in `assets/epitaph-sites.js` and `epitaph-timeline.js`, which are public on GitHub Pages, so anyone can read the secrets in the page source (chapters avoid this: `sync-chapters.py` publishes canon only).
- 2026-11-18 — 2.1 done (Sonnet): `opse` now opens the real index (`assets/epitaph-sites-ui.js`, `EpitaphSitesUI`; the placeholder stays as a fallback). Places grouped Storyborn · Voided · Fallen · Cities & others (a place's `rule.stance`, else the map's site type), filters for era, region, form of rule and status, and a search over names, rulers, allies, resources, beasts and notes (word starts only; filler words like "who" and plurals are ignored, so "who trades salt" works). Each row shows the current status, rule, size and tie count; a place with no entry says so. Clicking a row opens `place:<id>` through `EpitaphLinks`, which falls back to the map until the entry view (2.2) registers its handler. **Spoilers already apply here** (new `EpitaphSites.alliancesAt`): at Chapter 1 secret ties are not listed or searchable, and a place whose first state starts at a secret moment is not shown. That makes 2.4 mostly the tabs, not the index. Checked with a browser test of the filters, search and chapter gating, plus a screenshot; the book's framing in a real window wasn't seen settled. **Next:** 2.3 (derived "in the story") is a Sonnet step; 2.2 (the 7-tab entry view) is an **Opus** step.
- 2026-11-18 — 1.3 and 1.4 done (Sonnet). **1.3:** edits are stored per tab under `epitaph-sites` and the timeline's under `epitaph-timeline`; the Dossier's Export now carries `sites` and `timeline` (only what you changed), Import replaces them (an older backup without them leaves yours alone), and Merge adds only the places and timeline edits you don't have yet, listed in its confirmation. A schema `version` is stored for later upgrades. **1.4:** the Dossier's Checks list now also reports alliances or entries pointing at missing places, an alliance that ends before it starts, dates on events the timeline doesn't have, beasts missing from the Creature Log (only once it exists), and, as a note, the 38 Era 1 places with no entry yet. Clicking a site warning goes to `EpitaphLinks.open('place:…')`. Checked with Node tests of every rule and the backup round trip; the Export button itself wasn't clicked in a browser. **Phase 1 is done except 1.2's Beasts and the two thin drafts.** No plan changes.
- 2026-11-18 — 1.1 agreed and built, 1.2 drafted (Opus). **Schema change:** a place has dated `states` (each with a status and the seven 1–7 scales: Size, Hold, Stability, Supply, Defence, Secrecy, Written) instead of one `overview.status`; `stateAt(record, chapter)` picks the one the reader has reached, so **2.4's spoiler gate comes free for states**, and 2.2's Overview tab shows the current state. Alliances are stored on one side and shown on both (`alliancesOf`). `assets/epitaph-sites.js` holds the 7-sets and the six statue sites' drafts, loaded on the book page. 1.2 stays `[~]`: **Beasts tabs are empty** (the lore has no Era 1 creatures; the Creature Log's 1.5 drafts them, then 6.3 links them), and the **Church (Tokyo) and Verdant Reach drafts are thin** because their lore is open. Storage (`save` per tab, `reset`) is in, so 1.3 only needs export/import with the Dossier backup.
- 2026-11-18 — 0.4 done (Sonnet): `opse` / `open site encyclopedia` / `open sites` and `opcl` / `open creature log` / `open creatures` open placeholder pages in the book (`EpitaphBook.openSites` / `openCreatures`; the site count shows on the sites page). Added to `help`, the command table, the hint text and the storybook link list (two copies in index.html). Checked in a browser: both commands, `back`, the link-list clicks and `opl` still work. **For Phase 2:** replace `placeholder()` in `assets/epitaph-book.js` with the real index and entry view, and register `EpitaphLinks` handlers for `place` / `creature` there. **Phase 0 is now done apart from 0.2's last part and 0.3's creature links.** No plan changes.
- 2026-11-18 — 0.3 built (Sonnet): `assets/epitaph-links.js` (`EpitaphLinks`: `parse`, `resolve`, `href`, `open`, `register(kind, handler)`, plus `data-ref="place:…"` click handling), loaded on the Dossier/book and the map. Place links open the map (new `atlas-3d.html?place=<id>` flies to it), character links open the Dossier, by id or name. Still `[~]`: creature links say "not built yet" until the Creature Log exists, and the encyclopedia pages register their own handlers in 0.4 / Phase 2. Muses, Powers and Read don't load it yet. No plan changes.
- 2026-11-18 — 0.2 wired (Sonnet): the map's chapter slider and the book's Library chapter ruler now start from, save to and follow the shared reader chapter (only the user's own moves save it; the Era 0 rewind and first load don't; picking the newest chapter saves "latest"). Still `[~]`: it isn't checked in a browser yet, and the encyclopedias don't read it until Phase 2. No plan changes.
- 2026-11-17 — 0.1 done: `assets/epitaph-timeline.js` (37 drafts from the vault's Timeline.md; 7 kinds; `secret` + `revealedAt` for twists; story moments without a chapter count as spoilers until the latest chapter). 0.2 started: its storage and API are in the same file; wiring the book and the map's slider to it is what's left. **For later steps:** every `when` is `{ era: 'BEFORE'|'ERA_0'|'ERA_1', year?, approx?, chapter?, text? }`, and refs use the 0.3 link format already (`place:`, `char:` id or name, `creature:`). No tweaks since the plan was written.
- 2026-11-17 — Plan written. Purpose confirmed by the user (politics, alliances with endings, resources, beasts, how it was built).
