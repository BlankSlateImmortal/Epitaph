const fs=require('fs'), vm=require('vm'), assert=require('assert');
const ctx={localStorage:{getItem:()=>null,setItem(){}},console,JSON}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').resolve(__dirname,'../..')+'/assets/epitaph-sites.js','utf8'),ctx);
const S=ctx.EpitaphSites, j=o=>JSON.parse(JSON.stringify(o));
let n=0; const t=(name,f)=>{try{f();n++;console.log('ok  '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
const sec=(id,extra)=>Object.assign({id,text:'Secret '+id,about:[],keepers:[],evidence:[],setup:null,payoff:null},extra||{});
const rec=(secrets,fore,scen,record)=>({placeId:'p',intrigue:{secrets,foreshadow:fore||[]},scenarios:scen||[],history:{record:record||[]}});
const run=r=>j(S.plantPayoff([r],id=>id==='p'?'Place P':id));
const rules=r=>run(r).map(x=>x.rule+':'+x.level);
t('nothing set, nothing reported',()=>assert.deepStrictEqual(rules(rec([sec('a')])),[]));
t('set up but no payoff: a loaded gun (information)',()=>{const o=run(rec([sec('a',{setup:2})]));assert.deepStrictEqual(o.map(x=>x.rule+':'+x.level),['gun-loaded:info']);assert.ok(o[0].text.startsWith('Place P: ')&&o[0].text.includes('Ch 2'))});
t('pays off but never set up: a warning',()=>assert.deepStrictEqual(rules(rec([sec('a',{payoff:5})])),['gun-unplanted:warn']));
t('set up and paid off in order: fine',()=>assert.deepStrictEqual(rules(rec([sec('a',{setup:2,payoff:5})])),[]));
t('same chapter is fine',()=>assert.deepStrictEqual(rules(rec([sec('a',{setup:4,payoff:4})])),[]));
t('paid off before it is set up: a warning',()=>assert.deepStrictEqual(rules(rec([sec('a',{setup:6,payoff:3})])),['gun-order:warn']));
// evidence counts as a setup
const recd=[{topic:'The Archive',official:'x',evidence:[{what:'a door',where:'',revealedIn:3},{what:'a stair',where:'',revealedIn:2}]}];
t('evidence found in a chapter counts as the setup (the earliest one): with no payoff it is loaded, set up at Ch 2',()=>{const o=run(rec([sec('a',{evidence:['record:the-archive']})],[],[],recd));assert.deepStrictEqual(o.map(x=>x.rule),['gun-loaded']);assert.ok(o[0].text.includes('Ch 2'))});
t('evidence plus a payoff after it: set up and paid off, nothing to report',()=>assert.deepStrictEqual(rules(rec([sec('a',{evidence:['record:the-archive'],payoff:6})],[],[],recd)),[]));
t('evidence + a payoff before the evidence: still no warning (setup is the earliest evidence, 2)',()=>assert.deepStrictEqual(rules(rec([sec('a',{evidence:['record:the-archive'],payoff:1})],[],[],recd)),['gun-order:warn']));
t('a secret with evidence and a payoff but no chapters on the evidence: unplanted',()=>assert.deepStrictEqual(rules(rec([sec('a',{evidence:['record:the-archive'],payoff:5})],[],[],[{topic:'The Archive',official:'x',evidence:[{what:'d',where:'',revealedIn:null}]}])),['gun-unplanted:warn']));
// foreshadowing
const fs_=(plantIn,pointsTo)=>({id:'f',text:'A hint',plantIn,pointsTo});
t('foreshadowing not planted yet: ignored',()=>assert.deepStrictEqual(rules(rec([sec('a',{payoff:5})],[fs_(null,'secret:p/a')])),['gun-unplanted:warn']));
t('foreshadowing planted toward a secret with no payoff: loaded',()=>{const o=rules(rec([sec('a')],[fs_(2,'secret:p/a')]));assert.deepStrictEqual(o,['gun-loaded:info'])});
t('foreshadowing planted before the payoff: fine',()=>assert.deepStrictEqual(rules(rec([sec('a',{setup:2,payoff:5})],[fs_(3,'secret:p/a')])),[]));
t('foreshadowing planted after the payoff: a warning',()=>assert.deepStrictEqual(rules(rec([sec('a',{setup:2,payoff:5})],[fs_(7,'secret:p/a')])),['gun-order:warn']));
t('foreshadowing that points at something else is left alone',()=>assert.deepStrictEqual(rules(rec([],[fs_(2,'chronicle:p/x'),fs_(2,'secret:other/x')])),[]));
// what-ifs
const sc=(status,chapter,warn)=>({id:'w',trigger:'The tower falls',status,chapter,warnings:(warn||[]).map(n=>({text:'w',plantIn:n}))});
t('a written what-if with no warning planted before it: a warning',()=>assert.deepStrictEqual(rules(rec([],[],[sc('written',8,[])])),['gun-unplanted:warn']));
t('a written what-if with a warning before it: fine',()=>assert.deepStrictEqual(rules(rec([],[],[sc('written',8,[3])])),[]));
t('a written what-if whose only warning comes after it: unplanted',()=>assert.deepStrictEqual(rules(rec([],[],[sc('written',8,[9])])),['gun-unplanted:warn']));
t('a written what-if with one good and one late warning: order',()=>assert.deepStrictEqual(rules(rec([],[],[sc('written',8,[3,9])])),['gun-order:warn']));
t('a dropped what-if with warnings planted: a warning',()=>assert.deepStrictEqual(rules(rec([],[],[sc('dropped',null,[2])])),['gun-loaded:warn']));
t('a dropped what-if with none planted: nothing',()=>assert.deepStrictEqual(rules(rec([],[],[sc('dropped',null,[])])),[]));
t('an idea with warnings already planted: loaded (information)',()=>assert.deepStrictEqual(rules(rec([],[],[sc('idea',null,[2])])),['gun-loaded:info']));
t('a written what-if with no chapter yet: ignored',()=>assert.deepStrictEqual(rules(rec([],[],[sc('written',null,[])])),[]));
t('an idea with nothing planted: nothing',()=>assert.deepStrictEqual(rules(rec([],[],[sc('idea',null,[])])),[]));
// shape
t('every item names its place and carries the place id',()=>{const o=run(rec([sec('a',{payoff:5})]));assert.strictEqual(o[0].placeId,'p');assert.ok(o[0].text.startsWith('Place P: '))});
t('several places at once',()=>{const r2=rec([sec('b',{payoff:4})]);r2.placeId='q';const o=j(S.plantPayoff([rec([sec('a',{payoff:5})]),r2],id=>id));assert.deepStrictEqual(o.map(x=>x.placeId),['p','q'])});
t('no records, no crash',()=>{assert.deepStrictEqual(j(S.plantPayoff([])),[]);assert.deepStrictEqual(j(S.plantPayoff(null)),[])});
t('a long secret text is shortened',()=>{const o=run(rec([sec('a',{text:'x'.repeat(200),payoff:5})]));assert.ok(o[0].text.length<200)});
console.log(n+' passed');
