/* Epitaph — the Creature Log view (opcl). Plan steps 1.7 and 5.1/5.2 (the editor, moved up so the user can add creatures first).
 *
 * EpitaphCreatureUI.mountIndex(container, { focus }) draws the log in the book, author only (a reader gets a polite note until the
 * discovery rules arrive with the tree). Three tabs:
 *   Creatures  lineage steps, creatures and creatures of chaos, grouped under their ancestors; click one to edit it in place
 *   Biomes     the environments, with how many places each holds
 *   Places     the infected places (search, filter by biome, "curse not written yet"); each has an optional curse
 * Everything is edited in place with pickers (parent, when, cause, biomes, curses from the Library, places); "Approved" turns a draft
 * into the user's own. Records live in EpitaphCreatures (storage, merge, checks); curses are Library marks (opmk).
 * EpitaphLinks 'creature' links open here (step 1.7).
 */
(function (global) {
  'use strict';
  const C = () => global.EpitaphCreatures, TL = () => global.EpitaphTimeline, Lib = () => global.EpitaphLibrary, W = () => global.EpitaphWorld;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const REGIONS = [['plains', 'Plains'], ['hills', 'Hills'], ['mountains', 'Mountains'], ['ice', 'Ice'], ['pit', 'The crater'], ['rim', 'Impact mountains'], ['coast', 'Coast'], ['drowned', 'Sunken land'], ['underwater', 'Open sea']];
  const KIND_LABEL = { creatures: 'Creature', nodes: 'Lineage step', chaos: 'Chaos' };
  const TABS = [['tree', 'Tree'], ['creatures', 'Creatures'], ['biomes', 'Biomes'], ['places', 'Places']];
  const PAGE = 120;
  let ui = null;          // { page ({ id, sec } while a creature's page is open), pageH, tab, q, biome, drafts, noCurse, open: { kind, id } | null, shown, sel (the tree's picked form), tree (its handle) }

  const author = () => { const T = TL(); return T ? T.authorMode() : true; };
  const cursesInLibrary = () => { try { return ((Lib() && Lib().get().marks) || []).filter(m => m.kind === 'curse'); } catch (e) { return []; } };
  const label = (set, id) => (set.find(x => x.id === id) || {}).label || id;

  // ---------------------------------------------------------------- choices
  const whenValue = w => (w == null || w === '' ? '' : typeof w === 'string' ? (C().AGE_IDS.includes(w) ? 'age:' + w : (C().EPOCHS.some(e => e.id === w) ? 'epoch:' + w : 'event:' + w)) : w.age ? 'age:' + w.age : w.epoch ? 'epoch:' + w.epoch : '');
  const whenFrom = v => (!v ? null : v.startsWith('age:') ? { age: v.slice(4) } : v.startsWith('epoch:') ? { epoch: v.slice(6) } : v.slice(6));
  const whenText = w => { const v = whenValue(w); if (!v) return ''; const k = v.slice(v.indexOf(':') + 1);
    if (v.startsWith('age:')) return 'Age ' + k + ' · ' + label(C().AGES, k); if (v.startsWith('epoch:')) return label(C().EPOCHS, k); const e = TL() && TL().byId(k); return e ? String(e.title).slice(0, 40) : k; };
  function whenOptions(none) {
    const T = TL(), ev = T ? T.load().slice().sort((a, b) => T.compare(a, b)) : [];
    return [['', none || '— unknown —']].concat(C().EPOCHS.map(e => ['epoch:' + e.id, 'Epoch · ' + e.label]), C().AGES.map(a => ['age:' + a.id, 'Age ' + a.id + ' · ' + a.label]),
      ev.map(e => ['event:' + e.id, 'Event · ' + String(e.title).slice(0, 60)]));
  }
  function causeOptions() {
    const T = TL(), ev = T ? T.load().slice().sort((a, b) => T.compare(a, b)) : [];
    return [['', '— none yet —']].concat(C().EPOCHS.map(e => [e.id, 'Epoch · ' + e.label]), C().AGES.map(a => [a.id, 'Age ' + a.id + ' · ' + a.label]), ev.map(e => [e.id, 'Event · ' + String(e.title).slice(0, 60)]));
  }
  const parentOptions = self => [['', '— none (a root) —']].concat([].concat(C().load().nodes, C().load().creatures).filter(x => x.id !== self).map(x => [x.id, x.name || x.id]));
  const biomeOptions = () => C().load().biomes.map(b => [b.id, b.name]);
  const curseOptions = () => [['', '— none —']].concat(cursesInLibrary().map(m => [m.id, m.name || m.id]));
  const placeOptions = () => [['', '— none —']].concat(((W() && W().places()) || []).filter(p => p.fictional || p.group).map(p => [p.id, String(p.name).split(/\s+[—–-]\s+/).pop()]));
  const sinceOptions = () => [['', '— unknown —']].concat(C().AGES.map(a => [a.id, 'Age ' + a.id + ' · ' + a.label]));

  // ---------------------------------------------------------------- the form (declarative)
  const f = {
    text: (k, l, o) => Object.assign({ t: 'text', k, l }, o), area: (k, l, o) => Object.assign({ t: 'area', k, l }, o), sel: (k, l, opts, o) => Object.assign({ t: 'sel', k, l, opts }, o),
    dots: (k, l, scale) => ({ t: 'dots', k, l, scale }), checks: (k, l, opts) => ({ t: 'checks', k, l, opts }), rows: (k, l, fields) => ({ t: 'rows', k, l, fields }), num: (k, l, o) => Object.assign({ t: 'num', k, l }, o),
    lines: (k, l) => ({ t: 'lines', k, l }), bool: (k, l) => ({ t: 'bool', k, l })
  };
  const gp = (o, p) => String(p).split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
  function specFor(kind, rec) {
    const hold = [f.bool('hidden', 'Hidden from readers'), f.num('revealedIn', 'Reveal in Ch', { min: 1 })];
    const lineage = [f.text('name', 'Name'), f.sel('parentId', 'Descends from', parentOptions(rec.id)), f.sel('when', 'Appears', whenOptions(), { when: true }), f.sel('extinct', 'Extinct from', whenOptions('— still living —'), { when: true }),
      f.sel('cause', 'Cause of the change', causeOptions()), f.area('mutation.change', 'What changed'), f.area('mutation.advantage', 'What it gained'), f.sel('mutation.curse', 'Curse that came with it (Library)', curseOptions()),
      f.checks('biomes', 'Biomes', biomeOptions())];
    if (kind === 'nodes') return lineage.concat(hold);
    if (kind === 'creatures') return lineage.concat([f.dots('awareness', 'Awareness', 'awareness'), f.dots('threat', 'Threat to people', 'threat'), f.dots('size', 'Size', 'size'),
      f.rows('curses', 'Curses it carries (written in the Library, opmk)', [f.sel('libId', 'Curse', curseOptions()), f.sel('stage', 'Stage', [['0', 'Initial'], ['1', 'Stage 1 · Awakening'], ['2', 'Stage 2 · Fluctuation'], ['3', 'Stage 3 · Stabilization']], { int: true })]),
      f.rows('traits', 'Traits (what its body can do; creatures get no skills)', [f.text('name', 'Trait'), f.text('does', 'What it does'), f.text('counters', 'What counters it')]),
      f.rows('anatomy.parts', 'Anatomy', [f.text('name', 'Part'), f.text('note', 'Note')]), f.lines('nests', 'Where it nests (only cursed creatures nest)'),
      f.text('diet', 'Diet'), f.text('hunting', 'Hunting'), f.text('breeding', 'Breeding'),
      f.rows('names', 'What settlements call it', [f.sel('placeId', 'Place', placeOptions()), f.text('localName', 'Local name'), f.text('belief', 'What they believe')]),
      f.rows('sightings', 'Sightings', [f.num('chapter', 'Chapter', { min: 1 }), f.sel('placeId', 'Place', placeOptions()), f.text('note', 'Note')]),
      f.rows('fieldNotes', 'Field notes', [f.text('author', 'Author'), f.text('text', 'Note')]), f.lines('range.places', 'Range: places'), { t: 'eats', k: '__eats', l: 'Eats (creatures in the log)' }]).concat(hold);
    if (kind === 'chaos') return [f.text('name', 'Name'), f.rows('forms', 'Forms it takes', [f.sel('biome', 'Biome', biomeOptions()), f.text('looks', 'Looks like')]),
      f.rows('sightings', 'Sightings', [f.num('chapter', 'Chapter', { min: 1 }), f.sel('placeId', 'Place', placeOptions()), f.text('note', 'Note')]), f.text('curseLink', 'Tied to curses (how?)')].concat(hold);
    if (kind === 'biomes') return [f.text('name', 'Name'), f.area('desc', 'What it is'), f.checks('regions', 'Map regions it covers', REGIONS), f.bool('placeBound', 'Tied to particular places'), f.text('spread', 'How its curses spread'), f.sel('since', 'Cursed since', sinceOptions())];
    return [f.text('name', 'Name'), f.sel('biome', 'Biome', biomeOptions()), f.text('country', 'Country'), f.text('continent', 'Continent'), f.sel('since', 'Cursed since', sinceOptions()),
      { t: 'curse', k: 'curse', l: 'Curse (written in the Library, opmk): leave empty until the story needs it' }, f.area('notes', 'Notes'), f.sel('sitePlaceId', 'Encyclopedia place', placeOptions())];
  }
  const selHtml = (opts, val, extra) => `<select${extra || ''}>${opts.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(val == null ? '' : val) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const dotsHtml = (k, scale, n) => { const S = C().SCALES[scale]; return `<div class="cl-dots" data-f="${esc(k)}" data-t="dots" data-v="${n || 0}" role="group" aria-label="${esc(S.label)}">${[1, 2, 3, 4, 5, 6, 7].map(i => `<button type="button" class="cl-dot${i <= (n || 0) ? ' on' : ''}" data-dv="${i}" title="${i} · ${esc(S.steps[i - 1])}" aria-label="${i} of 7, ${esc(S.steps[i - 1])}"></button>`).join('')}<span class="cl-dn">${n ? esc(S.steps[n - 1]) : 'not set'}</span><button type="button" class="cl-clr" data-dv="0" title="Clear">×</button></div>`; };
  function fieldHtml(s, val, rec) {
    const cls = 'cl-f' + (['area', 'checks', 'rows', 'lines', 'eats', 'curse'].includes(s.t) ? ' wide' : ''), lab = `<span class="cl-fl">${esc(s.l)}</span>`;
    let inner;
    switch (s.t) {
      case 'text': inner = `<input type="text" data-f="${esc(s.k)}" data-t="text" value="${esc(val)}">`; break;
      case 'num': inner = `<input type="number" data-f="${esc(s.k)}" data-t="num" min="${s.min || 0}" value="${val == null ? '' : esc(val)}">`; break;
      case 'area': inner = `<textarea data-f="${esc(s.k)}" data-t="text" rows="3">${esc(val)}</textarea>`; break;
      case 'lines': inner = `<textarea data-f="${esc(s.k)}" data-t="lines" rows="2" placeholder="one per line">${esc((Array.isArray(val) ? val : []).join('\n'))}</textarea>`; break;
      case 'bool': inner = `<label class="cl-chk"><input type="checkbox" data-f="${esc(s.k)}" data-t="bool"${val ? ' checked' : ''}> yes</label>`; break;
      case 'sel': inner = selHtml(s.opts, s.when ? whenValue(val) : val, ` data-f="${esc(s.k)}" data-t="${s.when ? 'when' : 'sel'}"`); break;
      case 'dots': inner = dotsHtml(s.k, s.scale, val); break;
      case 'checks': inner = `<div class="cl-checks" data-f="${esc(s.k)}" data-t="checks">${s.opts.map(([v, t]) => `<label class="cl-chk"><input type="checkbox" value="${esc(v)}"${(val || []).includes(v) ? ' checked' : ''}> ${esc(t)}</label>`).join('') || '<span class="cl-dim">none yet</span>'}</div>`; break;
      case 'rows': { const arr = Array.isArray(val) ? val : [], row = r => `<div class="cl-row" data-row>${s.fields.map(g => `<label class="cl-rf"><span>${esc(g.l)}</span>${g.t === 'sel' ? selHtml(g.opts, gp(r || {}, g.k) == null ? '' : gp(r || {}, g.k), ` data-rf="${esc(g.k)}" data-int="${g.int ? 1 : ''}"`) : `<input type="${g.t === 'num' ? 'number' : 'text'}" data-rf="${esc(g.k)}" data-num="${g.t === 'num' ? 1 : ''}" value="${esc(gp(r || {}, g.k) == null ? '' : gp(r || {}, g.k))}">`}</label>`).join('')}<button type="button" class="cl-x" data-rowdel aria-label="Remove this row">×</button></div>`;
        inner = `<div class="cl-rows" data-f="${esc(s.k)}" data-t="rows" data-tpl="${esc(row({}))}">${arr.map(row).join('')}<button type="button" class="cl-add" data-rowadd>+ add</button></div>`; break; }
      case 'eats': { const all = [].concat(C().load().creatures, C().load().nodes).filter(x => x.id !== rec.id), mine = C().load().food.filter(l => l.eater === rec.id).map(l => l.eaten);
        inner = `<div class="cl-checks" data-f="__eats" data-t="checks">${all.map(x => `<label class="cl-chk"><input type="checkbox" value="${esc(x.id)}"${mine.includes(x.id) ? ' checked' : ''}> ${esc(x.name || x.id)}</label>`).join('') || '<span class="cl-dim">no other creatures yet</span>'}</div>`; break; }
      case 'curse': { const c = val || {}; inner = `<div class="cl-curse" data-f="curse" data-t="curse">${selHtml(curseOptions(), c.libId || '', ' data-cf="libId"')}${selHtml([['0', 'Initial'], ['1', 'Stage 1 · Awakening'], ['2', 'Stage 2 · Fluctuation'], ['3', 'Stage 3 · Stabilization']], c.stage || 0, ' data-cf="stage"')}</div>`; break; }
      default: inner = '';
    }
    return `<div class="${cls}">${lab}${inner}</div>`;
  }
  /** Links into the Site Encyclopedia (step 6.1): a creature lists the places whose Beasts tab names it; a place links to its own entry.
   *  Read-only; a link opens the entry in the book (index.html's [data-open-entry]). */
  function encyclopediaBlock(kind, rec) {
    const S = global.EpitaphSites; if (!S || !rec.id) return '';
    const name = id => { const p = W() && W().place(id); return p ? String(p.name).split(/\s+[—–-]\s+/).pop() : id; };
    const link = id => `<button type="button" class="cl-chip cl-link" data-open-entry="${esc(id)}" title="Open ${esc(name(id))} in the Site Encyclopedia">${esc(name(id))} ▸</button>`;
    if (kind === 'creatures' || kind === 'nodes') {
      const ps = S.creaturePlaces ? S.creaturePlaces(rec.id) : [];
      if (!ps.length) return '<div class="cl-enc"><span class="cl-fl">In the Site Encyclopedia</span><span class="cl-dim">No place\'s Beasts tab names this creature yet.</span></div>';
      return `<div class="cl-enc"><span class="cl-fl">In the Site Encyclopedia: places whose Beasts tab names it</span>${ps.map(x => link(x.placeId) + (x.relation ? `<span class="cl-dim">${esc(label(S.BEAST_RELATIONS, x.relation).toLowerCase())}</span>` : '')).join(' ')}</div>`;
    }
    if (kind === 'places' && rec.sitePlaceId && S.get(rec.sitePlaceId)) return `<div class="cl-enc"><span class="cl-fl">In the Site Encyclopedia</span>${link(rec.sitePlaceId)}</div>`;
    return '';
  }
  function formHtml(kind, rec, isNew) {
    const spec = specFor(kind, rec), approved = rec.draft === false;
    return `<form class="cl-form" data-kind="${kind}" data-id="${esc(rec.id || '')}" data-new="${isNew ? 1 : ''}" novalidate>
      <div class="cl-grid">${spec.map(s => fieldHtml(s, s.k === '__eats' ? null : (s.t === 'sel' && s.when ? gp(rec, s.k) : gp(rec, s.k)), rec)).join('')}</div>
      ${encyclopediaBlock(kind, rec)}
      <div class="cl-actions"><label class="cl-chk"><input type="checkbox" data-approved${approved ? ' checked' : ''}> Approved (I wrote or accept it; not a draft)</label>
        <span class="cl-sp"></span><span class="cl-err" role="alert"></span>
        ${isNew ? '' : '<button type="button" class="cl-del" data-del>Delete</button>'}<button type="button" class="cl-cancel" data-cancel>Cancel</button><button type="submit" class="cl-save">Save</button></div></form>`;
  }
  // ---- reading a form back
  function readRows(el) { return [...el.querySelectorAll(':scope > [data-row]')].map(r => { const o = {}; r.querySelectorAll('[data-rf]').forEach(i => { let v = i.value; if (i.dataset.num) v = v === '' ? null : parseInt(v, 10); else if (i.dataset.int) v = parseInt(v, 10) || 0; setp(o, i.dataset.rf, v); }); return o; }).filter(o => Object.values(o).some(v => !(v === '' || v == null || v === 0))); }
  function setp(o, path, v) { const ks = String(path).split('.'); let x = o; ks.slice(0, -1).forEach(k => { x = x[k] = x[k] || {}; }); x[ks[ks.length - 1]] = v; }
  function readForm(form, base) {
    const rec = JSON.parse(JSON.stringify(base)); let eats = null;
    form.querySelectorAll('[data-f]').forEach(el => {
      const k = el.dataset.f, t = el.dataset.t; let v;
      if (t === 'text') v = el.value; else if (t === 'num') v = el.value === '' ? null : parseInt(el.value, 10); else if (t === 'bool') v = el.checked;
      else if (t === 'lines') v = el.value.split('\n').map(x => x.trim()).filter(Boolean); else if (t === 'sel') v = el.value || null; else if (t === 'when') v = whenFrom(el.value);
      else if (t === 'dots') v = parseInt(el.dataset.v, 10) || null; else if (t === 'checks') v = [...el.querySelectorAll('input:checked')].map(i => i.value);
      else if (t === 'rows') v = readRows(el); else if (t === 'curse') { const id = el.querySelector('[data-cf="libId"]').value; v = id ? { libId: id, stage: parseInt(el.querySelector('[data-cf="stage"]').value, 10) || 0 } : null; }
      if (k === '__eats') { eats = v; return; }
      if (t === 'rows' && k === 'curses') v = v.filter(r => r.libId).map(r => ({ libId: r.libId, stage: r.stage || 0 }));
      setp(rec, k, v);
    });
    const ap = form.querySelector('[data-approved]'); rec.draft = !(ap && ap.checked);
    return { rec, eats };
  }
  const blank = kind => ({ id: '', name: '', draft: true, awareness: null, threat: null, size: null, biomes: [], regions: [], mutation: { change: '', advantage: '', curse: null }, anatomy: { parts: [] }, range: { biomes: [], places: [] } });

  // ---------------------------------------------------------------- lists
  const matches = (x, q) => !q || [x.name, x.id, x.country, x.continent, x.notes, x.desc, x.biome, x.mutation && x.mutation.change].join(' ').toLowerCase().includes(q.toLowerCase());
  function chips(x, kind) {
    const cn = C().load(), c = [];
    if (kind === 'creatures') { if (C().isConscious(x)) c.push('<span class="cl-chip hot" title="Awareness 5 or more: its curses re-cycle quickly">conscious</span>'); (x.curses || []).forEach(k => c.push(`<span class="cl-chip">⛓ ${esc((cursesInLibrary().find(m => m.id === k.libId) || {}).name || k.libId)}${k.stage ? ' · ' + k.stage : ''}</span>`)); }
    if (kind !== 'biomes' && x.extinct) c.push('<span class="cl-chip dim">extinct</span>');
    if (kind === 'places') c.push(x.curse ? `<span class="cl-chip">⛓ ${esc((cursesInLibrary().find(m => m.id === x.curse.libId) || {}).name || x.curse.libId)}</span>` : '<span class="cl-chip dim">curse not written yet</span>');
    if (x.example) c.push('<span class="cl-chip dim">example</span>'); if (x.draft) c.push('<span class="cl-chip dim">draft</span>'); if (x.hidden) c.push('<span class="cl-chip dim">hidden</span>');
    return c.join('');
  }
  function row(x, kind, depth) {
    const open = ui.open && ui.open.id === x.id && ui.open.kind === kind;
    const sub = kind === 'places' ? [x.country, x.continent, x.ground && x.ground.state].filter(Boolean).join(' · ') : kind === 'biomes' ? `${C().load().places.filter(p => p.biome === x.id).length} places` : whenText(x.when);
    return `<li class="cl-item${open ? ' open' : ''}" data-open="${esc(kind + ':' + x.id)}" id="cl-${esc(kind)}-${esc(x.id)}"><div class="cl-head" style="padding-left:${10 + (depth || 0) * 18}px">
      <button type="button" class="cl-title" data-toggle aria-expanded="${open}">${kind === 'creatures' || kind === 'nodes' || kind === 'chaos' ? `<i class="cl-k ${kind}" title="${KIND_LABEL[kind] || ''}">${kind === 'creatures' ? '●' : kind === 'nodes' ? '○' : '∞'}</i>` : ''}<b>${esc(x.name || x.id)}</b><span class="cl-sub">${esc(sub)}</span></button><span class="cl-chips">${chips(x, kind)}</span></div>
      ${open ? formHtml(kind, x, false) : ''}</li>`;
  }
  function creatureRows() {
    const st = C().load(), all = [].concat(st.creatures.map(x => ['creatures', x]), st.nodes.map(x => ['nodes', x]), st.chaos.map(x => ['chaos', x])).filter(([k, x]) => matches(x, ui.q) && (!ui.drafts || x.draft));
    const ids = new Set(all.map(([, x]) => x.id)), by = new Map(all.map(([k, x]) => [x.id, [k, x]])), kids = new Map();
    all.forEach(([k, x]) => { const p = x.parentId && ids.has(x.parentId) ? x.parentId : ''; if (!kids.has(p)) kids.set(p, []); kids.get(p).push([k, x]); });
    const order = (a, b) => (C().timeIndex(a[1].when) ?? 99) - (C().timeIndex(b[1].when) ?? 99) || String(a[1].name).localeCompare(String(b[1].name));
    const out = []; const walk = (p, d) => (kids.get(p) || []).sort(order).forEach(([k, x]) => { out.push(row(x, k, d)); walk(x.id, d + 1); });
    walk('', 0); return out;
  }
  /** The Tree tab (step 2.1): the Tree of Descent on the left page; the picked form's range on the map. */
  function renderTree(host, st) {
    const n = st.nodes.length + st.creatures.length + st.chaos.length;
    host.innerHTML = `<div class="cl">
      <div class="cl-bar">${tabsHtml(st)}<span class="cl-sp"></span><button type="button" class="cl-new" data-new="nodes">+ Lineage step</button><button type="button" class="cl-new" data-new="creatures">+ Creature</button></div>
      <p class="cl-note">Oldest at the top; each band is an epoch, then Epitaph's ages A–G (red: the curse cycle). Pick a form to see where it lives.${n ? '' : ' <b>The log is empty.</b> Merge the Creature Log file from your vault (Dossier → Data → Merge) or add your own.'}</p>
      ${ui.open && ui.open.isNew ? `<div class="cl-item open new"><div class="cl-head"><b>New ${esc((KIND_LABEL[ui.open.kind] || ui.open.kind).toLowerCase())}</b></div>${formHtml(ui.open.kind, blank(ui.open.kind), true)}</div>` : ''}
      <div class="cl-tree"></div></div>`;
    const T = global.EpitaphCreatureTree, box = host.querySelector('.cl-tree');
    if (!T) { box.innerHTML = '<p class="cl-note">The tree did not load.</p>'; return; }
    ui.tree = T.mount(box, { colourBy: ui.colourBy, sel: ui.sel, onSelect: id => { ui.sel = id; drawMap(); } });
  }
  const tabsHtml = st => `<div class="cl-tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${ui.tab === k}" class="${ui.tab === k ? 'on' : ''}">${l}<b>${k === 'tree' ? st.nodes.length + st.creatures.length : st[k].length + (k === 'creatures' ? st.nodes.length + st.chaos.length : 0)}</b></button>`).join('')}</div>`;
  // ---- the creature page (Phase 3): the field journal, with the map following the section being read
  function renderPage(host) {
    if (ui.pageH) { ui.pageH.destroy(); ui.pageH = null; } if (ui.tree) { ui.tree.destroy(); ui.tree = null; }
    const P = global.EpitaphCreaturePage; if (!P) { host.innerHTML = '<p class="cl-note">The creature page did not load.</p>'; return; }
    ui.pageH = P.mount(host, { st: ui.reader ? gated() : C().load(), id: ui.page.id, reader: !!ui.reader, onBack: closePage, onOpen: openPage, onSection: i => { if (ui && ui.page) { ui.page.sec = i; drawSec(); } },
      onEdit: (kind, id) => { ui.page = null; ui.tab = 'creatures'; ui.open = { kind, id }; ui.scrollTo = ui.open; render(ui.host); drawMap(); } });
  }
  function openPage(id) { if (!ui) return; ui.page = { id, sec: 0 }; ui.sel = id; ui.reader ? ui.redraw() : render(ui.host); drawMap(); }
  function closePage() { if (!ui) return; ui.page = null; ui.reader ? ui.redraw() : render(ui.host); drawMap(); }
  function drawSec() {
    const box = document.querySelector('.cp-here'); if (!box || !ui || !ui.page) return; const P = global.EpitaphCreaturePage, i = ui.page.sec;
    box.innerHTML = `<span class="cp-hl">YOU ARE AT</span><b>${i + 1} · ${esc(P.SECTIONS[i])}</b><span class="cp-nums">${P.SECTIONS.map((x, k) => `<button type="button" data-go="${k}" class="${k === i ? 'on' : ''}" aria-label="${k + 1}, ${esc(x)}"${k === i ? ' aria-current="true"' : ''}>${k + 1}</button>`).join('')}</span>`;
    box.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { if (ui && ui.pageH) ui.pageH.goto(+b.dataset.go); }));
  }
  function render(host) {
    if (ui.pageH) { ui.pageH.destroy(); ui.pageH = null; }
    if (ui.page) return renderPage(host);
    if (ui.tree) { ui.tree.destroy(); ui.tree = null; }
    const st = C().load(), q = ui.q;
    if (ui.tab === 'tree') return renderTree(host, st);
    let list = '', count = 0;
    if (ui.tab === 'creatures') { const r = creatureRows(); count = r.length; list = r.join(''); }
    else if (ui.tab === 'biomes') { const r = st.biomes.filter(x => matches(x, q) && (!ui.drafts || x.draft)); count = r.length; list = r.map(x => row(x, 'biomes', 0)).join(''); }
    else { const r = st.places.filter(x => matches(x, q) && (!ui.biome || x.biome === ui.biome) && (!ui.drafts || x.draft) && (!ui.noCurse || !x.curse)); count = r.length; list = r.slice(0, ui.shown).map(x => row(x, 'places', 0)).join('') + (r.length > ui.shown ? `<li class="cl-more"><button type="button" data-more>Show ${Math.min(PAGE, r.length - ui.shown)} more (${r.length - ui.shown} left)</button></li>` : ''); }
    const adds = { creatures: [['creatures', '+ Creature'], ['nodes', '+ Lineage step'], ['chaos', '+ Chaos form']], biomes: [['biomes', '+ Biome']], places: [['places', '+ Place']] }[ui.tab];
    const empty = !st.creatures.length && !st.nodes.length && !st.chaos.length && !st.biomes.length && !st.places.length;
    host.innerHTML = `<div class="cl">
      <div class="cl-bar">${tabsHtml(st)}
        <input type="search" id="clQ" placeholder="search…" value="${esc(q)}" aria-label="Search">
        ${ui.tab === 'places' ? `<select id="clBiome" aria-label="Biome">${selHtml([['', 'Every biome']].concat(biomeOptions()), ui.biome).replace(/^<select>|<\/select>$/g, '')}</select><label class="cl-chk"><input type="checkbox" id="clNoCurse"${ui.noCurse ? ' checked' : ''}> curse not written</label>` : ''}
        <label class="cl-chk"><input type="checkbox" id="clDrafts"${ui.drafts ? ' checked' : ''}> drafts only</label>
        <span class="cl-sp"></span>${adds.map(([k, l]) => `<button type="button" class="cl-new" data-new="${k}">${l}</button>`).join('')}</div>
      <p class="cl-note">${count} shown · author only · curses are written in the Library (<b>opmk</b>); a place or creature holds one.${empty ? ' <b>The log is empty.</b> Merge the Creature Log file from your vault (Dossier → Data → Merge) or add your own.' : ''}</p>
      ${ui.open && ui.open.isNew ? `<div class="cl-item open new"><div class="cl-head"><b>New ${esc((KIND_LABEL[ui.open.kind] || ui.open.kind).toLowerCase())}</b></div>${formHtml(ui.open.kind, blank(ui.open.kind), true)}</div>` : ''}
      <ul class="cl-list">${list || '<li class="cl-empty">Nothing here.</li>'}</ul></div>`;
    if (ui.scrollTo) { const el = host.querySelector('#' + CSS.escape('cl-' + ui.scrollTo.kind + '-' + ui.scrollTo.id)); if (el) el.scrollIntoView({ block: 'center' }); ui.scrollTo = null; }
  }

  // ---------------------------------------------------------------- the world map on the right page
  async function drawMap() {
    const panel = document.getElementById('bookPanel'), D = global.EpitaphDither; if (!panel || !D || !ui) return;
    panel.hidden = false; panel.classList.add('se-panel');
    panel.innerHTML = '<div class="cl-map"><canvas class="se-cv" aria-label="Dither map of the infected places"></canvas><svg class="se-svg" aria-hidden="true"></svg><div class="se-legend"></div></div>';
    try { await D.load(); } catch (e) { return; }
    const host = panel.querySelector('.cl-map'); if (!host || !host.isConnected) return;
    if (!host.clientWidth || !host.clientHeight) { if ((drawMap.tries = (drawMap.tries || 0) + 1) < 12) setTimeout(drawMap, 120); return; }      // the page is still settling (a phone stacks it)
    drawMap.tries = 0;
    const cv = host.querySelector('.se-cv'), svg = host.querySelector('.se-svg'), w = host.clientWidth, h = host.clientHeight, st = ui.reader ? gated() : C().load();
    const pr = D.world(cv, {}).project; svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', w); svg.setAttribute('height', h);
    if (ui.tab === 'tree' || ui.page) return drawRange(host, svg, pr, st);
    const sel = ui.open && ui.open.kind === 'places' ? ui.open.id : null;
    const pts = st.places.filter(p => Number.isFinite(p.lon) && Number.isFinite(p.lat) && (!ui.biome || p.biome === ui.biome));
    svg.innerHTML = pts.map(p => { const [x, y] = pr(p.lon, p.lat); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${p.id === sel ? 7 : 3.2}" fill="${p.curse ? 'var(--ember)' : 'none'}" stroke="${p.id === sel ? 'var(--amber-hi)' : 'var(--amber)'}" stroke-width="${p.id === sel ? 2.5 : 1}"/>`; }).join('');
    host.querySelector('.se-legend').innerHTML = `${pts.length} places${ui.biome ? ' in ' + esc((st.biomes.find(b => b.id === ui.biome) || {}).name || '') : ''}<br><span style="color:var(--ember)">●</span> curse written · <span style="color:var(--amber)">○</span> not yet`;
  }

  /** The tree's picked form on the map: the infected places in its biomes (or named in its range) lit, the rest faint; the
   *  settlements that have a name for it in teal; a card with its time, change and curse, and Edit. */
  const gatedById = (st, id) => { for (const k of ['creatures', 'nodes', 'chaos']) { const x = st[k].find(q => q.id === id && !q.silhouette); if (x) return Object.assign({}, x, { kind: k }); } return null; };
  function drawRange(host, svg, pr, st) {
    const selId = ui.page ? ui.page.id : ui.sel, r = selId && (ui.reader ? gatedById(st, selId) : C().byId(selId)), rec = r || null, leg = host.querySelector('.se-legend');
    const bio = new Set(rec ? [].concat(rec.biomes || [], (rec.range && rec.range.biomes) || [], (rec.forms || []).map(f => f.biome)) : []);
    const named = new Set(rec && rec.range ? rec.range.places || [] : []);
    const lit = p => rec && (bio.has(p.biome) || named.has(p.id) || named.has(p.name));
    const pts = st.places.filter(p => Number.isFinite(p.lon) && Number.isFinite(p.lat)), on = pts.filter(lit);
    const dot = (p, b) => { const [x, y] = pr(p.lon, p.lat); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${b ? 5 : 2.4}" fill="${b ? 'var(--amber)' : 'none'}" stroke="${b ? 'var(--amber-hi)' : 'var(--amber-dim)'}" stroke-width="${b ? 1.5 : 1}" opacity="${b ? 1 : 0.55}"/>`; };
    const wp = id => { const p = W() && W().place(id); return p && Number.isFinite(p.lat) && Number.isFinite(p.lng) ? p : null; };
    const towns = rec && rec.names ? rec.names.filter(x => x.placeId && wp(x.placeId)) : [];
    svg.innerHTML = pts.filter(p => !lit(p)).map(p => dot(p, false)).join('') + on.map(p => dot(p, true)).join('') +
      towns.map(x => { const p = wp(x.placeId), [px, py] = pr(p.lng, p.lat); return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5" fill="var(--verdigris)"/><text x="${(px + 8).toFixed(1)}" y="${(py + 4).toFixed(1)}" fill="var(--verdigris)" font-family="VT323,monospace" font-size="15">${esc(String(p.name).split(/\s+[—–-]\s+/).pop())}${x.localName ? ' · “' + esc(x.localName) + '”' : ''}</text>`; }).join('');
    if (!rec) { leg.innerHTML = 'Pick a form on the tree to see where it lives.<br><span style="color:var(--amber-dim)">○</span> infected places'; return; }
    const curse = ui.reader ? (rec.mutation && rec.mutation.curse ? 'cursed' : '') : rec.mutation && rec.mutation.curse ? (cursesInLibrary().find(m => m.id === rec.mutation.curse) || {}).name || rec.mutation.curse : '';
    const carried = ui.reader ? [] : (rec.curses || []).map(k => ((cursesInLibrary().find(m => m.id === k.libId) || {}).name || k.libId) + (k.stage ? ' · ' + k.stage : ''));
    const bnames = [...bio].map(b => (st.biomes.find(x => x.id === b) || {}).name || b).filter(Boolean);
    leg.innerHTML = '';
    if (ui.page) { const hb = document.createElement('div'); hb.className = 'cp-here'; host.appendChild(hb); drawSec(); leg.innerHTML = `${on.length} infected place${on.length === 1 ? '' : 's'} in range${towns.length ? ' · <span style="color:var(--verdigris)">●</span> settlements that name it' : ''}`; return; }
    const card = document.createElement('div'); card.className = 'cl-card';
    card.innerHTML = `<b>${esc(rec.name || rec.id)}</b><span class="cl-dim">${esc(KIND_LABEL[r.kind] || '')}${rec.when ? ' · ' + esc(whenText(rec.when)) : ''}${rec.extinct ? ' · extinct from ' + esc(whenText(rec.extinct)) : ''}</span>
      ${rec.mutation && rec.mutation.change ? `<p>${esc(rec.mutation.change)}</p>` : ''}${rec.mutation && rec.mutation.advantage ? `<p class="cl-dim">Gained: ${esc(rec.mutation.advantage)}</p>` : ''}
      ${curse || carried.length ? `<p class="cl-hot">⛓ ${esc([curse].concat(carried).filter(Boolean).join(' · '))}</p>` : ''}
      <span class="cl-dim">${bnames.length ? esc(bnames.join(' · ')) + ' · ' : ''}${on.length || !ui.reader ? on.length + ' infected place' + (on.length === 1 ? '' : 's') + ' in range' : ''}${towns.length ? ' · <span style="color:var(--verdigris)">●</span> settlements that name it' : ''}</span>
      ${r.kind === 'chaos' ? '' : '<button type="button" class="cl-new" data-page>Open page ▸</button> '}${ui.reader ? '' : '<button type="button" class="cl-new" data-edit>Edit ▸</button>'}`;
    const pb = card.querySelector('[data-page]'); if (pb) pb.addEventListener('click', () => openPage(rec.id));
    const eb = card.querySelector('[data-edit]'); if (eb) eb.addEventListener('click', () => { if (!ui || !ui.host) return; ui.tab = 'creatures'; ui.open = { kind: r.kind, id: rec.id }; ui.scrollTo = ui.open; render(ui.host); drawMap(); });
    host.appendChild(card);
  }

  // ---------------------------------------------------------------- the reader's view (step 2.4)
  const readerChapter = () => { const T = TL(); if (!T) return null; const r = T.readerChapter(); return r == null ? T.latestChapter() : r; };
  const gated = () => C().forReader(C().load(), readerChapter(), { eventOk: id => { const T = TL(), e = T && T.byId && T.byId(id); return !!(e && T.isRevealed(e, readerChapter())); } });
  /** A reader sees the tree only: forms their chapter has revealed, "? ? ?" for what comes next, and no editor. */
  function mountReader(container, opts) {
    ui = { tab: 'tree', reader: true, sel: null, tree: null, colourBy: 'biome', host: container, page: null, pageH: null };
    const focus = opts && opts.focus; const draw = () => { if (ui.pageH) { ui.pageH.destroy(); ui.pageH = null; } if (ui.tree) { ui.tree.destroy(); ui.tree = null; }
      if (ui.page) return renderPage(container);
      container.innerHTML = '<div class="cl"><p class="cl-note">What has been found of the creatures of Epitaph, as far as you have read. Pick a form to see where it lives.</p><div class="cl-tree"></div></div>';
      const T = global.EpitaphCreatureTree, box = container.querySelector('.cl-tree'); if (!T) { box.innerHTML = '<p class="cl-note">The tree did not load.</p>'; return; }
      ui.tree = T.mount(box, { colourBy: ui.colourBy, sel: ui.sel, reader: { chapter: readerChapter() }, onSelect: id => { ui.sel = id; drawMap(); } }); drawMap(); };
    if (focus) { const g = gated(); if (g.nodes.concat(g.creatures).some(x => x.id === focus && !x.silhouette)) { ui.sel = focus; ui.page = { id: focus, sec: 0 }; } }
    ui.redraw = draw; draw();
    const off = TL() && TL().onReaderChange ? TL().onReaderChange(() => { if (ui) { ui.sel = null; ui.page = null; draw(); } }) : null;
    return () => { if (off) off(); if (ui && ui.tree) ui.tree.destroy(); if (ui && ui.pageH) ui.pageH.destroy(); ui = null; const p = document.getElementById('bookPanel'); if (p && p.classList.contains('se-panel')) { p.innerHTML = ''; p.classList.remove('se-panel'); } };
  }

  // ---------------------------------------------------------------- mounting and events
  function mountIndex(container, opts) {
    if (!C()) { container.innerHTML = '<p class="cl-note">The Creature Log data did not load.</p>'; return () => {}; }
    if (!author()) return mountReader(container, opts);
    ui = { tab: 'tree', q: '', biome: '', drafts: false, noCurse: false, open: null, shown: PAGE, scrollTo: null, sel: null, tree: null, colourBy: 'biome', host: container, page: null, pageH: null };
    const focus = opts && opts.focus && C().byId(opts.focus);
    if (focus) { ui.sel = focus.id; if (focus.kind !== 'chaos') ui.page = { id: focus.id, sec: 0 }; }          // a creature link opens its page
    render(container); drawMap();
    const on = (ev, fn) => { container.addEventListener(ev, fn); return () => container.removeEventListener(ev, fn); };
    const offs = [];
    offs.push(on('click', e => {
      const t = e.target; if (!t.closest) return;
      const by = t.closest('[data-by]'); if (by) { ui.colourBy = by.dataset.by; return; }
      const tab = t.closest('[data-tab]'); if (tab) { ui.tab = tab.dataset.tab; ui.open = null; ui.shown = PAGE; ui.q = ''; ui.noCurse = false; render(container); drawMap(); return; }       // each tab starts clean
      const tg = t.closest('[data-toggle]'); if (tg) { const [kind, id] = tg.closest('[data-open]').dataset.open.split(/:(.*)/s); ui.open = ui.open && ui.open.id === id && ui.open.kind === kind ? null : { kind, id }; render(container); drawMap(); return; }
      const nw = t.closest('[data-new]'); if (nw && nw.classList.contains('cl-new')) { ui.open = { kind: nw.dataset.new, id: '', isNew: true }; render(container); const nm = container.querySelector('.cl-item.new input[data-f="name"]'); if (nm) nm.focus(); return; }
      if (t.closest('[data-more]')) { ui.shown += PAGE; render(container); return; }
      if (t.closest('[data-cancel]')) { ui.open = null; render(container); drawMap(); return; }
      const dv = t.closest('[data-dv]'); if (dv) { const box = dv.closest('.cl-dots'); const v = +dv.dataset.dv; box.dataset.v = v; box.querySelectorAll('.cl-dot').forEach((b, i) => b.classList.toggle('on', i < v)); const S = C().SCALES[box.dataset.f]; box.querySelector('.cl-dn').textContent = v ? S.steps[v - 1] : 'not set'; return; }
      const ra = t.closest('[data-rowadd]'); if (ra) { ra.insertAdjacentHTML('beforebegin', ra.closest('[data-tpl]').dataset.tpl); return; }
      const rd = t.closest('[data-rowdel]'); if (rd) { rd.closest('[data-row]').remove(); return; }
      const del = t.closest('[data-del]'); if (del) {
        if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = 'Really delete?'; return; }
        const form = del.closest('form'); C().remove(form.dataset.kind, form.dataset.id); C().putFood(C().load().food.filter(l => l.eater !== form.dataset.id && l.eaten !== form.dataset.id)); ui.open = null; render(container); drawMap();
      }
    }));
    offs.push(on('submit', e => {
      e.preventDefault(); const form = e.target, kind = form.dataset.kind, isNew = form.dataset.new === '1';
      const base = isNew ? blank(kind) : (C().load()[kind].find(x => x.id === form.dataset.id) || blank(kind)), { rec, eats } = readForm(form, base);
      const err = form.querySelector('.cl-err');
      if (!String(rec.name || '').trim()) { err.textContent = 'Give it a name first.'; return; }
      if (isNew) rec.id = C().uid(rec.name);
      if (kind === 'creatures' || kind === 'nodes') { if (rec.parentId === rec.id) rec.parentId = null; }
      if (!C().put(kind, rec)) { err.textContent = 'Could not save: the browser\'s storage may be full. Export a backup first.'; return; }
      if (eats) { const keep = C().load().food.filter(l => l.eater !== rec.id), old = C().load().food.filter(l => l.eater === rec.id); C().putFood(keep.concat(eats.map(id => old.find(l => l.eaten === id) || { eater: rec.id, eaten: id, when: null }))); }
      if (ui.tab === 'tree') ui.sel = rec.id;
      ui.open = null; render(container); drawMap();
    }));
    offs.push(on('input', e => { const t = e.target; if (t.id === 'clQ') { ui.q = t.value; ui.shown = PAGE; const pos = t.selectionStart; render(container); const n = container.querySelector('#clQ'); n.focus(); n.setSelectionRange(pos, pos); } }));
    offs.push(on('change', e => { const t = e.target; if (t.id === 'clDrafts') ui.drafts = t.checked; else if (t.id === 'clNoCurse') ui.noCurse = t.checked; else if (t.id === 'clBiome') { ui.biome = t.value; ui.shown = PAGE; drawMap(); } else return; render(container); }));
    return () => { offs.forEach(o => o()); if (ui && ui.tree) ui.tree.destroy(); if (ui && ui.pageH) ui.pageH.destroy(); ui = null; const p = document.getElementById('bookPanel'); if (p && p.classList.contains('se-panel')) { p.innerHTML = ''; p.classList.remove('se-panel'); } };
  }

  // a `creature:<id>` link opens the log on that creature (step 1.7)
  if (global.EpitaphLinks) global.EpitaphLinks.register('creature', id => {
    const r = C() && C().byId(id); if (!r || !global.EpitaphBook || !global.EpitaphBook.openCreatures) return false;
    global.EpitaphBook.openCreatures(r.id); return true;
  });

  global.EpitaphCreatureUI = { mountIndex, _t: { specFor, readForm, whenValue, whenFrom, whenText } };
})(typeof window !== 'undefined' ? window : globalThis);
