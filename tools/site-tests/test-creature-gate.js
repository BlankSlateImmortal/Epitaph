// The Creature Log's reader gate (step 2.4): what a reader on a chapter sees of the tree (synthetic data only)
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const root=path.resolve(__dirname,'../..'); const store={};
const ctx={console,JSON,Math,localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}}}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(root+'/assets/epitaph-creatures.js','utf8'),ctx);
const C=ctx.EpitaphCreatures, j=o=>JSON.parse(JSON.stringify(o));
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
const st=()=>({ nodes:[
  {id:'root',name:'Rootname',when:{epoch:'worlds'},revealedIn:1,biomes:['b1'],cause:'worlds',draft:true,mutation:{change:'c1',advantage:'g1',curse:'secret-curse'}},
  {id:'mid',name:'Midname',parentId:'root',when:{age:'B'},biomes:['b1'],cause:'ev-secret'},
  {id:'deep',name:'Deepname',parentId:'mid',when:{age:'D'},biomes:['b2']},
  {id:'late',name:'Latename',parentId:'deep',when:{age:'F'},revealedIn:5},
  {id:'side',name:'Sidename',parentId:'root',when:{age:'C'},revealedIn:2},
  {id:'gone',name:'Hiddenname',parentId:'root',when:{age:'C'},revealedIn:1,hidden:true},
  {id:'root2',name:'Otherroot',when:{epoch:'chaos'}} ],
  creatures:[{id:'cr',name:'Creaturename',parentId:'side',when:{age:'G'},revealedIn:3,curses:[{libId:'lib-secret',stage:3}],names:[{placeId:'p',localName:'Secret local'}],fieldNotes:[{text:'secret note'}],sightings:[{chapter:2,note:'a'},{chapter:6,note:'b'}]}],
  chaos:[{id:'c1',name:'Chaosname',revealedIn:1,curseLink:'secret link'},{id:'c2',name:'Chaos hidden one'}],
  biomes:[{id:'b1',name:'Biome one',revealedIn:1},{id:'b2',name:'Biome two'}], places:[{id:'pl1',name:'Seen place',revealedIn:1,curse:{libId:'lib-x'},notes:'secret'},{id:'pl2',name:'Unseen place'}], food:[{eater:'cr',eaten:'side'},{eater:'cr',eaten:'deep'}] });
const R=(ch,o)=>C.forReader(st(),ch,o), ids=r=>r.nodes.concat(r.creatures).map(x=>x.id), txt=r=>JSON.stringify(r);
t('nothing is known by default: chapter 0 shows roots only, as silhouettes',()=>{ const r=R(0); assert.ok(r.nodes.every(x=>x.silhouette)); assert.strictEqual(r.count.known,0); });
t('a known step shows; the step after it is a silhouette; deeper unknown steps are not shown at all',()=>{ const r=R(1), k=ids(r); assert.ok(k.includes('root')); assert.strictEqual(r.nodes.filter(x=>x.silhouette).length,3); assert.ok(!k.includes('deep')); assert.ok(!k.includes('late')); });
t('a silhouette never carries a name, a biome, a cause, a curse, or its real id',()=>{ const r=R(1), s=r.nodes.filter(x=>x.silhouette); assert.ok(s.length>=1); s.forEach(x=>{ assert.strictEqual(x.name,''); assert.deepStrictEqual(j(x.biomes),[]); assert.strictEqual(x.cause,null); assert.ok(/^\?/.test(x.id)); }); ['Midname','Deepname','Latename','Sidename','ev-secret'].forEach(w=>assert.ok(!txt(r).includes(w),w)); });
t('an unknown step above something known is kept as a silhouette, so the known one still hangs off the tree',()=>{ const r=R(5), k=ids(r), late=r.nodes.find(x=>x.id==='late'); assert.ok(late&&!late.silhouette); const mid=r.nodes.find(x=>x.id===late.parentId); assert.ok(mid&&mid.silhouette); assert.ok(r.nodes.find(x=>x.id===mid.parentId)); });
t('hidden records are never shown and never counted',()=>{ const r=R(9); assert.ok(!txt(r).includes('Hiddenname')); assert.ok(!txt(r).includes('Chaos hidden')); assert.ok(!ids(r).includes('gone')); });
t('a known record loses the author-only parts: draft mark, which curse, settlement names, field notes, later sightings',()=>{ const r=R(3), c=r.creatures[0]; assert.strictEqual(c.id,'cr'); assert.strictEqual(c.draft,false); assert.ok(!txt(r).includes('lib-secret')&&!txt(r).includes('secret-curse')); assert.deepStrictEqual(j(c.names),[]); assert.deepStrictEqual(j(c.fieldNotes),[]); assert.strictEqual(c.sightings.length,1); assert.strictEqual(c.curses.length,1); const root=r.nodes.find(x=>x.id==='root'); assert.strictEqual(root.draft,false); assert.ok(root.mutation.curse); });
t('a cause or date naming a timeline event the reader has not reached is dropped',()=>{ const r=R(1,{eventOk:id=>id!=='ev-secret'}); const m=C.forReader({nodes:[{id:'x',name:'X',revealedIn:1,when:'ev-secret',cause:'ev-secret'},{id:'y',name:'Y',revealedIn:1,when:{age:'A'},cause:'A'}],creatures:[],chaos:[],biomes:[],places:[],food:[]},1,{eventOk:id=>false}); assert.strictEqual(m.nodes.find(x=>x.id==='x').cause,null); assert.strictEqual(m.nodes.find(x=>x.id==='x').when,null); assert.strictEqual(m.nodes.find(x=>x.id==='y').cause,'A'); });
t('chaos forms: known ones show (without the curse hint), unknown ones are a bare "?" with no name',()=>{ const r=R(1); assert.strictEqual(r.chaos.length,2); assert.strictEqual(r.chaos[0].name,'Chaosname'); assert.strictEqual(r.chaos[0].curseLink,''); assert.ok(r.chaos[1].silhouette&&r.chaos[1].name===''); });
t('places and biomes come through only once revealed, without curses or notes',()=>{ const r=R(1); assert.deepStrictEqual(j(r.places.map(x=>x.id)),['pl1']); assert.strictEqual(r.places[0].curse,null); assert.strictEqual(r.places[0].notes,''); assert.deepStrictEqual(j(r.biomes.map(x=>x.id)),['b1']); });
t('food links to a hidden or silhouetted creature are dropped',()=>{ const r=R(3); assert.ok(r.food.every(l=>ids(r).includes(l.eater)&&ids(r).includes(l.eaten))); assert.ok(!r.food.some(l=>l.eaten==='deep')); });
t('the count: known of what is shown (silhouettes included), and it grows with the chapter',()=>{ const a=R(1).count, b=R(5).count; assert.ok(a.known<b.known); assert.ok(a.total>=a.known); });
t('the gate never changes the stored data',()=>{ const s0=st(), before=JSON.stringify(s0); C.forReader(s0,3); assert.strictEqual(JSON.stringify(s0),before); });
t('a null chapter shows nothing as known',()=>{ const r=C.forReader(st(),null); assert.strictEqual(r.count.known,0); assert.ok(!txt(r).includes('Rootname')); });
console.log(n+' passed');
