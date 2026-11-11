/* Epitaph — mark editor and display (blessing / curse / binding), text only.
 * Same fields and markup as the Dossier's mark form; styles live in
 * epitaph-theme.css.
 *
 *   const ed = EpitaphMarks.editor(containerEl, marks)   // renders, handles add/remove
 *   ed.read()                                            // -> cleaned copy of the marks
 *   EpitaphMarks.linesHtml(marks)                        // read-only display
 */
(function (global) {
  'use strict';
  const KINDS = ['blessing', 'curse', 'binding'];
  const LABEL = { blessing: 'Blessing', curse: 'Curse', binding: 'Binding' };
  const FIELDS = ['name', 'source', 'effect', 'cost', 'ends'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const newId = () => 'mark_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  function normalize(m) {
    m = m || {};
    const out = { id: m.id || newId(), kind: KINDS.includes(m.kind) ? m.kind : 'blessing' };
    FIELDS.forEach(f => { out[f] = typeof m[f] === 'string' ? m[f] : ''; });
    return out;
  }
  // keeps marks that have any text, trimmed
  function clean(list) {
    return (list || []).map(normalize).filter(m => FIELDS.some(f => m[f].trim()))
      .map(m => { const o = { ...m }; FIELDS.forEach(f => { o[f] = o[f].trim(); }); return o; });
  }
  function editor(container, marks) {
    let list = (marks || []).map(normalize);
    function sync() {
      container.querySelectorAll('[data-mi]').forEach(el => { const m = list[+el.dataset.mi]; if (m) m[el.dataset.f] = el.value; });
    }
    function render() {
      container.innerHTML = '<div class="marks-editor">' + list.map((m, i) => `
        <div class="mark-edit kind-${esc(m.kind)}">
          <div class="mark-edit-top">
            <select data-mi="${i}" data-f="kind" aria-label="Kind">${KINDS.map(k => `<option value="${k}"${m.kind === k ? ' selected' : ''}>${LABEL[k]}</option>`).join('')}</select>
            <input type="text" data-mi="${i}" data-f="name" value="${esc(m.name)}" placeholder="Name" aria-label="Name">
          </div>
          <input type="text" data-mi="${i}" data-f="source" value="${esc(m.source)}" placeholder="Source — who or what placed it" aria-label="Source">
          <textarea data-mi="${i}" data-f="effect" placeholder="Effect — what it does" aria-label="Effect">${esc(m.effect)}</textarea>
          <input type="text" data-mi="${i}" data-f="cost" value="${esc(m.cost)}" placeholder="Cost — what it takes (text only)" aria-label="Cost">
          <input type="text" data-mi="${i}" data-f="ends" value="${esc(m.ends)}" placeholder="Ends — how it ends" aria-label="Ends">
          <button type="button" class="btn ghost mark-remove" data-remove="${i}">Remove mark</button>
        </div>`).join('') + '<button type="button" class="btn ghost mark-add">+ Add mark</button></div>';
      container.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => { sync(); list.splice(+b.dataset.remove, 1); render(); }));
      container.querySelector('.mark-add').addEventListener('click', () => { sync(); list.push(normalize({ kind: 'curse' })); render(); });
      container.querySelectorAll('select[data-mi]').forEach(s => s.addEventListener('change', () => { sync(); render(); }));
    }
    render();
    return { read() { sync(); return clean(list); } };
  }
  function linesHtml(list) {
    return (list || []).map(m => `<div class="mark-line kind-${esc(m.kind)}">
      <div><span class="mark-tag ${esc(m.kind)}">${esc((LABEL[m.kind] || m.kind).toUpperCase())}</span> <b>${esc(m.name || 'Unnamed mark')}</b></div>
      ${m.source ? `<small>Source: ${esc(m.source)}</small>` : ''}
      ${m.effect ? `<p>${esc(m.effect)}</p>` : ''}
      ${m.cost ? `<small class="cost">Cost: ${esc(m.cost)}</small>` : ''}
      ${m.ends ? `<small>Ends: ${esc(m.ends)}</small>` : ''}
    </div>`).join('');
  }
  global.EpitaphMarks = { KINDS, LABEL, normalize, clean, editor, linesHtml };
})(typeof window !== 'undefined' ? window : globalThis);
