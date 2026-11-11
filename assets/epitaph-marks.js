/* Epitaph — mark editor and display (blessing / curse / binding), text only.
 * Same fields and markup as the Dossier's mark form; styles live in
 * epitaph-theme.css.
 *
 *   const ed = EpitaphMarks.editor(containerEl, marks)   // renders, handles add/remove
 *   ed.read()                                            // -> cleaned copy of the marks
 *   EpitaphMarks.linesHtml(marks)                        // read-only display
 *   EpitaphMarks.readImage(file, maxDim?) -> Promise<dataURL>  // resized image (default 256px)
 *
 * A mark may carry an optional `image` (a small data-URL sigil, max 256px).
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
    out.image = typeof m.image === 'string' ? m.image : '';
    return out;
  }
  // keeps marks that have any text or an image, trimmed
  function clean(list) {
    return (list || []).map(normalize).filter(m => m.image || FIELDS.some(f => m[f].trim()))
      .map(m => { const o = { ...m }; FIELDS.forEach(f => { o[f] = o[f].trim(); }); return o; });
  }
  // Sigils are small: 256px max, JPEG unless the image has transparency.
  const SIGIL_MAX = 256;
  function readImage(file, maxDim) {
    const MAX = maxDim || SIGIL_MAX;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read'));
      reader.onload = (ev) => {
        const img = new Image();
        img.onerror = () => reject(new Error('decode'));
        img.onload = () => {
          let { width, height } = img;
          if (width > MAX || height > MAX) { const sc = MAX / Math.max(width, height); width = Math.round(width * sc); height = Math.round(height * sc); }
          const cv = document.createElement('canvas'); cv.width = width; cv.height = height;
          cv.getContext('2d').drawImage(img, 0, 0, width, height);
          let opaque = true;
          try { const d = cv.getContext('2d').getImageData(0, 0, width, height).data; for (let i = 3; i < d.length; i += 4) { if (d[i] < 255) { opaque = false; break; } } } catch (e) { opaque = false; }
          resolve(opaque ? cv.toDataURL('image/jpeg', 0.85) : cv.toDataURL('image/png'));
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
  // the square picker shown at the start of a mark's top row
  function sigilPickerHtml(m, attrs) {
    return `<span class="mark-sigil-pick">
      <label class="mark-sigil-btn${m.image ? ' has' : ''}" title="${m.image ? 'Change image' : 'Add image'}">${m.image ? `<img src="${m.image}" alt="">` : '<span>+ IMG</span>'}<input type="file" accept="image/*" class="visually-hidden-input" ${attrs}></label>
      ${m.image ? `<button type="button" class="mark-sigil-clear" ${attrs} data-clear="1" aria-label="Remove image">×</button>` : ''}
    </span>`;
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
            ${sigilPickerHtml(m, `data-img="${i}"`)}
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
      container.querySelectorAll('input[type=file][data-img]').forEach(inp => inp.addEventListener('change', async () => {
        const f = inp.files && inp.files[0]; if (!f) return;
        sync();
        try { list[+inp.dataset.img].image = await readImage(f); } catch (e) { alertImage(); }
        render();
      }));
      container.querySelectorAll('button[data-img][data-clear]').forEach(b => b.addEventListener('click', () => { sync(); list[+b.dataset.img].image = ''; render(); }));
    }
    render();
    return { read() { sync(); return clean(list); } };
  }
  function alertImage() { if (global.showToast) global.showToast('That image could not be opened — try a JPEG or PNG.'); else console.warn('Mark image could not be read'); }
  function sigilHtml(m) { return m.image ? `<img class="mark-sigil" src="${esc(m.image)}" alt="">` : ''; }
  function linesHtml(list) {
    return (list || []).map(m => `<div class="mark-line kind-${esc(m.kind)}${m.image ? ' has-img' : ''}">${sigilHtml(m)}<div class="mark-body">
      <div><span class="mark-tag ${esc(m.kind)}">${esc((LABEL[m.kind] || m.kind).toUpperCase())}</span> <b>${esc(m.name || 'Unnamed mark')}</b></div>
      ${m.source ? `<small>Source: ${esc(m.source)}</small>` : ''}
      ${m.effect ? `<p>${esc(m.effect)}</p>` : ''}
      ${m.cost ? `<small class="cost">Cost: ${esc(m.cost)}</small>` : ''}
      ${m.ends ? `<small>Ends: ${esc(m.ends)}</small>` : ''}
    </div></div>`).join('');
  }
  global.EpitaphMarks = { KINDS, LABEL, normalize, clean, editor, linesHtml, readImage, sigilPickerHtml, sigilHtml };
})(typeof window !== 'undefined' ? window : globalThis);
