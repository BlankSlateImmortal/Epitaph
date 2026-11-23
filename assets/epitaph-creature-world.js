/* Epitaph — the World over time (Creature Log step 4.1; layout AC, picked 2026-11-23).
 *
 * The same time chips as the tree and the food web (14: seven epochs, then ages A–G) drive one big dither map of the Earth:
 *   · the old dry coasts before Age D, then from Age D (the user's decision) the crater in Antarctica and the sea +60 m
 *     (EpitaphDither.world draws the drowned land in its second colour);
 *   · the infected places that have awakened by that time (a place's own "cursed since", else its biome's), as ember dots;
 *   · the forms alive then: a list on the left page, and the places of the picked one lit on the map.
 * Beside it: what is true of the world now, what changed since the band before, and layer toggles. Nothing is drawn that the log
 * doesn't hold: an unwritten date means a place is simply not drawn yet, and there is no ice layer (the map has none).
 *
 *   EpitaphCreatureWorld.model(st, idx, sel)   → { era, crater, sea, awake, awakeCount, totalPlaces, forms, lit, changes }   (pure, tested)
 *   EpitaphCreatureWorld.mount(host, { st, panel, reader, onOpen, sel }) → { setAt(i), select(id), destroy() }
 */
(function (global) {
  'use strict';
  const C = () => global.EpitaphCreatures, D = () => global.EpitaphDither;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /** From this age on the crater is there and the sea stands 60 m higher (decided by the user, 2026-11-23). */
  const SHIFT = 'D';
  const CRATER = { lon: 0, lat: -80, spanLon: 52, topLat: -69 };       // the gods went straight through Antarctica (as the Atlas draws it)

  function bands() { const K = C(); return K.EPOCHS.map((e, i) => ({ id: e.id, label: e.label, chip: String(i + 1) })).concat(K.AGES.map(a => ({ id: a.id, label: 'Age ' + a.id + ' · ' + a.label, chip: a.id }))); }
  const idxOf = id => bands().findIndex(b => b.id === id);

  // ---------------------------------------------------------------- the model (pure)
  /** What is true of the world at band `idx`. `sel` = a picked form (its places light up). */
  function model(st, idx, sel) {
    const K = C(), B = bands(), at = B[idx].id, t = K.timeIndex(at), shifted = idx >= idxOf(SHIFT);
    const biomes = new Map((st.biomes || []).map(b => [b.id, b])), places = (st.places || []).filter(p => Number.isFinite(p.lon) && Number.isFinite(p.lat));
    const since = p => { const s = p.since != null ? p.since : (biomes.get(p.biome) || {}).since; return s == null ? null : K.timeIndex(s); };
    const awakeAt = tt => places.filter(p => { const s = since(p); return s != null && s <= tt; });
    const awake = awakeAt(t);
    const forms = [].concat(st.creatures || [], st.nodes || []).filter(c => !c.silhouette && K.aliveAt(c, at) && (K.timeIndex(c.when) == null || K.timeIndex(c.when) <= t))
      .map(c => ({ id: c.id, name: c.name || c.id, kind: c.when != null && K.timeIndex(c.when) === t ? 'new' : '', biomes: c.biomes || [] })).sort((a, b) => a.name.localeCompare(b.name));
    // a lineage step is the creature of its time only while it has no descendant alive: show the living tips
    const kidsAlive = new Set(); [].concat(st.creatures || [], st.nodes || []).forEach(c => { if (c.parentId && K.aliveAt(c, at) && (K.timeIndex(c.when) == null || K.timeIndex(c.when) <= t)) kidsAlive.add(c.parentId); });
    const tips = forms.filter(f => !kidsAlive.has(f.id));
    const pick = sel && tips.concat(forms).find(f => f.id === sel), litBiomes = new Set(pick ? pick.biomes : []);
    const lit = pick ? places.filter(p => litBiomes.has(p.biome)) : [];
    const prev = idx > 0 ? model(st, idx - 1) : null;
    const changes = { shift: idx === idxOf(SHIFT), woke: prev ? awake.length - prev.awakeCount : awake.length, appeared: prev ? tips.filter(f => !prev.forms.some(g => g.id === f.id)).map(f => f.name) : [], gone: prev ? prev.forms.filter(g => !tips.some(f => f.id === g.id) && !forms.some(f => f.id === g.id)).map(g => g.name) : [] };
    return { era: shifted ? 1 : 0, crater: shifted, sea: shifted, awake, awakeCount: awake.length, totalPlaces: places.length, forms: tips, allForms: forms, lit, picked: pick ? pick.id : null, changes };
  }

  // ---------------------------------------------------------------- drawing
  function leftHtml(m, B, idx, sel, tog, reader) {
    const ch = m.changes, parts = [ch.shift ? 'the crater forms and the sea rises +60 m' : '', ch.woke > 0 ? `${ch.woke} infected place${ch.woke === 1 ? '' : 's'} awaken` : '', ch.appeared.length ? '+ ' + ch.appeared.map(esc).join(', ') : '', ch.gone.length ? '− ' + ch.gone.map(esc).join(', ') + ' (gone)' : ''].filter(Boolean);
    const row = (key, swatch, text) => `<label class="cwo-row"><input type="checkbox" data-layer="${key}"${tog[key] ? ' checked' : ''}><i style="${swatch}"></i><span>${text}</span></label>`;
    return `<div class="cwo-card"><span class="cw-fl">${esc(B[idx].label)}${idx === 13 ? ' · now' : ''}</span><span class="cw-dim">what is true of the world now</span>
      ${row('crater', 'background:radial-gradient(circle,#e0654a,#5a2418)', m.crater ? '<b>The crater</b> in Antarctica, ringed by the impact mountains' : '<span class="cw-dim"><b>The crater</b>: not yet (it forms in Age ${SHIFT})</span>')}
      ${row('sea', 'border:2px dashed #6f9ad8', m.sea ? '<b>The sea</b> stands 60 m higher: coasts and old cities drowned' : '<span class="cw-dim"><b>The sea</b>: the old coasts, dry (until Age ${SHIFT})</span>')}
      ${row('curses', 'background:rgba(224,101,74,.5);border:1px solid #e0654a;border-radius:50%', `<b>Infected places</b> awake: ${m.awakeCount} of ${m.totalPlaces}${m.totalPlaces && !m.awakeCount ? ' <span class="cw-dim">(none yet)</span>' : ''}`)}
      ${row('forms', 'background:#ffd58a;border-radius:50%', `<b>Living forms</b>: ${m.forms.length}${sel && m.picked ? '' : ' <span class="cw-dim">(pick one to light its places)</span>'}`)}</div>
      <div class="cwo-card"><span class="cw-fl">Since ${esc(idx > 0 ? B[idx - 1].label : 'the start')}</span>${parts.length ? `<span>${parts.join(' · ')}</span>` : '<span class="cw-dim">Nothing changed.</span>'}</div>
      <div class="cwo-card"><span class="cw-fl">Forms alive</span>${m.forms.length ? `<div class="cwo-forms">${m.forms.map(f => `<button type="button" data-form="${esc(f.id)}" class="cwo-form${f.id === m.picked ? ' on' : ''}" aria-pressed="${f.id === m.picked}">${esc(f.name)}${f.kind === 'new' ? ' <i>new</i>' : ''}</button>`).join('')}</div>${m.picked ? `<span class="cw-dim">${m.lit.length} infected place${m.lit.length === 1 ? '' : 's'} in its biomes.</span>${reader ? '' : `<button type="button" class="cl-new" data-page="${esc(m.picked)}">Open page ▸</button>`}` : ''}` : '<span class="cw-dim">No form of the log is alive at this time' + (reader ? '.' : ' (dates are set in each form).') + '</span>'}</div>
      <div class="cwo-card cw-dim">There is no ice layer: the map holds no ice data, and nothing is invented.</div>`;
  }
  async function drawMap(panel, m, tog, token, isCurrent) {
    const Dt = D(); if (!panel || !Dt) return;
    panel.hidden = false; panel.classList.add('se-panel');
    panel.innerHTML = '<div class="cl-map cwo-map"><canvas class="se-cv" aria-label="Dither map of the world at the chosen time"></canvas><svg class="se-svg" aria-hidden="true"></svg><div class="se-legend"></div></div>';
    try { await Dt.load(); } catch (e) { return; }
    if (!isCurrent(token)) return;
    const host = panel.querySelector('.cwo-map'); if (!host || !host.isConnected) return;
    if (!host.clientWidth || !host.clientHeight) { setTimeout(() => { if (isCurrent(token)) drawMap(panel, m, tog, token, isCurrent); }, 120); return; }
    const cv = host.querySelector('.se-cv'), svg = host.querySelector('.se-svg'), w = host.clientWidth, h = host.clientHeight;
    const pr = Dt.world(cv, { era: tog.sea && m.sea ? 1 : 0 }).project; svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', w); svg.setAttribute('height', h);
    let out = '';
    if (tog.crater && m.crater) { const c = pr(CRATER.lon, CRATER.lat), l = pr(CRATER.lon - CRATER.spanLon, CRATER.lat), r = pr(CRATER.lon + CRATER.spanLon, CRATER.lat), top = pr(CRATER.lon, CRATER.topLat), rx = Math.abs(r[0] - l[0]) / 2, ry = Math.max(8, Math.abs(c[1] - top[1]));
      out += `<defs><radialGradient id="cwoCr"><stop offset="0" stop-color="#e0654a" stop-opacity=".85"/><stop offset=".6" stop-color="#e0654a" stop-opacity=".25"/><stop offset="1" stop-color="#e0654a" stop-opacity="0"/></radialGradient></defs><ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="url(#cwoCr)"/><text x="${(c[0] + rx + 6).toFixed(1)}" y="${(c[1] - 4).toFixed(1)}" fill="var(--ember)" font-family="VT323,monospace" font-size="16">the crater</text>`; }
    if (tog.curses) out += m.awake.map(p => { const [x, y] = pr(p.lon, p.lat); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="var(--ember)" opacity=".75"/>`; }).join('');
    if (tog.forms && m.lit.length) out += m.lit.map(p => { const [x, y] = pr(p.lon, p.lat); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="var(--amber-hi)" stroke="#fff3d6" stroke-width="1"/>`; }).join('');
    svg.innerHTML = out;
    host.querySelector('.se-legend').innerHTML = `${m.era ? 'Era 1 · the sea +60 m' : 'Era 0 · the old coasts'}${m.crater ? ' · the crater' : ''}<br><span style="color:var(--ember)">●</span> infected place awake${m.lit.length ? ' · <span style="color:var(--amber-hi)">●</span> the picked form\'s places' : ''}`;
  }

  function mount(host, o) {
    const B = bands(); let at = 13, sel = o.sel || null, token = 0; const tog = { crater: true, sea: true, curses: true, forms: true };
    host.innerHTML = `<div class="cw"><div class="cw-bar"><span class="cw-fl">Time</span><div class="cw-chips" role="group" aria-label="Point in time">${B.map((b, i) => `<button type="button" data-at="${i}" class="${i === at ? 'on' : ''}${i >= 11 ? ' cu' : ''}" aria-pressed="${i === at}" aria-label="${esc(b.label)}">${esc(b.chip)}</button>`).join('')}</div><span class="cw-when" aria-live="polite"></span></div><div class="cwo-left"></div></div>`;
    const left = host.querySelector('.cwo-left'), when = host.querySelector('.cw-when');
    const paint = () => { const m = model(o.st, at, sel), my = ++token; when.textContent = B[at].label + (at === 13 ? ' · now' : '');
      host.querySelectorAll('.cw-chips button').forEach((b, i) => { b.classList.toggle('on', i === at); b.setAttribute('aria-pressed', i === at); });
      left.innerHTML = leftHtml(m, B, at, sel, tog, !!o.reader); drawMap(o.panel, m, tog, my, t => t === token); };
    paint();
    const click = e => { const t = e.target; if (!t.closest) return; const c = t.closest('[data-at]'); if (c) { at = +c.dataset.at; paint(); return; }
      const f = t.closest('[data-form]'); if (f) { sel = sel === f.dataset.form ? null : f.dataset.form; paint(); return; } const pg = t.closest('[data-page]'); if (pg && o.onOpen) o.onOpen(pg.dataset.page); };
    const change = e => { const l = e.target.closest && e.target.closest('[data-layer]'); if (l) { tog[l.dataset.layer] = l.checked; paint(); } };
    host.addEventListener('click', click); host.addEventListener('change', change);
    return { setAt: i => { at = Math.max(0, Math.min(13, i)); paint(); }, select: id => { sel = id; paint(); }, destroy: () => { token++; host.removeEventListener('click', click); host.removeEventListener('change', change); } };
  }
  global.EpitaphCreatureWorld = { SHIFT, CRATER, bands, model, mount };
})(typeof window !== 'undefined' ? window : globalThis);
