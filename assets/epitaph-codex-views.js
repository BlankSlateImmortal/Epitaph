/* Epitaph — presentations for two codex tabs, each adding one new
 * dimension on top of the tabs before it:
 *
 *   ties  -> Bond strips: one tall vertical strip per tie (poster style),
 *            with what the other person calls them back at the foot and the
 *            bond's arc down the selected strip.
 *   arc   -> Heading HUD over strata: a heading tape of archetypes with a
 *            needle and the "heading toward" marker, above stacked contour
 *            layers (one per chapter) that the path climbs.
 *
 * Loaded before index.html's main script runs its first render; every
 * function here is called later and uses index.html's globals (state,
 * escapeHtml, escapeAttr, getActiveSnapshot, findCharacterById, ...).
 */
(function () {
  'use strict';
  const esc = s => escapeHtml(s == null ? '' : String(s));
  const attr = s => escapeAttr(s == null ? '' : String(s));
  const byChapter = c => (c.snapshots || []).map((s, i) => ({ s, i }))
    .sort((a, b) => (Number.isInteger(a.s.startChapter) ? a.s.startChapter : Infinity) - (Number.isInteger(b.s.startChapter) ? b.s.startChapter : Infinity) || a.i - b.i)
    .map(x => x.s);
  const chOf = s => Number.isInteger(s.startChapter) ? 'CH ' + s.startChapter : (s.chapterRange || '?');
  const portraitOf = (target) => {
    if (!target) return `<img src="${SILHOUETTE_SVG}" alt="" class="unknown">`;
    const s = getActiveSnapshot(target);
    return s && s.portrait ? `<img src="${attr(s.portrait)}" alt="">` : `<img src="${SILHOUETTE_SVG}" data-gen-char="${attr(target.id)}" alt="">`;
  };
  const SPARK = '<svg class="cx-spark" viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0,-10 C1,-2 2,-1 10,0 C2,1 1,2 0,10 C-1,2 -2,1 -10,0 C-2,-1 -1,-2 0,-10Z"/></svg>';

  // ================================================================
  // TIES — bond strips
  // ================================================================
  const tieFocus = {};
  function backLabel(char, snap, targetId) {
    const t = findCharacterById(targetId);
    if (!t) return null;
    const ts = Number.isInteger(snap.startChapter) && typeof stateAtChapter === 'function' ? (stateAtChapter(t, snap.startChapter) || getActiveSnapshot(t)) : getActiveSnapshot(t);
    const r = ((ts && ts.relationships) || []).find(x => x.charId === char.id);
    return r ? (r.relation || 'listed, no label') : '';
  }
  function tiesHtml(char, snap, chg) {
    const rels = snap.relationships || [];
    const inferred = inferredRelationships(char);
    const list = rels.map((r, i) => ({ key: 'r' + i, target: findCharacterById(r.charId), name: relationshipDisplayName(r) || 'Unnamed', rel: r.relation || '', note: r.note || '',
      back: r.charId ? backLabel(char, snap, r.charId) : null, arc: relationshipArc(char, r), isNew: chg.isNew('relationships', r), inferred: false }))
      .concat(inferred.map((r, i) => ({ key: 'x' + i, target: findCharacterById(r.charId), name: r.name, rel: '', note: r.note || '', back: r.relation || 'listed, no label', arc: [], isNew: false, inferred: true })));
    if (!list.length) return `<div class="sys-empty">No relationships recorded yet.</div>`;
    const sel = list.find(t => t.key === tieFocus[char.id]) || list[0];
    const me = char.name || 'them';
    return `<div class="cx-strips" role="listbox" aria-label="Ties" tabindex="0">${list.map((t, i) => {
      const on = t === sel;
      const foot = t.inferred ? `<span class="cx-foot one">${esc(me)} doesn’t list them</span>`
        : t.back === null ? `<span class="cx-foot dim">not a character file</span>`
        : t.back === '' ? `<span class="cx-foot one">one-sided</span>`
        : `<span class="cx-foot"><small>they call ${esc(me)}</small>${esc(t.back)}</span>`;
      const vert = t.inferred ? 'unlisted' : (t.rel || 'tie');
      return `<button type="button" role="option" aria-selected="${on}" class="cx-strip${on ? ' on' : ''}${t.inferred ? ' inferred' : ''}" data-tie="${attr(t.key)}" style="--i:${i}">
        <span class="cx-strip-pic">${t.target ? portraitOf(t.target) : `<b class="cx-ghost" aria-hidden="true">${esc((t.name || '?').trim().charAt(0).toUpperCase())}</b>`}</span>
        <span class="cx-strip-no">${String(i + 1).padStart(2, '0')}</span>
        ${t.isNew ? '<span class="cx-new">NEW</span>' : ''}
        <span class="cx-strip-vert" aria-hidden="true">${esc(vert)}</span>
        <span class="cx-strip-body">
          <span class="cx-strip-name">${esc(t.name)}</span>
          <span class="cx-strip-rel">${t.inferred ? 'Lists ' + esc(me) + ' as a tie' : esc(t.rel || 'no label')}</span>
          ${t.note ? `<span class="cx-strip-note">${esc(t.note)}</span>` : ''}
          ${t.arc.length > 1 ? `<ol class="cx-strip-arc">${t.arc.map(st => `<li><b>${esc(st.label)}</b><small>${esc(st.range)}</small></li>`).join('')}</ol>` : ''}
          ${t.target ? `<span class="cx-open rel-link" data-char-id="${attr(t.target.id)}" role="link" tabindex="-1">Open file →</span>` : ''}
        </span>
        ${SPARK}
        ${foot}
      </button>`;
    }).join('')}</div>`;
  }
  function wireTies(page, char) {
    const box = page.querySelector('.cx-strips'); if (!box) return;
    const strips = [...box.querySelectorAll('.cx-strip')];
    // change the selection in place, so widths and text glide instead of the
    // whole page being rebuilt
    const pick = (b, focus) => {
      if (!b.classList.contains('on')) {
        tieFocus[char.id] = b.dataset.tie;
        strips.forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
      }
      if (focus) b.focus({ preventScroll: true });
      if (matchMedia('(max-width: 899px)').matches) setTimeout(() => b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 380);
    };
    strips.forEach(b => b.addEventListener('click', (e) => { if (e.target.closest('.cx-open')) return; pick(b, false); }));
    box.addEventListener('keydown', (e) => {
      const k = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!k) return;
      e.preventDefault();
      const i = strips.findIndex(b => b.classList.contains('on'));
      const nb = strips[Math.min(strips.length - 1, Math.max(0, i + k))];
      if (nb) pick(nb, true);
    });
  }

  // ================================================================
  // ARC — heading HUD over strata
  // ================================================================
  function arcHtml(char, snap) {
    const vers = byChapter(char);
    const names = [];
    vers.forEach(s => { const n = archetypeLabel(s); if (!names.includes(n)) names.push(n); });
    const heading = (snap.headingToward || '').trim();
    const cur = archetypeLabel(snap);
    const divine = isDivineChar(char);
    // heading tape: past archetypes, the current one under the needle, the heading ahead
    const stops = names.map(n => ({ n, kind: n === cur ? 'cur' : 'past' }));
    if (heading && !names.includes(heading)) stops.push({ n: heading, kind: 'ahead' });
    const curIdx = Math.max(0, stops.findIndex(s => s.kind === 'cur'));
    const tape = `<div class="cx-hud">
      <span class="cx-hud-l">HDG<br><b>${String(curIdx + 1).padStart(3, '0')}</b></span>
      <div class="cx-tape" style="--shift:${curIdx}">
        <div class="cx-tape-track">${stops.map((s, i) => `<span class="cx-tape-stop ${s.kind}" style="--x:${i}"><b>${esc(s.n.replace(/^The /, ''))}</b>${s.kind === 'ahead' ? '<small>heading</small>' : ''}</span>`).join('')}</div>
        <span class="cx-tape-needle" aria-hidden="true"></span>
      </div>
      <span class="cx-hud-r">${divine ? 'DIVINE<br><b>LOCK</b>' : 'MORTAL<br><b>' + names.length + ' FORMS</b>'}</span>
    </div>`;
    // strata: one contour layer per chapter version, current one lit
    const W = 660, LH = 46, n = vers.length, H = 70 + n * LH + (heading ? 50 : 0);
    const col = name => 60 + (names.indexOf(name) / Math.max(1, names.length - 1)) * (W - 360);
    const contour = (cy, seed, w) => {
      let d = '', pts = 26;
      for (let k = 0; k <= pts; k++) {
        const t = k / pts, x = 30 + t * w;
        const y = cy + Math.sin(t * 9 + seed) * 4 + Math.sin(t * 23 + seed * 2.3) * 2.2 + Math.sin(t * 3 + seed * .7) * 6;
        d += (k ? ' L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
      }
      return d;
    };
    let layers = '', path = '', marks = '';
    const ys = [];
    vers.forEach((s, i) => {
      const y = H - 40 - i * LH, on = s.id === snap.id, nm = archetypeLabel(s);
      ys.push({ x: col(nm), y, s, on, nm });
      for (let k = 2; k >= 0; k--) layers += `<path class="cx-layer${on ? ' on' : ''}" style="--k:${k}" d="${contour(y + k * 7, i * 1.7 + k * .4, W - 310)}"/>`;
    });
    ys.forEach((p, i) => {
      if (i) { const q = ys[i - 1]; path += `<path class="cx-climb" d="M${q.x},${q.y} C${q.x},${(q.y + p.y) / 2} ${p.x},${(q.y + p.y) / 2} ${p.x},${p.y}"/>`; }
      const changed = !i || ys[i - 1].nm !== p.nm;
      marks += `<g class="cx-mark${p.on ? ' on' : ''}" transform="translate(${p.x} ${p.y})">${p.on ? '<circle class="cx-mark-pulse" r="14"/>' : ''}<circle r="${p.on ? 7 : 4.5}"/>${p.s.locked ? '<circle class="cx-lock" r="11"/>' : ''}</g>
        <text class="cx-lbl${p.on ? ' on' : ''}" x="${W - 210}" y="${p.y + 4}">${esc(chOf(p.s))}${changed ? ' · ' + esc(p.nm.replace(/^The /, '').toUpperCase()) : ' · ″'}</text>
        ${changed && i && p.s.archetypeReason ? `<text class="cx-why" x="${W - 210}" y="${p.y + 17}">${esc(p.s.archetypeReason.slice(0, 40))}${p.s.archetypeReason.length > 40 ? '…' : ''}</text>` : ''}
        <line class="cx-lead" x1="${p.x + 9}" y1="${p.y}" x2="${W - 216}" y2="${p.y}"/>`;
    });
    if (heading && ys.length) {
      const top = ys[ys.length - 1], hy = top.y - 50, hx = names.includes(heading) ? col(heading) : W - 330;
      path += `<path class="cx-ahead" d="M${top.x},${top.y} C${top.x},${hy + 20} ${hx},${hy + 20} ${hx},${hy}"/>`;
      marks += `<g class="cx-mark ahead" transform="translate(${hx} ${hy})"><circle r="6"/></g><text class="cx-lbl ahead" x="${W - 210}" y="${hy + 4}">→ ${esc(heading.toUpperCase())}</text>`;
    }
    return `<div class="cx-arc">${tape}
      <svg class="cx-strata" viewBox="0 0 ${W} ${H}" role="img" aria-label="Archetype path through ${n} chapter version${n === 1 ? '' : 's'}">
        <g class="cx-layers">${layers}</g>${path}${marks}
      </svg>
      <p class="cx-arc-note">${heading ? '&gt; HEADING TOWARD: ' + esc(heading) : '&gt; HEADING TOWARD: <span class="dim">not set</span>'}</p>
    </div>`;
  }
  function wireArc(page) {
    const tape = page.querySelector('.cx-tape'); if (!tape) return;
    // keep the current stop under the needle
    const cur = tape.querySelector('.cx-tape-stop.cur');
    const track = tape.querySelector('.cx-tape-track');
    if (cur && track) requestAnimationFrame(() => { track.style.transform = `translateX(${tape.clientWidth / 2 - (cur.offsetLeft + cur.offsetWidth / 2)}px)`; });
  }

  // ================================================================
  window.EpitaphCodexViews = {
    has: tab => tab === 'ties' || tab === 'arc',
    // the right-hand column for this tab
    html(tab, char, snap, chg) {
      return `<div class="codex-right cx-right">${tab === 'ties' ? tiesHtml(char, snap, chg) : arcHtml(char, snap)}</div>`;
    },
    wire(tab, page, char, snap) {
      if (tab === 'ties') wireTies(page, char);
      if (tab === 'arc') wireArc(page);
    }
  };
})();
