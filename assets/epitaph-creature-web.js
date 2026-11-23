/* Epitaph — the Food Web (Creature Log step 4.2; layout AE, picked 2026-11-23).
 *
 * Who eats whom at the scrubbed time, in levels: what eats nothing in the log at the bottom, each creature one level above the
 * highest thing it eats, apex hunters at the top. Lines run from the eater to what it eats (arrowhead on the eaten). Apex and
 * keystone creatures are marked (EpitaphCreatures.webRoles). A side card says what a picked creature eats, what eats it, and what
 * would starve if it vanished (EpitaphCreatures.wouldStarve). A row of 14 time chips (7 epochs, then ages A–G) scrubs it.
 *
 *   EpitaphCreatureWeb.model(st, at)        → { nodes, edges, levels, roles, links, creatures }       (pure, tested in Node)
 *   EpitaphCreatureWeb.changes(st, idx)     → { appeared, gone, linked, unlinked }  what differs from the band before
 *   EpitaphCreatureWeb.mount(host, { st, side, reader, sel, onPick }) → { select(id), setAt(i), destroy() }
 *
 * Built from the log's own links ("Eats" in a creature's form). It invents nothing: a creature with no link sits on the bottom row,
 * marked "eats nothing in the log". A reader gets it from the gated copy (only forms they've found; links to anything else dropped).
 */
(function (global) {
  'use strict';
  const C = () => global.EpitaphCreatures;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** The 14 time points: epochs 0–6, then ages A–G. */
  function bands() { const K = C(); return K.EPOCHS.map(e => ({ id: e.id, label: e.label, chip: String(K.EPOCHS.indexOf(e) + 1) })).concat(K.AGES.map(a => ({ id: a.id, label: 'Age ' + a.id + ' · ' + a.label, chip: a.id }))); }

  // ---------------------------------------------------------------- the model (pure)
  /** Creatures count as part of the web; a lineage step only when a link names it. */
  function pool(st) {
    const cr = (st.creatures || []).filter(x => !x.silhouette), nodes = (st.nodes || []).filter(x => !x.silhouette), linked = new Set();
    (st.food || []).forEach(l => { linked.add(l.eater); linked.add(l.eaten); });
    return cr.concat(nodes.filter(n => linked.has(n.id)));
  }
  function model(st, at) {
    const K = C(), all = pool(st), live = all.filter(c => K.aliveAt(c, at)), links = K.foodAt(at, st.food || [], live), roles = K.webRoles(at, st.food || [], all);
    const eats = new Map(live.map(c => [c.id, []])); links.forEach(l => eats.get(l.eater).push(l.eaten));
    const memo = new Map(), lvl = (id, trail) => { if (memo.has(id)) return memo.get(id); if (trail.has(id)) return 0;           // a cycle in the data counts as the base
      trail.add(id); const v = eats.get(id).length ? 1 + Math.max(...eats.get(id).map(e => lvl(e, trail))) : 0; trail.delete(id); memo.set(id, v); return v; };
    live.forEach(c => lvl(c.id, new Set()));
    const levels = live.length ? Math.max(...live.map(c => memo.get(c.id))) + 1 : 0, rows = [];
    for (let i = 0; i < levels; i++) rows.push(live.filter(c => memo.get(c.id) === i).sort((a, b) => String(a.name).localeCompare(String(b.name))));
    const nodes = [];
    rows.forEach((row, lv) => row.forEach((c, i) => { const r = roles[c.id] || {}; nodes.push({ id: c.id, name: c.name || c.id, level: lv, x: (i + 1) / (row.length + 1), apex: !!r.apex, keystone: !!r.keystone, base: !!r.base, alone: !r.eats.length && !r.eatenBy.length, eats: r.eats || [], eatenBy: r.eatenBy || [], conscious: K.isConscious(c) }); }));
    return { nodes, edges: links.map(l => ({ from: l.eater, to: l.eaten })), levels, roles, links, creatures: all };
  }
  /** What differs from the band before this one. */
  function changes(st, idx) {
    const K = C(), B = bands(); if (idx <= 0 || idx >= B.length) return { appeared: [], gone: [], linked: 0, unlinked: 0 };
    const a = model(st, B[idx - 1].id), b = model(st, B[idx].id), ia = new Set(a.nodes.map(n => n.id)), ib = new Set(b.nodes.map(n => n.id)), key = l => l.eater + '>' + l.eaten, ka = new Set(a.links.map(key)), kb = new Set(b.links.map(key));
    const name = id => { const c = b.creatures.find(x => x.id === id) || a.creatures.find(x => x.id === id); return c ? c.name || id : id; };
    return { appeared: [...ib].filter(x => !ia.has(x)).map(name), gone: [...ia].filter(x => !ib.has(x)).map(name), linked: [...kb].filter(x => !ka.has(x)).length, unlinked: [...ka].filter(x => !kb.has(x)).length };
  }
  const names = (m, ids) => ids.map(id => { const c = m.creatures.find(x => x.id === id); return c ? c.name || id : id; });

  // ---------------------------------------------------------------- drawing
  const W = 700, ROW = 118, PAD = 74;
  function svgWeb(m, sel) {
    const H = Math.max(1, m.levels) * ROW + PAD, y = lv => H - PAD - lv * ROW, by = new Map(m.nodes.map(n => [n.id, n])), x = n => 30 + n.x * (W - 60);
    const levelLbl = lv => (lv === 0 ? 'EATS NOTHING IN THE LOG' : lv === m.levels - 1 && m.levels > 1 ? 'TOP OF THE WEB' : 'LEVEL ' + (lv + 1));
    const bg = Array.from({ length: m.levels }, (_, lv) => `<line x1="0" x2="${W}" y1="${y(lv) + ROW / 2}" y2="${y(lv) + ROW / 2}" class="cw-lvl"/><text x="8" y="${y(lv) + ROW / 2 - 5}" class="cw-lvl-t">${levelLbl(lv)}</text>`).join('');
    const lines = m.edges.map(e => { const a = by.get(e.from), b = by.get(e.to); if (!a || !b) return ''; const x1 = x(a), y1 = y(a.level) + 14, x2 = x(b), y2 = y(b.level) - 16, on = sel && (e.from === sel || e.to === sel);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="cw-edge${on ? ' on' : ''}${sel && !on ? ' dim' : ''}" marker-end="url(#cwArr)"/>`; }).join('');
    const boxes = m.nodes.map(n => { const tag = n.apex ? 'APEX' : n.keystone ? 'KEYSTONE' : '', w = Math.max(70, 8 * (n.name.length + (tag ? tag.length + 1 : 0)) + 22);
      return `<g class="cw-node${n.apex ? ' apex' : ''}${n.keystone ? ' key' : ''}${n.base ? ' base' : ''}${n.alone ? ' alone' : ''}${n.id === sel ? ' sel' : ''}" data-node="${esc(n.id)}" transform="translate(${x(n) - w / 2},${y(n.level) - 14})" tabindex="0" role="button" aria-pressed="${n.id === sel}" aria-label="${esc(n.name)}${tag ? ', ' + tag.toLowerCase() : ''}${n.alone ? ', eats nothing in the log and is not eaten' : ''}">
        <rect width="${w}" height="28"/><text x="${w / 2}" y="19" text-anchor="middle">${esc(n.name)}${tag ? `<tspan class="cw-tag"> ${tag}</tspan>` : ''}</text></g>`; }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" class="cw-svg" role="group" aria-label="The food web: eaters at the top, what they eat below"><defs><marker id="cwArr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#b5904f"/></marker></defs>${bg}${lines}${boxes}</svg>`;
  }
  function sideHtml(st, m, sel, idx, reader) {
    const K = C(), B = bands(), ch = changes(st, idx), n = sel && m.nodes.find(x => x.id === sel);
    const diff = `<div class="cw-card"><span class="cw-fl">Since ${esc(idx > 0 ? B[idx - 1].label : 'the start')}</span>${idx <= 0 ? '<span class="cw-dim">The first point in time.</span>' :
      (ch.appeared.length || ch.gone.length || ch.linked || ch.unlinked) ? `<span>${[ch.appeared.length ? '+ ' + ch.appeared.map(esc).join(', ') : '', ch.gone.length ? '− ' + ch.gone.map(esc).join(', ') + ' (died out)' : '', ch.linked ? `${ch.linked} new link${ch.linked === 1 ? '' : 's'}` : '', ch.unlinked ? `${ch.unlinked} link${ch.unlinked === 1 ? '' : 's'} ended` : ''].filter(Boolean).join(' · ')}</span>` : '<span class="cw-dim">Nothing changed.</span>'}</div>`;
    const roles = '<div class="cw-card"><span class="cw-fl">Roles</span><span><b>APEX</b>: eats, and nothing eats it · <b>KEYSTONE</b>: the only food of two or more, or eaten by four or more · bottom row: eats nothing in the log</span></div>';
    if (!n) return `<div class="cw-card"><span class="cw-fl">${esc(B[idx].label)}</span><span>${m.nodes.length} creature${m.nodes.length === 1 ? '' : 's'} alive · ${m.edges.length} link${m.edges.length === 1 ? '' : 's'}.</span>${m.edges.length ? '' : '<span class="cw-dim">No creature has an “Eats” link yet' + (reader ? '.' : ': add them in a creature’s form (Creatures tab → Eats).') + '</span>'}<span class="cw-dim">Pick a creature to see what it eats and what would starve without it.</span></div>${diff}${roles}`;
    const starve = names(m, K.wouldStarve(n.id, B[idx].id, st.food || [], m.creatures.filter(c => K.aliveAt(c, B[idx].id))));
    return `<div class="cw-card pick"><span class="cw-fl">Picked</span><b>${esc(n.name)}</b><span class="cw-role">${n.apex ? 'APEX' : n.keystone ? 'KEYSTONE' : n.alone ? 'Not linked to anything yet' : n.base ? 'Eats nothing in the log' : 'Eats and is eaten'}</span>
      <span>Eats: ${n.eats.length ? names(m, n.eats).map(esc).join(', ') : '<span class="cw-dim">nothing in the log</span>'}</span><span>Eaten by: ${n.eatenBy.length ? names(m, n.eatenBy).map(esc).join(', ') : '<span class="cw-dim">nothing in the log</span>'}</span>
      <span class="cw-dim">If it vanished: ${starve.length ? 'these would starve: ' + starve.map(esc).join(', ') : 'nothing in the log would starve'}.</span>
      ${reader ? '' : `<button type="button" class="cl-new" data-page="${esc(n.id)}">Open page ▸</button>`}</div>${diff}${roles}`;
  }

  function mount(host, o) {
    const B = bands(); let at = 13, sel = o.sel || null, st = o.st;
    host.innerHTML = `<div class="cw"><div class="cw-bar"><span class="cw-fl">Time</span><div class="cw-chips" role="group" aria-label="Point in time">${B.map((b, i) => `<button type="button" data-at="${i}" class="${i === at ? 'on' : ''}${i >= 11 ? ' cu' : ''}" aria-pressed="${i === at}" aria-label="${esc(b.label)}">${esc(b.chip)}</button>`).join('')}</div><span class="cw-when" aria-live="polite"></span></div><div class="cw-stage"></div></div>`;
    const stage = host.querySelector('.cw-stage'), when = host.querySelector('.cw-when');
    const paint = () => { const m = model(st, B[at].id); when.textContent = B[at].label + (at === 13 ? ' · now' : '');
      stage.innerHTML = m.nodes.length ? svgWeb(m, sel) : '<p class="cw-none">No creature is alive at this time' + (st.creatures && st.creatures.length ? '.' : ': the log has no creatures yet.') + '</p>';
      host.querySelectorAll('.cw-chips button').forEach((b, i) => { b.classList.toggle('on', i === at); b.setAttribute('aria-pressed', i === at); });
      if (o.side) o.side.innerHTML = sideHtml(st, m, sel, at, !!o.reader); };
    paint();
    const pick = id => { sel = id === sel ? null : id; paint(); if (sel) { const g = stage.querySelector(`[data-node="${CSS.escape(sel)}"]`); if (g) g.focus(); } if (o.onPick) o.onPick(sel); };
    const click = e => { const t = e.target; if (!t.closest) return; const c = t.closest('[data-at]'); if (c) { at = +c.dataset.at; paint(); return; } const n = t.closest('[data-node]'); if (n) pick(n.dataset.node); };
    const key = e => { const n = e.target.closest && e.target.closest('[data-node]'); if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(n.dataset.node); } };
    host.addEventListener('click', click); host.addEventListener('keydown', key);
    const sideClick = e => { const b = e.target.closest && e.target.closest('[data-page]'); if (b && o.onOpen) o.onOpen(b.dataset.page); };
    if (o.side) o.side.addEventListener('click', sideClick);
    return { select: id => { sel = id; paint(); }, setAt: i => { at = Math.max(0, Math.min(13, i)); paint(); }, destroy: () => { host.removeEventListener('click', click); host.removeEventListener('keydown', key); if (o.side) o.side.removeEventListener('click', sideClick); } };
  }
  global.EpitaphCreatureWeb = { bands, model, changes, mount };
})(typeof window !== 'undefined' ? window : globalThis);
