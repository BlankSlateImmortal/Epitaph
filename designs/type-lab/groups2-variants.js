
  // ======================= round 2 helpers =======================
  // a word knocked out of whatever sits under the mask, with a dashed outline where it was
  function knock(id, d, by, sz, seed = 7, font = 'Anton, Impact, sans-serif', weight = 400){
    const el = (extra) => `<text x="300" y="${by}" text-anchor="middle" font-family="${font}" font-weight="${weight}" font-size="${f1(sz)}" filter="url(#${id}b)" ${extra}>${esc(d.word)}</text>`;
    const defs = `<filter id="${id}b" x="-10%" y="-30%" width="120%" height="160%"><feTurbulence type="turbulence" baseFrequency="0.06" numOctaves="2" seed="${seed}" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="12" xChannelSelector="R" yChannelSelector="G"/></filter><mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${el('fill="#000"')}</mask>`;
    return { defs, mask: `mask="url(#${id}m)"`, outline: el(`fill="none" stroke="${d.acc}" stroke-width="1.4" stroke-dasharray="4 4"`) };
  }
  const label = (x, y, txt, col, anchor = 'start', w = null) => { const tw = w || txt.length * 8.6 + 20; const rx = anchor === 'end' ? x - tw : anchor === 'middle' ? x - tw / 2 : x; return `<rect x="${f1(rx)}" y="${y - 14}" width="${f1(tw)}" height="20" fill="${PANEL}"/>` + cap(f1(rx + 10), y, txt, 'start', col, 9, 3); };
  // a hand holding a pen, as a line icon. Pen tip at 0,0; the hand sits up and to the right.
  function handPen(col, acc){
    return `<g stroke-linecap="round" stroke-linejoin="round">
      <line x1="2" y1="-3" x2="74" y2="-110" stroke="${col}" stroke-width="5"/><line x1="2" y1="-3" x2="74" y2="-110" stroke="${PANEL}" stroke-width="1.6"/>
      <path d="M0 0 L-1 -11 L8 -6 Z" fill="${acc}" stroke="${acc}" stroke-width="1"/>
      <path d="M46 -64 C38 -78 44 -94 60 -98 L84 -102 C100 -104 112 -92 110 -76 L106 -52 C104 -40 92 -34 80 -36 L62 -40 C54 -42 50 -52 46 -64 Z" fill="${PANEL}" stroke="${col}" stroke-width="2.2"/>
      <path d="M48 -62 C36 -60 26 -54 24 -46 C22 -38 30 -34 38 -38 L56 -48" fill="${PANEL}" stroke="${col}" stroke-width="2.2"/>
      <path d="M58 -44 C48 -40 40 -32 42 -26 C44 -20 52 -20 58 -24 L72 -36" fill="${PANEL}" stroke="${col}" stroke-width="2.2"/>
      <path d="M50 -72 C40 -78 34 -74 32 -66" fill="none" stroke="${col}" stroke-width="2.2"/>
      <path d="M104 -88 L132 -100 L144 -62 L108 -50 Z" fill="${col}"/>
      <path d="M118 -96 L130 -60" stroke="${PANEL}" stroke-width="1.5"/></g>`;
  }
  // per-letter placement for spaced words
  const spaced = (txt, cx, gap) => [...txt].map((ch, i, a) => [ch, cx + (i - (a.length - 1) / 2) * gap]);
  const PRIMES = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53];

  // ======================= VOIDED · knockout family =======================
  // ======================= MOINERA · dreamwater family =======================
  function waterBits(id, hz, scale = 16){
    return `<filter id="${id}r" x="-10%" y="-10%" width="120%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.09" numOctaves="2" seed="4">${anim(`<animate attributeName="baseFrequency" values="0.006 0.09;0.009 0.12;0.006 0.09" dur="9s" repeatCount="indefinite"/>`)}</feTurbulence><feDisplacementMap in="SourceGraphic" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/></filter>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <mask id="${id}k" maskUnits="userSpaceOnUse" x="0" y="${hz}" width="${W}" height="${H - hz}"><rect x="0" y="${hz}" width="${W}" height="${H - hz}" fill="url(#${id}g)"/></mask>`;
  }
  const bodoniWord = (txt, x, y, sz, fill, extra = '') => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Bodoni Moda, serif" font-style="italic" font-weight="600" font-size="${f1(sz)}" fill="${fill}" ${extra}>${esc(txt)}</text>`;
  // M3 · the reflection lies: above the water the concept, below it the dreamer's own name
  function moinC(d){
    const r = rng('m3' + d.word), hz = 226, sz = fitSize(d.word, 104, 520, 0.5), nm = d.name.toUpperCase(), sz2 = fitSize(nm, 104, 520, 0.5);
    const defs = waterBits('m3', hz, 12);
    let b = stars(r, 60, 0.35) + bodoniWord(d.word, 300, hz - 14, sz, BONE) + `<line x1="40" y1="${hz}" x2="${W - 40}" y2="${hz}" stroke="${BONE}" stroke-width=".5" opacity=".35"/>`;
    b += `<g mask="url(#m3k)"><g filter="url(#m3r)"><g transform="translate(0 ${2 * hz}) scale(1 -1)">${bodoniWord(nm, 300, hz - 14, sz2, d.acc, 'opacity=".85"')}</g></g></g>`;
    b += cap(300, hz + sz2 + 30, 'THE REFLECTION REMEMBERS WHO DREAMT IT', 'middle', DIM, 8, 4);
    b += cap(14, 22, 'ABOVE · ' + d.word, 'start', DUST) + cap(W - 14, 22, 'BELOW · ' + nm, 'end', d.acc);
    return svg(`<defs>${defs}</defs>${b}`, d.word);
  }
  // M5 · rainfall: dreamwater in the rain, each drop breaking the reflection a little more
  function moinE(d){
    const r = rng('m5' + d.word), hz = 236, sz = fitSize(d.word, 110, 520, 0.5);
    const defs = waterBits('m5', hz, 26);
    let b = bodoniWord(d.word, 300, hz - 14, sz, BONE) + `<line x1="20" y1="${hz}" x2="${W - 20}" y2="${hz}" stroke="${BONE}" stroke-width=".5" opacity=".35"/>`;
    b += `<g mask="url(#m5k)"><g filter="url(#m5r)"><g transform="translate(0 ${2 * hz}) scale(1 -1)">${bodoniWord(d.word, 300, hz - 14, sz, d.acc, 'opacity=".8"')}</g></g></g>`;
    let rain = '';
    for (let i = 0; i < 70; i++) { const x = r() * W, l = 8 + r() * 18, dur = (0.7 + r() * 0.7).toFixed(2), beg = (-r() * 2).toFixed(2); rain += `<line x1="${f1(x)}" y1="0" x2="${f1(x - 2)}" y2="${f1(l)}" stroke="${r() < 0.2 ? d.acc : BONE}" stroke-width=".7" opacity="${(0.2 + r() * 0.4).toFixed(2)}">${anim(`<animateTransform attributeName="transform" type="translate" values="0 -30;-6 ${hz - l}" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>`)}</line>`; }
    for (let i = 0; i < 9; i++) { const x = 40 + r() * 520, y = hz + 8 + r() * 120, dur = (2 + r() * 2).toFixed(1), beg = (-r() * 3).toFixed(1); rain += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="2" ry=".6" fill="none" stroke="${BONE}" stroke-width=".7">${anim(`<animate attributeName="rx" values="2;40" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/><animate attributeName="ry" values=".6;8" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>`)}</ellipse>`; }
    b = rain + b + cap(14, 22, 'DREAMT BY ' + d.name.toUpperCase()) + cap(W - 14, H - 16, 'RAIN ON THE WATERLINE · ' + d.glyph, 'end', AMB);
    return svg(`<defs>${defs}</defs>${b}`, d.word);
  }

  // ======================= ANTHOLONIOUS · the writing hand =======================
  // ======================= SILS · silence family =======================
  // per-letter fades on prime-length cycles, so the pattern never visibly repeats
  function fadeLetters(id, d, cy, gap, size, r, font = 'Syncopate, sans-serif'){
    let out = '';
    spaced(d.word, 300, gap).forEach(([ch, x], i) => {
      const p = PRIMES[(i * 5 + d.word.length) % PRIMES.length], a = 0.15 + r() * 0.5, beg = (-r() * p).toFixed(1);
      const t = (extra) => `<text x="${f1(x)}" y="${cy}" text-anchor="middle" font-family="${font}" font-size="${size}" ${extra}>${esc(ch)}</text>`;
      out += `<g>${anim(`<animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;${f1(a)};${f1(a + 0.12)};${f1(a + 0.4)};1" dur="${p}s" begin="${beg}s" repeatCount="indefinite"/>`)}${t(`fill="${BONE}"`)}</g>`;
      out += `<g opacity="0">${anim(`<animate attributeName="opacity" values="0;0;.9;.9;0" keyTimes="0;${f1(a)};${f1(a + 0.12)};${f1(a + 0.3)};1" dur="${p}s" begin="${beg}s" repeatCount="indefinite"/>`)}${t(`fill="url(#${id}d)"`)}</g>`;
    });
    return out;
  }
  const dotPat = (id, col, r = 0.9, s = 4) => `<pattern id="${id}d" width="${s}" height="${s}" patternUnits="userSpaceOnUse"><circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="${col}"/></pattern>`;
  // ======================= UNIVERSE · expanding and contracting =======================
  // ======================= STORYBORN · one more per family =======================
  // 8D · binary: two worlds locked in orbit, one carrying the word and one the name
  function orbitD(d){
    const r = rng('o8d' + d.word);
    const shade = (id, c) => `<radialGradient id="${id}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="${c}"/><stop offset=".6" stop-color="#1a130b"/><stop offset="1" stop-color="#050403"/></radialGradient>`;
    let defs = shade('o8d-a', '#8a8278') + shade('o8d-b', d.acc);
    const A = planetRings(d, 'o8dA', 210, 196, 74, -10, [{ rx: 150, ry: 38, text: d.word + ' · ', size: 18, weight: 800, dur: 34 }], `<circle cx="210" cy="196" r="74" fill="url(#o8d-a)"/>`);
    const B = planetRings(d, 'o8dB', 452, 150, 34, 18, [{ rx: 78, ry: 20, text: d.name.toUpperCase() + ' · ', size: 10, weight: 700, dur: 22, dir: -1, col: d.acc }], `<circle cx="452" cy="150" r="34" fill="url(#o8d-b)"/>`);
    defs += A.defs + B.defs;
    let bridge = ''; for (let i = 0; i < 40; i++) { const t = r(), x = 284 + t * 136, y = 190 - t * 36 + (r() - 0.5) * 10; bridge += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(0.5 + r())}" fill="${BONE}" opacity="${(0.2 + r() * 0.5).toFixed(2)}"/>`; }
    const body = stars(r, 80, 0.45) + `<ellipse cx="300" cy="180" rx="230" ry="90" transform="rotate(-10 300 180)" fill="none" stroke="${BONE}" stroke-width=".4" stroke-dasharray="2 6" opacity=".35"/>` + bridge + A.body + B.body +
      cap(14, H - 16, 'BINARY · ' + (d.titles[0] || d.concept).toUpperCase(), 'start', AMB) + cap(W - 14, H - 16, d.glyph, 'end', BONE, 14, 0, 'Noto Serif JP', 900);
    return svg(`<defs>${defs}</defs>${body}${grain(0.12)}`, d.word);
  }
  // 7D · helix: the word and the name twisted into a double strand, as if written into them from birth
  function coilD(d){
    const cy = 196, A = 70, k = (Math.PI * 2) / 260;
    let defs = '', body = '';
    const strand = (ph) => { let p = ''; for (let x = -20; x <= W + 20; x += 6) p += (x > -20 ? 'L' : 'M') + x + ' ' + f1(cy + A * Math.sin(k * x + ph)); return p; };
    defs += `<path id="c7d-a" d="${strand(0)}"/><path id="c7d-b" d="${strand(Math.PI)}"/>`;
    for (let x = 0; x <= W; x += 13) { const y1 = cy + A * Math.sin(k * x), y2 = cy + A * Math.sin(k * x + Math.PI), depth = Math.cos(k * x); body += `<line x1="${x}" y1="${f1(y1)}" x2="${x}" y2="${f1(y2)}" stroke="${Math.abs(depth) < 0.2 ? d.acc : BONE}" stroke-width=".8" opacity="${(0.12 + Math.abs(depth) * 0.3).toFixed(2)}"/>`; }
    const tA = d.word + ' · ', tB = d.name.toUpperCase() + ' · ' + (d.titles[0] || d.concept).toUpperCase() + ' · ';
    const strandText = (id, t, col, sz, dir) => `<text font-family="Unbounded, Noto Serif JP" font-weight="800" font-size="${sz}" fill="${col}" dy="${sz * 0.35}"><textPath href="#${id}">${esc(t.repeat(14))}${anim(`<animate attributeName="startOffset" from="${dir > 0 ? '0' : '-260'}" to="${dir > 0 ? '-260' : '0'}" dur="24s" repeatCount="indefinite"/>`)}</textPath></text>`;
    body += strandText('c7d-b', tB, DUST, 12, -1) + strandText('c7d-a', tA, BONE, 20, 1);
    body += cap(14, 22, 'STRAND · ' + d.glyph, 'start', AMB) + cap(W - 14, 22, 'SPOKEN, NOT BORN', 'end');
    return svg(`<defs>${defs}</defs>${body}${grain(0.12)}`, d.word);
  }
