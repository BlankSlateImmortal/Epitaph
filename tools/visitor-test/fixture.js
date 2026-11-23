// Synthetic author data for the visitor test (nothing from the vault: the repo is public). Builds the snapshot the way the Dossier's
// Data > Publish snapshot does, through the real assets/epitaph-publish.js. Usage: node fixture.js > out.js
const path = require('path'), R = path.resolve(__dirname, '../..');
const store = {};
globalThis.localStorage = { getItem: k => k in store ? store[k] : null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
['world', 'timeline', 'sites', 'publish'].forEach(n => require(R + '/assets/epitaph-' + n + '.js'));
const state = {
  schemaVersion: 9,
  chapters: [{ id: 'c1', number: 1, title: 'Test Chapter One' }, { id: 'c2', number: 2, title: 'Test Chapter Two' }],
  characters: [
    { id: 'tv-wren', name: 'Testwren Vale', faction: 'Test Faction', race: 'person', snapshots: [
      { id: 's1', startChapter: 1, blurb: 'A test character a visitor may see.', secrets: 'SECRET-TEXT-MUST-NOT-LEAK', notes: 'NOTE-MUST-NOT-LEAK', inventory: [], skills: [{ name: 'Test Skill', level: 40 }] },
      { id: 's2', startChapter: 2, blurb: 'LATER-CHAPTER-MUST-NOT-LEAK' }] },
    { id: 'tv-ghost', name: 'Hiddenghost Test', snapshots: [{ id: 'g1', startChapter: 2, blurb: 'Not published yet.' }] }
  ]
};
const INDEX = [{ chapter: 1, title: 'Test Chapter One', characters: ['Testwren Vale'], moments: [], world: [], reveals: [] }];
// two encyclopedia entries: one open from page 1 (a reader sees it; its edit bar must not show), one a chapter hasn't reached yet
const sites = [
  { placeId: 'cairo', open: true, overview: { states: [{ from: null, status: 'standing', note: 'A test entry a visitor may read.' }] },
    intrigue: { secrets: [{ text: 'SITE-SECRET-MUST-NOT-LEAK', hidden: true }] } },
  { placeId: 'aurelia', revealedIn: 2, overview: { states: [{ from: null, status: 'standing', note: 'UNREACHED-SITE-MUST-NOT-LEAK' }] } }
];
const out = EpitaphPublish.build({ state, library: { version: 3, places: [], items: [] }, publishedThrough: 1, chapterIndex: INDEX, sites, now: '2026-11-23T00:00:00Z' });
if (out.data.sites.length !== 1 || out.data.sites[0].placeId !== 'cairo') throw new Error('fixture: expected only the open site in the snapshot, got ' + JSON.stringify(out.data.sites.map(r => r.placeId)));
process.stdout.write(EpitaphPublish.toScript(out.data));
