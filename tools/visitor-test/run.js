// Publish step 3.5: a test as a visitor (docs/plans/publish-readonly.md).
// Opens every page in headless Chromium as a stranger would: a non-local host name (so EpitaphMode is "reader" without ?author=0),
// a fresh browser profile with empty storage, and no flags. Checks, per page and per book view:
//   1. the page is in reader mode and loaded the published snapshot (EpitaphReaderData);
//   2. no write control is visible (forms, editors, import/merge/export, delete, add/new buttons);
//   3. nothing the snapshot owns or the author keeps private reaches the real localStorage; only the keys in ALLOWED do;
//   4. no uncaught errors;
//   5. with the synthetic snapshot (fixture.js): its character shows, and its secrets, later-chapter text and unpublished character don't.
// Runs twice: with the repo's own published/epitaph-data.js ("live") and with the synthetic one ("fixture").
// Usage: node tools/visitor-test/run.js     (needs chromium on PATH; Node 22+ for the built-in WebSocket)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn, execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const HOST = 'epitaph.test';
const PAGES = ['index.html', 'dossier.html', 'atlas-3d.html', 'muses.html', 'powers.html', 'read.html'].concat(
  fs.readdirSync(path.join(ROOT, 'sites')).filter(f => f.endsWith('.html')).map(f => 'sites/' + f));
const BOOK = ['opl', 'ops', 'opse', 'opcl'];
// keys a reader's browser may really store: their own chapter position and harmless view preferences
const ALLOWED = /^epitaph-(reader-chapter|reader-last|author-mode|map-theme|theme|atlas-view|view|ui-|terminal-)/;
// what a visitor must never be offered (visible): selectors and button words
const WRITE_SEL = 'form:not([role=search]):not(.search), textarea, [contenteditable=""], [contenteditable=true], input[type=file], #bkNewItem, #bkFold, #bsNewRoot, #bsNewFor, .se-edbar, .se-pen, .se-add, [data-se-new], [data-se-approve], [data-se-undo], .cl-del, .cl-new[data-new], [data-edit], #addMuse, #resetMuses';
const WRITE_WORD = /^\s*(\+\s*\S|save|delete|remove|edit|new\b|add\b|import|merge|export|publish|restore|reset|approve|undo|upload|✎)/i;

const FIXTURE = execFileSync(process.execPath, [path.join(__dirname, 'fixture.js')]).toString();
let snapshotOverride = null;

// ---- a tiny static server (the published/epitaph-data.js answer can be swapped for the fixture) ----
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.webp': 'image/webp', '.md': 'text/plain' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/chapters/index.json' && snapshotOverride) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify([{ chapter: 1, title: 'Test Chapter One', file: '001-test-chapter-one.md' }])); }
  if (p === '/published/epitaph-data.js' && snapshotOverride) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(snapshotOverride); }
  const f = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

// ---- Chromium over the DevTools protocol ----
function launch(port) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epitaph-visitor-'));
  const proc = spawn('chromium', ['--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--user-data-dir=' + dir, '--remote-debugging-port=0', `--host-resolver-rules=MAP ${HOST} 127.0.0.1`, 'about:blank'], { stdio: 'ignore' });
  return new Promise((ok, bad) => {
    const t0 = Date.now(), file = path.join(dir, 'DevToolsActivePort');
    (function wait() {
      if (fs.existsSync(file)) { const [p, wsPath] = fs.readFileSync(file, 'utf8').split('\n'); if (wsPath) return ok({ proc, dir, ws: `ws://127.0.0.1:${p}${wsPath}` }); }
      if (Date.now() - t0 > 20000) return bad(new Error('chromium did not start'));
      setTimeout(wait, 100);
    })();
  });
}
function cdp(url) {
  const ws = new WebSocket(url); let id = 0; const calls = {}, subs = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && calls[d.id]) { const c = calls[d.id]; delete calls[d.id]; d.error ? c.bad(new Error(d.error.message)) : c.ok(d.result); } else subs.forEach(f => f(d)); };
  const send = (method, params = {}, sessionId) => new Promise((ok, bad) => { const i = ++id; calls[i] = { ok, bad }; ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  return new Promise(ok => { ws.onopen = () => ok({ send, on: f => subs.push(f), close: () => ws.close() }); });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// the standalone 3D site scenes (sites/*.html) read no stored data, so they carry no mode; they are still checked for writes and storage
const STATIC = p => p.startsWith('sites/');
// the front door reads only chapters/index.json: reader mode, but no snapshot layer
const LIGHT = p => p === 'index.html';

// runs in the page: what a visitor can see
function inspect(WRITE_SEL, WRITE_WORD_SRC) {
  const WORD = new RegExp(WRITE_WORD_SRC, 'i');
  const vis = el => { if (!el.getClientRects().length) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0; };
  const label = el => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + ' "' + (el.textContent || el.value || '').trim().slice(0, 40) + '"');
  const writers = new Set();
  // a disabled field shows a value the way a locked chapter does; it is not a write control
  document.querySelectorAll(WRITE_SEL).forEach(el => { if (vis(el) && !el.disabled && !el.readOnly) writers.add(label(el)); });
  document.querySelectorAll('button, a.btn, [role=button]').forEach(el => { if (vis(el) && !el.disabled && WORD.test(el.textContent || '')) writers.add(label(el)); });
  // editable fields that are enabled (search boxes and the terminal are reading tools)
  document.querySelectorAll('input:not([type=hidden]):not([type=search]):not([type=range]):not([type=checkbox]):not([type=radio])').forEach(el => {
    if (!vis(el) || el.disabled || el.readOnly) return;
    if (/search|filter|terminal|find|query|chapter|jump|ruler/i.test((el.id || '') + ' ' + (el.name || '') + ' ' + (el.placeholder || '') + ' ' + (el.getAttribute('aria-label') || ''))) return;
    writers.add(label(el));
  });
  return { cls: document.documentElement.className, reader: !!window.EpitaphReaderData, through: window.EpitaphReaderData ? window.EpitaphReaderData.publishedThrough : 'none', writers: [...writers], text: document.body ? document.body.innerText : '' };
}

async function visit(c, port, page, scenario) {
  const { browserContextId } = await c.send('Target.createBrowserContext');      // a fresh, empty profile per page
  const { targetId } = await c.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => c.send(m, p, sessionId), errors = [];
  c.on(d => {
    if (d.sessionId !== sessionId) return;
    if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception || {}).description || d.params.exceptionDetails.text);
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon|Failed to load resource/.test(d.params.entry.text)) errors.push(d.params.entry.text);
  });
  await s('Runtime.enable'); await s('Log.enable'); await s('Page.enable'); await s('DOMStorage.enable');
  const origin = `http://${HOST}:${port}`;
  await s('Page.navigate', { url: `${origin}/${page}` });
  const ev = async (fn, ...args) => { const r = await s('Runtime.evaluate', { expression: `(${fn})(${args.map(a => JSON.stringify(a)).join(',')})`, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + ((r.exceptionDetails.exception || {}).description || '')); return r.result.value; };
  // wait for the page to finish loading (CDN scripts can be slow), then give its scripts time to draw
  for (let t = 0; t < 60; t++) { let done = false; try { done = await ev(() => document.readyState === 'complete' && location.href !== 'about:blank'); } catch (e) { /* navigating */ } if (done) break; await sleep(500); }
  await sleep(page.startsWith('atlas') || page.startsWith('sites/') ? 6000 : 2500);
  const views = [{ view: page, ...(await ev(inspect, WRITE_SEL, WRITE_WORD.source)) }];
  if (page === 'dossier.html') {
    // the book and each of its views, the way a reader would open them
    await ev(() => { if (typeof openTheBook === 'function') openTheBook(); });
    await sleep(2500);
    for (const cmd of BOOK) {
      await ev(cmd => { const log = document.getElementById('terminalLog'); if (log && typeof runStorybookCommand === 'function') log.innerHTML += '<div>' + runStorybookCommand(cmd) + '</div>'; }, cmd);
      await sleep(1500);
      // open the first entry of the view too, where the editors live
      await ev(() => { const el = document.querySelector('#bookStage .bk-node, #bookStage [data-id], #bookStage .bk-item, #bookStage [data-se-site], #bookStage .cl-card'); if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      // in the encyclopedia, open an entry the snapshot has (the fixture's open site), where the edit bar and pens would be
      if (cmd === 'opse') await ev(() => { const S = window.EpitaphSites, E = window.EpitaphSiteEntry; const r = S && S.load()[0]; if (r && E) E.open(r.placeId, 'overview'); });
      await sleep(800);
      const r = await ev(inspect, WRITE_SEL, WRITE_WORD.source);
      views.push({ view: page + ' > ' + cmd, ...r });
    }
    const help = await ev(() => typeof runStorybookCommand === 'function' ? runStorybookCommand('help') : '');
    const blocked = await ev(() => typeof runStorybookCommand === 'function' ? runStorybookCommand('changes') : '');
    views[0].help = { hasChanges: /<b>changes/i.test(help), hasExport: /<b>export/i.test(help), changesBlocked: /for the author/i.test(blocked) };
  }
  const { entries } = await s('DOMStorage.getDOMStorageItems', { storageId: { securityOrigin: origin, isLocalStorage: true } });
  await c.send('Target.disposeBrowserContext', { browserContextId });
  return { page, scenario, views, keys: entries.map(e => e[0]), errors };
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port, b = await launch(port), c = await cdp(b.ws);
  let fails = 0; const fail = (where, why) => { fails++; console.log('FAIL ' + where + ': ' + why); };
  try {
    for (const scenario of ['live', 'fixture']) {
      snapshotOverride = scenario === 'fixture' ? FIXTURE : null;
      for (const page of PAGES) {
        const r = await visit(c, port, page, scenario), where = `[${scenario}] ${page}`;
        for (const v of r.views) {
          const w = `[${scenario}] ${v.view}`;
          if (!STATIC(page) && !/\bmode-reader\b/.test(v.cls)) fail(w, 'not in reader mode (' + v.cls + ')');
          if (!STATIC(page) && !LIGHT(page) && !v.reader) fail(w, 'the snapshot layer (EpitaphReaderData) is not on');
          if (v.writers.length) fail(w, 'write controls visible: ' + v.writers.join(' | '));
          if (scenario === 'fixture' && /MUST-NOT-LEAK|Hiddenghost/.test(v.text)) fail(w, 'private or later text is on the page');
        }
        const bad = r.keys.filter(k => !ALLOWED.test(k));
        if (bad.length) fail(where, 'stored in the real localStorage: ' + bad.join(', '));
        if (r.errors.length) fail(where, 'errors: ' + [...new Set(r.errors)].join(' || ').slice(0, 600));
        if (page === 'index.html' && scenario === 'fixture' && !/Test Chapter One/.test(r.views[0].text)) fail(where, 'the front door does not show the published chapter');
        if (page === 'index.html' && /pitch is empty/i.test(r.views[0].text)) fail(where, 'a visitor sees the author\'s pitch reminder');
        if (page === 'dossier.html') {
          const h = r.views[0].help;
          if (h && (h.hasChanges || h.hasExport)) fail(where, 'help lists author commands');
          if (h && !h.changesBlocked) fail(where, '"changes" is not refused');
          if (scenario === 'fixture' && !r.views.some(v => /Testwren Vale/.test(v.text))) fail(where, 'the published character does not show');
          if (scenario === 'fixture' && !r.views.some(v => /A test entry a visitor may read/.test(v.text))) fail(where, 'the open encyclopedia entry was not opened (its editors went unchecked)');
          if (scenario === 'fixture' && r.views[0].through !== 1) fail(where, 'publishedThrough is ' + r.views[0].through);
        }
        console.log(`    ${where}  views:${r.views.length}  stored:[${r.keys.join(', ')}]`);
      }
    }
    {
      const { browserContextId } = await c.send('Target.createBrowserContext');
      const { targetId } = await c.send('Target.createTarget', { url: `http://${HOST}:${port}/index.html?char=tv-wren`, browserContextId });
      await sleep(3000);
      const t = (await c.send('Target.getTargets')).targetInfos.find(x => x.targetId === targetId);
      if (!t || !/\/dossier\.html\?char=tv-wren$/.test(t.url)) fail('index.html?char=…', 'not forwarded to the Dossier (' + (t && t.url) + ')');
      else console.log('    index.html?char=… forwards to ' + t.url.replace(/^.*\//, ''));
      await c.send('Target.disposeBrowserContext', { browserContextId });
    }
  } finally { c.close(); b.proc.kill(); server.close(); fs.rmSync(b.dir, { recursive: true, force: true }); }
  console.log(fails ? fails + ' failed' : 'all passed'); process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); process.exit(2); });
