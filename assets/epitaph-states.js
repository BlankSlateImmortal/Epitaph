/* Epitaph — item states (e.g. Seal: Locked → Weakened), shared by the Atlas
 * Library and the book's Library view. Styles live in epitaph-theme.css.
 *
 * An item has up to three TRACKS of states (plan docs/plans/item-system.md): Item (its condition),
 * Usage (what part of a process it is in) and a third the author names (default "Connection").
 *
 *   const ed = EpitaphStates.tracksEditor(containerEl, item.stateTracks, uses)   // all three tracks
 *   ed.read()                                   // -> [{ kind, name, oneWay, primaryStateId, states }] (empty tracks are dropped by the Library)
 *   const ed = EpitaphStates.editor(containerEl, states, uses, { max })          // one list of states
 *   ed.read() / ed.peek()                       // cleaned copy / the raw draft (blank rows kept)
 *   EpitaphStates.trackHtml(item, uses)         // LOCKED ▸ WEAKENED per track, with who/when per state
 *   EpitaphStates.useText(rows)                 // "Orin · CH 3, 7"
 *
 * `uses` = EpitaphLibrary.uses(...): rows with `stateIds` (one state per track).
 * A state nobody's chapter uses yet is shown as "not reached". A state in use can't be removed here:
 * move those chapters to another state first. Needs assets/epitaph-marks.js.
 */
(function (global) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const newId = () => 'state_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const M = () => global.EpitaphMarks;
  const COLORS = ['gray', 'green', 'yellow', 'orange', 'red', 'purple', 'blue'];   // the author's seven
  const MAX_STATES = 7;
  const KINDS = [
    { kind: 'item', title: 'Item states', hint: 'its condition, e.g. Sealed → Broken', fixedName: 'Item' },
    { kind: 'usage', title: 'Usage states', hint: 'what part of a process it is in, e.g. Dormant → Active', fixedName: 'Usage' },
    { kind: 'custom', title: 'A third track', hint: 'name it yourself: Connection (Connected → No Signal), Hunger (Sated → Famished)…', fixedName: 'Connection' }
  ];

  // "Orin · CH 3, 7 · Sils · CH 12"
  function useText(rows) {
    const by = new Map();
    (rows || []).forEach(r => { if (!by.has(r.who)) by.set(r.who, []); by.get(r.who).push(r.ch != null ? r.ch : (r.label || '?')); });
    return [...by].map(([who, chs]) => `${who} · CH ${chs.join(', ')}`).join(' · ');
  }
  // state ids are unique across an item's tracks, so a row uses a state when any of its picks is that id
  const rowHas = (u, stateId) => (u.stateIds && Object.values(u.stateIds).includes(stateId)) || u.stateId === stateId;
  function usesOf(uses, stateId) { return (uses || []).filter(u => rowHas(u, stateId)); }
  const dot = c => `<i class="state-dot sc-${COLORS.includes(c) ? c : 'none'}" aria-hidden="true"></i>`;

  function trackHtml(item, uses) {
    const tracks = (item && item.stateTracks) || [];
    if (!tracks.length) return '';
    return tracks.map(t => {
      const unset = t.kind === 'item' ? (uses || []).filter(u => !(u.stateIds || {}).item || !t.states.some(s => s.id === u.stateIds.item)) : [];
      return `${tracks.length > 1 || t.kind !== 'item' ? `<div class="state-track-name">${esc(t.name)}${t.oneWay ? ' · one-way' : ''}</div>` : ''}
      <ol class="state-track">${t.states.map((s, i) => {
        const rows = usesOf(uses, s.id);
        return `<li class="state-step${rows.length ? ' reached' : ''}">
          <span class="state-no">${String(i + 1).padStart(2, '0')}</span>
          <b>${dot(s.color)}${esc((s.name || 'Unnamed state').toUpperCase())}</b>
          <small>${rows.length ? esc(useText(rows)) : 'not reached'}${t.primaryStateId === s.id && t.states.length > 1 ? ' · normal' : ''}</small>
        </li>`;
      }).join('<li class="state-arrow" aria-hidden="true">▸</li>')}</ol>
      ${unset.length ? `<p class="state-unset">No state set: ${esc(useText(unset))}</p>` : ''}`;
    }).join('');
  }

  function editor(container, states, uses, opts) {
    const max = (opts && opts.max) || MAX_STATES;
    let list = (states || []).map(s => ({ id: s.id || newId(), name: s.name || '', desc: s.desc || '', image: s.image || '', color: COLORS.includes(s.color) ? s.color : '', marks: (s.marks || []).slice() }));
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
            <select data-si="${i}" data-f="color" class="state-color" aria-label="State colour"><option value="">colour</option>${COLORS.map(c => `<option value="${c}"${s.color === c ? ' selected' : ''}>${c}</option>`).join('')}</select>
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
      }).join('')}${list.length < max ? '<button type="button" class="btn ghost mark-add state-add">+ Add state</button>' : `<small class="state-use">A track holds at most ${max} states.</small>`}</div>`;
      markEds = list.map((s, i) => M().editor(container.querySelector(`[data-smarks="${i}"]`), s.marks));
      container.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', () => {
        sync(); const [i, d] = b.dataset.move.split(':').map(Number);
        const j = i + d; if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]]; render();
      }));
      container.querySelectorAll('[data-sremove]').forEach(b => b.addEventListener('click', () => { sync(); list.splice(+b.dataset.sremove, 1); render(); }));
      const add = container.querySelector('.state-add');
      if (add) add.addEventListener('click', () => {
        sync(); list.push({ id: newId(), name: '', desc: '', image: '', color: '', marks: [] }); render();
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
      // the draft as it stands, blank rows included (for re-rendering around it)
      peek() { sync(); return list.map(s => ({ ...s, marks: s.marks.slice() })); },
      read() {
        sync();
        // keep states that have anything in them; an unnamed one gets a placeholder name
        return list.filter(s => s.name.trim() || s.desc.trim() || s.image || s.color || s.marks.length || usesOf(uses, s.id).length)
          .map((s, i) => ({ id: s.id, name: s.name.trim() || `State ${i + 1}`, desc: s.desc.trim(), image: s.image, color: s.color, marks: M().clean(s.marks) }));
      }
    };
  }

  // The three tracks of an item: add or remove a track, name the third, mark a track one-way, pick its normal state.
  function tracksEditor(container, tracks, uses) {
    const data = {}, eds = {};
    (tracks || []).forEach(t => { data[t.kind] = { name: t.name, oneWay: !!t.oneWay, primaryStateId: t.primaryStateId || '', states: (t.states || []).slice() }; });
    const used = new Set(); (uses || []).forEach(u => { Object.values(u.stateIds || {}).forEach(id => used.add(id)); if (u.stateId) used.add(u.stateId); });
    function capture(final) {
      KINDS.forEach(k => {
        const d = data[k.kind], sec = container.querySelector(`[data-tk="${k.kind}"]`); if (!d || !sec) return;
        if (eds[k.kind]) d.states = final ? eds[k.kind].read() : eds[k.kind].peek();
        const nm = sec.querySelector('[data-tf="name"]'); if (nm) d.name = nm.value;
        const ow = sec.querySelector('[data-tf="oneWay"]'); if (ow) d.oneWay = ow.checked;
        const pr = sec.querySelector('[data-tf="primary"]'); if (pr) d.primaryStateId = pr.value;
      });
    }
    const primaryOptions = (d, states) => `<option value="">first state</option>${states.map((s, i) => `<option value="${esc(s.id)}"${d.primaryStateId === s.id ? ' selected' : ''}>${esc(s.name || 'State ' + (i + 1))}</option>`).join('')}`;
    function render() {
      container.innerHTML = `<div class="tracks-editor">${KINDS.map(k => {
        const d = data[k.kind];
        if (!d) return `<div class="track-add"><button type="button" class="btn ghost mark-add" data-tadd="${k.kind}">+ Add ${esc(k.title.toLowerCase())}</button><small>${esc(k.hint)}</small></div>`;
        const locked = d.states.some(s => used.has(s.id));
        return `<section class="track-edit" data-tk="${k.kind}">
          <header><b>${esc(k.title)}</b><small>${esc(k.hint)}</small></header>
          <div class="track-opts">
            ${k.kind === 'custom' ? `<label>Track name <input type="text" data-tf="name" value="${esc(d.name)}" placeholder="Connection"></label>` : ''}
            <label class="track-check"><input type="checkbox" data-tf="oneWay"${d.oneWay ? ' checked' : ''}> One-way (a chapter can't go back to an earlier state)</label>
            <label>Normal state <select data-tf="primary">${primaryOptions(d, d.states)}</select></label>
          </div>
          <div data-tstates="${k.kind}"></div>
          ${locked ? '<small class="state-use">Some of its states are used in chapters, so the track can\'t be removed.</small>' : `<button type="button" class="btn ghost mark-remove" data-tremove="${k.kind}">Remove this track</button>`}
        </section>`;
      }).join('')}</div>`;
      KINDS.forEach(k => { if (data[k.kind]) eds[k.kind] = editor(container.querySelector(`[data-tstates="${k.kind}"]`), data[k.kind].states, uses, { max: MAX_STATES }); });
      container.querySelectorAll('[data-tk] [data-tf="primary"]').forEach(sel => sel.addEventListener('focus', () => {
        const k = sel.closest('[data-tk]').dataset.tk, cur = sel.value, ed = eds[k]; if (!ed) return;
        sel.innerHTML = primaryOptions({ primaryStateId: cur }, ed.peek());
      }));
      container.querySelectorAll('[data-tadd]').forEach(b => b.addEventListener('click', () => {
        capture(false); const k = b.dataset.tadd;
        data[k] = { name: KINDS.find(x => x.kind === k).fixedName, oneWay: k === 'item', primaryStateId: '', states: [{ id: newId(), name: '', desc: '', image: '', color: '', marks: [] }] };
        render();
      }));
      container.querySelectorAll('[data-tremove]').forEach(b => b.addEventListener('click', () => { capture(false); delete data[b.dataset.tremove]; delete eds[b.dataset.tremove]; render(); }));
    }
    render();
    return {
      read() {
        capture(true);
        return KINDS.filter(k => data[k.kind]).map(k => {
          const d = data[k.kind];
          return { kind: k.kind, name: (k.kind === 'custom' ? String(d.name || '').trim() : '') || k.fixedName, oneWay: !!d.oneWay,
            primaryStateId: d.states.some(s => s.id === d.primaryStateId) ? d.primaryStateId : (d.states[0] ? d.states[0].id : ''), states: d.states };
        });
      }
    };
  }
  global.EpitaphStates = { editor, tracksEditor, trackHtml, useText, COLORS, MAX_STATES };
})(typeof window !== 'undefined' ? window : globalThis);
