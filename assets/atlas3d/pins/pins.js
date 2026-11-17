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
const CHAR_DESIGNS = { orin: 'orin', nera: 'nera', yona: 'yona', gaia: 'gaia', val: 'val', vale: 'vale' };
// swords that need the name AND the type (Dossier race): the Primordials' own forms, and Lithia as an Unbound god.
// No god swords for Antholonious (split at the siege), Sils (sealed in Orin) or Moinera (she became the dreamscape).
const NAME_AND_TYPE = [
  { names: ['grisha', 'chaos', 'universe'], type: 'primordial', design: 'grisha' },
  { names: ['sils', 'silence'], type: 'primordial', design: 'sils' },
  { names: ['antholonious'], type: 'primordial', design: 'antholonious' },
  { names: ['moinera'], type: 'primordial', design: 'moinera' },
  { names: ['lithia'], type: 'primordial', design: 'lithia' },
  { names: ['lithia'], type: 'unbound', design: 'lithiaGod' }
];
const TYPE_DESIGNS = { storyborn: 'storyborn', person: 'person', godling: 'godling', voided: 'voided', fallen: 'fallen', unbound: 'unbound', primordial: 'primordial' };
export const DESIGN_LABEL = {
  storyborn: 'Storyborn', person: 'Person', godling: 'Godling', voided: 'Voided', fallen: 'Fallen', unbound: 'Unbound', primordial: 'Primordial',
  orin: 'Twisted Storyborn', nera: 'Fallen · technical scythe', yona: 'Godling · Dreamling', gaia: 'Storyborn', val: 'Unbound · the hole',
  vale: 'The first Storyborn · Twin Serpents', grisha: 'Chaos · katana', sils: 'Nothing · Terminus Harvester', antholonious: 'Primordial · Fate',
  moinera: 'Imagination · dual blades', lithia: 'Reality · scissor blade', lithiaGod: 'Unbound · scissor blade, broken'
};
export function designFor(char) {
  const first = String(char && char.name || '').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
  const type = String(char && (char.race || char.type) || '').toLowerCase();
  const special = NAME_AND_TYPE.find(r => r.type === type && r.names.includes(first));
  if (special) return special.design;
  if (CHAR_DESIGNS[first]) return CHAR_DESIGNS[first];
  return TYPE_DESIGNS[type] || 'person';
}

// ---------- the model ----------
// Other sword shapes (tools/map/sword_shapes.py → swords.glb), same layout as the greatsword: tip at the origin,
// guard at y = 0.63. Character weapons: grisha_katana, nera_scythe, moinera_dagger ×2; traced from their references with painted
// textures (tools/map/trace_weapons.py): scissor (Lithia), harvester_long + harvester_broad (Sils), serpent_a + serpent_b (Vale);
// plus stiletto (Yona), zweihander (Gaia), executioner (Val), estoc (Antholonious).
// Kept for future characters:
export const SPARE_SHAPES = ['katana', 'rapier', 'sawback', 'falchion', 'sabre', 'flamberge', 'khopesh', 'scimitar', 'gladius'];
const SHAPES = {};
let TEMPLATE = null, loading = null;
export function loadPins(url = new URL('greatsword.glb?v=1', import.meta.url).href, shapesUrl = new URL('swords.glb?v=3', import.meta.url).href) {
  if (TEMPLATE) return Promise.resolve(TEMPLATE);
  const shapes = new GLTFLoader().loadAsync(shapesUrl).then(g => { g.scene.children.forEach(o => { SHAPES[o.name] = o; }); })
    .catch(e => console.warn('Sword shapes not loaded; pins fall back to the greatsword.', e));
  return loading ||= shapes.then(() => new GLTFLoader().loadAsync(url)).then(g => {
    g.scene.traverse(o => {
      if (!o.isMesh || o.material.name !== 'blade') return;
      const geo = o.geometry, sets = ['color', 'color_1'].map(n => geo.getAttribute(n)).filter(Boolean);
      const spread = a => { let lo = 9, hi = -9; for (let i = 0; i < a.count; i += 7) { const v = a.getX(i); lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; };
      if (sets.length) geo.setAttribute('color', sets.sort((a, b) => spread(b) - spread(a))[0]);   // the jade gradient
    });
    return (TEMPLATE = g.scene);
  });
}
// keepMaps: traced weapons carry a texture painted from their reference; the design's materials take it on (effects go on top)
function base(mats, shape = 'greatsword', keepMaps = false) {
  const root = (shape !== 'greatsword' && SHAPES[shape] ? SHAPES[shape] : TEMPLATE).clone(true), parts = {};
  root.position.set(0, 0, 0);
  root.traverse(o => { if (o.isMesh) { const n = o.material.name.split('.')[0]; o.userData.srcMap = o.material.map; o.geometry = o.geometry.clone(); o.castShadow = true; (parts[n] ||= []).push(o); } });
  for (const [n, list] of Object.entries(parts)) list.forEach(o => {
    o.material = mats[n] ?? mats.grip ?? mats.iron;
    if (keepMaps && o.userData.srcMap && !o.material.map) { o.material.map = o.userData.srcMap; o.material.needsUpdate = true; }
  });
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

const topOf = o => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o).max.y; };
// ---------- the designs: each returns { root (tip at origin), update?, height } ----------
const DESIGNS = {
  storyborn() { const b = base({ blade: M.gold(), ...SETS.bronze() }); return { root: b.root, update: halo(b.root, { r: .2, y: .67 }) }; },
  person() { const b = base({ blade: M.steel(), ...SETS.iron() }); return { root: b.root, update: nameRings(b.root, '#ffd58a') }; },
  godling() { const blade = M.opal('#d6e6ee', '#9fd8ff'), b = base({ blade, ...SETS.pearl() }); return { root: b.root, update: shards(b.root, blade) }; },
  voided(opts = {}, shape = 'greatsword') {
    const h = M.hole(), b = base({ blade: h, iron: h }, shape), pale = PALE();
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
  // Nera: a technical scythe, planted spike-down (her own take, not a copy): Fallen steel, machined collars with pulsing cyan
  // panels, a folding blade and a back hook, a red-wrapped grip section
  nera() {
    const pulse = textures().pulse.clone(); pulse.needsUpdate = true; pulse.repeat.set(2, 1);
    const b = base({ blade: std('#a3a9b0', .9, .3), iron: std('#2d3035', .85, .4), iron_light: std('#8e2320', .2, .6), band: std('#1b1d20', .5, .5, { emissive: '#5fe8f0', emissiveMap: pulse, emissiveIntensity: 2.2 }), grip: std('#24272b', .6, .45) }, 'nera_scythe');
    const g = new Group(); g.add(b.root); g.scale.setScalar(.8);
    return { root: g, height: topOf(g), update: t => { pulse.offset.x = -t * .5; } };
  },
  // Yona: a stiletto of pink dream-glass that fades unless you face it, a star above the pommel
  yona() {
    const blade = patch(new THREE.MeshPhysicalMaterial({ color: '#ff9ad5', metalness: 0, roughness: .1, iridescence: 1, iridescenceIOR: 1.4, transparent: true, emissive: '#ff6fc0', emissiveIntensity: .35 }), { uTime: TIME }, `
      float a = max(1. - smoothstep(0., .05, abs(vObj.y-.22)), 1. - smoothstep(0., .035, abs(vObj.y-.46)));
      vec2 cell = fract(vObj.xy*95.) - .5; if (length(cell) < a*.62) discard;
      totalEmissiveRadiance *= 1. + a*1.5;`);
    const soft = (c, m, r) => std(c, m, r, { transparent: true });
    const mats = { blade, iron: soft('#e9d2ec', .4, .3), iron_light: soft('#ffd1ef', .5, .25), band: soft('#f3b8e0', .5, .3), grip: soft('#7d4a8a', .1, .6) };
    const b = base(mats, 'stiletto'), g = b.root, top = topOf(g);
    const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? .014 : .034; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    const star = new Mesh(new THREE.ExtrudeGeometry(sh, { depth: .008, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 1 }).center(), std('#ffb3e2', .2, .3, { emissive: '#ff5fbf', emissiveIntensity: 1.2 }));
    g.add(star);
    const fade = Object.values(mats), front = new THREE.Vector3(), to = new THREE.Vector3(), wp = new THREE.Vector3(), q = new THREE.Quaternion();
    return { root: g, height: top + .1, update: (t, camera) => {
      star.rotation.y = t * 1.2; star.position.y = top + .06 + Math.sin(t * 1.6) * .012;
      if (!camera) return;
      g.getWorldQuaternion(q); g.getWorldPosition(wp);
      front.set(0, 0, 1).applyQuaternion(q).setY(0).normalize(); to.copy(camera.position).sub(wp).setY(0).normalize();
      const op = .1 + .8 * THREE.MathUtils.smoothstep(Math.abs(front.dot(to)), .35, .97);
      fade.forEach(m => { m.opacity = op; m.depthWrite = op > .6; });
    } };
  },
  // Gaia: a zweihänder in Storyborn gold, with its halo
  gaia() {
    const b = base({ blade: M.gold(), ...SETS.bronze() }, 'zweihander'), g = new Group(); g.add(b.root); g.scale.setScalar(1.25);
    return { root: g, update: halo(b.root, { r: .27, y: .67 }), height: topOf(g) };
  },
  // Val: an executioner's sword that is a hole in the world
  val() { const d = DESIGNS.voided({}, 'executioner'); d.root.scale.setScalar(1.15); return { ...d, height: topOf(d.root) }; },

  // Vale, the first Storyborn: the Twin Serpents, a pair of slender curved blades, side by side. Antholonious's soul in a body
  // the Scribe wrote its destiny on. Two states (shared by both blades), like Orin's seal:
  //   read  0..1  how much of the written destiny he has recognised: the verses light from the guard toward the tip
  //   void  0..1  how much of his hidden Voided side shows: black erasure breaking through the silver, pale at its edges
  vale(opts) {
    const READ = { value: opts.read ?? .3 }, VOID = { value: opts.void ?? 0 };
    const blade = patch(std('#ffffff', .85, .28, { emissive: '#ffd27a', emissiveIntensity: 1 }), { uTime: TIME, uGlyph: { value: textures().glyphs }, uRead: READ, uVoid: VOID }, `
      float g = texture2D(uGlyph, vec2(vObj.x*6.+.5, vObj.y*1.5)).a;
      float s = clamp((0.63 - vObj.y)/0.63, 0., 1.);                  // 0 at the guard, 1 at the tip
      float lit = 1. - smoothstep(uRead - .03, uRead, s);            // verses he has read
      float edge = smoothstep(.04, 0., abs(s - uRead)) * step(.001, uRead) * step(uRead, .999);
      totalEmissiveRadiance = emissive * g * (lit * (1.2 + .3*sin(uTime*2. + vObj.y*20.)) + (1. - lit) * .03) + vec3(1.,.85,.5) * edge * g * 2.;
      float n = fbm(vObj*30. + vec3(0., uTime*.05, 0.)), er = uVoid*1.15 - n;
      float blk = smoothstep(0., .02, er);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.), blk);
      totalEmissiveRadiance *= 1. - blk;
      totalEmissiveRadiance += vec3(.9,.86,.8) * smoothstep(.03, 0., abs(er)) * step(.001, uVoid) * .8;`);
    const mats = { blade, grip: std('#ffffff', .6, .4) };
    const g = new Group();
    const a = base(mats, 'serpent_a', true).root; a.position.x = -.06; a.rotation.z = -.08; g.add(a);
    const b = base(mats, 'serpent_b', true).root; b.position.x = .07; b.rotation.set(0, .5, .1); g.add(b);
    return { root: g, read: READ, void: VOID, height: topOf(g) };
  },

  // Grisha: Chaos, the Last Primordial. His katana: a long curved blade of red that churns like moving marble, a guard of black
  // scales, a wrapped grip, a diamond pommel with his red eye in it; a few shards circling at random
  grisha() {
    const blade = patch(std('#7d0d12', .7, .28, { emissive: '#ff2a1e', emissiveIntensity: 1 }), { uTime: TIME }, `
      float n = fbm(vObj*vec3(18., 6., 18.) + vec3(uTime*.15, -uTime*.25, uTime*.1));
      float m = fbm(vObj*vec3(40., 14., 40.) - vec3(0., uTime*.4, 0.) + n*2.);
      diffuseColor.rgb = mix(vec3(.55,.03,.05), vec3(.12,.0,.02), smoothstep(.35, .75, m));
      float vein = smoothstep(.62, .68, m) * (1. - smoothstep(.68, .74, m));
      totalEmissiveRadiance = emissive * (vein * (1. + .5*sin(uTime*4. + n*20.)) + .08);`);
    const eyeMat = std('#2a0a0c', .6, .3, { emissive: '#ff3a2a', emissiveIntensity: 1 });
    const b = base({ blade, iron: std('#16131a', .85, .3), iron_light: eyeMat, band: std('#2a2226', .6, .45), grip: std('#0e0c10', .2, .65) }, 'grisha_katana'), g = b.root;
    const spin = shards(g, std('#3a2a2e', .7, .3, { emissive: '#ff3a2a', emissiveIntensity: .6 }), 3);
    return { root: g, height: topOf(g), update: t => { spin(t * (1 + .5 * Math.sin(t * 2.3))); eyeMat.emissiveIntensity = .7 + .6 * Math.abs(Math.sin(t * 3.1)); } };
  },

  // Sils: Nothing. The Terminus Harvester, two black blades crossed in the ground like a grave marker, white crosses on their
  // guards, blue at the edges; both keep coming apart and reforming (his cycle of death)
  sils() {
    const blade = patch(std('#ffffff', .5, .4, { emissive: '#e6dccb', emissiveIntensity: 1 }), { uTime: TIME }, `
      float cyc = .5 + .5*sin(uTime*.6);                              // apart … whole … apart
      float n = fbm(vObj*26. + vec3(0., uTime*.1, 0.));
      if (n < cyc*.6 - .05) discard;
      float rim = smoothstep(.06, 0., n - (cyc*.6 - .05));
      totalEmissiveRadiance = emissive * rim * 1.5;`);
    const mats = { blade, grip: std('#ffffff', .4, .5) };
    const g = new Group();
    const a = base(mats, 'harvester_long', true).root; a.position.x = -.13; a.rotation.z = -.36; g.add(a);
    const b = base(mats, 'harvester_broad', true).root; b.position.x = .13; b.rotation.z = .36; g.add(b);
    return { root: g, height: topOf(g), update: erasedGround(g, .3) };
  },

  // Antholonious: Fate, the Author Beyond Pages. An estoc, its point a quill nib, in pale stone written with gold;
  // above the guard it breaks into square fragments drifting up like torn pages
  antholonious() {
    const blade = patch(std('#d9d6cf', 0, .9, { emissive: '#ffe7a8', emissiveIntensity: 1 }), { uTime: TIME, uGlyph: { value: textures().glyphs } }, `
      float g = texture2D(uGlyph, vec2(vObj.x*6.+.5, vObj.y*1.5 - uTime*.02)).a;
      totalEmissiveRadiance = emissive * g * .9;`);
    const st = std('#bdb8ae', 0, .9), b = base({ blade, iron: st, iron_light: std('#e8e4dc', 0, .85), band: std('#9a7a3a', .8, .35), grip: std('#a9a59c', 0, .9) }, 'estoc'), g = b.root;
    const frags = [], fm = std('#e8e4dc', 0, .85, { emissive: '#ffe7a8', emissiveIntensity: .25 });
    for (let k = 0; k < 14; k++) { const m = new Mesh(new THREE.BoxGeometry(.018, .018, .004), fm.clone()); m.material.transparent = true; g.add(m); frags.push({ m, x: (Math.random() - .5) * .12, z: (Math.random() - .5) * .05, ph: Math.random(), sp: .25 + Math.random() * .2 }); }
    return { root: g, height: topOf(g), update: t => frags.forEach(f => { const u = (t * f.sp + f.ph) % 1; f.m.position.set(f.x + Math.sin(t + f.ph * 9) * .01, G + .05 + u * .55, f.z); f.m.rotation.set(t * 2 + f.ph * 9, t + f.ph, 0); f.m.material.opacity = 1 - u; }) };
  },

  // Moinera: Imagination. Her dual blades: two daggers of dark dream-opal that ripple and shift, red-wrapped handles,
  // joined by a chain that sags between them
  moinera() {
    const blade = patch(new THREE.MeshPhysicalMaterial({ color: '#2a2230', metalness: .3, roughness: .12, iridescence: 1, iridescenceIOR: 1.7, emissive: '#c9a8ff', emissiveIntensity: .25 }), { uTime: TIME }, `
      totalEmissiveRadiance *= 1. + .9*sin(uTime*1.3 + vObj.y*14.);`,
      `float w = smoothstep(.0, .6, position.y) * step(position.y, .62);
       transformed.x += sin(position.y*16. + uTime*1.6) * .01 * w;
       transformed.z += cos(position.y*11. - uTime*1.1) * .007 * w;
       transformed.x *= 1. + .18*sin(uTime*.9 + position.y*5.) * w;`);
    const mats = { blade, iron: std('#141218', .8, .35), iron_light: std('#2a262e', .9, .3), band: std('#3a0d14', .4, .5), grip: std('#6e1a24', .1, .6) };
    const g = new Group(), S = .82;
    const a = base(mats, 'moinera_dagger').root; a.scale.setScalar(S); a.position.x = -.13; a.rotation.z = .1; g.add(a);
    const b = base(mats, 'moinera_dagger').root; b.scale.setScalar(S); b.position.set(.13, 0, .03); b.rotation.set(0, .6, -.12); g.add(b);
    // the chain: links hung from each dagger's ring, sagging between them
    const ring = (o, sgn) => { o.updateWorldMatrix(true, true); const box = new THREE.Box3().setFromObject(o); return new THREE.Vector3((box.min.x + box.max.x) / 2 + sgn * .01, box.max.y - .02, 0); };
    const pA = ring(a, 1), pB = ring(b, -1), mid = pA.clone().lerp(pB, .5).add(new THREE.Vector3(0, -.62, .1));
    const curve = new THREE.QuadraticBezierCurve3(pA, mid, pB), chain = new Group(), linkMat = std('#16141a', .9, .35);
    const N = 46, geo = new THREE.TorusGeometry(.011, .0032, 6, 12), up = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const u = i / N, l = new Mesh(geo, linkMat); l.position.copy(curve.getPointAt(u));
      const tg = curve.getTangentAt(u); l.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tg); if (i % 2) l.rotateX(Math.PI / 2);
      chain.add(l);
    }
    g.add(chain);
    return { root: g, height: topOf(g), update: t => { chain.rotation.x = Math.sin(t * .8) * .03; } };
  },

  // Lithia: Reality, the blood-red angel. Her scissor blade (one half of a giant pair; her own take): deep red with a pale rose
  // stripe, drips running down into a dark pool
  lithia() {
    const blade = patch(std('#ffffff', .4, .4, { emissive: '#d0303a', emissiveIntensity: 1 }), { uTime: TIME }, `
      float col = floor(vObj.x*90.), sp = .1 + fract(sin(col*12.9898)*43758.5)*.15, ph = fract(sin(col*7.31)*911.1);
      float drip = smoothstep(.0, .02, fract(vObj.y*2. + uTime*sp + ph) - .9) * step(fract(col*.37), .45);
      totalEmissiveRadiance = emissive * drip * 1.4;`);
    const b = base({ blade, grip: std('#ffffff', .3, .5) }, 'scissor', true);
    const g = new Group(); g.add(b.root);
    const pool = new Mesh(new THREE.CircleGeometry(.16, 48), std('#3a060a', .3, .15, { emissive: '#640a10', emissiveIntensity: .4, polygonOffset: true, polygonOffsetFactor: -2 }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = .004; g.add(pool);
    return { root: g, sink: .06, height: topOf(b.root), update: t => { pool.scale.setScalar(1 + .04 * Math.sin(t * 1.1)); } };
  },

  // Lithia as an Unbound god, wounded from the war: her scissor blade broken off and cracked, bound in stained wraps,
  // coming down through its barrier in her red
  lithiaGod() {
    const g = new Group(), H = .42, BRK = .2;
    const below = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), above = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const blade = patch(std('#b89090', .5, .35, { emissive: '#a3141a', emissiveIntensity: 1 }), { uTime: TIME }, `
      float c = abs(vObj.x - .012*sin(vObj.y*60.)) ;
      float crack = (1. - smoothstep(.0, .004, c)) * step(.24, vObj.y) * step(vObj.y, .55);
      totalEmissiveRadiance = emissive * (crack * (1.5 + .5*sin(uTime*3.)) + .08);`);
    const solid = { blade, grip: std('#c8a8a8', .3, .5) };
    Object.values(solid).forEach(m => { m.clippingPlanes = [below]; });
    const ghost = additive({ color: '#d0303a', opacity: .16, clippingPlanes: [above] });
    for (const mats of [solid, { blade: ghost, iron: ghost, grip: ghost }]) {      // broken off at BRK: the jagged end stands in the ground
      const b = base(mats, 'scissor', mats === solid); cut(b.parts.blade[0].geometry, BRK, true); b.root.position.y = -BRK; g.add(b.root);
    }
    const wrap = std('#d8cfc4', 0, .9), stain = std('#8e1a20', 0, .8);
    for (const [y, m] of [[.08, wrap], [.11, stain], [.17, wrap], [.23, wrap], [.255, stain]]) {
      const w = new Mesh(new THREE.CylinderGeometry(.06, .062, .022, 16, 1, true).scale(1, 1, .32), m); w.position.y = y; w.rotation.z = (y * 37 % 1 - .5) * .25; w.material.side = THREE.DoubleSide; w.material.clippingPlanes = [below]; g.add(w);
    }
    const bar = new Mesh(new THREE.CircleGeometry(.32, 48), additive({ map: textures().hex, color: '#d0303a', opacity: .55 })); bar.rotation.x = -Math.PI / 2; bar.position.y = H; g.add(bar);
    const v = new THREE.Vector3();
    return { root: g, sink: 0, height: topOf(g), update: t => { g.updateWorldMatrix(true, false); const y = g.localToWorld(v.set(0, H, 0)).y; below.constant = y; above.constant = -y; bar.rotation.z = t * .1; } };
  },
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
    group, design, height: (d.height ?? PIN_HEIGHT) - sink, seal: d.seal, read: d.read, void: d.void,
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
