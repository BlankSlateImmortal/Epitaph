/* Epitaph — the mark editor and display (blessing / curse / binding). One implementation of the fields, shared by every
 * place that edits marks. Styles live in epitaph-theme.css. Plan: docs/plans/item-system.md, step 2.3.
 *
 *   const ed = EpitaphMarks.editor(containerEl, marks, { ctx })   // renders, handles add/remove; ed.read() -> cleaned marks
 *   EpitaphMarks.fieldsHtml(m, { ctx, attr, sigil, top })          // the inputs for one mark (host supplies the data attributes; top:false = no kind/name row)
 *   EpitaphMarks.setField(m, field, value)                         // writes one input's value ('stages.1.text', 'rank', ...)
 *   EpitaphMarks.newMark(ctx)  EpitaphMarks.kindsFor(ctx)          // a blank mark, the kinds allowed there
 *   EpitaphMarks.linesHtml(marks, { definition })                  // read-only display; curses show their stage ladder (definition: none current)
 *   EpitaphMarks.readImage(file, maxDim?) -> Promise<dataURL>      // resized image (default 256px)
 *
 * ctx = where the marks live: 'library' (an item's or a state's marks), 'entry' (a chapter's copy of an item), 'character'
 * (a person's own marks). An item takes bindings and curses, a person blessings and curses; a mark already of another
 * kind is kept and shown flagged. The shape of a mark belongs to EpitaphLibrary.normalizeMark.
 * A mark may carry an optional `image` (a small data-URL sigil, max 256px).
 */
(function (global) {
  'use strict';
  const KINDS = ['blessing', 'curse', 'binding'];
  const LABEL = { blessing: 'Blessing', curse: 'Curse', binding: 'Binding' };
  const FIELDS = ['name', 'source', 'effect'];   // the text every mark has
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lib = () => global.EpitaphLibrary;
  const newId = () => 'mark_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  function normalize(m) {
    m = m || {};
    if (lib() && lib().normalizeMark) return lib().normalizeMark(m);
    return { id: m.id || newId(), kind: KINDS.includes(m.kind) ? m.kind : 'blessing', name: String(m.name || ''), source: String(m.source || ''), effect: String(m.effect || ''), image: String(m.image || '') };
  }
  const trimDeep = v => (typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.map(trimDeep) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trimDeep(x)])) : v);
  // keeps marks that have any text, a detail line or an image, trimmed
  function clean(list) {
    const extra = m => !!(lib() && lib().markDetailLines && lib().markDetailLines(m).length);
    return (list || []).map(normalize).filter(m => m.image || FIELDS.some(f => m[f].trim()) || extra(m)).map(m => ({ ...trimDeep(m), image: m.image }));
  }
  const kindsFor = ctx => (lib() ? lib().markKindsFor(ctx === 'character' ? 'character' : 'item') : KINDS.slice());
  const newMark = ctx => normalize({ kind: ctx === 'character' ? 'blessing' : 'binding' });
  const STAGES = ['Initial state', 'Awakening', 'Fluctuation', 'Stabilization'];
  const CURSE_TYPES = ['mutation', 'enhancement', 'distortion', 'fragmentation'];
  // Writes one input's value into a mark draft. `stages.2.text` / `initial.name` reach into the curse's stages; rank and stage are numbers.
  function setField(m, f, v) {
    const p = String(f).split('.');
    if (p.length === 1) { m[f] = (f === 'rank' || f === 'stage') ? (parseInt(v, 10) || 0) : v; return; }
    if (p[0] === 'initial') { m.initial = m.initial || { name: '', text: '' }; m.initial[p[1]] = v; return; }
    if (p[0] === 'stages') {
      m.stages = Array.isArray(m.stages) ? m.stages : []; const i = +p[1];
      while (m.stages.length <= i) m.stages.push({ name: '', text: '' });
      m.stages[i] = m.stages[i] || { name: '', text: '' }; m.stages[i][p[2]] = v;
    }
  }
  // The inputs for one mark. `attr(field)` returns the data attributes the host reads back with setField; `sigil` is the host's image picker.
  function fieldsHtml(m, o) {
    o = o || {}; const a = o.attr || (() => ''), ctx = o.ctx || 'library', allowed = kindsFor(ctx);
    const kinds = allowed.includes(m.kind) ? allowed : allowed.concat(m.kind);
    const rankN = lib() ? lib().RANKS : [];
    const stageRow = (label, f, val) => `<div class="mark-stage-row"><b>${esc(label)}</b>
      <input type="text" ${a(f + '.name')} value="${esc((val || {}).name)}" placeholder="Your own name for it (optional)" aria-label="${esc(label)} name">
      <textarea ${a(f + '.text')} placeholder="What happens at this stage" aria-label="${esc(label)}">${esc((val || {}).text)}</textarea></div>`;
    const stagesFilled = !!((m.initial && (m.initial.name || m.initial.text)) || (m.stages || []).some(x => x && (x.name || x.text)));
    return `${o.top === false ? '' : `<div class="mark-edit-top">${o.sigil || ''}
        <select ${a('kind')} aria-label="Kind">${kinds.map(k => `<option value="${k}"${m.kind === k ? ' selected' : ''}>${LABEL[k]}${allowed.includes(k) ? '' : ' (not allowed here)'}</option>`).join('')}</select>
        <input type="text" ${a('name')} value="${esc(m.name)}" placeholder="Name" aria-label="Name"></div>`}
      <input type="text" ${a('source')} value="${esc(m.source)}" placeholder="${m.kind === 'curse' ? 'Cause — what it stems from (??? if unknown)' : 'Source — who or what placed it (??? if unknown)'}" aria-label="${m.kind === 'curse' ? 'Cause' : 'Source'}">
      <textarea ${a('effect')} placeholder="Effect — what it does" aria-label="Effect">${esc(m.effect)}</textarea>
      ${m.kind === 'binding' ? `<label class="mark-field">Reach <em>— the rank this binding gives the item</em><select ${a('rank')} aria-label="Rank"><option value="0">— none —</option>${rankN.slice(1).map((n, i) => `<option value="${i + 1}"${m.rank === i + 1 ? ' selected' : ''}>${i + 1} · ${esc(n)}</option>`).join('')}</select></label>` : ''}
      ${m.kind === 'blessing' ? `<div class="mark-grid">
          <input type="text" ${a('price')} value="${esc(m.price)}" placeholder="Price — what holding it always takes" aria-label="Price">
          <input type="text" ${a('terms')} value="${esc(m.terms)}" placeholder="Terms — the condition to keep" aria-label="Terms">
          <input type="text" ${a('breach')} value="${esc(m.breach)}" placeholder="Breach — what happens if the terms are broken (needs terms)" aria-label="Breach">
          <input type="text" ${a('lastsUntil')} value="${esc(m.lastsUntil)}" placeholder="Lasts until — how it stops, normally" aria-label="Lasts until"></div>` : ''}
      ${m.kind === 'curse' ? `<div class="mark-grid">
          <label class="mark-field">Type<select ${a('type')} aria-label="Curse type"><option value="">— not set —</option>${CURSE_TYPES.map(t => `<option value="${t}"${m.type === t ? ' selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}</select></label>
          ${ctx === 'library' ? '' : `<label class="mark-field">Stage now<select ${a('stage')} aria-label="Stage now">${STAGES.map((n, i) => `<option value="${i}"${(m.stage || 0) === i ? ' selected' : ''}>${i ? i + ' · ' : ''}${n}</option>`).join('')}</select></label>`}</div>
        <details class="mark-stages"${stagesFilled ? ' open' : ''}><summary>Stages <em>— Awakening, Fluctuation, Stabilization; give each your own name and text</em></summary>
          ${stageRow(STAGES[0], 'initial', m.initial)}${[0, 1, 2].map(i => stageRow(`${i + 1} · ${STAGES[i + 1]}`, 'stages.' + i, (m.stages || [])[i])).join('')}</details>` : ''}`;
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
  function editor(container, marks, opts) {
    const ctx = (opts && opts.ctx) || 'library';
    let list = (marks || []).map(normalize);
    function sync() {
      container.querySelectorAll('[data-mi]').forEach(el => { const m = list[+el.dataset.mi]; if (m) setField(m, el.dataset.f, el.value); });
    }
    function render() {
      container.innerHTML = '<div class="marks-editor">' + list.map((m, i) => `
        <div class="mark-edit kind-${esc(m.kind)}">
          ${fieldsHtml(m, { ctx, attr: f => `data-mi="${i}" data-f="${f}"`, sigil: sigilPickerHtml(m, `data-img="${i}"`) })}
          <button type="button" class="btn ghost mark-remove" data-remove="${i}">Remove mark</button>
        </div>`).join('') + '<button type="button" class="btn ghost mark-add">+ Add mark</button></div>';
      container.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => { sync(); list.splice(+b.dataset.remove, 1); render(); }));
      container.querySelector('.mark-add').addEventListener('click', () => { sync(); list.push(newMark(ctx)); render(); });
      container.querySelectorAll('select[data-mi][data-f="kind"]').forEach(s => s.addEventListener('change', () => { sync(); render(); }));
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
  // price / terms / breach / lasts until, curse type and stage, binding reach (from the Library's mark shape)
  // ---- the curse stage ladder: Initial state · Awakening · Fluctuation · Stabilization ----
  const stagesFilled = m => !!((m.initial && (m.initial.name || m.initial.text)) || (m.stages || []).some(x => x && (x.name || x.text)));
  const isStageLine = l => /^Stage \d|^Initial state/.test(l.label);
  // `o.definition`: the curse as defined on an item (no holder), so no step is marked as the current one.
  // A ladder shows for a curse that has stage text, or (on a holder) has moved past its initial state.
  function ladderHtml(m, o) {
    o = o || {};
    if (!m || m.kind !== 'curse' || !(stagesFilled(m) || (!o.definition && (m.stage || 0) > 0))) return '';
    const now = o.definition ? -1 : (Number.isInteger(m.stage) ? m.stage : 0);
    const steps = [{ label: STAGES[0], v: m.initial }, ...[0, 1, 2].map(i => ({ label: STAGES[i + 1], v: (m.stages || [])[i] }))];
    const cur = now >= 0 ? steps[now] : null;
    return `<ol class="stage-ladder" aria-label="Curse stages" title="A curse does not recover: stabilizing is not healing">${steps.map((s, i) =>
      `<li class="${now < 0 ? '' : i < now ? 'done' : i === now ? 'on' : 'todo'}"><span class="sl-no">${i}</span><b>${esc(s.label)}</b>${s.v && s.v.name ? `<small>${esc(s.v.name)}</small>` : ''}</li>`).join('')}</ol>
      ${cur && cur.v && cur.v.text ? `<p class="stage-now"><b>${esc(cur.v.name || cur.label)}:</b> ${esc(cur.v.text)}</p>` : ''}`;
  }
  // extra lines under a mark: price / terms / breach / lasts until, reach, type, and (for a curse) the stage ladder
  function detailHtml(m, o) {
    const lines = global.EpitaphLibrary && global.EpitaphLibrary.markDetailLines ? global.EpitaphLibrary.markDetailLines(m) : [];
    const ladder = ladderHtml(m, o);
    return (ladder ? lines.filter(l => !isStageLine(l)) : lines).map(l => `<small class="mark-detail"><b>${esc(l.label)}:</b> ${esc(l.text)}</small>`).join('') + ladder;
  }
  function linesHtml(list, o) {
    return (list || []).map(m => `<div class="mark-line kind-${esc(m.kind)}${m.image ? ' has-img' : ''}">${sigilHtml(m)}<div class="mark-body">
      <div><span class="mark-tag ${esc(m.kind)}">${esc((LABEL[m.kind] || m.kind).toUpperCase())}</span> <b>${esc(m.name || 'Unnamed mark')}</b></div>
      ${m.source ? `<small>Source: ${esc(m.source)}</small>` : ''}
      ${m.effect ? `<p>${esc(m.effect)}</p>` : ''}
      ${detailHtml(m, o)}
    </div></div>`).join('');
  }
  global.EpitaphMarks = { KINDS, LABEL, normalize, clean, editor, linesHtml, readImage, sigilPickerHtml, sigilHtml, fieldsHtml, setField, newMark, kindsFor, ladderHtml, detailHtml, isStageLine };
})(typeof window !== 'undefined' ? window : globalThis);
