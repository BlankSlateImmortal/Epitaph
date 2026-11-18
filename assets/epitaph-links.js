/* Epitaph — Links: one format for pointing at a place, a creature or a character, from any page.
 *
 *   place:<id>      a map place (EpitaphWorld ids, e.g. place:aurelia)
 *   creature:<id>   a Creature Log entry (the log isn't built yet)
 *   char:<id|name>  a Dossier character, by id or by name (char:Orin)
 *
 * EpitaphLinks.open(ref) opens the right page. A page that can show the thing itself (the book's
 * encyclopedias, later) registers a handler with register(kind, fn); with none, the link falls back
 * to a page that can: the map for places, the Dossier for characters. A handler returns true when it
 * handled the link. Any element with data-ref="place:aurelia" opens on click, on any page that loads this file.
 */
(function (global) {
  'use strict';
  const KINDS = ['place', 'creature', 'char'];
  const handlers = {};

  const norm = s => String(s == null ? '' : s).trim().toLowerCase();
  function parse(ref) {
    if (ref && typeof ref === 'object' && KINDS.includes(ref.kind) && ref.id != null) return { kind: ref.kind, id: String(ref.id) };
    const m = /^(place|creature|char):(.+)$/.exec(String(ref == null ? '' : ref).trim());
    return m && m[2].trim() ? { kind: m[1], id: m[2].trim() } : null;
  }
  const format = (kind, id) => kind + ':' + id;

  function characters() {
    try { const st = JSON.parse(localStorage.getItem('epitaph-character-profiles') || 'null'); return (st && Array.isArray(st.characters)) ? st.characters : []; }
    catch (e) { return []; }
  }
  function findChar(idOrName) {
    const list = characters(), k = norm(idOrName);
    return list.find(c => c.id === idOrName) || list.find(c => norm(c.name) === k) || null;
  }

  /** { kind, id, name, exists } for a link. `id` is the real id (a char:<name> link becomes the character's id);
   *  `exists` is null when it can't be known yet (creatures, until the log is built). */
  function resolve(ref) {
    const p = parse(ref);
    if (!p) return null;
    if (p.kind === 'place') {
      const pl = global.EpitaphWorld && global.EpitaphWorld.place(p.id);
      return { kind: 'place', id: p.id, name: pl ? pl.name : p.id, exists: !!pl };
    }
    if (p.kind === 'char') {
      const c = findChar(p.id);
      return { kind: 'char', id: c ? c.id : p.id, name: c ? (c.name || 'Unnamed') : p.id, exists: !!c };
    }
    const cr = global.EpitaphCreatures && typeof global.EpitaphCreatures.byId === 'function' ? global.EpitaphCreatures.byId(p.id) : undefined;
    return { kind: 'creature', id: p.id, name: cr ? cr.name : p.id, exists: cr === undefined ? null : !!cr };
  }

  /** The page that shows this link when no handler is registered; null when there isn't one yet. */
  function href(ref) {
    const r = resolve(ref);
    if (!r) return null;
    if (r.kind === 'place') return 'atlas-3d.html?place=' + encodeURIComponent(r.id);
    if (r.kind === 'char') return 'index.html?char=' + encodeURIComponent(r.id);
    return null;
  }

  function register(kind, fn) { if (KINDS.includes(kind) && typeof fn === 'function') handlers[kind] = fn; }

  /** Open a link. Returns a short message for the terminal ('' when something opened). */
  function open(ref) {
    const r = resolve(ref);
    if (!r) return 'That is not a link: use place:<id>, creature:<id> or char:<name>.';
    if (r.exists === false) return `No ${r.kind === 'char' ? 'character' : r.kind} called “${r.name}”.`;
    if (handlers[r.kind]) { try { if (handlers[r.kind](r.id, r) === true) return ''; } catch (e) { console.error(e); } }
    const to = href(r);
    if (!to) return r.kind === 'creature' ? 'The Creature Log is not built yet.' : 'Nothing to open.';
    global.location.href = to;
    return '';
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
      const el = e.target && e.target.closest ? e.target.closest('[data-ref]') : null;
      if (!el || !parse(el.getAttribute('data-ref'))) return;
      e.preventDefault();
      open(el.getAttribute('data-ref'));
    });
  }

  global.EpitaphLinks = { KINDS, parse, format, resolve, href, register, open };
})(typeof window !== 'undefined' ? window : globalThis);
