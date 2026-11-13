
  // ======================= helpers for the new groups =======================
  const STEN = 'Saira Stencil One, Anton, sans-serif';
  const fitSize = (txt, max, width, k) => Math.min(max, width / Math.max(1, txt.length * k));
  // squeeze a line into maxW if its estimated width is wider
  const fitLen = (txt, size, ls, maxW, k = 0.55) => (txt.length * (size * k + ls) > maxW ? `textLength="${maxW}" lengthAdjust="spacingAndGlyphs"` : '');
  // sample the pixels of a word drawn on a canvas, for particle lettering
  function textPts(txt, fam, weight, max, by, step){
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); let s = max;
    const setF = () => { g.font = `${weight} ${s}px ${fam}`; };
    setF(); while (g.measureText(txt).width > W * 0.88 && s > 16) { s -= 2; setF(); }
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(txt, W / 2, by);
    const im = g.getImageData(0, 0, W, H).data, pts = [];
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (im[(y * W + x) * 4 + 3] > 120) pts.push([x, y]);
    return pts;
  }
  const eyePath = (w, h) => `M${-w} 0 Q0 ${-h} ${w} 0 Q0 ${h} ${-w} 0Z`;

  // ======================= VOIDED =======================
  // ======================= PRIMORDIALS =======================
  // M1 · Moinera, dreamwater: the word over a still horizon, its reflection rippling in her colour
  function moinA(d){
    const r = rng('m1' + d.word), hz = 236, sz = fitSize(d.word, 110, 520, 0.5);
    const m = marble('m1m', 478, 86, 30, [BONE, d.acc, PANEL, BONE], 9, 40, true, 0.03);
    const defs = m.defs + `<filter id="m1r" x="-10%" y="-10%" width="120%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.09" numOctaves="2" seed="4">${anim(`<animate attributeName="baseFrequency" values="0.006 0.09;0.009 0.12;0.006 0.09" dur="9s" repeatCount="indefinite"/>`)}</feTurbulence><feDisplacementMap in="SourceGraphic" scale="16" xChannelSelector="R" yChannelSelector="G"/></filter>
      <linearGradient id="m1g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <mask id="m1k" maskUnits="userSpaceOnUse" x="0" y="${hz}" width="${W}" height="${H - hz}"><rect x="0" y="${hz}" width="${W}" height="${H - hz}" fill="url(#m1g)"/></mask>`;
    const word = (fill, extra = '') => `<text x="300" y="${hz - 14}" text-anchor="middle" font-family="Bodoni Moda, serif" font-style="italic" font-weight="600" font-size="${f1(sz)}" fill="${fill}" ${extra}>${esc(d.word)}</text>`;
    let b = stars(r, 70, 0.4) + m.body + `<circle cx="478" cy="86" r="30" fill="none" stroke="${BONE}" stroke-width=".6" opacity=".6"/>`;
    b += cap(300, f1(hz - 14 - sz - 14), d.title, 'middle', DUST, 9, 6);
    b += word(BONE) + `<line x1="40" y1="${hz}" x2="${W - 40}" y2="${hz}" stroke="${BONE}" stroke-width=".5" opacity=".35"/>`;
    b += `<g mask="url(#m1k)"><g filter="url(#m1r)"><g transform="translate(0 ${2 * hz}) scale(1 -1)">${word(d.acc, 'opacity=".8"')}</g><ellipse cx="478" cy="${2 * hz - 86}" rx="24" ry="7" fill="${BONE}" opacity=".3"/></g></g>`;
    for (let i = 0; i < 12; i++) {
      const x = 60 + r() * 480, y = hz - 20 - r() * 140, dur = 6 + r() * 6;
      b += `<g opacity=".8">${anim(`<animateTransform attributeName="transform" type="translate" values="0 20;0 -30" dur="${dur.toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.9;0" dur="${dur.toFixed(1)}s" repeatCount="indefinite"/>`)}${sparkle(+f1(x), +f1(y), +f1(2 + r() * 4), i % 3 ? BONE : d.acc, 0.2)}</g>`;
    }
    b += cap(14, 22, 'DREAMT BY ' + d.name.toUpperCase()) + cap(W - 14, H - 16, 'BELOW THE WATERLINE · ' + d.glyph, 'end', AMB);
    return svg(`<defs>${defs}</defs>${b}`, d.word);
  }
  // ======================= UNIVERSE =======================
  // U1 · first and last: letters blown outward from a newborn point, ringed by the oldest name
  function univA(d){
    const r = rng('u1' + d.word), cx = 300, cy = 200;
    const letters = [...(d.word + d.name.toUpperCase())];
    const ring = 'THE OLDEST  ·  THE YOUNGEST  ·  ';
    const defs = `<path id="u1o" d="${circPath(cx, cy, 182)}"/><filter id="u1b"><feGaussianBlur stdDeviation="4"/></filter><radialGradient id="u1h"><stop offset="0" stop-color="${d.acc}" stop-opacity=".6"/><stop offset=".5" stop-color="${d.acc}" stop-opacity=".12"/><stop offset="1" stop-color="${d.acc}" stop-opacity="0"/></radialGradient>`;
    let rays = '';
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2 + r() * 0.08, deg = a * 180 / Math.PI;
      rays += `<line x1="0" y1="0" x2="${f1(Math.cos(a) * 200)}" y2="${f1(Math.sin(a) * 200)}" stroke="${BONE}" stroke-width=".3" opacity=".15"/>`;
      [44, 82, 128, 176].forEach((rad, k) => {
        const rr = rad + r() * 14, ch = letters[Math.floor(r() * letters.length)];
        rays += `<text x="${f1(Math.cos(a) * rr)}" y="${f1(Math.sin(a) * rr)}" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="800" font-size="${8 + k * 5}" fill="${k === 0 || r() < 0.12 ? d.acc : BONE}" opacity="${(0.95 - k * 0.2).toFixed(2)}" transform="rotate(${f1(deg + 90)} ${f1(Math.cos(a) * rr)} ${f1(Math.sin(a) * rr)})">${esc(ch)}</text>`;
      });
    }
    let b = stars(r, 60, 0.4) + `<circle cx="${cx}" cy="${cy}" r="190" fill="url(#u1h)"/>`;
    b += `<g transform="translate(${cx} ${cy})"><g>${anim(`<animateTransform attributeName="transform" type="scale" values=".9;1.06;.9" dur="8s" repeatCount="indefinite"/>`)}${rays}</g></g>`;
    b += `<g>${anim(`<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="120s" repeatCount="indefinite"/>`)}<text font-family="Bodoni Moda, serif" font-style="italic" font-size="13" letter-spacing="4" fill="${DUST}"><textPath href="#u1o">${esc(ring.repeat(reps(ring, 2 * Math.PI * 182, 13, 0.62)))}</textPath></text></g>`;
    b += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="800" font-size="14" letter-spacing="3" fill="${d.acc}" filter="url(#u1b)">${esc(d.name.toUpperCase())}</text><text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="800" font-size="14" letter-spacing="3" fill="#fff">${esc(d.name.toUpperCase())}</text>`;
    b += cap(14, 22, 'AVATAR · THE LAST PRIMORDIAL', 'start', AMB) + cap(W - 14, 22, d.glyph, 'end', BONE, 16, 0, 'Noto Serif JP', 900) + cap(14, H - 16, 'CONCEPT OF EVERYTHING · ' + d.concept.toUpperCase());
    return svg(`<defs>${defs}</defs>${b}${grain(0.14)}`, d.word);
  }
