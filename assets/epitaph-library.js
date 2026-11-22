/* Epitaph — the Library: user-added countries, places and items, shared by
 * the Atlas and the Dossier under one storage key.
 *
 *   Library.get()          -> the current library (cached; never mutate it)
 *   Library.update(fn)     -> reads the latest stored copy, lets fn change it,
 *                             saves immediately; returns the saved library, or
 *                             null if the browser refused to save
 *   Library.replace(data)  -> overwrite with an imported library
 *   Library.onChange(fn)   -> called when another tab changes the library
 *
 * Shape (version 3; v2 → v3 folded the old mark cost / ends text, raw v2 copy kept once as `epitaph-library-backup-v2`):
 *   countries: [{ id, name, lat, lon, note }]
 *   places:    [{ id, name, countryId, kind, lat, lon, note, era? }]
 *   marks:     [Mark]   the shared mark library: definitions a holder's mark can be copied from (a copy carries `libId`)
 *   skillDrafts: [{ id, name, desc, level, corrupted, parent, glyph, note }]   prospective skills: not real until assigned to a character
 *   items:     [{ id, name, desc, origin, originCircumstance, history: [Entry], wip, marks: [Mark], note, icon, image, stateTracks: [Track] }]
 *     origin: a place id, 'none', 'unknown' or '' (not filled in); `note` is the author's private note.
 *     weight, appearance, maker (a name or character id): stored, but OFFLINE (hidden by editors and views) until switched on, see OFFLINE_FIELDS
 *     Entry = { id, when: { era: BEFORE|ERA_0|ERA_1, year? (negative = before the siege), approx? (≈ year), chapter? }, holder (character id or name), stateIds, text }
 *     rank: 1–7 (0 = unset; Soul Host Ward City Dominion Face Planet), tier: 'mundane'|'transcendent'|'divine'|''
 *     Tier is who could make it, not derived from rank: a rank only sets the lowest tier allowed.
 *   Track = { id, kind: 'item'|'usage'|'custom', name, oneWay, primaryStateId, states: [State] }
 *     at most one track per kind (id = kind), at most 7 states per track; 'custom' is the
 *     author-named third track (default name "Connection").
 *   State = { id, name, desc, marks: [Mark], image, color }   (ordered: first → last)
 *   An inventory entry picks one state per track: `stateIds: { item: stateId, usage: … }`;
 *   marks on the item apply in every state, the current states' marks are added on top.
 *   Mark = { id, kind: 'blessing'|'curse'|'binding', name, source, effect, image? } plus, by kind:
 *     binding:  rank?  (the reach it gives)
 *     blessing: price, terms, breach (only with terms), lastsUntil
 *     curse:    type (mutation|enhancement|distortion|fragmentation), initial {name,text}, stages [3 × {name,text}]
 *               (Awakening, Fluctuation, Stabilization), stage (0 = initial, 1–3: this holder's stage)
 *     The old `cost` / `ends` text no longer exists as fields: it is folded into price / lasts until (blessings) or the effect (plan 2.3).
 *   An item's rank now = the highest of its base rank and its active bindings' ranks (rankAt).
 *
 *   Old data converts on load: a v1 `states[]` (with no stateTracks) becomes the Item track, a v1
 *   `originPlaceId` becomes `origin`. (Old inventory `stateId`s convert in the Dossier, see normalizeStateIds.)
 *   Version 1 libraries (a plain `states[]` per item) are converted on load; the raw v1 copy
 *   is kept once under `epitaph-library-backup-v1`.
 *
 * Built-in geography stays read-only in assets/epitaph-world.js; this file
 * registers the Library's countries and places with EpitaphWorld so both
 * pages see one combined list.
 */
(function (global) {
  'use strict';
  const KEY = 'epitaph-library';
  const BACKUP_BEFORE_MERGE = 'epitaph-library-backup-before-merge';   // the Library as it was before a Merge that updated existing items
  const BACKUP_V1 = 'epitaph-library-backup-v1', BACKUP_V2 = 'epitaph-library-backup-v2';   // raw copies kept once before an upgrade
  const MARK_KINDS = ['blessing', 'curse', 'binding'];
  const num = v => typeof v === 'number' && isFinite(v);
  const str = v => (typeof v === 'string' ? v : '');
  function newId(prefix) { return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  // Item rank (reach) and tier (who could make it), from the author's Items page.
  // Rank 1–7; 0 = not set. Tier is NOT derived from rank: a rank only sets the lowest tier allowed.
  const RANKS = ['', 'Soul', 'Host', 'Ward', 'City', 'Dominion', 'Face', 'Planet'];
  const TIERS = ['mundane', 'transcendent', 'divine'];
  const rankNum = v => (Number.isInteger(v) && v >= 1 && v <= 7 ? v : 0);
  // Marks by kind (plan 0.3):
  //   binding  — name, source, effect, rank                         (items only)
  //   blessing — name, source, effect, price, terms, breach, lastsUntil   (people only; breach only with terms)
  //   curse    — name, source, effect, type, initial, stages ×3, stage   (people and items; no cost, no end)
  // The old `cost` / `ends` text stays on every mark for now (the editors still write it); the 2.3 editors
  // and the converted data file (5.1) move it into the new fields and remove it.
  const CURSE_TYPES = ['mutation', 'enhancement', 'distortion', 'fragmentation'];
  const STAGE_NAMES = ['Awakening', 'Fluctuation', 'Stabilization'];
  const markKindsFor = holder => (holder === 'item' ? ['binding', 'curse'] : holder === 'character' ? ['blessing', 'curse'] : MARK_KINDS.slice());
  const stageText = x => ({ name: str(x && x.name), text: str(x && x.text) });
  function normalizeMark(m) {
    m = m || {};
    const kind = MARK_KINDS.includes(m.kind) ? m.kind : 'blessing';
    const out = { id: m.id || newId('mark'), kind,
      name: str(m.name), source: str(m.source), effect: str(m.effect), image: str(m.image) };
    // The old free-text `cost` / `ends` are folded in so no text is lost (plan 2.3; step 5.1 refines each one by hand):
    // a blessing's cost becomes its price and its ends "lasts until"; on a binding or curse they are added to the effect.
    let oldCost = str(m.cost).trim(), oldEnds = str(m.ends).trim();
    if (typeof m.libId === 'string' && m.libId) out.libId = m.libId;                  // a copy of a Library mark (Phase 6): which definition it came from
    if (Number.isInteger(m.revealedIn)) out.revealedIn = m.revealedIn;                // published copies only: the chapter that revealed it
    if (kind === 'binding' && rankNum(m.rank)) out.rank = rankNum(m.rank);          // only bindings carry a rank
    if (kind === 'blessing') {
      out.price = str(m.price); out.terms = str(m.terms);
      out.breach = out.terms.trim() ? str(m.breach) : '';                          // a breach needs terms to break
      out.lastsUntil = str(m.lastsUntil);
      if (oldCost && !out.price.trim()) { out.price = oldCost; oldCost = ''; }
      if (oldEnds && !out.lastsUntil.trim()) { out.lastsUntil = oldEnds; oldEnds = ''; }
    }
    const extra = [oldCost && 'Cost: ' + oldCost, oldEnds && 'Ends: ' + oldEnds].filter(Boolean).join('\n');
    if (extra && !out.effect.includes(extra)) out.effect = out.effect.trim() ? out.effect.trim() + '\n\n' + extra : extra;
    if (kind === 'curse') {
      out.type = CURSE_TYPES.includes(m.type) ? m.type : '';
      out.initial = stageText(m.initial);
      const st = Array.isArray(m.stages) ? m.stages : [];
      out.stages = [0, 1, 2].map(i => stageText(st[i]));
      out.stage = Number.isInteger(m.stage) && m.stage >= 1 && m.stage <= 3 ? m.stage : 0;   // this holder's stage: 0 = initial, 1–3
    }
    return out;
  }
  // Extra lines a mark shows beyond name / source / effect: [{ label, text }]. Used by every read-only view.
  function markDetailLines(m) {
    if (!m) return [];
    const L = [], add = (label, text) => { if (str(text).trim()) L.push({ label, text: str(text).trim() }); };
    if (m.kind === 'binding' && rankNum(m.rank)) add('Reach', RANKS[rankNum(m.rank)]);
    if (m.kind === 'blessing') { add('Price', m.price); add('Terms', m.terms); if (str(m.terms).trim()) add('Breach', m.breach); add('Lasts until', m.lastsUntil); }
    if (m.kind === 'curse') {
      if (m.type) add('Type', m.type.charAt(0).toUpperCase() + m.type.slice(1));
      const n = Number.isInteger(m.stage) ? m.stage : 0, cur = n >= 1 ? (m.stages || [])[n - 1] || {} : (m.initial || {});
      const head = n >= 1 ? `Stage ${n}/3 · ${STAGE_NAMES[n - 1]}` : 'Initial state';
      if (n >= 1 || str(cur.name).trim() || str(cur.text).trim()) L.push({ label: head, text: [str(cur.name).trim(), str(cur.text).trim()].filter(Boolean).join(' — ') });
    }
    return L;
  }
  const STATE_COLORS = ['gray', 'green', 'yellow', 'orange', 'red', 'purple', 'blue'];
  const TRACK_KINDS = ['item', 'usage', 'custom'];
  const TRACK_NAMES = { item: 'Item', usage: 'Usage', custom: 'Connection' };
  const MAX_STATES = 7;
  // A mark as a library definition: no holder link, no reveal marker, a curse at its initial state.
  function asDefinition(m) { const o = normalizeMark(m); delete o.libId; delete o.revealedIn; if (o.kind === 'curse') o.stage = 0; return o; }
  // A prospective skill (Phase 6): the same fields as a skill in a chapter version, plus an id and a private note. Not real until assigned.
  function normalizeSkillDraft(x) {
    x = x || {};
    return { id: x.id || newId('skd'), name: str(x.name), desc: str(x.desc), level: Number.isInteger(x.level) && x.level >= 0 ? x.level : 0,
      corrupted: x.corrupted === true, parent: str(x.parent), glyph: str(x.glyph), note: str(x.note) };
  }
  function normalizeState(st) {
    st = st || {};
    return { id: st.id || newId('state'), name: str(st.name), desc: str(st.desc),
      marks: (Array.isArray(st.marks) ? st.marks : []).map(normalizeMark), image: str(st.image),
      color: STATE_COLORS.includes(st.color) ? st.color : '',
      ...(Number.isInteger(st.reachedIn) ? { reachedIn: st.reachedIn } : {}) };   // published copies only: the first chapter that reached it (0 = its normal state)
  }
  // One track: id is its kind. `legacy` = the states came from a v1 `states[]` (not one-way, so
  // old data raises no false "goes backwards" warnings).
  function normalizeTrack(t, legacy) {
    t = t || {};
    const kind = TRACK_KINDS.includes(t.kind) ? t.kind : 'item';
    const states = (Array.isArray(t.states) ? t.states : []).slice(0, MAX_STATES).map(normalizeState);
    const prim = states.some(s => s.id === t.primaryStateId) ? t.primaryStateId : (states[0] ? states[0].id : '');
    return { id: kind, kind, name: str(t.name).trim() || TRACK_NAMES[kind],
      oneWay: typeof t.oneWay === 'boolean' ? t.oneWay : (legacy ? false : kind === 'item'),
      primaryStateId: prim, states };
  }
  // Tracks of one item: first track of each kind wins, empty tracks are dropped, Item → Usage → custom.
  // `legacyStates` (an array) replaces the Item track's states.
  function normalizeTracks(raw, legacyStates) {
    const by = {};
    (Array.isArray(raw) ? raw : []).forEach(t => { const n = normalizeTrack(t, false); if (n.states.length && !by[n.kind]) by[n.kind] = n; });
    if (Array.isArray(legacyStates)) {
      const base = by.item || null;
      by.item = normalizeTrack({ ...(base || {}), kind: 'item', states: legacyStates }, !base);
    }
    return TRACK_KINDS.map(k => by[k]).filter(t => t && t.states.length);
  }
  const itemTrack = it => ((it && it.stateTracks) || []).find(t => t.kind === 'item') || null;
  // An inventory entry's picks per track; the old `stateId` (Item track) wins when present.
  function normalizeStateIds(raw, legacyStateId) {
    const out = {};
    if (raw && typeof raw === 'object') TRACK_KINDS.forEach(k => { if (typeof raw[k] === 'string' && raw[k]) out[k] = raw[k]; });
    if (typeof legacyStateId === 'string') { if (legacyStateId) out.item = legacyStateId; else delete out.item; }
    return out;
  }
  // ---- origin and history ----------------------------------------------------
  // Optional item fields the author may want later (weight, appearance, maker). They are always kept in storage,
  // export and import so nothing is lost; `true` here means OFFLINE: editors and views leave them out. To switch one
  // on, set it to false (and say so in docs/CHANGES.md); the editors (2.1) and views (3.x) read fieldOn(name).
  const OFFLINE_FIELDS = { weight: true, appearance: true, maker: true };
  const fieldOn = name => OFFLINE_FIELDS[name] === false;
  const ERAS = ['BEFORE', 'ERA_0', 'ERA_1'];   // the same ids as assets/epitaph-timeline.js
  const ORIGIN_WORDS = ['none', 'unknown'];    // an origin is a place id, 'none' (it has no origin), 'unknown' (???) or '' (not filled in)
  // A v1 library (or an old export / published snapshot) has `originPlaceId` (a place id or '') and no `origin`: convert it.
  // The place an item came from, or '' when its origin is none, unknown or not filled in.
  // The items whose origin is this place, for a place's page ("made here"). With `only` (a function), just those it accepts,
  // so a reader's page can pass what readers may see.
  const itemsFromPlace = (placeId, only) => (placeId ? get().items.filter(i => placeIdOf(i) === placeId && (!only || only(i))) : []);
  const placeIdOf = it => (it && it.origin && !ORIGIN_WORDS.includes(it.origin) ? it.origin : '');
  function normalizeOrigin(i) { return typeof i.origin === 'string' ? i.origin : str(i.originPlaceId); }
  // Orders two history moments: by era, then year; within an era, moments with only a chapter come after the dated ones,
  // in chapter order; undated ones last. (EpitaphTimeline.compare orders timeline EVENTS and ignores years.)
  const ERA_RANK = { BEFORE: 0, ERA_0: 1, ERA_1: 2 };
  function compareWhen(a, b) {
    const k = w => { w = w || {}; return [ERA_RANK.hasOwnProperty(w.era) ? ERA_RANK[w.era] : 2, w.year != null ? 0 : w.chapter != null ? 1 : 2, w.year != null ? w.year : (w.chapter != null ? w.chapter : 0)]; };
    const x = k(a), y = k(b);
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    return 0;
  }
  // "Before Epitaph · Y −4,219 · CH 3" — the same year format as the timeline (a real minus sign, thousands separators, ≈ when approximate).
  function whenText(w) {
    w = w || {};
    const era = { BEFORE: 'Before Epitaph', ERA_0: 'Era 0', ERA_1: 'Era 1' }[w.era] || 'Era 1';
    const yr = num(w.year) ? (w.approx ? '≈ ' : '') + 'Y ' + (w.year < 0 ? '−' : '') + Math.abs(w.year).toLocaleString('en-US') : '';
    return [era, yr, Number.isInteger(w.chapter) ? 'CH ' + w.chapter : ''].filter(Boolean).join(' · ');
  }
  // One dated entry in an item's life before (or off) the story: [{ id, when, holder, stateIds, text }]
  // `when` is a timeline moment (era, optional year, optional chapter); `holder` is a character id or a plain name.
  function normalizeHistoryEntry(h) {
    h = h || {}; const w = h.when || {};
    return { id: h.id || newId('hist'),
      when: { era: ERAS.includes(w.era) ? w.era : 'ERA_1', ...(num(w.year) ? { year: w.year } : {}), ...(num(w.year) && w.approx === true ? { approx: true } : {}), ...(Number.isInteger(w.chapter) ? { chapter: w.chapter } : {}) },
      holder: str(h.holder), stateIds: normalizeStateIds(h.stateIds), text: str(h.text) };
  }
  function normalize(raw) {
    const d = raw && typeof raw === 'object' ? raw : {};
    return {
      version: 3,
      countries: (Array.isArray(d.countries) ? d.countries : []).filter(c => c && c.id).map(c => ({
        id: c.id, name: str(c.name), lat: num(c.lat) ? c.lat : null, lon: num(c.lon) ? c.lon : null, note: str(c.note) })),
      places: (Array.isArray(d.places) ? d.places : []).filter(p => p && p.id).map(p => ({
        id: p.id, name: str(p.name), countryId: str(p.countryId), kind: str(p.kind) || 'other',
        lat: num(p.lat) ? p.lat : null, lon: num(p.lon) ? p.lon : null, note: str(p.note), ...(p.era ? { era: p.era } : {}) })),
      // the shared mark library (a definition each holder's copy points at) and the prospective skills
      marks: (Array.isArray(d.marks) ? d.marks : []).filter(m => m && m.id).map(asDefinition),
      skillDrafts: (Array.isArray(d.skillDrafts) ? d.skillDrafts : []).filter(x => x && x.id).map(normalizeSkillDraft),
      items: (Array.isArray(d.items) ? d.items : []).filter(i => i && i.id).map(i => ({
        id: i.id, name: str(i.name), desc: str(i.desc), origin: normalizeOrigin(i), originCircumstance: str(i.originCircumstance),
        history: (Array.isArray(i.history) ? i.history : []).map(normalizeHistoryEntry), wip: i.wip === true,
        weight: str(i.weight), appearance: str(i.appearance), maker: str(i.maker),
        marks: (Array.isArray(i.marks) ? i.marks : []).map(normalizeMark), note: str(i.note),
        icon: str(i.icon), image: str(i.image), rank: rankNum(i.rank), tier: TIERS.includes(i.tier) ? i.tier : '',
        // a v1 library (or an old export / snapshot) has a plain `states[]` and no stateTracks: that list becomes the Item track
        stateTracks: normalizeTracks(i.stateTracks, Array.isArray(i.stateTracks) ? null : (Array.isArray(i.states) ? i.states : null)) }))
    };
  }
  // One item through the normalizer, and which of its fields differ between two versions (for Merge's "update items").
  const normalizeItem = i => normalize({ items: [i] }).items[0] || null;
  function itemChanges(current, incoming) {
    const a = normalizeItem(current), b = normalizeItem(incoming);
    if (!a || !b) return [];
    return Object.keys(b).filter(k => k !== 'id' && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  }
  let cache = null, cacheRaw = null;
  function read() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (cache && raw === cacheRaw) return cache;
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
    // first load of a version 1 library: keep the raw copy once so the conversion can always be undone
    if (parsed && (parsed.version || 1) < 3) {
      const key = (parsed.version || 1) < 2 ? BACKUP_V1 : BACKUP_V2;
      try { if (localStorage.getItem(key) == null) localStorage.setItem(key, raw); } catch (e) { /* storage refused */ }
    }
    cache = normalize(parsed); cacheRaw = raw;
    return cache;
  }
  // Display reads use the cache; it is dropped whenever any tab saves.
  function get() { return cache || read(); }
  function save(lib) {
    const raw = JSON.stringify(normalize(lib));
    try { localStorage.setItem(KEY, raw); } catch (e) { return null; }
    cache = null; cacheRaw = null;
    return read();
  }
  function update(fn) {
    cache = null;
    const lib = JSON.parse(JSON.stringify(read())); // latest stored copy, never the cached object
    fn(lib);
    return save(lib);
  }
  const listeners = [];
  global.addEventListener && global.addEventListener('storage', (e) => {
    if (e.key !== KEY && e.key !== null) return;
    cache = null;
    listeners.forEach(fn => { try { fn(); } catch (err) { console.error(err); } });
  });

  // Helpers both pages use.
  const item = id => (id && get().items.find(i => i.id === id)) || null;
  const placeById = id => (id && get().places.find(p => p.id === id)) || null;

  // State ids are unique across an item's tracks, so a state is found by id alone.
  const stateOf = (it, stateId) => {
    if (!it || !stateId) return null;
    for (const t of it.stateTracks || []) { const s = t.states.find(x => x.id === stateId); if (s) return s; }
    return null;
  };
  const trackOf = (it, stateId) => (it && stateId && (it.stateTracks || []).find(t => t.states.some(s => s.id === stateId))) || null;
  // The current state in every track an entry picks: [{ track, state }] in Item → Usage → custom order.
  function currentStates(it, entry) {
    const ids = normalizeStateIds(entry && entry.stateIds);
    return ((it && it.stateTracks) || []).map(t => ({ track: t, state: t.states.find(s => s.id === ids[t.kind]) || null })).filter(x => x.state);
  }
  // Every chapter version that carries the item, in chapter order:
  // [{ charId, who, snapId, ch, label, stateIds }]
  function uses(itemId, characters) {
    const rows = [];
    (characters || []).forEach(c => (c.snapshots || []).forEach(s => (s.inventory || []).forEach(e => {
      if (e.itemId === itemId) rows.push({ charId: c.id, who: c.name || 'Unnamed', snapId: s.id,
        ch: Number.isInteger(s.startChapter) ? s.startChapter : null, label: s.chapterRange || '', stateIds: normalizeStateIds(e.stateIds) });
    })));
    rows.sort((a, b) => (a.ch == null) - (b.ch == null) || (a.ch || 0) - (b.ch || 0) || a.who.localeCompare(b.who));
    return rows;
  }
  // ---- rank and tier -------------------------------------------------------
  const rankName = n => RANKS[rankNum(n)] || '';
  // Lowest tier a rank allows: ranks 1–3 mundane, 4–6 transcendent, 7 divine (unset rank = no floor).
  const tierFloor = rank => { const r = rankNum(rank); return r >= 7 ? 'divine' : r >= 4 ? 'transcendent' : 'mundane'; };
  const allowedTiers = rank => TIERS.slice(TIERS.indexOf(tierFloor(rank)));
  // `asOf` (a chapter number) is for a reader's view of a published copy: a binding counts only from the chapter that WROTE it (`revealedIn`),
  // for as far as the reader has read. So rank updates when the author writes a later chapter that reveals more, whichever chapter's
  // version is open. The author's data has no `revealedIn`, so nothing is held back.
  const revealedBy = (m, asOf) => asOf == null || !Number.isInteger(m && m.revealedIn) || m.revealedIn <= asOf;
  const bindingRank = (m, asOf) => (m && m.kind === 'binding' && revealedBy(m, asOf) ? rankNum(m.rank) : 0);
  // The highest rank an item can ever reach: its base rank or any binding, in any state.
  function maxRank(it, asOf) {
    if (!it) return 0;
    let r = rankNum(it.rank);
    (it.marks || []).forEach(m => { r = Math.max(r, bindingRank(m, asOf)); });
    (it.stateTracks || []).forEach(t => t.states.forEach(s => (s.marks || []).forEach(m => { r = Math.max(r, bindingRank(m, asOf)); })));
    return r;
  }
  // The item's rank right now: the highest of its base rank and its ACTIVE bindings (the item's own plus
  // those of the states an entry is in; with no entry, each track's primary state). Losing the binding that
  // gave the reach lowers the rank again.
  function rankAt(it, entry, asOf) {
    if (!it) return 0;
    let r = rankNum(it.rank);
    (it.marks || []).forEach(m => { r = Math.max(r, bindingRank(m, asOf)); });
    // a track the entry doesn't pick counts as its primary (normal) state
    const ids = normalizeStateIds(entry && entry.stateIds);
    const states = (it.stateTracks || []).map(t =>
      t.states.find(s => s.id === ids[t.kind]) || t.states.find(s => s.id === t.primaryStateId) || t.states[0]).filter(Boolean);
    states.forEach(s => (s.marks || []).forEach(m => { r = Math.max(r, bindingRank(m, asOf)); }));
    return r;
  }
  // '' when the item's tier is fine, else the reason (for the editor's lock and the checks).
  function tierProblem(it) {
    if (!it || !it.tier) return '';
    const mx = maxRank(it);
    return TIERS.indexOf(it.tier) < TIERS.indexOf(tierFloor(mx))
      ? `Rank ${mx} (${rankName(mx)}) needs at least ${tierFloor(mx)}, but the tier is ${it.tier}.` : '';
  }

  // ---- the shared mark library (plan Phase 6) ----
  // A holder keeps an ordinary mark (so every reader still works) plus `libId`: the definition it was copied from.
  const libraryMark = id => (id && get().marks.find(m => m.id === id)) || null;
  // A fresh copy of a definition for a holder: its own id and its own stage, linked by libId.
  function copyFromLibrary(id) {
    const def = libraryMark(id); if (!def) return null;
    const o = { ...asDefinition(def), id: newId('mark'), libId: def.id };
    return o;
  }
  // A mark's definition as a library entry (without a holder's stage or link); the caller adds it with update().
  function toDefinition(mark) { return { ...asDefinition(mark), id: newId('lmark') }; }
  // `copy` brought up to date with its definition: the definition's words, the copy's own id, stage and link.
  function applyDefinition(copy, def) {
    const o = { ...asDefinition(def), id: copy.id, libId: def.id };
    if (o.kind === 'curse') o.stage = copy.kind === 'curse' && Number.isInteger(copy.stage) ? copy.stage : 0;
    return o;
  }
  // Everywhere a definition's copies live: [{ where: 'character'|'entry'|'item'|'state', who, charId?, snapId?, chapter?, itemId?, stage }]
  function markHolders(libId, characters) {
    const rows = [], is = m => m && m.libId === libId;
    (characters || []).forEach(c => (c.snapshots || []).forEach(s => {
      const at = { charId: c.id, who: c.name || 'Unnamed', snapId: s.id, chapter: Number.isInteger(s.startChapter) ? s.startChapter : null };
      (s.marks || []).filter(is).forEach(m => rows.push({ where: 'character', ...at, stage: m.stage || 0 }));
      (s.inventory || []).forEach(e => (e.marks || []).filter(is).forEach(m => rows.push({ where: 'entry', ...at, itemId: e.itemId || '', stage: m.stage || 0 })));
    }));
    get().items.forEach(it => {
      (it.marks || []).filter(is).forEach(m => rows.push({ where: 'item', who: it.name || 'Unnamed', itemId: it.id, stage: m.stage || 0 }));
      (it.stateTracks || []).forEach(t => t.states.forEach(st => (st.marks || []).filter(is).forEach(m => rows.push({ where: 'state', who: `${it.name || 'Unnamed'} (${st.name || 'state'})`, itemId: it.id, stage: m.stage || 0 }))));
    });
    return rows;
  }
  const skillDraftById = id => (id && get().skillDrafts.find(x => x.id === id)) || null;

  // ---- helpers for an inventory entry's states (entry.stateIds = { item, usage, custom }) ----
  const stateIdOf = (entry, kind) => normalizeStateIds(entry && entry.stateIds)[kind || 'item'] || '';
  const itemStates = it => { const t = itemTrack(it); return t ? t.states : []; };
  // the normal state of every track an item has: { item: id, usage: id, ... } (a new chapter's copy starts there)
  function primaryStateIds(it) {
    const out = {};
    ((it && it.stateTracks) || []).forEach(t => { const s = t.states.find(x => x.id === t.primaryStateId) || t.states[0]; if (s) out[t.kind] = s.id; });
    return out;
  }
  // one string that changes when any track's state changes (for comparing two chapters)
  const stateKeyOf = entry => { const ids = normalizeStateIds(entry && entry.stateIds); return TRACK_KINDS.map(k => ids[k] || '').join('|'); };
  // A chapter's marks when it is in a state: the item's own marks plus the current states', as fresh copies.
  // `picked` is one state id (the Item track, as before) or a { item, usage, custom } object.
  function marksFor(it, picked) {
    const ids = typeof picked === 'object' && picked ? normalizeStateIds(picked) : normalizeStateIds(null, picked || '');
    const extra = [];
    ((it && it.stateTracks) || []).forEach(t => { const s = t.states.find(x => x.id === ids[t.kind]); if (s) extra.push(...s.marks); });
    return ((it && it.marks) || []).concat(extra).map(m => ({ ...normalizeMark(m), id: newId('mark') }));
  }

  global.EpitaphLibrary = {
    KEY, BACKUP_V1, BACKUP_V2, BACKUP_BEFORE_MERGE, normalizeItem, itemChanges, normalizeSkillDraft, libraryMark, copyFromLibrary, toDefinition, applyDefinition, markHolders, skillDraftById, STATE_COLORS, TRACK_KINDS, TRACK_NAMES, MAX_STATES,
    newId, normalizeMark, normalizeState, normalizeTrack, normalizeStateIds, get, update, item, place: placeById,
    stateOf, trackOf, itemTrack, currentStates, uses, marksFor, stateIdOf, itemStates, primaryStateIds, stateKeyOf, revealedBy,
    CURSE_TYPES, STAGE_NAMES, markKindsFor, markDetailLines,
    ERAS, ORIGIN_WORDS, placeIdOf, itemsFromPlace, normalizeHistoryEntry, compareWhen, whenText, OFFLINE_FIELDS, fieldOn,
    RANKS, TIERS, rankName, tierFloor, allowedTiers, maxRank, rankAt, tierProblem,
    replace(data) { return save(data); },
    onChange(fn) { listeners.push(fn); }
  };
  if (global.EpitaphWorld) {
    global.EpitaphWorld.setExtras(() => { const l = get(); return { countries: l.countries, places: l.places }; });
  }
})(typeof window !== 'undefined' ? window : globalThis);
