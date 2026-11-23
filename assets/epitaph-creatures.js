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

  global.EpitaphCreatures = {
    EPOCHS, AGES, AGE_IDS, timeIndex, SCALES, CONSCIOUS_FROM, isConscious,
    CURSE_STATES, CURSE_PHASES, CURSE_RULES, curseExtras, restFor,
    normFood, aliveAt, foodAt, webRoles, wouldStarve,
    byId: () => null          // the records arrive with storage (1.6); until then nothing is in the log
  };
})(typeof window !== 'undefined' ? window : globalThis);
