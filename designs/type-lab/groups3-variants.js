
  // ======================= round 3 · VOIDED =======================
  // Voided helix: the 7D strand, carrying the word and humanity's own record instead of a title
  function helixV(d, o){
    const { id, broken = false, caption } = o, cy = 196, A = 70, k = (Math.PI * 2) / 260, r = rng(id + d.word);
    const strand = (ph) => { let p = ''; for (let x = -20; x <= W + 20; x += 6) p += (x > -20 ? 'L' : 'M') + x + ' ' + f1(cy + A * Math.sin(k * x + ph)); return p; };
    let defs = `<path id="${id}a" d="${strand(0)}"/><path id="${id}b" d="${strand(Math.PI)}"/>`, body = '';
    // gaps: stretches of the strand where erasure got to it
    const gaps = broken ? [[90 + r() * 40, 60 + r() * 30], [300 + r() * 40, 50 + r() * 40], [470 + r() * 30, 40 + r() * 30]] : [];
    if (broken) defs += `<mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${gaps.map(([x, w]) => `<rect x="${f1(x)}" y="0" width="${f1(w)}" height="${H}" fill="#000"/>`).join('')}</mask>`;
    for (let x = 0; x <= W; x += 13) {
      const y1 = cy + A * Math.sin(k * x), y2 = cy + A * Math.sin(k * x + Math.PI), depth = Math.cos(k * x), gone = gaps.some(([gx, gw]) => x > gx && x < gx + gw);
      if (gone) { for (let j = 0; j < 5; j++) body += `<circle cx="${f1(x + (r() - 0.5) * 10)}" cy="${f1(y1 + (y2 - y1) * r())}" r="${f1(0.5 + r())}" fill="${r() < 0.3 ? d.acc : BONE}" opacity="${(0.2 + r() * 0.5).toFixed(2)}"/>`; continue; }
      body += `<line x1="${x}" y1="${f1(y1)}" x2="${x}" y2="${f1(y2)}" stroke="${Math.abs(depth) < 0.2 ? d.acc : BONE}" stroke-width=".8" opacity="${(0.12 + Math.abs(depth) * 0.3).toFixed(2)}"/>`;
    }
    const tA = d.word + ' · ', tB = 'FIRE · WHEEL · WRITING · PRESS · STEAM · FISSION · SILICON · ';
    const st = (pid, t, col, sz, dir) => `<text font-family="Unbounded, Noto Serif JP" font-weight="800" font-size="${sz}" fill="${col}" dy="${sz * 0.35}"><textPath href="#${pid}">${esc(t.repeat(14))}${anim(`<animate attributeName="startOffset" from="${dir > 0 ? '0' : '-260'}" to="${dir > 0 ? '-260' : '0'}" dur="24s" repeatCount="indefinite"/>`)}</textPath></text>`;
    body += `<g ${broken ? `mask="url(#${id}m)"` : ''}>${st(id + 'b', tB, DUST, 12, -1)}${st(id + 'a', tA, BONE, 20, 1)}</g>`;
    if (broken) gaps.forEach(([x, w]) => { body += `<rect x="${f1(x)}" y="${cy - A - 18}" width="${f1(w)}" height="${2 * A + 36}" fill="none" stroke="${d.acc}" stroke-width=".7" stroke-dasharray="3 4" opacity=".7"/>`; });
    body += cap(14, 22, 'STRAND · ' + d.name.toUpperCase(), 'start', AMB) + cap(W - 14, 22, caption, 'end') + cap(14, H - 16, 'ERA 0 → ERA 1 · ' + d.glyph, 'start', DIM);
    return svg(`<defs>${defs}</defs>${body}${grain(0.12)}`, d.word);
  }
  const helixA = (d) => helixV(d, { id: 'h1', caption: 'SURVIVED, NOT SPOKEN' });
  const helixB = (d) => helixV(d, { id: 'h2', broken: true, caption: 'TOUCHED BY ERASURE' });

  // Voided wall: the Knockout wall, now made of humanity's own words
  function wallV(d, o){
    const { id, src, font = 'Space Mono, Noto Serif JP', size = 11, rowH = 13, capL, capR, wf = 'Anton, Impact, sans-serif', ww = 400, wk = 0.5 } = o;
    const r = rng(id + d.word), sz = fitSize(d.word, 180, 560, wk), by = 262, k = knock(id, d, by, sz, 17, wf, ww);
    const line = src.repeat(Math.ceil(1400 / (src.length * size * 0.6)) + 1);
    let rows = '';
    for (let y = 14, i = 0; y < H + 10; y += rowH, i++) {
      const v = i % 2 ? '-260;-40' : '-40;-260';
      rows += `<text x="${i % 2 ? -260 : -40}" y="${y}" font-family="${font}" font-size="${size}" fill="${BONE}" opacity="${(0.2 + r() * 0.28).toFixed(2)}">${esc(line)}${anim(`<animate attributeName="x" values="${v}" dur="${(46 + r() * 30).toFixed(0)}s" repeatCount="indefinite"/>`)}</text>`;
      if (r() < 0.22) rows += `<rect x="${f1(r() * W)}" y="${y - rowH + 3}" width="${f1(30 + r() * 120)}" height="${rowH - 1}" fill="${PANEL}"/>`;
    }
    const b = `<g>${rows}</g>` + label(14, 30, capL, d.acc) + label(W - 14, H - 16, capR, BONE, 'end');
    return svg(`<defs>${k.defs}</defs>${b}`, d.word);
  }
  const wallA = (d) => wallV(d, { id: 'w1', wf: 'Bodoni Moda, serif', ww: 700, wk: 0.66, src: 'E = mc²  ·  F = ma  ·  a² + b² = c²  ·  PV = nRT  ·  λ = h / p  ·  S = k log W  ·  e^iπ + 1 = 0  ·  A–T  G–C  ·  Δx Δp ≥ ħ / 2  ·  ', capL: 'WHAT WE KNEW', capR: 'ERASED AT ERA 0 · ' + d.no });
  const wallB = (d) => wallV(d, { id: 'w2', wf: 'Unbounded, sans-serif', ww: 900, wk: 0.9, src: 'HUMAN · UMUNTU · MOTHO · MENSCH · HUMAIN · UOMO · HOMBRE · 人間 · ΑΝΘΡΩΠΟΣ · ЧЕЛОВЕК · INSAN · MANUSHYA · UMUNTU NGUMUNTU NGABANTU · ', font: 'Space Mono, Noto Serif JP', capL: 'A PERSON IS A PERSON THROUGH OTHER PEOPLE', capR: 'IN SERVICE OF HUMANITY · ' + d.name.toUpperCase() });

  // Voided timeline: the scrolling record with its axis cut at Era 0
  function timelineV(d, o){
    const { id, line, ticks, curve, capL, capR, unit, wf = 'Anton, Impact, sans-serif', ww = 400, wk = 0.5 } = o;
    const r = rng(id + d.word), sz = fitSize(d.word, 170, 540, wk), by = 222, k = knock(id, d, by, sz, 31, wf, ww);
    let rows = '';
    for (let y = 46, i = 0; y < H - 96; y += 14, i++) {
      const v = i % 2 ? '-300;-60' : '-60;-300';
      rows += `<text x="-60" y="${y}" font-family="Space Mono, monospace" font-size="11" fill="${BONE}" opacity="${(0.18 + (i / 18) * 0.35 + r() * 0.1).toFixed(2)}">${esc(line.repeat(3))}${anim(`<animate attributeName="x" values="${v}" dur="${(50 + r() * 30).toFixed(0)}s" repeatCount="indefinite"/>`)}</text>`;
    }
    const ax0 = 40, ax1 = 490, ay = H - 40, top = H - 96;
    let axis = `<line x1="${ax0}" y1="${ay}" x2="${ax1}" y2="${ay}" stroke="${BONE}" stroke-width="1"/><line x1="${ax1}" y1="${ay}" x2="${W - 30}" y2="${ay}" stroke="${d.acc}" stroke-dasharray="3 4"/>`;
    // the curve: values 0..1 over the axis, then a dashed drop after Era 0
    let p = ''; curve.forEach(([t, v], i) => { p += (i ? 'L' : 'M') + f1(ax0 + t * (ax1 - ax0)) + ' ' + f1(ay - v * (ay - top)); });
    axis += `<path d="${p}" fill="none" stroke="${BONE}" stroke-width="1.4"/><path d="M${ax1} ${f1(ay - curve[curve.length - 1][1] * (ay - top))} L${W - 40} ${ay - 2}" fill="none" stroke="${d.acc}" stroke-width="1.2" stroke-dasharray="3 4"/>`;
    axis += `<circle cx="${ax1}" cy="${f1(ay - curve[curve.length - 1][1] * (ay - top))}" r="3" fill="${d.acc}"/>`;
    ticks.forEach(([t, lab], i) => { const x = ax0 + t * (ax1 - ax0), last = i === ticks.length - 1; axis += `<line x1="${f1(x)}" y1="${ay - 4}" x2="${f1(x)}" y2="${ay + 4}" stroke="${last ? d.acc : BONE}"/>` + cap(f1(x), ay + 17, lab, 'middle', last ? d.acc : DUST, 7, 1); });
    axis += cap(ax0, top - 6, unit, 'start', DIM, 7, 2) + `<path d="M${W - 36} ${ay - 6} l12 12 m0 -12 l-12 12" stroke="${d.acc}" stroke-width="1.5"/>`;
    const b = `<g>${rows}</g>` + axis + cap(14, 26, capL, 'start', BONE) + cap(W - 14, 26, capR, 'end', AMB);
    return svg(`<defs>${k.defs}</defs>${b}`, d.word);
  }
  // population: real world-population milestones, the curve ending at Era 0
  const timeA = (d) => timelineV(d, { id: 't1', wf: 'Syncopate, sans-serif', ww: 700, wk: 0.95,
    line: '10,000 BCE · 4 MILLION  ·  1 CE · 300 MILLION  ·  1804 · 1 BILLION  ·  1927 · 2 BILLION  ·  1960 · 3 BILLION  ·  1974 · 4 BILLION  ·  1987 · 5 BILLION  ·  1999 · 6 BILLION  ·  2011 · 7 BILLION  ·  2022 · 8 BILLION  ·  ERA 0 · ██████  ·  ',
    curve: [[0, 0], [0.3, 0.01], [0.55, 0.04], [0.7, 0.12], [0.78, 0.25], [0.84, 0.37], [0.88, 0.5], [0.92, 0.62], [0.96, 0.75], [1, 0.9]],
    ticks: [[0, '−10K'], [0.3, '1 CE'], [0.7, '1804'], [0.84, '1960'], [0.96, '2022'], [1, 'ERA 0']],
    unit: 'PEOPLE ALIVE', capL: 'HOW MANY OF US · 12,000 YEARS', capR: 'WHO SURVIVED · ' + d.name.toUpperCase() });
  // Kardashev: the energy a civilisation commands, on a log scale, stopped short of Type I
  const timeB = (d) => timelineV(d, { id: 't2', wf: 'Rozha One, serif', ww: 400, wk: 0.62,
    line: 'CAMPFIRE · 10² W  ·  WATERMILL · 10⁴ W  ·  STEAM ENGINE · 10⁶ W  ·  POWER STATION · 10⁹ W  ·  HUMANITY · 2 × 10¹³ W  ·  TYPE 0.73  ·  TYPE I · 10¹⁶ W  ·  TYPE II · 10²⁶ W  ·  TYPE III · 10³⁶ W  ·  ERA 0 · ██  ·  ',
    curve: [[0, 0.05], [0.18, 0.12], [0.36, 0.22], [0.52, 0.34], [0.66, 0.46], [0.76, 0.56], [0.82, 0.6]].map(([t, v]) => [t / 0.82, v]),
    ticks: [[0, 'FIRE'], [0.22, 'MILL'], [0.44, 'STEAM'], [0.63, 'GRID'], [0.8, 'TYPE 0.73'], [1, 'ERA 0']],
    unit: 'KARDASHEV SCALE · WATTS, LOG', capL: 'HOW FAR WE GOT · TYPE I NEVER REACHED', capR: d.name.toUpperCase() + ' · ' + d.no });

  // ======================= ANTHOLONIOUS · the closed book =======================
  // A real 3D box, projected orthographically, so every face (and the cover art) is an exact affine map.
  function bookCore(d, o = {}){
    const cx = 300, cy = 196, Wb = 170, Hb = 236, Tb = 54, b = 7;
    const ry = (o.ry ?? 30) * Math.PI / 180, rx = (o.rx ?? -16) * Math.PI / 180;
    const P = (x, y, z) => { // book space: x right, y down, z toward viewer; centred on the book
      x -= Wb / 2; y -= Hb / 2; z -= Tb / 2;
      const x1 = x * Math.cos(ry) + z * Math.sin(ry), z1 = -x * Math.sin(ry) + z * Math.cos(ry);
      const y2 = y * Math.cos(rx) - z1 * Math.sin(rx), z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
      return [cx + x1, cy + y2, z2];
    };
    const pts = (a) => a.map((p) => f1(p[0]) + ',' + f1(p[1])).join(' ');
    const M = (o, ux, vy) => { const O = P(...o), U = P(o[0] + ux[0], o[1] + ux[1], o[2] + ux[2]), V = P(o[0] + vy[0], o[1] + vy[1], o[2] + vy[2]); return `matrix(${(U[0] - O[0]).toFixed(4)} ${(U[1] - O[1]).toFixed(4)} ${(V[0] - O[0]).toFixed(4)} ${(V[1] - O[1]).toFixed(4)} ${f1(O[0])} ${f1(O[1])})`; };
    const r = rng('bk' + d.word);
    const LEATHER = '#3a1d10', LEATHER_D = '#24120a', GOLD = d.acc;
    const defs = `<linearGradient id="bk-c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a2f1a"/><stop offset=".55" stop-color="${LEATHER}"/><stop offset="1" stop-color="#1a0c06"/></linearGradient>
      <linearGradient id="bk-s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a0c06"/><stop offset=".45" stop-color="#4a2716"/><stop offset="1" stop-color="#1e0e07"/></linearGradient>
      <linearGradient id="bk-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efe2c4"/><stop offset="1" stop-color="#b9a37a"/></linearGradient>
      <linearGradient id="bk-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${GOLD}"/><stop offset=".45" stop-color="#fff1c8"/><stop offset=".55" stop-color="${GOLD}"/><stop offset="1" stop-color="#7a5a20"/>${anim(`<animateTransform attributeName="gradientTransform" type="translate" values="-1 0;1 0;1 0" keyTimes="0;.4;1" dur="6s" repeatCount="indefinite"/>`)}</linearGradient>
      <radialGradient id="bk-sh"><stop offset="0" stop-color="#000" stop-opacity=".75"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      <radialGradient id="bk-h"><stop offset="0" stop-color="${GOLD}" stop-opacity=".25"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient>`;
    // page block: fore-edge (x = Wb) and top (y = 0) faces, ruled with page lines
    const px0 = b + 2, px1 = Wb - 5, py0 = 5, py1 = Hb - 5, pz0 = b, pz1 = Tb - b;
    // which end of the book faces us: the top (looking down) or the bottom (looking up / lying flat)
    const topVis = P(Wb / 2, 0, Tb / 2)[2] > P(Wb / 2, Hb, Tb / 2)[2], yE = topVis ? 0 : Hb, pyE = topVis ? py0 : py1;
    let pages = `<polygon points="${pts([P(px0, pyE, pz0), P(px1, pyE, pz0), P(px1, pyE, pz1), P(px0, pyE, pz1)])}" fill="url(#bk-p)"/>`;
    const foreVis = P(Wb, Hb / 2, Tb / 2)[2] > P(0, Hb / 2, Tb / 2)[2];
    if (foreVis) pages += `<polygon points="${pts([P(px1, py0, pz0), P(px1, py1, pz0), P(px1, py1, pz1), P(px1, py0, pz1)])}" fill="#cdbb93"/>`;
    for (let z = pz0 + 2; z < pz1; z += 2.2) { const a = P(px1, py0, z), c = P(px1, py1, z), e = P(px0, pyE, z), a2 = P(px1, pyE, z); if (foreVis) pages += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(c[0])}" y2="${f1(c[1])}" stroke="#8a7550" stroke-width=".35" opacity=".7"/>`; pages += `<line x1="${f1(e[0])}" y1="${f1(e[1])}" x2="${f1(a2[0])}" y2="${f1(a2[1])}" stroke="#a8946c" stroke-width=".3" opacity=".6"/>`; }
    // gilt edge band along the fore-edge
    if (foreVis) pages += `<polygon points="${pts([P(px1, py0, pz0), P(px1, py1, pz0), P(px1, py1, pz1), P(px1, py0, pz1)])}" fill="${GOLD}" opacity=".18"/>`;
    pages += `<polygon points="${pts([P(px0, pyE, pz0), P(px1, pyE, pz0), P(px1, pyE, pz1), P(px0, pyE, pz1)])}" fill="${GOLD}" opacity=".12"/>`;
    // back board top edge + spine (x = 0) + front board edges
    let boards = `<polygon points="${pts([P(0, yE, 0), P(Wb, yE, 0), P(Wb, yE, b), P(0, yE, b)])}" fill="${LEATHER_D}"/>`;
    boards += `<polygon points="${pts([P(0, yE, Tb - b), P(Wb, yE, Tb - b), P(Wb, yE, Tb), P(0, yE, Tb)])}" fill="#4d2a17"/>`;
    boards += `<polygon points="${pts([P(0, yE, b), P(px0, yE, b), P(px0, yE, Tb - b), P(0, yE, Tb - b)])}" fill="#2a150b"/>`;
    // front cover (z = Tb) with tooled art in cover coordinates
    const front = `<polygon points="${pts([P(0, 0, Tb), P(Wb, 0, Tb), P(Wb, Hb, Tb), P(0, Hb, Tb)])}" fill="url(#bk-c)"/>`;
    const cw = d.concept.toUpperCase(), wsz = Math.min(40, 140 / Math.max(3, cw.length * 0.62));
    let art = `<rect x="12" y="12" width="${Wb - 24}" height="${Hb - 24}" fill="none" stroke="${GOLD}" stroke-width="1.2" opacity=".85"/><rect x="18" y="18" width="${Wb - 36}" height="${Hb - 36}" fill="none" stroke="${GOLD}" stroke-width=".5" opacity=".6"/>`;
    [[18, 18], [Wb - 18, 18], [18, Hb - 18], [Wb - 18, Hb - 18]].forEach(([x, y]) => { art += `<path d="M${x - 6} ${y}L${x} ${y - 6}L${x + 6} ${y}L${x} ${y + 6}Z" fill="${GOLD}"/>`; });
    art += `<g transform="translate(${Wb / 2} 92)"><circle r="30" fill="none" stroke="${GOLD}" stroke-width="1"/>` + Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<line x1="${f1(Math.cos(a) * 33)}" y1="${f1(Math.sin(a) * 33)}" x2="${f1(Math.cos(a) * 40)}" y2="${f1(Math.sin(a) * 40)}" stroke="${GOLD}" stroke-width="1"/>`; }).join('') + `<path d="${eyePath(19, 11)}" fill="none" stroke="${GOLD}" stroke-width="1.3"/><circle r="5.5" fill="url(#bk-g)"/></g>`;
    art += `<text x="${Wb / 2}" y="${158}" text-anchor="middle" font-family="Bodoni Moda, serif" font-weight="600" font-size="${f1(wsz)}" letter-spacing="2" fill="url(#bk-g)">${esc(cw)}</text>`;
    art += `<line x1="40" y1="170" x2="${Wb - 40}" y2="170" stroke="${GOLD}" stroke-width=".6"/><text x="${Wb / 2}" y="186" text-anchor="middle" font-family="Bodoni Moda, serif" font-style="italic" font-size="9" letter-spacing="1" fill="${GOLD}" opacity=".9">${esc(d.name)}</text>`;
    // clasp strap wrapping the fore-edge, with a lock plate
    art += `<rect x="${Wb - 34}" y="${Hb / 2 + 40}" width="34" height="22" fill="#1b0d06" stroke="#000" stroke-width=".6"/><rect x="${Wb - 46}" y="${Hb / 2 + 36}" width="20" height="30" rx="3" fill="url(#bk-g)"/><circle cx="${Wb - 36}" cy="${Hb / 2 + 48}" r="2.6" fill="#2a1406"/><rect x="${Wb - 37}" y="${Hb / 2 + 49}" width="2" height="7" fill="#2a1406"/>`;
    // scuffs
    for (let i = 0; i < 24; i++) art += `<circle cx="${f1(r() * Wb)}" cy="${f1(r() * Hb)}" r="${f1(1 + r() * 4)}" fill="#fff" opacity="${(0.015 + r() * 0.03).toFixed(3)}"/>`;
    const frontArt = `<g transform="${M([0, 0, Tb], [1, 0, 0], [0, 1, 0])}">${art}</g>`;
    // strap continues across the fore-edge
    const strap = `<polygon points="${pts([P(Wb, Hb / 2 + 40, Tb), P(Wb, Hb / 2 + 40, 0), P(Wb, Hb / 2 + 62, 0), P(Wb, Hb / 2 + 62, Tb)])}" fill="#1b0d06"/>`;
    // spine face (x = 0) with raised bands and the kanji; coordinates: u along z (Tb→0), v down y
    const spine = `<polygon points="${pts([P(0, 0, 0), P(0, 0, Tb), P(0, Hb, Tb), P(0, Hb, 0)])}" fill="url(#bk-s)"/>`;
    let sArt = '';
    [40, 70, 170, 200].forEach((y) => { sArt += `<rect x="0" y="${y}" width="${Tb}" height="5" fill="${GOLD}" opacity=".55"/>`; });
    [...d.glyph].forEach((ch, i) => { sArt += `<text x="${Tb / 2}" y="${104 + i * 26}" text-anchor="middle" font-family="Noto Serif JP" font-weight="900" font-size="20" fill="${GOLD}">${esc(ch)}</text>`; });
    const spineArt = `<g transform="${M([0, 0, Tb], [0, 0, -1], [0, 1, 0])}">${sArt}</g>`;
    // which faces point at us: spine is visible when ry < 0 turns the left side toward the viewer
    const spineVisible = P(0, Hb / 2, Tb / 2)[2] > P(Wb, Hb / 2, Tb / 2)[2];
    // ribbon bookmark hanging from the bottom of the page block
    const rb = P(Wb * 0.62, Hb - 4, Tb / 2), ribbon = `<path d="M${f1(rb[0] - 4)} ${f1(rb[1])} L${f1(rb[0] + 4)} ${f1(rb[1])} L${f1(rb[0] + 6)} ${f1(rb[1] + 46)} L${f1(rb[0] + 1)} ${f1(rb[1] + 38)} L${f1(rb[0] - 4)} ${f1(rb[1] + 46)} Z" fill="#7a1f16"/>`;
    const book = (topVis ? ribbon : '') + boards + pages + (topVis ? '' : ribbon) + (spineVisible ? spine + spineArt : '') + front + frontArt + (foreVis ? strap : '');
    return { defs, book };
  }
  // place a book: centred at (x, y), scaled
  const placeBook = (book, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s}) translate(-300 -196)">${book}</g>`;
  const bob = (inner, dy = 6, dur = 5) => `<g>${anim(`<animateTransform attributeName="transform" type="translate" values="0 0;0 ${-dy};0 0" dur="${dur}s" repeatCount="indefinite"/>`)}${inner}</g>`;
  function bookA(d){
    const { defs, book } = bookCore(d), cx = 300, cy = 196;
    let bodyS = `<ellipse cx="${cx + 10}" cy="${cy + 148}" rx="150" ry="16" fill="url(#bk-sh)"/><circle cx="${cx}" cy="${cy - 10}" r="190" fill="url(#bk-h)"/>`;
    bodyS += `<g>${anim(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -6;0 0" dur="5s" repeatCount="indefinite"/>`)}${book}</g>`;
    bodyS += cap(14, 22, 'THE SCRIBE’S BOOK · CLOSED', 'start', AMB) + cap(W - 14, 22, d.titles[0] ? d.titles[0].toUpperCase() : '', 'end', DUST);
    return svg(`<defs>${defs}</defs>${bodyS}${grain(0.12)}`, d.word);
  }

  // ======================= SILS · black hole =======================
  // Event horizon, photon ring, a text accretion disk that wraps over the top and under the bottom (lensing),
  // one side brighter than the other (Doppler beaming), letters stretching as they fall in.
  function holeA(d){
    const r = rng('bh' + d.word), cx = 300, cy = 196, R = 58, rx = 236, ry = 46, tilt = -8;
    const txt = d.word + '  ·  ' + d.name.toUpperCase() + '  ·  ' + d.title + '  ·  ';
    const defs = `<radialGradient id="bh-g"><stop offset=".3" stop-color="${d.acc}" stop-opacity=".0"/><stop offset=".5" stop-color="${d.acc}" stop-opacity=".35"/><stop offset="1" stop-color="${d.acc}" stop-opacity="0"/></radialGradient>
      <linearGradient id="bh-dop" gradientUnits="userSpaceOnUse" x1="${cx - rx}" y1="0" x2="${cx + rx}" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="${BONE}"/><stop offset="1" stop-color="${d.acc}" stop-opacity=".55"/></linearGradient>
      <filter id="bh-b" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="6"/></filter>
      <path id="bh-top" d="M${cx - R * 1.9} ${cy} A${R * 1.9} ${R * 1.75} 0 0 1 ${cx + R * 1.9} ${cy}"/>
      <path id="bh-bot" d="M${cx - R * 1.45} ${cy} A${R * 1.45} ${R * 1.3} 0 0 0 ${cx + R * 1.45} ${cy}"/>`;
    const disk = (part, op) => orbitText({ id: 'bh-' + part, cx, cy, rx, ry, rot: tilt, text: txt, size: 15, weight: 800, col: 'url(#bh-dop)', dur: 22, part, fade: 0.05, op });
    const back = disk('back', 0.55), front = disk('front', 1);
    // bands of glow under the disk
    const glowDisk = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry * 0.7}" transform="rotate(${tilt} ${cx} ${cy})" fill="none" stroke="${d.acc}" stroke-width="18" opacity=".35" filter="url(#bh-b)"/>`;
    // lensed image of the far side of the disk: arcs over the top and under the bottom
    const lensTop = `<text font-family="Unbounded, sans-serif" font-weight="700" font-size="11" letter-spacing="2" fill="${BONE}" opacity=".85"><textPath href="#bh-top" startOffset="0">${esc((txt).repeat(3))}${anim(`<animate attributeName="startOffset" values="0;-300" dur="22s" repeatCount="indefinite"/>`)}</textPath></text>`;
    const lensBot = `<text font-family="Unbounded, sans-serif" font-weight="700" font-size="8" letter-spacing="2" fill="${d.acc}" opacity=".7" dy="8"><textPath href="#bh-bot">${esc((txt).repeat(3))}${anim(`<animate attributeName="startOffset" values="-200;0" dur="22s" repeatCount="indefinite"/>`)}</textPath></text>`;
    const lensGlow = `<path d="M${cx - R * 1.9} ${cy} A${R * 1.9} ${R * 1.75} 0 0 1 ${cx + R * 1.9} ${cy}" fill="none" stroke="${d.acc}" stroke-width="14" opacity=".3" filter="url(#bh-b)"/>`;
    // letters spiralling in, stretched as they near the horizon
    let fall = '';
    for (let i = 0; i < 10; i++) {
      const ch = [...d.word][i % d.word.length], a0 = r() * Math.PI * 2, dur = 6 + r() * 6, beg = (-r() * dur).toFixed(1);
      let path = ''; for (let s = 0; s <= 40; s++) { const u = s / 40, rad = R * (2.8 - 1.75 * u), a = a0 + u * Math.PI * 2.4; path += (s ? 'L' : 'M') + f1(cx + Math.cos(a) * rad) + ' ' + f1(cy + Math.sin(a) * rad * 0.32); }
      fall += `<path id="bh-f${i}" d="${path}" fill="none"/><text text-anchor="middle" font-family="Syncopate, sans-serif" font-weight="700" font-size="10" fill="${BONE}">${esc(ch)}${anim(`<animateMotion dur="${dur.toFixed(1)}s" begin="${beg}s" repeatCount="indefinite" rotate="auto"><mpath href="#bh-f${i}"/></animateMotion><animateTransform attributeName="transform" type="scale" values="1 1;3 .3" dur="${dur.toFixed(1)}s" begin="${beg}s" repeatCount="indefinite" additive="sum"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.85;1" dur="${dur.toFixed(1)}s" begin="${beg}s" repeatCount="indefinite"/>`)}</text>`;
    }
    let body = stars(r, 120, 0.5);
    body += `<circle cx="${cx}" cy="${cy}" r="${R * 3.2}" fill="url(#bh-g)"/>`;
    body += lensGlow + lensTop + `<g transform="rotate(${tilt} ${cx} ${cy})">${glowDisk}</g>` + back.body + fall;
    body += `<circle cx="${cx}" cy="${cy}" r="${R + 3}" fill="none" stroke="#fff" stroke-width="1.6" opacity=".9"/><circle cx="${cx}" cy="${cy}" r="${R + 6}" fill="none" stroke="${d.acc}" stroke-width="3" opacity=".5" filter="url(#bh-b)"/>`;
    body += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#000"/>` + lensBot + front.body;
    body += cap(14, 22, 'EVENT HORIZON · ' + d.concept.toUpperCase(), 'start', d.acc) + cap(W - 14, 22, d.glyph, 'end', BONE, 16, 0, 'Noto Serif JP', 900) + cap(14, H - 16, 'NOTHING ESCAPES · NOT EVEN LIGHT', 'start', DIM) + cap(W - 14, H - 16, 'FILE ' + d.no, 'end', DIM);
    return svg(`<defs>${defs + back.defs + front.defs}</defs>${body}`, d.word);
  }

