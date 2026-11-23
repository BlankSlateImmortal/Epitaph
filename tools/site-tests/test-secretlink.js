const fs=require('fs'), vm=require('vm'), assert=require('assert');
const ctx={localStorage:{getItem:()=>null,setItem(){}},console,JSON}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').resolve(__dirname,'../..')+'/assets/epitaph-sites.js','utf8'),ctx);
const S=ctx.EpitaphSites, j=o=>JSON.parse(JSON.stringify(o)); const R='secret:p/s1';
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
const sec=(knows,ref)=>({text:'x',characterKnows:knows,knownBy:'',ref:ref===undefined?R:ref});
const chars=[
 {id:'a',name:'Ann',snapshots:[{startChapter:1,secrets:[sec(false)]},{startChapter:3,secrets:[sec(true)]},{startChapter:5,secrets:[sec(true)]}]},   // in her file from 1, learns it at 3
 {id:'b',name:'Bo',snapshots:[{startChapter:2,secrets:[sec(true)]}]},                                                                                 // knows from 2
 {id:'c',name:'Cy',snapshots:[{startChapter:1,secrets:[sec(false)]},{startChapter:4,secrets:[sec(false)]}]},                                          // never knows
 {id:'d',name:'Di',snapshots:[{startChapter:1,secrets:[sec(true,'secret:p/other')]}]},                                                                // a different secret
 {id:'e',name:'Ed',snapshots:[{startChapter:1,secrets:[{text:'plain',characterKnows:true,knownBy:''}]}]},                                             // no link
 {id:'f',name:'Fi',snapshots:[{secrets:[sec(true)]}]},                                                                                                 // no chapter number: ignored
];
const h=S.secretHolders(chars,R);
t('only characters whose file links the secret',()=>assert.deepStrictEqual(j(h.map(x=>x.name)),['Bo','Ann','Cy']));
t('Ann learns it at Ch 3 though it is in her file from Ch 1',()=>{const a=h.find(x=>x.name==='Ann');assert.strictEqual(a.involved,1);assert.strictEqual(a.knows,3)});
t('Bo knows from Ch 2',()=>assert.strictEqual(h.find(x=>x.name==='Bo').knows,2));
t('Cy never knows it',()=>{const c=h.find(x=>x.name==='Cy');assert.strictEqual(c.knows,null);assert.strictEqual(c.involved,1)});
t('sorted by when they learned it, those who never do last',()=>assert.deepStrictEqual(j(h.map(x=>x.knows)),[2,3,null]));
t('another secret and an unlinked one are not mixed in',()=>{assert.strictEqual(S.secretHolders(chars,'secret:p/other').length,1);assert.strictEqual(S.secretHolders(chars,'secret:p/none').length,0)});
t('no characters, no crash',()=>assert.deepStrictEqual(j(S.secretHolders([],R)),[]));
const story={people:[{id:'a',name:'Ann',stays:[{from:1,to:2},{from:5,to:null}]},{id:'b',name:'Bo',stays:[{from:2,to:null}]},{id:'z',name:'Zed',stays:[{from:4,to:null}]},{id:'c',name:'Cy',stays:[{from:1,to:null}]}]};
const f=S.couldFind(story,h);
t('Ann was there at Ch 1 before she knew (Ch 3): a prompt',()=>assert.deepStrictEqual(j(f.find(x=>x.name==='Ann')),{id:'a',name:'Ann',from:1}));
t('Bo arrived at Ch 2 already knowing: no prompt',()=>assert.ok(!f.some(x=>x.name==='Bo')));
t('Zed was there and has no link at all: a prompt',()=>assert.strictEqual(f.find(x=>x.name==='Zed').from,4));
t('Cy never knows, so he is a prompt',()=>assert.ok(f.some(x=>x.name==='Cy')));
t("someone who knew before a later stay is not prompted for it",()=>{const st={people:[{id:'a',name:'Ann',stays:[{from:5,to:null}]}]};assert.deepStrictEqual(j(S.couldFind(st,h)),[])});
t('no story, no crash',()=>assert.deepStrictEqual(j(S.couldFind(null,h)),[]));
t('the ref format',()=>{assert.ok(S.SECRET_REF.test('secret:aurelia/cell'));assert.ok(!S.SECRET_REF.test('secret:aurelia'));assert.ok(!S.SECRET_REF.test('faction:a/b'))});
console.log(n+' passed');
