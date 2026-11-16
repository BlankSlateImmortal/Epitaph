/* Epitaph — the wide editors, designed on the canvas "Epitaph Edit Menus" (2026-11-16):
 *   Stats (seven pip ladders) · Power (threat ruler + Cut tablets) · Skills (the forge: glyph centre,
 *   seven spokes, derivatives straight out) · Inventory (the relic bench) · New profile (type first).
 *   …and the chapter editors: Chapter, Marks, Ties, Arc, Knowledge, New chapter.
 * Loaded after index.html's main script. It replaces these index functions by name, so every button
 * that already opens them now opens the new editors: openStatsOnlyForm, openPowerForm,
 * openSkillsOnlyForm, openInventoryOnlyForm, openCharacterForm (+ renderInventoryEditor and
 * syncInventoryFromDOM gain a "bench" mode). All saving still goes through index.html's helpers. */
(function () {
  'use strict';
  const esc = s => escapeHtml(s == null ? '' : String(s));
  const attr = s => escapeAttr(s == null ? '' : String(s));
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  // ---- wide modal ----
  const baseOpenModal = openModal;
  openModal = function (opts) {
    modalContent.classList.toggle('wide', !!(opts && opts.wide));
    baseOpenModal();
  };
  function head(title, sub, saveId, saveLabel, extra) {
    return `<div class="ed-head"><div class="ed-title"><span class="ed-crt">EPITAPH // ${esc(title)}</span>${sub ? `<span class="ed-sub">${esc(sub)}</span>` : ''}${extra || ''}</div>
      <div class="ed-acts"><button type="button" class="ed-slant ghost" data-ed-cancel>Cancel</button>${saveId ? `<button type="button" class="ed-slant primary" id="${saveId}">${esc(saveLabel)}</button>` : ''}</div></div>`;
  }
  function wireCancel() { modalContent.querySelectorAll('[data-ed-cancel]').forEach(b => b.addEventListener('click', closeModal)); }
  function subFor(char, snap) {
    const t = (RACES.find(r => r.id === char.race) || {}).label || 'No type';
    return [char.name || 'Unnamed', snap.chapterRange || '', t].filter(Boolean).join(' · ');
  }

  // =====================================================================
  // STATS — seven pip ladders
  // =====================================================================
  const CAP_REASON = {
    person: { body: 'Cuts carve it', control: 'name tier' },
    voided: { body: 'Cuts carve it', reserve: 'no dormant name' },
    storyborn: { body: 'Cuts carve it', reserve: 'tier', control: 'tier', will: '8 − tier' },
    godling: { body: 'level', reserve: 'level' },
    fallen: { weight: 'grafts' },
    twisted: { weight: 'unwritten' }
  };
  const SLOT_GENERIC = ['Body', 'Will', 'Reserve', 'Control', 'Story weight', 'Renown', 'Insight'];
  function heptagon(char, snap, vals) {
    const cx = 150, cy = 150, R = 112;
    const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 7; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    const poly = r => STAT_SLOTS.map((_, i) => pt(i, r).map(n => n.toFixed(1)).join(',')).join(' ');
    const data = STAT_SLOTS.map((k, i) => pt(i, Math.max(4, (vals[k] || 0) / 7 * R)).map(n => n.toFixed(1)).join(',')).join(' ');
    const names = statNames(char);
    const labels = STAT_SLOTS.map((k, i) => {
      const [x, y] = pt(i, R + 18), d = statDanger(char, snap, k, vals[k] || 0);
      return `<text x="${x.toFixed(0)}" y="${(y + 4).toFixed(0)}" text-anchor="${x < cx - 10 ? 'end' : x > cx + 10 ? 'start' : 'middle'}" fill="${d ? '#f08a74' : '#b5904f'}" font-family="Space Mono" font-size="9">${esc(names[i].toUpperCase())}</text>`;
    }).join('');
    const dots = STAT_SLOTS.map((k, i) => statDanger(char, snap, k, vals[k] || 0) ? (() => { const [x, y] = pt(i, Math.max(4, (vals[k] || 0) / 7 * R)); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#d4452b"></circle>`; })() : '').join('');
    return `<svg viewBox="-30 -10 360 320" width="100%" role="img" aria-label="Seven-point chart of ${attr(char.name || 'this character')}'s stats">
      <polygon points="${poly(R)}" fill="none" stroke="rgba(255,178,56,.25)"></polygon>
      <polygon points="${poly(R * 5 / 7)}" fill="none" stroke="rgba(255,178,56,.14)"></polygon>
      <polygon points="${poly(R * 3 / 7)}" fill="none" stroke="rgba(255,178,56,.1)"></polygon>
      <polygon points="${data}" fill="rgba(255,178,56,.18)" stroke="#ffb238" stroke-width="2"></polygon>${dots}${labels}</svg>`;
  }
  function statsHtml(char, snap, vals) {
    const names = statNames(char), t = typeOf(char);
    const rows = STAT_SLOTS.map((k, i) => {
      const cap = statCap(char, snap, k), v = Math.min(cap, vals[k] || 0), danger = statDanger(char, snap, k, v);
      const reason = cap < 7 ? `max ${cap}${(CAP_REASON[t] || {})[k] ? ' (' + CAP_REASON[t][k] + ')' : ''}` : '';
      const pips = Array.from({ length: 7 }, (_, j) => {
        const n = j + 1;
        if (n > cap) return `<span class="ed-pip lock ed-hatch" title="Locked by progression"></span>`;
        const hot = n <= v && statDanger(char, snap, k, n) === 'high';
        return `<button type="button" class="ed-pip${n <= v ? (hot ? ' hot' : ' on') : ''}" data-slot="${k}" data-n="${n}" title="${attr(n + ' · ' + statLevelName(char, k, n))}" aria-label="${attr(names[i])} ${n}: ${attr(statLevelName(char, k, n))}" aria-pressed="${n === v}"></button>`;
      }).join('');
      const scale = t === 'person' && k === 'control' ? `<div class="st-scale"><span class="${v <= 2 ? 'on' : ''}">1–2 RECITE</span><span class="${v >= 3 && v <= 5 ? 'on' : ''}">3–5 HAND SIGNS</span><span class="${v >= 6 ? 'on' : ''}">6–7 SILENT</span></div>` : '';
      return `<div class="st-row${danger ? ' danger' : ''}">
        <div class="st-num">${String(i + 1).padStart(2, '0')}</div>
        <div><div class="st-name">${esc(names[i])}</div><div class="st-tag">${esc(SLOT_GENERIC[i])}${reason ? ' · ' + esc(reason) : ''}${danger ? ' · ⚠ ' + danger : ''}</div></div>
        <div class="st-body"><div class="st-pips">${pips}</div>${scale || `<div class="st-help">${esc(statHelp(char, k) || '')}</div>`}</div>
        <div class="st-val">${v || '—'}<small class="st-lvl${v >= 7 ? ' mastered' : ''}">${esc(statLevelName(char, k, v))}</small></div></div>`;
    }).join('');
    return head('EDIT STATS', subFor(char, snap), 'stSave', 'Save stats') + `<div class="ed-cols">
      <div class="ed-main"><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-bottom:10px">
        <div><div class="ed-kicker">Stats · always seven · 1 to 7</div><div class="ed-big">Seven</div></div>
        <div class="st-legend"><span><i style="background:var(--amber)"></i>Set</span><span><i style="border:1px solid var(--amber-dim)"></i>Open</span><span><i class="ed-hatch"></i>Locked by progression</span><span><i style="background:var(--ember)"></i>Danger</span></div></div>
        <div class="st-rows">${rows}</div></div>
      <div class="ed-panel"><div class="ed-box"><div class="ed-readout" style="display:flex;justify-content:space-between"><b>SHAPE</b><b>${esc((char.name || '').toUpperCase())}</b></div>${heptagon(char, snap, vals)}</div>
        <div class="ed-box thin"><div class="ed-kicker">What the maximums follow</div><div style="font-size:13px;line-height:1.55;color:#d9cbb0">Each Cut lowers the Body maximum for good; the name tier caps Precision; a Storyborn's tier caps Draw and Dominion and drains Selfhood; a Godling's level caps Vessel and Capacity; grafts raise a Fallen's Exposure.</div>
        <div class="ed-kicker" style="margin-top:6px">Click a pip to set it; click the top pip again to lower it.</div></div></div></div>`;
  }
  openStatsOnlyForm = function (char, snap) {
    if (blockIfLocked(snap)) return;
    if (!hasStats(char)) { showToast(`${char.name || 'This character'} is beyond the scale: gods are unrated.`); return; }
    const vals = normalizeStats(snap.stats);
    const draw = () => {
      modalContent.innerHTML = statsHtml(char, snap, vals);
      wireCancel();
      modalContent.querySelectorAll('.ed-pip[data-slot]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.slot, n = +b.dataset.n;
        vals[k] = vals[k] === n ? n - 1 : n; draw();
        const again = modalContent.querySelector(`.ed-pip[data-slot="${k}"][data-n="${n}"]`); if (again) again.focus();
      }));
      document.getElementById('stSave').addEventListener('click', async () => {
        STAT_SLOTS.forEach(k => { vals[k] = Math.min(statCap(char, snap, k), vals[k] || 0); });
        snap.stats = normalizeStats(vals);
        await persistState(); renderAll(); closeModal();
      });
    };
    draw(); openModal({ wide: true });
  };

  // =====================================================================
  // POWER — threat ruler, type ladders, Cut tablets, gifts
  // =====================================================================
  const THREAT_SHORT = { '1': 'Yourself', '2': 'A few', '3': 'A district', '4': 'Settlement', '5': 'A region', '5.5': 'Several', '6': 'A face', '7': 'The planet', beyond: 'Gods' };
  function lockedThreatLabel(char, v) {
    if (v === 'beyond') return 'Gods';
    if (v === '7') return 'Godlings';
    if (typeOf(char) === 'person' && v === '6') return 'Cut only';
    return 'Locked';
  }
  function powerHtml(char, snap, d) {
    const fields = powerFieldsFor(char), has = k => fields.includes(k), t = typeOf(char);
    const allowed = threatOptionsFor(char, { power: d }).map(x => x.v);
    const order = THREAT_LEVELS.map(x => x.v), selIdx = order.indexOf(d.threat);
    const ruler = THREAT_LEVELS.map((x, i) => {
      const ok = allowed.includes(x.v), on = x.v === d.threat;
      if (!ok) { const lab = lockedThreatLabel(char, x.v); return `<button type="button" class="ed-cell ${lab === 'Cut only' ? 'cut' : 'ed-hatch'}" disabled><b>${x.v === '5.5' ? '5½' : x.v === 'beyond' ? '∞' : esc(x.v)}</b><small>${esc(lab)}</small></button>`; }
      return `<button type="button" class="ed-cell${on ? ' on' : (selIdx > -1 && i < selIdx ? ' past' : '')}" data-threat="${attr(x.v)}" aria-pressed="${on}"><b>${x.v === '5.5' ? '5½' : x.v === 'beyond' ? '∞' : esc(x.v)}</b><small>${esc(THREAT_SHORT[x.v])}${on ? ' ◂' : ''}</small></button>`;
    }).join('');
    const capText = { storyborn: 'cap for a Storyborn: a face', person: 'cap for a person: several regions · a face opens with a Cut', voided: 'cap for the Voided: a region', fallen: 'cap for the Fallen: a settlement', godling: 'cap for a Godling: the planet', twisted: 'one of a kind: uncapped' }[t] || (isGodType(char) ? 'gods are beyond the scale' : '');
    const ladder = (key, n, labels, cur) => `<div class="pw-mini" style="grid-template-columns:repeat(${n},minmax(0,1fr))">${Array.from({ length: n }, (_, i) => `<button type="button" class="ed-cell${cur === i + 1 ? ' on' : (cur > i + 1 ? ' past' : '')}" data-ladder="${key}" data-n="${i + 1}" style="min-height:58px"><b>${i + 1}</b><small>${esc(labels[i] || '')}</small></button>`).join('')}</div>`;
    const ranks = voidedRanksFor(snap);
    const rankPlates = VOIDED_RANKS.map(r => ranks.includes(r)
      ? `<button type="button" class="ed-chip${d.voidedRank === r ? ' on' : ''}" data-rank="${attr(r)}">${esc(r.toUpperCase())}</button>`
      : `<button type="button" class="ed-chip ed-hatch" disabled title="${r === 'Clear' ? 'Needs Edge 5' : 'Needs Edge 7'}">${esc(r.toUpperCase())} · ${r === 'Clear' ? 'EDGE 5' : 'EDGE 7'}</button>`).join('');
    const bodyName = statName(char, 'body'), bodyCap = statCap(char, { ...snap, power: d }, 'body');
    const cuts = d.cuts.map((c, i) => `<div class="pw-tablet"><div class="pw-tablet-num"><span>CUT</span><b>${ROMAN[i] || i + 1}</b></div><div class="pw-tablet-body">
        <button type="button" class="pw-x" data-cut-x="${i}" aria-label="Remove this Cut">×</button>
        <label class="ed-field">The desire<input type="text" data-cut="${i}" data-f="desire" value="${attr(c.desire)}" placeholder="What they wanted"></label>
        <label class="ed-field">What they gave<input type="text" data-cut="${i}" data-f="cost" value="${attr(c.cost)}" placeholder="An emotion, a memory, a piece of themselves" list="cutCosts"></label>
        <label class="ed-field">The boon<input type="text" data-cut="${i}" data-f="boon" value="${attr(c.boon)}" placeholder="Its name" style="font-family:'Pirata One',serif;font-size:19px"></label>
        <div class="pw-chant">Here lies what I was. I give it: ${esc(c.cost || '…')}. I bind it, I bury it, I nail it down. Carve it, World, and read it back to me. Let the grave of gods hold one line more. <b>Epitaph.</b></div></div></div>`).join('');
    const gifts = d.gifts.map((g, i) => `<div class="pw-gift"><span class="pw-seal">${esc((g.from || '?').trim().charAt(0).toUpperCase() || '?')}</span>
        <label class="ed-field">From<input type="text" data-gift="${i}" data-f="from" value="${attr(g.from)}" placeholder="Storyborn"></label>
        <label class="ed-field">What it does<input type="text" data-gift="${i}" data-f="what" value="${attr(g.what)}"></label>
        <button type="button" class="pw-x" style="position:static" data-gift-x="${i}" aria-label="Remove this gift">×</button></div>`).join('');
    const text = (k, label, ph) => `<label class="ed-field">${esc(label)}<input type="text" data-k="${k}" value="${attr(d[k])}" placeholder="${attr(ph)}"></label>`;
    const area = (k, label, ph) => `<label class="ed-field">${esc(label)}<textarea data-k="${k}" placeholder="${attr(ph)}">${esc(d[k])}</textarea></label>`;
    return head('EDIT POWER', subFor(char, snap), 'pwSave2', 'Save power') + `
      <div class="ed-box" style="margin-bottom:18px"><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap">
        <div><div class="ed-kicker">Threat · the shared scale</div><div class="ed-big" style="font-size:54px;color:var(--amber)">${esc(threatLabel(d.threat) || 'Unrated')}</div></div>
        <div class="ed-readout" style="color:var(--dust)">&gt; ${esc(capText.toUpperCase())}</div></div>
        <div class="pw-ruler">${ruler}</div></div>
      <div class="ed-cols"><div class="ed-main" style="display:flex;flex-direction:column;gap:14px">
        ${has('domain') ? `<div class="ed-box thin"><div class="ed-kicker">Storyborn tier · domain size</div>${ladder('domain', 7, DOMAIN_SIZES.slice(1), d.domain)}</div>` : ''}
        ${has('planeLevel') ? `<div class="ed-box thin"><div class="ed-kicker">Godling level${char.lore && char.lore.plane ? ' · ' + esc(char.lore.plane) : ''}</div>${ladder('planeLevel', 7, ['Seed', 'Contact', 'Reach', 'Footing', 'Bridge', 'Bearer', 'Vessel'], d.planeLevel)}</div>` : ''}
        ${has('voidedRank') ? `<div class="ed-box thin"><div class="ed-kicker">Voided rank · Black Hand → Clear → Switcher</div><div class="ed-chips">${rankPlates}</div></div>` : ''}
        ${has('cuts') ? `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap"><div><div class="ed-kicker">The Cut · what they gave, what the world carved</div><div class="ed-big" style="font-size:54px">Cuts</div></div>
          <button type="button" class="ed-slant danger" id="pwAddCut">+ Cut${['person', 'voided', 'storyborn'].includes(t) ? ` · ${esc(bodyName)} max ${bodyCap} → ${Math.max(0, bodyCap - 1)}` : ''}</button></div>
          ${cuts || `<div class="ed-box thin" style="align-items:center;font-family:var(--f-crt);font-size:18px;color:var(--dust)">&gt; No Cuts. Each one carves the heart.</div>`}
          <datalist id="cutCosts"><option value="An emotion: "></option><option value="A memory: "></option><option value="A bond: "></option><option value="A piece of myself: "></option></datalist>` : ''}
        ${!has('cuts') && !has('domain') && !has('planeLevel') && !has('voidedRank') ? `<div class="ed-box thin ed-readout" style="color:var(--dust)">&gt; ${isGodType(char) ? 'Swayed only by their concept. Nothing else to record.' : 'This type has no Cuts. Record the rest on the right.'}</div>` : ''}
      </div>
      <div class="ed-panel">
        ${has('gift') ? `<div class="ed-box"><div class="ed-readout" style="display:flex;justify-content:space-between;color:var(--gold)"><span>GIFTS · ONE PER STORYBORN</span><span>${d.gifts.length}</span></div>${gifts}<button type="button" class="ed-chip" id="pwAddGift" style="align-self:flex-start">+ GIFT</button></div>` : ''}
        <div class="ed-box thin">
          ${has('herald') ? text('herald', t === 'storyborn' ? 'Their Herald (one per Storyborn)' : 'Herald of', t === 'storyborn' ? 'Who carries their reach' : 'Which Storyborn, if any') : ''}
          ${has('black') ? text('black', 'The Black', 'How far it covers them') : ''}
          ${has('rings') ? text('rings', 'Heart rings', 'Skills lifted off the heart, scars from chaining') : ''}
          ${has('grafts') ? area('grafts', 'Grafts (one per line)', 'Reality seal · left gauntlet') : ''}
          ${area('notes', 'Notes', 'Anything else about their power this chapter')}
        </div></div></div>`;
  }
  openPowerForm = function (char, snap) {
    if (blockIfLocked(snap)) return;
    const p = normalizePower(snap.power);
    const d = { ...p, cuts: p.cuts.map(c => ({ ...c })), gifts: parseGifts(p.gift) };
    const sync = () => {
      modalContent.querySelectorAll('[data-k]').forEach(el => { d[el.dataset.k] = el.value; });
      modalContent.querySelectorAll('[data-cut]').forEach(el => { const c = d.cuts[+el.dataset.cut]; if (c) c[el.dataset.f] = el.value; });
      modalContent.querySelectorAll('[data-gift]').forEach(el => { const g = d.gifts[+el.dataset.gift]; if (g) g[el.dataset.f] = el.value; });
    };
    const draw = () => {
      modalContent.innerHTML = powerHtml(char, snap, d);
      wireCancel();
      const on = (sel, fn) => modalContent.querySelectorAll(sel).forEach(b => b.addEventListener('click', () => { sync(); fn(b); draw(); }));
      on('[data-threat]', b => { d.threat = d.threat === b.dataset.threat ? '' : b.dataset.threat; });
      on('[data-ladder]', b => { const k = b.dataset.ladder, n = +b.dataset.n; d[k] = d[k] === n ? 0 : n; });
      on('[data-rank]', b => { d.voidedRank = d.voidedRank === b.dataset.rank ? '' : b.dataset.rank; });
      on('#pwAddCut', () => { d.cuts.push({ desire: '', cost: '', boon: '' }); });
      on('[data-cut-x]', b => { d.cuts.splice(+b.dataset.cutX, 1); });
      on('#pwAddGift', () => { d.gifts.push({ from: '', what: '' }); });
      on('[data-gift-x]', b => { d.gifts.splice(+b.dataset.giftX, 1); });
      document.getElementById('pwSave2').addEventListener('click', async () => {
        sync();
        const froms = d.gifts.map(g => g.from.trim().toLowerCase()).filter(Boolean);
        const dupe = froms.find((f, i) => froms.indexOf(f) !== i);
        if (dupe) { showToast(`One gift per Storyborn: ${dupe} is listed twice.`, { duration: 6000 }); return; }
        const next = { ...d, cuts: d.cuts.filter(c => c.desire || c.cost || c.boon), gift: d.gifts.filter(g => g.from || g.what).map(g => `${g.from.trim()} | ${g.what.trim()}`).join('\n') };
        delete next.gifts;
        if (next.threat && !threatOptionsFor(char, { power: next }).some(x => x.v === next.threat)) next.threat = '';
        snap.power = normalizePower(next);
        STAT_SLOTS.forEach(k => { snap.stats[k] = Math.min(statCap(char, snap, k), Number(snap.stats[k]) || 0); });
        await persistState(); renderAll(); closeModal();
      });
    };
    draw(); openModal({ wide: true });
  };

  // =====================================================================
  // SKILLS — the forge
  // =====================================================================
  const C = 380, SPOKE_R = 150, DEPTH_R = [225, 290, 345];
  const ang = k => k * 2 * Math.PI / 7;                 // 0 = up, clockwise
  const at = (a, r) => [C + r * Math.sin(a), C - r * Math.cos(a)];
  const pct = n => (n / 760 * 100).toFixed(2) + '%';
  let fgSel = null;
  function uniqueName(base) { let n = base, i = 2; while (pendingSkills.some(s => s.name === n)) n = base + ' ' + i++; return n; }
  function coreGlyph(char, core) {
    if (core && core.glyph) return core.glyph;
    const g = (char.glyph || '').trim(); if (g) return Array.from(g)[0];
    return core ? (core.name || '?').charAt(0).toUpperCase() : '+';
  }
  function forgeLayout(char, snap) {
    const list = pendingSkills, capped = skillsCapped(char), tier = capped ? nameTier(snap) : 7;
    const coreIdx = list.findIndex(s => s.name && !s.parent);
    const core = coreIdx > -1 ? list[coreIdx] : null;
    const branches = core ? list.map((s, i) => ({ s, i })).filter(x => x.s.parent === core.name && x.i !== coreIdx) : [];
    const nodes = [], lines = [], slots = [], locks = [];
    if (core) nodes.push({ i: coreIdx, kind: 'core', x: C, y: C });
    for (let k = 0; k < 7; k++) {
      const a = ang(k), b = branches[k];
      const [sx, sy] = at(a, 108), [ex, ey] = at(a, 345);
      if (b) {
        const [x, y] = at(a, SPOKE_R);
        lines.push({ x1: sx, y1: sy, x2: x, y2: y, cls: 'grown' });
        nodes.push({ i: b.i, kind: 'branch', x, y, spoke: k });
        // derivatives straight out along this spoke
        let frontier = [{ name: b.s.name, x, y }], depth = 0;
        while (frontier.length && depth < 6) {
          const kids = [];
          frontier.forEach(f => list.forEach((s, i) => { if (s.name && s.parent === f.name) kids.push({ s, i, from: f }); }));
          if (!kids.length) break;
          const r = DEPTH_R[depth] || 345 + (depth - 2) * 40;
          kids.forEach((kd, j) => {
            const off = (j - (kids.length - 1) / 2) * 0.14;
            const [kx, ky] = at(a + off, Math.min(r, 360));
            lines.push({ x1: kd.from.x, y1: kd.from.y, x2: kx, y2: ky, cls: 'deriv' });
            nodes.push({ i: kd.i, kind: 'deriv', x: kx, y: ky, depth: depth + 1 });
            kd.x = kx; kd.y = ky;
          });
          frontier = kids.map(kd => ({ name: kd.s.name, x: kd.x, y: kd.y }));
          depth++;
        }
        const maxDepth = capped ? Math.min(tier, 3) : 3;
        for (let dd = depth; dd < maxDepth; dd++) { const [px, py] = at(a, DEPTH_R[dd]); slots.push({ x: px, y: py }); }
        lines.push({ x1: x, y1: y, x2: ex, y2: ey, cls: 'guide' });
      } else if (core && k === branches.length && k < tier) {
        const [x, y] = at(a, SPOKE_R);
        lines.push({ x1: sx, y1: sy, x2: x, y2: y, cls: 'open' });
        nodes.push({ kind: 'open', x, y, spoke: k });
      } else {
        lines.push({ x1: sx, y1: sy, x2: ex, y2: ey, cls: 'faint' });
        if (capped || !core) { const [x, y] = at(a, SPOKE_R); locks.push({ x, y, k }); }
      }
    }
    const overflow = branches.slice(7).map(b => b.s.name);
    return { capped, tier, core, coreIdx, branches, nodes, lines, slots, locks, overflow };
  }
  function forgeHtml(char, snap) {
    const L = forgeLayout(char, snap), list = pendingSkills, named = list.filter(s => s.name);
    const c = skillCounts(named);
    const lineStyle = { grown: 'stroke="#ffb238" stroke-width="2"', open: 'stroke="#ffb238" stroke-width="1.5" stroke-dasharray="3 5"', deriv: 'stroke="#c9c2b4" stroke-width="1.6"', guide: 'stroke="rgba(255,178,56,.22)" stroke-dasharray="2 6"', faint: 'stroke="rgba(255,178,56,.1)"' };
    const svg = `<svg viewBox="0 0 760 760" aria-hidden="true">
      <circle cx="${C}" cy="${C}" r="225" fill="none" stroke="rgba(255,178,56,.08)" stroke-dasharray="2 8"></circle>
      <circle cx="${C}" cy="${C}" r="290" fill="none" stroke="rgba(255,178,56,.08)" stroke-dasharray="2 8"></circle>
      <circle cx="${C}" cy="${C}" r="345" fill="none" stroke="rgba(255,178,56,.08)" stroke-dasharray="2 8"></circle>
      <circle cx="${C}" cy="${C}" r="${SPOKE_R}" fill="none" stroke="#8a5a14" stroke-width="2" stroke-dasharray="1 7"></circle>
      ${L.lines.map(l => `<line x1="${l.x1.toFixed(1)}" y1="${l.y1.toFixed(1)}" x2="${l.x2.toFixed(1)}" y2="${l.y2.toFixed(1)}" ${lineStyle[l.cls]}></line>`).join('')}
      ${L.slots.map(s => `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="10" fill="#0a0704" stroke="rgba(255,178,56,.6)" stroke-dasharray="3 3"></circle>`).join('')}
      ${L.nodes.filter(n => n.kind === 'branch' || n.kind === 'deriv').map(n => { const r = n.kind === 'branch' ? 38 : 28; return `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r}" fill="none" stroke="#8a5a14" stroke-dasharray="2 5"></circle>`; }).join('')}
    </svg>`;
    const node = n => {
      if (n.kind === 'open') return `<button type="button" class="fg-node open" style="left:${pct(n.x)};top:${pct(n.y)}" data-fg-add="branch" aria-label="Grow a branch on spoke ${ROMAN[n.spoke]}">+</button><div class="fg-label" style="left:${pct(n.x >= C - 1 ? n.x + 38 : n.x - 38)};top:${pct(n.y)};transform:translate(${n.x >= C - 1 ? '0' : '-100%'},-50%);font-family:var(--f-crt);color:var(--amber)">SPOKE ${ROMAN[n.spoke]} · OPEN</div>`;
      const s = list[n.i], sel = fgSel === n.i;
      if (n.kind === 'core') return `<button type="button" class="fg-node core${sel ? ' sel' : ''}" style="left:${pct(n.x)};top:${pct(n.y)}" data-fg-sel="${n.i}" aria-label="${attr(s.name)}, core skill">${esc(coreGlyph(char, s))}</button><div class="fg-label" style="left:${pct(n.x)};top:${pct(n.y + 98)}"><small>${esc((s.name || '').toUpperCase())} · CORE · LV ${levelInfo(s.level).lvl}</small></div>`;
      const cls = `${n.kind}${s.corrupted ? ' corrupt' : ''}${sel ? ' sel' : ''}`;
      const sub = n.kind === 'branch' ? `SPOKE ${ROMAN[n.spoke]} · LV ${levelInfo(s.level).lvl}` : `DERIVATIVE · DEPTH ${n.depth}`;
      // labels sit beside the orb (outside the spoke line), so stacked derivatives never cover each other
      const off = n.kind === 'branch' ? 40 : 30, right = n.x >= C - 1;
      const lab = `left:${pct(right ? n.x + off : n.x - off)};top:${pct(n.y)};transform:translate(${right ? '0' : '-100%'},-50%);text-align:${right ? 'left' : 'right'}`;
      return `<button type="button" class="fg-node ${cls}" style="left:${pct(n.x)};top:${pct(n.y)}" data-fg-sel="${n.i}" aria-label="${attr(s.name)}">${esc((s.name || '?').charAt(0).toUpperCase())}</button><div class="fg-label${sel ? ' sel' : ''}" style="${lab}">${esc(s.name)}<small>${esc(sub)}</small></div>`;
    };
    const locks = L.locks.map(l => `<span class="fg-node lock" style="left:${pct(l.x)};top:${pct(l.y)}">${ROMAN[l.k]}</span>`).join('');
    const coreBtn = L.core ? '' : `<button type="button" class="fg-node core" style="left:50%;top:50%;font-family:var(--f-display);font-size:clamp(20px,3vw,34px)" data-fg-add="core" aria-label="Add the core skill">+ CORE</button>`;
    // detail panel
    const i = fgSel, s = i != null ? list[i] : null;
    let detail;
    if (!s) {
      detail = `<div class="fg-detail"><div class="fg-detail-head"><span>NO SKILL SELECTED</span><span>FORGE</span></div><div class="fg-detail-body"><div class="ed-readout" style="color:var(--dust)">&gt; Pick an orb to edit it.<br>&gt; ${L.core ? 'The open "+" on a spoke grows a branch.' : 'Start with the core skill in the centre.'}</div></div></div>`;
    } else {
      const depth = skillDepth(named, s), role = !s.parent ? 'core' : depth === 1 ? 'branch' : 'derivative';
      const kids = named.some(x => x.parent === s.name);
      const parentOpts = [`<option value="" ${!s.parent ? 'selected' : ''} ${skillParentAllowed(i, -1) || !s.parent ? '' : 'disabled'}>— core (no parent) —</option>`]
        .concat(list.map((p, j) => p.name && j !== i && (skillParentAllowed(i, j) || s.parent === p.name) ? `<option value="${attr(p.name)}" ${s.parent === p.name ? 'selected' : ''}>${esc(p.name)}</option>` : '').filter(Boolean)).join('');
      const canDeriv = role !== 'core' && (!L.capped || depth <= L.tier);
      const canBranch = role === 'core' && L.branches.length < Math.min(7, L.tier);
      const lv = Math.round(s.level || 0);
      detail = `<div class="fg-detail"><div class="fg-detail-head"><span>${role === 'core' ? 'THE CORE' : role === 'branch' ? 'BRANCH' : 'DERIVATIVE ' + (depth - 1)}</span><span>${role === 'core' ? 'ON THE HEART' : 'FROM ' + esc((s.parent || '').toUpperCase())}</span></div>
        <div class="fg-detail-body">
          <div class="fg-detail-name">${esc(s.name || 'Unnamed')}</div>
          <label class="ed-field">Name<input type="text" data-fg="name" value="${attr(s.name)}" style="font-family:'Pirata One',serif;font-size:20px"></label>
          ${role === 'core' ? `<label class="ed-field">Glyph in the centre (one character)<input type="text" data-fg="glyph" maxlength="2" value="${attr(s.glyph || '')}" placeholder="${attr(coreGlyph(char, { ...s, glyph: '' }))}" style="font-family:var(--f-jp);font-size:22px"></label>` : ''}
          <label class="ed-field">Branches from<select data-fg="parent">${parentOpts}</select></label>
          <div class="ed-field">Mastery · LV ${levelInfo(lv).lvl} · ${lv}/100
            <div class="fg-mastery" aria-hidden="true">${Array.from({ length: 10 }, (_, k) => `<span class="${lv >= (k + 1) * 10 ? 'on' : ''}"></span>`).join('')}</div>
            <input type="range" min="0" max="100" value="${lv}" data-fg="level" aria-label="Mastery" style="accent-color:var(--verdigris);min-height:30px;padding:0;border:0;background:none">
          </div>
          <div class="fg-purity"><label><input type="radio" name="fgPurity" value="pure" ${s.corrupted ? '' : 'checked'}> PURE</label><label class="cor"><input type="radio" name="fgPurity" value="corrupt" ${s.corrupted ? 'checked' : ''}> CORRUPTED</label></div>
          <label class="ed-field">The story in the ring<textarea data-fg="desc" style="font-style:italic">${esc(s.desc)}</textarea></label>
          <div class="ed-acts">
            ${role === 'core' ? `<button type="button" class="ed-slant teal" data-fg-add="branch" ${canBranch ? '' : 'disabled'}>+ Grow branch</button>` : `<button type="button" class="ed-slant teal" data-fg-add="deriv" ${canDeriv ? '' : 'disabled'}>+ Grow derivative</button>`}
            <button type="button" class="ed-slant danger" data-fg-remove ${kids ? 'disabled title="Remove what grows from it first"' : ''}>Remove</button>
          </div></div></div>`;
    }
    const nameBox = hasTrueName(char)
      ? `<div class="ed-box"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="ed-kicker">True name</span><span style="font-family:var(--f-display);font-size:26px;color:var(--amber)">${ROMAN[L.tier - 1] || '—'}</span></div>
          <div style="font-family:'Pirata One',serif;font-size:22px">${esc(currentName(snap) || 'Not woken yet')}</div>
          <div class="ed-tier">${Array.from({ length: 7 }, (_, k) => `<span class="${k < L.tier ? 'on' : ''}"></span>`).join('')}</div>
          <div class="ed-kicker" style="letter-spacing:.1em;text-transform:none;font-size:11px">${L.tier < 7 ? `Next refinement opens spoke ${ROMAN[L.tier]}.` : 'Every spoke is open.'}</div></div>`
      : `<div class="ed-box"><span class="ed-kicker">${isGodType(char) ? 'Authorities' : typeOf(char) === 'twisted' ? 'A corrupted gift tree' : 'Skills'}</span><div class="ed-readout">Uncapped: every spoke is open.</div></div>`;
    return head('EDIT SKILLS', subFor(char, snap), 'fgSave', 'Save skills') + `<div class="ed-cols">
      <div class="ed-side"><div><div class="ed-kicker">Skills</div><div class="ed-big">The<br>forge</div><p class="ed-copy">The core sits on the heart with the name. Seven branch spokes wrap around it; derivatives grow straight out from their branch.</p></div>
        ${nameBox}
        <div class="ed-counters"><div class="ed-counter"><b>${c.cores}<i>/1</i></b><span>CORE</span></div><div class="ed-counter"><b>${c.branches}<i>/${L.capped ? L.tier : 7}</i></b><span>BRANCHES</span></div><div class="ed-counter"><b>${c.deepest}<i>/${L.capped ? L.tier : '∞'}</i></b><span>DEPTH</span></div></div>
        ${L.overflow.length ? `<div class="ed-box thin ed-readout" style="color:#f08a74">&gt; Over seven branches: ${esc(L.overflow.join(', '))}</div>` : ''}
        <div class="ed-box thin"><div class="ed-kicker">Name spin · heart heat</div><div style="font-size:12px;line-height:1.5;color:var(--dust)">Each skill used nudges the name. Chain too many and it spins; the heart takes the heat.</div></div>
      </div>
      <div class="ed-main fg-wrap"><div class="fg-stage">${svg}${locks}${L.nodes.map(node).join('')}${coreBtn}</div>
        <div class="fg-list" aria-label="Skills">${L.nodes.filter(n => n.kind !== 'open').map(n => { const sk = list[n.i]; return `<button type="button" class="ed-chip${fgSel === n.i ? ' sel' : ''}" data-fg-sel="${n.i}">${esc(n.kind === 'core' ? '✦ ' : n.kind === 'deriv' ? '↳ ' : '')}${esc(sk.name)}</button>`; }).join('')}</div>
        <div class="fg-corner" style="left:14px;top:10px"><div><b>◆ Spokes</b> 7 · ${L.branches.length} grown</div><div><b>◆ Hint</b> pick an orb to edit it</div></div></div>
      <div class="ed-panel">${detail}</div></div>`;
  }
  openSkillsOnlyForm = function (char, snap) {
    if (blockIfLocked(snap)) return;
    if (!canHaveSkills(char)) { showToast(`${(RACES.find(r => r.id === char.race) || {}).label || 'This type'} can't hold skills.`); return; }
    startSkillEditor(char, snap, null);
    const ci = pendingSkills.findIndex(s => s.name && !s.parent);
    fgSel = ci > -1 ? ci : null;
    const syncDetail = () => {
      if (fgSel == null || !pendingSkills[fgSel]) return;
      const s = pendingSkills[fgSel], old = s.name;
      modalContent.querySelectorAll('[data-fg]').forEach(el => {
        const f = el.dataset.fg;
        if (f === 'level') s.level = Math.max(0, Math.min(100, +el.value || 0));
        else if (f === 'name') s.name = el.value.trim() || old;
        else s[f] = el.value;
      });
      const pr = modalContent.querySelector('input[name=fgPurity]:checked'); if (pr) s.corrupted = pr.value === 'corrupt';
      if (old && s.name !== old) { if (pendingSkills.some((x, j) => j !== fgSel && x.name === s.name)) { s.name = old; showToast('Skill names must be unique.'); } else pendingSkills.forEach(x => { if (x.parent === old) x.parent = s.name; }); }
    };
    const draw = () => {
      modalContent.innerHTML = forgeHtml(char, snap);
      wireCancel();
      modalContent.querySelectorAll('[data-fg-sel]').forEach(b => b.addEventListener('click', () => { syncDetail(); fgSel = +b.dataset.fgSel; draw(); }));
      modalContent.querySelectorAll('[data-fg]').forEach(el => el.addEventListener('change', () => { syncDetail(); draw(); }));
      modalContent.querySelectorAll('input[name=fgPurity]').forEach(el => el.addEventListener('change', () => { syncDetail(); draw(); }));
      modalContent.querySelectorAll('[data-fg-add]').forEach(b => b.addEventListener('click', () => {
        syncDetail();
        const L = forgeLayout(char, snap), how = b.dataset.fgAdd;
        if (how === 'core') pendingSkills.push({ name: uniqueName('Core skill'), level: 0, corrupted: false, desc: '', parent: '', glyph: '' });
        else if (how === 'branch') { if (!L.core) return; pendingSkills.push({ name: uniqueName('New branch'), level: 0, corrupted: false, desc: '', parent: L.core.name }); }
        else { const p = pendingSkills[fgSel]; if (!p) return; pendingSkills.push({ name: uniqueName('New derivative'), level: 0, corrupted: false, desc: '', parent: p.name }); }
        fgSel = pendingSkills.length - 1; draw();
      }));
      const rm = modalContent.querySelector('[data-fg-remove]');
      if (rm) rm.addEventListener('click', () => { syncDetail(); pendingSkills.splice(fgSel, 1); fgSel = null; draw(); });
      document.getElementById('fgSave').addEventListener('click', async () => {
        syncDetail();
        const r = collectEditedSkills(snap.titles || []);
        if (r.error) { showToast(r.error, { duration: 7000 }); return; }
        snap.skills = r.skills;
        await persistState(); renderAll(); closeModal();
      });
    };
    draw(); openModal({ wide: true });
  };

  // =====================================================================
  // INVENTORY — the relic bench (reuses index.html's inventory + marks helpers)
  // =====================================================================
  let benchSel = 0, benchLen = 0, benchFilter = '';
  syncInventoryFromDOM = function () {
    document.querySelectorAll('.inv-edit-row').forEach((row, n) => {
      const idx = row.dataset.idx != null ? +row.dataset.idx : n;
      const e = pendingInventoryItems[idx]; if (!e) return;
      const note = row.querySelector('.inv-note-input'); if (note) e.note = note.value;
      const nm = row.querySelector('.inv-name-input'); if (nm) e.name = nm.value;
      const ds = row.querySelector('.inv-desc-input'); if (ds) e.desc = ds.value;
      const bd = row.querySelector('.inv-bound-input'); if (bd) e.boundTo = bd.value;
    });
    syncMarksFromDOM();
  };
  const baseRenderInv = renderInventoryEditor;
  renderInventoryEditor = function () {
    const wrap = document.getElementById('inventoryEditorWrap');
    if (wrap && wrap.classList.contains('bench')) return renderBench(wrap);
    return baseRenderInv();
  };
  function renderBench(wrap) {
    const items = pendingInventoryItems, ctx = pendingInventoryChar || {};
    if (items.length > benchLen) benchSel = items.length - 1;
    benchLen = items.length;
    benchSel = Math.max(0, Math.min(benchSel, items.length - 1));
    const libItems = Lib ? Lib.get().items.slice().sort((a, b) => a.name.localeCompare(b.name)) : [];
    const list = items.map((it, i) => { const v = invView(it); return `<button type="button" class="iv-item${i === benchSel ? ' on' : ''}" data-bench="${i}" aria-pressed="${i === benchSel}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${esc(v.name)}</span>${v.state ? `<span class="iv-tag">${esc(v.state)}</span>` : ''}${it.boundTo ? '<span class="iv-tag bound">BOUND</span>' : ''}</button>`; }).join('');
    const it = items[benchSel];
    let monitor = `<div class="iv-monitor"><div class="iv-empty">&gt; Nothing carried. Add something from the Library.<span class="sig-cursor"></span></div></div>`;
    if (it) {
      const v = invView(it), i = benchSel;
      const twice = it.itemId && ctx.char ? heldTwice(ctx.char, ctx.snap, it.itemId) : [];
      const pic = v.image || v.icon;
      monitor = `<div class="iv-monitor inv-edit-row" data-idx="${i}">
        <div class="iv-monitor-head"><span>ITEM ${String(i + 1).padStart(2, '0')} / ${esc((ctx.char && ctx.char.name || '').toUpperCase())} / ${esc((ctx.snap && ctx.snap.chapterRange || '').toUpperCase())}</span><span>${v.linked ? '&gt;&gt;&gt;&gt; LIBRARY ITEM' : v.missing ? '⚠ NO LONGER IN THE LIBRARY' : 'FREE-TEXT ITEM'}</span></div>
        <div class="iv-monitor-body">
          <div class="iv-lens"><svg width="220" height="220" viewBox="0 0 220 220" aria-hidden="true"><circle cx="110" cy="110" r="104" fill="none" stroke="#8a5a14" stroke-dasharray="2 5"></circle><circle cx="110" cy="110" r="86" fill="none" stroke="rgba(255,178,56,.25)"></circle><g stroke="#ffb238"><line x1="110" y1="0" x2="110" y2="20"></line><line x1="110" y1="200" x2="110" y2="220"></line><line x1="0" y1="110" x2="20" y2="110"></line><line x1="200" y1="110" x2="220" y2="110"></line></g></svg>
            ${v.linked ? `<div class="orb">${pic ? `<img src="${pic}" alt="">` : esc(v.name.charAt(0).toUpperCase())}</div>` : `<button type="button" class="orb" data-inv-img="${i}" title="Set a photo" style="border:0;cursor:pointer">${pic ? `<img src="${pic}" alt="">` : esc((v.name || '?').charAt(0).toUpperCase())}</button>`}</div>
          <div class="iv-fields">
            ${v.linked || v.missing ? `<div class="iv-name">${esc(v.name)}</div>` : `<label class="ed-field">Name<input type="text" class="inv-name-input" value="${attr(it.name)}" placeholder="Item name"></label>`}
            ${twice.length ? `<div class="ed-readout" style="color:#f08a74">⚠ Also held by ${esc(twice.join(', '))} in the same chapter</div>` : ''}
            ${invStateHtml(it, i)}
            ${v.linked ? `<p style="margin:0;font-size:15px;line-height:1.55">${esc(v.stateDesc || v.desc)}</p>${v.origin ? `<div class="ed-kicker">From · ${esc(v.origin)}</div>` : ''}` : `<label class="ed-field">Description<textarea class="inv-desc-input">${esc(it.desc || '')}</textarea></label>`}
            <label class="ed-field">Note for this chapter<input type="text" class="inv-note-input" value="${attr(it.note || '')}" placeholder="Optional"></label>
            <label class="ed-field">Bound to<input type="text" class="inv-bound-input" list="boundToNames" value="${attr(it.boundTo || '')}" placeholder="Person or thing it can't leave"></label>
            <div class="ed-acts">${!v.linked && Lib ? `<button type="button" class="ed-chip" data-to-lib="${i}">ADD TO LIBRARY</button>` : ''}<button type="button" class="ed-chip" data-inv-rm="${i}" style="color:#f08a74;border-color:var(--ember)">REMOVE FROM THIS CHAPTER</button></div>
          </div></div>
        <div class="iv-marks"><div class="iv-marks-head">— MARKS ON THIS ITEM —</div><div class="marks-editor">${markRowsHtml('item:' + i, it.marks || [])}</div></div></div>`;
    }
    const f = benchFilter.toLowerCase();
    const shelf = libItems.filter(li => !f || li.name.toLowerCase().includes(f)).map(li => {
      const who = ctx.char ? heldTwice(ctx.char, ctx.snap, li.id) : [];
      const pic = li.icon || li.image;
      return `<button type="button" data-lib-add="${attr(li.id)}"><span class="medal">${pic ? `<img src="${pic}" alt="">` : esc(li.name.charAt(0).toUpperCase())}</span><span class="nm">${esc(li.name)}</span><span class="who">${who.length ? 'HELD BY ' + esc(who.join(', ')) : 'FREE'}</span></button>`;
    }).join('') || `<div class="ed-readout" style="grid-column:1/-1;color:var(--dust)">&gt; No Library items${f ? ' match' : ' yet'}.</div>`;
    wrap.innerHTML = `<div class="ed-cols">
      <div class="ed-side"><div><div class="ed-kicker">Carried · ${items.length} item${items.length === 1 ? '' : 's'}</div><div class="ed-big">Bench</div></div><div class="iv-list">${list}</div></div>
      <div class="ed-main">${monitor}</div>
      <div class="ed-panel"><div class="ed-kicker">Library · add to this chapter</div>
        <label class="ed-field">Search the Library<input type="search" id="ivSearch" value="${attr(benchFilter)}" placeholder="Name"></label>
        <div class="iv-shelf">${shelf}</div>
        <button type="button" class="ed-chip" id="invNewItem" style="min-height:46px;transform:none;border-style:dashed;color:var(--amber)">+ NEW ITEM INTO THE LIBRARY</button>
        <div id="invQuickForm"></div>
        <p style="margin:0;font-size:13px;line-height:1.5;color:var(--dust)">Names, pictures and origin live in the Library. Marks, binding, state and the note belong to this chapter.</p></div></div>
      <datalist id="boundToNames">${state.characters.map(c => `<option value="${attr(c.name || '')}">`).join('')}</datalist>`;
    const on = (sel, ev, fn) => wrap.querySelectorAll(sel).forEach(el => el.addEventListener(ev, () => fn(el)));
    on('[data-bench]', 'click', el => { syncInventoryFromDOM(); benchSel = +el.dataset.bench; renderBench(wrap); });
    on('[data-lib-add]', 'click', el => addLibraryEntry(el.dataset.libAdd));
    on('[data-inv-rm]', 'click', el => removeInventoryItem(+el.dataset.invRm));
    on('[data-inv-img]', 'click', el => triggerInvImageInput(+el.dataset.invImg, 'image'));
    on('[data-to-lib]', 'click', el => moveEntryToLibrary(+el.dataset.toLib));
    const nb = document.getElementById('invNewItem'); if (nb) nb.addEventListener('click', openQuickItemForm);
    const sr = document.getElementById('ivSearch');
    if (sr) sr.addEventListener('input', () => { benchFilter = sr.value; syncInventoryFromDOM(); renderBench(wrap); const s2 = document.getElementById('ivSearch'); if (s2) { s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length); } });
    on('select[data-inv-state]', 'change', sel => {
      syncInventoryFromDOM();
      const e = pendingInventoryItems[+sel.dataset.invState]; if (!e) return;
      const from = e.stateId || ''; e.stateId = sel.value;
      if (sel.value !== from) invStateAsk.add(e.id); else invStateAsk.delete(e.id);
      renderBench(wrap);
    });
    on('[data-state-marks]', 'click', b => {
      syncInventoryFromDOM();
      const [idx, how] = b.dataset.stateMarks.split(':'), e = pendingInventoryItems[+idx]; if (!e) return;
      if (how === 'replace') e.marks = Lib.marksFor(Lib.item(e.itemId), e.stateId);
      invStateAsk.delete(e.id); renderBench(wrap);
    });
  }
  openInventoryOnlyForm = function (char, snap) {
    if (blockIfLocked(snap)) return;
    pendingInventoryItems = (snap.inventory || []).map(it => JSON.parse(JSON.stringify(it)));
    pendingInventoryChar = { char, snap };
    benchSel = 0; benchLen = pendingInventoryItems.length; benchFilter = '';
    modalContent.innerHTML = head('EDIT INVENTORY', subFor(char, snap), 'ivSave', 'Save inventory') +
      `<div id="inventoryEditorWrap" class="inv-editor-wrap bench"></div><input type="file" id="invFileInput" accept="image/*" class="visually-hidden-input">`;
    wireCancel();
    document.getElementById('invFileInput').addEventListener('change', handleInventoryFileInput);
    renderInventoryEditor();
    document.getElementById('ivSave').addEventListener('click', async () => {
      syncInventoryFromDOM();
      snap.inventory = finalizeInventory(pendingInventoryItems);
      await persistState(); renderAll(); closeModal();
    });
    openModal({ wide: true });
  };

  // =====================================================================
  // NEW PROFILE — type first (sigil + command plates), identity, look
  // =====================================================================
  const TYPE_LOOK = {
    primordial: { accent: '#e3b95c', tint: '#241a08', kanji: '原初', line: 'Beyond the scale. Swayed only by their concept.', orbit: 'BEYOND THE SCALE · SWAYED ONLY BY THEIR CONCEPT · NOTHING · FATE · IMAGINATION · REALITY ·' },
    unbound: { accent: '#c9c2b4', tint: '#1a1916', kanji: '解', line: 'A god outside The Binding. Swayed only by their concept.', orbit: 'OUTSIDE THE BINDING · NO ARCHETYPE · NO SCRIPT · OUTSIDE THE BINDING ·' },
    storyborn: { accent: '#ffb238', tint: '#2a1a06', kanji: '物語', line: 'A bound god in a host. The only type with an archetype.', orbit: 'THE BINDING’S SCRIPT · TIER IS DOMAIN · ONE GIFT PER FOLLOWER ·' },
    person: { accent: '#ffd58a', tint: '#1f1406', kanji: '名', line: 'A dormant name. The Voice may wake it; it refines up to tier 7.', orbit: 'A DORMANT NAME · THE VOICE MAY WAKE IT · SEVEN SPOKES · ONE CORE ·' },
    godling: { accent: '#6fb3a3', tint: '#0f2420', kanji: '神子', line: 'Claimed by a plane at birth. Their name becomes the plane’s.', orbit: 'CLAIMED AT BIRTH · SEVEN LEVELS · NO SKILLS · NO GIFTS · NO CUTS ·' },
    voided: { accent: '#9aa6bd', tint: '#10131a', kanji: '虚', line: 'Val’s blessing: Black Hand, then Clear, then Switcher.', orbit: 'VAL’S BLESSING · BLACK HAND · CLEAR · SWITCHER · THEY ARE THE WEAPON ·' },
    fallen: { accent: '#d4452b', tint: '#200a06', kanji: '堕', line: 'No dormant name. Invisible to the Voice. Tech and grafts.', orbit: 'UNWRITTEN · INVISIBLE TO THE VOICE · TECH · GRAFTS · NUMBERS ·' },
    twisted: { accent: '#b98ad6', tint: '#1a1020', kanji: '歪', line: 'One of a kind. No dormant name, no archetype, a corrupted gift tree.', orbit: 'ONE OF A KIND · UNWRITTEN · A CORRUPTED GIFT TREE ·' }
  };
  const PLANE_CARDS = [
    { v: 'Dreams (Moinera)', name: 'Dreams', who: 'MOINERA', icon: '<path d="M20,4 A12,12 0 1,0 20,26 A9,9 0 1,1 20,4 Z" fill="currentColor"></path>' },
    { v: 'Thought (Gorid)', name: 'Thought', who: 'GORID', icon: '<path d="M15 15 m0 -2 a2 2 0 1 1 -2 2 a5 5 0 1 1 5 5 a8 8 0 1 1 -8 -8" fill="none" stroke="currentColor" stroke-width="2"></path>' },
    { v: 'Time (Signalious)', name: 'Time', who: 'SIGNALIOUS', icon: '<path d="M8 4 H22 L15 15 L22 26 H8 L15 15 Z" fill="none" stroke="currentColor" stroke-width="2"></path>' }
  ];
  function sigil(type, lore) {
    const L = TYPE_LOOK[type] || { accent: '#b5904f', orbit: 'CHOOSE A TYPE · IT DECIDES EVERYTHING BELOW · CHOOSE A TYPE ·' };
    const a = L.accent;
    const ring = `<defs><path id="pfOrbit" d="M300,300 m-232,0 a232,232 0 1,1 464,0 a232,232 0 1,1 -464,0"></path></defs>
      <circle cx="300" cy="300" r="268" fill="none" stroke="${a}" stroke-opacity=".12"></circle>
      <circle cx="300" cy="300" r="232" fill="none" stroke="${a}" stroke-opacity=".35"></circle>
      <text font-family="Cinzel, serif" font-weight="700" font-size="15" letter-spacing="6" fill="${a}"><textPath href="#pfOrbit">${esc(L.orbit)}</textPath></text>
      <circle cx="300" cy="300" r="206" fill="none" stroke="${a}" stroke-opacity=".2" stroke-dasharray="2 6"></circle>`;
    let inner = '';
    if (type === 'godling') {
      const lit = (PLANE_CARDS.find(p => p.v === (lore && lore.plane)) || PLANE_CARDS[0]).name;
      const lvl = Array.from({ length: 7 }, (_, k) => { const an = k * 2 * Math.PI / 7; const x = 300 + 206 * Math.sin(an), y = 300 - 206 * Math.cos(an); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${k ? 10 : 12}" fill="${k ? '#080603' : '#bff0e3'}" stroke="${a}"></circle><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-family="Space Mono" font-size="10" fill="${k ? a : '#071512'}">${k + 1}</text>`; }).join('');
      inner = `${lvl}<circle cx="300" cy="300" r="112" fill="#0b201c" stroke="${a}" stroke-width="2"></circle>
        ${lit === 'Dreams' ? '<path d="M345,222 A88,88 0 1,0 345,378 A70,70 0 1,1 345,222 Z" fill="#bff0e3" opacity=".9"></path><path d="M242,306 Q282,278 322,306 M242,306 Q282,328 322,306" fill="none" stroke="#071512" stroke-width="3"></path>'
          : lit === 'Thought' ? '<path d="M300 300 m0 -8 a8 8 0 1 1 -8 8 a24 24 0 1 1 24 24 a46 46 0 1 1 -46 -46 a70 70 0 1 1 70 70" fill="none" stroke="#bff0e3" stroke-width="5"></path>'
          : '<path d="M250 220 H350 L300 300 L350 380 H250 L300 300 Z" fill="none" stroke="#bff0e3" stroke-width="5"></path><path d="M272 236 H328 L300 280 Z M300 330 L330 366 H270 Z" fill="#bff0e3"></path>'}`;
    } else if (type === 'primordial') {
      inner = `<circle cx="300" cy="300" r="120" fill="#1a1306" stroke="${a}" stroke-width="2"></circle>
        ${['N', 'F', 'I', 'R'].map((g, k) => { const an = k * Math.PI / 2; return `<text x="${(300 + 78 * Math.sin(an)).toFixed(0)}" y="${(312 - 78 * Math.cos(an)).toFixed(0)}" text-anchor="middle" font-family="Cinzel, serif" font-weight="700" font-size="34" fill="${a}">${g}</text>`; }).join('')}
        <circle cx="300" cy="300" r="26" fill="${a}"></circle><text x="300" y="108" text-anchor="middle" font-family="Space Mono" font-size="11" letter-spacing="4" fill="${a}">CHAOS ABOVE</text>`;
    } else if (type === 'unbound') {
      inner = `<path d="M300 180 A120 120 0 1 1 216 214" fill="none" stroke="${a}" stroke-width="6"></path>
        <rect x="222" y="168" width="34" height="18" rx="9" fill="none" stroke="${a}" stroke-width="4" transform="rotate(-30 239 177)"></rect>
        <rect x="262" y="158" width="34" height="18" rx="9" fill="none" stroke="${a}" stroke-width="4" transform="rotate(-10 279 167)"></rect>
        <circle cx="300" cy="300" r="34" fill="none" stroke="${a}" stroke-width="2"></circle>`;
    } else if (type === 'storyborn') {
      inner = `<ellipse cx="300" cy="300" rx="150" ry="44" fill="none" stroke="${a}" stroke-width="2" transform="rotate(-18 300 300)"></ellipse>
        <ellipse cx="300" cy="300" rx="130" ry="36" fill="none" stroke="${a}" stroke-opacity=".6" stroke-width="2" transform="rotate(14 300 300)"></ellipse>
        <circle cx="300" cy="300" r="70" fill="#1f1406" stroke="${a}" stroke-width="2"></circle>
        <path d="M300 250 L300 350 M262 278 L338 322 M338 278 L262 322" stroke="${a}" stroke-width="5" stroke-linecap="round"></path>
        <g stroke="${a}" stroke-opacity=".5"><path d="M220 360 q20 30 50 34 M380 360 q-20 30 -50 34 M300 372 v40"></path></g>`;
    } else if (type === 'person') {
      inner = `${Array.from({ length: 7 }, (_, k) => { const an = k * 2 * Math.PI / 7; const x1 = 300 + 96 * Math.sin(an), y1 = 300 - 96 * Math.cos(an), x2 = 300 + 160 * Math.sin(an), y2 = 300 - 160 * Math.cos(an); return `<line x1="${x1.toFixed(0)}" y1="${y1.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}" stroke="${a}" stroke-opacity="${k < 3 ? .8 : .2}"></line><circle cx="${x2.toFixed(0)}" cy="${y2.toFixed(0)}" r="9" fill="${k < 2 ? a : '#080603'}" stroke="${a}" stroke-opacity="${k < 3 ? 1 : .3}"></circle>`; }).join('')}
        <circle cx="300" cy="300" r="86" fill="#0e0a05" stroke="${a}" stroke-width="2"></circle><text x="300" y="332" text-anchor="middle" font-family="Noto Serif JP, serif" font-weight="900" font-size="88" fill="${a}">名</text>`;
    } else if (type === 'voided') {
      inner = `<path d="M262 400 L262 280 Q262 262 276 262 Q290 262 290 280 L290 230 Q290 212 304 212 Q318 212 318 230 L318 222 Q318 204 332 204 Q346 204 346 222 L346 240 Q346 226 360 226 Q374 226 374 244 L374 330 Q374 400 320 420 L290 420 Q262 410 262 400 Z" fill="#05060a" stroke="${a}" stroke-width="2"></path>
        <path d="M228 330 Q238 300 262 300" fill="none" stroke="${a}" stroke-opacity=".5" stroke-width="2"></path>`;
    } else if (type === 'fallen') {
      inner = `<rect x="218" y="190" width="164" height="220" fill="#140806" stroke="${a}" stroke-width="2"></rect>
        <g stroke="${a}" stroke-opacity=".18">${Array.from({ length: 8 }, (_, k) => `<line x1="236" y1="${226 + k * 22}" x2="364" y2="${226 + k * 22}"></line>`).join('')}</g>
        <path d="M352 190 L382 220 L352 220 Z" fill="${a}" fill-opacity=".4"></path>`;
    } else if (type === 'twisted') {
      inner = `<circle cx="300" cy="300" r="118" fill="#140c18" stroke="${a}" stroke-width="2"></circle>
        <path d="M300 182 L284 236 L316 262 L280 310 L322 346 L296 418" fill="none" stroke="${a}" stroke-width="4"></path>
        <circle cx="300" cy="300" r="46" fill="none" stroke="${a}" stroke-opacity=".5"></circle>`;
    } else {
      inner = `<circle cx="300" cy="300" r="110" fill="none" stroke="#8a5a14" stroke-dasharray="3 6"></circle><text x="300" y="312" text-anchor="middle" font-family="VT323" font-size="34" fill="#b5904f">CHOOSE</text>`;
    }
    return `<svg viewBox="0 0 600 600" aria-hidden="true">${ring}${inner}</svg>`;
  }
  const PLATE_POS = [['left', 4, 12], ['left', 7, 27], ['left', 3, 42], ['left', 6, 57], ['right', 4, 12], ['right', 7, 27], ['right', 3, 42], ['right', 6, 57]];
  function canList(d) {
    const t = d.race; if (!t) return { yes: [], no: [] };
    const c = { race: t, lore: d.lore };
    const all = [
      ['Archetype', hasArchetype(c)], ['True name', hasTrueName(c) && t !== 'godling'], ['Plane-name', t === 'godling'],
      [isGodType(c) ? 'Authorities' : 'Skills', canHaveSkills(c)], ['Cuts', canHaveCuts(c)], ['Gifts', canHaveGift(c)],
      ['Concept', isGodType(c) || t === 'storyborn'], ['7 stats', hasStats(c)], ['Grafts', t === 'fallen'], ['Val’s blessing', t === 'voided'], ['Tech', !isGodType(c)]
    ];
    const yes = all.filter(x => x[1]).map(x => x[0]);
    const no = all.filter(x => !x[1] && ['Archetype', 'True name', 'Skills', 'Authorities', 'Cuts', 'Gifts', '7 stats'].includes(x[0])).map(x => x[0]);
    return { yes, no };
  }
  openCharacterForm = function (existingChar) {
    editingCharId = existingChar ? existingChar.id : null;
    const snap = existingChar ? getActiveSnapshot(existingChar) : null;
    pendingPortrait = snap ? snap.portrait : null;
    let step = existingChar && existingChar.race ? 2 : 1;
    let draft = existingChar ? { ...existingChar, lore: normalizeLore(existingChar.lore) } : { race: '', lore: normalizeLore(null), authority: '', faction: '' };
    const locked = snap && isLocked(snap);
    modalContent.innerHTML = head(existingChar ? 'EDIT SUBJECT' : 'NEW SUBJECT', '', null, null, `<span class="pf-steps" id="pfSteps"></span>`) + `
      <select id="fRace" class="pf-hidden" aria-hidden="true" tabindex="-1"><option value=""></option>${RACES.map(r => `<option value="${r.id}">${esc(r.label)}</option>`).join('')}</select>
      <select id="fFaction" class="pf-hidden" aria-hidden="true" tabindex="-1"></select>
      <div class="pf-step" data-step="1"><div class="ed-cols">
        <div class="ed-main pf-stage" id="pfStage"><div class="pf-sigil" id="pfSigil"></div><div class="pf-cmds" id="pfCmds"></div><div class="pf-line" id="pfLine"></div><div class="pf-kanji" id="pfKanji"></div></div>
        <div class="ed-panel" style="max-width:440px">
          <div><div class="ed-kicker" id="pfIdx" style="color:var(--pf-accent)"></div><div class="ed-big" id="pfName"></div><div id="pfHint" style="font-family:Cinzel,serif;font-size:15px;letter-spacing:.06em;color:var(--pf-accent);margin-top:6px"></div></div>
          <div class="pf-can" id="pfCan"></div>
          <div id="pfPlane"></div>
          <div id="fTypeSection" class="ed-type-section"></div>
          <div><div class="ed-kicker" style="margin-bottom:8px">Faction · only what this type can join</div><div class="ed-chips" id="pfFactions"></div></div>
        </div></div></div>
      <div class="pf-step" data-step="2"><div class="pf-identity">
        <div class="wide"><div class="ed-kicker">Identity</div><div class="ed-big" id="pfIdTitle"></div></div>
        <label class="ed-field">Name<input type="text" id="fName" value="${attr(existingChar ? existingChar.name : '')}" placeholder="Character name"></label>
        <label class="ed-field">Chapter range<input type="text" id="fChapterRange" value="${attr(snap ? snap.chapterRange : '')}" placeholder="e.g. CH 1 – CH 5" ${locked ? 'disabled' : ''}></label>
        <label class="ed-field wide">One-line summary<input type="text" id="fBlurb" value="${attr(snap ? snap.blurb : '')}" placeholder="Who they are, in one line" ${locked ? 'disabled' : ''}></label>
        <label class="ed-field wide">Backstory<textarea id="fBackstory" placeholder="A bit more about their past" ${locked ? 'disabled' : ''}>${esc(snap ? snap.backstory || '' : '')}</textarea></label>
        <div class="wide" id="pfArch">${archetypeFieldHtml('f', existingChar || { race: '' }, snap ? snap.archetype : '')}</div>
      </div></div>
      <div class="pf-step" data-step="3"><div style="max-width:980px">
        <div class="ed-kicker">Look</div><div class="ed-big" style="margin-bottom:14px">Look</div>
        ${portraitFieldHtml()}
        <div class="field"><label>Generated portrait and hero art — used whenever no image is uploaded</label>
          <div class="gen-preview"><img id="genPrev" alt="Generated portrait preview" src="${SILHOUETTE_SVG}">
            <div class="gen-rows" style="display:flex;flex-direction:column;gap:10px;min-width:0">
              <div class="gen-row">
                <select id="fFigure" aria-label="Figure"><option value="">Figure: auto</option>${(window.EpitaphPortrait ? EpitaphPortrait.ARCHETYPES : []).map(a => `<option value="${a}" ${existingSnapFor(existingChar).portraitFigure === a ? 'selected' : ''}>${a}</option>`).join('')}</select>
                <select id="fStyle" aria-label="Style"><option value="">Style: auto</option>${(window.EpitaphPortrait ? EpitaphPortrait.STYLES : []).map(a => `<option value="${a}" ${existingSnapFor(existingChar).portraitStyle === a ? 'selected' : ''}>${a}</option>`).join('')}</select>
                <button type="button" class="btn ghost" id="genReroll">↻ Reroll</button></div>
              <div class="gen-row"><select id="fHeroArt" aria-label="Hero art">${heroArtOptionsHtml(existingChar ? existingChar.name : '', existingSnapFor(existingChar).heroArt || '')}</select></div>
              <small class="fig2d-hint" id="heroArtHint" style="color:var(--dust)"></small></div></div></div>
        <div class="field"><label>Muses — reference characters to build from (pick any number)</label>
          <div class="muse-picker" id="musePicker">${loadMuseList().map(m => `<label><input type="checkbox" value="${attr(m.id)}" ${existingChar && (existingChar.museIds || []).includes(m.id) ? 'checked' : ''}> ${esc(m.name)}</label>`).join('') || '<span class="gen-empty-hint">No muses yet — add some on the Muses page.</span>'}</div>
          <div class="muse-guide" id="museGuide"></div></div>
        <div class="field"><label>Vertical glyph (optional, shown beside the portrait; also the forge's centre glyph)</label>
          <input type="text" id="fGlyph" maxlength="6" value="${attr(existingChar ? existingChar.glyph || '' : '')}" placeholder="e.g. 夢母"></div>
      </div></div>
      <div class="modal-actions"><button type="button" class="ed-slant ghost" id="pfBack">◂ Back</button>
        <div class="ed-acts"><button type="button" class="ed-slant primary" id="pfNext">Next ▸</button><button type="button" class="ed-slant primary" id="pfSave">Save profile</button></div></div>`;
    wireCancel();
    const $ = id => document.getElementById(id);
    const typeSel = $('fRace'), facSel = $('fFaction');
    typeSel.value = draft.race || '';
    const readSection = () => { if ($('fTypeSection').innerHTML) { const r = readTypeSection(draft.race, draft); draft = { ...draft, lore: r.lore, authority: r.authority, divineStatus: draft.race === 'primordial' ? (r.split ? 'Split' : '') : draft.divineStatus }; } };
    const renderType = () => {
      const t = draft.race, look = TYPE_LOOK[t] || {}, idx = RACES.findIndex(r => r.id === t);
      const stage = $('pfStage'), modal = modalContent;
      modal.style.setProperty('--pf-accent', look.accent || '#b5904f');
      modal.style.setProperty('--pf-tint', look.tint || '#1a1108');
      $('pfSigil').innerHTML = sigil(t, draft.lore);
      $('pfCmds').innerHTML = RACES.map((r, k) => { const [side, x, y] = PLATE_POS[k]; return `<button type="button" class="ed-plate${r.id === t ? ' on' : ''}" data-type="${r.id}" style="${side}:${x}%;top:${y + (r.id === t ? -1 : 0)}%" aria-pressed="${r.id === t}"><i>${String(k + 1).padStart(2, '0')}</i>${esc(r.label.replace(/ \(.*\)$/, ''))}</button>`; }).join('');
      $('pfLine').textContent = '> ' + (look.line || 'Pick a type. It decides the faction, the archetype or true name, the stats, skills and power.').toUpperCase();
      $('pfKanji').textContent = look.kanji || '種';
      $('pfIdx').textContent = t ? `TYPE ${String(idx + 1).padStart(2, '0')} OF ${String(RACES.length).padStart(2, '0')}` : 'NO TYPE YET';
      $('pfName').textContent = t ? RACES[idx].label.replace(/ \(.*\)$/, '') : 'Choose';
      $('pfHint').textContent = (RACES[idx] || {}).hint || '';
      const cl = canList(draft);
      $('pfCan').innerHTML = t ? `<div class="yes"><div class="ed-kicker" style="color:var(--pf-accent)">✓ Can hold</div><div class="ed-readout">${cl.yes.map(esc).join('<br>')}</div></div><div class="no"><div class="ed-kicker">✕ Locked</div><div class="ed-readout">${cl.no.map(esc).join('<br>') || '—'}</div></div>` : '';
      $('pfPlane').innerHTML = t === 'godling' ? `<div class="ed-kicker" style="margin-bottom:8px">The plane that claimed them</div><div class="pf-cards">${PLANE_CARDS.map(p => `<button type="button" class="${draft.lore.plane === p.v ? 'on' : ''}" data-plane="${attr(p.v)}" aria-pressed="${draft.lore.plane === p.v}"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" style="color:${draft.lore.plane === p.v ? '#bff0e3' : '#b5904f'}">${p.icon}</svg><b>${esc(p.name)}</b><small>${esc(p.who)}</small></button>`).join('')}</div>` : '';
      $('fTypeSection').innerHTML = typeSectionHtml(t, draft).replace(/class="field"/g, 'class="field ed-type-field"');
      if (t === 'godling') { const ps = $('fPlane'); if (ps) ps.closest('.field').classList.add('pf-hidden'); }
      const opts = t ? factionsFor(t) : FACTIONS;
      if (!opts.includes(draft.faction)) draft.faction = t ? opts[0] : (draft.faction || '');
      facSel.innerHTML = (t ? '' : '<option value=""></option>') + opts.map(f => `<option value="${attr(f)}" ${f === draft.faction ? 'selected' : ''}>${esc(f)}</option>`).join('');
      facSel.value = draft.faction;
      $('pfFactions').innerHTML = opts.map(f => `<button type="button" class="ed-chip${f === draft.faction ? ' on' : ''}" data-fac="${attr(f)}" aria-pressed="${f === draft.faction}">${esc(f.toUpperCase())}</button>`).join('') + (opts.includes('Humanity') ? `<div class="ed-kicker" style="width:100%;letter-spacing:.08em;text-transform:none;margin-top:4px">Humanity: not sure where they belong yet.</div>` : '');
      const curArch = readArchetypeField('f');
      $('pfArch').innerHTML = archetypeFieldHtml('f', { race: t }, curArch !== undefined ? curArch : (snap ? snap.archetype : ''));
      wireArchetypeField('f');
      $('pfIdTitle').textContent = t ? RACES[idx].label.replace(/ \(.*\)$/, '') : 'Identity';
      modalContent.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => { readSection(); draft.race = b.dataset.type; typeSel.value = draft.race; typeSel.dispatchEvent(new Event('change')); renderType(); }));
      modalContent.querySelectorAll('[data-plane]').forEach(b => b.addEventListener('click', () => { readSection(); draft.lore.plane = b.dataset.plane; renderType(); }));
      modalContent.querySelectorAll('[data-fac]').forEach(b => b.addEventListener('click', () => { draft.faction = b.dataset.fac; facSel.value = draft.faction; facSel.dispatchEvent(new Event('change')); renderType(); }));
      $('fTypeSection').querySelectorAll('select, input').forEach(el => el.addEventListener('change', () => { readSection(); const cl2 = canList(draft); $('pfCan').innerHTML = `<div class="yes"><div class="ed-kicker" style="color:var(--pf-accent)">✓ Can hold</div><div class="ed-readout">${cl2.yes.map(esc).join('<br>')}</div></div><div class="no"><div class="ed-kicker">✕ Locked</div><div class="ed-readout">${cl2.no.map(esc).join('<br>') || '—'}</div></div>`; }));
      if (t === 'godling') { const ps = $('fPlane'); if (ps) ps.value = draft.lore.plane || ''; }
    };
    const showStep = () => {
      modalContent.querySelectorAll('.pf-step').forEach(s => s.classList.toggle('on', +s.dataset.step === step));
      $('pfSteps').innerHTML = ['Type', 'Identity', 'Look'].map((n, k) => `<span class="${k + 1 === step ? 'on' : ''}">${k + 1} · ${n.toUpperCase()}</span>`).join('');
      $('pfBack').style.visibility = step > 1 ? 'visible' : 'hidden';
      $('pfNext').style.display = step < 3 ? '' : 'none';
    };
    $('pfBack').addEventListener('click', () => { step = Math.max(1, step - 1); showStep(); });
    $('pfNext').addEventListener('click', () => {
      if (step === 1 && !draft.race) { showToast('Pick a type first: it decides everything else.'); return; }
      step = Math.min(3, step + 1); showStep();
    });
    $('pfSave').addEventListener('click', () => {
      if (!draft.race) { step = 1; showStep(); showToast('Pick a type first: it decides everything else.'); return; }
      if (!$('fName').value.trim()) { step = 2; showStep(); showToast('Give them a name.'); $('fName').focus(); return; }
      readSection();
      // reviewCharacterSave reads the type section's inputs; make sure the godling's plane is in its select
      if (draft.race === 'godling' && $('fPlane')) $('fPlane').value = draft.lore.plane || '';
      modalContent.classList.remove('wide');
      reviewCharacterSave();
    });
    renderType();
    showStep();
    wireDropzone();
    wireCharacterExtras(existingChar);
    openModal({ wide: true });
  };

  // =====================================================================
  // Shared bits for the chapter-level editors
  // =====================================================================
  function presencePlates(prefix, presence) {
    return `<select id="${prefix}Presence" class="pf-hidden" aria-hidden="true" tabindex="-1">${PRESENCE.map(p => `<option value="${p}"${presence === p ? ' selected' : ''}>${PRESENCE_LABEL[p]}</option>`).join('')}</select>
      <div class="ed-chips" data-presence-for="${prefix}">${PRESENCE.map(p => `<button type="button" class="ed-chip${presence === p ? ' on' : ''}${p === 'dead' ? ' dead' : ''}" data-presence="${p}" aria-pressed="${presence === p}">${p === 'dead' ? '† ' : p === 'missing' ? '? ' : ''}${esc(PRESENCE_LABEL[p].toUpperCase())}</button>`).join('')}</div>`;
  }
  function wirePresence(prefix) {
    const sel = document.getElementById(prefix + 'Presence');
    modalContent.querySelectorAll(`[data-presence-for="${prefix}"] [data-presence]`).forEach(b => b.addEventListener('click', () => {
      sel.value = b.dataset.presence;
      modalContent.querySelectorAll(`[data-presence-for="${prefix}"] [data-presence]`).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    }));
  }
  function startField(prefix, startChapter) {
    return `<label class="ed-field">Starts at chapter<input type="number" inputmode="numeric" min="1" step="1" id="${prefix}Start" list="chapterNumbers" value="${Number.isInteger(startChapter) ? startChapter : ''}" placeholder="e.g. 6"></label>
      <datalist id="chapterNumbers">${chapterList().map(c => `<option value="${c.number}">${esc(c.title || '')}</option>`).join('')}</datalist>
      <p class="gen-empty-hint" id="${prefix}StartHint" style="margin:4px 0 0"></p>`;
  }
  // a list of one-line entries edited as rows (condition, knowledge)
  function rowList(key, items, ph) {
    return `<div class="rl" data-rl="${key}">${items.map((t, i) => `<div class="rl-row"><span class="rl-n">${String(i + 1).padStart(2, '0')}</span><input type="text" data-rl-item="${key}" value="${attr(t)}" placeholder="${attr(ph)}" aria-label="${attr(ph)} ${i + 1}"><button type="button" class="rl-x" data-rl-x="${key}:${i}" aria-label="Remove">×</button></div>`).join('')}
      <button type="button" class="ed-chip rl-add" data-rl-add="${key}">+ ADD</button></div>`;
  }
  function readRows(key) { return [...modalContent.querySelectorAll(`[data-rl-item="${key}"]`)].map(i => i.value.trim()); }
  function wireRows(key, list, redraw) {
    modalContent.querySelectorAll(`[data-rl-add="${key}"]`).forEach(b => b.addEventListener('click', () => { list.splice(0, list.length, ...readRows(key)); list.push(''); redraw(); const ins = modalContent.querySelectorAll(`[data-rl-item="${key}"]`); if (ins.length) ins[ins.length - 1].focus(); }));
    modalContent.querySelectorAll(`[data-rl-x^="${key}:"]`).forEach(b => b.addEventListener('click', () => { list.splice(0, list.length, ...readRows(key)); list.splice(+b.dataset.rlX.split(':')[1], 1); redraw(); }));
  }

  // =====================================================================
  // CHAPTER — where they are, what they want, how they are
  // =====================================================================
  openChapterStateForm = function (char, snap) {
    if (blockIfLocked(snap)) return;
    const cond = (snap.condition || []).slice();
    let draft = { objective: snap.objective || '', notes: snap.notes || '' };
    const draw = () => {
      const keepLoc = readLocationPicker('cs');
      modalContent.innerHTML = head('EDIT CHAPTER', subFor(char, snap), 'csSave2', 'Save chapter') + `<div class="ed-cols">
        <div class="ed-side"><div><div class="ed-kicker">Page 01 · chapter</div><div class="ed-big">${esc(snap.chapterRange || 'This chapter')}</div><p class="ed-copy">Where they are, what they want, and how they are. Changes only this chapter.</p></div>
          <div class="ed-box">${startField('cs', snap.startChapter)}<div class="ed-field">Presence${presencePlates('cs', snap.presence)}</div></div></div>
        <div class="ed-main" style="display:flex;flex-direction:column;gap:14px">
          <label class="ed-field">Wants — what they want right now<input type="text" id="csObjective2" value="${attr(draft.objective)}" placeholder="e.g. Find the missing relic" style="font-size:18px"></label>
          <div class="ed-field">Where — this chapter's location${locationPickerHtml('cs')}</div>
          <div class="ed-box thin"><div class="ed-kicker">Condition — injuries, physical and mental state</div>${rowList('cond', cond, 'e.g. Broken arm')}</div>
          <label class="ed-field">Notes — what happened, development, standing<textarea id="csNotes2" style="min-height:150px" placeholder="Joined the Iron Guild. Lost Yona's trust.">${esc(draft.notes)}</textarea></label>
        </div>
        <div class="ed-panel">${hasArchetype(char) ? `<div class="ed-box">${archetypeFieldHtml('cs', char, snap.archetype)}</div>` : ''}
          <div class="ed-box thin"><div class="ed-readout">&gt; THIS CHAPTER ONLY<br>&gt; OTHER CHAPTERS KEEP THEIR OWN STATE</div></div></div></div>`;
      wireCancel(); wirePresence('cs'); wireStartHint('cs');
      wireLocationPicker('cs', keepLoc !== undefined ? keepLoc : snap.location);
      wireArchetypeField('cs');
      wireRows('cond', cond, () => { draft = { objective: document.getElementById('csObjective2').value, notes: document.getElementById('csNotes2').value }; draw(); });
      document.getElementById('csSave2').addEventListener('click', async () => {
        snap.objective = document.getElementById('csObjective2').value.trim();
        snap.notes = document.getElementById('csNotes2').value.trim();
        snap.condition = readRows('cond').filter(Boolean);
        const loc = readLocationPicker('cs'); if (loc !== undefined) snap.location = loc;
        const arch = readArchetypeField('cs'); if (arch !== undefined) setArchetype(char, snap, arch);
        snap.startChapter = readStartChapter('cs');
        snap.presence = document.getElementById('csPresence').value;
        await persistState(); renderAll(); closeModal();
      });
    };
    draw(); openModal({ wide: true });
  };

  // =====================================================================
  // MARKS — sigil cards + one mark at a time
  // =====================================================================
  let mkSel = 0, mkLen = 0;
  const KIND_COLOR = { blessing: 'var(--gold)', curse: 'var(--ember)', binding: 'var(--verdigris)' };
  const baseRenderMarks = renderMarksEditor;
  renderMarksEditor = function () {
    const wrap = document.getElementById('marksEditorWrap');
    if (!wrap || !wrap.classList.contains('mk-wide')) return baseRenderMarks();
    const list = pendingMarks;
    if (list.length > mkLen) mkSel = list.length - 1;
    mkLen = list.length; mkSel = Math.max(0, Math.min(mkSel, list.length - 1));
    const cards = list.map((m, i) => `<button type="button" class="mk-card${i === mkSel ? ' on' : ''}" data-mk="${i}" style="--k:${KIND_COLOR[m.kind] || 'var(--gold)'}" aria-pressed="${i === mkSel}">
        <span class="mk-sig">${m.image ? `<img src="${m.image}" alt="">` : esc((m.name || '?').charAt(0).toUpperCase())}</span>
        <span class="mk-txt"><span class="mk-kind">${esc((MARK_KIND_LABEL[m.kind] || m.kind).toUpperCase())}</span><b>${esc(m.name || 'Unnamed mark')}</b><small>${esc(m.source || '')}</small></span></button>`).join('');
    const m = list[mkSel], a = (f) => `data-mark-path="char" data-mark-idx="${mkSel}" data-f="${f}"`;
    const editor = m ? `<div class="mk-editor" style="--k:${KIND_COLOR[m.kind] || 'var(--gold)'}">
        <div class="mk-editor-head"><span>MARK ${String(mkSel + 1).padStart(2, '0')} / ${list.length}</span><span>${esc((MARK_KIND_LABEL[m.kind] || '').toUpperCase())}</span></div>
        <div class="mk-editor-body">
          <div class="mk-top">${EpitaphMarks.sigilPickerHtml(m, `data-sigil-path="char" data-sigil-idx="${mkSel}"`)}
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px">
              <div class="ed-chips">${MARK_KINDS.map(k => `<button type="button" class="ed-chip${m.kind === k ? ' on' : ''}" data-mk-kind="${k}" style="${m.kind === k ? `background:${KIND_COLOR[k]};border-color:${KIND_COLOR[k]}` : ''}">${esc(MARK_KIND_LABEL[k].toUpperCase())}</button>`).join('')}</div>
              <label class="ed-field">Name<input type="text" ${a('name')} value="${attr(m.name)}" placeholder="Name of the mark" style="font-family:'Pirata One',serif;font-size:20px"></label></div></div>
          <label class="ed-field">Source — who or what placed it<input type="text" ${a('source')} value="${attr(m.source)}"></label>
          <label class="ed-field">Effect — what it does<textarea ${a('effect')}>${esc(m.effect)}</textarea></label>
          <div class="pf-identity" style="grid-template-columns:repeat(2,minmax(0,1fr))">
            <label class="ed-field">Cost<input type="text" ${a('cost')} value="${attr(m.cost)}" placeholder="What it takes (text only)"></label>
            <label class="ed-field">Ends<input type="text" ${a('ends')} value="${attr(m.ends)}" placeholder="How it ends"></label></div>
          <div class="ed-acts"><button type="button" class="ed-slant danger" onclick="removeMark('char', ${mkSel})">Remove mark</button></div>
        </div></div>` : `<div class="mk-editor"><div class="iv-empty">&gt; No marks this chapter.<span class="sig-cursor"></span></div></div>`;
    const n = k => list.filter(x => x.kind === k).length;
    wrap.innerHTML = `<div class="ed-cols">
      <div class="ed-side"><div><div class="ed-kicker">Page 02 · marks</div><div class="ed-big">Marks</div><p class="ed-copy">Bindings a higher being places on someone. Costs are text only; nothing is calculated.</p></div>
        <div class="mk-list">${cards}</div><button type="button" class="ed-chip" onclick="addMark('char')" style="min-height:46px;transform:none;border-style:dashed;color:var(--amber)">+ NEW MARK</button></div>
      <div class="ed-main">${editor}</div>
      <div class="ed-panel"><div class="ed-counters"><div class="ed-counter"><b style="color:var(--gold)">${n('blessing')}</b><span>BLESSINGS</span></div><div class="ed-counter"><b style="color:#f08a74">${n('curse')}</b><span>CURSES</span></div><div class="ed-counter"><b style="color:var(--verdigris)">${n('binding')}</b><span>BINDINGS</span></div></div>
        <div class="ed-box thin" style="font-size:13px;line-height:1.55;color:#d9cbb0"><div><b style="color:var(--gold);font-weight:400;font-family:var(--f-crt);font-size:18px">BLESSING</b> — an outside gift that works for them, usually with a debt.</div><div><b style="color:#f08a74;font-weight:400;font-family:var(--f-crt);font-size:18px">CURSE</b> — an outside cost, restriction or compulsion.</div><div><b style="color:var(--verdigris);font-weight:400;font-family:var(--f-crt);font-size:18px">BINDING</b> — tied to a person or thing until a condition is met (Val's blessing on the Voided is one).</div></div></div></div>`;
    wrap.querySelectorAll('[data-mk]').forEach(b => b.addEventListener('click', () => { syncMarksFromDOM(); mkSel = +b.dataset.mk; renderMarksEditor(); }));
    wrap.querySelectorAll('[data-mk-kind]').forEach(b => b.addEventListener('click', () => { syncMarksFromDOM(); if (pendingMarks[mkSel]) pendingMarks[mkSel].kind = b.dataset.mkKind; renderMarksEditor(); }));
  };
  openMarksForm = function (char, snap) {
    if (blockIfLocked(snap)) return;
    pendingMarks = (snap.marks || []).map(m => ({ ...m }));
    mkSel = 0; mkLen = pendingMarks.length;
    modalContent.innerHTML = head('EDIT MARKS', subFor(char, snap), 'mkSave', 'Save marks') + `<div id="marksEditorWrap" class="mk-wide"></div>`;
    wireCancel(); renderMarksEditor();
    document.getElementById('mkSave').addEventListener('click', async () => {
      syncMarksFromDOM(); snap.marks = cleanMarks(pendingMarks);
      await persistState(); renderAll(); closeModal();
    });
    openModal({ wide: true });
  };

  // =====================================================================
  // TIES — one bond per row
  // =====================================================================
  function tieThumb(target, name) {
    const sn = target && getActiveSnapshot(target), pic = sn && (sn.systemPortrait || sn.portrait);
    return `<span class="ti-face">${pic ? `<img src="${pic}" alt="">` : esc((name || '?').trim().charAt(0).toUpperCase() || '?')}</span>`;
  }
  openRelationshipsOnlyForm = function (char, snap) {
    if (blockIfLocked(snap)) return;
    let rows = (snap.relationships || []).map(r => ({ name: relationshipDisplayName(r), relation: r.relation || '', note: r.note || '' }));
    const others = state.characters.filter(c => c.id !== char.id);
    const sync = () => { rows = [...modalContent.querySelectorAll('.ti-row')].map(r => ({ name: r.querySelector('[data-t=name]').value, relation: r.querySelector('[data-t=relation]').value, note: r.querySelector('[data-t=note]').value })); };
    const draw = () => {
      const inferred = inferredRelationships(char).filter(x => !rows.some(r => r.name.trim().toLowerCase() === (x.name || '').toLowerCase()));
      const list = rows.map((r, i) => {
        const target = others.find(c => (c.name || '').trim().toLowerCase() === r.name.trim().toLowerCase());
        return `<div class="ti-row${target ? ' linked' : ''}">${tieThumb(target, r.name)}
          <label class="ed-field">Name${target ? ' · linked file' : ''}<input type="text" data-t="name" value="${attr(r.name)}" list="tieNames" placeholder="Who"></label>
          <label class="ed-field">Relation<input type="text" data-t="relation" value="${attr(r.relation)}" placeholder="e.g. Older sister"></label>
          <label class="ed-field ti-note">Note<input type="text" data-t="note" value="${attr(r.note)}" placeholder="One line"></label>
          <button type="button" class="pw-x" style="position:static" data-ti-x="${i}" aria-label="Remove this tie">×</button></div>`;
      }).join('');
      modalContent.innerHTML = head('EDIT TIES', subFor(char, snap), 'tiSave', 'Save ties') + `<div class="ed-cols">
        <div class="ed-side"><div><div class="ed-kicker">Page 06 · ties</div><div class="ed-big">Bonds</div><p class="ed-copy">A name that matches another file links to it, so a rename never breaks the bond. This chapter only.</p></div>
          <div class="ed-counters" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="ed-counter"><b>${rows.length}</b><span>RECORDED</span></div><div class="ed-counter"><b>${rows.filter(r => others.some(c => (c.name || '').trim().toLowerCase() === r.name.trim().toLowerCase())).length}</b><span>LINKED</span></div></div></div>
        <div class="ed-main" style="display:flex;flex-direction:column;gap:8px">${list || `<div class="iv-empty">&gt; No ties yet.</div>`}
          <button type="button" class="ed-chip" id="tiAdd" style="min-height:46px;transform:none;border-style:dashed;color:var(--amber);align-self:flex-start;padding:0 18px">+ NEW TIE</button></div>
        <div class="ed-panel"><div class="ed-box thin"><div class="ed-kicker">Others list ${esc(char.name || 'them')}</div>
          ${inferred.length ? inferred.map(x => `<div class="ti-inferred">${tieThumb(findCharacterById(x.charId), x.name)}<div style="flex:1;min-width:0"><b style="font-family:'Pirata One',serif;font-weight:400;font-size:19px">${esc(x.name)}</b><div style="font-size:12px;color:var(--dust)">Lists you as: ${esc(x.relation || '—')}</div></div><button type="button" class="ed-chip" data-ti-back="${attr(x.name)}">+ ADD BACK</button></div>`).join('') : `<div class="ed-readout" style="color:var(--dust)">&gt; Nobody else lists them without a tie back.</div>`}</div></div></div>
        <datalist id="tieNames">${others.map(c => `<option value="${attr(c.name || '')}">`).join('')}</datalist>`;
      wireCancel();
      document.getElementById('tiAdd').addEventListener('click', () => { sync(); rows.push({ name: '', relation: '', note: '' }); draw(); const n = modalContent.querySelectorAll('[data-t=name]'); if (n.length) n[n.length - 1].focus(); });
      modalContent.querySelectorAll('[data-ti-x]').forEach(b => b.addEventListener('click', () => { sync(); rows.splice(+b.dataset.tiX, 1); draw(); }));
      modalContent.querySelectorAll('[data-ti-back]').forEach(b => b.addEventListener('click', () => { sync(); rows.push({ name: b.dataset.tiBack, relation: '', note: '' }); draw(); }));
      modalContent.querySelectorAll('[data-t=name]').forEach(el => el.addEventListener('change', () => { sync(); draw(); }));
      document.getElementById('tiSave').addEventListener('click', async () => {
        sync();
        const text = rows.filter(r => r.name.trim()).map(r => [r.name, r.relation, r.note].map(x => x.replace(/\|/g, '/').trim()).join(' | ')).join('\n');
        snap.relationships = parseRelationshipLines(text, char.id);
        await persistState(); renderAll(); closeModal();
      });
    };
    draw(); openModal({ wide: true });
  };

  // =====================================================================
  // ARC — the line through the chapters, and where they're heading
  // =====================================================================
  openArcOnlyForm = function (char, snap) {
    if (blockIfLocked(snap)) return;
    const steps = archetypeTimeline(char);
    const lineName = hasArchetype(char) ? 'Archetype' : typeOf(char) === 'godling' ? 'Plane-name' : hasTrueName(char) ? 'True name' : isGodType(char) ? 'Concept' : 'Line';
    const tape = steps.map((st, i) => `${i ? '<span class="ar-arrow" aria-hidden="true">→</span>' : ''}<div class="ar-step${st.ids.includes(snap.id) ? ' on' : ''}${st.name === 'UNASSIGNED' ? ' unset' : ''}"><b>${esc(st.name)}</b><small>${esc(st.range)}</small>${i && st.from.archetypeReason ? `<em>${esc(st.from.archetypeReason)}</em>` : ''}</div>`).join('');
    const names = (snap.titles || []).slice().sort((a, b) => (a.rankTier || 0) - (b.rankTier || 0));
    modalContent.innerHTML = head('EDIT ARC', subFor(char, snap), 'arSave', 'Save arc') + `
      <div class="ed-box" style="margin-bottom:18px"><div class="ed-kicker">${esc(lineName)} · through every chapter</div><div class="ar-tape">${tape}</div></div>
      <div class="ed-cols"><div class="ed-main" style="display:flex;flex-direction:column;gap:14px">
        ${hasArchetype(char) ? `<div class="ed-box">${archetypeFieldHtml('mwArc', char, snap.archetype)}</div>`
          : hasTrueName(char) ? `<div class="ed-box"><div class="ed-kicker">${esc(lineName)} history — this chapter</div>
            <div class="ar-names">${names.map(t => `<div><span class="ed-chip on" style="transform:none">${esc(ROMAN[(t.rankTier || 1) - 1] || '—')}</span><b>${esc(t.name)}</b><small>${esc(t.blurb || '')}</small></div>`).join('') || `<div class="ed-readout" style="color:var(--dust)">&gt; Not woken yet.</div>`}</div>
            <button type="button" class="ed-chip" id="arNames" style="align-self:flex-start">EDIT THE ${esc(lineName.toUpperCase())} ▸</button></div>`
          : `<div class="ed-box thin ed-readout" style="color:var(--dust)">&gt; ${isGodType(char) ? 'Swayed only by their concept.' : 'Unwritten: no dormant name.'}</div>`}
        <label class="ed-field">Why it changed here (optional, one line)<input type="text" id="mwArcReason" value="${attr(snap.archetypeReason || '')}" placeholder="e.g. Yona's betrayal broke him"></label>
        <label class="ed-field">Heading toward — one line on where they're going<input type="text" id="mwArcHeading" value="${attr(snap.headingToward || '')}" placeholder="e.g. A reckoning with Yona" style="font-size:18px"></label>
      </div>
      <div class="ed-panel"><div class="ed-box thin"><div class="ed-readout">&gt; THE TAPE IS BUILT FROM EVERY CHAPTER<br>&gt; ${steps.length} STEP${steps.length === 1 ? '' : 'S'} SO FAR</div></div></div></div>`;
    wireCancel(); wireArchetypeField('mwArc');
    const nb = document.getElementById('arNames'); if (nb) nb.addEventListener('click', () => openIdentityForm(char, snap));
    document.getElementById('arSave').addEventListener('click', async () => {
      setArchetype(char, snap, readArchetypeField('mwArc'));
      snap.headingToward = document.getElementById('mwArcHeading').value.trim();
      snap.archetypeReason = document.getElementById('mwArcReason').value.trim();
      await persistState(); renderAll(); closeModal();
    });
    openModal({ wide: true });
  };

  // =====================================================================
  // KNOWLEDGE — what they know, and the secrets around them
  // =====================================================================
  openKnowledgeOnlyForm = function (char, snap) {
    if (blockIfLocked(snap)) return;
    const know = (snap.knowledge || []).slice();
    let secrets = (snap.secrets || []).map(s => ({ ...normalizeSecret(s) }));
    const syncSecrets = () => { secrets = [...modalContent.querySelectorAll('.kn-secret')].map(r => ({ text: r.querySelector('[data-s=text]').value, knownBy: r.querySelector('[data-s=knownBy]').value, characterKnows: r.dataset.knows === '1' })); };
    const draw = () => {
      const known = secrets.filter(s => s.characterKnows).length, C2 = 2 * Math.PI * 22;
      modalContent.innerHTML = head('EDIT KNOWLEDGE', subFor(char, snap), 'knSave', 'Save knowledge') + `<div class="ed-cols">
        <div class="ed-main" style="flex-basis:420px"><div class="ed-kicker">Page 08 · known</div><div class="ed-big" style="margin-bottom:12px">Knows</div>${rowList('know', know, 'e.g. Knows the war has begun')}</div>
        <div class="ed-main" style="flex-basis:520px"><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px"><div><div class="ed-kicker">Secrets around them</div><div class="ed-big" style="margin-bottom:12px">Secrets</div></div>
          ${secrets.length ? `<div class="k-gauge" style="display:flex;align-items:center;gap:10px"><svg viewBox="0 0 54 54" width="54" height="54" aria-hidden="true"><circle cx="27" cy="27" r="22" fill="none" stroke="rgba(255,178,56,.25)" stroke-width="4" stroke-dasharray="2 3"></circle><circle cx="27" cy="27" r="22" fill="none" stroke="var(--amber)" stroke-width="4" stroke-dasharray="${(C2 * known / secrets.length).toFixed(1)} ${C2.toFixed(1)}" transform="rotate(-90 27 27)"></circle></svg><span class="ed-readout"><b>${known}/${secrets.length}</b> KNOWN TO THEM</span></div>` : ''}</div>
          <div style="display:flex;flex-direction:column;gap:8px">${secrets.map((s, i) => `<div class="kn-secret" data-knows="${s.characterKnows ? 1 : 0}">
              <label class="ed-field">Secret<input type="text" data-s="text" value="${attr(s.text)}" placeholder="e.g. Caused the destruction of a village"></label>
              <div class="kn-bottom"><div class="ed-chips"><button type="button" class="ed-chip${s.characterKnows ? ' on' : ''}" data-kn-knows="${i}:1">THEY KNOW</button><button type="button" class="ed-chip${s.characterKnows ? '' : ' on'}" data-kn-knows="${i}:0">THEY DON'T</button></div>
                <label class="ed-field" style="flex:1;min-width:160px">Known by<input type="text" data-s="knownBy" value="${attr(s.knownBy)}" placeholder="Who else knows"></label>
                <button type="button" class="pw-x" style="position:static" data-kn-x="${i}" aria-label="Remove this secret">×</button></div></div>`).join('')}
            <button type="button" class="ed-chip" id="knAddSecret" style="min-height:46px;transform:none;border-style:dashed;color:var(--amber);align-self:flex-start;padding:0 18px">+ NEW SECRET</button></div></div></div>`;
      wireCancel();
      wireRows('know', know, () => { syncSecrets(); draw(); });
      document.getElementById('knAddSecret').addEventListener('click', () => { know.splice(0, know.length, ...readRows('know')); syncSecrets(); secrets.push({ text: '', characterKnows: false, knownBy: '' }); draw(); });
      modalContent.querySelectorAll('[data-kn-x]').forEach(b => b.addEventListener('click', () => { know.splice(0, know.length, ...readRows('know')); syncSecrets(); secrets.splice(+b.dataset.knX, 1); draw(); }));
      modalContent.querySelectorAll('[data-kn-knows]').forEach(b => b.addEventListener('click', () => { know.splice(0, know.length, ...readRows('know')); syncSecrets(); const [i, v] = b.dataset.knKnows.split(':'); secrets[+i].characterKnows = v === '1'; draw(); }));
      document.getElementById('knSave').addEventListener('click', async () => {
        syncSecrets();
        snap.knowledge = readRows('know').filter(Boolean);
        snap.secrets = secrets.filter(s => s.text.trim()).map(s => ({ text: s.text.trim(), characterKnows: s.characterKnows, knownBy: s.knownBy.trim() }));
        await persistState(); renderAll(); closeModal();
      });
    };
    draw(); openModal({ wide: true });
  };

  // =====================================================================
  // NEW CHAPTER — a new version of the same character
  // =====================================================================
  openSnapshotForm = function () {
    const char = getActiveCharacter();
    if (!char) return openCharacterForm();
    pendingPortrait = null;
    const prev = getActiveSnapshot(char) || {};
    const carried = [
      ['Where', locationLabelFor(prev.location) || '—'], ['Wants', prev.objective || '—'], ['Ties', (prev.relationships || []).length],
      ['Knows', (prev.knowledge || []).length], ['Secrets', (prev.secrets || []).length], ['Condition', (prev.condition || []).length],
      ['Marks', (prev.marks || []).length], ['Carried items', (prev.inventory || []).length], ['Skills', (prev.skills || []).length],
      [hasTrueName(char) ? 'True names' : 'Titles', (prev.titles || []).length], ['Stats', hasStats(char) ? 'all 7' : 'unrated'], ['Power', prev.power && prev.power.threat ? 'Threat ' + prev.power.threat : 'yes']
    ];
    modalContent.innerHTML = head('NEW CHAPTER', [char.name || 'Unnamed', (RACES.find(r => r.id === char.race) || {}).label || ''].filter(Boolean).join(' · '), 'snSave', 'Save version') + `<div class="ed-cols">
      <div class="ed-main" style="display:flex;flex-direction:column;gap:14px">
        <div><div class="ed-kicker">A new point in the story</div><div class="ed-big">Next<br>chapter</div></div>
        <div class="pf-identity" style="max-width:none">
          <label class="ed-field">Chapter range<input type="text" id="fChapterRange" value="" placeholder="e.g. CH 6 – CH 10" style="font-size:18px"></label>
          <div>${startField('fSnap', suggestNextStart(char))}</div>
          <div class="ed-field wide">Presence${presencePlates('fSnap', prev.presence || 'alive')}</div>
          <label class="ed-field wide">One-line summary — this point in the story<input type="text" id="fBlurb" value="" placeholder="A short line"></label>
          <label class="ed-field wide">Backstory / notes<textarea id="fBackstory" placeholder="What's changed by this point"></textarea></label>
        </div>
        ${portraitFieldHtml()}
      </div>
      <div class="ed-panel"><div class="ed-box"><div class="ed-readout" style="display:flex;justify-content:space-between"><b>CARRIED FORWARD</b><b>FROM ${esc((prev.chapterRange || 'NOW').toUpperCase())}</b></div>
        <div class="sn-carry">${carried.map(([k, v]) => `<div><span>${esc(k.toUpperCase())}</span><b>${esc(String(v))}</b></div>`).join('')}</div>
        <div style="font-size:13px;line-height:1.5;color:var(--dust)">Everything starts as a copy. Edit only what changed; changed sections get a CHANGED marker.</div></div></div></div>`;
    wireCancel(); wirePresence('fSnap'); wireDropzone(); wireStartHint('fSnap');
    const startInp = document.getElementById('fSnapStart');
    let touched = false;
    startInp.addEventListener('input', () => { touched = true; });
    document.getElementById('fChapterRange').addEventListener('input', e => {
      const n = parseStartChapter(e.target.value);
      if (!touched && n) { startInp.value = n; startInp.dispatchEvent(new Event('input')); touched = false; }
    });
    document.getElementById('snSave').addEventListener('click', () => { modalContent.classList.remove('wide'); reviewSnapshotSave(); });
    // "Keep editing" refills the presence select after this opens: mirror it onto the plates
    setTimeout(() => { const sel = document.getElementById('fSnapPresence'); if (sel) modalContent.querySelectorAll('[data-presence-for="fSnap"] [data-presence]').forEach(x => { x.classList.toggle('on', x.dataset.presence === sel.value); x.setAttribute('aria-pressed', x.dataset.presence === sel.value); }); }, 40);
    openModal({ wide: true });
  };


  // =====================================================================
  // IDENTITY — the true name (or titles / plane-name) as a ladder of refinements
  // =====================================================================
  openIdentityForm = function (char, snap) {
    if (blockIfLocked(snap)) return;
    const t = typeOf(char), lineName = t === 'godling' ? 'Plane-name' : hasTrueName(char) ? 'True name' : 'Titles';
    const showConcept = isGodType(char) || hasArchetype(char) || !t;
    let rows = (snap.titles || []).map(x => ({ name: x.name || '', tier: x.rankTier || 0, blurb: x.blurb || '' }));
    let emo = snap.emotionalState || '', concept = char.authority || '';
    const sync = () => {
      rows = [...modalContent.querySelectorAll('.id-row')].map(r => ({ name: r.querySelector('[data-i=name]').value, tier: +r.dataset.tier || 0, blurb: r.querySelector('[data-i=blurb]').value }));
      const e = document.getElementById('idEmo'); if (e) emo = e.value;
      const c = document.getElementById('idConcept'); if (c) concept = c.value;
    };
    const draw = () => {
      const top = rows.reduce((m, r) => Math.max(m, r.tier), 0);
      const order = rows.map((r, i) => ({ r, i })).sort((a, b) => a.r.tier - b.r.tier);
      const need = skillsCapped(char) ? skillCounts(snap.skills || []).branches : 0;
      const list = order.map(({ r, i }) => {
        const cur = r.tier === top && r.tier > 0 && order.filter(x => x.r.tier === top).pop().i === i;
        return `<div class="id-row${cur ? ' cur' : ''}" data-tier="${r.tier}" data-idx="${i}">
          <div class="id-tier">${Array.from({ length: 7 }, (_, n) => `<button type="button" class="ed-pip${n < r.tier ? ' on' : ''}" data-id-tier="${i}:${n + 1}" aria-label="Tier ${n + 1}"></button>`).join('')}<span>${r.tier ? ROMAN[r.tier - 1] : '—'}</span></div>
          <label class="ed-field">${cur ? `Current ${esc(lineName.toLowerCase())}` : 'Name'}<input type="text" data-i="name" value="${attr(r.name)}" placeholder="${t === 'godling' ? 'e.g. Young Dreamling' : 'e.g. Benevolent Thief'}"></label>
          <label class="ed-field">How it was earned<input type="text" data-i="blurb" value="${attr(r.blurb)}" placeholder="One line"></label>
          <button type="button" class="pw-x" style="position:static" data-id-x="${i}" aria-label="Remove">×</button></div>`;
      }).reverse().join('');
      modalContent.innerHTML = head('EDIT IDENTITY', subFor(char, snap), 'idSave', 'Save identity') + `<div class="ed-cols">
        <div class="ed-side"><div><div class="ed-kicker">${esc(lineName)}</div><div class="ed-big">${esc(char.name || 'Unnamed')}</div><div class="bf-line" style="margin-top:6px">${esc(archetypeLabel(snap, char))}</div></div>
          <label class="ed-field">Emotional state (this chapter)<input type="text" id="idEmo" value="${attr(emo)}" placeholder="e.g. Numb, Resolved, Afraid"></label>
          ${showConcept ? `<label class="ed-field">Concept (the character as a whole)<input type="text" id="idConcept" value="${attr(concept)}" placeholder="e.g. Nothing, Reality"></label>` : ''}
          ${skillsCapped(char) ? `<div class="ed-box thin ed-readout">&gt; TIER ${top || 0} OPENS ${top || 0} BRANCH SPOKE${top === 1 ? '' : 'S'}<br>&gt; ${need} BRANCH${need === 1 ? '' : 'ES'} GROWN — THE NAME CAN'T DROP BELOW ${need}</div>` : ''}</div>
        <div class="ed-main" style="display:flex;flex-direction:column;gap:8px">
          <div class="ed-kicker">${esc(lineName)} — each refinement on its own row, newest on top${hasTrueName(char) ? ' · every rewrite is painful' : ''}</div>
          ${list || `<div class="iv-empty">&gt; ${hasTrueName(char) ? 'The dormant name hasn’t woken yet.' : 'No titles yet.'}</div>`}
          <button type="button" class="ed-chip" id="idAdd" style="min-height:46px;transform:none;border-style:dashed;color:var(--amber);align-self:flex-start;padding:0 18px">${hasTrueName(char) ? (top ? `+ REFINE THE NAME (TIER ${Math.min(7, top + 1)})` : '+ THE NAME WAKES (TIER I)') : '+ ADD A TITLE'}</button></div></div>`;
      wireCancel();
      modalContent.querySelectorAll('[data-id-tier]').forEach(b => b.addEventListener('click', () => { sync(); const [i, n] = b.dataset.idTier.split(':').map(Number); rows[i].tier = rows[i].tier === n ? n - 1 : n; draw(); }));
      modalContent.querySelectorAll('[data-id-x]').forEach(b => b.addEventListener('click', () => { sync(); rows.splice(+b.dataset.idX, 1); draw(); }));
      document.getElementById('idAdd').addEventListener('click', () => { sync(); const top2 = rows.reduce((m, r) => Math.max(m, r.tier), 0); rows.push({ name: '', tier: hasTrueName(char) ? Math.min(7, top2 + 1) : 0, blurb: '' }); draw(); const ins = modalContent.querySelectorAll('[data-i=name]'); if (ins.length) ins[0].focus(); });
      document.getElementById('idSave').addEventListener('click', async () => {
        sync();
        const titles = rows.filter(r => r.name.trim()).map(r => ({ name: r.name.trim(), rankTier: Math.max(0, Math.min(7, r.tier)), blurb: r.blurb.trim() }));
        const problem = skillsProblem(char, snap.skills || [], titles);
        if (problem) { showToast('This name tier is too low for the skills they already hold. ' + problem, { duration: 7000 }); return; }
        snap.titles = titles; snap.emotionalState = emo.trim();
        if (showConcept) char.authority = concept.trim();
        await persistState(); renderAll(); closeModal();
      });
    };
    draw(); openModal({ wide: true });
  };

  // =====================================================================
  // SYSTEM SHEET — a hub: every part of this chapter at a glance, one tap to its editor
  // =====================================================================
  let hubReturn = null;
  const baseClose = closeModal;
  closeModal = function () {
    baseClose.apply(this, arguments);
    if (hubReturn && !hubReturn.inHub) { const h = hubReturn; setTimeout(() => { if (hubReturn === h && !modalBackdrop.classList.contains('visible')) openSystemForm(h.char, h.snap); }, 260); }
  };
  openSystemForm = function (char, snap) {
    if (blockIfLocked(snap)) return;
    char = state.characters.find(c => c.id === char.id) || char;
    snap = char.snapshots.find(s => s.id === snap.id) || snap;
    hubReturn = { char, snap, inHub: true };
    const p = snap.power || {}, sc = skillCounts(snap.skills || []), ms = markSummary(snap);
    const tile = (key, title, jp, body, open, ok = true) => ok ? `<button type="button" class="hub-tile" data-hub="${key}"><span class="hub-h"><b>${esc(title)}</b><small lang="ja">${jp}</small></span><span class="hub-b">${body}</span><span class="hub-go">EDIT ▸</span></button>` : '';
    const stat = hasStats(char) ? `<span class="hub-stats">${STAT_SLOTS.map((k, i) => { const v = +(snap.stats || {})[k] || 0; return `<i title="${attr(statNames(char)[i])} ${v}"><em style="height:${v / 7 * 100}%" class="${statDanger(char, snap, k, v) ? 'hot' : ''}"></em></i>`; }).join('')}</span>` : '<span class="hub-dim">Beyond the scale</span>';
    const tiles = [
      tile('identity', 'Identity', '身元', `<span class="hub-big">${esc(archetypeLabel(snap, char))}</span><span class="hub-dim">${esc(snap.emotionalState || 'no emotional state')}</span>`),
      tile('chapter', 'Chapter', '章', `<span class="hub-big">${esc((placeOf2(snap.location)) || 'Unplaced')}</span><span class="hub-dim">${esc(snap.objective || 'wants: not set')}</span>`),
      tile('stats', 'Stats', '能力', stat, true, hasStats(char)),
      tile('skills', isGodType(char) ? 'Authorities' : 'Skills', '技', `<span class="hub-big">${(snap.skills || []).length} skill${(snap.skills || []).length === 1 ? '' : 's'}</span><span class="hub-dim">${skillsCapped(char) ? `${sc.branches}/${nameTier(snap)} branches · depth ${sc.deepest}` : 'the forge'}</span>`, true, canHaveSkills(char)),
      tile('power', 'Power', '力', `<span class="hub-big">${esc(threatLabel(p.threat) || 'Unrated')}</span><span class="hub-dim">${(p.cuts || []).length} Cut${(p.cuts || []).length === 1 ? '' : 's'} · ${parseGifts(p.gift).length} gift${parseGifts(p.gift).length === 1 ? '' : 's'}${p.herald ? ' · Herald' : ''}</span>`),
      tile('inventory', 'Inventory', '荷', `<span class="hub-big">${(snap.inventory || []).length} carried</span><span class="hub-dim">${esc((snap.inventory || []).slice(0, 3).map(i => invView(i).name).join(' · ') || 'nothing')}</span>`),
      tile('marks', 'Marks', '印', `<span class="hub-big">${esc(ms.text || 'Unmarked')}</span>`),
      tile('ties', 'Ties', '絆', `<span class="hub-big">${(snap.relationships || []).length} bond${(snap.relationships || []).length === 1 ? '' : 's'}</span><span class="hub-dim">${esc((snap.relationships || []).slice(0, 3).map(r => relationshipDisplayName(r)).join(' · '))}</span>`),
      tile('arc', 'Arc', '道', `<span class="hub-big">${esc(snap.headingToward || 'heading: not set')}</span>`),
      tile('knowledge', 'Knowledge', '知', `<span class="hub-big">${(snap.knowledge || []).length} known · ${(snap.secrets || []).length} secret${(snap.secrets || []).length === 1 ? '' : 's'}</span>`)
    ].join('');
    modalContent.innerHTML = `<div class="ed-head"><div class="ed-title"><span class="ed-crt">EPITAPH // SYSTEM SHEET</span><span class="ed-sub">${esc(subFor(char, snap))}</span></div>
        <div class="ed-acts"><button type="button" class="ed-slant primary" id="hubDone">Done</button></div></div>
      <div class="ed-kicker" style="margin-bottom:10px">Everything in this chapter version · pick a part to edit it · you come back here after</div>
      <div class="hub-grid">${tiles}</div>`;
    const go = {
      identity: () => openIdentityForm(char, snap), chapter: () => openChapterStateForm(char, snap), stats: () => openStatsOnlyForm(char, snap),
      skills: () => openSkillsOnlyForm(char, snap), power: () => openPowerForm(char, snap), inventory: () => openInventoryOnlyForm(char, snap),
      marks: () => openMarksForm(char, snap), ties: () => openRelationshipsOnlyForm(char, snap), arc: () => openArcOnlyForm(char, snap), knowledge: () => openKnowledgeOnlyForm(char, snap)
    };
    modalContent.querySelectorAll('[data-hub]').forEach(b => b.addEventListener('click', () => { hubReturn = { char, snap, inHub: false }; go[b.dataset.hub](); }));
    document.getElementById('hubDone').addEventListener('click', () => { hubReturn = null; baseClose(); });
    openModal({ wide: true });
  };
  function placeOf2(ref) { const r = ref && window.EpitaphWorld && EpitaphWorld.resolve(ref); return r ? r.name || r.label : ''; }

})();
