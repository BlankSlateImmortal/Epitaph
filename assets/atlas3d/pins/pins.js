/* Epitaph — the sword pins (one per character type, plus a few made for one character).
 *
 * Every pin is the jade greatsword (greatsword.glb, built by tools/map/greatsword_pin.py: tip at the origin,
 * blade up +Y, total length ~1.055, front of the blade +Z) with its own materials and a few added parts.
 * Designs (vault: Site work / map pins; showcase artifact "Epitaph Map Pins"):
 *   types       storyborn · person · godling · voided · fallen · unbound · primordial
 *   characters  orin (jade, rotting with the seal) · nera (Fallen sword rebuilt) · yona (dream-glass)
 *               gaia (big Storyborn gold) · val (the Voided hole)
 *
 *   await loadPins();                       // once
 *   const pin = buildPin(designFor(char), { ring: '#9b6bff' });
 *   scene.add(pin.group); ... pin.update(seconds, camera) every frame
 *   placeGiant({...})                       // a site page stands one, giant, in its own scene
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const { Mesh, Group } = THREE;
const G = 0.63;                                 // guard height on the model
export const PIN_HEIGHT = 1.055;
const TIME = { value: 0 };

// ---------- which design a character gets ----------
const CHAR_DESIGNS = { orin: 'orin', nera: 'nera', yona: 'yona', gaia: 'gaia', val: 'val' };
const TYPE_DESIGNS = { storyborn: 'storyborn', person: 'person', godling: 'godling', voided: 'voided', fallen: 'fallen', unbound: 'unbound', primordial: 'primordial' };
export const DESIGN_LABEL = {
  storyborn: 'Storyborn', person: 'Person', godling: 'Godling', voided: 'Voided', fallen: 'Fallen', unbound: 'Unbound', primordial: 'Primordial',
  orin: 'Twisted Storyborn', nera: 'Fallen · rebuilt', yona: 'Godling · Dreamling', gaia: 'Storyborn', val: 'Unbound · the hole'
};
export function designFor(char) {
  const first = String(char && char.name || '').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
  if (CHAR_DESIGNS[first]) return CHAR_DESIGNS[first];
  return TYPE_DESIGNS[String(char && (char.race || char.type) || '').toLowerCase()] || 'person';
}

// ---------- the model ----------
let TEMPLATE = null, loading = null;
export function loadPins(url = new URL('greatsword.glb?v=1', import.meta.url).href) {
  if (TEMPLATE) return Promise.resolve(TEMPLATE);
  return loading ||= new GLTFLoader().loadAsync(url).then(g => {
    g.scene.traverse(o => {
      if (!o.isMesh || o.material.name !== 'blade') return;
      const geo = o.geometry, sets = ['color', 'color_1'].map(n => geo.getAttribute(n)).filter(Boolean);
      const spread = a => { let lo = 9, hi = -9; for (let i = 0; i < a.count; i += 7) { const v = a.getX(i); lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; };
      if (sets.length) geo.setAttribute('color', sets.sort((a, b) => spread(b) - spread(a))[0]);   // the jade gradient
    });
    return (TEMPLATE = g.scene);
  });
}
function base(mats) {
  const root = TEMPLATE.clone(true), parts = {};
  root.traverse(o => { if (o.isMesh) { const n = o.material.name; o.geometry = o.geometry.clone(); o.castShadow = true; (parts[n] ||= []).push(o); } });
  for (const [n, list] of Object.entries(parts)) list.forEach(o => { o.material = mats[n] ?? mats.iron; });
  return { root, parts };
}

// ---------- canvas textures: invented runes, the halo, a hex barrier ----------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function rune(x, cx, cy, s, r) {
  const P = (i, j) => [cx - s / 2 + i * s / 2, cy - s / 2 + j * s / 3];
  let i = Math.floor(r() * 3), j = Math.floor(r() * 4);
  x.beginPath(); x.moveTo(...P(i, j));
  for (let k = 0, n = 2 + Math.floor(r() * 3); k < n; k++) { i = Math.max(0, Math.min(2, i + Math.floor(r() * 3) - 1)); j = Math.max(0, Math.min(3, j + Math.floor(r() * 3) - 1)); x.lineTo(...P(i, j)); }
  x.stroke();
  if (r() < .4) { const [a, b] = P(Math.floor(r() * 3), Math.floor(r() * 4)); x.beginPath(); x.arc(a, b, x.lineWidth * .9, 0, 7); x.fill(); }
}
function tex(w, h, draw, solid = false) {      // white marks on transparent (solid: on black, for emissive maps)
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  if (solid) { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); }
  x.strokeStyle = x.fillStyle = '#fff'; x.lineCap = x.lineJoin = 'round'; draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const runeGrid = (cell, seed, lw = 3) => (x, w, h) => { const r = rng(seed); x.lineWidth = lw; for (let gy = 0; gy < h / cell; gy++) for (let gx = 0; gx < w / cell; gx++) if (r() > .12) rune(x, gx * cell + cell / 2, gy * cell + cell / 2, cell * .56, r); };
let TX = null;
function textures() {
  if (TX) return TX;
  TX = {
    glyphs: tex(256, 1024, runeGrid(48, 7)),
    strip: tex(1024, 64, runeGrid(64, 11, 7)),
    words: tex(512, 64, runeGrid(64, 23, 5)),
    halo: tex(512, 512, (x) => {
      const r = rng(5), C = 256; x.lineWidth = 3;
      for (const R of [244, 236, 168, 62]) { x.beginPath(); x.arc(C, C, R, 0, 7); x.stroke(); }
      for (let k = 0; k < 22; k++) { const a = k / 22 * Math.PI * 2; x.save(); x.translate(C + Math.cos(a) * 202, C + Math.sin(a) * 202); x.rotate(a + Math.PI / 2); rune(x, 0, 0, 30, r); x.restore(); }
      x.lineWidth = 2; for (let k = 0; k < 72; k++) { const a = k / 72 * Math.PI * 2, l = k % 6 ? 150 : 132; x.beginPath(); x.moveTo(C + Math.cos(a) * l, C + Math.sin(a) * l); x.lineTo(C + Math.cos(a) * 164, C + Math.sin(a) * 164); x.stroke(); }
      x.lineWidth = 5; rune(x, C, C, 64, r);
    }),
    hex: tex(512, 512, (x, w) => {
      x.lineWidth = 2; const s = 22, hgt = Math.sqrt(3) * s;
      for (let row = -1; row < w / hgt + 1; row++) for (let col = -1; col < w / (1.5 * s) + 1; col++) {
        const cx = col * 1.5 * s, cy = row * hgt + (col % 2 ? hgt / 2 : 0); x.beginPath();
        for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI * 2; x[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * s, cy + Math.sin(a) * s); } x.stroke();
      }
      const g = x.createRadialGradient(256, 256, 40, 256, 256, 256); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
      x.globalCompositeOperation = 'destination-out'; x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    }),
    pulse: tex(64, 8, (x) => { const g = x.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, '#000'); g.addColorStop(.45, '#000'); g.addColorStop(.5, '#fff'); g.addColorStop(.6, '#000'); x.fillStyle = g; x.fillRect(0, 0, 64, 8); }, true),
  };
  return TX;
}

// ---------- shader patching: object-space position + noise into standard materials ----------
const NOISE = `
float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return .6*vn(p)+.3*vn(p*2.1)+.1*vn(p*4.3);}
`;
export function patch(mat, uniforms, frag, vert = '') {
  const decl = Object.entries(uniforms).map(([k, u]) => `uniform ${u.value && u.value.isTexture ? 'sampler2D' : 'float'} ${k};`).join('\n');
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;\n' + decl)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;\n' + vert);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;\n' + decl + NOISE)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + frag);
  };
  mat.customProgramCacheKey = () => frag + vert;
  return mat;
}
const std = (color, metalness, roughness, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
const additive = (o) => new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, ...o });

const M = {
  gold: () => patch(std('#d9b35b', 1, .28, { emissive: '#ffc85a', emissiveIntensity: 1 }), { uTime: TIME, uGlyph: { value: textures().glyphs } }, `
    float g = texture2D(uGlyph, vec2(vObj.x*6.+.5, vObj.y*1.5 - uTime*.035)).a;
    totalEmissiveRadiance = emissive * g * (.75 + .25*sin(uTime*1.7 + vObj.y*18.)) * 1.6;`),
  steel: () => std('#b9bec4', .9, .32),
  opal: (color, glow) => patch(new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: .08, iridescence: 1, iridescenceIOR: 1.5, transparent: true, opacity: .82, emissive: glow, emissiveIntensity: .18 }),
    { uTime: TIME }, `float core = 1. - smoothstep(0., .025, abs(vObj.x)); totalEmissiveRadiance *= 1. + core*5.*(.8+.2*sin(uTime*2.));`),
  stone: () => patch(std('#a59f91', 0, .95), { uTime: TIME }, `
    float v = smoothstep(.93, 1., sin(vObj.y*55. + sin(vObj.x*90.)*2.5 + fbm(vObj*20.)*4.));
    totalEmissiveRadiance = vec3(1.,.72,.3) * v * (.7 + .3*sin(uTime*.8));`),
  hole: () => new THREE.MeshBasicMaterial({ color: '#000000' }),
};
const SETS = {
  bronze: () => ({ iron: std('#6b5222', .9, .35), iron_light: std('#b08a3e', .9, .3), band: std('#c9a24a', .95, .3), grip: std('#e8dcc0', 0, .7) }),
  iron: () => ({ iron: std('#3a3a3e', .85, .42), iron_light: std('#5c5a5f', .9, .35), band: std('#77736c', .9, .35), grip: std('#5a3a22', .1, .75) }),
  rust: () => ({ iron: std('#5a3b28', .6, .8), iron_light: std('#7a5238', .6, .75), band: std('#6b4a32', .6, .8), grip: std('#8e2320', .05, .7) }),
  pearl: () => ({ iron: std('#cfcadb', .4, .3), iron_light: std('#e8e4f2', .5, .25), band: std('#b9c8da', .6, .3), grip: std('#3c3a52', .1, .6) }),
};

// ---------- added parts ----------
function halo(g, { r = .2, y = .66, color = '#ffc85a' } = {}) {
  const h = new Group(); h.position.set(0, y, -.06); g.add(h);
  const disc = new Mesh(new THREE.PlaneGeometry(r * 2, r * 2), additive({ map: textures().halo, color })); h.add(disc);
  const outer = new Mesh(new THREE.TorusGeometry(r * 1.06, .003, 6, 96), additive({ color, opacity: .8 })); h.add(outer);
  return t => { disc.rotation.z = t * .18; outer.rotation.y = Math.sin(t * .5) * .25; };
}
function nameRings(g, color) {
  const ring = (r, h, rep, op) => { const t = textures().strip.clone(); t.needsUpdate = true; t.repeat.set(rep, 1); return new Mesh(new THREE.CylinderGeometry(r, r, h, 64, 1, true), additive({ color, map: t, opacity: op })); };
  const name = ring(.1, .05, 1.4, 1), s1 = ring(.078, .018, 2.5, 1), s2 = ring(.078, .018, 2.5, 1);
  name.position.y = .40; s1.position.y = .31; s2.position.y = .49; g.add(name, s1, s2);
  for (const r of [.1, .078]) [-1, 1].forEach(k => { const e = new Mesh(new THREE.TorusGeometry(r, .0016, 4, 64).rotateX(Math.PI / 2), additive({ color, opacity: .5 })); e.position.y = r > .09 ? .40 + k * .026 : (k < 0 ? .31 : .49); g.add(e); });
  return t => { name.rotation.y = t * .25; s1.rotation.y = -t * 1.6; s2.rotation.y = -t * 1.6 + 1; };
}
function shards(g, mat, n = 3) {
  const list = []; for (let k = 0; k < n; k++) { const m = new Mesh(new THREE.OctahedronGeometry(.018), mat); g.add(m); list.push({ m, a: k * 2.1, y: .25 + k * .17, r: .11 + .02 * k }); }
  return t => list.forEach((s, i) => { const a = s.a + t * (.6 + i * .15); s.m.position.set(Math.cos(a) * s.r, s.y + Math.sin(t * 1.3 + i) * .02, Math.sin(a) * s.r); s.m.rotation.set(t, t * 1.3, 0); });
}
const PALE = () => new THREE.LineBasicMaterial({ color: '#e6dccb', transparent: true, opacity: .55 });
function circleLine(r, y, mat, seg = 96) {
  const pts = []; for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat); if (mat.isLineDashedMaterial) l.computeLineDistances(); return l;
}
function erasedGround(g, r) {                   // the hole's smooth, clean-edged scar, plus motes that stop existing at its edge
  const m = new Mesh(new THREE.CircleGeometry(r, 64), new THREE.MeshBasicMaterial({ color: '#000', polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.position.y = .004; g.add(m); g.add(circleLine(r, .006, PALE()));
  const n = 40, pos = new Float32Array(n * 3), st = [];
  for (let i = 0; i < n; i++) st.push({ a: Math.random() * 6.283, r: r + Math.random() * r * 2, y: .02 + Math.random() * .5, v: .1 * (.5 + Math.random()) });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#f1e6cf', size: 2.2, sizeAttenuation: false, transparent: true, opacity: .7 })));
  let last = 0;
  return t => {
    const dt = Math.min(.05, Math.max(0, t - last)); last = t;
    st.forEach((p, i) => { p.r -= p.v * dt * (.4 + p.r); p.a += dt * .25; if (p.r < r) { p.r = r * 3; p.a = Math.random() * 6.283; } pos.set([Math.cos(p.a) * p.r, p.y, Math.sin(p.a) * p.r], i * 3); });
    geo.attributes.position.needsUpdate = true;
  };
}
const jag = (x, B) => B + .02 * (Math.abs((((x * 48 + .3) % 1) + 1) % 1 - .5) * 2 - .5) + .007 * Math.sin(x * 170);
function cut(geo, B, keepUpper, gap = 0) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), j = jag(x, B); p.setY(i, keepUpper ? Math.max(y, j + gap) : Math.min(y, j - gap)); }
  p.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
}
function stretchHilt(parts, k) {
  for (const n of ['grip', 'band', 'iron', 'iron_light']) (parts[n] || []).forEach(o => {
    const p = o.geometry.attributes.position, y0 = G + .05;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > y0) p.setY(i, y0 + (y - y0) * k); }
    p.needsUpdate = true; o.geometry.computeBoundingSphere();
  });
}

// ---------- the designs: each returns { root (tip at origin), update?, height } ----------
const DESIGNS = {
  storyborn() { const b = base({ blade: M.gold(), ...SETS.bronze() }); return { root: b.root, update: halo(b.root, { r: .2, y: .67 }) }; },
  person() { const b = base({ blade: M.steel(), ...SETS.iron() }); return { root: b.root, update: nameRings(b.root, '#ffd58a') }; },
  godling() { const blade = M.opal('#d6e6ee', '#9fd8ff'), b = base({ blade, ...SETS.pearl() }); return { root: b.root, update: shards(b.root, blade) }; },
  voided() {
    const h = M.hole(), b = base({ blade: h, iron: h }), pale = PALE();
    b.root.traverse(o => { if (o.isMesh) o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 50), pale)); });
    const g = new Group(); g.add(b.root); return { root: g, update: erasedGround(g, .3), sink: .06 };
  },
  fallen() {
    const B = .32, steel = std('#8f949a', .85, .55), rust = SETS.rust();
    const b = base({ blade: steel, ...rust }), geo = b.parts.blade[0].geometry; cut(geo, B, true);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setX(i, x * (1 - .28 * Math.exp(-(((y - .44) / .012) ** 2)) * (x > 0) - .22 * Math.exp(-(((y - .53) / .01) ** 2)) * (x < 0))); }
    geo.computeVertexNormals();
    const g = new Group(); b.root.position.y = -(B + .005); b.root.rotation.z = .1; g.add(b.root);
    const tip = base({ blade: steel, ...rust }).parts.blade[0]; tip.removeFromParent(); cut(tip.geometry, B, false, .004);
    tip.geometry.translate(0, -B / 2, 0); tip.rotation.set(-Math.PI / 2, 0, 0);
    const lie = new Group(); lie.add(tip); lie.position.set(.2, .0065, .12); lie.rotation.y = .9; g.add(lie);
    return { root: g, sink: 0, height: PIN_HEIGHT - B - .005 };
  },
  unbound() {
    const g = new Group(), H = .5;
    const below = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), above = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const solid = { blade: std('#2a2733', .9, .25, { emissive: '#3b2a66', emissiveIntensity: .35 }), iron: std('#141318', .9, .35), iron_light: std('#2b2833', .9, .3), band: std('#2b2833', .9, .3), grip: std('#0c0b0f', .2, .6) };
    Object.values(solid).forEach(m => { m.clippingPlanes = [below]; });
    const ghost = additive({ color: '#ffb238', opacity: .16, clippingPlanes: [above] });
    g.add(base(solid).root, base({ blade: ghost, iron: ghost }).root);
    const bar = new Mesh(new THREE.CircleGeometry(.32, 48), additive({ map: textures().hex, color: '#ffb238', opacity: .6 })); bar.rotation.x = -Math.PI / 2; bar.position.y = H; g.add(bar);
    const v = new THREE.Vector3();
    return { root: g, update: t => { g.updateWorldMatrix(true, false); const y = g.localToWorld(v.set(0, H, 0)).y; below.constant = y; above.constant = -y; bar.rotation.z = t * .1; } };
  },
  primordial() { const s = M.stone(), b = base({ blade: s, iron: s }); return { root: b.root }; },
  orin(opts) {
    const SEAL = { value: opts.seal ?? .35 };
    const blade = patch(std('#ffffff', .35, .25, { vertexColors: true, emissive: '#3f9a6a', emissiveIntensity: .25 }), { uTime: TIME, uSeal: SEAL }, `
      float s = clamp((0.63 - vObj.y)/0.63, 0., 1.);
      float fr = uSeal*1.25 - (s + fbm(vObj*38.)*.38);
      float cor = smoothstep(0., .015, fr);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.035,.018,.05), cor);
      totalEmissiveRadiance *= 1. - cor;
      totalEmissiveRadiance += vec3(.55,.28,1.) * smoothstep(.05, 0., abs(fr)) * step(.001, uSeal) * (1.4 + .6*sin(uTime*3. + vObj.y*40.));`);
    const b = base({ blade, iron: std('#2a2b2f', .85, .42), iron_light: std('#5c5a5f', .9, .35), band: std('#444b51', .9, .35), grip: std('#141416', .1, .75) });
    return { root: b.root, seal: SEAL };
  },
  nera() {
    const B = .36, steel = std('#9aa0a7', .85, .4), cyan = '#7ff3ff', T = textures();
    const mats = { blade: steel, iron: std('#2d3035', .85, .4), iron_light: std('#55606a', .85, .35), band: std('#2a2d31', .8, .35, { emissive: '#3fd8e6', emissiveIntensity: .7 }), grip: std('#8e2320', .05, .7) };
    const b = base(mats); cut(b.parts.blade[0].geometry, B, true, .004); stretchHilt(b.parts, 1.45);
    const low = base(mats).parts.blade[0]; low.removeFromParent(); cut(low.geometry, B, false, .004);
    low.position.x = .004; low.rotation.z = .025; b.root.add(low);
    const plate = std('#3a3f46', .8, .45), bolt = std('#9aa3ad', .9, .3), R = b.root, words = [];
    for (const z of [-1, 1]) {
      const pl = new Mesh(new THREE.BoxGeometry(.136, .085, .006), plate); pl.position.set(0, B, z * .0098); R.add(pl);
      for (const [bx, by] of [[-.052, .03], [.052, .03], [-.052, -.03], [.052, -.03]]) { const bo = new Mesh(new THREE.CylinderGeometry(.0045, .0045, .004, 8).rotateX(Math.PI / 2), bolt); bo.position.set(bx, B + by, z * .0135); R.add(bo); }
      const t = T.words.clone(); t.needsUpdate = true; t.repeat.set(1.6, 1); words.push(t);
      const w = new Mesh(new THREE.PlaneGeometry(.088, .024), additive({ color: cyan, map: t, side: THREE.FrontSide })); w.position.set(0, B, z * .0132); if (z < 0) w.rotation.y = Math.PI; R.add(w);
    }
    for (const x of [-1, 1]) { const c = new Mesh(new THREE.BoxGeometry(.012, .092, .03), plate); c.position.set(x * .072, B, 0); R.add(c); }
    const box = new Mesh(new THREE.BoxGeometry(.02, .04, .014), std('#1d2024', .7, .5)); box.position.set(.035, .70, .024); R.add(box);
    const slot = new Mesh(new THREE.PlaneGeometry(.006, .028), new THREE.MeshBasicMaterial({ color: cyan })); slot.position.set(.035, .70, .0315); R.add(slot);
    const curve = new THREE.CatmullRomCurve3([[.035, .68, .026], [.05, .62, .036], [.075, .56, .03], [.076, .48, .016], [.072, .405, .006]].map(p => new THREE.Vector3(...p)));
    const pulse = T.pulse.clone(); pulse.needsUpdate = true; pulse.repeat.set(3, 1);
    R.add(new Mesh(new THREE.TubeGeometry(curve, 40, .0035, 6), std('#1b1d20', .5, .5, { emissive: cyan, emissiveMap: pulse, emissiveIntensity: 2 })));
    const lens = new Mesh(new THREE.SphereGeometry(.013, 16, 12), new THREE.MeshBasicMaterial({ color: cyan })); lens.position.y = G + .05 + .375 * 1.45 + .01; R.add(lens);
    return { root: R, height: lens.position.y + .02, update: t => { pulse.offset.x = -t * .6; words.forEach(w => { w.offset.x = t * .05; }); lens.material.color.setHSL(.51, 1, .62 + .12 * Math.sin(t * 2)); } };
  },
  yona() {
    const blade = patch(new THREE.MeshPhysicalMaterial({ color: '#ff9ad5', metalness: 0, roughness: .1, iridescence: 1, iridescenceIOR: 1.4, transparent: true, emissive: '#ff6fc0', emissiveIntensity: .35 }), { uTime: TIME }, `
      float a = max(1. - smoothstep(0., .05, abs(vObj.y-.22)), 1. - smoothstep(0., .035, abs(vObj.y-.46)));
      vec2 cell = fract(vObj.xy*95.) - .5; if (length(cell) < a*.62) discard;
      totalEmissiveRadiance *= 1. + a*1.5;`);
    const soft = (c, m, r) => std(c, m, r, { transparent: true });
    const mats = { blade, iron: soft('#e9d2ec', .4, .3), iron_light: soft('#ffd1ef', .5, .25), band: soft('#f3b8e0', .5, .3), grip: soft('#7d4a8a', .1, .6) };
    const b = base(mats), g = b.root;
    const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? .014 : .034; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    const star = new Mesh(new THREE.ExtrudeGeometry(sh, { depth: .008, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 1 }).center(), std('#ffb3e2', .2, .3, { emissive: '#ff5fbf', emissiveIntensity: 1.2 }));
    g.add(star);
    const fade = Object.values(mats), front = new THREE.Vector3(), to = new THREE.Vector3(), wp = new THREE.Vector3(), q = new THREE.Quaternion();
    return { root: g, height: 1.16, update: (t, camera) => {
      star.rotation.y = t * 1.2; star.position.y = 1.12 + Math.sin(t * 1.6) * .012;
      if (!camera) return;
      g.getWorldQuaternion(q); g.getWorldPosition(wp);
      front.set(0, 0, 1).applyQuaternion(q).setY(0).normalize(); to.copy(camera.position).sub(wp).setY(0).normalize();
      const op = .1 + .8 * THREE.MathUtils.smoothstep(Math.abs(front.dot(to)), .35, .97);
      fade.forEach(m => { m.opacity = op; m.depthWrite = op > .6; });
    } };
  },
  gaia() {
    const b = base({ blade: M.gold(), ...SETS.bronze() }), g = new Group(); g.add(b.root); g.scale.setScalar(1.3);
    return { root: g, update: halo(b.root, { r: .27, y: .67 }), height: PIN_HEIGHT * 1.3 };
  },
  val() { const d = DESIGNS.voided(); d.root.scale.setScalar(1.15); return { ...d, height: PIN_HEIGHT * 1.15 }; },
};

const RING_ON = new Set(['orin', 'nera', 'yona', 'gaia']);
const RING_COLOR = { orin: '#9b6bff', nera: '#5fe0e6', yona: '#ff8fd0', gaia: '#9ccf6a' };
// A pin, standing: group origin = where the blade enters the ground (the tip is sunk a little below it).
export function buildPin(design = 'person', opts = {}) {
  if (!TEMPLATE) throw new Error('loadPins() first');
  const d = (DESIGNS[design] || DESIGNS.person)(opts);
  const group = new Group(), sink = d.sink ?? .07;
  d.root.position.y -= sink; group.add(d.root);
  const ringColor = opts.ring === false ? null : (RING_COLOR[design] || (typeof opts.ring === 'string' ? opts.ring : null));
  if (ringColor && (RING_ON.has(design) || opts.ring)) {
    const ring = new Mesh(new THREE.TorusGeometry(.075, .012, 6, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: ringColor }));
    ring.position.y = .03; group.add(ring);
  }
  return {
    group, design, height: (d.height ?? PIN_HEIGHT) - sink, seal: d.seal,
    update(t, camera) { TIME.value = t; d.update?.(t, camera); }
  };
}

// ---------- a site page stands the pin, giant, in its own scene ----------
// spots: [[x, z], ...] tried in order; the first whose ground (raycast onto `ground`) is below maxY wins.
export async function placeGiant({ scene, ground, camera, controls, renderer, spots, maxY = Infinity, height = 10, design, ring }) {
  await loadPins();
  if (renderer) renderer.localClippingEnabled = true;
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  let at = null;
  for (const [x, z] of spots) {
    ray.set(new THREE.Vector3(x, 500, z), down);
    const hit = ray.intersectObject(ground, true).find(h => h.object.visible && h.object.isMesh);
    if (hit && hit.point.y <= maxY) { at = hit.point; break; }
  }
  if (!at) { ray.set(new THREE.Vector3(spots[0][0], 500, spots[0][1]), down); const h = ray.intersectObject(ground, true)[0]; at = h ? h.point : new THREE.Vector3(spots[0][0], 0, spots[0][1]); }
  const pin = buildPin(design, { ring });
  const s = height / pin.height;
  pin.group.scale.setScalar(s); pin.group.position.copy(at); pin.group.rotation.y = .6;
  pin.group.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  scene.add(pin.group);
  if (camera && controls) {
    const target = at.clone().add(new THREE.Vector3(0, height * .5, 0));
    const off = camera.position.clone().sub(controls.target);
    controls.target.copy(target); camera.position.copy(target).add(off);
    if (camera.isOrthographicCamera) {
      const z = (camera.top - camera.bottom) / (height * 2.1);
      controls.maxZoom = Math.max(controls.maxZoom, z * 2.5); camera.zoom = z; camera.updateProjectionMatrix();
    }
    controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches; controls.update();
  }
  return pin;
}
