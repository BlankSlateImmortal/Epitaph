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
 * Shape (version 1):
 *   countries: [{ id, name, lat, lon, note }]
 *   places:    [{ id, name, countryId, kind, lat, lon, note, era? }]
 *   items:     [{ id, name, desc, originPlaceId, marks: [Mark], note, icon, image }]
 *   Mark = { id, kind: 'blessing'|'curse'|'binding', name, source, effect, cost, ends }
 *
 * Built-in geography stays read-only in assets/epitaph-world.js; this file
 * registers the Library's countries and places with EpitaphWorld so both
 * pages see one combined list.
 */
(function (global) {
  'use strict';
  const KEY = 'epitaph-library';
  const MARK_KINDS = ['blessing', 'curse', 'binding'];
  const num = v => typeof v === 'number' && isFinite(v);
  const str = v => (typeof v === 'string' ? v : '');
  function newId(prefix) { return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  function normalizeMark(m) {
    m = m || {};
    return { id: m.id || newId('mark'), kind: MARK_KINDS.includes(m.kind) ? m.kind : 'blessing',
      name: str(m.name), source: str(m.source), effect: str(m.effect), cost: str(m.cost), ends: str(m.ends) };
  }
  function normalize(raw) {
    const d = raw && typeof raw === 'object' ? raw : {};
    return {
      version: 1,
      countries: (Array.isArray(d.countries) ? d.countries : []).filter(c => c && c.id).map(c => ({
        id: c.id, name: str(c.name), lat: num(c.lat) ? c.lat : null, lon: num(c.lon) ? c.lon : null, note: str(c.note) })),
      places: (Array.isArray(d.places) ? d.places : []).filter(p => p && p.id).map(p => ({
        id: p.id, name: str(p.name), countryId: str(p.countryId), kind: str(p.kind) || 'other',
        lat: num(p.lat) ? p.lat : null, lon: num(p.lon) ? p.lon : null, note: str(p.note), ...(p.era ? { era: p.era } : {}) })),
      items: (Array.isArray(d.items) ? d.items : []).filter(i => i && i.id).map(i => ({
        id: i.id, name: str(i.name), desc: str(i.desc), originPlaceId: str(i.originPlaceId),
        marks: (Array.isArray(i.marks) ? i.marks : []).map(normalizeMark), note: str(i.note),
        icon: str(i.icon), image: str(i.image) }))
    };
  }
  let cache = null, cacheRaw = null;
  function read() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (cache && raw === cacheRaw) return cache;
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
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

  global.EpitaphLibrary = {
    KEY, newId, normalizeMark, get, update, item, place: placeById,
    replace(data) { return save(data); },
    onChange(fn) { listeners.push(fn); }
  };
  if (global.EpitaphWorld) {
    global.EpitaphWorld.setExtras(() => { const l = get(); return { countries: l.countries, places: l.places }; });
  }
})(typeof window !== 'undefined' ? window : globalThis);
