/* Epitaph — Mode: is this browser the author's, and is the author looking at everything or previewing as a reader?
 * (docs/plans/publish-readonly.md, Phase 0.3 and 1.1.) Loaded in the <head> of every page, so the page is marked before it draws.
 *
 *   isAuthor()      this browser belongs to the author: editing is possible here.
 *                   Remembered per browser ('epitaph-author': '1' on, '0' off). With nothing remembered it is on for
 *                   localhost, 127.0.0.1, [::1] and file://, and off everywhere else: readers are the default.
 *                   Turn it on once with  ?author=1  (off with ?author=0); the parameter is then removed from the address bar.
 *   authorView()    isAuthor() and not previewing as a reader. This is the one that gates editing and what readers can't see.
 *                   The author's "preview as reader" choice is 'epitaph-author-mode' ('0' = preview).
 *   canEdit()       same as authorView(): while previewing as a reader nothing is editable either.
 *   setAuthor(on)   on: true / false / null (null = forget it and go back to the host default).
 *   setAuthorView(on)  author view or preview-as-reader; ignored in a browser that isn't the author's.
 *   onChange(fn)    fn() when any of it changes, here or in another tab. Returns an unsubscribe.
 *
 * It sets classes on <html>: is-author (this browser is the author's), mode-author (full author view), mode-reader (a reader's view,
 * real or previewed), so CSS can hide edit controls with  .mode-reader .edit-only { display:none }.
 * This is a convenience, not security: static pages can't log anyone in. The real protection is that secrets are never published.
 */
(function (global) {
  'use strict';
  const AUTHOR_KEY = 'epitaph-author';
  const VIEW_KEY = 'epitaph-author-mode';   // the same key the timeline's Author/Reader switch has always used
  const EVENT = 'epitaph-mode';

  const read = k => { try { return global.localStorage.getItem(k); } catch (e) { return null; } };
  const write = (k, v) => { try { v == null ? global.localStorage.removeItem(k) : global.localStorage.setItem(k, v); return true; } catch (e) { return false; } };

  function isLocalHost() {
    const loc = global.location || {};
    return loc.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]', '::1'].includes(loc.hostname);
  }
  function isAuthor() {
    const v = read(AUTHOR_KEY);
    return v === '1' ? true : v === '0' ? false : isLocalHost();
  }
  const authorView = () => isAuthor() && read(VIEW_KEY) !== '0';
  const canEdit = authorView;

  function apply() {
    const root = global.document && global.document.documentElement;
    if (!root || !root.classList) return;
    const author = isAuthor(), view = authorView();
    root.classList.toggle('is-author', author);
    root.classList.toggle('mode-author', view);
    root.classList.toggle('mode-reader', !view);
  }
  function changed() {
    apply();
    if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') global.dispatchEvent(new global.CustomEvent(EVENT));
  }
  function setAuthor(on) {
    write(AUTHOR_KEY, on === true ? '1' : on === false ? '0' : null);
    changed();
    return isAuthor();
  }
  function setAuthorView(on) {
    if (!isAuthor()) return false;          // a reader can't switch themselves into the author's view
    write(VIEW_KEY, on ? '1' : '0');
    changed();
    return authorView();
  }
  function onChange(fn) {
    if (typeof global.addEventListener !== 'function') return () => {};
    const local = () => fn();
    const other = e => { if (e.key === AUTHOR_KEY || e.key === VIEW_KEY) { apply(); fn(); } };
    global.addEventListener(EVENT, local); global.addEventListener('storage', other);
    return () => { global.removeEventListener(EVENT, local); global.removeEventListener('storage', other); };
  }

  // ?author=1 / ?author=0: remember it, then take it out of the address bar
  function fromAddress() {
    const loc = global.location;
    if (!loc || typeof global.URLSearchParams !== 'function') return;
    let q; try { q = new global.URLSearchParams(loc.search || ''); } catch (e) { return; }
    const v = q.get('author');
    if (v !== '1' && v !== '0') return;
    write(AUTHOR_KEY, v);
    q.delete('author');
    try {
      const rest = q.toString();
      if (global.history && typeof global.history.replaceState === 'function') global.history.replaceState(null, '', loc.pathname + (rest ? '?' + rest : '') + (loc.hash || ''));
    } catch (e) {}
  }

  // ---- the small vertical tag on the left edge (plan step 1.2); the map's corners and bottom bar are all in use ----
  // Readers see "Reading". The author sees "Author" (a button: click to preview what a reader sees) or "Preview · reader" (click to go back).
  // Nothing on the page tells a reader that an author view exists.
  function tagText() {
    if (!isAuthor()) return { label: 'Reading', title: 'You are reading the published site.', author: false };
    return authorView()
      ? { label: 'Author', title: 'You see everything. Click to preview what a reader sees.', author: true }
      : { label: 'Preview · reader', title: 'You are previewing what a reader sees. Click to go back to the author view.', author: true };
  }
  function drawTag() {
    const doc = global.document; if (!doc || !doc.body || typeof doc.getElementById !== 'function') return;
    let el = doc.getElementById('epitaphModeTag');
    const t = tagText();
    if (!el || (el.tagName === 'BUTTON') !== t.author) {
      if (el) el.remove();
      el = doc.createElement(t.author ? 'button' : 'span');
      el.id = 'epitaphModeTag'; if (t.author) el.type = 'button';
      if (t.author) el.addEventListener('click', () => setAuthorView(!authorView()));
      doc.body.appendChild(el);
    }
    el.textContent = t.label; el.title = t.title;
    el.setAttribute('data-mode', !isAuthor() ? 'reader' : authorView() ? 'author' : 'preview');
    if (t.author) el.setAttribute('aria-pressed', String(!authorView())); else el.removeAttribute('aria-pressed');
    el.setAttribute('aria-label', t.title);
  }
  function mountTag() {
    const doc = global.document; if (!doc || typeof doc.getElementById !== 'function') return;
    if (!doc.getElementById('epitaphModeTagStyle') && doc.head) {
      const st = doc.createElement('style'); st.id = 'epitaphModeTagStyle';
      st.textContent = '#epitaphModeTag{position:fixed;z-index:60;left:env(safe-area-inset-left,0px);top:50%;transform:translateY(-50%) rotate(180deg);writing-mode:vertical-rl;'
        + 'font:10px/1 "Space Mono",ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;color:var(--amber,#ffb238);background:rgba(8,6,3,.78);'
        + 'border:1px solid var(--amber-dim,rgba(255,178,56,.4));border-left:0;padding:9px 4px;opacity:.7;margin:0;border-radius:0}'
        + 'button#epitaphModeTag{cursor:pointer}#epitaphModeTag:hover,#epitaphModeTag:focus-visible{opacity:1}#epitaphModeTag:focus-visible{outline:1px solid var(--amber,#ffb238);outline-offset:2px}'
        + '#epitaphModeTag[data-mode=preview]{color:#8aa0c8;border-color:#8aa0c8;border-style:dashed}'
        + '@media print{#epitaphModeTag{display:none}}'
        + '.mode-reader .edit-only{display:none!important}';   // anything an author edits with carries class edit-only
      doc.head.appendChild(st);
    }
    drawTag();
  }
  fromAddress();
  apply();
  if (global.document) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', mountTag); else mountTag();
    onChange(drawTag);
  }
  global.EpitaphMode = { AUTHOR_KEY, VIEW_KEY, EVENT, isLocalHost, isAuthor, authorView, canEdit, setAuthor, setAuthorView, onChange, apply };
})(typeof window !== 'undefined' ? window : globalThis);
