/* Epitaph — Creature Log data (plan: docs/plans/creature-log.md; schema: docs/plans/creature-schema.md, agreed 2026-11-22).
 *
 * window.EpitaphCreatures. This file holds the agreed shape and the rules that work on it; storage, defaults from the lore and the
 * views come in later steps (1.5, 1.6, Phase 2). Built so far:
 *   - time: seven EPOCHS (the whole history) and seven AGES, A to G, inside the last one; anything dated names an epoch, an age,
 *     or a timeline event.
 *   - the three seven-step SCALES (awareness, threat, size), each step tied to a rule.
 *   - curses are Library marks (assets/epitaph-library.js); this file only adds the optional creature/place fields and the rules
 *     that hold for every curse.
 *   - the food web (step 1.4): links { eater, eaten, when }, who eats whom at an age, and each creature's role in it.
 *   - storage (step 1.6): key `epitaph-creatures`, records by id, backup / merge through the Dossier, and the problems Checks reports.
 */
(function (global) {
  'use strict';
  const sset = rows => rows.map(r => ({ id: r[0], label: r[1], rule: r[2] || '' }));

  // ---- time ----
  /** The seven epochs: the whole history, from before time to Epitaph. `events` are timeline moments that fall in the epoch. */
  const EPOCHS = [
    { id: 'chaos', label: 'Chaos', events: ['creation-myth'] },
    { id: 'waking', label: 'The Waking', events: [] },
    { id: 'narrative', label: 'The Narrative', events: ['narrative-made'] },
    { id: 'worlds', label: 'The Making of Worlds', events: ['bearings'] },
    { id: 'war', label: 'The War of the Gods', events: ['omniscience-sealed', 'erasure-sealed-book', 'omniscience-opened', 'sils-sealed', 'war-of-gods'] },
    { id: 'twisted', label: 'The Twisted Worlds', events: ['experiments'] },
    { id: 'epitaph', label: 'Epitaph', events: ['core-built'] }
  ];
  /** The seven ages inside the Epitaph epoch. The last three follow a curse's cycle. */
  const AGES = [
    { id: 'A', label: 'The Transplant', from: 'face-earth', to: 'face-earth' },
    { id: 'B', label: 'The Long Quiet', from: 'face-earth', to: 'vale-arrives' },
    { id: 'C', label: "Vale's Century", from: 'vale-arrives', to: 'the-descent' },
    { id: 'D', label: 'The Siege', from: 'the-siege', to: 'the-siege' },
    { id: 'E', label: 'The Binding', from: 'the-barriers', to: null, cursePhase: 'awakening' },
    { id: 'F', label: 'The First Generations', from: null, to: 'orin-arrives', cursePhase: 'fluctuation' },
    { id: 'G', label: "The Story's Eve", from: 'orin-arrives', to: 'ch-1', cursePhase: 'stabilization' }
  ];
  const AGE_IDS = AGES.map(a => a.id);
  /** A point in the log's time as one number, for ordering: epochs 0–6, ages inside the last epoch as 6.1–6.7.
   *  when: { epoch } | { age } | 'A'…'G' | an epoch id. Unknown → null. */
  function timeIndex(when) {
    if (when == null) return null;
    const w = typeof when === 'string' ? (AGE_IDS.includes(when) ? { age: when } : { epoch: when }) : when;
    if (w.age && AGE_IDS.includes(w.age)) return 6 + (AGE_IDS.indexOf(w.age) + 1) / 10;
    const e = EPOCHS.findIndex(x => x.id === w.epoch);
    return e < 0 ? null : e;
  }

  // ---- scales (seven steps, each tied to a rule) ----
  const SCALES = {
    awareness: { id: 'awareness', label: 'Awareness', rule: '5 and up is conscious: its curses rest only briefly and re-cycle when something affects it; only sentient cursed creatures can live in cursed environments',
      steps: ['Instinct', 'Cunning', 'Clever', 'Aware', 'Sentient', 'Sapient', 'Self-made'] },
    threat: { id: 'threat', label: 'Threat', rule: 'How dangerous it is to people; what a Warded Domain must hold back',
      steps: ['Harmless', 'Wary', 'Dangerous', 'Deadly', 'Pack-killer', 'Settlement-ending', 'Calamity'] },
    size: { id: 'size', label: 'Size', rule: 'What it can nest in, and how far off it is seen',
      steps: ['Mote', 'Small', 'Person-sized', 'Large', 'Huge', 'Colossal', 'Titanic'] }
  };
  const CONSCIOUS_FROM = 5;
  const isConscious = c => !!c && Number.isInteger(c.awareness) && c.awareness >= CONSCIOUS_FROM;

  // ---- curses (Library marks; these are the extra, optional fields) ----
  const CURSE_STATES = sset([['physical', 'Physical', 'Can move'], ['infectious', 'Infectious', 'Spreads through air, land and sea'], ['metaphysical', 'Stationary and metaphysical', 'Unseen until it is too late']]);
  const CURSE_PHASES = ['awakening', 'fluctuation', 'stabilization'];
  /** What holds for every curse (the user's rules, 2026-11-22). */
  const CURSE_RULES = {
    era0: 'Era 0 people die at once in cursed ground.',
    era1: 'The Era 1-born can survive in it.',
    storyborn: 'Storyborn resist by rank: the higher the rank, the more immune.',
    voided: 'The Voided destroy a curse with erasure where they stand, until it reforms; they cannot destroy a whole cursed environment.',
    fixed: 'No curse can be fixed.',
    nesting: 'Only cursed creatures nest; only sentient cursed creatures can live in cursed environments.'
  };
  /** A curse's extra fields, cleaned (unknown values dropped; old item curses simply have none). */
  function curseExtras(m) {
    const o = {};
    if (!m) return o;
    if (CURSE_STATES.some(s => s.id === m.state)) o.state = m.state;
    if (Array.isArray(m.spreadsBy)) { const v = m.spreadsBy.filter(x => ['air', 'land', 'sea'].includes(x)); if (v.length) o.spreadsBy = v; }
    if (m.moves === 'slow') o.moves = 'slow';
    if (Array.isArray(m.concepts)) { const v = m.concepts.filter(x => ['nothing', 'fate', 'imagination', 'reality', 'chaos'].includes(x)); if (v.length) o.concepts = v; }
    if (m.rest === 'eons' || m.rest === 'short') o.rest = m.rest;
    return o;
  }
  /** How long a holder's curse rests after Stabilization: conscious holders only briefly (the user's rule). */
  const restFor = (holder, curse) => isConscious(holder) ? 'short' : ((curse && curse.rest) || 'eons');

  // ---- the food web (step 1.4) ----
  /** One link, cleaned: { eater, eaten, when } with `when` an age or epoch (null = always, as far as the log knows). */
  function normFood(l) {
    if (!l || !l.eater || !l.eaten || l.eater === l.eaten) return null;
    const when = l.when == null ? null : (timeIndex(l.when) == null ? null : l.when);
    return { eater: String(l.eater), eaten: String(l.eaten), when, note: l.note ? String(l.note) : '' };
  }
  /** Is a creature alive at a point in time? It appears at `when` (unknown = always) and is gone from `extinct` on. */
  function aliveAt(c, at) {
    if (!c) return false;
    const t = timeIndex(at); if (t == null) return true;
    const from = timeIndex(c.when), to = timeIndex(c.extinct);
    return (from == null || from <= t) && (to == null || t < to);
  }
  /** The links in force at a point in time: the link has begun (`when` at or before), and both creatures are alive then.
   *  creatures: [{ id, when, extinct }]. A link to a creature the list doesn't have is dropped (Checks name it, step 1.6).
   *  Each pair is kept once (the earliest link). */
  function foodAt(at, links, creatures) {
    const t = timeIndex(at), by = new Map((creatures || []).map(c => [c.id, c])), seen = new Set(), out = [];
    (links || []).map(normFood).filter(Boolean)
      .sort((a, b) => (timeIndex(a.when) ?? -1) - (timeIndex(b.when) ?? -1))
      .forEach(l => {
        const e = by.get(l.eater), p = by.get(l.eaten); if (!e || !p) return;
        const lt = timeIndex(l.when);
        if (t != null && lt != null && lt > t) return;
        if (t != null && (!aliveAt(e, at) || !aliveAt(p, at))) return;
        const k = l.eater + '>' + l.eaten; if (seen.has(k)) return; seen.add(k);
        out.push(l);
      });
    return out;
  }
  /** Each creature's role in the web at a point in time.
   *  apex: eats something and nothing eats it · keystone: the only food of 2+ eaters, or eaten by 4+ · base: eats nothing in the log
   *  (plants, scavengers of what the log doesn't track) · prey and predator counts for the views.
   *  -> { [id]: { eats: [ids], eatenBy: [ids], apex, keystone, base, soleFoodOf: [ids] } } for every creature alive at `at`. */
  function webRoles(at, links, creatures) {
    const live = (creatures || []).filter(c => aliveAt(c, at)), L = foodAt(at, links, live), R = {};
    live.forEach(c => { R[c.id] = { eats: [], eatenBy: [], apex: false, keystone: false, base: false, soleFoodOf: [] }; });
    L.forEach(l => { R[l.eater].eats.push(l.eaten); R[l.eaten].eatenBy.push(l.eater); });
    Object.keys(R).forEach(id => { const r = R[id]; if (r.eats.length === 1) R[r.eats[0]].soleFoodOf.push(id); });
    Object.keys(R).forEach(id => { const r = R[id];
      r.base = !r.eats.length; r.apex = !!r.eats.length && !r.eatenBy.length;
      r.keystone = r.soleFoodOf.length >= 2 || r.eatenBy.length >= 4; });
    return R;
  }
  /** What a creature's loss would starve: the creatures whose only food it is, and (through them) the ones that only eat those.
   *  -> [ids] in the order they would go. */
  function wouldStarve(id, at, links, creatures) {
    let live = (creatures || []).filter(c => aliveAt(c, at)), gone = new Set([id]), out = [];
    for (let changed = true; changed;) {
      changed = false;
      const L = foodAt(at, links, live.filter(c => !gone.has(c.id))), eatsAny = new Set(L.map(l => l.eater));
      const allLinks = foodAt(at, links, live);
      live.forEach(c => {
        if (gone.has(c.id)) return;
        const had = allLinks.some(l => l.eater === c.id);
        if (had && !eatsAny.has(c.id)) { gone.add(c.id); out.push(c.id); changed = true; }
      });
    }
    return out;
  }

  // ---- storage (step 1.6): records by id on top of nothing: the log ships empty; the user's creatures, and the example lineage and the
  //      infected places from the user's vault, arrive through the Dossier's Merge (so no private lore is in the site's code) ----
  const KEY = 'epitaph-creatures', BACKUP_KEY = 'epitaph-creatures-backup-v1', VERSION = 1;
  const KINDS = ['nodes', 'creatures', 'chaos', 'biomes', 'places'];          // record collections (food links are a list of their own)
  const clone = o => JSON.parse(JSON.stringify(o));
  const str = v => (v == null ? '' : String(v));
  const lst = v => (Array.isArray(v) ? v : []);
  const scale = v => (Number.isInteger(v) && v >= 1 && v <= 7 ? v : null);
  const whenOf = w => (w == null || w === '' ? null : (timeIndex(w) == null && typeof w !== 'string' ? null : w));      // an epoch, an age, or a timeline event id
  const curseRef = c => (c && typeof c === 'object' && c.libId ? { libId: String(c.libId), stage: Number.isInteger(c.stage) && c.stage >= 0 && c.stage <= 3 ? c.stage : 0 } : null);
  const base = r => ({ id: str(r.id), name: str(r.name), draft: r.draft === undefined ? true : !!r.draft, hidden: !!r.hidden,
    revealedIn: Number.isInteger(r.revealedIn) ? r.revealedIn : null, example: r.example === true });
  function normNode(r) {
    r = r || {};
    return Object.assign(base(r), { parentId: r.parentId ? String(r.parentId) : null, root: str(r.root), when: whenOf(r.when), extinct: whenOf(r.extinct), cause: r.cause == null || r.cause === '' ? null : str(r.cause),
      mutation: { change: str(r.mutation && r.mutation.change), advantage: str(r.mutation && r.mutation.advantage), curse: r.mutation && r.mutation.curse ? str(r.mutation.curse) : null },
      biomes: lst(r.biomes).map(str), silhouette: str(r.silhouette) });
  }
  function normCreature(r) {
    r = r || {};
    return Object.assign(normNode(r), { awareness: scale(r.awareness), threat: scale(r.threat), size: scale(r.size),
      curses: lst(r.curses).map(curseRef).filter(Boolean),
      traits: lst(r.traits).map(t => ({ name: str(t && t.name), does: str(t && t.does), counters: str(t && t.counters) })).filter(t => t.name || t.does),
      anatomy: { parts: lst(r.anatomy && r.anatomy.parts).map(x => ({ name: str(x && x.name), note: str(x && x.note) })), model: str(r.anatomy && r.anatomy.model) },
      range: { biomes: lst(r.range && r.range.biomes).map(str), places: lst(r.range && r.range.places).map(str),
        migrations: lst(r.range && r.range.migrations).map(m => ({ path: lst(m && m.path).filter(q => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite)), when: whenOf(m && m.when) })) },
      nests: lst(r.nests).map(str),
      sightings: lst(r.sightings).map(x => ({ chapter: Number.isInteger(x && x.chapter) ? x.chapter : null, placeId: str(x && x.placeId), note: str(x && x.note) })),
      diet: str(r.diet), hunting: str(r.hunting), breeding: str(r.breeding),
      names: lst(r.names).map(x => ({ placeId: str(x && x.placeId), localName: str(x && x.localName), belief: str(x && x.belief) })),
      fieldNotes: lst(r.fieldNotes).map(x => ({ author: str(x && x.author), charId: str(x && x.charId), when: whenOf(x && x.when), text: str(x && x.text) })) });
  }
  function normChaos(r) {
    r = r || {};
    return Object.assign(base(r), { forms: lst(r.forms).map(f => ({ biome: str(f && f.biome), looks: str(f && f.looks) })),
      sightings: lst(r.sightings).map(x => ({ chapter: Number.isInteger(x && x.chapter) ? x.chapter : null, placeId: str(x && x.placeId), note: str(x && x.note) })),
      curseLink: str(r.curseLink) });
  }
  function normBiome(r) {
    r = r || {};
    return Object.assign(base(r), { desc: str(r.desc), regions: lst(r.regions).map(str), placeBound: !!r.placeBound, spread: str(r.spread), since: whenOf(r.since) });
  }
  function normPlace(r) {
    r = r || {};
    const g = r.ground || {};
    return Object.assign(base(r), { biome: str(r.biome), lon: Number.isFinite(r.lon) ? r.lon : null, lat: Number.isFinite(r.lat) ? r.lat : null, country: str(r.country), continent: str(r.continent),
      ground: { state: str(g.state), elev: Number.isFinite(g.elev) ? g.elev : null }, since: whenOf(r.since), curse: curseRef(r.curse),     // null = not written yet (shown as "not known yet", never flagged)
      notes: str(r.notes), sitePlaceId: str(r.sitePlaceId) });
  }
  const NORM = { nodes: normNode, creatures: normCreature, chaos: normChaos, biomes: normBiome, places: normPlace };
  const emptyStore = () => ({ version: VERSION, nodes: [], creatures: [], chaos: [], biomes: [], places: [], food: [] });
  function readStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!raw || typeof raw !== 'object') return emptyStore();
      const out = emptyStore(); KINDS.forEach(k => { out[k] = lst(raw[k]).filter(x => x && x.id).map(NORM[k]); });
      out.food = lst(raw.food).map(normFood).filter(Boolean);
      return out;
    } catch (e) { return emptyStore(); }
  }
  function writeStore(st) {
    try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, st, { version: VERSION }))); return true; } catch (e) { return false; }
  }
  const load = () => readStore();
  /** The record for an id, from nodes, creatures or chaos (a `creature:<id>` link points here), with its kind; null when there isn't one. */
  function byId(id) {
    const i = str(id).replace(/^creature:/, ''), st = readStore();
    for (const k of ['creatures', 'nodes', 'chaos']) { const r = st[k].find(x => x.id === i); if (r) return Object.assign({}, r, { kind: k }); }
    return null;
  }
  /** Add or replace one record (by id) in a collection. False when the data isn't valid or can't be saved. */
  function put(kind, rec) {
    if (!KINDS.includes(kind) || !rec || !rec.id) return false;
    const st = readStore(), r = NORM[kind](rec), i = st[kind].findIndex(x => x.id === r.id);
    if (i < 0) st[kind].push(r); else st[kind][i] = r;
    return writeStore(st);
  }
  function remove(kind, id) {
    if (!KINDS.includes(kind)) return false;
    const st = readStore(); st[kind] = st[kind].filter(x => x.id !== id); return writeStore(st);
  }
  /** Replace the whole food-web link list. */
  function putFood(links) { const st = readStore(); st.food = lst(links).map(normFood).filter(Boolean); return writeStore(st); }
  /** A unique id for a new record: the name as a slug, then -2, -3 … when it is taken (across nodes, creatures and chaos). */
  function uid(name, taken) {
    const st = readStore(), used = new Set([].concat(st.nodes, st.creatures, st.chaos, st.biomes, st.places, lst(taken)).map(x => (x && x.id) || x));
    const b = str(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'creature';
    let id = b, n = 2; while (used.has(id)) id = b + '-' + n++;
    return id;
  }
  // backup: the Dossier's Export / Import / Merge carry the log under `creatures`
  const validData = o => !!o && typeof o === 'object' && !Array.isArray(o) && (KINDS.some(k => Array.isArray(o[k])) || Array.isArray(o.food));
  const isEmpty = st => !KINDS.some(k => st[k].length) && !st.food.length;
  /** The user's log, or null when it is empty. */
  function exportData() { const st = readStore(); return isEmpty(st) ? null : clone(st); }
  /** Replace the log with a backup's (the log as it was is kept once in the backup key). False when the data isn't ours or can't be saved. */
  function importData(o) {
    if (!validData(o)) return false;
    try { const raw = localStorage.getItem(KEY); if (raw) localStorage.setItem(BACKUP_KEY, raw); } catch (e) { /* no backup room: carry on */ }
    const st = emptyStore(); KINDS.forEach(k => { st[k] = lst(o[k]).filter(x => x && x.id).map(NORM[k]); }); st.food = lst(o.food).map(normFood).filter(Boolean);
    return writeStore(st);
  }
  /** What a merge would add: ids a backup has that the log doesn't ({ nodes: [ids], …, food: n }); a food link counts once per eater > eaten. */
  function newInData(o) {
    const out = {}; if (!validData(o)) return out;
    const st = readStore();
    KINDS.forEach(k => { const have = new Set(st[k].map(x => x.id)), ids = lst(o[k]).filter(x => x && x.id && !have.has(x.id)).map(x => x.id); if (ids.length) out[k] = ids; });
    const haveF = new Set(st.food.map(l => l.eater + '>' + l.eaten)), nf = lst(o.food).map(normFood).filter(l => l && !haveF.has(l.eater + '>' + l.eaten)).length;
    if (nf) out.food = nf;
    return out;
  }
  const countIn = n => Object.keys(n).reduce((t, k) => t + (k === 'food' ? n[k] : n[k].length), 0);
  /** Add what the log doesn't have; nothing you have is ever replaced. Returns how many records were added (0 = nothing, or nothing saved). */
  function mergeData(o) {
    const add = newInData(o), n = countIn(add); if (!n) return 0;
    const st = readStore();
    KINDS.forEach(k => { const ids = new Set(add[k] || []); lst(o[k]).forEach(x => { if (x && ids.has(x.id)) { st[k].push(NORM[k](x)); ids.delete(x.id); } }); });
    if (add.food) { const haveF = new Set(st.food.map(l => l.eater + '>' + l.eaten)); lst(o.food).map(normFood).forEach(l => { if (l && !haveF.has(l.eater + '>' + l.eaten)) { st.food.push(l); haveF.add(l.eater + '>' + l.eaten); } }); }
    return writeStore(st) ? n : 0;
  }

  // ---- checks (step 1.6): what the Dossier's Checks list reports about the log ----
  /** Problems in the log. libMarks: the Library's curse ids (a copy whose definition is gone is a problem; omit to skip that check).
   *  -> [{ rule, id, text }]. A place with no curse written yet is NOT a problem. */
  function problems(st, libMarks) {
    st = st || readStore();
    const out = [], all = [].concat(st.nodes, st.creatures, st.chaos), by = new Map(all.map(x => [x.id, x]));
    const nameOf = x => x.name || x.id, marks = libMarks ? new Set(libMarks) : null;
    [].concat(st.nodes, st.creatures).forEach(x => {
      const p = x.parentId ? by.get(x.parentId) : null;
      if (x.parentId && !p) out.push({ rule: 'creature-parent', id: x.id, text: `${nameOf(x)} descends from “${x.parentId}”, which isn't in the Creature Log.` });
      if (!x.cause && x.mutation && (x.mutation.change || '').trim()) out.push({ rule: 'creature-cause', id: x.id, text: `${nameOf(x)} changed (“${x.mutation.change.slice(0, 40)}”) with no cause: every mutation needs an epoch, an age or a timeline event.` });
      if (p) { const a = timeIndex(x.when), b = timeIndex(p.when); if (a != null && b != null && a < b) out.push({ rule: 'creature-order', id: x.id, text: `${nameOf(x)} is dated before its ancestor ${nameOf(p)}.` }); }
      const ex = timeIndex(x.extinct); if (ex != null && ex <= timeIndex('F') && lst(x.sightings).length) out.push({ rule: 'creature-extinct', id: x.id, text: `${nameOf(x)} is extinct before the story, but has sightings.` });
      if (marks) [].concat(lst(x.curses).map(c => c.libId), x.mutation && x.mutation.curse ? [x.mutation.curse] : []).forEach(id => { if (!marks.has(id)) out.push({ rule: 'creature-curse', id: x.id, text: `${nameOf(x)} has a curse (“${id}”) that is no longer in the Library.` }); });
    });
    st.food.forEach(l => { [l.eater, l.eaten].forEach(id => { if (!by.has(id)) out.push({ rule: 'creature-food', id, text: `A food link names “${id}”, which isn't in the Creature Log.` }); }); });
    if (marks) st.places.forEach(pl => { if (pl.curse && !marks.has(pl.curse.libId)) out.push({ rule: 'creature-curse', id: pl.id, text: `${nameOf(pl)} has a curse (“${pl.curse.libId}”) that is no longer in the Library.` }); });
    return out;
  }

  global.EpitaphCreatures = {
    EPOCHS, AGES, AGE_IDS, timeIndex, SCALES, CONSCIOUS_FROM, isConscious,
    CURSE_STATES, CURSE_PHASES, CURSE_RULES, curseExtras, restFor,
    normFood, aliveAt, foodAt, webRoles, wouldStarve,
    KEY, BACKUP_KEY, VERSION, KINDS, load, byId, put, remove, putFood, uid, exportData, importData, newInData, mergeData, problems
  };
})(typeof window !== 'undefined' ? window : globalThis);
