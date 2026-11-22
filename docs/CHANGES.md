# Epitaph — what changed

Two redesigns: **Atlas tracker** (newest, first) and the **chapter-state redesign** below it.

## Item system (assets/epitaph-library.js) — plan: `docs/plans/item-system.md`

- **Step 1.1, item state tracks.** An item now has up to three **tracks** of states instead of one list: **Item**, **Usage** and a third you name (default "Connection"), each up to 7 states, each state with an optional colour (gray, green, yellow, orange, red, purple, blue). A track can be marked one-way and has a primary (normal) state. An inventory entry picks one state per track (`stateIds`).
- **Your existing items convert on first load** (Library version 2): the old state list becomes the Item track, not one-way, so nothing raises false "goes backwards" warnings. The raw old copy is kept once as `epitaph-library-backup-v1` in the browser. The conversion is saved the next time anything in the Library is saved.
- **Temporary, removed with the editors (plan 2.1–2.2):** an item still answers to `item.states` (its Item track) and an inventory entry still carries `stateId` (its Item-track pick), so the existing editors and views keep working. Nothing else changed on screen yet.
- **Step 1.2, rank and tier.** Items carry a **rank** (Soul, Host, Ward, City, Dominion, Face, Planet) and a **tier** (mundane, transcendent, divine); bindings carry a rank. An item's rank is the highest of its own and its **active** bindings, so losing the binding that gave the reach lowers it (Observance: Planet while Connected, Soul at No Signal). A rank sets the lowest tier allowed; a bad tier is reported, never changed. Nothing shows it on screen yet.
- **Step 1.3, item fields.** An item has an **origin** (a place, none, or unknown), an **origin circumstance**, a dated **history** (era, year or chapter, holder, states, text) for the time before or off the story, and a **W.I.P** flag. The old origin place still reads the same until the editors move over (plan 2.1). Nothing shows it on screen yet.
- **Step 1.4, marks by kind.** A binding carries a **rank**; a blessing has **price, terms, breach, lasts until** (a breach needs terms); a curse has a **type** and **three stages** (Awakening, Fluctuation, Stabilization), each with an optional name and text, plus an initial state and the stage this holder is at. Dossier mark lists and the brief show these lines. The old **Cost** and **Ends** text is untouched until the new editors replace it. Nothing is editable yet; nothing reaches readers.
- **Step 1.5, backups.** Export, Import and Merge carry every new item and mark field with no change to them: an export then import keeps everything, an old backup converts without loss, and Merge still adds only new items and never changes ones you have (so updating existing items such as the Seal will need Import, or a new option, in step 5.1).
- **Step 1.6, optional fields kept offline.** Items can hold a weight, an appearance and a maker; they are saved and backed up but hidden everywhere until you switch them on (`OFFLINE_FIELDS` in `assets/epitaph-library.js`).
- **Step 2.1, the item editors.** Both item editors (the book's Library view and the Atlas Library drawer) now edit everything an item has: where it came from (a place, none, or unknown), how it came to be, **rank and tier** (a tier the rank forbids is locked), W.I.P, and **history entries** (before the story or off the page, each with an era, year or chapter, who held it and the state it was in). The States section is now up to **three tracks** (Item, Usage, and a third you name) with colours, one-way and a normal state. Item lists and detail views show rank, tier and W.I.P tags. Items from before still open and keep their states.
- **Step 2.2, the inventory editor.** In a chapter's inventory an item now has **one state picker per track** (Item, Usage, your third), each saying "not set (normal: …)" when empty. A new copy of an item starts every track in its normal state, and changing a state still asks whether to use that state's marks. The monitor draws one strip per track; "changes since last chapter" and the book's Library views notice a change in any track. The checks warn about a state that was removed from any track, and about going back to an earlier state only on a track you marked **one-way** (items from before are not one-way, so they stop raising that warning until you mark the track). Your saved chapters convert automatically; nothing is lost.
- **Step 2.3, one mark editor.** Marks are edited with the same fields everywhere (a person's marks, an item's, a chapter's copy of an item, the wide marks editor). What a mark offers depends on its kind: a **binding** has a **Reach** (rank); a **blessing** has **Price, Terms, Breach, Lasts until**; a **curse** has a **Type** and **Stages** (your own name and text for Initial state, Awakening, Fluctuation, Stabilization) and, in a chapter, the **stage it is at now**. A person can take blessings and curses, an item bindings and curses (a mark already of another kind stays, with a warning). **Cost and Ends are gone:** what you had written there moved automatically (a blessing's cost to Price, its ends to Lasts until; on a binding or curse into the Effect text), and nothing was lost. Your data is backed up in the browser first (`epitaph-library-backup-v2`, `epitaph-character-profiles-backup-v9`).
- **Step 2.4, item checks.** The Checks list now warns when an item's **tier is too low** for the highest rank it can reach, when a **curse's stage goes down** in a later chapter (a curse doesn't recover), when a person's own **curse disappears** in a later chapter (curses can't be removed), and when a **one-way track goes back** in an item's history or a history entry is in a removed state. It also notes, as information, a blessing on an item or a binding on a person, and curses with fewer than three stages written. History entries are now really saved in date order (era, then year, then chapter).
- **Item history years.** A history entry's year can be as far back as you like (type a minus sign: −4219) and can be marked **≈** approximate. Years show the way the timeline shows them ("Before Epitaph · ≈ Y −4,219") in the item views and the checks.
- **Step 3.1, the inventory monitor.** An item in a chapter shows its **rank right now** (it drops when a state loses the binding that gave the reach, and a dashed tag says what it can reach otherwise), its **tier**, and a **W.I.P** tag for you only. Switching between items now plays a short, quiet animation (skipped if your system asks for less motion).
- **Step 3.2, the book's Library views.** The Relic vault tiles and the Holder web nodes show an item's states from every track and its rank in that chapter (for example "R1 Soul" at No Signal). The item log lists the item's own history (before the story, or off the page) together with what happened chapter by chapter, in order.
- **Step 3.3, the curse stage ladder.** A curse shows where it stands: Initial state, Awakening, Fluctuation, Stabilization, with your own stage names, the steps already passed, the current one highlighted and its text underneath. It appears on a person's marks, on a chapter's copy of an item and on the inventory monitor (the stage that holder is at in that chapter), and on the item's detail in the Library (as defined, nothing marked). The book's item log notes when a curse moves to another stage.
- **Step 3.4, the Powers page.** A new **Items** section explains item ranks and tiers, states, bindings, blessings and curses in the page's own style. Item ranks have seven steps and no Realm. Curses are described as plain costs that follow from something, not something a god or Storyborn applies. In the mark editor a curse's source field is now called **Cause**.
- **Phase 4, what readers get from items.** The published copy now carries an item's rank, tier and origin, its states (only those a published chapter has reached, plus its normal state), its history (only what a chapter has revealed) and its origin story (only from the chapter whose `reveals:` lists "Item: origin"). Pre-story history appears once a chapter lists "Item: history"; a mark can be revealed as "Item: Mark". A W.I.P item is never published, and neither are your notes, weight, appearance, maker, a blessing's terms or a curse's type and stage texts. A curse shows only the stage names a published chapter has reached. `tools/check-snapshot.py` double-checks all of this before you publish.
- **Items update when you write the reveal (readers).** A reader's rank, states and marks for an item follow what the story has revealed so far, for as far as they have read. A binding counts from the chapter that writes it: until you publish the chapter that reveals God's Eye, a Connected item reads Rank 1 · Soul; once it is published, it reads Rank 7 · Planet everywhere, whichever chapter's version is open. A reader who sets their position earlier than that chapter still sees Soul. You always see everything.
- **Step 5.0, Merge can update items.** In Dossier → Data → Merge there is now an option, off by default: **Also update items that already exist**. When you tick it you see each item the file would change and what differs, can untick any, and the ticked ones are replaced by the file's version after your current Library is saved to the browser as `epitaph-library-backup-before-merge`. Everything else still only adds, never overwrites.
- Library script `?v=16`, marks script `?v=7`, state editor `?v=3`, item fields `?v=5`. Tested in Node (22 tests: conversion, backup, round trips, legacy editor writes, caps, helpers, rank and tier, origin and history, marks) and in the real Dossier in headless Chromium (library converted, entries gained `stateIds`, no errors).

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
