/* Epitaph — Dither maps: the book's flat, light map (Site Encyclopedia entries now, the Creature Log later).
 *
 * Drawn on a 2D canvas from the Atlas's own heightmap (assets/atlas3d/earth.png + earth.json: Equal Earth, the same projection
 * as the 3D map), so places sit where the Atlas puts them. No WebGL.
 *
 *   EpitaphDither.load()                         -> Promise (loads the heightmap once)
 *   EpitaphDither.world(canvas, opt)             -> { project(lon, lat) -> [x, y] | null }   the whole Earth, halftone dots
 *   EpitaphDither.region(canvas, lon, lat, opt)  -> { project }                               a close crop around a point
 *   EpitaphDither.site(canvas, seed, opt)        -> { project(u, v) -> [x, y], angle }         a stacked contour model (procedural)
 *
 * Dot size is height, in 7 steps; land the +60 m sea took (Era 1) is drawn in the second colour. Colours come from the page's
 * theme variables (--amber, --verdigris, --amber-dim), so a paper theme only has to change those.
 */
(function (global) {
  'use strict';
  let LAY = null, PX = null, W = 0, H = 0, loading = null;
  const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796;

  function load() {
    if (PX) return Promise.resolve();
    if (loading) return loading;
    loading = fetch('assets/atlas3d/earth.json?v=2').then(r => r.json()).then(j => {
      LAY = j;
      return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'assets/atlas3d/earth.png?v=2'; });
    }).then(img => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      W = img.width; H = img.height; PX = g.getImageData(0, 0, W, H).data;
    }).catch(e => { loading = null; throw e; });
    return loading;
  }
  /** Elevation in metres at a heightmap pixel, and whether it is inside the island at all. */
  function elevAt(x, y) {
    const xi = Math.max(0, Math.min(W - 1, Math.round(x))), yi = Math.max(0, Math.min(H - 1, Math.round(y)));
    const i = (yi * W + xi) * 4, r = PX[i], g = PX[i + 1], b = PX[i + 2], a = PX[i + 3];
    let e;
    if (b > 0) e = -Math.pow(Math.max(b - 1, 0) / 254, 2) * 8000;
    else if (g < 255) e = g / 4;
    else e = Math.pow(Math.max(r - 1, 0) / 254, 2) * 8800;
    return { e, inside: a >= 128 };
  }
  /** Equal Earth, then the heightmap's main-map layout: lon/lat -> heightmap pixel. */
  function toPix(lon, lat) {
    const lam = ((((lon - LAY.lon0) + 180) % 360 + 360) % 360 - 180) * Math.PI / 180, phi = lat * Math.PI / 180;
    const th = Math.asin(Math.sqrt(3) / 2 * Math.sin(phi));
    const x = 2 * Math.sqrt(3) * lam * Math.cos(th) / (3 * (9 * A4 * th ** 8 + 7 * A3 * th ** 6 + 3 * A2 * th ** 2 + A1));
    const y = A4 * th ** 9 + A3 * th ** 7 + A2 * th ** 3 + A1 * th;
    return [LAY.mainX0 + (x + LAY.xmax) / (2 * LAY.xmax) * LAY.mainW, LAY.mainY0 + (LAY.ymax - y) / (LAY.ymax - LAY.ycut) * LAY.mainH];
  }
  function colours(canvas) {
    const cs = getComputedStyle(canvas), v = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
    return { land: v('--amber', '#ffb238'), sunk: v('--verdigris', '#6fb3a3'), bg: v('--se-map-bg', 'transparent') };
  }
  function sizeCanvas(canvas) {
    // layout size, not getBoundingClientRect: the book animates open with a transform, which would skew the measure
    const dpr = Math.min(2, global.devicePixelRatio || 1);
    const w = Math.max(10, Math.round(canvas.clientWidth)), h = Math.max(10, Math.round(canvas.clientHeight));
    canvas.width = w * dpr; canvas.height = h * dpr;
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return { g, w, h };
  }
  /** Halftone dots for a heightmap window [x0,y0]-[x0+sw, y0+sh] fitted into the canvas (contain), one dot per `cell` px. */
  function halftone(canvas, x0, y0, sw, sh, opt) {
    const { g, w, h } = sizeCanvas(canvas), col = colours(canvas), o = opt || {};
    const cell = o.cell || 7, sea = o.era === 0 ? 0 : 60, lo = o.lo == null ? 60 : o.lo, hi = o.hi == null ? 4500 : o.hi;
    const scale = Math.min(w / sw, h / sh), ow = sw * scale, oh = sh * scale, ox = (w - ow) / 2, oy = (h - oh) / 2;
    const cols = Math.floor(ow / cell), rows = Math.floor(oh / cell);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const px = x0 + (i + 0.5) / cols * sw, py = y0 + (j + 0.5) / rows * sh, s = elevAt(px, py);
      if (!s.inside || s.e < 0) continue;
      let r, c;
      if (s.e < sea) { r = 0.22 * cell; c = col.sunk; }
      else { const t = Math.pow(Math.min(1, Math.max(0, (s.e - lo) / (hi - lo))), 0.7); r = (0.10 + 0.065 * Math.min(6, Math.floor(t * 7))) * cell; c = col.land; }
      g.fillStyle = c; g.beginPath(); g.arc(ox + (i + 0.5) * cell, oy + (j + 0.5) * cell, r, 0, Math.PI * 2); g.fill();
    }
    return (lon, lat) => { const p = toPix(lon, lat); const x = ox + (p[0] - x0) * scale, y = oy + (p[1] - y0) * scale; return [x, y]; };
  }
  /** The whole Earth, or (opt.focus: [[lon,lat],…]) a window framed on those points, widened to the canvas's shape. */
  function world(canvas, opt) {
    const o = Object.assign({ cell: 6, lo: 60, hi: 4500 }, opt || {});
    let x0 = LAY.mainX0, y0 = LAY.mainY0, sw = LAY.mainW, sh = LAY.mainH;
    if (o.focus && o.focus.length) {
      const pts = o.focus.map(f => toPix(f[0], f[1]));
      let ax = Math.min(...pts.map(q => q[0])), bx = Math.max(...pts.map(q => q[0])), ay = Math.min(...pts.map(q => q[1])), by = Math.max(...pts.map(q => q[1]));
      const pad = 140, minW = 520; ax -= pad; bx += pad; ay -= pad; by += pad;
      if (bx - ax < minW) { const c = (ax + bx) / 2; ax = c - minW / 2; bx = c + minW / 2; }
      const aspect = Math.max(0.3, (canvas.clientHeight || 1) / (canvas.clientWidth || 1));
      let w = bx - ax, h = by - ay;
      if (h / w < aspect) { const c = (ay + by) / 2; h = w * aspect; ay = c - h / 2; } else { const c = (ax + bx) / 2; w = h / aspect; ax = c - w / 2; }
      x0 = Math.max(LAY.mainX0 - 40, ax); y0 = Math.max(LAY.mainY0 - 40, ay); sw = Math.min(w, LAY.mainW + 80); sh = Math.min(h, LAY.mainH + 80);
      o.cell = Math.max(6, Math.round(canvas.clientWidth / 95));
    }
    return { project: halftone(canvas, x0, y0, sw, sh, o) };
  }
  /** A crop around lon/lat, `span` heightmap pixels wide (about 6 px per degree). Relief is stretched to the crop's own range. */
  function region(canvas, lon, lat, opt) {
    const o = Object.assign({ span: 150, cell: 9 }, opt || {});
    const aspect = Math.max(0.3, (canvas.clientHeight || 1) / (canvas.clientWidth || 1));
    const c = toPix(lon, lat), sw = o.span, sh = o.span * aspect;
    let lo = Infinity, hi = -Infinity;
    for (let y = c[1] - sh / 2; y < c[1] + sh / 2; y += 2) for (let x = c[0] - sw / 2; x < c[0] + sw / 2; x += 2) { const s = elevAt(x, y); if (s.inside && s.e > 60) { lo = Math.min(lo, s.e); hi = Math.max(hi, s.e); } }
    if (!isFinite(lo)) { lo = 60; hi = 2000; }
    return { project: halftone(canvas, c[0] - sw / 2, c[1] - sh / 2, sw, sh, Object.assign({ lo, hi: Math.max(hi, lo + 300) }, o)) };
  }

  // ---- the founding model: a procedural stacked-contour block, the same every time for the same seed ----
  function rng(seed) { let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
  const models = new Map();
  /** The height grid and its contour levels for a seed (cached). A plateau with ring terraces, a river valley, a knoll, soft bumps. */
  function terrain(seed) {
    if (models.has(seed)) return models.get(seed);
    const N = 110, R = rng(seed), H2 = new Float32Array(N * N);
    const cx = 0.45 + R() * 0.12, cy = 0.38 + R() * 0.1, rad = 0.28 + R() * 0.06, ph = R() * 6.28, kx = 0.7 + R() * 0.25, ky = 0.62 + R() * 0.2;
    const bumps = Array.from({ length: 10 }, () => [R(), R(), 0.002 + R() * 0.01, (R() - 0.5) * 0.12]);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = i / N, y = j / N, d = Math.hypot(x - cx, (y - cy) / 0.85), b = Math.max(0, (rad - d) / rad);
      let h = 0.25 + (Math.floor(Math.min(b * 4, 3.2)) / 3.2) * 0.66 + b * 0.27;
      const rx = 0.12 + 0.1 * Math.sin(y * 7 + ph) + 0.55 * y * y;
      h -= Math.exp(-Math.pow((x - rx) / 0.06, 2)) * 0.22;
      h += Math.exp(-((x - kx) ** 2 + (y - ky) ** 2) / 0.004) * 0.4;
      bumps.forEach(([bx, by, s, a]) => { h += a * Math.exp(-((x - bx) ** 2 + (y - by) ** 2) / s); });
      H2[j * N + i] = h;
    }
    const inDisc = (i, j) => Math.hypot(i / N - 0.5, j / N - 0.5) < 0.49;
    let mn = Infinity, mx = -Infinity;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (inDisc(i, j)) { mn = Math.min(mn, H2[j * N + i]); mx = Math.max(mx, H2[j * N + i]); }
    const levels = [-9, -9, -9, -9, -9].concat(Array.from({ length: 12 }, (_, k) => mn + (mx - mn) * (k + 1) / 13));
    // per level: the cells inside, and the edge cells (inside with an outside neighbour)
    const layers = levels.map(lv => {
      const fill = [], edge = [];
      const at = (i, j) => i >= 0 && j >= 0 && i < N && j < N && inDisc(i, j) && H2[j * N + i] >= lv;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (at(i, j)) { fill.push(i, j); if (!at(i - 1, j) || !at(i + 1, j) || !at(i, j - 1) || !at(i, j + 1)) edge.push(i, j); }
      return { fill, edge };
    });
    const top = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const d = Math.hypot(i / N - cx, (j / N - cy) / 0.85); if (inDisc(i, j) && d < rad * 0.95 && R() < 0.07) top.push(i, j, H2[j * N + i]); }
    const m = { N, H: H2, levels, layers, top, centre: [cx, cy], rad };
    models.set(seed, m);
    return m;
  }
  /** Draw the model at `angle` (radians). opt.stage: 0..6 founding stage; without opt.layers, buildings appear from stage 3 (growth).
   *  opt.layers (EpitaphSites.foundingLayers) + opt.tint: the illustrated stages (step 5.3). */
  function site(canvas, seed, opt) {
    const o = Object.assign({ angle: 0.6, stage: 6 }, opt || {});
    const { g, w, h } = sizeCanvas(canvas), col = colours(canvas), m = terrain(seed), N = m.N;
    const s = Math.min(w / (N * 1.85), h / (N * 1.25)), K = Math.max(5, s * 4.2);
    const ca = Math.cos(o.angle), sa = Math.sin(o.angle), c30 = Math.cos(Math.PI / 6), s30 = 0.5;
    const ox = w / 2, oy = h * 0.42 + m.levels.length * K * 0.35;
    const proj = (i, j, lift) => { const x = i - N / 2, y = j - N / 2, rx = x * ca - y * sa, ry = x * sa + y * ca; return [ox + (rx - ry) * c30 * s, oy + (rx + ry) * s30 * s - lift]; };
    const dot = Math.max(1.6, s * 1.15);
    m.layers.forEach((L, k) => {
      const lift = k * K;
      g.fillStyle = col.bg === 'transparent' ? 'rgba(14,10,5,0.96)' : col.bg;
      for (let n = 0; n < L.fill.length; n += 2) { const p = proj(L.fill[n], L.fill[n + 1], lift); g.fillRect(p[0] - dot, p[1] - dot, dot * 2, dot * 2); }
      g.fillStyle = k < 5 ? col.land + '88' : col.land;
      for (let n = 0; n < L.edge.length; n += 2) { const p = proj(L.edge[n], L.edge[n + 1], lift); g.fillRect(p[0] - 0.8, p[1] - 0.8, 1.6, 1.6); }
    });
    const lvl = v => { let k = 0; m.levels.forEach((lv, n) => { if (v >= lv) k = n; }); return k; };
    const L = o.layers;
    if (!L && o.stage >= 3) {
      g.fillStyle = '#ffd58a';
      for (let n = 0; n < m.top.length; n += 3) { const p = proj(m.top[n], m.top[n + 1], lvl(m.top[n + 2]) * K); const hh = 3 + ((n * 7) % 9); g.fillRect(p[0], p[1] - hh, 2.2, hh); }
    }
    if (L) drawStage(g, m, L, o.tint || '#ffd58a', proj, lvl, K, s, seed);
    const topLift = lv => { let k = 0; m.levels.forEach((l, n) => { if (lv >= l) k = n; }); return k * K; };
    return { angle: o.angle, project: (u, v) => { const i = u * N, j = v * N, hh = m.H[Math.max(0, Math.min(N - 1, Math.round(j))) * N + Math.max(0, Math.min(N - 1, Math.round(i)))]; return proj(i, j, topLift(hh)); }, centre: m.centre };
  }

  /** The illustrated founding stages (step 5.3) on top of the model: what EpitaphSites.foundingLayers says stands at the stage.
   *  Ruins of the drowned world in grey, the cleared heart, a ring wall with a gate, the first blocks then the town in the place's colour,
   *  a disaster's scar (blocks inside it gone, an ember rim), rebuilt blocks over it in another tone, and a ring marking the spot. */
  function drawStage(g, m, L, tint, proj, lvl, K, s, seed) {
    const N = m.N, cx = m.centre[0] * N, cy = m.centre[1] * N, rad = m.rad * N, H = (i, j) => m.H[Math.max(0, Math.min(N - 1, Math.round(j))) * N + Math.max(0, Math.min(N - 1, Math.round(i)))];
    const at = (i, j, up) => proj(i, j, lvl(H(i, j)) * K + (up || 0)), dist = (i, j) => Math.hypot(i - cx, (j - cy) / 0.85);
    const R = rng(seed + ':stages'), SCAR = rad * 0.78, inScar = (i, j) => dist(i, j) < SCAR;
    const BW = Math.max(2.4, s * 1.7), BH = Math.max(1, s * 0.55);
    const block = (i, j, hh, col, w) => { const p = at(i, j), ww = Math.max(w || 0, BW), h2 = hh * BH * 1.3; g.fillStyle = col; g.fillRect(p[0] - ww / 2, p[1] - h2, ww, h2); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(p[0] + ww / 2 - ww * 0.3, p[1] - h2, ww * 0.3, h2); };
    const ring = (r, col, lw, dash, up) => { g.save(); g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath();
      for (let k = 0; k <= 72; k++) { const a = k / 72 * Math.PI * 2, i = cx + Math.cos(a) * r, j = cy + Math.sin(a) * r * 0.85, p = at(i, j, up); k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke(); g.restore(); };
    if (L.ruins) {                                   // the drowned world's leftovers, out beyond the new heart
      for (let k = 0; k < 52; k++) { const a = R() * Math.PI * 2, r = rad * (1.02 + R() * 0.6), i = cx + Math.cos(a) * r, j = cy + Math.sin(a) * r * 0.85;
        if (Math.hypot(i / N - 0.5, j / N - 0.5) > 0.47) continue; const hh = 2 + R() * 5; block(i, j, hh, '#c9c3b1'); if (R() < 0.5) { const p = at(i, j); g.fillStyle = '#5c5a54'; g.fillRect(p[0] - 1.6, p[1] - hh - 1.2, 1.2, 1.2); } }
    }
    if (L.cleared) {                                 // the cleared, paved heart
      g.fillStyle = 'rgba(255,213,138,.20)';
      for (let j = Math.floor(cy - rad); j <= cy + rad; j++) for (let i = Math.floor(cx - rad); i <= cx + rad; i++) if (dist(i, j) < rad * 0.6 && !(L.scar && inScar(i, j))) { const p = at(i, j); g.fillRect(p[0] - 1.1, p[1] - 1.1, 2.2, 2.2); }
    }
    if (L.scar) {                                    // a smooth black wound, its rim still glowing
      g.fillStyle = 'rgba(4,3,2,.92)';
      for (let j = Math.floor(cy - SCAR); j <= cy + SCAR; j++) for (let i = Math.floor(cx - SCAR); i <= cx + SCAR; i++) if (inScar(i, j)) { const p = at(i, j); g.fillRect(p[0] - 1.6, p[1] - 1.6, 3.2, 3.2); }
      ring(SCAR, 'rgba(224,101,74,.9)', 1.6, [3, 3]);
    }
    if (L.walls) {                                   // a ring wall, with a gate facing the viewer's side
      for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2; if (Math.abs(((a - Math.PI / 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < 0.22) continue;
        const i = cx + Math.cos(a) * rad * 0.9, j = cy + Math.sin(a) * rad * 0.9 * 0.85; if (L.scar && inScar(i, j)) continue; block(i, j, 4 + (k % 8 === 0 ? 3 : 0), tint, 2.6); }
    }
    const tops = []; for (let n = 0; n < m.top.length; n += 3) tops.push([m.top[n], m.top[n + 1], n]);
    if (L.first && !L.town) tops.filter(t => dist(t[0], t[1]) < rad * 0.55).filter((t, k) => k % 3 === 0).forEach(t => { if (!(L.scar && inScar(t[0], t[1]))) block(t[0], t[1], 3 + (t[2] % 4), tint); });
    if (L.town) tops.forEach(t => { if (L.scar && inScar(t[0], t[1])) return; block(t[0], t[1], 3 + ((t[2] * 7) % 9), tint); });
    if (L.rebuilt) tops.filter(t => inScar(t[0], t[1])).filter((t, k) => k % 2 === 0).forEach(t => block(t[0], t[1], 2 + (t[2] % 5), '#6fb8a8'));
    ring(rad * 0.3, 'rgba(255,213,138,.85)', 1.2, [2, 4], 1);   // the spot
  }
  global.EpitaphDither = { load, world, region, site, toPix, elevAt, terrain };
})(typeof window !== 'undefined' ? window : globalThis);
