// The World over time (step 4.1): the crater and sea from Age D, places awakening, living forms, what changed (synthetic data only)
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const root=path.resolve(__dirname,'../..'); const store={};
const ctx={console,JSON,Math,localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}}}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(root+'/assets/epitaph-creatures.js','utf8'),ctx); vm.runInContext(fs.readFileSync(root+'/assets/epitaph-creature-world.js','utf8'),ctx);
const Wo=ctx.EpitaphCreatureWorld, j=o=>JSON.parse(JSON.stringify(o));
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
const st=()=>({ biomes:[{id:'b1',name:'B1',since:'E'},{id:'b2',name:'B2',since:'F'},{id:'b3',name:'B3'}],
  places:[{id:'p1',biome:'b1',lon:10,lat:20},{id:'p2',biome:'b1',lon:11,lat:21,since:'D'},{id:'p3',biome:'b2',lon:12,lat:22},{id:'p4',biome:'b3',lon:13,lat:23},{id:'nolat',biome:'b1',lon:null,lat:null}],
  nodes:[{id:'n1',name:'Root herd',when:{epoch:'worlds'},biomes:['b1']},{id:'n2',name:'Step two',parentId:'n1',when:{age:'C'},biomes:['b1']},{id:'n3',name:'Dying',parentId:'n2',when:{age:'E'},extinct:{age:'G'},biomes:['b2']}],
  creatures:[{id:'c1',name:'Murmur',parentId:'n2',when:{age:'G'},biomes:['b1']}] });
const I=id=>Wo.bands().findIndex(b=>b.id===id), M=(id,sel)=>Wo.model(st(),I(id),sel);
t('the crater and the sea start at Age D, as the user decided, and not before',()=>{ assert.strictEqual(Wo.SHIFT,'D'); assert.ok(!M('C').crater&&!M('C').sea&&M('C').era===0); assert.ok(M('D').crater&&M('D').sea&&M('D').era===1); assert.ok(M('G').crater); assert.ok(!M('chaos').crater); });
t('a place awakens at its own date, else its biome\'s; one with neither is never drawn; one with no position is skipped',()=>{ assert.strictEqual(M('D').awakeCount,1); assert.deepStrictEqual(j(M('D').awake.map(p=>p.id)),['p2']); assert.deepStrictEqual(j(M('E').awake.map(p=>p.id).sort()),['p1','p2']); assert.strictEqual(M('G').awakeCount,3); assert.strictEqual(M('G').totalPlaces,4); });
t('awake places only ever grow with time',()=>{ let last=-1; Wo.bands().forEach((b,i)=>{ const c=Wo.model(st(),i).awakeCount; assert.ok(c>=last); last=c; }); });
t('living forms at a time: the tips of the lines (a step with a living descendant is not listed)',()=>{ assert.deepStrictEqual(j(M('C').forms.map(f=>f.name)),['Step two']); assert.deepStrictEqual(j(M('E').forms.map(f=>f.name)),['Dying']); });
t('a form that has died out is gone from then on; one not yet born is absent',()=>{ assert.ok(!M('G').forms.some(f=>f.name==='Dying')); assert.ok(!M('F').forms.some(f=>f.name==='Murmur')); assert.ok(M('G').forms.some(f=>f.name==='Murmur')); });
t('picking a form lights the places in its biomes',()=>{ const m=M('G','c1'); assert.strictEqual(m.picked,'c1'); assert.deepStrictEqual(j(m.lit.map(p=>p.id).sort()),['p1','p2']); assert.strictEqual(M('G','nope').picked,null); assert.strictEqual(M('G').lit.length,0); });
t('what changed since the band before: the shift, places waking, forms appearing and going',()=>{ assert.ok(M('D').changes.shift); assert.ok(!M('E').changes.shift); assert.strictEqual(M('E').changes.woke,1); assert.deepStrictEqual(j(M('G').changes.appeared),['Murmur']); assert.deepStrictEqual(j(M('G').changes.gone),['Dying']); });
t('an empty log gives an empty world without errors; the crater is still drawn from Age D',()=>{ const m=Wo.model({},I('G')); assert.strictEqual(m.awakeCount,0); assert.strictEqual(m.forms.length,0); assert.ok(m.crater); });
t('the crater sits in Antarctica',()=>{ assert.ok(Wo.CRATER.lat<=-70); });
console.log(n+' passed');
