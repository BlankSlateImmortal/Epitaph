
  // ======================= round 4 · SILS · more black holes =======================
  // X2 · face-on: the disk seen from above. Each band of the disk turns at its own speed (inner bands much
  // faster, like real orbits), clockwise so the spiral arms trail, and the text on every arm keeps sliding
  // inward along it, so everything reads as being pulled into the hole.
  function holeB(d){
    const r = rng('bh2' + d.word), cx = 300, cy = 200, R = 46, sq = 0.5;
    const arms = [d.word + ' · ', d.name.toUpperCase() + ' · ', d.title + ' · '];
    // bands: [outer radius, inner radius, text size, seconds per turn]
    const bandsDef = [[250, 150, 17, 26], [150, 92, 12, 11], [92, 58, 8, 4.5]];
    let defs = `<radialGradient id="x2g"><stop offset=".2" stop-color="${d.acc}" stop-opacity="0"/><stop offset=".35" stop-color="${d.acc}" stop-opacity=".5"/><stop offset="1" stop-color="${d.acc}" stop-opacity="0"/></radialGradient><filter id="x2b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>`;
    let disk = '';
    bandsDef.forEach(([r0, r1, size, turn], s) => {
      let band = '';
      arms.forEach((t, a) => {
        let p = ''; const a0 = (a * 2 * Math.PI) / 3 + s * 1.9;
        for (let i = 0; i <= 60; i++) { const u = i / 60, rad = r0 + (r1 - r0) * u, ang = a0 + u * 1.9; p += (i ? 'L' : 'M') + f1(Math.cos(ang) * rad) + ' ' + f1(Math.sin(ang) * rad); }
        defs += `<path id="x2p${a}${s}" d="${p}"/>`;
        const rep = t.length * size * 0.72, flow = (2.2 + s * 0.4) * 2; // inner text flows faster too
        band += `<text font-family="Unbounded, sans-serif" font-weight="${800 - s * 150}" font-size="${size}" letter-spacing="1" fill="${s === 2 ? '#fff' : a === 0 ? BONE : DUST}" opacity="${(0.55 + s * 0.2).toFixed(2)}"><textPath href="#x2p${a}${s}" startOffset="${f1(-rep)}">${esc(t.repeat(8))}${anim(`<animate attributeName="startOffset" values="${f1(-rep)};0" dur="${f1(flow)}s" repeatCount="indefinite"/>`)}</textPath></text>`;
      });
      // dust in this band
      for (let i = 0; i < 55; i++) { const ang = r() * Math.PI * 2, rad = r1 + r() * (r0 - r1); band += `<circle cx="${f1(Math.cos(ang) * rad)}" cy="${f1(Math.sin(ang) * rad)}" r="${f1(0.5 + r())}" fill="${r() < 0.3 ? d.acc : BONE}" opacity="${(0.2 + r() * 0.5).toFixed(2)}"/>`; }
      disk += `<g>${anim(`<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${turn}s" repeatCount="indefinite"/>`)}${band}</g>`;
    });
    let b = stars(r, 90, 0.45) + `<ellipse cx="${cx}" cy="${cy}" rx="270" ry="${270 * sq}" fill="url(#x2g)"/>`;
    b += `<g transform="translate(${cx} ${cy}) scale(1 ${sq})">${disk}</g>`;
    b += `<circle cx="${cx}" cy="${cy}" r="${R + 8}" fill="none" stroke="${d.acc}" stroke-width="6" opacity=".5" filter="url(#x2b)"/><circle cx="${cx}" cy="${cy}" r="${R + 3}" fill="none" stroke="#fff" stroke-width="1.4"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="#000"/>`;
    b += cap(14, 22, 'SEEN FROM ABOVE · ' + d.concept.toUpperCase(), 'start', d.acc) + cap(W - 14, 22, d.glyph, 'end', BONE, 16, 0, 'Noto Serif JP', 900) + cap(14, H - 16, 'EVERYTHING WINDS INWARD', 'start', DIM);
    return svg(`<defs>${defs}</defs>${b}`, d.word);
  }
  // X3 · jets: an edge-on disk, and two beams of text firing out of the poles
  function holeC(d){
    const r = rng('bh3' + d.word), cx = 300, cy = 206, R = 36;
    const disk = (part, op) => orbitText({ id: 'x3' + part, cx, cy, rx: 250, ry: 18, rot: -4, text: d.name.toUpperCase() + ' · ' + d.title + ' · ', size: 13, weight: 800, col: BONE, dur: 18, part, fade: 0.05, op });
    const back = disk('back', 0.5), front = disk('front', 1);
    let defs = back.defs + front.defs + `<linearGradient id="x3j" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${d.acc}" stop-opacity="0"/><stop offset="1" stop-color="${d.acc}" stop-opacity=".7"/></linearGradient><filter id="x3b" x="-100%" y="-20%" width="300%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
      <path id="x3up" d="M${cx} ${cy - R - 4} L${cx} -40"/><path id="x3dn" d="M${cx} ${cy + R + 4} L${cx} ${H + 40}"/>`;
    const jet = (pid, flip) => {
      let g = `<g transform="${flip ? `rotate(180 ${cx} ${cy})` : ''}"><polygon points="${cx - 4},${cy - R} ${cx + 4},${cy - R} ${cx + 26},-10 ${cx - 26},-10" fill="url(#x3j)" filter="url(#x3b)"/></g>`;
      g += `<text font-family="Syncopate, sans-serif" font-weight="700" font-size="15" letter-spacing="6" fill="${flip ? d.acc : '#fff'}" dy="5"><textPath href="#${pid}">${esc((d.word + ' ').repeat(8))}${anim(`<animate attributeName="startOffset" values="-200;0" dur="3s" repeatCount="indefinite"/>`)}</textPath></text>`;
      return g;
    };
    let b = stars(r, 110, 0.5) + jet('x3up', false) + jet('x3dn', true) + back.body;
    b += `<ellipse cx="${cx}" cy="${cy}" rx="250" ry="10" transform="rotate(-4 ${cx} ${cy})" fill="${d.acc}" opacity=".25" filter="url(#x3b)"/>`;
    b += `<circle cx="${cx}" cy="${cy}" r="${R + 3}" fill="none" stroke="#fff" stroke-width="1.4"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="#000"/>` + front.body;
    b += cap(14, 22, 'RELATIVISTIC JETS', 'start', d.acc) + cap(W - 14, 22, d.glyph, 'end', BONE, 16, 0, 'Noto Serif JP', 900) + cap(14, H - 16, 'WHAT IT CANNOT SWALLOW, IT THROWS AWAY', 'start', DIM);
    return svg(`<defs>${defs}</defs>${b}`, d.word);
  }
  // X4 · gravity well: the textbook picture of curved spacetime, the word lying on the grid and sliding in
  function holeD(d){
    const r = rng('bh4' + d.word), cx = 300, top = 120, sq = 0.28;
    const depth = (rho) => Math.min(190, 5200 / rho);
    const yAt = (rho, ang) => top + depth(rho) + Math.sin(ang) * rho * sq;
    let grid = '', defs = '';
    const rings = [34, 42, 52, 64, 80, 100, 124, 152, 186, 226, 270];
    rings.forEach((rho, i) => { grid += `<ellipse cx="${cx}" cy="${f1(top + depth(rho))}" rx="${rho}" ry="${f1(rho * sq)}" fill="none" stroke="${i < 3 ? d.acc : BONE}" stroke-width="${i < 3 ? 0.9 : 0.6}" opacity="${(0.25 + (rings.length - i) * 0.04).toFixed(2)}"/>`; });
    for (let k = 0; k < 24; k++) {
      const ang = (k / 24) * Math.PI * 2; let p = '';
      for (let i = 0; i < 40; i++) { const rho = 34 + Math.pow(i / 39, 1.5) * 236; p += (i ? 'L' : 'M') + f1(cx + Math.cos(ang) * rho) + ' ' + f1(yAt(rho, ang)); }
      grid += `<path d="${p}" fill="none" stroke="${BONE}" stroke-width=".5" opacity=".3"/>`;
    }
    // the word rides the far rim of the grid, the name the near rim, both clear of the funnel
    const rim = (rho, back) => `M${cx - rho} ${f1(top + depth(rho))} A${rho} ${f1(rho * sq)} 0 0 ${back ? 1 : 0} ${cx + rho} ${f1(top + depth(rho))}`;
    defs += `<path id="x4a" d="${rim(262, true)}"/><path id="x4b" d="${rim(262, false)}"/><radialGradient id="x4g"><stop offset="0" stop-color="${d.acc}" stop-opacity=".55"/><stop offset="1" stop-color="${d.acc}" stop-opacity="0"/></radialGradient>`;
    grid += `<text font-family="Unbounded, sans-serif" font-weight="800" font-size="20" letter-spacing="10" fill="${BONE}" dy="-10"><textPath href="#x4a" startOffset="50%" text-anchor="middle">${esc(d.word)}</textPath></text>`;
    // letters spiral down the funnel: they circle as they fall, speed up near the bottom, shrink and vanish
    for (let i = 0; i < 9; i++) {
      const ang0 = r() * Math.PI * 2, ch = [...d.word][i % d.word.length], dur = 6 + r() * 4, beg = (-r() * dur).toFixed(1); let p = '';
      for (let j = 0; j < 60; j++) { const u = j / 59, rho = 250 - Math.pow(u, 0.7) * 214, ang = ang0 + u * u * Math.PI * 3; p += (j ? 'L' : 'M') + f1(cx + Math.cos(ang) * rho) + ' ' + f1(yAt(rho, ang)); }
      defs += `<path id="x4f${i}" d="${p}"/>`;
      const D = dur.toFixed(1);
      grid += `<text text-anchor="middle" font-family="Syncopate, sans-serif" font-weight="700" font-size="12" fill="${i % 3 ? BONE : d.acc}" opacity="0">${esc(ch)}${anim(`<animateMotion dur="${D}s" begin="${beg}s" repeatCount="indefinite" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines=".55 0 .9 .6"><mpath href="#x4f${i}"/></animateMotion><animateTransform attributeName="transform" type="scale" values="1;1;.25" keyTimes="0;.6;1" dur="${D}s" begin="${beg}s" repeatCount="indefinite" additive="sum"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.08;.85;1" dur="${D}s" begin="${beg}s" repeatCount="indefinite"/>`)}</text>`;
    }
    const by = top + depth(34);
    let b = stars(r, 70, 0.4) + `<ellipse cx="${cx}" cy="${f1(top + depth(34) + 4)}" rx="70" ry="40" fill="url(#x4g)"/>` + grid + `<ellipse cx="${cx}" cy="${f1(by + 6)}" rx="22" ry="8" fill="#000"/><ellipse cx="${cx}" cy="${f1(by + 6)}" rx="24" ry="9" fill="none" stroke="#fff" stroke-width="1"/>`;
    b += cap(14, 22, 'CURVATURE · ' + d.concept.toUpperCase(), 'start', d.acc) + cap(W - 14, 22, d.glyph, 'end', BONE, 16, 0, 'Noto Serif JP', 900) + cap(W - 14, H - 16, 'SPACE ITSELF FALLS IN', 'end', DIM) + cap(cx, 336, d.name.toUpperCase() + ' · ' + d.title, 'middle', d.acc, 10, 5, 'Space Mono, monospace', 700);
    return svg(`<defs>${defs}</defs>${b}`, d.word);
  }

  // ======================= round 4 · UNIVERSE · a fixed system, every world turning =======================
  // A spinning surface: features drift across the disc and wrap around (drawn twice, one width apart),
  // under a fixed light-and-shadow overlay, so the sphere looks like it turns in place.
  function spinBall(id, rad, base, feats, dur, rim){
    const span = rad * 4;
    const tile = feats.map(([x, y, w, h, col, op]) => `<ellipse cx="${f1(x * span)}" cy="${f1(y * rad)}" rx="${f1(w * rad)}" ry="${f1(h * rad)}" fill="${col}" opacity="${op}"/>`).join('');
    return {
      defs: `<clipPath id="${id}c"><circle r="${rad}"/></clipPath>`,
      body: `<g clip-path="url(#${id}c)"><circle r="${rad}" fill="${base}"/><g>${anim(`<animateTransform attributeName="transform" type="translate" from="0 0" to="${-span} 0" dur="${dur}s" repeatCount="indefinite"/>`)}<g transform="translate(${-span / 2} 0)">${tile}</g><g transform="translate(${span / 2} 0)">${tile}</g></g><circle r="${rad}" fill="url(#ss2-sh)"/></g><circle r="${rad + 1.5}" fill="none" stroke="${rim}" stroke-width="1.2" opacity=".7"/>`
    };
  }
  function systemB(d){
    const r = rng('ss2' + d.word), cx = 300, cy = 196, tilt = -10, k = 0.26;
    let defs = `<radialGradient id="ss2-sh" cx=".32" cy=".3" r=".95"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".88"/></radialGradient>
      <radialGradient id="ss2-c" cx=".5" cy=".5" r=".5"><stop offset=".68" stop-color="${d.acc}" stop-opacity="0"/><stop offset=".76" stop-color="#fff" stop-opacity=".95"/><stop offset=".82" stop-color="${AMB}" stop-opacity=".7"/><stop offset="1" stop-color="${d.acc}" stop-opacity="0"/></radialGradient>
      <filter id="ss2-b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>`;
    const C = (key) => CHARS[key];
    const feats = (n, cols, wMin, wMax, hk) => Array.from({ length: n }, () => [r(), (r() * 2 - 1) * 0.85, wMin + r() * (wMax - wMin), (wMin + r() * (wMax - wMin)) * hk, cols[Math.floor(r() * cols.length)], (0.4 + r() * 0.5).toFixed(2)]);
    const bands = (n, cols) => Array.from({ length: n }, (_, i) => [r(), -0.9 + (i / (n - 1)) * 1.8, 0.9 + r() * 0.8, 0.07 + r() * 0.08, cols[i % cols.length], (0.5 + r() * 0.4).toFixed(2)]);
    // [character, angle on its orbit (deg), orbit radius, size, planet builder]
    const worlds = [
      ['sils', 205, 112, 15, (id, c) => spinBall(id, 15, '#2a2730', feats(14, ['#0b0a0d', '#4b4656', c.acc], 0.08, 0.22, 1), 30, c.acc)],
      ['moinera', 330, 160, 27, (id, c) => spinBall(id, 27, PANEL, bands(9, [BONE, c.acc, '#3a2d3a', BONE]).concat(feats(6, [c.acc, BONE], 0.2, 0.4, 0.5)), 40, c.acc)],
      ['antholonious', 150, 206, 19, (id, c) => { const s = spinBall(id, 19, '#3a3226', bands(7, ['#5e5040', c.acc, '#2a2219']), 34, c.acc); s.ring = 1; return s; }],
      ['orin', 28, 246, 18, (id, c) => spinBall(id, 18, '#1a0f0b', feats(12, [c.acc, '#3a1a10', BONE], 0.1, 0.3, 0.8), 26, c.acc)],
      ['nera', 245, 282, 20, (id, c) => spinBall(id, 20, '#0f1a18', bands(6, ['#24403a', c.acc, '#0b1311']).concat(feats(5, [BONE], 0.15, 0.3, 0.4)), 36, c.acc)]
    ];
    let orbits = '', back = '', front = '';
    worlds.forEach(([key, deg, orb, size, make], i) => {
      const c = C(key), a = deg * Math.PI / 180, oy = orb * k;
      orbits += `<ellipse cx="${cx}" cy="${cy}" rx="${orb}" ry="${f1(oy)}" fill="none" stroke="${BONE}" stroke-width=".5" opacity=".2" stroke-dasharray="${i % 2 ? '2 5' : 'none'}"/>`;
      // position in the tilted frame, converted to screen space
      const lx = Math.cos(a) * orb, ly = Math.sin(a) * oy, t = tilt * Math.PI / 180;
      const x = cx + lx * Math.cos(t) - ly * Math.sin(t), y = cy + lx * Math.sin(t) + ly * Math.cos(t);
      const p = make('ss2p' + i, c); defs += p.defs;
      let g = p.body;
      if (p.ring) g = `<path d="M${-size * 2.1} 0 A${size * 2.1} ${size * 0.5} 0 0 1 ${size * 2.1} 0" transform="rotate(-14)" fill="none" stroke="${BONE}" stroke-width="2" opacity=".45"/>` + g + `<path d="M${-size * 2.1} 0 A${size * 2.1} ${size * 0.5} 0 0 0 ${size * 2.1} 0" transform="rotate(-14)" fill="none" stroke="${BONE}" stroke-width="2" opacity=".85"/>`;
      g += `<text y="${size + 16}" text-anchor="middle" font-family="Space Mono, monospace" font-size="8" letter-spacing="2" fill="${c.acc}">${esc(c.name.toUpperCase())}</text>`;
      const placed = `<g transform="translate(${f1(x)} ${f1(y)})">${g}</g>`;
      if (Math.sin(a) < 0) back += placed; else front += placed;
    });
    let corona = '';
    for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, R = 42, l = R * (1.05 + r() * 0.6); corona += `<line x1="${f1(cx + Math.cos(a) * R)}" y1="${f1(cy + Math.sin(a) * R)}" x2="${f1(cx + Math.cos(a) * l)}" y2="${f1(cy + Math.sin(a) * l)}" stroke="${i % 3 ? AMB : d.acc}" stroke-width="${f1(0.6 + r() * 1.2)}" opacity="${(0.3 + r() * 0.5).toFixed(2)}"/>`; }
    const ring = orbitText({ id: 'ss2-n', cx, cy, rx: 64, ry: 64, text: d.name.toUpperCase() + ' · ' + d.concept.toUpperCase() + ' · ', size: 9, weight: 700, ls: 3, dur: 60, fade: 1 });
    defs += ring.defs;
    const centre = `<g filter="url(#ss2-b)">${corona}</g><circle cx="${cx}" cy="${cy}" r="${42 * 1.25}" fill="url(#ss2-c)"/>${corona}<circle cx="${cx}" cy="${cy}" r="42" fill="#030201"/>` + ring.body + `<text x="${cx}" y="${cy + 7}" text-anchor="middle" font-family="Noto Serif JP" font-weight="900" font-size="18" fill="${BONE}">${esc([...d.glyph][0])}</text>`;
    const body = stars(r, 110, 0.5) + `<g transform="rotate(${tilt} ${cx} ${cy})">${orbits}</g>` + back + centre + front +
      cap(14, 22, 'SYSTEM · EVERYTHING TURNS AROUND ' + d.name.toUpperCase(), 'start', AMB) + cap(W - 14, 22, d.glyph, 'end', BONE, 16, 0, 'Noto Serif JP', 900) + cap(14, H - 16, 'CENTRAL MASS · ' + d.concept.toUpperCase(), 'start', DIM);
    return svg(`<defs>${defs}</defs>${body}${grain(0.1)}`, d.word);
  }
