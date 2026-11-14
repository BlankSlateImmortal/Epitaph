/* Epitaph — The Hollow Reach, the capital of the Voided (draft 2, built as an artifact to review).
 *
 * Central Germany (51.5N 9.5E), in the forested uplands. Not a ruin: a working city, above and below ground.
 *   The Hollow       a pit 84 across, stepping down in four black walls to a floor 24 below the forest;
 *                    brutalist housing blocks on every step (the hives), four colossal ribbed towers (the Spines)
 *   The floor        Val's palace (three floors), the lake with the station on its island, the Assembly, the arena, the yard
 *   The Descent      a monumental stair cut down from a gatehouse in the forest, under leaning fins
 *   Surface          forest, obelisks round the rim, relay masts, air shafts, great barracks pods
 *   Below            cut open on the south-east: gate hall, gifting chamber, barracks and mess, the station's conduits
 * Walk inside: Descent, Palace (ground floor), Master's rooms, Bedrooms, Top floor, Below.
 * Two looks: Model and Blocks (columns from a top-down height pass, bevelled, white outlines, a blurred gradient).
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
    fabric: '#3a3842', wood: '#4a3020', woodL: '#7a5634', cream: '#d9cfbc', fabric2: '#3a2450', banner: '#2a1838', leather: '#4a2a1e', b1: '#5a2a2a', b2: '#2a3a5a', b3: '#3a4a2a', marble: '#cfcac2', mirror: '#9aa6c4', ice: '#9fc4e8', dead: '#16141a', sky: '#c9c4e0', ribs: '#22212b', bronze: '#6e5a3a', plinth: '#120f18'
  },
  paper: {
    bg: '#f1ece4', ink: '#141a2c', outlinePx: 1.35, blockLine: '#141a2c',
    hemiSky: '#fffaf3', hemiGround: '#b9ae9c', hemi: 1.15, key: '#fff6ea', keyI: 2.0, rim: '#ffffff', rimI: 0.3, env: 0.4, bloom: 0,
    moss: '#7f9a62', soil: '#a88e6c', soil2: '#8c7457', rock: '#9b958a', concrete: '#b3b0a8', concreteD: '#969289', paving: '#8d8a94',
    black: '#2a2836', stone: '#3c3946', stone2: '#4b4756', leaf: '#4f7a4e', leaf2: '#64905c', trunk: '#6b4a32', water: '#3b3f6e',
    sand: '#e6dac0', frost: '#e3eeff', glow: '#ff9a3c', vglow: '#6a5acd', metal: '#6c6a74', base: '#d9cfbf', figure: '#2a2836', robe: '#4a4458',
    fabric: '#7a7682', wood: '#7a5234', woodL: '#b88a5a', cream: '#f1e8d4', fabric2: '#5a3a7a', banner: '#4a2a5a', leather: '#7a4a32', b1: '#8a3a3a', b2: '#3a5a8a', b3: '#5a7a3a', marble: '#ece8e0', mirror: '#c4d0ee', ice: '#bcdcf8', dead: '#2a2830', sky: '#e9e6f2', ribs: '#4a4756', bronze: '#a88a54', plinth: '#cfc3ae'
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

// ------------------------------------------------------------------ the void gate (from Aurelia): a crack touched by nothing
const gates = [];
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

const screens = [];
function screenTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#07060c'; g.fillRect(0, 0, 512, 256); g.font = '12px monospace';
  const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ·:+=/\\|<>01';
  for (let y = 14; y < 256; y += 15) { let s = ''; const n = 10 + ((y * 7) % 24); for (let i = 0; i < n; i++) s += glyphs[(y * 13 + i * 7) % glyphs.length]; g.fillStyle = y % 75 === 14 ? '#e3dcff' : '#8f7cff'; g.fillText(s, 12, y); g.fillStyle = '#4b3fa0'; g.fillRect(300, y - 8, 30 + ((y * 11) % 150), 3); }
  g.strokeStyle = '#b9a8ff'; g.lineWidth = 2; for (const rr of [44, 28]) { g.beginPath(); g.arc(440, 70, rr, 0, Math.PI * 2); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; screens.push(t); return t;
}
// ------------------------------------------------------------------ layout
// The Hollow: a pit 84 across at the rim, stepping down in four black walls to a floor 60 across, 24 below the forest.
// On every step, brutalist housing blocks stand against the wall. Everything stays below the treetops.
const R = 62, PF = -24, BASE = -34;
const WALLS = [42, 38, 34, 30], TOPS = [0, -6, -12, -18], RP = 42, RF = 30;
const SEC0 = D(20), SEC1 = D(75), SECM = (SEC0 + SEC1) / 2;    // cut open on the south-east, beyond the rim
const inSec = a => a > SEC0 && a < SEC1;
const STAIR = { hw: 2.2, z0: 61, z1: 30 };                    // the Descent: a straight stair from the forest edge down to the floor
const stairY = z => PF * THREE.MathUtils.clamp((STAIR.z0 - z) / (STAIR.z0 - STAIR.z1), 0, 1);
const nearStair = (x, z, m = 0) => z > 26 && Math.abs(x) < STAIR.hw + m;
const LAKE = { x: 0, z: 2, r: 9 }, ISLE = 4.6;
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gh = (x, z) => { const r = Math.hypot(x, z); const b = 0.5 + 0.25 * Math.sin(x * 0.23 + 1) + 0.2 * Math.cos(z * 0.19) + 0.1 * Math.sin((x - z) * 0.4); return Math.max(0, b) * smooth(44, 50, r) * 1.1; };
const ledgeTop = r => r >= RP ? 0 : r >= 38 ? -6 : r >= 34 ? -12 : r >= RF ? -18 : PF;   // the walking level at radius r
const ARENA = { x: -19.5, z: 9, ax: 4.2, az: 3.2, tiers: 5, step: 0.75 };
const ASSEMBLY = { x: 19, z: 7 };
const SPINES = [D(45), D(135), D(225), D(315)].map(a => ({ a, r: 26.8 }));
const angIn = (a, lo, hi) => { a = (a % (2 * PI) + 2 * PI) % (2 * PI); lo = (lo % (2 * PI) + 2 * PI) % (2 * PI); hi = (hi % (2 * PI) + 2 * PI) % (2 * PI); return lo <= hi ? a >= lo && a <= hi : a >= lo || a <= hi; };
const labels = [];
const L = (text, pos, opts = {}) => labels.push({ text, pos, ...opts });

// a brutalist housing block standing on a step, its back to the wall: slit windows, a cantilevered top, a balcony band
function hive(K, a, rIn, rOut, yB, w, h, r) {
  const d = rOut - rIn, c = atA(a, (rIn + rOut) / 2, yB), ry = ryOut(a);
  const M = new THREE.Matrix4().compose(c, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V(1, 1, 1));
  const B = (kind, x0, x1, y0, y1, z0, z1) => K.add(kind, box(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, y0, (z0 + z1) / 2).applyMatrix4(M));
  B(r() < 0.5 ? 'concrete' : 'concreteD', -w / 2, w / 2, 0, h, -d / 2, d / 2);
  const cant = 0.7 + r() * 0.9, ch = 1.2 + r() * 0.9;                                  // a heavy top that hangs out over the step
  B('concrete', -w / 2 - 0.15, w / 2 * (0.4 + r() * 0.6), h - ch, h + 0.2, -d / 2 - cant, d / 2);
  if (r() < 0.6) B('concreteD', -w / 2 + 0.3, -w / 2 + 0.3 + w * 0.3, 0, h * 0.55, -d / 2 - 0.5, -d / 2);   // a stair core
  B('concreteD', -w / 2, w / 2, h * 0.42, h * 0.42 + 0.14, -d / 2 - 0.35, -d / 2);       // the balcony band
  const rows = Math.floor((h - ch) / 0.9);
  for (let k = 0; k < rows; k++) for (let i = 0; i < Math.floor(w / 0.55); i++) {
    if (r() < 0.38) continue;
    const x = -w / 2 + 0.35 + i * 0.55, y = 0.35 + k * 0.9;
    B(r() < 0.18 ? 'vglow' : 'glow', x - 0.09, x + 0.09, y, y + 0.42, -d / 2 - 0.03, -d / 2);
  }
  for (let i = 0; i < Math.floor(w / 0.7); i++) { const x = -w / 2 + 0.4 + i * 0.7; if (r() < 0.5) B('glow', x - 0.08, x + 0.08, h - ch + 0.35, h - ch + 0.7, -d / 2 - cant - 0.03, -d / 2 - cant); }
}
// a colossal ribbed black tower rising from the floor (a Spine): vents for the levels below, conduits for the station
function spine(K, a, r) {
  const c = atA(a, r, PF), H = 22.6, RR = 2.5;
  K.add('black', xf(cyl(RR, RR * 1.08, H, 28), c));
  for (let y = 0.6; y < H; y += 0.75) K.add('ribs', new THREE.TorusGeometry(RR + 0.1, 0.13, 5, 28).rotateX(PI / 2).translate(c.x, PF + y, c.z));
  for (const y of [5, 11, 17]) K.add('vglow', new THREE.TorusGeometry(RR + 0.16, 0.05, 4, 40).rotateX(PI / 2).translate(c.x, PF + y, c.z));
  K.add('concrete', xf(cyl(RR + 0.5, RR + 0.3, 1.0, 28), { ...c, y: PF + H }));
  K.add('black', xf(cyl(RR * 0.5, RR * 0.5, 0.4, 20), { ...c, y: PF + H + 1.0 })); K.add('vglow', xf(cyl(RR * 0.4, RR * 0.4, 0.05, 20), { ...c, y: PF + H + 1.4 }));
  // a bridge from its top across the steps to the rim
  const top = PF + H + 1.0, from = atA(a, r + RR + 0.3), to = atA(a, RP + 1.5), len = from.distanceTo(to);
  K.add('concrete', xf(box(2.2, 0.7, len).translate(0, -0.7, len / 2), { ...from, y: top, ry: ryOut(a) }));
  K.add('concreteD', xf(box(0.18, 0.5, len).translate(-1.0, 0, len / 2), { ...from, y: top, ry: ryOut(a) })); K.add('concreteD', xf(box(0.18, 0.5, len).translate(1.0, 0, len / 2), { ...from, y: top, ry: ryOut(a) }));
}

// ------------------------------------------------------------------ the city (diorama)
let capstone = null, beam = null, pulses = [], valDust = null;
function buildReach(K, extra) {
  // ---- the forest floor round the rim, and the outer cliff in layers (open on the south for the stair, cut away on the south-east)
  const NA = 320, NR = 16;
  for (let i = 0; i < NA; i++) {
    const a0 = i / NA * 2 * PI, a1 = (i + 1) / NA * 2 * PI, am = (a0 + a1) / 2;
    for (let j = 0; j < NR; j++) {
      const r0 = RP + (R - RP) * j / NR, r1 = RP + (R - RP) * (j + 1) / NR, m = atA(am, (r0 + r1) / 2);
      if (inSec(am) || nearStair(m.x, m.z, 0.55)) continue;
      const P = (a, r) => { const x = Math.cos(a) * r, z = Math.sin(a) * r; return V(x, gh(x, z), z); };
      quad(K, 'moss', P(a0, r0), P(a1, r0), P(a1, r1), P(a0, r1), V(0, 1, 0));
    }
    const o0 = atA(a0, R), o1 = atA(a1, R), out = atA(am, 1), mo = atA(am, R);
    if (inSec(am) || nearStair(mo.x, mo.z, 0.2)) continue;
    const t0 = gh(o0.x, o0.z), t1 = gh(o1.x, o1.z);
    for (const [kind, ya, yb] of [['soil', 0, -2], ['soil2', -2, -9], ['rock', -9, -20], ['soil2', -20, -24], ['rock', -24, BASE]]) quad(K, kind, V(o0.x, ya === 0 ? t0 : ya, o0.z), V(o1.x, ya === 0 ? t1 : ya, o1.z), V(o1.x, yb, o1.z), V(o0.x, yb, o0.z), out);
  }
  // ---- the steps: four smooth black walls, a walkway on each step, the floor
  for (let w = 0; w < 4; w++) {
    const r = WALLS[w], y0 = TOPS[w], y1 = y0 - 6;
    for (let i = 0; i < NA; i++) {
      const a0 = i / NA * 2 * PI, a1 = (i + 1) / NA * 2 * PI, am = (a0 + a1) / 2, p0 = atA(a0, r), p1 = atA(a1, r), m = atA(am, r);
      if (nearStair(m.x, m.z, 0.2)) continue;
      quad(K, 'black', V(p0.x, y0, p0.z), V(p1.x, y0, p1.z), V(p1.x, y1, p1.z), V(p0.x, y1, p0.z), atA(am, -1));
      if (w < 3) { const q0 = atA(a0, WALLS[w + 1]), q1 = atA(a1, WALLS[w + 1]), mm = atA(am, (r + WALLS[w + 1]) / 2); if (!nearStair(mm.x, mm.z, 0.55)) quad(K, 'paving', V(q0.x, y1, q0.z), V(q1.x, y1, q1.z), V(p1.x, y1, p1.z), V(p0.x, y1, p0.z), V(0, 1, 0)); }
    }
  }
  K.add('paving', new THREE.CircleGeometry(RF, 128).rotateX(-PI / 2).translate(0, PF, 0));
  // behind the rim, on the cut-away side, the pit's outer face
  for (let i = 0; i < NA; i++) { const a0 = i / NA * 2 * PI, a1 = (i + 1) / NA * 2 * PI, am = (a0 + a1) / 2; if (!inSec(am)) continue; const p0 = atA(a0, RP), p1 = atA(a1, RP); quad(K, 'concrete', V(p0.x, 0, p0.z), V(p1.x, 0, p1.z), V(p1.x, BASE + 1, p1.z), V(p0.x, BASE + 1, p0.z), atA(am, 1)); }
  // the parapet round the rim
  for (let i = 0; i < 220; i++) { const a = (i + 0.5) / 220 * 2 * PI, p = atA(a, RP + 0.2); if (inSec(a) || nearStair(p.x, p.z, 0.6)) continue; K.add('concreteD', xf(box(2 * PI * (RP + 0.2) / 220 + 0.02, 0.5, 0.4), { ...p, ry: ryOut(a) })); }

  // ---- housing on every step and round the floor's edge
  { const r = rng(21), rings = [[38.3, 41.7, -6], [34.3, 37.7, -12], [30.3, 33.7, -18], [26.3, 29.7, PF]];
    rings.forEach(([rIn, rOut, yB], ri) => {
      let a = r() * 0.05; const rm = (rIn + rOut) / 2;
      while (a < 2 * PI) {
        const w = 3.2 + r() * 3.2, da = w / rm, gap = (0.7 + r() * 0.9) / rm, am = a + da / 2, p = atA(am, rm);
        let skip = nearStair(p.x, p.z, 2.4);
        skip = skip || SPINES.some(s => Math.abs(Math.atan2(Math.sin(am - s.a), Math.cos(am - s.a))) < D(ri === 3 ? 8 : 4.5));
        if (ri === 3) skip = skip || angIn(am, D(232), D(308)) || angIn(am, D(140), D(198)) || angIn(am, D(348), D(32));
        if (!skip) hive(K, am, rIn, rOut, yB, w, ri === 3 ? 4.6 + r() * 1.6 : 3.6 + r() * 1.9, r);
        a += da + gap;
      }
    });
    L('The hives', atA(D(200), 36, -3)); }
  for (const s of SPINES) spine(K, s.a, s.r);
  L('The Spines', atA(D(135), 26.8, 1.8));
  // lit slits in the black walls between the blocks: rooms dug in further back
  { const r = rng(11); for (let w = 0; w < 4; w++) for (let k = 0; k < 60; k++) { const a = r() * 2 * PI, y = TOPS[w] - 0.8 - r() * 1.2, p = atA(a, WALLS[w] - 0.03, y); if (nearStair(p.x, p.z, 1)) continue; K.add('vglow', xf(box(0.6 + r() * 1.6, 0.09, 0.05), { ...p, ry: ryOut(a) })); } }

  // ---- the Descent: a monumental stair cut straight down from the forest to the floor, under leaning fins
  { const N = 124;
    for (let i = 0; i < N; i++) { const za = STAIR.z0 - (STAIR.z0 - STAIR.z1) * i / N, zb = STAIR.z0 - (STAIR.z0 - STAIR.z1) * (i + 1) / N, y = stairY((za + zb) / 2);
      K.add(i % 31 === 30 ? 'paving' : 'concrete', xf(box(2 * STAIR.hw, y - BASE, za - zb + 0.02), { x: 0, y: BASE, z: (za + zb) / 2 })); }
    // the cutting's walls, from each step's level up to whatever ground is there
    for (let z = STAIR.z1 - 0.5; z < STAIR.z0 + 1; z += 0.5) {
      const top = z > RP ? gh(STAIR.hw, z) : ledgeTop(z), yb = stairY(z + 0.25) - 0.4;
      if (top > yb + 0.05) for (const sx of [-1, 1]) K.add('concreteD', xf(box(0.5, top - yb + 0.3, 0.52), { x: sx * (STAIR.hw + 0.25), y: yb, z: z + 0.25 }));
    }
    for (let z = STAIR.z1 + 0.8; z < STAIR.z0 - 0.5; z += 1.7) {
      const y = stairY(z); K.add('concrete', xf(box(0.6, 4.6, 0.26), { x: STAIR.hw - 0.3, y, z, rz: 0.16 }));        // fins on the east side, leaning over the stair
      K.add('concrete', xf(box(2 * STAIR.hw + 0.4, 0.3, 0.26), { x: -0.2, y: y + 4.45, z }));
    }
    // the gatehouse over the top of the stair, in the forest
    K.add('concrete', xf(box(2.6, 9, 3.4), { x: -4.4, y: -0.5, z: 58.2 })); K.add('concrete', xf(box(2.6, 9, 3.4), { x: 4.4, y: -0.5, z: 58.2 }));
    K.add('concrete', xf(box(12.2, 2.6, 4.4), { x: 0, y: 8.3, z: 58.2 })); K.add('concreteD', xf(box(7, 1.6, 3.0), { x: -1.6, y: 10.9, z: 57.8 }));
    for (let i = 0; i < 9; i++) K.add('glow', xf(box(0.16, 0.6, 0.05), { x: -4.2 + i * 1.05, y: 9.1, z: 60.42 }));
    L('The Descent', V(0, 12.6, 58)); }

  // ---- the floor: the lake, the island and the station, the causeway, the relays
  K.add('water', new THREE.CircleGeometry(LAKE.r, 96).rotateX(-PI / 2).translate(LAKE.x, PF + 0.04, LAKE.z));
  K.add('stone', new THREE.TorusGeometry(LAKE.r + 0.15, 0.22, 5, 96).rotateX(PI / 2).translate(LAKE.x, PF + 0.06, LAKE.z));
  K.add('concrete', xf(cyl(ISLE, ISLE + 0.3, 0.6, 48), { x: LAKE.x, y: PF, z: LAKE.z }));
  for (const [z0, z1] of [[LAKE.z + ISLE - 0.2, LAKE.z + LAKE.r + 0.6], [LAKE.z - LAKE.r - 0.6, LAKE.z - ISLE + 0.2]]) {
    K.add('paving', xf(box(2.6, 0.3, z1 - z0), { x: 0, y: PF, z: (z0 + z1) / 2 }));
    for (const sx of [-1, 1]) K.add('concreteD', xf(box(0.16, 0.42, z1 - z0), { x: sx * 1.25, y: PF + 0.3, z: (z0 + z1) / 2 }));
  }
  const SP = (x, y, z) => V(LAKE.x + x, PF + 0.6 + y, LAKE.z + z);
  const st = station(K, SP, 2.2, 7.2, 5.2, 0.26);
  extra.capTip = { p: SP(0, st.top + 0.5, 0), r: st.sc * Math.SQRT2, h: 7.2 - 5.2 };
  K.add('vglow', new THREE.TorusGeometry(ISLE - 0.4, 0.05, 4, 64).rotateX(PI / 2).translate(LAKE.x, PF + 0.62, LAKE.z));
  L('The station', SP(0, 8.6, 0));
  const RR = 11; extra.relays = [];
  for (let k = 0; k < 6; k++) {
    const a = k * PI / 3, p = V(LAKE.x + Math.cos(a) * RR, PF, LAKE.z + Math.sin(a) * RR);
    relay(K, p, 0.9); extra.relays.push(p);
    const from = V(LAKE.x + Math.cos(a) * (LAKE.r + 0.4), PF + 0.03, LAKE.z + Math.sin(a) * (LAKE.r + 0.4)), len = RR - LAKE.r - 0.9;
    K.add('vglow', xf(box(0.08, 0.012, len).translate(0, 0, len / 2), { ...from, ry: PI / 2 - a }));
  }
  L('Relays', V(LAKE.x - RR, PF + 3.6, LAKE.z));

  // ---- Val's palace: three floors of black stone on the north of the floor, facing the lake
  const pz = -20.5, py = PF + 0.7;
  K.add('stone', xf(box(23, 0.7, 13.5), { x: 0, y: PF, z: pz }));
  K.add('paving', xf(box(9, 0.04, 7.6), { x: 0, y: PF, z: -10.8 }));
  for (let s = 0; s < 5; s++) K.add('stone', xf(box(8 - s * 0.3, 0.7 - s * 0.14, 0.32), { x: 0, y: PF, z: pz + 6.75 + s * 0.3 }));
  for (const sx of [-1, 1]) {
    // the wings: two floors
    K.add('stone', xf(box(7.2, 6.8, 9.6), { x: sx * 6.6, y: py, z: pz - 0.5 }));
    K.add('black', xf(box(7.6, 0.3, 10.0), { x: sx * 6.6, y: py + 6.8, z: pz - 0.5 }));
    K.add('black', xf(box(7.4, 0.2, 0.3), { x: sx * 6.6, y: py + 3.4, z: pz + 4.4 }));
    for (const row of [0.6, 4.0]) for (const cx of [-2.4, -0.8, 0.8, 2.4]) K.add('glow', xf(box(0.7, 2.0, 0.06), { x: sx * 6.6 + cx, y: py + row, z: pz + 4.32 }));
    for (const cx of [-3.3, -1.6, 0, 1.6, 3.3]) K.add('stone2', xf(box(0.22, 6.8, 0.18), { x: sx * 6.6 + cx, y: py, z: pz + 4.36 }));
    for (const cz of [-3, 0, 3]) K.add('glow', xf(box(0.06, 2.0, 0.7), { x: sx * 10.23, y: py + 4.0, z: pz - 0.5 + cz }));
    K.add('leaf', xf(box(6.4, 0.3, 0.6), { x: sx * 6.6, y: py + 7.1, z: pz + 4.0 }));
    K.add('stone2', xf(box(2.2, 0.5, 0.7), { x: sx * 6.0, y: py, z: pz + 5.6 })); K.add('dead', xf(cone(0.5, 1.6, 5), { x: sx * 6.0, y: py + 0.5, z: pz + 5.6 }));
  }
  // the centre: three floors and a belvedere with the great window
  K.add('stone', xf(box(6.4, 10.2, 9.6), { x: 0, y: py, z: pz - 0.3 }));
  K.add('black', xf(box(6.9, 0.36, 10.1), { x: 0, y: py + 10.2, z: pz - 0.3 }));
  K.add('stone', xf(box(5.0, 3.0, 6.0), { x: 0, y: py + 10.56, z: pz - 1.2 })); K.add('black', xf(box(5.4, 0.3, 6.4), { x: 0, y: py + 13.56, z: pz - 1.2 }));
  K.add('black', xf(box(6.9, 1.2, 0.6), { x: 0, y: py + 6.3, z: pz + 4.6 }));
  for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) K.add('stone2', xf(box(0.4, 0.34, 0.1), { x: -2.7 + i * 0.6, y: py + 6.45 + j * 0.46, z: pz + 4.95 }));
  for (const sx of [-1, 1]) for (let f = 0; f < 4; f++) K.add('stone2', xf(box(0.18, 6.2, 0.36), { x: sx * (1.5 + f * 0.36), y: py, z: pz + 4.6 }));
  K.add('glow', xf(box(2.2, 4.2, 0.06), { x: 0, y: py, z: pz + 4.52 }));                       // the door
  K.add('glow', xf(box(2.0, 1.6, 0.06), { x: 0, y: py + 4.5, z: pz + 4.52 }));
  { const sh = roundArchShape(4.2, 3.4); K.add('glow', new THREE.ShapeGeometry(sh, 16).translate(0, py + 7.6, pz + 4.53)); K.add('black', xf(box(0.14, 3.4, 0.1), { x: 0, y: py + 7.6, z: pz + 4.58 })); K.add('black', xf(box(4.2, 0.14, 0.1), { x: 0, y: py + 9.0, z: pz + 4.58 })); }
  K.add('stone', xf(box(5.0, 0.2, 1.4), { x: 0, y: py + 7.5, z: pz + 5.2 }));                  // the top balcony
  for (let i = 0; i <= 12; i++) K.add('stone2', xf(box(0.06, 0.6, 0.06), { x: -2.4 + i * 0.4, y: py + 7.7, z: pz + 5.84 }));
  K.add('stone2', xf(box(5.0, 0.06, 0.1), { x: 0, y: py + 8.3, z: pz + 5.84 }));
  for (const cx of [-3.8, 3.8]) { K.add('stone2', xf(cyl(0.14, 0.16, 1.0, 8), { x: cx, y: py, z: pz + 6.2 })); K.add('glow', xf(box(0.3, 0.34, 0.3), { x: cx, y: py + 1.0, z: pz + 6.2 })); }
  L('Val\'s palace', V(0, py + 15.2, pz));
  const valP = V(0.3, py + 7.7, pz + 5.4);
  figure(K, 'figure', valP, 0, 1.0, 'val');
  K.add('val', xf(box(0.13, 0.42, 0.13), { x: valP.x + 0.26, y: valP.y + 0.35, z: valP.z }));
  K.add('frost', new THREE.CircleGeometry(0.85, 24).rotateX(-PI / 2).translate(valP.x, valP.y + 0.012, valP.z - 0.1));
  extra.valP = valP; extraState.valP = valP;
  L('Val', V(valP.x, valP.y + 1.8, valP.z), { small: 1 });

  // ---- the Assembly: a colossal brutalist hall on piers, east of the lake, its stair facing the water
  { const p = ASSEMBLY, y0 = PF;
    K.add('concrete', xf(box(13, 0.6, 11), { x: p.x, y: y0, z: p.z }));
    for (const dx of [-4.5, -1.5, 1.5, 4.5]) for (const dz of [-3.6, 3.6]) K.add('concrete', xf(box(1.3, 5.2, 1.6), { x: p.x + dx, y: y0, z: p.z + dz }));
    K.add('concrete', xf(box(12, 5.4, 10), { x: p.x + 0.4, y: y0 + 5.2, z: p.z }));
    K.add('concreteD', xf(box(5.4, 4.0, 4.6), { x: p.x - 2.2, y: y0 + 10.6, z: p.z - 2.0 })); K.add('concrete', xf(box(4.4, 5.6, 3.6), { x: p.x + 3.0, y: y0 + 10.6, z: p.z + 2.4 }));
    K.add('concrete', xf(box(2.6, 3.2, 11.6), { x: p.x - 6.4, y: y0 + 6.2, z: p.z })); K.add('concreteD', xf(box(3.2, 2.0, 3.2), { x: p.x + 6.4, y: y0 + 7.4, z: p.z - 3.6 }));
    K.add('concrete', xf(box(3.0, 2.6, 3.0), { x: p.x - 1.0, y: y0 + 14.6, z: p.z - 2.2 }));
    for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) K.add('glow', xf(box(0.08, 0.9, 0.36), { x: p.x - 7.72, y: y0 + 6.5 + j * 0.95, z: p.z - 4.6 + i * 1.15 }));
    for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) K.add('glow', xf(box(0.42, 0.8, 0.08), { x: p.x - 3.6 + i * 1.15, y: y0 + 5.9 + j * 1.5, z: p.z + 5.04 }));
    for (let s = 0; s < 14; s++) K.add('concreteD', xf(box(0.5, 0.36 * (s + 1), 4.0), { x: p.x - 6.6 + s * 0.5 - 7.0, y: y0, z: p.z }));
    K.add('glow', xf(box(0.06, 2.4, 2.4), { x: p.x - 5.2, y: y0 + 0.6, z: p.z }));
    L('The Assembly', V(p.x, y0 + 18.6, p.z)); }

  // ---- the arena on the floor: tiered stands round pale sand, a ribbed black wall, a gate toward the lake
  { const A = ARENA, y0 = PF + 0.05, ell = (rx, rz) => { const s = new THREE.Shape(); s.absellipse(0, 0, rx, rz, 0, 2 * PI); return s; };
    K.add('sand', new THREE.ExtrudeGeometry(ell(A.ax, A.az), { depth: 0.06, bevelEnabled: false, curveSegments: 48 }).rotateX(-PI / 2).translate(A.x, y0, A.z));
    for (let i = 0; i < A.tiers; i++) { const sh = ell(A.ax + (i + 1) * A.step, A.az + (i + 1) * A.step); sh.holes.push(ell(A.ax + i * A.step, A.az + i * A.step));
      K.add(i % 2 ? 'concrete' : 'concreteD', new THREE.ExtrudeGeometry(sh, { depth: 0.42 * (i + 1), bevelEnabled: false, curveSegments: 48 }).rotateX(-PI / 2).translate(A.x, y0, A.z)); }
    const ox = A.ax + A.tiers * A.step + 0.25, oz = A.az + A.tiers * A.step + 0.25, r = rng(5);
    for (let k = 0; k < 72; k++) { const t = k / 72 * 2 * PI; if (Math.abs(Math.atan2(Math.sin(t), Math.cos(t))) < 0.18) continue;
      const p = V(A.x + Math.cos(t) * ox, y0, A.z + Math.sin(t) * oz), n = V(Math.cos(t) / ox, 0, Math.sin(t) / oz).normalize();
      K.add('black', xf(box(0.36, 3.4 + 0.3 * Math.sin(k * 0.9), 0.7).translate(0, 0, 0.25), { ...p, ry: Math.atan2(n.x, n.z) })); }
    for (let i = 1; i < A.tiers; i++) for (let k = 0; k < 56; k++) { if (r() < 0.4) continue; const t = k / 56 * 2 * PI + r() * 0.05; if (Math.abs(Math.atan2(Math.sin(t), Math.cos(t))) < 0.24) continue;
      const rx = A.ax + (i + 0.5) * A.step, rz = A.az + (i + 0.5) * A.step; K.add('figure', xf(box(0.18, 0.34, 0.18), { x: A.x + Math.cos(t) * rx, y: y0 + 0.42 * (i + 1), z: A.z + Math.sin(t) * rz })); }
    figure(K, 'robe', V(A.x - 0.8, y0 + 0.06, A.z + 0.2), PI / 2, 0.7); figure(K, 'figure', V(A.x + 0.8, y0 + 0.06, A.z - 0.1), -PI / 2, 0.7);
    L('The arena', V(A.x, y0 + 5.2, A.z)); }

  // ---- the yard below the stair: Voided drilling in ranks
  for (let rI = 0; rI < 6; rI++) for (let c = 0; c < 12; c++) figure(K, 'robe', V(-5.5 + c * 1.0, PF, 16.5 + rI * 1.1), PI, 0.7);
  figure(K, 'figure', V(0, PF, 14.6), 0, 0.75);
  L('The yard', V(0, PF + 2.4, 19.5));

  // ---- the forest above, with what the Voided let show: obelisks, masts, air shafts, the great pods
  for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * 2 * PI, p = atA(a, 43.8); if (inSec(a) || nearStair(p.x, p.z, 2)) continue; p.y = gh(p.x, p.z);
    K.add('black', xf(new THREE.CylinderGeometry(0.35, 0.65, 5.6, 4).translate(0, 2.8, 0), { ...p, y: p.y - 0.1, ry: PI / 4 })); K.add('vglow', xf(new THREE.ConeGeometry(0.25, 0.6, 4).translate(0, 0.3, 0), { ...p, y: p.y + 5.45, ry: PI / 4 })); }
  extra.masts = [D(115), D(196), D(300), D(160), D(250)].map(a => { const p = atA(a, 54); p.y = gh(p.x, p.z); return p; });
  extra.masts.forEach(p => mast(K, p, 8));
  extra.shafts = [D(128), D(176), D(222), D(268)].map(a => ({ a, r: 51 }));
  for (const s of extra.shafts) { const p = atA(s.a, s.r); const y = gh(p.x, p.z) - 1;
    K.add('concrete', xf(box(5.6, 4.4, 5.6), { ...p, y, ry: ryOut(s.a) })); K.add('concreteD', xf(box(4.2, 1.2, 4.2), { ...p, y: y + 4.4, ry: ryOut(s.a) }));
    for (let i = 0; i < 6; i++) K.add('vglow', xf(box(3.6, 0.07, 0.06).translate(0, 0, 2.1), { ...p, y: y + 4.6 + i * 0.16, ry: ryOut(s.a) })); }
  L('Air shafts', atA(D(176), 51, 7));
  extra.pods = [D(-46), D(-32), D(-18)].map(a => ({ a, r: 52 }));
  for (const P of extra.pods) { const p = atA(P.a, P.r); bigPod(K, P.a, P.r, gh(p.x, p.z) - 0.4); }
  L('Barracks pods', atA(D(-32), 52, 5.6));
  // the forest: dark firs everywhere the city isn't, thick enough that you could walk past it
  { const r = rng(3), clear = [p => extra.masts.some(m => Math.hypot(m.x - p.x, m.z - p.z) < 1.8), p => extra.shafts.some(s => atA(s.a, s.r).distanceTo(V(p.x, 0, p.z)) < 5), p => extra.pods.some(s => atA(s.a, s.r).distanceTo(V(p.x, 0, p.z)) < 7.5),
      p => Math.hypot(p.x, p.z) < 45, p => nearStair(p.x, p.z, 3.2), p => Math.abs(p.x) < 7 && p.z > 55];
    let n = 0;
    for (let t = 0; t < 9000 && n < 1500; t++) {
      const a = r() * 2 * PI, rr = 44 + Math.sqrt(r()) * 17.6, p = atA(a, rr);
      if (inSec(a) || inSec(a - 0.02) || inSec(a + 0.02) || rr > R - 0.5 || clear.some(f => f(p))) continue;
      const y = gh(p.x, p.z), h = 1.8 + r() * 2.2 + (rr > 54 ? 0.6 : 0), w = h * (0.3 + r() * 0.08);
      K.add('trunk', xf(cyl(0.07, 0.1, 0.45, 5), { ...p, y: y - 0.05 }));
      K.add(r() < 0.5 ? 'leaf' : 'leaf2', xf(cone(w, h * 0.7, 6), { ...p, y: y + 0.3, ry: r() }));
      K.add('leaf', xf(cone(w * 0.7, h * 0.55, 6), { ...p, y: y + 0.3 + h * 0.42, ry: r() }));
      n++;
    } }

  // ---- below the forest, cut open on the south-east: four levels
  const u = atA(SECM, 1), t = V(-u.z, 0, u.x), S = (rho, y, tau) => V(u.x * rho + t.x * tau, y, u.z * rho + t.z * tau), sRy = ryOut(SECM);
  for (const a of [SEC0, SEC1]) { const want = atA(a + (a === SEC0 ? PI / 2 : -PI / 2), 1), p0 = atA(a, RP), p1 = atA(a, R);
    for (const [kind, ya, yb] of [['soil', 0, -2], ['soil2', -2, -9], ['rock', -9, -20], ['soil2', -20, -24], ['rock', -24, BASE]]) quad(K, kind, V(p0.x, ya === 0 ? gh(p0.x, p0.z) : ya, p0.z), V(p1.x, ya === 0 ? gh(p1.x, p1.z) : ya, p1.z), V(p1.x, yb, p1.z), V(p0.x, yb, p0.z), want); }
  const slab = (yA, yB, kind = 'concrete') => { const N = 30; for (let i = 0; i < N; i++) { const a0 = SEC0 + (SEC1 - SEC0) * i / N, a1 = SEC0 + (SEC1 - SEC0) * (i + 1) / N, c = [atA(a0, RP), atA(a1, RP), atA(a1, R), atA(a0, R)];
      quad(K, kind, ...c.map(p => V(p.x, yB, p.z)), V(0, 1, 0)); quad(K, 'rock', ...c.map(p => V(p.x, yA, p.z)), V(0, -1, 0));
      const o0 = atA(a0, R), o1 = atA(a1, R); quad(K, 'rock', V(o0.x, yB, o0.z), V(o1.x, yB, o1.z), V(o1.x, yA, o1.z), V(o0.x, yA, o0.z), atA((a0 + a1) / 2, 1)); } };
  const LV = [-7, -15.5, -24.5, BASE + 1];
  slab(BASE, BASE + 1); slab(-25.5, LV[2]); slab(-16.5, LV[1]); slab(-8, LV[0]);
  // level 1: the gate hall: three void gates in concrete frames along the back, travellers, consoles
  for (const tau of [-7, 0, 7]) { const y = LV[0], p = S(43.6, y, tau);
    K.add('concrete', xf(box(3.2, 0.4, 0.8), { ...p, ry: sRy })); K.add('concrete', xf(box(3.2, 0.5, 0.8), { ...S(43.6, y + 4.2, tau), ry: sRy }));
    for (const s_ of [-1.45, 1.45]) K.add('concrete', xf(box(0.36, 4.7, 0.8), { ...S(43.6, y, tau + s_), ry: sRy }));
    const g = makeGate(2.5, 3.7, 3.1 + tau); g.position.copy(S(43.7, y + 0.4 + 1.85, tau)); g.rotation.y = sRy; extra.add.push(g); }
  for (let i = 0; i < 7; i++) K.add('vglow', xf(box(0.08, 0.012, 16), { ...S(45 + i * 1.6, LV[0] + 0.02, 0), ry: sRy + PI / 2 }));
  for (const tau of [-11, 11]) { K.add('metal', xf(box(1.2, 1.1, 0.6), { ...S(47, LV[0], tau), ry: sRy })); K.add('vglow', xf(box(1.0, 0.6, 0.04), { ...S(47, LV[0] + 1.2, tau + 0.01), ry: sRy, rx: -0.3 })); }
  { const r = rng(13); for (let i = 0; i < 14; i++) K.add('wood', xf(box(0.8, 0.7, 0.8), { ...S(55 + r() * 5, LV[0], -16 + r() * 8), ry: sRy + r() })); for (let i = 0; i < 9; i++) figure(K, r() < 0.5 ? 'robe' : 'figure', S(46 + r() * 9, LV[0], -9 + r() * 18), sRy + PI + (r() - 0.5), 0.9); }
  L('Gate hall', S(50, 0.8, 0));
  // level 2: the gifting chamber, banded with light, a black eye hanging from its half-dome, cut open toward you
  { const C = S(52, LV[1], 0), RC = 6.2, yF = LV[1], NT = 56, rho0 = 52;
    const P = (th, r, y) => S(rho0 + Math.cos(th) * r, y, Math.sin(th) * r);
    for (let i = 0; i < NT; i++) { const th0 = i / NT * 2 * PI, th1 = (i + 1) / NT * 2 * PI, tm = (th0 + th1) / 2; if (Math.cos(tm) > 0.3) continue;
      const want = S(-Math.cos(tm), 0, -Math.sin(tm));
      for (let b = 0; b < 6; b++) { const ya = yF + 0.3 + b * 0.7, yb = ya + 0.52; quad(K, 'ribs', P(th0, RC, ya), P(th1, RC, ya), P(th1, RC, yb), P(th0, RC, yb), want); quad(K, 'vglow', P(th0, RC + 0.06, yb), P(th1, RC + 0.06, yb), P(th1, RC + 0.06, yb + 0.18), P(th0, RC + 0.06, yb + 0.18), want); }
      quad(K, 'ribs', P(th0, RC, yF), P(th1, RC, yF), P(th1, RC, yF + 0.3), P(th0, RC, yF + 0.3), want);
      const yT = yF + 0.3 + 6 * 0.7;
      for (let k = 0; k < 6; k++) { const p0 = k / 6 * PI / 2, p1 = (k + 1) / 6 * PI / 2; quad(K, 'ribs', P(th0, RC * Math.cos(p0), yT + 3.5 * Math.sin(p0)), P(th1, RC * Math.cos(p0), yT + 3.5 * Math.sin(p0)), P(th1, RC * Math.cos(p1), yT + 3.5 * Math.sin(p1)), P(th0, RC * Math.cos(p1), yT + 3.5 * Math.sin(p1)), want); } }
    const yT = yF + 0.3 + 6 * 0.7;
    K.add('concrete', new THREE.CircleGeometry(RC, 48).rotateX(-PI / 2).translate(C.x, yF + 0.01, C.z));
    K.add('concreteD', xf(cyl(2.2, 2.4, 0.4, 32), C)); K.add('vglow', new THREE.TorusGeometry(2.3, 0.04, 4, 48).rotateX(PI / 2).translate(C.x, yF + 0.41, C.z));
    K.add('black', new THREE.SphereGeometry(1.3, 24, 12, 0, 2 * PI, PI / 2, PI / 2).translate(C.x, yT + 1.6, C.z)); K.add('vglow', new THREE.TorusGeometry(1.32, 0.05, 4, 40).rotateX(PI / 2).translate(C.x, yT + 1.6, C.z));
    tubeSeg(K, 'metal', V(C.x, yT + 1.6, C.z), V(C.x, yT + 3.5, C.z), 0.05, 0.05, 5);
    figure(K, 'figure', V(C.x, yF + 0.4 - 0.35, C.z), sRy + PI, 0.8);
    for (const th of [PI - 1.0, PI - 0.35, PI + 0.35, PI + 1.0]) figure(K, 'robe', P(th, 3.6, yF), sRy + PI / 2 - th, 0.95);
    for (let k = 0; k < 9; k++) { const th = PI - 1.4 + k * 0.35; K.add('wood', xf(box(1.0, 0.45, 0.45), { ...P(th, RC - 0.6, yF), ry: sRy + PI / 2 - th })); }
    L('Gifting chamber', S(52, LV[1] + 9, 0)); }
  // level 3: barracks and the mess
  { const y = LV[2];
    for (let i = 0; i < 6; i++) for (const tau of [-16, -12.5, 12.5, 16]) { const p = S(45 + i * 2.4, y, tau); bunkAt(K, p, sRy + PI / 2); }
    for (const tau of [-4, 4]) { K.add('wood', xf(box(9, 0.9, 1.3), { ...S(51, y, tau), ry: sRy + PI / 2 })); for (const s of [-1, 1]) K.add('wood', xf(box(9, 0.5, 0.4), { ...S(51, y, tau + s * 1.0), ry: sRy + PI / 2 })); }
    const r = rng(17); for (let i = 0; i < 10; i++) figure(K, 'robe', S(47 + r() * 9, y, (r() < 0.5 ? -1 : 1) * (2.6 + r() * 2.6)), sRy + r() * 6, 0.9);
    L('Barracks & mess', S(50, y + 7.2, -14)); }
  // level 4: the station's conduits: black pipes as wide as rooms, a ribbed tunnel toward the Hollow
  { const y = LV[3];
    for (const tau of [-9, -3, 3, 9]) { const a = S(43, y + 2.2, tau), b = S(61, y + 2.2, tau); tubeSeg(K, 'black', a, b, 1.4, 1.4, 20); for (let k = 0; k < 10; k++) { const p = a.clone().lerp(b, (k + 0.5) / 10); K.add('ribs', new THREE.TorusGeometry(1.5, 0.1, 5, 24).rotateY(sRy).translate(p.x, p.y, p.z)); } K.add('vglow', xf(box(0.1, 0.02, 18), { ...S(52, y + 0.03, tau + 1.7), ry: sRy + PI / 2 })); }
    for (let k = 0; k < 14; k++) { const p = S(43 + k * 1.3, y, -15); K.add('ribs', new THREE.TorusGeometry(2.2, 0.2, 6, 16, PI).rotateY(sRy + PI / 2).translate(p.x, p.y, p.z)); }
    L('Conduits', S(52, y + 6.4, 9)); }
  { const p = S(60.6, BASE + 1, 14); K.add('metal', xf(box(1.6, -BASE - 1 + 0.5, 1.6), { ...p, ry: sRy })); K.add('glass', xf(box(1.7, -BASE - 1 + 0.4, 1.7), { ...p, ry: sRy })); K.add('vglow', xf(box(1.3, 1.6, 1.3), { ...S(60.6, -12, 14), ry: sRy })); }
  L('The Hollow', V(-6, 2.4, -36));
}
// a lying ribbed barracks pod on the surface, big enough for a few hundred bunks
function bigPod(K, a, r, y) {
  const len = 10, rad = 2.2, c = atA(a, r, y + rad * 0.72);
  K.add('black', new THREE.CapsuleGeometry(rad, len, 8, 20).rotateX(PI / 2).rotateY(ryOut(a)).translate(c.x, c.y, c.z));
  for (let i = 0; i <= 16; i++) { const tt = -len / 2 + i * len / 16, p = atA(a, r + tt, y + rad * 0.72); K.add('ribs', new THREE.TorusGeometry(rad + 0.08, 0.12, 5, 28).rotateY(ryOut(a)).translate(p.x, p.y, p.z)); }
  const door = atA(a, r - len / 2 - rad + 0.08, y + 0.02); K.add('vglow', xf(box(1.3, 1.6, 0.06), { ...door, ry: ryOut(a) }));
  K.add('paving', xf(box(5.2, 0.4, len + 2 * rad + 1.0), { ...atA(a, r, y - 0.3), ry: ryOut(a) }));
}
function bunkAt(K, p, ry) {
  const M = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V(1, 1, 1));
  for (const y of [0.35, 1.25]) { K.add('metal', box(0.9, 0.1, 2.0).translate(0, y, 0).applyMatrix4(M)); K.add('cream', box(0.8, 0.12, 1.9).translate(0, y + 0.1, 0).applyMatrix4(M)); }
  for (const [x, z] of [[-0.42, -0.95], [0.42, -0.95], [-0.42, 0.95], [0.42, 0.95]]) K.add('metal', box(0.06, 1.7, 0.06).translate(x, 0, z).applyMatrix4(M));
}
function roundArchShape(w, h) { const s = new THREE.Shape(), sy = Math.max(0.01, h - w / 2); s.moveTo(-w / 2, 0); s.lineTo(-w / 2, sy); s.absarc(0, sy, w / 2, PI, 0, true); s.lineTo(w / 2, 0); s.closePath(); return s; }
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
// ------------------------------------------------------------------ inside (full size, "bigger on the inside"), far from the model
const PAL0 = V(1000, 0, 0), BEL0 = V(1000, 0, 400);
const Y1 = 4.5, Y2 = 8.2;                                   // the palace's upper floors
// a place to build rooms in: boxes by extents, walls with openings, props placed and turned
function Site(K, O) {
  const P = (x, y, z) => V(O.x + x, O.y + y, O.z + z);
  const bx = (kind, x0, x1, y0, y1, z0, z1) => { [x0, x1] = [Math.min(x0, x1), Math.max(x0, x1)]; [y0, y1] = [Math.min(y0, y1), Math.max(y0, y1)]; [z0, z1] = [Math.min(z0, z1), Math.max(z0, z1)]; if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return; K.add(kind, xf(box(x1 - x0, y1 - y0, z1 - z0), P((x0 + x1) / 2, y0, (z0 + z1) / 2))); };
  // openings: [centre, width, height, bottom above y0]
  const wall = (axis, kind, at, a0, a1, y0, y1, holes = [], t = 0.24) => {
    const hs = holes.map(([c, w, h, b = 0]) => [c - w / 2, c + w / 2, h, b]).sort((p, q) => p[0] - q[0]);
    const seg = (s0, s1, ya, yb) => axis === 'x' ? bx(kind, s0, s1, ya, yb, at - t / 2, at + t / 2) : bx(kind, at - t / 2, at + t / 2, ya, yb, s0, s1);
    let cur = Math.min(a0, a1); const end = Math.max(a0, a1);
    for (const [s0, s1, h, b] of hs) { if (s0 > cur) seg(cur, s0, y0, y1); if (b > 0) seg(s0, s1, y0, y0 + b); if (y0 + b + h < y1) seg(s0, s1, y0 + b + h, y1); cur = s1; }
    if (end > cur) seg(cur, end, y0, y1);
  };
  const wallX = (...a) => wall('x', ...a), wallZ = (...a) => wall('z', ...a);
  // a prop, built in its own frame (origin on the floor, front toward +z), then placed
  const at = (x, y, z, ry = 0, s = 1) => {
    const M = new THREE.Matrix4().compose(P(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V(s, s, s));
    return {
      b: (kind, x0, x1, y0, y1, z0, z1) => { [x0, x1] = [Math.min(x0, x1), Math.max(x0, x1)]; [y0, y1] = [Math.min(y0, y1), Math.max(y0, y1)]; [z0, z1] = [Math.min(z0, z1), Math.max(z0, z1)]; K.add(kind, box(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, y0, (z0 + z1) / 2).applyMatrix4(M)); },
      g: (kind, geo) => K.add(kind, geo.applyMatrix4(M)), M
    };
  };
  return { P, bx, wallX, wallZ, at };
}
// ---- the props
const PR = {
  bed(g, w = 2.2, l = 2.8, frame = 'wood', top = 'fabric2') { g.b(frame, -w / 2, w / 2, 0, 0.45, -l / 2, l / 2); g.b('cream', -w / 2 + 0.06, w / 2 - 0.06, 0.45, 0.72, -l / 2 + 0.1, l / 2 - 0.05); g.b(top, -w / 2 + 0.03, w / 2 - 0.03, 0.72, 0.78, -l / 2 + 1.0, l / 2 - 0.02); g.b(top, -w / 2 + 0.02, w / 2 - 0.02, 0.2, 0.78, l / 2 - 0.05, l / 2 + 0.01); for (const s of [-1, 1]) g.b('cream', s * w / 4 - 0.38, s * w / 4 + 0.38, 0.72, 0.94, -l / 2 + 0.2, -l / 2 + 0.68); g.b(frame, -w / 2 - 0.05, w / 2 + 0.05, 0, 1.8, -l / 2 - 0.14, -l / 2); },
  nightstand(g) { g.b('wood', -0.32, 0.32, 0, 0.62, -0.26, 0.26); g.b('bronze', -0.05, 0.05, 0.62, 0.98, -0.05, 0.05); g.b('glow', -0.17, 0.17, 0.98, 1.22, -0.17, 0.17); },
  chair(g, kind = 'wood', seat = 'fabric2') { g.b(seat, -0.27, 0.27, 0.42, 0.5, -0.25, 0.27); for (const [x, z] of [[-0.23, -0.21], [0.23, -0.21], [-0.23, 0.23], [0.23, 0.23]]) g.b(kind, x - 0.03, x + 0.03, 0, 0.42, z - 0.03, z + 0.03); g.b(kind, -0.27, 0.27, 0.5, 1.15, -0.27, -0.21); },
  table(g, w, d, h = 0.8, kind = 'wood') { g.b(kind, -w / 2, w / 2, h - 0.07, h, -d / 2, d / 2); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.b(kind, x * (w / 2 - 0.1) - 0.05, x * (w / 2 - 0.1) + 0.05, 0, h - 0.07, z * (d / 2 - 0.1) - 0.05, z * (d / 2 - 0.1) + 0.05); },
  sofa(g, w = 2.4, kind = 'fabric') { g.b(kind, -w / 2, w / 2, 0.1, 0.45, -0.45, 0.45); g.b(kind, -w / 2, w / 2, 0.45, 0.95, -0.45, -0.22); for (const s of [-1, 1]) g.b(kind, s * w / 2 - 0.12, s * w / 2 + 0.12, 0.1, 0.7, -0.45, 0.45); g.b('wood', -w / 2, w / 2, 0, 0.1, -0.4, 0.4); },
  armchair(g, kind = 'leather') { PR.sofa(g, 1.0, kind); },
  shelf(g, w = 2, h = 3, r = Math.random) { g.b('wood', -w / 2, w / 2, 0, h, -0.3, -0.24); for (const s of [-1, 1]) g.b('wood', s * w / 2 - 0.05, s * w / 2 + 0.05, 0, h, -0.3, 0.06);
    for (let y = 0.05; y < h - 0.2; y += 0.48) { g.b('wood', -w / 2, w / 2, y, y + 0.04, -0.3, 0.06); let x = -w / 2 + 0.07; while (x < w / 2 - 0.12) { const bw = 0.05 + r() * 0.07, bh = 0.26 + r() * 0.14; if (r() > 0.08) g.b(['b1', 'b2', 'b3', 'b1', 'cream'][Math.floor(r() * 5)], x, x + bw, y + 0.04, y + 0.04 + bh, -0.22, 0.03); x += bw + 0.005; } } },
  rug(g, w, d, kind = 'fabric2') { g.b(kind, -w / 2, w / 2, 0, 0.02, -d / 2, d / 2); g.b('bronze', -w / 2 + 0.12, w / 2 - 0.12, 0.021, 0.026, -d / 2 + 0.12, -d / 2 + 0.18); g.b('bronze', -w / 2 + 0.12, w / 2 - 0.12, 0.021, 0.026, d / 2 - 0.18, d / 2 - 0.12); },
  lamp(g) { g.b('bronze', -0.15, 0.15, 0, 0.04, -0.15, 0.15); g.b('bronze', -0.025, 0.025, 0, 1.55, -0.025, 0.025); g.g('glow', new THREE.CylinderGeometry(0.16, 0.24, 0.3, 12).translate(0, 1.6, 0)); },
  chandelier(g, r = 1.4, drop = 1.6) { g.b('bronze', -0.02, 0.02, -drop, 0, -0.02, 0.02); g.g('bronze', new THREE.TorusGeometry(r, 0.05, 6, 32).rotateX(PI / 2).translate(0, -drop, 0)); g.g('bronze', new THREE.TorusGeometry(r * 0.55, 0.04, 6, 24).rotateX(PI / 2).translate(0, -drop + 0.35, 0)); for (let k = 0; k < 12; k++) { const a = k / 12 * 2 * PI; g.b('glow', Math.cos(a) * r - 0.04, Math.cos(a) * r + 0.04, -drop + 0.05, -drop + 0.22, Math.sin(a) * r - 0.04, Math.sin(a) * r + 0.04); } },
  fireplace(g, w = 2.2, lit = false) { g.b('stone2', -w / 2, w / 2, 0, 1.5, -0.4, 0.1); g.b('black', -w / 2 + 0.35, w / 2 - 0.35, 0.05, 1.05, -0.3, 0.12); g.b('stone', -w / 2 - 0.2, w / 2 + 0.2, 1.5, 1.66, -0.45, 0.25); if (lit) g.b('glow', -w / 2 + 0.5, w / 2 - 0.5, 0.06, 0.4, -0.25, 0.05); else g.b('frost', -w / 2 + 0.4, w / 2 - 0.4, 0.05, 0.08, -0.28, 0.08); },
  tub(g, w = 2.3, d = 1.2) { g.b('black', -w / 2, w / 2, 0, 0.62, -d / 2, d / 2); g.b('ice', -w / 2 + 0.12, w / 2 - 0.12, 0.62, 0.64, -d / 2 + 0.12, d / 2 - 0.12); for (let k = 0; k < 5; k++) g.b('frost', -w / 2 + 0.3 + k * 0.4, -w / 2 + 0.45 + k * 0.4, 0.64, 0.72, -0.2 + (k % 2) * 0.2, 0.0 + (k % 2) * 0.2); },
  vanity(g, w = 2.4, covered = false) { g.b('marble', -w / 2, w / 2, 0.82, 0.9, -0.3, 0.3); g.b('wood', -w / 2, w / 2, 0, 0.82, -0.28, 0.26); for (const s of [-0.5, 0.5]) { g.b('cream', s * w / 2 - 0.25, s * w / 2 + 0.25, 0.9, 0.95, -0.18, 0.12); g.b('bronze', s * w / 2 - 0.02, s * w / 2 + 0.02, 0.9, 1.15, -0.26, -0.2); }
    g.b('bronze', -w / 2, w / 2, 1.2, 2.5, -0.32, -0.28); g.b(covered ? 'fabric' : 'mirror', -w / 2 + 0.08, w / 2 - 0.08, 1.26, 2.44, -0.29, -0.26); if (covered) g.b('fabric', -w / 2 + 0.02, w / 2 - 0.02, 1.0, 2.5, -0.27, -0.2); },
  toilet(g) { g.b('marble', -0.2, 0.2, 0, 0.42, -0.1, 0.3); g.b('marble', -0.24, 0.24, 0.42, 0.46, -0.12, 0.38); g.b('marble', -0.25, 0.25, 0.3, 0.85, -0.32, -0.12); },
  wardrobe(g, w = 1.6, h = 2.4) { g.b('wood', -w / 2, w / 2, 0, h, -0.32, 0.32); g.b('woodL', -0.01, 0.01, 0.1, h - 0.1, 0.32, 0.33); for (const s of [-1, 1]) g.b('bronze', s * 0.08 - 0.02, s * 0.08 + 0.02, h / 2 - 0.15, h / 2 + 0.15, 0.32, 0.36); },
  coats(g, w = 4, cols = ['black', 'fabric2', 'banner', 'leather', 'fabric', 'robe', 'black', 'stone2']) { g.b('bronze', -w / 2, w / 2, 1.95, 2.0, -0.03, 0.03); for (const s of [-1, 1]) g.b('bronze', s * w / 2 - 0.03, s * w / 2 + 0.03, 0, 2.0, -0.03, 0.03);
    const n = cols.length; for (let i = 0; i < n; i++) { const x = -w / 2 + 0.3 + i * (w - 0.6) / (n - 1); g.b(cols[i], x - 0.22, x + 0.22, 0.55 + (i % 3) * 0.08, 1.9, -0.12, 0.12); g.b(cols[i], x - 0.26, x + 0.26, 1.55, 1.9, -0.13, 0.13); g.b('bronze', x - 0.01, x + 0.01, 1.9, 1.98, -0.01, 0.01); } },
  wigs(g, n = 5) { for (let i = 0; i < n; i++) { const x = -((n - 1) * 0.55) / 2 + i * 0.55; g.b('wood', x - 0.03, x + 0.03, 0, 0.35, -0.03, 0.03); g.g('cream', new THREE.SphereGeometry(0.13, 10, 8).scale(0.85, 1.1, 0.95).translate(x, 0.5, 0)); g.g(['black', 'woodL', 'cream', 'leather', 'stone2'][i % 5], new THREE.SphereGeometry(0.15, 10, 8, 0, 2 * PI, 0, PI * (0.45 + 0.12 * (i % 3))).translate(x, 0.53, -0.01)); } },
  masks(g, n = 6) { g.b('wood', -n * 0.3, n * 0.3, 0, 0.9, -0.04, 0); for (let i = 0; i < n; i++) { const x = -n * 0.3 + 0.3 + i * 0.6; g.g(i > n - 3 ? 'stone2' : 'cream', new THREE.SphereGeometry(0.17, 10, 8, 0, PI).scale(0.85, 1.15, 0.45).translate(x, 0.45, 0)); g.b('black', x - 0.08, x - 0.03, 0.5, 0.53, 0.06, 0.09); g.b('black', x + 0.03, x + 0.08, 0.5, 0.53, 0.06, 0.09); } },
  crib(g) { g.b('woodL', -0.55, 0.55, 0.3, 0.38, -0.9, 0.9); g.b('cream', -0.5, 0.5, 0.38, 0.5, -0.85, 0.85); for (let i = 0; i <= 12; i++) { const z = -0.9 + i * 0.15; for (const s of [-1, 1]) g.b('woodL', s * 0.55 - 0.02, s * 0.55 + 0.02, 0.3, 1.05, z - 0.015, z + 0.015); } for (const s of [-1, 1]) { g.b('woodL', -0.57, 0.57, 0.3, 1.05, s * 0.9 - 0.03, s * 0.9 + 0.03); g.b('woodL', s * 0.55 - 0.03, s * 0.55 + 0.03, 1.02, 1.07, -0.9, 0.9); } for (const [x, z] of [[-0.5, -0.85], [0.5, -0.85], [-0.5, 0.85], [0.5, 0.85]]) g.b('woodL', x - 0.03, x + 0.03, 0, 0.3, z - 0.03, z + 0.03); },
  desk(g, w = 1.8) { PR.table(g, w, 0.8, 0.78); g.b('wood', w / 2 - 0.5, w / 2 - 0.08, 0.1, 0.7, -0.35, 0.35); g.b('cream', -0.5, -0.05, 0.78, 0.8, -0.2, 0.15); g.b('cream', 0.0, 0.32, 0.78, 0.81, -0.1, 0.18); g.b('bronze', -0.75, -0.69, 0.78, 1.15, -0.25, -0.19); g.b('glow', -0.86, -0.58, 1.12, 1.26, -0.32, -0.12); },
  clock(g, t = 0) { g.g('bronze', new THREE.CylinderGeometry(0.34, 0.34, 0.06, 24).rotateX(PI / 2).translate(0, 0, 0.03)); g.g('cream', new THREE.CylinderGeometry(0.29, 0.29, 0.02, 24).rotateX(PI / 2).translate(0, 0, 0.065)); const h = new THREE.BoxGeometry(0.025, 0.16, 0.01).translate(0, 0.08, 0.08).rotateZ(-t * PI / 6), m = new THREE.BoxGeometry(0.018, 0.24, 0.01).translate(0, 0.12, 0.085).rotateZ(-t * 2.7); g.g('black', h); g.g('black', m); },
  throne(g) { g.b('black', -0.8, 0.8, 0, 0.6, -0.6, 0.6); g.b('black', -0.6, 0.6, 0.6, 0.65, -0.5, 0.5); g.b('black', -0.8, 0.8, 0, 3.4, -0.75, -0.5); g.b('stone2', -0.85, -0.6, 0, 1.1, -0.6, 0.6); g.b('stone2', 0.6, 0.85, 0, 1.1, -0.6, 0.6); g.b('vglow', -0.04, 0.04, 1.2, 3.2, -0.49, -0.47); g.b('frost', -1.6, 1.6, 0.001, 0.004, -1.2, 1.6); },
  banner(g, h = 3.2) { g.b('bronze', -0.75, 0.75, h + 0.5, h + 0.56, -0.06, 0); g.b('banner', -0.6, 0.6, 0.5, h + 0.5, -0.04, -0.01); g.g('banner', new THREE.ConeGeometry(0.6, 0.5, 3).rotateZ(PI).scale(1, 1, 0.05).translate(0, 0.25, -0.025)); PR.sigil({ b: (k, ...a) => g.b('vglow', a[0] * 0.35, a[1] * 0.35, h * 0.55 + a[2] * 0.35, h * 0.55 + a[3] * 0.35, -0.005, 0.0) }); },
  brazier(g) { for (let k = 0; k < 3; k++) { const a = k * 2 * PI / 3; g.g('metal', new THREE.CylinderGeometry(0.025, 0.025, 1.0, 5).translate(0, 0.5, 0).rotateZ(0.15).rotateY(a).translate(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15)); } g.g('metal', new THREE.CylinderGeometry(0.34, 0.2, 0.22, 16).translate(0, 1.06, 0)); g.g('vglow', new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16).translate(0, 1.15, 0)); },
  sigil(g, kind = 'bronze') { for (const s of [-1, 1]) { g.b(kind, s * 1.1 - 0.1, s * 1.1 + 0.1, -1, 1, 0, 0.03); g.b(kind, s * 1.1 - (s > 0 ? 0.45 : -0.45) - 0.0, s * 1.1, 0.88, 1, 0, 0.03); g.b(kind, s * 1.1 - (s > 0 ? 0.45 : -0.45), s * 1.1, -1, -0.88, 0, 0.03); } g.b(kind, -0.08, 0.08, -0.5, 0.5, 0, 0.03); },
  plant(g, dead = false) { g.g('stone2', new THREE.CylinderGeometry(0.28, 0.2, 0.5, 12).translate(0, 0.25, 0)); g.g(dead ? 'dead' : 'leaf2', new THREE.IcosahedronGeometry(0.45, 0).scale(1, 1.4, 1).translate(0, 1.0, 0)); },
  crate(g, s = 0.8) { g.b('wood', -s / 2, s / 2, 0, s, -s / 2, s / 2); g.b('woodL', -s / 2 - 0.01, s / 2 + 0.01, s * 0.45, s * 0.55, -s / 2 - 0.01, s / 2 + 0.01); },
  cells(g) { PR.crate(g, 0.9); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.g('vglow', new THREE.CylinderGeometry(0.09, 0.09, 0.4, 8).translate(-0.25 + i * 0.25, 1.05, -0.12 + j * 0.24)); },
  weaponRack(g, w = 2.6) { g.b('metal', -w / 2, w / 2, 0, 0.1, -0.25, 0.1); g.b('metal', -w / 2, w / 2, 1.7, 1.78, -0.3, -0.22); for (const s of [-1, 1]) g.b('metal', s * w / 2 - 0.04, s * w / 2 + 0.04, 0, 1.78, -0.3, -0.22);
    for (let i = 0; i < Math.floor(w / 0.32); i++) { const x = -w / 2 + 0.2 + i * 0.32; if (i % 3 === 2) { g.b('metal', x - 0.015, x + 0.015, 0.1, 2.1, -0.08, -0.05); g.b('black', x - 0.04, x + 0.04, 2.1, 2.36, -0.08, -0.05); } else { g.b('black', x - 0.035, x + 0.035, 0.3, 1.55, -0.12, -0.1); g.b('vglow', x - 0.035, x + 0.035, 0.3, 1.55, -0.1, -0.095); g.b('leather', x - 0.02, x + 0.02, 0.1, 0.3, -0.12, -0.09); g.b('metal', x - 0.09, x + 0.09, 0.3, 0.34, -0.13, -0.08); } } },
  bunk(g) { for (const y of [0.35, 1.35]) { g.b('metal', -0.48, 0.48, y, y + 0.08, -1.05, 1.05); g.b('cream', -0.44, 0.44, y + 0.08, y + 0.22, -1.0, 1.0); g.b('fabric', -0.45, 0.45, y + 0.22, y + 0.26, -0.3, 1.0); g.b('cream', -0.3, 0.3, y + 0.22, y + 0.34, -0.95, -0.6); } for (const [x, z] of [[-0.46, -1.03], [0.46, -1.03], [-0.46, 1.03], [0.46, 1.03]]) g.b('metal', x - 0.03, x + 0.03, 0, 1.9, z - 0.03, z + 0.03); },
  locker(g, n = 3) { for (let i = 0; i < n; i++) { const x = -(n - 1) * 0.25 + i * 0.5; g.b('metal', x - 0.24, x + 0.24, 0, 1.9, -0.25, 0.25); g.b('black', x - 0.12, x + 0.12, 1.6, 1.64, 0.25, 0.26); } },
  bench(g, w = 3) { g.b('wood', -w / 2, w / 2, 0.42, 0.48, -0.2, 0.2); for (const s of [-1, 1]) g.b('wood', s * (w / 2 - 0.2) - 0.05, s * (w / 2 - 0.2) + 0.05, 0, 0.42, -0.18, 0.18); },
  counter(g, w = 3, d = 0.7, top = 'marble') { g.b('wood', -w / 2, w / 2, 0, 0.86, -d / 2, d / 2 - 0.04); g.b(top, -w / 2 - 0.02, w / 2 + 0.02, 0.86, 0.92, -d / 2, d / 2 + 0.02); for (let i = 0; i < Math.floor(w / 0.6); i++) g.b('bronze', -w / 2 + 0.3 + i * 0.6 - 0.08, -w / 2 + 0.3 + i * 0.6 + 0.08, 0.7, 0.73, d / 2 - 0.04, d / 2); },
  stove(g) { PR.counter(g, 1.8, 0.8, 'metal'); for (const [x, z] of [[-0.45, -0.15], [0.45, -0.15], [-0.45, 0.2], [0.45, 0.2]]) g.g('black', new THREE.CylinderGeometry(0.15, 0.15, 0.03, 12).translate(x, 0.94, z)); g.g('metal', new THREE.CylinderGeometry(0.2, 0.2, 0.3, 14).translate(-0.45, 1.1, -0.15)); g.g('metal', new THREE.CylinderGeometry(0.16, 0.13, 0.14, 14).translate(0.45, 1.02, 0.2)); g.b('metal', -0.9, 0.9, 1.9, 2.4, -0.45, 0.2); },
  piano(g) { g.g('black', new THREE.ExtrudeGeometry((() => { const s = new THREE.Shape(); s.moveTo(-0.75, 0); s.lineTo(0.75, 0); s.lineTo(0.75, 1.0); s.quadraticCurveTo(0.6, 2.0, -0.2, 2.0); s.quadraticCurveTo(-0.75, 1.6, -0.75, 1.0); s.closePath(); return s; })(), { depth: 0.32, bevelEnabled: false }).rotateX(-PI / 2).translate(0, 0.66, 0.0)); for (const [x, z] of [[-0.6, -0.2], [0.6, -0.2], [0, -1.7]]) g.b('black', x - 0.06, x + 0.06, 0, 0.66, z - 0.06, z + 0.06); g.b('cream', -0.72, 0.72, 0.9, 0.95, 0.0, 0.22); g.b('black', -0.6, 0.6, 0, 0.5, 0.5, 0.85); },
  lectern(g) { g.b('wood', -0.06, 0.06, 0, 1.05, -0.06, 0.06); g.b('wood', -0.3, 0.3, 0, 0.06, -0.25, 0.25); g.g('wood', new THREE.BoxGeometry(0.7, 0.05, 0.5).rotateX(0.35).translate(0, 1.12, 0)); g.g('cream', new THREE.BoxGeometry(0.62, 0.04, 0.42).rotateX(0.35).translate(0, 1.16, 0.0)); for (let k = 0; k < 6; k++) g.g('black', new THREE.BoxGeometry(0.22, 0.005, 0.012).rotateX(0.35).translate(k < 3 ? -0.16 : 0.16, 1.185 - 0.03 * (k % 3) * Math.sin(0.35), -0.1 + (k % 3) * 0.09)); },
  mapTable(g, w = 7, d = 4, r) { PR.table(g, w, d, 0.95, 'stone2'); g.b('black', -w / 2 + 0.1, w / 2 - 0.1, 0.95, 0.97, -d / 2 + 0.1, d / 2 - 0.1);
    const pts = []; for (let i = 0; i < 260; i++) { const a = r() * 2 * PI, rr = Math.sqrt(r()) * 0.92, x = Math.cos(a) * rr * (w / 2 - 0.4), z = Math.sin(a) * rr * (d / 2 - 0.3); const h = 0.02 + r() * 0.12 * (1 - rr); g.b(rr > 0.82 ? 'water' : r() < 0.5 ? 'moss' : 'rock', x - 0.09, x + 0.09, 0.97, 0.97 + h, z - 0.09, z + 0.09); }
    for (let i = 0; i < 12; i++) { const a = r() * 2 * PI, rr = 0.2 + r() * 0.65, p = [Math.cos(a) * rr * (w / 2 - 0.4), Math.sin(a) * rr * (d / 2 - 0.3)]; pts.push(p); g.g(i < 4 ? 'glow' : 'vglow', new THREE.ConeGeometry(0.06, 0.28, 4).translate(p[0], 1.14, p[1])); }
    for (let i = 4; i < 12; i++) { const a = pts[i], b = pts[(i + 1) % 8 + 4]; const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz); g.g('vglow', new THREE.BoxGeometry(0.02, 0.01, len).rotateY(Math.atan2(dx, dz)).translate((a[0] + b[0]) / 2, 1.1, (a[1] + b[1]) / 2)); } },
  figureAt(g, kind = 'robe', s = 1, head) { const parts = []; g.g(kind, new THREE.CylinderGeometry(0.17 * s, 0.25 * s, 0.82 * s, 8).translate(0, 0.41 * s, 0)); g.g(kind, new THREE.CylinderGeometry(0.2 * s, 0.17 * s, 0.2 * s, 8).translate(0, 0.9 * s, 0)); g.g(head || kind, new THREE.SphereGeometry(0.13 * s, 10, 8).translate(0, 1.13 * s, 0)); },
  seated(g, kind = 'robe') { g.g(kind, new THREE.CylinderGeometry(0.17, 0.22, 0.55, 8).translate(0, 0.75, -0.05)); g.g(kind, new THREE.BoxGeometry(0.36, 0.16, 0.45).translate(0, 0.5, 0.15)); g.g(kind, new THREE.SphereGeometry(0.13, 10, 8).translate(0, 1.15, -0.05)); },
  painting(g, w, h, kind = 'stone2') { g.b('bronze', -w / 2 - 0.08, w / 2 + 0.08, -0.08, h + 0.08, 0, 0.05); g.b(kind, -w / 2, w / 2, 0, h, 0.05, 0.07); }
};

function buildPalace(K, ex) {
  const S = Site(K, PAL0), { P, bx, wallX, wallZ, at } = S, r = rng(77);
  const lt = (x, y, z, c, i, d, sc) => ex.lights.push([P(x, y, z), c, i, d, sc]);
  const WARM = '#ffb46a', COLD = '#c8c4ff';
  // ---- shell: floors and ceilings, outer walls
  bx('stone', -22, 22, -0.3, 0, 3, -30);                                   // ground floor (and the porch)
  bx('stone2', -22, -6, 4.2, Y1, 0, -30); bx('stone2', 6, 22, 4.2, Y1, 0, -30); bx('stone2', -6, 6, 4.2, Y1, -11.2, -30);   // the first floor (grand hall stays open to the top)
  // the second floor's ceiling = the top floor's floor, with the stair opening
  bx('stone2', -22, 22, 7.9, Y2, 0, -16.5); bx('stone2', -22, -1.3, 7.9, Y2, -16.5, -30); bx('stone2', 1.3, 22, 7.9, Y2, -16.5, -30); bx('stone2', -1.3, 1.3, 7.9, Y2, -26, -30);
  bx('black', -6, 6, 7.6, 7.9, 0, -11.2);
  wallX('stone', 0, -22, -6, 0, 7.9); wallX('stone', 0, -6, 6, 0, 7.9, [[0, 2.4, 3.4]]); wallX('stone', 0, 6, 22, 0, 7.9);
  wallX('stone', -30, -22, 22, 0, 7.9); wallZ('stone', -22, 0, -30, 0, 7.9); wallZ('stone', 22, 0, -30, 0, 7.9);
  // ---- GROUND
  // grand hall (x -6..6, z 0..-14), two storeys, twin stairs up to a gallery
  wallZ('stone', -6, 0, -14, 0, 7.9, [[-1.3, 1.4, 3.0], [-12.6, 1.4, 3.0, Y1]]);
  wallZ('stone', 6, 0, -14, 0, 7.9, [[-1.0, 1.4, 3.0], [-12.3, 1.4, 3.0, Y1]]);
  wallX('stone', -14, -6, 6, 0, 4.2, [[0, 2.4, 3.2]]); wallX('stone', -14, -6, 6, Y1, 7.9, [[3, 1.6, 3.0]]);
  for (const sx of [-1, 1]) { for (let i = 0; i < 15; i++) { const z0 = -2.2 - i * 0.6; bx('stone', sx * 3.7, sx * 5.3, 0, (i + 1) * 0.3, z0, z0 - 0.62); }
    for (let i = 0; i <= 15; i++) { const z = -2.2 - i * 0.6; bx('bronze', sx * 3.72 - 0.03, sx * 3.72 + 0.03, i * 0.3, i * 0.3 + 1.0, z - 0.03, z + 0.03); }
    const a = P(sx * 3.72, 1.0, -2.2), b = P(sx * 3.72, 4.5 + 1.0, -11.2); tubeSeg(K, 'bronze', a, b, 0.04, 0.04, 6); }
  bx('bronze', -3.7, 3.7, Y1 + 0.95, Y1 + 1.0, -11.25, -11.15); for (let i = 0; i <= 18; i++) bx('bronze', -3.7 + i * 0.41 - 0.025, -3.7 + i * 0.41 + 0.025, Y1, Y1 + 0.95, -11.22, -11.18);
  { const g = at(0, 0.005, -6.5); PR.sigil({ b: (k, x0, x1, y0, y1) => g.b('bronze', x0 * 1.3, x1 * 1.3, 0, 0.012, -y1 * 1.3, -y0 * 1.3) }); }
  PR.rug(at(0, 0, -3.5), 2.0, 6.2, 'banner');
  PR.chandelier(at(0, 7.6, -6.5), 1.8, 1.9);
  PR.piano(at(-2.0, 0, -9.0, 0.5));
  for (const sx of [-1, 1]) { const g = at(sx * 2.4, 0, -13.2); g.b('stone2', -0.45, 0.45, 0, 0.9, -0.45, 0.45); PR.figureAt(at(sx * 2.4, 0.9, -13.2, 0, 1.6), 'stone2', 1, 'stone2'); }
  PR.painting(at(0, 4.6, -13.86), 3.2, 2.6, 'black'); ex.portraitBig = P(0, 5.9, -13.78);
  lt(0, 5.2, -6.5, WARM, 9, 18, 'ground');
  // hall of monarchs (x -22..-6, z 0..-5.5)
  wallX('stone', -5.5, -22, -6, 0, 4.2, [[-20.5, 1.8, 3.0]]);
  bx('black', -22, -6, 3.9, 4.2, 0, -5.5);
  PR.rug(at(-14, 0, -2.75, PI / 2), 1.6, 14.6, 'banner');
  ex.portraits = [];
  const pAt = [[-8.5, 's'], [-8.5, 'n'], [-11.5, 's'], [-11.5, 'n'], [-14.5, 's'], [-14.5, 'n'], [-17.5, 's'], [-17.5, 'n'], [-20.5, 's'], [0, 'e']];
  pAt.forEach(([x, side], i) => {
    const pos = side === 's' ? P(x, 2.35, -0.14) : side === 'n' ? P(x, 2.35, -5.36) : P(-21.86, 2.35, -2.75), ry = side === 's' ? PI : side === 'n' ? 0 : PI / 2;
    ex.portraits.push({ pos, ry, i });
    const g = side === 'e' ? at(-21.88, 1.3, -2.75, PI / 2) : at(x, 1.3, side === 's' ? -0.12 : -5.38, ry); g.b('bronze', -0.8, 0.8, 0, 2.1, -0.03, 0.0); g.b('glow', -0.22, 0.22, 2.35, 2.45, 0.0, 0.12);
  });
  for (let i = 0; i < 6; i++) { const g = at(-7.2 - i * 2.9, 0, -2.75); }
  lt(-10, 3.4, -2.75, WARM, 5, 10, 'ground'); lt(-18, 3.4, -2.75, WARM, 5, 10, 'ground');
  // throne room (x -22..-6, z -5.5..-20)
  wallX('stone', -20, -22, -6, 0, 4.2);
  wallZ('stone', -6, -14, -30, 0, 4.2, [[-17, 1.6, 3.0]]);      // (throne room | map room), (store | map room)
  for (const x of [-18, -10]) for (const z of [-8.5, -12, -15.5]) { bx('stone2', x - 0.4, x + 0.4, 0, 4.2, z - 0.4, z + 0.4); bx('bronze', x - 0.46, x + 0.46, 3.6, 3.75, z - 0.46, z + 0.46); }
  for (let s = 0; s < 3; s++) bx('stone', -16.2 + s * 0.3, -11.8 - s * 0.3, 0, 0.2 * (s + 1), -17 - s * 0.35, -20);
  PR.throne(at(-14, 0.6, -19.0)); PR.sigil({ b: (k, x0, x1, y0, y1, z0, z1) => at(-14, 2.9, -19.86).b('bronze', x0 * 0.9, x1 * 0.9, y0 * 0.9, y1 * 0.9, 0, 0.04) });
  for (const z of [-8, -11.5, -15]) { PR.banner(at(-21.86, 0.2, z, PI / 2)); PR.banner(at(-6.14, 0.2, z, -PI / 2)); }
  for (const x of [-15.8, -12.2]) PR.brazier(at(x, 0, -16.3));
  for (const x of [-16.6, -11.4]) PR.figureAt(at(x, 0, -17.8, 0, 1.05), 'robe', 1, 'black');
  for (const [x0] of [[-17], [-12.8]]) for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { const g = at(x0 + i * 0.68 + 0.3, 0, -9.2 - j * 1.4); g.b('banner', -0.24, 0.24, 0, 0.14, -0.24, 0.24); }
  lt(-14, 3.6, -11, '#b9a8ff', 6, 14, 'ground'); lt(-14, 2.4, -17.5, WARM, 4, 7, 'ground');
  // map room / war room (x -6..6, z -14..-30): the table of the world, the ledgers, the lift down
  PR.mapTable(at(0, 0, -22), 7, 4, r);
  for (const [x, z, ry] of [[-2, -19.5, PI], [0, -19.5, PI], [2, -19.5, PI], [-2, -24.5, 0], [0, -24.5, 0], [2, -24.5, 0], [-4.1, -22, PI / 2]]) PR.chair(at(x, 0, z, ry), 'wood', 'leather');
  for (let i = 0; i < 5; i++) PR.shelf(at(-5.86, 0, -19.4 - i * 2.05, PI / 2), 2.0, 3.6, r);
  ex.screens = [[P(0, 1.2, -29.85), 7.5, 2.4]];
  bx('metal', -3.9, 3.9, 1.1, 3.7, -29.9, -29.8);
  { const g = at(4.7, 0, -28.6); g.b('metal', -0.95, 0.95, 0, 4.2, -1.0, -0.9); g.b('metal', -1.0, -0.9, 0, 4.2, -1.0, 1.0); g.b('metal', 0.9, 1.0, 0, 4.2, -1.0, 1.0); g.b('vglow', -0.7, 0.7, 2.6, 2.7, 0.95, 1.0); g.b('glass', -0.9, 0.9, 0, 2.5, 0.95, 1.0); }
  lt(0, 3.6, -22, COLD, 6, 14, 'ground'); lt(0, 3.6, -16, WARM, 3, 8, 'ground');
  // library (x 6..22, z -21..-30): the Ledgers of Intervals
  wallX('stone', -21, 6, 22, 0, 4.2, [[18, 1.6, 3.0]]);
  for (let i = 0; i < 7; i++) PR.shelf(at(7.2 + i * 2.2, 0, -29.86), 2.1, 3.9, r);
  for (let i = 0; i < 4; i++) PR.shelf(at(21.86, 0, -22.2 - i * 2.0, -PI / 2), 1.9, 3.9, r);
  for (const z of [-22.6, -27.8]) PR.shelf(at(6.14, 0, z, PI / 2), 2.2, 3.9, r);
  PR.table(at(14, 0, -25.6), 4, 1.6, 0.8); for (const x of [12.6, 14, 15.4]) { PR.chair(at(x, 0, -24.4, PI)); PR.chair(at(x, 0, -26.8, 0)); }
  for (let i = 0; i < 6; i++) at(12.4 + i * 0.6, 0.8, -25.6 + (i % 2) * 0.3).b(i % 2 ? 'cream' : 'b2', -0.2, 0.2, 0, 0.06 + (i % 3) * 0.04, -0.15, 0.15);
  PR.lectern(at(10.4, 0, -27.2, 0.3)); PR.rug(at(19.4, 0, -26.8), 3.2, 3.2); PR.armchair(at(18.6, 0, -27.4, 0.5)); PR.armchair(at(20.4, 0, -25.8, -2.2)); PR.lamp(at(20.6, 0, -28.8));
  { const g = at(9.0, 0, -28.8); for (let k = 0; k < 9; k++) g.b('wood', -0.22, 0.22, k * 0.42 + 0.3, k * 0.42 + 0.34, 0.25, 0.3); for (const s of [-1, 1]) g.g('wood', new THREE.BoxGeometry(0.05, 4.0, 0.05).rotateX(-0.12).translate(s * 0.22, 2.0, 0.15)); }
  lt(14, 3.6, -25.5, WARM, 6, 12, 'ground');
  // kitchen (x 6..22, z -11..-21) and the powder room
  wallX('stone', -11, 6, 22, 0, 4.2, [[18, 1.6, 3.0]]);
  wallZ('stone', 9.5, -17, -21, 0, 4.2, [[-19, 1.0, 2.6]]); wallX('stone', -17, 6, 9.5, 0, 4.2);
  for (let i = 0; i < 3; i++) PR.counter(at(21.5, 0, -12.6 - i * 2.4, -PI / 2), 2.3); PR.stove(at(21.45, 0, -19.4, -PI / 2));
  PR.counter(at(13, 0, -16, 0), 4.2, 1.4); at(13, 0.92, -16).b('wood', -0.9, -0.2, 0, 0.05, -0.3, 0.3);
  for (let i = 0; i < 5; i++) at(11.4 + i * 0.8, 3.0, -16).g('metal', new THREE.CylinderGeometry(0.16, 0.12, 0.12, 12).translate(0, -0.4, 0));
  at(13, 3.6, -16).b('metal', -2.2, 2.2, 0, 0.05, -0.05, 0.05);
  PR.shelf(at(11, 0, -11.14, PI), 3.0, 2.6, r); for (let i = 0; i < 4; i++) PR.crate(at(11.2 + i * 0.9, 0, -20.4), 0.7);
  PR.figureAt(at(14.2, 0, -14.4, PI * 0.9), 'cream', 1, 'figure');
  PR.toilet(at(7.0, 0, -20.6)); PR.vanity(at(7.8, 0, -17.2, PI), 1.2);
  lt(14, 3.6, -16, WARM, 5, 12, 'ground');
  // dining (x 6..22, z 0..-11): a table for twenty, set for two
  PR.rug(at(14, 0, -5.5), 13.6, 3.8);
  PR.table(at(14, 0, -5.5), 11.6, 1.6, 0.8);
  for (let i = 0; i < 7; i++) { const x = 9 + i * 1.65; PR.chair(at(x, 0, -4.3, PI), 'wood', 'banner'); PR.chair(at(x, 0, -6.7, 0), 'wood', 'banner'); }
  PR.chair(at(20.3, 0, -5.5, -PI / 2), 'black', 'banner'); PR.chair(at(7.7, 0, -5.5, PI / 2), 'wood', 'banner');
  for (const [x] of [[19.3], [8.7]]) { const g = at(x, 0.8, -5.5); g.g('cream', new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16)); g.g('bronze', new THREE.CylinderGeometry(0.035, 0.03, 0.22, 8).translate(0.3, 0.11, -0.25)); }
  for (let i = 0; i < 4; i++) { const g = at(10.5 + i * 2.4, 0.8, -5.5); g.g('bronze', new THREE.CylinderGeometry(0.06, 0.08, 0.3, 8).translate(0, 0.15, 0)); for (const dx of [-0.12, 0, 0.12]) g.b('cream', dx - 0.02, dx + 0.02, 0.3, 0.48, -0.02, 0.02); g.b('glow', -0.14, 0.14, 0.48, 0.55, -0.02, 0.02); }
  PR.chandelier(at(11, 4.2, -5.5), 1.1, 1.2); PR.chandelier(at(17, 4.2, -5.5), 1.1, 1.2);
  PR.fireplace(at(21.86, 0, -5.5, -PI / 2), 2.2, true); PR.counter(at(14, 0, -10.6, 0), 5.0, 0.6, 'stone2');
  for (const x of [9, 12, 16, 19]) bx('glow', x - 0.6, x + 0.6, 0.9, 3.4, -0.13, -0.12);
  lt(14, 3.4, -5.5, WARM, 7, 14, 'ground');
  // the porch outside the door
  for (const sx of [-1, 1]) { bx('stone2', sx * 2.2 - 0.3, sx * 2.2 + 0.3, 0, 4.4, 2.4, 1.8); PR.brazier(at(sx * 1.6, 0, 2.2)); }

  // ---- FIRST FLOOR (y 4.5): west, the master's rooms; east, the bedrooms
  wallZ('stone', -6, -14, -30, Y1, 7.9); wallZ('stone', 6, -14, -30, Y1, 7.9);
  wallX('stone', -11, -22, -6, Y1, 7.9, [[-10, 1.6, 3.0]]); wallZ('stone', -14, -11, -20, Y1, 7.9, [[-16, 1.2, 2.8]]); wallX('stone', -20, -22, -6, Y1, 7.9);
  // the dressing room (x -14..-6, z -11..-20): how one man passes for ten generations
  PR.coats(at(-10, Y1, -19.6), 6.6); PR.rug(at(-10, Y1, -15.5), 4.4, 5.0, 'fabric');
  { const g = at(-13.5, Y1, -12.9, PI / 2); PR.table(g, 2.4, 0.7, 0.85); PR.wigs(at(-13.5, Y1 + 0.85, -12.9, PI / 2), 4); }
  PR.vanity(at(-13.6, Y1, -18.0, PI / 2), 1.6); for (let k = 0; k < 6; k++) at(-13.68, Y1, -17.3 - k * 0.28, PI / 2).b('glow', -0.04, 0.04, 2.55, 2.63, 0.0, 0.05);
  at(-13.3, Y1, -18.0, PI / 2).b('cream', -0.5, 0.5, 0.9, 0.93, -0.1, 0.2);
  PR.masks(at(-12.0, Y1 + 1.7, -11.14, PI), 5); PR.chair(at(-12.8, Y1, -18.0, -PI / 2), 'black', 'leather');
  { const g = at(-6.8, Y1, -16.6, -PI / 2); g.b('bronze', -0.5, 0.5, 0, 0.06, -0.2, 0.2); g.b('bronze', -0.45, 0.45, 0.06, 2.1, -0.05, 0.0); g.b('mirror', -0.4, 0.4, 0.12, 2.04, 0.0, 0.02); }
  lt(-10, 7.2, -15.5, WARM, 5, 10, 'west');
  // the master bath (x -22..-14, z -11..-20): ice in a black tub, the mirror covered
  bx('marble', -22, -14, Y1, Y1 + 0.01, -11, -20); PR.tub(at(-19.6, Y1, -18.5)); PR.vanity(at(-18.5, Y1, -11.4, PI), 2.6, true); PR.toilet(at(-21.4, Y1, -14.5, PI / 2));
  bx('glass', -16.2, -16.15, Y1, Y1 + 2.4, -17.6, -20); bx('marble', -16.2, -14.2, Y1, Y1 + 0.08, -17.6, -20); at(-15.2, Y1 + 2.3, -18.8).g('metal', new THREE.CylinderGeometry(0.2, 0.2, 0.04, 14));
  at(-19.6, Y1, -16.2).b('frost', -1.6, 1.6, 0.012, 0.016, -1.2, 1.2); lt(-18, 7.2, -15.5, COLD, 4, 9, 'west');
  // the master bedroom (x -22..-6, z 0..-11): a stone bed, a cold hearth
  PR.bed(at(-20.3, Y1, -5.5, PI / 2), 2.6, 3.0, 'black', 'banner'); at(-20.0, Y1 + 0.78, -5.5).b('frost', -1.0, 1.0, 0, 0.01, -1.1, 1.1);
  PR.nightstand(at(-21.5, Y1, -3.2, PI / 2)); PR.nightstand(at(-21.5, Y1, -7.8, PI / 2));
  PR.fireplace(at(-6.14, Y1, -5.5, -PI / 2), 2.4, false); PR.rug(at(-9.4, Y1, -5.5), 3.6, 4.4); PR.sofa(at(-9.6, Y1, -5.5, PI / 2), 2.6, 'fabric2'); PR.armchair(at(-7.8, Y1, -3.4, PI)); PR.armchair(at(-7.8, Y1, -7.6, 0));
  PR.desk(at(-14.2, Y1, -0.75, PI)); PR.chair(at(-14.2, Y1, -1.6, 0), 'black', 'leather'); PR.wardrobe(at(-17.4, Y1, -10.55, 0), 2.0, 2.6); PR.wardrobe(at(-12.4, Y1, -10.55, 0), 2.0, 2.6);
  for (const x of [-19, -16, -10]) bx('glow', x - 0.55, x + 0.55, Y1 + 0.6, Y1 + 3.0, -0.13, -0.12);
  lt(-14, 7.3, -5.5, '#9fb0ff', 6, 14, 'west');
  // east corridor and rooms
  wallX('stone', -11, 6, 22, Y1, 7.9, [[10, 1.4, 3.0], [18, 1.4, 3.0]]); wallX('stone', -13.5, 6, 22, Y1, 7.9, [[9, 1.2, 3.0], [14, 1.2, 3.0], [19, 1.2, 3.0]]);
  wallZ('stone', 14, 0, -11, Y1, 7.9); wallZ('stone', 12, -13.5, -22, Y1, 7.9); wallZ('stone', 16, -13.5, -22, Y1, 7.9); wallX('stone', -22, 6, 22, Y1, 7.9);
  PR.rug(at(14, Y1, -12.25, PI / 2), 1.2, 15.2, 'banner'); for (const x of [9, 13, 17, 21]) PR.painting(at(x, Y1 + 1.4, -13.36), 1.4, 1.0, 'fabric2');
  lt(14, 7.2, -12.25, WARM, 3, 9, 'east');
  // Vale's room (x 6..14, z 0..-11): kept ready for someone who hasn't come yet
  PR.bed(at(7.6, Y1, -4.5, PI / 2), 2.0, 2.6, 'woodL', 'fabric'); PR.nightstand(at(6.6, Y1, -2.2, PI / 2));
  PR.desk(at(13.4, Y1, -3.4, -PI / 2)); PR.chair(at(12.6, Y1, -3.4, PI / 2), 'woodL', 'fabric');
  for (let k = 0; k < 5; k++) at(13.2, Y1 + 0.81, -3.0 - k * 0.12, -PI / 2).b('cream', -0.12, 0.12, k * 0.006, k * 0.006 + 0.005, -0.08, 0.08);
  PR.chair(at(10.5, Y1, -1.0, 0), 'woodL', 'fabric'); PR.wardrobe(at(12.8, Y1, -10.55), 1.6, 2.3); PR.rug(at(10, Y1, -5), 3.0, 3.6, 'fabric');
  PR.shelf(at(7.9, Y1, -10.86), 2.2, 2.2, r);
  bx('glow', 9.6, 11.4, Y1 + 0.6, Y1 + 3.0, -0.13, -0.12);
  lt(10, 7.2, -5.5, WARM, 4, 10, 'east');
  // the nursery (x 14..22, z 0..-11): for the next Monarch
  PR.crib(at(20.4, Y1, -3.2, -PI / 2)); at(20.4, Y1 + 2.4, -3.2).g('bronze', new THREE.TorusGeometry(0.4, 0.02, 4, 20).rotateX(PI / 2)); for (let k = 0; k < 5; k++) { const a = k / 5 * 2 * PI; at(20.4 + Math.cos(a) * 0.4, Y1 + 2.0, -3.2 + Math.sin(a) * 0.4).g(k % 2 ? 'vglow' : 'cream', new THREE.OctahedronGeometry(0.08)); }
  { const g = at(16.6, Y1, -2.6, 0.6); PR.chair(g, 'woodL', 'fabric'); g.b('woodL', -0.3, 0.3, 0, 0.04, -0.5, 0.5); }
  for (let k = 0; k < 7; k++) at(17.8 + (k % 3) * 0.3, Y1, -6 - Math.floor(k / 3) * 0.3, k).b(['banner', 'cream', 'woodL', 'vglow'][k % 4], -0.08, 0.08, 0, 0.16, -0.08, 0.08);
  PR.rug(at(18, Y1, -5.5), 4, 4, 'cream'); PR.wardrobe(at(15.3, Y1, -10.55), 1.2, 1.8);
  { const g = at(21.2, Y1, -9.5); g.b('bronze', -0.03, 0.03, 0, 1.3, -0.03, 0.03); g.b('bronze', -0.25, 0.25, 0, 0.04, -0.25, 0.25); g.b('black', -0.18, 0.18, 0.6, 1.25, -0.08, 0.08); g.b('black', -0.22, 0.22, 1.05, 1.25, -0.09, 0.09); }
  bx('glow', 17.4, 18.6, Y1 + 0.6, Y1 + 3.0, -0.13, -0.12);
  lt(18, 7.2, -5.5, '#ffd4a0', 4, 10, 'east');
  // guest rooms and their bath
  PR.bed(at(9, Y1, -19.8, 0), 2.0, 2.6); PR.wardrobe(at(6.5, Y1, -15.5, PI / 2), 1.4); PR.bed(at(19, Y1, -19.8, 0), 2.0, 2.6); PR.wardrobe(at(21.5, Y1, -15.5, -PI / 2), 1.4);
  PR.tub(at(14, Y1, -21.2), 2.0, 1.0); PR.vanity(at(14, Y1, -14.0, PI), 1.6); PR.toilet(at(12.5, Y1, -18, PI / 2));
  // the stair hall in the middle (x -6..6, z -14..-30): the clocks
  for (let i = 0; i < 12; i++) { const s_ = i % 2 ? 1 : -1, z = -15.6 - Math.floor(i / 2) * 2.0; PR.clock(at(s_ * 5.87, Y1 + 1.6 + (i % 3) * 0.6, z, -s_ * PI / 2), i * 1.7 + 0.4); }
  for (let i = 0; i < 4; i++) PR.clock(at(-3.2 + i * 2.1, Y1 + 1.8 + (i % 2) * 0.5, -29.86), i * 2.9 + 1);
  { const g = at(-3.6, Y1, -27.6); g.b('wood', -0.35, 0.35, 0, 2.6, -0.25, 0.25); g.b('cream', -0.2, 0.2, 1.9, 2.3, 0.25, 0.27); g.b('bronze', -0.02, 0.02, 0.6, 1.6, 0.25, 0.27); }
  for (let i = 0; i < 12; i++) { const z0 = -26 + i * 0.79; bx('stone', -1.2, 1.2, Y1, Y1 + (i + 1) * 0.308, z0, z0 + 0.8); }
  for (const sx of [-1, 1]) tubeSeg(K, 'bronze', P(sx * 1.22, Y1 + 1.0, -26), P(sx * 1.22, Y2 + 1.0, -16.5), 0.035, 0.035, 6);
  lt(0, 7.2, -21, WARM, 4, 12, 'top');

  // ---- TOP FLOOR (y 8.2)
  wallX('stone', 0, -16, -9, Y2, 11.9); wallX('stone', 0, 9, 16, Y2, 11.9);
  wallZ('stone', -16, 0, -26, Y2, 11.9); wallZ('stone', 16, 0, -26, Y2, 11.9); wallX('stone', -26, -16, 16, Y2, 11.9);
  wallZ('stone', -9, 0, -13, Y2, 18.2); wallZ('stone', 9, 0, -13, Y2, 18.2);
  wallX('stone', -13, -16, -9, Y2, 11.9, [[-12.5, 1.4, 3.0]]); wallX('stone', -13, -9, 9, Y2, 18.2, [[0, 2.4, 3.4]]); wallX('stone', -13, 9, 16, Y2, 11.9, [[12.5, 1.4, 3.0]]);
  wallX('stone', -17.5, -16, -1.3, Y2, 11.9, [[-12.5, 1.2, 2.8]]); wallX('stone', -17.5, 1.3, 16, Y2, 11.9); wallZ('stone', -1.3, -17.5, -26, Y2, 11.9); wallZ('stone', 1.3, -17.5, -26, Y2, 11.9);
  bx('stone2', -16, -9, 11.9, 12.2, 0, -26); bx('stone2', 9, 16, 11.9, 12.2, 0, -26); bx('stone2', -9, 9, 11.9, 12.2, -13, -26); bx('black', -9, 9, 18.2, 18.5, 0, -13);
  for (const sx of [-1, 1]) tubeSeg(K, 'bronze', P(sx * 1.25, Y2 + 0.95, -16.5), P(sx * 1.25, Y2 + 0.95, -13.2), 0.03, 0.03, 5);
  // the great window (south): onto the lake, the station and the far steps of the Hollow
  { const sh = new THREE.Shape(); sh.moveTo(-9, 0); sh.lineTo(9, 0); sh.lineTo(9, 10); sh.lineTo(-9, 10); sh.closePath();
    const hole = new THREE.Path(); hole.moveTo(-5.5, 0.6); hole.lineTo(5.5, 0.6); hole.lineTo(5.5, 4.2); hole.absarc(0, 4.2, 5.5, 0, PI, false); hole.lineTo(-5.5, 0.6); sh.holes.push(hole);
    K.add('stone', new THREE.ShapeGeometry(sh, 32).rotateY(PI).translate(PAL0.x, PAL0.y + Y2, PAL0.z - 0.12)); K.add('stone', new THREE.ShapeGeometry(sh, 32).translate(PAL0.x, PAL0.y + Y2, PAL0.z + 0.12));
    K.add('black', new THREE.TorusGeometry(5.5, 0.2, 6, 48, PI).translate(PAL0.x, PAL0.y + Y2 + 4.2, PAL0.z));
    for (const x of [-5.5, -2.75, 0, 2.75, 5.5]) { const top = 4.2 + Math.sqrt(Math.max(0, 30.25 - x * x)); bx('black', x - 0.15, x + 0.15, Y2 + 0.6, Y2 + top, -0.2, 0.2); }
    for (const y of [2.4, 4.2, 6.8]) { const half = y <= 4.2 ? 5.5 : Math.sqrt(30.25 - (y - 4.2) ** 2); bx('black', -half, half, Y2 + y - 0.1, Y2 + y + 0.1, -0.2, 0.2); }
    bx('black', -5.7, 5.7, Y2, Y2 + 0.6, -0.3, 0.3); }
  // the window hall (x -9..9, z 0..-13): low seats facing the glass, a scope, a fire in the wall, Val
  PR.rug(at(0, Y2, -6.5), 9, 7, 'fabric'); PR.sofa(at(-2.4, Y2, -7.2), 3.0, 'fabric'); PR.sofa(at(2.4, Y2, -7.2), 3.0, 'fabric'); PR.table(at(0, Y2, -5.6), 2.2, 1.0, 0.4, 'stone2');
  PR.fireplace(at(-8.86, Y2, -6.5, PI / 2), 2.6, true); PR.shelf(at(8.86, Y2, -6.5, -PI / 2), 3.0, 3.6, r);
  { const g = at(4.0, Y2, -1.4, 0.4); for (let k = 0; k < 3; k++) g.g('bronze', new THREE.CylinderGeometry(0.02, 0.02, 1.3, 5).translate(0, 0.65, 0).rotateZ(0.25).rotateY(k * 2.09)); g.g('bronze', new THREE.CylinderGeometry(0.09, 0.14, 1.4, 12).rotateX(-1.1).translate(0, 1.5, 0.2)); }
  PR.plant(at(-7.5, Y2, -1.2), true); PR.plant(at(7.5, Y2, -11.8), true);
  lt(-7.4, Y2 + 1.4, -6.5, '#ff9a4a', 5, 10, 'top'); lt(0, Y2 + 7, -7, COLD, 6, 22, 'top');
  const vp = P(0.4, Y2, -1.6);
  figure(K, 'figure', vp, 0, 1.0, 'val');
  K.add('val', xf(box(0.13, 0.3, 0.13), { x: vp.x - 0.27, y: vp.y + 0.42, z: vp.z })); K.add('val', xf(box(0.12, 0.25, 0.12), { x: vp.x + 0.27, y: vp.y + 0.5, z: vp.z }));
  K.add('frost', new THREE.CircleGeometry(1.4, 32).rotateX(-PI / 2).translate(vp.x, vp.y + 0.01, vp.z));
  ex.valIn = vp;
  // the study (x -16..-9, z 0..-13): two chairs facing each other; one is for Vale
  PR.rug(at(-12.5, Y2, -6), 3.6, 4.2, 'banner'); PR.armchair(at(-12.5, Y2, -4.6, PI), 'leather'); PR.armchair(at(-12.5, Y2, -7.4, 0), 'black'); at(-12.5, Y2 + 0.45, -7.4).b('frost', -0.55, 0.55, 0.5, 0.52, -0.4, 0.4);
  PR.table(at(-12.5, Y2, -6, 0), 0.8, 0.8, 0.55, 'stone2'); at(-12.5, Y2 + 0.55, -5.75).g('cream', new THREE.CylinderGeometry(0.06, 0.05, 0.08, 10)); at(-12.5, Y2 + 0.55, -6.25).g('cream', new THREE.CylinderGeometry(0.06, 0.05, 0.08, 10));
  for (let i = 0; i < 5; i++) PR.clock(at(-15.0 + i * 1.25, Y2 + 2.2 + (i % 2) * 0.5, -0.14, PI), i * 2.3 + 0.7);
  for (let i = 0; i < 3; i++) PR.shelf(at(-15.86, Y2, -3 - i * 2.6, PI / 2), 2.4, 3.2, r);
  PR.desk(at(-10.0, Y2, -11.6, 0.0)); PR.chair(at(-10.0, Y2, -10.8, PI), 'black', 'leather');
  lt(-12.5, Y2 + 3, -6, WARM, 4, 9, 'top');
  // the regression chamber (x 9..16, z 0..-13): a round room eaten black, one chair bolted in the middle
  { const c = P(12.5, Y2, -5.6), RC = 3.3;
    K.add('black', inward(new THREE.CylinderGeometry(RC, RC, 3.7, 40, 1, true, PI + 0.42, 2 * PI - 0.84)).translate(c.x, c.y + 1.85, c.z));
    K.add('black', new THREE.CircleGeometry(RC, 40).rotateX(PI / 2).translate(c.x, c.y + 3.69, c.z)); K.add('concreteD', new THREE.CircleGeometry(RC, 40).rotateX(-PI / 2).translate(c.x, c.y + 0.01, c.z));
    for (let k = 0; k < 9; k++) { const a = r() * 2 * PI, rr = 0.8 + r() * 2.2; K.add('val', new THREE.CircleGeometry(0.2 + r() * 0.5, 10).rotateX(-PI / 2).translate(c.x + Math.cos(a) * rr, c.y + 0.02, c.z + Math.sin(a) * rr)); }
    for (let k = 0; k < 6; k++) { const a = r() * 2 * PI; K.add('vglow', xf(box(0.04, 0.6 + r() * 1.6, 0.03), { x: c.x + Math.cos(a) * (RC - 0.03), y: c.y + 0.3 + r(), z: c.z + Math.sin(a) * (RC - 0.03), ry: PI / 2 - a, rz: r() - 0.5 })); }
    K.add('frost', new THREE.RingGeometry(0.4, 1.3, 32).rotateX(-PI / 2).translate(c.x, c.y + 0.03, c.z));
    const g = at(12.5, Y2, -5.6, PI); g.b('metal', -0.3, 0.3, 0.45, 0.52, -0.3, 0.3); g.b('metal', -0.3, 0.3, 0.52, 1.4, -0.32, -0.26); for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) g.b('metal', x - 0.04, x + 0.04, 0, 0.45, z - 0.04, z + 0.04); g.b('metal', -0.45, 0.45, 0, 0.04, -0.45, 0.45);
    for (const s of [-1, 1]) g.b('leather', s * 0.3 - 0.05, s * 0.3 + 0.05, 0.62, 0.68, -0.15, 0.25);
    bx('concreteD', 11.9 - 0.2, 11.9, Y2, 11.9, -8.6, -13); bx('concreteD', 13.1, 13.3, Y2, 11.9, -8.6, -13);
    lt(12.5, Y2 + 3, -5.6, '#b9a8ff', 3, 7, 'top'); }
  // outside the great window: the lake, the island, the station, the far wall with its lights, the sky
  K.add('water', new THREE.PlaneGeometry(220, 200).rotateX(-PI / 2).translate(PAL0.x, -0.6, PAL0.z + 104));
  K.add('concrete', xf(cyl(10, 11, 1.0, 40), P(0, -1.2, 62)));
  { const SPb = (x, y, z) => P(x, -0.2 + y, 62 + z); const st = station(K, SPb, 6, 20, 14.5, 0.7); ex.bigTip = { p: SPb(0, st.top + 1.2, 0), r: st.sc * Math.SQRT2, h: 20 - 14.5 }; }
  { const c = P(0, 0, 40); for (let w = 0; w < 4; w++) { const rr = 120 + w * 12, y0 = w * 14 - 6; K.add('black', inward(new THREE.CylinderGeometry(rr, rr, 14, 64, 1, true, -0.95, 1.9)).translate(c.x, y0 + 7, c.z)); K.add('paving', new THREE.RingGeometry(rr, rr + 12, 64, 1, -PI / 2 - 0.95, 1.9).rotateX(-PI / 2).translate(c.x, y0 + 14, c.z));
    for (let k = 0; k < 120; k++) { const a = -0.9 + r() * 1.8, y = y0 + 1 + r() * 11; K.add(r() < 0.25 ? 'vglow' : 'glow', xf(box(0.9 + r() * 1.6, 0.5, 0.2), { x: c.x + Math.sin(a) * (rr - 0.5), y, z: c.z + Math.cos(a) * (rr - 0.5), ry: a })); } } }
  K.add('sky', new THREE.PlaneGeometry(900, 420).rotateY(PI).translate(PAL0.x, 150, PAL0.z + 260));
}

function buildBelow(K, ex) {
  const S = Site(K, BEL0), { P, bx, wallX, wallZ, at } = S, r = rng(99);
  const lt = (x, y, z, c, i, d) => ex.lights.push([P(x, y, z), c, i, d, 'below']);
  // the lift and the ribbed tunnel (z 2.5..-12)
  bx('concrete', -2, 2, -0.3, 0, 2.6, -12); bx('metal', -1.3, 1.3, 0, 0.05, 2.4, 0.2); bx('vglow', -1.3, 1.3, 0.05, 0.07, 0.25, 0.2); bx('ribs', -2, 2, 0, 3.4, 2.6, 2.3);
  for (let i = 0; i < 23; i++) { const z = 1.5 - i * 0.6; K.add('ribs', new THREE.TorusGeometry(1.75, 0.2, 8, 20, PI).translate(BEL0.x, BEL0.y, BEL0.z + z)); K.add('vglow', new THREE.TorusGeometry(1.52, 0.015, 4, 20, PI).translate(BEL0.x, BEL0.y, BEL0.z + z - 0.3)); }
  lt(0, 2.8, -5, '#a8b8ff', 4, 10);
  // the barracks hall (x -8..8, z -12..-28)
  bx('concrete', -8, 8, -0.3, 0, -12, -28); bx('concreteD', -8, 8, 4.5, 4.8, -12, -28);
  wallX('concrete', -12, -8, 8, 0, 4.5, [[0, 3.2, 3.2]]); wallZ('concrete', -8, -12, -28, 0, 4.5); wallZ('concrete', 8, -12, -28, 0, 4.5);
  for (let i = 0; i < 7; i++) { const z = -13.6 - i * 2.0; for (const sx of [-1, 1]) { PR.bunk(at(sx * 6.4, 0, z, PI / 2)); PR.locker(at(sx * 7.6, 0, z - 0.9, -sx * PI / 2), 1); PR.crate(at(sx * 4.95, 0, z, 0), 0.5); } }
  for (const [x, z, ry] of [[-5.6, -15.6, PI / 2], [6.2, -19.6, -PI / 2], [-6.2, -23.6, PI / 2]]) PR.seated(at(x, 0, z, ry));
  PR.figureAt(at(1.8, 0, -21, -2.2), 'robe', 1, 'figure'); PR.figureAt(at(-1.4, 0, -26, 0.3), 'robe', 1, 'figure');
  for (const z of [-14, -20, -26]) { bx('metal', -0.02, 0.02, 3.6, 4.5, z - 0.02, z + 0.02); at(0, 3.6, z).g('glow', new THREE.ConeGeometry(0.35, 0.3, 12, 1, true).rotateX(PI).translate(0, 0, 0)); }
  lt(0, 3.6, -16, '#ffc890', 5, 12); lt(0, 3.6, -24, '#ffc890', 5, 12);
  // the mess (x -8..8, z -28..-40)
  bx('concrete', -8, 8, -0.3, 0, -28, -40); bx('concreteD', -8, 8, 4.5, 4.8, -28, -40);
  wallX('concrete', -28, -8, 8, 0, 4.5, [[0, 3.2, 3.2]]); wallZ('concrete', -8, -28, -40, 0, 4.5); wallZ('concrete', 8, -28, -40, 0, 4.5);
  for (const sx of [-1, 1]) { PR.table(at(sx * 4.4, 0, -34, PI / 2), 9, 1.2, 0.78); PR.bench(at(sx * 4.4 - 0.95, 0, -34, PI / 2), 9); PR.bench(at(sx * 4.4 + 0.95, 0, -34, PI / 2), 9);
    for (let k = 0; k < 8; k++) at(sx * 4.4 + (k % 2 ? 0.35 : -0.35), 0.78, -30.4 - k * 1.0).g('cream', new THREE.CylinderGeometry(0.15, 0.12, 0.08, 10)); }
  for (const [x, z, ry] of [[-5.35, -31.4, PI / 2], [-3.45, -33.2, -PI / 2], [-5.35, -36, PI / 2], [3.45, -32, PI / 2], [5.35, -35.4, -PI / 2], [3.45, -37.2, PI / 2]]) PR.seated(at(x, 0, z, ry));
  PR.counter(at(-5.4, 0, -39.4, PI), 4.0, 0.8, 'metal'); for (let k = 0; k < 3; k++) at(-6.6 + k * 1.1, 0.92, -39.4).g('metal', new THREE.CylinderGeometry(0.22, 0.18, 0.3, 12)); PR.figureAt(at(-5.4, 0, -39.9, 0), 'cream', 1, 'figure');
  bx('glow', -7.86, -7.84, 1.0, 3.0, -30, -38); lt(0, 3.6, -34, '#ffc890', 6, 14);
  // the armoury (x -6..6, z -40..-50)
  bx('concrete', -6, 6, -0.3, 0, -40, -50); bx('concreteD', -6, 6, 4.0, 4.3, -40, -50);
  wallX('concrete', -40, -8, 8, 0, 4.5, [[0, 2.4, 3.0]]); wallZ('concrete', -6, -40, -50, 0, 4.0); wallZ('concrete', 6, -40, -50, 0, 4.0); wallX('concrete', -50, -6, 6, 0, 4.0, [[0, 2.4, 3.0]]);
  for (let i = 0; i < 3; i++) { PR.weaponRack(at(-5.86, 0, -41.8 - i * 2.9, PI / 2), 2.6); PR.weaponRack(at(5.86, 0, -41.8 - i * 2.9, -PI / 2), 2.6); }
  for (let i = 0; i < 6; i++) PR.cells(at(-3.6 + (i % 3) * 1.0, 0, -46.5 - Math.floor(i / 3) * 1.0, r()));
  PR.table(at(2.4, 0, -44, 0), 2.4, 1.0, 0.9, 'metal'); for (let k = 0; k < 4; k++) at(1.6 + k * 0.5, 0.9, -44).b(k % 2 ? 'black' : 'metal', -0.15, 0.15, 0, 0.05, -0.2, 0.2);
  PR.figureAt(at(2.4, 0, -45, 0), 'figure', 1, 'figure'); at(2.6, 0.95, -44.7).b('val', -0.08, 0.08, 0, 0.06, -0.1, 0.1);
  lt(0, 3.4, -45, '#c8c4ff', 5, 10);
  // the corridor and the gifting chamber (centre z -60, radius 8)
  bx('concrete', -1.6, 1.6, -0.3, 0, -50, -52.4); wallZ('concrete', -1.6, -50, -52.2, 0, 3.4); wallZ('concrete', 1.6, -50, -52.2, 0, 3.4); bx('concreteD', -1.6, 1.6, 3.4, 3.6, -50, -52.2);
  const CC = P(0, 0, -60), RC = 8;
  K.add('concrete', new THREE.CircleGeometry(RC, 64).rotateX(-PI / 2).translate(CC.x, 0, CC.z));
  const GAP = 0.22;
  for (const [t0, tl] of [[GAP, PI - 2 * GAP], [PI + GAP, PI - 2 * GAP]]) {
    for (let b = 0; b < 9; b++) { const y = 0.3 + b * 0.75; K.add('ribs', inward(new THREE.CylinderGeometry(RC, RC, 0.58, 32, 1, true, t0, tl)).translate(CC.x, y + 0.29, CC.z)); K.add('vglow', inward(new THREE.CylinderGeometry(RC + 0.08, RC + 0.08, 0.17, 32, 1, true, t0, tl)).translate(CC.x, y + 0.665, CC.z)); }
    K.add('ribs', inward(new THREE.CylinderGeometry(RC, RC, 0.3, 32, 1, true, t0, tl)).translate(CC.x, 0.15, CC.z)); }
  K.add('ribs', inward(new THREE.SphereGeometry(RC, 48, 16, 0, 2 * PI, 0, PI / 2)).scale(1, 0.55, 1).translate(CC.x, 7.05, CC.z));
  K.add('black', new THREE.SphereGeometry(2.0, 32, 16, 0, 2 * PI, PI / 2, PI / 2).translate(CC.x, 10.0, CC.z)); K.add('vglow', new THREE.TorusGeometry(2.02, 0.05, 4, 48).rotateX(PI / 2).translate(CC.x, 10.0, CC.z));
  K.add('concreteD', xf(cyl(2.3, 2.5, 0.35, 48), CC)); K.add('vglow', new THREE.TorusGeometry(2.4, 0.04, 4, 64).rotateX(PI / 2).translate(CC.x, 0.36, CC.z));
  figure(K, 'figure', V(CC.x, 0.0, CC.z), PI, 0.85);
  for (const sx of [-1, 1]) K.add('val', xf(box(0.1, 0.08, 0.32), { x: CC.x + sx * 0.18, y: 0.5, z: CC.z - 0.2 }));
  for (const th of [-0.5, PI / 2, PI + 0.95, 3 * PI / 2 + 0.3]) figure(K, 'robe', V(CC.x + Math.cos(th) * 3.6, 0, CC.z + Math.sin(th) * 3.6), Math.atan2(-Math.cos(th), -Math.sin(th)), 1.05);
  // witnesses' benches round the wall, a font of black water, robes on a rail
  for (let k = 0; k < 10; k++) { const th = 0.45 + k * 0.26 + (k >= 5 ? PI - 1.3 + 0.0 : 0); const a = k < 5 ? 0.5 + k * 0.42 : PI + 0.5 + (k - 5) * 0.42; PR.bench(at(Math.sin(a) * (RC - 0.9), 0, -60 + Math.cos(a) * (RC - 0.9), a + PI), 1.8); }
  for (const [x, z] of [[-5.2, -62.6], [4.9, -57.0]]) { at(x, 0, z).g('stone2', new THREE.CylinderGeometry(0.55, 0.4, 0.9, 16).translate(0, 0.45, 0)); at(x, 0.9, z).g('val', new THREE.CylinderGeometry(0.48, 0.48, 0.02, 16)); }
  PR.coats(at(5.6, 0, -62.8, -2.2), 2.6, ['robe', 'robe', 'robe', 'robe', 'robe']);
  lt(0, 3, -54, '#a8b8ff', 4, 10); lt(0, 5, -60, '#b9a8ff', 7, 20);
  // the gate hall (x -5..5, z -68..-88)
  bx('concrete', -5, 5, -0.3, 0, -67.6, -88); bx('concrete', -5, 5, 6, 6.3, -67.6, -88);
  wallZ('concrete', -5, -67.6, -88, 0, 6); wallZ('concrete', 5, -67.6, -88, 0, 6); wallX('concrete', -88, -5, 5, 0, 6);
  wallX('ribs', -67.7, -5, 5, 0, 6, [[0, 3.2, 3.2]]);
  const gateAt = (x, z, ry, w, h) => {
    const fr = new THREE.Group(); const g = makeGate(w, h, x * 1.7 + z * 0.3); g.position.set(0, h / 2 + 0.25, 0); fr.add(g);
    fr.position.copy(P(x, 0, z)); fr.rotation.y = ry; ex.add.push(fr);
    const T = new THREE.Matrix4().compose(P(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V(1, 1, 1));
    for (const [gx, gy, gz, gw, gh_, gd] of [[-w / 2 - 0.2, 0, 0, 0.35, h + 0.6, 0.6], [w / 2 + 0.2, 0, 0, 0.35, h + 0.6, 0.6], [0, h + 0.35, 0, w + 0.75, 0.3, 0.6]]) K.add('concrete', box(gw, gh_, gd).translate(gx, gy, gz - 0.25).applyMatrix4(T));
  };
  gateAt(-4.6, -73, PI / 2, 1.8, 3.0); gateAt(-4.6, -80, PI / 2, 1.8, 3.0); gateAt(4.6, -76.5, -PI / 2, 1.8, 3.0); gateAt(0, -87.6, 0, 2.4, 4.0);
  for (let i = 0; i < 7; i++) bx('vglow', -0.05, 0.05, 0.0, 0.015, -69 - i * 2.6, -70.6 - i * 2.6);
  // the gatekeeper's desk, consoles, crates, travellers waiting with packs, guards
  { const g = at(3.4, 0, -70.5, -PI / 2); PR.counter(g, 2.4, 0.8, 'metal'); at(3.6, 0.92, -70.5, -PI / 2).g('vglow', new THREE.BoxGeometry(0.9, 0.5, 0.04).rotateX(-0.3).translate(0, 0.3, 0)); PR.chair(at(4.3, 0, -70.5, -PI / 2), 'metal', 'leather'); PR.seated(at(4.3, 0, -70.5, -PI / 2), 'robe'); }
  for (let i = 0; i < 8; i++) PR.crate(at(-3.6 + (i % 2) * 0.85, 0, -83 - Math.floor(i / 2) * 0.85 + (i > 3 ? 0 : 0), 0.2), 0.75);
  for (const [x, z, ry] of [[-1.6, -76, 0.6], [-2.2, -77, 0.4], [1.8, -81.5, -0.6], [2.6, -82.4, -0.3]]) { PR.figureAt(at(x, 0, z, ry), 'robe', 1, 'figure'); at(x, 0.5, z + 0.2, ry).b('leather', -0.2, 0.2, 0, 0.45, 0, 0.25); }
  for (const x of [-2.6, 2.6]) PR.figureAt(at(x, 0, -86.4, PI), 'figure', 1.05, 'black');
  lt(0, 4.5, -77, '#9b8cff', 6, 18);
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
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1600);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = true;
controls.minZoom = 0.5; controls.maxZoom = 8; controls.maxPolarAngle = 1.45;
controls.autoRotate = !reduceMotion; controls.autoRotateSpeed = 0.35;
controls.addEventListener('start', () => { controls.autoRotate = false; });
const hemi = new THREE.HemisphereLight('#fff', '#000', 1);
const key = new THREE.DirectionalLight('#fff', 2); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -72, right: 72, top: 72, bottom: -72, near: 1, far: 320 }); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.09;
key.position.set(72, 96, 28);
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
    sand: std(th.sand, { roughness: 1 }), frost: basic(crt ? '#7f93bf' : th.frost, crt ? 0.85 : 1), glow: basic(th.glow, crt ? 1.45 : 1), vglow: basic(th.vglow, crt ? 1.4 : 0.9),
    metal: std(th.metal, { roughness: 0.4, metalness: 0.75, flatShading: false }), figure: std(th.figure, { roughness: 0.7 }), robe: std(th.robe, { roughness: 0.9 }),
    val: basic('#000000'), wood: std(th.wood, { roughness: 0.7 }), woodL: std(th.woodL, { roughness: 0.65 }), cream: std(th.cream, { roughness: 0.9 }), fabric2: std(th.fabric2, { roughness: 1 }), banner: std(th.banner, { roughness: 1 }), leather: std(th.leather, { roughness: 0.6 }),
    b1: std(th.b1), b2: std(th.b2), b3: std(th.b3), marble: std(th.marble, { roughness: 0.25 }), mirror: std(th.mirror, { roughness: 0.05, metalness: 0.9 }), ice: std(th.ice, { roughness: 0.1, metalness: 0.2 }), dead: std(th.dead, { roughness: 1 }), sky: Object.assign(basic(crt ? '#c9c4e0' : '#e9e6f2', crt ? 1.1 : 1), { fog: false }), fabric: std(th.fabric, { roughness: 1 }), ribs: std(th.ribs, { roughness: 0.45, metalness: 0.3 }), bronze: std(th.bronze, { roughness: 0.4, metalness: 0.7 }),
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
  beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.24, 30, 12, 1, true).translate(0, 15, 0), bm); beam.position.copy(extra.capTip.p).add(V(0, extra.capTip.h, 0)); modelRoot.add(beam);
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mats.vglow); modelRoot.add(p); pulses.push({ m: p, from: beam.position.clone().add(V(0, 26, 0)), to: beam.position.clone(), ph: i / 4, k: 0.25 }); }
  extra.relays.forEach((r, i) => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mats.vglow); modelRoot.add(p); pulses.push({ m: p, from: V(LAKE.x, PF + 0.6, LAKE.z), to: V(r.x, PF + 0.6, r.z), ph: i / 6, k: 0.4 }); });
  // the masts' lamps blink
  extra.masts.forEach(p => modelRoot.add(mast(new Kit(), p, 8)));
  // Val: black dust lifting off him, then gone
  valDust = makeDust(extra.valP, 70, 0.9); modelRoot.add(valDust);

  // inside (full size): only shown while you walk
  const KI = new Kit(), ex2 = { add: [], lights: [] }; buildPalace(KI, ex2); buildBelow(KI, ex2);
  for (const [k, g] of Object.entries(KI.merge())) {
    const m = new THREE.Mesh(g, mats[k]);
    if (!noOutline.has(k)) { m.receiveShadow = true; const o = new THREE.Mesh(hullOf(g), outlineMaterial(th.ink, th.outlinePx)); o.raycast = () => {}; m.add(o); }
    fpGroup.add(m);
  }
  ex2.add.forEach(o => fpGroup.add(o));
  fpGroup.add(tip(ex2.bigTip));
  for (const [p, c, i, d, sc] of ex2.lights) { const l = new THREE.PointLight(c, i, d, 1.2); l.position.copy(p); l.userData.sc = sc; l.visible = false; fpGroup.add(l); roomLights.push(l); }
  // the portraits (ten Monarchs, one face), the Monarch over the grand hall's far door, the war room's screens
  for (const { pos, ry, i } of ex2.portraits) { const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.9), new THREE.MeshStandardMaterial({ map: portraitTex(i, 10, MONARCHS[i][0], MONARCHS[i][1]), roughness: 0.8 })); pm.position.copy(pos); pm.rotation.y = ry; fpGroup.add(pm); }
  { const pm = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 2.5), new THREE.MeshStandardMaterial({ map: portraitTex(9, 10, 'VAL', 'THE MONARCH'), roughness: 0.8 })); pm.position.copy(ex2.portraitBig); fpGroup.add(pm); }
  for (const [p, w, h] of ex2.screens) { const sm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: screenTex() })); sm.position.copy(p).add(V(0, h / 2, 0)); fpGroup.add(sm); }
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
const CELLS = 120, CELL = 2 * R / CELLS;
function heightPass() {
  const N = CELLS, rt = new THREE.WebGLRenderTarget(N, N, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const hs = new THREE.Scene(), cam = new THREE.OrthographicCamera(-R, R, R, -R, 1, 300);
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
    val: '#120e1c', fabric: '#6a6280', ribs: '#4a4366', bronze: '#c9a25a', dead: '#2a2436', wood: '#7a5a48', cream: '#e8e0d0' },
  paper: { moss: '#8fbf7a', leaf: '#5fae7c', leaf2: '#7cc48a', trunk: '#9a6a44', soil: '#c9a27a', soil2: '#b08a66', rock: '#b1a7bf', concrete: '#e2dfe9', concreteD: '#c9c4d6', paving: '#b7b2c6',
    black: '#4b4270', stone: '#5c5088', stone2: '#6d6196', water: '#6f74d8', sand: '#f6e6c4', frost: '#ffffff', glow: '#ffb45a', vglow: '#8f7cf0', metal: '#a9a6bd', figure: '#5a5078', robe: '#7a6e9a',
    val: '#1c1830', fabric: '#9a93ae', ribs: '#6e6690', bronze: '#d8b066', dead: '#4a4458', wood: '#a87a58', cream: '#fff6e6' }
};
const GLOWY = new Set(['glow', 'vglow', 'frost']);
const CONCEPTS = { crt: { nothing: '#8a5cff', story: '#f2b53a', reality: '#e0402e', imagination: '#ff7ac8' }, paper: { nothing: '#6a4ad8', story: '#d99a1e', reality: '#c8321f', imagination: '#e65aa8' } };
const extraState = {};
function buildBlocks(cells, th) {
  const crt = state.theme === 'crt', pal = BLOCK_COL[state.theme], N = CELLS, grid = new Array(N * N).fill(null);
  // THE NARRATIVE VIEW: the place as it is written, the way the Scribe sees it (the same rules on every site).
  //   colour  = which concept soaks the place: Nothing (Sils) purple, Story (Antholonious) gold, Reality (Lithia) red, Imagination (Moinera) pink
  //   height  = the place itself, raised by how much story has been written there
  //   black   = erased: the writing is gone.  blank (no colour, no ink) = unwritten: the Fallen
  const CC = CONCEPTS[state.theme], gauss = (x, z, cx, cz, rr) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * rr * rr));
  const u = atA(SECM, 1), inCut = (x, z) => inSec(angOf(x, z)) && Math.hypot(x, z) > RP;
  const conceptAt = (x, z) => {
    const rr = Math.hypot(x, z), out = smooth(RP, RP + 6, rr);
    const w = { nothing: 0.9 * (1 - out) + 0.08 * out + (inCut(x, z) ? 0.8 : 0), story: 3.2 * gauss(x, z, 0, -20, 6.5) + 0.35 * gauss(x, z, ARENA.x, ARENA.z, 6) + 0.25 * gauss(x, z, 0, 18, 5), reality: 1.1 * out * (inCut(x, z) ? 0.2 : 1) + 0.04, imagination: 0.03 + 0.25 * gauss(x, z, 10, -16, 3) };
    const c = new THREE.Color(0, 0, 0); let ws = 0; for (const k in w) { c.add(new THREE.Color(CC[k]).multiplyScalar(w[k])); ws += w[k]; } return c.multiplyScalar(1 / ws);
  };
  const STORY = [[0, -20, 6.0, 5], [LAKE.x, LAKE.z, 4.0, 3.2], [ARENA.x, ARENA.z, 2.4, 5], [0, 19, 1.2, 4], [u.x * 52, u.z * 52, 3.4, 4.5], [u.x * 46, u.z * 46, 2.6, 5]];
  const storyAt = (x, z) => STORY.reduce((a, [cx, cz, hgt, rr]) => a + hgt * gauss(x, z, cx, cz, rr), 0) + (nearStair(x, z, 0.6) ? 1.0 : 0);
  const ev = extraState.valP, er = rng(31);
  for (const c of cells) {
    const base = new THREE.Color(pal[c.kind] || pal.rock), glowy = GLOWY.has(c.kind);
    let col = glowy ? base.clone() : base.clone().lerp(conceptAt(c.x, c.z), 0.86);
    let h = c.y - BASE + (c.y > PF - 0.5 || inCut(c.x, c.z) ? storyAt(c.x, c.z) : 0);
    const dv = ev ? Math.hypot(c.x - ev.x, c.z - ev.z) : 99, onWall = WALLS.some(w => Math.abs(Math.hypot(c.x, c.z) - w) < 0.9);
    let erased = false;
    if (dv < 2.4) { erased = true; h = h * (0.45 + 0.2 * dv / 2.4); }                   // Val: half of him is missing from the page
    else if ((onWall && er() < 0.07) || (dv < 6 && er() < 0.25)) { erased = true; h *= 0.8; }
    if (erased) col = new THREE.Color(crt ? '#06040c' : '#1a1626');
    grid[c.j * N + c.i] = { ...c, col, glowy: glowy || erased, h: Math.round(h / 0.2) * 0.2 };
  }
  // blur the colours across neighbours (glowing cells keep theirs), so the blocks melt into each other
  for (let pass = 0; pass < 2; pass++) { const next = grid.map(g => g && g.col.clone());
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const g = grid[j * N + i]; if (!g || g.glowy) continue; const acc = new THREE.Color(0, 0, 0); let n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const h = grid[(j + dj) * N + (i + di)]; if (!h || h.glowy || i + di < 0 || i + di >= N) continue; acc.add(h.col); n++; }
      next[j * N + i] = acc.multiplyScalar(1 / n).lerp(g.col, 0.35); }
    grid.forEach((g, k) => { if (g) g.col = next[k]; }); }
  const list = grid.filter(Boolean), H0 = CELL * 0.34;
  const geo = new RoundedBoxGeometry(CELL * 0.93, H0, CELL * 0.93, 1, CELL * 0.16);
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
  const w = innerWidth, h = innerHeight, a = w / h, half = (a < 1 ? 66 / a : 60);
  camera.left = -half * a; camera.right = half * a; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
  fpCam.aspect = a; fpCam.updateProjectionMatrix();
  renderer.setSize(w, h, false); composer.setSize(w, h); drawRes.set(w, h);
}
camera.position.set(120, 96, 132); controls.target.set(2, -10, 4); camera.zoom = 1.05; camera.updateProjectionMatrix();
if (q.get('view') === 'below') { camera.position.set(130, 10, 110); controls.target.set(36, -18, 36); camera.zoom = 2.2; camera.updateProjectionMatrix(); controls.autoRotate = false; }
if (q.get('view') === 'palace') { camera.position.set(20, 10, 90); controls.target.set(0, -18, -14); camera.zoom = 2.6; camera.updateProjectionMatrix(); controls.autoRotate = false; }
addEventListener('resize', resize);
function note() {
  if (state.style === 'blocks') { const C = CONCEPTS[state.theme], sw = c => `<i style="display:inline-block;width:10px;height:10px;margin-right:6px;vertical-align:-1px;background:${c}"></i>`;
    $('note').innerHTML = `<h2>The Narrative view</h2>The place as it is <b>written</b>, the way the Scribe sees it. The same rules hold on every site.<br>${sw(C.nothing)}<b>Nothing</b> (Sils) · ${sw(C.story)}<b>Story</b> (Antholonious)<br>${sw(C.reality)}<b>Reality</b> (Lithia) · ${sw(C.imagination)}<b>Imagination</b> (Moinera)<br><b>Height</b>: how much story is written there. <b>Black</b>: erased. <b>Blank</b>: unwritten (the Fallen).<br>Here: the Hollow is soaked in Nothing; a thread of Story runs through Val's palace, and half of Val is missing from the page.`; return; }
  $('note').innerHTML = '<h2>The Hollow Reach · capital of the Voided</h2>Central Germany, deep in the forested uplands. A round pit with <b>smooth black walls</b>, open to the sky: the city is built down into it and dug in behind it. On its floor, beside a still lake, the black palace of <b>Val</b>, the Monarch, the first Voided. The capital\'s <b>station</b> stands on an island in the lake. Under the forest: the <b>gate hall</b> and the <b>gifting chamber</b>, where Val seals erasure into the people who will serve him.';
}
function seg(id, fn) { $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; [...$(id).children].forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset.v); }); }
seg('styleSeg', v => { state.style = v; applyStyle(); note(); });
seg('themeSeg', v => { state.theme = v; document.body.classList.toggle('paper', v === 'paper'); build(); });
seg('tagSeg', v => { state.showTags = v === 'on'; });

// ------------------------------------------------------------------ the walk (on rails, as in Aurelia)
const lantern = new THREE.PointLight('#c9b8ff', 0, 9, 1.3); scene.add(lantern);
scene.fog = new THREE.FogExp2('#06040b', 0);
const fp = { on: false, scenes: null, sc: null, s: 0, sT: 0, yawOff: 0, pitchOff: 0, dist: 0, busy: false, si: 0 };
const held = {};
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
const STOPS = {
  gate: { t: 'The gatehouse', d: 'A concrete portal in the middle of the forest, over a stair going down. From here you can see the far side of the Hollow, and nothing else gives it away.' },
  descent: { t: 'The Descent', d: 'The stair cuts straight down through every step of the Hollow, under tall fins that lean out over it. The light comes in between them in slices.' },
  hives: { t: 'The hives', d: 'On every step, housing blocks stand against the black wall, floor on floor, lit windows in rows. Tens of thousands of Voided live down here, below the treetops.' },
  yard: { t: 'The yard', d: 'Ranks drilling on the floor of the Hollow. The ones with blackened hands have been given erasure. It doesn\'t hurt them; it doesn\'t feel at all.' },
  station: { t: 'The station', d: 'The capital\'s station, on an island in the lake: a split black pyramid that draws power out of the air. Six relays round the shore store it. The stations answer only to the thread of Val\'s curse that every Voided carries.' },
  palace: { t: 'Val\'s palace', d: 'Black stone on three floors beside the water. High up on the balcony, a man stands looking out over the lake. Where he stands, the stone is frosted white.' },
  hall: { t: 'The grand hall', d: 'Two storeys of black stone, twin stairs, a chandelier, a piano no one has heard played. Over the far door, a portrait of the Monarch.' },
  monarchs: { t: 'The Hall of Monarchs', d: 'The Monarchs of the Hollow Reach, generation after generation, father to son. Valen, Valerius, Valdis, Valarious…' },
  faces: { t: 'The same face', d: 'Look closer. It\'s the same face in every frame, only the hair and the clothes change. And the newer the portrait, the more of it is painted black.' },
  last: { t: 'Val', d: 'At the end of the hall, the current Monarch: the most black of all. Val, who was once called Interval.' },
  throne: { t: 'The throne room', d: 'Where the upper ranks kneel. The throne is cold black stone, and the floor round it is frosted: he has sat here today. Behind it, his sign: two brackets round a line, an interval.' },
  war: { t: 'The war room', d: 'A table carved into the world as the Voided know it: the island and its sea, every station, every gate, the Storyborn settlements marked in gold. Along the wall, ledgers.' },
  ledgers: { t: 'The Ledgers of Intervals', d: 'Histories, shelf on shelf. Foresight let him reach back and change what happened, and he wrote down every version. Whole pages are crossed out, and some of them are in a younger hand.' },
  kitchen: { t: 'The kitchen', d: 'It works like any great house\'s kitchen. The cooks never touch his plate barehanded; it comes back cold.' },
  dining: { t: 'A table for twenty', d: 'Set for two: one place at the head, one at the far end. Nobody sits in the second chair. The candles are lit anyway.' },
  dressing: { t: 'The dressing room', d: 'How one man passes for ten generations. A coat for every Monarch, wigs on stands, faces moulded to look older. Every time he regresses too far, a new "son" comes out of this room.' },
  bath: { t: 'The covered mirror', d: 'Ice in a black tub; he runs cold. The mirror over the basins is covered with a cloth.' },
  bedroom: { t: 'His bed', d: 'Stone, made up with heavy cloth, frosted where he lies. The hearth is cold and has been for years.' },
  vale: { t: 'Kept for Vale', d: 'A bedroom made up for someone who hasn\'t arrived. Letters on the desk, every one addressed to Vale. A chair turned to face the window.' },
  nursery: { t: 'The nursery', d: 'A crib, a mobile, a child\'s coat on a stand, for the next Monarch. There\'s never been a child here. When the time comes, Val will be young enough to fill it.' },
  clocks: { t: 'The clocks', d: 'Every clock on this stair is set to a different time. He was the god of foresight; he still reads time as if it runs more than one way.' },
  study: { t: 'Two chairs', d: 'His study. Two chairs face each other across a small table, two cups. One chair is frosted. The other is where Vale sits when Val reaches him, a hundred years back, through who he used to be.' },
  regress: { t: 'The regression chamber', d: 'A round room eaten black, a steel chair bolted to the floor. Here he pushes the curse back into his past self, and comes out a little younger every time.' },
  window: { t: 'The window hall', d: 'The top of the palace: a great arched window onto the lake, the station and the lit steps of the Hollow. Low seats, a fire, a brass scope pointed at the sky.' },
  val: { t: 'The Monarch', d: 'He doesn\'t turn round. Black spreads over his hands and the back of his neck, and it\'s cold to the touch. Black dust lifts off him and disappears.' },
  tunnel: { t: 'Below', d: 'A lift down out of the palace, then a tunnel ribbed like the inside of something alive. Thin violet light between the ribs.' },
  barracks: { t: 'The barracks', d: 'Bunks in rows, a locker each, a crate at every foot. People off watch sit on their bunks. Most of the city lives like this.' },
  mess: { t: 'The mess', d: 'Long tables, benches, bowls. The food is plain. Those with gifted hands eat with spoons, carefully.' },
  armoury: { t: 'The armoury', d: 'Racks of black blades edged with void light, spears, power cells in crates. A smith is fitting a blade for someone whose hands can\'t feel it.' },
  chamber: { t: 'The gifting chamber', d: 'A round room banded with light, benches for witnesses, a black eye hanging from the dome. Here Val seals erasure into the people who will serve him.' },
  gifted: { t: 'Gifted', d: 'Their hands go black and stop feeling pain. They can\'t wield erasure: to destroy something they have to touch it and move their hands across it. But now the stations answer them.' },
  gates: { t: 'The gate hall', d: 'Void gates held open in concrete frames, a keeper at a desk, travellers waiting with packs. Through each crack, somewhere very far away.' },
  lastgate: { t: 'The great gate', d: 'The widest crack, at the end of the hall. The Voided cross without harm. For anyone else, it hurts.' }
};
function makeScenes() {
  const E = EYE, SY = z => stairY(z) + E;
  const descent = makeScene('descent', [
    { p: V(0, gh(0, 59.5) + E, 59.5), look: V(0, -14, 10), stop: STOPS.gate, chap: 'Descent' },
    { p: V(0, SY(56), 56) },
    { p: V(0.2, SY(50), 50), stop: STOPS.descent },
    { p: V(0, SY(44), 44) },
    { p: V(0, SY(37.5), 37.5) },
    { p: V(0, SY(32), 32) },
    { p: V(0, PF + E, 27.5), look: V(-24, -9, -12), stop: STOPS.hives },
    { p: V(-7.8, PF + E, 21), look: V(-1, PF + 0.6, 19), stop: STOPS.yard },
    { p: V(-1.2, PF + 0.3 + E, 13.2) },
    { p: V(0, PF + 0.3 + E, 9.5) },
    { p: V(2.6, PF + 0.6 + E, 5.6) },
    { p: V(3.9, PF + 0.6 + E, 2.6), look: V(0, PF + 4, 2), stop: STOPS.station },
    { p: V(2.6, PF + 0.6 + E, -1.4) },
    { p: V(0, PF + 0.3 + E, -5.5) },
    { p: V(0, PF + E, -10.5), look: V(0, PF + 8.6, -16), stop: STOPS.palace },
    { p: V(0, PF + 0.7 + E, -15.6), look: V(0, PF + 2.6, -17) }
  ]);
  const P = (x, y, z) => V(PAL0.x + x, PAL0.y + y + E, PAL0.z + z), u = 0.4;
  const ground = makeScene('ground', [
    { p: P(0, 0, 2.6), ug: u, chap: 'Palace' },
    { p: P(0, 0, -0.9), look: P(0, 3, -12), ug: u, stop: STOPS.hall },
    { p: P(-2.4, 0, -1.3), ug: u }, { p: P(-6, 0, -1.3), ug: u },
    { p: P(-8.2, 0, -2.75), look: P(-21, 0.6, -2.75), ug: u, stop: STOPS.monarchs },
    { p: P(-12.3, 0, -2.75), look: P(-11.5, 1.25, -5.36), ug: u, stop: STOPS.faces },
    { p: P(-16, 0, -2.75), ug: u },
    { p: P(-19.4, 0, -2.75), look: P(-21.86, 1.25, -2.75), ug: u, stop: STOPS.last },
    { p: P(-20.5, 0, -4.4), ug: u }, { p: P(-20.5, 0, -6.2), ug: u }, { p: P(-18.4, 0, -7.7), ug: u }, { p: P(-14, 0, -8.6), ug: u },
    { p: P(-14, 0, -14.4), look: P(-14, 0.8, -19), ug: u, stop: STOPS.throne },
    { p: P(-8.4, 0, -14.1), ug: u }, { p: P(-7.2, 0, -16.5), ug: u }, { p: P(-5.2, 0, -17.2), ug: u },
    { p: P(-2.8, 0, -17.6), look: P(0, 0, -22), ug: u, stop: STOPS.war },
    { p: P(4.5, 0, -18.4), ug: u }, { p: P(4.6, 0, -24.5), ug: u }, { p: P(7.4, 0, -25), ug: u },
    { p: P(11.4, 0, -23.6), look: P(10.4, 0.2, -27.2), ug: u, stop: STOPS.ledgers },
    { p: P(17.4, 0, -22.4), ug: u }, { p: P(18, 0, -20.2), ug: u },
    { p: P(18, 0, -16.2), look: P(13, 0.2, -16), ug: u, stop: STOPS.kitchen },
    { p: P(18, 0, -11.4), ug: u }, { p: P(17.6, 0, -9.4), ug: u }, { p: P(14, 0, -8.3), ug: u }, { p: P(8.4, 0, -8.1), ug: u }, { p: P(6.9, 0, -6.2), ug: u },
    { p: P(7.6, 0, -2.2), look: P(14, -0.2, -5.5), ug: u, stop: STOPS.dining },
    { p: P(6, 0, -1.0), ug: u }, { p: P(4.5, 0, -1.3), ug: u }, { p: P(4.5, 0, -2.1), ug: u },
    { p: P(4.5, Y1, -11.2), ug: u }, { p: P(4.2, Y1, -12.6), ug: u }
  ]);
  const west = makeScene('west', [
    { p: P(3.5, Y1, -12.6), ug: u, chap: 'Master\'s rooms' },
    { p: P(-4.8, Y1, -12.6), ug: u }, { p: P(-6.2, Y1, -12.6), ug: u }, { p: P(-7.8, Y1, -13.6), ug: u },
    { p: P(-9.4, Y1, -15.2), look: P(-10, Y1 + 0.3, -19.6), ug: u, stop: STOPS.dressing },
    { p: P(-12.6, Y1, -16), ug: u }, { p: P(-14.2, Y1, -16), ug: u },
    { p: P(-15.5, Y1, -15.4), look: P(-18.5, Y1 + 0.6, -11.4), ug: u, stop: STOPS.bath },
    { p: P(-13.4, Y1, -14.6), ug: u }, { p: P(-10.6, Y1, -12.6), ug: u }, { p: P(-10, Y1, -11), ug: u }, { p: P(-10.3, Y1, -9.4), ug: u },
    { p: P(-12.8, Y1, -8.2), look: P(-20, Y1 - 0.2, -5.5), ug: u, stop: STOPS.bedroom },
    { p: P(-13.6, Y1, -7.6), look: P(-20, Y1 - 0.2, -5.5), ug: u }
  ]);
  const east = makeScene('east', [
    { p: P(3.5, Y1, -12.6), ug: u, chap: 'Bedrooms' },
    { p: P(6, Y1, -12.3), ug: u }, { p: P(8.6, Y1, -12.2), ug: u }, { p: P(10, Y1, -11), ug: u }, { p: P(10, Y1, -9.2), ug: u },
    { p: P(10.4, Y1, -7.8), look: P(13, Y1 - 0.2, -3.4), ug: u, stop: STOPS.vale },
    { p: P(10.1, Y1, -10.2), ug: u }, { p: P(10.4, Y1, -12.0), ug: u }, { p: P(17.6, Y1, -12.2), ug: u }, { p: P(18, Y1, -11), ug: u },
    { p: P(18, Y1, -8.6), look: P(20.4, Y1 - 0.2, -3.2), ug: u, stop: STOPS.nursery },
    { p: P(18.4, Y1, -7.4), look: P(20.4, Y1 - 0.2, -3.2), ug: u }
  ]);
  const top = makeScene('top', [
    { p: P(3, Y1, -14.8), ug: u, chap: 'Top floor' },
    { p: P(3, Y1, -20), look: P(-5.9, Y1 + 0.8, -20.5), ug: u, stop: STOPS.clocks },
    { p: P(2.4, Y1, -26.6), ug: u }, { p: P(0, Y1, -26.9), ug: u }, { p: P(0, Y1 + 0.3, -25.6), ug: u },
    { p: P(0, Y2, -16.4), ug: u }, { p: P(-1.5, Y2, -15.1), ug: u }, { p: P(-12.5, Y2, -15), ug: u }, { p: P(-12.5, Y2, -13), ug: u },
    { p: P(-12.5, Y2, -10.4), look: P(-12.5, Y2 - 0.4, -6), ug: u, stop: STOPS.study },
    { p: P(-12.3, Y2, -13.4), ug: u }, { p: P(-6, Y2, -15.2), ug: u }, { p: P(9, Y2, -15.2), ug: u }, { p: P(12.5, Y2, -14.4), ug: u },
    { p: P(12.5, Y2, -12.4), look: P(12.5, Y2 - 0.2, -5.6), ug: u, stop: STOPS.regress },
    { p: P(11.6, Y2, -14.6), ug: u }, { p: P(2, Y2, -15), ug: u }, { p: P(0, Y2, -13), ug: u },
    { p: P(0, Y2, -10.6), look: P(0, Y2 + 3, 0), ug: u, stop: STOPS.window },
    { p: P(-4.8, Y2, -8.6), ug: u }, { p: P(-4.6, Y2, -3.6), ug: u },
    { p: P(-1.7, Y2, -2.9), look: P(0.4, Y2 - 0.4, -1.6), ug: u, stop: STOPS.val },
    { p: P(-1.9, Y2, -2.3), look: P(0.4, Y2 - 0.4, -1.0), ug: u }
  ]);
  const Q = (x, y, z) => V(BEL0.x + x, BEL0.y + y + E, BEL0.z + z), d = 0.75;
  const below = makeScene('below', [
    { p: Q(0, 0, 1.6), ug: d, chap: 'Below' },
    { p: Q(0, 0, -2.5), ug: d, stop: STOPS.tunnel },
    { p: Q(0, 0, -11), ug: d },
    { p: Q(0, 0, -16.5), look: Q(-6, -0.2, -19), ug: d, stop: STOPS.barracks },
    { p: Q(0.4, 0, -24), ug: d }, { p: Q(0, 0, -29), ug: d },
    { p: Q(0, 0, -32), look: Q(-4.4, -0.3, -35), ug: d, stop: STOPS.mess },
    { p: Q(0, 0, -39), ug: d }, { p: Q(0, 0, -41.5), ug: d },
    { p: Q(-0.4, 0, -44), look: Q(-5.8, 0.2, -44.5), ug: d, stop: STOPS.armoury },
    { p: Q(0, 0, -49), ug: d }, { p: Q(0, 0, -52.6), ug: d },
    { p: Q(-2.2, 0, -55.2), look: Q(0, 1.2, -60), ug: d, stop: STOPS.chamber },
    { p: Q(-4.8, 0, -59.2), look: Q(0, -0.4, -60), ug: d, stop: STOPS.gifted },
    { p: Q(-2.4, 0, -65.4), ug: d }, { p: Q(0, 0, -67.6), ug: d }, { p: Q(0, 0, -70.5), ug: d },
    { p: Q(-0.6, 0, -76.5), look: Q(4.6, 0.6, -76.5), ug: d, stop: STOPS.gates },
    { p: Q(0, 0, -82.6), look: Q(0, 1.2, -87.6), ug: d, stop: STOPS.lastgate },
    { p: Q(0, 0, -83.4), look: Q(0, 1.2, -87.6), ug: d }
  ]);
  fp.scenes = [descent, ground, west, east, top, below];
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
  roomLights.forEach(l => { l.visible = fp.on && !!fp.sc && (l.userData.sc === fp.sc.id || (fp.sc.id === 'west' || fp.sc.id === 'east') && l.userData.sc === 'ground' && false); });
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
  for (const t of screens) t.offset.x = (t.offset.x + dt * 0.02) % 1;
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
