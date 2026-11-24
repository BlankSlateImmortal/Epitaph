# The book's views: a visual pass for every page of the Storybook

Sister plans: [item-system.md](item-system.md) (opsp, opmk), [site-encyclopedia.md](site-encyclopedia.md) (opse), [creature-log.md](creature-log.md) (opcl).

## Purpose (from the user, 2026-11-23)

The grimoire (`opsp`, a shelf of books) and the mark deck (`opmk`, a floating card table) set the bar: rich, polished, "not empty".
The user likes `ops` (the skill tree) and both looks of `opl` (the holder web, the relic vault with its floating items). Bring every view of the
book up to the same standard, one at a time, with a mockup first each time (the user picks from concrete options).

## Order (the user's)

1. **`ops`, the skill tree — now.** A polish pass, not a redesign: the user already likes it.
2. **The front door (`index.html`) — next, when the user sends references.** Tighter, more professional, less spaced out.
3. **`opse`, the Site Encyclopedia — later.** Logged, not started.
4. **`opcl`, the Creature Log — later.** Logged, not started.

## Status key

`[ ]` not started · `[~]` in progress · `[x]` done · `[-]` dropped (say why in the tweak log)

---

## Phase 0 — A shared ornament kit

- [x] **0.1** The details the user liked, in one place so every view matches: card corners, roman numerals, sigil rings (rune ring + dashed inner
  ring), seals (dots for counts), paper textures, the vault's float (bob + breathing shadow + a light from above), the warm "fresh paper" flash.
  Start as shared CSS classes in `assets/epitaph-book.css` (`.orn-*`) and small helpers; move the deck's and the grimoire's own copies onto
  them when those files are next touched (not before: they work).

## Phase 1 — `ops` (Sonnet can do the plumbing; the look is Opus)

- [x] **1.1** Polish pass on the skill tree: background, medallion detail, the right panel (card-style head, corners, numeral, seals), the empty
  state. Keep the layout, zoom, keyboard and editor exactly as they are.

## Phase 2 — The front door (waits for the user's references)

- [ ] **2.1** Mockups from the references; tighter spacing, a more professional layout.

## Phase 3 — `opse` (later)

- [ ] **3.1** Mockups first. It is large: seven tabs, the places index, entry pages, the editor, the what-if board, founding stages, dither maps.
  Start with the index and the entry chrome; the tabs after.
- [ ] **3.2** Build, tab by tab, reusing the ornament kit. Keep every reader gate (site-encyclopedia 2.4) exactly as it is.

## Phase 4 — `opcl` (later)

- [ ] **4.1** Mockups first. The largest: seven tabs, four drawn views (Tree, Web, World, Chains) tuned for hundreds of forms
  (creature-log 7.2: keep those timings).
- [ ] **4.2** Build: the log's chrome and the creature page first, the drawn views last.

---

## Tweak log

Newest first. One line each: date, what changed, and what it does to the plan.

- 2026-11-23 — The skill plate tidied (the user: "the progression thing on the card is nice but it's a lot of clutter"): it keeps the sigil, the name and the level; the trail, branch links and holder chips are now one quiet line ("from Spark · held by Test Wren", the parent a link). The tree itself shows the rest.

- 2026-11-23 — 0.1 and 1.1 done (Opus). New `assets/epitaph-ornaments.js` (`EpitaphOrn`: roman, corners, ring, pips, seals) with `.orn-*` styles; the deck and the grimoire keep their own copies for now. ops: a **skill plate** on the right page above the editor (turning sigil ring, blackletter name, level diamonds + LV, the trail from the centre and the branches as links that select, holders as chips that glow when learned; the centre gets its own plate with its roots); the tree page gets card corners, drifting embers, a turning rune ring round the centre, an orbit round the selected skill, and the bottom-left feed on a plaque. Layout, zoom, keyboard and editor unchanged. Readers see the plate too (read-only, nothing private in it).

- 2026-11-23 — Plan written from the user's request: ops first (then a PR), the front door when references arrive, opse and opcl logged for later.
  Effort estimate given: front door small; ops small-to-medium (a polish pass); opse large; opcl largest.
