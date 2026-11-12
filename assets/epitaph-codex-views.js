/* Epitaph — "New" presentations for three codex tabs, each adding one new
 * dimension on top of the tabs before it:
 *
 *   ties       -> Bond strips: one tall vertical strip per tie (poster style),
 *                 with what the other person calls them back at the foot and
 *                 the bond's arc down the selected strip.
 *   arc        -> Heading HUD over strata: a heading tape of archetypes with a
 *                 needle and the "heading toward" marker, above stacked
 *                 contour layers (one per chapter) that the path climbs.
 *   knowledge  -> System windows: facts, known secrets and secrets kept from
 *                 them as overlapping windows; kept ones are redacted, reveals
 *                 pop a dialog. Windows can be dragged and raised.
 *
 * Loaded before index.html's main script runs its first render; every
 * function here is called later and uses index.html's globals (state,
 * escapeHtml, escapeAttr, getActiveSnapshot, findCharacterById, ...).
 * A per-tab Classic / New switch is remembered per browser.
 */
(function () {
  'use strict';
  const esc = s => escapeHtml(s == null ? '' : String(s));
  const attr = s => escapeAttr(s == null ? '' : String(s));
  const KEY = 'epitaph-codex-look';
  let looks = {};
  try { looks = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { looks = {}; }
  const lookOf = tab => looks[tab] === 'classic' ? 'classic' : 'new';
  function setLook(tab, v) {
    looks[tab] = v;
    try { localStorage.setItem(KEY, JSON.stringify(looks)); } catch (e) { /* not remembered */ }
  }
  const switchHtml = tab => `<div class="cx-look" role="group" aria-label="Presentation">
    <button type="button" data-cx-look="new" class="${lookOf(tab) === 'new' ? 'on' : ''}" aria-pressed="${lookOf(tab) === 'new'}">New</button>
    <button type="button" data-cx-look="classic" class="${lookOf(tab) === 'classic' ? 'on' : ''}" aria-pressed="${lookOf(tab) === 'classic'}">Classic</button></div>`;
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
  function wireTies(page, char, snap, rerender) {
    const box = page.querySelector('.cx-strips'); if (!box) return;
    const strips = [...box.querySelectorAll('.cx-strip')];
    const pick = (b) => { if (b.classList.contains('on')) return; tieFocus[char.id] = b.dataset.tie; rerender(); const nb = document.querySelector(`.cx-strip[data-tie="${CSS.escape(b.dataset.tie)}"]`); if (nb) nb.focus({ preventScroll: true }); };
    strips.forEach(b => b.addEventListener('click', (e) => { if (e.target.closest('.cx-open')) return; pick(b); }));
    box.addEventListener('keydown', (e) => {
      const k = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!k) return;
      e.preventDefault();
      const i = strips.findIndex(b => b.classList.contains('on'));
      const nb = strips[Math.min(strips.length - 1, Math.max(0, i + k))];
      if (nb) pick(nb);
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
  // KNOWLEDGE — system windows
  // ================================================================
  const dismissed = new Set();
  function secretHistory(char, snap, text) {
    // first chapter they knew it, and when each name started knowing it
    const out = { revealed: null, learned: [] };
    const seen = new Set();
    let knewBefore = null, first = true;
    for (const s of byChapter(char)) {
      const x = (s.secrets || []).find(y => (y.text || '').trim().toLowerCase() === text.trim().toLowerCase());
      if (x) {
        if (knewBefore === false && x.characterKnows && !out.revealed) out.revealed = chOf(s);
        knewBefore = !!x.characterKnows;
        // names already there when the secret first appears are not "learned"
        String(x.knownBy || '').split(/\s*(?:,|;|&|\band\b)\s*/i).map(p => p.trim()).filter(Boolean).forEach(p => {
          const k = p.toLowerCase();
          if (!seen.has(k)) { if (!first) out.learned.push({ who: p, ch: chOf(s) }); seen.add(k); }
        });
        first = false;
      }
      if (s.id === snap.id) break;
    }
    return out;
  }
  function knowledgeHtml(char, snap) {
    const kn = snap.knowledge || [], se = snap.secrets || [];
    if (!kn.length && !se.length) return `<div class="sys-empty">Nothing known yet. Add facts and secrets with “Edit knowledge”.</div>`;
    const known = se.filter(x => x.characterKnows), kept = se.filter(x => !x.characterKnows);
    const me = (char.name || 'them').toUpperCase().replace(/\s+/g, '_');
    const who = (x) => String(x.knownBy || '').split(/\s*(?:,|;|&|\band\b)\s*/i).map(p => p.trim()).filter(Boolean);
    const chip = (p) => { const c = state.characters.find(z => (z.name || '').toLowerCase() === p.toLowerCase()); return `<span class="cx-who${c ? ' file' : ''}" title="${attr(p)}">${c ? portraitOf(c) : ''}<i>${esc(p)}</i></span>`; };
    const win = (id, title, body, cls) => `<section class="cx-win ${cls || ''}" data-win="${id}" tabindex="-1"><header class="cx-win-bar"><span class="cx-win-box" aria-hidden="true"></span><h4>${esc(title)}</h4><span class="cx-win-lines" aria-hidden="true"></span></header><div class="cx-win-body">${body}</div></section>`;
    const facts = win('facts', 'FACTS.TXT', kn.length ? kn.map(t => `<p>&gt; ${esc(t)}</p>`).join('') : '<p class="dim">&gt; empty</p>', 'w-facts');
    const secrets = win('known', 'SECRETS · KNOWN', known.length ? known.map(x => { const h = secretHistory(char, snap, x.text || ''); return `<div class="cx-sec"><p>${esc(x.text || 'Untitled secret')}</p>
      <div class="cx-sec-meta">${h.revealed ? `<span class="cx-tag rev">REVEALED · ${esc(h.revealed)}</span>` : ''}${h.learned.map(l => `<span class="cx-tag">${esc(l.who.toUpperCase())} LEARNED · ${esc(l.ch)}</span>`).join('')}</div>
      ${who(x).length ? `<div class="cx-whos"><small>ALSO KNOWN BY</small>${who(x).map(chip).join('')}</div>` : ''}</div>`; }).join('') : '<p class="dim">&gt; none</p>', 'w-known');
    const keptWin = win('kept', `KEPT_FROM_${me}`, kept.length ? kept.map((x, i) => `<button type="button" class="cx-redact" aria-label="Kept secret ${i + 1}, hover or focus to read"><span class="cx-redact-bar" aria-hidden="true"></span><span class="cx-redact-text">${esc(x.text || 'Untitled secret')}</span></button>
      ${who(x).length ? `<div class="cx-whos"><small>KNOWN BY</small>${who(x).map(chip).join('')}</div>` : ''}`).join('') : '<p class="dim">&gt; nothing is kept from them</p>', 'w-kept');
    // a reveal in this chapter version pops a dialog
    const prev = typeof previousSnapshot === 'function' ? previousSnapshot(char, snap) : null;
    const fresh = prev ? known.filter(x => (prev.secrets || []).some(y => (y.text || '').trim().toLowerCase() === (x.text || '').trim().toLowerCase() && !y.characterKnows)) : [];
    const dkey = snap.id + ':' + fresh.map(x => x.text).join('|');
    const dialog = fresh.length && !dismissed.has(dkey) ? `<section class="cx-win cx-alert" data-win="alert" data-dkey="${attr(dkey)}" role="alertdialog" aria-label="Secret revealed"><div class="cx-win-body"><span class="cx-alert-ico" aria-hidden="true">!</span><div><p><b>Secret revealed · ${esc(chOf(snap))}</b></p>${fresh.map(x => `<p>${esc(x.text)}</p>`).join('')}<button type="button" class="cx-alert-ok">Acknowledge</button></div></div></section>` : '';
    const task = `<footer class="cx-task"><span>▣ ${esc(chOf(snap))}</span><span>${kn.length} FACT${kn.length === 1 ? '' : 'S'}</span><span>${known.length}/${se.length} SECRETS KNOWN</span><span class="cx-task-r">${kept.length ? kept.length + ' REDACTED' : 'NOTHING HIDDEN'}</span></footer>`;
    return `<div class="cx-desk">${facts}${secrets}${keptWin}${dialog}${task}</div>`;
  }
  function wireKnowledge(page) {
    const desk = page.querySelector('.cx-desk'); if (!desk) return;
    let z = 5;
    desk.querySelectorAll('.cx-win').forEach(w => {
      w.addEventListener('pointerdown', () => { w.style.zIndex = ++z; });
      const bar = w.querySelector('.cx-win-bar');
      if (!bar || !matchMedia('(min-width: 900px)').matches) return;
      bar.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const sx = e.clientX, sy = e.clientY, ox = parseFloat(w.dataset.dx || 0), oy = parseFloat(w.dataset.dy || 0);
        bar.setPointerCapture(e.pointerId);
        const move = (ev) => { const dx = ox + ev.clientX - sx, dy = oy + ev.clientY - sy; w.dataset.dx = dx; w.dataset.dy = dy; w.style.translate = `${dx}px ${dy}px`; };
        const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); };
        bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up);
      });
    });
    const ok = desk.querySelector('.cx-alert-ok');
    if (ok) ok.addEventListener('click', () => { const a = ok.closest('.cx-alert'); dismissed.add(a.dataset.dkey); a.remove(); });
  }

  // ================================================================
  window.EpitaphCodexViews = {
    has: tab => tab === 'ties' || tab === 'arc' || tab === 'knowledge',
    look: lookOf,
    switchHtml,
    // returns the right-hand html for the "new" look
    html(tab, char, snap, chg) {
      if (tab === 'ties') return `<div class="codex-right cx-right">${tiesHtml(char, snap, chg)}</div>`;
      if (tab === 'arc') return `<div class="codex-right cx-right">${arcHtml(char, snap)}</div>`;
      return `<div class="codex-right cx-right">${knowledgeHtml(char, snap)}</div>`;
    },
    wire(tab, page, char, snap, rerender) {
      page.querySelectorAll('[data-cx-look]').forEach(b => b.addEventListener('click', () => { if (lookOf(tab) === b.dataset.cxLook) return; setLook(tab, b.dataset.cxLook); rerender(); }));
      if (lookOf(tab) !== 'new') return;
      if (tab === 'ties') wireTies(page, char, snap, rerender);
      if (tab === 'arc') wireArc(page);
      if (tab === 'knowledge') wireKnowledge(page);
    }
  };
})();
