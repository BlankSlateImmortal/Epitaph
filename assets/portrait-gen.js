/* Epitaph — built-in portrait generator.
 * Draws an original character for anyone without uploaded art.
 * Same name + traits always give the same figure. Nothing is stored:
 * portraits are re-drawn on load and cached in memory only.
 *
 *   EpitaphPortrait.render({ name, storyline, mythos, divineStatus, faction, style, archetype })
 *     -> Promise<dataURL PNG>
 *   EpitaphPortrait.svg(opts) -> SVG string (vector, no post-processing)
 *   EpitaphPortrait.STYLES / ARCHETYPES
 */
(function (global) {
  'use strict';

  const W = 240, H = 300;
  const STYLES = ['ink', 'halftone', 'pixel', 'neon', 'dither'];
  const ARCHETYPES = ['hood', 'spike', 'plush', 'wisp', 'capsule'];
  const PAL = {
    ink: '#0b0b0d', void: '#020203', bone: '#ece6d8', dust: '#9c927e', paper: '#e4ddcc',
    ember: '#c4482b', gold: '#d8b25a', verdigris: '#6fb3a3', cyan: '#5ec8ff', violet: '#9b7bff'
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
  const f = (n) => Math.round(n * 10) / 10;

  // ---------- traits ----------
  function traitsOf(o) {
    const s = String(o.storyline || '').toLowerCase();
    const mythos = o.mythos || '';
    const divine = o.divineStatus || '';
    const t = {
      angel: /angel|seraph|celest|holy/.test(s),
      demon: /demon|devil|fiend|infernal/.test(s),
      god: /\bgod|deity|divine|primordial/.test(s) || !!divine,
      voided: /void|null|nothing|hollow/.test(s),
      story: /story|author|fate/.test(s),
      blessed: mythos === 'Blessed',
      cursed: mythos === 'Cursed',
      divine
    };
    t.accent = t.cursed || t.demon ? PAL.ember
      : t.blessed || t.angel ? PAL.gold
      : t.god ? PAL.verdigris
      : t.voided ? PAL.violet
      : null;
    return t;
  }

  function resolve(o) {
    const key = [o.name || 'unnamed', o.storyline || '', o.mythos || '', o.divineStatus || '', o.faction || '', o.seed || ''].join('|');
    const r = rng(hash(key));
    const traits = traitsOf(o);
    const figPool = (Array.isArray(o.allowFigures) && o.allowFigures.filter(a => ARCHETYPES.includes(a)).length) ? o.allowFigures.filter(a => ARCHETYPES.includes(a)) : ARCHETYPES;
    const stylePool = (Array.isArray(o.allowStyles) && o.allowStyles.filter(a => STYLES.includes(a)).length) ? o.allowStyles.filter(a => STYLES.includes(a)) : STYLES;
    const archetype = ARCHETYPES.includes(o.archetype) ? o.archetype : figPool[hash(key + '#a') % figPool.length];
    const style = STYLES.includes(o.style) ? o.style : stylePool[hash(key + '#s') % stylePool.length];
    const accent = o.accent || traits.accent || r.pick([PAL.cyan, PAL.bone, PAL.ember, PAL.verdigris, PAL.gold]);
    return { r, traits, archetype, style, accent, key };
  }

  // ---------- eye shapes ----------
  function eyes(r, cx, cy, gap, size, kind, color) {
    const out = [];
    [-1, 1].forEach((side) => {
      const x = cx + side * gap;
      if (kind === 'oval') out.push(`<ellipse cx="${f(x)}" cy="${f(cy)}" rx="${f(size * 0.42)}" ry="${f(size)}" fill="${color}"/>`);
      else if (kind === 'dot') out.push(`<circle cx="${f(x)}" cy="${f(cy)}" r="${f(size * 0.55)}" fill="${color}"/>`);
      else if (kind === 'crescent') out.push(`<path d="M${f(x - size)} ${f(cy - size * 0.2)} Q${f(x)} ${f(cy + size * 1.3)} ${f(x + size)} ${f(cy - size * 0.2)} Q${f(x)} ${f(cy + size * 0.5)} ${f(x - size)} ${f(cy - size * 0.2)}Z" fill="${color}"/>`);
      else if (kind === 'slit') out.push(`<path d="M${f(x - size * 1.1)} ${f(cy + side * 0)} L${f(x + size * 1.1)} ${f(cy - size * 0.45)} L${f(x + size * 0.9)} ${f(cy + size * 0.35)} Z" transform="scale(${side} 1) translate(${side < 0 ? f(-2 * x) : 0} 0)" fill="${color}"/>`);
      else if (kind === 'angular') out.push(`<path d="M${f(x - side * size * 1.2)} ${f(cy - size * 0.9)} L${f(x + side * size * 1.0)} ${f(cy - size * 0.2)} L${f(x + side * size * 0.3)} ${f(cy + size * 0.9)} Z" fill="${color}" stroke="${PAL.ember}" stroke-width="2.4" stroke-linejoin="round"/>`);
      else if (kind === 'spiral') {
        let d = '', a = 0, rr = 0.6;
        for (let i = 0; i < 70; i++) { a += 0.32; rr += size * 0.017; d += (i ? 'L' : 'M') + f(x + Math.cos(a * side) * rr) + ' ' + f(cy + Math.sin(a * side) * rr); }
        out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>`);
      } else if (kind === 'ring') out.push(`<circle cx="${f(x)}" cy="${f(cy)}" r="${f(size * 0.7)}" fill="none" stroke="${color}" stroke-width="2.6"/>`);
    });
    return out.join('');
  }

  // ---------- figure archetypes ----------
  // Each returns { body: svg, headTop, headCx, headCy, headR } in a 240x300 box.
  function shoulders(r, fill, stroke, top) {
    const w = r.range(78, 96), sy = top || r.range(228, 238);
    return `<path d="M${f(120 - w - 22)} 300 C${f(120 - w - 18)} ${f(sy + 26)} ${f(120 - w + 6)} ${f(sy)} 120 ${f(sy - 8)} C${f(120 + w - 6)} ${f(sy)} ${f(120 + w + 18)} ${f(sy + 26)} ${f(120 + w + 22)} 300 Z" fill="${fill}" ${stroke}/>`;
  }

  function hood(r, c) {
    const cx = 120, cy = r.range(132, 142), rx = r.range(56, 64), ry = r.range(60, 68);
    const earH = r.range(26, 44), earSpread = r.range(0.55, 0.8), earTilt = r.range(-6, 10);
    const ear = (side) => {
      const bx = cx + side * rx * earSpread, by = cy - ry * 0.62;
      return `<path d="M${f(bx - side * 26)} ${f(by + 14)} L${f(bx + side * (8 + earTilt))} ${f(by - earH)} L${f(bx + side * 22)} ${f(by + 20)} Z" fill="${c.fill}" ${c.stroke}/>`;
    };
    const face = `<ellipse cx="${cx}" cy="${f(cy + 10)}" rx="${f(rx * 0.68)}" ry="${f(ry * 0.56)}" fill="${c.face}" ${c.faceStroke}/>`;
    const eyeKind = r.pick(['oval', 'oval', 'crescent', 'dot', 'slit']);
    const drawstrings = r.chance(0.6) ? `<path d="M${cx - 18} 232 l-3 34 M${cx + 18} 232 l3 30" stroke="${c.line}" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="${cx - 21}" cy="268" r="3" fill="${c.line}"/><circle cx="${cx + 21}" cy="264" r="3" fill="${c.line}"/>` : '';
    const body = shoulders(r, c.fill, c.stroke, 232) + ear(-1) + ear(1) +
      `<ellipse cx="${cx}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${c.fill}" ${c.stroke}/>` + face +
      eyes(r, cx, cy + 10, rx * 0.26, r.range(9, 13), eyeKind, c.eye) + drawstrings;
    return { body, headTop: cy - ry - earH, headCx: cx, headCy: cy, headR: Math.max(rx, ry) };
  }

  function spike(r, c) {
    const cx = 120, cy = r.range(138, 148), base = r.range(56, 64), n = r.int(9, 14);
    let d = '';
    const steps = n * 2;
    const rot = r.range(0, Math.PI * 2);
    for (let i = 0; i <= steps; i++) {
      const a = rot + (i / steps) * Math.PI * 2;
      const isTip = i % 2 === 0;
      const rad = base + (isTip ? r.range(16, 34) : r.range(-4, 6));
      d += (i ? 'L' : 'M') + f(cx + Math.cos(a) * rad) + ' ' + f(cy + Math.sin(a) * rad * 0.94);
    }
    // two cat ears that rise above the fur
    const ears = [-1, 1].map((s) => `<path d="M${f(cx + s * 22)} ${f(cy - base + 6)} L${f(cx + s * r.range(40, 52))} ${f(cy - base - r.range(42, 56))} L${f(cx + s * 60)} ${f(cy - base + 26)} Z" fill="${c.fill}" ${c.stroke}/>`).join('');
    const eyeKind = r.pick(['crescent', 'crescent', 'dot', 'oval']);
    const body = `<path d="M70 300 C72 250 92 222 120 218 C148 222 168 250 170 300Z" fill="${c.fill}" ${c.stroke}/>` + ears +
      `<path d="${d}Z" fill="${c.fill}" ${c.stroke} stroke-linejoin="miter"/>` +
      eyes(r, cx, cy + 4, base * 0.36, r.range(11, 15), eyeKind, c.eye);
    return { body, headTop: cy - base - 50, headCx: cx, headCy: cy, headR: base + 20 };
  }

  function plush(r, c) {
    const cx = 120, cy = r.range(122, 132), hr = r.range(54, 62);
    const earR = r.range(16, 22), earOff = hr * r.range(0.7, 0.82);
    const earsSvg = [-1, 1].map((s) => `<circle cx="${f(cx + s * earOff)}" cy="${f(cy - earOff * 0.8)}" r="${f(earR)}" fill="${c.soft}" ${c.stroke}/>`).join('');
    const torso = `<path d="M${cx - 44} 300 C${cx - 50} 240 ${cx - 40} ${f(cy + hr - 6)} ${cx} ${f(cy + hr - 6)} C${cx + 40} ${f(cy + hr - 6)} ${cx + 50} 240 ${cx + 44} 300Z" fill="${c.soft}" ${c.stroke}/>`;
    const arms = [-1, 1].map((s) => `<ellipse cx="${f(cx + s * 58)}" cy="${f(cy + hr + 44)}" rx="17" ry="30" transform="rotate(${s * -24} ${f(cx + s * 58)} ${f(cy + hr + 44)})" fill="${c.soft}" ${c.stroke}/>`).join('');
    const mixed = r.chance(0.5);
    const e1 = r.pick(['spiral', 'spiral', 'dot', 'ring']);
    const eyeSvg = mixed
      ? eyes(r, cx - hr * 0.3, cy + 6, 0, 12, e1, c.ink).replace(/^(.*?\/>)(.*)$/s, '$1') + eyes(r, cx + hr * 0.3, cy + 6, 0, 12, 'dot', c.ink).replace(/^(.*?\/>)(.*)$/s, '$1')
      : eyes(r, cx, cy + 6, hr * 0.32, 12, e1, c.ink);
    const stitch = r.chance(0.5) ? `<path d="M${cx} ${f(cy + 24)} l0 14 m-7 -4 l14 0" stroke="${c.ink}" stroke-width="2" fill="none"/>` : '';
    const body = arms + torso + earsSvg + `<circle cx="${cx}" cy="${f(cy)}" r="${f(hr)}" fill="${c.soft}" ${c.stroke}/>` + eyeSvg + stitch;
    return { body, headTop: cy - hr - earR - 10, headCx: cx, headCy: cy, headR: hr + 10 };
  }

  function wisp(r, c, id) {
    const cx = 120, cy = r.range(140, 150), rr = r.range(52, 60);
    const earH = r.range(22, 34);
    const shape = `M${cx - rr} ${cy} C${cx - rr} ${f(cy - rr * 0.9)} ${f(cx - rr * 0.6)} ${f(cy - rr)} ${f(cx - rr * 0.55)} ${f(cy - rr - earH)} L${f(cx - rr * 0.18)} ${f(cy - rr * 0.92)} L${f(cx + rr * 0.2)} ${f(cy - rr * 0.92)} L${f(cx + rr * 0.58)} ${f(cy - rr - earH)} C${f(cx + rr * 0.64)} ${f(cy - rr)} ${cx + rr} ${f(cy - rr * 0.9)} ${cx + rr} ${cy} C${cx + rr} ${f(cy + rr * 1.1)} ${f(cx + rr * 0.4)} ${f(cy + rr * 1.5)} ${cx} ${f(cy + rr * 1.6)} C${f(cx - rr * 0.4)} ${f(cy + rr * 1.5)} ${cx - rr} ${f(cy + rr * 1.1)} ${cx - rr} ${cy}Z`;
    const blur = `<filter id="${id}b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${f(r.range(5, 9))}"/></filter>`;
    const fringe = c.outline ? '' : `<path d="${shape}" fill="${c.accent}" opacity="0.55" transform="translate(5 3)" filter="url(#${id}b)"/><path d="${shape}" fill="${PAL.cyan}" opacity="0.35" transform="translate(-5 -2)" filter="url(#${id}b)"/>`;
    const body = `<defs>${blur}</defs>` + fringe + `<path d="${shape}" fill="${c.fill}" ${c.stroke} ${c.outline ? '' : `filter="url(#${id}b)"`}/>` +
      `<path d="${shape}" fill="${c.fill}" ${c.stroke} transform="translate(${cx} ${cy}) scale(0.86) translate(${-cx} ${-cy})"/>` +
      eyes(r, cx, cy + 4, rr * 0.34, r.range(8, 11), r.pick(['dot', 'dot', 'oval']), c.eye);
    return { body, headTop: cy - rr - earH, headCx: cx, headCy: cy, headR: rr + 6 };
  }

  function capsule(r, c) {
    const cx = 120, top = r.range(70, 82), hw = r.range(48, 56), hh = r.range(118, 130);
    const head = `<rect x="${f(cx - hw)}" y="${f(top)}" width="${f(hw * 2)}" height="${f(hh)}" rx="${f(hw * 0.62)}" fill="${c.fill}" ${c.stroke}/>`;
    const capSide = r.chance(0.5) ? 1 : -1;
    const hasCap = r.chance(0.7);
    const cap = hasCap
      ? `<path d="M${f(cx - hw - 4)} ${f(top + 42)} C${f(cx - hw - 4)} ${f(top - 14)} ${f(cx + hw + 4)} ${f(top - 14)} ${f(cx + hw + 4)} ${f(top + 42)} Z" fill="${c.capFill}" ${c.stroke}/>` +
        `<path d="M${f(cx + capSide * (hw - 6))} ${f(top + 36)} Q${f(cx + capSide * (hw + 40))} ${f(top + 30)} ${f(cx + capSide * (hw + 46))} ${f(top + 48)} Q${f(cx + capSide * (hw + 10))} ${f(top + 50)} ${f(cx + capSide * (hw - 10))} ${f(top + 46)}Z" fill="${c.capFill}" ${c.stroke}/>` +
        `<circle cx="${cx}" cy="${f(top - 1)}" r="4" fill="${c.capFill}" ${c.stroke}/>`
      : '';
    const neck = `<rect x="${cx - 18}" y="${f(top + hh - 6)}" width="36" height="22" fill="${c.fill}" ${c.stroke}/>`;
    const lapels = `<path d="M${cx} ${f(top + hh + 22)} L${cx - 34} 300 M${cx} ${f(top + hh + 22)} L${cx + 34} 300 M${cx - 16} ${f(top + hh + 12)} L${cx} ${f(top + hh + 40)} L${cx + 16} ${f(top + hh + 12)}" stroke="${c.line}" stroke-width="2.4" fill="none"/>`;
    const eyeY = top + hh * 0.56;
    const body = shoulders(r, c.fill, c.stroke, top + hh + 18) + neck + lapels + head + cap +
      eyes(r, cx, eyeY, hw * 0.4, r.range(11, 14), r.pick(['angular', 'angular', 'oval', 'slit']), c.eye);
    return { body, headTop: top - 14, headCx: cx, headCy: top + hh / 2, headR: hh / 2 };
  }

  const BUILDERS = { hood, spike, plush, wisp, capsule };

  // ---------- trait overlays ----------
  function overlays(r, t, head, c, under) {
    const out = { under: '', over: '' };
    const { headCx: cx, headTop, headCy, headR } = head;
    if (t.angel) {
      const wing = (s) => {
        let d = `M${cx + s * 30} 214`;
        for (let i = 0; i < 5; i++) d += ` Q${f(cx + s * (70 + i * 16))} ${f(150 - i * 18)} ${f(cx + s * (96 + i * 6))} ${f(196 - i * 22)}`;
        d += ` L${cx + s * 40} 240Z`;
        return `<path d="${d}" fill="${c.wing}" stroke="${c.wingStroke}" stroke-width="1.6" opacity="0.92"/>`;
      };
      out.under += wing(-1) + wing(1);
    }
    if (t.blessed || t.angel) {
      out.over += `<ellipse cx="${cx}" cy="${f(headTop + 2)}" rx="${f(headR * 0.62)}" ry="${f(headR * 0.14)}" fill="none" stroke="${PAL.gold}" stroke-width="3.4"/>`;
      for (let i = 0; i < 3; i++) {
        const x = r.range(28, 212), y = r.range(30, 120), s = r.range(4, 8);
        out.over += `<path d="M${f(x)} ${f(y - s)} L${f(x + s * 0.25)} ${f(y - s * 0.25)} L${f(x + s)} ${f(y)} L${f(x + s * 0.25)} ${f(y + s * 0.25)} L${f(x)} ${f(y + s)} L${f(x - s * 0.25)} ${f(y + s * 0.25)} L${f(x - s)} ${f(y)} L${f(x - s * 0.25)} ${f(y - s * 0.25)}Z" fill="${PAL.gold}"/>`;
      }
    }
    if (t.demon || t.cursed) {
      if (t.demon || r.chance(0.5)) {
        const horn = (s) => `<path d="M${f(cx + s * headR * 0.42)} ${f(headCy - headR * 0.62)} C${f(cx + s * headR * 0.7)} ${f(headCy - headR * 1.3)} ${f(cx + s * headR * 1.05)} ${f(headCy - headR * 1.25)} ${f(cx + s * headR * 1.1)} ${f(headCy - headR * 1.55)} C${f(cx + s * headR * 0.7)} ${f(headCy - headR * 1.2)} ${f(cx + s * headR * 0.55)} ${f(headCy - headR * 0.95)} ${f(cx + s * headR * 0.12)} ${f(headCy - headR * 0.7)}Z" fill="${c.horn}" ${c.stroke}/>`;
        out.under += horn(-1) + horn(1);
      }
      if (t.cursed) {
        let d = `M${f(cx + r.range(-10, 10))} ${f(headCy - headR * 0.8)}`, x = cx, y = headCy - headR * 0.8;
        for (let i = 0; i < 5; i++) { x += r.range(-12, 12); y += r.range(12, 20); d += ` L${f(x)} ${f(y)}`; }
        out.over += `<path d="${d}" fill="none" stroke="${PAL.ember}" stroke-width="2.2" stroke-linejoin="bevel"/>`;
      }
    }
    if (t.god) {
      const R = headR * 1.55;
      out.under += `<circle cx="${cx}" cy="${f(headCy)}" r="${f(R)}" fill="none" stroke="${PAL.verdigris}" stroke-width="1.2" stroke-dasharray="2 5"/>` +
        `<circle cx="${cx}" cy="${f(headCy)}" r="${f(R + 12)}" fill="none" stroke="${PAL.verdigris}" stroke-width="0.8" opacity="0.6"/>`;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2, l = i % 6 === 0 ? 9 : 4;
        out.under += `<line x1="${f(cx + Math.cos(a) * (R + 12))}" y1="${f(headCy + Math.sin(a) * (R + 12))}" x2="${f(cx + Math.cos(a) * (R + 12 + l))}" y2="${f(headCy + Math.sin(a) * (R + 12 + l))}" stroke="${PAL.verdigris}" stroke-width="1"/>`;
      }
      out.over += `<circle cx="${f(cx + Math.cos(r.range(0, 6.28)) * R)}" cy="${f(headCy - R * 0.6)}" r="3.5" fill="${PAL.verdigris}"/>`;
    }
    return out;
  }

  // ---------- SVG assembly ----------
  function colorsFor(mode, archetype, accent) {
    const outline = mode === 'outline';
    const stroke = outline ? `stroke="${accent}" stroke-width="2.6"` : `stroke="#55565e" stroke-width="1.8"`;
    return {
      outline,
      accent,
      fill: outline ? 'none' : PAL.ink,
      soft: outline ? 'none' : PAL.bone,
      capFill: outline ? 'none' : '#16171b',
      face: outline ? 'none' : PAL.void,
      faceStroke: outline ? `stroke="${accent}" stroke-width="1.4" stroke-dasharray="3 3"` : '',
      eye: outline ? accent : (archetype === 'capsule' ? PAL.bone : accent === PAL.bone ? PAL.bone : accent),
      ink: outline ? accent : PAL.ink,
      line: outline ? accent : '#3a3b40',
      horn: outline ? 'none' : '#151519',
      wing: outline ? 'none' : '#d9d3c4',
      wingStroke: outline ? accent : PAL.ink,
      stroke
    };
  }

  function buildSvg(o, mode) {
    const { r, traits, archetype, accent, key } = resolve(o);
    const id = 'p' + hash(key).toString(36);
    const c = colorsFor(mode, archetype, accent);
    if (archetype === 'plush' && !c.outline) { c.stroke = `stroke="${PAL.ink}" stroke-width="3"`; }
    const fig = BUILDERS[archetype](r, c, id);
    const ov = overlays(r, traits, fig, c);
    const bg = o.background ? `<rect width="${W}" height="${H}" fill="${o.background}"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${bg}${ov.under}${fig.body}${ov.over}</svg>`;
  }

  function svgDataUrl(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }

  // ---------- raster post-processing ----------
  function loadImage(src) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  }
  function canvas(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  function grain(ctx, w, h, amt, seed) {
    const r = rng(seed), img = ctx.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const n = (r() - 0.5) * amt;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }

  async function rasterInk(o, scale) {
    const im = await loadImage(svgDataUrl(buildSvg(o, 'fill')));
    const cv = canvas(W * scale, H * scale), ctx = cv.getContext('2d');
    ctx.drawImage(im, 0, 0, cv.width, cv.height);
    grain(ctx, cv.width, cv.height, 26, hash(o.name || '') + 7);
    return cv;
  }

  async function rasterNeon(o, scale, accent) {
    const im = await loadImage(svgDataUrl(buildSvg(o, 'outline')));
    const cv = canvas(W * scale, H * scale), ctx = cv.getContext('2d');
    if (o.background !== false) { ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, cv.width, cv.height); }
    ctx.shadowColor = accent; ctx.shadowBlur = 18 * scale;
    ctx.drawImage(im, 0, 0, cv.width, cv.height);
    ctx.shadowBlur = 6 * scale; ctx.drawImage(im, 0, 0, cv.width, cv.height);
    ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
    ctx.drawImage(im, 0, 0, cv.width, cv.height);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    return cv;
  }

  async function rasterHalftone(o, scale, accent) {
    const im = await loadImage(svgDataUrl(buildSvg(Object.assign({}, o, { background: PAL.paper }), 'fill')));
    const src = canvas(W, H), sctx = src.getContext('2d');
    sctx.drawImage(im, 0, 0, W, H);
    const d = sctx.getImageData(0, 0, W, H).data;
    const cv = canvas(W * scale, H * scale), ctx = cv.getContext('2d');
    ctx.fillStyle = PAL.paper; ctx.fillRect(0, 0, cv.width, cv.height);
    const cell = 5, ac = hexRgb(accent);
    for (let y = 0; y < H; y += cell) {
      for (let x = 0; x < W; x += cell) {
        let rs = 0, gs = 0, bs = 0, n = 0;
        for (let yy = y; yy < Math.min(y + cell, H); yy++) for (let xx = x; xx < Math.min(x + cell, W); xx++) {
          const i = (yy * W + xx) * 4; rs += d[i]; gs += d[i + 1]; bs += d[i + 2]; n++;
        }
        rs /= n; gs /= n; bs /= n;
        const lum = (0.299 * rs + 0.587 * gs + 0.114 * bs) / 255;
        const dark = 1 - lum;
        if (dark < 0.06) continue;
        // keep saturated pixels in the accent colour, everything else in ink
        const sat = Math.max(rs, gs, bs) - Math.min(rs, gs, bs);
        const isAccent = sat > 60 && Math.abs(rs - ac[0]) + Math.abs(gs - ac[1]) + Math.abs(bs - ac[2]) < 200;
        ctx.fillStyle = isAccent ? accent : PAL.ink;
        const rad = Math.sqrt(dark) * cell * 0.72 * scale;
        ctx.beginPath(); ctx.arc((x + cell / 2) * scale, (y + cell / 2) * scale, rad, 0, Math.PI * 2); ctx.fill();
      }
    }
    // misregistered accent offset, like a cheap print run
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.18; ctx.fillStyle = accent;
    ctx.fillRect(cv.width - 10 * scale, 0, 10 * scale, cv.height);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (o.background === false) {
      // cut the printed sheet to the figure's outline (a sticker), so it can stand on dark pages
      const mask = await loadImage(svgDataUrl(buildSvg(Object.assign({}, o, { background: null }), 'fill')));
      ctx.globalCompositeOperation = 'destination-in';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 6 * scale;
      ctx.drawImage(mask, 0, 0, cv.width, cv.height);
      ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
    }
    return cv;
  }

  async function rasterPixel(o, scale, accent) {
    const im = await loadImage(svgDataUrl(buildSvg(o, 'fill')));
    const PW = 60, PH = 75;
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
      // checkerboard field, sprite-sheet style
      const cs = 4 * scale * 2;
      for (let y = 0; y < cv.height; y += cs) for (let x = 0; x < cv.width; x += cs) {
        ctx.fillStyle = ((x + y) / cs) % 2 ? '#1a1b22' : '#121318'; ctx.fillRect(x, y, cs, cs);
      }
    }
    ctx.imageSmoothingEnabled = false;
    // pale outline pass: draw the sprite offset in bone, then the sprite on top
    const outline = canvas(PW, PH), octx = outline.getContext('2d');
    octx.drawImage(small, 0, 0); octx.globalCompositeOperation = 'source-in'; octx.fillStyle = '#8f8a80'; octx.fillRect(0, 0, PW, PH);
    const u = cv.width / PW;
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => ctx.drawImage(outline, dx * u, dy * u, cv.width, cv.height));
    ctx.drawImage(small, 0, 0, cv.width, cv.height);
    return cv;
  }

  async function rasterDither(o, scale, accent) {
    const im = await loadImage(svgDataUrl(buildSvg(o, 'outline')));
    const DW = 120, DH = 150;
    const small = canvas(DW, DH), sctx = small.getContext('2d');
    sctx.fillStyle = '#000'; sctx.fillRect(0, 0, DW, DH);
    sctx.shadowColor = '#fff'; sctx.shadowBlur = 6;
    sctx.drawImage(im, 0, 0, DW, DH);
    const img = sctx.getImageData(0, 0, DW, DH), d = img.data;
    const lum = new Float32Array(DW * DH);
    for (let i = 0; i < lum.length; i++) lum[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) * 1.6;
    // Atkinson dither to 1-bit
    for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) {
      const i = y * DW + x, old = lum[i], nw = old > 128 ? 255 : 0, err = (old - nw) / 8;
      lum[i] = nw;
      [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]].forEach(([dx, dy]) => {
        const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < DW && yy < DH) lum[yy * DW + xx] += err;
      });
    }
    const bone = hexRgb(PAL.bone), ac = hexRgb(accent);
    for (let i = 0; i < lum.length; i++) {
      const on = lum[i] > 0;
      const tint = (d[i * 4] > 140 && Math.abs(d[i * 4] - ac[0]) < 70 && Math.abs(d[i * 4 + 1] - ac[1]) < 70) ? ac : bone;
      d[i * 4] = on ? tint[0] : 0; d[i * 4 + 1] = on ? tint[1] : 0; d[i * 4 + 2] = on ? tint[2] : 0;
      d[i * 4 + 3] = on || o.background !== false ? 255 : 0;
    }
    sctx.shadowBlur = 0; sctx.putImageData(img, 0, 0);
    const cv = canvas(W * scale, H * scale), ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false; ctx.drawImage(small, 0, 0, cv.width, cv.height);
    return cv;
  }

  const cache = new Map();
  async function render(o) {
    o = Object.assign({}, o || {});
    const { style, accent, key } = resolve(o);
    const scale = o.scale || 2;
    const ck = [key, style, resolve(o).archetype, o.accent || '', scale, o.background].join('~');
    if (cache.has(ck)) return cache.get(ck);
    const p = (async () => {
      let cv;
      if (style === 'neon') cv = await rasterNeon(o, scale, accent);
      else if (style === 'halftone') cv = await rasterHalftone(o, scale, accent);
      else if (style === 'pixel') cv = await rasterPixel(o, scale, accent);
      else if (style === 'dither') cv = await rasterDither(o, scale, accent);
      else cv = await rasterInk(o, scale);
      return cv.toDataURL('image/png');
    })();
    cache.set(ck, p);
    p.catch(() => cache.delete(ck));
    return p;
  }

  function describe(o) {
    const { archetype, style, accent, traits } = resolve(o || {});
    return { archetype, style, accent, traits };
  }

  // Site-wide generator preferences (which figures/styles auto-pick may use).
  const PREF_KEY = 'epitaph-portrait-prefs';
  function getPrefs() {
    try { const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); return { figures: Array.isArray(p.figures) ? p.figures : ARCHETYPES.slice(), styles: Array.isArray(p.styles) ? p.styles : STYLES.slice() }; }
    catch (e) { return { figures: ARCHETYPES.slice(), styles: STYLES.slice() }; }
  }
  function setPrefs(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) {} cache.clear(); }
  // Options for a Dossier character: its own overrides, else the site prefs.
  function forCharacter(c, extra) {
    const prefs = getPrefs();
    return Object.assign({
      name: c.name, storyline: c.storyline, mythos: c.mythos, divineStatus: c.divineStatus, faction: c.faction,
      archetype: c.portraitFigure || undefined, style: c.portraitStyle || undefined, seed: c.portraitSeed || '',
      allowFigures: prefs.figures, allowStyles: prefs.styles
    }, extra || {});
  }

  global.EpitaphPortrait = {
    getPrefs, setPrefs, forCharacter,
    render, describe, STYLES, ARCHETYPES, PALETTE: PAL,
    svg: (o) => buildSvg(o || {}, (o && o.style) === 'neon' ? 'outline' : 'fill')
  };
})(typeof window !== 'undefined' ? window : globalThis);
