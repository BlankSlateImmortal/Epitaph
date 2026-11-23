/* Epitaph — the Tree of Descent (Creature Log step 2.1; layout V, picked 2026-11-23).
 *
 * Time runs down the page: one band per epoch (Chaos → The Twisted Worlds, then Epitaph), and the Epitaph epoch opens into its
 * seven ages A–G; the last three (the curse cycle) are tinted red. Roots sit at the top, each lineage step one band below where
 * its ancestor appeared, forks where a lineage split. Living tips run on to the present and glow; extinct lines stop at the age
 * they died out in, with a fossil mark. Branches are coloured by biome or by cause (a toggle). Pan by dragging (or the arrow
 * keys), zoom with the wheel, pinch or + / −, and 0 fits the tree again.
 *
 *   EpitaphCreatureTree.layout(store)                 → { bands, nodes, edges, width, height, chaos }   (pure, tested in Node)
 *   EpitaphCreatureTree.colours(layout, by)           → { key(node) → colour, legend: [[label, colour]] }
 *   EpitaphCreatureTree.mount(host, { colourBy, sel, onSelect }) → { select(id), setColour(by), fit(), destroy() }
 *
 * Author only for now: a reader's view (unrevealed forms as "?" silhouettes) is step 2.4, the scrubber 2.2, fork details 2.3.
 */
(function (global) {
  'use strict';
  const C = () => global.EpitaphCreatures, TL = () => global.EpitaphTimeline;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BAND = 96, THIN = 26, COL = 190, TOP = 8, LEFT = 150, GAP = 70;
  const PALETTE = ['#ffb238', '#6fb3a3', '#b98ad8', '#e0654a', '#8fb86f', '#d8c46a', '#6f9ad8', '#d88ab0'], OTHER = '#8a6a34';

  // ---------------------------------------------------------------- time → band
  /** The 14 bands: epochs 0–6, then ages A–G (7–13). */
  function bandList() {
    const K = C();
    return K.EPOCHS.map((e, i) => ({ i, id: e.id, label: e.label, kind: 'epoch' }))
      .concat(K.AGES.map((a, j) => ({ i: 7 + j, id: a.id, label: 'Age ' + a.id + ' · ' + a.label, kind: 'age', curse: a.cursePhase || null })));
  }
  /** A time (epoch, age, age letter, or a timeline event id) as a band index, or null when it can't be placed. */
  function bandOf(when) {
    const K = C(); if (when == null || when === '') return null;
    let t = K.timeIndex(when);
    if (t == null && typeof when === 'string') {
      const e = K.EPOCHS.findIndex(x => (x.events || []).includes(when)); if (e >= 0) t = e;
      const a = K.AGES.findIndex(x => x.from === when); if (a >= 0) t = 6 + (a + 1) / 10;
    }
    if (t == null) return null;
    return t < 6 ? Math.floor(t) : t === 6 ? 6 : 6 + Math.round((t - 6) * 10);
  }

  // ---------------------------------------------------------------- layout (pure)
  function layout(st) {
    const bands = bandList(), recs = [].concat((st.nodes || []).map(x => ['nodes', x]), (st.creatures || []).map(x => ['creatures', x]));
    const by = new Map(recs.map(([k, x]) => [x.id, { kind: k, rec: x, kids: [] }]));
    // a parent that's missing (or a loop) makes the node a root
    const isRoot = id => { const seen = new Set(); let p = by.get(id).rec.parentId; while (p && by.has(p)) { if (p === id || seen.has(p)) return true; seen.add(p); p = by.get(p).rec.parentId; } return !by.get(id).rec.parentId || !by.has(by.get(id).rec.parentId); };
    const roots = [];
    by.forEach((n, id) => { if (isRoot(id)) roots.push(n); else by.get(n.rec.parentId).kids.push(n); });
    const order = (a, b) => (bandOf(a.rec.when) ?? 99) - (bandOf(b.rec.when) ?? 99) || String(a.rec.name).localeCompare(String(b.rec.name));
    roots.sort(order); by.forEach(n => n.kids.sort(order));
    // which band each node sits in: its own time, never above (or level with) its ancestor's
    const used = new Set();
    const placeBand = (n, pb) => { const b = bandOf(n.rec.when); n.band = b == null ? (pb == null ? 0 : Math.min(13, pb + 1)) : b; n.late = pb != null && n.band <= pb; if (n.late) n.band = pb; used.add(n.band);
      const ex = bandOf(n.rec.extinct); n.extinctBand = n.rec.extinct ? (ex == null ? null : Math.max(ex, n.band)) : null; if (n.extinctBand != null) used.add(n.extinctBand);
      n.kids.forEach(k => placeBand(k, n.band)); };
    roots.forEach(r => placeBand(r, null));
    // band heights: ages always open, an empty epoch folds thin
    let y = TOP; bands.forEach(b => { b.h = (b.kind === 'age' || used.has(b.i)) ? BAND : THIN; b.top = y; y += b.h; });
    const height = y + 30, mid = i => bands[i].top + bands[i].h / 2;
    // x: leaves take columns left to right, each parent centred over its children; lineages apart by a gap
    let col = 0; const nodes = [], edges = [];
    const placeX = n => { if (!n.kids.length) { n.x = LEFT + col * COL; col++; } else { n.kids.forEach(placeX); n.x = (n.kids[0].x + n.kids[n.kids.length - 1].x) / 2; } };
    roots.forEach((r, i) => { if (i) col += GAP / COL; placeX(r); });
    const walk = (n, parent, depth) => {
      n.y = mid(n.band) + (n.late && parent ? 34 : 0) + (parent && parent.late && n.band === parent.band ? 34 : 0);
      const living = !n.rec.extinct, tip = !n.kids.length;
      const endY = n.extinctBand != null ? mid(n.extinctBand) + (n.extinctBand === n.band ? 30 : 0) : !living ? n.y + 30 : (tip ? bands[13].top + bands[13].h - 6 : n.y);
      nodes.push({ id: n.rec.id, kind: n.kind, name: n.rec.name || n.rec.id, x: n.x, y: n.y, band: n.band, depth, parentId: parent ? parent.rec.id : null,
        extinct: !!n.rec.extinct, extBand: n.extinctBand, tip, living: living && tip, endY,
        undated: bandOf(n.rec.when) == null, late: !!n.late, draft: !!n.rec.draft, biomes: n.rec.biomes || [], cause: n.rec.cause || null,
        cursed: !!((n.rec.mutation && n.rec.mutation.curse) || (n.rec.curses || []).length), fork: n.kids.length > 1, forks: n.kids.length,
        change: (n.rec.mutation && n.rec.mutation.change) || '', gain: (n.rec.mutation && n.rec.mutation.advantage) || '', curseId: (n.rec.mutation && n.rec.mutation.curse) || '', whenRaw: n.rec.when, extRaw: n.rec.extinct });
      if (parent) edges.push({ from: parent.rec.id, to: n.rec.id, x1: parent.x, y1: parent.y, x2: n.x, y2: n.y, extinct: !!n.rec.extinct });
      n.kids.forEach(k => walk(k, n, depth + 1));
    };
    roots.forEach(r => walk(r, null, 0));
    const width = LEFT + Math.max(1, col) * COL + 40;
    return { bands, nodes, edges, width, height, chaos: (st.chaos || []).map(x => ({ id: x.id, name: x.name || x.id, draft: !!x.draft })) };
  }

  // ---------------------------------------------------------------- the time scrubber (step 2.2)
  /** The timeline moments that belong to a band: an epoch's own events, or the events an age opens and closes on. */
  function bandEvents(i) {
    const K = C(), ids = i < 7 ? (K.EPOCHS[i].events || []) : [K.AGES[i - 7].from, K.AGES[i - 7].to].filter((x, j, a) => x && a.indexOf(x) === j);
    return ids.map(id => { const ev = TL() && TL().byId && TL().byId(id); return ev ? { id, title: String(ev.title).split(/[:;]/)[0].slice(0, 90) } : null; }).filter(Boolean);
  }
  /** What is on the page when the scrubber sits at band `at` (null or 13 = everything): forms that have appeared, extinct lines only once they've died out. */
  function visibleAt(lay, at) {
    if (at == null || at >= 13) return { nodes: lay.nodes, edges: lay.edges, at: 13 };
    const nodes = lay.nodes.filter(n => n.band <= at), ids = new Set(nodes.map(n => n.id));
    return { nodes, edges: lay.edges.filter(e => ids.has(e.from) && ids.has(e.to)), at };
  }

  // ---------------------------------------------------------------- colour by biome or by cause
  function causeLabel(c) {
    const K = C(); if (!c) return 'No cause yet';
    const a = K.AGES.find(x => x.id === c); if (a) return 'Age ' + a.id + ' · ' + a.label;
    const e = K.EPOCHS.find(x => x.id === c); if (e) return e.label;
    const ev = TL() && TL().byId && TL().byId(c); return ev ? String(ev.title).split(/[:;]/)[0].slice(0, 48) : c;
  }
  function colours(lay, by, st) {
    const names = new Map(((st && st.biomes) || []).map(b => [b.id, b.name]));
    const keyOf = n => (by === 'cause' ? (n.cause || '') : (n.biomes[0] || ''));
    const count = new Map(); lay.nodes.forEach(n => { const k = keyOf(n); count.set(k, (count.get(k) || 0) + 1); });
    const keys = [...count.keys()].filter(k => k).sort((a, b) => count.get(b) - count.get(a) || a.localeCompare(b));
    const col = new Map(keys.slice(0, PALETTE.length).map((k, i) => [k, PALETTE[i]]));
    const label = k => (by === 'cause' ? causeLabel(k) : (names.get(k) || k));
    const legend = keys.slice(0, PALETTE.length).map(k => [label(k), col.get(k)]);
    if (keys.length > PALETTE.length || count.has('')) legend.push([keys.length > PALETTE.length ? 'Other' + (count.has('') ? ' / not set' : '') : (by === 'cause' ? 'No cause yet' : 'No biome yet'), OTHER]);
    return { of: n => col.get(keyOf(n)) || OTHER, legend };
  }

  // ---------------------------------------------------------------- drawing
  function svgTree(lay, pal, sel, at) {
    const vis = visibleAt(lay, at), cap = lay.bands[vis.at].top + lay.bands[vis.at].h - 6, shown = vis.at < 13;
    const elbow = e => { const my = Math.max(e.y1 + 14, e.y2 - BAND * 0.42); return `M${e.x1},${e.y1} V${my} H${e.x2} V${e.y2}`; };
    const byId = new Map(lay.nodes.map(n => [n.id, n]));
    const parents = new Set(vis.edges.map(e => e.from)), front = n => !gone(n) && !parents.has(n.id);      // a living line's visible end
    const gone = n => n.extinct && (!shown || (n.extBand != null && n.extBand <= vis.at));      // extinct by the scrubbed time
    const endOf = n => (gone(n) || !shown ? n.endY : Math.min(n.endY, cap));      // a line still running stops at the scrubbed time
    const lines = vis.edges.map(e => `<path d="${elbow(e)}" class="ct-edge${e.extinct ? ' ext' : ''}" stroke="${pal.of(byId.get(e.to))}"/>`).join('');
    const glows = vis.nodes.filter(n => front(n) && !(endOf(n) > n.y + 1)).map(n => `<circle class="ct-glow" cx="${n.x}" cy="${n.y}" r="4" fill="${pal.of(n)}"/>`).join('');
    const tails = vis.nodes.filter(n => endOf(n) > n.y + 1).map(n => `<path d="M${n.x},${n.y} V${endOf(n)}" class="ct-tail${gone(n) ? ' ext' : ''}" stroke="${pal.of(n)}"/>` +
      (gone(n) ? `<g class="ct-fossil" transform="translate(${n.x},${n.endY})"><title>Extinct</title><path d="M-6,-6 L6,6 M6,-6 L-6,6"/><circle r="9"/></g>`
        : front(n) ? `<circle class="ct-glow" cx="${n.x}" cy="${endOf(n)}" r="5" fill="${pal.of(n)}"><title>Still living</title></circle>` : '')).join('');
    const dots = vis.nodes.map(n => {
      const r = n.kind === 'creatures' ? 10 : 7, c = pal.of(n), on = n.id === sel;
      const tag = [n.kind === 'creatures' ? 'creature' : 'lineage step', gone(n) ? 'extinct' : n.tip ? 'living' : '', n.draft ? 'draft' : '', n.undated ? 'no date yet' : '', n.late ? 'dated before its ancestor' : ''].filter(Boolean).join(', ');
      return `<g class="ct-node${n.kind === 'creatures' ? ' cr' : ''}${on ? ' sel' : ''}${gone(n) ? ' ext' : ''}${n.draft ? ' draft' : ''}" data-node="${esc(n.id)}" transform="translate(${n.x},${n.y})" tabindex="0" role="button" aria-pressed="${on}" aria-label="${esc(n.name)}, ${esc(tag)}">
        ${n.fork ? `<circle r="${r + 4}" class="ct-fork"><title>A fork: ${n.forks} branches</title></circle>` : ''}${on ? `<circle r="${r + 7}" class="ct-ring"/>` : ''}<circle r="${r}" fill="${gone(n) ? 'var(--ink-deep)' : c}" stroke="${c}" class="ct-dot"/>${n.cursed ? `<text class="ct-curse" x="${r + 3}" y="-${r - 2}">⛓</text>` : ''}
        <text class="ct-name" x="${r + 7}" y="5">${esc(n.name)}${n.undated ? ' ?' : ''}</text></g>`;
    }).join('');
    return lines + tails + (shown ? glows : '') + dots;
  }
  function bandsSvg(lay, w, k, ty, at) {
    return lay.bands.map(b => { const y = ty + b.top * k, h = b.h * k, future = at != null && b.i > at;
      return `<rect x="0" y="${y}" width="${w}" height="${h}" class="ct-band${b.curse ? ' curse' : ''}${b.h === THIN ? ' thin' : ''}${future ? ' future' : ''}${at != null && b.i === at ? ' now' : ''}"/>` +
        (h >= 14 ? `<text x="8" y="${y + Math.min(18, h - 4)}" class="ct-blabel${b.curse ? ' curse' : ''}">${esc(b.kind === 'epoch' ? (b.i + 1) + ' · ' + b.label : b.label)}${b.curse && h > 30 ? ' · curses ' + b.curse : ''}</text>` : ''); }).join('');
  }

  function mount(host, opts) {
    opts = opts || {};
    let at = 13, st = C().load(), lay = layout(st), by = opts.colourBy === 'cause' ? 'cause' : 'biome', sel = opts.sel || null, pal = colours(lay, by, st);
    const view = { k: 1, tx: 0, ty: 0 };
    const nN = lay.nodes.length;
    host.innerHTML = `<div class="ct">
      <div class="ct-bar"><span class="ct-lbl">Colour by</span><div class="ct-tg" role="group" aria-label="Colour branches by">
        <button type="button" data-by="biome" aria-pressed="${by === 'biome'}" class="${by === 'biome' ? 'on' : ''}">Biome</button><button type="button" data-by="cause" aria-pressed="${by === 'cause'}" class="${by === 'cause' ? 'on' : ''}">Cause</button></div>
        <span class="ct-sp"></span><span class="ct-count">${nN} form${nN === 1 ? '' : 's'} · ${lay.chaos.length} of chaos</span>
        <div class="ct-zoom" role="group" aria-label="Zoom"><button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="out" aria-label="Zoom out">−</button><button type="button" data-z="fit" aria-label="Fit the tree">Fit</button></div></div>
      <div class="ct-scrub"><label class="ct-lbl" for="ctAt">Time</label><button type="button" data-step="-1" aria-label="Earlier">◂</button>
        <input type="range" id="ctAt" min="0" max="13" step="1" value="13" aria-valuetext="Now">
        <button type="button" data-step="1" aria-label="Later">▸</button><button type="button" data-play aria-pressed="false">Play</button><button type="button" data-now>Now</button>
        <div class="ct-when" aria-live="polite"></div></div>
      <div class="ct-main"><div class="ct-tip" hidden></div><div class="ct-stage" tabindex="0" aria-label="The Tree of Descent. Drag or use the arrow keys to move, + and − to zoom, 0 to fit.">
        <svg class="ct-svg" role="group" aria-label="Lineages, oldest at the top"><g class="ct-bands"></g><g class="ct-world"></g></svg>
        ${nN ? '' : '<p class="ct-empty">No lineages yet. Add a lineage step or a creature (the Creatures tab), or merge the Creature Log file from your vault.</p>'}
        </div>
        ${lay.chaos.length ? `<aside class="ct-chaos" aria-label="Creatures of chaos"><b>∞ Creatures of chaos</b><small>beside the tree: deathless, descended from nothing</small>${lay.chaos.map(c => `<button type="button" data-node="${esc(c.id)}" class="${c.id === sel ? 'on' : ''}">${esc(c.name)}</button>`).join('')}</aside>` : ''}</div>
<div class="ct-legend" aria-label="Legend"></div></div>`;
    const stage = host.querySelector('.ct-stage'), svg = host.querySelector('.ct-svg'), world = host.querySelector('.ct-world'), bandG = host.querySelector('.ct-bands');
    const paint = () => { world.innerHTML = svgTree(lay, pal, sel, at); paintWhen();
      host.querySelector('.ct-legend').innerHTML = pal.legend.map(([l, c]) => `<span><i style="border-color:${c}"></i>${esc(l)}</span>`).join('') +
        '<span class="ct-key"><i class="g"></i>living · <i class="x">✕</i>extinct · ⛓ cursed</span>'; };
    const rng = host.querySelector('#ctAt'), whenEl = host.querySelector('.ct-when');
    const paintWhen = () => { const b = lay.bands[at], ev = bandEvents(at), shownN = visibleAt(lay, at).nodes.length;
      rng.value = at; rng.setAttribute('aria-valuetext', b.label);
      whenEl.innerHTML = `<b>${esc(b.kind === 'epoch' ? 'Epoch ' + (b.i + 1) + ' · ' + b.label : b.label)}${at === 13 ? ' · now' : ''}</b> <span class="ct-dim">${shownN} of ${nN} form${nN === 1 ? '' : 's'}</span>` +
        (ev.length ? `<ul>${ev.map(e => `<li>${esc(e.title)}</li>`).join('')}</ul>` : '<span class="ct-dim"> · nothing on the timeline here yet</span>'); };
    const tipEl = host.querySelector('.ct-tip'); let hover = null;
    const whenLbl = w => { const K = C(); if (w == null) return ''; if (typeof w === 'object' && w.age) return 'Age ' + w.age + ' · ' + (K.AGES.find(a => a.id === w.age) || {}).label; if (typeof w === 'object' && w.epoch) return (K.EPOCHS.find(e => e.id === w.epoch) || {}).label || w.epoch; return causeLabel(w); };
    const placeTip = () => { const id = hover || sel, n = id && lay.nodes.find(x => x.id === id), vis = n && visibleAt(lay, at).nodes.includes(n);
      if (!n || !vis) { tipEl.hidden = true; return; }
      const pinned = !hover || hover === sel, cb = n.cause ? bandOf(n.cause) : null;
      tipEl.innerHTML = `<b>${esc(n.name)}</b><span class="ct-dim">${n.fork ? 'a fork, ' + n.forks + ' branches · ' : ''}${esc(whenLbl(n.whenRaw))}${n.extinct ? ' → extinct ' + esc(whenLbl(n.extRaw)) : ''}</span>
        ${n.change ? `<p>${esc(n.change)}</p>` : '<p class="ct-dim">What changed is not written yet.</p>'}${n.gain ? `<p class="ct-gain">Gained: ${esc(n.gain)}</p>` : ''}
        <p class="ct-cause">Cause: ${n.cause ? esc(causeLabel(n.cause)) : '<span class="ct-dim">none yet</span>'}${pinned && cb != null ? ` <button type="button" data-cause="${cb}">Show on the timeline ▸</button>` : ''}</p>${n.curseId ? '<p class="ct-curse-l">⛓ a curse came with this change</p>' : ''}`;
      tipEl.classList.toggle('pin', pinned); tipEl.hidden = false;
      const w = stage.clientWidth, sx = n.x * view.k + view.tx, sy = n.y * view.k + view.ty, tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
      tipEl.style.left = Math.max(6, Math.min(w - tw - 6, sx + 18)) + 'px'; tipEl.style.top = Math.max(6, Math.min(stage.clientHeight - th - 6, sy - th / 2)) + 'px'; };
    const apply = () => { const w = stage.clientWidth || 600; world.setAttribute('transform', `translate(${view.tx} ${view.ty}) scale(${view.k})`); bandG.innerHTML = bandsSvg(lay, w, view.k, view.ty, at === 13 ? null : at); placeTip(); };
    let timer = null; const stopPlay = () => { if (timer) { clearInterval(timer); timer = null; } const pb = host.querySelector('[data-play]'); if (pb) { pb.setAttribute('aria-pressed', 'false'); pb.textContent = 'Play'; } };
    const setAt = v => { at = Math.max(0, Math.min(13, v)); paint(); apply(); if (sel && !visibleAt(lay, at).nodes.some(n => n.id === sel) && lay.nodes.some(n => n.id === sel)) select(null); };
    const play = () => { if (timer) return stopPlay(); const pb = host.querySelector('[data-play]'); pb.setAttribute('aria-pressed', 'true'); pb.textContent = 'Stop'; if (at >= 13) setAt(0);
      timer = setInterval(() => { if (at >= 13) return stopPlay(); setAt(at + 1); }, 900); };
    rng.addEventListener('input', () => { stopPlay(); setAt(parseInt(rng.value, 10)); });
    const clampK = k => Math.max(0.35, Math.min(2.5, k));
    const zoomAt = (f, cx, cy) => { const k = clampK(view.k * f), r = k / view.k; view.tx = cx - (cx - view.tx) * r; view.ty = cy - (cy - view.ty) * r; view.k = k; apply(); };
    const fit = () => { const shelf = lay.chaos.length && stage.clientWidth > 520 ? 170 : 0, w = (stage.clientWidth || 600) - shelf, h = stage.clientHeight || 500; const k = clampK(Math.min(1.2, Math.max(w / lay.width, 0.6), Math.max(h / lay.height, 0.55)));      // never so small the names blur: a wide tree pans instead
      view.k = k; view.tx = Math.max(0, (w - lay.width * k) / 2); view.ty = 0;
      if (sel) { const n = lay.nodes.find(x => x.id === sel); if (n) { const sy = n.y * k; if (sy > h - 24) view.ty = Math.max(h - lay.height * k, h / 2 - sy); const sx = n.x * k + view.tx; if (sx > w - 60 || sx < 60) view.tx = w / 2 - n.x * k; } }
      apply(); };
    paint(); fit();
    const select = id => { sel = id; hover = null; paint(); placeTip(); host.querySelectorAll('.ct-chaos [data-node]').forEach(b => b.classList.toggle('on', b.dataset.node === id)); if (opts.onSelect) opts.onSelect(id); };
    // pointer: drag to pan (a short move is a click), wheel and pinch to zoom
    const pts = new Map(); let drag = null, pinch = null, moved = false;
    const local = e => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const onDown = e => { if (e.target.closest('.ct-chaos, .ct-legend')) return; pts.set(e.pointerId, local(e)); moved = false;
      if (pts.size === 1) drag = { p: local(e), tx: view.tx, ty: view.ty };
      else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: view.k }; drag = null; } };
    const onMove = e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, local(e));
      if (pinch && pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomAt(pinch.k * (d / pinch.d) / view.k, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); moved = true; return; }
      if (!drag) return; const p = local(e), dx = p[0] - drag.p[0], dy = p[1] - drag.p[1];
      if (!moved && Math.hypot(dx, dy) < 4) return; if (!moved) { moved = true; try { stage.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } stage.classList.add('dragging'); }
      view.tx = drag.tx + dx; view.ty = drag.ty + dy; apply(); };
    const onUp = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { drag = null; stage.classList.remove('dragging'); } };
    const onWheel = e => { e.preventDefault(); const [x, y] = local(e); zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)), x, y); };
    const onClick = e => { const t = e.target.closest ? e.target : null; if (!t) return;
      const b = t.closest('[data-by]'); if (b) { by = b.dataset.by; pal = colours(lay, by, st); host.querySelectorAll('[data-by]').forEach(x => { const on = x.dataset.by === by; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); paint(); return; }
      const cs = t.closest('[data-cause]'); if (cs) { stopPlay(); setAt(parseInt(cs.dataset.cause, 10)); return; }
      const sp = t.closest('[data-step]'); if (sp) { stopPlay(); setAt(at + parseInt(sp.dataset.step, 10)); return; }
      if (t.closest('[data-play]')) { play(); return; } if (t.closest('[data-now]')) { stopPlay(); setAt(13); return; }
      const z = t.closest('[data-z]'); if (z) { const w = stage.clientWidth / 2, h = stage.clientHeight / 2; if (z.dataset.z === 'fit') fit(); else zoomAt(z.dataset.z === 'in' ? 1.25 : 0.8, w, h); return; }
      if (moved) { moved = false; return; }
      const n = t.closest('[data-node]'); if (n) select(n.dataset.node === sel && !n.closest('.ct-chaos') ? null : n.dataset.node); };
    const onKey = e => {
      const n = e.target.closest && e.target.closest('g[data-node]');
      if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(n.dataset.node); const again = world.querySelector(`[data-node="${CSS.escape(n.dataset.node)}"]`); if (again) again.focus(); return; }
      const step = 50, w = stage.clientWidth / 2, h = stage.clientHeight / 2, mv = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
      if (mv && !n) { e.preventDefault(); view.tx += mv[0]; view.ty += mv[1]; apply(); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(1.25, w, h); } else if (e.key === '-') { e.preventDefault(); zoomAt(0.8, w, h); } else if (e.key === '0') { e.preventDefault(); fit(); } };
    const nodeOf = e => { const g = e.target.closest && e.target.closest('g[data-node]'); return g ? g.dataset.node : null; };
    stage.addEventListener('pointerover', e => { if (e.pointerType === 'touch') return; const id = nodeOf(e); if (id && id !== hover) { hover = id; placeTip(); } });
    stage.addEventListener('pointerout', e => { if (nodeOf(e) && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('g[data-node]'))) { hover = null; placeTip(); } });
    stage.addEventListener('focusin', e => { const id = nodeOf(e); if (id) { hover = id; placeTip(); } }); stage.addEventListener('focusout', () => { hover = null; placeTip(); });
    stage.addEventListener('pointerdown', onDown); stage.addEventListener('pointermove', onMove); stage.addEventListener('pointerup', onUp); stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('wheel', onWheel, { passive: false }); host.addEventListener('click', onClick); stage.addEventListener('keydown', onKey);
    let touched = false; stage.addEventListener('pointerdown', () => { touched = true; }); stage.addEventListener('keydown', () => { touched = true; }); stage.addEventListener('wheel', () => { touched = true; }, { passive: true });
    const ro = global.ResizeObserver ? new ResizeObserver(() => (touched ? apply() : fit())) : null;      // refit as the page settles, until the reader moves the tree if (ro) ro.observe(stage);
    return {
      select, fit, setAt, setColour: v => { by = v === 'cause' ? 'cause' : 'biome'; pal = colours(lay, by, st); paint(); },
      reload: () => { st = C().load(); lay = layout(st); pal = colours(lay, by, st); paint(); apply(); },
      destroy: () => { stopPlay(); if (ro) ro.disconnect(); host.removeEventListener('click', onClick); }
    };
  }

  global.EpitaphCreatureTree = { layout, colours, mount, bandOf, bandList, bandEvents, visibleAt, _t: { causeLabel, BAND, THIN } };
})(typeof window !== 'undefined' ? window : globalThis);
