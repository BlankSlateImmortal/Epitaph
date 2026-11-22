# Site Encyclopedia — schema v2 (draft, 2026-11-22)

Status: **built from the user's picks on 2026-11-22; the merges marked ⚑ need their yes.** Replaces [site-schema.md](site-schema.md)
(v1 stays as the record of what was agreed on 2026-11-18). Examples use invented places (Briston, Holloway), not story places.

The goal, in the user's words: a place entry "as detailed or even more detailed than the dossier", because it structures how nations
deal with each other and the unrest inside them. And: "everything is connected and has a use eventually". A secret picked up in act 1
pays off in act 3.

## The seven tabs (Layout 2)

**Overview · History · Domestic · Foreign · Economy · Beasts · Intrigue.** "In the story" (chapters set there, who passed through) moves
into Overview, still derived from the Dossier.

Rules for every field below:
- **Dated.** Anything that can change carries `from` / `to` (timeline `when`s or event ids), so the reader sees the state at their chapter.
- **Revealed.** Anything can carry `revealedIn` (a chapter). Readers only see it once that chapter is published. Default: hidden.
- **Linked.** Any field can name other records with refs: `place:`, `char:`, `creature:`, `item:`, plus the new `faction:`, `figure:`,
  `tie:`, `bloc:`, `secret:`, `rumour:`, `scenario:` (all `<place>/<id>` inside a place, e.g. `faction:briston/ash-guild`).
- **Draft flags** as in v1: `draft: { <path>: true }` until the author approves.

## A place's record

```
{ placeId,
  model: false,                     // founding model on/off (statue sites default on, until the world is fleshed out)

  overview: { states: [{ from, status, scales{size,hold,stability,supply,defence,secrecy,written}, techLevel, note }] },
                                    // "In the story" is derived, not stored

  history: {
    purpose:   { original, now, drift },             // what it was built for vs what it is now
    founders:  [{ ref|name, role, fate }],
    settlers:  { who, from, why },                    // founding members and first settlers
    founding:  [{ stage, when, why, who, materials, reused, change }],   // the existing seven stages
    myth:      { text, true: 'true'|'half'|'false', secret? },           // the founding myth
    name:      { meaning, older: [..], outsiders: [..] },
    chronicle: [{ id, when, title, kind, text, turningPoint, refs }],    // dated events
    eras:      [{ name, from, to, note }],
    rulers:    derived from domestic.government.holders,
    landmarks: [{ id, name, built, by, story, sealed? }],
    lost:      [{ name, when, how, where_now? }],
    record:    [{ topic, official, truth, suspects: [refs], evidence: [{ what, where, revealedIn }], forbidden }]
  },

  domestic: {
    government: { form, offices: [{ title, holds, holder }], holders: [{ ref, title, from, to }],
                  succession, laws: [{ text, from, to }], justice, corruption, citizenship },
    factions:   [{ id, name, kind, leader, goals: { public, secret }, members: [refs], size, strength,
                   stance, ties: [{ ref, how }], controls: [refs|text], hidden, from, to }],
    figures:    [{ id, ref? (char: in the Dossier) | name, role, faction, goals: { public, secret }, fears,
                   leverage: [{ over|by: ref, what }], relationships: [{ ref, kind }], status: [{ from, value }] }],
    unrest:     [{ id, from, to, causes: [..], flashpoints: [{ where, when }], leaders: [refs], response, outcome }],
    society:    { daily, customs, festivals, taboos, faith, outsiders: { storyborn, voided, fallen, foreign }, culture },
    knowledge:  { techLevel (also on each state), era0: [{ what, works, who }], energy, medicine, communication,
                  weapons, education, forbidden: [{ what, why }] },
    military:   { forces: [{ name, size }], ranks: [..], doctrine, wards: → beasts.wards, commanders: [refs],
                  campaigns: [chronicle refs] }
  },

  foreign: {
    ties:      [{ id, with: 'place:…', kind, motive, motiveDetail, terms: [{ side, gives, gets }], target?,
                  signed: { when, by: [refs], where }, renewal: { expires, conditions },
                  public, real, wantsItToFail: [refs], ends: { when, how, note }, secret, from, to }],
    blocs:     [{ id, name, charter, members: [{ place, from, to }], seat, purpose, rival: 'bloc:…', tension }],
                                    // stored on the founding member, shown on every member
    envoys:    [{ ref|name, to: 'place:…', from, to_ }],
    hostages:  [{ ref|name, heldBy, why, from, to }],
    agents:    [{ ref|name, in: 'place:…', for: faction?, cover, exposed? }],
    borders:   [{ with, land, disputed }],
    routes:    [{ id, to: 'place:…', carries: [resource ids], dangers: [refs] }],
    migration: [{ who, from|to, why, when }],
    reputation:[{ place, view }]
  },

  economy: {
    resources: [{ id, name, category, role, core, importance, partners: [refs], route, controlledBy,
                  reserves, ifCutOff, source, seasonal }],
    currency, markets, taxes, blackMarket, labour, wealthGap,
    debts:     [{ place, owes|owed, what }]
  },

  beasts: [{ ref: 'creature:…', relation, wards: [kinds], incidents: [{ when, text }], trade,
             keepers: faction?, pact?: { terms, from, to } }],
                                    // "also affects" and range are derived from the creature

  intrigue: {
    secrets:   [{ id, text, about: [refs], keepers: [{ ref, why }], evidence: [refs to history.record evidence],
                  setup: chapter?, payoff: chapter?, revealedIn, unlocks: [refs], related: [secret refs],
                  discoverable: { where: landmark|place, how } }],
    rumours:   [{ id, text, truth: 'true'|'half'|'false', aboutSecret?: 'secret:…', about: [refs],
                  origin: { where, who, when, intent }, spread: [{ when, to: ref, by: ref }],
                  believers: [refs], effect }],
    questions: [{ id, text, about: [refs], answeredBy?: 'secret:…' }],
    hooks:     [{ id, for: ref?, text }],
    foreshadow:[{ id, text, plantIn: chapter?, pointsTo: ref }],
    sealed:    [{ id, place: landmark ref, why, whoHasKey }]
  },

  scenarios: [{ id, trigger, triggerKind, about: [refs], causes: [{ group, cause, note }], fallout: [{ place, what }],
                warnings: [{ text, plantIn }], likelihood, status, chapter }]
}
```

## How Intrigue connects to everything else (the user's note)

Intrigue holds secrets and rumours, but none of them float free. Each one is pinned to the thing it is about, and the other tabs show the pin.

- **About.** A secret or rumour names what it concerns with refs: a faction's secret goal, a tie's real reason, a landmark, a figure, a
  resource. That field in its own tab shows a small marker ("1 secret" / "rumour: false"), so the Domestic tab leads to the secret and back.
- **Where a rumour came from.** `origin` = where it started (a place or landmark), who started it (a figure, faction or character),
  when, and the **intent** (seven kinds, below). `spread` is the path it took: each step is a place or faction it reached, when, and who
  carried it. On the map this draws as a line spreading out from the origin, chapter by chapter.
- **Rumour vs secret.** A rumour can point at the secret it distorts (`aboutSecret`), and has a truth value (true, half-true, false).
  So "the Ash Guild poisoned the wells" (rumour, false, spread by a rival on purpose) can sit beside the real secret it covers.
- **Evidence.** History's "evidence lying around" items are the clues; a secret lists which ones point at it.
- **Unanswered questions** can name the secret that answers them, so open questions show when they are finally answered.

## Chekhov's gun: the setup → payoff tracker (the user's notes)

Every secret, foreshadowing line and evidence item can carry a **setup** chapter (where the reader first meets it) and a **payoff**
chapter (where it matters).

- A new check in the Dossier's Checks list: **loaded guns**, secrets or foreshadowing set up but never paid off; and **payoffs with no
  setup**, things that matter in a chapter but were never planted.
- Each place's Intrigue tab can sort by "planted, not yet paid off", a to-do list for later acts.
- Scenarios have **warning signs** with a chapter to plant them in, which feed the same tracker.

## Tying it to the Dossier's Knowledge tab (the user's notes)

The Dossier keeps each character's knowledge and secrets **per chapter**, as text lines. The link:

- A Dossier secret or fact line can point at an encyclopedia secret (`secret:briston/well-poison`), picked from a list while editing.
  The text stays what the character believes, which may be a rumour or half the truth.
- Because the Dossier is per chapter, **the first chapter where a character holds it is when they learned it**: no extra typing.
  The place's Intrigue tab then shows "known by: X since chapter 4, Y since chapter 9", derived.
- **Discoverable here.** A secret can say where it can be found (`discoverable.where`). When a character's Dossier location is that place
  in some chapter and they don't know it yet, the place entry lists it as "could be discovered by X here". A prompt, not a rule.
- The character's knowledge tree shows linked secrets with their place, and a rumour they believe shows as such (to the author only).

## The 7-sets

Kept from v1: **status**, the **seven scales**, **forms of rule**, **alliance kinds** (tie kind), **beast relations**,
**resource categories**, **founding stages**.

New scales (1–7), steps drafted, need the user's yes:

| Scale | 1 → 7 |
|---|---|
| **Technology level** | scavenged (tools from the ruins) · craft (smithing, wind and water) · workshop (simple machines) · industrial (engines, patched power) · restored (Era 0 machines kept running) · advanced (beyond Era 0, using the energy in the air) · transcendent (powers and machines fused) |
| **Faction strength** | fringe · minor · notable · influential · powerful · dominant · unchallenged |
| **Resource importance** | trivial · minor · useful · valued · vital · lifeblood · existential (the place falls without it) |
| **Scenario likelihood** | unthinkable · remote · unlikely · possible · likely · expected · inevitable |

Not ticked, so left out: an unrest scale (unrest is recorded as dated episodes instead) and a tie health scale.

### ⚑ Lists where more than seven were ticked: proposed sevens

Nothing is lost: each merged item keeps its specific reason as a sub-option (`motiveDetail`, `subkind`, and so on).

**Motives (12 ticked → 7):**
faith · **trade** (resources, convenience) · **protection** (defence, a beast threat, fear of a third power) · conquest ·
**bonds** (kinship or marriage, gratitude) · **tribute** (debt, vassal dues) · **secrets** (knowledge, infiltration)

**Faction kinds (9 ticked → 7):**
ruling power · **faith** (religious order, cult) · trade (guild or merchant house) · arms (military or guard) · blood (noble houses) ·
learning (scholars, archivists) · **shadow** (rebels or underground, criminal network)

**Ways a tie ends (9 ticked → 7):**
**lapsed** (expired, not renewed, quietly lapsed) · renegotiated · betrayed · war · absorbed (conquered) · erased (or ruined) ·
**realigned** (a coup or new ruler, a better offer)

**Beast temperament (9 ticked → 7):**
docile · skittish · territorial · predatory · aggressive · cunning · sapient.
*Corrupted* and *dormant* become separate fields on the creature (a corruption flag, and an activity state) since a creature can be both
corrupted and cunning, or dormant and aggressive.

**Social shape (8 ticked → 7):**
solitary · pair or family · pack · herd or migratory · colony · hive · nest-builders.
*Monster nation* becomes the separate rule that a sapient, organised group gets its own place entry (ticked under Monster nations).

**Kinds of ward:** exactly seven ticked: walls · barriers of power · culls and hunts · tamed guardians · offerings or tribute · pacts ·
hidden location.

**Rumour intent (new, for the origin of a rumour):** honest mistake · embellished gossip · malicious slander · propaganda ·
cover story (hides a secret) · bait (a trap) · the world's powers (a Narrative rewrite or a Storyborn's doing)

**Trigger kinds** (12 ticked) and the **cause** and **outcome** menus are suggestion lists for free text, not fixed sets, so they stay long.
The scenario stores the trigger kind as one of seven groups: **ties** (an alliance breaks) · **power** (a ruler falls, a faction seizes
power, a rebellion wins or is crushed) · **supply** (a resource runs out, a route is cut) · **beasts** (a surge or migration) ·
**secrets** (one revealed; a figure captured, killed or defecting) · **discovery** (technology or a relic) · **catastrophe** (plague, flood,
fire; a Storyborn or Voided intervention).

## From v1 to v2

v1 data moves over without loss: `states` → `overview.states`, `rule` → `domestic.government` (+ `stance` → society.outsiders note),
`alliances` → `foreign.ties` (kind kept; motive empty), `resources` → `economy.resources`, `beasts` → `beasts`, `founding` →
`history.founding`. Storage keeps one record per place per tab, now per v2 tab. The schema version goes to 2 with a backup before the upgrade.
