/* Epitaph — the mark library board (terminal: opmk / open mark library). Plan: docs/plans/item-system.md, step 6.5.
 *
 * Marks you define once (a blessing given to a whole people, a curse that hits many) live in the Library (`marks`). A person, an item or a
 * chapter's copy of an item holds an ordinary mark plus a link (`libId`) to its definition. This board lists the definitions, edits them, and
 * shows every copy: who holds it, in which chapter, at which curse stage, and whether it still matches the definition. "Update all copies"
 * brings the ones that drifted back in line (each copy keeps its own id and its own curse stage). Author only; never published.
 * Picking from the library and saving a mark to it happen in the mark editors themselves (EpitaphMarks.libraryPickHtml / linkHtml).
 *
 *   EpitaphMarkLib.open()   opens the board; returns a short message for the terminal. Inside the book (the usual way: opmk) it is a
 *                           DECK OF CARDS on the left page: blessings upright, curses reversed, bindings sealed with rings (one per rank).
 *                           A curse's written stages are cards stacked beneath it: click it to cycle through them or inspect the top card.
 *                           The right page is the editor. Outside the book it falls back to the wide modal.
 */
(function (global) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const Lib = () => global.EpitaphLibrary, M = () => global.EpitaphMarks;
  const canEdit = () => !(global.EpitaphMode && !global.EpitaphMode.canEdit());
  let host = null;   // the book (both pages) when the deck is open inside it; otherwise the page's modal
  const root = () => host || (typeof modalContent !== 'undefined' ? modalContent : null);
  const inBook = () => !!(host && host.id === 'theBook');
  const q = s => root().querySelector(s);
  const st = () => (typeof state !== 'undefined' ? state : null);
  const chars = () => ((st() && st().characters) || []).filter(c => c && c.id);
  let sel = '', draft = null, armed = null;
  const filter = { q: '', kind: '' };

  const defs = () => Lib().get().marks;
  const find = id => defs().find(d => d.id === id) || null;
  const holders = id => Lib().markHolders(id, chars());
  const STAGE_LABEL = ['Initial state', 'Awakening', 'Fluctuation', 'Stabilization'];

  // every live copy of a definition in the Dossier (people and chapter copies of items)
  function dossierCopies(libId) {
    const out = [];
    chars().forEach(c => (c.snapshots || []).forEach(s => {
      (s.marks || []).forEach(m => { if (m && m.libId === libId) out.push(m); });
      (s.inventory || []).forEach(e => (e.marks || []).forEach(m => { if (m && m.libId === libId) out.push(m); }));
    }));
    return out;
  }
  // every copy on a Library item or one of its states (inside Library.update, on its working clone)
  function eachLibraryCopy(l, libId, fn) {
    l.items.forEach(it => {
      (it.marks || []).forEach((m, i) => { if (m && m.libId === libId) it.marks[i] = fn(m); });
      (it.stateTracks || []).forEach(t => t.states.forEach(s => (s.marks || []).forEach((m, i) => { if (m && m.libId === libId) s.marks[i] = fn(m); })));
    });
  }
  async function persistDossier() {
    try { if (typeof persistState === 'function') await persistState(); if (typeof renderAll === 'function') renderAll(); } catch (e) { console.error(e); }
  }
  const toast = (t, ms) => { if (typeof showToast === 'function') showToast(t, { duration: ms || 4500 }); };

  const stageText = (def, n) => (def.kind === 'curse' ? `stage ${n}/3 · ${(def.stages && def.stages[n - 1] && def.stages[n - 1].name) || STAGE_LABEL[n]}` : '');
  function where(r) {
    const ch = r.chapter != null ? ' · CH ' + r.chapter : '';
    return r.where === 'character' ? `${r.who}${ch}` : r.where === 'entry' ? `${r.who}${ch} (an item they carry)` : r.where === 'item' ? `Item: ${r.who}` : `Item state: ${r.who}`;
  }

  function matches(d) {
    const w = filter.q.trim().toLowerCase();
    if (w && ![d.name, d.effect, d.source].some(t => String(t || '').toLowerCase().includes(w))) return false;
    return !filter.kind || d.kind === filter.kind;
  }
  function listHtml() {
    const all = defs(), shown = all.filter(matches);
    if (!all.length) return '<p class="sp-empty">No library marks yet. Add one, or use “Save to the library” under any mark.</p>';
    if (!shown.length) return '<p class="sp-empty">Nothing matches that filter.</p>';
    return shown.map(d => { const hs = holders(d.id), drift = hs.filter(r => M().differs(r.mark)).length;
      return `<button type="button" class="sp-card${d.id === sel ? ' on' : ''}${d.kind === 'curse' ? ' corrupted' : ''}" data-ml="${esc(d.id)}">
        <b>${esc(d.name || 'Unnamed mark')}</b>
        <small>${esc(M().LABEL[d.kind] || d.kind)} · ${hs.length} cop${hs.length === 1 ? 'y' : 'ies'}${drift ? ` · ${drift} differ` : ''}</small></button>`; }).join('');
  }
  function copiesHtml(d) {
    const hs = holders(d.id), drift = hs.filter(r => M().differs(r.mark)).length;
    if (!hs.length) return '<p class="sp-dim">No copies yet. Add it to a person or an item from the mark editors (“Add from the library”).</p>';
    return `<div class="ml-copies"><b>Copies · ${hs.length}</b>
      <ul>${hs.map(r => { const dr = M().differs(r.mark); return `<li class="${dr ? 'drift' : 'sync'}"><span>${esc(where(r))}${d.kind === 'curse' ? ' · ' + esc(stageText(d, r.stage || 0) || 'initial state') : ''}</span><small>${dr ? 'differs' : 'in sync'}</small></li>`; }).join('')}</ul>
      ${drift ? `<button type="button" class="ed-slant primary" data-ml-update>Update all copies (${drift} differ)</button><p class="sp-dim">Each copy keeps its own curse stage. Anything you changed on a copy by hand is replaced.</p>` : '<p class="sp-dim">Every copy matches the definition.</p>'}</div>`;
  }
  function editorHtml(d) {
    if (!d) return '<div class="sp-hint">&gt; pick a mark, or add one<span class="sig-cursor"></span></div>';
    return `<div class="sp-form">
      ${M().fieldsHtml(draft, { ctx: 'any', attr: f => `data-mlf="${f}"`, sigil: M().sigilPickerHtml(draft, 'data-mlimg') })}
      <div class="sp-acts"><button type="button" class="ed-slant primary" data-ml-save>Save</button><span class="sp-saved" id="mlSaved" aria-live="polite"></span><span class="sp-spacer"></span>
        <button type="button" class="ed-slant danger" data-ml-del>${armed === d.id ? 'Confirm delete' : 'Delete'}</button></div>
      ${copiesHtml(d)}</div>`;
  }
  function shell() {
    return `<div class="ed-head"><div class="ed-title"><span class="ed-crt">EPITAPH // MARK LIBRARY</span><span class="ed-sub">${defs().length} mark${defs().length === 1 ? '' : 's'} · private, not published</span></div>
      <div class="ed-acts"><button type="button" class="ed-slant ghost" data-ml-close>Close</button></div></div>
      <div class="sp-board"><div class="sp-side">
        <div class="sp-filters"><input type="search" id="mlQ" value="${esc(filter.q)}" placeholder="Search name, effect, source" aria-label="Search marks">
          <select id="mlKind" aria-label="Kind"><option value="">every kind</option>${['binding', 'blessing', 'curse'].map(k => `<option value="${k}"${filter.kind === k ? ' selected' : ''}>${esc(M().LABEL[k])}s</option>`).join('')}</select></div>
        <div class="sp-list" id="mlList">${listHtml()}</div><button type="button" class="ed-chip sp-new" data-ml-new>+ NEW MARK</button></div>
        <div class="sp-main" id="mlMain">${editorHtml(find(sel))}</div></div>`;
  }

  function sync() { if (!draft || !q('#mlMain [data-mlf]')) return; root().querySelectorAll('#mlMain [data-mlf]').forEach(el => M().setField(draft, el.dataset.mlf, el.value)); }
  function select(id) { sel = id; armed = null; const d = find(id); draft = d ? JSON.parse(JSON.stringify(d)) : null; }
  function save(announce) {
    const d = find(sel); if (!d || !draft) return true; sync();
    const next = M().clean([draft])[0];
    if (!next || !String(next.name || '').trim()) { if (announce) toast('Give the mark a name.'); return !announce; }
    next.id = d.id;
    const saved = Lib().update(l => { const i = l.marks.findIndex(x => x.id === d.id); if (i >= 0) l.marks[i] = next; });
    if (!saved) { toast('Could not save — browser storage may be full.', 5500); return false; }
    draft = JSON.parse(JSON.stringify(find(sel)));
    if (announce) { const s = q('#mlSaved'); if (s) { s.textContent = 'Saved'; setTimeout(() => { if (s.isConnected) s.textContent = ''; }, 1600); } }
    return true;
  }
  function redraw(full) {
    if (inBook()) { drawDeck(); return; }
    if (full) { root().innerHTML = shell(); wire(); return; }
    q('#mlList').innerHTML = listHtml(); q('#mlMain').innerHTML = editorHtml(find(sel)); wireList(); wireMain();
  }
  const pick = id => { if (id === sel) return; if (!save(false)) return; select(id); redraw(false); };
  function wireList() { root().querySelectorAll('[data-ml]').forEach(b => b.addEventListener('click', () => pick(b.dataset.ml))); }
  function wireMain() {
    const nm = q('#mlMain [data-mlf="name"]'); if (nm && inBook()) nm.addEventListener('input', () => {
      const v = nm.value || 'Unnamed mark'; root().querySelectorAll(`.mk-card[data-ml-card="${CSS.escape(sel)}"] .mk-name, .mk-panel-name`).forEach(el => { el.textContent = v; }); });
    const kind = q('#mlMain select[data-mlf="kind"]'); if (kind) kind.addEventListener('change', () => { sync(); redraw(false); });
    const sv = q('[data-ml-save]'); if (sv) sv.addEventListener('click', () => { if (!save(true)) return; if (inBook()) { drawDeck(); const s = q('#mlSaved'); if (s) { s.textContent = 'Saved'; setTimeout(() => { if (s.isConnected) s.textContent = ''; }, 1600); } return; } { q('#mlList').innerHTML = listHtml(); wireList(); q('#mlMain').innerHTML = editorHtml(find(sel)); wireMain(); const s = q('#mlSaved'); if (s) s.textContent = 'Saved'; } });
    const img = q('#mlMain input[type=file][data-mlimg]'); if (img) img.addEventListener('change', async () => {
      const f = img.files && img.files[0]; if (!f) return; sync();
      try { draft.image = await M().readImage(f); } catch (e) { toast('That image could not be opened — try a JPEG or PNG.'); }
      q('#mlMain').innerHTML = editorHtml(find(sel)); wireMain(); });
    const clr = q('#mlMain button[data-mlimg][data-clear]'); if (clr) clr.addEventListener('click', () => { sync(); draft.image = ''; q('#mlMain').innerHTML = editorHtml(find(sel)); wireMain(); });
    const up = q('[data-ml-update]'); if (up) up.addEventListener('click', async () => {
      if (!save(true)) return; const d = find(sel); if (!d) return;
      const live = dossierCopies(d.id).filter(m => M().differs(m)); live.forEach(m => Object.assign(m, Lib().applyDefinition(m, d)));
      let libN = 0; Lib().update(l => eachLibraryCopy(l, d.id, m => { if (M().differs(m)) libN++; return Lib().applyDefinition(m, d); }));
      await persistDossier(); toast(`Updated ${live.length + libN} cop${live.length + libN === 1 ? 'y' : 'ies'}.`); redraw(false);
    });
    const de = q('[data-ml-del]'); if (de) de.addEventListener('click', async () => {
      if (armed !== sel) { armed = sel; de.textContent = 'Confirm delete'; setTimeout(() => { if (de.isConnected && armed === sel) { armed = null; de.textContent = 'Delete'; } }, 4000); return; }
      const id = sel, n = holders(id).length;
      // the copies stay as ordinary marks: only their link goes
      dossierCopies(id).forEach(m => { delete m.libId; });
      Lib().update(l => { eachLibraryCopy(l, id, m => { const o = { ...m }; delete o.libId; return o; }); l.marks = l.marks.filter(x => x.id !== id); });
      select(''); await persistDossier(); toast(n ? `Deleted. ${n} cop${n === 1 ? 'y stays' : 'ies stay'} as ordinary marks.` : 'Deleted.'); redraw(true);
    });
  }
  function wire() {
    root().querySelectorAll('[data-ml-close]').forEach(b => b.addEventListener('click', () => { if (host && window.EpitaphBook) { EpitaphBook.back(); return; } save(false); closeModal(); }));
    const nw = q('[data-ml-new]'); if (nw) nw.addEventListener('click', () => {
      if (!save(false)) return; const d = Lib().toDefinition(M().newMark('any')); d.name = 'New mark';
      Lib().update(l => { l.marks.push(d); }); select(d.id); redraw(true); const n = q('#mlMain [data-mlf="name"]'); if (n) { n.focus(); n.select(); } });
    const bind = (id, key, ev) => { const el = q(id); if (el) el.addEventListener(ev, () => { filter[key] = el.value; q('#mlList').innerHTML = listHtml(); wireList(); }); };
    bind('#mlQ', 'q', 'input'); bind('#mlKind', 'kind', 'change');
    wireList(); wireMain();
  }

  // ==================================================================
  // THE DECK (inside the book): cards on the left page, the editor on the right page
  // ==================================================================
  const pad2 = n => String(n).padStart(2, '0');
  const KIND_ORDER = ['blessing', 'curse', 'binding'];
  const ROW = { blessing: ['BLESSINGS', 'upright'], curse: ['CURSES', 'reversed · the stages are the cards beneath'], binding: ['BINDINGS', 'sealed with rings · one ring per rank'] };
  const SYMBOL = { blessing: '☼', curse: '☾', binding: '◎' };
  const stageView = {};          // curse id -> which stage card is on top (0 = initial)
  let menuFor = '';              // the curse whose Cycle / Inspect choice is open
  // a curse's cards: the initial state, then every stage that has a name or text
  function stageCards(d) {
    if (d.kind !== 'curse') return [];
    const out = [{ n: 0, name: (d.initial && d.initial.name) || STAGE_LABEL[0], text: (d.initial && d.initial.text) || '' }];
    (d.stages || []).forEach((x, i) => { if (x && (String(x.name || '').trim() || String(x.text || '').trim())) out.push({ n: i + 1, name: x.name || STAGE_LABEL[i + 1], text: x.text || '' }); });
    return out;
  }
  function art(d) {
    return d.image ? `<img src="${esc(d.image)}" alt="">` : `<span>${esc((String(d.name || '').trim().charAt(0) || SYMBOL[d.kind] || '?').toUpperCase())}</span>`;
  }
  function cardHtml(d) {
    const cards = stageCards(d), top = Math.min(stageView[d.id] || 0, Math.max(cards.length - 1, 0)), stg = cards[top];
    const n = holders(d.id).length, rank = d.kind === 'binding' ? (d.rank || 0) : 0;
    const label = d.kind === 'curse' ? (stg && stg.n ? 'STAGE ' + stg.n : 'INITIAL') : d.kind === 'binding' ? (rank ? '◎'.repeat(Math.min(rank, 7)) + ' · RANK ' + rank : 'NO RANK') : 'BLESSING';
    const under = d.kind === 'curse' ? Math.min(cards.length - 1, 3) : 0;
    return `<div class="mk-slot${under ? ' has-under' : ''}" style="--under:${under}">
      ${Array.from({ length: under }, (_, i) => `<span class="mk-under" style="--i:${i + 1}" aria-hidden="true"></span>`).join('')}
      <button type="button" class="mk-card k-${esc(d.kind)}${d.id === sel ? ' on' : ''}" data-ml-card="${esc(d.id)}" aria-label="${esc(M().LABEL[d.kind] || d.kind)}: ${esc(d.name || 'Unnamed mark')}${under ? ', ' + cards.length + ' stage cards' : ''}">
        <span class="mk-k">${esc(label)}</span>
        <span class="mk-art">${art(d)}</span>
        <b class="mk-name">${esc(d.name || 'Unnamed mark')}</b>
        ${d.kind === 'curse' && stg && stg.n ? `<span class="mk-stage">${esc(stg.name)}</span>` : ''}
        <span class="mk-n">${n ? '×' + n + ' dealt' : 'not dealt'}</span>
      </button>
      ${menuFor === d.id ? `<div class="mk-menu" role="menu"><button type="button" role="menuitem" data-mk-cycle="${esc(d.id)}">⟳ Cycle stages <small>${top + 1}/${cards.length}</small></button><button type="button" role="menuitem" data-mk-inspect="${esc(d.id)}">Inspect</button></div>` : ''}
    </div>`;
  }
  function deckHtml() {
    const all = defs(), shown = all.filter(matches);
    const rows = KIND_ORDER.map(k => { const l = shown.filter(d => d.kind === k); return l.length ? `<section class="mk-row"><h4>${ROW[k][0]} <em>· ${l.length} · ${ROW[k][1]}</em></h4><div class="mk-cards">${l.map(cardHtml).join('')}</div></section>` : ''; }).join('');
    return `<div class="ml-deck">
      <div class="mk-tools"><input type="search" id="mlQ" value="${esc(filter.q)}" placeholder="search the deck…" aria-label="Search marks">
        <select id="mlKind" aria-label="Kind"><option value="">every kind</option>${KIND_ORDER.map(k => `<option value="${k}"${filter.kind === k ? ' selected' : ''}>${esc(M().LABEL[k])}s</option>`).join('')}</select>
        <button type="button" class="ed-chip sp-new" data-ml-new>+ NEW CARD</button></div>
      ${!all.length ? '<p class="mk-empty">An empty deck. A library mark is a blessing, curse or binding you define once and deal to many people and items. Add a card, or use “Save to the library” under any mark.</p>' : !shown.length ? '<p class="mk-empty">Nothing matches.</p>' : rows}</div>`;
  }
  function panelHtml(d) {
    if (!d) return `<div class="bk-panel-head"><span class="bk-big">${pad2(defs().length)}</span><div><small>MARK LIBRARY · PRIVATE</small><h2>The deck</h2></div></div><div class="bk-form"><p class="bk-dim">Pick a card to inspect it. A curse's stages are the cards beneath it: click a curse to cycle through them. The deck is the author's and is not part of the published site.</p></div>`;
    const cards = stageCards(d), top = Math.min(stageView[d.id] || 0, Math.max(cards.length - 1, 0)), stg = cards[top], n = holders(d.id).length;
    const strip = d.kind === 'curse' && cards.length > 1 ? `<div class="mk-strip">${cards.map((c, i) => `<button type="button" class="${i === top ? 'on' : ''}" data-mk-stage="${i}">${c.n ? 'Stage ' + c.n : 'Initial'}<small>${esc(c.name)}</small></button>`).join('')}</div>
      ${stg && (stg.text || stg.n) ? `<p class="mk-stage-text"><b>${esc(stg.n ? 'Stage ' + stg.n + ' · ' + stg.name : stg.name)}</b>${stg.text ? ' — ' + esc(stg.text) : ''}</p>` : ''}` : '';
    return `<div class="bk-panel-head"><span class="bk-big">${pad2(defs().indexOf(d) + 1)}</span><div><small>${esc((M().LABEL[d.kind] || d.kind).toUpperCase())} · ${n ? n + ' DEALT' : 'NOT DEALT'} · PRIVATE</small><h2 class="mk-panel-name">${esc(d.name || 'Unnamed mark')}</h2></div></div>
      ${strip}<div class="sp-main mk-editor" id="mlMain">${editorHtml(d)}</div>`;
  }
  function drawDeck() {
    const page = document.getElementById('bkBoard'), panel = document.getElementById('bookPanel'); if (!page || !panel) return;
    if (sel && !find(sel)) select('');
    page.innerHTML = deckHtml();
    panel.className = 'book-panel'; panel.innerHTML = panelHtml(find(sel));
    const idx = document.querySelector('.bk-title .bk-idx'); if (idx) idx.textContent = pad2(defs().length);
    root().querySelectorAll('[data-ml-card]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation(); const d = find(b.dataset.mlCard); if (!d) return;
      if (d.kind === 'curse' && stageCards(d).length > 1) { menuFor = menuFor === d.id ? '' : d.id; drawDeck(); const m = page.querySelector('.mk-menu button'); if (m) m.focus(); return; }
      menuFor = ''; inspect(d.id);
    }));
    root().querySelectorAll('[data-mk-cycle]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); cycle(b.dataset.mkCycle); }));
    root().querySelectorAll('[data-mk-inspect]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const id = b.dataset.mkInspect; menuFor = ''; stageView[id] = 0; inspect(id, true); }));
    root().querySelectorAll('[data-mk-stage]').forEach(b => b.addEventListener('click', () => { stageView[sel] = +b.dataset.mkStage; drawDeck(); }));
    const bind = (id, key, ev) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, () => { filter[key] = el.value; const v = el.value; drawDeck(); const back = document.getElementById(id); if (back) { back.focus(); if (back.setSelectionRange && typeof v === 'string') back.setSelectionRange(v.length, v.length); } }); };
    bind('mlQ', 'q', 'input'); bind('mlKind', 'kind', 'change');
    const nw = page.querySelector('[data-ml-new]'); if (nw) nw.addEventListener('click', () => {
      if (!save(false)) return; const d = Lib().toDefinition(M().newMark('any')); d.name = 'New mark';
      Lib().update(l => { l.marks.push(d); }); select(d.id); menuFor = ''; drawDeck(); const n = q('#mlMain [data-mlf="name"]'); if (n) { n.focus(); n.select(); } });
    if (find(sel)) wireMain();
  }
  function inspect(id, force) { if (id !== sel || force) { if (id !== sel && !save(false)) return; if (id !== sel) select(id); } drawDeck(); }
  function cycle(id) {
    const d = find(id); if (!d) return; const n = stageCards(d).length; stageView[id] = ((stageView[id] || 0) + 1) % Math.max(n, 1);
    if (id !== sel) { if (!save(false)) return; select(id); }
    drawDeck();
    const c = root().querySelector(`.mk-card[data-ml-card="${CSS.escape(id)}"]`); if (c) { c.classList.add('dealt'); }
  }
  // a click anywhere else closes the Cycle / Inspect choice
  if (typeof document !== 'undefined') document.addEventListener('click', e => { if (menuFor && inBook() && !(e.target.closest && e.target.closest('.mk-menu'))) { menuFor = ''; drawDeck(); } });

  function open() {
    if (!Lib() || !M()) return 'The Library is not available on this page.';
    if (!canEdit()) return 'The mark library is the author\'s: it is not part of the published site.';
    if (!find(sel)) select('');
    if (window.EpitaphBook && EpitaphBook.mountBoard && EpitaphBook.isOpen()) {      // inside the book, like opl and ops
      const count = Lib().get().marks.length;
      EpitaphBook.mountBoard({ kind: 'marks', title: 'Mark Library', jp: '印', count, sub: 'a deck of marks · define once, deal to many',
        note: "Blessings, curses and bindings you define once and copy to many items. This library is the author's and is not part of the published site. Changes save when you press Back.",
        build: el => { host = document.getElementById('theBook'); menuFor = ''; drawDeck(); return () => { try { save(false); } catch (e) { /* closing */ } host = null; menuFor = ''; }; } });
      return 'Opening the mark library…';
    }
    if (!root() || typeof openModal !== 'function') return 'The board needs the Dossier page.';
    root().innerHTML = shell(); wire(); openModal({ wide: true });
    return 'Opening the mark library…';
  }

  if (typeof global.runStorybookCommand === 'function') {
    const prev = global.runStorybookCommand;
    global.runStorybookCommand = function (cmd) {
      const t = String(cmd || '').trim().toLowerCase();
      if (['opmk', 'open mark library', 'open marks', 'open mark'].includes(t)) return open();
      const out = prev.call(this, cmd);
      return (t === 'help' || t === '?') && typeof out === 'string'
        ? out + '<div class="bt-hint"><b>opmk</b> / open mark library — blessings, curses and bindings you define once and copy to many (private).</div>' : out;
    };
  }
  if (typeof document !== 'undefined') document.addEventListener('click', e => {
    const a = e.target && e.target.closest ? e.target.closest('[data-book="opmk"]') : null;
    if (!a) return; e.preventDefault(); const msg = open(); if (msg && !/^Opening/.test(msg)) toast(msg);
  });
  global.EpitaphMarkLib = { open };
})(typeof window !== 'undefined' ? window : globalThis);
