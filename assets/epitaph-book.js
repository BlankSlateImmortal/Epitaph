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
    book.classList.remove('wide'); delete book.dataset.view;
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
      const chs = (c.snapshots || []).filter(s => (s.inventory || []).some(e => e.itemId === itemId)).map(s => s.chapterRange || ('CH ' + (s.startChapter || '?')));
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
    gridCols = Math.max(1, Math.ceil(Math.sqrt(list.length * 1.6)));
    const content = $('#bkContent');
    content.innerHTML = list.length ? list.map((it, i) => {
      const col = i % gridCols, row = Math.floor(i / gridCols);
      const x = col * (TILE_W + GAP) + (row % 2 ? (TILE_W + GAP) / 2 : 0);
      const y = row * (TILE_H + GAP * 0.6);
      const pic = isImg(it.image) ? it.image : (isImg(it.icon) ? it.icon : '');
      const kinds = [...new Set((it.marks || []).map(m => m.kind))];
      return `<button type="button" class="bk-tile${it.id === selItem ? ' on' : ''}" data-id="${attr(it.id)}" style="left:${x}px;top:${y}px" title="${attr(it.name)}">
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
    $('#bkContent').querySelectorAll('.bk-tile').forEach(b => b.classList.toggle('on', b.dataset.id === id));
    const tile = $(`.bk-tile[data-id="${CSS.escape(id)}"]`);
    if (tile && viewport) viewport.centerOn(tile.offsetLeft + TILE_W / 2, tile.offsetTop + TILE_H / 2);
    renderItemPanel();
  }

  function libraryKeys(e) {
    const list = items();
    if (!list.length) return;
    let i = Math.max(0, list.findIndex(x => x.id === selItem));
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
    const tile = $(`.bk-tile[data-id="${CSS.escape(id)}"]`);
    if (tile && viewport) viewport.centerOn(tile.offsetLeft + TILE_W / 2, tile.offsetTop + TILE_H / 2);
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
        <div class="bk-field"><span>Marks <em>— new holders get a copy; existing holders keep theirs</em></span><div id="biMarks"></div></div>
        <label class="bk-field"><span>Note</span><textarea id="biNote" rows="2">${esc(draft.note)}</textarea></label>
        <div class="bk-field"><span>Held by</span>${held.length ? `<ul class="bk-held">${held.map(h => `<li><b>${esc(h.name)}</b> <small>${esc(h.chapters.join(' · '))}</small></li>`).join('')}</ul>` : '<p class="bk-dim">Nobody carries it yet. Add it from a character’s Inventory tab.</p>'}</div>
        <div class="bk-actions">
          <button type="button" class="slant-btn primary" id="biSave">Save</button>
          <span class="bk-saved" id="biSaved" aria-live="polite"></span>
          <span class="bk-spacer"></span>
          ${held.length ? `<span class="bk-dim">Held items can be deleted from the Atlas Library, which can reassign them.</span>` : `<button type="button" class="slant-btn danger" id="biDelete">Delete</button>`}
        </div>
      </div>`;
    itemEditor = { id: it.id, draft, base: JSON.stringify(normItem(it)), marks: EpitaphMarks.editor($('#biMarks'), draft.marks || []) };
    panel.querySelectorAll('input[type=file][data-pic]').forEach(inp => inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try { readForm(); itemEditor.draft[inp.dataset.pic] = await EpitaphMarks.readImage(f, inp.dataset.pic === 'icon' ? 200 : 700); flushItem(true); renderItemPanel(); drawLibrary(false); }
      catch (err) { showToast('That image could not be opened — try a JPEG or PNG instead.'); }
    }));
    const clr = $('#biClearPics'); if (clr) clr.addEventListener('click', () => { readForm(); itemEditor.draft.icon = ''; itemEditor.draft.image = ''; flushItem(true); renderItemPanel(); drawLibrary(false); });
    $('#biSave').addEventListener('click', () => { flushItem(true); });
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

  function normItem(d) {
    return { name: (d.name || '').trim(), desc: (d.desc || '').trim(), originPlaceId: d.originPlaceId || '', note: (d.note || '').trim(),
      icon: d.icon || '', image: d.image || '', marks: EpitaphMarks.clean(d.marks || []) };
  }
  function readForm() {
    if (!itemEditor || !$('#biName')) return;
    const d = itemEditor.draft;
    d.name = $('#biName').value; d.desc = $('#biDesc').value; d.originPlaceId = $('#biOrigin').value; d.note = $('#biNote').value;
    d.marks = itemEditor.marks.read();
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
  }
  function flash(text) { const s = $('#biSaved') || $('#bsSaved'); if (!s) return; s.textContent = text; clearTimeout(flash.t); flash.t = setTimeout(() => { if (s.isConnected) s.textContent = ''; }, 1600); }

  // ==================================================================
  // SKILLS
  // ==================================================================
  const RING = 170;
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
    $('#bkSandbox').addEventListener('keydown', (e) => {
      if (e.key === '+' || e.key === '=') viewport.zoom(1.2);
      if (e.key === '-') viewport.zoom(0.83);
      if (e.key === '0') fitAll();
      if (e.key === 'Escape' && selSkill) selectSkill(tree.nodes.get(selSkill).parentKey || '');
    });
    if (!tree.nodes.has(selSkill)) selSkill = '';
    drawSkills(true);
    renderSkillPanel();
    const chars = new Set(); tree.nodes.forEach(n => n.holders.forEach(h => chars.add(h.charId)));
    return `Opening the skill tree… ${count} skill${count === 1 ? '' : 's'} from ${chars.size} character${chars.size === 1 ? '' : 's'} (each at their current chapter).`;
  }

  function drawSkills(refit) {
    const all = [...tree.nodes.values()];
    const maxDepth = Math.max(1, ...all.map(n => n.depth));
    const R = maxDepth * RING + 90;
    const rings = Array.from({ length: maxDepth }, (_, i) => `<circle class="bk-ring" r="${(i + 1) * RING}"/>`).join('');
    const ticks = Array.from({ length: 72 }, (_, i) => { const a = i / 72 * Math.PI * 2, r1 = R - 18, r2 = R - (i % 6 ? 10 : 2); return `<line class="bk-tick" x1="${Math.cos(a) * r1}" y1="${Math.sin(a) * r1}" x2="${Math.cos(a) * r2}" y2="${Math.sin(a) * r2}"/>`; }).join('');
    const link = (n) => {
      const p = tree.nodes.get(n.parentKey || '');
      // curve bends around the centre: control point on the parent's ring at the child's angle
      const cr = p.depth * RING, cx = Math.cos(n.angle) * cr, cy = Math.sin(n.angle) * cr;
      return `<path class="bk-link-line${n.holders.some(h => h.skill.corrupted) ? ' corrupt' : ''}${isLit(n) ? ' lit' : ''}" d="M${p.x},${p.y} Q${cx},${cy} ${n.x},${n.y}"/>`;
    };
    const nodeSvg = (n) => {
      if (!n.depth) return `<g class="bk-node root${selSkill === '' ? ' on' : ''}" data-key="" tabindex="0" role="button" aria-label="Centre"><circle class="bk-halo" r="46"/><circle r="30"/><text class="bk-root-t" y="5">${esc('始')}</text></g>`;
      const lvl = Math.round(n.holders.reduce((a, h) => a + (+h.skill.level || 0), 0) / Math.max(1, n.holders.length));
      const r = 12 + Math.min(10, n.children.length * 2);
      const circ = 2 * Math.PI * (r + 5);
      const corrupt = n.holders.some(h => h.skill.corrupted);
      const flip = Math.cos(n.angle) < -0.01;
      const lx = Math.cos(n.angle) * (r + 12), ly = Math.sin(n.angle) * (r + 12);
      const deg = n.angle * 180 / Math.PI + (flip ? 180 : 0);
      return `<g class="bk-node${corrupt ? ' corrupt' : ''}${selSkill === n.key ? ' on' : ''}${n.holders.length > 1 ? ' shared' : ''}" data-key="${attr(n.key)}" transform="translate(${n.x} ${n.y})" tabindex="0" role="button" aria-label="${attr(n.name)}">
        <circle class="bk-lvl-track" r="${r + 5}"/>
        <circle class="bk-lvl" r="${r + 5}" stroke-dasharray="${(circ * Math.min(100, lvl) / 100).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90)"/>
        <circle class="bk-core" r="${r}"/>
        ${n.holders.length > 1 ? `<text class="bk-n-count" y="4">${n.holders.length}</text>` : ''}
        <g transform="translate(${lx} ${ly}) rotate(${deg})"><text class="bk-n-label" text-anchor="${flip ? 'end' : 'start'}" y="4">${esc(n.name.toUpperCase())}</text>
        <text class="bk-n-sub" text-anchor="${flip ? 'end' : 'start'}" y="17">${esc(n.holders.map(h => h.name).join(' · '))}</text></g>
      </g>`;
    };
    const svg = `<svg class="bk-tree" viewBox="${-R} ${-R} ${R * 2} ${R * 2}" width="${R * 2}" height="${R * 2}" style="left:${-R}px;top:${-R}px">
      <defs><pattern id="bkHalftone" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.3" class="bk-dot"/></pattern>
      <radialGradient id="bkFade"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <mask id="bkFadeMask"><circle r="${RING * 1.6}" fill="url(#bkFade)"/></mask></defs>
      <circle r="${RING * 1.6}" fill="url(#bkHalftone)" mask="url(#bkFadeMask)"/>
      ${rings}${ticks}
      ${all.filter(n => n.depth).map(link).join('')}
      ${all.filter(n => n.depth).map(nodeSvg).join('')}${nodeSvg(tree.root)}
      ${all.length === 1 ? `<text class="bk-n-sub" text-anchor="middle" y="80">No skills yet. Select the centre to add one.</text>` : ''}
    </svg>`;
    $('#bkContent').innerHTML = svg;
    $('#bkContent').querySelectorAll('.bk-node').forEach(g => {
      g.addEventListener('click', () => selectSkill(g.dataset.key));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSkill(g.dataset.key); } });
    });
    lastBox = { x: -R, y: -R, w: R * 2, h: R * 2 };
    if (refit) requestAnimationFrame(fitAll);
  }
  // lit = on the path from the centre to the selected node
  function isLit(n) { return !!selSkill && (selSkill === n.key || selSkill.startsWith(n.key + '/')); }

  function selectSkill(key) {
    selSkill = key || ''; selHolder = 0;
    drawSkills(false);
    const n = tree.nodes.get(selSkill);
    if (n && viewport) viewport.centerOn(n.x, n.y);
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
