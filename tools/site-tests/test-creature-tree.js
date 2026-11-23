// The Tree of Descent's layout (step 2.1): bands, ordering, forks, extinct and living tips, bad data (synthetic only)
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const root=path.resolve(__dirname,'../..'); const store={};
const ctx={console,JSON,Math,localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}}}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
ctx.EpitaphTimeline={authorMode:()=>true,byId:id=>id==='ev-x'?{id,title:'A quake: the ground opens'}:null,load:()=>[],compare:()=>0};
vm.runInContext(fs.readFileSync(root+'/assets/epitaph-creatures.js','utf8'),ctx); vm.runInContext(fs.readFileSync(root+'/assets/epitaph-creature-tree.js','utf8'),ctx);
const T=ctx.EpitaphCreatureTree;
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
const st={ nodes:[{id:'r',name:'Root',when:{epoch:'worlds'},biomes:['b1'],cause:'worlds'},{id:'a',name:'A',parentId:'r',when:{age:'A'},biomes:['b1'],cause:'ev-x'},
  {id:'b',name:'B',parentId:'a',when:{age:'E'},extinct:{age:'G'},biomes:['b2']},{id:'c',name:'C',parentId:'a',when:{age:'F'},biomes:['b1']},
  {id:'late',name:'Late',parentId:'c',when:{epoch:'chaos'}},{id:'orph',name:'Orphan',parentId:'ghost',when:'the-barriers'},
  {id:'l1',name:'Loop1',parentId:'l2',when:{age:'B'}},{id:'l2',name:'Loop2',parentId:'l1',when:{age:'C'}}],
  creatures:[{id:'m',name:'M',parentId:'c',when:{age:'G'},biomes:['b1'],curses:[{libId:'k',stage:3}]}], chaos:[{id:'ch',name:'Chaos one'}], biomes:[{id:'b1',name:'Biome one'},{id:'b2',name:'Biome two'}] };
const L=T.layout(st), N=id=>L.nodes.find(x=>x.id===id);
t('fourteen bands: seven epochs, then ages A–G; the last three are the curse cycle',()=>{ assert.strictEqual(L.bands.length,14); assert.deepStrictEqual(L.bands.filter(b=>b.curse).map(b=>b.id).join(''),'EFG'); });
t('times map to bands: epoch, age, age letter, an epoch\'s event, an age\'s opening event',()=>{ assert.strictEqual(T.bandOf({epoch:'chaos'}),0); assert.strictEqual(T.bandOf({age:'A'}),7); assert.strictEqual(T.bandOf('G'),13); assert.strictEqual(T.bandOf('war-of-gods'),4); assert.strictEqual(T.bandOf('the-barriers'),11); assert.strictEqual(T.bandOf('nonsense'),null); });
t('ages are always open; empty epochs fold thin; bands stack without gaps',()=>{ assert.ok(L.bands[0].h<L.bands[3].h); assert.strictEqual(L.bands[7].h,L.bands[3].h); for(let i=1;i<14;i++) assert.strictEqual(L.bands[i].top,L.bands[i-1].top+L.bands[i-1].h); });
t('every form is drawn once; every non-root has one edge from its parent',()=>{ assert.strictEqual(L.nodes.length,9); assert.strictEqual(new Set(L.nodes.map(x=>x.id)).size,9); L.nodes.filter(x=>x.parentId).forEach(x=>assert.ok(L.edges.some(e=>e.to===x.id&&e.from===x.parentId))); });
t('time runs down: a child sits below its ancestor',()=>{ L.edges.forEach(e=>assert.ok(e.y2>e.y1,e.from+'→'+e.to)); });
t('a fork is centred over its branches',()=>{ const a=N('a'),b=N('b'),c=N('c'); assert.ok(Math.abs(a.x-(Math.min(b.x,c.x)+Math.max(b.x,c.x))/2)<1e-6); });
t('an extinct line stops at the age it died out; a living tip runs on to the present',()=>{ const b=N('b'),m=N('m'); assert.ok(b.extinct&&!b.living); assert.ok(Math.abs(b.endY-(L.bands[13].top+L.bands[13].h/2))<1e-6); assert.ok(m.living); assert.ok(m.endY>=L.bands[13].top+L.bands[13].h-10); });
t('a form dated before its ancestor is drawn below it anyway, and flagged',()=>{ const x=N('late'); assert.ok(x.late); assert.ok(x.y>N('c').y); });
t('a missing parent or a loop makes a root, never a crash',()=>{ assert.strictEqual(N('orph').parentId,null); assert.ok(N('l1').parentId===null||N('l2').parentId===null); });
t('lineages don\'t overlap: every form has its own spot',()=>{ const k=new Set(L.nodes.map(x=>Math.round(x.x)+','+Math.round(x.y))); assert.strictEqual(k.size,L.nodes.length); });
t('cursed forms are marked; the chaos shelf is kept apart',()=>{ assert.ok(N('m').cursed); assert.ok(!N('a').cursed); assert.strictEqual(L.chaos.length,1); assert.ok(!N('ch')); });
t('colour by biome: the biggest biome gets the first colour; the legend uses biome names',()=>{ const p=T.colours(L,'biome',st); assert.strictEqual(p.of(N('m')),p.of(N('r'))); assert.notStrictEqual(p.of(N('b')),p.of(N('r'))); assert.strictEqual(p.legend[0][0],'Biome one'); });
t('colour by cause: causes read as epochs, ages or timeline titles',()=>{ const p=T.colours(L,'cause',st), ls=p.legend.map(x=>x[0]); assert.ok(ls.includes('The Making of Worlds')); assert.ok(ls.includes('A quake')); assert.ok(ls.some(x=>/No cause/.test(x))); });
t('an empty log lays out as nothing, without errors',()=>{ const e=T.layout({nodes:[],creatures:[],chaos:[]}); assert.strictEqual(e.nodes.length,0); assert.ok(e.width>0&&e.height>0); });
t('the scrubber shows only forms that have appeared, and edges between visible forms',()=>{ const v=T.visibleAt(L,7); assert.ok(v.nodes.every(x=>x.band<=7)); assert.ok(v.nodes.some(x=>x.id==='a')&&!v.nodes.some(x=>x.id==='b')); v.edges.forEach(e=>{ assert.ok(v.nodes.some(x=>x.id===e.from)&&v.nodes.some(x=>x.id===e.to)); }); });
t('at the end (or no time), everything is shown',()=>{ assert.strictEqual(T.visibleAt(L,13).nodes.length,L.nodes.length); assert.strictEqual(T.visibleAt(L,null).nodes.length,L.nodes.length); });
t('the scrubber never shows a form before the one it came from',()=>{ for(let b=0;b<14;b++){ const v=T.visibleAt(L,b), ids=new Set(v.nodes.map(x=>x.id)); v.nodes.forEach(x=>{ if(x.parentId&&!ids.has(x.parentId)) assert.fail(x.id+' at '+b); }); } });
t('a band lists the timeline moments that fall in it (epoch events, age opening and closing events)',()=>{ ctx.EpitaphTimeline.byId=id=>({id,title:'T '+id+': more'}); assert.ok(T.bandEvents(4).length>=1); assert.strictEqual(T.bandEvents(4)[0].title,'T omniscience-sealed'); assert.ok(T.bandEvents(7).length>=1); assert.strictEqual(T.bandEvents(1).length,0); });
t('a fork is flagged, with its branch count; a plain step is not; the change and its gain are carried for the hover card',()=>{ assert.ok(N('a').fork&&N('a').forks===2); assert.ok(!N('b').fork); const L2=T.layout({nodes:[{id:'p',name:'P',when:{age:'A'},mutation:{change:'grew horns',advantage:'defence'},cause:'A'}],creatures:[],chaos:[]}); assert.strictEqual(L2.nodes[0].change,'grew horns'); assert.strictEqual(L2.nodes[0].gain,'defence'); });
console.log(n+' passed');
