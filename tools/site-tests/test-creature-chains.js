// Cause and effect chains (step 4.3): branches by lineage, by cause, gaps, loops (synthetic data only)
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const root=path.resolve(__dirname,'../..'); const store={};
const ctx={console,JSON,Math,localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}}}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
ctx.EpitaphTimeline={byId:id=>id==='flood'?{id,title:'The flood: the sea rises'}:null};
vm.runInContext(fs.readFileSync(root+'/assets/epitaph-creatures.js','utf8'),ctx); vm.runInContext(fs.readFileSync(root+'/assets/epitaph-creature-chains.js','utf8'),ctx);
const X=ctx.EpitaphCreatureChains, j=o=>JSON.parse(JSON.stringify(o));
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
const st=()=>({ nodes:[{id:'r',name:'Root',when:{epoch:'worlds'},cause:'worlds',mutation:{change:'made'}},{id:'a',name:'A',parentId:'r',when:{age:'D'},cause:'flood',mutation:{change:'spread'}},
  {id:'b',name:'B',parentId:'a',when:{age:'E'},cause:'E',mutation:{change:'plates',curse:'k'}},{id:'side',name:'Side',parentId:'b',when:{age:'F'},cause:'F',extinct:{age:'G'},mutation:{change:'stiff'}},{id:'nc',name:'No cause',parentId:'r',when:{age:'B'}}],
  creatures:[{id:'m',name:'Murmur',parentId:'b',when:{age:'E'},cause:'E',mutation:{change:'one mind'}}] });
const types=ch=>ch.cards.map(c=>c.type+(c.id?':'+c.id:'')).join(' ');
t('by lineage: the first chain runs from the root along the biggest branch, cause before each change',()=>{ const ch=X.byLineage(st()); assert.strictEqual(ch[0].from,null); const ty=types(ch[0]); assert.ok(ty.startsWith('cause:worlds form:r cause:flood form:a cause:E form:b'),ty); });
t('the same cause twice in a row is named once',()=>{ const ch=X.byLineage(st()); const first=ch[0].cards; const i=first.findIndex(c=>c.id==='b'); const after=first.slice(i+1); if(after[0]&&after[0].type==='form') assert.ok(true); const all=X.byLineage(st()).map(types).join(' | '); assert.ok(!/cause:E form:b cause:E/.test(all)); });
t('every other branch starts at its fork with a "from" card, and nothing is repeated',()=>{ const ch=X.byLineage(st()); const forms=ch.flatMap(c=>c.cards.filter(x=>x.type==='form').map(x=>x.id)); assert.strictEqual(forms.length,new Set(forms).size); assert.strictEqual(forms.length,6); ch.slice(1).forEach(c=>assert.strictEqual(c.cards[0].type,'from')); });
t('a line that died out ends on an "ended" card',()=>{ const ch=X.byLineage(st()); const side=ch.find(c=>c.cards.some(x=>x.id==='side'&&x.type==='form')); assert.strictEqual(side.cards[side.cards.length-1].type,'ended'); });
t('a form with no cause shows a "?" gap where the cause would be, and is listed',()=>{ const ch=X.byLineage(st()); const g=ch.find(c=>c.cards.some(x=>x.id==='nc'&&x.type==='form')); assert.ok(g.cards.some(x=>x.type==='gap'&&x.id==='nc')); assert.deepStrictEqual(j(X.gaps(st())),[{id:'nc',name:'No cause'}]); });
t('causes read as words with their kind; listed most used first',()=>{ const cs=X.causes(st()); assert.strictEqual(cs[0].id,'E'); assert.strictEqual(cs[0].count,2); const fl=cs.find(c=>c.id==='flood'); assert.strictEqual(fl.kind,'event'); assert.strictEqual(fl.label,'The flood'); assert.strictEqual(cs.find(c=>c.id==='worlds').kind,'epoch'); });
t('by cause: every form it changed, with the form it came from',()=>{ const ch=X.byCause(st(),'E'); assert.strictEqual(ch.length,2); ch.forEach(c=>{ assert.strictEqual(c.cards[0].type,'from'); assert.ok(c.cards.some(x=>x.type==='cause'&&x.id==='E')); }); });
t('by cause: the line after the form follows on until it forks or ends',()=>{ const ch=X.byCause(st(),'flood'); assert.strictEqual(ch.length,1); const ty=types(ch[0]); assert.ok(/form:a cause:E form:b from:b/.test(ty),ty); });
t('a cause nothing names gives no chains',()=>{ assert.strictEqual(X.byCause(st(),'nothing').length,0); });
t('silhouettes stay silhouettes: no name, no cause',()=>{ const s=st(); s.nodes[1]={id:'?1',silhouette:true,name:'',parentId:'r',when:{age:'D'}}; s.nodes[2].parentId='?1'; const all=JSON.stringify(X.byLineage(s)); assert.ok(all.includes('"type":"sil"')); assert.ok(!all.includes('spread')); });
t('a loop in the data never hangs, and every form is still reached once',()=>{ const s=st(); s.nodes.push({id:'l1',name:'L1',parentId:'l2'},{id:'l2',name:'L2',parentId:'l1'}); const ch=X.byLineage(s); const forms=ch.flatMap(c=>c.cards.filter(x=>x.type==='form').map(x=>x.id)); assert.ok(forms.includes('l1')&&forms.includes('l2')); assert.strictEqual(forms.length,new Set(forms).size); });
t('an empty log gives no chains, no causes, no gaps',()=>{ assert.strictEqual(X.byLineage({}).length,0); assert.strictEqual(X.causes({}).length,0); assert.strictEqual(X.gaps({}).length,0); });
console.log(n+' passed');
