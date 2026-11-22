/* Epitaph — Skill prospects (terminal: opsp / open skill prospects). Plan: docs/plans/item-system.md, step 6.2.
 *
 * A free board of prospective skills: create and edit skills with no character attached, to see who they might fit.
 * They live in the Library (`skillDrafts`), are author-only (never published, never shown to readers) and are NOT real:
 * a skill only exists for a story once it is assigned to a character's chapter version. Skills are never shared, so assigning MOVES it
 * (the prospect is gone from the board), after checking the version's own rules: the type lock, the true-name branch caps, a locked chapter,
 * the skills it grows from, and name clashes.
 *
 *   EpitaphProspects.open()   opens the board in the wide modal; returns a short message for the terminal
 * The board also lists who could take a prospect (step 6.4): rules first, then room, then hints. No scores.
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
      <label class="sp-check"><input type="checkbox" data-spf="corrupted"${x.corrupted ? ' checked' : ''}> Corrupted (marked as twisted in the skill tree)</label>
      <label class="ed-field">Note <em>— private: who might it fit, why</em><textarea data-spf="note" rows="3" placeholder="Maybe Sils: it needs silence…">${esc(x.note)}</textarea></label>
      <div class="sp-acts">
        <button type="button" class="ed-slant primary" data-sp-save>Save</button>
        <button type="button" class="ed-slant ghost" data-sp-dup>Duplicate</button>
        <span class="sp-saved" id="spSaved" aria-live="polite"></span>
        <span class="sp-spacer"></span>
        <button type="button" class="ed-slant danger" data-sp-del>${armed === x.id ? 'Confirm delete' : 'Delete'}</button>
      </div>
      ${assignHtml(x)}
      ${fitHtml(x)}
    </div>`;
  }

  // ---- assign: move a prospect onto a character's chapter version ----
  const st = () => (typeof state !== 'undefined' ? state : null);
  const chars = () => ((st() && st().characters) || []).filter(c => c && c.id);
  const snapLabel = sn => (sn.chapterRange || (Number.isInteger(sn.startChapter) ? 'CH ' + sn.startChapter : 'a version')) + (sn.locked ? ' (locked)' : '');
  function assignHtml(x) {
    const cs = chars();
    if (!cs.length) return '<p class="sp-dim">Not real yet. There are no characters to assign it to.</p>';
    return `<div class="sp-assign"><b>Assign to a character</b>
      <p class="sp-dim">Not real yet: a prospect has no character and no chapter. Assigning it moves it onto one chapter version.</p>
      <div class="sp-row2">
        <label class="ed-field">Character<select id="spChar"><option value="">— pick —</option>${cs.map(c => `<option value="${esc(c.id)}">${esc(c.name || 'Unnamed')}</option>`).join('')}</select></label>
        <label class="ed-field">Chapter version<select id="spSnap" disabled><option value="">— pick a character first —</option></select></label>
      </div>
      <label class="sp-check" id="spAncWrap" hidden><input type="checkbox" id="spAnc" checked> <span id="spAncText"></span></label>
      <p class="sp-verdict" id="spVerdict" aria-live="polite"></p>
      <button type="button" class="ed-slant primary" data-sp-assign disabled>Assign (moves it)</button></div>`;
  }
  const asSkill = d => ({ name: d.name, desc: d.desc, level: d.level, corrupted: d.corrupted, parent: d.parent, glyph: d.glyph });
  // What assigning would do, or why it can't: { ok, reason, role, move: [drafts, what it grows from first], ancestors: [names] }
  function plan(x, charId, snapId, withAncestors) {
    const ch = chars().find(c => c.id === charId), sn = ch && (ch.snapshots || []).find(v => v.id === snapId);
    if (!ch || !sn) return { ok: false, reason: '' };
    if (typeof isLocked === 'function' && isLocked(sn)) return { ok: false, reason: 'That chapter is locked as canon. Reopen it in the Chapter Brief first.' };
    if (!x.name.trim()) return { ok: false, reason: 'Give the prospect a name first.' };
    const have = (sn.skills || []).slice(), names = new Set(have.map(k => k.name));
    const move = [x], seen = new Set([x.name]), ancestors = [];
    for (let p = x.parent; p && !names.has(p); ) {
      const d = drafts().find(z => z.name === p && z.id !== x.id);
      if (!d) return { ok: false, reason: `It grows from “${p}”, which is neither a skill of that version nor a prospect. Change “Grows from” first.` };
      if (seen.has(p)) return { ok: false, reason: `“${p}” grows from itself somewhere up the chain.` };
      if (!withAncestors) return { ok: false, reason: `It grows from “${p}”, which that version doesn't have yet. Tick “also move” or assign “${p}” first.` , needs: ancestors.concat(p) };
      seen.add(p); ancestors.push(p); move.unshift(d); p = d.parent;
    }
    const clash = move.find(d => names.has(d.name));
    if (clash) return { ok: false, reason: `That version already has a skill called “${clash.name}”.` };
    const list = have.concat(move.map(asSkill));
    // the site's message speaks of the skills text box's columns; on this board the parent is "Grows from"
    const problem = (typeof skillsProblem === 'function' ? skillsProblem(ch, list, sn.titles || []) : '')
      .replace(/give every other skill a parent \(the fifth column\)\./, 'set “Grows from” to one of their skills (or to a prospect that will move with it).');
    if (problem) return { ok: false, reason: problem };
    const me = list[list.length - 1], role = typeof skillRole === 'function' ? skillRole(list, me) : '';
    return { ok: true, role, move, ancestors, ch, sn };
  }
  // ---- fit helper (step 6.4): who could take this prospect, and why ----
  // Three layers, no scores: (1) the site's own rules at the character's latest open chapter version (plan(), as Assign uses);
  // (2) the room their true name leaves (core, branches, depth); (3) hints: the note names them, shared words with their concept,
  // a corrupted prospect for a Twisted character. Allowed first, then by number of hints.
  const words = t => new Set(String(t || '').toLowerCase().split(/[^a-z\u00c0-\u024f]+/).filter(w => w.length >= 4).map(w => w.replace(/(ies|es|s)$/, '')));
  function latestOpen(ch) {
    const vs = (ch.snapshots || []).filter(v => v).slice().sort((a, b) => (b.startChapter || 0) - (a.startChapter || 0));
    return vs.find(v => !(typeof isLocked === 'function' && isLocked(v))) || null;
  }
  function room(ch, sn) {
    const t = typeof typeOf === 'function' ? typeOf(ch) : (ch.race || '');
    if (typeof canHaveSkills === 'function' && !canHaveSkills(ch)) return 'can\'t hold skills';
    if (typeof skillsCapped === 'function' && !skillsCapped(ch)) return t === 'twisted' ? 'uncapped (a corrupted gift tree)' : (typeof isGodType === 'function' && isGodType(ch)) ? 'uncapped (authorities)' : 'uncapped (no type set)';
    const tier = typeof nameTier === 'function' ? nameTier(sn) : 0, c = typeof skillCounts === 'function' ? skillCounts(sn.skills || []) : { cores: 0, branches: 0, deepest: 0 };
    return `core ${c.cores ? 'taken' : 'free'} · branches ${c.branches}/${tier} · depth ${c.deepest}/${tier} (true name tier ${tier})`;
  }
  function fitRows(x) {
    const xw = words([x.name, x.desc].join(' ')), note = String(x.note || '').toLowerCase();
    return chars().map(ch => {
      const sn = latestOpen(ch), hints = [];
      if (!sn) return { ch, sn: null, ok: false, reason: 'every chapter version is locked', hints, room: '' };
      const nm = String(ch.name || '').trim().toLowerCase().replace(/\s*\(sample\)$/, '');
      if (nm.length >= 3 && note.includes(nm)) hints.push('your note names them');
      const shared = [...words(ch.authority)].filter(w => xw.has(w));
      if (shared.length) hints.push('shares “' + shared.join('”, “') + '” with their concept');
      if (x.corrupted && (typeof typeOf === 'function' ? typeOf(ch) : ch.race) === 'twisted') hints.push('corrupted, and they keep a corrupted gift tree');
      const p = plan(x, ch.id, sn.id, true);
      return { ch, sn, ok: p.ok, reason: p.reason, role: p.role, ancestors: p.ancestors || [], hints, room: room(ch, sn) };
    }).sort((a, b) => (b.ok - a.ok) || (b.hints.length - a.hints.length) || String(a.ch.name).localeCompare(String(b.ch.name)));
  }
  function fitHtml(x) {
    if (!chars().length) return '';
    const rows = fitRows(x);
    return `<div class="sp-fit"><b>Who could take it</b>
      <p class="sp-dim">At each character's latest chapter version that isn't locked. Rules first; the hints are only hints.</p>
      <ol class="sp-fit-list">${rows.map(r => `<li class="${r.ok ? 'ok' : 'no'}">
        <div class="sp-fit-head"><b>${esc(r.ch.name || 'Unnamed')}</b><small>${r.sn ? esc(snapLabel(r.sn)) : ''}</small>
          ${r.ok ? `<button type="button" class="ed-slant ghost sp-fit-use" data-fit-char="${esc(r.ch.id)}" data-fit-snap="${esc(r.sn.id)}">Use</button>` : ''}</div>
        <small class="sp-fit-why">${r.ok ? `✓ would be a ${esc(r.role || 'skill')}${r.ancestors.length ? ', moving ' + esc(r.ancestors.join(', ')) + ' with it' : ''}` : '✗ ' + esc(r.reason)}</small>
        ${r.room ? `<small>Room: ${esc(r.room)}</small>` : ''}
        ${r.hints.length ? `<small class="sp-fit-hints">Hints: ${esc(r.hints.join('; '))}</small>` : ''}</li>`).join('')}</ol></div>`;
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
    wireAssign();
    // the card shows the name as you type it
    const nm = q('#spMain [data-spf="name"]'); if (nm) nm.addEventListener('input', () => { const c = q(`.sp-card.on b`); if (c) c.textContent = nm.value || 'Unnamed prospect'; });
  }
  function wireAssign() {
    const cs = q('#spChar'); if (!cs) return;
    const sn = q('#spSnap'), anc = q('#spAnc'), btn = q('[data-sp-assign]');
    const x = () => find(sel);
    function refresh() {
      const d = x(); if (!d) return;
      const p = plan(d, cs.value, sn.value, anc.checked);
      const missing = p.needs || (p.ok ? p.ancestors : []);
      q('#spAncWrap').hidden = !(missing && missing.length) && !(p.ancestors && p.ancestors.length);
      q('#spAncText').textContent = `Also move what it grows from (${(p.needs || p.ancestors || []).join(', ')})`;
      const v = q('#spVerdict');
      v.className = 'sp-verdict ' + (p.ok ? 'ok' : (p.reason ? 'no' : ''));
      v.textContent = p.ok ? `✓ It fits: it becomes a ${p.role || 'skill'} of ${p.ch.name || 'them'} (${snapLabel(p.sn)})${p.ancestors.length ? `, moving ${p.ancestors.join(', ')} with it` : ''}.` : (cs.value && sn.value ? '✗ ' + p.reason : '');
      btn.disabled = !p.ok;
    }
    cs.addEventListener('change', () => {
      const ch = chars().find(c => c.id === cs.value);
      sn.disabled = !ch; sn.innerHTML = ch ? '<option value="">— pick a chapter version —</option>' + (ch.snapshots || []).slice().sort((a, b) => (a.startChapter || 0) - (b.startChapter || 0)).map(v => `<option value="${esc(v.id)}">${esc(snapLabel(v))}</option>`).join('') : '<option value="">— pick a character first —</option>';
      refresh();
    });
    sn.addEventListener('change', refresh); anc.addEventListener('change', refresh);
    root().querySelectorAll('[data-fit-char]').forEach(b => b.addEventListener('click', () => {
      cs.value = b.dataset.fitChar; cs.dispatchEvent(new Event('change')); sn.value = b.dataset.fitSnap; anc.checked = true; refresh();
      const box = q('.sp-assign'); if (box && box.scrollIntoView) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }));
    btn.addEventListener('click', async () => {
      if (!save(false)) return;
      const d = x(), p = plan(d, cs.value, sn.value, anc.checked); if (!p.ok) return refresh();
      p.sn.skills = (p.sn.skills || []).concat(p.move.map(asSkill));
      const ids = new Set(p.move.map(m => m.id));
      Lib().update(l => { l.skillDrafts = l.skillDrafts.filter(z => !ids.has(z.id)); });
      sel = ''; armed = null;
      try { if (typeof persistState === 'function') await persistState(); if (typeof renderAll === 'function') renderAll(); } catch (e) { console.error(e); }
      if (typeof showToast === 'function') showToast(`${p.move.map(m => m.name).join(', ')} moved to ${p.ch.name || 'the character'} (${snapLabel(p.sn)}).`, { duration: 5000 });
      redraw(true);
    });
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
