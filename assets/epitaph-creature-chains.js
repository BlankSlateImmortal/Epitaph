/* Epitaph — Cause and effect (Creature Log step 4.3; layout AF, approved 2026-11-23).
 *
 * Readable chains built only from what the log holds: each form's cause (an epoch, an age or a timeline event) and its change.
 * Read left to right: cause → the form it changed → the next cause → … A form with no cause written shows a "?" card in the cause's
 * place (a gap to fill; Checks already lists it). A line that died out ends on an "ended" card.
 *
 * Two ways to read them:
 *   · By lineage: every line split into branches. The first branch runs from the root along its biggest branch; every other branch starts
 *     at the fork it leaves from (a small "from …" card), so nothing is repeated.
 *   · By cause: pick a cause and see every form it changed, each with the form it came from and the forms that came after it.
 *
 *   EpitaphCreatureChains.byLineage(st)          → [{ root, from, cards: [card…] }]                    (pure, tested in Node)
 *   EpitaphCreatureChains.byCause(st, causeId)   → [{ cards }]
 *   EpitaphCreatureChains.causes(st)             → [{ id, label, kind, count }]   the causes in use, most used first
 *   EpitaphCreatureChains.gaps(st)               → [{ id, name }]                 forms with no cause
 *   EpitaphCreatureChains.mount(host, { st, side, reader, onOpen }) → { destroy() }
 *   card: { type: 'cause'|'form'|'gap'|'ended'|'from'|'sil', id?, label, sub?, kind?, cursed? }
 */
(function (global) {
  'use strict';
  const C = () => global.EpitaphCreatures, TL = () => global.EpitaphTimeline;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------------------------------------------------------- words for causes and times
  function causeInfo(c) {
    const K = C();
    const a = K.AGES.find(x => x.id === c); if (a) return { kind: 'age', label: 'Age ' + a.id + ' · ' + a.label };
    const e = K.EPOCHS.find(x => x.id === c); if (e) return { kind: 'epoch', label: e.label };
    const ev = TL() && TL().byId && TL().byId(c); return { kind: 'event', label: ev ? String(ev.title).split(/[:;]/)[0].slice(0, 60) : c };
  }
  function whenLbl(w) {
    const K = C(); if (w == null || w === '') return '';
    if (typeof w === 'object') { if (w.age) return 'Age ' + w.age; if (w.epoch) return (K.EPOCHS.find(e => e.id === w.epoch) || {}).label || w.epoch; return ''; }
    return causeInfo(w).label;
  }

  // ---------------------------------------------------------------- the tree, as the chains see it
  function forest(st) {
    const K = C(), recs = [].concat(st.nodes || [], st.creatures || []), by = new Map(recs.map(r => [r.id, r])), kids = new Map();
    const t = r => K.timeIndex(r.when) ?? 99, ord = (a, b) => t(a) - t(b) || String(a.name).localeCompare(String(b.name));
    const parentOf = r => (r.parentId && by.has(r.parentId) && r.parentId !== r.id ? r.parentId : null);
    // a record caught in a loop of parents counts as a root (like the tree), so every record is reached exactly once
    const inLoop = r => { const seen = new Set(); let p = parentOf(r); while (p && !seen.has(p)) { if (p === r.id) return true; seen.add(p); p = parentOf(by.get(p)); } return false; };
    recs.forEach(r => { const p = inLoop(r) ? '' : (parentOf(r) || ''); if (!kids.has(p)) kids.set(p, []); kids.get(p).push(r); });
    kids.forEach(list => list.sort(ord));
    return { by, kids: id => kids.get(id) || [], roots: kids.get('') || [] };
  }
  const formCard = r => (r.silhouette ? { type: 'sil', label: '? ? ?', sub: whenLbl(r.when) }
    : { type: 'form', id: r.id, label: r.name || r.id, sub: [whenLbl(r.when), (r.mutation && r.mutation.change) || ''].filter(Boolean).join(' · '), cursed: !!(r.mutation && r.mutation.curse) });
  const causeCard = c => { const i = causeInfo(c); return { type: 'cause', id: c, label: i.label, kind: i.kind }; };
  /** The cards for one form: its cause (unless the previous card already named the same cause), then the form; an "ended" card if it died out. */
  function step(r, prevCause, isLast) {
    const out = [];
    if (r.silhouette) { out.push(formCard(r)); return { cards: out, cause: null }; }
    if (r.cause) { if (r.cause !== prevCause) out.push(causeCard(r.cause)); }
    else out.push({ type: 'gap', id: r.id, label: '?', sub: 'no cause written' });
    out.push(formCard(r));
    if (r.extinct && isLast) out.push({ type: 'ended', id: r.id, label: 'died out', sub: whenLbl(r.extinct) });
    return { cards: out, cause: r.cause || null };
  }

  // ---------------------------------------------------------------- by lineage
  function byLineage(st) {
    const F = forest(st), chains = [], sizes = new Map();
    const size = r => { if (!sizes.has(r.id)) { sizes.set(r.id, 1); sizes.set(r.id, 1 + F.kids(r.id).reduce((n, k) => n + size(k), 0)); } return sizes.get(r.id); };
    const branch = (start, fromRec, root) => {
      const cards = fromRec ? [{ type: 'from', id: fromRec.id, label: fromRec.silhouette ? '? ? ?' : 'from ' + (fromRec.name || fromRec.id) }] : [];
      let cur = start, prevCause = fromRec ? fromRec.cause || null : null;
      while (cur) {
        const kids = F.kids(cur.id).slice().sort((x, y) => size(y) - size(x)), s = step(cur, prevCause, !kids.length); cards.push(...s.cards); prevCause = s.cause;      // the trunk follows the biggest branch
        kids.slice(1).forEach(k => pending.push([k, cur, root]));      // the other branches start here
        cur = kids[0] || null;
      }
      chains.push({ root: root.id, from: fromRec ? fromRec.id : null, cards });
    };
    const pending = [];
    F.roots.forEach(r => { branch(r, null, r); while (pending.length) { const [k, f, rt] = pending.shift(); branch(k, f, rt); } });
    return chains;
  }

  // ---------------------------------------------------------------- by cause
  function byCause(st, causeId) {
    const F = forest(st), out = [];
    [].concat(st.nodes || [], st.creatures || []).filter(r => !r.silhouette && r.cause === causeId).sort((a, b) => (C().timeIndex(a.when) ?? 99) - (C().timeIndex(b.when) ?? 99)).forEach(r => {
      const parent = r.parentId && F.by.get(r.parentId), cards = [];
      if (parent) cards.push(parent.silhouette ? { type: 'sil', label: '? ? ?' } : { type: 'from', id: parent.id, label: 'from ' + (parent.name || parent.id) });
      cards.push(causeCard(causeId), formCard(r));
      // then the line after it, until it forks or ends
      let cur = r, prev = causeId, guard = 0;
      while (guard++ < 60) {
        const ks = F.kids(cur.id);
        if (ks.length !== 1) { if (ks.length > 1) cards.push({ type: 'from', id: cur.id, label: ks.length + ' branches from here' }); else if (cur === r && r.extinct) cards.push({ type: 'ended', id: r.id, label: 'died out', sub: whenLbl(r.extinct) }); break; }
        const k = ks[0], st2 = step(k, prev, !F.kids(k.id).length); cards.push(...st2.cards); prev = st2.cause; cur = k;
      }
      out.push({ cards });
    });
    return out;
  }
  function causes(st) {
    const n = new Map(); [].concat(st.nodes || [], st.creatures || []).forEach(r => { if (!r.silhouette && r.cause) n.set(r.cause, (n.get(r.cause) || 0) + 1); });
    return [...n.entries()].map(([id, count]) => Object.assign({ id, count }, causeInfo(id))).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }
  const gaps = st => [].concat(st.nodes || [], st.creatures || []).filter(r => !r.silhouette && !r.cause).map(r => ({ id: r.id, name: r.name || r.id }));

  // ---------------------------------------------------------------- drawing
  function cardHtml(c) {
    const k = { cause: (c.kind || 'event').toUpperCase(), form: 'FORM', gap: 'CAUSE', ended: 'ENDED', from: 'BRANCHES', sil: 'NOT FOUND YET' }[c.type];
    const tag = c.type === 'cause' ? `<button type="button" class="cc-card cause" data-cause="${esc(c.id)}" title="Every form this changed">` : c.type === 'form' ? `<button type="button" class="cc-card form${c.cursed ? ' cu' : ''}" data-form="${esc(c.id)}" title="Open ${esc(c.label)}">` : `<div class="cc-card ${c.type}">`;
    return `${tag}<span class="cc-k">${k}${c.cursed ? ' · ⛓' : ''}</span><b>${esc(c.label)}</b>${c.sub ? `<span>${esc(c.sub)}</span>` : ''}${c.type === 'cause' || c.type === 'form' ? '</button>' : '</div>'}`;
  }
  const chainHtml = ch => `<div class="cc-chain">${ch.cards.map((c, i) => (i ? '<span class="cc-arr" aria-hidden="true">▸</span>' : '') + cardHtml(c)).join('')}</div>`;
  function mount(host, o) {
    const st = o.st; let mode = 'line', key = null;
    const paint = () => {
      const list = mode === 'cause' && key ? byCause(st, key) : byLineage(st), info = key ? causeInfo(key) : null;
      host.innerHTML = `<div class="cc"><div class="cw-bar"><span class="cw-fl">Read</span><div class="ct-tg" role="group" aria-label="Read the chains"><button type="button" data-mode="line" class="${mode === 'line' ? 'on' : ''}" aria-pressed="${mode === 'line'}">By lineage</button><button type="button" data-mode="cause" class="${mode === 'cause' ? 'on' : ''}" aria-pressed="${mode === 'cause'}">By cause</button></div>
        <span class="cw-when">${mode === 'cause' ? (info ? esc(info.label) + ` · ${list.length} form${list.length === 1 ? '' : 's'} changed` : 'pick a cause on the right page') : `${list.length} chain${list.length === 1 ? '' : 's'}`}</span></div>
        <div class="cc-body">${list.length ? list.map(chainHtml).join('') : `<p class="cw-none">${mode === 'cause' ? (key ? 'Nothing in the log names this cause.' : 'Pick a cause on the right page to see everything it changed.') : 'No lineages in the log yet.'}</p>`}</div></div>`;
      if (o.side) { const cs = causes(st), gp = gaps(st);
        o.side.innerHTML = `<div class="cw-card"><span class="cw-fl">Causes in the log</span>${cs.length ? `<div class="cc-causes">${cs.map(c => `<button type="button" data-cause="${esc(c.id)}" class="cwo-form${c.id === key && mode === 'cause' ? ' on' : ''}" aria-pressed="${c.id === key && mode === 'cause'}">${esc(c.label)} <i>${c.count}</i></button>`).join('')}</div>` : '<span class="cw-dim">No form names a cause yet.</span>'}</div>
          <div class="cw-card"><span class="cw-fl">Gaps</span>${gp.length ? `<span>${gp.length} form${gp.length === 1 ? ' has' : 's have'} no cause written; the chains show “?” there${o.reader ? '' : ' (Checks lists them too)'}.</span><div class="cc-causes">${gp.map(g => `<button type="button" data-form="${esc(g.id)}" class="cwo-form">${esc(g.name)}</button>`).join('')}</div>` : '<span class="cw-dim">Every form names its cause.</span>'}</div>
          <div class="cw-card cw-dim">Chains are drawn from each form's cause and change, nothing more. A cause card shows everything it changed; a form card opens its page.</div>`; }
    };
    paint();
    const click = e => { const t = e.target; if (!t.closest) return;
      const m = t.closest('[data-mode]'); if (m) { mode = m.dataset.mode; if (mode === 'cause' && !key) { const cs = causes(st); key = cs[0] ? cs[0].id : null; } paint(); return; }
      const c = t.closest('[data-cause]'); if (c) { mode = 'cause'; key = c.dataset.cause; paint(); return; }
      const f = t.closest('[data-form]'); if (f && o.onOpen) o.onOpen(f.dataset.form); };
    host.addEventListener('click', click); if (o.side) o.side.addEventListener('click', click);
    return { destroy: () => { host.removeEventListener('click', click); if (o.side) o.side.removeEventListener('click', click); } };
  }
  global.EpitaphCreatureChains = { byLineage, byCause, causes, gaps, mount, _t: { causeInfo, forest } };
})(typeof window !== 'undefined' ? window : globalThis);
