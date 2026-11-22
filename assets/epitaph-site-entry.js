/* Epitaph — Site Encyclopedia: one place's entry, inside the book (step 2.2; design: the round-4 mockups).
 *
 * Opens on place:<id> links while the book shows the Site Encyclopedia (opse). The entry is drawn as a layer over the index on the
 * left page (seven tabs: Overview · History · Domestic · Foreign · Economy · Beasts · Intrigue) and a dither map in the right page's
 * panel above the terminal; each tab picks the map's zoom (world, region, or the founding model) and its overlays.
 * "◂ All places" (or Esc) goes back to the index. Outside the encyclopedia, place links keep opening the map.
 *
 * Readers: what a reader on their chapter hasn't reached stays out (states, ties, rulers, chronicle, founding stages through the
 * timeline; hidden factions, agents, covert ties, truths, scenarios and unrevealed Intrigue lines are author-only). The author sees
 * everything, with what readers can't see drawn dashed. Step 2.4 finishes this gate; 2.3, 2.6 and 2.7 fill the marked spots.
 *
 *   EpitaphSiteEntry.open(placeId, tab?) -> true when it opened in the book
 */
(function (global) {
  'use strict';
  const S = () => global.EpitaphSites, Wd = () => global.EpitaphWorld, TL = () => global.EpitaphTimeline, D = () => global.EpitaphDither;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const ZOOM = { overview: 'region', history: 'site', domestic: 'site', foreign: 'world', economy: 'region', beasts: 'region', intrigue: 'world' };
  const KIND_COL = { alliance: 'var(--verdigris)', trade: 'var(--gold)', war: 'var(--ember)', rivalry: 'var(--ember)', vassal: 'var(--amber)', truce: 'var(--dust)', covert: 'var(--ember)' };
  let cur = null;           // { placeId, tab, angle, stage, focus }
  let ro = null;            // the map's resize observer
  let sizeTimer = 0;        // a light size check, for layout changes the observer misses

  // ---------------------------------------------------------------- context: who is reading, and what they may see
  function context(placeId) {
    const Si = S(), T = TL(), recs = Si.load(), full = Si.get(placeId, recs) || Si.empty(placeId);
    const place = (Wd() && Wd().place(placeId)) || { id: placeId, name: placeId };
    const author = T ? T.authorMode() : true, chapter = T ? T.readerChapter() : null;
    const at = chapter == null ? (T && T.latestChapter ? T.latestChapter() : null) : chapter;
    // a reader (or the author's Reader view) gets the record through the same gate the published snapshot uses, so a preview is what is published
    const dossier = (typeof state !== 'undefined' && state) ? state : (() => { try { return JSON.parse(localStorage.getItem('epitaph-character-profiles') || 'null') || {}; } catch (e) { return {}; } })();
    const charOk = ref => { const k = String(ref || '').replace(/^char:/, '').toLowerCase(); const ch = (dossier.characters || []).find(x => x.id === ref.replace(/^char:/, '') || String(x.name || '').toLowerCase() === k);
      return !!ch && (ch.snapshots || []).some(v => Number.isInteger(v.startChapter) && (at == null || v.startChapter <= at)); };
    const rec = author ? full : Si.forReader(full, chapter, { recs, charOk });
    const c = { Si, T, recs, rec, place, author, chapter, at, pid: placeId };
    c.dossier = dossier;
    c.holders = id => Si.secretHolders(dossier.characters || [], 'secret:' + placeId + '/' + id);
    c.latest = T && T.latestChapter ? T.latestChapter() : null;
    c.seen = when => Si.reached(when, chapter);
    c.revealed = it => !!it && it.revealedIn != null && at != null && it.revealedIn <= at;
    c.show = it => author || c.revealed(it);
    c.txt = t => author ? (t || '') : Si.clean(t || '', chapter, recs, false);
    c.name = ref => {
      const r = String(ref || '');
      if (/^(char|place):/.test(r) && global.EpitaphLinks) { const x = global.EpitaphLinks.resolve(r); const n = x ? x.name : r.replace(/^\w+:/, ''); return /^place:/.test(r) ? shortName(n) : n; }
      const m = /^(faction|landmark|figure|secret|rumour|record|chronicle|resource|tie|question):(?:([\w-]+)\/)?(.+)$/.exec(r);
      if (m) {
        const owner = m[2] ? Si.get(m[2], recs) : rec, id = m[3];
        const find = (list, key) => { const x = (list || []).find(y => (key ? slug(y[key]) : y.id) === id); return x || null; };
        const hit = owner && ({
          faction: () => find(owner.domestic.factions), figure: () => find(owner.domestic.figures), landmark: () => find(owner.history.landmarks),
          secret: () => find(owner.intrigue.secrets), rumour: () => find(owner.intrigue.rumours), chronicle: () => find(owner.history.chronicle),
          resource: () => find(owner.economy.resources), record: () => find(owner.history.record, 'topic'),
          tie: () => find(owner.foreign.ties), question: () => find(owner.intrigue.questions) })[m[1]]();
        if (hit && m[1] === 'tie') return shortName(c.name('place:' + String(hit.with).replace(/^place:/, ''))) + ' · ' + (Si.label(Si.ALLIANCE_KINDS, hit.kind) || '').toLowerCase();
        if (hit) return hit.name || hit.title || hit.topic || (hit.text ? hit.text.slice(0, 48) + (hit.text.length > 48 ? '…' : '') : id);
        return id.replace(/-/g, ' ');
      }
      return r;
    };
    // "In the story": derived from the Dossier's per-chapter locations and the timeline's moments set here (nothing is typed in)
    c.story = () => {
      if (c._story) return c._story;
      const W = Wd(), st = (typeof state !== 'undefined' && state) ? state : (() => { try { return JSON.parse(localStorage.getItem('epitaph-character-profiles') || 'null') || {}; } catch (e) { return {}; } })();
      const story = Si.storyOf({ placeId, characters: st.characters || [], chapters: st.chapters || [], at: c.at, author,
        resolve: loc => { const r = W && W.resolve(loc); return r && r.place ? r.place.id : null; } });
      const moments = T ? T.load().filter(e => (e.refs || []).includes('place:' + placeId) && (author || T.isRevealed(e, chapter)))
        .sort((x, y) => T.compare(x, y)).map(e => ({ title: e.title, when: T.label(e.when), hidden: !T.isRevealed(e, chapter), kind: e.kind })) : [];
      return (c._story = Object.assign(story, { moments }));
    };
    // Intrigue markers: field ref -> the secrets and rumours pinned to it that this viewer may see
    c.pins = new Map();
    const add = (ref, kind, it) => { if (!c.pins.has(ref)) c.pins.set(ref, []); c.pins.get(ref).push({ kind, it }); };
    (rec.intrigue.secrets || []).filter(c.show).forEach(s => (s.about || []).forEach(r => add(r, 'secret', s)));
    (rec.intrigue.rumours || []).filter(c.show).forEach(s => (s.about || []).forEach(r => add(r, 'rumour', s)));
    if (author) (rec.intrigue.secrets || []).forEach(s => (s.evidence || []).forEach(r => { if (!(c.pins.get(r) || []).some(p => p.it === s)) add(r, 'secret', s); }));
    return c;
  }
  /** "Voided Settlement — The Hollow Reach" -> "The Hollow Reach" */
  const shortName = n => String(n || '').split(/\s+[—–-]\s+/).pop();
  const slug = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // ---------------------------------------------------------------- small pieces
  const chip = (t, cls) => t ? `<span class="se-chip${cls ? ' ' + cls : ''}">${esc(t)}</span>` : '';
  const dots = (n, cls) => n ? `<span class="se-dots${cls ? ' ' + cls : ''}" role="img" aria-label="${n} of 7">${[1, 2, 3, 4, 5, 6, 7].map(k => `<i${k > n ? ' class="o"' : ''}></i>`).join('')}</span>` : '';
  /** A boxed section. `id` (optional) is an anchor an Intrigue marker can jump to. */
  const card = (label, inner, cls, id, edit) => `<div class="se-card${cls ? ' ' + cls : ''}"${id ? ` data-se-id="${esc(id)}"` : ''}${edit ? ` data-se-edit="${esc(edit)}"` : ''}>${label ? `<span class="se-lbl">${esc(label)}</span>` : ''}${inner}</div>`;
  const kv = rows => `<div class="se-kv">${rows.filter(r => r && r[1]).map(r => `<span>${esc(r[0])}</span><span>${r[1]}</span>`).join('')}</div>`;
  /** A card the author can edit: `edit` is the path the editor opens (EpitaphSiteEdit); readers never get the attribute. */
  const ecard = (edit, label, inner, cls, id) => card(label, inner, cls, id, edit);
  const empty = t => `<p class="se-empty">${esc(t)}</p>`;
  function markers(c, ref) {
    const list = c.pins.get(ref); if (!list) return '';
    return list.map(p => `<button type="button" class="se-mk" data-se-focus="${esc(p.kind + ':' + p.it.id)}" title="${esc(p.kind === 'secret' ? 'Secret: ' : 'Rumour: ')}${esc(p.it.text)}">◆${p.kind === 'rumour' ? ' rumour' : ''}</button>`).join('');
  }
  const label = (set, id) => S().label(S()[set], id);

  // ---------------------------------------------------------------- the seven tabs: { html, map }
  const chLabel = n => 'Ch ' + n;
  function storyHtml(c) {
    const sy = c.story();
    if (!sy.people.length && !sy.chapters.length && !sy.moments.length) return '<span class="se-dim">Nothing in the Dossier or the timeline puts anyone here yet. Give a character this place as their location in a chapter and they appear here.</span>';
    const stay = st => (st.to != null ? `${chLabel(st.from)}–${chLabel(st.to).replace('Ch ', '')}` : `${chLabel(st.from)} → ${c.at != null && !c.author ? 'now' : 'still there'}`);
    return `
      ${sy.chapters.length ? `<div class="se-row"><span class="se-lbl">Chapters set here</span>${sy.chapters.map(h => `<span class="se-chip${h.hidden ? ' dash' : ' am'}" title="${esc((h.title ? h.title + ' · ' : '') + h.who.join(', '))}">${esc(chLabel(h.n))}</span>`).join('')}</div>` : ''}
      ${sy.people.length ? `<div class="se-ppl">${sy.people.map(p => `<span class="se-ppl-n${p.hidden ? ' se-hidtxt' : ''}"><button type="button" class="se-link" data-ref="char:${esc(p.id)}">${esc(p.name)}</button>${p.dead ? ' †' : ''}</span>
        <span class="se-ppl-s">${p.stays.map(st => `<span class="${st.hidden ? 'se-hidtxt' : ''}">${esc(stay(st))}${st.why ? ` <span class="se-dim">${esc(c.txt(st.why))}</span>` : ''}</span>`).join('<br>')}</span>`).join('')}</div>` : ''}
      ${sy.moments.length ? `<div class="se-row"><span class="se-lbl">Moments</span>${sy.moments.map(m => `<span class="se-chip${m.hidden ? ' dash' : ''}" title="${esc(m.when)}">${esc(m.title)} · ${esc(m.when)}</span>`).join('')}</div>` : ''}`;
  }
  function overview(c) {
    const Si = c.Si, rec = c.rec, st = Si.stateAt(rec, c.chapter) || (c.author ? rec.overview.states[0] : null);
    if (!st) return { html: empty(c.author ? 'No state written for this place yet.' : 'Nothing about this place is known yet.'), map: {} };
    const scales = Si.SCALES.map(s => [s.label, st.scales[s.id], Si.step(s.id, st.scales[s.id])]);
    if (st.techLevel) scales.push(['Technology', st.techLevel, Si.SCALE_SETS.tech.steps[st.techLevel - 1]]);
    const states = rec.overview.states.map(x => {
      const ok = c.seen(x.from); if (!ok && !c.author) return '';
      return chip(label('STATUS', x.status), x === st ? 'fill' : (ok ? '' : 'dash'));
    }).filter(Boolean).join('<span class="se-dim">→</span>');
    const n = { f: rec.domestic.factions.filter(f => c.author || !f.hidden).length, g: rec.domestic.figures.length, t: Si.alliancesAt(c.pid, c.chapter, c.recs).length };
    const sec = rec.intrigue.secrets.filter(c.show).length, rum = rec.intrigue.rumours.filter(c.show).length, wi = c.author ? rec.scenarios.length : 0;
    const html = `
      <div class="se-row">${chip(label('STATUS', st.status), 'fill')}${chip(label('FORMS', rec.domestic.government.form), 'am')}${st.techLevel ? chip('Tech ' + st.techLevel + ' · ' + Si.SCALE_SETS.tech.steps[st.techLevel - 1]) : ''}${chip(c.chapter == null ? 'As of the latest chapter' : 'As of your chapter · Ch ' + c.chapter, 'dash')}${c.author && rec.draft.overview ? chip('Draft', 'dash') : ''}</div>
      ${st.note ? `<p class="se-lead">${esc(c.txt(st.note))}</p>` : ''}
      ${ecard('overview.states.' + rec.overview.states.indexOf(st), 'The seven scales · bigger dot, higher step', scales.map(([l, v, s]) => `<div class="se-scale"><span class="se-lbl">${esc(l)}</span><span class="se-sdots">${[1, 2, 3, 4, 5, 6, 7].map(k => `<i style="width:${4 + k * 2}px;height:${4 + k * 2}px"${k > (v || 0) ? ' class="o"' : ''}></i>`).join('')}</span><span class="se-vt se-hi">${esc(s)}</span></div>`).join(''))}
      ${card('Over time', `<div class="se-row">${states}</div>`)}
      ${card('In the story · from the Dossier and the timeline', storyHtml(c))}
      <div class="se-g2">
        ${card('At a glance', `<span class="se-vt"><b>${n.f}</b> factions · <b>${n.g}</b> figures · <b>${n.t}</b> ties</span><span class="se-vt"><b>${rec.history.landmarks.length}</b> landmarks · <b>${rec.economy.resources.length}</b> resources</span>
          <span class="se-row">${sec ? `<button type="button" class="se-mk" data-se-tab="intrigue">◆ ${sec} secret${sec === 1 ? '' : 's'}</button>` : ''}${rum ? `<button type="button" class="se-mk" data-se-tab="intrigue">◆ ${rum} rumour${rum === 1 ? '' : 's'}</button>` : ''}${wi ? `<button type="button" class="se-mk" data-se-tab="intrigue">${wi} what-if${wi === 1 ? '' : 's'}</button>` : ''}</span>`)}
      </div>`;
    return { html, map: { ring: true } };
  }

  /** How it was built (step 5.1): the seven founding stages top to bottom, each dated on the shared timeline. Clicking a stage turns the
   *  founding model on the right page to it. A reader sees only stages they've reached (the gate filters them); a stage they haven't
   *  reached, or that isn't written, shows as "? ? ?" so the seven stay in place. */
  function foundingHtml(c, founding) {
    const T = c.T, stages = c.Si.FOUNDING_STAGES;
    if (!founding.length && !c.author) return '';
    const when = id => { if (id == null) return 'from the start'; const e = T && T.byId(id); if (!e) return '?'; const ch = T.revealChapter ? T.revealChapter(e) : null;
      return String(e.title || id).replace(/[:;].*$/, '').slice(0, 54) + (Number.isInteger(ch) && ch > 0 ? ' · Ch ' + ch : ''); };
    const rows = stages.map((st, i) => {
      const f = founding.find(x => x.stage === st.id), on = cur && cur.stage === i;
      const head = `<button type="button" class="se-fs-n${on ? ' on' : ''}" data-se-stage="${i}" aria-pressed="${on}" title="Show this stage on the founding model"><b>${i + 1}</b><span>${esc(f || c.author ? st.label : '? ? ?')}</span></button>`;
      if (!f) return `<div class="se-fs empty">${head}<div class="se-fs-b"><span class="se-dim">${c.author ? 'Not written yet.' : 'Not known yet.'}</span></div></div>`;
      const who = f.who ? (/^(char|place):/.test(f.who) ? c.name(f.who) : c.txt(f.who)) : '';
      const kvs = [['Why here', c.txt(f.why)], ['Who', who], ['Materials', c.txt(f.materials)], ['From the drowned world', c.txt(f.reused)], ['What changed', c.txt(f.change)]].filter(r => r[1]);
      return `<div class="se-fs${c.seen(f.when) ? '' : ' se-hid'}">${head}<div class="se-fs-b"><span class="se-fs-w">${esc(when(f.when))}${c.author && !c.seen(f.when) ? ' · readers haven’t reached it' : ''}</span>
        ${kvs.length ? `<div class="se-kv">${kvs.map(r => `<span>${esc(r[0])}</span><span>${esc(r[1])}</span>`).join('')}</div>` : '<span class="se-dim">Only the date so far.</span>'}</div></div>`;
    }).join('');
    return ecard('history.founding', 'How it was built · seven stages, dated on the timeline · click one to see it on the model', `<div class="se-found">${rows}</div>`);
  }
  function history(c) {
    const h = c.rec.history, Si = c.Si;
    const founding = (h.founding || []).filter(f => c.author || c.seen(f.when));
    const chron = (h.chronicle || []).filter(e => c.author || c.seen(e.when));
    const html = `
      <div class="se-g2">
        ${(c.author || h.purpose.original || h.purpose.now || h.purpose.drift) ? ecard('history.purpose', 'Original purpose → now', `<span>${esc(c.txt(h.purpose.original)) || '<span class="se-dim">—</span>'}</span>${h.purpose.now ? `<span class="se-dim">Now: ${esc(c.txt(h.purpose.now))}</span>` : ''}${h.purpose.drift ? `<span class="se-dim">Drift: ${esc(c.txt(h.purpose.drift))}</span>` : ''}`) : ''}
        ${ecard('history.settlers', 'Founders · first settlers', `${(h.founders || []).map(f => `<span>${chip(c.name(f.ref || f.name), 'am')} <span class="se-dim">${esc(f.role)}</span></span>`).join('')}${h.settlers.who ? `<span>${esc(c.txt(h.settlers.who))}${h.settlers.from ? ` <span class="se-dim">from ${esc(c.txt(h.settlers.from))}</span>` : ''}</span>` : ''}` || '<span class="se-dim">—</span>')}
        ${ecard('history.myth', 'The founding myth', h.myth.text ? `<span>“${esc(c.txt(h.myth.text))}”</span>${c.author && h.myth.true ? `<span class="se-row">${chip(h.myth.true === 'half' ? 'Half-true' : h.myth.true === 'true' ? 'True' : 'False', 'am')}</span>` : ''}` : '<span class="se-dim">—</span>')}
        ${ecard('history.name', 'The name · eras', `<span>${esc(h.name.meaning) || '<span class="se-dim">—</span>'}</span>${(h.name.outsiders || []).length ? `<span class="se-dim">Outsiders: ${esc(h.name.outsiders.join(', '))}</span>` : ''}<span class="se-row">${(h.eras || []).filter(e => c.author || c.seen(e.from)).map(e => chip(e.name, c.seen(e.from) ? '' : 'dash')).join('')}</span>`)}
      </div>
      ${foundingHtml(c, founding)}
      ${ecard('history.chronicle', 'Chronicle · ◆ turning point' + (c.author ? ' · dashed = readers haven\'t reached it' : ''), chron.length ? `<div class="se-tl">${chron.map(e => `<b class="${e.turningPoint ? 'tp' : ''}"></b><span class="${c.seen(e.when) ? '' : 'se-hidtxt'}"><span class="se-hi">${esc(c.txt(e.title))}</span>${e.text ? ` <span class="se-dim">${esc(c.txt(e.text))}</span>` : ''} ${markers(c, 'chronicle:' + e.id)}</span>`).join('')}</div>` : empty('No dated events yet.'))}
      ${(h.record || []).length ? ecard('history.record', 'The record · official version' + (c.author ? ' vs what really happened' : ''), `<div class="se-rec${c.author ? '' : ' one'}"><span class="se-lbl">topic</span><span class="se-lbl">official</span>${c.author ? '<span class="se-lbl">truth · author only</span>' : ''}${h.record.map(r => `<span class="se-hi">${esc(r.topic)} ${markers(c, 'record:' + slug(r.topic))}</span><span>${esc(c.txt(r.official))}</span>${c.author ? `<span class="se-dim">${esc(r.truth)}</span>` : ''}`).join('')}</div>${c.author ? `<div class="se-row">${h.record.flatMap(r => (r.evidence || []).map(e => chip(e.what))).join('')}${h.record.filter(r => r.forbidden).map(r => chip('Forbidden: ' + r.forbidden, 'dash')).join('')}</div>` : ''}`) : ''}
      <div class="se-row"><span class="se-lbl">Landmarks</span>${(h.landmarks || []).map(l => chip(l.name, l.sealed ? 'dash' : '') + markers(c, 'landmark:' + l.id)).join('') || '<span class="se-dim">none yet</span>'}</div>
      ${(h.lost || []).length ? `<div class="se-row"><span class="se-lbl">Lost</span>${h.lost.filter(l => c.author || c.seen(l.when)).map(l => chip(l.name + (l.how ? ' · ' + l.how : ''), c.seen(l.when) ? '' : 'dash')).join('')}</div>` : ''}`;
    return { html, map: { model: true, landmarks: h.landmarks || [], stages: founding } };
  }

  function domestic(c) {
    const d = c.rec.domestic, g = d.government, Si = c.Si;
    const holders = (g.holders || []).filter(x => c.author || c.seen(x.from));
    const factions = (d.factions || []).filter(f => (c.author || !f.hidden) && (c.author || c.seen(f.from)));
    const figures = (d.figures || []).filter(f => c.author || !(d.factions.find(x => x.id === f.faction) || {}).hidden);
    const html = `
      ${ecard('domestic.government', 'Government · ' + label('FORMS', g.form), `<div class="se-row">${(g.offices || []).map((o, i) => chip(o.title + (o.holder ? ' · ' + c.name(o.holder) : ''), i ? '' : 'fill')).join('')}${holders.map(x => chip(c.name(x.ref) + (x.title ? ' · ' + x.title : ''), 'am')).join('')}</div>
        ${kv([['Succession', esc(c.txt(g.succession))], ['Citizenship', esc(c.txt(g.citizenship))], ['Justice', esc(c.txt(g.justice))], ['Corruption', c.author ? esc(g.corruption) : '']])}
        ${(g.laws || []).length ? `<div class="se-row"><span class="se-lbl">Laws</span>${g.laws.filter(l => c.author || c.seen(l.from)).map(l => chip(c.txt(l.text))).join('')}</div>` : ''}`)}
      <span class="se-lbl">Factions · strength 1–7${c.author ? ' · dashed = hidden from readers' : ''}</span>
      ${factions.length ? `<div class="se-g2">${factions.map(f => ecard('domestic.factions.' + d.factions.indexOf(f), '', `<div class="se-row"><span class="se-hi">${esc(f.name)}</span>${chip(label('FACTION_KINDS', f.kind))}${dots(f.strength)}${f.hidden ? chip('Hidden', 'dash') : ''}${markers(c, 'faction:' + c.pid + '/' + f.id)}</div>
          ${f.goals.public ? `<span><span class="se-dim">Public:</span> ${esc(c.txt(f.goals.public))}</span>` : ''}${c.author && f.goals.secret ? `<span><span class="se-dim">Secret:</span> ${esc(f.goals.secret)}</span>` : ''}
          ${f.stance ? `<span class="se-dim">${esc(c.txt(f.stance))}${f.size ? ' · ' + esc(c.txt(f.size)) : ''}</span>` : ''}`, f.hidden ? 'se-hid' : '')).join('')}</div>` : empty('No factions written yet.')}
      <span class="se-lbl">Key figures</span>
      ${figures.length ? `<div class="se-g3">${figures.map(f => { const nm = f.ref ? c.name(f.ref) : f.name; const stt = (f.status || []).filter(s => c.author || c.seen(s.from)).map(s => s.value).join(' → ');
          return ecard('domestic.figures.' + d.figures.indexOf(f), '', `<div class="se-fig"><span class="se-av">${esc((nm || '?').charAt(0))}</span><span><span class="se-hi">${esc(nm)}</span> · ${esc(c.txt(f.role))} ${f.ref ? markers(c, f.ref) : ''}${f.goals && f.goals.public ? `<br><span class="se-dim">Wants:</span> ${esc(c.txt(f.goals.public))}` : ''}${c.author && f.goals && f.goals.secret ? `<br><span class="se-dim">Secretly:</span> ${esc(f.goals.secret)}` : ''}${c.author && f.fears ? `<br><span class="se-dim">Fears:</span> ${esc(f.fears)}` : ''}${stt ? `<br><span class="se-dim">${esc(stt)}</span>` : ''}</span></div>`); }).join('')}</div>` : empty('No key figures yet.')}
      <div class="se-g3">
        ${ecard('domestic.unrest', 'Unrest', (d.unrest || []).length ? d.unrest.map(u => `<span>${esc((u.causes || []).join(', '))}</span>${u.response ? `<span class="se-dim">Response: ${esc(u.response)}</span>` : ''}`).join('') : '<span class="se-dim">None recorded.</span>')}
        ${ecard('domestic.society', 'Society & faith', `${d.society.daily ? `<span>${esc(c.txt(d.society.daily))}</span>` : ''}${d.society.faith ? `<span class="se-dim">${esc(c.txt(d.society.faith))}</span>` : ''}${d.society.customs ? `<span class="se-dim">${esc(c.txt(d.society.customs))}</span>` : ''}${d.society.culture ? `<span class="se-dim">${esc(c.txt(d.society.culture))}</span>` : ''}` || '<span class="se-dim">—</span>')}
        ${ecard('domestic.knowledge', 'Knowledge · military', `${d.knowledge.education ? `<span>${esc(c.txt(d.knowledge.education))}</span>` : ''}${(d.knowledge.forbidden || []).map(x => `<span class="se-dim">Forbidden: ${esc(x.what)}</span>`).join('')}${d.military.doctrine ? `<span class="se-dim">Defence: ${esc(c.txt(d.military.doctrine))}</span>` : ''}${(d.military.ranks || []).length ? `<span class="se-dim">Ranks: ${esc(d.military.ranks.join(' · '))}</span>` : ''}` || '<span class="se-dim">—</span>')}
      </div>`;
    return { html, map: { model: true, factions } };
  }

  /** Ties over time: one bar per tie from its start to its end on the timeline, coloured by kind (EpitaphSites.tieBars lays it out).
   *  A secret tie is dashed (author only); an end the reader hasn't reached is an open, fading bar with a "?". */
  function tieTimelineHtml(c, ties) {
    const T = TL(); if (!T || !ties.length) return '';
    const evs = T.load().slice().sort((a, b) => T.compare(a, b)), order = evs.map(e => e.id);
    if (order.length < 2) return '';
    let now = -1; evs.forEach((e, i) => { if (T.isRevealed(e, c.chapter)) now = i; });
    const L = c.Si.tieBars(ties, order, now, c.author), N = L.N, pct = i => i / N * 100, ROW = 28;
    const own = c.rec.foreign.ties, titleOf = id => { const e = evs.find(x => x.id === id); return e ? String(e.title || id) : ''; };
    const kinds = [...new Set(L.rows.map(r => r.kind))];
    const bars = L.rows.map((r, i) => {
      const left = pct(r.start), w = Math.max(1.4, pct(r.end) - pct(r.start)), col = KIND_COL[r.kind] || 'var(--amber)', kn = c.Si.label(c.Si.ALLIANCE_KINDS, r.kind);
      const idx = r.owner === c.pid ? own.findIndex(x => x.id === r.id) : -1;
      const tip = `${c.name('place:' + r.other)} · ${kn}
from ${r.from == null ? 'the start' : titleOf(r.from) || r.from}
${r.state === 'ongoing' ? 'still going' : r.state === 'unknown' ? 'ends later (not reached)' : 'to ' + (titleOf(r.to) || r.to)}${r.state === 'hidden-end' ? ' (readers can\'t see this end yet)' : ''}${r.secret ? '\nSecret tie' : ''}`;
      const cls = `se-tbar ${r.state}${r.secret || r.hidden ? ' sec' : ''}`, st = `style="top:${i * ROW + 3}px;left:${left.toFixed(2)}%;width:${w.toFixed(2)}%;--k:${col}"`;
      const inner = `<span>${esc(kn)}</span>${r.state === 'unknown' ? '<i>?</i>' : r.state === 'ongoing' ? '<i>▸</i>' : ''}`;
      return c.author && idx >= 0 ? `<button type="button" class="${cls}" ${st} data-se-open="foreign.ties.${idx}" title="${esc(tip)}">${inner}</button>` : `<div class="${cls}" ${st} title="${esc(tip)}">${inner}</div>`;
    }).join('');
    const used = new Set(); L.rows.forEach(r => { if (r.from != null) used.add(r.from); if (r.to != null) used.add(r.to); });
    const ticks = [...used].map(id => order.indexOf(id)).filter(i => i >= 0).sort((a, b) => a - b).map((i, k) => `<span class="se-tick" style="left:${pct(i).toFixed(2)}%"><b></b><em class="${pct(i) > 62 ? 'rt' : ''}" style="top:${(k % 3) * 13 + 3}px">${esc(titleOf(order[i]).replace(/:.*$/, '').slice(0, 24))}</em></span>`).join('');
    const nowLine = now >= 0 ? `<span class="se-now" style="left:${pct(now).toFixed(2)}%"><em>${c.chapter == null ? 'latest' : 'Ch ' + c.chapter}</em></span>` : '';
    const labels = L.rows.map(r => `<span class="se-tlab" style="height:${ROW}px"><button type="button" class="se-link" data-ref="place:${esc(r.other)}">${esc(c.name('place:' + r.other))}</button></span>`).join('');
    return `<div class="se-tl2"><div class="se-tlabs">${labels}</div><div class="se-tltrack" style="height:${L.rows.length * ROW + 52}px"><div class="se-tlrows" style="height:${L.rows.length * ROW}px">${bars}${nowLine}</div><div class="se-tlaxis" style="top:${L.rows.length * ROW + 4}px">${ticks}</div></div></div>
      <div class="se-row se-tlleg">${kinds.map(k => `<span class="se-lg"><i style="background:${KIND_COL[k] || 'var(--amber)'}"></i>${esc(c.Si.label(c.Si.ALLIANCE_KINDS, k))}</span>`).join('')}<span class="se-dim">dashed = secret${c.author ? '' : ' or not yet revealed'} · ? = it ends later</span></div>`;
  }
  /** One bloc: who is in it and since when, with a link to the ring grouped by bloc. */
  function blocCard(c, b, all) {
    const idx = b.owner === c.pid ? c.rec.foreign.blocs.findIndex(x => x.id === b.id) : -1;
    const mem = b.members.map(m => {
      const when = m.left ? `left${m.endCh ? ' Ch ' + m.endCh : ''}` : (m.startCh ? `joined Ch ${m.startCh}` : ''), cls = m.left ? 'dash' : (m.place === c.pid ? 'am' : '');
      return `<button type="button" class="se-chip se-link-chip ${cls}${m.hidden ? ' dash' : ''}" data-ref="place:${esc(m.place)}" title="${esc(c.name('place:' + m.place) + (when ? ' · ' + when : '') + (m.endHidden && c.author ? ' · leaves later (readers can’t see it yet)' : '') + (m.hidden ? ' · hidden from readers' : ''))}">${esc(c.name('place:' + m.place))}${when ? ` <span class="se-dim">${esc(when)}</span>` : ''}${m.endHidden && c.author ? ' <span class="se-dim">→?</span>' : ''}</button>`;
    }).join('');
    const rival = b.rival ? ((all.find(x => b.rival === 'bloc:' + x.key || b.rival === 'bloc:' + x.id || b.rival === x.key || b.rival === x.id) || {}).name || '') : '';
    return ecard(idx >= 0 ? 'foreign.blocs.' + idx : '', 'Bloc · ' + b.name + ' · ' + b.size + (b.size === 1 ? ' member' : ' members'),
      `<div class="se-row">${mem}${b.hidden ? chip('Hidden from readers', 'dash') : ''}${b.members.length < 3 && c.author ? chip('a bloc needs 3 or more', 'red') : ''}</div>` +
      kv([['Charter', esc(c.txt(b.charter))], ['Purpose', esc(c.txt(b.purpose))], ['Seat', b.seat ? esc(c.name(b.seat)) : ''], ['Rival', esc(rival)], ['Tension', c.author ? esc(b.tension) : esc(c.txt(b.tension))]]) +
      `<div class="se-row"><button type="button" class="se-link" data-se-web="${esc(c.pid)}" data-se-by="bloc">◯ See the blocs in the ring ▸</button></div>`, b.hidden ? 'se-hid' : '', 'bloc:' + b.key);
  }
  function foreign(c) {
    const Si = c.Si, f = c.rec.foreign;
    const ties = Si.alliancesAt(c.pid, c.chapter, c.recs);
    const own = id => (f.ties || []).find(t => t.id === id) || {};
    const agentsIn = c.author ? c.recs.flatMap(r => (r.foreign.agents || []).filter(a => String(a.in || '').replace(/^place:/, '') === c.pid).map(a => Object.assign({ from: r.placeId }, a))) : [];
    // blocs this place belongs to, through the reader gate (a bloc, member or departure a reader hasn't reached is not here)
    const allBlocs = Si.blocsAt(c.chapter, c.recs, c.author), blocs = allBlocs.filter(b => b.members.some(m => m.place === c.pid));
    const tieCard = t => { const full = t.owner === c.pid ? Object.assign({}, own(t.id), t) : t; const other = c.name('place:' + t.other);
      return ecard(t.owner === c.pid ? 'foreign.ties.' + f.ties.findIndex(x => x.id === t.id) : '', '', `<div class="se-row"><button type="button" class="se-link" data-ref="place:${esc(t.other)}">${esc(other)}</button>${chip(label('ALLIANCE_KINDS', t.kind), { alliance: 'teal', trade: 'am', vassal: 'am', truce: '', rivalry: 'red', war: 'red', covert: 'red' }[t.kind] || '')}${full.motive ? chip('Motive · ' + label('MOTIVES', full.motive), 'am') : ''}${t.owner !== c.pid ? chip('stored on ' + c.name('place:' + t.owner)) : ''}${t.hidden ? chip('Hidden from readers', 'dash') : ''}${markers(c, 'tie:' + t.owner + '/' + t.id)}</div>
        ${kv([['Terms', (full.terms || []).map(x => esc(`${x.side || ''}: gives ${x.gives || '—'}, gets ${x.gets || '—'}`)).join('<br>') || esc(c.txt(full.note))],
              ['Signed', full.signed && (full.signed.when || full.signed.by) ? esc([full.signed.when, (full.signed.by || []).map(c.name).join(', '), full.signed.where].filter(Boolean).join(' · ')) : ''],
              ['Renewal', full.renewal && (full.renewal.expires || full.renewal.conditions) ? esc([full.renewal.expires, full.renewal.conditions].filter(Boolean).join(' · ')) : ''],
              ['Public / real', full.public || full.real ? esc(full.public || '—') + (c.author ? ` · <span class="se-dim">real: ${esc(full.real || '—')}</span>` : '') : ''],
              ['Ends', t.to == null ? '' : (t.endHidden ? (c.author ? chip('? · ' + t.to + ' · hidden from readers', 'dash') : chip('?', 'dash')) : esc((full.ends && full.ends.how ? label('TIE_ENDINGS', full.ends.how) + ' · ' : '') + t.to))],
              ['Wants it to fail', c.author ? (full.wantsItToFail || []).map(r => chip(c.name(r), 'red')).join('') : '']])}`, t.hidden ? 'se-hid' : ''); };
    const html = `
      <div class="se-row sw-open"><button type="button" class="se-link" data-se-web="${esc(c.pid)}">◯ See ${esc(c.place.name.split(/\s+[—–-]\s+/).pop())} in the relations ring ▸</button></div>
      ${ties.length ? card('Ties over time · bars run from where a tie starts to where it ends', tieTimelineHtml(c, ties)) : ''}
      ${ties.length ? ties.map(tieCard).join('') : empty('No ties written yet.')}
      ${blocs.map(b => blocCard(c, b, allBlocs)).join('')}
      <div class="se-g2">
        ${c.author ? card('Agents in ' + c.place.name + ' · author only', agentsIn.length ? agentsIn.map(a => `<span>${esc(a.ref ? c.name(a.ref) : a.name)} <span class="se-dim">for ${esc(c.name('place:' + a.from))}${a.cover ? ', cover: ' + esc(a.cover) : ''}</span></span>`).join('') : '<span class="se-dim">None known.</span>', 'se-hid') : ''}
        ${ecard('foreign.envoys', 'Envoys · hostages · borders · routes', `<span class="se-dim">Envoys: ${esc((f.envoys || []).map(e => e.name || c.name(e.ref)).join(', ') || 'none')} · Hostages: ${esc((f.hostages || []).map(e => e.name || c.name(e.ref)).join(', ') || 'none')}</span><span class="se-dim">Routes: ${esc((f.routes || []).map(r => c.name(r.to) + (r.carries && r.carries.length ? ' (' + r.carries.join(', ') + ')' : '')).join(' · ') || 'none')}</span><span class="se-dim">Borders: ${esc((f.borders || []).map(b => b.land).join(', ') || 'none')} · Migration: ${esc((f.migration || []).map(m => m.who).join(', ') || 'none')}</span>`)}
      </div>`;
    return { html, map: { ties, agentsIn, blocs: blocs.map(b => ({ name: b.name, members: b.members.filter(x => !x.left) })) } };
  }

  function economy(c) {
    const e = c.rec.economy, Si = c.Si;
    const list = e.resources || [];
    const items = global.EpitaphLibrary && global.EpitaphLibrary.itemsFromPlace ? (() => { try { return global.EpitaphLibrary.itemsFromPlace(c.pid) || []; } catch (x) { return []; } })() : [];
    const html = `
      ${list.length ? `<div class="se-tbl"><span class="th">★</span><span class="th">resource</span><span class="th">category</span><span class="th">role</span><span class="th">importance</span><span class="th">controlled by · if cut off</span>
        ${list.map((r, i) => `<span class="se-star">${r.core ? '★' : ''}</span><span><b class="se-hi">${i + 1}</b> ${esc(c.txt(r.name))} ${markers(c, 'resource:' + r.id)}${c.author ? `<button type="button" class="se-pen-i" data-se-open="economy.resources.${i}" aria-label="Edit ${esc(r.name)}">✎</button>` : ''}</span><span>${esc(label('RESOURCE_CATEGORIES', r.category))}</span><span>${esc(r.role)}</span><span>${dots(r.importance)}</span><span class="se-dim">${esc([r.controlledBy ? c.name(r.controlledBy) : '', r.ifCutOff].filter(Boolean).join(' · ')) || '—'}</span>`).join('')}</div>` : empty('No resources written yet.')}
      ${list.some(r => r.role === 'needs' || r.role === 'scarce') ? '' : `<p class="se-dim">Needs and scarce: nothing written yet.</p>`}
      ${card('Items made here · once revealed', items.length ? `<div class="se-row">${items.map(i => chip(i.name)).join('')}</div>` : '<span class="se-dim">None revealed yet.</span>')}
      <div class="se-g3">
        ${ecard('economy.prose', 'Currency', `<span>${esc(c.txt(e.currency)) || '<span class="se-dim">—</span>'}</span>`)}
        ${ecard('economy.prose', 'Labour · wealth gap', `<span>${esc(c.txt(e.labour)) || '—'}</span><span class="se-dim">${esc(c.txt(e.wealthGap))}</span>`)}
        ${ecard('economy.debts', 'Markets · taxes · black market · debts', `<span>${esc(c.txt(e.markets)) || '—'}</span><span class="se-dim">${esc([e.taxes, e.blackMarket, (e.debts || []).map(d => c.name(d.place)).join(', ')].filter(Boolean).join(' · ')) || '—'}</span>`)}
      </div>`;
    return { html, map: { resources: list } };
  }

  function beasts(c) {
    const Si = c.Si, list = c.rec.beasts || [], log = global.EpitaphCreatures;
    const html = `
      ${!list.length ? `<div class="se-banner">No creatures recorded here yet.${log ? '' : ' Ranges, nests and migrations come from the Creature Log, which isn\'t built yet.'}</div>` : list.map(b => card('', `<div class="se-row"><span class="se-hi">${esc(c.name(b.ref))}</span>${chip(label('BEAST_RELATIONS', b.relation), 'red')}</div>
        ${kv([['Wards here', (b.wards || []).map(w => chip(label('WARD_KINDS', w), 'fill')).join('')], ['Incidents', esc((b.incidents || []).map(i => i.text).join(' · '))], ['Beast trade', esc(b.trade)], ['Keepers', esc(b.keepers)], ['Pact', b.pact ? esc(b.pact.terms) : ''], ['Note', esc(c.txt(b.note))]])}`)).join('')}
      ${card('Kinds of ward · the seven', `<div class="se-row">${Si.WARD_KINDS.map(w => chip(w.label, list.some(b => (b.wards || []).includes(w.id)) ? 'fill' : '')).join('')}</div>`)}
      <div class="se-row"><span class="se-lbl">Relations</span>${Si.BEAST_RELATIONS.map(r => chip(r.label, list.some(b => b.relation === r.id) ? 'am' : '')).join('')}</div>`;
    return { html, map: { beasts: list } };
  }

  function intrigue(c) {
    const it = c.rec.intrigue, Si = c.Si;
    const secrets = (it.secrets || []).filter(c.show), rumours = (it.rumours || []).filter(c.show);
    const q = (it.questions || []).filter(c.show), hooks = (it.hooks || []).filter(c.show), fore = (it.foreshadow || []).filter(c.show), sealed = (it.sealed || []).filter(c.show);
    const whatIfs = c.author ? (c.rec.scenarios || []) : [];
    const aboutLinks = refs => (refs || []).map(r => {
      const m = /^(faction|landmark|record|chronicle|resource|tie):/.exec(r);
      const tab = m ? ({ faction: 'domestic', landmark: 'history', record: 'history', chronicle: 'history', resource: 'economy', tie: 'foreign' })[m[1]] : null;
      return tab ? `<button type="button" class="se-link" data-se-tab="${tab}">${esc(ROMAN[S().TABS.indexOf(tab)] + ' › ' + c.name(r))}</button>` : chip(c.name(r));
    }).join('');
    const mine = ref => { const m = /^(secret|question):(?:([\w-]+)\/)?(.+)$/.exec(String(ref || '')); return m && (!m[2] || m[2] === c.pid) ? { kind: m[1], id: m[3] } : null; };
    const jump = (ref, text) => { const m = mine(ref); return m ? `<button type="button" class="se-mk" data-se-focus="${esc(m.kind + ':' + m.id)}">${esc(text || ('◆ ' + c.name(ref)))}</button>` : chip(c.name(ref)); };
    const answers = id => c.author ? (it.questions || []).filter(q => q.answeredBy === 'secret:' + c.pid + '/' + id) : [];
    const reveal = x => c.revealed(x) ? chip('Revealed · Ch ' + x.revealedIn, 'am') : chip('Not revealed · hidden from readers', 'dash');
    if (!c.author && !secrets.length && !rumours.length && !q.length && !hooks.length && !fore.length && !sealed.length) return { html: empty('Nothing here has come to light yet.'), map: { rumours: [] } };
    const html = `
      <div class="se-row">${['Secrets', 'Rumours', 'Questions', 'Hooks', 'Foreshadow', 'Sealed'].map((n, i) => chip(n + ' ' + [secrets, rumours, q, hooks, fore, sealed][i].length)).join('')}${c.author ? chip('What-ifs ' + whatIfs.length) : ''}</div>
      ${secrets.map(s => ecard('intrigue.secrets.' + it.secrets.indexOf(s), '', `<div class="se-row"><span class="se-red">◆</span><span class="se-hi">${esc(s.text)}</span></div>
        ${kv([['About', aboutLinks(s.about)], ['Keepers · why', esc((s.keepers || []).map(k => c.name(k.ref) + (k.why ? ' (' + k.why + ')' : '')).join(', '))],
              ['Discoverable', s.discoverable && s.discoverable.where ? esc(c.name(s.discoverable.where) + (s.discoverable.how ? ' · ' + s.discoverable.how : '')) : ''],
              ['Evidence', c.author ? aboutLinks(s.evidence) : ''], ['Related', c.author ? (s.related || []).map(r => jump(r)).join('') : ''],
              ['Unlocks', c.author ? (s.unlocks || []).map(r => isRefPlace(r) ? `<button type="button" class="se-link" data-ref="${esc(r)}">${esc(c.name(r))}</button>` : chip(c.name(r))).join('') : ''],
              ['Answers', answers(s.id).map(q => `<button type="button" class="se-link" data-se-focus="question:${esc(q.id)}">${esc((q.text || '').slice(0, 48))}</button>`).join('')],
              ['Known by', c.author ? knownByHtml(c, s) : ''], ['Could be found by', c.author ? findersHtml(c, s) : ''],
              ['Setup → payoff', c.author ? chip('setup ' + (s.setup == null ? '—' : 'Ch ' + s.setup), 'dash') + chip('payoff ' + (s.payoff == null ? '—' : 'Ch ' + s.payoff), 'dash') + reveal(s) : '']])}`, 'se-sec', 'secret:' + s.id)).join('')}
      ${rumours.length ? `<div class="se-g2">${rumours.map(r => ecard('intrigue.rumours.' + it.rumours.indexOf(r), '', `<div class="se-row"><span class="se-hi">“${esc(r.text)}”</span>${c.author ? chip(r.truth === 'half' ? 'Half-true' : r.truth === 'true' ? 'True' : 'False', 'am') : ''}</div>
        ${kv([['Origin', esc([c.name(r.origin.where), c.name(r.origin.who), r.origin.when].filter(Boolean).join(' · '))], ['Intent', c.author && r.origin.intent ? chip(label('RUMOUR_INTENTS', r.origin.intent)) : ''],
              ['Spread', esc((r.spread || []).map(x => c.name(x.to)).join(' → '))], ['Distorts', r.aboutSecret ? jump(r.aboutSecret) : ''], ['Effect', esc(r.effect)]])}`, '', 'rumour:' + r.id)).join('')}</div>` : ''}
      ${c.author ? card('Setup → payoff · the same check as the Dossier\'s Checks list', plantHtml(c), plantCls(c)) : ''}
      ${c.author ? `<div class="se-row sw-open"><button type="button" class="se-link" data-se-whatif="${esc(c.pid)}">⚑ Open the what-if board${whatIfs.length ? ' (' + whatIfs.length + ' here)' : ''} ▸</button></div>` : ''}
      ${whatIfs.map(w => ecard('scenarios.' + c.rec.scenarios.indexOf(w), 'What-if', `<div class="se-row"><span class="se-hi">${esc(w.trigger)}</span>${chip(label('TRIGGER_GROUPS', w.triggerKind))}${dots(w.likelihood)}${Number.isInteger(w.impact) ? '<span class="se-dim">impact</span>' + dots(w.impact) : ''}${chip(label('WHATIF_STATUS', w.status) || w.status, 'dash')}</div>
        ${kv([['Causes', (w.causes || []).map(x => chip(x.cause)).join('')], ['Fallout', esc((w.fallout || []).map(x => c.name(x.place) + ': ' + x.what).join(' · '))], ['Warning signs', esc((w.warnings || []).map(x => x.text + (x.plantIn ? ' (Ch ' + x.plantIn + ')' : '')).join(' · ')) || '<span class="se-dim">none planted yet</span>']])}`, 'se-hid')).join('')}
      <div class="se-g2">
        ${ecard('intrigue.questions', 'Questions · hooks', `${q.map(x => `<span data-se-id="question:${esc(x.id)}">${esc(x.text)}${c.author && x.answeredBy ? ' ' + jump(x.answeredBy, '◆ answered') : ''}</span>`).join('')}${hooks.map(x => `<span class="se-dim">Hook${x.for ? ' for ' + esc(c.name(x.for)) : ''}: ${esc(x.text)}</span>`).join('')}` || '<span class="se-dim">—</span>')}
        ${ecard('intrigue.foreshadow', 'Foreshadow · sealed', `${fore.map(x => `<span>${esc(x.text)}</span>`).join('')}${sealed.map(x => `<span class="se-dim">Sealed: ${esc(c.name(x.place))} · ${esc(x.why)}</span>`).join('')}` || '<span class="se-dim">—</span>')}
      </div>`;
    return { html, map: { rumours } };
  }
  /** The setup → payoff card: this place's part of the Checks list (EpitaphSites.plantPayoff). */
  const plantItems = c => c.Si.plantPayoff([c.rec], id => id).map(x => Object.assign({}, x, { text: x.text.replace(/^[^:]*: /, '') }));
  const plantCls = c => plantItems(c).some(x => x.level === 'warn') ? 'se-gun' : '';
  function plantHtml(c) {
    const it = plantItems(c), n = r => it.filter(x => x.rule === r).length;
    if (!it.length) return '<span class="se-dim">Nothing is planted without a payoff, or paid off without a plant, so far. Set a setup or payoff chapter on a secret, foreshadowing or what-if warning sign to track it.</span>';
    return `<div class="se-row">${chip(n('gun-loaded') + ' loaded', n('gun-loaded') ? 'fill' : '')}${chip(n('gun-unplanted') + ' with no setup', n('gun-unplanted') ? 'red' : '')}${chip(n('gun-order') + ' out of order', n('gun-order') ? 'red' : '')}</div>${it.map(x => `<span>${esc(x.text)}</span>`).join('')}`;
  }
  /** "Known by": who carries this secret in their Dossier file and when they learned it (their first chapter that says they know it). */
  function knownByHtml(c, s) {
    const h = c.holders(s.id);
    if (!h.length) return '<span class="se-dim">No character\'s secrets link to this yet (link one in the Dossier\'s Knowledge editor).</span>';
    return h.map(x => chip(x.name + (x.knows != null ? ' · since Ch ' + x.knows : ' · in their file from Ch ' + x.involved + ', doesn\'t know it'), x.knows != null ? 'am' : 'dash')).join('');
  }
  /** "Could be found by": characters who stood where this can be found (its `discoverable.where` is set) before they knew it. A prompt, not a rule. */
  function findersHtml(c, s) {
    if (!(s.discoverable && s.discoverable.where)) return '';
    const f = c.Si.couldFind(c.story(), c.holders(s.id)).slice(0, 6);
    return f.length ? f.map(x => chip(x.name + ' · at Ch ' + x.from, 'teal')).join('') : '<span class="se-dim">Nobody who has been here is missing it.</span>';
  }
  const isRefPlace = r => /^place:/.test(String(r || ''));
  const RENDER = { overview, history, domestic, foreign, economy, beasts, intrigue };

  // ---------------------------------------------------------------- the map
  function mapHtml(tab, c) {
    const z = ZOOM[tab];
    const top = c ? (c.author ? (c.latest || c.at) : c.at) : null;
    const sv = top ? Math.max(1, Math.min(top, cur && cur.spreadCh != null ? cur.spreadCh : top)) : null;
    const slider = tab === 'intrigue' && top ? `<div class="se-slide"><label for="seSl">Chapter</label><input id="seSl" type="range" min="1" max="${top}" value="${sv}" aria-label="Scrub the chapter to see how rumours spread"><output id="seSlO" for="seSl">Ch ${sv}</output></div>` : '';
    return `<div class="se-map" data-zoom="${z}">
      <canvas class="se-cv" tabindex="${z === 'site' ? 0 : -1}" aria-label="${z === 'site' ? 'Founding model. Drag or use the arrow keys to turn it.' : 'Dither map'}"></canvas>
      <svg class="se-svg" aria-hidden="true"></svg><div class="se-pins"></div>
      <div class="se-zoom" aria-hidden="true">${['world', 'region', 'site'].map(k => `<span class="${k === z ? 'on' : ''}">${k.toUpperCase()}</span>`).join('')}</div>
      <div class="se-legend"></div>${slider}
      <p class="se-maploading">Drawing the map…</p>
    </div>`;
  }
  let pinBox = { w: 9999, h: 9999 };
  const pin = (x, y, n, text, cls) => { const room = (text ? String(text).length * 7.6 : 0) + (n != null ? 30 : 0); x = Math.max(4, Math.min(x, pinBox.w - room - 6)); y = Math.max(4, Math.min(y, pinBox.h - 26)); return `<div class="se-pin${cls ? ' ' + cls : ''}" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px">${n != null ? `<i>${esc(n)}</i>` : ''}${text ? `<span>${esc(text)}</span>` : ''}</div>`; };
  const arc = (a, b, colour, dash, w) => { const mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - Math.abs(b[0] - a[0]) * 0.28 - 20; return `<path d="M${a[0].toFixed(1)} ${a[1].toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}" fill="none" stroke="${colour}" stroke-width="${w || 2.2}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`; };
  const around = (cx, cy, r, i, n) => { const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.75]; };

  async function drawMap(c, out) {
    const host = document.querySelector('#bookPanel .se-map'); if (!host) return;
    const cv = host.querySelector('.se-cv'), svg = host.querySelector('.se-svg'), pins = host.querySelector('.se-pins'), legend = host.querySelector('.se-legend');
    try { await D().load(); } catch (e) { host.querySelector('.se-maploading').textContent = 'The map could not load.'; return; }
    if (!host.isConnected) return;
    host.querySelector('.se-maploading').hidden = true;
    const z = host.dataset.zoom, m = out.map || {}, p = c.place, rect = { width: host.clientWidth, height: host.clientHeight };
    svg.setAttribute('viewBox', `0 0 ${rect.width.toFixed(0)} ${rect.height.toFixed(0)}`); svg.setAttribute('width', rect.width); svg.setAttribute('height', rect.height);
    let html = '', paths = '', leg = '';
    pinBox = { w: rect.width, h: rect.height };
    const hasLL = p && typeof p.lat === 'number' && typeof p.lng === 'number';
    if (z === 'site' && !S().hasModel(c.rec)) {          // no founding model for this place: fall back to the region
      host.dataset.zoom = 'region'; host.querySelector('.se-zoom').innerHTML = ['world', 'region', 'site'].map(k => `<span class="${k === 'region' ? 'on' : ''}">${k.toUpperCase()}</span>`).join('');
      return drawMap(c, Object.assign({}, out, { map: Object.assign({}, m, { noModel: true }) }));
    }
    if (z === 'world') {
      const focus = [];
      const llOf = id => { const q = Wd().place(String(id).replace(/^place:/, '')); return q && typeof q.lat === 'number' ? [q.lng, q.lat] : null; };
      if (hasLL) focus.push([p.lng, p.lat]);
      (m.ties || []).forEach(t => focus.push(llOf(t.other))); (m.agentsIn || []).forEach(a => focus.push(llOf(a.from)));
      (m.rumours || []).forEach(r => (r.spread || []).forEach(x => focus.push(llOf(x.to))));
      const pr = D().world(cv, { focus: focus.filter(Boolean) }).project, me = hasLL ? pr(p.lng, p.lat) : null;
      const ll = id => { const q = Wd().place(String(id).replace(/^place:/, '')); return q && typeof q.lat === 'number' ? pr(q.lng, q.lat) : null; };
      if (me) { paths += `<circle cx="${me[0]}" cy="${me[1]}" r="7" fill="var(--amber-hi)"/>`; html += pin(me[0] - 30, me[1] - 32, null, p.name.split(/\s+[—–-]\s+/).pop().toUpperCase(), 'me'); }
      (m.ties || []).forEach(t => { const o = ll(t.other); if (!me || !o) return; paths += arc(me, o, KIND_COL[t.kind] || 'var(--amber)', t.kind === 'covert' ? '2 6' : (t.hidden ? '4 6' : '8 6')); paths += `<circle cx="${o[0]}" cy="${o[1]}" r="5" fill="${KIND_COL[t.kind] || 'var(--amber)'}"/>`; html += pin(o[0] + 8, o[1] + 4, null, c.name('place:' + t.other) + ' · ' + S().label(S().ALLIANCE_KINDS, t.kind), t.hidden ? 'hid' : ''); });
      (m.agentsIn || []).forEach(a => { const o = ll(a.from); if (me && o) paths += arc(o, me, 'var(--ember)', '1 6', 1.6); });
      (m.blocs || []).forEach(b => { const pts = b.members.map(x => ll(x.place)).filter(Boolean); if (pts.length > 1) paths += `<polygon points="${pts.map(q => q.join(',')).join(' ')}" fill="rgba(111,179,163,.08)" stroke="var(--verdigris)" stroke-dasharray="3 5"/>`; });
      const sch = cur && cur.spreadCh != null ? cur.spreadCh : null;        // null = every step (the author's default); a number = the chapter the slider is on
      (m.rumours || []).forEach(r => {
        if (sch != null && r.origin && r.origin.when && !S().reached(r.origin.when, sch)) return;      // not yet started
        const start = r.origin && isRefPlace(r.origin.where) ? ll(r.origin.where) : me;
        if (start) paths += `<circle cx="${start[0]}" cy="${start[1]}" r="15" fill="rgba(212,69,43,.14)" stroke="var(--ember)" stroke-dasharray="3 3"/>`;
        (r.spread || []).forEach(x => { if (sch != null && x.when && !S().reached(x.when, sch)) return; const o = ll(x.to);
          if (start && o) { paths += arc(start, o, 'var(--ember)', '1 6', 2); html += pin(o[0] + 8, o[1] - 18, null, '“' + (r.text || '').slice(0, 34) + '”', 'red'); } });
      });
      leg = m.rumours ? 'how rumours spread from here<br>slide to a chapter' + (c.author ? '<br>author view shows every line' : '') : '<span style="color:var(--verdigris)">- - -</span> alliance · <span style="color:var(--gold)">——</span> trade · <span style="color:var(--ember)">· · ·</span> covert or war<br>ties you haven\'t reached are not drawn';
    } else if (z === 'region') {
      if (!hasLL) { pins.innerHTML = ''; legend.innerHTML = 'This place has no position on the map.'; return; }
      const pr = D().region(cv, p.lng, p.lat).project, me = pr(p.lng, p.lat);
      paths += `<circle cx="${me[0]}" cy="${me[1]}" r="46" fill="none" stroke="var(--amber-hi)" stroke-width="2"/><circle cx="${me[0]}" cy="${me[1]}" r="62" fill="none" stroke="rgba(255,178,56,.25)"/>`;
      html += `<div class="se-pin me" style="left:${(me[0] + 56).toFixed(0)}px;top:${(me[1] - 24).toFixed(0)}px"><span class="big">${esc(p.name.split(/\s+[—–-]\s+/).pop().toUpperCase())}</span></div>`;
      (Wd().places() || []).forEach(q => { if (q.id === p.id || typeof q.lat !== 'number') return; const xy = pr(q.lng, q.lat); if (xy[0] < 0 || xy[1] < 0 || xy[0] > rect.width || xy[1] > rect.height || Math.hypot(xy[0] - me[0], xy[1] - me[1]) < 40) return; const rr = S().get(q.id, c.recs); if (rr && !c.author && !S().placeReached(rr, c.chapter)) return; html += pin(xy[0] - 4, xy[1] - 4, null, q.name.split(/\s+[—–-]\s+/).pop(), 'small'); });
      (m.resources || []).forEach((r, i, a) => { const xy = around(me[0], me[1], 120, i, a.length); html += pin(xy[0] - 13, xy[1] - 13, i + 1, r.name.split(/[:,(]/)[0].slice(0, 22).toUpperCase()); });
      leg = m.resources ? 'numbers match the table<br>dot size = height' : m.beasts ? (global.EpitaphCreatures ? 'ranges from the Creature Log' : 'creature ranges arrive with the Creature Log') : (m.noModel ? 'no founding model for this place<br>(switch one on in its entry)' : 'dot size = height<br>teal = land the sea took');
    } else {
      const draw = () => { const sv = D().site(cv, c.pid, { angle: cur.angle, stage: cur.stage }); return sv; };
      const sv = draw(), [cx, cy] = sv.centre || [0.5, 0.4];
      const list = m.landmarks || (m.factions || []);
      list.forEach((x, i, a) => { const uv = around(cx, cy, 0.26, i, a.length); const xy = sv.project(Math.min(.95, Math.max(.05, uv[0])), Math.min(.95, Math.max(.05, uv[1]))); html += pin(xy[0] - 13, xy[1] - 30, i + 1, (x.name || '').replace(/^the\s+/i, '').split(/\s+(?:and|of|·)\s+/i)[0].slice(0, 20).toUpperCase(), (x.hidden ? 'hid' : '') + (x.sealed ? ' sealed' : '')); });
      if (m.stages) {
        html += `<div class="se-stages" role="group" aria-label="Founding stages">${S().FOUNDING_STAGES.map((s, i) => { const f = m.stages.find(x => x.stage === s.id); const ok = !!f;
          return `<button type="button" class="se-stage${i === cur.stage ? ' on' : ''}${ok ? '' : ' none'}" data-se-stage="${i}" aria-pressed="${i === cur.stage}">${i + 1} ${esc(ok ? s.label : (c.author ? s.label : '? ? ?'))}</button>`; }).join('')}</div>`;
      }
      html += `<div class="se-turn"><button type="button" data-se-turn="-1" aria-label="Turn left">⟲</button><button type="button" data-se-turn="1" aria-label="Turn right">⟳</button></div>`;
      leg = 'FOUNDING MODEL<br>drag to turn';
    }
    svg.innerHTML = paths; pins.innerHTML = html; legend.innerHTML = leg;
    host.dataset.drawn = host.clientWidth + 'x' + host.clientHeight;
  }

  // ---------------------------------------------------------------- mounting in the book
  function inEncyclopedia() { const b = document.getElementById('theBook'); return !!(b && b.dataset.view === 'sites' && document.getElementById('bkSandbox')); }
  function render() {
    if (!cur || !inEncyclopedia()) return false;
    const Si = S(), c = context(cur.placeId), tab = cur.tab, out = RENDER[tab](c);
    const sb = document.getElementById('bkSandbox');
    let layer = document.getElementById('seEntry');
    if (!layer) { layer = document.createElement('div'); layer.id = 'seEntry'; layer.className = 'se-entry'; sb.appendChild(layer); }
    const idx = document.getElementById('bkSites'); if (idx) idx.hidden = true;
    const short = c.place.name.split(/\s+[—–-]\s+/).pop();
    const kind = (c.rec.domestic.government.stance || c.place.group || '').toString();
    const html = out.html;
    layer.innerHTML = `
      <nav class="se-rail" aria-label="Entry tabs">${Si.TABS.map((t, i) => `<button type="button" class="se-tab${t === tab ? ' on' : ''}" data-se-tab="${t}" aria-pressed="${t === tab}">${ROMAN[i]} ${esc(Si.TAB_LABEL[t])}</button>`).join('')}</nav>
      <div class="se-main">
        <div class="se-hd">
          <button type="button" class="se-back" data-se-back aria-label="Back to all places">◂ All places</button>
          <div class="se-ttl"><b>${esc(short.toUpperCase())}${tab === 'overview' ? '' : ' · ' + esc(Si.TAB_LABEL[tab].toUpperCase())}</b><small>${esc([kind, (Wd().country(c.place.countryId) || {}).name, c.author ? 'author view' : (c.chapter == null ? 'reader · latest chapter' : 'reader · Ch ' + c.chapter)].filter(Boolean).join(' · ').toUpperCase())}</small></div>
          ${c.author && c.rec.draft[tab] ? '<span class="se-chip dash">Draft</span>' : ''}
        </div>
        <div class="se-body" tabindex="0">${html}</div>
      </div>`;
    if (c.author && global.EpitaphSiteEdit) global.EpitaphSiteEdit.decorate(layer, c, cur);
    // the map, in the right page's panel
    const panel = document.getElementById('bookPanel');
    if (panel) {
      panel.hidden = false; panel.classList.add('se-panel');
      panel.innerHTML = mapHtml(tab, c);
      drawMap(c, out);
      if (ro) ro.disconnect();
      let t = 0; ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => { if (cur && document.querySelector('#bookPanel .se-map')) drawMap(context(cur.placeId), RENDER[cur.tab](context(cur.placeId))); }, 120); });
      ro.observe(panel);
      clearInterval(sizeTimer);
      sizeTimer = setInterval(() => { const h = document.querySelector('#bookPanel .se-map'); if (!cur || !h) { clearInterval(sizeTimer); return; } if (h.dataset.drawn && h.dataset.drawn !== h.clientWidth + 'x' + h.clientHeight) drawMap(context(cur.placeId), RENDER[cur.tab](context(cur.placeId))); }, 700);
    }
    if (cur.focus) {
      const el = layer.querySelector(`[data-se-id="${CSS.escape(cur.focus)}"]`);
      if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); }
      cur.focus = null;
    }
    return true;
  }
  function close() {
    cur = null;
    const layer = document.getElementById('seEntry'); if (layer) layer.remove();
    const idx = document.getElementById('bkSites'); if (idx) { idx.hidden = false; const q = idx.querySelector('#siQ'); if (q) q.focus(); }
    const panel = document.getElementById('bookPanel'); if (panel && panel.classList.contains('se-panel')) { panel.innerHTML = ''; panel.classList.remove('se-panel'); }
    if (ro) { ro.disconnect(); ro = null; }
    clearInterval(sizeTimer);
  }
  function open(placeId, tab) {
    if (!S() || !inEncyclopedia()) return false;
    cur = { placeId, tab: S().TABS.includes(tab) ? tab : 'overview', angle: 0.6, stage: 6, focus: null, spreadCh: null };
    return render();
  }

  // ---------------------------------------------------------------- events (delegated, so they survive redraws)
  if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
      const t = e.target && e.target.closest ? e.target : null; if (!t || !cur) return;
      const tabBtn = t.closest('[data-se-tab]'); if (tabBtn && t.closest('#seEntry')) { if (global.EpitaphSiteEdit && tabBtn.dataset.seTab !== cur.tab) global.EpitaphSiteEdit.cancel(cur.placeId); cur.tab = tabBtn.dataset.seTab; render(); return; }
      if (t.closest('[data-se-back]')) { close(); return; }
      const f = t.closest('[data-se-focus]'); if (f) { cur.tab = 'intrigue'; cur.focus = f.dataset.seFocus; render(); return; }
      const st = t.closest('[data-se-stage]'); if (st) { cur.stage = +st.dataset.seStage; document.querySelectorAll('[data-se-stage]').forEach(b => { const on = +b.dataset.seStage === cur.stage; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); if (st.closest('#seEntry') && cur.tab !== 'history') { cur.tab = 'history'; render(); return; } drawMap(context(cur.placeId), RENDER[cur.tab](context(cur.placeId))); return; }
      const tu = t.closest('[data-se-turn]'); if (tu) { cur.angle += (+tu.dataset.seTurn) * 0.35; drawMap(context(cur.placeId), RENDER[cur.tab](context(cur.placeId))); }
    });
    document.addEventListener('input', e => {
      const t = e.target; if (!cur || !t || t.id !== 'seSl') return;
      cur.spreadCh = +t.value; const o = document.getElementById('seSlO'); if (o) o.textContent = 'Ch ' + t.value;
      const c = context(cur.placeId); drawMap(c, RENDER[cur.tab](c));
    });
    let drag = null;
    document.addEventListener('pointerdown', e => { const cv = e.target.closest && e.target.closest('#bookPanel .se-map[data-zoom="site"] .se-cv'); if (cv && cur) { drag = { x: e.clientX, a: cur.angle }; cv.setPointerCapture(e.pointerId); } });
    document.addEventListener('pointermove', e => { if (!drag || !cur) return; cur.angle = drag.a + (e.clientX - drag.x) * 0.01; const host = document.querySelector('#bookPanel .se-map'); if (host) { cancelAnimationFrame(drag.raf); drag.raf = requestAnimationFrame(() => drawMap(context(cur.placeId), RENDER[cur.tab](context(cur.placeId)))); } });
    document.addEventListener('pointerup', () => { drag = null; });
    document.addEventListener('keydown', e => {
      if (!cur || !document.getElementById('seEntry')) return;
      if ((global.EpitaphSiteWeb && global.EpitaphSiteWeb.isOpen()) || (global.EpitaphSiteWhatIf && global.EpitaphSiteWhatIf.isOpen())) return;   // the ring or the what-if board is on top; it handles its own keys
      if (e.key === 'Escape' && global.EpitaphSiteEdit && global.EpitaphSiteEdit.hasPending(cur.placeId)) { global.EpitaphSiteEdit.cancel(cur.placeId); render(); e.stopPropagation(); e.preventDefault(); return; }
      if (e.key === 'Escape' && !(e.target.closest && e.target.closest('input,textarea,select'))) { close(); e.stopPropagation(); return; }
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target.closest && e.target.closest('.se-cv')) { cur.angle += (e.key === 'ArrowLeft' ? -0.2 : 0.2); drawMap(context(cur.placeId), RENDER[cur.tab](context(cur.placeId))); e.preventDefault(); }
    }, true);
    // leaving the encyclopedia (another book page, or closing the book) ends the entry
    const watch = () => { const b = document.getElementById('theBook'); if (!b) return; new MutationObserver(() => { if (cur && !inEncyclopedia()) { cur = null; if (ro) { ro.disconnect(); ro = null; } } }).observe(b, { attributes: true, attributeFilter: ['data-view'] }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
    // redraw when the reader's chapter or the author/reader view changes
    const T = TL(); if (T && T.onReaderChange) T.onReaderChange(() => { if (cur) render(); });
  }

  // place:<id> links open here while the book shows the encyclopedia; elsewhere they keep their old behaviour (the map)
  if (global.EpitaphLinks) global.EpitaphLinks.register('place', id => open(id));

  // ---- the Dossier side: pick an encyclopedia secret for a character's secret, and label the link ----
  /** Every encyclopedia secret, as { ref, place, text } (the author's picker). */
  function secretOptions() {
    const Si = S(), W = Wd(); if (!Si) return [];
    const out = [];
    Si.load().forEach(r => (r.intrigue.secrets || []).forEach(x => out.push({ ref: 'secret:' + r.placeId + '/' + x.id, place: shortName((W && W.place(r.placeId) || {}).name || r.placeId), text: x.text || x.id })));
    return out;
  }
  /** { place, text } for a `secret:<place>/<id>` ref, or null when it no longer exists. */
  function secretLabel(ref) { return secretOptions().find(o => o.ref === ref) || null; }
  const pickShort = t => String(t || '').length > 70 ? String(t).slice(0, 69) + '…' : String(t || '');
  /** The picker under the Dossier's secrets box: sets the fourth column of the line the cursor is on. */
  function secretPickerHtml(prefix) {
    const opts = secretOptions(); if (!opts.length) return '';
    return `<div class="field"><label for="${esc(prefix)}SecLink">Link the secret you are on to the Site Encyclopedia</label>
      <select id="${esc(prefix)}SecLink" data-sec-link="${esc(prefix)}"><option value="">Pick an encyclopedia secret…</option>${opts.map(o => `<option value="${esc(o.ref)}">${esc(o.place + ' · ' + pickShort(o.text))}</option>`).join('')}<option value="__none">(remove the link)</option></select></div>`;
  }
  if (typeof document !== 'undefined') document.addEventListener('change', e => {
    const sel = e.target && e.target.matches && e.target.matches('select[data-sec-link]') ? e.target : null; if (!sel || !sel.value) return;
    const ta = document.getElementById(sel.dataset.secLink + 'Secrets'); if (!ta) return;
    const lines = ta.value.split('\n'); const pos = ta.selectionStart || 0; let at = 0, acc = 0;
    for (let i = 0; i < lines.length; i++) { if (pos <= acc + lines[i].length) { at = i; break; } acc += lines[i].length + 1; at = i; }
    const parts = lines[at].split('|').map(x => x.trim()); while (parts.length < 3) parts.push(parts.length === 1 ? 'yes' : '');
    parts[3] = sel.value === '__none' ? '' : sel.value;
    lines[at] = (parts[3] ? parts : parts.slice(0, 3)).join(' | ');
    ta.value = lines.join('\n'); sel.value = ''; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus();
  });

  global.EpitaphSiteEntry = { open, close, render, context, current: () => cur, setTab: t => { if (cur) { cur.tab = t; render(); } }, ZOOM, secretOptions, secretLabel, secretPickerHtml, _render: RENDER };
})(typeof window !== 'undefined' ? window : globalThis);
