const fs=require('fs'), vm=require('vm'), assert=require('assert');
const ctx={localStorage:{getItem:()=>null,setItem(){}},console,JSON}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').resolve(__dirname,'../..')+'/assets/epitaph-sites.js','utf8'),ctx);
const S=ctx.EpitaphSites, j=o=>JSON.parse(JSON.stringify(o));
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
const v=(ch,place,extra)=>Object.assign({startChapter:ch,location:{placeId:place},objective:''},extra||{});
const chars=[
  {id:'a',name:'Ann',snapshots:[v(1,'X',{objective:'arrives to study'}),v(2,'X'),v(3,'Y'),v(5,'X',{objective:'comes back'})]},   // here 1-2, gone 3-4, back 5
  {id:'b',name:'Bo',snapshots:[v(1,'Y'),v(4,'X',{objective:'a late arrival'})]},                                              // reaches X at 4, never leaves
  {id:'c',name:'Cy',snapshots:[v(2,'X'),v(3,'X',{presence:'dead'})]},                                                           // dies here
  {id:'d',name:'Di',snapshots:[v(1,'Y'),v(2,'Y')]},                                                                            // never here
  {id:'e',name:'Ed',snapshots:[{location:{placeId:'X'}}]},                                                                     // no startChapter: ignored
];
const chapters=[1,2,3,4,5,6].map(n=>({number:n,title:'Chapter '+n+' title'}));
const resolve=l=>l&&l.placeId||null;
const run=(at,author)=>j(S.storyOf({placeId:'X',characters:chars,chapters,resolve,at,author}));
const names=r=>r.people.map(p=>p.name);
t('author sees every character who was ever there',()=>assert.deepStrictEqual(names(run(null,true)),['Ann','Cy','Bo']));
t('a person who was never here is left out',()=>assert.ok(!names(run(null,true)).includes('Di')));
t('a version with no chapter number is ignored',()=>assert.ok(!names(run(null,true)).includes('Ed')));
t('Ann has two stays; the first ends when she leaves',()=>{const a=run(null,true).people.find(p=>p.name==='Ann');assert.deepStrictEqual(a.stays.map(s=>[s.from,s.to]),[[1,3],[5,null]]);assert.strictEqual(a.stays[0].why,'arrives to study');assert.strictEqual(a.stays[1].why,'comes back')});
t('Bo is still there',()=>{const b=run(null,true).people.find(p=>p.name==='Bo');assert.deepStrictEqual(b.stays.map(s=>[s.from,s.to]),[[4,null]])});
t('Cy died here',()=>assert.strictEqual(run(null,true).people.find(p=>p.name==='Cy').dead,true));
t('everyone else is not marked dead',()=>assert.ok(run(null,true).people.filter(p=>p.name!=='Cy').every(p=>!p.dead)));
// readers
t('a reader on Ch 2 sees only Ann and Cy',()=>assert.deepStrictEqual(names(run(2,false)),['Ann','Cy']));
t('Bo (arrives Ch 4) is hidden from a reader on Ch 3',()=>assert.ok(!names(run(3,false)).includes('Bo')));
t('a reader on Ch 2 is not told when Ann leaves (Ch 3)',()=>{const a=run(2,false).people.find(p=>p.name==='Ann');assert.deepStrictEqual(a.stays.map(s=>[s.from,s.to]),[[1,null]])});
t('a reader on Ch 3 learns Ann left',()=>{const a=run(3,false).people.find(p=>p.name==='Ann');assert.deepStrictEqual(a.stays.map(s=>[s.from,s.to]),[[1,3]])});
t('a reader on Ch 2 is not told Cy died (Ch 3)',()=>assert.strictEqual(run(2,false).people.find(p=>p.name==='Cy').dead,false));
t('a reader on Ch 3 is told',()=>assert.strictEqual(run(3,false).people.find(p=>p.name==='Cy').dead,true));
t("Ann's return (Ch 5) is not shown to a reader on Ch 4",()=>assert.strictEqual(run(4,false).people.find(p=>p.name==='Ann').stays.length,1));
t('the author view marks what a reader would not see',()=>{const r=run(3,true);const bo=r.people.find(p=>p.name==='Bo');assert.strictEqual(bo.hidden,true);assert.strictEqual(bo.stays[0].hidden,true);const a=r.people.find(p=>p.name==='Ann');assert.strictEqual(a.stays[1].hidden,true);assert.strictEqual(a.stays[0].hidden,false)});
// chapters
const ch=(at,author)=>run(at,author).chapters.map(c=>c.n);
t('chapters set here, author: 1,2,3 (Cy,Ann leaves at 3: Cy stays),4,5,6',()=>assert.deepStrictEqual(ch(null,true),[1,2,3,4,5,6]));
t('Chapter 3 has only Cy (Ann has left)',()=>assert.deepStrictEqual(run(null,true).chapters.find(c=>c.n===3).who,['Cy']));
t('Chapter 1 has only Ann',()=>assert.deepStrictEqual(run(null,true).chapters.find(c=>c.n===1).who,['Ann']));
t('chapter titles come from the Dossier',()=>assert.strictEqual(run(null,true).chapters[0].title,'Chapter 1 title'));
t('a reader on Ch 2 sees chapters 1 and 2 only',()=>assert.deepStrictEqual(ch(2,false),[1,2]));
t('the author sees later chapters marked hidden',()=>assert.ok(run(2,true).chapters.filter(c=>c.n>2).every(c=>c.hidden)&&run(2,true).chapters.filter(c=>c.n<=2).every(c=>!c.hidden)));
t('a chapter nobody is here in is not listed',()=>assert.ok(!ch(null,true).includes(0)));
t('no characters: nothing, no crash',()=>assert.deepStrictEqual(j(S.storyOf({placeId:'X',characters:[],chapters:[],resolve,at:null,author:true})),{people:[],chapters:[]}));
t('a resolver that throws counts as "not here"',()=>assert.deepStrictEqual(j(S.storyOf({placeId:'X',characters:chars,chapters,resolve:()=>{throw new Error('x')},at:null,author:true})).people,[]));
t('a place nobody visited has an empty story',()=>assert.strictEqual(j(S.storyOf({placeId:'Z',characters:chars,chapters,resolve,at:null,author:true})).people.length,0));
console.log(n+' passed');
