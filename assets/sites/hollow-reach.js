/* Epitaph — The Hollow Reach, the capital of the Voided (sites/hollow-reach.html; opened from the map).
 *
 * Central Germany (Atlas: 51.5N 9.5E), in the forested uplands. Not a ruin: a working city, above and below ground.
 *   The Hollow     a vast round pit with smooth black walls, open to the sky, hidden in the forest
 *   Val's palace   black stone, on the floor of the Hollow beside a still lake; Val (the Monarch, the first Voided)
 *   The station    the capital's station, a split black pyramid on an island in the lake, six relays round the shore
 *   The arcade     a ramp down the west wall under leaning concrete fins
 *   Surface        the arena (tiered stands, ribbed wall), the Assembly (brutalist, on piers), barracks pods,
 *                  housing, relay masts, obelisks round the rim
 *   Below          cut open on the south-east: the gate hall (void gates) and the gifting chamber
 * Two looks: Model (the Aurelia style) and Blocks (columns like the Earth map, bevelled, white outlines, a soft
 * gradient). The blocks are made from the model by a top-down height pass, so the two always match.
 * ?style=blocks, ?theme=paper, ?walk=descent|palace|below (&stop=n).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = id => document.getElementById(id);
const PI = Math.PI, D = d => d * PI / 180;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const THEMES = {
  crt: {
    bg: '#07060b', ink: '#030205', outlinePx: 1.25, blockLine: '#f4f0ff',
    hemiSky: '#ded8ff', hemiGround: '#120f18', hemi: 0.85, key: '#f1e9ff', keyI: 1.8, rim: '#9b8cff', rimI: 0.9, env: 0.16, bloom: 0.6,
    moss: '#2e3d27', soil: '#3b3127', soil2: '#2b241d', rock: '#46433d', concrete: '#5d5b56', concreteD: '#43413d', paving: '#34333a',
    black: '#0d0c12', stone: '#1f1d25', stone2: '#2b2833', leaf: '#1d3323', leaf2: '#284230', trunk: '#2a1d14', water: '#0b0a16',
    sand: '#bdb29c', frost: '#cfe0ff', glow: '#ffbf6a', vglow: '#9b8cff', metal: '#3c3b44', base: '#141119', figure: '#17151d', robe: '#2a2533',
    fabric: '#3a3842', ribs: '#22212b', bronze: '#6e5a3a', plinth: '#120f18'
  },
  paper: {
    bg: '#f1ece4', ink: '#141a2c', outlinePx: 1.35, blockLine: '#141a2c',
    hemiSky: '#fffaf3', hemiGround: '#b9ae9c', hemi: 1.15, key: '#fff6ea', keyI: 2.0, rim: '#ffffff', rimI: 0.3, env: 0.4, bloom: 0,
    moss: '#7f9a62', soil: '#a88e6c', soil2: '#8c7457', rock: '#9b958a', concrete: '#b3b0a8', concreteD: '#969289', paving: '#8d8a94',
    black: '#2a2836', stone: '#3c3946', stone2: '#4b4756', leaf: '#4f7a4e', leaf2: '#64905c', trunk: '#6b4a32', water: '#3b3f6e',
    sand: '#e6dac0', frost: '#e3eeff', glow: '#ff9a3c', vglow: '#6a5acd', metal: '#6c6a74', base: '#d9cfbf', figure: '#2a2836', robe: '#4a4458',
    fabric: '#7a7682', ribs: '#4a4756', bronze: '#a88a54', plinth: '#cfc3ae'
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
const inward = g => { g.scale(-1, 1, 1); g.computeVertexNormals(); return g; };   // turn a closed shape inside out (to see it from inside)
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
// a quad from four points, turned so it faces `want`
function quad(K, kind, a, b, c, d, want) {
  let pts = [a, b, c, d];
  const n = b.clone().sub(a).cross(c.clone().sub(a));
  if (want && n.dot(want) < 0) pts = [a, d, c, b];
  const pos = []; for (const i of [0, 1, 2, 0, 2, 3]) pos.push(pts[i].x, pts[i].y, pts[i].z);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); K.add(kind, g);
}
function tubeSeg(K, kind, a, b, r0, r1, seg = 8) { const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r1, r0, d.length(), seg); g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1))); K.add(kind, g); }
// a standing person, about 1.25 tall at s = 1, facing +z
function figure(K, kind, p, ry = 0, s = 1, head = kind) {
  const at = (g, y) => xf(g, { x: p.x, y: p.y + y * s, z: p.z, ry, s });
  K.add(kind, at(new THREE.CylinderGeometry(0.17, 0.25, 0.82, 8).translate(0, 0.41, 0), 0));
  K.add(kind, at(new THREE.CylinderGeometry(0.2, 0.17, 0.2, 8).translate(0, 0.1, 0), 0.8));
  K.add(head, at(new THREE.SphereGeometry(0.13, 10, 8).translate(0, 0.13, 0), 1.0));
}
// polar helpers: x = cos a, z = sin a; a box turned so its local +z points outward at angle a
const atA = (a, r, y = 0) => V(Math.cos(a) * r, y, Math.sin(a) * r);
const ryOut = a => PI / 2 - a;
const angOf = (x, z) => { let a = Math.atan2(z, x); if (a < 0) a += 2 * PI; return a; };

// ------------------------------------------------------------------ layout
const R = 34, RP = 16, PF = -7, BASE = -10;                 // the stand, the Hollow's radius, its floor, the base
const SEC0 = D(20), SEC1 = D(75), SECM = (SEC0 + SEC1) / 2;  // the cut-away (south-east), showing what's below
const inSec = a => a > SEC0 && a < SEC1;
const RAMP = { r: 15.05, rin: 13.6, a0: D(140), a1: D(225) };
const rampY = a => PF * THREE.MathUtils.clamp((a - RAMP.a0) / (RAMP.a1 - RAMP.a0), 0, 1);
const LAKE = { x: 0, z: 1.5, r: 8.5 };
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gh = (x, z) => { const r = Math.hypot(x, z); const b = 0.5 + 0.25 * Math.sin(x * 0.31 + 1) + 0.2 * Math.cos(z * 0.27) + 0.1 * Math.sin((x - z) * 0.6); return Math.max(0, b) * smooth(17.5, 23, r) * 0.9; };
const ARENA = { x: 0, z: -25.5, ax: 4.0, az: 2.4, tiers: 5, step: 0.62 };
const ASSEMBLY = { x: -24.5, z: 0.5 };
const PODS = [D(-38), D(-26), D(-14)].map(a => ({ a, r: 24.5 }));
const MASTS = [D(105), D(196), D(300), D(160)].map((a, i) => ({ a, r: i === 3 ? 30.5 : 29.5 }));
const HOUSES = [];
{ const r = rng(7); for (let i = 0; i < 9; i++) { const a = D(80 + i * 5 + r() * 2.5), rr = 20.5 + (i % 3) * 4 + r() * 1.2; HOUSES.push({ a, r: rr, w: 2.2 + r() * 1.4, d: 1.4 + r() * 0.6, h: 0.9 + r() * 0.9 }); } }
const OBELISKS = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map(D).filter(a => !inSec(a) && Math.abs(a - D(140)) > D(6));
const labels = [];
const L = (text, pos, opts = {}) => labels.push({ text, pos, ...opts });

// ------------------------------------------------------------------ the void gate (from Aurelia): a crack touched by nothing
const gates = [], screens = [];
function makeGate(w, h, seed) {
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uSeed: { value: seed } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT, uSeed; varying vec2 vUv;
      float h(float n){ return fract(sin(n * 127.1 + uSeed * 31.7) * 43758.5453); }
      float n1(float x){ float i = floor(x), f = fract(x); return mix(h(i), h(i + 1.0), f * f * (3.0 - 2.0 * f)); }
      float crack(vec2 uv, float k){
        float c = 0.5 + (n1(uv.y * 2.6 + k * 1.7) - 0.5) * 0.34 + (n1(uv.y * 15.0 + k * 5.3) - 0.5) * 0.09;
        float w = (0.02 + 0.17 * pow(max(sin(3.14159 * uv.y), 0.0), 0.8)) * (0.55 + 0.9 * n1(uv.y * 8.0 + k * 3.1));
        return w - abs(uv.x - c);
      }
      void main(){
        float jolt = floor(uT * 3.0), g = step(0.78, h(jolt)), k = uT * 0.22 + g * jolt * 0.37;
        vec2 uv = vUv; float row = floor(uv.y * 46.0);
        uv.x += g * (h(row + jolt * 13.0) - 0.5) * 0.2 * step(0.55, h(row * 1.3 + jolt));
        float sp = 0.004 + 0.016 * g;
        float dR = crack(uv + vec2(sp, 0.0), k), dG = crack(uv, k), dB = crack(uv - vec2(sp, 0.0), k);
        vec2 q = vec2((vUv.x - 0.5) * 1.6 + uT * 0.015, vUv.y);
        vec3 lo = mix(vec3(0.95, 0.5, 0.25), vec3(0.3, 0.85, 0.8), h(3.0)), hi = mix(vec3(0.02, 0.03, 0.12), vec3(0.08, 0.0, 0.1), h(5.0));
        vec3 far = mix(lo, hi, smoothstep(0.32, 0.95, q.y));
        float hills = 0.3 + 0.07 * sin(q.x * 6.0 + uSeed) + 0.03 * sin(q.x * 21.0 + uSeed * 2.0);
        far = q.y < hills ? mix(vec3(0.03, 0.02, 0.06), lo * 0.3, smoothstep(hills - 0.08, hills, q.y)) : far;
        far += step(0.993, h(floor(q.x * 120.0) * 7.0 + floor(q.y * 120.0))) * step(0.5, q.y);
        far = mix(far, vec3(1.0), 0.25 * g * step(0.5, h(row + jolt)));
        float inside = step(0.0, dG);
        vec3 edge = vec3(smoothstep(0.012, 0.0, abs(dR)), smoothstep(0.012, 0.0, abs(dG)), smoothstep(0.012, 0.0, abs(dB)));
        float halo = exp(-max(-dG, 0.0) * 22.0) * 0.45 * (1.0 - inside);
        vec3 col = far * inside + edge * vec3(1.3, 1.15, 1.6) + vec3(0.6, 0.5, 1.0) * halo;
        float a = max(inside, max(max(edge.r, edge.g), max(edge.b, halo)));
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
      }` });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.userData.gate = m; gates.push(mesh); return mesh;
}

// ------------------------------------------------------------------ pieces
// the station: two halves of a black pyramid split by light, flush on the ground; the tip floats (added as its own mesh)
function station(K, P_, s, h, hc, g) {
  const sc = s * (1 - hc / h);
  const half = sign => { const Q = (x, y, z) => { const p = P_(x * sign + sign * g, y + 0.02, z); return [p.x, p.y, p.z]; };
    const a = Q(0, 0, -s), b = Q(s, 0, -s), c = Q(s, 0, s), d = Q(0, 0, s), a2 = Q(0, hc, -sc), b2 = Q(sc, hc, -sc), c2 = Q(sc, hc, sc), d2 = Q(0, hc, sc);
    for (const [kind, qs] of Object.entries({ black: [[b, b2, c2, c], [a, a2, b2, b], [c, c2, d2, d], [a2, d2, c2, b2], [a, b, c, d]], vglow: [[a, d, d2, a2]] })) { const pos = []; for (let q of qs) { if (sign < 0) q = [...q].reverse(); pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]); } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); K.add(kind, geo); } };
  half(1); half(-1);
  const hwAt = y => s - (s - sc) * y / hc;
  for (const y of [hc * 0.2, hc * 0.52, hc * 0.82]) for (const sign of [-1, 1]) { const w_ = hwAt(y); K.add('vglow', xf(box(0.04, 0.05, 2 * w_), P_(sign * (g + w_ + 0.03), 0.02 + y, 0))); for (const sz of [-1, 1]) K.add('vglow', xf(box(w_, 0.05, 0.04), P_(sign * (g + w_ / 2), 0.02 + y, sz * (w_ + 0.03)))); }
  return { sc, top: hc };
}
function relay(K, p, q = 1) {
  const P_ = (x, y, z) => V(p.x + x, p.y + y, p.z + z);
  K.add('concrete', xf(cyl(0.52 * q, 0.55 * q, 0.16 * q, 20), P_(0, 0, 0))); K.add('black', xf(cyl(0.44 * q, 0.46 * q, 0.42 * q, 20), P_(0, 0.16 * q, 0)));
  K.add('glass', xf(cyl(0.36 * q, 0.36 * q, 1.8 * q, 22), P_(0, 0.58 * q, 0))); K.add('vglow', xf(cyl(0.15 * q, 0.15 * q, 1.8 * q, 12), P_(0, 0.58 * q, 0)));
  for (let j = 0; j < 6; j++) { const b = j * PI / 3; K.add('metal', xf(box(0.045 * q, 1.8 * q, 0.045 * q), P_(Math.cos(b) * 0.48 * q, 0.58 * q, Math.sin(b) * 0.48 * q))); }
  for (const y of [0.58, 1.48, 2.38]) K.add('bronze', new THREE.TorusGeometry(0.49 * q, 0.028 * q, 6, 28).rotateX(PI / 2).translate(p.x, p.y + y * q, p.z));
  K.add('black', xf(cyl(0.55 * q, 0.52 * q, 0.34 * q, 20), P_(0, 2.38 * q, 0))); K.add('concrete', xf(cyl(0.34 * q, 0.4 * q, 0.14 * q, 16), P_(0, 2.72 * q, 0))); K.add('vglow', xf(cyl(0.06 * q, 0.06 * q, 0.16 * q, 8), P_(0, 2.86 * q, 0)));
}
// a ribbed black pod (Harkonnen-style barracks): a capsule lying along the radius, ribbed every half unit
function pod(K, a, r, y) {
  const len = 5.2, rad = 1.15, c = atA(a, r, y + rad * 0.72);
  K.add('black', new THREE.CapsuleGeometry(rad, len, 6, 16).rotateX(PI / 2).rotateY(ryOut(a)).translate(c.x, c.y, c.z));
  for (let i = 0; i <= 10; i++) { const t = -len / 2 + i * len / 10, p = atA(a, r + t, y + rad * 0.72); K.add('ribs', new THREE.TorusGeometry(rad + 0.06, 0.07, 5, 24).rotateY(ryOut(a)).translate(p.x, p.y, p.z)); }
  const door = atA(a, r - len / 2 - rad + 0.05, y + 0.02); K.add('vglow', xf(box(0.7, 0.9, 0.05), { ...door, ry: ryOut(a) }));
  K.add('paving', xf(box(2.8, 0.25, len + 2 * rad + 0.6), { ...atA(a, r, y - 0.2), ry: ryOut(a) }));
}
// a relay mast: a lattice tower (it looks like a cell tower) with a violet lamp
const mastLamps = [];
function mast(K, p, H = 6.5) {
  const w0 = 0.75, w1 = 0.18, legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  legs.forEach(([sx, sz]) => tubeSeg(K, 'metal', V(p.x + sx * w0, p.y, p.z + sz * w0), V(p.x + sx * w1, p.y + H, p.z + sz * w1), 0.05, 0.035, 5));
  for (let k = 0; k < 6; k++) { const y0 = H * k / 6, y1 = H * (k + 1) / 6, wa = w0 + (w1 - w0) * k / 6, wb = w0 + (w1 - w0) * (k + 1) / 6;
    for (let e = 0; e < 4; e++) { const [ax, az] = legs[e], [bx, bz] = legs[(e + 1) % 4]; tubeSeg(K, 'metal', V(p.x + ax * wa, p.y + y0, p.z + az * wa), V(p.x + bx * wb, p.y + y1, p.z + bz * wb), 0.022, 0.022, 4); } }
  K.add('metal', xf(box(0.7, 0.08, 0.7), { x: p.x, y: p.y + H * 0.82, z: p.z }));
  for (const [dx, dz, ry] of [[0.3, 0, 0], [-0.3, 0, PI], [0, 0.3, PI / 2], [0, -0.3, -PI / 2]]) K.add('concreteD', xf(box(0.12, 0.6, 0.08), { x: p.x + dx, y: p.y + H * 0.82 + 0.08, z: p.z + dz, ry }));
  tubeSeg(K, 'metal', V(p.x, p.y + H, p.z), V(p.x, p.y + H + 1.1, p.z), 0.025, 0.02, 4);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: '#c9b8ff' }));
  lamp.position.set(p.x, p.y + H + 1.15, p.z); mastLamps.push(lamp); return lamp;
}

// ------------------------------------------------------------------ the city (diorama)
let capstone = null, beam = null, valDust = null, pulses = [];
function buildReach(K, extra) {
  // ---- ground: the forest floor ring, the outer cliff in layers, the Hollow's black wall, its floor
  const NA = 240, NR = 18;
  for (let i = 0; i < NA; i++) {
    const a0 = i / NA * 2 * PI, a1 = (i + 1) / NA * 2 * PI;
    if (inSec((a0 + a1) / 2)) continue;
    for (let j = 0; j < NR; j++) {
      const r0 = RP + (R - RP) * j / NR, r1 = RP + (R - RP) * (j + 1) / NR;
      const P = (a, r) => { const x = Math.cos(a) * r, z = Math.sin(a) * r; return V(x, gh(x, z), z); };
      quad(K, 'moss', P(a0, r0), P(a1, r0), P(a1, r1), P(a0, r1), V(0, 1, 0));
    }
    // the outer cliff: soil, then darker soil, then rock
    const o0 = atA(a0, R), o1 = atA(a1, R), out = atA((a0 + a1) / 2, 1);
    const t0 = gh(o0.x, o0.z), t1 = gh(o1.x, o1.z);
    for (const [kind, ya, yb] of [['soil', 0, -1.4], ['soil2', -1.4, -4.2], ['rock', -4.2, BASE]]) quad(K, kind, V(o0.x, ya === 0 ? t0 : ya, o0.z), V(o1.x, ya === 0 ? t1 : ya, o1.z), V(o1.x, yb, o1.z), V(o0.x, yb, o0.z), out);
  }
  // the Hollow's wall: smooth and black, as if something had erased the ground away; seen from inside
  for (let i = 0; i < NA; i++) {
    const a0 = i / NA * 2 * PI, a1 = (i + 1) / NA * 2 * PI, am = (a0 + a1) / 2, p0 = atA(a0, RP), p1 = atA(a1, RP);
    quad(K, 'black', V(p0.x, 0, p0.z), V(p1.x, 0, p1.z), V(p1.x, PF, p1.z), V(p0.x, PF, p0.z), atA(am, -1));
    if (inSec(am)) quad(K, 'concrete', V(p0.x, 0, p0.z), V(p1.x, 0, p1.z), V(p1.x, BASE + 0.9, p1.z), V(p0.x, BASE + 0.9, p0.z), atA(am, 1));
  }
  K.add('paving', new THREE.CircleGeometry(RP, 120).rotateX(-PI / 2).translate(0, PF, 0));
  // lit slits in the wall: the rooms dug in behind it
  { const r = rng(11);
    for (const y of [-1.6, -3.4, -5.2]) for (let k = 0; k < 26; k++) {
      const a = r() * 2 * PI, len = 0.6 + r() * 1.8;
      if (a > RAMP.a0 - 0.1 && a < RAMP.a1 + 0.1 && Math.abs(y - rampY(a)) < 1.6) continue;
      if (a > D(240) && a < D(300)) continue;                     // the palace stands against this stretch
      K.add('vglow', xf(box(len, 0.09, 0.05), { ...atA(a, RP - 0.03, y), ry: ryOut(a) }));
    } }
  // the parapet round the rim (gap where the arcade starts, none over the cut-away)
  for (let i = 0; i < 160; i++) { const a = (i + 0.5) / 160 * 2 * PI; if (inSec(a) || Math.abs(a - D(140)) < D(5)) continue; K.add('concreteD', xf(box(2 * PI * (RP + 0.2) / 160 + 0.02, 0.38, 0.32), { ...atA(a, RP + 0.18, 0), ry: ryOut(a) })); }

  // ---- the arcade: a ramp cut along the west wall, from the rim down to the floor, under leaning concrete fins
  const NS = 72;
  for (let i = 0; i < NS; i++) {
    const a = RAMP.a0 + (RAMP.a1 - RAMP.a0) * (i + 0.5) / NS, y = rampY(a), arc = (RAMP.a1 - RAMP.a0) / NS * RAMP.r + 0.03;
    K.add('concrete', xf(box(arc, 0.4, RP - RAMP.rin), { ...atA(a, (RP + RAMP.rin) / 2, y - 0.4), ry: ryOut(a) }));
    K.add('concreteD', xf(box(arc, 0.45, 0.22), { ...atA(a, RAMP.rin + 0.11, y), ry: ryOut(a) }));
  }
  for (let a = RAMP.a0 + D(4); a < RAMP.a1 - D(2); a += D(5.2)) {
    const y = rampY(a), base = atA(a, RAMP.rin + 0.2, y);
    K.add('concrete', xf(box(0.24, 3.7, 0.6), { ...atA(a, RAMP.rin + 0.15, y), ry: ryOut(a), rx: 0.14 }));   // a fin, leaning in toward the wall
    const top = atA(a, RAMP.rin + 0.15 + 3.7 * Math.sin(0.14) + 0.1, y + 3.7 * Math.cos(0.14));
    const wall = atA(a, RP - 0.05, y + 3.6);
    K.add('concrete', xf(box(0.24, 0.32, wall.distanceTo(V(top.x, wall.y, top.z)) + 0.3), { ...atA(a, (RP + RAMP.rin + 1.1) / 2, y + 3.45), ry: ryOut(a) }));
  }
  L('The arcade', atA(D(178), RAMP.r, rampY(D(178)) + 4.2));

  // ---- the lake, the island, the station, the relays
  K.add('water', new THREE.CircleGeometry(LAKE.r, 96).rotateX(-PI / 2).translate(LAKE.x, PF + 0.04, LAKE.z));
  K.add('stone', new THREE.TorusGeometry(LAKE.r + 0.15, 0.2, 5, 96).rotateX(PI / 2).translate(LAKE.x, PF + 0.06, LAKE.z));
  K.add('concrete', xf(cyl(2.2, 2.45, 0.5, 40), { x: LAKE.x, y: PF, z: LAKE.z }));
  const SP = (x, y, z) => V(LAKE.x + x, PF + 0.5 + y, LAKE.z + z);
  const st = station(K, SP, 1.45, 4.6, 3.3, 0.17);
  extra.capTip = { p: SP(0, st.top + 0.35, 0), r: st.sc * Math.SQRT2, h: 4.6 - 3.3 };
  K.add('vglow', new THREE.TorusGeometry(1.95, 0.04, 4, 64).rotateX(PI / 2).translate(LAKE.x, PF + 0.52, LAKE.z));
  L('The station', SP(0, 5.6, 0));
  const RR = 10.6; extra.relays = [];
  for (let k = 0; k < 6; k++) {
    const a = k * PI / 3, p = V(LAKE.x + Math.cos(a) * RR, PF, LAKE.z + Math.sin(a) * RR);
    relay(K, p, 0.62); extra.relays.push(p);
    const from = V(LAKE.x + Math.cos(a) * (LAKE.r + 0.4), PF + 0.03, LAKE.z + Math.sin(a) * (LAKE.r + 0.4)), len = RR - LAKE.r - 0.8;
    K.add('vglow', xf(box(0.07, 0.012, len).translate(0, 0, len / 2), { ...from, ry: PI / 2 - a }));
  }
  L('Relays', V(LAKE.x + RR, PF + 2.4, LAKE.z));

  // ---- Val's palace: black stone against the north wall, facing the lake
  const pz = -12.3, py = PF + 0.6;
  K.add('stone', xf(box(13.6, 0.6, 5.8), { x: 0, y: PF, z: -11.9 }));
  for (let s = 0; s < 4; s++) K.add('stone', xf(box(5.2 - s * 0.2, 0.6 - s * 0.15, 0.3), { x: 0, y: PF, z: -8.85 + s * 0.3 - 0.15 }));
  for (const sx of [-1, 1]) {
    K.add('stone', xf(box(4.4, 4.0, 4.0), { x: sx * 4.5, y: py, z: pz - 0.1 }));
    K.add('black', xf(box(4.7, 0.28, 4.3), { x: sx * 4.5, y: py + 4.0, z: pz - 0.1 }));
    for (const row of [0.5, 2.3]) for (const cx of [-1.3, 0, 1.3]) K.add('glow', xf(box(0.55, 1.25, 0.06), { x: sx * 4.5 + cx, y: py + row, z: pz + 1.93 }));
    for (const cx of [-2.0, -0.65, 0.65, 2.0]) K.add('stone2', xf(box(0.18, 4.0, 0.14), { x: sx * 4.5 + cx, y: py, z: pz + 1.96 }));
    K.add('leaf', xf(box(1.6, 0.35, 0.5), { x: sx * 4.2, y: py, z: -9.5 })); K.add('stone2', xf(box(1.7, 0.3, 0.6), { x: sx * 4.2, y: py - 0.02, z: -9.5 }));
    K.add('leaf', xf(box(3.8, 0.3, 0.6), { x: sx * 4.5, y: py + 4.28, z: pz - 0.1 }));
  }
  K.add('stone', xf(box(4.6, 6.0, 4.6), { x: 0, y: py, z: pz + 0.05 }));
  K.add('black', xf(box(5.0, 0.34, 5.0), { x: 0, y: py + 6.0, z: pz + 0.05 }));
  K.add('black', xf(box(5.3, 0.9, 0.5), { x: 0, y: py + 4.6, z: pz + 2.45 }));                 // the frieze over the door
  for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) K.add('stone2', xf(box(0.32, 0.26, 0.08), { x: -2.2 + i * 0.55, y: py + 4.72 + j * 0.36, z: pz + 2.72 }));
  for (const sx of [-1, 1]) for (let f = 0; f < 4; f++) K.add('stone2', xf(box(0.14, 4.6, 0.3), { x: sx * (1.25 + f * 0.24), y: py, z: pz + 2.45 }));
  K.add('glow', xf(box(1.9, 3.0, 0.06), { x: 0, y: py, z: pz + 2.36 }));                        // the tall glass door, lit amber
  for (const cx of [-0.48, 0.48]) K.add('stone2', xf(box(0.06, 3.0, 0.08), { x: cx, y: py, z: pz + 2.4 }));
  K.add('glow', xf(box(1.5, 1.05, 0.06), { x: 0, y: py + 3.42, z: pz + 2.36 }));
  K.add('stone', xf(box(2.6, 0.16, 0.9), { x: 0, y: py + 3.2, z: pz + 2.75 }));                 // the balcony
  for (let i = 0; i <= 8; i++) K.add('stone2', xf(box(0.05, 0.42, 0.05), { x: -1.25 + i * 0.3125, y: py + 3.36, z: pz + 3.15 }));
  K.add('stone2', xf(box(2.6, 0.05, 0.08), { x: 0, y: py + 3.78, z: pz + 3.15 }));
  for (const cx of [-2.9, 2.9]) { K.add('stone2', xf(cyl(0.1, 0.12, 0.6, 8), { x: cx, y: py, z: -9.3 })); K.add('glow', xf(box(0.22, 0.26, 0.22), { x: cx, y: py + 0.6, z: -9.3 })); }
  L('Val\'s palace', V(0, py + 7.2, pz));
  // Val on the balcony: the Monarch, the first Voided; blackness spreading on him, the stone frosted round his feet
  const valP = V(0.15, py + 3.36, pz + 2.85);
  figure(K, 'figure', valP, 0, 0.95, 'val');
  K.add('val', xf(box(0.12, 0.42, 0.12), { x: valP.x + 0.24, y: valP.y + 0.35, z: valP.z }));
  K.add('frost', new THREE.CircleGeometry(0.75, 24).rotateX(-PI / 2).translate(valP.x, valP.y + 0.012, valP.z - 0.1));
  extra.valP = valP;
  L('Val', V(valP.x, valP.y + 1.6, valP.z), { small: 1 });

  // ---- the yard on the floor: Voided drilling in ranks
  for (let rI = 0; rI < 4; rI++) for (let c = 0; c < 8; c++) figure(K, 'robe', V(-12.4 + c * 0.55, PF, 5.6 + rI * 0.75), PI / 2, 0.62);
  figure(K, 'figure', V(-7.6, PF, 6.7), -PI / 2, 0.68);
  L('The yard', V(-10.6, PF + 1.8, 6.8));

  // ---- the surface: obelisks round the rim, the arena, the Assembly, pods, houses, masts, roads, the forest
  for (const a of OBELISKS) { const p = atA(a, 17.6); p.y = gh(p.x, p.z); K.add('black', xf(new THREE.CylinderGeometry(0.28, 0.5, 4.2, 4).translate(0, 2.1, 0), { ...p, y: p.y - 0.1, ry: PI / 4 })); K.add('vglow', xf(new THREE.ConeGeometry(0.2, 0.5, 4).translate(0, 0.25, 0), { ...p, y: p.y + 4.1, ry: PI / 4 })); }
  // the arena: tiered stands round an oval of pale sand, a ribbed black wall, a gate toward the Hollow
  { const A = ARENA, y0 = gh(A.x, A.z) + 0.1, ell = (rx, rz) => { const s = new THREE.Shape(); s.absellipse(0, 0, rx, rz, 0, 2 * PI); return s; };
    const pad = new THREE.ExtrudeGeometry(ell(A.ax + A.tiers * A.step + 1.4, A.az + A.tiers * A.step + 1.4), { depth: 1.4, bevelEnabled: false, curveSegments: 48 }).rotateX(-PI / 2).translate(A.x, y0 - 1.4, A.z);
    K.add('paving', pad);
    K.add('sand', new THREE.ExtrudeGeometry(ell(A.ax, A.az), { depth: 0.06, bevelEnabled: false, curveSegments: 48 }).rotateX(-PI / 2).translate(A.x, y0, A.z));
    for (let i = 0; i < A.tiers; i++) { const sh = ell(A.ax + (i + 1) * A.step, A.az + (i + 1) * A.step); sh.holes.push(ell(A.ax + i * A.step, A.az + i * A.step));
      K.add(i % 2 ? 'concrete' : 'concreteD', new THREE.ExtrudeGeometry(sh, { depth: 0.3 * (i + 1), bevelEnabled: false, curveSegments: 48 }).rotateX(-PI / 2).translate(A.x, y0, A.z)); }
    const ox = A.ax + A.tiers * A.step + 0.2, oz = A.az + A.tiers * A.step + 0.2, r = rng(5);
    for (let k = 0; k < 64; k++) { const t = k / 64 * 2 * PI; if (Math.abs(t - PI / 2) < 0.22) continue;
      const p = V(A.x + Math.cos(t) * ox, y0, A.z + Math.sin(t) * oz), n = V(Math.cos(t) / ox, 0, Math.sin(t) / oz).normalize();
      K.add('black', xf(box(0.3, 2.3 + 0.25 * Math.sin(k * 0.9), 0.55).translate(0, 0, 0.2), { ...p, ry: Math.atan2(n.x, n.z) })); }
    for (let i = 1; i < A.tiers; i++) for (let k = 0; k < 48; k++) { if (r() < 0.45) continue; const t = k / 48 * 2 * PI + r() * 0.05; if (Math.abs(t - PI / 2) < 0.3) continue;
      const rx = A.ax + (i + 0.5) * A.step, rz = A.az + (i + 0.5) * A.step; K.add('figure', xf(box(0.16, 0.3, 0.16), { x: A.x + Math.cos(t) * rx, y: y0 + 0.3 * (i + 1), z: A.z + Math.sin(t) * rz })); }
    figure(K, 'robe', V(A.x - 0.7, y0 + 0.06, A.z + 0.2), PI / 2, 0.6); figure(K, 'figure', V(A.x + 0.7, y0 + 0.06, A.z - 0.1), -PI / 2, 0.6);
    K.add('paving', xf(box(1.6, 0.06, 6.2), { x: A.x, y: gh(A.x, -18) + 0.02, z: -19.1 }));
    L('The arena', V(A.x, y0 + 3.6, A.z)); }
  // the Assembly: a brutalist hall on piers, a broad stair under it toward the Hollow
  { const p = ASSEMBLY, y0 = gh(p.x, p.z) - 0.3;
    K.add('concrete', xf(box(8.2, 0.5, 6.4), { x: p.x, y: y0 - 0.2, z: p.z }));
    for (const [dx, dz] of [[-2.8, -2.0], [-2.8, 2.0], [0, -2.0], [0, 2.0], [2.6, -2.0], [2.6, 2.0]]) K.add('concrete', xf(box(0.7, 2.3, 0.9), { x: p.x + dx, y: y0, z: p.z + dz }));
    K.add('concrete', xf(box(7.0, 2.6, 5.4), { x: p.x - 0.2, y: y0 + 2.3, z: p.z }));
    K.add('concrete', xf(box(3.0, 1.8, 2.4), { x: p.x - 1.4, y: y0 + 4.9, z: p.z - 1.0 })); K.add('concreteD', xf(box(2.2, 2.6, 1.6), { x: p.x + 1.6, y: y0 + 4.9, z: p.z + 1.3 }));
    K.add('concrete', xf(box(1.5, 1.4, 6.6), { x: p.x - 3.7, y: y0 + 2.9, z: p.z })); K.add('concreteD', xf(box(1.8, 1.0, 1.8), { x: p.x + 3.4, y: y0 + 3.6, z: p.z - 1.8 }));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) K.add('glow', xf(box(0.06, 0.55, 0.2), { x: p.x + 3.22, y: y0 + 2.7 + j * 0.9, z: p.z - 1.9 + i * 0.6 }));
    for (let s = 0; s < 8; s++) K.add('concreteD', xf(box(0.42, 0.28 * (s + 1), 3.0), { x: p.x + 5.6 - s * 0.42, y: y0 - 0.2, z: p.z }));
    K.add('glow', xf(box(0.05, 1.3, 1.6), { x: p.x + 2.2, y: y0 + 0.2, z: p.z }));
    K.add('paving', xf(box(5.6, 0.05, 1.6), { x: -19.2, y: gh(-19, 0.5) + 0.02, z: 0.5 }));
    L('The Assembly', V(p.x, y0 + 8.2, p.z)); }
  for (const P of PODS) pod(K, P.a, P.r, gh(...[Math.cos(P.a) * P.r, Math.sin(P.a) * P.r]) - 0.1);
  L('Barracks', atA(D(-26), 24.5, 3.4));
  for (const h of HOUSES) { const p = atA(h.a, h.r); const y = gh(p.x, p.z) - 0.3;
    K.add('concrete', xf(box(h.w, h.h + 0.3, h.d), { ...p, y, ry: ryOut(h.a) + PI / 2 })); K.add('moss', xf(box(h.w + 0.1, 0.12, h.d + 0.1), { ...p, y: y + h.h + 0.3, ry: ryOut(h.a) + PI / 2 }));
    for (let i = 0; i < Math.round(h.w / 0.5) - 1; i++) K.add('glow', xf(box(0.16, 0.22, 0.04).translate(-h.w / 2 + 0.5 + i * 0.5, 0, h.d / 2 + 0.01), { ...p, y: y + 0.3 + h.h * 0.45, ry: ryOut(h.a) + PI / 2 })); }
  L('Quarters', atA(D(112), 26, 3));
  extra.masts = MASTS.map(m => { const p = atA(m.a, m.r); p.y = gh(p.x, p.z); return p; });
  for (const p of extra.masts) mast(K, p);
  L('Relay masts', V(extra.masts[1].x, extra.masts[1].y + 8.3, extra.masts[1].z));
  // the forest: dark firs everywhere the city isn't, thickest at the edge, so you could walk past it
  { const r = rng(3), clear = [];
    clear.push(p => Math.hypot((p.x - ARENA.x) / (ARENA.ax + 5.3), (p.z - ARENA.z) / (ARENA.az + 5.3)) < 1);
    clear.push(p => Math.abs(p.x - ASSEMBLY.x) < 6.5 && Math.abs(p.z - ASSEMBLY.z) < 4.6);
    clear.push(p => PODS.some(P => atA(P.a, P.r).distanceTo(p) < 4.0));
    clear.push(p => HOUSES.some(h => atA(h.a, h.r).distanceTo(p) < 2.0));
    clear.push(p => extra.masts.some(m => Math.hypot(m.x - p.x, m.z - p.z) < 1.4));
    clear.push(p => Math.hypot(p.x, p.z) < 23.5 && angOf(p.x, p.z) > D(121) && angOf(p.x, p.z) < D(149));
    clear.push(p => Math.abs(p.x) < 1.2 && p.z < -16 && p.z > -22);
    clear.push(p => Math.abs(p.z - 0.5) < 1.2 && p.x < -16 && p.x > -20.5);
    clear.push(p => Math.hypot(p.x, p.z) < 18.6);
    let n = 0;
    for (let t = 0; t < 4000 && n < 760; t++) {
      const a = r() * 2 * PI, rr = 17.5 + Math.sqrt(r()) * 16.2, p = atA(a, rr);
      if (inSec(a) || inSec(a - 0.03) || inSec(a + 0.03) || rr > R - 0.5) continue;
      if (rr < 27 && r() < 0.35) continue;
      if (clear.some(f => f(p))) continue;
      const y = gh(p.x, p.z), h = 1.0 + r() * 1.5 + (rr > 28 ? 0.5 : 0), w = h * (0.32 + r() * 0.08);
      K.add('trunk', xf(cyl(0.05, 0.07, 0.35, 5), { ...p, y: y - 0.05 }));
      K.add(r() < 0.5 ? 'leaf' : 'leaf2', xf(cone(w, h * 0.7, 6), { ...p, y: y + 0.25, ry: r() }));
      K.add('leaf', xf(cone(w * 0.7, h * 0.55, 6), { ...p, y: y + 0.25 + h * 0.42, ry: r() }));
      n++;
    } }

  // ---- below ground, cut open on the south-east: the gate hall over the gifting chamber
  const u = atA(SECM, 1), t = V(-u.z, 0, u.x);
  const S = (rho, y, tau) => V(u.x * rho + t.x * tau, y, u.z * rho + t.z * tau);
  const sRy = ryOut(SECM);
  // the two cut faces and the floor, in layers
  for (const a of [SEC0, SEC1]) { const want = atA(a + (a === SEC0 ? PI / 2 : -PI / 2), 1);
    for (const [kind, ya, yb] of [['soil', 0, -1.4], ['soil2', -1.4, -4.2], ['rock', -4.2, BASE]]) { const p0 = atA(a, RP), p1 = atA(a, R); quad(K, kind, V(p0.x, ya === 0 ? gh(p0.x, p0.z) : ya, p0.z), V(p1.x, ya === 0 ? gh(p1.x, p1.z) : ya, p1.z), V(p1.x, yb, p1.z), V(p0.x, yb, p0.z), want); } }
  const slab = (rA, rB, yA, yB, kind) => { const N = 24; for (let i = 0; i < N; i++) { const a0 = SEC0 + (SEC1 - SEC0) * i / N, a1 = SEC0 + (SEC1 - SEC0) * (i + 1) / N;
      const c = [atA(a0, rA), atA(a1, rA), atA(a1, rB), atA(a0, rB)];
      quad(K, kind, ...c.map(p => V(p.x, yB, p.z)), V(0, 1, 0)); quad(K, 'rock', ...c.map(p => V(p.x, yA, p.z)), V(0, -1, 0));
      const o0 = atA(a0, rB), o1 = atA(a1, rB); quad(K, 'rock', V(o0.x, yB, o0.z), V(o1.x, yB, o1.z), V(o1.x, yA, o1.z), V(o0.x, yA, o0.z), atA((a0 + a1) / 2, 1)); } };
  slab(RP, R, BASE, BASE + 0.9, 'concrete');                    // the deep floor
  slab(RP, 23.6, -4.0, -3.1, 'concrete');                       // the gate hall's floor (and the chamber's roof edge)
  // the gate hall: three void gates in concrete frames along the back, facing out
  for (const tau of [-4.3, 0, 4.3]) {
    const p = S(17.3, -3.1, tau);
    K.add('concrete', xf(box(1.9, 0.3, 0.5), { ...p, ry: sRy })); K.add('concrete', xf(box(1.9, 0.3, 0.5), { ...S(17.3, -3.1 + 2.6, tau), ry: sRy }));
    for (const s_ of [-0.85, 0.85]) K.add('concrete', xf(box(0.22, 2.9, 0.5), { ...S(17.3, -3.1, tau + s_), ry: sRy }));
    const g = makeGate(1.45, 2.25, 3.1 + tau); g.position.copy(S(17.35, -3.1 + 0.3 + 1.12, tau)); g.rotation.y = sRy; extra.add.push(g);
  }
  for (let i = 0; i < 5; i++) K.add('vglow', xf(box(0.06, 0.012, 4.8), { ...S(18.2 + i * 1.1, -3.08, 0), ry: sRy + PI / 2 }));
  for (const tau of [-6.5, 6.5]) K.add('concrete', xf(box(0.6, 3.1, 0.6), { ...S(22.8, -3.1, tau), ry: sRy }));
  figure(K, 'robe', S(19.5, -3.1, 2.1), sRy + PI, 0.62); figure(K, 'robe', S(20.4, -3.1, -1.5), sRy + PI + 0.4, 0.62);
  L('Gate hall', S(20, 0.6, 0));
  // the gifting chamber: round, banded with light, a black eye hanging from its half-dome; cut open toward you
  { const C = S(28.6, BASE + 0.9, 0), RC = 4.3, yF = BASE + 0.9;
    const back = th => { const dr = Math.cos(th); return dr < 0.35; };                // keep the far half (toward the Hollow)
    const NT = 48;
    for (let i = 0; i < NT; i++) { const th0 = i / NT * 2 * PI, th1 = (i + 1) / NT * 2 * PI; if (!back((th0 + th1) / 2)) continue;
      const P = (th, r, y) => S(28.6 + Math.cos(th) * r, y, Math.sin(th) * r), want = S(-Math.cos((th0 + th1) / 2), 0, -Math.sin((th0 + th1) / 2));
      for (let b = 0; b < 6; b++) { const ya = yF + 0.2 + b * 0.62, yb = ya + 0.46; quad(K, 'ribs', P(th0, RC, ya), P(th1, RC, ya), P(th1, RC, yb), P(th0, RC, yb), want); quad(K, 'vglow', P(th0, RC + 0.06, yb), P(th1, RC + 0.06, yb), P(th1, RC + 0.06, yb + 0.16), P(th0, RC + 0.06, yb + 0.16), want); }
      quad(K, 'ribs', P(th0, RC, yF), P(th1, RC, yF), P(th1, RC, yF + 0.2), P(th0, RC, yF + 0.2), want);
      // half-dome: rings of quads from the wall top up to the crown
      const yT = yF + 0.2 + 6 * 0.62;
      for (let k = 0; k < 6; k++) { const p0 = k / 6 * PI / 2, p1 = (k + 1) / 6 * PI / 2;
        quad(K, 'ribs', P(th0, RC * Math.cos(p0), yT + RC * 0.8 * Math.sin(p0)), P(th1, RC * Math.cos(p0), yT + RC * 0.8 * Math.sin(p0)), P(th1, RC * Math.cos(p1), yT + RC * 0.8 * Math.sin(p1)), P(th0, RC * Math.cos(p1), yT + RC * 0.8 * Math.sin(p1)), want); } }
    K.add('concrete', new THREE.CircleGeometry(RC, 40).rotateX(-PI / 2).translate(C.x, yF + 0.01, C.z));
    K.add('concreteD', xf(cyl(1.5, 1.7, 0.3, 32), C)); K.add('vglow', new THREE.TorusGeometry(1.6, 0.03, 4, 48).rotateX(PI / 2).translate(C.x, yF + 0.31, C.z));
    K.add('black', new THREE.SphereGeometry(1.0, 24, 12, 0, 2 * PI, PI / 2, PI / 2).translate(C.x, yF + 0.2 + 6 * 0.62 + 1.6, C.z));
    K.add('vglow', new THREE.TorusGeometry(1.02, 0.04, 4, 40).rotateX(PI / 2).translate(C.x, yF + 0.2 + 6 * 0.62 + 1.6, C.z));
    tubeSeg(K, 'metal', V(C.x, yF + 0.2 + 6 * 0.62 + 1.6, C.z), V(C.x, yF + 0.2 + 6 * 0.62 + RC * 0.8, C.z), 0.04, 0.04, 5);
    // someone being given erasure, kneeling on the dais; three Voided stand round
    const kneel = V(C.x, yF + 0.3, C.z); figure(K, 'figure', V(kneel.x, kneel.y - 0.28, kneel.z), sRy + PI, 0.6, 'figure');
    for (const sx of [-1, 1]) K.add('val', xf(box(0.08, 0.06, 0.24), { ...S(28.6 - 0.12, kneel.y + 0.28, sx * 0.14), ry: sRy }));
    for (const th of [PI - 0.9, PI, PI + 0.9]) figure(K, 'robe', S(28.6 + Math.cos(th) * 2.6, yF, Math.sin(th) * 2.6), sRy + PI / 2 - th, 0.68);
    L('Gifting chamber', S(28.6, -2.2, 0)); }
  // barracks cells by the chamber, a lift up to the forest
  for (const tau of [-9.5, -7.6, 7.6, 9.5]) { const p = S(31.6, BASE + 0.9, tau); K.add('concreteD', xf(box(1.6, 0.06, 2.2), { ...p, ry: sRy })); K.add('concrete', xf(box(0.6, 0.5, 1.8), { ...S(31.6, BASE + 0.96, tau - 0.35), ry: sRy })); K.add('concrete', xf(box(0.6, 0.5, 1.8), { ...S(31.6, BASE + 1.66, tau - 0.35), ry: sRy })); }
  { const p = S(31.8, BASE + 0.9, -4.6); K.add('metal', xf(box(1.1, -BASE - 0.9 + 0.4, 1.1), { ...p, ry: sRy })); K.add('glass', xf(box(1.16, -BASE - 0.9 + 0.3, 1.16), { ...p, ry: sRy })); K.add('vglow', xf(box(0.9, 1.0, 0.9), { ...S(31.8, -6, -4.6), ry: sRy })); }
  // a ribbed tunnel under the gate hall, from the chamber in toward the Hollow
  for (let i = 0; i < 11; i++) { const p = S(17.2 + i * 0.6, BASE + 0.9, 0); K.add('ribs', new THREE.TorusGeometry(0.95, 0.09, 5, 14, PI).rotateY(sRy + PI / 2).translate(p.x, p.y, p.z)); }
  L('Down here', S(33, -9.3, 9), { small: 1 });
  L('The Hollow', V(-2, 1.4, 10.5));
}

// ------------------------------------------------------------------ inside (full size, "bigger on the inside"), far from the model
const PAL0 = V(1000, 0, 0), BEL0 = V(1000, 0, 300);
function portraitTex(i, n, name, years) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 360; const g = c.getContext('2d'), r = rng(40 + i);
  const bg = g.createLinearGradient(0, 0, 0, 300); bg.addColorStop(0, ['#2a2433', '#33282a', '#232a33', '#2d2a24'][i % 4]); bg.addColorStop(1, '#0b0a0e'); g.fillStyle = bg; g.fillRect(0, 0, 256, 300);
  g.fillStyle = ['#151218', '#1d1418', '#12161d', '#191612'][i % 4]; g.beginPath(); g.moveTo(30, 300); g.quadraticCurveTo(128, 170, 226, 300); g.fill();                      // shoulders
  g.fillStyle = ['#3a2a2a', '#2a2a3a', '#4a3a2a'][i % 3]; g.fillRect(112, 172, 32, 40);                                                                                 // collar
  g.fillStyle = '#8a7f74'; g.beginPath(); g.ellipse(128, 132, 38, 50, 0, 0, 2 * PI); g.fill();                                                                           // the same face every time
  g.fillStyle = '#5e554e'; g.beginPath(); g.ellipse(116, 126, 6, 3, 0, 0, 2 * PI); g.ellipse(140, 126, 6, 3, 0, 0, 2 * PI); g.fill();
  g.fillRect(126, 132, 4, 16); g.fillRect(118, 156, 20, 3);
  g.fillStyle = ['#1c1714', '#3a3a3a', '#2a1c12', '#d8d2c8', '#101010'][i % 5];                                                                                        // a different style each time
  g.beginPath(); if (i % 3 === 0) { g.ellipse(128, 96, 42, 26, 0, PI, 2 * PI); } else if (i % 3 === 1) { g.moveTo(88, 120); g.quadraticCurveTo(128, 50, 168, 120); g.lineTo(170, 160); g.lineTo(160, 110); g.lineTo(96, 110); g.lineTo(86, 160); } else { g.ellipse(128, 90, 40, 18, 0, PI, 2 * PI); g.rect(88, 90, 6, 30); g.rect(162, 90, 6, 30); } g.fill();
  if (i % 4 === 2) { g.fillStyle = '#2a1c12'; g.fillRect(112, 152, 32, 14); }
  // the blackness, more of it on the later Monarchs
  const blots = Math.max(0, Math.round((i - n * 0.45) * 2.2));
  g.fillStyle = '#000'; for (let k = 0; k < blots; k++) { g.beginPath(); g.ellipse(70 + r() * 120, 110 + r() * 180, 8 + r() * 26, 6 + r() * 20, r() * 3, 0, 2 * PI); g.fill(); }
  g.fillStyle = '#16131b'; g.fillRect(0, 300, 256, 60); g.fillStyle = '#c9b98f'; g.font = 'bold 22px Space Mono, monospace'; g.textAlign = 'center'; g.fillText(name, 128, 330); g.font = '12px Space Mono, monospace'; g.fillStyle = '#8f8678'; g.fillText(years, 128, 350);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const MONARCHS = [['VALEN', 'I'], ['VALERIUS', 'II'], ['VALDIS', 'III'], ['VALARIOUS', 'IV'], ['VALCREST', 'V'], ['VALOREN', 'VI'], ['VALIS', 'VII'], ['VALAN', 'VIII'], ['VALEM', 'IX'], ['VAL', 'X']];
function buildInside(K, extra) {
  const P = (x, y, z) => V(PAL0.x + x, PAL0.y + y, PAL0.z + z);
  const bx = (Pf, kind, x0, x1, y0, y1, z0, z1) => { [x0, x1] = [Math.min(x0, x1), Math.max(x0, x1)]; [y0, y1] = [Math.min(y0, y1), Math.max(y0, y1)]; [z0, z1] = [Math.min(z0, z1), Math.max(z0, z1)]; K.add(kind, xf(box(x1 - x0, y1 - y0, z1 - z0), Pf((x0 + x1) / 2, y0, (z0 + z1) / 2))); };
  const B = (...a) => bx(P, ...a);
  // the entrance and the Hall of Monarchs: black stone, ten portraits, the same face in every one
  B('stone', -3.5, 3.5, -0.3, 0, 3, -24); B('black', -3.5, 3.5, 7, 7.3, 3, -24);
  for (const sx of [-1, 1]) { B('stone', sx * 3 - 0.25, sx * 3 + 0.25, 0, 7, 3, -24);
    for (let k = 0; k < 6; k++) B('stone2', sx * 2.82 - 0.14, sx * 2.82 + 0.14, 0, 7, -1 - k * 4 - 0.25, -1 - k * 4 + 0.25); }
  B('stone', -3, 3, 0, 7, 3, 3.3); B('glow', -0.9, 0.9, 0, 4.2, 3.0, 2.96);
  for (let k = 0; k < 11; k++) B('black', -3, 3, 6.5, 7, -k * 2.4 + 0.15, -k * 2.4 - 0.15);
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1, z = -3 - Math.floor(i / 2) * 4, x = side * 2.73;
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.9), new THREE.MeshStandardMaterial({ map: portraitTex(i, 10, MONARCHS[i][0], MONARCHS[i][1]), roughness: 0.8 }));
    pm.position.copy(P(x, 2.55, z)); pm.rotation.y = -side * PI / 2; extra.add.push(pm);
    B('bronze', x + 0.012 * side - 0.01, x + 0.012 * side + 0.01, 1.5, 3.62, z - 0.76, z + 0.76);
    B('glow', x + side * 0.02 - 0.05, x + side * 0.02 + 0.05, 3.85, 4.05, z - 0.25, z + 0.25);
  }
  B('fabric', -1.1, 1.1, 0, 0.02, 2, -23);
  extra.lights.push([P(0, 5.5, -4), '#ffb46a', 9, 18], [P(0, 5.5, -14), '#ffb46a', 9, 18]);
  // the window hall: tall concrete, one great arched window onto the lake and the station; Val stands at it
  B('concrete', -9, 9, -0.3, 0, -24, -40); B('concrete', -9, 9, 15, 15.3, -24, -40);
  for (const sx of [-1, 1]) { B('concrete', sx * 9 - 0.3 * sx, sx * 9, 0, 15, -24, -40); B('concrete', sx > 0 ? 1.6 : -9, sx > 0 ? 9 : -1.6, 0, 15, -23.7, -24); }
  B('concrete', -1.6, 1.6, 4.5, 15, -23.7, -24);
  { const sh = new THREE.Shape(); sh.moveTo(-9, 0); sh.lineTo(9, 0); sh.lineTo(9, 15); sh.lineTo(-9, 15); sh.closePath();
    const hole = new THREE.Path(); hole.moveTo(-7, 0.6); hole.lineTo(7, 0.6); hole.lineTo(7, 7.5); hole.absarc(0, 7.5, 7, 0, PI, false); hole.lineTo(-7, 0.6); sh.holes.push(hole);
    K.add('concrete', new THREE.ShapeGeometry(sh, 32).translate(PAL0.x, PAL0.y, PAL0.z - 40));
    K.add('concrete', new THREE.ShapeGeometry(sh, 32).rotateY(PI).translate(PAL0.x, PAL0.y, PAL0.z - 40.4));
    K.add('black', new THREE.TorusGeometry(7, 0.22, 6, 48, PI).translate(PAL0.x, PAL0.y + 7.5, PAL0.z - 40.1));
    for (const x of [-7, -3.5, 0, 3.5, 7]) { const top = 7.5 + Math.sqrt(Math.max(0, 49 - x * x)); B('black', x - 0.17, x + 0.17, 0.6, top, -39.9, -40.3); }
    for (const y of [3.6, 7.5]) B('black', -7, 7, y - 0.12, y + 0.12, -39.9, -40.3);
    B('black', -7.2, 7.2, 0, 0.6, -39.8, -40.4); }
  // furniture: low sofas round a rug, a slot of fire in the west wall
  B('fabric', -4, 4, 0, 0.02, -29, -36);
  for (const [x0, x1, z0, z1] of [[-4.6, -3.4, -29, -36], [3.4, 4.6, -29, -36], [-3, 3, -28.4, -29.4]]) { B('fabric', x0, x1, 0, 0.45, z0, z1); B('fabric', x0, x1, 0.45, 0.8, z0, z0 + Math.sign(z1 - z0) * 0.3); }
  B('stone2', -1, 1, 0, 0.4, -31.5, -33.5);
  B('glow', -8.68, -8.62, 0.6, 1.0, -28, -34); B('stone2', -8.7, -8.4, 0, 0.6, -27.5, -34.5);
  extra.lights.push([P(-7.5, 1.2, -31), '#ff9a4a', 6, 10], [P(0, 9, -32), '#c8c4ff', 7, 30]);
  // outside the window: the lake, the island, the station, the far wall of the Hollow
  K.add('water', new THREE.PlaneGeometry(160, 120).rotateX(-PI / 2).translate(PAL0.x, -2.2, PAL0.z - 100));
  K.add('concrete', xf(cyl(6, 6.8, 1.2, 40), P(0, -2.6, -110)));
  { const SPb = (x, y, z) => P(x, -1.4 + y, -110 + z); const st = station(K, SPb, 3.2, 10, 7, 0.4); extra.bigTip = { p: SPb(0, st.top + 0.8, 0), r: st.sc * Math.SQRT2, h: 10 - 7 }; }
  K.add('black', inward(new THREE.CylinderGeometry(70, 70, 26, 64, 1, true, PI * 0.55, PI * 0.9)).translate(PAL0.x, 10.8, PAL0.z - 110));
  K.add('sky', new THREE.PlaneGeometry(420, 260).translate(PAL0.x, 120, PAL0.z - 185));
  // Val at the window, his back to you: black patches on his hands and neck, the floor frosting round him
  const vp = P(0.4, 0, -38.3);
  figure(K, 'figure', vp, PI, 1.0, 'val');
  K.add('val', xf(box(0.13, 0.3, 0.13), { x: vp.x - 0.27, y: vp.y + 0.42, z: vp.z })); K.add('val', xf(box(0.12, 0.25, 0.12), { x: vp.x + 0.27, y: vp.y + 0.5, z: vp.z }));
  K.add('frost', new THREE.CircleGeometry(1.3, 32).rotateX(-PI / 2).translate(vp.x, vp.y + 0.01, vp.z));
  extra.valIn = vp;

  // ---- below: the ribbed tunnel, the gifting chamber, the gate hall
  const Q = (x, y, z) => V(BEL0.x + x, BEL0.y + y, BEL0.z + z);
  const Bq = (...a) => bx(Q, ...a);
  Bq('concrete', -2, 2, -0.3, 0, 2.5, -18.6); Bq('metal', -1.3, 1.3, 0, 0.05, 2.4, 0.2); Bq('vglow', -1.3, 1.3, 0.05, 0.07, 0.25, 0.2);
  for (let i = 0; i < 30; i++) { const z = 1.5 - i * 0.6; K.add('ribs', new THREE.TorusGeometry(1.75, 0.2, 8, 20, PI).translate(BEL0.x, BEL0.y, BEL0.z + z)); K.add('vglow', new THREE.TorusGeometry(1.52, 0.015, 4, 20, PI).translate(BEL0.x, BEL0.y, BEL0.z + z - 0.3)); }
  Bq('ribs', -2, 2, 0, 3.4, 2.6, 2.3);
  // the round door, rolled aside
  K.add('black', new THREE.TorusGeometry(1.7, 0.3, 10, 40).translate(BEL0.x, BEL0.y + 1.5, BEL0.z - 17.3));
  K.add('black', xf(cyl(1.5, 1.5, 0.3, 32), { ...Q(-2.4, 1.5, -17.6), rz: PI / 2, ry: PI / 2 }));
  // the chamber: radius 8, banded walls with light between the bands, a dome, the hanging eye, the dais
  const CC = Q(0, 0, -26), RC = 8;
  K.add('concrete', new THREE.CircleGeometry(RC, 64).rotateX(-PI / 2).translate(CC.x, 0, CC.z));
  const GAP = 0.24, arcs = [[GAP, PI - 2 * GAP], [PI + GAP, PI - 2 * GAP]];
  for (const [t0, tl] of arcs) {
    for (let b = 0; b < 9; b++) { const y = 0.3 + b * 0.75; K.add('ribs', inward(new THREE.CylinderGeometry(RC, RC, 0.58, 32, 1, true, t0, tl)).translate(CC.x, y + 0.29, CC.z)); K.add('vglow', inward(new THREE.CylinderGeometry(RC + 0.08, RC + 0.08, 0.17, 32, 1, true, t0, tl)).translate(CC.x, y + 0.665, CC.z)); }
    K.add('ribs', inward(new THREE.CylinderGeometry(RC, RC, 0.3, 32, 1, true, t0, tl)).translate(CC.x, 0.15, CC.z)); }
  for (const zz of [RC, -RC]) for (const sx of [-1, 1]) Bq('concreteD', sx * 0.95, sx * 1.35, 0, 7.0, -26 + zz * 0.99 - 0.2, -26 + zz * 0.99 + 0.2);
  K.add('ribs', inward(new THREE.SphereGeometry(RC, 48, 16, 0, 2 * PI, 0, PI / 2)).scale(1, 0.55, 1).translate(CC.x, 7.05, CC.z));
  K.add('black', new THREE.SphereGeometry(2.0, 32, 16, 0, 2 * PI, PI / 2, PI / 2).translate(CC.x, 10.0, CC.z)); K.add('vglow', new THREE.TorusGeometry(2.02, 0.05, 4, 48).rotateX(PI / 2).translate(CC.x, 10.0, CC.z));
  K.add('concreteD', xf(cyl(2.3, 2.5, 0.35, 48), CC)); K.add('vglow', new THREE.TorusGeometry(2.4, 0.04, 4, 64).rotateX(PI / 2).translate(CC.x, 0.36, CC.z));
  figure(K, 'figure', V(CC.x, 0.0, CC.z), PI, 0.85);
  for (const sx of [-1, 1]) K.add('val', xf(box(0.1, 0.08, 0.32), { x: CC.x + sx * 0.18, y: 0.5, z: CC.z - 0.2 }));
  for (const th of [-0.5, PI / 2, PI + 0.5, 3 * PI / 2 + 0.3]) figure(K, 'robe', V(CC.x + Math.cos(th) * 3.6, 0, CC.z + Math.sin(th) * 3.6), Math.atan2(-Math.cos(th), -Math.sin(th)), 1.05);
  extra.lights.push([Q(0, 3, -6), '#a8b8ff', 6, 14], [Q(0, 5, -26), '#b9a8ff', 7, 22]);
  // out the far side into the gate hall
  Bq('concrete', -4, 4, -0.3, 0, -33.6, -52); Bq('concrete', -4, 4, 6, 6.3, -33.6, -52);
  for (const sx of [-1, 1]) Bq('concrete', sx * 4 - 0.3 * sx, sx * 4, 0, 6, -33.6, -52);
  Bq('concrete', -4, 4, 0, 6, -52, -52.3); Bq('ribs', -4, -1.6, 0, 6, -33.4, -33.7); Bq('ribs', 1.6, 4, 0, 6, -33.4, -33.7); Bq('ribs', -1.6, 1.6, 3.2, 6, -33.4, -33.7);
  const gateAt = (x, z, ry, w, h) => {
    const fr = new THREE.Group(); const g = makeGate(w, h, x * 1.7 + z * 0.3); g.position.set(0, h / 2 + 0.25, 0); fr.add(g);
    fr.position.copy(Q(x, 0, z)); fr.rotation.y = ry; extra.add.push(fr);
    const T = new THREE.Matrix4().compose(Q(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V(1, 1, 1));
    for (const [gx, gy, gz, gw, gh_, gd] of [[-w / 2 - 0.2, 0, 0, 0.35, h + 0.6, 0.6], [w / 2 + 0.2, 0, 0, 0.35, h + 0.6, 0.6], [0, h + 0.35, 0, w + 0.75, 0.3, 0.6]]) K.add('concrete', box(gw, gh_, gd).translate(gx, gy, gz - 0.25).applyMatrix4(T));
  };
  gateAt(-3.6, -39, PI / 2, 1.8, 3.0); gateAt(-3.6, -46, PI / 2, 1.8, 3.0); gateAt(3.6, -42.5, -PI / 2, 1.8, 3.0); gateAt(0, -51.6, 0, 2.4, 4.0);
  for (let i = 0; i < 6; i++) Bq('vglow', -0.05, 0.05, 0.0, 0.015, -35 - i * 2.6, -36.6 - i * 2.6);
  extra.lights.push([Q(0, 4, -42), '#9b8cff', 6, 16]);
}

// ------------------------------------------------------------------ materials, outlines
const drawRes = new THREE.Vector2(1, 1);
function outlineMaterial(color, px) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPx: { value: px }, uRes: { value: drawRes } },
    vertexShader: `uniform float uPx; uniform vec2 uRes;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vec3 wn = normalize(mat3(modelMatrix)*normal);
        vec4 c0 = projectionMatrix*viewMatrix*wp; vec4 c1 = projectionMatrix*viewMatrix*vec4(wp.xyz+wn*0.05,1.0);
        vec2 d = c1.xy/c1.w - c0.xy/c0.w; float l = length(d); if(l>1e-6) c0.xy += (d/l)*uPx*2.0/uRes*c0.w; c0.z += 0.0004*c0.w; gl_Position = c0; }`,
    fragmentShader: 'uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor,1.0); }',
    side: THREE.BackSide
  });
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
key.position.set(36, 48, 14);
const rimL = new THREE.DirectionalLight('#fff', 1); rimL.position.set(30, 20, -40);
scene.add(hemi, key, rimL);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.4, 0.9); composer.addPass(bloom);
composer.addPass(new OutputPass());

const q = new URLSearchParams(location.search);
const state = { theme: q.get('theme') === 'paper' ? 'paper' : 'crt', style: q.get('style') === 'blocks' ? 'blocks' : 'model', showTags: true };
let root = null, modelRoot = null, blockRoot = null, fpGroup = null, roomLights = [], heightCache = null;
const KIND_IDS = {};

function build() {
  if (root) { scene.remove(root); root.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => { m.map?.dispose(); m.dispose(); }); }); }
  root = new THREE.Group(); scene.add(root);
  modelRoot = new THREE.Group(); root.add(modelRoot);
  fpGroup = new THREE.Group(); root.add(fpGroup);
  labels.length = 0; gates.length = 0; mastLamps.length = 0; pulses = []; roomLights = [];
  const th = THEMES[state.theme], crt = state.theme === 'crt';
  scene.background = new THREE.Color(th.bg);
  hemi.color.set(th.hemiSky); hemi.groundColor.set(th.hemiGround); hemi.intensity = th.hemi;
  key.color.set(th.key); key.intensity = th.keyI; rimL.color.set(th.rim); rimL.intensity = th.rimI;
  scene.environmentIntensity = th.env; bloom.strength = th.bloom;

  const std = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.05, flatShading: true, envMapIntensity: th.env, ...extra });
  const basic = (c, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
  const mats = {
    moss: std(th.moss, { roughness: 1 }), soil: std(th.soil, { roughness: 1 }), soil2: std(th.soil2, { roughness: 1 }), rock: std(th.rock, { roughness: 1 }),
    concrete: std(th.concrete, { roughness: 0.95 }), concreteD: std(th.concreteD, { roughness: 0.95 }), paving: std(th.paving, { roughness: 0.9 }),
    black: std(th.black, { roughness: 0.22, metalness: 0.35 }), stone: std(th.stone, { roughness: 0.5, metalness: 0.15 }), stone2: std(th.stone2, { roughness: 0.55 }),
    leaf: std(th.leaf, { roughness: 1 }), leaf2: std(th.leaf2, { roughness: 1 }), trunk: std(th.trunk), water: std(th.water, { roughness: 0.08, metalness: 0.6 }),
    sand: std(th.sand, { roughness: 1 }), frost: basic(th.frost, crt ? 1.2 : 1), glow: basic(th.glow, crt ? 1.45 : 1), vglow: basic(th.vglow, crt ? 1.4 : 0.9),
    metal: std(th.metal, { roughness: 0.4, metalness: 0.75, flatShading: false }), figure: std(th.figure, { roughness: 0.7 }), robe: std(th.robe, { roughness: 0.9 }),
    val: basic('#000000'), sky: Object.assign(basic(crt ? '#c9c4e0' : '#e9e6f2', crt ? 1.1 : 1), { fog: false }), fabric: std(th.fabric, { roughness: 1 }), ribs: std(th.ribs, { roughness: 0.45, metalness: 0.3 }), bronze: std(th.bronze, { roughness: 0.4, metalness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({ color: crt ? '#b9a8ff' : '#7a6ad8', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false })
  };
  const noOutline = new Set(['glow', 'vglow', 'frost', 'glass', 'val', 'sky']);
  const extra = { add: [], lights: [] };
  const K = new Kit(); buildReach(K, extra);
  Object.keys(mats).forEach((k, i) => { KIND_IDS[k] = i + 1; });
  for (const [k, g] of Object.entries(K.merge())) {
    const m = new THREE.Mesh(g, mats[k]); m.userData.kind = k;
    if (!noOutline.has(k)) { m.castShadow = m.receiveShadow = true; const o = new THREE.Mesh(hullOf(g), outlineMaterial(th.ink, th.outlinePx)); o.raycast = () => {}; m.add(o); }
    modelRoot.add(m);
  }
  extra.add.forEach(o => modelRoot.add(o));
  // the station's floating tip and its beam into the sky
  const tip = (t) => { const m = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 4).rotateY(PI / 4), mats.black); m.position.copy(t.p).add(V(0, t.h / 2, 0)); m.userData.y0 = m.position.y; m.castShadow = true; m.add(new THREE.Mesh(hullOf(m.geometry), outlineMaterial(th.ink, th.outlinePx))); return m; };
  capstone = tip(extra.capTip); modelRoot.add(capstone);
  const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color(th.vglow).multiplyScalar(crt ? 1.3 : 0.9), transparent: true, opacity: 0.35, depthWrite: false, blending: crt ? THREE.AdditiveBlending : THREE.NormalBlending });
  beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, 16, 12, 1, true).translate(0, 8, 0), bm); beam.position.copy(extra.capTip.p).add(V(0, extra.capTip.h, 0)); modelRoot.add(beam);
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mats.vglow); modelRoot.add(p); pulses.push({ m: p, from: beam.position.clone().add(V(0, 12, 0)), to: beam.position.clone(), ph: i / 4, k: 0.25 }); }
  extra.relays.forEach((r, i) => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mats.vglow); modelRoot.add(p); pulses.push({ m: p, from: V(LAKE.x, PF + 0.6, LAKE.z), to: V(r.x, PF + 0.6, r.z), ph: i / 6, k: 0.4 }); });
  // the masts' lamps blink
  extra.masts.forEach(p => modelRoot.add(mast(new Kit(), p)));
  // Val: black dust lifting off him, then gone
  valDust = makeDust(extra.valP, 70, 0.9); modelRoot.add(valDust);

  // inside (full size): only shown while you walk
  const KI = new Kit(), ex2 = { add: [], lights: [] }; buildInside(KI, ex2);
  for (const [k, g] of Object.entries(KI.merge())) {
    const m = new THREE.Mesh(g, mats[k]);
    if (!noOutline.has(k)) { m.receiveShadow = true; const o = new THREE.Mesh(hullOf(g), outlineMaterial(th.ink, th.outlinePx)); o.raycast = () => {}; m.add(o); }
    fpGroup.add(m);
  }
  ex2.add.forEach(o => fpGroup.add(o));
  fpGroup.add(tip(ex2.bigTip));
  for (const [p, c, i, d] of ex2.lights) { const l = new THREE.PointLight(c, i, d, 1.2); l.position.copy(p); l.visible = fp.on; fpGroup.add(l); roomLights.push(l); }
  fpGroup.add(makeDust(ex2.valIn, 60, 1.2));
  // the stand
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.7, R + 1.1, 0.8, 120), std(th.plinth));
  stand.position.y = BASE - 0.4; stand.receiveShadow = true; stand.add(new THREE.Mesh(hullOf(stand.geometry), outlineMaterial(th.ink, th.outlinePx))); root.add(stand);

  if (!heightCache) heightCache = heightPass();
  blockRoot = buildBlocks(heightCache, th);
  root.add(blockRoot);
  applyStyle();
  syncLabels();
}
function makeDust(c, n, spread) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), ph = [], r = rng(9);
  for (let i = 0; i < n; i++) { ph.push([r() * 2 * PI, r() * spread * 0.5, r()]); pos[i * 3] = c.x; pos[i * 3 + 1] = c.y; pos[i * 3 + 2] = c.z; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color: state.theme === 'crt' ? '#000000' : '#111111', size: 0.035, sizeAttenuation: true }));
  m.userData = { c: c.clone(), ph, spread }; m.frustumCulled = false; return m;
}

// ------------------------------------------------------------------ blocks: the model, seen from above, rebuilt as bevelled columns
const CELLS = 96, CELL = 2 * R / CELLS;
function heightPass() {
  const N = CELLS, rt = new THREE.WebGLRenderTarget(N, N, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const hs = new THREE.Scene(), cam = new THREE.OrthographicCamera(-R, R, R, -R, 1, 200);
  cam.position.set(0, 80, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  const mat = id => new THREE.ShaderMaterial({ uniforms: { uK: { value: id } }, side: THREE.DoubleSide,
    vertexShader: 'varying float vY; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vY = wp.y; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: 'uniform float uK; varying float vY; void main(){ gl_FragColor = vec4(vY + 100.0, uK, 0.0, 1.0); }' });
  modelRoot.updateMatrixWorld(true);
  modelRoot.traverse(o => { if (!o.isMesh || !o.userData.kind || o.userData.kind === 'glass') return; const m = new THREE.Mesh(o.geometry, mat(KIND_IDS[o.userData.kind])); m.matrixAutoUpdate = false; m.matrix.copy(o.matrixWorld); hs.add(m); });
  if (capstone) { const m = new THREE.Mesh(capstone.geometry, mat(KIND_IDS.black)); m.matrixAutoUpdate = false; m.matrix.copy(capstone.matrixWorld); hs.add(m); }
  const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(hs, cam);
  const buf = new Float32Array(N * N * 4); renderer.readRenderTargetPixels(rt, 0, 0, N, N, buf);
  renderer.setRenderTarget(null); renderer.setClearColor(cc, ca); rt.dispose(); hs.traverse(o => o.material?.dispose());
  const kinds = Object.fromEntries(Object.entries(KIND_IDS).map(([k, v]) => [v, k]));
  const cells = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const o = (j * N + i) * 4, x = -R + (i + 0.5) * CELL, z = R - (j + 0.5) * CELL;
    if (Math.hypot(x, z) > R - CELL * 0.35) continue;
    const y = buf[o] > 1 ? buf[o] - 100 : BASE; cells.push({ i, j, x, z, y, kind: kinds[Math.round(buf[o + 1])] || 'rock' });
  }
  return cells;
}
const BLOCK_COL = {
  crt: { moss: '#3e6b4f', leaf: '#2e8a5e', leaf2: '#45a06b', trunk: '#5a3f2a', soil: '#7a5a48', soil2: '#5e4638', rock: '#6b5f78', concrete: '#a39fb4', concreteD: '#857f99', paving: '#6f6a85',
    black: '#2a2340', stone: '#3c3156', stone2: '#4b3f66', water: '#3d3ab0', sand: '#efdcb4', frost: '#dfeaff', glow: '#ffcf7a', vglow: '#b9a2ff', metal: '#8d8aa8', figure: '#4a4064', robe: '#5a4f75',
    val: '#120e1c', fabric: '#6a6280', ribs: '#4a4366', bronze: '#c9a25a' },
  paper: { moss: '#8fbf7a', leaf: '#5fae7c', leaf2: '#7cc48a', trunk: '#9a6a44', soil: '#c9a27a', soil2: '#b08a66', rock: '#b1a7bf', concrete: '#e2dfe9', concreteD: '#c9c4d6', paving: '#b7b2c6',
    black: '#4b4270', stone: '#5c5088', stone2: '#6d6196', water: '#6f74d8', sand: '#f6e6c4', frost: '#ffffff', glow: '#ffb45a', vglow: '#8f7cf0', metal: '#a9a6bd', figure: '#5a5078', robe: '#7a6e9a',
    val: '#1c1830', fabric: '#9a93ae', ribs: '#6e6690', bronze: '#d8b066' }
};
const GLOWY = new Set(['glow', 'vglow', 'frost']);
function buildBlocks(cells, th) {
  const crt = state.theme === 'crt', pal = BLOCK_COL[state.theme], N = CELLS, grid = new Array(N * N).fill(null);
  // a soft, strange gradient over the whole city: four big blurred washes of colour
  const blobs = crt ? [[-20, -16, '#8a5cff'], [22, 10, '#28d0c4'], [8, -26, '#ff6fb5'], [-16, 22, '#ffb15c']] : [[-20, -16, '#a98bff'], [22, 10, '#5fe0d2'], [8, -26, '#ff9ccb'], [-16, 22, '#ffc98a']];
  const wash = (x, z) => { const c = new THREE.Color(0, 0, 0); let ws = 0; for (const [bx, bz, col] of blobs) { const w = Math.exp(-((x - bx) ** 2 + (z - bz) ** 2) / (2 * 15 * 15)); c.add(new THREE.Color(col).multiplyScalar(w)); ws += w; } return c.multiplyScalar(1 / Math.max(ws, 1e-3)); };
  for (const c of cells) {
    const base = new THREE.Color(pal[c.kind] || pal.rock), glowy = GLOWY.has(c.kind);
    const col = glowy ? base.clone() : base.clone().lerp(wash(c.x, c.z), ['moss', 'leaf', 'leaf2', 'soil', 'paving', 'concrete', 'concreteD'].includes(c.kind) ? 0.42 : 0.26);
    grid[c.j * N + c.i] = { ...c, col, glowy, h: Math.round((c.y - BASE) / 0.2) * 0.2 };
  }
  // blur the colours across neighbours (glowing cells keep theirs), so the blocks melt into each other
  for (let pass = 0; pass < 2; pass++) { const next = grid.map(g => g && g.col.clone());
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const g = grid[j * N + i]; if (!g || g.glowy) continue; const acc = new THREE.Color(0, 0, 0); let n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const h = grid[(j + dj) * N + (i + di)]; if (!h || h.glowy || i + di < 0 || i + di >= N) continue; acc.add(h.col); n++; }
      next[j * N + i] = acc.multiplyScalar(1 / n).lerp(g.col, 0.35); }
    grid.forEach((g, k) => { if (g) g.col = next[k]; }); }
  const list = grid.filter(Boolean), H0 = CELL * 0.34;
  const geo = new RoundedBoxGeometry(CELL * 0.93, H0, CELL * 0.93, 2, CELL * 0.15);
  const aH = new Float32Array(list.length), colors = new Float32Array(list.length * 3);
  const stretch = `float hh = max(aH, ${H0.toFixed(4)}); vec3 sp = position; if (sp.y > 0.0) sp.y += hh - ${H0.toFixed(4)}; sp.y += ${(H0 / 2).toFixed(4)};`;
  const ramp = new Uint8Array([90, 175, 255]); const gm = new THREE.DataTexture(ramp, 3, 1, THREE.RedFormat); gm.minFilter = gm.magFilter = THREE.NearestFilter; gm.needsUpdate = true;
  const mat = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gm });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aH; varying float vF; varying vec3 vWP;')
      .replace('#include <begin_vertex>', `${stretch}\nvec3 transformed = sp; vF = sp.y / max(hh, 0.001);`)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vF; varying vec3 vWP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float up = smoothstep(0.0, 1.0, vF);
        vec3 deep = ${crt ? 'vec3(0.10, 0.05, 0.22)' : 'vec3(0.42, 0.36, 0.62)'};
        diffuseColor.rgb = mix(deep, diffuseColor.rgb, 0.45 + 0.55 * up);
        diffuseColor.rgb += ${crt ? '0.10' : '0.06'} * smoothstep(0.92, 1.0, vF) * vec3(1.0, 0.95, 1.1);`);
  };
  mat.customProgramCacheKey = () => 'cols' + state.theme;
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const m4 = new THREE.Matrix4();
  list.forEach((g, k) => { m4.makeTranslation(g.x, BASE, g.z); mesh.setMatrixAt(k, m4); aH[k] = Math.max(g.h, 0.05); const c = g.glowy ? g.col.clone().multiplyScalar(crt ? 1.7 : 1.1) : g.col; colors.set([c.r, c.g, c.b], k * 3); });
  geo.setAttribute('aH', new THREE.InstancedBufferAttribute(aH, 1));
  mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  mesh.receiveShadow = true;
  // the white outline: the same columns, pushed out in screen space, back faces only
  const line = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { uColor: { value: new THREE.Color(th.blockLine) }, uPx: { value: crt ? 1.5 : 1.3 }, uRes: { value: drawRes } },
    vertexShader: `attribute float aH; uniform float uPx; uniform vec2 uRes;
      void main(){ ${stretch} vec4 wp = modelMatrix * instanceMatrix * vec4(sp, 1.0); vec3 wn = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vec4 c0 = projectionMatrix * viewMatrix * wp; vec4 c1 = projectionMatrix * viewMatrix * vec4(wp.xyz + wn * 0.05, 1.0);
        vec2 d = c1.xy / c1.w - c0.xy / c0.w; float l = length(d); if (l > 1e-6) c0.xy += (d / l) * uPx * 2.0 / uRes * c0.w; c0.z += 0.0004 * c0.w; gl_Position = c0; }`,
    fragmentShader: 'uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }' });
  const outl = new THREE.InstancedMesh(geo, line, list.length); outl.instanceMatrix = mesh.instanceMatrix; outl.frustumCulled = mesh.frustumCulled = false;
  const g = new THREE.Group(); g.add(mesh, outl);
  // the gates and the station's beam still shimmer over the blocks
  return g;
}
function applyStyle() {
  const blocks = state.style === 'blocks' && !fp.on;
  if (modelRoot) modelRoot.visible = !blocks;
  if (blockRoot) blockRoot.visible = blocks;
  if (beam) beam.visible = true;
}

// ------------------------------------------------------------------ labels, view, panel
const layer = $('labels');
function syncLabels() { layer.innerHTML = ''; for (const l of labels) { const el = document.createElement('div'); el.className = 'lbl'; el.textContent = l.text; if (l.small) el.style.fontSize = '11px'; layer.appendChild(el); l.el = el; } }
const tv = new THREE.Vector3();
function updateLabels() {
  const w = innerWidth, h = innerHeight;
  for (const l of labels) { tv.copy(l.pos).project(camera); const vis = state.showTags && tv.z < 1 && Math.abs(tv.x) < 1.05 && Math.abs(tv.y) < 1.05;
    l.el.style.opacity = vis ? 1 : 0; l.el.style.transform = `translate(${(tv.x * 0.5 + 0.5) * w}px, ${(-tv.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`; }
}
const EYE = 1.1;
const fpCam = new THREE.PerspectiveCamera(70, 1, 0.03, 600); fpCam.rotation.order = 'YXZ';
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h, half = (a < 1 ? 38 / a : 34);
  camera.left = -half * a; camera.right = half * a; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
  fpCam.aspect = a; fpCam.updateProjectionMatrix();
  renderer.setSize(w, h, false); composer.setSize(w, h); drawRes.set(w, h);
}
camera.position.set(62, 50, 68); controls.target.set(2, -4, 2); camera.zoom = 1.05; camera.updateProjectionMatrix();
if (q.get('view') === 'below') { camera.position.set(70, 22, 70); controls.target.set(18, -5, 18); camera.zoom = 2.6; camera.updateProjectionMatrix(); controls.autoRotate = false; }
if (q.get('view') === 'palace') { camera.position.set(10, 14, 40); controls.target.set(0, -5, -8); camera.zoom = 2.4; camera.updateProjectionMatrix(); controls.autoRotate = false; }
addEventListener('resize', resize);
function note() {
  $('note').innerHTML = '<h2>The Hollow Reach · capital of the Voided</h2>Central Germany, deep in the forested uplands. A round pit with <b>smooth black walls</b>, open to the sky: the city is built down into it and dug in behind it. On its floor, beside a still lake, the black palace of <b>Val</b>, the Monarch, the first Voided. The capital\'s <b>station</b> stands on an island in the lake. Under the forest: the <b>gate hall</b> and the <b>gifting chamber</b>, where Val seals erasure into the people who will serve him.';
}
function seg(id, fn) { $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; [...$(id).children].forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset.v); }); }
seg('styleSeg', v => { state.style = v; applyStyle(); });
seg('themeSeg', v => { state.theme = v; document.body.classList.toggle('paper', v === 'paper'); build(); });
seg('tagSeg', v => { state.showTags = v === 'on'; });

// ------------------------------------------------------------------ the walk (on rails, as in Aurelia)
const lantern = new THREE.PointLight('#c9b8ff', 0, 9, 1.3); scene.add(lantern);
scene.fog = new THREE.FogExp2('#06040b', 0);
const fp = { on: false, scenes: null, sc: null, s: 0, sT: 0, yawOff: 0, pitchOff: 0, dist: 0, busy: false, si: 0 };
const held = {};
const STOPS = {
  hollow: { t: 'The Hollow', d: 'From the forest you\'d never know. Then the trees stop at a round hole with smooth black walls, and the whole capital of the Voided is down there.' },
  arcade: { t: 'The arcade', d: 'The way down is a ramp cut along the wall, under tall concrete fins that lean in toward the stone. The light comes in between them in slices.' },
  yard: { t: 'The yard', d: 'Below, Voided drill in ranks on the floor of the Hollow. The ones with blackened hands have been given erasure. It doesn\'t hurt them; it doesn\'t feel at all.' },
  station: { t: 'The station', d: 'The capital\'s station, on an island in the lake: a split black pyramid that draws power out of the air. Six relays round the shore store it. The stations answer only to the thread of Val\'s curse that every Voided carries.' },
  palace: { t: 'Val\'s palace', d: 'Black stone beside the water. On the balcony, a man stands looking out over the lake. Where he stands, the stone is frosted white.' },
  hall: { t: 'The Hall of Monarchs', d: 'The Monarchs of the Hollow Reach, generation after generation, father to son. Valen, Valerius, Valdis, Valarious…' },
  faces: { t: 'The same face', d: 'Look closer. It\'s the same face in every frame. And the newer the portrait, the more of it is painted black.' },
  last: { t: 'Val', d: 'The last frame, the current Monarch: the most black of all. Val, who was once called Interval.' },
  window: { t: 'The window', d: 'A great arched window onto the lake and the station. The room is cold, much colder than it should be.' },
  val: { t: 'The Monarch', d: 'He doesn\'t turn round. Black spreads over his hands and the back of his neck, and it\'s cold to the touch. To keep it from spreading he pushes it back into who he was, so he is always becoming younger. Black dust lifts off him and disappears.' },
  tunnel: { t: 'Below', d: 'A lift down out of the palace, then a tunnel ribbed like the inside of something alive. Thin violet light between the ribs.' },
  chamber: { t: 'The gifting chamber', d: 'A round room banded with light, a black eye hanging from the dome. Here Val seals erasure into the people who will serve him.' },
  gifted: { t: 'Gifted', d: 'Their hands go black and stop feeling pain. They can\'t wield erasure: to destroy something they have to touch it and move their hands across it. But now the stations answer them.' },
  gates: { t: 'The gate hall', d: 'Void gates: cracks touched by nothing, held open in concrete frames. Through them, somewhere very far away. The Voided cross them without harm.' }
};
function makeScene(id, keys) {
  const curve = new THREE.CatmullRomCurve3(keys.map(k => k.p), false, 'centripetal');
  const n = keys.length - 1, SUB = 40, N = n * SUB, lens = [0];
  let prev = curve.getPoint(0);
  for (let j = 1; j <= N; j++) { const p = curve.getPoint(j / N); lens.push(lens[j - 1] + p.distanceTo(prev)); prev = p; }
  const ks = keys.map((k, i) => { let d; if (k.look) d = k.look.clone().sub(k.p).normalize(); else { d = curve.getTangent(i / n).clone(); d.y *= 0.3; d.normalize(); }
    return { ug: 0, ...k, s: lens[i * SUB], yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) }; });
  for (let i = 1; i < ks.length; i++) { while (ks[i].yaw - ks[i - 1].yaw > PI) ks[i].yaw -= 2 * PI; while (ks[i].yaw - ks[i - 1].yaw < -PI) ks[i].yaw += 2 * PI; }
  return { id, curve, keys: ks, lens, N, n, len: lens[N] };
}
function tOfS(sc, s) { let lo = 0, hi = sc.N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (sc.lens[m] <= s) lo = m; else hi = m; } const sg = sc.lens[hi] - sc.lens[lo]; return (lo + (sg > 0 ? (s - sc.lens[lo]) / sg : 0)) / sc.N; }
function poseAt(sc, s) { const t = tOfS(sc, s), pos = sc.curve.getPoint(t); const i = Math.min(sc.n - 1, Math.floor(t * sc.n)), f = t * sc.n - i, e = f * f * (3 - 2 * f); const a = sc.keys[i], b = sc.keys[i + 1]; return { pos, yaw: a.yaw + (b.yaw - a.yaw) * e, pitch: a.pitch + (b.pitch - a.pitch) * e, ug: a.ug + (b.ug - a.ug) * f }; }
function makeScenes() {
  const E = EYE, Ra = (deg, r, y) => atA(D(deg), r, y), RY = deg => rampY(D(deg)) + E;
  const g0 = (deg, r) => { const p = atA(D(deg), r); return gh(p.x, p.z) + E; };
  const descent = makeScene('descent', [
    { p: Ra(128, 21, g0(128, 21)), look: Ra(150, 4, -3), stop: STOPS.hollow, chap: 'Descent' },
    { p: Ra(134, 17.6, g0(134, 17.6)) },
    { p: Ra(142, RAMP.r, RY(142)) },
    { p: Ra(152, RAMP.r, RY(152)) },
    { p: Ra(162, RAMP.r, RY(162)), look: Ra(178, RAMP.r - 0.3, RY(178) - 0.6), stop: STOPS.arcade },
    { p: Ra(172, RAMP.r, RY(172)) },
    { p: Ra(184, RAMP.r, RY(184)), look: V(-10.4, PF + 0.4, 6.8), stop: STOPS.yard },
    { p: Ra(196, RAMP.r, RY(196)) },
    { p: Ra(210, RAMP.r, RY(210)), look: V(LAKE.x, PF + 2.8, LAKE.z), stop: STOPS.station },
    { p: Ra(222, RAMP.r, RY(222)) },
    { p: V(-8.2, PF + E, -6.6) },
    { p: V(-6.2, PF + E, -6.2), look: V(0, PF + 2.6, -10.5), stop: STOPS.palace },
    { p: V(0, PF + 0.6 + E, -9.4), look: V(0, PF + 2.2, -11) }
  ]);
  const P = (x, y, z) => V(PAL0.x + x, PAL0.y + y + E, PAL0.z + z);
  const palace = makeScene('palace', [
    { p: P(0, 0, 2.2), ug: 0.45, chap: 'Palace' },
    { p: P(0, 0, -1.5), ug: 0.45, stop: STOPS.hall },
    { p: P(0, 0, -6.5), ug: 0.45 },
    { p: P(0.6, 0, -10.6), look: P(-2.7, 0.9, -11), ug: 0.45, stop: STOPS.faces },
    { p: P(0, 0, -15), ug: 0.45 },
    { p: P(-0.4, 0, -19.6), look: P(2.7, 0.9, -19), ug: 0.45, stop: STOPS.last },
    { p: P(0, 0, -23.5), ug: 0.4 },
    { p: P(-2.5, 0, -27.5), look: P(0, 4.5, -40), ug: 0.35, stop: STOPS.window },
    { p: P(-1.6, 0, -33.5), ug: 0.35 },
    { p: P(-1.3, 0, -35.6), look: P(0.4, -0.3, -38.3), ug: 0.35, stop: STOPS.val },
    { p: P(-1.4, 0, -37.2), look: P(-1, 1.2, -60), ug: 0.35 }
  ]);
  const Qp = (x, y, z) => V(BEL0.x + x, BEL0.y + y + E, BEL0.z + z);
  const below = makeScene('below', [
    { p: Qp(0, 0, 1.6), ug: 0.85, chap: 'Below' },
    { p: Qp(0, 0, -2.5), ug: 0.85, stop: STOPS.tunnel },
    { p: Qp(0, 0, -10), ug: 0.85 },
    { p: Qp(0, 0, -16), ug: 0.8 },
    { p: Qp(-1.8, 0, -20.5), look: Qp(0, 1.5, -26), ug: 0.7, stop: STOPS.chamber },
    { p: Qp(-4.6, 0, -25.4), look: Qp(0, 0.2, -26), ug: 0.7, stop: STOPS.gifted },
    { p: Qp(-1.6, 0, -31.5), ug: 0.7 },
    { p: Qp(0, 0, -35), ug: 0.75 },
    { p: Qp(0.8, 0, -41.5), look: Qp(-3.6, 1.3, -42), ug: 0.75, stop: STOPS.gates },
    { p: Qp(0, 0, -47.5), look: Qp(0, 1.8, -51.6), ug: 0.75 }
  ]);
  fp.scenes = [descent, palace, below];
  fp.chapters = [];
  fp.scenes.forEach((sc, si) => sc.keys.forEach((k, ki) => { if (k.chap) fp.chapters.push({ name: k.chap, si, ki }); }));
  const nav = $('fpChap'); nav.innerHTML = '';
  fp.chapters.forEach(c => { const b = document.createElement('button'); b.textContent = c.name; b.onclick = () => jumpTo(c.si, c.ki); nav.appendChild(b); c.el = b; });
}
function fade(cb, title = '') { fp.busy = true; const el = $('fade'); el.querySelector('b').textContent = title; el.style.opacity = 1; setTimeout(() => { cb(); setTimeout(() => { el.style.opacity = 0; fp.busy = false; }, title ? 650 : 120); }, 380); }
function goTo(si, ki = 0, atEnd = false) {
  const sc = fp.scenes[si]; fp.si = si; fp.sc = sc; fp.s = fp.sT = atEnd ? sc.len : sc.keys[ki].s; fp.yawOff = fp.pitchOff = 0;
  const tr = $('fpTrack'); tr.querySelectorAll('.tick').forEach(x => x.remove());
  sc.keys.forEach(k => { if (!k.stop) return; const i = document.createElement('i'); i.className = 'tick'; i.style.left = (k.s / sc.len * 100) + '%'; tr.appendChild(i); });
}
function titleFor(si, ki) { const k = fp.scenes[si].keys[ki]; return (k.stop && k.stop.t) || (k.chap || ''); }
function jumpTo(si, ki) { if (fp.busy) return; fade(() => goTo(si, ki), titleFor(si, ki)); }
function enterWalk(si = 0, ki = 0, instant = false) {
  if (fp.busy || fp.on) return; if (!fp.scenes) makeScenes();
  const go = () => { fp.on = true; document.body.classList.add('walking'); controls.enabled = false; controls.autoRotate = false; applyStyle(); goTo(si, ki); $('walkBtn').textContent = 'Leave'; };
  if (instant) return go(); fade(go, titleFor(si, ki));
}
function exitWalk() { if (!fp.on || fp.busy) return; fade(() => { fp.on = false; document.body.classList.remove('walking'); controls.enabled = true; applyStyle(); applyEnv(0); for (const k in held) held[k] = false; $('walkBtn').textContent = 'Walk inside'; }); }
function nextStop() { if (!fp.on || fp.busy) return; const sc = fp.sc, k = sc.keys.find(k => k.stop && k.s > fp.s + 0.05); if (k) fp.sT = k.s; else if (fp.s < sc.len - 0.05) fp.sT = sc.len; else if (fp.si < fp.scenes.length - 1) fade(() => goTo(fp.si + 1, 0), titleFor(fp.si + 1, 0)); }
function prevStop() { if (!fp.on || fp.busy) return; const sc = fp.sc, k = [...sc.keys].reverse().find(k => k.stop && k.s < fp.s - 0.05); if (k) fp.sT = k.s; else if (fp.s > 0.05) fp.sT = 0; else if (fp.si > 0) { const p = fp.scenes[fp.si - 1], last = [...p.keys].reverse().find(k => k.stop); fade(() => goTo(fp.si - 1, p.keys.indexOf(last)), last.stop.t); } }
function applyEnv(ug) {
  const th = THEMES[state.theme], crt = state.theme === 'crt';
  hemi.intensity = th.hemi * (1 - 0.7 * ug) * (fp.on ? 1.5 : 1); key.intensity = th.keyI * (1 - ug); rimL.intensity = th.rimI * (1 - ug);
  scene.environmentIntensity = th.env * (1 - 0.3 * ug);
  scene.fog.density = fp.on ? 0.008 + ug * 0.03 : 0;
  scene.fog.color.lerpColors(new THREE.Color(crt ? '#16122a' : th.bg), new THREE.Color(crt ? '#06040b' : '#2b2734'), ug);
  lantern.intensity = fp.on ? Math.max(0, ug - 0.5) * 2 * (crt ? 2.4 : 1.6) : 0;
  bloom.strength = th.bloom * (1 + 0.4 * ug);
  roomLights.forEach(l => { l.visible = fp.on; });
}
let drag = null;
canvas.addEventListener('pointerdown', e => { if (!fp.on) return; drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (!fp.on || !drag) return; fp.yawOff += (e.clientX - drag.x) * 0.0045; fp.pitchOff = THREE.MathUtils.clamp(fp.pitchOff + (e.clientY - drag.y) * 0.0045, -1.3, 1.3); drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', e => { if (!fp.on || fp.busy) return; e.preventDefault(); fp.sT = THREE.MathUtils.clamp(fp.sT + e.deltaY * 0.003, 0, fp.sc.len); }, { passive: false });
addEventListener('keydown', e => { if (!fp.on) return; held[e.code] = true;
  if (['Space', 'ArrowRight', 'KeyD'].includes(e.code)) { e.preventDefault(); nextStop(); }
  if (['ArrowLeft', 'KeyA'].includes(e.code)) { e.preventDefault(); prevStop(); }
  if (['ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape') exitWalk(); });
addEventListener('keyup', e => { held[e.code] = false; });
$('walkBtn').addEventListener('click', () => fp.on ? exitWalk() : enterWalk());
$('fpNext').addEventListener('click', nextStop); $('fpPrev').addEventListener('click', prevStop); $('fpExit').addEventListener('click', exitWalk);
function updateWalk(dt) {
  if (!fp.on) return;
  const sc = fp.sc, mv = (held.KeyW || held.ArrowUp ? 1 : 0) - (held.KeyS || held.ArrowDown ? 1 : 0);
  if (mv && !fp.busy) fp.sT = THREE.MathUtils.clamp(fp.s + mv * 0.6, 0, sc.len);
  const step = THREE.MathUtils.clamp((fp.sT - fp.s) * (1 - Math.exp(-dt * 3)), -1.9 * dt, 1.9 * dt);
  fp.s += step; fp.dist += Math.abs(step);
  if (Math.abs(step) > 0.002) { const k = Math.exp(-dt * 1.4); fp.yawOff *= k; fp.pitchOff *= k; }
  if (!fp.busy && fp.sT >= sc.len - 1e-3 && fp.s >= sc.len - 0.02 && fp.si < fp.scenes.length - 1) fade(() => goTo(fp.si + 1, 0), titleFor(fp.si + 1, 0));
  const Pz = poseAt(sc, fp.s);
  fpCam.position.copy(Pz.pos); fpCam.position.y += Math.sin(fp.dist * 6) * 0.018;
  fpCam.rotation.set(THREE.MathUtils.clamp(Pz.pitch + fp.pitchOff, -1.4, 1.4), Pz.yaw + fp.yawOff, 0);
  lantern.position.copy(fpCam.position).add(V(0, 0.15, 0));
  applyEnv(Pz.ug);
  const near = sc.keys.find(k => k.stop && Math.abs(k.s - fp.s) < 0.35), card = $('fpCard');
  if (near && card.dataset.k !== near.stop.t) { card.querySelector('h3').textContent = near.stop.t; card.querySelector('p').textContent = near.stop.d; card.dataset.k = near.stop.t; }
  card.classList.toggle('on', !!near && !fp.busy);
  $('fpFill').style.width = (fp.s / sc.len * 100) + '%';
  const ch = [...fp.chapters].reverse().find(c => c.si < fp.si || (c.si === fp.si && fp.scenes[c.si].keys[c.ki].s <= fp.s + 0.01));
  fp.chapters.forEach(c => c.el.classList.toggle('on', c === ch));
}
window.__walk = { fp, enterWalk, goTo, makeScenes, scene, poseAt, tOfS, state };

// ------------------------------------------------------------------ frame
const clock = new THREE.Clock();
function animate(dt, time) {
  if (capstone) { capstone.position.y = capstone.userData.y0 + Math.sin(time * 0.6) * 0.07; capstone.rotation.y = time * 0.12; }
  if (beam) beam.material.opacity = 0.28 + 0.1 * Math.sin(time * 2.1);
  for (const p of pulses) { const k = (time * p.k + p.ph) % 1; p.m.position.lerpVectors(p.from, p.to, k); }
  for (const g of gates) g.userData.gate.uniforms.uT.value = time;
  mastLamps.forEach((l, i) => { l.visible = Math.sin(time * 2.4 + i * 1.7) > 0.2; });
  root.traverse(o => { if (o.isPoints && o.userData.ph) { const a = o.geometry.attributes.position, { c, ph, spread } = o.userData;
    for (let i = 0; i < ph.length; i++) { const [ang, rr, off] = ph[i], k = (time * 0.18 + off) % 1; a.setXYZ(i, c.x + Math.cos(ang + k) * (0.15 + rr + k * 0.3), c.y + 0.2 + k * spread * 1.6, c.z + Math.sin(ang + k) * (0.15 + rr + k * 0.3)); }
    a.needsUpdate = true; o.material.opacity = 1; } });
}
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  animate(dt, time);
  updateWalk(dt);
  fpGroup.visible = fp.on;
  if (!fp.on) controls.update();
  renderPass.camera = fp.on ? fpCam : camera;
  composer.render();
  if (!fp.on) updateLabels();
  requestAnimationFrame(frame);
}
if (state.theme === 'paper') { document.body.classList.add('paper'); [...$('themeSeg').children].forEach(x => x.classList.toggle('on', x.dataset.v === 'paper')); }
if (state.style === 'blocks') [...$('styleSeg').children].forEach(x => x.classList.toggle('on', x.dataset.v === 'blocks'));
resize(); build(); note(); applyEnv(0);
$('boot').remove();
{ const wk = q.get('walk'); if (wk) { makeScenes(); const c = fp.chapters.find(c => c.name.toLowerCase() === wk) || fp.chapters[0]; let ki = c.ki; if (q.get('stop')) ki = fp.scenes[c.si].keys.map((k, i) => k.stop ? i : -1).filter(i => i >= 0)[+q.get('stop')] ?? c.ki; enterWalk(c.si, ki, true); } }
frame();
