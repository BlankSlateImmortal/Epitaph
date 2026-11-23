# Creature Log — schema (step 1.3, proposal)

*Status: **agreed 2026-11-22** (the user said yes to all four open points). Built from the decisions in steps 1.1 and 1.2 (the vault notes
`Creature Log Decisions 2026-11-22.md` and `Creature Log Biomes.md`). Lore examples stay in the vault; this file is the shape.*

`assets/epitaph-creatures.js` → `window.EpitaphCreatures`, key `epitaph-creatures` (defaults plus the user's edits, merged like the
encyclopedia), with `byId(id)` and `EpitaphLinks.register('creature', …)` from day one (the hooks in step 1.7).

## 1. Time: epochs and ages

Fixed sets, defined in the module like the encyclopedia's founding stages.

```
EPOCHS = 7 × { id, name, events: [timelineEventId] }            // the whole history, Chaos → Epitaph
AGES   = 7 × { id: 'A'…'G', name, from, to, cursePhase? }       // inside the last epoch; E–G carry Awakening · Fluctuation · Stabilization
```

Anything dated in the log names **either an epoch or an age** (`when: { epoch } | { age } | timelineEventId`), so a lineage can begin
in the mythic past and a curse can awaken in age E. The reader gate uses the timeline event when there is one, else the age's
`from` event.

## 2. Curses: one curse, three kinds of holder

**A curse is a Library mark** (`kind: 'curse'`, the shape items already use: `name, source, effect, type, initial, stages ×3, stage`).
The Library's shared marks are the one place a curse is written; an item, a creature or an infected place holds a **copy** that
points back with `libId` and keeps its own current stage. New, optional fields on a curse (old item curses are unaffected):

```
state:      'physical' | 'infectious' | 'metaphysical'     // yours: physical (can move) · infectious · stationary and unseen
spreadsBy:  ['air', 'land', 'sea']                          // infectious curses
moves:      'slow' | null                                    // a moving environment spreads slowly (your rule)
concepts:   [conceptId]                                      // the clashing concepts it came from (Nothing, Fate, Imagination, Reality, Chaos)
rest:       'eons' | 'short'                                 // how long it rests after Stabilization; 'short' for conscious holders
```

The rules that hold for **every** curse live once in the module, not on each curse: Era 0 people die in cursed ground, Era 1-born
survive, Storyborn resist by rank, the Voided destroy a curse locally until it reforms, and no curse can be fixed.

## 3. Biomes and infected places

```
biome:  { id, name, desc, regions: [mapRegionId], placeBound: bool, spread, since: age }
          // regions: plains · hills · mountains · ice · pit · rim · coast · drowned · underwater (the Atlas's own ids); a sky layer later
place:  { id, name, biome, lon, lat, country, continent, ground: { state, elev }, since: age,
          curse: Mark | null, notes, sitePlaceId? }          // sitePlaceId links an encyclopedia entry (Aurelia, the Hollow Reach…)
```

`curse: null` means **not written yet**: shown as "not known yet", never flagged by Checks. Import reads the vault notes
(`Infected Places/*.md`, one place per heading, its **Curse** line), so what the user writes there arrives in the site.

## 4. The tree: lineage nodes and creatures

```
node:      { id, name, parentId | null, root: 'masterpiece' | 'chaos' | …, when, extinct?: when,
             cause: timelineEventId | ageId, mutation: { change, advantage, curse?: libId },
             biomes: [biomeId], silhouette?, draft, hidden, revealedIn }
creature = node + {
             awareness: 1..7, threat: 1..7, size: 1..7,        // the three scales below
             conscious: derived (awareness ≥ 5)                  // conscious cursed creatures cycle fast (rest: 'short')
             curses: [Mark],                                     // copies from the Library, each at its own stage
             traits: [{ name, does, counters, power: 1..7 }],    // what its body can do; creatures get no skills (yours); power: Faint … Unstoppable
             anatomy: { image, parts: [{ name, note, x, y }], model? },   // your drawing or render; x,y = a part's pin on it (0..1)
             resources: [{ name, kind, use, libId }],            // what its body yields; kind: hide · bone · venom · blood · scale · sinew · other; libId: a Library item
             encounters: [{ charId, chapter, note }],            // Dossier characters who met it (readers see them from that chapter)
             ties: [{ charId, how }],                            // tied to a character's powers (author only)
             range: { biomes, places, migrations: [{ path: [[lat,lng]…], when }] },
             nests: [placeId],                                   // only cursed creatures nest (yours)
             sightings: [{ chapter, placeId, note }],
             diet, hunting, breeding,
             names: [{ placeId, localName, belief }],            // what each settlement calls it (links the encyclopedia's Beasts tab)
             fieldNotes: [{ author | charId, when, chapter, text }] }   // readers see a note from its chapter on; none without one
chaos:     { id, name, forms: [{ biome, looks }], sightings, curseLink?, hidden, revealedIn }
           // the shelf beside the tree: deathless, shifting with its region, maybe tied to curses
food:      { eater, eaten, when }                               // who eats whom, at an age
```

## 5. The scales (seven steps each, every step tied to a rule)

| Scale | 1 | 2 | 3 | 4 | 5 | 6 | 7 | The rule it drives |
|---|---|---|---|---|---|---|---|---|
| **Awareness** | Instinct | Cunning | Clever | Aware | Sentient | Sapient | Self-made | **5 and up is conscious**: its curses rest only briefly and re-cycle when something affects it; only sentient cursed creatures can live in cursed environments |
| **Threat** (to people) | Harmless | Wary | Dangerous | Deadly | Pack-killer | Settlement-ending | Calamity | what a Warded Domain must hold back; how the Beasts tab ranks it |
| **Size** | Mote | Small | Person-sized | Large | Huge | Colossal | Titanic | what it can nest in (ruins, citadels, the deep), and how far it is seen on the plains |

## 6. Reader gate, drafts, checks

- **Gate:** the same rule as the encyclopedia: a node, creature or curse a reader's chapter hasn't revealed is a "?" silhouette
  (step 2.4); a sighting shows from its chapter; author-only: drafts, `concepts`, a curse's later stages before they're reached.
- **Drafts:** every default carries `draft` until approved (like the encyclopedia).
- **Checks** (step 1.6): a node with a missing parent, a mutation with no cause, a creature dated before its ancestor, a food link to a
  missing creature, an extinct creature sighted later, a curse copy whose `libId` is gone. An unwritten place curse is not a problem.

## Added 2026-11-23 (the user's answers)

Trait power (7 steps), the anatomy image with pins, resources, encounters and power ties, and a chapter on each field note. All live on the creature; the Library and the Dossier read them and link back.

## Agreed (2026-11-22)

1. Curses as Library marks (one definition used by items, creatures and places)?
2. The three scales and their step names?
3. The new curse fields (`state`, `spreadsBy`, `moves`, `concepts`, `rest`)?
4. Creatures get **traits** (what their bodies do) instead of abilities, since only people get skills?
