/* Epitaph — Reader data: in a reader's browser, the site's data comes from the published snapshot, not from browser storage
 * (docs/plans/publish-readonly.md, step 2.3). Loaded in the <head> of every page, after assets/epitaph-mode.js and
 * published/epitaph-data.js, before anything reads a stored value.
 *
 * Every page already reads and writes its data through a few localStorage keys. In a reader's browser this file puts a thin layer
 * over `localStorage`:
 *   - the data keys (Dossier, Library, site encyclopedia, timeline, muses) answer from the snapshot;
 *   - writes to them are kept in memory for the page only and never saved, so nothing a visitor does survives a reload;
 *   - the author's private records (save history, chapter-marker log, thrown-sword poses, migration backups) read as empty and are not saved;
 *   - everything else (the reader's own chapter, view preferences) passes through to the real storage.
 * The author's browser (EpitaphMode.isAuthor()) is left alone. If there is no snapshot, readers get the empty "coming soon" data.
 * The mode is decided when the page loads: to switch, reload.
 */
(function (global) {
  'use strict';
  const Mode = global.EpitaphMode;
  if (!Mode || Mode.isAuthor()) return;

  let real = null;
  try { real = global.localStorage; } catch (e) { real = null; }
  const snap = global.EPITAPH_PUBLISHED && typeof global.EPITAPH_PUBLISHED === 'object' ? global.EPITAPH_PUBLISHED : {};
  const dossier = snap.dossier || {}, lib = snap.library || {};
  const list = x => Array.isArray(x) ? x : [];

  const byKey = (arr, key, drop) => { const out = {}; list(arr).forEach(r => { if (!r || r[key] == null) return; const c = Object.assign({}, r); if (drop) delete c[key]; out[r[key]] = c; }); return out; };
  // the snapshot's arrays, put back into the shapes the modules store
  const DATA = {
    'epitaph-character-profiles': () => JSON.stringify({ schemaVersion: dossier.schemaVersion, characters: list(dossier.characters), chapters: list(dossier.chapters), activeId: null }),
    'epitaph-library': () => JSON.stringify({ version: lib.version || 1, countries: list(lib.countries), places: list(lib.places), items: list(lib.items) }),
    'epitaph-sites': () => JSON.stringify({ version: 1, places: byKey(snap.sites, 'placeId', true) }),
    'epitaph-timeline': () => JSON.stringify({ version: 1, events: byKey(snap.timeline, 'id', false), removed: [] }),
    'epitaph-muses': () => '[]'                      // the Muses page is the author's; readers get no list
  };
  const PRIVATE = /^(epitaph-history|epitaph-marker-log|epitaph-map-pin-poses|epitaph-character-profiles-backup)/;
  const mem = {}, cached = {};

  const shim = {
    getItem(k) {
      k = String(k);
      if (Object.prototype.hasOwnProperty.call(mem, k)) return mem[k];
      if (DATA[k]) return cached[k] !== undefined ? cached[k] : (cached[k] = DATA[k]());
      if (PRIVATE.test(k)) return null;
      return real ? real.getItem(k) : null;
    },
    setItem(k, v) {
      k = String(k);
      if (DATA[k] || PRIVATE.test(k)) { mem[k] = String(v); return; }   // this page only; never saved
      if (real) real.setItem(k, v);
    },
    removeItem(k) {
      k = String(k);
      if (DATA[k] || PRIVATE.test(k)) { mem[k] = null; return; }
      if (real) real.removeItem(k);
    },
    key: i => (real ? real.key(i) : null),
    clear() { Object.keys(mem).forEach(k => delete mem[k]); },
    get length() { return real ? real.length : 0; }
  };
  try {
    Object.defineProperty(global, 'localStorage', { configurable: true, get: () => shim });
  } catch (e) { /* storage layer could not be replaced: the page falls back to the reader's own (empty) storage */ }
  // Story places stay off the map until a chapter has revealed them (the author's rule). Real cities and the author's own places are public.
  // world.js asks this for every place; the records come from the snapshot, where only reached places have one.
  let siteRecs = null;
  global.EpitaphWorldGate = p => {
    if (!p || !(p.fictional || p.group)) return true;
    const S = global.EpitaphSites; if (!S) return false;
    if (!siteRecs) { try { siteRecs = new Map(S.load().map(r => [r.placeId, r])); } catch (e) { return false; } }
    const rec = siteRecs.get(p.id);
    return !!rec && S.placeReached(rec);
  };
  global.EpitaphReaderData = { snapshot: snap, publishedThrough: snap.publishedThrough == null ? null : snap.publishedThrough };
})(typeof window !== 'undefined' ? window : globalThis);
