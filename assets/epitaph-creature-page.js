/* Epitaph — the creature page, "the field journal" (Creature Log Phase 3; layout AA, picked 2026-11-23).
 *
 * One scroll with the plan's seven sections in order: 1 Lineage · 2 Mutations · 3 Anatomy · 4 Abilities · 5 Range & movements ·
 * 6 Behaviour & lore · 7 Field notes. The map on the right page follows the section being read (the view tells it which, through
 * onSection) and the view can jump to one (goto). Built from a *store*, so a reader's page is made from the gated copy
 * (EpitaphCreatures.forReader) and never sees what the gate removed.
 *
 *   EpitaphCreaturePage.model(st, id)            → { rec, kind, chain, branches, mutations } or null   (pure, tested in Node)
 *   EpitaphCreaturePage.mount(host, opts)        → { goto(i), destroy() }
 *       opts: { st, id, reader, onBack, onSection(i), onOpen(id), onEdit(kind, id) }
 *
 * Done here: 3.1 Lineage (every form from the root, side by side, with the branches that split off), 3.2 Mutations (each change in
 * order: what changed, its cause, what it gained), 3.4 Abilities (traits and what counters them), 3.5 Range & movements (biomes,
 * places, nests, sightings by chapter; the map is the view's), 3.6 Behaviour & lore (diet, hunting, breeding, what each settlement
 * calls it). Anatomy (3.3, the drawing) and Field notes (3.7, written in character voices) show what is written and say so when empty.
 */
(function (global) {
  'use strict';
  const C = () => global.EpitaphCreatures, TL = () => global.EpitaphTimeline, W = () => global.EpitaphWorld;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SECTIONS = ['Lineage', 'Mutations', 'Anatomy', 'Abilities', 'Range & movements', 'Behaviour & lore', 'Field notes'];

  // ---------------------------------------------------------------- time and cause as words
  function whenLbl(w) {
    const K = C(); if (w == null || w === '') return '';
    if (typeof w === 'object') { if (w.age) return 'Age ' + w.age + ' · ' + ((K.AGES.find(a => a.id === w.age) || {}).label || ''); if (w.epoch) return (K.EPOCHS.find(e => e.id === w.epoch) || {}).label || w.epoch; return ''; }
    return causeLbl(w);
  }
  function causeLbl(c) {
    const K = C(); if (!c) return '';
    const a = K.AGES.find(x => x.id === c); if (a) return 'Age ' + a.id + ' · ' + a.label;
    const e = K.EPOCHS.find(x => x.id === c); if (e) return e.label;
    const ev = TL() && TL().byId && TL().byId(c); return ev ? String(ev.title).split(/[:;]/)[0].slice(0, 70) : c;
  }

  // ---------------------------------------------------------------- the model (pure)
  /** Everything the page shows that comes from the tree: the line of forms from the root to this one (oldest first), the branches
   *  that split off each of them (shown beside, not in, the line), and the changes in order. A silhouette ("? ? ?") in a
   *  reader's line stays a silhouette: no name, no change. */
  function model(st, id) {
    const all = [].concat((st.nodes || []).map(x => ['nodes', x]), (st.creatures || []).map(x => ['creatures', x]));
    const by = new Map(all.map(([k, x]) => [x.id, { kind: k, rec: x }])), me = by.get(id); if (!me || me.rec.silhouette) return null;
    const chain = [], seen = new Set(); let cur = me;
    while (cur && !seen.has(cur.rec.id)) { seen.add(cur.rec.id); chain.unshift(cur); cur = cur.rec.parentId ? by.get(cur.rec.parentId) : null; }
    const kids = new Map(); all.forEach(([k, x]) => { if (x.parentId && by.has(x.parentId)) { if (!kids.has(x.parentId)) kids.set(x.parentId, []); kids.get(x.parentId).push(by.get(x.id)); } });
    const t = x => C().timeIndex(x.when) ?? 99, ord = (a, b) => t(a.rec) - t(b.rec) || String(a.rec.name).localeCompare(String(b.rec.name));
    const onLine = new Set(chain.map(c => c.rec.id));
    const form = c => ({ id: c.rec.id, kind: c.kind, name: c.rec.name || '', sil: !!c.rec.silhouette, when: c.rec.when, extinct: c.rec.extinct, cursed: !!(c.rec.mutation && c.rec.mutation.curse), change: (c.rec.mutation && c.rec.mutation.change) || '', gain: (c.rec.mutation && c.rec.mutation.advantage) || '', cause: c.rec.cause || null, current: c.rec.id === id });
    const lineage = chain.map(c => Object.assign(form(c), { branches: (kids.get(c.rec.id) || []).filter(k => !onLine.has(k.rec.id)).sort(ord).map(form) }));
    const mutations = lineage.filter(f => !f.sil && (f.change || f.gain || f.cause)).map(f => ({ id: f.id, name: f.name, when: f.when, change: f.change, gain: f.gain, cause: f.cause, cursed: f.cursed, current: f.current }));
    return { rec: me.rec, kind: me.kind, lineage, mutations, root: chain[0] ? chain[0].rec.root || '' : '' };
  }

  // ---------------------------------------------------------------- drawing
  const dots = (n, label, steps) => `<span class="cp-dots" title="${esc(label)}${n ? ': ' + n + ' · ' + esc(steps[n - 1]) : ''}" role="img" aria-label="${esc(label)} ${n || 0} of 7${n ? ', ' + esc(steps[n - 1]) : ''}">${[1, 2, 3, 4, 5, 6, 7].map(i => `<i class="${i <= (n || 0) ? 'on' : ''}"></i>`).join('')}</span>`;
  const charName = id => { try { const st = JSON.parse(localStorage.getItem('epitaph-character-profiles') || 'null'); const c = ((st && st.characters) || []).find(x => x.id === id); return c ? c.name || id : null; } catch (e) { return null; } };
  const charLink = id => { const n = charName(id); return n ? `<button type="button" class="cp-chip" data-ref="char:${esc(id)}" title="Open ${esc(n)} in the Dossier">${esc(n)} ▸</button>` : ''; };
  const itemName = id => { try { const it = ((global.EpitaphLibrary && global.EpitaphLibrary.get().items) || []).find(x => x.id === id); return it ? it.name || id : null; } catch (e) { return null; } };
  const place = id => { const p = W() && W().place(id); return p ? { id, name: String(p.name).split(/\s+[—–-]\s+/).pop() } : null; };
  function formCard(f, mode) {
    if (f.sil) return `<div class="cp-form sil" aria-label="A form not yet discovered"><span class="cp-t">${esc(whenLbl(f.when))}</span><b>? ? ?</b></div>`;
    const head = `<span class="cp-t">${esc(whenLbl(f.when))}${f.cursed ? ' · ⛓' : ''}${f.extinct ? ' · ✕ extinct' : ''}</span><b>${esc(f.name)}</b>${f.change ? `<span>${esc(f.change)}</span>` : ''}`;
    return f.current ? `<div class="cp-form cur${f.cursed ? ' cu' : ''}" aria-current="true">${head}</div>`
      : `<button type="button" class="cp-form${f.cursed ? ' cu' : ''}${f.extinct ? ' ext' : ''}" data-form="${esc(f.id)}" title="Open ${esc(f.name)}">${head}</button>`;
  }
  function sections(m, o) {
    const r = m.rec, creature = m.kind === 'creatures', K = C(), reader = !!o.reader;
    const sec = (i, small, inner) => `<section class="cp-sec" data-sec="${i}" id="cp-s${i}"><h4><span>${i + 1} · ${SECTIONS[i].toUpperCase()}</span><small>${esc(small)}</small></h4>${inner}</section>`;
    const none = t => `<p class="cp-none">${esc(t)}</p>`;
    // 1 lineage
    const n = m.lineage.length, forks = m.lineage.filter(f => f.branches.length).length;
    const lin = `<div class="cp-line">${m.lineage.map((f, i) => (i ? '<span class="cp-arr" aria-hidden="true">▸</span>' : '') + formCard(f)).join('')}</div>` +
      (forks ? `<div class="cp-branches"><span class="cp-fl">Branches that split off</span>${m.lineage.filter(f => f.branches.length).map(f => `<p><span class="cp-dim">from ${esc(f.sil ? '? ? ?' : f.name)}:</span> ${f.branches.map(b => b.sil ? '<span class="cp-sil">? ? ?</span>' : `<button type="button" class="cp-chip${b.extinct ? ' ext' : ''}" data-form="${esc(b.id)}">${esc(b.name)}${b.extinct ? ' ✕' : ''}</button>`).join(' ')}</p>`).join('')}</div>` : '');
    // 2 mutations
    const mut = m.mutations.length ? m.mutations.map(x => `<div class="cp-mut${x.current ? ' cur' : ''}"><b>${esc(whenLbl(x.when) || '—')}</b><span>${x.change ? esc(x.change) : '<span class="cp-none">what changed is not written yet</span>'}<br><span class="cp-dim">${x.cause ? 'cause: ' + esc(causeLbl(x.cause)) : 'cause: none yet'}${x.gain ? ' · gained: ' + esc(x.gain) : ''}${x.cursed ? ' · ⛓ a curse came with it' : ''}</span></span><em>${esc(x.name)}</em></div>`).join('')
      : none('No change is written down for this line yet.');
    // 3 anatomy
    const parts = (r.anatomy && r.anatomy.parts) || [], img = r.anatomy && r.anatomy.image, placed = p => p.x != null && p.y != null;
    const plate = img ? `<div class="cp-plate" data-plate><img loading="lazy" decoding="async" src="${esc(img)}" alt="${esc(r.name || '')}: the specimen">${parts.map((p, i) => placed(p) || !reader ? `<button type="button" class="cp-pin${placed(p) ? '' : ' tray'}" data-pin="${i}" style="${placed(p) ? `left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%` : `left:${4 + i * 7}%;top:104%`}" aria-label="${i + 1}: ${esc(p.name)}${reader ? '' : ', drag to place it'}" title="${esc(p.name)}">${i + 1}</button>` : '').join('')}</div>${!reader && parts.some(p => !placed(p)) ? '<p class="cp-dim">Drag the pins below the image onto the body; they stay where you drop them.</p>' : ''}` : '';
    const yields = (r.resources || []).filter(x => x.name), kindName = k => ((K.RESOURCE_KINDS || []).find(q => q[0] === k) || [k, k])[1];
    const ana = (plate + (parts.length ? `<ol class="cp-parts">${parts.map(p => `<li><b>${esc(p.name)}</b>${p.note ? ' · ' + esc(p.note) : ''}</li>`).join('')}</ol>` : '') ||
      none(reader ? 'Nothing of its body is known yet.' : 'No anatomy written yet: add an image and its parts in the editor.')) +
      (yields.length ? `<p><span class="cp-fl">What its body yields</span></p>${yields.map(x => `<div class="cp-trait"><b>${esc(x.name)}</b><span>${esc(kindName(x.kind))}${x.use ? ' · ' + esc(x.use) : ''}${x.libId && itemName(x.libId) ? ` · <span class="cp-dim">Library: ${esc(itemName(x.libId))}</span>` : ''}</span></div>`).join('')}` : '');
    // 4 abilities
    const traits = r.traits || [];
    const P = K.POWER, ties = (r.ties || []).filter(x => x.charId);
    const abl = (traits.length ? traits.map(t => `<div class="cp-trait"><b>${esc(t.name)}</b><span>${esc(t.does)}${t.counters ? `<br><span class="cp-dim">countered by: ${esc(t.counters)}</span>` : ''}</span>${t.power ? `<em class="cp-pow">${dots(t.power, 'Power', P.steps)} ${esc(P.steps[t.power - 1])}</em>` : ''}</div>`).join('') : none(reader ? 'Not known yet.' : creature ? 'No traits written yet.' : 'A lineage step has no traits of its own.')) +
      (ties.length ? `<p><span class="cp-fl">Tied to the powers of</span></p>${ties.map(x => `<div class="cp-trait"><b>${charLink(x.charId) || esc(x.charId)}</b><span>${esc(x.how)}</span></div>`).join('')}` : '');
    // 5 range
    const bios = (st => (r.biomes || []).concat((r.range && r.range.biomes) || []).filter((b, i, a) => a.indexOf(b) === i).map(b => (st.biomes || []).find(x => x.id === b)).filter(Boolean))(o.st);
    const placesR = ((r.range && r.range.places) || []).filter(Boolean), nests = (r.nests || []).filter(Boolean), sight = (r.sightings || []).filter(s => s.chapter != null).sort((a, b) => a.chapter - b.chapter);
    const rng = [bios.length ? `<p><span class="cp-fl">Biomes</span> ${bios.map(b => `<span class="cp-chip">${esc(b.name)}</span>`).join(' ')}</p>` : '', placesR.length ? `<p><span class="cp-fl">Places</span> ${placesR.map(esc).join(' · ')}</p>` : '',
      nests.length ? `<p><span class="cp-fl">Nests</span> ${nests.map(esc).join(' · ')}</p>` : '',
      sight.length ? `<p><span class="cp-fl">Sightings</span></p>${sight.map(s => `<div class="cp-sight"><b>Ch ${s.chapter}</b><span>${esc(s.note || '')}${s.placeId && place(s.placeId) ? ` <button type="button" class="cp-chip" data-open-entry="${esc(s.placeId)}">${esc(place(s.placeId).name)} ▸</button>` : ''}</span></div>`).join('')}` : ''].filter(Boolean).join('');
    const rangeHtml = rng || none('Where it lives is not written yet.');
    // 6 behaviour
    const names = (r.names || []).filter(x => x.placeId && (x.localName || x.belief));
    const beh = [r.diet ? `<p><span class="cp-fl">Diet</span> ${esc(r.diet)}</p>` : '', r.hunting ? `<p><span class="cp-fl">Hunting</span> ${esc(r.hunting)}</p>` : '', r.breeding ? `<p><span class="cp-fl">Breeding</span> ${esc(r.breeding)}</p>` : '',
      names.length ? `<p><span class="cp-fl">What settlements call it</span></p>${names.map(x => `<div class="cp-sight"><span><button type="button" class="cp-chip" data-open-entry="${esc(x.placeId)}">${esc((place(x.placeId) || { name: x.placeId }).name)} ▸</button></span><span>${x.localName ? '“' + esc(x.localName) + '”' : ''}${x.belief ? ' · ' + esc(x.belief) : ''}</span></div>`).join('')}` : ''].filter(Boolean).join('');
    const behHtml = beh || none('Nothing about its habits is written yet.');
    // 7 field notes
    const notes = (r.fieldNotes || []).filter(x => x.text), enc = (r.encounters || []).filter(x => x.charId || x.note).sort((a, b) => (a.chapter || 0) - (b.chapter || 0));
    const fn = (notes.length ? notes.map(x => `<figure class="cp-note"><blockquote>${esc(x.text)}</blockquote><figcaption>— ${x.charId && charName(x.charId) ? charLink(x.charId) : esc(x.author || 'Unsigned')}${x.when ? ' · ' + esc(whenLbl(x.when)) : ''}${!reader && x.chapter ? ` <span class="cp-dim">· readers see it from Ch ${x.chapter}</span>` : ''}${!reader && !x.chapter ? ' <span class="cp-dim">· no chapter set: readers never see it</span>' : ''}</figcaption></figure>`).join('') : none('No field notes yet.')) +
      (enc.length ? `<p><span class="cp-fl">Encounters</span></p>${enc.map(x => `<div class="cp-sight"><b>${x.chapter ? 'Ch ' + x.chapter : '—'}</b><span>${x.charId ? charLink(x.charId) || esc(x.charId) : ''} ${esc(x.note)}</span></div>`).join('')}` : '');
    return [sec(0, `${n} form${n === 1 ? '' : 's'}${m.root ? ' from ' + m.root : ''}`, lin), sec(1, 'each change, its cause, what it gained', mut), sec(2, parts.length ? `${parts.length} part${parts.length === 1 ? '' : 's'}` : 'nothing written yet', ana),
      sec(3, 'what its body can do, and what counters it', abl), sec(4, 'where it lives and moves: the map follows', rangeHtml), sec(5, 'habits, and what each settlement says', behHtml), sec(6, 'in-world notes', fn)].join('');
  }
  function headHtml(m, o) {
    const r = m.rec, K = C(), creature = m.kind === 'creatures', sc = ['awareness', 'threat', 'size'];
    const curses = o.reader ? ((r.curses || []).length || (r.mutation && r.mutation.curse) ? '<span class="cp-curse">⛓ cursed</span>' : '') : (r.curses || []).map(c => { const mk = ((global.EpitaphLibrary && global.EpitaphLibrary.get().marks) || []).find(x => x.id === c.libId); return `<span class="cp-curse">⛓ ${esc(mk ? mk.name : c.libId)}${c.stage ? ' · ' + c.stage : ''}</span>`; }).join('');
    const meta = [creature ? 'Creature' : 'Lineage step', whenLbl(r.when), r.extinct ? 'extinct ' + whenLbl(r.extinct) : '', r.example ? 'example' : '', !o.reader && r.draft ? 'draft' : ''].filter(Boolean).join(' · ');
    const scales = creature ? `<div class="cp-scales">${sc.map(k => { const S = K.SCALES[k], v = r[k]; return `<div><span class="cp-fl">${esc(S.label)}</span>${dots(v, S.label, S.steps)}<span class="cp-sv">${v ? v + ' · ' + esc(S.steps[v - 1]) + (k === 'awareness' && K.isConscious(r) ? ' · conscious' : '') : 'not set'}</span></div>`; }).join('')}</div>` : '';
    return `<div class="cp-hd"><div class="cp-top"><button type="button" class="cp-back" data-back>◂ Tree</button><div class="cp-ttl"><h2>${esc(r.name || r.id)}</h2><small>${esc(meta)}</small></div>${curses}${o.reader ? '' : '<button type="button" class="cp-edit" data-edit>Edit ▸</button>'}</div>${scales}</div>`;
  }

  function mount(host, o) {
    const m = model(o.st, o.id);
    if (!m) { host.innerHTML = '<div class="cp"><p class="cp-none" style="padding:1rem">That form is not in the log (or not found yet).</p></div>'; return { goto() {}, destroy() {} }; }
    host.innerHTML = `<div class="cp">${headHtml(m, o)}<div class="cp-body" tabindex="0" aria-label="${esc(m.rec.name)}: the field journal">${sections(m, o)}</div></div>`;
    const body = host.querySelector('.cp-body'); let cur = -1;
    const here = () => { const top = body.getBoundingClientRect().top + 36; let at = 0; body.querySelectorAll('.cp-sec').forEach((s, i) => { if (s.getBoundingClientRect().top <= top + 24) at = i; });
      return at; };
    const sync = () => { const i = here(); if (i !== cur) { cur = i; if (o.onSection) o.onSection(i); } };
    body.addEventListener('scroll', sync, { passive: true }); sync();
    const click = e => { const t = e.target; if (!t.closest) return;
      if (t.closest('[data-back]')) { if (o.onBack) o.onBack(); return; } if (t.closest('[data-edit]')) { if (o.onEdit) o.onEdit(m.kind, m.rec.id); return; }
      const op = t.closest('[data-form]'); if (op) { if (o.onOpen) o.onOpen(op.dataset.form); return; }
    };
    host.addEventListener('click', click);
    // author: drag a pin onto the image; it saves where it is dropped (o.onPin)
    let drag = null;
    const down = e => { const pin = !o.reader && e.target.closest && e.target.closest('[data-pin]'); if (!pin) return; e.preventDefault(); e.stopPropagation(); drag = { pin, plate: pin.closest('[data-plate]') }; try { pin.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } pin.classList.add('dragging'); };
    const move = e => { if (!drag) return; e.stopPropagation(); const b = drag.plate.getBoundingClientRect(), x = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y = Math.min(1, Math.max(0, (e.clientY - b.top) / b.height));
      drag.pin.style.left = (x * 100).toFixed(2) + '%'; drag.pin.style.top = (y * 100).toFixed(2) + '%'; drag.x = x; drag.y = y; drag.pin.classList.remove('tray'); };
    const up = e => { if (!drag) return; if (e) e.stopPropagation(); const d = drag; drag = null; d.pin.classList.remove('dragging'); try { if (e && e.pointerId != null && d.pin.hasPointerCapture(e.pointerId)) d.pin.releasePointerCapture(e.pointerId); } catch (x) { /* fine */ } if (d.x != null && o.onPin) o.onPin(m.rec.id, +d.pin.dataset.pin, d.x, d.y); };
    const keyPin = e => { const pin = !o.reader && e.target.closest && e.target.closest('[data-pin]'); if (!pin) return; const st = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] }[e.key]; if (!st) return; e.preventDefault();
      const x = Math.min(1, Math.max(0, (parseFloat(pin.style.left) || 0) / 100 + st[0])), y = Math.min(1, Math.max(0, (parseFloat(pin.style.top) || 0) / 100 + st[1])); pin.style.left = (x * 100) + '%'; pin.style.top = (y * 100) + '%'; pin.classList.remove('tray'); if (o.onPin) o.onPin(m.rec.id, +pin.dataset.pin, x, y); };
    host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move); host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up); host.addEventListener('keydown', keyPin);
    return { goto: i => { const s = body.querySelector(`[data-sec="${i}"]`); if (s) body.scrollTo({ top: s.offsetTop - body.offsetTop - 4, behavior: global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); },
      destroy: () => { host.removeEventListener('click', click); host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', up); host.removeEventListener('keydown', keyPin); body.removeEventListener('scroll', sync); } };
  }
  global.EpitaphCreaturePage = { SECTIONS, model, mount, _t: { whenLbl, causeLbl } };
})(typeof window !== 'undefined' ? window : globalThis);
