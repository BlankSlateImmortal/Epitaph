/* Epitaph — the what-if board (Site Encyclopedia step 4.5). Author only: what-ifs are never published.
 *
 * Three ways to look at every place's what-ifs (scenarios), picked by the user in design round 7:
 *   Board  (Q)  a column per status (seven, Idea → Dropped); drag a card to another column to change its status.
 *   Piles  (S)  "what to work on": four piles from the two scores (likely = Possible or more, big = a Region or more):
 *               Plant signs now · Keep in your pocket · Background colour · Let it go; plus the ones whose impact isn't scored yet.
 *   One what-if (R)  read left to right: causes weighed (★ = the one leaned to) → trigger → fallout per place → what it sets off,
 *               with its warning signs and whether they're planted in time.
 * The right page is the world dither map: every shown what-if's ripples (from where it starts to each place in its fallout, places
 * sized by how many what-ifs reach them), or one what-if's ripples plus a chapter strip with its warning signs.
 *
 * Quick edits (status, likelihood, impact) save through EpitaphSiteEdit.patchItem, so each is an undo step like any other save.
 * Everything else opens the what-if's full form in its place's entry (Intrigue tab).
 */
(function (global) {
  'use strict';
  const S = () => global.EpitaphSites, Wd = () => global.EpitaphWorld, TL = () => global.EpitaphTimeline, D = () => global.EpitaphDither;
  const Ent = () => global.EpitaphSiteEntry, Ed = () => global.EpitaphSiteEdit;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shortName = n => String(n || '').split(/\s+[—–-]\s+/).pop();
  const placeName = id => { const p = Wd() && Wd().place(String(id || '').replace(/^place:/, '')); return p ? shortName(p.name) : String(id || '').replace(/^place:/, ''); };
  const PILES = [
    ['pocket', 'Keep in your pocket', 'var(--sw-violet, #b98ad8)', 'Unlikely but big. Your twists. Leave one quiet hint so it feels fair if you use it; nothing more.'],
    ['now', 'Plant signs now', 'var(--ember)', 'Likely and big. These will probably happen and change a lot: plant warning signs in earlier chapters, or write them.'],
    ['letgo', 'Let it go', 'var(--dust)', 'Unlikely and small. Park these or drop them; they cost attention and give little back.'],
    ['texture', 'Background colour', 'var(--verdigris)', 'Likely but small. Everyday consequences: use them for texture, a line of dialogue, a price going up.']
  ];
  const NEEDS_SIGN = { planned: 1, foreshadowed: 1, written: 1 };
  let wf = null;        // { view: 'board'|'piles', place: ''|placeId, sel: key|null, from: placeId|null, fromTab }
  let ro = null, roT = 0;

  function inEncyclopedia() { const b = document.getElementById('theBook'); return !!(b && b.dataset.view === 'sites' && document.getElementById('bkSandbox')); }
  const author = () => { const T = TL(); return T ? T.authorMode() : true; };

  /** Everything one draw needs. */
  function model() {
    const Si = S(), recs = Si.load(), all = Si.whatIfList(recs);
    const items = wf.place ? all.filter(w => w.placeId === wf.place) : all;
    const links = Si.whatIfLinks(all), loops = Si.whatIfLoops(all), inLoop = new Set(loops.flat());
    const places = recs.filter(r => (r.scenarios || []).length).map(r => r.placeId);
    return { Si, recs, all, items, links, loops, inLoop, places, sel: wf.sel ? all.find(w => w.key === wf.sel) || null : null };
  }
  const label = (set, id) => S().label(S()[set], id);
  const scaleName = (scale, n) => Number.isInteger(n) && n >= 1 ? (S().SCALE_SETS[scale].steps[n - 1] || '') : '';
  const dots = (n, cls) => `<span class="se-dots${cls ? ' ' + cls : ''}" role="img" aria-label="${n || 0} of 7">${[1, 2, 3, 4, 5, 6, 7].map(k => `<i${k > (n || 0) ? ' class="o"' : ''}></i>`).join('')}</span>`;
  const planted = w => (w.warnings || []).map(x => x.plantIn).filter(Number.isInteger);
  /** The warning-sign verdict on a card: what the Checks list would say, in a few words. */
  function signVerdict(w) {
    const p = planted(w);
    if (NEEDS_SIGN[w.status]) {
      if (Number.isInteger(w.chapter)) { const before = p.filter(n => n < w.chapter).length; return before ? { ok: true, text: `✓ ${before} sign${before === 1 ? '' : 's'} before Ch ${w.chapter}` } : { ok: false, text: `⚠ no sign planted before Ch ${w.chapter}` }; }
      return p.length ? { ok: true, text: `✓ ${p.length} sign${p.length === 1 ? '' : 's'} planted` } : { ok: false, text: '⚠ no warning sign planted' };
    }
    if (w.status === 'dropped' && p.length) return { ok: false, text: `⚠ dropped, but signs are planted (Ch ${p.join(', ')})` };
    return p.length ? { ok: true, text: `${p.length} sign${p.length === 1 ? '' : 's'} planted` } : null;
  }
  const falloutPlaces = w => [...new Set((w.fallout || []).map(f => String(f.place || '').replace(/^place:/, '')).filter(Boolean))];

  // ---------------------------------------------------------------- cards, board, piles
  function cardHtml(m, w, compact) {
    const v = signVerdict(w), fp = falloutPlaces(w), loop = m.inLoop.has(w.key);
    return `<button type="button" class="wf-card${m.sel && m.sel.key === w.key ? ' on' : ''}" draggable="true" data-wf-card="${esc(w.key)}" title="Open this what-if">
      <b>${esc(w.trigger || w.id)}</b>
      <span class="wf-row"><span class="se-chip">${esc(label('TRIGGER_GROUPS', w.triggerKind) || w.triggerKind)}</span><span class="se-dim">${esc(placeName(w.placeId))}</span>${compact ? `<span class="se-dim">· ${esc(label('WHATIF_STATUS', w.status))}</span>` : ''}</span>
      <span class="wf-row"><span class="se-dim">likely</span>${dots(w.likelihood)}<span class="se-dim">impact</span>${Number.isInteger(w.impact) ? dots(w.impact) : '<span class="wf-unset">not scored</span>'}</span>
      ${!compact && fp.length ? `<span class="wf-row">${fp.slice(0, 3).map(p => `<span class="wf-pl">${esc(placeName(p))}</span>`).join('')}${fp.length > 3 ? `<span class="se-dim">+${fp.length - 3}</span>` : ''}</span>` : ''}
      ${v || Number.isInteger(w.chapter) || loop ? `<span class="wf-row wf-flag">${v ? `<span class="${v.ok ? 'ok' : 'bad'}">${esc(v.text)}</span>` : ''}${loop ? '<span class="bad">⟲ in a loop</span>' : ''}${Number.isInteger(w.chapter) && !(v && /before Ch/.test(v.text)) ? `<span class="se-dim">Ch ${w.chapter}</span>` : ''}</span>` : ''}
    </button>`;
  }
  function boardHtml(m) {
    return `<div class="wf-cols">${S().WHATIF_STATUS.map(st => {
      const list = m.items.filter(w => w.status === st.id).sort((a, b) => ((b.likelihood || 0) * (b.impact || 0)) - ((a.likelihood || 0) * (a.impact || 0)) || String(a.trigger).localeCompare(String(b.trigger)));
      return `<section class="wf-col${list.length ? '' : ' empty'}" data-wf-status="${st.id}" aria-label="${esc(st.label)}: ${list.length}"><h3 title="${esc(st.rule)}">${esc(st.label)}<b>${list.length}</b></h3>${list.map(w => cardHtml(m, w)).join('')}${list.length ? '' : '<span class="wf-drop">drop a card here</span>'}</section>`;
    }).join('')}</div>`;
  }
  function pilesHtml(m) {
    const by = k => m.items.filter(w => S().whatIfPile(w) === k), unscored = m.items.filter(w => S().whatIfPile(w) == null);
    return `<p class="wf-how">Each what-if has two scores: <b>how likely</b> (1–7) and <b>how big</b> (1–7, from a ripple to an ending). Likely means <i>Possible</i> or more; big means a <i>Region</i> or more. Change a score on the card and it moves pile.</p>
      <div class="wf-piles"><span class="wf-ax y">smaller ◂ ─── ▸ bigger</span>
        ${PILES.map(([k, t, col, txt]) => { const list = by(k); return `<section class="wf-pile" style="--pc:${col}" data-wf-pile="${k}"><h3>${esc(t)} <b>${list.length}</b></h3><p>${esc(txt)}</p>${list.map(w => cardHtml(m, w, true)).join('') || '<p class="se-empty">Nothing here.</p>'}</section>`; }).join('')}
        <span class="wf-ax x">less likely ◂ ───── ▸ more likely</span></div>
      ${unscored.length ? `<div class="se-card"><div class="se-lbl">Impact not scored yet · ${unscored.length}</div><p class="se-dim">Open one and pick how far it would reach; it then lands in a pile.</p><div class="wf-unsc">${unscored.map(w => cardHtml(m, w, true)).join('')}</div></div>` : ''}`;
  }

  // ---------------------------------------------------------------- one what-if (R)
  function detailHtml(m) {
    const w = m.sel, Si = m.Si, c = Ent() ? Ent().context(w.placeId) : null, nm = r => c ? c.name(r) : String(r);
    const causes = (w.causes || []).slice().sort((a, b) => (b.lean - a.lean) || ((b.weight || 0) - (a.weight || 0)));
    const title = k => { const x = m.all.find(y => y.key === k); return x ? `${placeName(x.placeId)}: ${x.trigger || x.id}` : k; };
    const next = m.links.next[w.key] || [], prev = m.links.prev[w.key] || [], bad = m.links.missing.filter(x => x.from === w.key);
    const v = signVerdict(w), loop = m.loops.find(l => l.includes(w.key));
    const chipTo = k => `<button type="button" class="se-chip wf-chipbtn" data-wf-card="${esc(k)}">${esc(title(k).slice(0, 70))}</button>`;
    const quickDots = (field, scale, n) => `<span class="wf-qd" role="group" aria-label="${esc(S().SCALE_SETS[scale].label)}">${[1, 2, 3, 4, 5, 6, 7].map(k => `<button type="button" class="wf-qdot${k <= (n || 0) ? ' on' : ''}" data-wf-set="${field}" data-v="${k}" title="${k} · ${esc(scaleName(scale, k))}" aria-label="${k} of 7, ${esc(scaleName(scale, k))}"></button>`).join('')}<span class="wf-qn">${esc(scaleName(scale, n) || 'not scored')}</span></span>`;
    const pile = Si.whatIfPile(w), pileName = pile ? PILES.find(p => p[0] === pile)[1] : 'no pile yet (score its impact)';
    return `<div class="wf-quick">
        <label>Status <select id="wfStatus">${Si.WHATIF_STATUS.map(s => `<option value="${s.id}"${s.id === w.status ? ' selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label>
        <span class="wf-ql">How likely ${quickDots('likelihood', 'likelihood', w.likelihood)}</span>
        <span class="wf-ql">How big ${quickDots('impact', 'impact', w.impact)}</span>
        <span class="se-chip">Pile · ${esc(pileName)}</span>
        <button type="button" class="se-link" data-wf-edit>✎ Edit everything</button></div>
      <div class="wf-flow">
        <div class="se-card"><div class="se-lbl">Causes being weighed</div>${causes.length ? causes.map(x => `<div class="wf-cause${x.lean ? ' lean' : ''}"><span>${x.lean ? '★ ' : ''}${esc(x.cause || '—')}<br><span class="se-dim">${esc(x.group || '')}${x.note ? ' · ' + esc(x.note) : ''}</span></span><span>${Number.isInteger(x.weight) && x.weight ? dots(x.weight) + `<br><span class="se-dim">${esc(scaleName('weight', x.weight))}</span>` : '<span class="se-dim">no weight</span>'}</span></div>`).join('') : '<p class="se-empty">No causes yet. Add some with ✎ (the menus suggest them).</p>'}</div>
        <div class="wf-arrow" aria-hidden="true">▶</div>
        <div class="se-card wf-trig"><div class="se-lbl">Trigger · ${esc(label('TRIGGER_GROUPS', w.triggerKind))}</div><div class="wf-tt">${esc(w.trigger || w.id)}</div>
          <span class="se-dim">starts in ${esc(placeName(w.placeId))}${Number.isInteger(w.chapter) ? ' · happens in Ch ' + w.chapter : ''}</span>
          ${(w.about || []).length ? `<div class="wf-row">${w.about.map(r => `<span class="se-chip">about · ${esc(nm(r))}</span>`).join('')}</div>` : ''}</div>
        <div class="wf-arrow" aria-hidden="true">▶</div>
        <div class="se-card"><div class="se-lbl">Fallout per place</div>${(w.fallout || []).length ? w.fallout.map(f => `<div class="wf-fall"><b>${esc(placeName(f.place))}</b><span>${esc(f.what || '')}</span></div>`).join('') : '<p class="se-empty">No fallout written yet.</p>'}</div>
      </div>
      <div class="se-card"><div class="se-lbl">Then what? · what-ifs this sets off</div>
        <div class="wf-row">${next.length ? next.map(chipTo).join('') : '<span class="se-dim">None linked. Link some with ✎ (Then what?).</span>'}</div>
        ${prev.length ? `<div class="wf-row"><span class="se-dim">set off by</span>${prev.map(chipTo).join('')}</div>` : ''}
        ${bad.length ? `<p class="bad">Points at ${bad.map(x => '“' + esc(x.to) + '”').join(', ')}, which ${bad.length === 1 ? 'is' : 'are'} not a what-if.</p>` : ''}
        ${loop ? `<p class="bad">⟲ A loop: ${loop.map(k => esc(title(k).slice(0, 40))).join(' → ')} → back again.</p>` : ''}</div>
      <div class="se-card"><div class="se-lbl">Warning signs · plant them before it happens</div>
        ${(w.warnings || []).length ? w.warnings.map(x => `<div class="wf-sign"><span class="${Number.isInteger(x.plantIn) ? 'ok' : 'se-dim'}">${Number.isInteger(x.plantIn) ? 'Ch ' + x.plantIn : 'not planted'}</span><span>${esc(x.text || '')}</span></div>`).join('') : '<p class="se-empty">No warning signs yet.</p>'}
        ${v ? `<p class="${v.ok ? 'ok' : 'bad'}">${esc(v.text)}</p>` : ''}</div>`;
  }

  // ---------------------------------------------------------------- the right page: ripples on the world map
  function panelHtml(m) {
    const T = TL(), chs = T && T.chapters ? T.chapters() : [], w = m.sel;
    const strip = w && chs.length ? (() => {
      const top = Math.max(chs[chs.length - 1], w.chapter || 0, ...planted(w)), pct = n => ((n - 0.5) / top * 100).toFixed(2);
      const ticks = Array.from({ length: top }, (_, i) => i + 1).map(n => `<span class="wf-tick" style="left:${pct(n)}%">Ch ${n}</span>`).join('');
      const signs = (w.warnings || []).filter(x => Number.isInteger(x.plantIn)).map(x => `<span class="wf-mark sign${Number.isInteger(w.chapter) && x.plantIn >= w.chapter ? ' late' : ''}" style="left:${pct(x.plantIn)}%" title="${esc('Ch ' + x.plantIn + ': ' + (x.text || ''))}">◆</span>`).join('');
      const hap = Number.isInteger(w.chapter) ? `<span class="wf-mark hap" style="left:${pct(w.chapter)}%" title="It happens in Ch ${w.chapter}">✸</span>` : '';
      return `<div class="wf-strip" aria-label="Warning signs by chapter"><div class="wf-line"></div>${ticks}${signs}${hap}<span class="wf-skey">◆ a warning sign · ✸ it happens${Number.isInteger(w.chapter) ? '' : ' (no chapter yet)'}</span></div>`;
    })() : '';
    return `<div class="wf-map"><canvas class="se-cv" tabindex="-1" aria-label="Dither map"></canvas><svg class="se-svg" aria-hidden="true"></svg><div class="se-pins"></div>
      <div class="se-legend">${w ? 'red rings: where it starts<br>dashed: places it reaches' : 'ripples from where each what-if starts<br>bigger circle = more what-ifs reach it'}</div><p class="se-maploading">Drawing the map…</p></div>${strip}`;
  }
  async function drawMap(m) {
    const host = document.querySelector('#bookPanel .wf-map'); if (!host || !D()) return;
    try { await D().load(); } catch (e) { const l = host.querySelector('.se-maploading'); if (l) l.textContent = 'The map could not load.'; return; }
    if (!host.isConnected) return;
    host.querySelector('.se-maploading').hidden = true;
    const cv = host.querySelector('.se-cv'), svg = host.querySelector('.se-svg'), pins = host.querySelector('.se-pins'), W = host.clientWidth, H = host.clientHeight;
    const llOf = id => { const q = Wd().place(String(id || '').replace(/^place:/, '')); return q && typeof q.lat === 'number' ? [q.lng, q.lat] : null; };
    const shown = m.sel ? [m.sel] : m.items.filter(w => w.status !== 'dropped');
    const focus = []; shown.forEach(w => { focus.push(llOf(w.placeId)); falloutPlaces(w).forEach(p => focus.push(llOf(p))); });
    const pr = D().world(cv, { focus: focus.filter(Boolean) }).project, at = id => { const ll = llOf(id); return ll ? pr(ll[0], ll[1]) : null; };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
    let paths = '', html = '';
    const arc = (a, b) => { const mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - Math.abs(b[0] - a[0]) * 0.22 - 16; return `<path d="M${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}" fill="none" stroke="var(--ember)" stroke-width="2" stroke-dasharray="6 5" opacity=".85"/>`; };
    const label = (xy, text, cls) => { const x = Math.max(4, Math.min(xy[0] + 12, W - text.length * 7.6 - 10)), y = Math.max(4, Math.min(xy[1] - 12, H - 24)); return `<div class="se-pin${cls ? ' ' + cls : ''}" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px"><span>${esc(text)}</span></div>`; };
    if (m.sel) {
      const w = m.sel, home = at(w.placeId);
      if (home) { [16, 30, 46].forEach((r, i) => { paths += `<circle cx="${home[0]}" cy="${home[1]}" r="${r}" fill="none" stroke="var(--ember)" opacity="${0.8 - i * 0.25}"/>`; }); paths += `<circle cx="${home[0]}" cy="${home[1]}" r="7" fill="var(--ember)"/>`; html += label(home, placeName(w.placeId).toUpperCase() + ' · IT STARTS HERE', 'red'); }
      falloutPlaces(w).forEach(p => { const o = at(p); if (!o) return; if (home && p !== w.placeId) paths += arc(home, o); if (p !== w.placeId) { paths += `<circle cx="${o[0]}" cy="${o[1]}" r="6" fill="var(--amber-hi)"/>`; html += label(o, placeName(p)); } });
    } else {
      const hits = new Map(); shown.forEach(w => falloutPlaces(w).forEach(p => hits.set(p, (hits.get(p) || 0) + 1)));
      shown.forEach(w => { const h = at(w.placeId); if (!h) return; falloutPlaces(w).forEach(p => { if (p === w.placeId) return; const o = at(p); if (o) paths += arc(h, o); }); });
      const homes = new Set(shown.map(w => w.placeId));
      new Set([...hits.keys(), ...homes]).forEach(p => { const o = at(p); if (!o) return; const n = hits.get(p) || 0, r = 6 + n * 5;
        paths += `<circle cx="${o[0]}" cy="${o[1]}" r="${r}" fill="rgba(212,69,43,${(0.12 + n * 0.08).toFixed(2)})" stroke="var(--ember)" stroke-width="1.5"/>`; html += label([o[0] + r - 8, o[1]], placeName(p) + ' · ' + n); });
    }
    svg.innerHTML = paths; pins.innerHTML = html; host.dataset.drawn = W + 'x' + H;
  }

  // ---------------------------------------------------------------- open, draw, close
  function headHtml(m) {
    const w = m.sel, st = w ? label('WHATIF_STATUS', w.status) : '';
    const back = w ? '◂ Board' : (wf.from ? '◂ ' + placeName(wf.from) : '◂ All places');
    const sub = w ? [placeName(w.placeId), label('TRIGGER_GROUPS', w.triggerKind), st, 'author only'].join(' · ')
      : `${m.items.length} what-if${m.items.length === 1 ? '' : 's'} · ${wf.place ? placeName(wf.place) : new Set(m.items.map(x => x.placeId)).size + ' places'} · author only, never published`;
    const tl = w ? 'WHAT-IF' : wf.view === 'piles' ? 'WHAT TO WORK ON' : 'WHAT-IF BOARD';
    const newFor = wf.place || wf.from;
    return `<div class="se-hd wf-hd"><button type="button" class="se-back" data-wf-back>${esc(back)}</button>
      <div class="se-ttl"><b>${esc(tl)}</b><small>${esc(sub)}</small></div>
      ${w ? '' : `<span class="wf-seg" role="group" aria-label="View"><button type="button" data-wf-view="board" aria-pressed="${wf.view === 'board'}" class="${wf.view === 'board' ? 'on' : ''}">Board</button><button type="button" data-wf-view="piles" aria-pressed="${wf.view === 'piles'}" class="${wf.view === 'piles' ? 'on' : ''}">Piles</button></span>
      <select id="wfPlace" aria-label="Which places"><option value="">All places</option>${m.places.map(p => `<option value="${esc(p)}"${p === wf.place ? ' selected' : ''}>${esc(placeName(p))}</option>`).join('')}</select>
      <button type="button" class="se-link" data-wf-new${newFor ? '' : ' disabled title="Pick a place first"'}>+ New what-if${newFor ? ' in ' + esc(placeName(newFor)) : ''}</button>`}</div>`;
  }
  const keep = fn => (Ent() && Ent().keepFocus ? Ent().keepFocus(fn) : fn());
  function render() { return keep(renderNow); }
  function renderNow() {
    if (!wf || !inEncyclopedia() || !S()) return false;
    if (!author()) { close(); return false; }               // what-ifs are author only: a Reader view never shows them
    const m = model(); if (wf.sel && !m.sel) wf.sel = null;
    const sb = document.getElementById('bkSandbox');
    let layer = document.getElementById('seWhatIf');
    if (!layer) { layer = document.createElement('div'); layer.id = 'seWhatIf'; layer.className = 'se-entry wf-entry'; sb.appendChild(layer); }
    ['bkSites', 'seEntry', 'seWeb'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; });
    const keep = layer.querySelector('.se-body'), top = keep ? keep.scrollTop : 0, keepX = layer.querySelector('.wf-cols') ? layer.querySelector('.wf-cols').scrollLeft : 0;
    layer.innerHTML = `<div class="se-main wf-main">${headHtml(m)}<div class="se-body wf-body" tabindex="0">${m.sel ? detailHtml(m) : wf.view === 'piles' ? pilesHtml(m) : (m.all.length ? boardHtml(m) : '<p class="se-empty">No what-ifs yet. Open a place and add one on its Intrigue tab, or use + New what-if.</p>')}</div></div>`;
    const nb = layer.querySelector('.se-body'); if (nb) nb.scrollTop = m.sel ? 0 : top;
    const nc = layer.querySelector('.wf-cols'); if (nc) nc.scrollLeft = keepX;
    const panel = document.getElementById('bookPanel');
    if (panel) {
      panel.hidden = false; panel.classList.add('se-panel'); panel.innerHTML = panelHtml(m); drawMap(m);
      if (ro) ro.disconnect();
      ro = new ResizeObserver(() => { clearTimeout(roT); roT = setTimeout(() => { const h = document.querySelector('#bookPanel .wf-map'); if (wf && h && h.dataset.drawn !== h.clientWidth + 'x' + h.clientHeight) drawMap(model()); }, 150); });
      ro.observe(panel);
    }
    return true;
  }
  /** Open the board. from: a place id when opened from its entry (Back returns there; the board starts filtered to that place). */
  function open(from, view) {
    if (!S() || !inEncyclopedia() || !author()) return false;
    const E = Ent(), curE = E && E.current ? E.current() : null;
    if (global.EpitaphSiteWeb && global.EpitaphSiteWeb.isOpen()) { const l = document.getElementById('seWeb'); if (l) l.remove(); }
    wf = { view: view === 'piles' ? 'piles' : 'board', place: from || '', sel: null, from: from || null, fromTab: curE && curE.placeId === from ? curE.tab : 'intrigue' };
    const ok = renderNow(); const b = document.querySelector('#seWhatIf .se-back'); if (ok && b) try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    return ok;
  }
  function close(target, tab, after) {
    const w = wf; wf = null; if (ro) { ro.disconnect(); ro = null; }
    const layer = document.getElementById('seWhatIf'); if (layer) layer.remove();
    const panel = document.getElementById('bookPanel'); if (panel && panel.classList.contains('se-panel')) { panel.innerHTML = ''; panel.classList.remove('se-panel'); }
    const en = document.getElementById('seEntry'); if (en) en.hidden = false;
    const E = Ent(), to = target || (w && w.from);
    if (to && E && inEncyclopedia()) { E.open(to, tab || (w && w.fromTab) || 'intrigue'); if (after) setTimeout(after, 30); return; }
    if (en && E && E.current && E.current()) { E.open(E.current().placeId, E.current().tab); return; }
    const idx = document.getElementById('bkSites'); if (idx) idx.hidden = false;
  }
  const isOpen = () => !!wf && !!document.getElementById('seWhatIf');
  function patch(w, fields, what) {
    if (!w || !Ed() || !Ed().patchItem) return false;
    const ok = Ed().patchItem(w.placeId, 'scenarios', w.id, fields, what);
    if (ok) render();
    return ok;
  }
  /** Open a what-if's full form in its place's entry (Intrigue tab). */
  function editInEntry(w, isNew) {
    close(w ? w.placeId : (wf && (wf.place || wf.from)), 'intrigue', () => {
      const L = document.getElementById('seEntry'); if (!L) return;
      if (isNew) { const b = L.querySelector('[data-se-new="scenarios"]'); if (b) b.click(); return; }
      const rec = S().get(w.placeId), i = rec ? rec.scenarios.findIndex(x => x.id === w.id) : -1;
      const pen = i >= 0 && L.querySelector(`[data-se-edit="scenarios.${i}"] .se-pen`); if (pen) pen.click();
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
      const t = e.target && e.target.closest ? e.target : null; if (!t) return;
      const go = t.closest('[data-se-whatif]'); if (go && inEncyclopedia()) { e.preventDefault(); open(go.dataset.seWhatif || null, go.dataset.seView || null); return; }
      if (!isOpen() || !t.closest('#seWhatIf, #bookPanel')) return;
      if (t.closest('[data-wf-back]')) { if (wf.sel) { wf.sel = null; render(); } else close(); return; }
      const vb = t.closest('[data-wf-view]'); if (vb) { wf.view = vb.dataset.wfView === 'piles' ? 'piles' : 'board'; render(); return; }
      if (t.closest('[data-wf-new]')) { if (wf.place || wf.from) editInEntry(null, true); return; }
      const m = model();
      if (t.closest('[data-wf-edit]')) { if (m.sel) editInEntry(m.sel); return; }
      const sd = t.closest('[data-wf-set]'); if (sd && m.sel) { const f = sd.dataset.wfSet, v = +sd.dataset.v; patch(m.sel, { [f]: f === 'impact' && m.sel.impact === v ? null : v }, f === 'impact' ? 'Impact' : 'Likelihood'); return; }
      const cd = t.closest('[data-wf-card]'); if (cd) { wf.sel = cd.dataset.wfCard; render(); return; }
    });
    document.addEventListener('change', e => {
      if (!isOpen() || !e.target) return;
      if (e.target.id === 'wfPlace') { wf.place = e.target.value || ''; render(); return; }
      if (e.target.id === 'wfStatus') { const m = model(); if (m.sel) patch(m.sel, { status: e.target.value }, 'Status'); }
    });
    // drag a card to another status column
    let dragKey = null;
    document.addEventListener('dragstart', e => { const c = isOpen() && e.target.closest && e.target.closest('[data-wf-card]'); if (!c) return; dragKey = c.dataset.wfCard; try { e.dataTransfer.setData('text/plain', dragKey); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} c.classList.add('drag'); });
    document.addEventListener('dragend', e => { dragKey = null; document.querySelectorAll('.wf-card.drag, .wf-col.over').forEach(x => x.classList.remove('drag', 'over')); });
    document.addEventListener('dragover', e => { const col = isOpen() && dragKey && e.target.closest && e.target.closest('[data-wf-status]'); if (!col) return; e.preventDefault(); document.querySelectorAll('.wf-col.over').forEach(x => x !== col && x.classList.remove('over')); col.classList.add('over'); });
    document.addEventListener('drop', e => {
      const col = isOpen() && e.target.closest && e.target.closest('[data-wf-status]'); if (!col) return; e.preventDefault();
      let key = dragKey; try { key = e.dataTransfer.getData('text/plain') || key; } catch (x) {}
      const w = model().all.find(x => x.key === key); dragKey = null;
      if (w && w.status !== col.dataset.wfStatus) patch(w, { status: col.dataset.wfStatus }, 'Status'); else render();
    });
    document.addEventListener('keydown', e => {
      if (!isOpen()) return;
      const inField = e.target && e.target.closest && e.target.closest('input,textarea,select');
      if (e.key === 'Escape' && !inField) { if (wf.sel) { wf.sel = null; render(); } else close(); e.stopPropagation(); e.preventDefault(); }
    }, true);
    const watch = () => { const b = document.getElementById('theBook'); if (!b) return; new MutationObserver(() => { if (wf && !inEncyclopedia()) { wf = null; if (ro) { ro.disconnect(); ro = null; } } }).observe(b, { attributes: true, attributeFilter: ['data-view'] }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
    const T = TL(); if (T && T.onReaderChange) T.onReaderChange(() => { if (isOpen()) render(); });
  }

  global.EpitaphSiteWhatIf = { open, close, isOpen, render, state: () => wf, _t: { model, signVerdict } };
})(typeof window !== 'undefined' ? window : globalThis);
