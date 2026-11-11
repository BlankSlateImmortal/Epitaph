/* Epitaph — item states (e.g. Seal: Locked → Weakened), shared by the Atlas
 * Library and the book's Library view. Styles live in epitaph-theme.css.
 *
 *   const ed = EpitaphStates.editor(containerEl, states, uses)  // uses = EpitaphLibrary.uses(...)
 *   ed.read()                                   // -> cleaned, ordered copy of the states
 *   EpitaphStates.trackHtml(item, uses)         // LOCKED ▸ WEAKENED, with who/when per state
 *   EpitaphStates.useText(rows)                 // "Orin · CH 3, 7"
 *
 * A state nobody's chapter uses yet is shown as "not reached". A state in use
 * can't be removed here: move those chapters to another state first.
 * Needs assets/epitaph-marks.js.
 */
(function (global) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const newId = () => 'state_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const M = () => global.EpitaphMarks;

  // "Orin · CH 3, 7 · Sils · CH 12"
  function useText(rows) {
    const by = new Map();
    (rows || []).forEach(r => { if (!by.has(r.who)) by.set(r.who, []); by.get(r.who).push(r.ch != null ? r.ch : (r.label || '?')); });
    return [...by].map(([who, chs]) => `${who} · CH ${chs.join(', ')}`).join(' · ');
  }
  function usesOf(uses, stateId) { return (uses || []).filter(u => u.stateId === stateId); }

  function trackHtml(item, uses) {
    const states = (item && item.states) || [];
    if (!states.length) return '';
    const unset = (uses || []).filter(u => !u.stateId || !states.some(s => s.id === u.stateId));
    return `<ol class="state-track">${states.map((s, i) => {
      const rows = usesOf(uses, s.id);
      return `<li class="state-step${rows.length ? ' reached' : ''}">
        <span class="state-no">${String(i + 1).padStart(2, '0')}</span>
        <b>${esc((s.name || 'Unnamed state').toUpperCase())}</b>
        <small>${rows.length ? esc(useText(rows)) : 'not reached'}</small>
      </li>`;
    }).join('<li class="state-arrow" aria-hidden="true">▸</li>')}</ol>
    ${unset.length ? `<p class="state-unset">No state set: ${esc(useText(unset))}</p>` : ''}`;
  }

  function editor(container, states, uses) {
    let list = (states || []).map(s => ({ id: s.id || newId(), name: s.name || '', desc: s.desc || '', image: s.image || '', marks: (s.marks || []).slice() }));
    let markEds = [];
    function sync() {
      container.querySelectorAll('[data-si]').forEach(el => { const s = list[+el.dataset.si]; if (s) s[el.dataset.f] = el.value; });
      markEds.forEach((ed, i) => { if (list[i]) list[i].marks = ed.read(); });
    }
    function render() {
      container.innerHTML = `<div class="states-editor">${list.map((s, i) => {
        const n = usesOf(uses, s.id).length;
        return `<div class="state-edit">
          <div class="state-edit-top">
            <span class="state-no">${String(i + 1).padStart(2, '0')}</span>
            <input type="text" data-si="${i}" data-f="name" value="${esc(s.name)}" placeholder="State name, e.g. Locked" aria-label="State name">
            <button type="button" class="btn ghost state-move" data-move="${i}:-1" ${i ? '' : 'disabled'} aria-label="Move earlier">↑</button>
            <button type="button" class="btn ghost state-move" data-move="${i}:1" ${i < list.length - 1 ? '' : 'disabled'} aria-label="Move later">↓</button>
          </div>
          <small class="state-use">${n ? `${n} chapter${n === 1 ? '' : 's'}: ${esc(useText(usesOf(uses, s.id)))}` : 'Not reached — no chapter uses it yet'}</small>
          <div class="state-edit-body">
            <label class="state-pic" title="Picture for this state (optional)">${s.image ? `<img src="${esc(s.image)}" alt="">` : '<span>+ PIC</span>'}<input type="file" accept="image/*" class="visually-hidden-input" data-spic="${i}"></label>
            <textarea data-si="${i}" data-f="desc" placeholder="What changes in this state" aria-label="State description">${esc(s.desc)}</textarea>
          </div>
          ${s.image ? `<button type="button" class="btn ghost state-pic-clear" data-sclear="${i}">Remove picture</button>` : ''}
          <div class="state-marks-label">Marks in this state <em>(added to the item's own marks)</em></div>
          <div class="state-marks" data-smarks="${i}"></div>
          ${n ? `<small class="state-use">To remove it, move those chapters to another state first.</small>` : `<button type="button" class="btn ghost mark-remove" data-sremove="${i}">Remove state</button>`}
        </div>`;
      }).join('')}<button type="button" class="btn ghost mark-add state-add">+ Add state</button></div>`;
      markEds = list.map((s, i) => M().editor(container.querySelector(`[data-smarks="${i}"]`), s.marks));
      container.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', () => {
        sync(); const [i, d] = b.dataset.move.split(':').map(Number);
        const j = i + d; if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]]; render();
      }));
      container.querySelectorAll('[data-sremove]').forEach(b => b.addEventListener('click', () => { sync(); list.splice(+b.dataset.sremove, 1); render(); }));
      container.querySelector('.state-add').addEventListener('click', () => {
        sync(); list.push({ id: newId(), name: '', desc: '', image: '', marks: [] }); render();
        const inp = container.querySelector(`[data-si="${list.length - 1}"][data-f="name"]`); if (inp) inp.focus();
      });
      container.querySelectorAll('[data-spic]').forEach(inp => inp.addEventListener('change', async () => {
        const f = inp.files && inp.files[0]; if (!f) return;
        sync();
        try { list[+inp.dataset.spic].image = await M().readImage(f, 400); }
        catch (e) { if (global.showToast) global.showToast('That image could not be opened — try a JPEG or PNG.'); }
        render();
      }));
      container.querySelectorAll('[data-sclear]').forEach(b => b.addEventListener('click', () => { sync(); list[+b.dataset.sclear].image = ''; render(); }));
    }
    render();
    return {
      read() {
        sync();
        // keep states that have anything in them; an unnamed one gets a placeholder name
        return list.filter(s => s.name.trim() || s.desc.trim() || s.image || s.marks.length || usesOf(uses, s.id).length)
          .map((s, i) => ({ id: s.id, name: s.name.trim() || `State ${i + 1}`, desc: s.desc.trim(), image: s.image, marks: M().clean(s.marks) }));
      }
    };
  }
  global.EpitaphStates = { editor, trackHtml, useText };
})(typeof window !== 'undefined' ? window : globalThis);
