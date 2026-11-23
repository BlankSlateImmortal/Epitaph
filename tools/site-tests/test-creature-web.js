// The Food Web's layout (step 4.2): levels, roles, time, changes, bad data (synthetic data only)
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const root=path.resolve(__dirname,'../..'); const store={};
const ctx={console,JSON,Math,CSS:{escape:s=>s},localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}}}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(root+'/assets/epitaph-creatures.js','utf8'),ctx); vm.runInContext(fs.readFileSync(root+'/assets/epitaph-creature-web.js','utf8'),ctx);
const Wb=ctx.EpitaphCreatureWeb, j=o=>JSON.parse(JSON.stringify(o));
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
const st=()=>({ creatures:[{id:'grass',name:'Grass',when:{epoch:'worlds'}},{id:'graz',name:'Grazer',when:{age:'A'}},{id:'hunt',name:'Hunter',when:{age:'C'}},{id:'apex',name:'Apex',when:{age:'E'}},{id:'lone',name:'Loner',when:{age:'A'}},{id:'dead',name:'Dead',when:{age:'A'},extinct:{age:'D'}}],
  nodes:[{id:'step',name:'A lineage step'},{id:'linked',name:'Linked step',when:{age:'A'}}],
  food:[{eater:'graz',eaten:'grass'},{eater:'hunt',eaten:'graz'},{eater:'apex',eaten:'hunt'},{eater:'apex',eaten:'graz'},{eater:'dead',eaten:'grass',when:{age:'A'}},{eater:'linked',eaten:'grass'}] });
const M=at=>Wb.model(st(),at), N=(m,id)=>m.nodes.find(x=>x.id===id);
t('levels: what eats nothing sits at the bottom, each creature one above the highest thing it eats',()=>{ const m=M('G'); assert.strictEqual(N(m,'grass').level,0); assert.strictEqual(N(m,'graz').level,1); assert.strictEqual(N(m,'hunt').level,2); assert.strictEqual(N(m,'apex').level,3); assert.strictEqual(m.levels,4); });
t('apex and keystone are marked from the food web rules',()=>{ const m=M('G'); assert.ok(N(m,'apex').apex); assert.ok(!N(m,'hunt').apex); assert.ok(N(m,'grass').base); });
t('a creature with no link sits on the bottom row, marked as alone; a lineage step shows only if a link names it',()=>{ const m=M('G'); assert.strictEqual(N(m,'lone').level,0); assert.ok(N(m,'lone').alone); assert.ok(!N(m,'step')); assert.ok(N(m,'linked')); });
t('time: a creature is not in the web before it appears or after it dies out; links go with it',()=>{ assert.ok(!N(M('B'),'hunt')); assert.ok(!N(M('B'),'apex')); assert.ok(N(M('C'),'dead')); assert.ok(!N(M('D'),'dead')); assert.ok(!N(M('E'),'dead')); assert.ok(N(M('C'),'hunt')); assert.ok(!M('B').edges.some(e=>e.from==='hunt')); });
t('before anything exists the web is empty, without errors',()=>{ const m=M('chaos'); assert.strictEqual(m.nodes.length,0); assert.strictEqual(m.levels,0); });
t('each creature has its own spot in its row, spread across 0..1',()=>{ const m=M('G'); const k=new Set(m.nodes.map(x=>x.level+':'+x.x.toFixed(3))); assert.strictEqual(k.size,m.nodes.length); m.nodes.forEach(x=>assert.ok(x.x>0&&x.x<1)); });
t('a loop in the links never hangs and counts as the base',()=>{ const s=st(); s.food.push({eater:'grass',eaten:'apex'}); const m=Wb.model(s,'G'); assert.ok(m.nodes.length>=4); m.nodes.forEach(x=>assert.ok(Number.isInteger(x.level))); });
t('a link to a creature that is not in the log is dropped',()=>{ const s=st(); s.food.push({eater:'ghost',eaten:'grass'}); const m=Wb.model(s,'G'); assert.ok(!m.edges.some(e=>e.from==='ghost')); });
t('changes since the band before: who appeared, who died out, links begun and ended',()=>{ const B=Wb.bands(), i=B.findIndex(b=>b.id==='E'); const c=Wb.changes(st(),i); assert.deepStrictEqual(j(c.appeared),['Apex']); assert.ok(c.linked>=2); const g=Wb.changes(st(),B.findIndex(b=>b.id==='D')); assert.deepStrictEqual(j(g.gone),['Dead']); assert.ok(g.unlinked>=1); assert.deepStrictEqual(j(Wb.changes(st(),0)),{appeared:[],gone:[],linked:0,unlinked:0}); });
t('the 14 time points are 7 epochs then ages A to G',()=>{ const B=Wb.bands(); assert.strictEqual(B.length,14); assert.strictEqual(B[0].id,'chaos'); assert.strictEqual(B[13].id,'G'); assert.strictEqual(B[7].chip,'A'); });
console.log(n+' passed');
