/* Epitaph — Aurelia, the first site (sites/aurelia.html; opened from the map and the Atlas) (three.js, built in code, Temple-of-the-Voided recipe).
 *
 * A Storyborn settlement in Kansas (Atlas: 39.5N 98W), on a low limestone bluff above the
 * Solomon River valley: white stone and gold, a city of progress, written on everywhere.
 *   Upper city    three ring terraces, the Cathedral of the Storyborn, the Ruler's Tower (no doors),
 *                 the Chronicle clock, a low wall with towers along the bluff edge
 *   Seminary      on its own knoll across a bridge: where Orin takes the priest's test
 *   Orin's home   a family house with a garden on the west ring (the Calamity's epicentre)
 *   Undercroft    cut away in the north slope: Nera's Voided lab (brutalist, void light),
 *                 a trapdoor and a secret passage to a hatch in the prairie
 *   Valley        the river, a wharf and barges, the lower town, prairie fields; a funicular
 * After the Calamity: erased outward from Orin, the ground left smooth and black; Nera at the hatch.
 * ?view=lab aims at the lab; ?after=1, ?theme=paper.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = id => document.getElementById(id);
const PI = Math.PI;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const THEMES = {
  crt: {
    bg: '#080603', stone: '#d6cab0', trim: '#a89062', roof: '#3d4d6b', gold: '#d9a23a', dark: '#1c150d', earth: '#4a3822', earth2: '#3a2c1a',
    water: '#2a5a6e', leaf: '#4f6b3a', grass: '#33401f', bank: '#2a2416', fields: ['#7a6428', '#4f5f26', '#6b4f2a', '#8a7a3e'], barn: '#7a2e22', glow: '#ffbf4a', glowBoost: 2.2, ember: '#ff5a36', ink: '#040302',
    hemiSky: '#ffe9c4', hemiGround: '#20160c', hemi: 0.8, key: '#ffe2b8', keyI: 1.9, rim: '#ffb238', rimI: 0.9,
    env: 0.18, shadowOpacity: 0.65, outlinePx: 1.25, bloom: 0.55, scar: '#07060a'
  },
  paper: {
    bg: '#f6eddd', stone: '#f3ede2', trim: '#d9c49a', roof: '#4a5f86', gold: '#e0a02a', dark: '#2a2a3a', earth: '#c9b48e', earth2: '#ad9870',
    water: '#6a86c4', leaf: '#86ab62', grass: '#bccb8e', bank: '#a8946c', fields: ['#e6cf7e', '#a9c27a', '#d1a86c', '#cdd59a'], barn: '#c4563a', glow: '#ff9a3c', glowBoost: 1, ember: '#e8392e', ink: '#141a2c',
    hemiSky: '#fffaf3', hemiGround: '#c2ae90', hemi: 1.15, key: '#fff6ea', keyI: 2.1, rim: '#ffffff', rimI: 0.3,
    env: 0.45, shadowOpacity: 0.28, outlinePx: 1.4, bloom: 0, scar: '#0d0c12'
  }
};

// ------------------------------------------------------------------ helpers
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function xf(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1 } = {}) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  geo.applyMatrix4(new THREE.Matrix4().compose(V(x, y, z), q, V(s, s, s)));
  return geo;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const cyl = (r1, r2, h, seg = 12) => new THREE.CylinderGeometry(r1, r2, h, seg).translate(0, h / 2, 0);
const cone = (r, h, seg = 8) => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0);
const dome = (r, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(4, seg / 2), 0, PI * 2, 0, PI / 2);
function roundArch(w, h) {            // round-topped window/door, base at y=0, facing +z
  const s = new THREE.Shape(), sy = Math.max(0.01, h - w / 2);
  s.moveTo(-w / 2, 0); s.lineTo(-w / 2, sy); s.absarc(0, sy, w / 2, PI, 0, true); s.lineTo(w / 2, 0); s.closePath();
  return s;
}
function gable(len, w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2); }
function mansard(w, d, h) {           // a hipped mansard: frustum of a box
  const g = new THREE.CylinderGeometry(Math.SQRT1_2 * 0.62, Math.SQRT1_2, 1, 4, 1).rotateY(PI / 4).translate(0, 0.5, 0);
  return g.scale(w, h, d);
}
function jitter(geo, amt, seed) {
  const p = geo.attributes.position;
  const h = (a, b, c, k) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + k * 19.3 + seed) * 43758.5453; return s - Math.floor(s) - 0.5; };
  for (let i = 0; i < p.count; i++) { const x = +p.getX(i).toFixed(3), y = +p.getY(i).toFixed(3), z = +p.getZ(i).toFixed(3); p.setXYZ(i, x + h(x, y, z, 1) * amt, y + h(x, y, z, 2) * amt * 0.4, z + h(x, y, z, 3) * amt); }
  geo.computeVertexNormals(); return geo;
}
class Kit {
  constructor() { this.b = {}; }
  add(kind, g) {
    if (g.index) g = g.toNonIndexed();
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.clearGroups();
    (this.b[kind] ||= []).push(g);
  }
  merge() { const o = {}; for (const [k, l] of Object.entries(this.b)) o[k] = mergeGeometries(l, false); return o; }
}

// ------------------------------------------------------------------ layout constants
const PLATEAU_R = 19, CLIFF = 3.6, FLOOR = -CLIFF;    // a low bluff: limestone caprock on top, grass slopes below
const CAP = 1.0;                                        // height of the caprock ledge
const SP = th => 3.6 + Math.sin(th * 5 + 0.7) * 0.7 + Math.sin(th * 11 + 2.1) * 0.35;   // how far the slope runs out
const slopeY = t => -CAP - (CLIFF - CAP) * (1 - Math.pow(1 - t, 1.7));
// a ring of slope around a hill: from just under its caprock down to the valley floor
const SKIRT_N = 140, SKIRT_K = 7;
function skirtPoint(cx, cz, rTop, topY, spread, seed, i, k) {
  const th = i / SKIRT_N * PI * 2, t = k / SKIRT_K;
  const gully = Math.pow(Math.max(0, Math.sin(th * 7 + seed)), 12) * 1.4 * t;   // shallow gullies cut into the slope
  const r = rTop(th) + spread(th) * t - gully + Math.sin(th * 23 + k * 1.7 + seed) * 0.18 * t * (1 - t) * 4;
  const y = topY - (topY - FLOOR) * (1 - Math.pow(1 - t, 1.7)) - gully * 0.25 * (1 - t) + (k === SKIRT_K ? -0.05 : 0);
  return [cx + Math.cos(th) * r, y, cz + Math.sin(th) * r];
}
function hillSkirt(kit, cx, cz, rTop, topY, spread, kind, seed, skip = () => false) {
  const N = SKIRT_N, K = SKIRT_K, pos = [], idx = [];
  for (let k = 0; k <= K; k++) for (let i = 0; i <= N; i++) pos.push(...skirtPoint(cx, cz, rTop, topY, spread, seed, i, k));
  for (let k = 0; k < K; k++) for (let i = 0; i < N; i++) { if (skip(i, k)) continue; const a = k * (N + 1) + i, b = a + N + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  kit.add(kind, g);
}
const T1 = 0, T2 = 1.3, T3 = 2.6;                        // terrace tops
const SEM = V(28, 1.2, -3), SEM_R = 5.2;                 // seminary rock
// the plateau's rocky edge: radius at a world angle (shape is mirrored in z by the extrusion)
const rimShape = (R, amp, seed, a) => R + Math.sin(a * 3 + seed) * amp * 0.5 + Math.sin(a * 7 + seed * 2) * amp * 0.35 + Math.sin(a * 13 + seed) * amp * 0.15;
const rimR = th => rimShape(PLATEAU_R, 1.4, 1, -th);
const labels = [];
const L = (text, pos, opts = {}) => labels.push({ text, pos, ...opts });

// ------------------------------------------------------------------ building kit
function windowRow(kit, { x, y, z, ry, w, n, h, gap }) {
  for (let i = 0; i < n; i++) {
    const u = (i - (n - 1) / 2) * gap;
    const F = { x: x + Math.cos(ry) * u, y, z: z - Math.sin(ry) * u, ry };
    kit.add('trim', xf(new THREE.ExtrudeGeometry(roundArch(w + 0.12, h + 0.08), { depth: 0.06, bevelEnabled: false, curveSegments: 6 }), F));
    kit.add('glow', xf(new THREE.ShapeGeometry(roundArch(w, h), 6).translate(0, 0, 0.07), F));
  }
}
// an art-nouveau townhouse, front (+z local) facing ry
function townhouse(kit, r, { x, y, z, ry, w, d, h }) {
  const F = (o = {}) => ({ x, y, z, ry, ...o });
  const local = (lx, ly, lz) => ({ x: x + Math.cos(ry) * lx + Math.sin(ry) * lz, y: y + ly, z: z - Math.sin(ry) * lx + Math.cos(ry) * lz, ry });
  kit.add('stone', xf(box(w, h, d), F()));
  kit.add('trim', xf(box(w + 0.12, 0.22, d + 0.12), F({ y: y - 0.01 })));
  kit.add('trim', xf(box(w + 0.2, 0.14, d + 0.2), F({ y: y + h })));
  // the written band: a line of gold script at the first floor
  kit.add(r() < 0.45 ? 'glow' : 'gold', xf(box(w + 0.03, 0.07, d + 0.03), F({ y: y + h * 0.42 })));
  const floors = Math.max(1, Math.floor(h / 1.15)), n = Math.max(1, Math.floor(w / 0.75));
  for (let f = 0; f < floors; f++) windowRow(kit, { ...local(0, 0.35 + f * 1.1, d / 2), w: 0.32, h: 0.62, n, gap: w / (n + 0.2) });
  const roof = r();
  if (roof < 0.5) { kit.add('roof', xf(mansard(w + 0.1, d + 0.1, 0.8 + r() * 0.5), F({ y: y + h + 0.14 }))); kit.add('gold', xf(box(w * 0.5, 0.08, 0.08), F({ y: y + h + 1.0 }))); }
  else if (roof < 0.82) { kit.add('roof', xf(gable(d + 0.2, w + 0.25, 0.9 + r() * 0.4), F({ y: y + h + 0.14 }))); }
  else { kit.add('stone', xf(cyl(Math.min(w, d) * 0.32, Math.min(w, d) * 0.32, 0.3), F({ y: y + h + 0.14 }))); kit.add('gold', xf(dome(Math.min(w, d) * 0.34, 12), F({ y: y + h + 0.44 }))); }
  if (r() < 0.4) kit.add('trim', xf(box(0.22, 0.6, 0.22), local(w * 0.3, h + 0.1, -d * 0.2)));   // chimney
  if (r() < 0.42) {                                       // a corner turret with a steep witch-hat roof
    const tr = 0.32 + r() * 0.18, th = h + 0.8 + r() * 1.8, c = local((r() < 0.5 ? -1 : 1) * w / 2, 0, d / 2);
    kit.add('stone', xf(cyl(tr, tr, th, 10), { x: c.x, y: c.y, z: c.z }));
    kit.add('gold', xf(cyl(tr + 0.05, tr + 0.05, 0.08, 10), { x: c.x, y: c.y + th * 0.7, z: c.z }));
    kit.add('glow', xf(new THREE.ShapeGeometry(roundArch(0.16, 0.34), 4), { x: c.x + Math.sin(ry) * (tr + 0.01), y: c.y + th * 0.75, z: c.z + Math.cos(ry) * (tr + 0.01), ry }));
    kit.add('roof', xf(cone(tr + 0.12, 1.3 + r() * 1.1, 10), { x: c.x, y: c.y + th, z: c.z }));
    PENNANTS.push(V(c.x, c.y + th + 2.3, c.z));
  }
}
const PENNANTS = [];
function rose(kit, { x, y, z, ry, r }) {
  const F = { x, y, z, ry };
  kit.add('trim', xf(new THREE.CylinderGeometry(r + 0.2, r + 0.2, 0.14, 24).rotateX(PI / 2).translate(0, 0, 0.07), F));
  kit.add('glow', xf(new THREE.CircleGeometry(r, 32).translate(0, 0, 0.15), F));
  kit.add('gold', xf(new THREE.TorusGeometry(r * 0.5, 0.05, 6, 24).translate(0, 0, 0.17), F));
  for (let k = 0; k < 8; k++) kit.add('gold', xf(box(0.05, r * 2, 0.04).translate(0, -r, 0.17).rotateZ(k * PI / 8), F));
}
function spire(kit, x, y, z, w, h, sp) {
  kit.add('stone', xf(box(w, h, w), { x, y, z }));
  kit.add('trim', xf(box(w + 0.2, 0.2, w + 0.2), { x, y: y + h, z }));
  for (const a of [-1, 1]) for (const b of [-1, 1]) kit.add('gold', xf(cone(0.12, 0.6, 4), { x: x + a * w / 2, y: y + h + 0.2, z: z + b * w / 2 }));
  kit.add('roof', xf(cone(w * 0.62, sp, 8), { x, y: y + h + 0.2, z, ry: PI / 8 }));
  kit.add('glow', xf(new THREE.OctahedronGeometry(0.2), { x, y: y + h + 0.2 + sp + 0.15, z }));
  for (let f = 0; f < 4; f++) {
    const ry = f * PI / 2;
    kit.add('glow', xf(new THREE.ShapeGeometry(roundArch(w * 0.32, h * 0.25), 6), { x: x + Math.sin(ry) * (w / 2 + 0.01), y: y + h * 0.62, z: z + Math.cos(ry) * (w / 2 + 0.01), ry }));
  }
}

// ------------------------------------------------------------------ the site
function buildAurelia(kit, quake) {
  const r = rng(7);
  // ---- ground: cliffs in strata, terraces, the seminary rock, harbour shelf
  const rim = (R, n, amp, seed) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * PI * 2, rr = rimShape(R, amp, seed, a); pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr)); } return pts; };
  const slab = (pts, y0, y1, kind, j, seed, ox = 0, oz = 0) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: y1 - y0, bevelEnabled: false, curveSegments: 2, steps: 2 });
    g.rotateX(-PI / 2); g.translate(ox, y0, oz);
    kit.add(kind, j ? jitter(g, j, seed) : g);
  };
  const bands = [[-CAP - 0.15, -0.65, 'earth2'], [-0.65, -0.35, 'earth']];
  bands.forEach(([a, b, k], i) => slab(rim(PLATEAU_R + 0.4 - i * 0.12, 64, 1.4, 1), a, b, k, 0.35, i + 1));
  slab(rim(PLATEAU_R, 64, 1.4, 1), -0.35, T1, 'paving', 0, 0);
  // the seminary's rock across the chasm
  [[-0.3, 0.4, 'earth2'], [0.4, 0.85, 'earth']].forEach(([a, b, k], i) => slab(rim(SEM_R + 0.3 - i * 0.1, 32, 0.8, 4), a, b, k, 0.3, i + 7, SEM.x, -SEM.z));
  // grass slopes: under the bluff's caprock and the seminary's knoll
  const LAB_I0 = Math.round((1.5 * PI - 0.24) / (2 * PI) * SKIRT_N), LAB_I1 = Math.round((1.5 * PI + 0.24) / (2 * PI) * SKIRT_N);
  const mainTop = th => rimR(th) - 0.15;
  hillSkirt(kit, 0, 0, mainTop, -CAP, SP, 'slope', 1.3, i => i >= LAB_I0 && i < LAB_I1);
  hillSkirt(kit, SEM.x, -SEM.z, th => rimShape(SEM_R, 0.8, 4, -th) - 0.1, -0.25, th => 2.6 + Math.sin(th * 4) * 0.5, 'slope', 4.1);
  // boulders and scrub on the slope
  for (let i = 0; i < 70; i++) {
    const th = r() * PI * 2, t = 0.15 + r() * 0.75, rr = rimR(th) - 0.15 + SP(th) * t;
    const x = Math.cos(th) * rr, z = Math.sin(th) * rr, y = slopeY(t);
    if (z > 15 && Math.abs(x) < 7) continue;
    if (Math.abs(th - 1.5 * PI) < 0.3 || Math.abs(th + 0.5 * PI) < 0.3) continue;
    if (r() < 0.5) kit.add('earth', jitter(new THREE.IcosahedronGeometry(0.25 + r() * 0.35, 0), 0.15, i).translate(x, y + 0.1, z));
    else { kit.add('leaf', xf(new THREE.IcosahedronGeometry(0.35 + r() * 0.25, 0), { x, y: y + 0.35, z })); }
  }
  slab(rim(SEM_R, 32, 0.8, 4), 0.85, SEM.y, 'paving', 0, 0, SEM.x, -SEM.z);
  // terraces: three rings rising to the cathedral; retaining walls carry a line of light
  const disc = (R, y0, y1) => { kit.add('stone', xf(cyl(R, R, y1 - y0, 64), { y: y0 })); kit.add('trim', xf(cyl(R + 0.12, R + 0.12, 0.2, 64), { y: y1 - 0.16 })); kit.add('glow', xf(new THREE.TorusGeometry(R + 0.02, 0.035, 4, 96).rotateX(PI / 2), { y: (y0 + y1) / 2 })); };
  disc(11, T1, T2); disc(6.2, T2, T3);
  // four avenues of light: streets inlaid with gold script, stairs where they climb
  for (let k = 0; k < 4; k++) {
    const a = k * PI / 2 + PI / 4, ca = Math.cos(a), sa = Math.sin(a);
    for (const [r0, r1, y] of [[11, PLATEAU_R - 0.5, T1], [6.2, 11, T2]]) {
      const len = r1 - r0, mid = (r0 + r1) / 2;
      kit.add('glow', xf(box(0.08, 0.02, len), { x: ca * mid, y: y + 0.005, z: sa * mid, ry: Math.atan2(ca, sa) }));
    }
    for (let s = 0; s < 4; s++) { kit.add('trim', xf(box(1.6 - s * 0.03, (s + 1) * T2 / 4, 0.32), { x: ca * (11.2 + 0.3 * (3 - s)), y: 0, z: sa * (11.2 + 0.3 * (3 - s)), ry: Math.atan2(ca, sa) })); kit.add('trim', xf(box(1.6 - s * 0.03, T2 + (s + 1) * T2 / 4, 0.32), { x: ca * (6.4 + 0.3 * (3 - s)), y: 0, z: sa * (6.4 + 0.3 * (3 - s)), ry: Math.atan2(ca, sa) })); }
  }
  const nearAvenue = a => { const m = ((a - PI / 4) % (PI / 2) + PI / 2) % (PI / 2); return m < 0.16 || PI / 2 - m < 0.16; };

  // ---- a low raised wall along the bluff edge: dressed stone over the caprock, battlements on top
  { const N = 220, gaps = (x, z) => (z > 12 && (Math.abs(x - 4.5) < 1.4 || Math.abs(x + 4.5) < 1.4)) || (x > 14 && Math.abs(z - (-SEM.z) * 0.6) < 2.2);
    for (let i = 0; i < N; i++) {
      const a0 = i / N * PI * 2, a1 = (i + 1) / N * PI * 2;
      const r0 = rimR(a0) - 0.32, r1 = rimR(a1) - 0.32;
      const p0 = V(Math.cos(a0) * r0, 0, Math.sin(a0) * r0), p1 = V(Math.cos(a1) * r1, 0, Math.sin(a1) * r1);
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      if (gaps(mid.x, mid.z)) continue;
      const len = p0.distanceTo(p1) + 0.04, ry = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      kit.add('stone', xf(box(0.42, CAP + 0.95, len), { x: mid.x, y: -CAP - 0.12, z: mid.z, ry }));
      kit.add('trim', xf(box(0.5, 0.1, len), { x: mid.x, y: 0.83, z: mid.z, ry }));
      if (i % 2 === 0) kit.add('stone', xf(box(0.42, 0.3, len * 0.92), { x: mid.x, y: 0.93, z: mid.z, ry }));
      if (i % 11 === 0) kit.add('glow', xf(box(0.44, 0.05, len), { x: mid.x, y: 0.35, z: mid.z, ry }));
    }
  }
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * PI * 2 + 0.2, rr = rimR(a) - 0.6, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if ((z > 12 && Math.abs(x) < 8) || (x > 14 && Math.abs(z - (-SEM.z) * 0.6) < 4)) continue;
    const h = 2.4 + (k % 3) * 0.8;
    kit.add('stone', xf(cyl(0.8, 0.9, h, 14), { x, y: T1, z }));
    kit.add('trim', xf(cyl(0.98, 0.98, 0.3, 14), { x, y: T1 + h, z }));
    kit.add('roof', xf(cone(1.05, 2.4, 14), { x, y: T1 + h + 0.3, z }));
    kit.add('glow', xf(new THREE.ShapeGeometry(roundArch(0.22, 0.45), 4), { x: x * 1.04, y: T1 + h * 0.6, z: z * 1.04, ry: Math.atan2(x, z) }));
    PENNANTS.push(V(x, T1 + h + 3.4, z));
  }

  // ---- the Cathedral of the Storyborn, on the top terrace
  const C = T3;
  kit.add('stone', xf(cyl(3.3, 3.5, 3.2, 24), { y: C }));
  kit.add('trim', xf(cyl(3.65, 3.65, 0.25, 24), { y: C + 3.2 }));
  kit.add('gold', xf(new THREE.TorusGeometry(3.52, 0.06, 4, 48).rotateX(PI / 2), { y: C + 1.6 }));
  for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; kit.add('glow', xf(new THREE.ShapeGeometry(roundArch(0.5, 1.3), 6), { x: Math.sin(a) * 3.36, y: C + 1.75, z: Math.cos(a) * 3.36, ry: a })); }
  kit.add('roof', xf(dome(3.4, 24), { y: C + 3.45 }));
  for (let k = 0; k < 8; k++) kit.add('gold', xf(box(0.08, 0.08, 3.5).translate(0, 0, 1.75).rotateX(-0.75), { y: C + 3.6, ry: k * PI / 4 }));
  kit.add('stone', xf(cyl(0.7, 0.8, 1.2, 12), { y: C + 6.7 }));
  kit.add('gold', xf(dome(0.8, 12), { y: C + 7.9 }));
  kit.add('glow', xf(new THREE.OctahedronGeometry(0.3), { y: C + 9.0 }));
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { spire(kit, a * 3.6, C, b * 3.6, 1.3, 6.5, 5.2); PENNANTS.push(V(a * 3.6, C + 6.9 + 5.4, b * 3.6)); }
  for (let k = 0; k < 12; k++) { const a = (k + 0.5) / 12 * PI * 2; kit.add('trim', xf(box(0.3, 0.7, 0.3), { x: Math.sin(a) * 3.55, y: C + 3.4, z: Math.cos(a) * 3.55 })); kit.add('roof', xf(cone(0.24, 1.2, 4), { x: Math.sin(a) * 3.55, y: C + 4.1, z: Math.cos(a) * 3.55, ry: PI / 4 })); }
  kit.add('stone', xf(box(3, 3.6, 1.6), { y: C, z: 3.5 }));                 // west front facing +z
  kit.add('dark', xf(new THREE.ExtrudeGeometry(roundArch(1.3, 2.3), { depth: 0.1, bevelEnabled: false }), { y: C, z: 4.31 }));
  rose(kit, { x: 0, y: C + 2.95, z: 4.3, ry: 0, r: 0.55 });
  kit.add('roof', xf(gable(1.7, 3.3, 1.1), { y: C + 3.6, z: 3.5 }));
  L('Cathedral of the Storyborn', V(0, C + 10, 0));

  // ---- the Ruler's Tower: no door, no windows, only a ring of script near the top
  const RT = V(-7.6, T2, -4.6);
  kit.add('stone', xf(cyl(1.05, 1.35, 15, 16), { x: RT.x, y: RT.y, z: RT.z }));
  for (let k = 1; k < 5; k++) kit.add('gold', xf(cyl(1.4 - k * 0.06, 1.4 - k * 0.06, 0.12, 16), { x: RT.x, y: RT.y + k * 3, z: RT.z }));
  kit.add('glow', xf(cyl(1.12, 1.12, 0.55, 24), { x: RT.x, y: RT.y + 13.4, z: RT.z }));
  kit.add('trim', xf(cyl(1.45, 1.45, 0.3, 16), { x: RT.x, y: RT.y + 15, z: RT.z }));
  for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; kit.add('gold', xf(cone(0.13, 1.1, 4), { x: RT.x + Math.cos(a) * 1.25, y: RT.y + 15.3, z: RT.z + Math.sin(a) * 1.25 })); }
  kit.add('gold', xf(cone(0.5, 2.4, 8), { x: RT.x, y: RT.y + 15.3, z: RT.z }));
  L('The Ruler\'s Tower · no doors', V(RT.x, RT.y + 18.2, RT.z));

  // ---- the Chronicle: a clock tower whose faces keep the town's story
  const CK = V(7.8, T2, -4.2);
  kit.add('stone', xf(box(2.0, 9, 2.0), { x: CK.x, y: CK.y, z: CK.z }));
  kit.add('trim', xf(box(2.3, 2.4, 2.3), { x: CK.x, y: CK.y + 9, z: CK.z }));
  for (let f = 0; f < 4; f++) {
    const ry = f * PI / 2, F = { x: CK.x + Math.sin(ry) * 1.16, y: CK.y + 10.2, z: CK.z + Math.cos(ry) * 1.16, ry };
    kit.add('glow', xf(new THREE.CircleGeometry(0.82, 32), F));
    kit.add('gold', xf(new THREE.TorusGeometry(0.85, 0.07, 6, 32).translate(0, 0, 0.02), F));
    kit.add('dark', xf(box(0.06, 0.6, 0.03).translate(0, 0, 0.05).rotateZ(0.6), F));
    kit.add('dark', xf(box(0.06, 0.42, 0.03).translate(0, 0, 0.05).rotateZ(-1.9), F));
  }
  kit.add('roof', xf(cone(1.8, 2.6, 4), { x: CK.x, y: CK.y + 11.4, z: CK.z, ry: PI / 4 }));
  kit.add('glow', xf(new THREE.OctahedronGeometry(0.2), { x: CK.x, y: CK.y + 14.2, z: CK.z }));
  L('The Chronicle', V(CK.x, CK.y + 15, CK.z));

  // ---- townhouses on the two lower rings
  const placed = [];
  const clear = (x, z, rad) => placed.every(([a, b, rr]) => Math.hypot(x - a, z - b) > rad + rr) &&
    Math.hypot(x - RT.x, z - RT.z) > 2.6 + rad && Math.hypot(x - CK.x, z - CK.z) > 2.6 + rad && Math.hypot(x - ORIN.x, z - ORIN.z) > 3 + rad;
  const ORIN = V(-14.2, T1, 3.2);
  for (const [r0, r1, y] of [[7.2, 10.2, T2], [12, 17.6, T1]]) {
    for (let n = 0; n < 900; n++) {
      const a = r() * PI * 2, rr = r0 + r() * (r1 - r0), x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (nearAvenue(a)) continue;
      const w = 1.3 + r() * 1.2, d = 1.3 + r() * 0.8, rad = Math.hypot(w, d) / 2 + 0.25;
      if (!clear(x, z, rad)) continue;
      if (y === T1 && z > 13 && Math.abs(x) < 8) continue;            // keep the lift heads clear
      placed.push([x, z, rad]);
      townhouse(kit, r, { x, y, z, ry: Math.atan2(-x, -z), w, d, h: 1.6 + r() * (y === T2 ? 2.6 : 2.0) });
    }
  }
  // street trees
  for (let n = 0; n < 200; n++) {
    const a = r() * PI * 2, rr = 11.4 + r() * 7, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (!clear(x, z, 0.4) || rr > PLATEAU_R - 0.8) continue;
    placed.push([x, z, 0.4]);
    kit.add('dark', xf(cyl(0.06, 0.08, 0.5, 5), { x, z }));
    kit.add('leaf', xf(new THREE.IcosahedronGeometry(0.42, 0), { x, y: 0.75, z }));
  }

  // ---- Orin's home: the family house, its garden, the gate
  kit.add('leaf', xf(box(4.2, 0.12, 3.6), { x: ORIN.x + 0.4, y: T1 + 0.004, z: ORIN.z }));
  townhouse(kit, rng(99), { x: ORIN.x - 0.6, y: T1, z: ORIN.z, ry: PI / 2, w: 2.4, d: 1.9, h: 2.3 });
  for (let i = 0; i < 9; i++) kit.add('trim', xf(box(0.1, 0.45, 0.1), { x: ORIN.x + 2.4, y: T1, z: ORIN.z - 1.7 + i * 0.42 }));
  kit.add('leaf', xf(new THREE.IcosahedronGeometry(0.55, 0), { x: ORIN.x + 1.5, y: 0.8, z: ORIN.z - 1.1 }));
  kit.add('dark', xf(cyl(0.07, 0.09, 0.6, 5), { x: ORIN.x + 1.5, z: ORIN.z - 1.1 }));
  L('Orin\'s home', V(ORIN.x, 3.8, ORIN.z));

  // ---- the seminary across the bridge: where Orin takes the priest's test
  const S = V(SEM.x, SEM.y, -SEM.z);
  kit.add('stone', xf(box(5.2, 2.6, 3.4), { x: S.x, y: S.y, z: S.z }));
  kit.add('trim', xf(box(5.6, 0.18, 3.8), { x: S.x, y: S.y + 2.55, z: S.z }));
  for (let i = 0; i < 9; i++) for (const zz of [-2.1, 2.1]) kit.add('trim', xf(cyl(0.13, 0.15, 2.6, 8), { x: S.x - 2.4 + i * 0.6, y: S.y, z: S.z + zz }));
  kit.add('roof', xf(box(5.8, 0.25, 4.6), { x: S.x, y: S.y + 2.73, z: S.z }));
  kit.add('stone', xf(cyl(1.2, 1.2, 0.8, 16), { x: S.x, y: S.y + 2.98, z: S.z }));
  kit.add('gold', xf(dome(1.25, 16), { x: S.x, y: S.y + 3.78, z: S.z }));
  windowRow(kit, { x: S.x, y: S.y + 0.5, z: S.z + 1.71, ry: 0, w: 0.35, h: 1.2, n: 5, gap: 0.9 });
  for (const [dx, dz] of [[-2.9, -1.9], [2.9, -1.9], [-2.9, 1.9], [2.9, 1.9]]) {
    kit.add('stone', xf(cyl(0.55, 0.6, 4.6, 12), { x: S.x + dx, y: S.y, z: S.z + dz }));
    kit.add('gold', xf(cyl(0.64, 0.64, 0.1, 12), { x: S.x + dx, y: S.y + 3.2, z: S.z + dz }));
    kit.add('roof', xf(cone(0.75, 2.6, 12), { x: S.x + dx, y: S.y + 4.6, z: S.z + dz }));
    PENNANTS.push(V(S.x + dx, S.y + 7.4, S.z + dz));
  }
  L('Seminary · Orin\'s test', V(S.x, S.y + 8, S.z));
  // the bridge: arches over the chasm
  const bx0 = PLATEAU_R - 1.2, bx1 = S.x - SEM_R + 0.6, bz = S.z * 0.55, len = bx1 - bx0, ang = Math.atan2(S.z - bz, len);
  const deckY = (T1 + SEM.y) / 2;
  kit.add('stone', xf(box(len + 1.2, 0.35, 1.6), { x: (bx0 + bx1) / 2, y: deckY - 0.35, z: bz + (S.z - bz) * 0.5, ry: -ang }));
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Shape(); const aw = len / 3, x0 = -len / 2 + i * aw;
    s.moveTo(x0, -7.5); s.lineTo(x0, -1); s.absarc(x0 + aw / 2, -1, aw / 2, PI, 0, true); s.lineTo(x0 + aw, -7.5); s.lineTo(x0 + aw + 0.0001, 0); s.lineTo(x0 - 0.0001, 0); s.closePath();
    const outer = new THREE.Shape(); outer.moveTo(x0, -7.6); outer.lineTo(x0 + aw, -7.6); outer.lineTo(x0 + aw, 0); outer.lineTo(x0, 0); outer.closePath();
    const hole = new THREE.Path(); hole.moveTo(x0 + 0.35, -7.6); hole.lineTo(x0 + 0.35, -1.6); hole.absarc(x0 + aw / 2, -1.6, aw / 2 - 0.35, PI, 0, true); hole.lineTo(x0 + aw - 0.35, -7.6); hole.closePath();
    outer.holes.push(hole);
    kit.add('stone', xf(new THREE.ExtrudeGeometry(outer, { depth: 1.2, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -0.6), { x: (bx0 + bx1) / 2, y: deckY - 0.35, z: bz + (S.z - bz) * 0.5, ry: -ang }));
  }
  for (const side of [-0.75, 0.75]) kit.add('gold', xf(box(len + 1, 0.08, 0.06), { x: (bx0 + bx1) / 2, y: deckY + 0.35, z: bz + (S.z - bz) * 0.5 + side, ry: -ang }));

  // ---- the Undercroft, cut away: a slice of the north hill removed so you can see into Nera's lab
  const lab = (() => {
    const th0 = 1.5 * PI, r0 = rimR(th0) - 0.3, C = V(Math.cos(th0) * r0, 0, Math.sin(th0) * r0);
    const LP = (u, y, w) => V(C.x - u, y, C.z - w);                 // local: u across, w outward (into the hill is -w)
    const F = (u, y, w, o = {}) => ({ ...LP(u, y, w), ry: PI, ...o });
    // the cut faces: two side walls along the slice, following the slope profile exactly
    for (const i of [LAB_I0, LAB_I1]) {
      const th = i / SKIRT_N * PI * 2, pts = [];
      for (let k = 0; k <= SKIRT_K; k++) { const [x, y, z] = skirtPoint(0, 0, mainTop, -CAP, SP, 1.3, i, k); pts.push(new THREE.Vector2(Math.hypot(x, z), y)); }
      const rIn = rimR(th) - 0.45;
      const shape = new THREE.Shape([new THREE.Vector2(rIn, -CAP - 0.1), ...pts, new THREE.Vector2(pts[pts.length - 1].x, FLOOR - 0.05), new THREE.Vector2(rIn, FLOOR - 0.05)]);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false }).translate(0, 0, -0.09).rotateY(-th);
      kit.add('earth2', g);
      for (const [y0, y1] of [[-1.7, -1.62], [-2.6, -2.52]]) {               // strata lines on the cut
        const band = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(rIn, y0), new THREE.Vector2(pts[pts.length - 1].x - 0.2, y0), new THREE.Vector2(pts[pts.length - 1].x - 0.2, y1), new THREE.Vector2(rIn, y1)]), { depth: 0.2, bevelEnabled: false }).translate(0, 0, -0.1).rotateY(-th);
        kit.add('earth', band);
      }
    }
    // the back of the cut: a section through the hill with the room behind it
    const hw = r0 * Math.sin(0.25), H0 = FLOOR + 0.12, H1 = -CAP - 0.25;
    const face = new THREE.Shape([new THREE.Vector2(-hw, FLOOR - 0.05), new THREE.Vector2(hw, FLOOR - 0.05), new THREE.Vector2(hw, -CAP - 0.1), new THREE.Vector2(-hw, -CAP - 0.1)]);
    const hole = new THREE.Path([new THREE.Vector2(-3.75, H0), new THREE.Vector2(3.75, H0), new THREE.Vector2(3.75, H1), new THREE.Vector2(-3.75, H1)]);
    face.holes.push(hole);
    kit.add('earth2', xf(new THREE.ExtrudeGeometry(face, { depth: 0.25, bevelEnabled: false }), F(0, 0, 0)));
    kit.add('concrete', xf(box(8.6, 0.55, 1.3), F(0, H1 - 0.05, 0.35)));                 // cantilevered lintel
    kit.add('concrete', xf(box(9.0, 0.12, 1.5), F(0, H1 + 0.5, 0.3)));
    for (const u of [-4.0, 4.0]) kit.add('concrete', xf(box(0.55, H1 - H0, 0.9), F(u, H0, 0.2)));
    kit.add('vglow', xf(box(7.4, 0.04, 0.05), F(0, H1 - 0.08, 1.0)));                    // a seam of void light under the lintel
    // the room
    const D = 4.6, Hh = H1 - H0;
    kit.add('void', xf(box(7.6, 0.12, D), F(0, H0 - 0.12, -D / 2)));                    // polished black floor
    kit.add('concrete', xf(box(7.6, Hh, 0.35), F(0, H0, -D - 0.17)));
    for (const u of [-3.95, 3.95]) kit.add('concrete', xf(box(0.3, Hh, D), F(u, H0, -D / 2)));
    for (let k = 1; k < 7; k++) {                                                          // board-marked concrete
      kit.add('void', xf(box(7.5, 0.02, 0.02), F(0, H0 + k * Hh / 7, -D + 0.02)));
      for (const u of [-3.79, 3.79]) kit.add('void', xf(box(0.02, 0.02, D - 0.1), F(u, H0 + k * Hh / 7, -D / 2)));
    }
    kit.add('concrete', xf(box(8.2, 0.3, D + 0.3), F(0, H1, -D / 2)));                   // coffered ceiling
    for (let i = 0; i < 7; i++) kit.add('concrete', xf(box(0.22, 0.32, D), F(-3.3 + i * 1.1, H1 - 0.32, -D / 2)));
    for (let j = 0; j < 4; j++) kit.add('concrete', xf(box(7.6, 0.32, 0.22), F(0, H1 - 0.32, -0.6 - j * 1.15)));
    for (const u of [-1.9, 1.9]) { kit.add('concrete', xf(box(0.55, Hh, 0.55), F(u, H0, -3.0))); kit.add('vglow', xf(box(0.04, Hh * 0.8, 0.04), F(u, H0 + Hh * 0.1, -2.71))); }
    for (const u of [-2.9, -0.4, 2.9]) kit.add('vglow', xf(box(0.05, Hh - 0.3, 0.03), F(u, H0 + 0.15, -D + 0.01)));
    kit.add('vglow', xf(box(7.4, 0.03, 0.04), F(0, H0 + 0.01, -D + 0.05)));
    // the relay: a black monolith with a seam of light, how she reports to the Voided
    kit.add('void', xf(box(0.7, Hh - 0.25, 0.5), F(-2.9, H0, -3.9)));
    kit.add('vglow', xf(box(0.04, Hh - 0.45, 0.02), F(-2.9, H0 + 0.1, -3.64)));
    kit.add('concrete', xf(box(1.2, 0.18, 0.9), F(-2.9, H0, -3.9)));
    kit.add('concrete', xf(box(1.1, 0.45, 0.5), F(-2.6, H0, -2.9)));                     // stepped console
    kit.add('concrete', xf(box(1.1, 0.2, 0.32), F(-2.6, H0 + 0.45, -3.0)));
    kit.add('vglow', xf(box(0.7, 0.02, 0.18), F(-2.6, H0 + 0.66, -3.0)));
    kit.add('concrete', xf(box(0.8, 0.3, 1.6), F(3.3, H0, -3.4)));                        // cot
    kit.add('stone', xf(box(0.6, 0.1, 1.3), F(3.3, H0 + 0.3, -3.4)));
    // the slab and the Storyborn's body, its written skin still glowing
    kit.add('dark', xf(box(1.9, 0.62, 0.85), F(0.2, H0, -2.1)));
    kit.add('trim', xf(box(2.0, 0.08, 0.95), F(0.2, H0 + 0.62, -2.1)));
    kit.add('stone', xf(new THREE.CapsuleGeometry(0.17, 1.1, 4, 10).rotateZ(PI / 2), F(0.25, H0 + 0.88, -2.1)));
    kit.add('stone', xf(new THREE.SphereGeometry(0.15, 10, 8), F(-0.55, H0 + 0.9, -2.1)));
    for (let k = 0; k < 6; k++) kit.add('glow', xf(new THREE.TorusGeometry(0.18, 0.018, 4, 18).rotateY(PI / 2), F(-0.25 + k * 0.17, H0 + 0.88, -2.1)));
    kit.add('glow', xf(box(1.1, 0.02, 0.04), F(0.25, H0 + 1.06, -2.1)));
    // specimen vats
    for (const [u, w] of [[-1.95, -3.95], [-1.2, -4.15], [2.3, -1.2], [3.2, -1.6]]) {
      kit.add('dark', xf(cyl(0.34, 0.36, 0.18, 14), F(u, H0, w)));
      kit.add('vglow', xf(cyl(0.24, 0.24, 1.05, 14), F(u, H0 + 0.18, w)));
      for (let k = 0; k < 4; k++) { const a = k * PI / 2; kit.add('gold', xf(box(0.04, 1.05, 0.04), F(u + Math.cos(a) * 0.3, H0 + 0.18, w + Math.sin(a) * 0.3))); }
      kit.add('dark', xf(cyl(0.34, 0.3, 0.16, 14), F(u, H0 + 1.23, w)));
    }
    // bookshelf against the back wall
    kit.add('concrete', xf(box(1.9, 1.75, 0.4), F(1.35, H0, -4.3)));
    const bk = ['roof', 'gold', 'trim', 'leaf', 'roof'];
    for (let row = 0; row < 3; row++) for (let b = 0; b < 9; b++) kit.add(bk[(b + row) % bk.length], xf(box(0.14, 0.38 + ((b * 7 + row) % 3) * 0.05, 0.26), F(0.72 + b * 0.16, H0 + 0.12 + row * 0.55, -4.26)));
    // desk, lamp, papers
    kit.add('concrete', xf(box(1.2, 0.55, 0.6), F(-1.75, H0, -1.05)));
    kit.add('vglow', xf(new THREE.OctahedronGeometry(0.08), F(-2.1, H0 + 0.7, -1.05)));
    for (let k = 0; k < 3; k++) kit.add('stone', xf(box(0.28, 0.01, 0.2), F(-1.6 + k * 0.18, H0 + 0.56, -1.0 - k * 0.05, { ry: PI + k * 0.3 })));
    // board of diagrams on the side wall: circles of script, lines
    kit.add('void', xf(box(0.05, 0.95, 1.7), F(3.77, H0 + 0.55, -2.9)));
    kit.add('glow', xf(new THREE.TorusGeometry(0.28, 0.012, 4, 24).rotateY(PI / 2), F(3.74, H0 + 1.05, -3.2)));
    kit.add('glow', xf(new THREE.TorusGeometry(0.16, 0.012, 4, 20).rotateY(PI / 2), F(3.74, H0 + 1.05, -3.2)));
    for (let k = 0; k < 4; k++) kit.add('glow', xf(box(0.01, 0.012, 0.5 - k * 0.08), F(3.74, H0 + 0.75 - k * 0.07, -2.55)));
    // hanging lamps
    for (const u of [-1.1, 1.1]) kit.add('vglow', xf(box(0.9, 0.04, 0.08), F(u, H1 - 0.36, -1.75)));
    // stairs up to the city
    for (let k = 0; k < 9; k++) kit.add('concrete', xf(box(0.8, 0.22 * (k + 1), 0.32), F(-3.4, H0, -0.9 - k * 0.32)));
    L('The Undercroft · Nera\'s lab (Voided)', LP(0, 0.9, 0.6));
    // a trapdoor in the floor: the way out nobody else knows
    kit.add('void', xf(box(0.9, 0.04, 0.9), F(1.2, H0 + 0.0, -0.9)));
    for (const [du, dw, w_, d_] of [[0, 0.47, 0.98, 0.04], [0, -0.47, 0.98, 0.04], [0.47, 0, 0.04, 0.98], [-0.47, 0, 0.04, 0.98]]) kit.add('vglow', xf(box(w_, 0.03, d_), F(1.2 + du, H0 + 0.02, -0.9 + dw)));
    const start = LP(1.2, H0, -0.9);
    const hatch = V(-6.5, FLOOR, -31.2);
    // the passage: down under the lab, then out beneath the valley to the prairie, past where the erasure stops
    const g_ = FLOOR + 0.05, out = LP(1.2, 0, 1.2);
    const tunnel = [start.clone().setY(H0 + 0.02), V(out.x, g_, out.z), V(out.x - 1, g_, out.z - 3.5), V(-3.8, g_, -27), V(hatch.x, g_, hatch.z + 0.9)];
    // the exit: a small concrete hatch half sunk in the grass, a seam of void light (not erased: it's outside the wound)
    kit.add('hatch', xf(box(1.5, 0.45, 1.5), { x: hatch.x, y: FLOOR - 0.05, z: hatch.z }));
    kit.add('hatch', xf(box(1.2, 0.18, 1.2), { x: hatch.x, y: FLOOR + 0.4, z: hatch.z, rx: -0.12 }));
    kit.add('hatchglow', xf(box(1.22, 0.03, 0.05), { x: hatch.x, y: FLOOR + 0.4, z: hatch.z - 0.6 }));
    L('Secret passage · exit', hatch.clone().add(V(0, 1.6, 0)));
    return { light: LP(0, H0 + 1.4, -1.6), tunnel, hatch };
  })();

  // ---- the valley: the Solomon River along the south foot of the bluff, a wharf, the lower town
  const river = new THREE.CatmullRomCurve3([V(-30.2, 0, 10.6), V(-24, 0, 21.5), V(-10, 0, 24.2), V(3, 0, 24.8), V(15, 0, 23.2), V(26, 0, 17.5), V(30.4, 0, 10.4)]);
  const ribbon = (curve, w, y, kind) => {
    const L_ = [], R_ = [], n = 120;
    for (let i = 0; i <= n; i++) { const t = i / n, p = curve.getPointAt(t), tg = curve.getTangentAt(t); const nx = -tg.z, nz = tg.x; L_.push(new THREE.Vector2(p.x + nx * w / 2, -(p.z + nz * w / 2))); R_.push(new THREE.Vector2(p.x - nx * w / 2, -(p.z - nz * w / 2))); }
    const g = new THREE.ExtrudeGeometry(new THREE.Shape([...L_, ...R_.reverse()]), { depth: 0.06, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-PI / 2); g.translate(0, y, 0); kit.add(kind, g);
  };
  ribbon(river, 4.2, FLOOR - 0.03, 'bank');
  ribbon(river, 2.6, FLOOR - 0.01, 'water');
  for (let i = 0; i < 70; i++) {
    const t = r(), p = river.getPointAt(t), tg = river.getTangentAt(t), side = r() < 0.5 ? -1 : 1, off = 2.4 + r() * 1.6;
    const x = p.x - tg.z * side * off, z = p.z + tg.x * side * off;
    if (Math.hypot(x, z) > 33 || Math.hypot(x, z) < rimR(Math.atan2(z, x)) + SP(Math.atan2(z, x)) + 0.3) continue;
    kit.add('dark', xf(cyl(0.07, 0.09, 0.5, 5), { x, y: FLOOR, z })); kit.add('leaf', xf(new THREE.IcosahedronGeometry(0.5 + r() * 0.3, 0), { x, y: FLOOR + 0.85, z }));
  }
  const HY = FLOOR;
  for (const x of [-6, -2, 2, 6]) { const p = river.getPointAt(0.5 + x / 80); kit.add('dark', xf(box(0.8, 0.14, 2.4), { x: p.x + x * 0.02, y: HY + 0.02, z: p.z - 0.6 })); }
  kit.add('trim', xf(box(14, 0.25, 1.2), { x: 0, y: HY, z: river.getPointAt(0.5).z - 2.0 }));
  const barge = (() => { const s_ = new THREE.Shape(); s_.moveTo(-1.5, 0.28); s_.lineTo(1.5, 0.28); s_.lineTo(1.2, -0.15); s_.lineTo(-1.2, -0.15); s_.closePath(); return new THREE.ExtrudeGeometry(s_, { depth: 0.9, bevelEnabled: false }).translate(0, 0, -0.45); })();
  for (const t of [0.3, 0.56, 0.72]) {
    const p = river.getPointAt(t), tg = river.getTangentAt(t), ry = Math.atan2(tg.x, tg.z) - PI / 2;
    kit.add('dark', xf(barge.clone(), { x: p.x, y: HY + 0.1, z: p.z, ry }));
    kit.add('trim', xf(box(1.0, 0.35, 0.6), { x: p.x, y: HY + 0.38, z: p.z, ry }));
  }
  L('River wharf', V(0, HY + 2.2, river.getPointAt(0.5).z - 2.5));
  const lowR = rng(41);
  for (let i = 0; i < 26; i++) {
    const t = 0.36 + lowR() * 0.3, p = river.getPointAt(t), tg = river.getTangentAt(t), off = 3.2 + lowR() * 3.2;
    let x = p.x + tg.z * off, z = p.z - tg.x * off;
    if (Math.hypot(x, z) < Math.hypot(p.x, p.z)) { x = p.x - tg.z * off; z = p.z + tg.x * off; }     // the far bank, away from the bluff
    if (Math.hypot(x, z) > 32) continue;
    townhouse(kit, lowR, { x, y: FLOOR, z, ry: Math.atan2(-tg.z, tg.x), w: 1.2 + lowR() * 0.8, d: 1.1 + lowR() * 0.5, h: 1.2 + lowR() * 1.0 });
  }
  { const p = river.getPointAt(0.5), tg = river.getTangentAt(0.5), ry = Math.atan2(tg.x, tg.z) + PI / 2;
    kit.add('stone', xf(box(1.4, 0.3, 4.6), { x: p.x + 4, y: FLOOR + 0.2, z: p.z, ry }));
    for (const o of [-0.65, 0.65]) kit.add('gold', xf(box(0.06, 0.08, 4.6), { x: p.x + 4 + Math.cos(ry) * o, y: FLOOR + 0.62, z: p.z - Math.sin(ry) * o, ry })); }
  L('Lower town', V(10, FLOOR + 3, 29));
  // funicular: brass rails up the slope from the wharf to the city
  const lifts = [];
  for (const x of [-4.5, 4.5]) {
    const th = Math.atan2(Math.sqrt(PLATEAU_R ** 2 - x * x), x);
    const top = V(Math.cos(th) * (rimR(th) - 0.2), T1 + 0.15, Math.sin(th) * (rimR(th) - 0.2));
    const bot = V(Math.cos(th) * (rimR(th) + SP(th) + 0.6), FLOOR + 0.15, Math.sin(th) * (rimR(th) + SP(th) + 0.6));
    const d = bot.clone().sub(top), len = d.length(), q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d.clone().normalize());
    const side = V(-d.z, 0, d.x).normalize();
    for (const o of [-0.4, 0.4]) { const g = new THREE.BoxGeometry(0.1, 0.1, len); g.applyMatrix4(new THREE.Matrix4().compose(top.clone().add(bot).multiplyScalar(0.5).addScaledVector(side, o).add(V(0, 0.12, 0)), q, V(1, 1, 1))); kit.add('gold', g); }
    kit.add('trim', xf(box(1.5, 0.6, 1.2), { x: top.x, y: T1, z: top.z }));
    kit.add('roof', xf(gable(1.4, 1.7, 0.6), { x: top.x, y: T1 + 0.6, z: top.z }));
    kit.add('trim', xf(box(1.5, 0.5, 1.2), { x: bot.x, y: FLOOR, z: bot.z }));
    lifts.push({ a: top.clone().add(V(0, 0.35, 0)), b: bot.clone().add(V(0, 0.35, 0)) });
  }
  L('Funicular to the river', V(0, 1.8, PLATEAU_R + 2.4));
  const fr = rng(77), fieldKinds = ['field1', 'field2', 'field3', 'field4'];
  for (let gx = -34; gx < 34; gx += 3.6) for (let gz = -34; gz < 34; gz += 2.8) {
    const cx = gx + 1.8, cz = gz + 1.4, rr = Math.hypot(cx, cz);
    if (rr > 31.6 || rr < rimR(Math.atan2(cz, cx)) + SP(Math.atan2(cz, cx)) + 1.6) continue;
    if (Math.hypot(cx - SEM.x, cz + SEM.z) < SEM_R + 4.6) continue;
    let near = 1e9; for (let i = 0; i <= 60; i++) { const p = river.getPointAt(i / 60); near = Math.min(near, Math.hypot(p.x - cx, p.z - cz)); }
    if (near < 4.2 || (cz > 24 && Math.abs(cx - 6) < 9)) continue;
    kit.add(fieldKinds[Math.floor(fr() * 4)], xf(box(3.35, 0.05, 2.55), { x: cx, y: FLOOR, z: cz, ry: (fr() - 0.5) * 0.05 }));
    if (fr() < 0.05) { kit.add('barn', xf(box(1.0, 0.7, 0.7), { x: cx + 0.6, y: FLOOR + 0.05, z: cz })); kit.add('roof', xf(gable(0.8, 1.15, 0.45), { x: cx + 0.6, y: FLOOR + 0.75, z: cz, ry: PI / 2 })); }
  }
  L('Prairie · the Solomon River valley', V(-29, FLOOR + 1.2, 0));

  // waterfalls: two short falls off the caprock, then creeks down the slope into the river
  const falls = [];
  const ribbon3 = (pts, w, kind) => {
    const pos = [], idx = [];
    pts.forEach((p, i) => { const q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)]; const tx = q.x - o.x, tz = q.z - o.z, l = Math.hypot(tx, tz) || 1; const nx = -tz / l * w / 2, nz = tx / l * w / 2; pos.push(p.x + nx, p.y, p.z + nz, p.x - nx, p.y, p.z - nz); });
    for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); kit.add(kind, g);
  };
  for (const a of [PI * 0.74, PI * 0.2]) {
    const rr = rimR(a); falls.push({ x: Math.cos(a) * (rr + 0.2), z: Math.sin(a) * (rr + 0.2), ry: Math.atan2(Math.cos(a), Math.sin(a)) });
    const pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16, r_ = rr - 0.1 + SP(a) * t + 0.2; pts.push(V(Math.cos(a) * r_ + Math.sin(t * 9) * 0.25, slopeY(t) + 0.07, Math.sin(a) * r_)); }
    const end = pts[pts.length - 1], tgt = river.getPointAt(a > 1 ? 0.3 : 0.74);
    for (let i = 1; i <= 8; i++) { const t = i / 8; pts.push(V(end.x + (tgt.x - end.x) * t, FLOOR + 0.03, end.z + (tgt.z - end.z) * t)); }
    ribbon3(pts, 0.7, 'water');
    kit.add('water', xf(cyl(0.8, 0.8, 0.05, 14), { x: pts[0].x, y: slopeY(0) + 0.02, z: pts[0].z }));
  }
  return { lifts, falls, lab, rimPts: rim(PLATEAU_R, 64, 1.4, 1) };
}

// ------------------------------------------------------------------ materials, outlines, erasure
const drawRes = new THREE.Vector2(1, 1);
const ERASE = { uR: { value: 0 }, uEdge: { value: new THREE.Color('#ff5a36') }, uC: { value: new THREE.Vector2(-14.2, 3.2) } };
function eraseInject(sh) {
  Object.assign(sh.uniforms, ERASE);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vEW;').replace('#include <project_vertex>', '#include <project_vertex>\nvEW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vEW; uniform float uR; uniform vec3 uEdge; uniform vec2 uC;')
    .replace('void main() {', 'void main() {\n float eD = length(vEW.xz - uC);\n if (eD < uR) discard;');
  if (sh.fragmentShader.includes('#include <emissivemap_fragment>'))
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += uEdge * (1.0 - smoothstep(0.0, 0.6, eD - uR)) * step(0.001, uR) * 2.5;');
}
function outlineMaterial(color, px) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPx: { value: px }, uRes: { value: drawRes }, ...ERASE },
    vertexShader: `uniform float uPx; uniform vec2 uRes; varying vec3 vEW;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vEW = wp.xyz; vec3 wn = normalize(mat3(modelMatrix)*normal);
        vec4 c0 = projectionMatrix*viewMatrix*wp; vec4 c1 = projectionMatrix*viewMatrix*vec4(wp.xyz+wn*0.05,1.0);
        vec2 d = c1.xy/c1.w - c0.xy/c0.w; float l = length(d); if(l>1e-6) c0.xy += (d/l)*uPx*2.0/uRes*c0.w; c0.z += 0.0004*c0.w; gl_Position = c0; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uR; uniform vec2 uC; varying vec3 vEW;
      void main(){ if (length(vEW.xz - uC) < uR) discard; gl_FragColor = vec4(uColor,1.0); }`,
    side: THREE.BackSide
  });
  return m;
}
function hullOf(geo) { const g = new THREE.BufferGeometry(); g.setAttribute('position', geo.getAttribute('position').clone()); const m = mergeVertices(g, 1e-4); m.computeVertexNormals(); return m; }

// ------------------------------------------------------------------ engine
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 800);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = true;
controls.minZoom = 0.5; controls.maxZoom = 8; controls.maxPolarAngle = 1.45;
controls.autoRotate = !reduceMotion; controls.autoRotateSpeed = 0.35;
controls.addEventListener('start', () => { controls.autoRotate = false; });
const hemi = new THREE.HemisphereLight('#fff', '#000', 1);
const key = new THREE.DirectionalLight('#fff', 2); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 }); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.09;
key.position.set(-30, 50, 25);
const rimL = new THREE.DirectionalLight('#fff', 1); rimL.position.set(30, 20, -40);
scene.add(hemi, key, rimL);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.4, 0.9); composer.addPass(bloom);
composer.addPass(new OutputPass());

const state = { theme: 'crt', after: 0, t: 0, showTags: true };
let scarLow = null, labLight = null, labLight2 = null, passage = null, runner = null, nera = null;
let root = null, liftCars = [], scar = null, orin = null, seaMesh = null, magic = null, flags = [], lanterns = null, lanternData = [], rings = [], falls = [];

function build() {
  if (root) { scene.remove(root); root.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => m.dispose()); }); }
  root = new THREE.Group(); scene.add(root);
  labels.length = 0;
  const th = THEMES[state.theme];
  scene.background = new THREE.Color(th.bg);
  hemi.color.set(th.hemiSky); hemi.groundColor.set(th.hemiGround); hemi.intensity = th.hemi;
  key.color.set(th.key); key.intensity = th.keyI; rimL.color.set(th.rim); rimL.intensity = th.rimI;
  scene.environmentIntensity = th.env; bloom.strength = th.bloom;
  ERASE.uEdge.value.set(th.ember);

  const kit = new Kit();
  PENNANTS.length = 0;
  const info = buildAurelia(kit);
  const geos = kit.merge();
  const std = (c, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.05, flatShading: true, envMapIntensity: th.env, ...extra }); m.onBeforeCompile = eraseInject; return m; };
  // the land itself is not removed by the erasure; it is left smooth and black
  const blacken = m => { m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, ERASE, { uScar: { value: new THREE.Color(th.scar) } });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vEW;').replace('#include <project_vertex>', '#include <project_vertex>\nvEW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vEW; uniform float uR; uniform vec2 uC; uniform vec3 uScar;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n if (length(vEW.xz - uC) < uR) diffuseColor.rgb = uScar;');
    }; m.customProgramCacheKey = () => 'blacken'; return m; };
  const mats = {
    stone: std(th.stone), trim: std(th.trim), roof: std(th.roof, { roughness: 0.5, metalness: 0.25 }), gold: std(th.gold, { roughness: 0.35, metalness: 0.75 }),
    dark: std(th.dark), leaf: std(th.leaf), paving: std(th.trim, { roughness: 0.9 }),
    concrete: std(state.theme === 'crt' ? '#56544f' : '#a8a59e', { roughness: 0.95 }),
    void: std(state.theme === 'crt' ? '#0d0c10' : '#26252e', { roughness: 0.25, metalness: 0.3 }),
    vglow: (() => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(state.theme === 'crt' ? '#9b8cff' : '#6a5acd').multiplyScalar(state.theme === 'crt' ? 1.35 : 0.9) }); m.onBeforeCompile = eraseInject; return m; })(),
    hatch: new THREE.MeshStandardMaterial({ color: state.theme === 'crt' ? '#56544f' : '#a8a59e', roughness: 0.95, flatShading: true }),
    hatchglow: new THREE.MeshBasicMaterial({ color: new THREE.Color(state.theme === 'crt' ? '#9b8cff' : '#6a5acd') }),
    water: std(th.water, { roughness: 0.2, metalness: 0.3 }), bank: std(th.bank, { roughness: 1 }), barn: std(th.barn),
    field1: std(th.fields[0], { roughness: 1 }), field2: std(th.fields[1], { roughness: 1 }), field3: std(th.fields[2], { roughness: 1 }), field4: std(th.fields[3], { roughness: 1 }),
    slope: blacken(new THREE.MeshStandardMaterial({ color: state.theme === 'crt' ? '#46552a' : '#a6bd78', roughness: 1, flatShading: true })),
    earth: blacken(new THREE.MeshStandardMaterial({ color: th.earth, roughness: 1, flatShading: true })), earth2: blacken(new THREE.MeshStandardMaterial({ color: th.earth2, roughness: 1, flatShading: true })),
    glow: (() => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(th.glow).multiplyScalar(th.glowBoost), side: THREE.DoubleSide }); m.onBeforeCompile = eraseInject; return m; })()
  };
  for (const [k, g] of Object.entries(geos)) {
    const m = new THREE.Mesh(g, mats[k]);
    m.userData.erasable = !['earth', 'earth2', 'slope', 'hatch', 'hatchglow'].includes(k);
    if (!['glow', 'vglow', 'hatchglow'].includes(k)) { m.castShadow = m.receiveShadow = true; const o = new THREE.Mesh(hullOf(g), outlineMaterial(th.ink, th.outlinePx)); o.raycast = () => {}; m.add(o); }
    root.add(m);
  }
  // the valley floor (prairie) on a stepped stand
  seaMesh = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 0.6, 96), new THREE.MeshStandardMaterial({ color: th.grass, roughness: 1, flatShading: true }));
  seaMesh.position.y = FLOOR - 0.3; seaMesh.receiveShadow = true; root.add(seaMesh);
  seaMesh.add(new THREE.Mesh(hullOf(seaMesh.geometry), outlineMaterial(th.ink, th.outlinePx)));
  for (const [r, y, h] of [[34.6, FLOOR - 1.05, 0.9], [35.4, FLOOR - 1.85, 0.8]]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 96), new THREE.MeshStandardMaterial({ color: th.earth2, roughness: 1 }));
    st.position.y = y; st.receiveShadow = true; root.add(st);
    st.add(new THREE.Mesh(hullOf(st.geometry), outlineMaterial(th.ink, th.outlinePx)));
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-PI / 2), new THREE.ShadowMaterial({ opacity: th.shadowOpacity }));
  ground.position.y = FLOOR - 2.3; ground.receiveShadow = true; root.add(ground);

  // ---- magic layer (all of it goes when the city is erased)
  magic = new THREE.Group(); root.add(magic);
  // pennants: small gold flags on the spires, swaying
  const flagGeo = new THREE.PlaneGeometry(0.9, 0.32, 6, 1).translate(0.45, 0, 0);
  const flagMat = new THREE.MeshStandardMaterial({ color: state.theme === 'crt' ? '#e0a83a' : '#c4561e', side: THREE.DoubleSide, roughness: 0.6 });
  flags = PENNANTS.map((p, i) => { const f = new THREE.Mesh(flagGeo, flagMat); f.position.copy(p); f.userData.ph = i * 1.7; magic.add(f); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), mats.gold); pole.position.set(p.x, p.y - 0.3, p.z); magic.add(pole); return f; });
  // floating lanterns drifting up through the city
  const N = 160, lg = new THREE.OctahedronGeometry(0.12, 0);
  lanterns = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: new THREE.Color(th.glow).multiplyScalar(th.glowBoost * 0.9) }), N);
  lanternData = Array.from({ length: N }, (_, i) => { const a = Math.random() * PI * 2, rr = Math.sqrt(Math.random()) * (PLATEAU_R - 1.5); return { x: Math.cos(a) * rr, z: Math.sin(a) * rr, y0: Math.random() * 16, sp: 0.35 + Math.random() * 0.5, ph: Math.random() * 6 }; });
  magic.add(lanterns);
  // rings of script turning around the Ruler's Tower
  const scriptTex = (() => { const c = document.createElement('canvas'); c.width = 2048; c.height = 64; const g = c.getContext('2d'); g.fillStyle = th.glow; g.font = 'bold 40px Space Mono, monospace'; const t = 'LET IT BE WRITTEN · THE STORY KEEPS · WHAT IS WITNESSED IS ETERNAL · '; let x = 0; while (x < c.width) { g.fillText(t, x, 46); x += g.measureText(t).width; } const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = THREE.RepeatWrapping; tx.repeat.set(2, 1); return tx; })();
  const ringMat = new THREE.MeshBasicMaterial({ map: scriptTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: state.theme === 'crt' ? THREE.AdditiveBlending : THREE.NormalBlending, color: state.theme === 'crt' ? '#ffffff' : '#c4561e' });
  rings = [[2.3, 9, 0.18], [3.0, 12.5, -0.12], [2.0, 15.5, 0.3]].map(([rad, y, tilt], i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.42, 64, 1, true), ringMat);
    m.position.set(-7.6, T2 + y, -4.6); m.rotation.z = tilt; m.userData.sp = (i % 2 ? -1 : 1) * (0.25 + i * 0.1); magic.add(m); return m;
  });
  // waterfalls: scrolling streaks down the cliff, mist at the foot
  const fallMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(state.theme === 'crt' ? '#9fd8ff' : '#ffffff') } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uT; uniform vec3 uC; varying vec2 vUv; void main(){ float s = fract(vUv.y * 6.0 + uT * 1.6 + sin(vUv.x * 21.0) * 0.15); float a = (0.45 + 0.55 * smoothstep(0.2, 1.0, s)) * smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x); gl_FragColor = vec4(uC, a * 0.85); }' });
  falls = info.falls.map(f => {
    const g = new THREE.Group(); g.position.set(f.x, 0, f.z); g.rotation.y = f.ry;
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.2, CAP + 0.2, 1, 1).translate(0, -(CAP + 0.2) / 2 + 0.05, 0.15), fallMat); g.add(sheet);
    const mist = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
    mist.scale.set(0.7, 0.3, 0.6); mist.position.set(0, -CAP - 0.05, 0.5); g.add(mist);
    magic.add(g); return fallMat;
  });
  // twilight sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    uniforms: { uTop: { value: new THREE.Color(state.theme === 'crt' ? '#0a0914' : '#efe4d4') }, uMid: { value: new THREE.Color(state.theme === 'crt' ? '#171126' : '#f3e6d2') }, uLow: { value: new THREE.Color(state.theme === 'crt' ? '#b85c2a' : '#ffd9a8') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uTop, uMid, uLow; varying vec3 vP; float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); } void main(){ float y = vP.y; vec3 c = mix(uMid, uTop, smoothstep(-0.6, 0.6, y)); c = mix(c, uLow, exp(-abs(y) * 9.0) * 0.55); float st = step(0.9965, h(floor(vP * 260.0))) * smoothstep(0.2, 0.6, y); c += st * 0.8 * (uTop.r < 0.2 ? 1.0 : 0.0); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}' }));
  root.add(sky);

  // a warm light inside the lab, so the cutaway reads
  labLight = new THREE.PointLight('#7a5cff', state.theme === 'crt' ? 4.5 : 3, 8, 1.4); labLight.position.copy(info.lab.light); root.add(labLight);
  labLight2 = new THREE.PointLight('#5a3cff', state.theme === 'crt' ? 3 : 2, 6, 1.4); labLight2.position.copy(info.lab.light).add(V(2.6, -0.4, -1.5)); root.add(labLight2);

  // the passage drawn through the ground (x-ray), a light that runs it, and Nera at the exit afterwards
  const pcurve = new THREE.CatmullRomCurve3(info.lab.tunnel, false, 'catmullrom', 0.2);
  passage = new THREE.Mesh(new THREE.TubeGeometry(pcurve, 160, 0.09, 6, false), new THREE.MeshBasicMaterial({ color: state.theme === 'crt' ? '#8f7cff' : '#5a4ab8', transparent: true, opacity: 0.7 }));
  root.add(passage);
  const dash = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pcurve.getPoints(200)), new THREE.LineDashedMaterial({ color: state.theme === 'crt' ? '#c9bfff' : '#141a2c', dashSize: 0.5, gapSize: 0.35, transparent: true }));
  dash.position.y = 0.04; dash.computeLineDistances(); root.add(dash);
  runner = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#b9a8ff').multiplyScalar(state.theme === 'crt' ? 2 : 1) })); runner.userData.curve = pcurve; root.add(runner);
  nera = new THREE.Group();
  const nm = new THREE.MeshStandardMaterial({ color: '#2a2338', roughness: 0.6 });
  nera.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.55, 4, 8).translate(0, 0.48, 0), nm));
  nera.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8).translate(0, 1.07, 0), new THREE.MeshStandardMaterial({ color: '#f1e6cf' })));
  nera.position.copy(info.lab.hatch).add(V(1.3, 0, 0.6)); nera.visible = false; root.add(nera);
  L('Nera · out through the passage', info.lab.hatch.clone().add(V(1.3, 2.4, 0.6)), { after: true, late: true });

  // lift cars
  liftCars = info.lifts.map(l => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.9), mats.glow); c.position.copy(l.a); c.userData = l; root.add(c); return c; });

  // after: the smooth black ground and Orin at its centre
  const scarMat = new THREE.MeshStandardMaterial({ color: th.scar, roughness: 0.12, metalness: 0.4, envMapIntensity: 0.6, side: THREE.DoubleSide });
  scarMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, ERASE);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vEW;').replace('#include <project_vertex>', '#include <project_vertex>\nvEW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vEW; uniform float uR; uniform vec2 uC;')
      .replace('void main() {', 'void main() {\n if (length(vEW.xz - uC) > uR) discard;');
  };
  scarMat.customProgramCacheKey = () => 'scar';
  scar = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(info.rimPts), 2).rotateX(-PI / 2), scarMat);
  scar.position.y = T1 + 0.03; scar.visible = false; scar.receiveShadow = true; root.add(scar);
  scarLow = new THREE.Mesh(new THREE.CircleGeometry(27, 96).rotateX(-PI / 2), scarMat);
  scarLow.position.y = FLOOR + 0.08; scarLow.visible = false; root.add(scarLow);
  orin = new THREE.Group();
  const om = new THREE.MeshStandardMaterial({ color: '#d4452b', roughness: 0.5 });
  orin.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.5, 4, 8).translate(0, 0.45, 0), om));
  orin.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8).translate(0, 1.0, 0), new THREE.MeshStandardMaterial({ color: '#f1e6cf' })));
  orin.position.set(ERASE.uC.value.x, T1, ERASE.uC.value.y); orin.visible = false; root.add(orin);
  L('Orin', V(ERASE.uC.value.x, 2.2, ERASE.uC.value.y), { after: true, ember: true });
  L('Smooth black ground: Aurelia, erased', V(0, 1.2, 0), { after: true, ember: true, late: true });
  L('Prairie, untouched', V(-29, FLOOR + 1.2, 0), { after: true, late: true });
  syncLabels(); resize();
}

// ------------------------------------------------------------------ labels
const layer = $('labels');
function syncLabels() {
  layer.innerHTML = '';
  for (const l of labels) { const el = document.createElement('div'); el.className = 'lbl' + (l.ember ? ' ember' : ''); el.textContent = l.text; layer.appendChild(el); l.el = el; }
}
const tv = new THREE.Vector3();
function updateLabels() {
  const w = innerWidth, h = innerHeight;
  for (const l of labels) {
    const want = l.after ? (l.late ? state.t > 0.98 : state.t > 0.05) : state.t < 0.02;
    tv.copy(l.pos).project(camera);
    const vis = state.showTags && want && tv.z < 1 && Math.abs(tv.x) < 1.05 && Math.abs(tv.y) < 1.05;
    l.el.style.opacity = vis ? 1 : 0;
    l.el.style.transform = `translate(${(tv.x * 0.5 + 0.5) * w}px, ${(-tv.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
  }
}

// ------------------------------------------------------------------ view
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h, half = (a < 1 ? 36 / a : 32);
  camera.left = -half * a; camera.right = half * a; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
  renderer.setSize(w, h, false); composer.setSize(w, h);
  drawRes.set(w, h);
}
camera.position.set(60, 52, 70); controls.target.set(4, -1, 2); camera.zoom = 1.05; camera.updateProjectionMatrix();
if (new URLSearchParams(location.search).get('view') === 'lab') { camera.position.set(8, 14, -70); controls.target.set(0, -2.4, -20); camera.zoom = 3.0; camera.updateProjectionMatrix(); controls.autoRotate = false; }
addEventListener('resize', resize);

function note() {
  $('note').innerHTML = state.after
    ? '<h2>After the Calamity</h2>Orin\'s seal breaks and Niro takes control for a moment. The city is erased outward from where he stands: <b>everything scrubbed off the map</b>, the ground left <b>completely smooth</b> and dark: a black wound in the middle of the plains. The family is gone. Nera survives.'
    : '<h2>Aurelia · a Storyborn settlement</h2>Kansas, on a low limestone bluff above the Solomon River valley: white stone and gold over the prairie, a city of progress sped up by its Storyborn. Lines of script glow on its walls and streets. <b>The Cathedral of the Storyborn</b> crowns the rings; the ruler lives in a <b>tower with no doors</b>. Orin\'s home, the seminary where he takes the priest\'s test, and the <b>Undercroft</b> under the north slope: Nera\'s lab, <b>raw concrete and void light</b>, where she studies a Storyborn\'s body and reports to the Voided.';
}
function seg(id, fn) { $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; [...$(id).children].forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset.v); }); }
seg('stateSeg', v => { state.after = +v; note(); if (reduceMotion) state.t = state.after; });
seg('themeSeg', v => { state.theme = v; document.body.classList.toggle('paper', v === 'paper'); build(); });
seg('tagSeg', v => { state.showTags = v === 'on'; });

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  if (state.t !== state.after) state.t += Math.sign(state.after - state.t) * Math.min(Math.abs(state.after - state.t), dt * 0.35);
  const R = state.t * state.t * 48;                      // erasure front, from Orin outward
  ERASE.uR.value = R;
  scar.visible = R > 0.01; if (scarLow) scarLow.visible = R > 0.01; if (labLight) labLight.visible = state.t < 0.3; if (labLight2) labLight2.visible = state.t < 0.3;
  if (runner) {                                   // before: a slow pulse along the passage; during the erasure: her run; after: gone
    const u = state.t > 0.02 ? Math.min(1, state.t * 1.25) : (time * 0.06) % 1;
    runner.position.copy(runner.userData.curve.getPointAt(u));
    runner.visible = state.t < 0.97;
    runner.scale.setScalar(state.t > 0.02 ? 1.3 : 0.7);
    nera.visible = state.t > 0.9;
  }
  orin.visible = state.t > 0.05;
  root.traverse(o => { if (o.isMesh && o.userData.erasable !== undefined) o.castShadow = R < 0.01; });
  // magic layer: fades out as the erasure passes
  if (magic) {
    magic.visible = state.t < 0.6;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    lanternData.forEach((d, i) => {
      const y = (d.y0 + time * d.sp) % 17, e = Math.hypot(d.x - ERASE.uC.value.x, d.z - ERASE.uC.value.y) < R ? 0 : 1;
      p.set(d.x + Math.sin(time * 0.5 + d.ph) * 0.4, T1 + 1 + y, d.z + Math.cos(time * 0.4 + d.ph) * 0.4);
      sc.setScalar(e * Math.min(1, (17 - y) / 3) * (0.8 + 0.3 * Math.sin(time * 3 + d.ph)));
      q.setFromEuler(new THREE.Euler(time + d.ph, time * 0.7, 0)); m4.compose(p, q, sc); lanterns.setMatrixAt(i, m4);
    });
    lanterns.instanceMatrix.needsUpdate = true;
    flags.forEach(f => { f.rotation.y = Math.sin(time * 1.3 + f.userData.ph) * 0.5 + 0.6; });
    rings.forEach(r_ => { r_.rotation.y += dt * r_.userData.sp; });
    falls.forEach(m => { m.uniforms.uT.value = time; });
  }
  liftCars.forEach((c, i) => { c.position.lerpVectors(c.userData.a, c.userData.b, 0.5 + 0.5 * Math.sin(time * 0.35 + i * PI)); c.visible = state.t < 0.05; });
  controls.update();
  composer.render();
  updateLabels();
  requestAnimationFrame(frame);
}
const q = new URLSearchParams(location.search);
if (q.get('after') === '1') { state.after = 1; state.t = 1; [...$('stateSeg').children].forEach(x => x.classList.toggle('on', x.dataset.v === '1')); }
if (q.get('theme') === 'paper') { state.theme = 'paper'; document.body.classList.add('paper'); [...$('themeSeg').children].forEach(x => x.classList.toggle('on', x.dataset.v === 'paper')); }
build(); note();
$('boot').remove();
frame();
