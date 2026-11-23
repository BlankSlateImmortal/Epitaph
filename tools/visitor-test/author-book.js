// The book's views as the author uses them (docs/plans/item-system.md 6.2 and 6.5, and a fix of 2026-11-23). Opens the Dossier on localhost
// (author mode), opens the book and switches between views by command, the way you type them. Checks:
//   - opmk (Mark Library) and opsp (Skill Prospects) open INSIDE the book, like opl and ops, never in the page's pop-up window;
//   - switching views (opse -> ops, an open encyclopedia entry -> opl, opsp -> ops ...) leaves nothing behind on the right panel
//     (an open entry used to leave `se-panel` there, which threw the titles off until a reload);
//   - what you write in a board is saved when you press Back.
// Usage: node tools/visitor-test/author-book.js     (needs chromium on PATH; Node 22+)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { const p = decodeURIComponent(new URL(q.url, 'http://x').pathname), f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
let fails = 0; const check = (ok, what) => { if (!ok) { fails++; console.log('FAIL ' + what); } else console.log('ok   ' + what); };
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'author-book-'));
  const pr = spawn('chromium', ['--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--user-data-dir=' + dir, '--remote-debugging-port=0', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
  let ws; for (let i = 0; i < 100 && !ws; i++) { const f = dir + '/DevToolsActivePort'; if (fs.existsSync(f)) { const [a, b] = fs.readFileSync(f, 'utf8').split('\n'); if (b) ws = `ws://127.0.0.1:${a}${b}`; } await sleep(100); }
  const w = new WebSocket(ws); let id = 0; const calls = {}; w.onmessage = m => { const d = JSON.parse(m.data); if (d.id && calls[d.id]) { d.error ? calls[d.id].bad(new Error(JSON.stringify(d.error))) : calls[d.id].ok(d.result); delete calls[d.id]; } };
  await new Promise(r => w.onopen = r);
  const send = (method, params = {}, sessionId) => new Promise((ok, bad) => { const i = ++id; calls[i] = { ok, bad }; w.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }), { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }), s = (m, p) => send(m, p, sessionId);
  await s('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); await s('Page.enable'); await s('Runtime.enable');
  await s('Page.navigate', { url: `http://127.0.0.1:${port}/dossier.html` }); await sleep(4000);
  const ev = async e => { const r = await s('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
  const run = async c => { await ev(`runStorybookCommand(${JSON.stringify(c)})`); await sleep(1800); };
  const st = () => ev(`(() => { const b = document.getElementById('theBook'), pn = document.getElementById('bookPanel'); return { view: b.dataset.view || null, board: !!document.querySelector('#bkBoard .sp-board, #bkBoard .gr, #bkBoard .ml-deck'), modal: document.getElementById('modalBackdrop').classList.contains('visible'), panel: pn.className, drafts: EpitaphLibrary.get().skillDrafts.map(d => d.name), marks: EpitaphLibrary.get().marks.length }; })()`);
  try {
    await ev('openTheBook()'); await sleep(3500);
    await run('opmk'); let x = await st();
    check(x.view === 'marks' && x.board && !x.modal, 'opmk opens inside the book, not in the pop-up');
    await run('opsp'); x = await st();
    check(x.view === 'prospects' && x.board && !x.modal, 'opsp opens inside the book, not in the pop-up');
    await ev(`(() => { document.querySelector('[data-sp-new]').click(); const n = document.querySelector('#spMain [data-spf=name]'); n.value = 'Regression prospect'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await ev(`document.getElementById('bkBack').click()`); await sleep(600); x = await st();
    check(x.view === null && x.drafts.includes('Regression prospect'), 'a prospect written in the book is saved when you press Back');
    await run('opmk'); await ev(`document.querySelector('.sp-new').click()`); await ev(`document.getElementById('bkBack').click()`); await sleep(600); x = await st();
    check(x.marks === 1, 'a mark written in the book is saved when you press Back');
    // the deck (opmk): blessings gold, curses with their stages as cards beneath, Cycle / Inspect
    await ev(`EpitaphLibrary.update(l => { const L = EpitaphLibrary, M = EpitaphMarks, mk = o => { const d = L.toDefinition(M.normalize(o)); d.name = o.name; return d; };
      l.marks = [mk({ kind: 'blessing', name: 'Test blessing' }), mk({ kind: 'curse', name: 'Test curse', initial: { name: 'Calm' }, stages: [{ name: 'One', text: 'first' }, { name: 'Two', text: 'second' }, { name: '', text: '' }] }), mk({ kind: 'binding', name: 'Test binding', rank: 2 })]; })`);
    await run('opmk');
    const dk = () => ev(`(() => { const c = document.querySelector('.mk-card.k-curse'); return { cards: document.querySelectorAll('.mk-card').length, under: document.querySelectorAll('.mk-under').length, top: c && c.querySelector('.mk-k').textContent, menu: !!document.querySelector('.mk-menu'), panel: (document.querySelector('.mk-panel-name') || {}).textContent || '', stage: (document.querySelector('.mk-stage-text') || {}).textContent || '', gold: getComputedStyle(document.querySelector('.mk-card.k-blessing')).borderTopColor }; })()`);
    let dx = await dk();
    check(dx.cards === 3 && dx.under === 2, 'the deck shows 3 cards; the curse has its 2 written stages as cards beneath (the empty third stage is left out)');
    check(/^rgba?\((22[0-9]|23[0-9]), (17[0-9]|18[0-9]|19[0-9]), (8[0-9]|9[0-9])/.test(dx.gold), 'blessings are gold (' + dx.gold + ')');
    await ev(`document.querySelector('.mk-card.k-curse').click()`); await sleep(200); dx = await dk();
    check(dx.menu && dx.top === 'INITIAL', 'clicking a curse offers Cycle / Inspect, with the initial card on top');
    await ev(`document.querySelector('[data-mk-cycle]').click()`); await sleep(400); dx = await dk();
    check(dx.top === 'STAGE 1' && /One/.test(dx.stage) && dx.panel === 'Test curse', 'Cycle brings stage 1 to the top and shows its text on the right page');
    await ev(`document.querySelector('[data-mk-cycle]').click()`); await ev(`document.querySelector('[data-mk-cycle]').click()`); await sleep(300); dx = await dk();
    check(dx.top === 'INITIAL', 'cycling past the last stage comes back to the initial card');
    await ev(`document.querySelector('[data-mk-inspect]').click()`); await sleep(300); dx = await dk();
    check(!dx.menu && dx.panel === 'Test curse' && !!(await ev(`!!document.querySelector('#bookPanel #mlMain [data-mlf=name]')`)), 'Inspect opens the editor on the right page');
    await ev(`document.querySelector('.mk-card.k-binding').click()`); await sleep(300); dx = await dk();
    check(dx.panel === 'Test binding' && !dx.menu, 'a binding (no stages) opens straight to the editor');
    check(!(await st()).modal, 'the deck never opens the pop-up');
    await ev(`document.getElementById('bkBack').click()`); await sleep(500);

    // the grimoire (opsp): pages in root-to-branch order, turning by button and by arrow key, the editor on the right page
    await ev(`EpitaphLibrary.update(l => { l.skillDrafts = []; [['Beta root', ''], ['Alpha root', ''], ['Beta child', 'Beta root']].forEach(([n, p]) => l.skillDrafts.push(EpitaphLibrary.normalizeSkillDraft({ name: n, parent: p, level: 2 }))); })`);
    await run('opsp');
    const g = () => ev(`(() => ({ toc: [...document.querySelectorAll('#grToc [data-sp] b')].map(b => b.textContent), page: (document.querySelector('.gr-name') || {}).textContent, panel: (document.querySelector('#bookPanel .gr-panel-name') || {}).textContent, editor: !!document.querySelector('#bookPanel #spMain [data-spf=name]') }))()`);
    let gx = await g();
    check(JSON.stringify(gx.toc) === JSON.stringify(['Alpha root', 'Beta root', 'Beta child']), 'grimoire contents run root to branch: ' + gx.toc.join(', '));
    check(gx.page === 'Alpha root' && gx.panel === 'Alpha root' && gx.editor, 'the first page is open, with its editor on the right page');
    await ev(`document.querySelector('[data-gr-turn="1"]').click()`); await sleep(300); gx = await g();
    check(gx.page === 'Beta root', 'the turn button goes to the next page');
    await ev(`(() => { const b = document.getElementById('bkBoard'); b.focus(); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); })()`); await sleep(300); gx = await g();
    check(gx.page === 'Beta child', 'the right arrow key turns the page');
    await ev(`(() => { const n = document.querySelector('#spMain [data-spf=name]'); n.value = 'Beta child renamed'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    gx = await g(); check(gx.page === 'Beta child renamed', 'the page name follows the name as you type it');
    await ev(`document.querySelector('[data-gr-turn="-1"]').click()`); await sleep(300);
    check((await ev(`EpitaphLibrary.get().skillDrafts.map(d => d.name).includes('Beta child renamed')`)), 'turning the page saves what you typed');
    check(!(await st()).modal, 'the grimoire never opens the pop-up');
    await ev(`document.getElementById('bkBack').click()`); await sleep(500);

    // switching by command leaves nothing behind
    await run('opse'); await ev(`(() => { const S = EpitaphSites, r = S.load()[0]; const id = r ? r.placeId : EpitaphWorld.places().find(p => p.fictional).id; EpitaphSiteEntry.open(id, 'overview'); })()`); await sleep(1200);
    check((await st()).panel.includes('se-panel'), '(setup) an open encyclopedia entry marks the right panel');
    for (const c of ['ops', 'opl']) { await run('opse'); await ev(`EpitaphSiteEntry.open((EpitaphSites.load()[0] || { placeId: EpitaphWorld.places().find(p => p.fictional).id }).placeId, 'overview')`); await sleep(800); await run(c); x = await st(); check(x.panel === 'book-panel', `after an open entry, ${c} leaves a clean right panel ("${x.panel}")`); }
    await run('opsp'); await run('ops'); x = await st(); check(x.panel === 'book-panel' && x.view === 'skills' && !x.board, 'opsp -> ops leaves a clean right panel');
    await run('opmk'); await run('opl'); x = await st(); check(x.panel === 'book-panel' && x.view === 'library' && !x.board, 'opmk -> opl leaves a clean right panel');
  } finally { pr.kill(); srv.close(); await sleep(500); try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); } catch (e) { /* temp folder only */ } }
  console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
