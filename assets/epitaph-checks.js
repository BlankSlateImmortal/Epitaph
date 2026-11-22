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
 *   item-state      an inventory entry or a history entry points at a state the Library item no longer has
 *   state-back      on a track marked one-way, an item goes back to an earlier state in a later chapter
 * The item system (docs/plans/item-system.md 2.4):
 *   item-tier       an item's tier is below what the highest rank it can reach needs (rank 4+ transcendent, 7 divine)
 *   history-back    on a track marked one-way, an item's history goes back to an earlier state
 *   curse-stage-back a curse's stage goes down in a later chapter (a curse doesn't recover)
 *   curse-gone      a person's own curse disappears in a later chapter (curses can't be removed)
 *   mark-kind       a blessing on an item, or a binding on a person (information: older data may have them)
 *   curse-stages    a curse with fewer than its three stages written (information)
 *   skill-prospect  a CANON chapter's `skills:` names a skill that is still only a prospect: assign it first (a draft chapter: information)
 *   skill-unknown   a chapter's `skills:` names a skill that no character has and that is not a prospect either (information: a typo?)
 * Site encyclopedia (assets/epitaph-sites.js), added with `placeId` instead of a character:
 *   site-place      an entry, or an alliance in it, points at a place that doesn't exist
 *   site-order      an alliance ends before it starts on the timeline
 *   site-event      a date in an entry points at a timeline event that doesn't exist
 *   site-beast      a beast points at a creature that isn't in the Creature Log (once the log exists)
 *   site-missing    Era 1 places that have no entry yet (information)
 *   bloc-small      a bloc lists fewer than three places;  bloc-dup  a place listed twice in one bloc
 *   whatif-link     a what-if's 'then what?' points at a what-if that doesn't exist;  whatif-loop  what-ifs set each other off in a loop
 * Chekhov's gun, across the encyclopedia (secrets, foreshadowing, evidence, what-if warning signs; nothing is checked until a chapter is set):
 *   gun-loaded      planted in a chapter but no payoff chapter yet, or planted for a what-if that was dropped (information; a warning for a dropped what-if)
 *   gun-unplanted   pays off (a secret, or a what-if written into a chapter) with nothing planted before it (warning)
 *   gun-order       paid off before it is set up, or planted after the payoff (warning)
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

    // item states: a removed state, and going back to an earlier state on a one-way track
    if (Lib) chars.forEach(c => {
      const seen = {};   // itemId:track -> last { idx, name, s }
      ordered(c).forEach(s => (s.inventory || []).forEach(e => {
        const it = e.itemId && Lib.item(e.itemId);
        if (!it) return;
        (it.stateTracks || []).forEach(t => {
          const id = (e.stateIds || {})[t.kind];
          if (!id) return;
          const idx = t.states.findIndex(x => x.id === id), which = t.kind === 'item' ? it.name : `${it.name} (${t.name})`;
          if (idx < 0) { out.push({ level: 'warn', rule: 'item-state', ...at(c, s), itemId: it.id,
            text: `${name(c)}'s ${which} in ${label(s)} is in a state that was removed from the Library item.` }); return; }
          if (!t.oneWay) return;
          const key = it.id + ':' + t.kind, prev = seen[key];
          if (prev && idx < prev.idx) out.push({ level: 'warn', rule: 'state-back', ...at(c, s), itemId: it.id,
            text: `${which} goes back from ${prev.name} (${label(prev.s)}) to ${t.states[idx].name} in ${name(c)}'s ${label(s)}, but that track is one-way.` });
          seen[key] = { idx, name: t.states[idx].name, s };
        });
      }));
    });

    // item origins
    if (Lib && World) Lib.get().items.forEach(i => {
      const pid = Lib.placeIdOf(i);
      if (pid && !World.place(pid))
        out.push({ level: 'warn', rule: 'missing-place', itemId: i.id, text: `Item “${i.name}” comes from a place that no longer exists.` });
    });

    if (Lib) { itemSystemChecks(out, chars, Lib, at); skillProspectChecks(out, chars, Lib); }
    siteChecks(out);
    plantChecks(out);

    return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1));
  }

  // ---- Skills a chapter shows vs skills that are real (plan 6.6) ----
  // A chapter lists the skills it shows in its `skills:` property (chapters/index.json). A skill that exists only as a prospect on the
  // board (opsp) isn't real for the story yet: in a canon chapter that is a warning (assign it to a character first); while a chapter is a
  // draft it's fine (information). A name nobody has, and no prospect either, is most likely a typo.
  function skillProspectChecks(out, chars, Lib) {
    const TL = global.EpitaphTimeline; if (!TL || !TL.chapterSkills) return;
    const mentions = TL.chapterSkills(); if (!mentions.length) return;
    const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const real = new Set(); chars.forEach(c => (c.snapshots || []).forEach(s => (s.skills || []).forEach(k => real.add(norm(k.name)))));
    const prospects = new Map(); (Lib.get().skillDrafts || []).forEach(d => prospects.set(norm(d.name), d));
    const said = new Set();
    mentions.forEach(m => {
      const k = norm(m.skill), key = k + '|' + m.chapter + '|' + m.status; if (!k || said.has(key) || real.has(k)) return; said.add(key);
      if (prospects.has(k)) out.push({ level: m.status === 'canon' ? 'warn' : 'info', rule: 'skill-prospect', chapter: m.chapter,
        text: m.status === 'canon' ? `Chapter ${m.chapter} (canon) shows the skill “${m.skill}”, which is still only a prospect: assign it to a character first (opsp).`
          : `Draft chapter ${m.chapter} mentions the prospect “${m.skill}”. Fine while drafting; assign it before the chapter is canon.` });
      else out.push({ level: 'info', rule: 'skill-unknown', chapter: m.chapter, text: `Chapter ${m.chapter} lists the skill “${m.skill}”, but no character has it and it is not a prospect. A typo?` });
    });
  }

  // ---- The item system: tiers, mark kinds, history states, curse stages ----
  function itemSystemChecks(out, chars, Lib, at) {
    const TL = global.EpitaphTimeline, lc = x => String(x || '').trim().toLowerCase();
    const itemKinds = Lib.markKindsFor('item'), personKinds = Lib.markKindsFor('character');
    const a = { blessing: 'a blessing', curse: 'a curse', binding: 'a binding' };
    const whenText = w => Lib.whenText(w);
    const stagesWritten = m => (m.stages || []).filter(x => x && String(x.text || '').trim()).length;
    const curseInfo = (m, who, extra) => { const n = stagesWritten(m); if (n < 3) out.push({ level: 'info', rule: 'curse-stages', ...extra, text: `${who}: the curse “${m.name || 'unnamed'}” has ${n} of its 3 stages written.` }); };

    Lib.get().items.forEach(it => {
      const me = `Item “${it.name || 'Unnamed'}”`;
      const tp = Lib.tierProblem(it);
      if (tp) out.push({ level: 'warn', rule: 'item-tier', itemId: it.id, text: `${me}: ${tp}` });
      const marks = [...(it.marks || []).map(m => ({ m, where: '' })),
        ...(it.stateTracks || []).flatMap(t => t.states.flatMap(st => (st.marks || []).map(m => ({ m, where: ` in its ${st.name} state` }))))];
      marks.forEach(({ m, where }) => {
        if (!itemKinds.includes(m.kind)) out.push({ level: 'info', rule: 'mark-kind', itemId: it.id,
          text: `${me} has ${a[m.kind] || m.kind}${where}, “${m.name || 'unnamed'}”: items take bindings and curses; blessings are given to people.` });
        if (m.kind === 'curse') curseInfo(m, me, { itemId: it.id });
      });
      // the item's own history, in timeline order: removed states, and going back on a one-way track
      const hist = (it.history || []).map((h, i) => ({ h, i }))
        .sort((x, y) => Lib.compareWhen(x.h.when, y.h.when) || x.i - y.i).map(x => x.h);
      (it.stateTracks || []).forEach(t => {
        let prev = null; const which = t.kind === 'item' ? me : `${me} (${t.name})`;
        hist.forEach(h => {
          const id = (h.stateIds || {})[t.kind]; if (!id) return;
          const idx = t.states.findIndex(x => x.id === id);
          if (idx < 0) { out.push({ level: 'warn', rule: 'item-state', itemId: it.id, text: `${which}: a history entry (${whenText(h.when)}) is in a state that was removed.` }); return; }
          if (t.oneWay && prev && idx < prev.idx) out.push({ level: 'warn', rule: 'history-back', itemId: it.id,
            text: `${which} goes back from ${prev.name} (${whenText(prev.when)}) to ${t.states[idx].name} (${whenText(h.when)}) in its history, but that track is one-way.` });
          prev = { idx, name: t.states[idx].name, when: h.when };
        });
      });
    });

    chars.forEach(c => {
      const nm = (c && c.name) || 'Unnamed', told = new Set(), last = {};
      const isInt = Number.isInteger, label = s => s.chapterRange || (isInt(s.startChapter) ? 'CH ' + s.startChapter : 'an unnumbered version');
      const versions = (c.snapshots || []).filter(s => isInt(s.startChapter)).sort((x, y) => x.startChapter - y.startChapter);
      versions.forEach(s => {
        const present = new Set();
        const look = (scope, m, holderText) => {
          if (!m || !String(m.name || '').trim()) return;
          const key = scope + '|' + lc(m.name);
          // a mark of a kind this holder can't take: said once per character and mark
          const allowed = scope === 'char' ? personKinds : itemKinds;
          if (!allowed.includes(m.kind) && !told.has('k' + key)) { told.add('k' + key); out.push({ level: 'info', rule: 'mark-kind', ...at(c, s),
            text: scope === 'char' ? `${nm} has ${a[m.kind] || m.kind}, “${m.name}” (${label(s)}): bindings go on items; a person takes blessings and curses.`
              : `${nm}'s ${holderText} carries ${a[m.kind] || m.kind}, “${m.name}” (${label(s)}): items take bindings and curses.` }); }
          if (m.kind !== 'curse') return;
          present.add(key);
          const st = isInt(m.stage) ? m.stage : 0, p = last[key];
          if (p && st < p.stage) out.push({ level: 'warn', rule: 'curse-stage-back', ...at(c, s),
            text: `${nm}'s curse “${m.name}” goes back from stage ${p.stage} (${label(p.s)}) to ${st} in ${label(s)}: a curse doesn't recover.` });
          last[key] = { stage: st, s, m, scope };
        };
        (s.marks || []).forEach(m => look('char', m));
        (s.inventory || []).forEach(e => { const it = e.itemId && Lib.item(e.itemId); (e.marks || []).forEach(m => look('item:' + (e.itemId || lc(e.name)), m, it ? it.name : (e.name || 'item'))); });
        // a person's own curse from an earlier chapter that is gone now
        Object.keys(last).forEach(key => { const p = last[key];
          if (p.scope === 'char' && p.s !== s && !present.has(key) && !p.gone) { p.gone = true; out.push({ level: 'warn', rule: 'curse-gone', ...at(c, s),
            text: `${nm}'s curse “${p.m.name}” (since ${label(p.s)}) is gone in ${label(s)}: curses can't be removed.` }); } });
      });
      // stages not written yet: once per curse, from the latest version that has it
      Object.values(last).forEach(p => { if (p.scope === 'char') curseInfo(p.m, nm, at(c, p.s)); });
    });
  }

  // ---- Chekhov's gun: what is planted and never paid off, and what pays off without being planted (plan site-encyclopedia 2.7) ----
  function plantChecks(out) {
    const World = global.EpitaphWorld, Sites = global.EpitaphSites;
    if (!Sites || !Sites.plantPayoff) return;
    const nameOf = id => { const p = World && World.place(id); return p ? p.name.split(/\s+[—–-]\s+/).pop() : id; };
    Sites.plantPayoff(Sites.load(), nameOf).forEach(x => out.push(x));
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
      r.overview.states.forEach(s => need(s.from, 'a state'));
      r.domestic.government.holders.forEach(h => { need(h.from, 'a ruler\'s start'); need(h.to, 'a ruler\'s end'); });
      r.history.founding.forEach(f => need(f.when, 'a founding stage'));
      r.foreign.ties.forEach(a => {
        const other = bare(a.with);
        if (!World.place(other)) out.push({ level: 'warn', rule: 'site-place', ...at, text: `${me} has an alliance with “${other}”, which is not a place on the map.` });
        need(a.from, 'an alliance\'s start'); need(a.to, 'an alliance\'s end');
        const f = evOf(a.from), t = evOf(a.to);
        if (f && t && TL.compare(f, t) > 0) out.push({ level: 'warn', rule: 'site-order', ...at, text: `${me}'s ${a.kind} with ${placeName(other)} ends (${t.title.slice(0, 40)}…) before it starts (${f.title.slice(0, 40)}…).` });
      });
      (r.foreign.blocs || []).forEach(bl => {
        const nm = bl.name || bl.id || 'a bloc', ms = bl.members || [], ids = ms.map(m => bare(m.place));
        if (ids.length < 3) out.push({ level: 'warn', rule: 'bloc-small', ...at, text: `${me}: the bloc “${nm}” has ${ids.length} member${ids.length === 1 ? '' : 's'}; a bloc is a pact of three or more places (use a tie for two).` });
        ids.forEach((id, i) => { if (ids.indexOf(id) !== i) out.push({ level: 'warn', rule: 'bloc-dup', ...at, text: `${me}: ${placeName(id)} is listed twice in the bloc “${nm}”.` }); });
        ms.forEach(m => {
          if (!World.place(bare(m.place))) out.push({ level: 'warn', rule: 'site-place', ...at, text: `${me}: the bloc “${nm}” has a member “${bare(m.place)}”, which is not a place on the map.` });
          need(m.from, 'a bloc member\'s start'); need(m.to, 'a bloc member\'s departure');
          const f = evOf(m.from), t = evOf(m.to);
          if (f && t && TL.compare(f, t) > 0) out.push({ level: 'warn', rule: 'site-order', ...at, text: `${me}: ${placeName(bare(m.place))} leaves the bloc “${nm}” before it joins.` });
        });
      });
      if (Cr && typeof Cr.byId === 'function') r.beasts.forEach(b => {
        const id = String(b.ref || '').replace(/^creature:/, '');
        if (!Cr.byId(id)) out.push({ level: 'warn', rule: 'site-beast', ...at, text: `${me} lists a beast (“${id}”) that is not in the Creature Log.` });
      });
      r.economy.resources.forEach(x => { if (x.source && /^place:/.test(x.source) && !World.place(bare(x.source))) out.push({ level: 'warn', rule: 'site-place', ...at, text: `${me}: the resource “${x.name}” comes from “${bare(x.source)}”, which is not a place on the map.` }); });
    });
    const have = new Set(recs.map(r => r.placeId));
    // what-ifs: a 'then what?' link to a what-if that doesn't exist, and loops (A sets off B sets off A)
    if (Sites.whatIfList) {
      const items = Sites.whatIfList(recs), title = k => { const w = items.find(x => x.key === k); return w ? '“' + String(w.trigger || w.id).slice(0, 50) + '”' : k; };
      Sites.whatIfLinks(items).missing.forEach(m => out.push({ level: 'warn', rule: 'whatif-link', placeId: m.from.replace(/^scenario:([^/]+)\/.*$/, '$1'), text: `The what-if ${title(m.from)} says it sets off “${m.to}”, which is not a what-if.` }));
      Sites.whatIfLoops(items).forEach(l => out.push({ level: 'warn', rule: 'whatif-loop', placeId: l[0].replace(/^scenario:([^/]+)\/.*$/, '$1'), text: `What-ifs set each other off in a loop: ${l.map(title).join(' → ')} → back to the first.` }));
    }
    const missing = World.places().filter(p => (p.eras || []).includes('ERA_1') && !have.has(p.id));
    if (missing.length) out.push({ level: 'info', rule: 'site-missing', text: `${missing.length} Era 1 place${missing.length === 1 ? ' has' : 's have'} no encyclopedia entry yet: ${missing.slice(0, 8).map(p => p.name).join(', ')}${missing.length > 8 ? '…' : ''}.` });
  }
  // the chapter index (chapters/index.json) must be loaded for the skills check; this starts it once and is harmless if it can't be fetched
  try { if (global.EpitaphTimeline && global.EpitaphTimeline.loadChapterIndex) global.EpitaphTimeline.loadChapterIndex(); } catch (e) { /* no chapter index here */ }
  global.EpitaphChecks = { run };
})(typeof window !== 'undefined' ? window : globalThis);
