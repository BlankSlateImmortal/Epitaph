/* Epitaph — one navigation bar and one footer for every page (docs/plans/publish-readonly.md, step 5.2).
 *
 * Usage: <script src="assets/epitaph-nav.js"></script> after epitaph-mode.js (sites/ pages: ../assets/...). Options on the tag:
 *   data-nav="bar"      (default) a strip at the top of the page, a footer at the end
 *   data-nav="links"    for full-screen pages (the Map, the 3D site scenes): no strip, no footer; the links are drawn into every
 *                       element carrying data-site-links, so the page's own header keeps its layout
 * The one list of places is SITE below: add a page here and every page has it. Muses is the author's (readers never see it).
 * The current page gets aria-current="page". The Dossier updates the Map link to carry its character (a[data-nav-key="map"]).
 */
(function (global) {
  'use strict';
  const doc = global.document; if (!doc) return;
  const tag = doc.currentScript;
  const mode = (tag && tag.getAttribute('data-nav')) || 'bar';
  const base = (tag && tag.getAttribute('src') || '').replace(/assets\/epitaph-nav\.js.*$/, '');   // '' or '../'
  const SITE = [
    { key: 'home', label: 'Home', href: 'index.html' },
    { key: 'read', label: 'Read', href: 'read.html' },
    { key: 'dossier', label: 'Dossier', href: 'dossier.html' },
    { key: 'map', label: 'Map', href: 'atlas-3d.html' },
    { key: 'book', label: 'Book', href: 'dossier.html?book=1' },
    { key: 'powers', label: 'Powers', href: 'powers.html' },
    { key: 'muses', label: 'Muses', href: 'muses.html', author: true }
  ];
  const here = (global.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const isHere = it => it.href.split('?')[0].toLowerCase() === here && !it.href.includes('?') || (here.startsWith('aurelia') || here.startsWith('hollow')) && it.key === 'map';
  const isAuthor = () => !!(global.EpitaphMode && global.EpitaphMode.isAuthor && global.EpitaphMode.isAuthor());
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const items = () => SITE.filter(it => !it.author || isAuthor());
  const links = cls => items().map(it => `<a class="${cls}" data-nav-key="${it.key}" href="${esc(base + it.href)}"${isHere(it) ? ' aria-current="page"' : ''}>${esc(it.label)}</a>`).join('');

  function css() {
    if (doc.getElementById('epitaphNavStyle')) return;
    const st = doc.createElement('style'); st.id = 'epitaphNavStyle';
    st.textContent = `
.site-nav{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:7px 16px;background:var(--ink-deep,#040302);border-bottom:1px solid var(--line,rgba(255,178,56,.17));font:12px/1 var(--f-mono,"Space Mono",monospace);position:relative;z-index:40}
.site-nav a,.site-links a{color:var(--dust,#b5904f);text-decoration:none;letter-spacing:.08em;text-transform:uppercase;padding:8px 10px;border:1px solid transparent}
.site-nav a:hover,.site-nav a:focus-visible,.site-links a:hover,.site-links a:focus-visible{color:var(--amber-hi,#ffd58a);border-color:var(--line,rgba(255,178,56,.17));outline:none}
.site-nav a[aria-current=page],.site-links a[aria-current=page]{color:var(--amber,#ffb238);border-color:var(--amber-dim,#8a5a14)}
.site-nav a[data-nav-key=home]{font-family:var(--f-display,Anton,sans-serif);font-size:16px;letter-spacing:.1em;color:var(--amber,#ffb238);margin-right:8px;padding-left:0}
.site-links{display:inline-flex;gap:2px;flex-wrap:wrap;align-items:center;font:11px/1 var(--f-mono,"Space Mono",monospace)}
.site-links a{padding:6px 8px}
.site-foot{display:flex;flex-wrap:wrap;gap:8px 22px;justify-content:space-between;padding:22px 16px 30px;margin-top:40px;border-top:1px solid var(--line,rgba(255,178,56,.17));font:12px/1.5 var(--f-mono,"Space Mono",monospace);color:var(--amber-dim,#8a5a14)}
.site-foot a{color:var(--dust,#b5904f);text-decoration:none}.site-foot a:hover,.site-foot a:focus-visible{color:var(--amber-hi,#ffd58a)}
.site-foot nav{display:flex;gap:16px;flex-wrap:wrap}
.site-skip{position:absolute;left:-999px;top:0;background:var(--amber,#ffb238);color:#080603;padding:8px 12px;z-index:100;font:12px var(--f-mono,monospace)}.site-skip:focus{left:8px;top:8px}
@media print{.site-nav,.site-foot,.site-skip{display:none}}`;
    (doc.head || doc.documentElement).appendChild(st);
  }

  function mount() {
    css();
    if (mode === 'links') { doc.querySelectorAll('[data-site-links]').forEach(el => { el.classList.add('site-links'); el.innerHTML = links(''); }); return; }
    if (!doc.getElementById('siteNav')) {
      const nav = doc.createElement('nav'); nav.id = 'siteNav'; nav.className = 'site-nav'; nav.setAttribute('aria-label', 'Site'); nav.innerHTML = links('');
      doc.body.insertBefore(nav, doc.body.firstChild);
      const main = doc.querySelector('main, #main, .app'); if (main && !main.id) main.id = 'mainContent';
      const skip = doc.createElement('a'); skip.className = 'site-skip'; skip.href = '#' + ((main && main.id) || 'siteNav'); skip.textContent = 'Skip to content';
      doc.body.insertBefore(skip, doc.body.firstChild);
    }
    if (!doc.getElementById('siteFoot')) {
      const f = doc.createElement('footer'); f.id = 'siteFoot'; f.className = 'site-foot';
      f.innerHTML = `<span>EPITAPH · a serial story</span><nav aria-label="Footer">${links('')}</nav>`;
      doc.body.appendChild(f);
    }
  }
  function applyMapHref() { if (global.EpitaphNavMapHref) doc.querySelectorAll('#siteNav a[data-nav-key=map]').forEach(a => { a.href = global.EpitaphNavMapHref; }); }
  const redraw = () => { const n = doc.getElementById('siteNav'); if (n) n.innerHTML = links(''); const f = doc.querySelector('#siteFoot nav'); if (f) f.innerHTML = links(''); doc.querySelectorAll('[data-site-links]').forEach(el => { el.innerHTML = links(''); }); };
  const start = () => { mount(); applyMapHref(); };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
  if (global.EpitaphMode && global.EpitaphMode.onChange) global.EpitaphMode.onChange(redraw);
  global.EpitaphNav = { SITE, redraw };
})(typeof window !== 'undefined' ? window : globalThis);
