/* Epitaph — continuity checks, shared by the Atlas and the Dossier.
 * Reports only; nothing is fixed automatically.
 *
 *   EpitaphChecks.run(dossierState) -> [{ level: 'warn'|'info', rule, text,
 *                                         charId?, snapId?, chapter?, itemId? }]
 *
 * Rules:
 *   dead-alive      a character marked dead has a later version that is not dead
 *   held-twice      an item is held by two characters in the same chapter
 *   no-location     a chapter version has no location
 *   start-chapter   a version's start chapter is missing or not in the chapter list
 *   missing-place   a location or an item's origin points at a place that no longer exists
 *   one-sided       a relationship is set from one side only (information)
 *   progression     saved data breaks the type rules (faction, skills, Cuts, branch cap)
 *   item-state      an inventory entry points at a state the Library item no longer has
 *   state-back      an item goes back to an earlier state in a character's later chapter
 *                   (a warning only: going back can be deliberate)
 * Site encyclopedia (assets/epitaph-sites.js), added with `placeId` instead of a character:
 *   site-place      an entry, or an alliance in it, points at a place that doesn't exist
 *   site-order      an alliance ends before it starts on the timeline
 *   site-event      a date in an entry points at a timeline event that doesn't exist
 *   site-beast      a beast points at a creature that isn't in the Creature Log (once the log exists)
 *   site-missing    Era 1 places that have no entry yet (information)
 * Needs assets/epitaph-world.js; uses assets/epitaph-library.js when loaded.
 */
(function (global) {
  'use strict';
  const isInt = Number.isInteger;
  const name = c => (c && c.name) || 'Unnamed';
  const label = s => s.chapterRange || (isInt(s.startChapter) ? 'CH ' + s.startChapter : 'an unnumbered version');
  const ordered = c => (c.snapshots || []).filter(s => isInt(s.startChapter)).sort((a, b) => a.startChapter - b.startChapter);
  function span(c, s) {
    if (!isInt(s.startChapter)) return null;
    const later = (c.snapshots || []).map(x => x.startChapter).filter(n => isInt(n) && n > s.startChapter);
    return [s.startChapter, later.length ? Math.min(...later) - 1 : Infinity];
  }
  const spanText = (a, b) => b === Infinity ? `CH ${a} onward` : (a === b ? `CH ${a}` : `CH ${a}–${b}`);

  function run(st) {
    const World = global.EpitaphWorld, Lib = global.EpitaphLibrary;
    const chars = (st && Array.isArray(st.characters)) ? st.characters : [];
    const chapterNums = new Set(((st && st.chapters) || []).map(c => c.number));
    const out = [];
    const at = (c, s) => ({ charId: c.id, snapId: s.id, chapter: isInt(s.startChapter) ? s.startChapter : null });

    chars.forEach(c => {
      const snaps = c.snapshots || [];
      // dead, then alive again
      const vs = ordered(c), death = vs.find(s => s.presence === 'dead');
      if (death) vs.filter(s => s.startChapter > death.startChapter && s.presence !== 'dead').forEach(s => out.push({
        level: 'warn', rule: 'dead-alive', ...at(c, s),
        text: `${name(c)} is marked dead from CH ${death.startChapter}, but is ${s.presence === 'missing' ? 'missing' : 'alive'} again in ${label(s)}.` }));
      snaps.forEach(s => {
        // start chapter
        if (!isInt(s.startChapter)) out.push({ level: 'warn', rule: 'start-chapter', ...at(c, s), text: `${name(c)}'s version “${label(s)}” has no start chapter.` });
        else if (!chapterNums.has(s.startChapter)) out.push({ level: 'warn', rule: 'start-chapter', ...at(c, s), text: `${name(c)}'s version ${label(s)} starts at CH ${s.startChapter}, which is not in the chapter list.` });
        // location
        const loc = s.location;
        if (!loc) out.push({ level: 'warn', rule: 'no-location', ...at(c, s), text: `${name(c)} has no location in ${label(s)}.` });
        else if (World) {
          const pid = loc.placeId || loc.specialSiteId || loc.cityId;
          if ((pid && !World.place(pid)) || (!pid && loc.countryId && !World.country(loc.countryId)))
            out.push({ level: 'warn', rule: 'missing-place', ...at(c, s), text: `${name(c)}'s location in ${label(s)} points at a place that no longer exists.` });
        }
      });
      // progression (the type rules, vault Power Systems): flags saved data from before the locks
      const t = c.race || '';
      if (t) {
        const lore = c.lore || {};
        const named = t === 'person' || t === 'godling' || (t === 'voided' && lore.origin !== 'hollow' && lore.origin !== 'fallen') || (t === 'storyborn' && lore.hostBond !== 'possession');
        const allowed = { primordial: ['Unaffiliated'], unbound: ['Unaffiliated', 'Voided'], storyborn: ['Storyborn'], person: ['Storyborn', 'Voided', 'The Fallen', 'Humanity', 'Unaffiliated'], godling: ['Storyborn', 'Voided', 'The Fallen', 'Humanity', 'Unaffiliated'], voided: ['Voided'], fallen: ['The Fallen', 'Voided'] }[t];
        if (allowed && c.faction && !allowed.includes(c.faction))
          out.push({ level: 'warn', rule: 'progression', ...at(c, snaps[0]), text: `${name(c)}'s faction (${c.faction}) isn't open to their type. Allowed: ${allowed.join(', ')}.` });
        snaps.forEach(s => {
          const skills = s.skills || [], cuts = ((s.power || {}).cuts) || [];
          if (skills.length && (t === 'godling' || t === 'fallen' || ((t === 'voided' || t === 'storyborn') && !named)))
            out.push({ level: 'warn', rule: 'progression', ...at(c, s), text: `${name(c)} holds skills in ${label(s)}, but their type can't.` });
          if (cuts.length && (t === 'godling' || t === 'fallen' || t === 'primordial' || t === 'unbound' || (t === 'voided' && !named)))
            out.push({ level: 'warn', rule: 'progression', ...at(c, s), text: `${name(c)} has a Cut in ${label(s)}, but their type can't make one.` });
          if ((t === 'person' || (t === 'voided' && named)) && skills.length) {
            const tier = Math.max(0, ...(s.titles || []).map(x => x.rankTier || 0));
            const depth = (sk, seen = new Set()) => { if (!sk.parent || seen.has(sk.name)) return 0; seen.add(sk.name); const p = skills.find(x => x.name === sk.parent); return p ? 1 + depth(p, seen) : 0; };
            const branches = skills.filter(sk => depth(sk) === 1).length;
            if (branches > tier) out.push({ level: 'warn', rule: 'progression', ...at(c, s), text: `${name(c)} has ${branches} branches in ${label(s)}, but true name tier ${tier} allows ${tier}.` });
          }
        });
      }
      // lore checks (2026-11-16): gifts, Heralds, ties to the dead, Threat vs stats
      if (t || snaps.some(s => s.power)) {
        const byName = n => chars.find(o => (o.name || '').trim().toLowerCase() === String(n || '').trim().toLowerCase());
        const start = s => Number.isInteger(s.startChapter) ? s.startChapter : 0;
        const vAt = (o, n) => { const v = (o.snapshots || []).filter(s => start(s) <= n).sort((a, b) => start(a) - start(b)); return v[v.length - 1] || null; };
        snaps.forEach(s => {
          const p = s.power || {};
          String(p.gift || '').split('\n').map(l => l.split('|')[0].trim()).filter(Boolean).forEach(from => {
            const g = byName(from);
            if (!g) out.push({ level: 'info', rule: 'lore', ...at(c, s), text: `${name(c)}'s gift in ${label(s)} comes from ${from}, who has no file yet.` });
            else if (g.race && g.race !== 'storyborn') out.push({ level: 'warn', rule: 'lore', ...at(c, s), text: `${name(c)}'s gift in ${label(s)} comes from ${from}, who isn't a Storyborn.` });
          });
          if (p.herald) {
            const h = byName(p.herald);
            if (h && c.race !== 'storyborn' && h.race && h.race !== 'storyborn') out.push({ level: 'warn', rule: 'lore', ...at(c, s), text: `${name(c)} is Herald of ${p.herald} in ${label(s)}, but ${p.herald} isn't a Storyborn.` });
            const hv = h && vAt(h, start(s));
            if (hv && hv.presence === 'dead') out.push({ level: 'warn', rule: 'lore', ...at(c, s), text: `${name(c)}'s Herald link to ${p.herald} in ${label(s)}: ${p.herald} is dead by then.` });
          }
          (s.relationships || []).forEach(r => {
            const o = r.charId && chars.find(x => x.id === r.charId), ov = o && vAt(o, start(s));
            if (ov && ov.presence === 'dead' && !/dead|late|former|mourn|lost/i.test(r.relation || '')) out.push({ level: 'info', rule: 'lore', ...at(c, s), text: `${name(c)} lists ${o.name} in ${label(s)}, but ${o.name} is dead by then.` });
          });
          if (p.threat && (c.race === 'primordial' || c.race === 'unbound') && typeof godThreatCap === 'function' && THREAT_ORDER.indexOf(p.threat) > THREAT_ORDER.indexOf(godThreatCap(c))) out.push({ level: 'warn', rule: 'lore', ...at(c, s), text: `${name(c)} is set to ${threatLabel(p.threat)}, past what ${c.race === 'primordial' ? 'a Primordial' : 'a true god'} reaches (${threatLabel(godThreatCap(c))}).` });
          if (p.threat && !GOD_THREATS.includes(p.threat) && c.race !== 'primordial' && c.race !== 'unbound' && typeof statRank === 'function') {
            const rank = statRank(s), need = rankForThreat(p.threat);
            if (need > rank) out.push({ level: 'warn', rule: 'lore', ...at(c, s), text: `${name(c)} is Threat ${p.threat === '5.5' ? '5½' : p.threat} in ${label(s)}, but their highest stat is ${rank}. That reach needs rank ${need}.` });
          }
        });
      }
      // one-sided relationships (information)
      const listed = new Map();
      snaps.forEach(s => (s.relationships || []).forEach(r => { if (r.charId && r.charId !== c.id && !listed.has(r.charId)) listed.set(r.charId, { s, r }); }));
      listed.forEach(({ s, r }, otherId) => {
        const other = chars.find(x => x.id === otherId);
        if (!other) return;
        const back = (other.snapshots || []).some(x => (x.relationships || []).some(rr => rr.charId === c.id));
        if (!back) out.push({ level: 'info', rule: 'one-sided', ...at(c, s),
          text: `${name(c)} lists ${name(other)}${r.relation ? ' (' + r.relation + ')' : ''}, but ${name(other)} never lists ${name(c)}.` });
      });
    });

    // items held twice in the same chapter
    const holders = {};
    chars.forEach(c => (c.snapshots || []).forEach(s => (s.inventory || []).forEach(e => {
      if (!e.itemId) return;
      const sp = span(c, s);
      if (sp) (holders[e.itemId] = holders[e.itemId] || []).push({ c, s, sp });
    })));
    Object.keys(holders).forEach(itemId => {
      const list = holders[itemId], done = new Set();
      const itemName = (Lib && Lib.item(itemId) || {}).name || 'An item';
      list.forEach(a => list.forEach(b => {
        if (a.c.id >= b.c.id) return;
        const lo = Math.max(a.sp[0], b.sp[0]), hi = Math.min(a.sp[1], b.sp[1]);
        const key = a.c.id + '|' + b.c.id;
        if (lo > hi || done.has(key)) return;
        done.add(key);
        out.push({ level: 'warn', rule: 'held-twice', ...at(a.c, a.s), itemId,
          text: `${itemName} is held by ${name(a.c)} and ${name(b.c)} in ${spanText(lo, hi)}.` });
      }));
    });

    // item states: removed states, and going back to an earlier state
    if (Lib) chars.forEach(c => {
      const seen = {};   // itemId -> last { idx, name, s }
      ordered(c).forEach(s => (s.inventory || []).forEach(e => {
        const it = e.itemId && Lib.item(e.itemId);
        if (!it || !e.stateId || !(it.states || []).length) return;
        const idx = it.states.findIndex(x => x.id === e.stateId);
        if (idx < 0) { out.push({ level: 'warn', rule: 'item-state', ...at(c, s), itemId: it.id,
          text: `${name(c)}'s ${it.name} in ${label(s)} is in a state that was removed from the Library item.` }); return; }
        const prev = seen[it.id];
        if (prev && idx < prev.idx) out.push({ level: 'warn', rule: 'state-back', ...at(c, s), itemId: it.id,
          text: `${it.name} goes back from ${prev.name} (${label(prev.s)}) to ${it.states[idx].name} in ${name(c)}'s ${label(s)}.` });
        seen[it.id] = { idx, name: it.states[idx].name, s };
      }));
    });

    // item origins
    if (Lib && World) Lib.get().items.forEach(i => {
      if (i.originPlaceId && !World.place(i.originPlaceId))
        out.push({ level: 'warn', rule: 'missing-place', itemId: i.id, text: `Item “${i.name}” comes from a place that no longer exists.` });
    });

    siteChecks(out);

    return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1));
  }

  // ---- Site Encyclopedia: places, alliances and their dates ----
  function siteChecks(out) {
    const World = global.EpitaphWorld, Sites = global.EpitaphSites, TL = global.EpitaphTimeline, Cr = global.EpitaphCreatures;
    if (!World || !Sites) return;
    const recs = Sites.load(), placeName = id => { const p = World.place(id); return p ? p.name : id; };
    const evOf = id => id == null ? null : (TL ? TL.byId(id) : null);
    const bare = ref => String(ref || '').replace(/^place:/, '');
    recs.forEach(r => {
      const me = placeName(r.placeId), at = { placeId: r.placeId };
      if (!World.place(r.placeId)) out.push({ level: 'warn', rule: 'site-place', ...at, text: `An encyclopedia entry is for “${r.placeId}”, which is not a place on the map.` });
      const need = (id, where) => { if (id != null && TL && !TL.byId(id)) out.push({ level: 'warn', rule: 'site-event', ...at, text: `${me}: ${where} points at “${id}”, which is not on the timeline.` }); };
      r.states.forEach(s => need(s.from, 'a state'));
      r.rule.holders.forEach(h => { need(h.from, 'a ruler\'s start'); need(h.to, 'a ruler\'s end'); });
      r.founding.forEach(f => need(f.when, 'a founding stage'));
      r.alliances.forEach(a => {
        const other = bare(a.with);
        if (!World.place(other)) out.push({ level: 'warn', rule: 'site-place', ...at, text: `${me} has an alliance with “${other}”, which is not a place on the map.` });
        need(a.from, 'an alliance\'s start'); need(a.to, 'an alliance\'s end');
        const f = evOf(a.from), t = evOf(a.to);
        if (f && t && TL.compare(f, t) > 0) out.push({ level: 'warn', rule: 'site-order', ...at, text: `${me}'s ${a.kind} with ${placeName(other)} ends (${t.title.slice(0, 40)}…) before it starts (${f.title.slice(0, 40)}…).` });
      });
      if (Cr && typeof Cr.byId === 'function') r.beasts.forEach(b => {
        const id = String(b.ref || '').replace(/^creature:/, '');
        if (!Cr.byId(id)) out.push({ level: 'warn', rule: 'site-beast', ...at, text: `${me} lists a beast (“${id}”) that is not in the Creature Log.` });
      });
      r.resources.forEach(x => { if (x.source && /^place:/.test(x.source) && !World.place(bare(x.source))) out.push({ level: 'warn', rule: 'site-place', ...at, text: `${me}: the resource “${x.name}” comes from “${bare(x.source)}”, which is not a place on the map.` }); });
    });
    const have = new Set(recs.map(r => r.placeId));
    const missing = World.places().filter(p => (p.eras || []).includes('ERA_1') && !have.has(p.id));
    if (missing.length) out.push({ level: 'info', rule: 'site-missing', text: `${missing.length} Era 1 place${missing.length === 1 ? ' has' : 's have'} no encyclopedia entry yet: ${missing.slice(0, 8).map(p => p.name).join(', ')}${missing.length > 8 ? '…' : ''}.` });
  }
  global.EpitaphChecks = { run };
})(typeof window !== 'undefined' ? window : globalThis);
