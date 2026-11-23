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
    likelihood: { id: 'likelihood', label: 'Scenario likelihood', rule: 'How likely it is to happen', steps: ['Unthinkable', 'Remote', 'Unlikely', 'Possible', 'Likely', 'Expected', 'Inevitable'] },
    impact: { id: 'impact', label: 'Scenario impact', rule: 'How far it would reach', steps: ['Ripple', 'Local', 'City', 'Region', 'Bloc', 'World', 'Ending'] },
    weight: { id: 'weight', label: 'Cause weight', rule: 'How much you believe this cause', steps: ['Barely', 'Faint', 'Some', 'Fair', 'Strong', 'Very strong', 'Certain'] }
  };
  /** A what-if's status: seven steps from first thought to written, plus two ways to set it aside. */
  const WHATIF_STATUS = sset([['idea', 'Idea', 'A first thought'], ['weighing', 'Weighing', 'Comparing causes and fallout'], ['planned', 'Planned', 'It will happen; not written yet'],
    ['foreshadowed', 'Foreshadowed', 'Warning signs are planted'], ['written', 'Written', 'It happens in a chapter'], ['shelved', 'Shelved', 'Kept for later'], ['dropped', 'Dropped', 'Not happening']]);
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
    out.scenarios = (Array.isArray(out.scenarios) ? out.scenarios : []).map(normWhatIf);
    return out;
  }
  /** A what-if with every field present (older ones have no impact, cause weights or links). Unknown statuses become 'idea'. */
  function normWhatIf(w) {
    const o = Object.assign({ id: '', trigger: '', triggerKind: 'ties', about: [], causes: [], fallout: [], warnings: [], likelihood: 3, impact: null, status: 'idea', chapter: null, then: [] }, w || {});
    if (!WHATIF_STATUS.some(x => x.id === o.status)) o.status = 'idea';
    ['about', 'causes', 'fallout', 'warnings', 'then'].forEach(k => { if (!Array.isArray(o[k])) o[k] = []; });
    o.causes = o.causes.map(c => Object.assign({ group: '', cause: '', note: '', weight: null, lean: false }, c || {}));
    o.impact = Number.isInteger(o.impact) && o.impact >= 1 && o.impact <= 7 ? o.impact : null;
    o.likelihood = Number.isInteger(o.likelihood) && o.likelihood >= 1 && o.likelihood <= 7 ? o.likelihood : 3;
    return o;
  }
  /** May this viewer open this place's entry (step 6.1)? A place needs an entry, and a reader needs to have reached the place;
   *  the author may open any. Returns the place id to link to, or null. Looks through a city to the place that has an entry (a temple in a city). */
  function entryFor(place, list) {
    const recs = list || load(), ids = [place && place.id, place && place.cityId].filter(Boolean);
    for (const id of ids) { const r = recs.find(x => x.placeId === id); if (r && (authoring() || placeReached(r))) return id; }
    return null;
  }
  /** What the illustrated founding model draws at a stage (step 5.3), from the stages that are written (and, for a reader, reached).
   *  founding: the place's history.founding (already gated); at: 0..6, the stage being looked at.
   *  -> { here, cleared, first, walls, town, scar, rebuilt, ruins, stage, label, text }
   *     here: the spot is marked (always); cleared + first: ground broken; walls: first walls; town: growth (or an 'as it stands' with no
   *     disaster before it); scar: a disaster has struck by `at` and nothing rebuilt it yet; rebuilt: rebuilt over the scar;
   *     ruins: some written stage up to `at` reuses the drowned world. text: what changed at the stage looked at (or why, when no change). */
  function foundingLayers(founding, at) {
    const ids = FOUNDING_STAGES.map(x => x.id), list = Array.isArray(founding) ? founding : [], n = Number.isInteger(at) ? Math.max(0, Math.min(6, at)) : 6;
    const by = id => list.find(f => f.stage === id), has = id => ids.indexOf(id) <= n && !!by(id);
    const scar = has('disaster'), rebuilt = scar && has('rebuilt'), town = has('growth') || (has('present') && !scar && (has('ground') || has('walls')));
    const ruins = list.some(f => ids.indexOf(f.stage) >= 0 && ids.indexOf(f.stage) <= n && String(f.reused || '').trim());
    const here = by(ids[n]);
    return { here: true, cleared: has('ground'), first: has('ground'), walls: has('walls'), town,
      scar: scar && !rebuilt, rebuilt, ruins, stage: n, label: FOUNDING_STAGES[n].label, text: here ? String(here.change || here.why || '').trim() : '' };
  }
  /** Founding stages in order (step 5.1): problems a stage list can have, for the Checks list.
   *  compare(a, b): the timeline's order for two event ids (< 0 when a comes first); events it can't place are skipped.
   *  -> [{ rule: 'founding-dup' | 'founding-order' | 'founding-stage', stage, other?, text }] */
  function foundingProblems(rec, compare) {
    const list = ((rec && rec.history && rec.history.founding) || []), ids = FOUNDING_STAGES.map(x => x.id), out = [];
    const lab = id => (FOUNDING_STAGES.find(x => x.id === id) || {}).label || id;
    const seen = new Set();
    list.forEach(f => {
      if (!ids.includes(f.stage)) { out.push({ rule: 'founding-stage', stage: f.stage, text: `a founding stage “${f.stage}” is not one of the seven` }); return; }
      if (seen.has(f.stage)) out.push({ rule: 'founding-dup', stage: f.stage, text: `the founding stage “${lab(f.stage)}” is written twice` });
      seen.add(f.stage);
    });
    const dated = list.filter(f => ids.includes(f.stage) && f.when != null).sort((a, b) => ids.indexOf(a.stage) - ids.indexOf(b.stage));
    for (let i = 0; i < dated.length; i++) for (let j = i + 1; j < dated.length; j++) {
      const c = compare ? compare(dated[i].when, dated[j].when) : 0;
      if (c > 0) out.push({ rule: 'founding-order', stage: dated[j].stage, other: dated[i].stage, text: `the founding stage “${lab(dated[j].stage)}” is dated before “${lab(dated[i].stage)}”, which comes earlier in the seven` });
    }
    return out;
  }
  // ---------------------------------------------------------------- what-ifs across places (step 4.5; author only, never published)
  const whatIfRef = (placeId, id) => 'scenario:' + placeId + '/' + id;
  /** Every what-if from every place, flattened: [{ key ('scenario:<place>/<id>'), placeId, …the what-if }]. */
  function whatIfList(list) {
    const out = []; (list || load()).forEach(r => (r.scenarios || []).forEach(w => out.push(Object.assign({ key: whatIfRef(r.placeId, w.id), placeId: r.placeId }, normWhatIf(w)))));
    return out;
  }
  /** Which pile of the triage view a what-if falls in: likely = Possible or more (4+), big = a Region or more (4+).
   *  'now' (likely and big: plant signs now) · 'pocket' (unlikely but big: a twist) · 'texture' (likely but small) · 'letgo' (unlikely and small)
   *  · null when its impact isn't scored yet. */
  function whatIfPile(w) {
    if (!w || !Number.isInteger(w.impact)) return null;
    const likely = (w.likelihood || 0) >= 4, big = w.impact >= 4;
    return likely && big ? 'now' : big ? 'pocket' : likely ? 'texture' : 'letgo';
  }
  /** 'then' links between what-ifs: { next: key -> [keys], prev: key -> [keys], missing: [{ from, to }] } (a link to a what-if that doesn't exist). */
  function whatIfLinks(items) {
    const keys = new Set(items.map(w => w.key)), next = {}, prev = {}, missing = [];
    items.forEach(w => (w.then || []).forEach(t => {
      const k = /^scenario:/.test(String(t)) ? String(t) : null;
      if (!k || !keys.has(k)) { missing.push({ from: w.key, to: t }); return; }
      (next[w.key] = next[w.key] || []).push(k); (prev[k] = prev[k] || []).push(w.key);
    }));
    return { next, prev, missing };
  }
  /** Loops in the 'then' links (A sets off B sets off A): a list of loops, each the keys in order, each loop reported once. */
  function whatIfLoops(items) {
    const { next } = whatIfLinks(items), loops = [], seen = new Set(), state = {};
    const walk = (k, path) => {
      state[k] = 1; path.push(k);
      (next[k] || []).forEach(n => {
        if (state[n] === 1) { const cyc = path.slice(path.indexOf(n)); const id = cyc.slice().sort().join('>'); if (!seen.has(id)) { seen.add(id); loops.push(cyc); } }
        else if (!state[n]) walk(n, path);
      });
      path.pop(); state[k] = 2;
    };
    items.forEach(w => { if (!state[w.key]) walk(w.key, []); });
    return loops;
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
  /** The relations web at a chapter (step 4.2): every place and every tie between places, through the reader gate.
   *  chapter: the chapter being looked at (null = the latest). author: true = the author's view, which still follows the chapter
   *  for what has *started* (so scrubbing works) but also shows secret ties and places readers haven't reached, marked `hidden`.
   *  A reader sees only ties alliancesAt would show them, between places they have reached.
   *  -> { nodes: [{ id, hidden }], edges: [{ key, id, owner, a, b, kind, motive, secret, hidden, ended, endHidden, from, to, startCh, endCh }] }
   *  startCh / endCh: the chapter the start / end is revealed in (0 = before the story, null = not known to this viewer). */
  function webAt(chapter, list, author) {
    const t = TL(), recs = list || load(), asAuthor = author === undefined ? authoring() : !!author;
    const atLatest = !t || t.isRevealed({ when: {}, secret: true }, chapter);
    const recOf = id => recs.find(x => x.placeId === id);
    const placeOk = id => { const r = recOf(id); return !r || placeReached(r, chapter); };
    const revCh = id => { if (id == null) return 0; if (!t) return 0; const e = t.byId(id); return e ? t.revealChapter(e) : null; };
    const nodes = new Map(), edges = [], seenKey = new Set();
    const addNode = (id, hidden) => { const n = nodes.get(id); if (!n) nodes.set(id, { id, hidden }); else if (!hidden) n.hidden = false; };
    recs.forEach(r => { const ok = placeOk(r.placeId); if (asAuthor || ok) addNode(r.placeId, !ok); });
    recs.forEach(r => ((r.foreign && r.foreign.ties) || []).forEach(x => {
      const a = r.placeId, b = String(x.with || '').replace(/^place:/, ''); if (!b || b === a) return;
      const ends = placeOk(a) && placeOk(b);
      const seen = ends && (x.secret ? (x.from != null ? reached(x.from, chapter) : atLatest) : reached(x.from, chapter));
      const started = x.from == null || reached(x.from, chapter);
      if (!(asAuthor ? started : seen)) return;
      const key = [a, b].sort().join('|') + '|' + x.kind; if (seenKey.has(key)) return; seenKey.add(key);
      const ended = x.to != null && reached(x.to, chapter), endHidden = x.to != null && !ended;
      addNode(a, !placeOk(a)); addNode(b, !placeOk(b));
      edges.push({ key, id: x.id, owner: a, a, b, kind: x.kind, motive: x.motive || null, secret: !!x.secret, hidden: !seen, ended, endHidden,
        from: x.from == null ? null : x.from, to: ended || asAuthor ? (x.to == null ? null : x.to) : null,
        startCh: revCh(x.from), endCh: x.to == null ? null : (ended || asAuthor ? revCh(x.to) : null) });
    }));
    return { nodes: [...nodes.values()], edges };
  }
  /** Blocs at a chapter (step 4.4): named pacts of places, from every place's `foreign.blocs`, through the reader gate.
   *  A reader sees a bloc only once it is revealed (not `hidden`, or its `revealedIn` reached), its members only from the chapter their
   *  start is reached and only if they've reached the place, and a member's end only once reached. The author sees them all, following
   *  the chapter for what has *started*, with `hidden` marking what a reader would not see.
   *  -> [{ key, id, owner, name, charter, purpose, seat, rival, tension, hidden, size, members: [{ place, from, to, left, endHidden, hidden, startCh, endCh }] }]
   *  size = members present now (started, not left). A bloc with no visible member is left out for a reader. */
  function blocsAt(chapter, list, author) {
    const t = TL(), recs = list || load(), asAuthor = author === undefined ? authoring() : !!author;
    const revCh = id => { if (id == null || !t) return 0; const e = t.byId(id); return e ? t.revealChapter(e) : null; };
    const pid = m => String(m.place || '').replace(/^place:/, '');
    const out = [];
    recs.forEach(r => {
      const rv = asAuthor ? null : forReader(r, chapter, { recs }), seen = rv ? (rv.foreign.blocs || []) : null;
      ((asAuthor ? (r.foreign && r.foreign.blocs) : seen) || []).forEach(b => {
        const pub = asAuthor ? ((forReader(r, chapter, { recs }).foreign.blocs || []).find(x => x.id === b.id) || null) : b;   // what a reader would see of it
        const pubMembers = pub ? pub.members : [];
        const members = (b.members || []).filter(m => asAuthor ? (m.from == null || reached(m.from, chapter)) : true).map(m => {
          const vis = pubMembers.some(x => pid(x) === pid(m));
          const ended = m.to != null && reached(m.to, chapter);
          return { place: pid(m), from: m.from == null ? null : m.from, to: asAuthor || ended ? (m.to == null ? null : m.to) : null, left: ended, endHidden: m.to != null && !ended, hidden: asAuthor && !vis,
            startCh: revCh(m.from), endCh: m.to == null ? null : (asAuthor || ended ? revCh(m.to) : null) };
        });
        if (!asAuthor && !members.length) return;
        out.push({ key: r.placeId + '/' + b.id, id: b.id, owner: r.placeId, name: b.name || '', charter: b.charter || '', purpose: b.purpose || '', seat: b.seat || '', rival: b.rival || '', tension: b.tension || '',
          hidden: asAuthor && !pub, size: members.filter(m => !m.left).length, members });
      });
    });
    return out.sort((x, y) => String(x.name).localeCompare(String(y.name)) || x.key.localeCompare(y.key));
  }
  /** Seats on the relations ring (step 4.2). Places are grouped (groupOf(id) -> a group name), biggest group first, statue sites
   *  first inside a group, then by name; one empty seat between groups. Seats depend only on the ids given, so pass the widest set the
   *  viewer may see and the seats stay put while the chapter changes.
   *  -> { seats: { id: angle }, groups: [{ name, a0, a1, ids }] }  angles in radians, starting at the top, clockwise. */
  function ringSeats(ids, groupOf, nameOf, statue) {
    const g = new Map(), nm = id => String((nameOf && nameOf(id)) || id).toLowerCase(), st = id => !!(statue && statue(id));
    [...new Set(ids || [])].forEach(id => { const k = String((groupOf && groupOf(id)) || 'Other'); if (!g.has(k)) g.set(k, []); g.get(k).push(id); });
    const groups = [...g.entries()].sort((x, y) => y[1].length - x[1].length || x[0].localeCompare(y[0]))
      .map(([name, list]) => ({ name, ids: list.sort((p, q) => (st(q) - st(p)) || nm(p).localeCompare(nm(q)) || String(p).localeCompare(String(q))) }));
    const total = groups.reduce((n, x) => n + x.ids.length, 0) + (groups.length > 1 ? groups.length : 0);
    const step = total ? Math.PI * 2 / total : 0, seats = {};
    let i = 0;
    groups.forEach(x => { const a0 = -Math.PI / 2 + i * step; x.ids.forEach(id => { seats[id] = -Math.PI / 2 + i * step; i++; }); x.a0 = a0; x.a1 = -Math.PI / 2 + (i - 1) * step; if (groups.length > 1) i++; });
    return { seats, groups };
  }
  /** The bars of a place's ties on a timeline (step 4.1). `ties` are alliancesAt results; `order` is the timeline's event ids in order;
   *  `nowIdx` is the index of the last event the reader has reached (-1 = none). Positions are indices into `order` (0..N).
   *  state: 'ongoing' (no end), 'ended' (a reached end), 'unknown' (the end isn't reached: a reader sees the bar run as far as they know and
   *  never learns where it stops), 'hidden-end' (author view: the real end, which readers can't see yet).
   *  -> { N, rows: [{ id, other, owner, kind, state, start, end, secret, hidden, from, to }] } sorted by start. */
  function tieBars(ties, order, nowIdx, author) {
    const ord = order || [], N = Math.max(1, ord.length - 1), ix = id => { const i = ord.indexOf(id); return i < 0 ? null : i; };
    const now = Number.isInteger(nowIdx) ? nowIdx : -1;
    const rows = (ties || []).map(t => {
      const s = t.from == null ? 0 : (ix(t.from) == null ? 0 : ix(t.from)), toI = t.to == null ? null : ix(t.to), hiddenEnd = !!t.endHidden;
      let state, end;
      if (t.to == null) { state = 'ongoing'; end = N; }
      else if (hiddenEnd && !author) { state = 'unknown'; end = Math.max(s, now); }
      else { state = hiddenEnd ? 'hidden-end' : 'ended'; end = toI == null ? N : toI; }
      return { id: t.id, other: t.other, owner: t.owner, kind: t.kind, state, start: s, end: Math.max(end, s), secret: !!t.secret, hidden: !!t.hidden, from: t.from == null ? null : t.from, to: state === 'unknown' || t.to == null ? null : t.to };
    });
    rows.sort((a, b) => a.start - b.start || a.end - b.end || String(a.other).localeCompare(String(b.other)));
    return { N, rows };
  }
  /** "In the story", derived from the Dossier (nothing is typed in): who was at a place and when, and which chapters were set there.
   *  opt: { placeId, characters, chapters: [{ number, title }], resolve(location) -> placeId|null, at (the reader's chapter; null = everything), author }
   *  A character's location is kept per version (snapshots[].location from startChapter on). A stay runs from the version that puts them
   *  here to the next version that puts them elsewhere. A reader sees only stays that began by `at`, and an end they haven't reached
   *  shows as "still there"; the author sees everything, with `hidden` marking what a reader would not.
   *  -> { people: [{ id, name, first, hidden, dead, stays: [{ from, to, why, hidden }] }], chapters: [{ n, title, hidden, who: [name] }] } */
  function storyOf(opt) {
    const o = opt || {}, pid = o.placeId, author = !!o.author, at = o.at == null ? Infinity : o.at;
    const start = v => Number.isInteger(v.startChapter) ? v.startChapter : null;
    const here = v => { try { return o.resolve ? o.resolve(v.location) === pid : false; } catch (e) { return false; } };
    const chars = (o.characters || []).map(c => ({ c, vs: (c.snapshots || []).filter(v => start(v) != null).sort((a, b) => start(a) - start(b)) }));
    const people = [];
    chars.forEach(({ c, vs }) => {
      const stays = [];
      vs.forEach((v, i) => {
        const h = here(v), prev = i > 0 && here(vs[i - 1]);
        if (h && !prev) stays.push({ from: start(v), to: null, why: v.objective || '', presence: v.presence || 'alive' });
        else if (!h && prev && stays.length) stays[stays.length - 1].to = start(v);
        if (h && v.presence === 'dead' && stays.length && stays[stays.length - 1].deadFrom == null) stays[stays.length - 1].deadFrom = start(v);
      });
      const shown = stays.map(st => {
        const hidden = st.from > at;
        const endHidden = st.to != null && st.to > at;
        return { from: st.from, to: endHidden && !author ? null : st.to, why: st.why, dead: st.deadFrom != null && !hidden && (author || st.deadFrom <= at), hidden, endHidden };
      }).filter(st => author || !st.hidden);
      if (!shown.length) return;
      people.push({ id: c.id, name: c.name || 'Unnamed', first: shown[0].from, hidden: shown.every(st => st.hidden), dead: shown.some(st => st.dead), stays: shown });
    });
    people.sort((a, b) => a.first - b.first || a.name.localeCompare(b.name));
    const nums = new Set((o.chapters || []).map(x => x.number).filter(Number.isInteger));
    chars.forEach(({ vs }) => vs.forEach(v => nums.add(start(v))));
    const titleOf = n => ((o.chapters || []).find(x => x.number === n) || {}).title || '';
    const chaps = [];
    [...nums].sort((a, b) => a - b).forEach(n => {
      const who = [];
      chars.forEach(({ c, vs }) => {
        const v = vs.filter(x => start(x) <= n).pop();
        if (v && here(v)) who.push(c.name || 'Unnamed');
      });
      if (!who.length || (!author && n > at)) return;
      chaps.push({ n, title: titleOf(n), hidden: n > at, who });
    });
    return { people, chapters: chaps };
  }
  /** Dossier characters who carry an encyclopedia secret (`secret:<place>/<id>`), from the `ref` on their per-chapter secrets.
   *  -> [{ id, name, involved, knows }]: `involved` = the first chapter whose version lists it, `knows` = the first chapter they know it
   *  (null = it is in their file but they don't know it). The first chapter a character knows it is when they learned it. */
  function secretHolders(characters, ref) {
    const out = [];
    (characters || []).forEach(c => {
      const vs = (c.snapshots || []).filter(v => Number.isInteger(v.startChapter)).sort((a, b) => a.startChapter - b.startChapter);
      let involved = null, knows = null;
      vs.forEach(v => (v.secrets || []).forEach(x => {
        if (!x || x.ref !== ref) return;
        if (involved == null) involved = v.startChapter;
        if (x.characterKnows && knows == null) knows = v.startChapter;
      }));
      if (involved != null) out.push({ id: c.id, name: c.name || 'Unnamed', involved, knows });
    });
    return out.sort((a, b) => (a.knows == null ? 1e9 : a.knows) - (b.knows == null ? 1e9 : b.knows) || a.involved - b.involved || a.name.localeCompare(b.name));
  }
  /** Who was at a place (a `storyOf` result) before they knew a secret held there: a prompt for "could be discovered here", not a rule.
   *  `holders` is secretHolders for the same secret. -> [{ id, name, from }] (the chapter their stay began). */
  function couldFind(story, holders) {
    const known = new Map((holders || []).filter(h => h.knows != null).map(h => [h.id, h.knows]));
    const out = [];
    ((story && story.people) || []).forEach(p => {
      const st = p.stays.find(x => !known.has(p.id) || known.get(p.id) > x.from);
      if (st) out.push({ id: p.id, name: p.name, from: st.from });
    });
    return out;
  }
  const SECRET_REF = /^secret:[\w-]+\/[\w-]+$/;
  /** Chekhov's gun across places: what is planted and never paid off, and what pays off without being planted.
   *  Reads secrets (setup, payoff), foreshadowing (plantIn, pointsTo), the evidence a secret leans on (the chapter it is found in counts as
   *  a setup when the secret has none) and what-if warning signs (plantIn). Chapters are numbers; nothing is checked until one is set.
   *  -> [{ level: 'warn'|'info', rule: 'gun-loaded'|'gun-unplanted'|'gun-order', placeId, text }]. `nameOf(placeId)` names a place in the text. */
  function plantPayoff(recs, nameOf) {
    const out = [], isInt = Number.isInteger, nm = nameOf || (id => id);
    const short = t => { t = String(t || '').trim(); return '“' + (t.length > 50 ? t.slice(0, 49) + '…' : t) + '”'; };
    const slugOf = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
    (recs || []).forEach(r => {
      const rec = normalise(r), at = nm(rec.placeId), push = (level, rule, text) => out.push({ level, rule, placeId: rec.placeId, text: at + ': ' + text });
      const records = rec.history.record || [];
      const found = ref => { const m = /^record:(?:[\w-]+\/)?(.+)$/.exec(String(ref || '')); const x = m && records.find(y => slugOf(y.topic) === m[1]); return x ? (x.evidence || []).map(e => e.revealedIn).filter(isInt) : []; };
      const secrets = rec.intrigue.secrets || [];
      secrets.forEach(x => {
        const ev = (x.evidence || []).flatMap(found), setup = isInt(x.setup) ? x.setup : (ev.length ? Math.min(...ev) : null), payoff = isInt(x.payoff) ? x.payoff : null;
        if (setup != null && payoff == null) push('info', 'gun-loaded', `the secret ${short(x.text)} is set up in Ch ${setup} but has no payoff chapter yet.`);
        else if (payoff != null && setup == null) push('warn', 'gun-unplanted', `the secret ${short(x.text)} pays off in Ch ${payoff} but is never set up: plant it earlier (a rumour, evidence or foreshadowing).`);
        else if (setup != null && payoff != null && setup > payoff) push('warn', 'gun-order', `the secret ${short(x.text)} pays off in Ch ${payoff}, before it is set up in Ch ${setup}.`);
      });
      (rec.intrigue.foreshadow || []).forEach(f => {
        if (!isInt(f.plantIn)) return;                                       // not planted yet: nothing to check
        const m = /^secret:(?:([\w-]+)\/)?(.+)$/.exec(String(f.pointsTo || ''));
        const target = m ? (m[1] && m[1] !== rec.placeId ? null : secrets.find(y => y.id === m[2])) : null;
        if (!target) return;
        const pay = isInt(target.payoff) ? target.payoff : null;
        if (pay == null) push('info', 'gun-loaded', `the foreshadowing ${short(f.text)} is planted in Ch ${f.plantIn} toward ${short(target.text)}, which has no payoff chapter yet.`);
        else if (f.plantIn > pay) push('warn', 'gun-order', `the foreshadowing ${short(f.text)} is planted in Ch ${f.plantIn}, after the payoff in Ch ${pay}.`);
      });
      (rec.scenarios || []).forEach(w => {
        const planted = (w.warnings || []).map(x => x.plantIn).filter(isInt);
        if (w.status === 'dropped' && planted.length) push('warn', 'gun-loaded', `the what-if ${short(w.trigger)} is dropped, but its warning signs are planted (Ch ${planted.join(', ')}).`);
        else if (w.status === 'foreshadowed' && !planted.length) push('warn', 'gun-unplanted', `the what-if ${short(w.trigger)} is marked Foreshadowed, but no warning sign has a chapter to plant it in.`);
        else if (['written', 'planned', 'foreshadowed'].includes(w.status) && isInt(w.chapter)) {
          if (!planted.some(n => n < w.chapter)) push('warn', 'gun-unplanted', `the what-if ${short(w.trigger)} ${w.status === 'written' ? 'happens in' : 'is planned for'} Ch ${w.chapter} with no warning sign planted before it.`);
          else if (planted.some(n => n >= w.chapter)) push('warn', 'gun-order', `the what-if ${short(w.trigger)} happens in Ch ${w.chapter}, but a warning sign is planted in or after it.`);
        } else if (['idea', 'weighing', 'shelved'].includes(w.status) && planted.length) push('info', 'gun-loaded', `warning signs are planted (Ch ${planted.join(', ')}) for the what-if ${short(w.trigger)}, which isn't written yet.`);
      });
    });
    return out;
  }
  /** What a reader on `chapter` may see of one place: a v2 record with everything author-only taken out (docs/plans/site-schema-v2.md).
   *  One gate for both the published snapshot (assets/epitaph-publish.js) and the book's Reader view, so a preview shows what is published.
   *  Rules: dated things follow their dates (an undated one, or `from: null`, is "since the start"); an end the reader hasn't reached is dropped;
   *  anything `hidden`, or carrying `revealedIn`, stays out until that chapter; a block (purpose, settlers, myth, name, government prose, society,
   *  knowledge, military, economy prose) can be held back the same way; free text goes through `scrub`; a `char:` ref is kept only when
   *  `charOk` says the character is introduced. Author-only, never passed on: scenarios, drafts, agents, corruption, secret goals, fears,
   *  leverage, relationships, evidence, the truth behind a record, a tie's real reason and who wants it to fail, setup and payoff notes.
   *  Intrigue lines appear only once their `revealedIn` is reached.
   *  opt: { recs, scrub(text), charOk(ref), placeOk(placeId), reached(eventId) } (defaults: this module's own clean / hiddenNames; no characters;
   *  reached places and events). */
  function forReader(rec, chapter, opt) {
    const o = opt || {}, T = TL(), recs = o.recs || load(), r = normalise(rec);
    const at = chapter == null ? (T && T.latestChapter ? T.latestChapter() : null) : chapter;
    const scrub = o.scrub || (t => clean(t, chapter, recs, false));
    const charOk = o.charOk || (() => false);
    const placeOk = o.placeOk || (id => { const x = get(id, recs); return !x || placeReached(x, chapter); });
    const isRef = (x, k) => new RegExp('^' + k + ':').test(String(x || ''));
    const refOk = x => isRef(x, 'char') ? charOk(x) : isRef(x, 'place') ? placeOk(String(x).replace(/^place:/, '')) : true;
    const rch = o.reached || (w => reached(w, chapter));                 // the publisher passes its own: an event whose title was held back is not reached
    const R = it => !!it && it.revealedIn != null && at != null && it.revealedIn <= at;
    const held = it => !!it && (it.hidden || it.revealedIn != null) && !R(it);
    const live = it => !!it && !held(it);
    const when = (it, k) => it[k] === undefined || rch(it[k]);       // undated = since the start
    const end = (it, k) => (it[k] != null && rch(it[k])) ? it[k] : null;
    // drafting markers ("(suggested)", "(a guess)") are notes to the author, not lore
    const tx = t => scrub((t == null ? '' : String(t)).replace(/\s*\((?:suggested|a guess|sugg\.)\)/gi, '').trim());
    const who = (x, name) => isRef(x, 'char') ? (charOk(x) ? x : '') : (x ? tx(x) : (name ? tx(name) : ''));
    const keep = (list, f) => (Array.isArray(list) ? list : []).filter(f);
    const block = b => (b && !held(b)) ? b : null;
    const strs = a => (Array.isArray(a) ? a : []).map(tx).filter(Boolean);
    const out = { placeId: r.placeId, revealedIn: placeRevealChapter(r), model: hasModel(r) };
    // overview
    out.overview = { states: keep(r.overview.states, st => rch(st.from)).map(st => ({ from: st.from, status: st.status, scales: clone(st.scales || {}), techLevel: st.techLevel, note: tx(st.note) })) };
    // history
    const h = r.history, pu = block(h.purpose), se = block(h.settlers), my = block(h.myth), nm = block(h.name);
    out.history = {
      purpose: pu ? { original: tx(pu.original), now: tx(pu.now), drift: tx(pu.drift) } : { original: '', now: '', drift: '' },
      founders: keep(h.founders, live).map(f => ({ ref: f.ref && refOk(f.ref) ? f.ref : '', name: who(f.ref ? '' : f.name), role: tx(f.role) })).filter(f => f.ref || f.name),
      settlers: se ? { who: tx(se.who), from: tx(se.from), why: tx(se.why) } : { who: '', from: '', why: '' },
      founding: keep(h.founding, f => rch(f.when)).map(f => ({ stage: f.stage, when: f.when, why: tx(f.why), who: who(f.who), materials: tx(f.materials), reused: tx(f.reused), change: tx(f.change) })),
      myth: my ? { text: tx(my.text), true: '', secret: false } : { text: '', true: '', secret: false },
      name: nm ? { meaning: tx(nm.meaning), older: strs(nm.older), outsiders: strs(nm.outsiders) } : { meaning: '', older: [], outsiders: [] },
      chronicle: keep(h.chronicle, e => live(e) && rch(e.when)).map(e => ({ id: e.id, when: e.when, title: tx(e.title), kind: e.kind, text: tx(e.text), turningPoint: !!e.turningPoint, refs: keep(e.refs, refOk) })),
      eras: keep(h.eras, e => live(e) && rch(e.from)).map(e => ({ name: tx(e.name), from: e.from, to: end(e, 'to'), note: tx(e.note) })),
      landmarks: keep(h.landmarks, l => live(l) && (!l.built || rch(l.built))).map(l => ({ id: l.id, name: tx(l.name), built: l.built || '', by: who(l.by), story: tx(l.story), sealed: !!l.sealed })),
      lost: keep(h.lost, l => live(l) && rch(l.when)).map(l => ({ name: tx(l.name), when: l.when, how: tx(l.how) })),
      record: keep(h.record, live).map(x => ({ topic: tx(x.topic), official: tx(x.official) }))
    };
    // domestic
    const d = r.domestic, g = d.government, gp = block({ hidden: g.hidden, revealedIn: g.revealedIn }) !== null;
    out.domestic = {
      government: { form: g.form, stance: g.stance,
        offices: keep(g.offices, live).map(x => ({ title: tx(x.title), holds: tx(x.holds), holder: who(x.holder) })),
        holders: keep(g.holders, x => live(x) && rch(x.from) && (!isRef(x.ref, 'char') || charOk(x.ref))).map(x => ({ ref: isRef(x.ref, 'char') ? x.ref : tx(x.ref), title: tx(x.title), from: x.from, to: end(x, 'to') })).filter(x => x.ref),
        succession: gp ? tx(g.succession) : '', justice: gp ? tx(g.justice) : '', citizenship: gp ? tx(g.citizenship) : '', outsiders: gp ? tx(g.outsiders) : '',
        laws: keep(g.laws, l => live(l) && rch(l.from)).map(l => ({ text: tx(l.text), from: l.from, to: end(l, 'to') })).filter(l => l.text) },
      factions: keep(d.factions, f => live(f) && rch(f.from)).map(f => ({ id: f.id, name: tx(f.name), kind: f.kind, leader: who(f.leader), goals: { public: tx((f.goals || {}).public) },
        members: keep(f.members, refOk), size: tx(f.size), strength: f.strength, stance: tx(f.stance), ties: keep(f.ties, x => refOk(x.ref)).map(x => ({ ref: x.ref, how: tx(x.how) })),
        controls: strs(f.controls), hidden: false, from: f.from, to: end(f, 'to') })),
      figures: keep(d.figures, f => live(f) && !held(d.factions.find(x => x.id === f.faction)) && (!f.ref || refOk(f.ref))).map(f => ({ id: f.id, ref: f.ref || '', name: f.ref ? '' : tx(f.name), role: tx(f.role), faction: f.faction || '',
        goals: { public: tx((f.goals || {}).public) }, status: keep(f.status, x => rch(x.from)) })),
      unrest: keep(d.unrest, u => live(u) && rch(u.from)).map(u => ({ id: u.id, from: u.from, to: end(u, 'to'), causes: strs(u.causes), response: tx(u.response), outcome: end(u, 'to') ? tx(u.outcome) : '' })),
      society: (b => b ? { daily: tx(b.daily), customs: tx(b.customs), festivals: tx(b.festivals), taboos: tx(b.taboos), faith: tx(b.faith), culture: tx(b.culture),
        outsiders: { storyborn: tx((b.outsiders || {}).storyborn), voided: tx((b.outsiders || {}).voided), fallen: tx((b.outsiders || {}).fallen), foreign: tx((b.outsiders || {}).foreign) } } : TAB_DEFAULTS().domestic.society)(block(d.society)),
      knowledge: (b => b ? { era0: keep(b.era0, x => true).map(x => ({ what: tx(x.what), works: !!x.works, who: who(x.who) })), energy: tx(b.energy), medicine: tx(b.medicine), communication: tx(b.communication), weapons: tx(b.weapons), education: tx(b.education),
        forbidden: keep(b.forbidden, x => true).map(x => ({ what: tx(x.what), why: '' })) } : TAB_DEFAULTS().domestic.knowledge)(block(d.knowledge)),
      military: (b => b ? { forces: keep(b.forces, x => true).map(x => ({ name: tx(x.name), size: tx(x.size) })), ranks: strs(b.ranks), doctrine: tx(b.doctrine), commanders: keep(b.commanders, refOk) } : { forces: [], ranks: [], doctrine: '', commanders: [] })(block(d.military))
    };
    // foreign: ties are stored on one side and shown on both; only this place's own are kept (the other side's record holds the rest)
    const f0 = r.foreign;
    out.foreign = {
      ties: alliancesAt(r.placeId, chapter, recs, false).filter(a => a.owner === r.placeId && (a.from == null || rch(a.from))).map(a => { a = Object.assign({}, a, { endHidden: a.endHidden || (a.to != null && !rch(a.to)) }); const t = (f0.ties || []).find(x => x.id === a.id) || a;
        return { id: a.id, with: a.with, kind: a.kind, motive: t.motive || '', motiveDetail: tx(t.motiveDetail),
          terms: keep(t.terms, x => true).map(x => ({ side: tx(x.side), gives: tx(x.gives), gets: tx(x.gets) })),
          signed: t.signed ? { when: t.signed.when || '', by: keep(t.signed.by, refOk), where: tx(t.signed.where) } : { when: '', by: [], where: '' },
          renewal: t.renewal ? { expires: tx(t.renewal.expires), conditions: tx(t.renewal.conditions) } : { expires: '', conditions: '' },
          public: tx(t.public), ends: a.endHidden || !t.ends ? { when: '', how: '', note: '' } : { when: t.ends.when || '', how: t.ends.how || '', note: '' },
          secret: false, from: a.from, to: a.endHidden ? null : a.to, endsLater: !!a.endHidden, note: tx(a.note) }; }),
      blocs: keep(f0.blocs, b => live(b)).map(b => ({ id: b.id, name: tx(b.name), charter: tx(b.charter), seat: b.seat && refOk(b.seat) ? b.seat : '', purpose: tx(b.purpose), rival: b.rival || '', tension: tx(b.tension),
        members: keep(b.members, m => rch(m.from) && placeOk(String(m.place || '').replace(/^place:/, ''))).map(m => ({ place: m.place, from: m.from, to: end(m, 'to') })) })),
      envoys: keep(f0.envoys, x => live(x) && rch(x.from) && (!x.ref || refOk(x.ref))).map(x => ({ ref: x.ref || '', name: x.ref ? '' : tx(x.name), to: x.to, from: x.from, to_: end(x, 'to_') })),
      hostages: keep(f0.hostages, x => live(x) && rch(x.from) && (!x.ref || refOk(x.ref))).map(x => ({ ref: x.ref || '', name: x.ref ? '' : tx(x.name), heldBy: x.heldBy, why: tx(x.why), from: x.from, to: end(x, 'to') })),
      borders: keep(f0.borders, live).map(x => ({ with: x.with, land: tx(x.land), disputed: !!x.disputed })),
      routes: keep(f0.routes, x => live(x) && placeOk(String(x.to || '').replace(/^place:/, ''))).map(x => ({ id: x.id, to: x.to, carries: strs(x.carries) })),
      migration: keep(f0.migration, x => live(x) && (x.when === undefined || rch(x.when))).map(x => ({ who: tx(x.who), from: x.from, to: x.to, why: tx(x.why), when: x.when })),
      reputation: keep(f0.reputation, x => live(x) && placeOk(String(x.place || '').replace(/^place:/, ''))).map(x => ({ place: x.place, view: tx(x.view) }))
    };
    // economy
    const e = r.economy, eb = block({ hidden: e.hidden, revealedIn: e.revealedIn }) !== null;
    out.economy = {
      resources: keep(e.resources, x => live(x) && when(x, 'from')).map(x => ({ id: x.id, name: tx(x.name), category: x.category, role: x.role, core: !!x.core, importance: x.importance,
        partners: keep(x.partners, refOk), route: tx(x.route), controlledBy: x.controlledBy && refOk(x.controlledBy) ? x.controlledBy : '', reserves: tx(x.reserves), ifCutOff: tx(x.ifCutOff), source: x.source && refOk(x.source) ? x.source : '', seasonal: tx(x.seasonal) })).filter(x => x.name),
      currency: eb ? tx(e.currency) : '', markets: eb ? tx(e.markets) : '', taxes: eb ? tx(e.taxes) : '', labour: eb ? tx(e.labour) : '', wealthGap: eb ? tx(e.wealthGap) : '',
      debts: keep(e.debts, x => live(x) && placeOk(String(x.place || '').replace(/^place:/, ''))).map(x => ({ place: x.place, owes: x.owes, owed: x.owed, what: tx(x.what) }))
    };
    out.beasts = keep(r.beasts, live).map(b => ({ ref: b.ref, relation: b.relation, wards: Array.isArray(b.wards) ? b.wards.slice() : [], incidents: keep(b.incidents, i => i.when === undefined || rch(i.when)).map(i => ({ when: i.when, text: tx(i.text) })),
      trade: tx(b.trade), keepers: tx(b.keepers), pact: b.pact && rch(b.pact.from) ? { terms: tx(b.pact.terms), from: b.pact.from, to: end(b.pact, 'to') } : null, note: tx(b.note) }));
    // intrigue: only lines whose own reveal chapter has been reached
    const shownI = list => keep(list, R);
    const i0 = r.intrigue;
    out.intrigue = {
      secrets: shownI(i0.secrets).map(x => ({ id: x.id, text: tx(x.text), about: keep(x.about, refOk), keepers: keep(x.keepers, k => !isRef(k.ref, 'char') || charOk(k.ref)).map(k => ({ ref: k.ref, why: tx(k.why) })),
        revealedIn: x.revealedIn, discoverable: x.discoverable && x.discoverable.where ? { where: x.discoverable.where, how: tx(x.discoverable.how) } : { where: '', how: '' } })),
      rumours: shownI(i0.rumours).map(x => ({ id: x.id, text: tx(x.text), aboutSecret: x.aboutSecret && R((i0.secrets || []).find(s => 'secret:' + r.placeId + '/' + s.id === x.aboutSecret)) ? x.aboutSecret : '', about: keep(x.about, refOk),
        origin: { where: tx((x.origin || {}).where), who: who((x.origin || {}).who), when: (x.origin || {}).when == null ? null : ((x.origin || {}).when), intent: (x.origin || {}).intent || '' },
        spread: keep(x.spread, y => (!y.when || rch(y.when)) && refOk(y.to)).map(y => ({ when: y.when, to: y.to, by: who(y.by) })), believers: keep(x.believers, refOk), effect: tx(x.effect), revealedIn: x.revealedIn })),
      questions: shownI(i0.questions).map(x => ({ id: x.id, text: tx(x.text), about: keep(x.about, refOk), revealedIn: x.revealedIn })),
      hooks: shownI(i0.hooks).map(x => ({ id: x.id, for: x.for && refOk(x.for) ? x.for : '', text: tx(x.text), revealedIn: x.revealedIn })),
      foreshadow: shownI(i0.foreshadow).map(x => ({ id: x.id, text: tx(x.text), revealedIn: x.revealedIn })),
      sealed: shownI(i0.sealed).map(x => ({ id: x.id, place: x.place, why: tx(x.why), whoHasKey: who(x.whoHasKey), revealedIn: x.revealedIn }))
    };
    return out;
  }
  const label = (set, id) => (set.find(x => x.id === id) || {}).label || id || '';
  const step = (scaleId, n) => { const s = SCALES.find(x => x.id === scaleId); return s && n >= 1 && n <= 7 ? s.steps[n - 1] : '?'; };

  global.EpitaphSites = {
    KEY, VERSION, BACKUP_KEY, STATUS, SCALES, SCALE_SETS, FORMS, ALLIANCE_KINDS, BEAST_RELATIONS, RESOURCE_CATEGORIES, RESOURCE_ROLES, FOUNDING_STAGES,
    MOTIVES, FACTION_KINDS, TIE_ENDINGS, TEMPERAMENTS, SOCIAL_SHAPES, WARD_KINDS, RUMOUR_INTENTS, TRIGGER_GROUPS,
    TABS, TAB_LABEL, DATA_TABS, DEFAULTS,
    alliancesAt, tieBars, webAt, blocsAt, ringSeats, WHATIF_STATUS, normWhatIf, foundingProblems, foundingLayers, entryFor, whatIfRef, whatIfList, whatIfPile, whatIfLinks, whatIfLoops, storyOf, forReader, secretHolders, couldFind, plantPayoff, SECRET_REF, placeReached, placeRevealChapter, hiddenNames, clean, authoring, load, get, save, reset, exportData, importData, newInData, draftUpdatesIn, mergeData, empty, normalise, upgradeRaw, uid, hasModel, reached, stateAt, alliancesOf, label, step
  };
})(typeof window !== 'undefined' ? window : globalThis);
