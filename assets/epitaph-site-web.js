/* Epitaph — the relations ring (Site Encyclopedia step 4.2).
 *
 * Every place sits in a fixed seat on a ring, grouped by type (or by country); ties are chords between seats, coloured by kind.
 * Seats never move while the chapter changes, so stepping through chapters reads like a flipbook: chords appear and fade.
 * The left page lists what changed in the chapter, the busiest places, and whatever is picked (a place or a tie).
 *
 * Reader safety: everything comes from EpitaphSites.webAt (the same gate as the entry and the published snapshot). A reader can only
 * scrub up to their own chapter, never sees a secret tie early, a place they haven't reached, or where an unreached end falls.
 * A tie's words (terms, note) come from forReader(owner), so author-only keys never reach a reader.
 *
 * Lives inside the book while it shows the encyclopedia: a layer #seWeb over the places index, the ring in #bookPanel.
 * Opens from the index ("Relations") and from a place's Foreign tab ("See in the ring").
 */
(function (global) {
  'use strict';
  const S = () => global.EpitaphSites, Wd = () => global.EpitaphWorld, TL = () => global.EpitaphTimeline;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KINDS = ['alliance', 'vassal', 'trade', 'truce', 'rivalry', 'war', 'covert'];
  const DIRECTED = { vassal: 1, covert: 1 };
  const TYPE_COL = { STORYBORN: 'var(--amber-hi)', VOIDED: 'var(--sw-violet)', FALLEN: 'var(--ember)' };
  const shortName = n => String(n || '').split(/\s+[—–-]\s+/).pop();
  const title = t => String(t || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  let web = null;   // { ch, group, sel: null | {place} | {edge}, off: Set(kind), from: placeId|null }

  function inEncyclopedia() { const b = document.getElementById('theBook'); return !!(b && b.dataset.view === 'sites' && document.getElementById('bkSandbox')); }
  const place = id => (Wd() && Wd().place(id)) || { id, name: id };
  const nameOf = id => shortName(place(id).name);
  const typeOf = id => { const r = S() && S().get(id); const st = r && r.domestic && r.domestic.government && r.domestic.government.stance; return String(place(id).group || st || 'Other').toUpperCase(); };
  const countryOf = id => { const W = Wd(), p = place(id), c = W && p.countryId && W.country(p.countryId); return c ? c.name : 'Unplaced'; };
  const isStatue = id => { const W = Wd(); return !!(W && W.STATUES && W.STATUES.includes(id)); };

  /** Who is looking and how far they may scrub. */
  function viewer() {
    const T = TL(), author = T ? T.authorMode() : true, chs = T && T.chapters ? T.chapters() : [];
    const latest = T && T.latestChapter ? T.latestChapter() : null, rc = T ? T.readerChapter() : null;
    const top = author ? latest : (rc == null ? latest : rc);
    const list = chs.filter(n => n >= 1 && (top == null || n <= top));
    return { T, author, list, top, rc };
  }
  /** Everything one draw needs. */
  function model() {
    const Si = S(), v = viewer(), recs = Si.load();
    if (web.ch == null || (v.top != null && web.ch > v.top) || (v.list.length && !v.list.includes(web.ch))) web.ch = v.top;
    const ch = web.ch;
    const now = Si.webAt(ch, recs, v.author);
    const widest = Si.webAt(v.top, recs, v.author);                     // seats come from the widest set this viewer may see
    const ids = [...new Set(widest.nodes.map(n => n.id).concat(now.nodes.map(n => n.id)))];
    const blocsNow = Si.blocsAt(ch, recs, v.author), blocsWide = Si.blocsAt(v.top, recs, v.author);
    // seating by bloc uses the widest chapter, so seats stay put while scrubbing; a place in two blocs sits with the larger one
    const home = new Map(); blocsWide.slice().sort((x, y) => y.members.length - x.members.length || x.name.localeCompare(y.name)).forEach(b => b.members.forEach(mm => { if (!home.has(mm.place)) home.set(mm.place, b.name || 'Unnamed bloc'); }));
    const groupOf = web.group === 'country' ? countryOf : web.group === 'bloc' ? (id => home.get(id) || 'No bloc') : typeOf;
    const ring = Si.ringSeats(ids, groupOf, nameOf, isStatue);
    const edges = now.edges.filter(e => !web.off.has(e.kind));
    const present = new Map(now.nodes.map(n => [n.id, n]));
    return { Si, v, recs, ch, now, ring, edges, present, blocsNow };
  }

  // ---------------------------------------------------------------- the ring (right page)
  const VB = 1000, CX = 500, CY = 500, RR = 330;
  const pt = a => [CX + Math.cos(a) * RR, CY + Math.sin(a) * RR];
  function chord(e, m) {
    const p = pt(m.ring.seats[e.a]), q = pt(m.ring.seats[e.b]);
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, k = 0.3, c = [mx + (CX - mx) * k, my + (CY - my) * k];
    const d = `M${p[0].toFixed(1)} ${p[1].toFixed(1)} Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
    // the curve's middle and direction, for the arrow on directed ties (from the owner, who serves or spies)
    const B = t => [(1 - t) * (1 - t) * p[0] + 2 * (1 - t) * t * c[0] + t * t * q[0], (1 - t) * (1 - t) * p[1] + 2 * (1 - t) * t * c[1] + t * t * q[1]];
    const m0 = B(0.5), m1 = B(0.53), ang = Math.atan2(m1[1] - m0[1], m1[0] - m0[0]) * 180 / Math.PI;
    const sel = web.sel, bl = sel && sel.bloc && m.blocsNow.find(x => x.key === sel.bloc), inB = id => !!bl && bl.members.some(x => x.place === id && !x.left);
    const mine = sel && (sel.place ? (e.a === sel.place || e.b === sel.place) : sel.bloc ? (inB(e.a) && inB(e.b)) : sel.edge === e.key);
    const cls = ['sw-ch', 'k-' + e.kind, e.hidden ? 'hid' : '', e.ended ? 'end' : '', sel ? (mine ? 'on' : 'off') : '', e.kind === 'war' ? 'war' : ''].filter(Boolean).join(' ');
    const tip = `${nameOf(e.a)} ${DIRECTED[e.kind] ? '→' : '↔'} ${nameOf(e.b)} · ${m.Si.label(m.Si.ALLIANCE_KINDS, e.kind)}${e.ended ? ' (ended)' : ''}${e.hidden ? ' · readers can’t see this yet' : ''}`;
    return `<g class="${cls}" data-sw-edge="${esc(e.key)}" tabindex="0" role="button" aria-label="${esc(tip)}"><title>${esc(tip)}</title>
      <path class="hit" d="${d}"/><path class="ln" d="${d}"/>${DIRECTED[e.kind] ? `<path class="ar" d="M-9 -6 L7 0 L-9 6 Z" transform="translate(${m0[0].toFixed(1)} ${m0[1].toFixed(1)}) rotate(${ang.toFixed(1)})"/>` : ''}</g>`;
  }
  function seat(id, m) {
    const a = m.ring.seats[id], [x, y] = pt(a), n = m.present.get(id), st = isStatue(id), r = st ? 17 : 12;
    const right = Math.cos(a) > 0.05, left = Math.cos(a) < -0.05, lx = x + Math.cos(a) * (r + 12), ly = y + Math.sin(a) * (r + 12) + 6;
    const anchor = right ? 'start' : left ? 'end' : 'middle', dy = !right && !left ? (Math.sin(a) < 0 ? -10 : 16) : 0;
    const bl = web.sel && web.sel.bloc && m.blocsNow.find(x => x.key === web.sel.bloc), sel = (web.sel && web.sel.place === id) || (!!bl && bl.members.some(x => x.place === id && !x.left)), ties = m.edges.filter(e => e.a === id || e.b === id).length;
    const col = TYPE_COL[typeOf(id)] || 'var(--amber)';
    if (!n) return `<g class="sw-seat empty"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/></g>`;
    const tip = `${place(id).name}${ties ? ' · ' + ties + ' tie' + (ties === 1 ? '' : 's') : ''}${n.hidden ? ' · readers haven’t reached it yet' : ''}`;
    return `<g class="sw-seat${n.hidden ? ' hid' : ''}${sel ? ' on' : ''}" data-sw-seat="${esc(id)}" tabindex="0" role="button" aria-label="${esc(tip)}" style="--c:${col}"><title>${esc(tip)}</title>
      <circle class="dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/>${st ? `<text class="star" x="${x.toFixed(1)}" y="${(y + 7).toFixed(1)}" text-anchor="middle">★</text>` : ''}
      <text class="lab" x="${lx.toFixed(1)}" y="${(ly + dy).toFixed(1)}" text-anchor="${anchor}">${esc(nameOf(id))}</text></g>`;
  }
  function ringSvg(m) {
    const groups = m.ring.groups.length > 1 ? m.ring.groups.map(g => {
      const mid = (g.a0 + g.a1) / 2, r2 = RR - 34, x = CX + Math.cos(mid) * r2, y = CY + Math.sin(mid) * r2 + 9;   // just inside the rim: seat labels always point outward
      const arc = (a0, a1, r) => { const p = [CX + Math.cos(a0 - 0.12) * r, CY + Math.sin(a0 - 0.12) * r], q = [CX + Math.cos(a1 + 0.12) * r, CY + Math.sin(a1 + 0.12) * r]; const big = (a1 - a0 + 0.24) > Math.PI ? 1 : 0; return `M${p[0].toFixed(1)} ${p[1].toFixed(1)} A${r} ${r} 0 ${big} 1 ${q[0].toFixed(1)} ${q[1].toFixed(1)}`; };
      const col = web.group === 'type' ? (TYPE_COL[g.name] || 'var(--amber)') : 'var(--amber-dim)';
      return `<path class="sw-arc" d="${arc(g.a0, g.a1, RR + 52)}" style="stroke:${col}"/><text class="sw-grp" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${Math.cos(mid) > 0.3 ? 'end' : Math.cos(mid) < -0.3 ? 'start' : 'middle'}" style="fill:${col}">${esc(web.group === 'type' ? g.name : g.name.toUpperCase())}</text>`;
    }).join('') : '';
    const order = m.edges.slice().sort((x, y) => (y.ended - x.ended) || (y.hidden - x.hidden));   // ended and hidden underneath
    return `<svg class="sw-svg" viewBox="-80 -40 ${VB + 160} ${VB + 80}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Relations ring">
      <circle class="sw-rim" cx="${CX}" cy="${CY}" r="${RR}"/>${groups}${order.map(e => chord(e, m)).join('')}${Object.keys(m.ring.seats).map(id => seat(id, m)).join('')}</svg>`;
  }
  function legendHtml(m) {
    const used = new Set(m.now.edges.map(e => e.kind));
    return `<div class="sw-leg">${KINDS.map(k => `<button type="button" class="sw-k k-${k}${web.off.has(k) ? ' off' : ''}${used.has(k) ? '' : ' unused'}" data-sw-kind="${k}" aria-pressed="${!web.off.has(k)}" title="Show or hide ${esc(m.Si.label(m.Si.ALLIANCE_KINDS, k))} ties"><i></i>${esc(m.Si.label(m.Si.ALLIANCE_KINDS, k))}</button>`).join('')}
      <span class="sw-key">${m.v.author ? '<i class="d"></i>readers can’t see it yet · ' : ''}<i class="f"></i>ended · ▶ serves or spies on · ★ statue site</span></div>`;
  }
  function scrubHtml(m) {
    const L = m.v.list;
    if (!L.length) return `<div class="sw-scrub"><span class="dim">No chapters yet: showing everything.</span></div>`;
    const i = L.indexOf(m.ch);
    return `<div class="sw-scrub"><label for="swSl">Chapter</label>
      <button type="button" class="sw-step" data-sw-step="-1" aria-label="Previous chapter"${i <= 0 ? ' disabled' : ''}>◂</button>
      <input id="swSl" type="range" min="0" max="${L.length - 1}" value="${Math.max(0, i)}" aria-valuetext="Chapter ${m.ch}">
      <button type="button" class="sw-step" data-sw-step="1" aria-label="Next chapter"${i >= L.length - 1 ? ' disabled' : ''}>▸</button>
      <output id="swSlO">Ch ${m.ch}</output>${!m.v.author && m.v.top != null ? `<span class="dim">you’ve read to Ch ${m.v.top}</span>` : ''}</div>`;
  }

  // ---------------------------------------------------------------- the left page
  const kindLabel = (m, k) => m.Si.label(m.Si.ALLIANCE_KINDS, k);
  const motiveLabel = (m, k) => k ? m.Si.label(m.Si.MOTIVES, k) : '';
  function evTitle(m, id) { if (id == null) return 'the start'; const T = m.v.T, e = T && T.byId(id); if (!e) return '?'; if (!m.v.author && !T.isRevealed(e, m.ch)) return '?'; return String(e.title || id).replace(/:.*$/, ''); }
  function tieRow(m, e, note) {
    return `<button type="button" class="sw-tie k-${e.kind}${e.ended ? ' end' : ''}${e.hidden ? ' hid' : ''}" data-sw-pick="${esc(e.key)}"><i></i>
      <span><b>${esc(nameOf(e.a))}</b> <span class="dim">${DIRECTED[e.kind] ? '→' : '↔'}</span> <b>${esc(nameOf(e.b))}</b> <span class="dim">· ${esc(kindLabel(m, e.kind))}${e.motive ? ' · ' + esc(motiveLabel(m, e.motive)) : ''}${e.hidden ? ' · not for readers yet' : ''}</span></span>
      <em>${esc(note || '')}</em></button>`;
  }
  function since(m, e) { return e.ended ? 'ended Ch ' + e.endCh : (e.startCh ? 'since Ch ' + e.startCh : 'from the start'); }
  /** A tie's words, as this viewer may see them. */
  function tieWords(m, e) {
    const Si = m.Si, own = Si.get(e.owner, m.recs); if (!own) return null;
    const r = m.v.author ? own : Si.forReader(own, m.ch, { recs: m.recs });
    return (r.foreign.ties || []).find(x => x.id === e.id) || null;
  }
  function pickedHtml(m) {
    const sel = web.sel; if (!sel) return '';
    if (sel.edge) {
      const e = m.now.edges.find(x => x.key === sel.edge); if (!e) return '';
      const w = tieWords(m, e) || {}, txt = t => m.v.author ? (t || '') : m.Si.clean(t || '', m.ch, m.recs, false);
      const terms = txt((Array.isArray(w.terms) ? w.terms.filter(Boolean).join('; ') : w.terms) || w.note), why = txt(w.motiveDetail);
      const end = e.ended ? evTitle(m, e.to) : e.to != null && m.v.author ? evTitle(m, e.to) + ' (readers can’t see this end yet)' : (e.endHidden ? 'not yet' : 'still going');
      return `<div class="se-card sw-pick k-${e.kind}"><div class="se-lbl">Picked tie</div>
        <div class="sw-ptl">${esc(nameOf(e.a))} ${DIRECTED[e.kind] ? '→' : '↔'} ${esc(nameOf(e.b))}</div>
        <div class="se-row"><span class="se-chip sw-kc k-${e.kind}">${esc(kindLabel(m, e.kind))}</span>${e.motive ? `<span class="se-chip">Motive · ${esc(motiveLabel(m, e.motive))}</span>` : ''}${e.secret && m.v.author ? '<span class="se-chip dash">Secret</span>' : ''}${e.hidden ? '<span class="se-chip dash">Hidden from readers</span>' : ''}</div>
        <div class="se-kv">${terms ? `<span>Terms</span><span>${esc(terms)}</span>` : ''}${why ? `<span>Why</span><span>${esc(why)}</span>` : ''}<span>From</span><span>${esc(evTitle(m, e.from))}</span><span>Ends</span><span>${esc(end)}</span></div>
        <div class="se-row"><button type="button" class="se-link" data-sw-open="${esc(e.owner)}">Open ${esc(nameOf(e.owner))} · Foreign ▸</button>${e.b !== e.owner ? `<button type="button" class="se-link" data-sw-open="${esc(e.b)}">Open ${esc(nameOf(e.b))} ▸</button>` : ''}</div></div>`;
    }
    if (sel.bloc) {
      const b = m.blocsNow.find(x => x.key === sel.bloc); if (!b) return '';
      const mem = b.members.map(x => `<button type="button" class="se-chip sw-chipbtn${x.left ? ' dash' : ''}${x.hidden ? ' dash' : ''}" data-sw-seat="${esc(x.place)}">${esc(nameOf(x.place))}${x.left ? ' · left' + (x.endCh ? ' Ch ' + x.endCh : '') : (x.startCh ? ' · joined Ch ' + x.startCh : '')}${m.v.author && x.endHidden ? ' · →?' : ''}</button>`).join('');
      return `<div class="se-card sw-pick"><div class="se-lbl">Picked bloc · ${b.size} member${b.size === 1 ? '' : 's'}</div><div class="sw-ptl">${esc(b.name || 'Unnamed bloc')}</div>
        <div class="se-row">${mem}${b.hidden ? '<span class="se-chip dash">Hidden from readers</span>' : ''}${b.members.length < 3 && m.v.author ? '<span class="se-chip" style="color:var(--ember);border-color:var(--ember)">needs 3 or more</span>' : ''}</div>
        <div class="se-kv">${b.charter ? `<span>Charter</span><span>${esc(b.charter)}</span>` : ''}${b.purpose ? `<span>Purpose</span><span>${esc(b.purpose)}</span>` : ''}${b.tension && m.v.author ? `<span>Tension</span><span>${esc(b.tension)}</span>` : ''}</div>
        <div class="se-row"><button type="button" class="se-link" data-sw-open="${esc(b.owner)}">Open ${esc(nameOf(b.owner))} · Foreign ▸</button></div></div>`;
    }
    const id = sel.place, n = m.present.get(id); if (!n) return '';
    const mine = m.edges.filter(e => e.a === id || e.b === id);
    return `<div class="se-card sw-pick"><div class="se-lbl">Picked place · ${esc(title(typeOf(id)))}${isStatue(id) ? ' · statue site' : ''}</div>
      <div class="sw-ptl">${esc(place(id).name)}</div>
      ${mine.length ? mine.map(e => tieRow(m, e, since(m, e))).join('') : '<p class="se-empty">No ties at this chapter.</p>'}
      <div class="se-row"><button type="button" class="se-link" data-sw-open="${esc(id)}">Open its entry ▸</button></div></div>`;
  }
  function changedHtml(m) {
    const began = m.now.edges.filter(e => e.startCh === m.ch && m.ch != null), ended = m.now.edges.filter(e => e.ended && e.endCh === m.ch && m.ch != null);
    const rows = began.map(e => tieRow(m, e, 'began')).concat(ended.map(e => tieRow(m, e, 'ended')));
    return `<div class="se-card"><div class="se-lbl">${m.ch == null ? 'Everything' : 'What changed in Ch ' + m.ch}</div>${rows.length ? rows.join('') : '<p class="se-empty">No tie began or ended in this chapter.</p>'}</div>`;
  }
  function blocsHtml(m) {
    if (!m.blocsNow.length) return '';
    return `<div class="se-lbl">Blocs at this chapter</div><div class="se-row">${m.blocsNow.map(b => `<button type="button" class="se-chip sw-chipbtn${web.sel && web.sel.bloc === b.key ? ' on' : ''}${b.hidden ? ' dash' : ''}" data-sw-bloc="${esc(b.key)}" aria-pressed="${!!(web.sel && web.sel.bloc === b.key)}">${esc(b.name || 'Unnamed bloc')} · ${b.size}</button>`).join('')}</div>`;
  }
  function busiestHtml(m) {
    const n = new Map(); m.edges.filter(e => !e.ended).forEach(e => [e.a, e.b].forEach(id => n.set(id, (n.get(id) || 0) + 1)));
    const top = [...n.entries()].sort((x, y) => y[1] - x[1] || nameOf(x[0]).localeCompare(nameOf(y[0]))).slice(0, 7);
    return top.length ? `<div class="se-lbl">Busiest places</div><div class="se-row">${top.map(([id, k]) => `<button type="button" class="se-chip sw-chipbtn" data-sw-seat="${esc(id)}">${esc(nameOf(id))} · ${k}</button>`).join('')}</div>` : '';
  }
  function leftHtml(m) {
    const live = m.edges.filter(e => !e.ended), gone = m.edges.filter(e => e.ended);
    const sub = [m.now.nodes.length + ' places', live.length + ' ties', m.v.author ? 'author view' : (m.v.rc == null ? 'reader · latest chapter' : 'reader · Ch ' + m.v.rc)].join(' · ');
    return `<div class="se-main sw-main">
      <div class="se-hd"><button type="button" class="se-back" data-sw-back>◂ ${web.from ? esc(nameOf(web.from)) : 'All places'}</button>
        <div class="se-ttl"><b>RELATIONS · THE RING</b><small>${esc(sub)}</small></div>
        <span class="sw-grpby"><label for="swGrp">Seats by</label><select id="swGrp"><option value="type"${web.group === 'type' ? ' selected' : ''}>type</option><option value="country"${web.group === 'country' ? ' selected' : ''}>country</option><option value="bloc"${web.group === 'bloc' ? ' selected' : ''}>bloc</option></select></span></div>
      <div class="se-body sw-body" tabindex="0">
        ${pickedHtml(m)}
        ${changedHtml(m)}
        ${blocsHtml(m)}
        ${busiestHtml(m)}
        <details class="sw-all"${web.sel ? '' : ' open'}><summary class="se-lbl">All ties at this chapter (${live.length}${gone.length ? ' · ' + gone.length + ' ended' : ''})</summary>
          ${m.edges.length ? live.concat(gone).map(e => tieRow(m, e, since(m, e))).join('') : '<p class="se-empty">No ties yet.</p>'}</details>
        <p class="se-dim sw-help">Click a place or a chord to pick it; click it again, or Esc, to let go. ◂ ▸ step through chapters. Seats never move, so new and ended ties stand out.</p>
      </div></div>`;
  }

  // ---------------------------------------------------------------- open, draw, close
  const keep = fn => (global.EpitaphSiteEntry && global.EpitaphSiteEntry.keepFocus ? global.EpitaphSiteEntry.keepFocus(fn) : fn());
  function render() { return keep(renderNow); }
  function renderNow() {
    if (!web || !inEncyclopedia() || !S()) return false;
    const m = model(), sb = document.getElementById('bkSandbox');
    let layer = document.getElementById('seWeb');
    if (!layer) { layer = document.createElement('div'); layer.id = 'seWeb'; layer.className = 'se-entry sw-entry'; sb.appendChild(layer); }
    const idx = document.getElementById('bkSites'); if (idx) idx.hidden = true;
    const en = document.getElementById('seEntry'); if (en) en.hidden = true;
    const keep = layer.querySelector('.sw-body'), top = keep ? keep.scrollTop : 0;
    layer.innerHTML = leftHtml(m);
    const nb = layer.querySelector('.sw-body'); if (nb) nb.scrollTop = top;
    const panel = document.getElementById('bookPanel');
    if (panel) { panel.hidden = false; panel.classList.add('se-panel'); panel.innerHTML = `<div class="sw-map">${ringSvg(m)}${legendHtml(m)}</div>${scrubHtml(m)}`; }
    return true;
  }
  /** Open the ring. from: a place id when opened from its entry (Back returns there), and that place starts picked. */
  function open(from, by) {
    if (!S() || !inEncyclopedia()) return false;
    const Ent = global.EpitaphSiteEntry, curE = Ent && Ent.current ? Ent.current() : null;
    const wasOpen = isOpen();
    web = { ch: null, group: by === 'bloc' ? 'bloc' : (web && web.group) || 'type', sel: from && by !== 'bloc' ? { place: from } : null, off: new Set(), from: from || null, fromTab: curE && curE.placeId === from ? curE.tab : 'foreign' };
    const ok = renderNow(); const b = document.querySelector('#seWeb .se-back'); if (ok && b && !wasOpen) try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    return ok;
  }
  function close(toEntry) {
    const w = web; web = null;
    const layer = document.getElementById('seWeb'); if (layer) layer.remove();
    const panel = document.getElementById('bookPanel'); if (panel && panel.classList.contains('se-panel')) { panel.innerHTML = ''; panel.classList.remove('se-panel'); }
    const en = document.getElementById('seEntry'); if (en) en.hidden = false;
    const Ent = global.EpitaphSiteEntry, target = toEntry || (w && w.from);
    if (target && Ent) { Ent.open(target, toEntry ? 'foreign' : (w.fromTab || 'foreign')); return; }
    if (en && Ent && Ent.current && Ent.current()) { Ent.open(Ent.current().placeId, Ent.current().tab); return; }
    const idx = document.getElementById('bkSites'); if (idx) idx.hidden = false;
  }
  const isOpen = () => !!web && !!document.getElementById('seWeb');
  function step(d) { const L = viewer().list, i = L.indexOf(web.ch); const j = Math.max(0, Math.min(L.length - 1, i + d)); if (L[j] != null && L[j] !== web.ch) { web.ch = L[j]; render(); } }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
      const t = e.target && e.target.closest ? e.target : null; if (!t) return;
      const go = t.closest('[data-se-web]'); if (go && inEncyclopedia()) { e.preventDefault(); open(go.dataset.seWeb || null, go.dataset.seBy || null); return; }
      if (!isOpen()) return;
      if (!t.closest('#seWeb, #bookPanel')) return;
      if (t.closest('[data-sw-back]')) { close(); return; }
      const op = t.closest('[data-sw-open]'); if (op) { close(op.dataset.swOpen); return; }
      const k = t.closest('[data-sw-kind]'); if (k) { const kk = k.dataset.swKind; web.off.has(kk) ? web.off.delete(kk) : web.off.add(kk); render(); return; }
      const st = t.closest('[data-sw-step]'); if (st) { step(+st.dataset.swStep); return; }
      const bc = t.closest('[data-sw-bloc]'); if (bc) { const key = bc.dataset.swBloc; web.sel = web.sel && web.sel.bloc === key ? null : { bloc: key }; render(); return; }
      const s = t.closest('[data-sw-seat]'); if (s) { const id = s.dataset.swSeat; web.sel = web.sel && web.sel.place === id ? null : { place: id }; render(); return; }
      const ed = t.closest('[data-sw-edge], [data-sw-pick]'); if (ed) { const key = ed.dataset.swEdge || ed.dataset.swPick; web.sel = web.sel && web.sel.edge === key ? null : { edge: key }; render(); return; }
    });
    document.addEventListener('input', e => { if (!isOpen() || !e.target) return; if (e.target.id === 'swSl') { const L = viewer().list, v = L[+e.target.value]; if (v != null && v !== web.ch) { web.ch = v; render(); const n = document.getElementById('swSl'); if (n) n.focus(); } } });
    document.addEventListener('change', e => { if (!isOpen() || !e.target) return; if (e.target.id === 'swGrp') { web.group = ['country', 'bloc'].includes(e.target.value) ? e.target.value : 'type'; render(); } });
    document.addEventListener('keydown', e => {
      if (!isOpen()) return;
      const inField = e.target && e.target.closest && e.target.closest('input:not(#swSl),textarea,select');
      if (e.key === 'Escape' && !inField) { if (web.sel) { web.sel = null; render(); } else close(); e.stopPropagation(); e.preventDefault(); return; }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('g[data-sw-seat], g[data-sw-edge]')) { e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); e.preventDefault(); return; }
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !inField && e.target.id !== 'swSl' && e.target.closest && e.target.closest('#seWeb, #bookPanel')) { step(e.key === 'ArrowLeft' ? -1 : 1); e.preventDefault(); }
    }, true);
    const watch = () => { const b = document.getElementById('theBook'); if (!b) return; new MutationObserver(() => { if (web && !inEncyclopedia()) web = null; }).observe(b, { attributes: true, attributeFilter: ['data-view'] }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
    const T = TL(); if (T && T.onReaderChange) T.onReaderChange(() => { if (isOpen()) render(); });
  }

  global.EpitaphSiteWeb = { open, close, isOpen, render, state: () => web, _t: { model, ringSvg } };
})(typeof window !== 'undefined' ? window : globalThis);
