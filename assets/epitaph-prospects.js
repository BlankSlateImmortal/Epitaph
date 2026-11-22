/* Epitaph — Skill prospects (terminal: opsp / open skill prospects). Plan: docs/plans/item-system.md, step 6.2.
 *
 * A free board of prospective skills: create and edit skills with no character attached, to see who they might fit.
 * They live in the Library (`skillDrafts`), are author-only (never published, never shown to readers) and are NOT real:
 * a skill only exists for a story once it is assigned to a character (step 6.3). Skills are never shared, so assigning moves it.
 *
 *   EpitaphProspects.open()   opens the board in the wide modal; returns a short message for the terminal
 *
 * Needs assets/epitaph-library.js; uses the page's modal (openModal, closeModal, modalContent) and the terminal runner.
 */
(function (global) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const Lib = () => global.EpitaphLibrary;
  const canEdit = () => !(global.EpitaphMode && !global.EpitaphMode.canEdit());
  let sel = '';                                   // the draft being edited
  const filter = { q: '', level: '', corrupted: '' };
  let armed = null;                               // the draft whose Delete is armed

  const drafts = () => Lib().get().skillDrafts;
  const find = id => drafts().find(x => x.id === id) || null;
  const root = () => (typeof modalContent !== 'undefined' ? modalContent : null);
  const q = s => root().querySelector(s);

  function matches(x) {
    const w = filter.q.trim().toLowerCase();
    if (w && ![x.name, x.desc, x.note, x.parent].some(t => String(t || '').toLowerCase().includes(w))) return false;
    if (filter.level !== '' && String(x.level) !== filter.level) return false;
    if (filter.corrupted === 'yes' && !x.corrupted) return false;
    if (filter.corrupted === 'no' && x.corrupted) return false;
    return true;
  }

  function listHtml() {
    const all = drafts(), shown = all.filter(matches);
    if (!all.length) return '<p class="sp-empty">No prospects yet. Add one to start.</p>';
    if (!shown.length) return '<p class="sp-empty">Nothing matches that filter.</p>';
    return shown.map(x => `<button type="button" class="sp-card${x.id === sel ? ' on' : ''}${x.corrupted ? ' corrupted' : ''}" data-sp="${esc(x.id)}">
      <b>${esc(x.name || 'Unnamed prospect')}</b>
      <small>${x.level ? 'Level ' + x.level : 'No level'}${x.parent ? ' · under ' + esc(x.parent) : ' · a core or loose skill'}${x.corrupted ? ' · corrupted' : ''}</small>
      ${x.note ? `<small class="sp-note">${esc(x.note.length > 80 ? x.note.slice(0, 80) + '…' : x.note)}</small>` : ''}</button>`).join('');
  }

  function editorHtml(x) {
    if (!x) return '<div class="sp-hint">&gt; pick a prospect, or add one<span class="sig-cursor"></span></div>';
    const parents = [...new Set(drafts().filter(d => d.id !== x.id && d.name.trim()).map(d => d.name.trim()))];
    const missing = x.parent && !parents.includes(x.parent);
    return `<div class="sp-form">
      <label class="ed-field">Name<input type="text" data-spf="name" value="${esc(x.name)}" placeholder="Name of the skill"></label>
      <label class="ed-field">What it does<textarea data-spf="desc" rows="4" placeholder="Describe it">${esc(x.desc)}</textarea></label>
      <div class="sp-row">
        <label class="ed-field">Level<select data-spf="level">${[0, 1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}"${x.level === n ? ' selected' : ''}>${n ? n : 'not set'}</option>`).join('')}</select></label>
        <label class="ed-field">Grows from<select data-spf="parent"><option value="">— nothing: a core or loose skill —</option>${missing ? `<option value="${esc(x.parent)}" selected>⚠ ${esc(x.parent)} (not a prospect)</option>` : ''}${parents.map(n => `<option value="${esc(n)}"${x.parent === n ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <label class="ed-field">Glyph<input type="text" data-spf="glyph" value="${esc(x.glyph)}" maxlength="2" placeholder="one kanji"></label>
      </div>
      <label class="sp-check"><input type="checkbox" data-spf="corrupted"${x.corrupted ? ' checked' : ''}> Corrupted (twisted: only a Twisted character can hold it)</label>
      <label class="ed-field">Note <em>— private: who might it fit, why</em><textarea data-spf="note" rows="3" placeholder="Maybe Sils: it needs silence…">${esc(x.note)}</textarea></label>
      <div class="sp-acts">
        <button type="button" class="ed-slant primary" data-sp-save>Save</button>
        <button type="button" class="ed-slant ghost" data-sp-dup>Duplicate</button>
        <span class="sp-saved" id="spSaved" aria-live="polite"></span>
        <span class="sp-spacer"></span>
        <button type="button" class="ed-slant danger" data-sp-del>${armed === x.id ? 'Confirm delete' : 'Delete'}</button>
      </div>
      <p class="sp-dim">Not real yet: a prospect has no character and no chapter. Assigning it to a character (coming next) moves it onto that character's chapter version.</p>
    </div>`;
  }

  function shell() {
    return `<div class="ed-head"><div class="ed-title"><span class="ed-crt">EPITAPH // SKILL PROSPECTS</span><span class="ed-sub">${drafts().length} prospect${drafts().length === 1 ? '' : 's'} · private, not published</span></div>
      <div class="ed-acts"><button type="button" class="ed-slant ghost" data-sp-close>Close</button></div></div>
      <div class="sp-board">
        <div class="sp-side">
          <div class="sp-filters">
            <input type="search" id="spQ" value="${esc(filter.q)}" placeholder="Search name, text, note" aria-label="Search prospects">
            <select id="spLevel" aria-label="Level"><option value="">any level</option>${[0, 1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}"${filter.level === String(n) ? ' selected' : ''}>${n ? 'level ' + n : 'no level'}</option>`).join('')}</select>
            <select id="spCor" aria-label="Corrupted"><option value="">corrupted or not</option><option value="yes"${filter.corrupted === 'yes' ? ' selected' : ''}>corrupted only</option><option value="no"${filter.corrupted === 'no' ? ' selected' : ''}>not corrupted</option></select>
          </div>
          <div class="sp-list" id="spList">${listHtml()}</div>
          <button type="button" class="ed-chip sp-new" data-sp-new>+ NEW PROSPECT</button>
        </div>
        <div class="sp-main" id="spMain">${editorHtml(find(sel))}</div>
      </div>`;
  }

  // writes the form into the open draft (a renamed prospect also renames it as a parent)
  function readForm() {
    const x = find(sel); if (!x || !q('#spMain [data-spf="name"]')) return null;
    const v = f => q(`#spMain [data-spf="${f}"]`);
    const next = { ...x, name: v('name').value.trim(), desc: v('desc').value.trim(), level: parseInt(v('level').value, 10) || 0, parent: v('parent').value,
      glyph: v('glyph').value.trim().slice(0, 2), corrupted: v('corrupted').checked, note: v('note').value.trim() };
    return JSON.stringify(next) === JSON.stringify(x) ? null : next;
  }
  function save(announce) {
    const next = readForm(); if (!next) { if (announce) flash('No changes'); return true; }
    const old = find(sel);
    const saved = Lib().update(l => {
      const i = l.skillDrafts.findIndex(d => d.id === next.id); if (i < 0) return;
      l.skillDrafts[i] = next;
      if (old.name && old.name !== next.name) l.skillDrafts.forEach(d => { if (d.parent === old.name) d.parent = next.name; });
    });
    if (!saved) { if (typeof showToast === 'function') showToast('Could not save — browser storage may be full.', { duration: 5500 }); return false; }
    if (announce) flash('Saved');
    return true;
  }
  function flash(text) { const s = q('#spSaved'); if (!s) return; s.textContent = text; clearTimeout(flash.t); flash.t = setTimeout(() => { if (s.isConnected) s.textContent = ''; }, 1600); }

  function redraw(full) {
    armed = armed && find(armed) ? armed : null;
    if (full) { root().innerHTML = shell(); wire(); return; }
    q('#spList').innerHTML = listHtml(); q('#spMain').innerHTML = editorHtml(find(sel)); wireList(); wireForm();
  }
  function pick(id) { if (id === sel) return; if (!save(false)) return; sel = id; armed = null; redraw(false); }

  function wireList() { root().querySelectorAll('[data-sp]').forEach(b => b.addEventListener('click', () => pick(b.dataset.sp))); }
  function wireForm() {
    const s = q('[data-sp-save]'); if (s) s.addEventListener('click', () => { if (save(true)) { redraw(false); flash('Saved'); } });
    const du = q('[data-sp-dup]'); if (du) du.addEventListener('click', () => {
      if (!save(false)) return; const x = find(sel), c = Lib().normalizeSkillDraft({ ...x, id: '', name: (x.name || 'Prospect') + ' (copy)' });
      Lib().update(l => l.skillDrafts.push(c)); sel = c.id; armed = null; redraw(false); });
    const de = q('[data-sp-del]'); if (de) de.addEventListener('click', () => {
      if (armed !== sel) { armed = sel; de.textContent = 'Confirm delete'; setTimeout(() => { if (de.isConnected && armed === sel) { armed = null; de.textContent = 'Delete'; } }, 4000); return; }
      const gone = sel; sel = ''; armed = null; Lib().update(l => { l.skillDrafts = l.skillDrafts.filter(d => d.id !== gone); }); redraw(true); });
    // the card shows the name as you type it
    const nm = q('#spMain [data-spf="name"]'); if (nm) nm.addEventListener('input', () => { const c = q(`.sp-card.on b`); if (c) c.textContent = nm.value || 'Unnamed prospect'; });
  }
  function wire() {
    root().querySelectorAll('[data-sp-close]').forEach(b => b.addEventListener('click', () => { save(false); closeModal(); }));
    const nw = q('[data-sp-new]'); if (nw) nw.addEventListener('click', () => {
      if (!save(false)) return; const x = Lib().normalizeSkillDraft({ name: 'New prospect' });
      Lib().update(l => l.skillDrafts.push(x)); sel = x.id; armed = null; redraw(true);
      const n = q('#spMain [data-spf="name"]'); if (n) { n.focus(); n.select(); } });
    const bind = (id, key, ev) => { const el = q(id); if (el) el.addEventListener(ev, () => { filter[key] = el.value; q('#spList').innerHTML = listHtml(); wireList(); }); };
    bind('#spQ', 'q', 'input'); bind('#spLevel', 'level', 'change'); bind('#spCor', 'corrupted', 'change');
    wireList(); wireForm();
  }

  function open() {
    if (!Lib()) return 'The Library is not available on this page.';
    if (!canEdit()) return 'Skill prospects are the author\'s drafts: they are not part of the published site.';
    if (!root() || typeof openModal !== 'function') return 'The board needs the Dossier page.';
    if (!find(sel)) sel = '';
    root().innerHTML = shell(); wire();
    openModal({ wide: true });
    return 'Opening the skill prospects…';
  }

  // the terminal: opsp, and a line in help (wraps the runner the other tools wrapped before it)
  if (typeof global.runStorybookCommand === 'function') {
    const prev = global.runStorybookCommand;
    global.runStorybookCommand = function (cmd) {
      const t = String(cmd || '').trim().toLowerCase();
      if (['opsp', 'open skill prospects', 'open skill prospect', 'open prospects'].includes(t)) return open();
      const out = prev.call(this, cmd);
      return (t === 'help' || t === '?') && typeof out === 'string'
        ? out + '<div class="bt-hint"><b>opsp</b> / open skill prospects — free-draft skills with no character yet (private; assigned later).</div>' : out;
    };
  }
  if (typeof document !== 'undefined') document.addEventListener('click', e => {
    const a = e.target && e.target.closest ? e.target.closest('[data-book="opsp"]') : null;
    if (!a) return; e.preventDefault(); const msg = open(); if (msg && !/^Opening/.test(msg) && typeof showToast === 'function') showToast(msg, { duration: 4500 });
  });
  global.EpitaphProspects = { open };
})(typeof window !== 'undefined' ? window : globalThis);
