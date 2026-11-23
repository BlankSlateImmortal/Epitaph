const fs=require('fs'), vm=require('vm'), assert=require('assert');
const store={}; const ctx={localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}},console,JSON,Math}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
const EV={e1:1,e2:2,e3:3};
ctx.EpitaphTimeline={latestChapter:()=>3,authorMode:()=>false,byId:id=>id in EV?{id,revealedAt:EV[id]}:null,isRevealed:(e,ch)=>{const at=ch==null?3:ch;return at>=(e.revealedAt||0)},revealChapter:e=>e.revealedAt,firstChapter:()=>null,load:()=>[]};
vm.runInContext(fs.readFileSync(require('path').resolve(__dirname,'../..')+'/assets/epitaph-sites.js','utf8'),ctx);
const S=ctx.EpitaphSites, j=o=>JSON.parse(JSON.stringify(o));
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
const R=(id,blocs,open=true)=>S.normalise({placeId:id,open,foreign:{blocs:blocs||[]}});
const recs=[
 R('a',[{id:'pact',name:'The Pact',charter:'CHARTER',purpose:'PURPOSE',members:[{place:'place:a',from:null,to:null},{place:'place:b',from:null,to:'e3'},{place:'place:c',from:'e2',to:null},{place:'place:h',from:null,to:null}]},
        {id:'sec',name:'Secret League',hidden:true,revealedIn:3,members:[{place:'place:a',from:null,to:null}]},
        {id:'late',name:'Late',members:[{place:'place:a',from:'e3',to:null}]}]),
 R('b',[]), R('c',[]), R('h',[],false),
];
const B=(ch,au)=>j(S.blocsAt(ch,recs,au)), P=(ch,au)=>B(ch,au).find(x=>x.name==='The Pact'), names=l=>l.map(x=>x.name), mem=(b,id)=>b.members.map(m=>m.place);
t('reader Ch 1: the pact, without a member that starts later or a place not reached',()=>{const l=B(1,false);assert.deepStrictEqual(names(l),['The Pact']);assert.deepStrictEqual(mem(l[0]).sort(),['a','b'])});
t('reader: a member appears at the chapter its start is reached',()=>assert.ok(mem(P(2,false)).includes('c')));
t('reader: a hidden bloc stays out until its revealedIn',()=>{assert.ok(!names(B(2,false)).includes('Secret League'));assert.ok(names(B(3,false)).includes('Secret League'))});
t('reader: a bloc whose only member has not started is not listed',()=>assert.ok(!names(B(2,false)).includes('Late')));
t('reader: never sees the unreached place as a member',()=>assert.ok(!P(3,false).members.some(m=>m.place==='h')));
t('reader: an unreached end is withheld; a reached end is a departure',()=>{const b1=P(2,false).members.find(m=>m.place==='b');assert.deepStrictEqual([b1.left,b1.to,b1.endCh],[false,null,null]);const b3=P(3,false).members.find(m=>m.place==='b');assert.deepStrictEqual([b3.left,b3.to,b3.endCh],[true,'e3',3])});
t('size counts members present now',()=>{assert.strictEqual(P(1,false).size,2);assert.strictEqual(P(2,false).size,3);assert.strictEqual(P(3,false).size,2)});
t('author sees the hidden bloc early, marked hidden',()=>{const b=B(1,true).find(x=>x.name==='Secret League');assert.ok(b&&b.hidden)});
t('author sees the unreached place as a hidden member',()=>{const m=P(1,true).members.find(x=>x.place==='h');assert.ok(m&&m.hidden)});
t('author still follows the chapter for what has started',()=>{assert.ok(!mem(B(1,true).find(x=>x.name==='The Pact')).includes('c'));assert.ok(mem(B(2,true).find(x=>x.name==='The Pact')).includes('c'))});
t('author sees a real end ahead of time, marked as not yet visible',()=>{const m=P(1,true).members.find(x=>x.place==='b');assert.deepStrictEqual([m.left,m.endHidden,m.to,m.endCh],[false,true,'e3',3])});
t('a public bloc is not marked hidden for the author',()=>assert.strictEqual(B(2,true).find(x=>x.name==='The Pact').hidden,false));
t('reader copy carries the words',()=>{const b=P(1,false);assert.deepStrictEqual([b.charter,b.purpose,b.owner,b.key],['CHARTER','PURPOSE','a','a/pact'])});
t('no blocs, no crash',()=>assert.deepStrictEqual(j(S.blocsAt(1,[R('x',[])],false)),[]));
console.log(n+' passed');
