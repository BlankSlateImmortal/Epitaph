// First-load check on a slow phone (docs/plans/publish-readonly.md 5.6): Slow 4G, 4x slower CPU, 390px, gzipped like GitHub Pages.
// Usage: node tools/visitor-test/perf.js [page ...]   (default: the five public pages). Prints KB, request count, load time, biggest files.
// Budget: fails (exit 1) if a page's load event takes longer than 8 s.
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os'),zlib=require('zlib'),{spawn}=require('child_process');
const ROOT=path.resolve(__dirname,'../..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.webm':'video/webm','.mp4':'video/mp4','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{const p=decodeURIComponent(new URL(q.url,'http://x').pathname);const f=path.join(ROOT,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}
 const ext=path.extname(f),buf=fs.readFileSync(f),txt=/html|js|css|json|svg/.test(ext);r.writeHead(200,{'content-type':T[ext]||'application/octet-stream',...(txt?{'content-encoding':'gzip'}:{})});r.end(txt?zlib.gzipSync(buf):buf)});
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pf-'));
const pr=spawn('chromium',['--headless=new','--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--user-data-dir='+dir,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
let ws;for(let i=0;i<100;i++){const f=dir+'/DevToolsActivePort';if(fs.existsSync(f)){const[a,b]=fs.readFileSync(f,'utf8').split('\n');if(b){ws=`ws://127.0.0.1:${a}${b}`;break}}await new Promise(r=>setTimeout(r,100))}
const w=new WebSocket(ws);let id=0;const calls={},subs=[];w.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&calls[d.id]){d.error?calls[d.id].bad(d.error):calls[d.id].ok(d.result);delete calls[d.id]}else subs.forEach(f=>f(d))};await new Promise(r=>w.onopen=r);
const send=(method,params={},sessionId)=>new Promise((ok,bad)=>{const i=++id;calls[i]={ok,bad};w.send(JSON.stringify({id:i,method,params,sessionId}))});
const PAGES=process.argv.length>2?process.argv.slice(2):['index.html?author=0','dossier.html?author=0','read.html?author=0','powers.html?author=0','atlas-3d.html?author=0'];let slow=0;
for(const page of PAGES){const{browserContextId}=await send('Target.createBrowserContext');const{targetId}=await send('Target.createTarget',{url:'about:blank',browserContextId});const{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});const s=(m,p)=>send(m,p,sessionId);
 const reqs={};let bytes=0,t0=0,loadAt=0;subs.push(d=>{if(d.sessionId!==sessionId)return;if(d.method==='Network.requestWillBeSent')reqs[d.params.requestId]={url:d.params.request.url};if(d.method==='Network.loadingFinished'&&reqs[d.params.requestId]){reqs[d.params.requestId].b=d.params.encodedDataLength;bytes+=d.params.encodedDataLength}if(d.method==='Page.loadEventFired')loadAt=Date.now()-t0});
 await s('Network.enable');await s('Page.enable');await s('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await s('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8});await s('Emulation.setCPUThrottlingRate',{rate:4});
 t0=Date.now();await s('Page.navigate',{url:`http://127.0.0.1:${port}/${page}`});await new Promise(r=>setTimeout(r,20000));
 const top=Object.values(reqs).filter(r=>r.b).sort((a,b)=>b.b-a.b).slice(0,5).map(r=>`${(r.b/1024).toFixed(0)}KB ${r.url.replace(/^http:\/\/127[^/]*\//,'').replace(/^https?:\/\//,'').slice(0,60)}`);
 console.log(`${page}: ${(bytes/1024).toFixed(0)} KB over ${Object.values(reqs).filter(r=>r.b).length} requests, load event at ${(loadAt/1000).toFixed(1)}s (Slow 4G, 4x CPU)\n   `+top.join('\n   '));
 if(loadAt>8000){slow++;console.log('FAIL '+page+' took '+(loadAt/1000).toFixed(1)+'s')}
 await send('Target.disposeBrowserContext',{browserContextId})}
pr.kill();srv.close();process.exit(slow?1:0)})();
