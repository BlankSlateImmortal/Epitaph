/* Epitaph — book commands and automatic features (2026-11-16).
 * Loaded after index.html and epitaph-editors.js.
 *
 * Book terminal commands (type "open" anywhere to open the book):
 *   help                         every command
 *   c<Name> <ch> <ch>            compare two chapters        cOrin 1 265   (also cOrin 1-265)
 *   s: who knows <X>             who knows about X / met X   s: who knows sils
 *   s: who is in <place> [ch]    who was there (and when)    s: who is in aurelia 1
 *   s: who holds <X>             items, marks, skills, gifts s: who holds seal
 *   ch<Name>                     every published chapter they're in, with links
 *   h<Name>                      their save history
 *   u<Name> [n]                  roll back to save n (default: the save before the last)
 *   changes                      audit log of chapter-marker changes; changes apply all | apply 1 3 | skip 2
 *   export <Name>                download them as a Markdown note for the vault
 *
 * Automatic: two-way ties, shared secrets, save history, a "what changed?" prompt after a new
 * chapter, a chapter-changes notice in the brief. (More lore checks live in epitaph-checks.js.) */
(function () {
  'use strict';
  const esc = s => escapeHtml(s == null ? '' : String(s));
  const lc = s => String(s || '').trim().toLowerCase();
  const HISTORY_KEY = 'epitaph-history', HISTORY_MAX = 15, MARKER_KEY = 'epitaph-marker-log';

  // ---------- shared helpers ----------
  const chars = () => state.characters || [];
  function findChar(q) {
    const k = lc(q); if (!k) return null;
    return chars().find(c => lc(c.name) === k) || chars().find(c => lc(c.name).startsWith(k)) || chars().find(c => lc(c.name).includes(k)) || null;
  }
  const startOf = s => Number.isInteger(s.startChapter) ? s.startChapter : parseStartChapter(s.chapterRange || '') || 0;
  const ordered = c => c.snapshots.slice().sort((a, b) => startOf(a) - startOf(b));
  function versionAt(c, n) {
    const v = ordered(c).filter(s => startOf(s) <= n);
    return v.length ? v[v.length - 1] : null;
  }
  function rangeOf(c, s) {
    const o = ordered(c), i = o.indexOf(s), next = o[i + 1];
    return `CH ${startOf(s) || '?'}${next ? '–' + (startOf(next) - 1) : '→'}`;
  }
  const placeOf = ref => { const r = ref && World && World.resolve(ref); return r ? { name: r.name || r.label || '', path: r.path || r.label || '' } : null; };
  const out = (title, body) => `<div class="bt-out"><div class="bt-h">${esc(title)}</div>${body}</div>`;
  const line = (sign, text) => `<div class="bt-l ${sign === '+' ? 'add' : sign === '−' ? 'del' : sign === '~' ? 'chg' : ''}"><b>${sign}</b><span>${text}</span></div>`;
  const sec = (name, rows) => rows.length ? `<div class="bt-sec"><div class="bt-k">${esc(name)}</div>${rows.join('')}</div>` : '';
  const err = t => `<div class="bt-err">${esc(t)}</div>`;
  const later = (fn) => { const id = 'bt' + Math.random().toString(36).slice(2, 9); Promise.resolve().then(fn).then(html => { const el = document.getElementById(id); if (el) { el.outerHTML = html; const log = document.getElementById('terminalLog'); if (log) log.scrollTop = log.scrollHeight; } }).catch(e => { const el = document.getElementById(id); if (el) el.outerHTML = err('Something went wrong: ' + e.message); }); return `<div id="${id}" class="bt-wait">working…</div>`; };

  // =====================================================================
  // COMPARE  cOrin 1 265
  // =====================================================================
  const itemName = it => invView(it).name;
  function setDiff(a, b, key) {
    const A = new Map(a.map(x => [key(x), x])), B = new Map(b.map(x => [key(x), x]));
    return { added: b.filter(x => !A.has(key(x))), removed: a.filter(x => !B.has(key(x))), both: b.filter(x => A.has(key(x))).map(x => [A.get(key(x)), x]) };
  }
  function compare(c, a, b) {
    const A = versionAt(c, a), B = versionAt(c, b);
    if (!A || !B) return err(`${c.name} has no version at ${!A ? 'CH ' + a : 'CH ' + b}. Their versions start at ${ordered(c).map(startOf).join(', ')}.`);
    if (A === B) return out(`COMPARE ${c.name.toUpperCase()} · CH ${a} → CH ${b}`, `<div class="bt-l">Both chapters fall in the same version (${esc(rangeOf(c, A))}). Nothing changed between them.</div>`);
    const val = (x, y, label, f) => { const p = f(A), q = f(B); return p !== q ? [line('~', `<i>${esc(label)}</i> ${esc(p || '—')} → <b>${esc(q || '—')}</b>`)] : []; };
    const s = [];
    s.push(sec('Identity', [...val(0, 0, archetypeLabel(B, c) && hasArchetype(c) ? 'Archetype' : 'Headline', v => archetypeLabel(v, c)), ...val(0, 0, 'Presence', v => PRESENCE_LABEL[v.presence] || 'Alive')]));
    s.push(sec('State', [...val(0, 0, 'Where', v => (placeOf(v.location) || {}).name || ''), ...val(0, 0, 'Wants', v => v.objective || ''), ...val(0, 0, 'Heading', v => v.headingToward || ''),
      ...(() => { const d = setDiff(A.condition || [], B.condition || [], x => lc(x)); return [...d.added.map(x => line('+', esc(x))), ...d.removed.map(x => line('−', esc(x)))]; })()]));
    if (hasStats(c)) s.push(sec('Stats', STAT_SLOTS.map((k, i) => { const p = +(A.stats || {})[k] || 0, q = +(B.stats || {})[k] || 0; return p !== q ? line(q > p ? '+' : '−', `${esc(statNames(c)[i])}: ${esc(statLevelName(c, k, p) || p)} → <b>${esc(statLevelName(c, k, q) || q)}</b> <small>(${p} → ${q})</small>`) : ''; }).filter(Boolean)));
    const pa = A.power || {}, pb = B.power || {};
    s.push(sec('Power', [
      ...(pa.threat !== pb.threat ? [line('~', `Threat ${esc(threatLabel(pa.threat) || '—')} → <b>${esc(threatLabel(pb.threat) || '—')}</b>`)] : []),
      ...setDiff(pa.cuts || [], pb.cuts || [], x => lc(x.boon || x.desire)).added.map(x => line('+', `Cut: <b>${esc(x.boon || 'unnamed')}</b> (for ${esc(x.desire || '…')}, gave ${esc(x.cost || '…')})`)),
      ...(() => { const d = setDiff(parseGifts(pa.gift), parseGifts(pb.gift), x => lc(x.from)); return [...d.added.map(x => line('+', `Gift from ${esc(x.from)}: ${esc(x.what)}`)), ...d.removed.map(x => line('−', `Gift from ${esc(x.from)}`))]; })(),
      ...(pa.herald !== pb.herald && (pa.herald || pb.herald) ? [line('~', `Herald ${esc(pa.herald || '—')} → <b>${esc(pb.herald || '—')}</b>`)] : []),
      ...(pa.voidedRank !== pb.voidedRank ? [line('~', `Rank ${esc(pa.voidedRank || '—')} → <b>${esc(pb.voidedRank || '—')}</b>`)] : []),
      ...(pa.planeLevel !== pb.planeLevel ? [line('~', `Level ${pa.planeLevel || '—'} → <b>${pb.planeLevel || '—'}</b>`)] : []),
      ...(pa.domain !== pb.domain ? [line('~', `Tier ${pa.domain || '—'} → <b>${pb.domain || '—'}</b>`)] : [])
    ]));
    s.push(sec(hasTrueName(c) ? 'True name' : 'Titles', setDiff(A.titles || [], B.titles || [], x => lc(x.name)).added.map(x => line('+', `${esc(x.name)}${x.rankTier ? ' · tier ' + x.rankTier : ''}`))));
    const sk = setDiff(A.skills || [], B.skills || [], x => lc(x.name));
    s.push(sec('Skills', [...sk.added.map(x => line('+', `${esc(x.name)}${x.parent ? ' (from ' + esc(x.parent) + ')' : ' (core)'}`)), ...sk.removed.map(x => line('−', esc(x.name))),
      ...sk.both.filter(([p, q]) => levelInfo(p.level).lvl !== levelInfo(q.level).lvl).map(([p, q]) => line('~', `${esc(q.name)} LV${levelInfo(p.level).lvl} → <b>LV${levelInfo(q.level).lvl}</b>`))]));
    const it = setDiff(A.inventory || [], B.inventory || [], x => lc(itemName(x)));
    s.push(sec('Carried', [...it.added.map(x => line('+', esc(itemName(x)))), ...it.removed.map(x => line('−', esc(itemName(x)))),
      ...it.both.filter(([p, q]) => invView(p).state !== invView(q).state).map(([p, q]) => line('~', `${esc(itemName(q))}: ${esc(invView(p).state || '—')} → <b>${esc(invView(q).state || '—')}</b>`))]));
    const mk = setDiff(A.marks || [], B.marks || [], x => lc(x.name) + x.kind);
    s.push(sec('Marks', [...mk.added.map(x => line('+', `${esc(x.kind)}: ${esc(x.name || 'unnamed')}`)), ...mk.removed.map(x => line('−', `${esc(x.kind)}: ${esc(x.name || 'unnamed')}`))]));
    const ti = setDiff(A.relationships || [], B.relationships || [], x => x.charId || lc(relationshipDisplayName(x)));
    s.push(sec('Ties', [...ti.added.map(x => line('+', `${esc(relationshipDisplayName(x))}${x.relation ? ' — ' + esc(x.relation) : ''}`)), ...ti.removed.map(x => line('−', esc(relationshipDisplayName(x)))),
      ...ti.both.filter(([p, q]) => lc(p.relation) !== lc(q.relation)).map(([p, q]) => line('~', `${esc(relationshipDisplayName(q))}: ${esc(p.relation || '—')} → <b>${esc(q.relation || '—')}</b>`))]));
    s.push(sec('Knows', setDiff(A.knowledge || [], B.knowledge || [], x => lc(x)).added.map(x => line('+', esc(x)))));
    const se = setDiff(A.secrets || [], B.secrets || [], x => lc(x.text));
    s.push(sec('Secrets', [...se.added.map(x => line('+', esc(x.text) + (x.characterKnows ? '' : ' (they don’t know)'))), ...se.removed.map(x => line('−', esc(x.text))),
      ...se.both.filter(([p, q]) => p.characterKnows !== q.characterKnows).map(([p, q]) => line('~', `${esc(q.text)}: ${q.characterKnows ? 'they now know' : 'no longer known to them'}`))]));
    const body = s.filter(Boolean).join('');
    return out(`COMPARE ${c.name.toUpperCase()} · CH ${a} (${rangeOf(c, A)}) → CH ${b} (${rangeOf(c, B)})`, body || '<div class="bt-l">No differences.</div>');
  }

  // =====================================================================
  // SEARCH  s: who knows X · s: who is in PLACE [ch] · s: who holds X
  // =====================================================================
  function searchKnows(x) {
    const k = lc(x), subject = findChar(x);
    const word = new RegExp('(^|[^\\p{L}\\p{N}])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}\\p{N}])', 'iu');
    const has = t => word.test(String(t || ''));
    const rows = chars().filter(c => c !== subject).map(c => {
      const o = ordered(c);
      let met = null, rel = null;
      if (subject) {
        const tied = o.filter(s => (s.relationships || []).some(r => r.charId === subject.id || lc(relationshipDisplayName(r)) === lc(subject.name)));
        if (tied.length) {
          met = startOf(tied[0]);
          const r0 = (tied[tied.length - 1].relationships || []).find(r => r.charId === subject.id || lc(relationshipDisplayName(r)) === lc(subject.name));
          const arc = relationshipArc(c, r0).filter(st => st.label !== 'not listed').map(st => st.label);
          rel = { arc: [...new Set(arc)], note: r0.note || '' };
        }
      }
      const facts = [];
      o.forEach(s => {
        (s.knowledge || []).forEach(t => { if (has(t) && !facts.some(f => f.t === t)) facts.push({ t, ch: startOf(s) }); });
        (s.secrets || []).forEach(sc => { if ((has(sc.text) || has(sc.knownBy)) && !facts.some(f => f.t === sc.text)) facts.push({ t: sc.text + (sc.characterKnows ? '' : ' (they don’t know it)'), ch: startOf(s), secret: true }); });
      });
      if (!rel && !facts.length) return '';
      return `<div class="bt-card"><div class="bt-name">${esc(c.name)}${met != null ? `<small>met ${esc(subject.name)} by CH ${met}</small>` : ''}</div>
        ${rel ? line('·', `Bond: ${esc(rel.arc.join(' → ') || 'listed')}${rel.note ? ` — <i>${esc(rel.note.slice(0, 160))}${rel.note.length > 160 ? '…' : ''}</i>` : ''}`) : ''}
        ${facts.map(f => line(f.secret ? '!' : '·', `${esc(f.t)} <small>since CH ${f.ch}</small>`)).join('')}</div>`;
    }).filter(Boolean);
    return out(`WHO KNOWS ${x.toUpperCase()}`, rows.join('') || `<div class="bt-l">Nobody's file mentions “${esc(x)}”${subject ? ' or ties to ' + esc(subject.name) : ''}.</div>`);
  }
  function searchIn(place, ch) {
    const k = lc(place);
    const match = s => { const p = placeOf(s.location); return p && (lc(p.name).includes(k) || lc(p.path).includes(k)); };
    if (ch != null) {
      const rows = chars().map(c => { const s = versionAt(c, ch); return s && match(s) ? { c, s } : null; }).filter(Boolean).map(({ c, s }) => `<div class="bt-card"><div class="bt-name">${esc(c.name)}<small>${esc(PRESENCE_LABEL[s.presence] || 'Alive')} · ${esc(rangeOf(c, s))} · ${esc((placeOf(s.location) || {}).path || '')}</small></div>
        ${s.objective ? line('·', `Wants: ${esc(s.objective)}`) : ''}${(s.condition || []).length ? line('·', `Condition: ${esc(s.condition.join(', '))}`) : ''}${s.headingToward ? line('·', `Heading: ${esc(s.headingToward)}`) : ''}${s.notes ? line('·', `<i>${esc(s.notes.slice(0, 200))}${s.notes.length > 200 ? '…' : ''}</i>`) : ''}</div>`);
      return out(`WHO IS IN ${place.toUpperCase()} · CH ${ch}`, rows.join('') || `<div class="bt-l">Nobody is recorded in “${esc(place)}” at CH ${ch}.</div>`);
    }
    const rows = chars().map(c => {
      const o = ordered(c), stays = [];
      o.forEach((s, i) => { const here = match(s), prevHere = i > 0 && match(o[i - 1]); if (here && !prevHere) stays.push({ from: startOf(s), why: s.objective || '', left: null }); if (!here && prevHere && stays.length) stays[stays.length - 1].left = startOf(s); });
      if (!stays.length) return '';
      return `<div class="bt-card"><div class="bt-name">${esc(c.name)}</div>${stays.map(st => line('·', `Arrived CH ${st.from}${st.left ? ` · left CH ${st.left}` : ' · still there'}${st.why ? ` — <i>${esc(st.why)}</i>` : ''}`)).join('')}</div>`;
    }).filter(Boolean);
    return out(`WHO IS IN ${place.toUpperCase()}`, rows.join('') || `<div class="bt-l">Nobody is recorded in “${esc(place)}”.</div>`);
  }
  function searchHolds(x) {
    const k = lc(x), found = new Map();   // key -> record
    const note = (c, key, kind, name, s, detail) => {
      const id = c.id + '|' + key;
      if (!found.has(id)) found.set(id, { c, kind, name, first: startOf(s), last: startOf(s), detail, gone: null });
      const r = found.get(id); r.last = startOf(s); r.detail = detail || r.detail; r.gone = null;
    };
    chars().forEach(c => {
      const o = ordered(c);
      o.forEach(s => {
        const seen = new Set();
        (s.inventory || []).forEach(it => {
          const v = invView(it);
          if (lc(v.name).includes(k)) { seen.add('i' + lc(v.name)); note(c, 'i' + lc(v.name), 'Item', v.name, s, [v.state && 'state ' + v.state, v.origin && 'from ' + v.origin, it.boundTo && 'bound to ' + it.boundTo, it.note, (it.marks || []).map(m => `${m.kind} ${m.name}`).join(', ')].filter(Boolean).join(' · ')); }
          (it.marks || []).forEach(m => { if (lc(m.name).includes(k)) { seen.add('im' + lc(m.name)); note(c, 'im' + lc(m.name), cap(m.kind), m.name, s, `on ${v.name}${m.source ? ' · from ' + m.source : ''}${m.effect ? ' · ' + m.effect : ''}${m.cost ? ' · cost: ' + m.cost : ''}`); } });
        });
        (s.marks || []).forEach(m => { if (lc(m.name).includes(k) || lc(m.source).includes(k)) { seen.add('m' + lc(m.name)); note(c, 'm' + lc(m.name), cap(m.kind), m.name, s, [m.source && 'from ' + m.source, m.effect, m.cost && 'cost: ' + m.cost].filter(Boolean).join(' · ')); } });
        (s.skills || []).forEach(sk => { if (lc(sk.name).includes(k)) { seen.add('s' + lc(sk.name)); note(c, 's' + lc(sk.name), 'Skill', sk.name, s, `LV${levelInfo(sk.level).lvl}${sk.corrupted ? ' · corrupted' : ''}${sk.parent ? ' · from ' + sk.parent : ' · core'}`); } });
        const p = s.power || {};
        (p.cuts || []).forEach(cu => { if (lc(cu.boon).includes(k) || lc(cu.desire).includes(k)) { seen.add('c' + lc(cu.boon)); note(c, 'c' + lc(cu.boon), 'Cut', cu.boon || 'unnamed', s, `for ${cu.desire || '…'} · gave ${cu.cost || '…'}`); } });
        parseGifts(p.gift).forEach(g => { if (lc(g.from).includes(k) || lc(g.what).includes(k)) { seen.add('g' + lc(g.from)); note(c, 'g' + lc(g.from), 'Gift', g.what || 'a gift', s, 'given by ' + g.from); } });
        if (p.herald && lc(p.herald).includes(k)) { seen.add('h'); note(c, 'h', 'Herald', p.herald, s, c.race === 'storyborn' ? 'their Herald' : 'Herald of ' + p.herald); }
        found.forEach((r, id) => { if (id.startsWith(c.id + '|') && !seen.has(id.split('|')[1]) && r.last < startOf(s) && r.gone == null) r.gone = startOf(s); });
      });
    });
    const rows = [...found.values()].map(r => `<div class="bt-card"><div class="bt-name">${esc(r.c.name)}<small>${esc(r.kind.toUpperCase())} · ${esc(r.name)}</small></div>
      ${line('·', `Since CH ${r.first}${r.gone ? ` · gone by CH ${r.gone}` : ' · still held'}`)}${r.detail ? line('·', esc(r.detail)) : ''}</div>`);
    return out(`WHO HOLDS ${x.toUpperCase()}`, rows.join('') || `<div class="bt-l">Nobody holds anything matching “${esc(x)}” (items, marks, skills, Cuts, gifts).</div>`);
  }
  const cap = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
  function search(q) {
    const t = q.trim().replace(/\?$/, '');
    let m;
    if ((m = t.match(/^who\s+knows\s+(?:about\s+)?(.+)$/i))) return searchKnows(m[1].trim());
    if ((m = t.match(/^who(?:'s|\s+is|\s+was)?\s+(?:in|at)\s+(.+?)(?:\s+(?:ch\s*)?(\d+))?$/i))) return searchIn(m[1].trim(), m[2] ? +m[2] : null);
    if ((m = t.match(/^who\s+(?:holds|has|carries|had)\s+(.+)$/i))) return searchHolds(m[1].trim());
    return err('Try: s: who knows <name or fact> · s: who is in <place> [chapter] · s: who holds <item, mark, skill or gift>');
  }

  // =====================================================================
  // CHAPTERS  chOrin
  // =====================================================================
  let chapterIndex = null;
  const loadIndex = () => chapterIndex ? Promise.resolve(chapterIndex) : fetch('chapters/index.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : []).catch(() => []).then(l => (chapterIndex = Array.isArray(l) ? l : []));
  function chaptersOf(c) {
    return later(() => loadIndex().then(list => {
      const mine = list.filter(ch => lc(ch.pov) === lc(c.name) || (ch.characters || []).some(n => lc(n) === lc(c.name)));
      return out(`${c.name.toUpperCase()} · CHAPTERS`, mine.map(ch => line('·', `<a href="read.html#ch-${ch.chapter}">CH ${ch.chapter}${ch.title ? ' · ' + esc(ch.title) : ''}</a> <small>${lc(ch.pov) === lc(c.name) ? 'POV' : 'present'}${ch.status !== 'canon' ? ' · draft' : ''}</small>`)).join('')
        || `<div class="bt-l">No published chapter lists ${esc(c.name)} yet (${list.length} chapter${list.length === 1 ? '' : 's'} published).</div>`);
    }));
  }

  // =====================================================================
  // HISTORY  hOrin · uOrin [n]   (automatic: every save is kept, pictures excluded)
  // =====================================================================
  const readHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); } catch (e) { return {}; } };
  function writeHistory(h) {
    for (let tries = 0; tries < 30; tries++) {
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); return; }
      catch (e) { const longest = Object.keys(h).sort((a, b) => (h[b] || []).length - (h[a] || []).length)[0]; if (!longest || (h[longest] || []).length <= 1) return; h[longest].shift(); }
    }
  }
  const strip = v => Array.isArray(v) ? v.map(strip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, strip(x)])) : (typeof v === 'string' && v.startsWith('data:') ? '@img' : v);
  function refill(old, cur) {
    if (old === '@img') return typeof cur === 'string' ? cur : '';
    if (Array.isArray(old)) return old.map((x, i) => refill(x, Array.isArray(cur) ? (x && x.id && cur.find(y => y && y.id === x.id)) || cur[i] : undefined));
    if (old && typeof old === 'object') return Object.fromEntries(Object.entries(old).map(([k, x]) => [k, refill(x, cur && cur[k])]));
    return old;
  }
  function recordHistory(note) {
    const h = readHistory(); let changed = false;
    chars().forEach(c => {
      const data = JSON.stringify(strip(c)), list = h[c.id] || (h[c.id] = []);
      if (!list.length || list[list.length - 1].data !== data) { list.push({ at: new Date().toISOString(), data, note: note || '' }); changed = true; }
      while (list.length > HISTORY_MAX) list.shift();
    });
    Object.keys(h).forEach(id => { if (!chars().some(c => c.id === id)) delete h[id]; });
    if (changed) writeHistory(h);
  }
  const lastSaved = id => { const l = readHistory()[id]; return l && l.length ? JSON.parse(l[l.length - 1].data) : null; };
  function whatChanged(oldC, newC) {
    const parts = [];
    ['name', 'race', 'faction', 'authority', 'lore'].forEach(k => { if (JSON.stringify(oldC[k]) !== JSON.stringify(newC[k])) parts.push(k === 'race' ? 'type' : k); });
    if (oldC.snapshots.length !== newC.snapshots.length) parts.push(newC.snapshots.length > oldC.snapshots.length ? 'new chapter version' : 'removed a version');
    newC.snapshots.forEach(s => { const o = oldC.snapshots.find(x => x.id === s.id); if (!o) return; const keys = ['stats', 'skills', 'inventory', 'marks', 'relationships', 'knowledge', 'secrets', 'condition', 'objective', 'location', 'notes', 'power', 'titles', 'presence', 'archetype', 'headingToward'].filter(k => JSON.stringify(o[k]) !== JSON.stringify(s[k])); if (keys.length) parts.push(`${s.chapterRange || 'a chapter'}: ${keys.join(', ')}`); });
    return parts.join(' · ') || 'small changes';
  }
  function history(c) {
    const list = (readHistory()[c.id] || []).slice().reverse();
    if (!list.length) return err(`No saves recorded for ${c.name} yet. Every save from now on is kept.`);
    const rows = list.map((e, i) => {
      const older = list[i + 1];
      const what = older ? whatChanged(JSON.parse(older.data), JSON.parse(e.data)) : 'earliest kept save';
      return line(String(i + 1), `${new Date(e.at).toLocaleString()} — ${esc(what)}${i === 0 ? ' <small>(current)</small>' : ` <small>· u${esc(c.name)} ${i + 1}</small>`}`);
    });
    return out(`${c.name.toUpperCase()} · SAVE HISTORY (newest first, last ${HISTORY_MAX})`, rows.join(''));
  }
  function undo(c, n) {
    const list = (readHistory()[c.id] || []).slice().reverse();
    const pick = list[(n || 2) - 1];
    if (!pick || (n || 2) < 2) return err(list.length < 2 ? `${c.name} has no earlier save to go back to.` : `Pick a save from 2 to ${list.length} (see h${c.name}).`);
    const restored = migrateCharacter(refill(JSON.parse(pick.data), c));
    const idx = state.characters.findIndex(x => x.id === c.id);
    state.characters[idx] = restored;
    persistState('undo').then(() => renderAll());
    return out(`${c.name.toUpperCase()} · ROLLED BACK`, line('↺', `Restored the save from ${esc(new Date(pick.at).toLocaleString())}. This rollback is itself a save: u${esc(c.name)} 2 undoes it.`));
  }

  // =====================================================================
  // CHANGES  audit log of chapter markers → Dossier changes (applied only when you say so)
  // =====================================================================
  let proposals = null;
  const readLog = () => { try { return JSON.parse(localStorage.getItem(MARKER_KEY) || '{}'); } catch (e) { return {}; } };
  const writeLog = l => { try { localStorage.setItem(MARKER_KEY, JSON.stringify(l)); } catch (e) {} };
  function findPlace(name) {
    const k = lc(name); if (!k || !World) return null;
    const all = (World.places ? World.places() : []);
    return all.find(p => lc(p.name) === k) || all.find(p => lc(p.name).includes(k)) || null;
  }
  async function loadProposals() {
    const list = await loadIndex(), outList = [];
    for (const ch of list.filter(c => c.status === 'canon')) {
      let text = '';
      try { const r = await fetch('chapters/' + encodeURIComponent(ch.file), { cache: 'no-cache' }); text = r.ok ? await r.text() : ''; } catch (e) {}
      const present = [...new Set([ch.pov, ...(ch.characters || [])].filter(Boolean))];
      const lastAt = {};
      [...text.matchAll(/%%\s*([a-z]+)\s*:\s*([^%]*?)\s*%%/gi)].forEach((m, i) => {
        const kind = m[1].toLowerCase(), v = m[2].trim(), base = { ch: ch.chapter, idx: i, title: ch.title || '' };
        if (!v) return;
        if (kind === 'dies') outList.push({ ...base, type: 'dies', who: v, text: `${v} dies` });
        else if (kind === 'at') present.forEach(p => { lastAt[p] = { ...base, type: 'at', who: p, place: v, text: `${p} is at ${v}` }; });
        else if (kind === 'travel') { const t = v.match(/^(.+?)\s*->\s*(.+?)(?:\s*\((.+)\))?$/); if (t && ch.pov) lastAt[ch.pov] = { ...base, type: 'at', who: ch.pov, place: t[2], text: `${ch.pov} travels ${t[1]} → ${t[2]}${t[3] ? ' (' + t[3] + ')' : ''}` }; }
        else if (kind === 'item') { const t = v.match(/^(.+?)\s*->\s*(gains|loses)\s+(.+)$/i); if (t) outList.push({ ...base, type: 'item', who: t[1].trim(), gain: t[2].toLowerCase() === 'gains', item: t[3].trim(), text: `${t[1].trim()} ${t[2].toLowerCase()} ${t[3].trim()}` }); }
        else if (kind === 'world') outList.push({ ...base, type: 'world', who: '', text: `Site state: ${v}`, info: true });
      });
      Object.values(lastAt).forEach(p => outList.push(p));
    }
    outList.forEach(p => { p.id = `${p.ch}:${p.type}:${lc(p.who)}:${lc(p.place || p.item || p.text)}`; });
    proposals = outList.sort((a, b) => a.ch - b.ch || a.idx - b.idx);
    return proposals;
  }
  function ensureVersionAt(c, n) {
    const v = versionAt(c, n);
    if (v && startOf(v) === n) return v;
    const base = v || ordered(c)[0];
    const snap = { ...defaultSnapExtras(), ...carryForwardState(base), id: 'snap_' + Date.now() + Math.random().toString(36).slice(2, 6), chapterRange: 'CH ' + n, startChapter: n, blurb: '', backstory: '', portrait: base ? base.portrait : null };
    c.snapshots.push(snap);
    if (!(state.chapters || []).some(x => x.number === n)) { state.chapters = state.chapters || []; state.chapters.push({ id: newId('ch'), number: n, title: '' }); state.chapters.sort((a, b) => a.number - b.number); }
    return snap;
  }
  function applyOne(p) {
    if (p.info) return 'info only (sites aren’t in the Dossier)';
    const c = findChar(p.who); if (!c) return `no file for ${p.who}`;
    if (p.type === 'dies') { const s = ensureVersionAt(c, p.ch); s.presence = 'dead'; return 'done'; }
    if (p.type === 'at') { const pl = findPlace(p.place); if (!pl) return `no place called ${p.place} on the map`; const s = ensureVersionAt(c, p.ch); s.location = World.makeRef(pl.countryId, pl.id); return 'done'; }
    if (p.type === 'item') {
      const s = ensureVersionAt(c, p.ch);
      if (p.gain) {
        if ((s.inventory || []).some(it => lc(invView(it).name) === lc(p.item))) return 'already carried';
        const li = Lib && Lib.get().items.find(i => lc(i.name) === lc(p.item));
        s.inventory = s.inventory || [];
        if (li) { const st = (li.states || [])[0]; s.inventory.push({ id: newId('inv'), itemId: li.id, stateId: st ? st.id : '', note: `CH ${p.ch}`, boundTo: '', marks: Lib.marksFor(li, st ? st.id : ''), name: li.name }); }
        else s.inventory.push({ id: newId('inv'), name: p.item, desc: '', icon: '', image: '', note: `CH ${p.ch}`, boundTo: '', marks: [] });
      } else s.inventory = (s.inventory || []).filter(it => lc(invView(it).name) !== lc(p.item));
      return 'done';
    }
    return 'nothing to do';
  }
  function changesTable() {
    const log = readLog();
    const rows = proposals.map((p, i) => { const st = log[p.id]; return `<tr class="${st ? st.s : 'pending'}"><td>${i + 1}</td><td>CH ${p.ch}</td><td>${esc(p.text)}${p.info ? ' <small>(info)</small>' : ''}</td><td>${st ? esc(st.s === 'applied' ? 'applied' : 'skipped') + (st.msg && st.msg !== 'done' ? ' · ' + esc(st.msg) : '') : 'pending'}</td></tr>`; }).join('');
    const pending = proposals.filter(p => !log[p.id] && !p.info).length;
    return out(`CHAPTER CHANGES · ${pending} PENDING`, proposals.length ? `<table class="bt-table"><thead><tr><th>#</th><th>Ch</th><th>Change</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><div class="bt-hint">changes apply all · changes apply 1 3 · changes skip 2</div>`
      : '<div class="bt-l">No markers found in published canon chapters yet.</div>');
  }
  function changes(arg) {
    return later(async () => {
      if (!proposals) await loadProposals();
      const a = (arg || '').trim().toLowerCase();
      if (!a) return changesTable();
      const m = a.match(/^(apply|skip)\s+(all|[\d\s,]+)$/);
      if (!m) return err('Use: changes · changes apply all · changes apply 1 3 · changes skip 2');
      const log = readLog();
      const picks = m[2] === 'all' ? proposals.filter(p => !log[p.id]) : m[2].split(/[\s,]+/).filter(Boolean).map(n => proposals[+n - 1]).filter(Boolean);
      let did = 0;
      picks.forEach(p => { if (m[1] === 'skip') { log[p.id] = { s: 'skipped', at: Date.now() }; return; } const msg = applyOne(p); log[p.id] = { s: msg === 'done' || msg === 'already carried' ? 'applied' : 'skipped', msg, at: Date.now() }; if (msg === 'done') did++; });
      writeLog(log);
      if (did) { state.characters = state.characters.map(migrateCharacter); await persistState('chapter markers'); renderAll(); }
      return changesTable();
    });
  }
  const pendingCount = () => proposals ? proposals.filter(p => !readLog()[p.id] && !p.info).length : 0;

  // =====================================================================
  // EXPORT  export Orin  → a Markdown note for the vault
  // =====================================================================
  function exportChar(c) {
    const type = (RACES.find(r => r.id === c.race) || {}).label || '';
    const lore = c.lore || {};
    const fm = ['---', 'type: character', `faction: ${c.faction || ''}`, `kind: ${type}`, c.authority ? `concept: ${c.authority}` : '', lore.plane ? `plane: ${lore.plane}` : '', lore.god ? `bound-god: ${lore.god}` : '', lore.origin ? `origin: ${lore.origin}` : '', `exported: ${new Date().toISOString().slice(0, 10)}`, '---'].filter(Boolean);
    const body = ordered(c).map(s => '## ' + (s.chapterRange || 'Version') + '\n' + briefPlainText(c, s).split('\n').slice(1).map(l => { const i = l.indexOf(': '); return i > 0 ? `- **${l.slice(0, i)}:** ${l.slice(i + 2)}` : '- ' + l; }).join('\n')).join('\n\n');
    const md = `${fm.join('\n')}\n# ${c.name}\n\n> Exported from the Epitaph Dossier. The site is the record; edit there.\n\n${body}\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    a.download = `${c.name}.md`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    return out(`EXPORT ${c.name.toUpperCase()}`, line('↓', `Downloaded <b>${esc(c.name)}.md</b>. Drop it into the vault's <i>World Buildinig/Character Work</i> folder.`));
  }

  // =====================================================================
  // HELP + the command router
  // =====================================================================
  function help() {
    const r = (cmd, what, ex) => `<tr><td><b>${cmd}</b></td><td>${what}${ex ? `<br><small>e.g. ${ex}</small>` : ''}</td></tr>`;
    return out('COMMANDS', `<table class="bt-table help"><tbody>
      ${r('c<i>Name</i> <i>ch</i> <i>ch</i>', 'Compare two chapters of a character: everything that changed.', 'cOrin 1 265 · cOrin 1-265')}
      ${r('s: who knows <i>X</i>', 'Who knows about X: when they met them, how the bond changed, what they know and since when.', 's: who knows sils · s: who knows Nera')}
      ${r('s: who is in <i>place</i> [<i>ch</i>]', 'Who was there and when they arrived and left. Add a chapter for a detailed list at that point.', 's: who is in aurelia · s: who is in aurelia 1')}
      ${r('s: who holds <i>X</i>', 'Items, marks, skills, Cuts, gifts and Heralds: who holds it, since when, how they got it.', 's: who holds seal · s: who holds wither')}
      ${r('ch<i>Name</i>', 'Every published chapter they appear in, with links to read them.', 'chOrin')}
      ${r('h<i>Name</i>', 'Their save history (every save is kept automatically, newest first).', 'hOrin')}
      ${r('u<i>Name</i> [<i>n</i>]', 'Roll back to save n from the history (default: the save before the last). Undoable.', 'uOrin · uOrin 3')}
      ${r('changes', 'Audit log of changes from your chapter markers (dies, at, travel, item). Nothing applies until you say so.', 'changes · changes apply all · changes apply 1 3 · changes skip 2')}
      ${r('export <i>Name</i>', 'Download a character as a Markdown note for the Obsidian vault.', 'export Orin')}
      ${r('opl · ops · back · clear', 'The Library · the skill tree · the storybook page · empty this log.', '')}
      </tbody></table>
      <div class="bt-hint">Automatic: two-way ties · shared secrets · save history · a "what changed?" prompt after a new chapter · more lore warnings in Checks.</div>`);
  }
  const baseRun = runStorybookCommand;
  runStorybookCommand = function (cmd) {
    const t = cmd.trim(), lower = t.toLowerCase();
    let m;
    if (lower === 'help' || lower === '?') return help();
    if (['clear', 'opl', 'open library', 'open lib', 'ops', 'open skills', 'open skill', 'back', 'home'].includes(lower)) return baseRun(cmd);
    if ((m = t.match(/^s\s*:\s*(.+)$/i))) return search(m[1]);
    if ((m = t.match(/^changes\b\s*(.*)$/i))) return changes(m[1]);
    if ((m = t.match(/^export\s+(.+)$/i))) { const c = findChar(m[1]); return c ? exportChar(c) : err(`No character called “${m[1]}”.`); }
    if ((m = t.match(/^ch\s*([^\d\s][^\d]*?)\s*$/i)) && findChar(m[1])) return chaptersOf(findChar(m[1]));
    if ((m = t.match(/^c\s*([^\d\s][^\d]*?)\s+(\d+)\s*(?:-|–|\s)\s*(\d+)\s*$/i))) { const c = findChar(m[1]); return c ? compare(c, +m[2], +m[3]) : err(`No character called “${m[1]}”.`); }
    if ((m = t.match(/^h\s*([^\d\s][^\d]*?)\s*$/i)) && findChar(m[1])) return history(findChar(m[1]));
    if ((m = t.match(/^u\s*([^\d\s][^\d]*?)(?:\s+(\d+))?\s*$/i)) && findChar(m[1])) return undo(findChar(m[1]), m[2] ? +m[2] : 2);
    return baseRun(cmd);
  };

  // =====================================================================
  // AUTOMATIC: two-way ties, shared secrets, history — on every save
  // =====================================================================
  function automate() {
    const toasts = [];
    chars().forEach(c => {
      const prev = lastSaved(c.id); if (!prev) return;
      c.snapshots.forEach(s => {
        const ps = (prev.snapshots || []).find(x => x.id === s.id);
        const n = startOf(s);
        // two-way ties: a newly added linked tie adds this character to the other file
        (s.relationships || []).forEach(r => {
          if (!r.charId || r.charId === c.id) return;
          if (ps && (ps.relationships || []).some(x => x.charId === r.charId)) return;
          const other = chars().find(x => x.id === r.charId); if (!other) return;
          const ov = versionAt(other, n) || ordered(other)[0]; if (!ov || isLocked(ov)) return;
          if ((ov.relationships || []).some(x => x.charId === c.id || lc(x.name) === lc(c.name))) return;
          ov.relationships = ov.relationships || [];
          ov.relationships.push({ name: c.name, relation: '', note: '', charId: c.id });
          toasts.push(`Added ${c.name} to ${other.name}'s ties — set how ${other.name} sees them.`);
        });
        // shared secrets: "known by X" adds the secret to X's file
        (s.secrets || []).forEach(sc => {
          if (!sc.text || !sc.knownBy) return;
          const old = ps && (ps.secrets || []).find(x => lc(x.text) === lc(sc.text));
          if (old && lc(old.knownBy) === lc(sc.knownBy)) return;
          sc.knownBy.split(/,|&|\band\b/i).map(x => x.trim()).filter(Boolean).forEach(name => {
            const other = findChar(name); if (!other || other.id === c.id || lc(other.name) !== lc(name)) return;
            const ov = versionAt(other, n) || ordered(other)[0]; if (!ov || isLocked(ov)) return;
            if ((ov.secrets || []).some(x => lc(x.text) === lc(sc.text))) return;
            ov.secrets = ov.secrets || [];
            ov.secrets.push({ text: sc.text, characterKnows: true, knownBy: c.name });
            toasts.push(`${other.name} now knows: “${sc.text}”.`);
          });
        });
      });
    });
    toasts.slice(0, 3).forEach((t, i) => setTimeout(() => showToast(t, { duration: 5500 }), i * 600));
  }
  const basePersist = persistState;
  persistState = async function (note) {
    try { automate(); } catch (e) { console.error('automation', e); }
    await basePersist();
    try { recordHistory(typeof note === 'string' ? note : ''); } catch (e) { console.error('history', e); }
  };
  // baseline so the first edit has something to compare against
  try { recordHistory('opened'); } catch (e) {}

  // =====================================================================
  // AUTOMATIC: "what changed?" after a new chapter, and the chapter-changes notice in the brief
  // =====================================================================
  let watchNewChapter = null;
  const baseOpenSnap = openSnapshotForm;
  openSnapshotForm = function () { const c = getActiveCharacter(); watchNewChapter = c ? { id: c.id, count: c.snapshots.length } : null; return baseOpenSnap.apply(this, arguments); };
  function whatChangedPrompt(c, s) {
    const opts = [
      ['Moved, or wants something new', () => openChapterStateForm(c, s)], ['Refined their name / titles', () => openIdentityForm(c, s)],
      ['New or changed skills', () => openSkillsOnlyForm(c, s)], ['Gained or lost items', () => openInventoryOnlyForm(c, s)],
      ['A Cut, gift, rank or Threat', () => openPowerForm(c, s)], ['Marks', () => openMarksForm(c, s)], ['Ties', () => openRelationshipsOnlyForm(c, s)],
      ['Learned something / secrets', () => openKnowledgeOnlyForm(c, s)], ['Stats', () => openStatsOnlyForm(c, s)]
    ].filter(([label]) => !(label.startsWith('New or changed skills') && !canHaveSkills(c)) && !(label === 'Stats' && !hasStats(c)));
    modalContent.innerHTML = `<h2>What changed by ${esc(s.chapterRange || 'this chapter')}?</h2><p class="sub">Everything was copied from the last chapter. Pick what's different; each opens its editor. Do the rest any time from the tabs.</p>
      <div class="wc-grid">${opts.map(([l], i) => `<button type="button" class="ed-chip" data-wc="${i}" style="transform:none;min-height:48px;text-align:left;padding:0 14px">${esc(l.toUpperCase())}</button>`).join('')}</div>
      <div class="modal-actions"><span></span><button class="btn primary" type="button" onclick="closeModal()">Nothing else changed</button></div>`;
    modalContent.querySelectorAll('[data-wc]').forEach(b => b.addEventListener('click', () => opts[+b.dataset.wc][1]()));
    openModal();
  }
  const baseRenderAll = renderAll;
  renderAll = function () {
    baseRenderAll.apply(this, arguments);
    if (watchNewChapter) {
      const c = chars().find(x => x.id === watchNewChapter.id);
      if (c && c.snapshots.length > watchNewChapter.count) { watchNewChapter = null; const s = getActiveSnapshot(c); setTimeout(() => whatChangedPrompt(c, s), 350); }
    }
    noteChanges();
  };
  function noteChanges() {
    const paint = () => {
      const chips = document.querySelector('#briefBody .bf-chips'); if (!chips || chips.querySelector('.bf-changes')) return;
      const n = pendingCount(); if (!n) return;
      const el = document.createElement('span'); el.className = 'bf-chip bf-changes'; el.textContent = `${n} chapter change${n === 1 ? '' : 's'} · type “changes” in the book`;
      chips.appendChild(el);
    };
    if (proposals) return paint();
    loadIndex().then(l => { if (l.some(c => c.status === 'canon')) loadProposals().then(paint); });
  }
  setTimeout(noteChanges, 800);
})();
