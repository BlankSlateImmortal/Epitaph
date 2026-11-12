/* Epitaph — the Book's full-spread views, opened from the book's terminal.
 *
 *   opl / open library  -> every Library item as tiles in a pan/zoom sandbox
 *                          (left page) + an editor for the selected item
 *                          (right page). Edits save to the Library.
 *   ops / open skills   -> one radial skill tree built from every
 *                          character's current chapter: a single centre,
 *                          root skills around it, children further out
 *                          (via each skill's `parent`). Same names under
 *                          the same parent merge into one node.
 *   back                -> the book's normal pages
 *
 * Loaded after index.html's main script and uses its globals: state, Lib,
 * World, getActiveSnapshot, isLocked, persistState, renderAll, escapeHtml,
 * escapeAttr, showToast, EpitaphMarks.
 */
(function () {
  'use strict';
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = s => escapeHtml(s == null ? '' : String(s));
  const attr = s => escapeAttr(s == null ? '' : String(s));
  const isImg = s => typeof s === 'string' && /^(data:image\/|https?:|blob:|assets\/|\.?\/)/.test(s);
  const pad2 = n => String(n).padStart(2, '0');

  let mode = '';            // '' | 'library' | 'skills'
  let viewport = null;      // current pan/zoom controller
  let selItem = null;       // library: selected item id
  let selSkill = '';        // skills: selected node key ('' = centre)
  let selHolder = 0;        // skills: which holder of a merged node is being edited
  let itemEditor = null;    // { id, marks: EpitaphMarks editor, draft }
  let filter = '';

  // ------------------------------------------------------------------
  // Pan / zoom: drag anywhere to pan, wheel or pinch to zoom.
  // A press that barely moves stays a click on whatever is under it.
  // ------------------------------------------------------------------
  function makeViewport(host, content, opts) {
    const t = { x: 0, y: 0, k: 1 };
    const MIN = 0.25, MAX = 3;
    const pointers = new Map();
    let moved = false, start = null, pinch = null;
    let touched = false; // set once the user pans or zooms; stops auto-fitting
    function apply() {
      content.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.k})`;
      host.style.backgroundPosition = `${t.x}px ${t.y}px`;
      host.style.backgroundSize = `${28 * t.k}px ${28 * t.k}px`;
      if (opts && opts.onChange) opts.onChange(t);
    }
    function zoomAt(px, py, factor) {
      const k = Math.min(MAX, Math.max(MIN, t.k * factor));
      const f = k / t.k;
      t.x = px - (px - t.x) * f; t.y = py - (py - t.y) * f; t.k = k;
      apply();
    }
    function local(e) { const r = host.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    host.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.target.closest('input, textarea, select, .bk-no-pan')) return;
      pointers.set(e.pointerId, local(e));
      if (pointers.size === 1) { moved = false; start = { ...local(e), x0: t.x, y0: t.y }; }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: t.k };
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      const p = local(e); pointers.set(e.pointerId, p);
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.k * d / pinch.d) / t.k);
        moved = true; touched = true; return;
      }
      if (!start) return;
      const dx = p.x - start.x, dy = p.y - start.y;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      moved = true; touched = true; host.classList.add('panning');
      t.x = start.x0 + dx; t.y = start.y0 + dy; apply();
    });
    const end = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!pointers.size) { start = null; host.classList.remove('panning'); }
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    // a drag must not also count as a click on the tile it started on
    host.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    host.addEventListener('wheel', (e) => {
      e.preventDefault(); touched = true;
      const p = local(e);
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    // the book grows after the view opens: keep fitting until the user takes over
    let lastFit = null;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (!touched && lastFit) api.fit(lastFit.box, lastFit.m, true); }) : null;
    if (ro) ro.observe(host);
    const api = {
      t,
      get touched() { return touched; },
      stop() { if (ro) ro.disconnect(); },
      fit(box, margin, auto) {
        if (!auto) touched = false;
        lastFit = { box, m: margin };
        const m = margin == null ? 40 : margin;
        const w = host.clientWidth, h = host.clientHeight;
        if (!w || !h || !box.w || !box.h) return;
        t.k = Math.min(MAX, Math.max(MIN, Math.min((w - m * 2) / box.w, (h - m * 2) / box.h, 1.2)));
        t.x = (w - box.w * t.k) / 2 - box.x * t.k;
        t.y = (h - box.h * t.k) / 2 - box.y * t.k;
        apply();
      },
      centerOn(x, y) {
        if (!touched) return; // still auto-fitting: everything is already in view
        const w = host.clientWidth, h = host.clientHeight;
        const sx = x * t.k + t.x, sy = y * t.k + t.y;
        if (sx > 60 && sx < w - 60 && sy > 60 && sy < h - 60) return; // already in view
        t.x = w / 2 - x * t.k; t.y = h / 2 - y * t.k; apply();
      },
      // Camera move: glide so (x, y) ends up in the middle. The view travels
      // toward whatever was picked, so the board slides the opposite way.
      glideTo(x, y) {
        const w = host.clientWidth, h = host.clientHeight;
        if (!w || !h) return;
        touched = true;
        const fx = t.x, fy = t.y, tx = w / 2 - x * t.k, ty = h / 2 - y * t.k;
        cancelAnimationFrame(api._glide);
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) { t.x = tx; t.y = ty; apply(); return; }
        const t0 = performance.now(), dur = 520, ease = q => q < .5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
        const tick = (now) => { const q = Math.min(1, (now - t0) / dur), e = ease(q); t.x = fx + (tx - fx) * e; t.y = fy + (ty - fy) * e; apply(); if (q < 1) api._glide = requestAnimationFrame(tick); };
        api._glide = requestAnimationFrame(tick);
      },
      zoom(f) { touched = true; zoomAt(host.clientWidth / 2, host.clientHeight / 2, f); },
      apply
    };
    return api;
  }

  // ------------------------------------------------------------------
  // Spread shell: widens the book and swaps both pages' content.
  // ------------------------------------------------------------------
  function shell(kind, title, jp, count) {
    const book = $('#theBook');
    book.classList.add('wide');
    book.dataset.view = kind;
    const left = $('.book-page.left-page');
    left.classList.add('bk-left');
    left.innerHTML = `
      <div class="bk-head">
        <div class="bk-title"><span class="bk-idx">${pad2(count)}</span><div><b>${esc(title)}</b><small>&gt;&gt;&gt;&gt;&gt;&gt;&gt; ${kind === 'library' ? 'drag to move · scroll to zoom · arrows to step' : 'drag to move · scroll to zoom · click a node'}</small></div></div>
        <div class="bk-tools">
          ${kind === 'library' ? `<input type="search" id="bkFilter" class="bk-filter" placeholder="filter…" value="${attr(filter)}" aria-label="Filter items">
          <button type="button" class="slant-btn primary" id="bkNewItem">+ New item</button>` : ''}
          ${kind === 'library' ? `<label class="bk-skin"><span>Look</span><select id="bkLook" aria-label="Library look">${Object.keys(LIB_LOOKS).map(k => `<option value="${k}"${k === libLook ? ' selected' : ''}>${esc(LIB_LOOKS[k])}</option>`).join('')}</select></label>` : ''}
          ${kind === 'skills' ? `<label class="bk-skin"><span>Look</span><select id="bkSkin" aria-label="Skill tree look">${Object.keys(SKINS).map(k => `<option value="${k}"${k === skin ? ' selected' : ''}>${esc(SKINS[k].label)}</option>`).join('')}</select></label>` : ''}
          <button type="button" class="slant-btn" id="bkFit" title="Fit everything in view">Fit</button>
          <button type="button" class="slant-btn" id="bkBack" title="Back to the storybook (or type back)">Back</button>
        </div>
      </div>
      <div class="bk-sandbox" id="bkSandbox" tabindex="0" aria-label="${attr(title)} sandbox">
        <div class="bk-jp" aria-hidden="true">${esc(jp)}</div>
        <div class="bk-content" id="bkContent"></div>
        <div class="bk-zoom"><button type="button" class="bk-no-pan" id="bkZoomIn" aria-label="Zoom in">+</button><button type="button" class="bk-no-pan" id="bkZoomOut" aria-label="Zoom out">−</button></div>
      </div>`;
    $('#bookPanel').hidden = false;
    $('#bkBack').addEventListener('click', () => closeView(true));
    $('#bkFit').addEventListener('click', () => fitAll());
    if ($('#bkLook')) $('#bkLook').addEventListener('change', (e) => setLibLook(e.target.value));
    if ($('#bkSkin')) $('#bkSkin').addEventListener('change', (e) => setSkin(e.target.value));
    $('#bkZoomIn').addEventListener('click', () => viewport && viewport.zoom(1.25));
    $('#bkZoomOut').addEventListener('click', () => viewport && viewport.zoom(0.8));
    if (viewport) viewport.stop();
    viewport = makeViewport($('#bkSandbox'), $('#bkContent'));
  }
  let lastBox = null;
  function fitAll() { if (viewport && lastBox) viewport.fit(lastBox); }

  function closeView(restore) {
    flushItem();
    if (viewport) viewport.stop();
    mode = ''; viewport = null; itemEditor = null;
    const book = $('#theBook');
    book.classList.remove('wide'); delete book.dataset.view; delete book.dataset.skin; delete book.dataset.look; cancelAnimationFrame(webAnim); webPos.clear();
    const left = $('.book-page.left-page');
    left.classList.remove('bk-left');
    $('#bookPanel').hidden = true; $('#bookPanel').innerHTML = '';
    if (restore && typeof restoreLeftPage === 'function') restoreLeftPage();
    const inp = $('#terminalInput'); if (inp) inp.focus();
  }

  // ==================================================================
  // LIBRARY
  // ==================================================================
  const TILE_W = 132, TILE_H = 150, GAP = 26;
  function items() {
    const all = Lib ? Lib.get().items.slice() : [];
    all.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const f = filter.trim().toLowerCase();
    return f ? all.filter(i => (i.name + ' ' + i.desc + ' ' + i.note).toLowerCase().includes(f)) : all;
  }
  let gridCols = 1;
  function heldBy(itemId) {
    const out = [];
    state.characters.forEach(c => {
      const it = Lib.item(itemId);
      const chs = [];
      (c.snapshots || []).forEach(s => (s.inventory || []).filter(e => e.itemId === itemId).forEach(e => {
        const st = Lib.stateOf(it, e.stateId);
        chs.push((s.chapterRange || ('CH ' + (s.startChapter || '?'))) + (st ? ' (' + st.name + ')' : ''));
      }));
      if (chs.length) out.push({ name: c.name || 'Unnamed', chapters: chs });
    });
    return out;
  }
  function placeName(id) {
    const p = id && World ? World.place(id) : null;
    if (!p) return id ? 'a deleted place' : '';
    const c = p.countryId && World.country ? World.country(p.countryId) : null;
    return p.name + (c ? ', ' + c.name : '');
  }

  // ------------------------------------------------------------------
  // Library looks: Tiles (the original grid), Holder web (characters with
  // their items around them, a chapter scrubber and an item log) and
  // Relic vault (each item in a lit glass case). Remembered per browser.
  // ------------------------------------------------------------------
  const LIB_LOOKS = { tiles: 'Tiles', web: 'Holder web', vault: 'Relic vault' };
  const LIB_LOOK_KEY = 'epitaph-library-look';
  let libLook = 'web';
  try { const v = localStorage.getItem(LIB_LOOK_KEY); if (LIB_LOOKS[v]) libLook = v; } catch (e) { /* storage blocked: default look */ }
  function setLibLook(v) {
    if (!LIB_LOOKS[v]) return;
    libLook = v;
    try { localStorage.setItem(LIB_LOOK_KEY, v); } catch (e) { /* not remembered, still applied */ }
    if (mode === 'library') { $('#theBook').dataset.look = libLook; webPos.clear(); drawLibrary(true); }
  }
  const MARK_ORDER = ['curse', 'binding', 'blessing'];
  function itemMarkKinds(it, stateId) {
    const st = Lib.stateOf(it, stateId);
    return [...new Set([...(it.marks || []), ...((st && st.marks) || [])].map(m => m.kind))];
  }
  const markClass = kinds => MARK_ORDER.find(k => kinds.includes(k)) || '';
  const itemPic = (it, stateId) => { const st = Lib.stateOf(it, stateId); return [st && st.image, it.image, it.icon].find(isImg) || ''; };
  const itemInitial = it => esc((it.name || '?').trim().charAt(0).toUpperCase() || '◈');
  function clearLibExtras() { ['#bkScrub', '#bkItemLog'].forEach(s => { const el = $(s); if (el) el.remove(); }); cancelAnimationFrame(webAnim); }

  // ---- shared chapter helpers ----
  function libChapters() {
    const set = new Set();
    state.characters.forEach(c => (c.snapshots || []).forEach(s => { if (Number.isInteger(s.startChapter)) set.add(s.startChapter); }));
    return [...set].sort((a, b) => a - b);
  }
  const snapAt = (c, n) => n == null ? getActiveSnapshot(c) : stateAtChapter(c, n);
  // itemId -> [{ c, snap, entry }]
  function holdersAt(n) {
    const map = new Map();
    state.characters.forEach(c => {
      const s = snapAt(c, n); if (!s) return;
      (s.inventory || []).forEach(e => { if (!e.itemId) return; if (!map.has(e.itemId)) map.set(e.itemId, []); map.get(e.itemId).push({ c, snap: s, entry: e }); });
    });
    return map;
  }
  const chNumLabel = n => n == null ? 'NOW' : (typeof chapterLabel === 'function' ? chapterLabel(n) : 'CH ' + n);
  let libCh = null; // chapter number shown by the web (null = latest)

  // ---- RELIC VAULT ----
  const CASE_W = 176, CASE_H = 236, CASE_GAP = 30;
  function drawVault(list) {
    gridCols = Math.max(1, Math.ceil(Math.sqrt(list.length * 1.3)));
    const now = holdersAt(null);
    const content = $('#bkContent');
    content.innerHTML = list.map((it, i) => {
      const x = (i % gridCols) * (CASE_W + CASE_GAP), y = Math.floor(i / gridCols) * (CASE_H + CASE_GAP);
      const hs = now.get(it.id) || [];
      const stId = hs[0] && hs[0].entry.stateId;
      const st = Lib.stateOf(it, stId);
      const kinds = itemMarkKinds(it, stId);
      const pic = itemPic(it, stId);
      return `<button type="button" class="bk-case ${markClass(kinds)}${it.id === selItem ? ' on' : ''}${hs.length ? '' : ' unheld'}" data-id="${attr(it.id)}" data-cx="${x + CASE_W / 2}" data-cy="${y + CASE_H / 2}" style="left:${x}px;top:${y}px;--d:${(i % 7) * -0.6}s" title="${attr(it.name)}">
        <span class="bk-case-glass"><span class="bk-case-light"></span>
          <span class="bk-case-obj">${pic ? `<img src="${attr(pic)}" alt="" draggable="false">` : `<b>${itemInitial(it)}</b>`}</span>
          <span class="bk-case-shadow"></span>
          ${kinds.length ? `<span class="bk-case-seals">${kinds.map(k => `<i class="${attr(k)}" title="${attr(k)}"></i>`).join('')}</span>` : ''}
        </span>
        <span class="bk-case-plinth"><span class="bk-case-no">${pad2(i + 1)}</span>
          <span class="bk-case-name">${esc(it.name || 'Untitled')}</span>
          <span class="bk-case-sub">${st ? esc(st.name) + ' · ' : ''}${hs.length ? esc(hs.map(h => h.c.name || 'Unnamed').join(' · ')) : 'in the vault'}</span></span>
      </button>`;
    }).join('');
    content.querySelectorAll('.bk-case').forEach(b => b.addEventListener('click', () => selectItem(b.dataset.id)));
    const rows = Math.ceil(list.length / gridCols);
    return { x: -10, y: -10, w: gridCols * (CASE_W + CASE_GAP) + 10, h: rows * (CASE_H + CASE_GAP) + 10 };
  }

  // ---- HOLDER WEB ----
  const webPos = new Map();   // key -> {x, y} currently drawn
  let webAnim = 0, webTargets = null;
  function webLayout(list, n) {
    const held = holdersAt(n);
    const hubs = state.characters.map(c => ({ c, snap: snapAt(c, n) })).filter(h => h.snap);
    const HR = hubs.length < 2 ? 0 : Math.max(240, hubs.length * 95);
    hubs.forEach((h, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / hubs.length; h.x = Math.cos(a) * HR; h.y = Math.sin(a) * HR; h.a = a; });
    const hubOf = new Map(hubs.map(h => [h.c.id, h]));
    const solo = new Map(), shared = [], loose = [];
    list.forEach(it => {
      const hs = (held.get(it.id) || []).filter(h => hubOf.has(h.c.id));
      if (!hs.length) loose.push(it);
      else if (hs.length === 1) { const k = hs[0].c.id; if (!solo.has(k)) solo.set(k, []); solo.get(k).push({ it, hs }); }
      else shared.push({ it, hs });
    });
    const nodes = [];
    hubs.forEach(h => {
      const mine = solo.get(h.c.id) || [];
      mine.forEach((m, i) => {
        const ring = Math.floor(i / 8), inRing = Math.min(8, mine.length - ring * 8);
        const a = (hubs.length < 2 ? -Math.PI / 2 : h.a) + (i % 8 - (inRing - 1) / 2) * (Math.PI * 1.6 / Math.max(inRing, 4));
        const r = 120 + ring * 95;
        nodes.push({ ...m, x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r });
      });
    });
    shared.forEach((m, i) => {
      const x = m.hs.reduce((a, h) => a + hubOf.get(h.c.id).x, 0) / m.hs.length, y = m.hs.reduce((a, h) => a + hubOf.get(h.c.id).y, 0) / m.hs.length;
      nodes.push({ ...m, x: x * 0.55 + (i % 3 - 1) * 70, y: y * 0.55 + Math.floor(i / 3) * 70 });
    });
    // items nobody holds rest in an arc below the circle
    const baseY = (HR || 0) + 340 + (hubs.length < 2 ? 40 : 0);
    const per = Math.max(6, Math.ceil(Math.sqrt(loose.length * 3)));
    loose.forEach((it, i) => nodes.push({ it, hs: [], loose: true, x: (i % per - (Math.min(per, loose.length) - 1) / 2) * 110, y: baseY + Math.floor(i / per) * 110 }));
    return { hubs, nodes, hubOf, looseY: loose.length ? baseY : null };
  }
  function drawWeb(list, animate) {
    const chs = libChapters();
    if (libCh != null && !chs.includes(libCh)) libCh = null;
    const n = libCh == null ? (chs.length ? chs[chs.length - 1] : null) : libCh;
    const L = webLayout(list, n);
    const content = $('#bkContent');
    // build / reuse elements so they can slide between chapters
    const keep = new Set();
    let svg = $('#bkWebLines');
    if (!svg) { content.innerHTML = '<svg id="bkWebLines" class="bk-web-lines"></svg>'; svg = $('#bkWebLines'); }
    const ensure = (key, cls, html, x, y) => {
      keep.add(key);
      let el = content.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (!el) {
        el = document.createElement(key.startsWith('i:') ? 'button' : 'div');
        if (key.startsWith('i:')) el.type = 'button';
        el.dataset.key = key; el.className = cls + ' enter'; content.appendChild(el);
        if (!webPos.has(key)) webPos.set(key, { x, y });
        el.addEventListener('animationend', () => el.classList.remove('enter'), { once: true });
      } else el.className = cls;
      el.innerHTML = html;
      return el;
    };
    const targets = new Map();
    L.hubs.forEach(h => {
      const s = h.snap, pic = [s.portrait, s.systemPortrait].find(isImg);
      const gone = s.presence && s.presence !== 'alive';
      ensure('c:' + h.c.id, 'bk-hub' + (gone ? ' gone' : ''), `<span class="bk-hub-pic">${pic ? `<img src="${attr(pic)}" alt="" draggable="false">` : `<b>${esc((h.c.name || '?').charAt(0).toUpperCase())}</b>`}</span>
        <span class="bk-hub-name">${esc(h.c.name || 'Unnamed')}</span>${gone ? `<span class="bk-hub-tag">${s.presence === 'dead' ? '† DEAD' : '? MISSING'}</span>` : ''}`, h.x, h.y);
      targets.set('c:' + h.c.id, { x: h.x, y: h.y });
    });
    L.nodes.forEach(nd => {
      const it = nd.it, stId = nd.hs[0] && nd.hs[0].entry.stateId, st = Lib.stateOf(it, stId);
      const kinds = itemMarkKinds(it, stId), pic = itemPic(it, stId);
      const el = ensure('i:' + it.id, `bk-wn ${markClass(kinds)}${it.id === selItem ? ' on' : ''}${nd.loose ? ' loose' : ''}`,
        `<span class="bk-wn-pic">${pic ? `<img src="${attr(pic)}" alt="" draggable="false">` : `<b>${itemInitial(it)}</b>`}</span>
        <span class="bk-wn-name">${esc(it.name || 'Untitled')}</span>${st ? `<span class="bk-wn-state">${esc(st.name)}</span>` : ''}`, nd.x, nd.y);
      el.dataset.id = it.id; el.title = it.name || '';
      targets.set('i:' + it.id, { x: nd.x, y: nd.y });
    });
    content.querySelectorAll('[data-key]').forEach(el => { if (!keep.has(el.dataset.key)) { webPos.delete(el.dataset.key); el.remove(); } });
    content.querySelectorAll('.bk-wn').forEach(b => { if (!b._wired) { b._wired = true; b.addEventListener('click', () => selectItem(b.dataset.id)); } });
    // lines: holder -> item (gold when bound)
    const links = [];
    L.nodes.forEach(nd => nd.hs.forEach(h => links.push({ a: 'c:' + h.c.id, b: 'i:' + nd.it.id, bound: !!(h.entry.boundTo || '').trim(), on: nd.it.id === selItem })));
    webTargets = { targets, links, looseY: L.looseY };
    const paint = (pos) => {
      content.querySelectorAll('[data-key]').forEach(el => { const p = pos.get(el.dataset.key); if (p) { el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.dataset.cx = p.x; el.dataset.cy = p.y; } });
      svg.innerHTML = links.map(l => { const a = pos.get(l.a), b = pos.get(l.b); return a && b ? `<line class="bk-wl${l.bound ? ' bound' : ''}${l.on ? ' on' : ''}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>` : ''; }).join('')
        + (L.looseY != null ? `<text class="bk-wl-label" x="0" y="${L.looseY - 70}">— NOT HELD AT ${esc(chNumLabel(n).toUpperCase())} —</text>` : '');
    };
    cancelAnimationFrame(webAnim);
    const from = new Map([...targets.keys()].map(k => [k, webPos.get(k) || targets.get(k)]));
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduce) { targets.forEach((p, k) => webPos.set(k, { ...p })); paint(webPos); }
    else {
      const t0 = performance.now(), dur = 650, ease = q => q < .5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
      const tick = (now) => {
        const e = ease(Math.min(1, (now - t0) / dur));
        targets.forEach((p, k) => { const f = from.get(k); webPos.set(k, { x: f.x + (p.x - f.x) * e, y: f.y + (p.y - f.y) * e }); });
        paint(webPos);
        if (e < 1) webAnim = requestAnimationFrame(tick);
      };
      webAnim = requestAnimationFrame(tick);
    }
    drawScrub(chs, n);
    drawItemLog(chs, n);
    const pts = [...targets.values()];
    if (!pts.length) return { x: -200, y: -150, w: 400, h: 300 };
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x0 = Math.min(...xs) - 120, y0 = Math.min(...ys) - 190; // room for the chapter slider
    return { x: x0, y: y0, w: Math.max(...xs) + 120 - x0, h: Math.max(...ys) + 100 - y0 };
  }
  function drawScrub(chs, n) {
    const box = $('#bkSandbox'); if (!box) return;
    let el = $('#bkScrub');
    if (!chs.length) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'bkScrub'; el.className = 'bk-scrub bk-no-pan'; box.appendChild(el);
      el.innerHTML = `<button type="button" class="bk-scrub-step" data-d="-1" aria-label="Previous chapter">‹</button>
        <div class="bk-scrub-mid"><output class="bk-scrub-label"></output><input type="range" min="0" step="1" aria-label="Chapter"><div class="bk-scrub-ticks"></div></div>
        <button type="button" class="bk-scrub-step" data-d="1" aria-label="Next chapter">›</button>`;
      const range = el.querySelector('input');
      range.addEventListener('input', () => { libCh = libChapters()[+range.value]; redrawWeb(); });
      el.querySelectorAll('.bk-scrub-step').forEach(b => b.addEventListener('click', () => {
        const all = libChapters(), i = Math.max(0, all.indexOf(libCh == null ? all[all.length - 1] : libCh));
        const j = Math.min(all.length - 1, Math.max(0, i + +b.dataset.d)); if (j !== i) { libCh = all[j]; redrawWeb(); }
      }));
    }
    const i = Math.max(0, chs.indexOf(n));
    const range = el.querySelector('input');
    range.max = chs.length - 1; range.value = i; range.disabled = chs.length < 2;
    el.querySelector('.bk-scrub-label').textContent = chNumLabel(n);
    el.querySelector('.bk-scrub-ticks').innerHTML = chs.map(c => `<i class="${c === n ? 'on' : ''}">${c}</i>`).join('');
    el.querySelectorAll('.bk-scrub-step').forEach(b => { b.disabled = (+b.dataset.d < 0 ? i === 0 : i === chs.length - 1); });
  }
  function redrawWeb() { if (mode === 'library' && libLook === 'web') { lastBox = drawWeb(items(), true); } }
  // what happened to items chapter by chapter: acquired / lost / state / bound
  function itemEvents(itemId, chs, upTo) {
    const out = [];
    let prev = new Map();
    for (const ch of chs) {
      if (upTo != null && ch > upTo) break;
      const cur = new Map((holdersAt(ch).get(itemId) || []).map(h => [h.c.id, h]));
      const it = Lib.item(itemId);
      cur.forEach((h, id) => {
        const p = prev.get(id), st = Lib.stateOf(it, h.entry.stateId);
        if (!p) out.push({ ch, tag: 'Acquired', text: (h.c.name || 'Unnamed') + (st ? ' · ' + st.name : '') });
        else {
          if ((p.entry.stateId || '') !== (h.entry.stateId || '')) out.push({ ch, tag: 'State', text: (st ? st.name : 'no state') + ' · ' + (h.c.name || 'Unnamed') });
          if (!(p.entry.boundTo || '').trim() && (h.entry.boundTo || '').trim()) out.push({ ch, tag: 'Bound', text: 'to ' + h.entry.boundTo.trim() });
        }
      });
      prev.forEach((h, id) => { if (!cur.has(id)) out.push({ ch, tag: 'Lost', text: h.c.name || 'Unnamed', bad: true }); });
      prev = cur;
    }
    return out;
  }
  function drawItemLog(chs, n) {
    const box = $('#bkSandbox'); if (!box) return;
    let log = $('#bkItemLog');
    if (!log) { log = document.createElement('div'); log.id = 'bkItemLog'; log.className = 'bk-log'; log.setAttribute('aria-live', 'polite'); box.appendChild(log); }
    const line = (e) => `<p><i class="${e.bad ? 'bad' : ''}">◆</i><b>${esc(e.tag)}</b><span>${esc((e.ch != null ? 'CH ' + e.ch + ' · ' : '') + e.text)}</span></p>`;
    const it = selItem && Lib.item(selItem);
    let ev;
    if (it) { ev = itemEvents(it.id, chs, n).slice(-4); if (!ev.length) ev = [{ tag: 'Vault', text: (it.name || 'Untitled') + ' · nobody holds it yet' }]; }
    else ev = [{ tag: 'Hint', text: 'select an item to see its history' }];
    log.innerHTML = ev.map(line).join('');
  }

  function openLibrary() {
    if (!Lib) return 'The Library is not available on this page.';
    flushItem();
    mode = 'library';
    const list = items();
    shell('library', 'The Library', '書庫', Lib.get().items.length);
    $('#bkFilter').addEventListener('input', (e) => { filter = e.target.value; drawLibrary(true); });
    $('#bkNewItem').addEventListener('click', newItem);
    const sb = $('#bkSandbox');
    sb.addEventListener('keydown', libraryKeys);
    if (!selItem || !Lib.item(selItem)) selItem = list[0] ? list[0].id : null;
    drawLibrary(true);
    renderItemPanel();
    return `Opening the library… ${list.length} item${list.length === 1 ? '' : 's'}.`;
  }

  function drawLibrary(refit) {
    if (!refit && viewport && !viewport.touched) refit = true;
    if (mode !== 'library') return;
    const list = items();
    $('#theBook').dataset.look = libLook;
    if (libLook !== 'tiles' && list.length) {
      if (libLook !== 'web') { clearLibExtras(); webPos.clear(); }
      lastBox = libLook === 'web' ? drawWeb(list, !refit) : drawVault(list);
      if (refit) requestAnimationFrame(fitAll);
      return;
    }
    clearLibExtras(); webPos.clear();
    gridCols = Math.max(1, Math.ceil(Math.sqrt(list.length * 1.6)));
    const content = $('#bkContent');
    content.innerHTML = list.length ? list.map((it, i) => {
      const col = i % gridCols, row = Math.floor(i / gridCols);
      const x = col * (TILE_W + GAP) + (row % 2 ? (TILE_W + GAP) / 2 : 0);
      const y = row * (TILE_H + GAP * 0.6);
      const pic = isImg(it.image) ? it.image : (isImg(it.icon) ? it.icon : '');
      const kinds = [...new Set((it.marks || []).map(m => m.kind))];
      return `<button type="button" class="bk-tile${it.id === selItem ? ' on' : ''}" data-id="${attr(it.id)}" data-cx="${x + TILE_W / 2}" data-cy="${y + TILE_H / 2}" style="left:${x}px;top:${y}px" title="${attr(it.name)}">
        <span class="bk-tile-no">${pad2(i + 1)}</span>
        <span class="bk-tile-pic">${pic ? `<img src="${attr(pic)}" alt="" draggable="false">` : `<b>${esc((it.name || '?').trim().charAt(0).toUpperCase() || '◈')}</b>`}</span>
        <span class="bk-tile-name">${esc(it.name || 'Untitled')}</span>
        ${kinds.length ? `<span class="bk-tile-marks">${kinds.map(k => `<i class="mk ${attr(k)}">${{ blessing: 'BLS', curse: 'CRS', binding: 'BND' }[k] || ''}</i>`).join('')}</span>` : ''}
      </button>`;
    }).join('') : `<p class="bk-empty">${filter ? 'No items match that filter.' : 'The Library is empty. Use + New item.'}</p>`;
    content.querySelectorAll('.bk-tile').forEach(b => b.addEventListener('click', () => selectItem(b.dataset.id)));
    const rows = Math.ceil(list.length / gridCols);
    lastBox = { x: 0, y: 0, w: gridCols * (TILE_W + GAP) + (rows > 1 ? (TILE_W + GAP) / 2 : 0), h: rows * (TILE_H + GAP * 0.6) };
    if (refit) requestAnimationFrame(fitAll);
  }

  function selectItem(id) {
    if (id === selItem) return;
    flushItem();
    selItem = id;
    $('#bkContent').querySelectorAll('[data-id]').forEach(b => b.classList.toggle('on', b.dataset.id === id));
    const tile = $(`#bkContent [data-id="${CSS.escape(id)}"]`);
    if (tile && viewport) viewport.glideTo(+tile.dataset.cx, +tile.dataset.cy);
    renderItemPanel();
    if (libLook === 'web') redrawWeb();
  }

  function libraryKeys(e) {
    const list = items();
    if (!list.length) return;
    let i = Math.max(0, list.findIndex(x => x.id === selItem));
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (dir && libLook === 'web') {
      e.preventDefault();
      const els = [...$('#bkContent').querySelectorAll('.bk-wn')], cur = els.find(b => b.dataset.id === selItem) || els[0];
      if (!cur) return;
      let best = null, score = -Infinity;
      els.forEach(b => { if (b === cur) return; const dx = b.dataset.cx - cur.dataset.cx, dy = b.dataset.cy - cur.dataset.cy, len = Math.hypot(dx, dy) || 1, dot = (dx * dir[0] + dy * dir[1]) / len; if (dot > 0.5 && dot * 400 - len > score) { score = dot * 400 - len; best = b; } });
      if (best) selectItem(best.dataset.id);
      return;
    }
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -gridCols, ArrowDown: gridCols }[e.key];
    if (step != null) { e.preventDefault(); i = Math.min(list.length - 1, Math.max(0, i + step)); selectItem(list[i].id); return; }
    if (e.key === '+' || e.key === '=') viewport.zoom(1.2);
    if (e.key === '-') viewport.zoom(0.83);
    if (e.key === '0') fitAll();
  }

  function newItem() {
    flushItem();
    const id = Lib.newId('item');
    const saved = Lib.update(l => l.items.push({ id, name: 'New item', desc: '', originPlaceId: '', marks: [], note: '', icon: '', image: '' }));
    if (!saved) { showToast('Could not save — browser storage may be full.', { duration: 5500 }); return; }
    filter = ''; const f = $('#bkFilter'); if (f) f.value = '';
    selItem = id;
    drawLibrary(false);
    renderItemPanel();
    const tile = $(`#bkContent [data-id="${CSS.escape(id)}"]`);
    if (tile && viewport) viewport.centerOn(+tile.dataset.cx, +tile.dataset.cy);
    const n = $('#biName'); if (n) { n.focus(); n.select(); }
  }

  function placeOptionsHtml(selected) {
    if (!World || !World.places) return '';
    const byCountry = {};
    World.places().forEach(p => { const c = (World.country(p.countryId) || {}).name || 'Elsewhere'; (byCountry[c] = byCountry[c] || []).push(p); });
    return Object.keys(byCountry).sort().map(c => `<optgroup label="${attr(c)}">${byCountry[c].sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${attr(p.id)}"${p.id === selected ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
  }

  function renderItemPanel() {
    const panel = $('#bookPanel');
    itemEditor = null;
    const it = selItem && Lib.item(selItem);
    if (!it) { panel.innerHTML = `<div class="bk-panel-empty">&gt; select an item<span class="sig-cursor"></span></div>`; return; }
    const list = items();
    const no = list.findIndex(x => x.id === it.id) + 1;
    const draft = JSON.parse(JSON.stringify(it));
    if (!isImg(draft.icon)) draft.icon = '';   // older text-symbol icons are dropped on save
    if (!isImg(draft.image)) draft.image = '';
    const held = heldBy(it.id);
    const uses = Lib.uses(it.id, state.characters);
    panel.innerHTML = `
      <div class="bk-panel-head">
        <span class="bk-big">${pad2(no || 0)}</span>
        <div><small>LIBRARY ITEM · ${no || '—'} OF ${list.length}</small><h2>${esc(it.name || 'Untitled')}</h2>${it.originPlaceId ? `<span class="from-tag">FROM ${esc(placeName(it.originPlaceId).toUpperCase())}</span>` : ''}</div>
      </div>
      <div class="bk-form">
        <div class="bk-pics">
          <label class="bk-pic" title="Icon (small, used on tiles)">${draft.icon ? `<img src="${attr(draft.icon)}" alt="">` : '<span>+ ICON</span>'}<input type="file" accept="image/*" data-pic="icon"></label>
          <label class="bk-pic large" title="Photo (larger)">${draft.image ? `<img src="${attr(draft.image)}" alt="">` : '<span>+ PHOTO</span>'}<input type="file" accept="image/*" data-pic="image"></label>
          ${draft.icon || draft.image ? '<button type="button" class="bk-link" id="biClearPics">Remove pictures</button>' : ''}
        </div>
        <label class="bk-field"><span>Name</span><input type="text" id="biName" value="${attr(draft.name)}"></label>
        <label class="bk-field"><span>Description</span><textarea id="biDesc" rows="3">${esc(draft.desc)}</textarea></label>
        <label class="bk-field"><span>Where it came from</span><select id="biOrigin"><option value="">— unknown —</option>${placeOptionsHtml(draft.originPlaceId)}</select></label>
        <div class="bk-field"><span>Marks <em>— in every state; new holders get a copy, existing holders keep theirs</em></span><div id="biMarks"></div></div>
        <div class="bk-field"><span>States <em>— e.g. Locked, then Weakened; each chapter picks one in its Inventory</em></span>${(draft.states || []).length ? EpitaphStates.trackHtml(draft, uses) : ''}<div id="biStates"></div></div>
        <label class="bk-field"><span>Note</span><textarea id="biNote" rows="2">${esc(draft.note)}</textarea></label>
        <div class="bk-field"><span>Held by</span>${held.length ? `<ul class="bk-held">${held.map(h => `<li><b>${esc(h.name)}</b> <small>${esc(h.chapters.join(' · '))}</small></li>`).join('')}</ul>` : '<p class="bk-dim">Nobody carries it yet. Add it from a character’s Inventory tab.</p>'}</div>
        <div class="bk-actions">
          <button type="button" class="slant-btn primary" id="biSave">Save</button>
          ${Lib.get().items.length > 1 ? '<button type="button" class="slant-btn" id="biFold" title="Make this item a state of another item">Fold into…</button>' : ''}
          <span class="bk-saved" id="biSaved" aria-live="polite"></span>
          <span class="bk-spacer"></span>
          ${held.length ? `<span class="bk-dim">Held items can be deleted from the Atlas Library, which can reassign them.</span>` : `<button type="button" class="slant-btn danger" id="biDelete">Delete</button>`}
        </div>
      </div>`;
    itemEditor = { id: it.id, draft, base: JSON.stringify(normItem(it)), marks: EpitaphMarks.editor($('#biMarks'), draft.marks || []),
      states: EpitaphStates.editor($('#biStates'), draft.states || [], uses) };
    panel.querySelectorAll('input[type=file][data-pic]').forEach(inp => inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try { readForm(); itemEditor.draft[inp.dataset.pic] = await EpitaphMarks.readImage(f, inp.dataset.pic === 'icon' ? 200 : 700); flushItem(true); renderItemPanel(); drawLibrary(false); }
      catch (err) { showToast('That image could not be opened — try a JPEG or PNG instead.'); }
    }));
    const clr = $('#biClearPics'); if (clr) clr.addEventListener('click', () => { readForm(); itemEditor.draft.icon = ''; itemEditor.draft.image = ''; flushItem(true); renderItemPanel(); drawLibrary(false); });
    // after a save, redraw so the state track and holders reflect it
    $('#biSave').addEventListener('click', () => { if (flushItem(true)) { renderItemPanel(); flash('Saved'); } });
    const fold = $('#biFold'); if (fold) fold.addEventListener('click', () => { flushItem(); openFold(it.id); });
    const del = $('#biDelete');
    if (del) del.addEventListener('click', () => {
      if (del.dataset.armed) {
        const id = it.id;
        if (!Lib.update(l => { l.items = l.items.filter(x => x.id !== id); })) { showToast('Could not delete — browser storage may be full.'); return; }
        itemEditor = null; selItem = null;
        const rest = items(); selItem = rest[0] ? rest[0].id : null;
        drawLibrary(false); renderItemPanel();
        return;
      }
      del.dataset.armed = '1'; del.textContent = 'Confirm delete';
      setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = 'Delete'; } }, 4000);
    });
    // keep the header and tile label in step with the name as you type
    $('#biName').addEventListener('input', (e) => { const h = panel.querySelector('.bk-panel-head h2'); if (h) h.textContent = e.target.value || 'Untitled'; });
  }

  // ------------------------------------------------------------------
  // FOLD: make one Library item a state of another. "Seal (Weakened)"
  // folded into "Seal (locked)" -> one item "Seal" with states Locked and
  // Weakened; every chapter that held either is relinked, nothing is lost.
  // ------------------------------------------------------------------
  const baseName = n => (n || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  const paren = n => { const m = (n || '').match(/\(([^)]*)\)\s*$/); const t = m ? m[1].trim() : ''; return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; };
  function eachEntry(fn) { state.characters.forEach(c => (c.snapshots || []).forEach(s => (s.inventory || []).forEach(e => fn(e, c, s)))); }
  const chLabel = s => s.chapterRange || ('CH ' + (s.startChapter || '?'));

  function openFold(srcId) {
    const src = Lib.item(srcId); if (!src) return;
    const others = Lib.get().items.filter(i => i.id !== srcId).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const guess = others.find(i => baseName(i.name).toLowerCase() === baseName(src.name).toLowerCase()) || others[0];
    const free = [];
    eachEntry((e, c, s) => { if (!e.itemId && (e.name || '').trim().toLowerCase() === (src.name || '').trim().toLowerCase()) free.push({ e, c, s }); });
    const panel = $('#bookPanel');
    panel.innerHTML = `
      <div class="bk-panel-head"><span class="bk-big">⇢</span><div><small>FOLD INTO ANOTHER ITEM</small><h2>${esc(src.name || 'Untitled')}</h2></div></div>
      <div class="bk-form">
        <p class="bk-dim">This item becomes a <b>state</b> of the item you pick. Its description, marks and picture move into that state, every chapter holding it is relinked, and this Library entry is removed.</p>
        <label class="bk-field"><span>Fold into</span><select id="bfInto">${others.map(i => `<option value="${attr(i.id)}"${i === guess ? ' selected' : ''}>${esc(i.name || 'Untitled')}</option>`).join('')}</select></label>
        <label class="bk-field"><span>This item becomes the state</span><input type="text" id="bfState" value="${attr(paren(src.name) || src.name || 'New state')}"></label>
        <label class="bk-field" id="bfTgtWrap"><span>The other item's current form becomes the state <em>— it has no states yet; its holders get this one</em></span><input type="text" id="bfTgtState"></label>
        <label class="bk-field"><span>Name of the combined item</span><input type="text" id="bfName"></label>
        ${free.length ? `<div class="bk-field"><span>Typed-in entries with the same name <em>— relink them too</em></span>${free.map((f, i) => `<label class="bk-check"><input type="checkbox" data-free="${i}" checked> ${esc(f.c.name || 'Unnamed')} · ${esc(chLabel(f.s))}${(f.e.desc || '').trim() && !(src.desc || '').includes((f.e.desc || '').trim()) ? ' <em>(its description moves to the chapter note)</em>' : ''}</label>`).join('')}</div>` : ''}
        <div class="bk-field"><span>What will happen</span><ul class="bk-plan" id="bfPlan"></ul></div>
        <p class="bk-dim" id="bfMsg" role="alert"></p>
        <div class="bk-actions">
          <button type="button" class="slant-btn primary" id="bfGo">Fold</button>
          <button type="button" class="slant-btn" id="bfCancel">Cancel</button>
        </div>
      </div>`;
    itemEditor = null;
    const into = $('#bfInto'), stateIn = $('#bfState'), tgtIn = $('#bfTgtState'), nameIn = $('#bfName');
    function syncTarget() {
      const t = Lib.item(into.value);
      $('#bfTgtWrap').hidden = !!(t && t.states.length);
      tgtIn.value = t ? (paren(t.name) || 'Original') : '';
      nameIn.value = t ? (baseName(t.name) || t.name) : '';
      plan();
    }
    function readPlan() {
      const t = Lib.item(into.value);
      const picked = free.filter((f, i) => { const cb = panel.querySelector(`[data-free="${i}"]`); return cb && cb.checked; });
      const srcRows = [], tgtRows = [];
      eachEntry((e, c, s) => { if (e.itemId === src.id) srcRows.push({ e, c, s }); if (t && e.itemId === t.id && !e.stateId) tgtRows.push({ e, c, s }); });
      return { t, picked, srcRows, tgtRows, stateName: stateIn.value.trim() || 'New state', tgtState: tgtIn.value.trim() || 'Original', name: nameIn.value.trim() || (t && t.name) || 'Untitled' };
    }
    function plan() {
      const P = readPlan(); if (!P.t) return;
      const rows = [];
      if (P.name !== P.t.name) rows.push(`Rename “${P.t.name}” to “${P.name}”.`);
      if (!P.t.states.length) rows.push(`Add state <b>${esc(P.tgtState)}</b> (01) to it${P.tgtRows.length ? ` and set it on ${P.tgtRows.map(r => esc((r.c.name || 'Unnamed') + ' ' + chLabel(r.s))).join(', ')}` : ''}.`);
      else if (P.tgtRows.length) rows.push(`${P.tgtRows.length} chapter${P.tgtRows.length === 1 ? '' : 's'} holding it with no state set stay unset.`);
      rows.push(`Add state <b>${esc(P.stateName)}</b> (${pad2((P.t.states.length || 1) + 1)}) with this item’s description${(src.marks || []).length ? ', marks' : ''}${isImg(src.image) || isImg(src.icon) ? ' and picture' : ''}.`);
      P.srcRows.concat(P.picked).forEach(r => rows.push(`${esc(r.c.name || 'Unnamed')} ${esc(chLabel(r.s))}: ${r.e.itemId ? '' : 'typed-in entry '}→ ${esc(P.name)} · ${esc(P.stateName)}.`));
      rows.push(`Remove “${esc(src.name)}” from the Library.`);
      $('#bfPlan').innerHTML = rows.map(r => `<li>${r}</li>`).join('');
    }
    [stateIn, tgtIn, nameIn].forEach(i => i.addEventListener('input', plan));
    into.addEventListener('change', syncTarget);
    panel.querySelectorAll('[data-free]').forEach(cb => cb.addEventListener('change', plan));
    $('#bfCancel').addEventListener('click', renderItemPanel);
    $('#bfGo').addEventListener('click', () => {
      const go = $('#bfGo');
      if (!go.dataset.armed) { go.dataset.armed = '1'; go.textContent = 'Confirm fold'; setTimeout(() => { if (go.isConnected) { delete go.dataset.armed; go.textContent = 'Fold'; } }, 5000); return; }
      const msg = doFold(src, readPlan());
      if (msg) { $('#bfMsg').textContent = msg; return; }
    });
    syncTarget();
  }

  function doFold(src, P) {
    const t = P.t; if (!t) return 'Pick an item to fold into.';
    const tgtStateId = t.states.length ? '' : Lib.newId('state');
    const newState = { id: Lib.newId('state'), name: P.stateName, desc: [src.desc, src.note].map(x => (x || '').trim()).filter(Boolean).join('\n\n'),
      marks: src.marks || [], image: isImg(src.image) ? src.image : (isImg(src.icon) ? src.icon : '') };
    // 1) relink the chapters (Dossier store), keeping a copy to roll back
    const before = JSON.stringify(state);
    P.srcRows.forEach(({ e }) => { e.itemId = t.id; e.stateId = newState.id; e.name = P.name; });
    if (tgtStateId) P.tgtRows.forEach(({ e }) => { e.stateId = tgtStateId; e.name = P.name; });
    P.picked.forEach(({ e }) => {
      // its own description goes to the chapter note, unless the state already says the same
      const own = (e.desc || '').trim();
      const note = [own && !newState.desc.includes(own) ? own : '', (e.note || '').trim()].filter(Boolean).join(' — ');
      if (!newState.image && isImg(e.image)) newState.image = e.image;
      Object.keys(e).forEach(k => { if (!['id', 'marks', 'boundTo'].includes(k)) delete e[k]; });
      Object.assign(e, { itemId: t.id, stateId: newState.id, note, name: P.name });
    });
    const rollback = () => { const old = JSON.parse(before); Object.keys(state).forEach(k => delete state[k]); Object.assign(state, old); };
    persistState();
    let ok = false; try { ok = localStorage.getItem('epitaph-character-profiles') === JSON.stringify(state); } catch (err) { ok = false; }
    if (!ok) { rollback(); return 'Could not save — nothing was changed.'; }
    // 2) the Library: states on the target, rename, remove the folded item
    const saved = Lib.update(l => {
      const x = l.items.find(i => i.id === t.id); if (!x) return;
      x.name = P.name;
      x.states = (tgtStateId ? [{ id: tgtStateId, name: P.tgtState, desc: '', marks: [], image: '' }] : x.states || []).concat([newState]);
      l.items = l.items.filter(i => i.id !== src.id);
    });
    if (!saved) { rollback(); persistState(); return 'Could not save the Library — nothing was changed.'; }
    selItem = t.id;
    if (typeof renderAll === 'function') renderAll();
    openLibrary();   // redraws the board and the item count
    flash(`Folded into ${P.name}`);
    return '';
  }

  function normItem(d) {
    return { name: (d.name || '').trim(), desc: (d.desc || '').trim(), originPlaceId: d.originPlaceId || '', note: (d.note || '').trim(),
      icon: d.icon || '', image: d.image || '', marks: EpitaphMarks.clean(d.marks || []),
      states: (d.states || []).map(st => ({ id: st.id, name: (st.name || '').trim(), desc: (st.desc || '').trim(), image: st.image || '', marks: EpitaphMarks.clean(st.marks || []) })) };
  }
  function readForm() {
    if (!itemEditor || !$('#biName')) return;
    const d = itemEditor.draft;
    d.name = $('#biName').value; d.desc = $('#biDesc').value; d.originPlaceId = $('#biOrigin').value; d.note = $('#biNote').value;
    d.marks = itemEditor.marks.read();
    d.states = itemEditor.states.read();
  }
  // Saves the open item if anything changed. Called on Save, on switching
  // item, on leaving the view and when the book closes.
  function flushItem(announce) {
    if (!itemEditor || !Lib) return;
    readForm();
    const next = normItem(itemEditor.draft);
    if (!next.name) next.name = 'Untitled';
    const json = JSON.stringify(next);
    if (json === itemEditor.base) { if (announce) flash('No changes'); return; }
    const id = itemEditor.id;
    const saved = Lib.update(l => { const x = l.items.find(i => i.id === id); if (x) Object.assign(x, next); });
    if (!saved) { showToast('Could not save — browser storage may be full.', { duration: 5500 }); return; }
    itemEditor.base = json;
    if (typeof renderAll === 'function') renderAll();
    if (mode === 'library') { const sel = selItem; drawLibrary(false); selItem = sel; }
    if (announce) flash('Saved');
    return true;
  }
  function flash(text) { const s = $('#biSaved') || $('#bsSaved'); if (!s) return; s.textContent = text; clearTimeout(flash.t); flash.t = setTimeout(() => { if (s.isConnected) s.textContent = ''; }, 1600); }

  // ==================================================================
  // SKILLS
  // ==================================================================
  const RING = 210;
  function buildSkillTree() {
    const root = { key: '', name: 'EPITAPH', children: [], holders: [], depth: 0 };
    const nodes = new Map([['', root]]);
    state.characters.forEach(c => {
      const snap = getActiveSnapshot(c);
      if (!snap) return;
      const skills = snap.skills || [];
      const byName = new Map(skills.map((s, i) => [(s.name || '').trim().toLowerCase(), i]));
      const keyOf = new Map();
      function pathKey(i, seen) {
        if (keyOf.has(i)) return keyOf.get(i);
        const s = skills[i];
        const nm = (s.name || '').trim().toLowerCase() || '(unnamed ' + i + ')';
        const pIdx = byName.get((s.parent || '').trim().toLowerCase());
        let parentKey = '';
        if (s.parent && pIdx != null && pIdx !== i && !seen.has(pIdx)) { seen.add(i); parentKey = pathKey(pIdx, seen); }
        const k = parentKey + '/' + nm;
        keyOf.set(i, k);
        if (!nodes.has(k)) {
          const parent = nodes.get(parentKey);
          const n = { key: k, name: (s.name || '').trim() || 'Unnamed', children: [], holders: [], depth: parent.depth + 1, parentKey };
          nodes.set(k, n); parent.children.push(n);
        }
        return k;
      }
      skills.forEach((s, i) => {
        const k = pathKey(i, new Set());
        nodes.get(k).holders.push({ charId: c.id, name: c.name || 'Unnamed', snapId: snap.id, idx: i, skill: s, locked: isLocked(snap), chapter: snap.chapterRange || '' });
      });
    });
    // radial layout: each subtree gets an angle span in proportion to its leaves
    const leaves = n => n.children.length ? n.children.reduce((a, ch) => a + leaves(ch), 0) : 1;
    function place(n, a0, a1) {
      const mid = (a0 + a1) / 2;
      n.angle = mid;
      n.x = Math.cos(mid) * n.depth * RING; n.y = Math.sin(mid) * n.depth * RING;
      n.children.sort((a, b) => a.name.localeCompare(b.name));
      const total = n.children.reduce((a, ch) => a + leaves(ch), 0);
      let a = a0;
      n.children.forEach(ch => { const span = (a1 - a0) * leaves(ch) / total; place(ch, a, a + span); a += span; });
    }
    place(root, -Math.PI / 2, Math.PI * 1.5);
    root.x = 0; root.y = 0;
    return { root, nodes };
  }

  let tree = null;
  function openSkills() {
    flushItem();
    mode = 'skills';
    tree = buildSkillTree();
    const count = tree.nodes.size - 1;
    shell('skills', 'Skill Tree', '技能樹', count);
    $('#theBook').dataset.skin = skin;
    $('#bkSandbox').addEventListener('keydown', (e) => {
      if (e.key === '+' || e.key === '=') viewport.zoom(1.2);
      if (e.key === '-') viewport.zoom(0.83);
      if (e.key === '0') fitAll();
      if (e.key === 'Escape' && selSkill) selectSkill(tree.nodes.get(selSkill).parentKey || '');
      // arrow keys follow the picture: the nearest skill in that direction
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d) return;
      e.preventDefault();
      const cur = tree.nodes.get(selSkill) || tree.root;
      let best = null, score = -Infinity;
      tree.nodes.forEach(n => {
        if (n === cur) return;
        const dx = n.x - cur.x, dy = n.y - cur.y, len = Math.hypot(dx, dy) || 1, dot = (dx * d[0] + dy * d[1]) / len;
        if (dot > 0.5 && dot * 400 - len > score) { score = dot * 400 - len; best = n; }
      });
      if (best) selectSkill(best.key);
    });
    if (!tree.nodes.has(selSkill)) selSkill = '';
    drawSkills(true);
    renderSkillPanel();
    const chars = new Set(); tree.nodes.forEach(n => n.holders.forEach(h => chars.add(h.charId)));
    return `Opening the skill tree… ${count} skill${count === 1 ? '' : 's'} from ${chars.size} character${chars.size === 1 ? '' : 's'} (each at their current chapter).`;
  }

  // Drawn like an RPG skill screen (ref: Webdesign/shield hero.jpg): silver
  // medallions with notched double rings, gothic names over a small crest,
  // straight links, the selected skill enlarged and glowing in the middle.
  // Looks (A–E). Colours live in epitaph-book.css under [data-skin]; the
  // gradients and the badge shape are drawn here. Remembered per browser.
  const SKINS = {
    teal:  { label: 'A · Silver & teal', face: ['#2b2f2c', '#060707'], on: ['#4fe0b8', '#16735e', '#041a15'], bad: ['#ff7a55', '#7a2414', '#1a0604'], haze: '#3fbf9a' },
    amber: { label: 'B · Amber relic',   face: ['#2d2414', '#090603'], on: ['#ffd27a', '#a8650f', '#1c0f02'], bad: ['#ff7a55', '#7a2414', '#1a0604'], haze: '#ffb238' },
    blood: { label: 'C · Blood seal',    face: ['#2a2120', '#070404'], on: ['#ff7a55', '#8a1d10', '#1a0403'], bad: ['#c9a2ff', '#4b2a8a', '#0e0618'], haze: '#d4452b' },
    hex:   { label: 'D · Hex crests',    face: ['#2d2414', '#090603'], on: ['#ffd27a', '#a8650f', '#1c0f02'], bad: ['#ff7a55', '#7a2414', '#1a0604'], haze: '#ffb238', hex: true },
    crt:   { label: 'E · CRT terminal',  face: ['#1c1408', '#090603'], on: ['#ffd27a', '#a8650f', '#1c0f02'], bad: ['#ff7a55', '#7a2414', '#1a0604'], haze: '#ffb238', plain: true }
  };
  const SKIN_KEY = 'epitaph-skill-skin';
  let skin = 'teal';
  try { const v = localStorage.getItem(SKIN_KEY); if (SKINS[v]) skin = v; } catch (e) { /* storage blocked: default look */ }
  function setSkin(v) {
    if (!SKINS[v]) return;
    skin = v;
    try { localStorage.setItem(SKIN_KEY, v); } catch (e) { /* not remembered, still applied */ }
    if (mode === 'skills') { $('#theBook').dataset.skin = skin; drawSkills(false); }
  }
  const hexPts = (r) => Array.from({ length: 6 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 3; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r * 1.08).toFixed(1)}`; }).join(' ');
  const ring = (cls, r) => SKINS[skin].hex ? `<polygon class="${cls}" points="${hexPts(r)}"/>` : `<circle class="${cls}" r="${r}"/>`;
  const initial = s => (String(s || '?').trim().match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase();
  function medal(r) {
    const o = r + 7;
    const spikes = [0, 1, 2, 3].map(i => {
      const a = i * Math.PI / 2, c = Math.cos(a), s = Math.sin(a), px = -s, py = c;
      const p = (d, w) => `${(c * d + px * w).toFixed(1)},${(s * d + py * w).toFixed(1)}`;
      return `M${p(o - 3, 0)} L${p(o + 3, -3.2)} L${p(o + 9, 0)} L${p(o + 3, 3.2)}Z`;
    }).join(' ');
    const sk = SKINS[skin];
    if (sk.plain) return `${ring('bk-m-outer', o - 2)}${ring('bk-m-face', r)}`;
    return `${ring('bk-m-outer', o)}${sk.hex ? '' : `<path class="bk-m-spike" d="${spikes}"/>`}${ring('bk-m-face', r)}${ring('bk-m-inner', r - 4)}`;
  }
  const crest = (y) => SKINS[skin].plain ? '' : `<path class="bk-crest" transform="translate(0 ${y})" d="M-26,0 Q-15,-1 -8,-5 L-4,-4 L0,-11 L4,-4 L8,-5 Q15,-1 26,0 M-8,-5 Q0,0 8,-5 M-19,-1 Q-24,-6 -29,-4 M19,-1 Q24,-6 29,-4"/><circle class="bk-crest-dot" cx="0" cy="${y - 14}" r="1.6"/>`;

  function drawSkills(refit) {
    const all = [...tree.nodes.values()];
    const maxDepth = Math.max(1, ...all.map(n => n.depth));
    const R = maxDepth * RING + 140;
    // huge faint shield silhouettes behind the tree
    const shield = (s, rot) => { const pts = Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + i * Math.PI / 3; return `${(Math.cos(a) * s).toFixed(0)},${(Math.sin(a) * s * 1.1).toFixed(0)}`; }).join(' '); return `<polygon class="bk-shield" points="${pts}" transform="rotate(${rot})"/>`; };
    const backdrop = shield(R * 0.55, 0) + shield(R * 0.82, 30) + shield(R * 0.98, 0);
    const link = (n) => {
      const p = tree.nodes.get(n.parentKey || '');
      return `<line class="bk-link-line${n.holders.some(h => h.skill.corrupted) ? ' corrupt' : ''}${isLit(n) ? ' lit' : ''}" x1="${p.x}" y1="${p.y}" x2="${n.x}" y2="${n.y}"/>`;
    };
    const nodeSvg = (n) => {
      const on = selSkill === n.key;
      if (!n.depth) {
        const r = on ? 44 : 36;
        return `<g class="bk-node root${on ? ' on' : ''}" data-key="" tabindex="0" role="button" aria-label="Centre">
          ${on ? ring('bk-pulse', r + 16) : ''}${medal(r)}
          <text class="bk-root-t" y="2">${esc('始')}</text>
          ${crest(-r - 40)}<text class="bk-n-label" y="${-r - 18}">${SKINS[skin].plain ? 'EPITAPH' : 'Epitaph'}</text></g>`;
      }
      const lvl = Math.round(n.holders.reduce((a, h) => a + (+h.skill.level || 0), 0) / Math.max(1, n.holders.length));
      const corrupt = n.holders.some(h => h.skill.corrupted);
      const r = on ? 40 : 24 + Math.min(6, n.children.length * 2);
      const lr = r + 12, circ = 2 * Math.PI * lr;
      return `<g class="bk-node${corrupt ? ' corrupt' : ''}${on ? ' on' : ''}${lvl ? '' : ' dim'}${n.holders.length > 1 ? ' shared' : ''}" data-key="${attr(n.key)}" transform="translate(${n.x} ${n.y})" tabindex="0" role="button" aria-label="${attr(n.name)}">
        ${on ? ring('bk-pulse', r + 18) : ''}
        <circle class="bk-lvl" r="${lr}" stroke-dasharray="${(circ * Math.min(100, lvl) / 100).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90)"/>
        ${medal(r)}
        <text class="bk-n-icon" y="${(r * 0.36).toFixed(1)}" style="font-size:${Math.round(r * 1.15)}px">${esc(initial(n.name))}</text>
        ${n.holders.length > 1 ? `<g transform="translate(${(r * 0.8).toFixed(1)} ${(r * 0.8).toFixed(1)})"><circle class="bk-n-badge" r="9"/><text class="bk-n-count" y="4">${n.holders.length}</text></g>` : ''}
        ${crest(-r - (on ? 72 : 36))}
        ${on ? `<text class="bk-n-form" y="${-r - 48}">- Lv ${lvl} -</text>` : ''}
        <text class="bk-n-label" y="${-r - 16}">${esc(SKINS[skin].plain ? n.name.toUpperCase() : n.name)}</text>
        <text class="bk-n-sub" y="${r + 24}">${esc(n.holders.map(h => h.name).join(' · '))}</text>
      </g>`;
    };
    // the selected node is drawn last so its glow sits on top
    const order = all.filter(n => n.depth).concat(tree.root).sort((a, b) => (a.key === selSkill) - (b.key === selSkill));
    const svg = `<svg class="bk-tree" viewBox="${-R} ${-R} ${R * 2} ${R * 2}" width="${R * 2}" height="${R * 2}" style="left:${-R}px;top:${-R}px">
      <defs>
        ${(() => { const k = SKINS[skin], st = (c) => c.map((x, i) => `<stop offset="${[0, .55, 1][c.length === 2 ? i * 2 : i]}" stop-color="${x}"/>`).join('');
          return `<radialGradient id="bkFace" cx=".5" cy=".38" r=".7">${st(k.face)}</radialGradient>
        <radialGradient id="bkFaceOn" cx=".5" cy=".42" r=".65">${st(k.on)}</radialGradient>
        <radialGradient id="bkFaceBad" cx=".5" cy=".42" r=".65">${st(k.bad)}</radialGradient>
        <radialGradient id="bkHaze"><stop offset="0" stop-color="${k.haze}" stop-opacity=".16"/><stop offset=".6" stop-color="${k.haze}" stop-opacity=".04"/><stop offset="1" stop-color="${k.haze}" stop-opacity="0"/></radialGradient>`; })()}
      </defs>
      <circle r="${R}" fill="url(#bkHaze)"/>
      ${backdrop}
      ${all.filter(n => n.depth).map(link).join('')}
      ${order.map(nodeSvg).join('')}
      ${all.length === 1 ? `<text class="bk-n-sub" y="110">No skills yet. Select the centre to add one.</text>` : ''}
    </svg>`;
    $('#bkContent').innerHTML = svg;
    $('#bkContent').querySelectorAll('.bk-node').forEach(g => {
      g.addEventListener('click', () => selectSkill(g.dataset.key));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSkill(g.dataset.key); } });
    });
    drawSkillLog();
    // fit to the medallions and their names, not the backdrop
    const xs = all.map(n => n.x), ys = all.map(n => n.y);
    const x0 = Math.min(...xs) - 110, x1 = Math.max(...xs) + 110, y0 = Math.min(...ys) - 110, y1 = Math.max(...ys) + 70;
    lastBox = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    if (refit) requestAnimationFrame(fitAll);
  }
  // bottom-left feed, like the picture's "Absorb / Unlock" lines
  function drawSkillLog() {
    const box = $('#bkSandbox'); if (!box) return;
    let log = $('#bkSkillLog');
    if (!log) { log = document.createElement('div'); log.id = 'bkSkillLog'; log.className = 'bk-log'; log.setAttribute('aria-live', 'polite'); box.appendChild(log); }
    const n = tree.nodes.get(selSkill);
    const line = (tag, text, bad) => `<p><i class="${bad ? 'bad' : ''}">◆</i><b>${esc(tag)}</b><span>${esc(text)}</span></p>`;
    if (!n || !n.depth) {
      const learned = [...tree.nodes.values()].filter(x => x.depth && x.holders.some(h => +h.skill.level > 0)).length;
      log.innerHTML = line('Tree', `${tree.nodes.size - 1} skills · ${learned} learned`) + line('Hint', 'select a medallion');
      return;
    }
    log.innerHTML = n.holders.slice(0, 4).map(h => line(+h.skill.level > 0 ? 'Unlock' : 'Sealed', `${h.name} — ${n.name} · Lv ${+h.skill.level || 0}${h.chapter ? ' · ' + h.chapter : ''}`, h.skill.corrupted)).join('')
      + (n.children.length ? line('Branch', `${n.children.length} skill${n.children.length === 1 ? '' : 's'} grow from here`) : '');
  }
  // lit = on the path from the centre to the selected node
  function isLit(n) { return !!selSkill && (selSkill === n.key || selSkill.startsWith(n.key + '/')); }

  function selectSkill(key) {
    selSkill = key || ''; selHolder = 0;
    drawSkills(false);
    const n = tree.nodes.get(selSkill);
    if (n && viewport) viewport.glideTo(n.x, n.y);
    renderSkillPanel();
  }

  function snapOf(h) {
    const c = state.characters.find(x => x.id === h.charId);
    return c ? (c.snapshots || []).find(s => s.id === h.snapId) : null;
  }
  async function saveSkills(after) {
    await persistState();
    if (typeof renderAll === 'function') renderAll();
    tree = buildSkillTree();
    if (after) after();
    if (!tree.nodes.has(selSkill)) selSkill = '';
    drawSkills(false);
    renderSkillPanel();
  }

  function renderSkillPanel() {
    const panel = $('#bookPanel');
    const n = tree.nodes.get(selSkill) || tree.root;
    if (!n.depth) {
      const chars = state.characters.filter(c => getActiveSnapshot(c));
      const top = n.children.length;
      panel.innerHTML = `
        <div class="bk-panel-head"><span class="bk-big">${pad2(tree.nodes.size - 1)}</span><div><small>SKILL TREE · CENTRE</small><h2>All skills</h2><span class="bk-dim">${top} root branch${top === 1 ? '' : 'es'} · each character at their current chapter</span></div></div>
        <div class="bk-form">
          <p class="bk-dim">Root skills branch from the centre. A skill whose <b>parent</b> is another of the same character’s skills grows from it. When characters share a skill name under the same parent, they share one node (the number inside it).</p>
          ${chars.length ? `<div class="bk-field"><span>Add a root skill to</span><div class="bk-row"><select id="bsNewFor">${chars.map(c => `<option value="${attr(c.id)}"${isLocked(getActiveSnapshot(c)) ? ' disabled' : ''}>${esc(c.name || 'Unnamed')}${isLocked(getActiveSnapshot(c)) ? ' (locked)' : ''}</option>`).join('')}</select>
          <button type="button" class="slant-btn primary" id="bsNewRoot">+ Root skill</button></div></div>` : '<p class="bk-dim">No characters yet.</p>'}
        </div>`;
      const nb = $('#bsNewRoot');
      if (nb) nb.addEventListener('click', () => {
        const c = state.characters.find(x => x.id === $('#bsNewFor').value); const s = c && getActiveSnapshot(c);
        if (!s || isLocked(s)) return;
        s.skills = s.skills || []; const name = uniqueName(s, 'New skill');
        s.skills.push({ name, desc: '', level: 0, corrupted: false, parent: '' });
        saveSkills(() => { selSkill = '/' + name.toLowerCase(); });
      });
      return;
    }
    if (selHolder >= n.holders.length) selHolder = 0;
    const h = n.holders[selHolder];
    const sk = h.skill;
    const snap = snapOf(h);
    const others = (snap.skills || []).map((s, i) => ({ s, i })).filter(o => o.i !== h.idx && !isDescendant(snap, o.s.name, sk.name));
    const locked = h.locked;
    const dis = locked ? ' disabled' : '';
    panel.innerHTML = `
      <div class="bk-panel-head">
        <span class="bk-big">${pad2(Math.round(+sk.level || 0))}</span>
        <div><small>SKILL · DEPTH ${n.depth} · ${n.children.length} BRANCH${n.children.length === 1 ? '' : 'ES'}</small><h2>${esc(n.name)}</h2>${sk.corrupted ? '<span class="mark-tag curse">CORRUPTED</span>' : ''}</div>
      </div>
      ${n.holders.length > 1 ? `<div class="bk-holders" role="tablist">${n.holders.map((x, i) => `<button type="button" role="tab" class="${i === selHolder ? 'on' : ''}" data-h="${i}">${esc(x.name)}</button>`).join('')}</div>` : ''}
      <div class="bk-form">
        <div class="bk-whose">${esc(h.name)} · ${esc(h.chapter || 'current chapter')}${locked ? ' · <span class="bk-lock">CANON · LOCKED — reopen it in the Chapter Brief to edit</span>' : ''}</div>
        <label class="bk-field"><span>Name</span><input type="text" id="bsName" value="${attr(sk.name)}"${dis}></label>
        <label class="bk-field"><span>Description</span><textarea id="bsDesc" rows="3"${dis}>${esc(sk.desc)}</textarea></label>
        <label class="bk-field"><span>Level <em id="bsLvlOut">${Math.round(+sk.level || 0)}</em></span><input type="range" id="bsLevel" min="0" max="100" value="${+sk.level || 0}"${dis}></label>
        <label class="bk-check"><input type="checkbox" id="bsCorrupt"${sk.corrupted ? ' checked' : ''}${dis}> Corrupted</label>
        <label class="bk-field"><span>Grows from</span><select id="bsParent"${dis}><option value="">— the centre (root skill) —</option>${others.map(o => `<option value="${attr(o.s.name)}"${(sk.parent || '').toLowerCase() === (o.s.name || '').toLowerCase() ? ' selected' : ''}>${esc(o.s.name)}</option>`).join('')}</select></label>
        <div class="bk-actions">
          ${locked ? '' : `<button type="button" class="slant-btn primary" id="bsSave">Save</button>
          <button type="button" class="slant-btn" id="bsChild">+ Branch</button>
          <span class="bk-saved" id="bsSaved" aria-live="polite"></span><span class="bk-spacer"></span>
          <button type="button" class="slant-btn danger" id="bsDelete">Delete</button>`}
        </div>
      </div>`;
    panel.querySelectorAll('.bk-holders button').forEach(b => b.addEventListener('click', () => { selHolder = +b.dataset.h; renderSkillPanel(); }));
    if (locked) return;
    $('#bsLevel').addEventListener('input', (e) => { $('#bsLvlOut').textContent = e.target.value; });
    $('#bsSave').addEventListener('click', () => {
      const name = $('#bsName').value.trim() || sk.name || 'Unnamed';
      const old = sk.name;
      if (name.toLowerCase() !== (old || '').toLowerCase() && (snap.skills || []).some((s, i) => i !== h.idx && (s.name || '').toLowerCase() === name.toLowerCase())) {
        showToast(`${h.name} already has a skill called “${name}”.`); return;
      }
      const s = snap.skills[h.idx];
      s.name = name; s.desc = $('#bsDesc').value.trim(); s.level = +$('#bsLevel').value; s.corrupted = $('#bsCorrupt').checked; s.parent = $('#bsParent').value;
      // children of a renamed skill follow it
      if (old && old !== name) snap.skills.forEach(x => { if ((x.parent || '').toLowerCase() === old.toLowerCase()) x.parent = name; });
      const charId = h.charId;
      saveSkills(() => { selSkill = findKey(charId, name) || ''; selHolder = 0; const nn = tree.nodes.get(selSkill); if (nn) selHolder = Math.max(0, nn.holders.findIndex(x => x.charId === charId)); });
      setTimeout(() => flash('Saved'), 0);
    });
    $('#bsChild').addEventListener('click', () => {
      const name = uniqueName(snap, 'New skill');
      snap.skills.push({ name, desc: '', level: 0, corrupted: false, parent: sk.name });
      const charId = h.charId;
      saveSkills(() => { selSkill = findKey(charId, name) || selSkill; });
    });
    const del = $('#bsDelete');
    del.addEventListener('click', () => {
      if (!del.dataset.armed) {
        del.dataset.armed = '1'; del.textContent = 'Confirm delete';
        setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = 'Delete'; } }, 4000);
        return;
      }
      const removed = snap.skills.splice(h.idx, 1)[0];
      // its branches move up to its parent instead of floating free
      snap.skills.forEach(x => { if ((x.parent || '').toLowerCase() === (removed.name || '').toLowerCase()) x.parent = removed.parent || ''; });
      saveSkills(() => { selSkill = n.parentKey || ''; });
    });
  }
  function uniqueName(snap, base) {
    const have = new Set((snap.skills || []).map(s => (s.name || '').toLowerCase()));
    let n = base, i = 2; while (have.has(n.toLowerCase())) n = base + ' ' + i++;
    return n;
  }
  // true if `name` sits somewhere under `ancestor` in this snapshot (so it can't become its parent)
  function isDescendant(snap, name, ancestor) {
    const by = new Map((snap.skills || []).map(s => [(s.name || '').toLowerCase(), s]));
    let cur = by.get((name || '').toLowerCase()), guard = 0;
    while (cur && cur.parent && guard++ < 50) {
      if (cur.parent.toLowerCase() === (ancestor || '').toLowerCase()) return true;
      cur = by.get(cur.parent.toLowerCase());
    }
    return false;
  }
  function findKey(charId, name) {
    let hit = '';
    tree.nodes.forEach((n, k) => { if (n.holders.some(h => h.charId === charId && (h.skill.name || '').toLowerCase() === name.toLowerCase())) hit = k; });
    return hit;
  }

  // ------------------------------------------------------------------
  // Hooks for index.html
  // ------------------------------------------------------------------
  if (Lib) Lib.onChange(() => { if (mode === 'library') { drawLibrary(false); if (!itemEditor) renderItemPanel(); } });
  window.EpitaphBook = {
    openLibrary, openSkills,
    close: () => { if (mode) closeView(false); },
    back: () => { if (!mode) return 'Already on the storybook page.'; closeView(true); return 'Back to the storybook.'; },
    get mode() { return mode; }
  };
})();
