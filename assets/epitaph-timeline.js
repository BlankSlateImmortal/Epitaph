/* Epitaph — Timeline: one ordered history, from before Epitaph to the story's chapters.
 * Shared by the book, the map, the Site Encyclopedia (opse) and the Creature Log (opcl),
 * so every "is this a spoiler at chapter N?" question goes through one function.
 *
 * No lore ships in this file: it is public. The drafted moments live in the author's vault (epitaph-drafts.json) and are merged in
 * through the Dossier's Data > Merge (see docs/plans/publish-readonly.md). Years count from the siege: Year 0 = the siege = the start of
 * Era 1; "Y −495" is 495 years before it. Edits are stored in localStorage under 'epitaph-timeline' as events keyed by id.
 *
 * Event: { id, title, kind, order, when, refs, secret?, revealedAt?, note?, draft? }
 *   when:  { era: 'BEFORE'|'ERA_0'|'ERA_1', year?, approx?, chapter?, text? }
 *   kind:  one of KINDS (7)
 *   order: story order. Sorts events that share an era and have no chapter.
 *   refs:  links in the shared format: 'place:<id>', 'char:<id or name>', 'creature:<id>'
 *   open:  true for something readers know from page 1. Everything else is hidden from readers until a
 *          chapter reveals it (the author's rule, 2026-11-18): a published chapter lists it in its
 *          `moments:` property (chapters/index.json), or the event has `when.chapter` / `revealedAt`.
 *   secret: kept for the author's own notes; it no longer changes what readers see (everything is hidden by default).
 *
 * Author view: the author sees everything, readers only what their chapter has reached. authorMode() is true
 * unless the user switched to the Reader view ('epitaph-author-mode' = '0'); it is per browser, because the data is too.
 * isRevealed() itself always answers for a reader; pages in Author view show hidden things marked as hidden.
 *
 * Reader position (the chapter the reader is on) is stored under 'epitaph-reader-chapter';
 * null means "the latest chapter". Changing it fires 'epitaph-reader-chapter' on window,
 * and other tabs get it through the storage event.
 */
(function (global) {
  'use strict';
  const KEY = 'epitaph-timeline';
  const READER_KEY = 'epitaph-reader-chapter';
  const AUTHOR_KEY = 'epitaph-author-mode';
  const PROFILES_KEY = 'epitaph-character-profiles';
  const VERSION = 1;
  const CH1_YEAR = 55;          // approximate year of Chapter 1 (years count from the siege)
  const CH1_ORDER = 31;         // the `ch-1` moment's place in story order

  const ERAS = [
    { id: 'BEFORE', name: 'Before Epitaph' },
    { id: 'ERA_0', name: 'Era 0' },
    { id: 'ERA_1', name: 'Era 1' }
  ];
  const ERA_RANK = { BEFORE: 0, ERA_0: 1, ERA_1: 2 };

  const KINDS = [
    { id: 'myth', label: 'Myth', rule: 'Before time: the Primordials and the Narrative' },
    { id: 'gods', label: 'Gods', rule: 'What gods and avatars do inside the Book' },
    { id: 'world', label: 'World', rule: 'The planet changes shape: faces, the flood, the barriers' },
    { id: 'place', label: 'Place', rule: 'A place is founded, sealed, changed or erased' },
    { id: 'people', label: 'People', rule: 'A birth, an arrival, a people rising' },
    { id: 'war', label: 'War', rule: 'Conflict: wars, sieges and disasters' },
    { id: 'story', label: 'Story', rule: 'What a chapter shows on the page' }
  ];

  const B = 'BEFORE', E0 = 'ERA_0', E1 = 'ERA_1';

  // No lore ships in this file (it is public). The 37 drafted moments live in the author's vault (epitaph-drafts.json) and come in
  // through the Dossier's Data > Merge; readers get a filtered snapshot. DEFAULTS stays so a default can be added again.
  const DEFAULTS = [];

  // ---- storage: overrides keyed by id, plus removed default ids ----
  const clone = o => JSON.parse(JSON.stringify(o));
  function readStore() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s === 'object') return { version: s.version || VERSION, events: s.events || {}, removed: s.removed || [] };
    } catch (e) {}
    return { version: VERSION, events: {}, removed: [] };
  }
  function writeStore(s) {
    try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, s, { version: VERSION }))); return true; } catch (e) { return false; }
  }
  function normalise(e) {
    const out = Object.assign({ id: 'ev_' + Math.random().toString(36).slice(2, 9), title: '', kind: 'story', order: 999, refs: [] }, e || {});
    out.when = Object.assign({ era: E1 }, out.when || {});
    if (!ERA_RANK.hasOwnProperty(out.when.era)) out.when.era = E1;
    if (!KINDS.some(k => k.id === out.kind)) out.kind = 'story';
    if (!Array.isArray(out.refs)) out.refs = [];
    return out;
  }

  let chapterMoments = {};   // moment id → chapter, from chapters/index.json (applyChapterIndex)

  /** Every event: defaults with the user's edits on top, user-added ones, chapters applied, sorted. */
  function load() {
    const s = readStore();
    const out = DEFAULTS.filter(d => !s.removed.includes(d.id)).map(d => {
      const o = s.events[d.id];
      return normalise(o ? Object.assign(clone(d), o, { when: Object.assign({}, d.when, o.when || {}) }) : clone(d));
    });
    Object.keys(s.events).forEach(id => { if (!DEFAULTS.some(d => d.id === id)) out.push(normalise(Object.assign({ id }, s.events[id]))); });
    out.forEach(e => { if (e.when.chapter == null && chapterMoments[e.id] != null) e.when.chapter = chapterMoments[e.id]; });
    return out.sort(compare);
  }
  /** Save one event (new or edited). Only the fields given are stored as the override. */
  function save(e) {
    const s = readStore();
    const cur = s.events[e.id] || {};
    s.events[e.id] = Object.assign({}, cur, clone(e), e.when ? { when: Object.assign({}, cur.when || {}, clone(e.when)) } : {});   // a partial `when` merges, it doesn't replace
    s.removed = s.removed.filter(id => id !== e.id);
    return writeStore(s);
  }
  function remove(id) {
    const s = readStore();
    delete s.events[id];
    if (DEFAULTS.some(d => d.id === id) && !s.removed.includes(id)) s.removed.push(id);
    return writeStore(s);
  }
  /** Back a default up to how it ships (drops the user's edits and un-removes it). */
  function reset(id) {
    const s = readStore();
    delete s.events[id];
    s.removed = s.removed.filter(r => r !== id);
    return writeStore(s);
  }
  // ---- backup: the Dossier's Export / Import / Merge carry the user's edits under `timeline` ----
  /** The user's stored edits and removals, or null when there are none. */
  function exportData() { const s = readStore(); return Object.keys(s.events).length || s.removed.length ? clone(s) : null; }
  const validData = o => !!o && typeof o === 'object' && !!o.events && typeof o.events === 'object' && !Array.isArray(o.events);
  /** Replace the stored edits with a backup's. False when the data isn't ours or can't be saved. */
  function importData(o) { return validData(o) ? writeStore({ version: VERSION, events: clone(o.events), removed: Array.isArray(o.removed) ? o.removed.slice() : [] }) : false; }
  /** Event ids in a backup that this browser has no edit for (what a merge would add). */
  function newInData(o) { if (!validData(o)) return []; const have = readStore().events; return Object.keys(o.events).filter(id => !(id in have)); }
  /** Merge: add the edits this browser lacks; never touches an existing edit or removal. Returns how many. */
  function mergeData(o) {
    const add = newInData(o); if (!add.length) return 0;
    const s = readStore(); add.forEach(id => { s.events[id] = clone(o.events[id]); });
    return writeStore(s) ? add.length : 0;
  }
  function byId(id, list) { return (list || load()).find(e => e.id === id) || null; }

  // ---- what each published chapter reveals (chapters/index.json, written by tools/sync-chapters.py) ----
  // A chapter's properties list what it shows the reader for the first time: moments (timeline ids), characters, world
  // (places, written "Place = state") and reveals (items, marks and the like, by name). The first chapter that lists a thing reveals it.
  let chapterLists = { world: {}, character: {}, reveal: {} }, anyCharacterLists = false, indexPromise = null;
  let chapterSkillList = [];   // [{ skill, chapter, status }]: the skills each chapter names in its `skills:` property
  const norm = s => String(s == null ? '' : s).trim().toLowerCase().replace(/^the\s+/, '').replace(/\s+/g, ' ');
  /** chapters/index.json entries ({ chapter, moments, characters, world, reveals }) date what they contain. */
  function applyChapterIndex(index) {
    chapterMoments = {}; chapterLists = { world: {}, character: {}, reveal: {} }; anyCharacterLists = false; chapterSkillList = [];
    const first = (map, key, n) => { const k = norm(key); if (k && (map[k] == null || n < map[k])) map[k] = n; };
    (Array.isArray(index) ? index : []).forEach(c => {
      const n = Number(c && c.chapter);
      if (!Number.isInteger(n)) return;
      (c.moments || []).forEach(m => { if (chapterMoments[m] == null || n < chapterMoments[m]) chapterMoments[m] = n; });
      (c.world || []).forEach(w => first(chapterLists.world, String(w).split('=')[0], n));
      (c.characters || []).forEach(x => { first(chapterLists.character, x, n); anyCharacterLists = true; });
      (c.reveals || []).forEach(x => first(chapterLists.reveal, x, n));
      (c.skills || []).forEach(x => { if (String(x || '').trim()) chapterSkillList.push({ skill: String(x).trim(), chapter: n, status: String(c.status || 'canon').toLowerCase() }); });
    });
  }
  /** The first published chapter whose `world` / `character` / `reveal` list names any of `keys` (names or ids), or null. */
  function firstChapter(kind, keys) {
    const map = chapterLists[kind] || {};
    let best = null;
    (Array.isArray(keys) ? keys : [keys]).forEach(k => { const n = map[norm(k)]; if (n != null && (best == null || n < best)) best = n; });
    return best;
  }
  const hasCharacterLists = () => anyCharacterLists;
  /** The skills named by each chapter's `skills:` property (from chapters/index.json): [{ skill, chapter, status: 'canon'|'draft' }]. */
  const chapterSkills = () => chapterSkillList.slice();
  /** Fetch chapters/index.json once, apply it, and tell every view (the reader-change event). Safe to call often. */
  function loadChapterIndex() {
    if (indexPromise) return indexPromise;
    if (typeof global.fetch !== 'function') return Promise.resolve(false);
    indexPromise = global.fetch('chapters/index.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(idx => {
      if (!Array.isArray(idx)) return false;
      applyChapterIndex(idx);
      if (typeof global.dispatchEvent === 'function' && typeof CustomEvent === 'function') global.dispatchEvent(new CustomEvent(READER_KEY, { detail: { chapter: readerChapter() } }));
      return true;
    }).catch(() => false);
    return indexPromise;
  }

  // ---- order ----
  // Sort key: era, then phase (0 before the story · 1 has a chapter · 2 in the story, chapter not set yet),
  // then the chapter (phase 1) or story order. One key per event keeps sorting consistent.
  function phase(e) {
    const w = e.when || {};
    if (w.chapter != null) return 1;
    if (w.era === E1 && (e.order || 0) > CH1_ORDER) return 2;
    return 0;
  }
  function sortKey(e) {
    const w = e.when || {}, p = phase(e);
    return [ERA_RANK[w.era] ?? 2, p, p === 1 ? w.chapter : (e.order || 0), e.order || 0];
  }
  function compare(a, b) {
    const ka = sortKey(a), kb = sortKey(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    return 0;
  }

  // ---- chapters and the reader's position ----
  function chapters() {
    try {
      const st = JSON.parse(localStorage.getItem(PROFILES_KEY) || 'null');
      const set = new Set(((st && st.chapters) || []).map(c => c.number).filter(Number.isInteger));
      ((st && st.characters) || []).forEach(c => (c.snapshots || []).forEach(s => Number.isInteger(s.startChapter) && set.add(s.startChapter)));
      return [...set].sort((a, b) => a - b);
    } catch (e) { return []; }
  }
  let latestOverride = null;
  /** For the published snapshot: pretend the story goes on past chapter `n`, so "the latest chapter" never reveals secrets early
   *  (the rule that shows an author's secrets at the latest chapter must not apply to what is published). Pass null to clear. */
  function setLatestOverride(n) { latestOverride = Number.isInteger(n) ? n : null; }
  function latestChapter() { if (latestOverride != null) return latestOverride; const c = chapters(); return c.length ? c[c.length - 1] : null; }
  /** The chapter the reader is on; null = the latest. */
  function readerChapter() {
    try { const v = localStorage.getItem(READER_KEY); const n = v == null ? NaN : parseInt(v, 10); return Number.isInteger(n) ? n : null; }
    catch (e) { return null; }
  }
  function setReaderChapter(n) {
    const v = Number.isInteger(n) ? n : null;
    try { v == null ? localStorage.removeItem(READER_KEY) : localStorage.setItem(READER_KEY, String(v)); } catch (e) {}
    if (typeof global.dispatchEvent === 'function' && typeof CustomEvent === 'function') global.dispatchEvent(new CustomEvent(READER_KEY, { detail: { chapter: v } }));
    return v;
  }
  /** Author view (everything visible, hidden things marked) or Reader view (a reader's chapter gates it).
   *  Decided by EpitaphMode (assets/epitaph-mode.js): readers by default, the author's browser opts in. Without that module the old
   *  rule applies: author view unless switched off. */
  function authorMode() {
    if (global.EpitaphMode) return global.EpitaphMode.authorView();
    try { return localStorage.getItem(AUTHOR_KEY) !== '0'; } catch (e) { return true; }
  }
  function setAuthorMode(on) {
    if (global.EpitaphMode) return global.EpitaphMode.setAuthorView(!!on);   // it announces the change itself
    try { localStorage.setItem(AUTHOR_KEY, on ? '1' : '0'); } catch (e) {}
    if (typeof global.dispatchEvent === 'function' && typeof CustomEvent === 'function') global.dispatchEvent(new CustomEvent(READER_KEY, { detail: { chapter: readerChapter() } }));
    return !!on;
  }
  /** Call fn(chapter) whenever the reader's position or the view (author/reader) changes, here or in another tab. Returns an unsubscribe. */
  function onReaderChange(fn) {
    if (typeof global.addEventListener !== 'function') return () => {};
    const local = e => fn(e.detail ? e.detail.chapter : readerChapter());
    const other = e => { if (e.key === READER_KEY || e.key === AUTHOR_KEY || e.key === 'epitaph-author') fn(readerChapter()); };
    const mode = () => fn(readerChapter());                                   // EpitaphMode announced a change
    global.addEventListener(READER_KEY, local); global.addEventListener('storage', other); global.addEventListener('epitaph-mode', mode);
    return () => { global.removeEventListener(READER_KEY, local); global.removeEventListener('storage', other); global.removeEventListener('epitaph-mode', mode); };
  }

  /** The chapter that reveals an event to readers: 0 for `open`, else `revealedAt`, else the chapter it happens in
   *  (set by hand or by a chapter's `moments:` list). null = no chapter reveals it yet, so readers don't see it. */
  function revealChapter(e) {
    // an event (it has a when, an id, open or revealedAt) or a bare `when` like { chapter: 2 }
    const item = e && (e.when || e.id || e.open != null || e.revealedAt != null) ? e : { when: e || {} };
    if (item.open) return 0;
    if (item.revealedAt != null) return item.revealedAt;
    if (item.when && item.when.chapter != null) return item.when.chapter;
    return null;
  }
  /** Is this event (or a bare `when`) visible to a reader on `chapter`? Leave `chapter` out to use the reader's saved
   *  position; pass null for "the latest chapter". The author's rule: a reader sees it only once they have read the chapter
   *  that reveals it. Nothing is revealed by default, and being on the latest chapter reveals nothing extra. */
  function isRevealed(e, chapter) {
    const rc = revealChapter(e);
    if (rc === 0) return true;
    if (rc == null) return false;
    const r = chapter === undefined ? readerChapter() : chapter;
    const at = r == null ? latestChapter() : r;
    return at != null && at >= rc;
  }

  // ---- labels ----
  function year(y, approx) {
    const s = Math.abs(y).toLocaleString('en-US');
    return (approx ? '≈ ' : '') + 'Y ' + (y < 0 ? '−' + s : s);
  }
  function label(when) {
    const w = (when && when.when) || when || {};
    if (w.chapter != null) return 'Ch ' + w.chapter;
    if (w.year != null) return year(w.year, w.approx);
    if (w.text) return w.text;
    return (ERAS.find(x => x.id === w.era) || ERAS[2]).name;
  }
  /** A visible event as is, or a stand-in that shows "?" in place of what the reader hasn't reached. */
  function view(e, chapter) {
    return isRevealed(e, chapter) ? e : { id: e.id, hidden: true, title: '?', kind: e.kind, when: e.when, order: e.order, refs: [] };
  }

  global.EpitaphTimeline = {
    KEY, READER_KEY, AUTHOR_KEY, VERSION, CH1_YEAR, ERAS, KINDS, DEFAULTS,
    load, save, remove, reset, exportData, importData, newInData, mergeData, byId, applyChapterIndex, firstChapter, hasCharacterLists, chapterSkills, loadChapterIndex, revealChapter,
    compare, chapters, latestChapter, setLatestOverride, readerChapter, setReaderChapter, authorMode, setAuthorMode, onReaderChange,
    isRevealed, label, view
  };
})(typeof window !== 'undefined' ? window : globalThis);
