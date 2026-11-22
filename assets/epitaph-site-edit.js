/* Epitaph — Site Encyclopedia editor (step 3.1; design: "J, edit in place" from the canvas, Round 5).
 *
 * In the author's view every card of a place's entry gets a ✎. It opens into its form where it was (a list card opens just that item;
 * a toolbar chip opens the whole list). One engine draws, reads and saves every editable record from a table (UNITS) of fields, so all
 * seven tabs are covered the same way:
 *   pickers   seven-set chips, 7-dot scales (with the step names), a timeline picker (event title, "since the start", "ongoing"),
 *             place / character / secret pickers (type or pick), chip lists, lines, yes/no, repeatable rows
 *   the gate  every item that readers can be held back from has "Hidden from readers" + "Reveal in Ch" (EpitaphSites.forReader honours them)
 *   saving    EpitaphSites.save writes the tab; a saved tab is yours (Merge no longer replaces it); each save keeps the tab as it was,
 *             so Ctrl+Z / "Undo" brings it back (last 30, key epitaph-sites-undo)
 * Author only: nothing here loads an editor for a reader. Nothing is deleted without a second click.
 *
 *   EpitaphSiteEdit.UNITS            the table (for tests)
 *   EpitaphSiteEdit.decorate(layer, c, cur)   called by the entry after each draw
 */
(function (global) {
  'use strict';
  const Si = () => global.EpitaphSites, En = () => global.EpitaphSiteEntry, TL = () => global.EpitaphTimeline, Wd = () => global.EpitaphWorld;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o == null ? null : o));
  const gp = (o, p) => String(p).split('.').reduce((a, k) => a == null ? a : a[k], o);
  const sp = (o, p, v) => { const ks = String(p).split('.'); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; };
  const UNDO_KEY = 'epitaph-sites-undo', UNDO_MAX = 30;

  // ---------------------------------------------------------------- field builders
  const F = {
    text: (k, l, o) => Object.assign({ t: 'text', k, l }, o), area: (k, l, o) => Object.assign({ t: 'area', k, l }, o),
    pick: (k, l, set, o) => Object.assign({ t: 'pick', k, l, set }, o), picks: (k, l, set, o) => Object.assign({ t: 'picks', k, l, set }, o),
    dots: (k, l, scale, o) => Object.assign({ t: 'dots', k, l, scale }, o), scales: (k, l) => ({ t: 'scales', k, l }),
    when: (k, l, o) => Object.assign({ t: 'when', k, l }, o), chap: (k, l, o) => Object.assign({ t: 'chap', k, l }, o),
    ref: (k, l, kind, o) => Object.assign({ t: 'ref', k, l, kind: kind || 'any' }, o), refs: (k, l, kind, o) => Object.assign({ t: 'refs', k, l, kind: kind || 'any' }, o),
    lines: (k, l, o) => Object.assign({ t: 'lines', k, l }, o), bool: (k, l, o) => Object.assign({ t: 'bool', k, l }, o),
    sel: (k, l, opts, o) => Object.assign({ t: 'sel', k, l, opts }, o), rows: (k, l, fields, o) => Object.assign({ t: 'rows', k, l, fields }, o)
  };
  const HOLD = [F.bool('hidden', 'Hidden from readers'), F.chap('revealedIn', 'Reveal in Ch', { note: 'readers see it from this chapter' })];
  const SEC = { author: true };           // author-only fields: marked, never published

  // ---------------------------------------------------------------- the table: every editable record
  // key: where it lives in the record (a path); tab: which tab it belongs to; list: an array of items (else one object);
  // ids: items get an id; hold: adds Hidden + Reveal; title(item): its heading; make(): a new item; need: the field that must be filled
  const U = (key, tab, o) => Object.assign({ key, at: key, tab, list: false, ids: false, hold: false }, o);
  const KINDS = [['myth', 'Myth'], ['gods', 'Gods'], ['world', 'World'], ['place', 'Place'], ['people', 'People'], ['war', 'War'], ['story', 'Story']];
  const ROLES = [['produces', 'Produces'], ['needs', 'Needs'], ['scarce', 'Scarce'], ['guards', 'Guards']];
  const TRUTH = [['', '— (author only)'], ['true', 'True'], ['half', 'Half-true'], ['false', 'False']];
  const STATUSES = [['idea', 'Idea'], ['planned', 'Planned'], ['written', 'Written'], ['dropped', 'Dropped']];
  const UNITS = [
    U('overview.states', 'overview', { label: 'States', noun: 'state', list: true, title: x => (Si().label(Si().STATUS, x.status) || 'State'), make: () => ({ from: null, status: 'standing', scales: { size: 3, hold: 3, stability: 3, supply: 3, defence: 3, secrecy: 3, written: 3 }, techLevel: 0, note: '' }),
      fields: [F.when('from', 'Starts', { none: 'since the start' }), F.pick('status', 'Status', 'STATUS'), F.scales('scales', 'The seven scales'), F.dots('techLevel', 'Technology', 'tech', { opt: true }), F.area('note', 'Note')] }),
    U('history.purpose', 'history', { label: 'Purpose', hold: true, fields: [F.area('original', 'Original purpose'), F.area('now', 'Now'), F.area('drift', 'Drift')] }),
    U('history.founders', 'history', { label: 'Founders', noun: 'founder', list: true, hold: true, title: x => x.name || x.ref || 'Founder', make: () => ({ ref: '', name: '', role: '', fate: '' }), fields: [F.ref('ref', 'Character', 'char'), F.text('name', 'Or a name'), F.text('role', 'Role'), F.text('fate', 'Fate', SEC)] }),
    U('history.settlers', 'history', { label: 'First settlers', hold: true, fields: [F.text('who', 'Who'), F.text('from', 'From'), F.area('why', 'Why')] }),
    U('history.founding', 'history', { label: 'Founding stages', noun: 'stage', list: true, title: x => Si().label(Si().FOUNDING_STAGES, x.stage) || 'Stage', make: () => ({ stage: 'reason', when: null, why: '', who: '', materials: '', reused: '', change: '' }),
      fields: [F.pick('stage', 'Stage', 'FOUNDING_STAGES'), F.when('when', 'When', { none: 'since the start' }), F.area('why', 'Why'), F.text('who', 'Who'), F.text('materials', 'Materials'), F.text('reused', 'Reused from the old world'), F.area('change', 'What changed')] }),
    U('history.myth', 'history', { label: 'Founding myth', hold: true, fields: [F.area('text', 'The myth'), F.sel('true', 'How true', TRUTH, SEC)] }),
    U('history.name', 'history', { label: 'Name', hold: true, fields: [F.text('meaning', 'What it means'), F.lines('older', 'Older names'), F.lines('outsiders', 'What outsiders call it')] }),
    U('history.chronicle', 'history', { label: 'Chronicle', noun: 'event', list: true, ids: true, hold: true, title: x => x.title || 'Event', need: 'title', make: () => ({ id: '', when: null, title: '', kind: 'place', text: '', turningPoint: false, refs: [] }),
      fields: [F.text('title', 'Title'), F.when('when', 'When', { none: 'undated' }), F.sel('kind', 'Kind', KINDS), F.area('text', 'What happened'), F.bool('turningPoint', 'A turning point'), F.refs('refs', 'About', 'any')] }),
    U('history.eras', 'history', { label: 'Eras', noun: 'era', list: true, hold: true, title: x => x.name || 'Era', need: 'name', make: () => ({ name: '', from: null, to: null, note: '' }),
      fields: [F.text('name', 'Name'), F.when('from', 'From', { none: 'since the start' }), F.when('to', 'To', { none: 'ongoing' }), F.text('note', 'Note')] }),
    U('history.landmarks', 'history', { label: 'Landmarks', noun: 'landmark', list: true, ids: true, hold: true, title: x => x.name || 'Landmark', need: 'name', make: () => ({ id: '', name: '', built: '', by: '', story: '', sealed: false }),
      fields: [F.text('name', 'Name'), F.when('built', 'Built', { none: 'unknown', blank: true }), F.ref('by', 'Built by', 'any'), F.area('story', 'Its story'), F.bool('sealed', 'Sealed (nobody enters)')] }),
    U('history.lost', 'history', { label: 'Lost things', noun: 'lost thing', list: true, hold: true, title: x => x.name || 'Lost', need: 'name', make: () => ({ name: '', when: null, how: '' }),
      fields: [F.text('name', 'What was lost'), F.when('when', 'When', { none: 'undated' }), F.text('how', 'How')] }),
    U('history.record', 'history', { label: 'The record', noun: 'topic', list: true, hold: true, title: x => x.topic || 'Topic', need: 'topic', make: () => ({ topic: '', official: '', truth: '', suspects: [], evidence: [], forbidden: '' }),
      fields: [F.text('topic', 'Topic'), F.area('official', 'Official version'), F.area('truth', 'What really happened', SEC), F.refs('suspects', 'Who suspects', 'any', SEC),
        F.rows('evidence', 'Evidence lying around', [F.text('what', 'What'), F.text('where', 'Where'), F.chap('revealedIn', 'Found in Ch')], SEC), F.text('forbidden', 'Forbidden to ask', SEC)] }),
    U('domestic.government', 'domestic', { label: 'Government', hold: true, fields: [F.pick('form', 'Form of rule', 'FORMS'), F.text('stance', 'Stance (Storyborn, Voided, Fallen…)'),
      F.rows('offices', 'Offices', [F.text('title', 'Title'), F.text('holds', 'Holds'), F.ref('holder', 'Holder', 'char')]),
      F.rows('holders', 'Rulers over time', [F.ref('ref', 'Who', 'char'), F.text('title', 'Title'), F.when('from', 'From', { none: 'since the start' }), F.when('to', 'To', { none: 'ongoing' })]),
      F.rows('laws', 'Laws', [F.text('text', 'The law'), F.when('from', 'From', { none: 'since the start' }), F.when('to', 'To', { none: 'in force' }), F.bool('hidden', 'Hidden')]),
      F.area('succession', 'Succession'), F.area('justice', 'Justice and punishment'), F.area('citizenship', 'Citizenship'), F.area('outsiders', 'How outsiders are treated'), F.area('corruption', 'Corruption', SEC)] }),
    U('domestic.factions', 'domestic', { label: 'Factions', noun: 'faction', list: true, ids: true, hold: true, title: x => x.name || 'Faction', need: 'name', make: () => ({ id: '', name: '', kind: 'ruling', leader: '', goals: { public: '', secret: '' }, members: [], size: '', strength: 3, stance: '', ties: [], controls: [], hidden: false, from: null, to: null }),
      fields: [F.text('name', 'Name'), F.pick('kind', 'Kind', 'FACTION_KINDS'), F.dots('strength', 'Strength', 'strength'), F.area('goals.public', 'Public goal'), F.area('goals.secret', 'Secret goal', SEC),
        F.ref('leader', 'Leader', 'char'), F.refs('members', 'Members', 'char'), F.text('size', 'Size'), F.text('stance', 'Stance toward the rulers'),
        F.rows('ties', 'Ties to other factions and places', [F.ref('ref', 'With', 'any'), F.text('how', 'How')]), F.lines('controls', 'What it controls'),
        F.when('from', 'Starts', { none: 'since the start' }), F.when('to', 'Ends', { none: 'ongoing' })] }),
    U('domestic.figures', 'domestic', { label: 'Key figures', noun: 'figure', list: true, ids: true, hold: true, title: x => x.name || x.ref || 'Figure', make: () => ({ id: '', ref: '', name: '', role: '', faction: '', goals: { public: '', secret: '' }, fears: '', leverage: [], relationships: [], status: [] }),
      fields: [F.ref('ref', 'Dossier character', 'char'), F.text('name', 'Or a name (not in the Dossier)'), F.text('role', 'Role and title'), F.sel('faction', 'Faction', ctx => [['', '— none']].concat((ctx.rec.domestic.factions || []).map(f => [f.id, f.name]))),
        F.area('goals.public', 'Wants'), F.area('goals.secret', 'Secretly wants', SEC), F.area('fears', 'Fears', SEC), F.rows('leverage', 'Leverage', [F.text('over', 'Over / by'), F.text('what', 'What')], SEC),
        F.rows('relationships', 'Relationships', [F.ref('ref', 'With', 'any'), F.text('kind', 'Kind')], SEC), F.rows('status', 'Status over time', [F.when('from', 'From', { none: 'since the start' }), F.text('value', 'Status')])] }),
    U('domestic.unrest', 'domestic', { label: 'Unrest', noun: 'episode', list: true, ids: true, hold: true, title: x => (x.causes || [])[0] || 'Episode', make: () => ({ id: '', from: null, to: null, causes: [], flashpoints: [], leaders: [], response: '', outcome: '' }),
      fields: [F.when('from', 'Starts', { none: 'unknown' }), F.when('to', 'Ends', { none: 'still burning' }), F.lines('causes', 'Causes'), F.rows('flashpoints', 'Flashpoints', [F.text('where', 'Where'), F.when('when', 'When', { none: 'undated' })], SEC),
        F.refs('leaders', 'Who leads it', 'any', SEC), F.area('response', 'How the rulers respond'), F.area('outcome', 'Outcome')] }),
    U('domestic.society', 'domestic', { label: 'Society & faith', hold: true, fields: [F.area('daily', 'Daily life'), F.area('customs', 'Customs'), F.area('festivals', 'Festivals'), F.area('taboos', 'Taboos'), F.area('faith', 'Faith'), F.area('culture', 'Art and culture'),
      F.text('outsiders.storyborn', 'Attitude to Storyborn'), F.text('outsiders.voided', 'Attitude to the Voided'), F.text('outsiders.fallen', 'Attitude to the Fallen'), F.text('outsiders.foreign', 'Attitude to foreigners')] }),
    U('domestic.knowledge', 'domestic', { label: 'Knowledge & technology', hold: true, fields: [F.rows('era0', 'Era 0 technology that survives', [F.text('what', 'What'), F.bool('works', 'Works'), F.text('who', 'Who controls it')]),
      F.area('energy', 'Energy'), F.area('medicine', 'Medicine'), F.area('communication', 'Communication'), F.area('weapons', 'Weapons and armour'), F.area('education', 'Education'), F.rows('forbidden', 'Forbidden knowledge', [F.text('what', 'What'), F.text('why', 'Why', SEC)])] }),
    U('domestic.military', 'domestic', { label: 'Military & warding', hold: true, fields: [F.rows('forces', 'Forces', [F.text('name', 'Name'), F.text('size', 'Size')]), F.lines('ranks', 'Ranks'), F.area('doctrine', 'Doctrine'), F.refs('commanders', 'Notable commanders', 'char'), F.lines('campaigns', 'Past campaigns', SEC)] }),
    U('foreign.ties', 'foreign', { label: 'Ties', noun: 'tie', list: true, ids: true, title: x => (x.with || 'Tie').replace(/^place:/, ''), need: 'with', make: () => ({ id: '', with: '', kind: 'alliance', motive: '', motiveDetail: '', terms: [], target: '', signed: { when: '', by: [], where: '' }, renewal: { expires: '', conditions: '' }, public: '', real: '', wantsItToFail: [], ends: { when: '', how: '', note: '' }, secret: false, from: null, to: null, note: '' }),
      fields: [F.ref('with', 'With (place)', 'place'), F.pick('kind', 'Kind', 'ALLIANCE_KINDS'), F.pick('motive', 'Motive', 'MOTIVES'), F.text('motiveDetail', 'Motive, in detail'), F.rows('terms', 'Terms', [F.text('side', 'Side'), F.text('gives', 'Gives'), F.text('gets', 'Gets')]),
        F.ref('target', 'Against (if anyone)', 'any', SEC), F.text('signed.when', 'Signed (when)'), F.refs('signed.by', 'Signed by', 'char'), F.text('signed.where', 'Signed (where)'), F.text('renewal.expires', 'Expires'), F.text('renewal.conditions', 'Renewal conditions'),
        F.area('public', 'The public story'), F.area('real', 'The real reason', SEC), F.refs('wantsItToFail', 'Who wants it to fail', 'any', SEC), F.when('from', 'Starts', { none: 'since the start' }), F.when('to', 'Ends', { none: 'ongoing' }),
        F.pick('ends.how', 'How it ended', 'TIE_ENDINGS'), F.area('ends.note', 'About the ending', SEC), F.bool('secret', 'A secret tie (hidden until revealed)'), F.area('note', 'Note')] }),
    U('foreign.blocs', 'foreign', { label: 'Blocs', noun: 'bloc', list: true, ids: true, hold: true, title: x => x.name || 'Bloc', need: 'name', make: () => ({ id: '', name: '', charter: '', members: [], seat: '', purpose: '', rival: '', tension: '' }),
      fields: [F.text('name', 'Name'), F.area('charter', 'Charter'), F.rows('members', 'Members', [F.ref('place', 'Place', 'place'), F.when('from', 'Joins', { none: 'founding member' }), F.when('to', 'Leaves', { none: 'still a member' })]), F.ref('seat', 'Seat', 'any'), F.area('purpose', 'Purpose'), F.ref('rival', 'Rival bloc', 'any'), F.area('tension', 'Internal tension')] }),
    U('foreign.envoys', 'foreign', { label: 'Envoys', noun: 'envoy', list: true, hold: true, title: x => x.name || x.ref || 'Envoy', make: () => ({ ref: '', name: '', to: '', from: null, to_: null }),
      fields: [F.ref('ref', 'Character', 'char'), F.text('name', 'Or a name'), F.ref('to', 'Sent to', 'place'), F.when('from', 'From', { none: 'since the start' }), F.when('to_', 'Until', { none: 'ongoing' })] }),
    U('foreign.hostages', 'foreign', { label: 'Hostages', noun: 'hostage', list: true, hold: true, title: x => x.name || x.ref || 'Hostage', make: () => ({ ref: '', name: '', heldBy: '', why: '', from: null, to: null }),
      fields: [F.ref('ref', 'Character', 'char'), F.text('name', 'Or a name'), F.ref('heldBy', 'Held by', 'any'), F.area('why', 'Why'), F.when('from', 'From', { none: 'since the start' }), F.when('to', 'Until', { none: 'ongoing' })] }),
    U('foreign.agents', 'foreign', { label: 'Agents abroad', noun: 'agent', list: true, title: x => x.name || x.ref || 'Agent', make: () => ({ ref: '', name: '', in: '', for: '', cover: '', exposed: false }),
      fields: [F.ref('ref', 'Character', 'char', SEC), F.text('name', 'Or a name', SEC), F.ref('in', 'Placed in', 'place', SEC), F.text('for', 'Working for', null), F.text('cover', 'Cover story', SEC), F.bool('exposed', 'Exposed')] }),
    U('foreign.borders', 'foreign', { label: 'Borders', noun: 'border', list: true, hold: true, title: x => x.land || 'Border', make: () => ({ with: '', land: '', disputed: false }), fields: [F.ref('with', 'With', 'place'), F.text('land', 'The land'), F.bool('disputed', 'Disputed')] }),
    U('foreign.routes', 'foreign', { label: 'Trade routes', noun: 'route', list: true, ids: true, hold: true, title: x => (x.to || 'Route').replace(/^place:/, ''), make: () => ({ id: '', to: '', carries: [], dangers: [] }),
      fields: [F.ref('to', 'To', 'place'), F.lines('carries', 'Carries'), F.refs('dangers', 'Dangers', 'any', SEC)] }),
    U('foreign.migration', 'foreign', { label: 'Migration', noun: 'movement', list: true, hold: true, title: x => x.who || 'Movement', make: () => ({ who: '', from: '', to: '', why: '', when: null }),
      fields: [F.text('who', 'Who'), F.ref('from', 'From', 'any'), F.ref('to', 'To', 'any'), F.text('why', 'Why'), F.when('when', 'When', { none: 'undated' })] }),
    U('foreign.reputation', 'foreign', { label: 'Reputation abroad', noun: 'view', list: true, hold: true, title: x => (x.place || 'View').replace(/^place:/, ''), make: () => ({ place: '', view: '' }), fields: [F.ref('place', 'Place', 'place'), F.area('view', 'How they see it')] }),
    U('economy.resources', 'economy', { label: 'Resources', noun: 'resource', list: true, ids: true, hold: true, title: x => x.name || 'Resource', need: 'name', make: () => ({ id: '', name: '', category: 'food', role: 'produces', core: false, importance: 3, partners: [], route: '', controlledBy: '', reserves: '', ifCutOff: '', source: '', seasonal: '', from: null }),
      fields: [F.text('name', 'Name'), F.pick('category', 'Category', 'RESOURCE_CATEGORIES'), F.sel('role', 'Role', ROLES), F.bool('core', 'A core export'), F.dots('importance', 'Importance', 'importance'), F.refs('partners', 'Trade partners', 'place'), F.text('route', 'Route'),
        F.ref('controlledBy', 'Controlled by', 'any'), F.text('reserves', 'Reserves'), F.area('ifCutOff', 'If it is cut off'), F.ref('source', 'Source', 'any'), F.text('seasonal', 'Seasonal'), F.when('from', 'Available from', { none: 'since the start' })] }),
    U('economy.prose', 'economy', { label: 'The wider economy', at: 'economy', hold: true, fields: [F.area('currency', 'Currency'), F.area('markets', 'Markets and fairs'), F.area('taxes', 'Taxes and tariffs'), F.area('blackMarket', 'Black market', SEC), F.area('labour', 'Labour'), F.area('wealthGap', 'Wealth gap')] }),
    U('economy.debts', 'economy', { label: 'Debts', noun: 'debt', list: true, hold: true, title: x => (x.place || 'Debt').replace(/^place:/, ''), make: () => ({ place: '', owes: '', owed: '', what: '' }), fields: [F.ref('place', 'Place', 'place'), F.text('owes', 'This place owes'), F.text('owed', 'This place is owed'), F.area('what', 'What')] }),
    U('beasts', 'beasts', { label: 'Beasts', noun: 'beast', list: true, hold: true, title: x => (x.ref || 'Beast').replace(/^creature:/, ''), need: 'ref', make: () => ({ ref: '', relation: 'common', wards: [], incidents: [], trade: '', keepers: '', pact: null, note: '' }),
      fields: [F.ref('ref', 'Creature', 'creature'), F.pick('relation', 'Relation', 'BEAST_RELATIONS'), F.picks('wards', 'Wards used', 'WARD_KINDS'), F.rows('incidents', 'Incidents', [F.when('when', 'When', { none: 'undated' }), F.text('text', 'What happened')]),
        F.text('trade', 'Beast trade'), F.text('keepers', 'Keepers or hunters'), F.text('pact.terms', 'Pact terms'), F.when('pact.from', 'Pact from', { none: 'no pact' }), F.when('pact.to', 'Pact until', { none: 'ongoing' }), F.area('note', 'Note')] }),
    U('intrigue.secrets', 'intrigue', { label: 'Secrets', noun: 'secret', list: true, ids: true, title: x => x.text || 'Secret', need: 'text', make: () => ({ id: '', text: '', about: [], keepers: [], evidence: [], setup: null, payoff: null, revealedIn: null, unlocks: [], related: [], discoverable: { where: '', how: '' } }),
      fields: [F.area('text', 'The secret'), F.refs('about', 'About', 'any'), F.rows('keepers', 'Keepers', [F.ref('ref', 'Who', 'any'), F.text('why', 'Why')]), F.refs('evidence', 'Evidence (record:…)', 'any'), F.refs('related', 'Related secrets', 'secret'), F.refs('unlocks', 'Unlocks', 'any'),
        F.ref('discoverable.where', 'Can be found at', 'any'), F.text('discoverable.how', 'How it is found'), F.chap('setup', 'Set up in Ch'), F.chap('payoff', 'Pays off in Ch'), F.chap('revealedIn', 'Reveal to readers in Ch')] }),
    U('intrigue.rumours', 'intrigue', { label: 'Rumours', noun: 'rumour', list: true, ids: true, title: x => x.text || 'Rumour', need: 'text', make: () => ({ id: '', text: '', truth: '', about: [], aboutSecret: '', origin: { where: '', who: '', when: null, intent: '' }, spread: [], believers: [], effect: '', revealedIn: null }),
      fields: [F.area('text', 'The rumour'), F.sel('truth', 'How true', TRUTH, SEC), F.refs('about', 'About', 'any'), F.ref('aboutSecret', 'Distorts the secret', 'secret'), F.text('origin.where', 'Started where'), F.ref('origin.who', 'Started by', 'any'), F.when('origin.when', 'Started when', { none: 'undated' }),
        F.pick('origin.intent', 'Intent', 'RUMOUR_INTENTS'), F.rows('spread', 'How it spread', [F.when('when', 'When', { none: 'undated' }), F.ref('to', 'To', 'any'), F.ref('by', 'Carried by', 'any')]), F.refs('believers', 'Who believes it', 'any'), F.area('effect', 'Its effect'), F.chap('revealedIn', 'Reveal to readers in Ch')] }),
    U('intrigue.questions', 'intrigue', { label: 'Questions', noun: 'question', list: true, ids: true, title: x => x.text || 'Question', need: 'text', make: () => ({ id: '', text: '', about: [], answeredBy: '', revealedIn: null }), fields: [F.area('text', 'The question'), F.refs('about', 'About', 'any'), F.ref('answeredBy', 'Answered by (secret)', 'secret', SEC), F.chap('revealedIn', 'Reveal to readers in Ch')] }),
    U('intrigue.hooks', 'intrigue', { label: 'Hooks', noun: 'hook', list: true, ids: true, title: x => x.text || 'Hook', need: 'text', make: () => ({ id: '', for: '', text: '', revealedIn: null }), fields: [F.ref('for', 'For (character)', 'char'), F.area('text', 'The hook'), F.chap('revealedIn', 'Reveal to readers in Ch')] }),
    U('intrigue.foreshadow', 'intrigue', { label: 'Foreshadowing', noun: 'line', list: true, ids: true, title: x => x.text || 'Foreshadowing', need: 'text', make: () => ({ id: '', text: '', plantIn: null, pointsTo: '', revealedIn: null }), fields: [F.area('text', 'What to plant'), F.chap('plantIn', 'Plant in Ch'), F.ref('pointsTo', 'Points to (secret)', 'secret', SEC), F.chap('revealedIn', 'Reveal to readers in Ch')] }),
    U('intrigue.sealed', 'intrigue', { label: 'Sealed places', noun: 'sealed place', list: true, ids: true, title: x => x.why || x.place || 'Sealed', make: () => ({ id: '', place: '', why: '', whoHasKey: '', revealedIn: null }), fields: [F.ref('place', 'Where (landmark or place)', 'any'), F.area('why', 'Why it is sealed'), F.ref('whoHasKey', 'Who has the key', 'any'), F.chap('revealedIn', 'Reveal to readers in Ch')] }),
    U('scenarios', 'intrigue', { label: 'What-ifs', noun: 'what-if', list: true, ids: true, title: x => x.trigger || 'What-if', need: 'trigger', make: () => ({ id: '', trigger: '', triggerKind: 'ties', about: [], causes: [], fallout: [], warnings: [], likelihood: 3, status: 'idea', chapter: null }),
      fields: [F.text('trigger', 'What happens'), F.pick('triggerKind', 'Kind of trigger', 'TRIGGER_GROUPS'), F.refs('about', 'About', 'any'), F.rows('causes', 'Causes being weighed', [F.text('group', 'Kind'), F.text('cause', 'Cause'), F.text('note', 'Note')]),
        F.rows('fallout', 'Fallout per place', [F.ref('place', 'Place', 'place'), F.text('what', 'What happens')]), F.rows('warnings', 'Warning signs', [F.text('text', 'The sign'), F.chap('plantIn', 'Plant in Ch')]), F.dots('likelihood', 'Likelihood', 'likelihood'), F.sel('status', 'Status', STATUSES), F.chap('chapter', 'Written in Ch')] })
  ];
  const BYKEY = {}; UNITS.forEach(u => { BYKEY[u.key] = u; if (u.hold) u.fields = u.fields.concat(HOLD); else if (u.list) { /* no hold */ } });

  // ---------------------------------------------------------------- context: choices for pickers
  let cache = null;
  function choices(c) {
    const Sx = Si(), T = TL(), W = Wd();
    const events = T ? T.load().slice().sort((a, b) => T.compare(a, b)) : [];
    const chars = ((c.dossier && c.dossier.characters) || []).map(x => x.name).filter(Boolean);
    const places = (W ? W.places() : []).filter(p => p.fictional || p.group || p.lat != null).slice(0, 4000);
    const secrets = []; Sx.load().forEach(r => (r.intrigue.secrets || []).forEach(x => secrets.push(['secret:' + r.placeId + '/' + x.id, (x.text || '').slice(0, 60)])));
    const mine = []; const r = c.rec;
    (r.domestic.factions || []).forEach(x => mine.push(['faction:' + r.placeId + '/' + x.id, x.name])); (r.history.landmarks || []).forEach(x => mine.push(['landmark:' + r.placeId + '/' + x.id, x.name]));
    (r.history.record || []).forEach(x => mine.push(['record:' + r.placeId + '/' + String(x.topic || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), x.topic])); (r.economy.resources || []).forEach(x => mine.push(['resource:' + r.placeId + '/' + x.id, x.name]));
    const lists = {
      char: chars.map(n => ['char:' + n, n]), place: places.map(p => ['place:' + p.id, p.name]), secret: secrets, creature: [],
      any: chars.map(n => ['char:' + n, n]).concat(places.map(p => ['place:' + p.id, p.name]), mine, secrets)
    };
    return { events, lists };
  }
  const eventLabel = e => { const T = TL(); return (T ? T.label(e.when) : '') + ' · ' + String(e.title || e.id).slice(0, 56); };

  // ---------------------------------------------------------------- drawing a field
  const SET = n => (Si() && Si()[n]) || [];
  function fieldHtml(f, val, ctx, scope) {
    const id = 'sef-' + Math.random().toString(36).slice(2, 8), lab = esc(f.l) + (f.author ? ' <em class="se-fa" title="Author only: never published">◆ author</em>' : '') + (f.note ? ` <small>${esc(f.note)}</small>` : '');
    const wrap = (inner, tag) => `<${tag || 'div'} class="se-f${f.t === 'area' || f.t === 'rows' || f.t === 'refs' || f.t === 'lines' || f.t === 'scales' ? ' wide' : ''}" data-fk="${esc(f.k)}"><span class="se-fl"${tag === 'label' ? '' : ` id="${id}"`}>${lab}</span><div class="se-fc">${inner}</div></${tag || 'div'}>`;
    const v = val;
    switch (f.t) {
      case 'text': return wrap(`<input type="text" data-f="${esc(f.k)}" data-t="text" value="${esc(v)}">`, 'label');
      case 'area': return wrap(`<textarea data-f="${esc(f.k)}" data-t="area" rows="2">${esc(v)}</textarea>`, 'label');
      case 'lines': return wrap(`<textarea data-f="${esc(f.k)}" data-t="lines" rows="2" placeholder="one per line">${esc(Array.isArray(v) ? v.join('\n') : '')}</textarea>`, 'label');
      case 'chap': return wrap(`<input type="number" min="1" step="1" data-f="${esc(f.k)}" data-t="chap" value="${Number.isInteger(v) ? v : ''}" placeholder="—">`, 'label');
      case 'bool': return `<label class="se-f se-bool" data-fk="${esc(f.k)}"><span class="se-fc"><input type="checkbox" data-f="${esc(f.k)}" data-t="bool"${v ? ' checked' : ''}></span><span class="se-fl">${lab}</span></label>`;
      case 'sel': { const opts = typeof f.opts === 'function' ? f.opts(ctx) : f.opts; return wrap(`<select data-f="${esc(f.k)}" data-t="sel">${opts.map(o => `<option value="${esc(o[0])}"${String(v == null ? '' : v) === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`, 'label'); }
      case 'when': {
        const none = f.none || 'none', cur = v == null || v === '' ? '' : v;
        const known = ctx.ch.events.some(e => e.id === cur);
        return wrap(`<select data-f="${esc(f.k)}" data-t="when" data-blank="${f.blank ? 1 : 0}"><option value="">${esc(none)}</option>${cur && !known ? `<option value="${esc(cur)}" selected>${esc(cur)} (not on the timeline)</option>` : ''}${ctx.ch.events.map(e => `<option value="${esc(e.id)}"${e.id === cur ? ' selected' : ''}>${esc(eventLabel(e))}</option>`).join('')}</select>`, 'label');
      }
      case 'ref': { const lst = ctx.ch.lists[f.kind] ? f.kind : 'any'; return wrap(`<input type="text" data-f="${esc(f.k)}" data-t="ref" list="seDl-${lst}" value="${esc(v)}" placeholder="pick, or type">`, 'label'); }
      case 'refs': { const lst = ctx.ch.lists[f.kind] ? f.kind : 'any', arr = Array.isArray(v) ? v : [];
        return wrap(`<div class="se-chipsf" data-f="${esc(f.k)}" data-t="refs" data-v="${esc(JSON.stringify(arr))}">${arr.map(chipX).join('')}<input type="text" list="seDl-${lst}" placeholder="+ add (Enter)" aria-label="Add to ${esc(f.l)}"></div>`); }
      case 'pick': { const set = SET(f.set); return wrap(`<div class="se-pickf" data-f="${esc(f.k)}" data-t="pick" data-v="${esc(v == null ? '' : v)}" role="group" aria-labelledby="${id}">${set.map(o => `<button type="button" class="se-pc${o.id === v ? ' on' : ''}" data-pv="${esc(o.id)}" title="${esc(o.rule || '')}">${esc(o.label)}</button>`).join('')}</div>`); }
      case 'picks': { const set = SET(f.set), arr = Array.isArray(v) ? v : []; return wrap(`<div class="se-pickf" data-f="${esc(f.k)}" data-t="picks" data-v="${esc(JSON.stringify(arr))}" role="group" aria-labelledby="${id}">${set.map(o => `<button type="button" class="se-pc${arr.includes(o.id) ? ' on' : ''}" data-pv="${esc(o.id)}" aria-pressed="${arr.includes(o.id)}">${esc(o.label)}</button>`).join('')}</div>`); }
      case 'dots': return wrap(dotsHtml(f.k, f.scale, Number.isInteger(v) ? v : 0, !!f.opt));
      case 'scales': { const sc = v || {}; return wrap(`<div class="se-scalesf" data-f="${esc(f.k)}" data-t="scales">${SET('SCALES').map(s => `<div class="se-sc"><span class="se-fl">${esc(s.label)}</span>${dotsHtml(s.id, s.id, sc[s.id] || 0, false)}</div>`).join('')}</div>`); }
      case 'rows': { const arr = Array.isArray(v) ? v : [];
        const tpl = rowHtml(f, {}, ctx); return wrap(`<div class="se-rowsf" data-f="${esc(f.k)}" data-t="rows" data-tpl="${esc(tpl)}">${arr.map(r => rowHtml(f, r, ctx)).join('')}<button type="button" class="se-add" data-se-rowadd>+ add</button></div>`); }
      default: return '';
    }
  }
  const chipX = x => `<span class="se-ck" data-cv="${esc(x)}">${esc(String(x).replace(/^(char|place|secret|faction|landmark|record|tie|resource|creature):(?:[\w-]+\/)?/, ''))}<button type="button" data-se-chipx aria-label="Remove ${esc(x)}">×</button></span>`;
  function dotsHtml(k, scale, n, optional) {
    const names = scale === 'strength' || scale === 'importance' || scale === 'likelihood' || scale === 'tech' ? (Si().SCALE_SETS[scale] || {}).steps : ((SET('SCALES').find(s => s.id === scale) || {}).steps);
    return `<div class="se-dotsf" data-f="${esc(k)}" data-t="dots" data-v="${n}" data-opt="${optional ? 1 : 0}" data-names="${esc(JSON.stringify(names || []))}">${[1, 2, 3, 4, 5, 6, 7].map(i => `<button type="button" class="se-dot${i <= n ? ' on' : ''}" data-dv="${i}" aria-label="${i}${names ? ' · ' + esc(names[i - 1]) : ''}" title="${names ? esc(names[i - 1]) : i}"></button>`).join('')}<span class="se-dn">${n && names ? n + ' · ' + esc(names[n - 1]) : (n ? n : '—')}</span>${optional ? '<button type="button" class="se-dclr" data-dv="0" aria-label="Clear">×</button>' : ''}</div>`;
  }
  function rowHtml(f, r, ctx) { return `<div class="se-rowf" data-row><div class="se-fgrid">${f.fields.map(g => fieldHtml(g, gp(r, g.k), ctx)).join('')}</div><button type="button" class="se-x" data-se-rowdel aria-label="Remove this row">×</button></div>`; }

  // ---------------------------------------------------------------- reading a field back
  function readField(f, root) {
    const w = root.querySelector(':scope > .se-fgrid > [data-fk="' + CSS.escape(f.k) + '"]'); if (!w) return undefined;
    const el = w.querySelector('[data-f]'); if (!el) return undefined;
    switch (f.t) {
      case 'text': case 'ref': case 'sel': return el.value.trim();
      case 'area': return el.value.replace(/\s+$/g, '');
      case 'lines': return el.value.split('\n').map(x => x.trim()).filter(Boolean);
      case 'chap': { const n = parseInt(el.value, 10); return Number.isInteger(n) && n > 0 ? n : null; }
      case 'bool': return !!el.checked;
      case 'when': return el.value === '' ? (el.dataset.blank === '1' ? '' : null) : el.value;
      case 'pick': return el.dataset.v || '';
      case 'picks': case 'refs': try { return JSON.parse(el.dataset.v || '[]'); } catch (e) { return []; }
      case 'dots': return parseInt(el.dataset.v, 10) || 0;
      case 'scales': { const out = {}; el.querySelectorAll('[data-t="dots"]').forEach(d => { out[d.dataset.f] = parseInt(d.dataset.v, 10) || 1; }); return out; }
      case 'rows': return [...el.querySelectorAll(':scope > [data-row]')].map(row => readBlock(row, f.fields)).filter(o => Object.values(o).some(x => !(x === '' || x == null || x === false || (Array.isArray(x) && !x.length) || (typeof x === 'object' && x && !Array.isArray(x) && !Object.values(x).some(Boolean)))));
      default: return undefined;
    }
  }
  function readBlock(root, fields) { const out = {}; fields.forEach(f => { const v = readField(f, root); if (v !== undefined) sp(out, f.k, v); }); return out; }

  // ---------------------------------------------------------------- units: find, read the current data, save
  function parsePath(path) {
    const keys = Object.keys(BYKEY).sort((a, b) => b.length - a.length);
    const k = keys.find(x => path === x || path.startsWith(x + '.')); if (!k) return null;
    const rest = path.slice(k.length + 1), idx = rest === '' ? null : parseInt(rest, 10);
    return { unit: BYKEY[k], idx: Number.isInteger(idx) ? idx : null };
  }
  const tabKeyOf = u => u.at.split('.')[0];
  const dataOf = (rec, u) => gp(rec, u.at);
  function saveUnit(c, u, blocks, removed) {
    const Sx = Si(), rec = clone(Sx.get(c.pid) || Sx.empty(c.pid)), tabKey = tabKeyOf(u), before = clone(rec[tabKey]), wasDraft = !!(rec.draft || {})[tabKey];
    const tab = clone(rec[tabKey]);
    if (!u.list) {
      const cur = u.at === tabKey ? tab : gp(tab, u.at.split('.').slice(1).join('.')), merged = Object.assign({}, cur, blocks[0].values);
      if (u.at === tabKey) Object.assign(tab, merged); else sp(tab, u.at.split('.').slice(1).join('.'), merged);
    } else {
      const arr = u.at === tabKey ? tab : gp(tab, u.at.split('.').slice(1).join('.'));
      const list = Array.isArray(arr) ? arr : [];
      const out = [];
      list.forEach((it, i) => { const b = blocks.find(x => x.orig === i); if (removed.includes(i)) return; out.push(b ? Object.assign({}, it, b.values) : it); });
      blocks.filter(b => b.orig == null && !b.removed).forEach(b => { const it = Object.assign(u.make(), b.values); if (u.ids) it.id = Sx.uid(it[u.need || 'name'] || it.title || u.noun, out); out.push(it); });
      // keep the author's order when they only edited one item; a list form keeps list order, new items last
      if (u.at === tabKey) { tab.length = 0; out.forEach(x => tab.push(x)); } else sp(tab, u.at.split('.').slice(1).join('.'), out);
    }
    if (!Sx.save(Object.assign({ placeId: c.pid }, { [tabKey]: tab }))) return false;
    pushUndo({ placeId: c.pid, tab: tabKey, before, wasDraft, at: Date.now(), label: u.label });
    return true;
  }

  // ---------------------------------------------------------------- undo
  function undoStack() { try { return JSON.parse(localStorage.getItem(UNDO_KEY) || '[]') || []; } catch (e) { return []; } }
  function pushUndo(e) { const s = undoStack(); s.push(e); while (s.length > UNDO_MAX) s.shift(); try { localStorage.setItem(UNDO_KEY, JSON.stringify(s)); } catch (x) { /* storage full: no undo, the save still happened */ } }
  function undoLast(placeId) {
    const s = undoStack(); let i = s.length - 1; while (i >= 0 && s[i].placeId !== placeId) i--; if (i < 0) return false;
    const e = s.splice(i, 1)[0];
    const ok = Si().save({ placeId: e.placeId, [e.tab]: e.before, draft: { [e.tab]: !!e.wasDraft } });
    try { localStorage.setItem(UNDO_KEY, JSON.stringify(s)); } catch (x) { /* ignore */ }
    return ok ? e : false;
  }

  // ---------------------------------------------------------------- the form
  const pending = {};          // placeId -> { unitKey, idx } while a form is open
  function formHtml(c, u, only) {
    const Sx = Si(), rec = Sx.get(c.pid) || Sx.empty(c.pid), data = dataOf(rec, u);
    const ctx = { rec, ch: cache || (cache = choices(c)) };
    const items = u.list ? (Array.isArray(data) ? data : []) : [data || {}];
    const blocks = u.list ? items.map((it, i) => [it, i]).filter(([, i]) => only == null || i === only) : [[items[0], 0]];
    const block = (it, i) => `<div class="se-blk" data-block data-orig="${i == null ? '' : i}"><div class="se-bh"><b>${esc(i == null ? 'New ' + u.noun : (u.title ? u.title(it) : u.label))}</b>${u.list ? `<button type="button" class="se-del" data-se-delitem>Delete</button>` : ''}</div><div class="se-fgrid">${u.fields.map(f => fieldHtml(f, gp(it, f.k), ctx)).join('')}</div></div>`;
    const draft = (rec.draft || {})[tabKeyOf(u)];
    return `<div class="se-edit" data-se-form data-unit="${esc(u.key)}" role="form" aria-label="Edit ${esc(u.label)}">
      <div class="se-eh"><span class="se-lbl">Editing</span><span class="se-hi">${esc(u.label)}${only != null && items[only] ? ' · ' + esc(u.title ? u.title(items[only]) : '') : ''}</span></div>
      ${blocks.map(([it, i]) => block(it, i)).join('')}
      ${u.list ? `<button type="button" class="se-add" data-se-additem>+ Add ${esc(u.noun)}</button>` : ''}
      ${draft ? '<p class="se-note">This tab is still a draft. Saving makes it yours: Merge will no longer replace it.</p>' : ''}
      <p class="se-err" role="alert" hidden></p>
      <div class="se-eb"><button type="button" class="se-btn ghost" data-se-cancel>Cancel</button><button type="button" class="se-btn" data-se-save>Save</button></div>
      <template data-newblock>${block(u.list ? u.make() : {}, null)}</template>
      ${datalists(ctx.ch)}
    </div>`;
  }
  const datalists = ch => Object.keys(ch.lists).map(k => `<datalist id="seDl-${k}">${ch.lists[k].map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</datalist>`).join('');

  // ---------------------------------------------------------------- toolbar, pens, swapping a card for its form
  function toolbar(c, cur) {
    const tab = cur.tab, us = UNITS.filter(u => u.tab === tab), n = undoStack().filter(e => e.placeId === c.pid).length;
    const chips = us.map(u => u.list ? `<span class="se-edg"><button type="button" class="se-edc" data-se-open="${esc(u.key)}" title="Edit all ${esc(u.label.toLowerCase())}">${esc(u.label)}</button><button type="button" class="se-edc plus" data-se-new="${esc(u.key)}" aria-label="Add ${esc(u.noun)}">+</button></span>`
      : `<button type="button" class="se-edc" data-se-open="${esc(u.key)}">${esc(u.label)}</button>`).join('');
    const model = tab === 'overview' ? `<button type="button" class="se-edc${Si().hasModel(Si().get(c.pid) || {}) ? ' on' : ''}" data-se-model title="A rotatable founding model on the map (the statue sites have one by default)">Founding model: ${Si().hasModel(Si().get(c.pid) || {}) ? 'on' : 'off'}</button>` : '';
    return `<div class="se-edbar" role="toolbar" aria-label="Edit this tab"><span class="se-lbl">✎ Edit</span>${chips}${model}<span class="se-edsp"></span><button type="button" class="se-edc" data-se-undo${n ? '' : ' disabled'}>↶ Undo${n ? ' (' + n + ')' : ''}</button></div>`;
  }
  function decorate(layer, c, cur) {
    if (!c.author) return;
    const body = layer.querySelector('.se-body'); if (!body) return;
    body.insertAdjacentHTML('afterbegin', toolbar(c, cur));
    layer.querySelectorAll('[data-se-edit]').forEach(el => {
      const p = parsePath(el.getAttribute('data-se-edit')); if (!p) return;
      el.classList.add('se-ed'); el.insertAdjacentHTML('beforeend', `<button type="button" class="se-pen" data-se-open="${esc(el.getAttribute('data-se-edit'))}" aria-label="Edit ${esc(p.unit.label)}">✎</button>`);
    });
    const e = pending[c.pid];
    if (e && e.tab === cur.tab) {
      const p = parsePath(e.path); if (!p) { delete pending[c.pid]; return; }
      const html = formHtml(c, p.unit, e.only != null ? e.only : p.idx);
      const target = e.path && layer.querySelector('[data-se-edit="' + CSS.escape(e.path) + '"]');
      if (target) target.outerHTML = html; else body.querySelector('.se-edbar').insertAdjacentHTML('afterend', html);
      const form = layer.querySelector('[data-se-form]'); if (form) { if (e.addNew) addBlock(form); const f0 = form.querySelector('input,textarea,select'); if (f0) { f0.focus({ preventScroll: true }); form.scrollIntoView({ block: 'nearest' }); } }
    }
  }
  function addBlock(form) { const tpl = form.querySelector('template[data-newblock]'); if (!tpl) return; const add = form.querySelector('[data-se-additem]'); add.insertAdjacentHTML('beforebegin', tpl.innerHTML); const last = form.querySelectorAll('[data-block]'); const b = last[last.length - 1]; const f0 = b && b.querySelector('input,textarea,select'); if (f0) f0.focus(); }
  const refresh = () => { cache = null; const E = En(); if (E) E.render(); };
  const open = (path, extra) => { const E = En(), cur = E && E.current(); if (!cur) return; pending[cur.placeId] = Object.assign({ path, tab: (parsePath(path) || {}).unit ? parsePath(path).unit.tab : cur.tab }, extra || {}); if (pending[cur.placeId].tab !== cur.tab) E.setTab(pending[cur.placeId].tab); else refresh(); };
  const close = () => { const E = En(), cur = E && E.current(); if (cur) delete pending[cur.placeId]; refresh(); };

  // ---------------------------------------------------------------- events (delegated)
  function errorIn(form, msg) { const p = form.querySelector('.se-err'); if (p) { p.textContent = msg; p.hidden = !msg; } }
  function onSave(form) {
    const E = En(), cur = E.current(), c = E.context(cur.placeId), p = parsePath(pending[cur.placeId].path), u = p.unit;
    const blocks = [...form.querySelectorAll('[data-block]')].map(b => ({ orig: b.dataset.orig === '' ? null : parseInt(b.dataset.orig, 10), values: readBlock(b, u.fields), removed: b.classList.contains('gone') }));
    const removed = blocks.filter(b => b.removed && b.orig != null).map(b => b.orig);
    const blank = v => v === '' || v == null || v === false || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.values(v).some(x => !blank(x)));
    for (const b of blocks) {
      if (b.removed) continue;
      if (b.orig == null && Object.values(b.values).every(blank)) { b.skip = true; continue; }          // an added block left empty is just dropped
      if (u.list && u.need && !String(gp(b.values, u.need) || '').trim()) { errorIn(form, 'Fill in “' + (u.fields.find(f => f.k === u.need) || {}).l + '” first.'); return; }
    }
    const live = blocks.filter(b => !b.removed && !b.skip);
    if (!saveUnit(c, u, u.list ? live : blocks, removed)) { errorIn(form, 'Could not save: the browser\'s storage may be full. Export a backup first.'); return; }
    delete pending[cur.placeId]; refresh();
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
      const t = e.target && e.target.closest ? e.target : null; if (!t) return;
      const E = En(); if (!E || !E.current()) return;
      const inEntry = t.closest('#seEntry'); if (!inEntry) return;
      let b;
      if ((b = t.closest('[data-se-open]'))) { e.preventDefault(); open(b.dataset.seOpen); return; }
      if ((b = t.closest('[data-se-new]'))) { open(b.dataset.seNew, { only: -1, addNew: true }); return; }
      if (t.closest('[data-se-model]')) { const c = E.context(E.current().placeId), r = Si().get(c.pid) || {}, on = !Si().hasModel(r); Si().save({ placeId: c.pid, model: on }); refresh(); return; }
      if (t.closest('[data-se-undo]')) { const r = undoLast(E.current().placeId); if (r) refresh(); return; }
      const form = t.closest('[data-se-form]'); if (!form) return;
      if (t.closest('[data-se-cancel]')) { close(); return; }
      if (t.closest('[data-se-save]')) { onSave(form); return; }
      if (t.closest('[data-se-additem]')) { addBlock(form); return; }
      if ((b = t.closest('[data-se-delitem]'))) { const blk = b.closest('[data-block]'); if (blk.dataset.orig === '') { blk.remove(); return; } if (b.dataset.sure) { blk.classList.add('gone'); blk.hidden = true; } else { b.dataset.sure = '1'; b.textContent = 'Really delete? Click again'; b.classList.add('hot'); } return; }
      if ((b = t.closest('[data-se-rowadd]'))) { const box = b.closest('[data-t="rows"]'); b.insertAdjacentHTML('beforebegin', box.dataset.tpl); const f0 = b.previousElementSibling.querySelector('input,textarea,select'); if (f0) f0.focus(); return; }
      if ((b = t.closest('[data-se-rowdel]'))) { b.closest('[data-row]').remove(); return; }
      if ((b = t.closest('[data-se-chipx]'))) { const box = b.closest('[data-t="refs"]'), v = b.closest('[data-cv]').dataset.cv; const arr = JSON.parse(box.dataset.v || '[]').filter(x => x !== v); box.dataset.v = JSON.stringify(arr); b.closest('[data-cv]').remove(); return; }
      if ((b = t.closest('.se-pc'))) { const box = b.closest('[data-f]'); if (box.dataset.t === 'picks') { const arr = JSON.parse(box.dataset.v || '[]'), v = b.dataset.pv, i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); box.dataset.v = JSON.stringify(arr); b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', i < 0); } else { box.dataset.v = box.dataset.v === b.dataset.pv ? '' : b.dataset.pv; box.querySelectorAll('.se-pc').forEach(x => x.classList.toggle('on', x.dataset.pv === box.dataset.v)); } return; }
      if ((b = t.closest('[data-dv]'))) { const box = b.closest('[data-t="dots"]'), n = parseInt(b.dataset.dv, 10), names = JSON.parse(box.dataset.names || '[]'); box.dataset.v = String(n); box.querySelectorAll('.se-dot').forEach((d, i) => d.classList.toggle('on', i < n)); box.querySelector('.se-dn').textContent = n ? (names[n - 1] ? n + ' · ' + names[n - 1] : n) : '—'; }
    });
    // Enter adds to a chip list; Esc and Ctrl+Z
    document.addEventListener('keydown', e => {
      const E = En(); if (!E || !E.current() || !document.getElementById('seEntry')) return;
      const t = e.target;
      if (e.key === 'Enter' && t && t.matches && t.matches('.se-chipsf > input')) { e.preventDefault(); e.stopPropagation(); const v = t.value.trim(); if (v) { const box = t.parentElement, arr = JSON.parse(box.dataset.v || '[]'); if (!arr.includes(v)) { arr.push(v); box.dataset.v = JSON.stringify(arr); t.insertAdjacentHTML('beforebegin', chipX(v)); } t.value = ''; } return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(t && t.closest && t.closest('input,textarea,select'))) { const r = undoLast(E.current().placeId); if (r) { e.preventDefault(); refresh(); } }
    }, true);
    document.addEventListener('change', e => {      // a ref or chip input picked from its list adds immediately
      const t = e.target; if (t && t.matches && t.matches('.se-chipsf > input') && t.value.trim()) { const box = t.parentElement, v = t.value.trim(), arr = JSON.parse(box.dataset.v || '[]'); if (!arr.includes(v)) { arr.push(v); box.dataset.v = JSON.stringify(arr); t.insertAdjacentHTML('beforebegin', chipX(v)); } t.value = ''; }
    });
  }

  global.EpitaphSiteEdit = { _t: { formHtml, readBlock, choices, dataOf }, UNITS, BYKEY, decorate, parsePath, readBlock, readField, undoLast, undoStack, hasPending: id => !!pending[id], cancel: id => { delete pending[id]; }, UNDO_KEY };
})(typeof window !== 'undefined' ? window : globalThis);
