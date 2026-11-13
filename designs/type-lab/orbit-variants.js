  // ---------- shared ----------
  const BONE = '#f1e6cf', DIM = '#8a5a14', DUST = '#b5904f', AMB = '#ffb238', PANEL = '#0e0a05';
  const anim = (s) => reduce ? '' : s;
  const f1 = (n) => (+n).toFixed(1);
  // ellipse path, left → bottom → right → top, so text along the bottom reads upright
  const ellPath = (cx, cy, rx, ry) => `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;
  const circPath = (cx, cy, r) => ellPath(cx, cy, r, r);
  const reps = (txt, len, size, k = 0.62) => Math.max(2, Math.ceil(len / Math.max(1, txt.length * size * k)) + 1);
  function stars(r, n, op = 0.6){ let s = ''; for (let i = 0; i < n; i++) s += `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(0.4 + r() * 1.1).toFixed(1)}" fill="${BONE}" opacity="${(0.12 + r() * op).toFixed(2)}"/>`; return s; }
  function sparkle(x, y, s, col, thin = 0.12){ return `<path d="M${x} ${y - s} Q${x + s * thin} ${y - s * thin} ${x + s} ${y} Q${x + s * thin} ${y + s * thin} ${x} ${y + s} Q${x - s * thin} ${y + s * thin} ${x - s} ${y} Q${x - s * thin} ${y - s * thin} ${x} ${y - s}Z" fill="${col}"/>`; }
  function grainStar(r, cx, cy, rad, n, col = BONE){
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, k = Math.pow(r(), 2.4), spike = Math.pow(Math.abs(Math.cos(2 * a)), 8);
      const rr = k * rad * (0.45 + spike * 1.6);
      s += `<circle cx="${f1(cx + Math.cos(a) * rr)}" cy="${f1(cy + Math.sin(a) * rr)}" r="${f1(0.4 + r() * 0.8)}" fill="${col}" opacity="${(0.25 + r() * 0.75).toFixed(2)}"/>`;
    }
    return s;
  }
  let grainN = 0;
  const grain = (op = 0.22) => { const id = 'gr' + (grainN++); return `<defs><radialGradient id="${id}-g" cx=".5" cy=".5" r=".55"><stop offset=".45" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#${id}-g)"/></mask></defs><g mask="url(#${id})" pointer-events="none"><rect width="${W}" height="${H}" fill="#000" opacity="${op}" filter="url(#grit)"/></g>`; };

  /* Text riding an orbit. The orbit lives in its own rotated frame; a mask fades the far ends,
     and `part` draws only the back half (above the centre line) or the front half. */
  function orbitText(o){
    const { id, cx, cy, rx, ry, rot = 0, text, font = 'Unbounded', weight = 700, size = 16, col = BONE, ls = 1, dur = 40, dir = 1, fade = 0.18, part = 'all', italic = false, op = 1 } = o;
    const len = Math.PI * (rx + ry);
    let defs = `<path id="${id}" d="${ellPath(cx, cy, rx, ry)}"/>`;
    defs += `<linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="${cx - rx - size}" y1="0" x2="${cx + rx + size}" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="${fade}"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="${fade}"/></linearGradient>`;
    defs += `<mask id="${id}-m" maskUnits="userSpaceOnUse" x="${cx - rx - 80}" y="${cy - ry - 80}" width="${2 * rx + 160}" height="${2 * ry + 160}"><rect x="${cx - rx - 80}" y="${cy - ry - 80}" width="${2 * rx + 160}" height="${2 * ry + 160}" fill="url(#${id}-g)"/></mask>`;
    if (part !== 'all') defs += `<clipPath id="${id}-c"><rect x="${cx - rx - 80}" y="${part === 'front' ? cy : cy - ry - 80}" width="${2 * rx + 160}" height="${ry + 80}"/></clipPath>`;
    const t = `<text font-family="${font}, Noto Serif JP" font-weight="${weight}" ${italic ? 'font-style="italic"' : ''} font-size="${size}" letter-spacing="${ls}" fill="${col}"><textPath href="#${id}">${esc(text.repeat(reps(text, len, size)))}${anim(`<animate attributeName="startOffset" from="${dir > 0 ? '0%' : '-50%'}" to="${dir > 0 ? '-50%' : '0%'}" dur="${dur}s" repeatCount="indefinite"/>`)}</textPath></text>`;
    const body = `<g transform="rotate(${rot} ${cx} ${cy})" opacity="${op}"><g mask="url(#${id}-m)" ${part !== 'all' ? `clip-path="url(#${id}-c)"` : ''}>${t}</g></g>`;
    return { defs, body };
  }
  /* The marble effect: bands of colour pushed around by turbulence, clipped to a shape. */
  function marble(id, cx, cy, r, cols, seed, scale = 70, rings = false, freq = 0.02){
    const rr = rng(id + seed);
    let st = '';
    if (rings) { for (let k = 0, rad = r * 1.5; rad > 2; k++) { st += `<circle cx="${cx}" cy="${cy}" r="${f1(rad)}" fill="${cols[k % cols.length]}"/>`; rad -= 5 + rr() * 9; } }
    else { for (let y = cy - r - 40, k = 0; y < cy + r + 40; k++) { const h = 5 + rr() * 12; st += `<rect x="${cx - r - 40}" y="${f1(y)}" width="${2 * r + 80}" height="${f1(h)}" fill="${cols[k % cols.length]}"/>`; y += h; } }
    const defs = `<filter id="${id}-f" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="${seed}">${anim(`<animate attributeName="baseFrequency" values="${freq};${(freq * 1.2).toFixed(4)};${freq}" dur="${16 + seed % 6}s" repeatCount="indefinite"/>`)}</feTurbulence><feDisplacementMap in="SourceGraphic" scale="${scale}" xChannelSelector="R" yChannelSelector="B"/></filter><clipPath id="${id}-c"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`;
    return { defs, body: `<g clip-path="url(#${id}-c)"><g filter="url(#${id}-f)">${st}</g></g>` };
  }
  const cap = (x, y, txt, anchor = 'start', col = DUST, size = 9, ls = 3, font = 'Space Mono, Noto Serif JP', weight = 400) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${font}" font-weight="${weight}" font-size="${size}" letter-spacing="${ls}" fill="${col}">${esc(txt)}</text>`;

  // ======================= t9 · GYRE =======================
  // 9A · the ref, done properly: three tilted orbits that fade at their far ends, a grain star with long flares
  function gyreA(d){
    const r = rng('g9a' + d.word), cx = 300, cy = 200;
    const lines = [d.word + '  ·  ', (d.titles[0] || d.concept).toUpperCase() + '  ·  ', d.name.toUpperCase() + '  ·  '];
    const orbs = [[250, 62, -10, 15, 46], [218, 56, 56, 14, 58], [206, 50, -62, 13, 52]];
    let defs = `<radialGradient id="g9a-h"><stop offset="0" stop-color="${d.acc}" stop-opacity=".55"/><stop offset="1" stop-color="${d.acc}" stop-opacity="0"/></radialGradient>`, body = stars(r, 90, 0.5);
    body += `<circle cx="${cx}" cy="${cy}" r="120" fill="url(#g9a-h)"/>`;
    orbs.forEach(([rx, ry, rot, size, dur], i) => {
      const o = orbitText({ id: 'g9a' + i, cx, cy, rx, ry, rot, text: lines[i], size, weight: i ? 500 : 700, dur, dir: i === 1 ? -1 : 1, fade: 0.05 });
      defs += o.defs; body += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="none" stroke="${BONE}" stroke-width=".4" opacity=".18"/>` + o.body;
    });
    body += grainStar(r, cx, cy, 120, 900);
    body += `<g opacity=".9">${sparkle(cx, cy, 70, BONE, 0.05)}</g>${sparkle(cx, cy, 26, '#fff', 0.16)}`;
    body += cap(10, 22, 'WRITTEN IN THE ' + d.concept.toUpperCase()) + cap(W - 10, 22, d.glyph + ' · ' + d.no, 'end');
    return svg(`<defs>${defs}</defs>${body}${grain(0.18)}`, d.word);
  }
  // 9B · an atom with a marbled core: orbits carry the text, a spark rides each orbit
  function gyreB(d){
    const r = rng('g9b' + d.word), cx = 300, cy = 200;
    const lines = [d.word + ' — ', d.name.toUpperCase() + ' — ', (d.titles[0] || d.concept).toUpperCase() + ' — '];
    const orbs = [[240, 70, 0, 15, 50], [240, 70, 60, 14, 60], [240, 70, -60, 14, 55]];
    const m = marble('g9b-m', cx, cy, 58, [d.acc, PANEL, BONE, PANEL], 7, 60, false, 0.024);
    let defs = m.defs + `<radialGradient id="g9b-h"><stop offset=".55" stop-color="${d.acc}" stop-opacity=".5"/><stop offset="1" stop-color="${d.acc}" stop-opacity="0"/></radialGradient>`, back = '', front = '';
    orbs.forEach(([rx, ry, rot, size, dur], i) => {
      const ob = orbitText({ id: 'g9b' + i + 'b', cx, cy, rx, ry, rot, text: lines[i], size, weight: 600, dur, dir: i % 2 ? -1 : 1, part: 'back', op: 0.45 });
      const of = orbitText({ id: 'g9b' + i + 'f', cx, cy, rx, ry, rot, text: lines[i], size, weight: 700, dur, dir: i % 2 ? -1 : 1, part: 'front' });
      defs += ob.defs + of.defs + `<path id="g9b-mp${i}" d="${ellPath(cx, cy, rx, ry)}"/>`;
      back += ob.body; front += of.body;
      front += `<g transform="rotate(${rot} ${cx} ${cy})"><circle r="4" fill="${i ? BONE : d.acc}">${anim(`<animateMotion dur="${8 + i * 3}s" repeatCount="indefinite" rotate="auto"><mpath href="#g9b-mp${i}"/></animateMotion>`)}</circle></g>`;
    });
    let body = stars(r, 70, 0.4) + back + `<circle cx="${cx}" cy="${cy}" r="86" fill="url(#g9b-h)"/>` + m.body + `<circle cx="${cx}" cy="${cy}" r="58" fill="none" stroke="${BONE}" stroke-width="1.5"/>` + front;
    body += cap(10, 22, 'NUCLEUS: ' + d.concept.toUpperCase()) + cap(W - 10, 22, d.glyph, 'end', BONE, 16, 0, 'Noto Serif JP', 900);
    return svg(`<defs>${defs}</defs>${body}`, d.word);
  }
  // 9C · astrolabe: graduated rings, serif orbits, labelled axes
  function gyreC(d){
    const cx = 300, cy = 205, r = rng('g9c' + d.word);
    let defs = '', body = '';
    [176, 150, 96].forEach((rad, i) => body += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${i === 1 ? AMB : BONE}" stroke-width="${i === 1 ? 1 : 0.5}" opacity="${i === 1 ? 0.6 : 0.3}"/>`);
    for (let a = 0; a < 360; a += 5) {
      const t = (a % 30 === 0) ? 10 : 4, rad = 176, x1 = cx + Math.cos(a * Math.PI / 180) * rad, y1 = cy + Math.sin(a * Math.PI / 180) * rad;
      body += `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(cx + Math.cos(a * Math.PI / 180) * (rad - t))}" y2="${f1(cy + Math.sin(a * Math.PI / 180) * (rad - t))}" stroke="${BONE}" stroke-width=".7" opacity=".6"/>`;
      if (a % 30 === 0) body += cap(f1(cx + Math.cos(a * Math.PI / 180) * 190), f1(cy + Math.sin(a * Math.PI / 180) * 190 + 3), String(a).padStart(3, '0'), 'middle', DIM, 8, 1);
    }
    const lines = [d.word + '  ✦  ', (d.titles[0] || d.concept) + '  ✦  ', d.name + '  ✦  '];
    [[168, 54, -18, 'Bodoni Moda', 15], [160, 50, 42, 'Bodoni Moda', 13], [152, 46, 102, 'Bodoni Moda', 13]].forEach(([rx, ry, rot, font, size], i) => {
      const o = orbitText({ id: 'g9c' + i, cx, cy, rx, ry, rot, text: lines[i].toUpperCase(), font, weight: i ? 400 : 600, italic: i === 1, size, ls: 3, dur: 50 + i * 10, dir: i % 2 ? -1 : 1, fade: 0.04 });
      defs += o.defs; body += o.body;
    });
    body += grainStar(r, cx, cy, 60, 380, BONE) + sparkle(cx, cy, 30, d.acc, 0.1) + sparkle(cx, cy, 12, '#fff', 0.2);
    body += `<text x="${cx}" y="${cy - 186}" text-anchor="middle" font-family="Noto Serif JP" font-weight="900" font-size="18" fill="${BONE}">${esc(d.glyph)}</text>`;
    ['I', 'II', 'III'].forEach((k, i) => body += cap(14, 300 + i * 16, `AXIS ${k} · ${[d.concept, d.titles[0] || '—', d.name][i].toUpperCase()}`, 'start', i ? DIM : AMB, 8, 2));
    body += cap(W - 14, 300, 'EPOCH CH 1', 'end', DIM, 8, 2) + cap(W - 14, 316, 'FILE ' + d.no, 'end', DIM, 8, 2);
    return svg(`<defs>${defs}</defs>${body}`, d.word);
  }

  // ======================= t8 · ORBIT =======================
  function planetRings(d, id, cx, cy, R, tilt, rings, sphere){
    // rings: [{rx, ry, text, size, weight, font, op, dur, dir}]; sphere: svg drawn between back and front
    let defs = '', back = '', front = '';
    rings.forEach((g, i) => {
      const ob = orbitText(Object.assign({ id: id + i + 'b', cx, cy, rot: tilt, part: 'back', fade: 0.3 }, g, { op: (g.op || 1) * 0.55 }));
      const of = orbitText(Object.assign({ id: id + i + 'f', cx, cy, rot: tilt, part: 'front', fade: 0.3 }, g));
      defs += ob.defs + of.defs; back += ob.body; front += of.body;
    });
    return { defs, body: back + sphere + front };
  }
  // 8A · Cassini, refined: lit sphere, heavy ring + fine ring, mission-data strip
  function orbitA(d){
    const cx = 300, cy = 178, R = 84, r = rng('o8a' + d.word);
    let defs = `<radialGradient id="o8a-s" cx=".64" cy=".3" r=".85"><stop offset="0" stop-color="#9a948a"/><stop offset=".3" stop-color="#46413a"/><stop offset=".75" stop-color="#14120f"/><stop offset="1" stop-color="#070605"/></radialGradient>
      <radialGradient id="o8a-r" cx=".5" cy=".5" r=".5"><stop offset=".82" stop-color="${d.acc}" stop-opacity="0"/><stop offset=".97" stop-color="${d.acc}" stop-opacity=".55"/><stop offset="1" stop-color="${d.acc}" stop-opacity="0"/></radialGradient>`;
    const sphere = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#o8a-s)"/><circle cx="${cx}" cy="${cy}" r="${R + 6}" fill="url(#o8a-r)"/>`;
    const p = planetRings(d, 'o8a', cx, cy + 22, R, -6, [
      { rx: 206, ry: 58, text: `${d.name.toUpperCase()} — ${d.word} — `, size: 25, weight: 800, dur: 44 },
      { rx: 262, ry: 80, text: ((d.blurb || d.concept) + ' · ' + d.titles.join(' · ') + ' · '), size: 10.5, weight: 400, font: 'Space Mono, Noto Serif JP', ls: 1.5, dur: 80, dir: -1, op: 0.8 }
    ], sphere);
    defs += p.defs;
    let body = stars(r, 60, 0.35) + p.body;
    body += `<line x1="14" y1="338" x2="${W - 14}" y2="338" stroke="${BONE}" stroke-width=".5" opacity=".3"/>`;
    body += cap(14, 356, 'SUBJECT DATA', 'start', BONE, 9, 1, 'Unbounded', 800) + cap(190, 356, 'Concept', 'start', DUST, 9, 1) + cap(190, 370, d.concept, 'start', BONE, 12, 0, 'Unbounded', 400) + cap(370, 356, 'Kanji · file', 'start', DUST, 9, 1) + cap(370, 370, d.glyph + ' · ' + d.no, 'start', BONE, 12, 0, 'Noto Serif JP', 500);
    return svg(`<defs>${defs}</defs>${body}${grain(0.14)}`, d.word);
  }
  // 8B · a marbled world: the marble effect as the planet's surface, its rim lit
  function orbitB(d){
    const cx = 300, cy = 190, R = 90, r = rng('o8b' + d.word);
    const m = marble('o8b-m', cx, cy, R, [BONE, PANEL, d.acc, PANEL, BONE, '#3a2d1c'], 12, 80, false, 0.016);
    let defs = m.defs + `<radialGradient id="o8b-sh" cx=".32" cy=".3" r=".9"><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>
      <radialGradient id="o8b-h"><stop offset=".6" stop-color="${d.acc}" stop-opacity=".45"/><stop offset="1" stop-color="${d.acc}" stop-opacity="0"/></radialGradient>`;
    const sphere = `<circle cx="${cx}" cy="${cy}" r="${R + 34}" fill="url(#o8b-h)"/>` + m.body + `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#o8b-sh)"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${BONE}" stroke-width="1"/>`;
    const p = planetRings(d, 'o8b', cx, cy + 10, R, -12, [
      { rx: 210, ry: 54, text: `${d.word} · ${d.glyph} · `, size: 22, weight: 800, dur: 40 },
      { rx: 250, ry: 66, text: `${d.name.toUpperCase()} — ${(d.titles[0] || d.concept).toUpperCase()} — `, size: 11, weight: 600, ls: 3, dur: 70, dir: -1, op: 0.85 }
    ], sphere);
    defs += p.defs;
    const body = stars(r, 80, 0.45) + p.body + cap(14, 22, 'SURFACE: ' + d.concept.toUpperCase()) + cap(W - 14, 22, 'FILE ' + d.no, 'end');
    return svg(`<defs>${defs}</defs>${body}`, d.word);
  }
  // 8C · eclipse: a black disc with a burning rim, a steep ring of text, the kanji in the corona
  function orbitC(d){
    const cx = 300, cy = 196, R = 86, r = rng('o8c' + d.word);
    let defs = `<radialGradient id="o8c-c" cx=".5" cy=".5" r=".5"><stop offset=".7" stop-color="${d.acc}" stop-opacity="0"/><stop offset=".78" stop-color="#fff" stop-opacity=".95"/><stop offset=".83" stop-color="${AMB}" stop-opacity=".7"/><stop offset="1" stop-color="${d.acc}" stop-opacity="0"/></radialGradient>
      <filter id="o8c-b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>`;
    let corona = '';
    for (let i = 0; i < 46; i++) { const a = r() * Math.PI * 2, l = R * (1.05 + r() * 0.5); corona += `<line x1="${f1(cx + Math.cos(a) * R)}" y1="${f1(cy + Math.sin(a) * R)}" x2="${f1(cx + Math.cos(a) * l)}" y2="${f1(cy + Math.sin(a) * l)}" stroke="${i % 3 ? AMB : d.acc}" stroke-width="${f1(0.6 + r() * 1.4)}" opacity="${(0.25 + r() * 0.5).toFixed(2)}"/>`; }
    const sphere = `<g filter="url(#o8c-b)">${corona}</g><circle cx="${cx}" cy="${cy}" r="${R * 1.22}" fill="url(#o8c-c)"/>${corona}<circle cx="${cx}" cy="${cy}" r="${R}" fill="#030201"/>` +
      `<text x="${cx + R * 0.9}" y="${cy - R * 0.92}" font-family="Noto Serif JP" font-weight="900" font-size="22" fill="${BONE}">${esc(d.glyph)}</text>`;
    const p = planetRings(d, 'o8c', cx, cy, R, -24, [
      { rx: 224, ry: 44, text: `${d.word} — ${d.name.toUpperCase()} — `, size: 20, weight: 800, dur: 36 },
      { rx: 264, ry: 56, text: `${(d.titles.join(' · ') || d.concept).toUpperCase()} · `, size: 9.5, weight: 500, ls: 4, dur: 60, dir: -1, op: 0.7 }
    ], sphere);
    defs += p.defs;
    const body = stars(r, 120, 0.55) + p.body + cap(14, H - 16, 'TOTALITY · CH 1', 'start', AMB) + cap(W - 14, H - 16, d.concept.toUpperCase(), 'end');
    return svg(`<defs>${defs}</defs>${body}${grain(0.12)}`, d.word);
  }

  // ======================= t7 · COIL =======================
  // 7A · endless, refined: rings drawn as ribbons with a lit side and a dark side, interlocking
  function coilA(d){
    const cx = 300, cy = 205;
    const rings = [[188, 0.92, -24, 30], [148, 0.9, 38, 26], [110, 0.86, 100, 22], [72, 0.82, 160, 17]];
    let defs = `<linearGradient id="c7a-l" gradientUnits="userSpaceOnUse" x1="${cx - 200}" y1="${cy - 200}" x2="${cx + 200}" y2="${cy + 200}"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".42" stop-color="#fff"/><stop offset=".58" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/></linearGradient>
      <mask id="c7a-m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#c7a-l)"/></mask>`;
    let body = '';
    rings.forEach(([rx, k, rot, size], i) => {
      const ry = rx * k, len = Math.PI * (rx + ry);
      defs += `<path id="c7a-p${i}" d="${ellPath(cx, cy, rx, ry)}"/>`;
      body += `<g transform="rotate(${rot} ${cx} ${cy})"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#1d160e" stroke-width="${f1(size * 1.35)}"/><ellipse cx="${cx}" cy="${cy}" rx="${f1(rx + size * 0.66)}" ry="${f1(ry + size * 0.66)}" fill="none" stroke="${BONE}" stroke-width=".6" opacity=".35"/>` +
        `<text font-family="Unbounded, Noto Serif JP" font-weight="900" font-size="${size}" letter-spacing="1" fill="${BONE}" dy="${f1(size * 0.36)}"><textPath href="#c7a-p${i}">${esc((d.word + ' ').repeat(reps(d.word + ' ', len, size, 0.78)))}${anim(`<animate attributeName="startOffset" from="0%" to="${i % 2 ? '' : '-'}40%" dur="${26 + i * 6}s" repeatCount="indefinite"/>`)}</textPath></text></g>`;
    });
    body = `<g mask="url(#c7a-m)">${body}</g>`;
    body += `<circle cx="${cx}" cy="${cy}" r="30" fill="${PANEL}"/><circle cx="${cx}" cy="${cy}" r="30" fill="none" stroke="${d.acc}" stroke-width="1.5"/><text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="Noto Serif JP" font-weight="900" font-size="28" fill="${d.acc}">${esc([...d.glyph][0])}</text>`;
    body += cap(14, 22, 'ENDLESS · ' + d.concept.toUpperCase()) + cap(W - 14, 22, d.name.toUpperCase(), 'end');
    return svg(`<defs>${defs}</defs>${body}`, d.word);
  }
  // 7B · vortex: the marble effect wound into a whirlpool, the word spiralling into it
  function coilB(d){
    const cx = 300, cy = 205;
    const m = marble('c7b-m', cx, cy, 82, [BONE, PANEL], 5, 46, true, 0.022);
    let defs = m.defs, body = '';
    // spiral in three segments, the type shrinking as it falls in
    const segs = [[210, 150, 17], [150, 112, 14], [112, 90, 11]];
    let a0 = 0;
    segs.forEach(([r0, r1, size], i) => {
      let p = '';
      const turns = 1.05;
      for (let k = 0; k <= 80; k++) { const u = k / 80, a = a0 + u * turns * Math.PI * 2, rr = r0 + (r1 - r0) * u; p += (k ? 'L' : 'M') + f1(cx + Math.cos(a) * rr) + ' ' + f1(cy + Math.sin(a) * rr * 0.92); }
      a0 += turns * Math.PI * 2;
      defs += `<path id="c7b-s${i}" d="${p}"/>`;
      const txt = (i === 0 ? d.word + ' · ' + d.name.toUpperCase() + ' · ' : i === 1 ? (d.titles[0] || d.concept).toUpperCase() + ' · ' : d.word + ' · ');
      body += `<text font-family="Unbounded, Noto Serif JP" font-weight="${800 - i * 150}" font-size="${size}" letter-spacing="1" fill="${BONE}" opacity="${(1 - i * 0.2).toFixed(2)}"><textPath href="#c7b-s${i}">${esc(txt.repeat(12))}</textPath></text>`;
    });
    body = `<g>${anim(`<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="90s" repeatCount="indefinite"/>`)}${body}</g>`;
    body += m.body + `<circle cx="${cx}" cy="${cy}" r="82" fill="none" stroke="${BONE}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="25" fill="${PANEL}"/><text x="${cx}" y="${cy + 9}" text-anchor="middle" font-family="Noto Serif JP" font-weight="500" font-size="24" fill="${BONE}">${esc([...d.glyph][0])}</text>`;
    body += cap(14, H - 16, 'INTO THE ' + d.concept.toUpperCase(), 'start', AMB) + cap(W - 14, H - 16, d.no, 'end');
    return svg(`<defs>${defs}</defs>${body}`, d.word);
  }
  // 7C · tunnel: circles of text falling away to an off-centre vanishing point, alternating spin
  function coilC(d){
    const cx = 300, cy = 205, vx = 340, vy = 170;
    let defs = '', body = '';
    const n = 6;
    for (let i = 0; i < n; i++) {
      const k = Math.pow(0.74, i), rad = 196 * k, x = vx + (cx - vx) * k, y = vy + (cy - vy) * k, size = Math.max(7, 26 * k);
      const txt = (i % 2 ? d.name.toUpperCase() : d.word) + ' · ';
      defs += `<path id="c7c-p${i}" d="${circPath(x, y, rad)}"/>`;
      body += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(rad + size * 0.7)}" fill="none" stroke="${i === 2 ? d.acc : BONE}" stroke-width="${i === 2 ? 1.4 : 0.5}" opacity="${i === 2 ? 0.9 : 0.25}"/>`;
      body += `<g opacity="${(1 - i * 0.13).toFixed(2)}">${anim(`<animateTransform attributeName="transform" type="rotate" from="0 ${f1(x)} ${f1(y)}" to="${i % 2 ? -360 : 360} ${f1(x)} ${f1(y)}" dur="${60 - i * 6}s" repeatCount="indefinite"/>`)}<text font-family="Unbounded, Noto Serif JP" font-weight="${i < 2 ? 900 : 700}" font-size="${f1(size)}" letter-spacing="${f1(size * 0.08)}" fill="${BONE}"><textPath href="#c7c-p${i}">${esc(txt.repeat(reps(txt, 2 * Math.PI * rad, size, 0.72)))}</textPath></text></g>`;
    }
    body += `<circle cx="${vx}" cy="${vy}" r="10" fill="${d.acc}"/><circle cx="${vx}" cy="${vy}" r="22" fill="${d.acc}" opacity=".18"/>`;
    body += cap(14, 22, d.glyph + ' — DEPTH ' + n, 'start', AMB) + cap(W - 14, 22, (d.titles[0] || d.concept).toUpperCase(), 'end');
    return svg(`<defs>${defs}</defs>${body}${grain(0.12)}`, d.word);
  }
