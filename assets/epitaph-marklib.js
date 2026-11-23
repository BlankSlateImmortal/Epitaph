/* Epitaph — the mark library board (terminal: opmk / open mark library). Plan: docs/plans/item-system.md, step 6.5.
 *
 * Marks you define once (a blessing given to a whole people, a curse that hits many) live in the Library (`marks`). A person, an item or a
 * chapter's copy of an item holds an ordinary mark plus a link (`libId`) to its definition. This board lists the definitions, edits them, and
 * shows every copy: who holds it, in which chapter, at which curse stage, and whether it still matches the definition. "Update all copies"
 * brings the ones that drifted back in line (each copy keeps its own id and its own curse stage). Author only; never published.
 * Picking from the library and saving a mark to it happen in the mark editors themselves (EpitaphMarks.libraryPickHtml / linkHtml).
 *
 *   EpitaphMarkLib.open()   opens the board in the wide modal; returns a short message for the terminal
 */
(function (global) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const Lib = () => global.EpitaphLibrary, M = () => global.EpitaphMarks;
  const canEdit = () => !(global.EpitaphMode && !global.EpitaphMode.canEdit());
  const root = () => (typeof modalContent !== 'undefined' ? modalContent : null);
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
    if (full) { root().innerHTML = shell(); wire(); return; }
    q('#mlList').innerHTML = listHtml(); q('#mlMain').innerHTML = editorHtml(find(sel)); wireList(); wireMain();
  }
  const pick = id => { if (id === sel) return; if (!save(false)) return; select(id); redraw(false); };
  function wireList() { root().querySelectorAll('[data-ml]').forEach(b => b.addEventListener('click', () => pick(b.dataset.ml))); }
  function wireMain() {
    const kind = q('#mlMain select[data-mlf="kind"]'); if (kind) kind.addEventListener('change', () => { sync(); redraw(false); });
    const sv = q('[data-ml-save]'); if (sv) sv.addEventListener('click', () => { if (save(true)) { q('#mlList').innerHTML = listHtml(); wireList(); q('#mlMain').innerHTML = editorHtml(find(sel)); wireMain(); const s = q('#mlSaved'); if (s) s.textContent = 'Saved'; } });
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
    root().querySelectorAll('[data-ml-close]').forEach(b => b.addEventListener('click', () => { save(false); closeModal(); }));
    const nw = q('[data-ml-new]'); if (nw) nw.addEventListener('click', () => {
      if (!save(false)) return; const d = Lib().toDefinition(M().newMark('any')); d.name = 'New mark';
      Lib().update(l => { l.marks.push(d); }); select(d.id); redraw(true); const n = q('#mlMain [data-mlf="name"]'); if (n) { n.focus(); n.select(); } });
    const bind = (id, key, ev) => { const el = q(id); if (el) el.addEventListener(ev, () => { filter[key] = el.value; q('#mlList').innerHTML = listHtml(); wireList(); }); };
    bind('#mlQ', 'q', 'input'); bind('#mlKind', 'kind', 'change');
    wireList(); wireMain();
  }

  function open() {
    if (!Lib() || !M()) return 'The Library is not available on this page.';
    if (!canEdit()) return 'The mark library is the author\'s: it is not part of the published site.';
    if (!root() || typeof openModal !== 'function') return 'The board needs the Dossier page.';
    if (!find(sel)) select('');
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
