# Site Encyclopedia — schema (step 1.1, agreed)

Status: **agreed by the user 2026-11-18** (all four questions: dated states with the seven scales, the seven alliance kinds, the other sets). Built in `assets/epitaph-sites.js`. Every 7-set ties each step to a rule from
the lore, so no number is arbitrary. Dates are timeline `when`s or event ids (`assets/epitaph-timeline.js`).

## A place's record (keyed by its map place id)

```
{ placeId,
  states:    [{ from: eventId, status, scales: { size, hold, stability, supply, defence, secrecy, written }, note }],
  rule:      { form, holders: [{ ref: 'char:…'|name, title, from, to }], laws: [..], outsiders, stance },
  alliances: [{ with: 'place:…', kind, from, to, secret, note }],
  resources: [{ name, category, role: 'produces'|'needs'|'scarce'|'guards', source?: 'creature:…'|'place:…' }],
  beasts:    [{ ref: 'creature:…', relation, note }],
  founding:  [{ stage, when, why, who, materials, reused, change }],
  draft: { <field>: true } }          // which fields are still Claude's draft
```

*In the story* is not stored: it comes from the Dossier (characters' locations by chapter).

**Change from the plan:** the plan had one `overview.status`. The lore already gives places **states over time**
(a place can go from `standing` to `erased`, or from `sealed` to occupied, at a timeline event). So a place has a list of states,
each starting at a timeline event, each with its own status and scales. The reader sees the state for their chapter.

## The seven 7-sets

### 1. Status (a state's headline)
founding · rising · standing · strained · besieged · ruined · erased
— *erased* is for erasure by the story's powers; flood-sunk cities are *ruined*.

### 2. The seven scales (each 1–7, shown on every state)
| Scale | Rule it follows | 1 → 7 |
|---|---|---|
| **Size** | headcount, each step about ×4–5 | outpost (<50) · hamlet (<250) · village (<1k) · town (<5k) · city (<25k) · great city (<100k) · metropolis (100k+) |
| **Hold** | how firmly the rulers control it | lawless · loose · contested · governed · ordered · strict · absolute |
| **Stability** | how close it is to breaking | collapsing · failing · shaken · steady · secure · rooted · unshakable |
| **Supply** | can it feed and run itself | starving · dependent · short · enough · surplus · trader · provider (others depend on it) |
| **Defence** | what it takes to break in | open · watched · walled · garrisoned · fortified · warded (a barrier) · unbreachable |
| **Secrecy** | who knows it exists | known to all · known · discreet · guarded · hidden · secret · unseen (beyond what the world's own powers can see) |
| **Written** | how much of it the Narrative sees | unwritten (Fallen: blank in the Narrative View) · faint · sketched · written · inscribed · storied · scripture (a Storyborn city written on, like Aurelia) |

### 3. Forms of rule
hidden god (a ruler who is never seen) · church (clergy rule in a god's name) · monarch (one ruler, or a line of them) · command (an old chain of command) · council (elders or an assembly) · outpost (run
from somewhere else) · none (ruin, sunk, erased)

### 4. Alliance kinds
alliance (a pact) · vassal (one serves the other) · trade · truce (an uneasy peace) · rivalry · war · **covert** (one works inside
the other in secret)
— every alliance has `from` and `to`; a `to` the reader hasn't reached shows as "?"; `secret: true` hides the whole link until revealed.

### 5. Beast relations
common (lives there) · hunted (prey or a resource) · feared (threatens it) · kept (bred or tamed) · worshipped · warded (kept out by
walls or barriers) · studied (specimens in a lab or workshop)

### 6. Resource categories
food · air & water (the Grove's clean air) · materials (stone, steel, Era 0 salvage) · energy (the energy in the air, stations, power
cells) · relics & knowledge · people (labour, soldiers) · power (the world's own powers and what holds them)
— the four roles (produces, needs, scarce, guards) aren't a scale, so they stay four.

### 7. Founding stages
the reason (why there) · ground broken (who first built) · first walls · growth · disaster · rebuilt · as it stands
— each stage dated, with materials and what was **reused** from the drowned old world (Cheyenne Mountain's bunker, Era 0 salvage).
