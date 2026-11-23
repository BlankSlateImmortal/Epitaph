// New creature fields (steps 3.3, 3.4, 3.7, 6.3, 6.4): normalising, and what the reader gate keeps (synthetic data only)
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const root=path.resolve(__dirname,'../..'); const store={};
const ctx={console,JSON,Math,localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}}}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(root+'/assets/epitaph-creatures.js','utf8'),ctx);
const C=ctx.EpitaphCreatures, j=o=>JSON.parse(JSON.stringify(o));
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
const rec={id:'c',name:'C',revealedIn:1,traits:[{name:'Bite',does:'bites',power:5},{name:'Odd',does:'x',power:9}],anatomy:{image:'img.png',parts:[{name:'Jaw',note:'n',x:0.4,y:0.6},{name:'Tail',x:2,y:-1}]},
  resources:[{name:'Hide',kind:'hide',use:'armour',libId:'li_1'},{name:'Weird',kind:'nonsense'},{kind:'bone'}],encounters:[{charId:'char_a',chapter:2,note:'met'},{charId:'char_b',chapter:9,note:'later'},{}],
  ties:[{charId:'char_a',how:'feeds her power'},{how:'no char'}],fieldNotes:[{author:'Scout',chapter:1,text:'seen'},{charId:'char_a',chapter:5,text:'later note'},{author:'Hidden',text:'no chapter'}]};
t('the power scale has seven named steps, as agreed',()=>{ assert.deepStrictEqual(j(C.POWER.steps),['Faint','Minor','Notable','Strong','Fierce','Overwhelming','Unstoppable']); });
t('there are seven resource kinds',()=>{ assert.strictEqual(C.RESOURCE_KINDS.length,7); });
t('a trait keeps a power from 1 to 7; anything else is dropped',()=>{ C.put('creatures',rec); const r=C.byId('c'); assert.strictEqual(r.traits[0].power,5); assert.strictEqual(r.traits[1].power,null); });
t('the anatomy image and pin positions are kept; a pin outside the image loses its place',()=>{ const r=C.byId('c'); assert.strictEqual(r.anatomy.image,'img.png'); assert.strictEqual(r.anatomy.parts[0].x,0.4); assert.strictEqual(r.anatomy.parts[1].x,null); assert.strictEqual(r.anatomy.parts[1].y,null); });
t('resources: an unknown kind becomes "other"; one with no name is dropped',()=>{ const r=C.byId('c'); assert.strictEqual(r.resources.length,2); assert.strictEqual(r.resources[1].kind,'other'); assert.strictEqual(r.resources[0].libId,'li_1'); });
t('encounters and power ties are kept; empty ones and ties with no character are dropped',()=>{ const r=C.byId('c'); assert.strictEqual(r.encounters.length,2); assert.strictEqual(r.ties.length,1); });
t('field notes keep their chapter',()=>{ const r=C.byId('c'); assert.strictEqual(r.fieldNotes[0].chapter,1); assert.strictEqual(r.fieldNotes[2].chapter,null); });
const G=ch=>C.forReader(C.load(),ch).creatures[0];
t('a reader sees field notes and encounters only from their chapter; a note with no chapter never',()=>{ const g=G(3); assert.deepStrictEqual(j(g.fieldNotes.map(x=>x.text)),['seen']); assert.deepStrictEqual(j(g.encounters.map(x=>x.note)),['met']); assert.strictEqual(G(9).fieldNotes.length,2); });
t('a reader never sees power ties, or which Library item a resource is',()=>{ const g=G(9); assert.strictEqual(g.ties.length,0); assert.ok(g.resources.every(x=>x.libId==='')); assert.strictEqual(g.resources.length,2); });
console.log(n+' passed');
