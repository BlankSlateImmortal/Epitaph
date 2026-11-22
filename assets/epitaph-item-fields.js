/* Epitaph — the item fields both item editors share (the Atlas Library drawer and the book's Library view).
 * Plan: docs/plans/item-system.md, step 2.1. Styles live in epitaph-theme.css (.if-*).
 *
 *   const d = EpitaphItemFields.mountDetails(el, draft, { placeOptionsHtml, getMarks, getTracks })
 *   d.read()   -> { origin, originCircumstance, rank, tier, wip, (weight, appearance, maker when switched on) }
 *   const h = EpitaphItemFields.mountHistory(el, draft, { getTracks, holders })
 *   h.read()   -> [history entry] in timeline order, empty rows dropped
 *   EpitaphItemFields.cleanItem(draft)      -> the saved shape of an item (trimmed, marks and tracks cleaned)
 *   EpitaphItemFields.originText(item, placeName)  -> "from Aurelia" | "no origin" | "origin unknown"
 *   EpitaphItemFields.badgesHtml(item, entry?, { wip, asOf })  -> rank (now, for an inventory entry; as of a chapter for a reader), tier and W.I.P tags
 *
 * `getMarks()` and `getTracks()` return the host editor's current (unsaved) marks and tracks, so the
 * highest rank the item can reach (and the tiers that rank locks) follows what is on screen.
 * Needs assets/epitaph-library.js, epitaph-marks.js and epitaph-states.js.
 */
(function (global) {
  'use strict';
  const L = () => global.EpitaphLibrary;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ERA_LABEL = { BEFORE: 'Before Epitaph', ERA_0: 'Era 0', ERA_1: 'Era 1' };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const newId = () => 'hist_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const int = v => (v === '' || v == null || !isFinite(Number(v)) ? undefined : Math.trunc(Number(v)));

  function originText(it, placeName) {
    const o = it && it.origin;
    if (o === 'none') return 'no origin';
    if (!o || o === 'unknown') return 'origin unknown';
    return 'from ' + ((placeName && placeName(o)) || 'a missing place');
  }
  // Rank, tier and W.I.P tags. With an inventory `entry` the rank is the rank NOW (the active bindings), and when the item can reach
  // higher in another state that is shown too. `opts.wip === false` hides W.I.P (it is for the author's eyes only).
  function badgesHtml(it, entry, opts) {
    if (!it) return '';
    const asOf = opts && Number.isInteger(opts.asOf) ? opts.asOf : null;
    const lib = L(), mx = lib.maxRank(it, asOf), now = entry ? lib.rankAt(it, entry, asOf) : mx, tag = n => `${n} · ${lib.rankName(n).toUpperCase()}`;
    return [now ? `<span class="if-badge rank" title="How far its effect reaches${entry ? ' in this chapter' : ''}">RANK ${esc(tag(now))}</span>` : '',
      entry && mx > now ? `<span class="if-badge dim" title="The highest rank it can reach in any state">CAN REACH ${esc(tag(mx))}</span>` : '',
      it.tier ? `<span class="if-badge tier ${esc(it.tier)}" title="Who could make it">${esc(it.tier.toUpperCase())}</span>` : '',
      it.wip && !(opts && opts.wip === false) ? '<span class="if-badge wip">W.I.P</span>' : ''].join('');
  }

  // ---- the details block --------------------------------------------------------
  function mountDetails(container, draft, opts) {
    opts = opts || {}; const lib = L();
    const marks = () => (opts.getMarks ? opts.getMarks() : draft.marks) || [];
    const tracks = () => (opts.getTracks ? opts.getTracks() : draft.stateTracks) || [];
    const origin = draft.origin || '';
    const placeHtml = opts.placeOptionsHtml ? opts.placeOptionsHtml(origin) : '';
    const missing = origin && !lib.ORIGIN_WORDS.includes(origin) && !placeHtml.includes(`value="${esc(origin)}"`);
    const opt = (v, label, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(label)}</option>`;
    const text = (name, label, ph) => lib.fieldOn(name) ? `<label class="if-f">${esc(label)}<input type="text" data-if="${name}" value="${esc(draft[name] || '')}" placeholder="${esc(ph)}"></label>` : '';
    container.innerHTML = `<div class="if-details">
      <label class="if-f">Where it came from<select data-if="origin">
        ${opt('', '— not filled in —', origin === '')}${opt('none', 'None — it has no origin', origin === 'none')}${opt('unknown', 'Unknown (???)', origin === 'unknown')}
        ${missing ? opt(origin, '⚠ a place that no longer exists', true) : ''}${placeHtml}</select></label>
      <label class="if-f">How it came to be <em>— origin circumstance</em><textarea data-if="originCircumstance" rows="3" placeholder="The story of how it was made, found or given">${esc(draft.originCircumstance || '')}</textarea></label>
      <div class="if-row">
        <label class="if-f">Rank <em>— how far its effect reaches</em><select data-if="rank">${opt('', '— not set —', !draft.rank)}${lib.RANKS.slice(1).map((n, i) => opt(String(i + 1), `${i + 1} · ${n}`, draft.rank === i + 1)).join('')}</select></label>
        <label class="if-f">Tier <em>— who could make it</em><select data-if="tier"></select></label>
      </div>
      <p class="if-note" data-if-note></p>
      <label class="if-check"><input type="checkbox" data-if="wip"${draft.wip ? ' checked' : ''}> Work in progress <em>(shown as W.I.P; never shown to readers)</em></label>
      ${text('weight', 'Weight', 'e.g. 2 kg')}${text('appearance', 'Appearance', 'What it looks like')}${text('maker', 'Maker', 'A name or character')}
    </div>`;
    const q = n => container.querySelector(`[data-if="${n}"]`);
    function temp() { return { rank: int(q('rank').value) || 0, marks: marks(), stateTracks: tracks() }; }
    // tiers a rank forbids are locked (shown, not selectable); an already-saved tier below the floor stays visible and is flagged
    function refresh() {
      const t = temp(), mx = lib.maxRank(t), allowed = lib.allowedTiers(mx), cur = q('tier').dataset.cur != null ? q('tier').dataset.cur : (draft.tier || '');
      q('tier').innerHTML = opt('', '— not set —', !cur) + lib.TIERS.map(x => `<option value="${x}"${x === cur ? ' selected' : ''}${allowed.includes(x) ? '' : ' disabled'}>${cap(x)}${allowed.includes(x) ? '' : ' — locked by its rank'}</option>`).join('');
      const problem = lib.tierProblem({ ...t, tier: cur });
      const base = t.rank;
      q('tier').parentNode.classList.toggle('if-bad', !!problem);
      container.querySelector('[data-if-note]').textContent = problem || (mx > base ? `Highest rank it can reach: ${mx} · ${lib.rankName(mx)} (from a binding).` : '');
    }
    q('rank').addEventListener('change', refresh);
    q('tier').addEventListener('change', () => { q('tier').dataset.cur = q('tier').value; refresh(); });
    q('tier').addEventListener('focus', refresh);
    refresh();
    return {
      refresh,
      read() {
        const out = { origin: q('origin').value, originCircumstance: q('originCircumstance').value, rank: int(q('rank').value) || 0,
          tier: q('tier').value, wip: q('wip').checked };
        ['weight', 'appearance', 'maker'].forEach(n => { if (q(n)) out[n] = q(n).value; });
        return out;
      }
    };
  }

  // ---- history entries ----------------------------------------------------------
  function mountHistory(container, draft, opts) {
    opts = opts || {};
    let list = (draft.history || []).map(h => ({ id: h.id || newId(), era: (h.when || {}).era || 'ERA_1', year: (h.when || {}).year, approx: (h.when || {}).approx === true, chapter: (h.when || {}).chapter,
      holder: h.holder || '', stateIds: { ...(h.stateIds || {}) }, text: h.text || '' }));
    const uid = Math.random().toString(36).slice(2, 7);
    const tracks = () => (opts.getTracks ? opts.getTracks() : draft.stateTracks) || [];
    const stateSelects = (e) => tracks().map(t => `<label class="if-state-pick">${esc(t.name)}<select data-hs="${esc(t.kind)}"><option value="">—</option>${t.states.map((s, i) => `<option value="${esc(s.id)}"${e.stateIds[t.kind] === s.id ? ' selected' : ''}>${esc(s.name || 'State ' + (i + 1))}</option>`).join('')}</select></label>`).join('');
    function sync() {
      container.querySelectorAll('[data-hi]').forEach(row => {
        const e = list[+row.dataset.hi]; if (!e) return;
        e.era = row.querySelector('[data-hf="era"]').value; e.year = int(row.querySelector('[data-hf="year"]').value); e.approx = row.querySelector('[data-hf="approx"]').checked;
        e.chapter = int(row.querySelector('[data-hf="chapter"]').value); e.holder = row.querySelector('[data-hf="holder"]').value;
        e.text = row.querySelector('[data-hf="text"]').value;
        const ids = {}; row.querySelectorAll('[data-hs]').forEach(sel => { if (sel.value) ids[sel.dataset.hs] = sel.value; }); e.stateIds = ids;
      });
    }
    function render() {
      const names = opts.holders ? opts.holders() : [];
      container.innerHTML = `<div class="if-history">${list.length ? '' : '<small class="if-empty">Nothing yet. Add what happened to it before the story, or off the page.</small>'}${list.map((e, i) => `
        <div class="if-hist" data-hi="${i}">
          <div class="if-hist-top">
            <select data-hf="era" aria-label="Era">${Object.keys(ERA_LABEL).map(k => `<option value="${k}"${e.era === k ? ' selected' : ''}>${ERA_LABEL[k]}</option>`).join('')}</select>
            <input type="number" data-hf="year" value="${e.year == null ? '' : e.year}" placeholder="year, e.g. −4219" step="1" aria-label="Year (counted from the siege; negative = before it)" title="Year, counted from the siege; a minus sign means before it (−4219); blank if unknown">
            <label class="if-approx" title="An approximate year"><input type="checkbox" data-hf="approx"${e.approx ? ' checked' : ''}> ≈</label>
            <input type="number" data-hf="chapter" value="${e.chapter == null ? '' : e.chapter}" placeholder="chapter" min="1" step="1" aria-label="Chapter">
            <input type="text" data-hf="holder" value="${esc(e.holder)}" placeholder="held by" list="ifHolders${uid}" aria-label="Held by">
            <button type="button" class="btn ghost state-move" data-hmove="${i}:-1" ${i ? '' : 'disabled'} aria-label="Move earlier">↑</button>
            <button type="button" class="btn ghost state-move" data-hmove="${i}:1" ${i < list.length - 1 ? '' : 'disabled'} aria-label="Move later">↓</button>
          </div>
          <div class="if-hist-states">${stateSelects(e)}</div>
          <textarea data-hf="text" rows="2" placeholder="What happened to it">${esc(e.text)}</textarea>
          <button type="button" class="btn ghost mark-remove" data-hremove="${i}">Remove entry</button>
        </div>`).join('')}
        <datalist id="ifHolders${uid}">${names.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>
        <button type="button" class="btn ghost mark-add" data-hadd>+ Add history entry</button></div>`;
      container.querySelectorAll('[data-hmove]').forEach(b => b.addEventListener('click', () => {
        sync(); const [i, d] = b.dataset.hmove.split(':').map(Number); const j = i + d; if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]]; render();
      }));
      container.querySelectorAll('[data-hremove]').forEach(b => b.addEventListener('click', () => { sync(); list.splice(+b.dataset.hremove, 1); render(); }));
      container.querySelector('[data-hadd]').addEventListener('click', () => { sync(); list.push({ id: newId(), era: 'BEFORE', year: undefined, approx: false, chapter: undefined, holder: '', stateIds: {}, text: '' }); render(); });
      // state choices follow the tracks as they are being edited
      container.querySelectorAll('.if-hist-states').forEach(box => box.addEventListener('focusin', () => {
        const row = box.closest('[data-hi]'), e = list[+row.dataset.hi]; sync(); box.innerHTML = stateSelects(e);
      }, { once: false }));
    }
    render();
    return {
      read() {
        sync();
        const valid = new Set(); tracks().forEach(t => t.states.forEach(s => valid.add(s.id)));
        const out = list.map(e => ({ id: e.id, when: { era: e.era, ...(e.year != null ? { year: e.year } : {}), ...(e.year != null && e.approx ? { approx: true } : {}), ...(e.chapter != null ? { chapter: e.chapter } : {}) },
          holder: e.holder.trim(), stateIds: Object.fromEntries(Object.entries(e.stateIds).filter(([, id]) => valid.has(id))), text: e.text.trim() }))
          .filter(e => e.text || e.holder || Object.keys(e.stateIds).length || e.when.year != null || e.when.chapter != null);
        const order = (a, b) => L().compareWhen(a.when, b.when);
        return out.map((e, i) => ({ e, i })).sort((x, y) => order(x.e, y.e) || x.i - y.i).map(x => x.e);   // stable: ties keep your order
      }
    };
  }

  // ---- the saved shape of an item ---------------------------------------------------
  // Used to save an item and to tell whether anything changed, so it must give the same result for a stored item and its draft.
  function cleanItem(d) {
    const M = global.EpitaphMarks, t = s => String(s == null ? '' : s).trim();
    return {
      name: t(d.name), desc: t(d.desc), origin: d.origin || '', originCircumstance: t(d.originCircumstance),
      rank: Number.isInteger(d.rank) ? d.rank : 0, tier: d.tier || '', wip: d.wip === true,
      weight: t(d.weight), appearance: t(d.appearance), maker: t(d.maker), note: t(d.note), icon: d.icon || '', image: d.image || '',
      marks: M.clean(d.marks || []),
      stateTracks: (d.stateTracks || []).map(tr => ({ id: tr.kind, kind: tr.kind, name: t(tr.name), oneWay: !!tr.oneWay, primaryStateId: tr.primaryStateId || '',
        states: (tr.states || []).map(s => ({ id: s.id, name: t(s.name), desc: t(s.desc), image: s.image || '', color: s.color || '', marks: M.clean(s.marks || []) })) })),
      history: (d.history || []).map(h => ({ id: h.id, when: h.when, holder: t(h.holder), stateIds: h.stateIds || {}, text: t(h.text) }))
    };
  }
  global.EpitaphItemFields = { mountDetails, mountHistory, cleanItem, originText, badgesHtml };
})(typeof window !== 'undefined' ? window : globalThis);
