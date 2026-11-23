# Epitaph — what changed

Two redesigns: **Atlas tracker** (newest, first) and the **chapter-state redesign** below it.

## Creature Log: the World over time (assets/epitaph-creature-world.js) — step 4.1

A **World** tab (layout AC from Round 10): the same 14 time chips drive one big dither map of the Earth, with the left page saying what is true of the world at that time.

- **The crater and the sea** appear from **Age D (The Siege)** on, as you decided: before it the map shows the old dry coasts and no crater; from Age D the land the sea took (+60 m) is drawn in the map's second colour and a glowing crater sits in Antarctica (where the Atlas has it). The age is one constant (`SHIFT`) in the module.
- **Infected places awake:** each place wakes at its own "cursed since" date, else its biome's; a place with neither is simply not drawn yet. Ember dots on the map, with a count ("6 of 298").
- **Living forms:** the tips of the lines alive at that time, as buttons. Pick one and the infected places in its biomes light up on the map, with **Open page ▸**.
- **What changed since the band before:** the crater forming, places waking, forms appearing and dying out.
- Four layer toggles (crater, sea, infected places, forms). **No ice layer:** the map holds no ice data, so none is drawn (the page says so).
- **Readers** get a World tab too, built from the gated copy (step 2.4): only the places, biomes and forms they've reached.

Tests: `tools/site-tests/test-creature-world.js` (9 checks: the shift age, places waking, living tips, picking, changes, empty log), and the real page before and after Age D.

## Creature Log: the Food Web (assets/epitaph-creature-web.js) — step 4.2

A **Web** tab in the Creature Log (layout AE from Round 10): who eats whom at a chosen time, **in levels**. What eats nothing in the log sits on the bottom row; each creature sits one level above the highest thing it eats; apex hunters are at the top. Lines run from the eater to what it eats (arrowhead on the eaten). **APEX** (eats, and nothing eats it) and **KEYSTONE** (the only food of two or more, or eaten by four or more) are marked, using the food-web rules from step 1.4.

- **Time:** a row of 14 chips (the seven epochs, then ages A–G). A creature is in the web from the time it appears until it dies out, and a link is in force only while both ends are alive.
- **Picking a creature** (click, or Tab and Enter) fills the right page: what it eats, what eats it, and **what would starve if it vanished** (the chain, from the food-web rules), plus **Open page ▸**. Below it, what changed since the band before (who appeared, who died out, links begun or ended) and a key for the roles.
- **Built from the log's own links** (a creature's *Eats* list): nothing is invented. A creature with no link sits on the bottom row with a dashed box; a lineage step shows only if a link names it. With no links at all, the page says so and where to add them.
- **Readers** get a Web tab beside the Tree, built from the gated copy (step 2.4): only creatures they've found, and links to anything else are dropped.
- **Phone:** the chips wrap, the terminal hides, and the picked creature's card sits under the web.

Tests: `tools/site-tests/test-creature-web.js` (10 checks: levels, roles, time, loops, dropped links, changes), and the real page as author (tab, pick, scrub, Open page) and as a reader.

## Creature Log: the creature page, "the field journal" (assets/epitaph-creature-page.js) — steps 3.1, 3.2, 3.4, 3.5, 3.6

Layout **AA** (picked from the Round 9 mockups): one scroll with the plan's seven sections, and the map on the right page follows the section being read (a "You are at 4 · Abilities" box with 1–7 buttons that jump to a section).

Open it with **Open page ▸** on the tree's card, by clicking a form on another page's line, or from a `creature:<id>` link. **◂ Tree** goes back with that form still picked; **Edit ▸** (author) opens its editor.

1. **Lineage (3.1):** every form from the root to this one, side by side (time, what changed, ⛓ for a curse, ✕ for extinct). Click any ancestor to open its page. Branches that split off a form (such as an extinct side line) are listed beneath.
2. **Mutations (3.2):** each change in order: what changed, its **cause** (an epoch, an age or a timeline event, in words), and what it gained.
3. **Anatomy:** the parts you've written; the labelled drawing is step 3.3 (Opus), and the page says so while it's empty.
4. **Abilities (3.4):** traits and what counters each. **No power dots yet:** I proposed a 7-step power per trait in Round 9 and am waiting for your answer (Faint · Minor · Notable · Strong · Fierce · Overwhelming · Unstoppable, or none).
5. **Range & movements (3.5):** biomes, places, nests, and sightings by chapter, each with its place linked to the Site Encyclopedia. The map shows the range, **migration routes** (dashed amber lines ending in a dot, with the time on hover) and **sightings** (red rings labelled "Ch 3" at the place). Routes are written in the editor under *Migration routes*: one row per route, a time and a path of `lat,lng; lat,lng; …` points.
6. **Behaviour & lore (3.6):** diet, hunting, breeding, and what each settlement calls it and believes, linked to the place's entry.
7. **Field notes:** the notes you've written; writing them in character voices is step 3.7 (Opus).

**Readers** get the same page built from the gated copy (step 2.4): only forms they've found; an unknown ancestor is a "? ? ?" card; no curse names, settlement names, field notes, or unreached sightings; no Edit. A form that has no page (a silhouette) can't be opened. Phone: a compact header, the terminal hides, and the map sits under the page.

Tests: `tools/site-tests/test-creature-page.js` (9 checks for the model: the line, branches, mutation order, silhouettes, loops), and the real page as author and as a reader at chapters 3 and 9 (no leaks, no console errors).

## Creature Log: the Tree of Descent (assets/epitaph-creature-tree.js) — step 2.1

The Creature Log now opens on a **Tree** tab, drawn in layout V (picked from the Round 8 mockups): time runs down the page.

- **Bands.** One band per epoch (Chaos → The Twisted Worlds, then Epitaph), then Epitaph's seven ages A–G. The last three (the curse cycle: awakening, fluctuation, stabilization) are tinted red. An epoch with nothing in it folds thin; the ages always stay open.
- **Lineages.** Roots at the top; each form sits in the band where it appeared, under its ancestor; a fork is centred over its branches. A creature is a larger dot, a lineage step a smaller one; ⛓ marks a form that carries or came with a curse; a dashed dot is a draft.
- **Living and extinct.** A living tip's line runs on to the present and glows; an extinct line is dashed and stops at the age it died out, with a fossil mark.
- **Colour.** Branches are coloured by biome or by cause (a toggle); the legend names them.
- **Creatures of chaos** sit on a shelf beside the tree (they descend from nothing).
- **Moving around.** Drag to pan (or the arrow keys), wheel or pinch to zoom (or + / −), **Fit** or 0 to see it all again. Every form is a button (Tab to it, Enter to pick).
- **Picking a form** lights its range on the world map on the right page (the infected places in its biomes or named in its range, the settlements that have a name for it in teal) with a card: when it appeared, what changed, its curse, and **Edit ▸** (opens it in the Creatures tab). A `creature:<id>` link lands on the tree with that form picked.
- **Bad data never breaks the tree:** a missing parent or a loop makes a root; a form dated before its ancestor is drawn just below it anyway (Checks already flags it); an undated form sits one band below its ancestor, marked "?".
- **Phone:** the tree takes most of the height, the map the rest; the terminal hides while it's open.

Tests: `tools/site-tests/test-creature-tree.js` (18 checks).

### Discovery: what a reader sees (step 2.4)

Readers now get the Creature Log too: **the tree only** (no tabs, editor, drafts or Library curses). `EpitaphCreatures.forReader(store, chapter, { eventOk })` is the gate, a pure function the view calls before drawing anything, so private data never reaches the page.

- **Known** means a lineage step or creature has a **Reveal in Ch** set (the field is in its form) and the reader's chapter has reached it. **Nothing is known by default.** `Hidden from readers` removes a record entirely (never shown, never counted).
- **Not yet known** forms appear as dotted **"? ? ?"** silhouettes: the step after a known one (or a root), and any unknown step that sits above something the reader already knows (so the known one still hangs off the tree). Deeper unknown steps aren't shown. A silhouette keeps only where it sits in time and in the tree, under an opaque id (`?1`…): no name, biome, cause, curse or real id reaches the page.
- **Known forms** lose their author-only parts: draft marks, *which* curse (readers see only ⛓ "cursed"), settlement names, field notes, traits, nests, and sightings from chapters they haven't reached. A cause or date that names a timeline event they haven't reached is dropped. Biomes show only once revealed.
- **The count** reads "3 known · 1 still to find" (known, and the silhouettes beside them: it deliberately isn't the true total). The scrubber lists only timeline events the reader has reached. The map shows only places and biomes they've reached.
- Creatures of chaos follow the same rule (an unknown one is a bare "? ? ?" chip).
- The reader's view follows their chapter live (`onReaderChange`); a `creature:` link to a form they haven't found just opens the tree.

Nothing in the shipped data is revealed yet (no `revealedIn`), so until you set a Reveal chapter a reader sees only "? ? ?". Tests: `test-creature-gate.js` (13 checks, including that no name or secret appears anywhere in the gated data) and the real page as a reader at chapters 0, 2 and 9.

### Fork details (step 2.3)

Hover a form (or Tab to it) and a card shows what changed, what it gained, its cause and when it appeared (and when it died out). **Click a form** to pin its card; a pinned card has **Show on the timeline ▸**, which moves the time scrubber to the band of the cause and lists that moment's timeline events beside it. (The site has no separate timeline page yet, so the scrubber is where a cause is "opened"; if one is built later, this button should open it there.) A **fork** (a form with two or more branches) gets a dashed ring. Tests: 19 checks in the tree suite.

### The time scrubber (step 2.2)

A **Time** slider above the tree runs across the same 14 bands (the seven epochs, then ages A–G). The tree stays where it is and **grows in place**: a form shows only once its band is reached, a living line stops at the scrubbed time and glows at its front, and an extinct line gets its fossil mark only once it has died out (before that it still runs). Bands after the scrubbed time darken and the current one is outlined. Beside the slider: the band's name, how many forms have appeared (e.g. "9 of 13"), and the **timeline events that fall in that epoch or age**. ◂ ▸ step one band, **Play** walks forward one band at a time, **Now** returns to the present. If the form you picked hasn't appeared at the scrubbed time, the pick clears. On a phone the step buttons hide (the slider is enough) and the tree scrolls.

## Creature Log: the view and editor (assets/epitaph-creature-ui.js) — steps 1.7, 5.1, 5.2

Type **`opcl`** (or follow a `creature:<id>` link) to open the Creature Log in the book. It is the author's workspace for now (readers get a note until the tree's discovery rules arrive).

- **Three tabs.** **Creatures** (creatures, lineage steps and creatures of chaos, nested under their ancestors, each with chips: conscious, the curses it carries, extinct, example, draft), **Biomes** (with place counts) and **Places** (the infected places: search, filter by biome, *curse not written* only; 120 at a time).
- **Edit in place.** Click any row to open its form; **Save**, **Cancel**, or **Delete** (asks twice). **+ Creature / + Lineage step / + Chaos form / + Biome / + Place** add your own. Pickers: descends from, when (epoch, age or a timeline event), cause, biomes, curses (the Library's, written in **opmk**), places, and **Eats** (the food links). The seven-step scales are clickable dots with their step names. **Approved** turns a draft into yours (a *drafts only* filter shows what is left).
- **A place's curse is optional**: pick one from the Library, with its stage, when the story reaches it; until then it reads *curse not written yet* and Checks never flag it.
- **The right page** is the world map with every located place plotted (filled = a curse is written).
- **Both ways with the encyclopedia (step 6.1):** a creature's form lists the places whose Beasts tab names it (with the relation, e.g. "warded off"), each a link that opens that place's entry in the book; a place's form links to its own entry once you pick its *Encyclopedia place*.
- **Links:** `creature:<id>` opens the log on that creature (the encyclopedia's Beasts tab uses it, and shows the creature's name as a link once it is in the log).
- To start from the vault's file (example herd, 22 biomes, 305 infected places): Dossier → Data → Merge.

## Creature Log: storage, backup and checks (assets/epitaph-creatures.js) — step 1.6

`window.EpitaphCreatures` now stores the log: key `epitaph-creatures`, records by id in five collections (lineage **nodes**, **creatures**, **chaos** forms, **biomes**, infected **places**) plus the **food** links. It ships **empty**: no lore is in the site's code. The user's creatures, the example lineage and the infected places arrive through **Dossier → Data → Merge** from a file kept in the vault.

- **API:** `load`, `byId(id)` (creatures, nodes or chaos; a `creature:<id>` link points here), `put`, `remove`, `putFood`, `uid`, `exportData`, `importData`, `newInData`, `mergeData`, `problems`.
- **Backup:** Export carries the log under `creatures`; Import replaces it (the log as it was is kept once under `epitaph-creatures-backup-v1`); Merge adds records whose ids you don't have and **never replaces yours**, and the Merge dialog lists what it adds.
- **Curses are Library marks.** The Library now keeps a curse's new optional fields (`state`, `spreadsBy`, `moves`, `concepts`, `rest`) instead of dropping them; item curses are unaffected. A creature or place holds `{ libId, stage }`. A place's curse is optional: unwritten means "not known yet", never a problem.
- **Checks:** `creature-parent`, `creature-cause`, `creature-order`, `creature-extinct`, `creature-food`, `creature-curse` (a curse whose Library definition is gone).
- Records are cleaned on the way in (scales outside 1–7 and unknown times are dropped; new records are drafts). The Beasts tab's "isn't built yet" note goes away once the module is loaded.

## The Site Encyclopedia, at a glance — step 7.3

*The newest entries below are step by step (plan: [site-encyclopedia.md](plans/site-encyclopedia.md)); this is the map.*

**Open it:** type `opse` in the Storybook terminal (or the Site Encyclopedia link), or follow `index.html?place=<id>[&tab=history]`. Every place with an entry has **seven tabs**: Overview · History · Domestic · Foreign · Economy · Beasts · Intrigue.

| Where | What | Who sees it |
|---|---|---|
| Places index | every place by faction, filters and a search that finds places by what they hold ("who trades salt") | readers: places they've reached |
| A place's entry | the seven tabs, with the founding model or the dither map on the right page | readers: only what their chapter has reached |
| History → *How it was built* | the seven founding stages, dated; click one to turn the model; link to the 3D site at that stage | stages reached |
| Foreign → *Ties over time*, blocs | bars from start to end per tie; blocs with who joined and left when | the reader gate |
| **Relations** (index button, Foreign link) | every place on a ring, ties as chords, scrubbed by chapter, seats by type / country / bloc | the reader gate |
| **What-ifs** (index button, Intrigue link) | the board by status, the four piles of what to work on, one what-if as a chain | **author only, never published** |
| Intrigue | secrets, rumours, setup → payoff, with markers on every tab; a Dossier secret can point at one | secrets by `revealedIn` |
| Atlas → **Politics** | the same ties as arcs on the map | the reader gate |
| `sites/aurelia.html`, `sites/hollow-reach.html` → **Built** | the 3D sites as they stood at a founding stage (`?stage=N`) | — |
| Atlas close-up, record panel, Dossier location → **Read the entry →** | links in | places the reader has reached |

**Author vs reader.** One gate (`EpitaphSites.forReader`, `webAt`, `blocsAt`, `entryFor`) serves the entry, the ring, the Atlas and the published snapshot, so the Reader preview (the toggle in the index) is exactly what is published. Author-only data (what-ifs, drafts, agents, secret goals…) is never published; `tools/check-snapshot.py` refuses a snapshot that carries it.

**Editing.** ✎ on any card (or the *Edit* bar, or the *Sheet* for a whole tab) edits in place; every save is an undo step; *Approve tab* marks a Claude draft as yours. Drafts of the six statue sites come from outside the repo and are merged with Dossier → Data → Merge.

**Data.** Records live in the browser (`epitaph-sites`, backup `epitaph-sites-backup-v1`, undo `epitaph-sites-undo`), alongside the timeline (`epitaph-timeline`) and the reader's chapter (`epitaph-reader-chapter`). Export and import travel with the Dossier backup.

**Checks.** The Dossier's Checks list covers the encyclopedia: places and events that don't exist, ties and founding stages out of order, blocs under three places, what-if links and loops, setup → payoff (Chekhov) problems.

**Tests.** `tools/site-tests/run.sh` runs 245 Node checks on synthetic data (the reader gate, the web, blocs, what-ifs, founding stages, links). The real-page checks (headless browser) were run by hand and are described in the plan's tweak log.

**Not built yet.** The Creature Log (steps 6.3 and 6.4 finish when it exists), and the public push (docs and history still name private story elements).

## Performance of the encyclopedia views — step 7.2

**Measured first** (with the real timeline module): the places index took 0.8 s in a reader's view at today's 44 places, 40 s at 300, and a reader's view at 2,000 places took over a minute; the author's view grew quadratically too. Each place asked the same questions of every other place again (is this event reached, is that place reached, which place names must be hidden from text, who are my ties), and each of those re-parsed the timeline.

- **Fix:** `EpitaphSites.bulk(fn)`. Inside one bulk call nothing is edited, so answers that depend only on (event, chapter), (place, chapter), the hidden-name list (now one compiled pattern) or the record list (every place's ties in one pass) are worked out once. The index (`rows`), the relations web, the blocs and the creature lookup run in bulk. Outside a bulk call everything is computed fresh, exactly as before; **90 comparisons of the old and new code on random data (author and reader, five chapters) give identical results.**
- **After:** the reader's index is 10 ms at 44 places, 34 ms at 300, 84 ms at 1,000 and about 150 ms at 2,000; the ring's web is 8 ms at 300 places and 40 ms at 1,000.
- `blocsAt` no longer builds a reader copy of places that have no blocs.
- **Not done on purpose:** lazy-loading the view scripts. They cost 3–5 ms of a 280–320 ms page load, so it would save almost nothing and risk load order. The views already build their pages only when opened, and the map's image data loads on first use.

## Phone layout and keyboard use for the encyclopedia views — step 7.1

- **Phone (up to 760px wide):** while an entry, the relations ring or the what-if board is open, the book gives its left page 58% of the height, hides the terminal (no use on a phone there), and shrinks its own header to one line. Every view's header wraps so the title gets a full row (it was squeezed to "A…", "RELA…", "WHAT…"), and touch targets (back and view buttons, selects, chapter step buttons, kind chips, stage buttons, the what-if score dots) are 36–44px.
- **Keyboard:** opening a view puts focus on its Back button; a redraw (pressing a tab, picking a seat with Enter, a chip, a score dot) keeps focus on the same control instead of dropping it to the page; a card that opens a page hands focus to that page's Back. Nothing uses a positive `tabindex`. Every button, link, select and input draws a visible focus ring. The what-if board's drag-and-drop has a keyboard route: open the card and use its Status menu.
- **Themes:** the Dossier is dark only; the Atlas's Politics arcs and the 3D sites' stage picker were checked on the Paper theme.

## Beasts tab and the Creature Log (the entry's half) — step 6.3, part done

The Creature Log isn't built yet, so only the encyclopedia's side exists:
- **Creature names on the Beasts tab** are links into the Creature Log as soon as it registers a `creature` handler with `EpitaphLinks` and `EpitaphCreatures.byId(id)` returns the creature. Until then the name is plain text ("Opens in the Creature Log once it is built"); an id the log doesn't have says so.
- **Also found in** lists the other places whose Beasts tab names the same creature (derived, nothing typed in), each a link to that place's entry, with the relation (feared, kept…). A reader gets only places they've reached and beasts the gate lets through; the author also sees hidden ones, dashed.
- **For the Creature Log's Range tab:** `EpitaphSites.creaturePlaces(creature, recs, author)` returns every place that lists a creature, through the same gate, as `[{ placeId, relation, hidden }]`; the log can call it to link each place to its entry (`index.html?place=<id>`).

## Links from the Dossier to the entries — step 6.2

A character's location in the Dossier links to the place's entry: **Read the entry →** beside the WHERE line of the Chapter codex page and beside *Where* in the Character brief (screen only: the copied brief text stays plain). Clicking it opens the Storybook on that entry, whether or not the book was already open. It uses the same rule as the Atlas links (`EpitaphSites.entryFor`): the place needs an entry, and a reader only gets it for a place they've reached. The `index.html?place=<id>` deep link now goes through the same function.

## Links from the Atlas to the entries — step 6.1

- **Read the entry →** in a place's close-up footer (next to *Open the site*), and in a character's close-up when they stand at a place that has an entry.
- **Read the entry for <place> →** in the character record panel; the place tooltip says "Has an encyclopedia entry".
- The links go to `index.html?place=<id>[&tab=history]`, which opens the Storybook on that entry (a new deep link in the Dossier, like `?char=`).
- **Who may follow it:** `EpitaphSites.entryFor(place)` returns the place to link to only if it has an entry and the viewer may read it: an author always, a reader only for a place they've reached. A temple inside a city links to the city's entry when it has none of its own. The entry itself and the deep link also refuse an unreached place for a reader.

## Illustrated founding stages (epitaph-dither.js, epitaph-sites.js `foundingLayers`) — step 5.3

The dither **founding model** on the right page now illustrates each stage from what the place's founding stages say, for every place with a model (and the ones with a 3D site too, which also link to it). The stage buttons pick the stage; a caption names it and what changed.

- **What it draws:** 1 the spot is ringed · 2 the heart is cleared and paved, with the first buildings · 3 a ring wall with a gate · 4 the town · 5 a disaster's scar (a smooth black wound, its rim glowing, everything inside gone) · 6 rebuilt blocks over the scar in another tone · 7 everything as it now stands. **Grey ruins** of the drowned world appear when a stage up to here reuses something from it. Buildings take the place's colour: Storyborn gold, Voided violet, Fallen ember.
- **Only what's written:** a stage that isn't written adds nothing, and readers get the stages they've reached, so no scar appears before its chapter ("Not known yet" in the caption).
- Without the new options the model draws as before.

## 3D sites by founding stage (sites/aurelia.html, sites/hollow-reach.html) — step 5.2

Both 3D sites can show the place **as it stood at a founding stage**: a **Built** picker in the header ("as built", or 1 · The reason … 7 · As it stands), or `?stage=N` in the address (1–7). Every piece of the scene is filed under the stage that built it (the scene kit keeps one mesh per material *and stage*), and the labels follow; the note panel names the stage and what it added. "As built" (the default) is exactly the old scene.

- **Aurelia:** 1 the bluff, river, prairie and waterfalls · 2 the farmland, the ring terraces and golden avenues, the Cathedral, townhouses, street trees, pennants and lanterns · 3 the bluff wall and the Ruler's Tower with its script rings · 4 the Chronicle, the Archive, the Seminary and its bridge, the wharf, lower town and funicular · 5–7 the erasure (the same as *After the Calamity*). Picking Before or After goes back to "as built".
- **The Hollow Reach:** 1 the forest · 2 the carved pit and its four steps (and the frost where Val stands) · 3 the obelisks and relay masts of the inverse barrier · 4 the hives, Spines, Descent, lake and station, palace, Assembly, arena, yard, air shafts, pods and everything below. It has no disaster yet, so 5–7 show it whole.
- **From the entry:** the History tab of a place with a 3D site has **Open the 3D site at stage N**, which follows the stage you click.

## Site Encyclopedia: how it was built (History tab, epitaph-sites.js `foundingProblems`) — step 5.1

The History tab now tells a place's founding as the **seven stages** top to bottom (The reason · Ground broken · First walls · Growth · Disaster · Rebuilt · As it stands), each dated on the shared timeline ("Aurelia rises under Gaia · Ch 1"), with why here, who, materials, **what was reused from the drowned world**, and what changed. Click a stage to turn the founding model on the right page to it; the map's stage buttons and the list stay in step.

- Readers see only the stages they've reached; the rest show as "? ? ?" so the seven keep their places. The date line shows the event's title only up to its first colon or semicolon.
- Checks: `founding-order` (a stage dated before an earlier stage), `founding-dup` (a stage written twice), `founding-stage` (not one of the seven).
- The stage texts themselves are author drafts from the lore, kept outside the repo (merged through Dossier → Data → Merge).

## Site Encyclopedia: the what-if board (assets/epitaph-site-whatif.js) — step 4.5

Every place's what-ifs in one place, **author only** (never published: the reader gate leaves `scenarios` out and the snapshot checker refuses the key). Open it with **What-ifs** on the places index (author view) or **Open the what-if board** on a place's Intrigue tab (it starts filtered to that place; Back returns there).

- **Board:** a column per status. Drag a card to another column to change its status. Each card shows its kind, home place, how likely and how big, the places it hits, and a warning-sign verdict (⚠ when a Planned, Foreshadowed or Written what-if has no sign planted in time; ⟲ when it's part of a loop).
- **Piles** ("what to work on"): the two scores sort every what-if into *Plant signs now* (likely and big), *Keep in your pocket* (unlikely but big), *Background colour* (likely but small) and *Let it go*. Likely = Possible or more; big = a Region or more. What-ifs whose impact isn't scored yet are listed below the piles.
- **One what-if:** causes weighed (★ the one you lean to, with its weight) → trigger → fallout per place → *Then what?* (what it sets off, and what sets it off), plus its warning signs. A quick bar sets status, how likely and how big in place (each an undo step); **Edit everything** opens its full form in the place's entry.
- **Right page:** the world dither map. With nothing open, every shown what-if's ripples (place circles grow with how many what-ifs reach them); with one open, its ripples and a chapter strip with its warning signs (◆) and the chapter it happens in (✸).

Schema additions (older what-ifs upgrade on load, nothing lost): status has **seven** steps (Idea · Weighing · Planned · Foreshadowed · Written · Shelved · Dropped); **impact**, a 7-step scale (Ripple → Ending); each cause gets a **weight** (7 steps) and a **lean** ★; **then**, links to other what-ifs. Checks: `whatif-link` (a link to a what-if that doesn't exist) and `whatif-loop` (what-ifs that set each other off), and the Chekhov rule now covers Planned and Foreshadowed what-ifs too (a Foreshadowed one needs a planted sign; one with a chapter needs a sign before it).

## Site Encyclopedia: blocs (epitaph-sites.js `blocsAt`, the Foreign tab, the ring, Checks) — step 4.4

A bloc is a named pact of **three or more** places, stored on one place's Foreign tab with members who join and leave on timeline dates. They now show everywhere a tie does.

- **One gate:** `EpitaphSites.blocsAt(chapter, recs, author)` returns the blocs at a chapter. A reader sees a bloc only once it is revealed (not `hidden`, or its `revealedIn` reached), a member only from the chapter their start is reached and only if they've reached that place, and a departure only once reached. The author sees all of it, following the chapter for what has *started*, with hidden bloc / member / departure marked. This also fixed the Foreign tab, which used to read other places' blocs straight from the raw records.
- **Foreign tab:** each bloc a place belongs to shows its members as chips ("joined Ch 2", "left Ch 3"), charter, purpose, seat, rival and tension (tension is author-only for readers' scrubbed text), plus a link to the ring. The faint polygon on the map uses only members still in.
- **The ring:** *Seats by* now has **bloc** (a place sits with the larger bloc it is in, else "No bloc"; seats use the widest chapter so they still don't move while scrubbing). **Blocs at this chapter** lists them; pick one to light its members and the chords among them, and read its charter and members on the left.
- **Checks:** `bloc-small` (fewer than 3 members), `bloc-dup` (a place listed twice), plus the existing unknown-place, unknown-event and leaves-before-it-joins rules, now covering blocs.

## Atlas: Politics toggle (atlas-3d.html, assets/atlas3d/epitaph-map.js) — step 4.3

A **Politics** button in the Atlas header draws the ties between places as arcs on the board and the planet, at the chapter on the slider. It is the same data and the same reader gate as the relations ring (`EpitaphSites.webAt`), so the two always agree.

- Colour = tie kind (alliance, vassal, trade, truce, rivalry, war, covert); the key lists only the kinds drawn now. War is drawn thicker; vassal and covert carry an arrowhead (from the one who serves or spies).
- Dotted and fainter = ended. Dashed = a tie readers can't see yet (author only).
- A reader sees only ties that have started by their chapter, between places they have reached; no secret tie before its time, no unreached end. Changing chapter, or switching Author/Reader, redraws.
- Era 0 has no politics (the button is disabled); the choice is remembered, and `?politics=1` turns it on from a link.
- Two places in one spot (a temple inside a city) get no line, since it would have no length.

## Site Encyclopedia: the relations ring (assets/epitaph-site-web.js, epitaph-sites.js `webAt` / `ringSeats`) — step 4.2

Every place on one ring, every tie between places as a chord, by chapter. Open it with **Relations** on the places index, or **See … in the relations ring** on a place's Foreign tab (Back returns to that entry).

- **Seats never move.** Places are grouped by type (or by country: *Seats by*), statue sites first, with a gap between groups. Stepping chapters (slider, ◂ ▸, or the arrow keys) only adds and fades chords, so changes stand out.
- **Chords:** colour = tie kind (seven, toggled in the legend), thicker for war, an arrow on vassal and covert (from the one who serves or spies). Dotted and faint = ended. Dashed = readers can't see it yet (author only).
- **Left page:** what began or ended in this chapter, the busiest places, all ties at this chapter. Click a place or a chord to pick it: a place lists its ties; a tie shows its kind, motive, terms, start and end, with links into both entries. Esc lets go, then closes.
- **Reader safety:** the ring comes from `EpitaphSites.webAt`, the same gate as the entry. A reader can only scrub up to their own chapter, never sees a place they haven't reached, a secret tie before its time, or where an unreached end falls; a tie's words come through `forReader`.

## Site Encyclopedia: ties over time (assets/epitaph-site-entry.js, epitaph-sites.js `tieBars`) — step 4.1

The top of a place's **Foreign** tab now draws its ties on a timeline: one row per tie, a bar from where it starts to where it ends (the timeline's own event order), coloured by kind (alliance, trade, war and the rest), with a "latest" or "Ch N" marker for where the reader is. Hover a bar for the tie's start and end events. The author can click a bar to edit that tie.

- **Dashed bar** = a secret tie (author only; a secret tie a reader hasn't reached isn't drawn at all).
- **A bar that fades into a "?"** = the end isn't reached yet: a reader sees it run as far as they have read and never learns where it stops, and the end event is not named anywhere on the page. The author sees the real end, with a dashed edge, marked as not yet visible to readers.
- **A bar with an arrow** = no end (still going); a solid end cap = an end the reader has reached.
- The axis names only events that bars use, so a reader's axis can't name an event they haven't reached.

## Site Encyclopedia: the editor (assets/epitaph-site-edit.js) — step 3.1

In the author's view every card of a place's entry gets a ✎, and each tab has an **Edit bar** at the top. Pick a card's ✎ and it opens into its form right where it was (a list card opens just that item); pick a chip in the bar to edit a whole list or block, or **+** to add one. Nothing is deleted without a second click. Readers never get any of it.

- **Every field of every tab is editable** from one table: states, the seven scales and technology; purpose, founders, settlers, founding stages, myth, name, chronicle, eras, landmarks, lost things, the record and its evidence; government (offices, rulers over time, laws), factions, figures, unrest, society, knowledge, military; ties, blocs, envoys, hostages, agents, borders, routes, migration, reputation; resources, the wider economy, debts; beasts; secrets, rumours, questions, hooks, foreshadowing, sealed places; what-ifs. Plus the **founding model** switch.
- **Pickers:** seven-option chips for the seven-sets (and multiple for wards), a 7-dot clicker that shows the step name, a **timeline picker** (event title, "since the start", "ongoing"), place, character and secret pickers you can also type into, chip lists, one-per-line lists and repeatable rows.
- **The reader gate:** every item readers can be held back from has *Hidden from readers* and *Reveal in Ch*; the author-only fields (secret goals, truths, fears, leverage, real reasons…) are marked ◆ author.
- **Saving:** a saved tab is yours, so Merge no longer replaces it (the form says so while a tab is still a draft). Each save keeps the tab as it was: **Undo** in the bar, or Ctrl+Z (last 30). Esc closes a form without closing the entry.
- **Approving drafts (3.2):** every tab that is still Claude's draft shows a ● on the tab rail and an **Approve tab** button in its header; an approved tab says **Approved** with *Mark as draft* to put it back. *Approve all (n)* in the Edit bar approves every draft tab of the place. Approving changes no text, and each approval is an undo step. The places index has a **draft filter** (author only: has draft tabs / all tabs approved) and each row says how many draft tabs it has. An approved tab is never replaced by Merge.
- **The sheet (3.2, layout L):** the **▦ Sheet** chip in the Edit bar shows a list as one row per item (name and up to two more simple fields, then Hidden and Reveal). Pick rows, then **Reveal in Ch __**, **Hide**, **Show now** or **Delete**, edit cells in place, and **Save sheet**: everything you changed is one undo. A list with no Hidden flag (Intrigue lines) is hidden until it has a reveal chapter, so *Un-reveal* clears the chapter. A partial edit keeps the rest of a record (editing `goals.public` keeps `goals.secret`).
- **Checked:** opening and saving every record in the six drafted places with no change reads back identically (2,039 fields), plus 48 real clicks (edit, add, delete, validation, rows, the timeline picker, undo, Esc, the reader seeing none of it).

## Site Encyclopedia: the reader gate and the published snapshot (assets/epitaph-sites.js `forReader`, epitaph-publish.js) — step 2.4

The published file now carries all seven tabs of every place readers have reached (snapshot schema 3), already gated, and the book's **Reader view** shows exactly that, through the same function.

- **What a reader gets:** dated things follow their dates (a ruler, law, faction, tie, chronicle line, founding stage, era or resource appears once its event is revealed; an end they haven't reached shows as ongoing); anything `hidden` or carrying a `revealedIn` waits for that chapter; an Intrigue line appears only once its own reveal chapter is reached; a character is named only once introduced.
- **Never published:** scenarios, drafts, agents, corruption, secret goals, fears, leverage, relationships, who wants a tie to fail, a tie's real reason, the truth behind an official story, evidence, setup and payoff notes. These keys are left out of the file, not blanked.
- **A held-back event holds back what hangs on it:** if the builder withholds an event (its title names something unreached), nothing dated by it is published either, so the event's id can't leak through a state or a founding stage.
- **Hold a block back** with `hidden: true` or `revealedIn` on purpose, settlers, myth, name, the government's prose, society, knowledge, military, or the economy's prose; the drafts mark the ones that would give a secret away.
- **Drafting markers** like "(suggested)" and "(a guess)" are stripped from published text.
- `tools/check-snapshot.py` has its own list for sites (so `secrets` and `knowledge` are fine as site tabs) and checks that no hidden faction, secret goal, secret tie or unrevealed Intrigue line is in the file. It also no longer mistakes a character's `weight` stat for an item field.

## Site Encyclopedia: a place's entry in the book (assets/epitaph-site-entry.js, epitaph-dither.js) — step 2.2

Click a place in the book's Site Encyclopedia (`opse`) and its entry opens over the index: seven tabs down the left page (Overview · History · Domestic · Foreign · Economy · Beasts · Intrigue) and a **dither map** on the right page above the terminal. Built from the round-4 mockups.

- **The map** is drawn flat from the Atlas's own heightmap (the same projection, so places sit where the 3D map puts them): dot size is height, teal is land the sea took. Each tab picks its zoom: the **world** (Foreign: ties as arcs, coloured by kind; Intrigue: where rumours spread), the **region** (Overview, Economy with numbered resource pins, Beasts), or the **founding model** (History, Domestic): a stacked contour block you can turn by dragging or with the arrow keys, with landmark or faction pins and the seven founding stages under it. Only places with a model switched on get one (the statue sites by default); others show their region.
- **◆ markers** on factions, figures, landmarks, the record and resources point at the secrets and rumours pinned to them; clicking one jumps to that line in Intrigue.
- **Readers** see only what they have reached: states, ties, rulers, chronicle lines and founding stages follow the timeline; hidden factions, agents, covert ties, truths and what-ifs are author-only; an Intrigue line shows once its reveal chapter is published. The author sees everything, with what readers can't see dashed.
- "◂ All places" or Esc goes back to the index. Outside the encyclopedia, place links still open the Atlas.
- **In the story (Overview tab)** is derived, nothing is typed in: the chapters set here, who was here (arrived, left or still there, and why, from their objective that chapter, † if they died here), and the timeline's moments set at the place. It reads each character's per-chapter location, the same data the map's sword trails use. A reader only sees stays that began by their chapter, an end they haven't reached shows as "now", and a moment appears once its chapter is revealed. The author sees all of it, with what readers can't see dashed.
- **Intrigue links (2.5):** ◆ markers now sit on ties as well as factions, figures, landmarks, the record and resources, and a record's evidence points back at the secrets it supports. A secret shows its evidence, related secrets (click to jump), the place it unlocks and the question it answers; a question shows the secret that answers it. The Intrigue map has a **chapter slider**: slide to a chapter and each rumour appears when it starts and spreads only as far as it had by then, with its origin ringed. These links, evidence, related and answers are author-only; readers get only revealed lines.
- **Dossier knowledge link (2.6):** a character's secret can point at a Site Encyclopedia secret. In the Knowledge editor a secret line takes an optional fourth column (`Secret | knows? | Known by | secret:aurelia/cell`), and a picker under the box sets it for the line you are on. The Dossier keeps what the character believes in their own words; the link is only a pointer. The secret's entry then shows **Known by** (who carries it in their file and the chapter they first know it: their own first "yes", so nothing is typed twice) and **Could be found by** (characters who stood where it can be found before they knew it: a prompt, not a rule). The character's knowledge tree labels a linked secret with its place. Author only: the Dossier's secrets are never published.
- **Setup → payoff check (2.7), Chekhov's gun:** the Dossier's Checks list now reports, across every place, what is planted and never paid off (a secret, foreshadowing, or a what-if's warning signs; information), what pays off with nothing planted before it (a secret, or a what-if written into a chapter; warning), and what is paid off before it is planted (warning). A secret's evidence counts as its setup (the chapter the evidence turns up in, earliest first) when it has no setup of its own. Nothing is checked until you set a setup or payoff chapter, so an empty entry stays quiet. A dropped what-if with warning signs already planted is a warning. Each place's Intrigue tab shows its own part of the same list.

## Site Encyclopedia: schema v2 (assets/epitaph-sites.js) — plan: `docs/plans/site-encyclopedia.md`, step 1.5

A place's record now has seven tabs: **Overview · History · Domestic · Foreign · Economy · Beasts · Intrigue** (plus what-if `scenarios`), as laid out in `docs/plans/site-schema-v2.md`. Nothing you could see changes yet: the pages that show the new tabs come next.

- **Your old entries upgrade themselves.** The first time the page loads, each place is mapped over without loss: states → Overview, the rule → Domestic (laws become dated lines), alliances → Foreign ties (each gets an id), resources → Economy (each gets an id), founding stages → History. Draft flags follow. The old store is copied once to `epitaph-sites-backup-v1` the first time anything is saved.
- **New 7-sets** (exactly seven each): motives, faction kinds, ways a tie ends, beast temperament, social shape, kinds of ward, rumour intent and scenario trigger kinds. Four new 1–7 scales: technology, faction strength, resource importance and scenario likelihood.
- **Founding model switch** (`EpitaphSites.hasModel`): on for the statue sites by default, off elsewhere, and the author can switch any place.
- **Merge updates drafts (step 1.6):** for places you already have, Merge now also replaces encyclopedia tabs that are still Claude's drafts, and lists them by place and tab before you confirm. A tab you have saved is never touched. This is how the v2 drafts of the six statue sites come in (a private file in the vault, never in the repo).
- Export, Import and Merge still work with old backups. The index, the Checks list and the published snapshot read the new shape; the snapshot readers load is unchanged (checked byte for byte against the old one), and the new tabs join it with the spoiler gate (step 2.4).

## Item system (assets/epitaph-library.js, epitaph-item-fields.js, epitaph-marks.js, epitaph-states.js) — plan: `docs/plans/item-system.md`

Items now carry what the author's Items page describes: a rank and tier, up to three tracks of states, a history, and marks with their own fields. Everything below is built; what is left is listed at the end.

**What an item has**
- **Rank** (Soul, Host, Ward, City, Dominion, Face, Planet; no Realm) and **tier** (Mundane 1–3, Transcendent 4–6, Divine 7). Rank follows the item's *active* bindings, so it drops when a state loses the binding that gave the reach (Observance: Planet while Connected, Soul at No Signal). A rank sets the lowest tier allowed; a tier below it is locked in the editor and flagged by the Checks.
- **States** in up to three **tracks**: Item (its condition), Usage (what part of a process it is in) and a third you name (Connection, Hunger…). Up to 7 states each, each with a colour; a track can be **one-way**; each has a **normal state**. A chapter's copy of an item picks one state per track.
- **Origin** (a place, none, or unknown), **how it came to be**, a dated **history** (era, a year that can be far back and approximate like −4219 ≈, a chapter, who held it, the states it was in), and a **W.I.P** flag. Weight, appearance and maker are saved but switched off (`OFFLINE_FIELDS`).
- **Marks by kind:** a **binding** has a Reach (rank); a **blessing** has Price, Terms, Breach and Lasts until; a **curse** has a Type, a Cause and three **stages** (Awakening, Fluctuation, Stabilization, after an initial state) that you name and describe yourself. A person takes blessings and curses; an item takes bindings and curses. The old Cost and Ends text moved into the new fields without loss.

**Where you see and edit it**
- One set of fields for editing items (the book's Library view and the Atlas drawer) and one mark editor everywhere. The inventory picks a state per track. Years display like the timeline ("Before Epitaph · ≈ Y −4,219").
- The inventory monitor shows the rank now (and what it can reach), tier, W.I.P and a curse's stage ladder, with a short animation when you switch items. The book's Relic vault and Holder web show states and rank; the item log includes the item's history and curse stage changes. The Powers page has an **Items** section. An item's origin place is a link (the map today, the encyclopedia entry later).
- **Checks** warn about a tier too low for the rank, a curse's stage going down, a person's curse disappearing, a one-way track going back (in chapters and in history), and note a blessing on an item or a binding on a person.

**What readers see**
- The published copy carries an item only once a published chapter has revealed it (`reveals:`), never a W.I.P item. Origin story needs `<Item>: origin`, pre-story history needs `<Item>: history`, a single mark can be revealed as `<Item>: <Mark>`. Never published: notes, weight, appearance, maker, a blessing's terms, a curse's type or stage text.
- Rank, states and marks follow what the story has revealed **so far, for as far as the reader has read**: until you publish the chapter that reveals God's Eye, a Connected Observance reads Rank 1 · Soul; afterwards Rank 7 · Planet, whichever chapter's version is open. `tools/check-snapshot.py` double-checks it all before you publish.

**Your data**
- Upgrades on first load, with a raw copy kept once in the browser first: Library v3 (`epitaph-library-backup-v1`, `-v2`) and Dossier schema 9 (`epitaph-character-profiles-backup-v9`).
- **Merge can update items:** Data → Merge → tick *Also update items that already exist*, untick any you want to keep; your Library is saved first (`epitaph-library-backup-before-merge`). Everything else in Merge still only adds.
- Your Items page, converted, is a Merge file in `Site work/files/epitaph-items-converted-2026-11-21.json` (not in the code) with a notes file of every choice made.

**Storage for free creation (Phase 6, step 6.1):** the Library can now hold a shared list of marks and a list of prospective skills (author-only, never published, saved with Export, added by Merge). A mark on a person or item can be a copy of a library mark and remembers where it came from. The screens for them come next.

**Skill prospects (steps 6.2, 6.3):** type **opsp** (or use the new "Skill prospects" link) to open a board of skills with no character: add, edit, search and filter them, give each a private note. They are only for you. **Assign to a character** moves a prospect onto one of their chapter versions after checking that version's rules (the type lock, the true-name caps, a locked chapter, name clashes, and the skills it grows from, which can move with it). Below it, **Who could take it** lists every character: whether the rules allow it, how much room their true name leaves, and hints (your note names them, shared words with their concept, a corrupted prospect for a Twisted character); **Use** fills in the assignment.

**Mark library (step 6.5):** blessings, curses and bindings you use again can be saved to a shared library ("Save to the library" under any mark) and copied onto people and items ("Add from the library" in every mark editor). A copy shows whether it still matches its library mark and can be updated from it. Type **opmk** (or use the "Mark library" link) for a board that lists every library mark with all its copies, who holds each one and at which curse stage, and has **Update all copies**.

**Chapters and skills (step 6.6):** a chapter can list the skills it shows in a `skills:` property. The Checks warn when a **canon** chapter names a skill that is still only a prospect (assign it to a character first), and only note it while the chapter is a draft. The sync tool copies the property; the Chapter Template and Chapter Pipeline note have it.

**Not built yet:** the place entry's "items made here" list (needs the Site Encyclopedia entry view), the Creature Log link for items that are organisms, and prospective skills with a shared mark library (item plan Phase 6).

Scripts: Library `?v=19`, marks `?v=8`, state editor `?v=3`, item fields `?v=5`, checks `?v=11`, publish `?v=6`. Tested in Node (Library and marks 32 tests, checks 7, snapshot builder 10) and in the real pages in headless Chromium.

## Site Encyclopedia data (assets/epitaph-sites.js)

- **Author view and Reader view:** you see everything (places readers haven't reached are marked "Hidden from readers"); the button in `opse`'s tool bar previews what a reader sees at your chapter. In Reader view a place you haven't reached is not listed at all, nor are ties to it, nor text that names it.
- **`opse` is a real page now:** an index of every place on the map, grouped Storyborn · Voided · Fallen · Cities & others, with search ("who trades salt", a ruler's name) and filters for era, region, form of rule and status. It shows each place as it is at your chapter, so spoilers stay hidden: at Chapter 1 the secret ties aren't listed or searchable. Clicking a place opens it on the map for now; the 7-tab entry view comes next.
- **A character's race stays hidden from readers until a chapter reveals it:** list it in that chapter's `reveals:` (`Twisted`, or `Orin: Twisted`). Until then the Dossier shows no type, status line or type tags for them. The plain type "person" is never hidden.
- **The map is read-only for visitors too, and places appear when a chapter reveals them.** A story place (a fictional city or special site) isn't on a reader's map until a published chapter brings it up; real cities always are. Readers don't get the Library button, and can still pick up and throw swords (nothing is saved).
- **The Dossier is read-only for visitors:** no New, Edit, Delete, Chapters, Checks, Import/Export/Merge/Publish, no Edit buttons in the System sheet tabs, no Brief, and no Arc or Knowledge tabs. You still see and use all of it. New controls that edit should get the class `edit-only` (or be added to the reader-mode block in `index.html`).
- **Readers load the published copy, not their own browser.** In a visitor's browser every page now gets its data from `published/epitaph-data.js`, and nothing they do is saved. Your browser is unchanged. The file in the repo is the empty "coming soon" snapshot for now; to publish, download a new one with Data → Publish snapshot, run `tools/check-snapshot.py` on it, replace `published/epitaph-data.js`, and push.
- **Readers only see what a chapter has revealed.** A chapter reveals things by listing them in its properties: `characters:` (who appears), `moments:` (timeline moments), `world:` (places, as `Place = state`) and the new **`reveals:`** (items, marks and the like, by name). Nothing is revealed by default, and anything marked `open` is known from page 1. The encyclopedia's Author view says when readers get each place ("Readers see it from Ch 3", or "Not revealed yet"). Publish snapshot follows the same rule.
- **`tools/check-snapshot.py`** double-checks a downloaded snapshot against `chapters/index.json` and your private drafts before you publish it: run `python3 tools/check-snapshot.py ~/Downloads/epitaph-data.js`.
- **Publish snapshot** (Dossier → Data, author only): builds the read-only copy of your data that readers will load, cut at the last published chapter, with only the fields on an allowlist and any text that names a place or character readers haven't reached removed. It checks the finished file for leaks and downloads `epitaph-data.js` for the `published/` folder. Nothing is uploaded. Readers don't load it yet.
- **A tag on the left edge of every page** says which view you're in: "Reading" for visitors, "Author" for you. Click "Author" to preview what a reader sees (it becomes "Preview · reader"; click again to go back).
- **Author or reader (`assets/epitaph-mode.js`):** every page now knows whether it is open in your browser or a visitor's. Visitors are readers by default; open the site once with `?author=1` and it remembers you (`?author=0` turns it off). Your own computer (localhost, or a file) counts as the author automatically. The Author/Reader preview button in `opse` is only shown to you, and a reader can't switch to the author's view. This is a convenience, not a lock; nothing secret is published. The edit controls are not hidden from readers yet.
- **The lore drafts are no longer in the code.** The public files (`epitaph-sites.js`, `epitaph-timeline.js`) ship empty; your drafts live in a private file in your vault and come in with **Data → Merge** (once per browser you write in). Until you merge it, `opse` lists every place as "No entry yet".
- **Backups carry it:** the Dossier's Export now includes your site-encyclopedia and timeline edits (only what you changed). Import replaces them (a backup from before this leaves yours alone); Merge adds the places and timeline edits you don't have yet and lists them before you confirm.
- **Checks:** the Checks list also flags alliances or entries pointing at missing places, an alliance that ends before it starts, dates on events that aren't on the timeline, and beasts missing from the Creature Log (once it exists). A note counts the Era 1 places with no entry yet.
- **The schema you agreed** (`docs/plans/site-schema.md`): every place gets dated **states** (a place can be *standing*, then *erased*), each with a status and seven 1–7 scales: **Size, Hold, Stability, Supply, Defence, Secrecy, Written**. Plus its **rule** (7 forms, rulers with dates, laws), **alliances** (7 kinds, including *covert*, with start and end), **resources** (7 categories), **beasts** (7 relations) and **founding** (7 stages).
- **Drafts for the six statue sites** from the vault: Aurelia, the Temple of the Voided, the Hollow Reach, the Church of the Storyborn, Verdant Reach and the Forgotten Grove. All marked draft. The Church and Verdant Reach are thin because their lore is still open; no Beasts yet, because the lore has no Era 1 creatures.
- What a reader sees follows their chapter: a place's state, and alliances whose start or end they haven't reached.
- Nothing shows it yet: the `opse` page is still a placeholder.

## Shared timeline (assets/epitaph-timeline.js)

- **One history for the whole site** (`window.EpitaphTimeline`), the first step of the Site Encyclopedia (`opse`) and Creature Log (`opcl`) plans in `docs/plans/`. It holds the vault's Timeline.md as drafts: 37 moments from before Epitaph through Era 0, the siege and Era 1, with years counted from the siege (Y 0) and links like `place:aurelia` or `char:Orin`.
- **7 kinds:** Myth, Gods, World, Place, People, War, Story.
- **Order:** era, then moments before the story (in story order), then moments with a chapter (by chapter), then story moments not given a chapter yet. A chapter in `chapters/index.json` that lists a moment under `moments:` gives it that chapter.
- **Spoilers in one place:** `isRevealed(event, chapter)`. Chapter moments show from their chapter on. Twists marked `secret` stay hidden until a chapter reveals them (`revealedAt`) or the reader is on the latest chapter. Story moments with no chapter yet only show at the latest chapter. `view()` swaps a hidden moment for a "?".
- **Reader position:** `readerChapter()` / `setReaderChapter(n)` under `epitaph-reader-chapter` (empty = the latest chapter), with `onReaderChange(fn)` for this tab and others. Nothing uses it yet; the map and book are wired to it next.
- **The map and the book share your chapter now:** the map's chapter slider and the Library's chapter ruler start where you left off and move together (also across tabs). Picking the newest chapter saves "latest", so new chapters aren't hidden. The Era 0 rewind doesn't change it.
- **Links** (`assets/epitaph-links.js`, `window.EpitaphLinks`): one format, `place:<id>`, `creature:<id>`, `char:<id or name>`. Anything with `data-ref="place:aurelia"` opens on click. Places open on the map (`atlas-3d.html?place=<id>` flies there), characters in the Dossier; creatures wait for the Creature Log. The encyclopedia pages will take these over later.
- **Two new book commands:** `opse` (Site Encyclopedia) and `opcl` (Creature Log), also `open site encyclopedia` / `open sites` and `open creature log` / `open creatures`, and links in the storybook's list. They open placeholder pages for now; `help` lists them.
- Your edits are stored under `epitaph-timeline` on top of the defaults (`save`, `remove`, `reset`). Loaded on the Dossier and the map; no screen shows it yet.

## Map: pin close-up (atlas-3d.html)

- **Click a sword** on the map to open a big, turnable close-up of it. Drag still picks the sword up. Esc or Close goes back.
- **Each character gets their own pin design** (`assets/atlas3d/pins/pins.js`), all built on the jade greatsword model:
  - **By type:** Storyborn gold with drifting glyphs and a halo · Person steel with name rings · Godling plane-glass · Voided a sword-shaped hole · Fallen broken · Unbound through the barrier · Primordial stone.
  - **By character:** Orin, Nera, Yona, Gaia and Val have their own versions. The type comes from the Dossier (`race`); the five names win over the type.
- **The close-up copies the ground the sword is in** (`assets/atlas3d/closeup.js`, region read from the map's elevation data):
  - plains, hills, mountains, snowfield (far north and south), impact mountains, the crater
  - **Coast:** the tip in the surf, the rest above the water
  - **At sea:** a character en route across open water rides in a small boat with the sword in its deck
  - **Under the sea:** open sea; land the +60 m sea took shows sunken ruins
- **Places with a built site** (Aurelia, the Hollow Reach) open that site instead, with the sword standing in it at giant size (`?embed=1&pin=…` on the site pages). "Open the site" leaves the map for the full site.
- The map pauses while the close-up is open.

## Map: sword pins (atlas-3d.html)

- **The 2D Atlas is gone; the map has what was useful in it.** The **Library** (add, edit and delete your countries, places and items, with the tap-to-pin mini map, delete checks, reassigning and item history) is now a drawer on the map (`assets/epitaph-library-ui.js`); "Show on map" flies the map there. Clicking a name in the Characters list opens their **record** (where, state, objective, chapter trail, a link to the Dossier); characters with no location are listed as **Not on the map**. Links that went to `atlas.html` (the Dossier's Map button and item links, Muses, Powers, Read) now open `atlas-3d.html`, with the same `?char=` / `?item=` deep links. Continuity checks stay in the Dossier. `atlas.html` and `assets/terrain.js` are removed.

- Every living character stands on the map as a jade greatsword stuck in the ground (`assets/atlas3d/pins/greatsword.glb`, about 2,900 polygons; rebuild with `tools/map/greatsword_pin.py` in Blender). The dead keep the grave cross.
- **Drag a sword** to pick it up: it strains, pulls free in a puff of block dust and rises on a **golden thread** tied to the cursor. It hangs by its pommel and swings like a pendulum, so fast moves make it sway. **Scroll** to let the thread out (the sword drops lower and swings slower and wider) or reel it in (the map doesn't zoom while a sword is held). On release the thread snaps back to the cursor. A click without dragging still focuses the sword.
- **Throwing:** on release the sword keeps its momentum (hand speed plus swing) and flies under gravity, spinning, its point turning into the direction of travel like a dart. It sticks in at the angle it hits, leaning at most 55°, and keeps that angle afterwards (remembered per character in `epitaph-map-pin-poses`).
- **Magnetic statue sites:** places listed in `EpitaphWorld.STATUES` (`assets/epitaph-world.js`) pull swords in. Their rings light up while you carry a sword. Within a short reach (`SNAP`), the carried sword is pulled toward one and a thrown one bends toward it in flight, then snaps onto the site and stabs in with a wobble.
- **Anywhere else, the sword stays where it lands.** Near a map place (within `NEAR_PLACE`) the character is **en route** to it (label `Name → Place`); otherwise their location is **unknown** (label `Name · ?`). These are saved as `{ status: 'unknown' | 'enroute', lat, lng, toPlaceId?, countryId? }`, which `EpitaphWorld.resolve` reads as "Unknown location" / "En route to …", so the Dossier shows them too. **Esc** while carrying puts the sword back where it came from.
- **Impacts:** when a sword hits the ground, the block columns around it hop up and fall back with a small bounce, in a wave that rolls outward, and the camera jolts. Harder hits lift higher and reach further; a slanted throw makes the wave lopsided, bigger in the direction the sword was travelling. Chapter-travel landings make a medium ripple. Tune it in `IMPACT` at the top of the impacts section in `assets/atlas3d/epitaph-map.js` (`lift`, `reach`, `speed`, `gravity`, `skew`, `shake`). Off when the system asks for reduced motion.
- **The Forgotten Grove** (from PR #30) stands as the cracked Fallen grave and is a snap site like the others.
- **Graves, simpler:** the scabbards and the plinth are gone: a settlement is just its tombstone set into the ground, with the swords there standing upright in the ground in front of it.
- **Graves, blended:** the settlement graves are smaller, matte, and coloured from the map's own palette (terrain land, high ground and rock tones; the faction colour only as a faint line on the plinth), so they sit in the terrain instead of standing out. The slots are gone: a sword arriving at a settlement gets a scabbard that rises out of the plinth (once per arrival) and sinks while the sword is carried away. The close-up shows the swords bare in front of a smaller grave.
- **Epitaph stones:** settlements stand as engraved standing stones on a plinth with sword slots (`assets/atlas3d/stones.js`): Storyborn white marble carved in glowing gold script, Voided black stone with a blank, erased face, Fallen cracked with its top knocked askew. Swords snapped to a settlement stand upright in its slots (the magnet aims at the next free slot; each sword keeps its slot in `epitaph-map-pin-poses`). The settlement close-up shows the stone with the swords in its slots. The block statues (`statues.js`) are removed; cities stay flat dots.
- **Quieter places:** so the swords stand out, cities are flat glowing dots on the ground and settlements are flat rings in their faction's colour. A settlement's block statue rises out of the ground while a sword is being carried (they're the magnet targets), when it's hovered, or when the map is zoomed in close, and sinks back otherwise. Hover and click work as before.
- **Voided statues:** Voided sites (the Temple of the Voided, the Hollow Reach) stand as the veiled angel with broken wings; Fallen sites will stand as the broken sword once there are any.
- **Storyborn statues:** Storyborn sites and settlements (the Church of the Storyborn, Verdant Reach, Aurelia) stand on the map as the block-built praying angel with its halo (`assets/atlas3d/statues.js`, kept from the markers work along with the Voided and Fallen statues). Swords stand a little further from place markers so they clear the wings (`PIN_GAP`).
- **More swords** (`assets/atlas3d/pins/pins.js`): **Vale** (the first Storyborn) has two states like Orin's seal: `read` (how much of his written destiny he has recognised; the verses light from the guard toward the tip) and `void` (his hidden Voided side breaking through as black erasure). Swords that need **both the name and the type**: Grisha / Chaos / Universe + primordial (a churning blade veined red, a crown of spires, a red eye), Sils + primordial (an absence that keeps coming apart and reforming), Antholonious + primordial (pale stone written in gold, breaking into drifting page fragments), Moinera + primordial (dream-opal that keeps changing shape), Lithia + primordial (blood red, dripping into a dark pool), Lithia + unbound (her god form, wounded: cracked and bound with stained wraps, coming down through its barrier). No god swords for Antholonious (split), Sils (sealed) or Moinera (the dreamscape).
- The map now turns on clipping, so Unbound swords are cut where they pass through their barrier (they showed both halves whole before).
- **Sword shapes** (`assets/atlas3d/pins/swords.glb`, built by `tools/map/sword_shapes.py`; same layout as the greatsword, so every effect works on every shape). Named characters now carry their own shape: Nera a falchion, Yona a stiletto, Gaia a zweihänder, Val an executioner's sword, Vale a sabre, Grisha a flamberge, Sils a khopesh, Antholonious an estoc, Moinera a scimitar, Lithia a gladius (broken off for her wounded god form). Orin and the seven type swords keep the jade greatsword. **Kept for future characters:** katana, rapier, sawback (`SPARE_SHAPES` in `pins.js`); a design picks a shape with `base(mats, 'katana')`.
- **Character weapons** (from the refs in the vault, `World Buildinig/Items`; original takes, not copies): Grisha a katana (red that churns like moving marble, a guard of black scales, his eye in the diamond pommel); Sils the Terminus Harvester (two black blades crossed like a grave marker, white crosses, blue streaks, still coming apart); Vale the Twin Serpents (a pair of curved blades, both carrying his Read / Voided states); Nera a technical scythe (Fallen steel, pulsing cyan panels, red accents); Moinera dual blades (two dark opal daggers joined by a sagging chain); Lithia a scissor blade (broken, wrapped and coming through its barrier for her god form). Two-weapon pins move as one for now; how they animate is decided once they're on the map. Freed shapes join the spares (`SPARE_SHAPES`).
- **Traced weapons:** Lithia's scissor blade, Sils's Terminus Harvester and Vale's Twin Serpents are rebuilt from their references: `tools/map/trace_weapons.py` traces each outline (holes included), stands it up at the pins' layout and paints a cleaned texture from the reference's colour areas (`tools/map/weapon_tex/`, not the reference images themselves); `tools/map/sword_shapes.py` turns them into bevelled solids in `swords.glb`. Their effects sit on top of the painted textures.
- Sils now carries only the long Terminus Harvester blade. Wounded Lithia's scissor blade is snapped like the Fallen sword: a jagged break, chipped edges, a slight lean, the lost tip lying beside it (`scissor_broken` and `scissor_tip`, cut into the traced outline).
- **Moinera's chain is loose:** the chain is simulated (points held a link apart, with gravity) and her second dagger hangs on its end. Picked up, thrown or flying to a new chapter, the second dagger swings freely and the chain swishes; set down, it settles back beside the first. Pins with loose parts get `setFree(true/false)` from the map.
- **Vale's Twin Serpents coil:** held, the two blades part and spiral round each other like two snakes; fast moves widen the coil and they trail behind. Set down, the first straightens into place and the second drops in beside it a beat later.
- **Era switch:** from a later chapter, clicking Era 0 first rewinds the chapter slider from where it is (not from the newest chapter) one chapter at a time down to the first, the swords flying back each step (about 2.5 s in all), then switches. Clicking Era 0 then sinks every sword into the ground at once, one after another with a puff of dust, instead of waiting for the era wave and popping out. Vale's sword stays: he was sent back into Era 0, so it's the one sword drawn there. Back in Era 1, each sword rises slowly out of the ground as the era wave passes its place and hangs in the air; once the wave is done and every sword is up, they all drop in together (`ERA_RETURN = 'staggered'` drops each as soon as it's up instead).
- **Zoom between views:** Epitaph → Earth (clicking the Earth patch or the 02 button) dives onto the Earth patch, fades, and the Earth board pulls back from close in. Earth → Epitaph pushes in on the board, fades, and the planet pulls back out from its Earth patch. Instant when the system asks for reduced motion.
- **Beyond Earth:** a sword dropped on the planet's unmapped lands or seas, or the board's open sea, now stays where it lands. Those spots have no Earth latitude/longitude (they used to be forced onto the nearest Earth spot, so the sword jumped), so they're kept as map coordinates `{ status: 'unknown', u, v }`, shown as "Unknown · beyond Earth". The planet shows them anywhere; the board shows those inside its rectangle. The close-up picks unmapped land or open sea for them.
- **Crowded close-ups:** clicking a sword brings any swords standing right beside it into the same close-up (the clicked one in the middle, the others around it, all named in the header).
- **Settlement close-ups:** clicking a statue site opens it with every sword snapped there this chapter (a site inside a city counts for the city, e.g. the Temple of the Voided in Aurelia). Aurelia and the Hollow Reach open their built site with each giant sword at its own spot (`?pin=a,b&ring=c1,c2`, `placeGiants` in `pins.js`); the others show their block statue in the middle of the terrain scene with the swords around it. It no longer jumps straight to the site page; the close-up has "Open the site".
- **Chapter travel:** changing chapter (scrubber or ◀ ▶) flies each sword from where it stood to its place in the new chapter: it pulls free, arcs across the map point-first, dives in and wobbles. Swords leave one after another; a character new to the story drops in from above.
- **Saved to the Dossier:** a drop sets `location = { countryId, placeId }` on the chapter version shown (the latest, or the one at the chapter on the scrubber). An open Dossier tab updates itself. Locked (canon) chapters refuse to move with a wiggle and a note; demo pins move but are not saved.
- Add a statue site by adding its place id to `STATUES`. The list starts with Aurelia, the Temple of the Voided, the Hollow Reach, the Church of the Storyborn and Verdant Reach.

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
- `atlas-3d.html?item=<id>` opens an item in the Library; `?char=<id>&ch=<n>` opens a character's record at a chapter (these were `atlas.html` links before the 2D Atlas was removed).

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

## Knowledge tab tree, and moves that follow the picture

- **Shared navigator** (`focusTree` in index.html) now drives both the Skills and Knowledge tabs. Every move is a camera move toward the node you picked: it slides into the middle from where it was, nodes that stay slide (and resize) to their new places, newcomers arrive from that side, nodes left behind slide off the other way, the starfield drifts the opposite way and the readout comes in from the same side. Arrow keys pick whatever sits in that direction.
- **Knowledge tab**: the character at the root; branches Facts / Secrets known / Kept from them; each entry under its branch; other people who know a secret under the secret (from “known by”; a name that matches a character offers “Open … dossier”). Facts amber, known secrets teal, kept secrets red and blacked out (click to reveal in the readout). Readout shows “since CH n” (the first chapter version containing the entry) and who else knows. Gauge under the left column: secrets known / total.
- **The book** (`opl`, `ops`): picking a tile or skill glides the board so it lands in the middle; in the skill tree the arrow keys pick the nearest skill in that direction.

## Sites: Aurelia (`sites/aurelia.html`, 2026-11-13)

The first site: a 3D diorama of a single place, opened from the maps.
- **Opening it:** click **Aurelia** on the Epitaph map's Earth board (Era 1), or press **OPEN SITE** in its location record on the Atlas. Places with a site are listed in `EpitaphWorld.SITES` (`assets/epitaph-world.js`).
- **What's there:** Kansas, on a low limestone bluff above the Solomon River valley. The Cathedral of the Storyborn, the Ruler's Tower (no doors), the Chronicle, Orin's home, the Seminary across a bridge, and Nera's Voided lab cut away in the north slope, with a secret passage to a hatch in the prairie. Below are the river, the wharf, the lower town and a funicular.
- **Before / After the Calamity:** the city is erased outward from Orin's home, the ground is left smooth and black, and Nera stands at the hatch. Signal / Paper palettes, labels on or off, and **← Map** goes back.
- **Temple of the Voided** under the prairie: the lab's secret passage ends at a hatch, and stairs go down into a black gothic hall with violet light seams. Its centre is a **relay station**, a split black pyramid whose beam rises to a small vent in the prairie. The model's base is deeper and cut open on the north side so you can see in. After the Calamity, Nera is safe in the temple.
- Code: `assets/sites/aurelia.js` (three.js 0.170 from jsDelivr). Links: `?view=lab`, `?view=temple`, `?after=1`, `?theme=paper`.

## Epitaph map (`atlas-3d.html`, 2026-11-13)

Replaces the old Atlas 3D (Relief / Globe / Shattered). Same address, so the Atlas's **3D** button still opens it. Lore it follows: vault `Exploratory Ideas/Lore/Epitaph Map.md`.

- **01 Epitaph, the planet** (the old Globe look): a globe of hex columns. **Earth is a small round island on it** (not to scale), with a dashed shoreline; click it to open the board. The rest of the planet is **unmapped** (faint placeholder land). Era 1: **The Binding** wraps the whole planet as a shell of script, and a glow marks the strike.
- **02 Earth, the board** (the old Shattered look): real Earth in blocks from real elevation, laid out as **one round island**: the main continents (Equal Earth, seam in the Bering Strait), **Antarctica whole and round** below them, and **invented continents and islands** in the open water, on a generated sea floor (shelves, ridges, trenches, seamounts). Nothing is cut by a seam or touches the shore.
- **Era 0 / Era 1** switch: Era 1 rebuilds both views in a wave from the strike point: the gods went straight through Antarctica, so a stepped **crater** runs down to **Blankslate** (glowing seal), ringed by **impact mountains**; the sea is **+60 m** (sunk land in teal); the **floating island** and loose blocks hang over the crater.
- **Places follow the lore**: Era 0 shows real cities only (no fictional ones). Era 1 drops Angel and Demon sites, keeps Storyborn, Voided (marked hidden) and Antholonius sites, keeps Aurelia and Verdant Reach as Era 1 settlements, and draws real cities that sank as teal ruins. **Characters only show in Era 1** (the story's chapters are set there); the chapter slider, trails, † markers and the Characters list work as before.
- Kept from the old Atlas 3D: orthographic camera, ink outlines (inverted hull), toon blocks, soft shadows, Signal / Paper palettes, hover details, click to fly. View, era and palette are remembered per browser (`epitaph-map-prefs`). Old links (`?view=globe|relief|shattered`) still open the nearest view; `?view=planet|earth&era=0|1&theme=crt|paper` also work.
- Code: `assets/atlas3d/epitaph-map.js`. Data: `assets/atlas3d/earth.png` + `earth.json`, built by `tools/map/build_circle.py` (AWS Terrain Tiles elevation + Natural Earth land in `tools/map/geo.js`; seed 57 sets the invented lands). Removed: `assets/atlas3d/atlas3d.js`.

## Hero art: typography and 3D renders replace the animated figures (2026-11-12)
- The retired full-body figures (`assets/epitaph-figures2d.js`) are gone. Each chapter now has **Hero art** (`snap.heroArt`):
  `''` = generated portrait (spike figure etc.), `'auto'`, `'3d'`, or a design key.
- **Sils, Moinera, Antholonious, Universe** (matched by name): a looping Blender render (`assets/renders/`) or one of their flat designs.
  Chapters that used an old figure (`snap.figure2d`, kept as legacy data) now show the 3D render.
- **Everyone else**: the Storyborn designs (Gyre, Orbit, Coil) and the Voided designs (Helix, Walls, Timelines).
- New character field **Race** (`char.race`: `storyborn` | `voided` | ''), separate from faction. *Hero art: auto* picks the race's design.
  "Voided" means the Era 0 survivors for now; the name may change (vault: Exploratory Ideas/Lore/The Two Voided). Rename it in `RACES`.
- Designs live in `designs/type-lab` (sources) → `python3 designs/build-type-asset.py` → `assets/epitaph-type.js`.
  Blender scenes live in `designs/blender` (see its README).

## Aurelia: first-person walk-throughs (13 Nov 2026)

- **Walk inside** (Aurelia header) starts a first-person story walk: drag to look, scroll or W/S to walk, Space/→ for the next stop. Chapters: Archive, Galleries, Way down, Lab, Quarters, Bunker, Passage, Temple, Prairie.
- Interiors are **bigger on the inside**: the diorama stays as it was; going through a door fades into a full-size interior built away from the model (same scene, far off-map).
  - **The Archive** (built by Nera's family): rotunda, three galleries round a well, radial stacks, desks, timber booths, the winged Storyborn statue, feat-script fronts, giant faces, an orrery, weapon caches, and the statue's pedestal as the secret door with the void detector in its frame.
  - **Nera's lab**: machine arm over a Storyborn specimen arm, relay and panel, quarters, vault hall, bunker; the Archive's spiral comes down through the ceiling.
  - **Passage and Temple of the Voided** (also Nera's greater lab): the station, six relays, console, surgical bay, tanks, data stacks, two void gates, spiral up to the hatch.
- Diorama changes: bigger lab slice, the Archive rotunda on the north ring, temple rebuilt, hatch over the temple's spiral stair.
- Debug: `?walk=<chapter>&stop=<n>` or `#walk-<chapter>`; `window.__walk`.

## The Hollow Reach: the Voided capital (13 Nov 2026)

- New site `sites/hollow-reach.html` (script `assets/sites/hollow-reach.js`), opened from the Hollow Reach pin on the map (Germany, 51.5N 9.5E).
- **Model / Blocks** switch in the header:
  - **Model**: the Aurelia style (flat-shaded pieces with ink outlines).
  - **Blocks**: columns like the Earth map, made from the model by a top-down height pass (96 × 96 cells), so the two always match. Bevelled columns, white outlines (dark ink on Paper), and a soft colour gradient blurred across the city.
- The city: a round pit with smooth black walls in the forest; Val's palace on its floor beside a lake; the capital's station on an island with six relays; the arcade ramp down the west wall under leaning fins; the drill yard; on the surface the arena, the Assembly, barracks pods, quarters, relay masts and obelisks; cut open on the south-east, the gate hall (three void gates) over the gifting chamber.
- **Walk inside**: three chapters, interiors bigger on the inside.
  - **Descent**: from the forest edge down the arcade to the palace.
  - **Palace**: the Hall of Monarchs (ten portraits, the same face, more blackened each generation), then the window hall, where Val stands at the window.
  - **Below**: the ribbed tunnel, the gifting chamber and the gate hall.
- Debug: `?style=blocks`, `?view=below|palace`, `?walk=<chapter>&stop=<n>`; `window.__walk`.

## The Hollow Reach, draft 2 (13 Nov 2026)

- **Much bigger city.** The Hollow is a pit about 84 across, stepping down through four black walls to a floor 24 below the forest:
  - brutalist housing blocks (the hives) on every step
  - four colossal ribbed towers (the Spines) with bridges to the rim
  - a monumental stair (the Descent) from a gatehouse in the forest
  - on the floor: the Assembly, the arena, a drill yard, and the lake with the station on its island
- **Below**, cut open on the south-east in four levels: the gate hall, the gifting chamber, barracks and mess, and the station's conduits.
- **Val's palace** has three floors (5 bedrooms, 4 baths), all furnished:
  - **Ground floor:** grand hall, Hall of Monarchs, throne room, war room, the Ledgers of Intervals (library), kitchen, dining
  - **First floor:** the dressing room, master bath and bedroom; Vale's room, the nursery, guest rooms
  - **Top floor:** the clocks stair, the study with two chairs, the regression chamber, the window hall
- **Below** is furnished too: barracks, mess, armoury, gifting chamber, gate hall.
- The walk has six chapters: Descent, Palace, Master's rooms, Bedrooms, Top floor, Below.
- **Blocks is now the Narrative view**: the place as the Scribe sees it, with the same rules on every site.
  - **Colours:** Nothing is purple, Story gold, Reality red, Imagination pink.
  - **Height:** the place itself, raised by how much story is written there.
  - **Black** means erased; **blank** means unwritten (the Fallen).
