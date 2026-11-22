/* Epitaph — Site Encyclopedia data (opse). The written side of every place on the map.
 * Schema agreed 2026-11-18: docs/plans/site-schema.md. Places themselves (names, coordinates) stay in
 * assets/epitaph-world.js; this file only adds records keyed by place id. Dates are timeline event ids
 * (assets/epitaph-timeline.js), so spoilers follow the reader's chapter.
 *
 * Schema v2 (2026-11-22): docs/plans/site-schema-v2.md. Seven tabs: Overview · History · Domestic · Foreign · Economy · Beasts · Intrigue.
 * Record: { placeId, model, overview, history, domestic, foreign, economy, beasts, intrigue, scenarios, draft }
 *   overview: { states: [{ from: eventId|null, status, scales: { size … written: 1..7 }, techLevel?, note }] }  (null = since before the story)
 *   history:  { purpose, founders, settlers, founding: [{ stage, when, why, who, materials, reused, change }], myth, name, chronicle,
 *               eras, landmarks, lost, record }
 *   domestic: { government: { form, offices, holders: [{ ref, title, from, to }], succession, laws: [{ text, from, to }], justice,
 *               corruption, citizenship, outsiders, stance }, factions, figures, unrest, society, knowledge, military }
 *   foreign:  { ties: [{ id, with: 'place:<id>', kind, motive, terms, from, to, secret, note … }], blocs, envoys, hostages, agents, borders,
 *               routes, migration, reputation }   ties are stored on one side, shown on both (alliancesOf)
 *   economy:  { resources: [{ id, name, category, role, core, importance, … }], currency, markets, taxes, blackMarket, labour, wealthGap, debts }
 *   beasts:   [{ ref: 'creature:<id>', relation, wards, incidents, … }]
 *   intrigue: { secrets, rumours, questions, hooks, foreshadow, sealed }       scenarios: [what-if records]
 *   draft:    { <tab>: true } for each tab that is still Claude's draft
 * v1 records (states, rule, alliances, resources, founding) are upgraded on load (upgradeRaw) and the old store is backed up once.
 *
 * The records are stored under 'epitaph-sites' as whole tabs per place (on top of DEFAULTS, which is empty: the lore drafts are
 * private and are merged in from the vault, see docs/plans/publish-readonly.md).
 */
(function (global) {
  'use strict';
  const KEY = 'epitaph-sites';
  const VERSION = 2;
  const BACKUP_KEY = 'epitaph-sites-backup-v1';

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
  // ---- v2: the new 7-sets (docs/plans/site-schema-v2.md; the merged sevens and the four scales were approved 2026-11-22) ----
  const sset = rows => rows.map(r => ({ id: r[0], label: r[1], rule: r[2] || '' }));
  const MOTIVES = sset([['faith', 'Faith', 'A shared god or creed'], ['trade', 'Trade', 'Resources, convenience'], ['protection', 'Protection', 'Defence, a beast threat, fear of a third power'],
    ['conquest', 'Conquest', 'Teaming up to overpower someone'], ['bonds', 'Bonds', 'Kinship or marriage, gratitude'], ['tribute', 'Tribute', 'Debt, dues'], ['secrets', 'Secrets', 'Knowledge, infiltration']]);
  const FACTION_KINDS = sset([['ruling', 'Ruling power'], ['faith', 'Faith', 'Religious order, cult'], ['trade', 'Trade', 'Guild or merchant house'], ['arms', 'Arms', 'Military or guard'],
    ['blood', 'Blood', 'Noble houses or bloodlines'], ['learning', 'Learning', 'Scholars, archivists'], ['shadow', 'Shadow', 'Rebels or underground, criminal network']]);
  const TIE_ENDINGS = sset([['lapsed', 'Lapsed', 'Expired, not renewed, quietly lapsed'], ['renegotiated', 'Renegotiated', 'Became something new'], ['betrayed', 'Betrayed'], ['war', 'War'],
    ['absorbed', 'Absorbed', 'One side conquered'], ['erased', 'Erased', 'One side ruined or erased'], ['realigned', 'Realigned', 'A coup or new ruler, a better offer']]);
  const TEMPERAMENTS = sset([['docile', 'Docile'], ['skittish', 'Skittish'], ['territorial', 'Territorial'], ['predatory', 'Predatory'], ['aggressive', 'Aggressive'], ['cunning', 'Cunning'], ['sapient', 'Sapient', 'Thinks, plans, may talk']]);
  const SOCIAL_SHAPES = sset([['solitary', 'Solitary'], ['pair', 'Pair or family'], ['pack', 'Pack'], ['herd', 'Herd or migratory'], ['colony', 'Colony'], ['hive', 'Hive'], ['nest', 'Nest-builders']]);
  const WARD_KINDS = sset([['walls', 'Walls'], ['barriers', 'Barriers of power'], ['culls', 'Culls and hunts'], ['guardians', 'Tamed guardians'], ['offerings', 'Offerings or tribute'], ['pacts', 'Pacts'], ['hidden', 'Hidden location']]);
  const RUMOUR_INTENTS = sset([['mistake', 'Honest mistake'], ['gossip', 'Embellished gossip'], ['slander', 'Malicious slander'], ['propaganda', 'Propaganda'], ['cover', 'Cover story', 'Hides a secret'],
    ['bait', 'Bait', 'A trap'], ['powers', 'The world\'s powers', 'A Narrative rewrite or a Storyborn\'s doing']]);
  const TRIGGER_GROUPS = sset([['ties', 'Ties', 'An alliance breaks'], ['power', 'Power', 'A ruler falls, a faction seizes power, a rebellion'], ['supply', 'Supply', 'A resource runs out, a route is cut'],
    ['beasts', 'Beasts', 'A surge or migration'], ['secrets', 'Secrets', 'One revealed; a key figure captured, killed or defecting'], ['discovery', 'Discovery', 'Technology or a relic'],
    ['catastrophe', 'Catastrophe', 'Plague, flood, fire; a Storyborn or Voided intervention']]);
  // four more 1–7 scales (each step is a rule, not a number)
  const SCALE_SETS = {
    tech: { id: 'tech', label: 'Technology', rule: 'What the place can build and run', steps: ['Scavenged', 'Craft', 'Workshop', 'Industrial', 'Restored', 'Advanced', 'Transcendent'] },
    strength: { id: 'strength', label: 'Faction strength', rule: 'How much it can actually do', steps: ['Fringe', 'Minor', 'Notable', 'Influential', 'Powerful', 'Dominant', 'Unchallenged'] },
    importance: { id: 'importance', label: 'Resource importance', rule: 'What the place does without it', steps: ['Trivial', 'Minor', 'Useful', 'Valued', 'Vital', 'Lifeblood', 'Existential'] },
    likelihood: { id: 'likelihood', label: 'Scenario likelihood', rule: 'How likely it is to happen', steps: ['Unthinkable', 'Remote', 'Unlikely', 'Possible', 'Likely', 'Expected', 'Inevitable'] }
  };
  const TABS = ['overview', 'history', 'domestic', 'foreign', 'economy', 'beasts', 'intrigue'];
  const TAB_LABEL = { overview: 'Overview', history: 'History', domestic: 'Domestic', foreign: 'Foreign', economy: 'Economy', beasts: 'Beasts', intrigue: 'Intrigue', scenarios: 'What-ifs' };
  /** Everything a save can carry: the seven tabs plus the what-if scenarios, which belong to no tab. */
  const DATA_TABS = TABS.concat(['scenarios']);
  const V1_KEYS = ['states', 'rule', 'alliances', 'resources', 'founding'];
  const V1_DRAFT_TAB = { states: 'overview', rule: 'domestic', alliances: 'foreign', resources: 'economy', founding: 'history', beasts: 'beasts' };

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
    try {
      // the first write after the v1 → v2 upgrade keeps the old store, once
      const raw = localStorage.getItem(KEY);
      if (raw && !localStorage.getItem(BACKUP_KEY)) { const old = JSON.parse(raw); if (old && old.places && (old.version || 1) < 2) localStorage.setItem(BACKUP_KEY, raw); }
      localStorage.setItem(KEY, JSON.stringify(Object.assign({}, s, { version: VERSION }))); return true;
    } catch (e) { return false; }
  }
  const slug = t => String(t == null ? '' : t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
  /** A unique id for a new list entry: the base text, then -2, -3 … when it is taken. */
  function uid(base, list) {
    const b = slug(base); let id = b, n = 1;
    while ((list || []).some(x => x && x.id === id)) id = b + '-' + (++n);
    return id;
  }
  /** Fill what is missing from `def` into `obj` (objects deep, arrays and scalars only when absent). */
  function fill(obj, def) {
    Object.keys(def).forEach(k => {
      const d = def[k];
      if (Array.isArray(d)) { if (!Array.isArray(obj[k])) obj[k] = []; }
      else if (d && typeof d === 'object') { if (!obj[k] || typeof obj[k] !== 'object' || Array.isArray(obj[k])) obj[k] = {}; fill(obj[k], d); }
      else if (obj[k] === undefined || obj[k] === null) obj[k] = d;
    });
    return obj;
  }
  const TAB_DEFAULTS = () => ({
    overview: { states: [] },
    history: { purpose: { original: '', now: '', drift: '' }, founders: [], settlers: { who: '', from: '', why: '' }, founding: [],
      myth: { text: '', true: '', secret: false }, name: { meaning: '', older: [], outsiders: [] }, chronicle: [], eras: [], landmarks: [], lost: [], record: [] },
    domestic: { government: { form: 'none', offices: [], holders: [], succession: '', laws: [], justice: '', corruption: '', citizenship: '', outsiders: '', stance: '' },
      factions: [], figures: [], unrest: [],
      society: { daily: '', customs: '', festivals: '', taboos: '', faith: '', outsiders: { storyborn: '', voided: '', fallen: '', foreign: '' }, culture: '' },
      knowledge: { era0: [], energy: '', medicine: '', communication: '', weapons: '', education: '', forbidden: [] },
      military: { forces: [], ranks: [], doctrine: '', commanders: [], campaigns: [] } },
    foreign: { ties: [], blocs: [], envoys: [], hostages: [], agents: [], borders: [], routes: [], migration: [], reputation: [] },
    economy: { resources: [], currency: '', markets: '', taxes: '', blackMarket: '', labour: '', wealthGap: '', debts: [] },
    beasts: [],
    intrigue: { secrets: [], rumours: [], questions: [], hooks: [], foreshadow: [], sealed: [] },
    scenarios: []
  });
  /** Turn whatever is stored for one place into v2's shape, for the tabs it has (a stored place holds whole tabs, so it can be partial).
   *  v1 keys are mapped over without loss; a record that already has the v2 tab wins over a leftover v1 key. */
  function upgradeRaw(r) {
    if (!r || typeof r !== 'object') return {};
    const o = {};
    Object.keys(r).forEach(k => { if (!V1_KEYS.includes(k) && k !== 'draft') o[k] = clone(r[k]); });
    if ('states' in r && !('overview' in r)) o.overview = { states: Array.isArray(r.states) ? clone(r.states) : [] };
    if ('founding' in r && !('history' in r)) o.history = { founding: Array.isArray(r.founding) ? clone(r.founding) : [] };
    if ('rule' in r && !('domestic' in r)) {
      const u = r.rule || {};
      o.domestic = { government: { form: u.form || 'none', holders: clone(u.holders || []), outsiders: u.outsiders || '', stance: u.stance || '',
        laws: (u.laws || []).map(l => typeof l === 'string' ? { text: l, from: null, to: null } : clone(l)) } };
    }
    if ('alliances' in r && !('foreign' in r)) {
      const ties = [];
      (r.alliances || []).forEach(a => { const t = clone(a); t.id = t.id || uid(slug(String(a.with || '').replace(/^place:/, '')) + '-' + (a.kind || 'tie'), ties); ties.push(t); });
      o.foreign = { ties };
    }
    if ('resources' in r && !('economy' in r)) {
      const list = [];
      (r.resources || []).forEach(x => { const c = clone(x); c.id = c.id || uid(x.name, list); list.push(c); });
      o.economy = { resources: list };
    }
    if (r.draft && typeof r.draft === 'object') {
      o.draft = {};
      Object.keys(r.draft).forEach(k => { const t = V1_DRAFT_TAB[k] || k; if (r.draft[k] || !(t in o.draft)) o.draft[t] = !!r.draft[k] || !!o.draft[t]; });
    }
    return o;
  }
  const isStatue = id => { const W = global.EpitaphWorld; return !!(W && W.STATUES && W.STATUES.includes(id)); };
  /** Does this place get a founding model? On for the statue sites until the author switches it; the author can switch any place. */
  function hasModel(rec) { return rec && rec.model !== undefined && rec.model !== null ? !!rec.model : isStatue(rec && rec.placeId); }
  function empty(placeId) {
    return Object.assign({ placeId, draft: {} }, TAB_DEFAULTS());
  }
  function normalise(r) {
    const up = upgradeRaw(r);
    const out = Object.assign({ placeId: up.placeId }, up);
    fill(out, TAB_DEFAULTS());
    out.draft = Object.assign({}, out.draft || {});
    if (!out.placeId && r && r.placeId) out.placeId = r.placeId;
    return out;
  }
  /** Every record: defaults with the user's tabs on top, plus places only the user has written. */
  function load() {
    const s = readStore();
    const out = DEFAULTS.map(d => normalise(Object.assign(clone(d), upgradeRaw(s.places[d.placeId]))));
    Object.keys(s.places).forEach(id => { if (!DEFAULTS.some(d => d.placeId === id)) out.push(normalise(Object.assign({ placeId: id }, s.places[id]))); });
    return out;
  }
  function get(placeId, list) { return (list || load()).find(r => r.placeId === placeId) || null; }
  /** Save the given tabs of one place (e.g. { placeId, domestic }). A saved tab stops being a draft unless it says otherwise.
   *  Old v1 tab names (rule, alliances…) are accepted and upgraded. */
  function save(rec) {
    const s = readStore(), cur = upgradeRaw(s.places[rec.placeId] || {});
    const inc = upgradeRaw(rec);
    const next = Object.assign({}, cur, inc);
    const base = get(rec.placeId) || empty(rec.placeId);
    next.draft = Object.assign({}, base.draft, cur.draft || {});
    DATA_TABS.forEach(t => { if (t in inc && !(inc.draft && t in inc.draft)) next.draft[t] = false; });
    if (inc.draft) Object.assign(next.draft, inc.draft);
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
  /** Tabs a backup can update for places you already have: only tabs that are still drafts here (never saved by you) and that differ.
   *  [{ placeId, tabs: ['history', …] }]. A tab you have saved (draft false) is never offered. */
  function draftUpdatesIn(o) {
    if (!validData(o)) return [];
    const have = readStore().places, out = [];
    Object.keys(o.places).forEach(id => {
      if (!(id in have)) return;                                   // a new place: newInData's job
      const inc = upgradeRaw(o.places[id]), mine = get(id) || empty(id), theirs = normalise(Object.assign({ placeId: id }, o.places[id]));
      const tabs = DATA_TABS.filter(t => t in inc && mine.draft[t] !== false && JSON.stringify(theirs[t]) !== JSON.stringify(mine[t]));
      if (tabs.length) out.push({ placeId: id, tabs });
    });
    return out;
  }
  /** Merge: add the places this browser has no edits for, and update tabs that are still drafts here (draftUpdatesIn).
   *  Never touches a tab you have saved. Returns how many places were added or updated. */
  function mergeData(o) {
    const add = newInData(o), upd = draftUpdatesIn(o);
    if (!add.length && !upd.length) return 0;
    const s = readStore();
    add.forEach(id => { s.places[id] = clone(o.places[id]); });
    upd.forEach(u => {
      const inc = upgradeRaw(o.places[u.placeId]), next = upgradeRaw(s.places[u.placeId] || {});
      next.draft = Object.assign({}, next.draft || {});
      u.tabs.forEach(t => { next[t] = clone(inc[t]); next.draft[t] = inc.draft && t in inc.draft ? inc.draft[t] : true; });
      delete next.placeId;
      s.places[u.placeId] = next;
    });
    return writeStore(s) ? add.length + upd.length : 0;
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
    ((rec.overview && rec.overview.states) || []).forEach(st => { if (reached(st.from, chapter)) cur = st; });
    return cur;
  }
  /** Alliances touching a place, from both sides, each with `other` (the other place's id), seen from that place. */
  function alliancesOf(placeId, list) {
    const out = [];
    (list || load()).forEach(r => ((r.foreign && r.foreign.ties) || []).forEach(a => {
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
    if (rec.revealedIn !== undefined) return rec.revealedIn;   // a published snapshot already carries the answer
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
    KEY, VERSION, BACKUP_KEY, STATUS, SCALES, SCALE_SETS, FORMS, ALLIANCE_KINDS, BEAST_RELATIONS, RESOURCE_CATEGORIES, RESOURCE_ROLES, FOUNDING_STAGES,
    MOTIVES, FACTION_KINDS, TIE_ENDINGS, TEMPERAMENTS, SOCIAL_SHAPES, WARD_KINDS, RUMOUR_INTENTS, TRIGGER_GROUPS,
    TABS, TAB_LABEL, DATA_TABS, DEFAULTS,
    alliancesAt, placeReached, placeRevealChapter, hiddenNames, clean, authoring, load, get, save, reset, exportData, importData, newInData, draftUpdatesIn, mergeData, empty, normalise, upgradeRaw, uid, hasModel, reached, stateAt, alliancesOf, label, step
  };
})(typeof window !== 'undefined' ? window : globalThis);
