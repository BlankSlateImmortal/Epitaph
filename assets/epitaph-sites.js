/* Epitaph — Site Encyclopedia data (opse). The written side of every place on the map.
 * Schema agreed 2026-11-18: docs/plans/site-schema.md. Places themselves (names, coordinates) stay in
 * assets/epitaph-world.js; this file only adds records keyed by place id. Dates are timeline event ids
 * (assets/epitaph-timeline.js), so spoilers follow the reader's chapter.
 *
 * Record: { placeId, states, rule, alliances, resources, beasts, founding, draft }
 *   states:    [{ from: eventId|null, status, scales: { size … written: 1..7 }, note }]  (null = since before the story)
 *   rule:      { form, holders: [{ ref, title, from, to }], laws: [..], outsiders, stance }
 *   alliances: [{ with: 'place:<id>', kind, from, to, secret, note }]  stored on one side, shown on both (alliancesOf)
 *   resources: [{ name, category, role, source? }]
 *   beasts:    [{ ref: 'creature:<id>', relation, note }]
 *   founding:  [{ stage, when, why, who, materials, reused, change }]
 *   draft:     { <tab>: true } for each tab that is still Claude's draft
 *
 * The records are stored under 'epitaph-sites' as whole tabs per place (on top of DEFAULTS, which is empty: the lore drafts are
 * private and are merged in from the vault, see docs/plans/publish-readonly.md).
 */
(function (global) {
  'use strict';
  const KEY = 'epitaph-sites';
  const VERSION = 1;

  // ---- the seven 7-sets (docs/plans/site-schema.md) ----
  const STATUS = [
    { id: 'founding', label: 'Founding' }, { id: 'rising', label: 'Rising' }, { id: 'standing', label: 'Standing' },
    { id: 'strained', label: 'Strained' }, { id: 'besieged', label: 'Besieged' }, { id: 'ruined', label: 'Ruined' },
    { id: 'erased', label: 'Erased' }
  ];
  const SCALES = [
    { id: 'size', label: 'Size', rule: 'Headcount, each step about ×4–5',
      steps: ['Outpost (<50)', 'Hamlet (<250)', 'Village (<1k)', 'Town (<5k)', 'City (<25k)', 'Great city (<100k)', 'Metropolis (100k+)'] },
    { id: 'hold', label: 'Hold', rule: 'How firmly the rulers control it',
      steps: ['Lawless', 'Loose', 'Contested', 'Governed', 'Ordered', 'Strict', 'Absolute'] },
    { id: 'stability', label: 'Stability', rule: 'How close it is to breaking',
      steps: ['Collapsing', 'Failing', 'Shaken', 'Steady', 'Secure', 'Rooted', 'Unshakable'] },
    { id: 'supply', label: 'Supply', rule: 'Can it feed and run itself',
      steps: ['Starving', 'Dependent', 'Short', 'Enough', 'Surplus', 'Trader', 'Provider'] },
    { id: 'defence', label: 'Defence', rule: 'What it takes to break in',
      steps: ['Open', 'Watched', 'Walled', 'Garrisoned', 'Fortified', 'Warded (a barrier)', 'Unbreachable'] },
    { id: 'secrecy', label: 'Secrecy', rule: 'Who knows it exists',
      steps: ['Known to all', 'Known', 'Discreet', 'Guarded', 'Hidden', 'Secret', 'Unseen (even by the Voice)'] },
    { id: 'written', label: 'Written', rule: 'How much of it the Narrative sees',
      steps: ['Unwritten', 'Faint', 'Sketched', 'Written', 'Inscribed', 'Storied', 'Scripture'] }
  ];
  const FORMS = [
    { id: 'hidden-god', label: 'Hidden god', rule: 'A ruler who is never seen' },
    { id: 'church', label: 'Church', rule: 'Clergy rule in a god\'s name' },
    { id: 'monarch', label: 'Monarch', rule: 'One ruler, or a line of them' },
    { id: 'command', label: 'Command', rule: 'An Era 0 chain of command' },
    { id: 'council', label: 'Council', rule: 'Elders or an assembly' },
    { id: 'outpost', label: 'Outpost', rule: 'Run from somewhere else' },
    { id: 'none', label: 'None', rule: 'Ruin, sunk or erased' }
  ];
  const ALLIANCE_KINDS = [
    { id: 'alliance', label: 'Alliance', rule: 'A pact' },
    { id: 'vassal', label: 'Vassal', rule: 'One serves the other' },
    { id: 'trade', label: 'Trade', rule: 'Goods or people move between them' },
    { id: 'truce', label: 'Truce', rule: 'An uneasy peace' },
    { id: 'rivalry', label: 'Rivalry', rule: 'Opposed, short of war' },
    { id: 'war', label: 'War', rule: 'Open fighting' },
    { id: 'covert', label: 'Covert', rule: 'One works inside the other in secret' }
  ];
  const BEAST_RELATIONS = [
    { id: 'common', label: 'Common' }, { id: 'hunted', label: 'Hunted' }, { id: 'feared', label: 'Feared' },
    { id: 'kept', label: 'Kept' }, { id: 'worshipped', label: 'Worshipped' }, { id: 'warded', label: 'Warded off' },
    { id: 'studied', label: 'Studied' }
  ];
  const RESOURCE_CATEGORIES = [
    { id: 'food', label: 'Food' }, { id: 'air-water', label: 'Air & water' }, { id: 'materials', label: 'Materials' },
    { id: 'energy', label: 'Energy' }, { id: 'relics', label: 'Relics & knowledge' }, { id: 'people', label: 'People' },
    { id: 'power', label: 'Power' }
  ];
  const RESOURCE_ROLES = ['produces', 'needs', 'scarce', 'guards'];   // not a scale, so four
  const FOUNDING_STAGES = [
    { id: 'reason', label: 'The reason' }, { id: 'ground', label: 'Ground broken' }, { id: 'walls', label: 'First walls' },
    { id: 'growth', label: 'Growth' }, { id: 'disaster', label: 'Disaster' }, { id: 'rebuilt', label: 'Rebuilt' },
    { id: 'present', label: 'As it stands' }
  ];
  const TABS = ['states', 'rule', 'alliances', 'resources', 'beasts', 'founding'];

  // No lore ships in this file (it is public). The drafts live in the author's vault (epitaph-drafts.json) and come in through
  // the Dossier's Data > Merge; readers get a filtered snapshot instead. DEFAULTS stays so a default can be added again.
  const DEFAULTS = [];

  // ---- storage: whole tabs per place on top of the defaults ----
  const clone = o => JSON.parse(JSON.stringify(o));
  function readStore() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.places) return s; } catch (e) {}
    return { version: VERSION, places: {} };
  }
  function writeStore(s) {
    try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, s, { version: VERSION }))); return true; } catch (e) { return false; }
  }
  function empty(placeId) {
    return { placeId, states: [], rule: { form: 'none', holders: [], laws: [], outsiders: '', stance: '' }, alliances: [], resources: [], beasts: [], founding: [], draft: {} };
  }
  function normalise(r) {
    const out = Object.assign(empty(r && r.placeId), r || {});
    ['states', 'alliances', 'resources', 'beasts', 'founding'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
    out.rule = Object.assign(empty().rule, out.rule || {});
    out.draft = Object.assign({}, out.draft || {});
    return out;
  }
  /** Every record: defaults with the user's tabs on top, plus places only the user has written. */
  function load() {
    const s = readStore();
    const out = DEFAULTS.map(d => normalise(Object.assign(clone(d), s.places[d.placeId] || {})));
    Object.keys(s.places).forEach(id => { if (!DEFAULTS.some(d => d.placeId === id)) out.push(normalise(Object.assign({ placeId: id }, s.places[id]))); });
    return out;
  }
  function get(placeId, list) { return (list || load()).find(r => r.placeId === placeId) || null; }
  /** Save the given tabs of one place (e.g. { placeId, rule }). A saved tab stops being a draft unless it says otherwise. */
  function save(rec) {
    const s = readStore(), cur = s.places[rec.placeId] || {};
    const next = Object.assign({}, cur, clone(rec));
    const base = get(rec.placeId) || empty(rec.placeId);
    next.draft = Object.assign({}, base.draft, cur.draft || {});
    TABS.forEach(t => { if (t in rec && !(rec.draft && t in rec.draft)) next.draft[t] = false; });
    if (rec.draft) Object.assign(next.draft, rec.draft);
    delete next.placeId;
    s.places[rec.placeId] = next;
    return writeStore(s);
  }
  function reset(placeId) { const s = readStore(); delete s.places[placeId]; return writeStore(s); }

  // ---- backup: the Dossier's Export / Import / Merge carry the user's edits under `sites` ----
  /** The user's stored edits (whole tabs per place), or null when there are none. */
  function exportData() { const s = readStore(); return Object.keys(s.places).length ? clone(s) : null; }
  const validData = o => !!o && typeof o === 'object' && !!o.places && typeof o.places === 'object' && !Array.isArray(o.places);
  /** Replace the stored edits with a backup's. False when the data isn't ours or can't be saved. */
  function importData(o) { return validData(o) ? writeStore({ version: VERSION, places: clone(o.places) }) : false; }
  /** Place ids in a backup that this browser has no edits for (what a merge would add). */
  function newInData(o) { if (!validData(o)) return []; const have = readStore().places; return Object.keys(o.places).filter(id => !(id in have)); }
  /** Merge: add the places this browser has no edits for; never touches an existing one. Returns how many. */
  function mergeData(o) {
    const add = newInData(o); if (!add.length) return 0;
    const s = readStore(); add.forEach(id => { s.places[id] = clone(o.places[id]); });
    return writeStore(s) ? add.length : 0;
  }

  // ---- reading with the reader's chapter ----
  const TL = () => global.EpitaphTimeline || null;
  /** Is an event id (or null = "since before the story") reached by a reader on `chapter`? */
  function reached(eventId, chapter) {
    if (eventId == null) return true;                 // "since before the story": shown as soon as the place itself is
    const t = TL(); if (!t) return true;
    const e = t.byId(eventId);
    return e ? t.isRevealed(e, chapter) : false;      // an id the timeline doesn't have reveals nothing (Checks flags it)
  }
  /** The place's state a reader on `chapter` sees: the last state whose start they've reached. */
  function stateAt(rec, chapter) {
    let cur = null;
    (rec.states || []).forEach(st => { if (reached(st.from, chapter)) cur = st; });
    return cur;
  }
  /** Alliances touching a place, from both sides, each with `other` (the other place's id), seen from that place. */
  function alliancesOf(placeId, list) {
    const out = [];
    (list || load()).forEach(r => (r.alliances || []).forEach(a => {
      const w = String(a.with || '').replace(/^place:/, '');
      if (r.placeId === placeId) out.push(Object.assign({ other: w, owner: r.placeId }, a));
      else if (w === placeId) out.push(Object.assign({ other: r.placeId, owner: r.placeId }, a));
    }));
    return out;
  }
  /** Has a reader on `chapter` reached this place? Its first state must have started; an entry with no states is hidden. */
  /** The chapter that reveals a place to readers (the author's rule): 0 if the entry is `open`; else the first published chapter
   *  that names it in its `world:` list, or that reveals a timeline moment linked to it (`place:<id>` in the moment's refs).
   *  null = no chapter has brought it up yet. */
  function placeRevealChapter(rec) {
    if (!rec) return null;
    if (rec.open) return 0;
    const t = TL(); if (!t) return 0;
    const W = global.EpitaphWorld, p = W && W.place(rec.placeId), full = p ? p.name : rec.placeId;
    let best = t.firstChapter('world', [full, full.split(/\s+[—–-]\s+/).pop(), rec.placeId]);
    t.load().forEach(e => {
      if (!(e.refs || []).includes('place:' + rec.placeId)) return;
      const rc = t.revealChapter(e);
      if (rc != null && (best == null || rc < best)) best = rc;
    });
    return best;
  }
  /** Has a reader on `chapter` read the chapter that reveals this place? */
  function placeReached(rec, chapter) {
    const rc = placeRevealChapter(rec);
    if (rc == null) return false;
    if (rc === 0) return true;
    const t = TL(), r = chapter === undefined ? t.readerChapter() : chapter, at = r == null ? t.latestChapter() : r;
    return at != null && at >= rc;
  }
  /** Names a reader on `chapter` mustn't see yet: every unreached entry's place name, and its short form ("The Hollow Reach"). */
  function hiddenNames(chapter, list) {
    const W = global.EpitaphWorld, out = [];
    (list || load()).forEach(r => {
      if (placeReached(r, chapter)) return;
      const p = W && W.place(r.placeId), full = p ? p.name : r.placeId;
      [full, full.split(/\s+[—–-]\s+/).pop(), r.placeId].forEach(n => { const k = String(n || '').trim().toLowerCase(); if (k.length > 3 && !out.includes(k)) out.push(k); });
    });
    return out;
  }
  /** Free text safe for a reader: '' when it names a place they haven't reached (text can't be gated finer than that).
   *  In Author view, or with `author: true`, text is returned as written. */
  function clean(text, chapter, list, author) {
    if (author === undefined ? authoring() : author) return text;
    const t = String(text == null ? '' : text).toLowerCase();
    return hiddenNames(chapter, list).some(n => t.includes(n)) ? '' : text;
  }
  const authoring = () => { const t = TL(); return !!t && t.authorMode(); };
  /** Alliances a reader on `chapter` may see. A secret alliance stays hidden until its start event is revealed
   *  (a secret with no start date only shows at the latest chapter). `endHidden` is true while the end isn't reached.
   *  In Author view (pass `author: true`, or leave it to the saved view) every alliance is returned, with `hidden`
   *  telling whether a reader would not see it yet. */
  function alliancesAt(placeId, chapter, list, author) {
    const t = TL(), asAuthor = author === undefined ? authoring() : author;
    const atLatest = !t || t.isRevealed({ when: {}, secret: true }, chapter);
    const recs = list || load();
    // a tie to a place the reader hasn't reached stays hidden too, or it would give the place away (a place with no entry doesn't count)
    const otherOk = a => { const r = recs.find(x => x.placeId === a.other); return !r || placeReached(r, chapter); };
    const seen = a => otherOk(a) && (a.secret ? (a.from != null ? reached(a.from, chapter) : atLatest) : reached(a.from, chapter));
    return alliancesOf(placeId, recs).filter(a => asAuthor || seen(a))
      .map(a => Object.assign({}, a, { hidden: !seen(a), ended: a.to != null && reached(a.to, chapter), endHidden: a.to != null && !reached(a.to, chapter) }));
  }
  const label = (set, id) => (set.find(x => x.id === id) || {}).label || id || '';
  const step = (scaleId, n) => { const s = SCALES.find(x => x.id === scaleId); return s && n >= 1 && n <= 7 ? s.steps[n - 1] : '?'; };

  global.EpitaphSites = {
    KEY, VERSION, STATUS, SCALES, FORMS, ALLIANCE_KINDS, BEAST_RELATIONS, RESOURCE_CATEGORIES, RESOURCE_ROLES, FOUNDING_STAGES, TABS, DEFAULTS,
    alliancesAt, placeReached, placeRevealChapter, hiddenNames, clean, authoring, load, get, save, reset, exportData, importData, newInData, mergeData, empty, normalise, reached, stateAt, alliancesOf, label, step
  };
})(typeof window !== 'undefined' ? window : globalThis);
