/* Epitaph — the Library (moved from the old 2D Atlas): add, edit and delete your own countries, places and items
 * (assets/epitaph-library.js is the store). Built-in places stay read-only. Every change reads the latest stored copy and
 * saves at once; other tabs (the Dossier) pick changes up through the storage event. Deleting something that is referenced
 * is blocked until it is reassigned or the delete is confirmed.
 *
 *   EpitaphLibraryUI.open(tab?, view?)      tab 'places' | 'items'; view e.g. { mode: 'itemDetail', id }
 *   EpitaphLibraryUI.close()
 *   EpitaphLibraryUI.hooks.onChange = fn     after a save (the map redraws)
 *   EpitaphLibraryUI.hooks.showPlace = fn    "Show on map" for a place id
 * Needs: assets/epitaph-world.js and assets/epitaph-library.js loaded first. */
(function () {
const World = window.EpitaphWorld;
const hooks = { onChange: () => {}, showPlace: () => {} };
// ---- styles and the drawer
const style = document.createElement('style');
style.textContent = `
  .lib-drawer{ position:fixed; inset:0; z-index:60; pointer-events:none; }
  .lib-drawer.open{ pointer-events:auto; background:rgba(0,0,0,.45); }
  .lib-sheet{ position:absolute; top:0; right:0; bottom:0; width:min(440px, 100%); background:#0a0703; border-left:1px solid var(--amber-dim, #8a5a14);
    transform:translateX(100%); transition:transform .25s ease; display:flex; flex-direction:column; font-family:'Space Mono', monospace; color:var(--bone); }
  .lib-drawer.open .lib-sheet{ transform:none; }
  .lib-head{ display:flex; align-items:center; gap:10px; padding:12px 14px; border-bottom:1px solid var(--amber-dim, #8a5a14); }
  .lib-title{ font-family:var(--f-crt, monospace); font-size:20px; letter-spacing:.12em; color:var(--amber, #ffb238); }
  .lib-tabs{ display:flex; gap:6px; flex:1; }
  .lib-tabs button, .lib-btn, .lib-close, .lib-back, .lib-link{ font:inherit; font-size:12px; letter-spacing:.06em; background:transparent; color:var(--amber, #ffb238); border:1px solid var(--amber-dim, #8a5a14); padding:8px 12px; min-height:40px; cursor:pointer; text-transform:uppercase; }
  .lib-tabs button.on{ background:var(--amber, #ffb238); color:var(--ink); }
  .lib-close{ font-size:20px; min-width:44px; }
  .lib-btn.primary{ background:var(--amber, #ffb238); color:var(--ink); }
  .lib-btn.danger{ color:var(--ember); border-color:var(--ember); }
  .lib-back, .lib-link{ border:0; padding:4px 0; min-height:32px; text-decoration:underline; text-transform:none; }
  .lib-body{ overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:12px; flex:1; }
  .lib-sec{ font-family:var(--f-crt, monospace); color:var(--amber-dim, #8a5a14); letter-spacing:.16em; font-size:15px; margin-top:6px; }
  .lib-row{ display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--line); padding:8px 0; flex-wrap:wrap; }
  .lib-row-main{ flex:1 1 160px; min-width:0; display:flex; flex-direction:column; gap:2px; }
  .lib-row-main b{ font-weight:400; font-size:14px; }
  .lib-row-main small{ font-size:11px; color:var(--dust); }
  .lib-row-btns{ display:flex; gap:6px; flex-wrap:wrap; }
  .lib-thumb{ width:36px; height:36px; object-fit:cover; border:1px solid var(--line); display:inline-flex; align-items:center; justify-content:center; color:var(--amber, #ffb238); }
  .lib-actions{ display:flex; gap:8px; flex-wrap:wrap; }
  .lib-empty{ font-size:12px; color:var(--dust); margin:0; }
  .lib-field{ display:flex; flex-direction:column; gap:6px; font-size:11px; letter-spacing:.08em; color:var(--dust); text-transform:uppercase; }
  .lib-field input, .lib-field select, .lib-field textarea{ font:inherit; font-size:14px; text-transform:none; letter-spacing:0; background:var(--ink); color:var(--bone); border:1px solid var(--line); padding:8px 10px; min-height:44px; width:100%; }
  .lib-field textarea{ min-height:64px; resize:vertical; }
  .lib-coords{ display:flex; gap:8px; }
  .lib-coords label{ flex:1; display:flex; flex-direction:column; gap:4px; }
  .lib-msg{ color:var(--ember); font-size:12px; margin:0; min-height:1em; }
  .lib-check{ display:flex; gap:8px; align-items:center; font-size:12px; color:var(--dust); min-height:44px; }
  .lib-check input{ width:20px; height:20px; }
  .lib-warn{ border:1px solid var(--ember); padding:10px; font-size:12px; }
  .lib-warn ul{ margin:6px 0 0; padding-left:18px; }
  .lib-pics{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .lib-pic{ width:64px; height:64px; border:1px dashed var(--line); display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden; font-size:10px; }
  .lib-pic.large{ width:96px; height:96px; }
  .lib-pic img{ width:100%; height:100%; object-fit:cover; }
  .visually-hidden{ position:absolute; width:1px; height:1px; opacity:0; overflow:hidden; }
  .lib-item-head{ display:flex; gap:12px; align-items:flex-start; }
  .lib-item-head img{ flex:0 0 96px; width:96px; height:96px; object-fit:cover; border:1px solid var(--line); }
  .lib-item-head h3{ margin:0; font-family:'Bebas Neue', sans-serif; font-weight:400; font-size:26px; letter-spacing:.04em; }
  .lib-origin, .lib-desc{ margin:0; font-size:13px; }
  .lib-desc.dim{ color:var(--dust); }
  .lib-history{ list-style:none; margin:0; padding:0; font-size:13px; }
  .lib-history li{ display:flex; gap:10px; border-bottom:1px solid var(--line); padding:6px 0; }
  .lib-history li > span:first-child{ color:var(--amber, #ffb238); min-width:60px; }
  .mini-map{ width:100%; height:auto; display:block; border:1px solid var(--amber-dim, #8a5a14); cursor:crosshair; touch-action:manipulation; }
  .mini-map .mm-bg{ fill:#070502; }
  .mini-map .mm-grid line{ stroke:var(--line); stroke-width:.5; }
  .mini-map .mm-dots circle{ fill:var(--amber-dim, #8a5a14); }
  .mini-map .mm-dots text{ fill:var(--dust); font-size:6px; font-family:'Space Mono', monospace; }
  .mini-map .mm-pin circle{ fill:none; stroke:var(--amber, #ffb238); stroke-width:1.4; }
  .mini-map .mm-pin path{ stroke:var(--amber, #ffb238); stroke-width:1; }
  .mm-hint{ margin:4px 0 0; font-size:11px; text-transform:none; letter-spacing:0; color:var(--dust); }
`;
document.head.appendChild(style);
document.body.insertAdjacentHTML('beforeend', `
<div class="lib-drawer" id="libDrawer" aria-hidden="true">
  <div class="lib-sheet" role="dialog" aria-label="Library">
    <div class="lib-head">
      <span class="lib-title">LIBRARY</span>
      <div class="lib-tabs" role="tablist"><button type="button" role="tab" data-libtab="places" class="on">Places</button><button type="button" role="tab" data-libtab="items">Items</button></div>
      <button type="button" class="lib-close" id="libClose" aria-label="Close the Library">×</button>
    </div>
    <div class="lib-body" id="libBody"></div>
  </div>
</div>
`);
// ---- small helpers (the same as the old Atlas)
const hasNum = v => typeof v === 'number' && isFinite(v);
const geoPlace = id => World.place(id);
const geoCountry = id => World.country(id);
const mappedPlaces = () => World.places().filter(p => hasNum(p.lat) && hasNum(p.lng));
function boundsOf(points, padDeg, minSpan){
  if(!points.length) return null;
  let b = { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity };
  points.forEach(p => { b.minLat = Math.min(b.minLat, p.lat); b.maxLat = Math.max(b.maxLat, p.lat); b.minLng = Math.min(b.minLng, p.lng); b.maxLng = Math.max(b.maxLng, p.lng); });
  b = { minLat: b.minLat - padDeg, maxLat: b.maxLat + padDeg, minLng: b.minLng - padDeg, maxLng: b.maxLng + padDeg };
  const growLat = Math.max(0, minSpan - (b.maxLat - b.minLat)) / 2, growLng = Math.max(0, minSpan - (b.maxLng - b.minLng)) / 2;
  return { minLat: b.minLat - growLat, maxLat: b.maxLat + growLat, minLng: b.minLng - growLng, maxLng: b.maxLng + growLng };
}
function niceStep(span){ const raw = span / 5, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p; return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p; }
function escapeHud(str){ const d = document.createElement('div'); d.textContent = str == null ? '' : str; return d.innerHTML; }
const DOSSIER_STORAGE_KEY = 'epitaph-character-profiles';
let dossierState = { characters: [], activeId: null };
function loadDossierState(){
  try{
    const raw = localStorage.getItem(DOSSIER_STORAGE_KEY);
    dossierState = raw ? JSON.parse(raw) : { characters: [], activeId: null };
    if(!Array.isArray(dossierState.characters)) dossierState.characters = [];
  }catch(e){ console.error('Could not read Dossier data', e); }
}
loadDossierState();
// the old Atlas's side panels don't exist here
const selectedLoc = null;
const renderView = () => hooks.onChange();
const renderLocationRecord = () => {};
const backToIndex = () => {};
const selectPlace = id => hooks.showPlace(id);

// ============================================================
// LIBRARY — user-added countries, places and items (assets/epitaph-library.js).
// Built-in places stay read-only. Every change reads the latest stored copy
// and saves at once (Library.update); the Dossier picks changes up through
// the storage event. Deleting something that is referenced is blocked until
// it is reassigned or the delete is confirmed.
// ============================================================
const Lib = window.EpitaphLibrary;
let libTab = 'places';
let libView = { mode: 'list' };   // list | place | country | item | itemDetail | delete
let libReturn = null;             // where the country form goes back to

const libBody = () => document.getElementById('libBody');
function openLibrary(tab, view){
  if (window.EpitaphMode && !EpitaphMode.canEdit()) return;    // the drawer is an editor: readers (and the author's preview) never open it
  if(tab) libTab = tab;
  libView = view || { mode: 'list' };
  const d = document.getElementById('libDrawer');
  d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
  renderLibrary();
}
function closeLibrary(){
  const d = document.getElementById('libDrawer');
  d.classList.remove('open'); d.setAttribute('aria-hidden', 'true');
}
document.getElementById('libClose').addEventListener('click', closeLibrary);
document.querySelectorAll('[data-libtab]').forEach(b => b.addEventListener('click', () => { libTab = b.dataset.libtab; libView = { mode: 'list' }; renderLibrary(); }));

function libSaved(result, what){
  if(!result){ libMessage('Could not save — browser storage may be full.'); return false; }
  renderView();
  if(selectedLoc) renderLocationRecord();
  return true;
}
function libMessage(text){ const el = document.getElementById('libMsg'); if(el) el.textContent = text; }
const placeName = id => { const p = geoPlace(id); return p ? p.name : ''; };
const countryOptions = (selected) => World.continents().map(cont => {
  const list = World.countries().filter(c => c.continentId === cont.id);
  return list.length ? `<optgroup label="${escapeHud(cont.name)}">${list.map(c => `<option value="${escapeHud(c.id)}"${c.id === selected ? ' selected' : ''}>${escapeHud(c.name)}${c.builtIn ? '' : ' (yours)'}</option>`).join('')}</optgroup>` : '';
}).join('');
const placeOptions = (selected) => World.countries().map(co => {
  const list = World.placesIn(co.id).slice().sort((a, b) => a.name.localeCompare(b.name));
  return list.length ? `<optgroup label="${escapeHud(co.name)}">${list.map(p => `<option value="${escapeHud(p.id)}"${p.id === selected ? ' selected' : ''}>${escapeHud(p.name)}</option>`).join('')}</optgroup>` : '';
}).join('');

// ---- references (for delete checks and history) ----
function freshDossier(){ loadDossierState(); return dossierState; }
function snapRefPlaceId(loc){ return loc ? (loc.placeId || loc.specialSiteId || loc.cityId || null) : null; }
function findRefs(kind, id){
  const st = freshDossier(), lib = Lib.get(), refs = [];
  if(kind === 'place'){
    st.characters.forEach(c => (c.snapshots || []).forEach(s => { if(snapRefPlaceId(s.location) === id) refs.push(`${c.name || 'Unnamed'} is here in ${s.chapterRange || 'a chapter'}`); }));
    lib.items.filter(i => i.origin === id).forEach(i => refs.push(`Item “${i.name}” came from here`));
  } else if(kind === 'country'){
    lib.places.filter(p => p.countryId === id).forEach(p => refs.push(`Place “${p.name}” is in this country`));
    st.characters.forEach(c => (c.snapshots || []).forEach(s => { if(s.location && s.location.countryId === id && !snapRefPlaceId(s.location)) refs.push(`${c.name || 'Unnamed'} is here in ${s.chapterRange || 'a chapter'}`); }));
  } else if(kind === 'item'){
    st.characters.forEach(c => (c.snapshots || []).forEach(s => { if((s.inventory || []).some(e => e.itemId === id)) refs.push(`${c.name || 'Unnamed'} carries it in ${s.chapterRange || 'a chapter'}`); }));
  }
  return refs;
}
// Writes the Dossier's store directly: read the latest copy, change, save at once.
function updateDossierStore(fn){
  try{
    const raw = localStorage.getItem(DOSSIER_STORAGE_KEY);
    if(!raw) return true;
    const st = JSON.parse(raw);
    fn(st);
    localStorage.setItem(DOSSIER_STORAGE_KEY, JSON.stringify(st));
    loadDossierState();
    return true;
  }catch(e){ console.error(e); return false; }
}
function reassign(kind, fromId, toId){
  if(kind === 'place'){
    const to = geoPlace(toId);
    updateDossierStore(st => st.characters.forEach(c => (c.snapshots || []).forEach(s => {
      if(snapRefPlaceId(s.location) === fromId) s.location = { countryId: to.countryId, placeId: to.id };
    })));
    return Lib.update(lib => lib.items.forEach(i => { if(i.origin === fromId) i.origin = toId; }));
  }
  if(kind === 'country'){
    updateDossierStore(st => st.characters.forEach(c => (c.snapshots || []).forEach(s => {
      if(s.location && s.location.countryId === fromId) s.location = { ...s.location, countryId: toId };
    })));
    return Lib.update(lib => lib.places.forEach(p => { if(p.countryId === fromId) p.countryId = toId; }));
  }
  updateDossierStore(st => st.characters.forEach(c => (c.snapshots || []).forEach(s => (s.inventory || []).forEach(e => { if(e.itemId === fromId) e.itemId = toId; }))));
  return true;
}
function deleteNow(kind, id){
  return Lib.update(lib => {
    if(kind === 'place') lib.places = lib.places.filter(p => p.id !== id);
    else if(kind === 'country') lib.countries = lib.countries.filter(c => c.id !== id);
    else lib.items = lib.items.filter(i => i.id !== id);
  });
}
// History: who held an item in each chapter, in chapter order.
// Each row also carries the item's states in that chapter (stateIds).
function itemHistory(itemId){ return Lib.uses(itemId, freshDossier().characters); }

// ---- small map: tap to drop a pin ----
// Equirectangular, fitted to the chosen country (or the whole world).
function miniMap(host, opts){
  const W = 300, H = 180;
  let pin = (hasNum(opts.lat) && hasNum(opts.lon)) ? { lat: opts.lat, lng: opts.lon } : null;
  let countryId = opts.countryId || null;
  function bounds(){
    const pts = countryId ? mappedPlaces().filter(p => p.countryId === countryId) : [];
    const c = countryId ? World.countryCentroid(countryId) : null;
    const all = pts.concat(c ? [c] : []).concat(pin ? [pin] : []);
    if(countryId && all.length) return boundsOf(all, 2, 8);
    return { minLat: -60, maxLat: 80, minLng: -180, maxLng: 180 };
  }
  function draw(){
    const b = bounds(), midLat = (b.minLat + b.maxLat) / 2;
    const k = Math.max(0.3, Math.cos(midLat * Math.PI / 180));
    const sx = W / ((b.maxLng - b.minLng) * k), sy = H / (b.maxLat - b.minLat), s = Math.min(sx, sy);
    const ox = (W - (b.maxLng - b.minLng) * k * s) / 2, oy = (H - (b.maxLat - b.minLat) * s) / 2;
    const P = (lat, lng) => ({ x: ox + (lng - b.minLng) * k * s, y: oy + (b.maxLat - lat) * s });
    const inv = (x, y) => ({ lat: b.maxLat - (y - oy) / s, lng: b.minLng + (x - ox) / (k * s) });
    const step = niceStep(b.maxLat - b.minLat);
    let grid = '';
    for(let lat = Math.ceil(b.minLat / step) * step; lat <= b.maxLat; lat += step){ const p = P(lat, b.minLng), q = P(lat, b.maxLng); grid += `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/>`; }
    for(let lng = Math.ceil(b.minLng / step) * step; lng <= b.maxLng; lng += step){ const p = P(b.minLat, lng), q = P(b.maxLat, lng); grid += `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/>`; }
    const dots = mappedPlaces().filter(p => p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng)
      .map(p => { const q = P(p.lat, p.lng); return `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="1.6"><title>${escapeHud(p.name)}</title></circle>${countryId ? `<text x="${(q.x + 3).toFixed(1)}" y="${(q.y - 2).toFixed(1)}">${escapeHud(p.name)}</text>` : ''}`; }).join('');
    const pq = pin ? P(pin.lat, pin.lng) : null;
    host.innerHTML = `<svg class="mini-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tap to drop a pin">
      <rect width="${W}" height="${H}" class="mm-bg"/><g class="mm-grid">${grid}</g><g class="mm-dots">${dots}</g>
      ${pq ? `<g class="mm-pin"><circle cx="${pq.x}" cy="${pq.y}" r="6"/><path d="M${pq.x - 9} ${pq.y}H${pq.x + 9}M${pq.x} ${pq.y - 9}V${pq.y + 9}"/></g>` : ''}
    </svg><p class="mm-hint">${countryId ? 'Tap inside the country to drop the pin.' : 'Tap the world map to drop the pin.'} Dots are existing places.</p>`;
    const svg = host.querySelector('svg');
    svg.addEventListener('click', (e) => {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
      const g = inv(loc.x, loc.y);
      pin = { lat: Math.round(g.lat * 100) / 100, lng: Math.round(g.lng * 100) / 100 };
      draw();
      opts.onPick && opts.onPick(pin.lat, pin.lng);
    });
  }
  draw();
  return {
    setCountry(id){ countryId = id || null; draw(); },
    setPin(lat, lon){ pin = hasNum(lat) && hasNum(lon) ? { lat, lng: lon } : null; draw(); }
  };
}
function wireCoords(prefix, mm){
  const la = document.getElementById(prefix + 'Lat'), lo = document.getElementById(prefix + 'Lon');
  const onType = () => mm.setPin(parseFloat(la.value), parseFloat(lo.value));
  la.addEventListener('change', onType); lo.addEventListener('change', onType);
  return (lat, lon) => { la.value = lat; lo.value = lon; };
}
const readNum = id => { const v = parseFloat(document.getElementById(id).value); return isFinite(v) ? v : null; };

// ---- image resize (same limits as the Dossier: icon 200px, photo 700px) ----
function readImage(file, maxDim){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        let { width, height } = img;
        if(width > maxDim || height > maxDim){ const sc = maxDim / Math.max(width, height); width = Math.round(width * sc); height = Math.round(height * sc); }
        const cv = document.createElement('canvas'); cv.width = width; cv.height = height;
        cv.getContext('2d').drawImage(img, 0, 0, width, height);
        let opaque = true;
        try{ const d = cv.getContext('2d').getImageData(0, 0, width, height).data; for(let i = 3; i < d.length; i += 4){ if(d[i] < 255){ opaque = false; break; } } }catch(e){ opaque = false; }
        resolve(opaque ? cv.toDataURL('image/jpeg', 0.85) : cv.toDataURL('image/png'));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---- rendering ----
function renderLibrary(){
  document.querySelectorAll('[data-libtab]').forEach(b => { b.classList.toggle('on', b.dataset.libtab === libTab); b.setAttribute('aria-selected', b.dataset.libtab === libTab); });
  const v = libView;
  if(v.mode === 'place') return renderPlaceForm(v);
  if(v.mode === 'country') return renderCountryForm(v);
  if(v.mode === 'item') return renderItemForm(v);
  if(v.mode === 'itemDetail') return renderItemDetail(v);
  if(v.mode === 'delete') return renderDeleteCheck(v);
  return libTab === 'items' ? renderItemList() : renderPlaceList();
}
function renderPlaceList(){
  const lib = Lib.get();
  const countries = lib.countries.slice().sort((a, b) => a.name.localeCompare(b.name));
  const places = lib.places.slice().sort((a, b) => a.name.localeCompare(b.name));
  libBody().innerHTML = `
    <div class="lib-actions"><button type="button" class="lib-btn primary" id="libAddPlace">+ Add place</button><button type="button" class="lib-btn" id="libAddCountry">+ Add country</button></div>
    <div class="lib-sec">YOUR PLACES · ${places.length}</div>
    ${places.length ? places.map(p => `<div class="lib-row">
      <div class="lib-row-main"><b>${escapeHud(p.name || 'Unnamed place')}</b><small>${escapeHud(World.KIND_LABEL[p.kind] || p.kind)} · ${escapeHud((geoCountry(p.countryId) || {}).name || 'no country')}${hasNum(p.lat) ? '' : ' · no pin'}</small></div>
      <div class="lib-row-btns">${hasNum(p.lat) ? `<button type="button" class="lib-btn" data-show="${escapeHud(p.id)}">Show</button>` : ''}<button type="button" class="lib-btn" data-edit-place="${escapeHud(p.id)}">Edit</button><button type="button" class="lib-btn danger" data-del="place:${escapeHud(p.id)}">Delete</button></div>
    </div>`).join('') : '<p class="lib-empty">No places of your own yet. Built-in cities and sites are always on the map.</p>'}
    <div class="lib-sec">YOUR COUNTRIES · ${countries.length}</div>
    ${countries.length ? countries.map(c => `<div class="lib-row">
      <div class="lib-row-main"><b>${escapeHud(c.name || 'Unnamed country')}</b><small>${World.placesIn(c.id).length} place${World.placesIn(c.id).length === 1 ? '' : 's'}${hasNum(c.lat) ? '' : ' · no pin'}</small></div>
      <div class="lib-row-btns"><button type="button" class="lib-btn" data-edit-country="${escapeHud(c.id)}">Edit</button><button type="button" class="lib-btn danger" data-del="country:${escapeHud(c.id)}">Delete</button></div>
    </div>`).join('') : '<p class="lib-empty">No countries of your own yet.</p>'}`;
  document.getElementById('libAddPlace').addEventListener('click', () => { libView = { mode: 'place', draft: { kind: 'city' } }; renderLibrary(); });
  document.getElementById('libAddCountry').addEventListener('click', () => { libReturn = null; libView = { mode: 'country', draft: {} }; renderLibrary(); });
  wireListButtons();
}
function wireListButtons(){
  const body = libBody();
  body.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', () => { selectPlace(b.dataset.show); if(window.matchMedia('(max-width:700px)').matches) closeLibrary(); }));
  body.querySelectorAll('[data-edit-place]').forEach(b => b.addEventListener('click', () => { const p = Lib.place(b.dataset.editPlace); libView = { mode: 'place', id: p.id, draft: { ...p } }; renderLibrary(); }));
  body.querySelectorAll('[data-edit-country]').forEach(b => b.addEventListener('click', () => { const c = Lib.get().countries.find(x => x.id === b.dataset.editCountry); libReturn = null; libView = { mode: 'country', id: c.id, draft: { ...c } }; renderLibrary(); }));
  body.querySelectorAll('[data-edit-item]').forEach(b => b.addEventListener('click', () => { const it = Lib.item(b.dataset.editItem); libView = { mode: 'item', id: it.id, draft: JSON.parse(JSON.stringify(it)) }; renderLibrary(); }));
  body.querySelectorAll('[data-open-item]').forEach(b => b.addEventListener('click', () => { libView = { mode: 'itemDetail', id: b.dataset.openItem }; renderLibrary(); }));
  body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { const [kind, id] = b.dataset.del.split(':'); libView = { mode: 'delete', kind, id, back: { ...libView } }; renderLibrary(); }));
}
function formButtons(saveLabel){
  return `<p class="lib-msg" id="libMsg" role="alert"></p>
    <div class="lib-actions"><button type="button" class="lib-btn" id="libCancel">Cancel</button><button type="button" class="lib-btn primary" id="libSave">${saveLabel}</button></div>`;
}
function renderPlaceForm(v){
  const d = v.draft;
  libBody().innerHTML = `
    <div class="lib-sec">${v.id ? 'EDIT PLACE' : 'ADD PLACE'}</div>
    <label class="lib-field">Name<input type="text" id="lpName" value="${escapeHud(d.name || '')}" placeholder="e.g. The Ashen Gate"></label>
    <label class="lib-field">Country<select id="lpCountry"><option value="">— choose —</option>${countryOptions(d.countryId)}<option value="__new">+ Add a country…</option></select></label>
    <label class="lib-field">Kind<select id="lpKind">${World.KINDS.map(k => `<option value="${k}"${d.kind === k ? ' selected' : ''}>${World.KIND_LABEL[k]}</option>`).join('')}</select></label>
    <div class="lib-field">Pin<div id="lpMap"></div>
      <div class="lib-coords"><label>Lat<input type="number" step="0.01" id="lpLat" value="${hasNum(d.lat) ? d.lat : ''}"></label><label>Lon<input type="number" step="0.01" id="lpLon" value="${hasNum(d.lon) ? d.lon : ''}"></label></div></div>
    <label class="lib-field">Note<textarea id="lpNote" placeholder="Anything worth remembering">${escapeHud(d.note || '')}</textarea></label>
    ${formButtons(v.id ? 'Save place' : 'Add place')}`;
  const setCoords = (lat, lon) => { document.getElementById('lpLat').value = lat; document.getElementById('lpLon').value = lon; };
  const mm = miniMap(document.getElementById('lpMap'), { countryId: d.countryId, lat: d.lat, lon: d.lon, onPick: setCoords });
  wireCoords('lp', mm);
  const snapshot = () => ({ ...d, name: document.getElementById('lpName').value, countryId: document.getElementById('lpCountry').value, kind: document.getElementById('lpKind').value, lat: readNum('lpLat'), lon: readNum('lpLon'), note: document.getElementById('lpNote').value });
  document.getElementById('lpCountry').addEventListener('change', (e) => {
    if(e.target.value === '__new'){ libReturn = { ...v, draft: { ...snapshot(), countryId: '' } }; libView = { mode: 'country', draft: {} }; renderLibrary(); return; }
    mm.setCountry(e.target.value);
  });
  document.getElementById('libCancel').addEventListener('click', () => { libView = { mode: 'list' }; renderLibrary(); });
  document.getElementById('libSave').addEventListener('click', () => {
    const p = snapshot();
    if(!p.name.trim()) return libMessage('Give the place a name.');
    if(!p.countryId) return libMessage('Choose a country.');
    if(!hasNum(p.lat) || !hasNum(p.lon)) return libMessage('Tap the map (or type lat / lon) so the place has a pin.');
    if(p.lat < -90 || p.lat > 90 || p.lon < -180 || p.lon > 180) return libMessage('Lat is −90 to 90, lon is −180 to 180.');
    const id = v.id || Lib.newId('lp');
    const saved = Lib.update(lib => {
      const rec = { id, name: p.name.trim(), countryId: p.countryId, kind: p.kind, lat: p.lat, lon: p.lon, note: p.note.trim() };
      const i = lib.places.findIndex(x => x.id === id);
      if(i >= 0) lib.places[i] = { ...lib.places[i], ...rec }; else lib.places.push(rec);
    });
    if(libSaved(saved)){ libView = { mode: 'list' }; renderLibrary(); }
  });
}
function renderCountryForm(v){
  const d = v.draft;
  libBody().innerHTML = `
    <div class="lib-sec">${v.id ? 'EDIT COUNTRY' : 'ADD COUNTRY'}</div>
    <p class="lib-empty">Your countries show as a labelled point (no borders).</p>
    <label class="lib-field">Name<input type="text" id="lcName" value="${escapeHud(d.name || '')}" placeholder="e.g. The Hollow Dominion"></label>
    <div class="lib-field">Pin<div id="lcMap"></div>
      <div class="lib-coords"><label>Lat<input type="number" step="0.01" id="lcLat" value="${hasNum(d.lat) ? d.lat : ''}"></label><label>Lon<input type="number" step="0.01" id="lcLon" value="${hasNum(d.lon) ? d.lon : ''}"></label></div></div>
    <label class="lib-field">Note<textarea id="lcNote">${escapeHud(d.note || '')}</textarea></label>
    ${formButtons(v.id ? 'Save country' : 'Add country')}`;
  const setCoords = (lat, lon) => { document.getElementById('lcLat').value = lat; document.getElementById('lcLon').value = lon; };
  const mm = miniMap(document.getElementById('lcMap'), { lat: d.lat, lon: d.lon, onPick: setCoords });
  wireCoords('lc', mm);
  const back = (newId) => {
    if(libReturn){ const r = libReturn; libReturn = null; if(newId) r.draft.countryId = newId; libView = r; }
    else libView = { mode: 'list' };
    renderLibrary();
  };
  document.getElementById('libCancel').addEventListener('click', () => back(null));
  document.getElementById('libSave').addEventListener('click', () => {
    const name = document.getElementById('lcName').value.trim(), lat = readNum('lcLat'), lon = readNum('lcLon');
    if(!name) return libMessage('Give the country a name.');
    if(!hasNum(lat) || !hasNum(lon)) return libMessage('Tap the map (or type lat / lon) to place the country.');
    const id = v.id || Lib.newId('lc');
    const saved = Lib.update(lib => {
      const rec = { id, name, lat, lon, note: document.getElementById('lcNote').value.trim() };
      const i = lib.countries.findIndex(x => x.id === id);
      if(i >= 0) lib.countries[i] = rec; else lib.countries.push(rec);
    });
    if(libSaved(saved)) back(id);
  });
}
function renderItemList(){
  const items = Lib.get().items.slice().sort((a, b) => a.name.localeCompare(b.name));
  libBody().innerHTML = `
    <div class="lib-actions"><button type="button" class="lib-btn primary" id="libAddItem">+ Add item</button></div>
    <div class="lib-sec">ITEMS · ${items.length}</div>
    ${items.length ? items.map(i => `<div class="lib-row">
      ${i.icon ? `<img class="lib-thumb" src="${i.icon}" alt="">` : '<span class="lib-thumb ph">◈</span>'}
      <div class="lib-row-main"><b>${escapeHud(i.name || 'Unnamed item')}</b><small>${escapeHud(EpitaphItemFields.originText(i, placeName))}${EpitaphItemFields.badgesHtml(i)}${i.marks.length ? ' · ' + i.marks.map(m => m.kind).join(', ') : ''}</small></div>
      <div class="lib-row-btns"><button type="button" class="lib-btn" data-open-item="${escapeHud(i.id)}">Open</button><button type="button" class="lib-btn" data-edit-item="${escapeHud(i.id)}">Edit</button><button type="button" class="lib-btn danger" data-del="item:${escapeHud(i.id)}">Delete</button></div>
    </div>`).join('') : '<p class="lib-empty">No items yet. Items added here appear in the Dossier’s inventory editor.</p>'}`;
  document.getElementById('libAddItem').addEventListener('click', () => { libView = { mode: 'item', draft: { marks: [] } }; renderLibrary(); });
  wireListButtons();
}
function renderItemForm(v){
  const d = v.draft;
  libBody().innerHTML = `
    <div class="lib-sec">${v.id ? 'EDIT ITEM' : 'ADD ITEM'}</div>
    <label class="lib-field">Name<input type="text" id="liName" value="${escapeHud(d.name || '')}" placeholder="e.g. Dagger of Ashes"></label>
    <label class="lib-field">Description<textarea id="liDesc">${escapeHud(d.desc || '')}</textarea></label>
    <div class="lib-field">Details<div id="liDetails"></div></div>
    <div class="lib-field">Pictures
      <div class="lib-pics">
        <label class="lib-pic">${d.icon ? `<img src="${d.icon}" alt="">` : '<span>Icon</span>'}<input type="file" accept="image/*" id="liIcon" class="visually-hidden"></label>
        <label class="lib-pic large">${d.image ? `<img src="${d.image}" alt="">` : '<span>Photo</span>'}<input type="file" accept="image/*" id="liImage" class="visually-hidden"></label>
        ${d.icon || d.image ? '<button type="button" class="lib-btn" id="liClearPics">Remove pictures</button>' : ''}
      </div></div>
    <div class="lib-field">Marks (in every state; each character's copy can differ)<div id="liMarks"></div></div>
    <div class="lib-field">States (up to three tracks; each chapter picks one state per track in the Dossier)<div id="liStates"></div></div>
    <div class="lib-field">History (what happened to it before the story or off the page)<div id="liHistory"></div></div>
    <label class="lib-field">Note<textarea id="liNote">${escapeHud(d.note || '')}</textarea></label>
    ${formButtons(v.id ? 'Save item' : 'Add item')}`;
  const marks = EpitaphMarks.editor(document.getElementById('liMarks'), d.marks || []);
  const tracks = EpitaphStates.tracksEditor(document.getElementById('liStates'), d.stateTracks || [], v.id ? itemHistory(v.id) : []);
  const fields = { getMarks: () => marks.read(), getTracks: () => tracks.read() };
  const details = EpitaphItemFields.mountDetails(document.getElementById('liDetails'), d, { ...fields, placeOptionsHtml: placeOptions });
  const history = EpitaphItemFields.mountHistory(document.getElementById('liHistory'), d, { getTracks: fields.getTracks, holders: () => freshDossier().characters.map(c => c.name).filter(Boolean) });
  const keep = () => Object.assign(d, { name: document.getElementById('liName').value, desc: document.getElementById('liDesc').value, note: document.getElementById('liNote').value, marks: marks.read(), stateTracks: tracks.read(), ...details.read(), history: history.read() });
  [['liIcon', 'icon', 200], ['liImage', 'image', 700]].forEach(([id, field, max]) => document.getElementById(id).addEventListener('change', async (e) => {
    const f = e.target.files[0]; if(!f) return;
    keep();
    try{ d[field] = await readImage(f, max); }catch(err){ libMessage('That image could not be read — try a JPEG or PNG.'); return; }
    renderLibrary();
  }));
  const clr = document.getElementById('liClearPics'); if(clr) clr.addEventListener('click', () => { keep(); d.icon = ''; d.image = ''; renderLibrary(); });
  document.getElementById('libCancel').addEventListener('click', () => { libView = v.id ? { mode: 'itemDetail', id: v.id } : { mode: 'list' }; renderLibrary(); });
  document.getElementById('libSave').addEventListener('click', () => {
    keep();
    if(!d.name.trim()) return libMessage('Give the item a name.');
    const id = v.id || Lib.newId('li');
    const saved = Lib.update(lib => {
      const rec = { id, ...EpitaphItemFields.cleanItem(d) };
      const i = lib.items.findIndex(x => x.id === id);
      if(i >= 0) lib.items[i] = rec; else lib.items.push(rec);
    });
    if(libSaved(saved)){ libView = { mode: 'itemDetail', id }; renderLibrary(); }
  });
}
function historyWhen(w){ w = w || {}; return ({ BEFORE: 'Before Epitaph', ERA_0: 'Era 0', ERA_1: 'Era 1' }[w.era] || 'Era 1') + (w.year != null ? ' · Y' + w.year : '') + (w.chapter != null ? ' · CH ' + w.chapter : ''); }
function renderItemDetail(v){
  const it = Lib.item(v.id);
  if(!it){ libView = { mode: 'list' }; return renderLibrary(); }
  const hist = itemHistory(it.id);
  libBody().innerHTML = `
    <button type="button" class="lib-back" id="libBack">← All items</button>
    <div class="lib-item-head">${it.image ? `<img src="${it.image}" alt="">` : (it.icon ? `<img src="${it.icon}" alt="">` : '')}<div><h3>${escapeHud(it.name)}</h3>
      <p class="lib-origin">${Lib.placeIdOf(it) ? `from <button type="button" class="lib-link" id="liGoOrigin">${escapeHud(placeName(Lib.placeIdOf(it)) || 'a missing place')}</button>` : escapeHud(EpitaphItemFields.originText(it, placeName))} ${EpitaphItemFields.badgesHtml(it)}</p></div></div>
    ${it.originCircumstance ? `<p class="lib-desc">${escapeHud(it.originCircumstance)}</p>` : ''}
    ${it.desc ? `<p class="lib-desc">${escapeHud(it.desc)}</p>` : ''}
    ${it.marks.length ? `<div class="mark-lines">${EpitaphMarks.linesHtml(it.marks)}</div>` : ''}
    ${it.note ? `<p class="lib-desc dim">${escapeHud(it.note)}</p>` : ''}
    ${it.stateTracks.length ? `<div class="lib-sec">STATES</div>${EpitaphStates.trackHtml(it, hist)}` : ''}
    ${it.history.length ? `<div class="lib-sec">BEFORE THE STORY</div><ol class="lib-history">${it.history.map(h => `<li><span>${escapeHud(historyWhen(h.when))}</span>${escapeHud(h.holder)} ${escapeHud(h.text)}</li>`).join('')}</ol>` : ''}
    <div class="lib-sec">HISTORY</div>
    ${hist.length ? `<ol class="lib-history">${hist.map(h => { const cur = Lib.currentStates(it, h); return `<li><span>${h.ch != null ? 'CH ' + h.ch : escapeHud(h.label || 'CH ?')}</span>${escapeHud(h.who)}${cur.map(x => ` <span class="state-tag">${escapeHud(x.state.name.toUpperCase())}</span>`).join('')}</li>`; }).join('')}</ol>` : '<p class="lib-empty">Nobody has carried it yet. Add it to an inventory in the Dossier.</p>'}
    <div class="lib-actions"><button type="button" class="lib-btn" data-edit-item="${escapeHud(it.id)}">Edit</button><button type="button" class="lib-btn danger" data-del="item:${escapeHud(it.id)}">Delete</button></div>`;
  document.getElementById('libBack').addEventListener('click', () => { libView = { mode: 'list' }; renderLibrary(); });
  const go = document.getElementById('liGoOrigin'); if(go) go.addEventListener('click', () => selectPlace(Lib.placeIdOf(it)));
  wireListButtons();
}
function renderDeleteCheck(v){
  const lib = Lib.get();
  const rec = v.kind === 'place' ? lib.places.find(x => x.id === v.id) : v.kind === 'country' ? lib.countries.find(x => x.id === v.id) : lib.items.find(x => x.id === v.id);
  if(!rec){ libView = { mode: 'list' }; return renderLibrary(); }
  const refs = findRefs(v.kind, v.id);
  const others = v.kind === 'place' ? World.places().filter(p => p.id !== v.id)
    : v.kind === 'country' ? World.countries().filter(c => c.id !== v.id) : lib.items.filter(i => i.id !== v.id);
  libBody().innerHTML = `
    <div class="lib-sec">DELETE ${v.kind.toUpperCase()}</div>
    <p class="lib-desc">Delete <b>${escapeHud(rec.name || 'this ' + v.kind)}</b>?</p>
    ${refs.length ? `<div class="lib-warn"><b>${refs.length} thing${refs.length === 1 ? '' : 's'} point${refs.length === 1 ? 's' : ''} at it:</b><ul>${refs.map(r => `<li>${escapeHud(r)}</li>`).join('')}</ul></div>
      <label class="lib-field">Reassign them to<select id="ldTo"><option value="">— choose —</option>${others.map(o => `<option value="${escapeHud(o.id)}">${escapeHud(o.name)}</option>`).join('')}</select></label>
      <label class="lib-check"><input type="checkbox" id="ldForce"> Delete without reassigning (they will point at nothing; Checks will list them)</label>` : '<p class="lib-empty">Nothing refers to it.</p>'}
    <p class="lib-msg" id="libMsg" role="alert"></p>
    <div class="lib-actions"><button type="button" class="lib-btn" id="libCancel">Cancel</button><button type="button" class="lib-btn danger" id="ldGo">${refs.length ? 'Reassign and delete' : 'Delete'}</button></div>`;
  const goBtn = document.getElementById('ldGo'), to = document.getElementById('ldTo'), force = document.getElementById('ldForce');
  const syncLabel = () => { if(refs.length) goBtn.textContent = force.checked ? 'Delete anyway' : 'Reassign and delete'; };
  if(force) force.addEventListener('change', syncLabel);
  document.getElementById('libCancel').addEventListener('click', () => { libView = v.back && v.back.mode !== 'delete' ? v.back : { mode: 'list' }; renderLibrary(); });
  goBtn.addEventListener('click', () => {
    if(refs.length && !force.checked){
      if(!to.value) return libMessage('Choose what to reassign them to, or tick “Delete without reassigning”.');
      if(!reassign(v.kind, v.id, to.value)) return libMessage('Could not reassign — nothing was deleted.');
    }
    if(libSaved(deleteNow(v.kind, v.id))){
      if(selectedLoc === v.id) backToIndex();
      libView = { mode: 'list' }; renderLibrary();
    }
  });
}
Lib.onChange(() => {
  renderView();
  if(selectedLoc) renderLocationRecord();
  if(document.getElementById('libDrawer').classList.contains('open')) renderLibrary();
});


window.EpitaphLibraryUI = { open: openLibrary, close: closeLibrary, hooks };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('libDrawer').classList.contains('open')) closeLibrary(); });
})();
