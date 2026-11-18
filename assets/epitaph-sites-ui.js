/* Epitaph — Site Encyclopedia pages (opse). Step 2.1: the index.
 *
 * EpitaphSitesUI.renderIndex(container) draws every place grouped by faction (Storyborn · Voided · Fallen · Other),
 * with filters (era, region, form of rule, status) and a search that also finds places by what they hold:
 * ruler, ally, resource, beast ("who trades salt"). Everything shown follows the reader's chapter
 * (EpitaphTimeline): a place the reader hasn't reached isn't listed at all, and an alliance they haven't reached isn't
 * listed or searched. In Author view (the default in the author's browser) everything is listed, and what a reader
 * wouldn't see yet is marked "Hidden from readers"; the toggle in the tool bar previews the Reader view.
 * Clicking a place opens it through EpitaphLinks (the entry view, step 2.2, will register itself there).
 */
(function (global) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const GROUPS = [
    { id: 'storyborn', label: 'Storyborn' }, { id: 'voided', label: 'Voided' }, { id: 'fallen', label: 'Fallen' }, { id: 'other', label: 'Cities & others' }
  ];
  const filters = { q: '', era: '', continent: '', form: '', status: '' };

  const Sites = () => global.EpitaphSites, World = () => global.EpitaphWorld, TL = () => global.EpitaphTimeline;

  function factionOf(place, rec) {
    const k = String((rec && rec.rule && rec.rule.stance) || place.group || '').toLowerCase();
    return GROUPS.some(g => g.id === k) ? k : 'other';
  }

  /** One row of data per place, with only what a reader on `chapter` may see. */
  function rows(chapter, author) {
    const S = Sites(), W = World();
    const recs = S.load(), byId = {};
    recs.forEach(r => { byId[r.placeId] = r; });
    const name = id => { const p = W.place(id); return p ? p.name : id; };
    const placeIds = new Set(W.places().map(p => p.id));
    const list = W.places().map(p => ({ place: p, rec: byId[p.id] || null }));
    recs.forEach(r => { if (!placeIds.has(r.placeId)) list.push({ place: { id: r.placeId, name: r.placeId, eras: ['ERA_1'] }, rec: r }); });
    return list.filter(({ place, rec }) => author || S.placeReached(rec, chapter)).map(({ place, rec }) => {
      const reachedByReader = S.placeReached(rec, chapter);
      // a reader sees the state they've reached; the author also gets the first state of a place readers haven't reached
      const state = rec ? (S.stateAt(rec, chapter) || (author && rec.states[0]) || null) : null;
      const allies = rec ? S.alliancesAt(place.id, chapter, recs, author) : [];
      const visible = rec && state;
      const words = [place.name, (W.continent(place.continentId) || {}).name, (W.country(place.countryId) || {}).name];
      if (visible) {
        words.push(state.note, state.status, S.label(S.STATUS, state.status), S.label(S.FORMS, rec.rule.form), rec.rule.stance, rec.rule.outsiders);
        rec.rule.holders.forEach(h => { if (S.reached(h.from, chapter)) words.push(String(h.ref).replace(/^char:/, ''), h.title); });
        (rec.rule.laws || []).forEach(l => words.push(l));
        allies.forEach(a => words.push(name(a.other), a.kind, S.label(S.ALLIANCE_KINDS, a.kind), a.note));
        rec.resources.forEach(x => words.push(x.name, S.label(S.RESOURCE_CATEGORIES, x.category), x.role));
        rec.beasts.forEach(b => words.push(String(b.ref).replace(/^creature:/, ''), b.relation));
        rec.founding.forEach(f => { if (S.reached(f.when, chapter)) words.push(f.change, f.why, f.materials, f.reused); });
      }
      const safe = author ? (t => t) : (t => S.clean(t, chapter, recs, false));   // a reader's search never sees text that names a place they haven't reached
      return { place, rec, state: visible ? state : null, allies, hidden: !!rec && !reachedByReader, faction: factionOf(place, visible ? rec : null), words: ' ' + words.filter(Boolean).map(safe).join(' ').toLowerCase().replace(/[^a-z0-9\u00c0-\u024f]+/g, ' ') };
    });
  }

  // "who trades salt" -> trade, salt: filler words go, a trailing s goes, so a plural finds the singular
  const STOP = new Set(['who', 'what', 'which', 'where', 'the', 'is', 'are', 'in', 'of', 'a', 'an', 'and', 'with', 'for', 'to', 'has', 'have', 'uses', 'use']);
  const tokens = q => q.toLowerCase().split(/[\s,]+/).filter(t => t && !STOP.has(t)).map(t => t.length > 3 ? t.replace(/s$/, '') : t);

  function pass(r) {
    if (filters.era && !(r.place.eras || []).includes(filters.era)) return false;
    if (filters.continent && r.place.continentId !== filters.continent) return false;
    if (filters.form && !(r.state && r.rec.rule.form === filters.form)) return false;
    if (filters.status && !(r.state && r.state.status === filters.status)) return false;
    const toks = tokens(filters.q);
    return toks.every(t => r.words.includes(' ' + t));        // a word that starts with it, so "val" doesn't find "valley"
  }

  const opt = (items, val, any) => `<option value="">${esc(any)}</option>` + items.map(i => `<option value="${esc(i.id)}"${i.id === val ? ' selected' : ''}>${esc(i.label || i.name)}</option>`).join('');

  function renderIndex(container) {
    const S = Sites(), W = World(), T = TL();
    if (!S || !W) { container.innerHTML = '<p class="bk-si-empty">The Site Encyclopedia data did not load.</p>'; return; }
    const chapter = T ? T.readerChapter() : null;
    const author = T ? T.authorMode() : true;
    const all = rows(chapter, author), shown = all.filter(pass);
    const withEntry = all.filter(r => r.state).length;
    const readerText = chapter == null ? 'the latest chapter' : 'Ch ' + chapter;
    const hiddenCount = all.filter(r => r.hidden).length;
    const place = r => {
      const st = r.state, rule = st ? S.label(S.FORMS, r.rec.rule.form) : '';
      const sz = st ? S.step('size', st.scales.size) : '';
      return `<li><button type="button" class="bk-si-row" data-ref="place:${esc(r.place.id)}">
        <b>${esc(r.place.name)}</b>
        ${st ? `<span class="bk-si-status bk-si-${esc(st.status)}">${esc(S.label(S.STATUS, st.status))}</span>` : '<span class="bk-si-status bk-si-none">No entry yet</span>'}${r.hidden ? '<span class="bk-si-status bk-si-hidden" title="Readers have not reached this place yet">Hidden from readers</span>' : ''}
        <small>${st ? `${esc(rule)} · ${esc(sz)}${r.allies.length ? ` · ${r.allies.length} tie${r.allies.length === 1 ? '' : 's'}` : ''}${r.rec.draft && Object.values(r.rec.draft).some(Boolean) ? ' · draft' : ''}` : esc((W.country(r.place.countryId) || {}).name || '')}</small>
      </button></li>`;
    };
    const sections = GROUPS.map(g => {
      const mine = shown.filter(r => r.faction === g.id).sort((a, b) => (b.state ? 1 : 0) - (a.state ? 1 : 0) || a.place.name.localeCompare(b.place.name));
      return mine.length ? `<section class="bk-si-group"><h3>${esc(g.label)} <span>${mine.length}</span></h3><ul>${mine.map(place).join('')}</ul></section>` : '';
    }).join('');
    container.innerHTML = `
      <div class="bk-si">
        <div class="bk-si-tools">
          <input type="search" id="siQ" class="bk-filter" placeholder="search: a name, a ruler, who trades salt…" value="${esc(filters.q)}" aria-label="Search places">
          <select id="siEra" aria-label="Era">${opt([{ id: 'ERA_0', label: 'Era 0' }, { id: 'ERA_1', label: 'Era 1' }], filters.era, 'Any era')}</select>
          <select id="siContinent" aria-label="Region">${opt(W.continents(), filters.continent, 'Any region')}</select>
          <select id="siForm" aria-label="Form of rule">${opt(S.FORMS, filters.form, 'Any rule')}</select>
          <select id="siStatus" aria-label="Status">${opt(S.STATUS, filters.status, 'Any status')}</select>
          ${T ? `<button type="button" class="slant-btn${author ? ' primary' : ''}" id="siMode" aria-pressed="${author}" title="${author ? 'You see everything. Click to preview what readers see.' : 'You see what a reader at this chapter sees. Click to see everything.'}">${author ? 'Author view' : 'Reader view'}</button>` : ''}
        </div>
        <p class="bk-si-note">${shown.length} of ${all.length} places · ${withEntry} with an entry · ${author ? `Author view${hiddenCount ? `, ${hiddenCount} hidden from readers at ${esc(readerText)}` : ''}` : `reader at ${esc(readerText)}`}</p>
        ${sections || '<p class="bk-si-empty">Nothing matches. Clear a filter or the search.</p>'}
      </div>`;
    const again = () => { const keep = container.querySelector('.bk-si'); const top = keep ? keep.scrollTop : 0; renderIndex(container); const n = container.querySelector('.bk-si'); if (n) n.scrollTop = top; };
    const bind = (id, key) => { const el = container.querySelector('#' + id); el.addEventListener('change', () => { filters[key] = el.value; again(); }); };
    const mode = container.querySelector('#siMode'); if (mode) mode.addEventListener('click', () => T.setAuthorMode(!author));   // the change event redraws every open view
    bind('siEra', 'era'); bind('siContinent', 'continent'); bind('siForm', 'form'); bind('siStatus', 'status');
    const q = container.querySelector('#siQ');
    q.addEventListener('input', () => { filters.q = q.value; const pos = q.selectionStart; again(); const n = container.querySelector('#siQ'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  /** Draw the index into `container` and keep it in step with the reader's chapter. Returns a stop function. */
  function mountIndex(container) {
    renderIndex(container);
    const T = TL();
    let off = () => {};
    off = T ? T.onReaderChange(() => { if (container.isConnected) renderIndex(container); else off(); }) : off;
    return () => off();
  }

  global.EpitaphSitesUI = { filters, tokens, rows, pass, renderIndex, mountIndex, factionOf };
})(typeof window !== 'undefined' ? window : globalThis);
