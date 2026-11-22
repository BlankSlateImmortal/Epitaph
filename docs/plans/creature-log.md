# Creature Log — action plan

Command: **`opcl`** (also `open creature log`, `open creatures`), opened from the book's terminal like `opl` / `ops`.
Sister plan: [site-encyclopedia.md](site-encyclopedia.md). **Phase 0 (shared timeline, reader chapter, links, commands) lives
there**; do it once, for both.

## Purpose (from the user, 2026-11-17)

Not a copy of the Character Dossier. An **in-depth, exploratory evolutionary log**: how the ecosystem developed and how its creatures
**mutated before the main story**. It also tracks each creature's abilities, movements and some lore. It's a place to explore,
made to show how deeply the world has been thought through.

## Rules this plan follows

- **Always 7:** every scale or list has exactly 7 entries (memory `epitaph-always-seven`). A creature page has **7 sections**:
  Lineage · Mutations · Anatomy · Abilities · Range & movements · Behaviour & lore · Field notes. Scales (threat, intelligence,
  adaptation…) have 7 steps, each tied to a rule; confirm the scales with the user before drawing them.
- **Exploration over lists:** the main view is the **Tree of Descent**, not an index. The index exists but isn't the front page.
- **Discovery, no spoilers:** a creature or branch the reader's chapter hasn't revealed shows as a silhouette with "?"
  (shared reader chapter, plan 0.2).
- **Cause and effect:** every mutation names its cause, a world event on the shared timeline (the impact, the crater's radiation,
  the +60 m flood, the ice, the Narrative, the Void…). Nothing changes without a reason.
- **Lore first:** read the lore (vault `Exploratory Ideas/Lore/`, `~/Downloads/Epitaph/World Buildinig/`) before drafting. Defaults are
  drafts (`draft: true`) the user edits.
- **The site's patterns:** `window.EpitaphCreatures`, key `epitaph-creatures`, defaults and edits merged (like `epitaph-muses.js`), book
  styling and both themes, `docs/CHANGES.md`, versioned script tags.

## Status key

`[ ]` not started · `[~]` in progress · `[x]` done · `[-]` dropped (say why in the tweak log)

---

## Phase 0 — Shared foundations

- [~] **0.0** Done in the Site Encyclopedia plan (timeline, reader chapter, links, `opcl` command). Check it's finished first.

## Phase 1 — Data: the world's history of life

- [ ] **1.1 Epochs.** 7 epochs from before the impact to chapter 1 (for example: the old world · the impact · the burning · the
  flood · the ice · the settling · the story's eve). Each epoch is a span on the shared timeline, with the world events that drive
  change in it. *Done when:* the user agrees the 7 epochs and their names.
- [ ] **1.2 Biomes.** The biomes over time, matched to the map's regions (plains, hills, mountains, ice, impact mountains, the crater,
  coast, open sea, sunken land), grouped into 7 if they become a scale. Each biome has a start and end, and what changed it.
- [ ] **1.3 Schema.** `assets/epitaph-creatures.js`. Two record types:
  ```
  lineage node (a form on the tree):
  { id, name, parentId|null, epoch, appears, extinct?, cause: timelineEventId, mutation: { change, advantage },
    biomes: [...], silhouette?, draft }
  creature (a living form the story meets) = a node plus:
  { abilities: [{ name, does, counters, power: 1..7 }], anatomy: { parts: [{ name, note }], model? },
    range: { biomes, placeIds, migrations: [{ path: [lat,lng]..., season|epoch }] }, sightings: [{ chapter, placeId, note }],
    diet, hunting, breeding, names: [{ placeId, localName, belief }], fieldNotes: [{ author|charId, when, text }],
    scales: { threat: 1..7, … } }
  ```
  *Done when:* the user agrees the fields and the 7-step scales.
- [ ] **1.4 Food web.** Links `{ eater, eaten, epoch }` so the ecosystem view can draw who eats whom at any time; flag keystones and
  apex predators.
- [ ] **1.5 Defaults from the lore.** Draft one full lineage first, root to living creature, every mutation caused, to prove the shape.
  Then the creatures the story already shows. *Done when:* one complete lineage is approved by the user.
- [ ] **1.6 Storage, backup, checks.** Merge and export like the encyclopedia. Checks: a node with a missing parent, a mutation with no
  cause, a creature dated before its ancestor, a food-web link to a missing creature, an extinct creature sighted later.

## Phase 2 — The Tree of Descent (the front page)

- [ ] **2.1 Tree layout.** A pannable, zoomable branching tree (SVG or canvas): roots at the old world, branch points at mutations,
  living tips glowing, extinct lines ending in a fossil mark. Branch colour by biome or by cause (toggle).
- [ ] **2.2 Time scrubber.** A slider across the 7 epochs; the tree grows as it moves, and the epoch's events show beside it.
- [ ] **2.3 Branch points.** Hovering a fork shows the mutation, its cause and the advantage; clicking opens the cause on the timeline.
- [ ] **2.4 Discovery.** Unrevealed nodes show as "?" silhouettes; revealed ones fill in. A count shows how much of the tree is known.

## Phase 3 — Creature page (the specimen)

- [ ] **3.1 Lineage.** Its branch of the tree, with every ancestor form side by side, so the mutation steps can be seen.
- [ ] **3.2 Mutations.** Each change in order: what changed, what caused it, what it gained.
- [ ] **3.3 Anatomy.** A labelled specimen: an illustration first; a turnable 3D model later (the hard-surface, block or traced
  approaches from the sword pins; no faces, the user prefers objects).
- [ ] **3.4 Abilities.** What it can do and what counters it, with 7-step power; links to the Power systems page where it fits.
- [ ] **3.5 Range & movements.** A small map of its range and migration routes, and sightings by chapter (spoiler-gated).
- [ ] **3.6 Behaviour & lore.** Diet, hunting, breeding, and what each settlement calls it and believes about it (links to the
  Site Encyclopedia).
- [ ] **3.7 Field notes.** Short in-world journal notes from characters or scholars, dated, spoiler-gated.

## Phase 4 — The Ecosystem view

- [ ] **4.1 World over time.** The same scrubber on a small globe or the map: the crater cooling, coasts drowning, ice spreading
  (reuse the map's era data where it fits).
- [ ] **4.2 Food web.** Who eats whom at the scrubbed epoch; keystones and apex predators marked.
- [ ] **4.3 Cause-and-effect chains.** Readable chains ("the flood drowned the plains → grazers moved to the impact mountains →
  their predators grew climbing claws"), each step linking to its node or event.

## Phase 5 — Editing

- [ ] **5.1 Editor.** Add and edit nodes and creatures in the book: parent picker, cause picker (timeline events), biome and place
  pickers, and drawing migration routes on a map.
- [ ] **5.2 Approve drafts.** One click per field; a filter for what's still draft.

## Phase 6 — Links into the rest of the site

- [ ] **6.1 Site Encyclopedia.** The Range and lore sections link to places; places' Beasts tabs link back.
- [ ] **6.2 Map layer.** A "Creatures" toggle on `atlas-3d.html`: ranges, migrations and sightings at the reader's chapter.
- [ ] **6.3 Resources.** Creature-sourced resources (hides, venom, bone) shown on both sides.
- [ ] **6.4 Dossier.** Characters' encounters, and creatures tied to a character's powers, link both ways.

## Phase 7 — Finish

- [ ] **7.1 Mobile and keyboard.** The tree works by touch (pinch, drag) and keyboard; both themes.
- [ ] **7.2 Performance.** The tree stays smooth with hundreds of nodes; lazy-load the 3D specimens.
- [ ] **7.3 Docs.** `docs/CHANGES.md`, the help text, this plan's status.

---

## Which model (for Claude)

The user saves their weekly limit by running plumbing steps on **Sonnet** and switching to **Opus** only where judgment matters.
Check your model at the start of every resume.

**Opus steps** in this plan: 1.1 (epochs), 1.2 (biomes), 1.3 (schema), 1.5 (lore defaults), 2.1 (tree layout), 3.3 (anatomy and 3D specimens), 3.7 (field notes in character voices), 4.3 (cause-and-effect chains). Every other step is a Sonnet step.

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

- 2026-11-22 — **From the user:** the Creature Log should be tied into the map too, the same way as the place entries (see the Site Encyclopedia 2.2 round-2 layouts: a creature's range drawn on the Atlas, where it roams near a place, its habitat in the region close-up). Apply when designing the creature entry view.
- 2026-11-18 — Phase 0 is mostly in place (encyclopedia 0.1–0.4): timeline, reader chapter, links, and `opcl` opening a placeholder page. Left: creature links (`creature:<id>`) open nothing until `EpitaphCreatures` exists (`EpitaphLinks.resolve` already asks it for `byId`). Replace `placeholder()` for `opcl` in `assets/epitaph-book.js` when Phase 2 starts.
- 2026-11-17 — Shared timeline built (encyclopedia 0.1). Mutation causes can point at its ids now: `the-siege` (impact, crater, +60 m flood), `the-barriers`, `narrative-made`. Ice, radiation and the 7 epochs (1.1) still need their own events.
- 2026-11-17 — Plan written. Purpose confirmed by the user (evolutionary log, how the ecosystem developed and creatures mutated
  before the story; abilities, movements, some lore; exploratory).
