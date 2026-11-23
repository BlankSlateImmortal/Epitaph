// Creature Log view: the pieces that don't need a page (time picker encoding, the form's field list, the link handler)
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const root=path.resolve(__dirname,'../..'); let handler=null;
const store={}; const ctx={console,JSON,Math,localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}}}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
ctx.EpitaphLinks={register:(k,fn)=>{ if(k==='creature') handler=fn; }}; ctx.EpitaphTimeline={authorMode:()=>true,byId:id=>id==='the-siege'?{id,title:'The siege'}:null,load:()=>[{id:'the-siege',title:'The siege',when:{era:'ERA_0'}}],compare:()=>0};
vm.runInContext(fs.readFileSync(root+'/assets/epitaph-creatures.js','utf8'),ctx); vm.runInContext(fs.readFileSync(root+'/assets/epitaph-creature-ui.js','utf8'),ctx);
const U=ctx.EpitaphCreatureUI._t, C=ctx.EpitaphCreatures, j=o=>JSON.parse(JSON.stringify(o));
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
t('a time round-trips through the picker: age, epoch, event, none',()=>{ for (const w of [{age:'D'},{epoch:'war'},'the-siege',null]) assert.deepStrictEqual(j(U.whenFrom(U.whenValue(w))), w); });
t('picker values are readable text',()=>{ assert.strictEqual(U.whenText({age:'E'}),'Age E · The Binding'); assert.strictEqual(U.whenText({epoch:'chaos'}),'Chaos'); assert.strictEqual(U.whenText('the-siege'),'The siege'); assert.strictEqual(U.whenText(null),''); });
t('a plain age letter or epoch id also reads as a time',()=>{ assert.strictEqual(U.whenValue('A'),'age:A'); assert.strictEqual(U.whenValue('war'),'epoch:war'); });
t('every kind has a form, with a name first',()=>['creatures','nodes','chaos','biomes','places'].forEach(k=>{ const s=U.specFor(k,{id:'x'}); assert.ok(s.length>=3); assert.strictEqual(s[0].k,'name'); }));
t('a creature form has the three scales, curses, traits and the food picker',()=>{ const ks=U.specFor('creatures',{id:'x'}).map(s=>s.k); ['awareness','threat','size','curses','traits','__eats','sightings','names'].forEach(k=>assert.ok(ks.includes(k),k)); });
t('a place form has the optional curse, a biome and the encyclopedia place',()=>{ const ks=U.specFor('places',{id:'x'}).map(s=>s.k); ['curse','biome','sitePlaceId'].forEach(k=>assert.ok(ks.includes(k),k)); });
t('the form never offers a creature as its own ancestor',()=>{ C.put('creatures',{id:'a',name:'A'}); C.put('nodes',{id:'b',name:'B'}); const opts=U.specFor('creatures',{id:'a'}).find(s=>s.k==='parentId').opts.map(o=>o[0]); assert.ok(!opts.includes('a')); assert.ok(opts.includes('b')); });
t('the creature link handler refuses an unknown creature, and opens a known one through the book',()=>{ assert.strictEqual(handler('ghost'),false); let got=null; ctx.EpitaphBook={openCreatures:id=>{got=id;}}; assert.strictEqual(handler('creature:a'),true); assert.strictEqual(got,'a'); });
t('migration routes: a path reads back from text, drops bad points, and round-trips',()=>{ const p=U.parsePath('51.5, -0.1; 40.7,-74; nonsense; 95,10; 10,200'); assert.deepStrictEqual(JSON.parse(JSON.stringify(p)),[[51.5,-0.1],[40.7,-74]]); assert.strictEqual(U.pathText(p),'51.5,-0.1; 40.7,-74'); assert.deepStrictEqual(JSON.parse(JSON.stringify(U.parsePath(U.pathText(p)))),JSON.parse(JSON.stringify(p))); });
t('a creature form has the migration-routes rows',()=>{ const s=U.specFor('creatures',{id:'x'}).find(q=>q.k==='range.migrations'); assert.ok(s&&s.t==='rows'&&s.fields.length===2); });
console.log(n+' passed');
