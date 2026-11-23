const fs=require('fs'), vm=require('vm'), assert=require('assert');
const store={}; const ctx={localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}},console,JSON,Math}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
const EV={e1:1,e2:2,e3:3};
ctx.EpitaphTimeline={latestChapter:()=>3,authorMode:()=>false,byId:id=>id in EV?{id,revealedAt:EV[id]}:null,isRevealed:(e,ch)=>{const at=ch==null?3:ch;if(e.secret&&!e.revealedAt)return at>=3;return at>=(e.revealedAt||0)},revealChapter:e=>e.revealedAt,firstChapter:()=>null,load:()=>[]};
vm.runInContext(fs.readFileSync(require('path').resolve(__dirname,'../..')+'/assets/epitaph-sites.js','utf8'),ctx);
const S=ctx.EpitaphSites, j=o=>JSON.parse(JSON.stringify(o));
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
const R=(id,ties,open=true)=>S.normalise({placeId:id,open,foreign:{ties:ties||[]}});
const recs=[
 R('a',[{id:'ab',with:'place:b',kind:'alliance',from:null,to:'e3'},{id:'ac',with:'place:c',kind:'covert',secret:true,from:null},{id:'ad',with:'place:d',kind:'trade',from:'e2'}]),
 R('b',[{id:'ba',with:'place:a',kind:'alliance',from:null},{id:'bh',with:'place:h',kind:'war',from:null}]),
 R('c',[]), R('d',[]),
 R('h',[],false),                     // a place no chapter has brought up: hidden from readers
];
const W=(ch,au)=>j(S.webAt(ch,recs,au)), keys=w=>w.edges.map(e=>e.key).sort(), ids=w=>w.nodes.map(x=>x.id).sort();
t('reader Ch 1: public ties that have started, between reached places',()=>assert.deepStrictEqual(keys(W(1,false)),['a|b|alliance']));
t('reader never sees the unreached place, nor the tie to it',()=>{const w=W(3,false);assert.ok(!ids(w).includes('h'));assert.ok(!keys(w).some(k=>k.includes('h')))});
t('reader: a dated tie appears in its chapter',()=>{assert.ok(!keys(W(1,false)).includes('a|d|trade'));assert.ok(keys(W(2,false)).includes('a|d|trade'))});
t('reader: an undated secret tie waits for the latest chapter',()=>{assert.ok(!keys(W(2,false)).includes('a|c|covert'));assert.ok(keys(W(3,false)).includes('a|c|covert'))});
t('author sees the secret tie early, marked hidden',()=>{const e=W(1,true).edges.find(x=>x.kind==='covert');assert.ok(e&&e.hidden&&e.secret)});
t('author still follows the chapter for what has started',()=>assert.ok(!keys(W(1,true)).includes('a|d|trade')));
t('author sees the unreached place, marked hidden, and its tie, marked hidden',()=>{const w=W(1,true);assert.ok(w.nodes.find(x=>x.id==='h').hidden);assert.ok(w.edges.find(x=>x.kind==='war').hidden)});
t('a tie both sides record is drawn once',()=>assert.strictEqual(W(3,true).edges.filter(e=>e.kind==='alliance').length,1));
t('an end the reader has not reached: not ended, end and its chapter withheld',()=>{const e=W(2,false).edges.find(x=>x.kind==='alliance');assert.deepStrictEqual([e.ended,e.endHidden,e.to,e.endCh],[false,true,null,null])});
t('a reached end: ended, with the chapter it ended in',()=>{const e=W(3,false).edges.find(x=>x.kind==='alliance');assert.deepStrictEqual([e.ended,e.to,e.endCh],[true,'e3',3])});
t('the author sees the real end chapter ahead of time',()=>{const e=W(1,true).edges.find(x=>x.kind==='alliance');assert.deepStrictEqual([e.ended,e.endCh],[false,3])});
t('startCh: 0 for a tie from before the story, the chapter for a dated one',()=>{const w=W(3,false);assert.strictEqual(w.edges.find(x=>x.kind==='alliance').startCh,0);assert.strictEqual(w.edges.find(x=>x.kind==='trade').startCh,2)});
t('a tie to itself or to nothing is ignored',()=>{const w=j(S.webAt(3,[R('x',[{id:'1',with:'place:x',kind:'war'},{id:'2',with:'',kind:'war'}])],true));assert.strictEqual(w.edges.length,0)});
t('a tie to a place with no entry still shows (both are drawn)',()=>{const w=j(S.webAt(3,[R('x',[{id:'1',with:'place:zz',kind:'trade'}])],false));assert.deepStrictEqual(w.nodes.map(x=>x.id).sort(),['x','zz'])});
// seats
const G={a:'S',b:'S',c:'V',d:'V',e:'V',f:'F'}, NM={a:'Aurelia',b:'Church',c:'Temple',d:'Hollow',e:'Ash',f:'Grove'};
const seats=ids=>j(S.ringSeats(ids,id=>G[id],id=>NM[id],id=>id==='c'));
t('seats: biggest group first, starting at the top',()=>{const s=seats(['a','b','c','d','e','f']);assert.deepStrictEqual(s.groups.map(g=>g.name),['V','S','F']);assert.ok(Math.abs(s.seats.c+Math.PI/2)<1e-9)});
t('seats: statue first in its group, then by name',()=>assert.deepStrictEqual(seats(['a','b','c','d','e','f']).groups[0].ids,['c','e','d']));
t('seats: an empty seat between groups',()=>{const s=seats(['a','b','c','d','e','f']),st=Math.PI*2/9;assert.ok(Math.abs((s.seats.a-s.seats.d)-2*st)<1e-9)});
t('seats do not depend on the order ids arrive in',()=>assert.deepStrictEqual(seats(['f','e','d','c','b','a']).seats,seats(['a','b','c','d','e','f']).seats));
t('seats: one group, no gap; nothing, no crash',()=>{const s=seats(['a','b']);assert.ok(Math.abs((s.seats.b-s.seats.a)-Math.PI)<1e-9);assert.deepStrictEqual(seats([]).groups,[])});
t('seats: duplicates count once',()=>assert.strictEqual(Object.keys(seats(['a','a','b']).seats).length,2));
console.log(n+' passed');
