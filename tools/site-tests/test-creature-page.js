// The creature page's model (Creature Log Phase 3): the line of forms, the branches, the changes (synthetic data only)
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const root=path.resolve(__dirname,'../..'); const store={};
const ctx={console,JSON,Math,localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}}}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
ctx.EpitaphTimeline={authorMode:()=>true,byId:id=>id==='ev1'?{id,title:'A quake: the ground opens'}:null,load:()=>[],compare:()=>0};
vm.runInContext(fs.readFileSync(root+'/assets/epitaph-creatures.js','utf8'),ctx); vm.runInContext(fs.readFileSync(root+'/assets/epitaph-creature-page.js','utf8'),ctx);
const P=ctx.EpitaphCreaturePage, C=ctx.EpitaphCreatures, j=o=>JSON.parse(JSON.stringify(o));
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
const st=()=>({ nodes:[{id:'r',name:'Root',when:{epoch:'worlds'},root:'old world',mutation:{change:'made for plains',advantage:'',curse:null}},
  {id:'a',name:'A',parentId:'r',when:{age:'A'},cause:'ev1',mutation:{change:'grew plates',advantage:'safe from teeth',curse:'k'}},
  {id:'dead',name:'Dead end',parentId:'a',when:{age:'E'},extinct:{age:'G'},mutation:{change:'stiffened',advantage:'',curse:null}},
  {id:'loop1',name:'L1',parentId:'loop2'},{id:'loop2',name:'L2',parentId:'loop1'}],
  creatures:[{id:'c',name:'Creature',parentId:'a',when:{age:'G'},cause:'G',mutation:{change:'one mind',advantage:'cannot be ambushed',curse:null},awareness:5,traits:[{name:'T',does:'d',counters:'x'}]}], chaos:[], biomes:[], places:[], food:[] });
const M=id=>P.model(st(),id);
t('the line runs from the root to the form, oldest first',()=>{ assert.deepStrictEqual(j(M('c').lineage.map(f=>f.id)),['r','a','c']); assert.ok(M('c').lineage[2].current); assert.strictEqual(M('c').root,'old world'); });
t('branches that split off a form are listed beside the line, not in it',()=>{ const l=M('c').lineage; assert.deepStrictEqual(j(l[1].branches.map(b=>b.id)),['dead']); assert.ok(l[1].branches[0].extinct); assert.strictEqual(l[0].branches.length,0); });
t('mutations come in order, with cause, gain and the curse note; forms with nothing written are left out',()=>{ const m=M('c').mutations; assert.deepStrictEqual(j(m.map(x=>x.id)),['r','a','c']); assert.strictEqual(m[1].cause,'ev1'); assert.strictEqual(m[1].gain,'safe from teeth'); assert.ok(m[1].cursed); assert.ok(m[2].current); });
t('a step with no change, gain or cause is not a mutation row',()=>{ const s=st(); s.nodes.push({id:'q',name:'Q',parentId:'c'}); const m=P.model(s,'q'); assert.ok(!m.mutations.some(x=>x.id==='q')); });
t('an unknown id, or a silhouette, has no page',()=>{ assert.strictEqual(M('nope'),null); const s=st(); s.nodes.push({id:'?1',silhouette:true,name:''}); assert.strictEqual(P.model(s,'?1'),null); });
t('a loop in the data never hangs: the line stops where it would repeat',()=>{ const m=M('loop1'); assert.ok(m&&m.lineage.length<=2); });
t('a silhouette in a reader\'s line stays a silhouette (no name, no change)',()=>{ const s=st(); s.nodes[0]={id:'?1',silhouette:true,name:'',when:{epoch:'worlds'},mutation:{change:'',advantage:'',curse:null}}; s.nodes[1].parentId='?1'; const m=P.model(s,'c'); assert.ok(m.lineage[0].sil); assert.ok(!m.mutations.some(x=>x.id==='?1')); });
t('times and causes read as words',()=>{ assert.strictEqual(P._t.whenLbl({age:'E'}),'Age E · The Binding'); assert.strictEqual(P._t.whenLbl({epoch:'chaos'}),'Chaos'); assert.strictEqual(P._t.causeLbl('ev1'),'A quake'); assert.strictEqual(P._t.causeLbl('G'),"Age G · The Story's Eve"); });
t('there are exactly seven sections, in the plan\'s order',()=>{ assert.strictEqual(P.SECTIONS.length,7); assert.strictEqual(P.SECTIONS[0],'Lineage'); assert.strictEqual(P.SECTIONS[6],'Field notes'); });
console.log(n+' passed');
