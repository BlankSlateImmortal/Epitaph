/* Epitaph — Publish: builds the read-only snapshot readers load (docs/plans/publish-readonly.md, step 2.1).
 *
 *   EpitaphPublish.build({ state, library, publishedThrough, chapterIndex, timeline, sites, now }) -> { data, report }
 *   EpitaphPublish.toScript(data)  -> the text of published/epitaph-data.js  (window.EPITAPH_PUBLISHED = {...};)
 *   EpitaphPublish.throughFrom(chapterIndex) -> the highest published chapter number, or null
 *
 * It is an ALLOWLIST: only the fields named below are copied, so a field added to the Dossier later stays private until it is listed.
 * Everything is cut at `publishedThrough` (the highest chapter in chapters/index.json), not at the Dossier's newest chapter, and
 * "the latest chapter" never reveals a secret early (EpitaphTimeline.setLatestOverride). With publishedThrough = null (nothing published)
 * the snapshot is empty: the "coming soon" site.
 *
 * The author's rule (2026-11-18): a reader sees a thing only from the chapter that reveals it, and a thing is revealed only by a
 * published chapter that lists it in its properties (chapters/index.json): `characters:` introduces a character (if no chapter lists
 * characters yet, a character's first chapter version counts instead), `moments:` dates timeline moments, `world:` names places,
 * `reveals:` names items and marks. Anything flagged `open` is known from page 1. Everything else is held back.
 *
 * A character's `race` (their type: twisted, godling, voided...) is held back too, until a published chapter lists it in `reveals:` as the
 * race alone ("Twisted"), "Orin: Twisted" or "Orin race". The plain default type, `person`, is never held. The Dossier builds its status
 * line, type label and tags from the race, so a reader sees none of them until then.
 *
 * What is dropped, on purpose (open questions for the author are in the plan's tweak log):
 *   characters: secrets, notes, backstory, knowledge, lore, objective, headingToward, archetype(+Reason), copiedFrom, locked, legacy*, museIds
 *   marks: source, effect, cost, ends (they carry plot) · power: everything but threat and name · skills: the corrupted flag
 *   relationships: notes, and any tie to someone who isn't a published character · inventory: notes, boundTo
 *   text: any line that names a place or character readers haven't reached ("scrub")
 * After building, the whole snapshot is searched for those hidden names (report.leaks); the author sees any hit before downloading.
 */
(function (global) {
  'use strict';
  const SCHEMA = 1;
  const TL = () => global.EpitaphTimeline, SITES = () => global.EpitaphSites, WORLD = () => global.EpitaphWorld;

  const CHAR_FIELDS = ['id', 'name', 'faction', 'glyph', 'portraitFigure', 'portraitStyle', 'portraitSeed', 'corruptionColor'];
  const VERSION_FIELDS = ['id', 'startChapter', 'chapterRange', 'presence', 'emotionalState', 'portrait', 'portraitPosition', 'systemPortrait', 'systemPortraitPosition', 'figure2d', 'heroArt'];
  const PLAIN_RACES = ['person'];                              // never held: the default type says nothing
  const DISTINCT_RACES = ['twisted', 'godling', 'primordial', 'unbound'];   // words that would give a race away if they appeared in text
  const STAT_KEYS = ['body', 'will', 'reserve', 'control', 'weight', 'renown', 'insight'];   // the 7 stats
  const LOCATION_FIELDS = ['countryId', 'placeId', 'status', 'lat', 'lng', 'toPlaceId', 'u', 'v'];
  const clone = o => JSON.parse(JSON.stringify(o));
  const pick = (o, keys) => { const out = {}; keys.forEach(k => { if (o && o[k] !== undefined) out[k] = o[k]; }); return out; };
  const isInt = Number.isInteger;
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /** The highest published chapter in chapters/index.json (an array of { chapter, ... }), or null when there is none. */
  function throughFrom(index) {
    const nums = (Array.isArray(index) ? index : []).map(c => Number(c && c.chapter)).filter(isInt);
    return nums.length ? Math.max(...nums) : null;
  }

  function emptyData(now, through) {
    return { schemaVersion: SCHEMA, publishedThrough: through, builtAt: now,
      dossier: { characters: [], chapters: [] }, library: { places: [], items: [] }, timeline: [], sites: [] };
  }

  function build(opts) {
    const o = opts || {}, T = TL(), S = SITES(), W = WORLD();
    if (!T || !S) throw new Error('EpitaphTimeline and EpitaphSites must be loaded');
    const N = isInt(o.publishedThrough) ? o.publishedThrough : null;
    const now = o.now || new Date().toISOString();
    const state = o.state || { characters: [], chapters: [] }, lib = o.library || { countries: [], places: [], items: [] };
    const report = { publishedThrough: N, counts: {}, held: {}, leaks: [] };
    if (N == null) { const d = emptyData(now, null); report.counts = { characters: 0, chapters: 0, items: 0, places: 0, events: 0, sites: 0 }; return { data: d, report }; }

    if (o.chapterIndex) T.applyChapterIndex(o.chapterIndex);
    T.setLatestOverride(N + 1);            // a reader of the published site is never "at the latest chapter" for the author's secrets
    try {
      const recs = (o.sites || S.load()).map(S.normalise);
      const events = o.timeline || T.load();

      // ---- characters (a version counts only if it starts at or before N) ----
      const allChars = (state.characters || []).filter(c => c && typeof c === 'object');
      const pubVersions = c => (c.snapshots || []).filter(s => s && isInt(s.startChapter) && s.startChapter <= N).sort((a, b) => a.startChapter - b.startChapter);
      const introOf = c => {
        if (T.hasCharacterLists()) return T.firstChapter('character', [c.name, c.id]);
        const starts = (c.snapshots || []).map(s => s && s.startChapter).filter(isInt);
        return starts.length ? Math.min(...starts) : null;
      };
      const isPublished = c => { const i = introOf(c); return i != null && i <= N && pubVersions(c).length > 0; };
      const published = allChars.filter(isPublished), hiddenChars = allChars.filter(c => !isPublished(c));
      const pubIds = new Set(published.map(c => c.id)), pubNames = new Set(published.map(c => String(c.name || '').trim().toLowerCase()));

      // ---- items and marks: shown only once a published chapter's `reveals:` names them (or they are `open`) ----
      const revealOf = (name, id, obj) => obj && obj.open ? 0 : T.firstChapter('reveal', [name, id].filter(Boolean));
      const shown = (name, id, obj) => { const n = revealOf(name, id, obj); return n != null && n <= N; };
      const libItem = id => (lib.items || []).find(i => i && i.id === id) || null;
      const heldThings = new Set();
      // a character's race: revealed when a chapter lists it (alone, "Name: race" or "Name race"), or it is plain
      const raceRevealedIn = c => {
        const r = String(c.race || '').trim(); if (!r) return null;
        if (PLAIN_RACES.includes(r.toLowerCase())) return 0;
        return T.firstChapter('reveal', [r, (c.name || '') + ': ' + r, (c.name || '') + ' race']);
      };
      const raceShown = c => { const n = raceRevealedIn(c); return n != null && n <= N; };
      const noteHeld = (name, id, obj) => { if (!shown(name, id, obj) && String(name || '').trim().length >= 3) heldThings.add(String(name).trim()); };
      published.forEach(c => pubVersions(c).forEach(s => {
        (s.marks || []).forEach(m => m && noteHeld(m.name, m.id, m));
        (s.inventory || []).forEach(e => { if (!e) return; const it = libItem(e.itemId); noteHeld(it ? it.name : e.name, e.itemId, it); (e.marks || []).forEach(m => m && noteHeld(m.name, m.id, m)); });
      }));
      (lib.items || []).forEach(i => { if (!i) return; noteHeld(i.name, i.id, i); (i.marks || []).forEach(m => m && noteHeld(m.name, m.id, m)); (i.stateTracks || []).forEach(tr => (tr.states || []).forEach(st => (st.marks || []).forEach(m => m && noteHeld(m.name, m.id, m)))); });
      published.forEach(c => { const r = String(c.race || '').trim().toLowerCase(); if (r && !raceShown(c) && DISTINCT_RACES.includes(r)) heldThings.add(r); });
      // a held thing whose name is also a shown thing's name (two marks both called "Taint") isn't a secret
      const shownNames = new Set();
      published.forEach(c => pubVersions(c).forEach(s => (s.marks || []).forEach(m => { if (m && shown(m.name, m.id, m)) shownNames.add(String(m.name).trim().toLowerCase()); })));
      (lib.items || []).forEach(i => { if (i && shown(i.name, i.id, i)) shownNames.add(String(i.name).trim().toLowerCase()); });
      [...heldThings].forEach(n => { if (shownNames.has(n.toLowerCase())) heldThings.delete(n); });

      // ---- names readers must not see: places they haven't reached, characters not yet introduced, items and marks not yet revealed ----
      const placeNames = S.hiddenNames(N, recs);
      const charRes = hiddenChars.map(c => String(c.name || '').trim()).filter(n => n.length >= 3 && !pubNames.has(n.toLowerCase()))
        .concat([...heldThings].filter(n => !pubNames.has(n.toLowerCase())))
        .map(n => ({ name: n, re: new RegExp('(^|[^a-z0-9])' + esc(n.toLowerCase()) + '($|[^a-z0-9])') }));
      const mentions = t => { const l = String(t == null ? '' : t).toLowerCase(); return placeNames.some(n => l.includes(n)) || charRes.some(x => x.re.test(l)); };
      const scrub = t => (t == null || t === '') ? '' : (mentions(t) ? '' : String(t));
      const hiddenPlace = id => { const r = recs.find(x => x.placeId === id); return !!r && !S.placeReached(r, N); };

      const marks = list => (Array.isArray(list) ? list : []).filter(m => m && shown(m.name, m.id, m))
        .map(m => ({ id: m.id, kind: m.kind, name: scrub(m.name), image: m.image || '', revealedIn: revealOf(m.name, m.id, m) })).filter(m => m.name);
      const location = l => {
        if (!l || typeof l !== 'object') return l == null ? null : undefined;
        if ([l.placeId, l.toPlaceId].filter(Boolean).some(hiddenPlace)) return { status: 'unknown' };
        return pick(l, LOCATION_FIELDS);
      };

      const keptItemIds = new Set();
      const dossierChars = published.map(c => {
        const versions = pubVersions(c).map(s => {
          const v = pick(s, VERSION_FIELDS);
          v.blurb = scrub(s.blurb);
          v.location = location(s.location);
          v.condition = (Array.isArray(s.condition) ? s.condition : []).map(scrub).filter(Boolean);
          v.titles = (Array.isArray(s.titles) ? s.titles : []).map(t => ({ name: scrub(t.name), rankTier: t.rankTier, blurb: scrub(t.blurb) })).filter(t => t.name);
          v.skills = (Array.isArray(s.skills) ? s.skills : []).map(k => ({ name: scrub(k.name), desc: scrub(k.desc), level: k.level, parent: k.parent || '' })).filter(k => k.name);
          v.marks = marks(s.marks);
          v.stats = pick(s.stats || {}, STAT_KEYS);
          v.power = pick(s.power || {}, ['threat', 'name']);
          v.relationships = (Array.isArray(s.relationships) ? s.relationships : []).filter(r => r && r.charId && pubIds.has(r.charId)).map(r => ({ name: r.name, relation: scrub(r.relation), charId: r.charId }));
          v.inventory = (Array.isArray(s.inventory) ? s.inventory : []).filter(e => { if (!e || !e.itemId) return false; const it = libItem(e.itemId); return shown(it ? it.name : e.name, e.itemId, it); })
            .map(e => { keptItemIds.add(e.itemId); return { id: e.id, itemId: e.itemId, stateId: ((e.stateIds || {}).item) || '', name: scrub(e.name), marks: marks(e.marks) }; });
          return v;
        });
        const out = pick(c, CHAR_FIELDS);
        if (c.race && raceShown(c)) { out.race = c.race; out.raceRevealedIn = raceRevealedIn(c); }
        out.introducedIn = introOf(c);
        out.activeSnapshotId = versions[versions.length - 1].id;
        out.snapshots = versions;
        return out;
      });

      // ---- the Library: only items someone published holds, and only user places they are standing in ----
      const items = (lib.items || []).filter(i => i && keptItemIds.has(i.id)).map(i => {
        const out = { id: i.id, name: scrub(i.name), desc: scrub(i.desc), icon: i.icon || '', image: i.image || '', marks: marks(i.marks), revealedIn: revealOf(i.name, i.id, i) };
        // snapshot format unchanged (plan 4.1 will move it to the new fields): `originPlaceId` is the place when the origin is one
        const pid = i.origin !== undefined ? (['none', 'unknown'].includes(i.origin) ? '' : i.origin) : i.originPlaceId;
        if (pid && !hiddenPlace(pid)) out.originPlaceId = pid;
        out.states = (((i.stateTracks || []).find(tr => tr.kind === 'item') || { states: [] }).states).map(st => ({ id: st.id, name: scrub(st.name), desc: scrub(st.desc), marks: marks(st.marks), image: st.image || '' }));
        return out;
      }).filter(i => i.name);
      const itemIds = new Set(items.map(i => i.id));
      dossierChars.forEach(c => c.snapshots.forEach(v => { v.inventory = v.inventory.filter(e => itemIds.has(e.itemId)); }));
      const usedPlaces = new Set();
      dossierChars.forEach(c => c.snapshots.forEach(v => { if (v.location && v.location.placeId) usedPlaces.add(v.location.placeId); }));
      const places = (lib.places || []).filter(p => p && usedPlaces.has(p.id) && !hiddenPlace(p.id)).map(p => pick(p, ['id', 'name', 'countryId', 'continentId', 'lat', 'lng', 'kind', 'eras', 'cityId']));
      const countryIds = new Set(places.map(p => p.countryId).filter(Boolean));
      const countries = (lib.countries || []).filter(c => c && countryIds.has(c.id)).map(c => pick(c, ['id', 'name', 'continentId']));

      const chapters = (state.chapters || []).filter(c => c && isInt(c.number) && c.number <= N).map(c => ({ id: c.id, number: c.number, title: scrub(c.title) }));

      // ---- the timeline ----
      const charRef = ref => { const k = String(ref).replace(/^char:/, ''); return published.find(c => c.id === k || String(c.name || '').toLowerCase() === k.toLowerCase()); };
      const heldEvents = [];
      const timeline = events.filter(e => {
        const ok = T.isRevealed(e, N) && scrub(e.title) !== '';
        if (!ok) heldEvents.push(e);
        return ok;
      }).map(e => {
        const refs = (e.refs || []).filter(r => /^place:/.test(r) ? !hiddenPlace(String(r).replace(/^place:/, '')) : /^char:/.test(r) ? !!charRef(r) : false);
        const out = { id: e.id, title: e.title, kind: e.kind, order: e.order, when: clone(e.when), refs };
        if (e.open) out.open = true;
        if (e.secret) out.secret = true;
        if (e.revealedAt != null) out.revealedAt = e.revealedAt;
        return out;
      });

      // ---- the site encyclopedia ----
      const sites = [], heldSites = [];
      recs.forEach(r => {
        if (!S.placeReached(r, N)) { heldSites.push(r.placeId); return; }
        const states = r.states.filter(st => S.reached(st.from, N)).map(st => ({ from: st.from, status: st.status, scales: clone(st.scales || {}), note: scrub(st.note) }));
        const holders = (r.rule.holders || []).filter(h => S.reached(h.from, N) && (!/^char:/.test(String(h.ref)) || charRef(h.ref)))
          .map(h => ({ ref: scrub(String(h.ref).replace(/^char:/, '')) ? h.ref : '', title: scrub(h.title), from: h.from, to: S.reached(h.to, N) ? h.to : null })).filter(h => h.ref);
        const alliances = S.alliancesAt(r.placeId, N, recs, false).filter(a => a.owner === r.placeId).map(a => ({
          with: a.with, kind: a.kind, from: a.from, to: a.endHidden ? null : a.to, endsLater: !!a.endHidden, note: scrub(a.note) }));
        const resources = (r.resources || []).map(x => ({ name: scrub(x.name), category: x.category, role: x.role, source: x.source && !hiddenPlace(String(x.source).replace(/^place:/, '')) ? x.source : undefined })).filter(x => x.name).map(x => { if (x.source === undefined) delete x.source; return x; });
        const beasts = (r.beasts || []).map(b => ({ ref: b.ref, relation: b.relation, note: scrub(b.note) }));
        const founding = (r.founding || []).filter(f => S.reached(f.when, N)).map(f => ({ stage: f.stage, when: f.when, why: scrub(f.why), who: scrub(String(f.who || '').replace(/^char:/, '')), materials: scrub(f.materials), reused: scrub(f.reused), change: scrub(f.change) }));
        sites.push({ placeId: r.placeId, revealedIn: S.placeRevealChapter(r), states,
          rule: { form: r.rule.form, holders, laws: (r.rule.laws || []).map(scrub).filter(Boolean), outsiders: scrub(r.rule.outsiders), stance: r.rule.stance || '' },
          alliances, resources, beasts, founding });
      });
      // a tie must not name a place that was held back (alliancesAt already hides those), but a second pass is cheap
      sites.forEach(s => { s.alliances = s.alliances.filter(a => !hiddenPlace(String(a.with).replace(/^place:/, ''))); });

      const data = { schemaVersion: SCHEMA, publishedThrough: N, builtAt: now,
        dossier: { schemaVersion: state.schemaVersion, characters: dossierChars, chapters }, library: { version: lib.version, countries, places, items }, timeline, sites };

      report.counts = { characters: dossierChars.length, versions: dossierChars.reduce((n, c) => n + c.snapshots.length, 0), chapters: chapters.length, items: items.length, places: places.length, events: timeline.length, sites: sites.length };
      report.held = { charactersNotIntroduced: hiddenChars.map(c => c.name || 'Unnamed'),
        versionsAfter: allChars.reduce((n, c) => n + (c.snapshots || []).filter(s => !(isInt(s.startChapter) && s.startChapter <= N)).length, 0),
        events: heldEvents.length, places: heldSites.map(id => (W && W.place(id) || {}).name || id), things: [...heldThings] };
      report.leaks = findLeaks(data, { placeNames, charRes, heldEvents, heldSites });   // charRes includes held items and marks
      return { data, report };
    } finally {
      T.setLatestOverride(null);
    }
  }

  /** Searches the finished snapshot for anything that should have been held back. */
  function findLeaks(data, ctx) {
    const text = JSON.stringify(data).toLowerCase(), out = [];
    ctx.placeNames.forEach(n => { if (text.includes(n)) out.push({ kind: 'place', term: n }); });
    ctx.charRes.forEach(x => { if (x.re.test(text)) out.push({ kind: 'character', term: x.name }); });
    ctx.heldEvents.forEach(e => { if (String(e.id).length >= 8 && text.includes('"' + String(e.id).toLowerCase() + '"')) out.push({ kind: 'event', term: e.id }); });
    ctx.heldSites.forEach(id => { if (text.includes('place:' + String(id).toLowerCase())) out.push({ kind: 'place link', term: id }); });
    return out;
  }

  function toScript(data) {
    return '/* Epitaph published data. Generated by Dossier > Data > Publish snapshot (built ' + data.builtAt + '). Do not edit by hand. */\n'
      + 'window.EPITAPH_PUBLISHED = ' + JSON.stringify(data, null, 1) + ';\n';
  }

  global.EpitaphPublish = { SCHEMA, CHAR_FIELDS, VERSION_FIELDS, STAT_KEYS, LOCATION_FIELDS, throughFrom, build, findLeaks, toScript };
})(typeof window !== 'undefined' ? window : globalThis);
