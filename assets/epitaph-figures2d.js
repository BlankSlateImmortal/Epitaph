/* Epitaph — full-body 2D figures (Spike family).
 * Same graphic language as the Spike portrait: ink silhouettes, grey keyline,
 * glowing eye glyphs, jagged hair; halftone and pixel treatments.
 * Each character is a 2D skeleton (hips, spine, neck, arms, legs) posed per frame,
 * so it can animate. Not turnable: front view only.
 *
 *   EpitaphFigures.svg({ char, seed, v, anim, t })              -> SVG string
 *   background: false on frame()/Player cuts the figure out (no paper / checkerboard)
 *   EpitaphFigures.frame({ char, seed, v, anim, t, style })   -> Promise<canvas>
 *   new EpitaphFigures.Player(canvasEl, opts).play()           -> flipbook at 11 fps
 *   EpitaphFigures.CHARACTERS, .STYLES, .variantsOf(char, seed)
 */
(function (global) {
  'use strict';

  const W = 240, H = 360, GROUND = 346;
  const STYLES = ['halftone', 'pixel'];
  const PAL = {
    ink: '#0b0b0d', coal: '#1e1f25', void: '#020203', bone: '#ece6d8', dust: '#9c927e', paper: '#e4ddcc',
    ember: '#c4482b', gold: '#d8b25a', verdigris: '#6fb3a3', cyan: '#5ec8ff', violet: '#9b7bff', dream: '#f08fd0'
  };

  // ---------- seeded randomness ----------
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    const r = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (lo, hi) => lo + r() * (hi - lo);
    r.int = (lo, hi) => Math.floor(r.range(lo, hi + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    return r;
  }
  const f = (n) => Math.round(n * 100) / 100;
  const TAU = Math.PI * 2;
  const wave = (t, k = 1, ph = 0) => Math.sin(TAU * (t * k + ph));
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const smoothstep = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  // 0 → 1 → 0 over the loop: rise during [0, a], hold, fall during [b, 1]
  const envelope = (t, a = 0.22, b = 0.78) => smoothstep(0, a, t) * (1 - smoothstep(b, 1, t));
  const lerp = (a, b, u) => a + (b - a) * u;

  // ---------- 2D matrices (SVG order: a b c d e f) ----------
  function mul(...ms) {
    return ms.reduce((m, n) => [
      m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
    ]);
  }
  const T = (x, y) => [1, 0, 0, 1, x, y];
  const R = (d) => { const a = d * Math.PI / 180; return [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]; };
  const S = (x, y = x) => [x, 0, 0, y, 0, 0];
  const pt = (m, x = 0, y = 0) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const G = (m, inner) => `<g transform="matrix(${m.map((v) => Math.round(v * 1000) / 1000).join(' ')})">${inner}</g>`;

  // ---------- shape helpers ----------
  function limb(len, w1, w2, fill, st) {
    const a = w1 / 2, b = w2 / 2;
    return `<path d="M${f(-a)} 0 A${f(a)} ${f(a)} 0 0 1 ${f(a)} 0 L${f(b)} ${f(len)} A${f(b)} ${f(b)} 0 0 1 ${f(-b)} ${f(len)} Z" fill="${fill}" ${st}/>`;
  }
  function poly(pts) { return 'M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L') + ' Z'; }
  function smooth(pts, closed = true, k = 1 / 6) {
    const n = pts.length;
    const P = (i) => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      d += ` C${f(p1[0] + (p2[0] - p0[0]) * k)} ${f(p1[1] + (p2[1] - p0[1]) * k)} ${f(p2[0] - (p3[0] - p1[0]) * k)} ${f(p2[1] - (p3[1] - p1[1]) * k)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return d + (closed ? 'Z' : '');
  }
  // the Spike motif: a jagged arc of tips and valleys
  function spikeArc(cx, cy, rx, ry, a0, a1, n, lo, hi, r, wob = 0, t = 0) {
    const pts = [];
    for (let i = 0; i <= n * 2; i++) {
      const a = a0 + (a1 - a0) * (i / (n * 2));
      const tip = i % 2 === 1;
      const k = tip ? 1 + r.range(lo, hi) + wob * Math.sin(TAU * t + i) : 1 + r.range(-0.04, 0.03);
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  }

  // ---------- eyes ----------
  function eye(x, cy, size, kind, color, side, open = 1, c) {
    const sq = `transform="translate(${f(x)} ${f(cy)}) scale(1 ${f(Math.max(0.08, open))}) translate(${f(-x)} ${f(-cy)})"`;
    let s = '';
    if (kind === 'oval') s = `<ellipse cx="${f(x)}" cy="${f(cy)}" rx="${f(size * 0.42)}" ry="${f(size)}" fill="${color}"/>`;
    else if (kind === 'dot') s = `<circle cx="${f(x)}" cy="${f(cy)}" r="${f(size * 0.55)}" fill="${color}"/>`;
    else if (kind === 'crescent') s = `<path d="M${f(x - size)} ${f(cy - size * 0.2)} Q${f(x)} ${f(cy + size * 1.3)} ${f(x + size)} ${f(cy - size * 0.2)} Q${f(x)} ${f(cy + size * 0.5)} ${f(x - size)} ${f(cy - size * 0.2)}Z" fill="${color}"/>`;
    else if (kind === 'sleep') s = `<path d="M${f(x - size)} ${f(cy - size * 0.3)} Q${f(x)} ${f(cy + size * 0.8)} ${f(x + size)} ${f(cy - size * 0.3)}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>`;
    else if (kind === 'sharp') s = `<path d="M${f(x - side * size * 1.15)} ${f(cy - size * 0.75)} L${f(x + side * size * 0.95)} ${f(cy - size * 0.1)} L${f(x + side * size * 0.15)} ${f(cy + size * 0.7)} Z" fill="${color}"/>`;
    else if (kind === 'ring') s = `<circle cx="${f(x)}" cy="${f(cy)}" r="${f(size * 0.72)}" fill="none" stroke="${color}" stroke-width="2.6"/><circle cx="${f(x)}" cy="${f(cy)}" r="${f(size * 0.18)}" fill="${color}"/>`;
    else if (kind === 'spiral') {
      let d = '', a = 0, rr = 0.6;
      for (let i = 0; i < 60; i++) { a += 0.34; rr += size * 0.018; d += (i ? 'L' : 'M') + f(x + Math.cos(a * side) * rr) + ' ' + f(cy + Math.sin(a * side) * rr); }
      s = `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`;
    } else if (kind === 'anime') {
      // big iris, lid line: Moinera's pale face
      s = `<path d="M${f(x - size * 1.1)} ${f(cy - size * 0.55)} Q${f(x)} ${f(cy - size * 1.15)} ${f(x + size * 1.1)} ${f(cy - size * 0.5)}" fill="none" stroke="${c.inkLine}" stroke-width="2.6" stroke-linecap="round"/>` +
        `<ellipse cx="${f(x)}" cy="${f(cy + size * 0.1)}" rx="${f(size * 0.62)}" ry="${f(size * 0.78)}" fill="${color}" stroke="${c.inkLine}" stroke-width="1.4"/>` +
        `<ellipse cx="${f(x)}" cy="${f(cy + size * 0.18)}" rx="${f(size * 0.26)}" ry="${f(size * 0.42)}" fill="${c.inkLine}"/>`;
    }
    return `<g ${sq}>${s}</g>`;
  }
  function blinkAt(t, at = 0.62, len = 0.05) { const d = Math.abs(t - at); return d < len ? 0.08 + (d / len) * 0.92 : 1; }

  // ---------- colour sets ----------
  function colorsFor(mode, accent) {
    const out = mode === 'outline';
    const dark = '#05060a';
    return {
      outline: out, accent, mode,
      ink: out ? dark : PAL.ink,
      coal: out ? dark : PAL.coal,
      bone: out ? dark : PAL.bone,
      skin: out ? dark : '#121216',
      pale: out ? dark : '#e9e1d2',
      inkLine: out ? accent : PAL.ink,
      line: out ? accent : '#3d3e45',
      st: out ? `stroke="${accent}" stroke-width="2.1" stroke-linejoin="round"` : `stroke="#55565e" stroke-width="1.6" stroke-linejoin="round"`,
      stBone: out ? `stroke="${accent}" stroke-width="2.1" stroke-linejoin="round"` : `stroke="#8d877a" stroke-width="1.2" stroke-linejoin="round"`,
      none: 'stroke="none"',
      glow: accent,
      hair: (h) => out ? dark : ({ black: PAL.ink, bone: PAL.bone, gold: PAL.gold, ember: '#7e2f22', ash: '#5d5e66' }[h] || PAL.ink)
    };
  }

  // ---------- skeleton ----------
  // Angles are degrees. Arms: *Sh = raise outward, *El = bend (+ folds toward the body, - folds up/out), *Wr wrist.
  // Legs: *Hip = spread outward, *Knee = bend. Body: x/y offset, hip tilt, lean, neck, head.
  function rig(P, p) {
    const root = mul(T(120 + (p.x || 0), P.hipY + (p.y || 0)), R(p.hip || 0));
    const torso = mul(root, R(p.lean || 0));
    const neck = mul(torso, T(0, -P.torso), R(p.neck || 0));
    const head = mul(neck, T(0, -P.neck), R(p.head || 0));
    const side = (s) => {
      const k = s < 0 ? 'l' : 'r';
      const sh = mul(torso, T(s * P.shW, -P.torso + P.shY), R(-s * (p[k + 'Sh'] || 0)));
      const el = mul(sh, T(0, P.upper), R(s * (p[k + 'El'] || 0)));
      const hand = mul(el, T(0, P.fore), R(s * (p[k + 'Wr'] || 0)));
      const hp = mul(root, T(s * P.hipW, 0), R(-s * (p[k + 'Hip'] || 0)));
      const kn = mul(hp, T(0, P.thigh), R(s * (p[k + 'Knee'] || 0)));
      const ankle = pt(kn, 0, P.shin);
      const foot = mul(T(ankle[0], ankle[1]), R(s * (p[k + 'Foot'] || 0)));
      return { sh, el, hand, hp, kn, foot, fingertip: pt(hand, 0, 14) };
    };
    return { root, torso, neck, head, L: side(-1), R: side(1) };
  }

  // ---------- shared parts ----------
  function hand(c, kind, s, fill, t) {
    const st = fill === c.bone ? c.stBone : c.st;
    const palm = `<ellipse cx="0" cy="6" rx="7.5" ry="9" fill="${fill}" ${st}/>`;
    if (kind === 'open') {
      let fingers = '';
      for (let i = 0; i < 4; i++) {
        const a = (-30 + i * 20) * s + wave(t, 2, i * 0.2) * 3;
        fingers += G(mul(T(-s * 3 + s * i * 2, 9), R(a)), limb(9, 3.4, 2.6, fill, st));
      }
      fingers += G(mul(T(s * 5, 4), R(s * -70)), limb(7, 3.6, 2.8, fill, st));
      return fingers + palm;
    }
    if (kind === 'peace') {
      return G(mul(T(-2, 8), R(-12)), limb(13, 3.6, 2.8, fill, st)) + G(mul(T(2, 8), R(12)), limb(13, 3.6, 2.8, fill, st)) + palm;
    }
    if (kind === 'point') return G(T(0, 9), limb(12, 3.6, 2.8, fill, st)) + palm;
    if (kind === 'none') return '';
    return palm; // fist / relaxed
  }
  function shoe(c, kind, s) {
    if (kind === 'platform') {
      return `<path d="M${-12 + s * 2} -4 Q${s * 4} -12 ${13 + s * 2} -3 L${13 + s * 3} 10 L${-12 + s * 1} 10 Z" fill="${c.ink}" ${c.st}/>` +
        `<rect x="${-13 + s * 1.5}" y="6" width="27" height="6" rx="1.5" fill="${c.bone}" ${c.stBone}/>`;
    }
    if (kind === 'sneaker') {
      return `<path d="M${-9 + s * 3} -4 Q${s * 3} -10 ${11 + s * 4} -2 L${12 + s * 4} 5 L${-9 + s * 2} 5 Z" fill="${c.ink}" ${c.st}/>` +
        `<rect x="${-10 + s * 2}" y="3" width="${23}" height="4" rx="2" fill="${c.bone}" ${c.stBone}/>`;
    }
    return `<path d="M${-9 + s * 3} -4 Q${s * 3} -9 ${11 + s * 4} -1 L${11 + s * 4} 6 L${-9 + s * 2} 6 Z" fill="${c.ink}" ${c.st}/>`;
  }
  function legs(c, rg, P, o) {
    // o: { pant: [w1,w2,w3], shoe, fill }
    const out = [];
    [-1, 1].forEach((s) => {
      const L = s < 0 ? rg.L : rg.R;
      const [wt, wk, wa] = o.pant;
      out.push(G(L.hp, limb(P.thigh + 4, wt, wk, o.fill, c.st)));
      out.push(G(L.kn, limb(P.shin, wk, wa, o.fill, c.st)));
      out.push(G(L.foot, shoe(c, o.shoe, s)));
    });
    return out.join('');
  }
  function arm(c, L, P, o, s, t) {
    // o: { sleeve:[w1,w2,w3], fill, hand, handFill }
    const [a, b, d] = o.sleeve;
    return G(L.sh, limb(P.upper + 2, a, b, o.fill, c.st)) +
      G(L.el, limb(P.fore, b, d, o.fill, c.st)) +
      (o.hand === 'none' ? '' : G(L.hand, hand(c, o.hand, s, o.handFill || c.skin, t)));
  }

  // ======================================================================
  // CHARACTERS (draft 3: the user's picks, plus weapons and items)
  // ======================================================================

  // a straight Murim jian: hilt at the origin, blade along +y
  function jian(c, len, tassel, t, sway, hiltOnly) {
    const bw = 3.6;
    return (hiltOnly ? '' : `<path d="M${-bw} 10 L${-bw} ${f(len - 10)} L0 ${f(len)} L${bw} ${f(len - 10)} L${bw} 10Z" fill="#a39d91" stroke="${PAL.ink}" stroke-width="1.2"/>` +
      `<line x1="0" y1="12" x2="0" y2="${f(len - 12)}" stroke="#8d877a" stroke-width="0.9"/>`) +
      `<path d="M-11 6 Q-6 12 0 9 Q6 12 11 6 L9 11 Q0 15 -9 11Z" fill="${c.ink}" ${c.st}/>` +
      `<rect x="-2.8" y="-16" width="5.6" height="22" rx="1.5" fill="${c.ink}" ${c.st}/>` +
      `<path d="M-2.8 -11 L2.8 -7 M-2.8 -5 L2.8 -1 M-2.8 1 L2.8 5" stroke="#55565e" stroke-width="1"/>` +
      `<circle cx="0" cy="-18" r="3.6" fill="${c.ink}" ${c.st}/>` +
      `<path d="M0 -21 Q${f(-4 + sway)} -30 ${f(-6 + sway * 1.6)} -38" fill="none" stroke="${tassel}" stroke-width="1.6"/>` +
      `<path d="M${f(-6 + sway * 1.6)} -38 l-4 14 l4 -3 l3 4 l1 -15Z" fill="${tassel}"/>`;
  }

  // ---------------- SILS · Erasure / Nothing ----------------
  const sils = {
    id: 'sils', name: 'Sils', concept: 'Erasure · Nothing', accent: PAL.violet,
    titles: ['Silence'],
    frames: { idle: 32, ability: 52 },
    variants: {
      eyes: ['one', 'none'],
      sword: ['hand', 'hip', 'back'],
      tassel: ['violet', 'ember', 'bone'],
      sleeves: ['wide', 'bound']
    },
    anims: { idle: 'Idle', ability: 'Erase' },
    P: { torso: 70, neck: 7, R: 34, shW: 24, shY: 8, upper: 44, fore: 42, hipW: 10, thigh: 58, shin: 58, hipY: GROUND - 6 - 116 },
    // erase timeline: glitch builds, he is gone, then he slowly materialises from the feet up
    phase(t) {
      const glitch = smoothstep(0.08, 0.34, t) * (1 - smoothstep(0.38, 0.4, t)) + (1 - smoothstep(0.55, 0.9, t)) * smoothstep(0.52, 0.56, t) * 0.35;
      const dis = smoothstep(0.24, 0.4, t) * (1 - smoothstep(0.52, 0.53, t));
      const reveal = t < 0.52 ? null : lerp(GROUND + 10, 0, smoothstep(0.53, 0.95, t));
      return { glitch, dis, reveal };
    },
    pose(t, anim, v) {
      const b = wave(t), hand = v.sword === 'hand';
      const ph = anim === 'ability' ? this.phase(t) : { glitch: 0 };
      const jit = ph.glitch * wave(t, 17) * 3;
      return {
        x: jit, y: b * 1, lean: wave(t, 1, 0.2) * 0.8, neck: 4, head: 10 + wave(t, 1, 0.3) * 1.5 - ph.glitch * 8,
        lSh: 12 + b * 1.5, lEl: 8, rSh: hand ? 16 + b : 12 + b * 1.5, rEl: hand ? 4 : 8, rWr: hand ? -14 : 0,
        lHip: 2, rHip: 2, lFoot: -4, rFoot: 4
      };
    },
    draw(c, rg, v, t, anim, rr) {
      const P = this.P;
      const ph = anim === 'ability' ? this.phase(t) : { glitch: 0, dis: 0, reveal: null };
      const back = [], body = [], fxF = [];
      const hc = P.R * 0.92;
      const hairC = c.hair('black');
      const sw = wave(t, 1, 0.15) * 3 + ph.glitch * wave(t, 5) * 4;
      const rh = rr('hair');
      const tassel = { violet: PAL.violet, ember: PAL.ember, bone: PAL.bone }[v.tassel];
      const sway = wave(t, 1, 0.4) * 3;
      // long back hair
      const pts = [[-P.R * 0.95, -hc - P.R * 0.2], [-P.R * 1.15 + sw * 0.3, -hc + 30], [-P.R * 1.3 + sw, 53]];
      for (let i = 0; i <= 9; i++) {
        const k = i / 9;
        pts.push([lerp(-P.R * 1.3, P.R * 1.3, k) + sw * 1.2, 88 + (i % 2 ? rh.range(10, 26) : rh.range(-4, 4)) + Math.sin(TAU * t + i) * 2]);
      }
      pts.push([P.R * 1.3 + sw, 53], [P.R * 1.15 + sw * 0.3, -hc + 30], [P.R * 0.95, -hc - P.R * 0.2], [0, -hc - P.R - 4]);
      if (v.sword === 'back') back.push(G(mul(rg.torso, T(-4, -P.torso * 0.45), R(-150)), jian(c, 104, tassel, t, sway)));
      back.push(G(rg.head, `<path d="${poly(pts)}" fill="${hairC}" ${c.st}/>`));
      // kimono: long, torn hem
      const hemY = GROUND - 22 - P.hipY;
      const rt = rr('hem'), hn = 12, hemPts = [];
      for (let i = 0; i <= hn; i++) {
        const k = i / hn;
        hemPts.push([lerp(-42, 42, k) + sw * 1.4 * (0.4 + Math.abs(k - 0.5)), hemY + (i % 2 ? rt.range(4, 16) : rt.range(-6, 0)) + wave(t, 1, k) * 2]);
      }
      back.push(G(rg.torso, `<path d="${poly([[-P.shW - 4, -P.torso + 6], [-P.shW - 10, -P.torso * 0.3], [-40, hemY * 0.6]].concat(hemPts, [[40, hemY * 0.6], [P.shW + 10, -P.torso * 0.3], [P.shW + 4, -P.torso + 6], [0, -P.torso - 2]]))}" fill="${c.coal}" ${c.st}/>`));
      body.push(legs(c, rg, P, { pant: [18, 16, 15], shoe: 'boot', fill: c.ink }));
      let tor = `<path d="M-18 0 L-20 ${-P.torso + 8} Q0 ${-P.torso - 4} 20 ${-P.torso + 8} L18 0Z" fill="${c.ink}" ${c.st}/>` +
        `<path d="M-14 ${-P.torso + 2} L0 ${-P.torso * 0.45} L14 ${-P.torso + 2} L9 ${-P.torso + 1} L0 ${-P.torso * 0.55} L-9 ${-P.torso + 1}Z" fill="${c.bone}" ${c.stBone}/>`;
      [-1, 1].forEach((s) => {
        const p2 = [[s * (P.shW + 3), -P.torso + 6], [s * 8, -P.torso + 2], [s * 14, -P.torso * 0.3], [s * 18 + sw, hemY]];
        if (s < 0) { for (let i = 4; i >= 0; i--) p2.push([hemPts[i][0], hemPts[i][1] - 2]); }
        else { for (let i = hn - 4; i <= hn; i++) p2.push([hemPts[i][0], hemPts[i][1] - 2]); }
        p2.push([s * 40, hemY * 0.6], [s * (P.shW + 9), -P.torso * 0.3]);
        tor += `<path d="${poly(p2)}" fill="${c.ink}" ${c.st}/><path d="M${s * 9} ${-P.torso + 3} L${s * 16} ${-P.torso * 0.55}" stroke="${c.line}" stroke-width="1.5"/>`;
      });
      // sash
      tor += `<rect x="-20" y="-14" width="40" height="9" fill="${c.coal}" ${c.st}/>`;
      if (v.sword === 'hip') tor += G(mul(T(-16, -10), R(-62)), `<rect x="-4" y="8" width="8" height="98" rx="3" fill="${c.ink}" ${c.st}/><rect x="-4.5" y="100" width="9" height="6" fill="${tassel}"/>` + jian(c, 0, tassel, t, sway, true));
      body.push(G(rg.torso, tor));
      const sleeve = v.sleeves === 'wide' ? [19, 18, 30] : [18, 16, 13];
      body.push(arm(c, rg.L, P, { sleeve, fill: c.ink, hand: 'relaxed', handFill: c.pale }, -1, t));
      if (v.sword === 'hand') body.push(G(mul(rg.R.hand, T(0, 6), R(-8)), jian(c, 110, tassel, t, sway)));
      body.push(arm(c, rg.R, P, { sleeve, fill: c.ink, hand: 'relaxed', handFill: c.pale }, 1, t));
      if (v.sleeves === 'bound') [rg.L, rg.R].forEach((L) => body.push(G(L.el, `<path d="M-8 ${P.fore - 10} L8 ${P.fore - 8} M-8 ${P.fore - 5} L8 ${P.fore - 3}" stroke="${c.line}" stroke-width="1.6"/>`)));
      // head: pale face, black curtain of hair
      let head = `<rect x="-5" y="-6" width="10" height="10" fill="${c.pale}" ${c.stBone}/>` +
        `<ellipse cx="0" cy="${f(-hc)}" rx="${f(P.R * 0.8)}" ry="${f(P.R)}" fill="${c.pale}" ${c.stBone}/>`;
      const ey = -hc + 5, open = blinkAt(t, 0.7);
      if (v.eyes === 'one') head += `<ellipse cx="${f(P.R * 0.3)}" cy="${f(ey)}" rx="8" ry="10" fill="${PAL.ink}"/>` + eye(P.R * 0.3, ey, 7 * (1 + ph.glitch * 0.4), 'oval', c.accent, 1, open, c);
      const bang = [[-P.R * 1.0, -hc - P.R * 0.15]];
      for (let i = 0; i <= 7; i++) {
        const k = i / 7, x = lerp(-P.R * 0.98, P.R * 0.98, k);
        const parted = v.eyes === 'one' && Math.abs(x - P.R * 0.3) < 9;
        bang.push([x, -hc + (parted ? -6 : (i % 2 ? 22 : 12)) + rh.range(-3, 3) + sw * 0.3 * (i % 2)]);
      }
      bang.push([P.R * 1.0, -hc - P.R * 0.15], [P.R * 0.5, -hc - P.R - 4], [-P.R * 0.5, -hc - P.R - 4]);
      head += `<path d="${poly(bang)}" fill="${hairC}" ${c.st}/>`;
      [-1, 1].forEach((s) => { head += `<path d="${poly([[s * P.R * 0.7, -hc], [s * P.R * 0.98, -hc + 4], [s * P.R * 1.05 + sw * 0.5, 40], [s * P.R * 0.9 + sw, 72], [s * P.R * 0.62 + sw * 0.6, 44], [s * P.R * 0.6, 4]])}" fill="${hairC}" ${c.st}/>`; });
      body.push(G(rg.head, head));
      // flakes of him drifting away (heavier while he erases)
      const re = rr('flakes');
      const count = 7 + Math.round((ph.glitch + ph.dis) * 22);
      for (let i = 0; i < count; i++) {
        const src = [120 + re.range(-44, 44), lerp(GROUND - re.range(14, 40), re.range(80, 300), ph.dis)];
        const p2 = (t * (1 + (i % 3)) + re()) % 1;
        const x = src[0] + p2 * re.range(-10, 46), y = src[1] - p2 * re.range(30, 110), s = re.range(2.5, 6) * (1 - p2 * 0.6);
        fxF.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(s)}" height="${f(s)}" fill="${i % 4 === 0 ? c.accent : PAL.ink}" opacity="${f((1 - p2) * 0.9)}"/>`);
      }
      return { back: back.join(''), body: body.join(''), front: fxF.join(''), glitch: ph.glitch, vanish: anim === 'ability' ? { dis: ph.dis, reveal: ph.reveal } : null };
    }
  };

  // ---------------- MOINERA · Dream / Imagination ----------------
  const DREAMS = ['bubbles', 'stars', 'paint', 'moons'];
  const DREAM_ACCENT = { bubbles: PAL.dream, stars: PAL.cyan, paint: PAL.ember, moons: PAL.gold };
  const ITEM_FOR = { bubbles: 'parasol', stars: 'lantern', paint: 'brush', moons: 'key' };
  function dreamAt(v, t, anim) {
    const start = DREAMS.indexOf(v.dream);
    if (anim !== 'ability') return { dream: v.dream, pop: 0 };
    const q = t * 4, i = Math.floor(q), u = q - i;
    return { dream: DREAMS[(start + i) % 4], pop: Math.max(0, 1 - u / 0.12) + Math.max(0, (u - 0.9) / 0.1) };
  }
  // her staff turns into whatever the dream needs; hilt at the hand (origin), staff straight up/down
  function dreamItem(c, form, accent, t, pop) {
    const sc = 1 - pop * 0.55;
    let top = '';
    const shaft = `<rect x="-2.2" y="-118" width="4.4" height="186" rx="2" fill="${c.ink}" ${c.st}/>`;
    if (form === 'parasol') {
      const y = -118;
      let scal = '';
      for (let i = 0; i < 6; i++) scal += ` Q${-38 + i * 15 + 7.5} ${y + 22} ${-38 + (i + 1) * 15} ${y + 16}`;
      top = `<path d="M-46 ${y + 16} Q0 ${y - 46} 46 ${y + 16}${scal.replace(/-38/g, '-46')}Z" fill="${c.ink}" ${c.st}/>`;
      top = `<path d="M-45 ${y + 16} Q0 ${y - 46} 45 ${y + 16}` + Array.from({ length: 6 }, (_, i) => ` Q${f(45 - i * 15 - 7.5)} ${y + 24} ${f(45 - (i + 1) * 15)} ${y + 16}`).join('') + `Z" fill="${c.ink}" ${c.st}/>` +
        [-30, -10, 10, 30].map((x) => `<path d="M0 ${y - 14} Q${x * 0.6} ${y - 6} ${x} ${y + 16}" fill="none" stroke="${c.line}" stroke-width="1.2"/>`).join('') +
        `<path d="M-45 ${y + 16}` + Array.from({ length: 6 }, (_, i) => ` Q${f(-45 + i * 15 + 7.5)} ${y + 24} ${f(-45 + (i + 1) * 15)} ${y + 16}`).join('') + `" fill="none" stroke="${accent}" stroke-width="2"/>` +
        `<circle cx="0" cy="${y - 16}" r="3" fill="${accent}"/>`;
    } else if (form === 'brush') {
      const y = -118;
      const drip = (wave(t, 2) + 1) * 6;
      top = `<rect x="-5" y="${y - 2}" width="10" height="12" fill="${c.bone}" ${c.stBone}/><path d="M-9 ${y} Q-12 ${y - 26} 0 ${y - 44} Q12 ${y - 26} 9 ${y}Z" fill="${accent}" ${c.st}/>` +
        `<path d="M-3 ${y - 2} q2 ${f(10 + drip)} 4 0" fill="${accent}"/>`;
    } else if (form === 'key') {
      const y = -118;
      top = `<circle cx="0" cy="${y - 14}" r="17" fill="${c.ink}" ${c.st}/><circle cx="0" cy="${y - 14}" r="9" fill="${c.bone}" ${c.stBone}/><circle cx="0" cy="${y - 14}" r="4" fill="${accent}"/>` +
        [0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${f(Math.cos(i * TAU / 6) * 17)}" cy="${f(y - 14 + Math.sin(i * TAU / 6) * 17)}" r="3.5" fill="${c.ink}" ${c.st}/>`).join('') +
        `<path d="M2 50 h14 v6 h-6 v6 h6 v6 h-14Z" fill="${c.ink}" ${c.st}/>`;
    } else if (form === 'lantern') {
      const y = -118, sw = wave(t, 1) * 10;
      top = `<path d="M0 ${y} q14 -10 22 2" fill="none" stroke="${c.ink}" stroke-width="3"/>` +
        G(mul(T(22, y + 2), R(sw)), `<line x1="0" y1="0" x2="0" y2="10" stroke="${c.ink}" stroke-width="1.6"/><path d="M-9 10 h18 l-3 26 h-12Z" fill="${c.ink}" ${c.st}/><ellipse cx="0" cy="23" rx="5" ry="8" fill="${accent}"/><path d="M-9 10 h18 M-7 36 h14" stroke="${c.line}" stroke-width="2"/>`);
    }
    return `<g transform="scale(${f(sc)})">${shaft}${top}</g>`;
  }
  function mote(kind, x, y, a, s, accent, r) {
    if (kind === 'bubbles') return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}" fill="none" stroke="${accent}" stroke-width="1.5" opacity="${a}"/><circle cx="${f(x - s * 0.35)}" cy="${f(y - s * 0.35)}" r="${f(s * 0.2)}" fill="${accent}" opacity="${a}"/>`;
    if (kind === 'stars') { const k = s * 0.8; return `<path d="M${f(x)} ${f(y - k)} L${f(x + k * 0.3)} ${f(y - k * 0.3)} L${f(x + k)} ${f(y)} L${f(x + k * 0.3)} ${f(y + k * 0.3)} L${f(x)} ${f(y + k)} L${f(x - k * 0.3)} ${f(y + k * 0.3)} L${f(x - k)} ${f(y)} L${f(x - k * 0.3)} ${f(y - k * 0.3)}Z" fill="${accent}" opacity="${a}"/>`; }
    if (kind === 'paint') return `<path d="${smooth(Array.from({ length: 7 }, (_, i) => { const an = i / 7 * TAU, rr = s * r.range(0.6, 1.2); return [x + Math.cos(an) * rr, y + Math.sin(an) * rr]; }))}" fill="${accent}" opacity="${a}"/>`;
    return `<path d="M${f(x)} ${f(y - s)} A${f(s)} ${f(s)} 0 1 0 ${f(x)} ${f(y + s)} A${f(s * 0.75)} ${f(s * 0.75)} 0 1 1 ${f(x)} ${f(y - s)}Z" fill="${accent}" opacity="${a}"/>`;
  }
  const moinera = {
    id: 'moinera', name: 'Moinera', concept: 'Dream · Imagination', accent: PAL.dream,
    titles: ['Infinite Dream Mother', 'Unbound Dream'],
    frames: { idle: 32, ability: 64 },
    variants: {
      horns: ['no', 'yes'],
      item: ['shifting', 'none', 'parasol', 'brush'],
      dream: ['bubbles', 'stars', 'paint', 'moons']
    },
    anims: { idle: 'Idle', ability: 'Shift dream' },
    accentAt(t, anim, v) { return DREAM_ACCENT[dreamAt(v, t, anim).dream]; },
    P: { torso: 56, neck: 7, R: 36, shW: 21, shY: 7, upper: 38, fore: 36, hipW: 11, thigh: 66, shin: 64, hipY: GROUND - 12 - 130 },
    pose(t, anim, v) {
      const b = wave(t), e = anim === 'ability' ? 0.75 + wave(t, 4) * 0.25 : 0;
      const holds = v.item !== 'none';
      const { pop } = dreamAt(v, t, anim);
      return {
        x: lerp(wave(t, 1) * 1.5, 0, e), y: lerp(b * 1, -16 + wave(t, 2) * 4, e) - pop * 4,
        hip: lerp(5 + wave(t, 1, 0.1) * 2, wave(t, 2) * 3, e), lean: lerp(-7, 0, e), neck: lerp(4, -4, e), head: lerp(6 + wave(t, 1, 0.2) * 2, -8 + wave(t, 2) * 4, e),
        lSh: lerp(36, 62 + wave(t, 2) * 5, e), lEl: lerp(98, -40, e), lWr: lerp(0, -10, e),
        rSh: holds ? lerp(28, 46, e) + b : lerp(84 + b * 2, 62, e), rEl: holds ? lerp(-34, -50, e) : lerp(-118 + wave(t, 2) * 4, -40, e), rWr: holds ? 0 : lerp(10, -10, e),
        lHip: lerp(8, 4, e), rHip: lerp(4, 2, e), lKnee: lerp(0, -16, e), rKnee: lerp(0, 22, e), lFoot: -10, rFoot: 8
      };
    },
    draw(c, rg, v, t, anim, rr) {
      const P = this.P, e = anim === 'ability' ? 0.75 + wave(t, 4) * 0.25 : 0;
      const { dream, pop } = dreamAt(v, t, anim);
      const accent = c.accent;
      const back = [], body = [], fxB = [], fxF = [];
      const hc = P.R * 0.92;
      const hairC = c.hair('black');
      const rh = rr('hair');
      const sw = wave(t, 1, 0.1) * 4, lift = e;
      // long loose black hair; it lifts and fans out while she dreams
      const len = lerp(150, 100, lift), spread = P.R * (1.3 + lift * 0.5);
      const hp = [[-P.R * 0.95, -hc - P.R * 0.2], [-spread * 0.95 + sw * 0.3, -hc + 30], [-spread + sw, -hc + len * 0.6]];
      for (let i = 0; i <= 11; i++) {
        const k = i / 11;
        hp.push([lerp(-spread, spread, k) + sw * 1.2 + wave(t, 1, k) * lift * 10, -hc + len - lift * Math.abs(k - 0.5) * 60 + (i % 2 ? rh.range(10, 24) : rh.range(-4, 4)) + wave(t, 1, k * 2) * 3]);
      }
      hp.push([spread + sw, -hc + len * 0.6], [spread * 0.95 + sw * 0.3, -hc + 30], [P.R * 0.95, -hc - P.R * 0.2], [0, -hc - P.R - 6]);
      back.push(G(rg.head, `<path d="${smooth(hp, true, 0.1)}" fill="${hairC}" ${c.st}/>`));
      if (v.horns === 'yes') back.push(G(rg.head, [-1, 1].map((s) => `<path d="M${s * 8} ${f(-hc - P.R * 0.8)} Q${s * 16} ${f(-hc - P.R - 26)} ${s * 24} ${f(-hc - P.R - 36)} Q${s * 26} ${f(-hc - P.R - 10)} ${s * 21} ${f(-hc - P.R * 0.6)}Z" fill="${PAL.ember}" ${c.st}/>`).join('')));
      // the item stands behind her body; her hand closes over the shaft
      const form = v.item === 'shifting' ? ITEM_FOR[dream] : v.item;
      if (v.item !== 'none') {
        const h = pt(rg.R.hand, 0, 6);
        back.push(`<g transform="translate(${f(h[0])} ${f(h[1])}) rotate(${f(wave(t, 1, 0.3) * 3)})">${dreamItem(c, form, accent, t, v.item === 'shifting' ? pop : 0)}</g>`);
      }
      body.push(legs(c, rg, P, { pant: [28, 23, 46], shoe: 'platform', fill: c.ink }));
      const skin = c.pale;
      let tor = `<path d="M-13 -2 Q-12 ${-P.torso * 0.35} -10 ${-P.torso * 0.45} L10 ${-P.torso * 0.45} Q12 ${-P.torso * 0.35} 13 -2Z" fill="${skin}" ${c.stBone}/>`;
      tor += `<path d="M-15 ${-P.torso * 0.42} L-19 ${-P.torso + 7} Q0 ${-P.torso - 3} 19 ${-P.torso + 7} L15 ${-P.torso * 0.42} Q0 ${-P.torso * 0.36} -15 ${-P.torso * 0.42}Z" fill="${c.bone}" ${c.stBone}/>`;
      tor += `<rect x="-16" y="-5" width="32" height="6" rx="1" fill="${c.ink}" ${c.st}/><rect x="-3" y="-5" width="6" height="6" fill="${accent}"/>`;
      tor += `<path d="M-6 ${-P.torso + 8} L0 ${-P.torso + 16} L6 ${-P.torso + 8}" fill="none" stroke="${PAL.ink}" stroke-width="1.6"/>`;
      body.push(G(rg.torso, tor));
      body.push(arm(c, rg.L, P, { sleeve: [12, 11, 10], fill: skin, hand: 'relaxed', handFill: skin }, -1, t));
      body.push(arm(c, rg.R, P, { sleeve: [12, 11, 10], fill: skin, hand: v.item !== 'none' ? 'relaxed' : (e > 0.4 ? 'open' : 'peace'), handFill: skin }, 1, t));
      // head: pale face, gold anime eyes (closed while she dreams hard)
      let head = `<rect x="-5" y="-6" width="10" height="10" fill="${skin}" ${c.stBone}/><rect x="-6" y="-4" width="12" height="4" fill="${c.ink}"/>` +
        `<path d="M${-P.R * 0.84} ${f(-hc - 6)} Q${-P.R * 0.86} ${f(-hc + P.R * 0.6)} 0 ${f(-hc + P.R * 0.98)} Q${P.R * 0.86} ${f(-hc + P.R * 0.6)} ${P.R * 0.84} ${f(-hc - 6)} Q0 ${f(-hc - P.R * 1.05)} ${-P.R * 0.84} ${f(-hc - 6)}Z" fill="${skin}" ${c.stBone}/>`;
      const ey = -hc + 6, open = blinkAt(t, 0.7);
      const kind = pop > 0.3 ? 'sleep' : 'anime';
      head += eye(-P.R * 0.36, ey, 6.5, kind, kind === 'sleep' ? c.inkLine : PAL.gold, -1, open, c) + eye(P.R * 0.36, ey, 6.5, kind, kind === 'sleep' ? c.inkLine : PAL.gold, 1, open, c);
      head += `<path d="M-5 ${f(-hc + P.R * 0.55)} Q0 ${f(-hc + P.R * 0.68)} 6 ${f(-hc + P.R * 0.52)}" fill="none" stroke="${PAL.ink}" stroke-width="1.5"/><path d="M2 ${f(-hc + P.R * 0.6)} l1.5 3.5 l1.5 -3.8z" fill="${PAL.bone}"/>`;
      const rb = rr('bangs');
      const bang = [[-P.R * 0.98, -hc + 8]];
      for (let i = 0; i <= 8; i++) bang.push([lerp(-P.R * 0.95, P.R * 0.95, i / 8), -hc - 6 + (i % 2 ? rb.range(-2, 4) : rb.range(-14, -8)) - lift * 4]);
      bang.push([P.R * 0.98, -hc + 8], [P.R * 0.9, -hc - P.R * 0.7], [0, -hc - P.R - 6], [-P.R * 0.9, -hc - P.R * 0.7]);
      head += `<path d="${poly(bang)}" fill="${hairC}" ${c.st}/>`;
      [-1, 1].forEach((s) => { head += `<path d="M${s * P.R * 0.9} ${f(-hc - 4)} Q${s * (P.R + 4)} ${f(-hc + 30)} ${s * (P.R * 0.8) + sw * 0.6} ${f(-hc + lerp(70, 30, lift))} L${s * P.R * 0.62} ${f(-hc + 10)}Z" fill="${hairC}" ${c.st}/>`; });
      body.push(G(rg.head, head));
      // the dream of the moment drifts around her
      const rd = rr('motes');
      const n = 8 + Math.round(e * 16);
      for (let i = 0; i < n; i++) {
        const p2 = (t * (anim === 'ability' ? 2 : 1) * (i % 2 ? 1 : 2) + rd()) % 1;
        const x = 120 + rd.range(-104, 104) + wave(t, 1, rd()) * 8;
        const y = dream === 'paint' ? lerp(20, H - 10, p2) : lerp(H - 10, 20, p2);
        const a = f(Math.sin(p2 * Math.PI) * (0.5 + e * 0.5) * (1 - pop * 0.7));
        (i % 2 ? fxF : fxB).push(mote(dream, x, y, a, rd.range(3, 9), accent, rd));
      }
      if (pop > 0.05) fxB.push(`<circle cx="120" cy="120" r="${f(30 + (1 - pop) * 120)}" fill="none" stroke="${accent}" stroke-width="${f(pop * 6)}" opacity="${f(pop)}"/>`);
      if (e > 0.02) fxB.push(`<ellipse cx="120" cy="${GROUND - 2}" rx="${f(30 - e * 8)}" ry="5" fill="${PAL.ink}" opacity="${f(0.4 * e)}"/>`);
      return { back: fxB.join('') + back.join(''), body: body.join(''), front: fxF.join('') };
    }
  };

  // ---------------- UNIVERSE · Chaos ----------------
  const PLANETS = ['ringed', 'cratered', 'molten'];
  function planet(c, kind, r, t, crack) {
    if (r <= 0.3) return '';
    let s = '';
    const id = kind;
    if (kind === 'ringed') {
      s = `<path d="M${f(-r * 1.9)} 0 A${f(r * 1.9)} ${f(r * 0.5)} -12 0 0 ${f(r * 1.9)} 0" fill="none" stroke="${c.accent}" stroke-width="${f(r * 0.18)}" transform="rotate(-14)"/>` +
        `<circle r="${f(r)}" fill="${PAL.bone}" ${c.stBone}/><path d="M${f(-r)} ${f(-r * 0.2)} Q0 ${f(r * 0.05)} ${f(r)} ${f(-r * 0.3)} M${f(-r * 0.9)} ${f(r * 0.35)} Q0 ${f(r * 0.55)} ${f(r * 0.9)} ${f(r * 0.3)}" fill="none" stroke="#8d877a" stroke-width="${f(r * 0.12)}"/>` +
        `<path d="M${f(-r * 1.9)} 0 A${f(r * 1.9)} ${f(r * 0.5)} -12 0 1 ${f(r * 1.9)} 0" fill="none" stroke="${c.accent}" stroke-width="${f(r * 0.18)}" transform="rotate(-14)"/>`;
    } else if (kind === 'cratered') {
      s = `<circle r="${f(r)}" fill="#c9c4bb" ${c.stBone}/>` + [[-0.35, -0.3, 0.28], [0.4, 0.1, 0.22], [-0.1, 0.45, 0.18], [0.2, -0.5, 0.12]].map(([x, y, k]) => `<circle cx="${f(x * r)}" cy="${f(y * r)}" r="${f(k * r)}" fill="#5c5a62"/>`).join('');
    } else {
      s = `<circle r="${f(r)}" fill="${PAL.ink}" ${c.st}/>` + `<path d="M${f(-r * 0.8)} ${f(-r * 0.2)} L${f(-r * 0.2)} 0 L${f(r * 0.1)} ${f(-r * 0.6)} M${f(-r * 0.2)} 0 L${f(r * 0.3)} ${f(r * 0.5)} L${f(r * 0.85)} ${f(r * 0.2)}" fill="none" stroke="${c.accent}" stroke-width="${f(r * 0.13)}"/>`;
    }
    if (crack > 0) {
      s += `<path d="M0 0 L${f(r * 0.9)} ${f(-r * 0.3)} M0 0 L${f(-r * 0.5)} ${f(-r * 0.8)} M0 0 L${f(-r * 0.6)} ${f(r * 0.7)} M0 0 L${f(r * 0.3)} ${f(r * 0.95)}" stroke="${PAL.bone}" stroke-width="${f(1 + crack * 1.6)}" opacity="${f(crack)}"/>` +
        `<circle r="${f(r * (1.1 + crack * 0.5))}" fill="none" stroke="${c.accent}" stroke-width="${f(crack * 3)}" opacity="${f(crack * 0.8)}"/>`;
    }
    return s;
  }
  const universe = {
    id: 'universe', name: 'Universe', concept: 'Chaos · Building Block', accent: PAL.ember,
    titles: [],
    frames: { idle: 32, ability: 72 },
    variants: {
      eyes: ['shades', 'ring', 'spiral'],
      scar: ['no', 'yes'],
      suit: ['ink', 'bone'],
      planet: ['ringed', 'cratered', 'molten']
    },
    anims: { idle: 'Idle', ability: 'Unmake & remake' },
    // two cycles per loop: A explodes and B is made, then B explodes and A is made
    phase(t, v) {
      const half = t < 0.5 ? 0 : 1, u = (t * 2) % 1;
      const a = v.planet, b = PLANETS[(PLANETS.indexOf(a) + 1) % 3];
      const cur = half ? b : a, next = half ? a : b;
      return {
        u, cur, next,
        crack: smoothstep(0.02, 0.2, u) * (u < 0.24 ? 1 : 0),
        boom: u >= 0.2 && u < 0.34 ? 1 - (u - 0.2) / 0.14 : 0,
        laugh: smoothstep(0.22, 0.3, u) * (1 - smoothstep(0.78, 0.86, u)),
        out: smoothstep(0.2, 0.36, u), absorb: smoothstep(0.6, 0.8, u), make: smoothstep(0.8, 0.98, u)
      };
    },
    P: { torso: 64, neck: 6, R: 38, shW: 28, shY: 9, upper: 40, fore: 38, hipW: 12, thigh: 54, shin: 54, hipY: GROUND - 6 - 108 },
    pose(t, anim, v) {
      const b = wave(t);
      const ph = anim === 'ability' ? this.phase(t, v) : { laugh: 0, absorb: 0, crack: 0, u: 0 };
      const laugh = ph.laugh, shake = laugh * wave(t, 18) * 2.5;
      return {
        y: b * 1.4 + shake * 0.6 + ph.crack * wave(t, 30) * 0.8, hip: -3 + wave(t, 1, 0.25), lean: lerp(4 + b * 0.8, -6, laugh) + ph.absorb * (1 - ph.make) * 4 * (1 - laugh),
        neck: lerp(10, -10, laugh), head: lerp(6 + wave(t, 1, 0.3) * 2, -16 + shake * 2, laugh),
        lSh: lerp(26, 60, laugh) + b, lEl: lerp(50, -30, laugh), lWr: 0,
        rSh: lerp(12 + b, 78 - shake, laugh), rEl: lerp(18, -20, laugh), rWr: lerp(0, -20, laugh),
        lHip: 8, rHip: 3, lFoot: -10, rFoot: 6
      };
    },
    draw(c, rg, v, t, anim, rr) {
      const P = this.P;
      const ab = anim === 'ability';
      const ph = ab ? this.phase(t, v) : null;
      const laugh = ph ? ph.laugh : 0;
      const back = [], body = [], fxB = [], fxF = [];
      const hc = P.R * 0.92;
      const suit = v.suit === 'bone' ? c.bone : c.ink, suitSt = v.suit === 'bone' ? c.stBone : c.st;
      body.push(legs(c, rg, P, { pant: [23, 20, 19], shoe: 'plain', fill: suit }));
      let tor = `<path d="M-22 -4 L-25 ${-P.torso + 9} Q0 ${-P.torso - 4} 25 ${-P.torso + 9} L22 -4 Q0 4 -22 -4Z" fill="${v.suit === 'bone' ? c.ink : c.bone}" ${v.suit === 'bone' ? c.st : c.stBone}/>`;
      tor += `<path d="M-7 ${-P.torso + 2} L0 ${-P.torso + 22} L7 ${-P.torso + 2}" fill="${c.skin}" ${c.st}/>`;
      [-1, 1].forEach((s) => {
        tor += `<path d="${poly([[s * (P.shW + 3), -P.torso + 7], [s * 9, -P.torso + 1], [s * 13, -P.torso * 0.5], [s * 10, -P.torso * 0.12], [s * 12, 12], [s * 30, 14], [s * 31, -P.torso * 0.3]])}" fill="${suit}" ${suitSt}/>` +
          `<path d="M${s * 9} ${-P.torso + 2} L${s * 19} ${-P.torso * 0.6} L${s * 13} ${-P.torso * 0.52}" fill="none" stroke="${c.line}" stroke-width="1.6"/>`;
      });
      body.push(G(rg.torso, tor));
      body.push(arm(c, rg.L, P, { sleeve: [22, 19, 18], fill: suit, hand: 'open', handFill: c.skin }, -1, t));
      // head: Spike's messy spikes, the grin
      let head = `<rect x="-6" y="-6" width="12" height="10" fill="${c.skin}" ${c.st}/><ellipse cx="0" cy="${f(-hc)}" rx="${f(P.R * 0.86)}" ry="${f(P.R)}" fill="${c.skin}" ${c.st}/>`;
      const hp = spikeArc(0, -hc - 3, P.R * 1.02, P.R * 1.05, Math.PI * 0.98, Math.PI * 2.02, 8, 0.15, 0.42, rr('hair'), 0.04 + laugh * 0.12, t * (1 + laugh * 3));
      hp.push([P.R * 0.8, -hc + 6], [P.R * 0.5, -hc - P.R * 0.3], [P.R * 0.1, -hc - P.R * 0.12], [-P.R * 0.2, -hc - P.R * 0.38], [-P.R * 0.6, -hc - P.R * 0.08], [-P.R * 0.84, -hc + 8]);
      head += `<path d="${poly(hp)}" fill="${c.ink}" ${c.st}/>`;
      const ey = -hc + 2, open = blinkAt(t, 0.55);
      if (v.eyes === 'shades') {
        head += [-1, 1].map((s) => `<path d="M${s * 3} ${f(ey - 5)} L${s * 22} ${f(ey - 6)} Q${s * 21} ${f(ey + 7)} ${s * 12} ${f(ey + 6)} Q${s * 4} ${f(ey + 6)} ${s * 3} ${f(ey - 5)}Z" fill="${PAL.void}" stroke="#55565e" stroke-width="1.6"/>`).join('') +
          `<line x1="-22" y1="${f(ey - 5.5)}" x2="22" y2="${f(ey - 5.5)}" stroke="#55565e" stroke-width="1.6"/><path d="M${-16 + laugh * 4} ${f(ey - 2)} l4 -2" stroke="${c.accent}" stroke-width="2"/>`;
      } else head += eye(-P.R * 0.34, ey, 8 + laugh * 2, v.eyes, c.accent, -1, open, c) + eye(P.R * 0.34, ey, 8 + laugh * 2, v.eyes, c.accent, 1, open, c);
      const gw = 15 + laugh * 5, gy = -hc + P.R * 0.46, gh = 5 + laugh * 7;
      head += `<path d="M${-gw} ${f(gy - 2)} Q0 ${f(gy + gh * 1.6)} ${gw} ${f(gy - 3)} Q0 ${f(gy + 3)} ${-gw} ${f(gy - 2)}Z" fill="${PAL.bone}" stroke="${PAL.ink}" stroke-width="1.4"/>`;
      for (let i = -3; i <= 3; i++) head += `<line x1="${f(i * gw / 4)}" y1="${f(gy - 1)}" x2="${f(i * gw / 4)}" y2="${f(gy + gh * (1 - Math.abs(i) / 5))}" stroke="${PAL.ink}" stroke-width="1"/>`;
      if (v.scar === 'yes') head += [-1, 1].map((s) => `<path d="M${s * gw} ${f(gy - 2)} l${s * 6} -4 m${-s * 3} 0 l1 3 m${s * 2} -4 l1 3" fill="none" stroke="${PAL.ember}" stroke-width="1.5"/>`).join('');
      body.push(G(rg.head, head));
      body.push(arm(c, rg.R, P, { sleeve: [22, 19, 18], fill: suit, hand: laugh > 0.3 ? 'open' : 'relaxed', handFill: c.skin }, 1, t));
      // the planet over his left palm
      const palm = pt(rg.L.hand, 0, 6);
      const pc = [palm[0] - 4, palm[1] - 24 + wave(t, 1) * 2];
      if (!ab) fxF.push(`<g transform="translate(${f(pc[0])} ${f(pc[1])}) rotate(${f(t * 360)})">${planet(c, v.planet, 15, t, 0)}</g>`);
      else {
        const tremble = ph.crack * wave(t, 40) * 1.5;
        if (ph.u < 0.22) fxF.push(`<g transform="translate(${f(pc[0] + tremble)} ${f(pc[1])})">${planet(c, ph.cur, 15 * (1 + ph.crack * 0.15), t, ph.crack)}</g>`);
        if (ph.boom > 0) fxF.push(`<circle cx="${f(pc[0])}" cy="${f(pc[1])}" r="${f(16 + (1 - ph.boom) * 70)}" fill="${PAL.bone}" opacity="${f(ph.boom * 0.85)}"/><circle cx="${f(pc[0])}" cy="${f(pc[1])}" r="${f(10 + (1 - ph.boom) * 90)}" fill="none" stroke="${c.accent}" stroke-width="${f(ph.boom * 5)}"/>`);
        if (ph.make > 0) fxF.push(`<g transform="translate(${f(pc[0])} ${f(pc[1])}) rotate(${f(t * 720)})">${planet(c, ph.next, 15 * ph.make, t, 0)}<circle r="${f(15 + (1 - ph.make) * 22)}" fill="none" stroke="${c.accent}" stroke-width="1.4" opacity="${f(1 - ph.make)}" stroke-dasharray="3 4"/></g>`);
        // debris: blown out, circling him in glitchy steps, swallowed, spat back into a new world
        const rs = rr('shards'), core = [120, 186];
        const step = Math.floor(t * 24);
        if (ph.out > 0 && ph.make < 1) {
          for (let i = 0; i < 22; i++) {
            const a0 = rs() * TAU, ro = rs.range(62, 112), spin = (i % 2 ? 1 : -0.7) * rs.range(0.6, 1.2);
            const blast = [pc[0] + Math.cos(a0) * ro * 0.7 * ph.out, pc[1] + Math.sin(a0) * ro * 0.7 * ph.out];
            const a = a0 + spin * TAU * ph.u * 1.4;
            const k = 1 - ph.absorb;
            const orbit = [core[0] + Math.cos(a) * ro * k, core[1] + Math.sin(a) * ro * 0.9 * k];
            const blend = smoothstep(0.28, 0.42, ph.u);
            let x = lerp(blast[0], orbit[0], blend), y = lerp(blast[1], orbit[1], blend);
            // glitch: shards snap to jittered positions in steps
            const jr = rng(hash('j' + i + '|' + step));
            if (jr() < 0.35) { x += jr.range(-8, 8); y += jr.range(-5, 5); }
            const toPalm = ph.make;
            x = lerp(x, pc[0], toPalm); y = lerp(y, pc[1], toPalm);
            const s = rs.range(5, 13) * (1 - ph.absorb * 0.75) * (1 - toPalm);
            if (s < 0.6) continue;
            const rot = step * 37 * (i % 3 + 1) + i * 40;
            const fill = i % 3 ? PAL.ink : c.accent;
            const shard = `<path d="M0 ${f(-s)} L${f(s * 0.6)} ${f(s * 0.7)} L${f(-s * 0.7)} ${f(s * 0.4)}Z" transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})" fill="${fill}" ${i % 3 ? c.st : ''}/>`;
            (i % 2 ? fxF : fxB).push(shard);
            if (jr() < 0.2) fxB.push(`<path d="M0 ${f(-s)} L${f(s * 0.6)} ${f(s * 0.7)} L${f(-s * 0.7)} ${f(s * 0.4)}Z" transform="translate(${f(x + 6)} ${f(y)}) rotate(${f(rot)})" fill="${c.accent}" opacity="0.6"/>`);
          }
          let d = '', a = 0;
          const rsc = rr('scribble');
          for (let i = 0; i < 40; i++) { a += rsc.range(0.3, 1.4); const rad = 62 + rsc.range(-12, 12) + wave(t, 6, i * 0.05) * 4; d += (i ? 'L' : 'M') + f(120 + Math.cos(a) * rad) + ' ' + f(112 + Math.sin(a) * rad * 0.7); }
          fxB.push(`<path d="${d}" fill="none" stroke="${c.accent}" stroke-width="1.2" opacity="${f(laugh * 0.7)}"/>`);
        }
      }
      return { back: fxB.join('') + back.join(''), body: body.join(''), front: fxF.join(''), split: ab ? laugh * 0.9 + (ph.absorb * (1 - ph.make)) * 0.4 : 0 };
    }
  };

  // ---------------- FATE · the thing behind Antholonious ----------------
  // A drawn hand: wrist at the origin, fingers pointing up (-y). Knuckles, finger joints,
  // nails, palm creases and a ragged ghostly wrist. curl 0 = open, 1 = pinching/gripping.
  function fseg(len, w1, w2, fill, st) {
    const a = w1 / 2, b = w2 / 2;
    return `<path d="M${f(-a)} 0 L${f(-b)} ${f(-len)} A${f(b)} ${f(b)} 0 0 1 ${f(b)} ${f(-len)} L${f(a)} 0 Z" fill="${fill}" ${st}/>`;
  }
  const FINGERS = [
    { x: -10.2, len: 31, w: 6.2, a: -8 },
    { x: -3.5, len: 37, w: 6.6, a: -2 },
    { x: 3.5, len: 35, w: 6.4, a: 3 },
    { x: 10, len: 27, w: 5.6, a: 10 }
  ];
  function fateHand(k, o) {
    // k: { fill, line, nail, accent }; o: { curl, palmEye, wisp, t }
    const curl = o.curl || 0, st = `stroke="${k.line}" stroke-width="${k.lw}" stroke-linejoin="round"`;
    let s = '';
    if (o.wisp !== false) {
      const w = wave(o.t || 0, 1) * 3;
      s += `<path d="M-13 -2 Q${f(-18 + w)} 18 ${f(-10 + w)} 34 Q${f(-4 + w)} 26 ${f(-1 + w * 1.4)} 46 Q${f(4 + w)} 28 ${f(10 + w)} 38 Q${f(15 + w)} 16 13 -2Z" fill="${k.fill}" ${st} opacity="0.75"/>` +
        `<path d="M-12 2 Q0 6 12 2" fill="none" stroke="${k.line}" stroke-width="1"/>`;
    }
    // fingers first; the palm overlaps their roots
    FINGERS.forEach((fg) => {
      const spread = fg.a * (1.25 - curl * 0.9);
      const l1 = fg.len * 0.52, l2 = fg.len * 0.48 * (1 - curl * 0.55);
      const base = mul(T(fg.x, -26), R(spread));
      const mid = mul(base, T(0, -l1 + 1), R(spread * 0.25));
      let seg = G(base, fseg(l1, fg.w, fg.w * 0.9, k.fill, st)) + G(mid, fseg(l2, fg.w * 0.9, fg.w * 0.78, k.fill, st));
      // joint creases
      seg += G(mul(base, T(0, -l1 + 2)), `<path d="M${f(-fg.w * 0.32)} 0 Q0 1.6 ${f(fg.w * 0.32)} 0" fill="none" stroke="${k.line}" stroke-width="0.9"/>`);
      seg += G(mul(mid, T(0, -l2 * 0.45)), `<path d="M${f(-fg.w * 0.26)} 0 Q0 1.2 ${f(fg.w * 0.26)} 0" fill="none" stroke="${k.line}" stroke-width="0.8"/>`);
      // nail (hidden once the finger curls over)
      if (curl < 0.55) seg += G(mul(mid, T(0, -l2)), `<rect x="${f(-fg.w * 0.22)}" y="0.8" width="${f(fg.w * 0.44)}" height="${f(fg.w * 0.55)}" rx="1.4" fill="${k.nail}" stroke="${k.line}" stroke-width="0.7"/>`);
      else seg += G(mul(mid, T(0, -l2 + 2)), `<path d="M${f(-fg.w * 0.3)} 0 Q0 -2.4 ${f(fg.w * 0.3)} 0" fill="none" stroke="${k.line}" stroke-width="1.1"/>`);
      s += seg;
    });
    // thumb, from the side of the palm
    const tb = mul(T(13, -9), R(48 - curl * 34));
    const tm = mul(tb, T(0, -11), R(16 - curl * 24));
    s += G(tb, fseg(12, 9, 8, k.fill, st)) + G(tm, fseg(11, 8, 6.6, k.fill, st)) +
      G(mul(tm, T(0, -11)), `<rect x="-1.8" y="0.6" width="3.6" height="4.2" rx="1.4" fill="${k.nail}" stroke="${k.line}" stroke-width="0.7"/>`) +
      G(mul(tb, T(0, -11)), `<path d="M-3 1 Q0 2.4 3 1" fill="none" stroke="${k.line}" stroke-width="0.9"/>`);
    // palm with knuckle pads and creases
    s += `<path d="M-13 -1 C-16 -12 -16 -22 -14 -29 Q-7 -32 0 -31 Q8 -32 14 -28 C16 -20 16 -10 12 -1 Q0 3 -13 -1Z" fill="${k.fill}" ${st}/>`;
    s += FINGERS.map((fg) => `<path d="M${f(fg.x - 3)} -27 Q${f(fg.x)} -29.5 ${f(fg.x + 3)} -27" fill="none" stroke="${k.line}" stroke-width="0.8"/>`).join('');
    s += `<path d="M-13 -19 Q-3 -15 9 -24" fill="none" stroke="${k.line}" stroke-width="1"/>` +
      `<path d="M-11 -12 Q0 -9 12 -15" fill="none" stroke="${k.line}" stroke-width="1"/>` +
      `<path d="M7 -3 Q1 -12 3 -24" fill="none" stroke="${k.line}" stroke-width="1"/>` +
      `<path d="M10 -6 Q13 -10 13 -16" fill="none" stroke="${k.line}" stroke-width="0.8"/>`;
    if (o.palmEye) {
      const op = o.palmOpen == null ? 1 : o.palmOpen;
      s += `<g transform="translate(0 -14) scale(1 ${f(Math.max(0.1, op))})"><path d="M-9 0 Q0 -8 9 0 Q0 8 -9 0Z" fill="${k.nail}" stroke="${k.line}" stroke-width="1"/><circle r="3.6" fill="${k.accent}"/><circle r="1.4" fill="${PAL.ink}"/></g>`;
    }
    return s;
  }
  // world matrix + fingertip points for a hand
  function placeHand(x, y, rot, sc, mirror) {
    const m = mul(T(x, y), R(rot), S(sc * mirror, sc));
    return { m, tips: FINGERS.map((fg) => pt(m, fg.x + Math.sin(fg.a * Math.PI / 180) * fg.len, -26 - fg.len * Math.cos(fg.a * Math.PI / 180))), wrist: pt(m, 0, 0), palm: pt(m, 0, -14) };
  }

  // each form returns { back, front, strings: [[from, to, slack]] }
  function fateForm(kind, c, rg, P, t, e, lagX) {
    const pix = c.style === 'pixel';
    const k = pix
      ? { fill: '#2a2b33', line: '#8f8a80', nail: '#3a3b44', accent: c.accent, lw: 1.3 }
      : { fill: '#b9b2a3', line: '#24221e', nail: '#ece6d8', accent: c.accent, lw: 1.9 };
    const hc = P.R * 0.92;
    const headTop = pt(rg.head, 0, -hc - P.R * 0.9), neck = pt(rg.neck, 0, -1);
    const wristR = pt(rg.R.hand, 0, 2), wristL = pt(rg.L.hand, 0, 2);
    const shL = pt(rg.torso, -P.shW, -P.torso + 4), shR = pt(rg.torso, P.shW, -P.torso + 4);
    let back = '', front = '';
    const strings = [];
    const fx = 120 + lagX;

    if (kind === 'hands') {
      // a cracked porcelain mask with his one eye, and two great hands hovering at his sides
      const my = 50 + e * 10;
      back += `<g transform="translate(${f(fx)} ${f(my)})">` +
        `<path d="M-26 -30 Q0 -40 26 -30 Q32 -6 24 18 Q12 38 0 40 Q-12 38 -24 18 Q-32 -6 -26 -30Z" fill="${k.fill}" stroke="${k.line}" stroke-width="1.5"/>` +
        `<path d="M-20 -8 Q-10 -15 -3 -9 M20 -8 Q10 -15 3 -9" fill="none" stroke="${k.line}" stroke-width="1.6"/>` +
        `<g transform="scale(${f(1 + e * 0.3)} ${f(lerp(0.35, 1, e) * blinkAt(t, 0.3))})"><path d="M-12 0 Q0 -9 12 0 Q0 9 -12 0Z" fill="${PAL.ink}"/><circle r="4.6" fill="${c.accent}"/><circle r="1.8" fill="${PAL.ink}"/></g>` +
        `<path d="M-7 24 Q0 27 7 24" fill="none" stroke="${k.line}" stroke-width="1.4"/>` +
        `<path d="M6 -36 L2 -24 L9 -14 L4 -4" fill="none" stroke="${c.accent}" stroke-width="1.4"/>` +
        `<path d="M-22 12 L-14 16 L-16 26" fill="none" stroke="${c.accent}" stroke-width="1.2"/></g>`;
      [-1, 1].forEach((sd) => {
        const x = fx + sd * lerp(70, 48, e), y = lerp(150, 112, e) + wave(t, 1, sd * 0.15) * 4;
        const h = placeHand(x, y, sd * lerp(14, 34, e), 1.6, sd > 0 ? -1 : 1);
        back += G(h.m, fateHand(k, { curl: 0.15 + e * 0.35, t }));
        strings.push([h.tips[1], sd < 0 ? wristL : wristR, 14], [h.tips[2], sd < 0 ? shL : shR, 10]);
        if (sd > 0) strings.push([h.tips[0], headTop, 12]);
      });
    } else if (kind === 'eye') {
      // one vast eye opening above him; its threads fall like tears
      const cy = 72 + e * 6, w = 104 + e * 10, open = lerp(0.55, 1, e) * blinkAt(t, 0.2, 0.06);
      const hgt = 40 * open;
      const look = wave(t, 1, 0.1) * 16 * (1 - e);
      const ir = 26 + e * 4, pupilW = lerp(5, 2.5, e);
      let eyeSvg = `<path d="M${-w} 0 Q0 ${f(-hgt * 2.1)} ${w} 0 Q0 ${f(hgt * 2.1)} ${-w} 0Z" fill="${k.nail}" stroke="${k.line}" stroke-width="1.6"/>`;
      // veins from the corners
      const rv = rng(hash('veins'));
      for (let i = 0; i < 8; i++) {
        const sx = (i % 2 ? 1 : -1) * (w - 6), sy = rv.range(-6, 6);
        let d = `M${f(sx)} ${f(sy)}`, x = sx, y = sy;
        for (let j = 0; j < 4; j++) { x -= Math.sign(sx) * rv.range(6, 12); y += rv.range(-5, 5); d += ` L${f(x)} ${f(y * open)}`; }
        eyeSvg += `<path d="${d}" fill="none" stroke="${pix ? '#55565e' : PAL.ember}" stroke-width="0.9" opacity="0.7"/>`;
      }
      // iris: rings and striations
      let iris = `<circle r="${ir}" fill="${c.accent}" stroke="${k.line}" stroke-width="1.4"/><circle r="${f(ir * 0.72)}" fill="none" stroke="${k.line}" stroke-width="0.9" opacity="0.6"/>`;
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; iris += `<line x1="${f(Math.cos(a) * ir * 0.35)}" y1="${f(Math.sin(a) * ir * 0.35)}" x2="${f(Math.cos(a) * ir * 0.92)}" y2="${f(Math.sin(a) * ir * 0.92)}" stroke="${k.line}" stroke-width="0.7" opacity="0.55"/>`; }
      iris += `<ellipse rx="${f(pupilW)}" ry="${f(ir * 0.8)}" fill="${PAL.ink}"/><circle cx="-9" cy="-9" r="4" fill="${PAL.bone}" opacity="0.85"/>`;
      eyeSvg += `<clipPath id="fateEyeClip"><path d="M${-w} 0 Q0 ${f(-hgt * 2.1)} ${w} 0 Q0 ${f(hgt * 2.1)} ${-w} 0Z"/></clipPath><g clip-path="url(#fateEyeClip)"><g transform="translate(${f(look)} 0)">${iris}</g></g>`;
      // heavy upper lid with lashes, lower lid line
      eyeSvg += `<path d="M${-w - 6} 2 Q0 ${f(-hgt * 2.1 - 16)} ${w + 6} 2 Q0 ${f(-hgt * 2.1 - 2)} ${-w - 6} 2Z" fill="${pix ? '#2a2b33' : PAL.ink}" stroke="${k.line}" stroke-width="1"/>`;
      for (let i = 1; i < 14; i++) {
        const u = i / 14, x = lerp(-w, w, u), y = -hgt * 2.1 * 2 * u * (1 - u) * 1.02 - 6;
        const ang = lerp(-60, 60, u) * Math.PI / 180;
        eyeSvg += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + Math.sin(ang) * 12)}" y2="${f(y - Math.cos(ang) * 14)}" stroke="${pix ? '#55565e' : PAL.ink}" stroke-width="2" stroke-linecap="round"/>`;
      }
      eyeSvg += `<path d="M${-w + 8} 4 Q0 ${f(hgt * 2.1 + 6)} ${w - 8} 4" fill="none" stroke="${k.line}" stroke-width="1.2"/>`;
      back += `<g transform="translate(${f(fx)} ${f(cy)})">${eyeSvg}</g>`;
      if (e > 0.02) {
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; back += `<line x1="${f(fx + Math.cos(a) * (w + 12))}" y1="${f(cy + Math.sin(a) * (w * 0.6 + 6))}" x2="${f(fx + Math.cos(a) * (w + 12 + 16 * e))}" y2="${f(cy + Math.sin(a) * (w * 0.6 + 6 + 10 * e))}" stroke="${c.accent}" stroke-width="1.6" opacity="${f(e)}"/>`; }
      }
      const lid = (u) => [fx + lerp(-w, w, u) * 0.8, cy + hgt * 0.9 * Math.sin(u * Math.PI)];
      strings.push([lid(0.2), wristL, 8], [lid(0.4), shL, 4], [lid(0.6), shR, 4], [lid(0.8), wristR, 8]);
    } else if (kind === 'chains') {
      // two hands above him, pinching strings that wind around his neck
      const ny = neck[1];
      [-1, 1].forEach((sd) => {
        const x = fx + sd * lerp(46, 40, e), y = lerp(56, 40, e) + wave(t, 1, sd * 0.2) * 3;
        const h = placeHand(x, y, 180 + sd * -18, 1.3, sd > 0 ? -1 : 1);
        back += G(h.m, fateHand(k, { curl: 0.75, t }));
        // pinched between thumb and index
        const pinch = pt(h.m, 6, -42);
        const tgt = [neck[0] + sd * 15, ny + 2];
        strings.push([pinch, tgt, lerp(10, 0, e)]);
      });
      // the coils: the back half sits behind his neck, the front half over it
      for (let i = 0; i < 3; i++) {
        const y = ny + 4 - i * 5 - e * 2, rx = 17 - i * 1.5 - e * 2, ry = 4.5;
        back += `<path d="M${f(neck[0] - rx)} ${f(y)} A${f(rx)} ${f(ry)} 0 0 1 ${f(neck[0] + rx)} ${f(y)}" fill="none" stroke="${c.accent}" stroke-width="1.8"/>`;
        front += `<path d="M${f(neck[0] - rx)} ${f(y)} A${f(rx)} ${f(ry)} 0 0 0 ${f(neck[0] + rx)} ${f(y)}" fill="none" stroke="${c.accent}" stroke-width="2"/>`;
      }
      front += `<path d="M${f(neck[0] + 14)} ${f(ny + 6)} q4 10 -2 18 m2 -18 q-6 8 -10 14" fill="none" stroke="${c.accent}" stroke-width="1.6"/>`;
    } else {
      // halo: a wheel of open hands behind him, each with an eye in the palm
      const cx = fx, cy = 150 - e * 6, rad = lerp(74, 66, e), n = 6;
      for (let i = 0; i < n; i++) {
        const a = TAU * (i / n + t * lerp(0.08, 0.25, e)) - Math.PI / 2;
        const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * 0.95;
        const h = placeHand(x, y, a * 180 / Math.PI + 90, 1.0, i % 2 ? -1 : 1);
        back += G(h.m, fateHand(k, { curl: e * 0.4, palmEye: true, palmOpen: lerp(0.4, 1, e) * blinkAt((t + i * 0.13) % 1, 0.5), t, wisp: false }));
        if (i % 2 === 0) strings.push([h.wrist, [neck[0], neck[1] + 20], 6]);
      }
      back = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rad * 0.98)}" fill="none" stroke="${k.line}" stroke-width="1" stroke-dasharray="2 6" opacity="0.6"/>` + back;
    }
    return { back, front, strings };
  }

  // ---------------- ANTHOLONIOUS · Story / Fate ----------------
  // Spike's head, one eye, a long coat, a book; behind him Fate itself, the hand on his strings.
  const antholonious = {
    id: 'antholonious', name: 'Antholonious', concept: 'Story · Fate', accent: PAL.gold,
    titles: ['Author Beyond Pages', 'The Hand that Guides Fate'],
    frames: { idle: 36, ability: 48 },
    variants: {
      fate: ['halo'],
      book: ['open'],
      tie: ['gold', 'ink']
    },
    anims: { idle: 'Idle', ability: 'Rewrite' },
    P: { torso: 66, neck: 6, R: 36, shW: 27, shY: 9, upper: 40, fore: 38, hipW: 11, thigh: 54, shin: 54, hipY: GROUND - 6 - 108 },
    pose(t, anim) {
      const b = wave(t), e = anim === 'ability' ? envelope(t, 0.25, 0.8) : 0;
      const tug = e * wave(t, 3) * 4; // the strings yank him a little
      return {
        y: b * 1.2 - e * 6, hip: wave(t, 1, 0.25) * 1.2, lean: -1 + b * 0.6, neck: lerp(6, -4, e), head: lerp(10 + wave(t, 1, 0.1) * 2, -10, e) + tug * 0.5,
        lSh: 20 + b, lEl: 104, lWr: 0,
        rSh: lerp(10 + b, 64 + tug, e), rEl: lerp(16, -24, e), rWr: lerp(0, -30, e),
        lHip: 3, rHip: 4, rKnee: e * 6, lFoot: -6, rFoot: 6 + e * 10
      };
    },
    draw(c, rg, v, t, anim, rr) {
      const P = this.P, e = anim === 'ability' ? envelope(t, 0.25, 0.8) : 0;
      const sway = wave(t, 1, 0.3) * 3;
      const back = [], body = [], fxB = [], fxF = [];
      // ---- Fate: it lags half a beat behind him
      const lagX = wave(t, 1, -0.15) * 5;
      const fate = fateForm(v.fate, c, rg, P, t, e, lagX);
      fxB.push(fate.back);
      // ---- him
      const longCoat = 84;
      back.push(G(rg.torso, `<path d="${smooth([[-P.shW - 4, -P.torso + 6], [-P.shW - 8, -P.torso * 0.4], [-34 - sway * 0.4, longCoat - 6], [-30 + sway, longCoat], [sway, longCoat + 4], [30 + sway, longCoat], [34 + sway * 0.4, longCoat - 6], [P.shW + 8, -P.torso * 0.4], [P.shW + 4, -P.torso + 6], [0, -P.torso - 2]])}" fill="${c.coal}" ${c.st}/>`));
      body.push(legs(c, rg, P, { pant: [23, 19, 17], shoe: 'sneaker', fill: c.ink }));
      const tieCol = v.tie === 'gold' ? c.accent : c.ink;
      let tor = `<path d="M-22 -6 L-24 ${-P.torso + 8} Q0 ${-P.torso - 4} 24 ${-P.torso + 8} L22 -6 Q0 2 -22 -6Z" fill="${c.bone}" ${c.stBone}/>` +
        `<path d="M-4 ${-P.torso + 4} L4 ${-P.torso + 4} L3 ${-P.torso + 10} L6 ${-P.torso + 46} L0 ${-P.torso + 54} L-6 ${-P.torso + 46} L-3 ${-P.torso + 10}Z" fill="${tieCol}" ${c.st}/>`;
      [-1, 1].forEach((s) => {
        const h = longCoat;
        const pts = [[s * (P.shW + 3), -P.torso + 6], [s * 8, -P.torso + 2], [s * 12, -P.torso * 0.55], [s * 14, -P.torso * 0.15], [s * 16 + sway, h - 2], [s * 31 + sway, h + 2], [s * 33 + sway * 0.5, h * 0.4], [s * 29, -P.torso * 0.35]];
        tor += `<path d="${poly(pts)}" fill="${c.ink}" ${c.st}/><path d="M${s * 8} ${-P.torso + 2} L${s * 17} ${-P.torso * 0.62} L${s * 12} ${-P.torso * 0.56}" fill="none" stroke="${c.line}" stroke-width="1.6"/>`;
      });
      body.push(G(rg.torso, tor));
      body.push(arm(c, rg.R, P, { sleeve: [22, 18, 17], fill: c.ink, hand: e > 0.3 ? 'open' : 'relaxed', handFill: c.bone }, 1, t));
      // Spike's head: a ring of spikes, cat ears, one eye
      const hc = P.R * 0.92, rh = rr('head');
      let head = `<rect x="-6" y="-6" width="12" height="10" fill="${c.skin}" ${c.st}/>`;
      head += [-1, 1].map((s) => `<path d="M${s * 18} ${f(-hc - P.R * 0.7)} L${s * 34} ${f(-hc - P.R - 34 + wave(t, 1, s * 0.1) * 2)} L${s * 40} ${f(-hc - P.R * 0.35)}Z" fill="${c.ink}" ${c.st}/>`).join('');
      const ring = [];
      const n = rh.int(10, 13), rot = rh.range(0, TAU);
      for (let i = 0; i < n * 2; i++) {
        const a = rot + (i / (n * 2)) * TAU, tip = i % 2 === 0;
        const rad = P.R * 0.86 + (tip ? rh.range(9, 17) + wave(t, 1, i * 0.07) * 1.2 : rh.range(-2, 3));
        ring.push([Math.cos(a) * rad, -hc + Math.sin(a) * rad * 0.94]);
      }
      head += `<path d="${poly(ring)}" fill="${c.ink}" ${c.st}/>`;
      const ey = -hc + 3, open = blinkAt(t, 0.45), glow = 1 + e * 0.35;
      head += `<g transform="translate(0 ${f(ey)}) scale(${f(glow)} ${f(glow * open)})"><path d="M-15 0 Q0 -12 15 0 Q0 12 -15 0Z" fill="${PAL.bone}" stroke="${c.accent}" stroke-width="1.6"/><circle r="6" fill="${c.accent}"/><circle r="2.4" fill="${PAL.ink}"/></g>`;
      body.push(G(rg.head, head));
      // left arm holding the book in front of him
      body.push(arm(c, rg.L, P, { sleeve: [22, 18, 17], fill: c.ink, hand: 'none' }, -1, t));
      const bh = pt(rg.L.hand, 0, 4);
      const flutter = e > 0 ? wave(t, 6) * 6 * e : (Math.floor(t * 36) % 12 === 0 ? 4 : 0);
      let book;
      if (v.book === 'open' || e > 0.2) {
        const wide = 1 + e * 0.3;
        book = `<g transform="translate(${f(bh[0] + 10)} ${f(bh[1] - 4)}) rotate(-8) scale(${f(wide)} 1)">` +
          `<path d="M-26 -2 L0 2 L26 -2 L26 22 L0 26 L-26 22Z" fill="${c.ink}" ${c.st}/>` +
          `<path d="M-24 -4 Q-12 -8 0 0 L0 22 Q-12 16 -24 18Z" fill="${c.bone}" ${c.stBone}/>` +
          `<path d="M24 -4 Q12 -8 0 0 L0 22 Q12 16 24 18Z" fill="${c.bone}" ${c.stBone}/>` +
          `<path d="M0 0 Q${f(10 + flutter)} ${f(-10 - flutter)} 22 -4 L22 16 Q${f(10 + flutter)} ${f(8 - flutter)} 0 22Z" fill="${PAL.paper}" ${c.stBone} opacity="${flutter ? 1 : 0}"/>` +
          [0, 1, 2, 3].map((i) => `<path d="M-20 ${2 + i * 4} L-5 ${3 + i * 4} M5 ${3 + i * 4} L20 ${2 + i * 4}" stroke="#8d877a" stroke-width="1"/>`).join('') +
          (e > 0 ? `<path d="M-6 6 h12 M-4 10 h8" stroke="${c.accent}" stroke-width="2" opacity="${f(e)}"/>` : '') + `</g>`;
      } else {
        book = `<g transform="translate(${f(bh[0] + 6)} ${f(bh[1] - 6)}) rotate(-10)"><rect x="-15" y="-20" width="30" height="40" rx="2" fill="${c.ink}" ${c.st}/><rect x="-15" y="-20" width="5" height="40" fill="${c.coal}"/>` +
          `<rect x="10" y="-4" width="8" height="8" fill="${c.accent}"/><circle cx="2" cy="-4" r="6" fill="none" stroke="${c.accent}" stroke-width="1.6"/><circle cx="2" cy="-4" r="2" fill="${c.accent}"/></g>`;
      }
      body.push(book);
      body.push(G(rg.L.hand, hand(c, 'relaxed', -1, c.bone, t)));
      // ---- the strings Fate holds him by
      // (the user dropped the strings: Fate just circles him now)
      if (v.fate !== 'halo') fate.strings.forEach(([a, b, sl], i) => {
        const slack = sl * (1 - e) + wave(t, 1, i * 0.2) * 2;
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 + slack;
        fxF.push(`<path d="M${f(a[0])} ${f(a[1])} Q${f(mx)} ${f(my)} ${f(b[0])} ${f(b[1])}" fill="none" stroke="${c.accent}" stroke-width="1.6" opacity="${f(0.75 + e * 0.25)}"/>`);
      });
      fxF.push(fate.front);
      // ---- rewriting: pages tear free and circle him
      if (e > 0.02) {
        for (let i = 0; i < 6; i++) {
          const a = TAU * (t * 0.9 + i / 6);
          const x = lerp(bh[0], 120 + Math.cos(a) * 92, e), y = lerp(bh[1], 170 + Math.sin(a) * 70, e);
          fxF.push(`<g transform="translate(${f(x)} ${f(y)}) rotate(${f(wave(t, 1, i / 6) * 40)}) scale(${f(e)})"><rect x="-7" y="-9" width="14" height="18" fill="${PAL.paper}" ${c.stBone}/><path d="M-4 -4 H4 M-4 0 H4 M-4 4 H2" stroke="#8d877a" stroke-width="1.1"/></g>`);
        }
      }
      return { back: fxB.join('') + back.join(''), body: body.join(''), front: fxF.join('') };
    }
  };

  const CHARACTERS = { sils, moinera, universe, antholonious };

  // ---------- assembly ----------
  function variantsOf(charId, seed, overrides) {
    const ch = CHARACTERS[charId];
    const out = {};
    Object.keys(ch.variants).forEach((k) => {
      const opts = ch.variants[k];
      const r = rng(hash(charId + '|' + (seed || '') + '|' + k));
      out[k] = overrides && opts.includes(overrides[k]) ? overrides[k] : (seed ? r.pick(opts) : opts[0]);
    });
    return out;
  }
  function norm(t) { return ((t || 0) % 1 + 1) % 1; }
  function accentAt(o) {
    const ch = CHARACTERS[o.char] || sils;
    if (o.accent) return o.accent;
    const v = variantsOf(ch.id, o.seed || '', o.v);
    return ch.accentAt ? ch.accentAt(norm(o.t), o.anim || 'idle', v) : ch.accent;
  }

  function buildSvg(o, mode) {
    const ch = CHARACTERS[o.char] || sils;
    const seed = o.seed || '';
    const v = variantsOf(ch.id, seed, o.v);
    const t = norm(o.t), anim = o.anim || 'idle';
    const accent = accentAt(o);
    const key = ch.id + '|' + seed;
    const rr = (name) => rng(hash(key + '#' + name));
    const c = colorsFor(mode, accent);
    c.style = o.style || 'halftone';
    const rg = rig(ch.P, ch.pose(t, anim, v));
    const d = ch.draw(c, rg, v, t, anim, rr);
    const id = 'f' + hash(key + anim + t).toString(36);
    let defs = '';
    let fig = `${d.back}${d.body}`;
    // Universe: a red double slips out of step with him
    if (d.split) {
      defs += `<filter id="${id}tint"><feFlood flood-color="${accent}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`;
      fig = `<g filter="url(#${id}tint)" transform="translate(${f(-6 * d.split + wave(t, 11) * 3)} 0)" opacity="${f(0.55 * d.split)}">${d.back}${d.body}</g>` + fig;
    }
    // Sils: slices of him slip sideways
    if (d.glitch > 0.02) {
      const rg2 = rng(hash(key + 'glitch' + Math.floor(t * 24)));
      let copies = '';
      for (let i = 0; i < 5; i++) {
        const y = rg2.range(50, 340), h = rg2.range(3, 14), dx = rg2.range(-18, 18) * d.glitch;
        defs += `<clipPath id="${id}c${i}"><rect x="0" y="${f(y)}" width="${W}" height="${f(h)}"/></clipPath>`;
        copies += `<g clip-path="url(#${id}c${i})"><rect x="0" y="${f(y)}" width="${W}" height="${f(h)}" fill="${o.background || 'none'}" opacity="${f(d.glitch * 0.9)}"/><g transform="translate(${f(dx)} 0)">${d.back}${d.body}</g></g>`;
      }
      fig += copies;
    }
    // Sils: bands of him go missing until nothing is left; then he builds back up from the feet
    if (d.vanish && (d.vanish.dis > 0 || d.vanish.reveal != null)) {
      const { dis, reveal } = d.vanish;
      const rb = rng(hash(key + 'bands' + Math.floor(t * 24)));
      let m = '';
      if (reveal == null) m += `<rect width="${W}" height="${H}" fill="white"/>`;
      else {
        m += `<rect x="0" y="${f(reveal)}" width="${W}" height="${f(H - reveal)}" fill="white"/>`;
        // the edge assembles out of loose squares
        for (let i = 0; i < 70; i++) { const s = rb.range(2, 6); m += `<rect x="${f(rb.range(40, 200))}" y="${f(reveal - rb.range(0, 30))}" width="${f(s)}" height="${f(s)}" fill="white"/>`; }
      }
      const bands = 30;
      for (let i = 0; i < bands; i++) if (rb() < dis) m += `<rect x="0" y="${f(i * H / bands)}" width="${W}" height="${f(H / bands + 0.5)}" fill="black"/>`;
      defs += `<mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">${m}</mask>`;
      fig = `<g mask="url(#${id}m)">${fig}</g>`;
      if (reveal != null && reveal < GROUND) fig += `<line x1="40" y1="${f(reveal)}" x2="200" y2="${f(reveal)}" stroke="${accent}" stroke-width="1.4" opacity="0.8"/>`;
    }
    const bg = o.background ? `<rect width="${W}" height="${H}" fill="${o.background}"/>` : '';
    const gone = d.vanish && d.vanish.reveal == null ? d.vanish.dis : (d.vanish && d.vanish.reveal != null ? 1 - (GROUND - d.vanish.reveal) / GROUND : 0);
    const shadow = `<ellipse cx="120" cy="${GROUND + 2}" rx="46" ry="5" fill="#000" opacity="${f(0.18 * (1 - Math.min(1, gone)))}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs ? `<defs>${defs}</defs>` : ''}${bg}${shadow}${fig}${d.front}</svg>`;
  }

  // ---------- raster styles: halftone and pixel ----------
  function svgDataUrl(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
  function loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
  function canvas(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  async function rasterHalftone(o, scale, accent) {
    const im = await loadImage(svgDataUrl(buildSvg(Object.assign({}, o, { background: PAL.paper }), 'fill')));
    const src = canvas(W, H), sctx = src.getContext('2d');
    sctx.drawImage(im, 0, 0, W, H);
    const d = sctx.getImageData(0, 0, W, H).data;
    const cv = canvas(W * scale, H * scale), ctx = cv.getContext('2d');
    ctx.fillStyle = PAL.paper; ctx.fillRect(0, 0, cv.width, cv.height);
    const cell = 4, ac = hexRgb(accent);
    for (let y = 0; y < H; y += cell) {
      for (let x = 0; x < W; x += cell) {
        let rs = 0, gs = 0, bs = 0, n = 0;
        for (let yy = y; yy < Math.min(y + cell, H); yy++) for (let xx = x; xx < Math.min(x + cell, W); xx++) { const i = (yy * W + xx) * 4; rs += d[i]; gs += d[i + 1]; bs += d[i + 2]; n++; }
        rs /= n; gs /= n; bs /= n;
        const dark = 1 - (0.299 * rs + 0.587 * gs + 0.114 * bs) / 255;
        if (dark < 0.06) continue;
        const sat = Math.max(rs, gs, bs) - Math.min(rs, gs, bs);
        const isAccent = sat > 50 && Math.abs(rs - ac[0]) + Math.abs(gs - ac[1]) + Math.abs(bs - ac[2]) < 220;
        ctx.fillStyle = isAccent ? accent : PAL.ink;
        const rad = Math.sqrt(isAccent ? Math.max(dark, 0.55) : dark) * cell * 0.74 * scale;
        ctx.beginPath(); ctx.arc((x + cell / 2) * scale, (y + cell / 2) * scale, rad, 0, TAU); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.18; ctx.fillStyle = accent;
    ctx.fillRect(cv.width - 10 * scale, 0, 10 * scale, cv.height);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (o.background === false) {
      // cut the printed sheet to the figure (a sticker), so it can stand on the dark pages
      const mask = await loadImage(svgDataUrl(buildSvg(Object.assign({}, o, { background: null }), 'fill')));
      ctx.globalCompositeOperation = 'destination-in';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 5 * scale;
      ctx.drawImage(mask, 0, 0, cv.width, cv.height);
      ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
    }
    return cv;
  }
  async function rasterPixel(o, scale, accent) {
    const im = await loadImage(svgDataUrl(buildSvg(o, 'fill')));
    const PW = 80, PH = 120;
    const small = canvas(PW, PH), sctx = small.getContext('2d');
    sctx.drawImage(im, 0, 0, PW, PH);
    const img = sctx.getImageData(0, 0, PW, PH), d = img.data;
    const palette = [hexRgb(PAL.void), hexRgb('#2a2b33'), hexRgb(PAL.bone), hexRgb(accent)];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
      let best = 0, bd = 1e9;
      palette.forEach((p, k) => { const dd = (d[i] - p[0]) ** 2 + (d[i + 1] - p[1]) ** 2 + (d[i + 2] - p[2]) ** 2; if (dd < bd) { bd = dd; best = k; } });
      d[i] = palette[best][0]; d[i + 1] = palette[best][1]; d[i + 2] = palette[best][2]; d[i + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    const cv = canvas(W * scale, H * scale), ctx = cv.getContext('2d');
    if (o.background !== false) {
      const cs = 6 * scale;
      for (let y = 0; y < cv.height; y += cs) for (let x = 0; x < cv.width; x += cs) { ctx.fillStyle = ((x + y) / cs) % 2 ? '#1a1b22' : '#121318'; ctx.fillRect(x, y, cs, cs); }
    }
    ctx.imageSmoothingEnabled = false;
    const outline = canvas(PW, PH), octx = outline.getContext('2d');
    octx.drawImage(small, 0, 0); octx.globalCompositeOperation = 'source-in'; octx.fillStyle = '#8f8a80'; octx.fillRect(0, 0, PW, PH);
    const u = cv.width / PW;
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => ctx.drawImage(outline, dx * u, dy * u, cv.width, cv.height));
    ctx.drawImage(small, 0, 0, cv.width, cv.height);
    return cv;
  }

  async function frame(o) {
    o = Object.assign({}, o || {});
    const accent = accentAt(o);
    const scale = o.scale || 2;
    return o.style === 'pixel' ? rasterPixel(o, scale, accent) : rasterHalftone(o, scale, accent);
  }

  // ---------- flipbook player ----------
  const loopCache = new Map();
  function framesFor(o) { const ch = CHARACTERS[o.char] || sils; return (ch.frames && ch.frames[o.anim || 'idle']) || o.frames || 32; }
  async function loop(o) {
    const n = framesFor(o);
    const k = [o.char, o.seed || '', JSON.stringify(o.v || {}), o.anim || 'idle', o.style, o.scale || 2, n, o.background === false ? 'cut' : 'bg'].join('~');
    if (loopCache.has(k)) return loopCache.get(k);
    const p = (async () => { const out = []; for (let i = 0; i < n; i++) out.push(await frame(Object.assign({}, o, { t: i / n }))); return out; })();
    loopCache.set(k, p);
    if (loopCache.size > 10) loopCache.delete(loopCache.keys().next().value);
    return p;
  }
  class Player {
    constructor(cv, o) { this.cv = cv; this.o = Object.assign({ fps: 11 }, o); this.i = 0; this.raf = 0; this.token = 0; }
    async set(o) {
      Object.assign(this.o, o);
      const token = ++this.token;
      this.frames = null;
      const n = framesFor(this.o);
      this.i = this.i % n;
      const first = await frame(Object.assign({}, this.o, { t: this.i / n }));
      if (token !== this.token) return;
      this.draw(first);
      const frames = await loop(this.o);
      if (token !== this.token) return;
      this.frames = frames;
      if (this.playing) this.start();
    }
    draw(src) { const ctx = this.cv.getContext('2d'); this.cv.width = src.width; this.cv.height = src.height; ctx.drawImage(src, 0, 0); }
    play() { this.playing = true; this.start(); return this; }
    pause() { this.playing = false; cancelAnimationFrame(this.raf); }
    start() {
      cancelAnimationFrame(this.raf);
      if (!this.frames) return;
      let last = 0;
      const step = (now) => {
        if (now - last >= 1000 / this.o.fps) {
          last = now; this.i = (this.i + 1) % this.frames.length; this.draw(this.frames[this.i]);
          if (this.o.onFrame) this.o.onFrame(this.i / this.frames.length);
        }
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }
  }

  global.EpitaphFigures = {
    CHARACTERS, STYLES, PALETTE: PAL, W, H,
    variantsOf, accentAt, frame, loop, Player,
    svg: (o) => buildSvg(o || {}, 'fill')
  };
})(typeof window !== 'undefined' ? window : globalThis);
