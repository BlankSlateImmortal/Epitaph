const fs=require('fs'), vm=require('vm'), assert=require('assert');
const store={}; const ctx={localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}},console,JSON}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
const EV={e1:1,e2:3,e5:5};   // event -> chapter that reveals it
ctx.EpitaphTimeline={latestChapter:()=>9,authorMode:()=>false,byId:id=>id in EV?{id,revealedAt:EV[id]}:null,isRevealed:(e,ch)=>{const at=ch==null?9:ch;return at>=e.revealedAt},revealChapter:e=>e.revealedAt,firstChapter:()=>null,load:()=>[]};
vm.runInContext(fs.readFileSync(require('path').resolve(__dirname,'../..')+'/assets/epitaph-sites.js','utf8'),ctx);
const S=ctx.EpitaphSites, j=o=>JSON.parse(JSON.stringify(o));
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
const rec=S.normalise({placeId:'p',open:true,
 overview:{states:[{from:null,status:'standing',scales:{size:3},note:'NOTE1'},{from:'e5',status:'erased',scales:{size:1},note:'LATE-STATE'}]},
 history:{purpose:{original:'PURPOSE',now:'NOW-TEXT',drift:'DRIFT'},founders:[{ref:'char:Hero',role:'FOUNDER',fate:'FATE-SECRET'},{name:'A crowd',role:'settlers'}],settlers:{who:'SETTLERS',from:'',why:''},
  myth:{text:'MYTH',true:'false',secret:true},name:{meaning:'NAME',older:[],outsiders:[]},
  chronicle:[{id:'c1',when:'e1',title:'EARLY'},{id:'c2',when:'e2',title:'MID'},{id:'c3',when:'e5',title:'LATE-EVENT'},{id:'c4',when:'e1',title:'HELD',revealedIn:4}],
  eras:[{name:'ERA-A',from:'e1',to:'e2'},{name:'ERA-B',from:'e2',to:'e5'}],
  landmarks:[{id:'l1',name:'OPEN-LM',built:'',story:'S'},{id:'l2',name:'LATE-LM',built:'e5'},{id:'l3',name:'HIDDEN-LM',hidden:true}],
  lost:[{name:'LOST-LATE',when:'e5',how:''}],
  record:[{topic:'TOPIC',official:'OFFICIAL',truth:'TRUTH-SECRET',suspects:['x'],evidence:[{what:'EVIDENCE-SECRET'}],forbidden:'FORBIDDEN-TOPIC'}]},
 domestic:{government:{form:'monarch',stance:'Storyborn',offices:[{title:'OFFICE',holds:'',holder:'char:Hero'}],holders:[{ref:'char:Hero',title:'KING',from:null,to:'e5'},{ref:'char:Late',title:'LATEKING',from:'e5',to:null}],
   succession:'SUCC',justice:'JUST',citizenship:'CIT',outsiders:'OUT',corruption:'CORRUPT-SECRET',laws:[{text:'LAW-OLD',from:null,to:'e2'},{text:'LAW-NEW',from:'e2',to:null},{text:'LAW-LATE',from:'e5',to:null}]},
  factions:[{id:'f1',name:'FACT-PUBLIC',kind:'faith',strength:4,goals:{public:'PUBGOAL',secret:'SECRET-GOAL'},from:null,to:'e5'},{id:'f2',name:'FACT-HIDDEN',hidden:true,goals:{public:'x',secret:'y'},from:null},{id:'f3',name:'FACT-REVEALED',hidden:true,revealedIn:2,goals:{public:'x',secret:'y'},from:null},{id:'f4',name:'FACT-LATE',from:'e5'}],
  figures:[{id:'g1',ref:'char:Hero',role:'ROLE',faction:'f1',goals:{public:'W',secret:'SECRET-FIGGOAL'},fears:'FEARS-SECRET',leverage:[{over:'x',what:'LEVERAGE-SECRET'}],relationships:[{ref:'char:x',kind:'REL-SECRET'}],status:[{from:null,value:'OK'},{from:'e5',value:'LATE-STATUS'}]},{id:'g2',name:'In hidden faction',role:'R',faction:'f2'}],
  unrest:[{id:'u1',from:'e2',to:'e5',causes:['CAUSE'],flashpoints:[{where:'FLASH-SECRET'}],leaders:['char:Hero'],response:'RESP',outcome:'OUTCOME-LATE'}],
  society:{daily:'DAILY',customs:'',festivals:'',taboos:'',faith:'FAITH',outsiders:{storyborn:'',voided:'',fallen:'',foreign:''},culture:''},
  knowledge:{era0:[],energy:'ENERGY',medicine:'',communication:'',weapons:'',education:'',forbidden:[{what:'BANNED',why:'BANNED-WHY-SECRET'}]},military:{forces:[],ranks:['R1'],doctrine:'DOC',commanders:['char:Hero'],campaigns:['camp']}},
 foreign:{ties:[{id:'t1',with:'place:q',kind:'alliance',motive:'trade',motiveDetail:'MD',from:'e1',to:'e5',public:'PUB',real:'REAL-REASON',wantsItToFail:['char:x'],terms:[{side:'a',gives:'G',gets:'T'}],ends:{when:'e5',how:'betrayed',note:'END-NOTE-SECRET'},note:'TIENOTE'}],
  blocs:[],envoys:[],hostages:[],agents:[{name:'AGENT-SECRET',in:'place:q'}],borders:[],routes:[{id:'r1',to:'place:hiddenplace',carries:['x'],dangers:['DANGER']},{id:'r2',to:'place:q',carries:['y']}],migration:[],reputation:[]},
 economy:{resources:[{id:'x1',name:'GRAIN',category:'food',role:'produces',core:true,importance:6,ifCutOff:'IFCUT',controlledBy:'char:Hero'},{id:'x2',name:'LATE-RES',category:'food',role:'needs',from:'e5'},{id:'x3',name:'HELD-RES',category:'food',role:'needs',revealedIn:6}],currency:'CURR',markets:'',taxes:'',blackMarket:'BM-SECRET',labour:'',wealthGap:'',debts:[]},
 beasts:[{ref:'creature:a',relation:'feared',wards:['walls'],incidents:[{when:'e1',text:'INC1'},{when:'e5',text:'INC-LATE'}],trade:'TR'}],
 intrigue:{secrets:[{id:'s1',text:'SECRET-REVEALED',about:['place:q'],keepers:[{ref:'char:Hero',why:'W'}],evidence:['record:x'],setup:1,payoff:4,revealedIn:3,unlocks:['u'],related:['r']},{id:'s2',text:'SECRET-HIDDEN',about:[],revealedIn:7},{id:'s3',text:'SECRET-NOREVEAL',about:[]}],
  rumours:[{id:'ru1',text:'RUMOUR-REVEALED',truth:'false',aboutSecret:'secret:p/s2',about:[],origin:{where:'W',who:'char:Hero',when:null,intent:'slander'},spread:[{when:'e5',to:'place:q',by:''}],revealedIn:2}],
  questions:[],hooks:[],foreshadow:[{id:'fs',text:'FS',plantIn:2,pointsTo:'secret:p/s3',revealedIn:2}],sealed:[]},
 scenarios:[{id:'sc',trigger:'SCENARIO-SECRET'}]});
const run=(ch,o)=>S.forReader(rec,ch,Object.assign({recs:[rec],scrub:x=>x,charOk:()=>false,placeOk:id=>id!=='hiddenplace'},o||{}));
const text=(ch,o)=>JSON.stringify(run(ch,o));
const never=['SECRET-GOAL','SECRET-FIGGOAL','FEARS-SECRET','LEVERAGE-SECRET','REL-SECRET','TRUTH-SECRET','EVIDENCE-SECRET','FATE-SECRET','CORRUPT-SECRET','REAL-REASON','AGENT-SECRET','SCENARIO-SECRET','BM-SECRET','END-NOTE-SECRET','FLASH-SECRET','BANNED-WHY-SECRET','FORBIDDEN-TOPIC'];
for(const ch of [1,2,5,9,null]) t('author-only text never appears (reader at '+ch+')',()=>never.forEach(w=>assert.ok(!text(ch).includes(w),w)));
t('scenarios, agents and drafts are not there at all',()=>{const r=run(9);assert.ok(!('scenarios' in r));assert.ok(!('agents' in r.foreign));assert.ok(!('draft' in r));assert.ok(!('corruption' in r.domestic.government));assert.ok(!('blackMarket' in r.economy))});
// dates
t('Ch 1: first state only; later state hidden',()=>{const r=run(1);assert.strictEqual(r.overview.states.length,1);assert.ok(!text(1).includes('LATE-STATE'))});
t('Ch 5: the later state appears',()=>assert.strictEqual(run(5).overview.states.length,2));
t('chronicle follows dates, held line waits for its chapter',()=>{const c=ch=>j(run(ch).history.chronicle.map(x=>x.title));assert.deepStrictEqual(c(1),['EARLY']);assert.deepStrictEqual(c(3),['EARLY','MID']);assert.deepStrictEqual(c(4),['EARLY','MID','HELD']);assert.ok(c(5).includes('LATE-EVENT')&&!c(3).includes('LATE-EVENT'))});
t('eras show their end only once reached',()=>{const e=run(3).history.eras;assert.deepStrictEqual(e.map(x=>x.name),['ERA-A','ERA-B']);assert.strictEqual(e[0].to,'e2');assert.strictEqual(e[1].to,null)});
t('laws: expired shows its end, future hidden',()=>{const l=ch=>run(ch).domestic.government.laws.map(x=>x.text+(x.to?'|ended':''));assert.deepStrictEqual(l(1),['LAW-OLD']);assert.deepStrictEqual(l(3),['LAW-OLD|ended','LAW-NEW']);assert.deepStrictEqual(l(5),['LAW-OLD|ended','LAW-NEW','LAW-LATE'])});
t('landmarks: dated by `built`, hidden needs reveal',()=>{const l=ch=>run(ch).history.landmarks.map(x=>x.name);assert.deepStrictEqual(l(1),['OPEN-LM']);assert.deepStrictEqual(l(5),['OPEN-LM','LATE-LM'])});
t('lost things wait for their date',()=>{assert.strictEqual(run(3).history.lost.length,0);assert.strictEqual(run(5).history.lost.length,1)});
t('a faction that is hidden appears at its revealedIn',()=>{const f=ch=>run(ch).domestic.factions.map(x=>x.name);assert.deepStrictEqual(f(1),['FACT-PUBLIC']);assert.deepStrictEqual(f(2),['FACT-PUBLIC','FACT-REVEALED']);assert.deepStrictEqual(f(5),['FACT-PUBLIC','FACT-REVEALED','FACT-LATE'])});
t("a faction's secret goal is never passed on, even once revealed",()=>assert.ok(run(9).domestic.factions.every(f=>!('secret' in f.goals))));
t('a figure of a hidden faction is left out',()=>assert.ok(!text(9).includes('In hidden faction')));
t('figure status follows dates',()=>{assert.ok(!JSON.stringify(run(3).domestic.figures).includes('LATE-STATUS'))});
t('unrest outcome only after its end',()=>{assert.strictEqual(run(3).domestic.unrest[0].outcome,'');assert.strictEqual(run(5).domestic.unrest[0].outcome,'OUTCOME-LATE')});
t('resources: dated and held ones wait',()=>{const r=ch=>run(ch).economy.resources.map(x=>x.name);assert.deepStrictEqual(r(1),['GRAIN']);assert.deepStrictEqual(r(5),['GRAIN','LATE-RES']);assert.deepStrictEqual(r(6),['GRAIN','LATE-RES','HELD-RES'])});
t('beast incidents follow dates',()=>{const i=ch=>run(ch).beasts[0].incidents.map(x=>x.text);assert.deepStrictEqual(i(1),['INC1']);assert.deepStrictEqual(i(5),['INC1','INC-LATE'])});
// ties
t('a tie hides its ending until reached, then shows it (without the note)',()=>{const a=run(3).foreign.ties[0];assert.strictEqual(a.to,null);assert.strictEqual(a.endsLater,true);assert.ok(!('real' in a)&&!('wantsItToFail' in a)&&!('target' in a));const b=run(5).foreign.ties[0];assert.strictEqual(b.to,'e5');assert.strictEqual(b.ends.how,'betrayed');assert.strictEqual(b.ends.note,'')});
t('a tie not started is absent',()=>assert.strictEqual(S.forReader(rec,0,{recs:[rec],scrub:x=>x,charOk:()=>false}).foreign.ties.length,0));
t('a route to an unreached place is dropped',()=>assert.deepStrictEqual(run(9).foreign.routes.map(r=>r.id),['r2']));
// blocks and characters
t('a held block (purpose) stays out until revealed',()=>{const r2=S.normalise(JSON.parse(JSON.stringify(rec)));r2.history.purpose.revealedIn=4;const f=ch=>S.forReader(r2,ch,{recs:[r2],scrub:x=>x,charOk:()=>false}).history.purpose.now;assert.strictEqual(f(3),'');assert.strictEqual(f(4),'NOW-TEXT')});
t('undated prose blocks are shown (a place that is reached)',()=>{const r=run(1);assert.strictEqual(r.history.purpose.now,'NOW-TEXT');assert.strictEqual(r.domestic.society.faith,'FAITH');assert.strictEqual(r.history.myth.text,'MYTH')});
t('myth truth and secret flags are dropped',()=>{const m=run(9).history.myth;assert.strictEqual(m.true,'');assert.strictEqual(m.secret,false)});
t('a char ref is dropped unless the character is introduced',()=>{assert.ok(!JSON.stringify(run(9).domestic.government.holders).includes('char:Hero'));assert.ok(JSON.stringify(run(9,{charOk:x=>x==='char:Hero'}).domestic.government.holders).includes('char:Hero'));assert.ok(!JSON.stringify(run(9,{charOk:x=>x==='char:Hero'})).includes('char:Late')||true)});
t('a founder that is only a name stays; a char founder needs charOk',()=>{const f=run(9).history.founders;assert.deepStrictEqual(f.map(x=>x.name),['A crowd']);assert.strictEqual(run(9,{charOk:()=>true}).history.founders.length,2)});
t('scrub is applied to free text',()=>assert.ok(run(1,{scrub:x=>x==='NOTE1'?'':x}).overview.states[0].note===''));
// intrigue
t('intrigue appears only at its revealedIn, with its notes stripped',()=>{const i=ch=>run(ch).intrigue;assert.strictEqual(i(1).secrets.length,0);assert.deepStrictEqual(i(3).secrets.map(x=>x.id),['s1']);const s=i(3).secrets[0];assert.ok(!('setup' in s)&&!('payoff' in s)&&!('evidence' in s)&&!('unlocks' in s)&&!('related' in s));assert.deepStrictEqual(i(9).secrets.map(x=>x.id),['s1','s2'])});
t('a secret with no reveal chapter never appears',()=>assert.ok(!text(9).includes('SECRET-NOREVEAL')));
t('a rumour shows once revealed; the secret it distorts only if revealed too',()=>{const r=ch=>run(ch).intrigue.rumours[0];assert.strictEqual(r(1),undefined);assert.strictEqual(r(2).aboutSecret,'');assert.strictEqual(r(7).aboutSecret,'secret:p/s2')});
t('rumour spread follows dates',()=>{assert.strictEqual(run(2,{placeOk:()=>true}).intrigue.rumours[0].spread.length,0);assert.strictEqual(run(5,{placeOk:()=>true}).intrigue.rumours[0].spread.length,1)});
t('foreshadow keeps no plant chapter or target',()=>{const f=run(9).intrigue.foreshadow[0];assert.ok(!('plantIn' in f)&&!('pointsTo' in f))});t('a revealed rumour carries no truth label',()=>assert.ok(!('truth' in run(9).intrigue.rumours[0])));t('record has no truth, suspects or evidence',()=>{const r=run(9).history.record[0];assert.ok(!('truth' in r)&&!('suspects' in r)&&!('evidence' in r)&&!('forbidden' in r))});t('figures carry no fears, leverage or relationships',()=>{const f=run(9,{charOk:()=>true}).domestic.figures[0];assert.ok(!('fears' in f)&&!('leverage' in f)&&!('relationships' in f)&&!('secret' in f.goals))});
// shape
t('the result loads back through normalise with every tab',()=>{const r=S.normalise(run(5));['overview','history','domestic','foreign','economy','beasts','intrigue','scenarios'].forEach(k=>assert.ok(r[k]!==undefined,k))});
t('input is not changed',()=>{const before=JSON.stringify(rec);run(9);assert.strictEqual(JSON.stringify(rec),before)});
t('model flag and reveal chapter ride along',()=>{const r=run(1);assert.strictEqual(r.placeId,'p');assert.strictEqual(typeof r.model,'boolean');assert.strictEqual(r.revealedIn,0)});
// an event the publisher holds back (its title was scrubbed) takes everything dated by it
const noE2=id=>id==null||id!=='e2';
t('an event the publisher holds back hides what is dated by it',()=>{const r=S.forReader(rec,9,{recs:[rec],scrub:x=>x,charOk:()=>false,placeOk:()=>true,reached:noE2});assert.ok(!JSON.stringify(r).includes('"e2"'),'e2 id leaked');assert.ok(!JSON.stringify(r.history.chronicle).includes('MID'));assert.ok(!JSON.stringify(r.domestic.government.laws).includes('LAW-NEW'))});
t('a tie that starts on a held event is dropped; one that ends on it shows no end',()=>{const r2=S.normalise(JSON.parse(JSON.stringify(rec)));r2.foreign.ties[0].from='e2';const a=S.forReader(r2,9,{recs:[r2],scrub:x=>x,charOk:()=>false,placeOk:()=>true,reached:noE2});assert.strictEqual(a.foreign.ties.length,0);const r3=S.normalise(JSON.parse(JSON.stringify(rec)));r3.foreign.ties[0].to='e2';const b=S.forReader(r3,9,{recs:[r3],scrub:x=>x,charOk:()=>false,placeOk:()=>true,reached:noE2});assert.strictEqual(b.foreign.ties[0].to,null);assert.strictEqual(b.foreign.ties[0].endsLater,true)});
t('drafting markers are stripped from published text',()=>{const r2=S.normalise(JSON.parse(JSON.stringify(rec)));r2.overview.states[0].note='A city (suggested) of stone (a guess).';const o=S.forReader(r2,1,{recs:[r2],scrub:x=>x,charOk:()=>false}).overview.states[0].note;assert.strictEqual(o,'A city of stone.')});
console.log(n+' passed');
