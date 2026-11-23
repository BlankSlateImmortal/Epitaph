// Creature Log 1.4: the food web, the scales and the time order (synthetic data only)
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const ctx={console,JSON,Math}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../..')+'/assets/epitaph-creatures.js','utf8'),ctx);
const C=ctx.EpitaphCreatures, j=o=>JSON.parse(JSON.stringify(o));
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
t('seven epochs and seven ages',()=>{assert.strictEqual(C.EPOCHS.length,7);assert.strictEqual(C.AGES.length,7);assert.deepStrictEqual(j(C.AGE_IDS),['A','B','C','D','E','F','G'])});
t('the last three ages carry the curse cycle',()=>assert.deepStrictEqual(j(C.AGES.slice(4).map(a=>a.cursePhase)),['awakening','fluctuation','stabilization']));
t('every scale has seven steps',()=>Object.values(C.SCALES).forEach(s=>assert.strictEqual(s.steps.length,7)));
t('time order: epochs, then ages inside the last',()=>{assert.ok(C.timeIndex({epoch:'chaos'})<C.timeIndex({epoch:'war'}));assert.ok(C.timeIndex({epoch:'twisted'})<C.timeIndex('A'));assert.ok(C.timeIndex('A')<C.timeIndex('G'));assert.strictEqual(C.timeIndex('nonsense'),null)});
t('awareness 5 and up is conscious',()=>{assert.ok(!C.isConscious({awareness:4}));assert.ok(C.isConscious({awareness:5}))});
t('a conscious holder rests briefly whatever the curse says',()=>{assert.strictEqual(C.restFor({awareness:6},{rest:'eons'}),'short');assert.strictEqual(C.restFor({awareness:2},{rest:'eons'}),'eons');assert.strictEqual(C.restFor({awareness:2},{}),'eons')});
t('curse extras keep only known values',()=>assert.deepStrictEqual(j(C.curseExtras({state:'infectious',spreadsBy:['air','water'],moves:'fast',concepts:['fate','love'],rest:'short'})),{state:'infectious',spreadsBy:['air'],concepts:['fate'],rest:'short'}));
t('three curse states',()=>assert.strictEqual(C.CURSE_STATES.length,3));
// a small web: grass is eaten by deer and hare; deer by wolf; hare by fox and wolf; wolf by nothing; a late beast appears in F
const K=[{id:'grass'},{id:'deer'},{id:'hare'},{id:'fox'},{id:'wolf'},{id:'old',extinct:'E'},{id:'beast',when:'F'}];
const W=[{eater:'deer',eaten:'grass'},{eater:'hare',eaten:'grass'},{eater:'wolf',eaten:'deer'},{eater:'fox',eaten:'hare'},{eater:'wolf',eaten:'hare'},
         {eater:'old',eaten:'deer'},{eater:'beast',eaten:'wolf',when:'F'},{eater:'deer',eaten:'grass',when:'B'},{eater:'x',eaten:'grass'},{eater:'hare',eaten:'hare'}];
t('links in force: both alive, begun, each pair once, unknown creatures dropped',()=>{const L=j(C.foodAt('D',W,K)).map(l=>l.eater+'>'+l.eaten).sort();assert.deepStrictEqual(L,['deer>grass','fox>hare','hare>grass','old>deer','wolf>deer','wolf>hare'])});
t('an extinct creature drops out from its age',()=>assert.ok(!j(C.foodAt('E',W,K)).some(l=>l.eater==='old')));
t('a late link waits for its age',()=>{assert.ok(!j(C.foodAt('E',W,K)).some(l=>l.eater==='beast'));assert.ok(j(C.foodAt('G',W,K)).some(l=>l.eater==='beast'))});
t('roles at D: wolf and fox are apex, grass is base',()=>{const R=j(C.webRoles('D',W,K));assert.ok(R.wolf.apex&&R.fox.apex&&R.old.apex);assert.ok(R.grass.base);assert.ok(!R.deer.apex)});
t('roles at G: the beast eats the wolf, so the wolf is no longer apex',()=>{const R=j(C.webRoles('G',W,K));assert.ok(R.beast.apex);assert.ok(!R.wolf.apex)});
t('keystone: the only food of two eaters',()=>{const R=j(C.webRoles('D',W,K));assert.ok(R.grass.keystone);assert.deepStrictEqual(R.grass.soleFoodOf.sort(),['deer','hare'])});
t('keystone: eaten by four or more',()=>{const K2=[{id:'p'},{id:'a'},{id:'b'},{id:'c'},{id:'d'}],W2=['a','b','c','d'].map(e=>({eater:e,eaten:'p'})).concat([{eater:'a',eaten:'b'},{eater:'b',eaten:'c'},{eater:'c',eaten:'d'},{eater:'d',eaten:'a'}]);assert.ok(j(C.webRoles(null,W2,K2)).p.keystone)});
t('what a loss would starve: grass takes deer and hare, then fox (hare was its only food); the wolf goes too',()=>assert.deepStrictEqual(j(C.wouldStarve('grass','E',W,K)).sort(),['deer','fox','hare','wolf']));
t('a creature with other food survives a loss',()=>assert.deepStrictEqual(j(C.wouldStarve('deer','E',W,K)),[]));
t('no links, no crash',()=>{assert.deepStrictEqual(j(C.foodAt('A',[],K)),[]);assert.ok(j(C.webRoles('A',[],[{id:'z'}])).z.base)});
console.log(n+' passed');
