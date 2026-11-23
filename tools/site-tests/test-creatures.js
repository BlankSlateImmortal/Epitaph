const fs=require('fs'), vm=require('vm'), assert=require('assert');
let author=false; const EV={e1:1,e5:5};
const ctx={localStorage:{getItem:()=>null,setItem(){}},console,JSON,Math}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
ctx.EpitaphTimeline={latestChapter:()=>3,authorMode:()=>author,readerChapter:()=>null,byId:id=>id in EV?{id,revealedAt:EV[id]}:null,isRevealed:(e,ch)=>{const at=ch==null?3:ch;return at>=e.revealedAt},revealChapter:e=>e.revealedAt,firstChapter:()=>null,load:()=>[]};
vm.runInContext(fs.readFileSync(require('path').resolve(__dirname,'../..')+'/assets/epitaph-sites.js','utf8'),ctx);
const S=ctx.EpitaphSites, j=o=>JSON.parse(JSON.stringify(o));
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
const R=(id,open,beasts)=>S.normalise({placeId:id,open,beasts});
const recs=[R('a',true,[{ref:'creature:wyrm',relation:'feared'},{ref:'creature:moth',relation:'common'}]),R('b',true,[{ref:'creature:wyrm',relation:'kept'}]),
            R('c',false,[{ref:'creature:wyrm',relation:'worshipped'}]),R('d',true,[{ref:'creature:wyrm',relation:'hunted',hidden:true,revealedIn:5}]),R('e',true,[])];
const P=(c,au)=>j(S.creaturePlaces(c,recs,au));
t('reader: reached places that list it, hidden beasts stay out',()=>{author=false;assert.deepStrictEqual(P('creature:wyrm',false).map(x=>x.placeId),['a','b'])});
t('reader: never a place they have not reached',()=>assert.ok(!P('wyrm',false).some(x=>x.placeId==='c')));
t('the id or the ref both work',()=>assert.deepStrictEqual(P('wyrm',false),P('creature:wyrm',false)));
t('relation rides along',()=>assert.deepStrictEqual(P('wyrm',false).map(x=>x.relation),['feared','kept']));
t('author: every place, marking what a reader would not see',()=>{const l=P('wyrm',true);assert.deepStrictEqual(l.map(x=>x.placeId),['a','b','c','d']);assert.deepStrictEqual(l.map(x=>x.hidden),[false,false,true,true])});
t('a creature nobody lists, or no creature: nothing',()=>{assert.deepStrictEqual(P('ghost',true),[]);assert.deepStrictEqual(P('',true),[])});
t('a place that lists a different creature is not included',()=>assert.ok(!P('moth',true).some(x=>x.placeId==='b')));
console.log(n+' passed');
