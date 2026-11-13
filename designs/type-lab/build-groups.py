# Builds orbit-type.html: type-lab.html shell + orbit-variants.js + groups-variants.js + groups-opts.js,
# with grouped sections (Storyborn / Voided / Primordials / Universe) and fixed-subject options.
def rep(s, a, b):
    assert a in s, a[:60]
    return s.replace(a, b, 1)
v=open('orbit-variants.js').read()+open('groups-variants.js').read()+open('groups2-variants.js').read()+open('groups3-variants.js').read()+open('groups4-variants.js').read()+open('groups5-variants.js').read()
s=open('type-lab.html').read()
a=s.index('  // ---------- shared ----------'); h=s.index('  const OPTS = ['); end=s.index('  ];\n',h)+5
s=s[:a]+v+'\n'+open('groups-opts.js').read()+s[end:]
s=rep(s,'<title>Epitaph Type Lab</title>','<title>Epitaph Orbit Type</title>')
s=rep(s,'EPITAPH // DOSSIER · TYPE LAB','EPITAPH // DOSSIER · TYPE LAB · RACES')
s=rep(s,'<h1>Ten treatments from your refs</h1>','<h1>Storyborn, Voided, Primordials</h1>')
i=s.index('<p class="lede">'); j=s.index('</p>',i)+4
s=s[:i]+'<p class="lede">Typography in the Dossier hero, grouped by who it belongs to. Options marked NEW are from this round. The Storyborn and Voided options are built only from a character\'s name, concept, kanji, titles and accent, so the subject buttons change them. The Primordial and Universe options are one-offs and always show their own character.</p>'+s[j:]
s=rep(s,'&family=Unbounded','&family=Pirata+One&family=Unbounded')
s=rep(s,'</style>','.grp{display:grid;gap:8px;border-top:2px solid var(--amber);padding-top:18px}\n.grp h2{font-family:var(--f-display);font-weight:400;font-size:clamp(38px,6vw,64px);line-height:.95;margin:0;text-wrap:balance}\n.grp p{margin:0;color:var(--dust);max-width:68ch}\n</style>')
s=rep(s,"  const ORDER = ['sils','moinera','universe','antholonious','own'];",
"""  Object.assign(CHARS, {
    orin: { name:'Orin', concept:'Ruin', glyph:'封', titles:['The Untitled Calamity','Forsaken'], acc:'#c0563a', blurb:'Born in a Storyborn settlement, with a seal branded on his flesh.', no:'006' },
    nera: { name:'Nera', concept:'Conquest', glyph:'征', titles:['Leader of the Voided'], acc:'#7fb0a4', blurb:'Left the Storyborn and came to lead the Voided.', no:'007' }
  });
  const GROUPS = {
    storyborn: { eyebrow:'GROUP 1 · 9 OPTIONS', title:'Storyborn', text:'Spoken into existence, with their lives written on their bodies. Words circle them like a life written around them: the orbit-ref shortlist plus Binary and Helix.' },
    voided: { eyebrow:'GROUP 2 · 5 OPTIONS', title:'Voided', text:'Survivors of Era 0, changed by the energy in the air of the new world. The opposite of the Storyborn: straight lines instead of orbits, and words worn away instead of written on. Helix, plus four scrolling walls of humanity’s record. Try them with Nera.' },
    primordial: { eyebrow:'GROUP 3 · 11 OPTIONS', title:'Primordials', text:'Moinera: Dreamwater, The Lie and Rainfall. Antholonious: the closed 3D book, staged three more ways. Sils: four black holes. These ignore the subject buttons.' },
    universe: { eyebrow:'GROUP 4 · 2 OPTIONS', title:'Universe', text:'Not a Primordial: the concept everything is built from. His avatar is the Last Primordial, so he is both the oldest and the youngest. First and Last, plus a fixed solar system whose worlds turn in place.' }
  };
  const ORDER = ['orin','nera','sils','moinera','universe','antholonious','own'];""")
s=rep(s,"const st = { char:'universe', word:'concept' };","const st = { char:'nera', word:'concept' };")
s=rep(s,"function data(){","function data(key){\n    key = key || st.char;")
s=rep(s,"if (st.char === 'own') {","if (key === 'own') {")
s=rep(s,"} else d = CHARS[st.char];","} else d = CHARS[key];")
s=rep(s,"const sec = document.createElement('section'); sec.className = 'opt';",
"if (o.group !== (OPTS[i - 1] || {}).group) { const G = GROUPS[o.group], g = document.createElement('div'); g.className = 'grp'; g.innerHTML = `<div class=\"eyebrow\">${G.eyebrow}</div><h2>${G.title}</h2><p>${G.text}</p>`; host.appendChild(g); }\n    const sec = document.createElement('section'); sec.className = 'opt'; sec.id = 'sec' + i;")
a=s.index("    document.querySelectorAll('[data-r]')")
old="    OPTS.forEach((o, i) => { const el = document.getElementById('slot' + i); el.innerHTML = o.fn(d, el.clientWidth || 600); });"
b=s.index(old)+len(old)
s=s[:a]+"""    OPTS.forEach((o, i) => {
      const dd = o.fixed ? data(o.fixed) : d, sec = document.getElementById('sec' + i);
      sec.style.setProperty('--acc', dd.acc);
      sec.querySelectorAll('[data-r]').forEach((el) => {
        const k = el.dataset.r;
        el.textContent = k === 'no' ? 'EPITAPH / ' + dd.no : k === 'glyph' ? dd.glyph : k === 'name' ? dd.name.toUpperCase() : ((dd.titles[0] || '') + ' · CH 1').toUpperCase();
      });
      const el = document.getElementById('slot' + i);
      try { el.innerHTML = o.fn(dd, el.clientWidth || 600); } catch (err) { el.innerHTML = '<p style="padding:16px;color:var(--amber)">This option failed to draw.</p>'; console.error(o.key, err); }
    });"""+s[b:]
s=rep(s,'<div class="opt-head"><span class="key">${o.key}</span><h2>${o.name}</h2>','<div class="opt-head"><span class="key">${o.key}</span><h2>${o.name}</h2>${o.saved ? \'<span class="badge">SAVED</span>\' : o.progress ? \'<span class="badge wip">IN PROGRESS</span>\' : \'\'}')
s=rep(s,'</style>', """.badge{font-family:var(--f-crt);font-size:17px;letter-spacing:.12em;color:var(--ink);background:var(--bone);padding:0 7px;line-height:1.3}
.badge.wip{background:transparent;color:var(--amber);outline:1px dashed var(--amber)}
.tabs{display:flex;flex-wrap:wrap;gap:10px;margin:4px 0 6px}
.tab{font-family:var(--f-display);font-size:20px;letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--amber);background:transparent;color:var(--amber);padding:6px 18px;cursor:pointer;clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%)}
.tab[aria-selected="true"]{background:var(--amber);color:var(--ink)}
.tab:focus-visible{outline:2px solid var(--amber-hi);outline-offset:3px}
.slot video,.slot img.poster{width:100%;height:100%;object-fit:contain;display:block}
.render-meta{font-size:12px;color:var(--amber-dim);margin:0;letter-spacing:.06em}
</style>""")
s=rep(s,'    <div class="controls">','    <div class="tabs" role="tablist" aria-label="Version"><button class="tab" role="tab" id="tab-drawn" data-tab="drawn" aria-selected="true">Drawn</button><button class="tab" role="tab" id="tab-blender" data-tab="blender" aria-selected="false">Blender 3D</button></div>\n    <div class="controls" id="drawnControls">')
s=rep(s,'  <div id="opts" style="display:grid;gap:52px"></div>','  <div id="opts" style="display:grid;gap:52px"></div>\n  <div id="blend" style="display:grid;gap:52px" hidden></div>')
s=rep(s,"  document.getElementById('own').addEventListener('input', render);", """  document.getElementById('own').addEventListener('input', render);
  // ---- Blender tab: rendered loops for the set characters ----
  const RENDERS = [
    { key:'R1', char:'antholonious', file:'book-antholonious', name:'Antholonious · The closed book', note:'<b>The book, built and lit in Blender:</b> leather boards with a grain, a rounded spine with raised gilt bands and the kanji, a ruled page block, tooled gold on the cover (frames, corner diamonds, the palm-eye sunburst, his concept and name), a clasp and a satin ribbon. It sways and floats.' },
    { key:'R2', char:'universe', file:'universe-universe', name:'Universe · System', note:'<b>The system, in 3D, with no text:</b> an eclipsed core with a corona, and five worlds slowly travelling their orbit rings (one lap every 20 seconds, all at the same pace so they never meet) while each turns on its own axis. Sils is a cratered moon, Moinera marbled, Antholonious a ringed gas giant, Orin a hot core with two rings, Nera a binary pair.' },
    { key:'R3', char:'sils', file:'blackhole-sils', name:'Sils · Black hole', note:'<b>A black hole with a real horizon and photon ring.</b> The accretion disk is a shader: inner gas laps the outer, the side coming toward you is brighter, and the far side of the disk is bent up over the top and under the bottom. No text: just the hole, its photon ring and the swirling disk.' },
    { key:'R4', char:'moinera', file:'slime-moinera', name:'Moinera · Slime', progress:true, note:'<b>A living slime:</b> blobs that merge and split as they drift, so the mass never holds one shape. Glossy and translucent, glowing faintly from inside, with a marble of her colour, bone and ink moving through it. Droplets pull away and fall back in.' }
  ];
  const READY = __READY__;
  const bhost = document.getElementById('blend');
  bhost.innerHTML = '<p class="lede" style="margin:0">Rendered in Blender for the set characters only, regenerated from their data whenever they change. Everyone else keeps the drawn options. These are video loops, so they ignore the subject buttons.</p>';
  RENDERS.forEach((x) => {
    const dd = data(x.char), sec = document.createElement('section'); sec.className = 'opt'; sec.style.setProperty('--acc', dd.acc);
    sec.innerHTML = `<div class="opt-head"><span class="key">${x.key}</span><h2>${x.name}</h2>${x.progress ? '<span class="badge wip">IN PROGRESS</span>' : '<span class="badge wip">NEW</span>'}<span class="ref">Blender · EEVEE</span></div>
      <div class="hero"><div class="rail"><span class="v">EPITAPH / ${dd.no}</span><span class="jp">${esc(dd.glyph)}</span><span class="v">ERA —</span></div>
        <div class="poster"><div class="meta"><span>LOCATION <b>UNPLACED</b></span><span>LUNAR AGE <b>2</b></span></div>
          <div class="slot">${READY.includes(x.file) ? `<video autoplay muted loop playsinline preload="metadata" poster="renders/${x.file}.jpg" aria-label="${esc(x.name)}"><source src="renders/${x.file}.webm" type="video/webm"><source src="renders/${x.file}.mp4" type="video/mp4"></video>` : '<p class="render-meta" style="position:absolute;inset:0;display:grid;place-items:center;font-size:16px">RENDERING · CHECK BACK SOON</p>'}</div>
          <div class="nameblock"><span class="tag">UNASSIGNED</span><h3>${esc(dd.name.toUpperCase())}</h3><p>${esc(((dd.titles[0] || '') + ' · CH 1').toUpperCase())}</p></div></div></div>
      <p class="note">${x.note}</p>`;
    bhost.appendChild(sec);
  });
  if (reduce) bhost.querySelectorAll('video').forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });
  function showTab(t){
    const b = t === 'blender';
    document.getElementById('opts').hidden = b; bhost.hidden = !b;
    document.getElementById('drawnControls').hidden = b;
    document.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === (b ? 'blender' : 'drawn'))));
    bhost.querySelectorAll('video').forEach((v) => { if (b && !reduce) { const p = v.play(); if (p) p.catch(() => {}); } else v.pause(); });
  }
  document.querySelectorAll('.tab').forEach((x) => x.addEventListener('click', () => { const t = x.dataset.tab; try { history.replaceState(null, '', t === 'blender' ? '#blender' : '#drawn'); } catch (e) {} showTab(t); }));
  addEventListener('hashchange', () => showTab(location.hash === '#blender' ? 'blender' : 'drawn'));
  showTab(location.hash === '#blender' ? 'blender' : 'drawn');""")
import os, json
ready=sorted(f[:-5] for f in os.listdir('renders') if f.endswith('.webm') and os.path.exists('renders/'+f[:-5]+'.mp4') and os.path.exists('renders/'+f[:-5]+'.jpg')) if os.path.isdir('renders') else []
s=s.replace('__READY__', json.dumps(ready))
open('orbit-type.html','w').write(s)
