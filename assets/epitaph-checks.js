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
 *   divine          a divine (locked) character's archetype differs between chapters
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
      // divine archetype
      if (c.divineStatus || c.primordial) {
        const seen = new Map();
        snaps.forEach(s => { const a = s.archetype || 'UNASSIGNED'; if (!seen.has(a)) seen.set(a, s); });
        if (seen.size > 1) out.push({ level: 'warn', rule: 'divine', ...at(c, snaps[0]),
          text: `${name(c)} is divine but has different archetypes: ${[...seen].map(([a, s]) => `${a} (${label(s)})`).join(', ')}.` });
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

    // item origins
    if (Lib && World) Lib.get().items.forEach(i => {
      if (i.originPlaceId && !World.place(i.originPlaceId))
        out.push({ level: 'warn', rule: 'missing-place', itemId: i.id, text: `Item “${i.name}” comes from a place that no longer exists.` });
    });

    return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1));
  }
  global.EpitaphChecks = { run };
})(typeof window !== 'undefined' ? window : globalThis);
