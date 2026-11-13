/* Epitaph — Aurelia, the first site (sites/aurelia.html; opened from the map and the Atlas), with first-person walk-throughs (three.js, built in code, Temple-of-the-Voided recipe).
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
 *   Temple        under the prairie (base cut open on the north): the Temple of the Voided, reached
 *                 by the passage hatch, with a relay station (split black pyramid, beam to a vent)
 * ?view=lab, ?view=temple; ?after=1, ?theme=paper.
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

// a tapered tube between two points, and a ball (for limbs, roots, rails)
function tubeSeg(kit, kind, a, b, r0, r1, seg = 8) { const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r1, r0, d.length(), seg); g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1))); kit.add(kind, g); }
function ball(kit, kind, p, r) { kit.add(kind, new THREE.SphereGeometry(r, 10, 8).translate(p.x, p.y, p.z)); }
const LAB_A = 0.34;                                           // half-angle of the slice cut out of the north hill
const TUN = { Ft: -CLIFF - 2.5, Ht: 1.55, TW: 1.15, mouthX: -3.3 };   // the passage: floor height, height, width; where it enters the temple

// a machine arm hanging from a ceiling mount: slewing turret, shoulder, elbow, wrist, roll, three-finger gripper with an emitter
function makeArm({ scale = 1, L1 = 0.55, L2 = 0.5, erasable = false, crt = true, pose = { sh: 1.3, el: -2.2, wr: 0.75 } }) {
  const fin = m => { if (erasable) m.onBeforeCompile = eraseInject; return m; };
  const mk = (c, extra = {}) => fin(new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.75, ...extra }));
  const M = { body: mk(crt ? '#3b3a42' : '#6a6876'), dark: mk('#141418', { roughness: 0.55 }), chrome: mk('#d0d0d8', { roughness: 0.14, metalness: 1 }), brass: mk('#b8893a', { roughness: 0.3 }),
    hose: mk('#1d1c22', { roughness: 0.85, metalness: 0.05 }), glow: fin(new THREE.MeshBasicMaterial({ color: new THREE.Color('#9b8cff').multiplyScalar(crt ? 1.7 : 1) })) };
  const add = (g, m, parent, pos = [0, 0, 0], rot = [0, 0, 0]) => { const o = new THREE.Mesh(g, m); o.position.set(...pos); o.rotation.set(...rot); o.castShadow = true; parent.add(o); return o; };
  const Cyl = (r0, r1, h, s = 16) => new THREE.CylinderGeometry(r0, r1, h, s);
  const root = new THREE.Group(); root.scale.setScalar(scale);
  // carriage on the rail, mount plate and bolts
  add(new THREE.BoxGeometry(0.22, 0.08, 0.3), M.dark, root, [0, 0.07, 0]);
  for (const sz of [-1, 1]) add(Cyl(0.03, 0.03, 0.05, 12), M.chrome, root, [0, 0.07, sz * 0.12], [0, 0, PI / 2]);
  add(new THREE.BoxGeometry(0.4, 0.05, 0.4), M.body, root, [0, 0.01, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(Cyl(0.016, 0.016, 0.02, 8), M.chrome, root, [sx * 0.16, -0.02, sz * 0.16]);
  const yaw = new THREE.Group(); root.add(yaw);
  add(Cyl(0.15, 0.17, 0.12, 28), M.body, yaw, [0, -0.08, 0]);
  add(new THREE.TorusGeometry(0.16, 0.011, 6, 36), M.glow, yaw, [0, -0.14, 0], [PI / 2, 0, 0]);
  add(Cyl(0.12, 0.12, 0.06, 24), M.dark, yaw, [0, -0.17, 0]);
  for (const sx of [-1, 1]) { add(new THREE.BoxGeometry(0.035, 0.22, 0.2), M.body, yaw, [sx * 0.1, -0.29, 0]); add(new THREE.BoxGeometry(0.008, 0.12, 0.012), M.glow, yaw, [sx * 0.119, -0.27, 0.06]); }
  const sh = new THREE.Group(); sh.position.y = -0.34; yaw.add(sh);
  add(Cyl(0.075, 0.075, 0.17, 24), M.dark, sh, [0, 0, 0], [0, 0, PI / 2]);
  for (const sx of [-1, 1]) add(Cyl(0.05, 0.05, 0.025, 20), M.brass, sh, [sx * 0.125, 0, 0], [0, 0, PI / 2]);
  const limb = (parent, L, r0, r1) => {
    add(Cyl(r1, r0, L, 6), M.body, parent, [0, -L / 2, 0], [0, PI / 6, 0]);
    add(new THREE.BoxGeometry(0.012, L * 0.62, 0.012), M.glow, parent, [0, -L * 0.5, r0 * 0.9]);
    for (const sx of [-1, 1]) {                                 // a hydraulic piston on each side: sleeve and chrome rod
      add(Cyl(0.022, 0.022, L * 0.5, 12), M.dark, parent, [sx * (r0 + 0.02), -L * 0.3, -0.02]);
      add(Cyl(0.011, 0.011, L * 0.42, 10), M.chrome, parent, [sx * (r0 + 0.02), -L * 0.72, -0.02]);
      for (const y of [-0.06, -L + 0.06]) add(new THREE.SphereGeometry(0.02, 10, 8), M.brass, parent, [sx * (r0 + 0.02), y, -0.02]);
    }
    const hose = new THREE.CatmullRomCurve3([V(0, -0.02, -r0 - 0.01), V(0, -L * 0.5, -r0 - 0.06), V(0, -L + 0.03, -r0 - 0.01)]);
    add(new THREE.TubeGeometry(hose, 16, 0.011, 6, false), M.hose, parent);
    for (const t of [0.25, 0.75]) add(new THREE.TorusGeometry(r0 + 0.004, 0.006, 4, 16), M.brass, parent, [0, -L * t, 0], [PI / 2, 0, 0]);
  };
  limb(sh, L1, 0.06, 0.05);
  const el = new THREE.Group(); el.position.y = -L1; sh.add(el);
  add(Cyl(0.06, 0.06, 0.14, 22), M.dark, el, [0, 0, 0], [0, 0, PI / 2]);
  add(new THREE.TorusGeometry(0.062, 0.01, 6, 24), M.glow, el, [0, 0, 0], [0, PI / 2, 0]);
  for (const sx of [-1, 1]) add(Cyl(0.04, 0.04, 0.02, 16), M.brass, el, [sx * 0.08, 0, 0], [0, 0, PI / 2]);
  limb(el, L2, 0.048, 0.04);
  const wr = new THREE.Group(); wr.position.y = -L2; el.add(wr);
  add(Cyl(0.045, 0.045, 0.11, 20), M.dark, wr, [0, 0, 0], [0, 0, PI / 2]);
  const roll = new THREE.Group(); roll.position.y = -0.04; wr.add(roll);
  add(Cyl(0.04, 0.045, 0.08, 20), M.body, roll, [0, -0.04, 0]);
  add(new THREE.TorusGeometry(0.044, 0.007, 4, 20), M.glow, roll, [0, -0.03, 0], [PI / 2, 0, 0]);
  add(Cyl(0.06, 0.05, 0.04, 20), M.dark, roll, [0, -0.1, 0]);
  const emit = add(new THREE.ConeGeometry(0.012, 0.07, 10).rotateX(PI), M.glow, roll, [0, -0.155, 0]);
  const fingers = [];
  for (let k = 0; k < 3; k++) {
    const base = new THREE.Group(); base.rotation.y = k * 2 * PI / 3; base.position.y = -0.12; roll.add(base);
    const p = new THREE.Group(); p.position.z = 0.045; base.add(p);
    add(new THREE.BoxGeometry(0.02, 0.07, 0.016), M.body, p, [0, -0.035, 0]);
    const d = new THREE.Group(); d.position.y = -0.07; p.add(d);
    add(Cyl(0.011, 0.011, 0.024, 10), M.chrome, d, [0, 0, 0], [0, 0, PI / 2]);
    add(new THREE.BoxGeometry(0.017, 0.05, 0.014), M.body, d, [0, -0.025, 0]);
    add(new THREE.SphereGeometry(0.01, 8, 6), M.brass, d, [0, -0.052, 0]);
    d.rotation.x = -0.5; fingers.push(p);
  }
  return { root, yaw, sh, el, wr, roll, fingers, emit,
    update(t, k = 1) {
      yaw.rotation.y = 0.28 * Math.sin(t * 0.21) * k;
      sh.rotation.x = pose.sh + 0.1 * Math.sin(t * 0.37);
      el.rotation.x = pose.el + 0.14 * Math.sin(t * 0.37 + 0.9);
      wr.rotation.x = pose.wr + 0.2 * Math.sin(t * 0.53 + 0.4);
      roll.rotation.y = Math.sin(t * 0.3) * 1.2;
      const o = 0.32 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.1));
      fingers.forEach(f => { f.rotation.x = o; });
      emit.scale.setScalar(0.8 + 0.4 * Math.abs(Math.sin(t * 6.0)));
    } };
}
// a console screen: rows of void script scrolling past, a ring diagram
const screens = [];
function screenTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#07060c'; g.fillRect(0, 0, 256, 512);
  g.font = '13px Space Mono, monospace';
  const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ·:+=/\\|<>01';
  for (let y = 14; y < 512; y += 16) { let s = ''; const n = 6 + ((y * 7) % 14); for (let i = 0; i < n; i++) s += glyphs[(y * 13 + i * 7) % glyphs.length]; g.fillStyle = y % 80 === 14 ? '#e3dcff' : '#8f7cff'; g.fillText(s, 12, y); g.fillStyle = '#4b3fa0'; g.fillRect(150, y - 8, 20 + ((y * 11) % 70), 3); }
  g.strokeStyle = '#b9a8ff'; g.lineWidth = 2; for (const rr of [34, 22]) { g.beginPath(); g.arc(200, 60, rr, 0, PI * 2); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 0.45); screens.push(t); return t;
}
// a void gate: a crack in the world touched by nothing; it keeps re-cutting itself, and through it is somewhere far away
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
        // somewhere far away: a dusk over hills that are not here, stars, a faint drift
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
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.userData.gate = m; return mesh;
}
const THREE_GOLD = crt => crt ? '#d9a23a' : '#e0a02a';
let capstone = null, pulses = [], gates = [], bigArm = null, labArm = null, ARCH = null, archFx = null, ARCHI = null, archFxI = null, LABI = null, labArmI = null, trapLidI = null, TEMPLEI = null, capI = null, bigArmI = null, dripFxI = [];

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
  const LAB_I0 = Math.round((1.5 * PI - LAB_A) / (2 * PI) * SKIRT_N), LAB_I1 = Math.round((1.5 * PI + LAB_A) / (2 * PI) * SKIRT_N);
  const mainTop = th => rimR(th) - 0.15;
  hillSkirt(kit, 0, 0, mainTop, -CAP, SP, 'slope', 1.3, i => i >= LAB_I0 && i < LAB_I1);
  hillSkirt(kit, SEM.x, -SEM.z, th => rimShape(SEM_R, 0.8, 4, -th) - 0.1, -0.25, th => 2.6 + Math.sin(th * 4) * 0.5, 'slope', 4.1);
  // boulders and scrub on the slope
  for (let i = 0; i < 70; i++) {
    const th = r() * PI * 2, t = 0.15 + r() * 0.75, rr = rimR(th) - 0.15 + SP(th) * t;
    const x = Math.cos(th) * rr, z = Math.sin(th) * rr, y = slopeY(t);
    if (z > 15 && Math.abs(x) < 7) continue;
    if (Math.abs(th - 1.5 * PI) < LAB_A + 0.08 || Math.abs(th + 0.5 * PI) < LAB_A + 0.08) continue;
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
  // ---- the Archive: a domed rotunda over Nera's lab, built and funded by her family (rich patrons, like Luthen's gallery).
  //      It is not an ordinary library: what people believe about the Storyborn shapes their power, so the Archive is made to
  //      fill visitors with reverence and fear. A low entry opens into a well that rises past three galleries to the dome;
  //      a winged Storyborn with a book stands in the light from the oculus, taller than every gallery; feats of the Storyborn
  //      run round the gallery fronts in script that grows larger the higher it goes; giant faces look down from the clerestory;
  //      an orrery of the Storyborn turns under the dome. People study in warm timber booths under the galleries.
  //      The family's architects built in what the Voided need: the statue's pedestal opens (the void detector is its door frame)
  //      onto a spiral stair down into the lab, and weapons hide behind a false bookcase, under a booth bench and in crates on the catwalk.
  {
    const c = V(1.2, T1, -14.4), R = 3.55, RI = 3.25, WELL = 1.5, B0 = 2.25, B1 = 3.0, LV = [0.3, 2.6, 4.9, 7.2], TOP = 10.0;
    const deg = d => d * PI / 180, A2T = a => PI / 2 - a;
    const P = (a, r, y) => V(c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r);
    const flip = g => { g = g.index ? g.toNonIndexed() : g.clone(); const p = g.attributes.position; for (let i = 0; i < p.count; i += 3) { const x = p.getX(i + 1), y = p.getY(i + 1), z = p.getZ(i + 1); p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, x, y, z); } for (const n of Object.keys(g.attributes)) if (n !== 'position') g.deleteAttribute(n); g.computeVertexNormals(); return g; };
    const sector = (kind, r0, r1, a0, a1, y, h) => {
      const sh = new THREE.Shape(), n = Math.max(3, Math.ceil((a1 - a0) / 0.1));
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; i ? sh.lineTo(Math.cos(a) * r1, -Math.sin(a) * r1) : sh.moveTo(Math.cos(a) * r1, -Math.sin(a) * r1); }
      for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; sh.lineTo(Math.cos(a) * r0, -Math.sin(a) * r0); }
      kit.add(kind, new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 1 }).rotateX(-PI / 2).translate(c.x, y - h, c.z));
    };
    const wall = (kind, r, y0, y1, a0, a1, inward) => { let g = new THREE.CylinderGeometry(r, r, y1 - y0, Math.max(3, Math.ceil((a1 - a0) / 0.08)), 1, true, A2T(a1), a1 - a0).translate(c.x, (y0 + y1) / 2, c.z); kit.add(kind, inward ? flip(g) : g); };
    const faceIn = a => Math.atan2(-Math.cos(a), -Math.sin(a)), faceOut = a => Math.atan2(Math.cos(a), Math.sin(a));
    const radial = (kind, a, r, y, lr, h, lt) => kit.add(kind, xf(box(lr, h, lt), { ...P(a, r, y), ry: -a }));   // a box: lr along the radius, lt along the circle
    const DOOR = deg(0), DW = 0.2;                                            // the entry faces east, onto the ring street

    // ---- the drum: outer wall, inner wall (gaps for the entry and the cache niche), cornices, cap
    wall('stone', R, 0, TOP, DOOR + DW, DOOR + 2 * PI - DW); wall('stone', R, LV[0] + 1.35, TOP, DOOR - DW, DOOR + DW);
    const NICHE = deg(60), NW = 0.19;
    wall('stone', RI, 0, LV[0] + 1.35, DOOR + DW, DOOR + 2 * PI - DW, true); wall('stone', RI, LV[0] + 1.35, LV[2], 0, 2 * PI, true);
    wall('stone', RI, LV[2], LV[2] + 1.85, NICHE + NW, NICHE + 2 * PI - NW, true); wall('stone', RI, LV[2] + 1.85, TOP, 0, 2 * PI, true);
    sector('trim', RI, R + 0.1, 0, 2 * PI, TOP + 0.18, 0.18);
    for (const y of [LV[1] - 0.1, LV[2] - 0.1, LV[3] - 0.1]) sector('trim', R, R + 0.07, 0, 2 * PI, y + 0.14, 0.14);
    for (const s of [-1, 1]) radial('stone', DOOR + s * DW, (R + RI) / 2, LV[0], R - RI + 0.02, 1.35, 0.05);
    // the low entry: a vestibule you have to stoop through, under a portico
    const ex = c.x + R, ez = c.z;
    for (const s of [-1, 1]) kit.add('stone', xf(box(1.3, 1.35, 0.14), { x: ex + 0.6, y: LV[0], z: ez + s * 0.55 }));
    kit.add('stone', xf(box(1.3, 0.3, 1.24), { x: ex + 0.6, y: LV[0] + 1.35, z: ez }));
    kit.add('dark', xf(box(1.3, 0.02, 0.96), { x: ex + 0.6, y: LV[0] + 1.33, z: ez }));
    kit.add('trim', xf(box(2.4, 0.3, 2.6), { x: ex + 1.0, y: 0, z: ez }));
    for (let s = 0; s < 2; s++) kit.add('trim', xf(box(0.3, 0.15 * (s + 1), 1.8), { x: ex + 2.35 - s * 0.3, y: 0, z: ez }));
    for (const dz of [-1.05, -0.62, 0.62, 1.05]) { kit.add('trim', xf(cyl(0.11, 0.13, 2.9, 10), { x: ex + 1.9, y: LV[0], z: ez + dz })); kit.add('gold', xf(box(0.28, 0.08, 0.28), { x: ex + 1.9, y: LV[0] + 2.86, z: ez + dz })); }
    kit.add('trim', xf(box(1.6, 0.28, 2.6), { x: ex + 1.15, y: LV[0] + 2.94, z: ez }));
    kit.add('roof', xf(gable(1.6, 2.8, 0.8).rotateY(PI / 2), { x: ex + 1.15, y: LV[0] + 3.22, z: ez }));
    kit.add('glow', xf(box(0.04, 0.07, 2.0), { x: ex + 1.96, y: LV[0] + 3.05, z: ez }));
    // windows: outside all the way up; inside only in the clerestory (the galleries are walled with stacks)
    for (let k = 0; k < 8; k++) {
      const a = DOOR + deg(22.5) + k * deg(45);
      for (const [y, h, w] of [[0.9, 1.2, 0.5], [3.1, 1.4, 0.55], [5.4, 1.4, 0.55], [8.9, 1.0, 0.6]]) {
        kit.add('trim', xf(new THREE.ExtrudeGeometry(roundArch(w + 0.14, h + 0.08), { depth: 0.06, bevelEnabled: false, curveSegments: 6 }), { ...P(a, R + 0.005, y - 0.04), ry: faceOut(a) }));
        kit.add('glow', xf(new THREE.ShapeGeometry(roundArch(w, h), 6), { ...P(a, R + 0.07, y), ry: faceOut(a) }));
      }
      kit.add('glow', xf(new THREE.ShapeGeometry(roundArch(0.6, 1.0), 6), { ...P(a, RI - 0.01, 8.9), ry: faceIn(a) }));
      const pa = a + deg(22.5); if (Math.abs(Math.atan2(Math.sin(pa - DOOR), Math.cos(pa - DOOR))) > 0.3) kit.add('trim', xf(box(0.3, TOP, 0.16), { ...P(pa, R + 0.04, 0), ry: -pa + PI / 2 }));
    }
    sector('glow', R, R + 0.02, 0, 2 * PI, TOP - 0.25, 0.08);
    // the dome: gold outside with ribs, a painted vault inside, an oculus under a small lantern
    const DR = R + 0.15;
    kit.add('gold', new THREE.SphereGeometry(DR, 36, 14, 0, 2 * PI, 0.14, PI / 2 - 0.14).translate(c.x, TOP + 0.18, c.z));
    kit.add('cream', flip(new THREE.SphereGeometry(RI, 36, 14, 0, 2 * PI, 0.15, PI / 2 - 0.15).translate(c.x, TOP + 0.18, c.z)));
    for (let k = 0; k < 12; k++) { const a = k * PI / 6; let prev = null; for (let i = 0; i <= 8; i++) { const t = 0.14 + (PI / 2 - 0.14) * i / 8, p = V(c.x + Math.cos(a) * Math.sin(t) * (DR + 0.03), TOP + 0.18 + Math.cos(t) * (DR + 0.03), c.z + Math.sin(a) * Math.sin(t) * (DR + 0.03)); if (prev) tubeSeg(kit, 'trim', prev, p, 0.05, 0.05, 5); prev = p; } }
    for (let k = 0; k < 12; k++) { const a = k * PI / 6 + PI / 12; let prev = null; for (let i = 0; i <= 8; i++) { const t = 0.15 + (PI / 2 - 0.15) * i / 8, rr = RI - 0.03, p = V(c.x + Math.cos(a) * Math.sin(t) * rr, TOP + 0.18 + Math.cos(t) * rr, c.z + Math.sin(a) * Math.sin(t) * rr); if (prev) tubeSeg(kit, 'gold', prev, p, 0.03, 0.03, 4); prev = p; } }
    const OY = TOP + 0.18 + Math.cos(0.14) * DR;
    for (let k = 0; k < 8; k++) kit.add('trim', xf(cyl(0.05, 0.05, 0.7, 6), { ...P(k * PI / 4, 0.48, OY) }));
    kit.add('gold', xf(cyl(0.6, 0.6, 0.12, 20), { x: c.x, y: OY + 0.7, z: c.z })); kit.add('gold', xf(dome(0.5, 14), { x: c.x, y: OY + 0.82, z: c.z }));
    kit.add('glow', xf(new THREE.OctahedronGeometry(0.2), { x: c.x, y: OY + 1.5, z: c.z }));
    kit.add('sky', new THREE.CircleGeometry(0.5, 20).rotateX(PI / 2).translate(c.x, OY + 0.68, c.z));
    L('The Archive · built by Nera\'s family', V(c.x, OY + 2.4, c.z));

    // ---- floors: the ground (a mosaic in the well, timber under the galleries) and three galleries round the well
    sector('trim', 0.88, WELL, 0, 2 * PI, LV[0], 0.3); sector('woodL', WELL, RI, 0, 2 * PI, LV[0], 0.3);
    for (const [r0, r1] of [[1.05, 1.1], [1.38, 1.44]]) sector('gold', r0, r1, 0, 2 * PI, LV[0] + 0.01, 0.01);
    for (let k = 0; k < 16; k++) radial('gold', k * PI / 8, 1.24, LV[0], 0.3, 0.012, 0.03);
    const S = deg(150), HOLE = deg(94.5), NST = 24;
    const flights = [{ a0: deg(20), y0: LV[0] }, { a0: deg(170), y0: LV[1] }, { a0: deg(70), y0: LV[2] }];
    for (let l = 1; l <= 3; l++) {
      const end = flights[l - 1].a0 + S, y = LV[l];
      sector('woodL', WELL, B0, 0, 2 * PI, y, 0.2); sector('woodL', B1, RI, 0, 2 * PI, y, 0.2); sector('woodL', B0, B1, end, end + 2 * PI - HOLE, y, 0.2);
      sector('trim', WELL - 0.04, WELL, 0, 2 * PI, y + 0.02, 0.62);
      for (let k = 0; k < 30; k++) { const a = k * PI / 15; kit.add('metal', xf(cyl(0.018, 0.018, 0.85, 6), { ...P(a, WELL + 0.06, y) })); }
      kit.add('gold', new THREE.TorusGeometry(WELL + 0.06, 0.028, 6, 72).rotateX(PI / 2).translate(c.x, y + 0.86, c.z));
    }
    // the stairs: the first flight red (the warm, open part of the Archive), the higher ones iron, each turning 150° up the wall
    const stepH = (LV[1] - LV[0]) / NST, rs = (B0 + B1) / 2;
    flights.forEach((f, fi) => {
      const kind = fi === 0 ? 'redsteel' : 'metal';
      for (let i = 0; i < NST; i++) {
        const a = f.a0 + (i + 0.5) * S / NST, top = f.y0 + (i + 1) * stepH;
        radial(kind, a, rs, top - 0.07, B1 - B0, 0.07, 0.31);
        if (i % 3 === 0) kit.add(kind, xf(cyl(0.016, 0.016, 0.85, 6), { ...P(a, B0 + 0.05, top) }));
        const a2 = f.a0 + (i + 1.5) * S / NST, t2 = f.y0 + (i + 2) * stepH;
        if (i < NST - 1) { tubeSeg(kit, kind, P(a, B0 + 0.05, top + 0.85), P(a2, B0 + 0.05, t2 + 0.85), 0.022, 0.022, 5); tubeSeg(kit, kind, P(a, B0 + 0.1, top - 0.12), P(a2, B0 + 0.1, t2 - 0.12), 0.05, 0.05, 5); }
      }
    });
    // a ladder from the top gallery to the catwalk under the dome; the catwalk ring
    const LAD = deg(40);
    for (const s of [-1, 1]) kit.add('wood', xf(box(0.05, TOP - LV[3] + 0.9, 0.05), { ...P(LAD + s * 0.07, RI - 0.12, LV[3]), ry: -LAD }));
    for (let y = LV[3] + 0.3; y < TOP + 0.8; y += 0.3) radial('wood', LAD, RI - 0.12, y, 0.04, 0.04, 0.46);
    sector('metal', 2.75, RI, LAD + 0.12, LAD + 2 * PI - 0.12, TOP, 0.06); sector('metal', 2.75, 2.95, LAD - 0.12, LAD + 0.12, TOP, 0.06);
    for (let k = 0; k < 36; k++) { const a = k * PI / 18; kit.add('metal', xf(cyl(0.015, 0.015, 0.8, 5), { ...P(a, 2.77, TOP) })); }
    kit.add('metal', new THREE.TorusGeometry(2.77, 0.02, 5, 72).rotateX(PI / 2).translate(c.x, TOP + 0.8, c.z));

    // ---- the stacks: shelves round the outer wall on every level (the top shelves are lit but out of reach)
    const bookKinds = ['roof', 'barn', 'trim', 'leaf', 'wood', 'cream', 'dark'];
    let bseed = 3; const br = () => (bseed = (bseed * 16807) % 2147483647) / 2147483647;
    const stack = (a0, a1, y0, h, rows) => {
      const n = Math.max(1, Math.round((a1 - a0) / 0.2));
      for (let i = 0; i < n; i++) {
        const a = a0 + (a1 - a0) * (i + 0.5) / n, len = (a1 - a0) / n * (RI - 0.08) - 0.02;
        radial('wood', a, RI - 0.09, y0, 0.18, h, len);
        for (let rw = 0; rw < rows; rw++) {
          const yy = y0 + 0.12 + rw * (h - 0.15) / rows, bh = (h - 0.15) / rows - 0.06;
          radial('woodL', a, RI - 0.18, yy - 0.03, 0.04, 0.03, len);
          let off = -len / 2 + 0.02;
          while (off < len / 2 - 0.08) { const w = 0.07 + br() * 0.14, a_ = a + (off + w / 2) / (RI - 0.18); radial(bookKinds[Math.floor(br() * bookKinds.length)], a_, RI - 0.2, yy, 0.15, bh * (0.75 + br() * 0.25), w - 0.01); off += w; }
        }
      }
    };
    stack(DOOR + 0.3, deg(175), LV[0], 2.0, 4);                                  // ground: under the red stair
    stack(deg(185), deg(345), LV[0], 0.5, 1);                                    // low shelves behind the booths
    stack(deg(-5), deg(350), LV[1], 1.95, 5);
    stack(NICHE + NW + 0.02, NICHE + 2 * PI - NW - 0.02, LV[2], 1.95, 5);
    stack(LAD + 0.2, LAD + 2 * PI - 0.2, LV[3], 1.6, 4);
    for (const [a, l] of [[deg(250), 1], [deg(300), 1], [deg(120), 2], [deg(200), 3]]) { const y = LV[l]; for (const s of [-1, 1]) tubeSeg(kit, 'wood', P(a + s * 0.06, RI - 0.75, y), P(a + s * 0.06, RI - 0.24, y + 1.9), 0.022, 0.022, 5); for (let k = 1; k < 7; k++) { const t = k / 7; radial('wood', a, RI - 0.75 + 0.51 * t, y + 1.9 * t, 0.03, 0.03, 0.14); } }
    // reading desks on the first gallery
    for (const a of [deg(200), deg(235), deg(275), deg(310), deg(345)]) {
      radial('wood', a, 2.0, LV[1] + 0.68, 0.5, 0.05, 0.9); for (const s of [-1, 1]) radial('wood', a + s * 0.17, 2.0, LV[1], 0.4, 0.68, 0.05);
      kit.add('gold', xf(cyl(0.05, 0.06, 0.03, 10), { ...P(a, 2.05, LV[1] + 0.73) })); kit.add('gold', xf(cyl(0.01, 0.01, 0.28, 5), { ...P(a, 2.05, LV[1] + 0.76) }));
      kit.add('shade', xf(new THREE.CylinderGeometry(0.06, 0.1, 0.08, 12, 1, true), { ...P(a, 2.05, LV[1] + 1.04) })); kit.add('glow', xf(new THREE.SphereGeometry(0.03, 8, 6), { ...P(a, 2.05, LV[1] + 1.02) }));
      kit.add('cream', xf(box(0.22, 0.02, 0.3), { ...P(a - 0.08, 1.95, LV[1] + 0.73), ry: -a + 0.2 }));
    }
    // a bench on the top gallery, facing the statue's face
    radial('wood', deg(5), 1.85, LV[3], 0.35, 0.42, 1.2); radial('fabric', deg(5), 1.85, LV[3] + 0.42, 0.33, 0.05, 1.16);

    // ---- the faces: giant Storyborn masks in the clerestory, tilted down at the floor
    for (let k = 0; k < 8; k++) {
      const a = DOOR + k * deg(45), F = { ...P(a, RI - 0.45, 9.35), rx: 0.6, ry: faceIn(a) };
      kit.add('trim', xf(new THREE.SphereGeometry(0.5, 16, 12).scale(0.78, 1, 0.55), F));
      kit.add('trim', xf(box(0.7, 0.1, 0.18).translate(0, 0.18, 0.2), F));
      kit.add('trim', xf(new THREE.ConeGeometry(0.07, 0.3, 4).translate(0, 0.0, 0.26), F));
      for (const s of [-1, 1]) kit.add('glow', xf(box(0.16, 0.03, 0.02).translate(s * 0.17, 0.1, 0.27), F));
      kit.add('dark', xf(box(0.22, 0.02, 0.02).translate(0, -0.2, 0.26), F));
      kit.add('gold', xf(new THREE.TorusGeometry(0.5, 0.03, 4, 24, PI).translate(0, 0.05, 0), F));
    }

    // ---- the statue: a winged Storyborn with an open book, on a hollow pedestal (the secret entrance)
    const PB = LV[0] + 1.3;                                                         // pedestal top
    const PDOOR = deg(270), PDW = 0.36;
    wall('stone', 0.95, LV[0], PB, PDOOR + PDW, PDOOR + 2 * PI - PDW); wall('stone', 0.88, LV[0], PB, PDOOR + PDW, PDOOR + 2 * PI - PDW, true);
    wall('stone', 0.95, LV[0] + 1.15, PB, PDOOR - PDW, PDOOR + PDW); wall('stone', 0.88, LV[0] + 1.15, PB, PDOOR - PDW, PDOOR + PDW, true);
    kit.add('dark', flip(new THREE.CircleGeometry(0.88, 32).rotateX(-PI / 2)).translate(c.x, LV[0] + 1.15, c.z));
    kit.add('trim', xf(cyl(1.02, 1.02, 0.16, 36), { x: c.x, y: PB, z: c.z }));
    kit.add('gold', new THREE.TorusGeometry(0.96, 0.025, 4, 48).rotateX(PI / 2).translate(c.x, LV[0] + 0.85, c.z));
    for (const s of [-1, 1]) radial('stone', PDOOR + s * PDW, 0.915, LV[0], 0.08, 1.15, 0.03);
    const SB_ = PB + 0.16;
    const robe = [[0.78, 0], [0.72, 0.35], [0.6, 2.0], [0.5, 3.6], [0.45, 4.8], [0.56, 5.45], [0.5, 5.7], [0.22, 5.95], [0.16, 6.05], [0.001, 6.06]].map(([r, y]) => new THREE.Vector2(r, y));
    kit.add('trim', new THREE.LatheGeometry(robe, 28).translate(c.x, SB_, c.z));
    for (const [y, r] of [[1.2, 0.665], [2.9, 0.555], [4.2, 0.48]]) kit.add('glow', new THREE.TorusGeometry(r, 0.018, 4, 40).rotateX(PI / 2).translate(c.x, SB_ + y, c.z));
    kit.add('trim', new THREE.SphereGeometry(0.3, 18, 14).scale(1, 1.1, 0.95).translate(c.x + 0.03, SB_ + 6.38, c.z));
    kit.add('trim', new THREE.SphereGeometry(0.32, 14, 10, 0, 2 * PI, 0, PI / 2).scale(1.05, 1.0, 1.05).translate(c.x - 0.04, SB_ + 6.45, c.z));
    for (const s of [-1, 1]) kit.add('glow', box(0.02, 0.025, 0.09).translate(c.x + 0.31, SB_ + 6.42, c.z + s * 0.1));
    kit.add('glow', new THREE.TorusGeometry(0.58, 0.035, 6, 40).rotateY(PI / 2).translate(c.x - 0.28, SB_ + 6.5, c.z));
    for (let k = 0; k < 9; k++) { const t = -PI / 2 + k * PI / 8; kit.add('gold', new THREE.ConeGeometry(0.04, 0.32, 4).translate(0, 0.16, 0).rotateX(t).translate(c.x - 0.3, SB_ + 6.5 + Math.cos(t) * 0.6, c.z + Math.sin(t) * 0.6)); }
    // the book held out to whoever enters, and the arms that hold it
    for (const s of [-1, 1]) {
      tubeSeg(kit, 'trim', V(c.x + 0.05, SB_ + 5.55, c.z + s * 0.47), V(c.x + 0.42, SB_ + 4.85, c.z + s * 0.36), 0.12, 0.09); ball(kit, 'trim', V(c.x + 0.42, SB_ + 4.85, c.z + s * 0.36), 0.095);
      tubeSeg(kit, 'trim', V(c.x + 0.42, SB_ + 4.85, c.z + s * 0.36), V(c.x + 0.62, SB_ + 4.98, c.z + s * 0.24), 0.085, 0.07); ball(kit, 'trim', V(c.x + 0.64, SB_ + 4.99, c.z + s * 0.23), 0.08);
      kit.add('cream', xf(box(0.03, 0.5, 0.34), { x: c.x + 0.7, y: SB_ + 4.82, z: c.z + s * 0.17, ry: s * 0.35, rz: 0.35 }));
      kit.add('gold', xf(box(0.025, 0.54, 0.37), { x: c.x + 0.68, y: SB_ + 4.8, z: c.z + s * 0.185, ry: s * 0.35, rz: 0.35 }));
      for (let k = 0; k < 5; k++) kit.add('glow', xf(box(0.032, 0.012, 0.24), { x: c.x + 0.71 + (k * 0.08) * Math.sin(0.35) * -1, y: SB_ + 4.68 + k * 0.08, z: c.z + s * 0.17, ry: s * 0.35, rz: 0.35 }));
    }
    // wings: two pairs from the shoulders, swept up and out
    const feather = (() => { const sh = new THREE.Shape(); sh.moveTo(-0.16, 0); sh.quadraticCurveTo(-0.45, 1.3, 0.15, 2.5); sh.quadraticCurveTo(0.22, 1.4, 0.2, 0); sh.closePath(); return sh; })();
    for (const [tilt, len, y] of [[0.32, 1.0, 5.55], [0.95, 0.75, 5.2]]) for (const s of [-1, 1]) {
      let g = new THREE.ExtrudeGeometry(feather, { depth: 0.05, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -0.025).scale(len, len, 1).rotateZ(-tilt);
      if (s < 0) g = flip(g.scale(-1, 1, 1));
      g.rotateY(-PI / 2).translate(c.x - 0.32, SB_ + y, c.z + s * 0.22); kit.add('cream', g);
      for (let k = 0; k < 4; k++) { const t = 0.4 + k * 0.45; kit.add('gold', box(0.02, 0.02, 0.4 * len).rotateX(s * (tilt + 0.3)).translate(c.x - 0.33, SB_ + y + t * len * Math.cos(tilt), c.z + s * (0.25 + t * len * Math.sin(tilt)))); }
    }

    // ---- the timber booths under the galleries (O3): pergola roofs, lanterns, string lights, tables and benches
    const BOOTHS = [200, 228, 256, 284, 312, 340].map(deg);
    BOOTHS.forEach((a, i) => {
      const half = deg(12.5);
      for (const s of [-1, 1]) { kit.add('wood', xf(box(0.09, 1.95, 0.09), { ...P(a + s * half, 2.25, LV[0]) })); radial('wood', a + s * half, 2.75, LV[0] + 1.95, 1.05, 0.08, 0.06); }
      for (let k = 0; k < 6; k++) radial('wood', a, 2.3 + k * 0.17, LV[0] + 2.03, 0.04, 0.05, 1.18);
      radial('wood', a, 2.25, LV[0] + 1.9, 0.06, 0.06, 1.2);
      radial('wood', a, 2.75, LV[0] + 0.62, 0.55, 0.05, 0.7); radial('wood', a, 2.75, LV[0], 0.06, 0.62, 0.06);
      if (i !== 4) for (const s of [-1, 1]) { radial('wood', a + s * deg(8), 2.75, LV[0], 0.8, 0.4, 0.22); radial('fabric', a + s * deg(8), 2.75, LV[0] + 0.4, 0.75, 0.05, 0.2); }
      else { radial('wood', a + deg(8), 2.75, LV[0], 0.8, 0.4, 0.22); radial('fabric', a + deg(8), 2.75, LV[0] + 0.4, 0.75, 0.05, 0.2); radial('wood', a - deg(8), 2.75, LV[0], 0.8, 0.3, 0.22); }
      for (const s of [-1, 1]) { radial('wood', a + s * half, 2.95, LV[0], 0.6, 1.3, 0.05); }
      kit.add('wood', xf(cyl(0.008, 0.008, 0.3, 4), { ...P(a, 2.7, LV[0] + 1.65) })); kit.add('wood', xf(box(0.14, 0.03, 0.14), { ...P(a, 2.7, LV[0] + 1.63) }));
      kit.add('glow', xf(box(0.1, 0.16, 0.1), { ...P(a, 2.7, LV[0] + 1.47) })); kit.add('wood', xf(box(0.13, 0.02, 0.13), { ...P(a, 2.7, LV[0] + 1.45) }));
      kit.add('cream', xf(box(0.18, 0.015, 0.24), { ...P(a + 0.04, 2.7, LV[0] + 0.67), ry: -a + 0.3 }));
      for (let k = 0; k <= 8; k++) { const t = k / 8, aa = a - half + 2 * half * t; kit.add('glow', new THREE.SphereGeometry(0.018, 6, 4).translate(...P(aa, 2.25, LV[0] + 1.85 - Math.sin(t * PI) * 0.18).toArray())); }
    });
    // the bench that hides weapons: its seat is a lid (the lid itself is a moving part); inside, a crate of void weapons and cells
    const BB = BOOTHS[4] - deg(8);
    radial('wood', BB, 2.75, LV[0] + 0.05, 0.6, 0.02, 0.16);
    radial('void', BB, 2.75, LV[0] + 0.06, 0.55, 0.12, 0.12); radial('vglow', BB, 2.75, LV[0] + 0.19, 0.45, 0.01, 0.04);
    for (const dr of [-0.15, 0, 0.15]) kit.add('vglow', xf(cyl(0.025, 0.025, 0.12, 8), { ...P(BB, 2.75 + dr, LV[0] + 0.19) }));

    // ---- the cache behind the false bookcase on the second gallery: a niche in the wall, a rack of the Voided's weapons
    const NR0 = RI, NR1 = RI + 0.26, ny = LV[2];
    wall('dark', NR1, ny, ny + 1.85, NICHE - NW, NICHE + NW, true);
    for (const s of [-1, 1]) radial('dark', NICHE + s * NW, (NR0 + NR1) / 2, ny, NR1 - NR0, 1.85, 0.02);
    sector('dark', NR0, NR1, NICHE - NW, NICHE + NW, ny + 1.87, 0.02);
    radial('wood', NICHE, NR1 - 0.04, ny + 1.4, 0.06, 0.06, 0.5);
    for (const [da, h] of [[-0.12, 1.1], [-0.04, 1.15], [0.04, 1.1]]) {
      const a = NICHE + da; radial('void', a, NR1 - 0.09, ny + 0.3, 0.06, h, 0.07); radial('vglow', a, NR1 - 0.125, ny + 0.4, 0.005, h - 0.25, 0.015);
      radial('metal', a, NR1 - 0.1, ny + 0.3 + h, 0.03, 0.22, 0.03); radial('void', a, NR1 - 0.15, ny + 0.55, 0.08, 0.14, 0.05);
    }
    for (const da of [0.1, 0.14]) { const a = NICHE + da; radial('metal', a, NR1 - 0.08, ny + 0.5, 0.03, 0.18, 0.04); radial('void', a, NR1 - 0.08, ny + 0.68, 0.012, 0.95, 0.05); radial('vglow', a, NR1 - 0.09, ny + 0.7, 0.014, 0.9, 0.012); }
    for (let k = 0; k < 4; k++) kit.add('vglow', xf(cyl(0.035, 0.035, 0.16, 8), { ...P(NICHE - 0.12 + k * 0.08, NR1 - 0.12, ny + 0.05) }));
    kit.add('void', xf(box(0.06, 0.04, 0.4), { ...P(NICHE, NR1 - 0.12, ny), ry: -NICHE }));

    // ---- crates of "acquisitions" on the catwalk: one is open, and it isn't records
    for (const [a, open] of [[deg(150), false], [deg(160), true], [deg(171), false], [deg(160), false]]) {
      const y = TOP + (a === deg(160) && !open ? 0.36 : 0);
      if (a === deg(160) && !open) { radial('wood', a, 3.0, y, 0.38, 0.32, 0.45); continue; }
      radial('wood', a, 3.0, TOP, 0.4, 0.36, 0.5);
      if (open) { radial('vglow', a, 3.0, TOP + 0.36, 0.3, 0.01, 0.4); radial('void', a, 3.0, TOP + 0.3, 0.22, 0.07, 0.38); radial('wood', a + 0.06, 3.15, TOP + 0.36, 0.42, 0.03, 0.5); }
    }

    // ---- the way down: a spiral stair inside the pedestal, through a shaft, out of the lab's ceiling
    const SPN = 20, SPA = 0.42, SPtop = LV[0], SPbot = FLOOR + 0.12, SPrise = (SPtop - SPbot) / SPN;
    kit.add('metal', xf(cyl(0.1, 0.1, SPtop - SPbot, 10), { x: c.x, y: SPbot, z: c.z }));
    for (let k = 0; k < SPN; k++) {
      const a = PDOOR + 0.25 + k * SPA, top = SPtop - (k + 1) * SPrise;
      radial('metal', a, 0.5, top - 0.06, 0.74, 0.06, 0.3); radial('vglow', a, 0.86, top - 0.02, 0.02, 0.02, 0.28);
      if (k % 2 === 0) kit.add('metal', xf(cyl(0.012, 0.012, 0.8, 5), { ...P(a, 0.84, top) }));
    }
    kit.add('concrete', flip(new THREE.CylinderGeometry(0.88, 0.88, LV[0] - (-CAP - 0.25), 28, 1, true).translate(c.x, (LV[0] + (-CAP - 0.25)) / 2, c.z)));
    for (let k = 0; k < 4; k++) kit.add('vglow', xf(box(0.02, LV[0] + 1.2, 0.02), { ...P(PDOOR + 0.6 + k * 1.5, 0.86, -CAP - 0.25) }));
    sector('concrete', 0.88, 1.4, 0, 2 * PI, -CAP + 0.05, 0.3);
    placed.push([c.x, c.z, R + 0.5], [c.x + R + 1.4, c.z, 1.6], [c.x + R + 3.6, c.z + 0.4, 2.6]);   // and a small plaza in front
    ARCH = { c, R, RI, WELL, B0, B1, LV, TOP, flights, S, NST, stepH, rs, DOOR, NICHE, NW, NR1, LAD, PDOOR, PDW, PB, SPN, SPA, SPtop, SPbot, SPrise, BB, OY, BOOTHS };
  }
  // ---- the Archive's interior, built at full size away from the diorama ("bigger on the inside"): you walk through the
  //      door in the model and fade into this. Three times wider than the model's rotunda, with deep galleries, rows of
  //      freestanding stacks, reading desks, the timber booths, and the statue rising through the well.
  {
    const c = V(1000, 0, 0), RI = 12, R = 12.4, WELL = 4.6, LV = [0, 3.6, 7.2, 10.8], TOP = 14.4, SB0 = 7.0, SB1 = 8.4, PS = 1.65;
    const deg = d => d * PI / 180, A2T = a => PI / 2 - a, P = (a, r, y) => V(c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r);
    const flip = g => { g = g.index ? g.toNonIndexed() : g.clone(); const p = g.attributes.position; for (let i = 0; i < p.count; i += 3) { const x = p.getX(i + 1), y = p.getY(i + 1), z = p.getZ(i + 1); p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, x, y, z); } for (const n of Object.keys(g.attributes)) if (n !== 'position') g.deleteAttribute(n); g.computeVertexNormals(); return g; };
    const sector = (kind, r0, r1, a0, a1, y, h) => { const sh = new THREE.Shape(), n = Math.max(3, Math.ceil((a1 - a0) / 0.06)); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; i ? sh.lineTo(Math.cos(a) * r1, -Math.sin(a) * r1) : sh.moveTo(Math.cos(a) * r1, -Math.sin(a) * r1); } for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; sh.lineTo(Math.cos(a) * r0, -Math.sin(a) * r0); } kit.add(kind, new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 1 }).rotateX(-PI / 2).translate(c.x, y - h, c.z)); };
    const wall = (kind, r, y0, y1, a0, a1, inward) => { const g = new THREE.CylinderGeometry(r, r, y1 - y0, Math.max(3, Math.ceil((a1 - a0) / 0.05)), 1, true, A2T(a1), a1 - a0).translate(c.x, (y0 + y1) / 2, c.z); kit.add(kind, inward ? flip(g) : g); };
    const faceIn = a => Math.atan2(-Math.cos(a), -Math.sin(a));
    const radial = (kind, a, r, y, lr, h, lt) => kit.add(kind, xf(box(lr, h, lt), { ...P(a, r, y), ry: -a }));
    const DOOR = 0, DW = 0.09, NICHE = deg(60), NW = 0.07, LAD = deg(345);
    const S = deg(90), HOLE = deg(57), stepH = 0.15, NST = Math.round((LV[1] - LV[0]) / stepH), rs = (SB0 + SB1) / 2;
    const flights = [{ a0: deg(20), y0: LV[0] }, { a0: deg(130), y0: LV[1] }, { a0: deg(240), y0: LV[2] }];   // a 20° landing on each floor between flights
    const busyArc = (a, lvl) => { const n = x => ((x % (2 * PI)) + 2 * PI) % (2 * PI); const inA = (x, a0, a1) => { x = n(x - a0); return x <= n(a1 - a0); };
      return (lvl === 0 && inA(a, -0.12, 0.12)) || (lvl === 2 && inA(a, NICHE - 0.12, NICHE + 0.12)) || (lvl === 3 && inA(a, LAD - 0.08, LAD + 0.08)); };
    // shell: walls, floors, the dome
    wall('stone', RI, LV[0], LV[0] + 2.4, DOOR + DW, DOOR + 2 * PI - DW, true); wall('stone', RI, LV[0] + 2.4, LV[2], 0, 2 * PI, true);
    wall('stone', RI, LV[2], LV[2] + 2.6, NICHE + NW, NICHE + 2 * PI - NW, true); wall('stone', RI, LV[2] + 2.6, TOP + 0.3, 0, 2 * PI, true);
    wall('stone', R, LV[0] - 0.4, TOP + 0.3, 0, 2 * PI);
    sector('trim', 1.6, WELL, 0, 2 * PI, LV[0], 0.3); sector('woodL', WELL, RI, 0, 2 * PI, LV[0], 0.3);
    for (const [r0, r1] of [[2.4, 2.5], [3.5, 3.6], [4.3, 4.4]]) sector('gold', r0, r1, 0, 2 * PI, LV[0] + 0.01, 0.01);
    for (let k = 0; k < 24; k++) radial('gold', k * PI / 12, 3.0, LV[0], 1.6, 0.012, 0.05);
    for (let l = 1; l <= 3; l++) {
      const end = flights[l - 1].a0 + S, y = LV[l];
      sector('woodL', WELL, SB0, 0, 2 * PI, y, 0.3); sector('woodL', SB1, RI, 0, 2 * PI, y, 0.3); sector('woodL', SB0, SB1, end, end + 2 * PI - HOLE, y, 0.3);
      sector('trim', WELL - 0.06, WELL, 0, 2 * PI, y + 0.02, 0.95);
      for (let k = 0; k < 72; k++) kit.add('metal', xf(cyl(0.025, 0.025, 1.0, 6), { ...P(k * PI / 36, WELL + 0.08, y) }));
      kit.add('gold', new THREE.TorusGeometry(WELL + 0.08, 0.04, 6, 120).rotateX(PI / 2).translate(c.x, y + 1.02, c.z));
      for (const rr of [SB0, SB1]) { for (let k = 0; k < 40; k++) { const a = end - HOLE + k * HOLE / 39; if (rr === SB0 && a > end - 0.2) continue; kit.add('metal', xf(cyl(0.02, 0.02, 1.0, 5), { ...P(a, rr + (rr === SB0 ? -0.05 : 0.05), y) })); } }
    }
    const DR = R + 0.1, OY = TOP + 0.3 + Math.cos(0.12) * RI;
    kit.add('cream', flip(new THREE.SphereGeometry(RI, 48, 18, 0, 2 * PI, 0.12, PI / 2 - 0.12).translate(c.x, TOP + 0.3, c.z)));
    kit.add('gold', new THREE.SphereGeometry(DR, 48, 18, 0, 2 * PI, 0.11, PI / 2 - 0.11).translate(c.x, TOP + 0.3, c.z));
    for (let k = 0; k < 16; k++) { const a = k * PI / 8; let prev = null; for (let i = 0; i <= 10; i++) { const t = 0.12 + (PI / 2 - 0.12) * i / 10, rr = RI - 0.05, p = V(c.x + Math.cos(a) * Math.sin(t) * rr, TOP + 0.3 + Math.cos(t) * rr, c.z + Math.sin(a) * Math.sin(t) * rr); if (prev) tubeSeg(kit, 'gold', prev, p, 0.06, 0.06, 5); prev = p; } }
    kit.add('sky', new THREE.CircleGeometry(1.5, 32).rotateX(PI / 2).translate(c.x, OY + 0.3, c.z));
    kit.add('gold', new THREE.TorusGeometry(1.45, 0.08, 6, 40).rotateX(PI / 2).translate(c.x, OY - 0.05, c.z));
    // the entry: a low vestibule you stoop through, then the well
    for (const s of [-1, 1]) kit.add('stone', xf(box(3.2, 1.75, 0.2), { x: c.x + RI + 1.5, y: LV[0], z: c.z + s * 0.75 }));
    kit.add('stone', xf(box(3.4, 0.3, 1.7), { x: c.x + RI + 1.5, y: LV[0] + 1.75, z: c.z })); kit.add('woodL', xf(box(3.4, 0.3, 1.5), { x: c.x + RI + 1.5, y: LV[0] - 0.3, z: c.z }));
    kit.add('stone', xf(box(0.3, 2.2, 1.7), { x: c.x + RI + 3.2, y: LV[0], z: c.z })); kit.add('dark', xf(new THREE.ShapeGeometry(roundArch(0.9, 1.6), 6), { x: c.x + RI + 3.04, y: LV[0], z: c.z, ry: -PI / 2 }));
    for (const s of [-1, 1]) radial('stone', DOOR + s * DW, RI + 0.2, LV[0], 0.45, 1.75, 0.06);
    // clerestory: lit windows and the giant faces looking down
    for (let k = 0; k < 8; k++) {
      const a = k * deg(45) + deg(22.5);
      kit.add('glow', xf(new THREE.ShapeGeometry(roundArch(1.3, 1.8), 6), { ...P(a, RI - 0.03, LV[3] + 2.4), ry: faceIn(a) }));
      const am = k * deg(45), F = { ...P(am, RI - 0.85, LV[3] + 3.0), rx: 0.6, ry: faceIn(am) }, s_ = 1.9;
      kit.add('trim', xf(new THREE.SphereGeometry(0.5 * s_, 16, 12).scale(0.78, 1, 0.55), F)); kit.add('trim', xf(box(0.7 * s_, 0.1 * s_, 0.18 * s_).translate(0, 0.18 * s_, 0.2 * s_), F));
      kit.add('trim', xf(new THREE.ConeGeometry(0.07 * s_, 0.3 * s_, 4).translate(0, 0, 0.26 * s_), F));
      for (const sd of [-1, 1]) kit.add('glow', xf(box(0.16 * s_, 0.03 * s_, 0.02 * s_).translate(sd * 0.17 * s_, 0.1 * s_, 0.27 * s_), F));
      kit.add('gold', xf(new THREE.TorusGeometry(0.5 * s_, 0.03 * s_, 4, 24, PI).translate(0, 0.05 * s_, 0), F));
    }
    // the stairs: the first flight red, the higher ones iron, each turning 90° round the ring between the stacks and the desks
    flights.forEach((f, fi) => {
      const kind = fi === 0 ? 'redsteel' : 'metal';
      for (let i = 0; i < NST; i++) {
        const a = f.a0 + (i + 0.5) * S / NST, top = f.y0 + (i + 1) * stepH;
        radial(kind, a, rs, top - 0.08, SB1 - SB0, 0.08, rs * S / NST + 0.02);
        const openIn = i < 4 || i >= NST - 5;                                       // the inner rail opens at the foot and the head of each flight
        if (i < NST - 1) for (const rr of [SB0 + 0.05, SB1 - 0.05]) { if (rr < rs && openIn) continue; const a2 = f.a0 + (i + 1.5) * S / NST; tubeSeg(kit, kind, P(a, rr, top + 0.95), P(a2, rr, top + stepH + 0.95), 0.03, 0.03, 5); }
        if (i % 3 === 0) for (const rr of [SB0 + 0.05, SB1 - 0.05]) { if (rr < rs && openIn) continue; kit.add(kind, xf(cyl(0.02, 0.02, 0.95, 6), { ...P(a, rr, top) })); }
        tubeSeg(kit, kind, P(a, rs, top - 0.2), P(f.a0 + (i + 1.5) * S / NST, rs, top + stepH - 0.2), 0.09, 0.09, 6);
      }
    });
    // a ladder from the top gallery to the catwalk, the catwalk under the dome
    for (const s of [-1, 1]) kit.add('wood', xf(box(0.06, TOP - LV[3] + 1.0, 0.06), { ...P(LAD + s * 0.03, RI - 0.15, LV[3]), ry: -LAD }));
    for (let y = LV[3] + 0.3; y < TOP + 0.9; y += 0.3) radial('wood', LAD, RI - 0.15, y, 0.05, 0.05, 0.6);
    sector('metal', RI - 1.4, RI, LAD + 0.06, LAD + 2 * PI - 0.06, TOP + 0.3, 0.08); sector('metal', RI - 1.4, RI - 0.6, LAD - 0.06, LAD + 0.06, TOP + 0.3, 0.08);
    for (let k = 0; k < 72; k++) kit.add('metal', xf(cyl(0.02, 0.02, 0.95, 5), { ...P(k * PI / 36, RI - 1.38, TOP + 0.3) }));
    kit.add('metal', new THREE.TorusGeometry(RI - 1.38, 0.03, 5, 120).rotateX(PI / 2).translate(c.x, TOP + 1.25, c.z));
    // the stacks: shelves round the wall on every level, freestanding radial stacks in the galleries, desks at the rail
    const bookKinds = ['roof', 'barn', 'trim', 'leaf', 'wood', 'cream', 'dark'];
    let bseed = 9; const br = () => (bseed = (bseed * 16807) % 2147483647) / 2147483647;
    const shelfRow = (place, len, y0, h, rows) => { for (let rw = 0; rw < rows; rw++) { const yy = y0 + 0.12 + rw * (h - 0.15) / rows, bh = (h - 0.15) / rows - 0.07; place('woodL', 0, yy - 0.03, len, 0.03); let off = -len / 2 + 0.03; while (off < len / 2 - 0.1) { const w = 0.08 + br() * 0.13; place(bookKinds[Math.floor(br() * bookKinds.length)], off + w / 2, yy, w - 0.012, bh * (0.72 + br() * 0.28)); off += w; } } };
    const wallStack = (a0, a1, y0, h, rows) => { const n = Math.max(1, Math.round((a1 - a0) * RI / 1.4)); for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (i + 0.5) / n, len = (a1 - a0) / n * RI - 0.04; radial('wood', a, RI - 0.13, y0, 0.24, h, len);
      shelfRow((k, o, yy, w, hh) => radial(k, a + o / (RI - 0.3), RI - 0.3, yy, k === 'woodL' ? 0.05 : 0.2, hh, w), len, y0, h, rows); } };
    const radialStack = (a, lvl, y0) => { const r0 = SB1 + 0.3, r1 = RI - 0.6, len = r1 - r0, mid = (r0 + r1) / 2, h = 2.4;
      kit.add('wood', xf(box(len, h, 0.42), { ...P(a, mid, y0), ry: -a }));
      for (const sd of [-1, 1]) shelfRow((k, o, yy, w, hh) => { const p = P(a, mid + o, yy); p.x += -Math.sin(a) * sd * 0.2; p.z += Math.cos(a) * sd * 0.2; kit.add(k, xf(box(w, hh, k === 'woodL' ? 0.44 : 0.17), { ...p, ry: -a })); }, len, y0, h, 5);
      kit.add('gold', xf(box(len + 0.1, 0.08, 0.46), { ...P(a, mid, y0 + h), ry: -a })); };
    for (let l = 0; l <= 3; l++) {
      const y = LV[l], wallH = l === 3 ? 2.0 : 3.0;
      if (l > 0) { let a0 = null; for (let k = 0; k <= 180; k++) { const a = k / 180 * 2 * PI, b = busyArc(a, l); if (!b && a0 === null) a0 = a; if ((b || k === 180) && a0 !== null) { if (a - a0 > 0.1) wallStack(a0, a, y, wallH, l === 3 ? 4 : 6); a0 = null; } } }
      if (l > 0) for (let k = 0; k < 24; k++) { const a = (k + 0.5) * PI / 12; if (busyArc(a, l) || Math.abs(Math.atan2(Math.sin(a - (flights[l - 1].a0 + S)), Math.cos(a - (flights[l - 1].a0 + S)))) < 0.08) continue; radialStack(a, l, y); }
      if (l > 0) for (let k = 0; k < 16; k++) { const a = (k + 0.25) * PI / 8, rr = WELL + 1.3;
        kit.add('wood', xf(box(0.75, 0.05, 1.5), { ...P(a, rr, y + 0.74), ry: -a })); for (const sd of [-0.6, 0.6]) kit.add('wood', xf(box(0.6, 0.74, 0.05), { ...P(a + sd / rr, rr, y), ry: -a }));
        kit.add('gold', xf(cyl(0.06, 0.07, 0.03, 10), { ...P(a, rr + 0.2, y + 0.79) })); kit.add('gold', xf(cyl(0.012, 0.012, 0.3, 5), { ...P(a, rr + 0.2, y + 0.82) }));
        kit.add('shade', xf(new THREE.CylinderGeometry(0.07, 0.12, 0.1, 12, 1, true), { ...P(a, rr + 0.2, y + 1.12) })); kit.add('glow', xf(new THREE.SphereGeometry(0.035, 8, 6), { ...P(a, rr + 0.2, y + 1.1) }));
        kit.add('cream', xf(box(0.26, 0.02, 0.34), { ...P(a - 0.05, rr - 0.1, y + 0.78), ry: -a + 0.2 }));
        kit.add('wood', xf(box(0.42, 0.05, 0.42), { ...P(a, rr - 0.8, y + 0.44), ry: -a })); kit.add('wood', xf(box(0.05, 0.5, 0.42), { ...P(a, rr - 1.0, y + 0.46), ry: -a })); for (const [du, dv] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) kit.add('wood', xf(box(0.04, 0.44, 0.04), { ...P(a + dv / rr, rr - 0.8 + du, y), ry: -a }));
      }
    }
    // the ground floor: timber booths under the first gallery (O3), long tables, a lounge
    wallStack(deg(20), deg(110), LV[0], 3.0, 6);
    const booths = []; for (let k = 0; k < 18; k++) { const a = deg(125 + k * 12.5); if (a > deg(345)) break; booths.push(a); }
    booths.forEach((a, i) => {
      const half = deg(5.6), rf = RI - 2.1, rc = RI - 1.05;
      for (const s of [-1, 1]) { kit.add('wood', xf(box(0.12, 2.7, 0.12), { ...P(a + s * half, rf, LV[0]) })); radial('wood', a + s * half, (rf + RI) / 2, LV[0] + 2.7, RI - rf, 0.1, 0.08); radial('wood', a + s * half, RI - 0.95, LV[0], 1.8, 1.5, 0.06); }
      for (let k = 0; k < 8; k++) radial('wood', a, rf + 0.1 + k * 0.26, LV[0] + 2.8, 0.05, 0.06, 2 * half * rc + 0.2);
      radial('wood', a, rc, LV[0] + 0.72, 0.8, 0.06, 1.0); radial('wood', a, rc, LV[0], 0.08, 0.72, 0.08);
      for (const s of [-1, 1]) { radial('wood', a + s * deg(3.6), rc, LV[0], 1.0, 0.44, 0.3); radial('fabric', a + s * deg(3.6), rc, LV[0] + 0.44, 0.95, 0.06, 0.28); }
      kit.add('wood', xf(cyl(0.01, 0.01, 0.4, 4), { ...P(a, rc, LV[0] + 2.3) })); kit.add('glow', xf(box(0.14, 0.22, 0.14), { ...P(a, rc, LV[0] + 2.05) })); kit.add('wood', xf(box(0.18, 0.03, 0.18), { ...P(a, rc, LV[0] + 2.28) }));
      for (let k = 0; k <= 10; k++) { const t = k / 10, aa = a - half + 2 * half * t, p = P(aa, rf, LV[0] + 2.6 - Math.sin(t * PI) * 0.25); kit.add('glow', new THREE.SphereGeometry(0.025, 6, 4).translate(p.x, p.y, p.z)); }
    });
    const BB = booths[13];
    for (const a of [deg(150), deg(205), deg(260), deg(315)]) { radial('wood', a, 6.4, LV[0] + 0.74, 2.6, 0.06, 0.9); for (const s of [-1, 1]) radial('wood', a, 6.4 + s * 1.1, LV[0], 0.08, 0.74, 0.8); for (let k = 0; k < 3; k++) for (const sd of [-1, 1]) radial('wood', a + sd * 0.115, 5.6 + k * 0.8, LV[0] + 0.44, 0.4, 0.05, 0.4); }
    // the cache behind the false bookcase on the second gallery
    { const nr0 = RI, nr1 = RI + 0.32, ny = LV[2];
      wall('dark', nr1, ny, ny + 2.6, NICHE - NW, NICHE + NW, true); for (const s of [-1, 1]) radial('dark', NICHE + s * NW, (nr0 + nr1) / 2, ny, nr1 - nr0, 2.6, 0.02);
      sector('dark', nr0, nr1, NICHE - NW, NICHE + NW, ny + 2.62, 0.02); radial('wood', NICHE, nr1 - 0.05, ny + 1.9, 0.06, 0.06, 1.4);
      for (const [da, h] of [[-0.05, 1.3], [-0.02, 1.35], [0.01, 1.3]]) { const a = NICHE + da; radial('void', a, nr1 - 0.1, ny + 0.4, 0.07, h, 0.08); radial('vglow', a, nr1 - 0.145, ny + 0.5, 0.005, h - 0.25, 0.015); radial('metal', a, nr1 - 0.12, ny + 0.4 + h, 0.03, 0.25, 0.03); }
      for (const da of [0.035, 0.055]) { const a = NICHE + da; radial('void', a, nr1 - 0.09, ny + 0.8, 0.014, 1.1, 0.06); radial('vglow', a, nr1 - 0.1, ny + 0.82, 0.014, 1.05, 0.014); }
      for (let k = 0; k < 5; k++) kit.add('vglow', xf(cyl(0.04, 0.04, 0.18, 8), { ...P(NICHE - 0.05 + k * 0.025, nr1 - 0.14, ny + 0.06) })); }
    // the bench cache in a booth
    radial('void', BB, RI - 1.05, LV[0] + 0.05, 0.8, 0.14, 0.14); radial('vglow', BB, RI - 1.05, LV[0] + 0.2, 0.6, 0.01, 0.05);
    // crates of "acquisitions" on the catwalk
    for (const [a, open] of [[deg(150), false], [deg(156), true], [deg(163), false]]) { radial('wood', a, RI - 0.7, TOP + 0.3, 0.5, 0.45, 0.6); if (open) { radial('vglow', a, RI - 0.7, TOP + 0.76, 0.4, 0.01, 0.5); radial('wood', a + 0.04, RI - 0.5, TOP + 0.75, 0.5, 0.03, 0.6); } }
    // the statue and its hollow pedestal (the secret entrance), at 1.65× the model's size
    { const SK = new Kit(), o = V(0, 0, 0), PB = 1.3;
      const wallS = (kind, r, y0, y1, a0, a1, inward) => { const g = new THREE.CylinderGeometry(r, r, y1 - y0, 40, 1, true, A2T(a1), a1 - a0).translate(0, (y0 + y1) / 2, 0); SK.add(kind, inward ? flip(g) : g); };
      const PD = deg(270), PW = 0.36;
      wallS('stone', 0.95, 0, PB, PD + PW, PD + 2 * PI - PW); wallS('stone', 0.88, 0, PB, PD + PW, PD + 2 * PI - PW, true); wallS('stone', 0.95, 1.15, PB, PD - PW, PD + PW); wallS('stone', 0.88, 1.15, PB, PD - PW, PD + PW, true);
      SK.add('dark', flip(new THREE.CircleGeometry(0.88, 32).rotateX(-PI / 2)).translate(0, 1.15, 0)); SK.add('trim', xf(cyl(1.02, 1.02, 0.16, 36), { y: PB }));
      SK.add('gold', new THREE.TorusGeometry(0.96, 0.025, 4, 48, 2 * PI - 0.8).rotateX(PI / 2).rotateY(-(PD + 0.4)).translate(0, 0.85, 0));
      const SB_ = PB + 0.16;
      SK.add('trim', new THREE.LatheGeometry([[0.78, 0], [0.72, 0.35], [0.6, 2.0], [0.5, 3.6], [0.45, 4.8], [0.56, 5.45], [0.5, 5.7], [0.22, 5.95], [0.16, 6.05], [0.001, 6.06]].map(([r, y]) => new THREE.Vector2(r, y)), 32).translate(0, SB_, 0));
      for (const [y, r] of [[1.2, 0.665], [2.9, 0.555], [4.2, 0.48]]) SK.add('glow', new THREE.TorusGeometry(r, 0.018, 4, 40).rotateX(PI / 2).translate(0, SB_ + y, 0));
      SK.add('trim', new THREE.SphereGeometry(0.3, 20, 16).scale(1, 1.1, 0.95).translate(0.03, SB_ + 6.38, 0)); SK.add('trim', new THREE.SphereGeometry(0.32, 16, 10, 0, 2 * PI, 0, PI / 2).scale(1.05, 1, 1.05).translate(-0.04, SB_ + 6.45, 0));
      for (const s of [-1, 1]) SK.add('glow', box(0.02, 0.025, 0.09).translate(0.31, SB_ + 6.42, s * 0.1));
      SK.add('glow', new THREE.TorusGeometry(0.58, 0.035, 6, 40).rotateY(PI / 2).translate(-0.28, SB_ + 6.5, 0));
      for (let k = 0; k < 9; k++) { const t = -PI / 2 + k * PI / 8; SK.add('gold', new THREE.ConeGeometry(0.04, 0.32, 4).translate(0, 0.16, 0).rotateX(t).translate(-0.3, SB_ + 6.5 + Math.cos(t) * 0.6, Math.sin(t) * 0.6)); }
      for (const s of [-1, 1]) {
        tubeSeg(SK, 'trim', V(0.05, SB_ + 5.55, s * 0.47), V(0.42, SB_ + 4.85, s * 0.36), 0.12, 0.09); ball(SK, 'trim', V(0.42, SB_ + 4.85, s * 0.36), 0.095);
        tubeSeg(SK, 'trim', V(0.42, SB_ + 4.85, s * 0.36), V(0.62, SB_ + 4.98, s * 0.24), 0.085, 0.07); ball(SK, 'trim', V(0.64, SB_ + 4.99, s * 0.23), 0.08);
        SK.add('cream', xf(box(0.03, 0.5, 0.34), { x: 0.7, y: SB_ + 4.82, z: s * 0.17, ry: s * 0.35, rz: 0.35 })); SK.add('gold', xf(box(0.025, 0.54, 0.37), { x: 0.68, y: SB_ + 4.8, z: s * 0.185, ry: s * 0.35, rz: 0.35 }));
        for (let k = 0; k < 5; k++) SK.add('glow', xf(box(0.032, 0.012, 0.24), { x: 0.71 - k * 0.028, y: SB_ + 4.68 + k * 0.08, z: s * 0.17, ry: s * 0.35, rz: 0.35 }));
      }
      const feather = (() => { const sh = new THREE.Shape(); sh.moveTo(-0.16, 0); sh.quadraticCurveTo(-0.45, 1.3, 0.15, 2.5); sh.quadraticCurveTo(0.22, 1.4, 0.2, 0); sh.closePath(); return sh; })();
      for (const [tilt, len, y] of [[0.32, 1.0, 5.55], [0.95, 0.75, 5.2]]) for (const s of [-1, 1]) { let g = new THREE.ExtrudeGeometry(feather, { depth: 0.05, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -0.025).scale(len, len, 1).rotateZ(-tilt); if (s < 0) g = flip(g.scale(-1, 1, 1)); g.rotateY(-PI / 2).translate(-0.32, SB_ + y, s * 0.22); SK.add('cream', g); }
      // the spiral stair inside the pedestal, down a shaft (the walk fades into the lab at the bottom)
      SK.add('metal', xf(cyl(0.1, 0.1, 4.0, 10), { y: -4.0 })); for (let k = 0; k < 10; k++) { const a = PD + 0.25 + k * 0.42, top = -(k + 1) * 0.36; SK.add('metal', xf(box(0.74, 0.06, 0.3).translate(0.5, -0.06, 0), { y: top, ry: -a })); SK.add('vglow', xf(box(0.02, 0.02, 0.28).translate(0.86, -0.02, 0), { y: top, ry: -a })); }
      SK.add('concrete', flip(new THREE.CylinderGeometry(0.88, 0.88, 4.0, 28, 1, true).translate(0, -2.0, 0)));
      for (const [k, g] of Object.entries(SK.merge())) kit.add(k, g.scale(PS, PS, PS).translate(c.x, LV[0], c.z));
    }
    ARCHI = { c, R, RI, WELL, LV, TOP, OY, flights, S, NST, stepH, rs, SB0, SB1, NICHE, NW, NR1: RI + 0.32, LAD, BB, PS, PD: deg(270), booths, DOOR };
  }
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

  // ---- the Undercroft, cut away: a slice of the north hill removed so you can see into Nera's lab.
  //      Behind the lab (hidden in the hill): her living quarters, a vault hall and a bunker behind a round vault door.
  //      Stairs climb out of the lab to the Archive above, where she works as an archivist.
  const lab = (() => {
    const th0 = 1.5 * PI, r0 = rimR(th0) - 0.3, C = V(Math.cos(th0) * r0, 0, Math.sin(th0) * r0);
    const LP = (u, y, w) => V(C.x - u, y, C.z - w);                 // local: u across, w outward (into the hill is -w)
    const F = (u, y, w, o = {}) => ({ ...LP(u, y, w), ry: PI, ...o });
    const B = (kind, su, h, sw, u, y, w, o) => kit.add(kind, xf(box(su, h, sw), F(u, y, w, o)));
    const span = (kind, u0, u1, w0, w1, y, h) => B(kind, u1 - u0, h, w1 - w0, (u0 + u1) / 2, y, (w0 + w1) / 2);
    // the cut faces: two side walls along the slice, following the slope profile exactly
    for (const i of [LAB_I0, LAB_I1]) {
      const th = i / SKIRT_N * PI * 2, pts = [];
      for (let k = 0; k <= SKIRT_K; k++) { const [x, y, z] = skirtPoint(0, 0, mainTop, -CAP, SP, 1.3, i, k); pts.push(new THREE.Vector2(Math.hypot(x, z), y)); }
      const rIn = rimR(th) - 0.45;
      const shape = new THREE.Shape([new THREE.Vector2(rIn, -CAP - 0.1), ...pts, new THREE.Vector2(pts[pts.length - 1].x, FLOOR - 0.05), new THREE.Vector2(rIn, FLOOR - 0.05)]);
      kit.add('earth2', new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false }).translate(0, 0, -0.09).rotateY(-th));
      for (const [y0, y1] of [[-1.7, -1.62], [-2.6, -2.52]]) {
        const band = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(rIn, y0), new THREE.Vector2(pts[pts.length - 1].x - 0.2, y0), new THREE.Vector2(pts[pts.length - 1].x - 0.2, y1), new THREE.Vector2(rIn, y1)]), { depth: 0.2, bevelEnabled: false }).translate(0, 0, -0.1).rotateY(-th);
        kit.add('earth', band);
      }
    }
    const U = 5.6, D = 6.6, H0 = FLOOR + 0.12, H1 = -CAP - 0.25, Hh = H1 - H0;
    const hw = r0 * Math.sin(LAB_A + 0.01);
    const face = new THREE.Shape([new THREE.Vector2(-hw, FLOOR - 0.05), new THREE.Vector2(hw, FLOOR - 0.05), new THREE.Vector2(hw, -CAP - 0.1), new THREE.Vector2(-hw, -CAP - 0.1)]);
    face.holes.push(new THREE.Path([new THREE.Vector2(-5.3, H0), new THREE.Vector2(5.3, H0), new THREE.Vector2(5.3, H1), new THREE.Vector2(-5.3, H1)]));
    kit.add('earth2', xf(new THREE.ExtrudeGeometry(face, { depth: 0.25, bevelEnabled: false }), F(0, 0, 0)));
    B('concrete', 11.8, 0.55, 1.3, 0, H1 - 0.05, 0.35);                                  // cantilevered lintel
    B('concrete', 12.2, 0.12, 1.5, 0, H1 + 0.5, 0.3);
    for (const u of [-5.55, 5.55]) B('concrete', 0.55, H1 - H0, 0.9, u, H0, 0.2);
    B('vglow', 10.4, 0.04, 0.05, 0, H1 - 0.08, 1.0);                                     // a seam of void light under the lintel

    // ---- the lab
    for (const [u0, u1, w0, w1] of [[-U, 0.75, -D, 0], [1.65, U, -D, 0], [0.75, 1.65, -D, -1.35], [0.75, 1.65, -0.45, 0]]) span('void', u0, u1, w0, w1, H0 - 0.12, 0.12);
    span('concrete', -U - 0.3, -U, -10.9, 0, H0, Hh); span('concrete', U, U + 0.3, -15.1, 0, H0, Hh);       // the long side walls
    span('concrete', -U, -1.85, -D - 0.3, -D, H0, Hh); span('concrete', -0.75, U, -D - 0.3, -D, H0, Hh); span('concrete', -1.85, -0.75, -D - 0.3, -D, H0 + 2.0, Hh - 2.0);
    B('vglow', 1.2, 0.04, 0.04, -1.3, H0 + 2.0, -D + 0.02);
    for (const u of [-1.88, -0.72]) B('vglow', 0.04, 2.0, 0.04, u, H0, -D + 0.02);
    for (let k = 1; k < 7; k++) {                                                           // board-marked concrete
      span('void', -U + 0.05, -1.95, -D + 0.01, -D + 0.03, H0 + k * Hh / 7, 0.02); span('void', -0.65, U - 0.05, -D + 0.01, -D + 0.03, H0 + k * Hh / 7, 0.02);
      for (const u of [-U + 0.02, U - 0.02]) B('void', 0.02, 0.02, D - 0.1, u, H0 + k * Hh / 7, -D / 2);
    }
    // ceiling, with a slot where the stair climbs out toward the Archive
    // ceiling, with a hole where the spiral stair from the Archive's statue comes down
    const SH = { u0: -2.15, u1: -0.25, w0: -5.19, w1: -3.29 };
    span('concrete', -U - 0.3, U + 0.3, -D - 0.3, SH.w0, H1, 0.3); span('concrete', -U - 0.3, U + 0.3, SH.w1, 0, H1, 0.3);
    span('concrete', -U - 0.3, SH.u0, SH.w0, SH.w1, H1, 0.3); span('concrete', SH.u1, U + 0.3, SH.w0, SH.w1, H1, 0.3);
    for (let i = 0; i < 9; i++) { const u = -3.6 + i * 1.1; if (u > SH.u0 - 0.15 && u < SH.u1 + 0.15) { span('concrete', u - 0.11, u + 0.11, -D, SH.w0, H1 - 0.32, 0.32); span('concrete', u - 0.11, u + 0.11, SH.w1, 0, H1 - 0.32, 0.32); } else B('concrete', 0.22, 0.32, D, u, H1 - 0.32, -D / 2); }
    for (let j = 0; j < 6; j++) { const w0 = -0.62 - j * 1.15, w1 = -0.4 - j * 1.15; if (w1 > SH.w0 && w0 < SH.w1) { span('concrete', -U, SH.u0, w0, w1, H1 - 0.32, 0.32); span('concrete', SH.u1, U, w0, w1, H1 - 0.32, 0.32); } else span('concrete', -U, U, w0, w1, H1 - 0.32, 0.32); }
    for (const u of [-3.6, 3.6]) { B('concrete', 0.55, Hh, 0.55, u, H0, -3.4); B('vglow', 0.04, Hh * 0.8, 0.04, u, H0 + Hh * 0.1, -3.11); }
    for (const u of [-2.6, 1.6]) B('vglow', 1.4, 0.04, 0.08, u, H1 - 0.36, -1.9);          // hanging lamps
    B('vglow', 2 * U - 0.2, 0.03, 0.04, 0, H0 + 0.01, -D + 0.05);
    // her desk, lamp and papers
    B('concrete', 1.3, 0.55, 0.6, -3.2, H0, -0.9);
    kit.add('vglow', xf(new THREE.OctahedronGeometry(0.08), F(-3.65, H0 + 0.7, -0.9)));
    for (let k = 0; k < 3; k++) kit.add('stone', xf(box(0.28, 0.01, 0.2), F(-3.1 + k * 0.18, H0 + 0.56, -0.85 - k * 0.05, { ry: PI + k * 0.3 })));
    // the slab and the Storyborn's body, its written skin still glowing
    B('dark', 1.9, 0.62, 0.85, -1.4, H0, -2.8); B('trim', 2.0, 0.08, 0.95, -1.4, H0 + 0.62, -2.8);
    kit.add('stone', xf(new THREE.CapsuleGeometry(0.17, 1.1, 4, 10).rotateZ(PI / 2), F(-1.35, H0 + 0.88, -2.8)));
    kit.add('stone', xf(new THREE.SphereGeometry(0.15, 10, 8), F(-2.15, H0 + 0.9, -2.8)));
    for (let k = 0; k < 6; k++) kit.add('glow', xf(new THREE.TorusGeometry(0.18, 0.018, 4, 18).rotateY(PI / 2), F(-1.85 + k * 0.17, H0 + 0.88, -2.8)));
    B('glow', 1.1, 0.02, 0.04, -1.35, H0 + 1.06, -2.8);
    // the specimen table: a Storyborn's arm, worked on by her machine arm (which hangs from the rail above)
    B('dark', 1.4, 0.62, 0.8, 2.2, H0, -2.7); B('trim', 1.5, 0.08, 0.9, 2.2, H0 + 0.62, -2.7);
    B('metal', 0.08, 0.08, 2.2, 2.2, H1 - 0.42, -2.7); for (const w of [-1.7, -3.7]) B('metal', 0.04, 0.1, 0.04, 2.2, H1 - 0.34, w);
    {
      const yt = H0 + 0.7, P = (u, y, w) => LP(u, yt + y, w);
      const S = P(1.72, 0.06, -2.72), E = P(2.0, 0.055, -2.66), Wr = P(2.25, 0.045, -2.69);
      tubeSeg(kit, 'stone', S, E, 0.055, 0.047); ball(kit, 'stone', E, 0.048); tubeSeg(kit, 'stone', E, Wr, 0.046, 0.033); ball(kit, 'stone', Wr, 0.034);
      kit.add('dark', new THREE.CylinderGeometry(0.056, 0.056, 0.012, 16).rotateZ(PI / 2).translate(S.x + 0.002, S.y, S.z));
      kit.add('vglow', new THREE.TorusGeometry(0.05, 0.007, 4, 20).rotateY(PI / 2).translate(S.x + 0.008, S.y, S.z));
      for (const [a, b, ts, rr] of [[S, E, [0.35, 0.7], 0.054], [E, Wr, [0.3, 0.55, 0.8], 0.044]]) for (const t of ts) {
        const p = a.clone().lerp(b, t); kit.add('glow', new THREE.TorusGeometry(rr - t * 0.008, 0.005, 4, 20).rotateY(PI / 2).translate(p.x, p.y, p.z));
      }
      const pc = P(2.33, 0.034, -2.7); kit.add('stone', box(0.085, 0.024, 0.08).translate(pc.x, pc.y - 0.012, pc.z));
      [[-0.03, 0.024], [-0.01, 0.029], [0.01, 0.028], [0.03, 0.021]].forEach(([off, len]) => {
        let p = P(2.37, 0.034, -2.7 + off);
        [0.25, 0.6, 0.95].forEach((a, i) => { const q = p.clone().add(V(-len * Math.cos(a) * (1 - i * 0.18), -len * Math.sin(a) * (1 - i * 0.18), 0)); tubeSeg(kit, 'stone', p, q, 0.0095 - i * 0.001, 0.0085 - i * 0.001); ball(kit, 'stone', q, 0.0085 - i * 0.001); p = q; });
      });
      let p = P(2.31, 0.03, -2.7 + 0.045);
      for (const [dx, dy, dz, len] of [[-0.55, -0.1, -0.8, 0.03], [-0.85, -0.25, -0.45, 0.026]]) { const d = V(dx, dy, dz).normalize(), q = p.clone().addScaledVector(d, len); tubeSeg(kit, 'stone', p, q, 0.011, 0.009); ball(kit, 'stone', q, 0.009); p = q; }
    }
    // specimen vats along the east wall
    for (const w of [-1.3, -2.6, -3.9, -5.2]) {
      B('dark', 0.72, 0.18, 0.72, 4.9, H0, w);
      kit.add('vglow', xf(cyl(0.24, 0.24, 1.05, 14), F(4.9, H0 + 0.18, w)));
      for (let k = 0; k < 4; k++) { const a = k * PI / 2; kit.add('gold', xf(box(0.04, 1.05, 0.04), F(4.9 + Math.cos(a) * 0.3, H0 + 0.18, w + Math.sin(a) * 0.3))); }
      kit.add('dark', xf(cyl(0.34, 0.3, 0.16, 14), F(4.9, H0 + 1.23, w)));
    }
    // her board of diagrams on the back wall
    B('void', 1.7, 0.95, 0.05, 3.4, H0 + 0.6, -D + 0.04);
    for (const [rr, du] of [[0.28, 3.0], [0.16, 3.0], [0.2, 3.75]]) kit.add('glow', xf(new THREE.TorusGeometry(rr, 0.012, 4, 24), F(du, H0 + 1.1, -D + 0.08)));
    for (let k = 0; k < 4; k++) B('glow', 0.5 - k * 0.08, 0.012, 0.01, 3.75, H0 + 0.78 - k * 0.07, -D + 0.08);
    // bookshelf against the back wall
    B('concrete', 1.9, 1.75, 0.4, -3.6, H0, -D + 0.2);
    const bk = ['roof', 'gold', 'trim', 'leaf', 'roof'];
    for (let row = 0; row < 3; row++) for (let b = 0; b < 9; b++) kit.add(bk[(b + row) % bk.length], xf(box(0.14, 0.38 + ((b * 7 + row) % 3) * 0.05, 0.26), F(-4.23 + b * 0.16, H0 + 0.12 + row * 0.55, -D + 0.24)));
    // a relay (her battery) and the panel she had to build: the Voided just touch a station, she can't
    const relayAt = (u, w, s = 1) => {
      kit.add('concrete', xf(cyl(0.48 * s, 0.5 * s, 0.16, 18), F(u, H0, w)));
      kit.add('void', xf(cyl(0.4 * s, 0.42 * s, 0.38, 18), F(u, H0 + 0.16, w)));
      kit.add('glass', xf(cyl(0.33 * s, 0.33 * s, 1.25 * s, 20), F(u, H0 + 0.54, w)));
      kit.add('vglow', xf(cyl(0.11 * s, 0.11 * s, 1.25 * s, 12), F(u, H0 + 0.54, w)));
      for (let k = 0; k < 6; k++) { const a = k * PI / 3; kit.add('metal', xf(box(0.035, 1.25 * s, 0.035), F(u + Math.cos(a) * 0.36 * s, H0 + 0.54, w + Math.sin(a) * 0.36 * s))); }
      for (const y of [0.54, 0.54 + 0.62 * s, 0.54 + 1.25 * s]) kit.add('gold', xf(new THREE.TorusGeometry(0.37 * s, 0.022, 6, 24).rotateX(PI / 2), F(u, H0 + y, w)));
      kit.add('void', xf(cyl(0.42 * s, 0.4 * s, 0.26, 18), F(u, H0 + 0.54 + 1.25 * s, w)));
      kit.add('concrete', xf(cyl(0.26 * s, 0.3 * s, 0.1, 14), F(u, H0 + 0.8 + 1.25 * s, w)));
      kit.add('vglow', xf(cyl(0.05, 0.05, 0.12, 8), F(u, H0 + 0.9 + 1.25 * s, w)));
    };
    relayAt(1.0, -6.0);
    B('concrete', 0.8, 0.85, 0.42, 1.0, H0, -4.95);                                       // the panel: a pedestal, a slanted top, a palm plate
    kit.add('concrete', xf(box(0.88, 0.07, 0.52), F(1.0, H0 + 0.85, -4.98, { rx: -0.45 })));
    kit.add('stone', xf(cyl(0.11, 0.11, 0.02, 20), F(1.15, H0 + 0.92, -4.92, { rx: -0.45 })));
    for (let k = 0; k < 5; k++) { const a = -0.9 + k * 0.45; kit.add('gold', xf(cyl(0.013, 0.013, 0.03, 6), F(1.15 + Math.sin(a) * 0.075, H0 + 0.935 + Math.cos(a) * 0.03, -4.92 - Math.cos(a) * 0.065, { rx: -0.45 }))); }
    B('metal', 0.05, 0.55, 0.05, 0.75, H0 + 0.88, -5.12);
    for (const du of [-0.1, 0.1]) B('vglow', 0.03, 0.012, 0.6, 1.0 + du, H0, -5.5);
    // trapdoor frame (the lid is its own mesh)
    for (const [du, dw, w_, d_] of [[0, 0.47, 0.98, 0.04], [0, -0.47, 0.98, 0.04], [0.47, 0, 0.04, 0.98], [-0.47, 0, 0.04, 0.98]]) B('vglow', w_, 0.03, d_, 1.2 + du, H0 + 0.02, -0.9 + dw);

    // ---- behind the lab: her quarters (west) and the vault hall (east), the bunker beyond the vault door
    span('void', -U, U, -10.6, -D - 0.3, H0 - 0.12, 0.12);
    span('concrete', -U - 0.3, U + 0.3, -10.9, -D - 0.3, H1, 0.3);
    span('concrete', 0, 0.3, -10.6, -8.3, H0, Hh); span('concrete', 0, 0.3, -7.3, -D - 0.3, H0, Hh); span('concrete', 0, 0.3, -8.3, -7.3, H0 + 2.0, Hh - 2.0);
    span('concrete', -U - 0.3, 2.25, -10.9, -10.6, H0, Hh); span('concrete', 3.75, U, -10.9, -10.6, H0, Hh); span('concrete', 2.25, 3.75, -10.9, -10.6, H0 + 1.6, Hh - 1.6);
    // quarters: a bed, a table and two chairs, a wardrobe, shelves, a basin, a rug, a lamp
    B('dark', 1.0, 0.3, 1.9, -4.8, H0, -9.6); B('trim', 0.92, 0.12, 1.8, -4.8, H0 + 0.3, -9.6); B('roof', 0.96, 0.06, 1.2, -4.8, H0 + 0.42, -9.95); B('stone', 0.6, 0.08, 0.3, -4.8, H0 + 0.42, -8.85);
    B('dark', 1.0, 0.05, 0.8, -2.4, H0 + 0.7, -9.6); for (const [a, b] of [[-0.42, -0.32], [0.42, -0.32], [-0.42, 0.32], [0.42, 0.32]]) B('dark', 0.05, 0.7, 0.05, -2.4 + a, H0, -9.6 + b);
    for (const du of [-0.75, 0.75]) { B('dark', 0.4, 0.05, 0.4, -2.4 + du, H0 + 0.42, -9.6); B('dark', 0.05, 0.45, 0.4, -2.4 + du * 1.25, H0 + 0.47, -9.6); for (const [a, b] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) B('dark', 0.04, 0.42, 0.04, -2.4 + du + a, H0, -9.6 + b); }
    kit.add('glow', xf(new THREE.OctahedronGeometry(0.07), F(-2.1, H0 + 0.82, -9.7)));
    B('gold', 0.14, 0.18, 0.02, -2.6, H0 + 0.75, -9.4, { rx: -0.2 }); B('stone', 0.1, 0.14, 0.022, -2.6, H0 + 0.77, -9.39, { rx: -0.2 });
    B('dark', 0.6, 1.9, 1.0, -5.25, H0, -7.5); for (const w of [-7.45, -7.55]) B('gold', 0.02, 0.2, 0.02, -4.93, H0 + 1.0, w);
    for (const y of [0.9, 1.4]) { B('concrete', 1.6, 0.04, 0.26, -2.4, H0 + y, -10.47); for (let b = 0; b < 7; b++) B(bk[b % bk.length], 0.12, 0.26 + (b % 3) * 0.04, 0.2, -3.0 + b * 0.17, H0 + y + 0.04, -10.47); }
    B('stone', 0.6, 0.75, 0.45, -0.6, H0, -10.3); kit.add('trim', xf(cyl(0.2, 0.16, 0.08, 14), F(-0.6, H0 + 0.75, -10.3)));
    B('barn', 1.6, 0.012, 1.1, -3.2, H0, -8.4);
    B('glow', 0.5, 0.04, 0.08, -2.6, H1 - 0.06, -8.6);
    // vault hall: supply shelves and the round vault door, swung open
    for (const w of [-7.6, -8.8]) { B('concrete', 0.5, 1.7, 1.0, 5.25, H0, w); for (let row = 0; row < 3; row++) for (let b = 0; b < 3; b++) B(['trim', 'dark', 'barn'][(b + row) % 3], 0.36, 0.28, 0.28, 5.2, H0 + 0.1 + row * 0.55, w - 0.3 + b * 0.3); }
    kit.add('metal', xf(new THREE.TorusGeometry(1.12, 0.12, 10, 40), F(3.0, H0 + 1.0, -10.55)));
    for (let k = 0; k < 8; k++) { const a = k * PI / 4; kit.add('gold', xf(cyl(0.035, 0.035, 0.08, 8).rotateX(PI / 2), F(3.0 + Math.cos(a) * 1.12, H0 + 1.0 + Math.sin(a) * 1.12, -10.42))); }
    kit.add('metal', xf(new THREE.CylinderGeometry(1.05, 1.05, 0.3, 40).rotateZ(PI / 2), F(4.32, H0 + 1.0, -9.5)));
    kit.add('dark', xf(new THREE.CylinderGeometry(0.8, 0.8, 0.31, 32).rotateZ(PI / 2), F(4.32, H0 + 1.0, -9.5)));
    kit.add('gold', xf(new THREE.TorusGeometry(0.34, 0.035, 6, 24).rotateY(PI / 2), F(4.1, H0 + 1.0, -9.5)));
    for (let k = 0; k < 3; k++) kit.add('gold', xf(box(0.03, 0.66, 0.03).rotateX(k * PI / 3), F(4.1, H0 + 1.0, -9.5)));
    for (const dy of [-0.6, 0.6]) B('metal', 0.3, 0.16, 0.3, 4.1, H0 + 1.0 + dy - 0.08, -10.5);
    // the bunker: thick concrete, bunks, a map table, crates, water tanks, a backup relay, a red emergency lamp
    span('void', 0.3, U, -14.8, -10.9, H0 - 0.12, 0.12);
    span('concrete', 0, 0.3, -15.1, -10.9, H0, Hh); span('concrete', 0, U + 0.3, -15.1, -14.8, H0, Hh); span('concrete', 0, U + 0.3, -15.1, -10.9, H1, 0.5);
    for (const w of [-11.6, -13.4]) for (const du of [-0.38, 0.38]) B('metal', 0.05, 1.75, 0.05, 0.85 + du, H0, w);
    for (const y of [0.35, 1.3]) { B('metal', 0.82, 0.06, 1.85, 0.85, H0 + y, -12.5); B('trim', 0.76, 0.1, 1.75, 0.85, H0 + y + 0.06, -12.5); B('roof', 0.78, 0.04, 0.9, 0.85, H0 + y + 0.16, -12.8); }
    B('dark', 1.2, 0.78, 0.8, 3.2, H0, -13.3); B('vglow', 1.0, 0.012, 0.6, 3.2, H0 + 0.78, -13.3);
    [[5.0, -11.5, 0.5, 0, 'barn'], [5.0, -12.1, 0.45, 0, 'trim'], [5.0, -11.75, 0.4, 0.5, 'dark'], [4.4, -11.4, 0.45, 0, 'trim']].forEach(([u, w, s, y, k]) => B(k, s, s, s, u, H0 + y, w));
    for (const [u, w] of [[4.9, -14.25], [4.1, -14.35]]) { kit.add('metal', xf(cyl(0.35, 0.35, 1.4, 18), F(u, H0, w))); kit.add('gold', xf(new THREE.TorusGeometry(0.355, 0.02, 4, 24).rotateX(PI / 2), F(u, H0 + 0.7, w))); }
    relayAt(1.1, -14.2, 0.7);
    B('red', 0.3, 0.06, 0.1, 3.0, H1 - 0.06, -12.8);
    L('The Undercroft · Nera\'s lab (Voided)', LP(0, 0.9, 0.6));

    const start = LP(1.2, H0, -0.9);
    const hatch = V(-10.9, FLOOR, -30.5);           // the temple's way up to the prairie (its spiral stair comes up here)
    // the passage: down under the lab, out under the valley, into the temple through a gallery in its south wall
    const g_ = FLOOR + 0.05, out = LP(1.2, 0, 1.2);
    const tunnel = [start.clone().setY(H0 + 0.02), V(out.x, g_, out.z), V(TUN.mouthX, g_, -21.4), V(TUN.mouthX, g_, -23.0)];
    for (const [dx, dz, w_, d_] of [[0, -0.8, 1.9, 0.3], [0, 0.8, 1.9, 0.3], [-0.8, 0, 0.3, 1.3], [0.8, 0, 0.3, 1.3]])
      kit.add('hatch', xf(box(w_, 0.45, d_), { x: hatch.x + dx, y: FLOOR - 0.05, z: hatch.z + dz }));
    kit.add('hatchglow', xf(box(1.3, 0.03, 0.05), { x: hatch.x, y: FLOOR + 0.41, z: hatch.z - 0.66 }));
    L('Hatch · up from the temple', hatch.clone().add(V(0, 1.6, 0)));
    return { light: LP(0, H0 + 1.6, -3.0), quarters: LP(-2.6, H0 + 1.7, -8.6), bunker: LP(3.0, H0 + 1.7, -12.8), tunnel, hatch, LP, H0, H1, D, U, trap: start.clone(), out,
      armMount: LP(2.2, H1 - 0.52, -2.7), armTarget: LP(2.05, H0 + 0.72, -2.68), screen: { p: LP(1.0, H0 + 1.33, -5.12), ry: 0 } };
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
const renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.4, 0.9); composer.addPass(bloom);
composer.addPass(new OutputPass());

const state = { theme: 'crt', after: 0, t: 0, showTags: true };
let templeAt = null;
let fpGroup = null, trapLid = null, hatchLid = null, dustPts = null, dripFx = [], roomLights = [];
const WALK = {};
let scarLow = null, labLight = null, labLight2 = null, passage = null, runner = null, nera = null;
let root = null, liftCars = [], scar = null, orin = null, seaMesh = null, magic = null, flags = [], lanterns = null, lanternData = [], rings = [], falls = [];

function build() {
  if (root) { scene.remove(root); root.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => m.dispose()); }); }
  root = new THREE.Group(); scene.add(root);
  fpGroup = new THREE.Group(); fpGroup.visible = fp.on; root.add(fpGroup);
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
    metal: std(state.theme === 'crt' ? '#3a3940' : '#6c6a74', { roughness: 0.4, metalness: 0.75, flatShading: false }),
    glass: (() => { const m = new THREE.MeshStandardMaterial({ color: state.theme === 'crt' ? '#b9a8ff' : '#7a6ad8', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false }); m.onBeforeCompile = eraseInject; return m; })(),
    red: (() => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4a3a').multiplyScalar(1.6) }); m.onBeforeCompile = eraseInject; return m; })(),
    wood: std(state.theme === 'crt' ? '#5e3f26' : '#8a5a36', { roughness: 0.7 }), woodL: std(state.theme === 'crt' ? '#8a6038' : '#c49a68', { roughness: 0.65 }),
    redsteel: std(state.theme === 'crt' ? '#a8231b' : '#c8382a', { roughness: 0.45, metalness: 0.4 }), fabric: std(state.theme === 'crt' ? '#7a3528' : '#b0563e', { roughness: 1 }),
    cream: std(state.theme === 'crt' ? '#d9ccb0' : '#f1e8d4', { roughness: 0.85 }), shade: std(state.theme === 'crt' ? '#245a3a' : '#3f8a5c', { roughness: 0.5, side: THREE.DoubleSide }),
    sky: (() => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(state.theme === 'crt' ? '#bcd4ff' : '#dfeaff').multiplyScalar(state.theme === 'crt' ? 1.8 : 1) }); m.onBeforeCompile = eraseInject; return m; })(),
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
    if (!['glow', 'vglow', 'hatchglow', 'glass', 'red', 'sky', 'shade'].includes(k)) { m.castShadow = m.receiveShadow = true; const o = new THREE.Mesh(hullOf(g), outlineMaterial(th.ink, th.outlinePx)); o.raycast = () => {}; m.add(o); }
    root.add(m);
  }
  // the valley floor (prairie) on a stepped stand
  seaMesh = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 0.6, 96), new THREE.MeshStandardMaterial({ color: th.grass, roughness: 1, flatShading: true }));
  seaMesh.position.y = FLOOR - 0.3; seaMesh.receiveShadow = true; root.add(seaMesh);
  seaMesh.add(new THREE.Mesh(hullOf(seaMesh.geometry), outlineMaterial(th.ink, th.outlinePx)));
  // ---- deep ground: strata under the prairie, cut open on the north side to show the Temple of the Voided
  const DEEP = 6.6, WIN = { x0: -13.6, x1: 1.6, zIn: -23.0, y0: FLOOR - DEEP + 0.55, y1: FLOOR - 0.72 };
  const holed = (color) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vEW;').replace('#include <project_vertex>', '#include <project_vertex>\nvEW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vEW;')
        .replace('void main() {', `void main() {\n if (vEW.x > ${WIN.x0.toFixed(2)} && vEW.x < ${WIN.x1.toFixed(2)} && vEW.z < ${WIN.zIn.toFixed(2)} && vEW.y > ${WIN.y0.toFixed(2)} && vEW.y < ${WIN.y1.toFixed(2)}) discard;`);
    };
    m.customProgramCacheKey = () => 'holed';
    return m;
  };
  const strata = [th.earth2, th.earth, th.earth2, th.earth];
  for (let i = 0; i < 4; i++) {
    const h = DEEP / 4, st = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, h, 96), holed(strata[i]));
    st.position.y = FLOOR - 0.6 - h * (i + 0.5); st.receiveShadow = true; root.add(st);
  }
  for (const [r, y, h] of [[34.6, FLOOR - 0.6 - DEEP - 0.45, 0.9], [35.4, FLOOR - 0.6 - DEEP - 1.25, 0.8]]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 96), new THREE.MeshStandardMaterial({ color: th.earth2, roughness: 1 }));
    st.position.y = y; st.receiveShadow = true; root.add(st);
    st.add(new THREE.Mesh(hullOf(st.geometry), outlineMaterial(th.ink, th.outlinePx)));
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-PI / 2), new THREE.ShadowMaterial({ opacity: th.shadowOpacity }));
  ground.position.y = FLOOR - DEEP - 2.3; ground.receiveShadow = true; root.add(ground);

  // ---- the Temple of the Voided: an UNDERGROUND temple and Nera's greater laboratory, cut into the bedrock under the prairie.
  //      No windows (the lancets are blind niches of void light); the strata it was dug through show in its walls; roots come
  //      through the ceiling and water drips into black pools. (Temples above ground will be built differently.)
  //      At its heart the STATION: a split black pyramid that draws power out of the air through its beam, splits it, and sends
  //      power and word. Six RELAYS around it store and convert the power for the Voided's machines. The Voided work a station
  //      by touching it (Sils's touch); Nera can't, so she built a console. Void gates (cracks touched by nothing) in two walls.
  //      The passage from her lab comes in on a gallery in the south wall; the spiral stair goes up to the hatch.
  {
    const T = new Kit(), TF = new Kit(), cx = (WIN.x0 + WIN.x1) / 2, yF = WIN.y0, yC = WIN.y1, H = yC - yF, zB = WIN.zIn, zF = -33.2, W = WIN.x1 - WIN.x0;
    const zM = (zB + zF) / 2, D = zB - zF, HX = info.lab.hatch.x, HZ = info.lab.hatch.z, SX = cx, SZ = -28.8;
    const { Ft: gY, Ht, mouthX } = TUN, r = rng(19);
    const bx = (K, kind, x0, x1, y0, y1, z0, z1) => K.add(kind, xf(box(x1 - x0, y1 - y0, z1 - z0), { x: (x0 + x1) / 2, y: y0, z: (z0 + z1) / 2 }));
    // the shell
    bx(T, 'rock', WIN.x0 - 0.4, WIN.x1 + 0.4, yF - 0.3, yF, zF, zB);
    bx(T, 'void', WIN.x0, WIN.x1, yF, yF + 0.04, zF + 0.3, zB);
    const m0 = mouthX - 0.7, m1 = mouthX + 0.7, my1 = gY + Ht + 0.05;
    bx(T, 'rock', WIN.x0 - 0.4, m0, yF, yC, zB, zB + 0.4); bx(T, 'rock', m1, WIN.x1 + 0.4, yF, yC, zB, zB + 0.4);
    bx(T, 'rock', m0, m1, yF, gY, zB, zB + 0.4); bx(T, 'rock', m0, m1, my1, yC, zB, zB + 0.4);
    for (const x of [WIN.x0 - 0.2, WIN.x1 + 0.2]) T.add('rock', xf(box(0.4, H, D), { x, y: yF, z: zM }));
    bx(T, 'rock', WIN.x0 - 0.4, WIN.x1 + 0.4, yC, yC + 0.35, zF, zB);
    bx(TF, 'rock', WIN.x0 - 0.4, WIN.x1 + 0.4, yF, yC + 0.35, zF - 0.4, zF);
    // strata in the walls
    for (const [y0, h, k] of [[0, 0.45, 'strA'], [1.15, 0.14, 'strB'], [2.25, 0.42, 'strA'], [3.45, 0.1, 'strB'], [4.3, 0.32, 'strA']]) {
      const ya = yF + y0, yb = ya + h;
      if (yb > gY && ya < my1) { bx(T, k, WIN.x0, m0, ya, yb, zB - 0.04, zB); bx(T, k, m1, WIN.x1, ya, yb, zB - 0.04, zB); }
      else bx(T, k, WIN.x0, WIN.x1, ya, yb, zB - 0.04, zB);
      for (const x of [WIN.x0 + 0.02, WIN.x1 - 0.02]) T.add(k, xf(box(0.04, h, D), { x, y: ya, z: zM }));
      bx(TF, k, WIN.x0, WIN.x1, ya, yb, zF, zF + 0.04);
    }
    // ribs across the ceiling, pilasters under them, blind lancets between
    const lan = (w, h) => { const sh = new THREE.Shape(), sy = h - w * 0.866; sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, sy); sh.absarc(w / 2, sy, w, PI, PI * 2 / 3, true); sh.absarc(-w / 2, sy, w, PI / 3, 0, true); sh.lineTo(w / 2, 0); sh.closePath(); return sh; };
    const lancet = (K, w, h, at, glowAt) => { K.add('stone', xf(new THREE.ExtrudeGeometry(lan(w, h), { depth: 0.08, bevelEnabled: false, curveSegments: 6 }), at)); K.add('vglow', xf(new THREE.ShapeGeometry(lan(w * 0.67, h - 0.3), 6), glowAt)); };
    const RIBS = [-12.35, -9.85, -7.35, -4.85, -2.35, 0.15];
    for (const x of RIBS) {
      T.add('rock', xf(box(0.28, 0.32, D), { x, y: yC - 0.32, z: zM }));
      T.add('rock', xf(box(0.36, H, 0.26), { x, y: yF, z: zB - 0.13 })); T.add('vglow', xf(box(0.04, H * 0.62, 0.03), { x, y: yF + H * 0.12, z: zB - 0.27 }));
      TF.add('rock', xf(box(0.36, H, 0.26), { x, y: yF, z: zF + 0.13 })); TF.add('vglow', xf(box(0.04, H * 0.62, 0.03), { x, y: yF + H * 0.12, z: zF + 0.27 }));
    }
    for (let i = 0; i < RIBS.length - 1; i++) {
      const x = (RIBS[i] + RIBS[i + 1]) / 2;
      if (Math.abs(x - mouthX) > 1.0) lancet(T, 0.9, 3.2, { x, y: yF + 0.6, z: zB, ry: PI }, { x, y: yF + 0.72, z: zB - 0.1, ry: PI });
      lancet(TF, 0.9, 3.2, { x, y: yF + 0.6, z: zF, ry: 0 }, { x, y: yF + 0.72, z: zF + 0.1, ry: 0 });
    }
    // the gallery where the passage comes in, and its stair down along the south wall
    bx(T, 'concrete', mouthX - 1.3, mouthX + 1.3, gY - 0.15, gY, zB - 1.3, zB);
    for (const x of [mouthX - 1.15, mouthX + 1.15]) bx(T, 'concrete', x - 0.09, x + 0.09, yF, gY - 0.15, zB - 1.25, zB - 1.07);
    for (const x of [mouthX - 1.25, mouthX, mouthX + 1.25]) bx(T, 'metal', x - 0.025, x + 0.025, gY, gY + 0.72, zB - 1.28, zB - 1.23);
    bx(T, 'metal', mouthX - 1.3, mouthX + 1.3, gY + 0.72, gY + 0.76, zB - 1.29, zB - 1.22); bx(T, 'vglow', mouthX - 1.3, mouthX + 1.3, gY + 0.7, gY + 0.71, zB - 1.24, zB - 1.22);
    bx(T, 'metal', mouthX + 1.26, mouthX + 1.3, gY + 0.72, gY + 0.76, zB - 1.3, zB);
    const NG = 16, gr = (gY - yF) / NG, sx0 = mouthX - 1.3;
    for (let k = 0; k < NG; k++) {
      const top = gY - (k + 1) * gr, x = sx0 - 0.15 - k * 0.3;
      bx(T, 'concrete', x - 0.15, x + 0.15, yF, top, zB - 0.95, zB);
      bx(T, 'vglow', x - 0.15, x - 0.12, top - 0.015, top + 0.005, zB - 0.95, zB - 0.05);
    }
    tubeSeg(T, 'metal', V(sx0, gY + 0.75, zB - 0.97), V(sx0 - NG * 0.3, yF + 0.75, zB - 0.97), 0.02, 0.02);
    // the STATION: two halves of a black pyramid, flush on the floor, square to the hall, split by a gap of light;
    // the capstone floats above the cut and turns; the beam rises out of the gap through the ceiling to the prairie
    const s = 1.7, h = 4.1, hc = 3.15, g = 0.2, sc = s * (1 - hc / h);
    const half = (sign) => {
      const P_ = (x, y, z) => [x * sign + sign * g + SX, y + yF + 0.04, z + SZ];
      const a = P_(0, 0, -s), b = P_(s, 0, -s), c = P_(s, 0, s), d = P_(0, 0, s), a2 = P_(0, hc, -sc), b2 = P_(sc, hc, -sc), c2 = P_(sc, hc, sc), d2 = P_(0, hc, sc);
      const quads = { void: [[b, b2, c2, c], [a, a2, b2, b], [c, c2, d2, d], [a2, d2, c2, b2], [a, b, c, d]], seam: [[a, d, d2, a2]] };
      for (const [kind, qs] of Object.entries(quads)) {
        const pos = [];
        for (let q of qs) { if (sign < 0) q = [...q].reverse(); pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]); }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); T.add(kind, geo);
      }
    };
    half(1); half(-1);
    const hwAt = y => s - (s - sc) * y / hc;
    for (const y of [0.55, 1.6, 2.6]) for (const sign of [-1, 1]) {           // bands of void light around both halves
      const w_ = hwAt(y), o = 0.02;
      T.add('vglow', xf(box(0.03, 0.04, 2 * w_), { x: SX + sign * (g + w_ + o), y: yF + 0.04 + y, z: SZ }));
      for (const sz of [-1, 1]) T.add('vglow', xf(box(w_, 0.04, 0.03), { x: SX + sign * (g + w_ / 2), y: yF + 0.04 + y, z: SZ + sz * (w_ + o) }));
    }
    // handprints where the Voided touch it
    const handShape = (() => { const sh = new THREE.Shape(); sh.absellipse(0, 0, 0.055, 0.065, 0, PI * 2); return sh; })();
    const hand = () => { const gs = [new THREE.ShapeGeometry(handShape, 10)]; [[-0.05, 0.07, 0.3], [-0.018, 0.09, 0.1], [0.016, 0.092, -0.05], [0.048, 0.08, -0.2]].forEach(([x, l, a]) => gs.push(new THREE.PlaneGeometry(0.024, l).translate(0, l / 2, 0).rotateZ(a).translate(x, 0.05, 0))); gs.push(new THREE.PlaneGeometry(0.026, 0.06).translate(0, 0.03, 0).rotateZ(1.0).translate(-0.05, -0.01, 0)); return mergeGeometries(gs.map(q => q.toNonIndexed()), false); };
    const nOut = new THREE.Vector3(hc, s - sc, 0).normalize(), nFront = new THREE.Vector3(0, s - sc, -hc).normalize();
    const place = (n, p) => { const g_ = hand(); g_.applyMatrix4(new THREE.Matrix4().compose(p.clone().addScaledVector(n, 0.012), new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n), V(1, 1, 1))); T.add('hand', g_); };
    for (const [sign, z, y] of [[1, -0.55, 0.95], [1, 0.35, 1.05], [-1, 0.15, 0.9], [-1, -0.7, 1.15]]) place(V(nOut.x * sign, nOut.y, 0), V(SX + sign * (g + hwAt(y)), yF + 0.04 + y, SZ + z));
    for (const [x, zs] of [[0.8, -1], [-0.9, -1], [0.6, 1]]) place(V(0, nFront.y, zs < 0 ? nFront.z : -nFront.z), V(SX + Math.sign(x) * g + x, yF + 1.0, SZ + zs * hwAt(0.96)));
    T.add('vglow', xf(cyl(0.06, 0.06, H, 8), { x: SX, y: yF, z: SZ }));
    T.add('vglow', xf(new THREE.TorusGeometry(2.05, 0.03, 4, 64).rotateX(PI / 2), { x: SX, y: yF + 0.05, z: SZ }));
    T.add('void', xf(new THREE.CircleGeometry(0.3, 16).rotateX(PI / 2), { x: SX, y: yC - 0.01, z: SZ }));
    T.add('vglow', xf(new THREE.TorusGeometry(0.34, 0.025, 4, 24).rotateX(PI / 2), { x: SX, y: yC - 0.02, z: SZ }));
    // the six RELAYS on a ring, floor conduits from the station to each
    const RR = 3.4, relays = [];
    for (let k = 0; k < 6; k++) {
      const a = PI / 6 + k * PI / 3, x = SX + Math.cos(a) * RR, z = SZ + Math.sin(a) * RR; relays.push(V(x, yF, z));
      T.add('concrete', xf(cyl(0.52, 0.55, 0.16, 20), { x, y: yF, z })); T.add('void', xf(cyl(0.44, 0.46, 0.42, 20), { x, y: yF + 0.16, z }));
      T.add('glass', xf(cyl(0.36, 0.36, 1.5, 22), { x, y: yF + 0.58, z })); T.add('vglow', xf(cyl(0.13, 0.13, 1.5, 12), { x, y: yF + 0.58, z }));
      for (let j = 0; j < 6; j++) { const b = j * PI / 3; T.add('metal', xf(box(0.04, 1.5, 0.04), { x: x + Math.cos(b) * 0.4, y: yF + 0.58, z: z + Math.sin(b) * 0.4 })); }
      for (const y of [0.58, 1.33, 2.08]) T.add('gold', xf(new THREE.TorusGeometry(0.41, 0.025, 6, 28).rotateX(PI / 2), { x, y: yF + y, z }));
      T.add('void', xf(cyl(0.46, 0.44, 0.3, 20), { x, y: yF + 2.08, z })); T.add('concrete', xf(cyl(0.3, 0.34, 0.12, 16), { x, y: yF + 2.38, z }));
      T.add('vglow', xf(cyl(0.05, 0.05, 0.14, 8), { x, y: yF + 2.5, z }));
      const len = RR - 2.1 - 0.5; T.add('vglow', xf(box(0.07, 0.012, len).translate(0, 0, 2.1 + len / 2), { x: SX, y: yF + 0.04, z: SZ, ry: PI / 2 - a }));
    }
    // kneeling stones on a ring, between the conduits
    for (let k = 0; k < 6; k++) { const a = k * PI / 3, x = SX + Math.cos(a) * 2.45, z = SZ + Math.sin(a) * 2.45; T.add('rock', xf(box(0.34, 0.1, 0.55), { x, y: yF + 0.04, z, ry: -a })); }
    // Nera's console: she can't touch the station, so she wired one up
    const NC = V(SX - 3.4, yF, SZ);
    T.add('concrete', xf(box(0.45, 0.85, 0.85), { x: NC.x, y: yF, z: NC.z }));
    T.add('concrete', xf(box(0.55, 0.07, 0.95), { x: NC.x - 0.02, y: yF + 0.85, z: NC.z, rz: 0.42 }));
    T.add('stone', xf(cyl(0.11, 0.11, 0.02, 20), { x: NC.x - 0.06, y: yF + 0.93, z: NC.z + 0.2, rz: 0.42 }));
    T.add('metal', xf(box(0.06, 0.55, 0.06), { x: NC.x - 0.2, y: yF + 0.88, z: NC.z - 0.3 }));
    T.add('metal', xf(box(1.15, 0.05, 0.08), { x: NC.x + 0.8, y: yF + 0.04, z: NC.z })); T.add('vglow', xf(box(1.15, 0.012, 0.03), { x: NC.x + 0.8, y: yF + 0.09, z: NC.z }));
    // the surgical bay at the east end: a slab under a ring lamp, a body, a big arm from the ceiling; tanks and data stacks
    const SB = V(0.3, yF, -28.8);
    T.add('dark', xf(box(0.95, 0.78, 2.1), { x: SB.x, y: yF, z: SB.z })); T.add('trim', xf(box(1.05, 0.08, 2.2), { x: SB.x, y: yF + 0.78, z: SB.z }));
    T.add('stone', xf(new THREE.CapsuleGeometry(0.17, 1.1, 4, 10).rotateX(PI / 2), { x: SB.x, y: yF + 1.03, z: SB.z + 0.05 })); T.add('stone', xf(new THREE.SphereGeometry(0.15, 10, 8), { x: SB.x, y: yF + 1.05, z: SB.z - 0.78 }));
    for (let k = 0; k < 6; k++) T.add('glow', xf(new THREE.TorusGeometry(0.18, 0.018, 4, 18), { x: SB.x, y: yF + 1.03, z: SB.z - 0.4 + k * 0.17 }));
    T.add('metal', xf(new THREE.TorusGeometry(0.7, 0.06, 8, 32).rotateX(PI / 2), { x: SB.x, y: yC - 1.35, z: SB.z })); T.add('vglow', xf(new THREE.TorusGeometry(0.66, 0.025, 4, 32).rotateX(PI / 2), { x: SB.x, y: yC - 1.4, z: SB.z }));
    for (const dz of [-0.5, 0.5]) T.add('metal', xf(box(0.03, 1.3, 0.03), { x: SB.x + 0.6, y: yC - 1.33, z: SB.z + dz }));
    T.add('metal', xf(cyl(0.09, 0.09, 1.0, 10), { x: SB.x, y: yC - 1.0, z: SB.z + 0.95 }));
    for (const z of [-31.0, -32.25]) { const x = 1.0; T.add('concrete', xf(cyl(0.58, 0.6, 0.2, 20), { x, y: yF, z })); T.add('glass', xf(cyl(0.5, 0.5, 2.6, 22), { x, y: yF + 0.2, z })); T.add('stone', xf(new THREE.CapsuleGeometry(0.15, 0.85, 4, 8), { x, y: yF + 1.3, z })); T.add('stone', xf(new THREE.SphereGeometry(0.13, 10, 8), { x, y: yF + 2.0, z })); T.add('vglow', xf(new THREE.TorusGeometry(0.5, 0.03, 4, 28).rotateX(PI / 2), { x, y: yF + 0.25, z })); T.add('void', xf(cyl(0.58, 0.54, 0.3, 20), { x, y: yF + 2.8, z })); }
    for (let i = 0; i < 4; i++) { const x = -3.2 + i * 0.75; T.add('void', xf(box(0.62, 2.4, 0.8), { x, y: yF, z: zF + 0.85 })); for (let j = 0; j < 14; j++) T.add('vglow', xf(box(0.42, 0.014, 0.01), { x, y: yF + 0.35 + j * 0.13, z: zF + 0.44 })); }
    // the spiral stair up to the hatch, its steps edged with void light
    const NS = 26, STEP = 0.36, rise = H / NS;
    T.add('concrete', xf(cyl(0.16, 0.16, H, 10), { x: HX, y: yF, z: HZ }));
    for (let k = 0; k < NS; k++) {
      const a = k * STEP, y = yC - (k + 1) * rise;
      T.add('concrete', xf(box(0.84, 0.1, 0.38).translate(0.56, -0.1, 0), { x: HX, y, z: HZ, ry: -a }));
      T.add('vglow', xf(box(0.03, 0.025, 0.38).translate(0.98, -0.02, 0), { x: HX, y, z: HZ, ry: -a }));
    }
    T.add('vglow', xf(new THREE.TorusGeometry(0.8, 0.03, 4, 32).rotateX(PI / 2), { x: HX, y: yC - 0.03, z: HZ }));
    // pools, roots (drips fall from their tips) and stalactites, kept clear of the station, the stairs, the gallery and the bay
    const drips = [];
    const rootAt = (x, z, len) => { let p = V(x, yC + 0.05, z), rad = 0.07; const n = 3 + Math.floor(r() * 2); for (let i = 0; i < n; i++) { const q = p.clone().add(V((r() - 0.5) * 0.35, -len / n, (r() - 0.5) * 0.35)); tubeSeg(T, 'root', p, q, rad, rad * 0.62, 5); p = q; rad *= 0.62; } return p; };
    const busy = (x, z, m) => Math.hypot(x - SX, z - SZ) < 4.2 + m || Math.hypot(x - HX, z - HZ) < 1.4 + m || (z > zB - 1.5 - m && x > sx0 - 5.2 && x < mouthX + 1.5) || x > -1.0 - m || Math.hypot(x - NC.x, z - NC.z) < 1 + m;
    for (let tries = 0; drips.length < 5 && tries < 600; tries++) {
      const x = WIN.x0 + 0.9 + r() * (W - 1.8), z = zF + 0.7 + r() * (D - 1.4), rr = 0.3 + r() * 0.4;
      if (busy(x, z, rr) || drips.some(d => Math.hypot(d.x - x, d.z - z) < 2)) continue;
      T.add('pool', xf(new THREE.CircleGeometry(rr, 20).rotateX(-PI / 2), { x, y: yF + 0.045, z }));
      const tip = rootAt(x, z, 1.0 + r() * 0.8); drips.push({ x: tip.x, z: tip.z, top: tip.y, bottom: yF + 0.05, ph: r() * 3 });
    }
    for (let i = 0; i < 26; i++) { const x = WIN.x0 + 0.5 + r() * (W - 1), z = zF + 0.4 + r() * (D - 0.8); if (Math.hypot(x - HX, z - HZ) < 1.2 || Math.hypot(x - SX, z - SZ) < 1.4 || (z > zB - 1.6 && x > mouthX - 1.6 && x < mouthX + 1.6) || Math.hypot(x - SB.x, z - SB.z) < 1.6) continue; rootAt(x, z, 0.4 + r() * 1.2); }
    for (let i = 0; i < 40; i++) { const x = WIN.x0 + 0.4 + r() * (W - 0.8), z = zF + 0.3 + r() * (D - 0.6), hh = 0.18 + r() * 0.45; if (Math.hypot(x - HX, z - HZ) < 1.2 || Math.hypot(x - SX, z - SZ) < 0.8) continue; T.add('rock', new THREE.ConeGeometry(0.05 + r() * 0.07, hh, 5).rotateX(PI).translate(x, yC - hh / 2, z)); }
    const crt = state.theme === 'crt';
    const tm = {
      rock: new THREE.MeshStandardMaterial({ color: crt ? '#2e2a33' : '#4a4553', roughness: 0.85, flatShading: true }),
      stone: new THREE.MeshStandardMaterial({ color: crt ? '#2b2731' : '#625c6c', roughness: 0.8, flatShading: true }),
      void: new THREE.MeshStandardMaterial({ color: crt ? '#08070b' : '#1d1b26', roughness: 0.22, metalness: 0.45, flatShading: true }),
      concrete: new THREE.MeshStandardMaterial({ color: crt ? '#56544f' : '#a8a59e', roughness: 0.95, flatShading: true }),
      metal: new THREE.MeshStandardMaterial({ color: crt ? '#3a3940' : '#6c6a74', roughness: 0.4, metalness: 0.75 }),
      gold: new THREE.MeshStandardMaterial({ color: th.gold, roughness: 0.35, metalness: 0.75 }),
      trim: new THREE.MeshStandardMaterial({ color: th.trim, roughness: 0.8, flatShading: true }),
      dark: new THREE.MeshStandardMaterial({ color: th.dark, roughness: 0.8, flatShading: true }),
      glass: new THREE.MeshStandardMaterial({ color: crt ? '#b9a8ff' : '#7a6ad8', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(th.glow).multiplyScalar(th.glowBoost) }),
      vglow: new THREE.MeshBasicMaterial({ color: new THREE.Color(crt ? '#9b8cff' : '#6a5acd').multiplyScalar(crt ? 1.6 : 1) }),
      seam: new THREE.MeshBasicMaterial({ color: new THREE.Color(crt ? '#5a46c8' : '#4a3ab0').multiplyScalar(crt ? 0.75 : 0.9) }),
      hand: new THREE.MeshBasicMaterial({ color: new THREE.Color(crt ? '#c9bfff' : '#6a5acd').multiplyScalar(crt ? 1.3 : 1), side: THREE.DoubleSide }),
      strA: new THREE.MeshStandardMaterial({ color: crt ? '#3e3024' : '#6e5c48', roughness: 1, flatShading: true }),
      strB: new THREE.MeshStandardMaterial({ color: crt ? '#6b5338' : '#a08a68', roughness: 1, flatShading: true }),
      root: new THREE.MeshStandardMaterial({ color: '#5a4330', roughness: 0.9, flatShading: true }),
      pool: new THREE.MeshStandardMaterial({ color: crt ? '#04040a' : '#15141e', roughness: 0.04, metalness: 0.7 }),
    };
    const noLine = ['vglow', 'pool', 'root', 'strB', 'glass', 'hand', 'glow', 'seam'];
    for (const [K, parent] of [[T, root], [TF, fpGroup]]) for (const [k, g_] of Object.entries(K.merge())) {
      const m = new THREE.Mesh(g_, tm[k]);
      if (!noLine.includes(k)) { m.castShadow = m.receiveShadow = true; m.add(new THREE.Mesh(hullOf(g_), outlineMaterial(th.ink, th.outlinePx))); }
      parent.add(m);
    }
    const sl = new THREE.PointLight('#7a5cff', crt ? 11 : 6, 14, 1.3); sl.position.set(SX, yF + 3.0, SZ); root.add(sl);
    const fl = new THREE.PointLight('#6a4cff', crt ? 5 : 3, 10, 1.2); fl.position.set(HX + 2.0, yC - 0.8, HZ + 1.0); root.add(fl);
    const bl = new THREE.PointLight('#dfe2ff', crt ? 6 : 4, 7, 1.4); bl.position.set(SB.x, yC - 1.5, SB.z); root.add(bl);
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.25, 8), tm.concrete); vent.position.set(SX, FLOOR + 0.1, SZ); root.add(vent);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 30, 6, 1, true), new THREE.MeshBasicMaterial({ color: '#9b8cff', transparent: true, opacity: crt ? 0.45 : 0.3, depthWrite: false }));
    beam.position.set(SX, FLOOR + 15, SZ); root.add(beam);
    // moving parts: the capstone, pulses of power along the conduits and word up the beam, the void gates, the big arm, her console screen
    capstone = new THREE.Group(); capstone.position.set(SX, yF + 0.04 + hc + 0.28, SZ); capstone.userData.y0 = capstone.position.y;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(sc * Math.SQRT2, h - hc, 4).rotateY(PI / 4).translate(0, (h - hc) / 2, 0), tm.void); cap.add(new THREE.Mesh(hullOf(cap.geometry), outlineMaterial(th.ink, th.outlinePx))); capstone.add(cap);
    const capRing = new THREE.Mesh(new THREE.TorusGeometry(sc * 1.25, 0.02, 4, 32).rotateX(PI / 2), tm.vglow); capRing.position.y = -0.1; capstone.add(capRing); root.add(capstone);
    pulses = []; dripFxI = [];
    const pm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e3dcff').multiplyScalar(crt ? 2.2 : 1) }), pg = new THREE.BoxGeometry(0.1, 0.03, 0.22);
    relays.forEach((rp, k) => { const m = new THREE.Mesh(pg, pm); root.add(m); pulses.push({ m, from: V(SX, yF + 0.06, SZ), to: rp.clone().setY(yF + 0.06), ph: k / 6, kind: 'conduit' }); });
    for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), pm); root.add(m); pulses.push({ m, from: V(SX, yF + 0.3, SZ), to: V(SX, FLOOR + 10, SZ), ph: k / 4, kind: 'beam' }); }
    gates = [makeGate(1.6, 3.6, 3.1), makeGate(1.3, 3.2, 7.7)];
    gates[0].position.set(WIN.x0 + 0.04, yF + 0.25 + 1.8, -26.0); gates[0].rotation.y = PI / 2;
    gates[1].position.set(WIN.x1 - 0.04, yF + 0.25 + 1.6, -24.6); gates[1].rotation.y = -PI / 2;
    gates.forEach(gt => root.add(gt));
    bigArm = makeArm({ scale: 1.9, L1: 0.62, L2: 0.6, crt, pose: { sh: 0.9, el: -1.5, wr: 0.55 } }); bigArm.root.position.set(SB.x, yC - 1.5, SB.z + 0.95); bigArm.root.rotation.y = PI; root.add(bigArm.root);
    const scr2 = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.38), new THREE.MeshBasicMaterial({ map: screenTex(), color: crt ? '#ffffff' : '#bbbbff' }));
    scr2.position.set(NC.x - 0.2, yF + 1.5, NC.z - 0.3); scr2.rotation.y = PI / 2; scr2.rotation.x = 0; root.add(scr2);
    templeAt = V(SX + Math.cos(2 * PI / 3) * 2.45 - 0.3, yF, SZ + Math.sin(2 * PI / 3) * 2.45 + 0.3);
    L('Temple of the Voided · Nera\'s greater lab', V(cx, yC + 0.4, zF - 0.5), { north: true });
    L('Station · draws power from the air, sends power and word', V(SX, yF + 5.0, SZ), { north: true });
    L('Void gate', V(WIN.x0 + 0.4, yF + 4.3, -26.0), { north: true });
    WALK.temple = { yF, yC, zM, zB, zF, SX, SZ, HX, HZ, NS, STEP, rise, x0: WIN.x0, x1: WIN.x1, drips, gY, sx0, NG, gr, NC, SB, relays, gates: [V(WIN.x0, yF + 2.0, -26.0), V(WIN.x1, yF + 1.8, -24.6)] };
  }

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
  labLight = new THREE.PointLight('#7a5cff', state.theme === 'crt' ? 5.5 : 3.5, 10, 1.4); labLight.position.copy(info.lab.light); root.add(labLight);
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
  nera.position.copy(templeAt); nera.visible = false; root.add(nera);
  L('Nera · safe in the Temple of the Voided', templeAt.clone().add(V(0, 2.2, -2.5)), { after: true, late: true, north: true });

  // ---- first-person walk: pieces only seen from inside (the lab's front wall, the passage as a real tunnel and its shaft,
  //      the hatch shaft), lids that open, dust in the air, water dripping in the temple; plus the lab's machine arm and screen
  {
    const { LP, H0, H1, U, trap, out } = info.lab, Hh = H1 - H0, Fl = (u, y, w) => ({ ...LP(u, y, w), ry: PI });
    const seal = new Kit();
    seal.add('concrete', xf(box(2 * U, Hh, 0.16), Fl(0, H0, -0.08)));
    for (let k = 1; k < 7; k++) seal.add('void', xf(box(2 * U - 0.1, 0.02, 0.02), Fl(0, H0 + k * Hh / 7, -0.17)));
    seal.add('vglow', xf(box(2 * U - 0.2, 0.03, 0.04), Fl(0, H0 + 0.01, -0.19)));
    for (const [k, g] of Object.entries(seal.merge())) fpGroup.add(new THREE.Mesh(g, mats[k]));
    trapLid = new THREE.Group(); trapLid.position.set(trap.x, H0, trap.z + 0.45);
    const tl_ = new THREE.Mesh(box(0.9, 0.04, 0.9).translate(0, 0, -0.45), mats.void); tl_.add(new THREE.Mesh(hullOf(tl_.geometry), outlineMaterial(th.ink, th.outlinePx)));
    trapLid.add(tl_); root.add(trapLid);
    const hx = info.lab.hatch.x, hz = info.lab.hatch.z;
    hatchLid = new THREE.Group(); hatchLid.position.set(hx, FLOOR + 0.4, hz + 0.65); hatchLid.rotation.x = 0.08;
    const hl_ = new THREE.Mesh(box(1.3, 0.16, 1.3).translate(0, 0, -0.65), mats.hatch); hl_.add(new THREE.Mesh(hullOf(hl_.geometry), outlineMaterial(th.ink, th.outlinePx)));
    hatchLid.add(hl_); root.add(hatchLid);
    // the machine arm over the specimen table, and her panel's screen
    labArm = makeArm({ scale: 1, L1: 0.5, L2: 0.46, erasable: true, crt: state.theme === 'crt' });
    labArm.root.position.copy(info.lab.armMount); labArm.root.userData.base = info.lab.armMount.clone(); root.add(labArm.root);
    const scrMat = new THREE.MeshBasicMaterial({ map: screenTex(), color: state.theme === 'crt' ? '#ffffff' : '#bbbbff' }); scrMat.onBeforeCompile = eraseInject;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), scrMat); scr.position.copy(info.lab.screen.p); scr.rotation.y = PI; scr.rotation.x = 0.18; root.add(scr);
    const ql = new THREE.PointLight('#ffb878', state.theme === 'crt' ? 2.2 : 1.6, 6, 1.5); ql.position.copy(info.lab.quarters); root.add(ql); roomLights = [ql];
    const rl = new THREE.PointLight('#ff6a4a', state.theme === 'crt' ? 4 : 2.5, 7, 1.3); rl.position.copy(info.lab.bunker); root.add(rl); roomLights.push(rl);
    // the passage: a concrete tunnel under the valley, into the temple's gallery
    const crt = state.theme === 'crt';
    const tmat = {
      wall: new THREE.MeshStandardMaterial({ color: crt ? '#47453f' : '#a8a59e', roughness: 0.95, flatShading: true, side: THREE.DoubleSide }),
      floor: new THREE.MeshStandardMaterial({ color: crt ? '#1b1a1d' : '#57545c', roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide }),
      rib: new THREE.MeshStandardMaterial({ color: crt ? '#5a5750' : '#bdb9b0', roughness: 0.95, flatShading: true }),
      rung: new THREE.MeshStandardMaterial({ color: crt ? '#8a7a5a' : '#6e6553', roughness: 0.5, metalness: 0.6 }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(crt ? '#9b8cff' : '#6a5acd').multiplyScalar(crt ? 1.5 : 1), side: THREE.DoubleSide }),
      none: new THREE.MeshBasicMaterial({ visible: false })
    };
    const { Ft, Ht, TW, mouthX } = TUN, T_ = WALK.temple;
    const tunnel = new THREE.CatmullRomCurve3([V(trap.x, 0, trap.z - 0.5), V(out.x, 0, out.z), V(mouthX, 0, -21.4), V(mouthX, 0, T_.zB - 0.02)], false, 'centripetal');
    const n = Math.round(tunnel.getLength() / 0.2), P = tunnel.getSpacedPoints(n);
    const side = i => { const t = tunnel.getTangentAt(i / n); return V(-t.z, 0, t.x).normalize(); };
    const strip = (fa, fb, mat) => { const pos = []; for (let i = 0; i < n; i++) { const a0 = fa(i), a1 = fa(i + 1), b0 = fb(i), b1 = fb(i + 1); pos.push(...a0.toArray(), ...b0.toArray(), ...a1.toArray(), ...a1.toArray(), ...b0.toArray(), ...b1.toArray()); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); fpGroup.add(new THREE.Mesh(g, mat)); };
    const at = (i, s, y) => P[i].clone().addScaledVector(side(i), s).setY(y);
    strip(i => at(i, -TW / 2, Ft), i => at(i, TW / 2, Ft), tmat.floor);
    strip(i => at(i, -TW / 2, Ft + Ht), i => at(i, TW / 2, Ft + Ht), tmat.wall);
    strip(i => at(i, -TW / 2, Ft), i => at(i, -TW / 2, Ft + Ht), tmat.wall);
    strip(i => at(i, TW / 2, Ft), i => at(i, TW / 2, Ft + Ht), tmat.wall);
    strip(i => at(i, -0.03, Ft + 0.01), i => at(i, 0.03, Ft + 0.01), tmat.glow);
    for (let u = 0.1; u < 0.95; u += 1.4 / tunnel.getLength()) {
      const q = tunnel.getPointAt(u), t = tunnel.getTangentAt(u), ry = Math.atan2(t.x, t.z), sd = V(-t.z, 0, t.x).normalize();
      for (const s of [-1, 1]) { const m = new THREE.Mesh(box(0.14, Ht, 0.22), tmat.rib); m.position.copy(q).addScaledVector(sd, s * (TW / 2 - 0.07)).setY(Ft); m.rotation.y = ry; fpGroup.add(m); }
      const l = new THREE.Mesh(box(TW, 0.16, 0.22), tmat.rib); l.position.copy(q).setY(Ft + Ht - 0.16); l.rotation.y = ry; fpGroup.add(l);
      const g = new THREE.Mesh(box(TW - 0.3, 0.02, 0.04), tmat.glow); g.position.copy(q).setY(Ft + Ht - 0.18); g.rotation.y = ry; fpGroup.add(g);
    }
    { // the shaft down from the trapdoor: open toward the tunnel at the bottom, ladder rungs on the far wall
      const g = new THREE.Group(); g.position.set(trap.x, 0, trap.z);
      const mk = (y0, y1, faces) => { const m = new THREE.Mesh(new THREE.BoxGeometry(TW, y1 - y0, 1.0), faces); m.position.y = (y0 + y1) / 2; g.add(m); };
      mk(Ft, Ft + Ht, [tmat.wall, tmat.wall, tmat.none, tmat.none, tmat.wall, tmat.none]);
      mk(Ft + Ht, H0 - 0.12, [tmat.wall, tmat.wall, tmat.none, tmat.none, tmat.wall, tmat.wall]);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(TW, 1.0).rotateX(-PI / 2), tmat.floor); fl.position.y = Ft + 0.002; g.add(fl);
      for (let y = Ft + 0.35; y < H0 - 0.2; y += 0.3) { const rg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04), tmat.rung); rg.position.set(0, y, 0.44); g.add(rg); }
      fpGroup.add(g);
    }
    const hs = new THREE.Mesh(new THREE.BoxGeometry(1.3, FLOOR + 0.4 - (T_.yC - 0.02), 1.3), [tmat.wall, tmat.wall, tmat.none, tmat.none, tmat.wall, tmat.wall]);
    hs.position.set(hx, (FLOOR + 0.4 + T_.yC - 0.02) / 2, hz); fpGroup.add(hs);
    // dust in the air of the lab, her rooms and the temple
    const dust = [];
    for (let i = 0; i < 220; i++) dust.push(LP(-U + 0.2 + Math.random() * (2 * U - 0.4), H0 + 0.1 + Math.random() * (Hh - 0.5), -14.6 + Math.random() * 14.3));
    for (let i = 0; i < 520; i++) dust.push(V(T_.x0 + 0.3 + Math.random() * (T_.x1 - T_.x0 - 0.6), T_.yF + 0.1 + Math.random() * (T_.yC - T_.yF - 0.4), T_.zF + 0.3 + Math.random() * (T_.zB - T_.zF - 0.6)));
    const dg = new THREE.BufferGeometry().setFromPoints(dust);
    dustPts = new THREE.Points(dg, new THREE.PointsMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })(), color: crt ? '#cbbcff' : '#8a7ad8', size: 0.03, transparent: true, opacity: 0.7, depthWrite: false, blending: crt ? THREE.AdditiveBlending : THREE.NormalBlending }));
    dustPts.userData.base = dust.map(p => p.clone()); dustPts.userData.ph = dust.map(() => Math.random() * 6.28);
    fpGroup.add(dustPts);
    dripFx = T_.drips.map((d, i) => {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), new THREE.MeshBasicMaterial({ color: crt ? '#d9d0ff' : '#6a5acd' }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: crt ? '#9b8cff' : '#6a5acd', transparent: true, depthWrite: false }));
      ring.position.set(d.x, d.bottom + 0.005, d.z); fpGroup.add(drop, ring);
      return { ...d, drop, ring, period: 2.4 + i * 0.63 };
    });
    WALK.lab = { LP, H0, H1, U, trap, Ft, tunnel };
  }


  // ---- the Archive's moving and lit parts: feat-script fronts, the light from the oculus, the orrery, the secret door and
  //      its void detector, the bench lid and the false bookcase; lamps inside
  if (ARCH) {
    const A = ARCH, c = A.c, crt = state.theme === 'crt', P = (a, r, y) => V(c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r);
    const ei = m => { m.onBeforeCompile = eraseInject; return m; };
    const feats = ['SHE TURNED THE FLOOD AT A WORD · WITNESSED BY 3,120', 'HE HELD THE BRIDGE ALONE FOR NINE DAYS · WITNESSED BY 912', 'THE FIRE KNELT WHEN SHE SPOKE · WITNESSED BY 6,400', 'HE WROTE THE PLAGUE OUT OF THE CITY · WITNESSED BY ALL AURELIA', 'WHAT IS WITNESSED IS ETERNAL'];
    const featTex = (rep) => { const cv = document.createElement('canvas'); cv.width = 4096; cv.height = 96; const g = cv.getContext('2d'); g.fillStyle = crt ? '#140d06' : '#efe2c4'; g.fillRect(0, 0, 4096, 96); g.fillStyle = crt ? '#e8b450' : '#8a5a1e'; g.font = 'bold 54px Bebas Neue, Space Mono, sans-serif'; let x = 20, i = 0; while (x < 4096) { const t = feats[i++ % feats.length] + '   ✦   '; g.fillText(t, x, 70); x += g.measureText(t).width; } g.fillRect(0, 4, 4096, 3); g.fillRect(0, 89, 4096, 3); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(rep, 1); return t; };
    [[1, 6, 0.32], [2, 4, 0.46], [3, 2.6, 0.62]].forEach(([l, rep, h]) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(A.WELL - 0.005, A.WELL - 0.005, h, 72, 1, true), ei(new THREE.MeshBasicMaterial({ map: featTex(rep), side: THREE.BackSide })));
      m.position.set(c.x, A.LV[l] - 0.2 - h / 2, c.z); root.add(m);
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 1.25, A.OY - (A.LV[0] + 1.6), 32, 1, true), ei(new THREE.MeshBasicMaterial({ color: crt ? '#fff0d0' : '#fff6e0', transparent: true, opacity: crt ? 0.07 : 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    shaft.position.set(c.x, (A.OY + A.LV[0] + 1.6) / 2, c.z); root.add(shaft);
    // the orrery: the Storyborn as heavenly bodies, each on its own ring
    const orrery = new THREE.Group(); orrery.position.set(c.x, A.TOP + 1.15, c.z);
    const gm = ei(new THREE.MeshStandardMaterial({ color: THREE_GOLD(crt), roughness: 0.35, metalness: 0.8 })), bm = ei(new THREE.MeshBasicMaterial({ color: new THREE.Color(crt ? '#ffd27a' : '#e0a02a').multiplyScalar(crt ? 2 : 1) }));
    const rings = [];
    [[0.7, 0.4, 2], [1.0, -0.3, 3], [1.32, 0.15, 2]].forEach(([r, tilt, nb], i) => {
      const g = new THREE.Group(); g.rotation.x = tilt; const spin = new THREE.Group(); g.add(spin);
      spin.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 6, 64).rotateX(PI / 2), gm));
      for (let k = 0; k < nb; k++) { const a = k * 2 * PI / nb + i, b = new THREE.Mesh(new THREE.SphereGeometry(0.06 + 0.03 * ((k + i) % 2), 12, 8), bm); b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); spin.add(b); }
      spin.userData.sp = (i % 2 ? -1 : 1) * (0.12 + i * 0.05); rings.push(spin); orrery.add(g);
    });
    orrery.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), bm));
    for (let k = 0; k < 3; k++) { const a = k * 2 * PI / 3, rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.0, 4), gm); rod.position.set(Math.cos(a) * 0.5, 1.0, Math.sin(a) * 0.5); orrery.add(rod); }
    root.add(orrery);
    // the void detector: the frame of the pedestal's hidden door; linked to the station, it stops everything if it reads the wrong person
    const mm = ei(new THREE.MeshStandardMaterial({ color: crt ? '#2c2b31' : '#5c5a66', roughness: 0.35, metalness: 0.8 })), vg = ei(new THREE.MeshBasicMaterial({ color: new THREE.Color(crt ? '#9b8cff' : '#6a5acd').multiplyScalar(crt ? 1.6 : 1) }));
    const dz = c.z - 0.84, y0 = A.LV[0];
    for (const s of [-1, 1]) { const p = new THREE.Mesh(box(0.07, 1.12, 0.12), mm); p.position.set(c.x + s * 0.31, y0, dz); root.add(p); const g = new THREE.Mesh(box(0.012, 0.98, 0.07), vg); g.position.set(c.x + s * 0.27, y0 + 0.06, dz); root.add(g); }
    const lin = new THREE.Mesh(box(0.7, 0.08, 0.12), mm); lin.position.set(c.x, y0 + 1.07, dz); root.add(lin);
    const scan = new THREE.Mesh(box(0.54, 0.012, 0.07), new THREE.MeshBasicMaterial({ color: new THREE.Color('#9b8cff'), transparent: true, opacity: 0.6 })); scan.position.set(c.x, y0 + 0.5, dz); root.add(scan);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), new THREE.MeshBasicMaterial({ color: '#7dff9a' })); lamp.position.set(c.x, y0 + 1.15, dz - 0.03); root.add(lamp);
    const sc = document.createElement('canvas'); sc.width = 512; sc.height = 200; const sg = sc.getContext('2d');
    sg.fillStyle = '#07060c'; sg.fillRect(0, 0, 512, 200); sg.fillStyle = '#b9a8ff'; sg.font = 'bold 30px Space Mono, monospace'; sg.fillText('VOID DETECTOR', 18, 40);
    sg.font = '20px Space Mono, monospace'; sg.fillStyle = '#8f7cff'; sg.fillText('LINK: STATION · LIVE', 18, 78); sg.fillText('CLEARED: NERA · MOTHER · FATHER', 18, 110); sg.fillText('         ORIN (?)', 18, 138); sg.fillStyle = '#7dff9a'; sg.fillText('STATUS: CLEAR', 18, 178);
    const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.14), ei(new THREE.MeshBasicMaterial({ map: st }))); scr.position.set(c.x + 0.12, y0 + 0.95, dz - 0.07); scr.rotation.y = PI; root.add(scr);
    const door = new THREE.Group(); door.position.set(c.x, y0, c.z - 0.93);
    const dm = new THREE.Mesh(box(0.66, 1.14, 0.07), mats.stone); dm.add(new THREE.Mesh(hullOf(dm.geometry), outlineMaterial(th.ink, th.outlinePx))); door.add(dm);
    const rel = new THREE.Mesh(box(0.3, 0.22, 0.02), mats.gold); rel.position.set(0, 0.62, -0.045); door.add(rel);
    const rel2 = new THREE.Mesh(box(0.012, 0.22, 0.03), mats.glow); rel2.position.set(0, 0.62, -0.05); door.add(rel2);
    root.add(door);
    // the bench lid and the false bookcase
    const lid = new THREE.Group(); lid.position.copy(P(A.BB, A.RI - 0.25 + 0.15, y0 + 0.3)); lid.rotation.set(0, -A.BB, 0);
    const lm = new THREE.Mesh(box(0.8, 0.05, 0.22).translate(-0.4, 0, 0), mats.wood); lid.add(lm); const lc = new THREE.Mesh(box(0.75, 0.05, 0.2).translate(-0.4, 0.05, 0), mats.fabric); lid.add(lc); root.add(lid);
    const ha = A.NICHE - A.NW, hb = A.NICHE + A.NW, h0 = P(ha, A.RI - 0.1, A.LV[2]), h1 = P(hb, A.RI - 0.1, A.LV[2]), cl = h0.distanceTo(h1);
    const shelf = new THREE.Group(); shelf.position.copy(h0); const base = -Math.atan2(h1.z - h0.z, h1.x - h0.x); shelf.rotation.y = base;
    const sm = new THREE.Mesh(box(cl, 1.85, 0.18).translate(cl / 2, 0, 0), mats.wood); shelf.add(sm);
    const bk = ['roof', 'barn', 'trim', 'leaf', 'cream'];
    for (let rw = 0; rw < 5; rw++) for (let b = 0; b < 8; b++) for (const zs of [-1, 1]) { const m = new THREE.Mesh(box(cl / 8 - 0.02, 0.24 + ((b * 3 + rw) % 3) * 0.03, 0.04), mats[bk[(b + rw) % bk.length]]); m.position.set(cl / 16 + b * cl / 8, 0.15 + rw * 0.35, zs * 0.11); shelf.add(m); }
    root.add(shelf);
    const far = th_ => V(h0.x + Math.cos(th_) * cl, 0, h0.z - Math.sin(th_) * cl);
    const openSign = far(base + 1.3).distanceTo(V(c.x, 0, c.z)) < far(base - 1.3).distanceTo(V(c.x, 0, c.z)) ? 1 : -1;
    // lamps inside
    const l1 = new THREE.PointLight('#ffb070', crt ? 3.2 : 2.2, 6.5, 1.4); l1.position.copy(P(270 * PI / 180, 2.4, y0 + 1.6)); root.add(l1);
    const l2 = new THREE.PointLight('#ffc890', crt ? 3.0 : 2.0, 7, 1.3); l2.position.set(c.x, A.LV[2] + 1.6, c.z); root.add(l2);
    const l3 = new THREE.PointLight('#d8e4ff', crt ? 4.5 : 3, 14, 1.0); l3.position.set(c.x, A.TOP - 0.5, c.z); root.add(l3);
    archFx = { rings, scan, lamp, door, lid, shelf, shelfBase: base, openSign, y0, lights: [l1, l2, l3] }; roomLights.push(l1, l2, l3);
  }

  // ---- the full-size Archive interior's moving and lit parts
  if (ARCHI) {
    const A = ARCHI, c = A.c, crt = state.theme === 'crt', P = (a, r, y) => V(c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r), ps = A.PS;
    const feats = ['SHE TURNED THE FLOOD AT A WORD · WITNESSED BY 3,120', 'HE HELD THE BRIDGE ALONE FOR NINE DAYS · WITNESSED BY 912', 'THE FIRE KNELT WHEN SHE SPOKE · WITNESSED BY 6,400', 'HE WROTE THE PLAGUE OUT OF THE CITY · WITNESSED BY ALL AURELIA', 'WHAT IS WITNESSED IS ETERNAL'];
    const featTex = rep => { const cv = document.createElement('canvas'); cv.width = 4096; cv.height = 96; const g = cv.getContext('2d'); g.fillStyle = crt ? '#140d06' : '#efe2c4'; g.fillRect(0, 0, 4096, 96); g.fillStyle = crt ? '#e8b450' : '#8a5a1e'; g.font = 'bold 54px Bebas Neue, Space Mono, sans-serif'; let x = 20, i = 0; while (x < 4096) { const t = feats[i++ % feats.length] + '   ✦   '; g.fillText(t, x, 70); x += g.measureText(t).width; } g.fillRect(0, 4, 4096, 3); g.fillRect(0, 89, 4096, 3); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(rep, 1); return t; };
    [[1, 9, 0.45], [2, 6, 0.7], [3, 3.6, 1.0]].forEach(([l, rep, h]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(A.WELL - 0.01, A.WELL - 0.01, h, 96, 1, true), new THREE.MeshBasicMaterial({ map: featTex(rep), side: THREE.BackSide })); m.position.set(c.x, A.LV[l] - 0.32 - h / 2, c.z); root.add(m); });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 3.6, A.OY - 3.0, 40, 1, true), new THREE.MeshBasicMaterial({ color: '#fff0d0', transparent: true, opacity: crt ? 0.06 : 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    shaft.position.set(c.x, (A.OY + 3.0) / 2, c.z); root.add(shaft);
    const orrery = new THREE.Group(); orrery.position.set(c.x, A.TOP + 2.6, c.z);
    const gm = new THREE.MeshStandardMaterial({ color: THREE_GOLD(crt), roughness: 0.35, metalness: 0.8 }), bm = new THREE.MeshBasicMaterial({ color: new THREE.Color(crt ? '#ffd27a' : '#e0a02a').multiplyScalar(crt ? 2 : 1) });
    const rings = [];
    [[1.8, 0.4, 2], [2.6, -0.3, 3], [3.4, 0.15, 3], [4.2, -0.12, 2]].forEach(([r, tilt, nb], i) => { const g = new THREE.Group(); g.rotation.x = tilt; const spin = new THREE.Group(); g.add(spin); spin.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 6, 96).rotateX(PI / 2), gm));
      for (let k = 0; k < nb; k++) { const a = k * 2 * PI / nb + i, b = new THREE.Mesh(new THREE.SphereGeometry(0.16 + 0.08 * ((k + i) % 2), 14, 10), bm); b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); spin.add(b); }
      spin.userData.sp = (i % 2 ? -1 : 1) * (0.1 + i * 0.04); rings.push(spin); orrery.add(g); });
    orrery.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 18, 14), bm));
    for (let k = 0; k < 3; k++) { const a = k * 2 * PI / 3, rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 6, 5), gm); rod.position.set(Math.cos(a) * 1.2, 3, Math.sin(a) * 1.2); orrery.add(rod); }
    root.add(orrery);
    // the pedestal's sliding panel and the void detector in its frame
    const mm = new THREE.MeshStandardMaterial({ color: crt ? '#2c2b31' : '#5c5a66', roughness: 0.35, metalness: 0.8 }), vg = new THREE.MeshBasicMaterial({ color: new THREE.Color(crt ? '#9b8cff' : '#6a5acd').multiplyScalar(crt ? 1.6 : 1) });
    const dz = c.z - 0.84 * ps, y0 = A.LV[0];
    for (const s of [-1, 1]) { const p = new THREE.Mesh(box(0.08 * ps, 1.12 * ps, 0.12 * ps), mm); p.position.set(c.x + s * 0.31 * ps, y0, dz); root.add(p); const g = new THREE.Mesh(box(0.014 * ps, 0.98 * ps, 0.07 * ps), vg); g.position.set(c.x + s * 0.27 * ps, y0 + 0.06 * ps, dz); root.add(g); }
    const lin = new THREE.Mesh(box(0.7 * ps, 0.08 * ps, 0.12 * ps), mm); lin.position.set(c.x, y0 + 1.07 * ps, dz); root.add(lin);
    const scan = new THREE.Mesh(box(0.54 * ps, 0.015, 0.07 * ps), new THREE.MeshBasicMaterial({ color: '#9b8cff', transparent: true, opacity: 0.6 })); scan.position.set(c.x, y0 + 0.5, dz); root.add(scan);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshBasicMaterial({ color: '#7dff9a' })); lamp.position.set(c.x, y0 + 1.15 * ps, dz - 0.05); root.add(lamp);
    const sc = document.createElement('canvas'); sc.width = 512; sc.height = 200; const sg = sc.getContext('2d');
    sg.fillStyle = '#07060c'; sg.fillRect(0, 0, 512, 200); sg.fillStyle = '#b9a8ff'; sg.font = 'bold 30px Space Mono, monospace'; sg.fillText('VOID DETECTOR', 18, 40);
    sg.font = '20px Space Mono, monospace'; sg.fillStyle = '#8f7cff'; sg.fillText('LINK: STATION · LIVE', 18, 78); sg.fillText('CLEARED: NERA · MOTHER · FATHER', 18, 110); sg.fillText('         ORIN (?)', 18, 138); sg.fillStyle = '#7dff9a'; sg.fillText('STATUS: CLEAR', 18, 178);
    const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36 * ps, 0.14 * ps), new THREE.MeshBasicMaterial({ map: st })); scr.position.set(c.x + 0.12 * ps, y0 + 0.95 * ps, dz - 0.08); scr.rotation.y = PI; root.add(scr);
    const door = new THREE.Group(); door.position.set(c.x, y0, c.z - 0.93 * ps);
    const dm = new THREE.Mesh(box(0.66 * ps, 1.14 * ps, 0.07 * ps), mats.stone); dm.add(new THREE.Mesh(hullOf(dm.geometry), outlineMaterial(th.ink, th.outlinePx))); door.add(dm);
    const rel = new THREE.Mesh(box(0.3 * ps, 0.22 * ps, 0.02 * ps), mats.gold); rel.position.set(0, 0.62 * ps, -0.05 * ps); door.add(rel); root.add(door);
    const rc = A.RI - 1.05, lid = new THREE.Group(); lid.position.copy(P(A.BB - 3.6 * PI / 180, rc + 0.5, y0 + 0.44)); lid.rotation.set(0, -A.BB, 0);
    lid.add(new THREE.Mesh(box(1.0, 0.05, 0.3).translate(-0.5, 0, 0), mats.wood)); lid.add(new THREE.Mesh(box(0.95, 0.06, 0.28).translate(-0.5, 0.05, 0), mats.fabric)); root.add(lid);
    const ha = A.NICHE - A.NW, hb = A.NICHE + A.NW, h0 = P(ha, A.RI - 0.13, A.LV[2]), h1 = P(hb, A.RI - 0.13, A.LV[2]), cl = h0.distanceTo(h1);
    const shelf = new THREE.Group(); shelf.position.copy(h0); const base = -Math.atan2(h1.z - h0.z, h1.x - h0.x); shelf.rotation.y = base;
    shelf.add(new THREE.Mesh(box(cl, 2.6, 0.24).translate(cl / 2, 0, 0), mats.wood));
    const bk = ['roof', 'barn', 'trim', 'leaf', 'cream'];
    for (let rw = 0; rw < 6; rw++) for (let b = 0; b < 8; b++) for (const zs of [-1, 1]) { const m = new THREE.Mesh(box(cl / 8 - 0.02, 0.26 + ((b * 3 + rw) % 3) * 0.03, 0.05), mats[bk[(b + rw) % bk.length]]); m.position.set(cl / 16 + b * cl / 8, 0.15 + rw * 0.4, zs * 0.14); shelf.add(m); }
    root.add(shelf);
    const far = t_ => V(h0.x + Math.cos(t_) * cl, 0, h0.z - Math.sin(t_) * cl);
    const openSign = far(base + 1.3).distanceTo(V(c.x, 0, c.z)) < far(base - 1.3).distanceTo(V(c.x, 0, c.z)) ? 1 : -1;
    const L1 = new THREE.PointLight('#ffb070', crt ? 7 : 5, 16, 1.2); L1.position.set(c.x - 6, y0 + 2.6, c.z + 5); root.add(L1);
    const L2 = new THREE.PointLight('#ffc890', crt ? 7 : 5, 18, 1.1); L2.position.set(c.x, A.LV[2] + 2.4, c.z); root.add(L2);
    const L3 = new THREE.PointLight('#d8e4ff', crt ? 9 : 6, 30, 1.0); L3.position.set(c.x, A.TOP + 4, c.z); root.add(L3);
    const L4 = new THREE.PointLight('#ffd9a0', crt ? 5 : 3.5, 14, 1.2); L4.position.set(c.x + 6, A.LV[1] + 2.4, c.z - 5); root.add(L4);
    archFxI = { rings, scan, lamp, door, lid, shelf, shelfBase: base, openSign, y0, ps }; roomLights.push(L1, L2, L3, L4);
  }

  // ---- Nera's lab, full size ("bigger on the inside"): the same rooms and things as the model's Undercroft, with space
  //      between them. Main lab 20 × 13, quarters, vault hall, bunker behind; the Archive's spiral comes down through the
  //      ceiling; the trapdoor drops to the passage. Built away from the model and entered by a fade.
  {
    const crt = state.theme === 'crt', K = new Kit(), O = V(1000, FLOOR + 0.12, 140), HH = 3.2, Y = O.y;
    const L = (x, y, z) => V(O.x + x, Y + y, O.z + z);
    const B = (kind, w, h, d, x, y, z, o = {}) => K.add(kind, xf(box(w, h, d), { ...L(x, y, z), ...o }));
    const S = (kind, x0, x1, y0, y1, z0, z1) => B(kind, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2);
    // main lab shell: floor with the trapdoor hole, walls, coffered ceiling with the spiral's hole
    const TD = [6.5, 2.2], SP = [-6, 8.5];
    S('void', -10, TD[0] - 0.6, -0.12, 0, 0, 13); S('void', TD[0] + 0.6, 10, -0.12, 0, 0, 13); S('void', TD[0] - 0.6, TD[0] + 0.6, -0.12, 0, 0, TD[1] - 0.6); S('void', TD[0] - 0.6, TD[0] + 0.6, -0.12, 0, TD[1] + 0.6, 13);
    S('concrete', -10.4, 10.4, 0, HH, -0.4, 0); S('concrete', -10.4, -10, 0, HH, 0, 30.4); S('concrete', 10, 10.4, 0, HH, 0, 30.4);
    S('concrete', -10, -3.6, 0, HH, 13, 13.3); S('concrete', -2.4, 10, 0, HH, 13, 13.3); S('concrete', -3.6, -2.4, 2.4, HH, 13, 13.3);
    for (let k = 1; k < 9; k++) { S('void', -9.95, 9.95, k * HH / 9, k * HH / 9 + 0.02, -0.02, 0); S('void', -9.98, -9.96, k * HH / 9, k * HH / 9 + 0.02, 0, 13); S('void', 9.96, 9.98, k * HH / 9, k * HH / 9 + 0.02, 0, 13); }
    S('concrete', -10.4, 10.4, HH, HH + 0.3, -0.4, SP[1] - 1.0); S('concrete', -10.4, 10.4, HH, HH + 0.3, SP[1] + 1.0, 13.3); S('concrete', -10.4, SP[0] - 1.0, HH, HH + 0.3, SP[1] - 1.0, SP[1] + 1.0); S('concrete', SP[0] + 1.0, 10.4, HH, HH + 0.3, SP[1] - 1.0, SP[1] + 1.0);
    for (let i = 0; i < 11; i++) { const x = -9 + i * 1.8; if (Math.abs(x - SP[0]) < 1.3) { S('concrete', x - 0.12, x + 0.12, HH - 0.35, HH, 0, SP[1] - 1.0); S('concrete', x - 0.12, x + 0.12, HH - 0.35, HH, SP[1] + 1.0, 13); } else S('concrete', x - 0.12, x + 0.12, HH - 0.35, HH, 0, 13); }
    for (let j = 0; j < 7; j++) { const z = 1 + j * 1.85; if (Math.abs(z - SP[1]) < 1.2) { S('concrete', -10, SP[0] - 1.0, HH - 0.35, HH, z - 0.12, z + 0.12); S('concrete', SP[0] + 1.0, 10, HH - 0.35, HH, z - 0.12, z + 0.12); } else S('concrete', -10, 10, HH - 0.35, HH, z - 0.12, z + 0.12); }
    for (const [x, z] of [[-4, 4.5], [4, 4.5], [-4, 9.5], [4, 9.5]]) { B('concrete', 0.6, HH, 0.6, x, 0, z); B('vglow', 0.05, HH * 0.8, 0.05, x, HH * 0.1, z - 0.31); }
    for (const [x, z] of [[-6, 3], [0, 3], [6, 6.5], [-1, 8]]) B('vglow', 1.6, 0.05, 0.1, x, HH - 0.4, z);
    S('vglow', -9.9, 9.9, 0.01, 0.04, 0.03, 0.06); S('vglow', -9.9, 9.9, 0.01, 0.04, 12.94, 12.97);
    // the spiral from the Archive, coming down through the ceiling
    K.add('metal', xf(cyl(0.1, 0.1, HH + 0.3, 10), L(SP[0], 0, SP[1])));
    for (let k = 0; k < 9; k++) { const a = -PI / 2 + 0.25 + 11 * 0.42 + k * 0.42, top = HH - (k + 1) * (HH / 9); K.add('metal', xf(box(0.74, 0.06, 0.3).translate(0.5, -0.06, 0), { ...L(SP[0], top, SP[1]), ry: -a })); K.add('vglow', xf(box(0.02, 0.02, 0.28).translate(0.86, -0.02, 0), { ...L(SP[0], top, SP[1]), ry: -a })); }
    K.add('concrete', new THREE.CylinderGeometry(1.05, 1.05, 0.3, 32, 1, true).translate(O.x + SP[0], Y + HH + 0.15, O.z + SP[1]));
    // her desk, chair and drafting board
    B('concrete', 1.6, 0.74, 0.8, -7.6, 0, 1.6); K.add('vglow', xf(new THREE.OctahedronGeometry(0.09), L(-8.2, 0.92, 1.5)));
    for (let k = 0; k < 4; k++) K.add('stone', xf(box(0.3, 0.01, 0.22), { ...L(-7.4 + k * 0.2, 0.75, 1.6 + (k % 2) * 0.1), ry: k * 0.3 }));
    B('dark', 0.45, 0.05, 0.45, -7.6, 0.45, 2.45); B('dark', 0.45, 0.5, 0.05, -7.6, 0.47, 2.68); for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) B('dark', 0.04, 0.45, 0.04, -7.6 + a, 0, 2.45 + b);
    B('dark', 1.4, 1.0, 0.05, -9.2, 0.9, 3.6, { rx: 0, ry: PI / 2 + 0.3 }); B('stone', 1.2, 0.8, 0.02, -9.14, 1.0, 3.6, { ry: PI / 2 + 0.3 });
    // the slab and the Storyborn's body, under a ring lamp
    const SBb = [-3, 6];
    B('dark', 2.2, 0.72, 1.0, SBb[0], 0, SBb[1]); B('trim', 2.3, 0.08, 1.1, SBb[0], 0.72, SBb[1]);
    K.add('stone', new THREE.CapsuleGeometry(0.17, 1.1, 4, 10).rotateZ(PI / 2).translate(O.x + SBb[0] + 0.05, Y + 0.98, O.z + SBb[1]));
    K.add('stone', new THREE.SphereGeometry(0.15, 10, 8).translate(O.x + SBb[0] - 0.75, Y + 1.0, O.z + SBb[1]));
    for (let k = 0; k < 6; k++) K.add('glow', new THREE.TorusGeometry(0.18, 0.018, 4, 18).rotateY(PI / 2).translate(O.x + SBb[0] - 0.4 + k * 0.17, Y + 0.98, O.z + SBb[1]));
    K.add('metal', new THREE.TorusGeometry(0.75, 0.05, 8, 32).rotateX(PI / 2).translate(O.x + SBb[0], Y + HH - 0.9, O.z + SBb[1])); K.add('vglow', new THREE.TorusGeometry(0.7, 0.02, 4, 32).rotateX(PI / 2).translate(O.x + SBb[0], Y + HH - 0.95, O.z + SBb[1]));
    for (const dx of [-0.6, 0.6]) B('metal', 0.03, 0.9, 0.03, SBb[0] + dx, HH - 0.9, SBb[1]);
    // the specimen table (her machine arm hangs over it from a rail)
    const ST = [4, 6];
    B('dark', 1.6, 0.72, 0.9, ST[0], 0, ST[1]); B('trim', 1.7, 0.08, 1.0, ST[0], 0.72, ST[1]);
    B('metal', 0.08, 0.08, 3.2, ST[0], HH - 0.5, ST[1]); for (const dz of [-1.4, 1.4]) B('metal', 0.04, 0.42, 0.04, ST[0], HH - 0.42, ST[1] + dz);
    { const yt = 0.8, P = (dx, y, dz) => L(ST[0] + dx, yt + y, ST[1] + dz);
      const Sh = P(-0.5, 0.06, -0.02), E = P(-0.22, 0.055, 0.04), Wr = P(0.03, 0.045, 0.01);
      tubeSeg(K, 'stone', Sh, E, 0.055, 0.047); ball(K, 'stone', E, 0.048); tubeSeg(K, 'stone', E, Wr, 0.046, 0.033); ball(K, 'stone', Wr, 0.034);
      K.add('dark', new THREE.CylinderGeometry(0.056, 0.056, 0.012, 16).rotateZ(PI / 2).translate(Sh.x - 0.002, Sh.y, Sh.z)); K.add('vglow', new THREE.TorusGeometry(0.05, 0.007, 4, 20).rotateY(PI / 2).translate(Sh.x - 0.008, Sh.y, Sh.z));
      for (const [a, b, ts, rr] of [[Sh, E, [0.35, 0.7], 0.054], [E, Wr, [0.3, 0.55, 0.8], 0.044]]) for (const t of ts) { const p = a.clone().lerp(b, t); K.add('glow', new THREE.TorusGeometry(rr - t * 0.008, 0.005, 4, 20).rotateY(PI / 2).translate(p.x, p.y, p.z)); }
      const pc = P(0.11, 0.034, 0); K.add('stone', box(0.085, 0.024, 0.08).translate(pc.x, pc.y - 0.012, pc.z));
      [[-0.03, 0.024], [-0.01, 0.029], [0.01, 0.028], [0.03, 0.021]].forEach(([off, len]) => { let p = P(0.15, 0.034, off); [0.25, 0.6, 0.95].forEach((a, i) => { const q = p.clone().add(V(len * Math.cos(a) * (1 - i * 0.18), -len * Math.sin(a) * (1 - i * 0.18), 0)); tubeSeg(K, 'stone', p, q, 0.0095 - i * 0.001, 0.0085 - i * 0.001); ball(K, 'stone', q, 0.0085 - i * 0.001); p = q; }); });
    }
    // specimen vats along the east wall, the board, the bookshelves, the relay and her panel
    for (let k = 0; k < 6; k++) { const z = 1.6 + k * 1.9; B('dark', 0.8, 0.2, 0.8, 9.0, 0, z); K.add('vglow', xf(cyl(0.28, 0.28, 1.3, 14), L(9.0, 0.2, z))); for (let j = 0; j < 4; j++) { const a = j * PI / 2; B('gold', 0.04, 1.3, 0.04, 9.0 + Math.cos(a) * 0.34, 0.2, z + Math.sin(a) * 0.34); } K.add('dark', xf(cyl(0.38, 0.34, 0.18, 14), L(9.0, 1.5, z))); }
    B('void', 2.6, 1.3, 0.06, 5.5, 0.8, 12.92); for (const [rr, dx] of [[0.4, 5.0], [0.24, 5.0], [0.3, 6.2]]) K.add('glow', new THREE.TorusGeometry(rr, 0.015, 4, 28).translate(O.x + dx, Y + 1.5, O.z + 12.87)); for (let k = 0; k < 5; k++) B('glow', 0.7 - k * 0.1, 0.014, 0.01, 6.0, 1.1 - k * 0.09, 12.87);
    const bk = ['roof', 'gold', 'trim', 'leaf', 'roof', 'barn'];
    for (const x0 of [-8.4, -5.8]) { B('concrete', 2.4, 2.2, 0.45, x0, 0, 12.75); for (let row = 0; row < 4; row++) for (let b = 0; b < 12; b++) B(bk[(b + row) % bk.length], 0.15, 0.36 + ((b * 7 + row) % 3) * 0.05, 0.28, x0 - 1.05 + b * 0.19, 0.12 + row * 0.52, 12.62); }
    { const rx = 1.5, rz = 12.1, s = 1.25;
      K.add('concrete', xf(cyl(0.48 * s, 0.5 * s, 0.16, 18), L(rx, 0, rz))); K.add('void', xf(cyl(0.4 * s, 0.42 * s, 0.38, 18), L(rx, 0.16, rz)));
      K.add('glass', xf(cyl(0.33 * s, 0.33 * s, 1.25 * s, 20), L(rx, 0.54, rz))); K.add('vglow', xf(cyl(0.11 * s, 0.11 * s, 1.25 * s, 12), L(rx, 0.54, rz)));
      for (let k = 0; k < 6; k++) { const a = k * PI / 3; B('metal', 0.035, 1.25 * s, 0.035, rx + Math.cos(a) * 0.36 * s, 0.54, rz + Math.sin(a) * 0.36 * s); }
      for (const y of [0.54, 0.54 + 0.62 * s, 0.54 + 1.25 * s]) K.add('gold', new THREE.TorusGeometry(0.37 * s, 0.022, 6, 24).rotateX(PI / 2).translate(O.x + rx, Y + y, O.z + rz));
      K.add('void', xf(cyl(0.42 * s, 0.4 * s, 0.26, 18), L(rx, 0.54 + 1.25 * s, rz)));
      B('concrete', 0.8, 0.85, 0.42, rx, 0, rz - 1.3); K.add('concrete', xf(box(0.88, 0.07, 0.52), { ...L(rx, 0.85, rz - 1.33), rx: 0.45 }));
      K.add('stone', xf(cyl(0.11, 0.11, 0.02, 20), { ...L(rx + 0.15, 0.92, rz - 1.4), rx: 0.45 })); B('metal', 0.05, 0.55, 0.05, rx - 0.25, 0.88, rz - 1.15);
      for (const dx of [-0.1, 0.1]) B('vglow', 0.03, 0.012, 0.9, rx + dx, 0, rz - 0.75);
    }
    for (const [du, dz, w_, d_] of [[0, 0.62, 1.26, 0.04], [0, -0.62, 1.26, 0.04], [0.62, 0, 0.04, 1.26], [-0.62, 0, 0.04, 1.26]]) B('vglow', w_, 0.03, d_, TD[0] + du, 0.02, TD[1] + dz);
    // her quarters (west) and the vault hall (east) behind the lab; the bunker beyond the round vault door
    S('void', -10, 10, -0.12, 0, 13.3, 21); S('concrete', -10.4, 10.4, HH, HH + 0.3, 13, 21.3);
    S('concrete', -1, -0.7, 0, HH, 13.3, 15.4); S('concrete', -1, -0.7, 0, HH, 16.6, 21); S('concrete', -1, -0.7, 2.4, HH, 15.4, 16.6);
    S('concrete', -10, 3.9, 0, HH, 21, 21.3); S('concrete', 6.1, 10, 0, HH, 21, 21.3); S('concrete', 3.9, 6.1, 2.2, HH, 21, 21.3);
    const Q = (x, z) => [-5.5 + x, 17 + z];
    { const [bx, bz] = Q(-3, 2); B('dark', 1.1, 0.32, 2.0, bx, 0, bz); B('trim', 1.0, 0.13, 1.9, bx, 0.32, bz); B('roof', 1.04, 0.07, 1.25, bx, 0.45, bz + 0.33); B('stone', 0.65, 0.09, 0.32, bx, 0.45, bz - 0.75); }
    { const [tx, tz] = Q(0.5, 1.5); B('dark', 1.2, 0.05, 0.9, tx, 0.74, tz); for (const [a, b] of [[-0.5, -0.36], [0.5, -0.36], [-0.5, 0.36], [0.5, 0.36]]) B('dark', 0.05, 0.74, 0.05, tx + a, 0, tz + b);
      for (const dx of [-0.9, 0.9]) { B('dark', 0.42, 0.05, 0.42, tx + dx, 0.45, tz); B('dark', 0.05, 0.48, 0.42, tx + dx * 1.24, 0.5, tz); }
      K.add('glow', xf(new THREE.OctahedronGeometry(0.08), L(tx + 0.3, 0.86, tz - 0.1))); B('gold', 0.15, 0.2, 0.02, tx - 0.25, 0.79, tz + 0.2, { rx: -0.2 }); B('stone', 0.11, 0.16, 0.022, tx - 0.25, 0.81, tz + 0.21, { rx: -0.2 }); }
    { const [wx, wz] = Q(-4, -2.6); B('dark', 0.7, 2.1, 1.2, wx, 0, wz); B('gold', 0.02, 0.24, 0.02, wx + 0.36, 1.05, wz - 0.06); B('gold', 0.02, 0.24, 0.02, wx + 0.36, 1.05, wz + 0.06); }
    for (const y of [1.0, 1.55]) { B('concrete', 2.0, 0.04, 0.28, -5.5, y, 20.8); for (let b = 0; b < 9; b++) B(bk[b % bk.length], 0.13, 0.28 + (b % 3) * 0.04, 0.22, -6.3 + b * 0.18, y + 0.04, 20.8); }
    B('stone', 0.7, 0.8, 0.5, -1.6, 0, 20.6); K.add('trim', xf(cyl(0.22, 0.18, 0.08, 14), L(-1.6, 0.8, 20.6))); B('barn', 2.4, 0.012, 1.6, -5.5, 0, 16.6); B('glow', 0.6, 0.04, 0.1, -5.5, HH - 0.07, 17);
    for (const z of [14.5, 16.4, 18.3]) { B('concrete', 0.55, 2.1, 1.2, 9.6, 0, z); for (let row = 0; row < 3; row++) for (let b = 0; b < 3; b++) B(['trim', 'dark', 'barn'][(b + row) % 3], 0.4, 0.32, 0.32, 9.55, 0.12 + row * 0.65, z - 0.36 + b * 0.36); }
    K.add('metal', new THREE.TorusGeometry(1.25, 0.13, 10, 40).translate(O.x + 5, Y + 1.05, O.z + 21.05));
    for (let k = 0; k < 8; k++) { const a = k * PI / 4; K.add('gold', xf(cyl(0.04, 0.04, 0.09, 8).rotateX(PI / 2), L(5 + Math.cos(a) * 1.25, 1.05 + Math.sin(a) * 1.25, 20.92))); }
    K.add('metal', new THREE.CylinderGeometry(1.15, 1.15, 0.32, 40).rotateZ(PI / 2).translate(O.x + 6.45, Y + 1.05, O.z + 19.9)); K.add('dark', new THREE.CylinderGeometry(0.9, 0.9, 0.33, 32).rotateZ(PI / 2).translate(O.x + 6.45, Y + 1.05, O.z + 19.9));
    K.add('gold', new THREE.TorusGeometry(0.36, 0.04, 6, 24).rotateY(PI / 2).translate(O.x + 6.25, Y + 1.05, O.z + 19.9)); for (let k = 0; k < 3; k++) K.add('gold', box(0.03, 0.7, 0.03).translate(0, -0.35, 0).rotateX(k * PI / 3).translate(O.x + 6.25, Y + 1.05, O.z + 19.9));
    S('void', -0.7, 10, -0.12, 0, 21.3, 30); S('concrete', -1, -0.7, 0, HH, 21.3, 30.4); S('concrete', -1, 10.4, 0, HH, 30, 30.4); S('concrete', -1, 10.4, HH, HH + 0.5, 21, 30.4);
    for (const z of [23, 26]) { for (const [dx, dz] of [[-0.4, -0.95], [0.4, -0.95], [-0.4, 0.95], [0.4, 0.95]]) B('metal', 0.05, 1.8, 0.05, 0.2 + dx, 0, z + dz); for (const y of [0.35, 1.3]) { B('metal', 0.85, 0.06, 1.95, 0.2, y, z); B('trim', 0.78, 0.1, 1.85, 0.2, y + 0.06, z); B('roof', 0.8, 0.04, 0.95, 0.2, y + 0.16, z + 0.4); } }
    B('dark', 1.4, 0.8, 0.9, 5, 0, 25.5); B('vglow', 1.2, 0.012, 0.7, 5, 0.8, 25.5);
    [[9.2, 22.4, 0.55, 'barn'], [9.2, 23.1, 0.5, 'trim'], [9.2, 22.7, 0.45, 'dark'], [8.5, 22.2, 0.5, 'trim']].forEach(([x, z, s_, k], i) => B(k, s_, s_, s_, x, i === 2 ? 0.55 : 0, z));
    for (const [x, z] of [[9.1, 29.2], [8.2, 29.3]]) { K.add('metal', xf(cyl(0.4, 0.4, 1.5, 18), L(x, 0, z))); K.add('gold', new THREE.TorusGeometry(0.405, 0.02, 4, 24).rotateX(PI / 2).translate(O.x + x, Y + 0.75, O.z + z)); }
    B('red', 0.35, 0.06, 0.12, 5, HH - 0.06, 25.5);
    for (const [k, g] of Object.entries(K.merge())) { const m = new THREE.Mesh(g, mats[k] || mats.concrete); if (!['glow', 'vglow', 'glass', 'red'].includes(k)) { m.castShadow = m.receiveShadow = true; m.add(new THREE.Mesh(hullOf(g), outlineMaterial(th.ink, th.outlinePx))); } root.add(m); }
    // moving and lit parts: the machine arm, the trapdoor lid, her panel's screen, lamps
    labArmI = makeArm({ scale: 1.15, L1: 0.5, L2: 0.46, crt }); labArmI.root.position.copy(L(ST[0], HH - 0.62, ST[1])); labArmI.root.userData.base = labArmI.root.position.clone(); root.add(labArmI.root);
    trapLidI = new THREE.Group(); trapLidI.position.copy(L(TD[0], 0, TD[1] + 0.6)); const tl_ = new THREE.Mesh(box(1.2, 0.05, 1.2).translate(0, 0, -0.6), mats.void); tl_.add(new THREE.Mesh(hullOf(tl_.geometry), outlineMaterial(th.ink, th.outlinePx))); trapLidI.add(tl_); root.add(trapLidI);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), new THREE.MeshBasicMaterial({ map: screenTex(), color: crt ? '#ffffff' : '#bbbbff' })); scr.position.copy(L(1.25, 1.33, 10.95)); scr.rotation.x = -0.18; root.add(scr);
    for (const [c_, i_, d_, x, y, z] of [['#7a5cff', 9, 16, -3, 2.6, 4], ['#5a3cff', 7, 14, 5, 2.4, 9], ['#8a70ff', 6, 14, -5, 2.4, 10], ['#ffb878', 5, 10, -5.5, 2.4, 17], ['#ff6a4a', 6, 11, 4.5, 2.3, 25.5], ['#7a5cff', 5, 11, 4.5, 2.3, 17]]) { const l = new THREE.PointLight(c_, crt ? i_ : i_ * 0.7, d_, 1.3); l.position.copy(L(x, y, z)); root.add(l); roomLights.push(l); }
    LABI = { O, L, HH, TD, SP, ST, SBb };
  }

  // ---- the Temple of the Voided, full size ("bigger on the inside"), with the passage from the full-size lab.
  //      Hall 30 × 20, 7.5 high: the station at the centre (1.5× the model's), six relays on a ring, kneeling stones,
  //      Nera's console, the surgical bay with the big arm, tanks and data stacks, two void gates, the gallery where the
  //      passage comes in, the spiral stair up to the hatch. Underground: strata, roots, drips, blind lancets.
  if (LABI) {
    const crt = state.theme === 'crt', T = new Kit(), Lb = LABI, trapW = Lb.L(Lb.TD[0], 0, Lb.TD[1]);
    const Ft = FLOOR - 2.5, GY = Ft, HXW = 15, HZW = 10, HH = 7.5, yF = GY - 4.6, TO = V(trapW.x - 4, yF, trapW.z - 33);
    const P_ = (x, y, z) => V(TO.x + x, yF + y, TO.z + z);
    const bx = (kind, x0, x1, y0, y1, z0, z1) => T.add(kind, xf(box(x1 - x0, y1 - y0, z1 - z0), { ...P_((x0 + x1) / 2, y0, (z0 + z1) / 2) }));
    const MX = trapW.x - TO.x;                                                       // the passage's mouth, straight ahead of the trapdoor
    const r = rng(29);
    // shell, with the mouth in the south wall
    bx('rock', -HXW - 0.5, HXW + 0.5, -0.4, 0, -HZW - 0.5, HZW + 0.5); bx('void', -HXW, HXW, 0, 0.04, -HZW, HZW);
    const my0 = GY - yF, my1 = my0 + 1.6;
    bx('rock', -HXW - 0.5, MX - 0.8, 0, HH, HZW, HZW + 0.5); bx('rock', MX + 0.8, HXW + 0.5, 0, HH, HZW, HZW + 0.5); bx('rock', MX - 0.8, MX + 0.8, 0, my0, HZW, HZW + 0.5); bx('rock', MX - 0.8, MX + 0.8, my1, HH, HZW, HZW + 0.5);
    bx('rock', -HXW - 0.5, HXW + 0.5, 0, HH, -HZW - 0.5, -HZW); bx('rock', -HXW - 0.5, -HXW, 0, HH, -HZW, HZW); bx('rock', HXW, HXW + 0.5, 0, HH, -HZW, HZW);
    bx('rock', -HXW - 0.5, HXW + 0.5, HH, HH + 0.5, -HZW - 0.5, HZW + 0.5);
    for (const [y0, h, k] of [[0, 0.6, 'strA'], [1.6, 0.2, 'strB'], [3.0, 0.6, 'strA'], [4.7, 0.15, 'strB'], [5.9, 0.5, 'strA']]) {
      const ya = y0, yb = y0 + h;
      if (yb > my0 && ya < my1) { bx(k, -HXW, MX - 0.8, ya, yb, HZW - 0.05, HZW); bx(k, MX + 0.8, HXW, ya, yb, HZW - 0.05, HZW); } else bx(k, -HXW, HXW, ya, yb, HZW - 0.05, HZW);
      bx(k, -HXW, HXW, ya, yb, -HZW, -HZW + 0.05); bx(k, -HXW, -HXW + 0.05, ya, yb, -HZW, HZW); bx(k, HXW - 0.05, HXW, ya, yb, -HZW, HZW);
    }
    const lan = (w, h) => { const sh = new THREE.Shape(), sy = h - w * 0.866; sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, sy); sh.absarc(w / 2, sy, w, PI, PI * 2 / 3, true); sh.absarc(-w / 2, sy, w, PI / 3, 0, true); sh.lineTo(w / 2, 0); sh.closePath(); return sh; };
    const lancet = (x, z, ry, w = 1.3, h = 4.6) => { T.add('stone', xf(new THREE.ExtrudeGeometry(lan(w, h), { depth: 0.1, bevelEnabled: false, curveSegments: 6 }), { ...P_(x, 0.8, z), ry })); T.add('vglow', xf(new THREE.ShapeGeometry(lan(w * 0.67, h - 0.4), 6), { ...P_(x + Math.sin(ry) * 0.12, 0.95, z + Math.cos(ry) * 0.12), ry })); };
    const RIBS = []; for (let x = -12.5; x <= 12.5; x += 5) RIBS.push(x);
    for (const x of RIBS) { bx('rock', x - 0.2, x + 0.2, HH - 0.45, HH, -HZW, HZW); for (const z of [-HZW + 0.18, HZW - 0.18]) { bx('rock', x - 0.25, x + 0.25, 0, HH, z - 0.18, z + 0.18); bx('vglow', x - 0.03, x + 0.03, HH * 0.12, HH * 0.75, z + (z < 0 ? 0.19 : -0.22), z + (z < 0 ? 0.22 : -0.19)); } }
    for (let i = 0; i < RIBS.length - 1; i++) { const x = (RIBS[i] + RIBS[i + 1]) / 2; lancet(x, -HZW, 0); if (Math.abs(x - MX) > 1.6) lancet(x, HZW, PI); }
    // the gallery where the passage comes in, and its stair down the south wall
    bx('concrete', MX - 2, MX + 2, my0 - 0.2, my0, HZW - 1.8, HZW); for (const x of [MX - 1.8, MX + 1.8]) bx('concrete', x - 0.12, x + 0.12, 0, my0 - 0.2, HZW - 1.7, HZW - 1.5);
    for (const x of [MX - 1.95, MX - 0.65, MX + 0.65, MX + 1.95]) bx('metal', x - 0.03, x + 0.03, my0, my0 + 1.0, HZW - 1.78, HZW - 1.72);
    bx('metal', MX - 2, MX + 2, my0 + 1.0, my0 + 1.05, HZW - 1.79, HZW - 1.71); bx('vglow', MX - 2, MX + 2, my0 + 0.96, my0 + 0.98, HZW - 1.74, HZW - 1.72); bx('metal', MX + 1.96, MX + 2.0, my0 + 1.0, my0 + 1.05, HZW - 1.8, HZW);
    const NG = 22, gr = my0 / NG, sx0 = MX - 2;
    for (let k = 0; k < NG; k++) { const top = my0 - (k + 1) * gr, x = sx0 - 0.2 - k * 0.4; bx('concrete', x - 0.2, x + 0.2, 0, top, HZW - 1.3, HZW); bx('vglow', x - 0.2, x - 0.16, top - 0.02, top + 0.005, HZW - 1.3, HZW - 0.05); }
    tubeSeg(T, 'metal', P_(sx0, my0 + 1.0, HZW - 1.33), P_(sx0 - NG * 0.4, 1.0, HZW - 1.33), 0.03, 0.03);
    // the station, 1.5× the model's: two halves split by light, flush on the floor; the capstone floats
    const s = 2.55, h = 6.1, hc = 4.7, g = 0.3, sc = s * (1 - hc / h);
    const half = sign => { const Q = (x, y, z) => { const p = P_(x * sign + sign * g, y + 0.04, z); return [p.x, p.y, p.z]; };
      const a = Q(0, 0, -s), b = Q(s, 0, -s), c = Q(s, 0, s), d = Q(0, 0, s), a2 = Q(0, hc, -sc), b2 = Q(sc, hc, -sc), c2 = Q(sc, hc, sc), d2 = Q(0, hc, sc);
      for (const [kind, qs] of Object.entries({ void: [[b, b2, c2, c], [a, a2, b2, b], [c, c2, d2, d], [a2, d2, c2, b2], [a, b, c, d]], seam: [[a, d, d2, a2]] })) { const pos = []; for (let q of qs) { if (sign < 0) q = [...q].reverse(); pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]); } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); T.add(kind, geo); } };
    half(1); half(-1);
    const hwAt = y => s - (s - sc) * y / hc;
    for (const y of [0.8, 2.4, 3.9]) for (const sign of [-1, 1]) { const w_ = hwAt(y); T.add('vglow', xf(box(0.04, 0.05, 2 * w_), P_(sign * (g + w_ + 0.03), 0.04 + y, 0))); for (const sz of [-1, 1]) T.add('vglow', xf(box(w_, 0.05, 0.04), P_(sign * (g + w_ / 2), 0.04 + y, sz * (w_ + 0.03)))); }
    const handShape = (() => { const sh = new THREE.Shape(); sh.absellipse(0, 0, 0.055, 0.065, 0, PI * 2); return sh; })();
    const hand = () => { const gs = [new THREE.ShapeGeometry(handShape, 10)]; [[-0.05, 0.07, 0.3], [-0.018, 0.09, 0.1], [0.016, 0.092, -0.05], [0.048, 0.08, -0.2]].forEach(([x, l, a]) => gs.push(new THREE.PlaneGeometry(0.024, l).translate(0, l / 2, 0).rotateZ(a).translate(x, 0.05, 0))); gs.push(new THREE.PlaneGeometry(0.026, 0.06).translate(0, 0.03, 0).rotateZ(1.0).translate(-0.05, -0.01, 0)); return mergeGeometries(gs.map(q => q.toNonIndexed()), false); };
    const nOut = V(hc, s - sc, 0).normalize(), nFront = V(0, s - sc, -hc).normalize();
    const place = (n, p) => { const g_ = hand(); g_.applyMatrix4(new THREE.Matrix4().compose(p.clone().addScaledVector(n, 0.012), new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n), V(1, 1, 1))); T.add('hand', g_); };
    for (const [sign, z, y] of [[1, -0.8, 0.95], [1, 0.5, 1.05], [1, 1.3, 0.9], [-1, 0.2, 0.9], [-1, -1.0, 1.15], [-1, 1.1, 1.0]]) place(V(nOut.x * sign, nOut.y, 0), P_(sign * (g + hwAt(y)), 0.04 + y, z));
    for (const [x, zs] of [[1.2, -1], [-1.3, -1], [0.9, 1], [-0.7, 1]]) place(V(0, nFront.y, zs < 0 ? nFront.z : -nFront.z), P_(Math.sign(x) * g + x, 1.0, zs * hwAt(0.96)));
    T.add('vglow', xf(cyl(0.09, 0.09, HH, 8), P_(0, 0, 0))); T.add('vglow', new THREE.TorusGeometry(3.1, 0.04, 4, 96).rotateX(PI / 2).translate(TO.x, yF + 0.05, TO.z));
    T.add('void', new THREE.CircleGeometry(0.45, 20).rotateX(PI / 2).translate(TO.x, yF + HH - 0.01, TO.z)); T.add('vglow', new THREE.TorusGeometry(0.5, 0.035, 4, 32).rotateX(PI / 2).translate(TO.x, yF + HH - 0.02, TO.z));
    // six relays, floor lines from the station, kneeling stones
    const RR = 6.6, rel = [];
    for (let k = 0; k < 6; k++) { const a = PI / 6 + k * PI / 3, x = Math.cos(a) * RR, z = Math.sin(a) * RR, q = 1.2; rel.push(P_(x, 0, z));
      T.add('concrete', xf(cyl(0.52 * q, 0.55 * q, 0.16, 20), P_(x, 0, z))); T.add('void', xf(cyl(0.44 * q, 0.46 * q, 0.42, 20), P_(x, 0.16, z)));
      T.add('glass', xf(cyl(0.36 * q, 0.36 * q, 1.8, 22), P_(x, 0.58, z))); T.add('vglow', xf(cyl(0.15, 0.15, 1.8, 12), P_(x, 0.58, z)));
      for (let j = 0; j < 6; j++) { const b = j * PI / 3; T.add('metal', xf(box(0.045, 1.8, 0.045), P_(x + Math.cos(b) * 0.48, 0.58, z + Math.sin(b) * 0.48))); }
      for (const y of [0.58, 1.48, 2.38]) T.add('gold', new THREE.TorusGeometry(0.49, 0.028, 6, 28).rotateX(PI / 2).translate(TO.x + x, yF + y, TO.z + z));
      T.add('void', xf(cyl(0.55, 0.52, 0.34, 20), P_(x, 2.38, z))); T.add('concrete', xf(cyl(0.34, 0.4, 0.14, 16), P_(x, 2.72, z))); T.add('vglow', xf(cyl(0.06, 0.06, 0.16, 8), P_(x, 2.86, z)));
      const len = RR - 3.1 - 0.65; T.add('vglow', xf(box(0.09, 0.014, len).translate(0, 0, 3.1 + len / 2), { ...P_(0, 0.04, 0), ry: PI / 2 - a })); }
    for (let k = 0; k < 6; k++) { const a = k * PI / 3, x = Math.cos(a) * 4.0, z = Math.sin(a) * 4.0; T.add('rock', xf(box(0.36, 0.12, 0.6), { ...P_(x, 0.04, z), ry: -a })); }
    // Nera's console, wired to the station
    const NC = [-7.6, 0];
    T.add('concrete', xf(box(0.5, 0.88, 0.9), P_(NC[0], 0, NC[1]))); T.add('concrete', xf(box(0.6, 0.07, 1.0), { ...P_(NC[0] - 0.02, 0.88, NC[1]), rz: 0.42 }));
    T.add('stone', xf(cyl(0.12, 0.12, 0.02, 20), { ...P_(NC[0] - 0.06, 0.96, NC[1] + 0.22), rz: 0.42 })); T.add('metal', xf(box(0.06, 0.6, 0.06), P_(NC[0] - 0.22, 0.9, NC[1] - 0.32)));
    T.add('metal', xf(box(NC[0] * -1 - 3.2, 0.05, 0.1), P_((NC[0] - 2.9) / 2 + 0.25, 0.04, NC[1]))); T.add('vglow', xf(box(-NC[0] - 3.2, 0.014, 0.04), P_((NC[0] - 2.9) / 2 + 0.25, 0.1, NC[1])));
    // the surgical bay at the east end, tanks and data stacks
    const SB = [10.5, 1.0];
    T.add('dark', xf(box(1.0, 0.82, 2.3), P_(SB[0], 0, SB[1]))); T.add('trim', xf(box(1.1, 0.08, 2.4), P_(SB[0], 0.82, SB[1])));
    T.add('stone', new THREE.CapsuleGeometry(0.17, 1.1, 4, 10).rotateX(PI / 2).translate(TO.x + SB[0], yF + 1.07, TO.z + SB[1] + 0.05)); T.add('stone', new THREE.SphereGeometry(0.15, 10, 8).translate(TO.x + SB[0], yF + 1.09, TO.z + SB[1] - 0.78));
    for (let k = 0; k < 6; k++) T.add('glow', new THREE.TorusGeometry(0.18, 0.018, 4, 18).translate(TO.x + SB[0], yF + 1.07, TO.z + SB[1] - 0.4 + k * 0.17));
    T.add('metal', new THREE.TorusGeometry(0.85, 0.07, 8, 32).rotateX(PI / 2).translate(TO.x + SB[0], yF + 3.4, TO.z + SB[1])); T.add('vglow', new THREE.TorusGeometry(0.8, 0.03, 4, 32).rotateX(PI / 2).translate(TO.x + SB[0], yF + 3.35, TO.z + SB[1]));
    for (const dz of [-0.6, 0.6]) T.add('metal', xf(box(0.04, HH - 3.4, 0.04), P_(SB[0] + 0.75, 3.4, SB[1] + dz)));
    for (const z of [-8.5, -6.7, -4.9]) { const x = 14.0; T.add('concrete', xf(cyl(0.62, 0.65, 0.22, 20), P_(x, 0, z))); T.add('glass', xf(cyl(0.54, 0.54, 3.0, 22), P_(x, 0.22, z))); T.add('stone', new THREE.CapsuleGeometry(0.16, 0.9, 4, 8).translate(TO.x + x, yF + 1.6, TO.z + z)); T.add('stone', new THREE.SphereGeometry(0.14, 10, 8).translate(TO.x + x, yF + 2.35, TO.z + z)); T.add('vglow', new THREE.TorusGeometry(0.54, 0.03, 4, 28).rotateX(PI / 2).translate(TO.x + x, yF + 0.28, TO.z + z)); T.add('void', xf(cyl(0.62, 0.58, 0.32, 20), P_(x, 3.22, z))); }
    for (let i = 0; i < 7; i++) { const x = 2.5 + i * 1.0; T.add('void', xf(box(0.8, 2.8, 0.9), P_(x, 0, -HZW + 0.95))); for (let j = 0; j < 16; j++) T.add('vglow', xf(box(0.55, 0.016, 0.01), P_(x, 0.4 + j * 0.14, -HZW + 1.41))); }
    // the spiral stair up to the hatch, west
    const HX = -11, HZ = -5, NS = 34, STEP = 0.36, rise = HH / NS;
    T.add('concrete', xf(cyl(0.18, 0.18, HH + 1.5, 10), P_(HX, 0, HZ)));
    for (let k = 0; k < NS; k++) { const a = k * STEP, y = HH - (k + 1) * rise; T.add('concrete', xf(box(0.95, 0.1, 0.42).translate(0.62, -0.1, 0), { ...P_(HX, y, HZ), ry: -a })); T.add('vglow', xf(box(0.03, 0.025, 0.42).translate(1.1, -0.02, 0), { ...P_(HX, y, HZ), ry: -a })); }
    T.add('concrete', new THREE.CylinderGeometry(1.25, 1.25, 1.6, 32, 1, true).scale(-1, 1, 1).translate(TO.x + HX, yF + HH + 0.8, TO.z + HZ));
    T.add('vglow', new THREE.TorusGeometry(1.2, 0.035, 4, 32).rotateX(PI / 2).translate(TO.x + HX, yF + HH - 0.03, TO.z + HZ));
    // pools, roots and stalactites, clear of the station, the stairs, the gallery and the bay
    const drips = [];
    const rootAt = (x, z, len) => { let p = P_(x, HH + 0.05, z), rad = 0.09; const n = 3 + Math.floor(r() * 2); for (let i = 0; i < n; i++) { const q = p.clone().add(V((r() - 0.5) * 0.45, -len / n, (r() - 0.5) * 0.45)); tubeSeg(T, 'root', p, q, rad, rad * 0.62, 5); p = q; rad *= 0.62; } return p; };
    const busy = (x, z, m) => Math.hypot(x, z) < 7.6 + m || Math.hypot(x - HX, z - HZ) < 1.8 + m || (z > HZW - 2.5 - m && x > sx0 - 9.5 && x < MX + 2.5) || x > 8.5 - m || Math.hypot(x - NC[0], z - NC[1]) < 1.2 + m || (z < -HZW + 2.2 && x > 1.5);
    for (let tries = 0; drips.length < 7 && tries < 800; tries++) { const x = -HXW + 1.2 + r() * (2 * HXW - 2.4), z = -HZW + 1.2 + r() * (2 * HZW - 2.4), rr = 0.4 + r() * 0.5; if (busy(x, z, rr) || drips.some(d => Math.hypot(d.x - TO.x - x, d.z - TO.z - z) < 3)) continue;
      T.add('pool', new THREE.CircleGeometry(rr, 20).rotateX(-PI / 2).translate(TO.x + x, yF + 0.045, TO.z + z)); const tip = rootAt(x, z, 1.4 + r() * 1.4); drips.push({ x: tip.x, z: tip.z, top: tip.y, bottom: yF + 0.05, ph: r() * 3 }); }
    for (let i = 0; i < 40; i++) { const x = -HXW + 0.6 + r() * (2 * HXW - 1.2), z = -HZW + 0.5 + r() * (2 * HZW - 1); if (Math.hypot(x - HX, z - HZ) < 1.6 || Math.hypot(x, z) < 2.2 || (z > HZW - 2.5 && Math.abs(x - MX) < 2.5) || Math.hypot(x - SB[0], z - SB[1]) < 2) continue; rootAt(x, z, 0.6 + r() * 1.8); }
    for (let i = 0; i < 70; i++) { const x = -HXW + 0.5 + r() * (2 * HXW - 1), z = -HZW + 0.4 + r() * (2 * HZW - 0.8), hh = 0.25 + r() * 0.6; if (Math.hypot(x - HX, z - HZ) < 1.6 || Math.hypot(x, z) < 1.2) continue; T.add('rock', new THREE.ConeGeometry(0.07 + r() * 0.08, hh, 5).rotateX(PI).translate(TO.x + x, yF + HH - hh / 2, TO.z + z)); }
    // the passage at full size: a shaft down from the trapdoor, a ribbed tunnel straight to the mouth
    const TW = 1.4, TH = 1.9, z0 = trapW.z - 0.8, z1 = TO.z + HZW + 0.5, tx = trapW.x;
    const wallM = new THREE.MeshStandardMaterial({ color: crt ? '#47453f' : '#a8a59e', roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
    const floorM = new THREE.MeshStandardMaterial({ color: crt ? '#1b1a1d' : '#57545c', roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide });
    const quad = (m, w, h, x, y, z, rx, ry) => { const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); q.position.set(x, y, z); q.rotation.set(rx, ry, 0); root.add(q); };
    const tl = z0 - z1, tz = (z0 + z1) / 2;
    quad(floorM, TW, tl, tx, GY, tz, -PI / 2, 0); quad(wallM, TW, tl, tx, GY + TH, tz, PI / 2, 0); quad(wallM, tl, TH, tx - TW / 2, GY + TH / 2, tz, 0, PI / 2); quad(wallM, tl, TH, tx + TW / 2, GY + TH / 2, tz, 0, PI / 2);
    const sh = trapW.y - 0.12 - (GY + TH);
    for (const [dx, dz, ry, w] of [[-TW / 2, 0, PI / 2, 1.4], [TW / 2, 0, PI / 2, 1.4], [0, 0.7, 0, TW]]) quad(wallM, w, sh + TH, tx + dx, GY + (sh + TH) / 2, trapW.z + dz, 0, ry);
    quad(wallM, TW, sh, tx, GY + TH + sh / 2, trapW.z - 0.7, 0, 0);
    quad(floorM, TW, 1.4, tx, GY + 0.002, trapW.z, -PI / 2, 0);
    for (let y = GY + 0.35; y < trapW.y - 0.2; y += 0.3) { const rg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.05), mats.metal); rg.position.set(tx, y, trapW.z + 0.64); root.add(rg); }
    for (let z = z0 - 1; z > z1 + 0.5; z -= 1.8) { for (const sx of [-1, 1]) T.add('concrete', xf(box(0.16, TH, 0.26), { x: tx + sx * (TW / 2 - 0.08), y: GY, z })); T.add('concrete', xf(box(TW, 0.18, 0.26), { x: tx, y: GY + TH - 0.18, z })); T.add('vglow', xf(box(TW - 0.35, 0.02, 0.05), { x: tx, y: GY + TH - 0.2, z })); }
    T.add('vglow', xf(box(0.07, 0.012, tl), { x: tx, y: GY + 0.005, z: tz }));
    const tmI = {
      rock: new THREE.MeshStandardMaterial({ color: crt ? '#2e2a33' : '#4a4553', roughness: 0.85, flatShading: true }), stone: new THREE.MeshStandardMaterial({ color: crt ? '#2b2731' : '#625c6c', roughness: 0.8, flatShading: true }),
      void: new THREE.MeshStandardMaterial({ color: crt ? '#08070b' : '#1d1b26', roughness: 0.22, metalness: 0.45, flatShading: true }), concrete: new THREE.MeshStandardMaterial({ color: crt ? '#56544f' : '#a8a59e', roughness: 0.95, flatShading: true }),
      metal: new THREE.MeshStandardMaterial({ color: crt ? '#3a3940' : '#6c6a74', roughness: 0.4, metalness: 0.75 }), gold: new THREE.MeshStandardMaterial({ color: th.gold, roughness: 0.35, metalness: 0.75 }),
      trim: new THREE.MeshStandardMaterial({ color: th.trim, roughness: 0.8, flatShading: true }), dark: new THREE.MeshStandardMaterial({ color: th.dark, roughness: 0.8, flatShading: true }),
      glass: new THREE.MeshStandardMaterial({ color: crt ? '#b9a8ff' : '#7a6ad8', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(th.glow).multiplyScalar(th.glowBoost) }), vglow: new THREE.MeshBasicMaterial({ color: new THREE.Color(crt ? '#9b8cff' : '#6a5acd').multiplyScalar(crt ? 1.6 : 1) }),
      seam: new THREE.MeshBasicMaterial({ color: new THREE.Color(crt ? '#5a46c8' : '#4a3ab0').multiplyScalar(crt ? 0.75 : 0.9) }), hand: new THREE.MeshBasicMaterial({ color: new THREE.Color(crt ? '#c9bfff' : '#6a5acd').multiplyScalar(crt ? 1.3 : 1), side: THREE.DoubleSide }),
      strA: new THREE.MeshStandardMaterial({ color: crt ? '#3e3024' : '#6e5c48', roughness: 1, flatShading: true }), strB: new THREE.MeshStandardMaterial({ color: crt ? '#6b5338' : '#a08a68', roughness: 1, flatShading: true }),
      root: new THREE.MeshStandardMaterial({ color: '#5a4330', roughness: 0.9, flatShading: true }), pool: new THREE.MeshStandardMaterial({ color: crt ? '#04040a' : '#15141e', roughness: 0.04, metalness: 0.7 })
    };
    for (const [k, g_] of Object.entries(T.merge())) { const m = new THREE.Mesh(g_, tmI[k]); if (!['vglow', 'pool', 'root', 'strB', 'glass', 'hand', 'glow', 'seam'].includes(k)) { m.castShadow = m.receiveShadow = true; m.add(new THREE.Mesh(hullOf(g_), outlineMaterial(th.ink, th.outlinePx))); } root.add(m); }
    for (const [c_, i_, d_, x, y, z] of [['#7a5cff', 24, 28, 0, 5.0, 0], ['#6a4cff', 12, 20, -10, 6.0, -3], ['#dfe2ff', 12, 12, SB[0], 4.6, SB[1]], ['#6a4cff', 10, 18, MX, 5.6, 6], ['#6a4cff', 9, 18, 8, 5.6, -6]]) { const l = new THREE.PointLight(c_, crt ? i_ : i_ * 0.6, d_, 1.2); l.position.copy(P_(x, y, z)); root.add(l); }
    const tunL = new THREE.PointLight('#7a5cff', crt ? 3 : 2, 12, 1.4); tunL.position.set(tx, GY + 1.4, tz); root.add(tunL);
    capI = new THREE.Group(); capI.position.copy(P_(0, 0.04 + hc + 0.4, 0)); capI.userData.y0 = capI.position.y;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(sc * Math.SQRT2, h - hc, 4).rotateY(PI / 4).translate(0, (h - hc) / 2, 0), tmI.void); cap.add(new THREE.Mesh(hullOf(cap.geometry), outlineMaterial(th.ink, th.outlinePx))); capI.add(cap);
    const capRing = new THREE.Mesh(new THREE.TorusGeometry(sc * 1.25, 0.03, 4, 32).rotateX(PI / 2), tmI.vglow); capRing.position.y = -0.14; capI.add(capRing); root.add(capI);
    const pm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e3dcff').multiplyScalar(crt ? 2.2 : 1) }), pg = new THREE.BoxGeometry(0.14, 0.04, 0.3);
    rel.forEach((rp, k) => { const m = new THREE.Mesh(pg, pm); root.add(m); pulses.push({ m, from: P_(0, 0.06, 0), to: rp.clone().setY(yF + 0.06), ph: k / 6, kind: 'conduit' }); });
    for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), pm); root.add(m); pulses.push({ m, from: P_(0, 0.4, 0), to: P_(0, HH + 1, 0), ph: k / 4, kind: 'beam' }); }
    const gA = makeGate(2.2, 5.0, 4.4), gB = makeGate(1.9, 4.4, 9.1); gA.position.copy(P_(-HXW + 0.06, 0.3 + 2.5, 3.5)); gA.rotation.y = PI / 2; gB.position.copy(P_(HXW - 0.06, 0.3 + 2.2, 6.5)); gB.rotation.y = -PI / 2; root.add(gA, gB); gates.push(gA, gB);
    bigArmI = makeArm({ scale: 2.4, L1: 0.62, L2: 0.6, crt, pose: { sh: 0.9, el: -1.5, wr: 0.55 } }); bigArmI.root.position.copy(P_(SB[0], HH - 0.3, SB[1] + 1.3)); bigArmI.root.rotation.y = PI; root.add(bigArmI.root);
    const scrI = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.4), new THREE.MeshBasicMaterial({ map: screenTex(), color: crt ? '#ffffff' : '#bbbbff' })); scrI.position.copy(P_(NC[0] - 0.22, 1.6, NC[1] - 0.32)); scrI.rotation.y = PI / 2; root.add(scrI);
    for (const [i, d] of drips.entries()) { const drop = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshBasicMaterial({ color: crt ? '#d9d0ff' : '#6a5acd' })); const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: crt ? '#9b8cff' : '#6a5acd', transparent: true, depthWrite: false })); ring.position.set(d.x, d.bottom + 0.005, d.z); root.add(drop, ring); dripFxI.push({ ...d, drop, ring, period: 2.6 + i * 0.57 }); }
    TEMPLEI = { TO, P_, yF, HH, HXW, HZW, MX, GY, sx0, NG, gr, NC, SB, HX, HZ, NS, STEP, rise, RR, trapW, z1, tx, gA: P_(-HXW, 2.8, 3.5), gB: P_(HXW, 2.5, 6.5) };
  }

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
    const fromNorth = camera.position.z - controls.target.z < -5;
    const vis = state.showTags && want && (!l.north || fromNorth) && tv.z < 1 && Math.abs(tv.x) < 1.05 && Math.abs(tv.y) < 1.05;
    l.el.style.opacity = vis ? 1 : 0;
    l.el.style.transform = `translate(${(tv.x * 0.5 + 0.5) * w}px, ${(-tv.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
  }
}

// ------------------------------------------------------------------ view
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h, half = (a < 1 ? 38 / a : 34);
  camera.left = -half * a; camera.right = half * a; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
  fpCam.aspect = a; fpCam.updateProjectionMatrix();
  renderer.setSize(w, h, false); composer.setSize(w, h);
  drawRes.set(w, h);
}
camera.position.set(60, 52, 70); controls.target.set(4, -3, 2); camera.zoom = 1.05; camera.updateProjectionMatrix();
if (new URLSearchParams(location.search).get('view') === 'temple') { camera.position.set(-30, 10, -80); controls.target.set(-7, -7, -30); camera.zoom = 3.4; camera.updateProjectionMatrix(); controls.autoRotate = false; }
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

// ------------------------------------------------------------------ first-person walk (test)
// A story walk on rails: you move along a path (scroll, W/S, or Next/Back between stops) and drag to look around.
// Two legs: the lab → trapdoor → passage, then the prairie hatch → spiral stair → the temple.
const EYE = 1.1;                                       // eye height (Nera is about 1.25 tall)
const fpCam = new THREE.PerspectiveCamera(70, 1, 0.03, 500); fpCam.rotation.order = 'YXZ';
const lantern = new THREE.PointLight('#c9b8ff', 0, 9, 1.3); scene.add(lantern);
scene.fog = new THREE.FogExp2('#06040b', 0);
const fp = { open: { ped: 0, bench: 0, shelf: 0 }, on: false, scenes: null, sc: null, s: 0, sT: 0, yawOff: 0, pitchOff: 0, dist: 0, busy: false, trap: 0, hatch: 0 };
const held = {};
const STOPS = {
  archiveOut: { t: 'The Archive', d: 'Aurelia\'s records hall, built and paid for by Nera\'s family. It is open day and night, and Nera works here as an archivist.', a: 'Gone with the rest of the city.' },
  well: { t: 'The well', d: 'You come in through a low entry and the building opens straight up: three galleries, the dome, a shaft of light. In it stands a Storyborn with a book, taller than every floor. What people believe about the Storyborn shapes their power, and this room is built to make them believe big.' },
  booths: { t: 'The booths', d: 'Under the galleries it is warm and low: timber booths, lanterns, string lights. People study here every day, in comfort, under the monument.' },
  bench: { t: 'A bench that opens', d: 'One booth\'s seat lifts. Under it: Voided weapons and power cells. They came in as crates of "acquisitions": the family is famous for buying rare records.' },
  g1: { t: 'The first gallery', d: 'Reading desks and stacks. Most visitors stop here; the stairs further up are roped off.' },
  shelf: { t: 'The false bookcase', d: 'A section of the stacks swings out. Behind it, a rack of the Voided\'s weapons, built into the wall by the family\'s architects.' },
  face: { t: 'Eye to eye', d: 'Only from the top gallery can you look the statue in the face. From the floor you see its feet and its book.' },
  masks: { t: 'The faces', d: 'Giant Storyborn faces ring the clerestory, tilted down at the floor. Wherever you sit, one of them is looking at you.' },
  orrery: { t: 'The orrery', d: 'The Storyborn, shown as heavenly bodies, each turning on its own ring under the dome.' },
  crates: { t: 'Acquisitions', d: 'Crates on the catwalk, stamped as records bought abroad. One stands open, and it isn\'t records.' },
  secret: { t: 'The pedestal', d: 'At the back of the statue\'s pedestal, a stone panel slides down into the floor.' },
  detector: { t: 'The void detector', d: 'The panel\'s frame is a detector, like the arch you walk through at an airport. It is linked to the station: if it reads a Storyborn, or anyone but Nera, her mother, her father (and perhaps Orin), every operation stops.' },
  undercroft: { t: 'The Undercroft', d: 'Nera\'s lab, hidden in the north slope under Aurelia. Raw concrete and void light. Nobody in the city knows it is here.', a: 'After the Calamity: the lab went with the city. Only the deep ground is left.' },
  body: { t: 'The Storyborn on the slab', d: 'A Storyborn\'s body. The words written on its skin still glow. Nera studies it for the Voided.' },
  arm: { t: 'The machine arm', d: 'Her own build, run off the relay. It is working on a specimen: a Storyborn\'s arm, the writing on its skin still lit.' },
  relayPanel: { t: 'Relay and panel', d: 'The relay is a battery: it stores the power a station draws out of the air and converts it to run her machines. The Voided work a station just by touching it. Nera can\'t, so she built this panel to do it for her.' },
  archive: { t: 'Up to the Archive', d: 'The stair climbs to a door under the Archive, the records hall where Nera works as an archivist. It is her cover.' },
  quarters: { t: 'Her quarters', d: 'Where she sleeps: a bed, a table with two chairs, a few books, a small picture on the table.' },
  vault: { t: 'The vault door', d: 'A round door of solid metal, standing open. Behind it, the bunker.' },
  bunker: { t: 'The bunker', d: 'Bunks, water tanks, crates of supplies, a map table and a backup relay. Somewhere to wait things out.' },
  trapdoor: { t: 'The trapdoor', d: 'The way out that nobody else knows. When the Calamity comes, this is how she gets out.' },
  passage: { t: 'The passage', d: 'Dug under the valley. It comes out high in the wall of the temple. A violet strip on the floor shows the way in the dark.' },
  gallery: { t: 'The Temple of the Voided', d: 'Nera\'s greater lab, cut into the bedrock under the prairie: part temple, part laboratory. No windows; the arches are blind niches of void light, and the walls show the layers of earth it was dug through.' },
  relays: { t: 'The relays', d: 'Six batteries ring the station. The station splits the power it draws from the air and sends it down the lines in the floor; each relay stores it and converts it for the Voided\'s machines.' },
  gateW: { t: 'A void gate', d: 'A crack touched by nothing. Through it, somewhere very far away. The Voided cross these to travel vast distances. Nera can too, but it hurts her: she isn\'t true void spawn.' },
  station: { t: 'The station', d: 'It draws power out of the air through its beam, splits it, and sends both power and word: messages travel the same light. The Voided work it by touch; their handprints glow on its faces.', a: 'Nera made it. She waits by the station, safe in the temple.' },
  console: { t: 'Her console', d: 'The Voided only have to lay a hand on the station. Nera has to go through this: a screen and a palm plate, wired into the station\'s base.' },
  bay: { t: 'The surgical bay', d: 'A Storyborn on the table under a ring lamp, a bigger machine arm above it, specimens in the tanks, data stacks along the wall.' },
  gateE: { t: 'Another gate', d: 'A second crack, onto somewhere else.' },
  stair: { t: 'The stair', d: 'A spiral stair up to the hatch, each step edged with void light.' },
  hatch: { t: 'The hatch', d: 'A concrete hatch, half sunk in the prairie grass. Aurelia glows on its bluff. Beside you, the station\'s beam comes up out of the ground.', a: 'Aurelia is gone. Where the city stood there is only smooth black ground.' }
};

function makeScene(id, keys) {
  const curve = new THREE.CatmullRomCurve3(keys.map(k => k.p), false, 'centripetal');
  const n = keys.length - 1, SUB = 40, N = n * SUB, lens = [0];
  let prev = curve.getPoint(0);
  for (let j = 1; j <= N; j++) { const q = curve.getPoint(j / N); lens.push(lens[j - 1] + q.distanceTo(prev)); prev = q; }
  const ks = keys.map((k, i) => {
    let d;
    if (k.look) d = k.look.clone().sub(k.p).normalize();
    else { d = curve.getTangent(i / n).clone(); d.y *= 0.3; d.normalize(); }
    return { ug: 1, ...k, s: lens[i * SUB], yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) };
  });
  for (let i = 1; i < ks.length; i++) { while (ks[i].yaw - ks[i - 1].yaw > PI) ks[i].yaw -= 2 * PI; while (ks[i].yaw - ks[i - 1].yaw < -PI) ks[i].yaw += 2 * PI; }
  return { id, curve, keys: ks, lens, N, n, len: lens[N] };
}
function tOfS(sc, s) {
  let lo = 0, hi = sc.N;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (sc.lens[m] <= s) lo = m; else hi = m; }
  const seg = sc.lens[hi] - sc.lens[lo];
  return (lo + (seg > 0 ? (s - sc.lens[lo]) / seg : 0)) / sc.N;
}
function makeScenes() {
  const { LP, H0, trap, Ft, tunnel } = WALK.lab;
  const { yF, yC, SX, SZ, HX, HZ, NS, STEP, rise, zB, gY, sx0, NG, gr, NC, SB, x0, x1 } = WALK.temple;
  const Le = (u, w, y = EYE) => LP(u, H0 + y, w), E = EYE;
  const A = ARCH, c = A.c, G = l => A.LV[l] + E, dg = x => x * PI / 180;
  const Pa = (d, r, y) => V(c.x + Math.cos(dg(d)) * r, y, c.z + Math.sin(dg(d)) * r), PaR = (a, r, y) => V(c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r);
  const flightKeys = (f, down) => { const fl = A.flights[f], out = []; for (let i = 0; i <= A.NST; i += 4) out.push({ p: PaR(fl.a0 + i * A.S / A.NST, A.rs, fl.y0 + i * A.stepH + E), look: null, ug: 0.35 }); return down ? out.reverse() : out; };
  const outKeys = [
    { p: V(c.x + 8.6, E, c.z + 0.9), look: V(c.x, 6.0, c.z), stop: STOPS.archiveOut, chap: 'Archive', ug: 0 },
    { p: V(c.x + 7.0, E, c.z + 0.8), look: V(c.x, 2.0, c.z), ug: 0 },
    { p: V(c.x + 4.8, 0.3 + E, c.z), look: V(c.x, 1.2, c.z), ug: 0.1 },
    { p: V(c.x + 3.7, 0.3 + E - 0.12, c.z), look: V(c.x, 1.3, c.z), ug: 0.3 }
  ];
  // inside, at full size (the interior is built away from the model; the walk fades in through the door)
  const I = ARCHI, ci = I.c, Gi = l => I.LV[l] + E, ps = I.PS;
  const Pi = (d, r, y) => V(ci.x + Math.cos(dg(d)) * r, y, ci.z + Math.sin(dg(d)) * r), PiR = (a, r, y) => V(ci.x + Math.cos(a) * r, y, ci.z + Math.sin(a) * r);
  const flightI = (f, down) => { const fl = I.flights[f], out = []; for (let i = 0; i <= I.NST; i += 4) out.push({ p: PiR(fl.a0 + i * I.S / I.NST, I.rs, fl.y0 + i * I.stepH + E), look: null, ug: 0.35 }); if (out[out.length - 1].p.y < fl.y0 + I.NST * I.stepH + E - 0.01) out.push({ p: PiR(fl.a0 + I.S, I.rs, fl.y0 + I.NST * I.stepH + E), look: null, ug: 0.35 }); return down ? out.reverse() : out; };
  const RW = 6.65;                                                                 // the walkway round each gallery, between the desks and the stairs
  const inKeys = [
    { p: V(ci.x + I.RI + 2.7, E, ci.z), look: V(ci.x, 4, ci.z), ug: 0.3 },
    { p: V(ci.x + I.RI + 0.4, E, ci.z), look: V(ci.x, 6, ci.z), ug: 0.35 },
    { p: Pi(4, I.WELL + 0.5, E), look: V(ci.x + 0.5, 9.5, ci.z), stop: STOPS.well, ug: 0.35 },
    { p: Pi(345, 5.6, E), look: Pi(318, 10.8, 1.4), stop: STOPS.booths, ug: 0.35 },
    { p: Pi(300, 7.4, E), look: null, opens: 'benchI', ug: 0.35 },
    { p: PiR(I.BB, 8.4, E), look: PiR(I.BB, I.RI - 1.05, 0.45), stop: STOPS.bench, ug: 0.35 },
    { p: Pi(300, 4.7, E), look: null, ug: 0.35 },
    { p: Pi(335, 4.6, E), look: null, ug: 0.35 },
    { p: Pi(0, 4.7, E), look: null, ug: 0.35 },
    { p: Pi(14, 6.8, E), look: null, ug: 0.35 },
    ...flightI(0),
    { p: Pi(116, 7.4, Gi(1)), look: null, ug: 0.35 },
    { p: Pi(129, RW, Gi(1)), look: V(ci.x, 8, ci.z), stop: STOPS.g1, chap: 'Galleries', ug: 0.35 },
    { p: Pi(127, 7.4, Gi(1)), look: null, ug: 0.35 },
    ...flightI(1),
    { p: Pi(226, 7.3, Gi(2)), look: null, ug: 0.35 },
    { p: Pi(222, RW, Gi(2)), look: null, ug: 0.35 },
    { p: Pi(170, RW, Gi(2)), look: null, ug: 0.35 },
    { p: Pi(120, RW, Gi(2)), look: null, ug: 0.35 },
    { p: Pi(75, RW, Gi(2)), look: null, ug: 0.35 },
    { p: Pi(60, 8.2, Gi(2)), look: null, opens: 'shelfI', ug: 0.35 },
    { p: Pi(60, 9.6, Gi(2)), look: PiR(I.NICHE, I.RI + 0.2, I.LV[2] + 1.2), stop: STOPS.shelf, ug: 0.35 },
    { p: Pi(60, RW, Gi(2)), look: null, ug: 0.35 },
    { p: Pi(110, RW, Gi(2)), look: null, ug: 0.35 },
    { p: Pi(170, RW, Gi(2)), look: null, ug: 0.35 },
    { p: Pi(225, RW, Gi(2)), look: null, ug: 0.35 },
    { p: Pi(236, 7.4, Gi(2)), look: null, ug: 0.35 },
    ...flightI(2),
    { p: Pi(336, 7.4, Gi(3)), look: null, ug: 0.35 },
    { p: Pi(342, RW, Gi(3)), look: null, ug: 0.35 },
    { p: Pi(4, I.WELL + 0.5, Gi(3)), look: V(ci.x + 0.3 * ps, (1.46 + 6.38) * ps, ci.z), stop: STOPS.face, ug: 0.35 },
    { p: Pi(22, RW, Gi(3)), look: Pi(45, I.RI - 0.85, I.LV[3] + 3.0), stop: STOPS.masks, ug: 0.35 },
    { p: Pi(358, RW, Gi(3)), look: null, ug: 0.35 },
    { p: Pi(345, 9.0, Gi(3)), look: null, ug: 0.35 },
    { p: Pi(345, I.RI - 0.7, Gi(3)), look: Pi(345, 3, I.TOP + 2), ug: 0.35 },
    { p: Pi(345, I.RI - 0.6, I.TOP + 0.3 + E), look: null, ug: 0.35 },
    { p: Pi(320, I.RI - 0.8, I.TOP + 0.3 + E), look: null, ug: 0.35 },
    { p: Pi(250, I.RI - 0.8, I.TOP + 0.3 + E), look: V(ci.x, I.TOP + 2.6, ci.z), stop: STOPS.orrery, ug: 0.35 },
    { p: Pi(178, I.RI - 0.8, I.TOP + 0.3 + E), look: Pi(156, I.RI - 0.7, I.TOP + 0.6), stop: STOPS.crates, ug: 0.35 },
    { p: Pi(250, I.RI - 0.8, I.TOP + 0.3 + E), look: null, ug: 0.35 },
    { p: Pi(330, I.RI - 0.8, I.TOP + 0.3 + E), look: null, ug: 0.35 },
    { p: Pi(345, I.RI - 0.6, I.TOP + 0.2 + E), look: Pi(345, 4, I.LV[3]), ug: 0.35 },
    { p: Pi(345, I.RI - 0.7, Gi(3)), look: null, ug: 0.35 },
    { p: Pi(345, 9.0, Gi(3)), look: null, ug: 0.35 },
    { p: Pi(338, RW, Gi(3)), look: null, ug: 0.35 },
    { p: Pi(333, 7.4, Gi(3)), look: null, ug: 0.35 },
    ...flightI(2, true),
    { p: Pi(230, 7.7, Gi(2)), look: null, ug: 0.35 },
    ...flightI(1, true),
    { p: Pi(120, 7.7, Gi(1)), look: null, ug: 0.35 },
    ...flightI(0, true),
    { p: Pi(10, 5.2, E), look: null, ug: 0.35 },
    { p: Pi(330, 3.6, E), look: null, ug: 0.35 },
    { p: Pi(292, 3.2, E), look: V(ci.x, 1.2, ci.z - 1.6), stop: STOPS.secret, chap: 'Way down', ug: 0.35 },
    { p: Pi(270, 2.7, E), look: V(ci.x + 0.12 * ps, 0.95 * ps, ci.z - 0.92 * ps), stop: STOPS.detector, opens: 'pedI', ug: 0.4 },
    { p: Pi(270, 1.2, E), look: V(ci.x, 0, ci.z), ug: 0.5 }
  ];
  for (let k = 0; k <= 8; k += 2) { const a = I.PD + 0.25 + k * 0.42; inKeys.push({ p: PiR(a, 0.8, -(k + 1) * 0.36 * ps + E), look: null, ug: 0.75 }); }
  const keys = [];
  for (let k = A.SPN - 6; k < A.SPN; k += 2) { const a = A.PDOOR + 0.25 + k * A.SPA; keys.push({ p: PaR(a, 0.48, A.SPtop - (k + 1) * A.SPrise + E), look: null, ug: 0.85 }); }
  const aEnd = A.PDOOR + 0.25 + (A.SPN - 1) * A.SPA;
  keys.push(
    { p: PaR(aEnd, 0.5, H0 + E), look: null },
    { p: PaR(aEnd + 0.35, 1.35, H0 + E), look: null },
    { p: Le(-2.9, -3.9), look: null },
    { p: Le(-2.8, -2.0), look: null },
    { p: Le(-2.0, -0.5), look: Le(-1.4, -2.8, 0.8), stop: STOPS.undercroft, chap: 'Lab' },
    { p: Le(-1.4, -1.75, E + 0.15), look: Le(-1.4, -2.8, 0.85), stop: STOPS.body },
    { p: Le(0.3, -1.85), look: Le(2.2, -2.7, 0.9) },
    { p: Le(1.6, -1.75, E + 0.1), look: Le(2.1, -2.7, 0.75), stop: STOPS.arm },
    { p: Le(0.55, -3.6), look: null },
    { p: Le(1.0, -4.1), look: Le(1.0, -5.4, 1.0), stop: STOPS.relayPanel },
    { p: Le(0.0, -5.6), look: null },
    { p: Le(-1.3, -6.1), look: Le(-1.3, -8.0, 1.0) },
    { p: Le(-1.3, -6.75), look: null },
    { p: Le(-1.7, -8.0), look: Le(-4.8, -9.6, 0.5), stop: STOPS.quarters, chap: 'Quarters' },
    { p: Le(-0.5, -7.8), look: null },
    { p: Le(0.15, -7.8), look: null },
    { p: Le(1.0, -7.9), look: Le(3.0, -10.6, 1.0) },
    { p: Le(2.6, -8.6), look: Le(3.0, -10.6, 1.0), stop: STOPS.vault, chap: 'Bunker' },
    { p: Le(3.0, -10.1), look: null },
    { p: Le(3.0, -11.3), look: null },
    { p: Le(2.7, -12.2), look: Le(3.2, -13.4, 0.8), stop: STOPS.bunker },
    { p: Le(2.9, -11.2), look: null },
    { p: Le(2.9, -10.0), look: null },
    { p: Le(1.2, -8.0), look: null },
    { p: Le(0.15, -7.75), look: null },
    { p: Le(-0.9, -7.6), look: null },
    { p: Le(-1.3, -6.75), look: null },
    { p: Le(-0.6, -5.4), look: null },
    { p: Le(0.6, -3.7), look: null },
    { p: Le(0.7, -1.6), look: Le(1.2, -0.9, 0) },
    { p: Le(1.2, -0.3), look: Le(1.2, -1.0, 0), stop: STOPS.trapdoor, trap: true },
    { p: Le(1.2, -0.88, E + 0.05), look: Le(1.2, -1.6, -2.2) },
    { p: Le(1.2, -0.9, -0.7), look: Le(1.2, -1.9, -2.6) },
    { p: V(trap.x, Ft + E, trap.z), look: V(trap.x, Ft + E - 0.1, trap.z - 3), chap: 'Passage' }
  );
  const L_ = tunnel.getLength(), nT = Math.max(3, Math.round(L_ / 1.4));
  for (let i = 1; i <= nT; i++) { const q = tunnel.getPointAt(i / nT); keys.push({ p: V(q.x, Ft + E, q.z), look: null, ...(i === Math.round(nT * 0.4) ? { stop: STOPS.passage } : {}) }); }
  const sx = k => sx0 - 0.15 - k * 0.3, stepTop = k => gY - (k + 1) * gr;
  keys.push(
    { p: V(TUN.mouthX, gY + E, zB - 0.6), look: V(SX, yF + 1.6, SZ), stop: STOPS.gallery, chap: 'Temple' },
    { p: V(TUN.mouthX - 0.9, gY + E, zB - 0.5), look: null }
  );
  for (const k of [0, 3, 6, 9, 12, 15]) keys.push({ p: V(sx(k), stepTop(k) + E, zB - 0.48), look: null });
  keys.push(
    { p: V(sx(NG) - 0.4, yF + E, zB - 0.6), look: null },
    { p: V(-10.2, yF + E, -24.45), look: null },
    { p: V(-7.7, yF + E, -24.4), look: V(SX, yF + 1.4, SZ + 3.4), stop: STOPS.relays },
    { p: V(-10.3, yF + E, -25.3), look: V(x0, yF + 2.0, -26.0), stop: STOPS.gateW },
    { p: V(-11.3, yF + E, -27.6), look: V(SX, yF + 2.2, SZ), stop: STOPS.station },
    { p: V(-10.7, yF + E, -29.05), look: V(NC.x - 0.2, yF + 1.3, NC.z - 0.3), stop: STOPS.console },
    { p: V(-10.0, yF + E, -31.35), look: null },
    { p: V(-7.5, yF + E, -31.6), look: null },
    { p: V(-4.5, yF + E, -31.45), look: null },
    { p: V(-1.9, yF + E, -31.55), look: null },
    { p: V(-1.3, yF + E, -30.6), look: V(SB.x, yF + 1.2, SB.z + 0.2), stop: STOPS.bay },
    { p: V(-1.5, yF + E, -27.2), look: null },
    { p: V(-0.9, yF + E, -25.4), look: V(x1, yF + 1.85, -24.6), stop: STOPS.gateE },
    { p: V(-2.0, yF + E, -24.6), look: null },
    { p: V(-6.0, yF + E, -24.55), look: null },
    { p: V(-10.0, yF + E, -24.6), look: null },
    { p: V(-12.0, yF + E, -26.5), look: null },
    { p: V(-12.3, yF + E, -29.2), look: null },
    { p: V(HX + Math.cos((NS - 1) * STEP + 0.3) * 1.4, yF + E, HZ + Math.sin((NS - 1) * STEP + 0.3) * 1.4), look: null }
  );
  const onStair = k => V(HX + Math.cos(k * STEP) * 0.62, yC - (k + 1) * rise + E, HZ + Math.sin(k * STEP) * 0.62);
  for (let k = NS - 1; k >= 0; k -= 2) keys.push({ p: onStair(k), look: k === 17 ? V(SX, yF + 1.5, SZ) : null, ...(k === 17 ? { stop: STOPS.stair } : {}) });
  keys.push(
    { p: onStair(0), look: V(HX, FLOOR + 2, HZ) },
    { p: V(HX - 0.25, FLOOR + 0.6, HZ - 0.1), look: V(HX - 1, FLOOR + 1.5, HZ - 1), ug: 0.6 },
    { p: V(HX - 0.75, FLOOR + E, HZ - 0.55), look: V(0, 2.0, 0), ug: 0.15 },
    { p: V(HX - 1.15, FLOOR + E, HZ - 1.0), look: V(0, 2.0, 0), stop: STOPS.hatch, chap: 'Prairie', ug: 0 }
  );
  // Nera's lab at full size
  const LI = LABI, Ll = LI.L, spA = k => -PI / 2 + 0.25 + 11 * 0.42 + k * 0.42, onSp = (k, r = 0.55) => Ll(LI.SP[0] + Math.cos(spA(k)) * r, LI.HH - (k + 1) * LI.HH / 9 + E, LI.SP[1] + Math.sin(spA(k)) * r);
  const labKeys = [];
  for (let k = 0; k <= 8; k++) labKeys.push({ p: onSp(k, 0.6), look: null, ug: 0.9 });
  labKeys.push(
    { p: Ll(LI.SP[0] + Math.cos(spA(8) + 0.4) * 1.5, E, LI.SP[1] + Math.sin(spA(8) + 0.4) * 1.5), look: null },
    { p: Ll(-6.6, E, 4.2), look: Ll(-3, 0.9, 6), stop: STOPS.undercroft, chap: 'Lab' },
    { p: Ll(-5.0, E, 3.3), look: null },
    { p: Ll(-3.2, E, 3.5), look: null },
    { p: Ll(-3, E + 0.15, 4.7), look: Ll(-3, 0.95, 6), stop: STOPS.body },
    { p: Ll(1.0, E, 4.0), look: null },
    { p: Ll(2.7, E + 0.15, 4.4), look: Ll(4.0, 0.9, 6), stop: STOPS.arm },
    { p: Ll(2.2, E, 7.6), look: null },
    { p: Ll(1.5, E, 9.4), look: Ll(1.5, 1.1, 11.2), stop: STOPS.relayPanel },
    { p: Ll(-1.5, E, 11.2), look: null },
    { p: Ll(-3, E, 12.2), look: null },
    { p: Ll(-3, E, 13.8), look: null },
    { p: Ll(-4.2, E, 15.0), look: Ll(-8.5, 0.5, 19), stop: STOPS.quarters, chap: 'Quarters' },
    { p: Ll(-1.9, E, 16.0), look: null },
    { p: Ll(0.5, E, 16.0), look: null },
    { p: Ll(3, E, 17.4), look: Ll(5, 1.0, 21), stop: STOPS.vault, chap: 'Bunker' },
    { p: Ll(5, E, 20.3), look: null },
    { p: Ll(5, E, 22.2), look: null },
    { p: Ll(4, E, 23.4), look: Ll(5, 0.8, 25.5), stop: STOPS.bunker },
    { p: Ll(4.8, E, 21.6), look: null },
    { p: Ll(4.2, E, 19.0), look: null },
    { p: Ll(0.5, E, 16.1), look: null },
    { p: Ll(-1.9, E, 16.1), look: null },
    { p: Ll(-3, E, 13.6), look: null },
    { p: Ll(-1.6, E, 11.4), look: null },
    { p: Ll(0, E, 8.0), look: null },
    { p: Ll(2.2, E, 3.2), look: null },
    { p: Ll(5.2, E, 3.0), look: null },
    { p: Ll(6.5, E, 0.9), look: Ll(6.5, 0, 2.2), stop: STOPS.trapdoor, opens: 'trapI' },
    { p: Ll(6.5, E + 0.05, 2.1), look: Ll(6.5, -2, 3.2) },
    { p: Ll(6.5, -0.6, 2.2), look: Ll(6.5, -2.5, 3.5) },
    { p: Ll(6.5, -1.5, 2.25), look: Ll(6.5, -2.0, 4.5) }
  );
  // the passage and the temple at full size, straight on from the lab
  const TI = TEMPLEI, Pt = TI.P_, ty = y => y - TI.yF;
  labKeys.push({ p: V(TI.tx, TI.GY + E, TI.trapW.z), look: V(TI.tx, TI.GY + E, TI.trapW.z - 3), chap: 'Passage' });
  { const z0 = TI.trapW.z - 1.6, z1 = TI.z1 + 0.6, n = Math.max(2, Math.round((z0 - z1) / 3)); for (let i = 0; i <= n; i++) labKeys.push({ p: V(TI.tx, TI.GY + E, z0 - (z0 - z1) * i / n), look: null, ...(i === Math.round(n / 2) ? { stop: STOPS.passage } : {}) }); }
  const gy = ty(TI.GY), stepX = k => TI.sx0 - 0.2 - k * 0.4, stepY = k => gy - (k + 1) * TI.gr;
  labKeys.push(
    { p: Pt(TI.MX, gy + E, TI.HZW - 0.9), look: Pt(0, 2.5, 0), stop: STOPS.gallery, chap: 'Temple' },
    { p: Pt(TI.MX - 1.4, gy + E, TI.HZW - 0.7), look: null }
  );
  for (let k = 0; k < 22; k += 2) labKeys.push({ p: Pt(stepX(k), stepY(k) + E, TI.HZW - 0.65), look: null }); labKeys.push({ p: Pt(stepX(21), stepY(21) + E, TI.HZW - 0.65), look: null });
  labKeys.push(
    { p: Pt(stepX(21) - 1.0, E, TI.HZW - 0.7), look: null },
    { p: Pt(-7.9, E, 8.0), look: null },
    { p: Pt(-5.0, E, 8.0), look: null },
    { p: Pt(-2.4, E, 8.3), look: Pt(0, 1.5, 6.6), stop: STOPS.relays },
    { p: Pt(-7.5, E, 8.0), look: null },
    { p: Pt(-11, E, 5.2), look: Pt(-TI.HXW, 2.8, 3.5), stop: STOPS.gateW },
    { p: Pt(-10.2, E, 1.6), look: Pt(0, 3, 0), stop: STOPS.station },
    { p: Pt(-9.4, E, -1.3), look: Pt(TI.NC[0] - 0.22, 1.5, TI.NC[1] - 0.32), stop: STOPS.console },
    { p: Pt(-9.3, E, -3.6), look: null },
    { p: Pt(-5.0, E, -8.0), look: null },
    { p: Pt(0.8, E, -8.0), look: null },
    { p: Pt(7.0, E, -7.4), look: null },
    { p: Pt(9.0, E, -3.2), look: null },
    { p: Pt(8.4, E, -1.2), look: Pt(TI.SB[0], 1.2, TI.SB[1]), stop: STOPS.bay },
    { p: Pt(8.4, E, 3.0), look: null },
    { p: Pt(11.4, E, 5.0), look: Pt(TI.HXW, 2.5, 6.5), stop: STOPS.gateE },
    { p: Pt(8.0, E, 7.6), look: null },
    { p: Pt(0, E, 7.7), look: null },
    { p: Pt(-8.0, E, 7.6), look: null },
    { p: Pt(-12.5, E, 2.0), look: null },
    { p: Pt(-12.4, E, -2.2), look: null },
    { p: Pt(-9.0, E, -3.4), look: null }
  );
  { const a = (TI.NS - 1) * TI.STEP + 0.3; labKeys.push({ p: Pt(TI.HX + Math.cos(a) * 1.7, E, TI.HZ + Math.sin(a) * 1.7), look: null }); }
  for (let k = TI.NS - 1; k >= 0; k -= 1) { const a = k * TI.STEP; labKeys.push({ p: Pt(TI.HX + Math.cos(a) * 0.72, TI.HH - (k + 1) * TI.rise + E, TI.HZ + Math.sin(a) * 0.72), look: k === 17 ? Pt(0, 2, 0) : null, ...(k === 17 ? { stop: STOPS.stair } : {}), ug: 1 }); }
  labKeys.push({ p: Pt(TI.HX + 0.1, TI.HH + 0.3 + E, TI.HZ), look: Pt(TI.HX, TI.HH + 4, TI.HZ - 1), ug: 0.8 });
  const pk = keys.findIndex(k => k.chap === 'Prairie');
  fp.scenes = [makeScene('archiveOut', outKeys), makeScene('archiveIn', inKeys), makeScene('below', labKeys), makeScene('prairie', keys.slice(pk - 1))];
  fp.chapters = [];
  fp.scenes.forEach((sc, si) => sc.keys.forEach((k, ki) => { if (k.chap) fp.chapters.push({ name: k.chap, si, ki }); }));
  const nav = $('fpChap'); nav.innerHTML = '';
  fp.chapters.forEach(c => { const b = document.createElement('button'); b.textContent = c.name; b.onclick = () => jumpTo(c.si, c.ki); nav.appendChild(b); c.el = b; });
}

function poseAt(sc, s) {
  const t = tOfS(sc, s), pos = sc.curve.getPoint(t);
  const i = Math.min(sc.n - 1, Math.floor(t * sc.n)), f = t * sc.n - i, e = f * f * (3 - 2 * f);
  const a = sc.keys[i], b = sc.keys[i + 1];
  return { pos, yaw: a.yaw + (b.yaw - a.yaw) * e, pitch: a.pitch + (b.pitch - a.pitch) * e, ug: a.ug + (b.ug - a.ug) * f };
}
// the site's moving parts (always running, map view included)
function animateSite(dt, time) {
  if (labArm) { labArm.update(time); const b = labArm.root.userData.base; labArm.root.position.z = b.z + Math.sin(time * 0.15) * 0.25; }
  if (bigArm) bigArm.update(time * 0.8 + 2.0, 1.4);
  if (bigArmI) bigArmI.update(time * 0.8 + 3.0, 1.4);
  if (capI) { capI.position.y = capI.userData.y0 + Math.sin(time * 0.6) * 0.08; capI.rotation.y = time * 0.12; }
  for (const d of dripFxI) { const ph = (time + d.ph) % d.period, hgt = d.top - d.bottom, tf = Math.sqrt(2 * hgt / 9.0); d.drop.visible = ph < tf; d.drop.position.set(d.x, d.top - 4.5 * ph * ph, d.z); const kk = (ph - tf) / 1.3; d.ring.visible = kk > 0 && kk < 1; if (d.ring.visible) { d.ring.scale.setScalar(0.03 + kk * 0.6); d.ring.material.opacity = (1 - kk) * 0.8; } }
  if (labArmI) { labArmI.update(time + 1.0); const b = labArmI.root.userData.base; labArmI.root.position.z = b.z + Math.sin(time * 0.15) * 0.4; }
  if (capstone) { capstone.position.y = capstone.userData.y0 + Math.sin(time * 0.6) * 0.06; capstone.rotation.y = time * 0.12; }
  for (const p of pulses) { const k = (time * (p.kind === 'beam' ? 0.22 : 0.4) + p.ph) % 1; p.m.position.lerpVectors(p.from, p.to, k); p.m.scale.setScalar(p.kind === 'beam' ? 0.6 + 0.6 * Math.sin(k * PI) : 1); }
  for (const g of gates) g.userData.gate.uniforms.uT.value = time;
  if (archFxI) { archFxI.rings.forEach(r => { r.rotation.y += dt * r.userData.sp; }); archFxI.scan.position.y = archFxI.y0 + 0.1 + (0.5 + 0.5 * Math.sin(time * 1.6)) * 1.55 * archFxI.ps; archFxI.lamp.material.color.setHSL(Math.sin(time * 2.2) > 0.6 ? 0.72 : 0.37, 0.9, 0.6); }
  if (archFx) { archFx.rings.forEach(r => { r.rotation.y += dt * r.userData.sp; }); archFx.scan.position.y = archFx.y0 + 0.08 + (0.5 + 0.5 * Math.sin(time * 1.6)) * 0.95; archFx.lamp.material.color.setHSL(Math.sin(time * 2.2) > 0.6 ? 0.72 : 0.37, 0.9, 0.6); }
  for (const t of screens) t.offset.y = (t.offset.y - dt * 0.03) % 1;
}
function fade(cb, title = '') {
  fp.busy = true; const el = $('fade'); el.querySelector('b').textContent = title; el.style.opacity = 1;
  setTimeout(() => { cb(); setTimeout(() => { el.style.opacity = 0; fp.busy = false; }, title ? 650 : 120); }, 380);
}
function goTo(si, ki = 0, atEnd = false) {
  const sc = fp.scenes[si]; fp.si = si; fp.sc = sc;
  fp.s = fp.sT = atEnd ? sc.len : sc.keys[ki].s; fp.yawOff = fp.pitchOff = 0;
  fp.trap = passed('trap', 0.3) ? 1 : 0; fp.hatch = 1; for (const f of ['ped', 'bench', 'shelf', 'pedI', 'benchI', 'shelfI']) fp.open[f] = passed(f) ? 1 : 0;
  const tr = $('fpTrack'); tr.querySelectorAll('.tick').forEach(x => x.remove());
  sc.keys.forEach(k => { if (!k.stop) return; const i = document.createElement('i'); i.className = 'tick'; i.style.left = (k.s / sc.len * 100) + '%'; tr.appendChild(i); });
}
const flagAt = f => { for (let i = 0; i < (fp.scenes || []).length; i++) { const k = fp.scenes[i].keys.find(k => k.opens === f || (f === 'trap' && k.trap)); if (k) return [i, k.s]; } return [1e9, 0]; };
const passed = (f, lead = 0.7) => { const [i, s] = flagAt(f); return fp.si > i || (fp.si === i && fp.s > s - lead); };
const trapS = () => 0;
const flagS = f => 0;
function titleFor(si, ki) { const k = fp.scenes[si].keys[ki]; return (k.stop && k.stop.t) || ''; }
function jumpTo(si, ki) { if (fp.busy) return; fade(() => goTo(si, ki), titleFor(si, ki)); }
function enterWalk(si = 0, ki = 0, instant = false) {
  if (fp.busy || fp.on) return;
  if (!fp.scenes) makeScenes();
  const go = () => { fp.on = true; document.body.classList.add('walking'); controls.enabled = false; controls.autoRotate = false; fpGroup.visible = true; goTo(si, ki); $('walkBtn').textContent = 'Leave'; };
  if (instant) return go();
  const k0 = fp.scenes[si].keys[ki], to = k0.ug !== undefined && k0.ug < 0.5 && k0.p.y > -0.5 && k0.p.z > -20 ? { p: V(34, 20, 14), t: V(1.2, 4, -14.4), z: 2.4 } : k0.p.z < -22 ? { p: V(-30, 10, -80), t: V(-6, -7, -28), z: 3.0 } : { p: V(8, 14, -70), t: V(0, -2.4, -20), z: 3.0 };
  const p0 = camera.position.clone(), t0 = controls.target.clone(), z0 = camera.zoom, t0ms = performance.now();
  fp.busy = true;
  const step = () => {
    const k = Math.min(1, (performance.now() - t0ms) / 900), e = k * k * (3 - 2 * k);
    camera.position.lerpVectors(p0, to.p, e); controls.target.lerpVectors(t0, to.t, e); camera.zoom = z0 + (to.z * 1.6 - z0) * e; camera.updateProjectionMatrix();
    if (k < 1) requestAnimationFrame(step); else { fp.busy = false; fade(go, titleFor(si, ki)); }
  };
  requestAnimationFrame(step);
}
function exitWalk() {
  if (!fp.on || fp.busy) return;
  fade(() => {
    fp.on = false; document.body.classList.remove('walking'); controls.enabled = true; fpGroup.visible = false; applyEnv(0);
    for (const k in held) held[k] = false; $('walkBtn').textContent = 'Walk inside';
  });
}
function nextStop() {
  if (!fp.on || fp.busy) return;
  const sc = fp.sc, k = sc.keys.find(k => k.stop && k.s > fp.s + 0.05);
  if (k) fp.sT = k.s;
  else if (fp.s < sc.len - 0.05) fp.sT = sc.len;
  else if (fp.si < fp.scenes.length - 1) fade(() => goTo(fp.si + 1, 0), titleFor(fp.si + 1, 0));
}
function prevStop() {
  if (!fp.on || fp.busy) return;
  const sc = fp.sc, k = [...sc.keys].reverse().find(k => k.stop && k.s < fp.s - 0.05);
  if (k) fp.sT = k.s;
  else if (fp.s > 0.05) fp.sT = 0;
  else if (fp.si > 0) { const p = fp.scenes[fp.si - 1], last = [...p.keys].reverse().find(k => k.stop); fade(() => goTo(fp.si - 1, p.keys.indexOf(last)), last.stop.t); }
}
function applyEnv(ug) {
  const th = THEMES[state.theme], crt = state.theme === 'crt';
  hemi.intensity = th.hemi * (1 - 0.74 * ug); key.intensity = th.keyI * (1 - ug); rimL.intensity = th.rimI * (1 - ug);
  scene.environmentIntensity = th.env * (1 - 0.3 * ug);
  scene.fog.density = fp.on ? 0.006 + ug * 0.07 : 0;
  scene.fog.color.lerpColors(new THREE.Color(crt ? '#140f20' : th.bg), new THREE.Color(crt ? '#06040b' : '#2b2734'), ug);
  lantern.intensity = fp.on ? Math.max(0, ug - 0.5) * 2 * (crt ? 2.4 : 1.6) : 0;
  bloom.strength = th.bloom * (1 + 0.4 * ug);
}

// input: drag to look, scroll or W/S to walk, Space/→ next stop, ← previous, Esc leaves
let drag = null;
canvas.addEventListener('pointerdown', e => { if (!fp.on) return; drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!fp.on || !drag) return;
  fp.yawOff += (e.clientX - drag.x) * 0.0045; fp.pitchOff = THREE.MathUtils.clamp(fp.pitchOff + (e.clientY - drag.y) * 0.0045, -1.3, 1.3);
  drag = { x: e.clientX, y: e.clientY };
});
addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', e => { if (!fp.on || fp.busy) return; e.preventDefault(); fp.sT = THREE.MathUtils.clamp(fp.sT + e.deltaY * 0.003, 0, fp.sc.len); }, { passive: false });
addEventListener('keydown', e => {
  if (!fp.on) return;
  held[e.code] = true;
  if (['Space', 'ArrowRight', 'KeyD'].includes(e.code)) { e.preventDefault(); nextStop(); }
  if (['ArrowLeft', 'KeyA'].includes(e.code)) { e.preventDefault(); prevStop(); }
  if (['ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape') exitWalk();
});
addEventListener('keyup', e => { held[e.code] = false; });
$('walkBtn').addEventListener('click', () => fp.on ? exitWalk() : enterWalk());
$('fpNext').addEventListener('click', nextStop); $('fpPrev').addEventListener('click', prevStop); $('fpExit').addEventListener('click', exitWalk);

function updateWalk(dt, time) {
  // lids: the trapdoor opens as you reach it, the hatch stands open while you're on the temple leg
  const trapWant = fp.on && passed('trap', 0.3) ? 1 : 0, hatchWant = fp.on ? 1 : 0;
  fp.trap += (trapWant - fp.trap) * Math.min(1, dt * 3); fp.hatch += (hatchWant - fp.hatch) * Math.min(1, dt * 3);
  for (const f of ['ped', 'bench', 'shelf', 'pedI', 'benchI', 'shelfI']) { const want = fp.on && passed(f) ? 1 : 0; fp.open[f] = (fp.open[f] || 0) + (want - (fp.open[f] || 0)) * Math.min(1, dt * 2.5); }
  if (archFxI) { archFxI.door.position.y = archFxI.y0 - 1.16 * archFxI.ps * fp.open.pedI; archFxI.lid.rotation.z = -1.15 * fp.open.benchI; archFxI.shelf.rotation.y = archFxI.shelfBase + archFxI.openSign * 1.35 * fp.open.shelfI; }
  if (archFx) { archFx.door.position.y = archFx.y0 - 1.16 * fp.open.ped; archFx.lid.rotation.z = -1.15 * fp.open.bench; archFx.shelf.rotation.y = archFx.shelfBase + archFx.openSign * 1.35 * fp.open.shelf; }
  if (trapLid) trapLid.rotation.x = fp.trap * 1.8;
  fp.open.trapI = (fp.open.trapI || 0) + ((fp.on && passed('trapI', 0.3) ? 1 : 0) - (fp.open.trapI || 0)) * Math.min(1, dt * 3); if (trapLidI) trapLidI.rotation.x = fp.open.trapI * 1.8;
  if (hatchLid) hatchLid.rotation.x = 0.08 + fp.hatch * 2.95;
  if (!fp.on) return;
  const sc = fp.sc;
  const mv = (held.KeyW || held.ArrowUp ? 1 : 0) - (held.KeyS || held.ArrowDown ? 1 : 0);
  if (mv && !fp.busy) fp.sT = THREE.MathUtils.clamp(fp.s + mv * 0.6, 0, sc.len);
  const step = THREE.MathUtils.clamp((fp.sT - fp.s) * (1 - Math.exp(-dt * 3)), -1.9 * dt, 1.9 * dt);
  fp.s += step; fp.dist += Math.abs(step);
  if (Math.abs(step) > 0.002) { const k = Math.exp(-dt * 1.4); fp.yawOff *= k; fp.pitchOff *= k; }
  if (!fp.busy && fp.sT >= sc.len - 1e-3 && fp.s >= sc.len - 0.02 && fp.si < fp.scenes.length - 1) fade(() => goTo(fp.si + 1, 0), titleFor(fp.si + 1, 0));
  const P = poseAt(sc, fp.s);
  fpCam.position.copy(P.pos); fpCam.position.y += Math.sin(fp.dist * 6) * 0.018;
  fpCam.rotation.set(THREE.MathUtils.clamp(P.pitch + fp.pitchOff, -1.4, 1.4), P.yaw + fp.yawOff, 0);
  lantern.position.copy(fpCam.position).add(V(0, 0.15, 0));
  applyEnv(P.ug);
  // the stop card, when you're at a stop
  const near = sc.keys.find(k => k.stop && Math.abs(k.s - fp.s) < 0.35);
  const card = $('fpCard');
  if (near) { const txt = state.after && near.stop.a ? near.stop.a : near.stop.d; if (card.dataset.k !== near.stop.t + state.after) { card.querySelector('h3').textContent = near.stop.t; card.querySelector('p').textContent = txt; card.dataset.k = near.stop.t + state.after; } }
  card.classList.toggle('on', !!near && !fp.busy);
  $('fpFill').style.width = (fp.s / sc.len * 100) + '%';
  const ch = [...fp.chapters].reverse().find(c => c.si < fp.si || (c.si === fp.si && fp.scenes[c.si].keys[c.ki].s <= fp.s + 0.01));
  fp.chapters.forEach(c => c.el.classList.toggle('on', c === ch));
  // dust drifts, water drips
  if (dustPts) {
    const a = dustPts.geometry.attributes.position, b = dustPts.userData.base, ph = dustPts.userData.ph;
    for (let i = 0; i < a.count; i++) a.setXYZ(i, b[i].x + Math.sin(time * 0.21 + ph[i]) * 0.12, b[i].y + Math.sin(time * 0.17 + ph[i] * 1.3) * 0.18, b[i].z + Math.cos(time * 0.19 + ph[i]) * 0.12);
    a.needsUpdate = true;
  }
  for (const d of dripFx) {
    const ph = (time + d.ph) % d.period, h = d.top - d.bottom, tf = Math.sqrt(2 * h / 9.0);
    d.drop.visible = ph < tf; d.drop.position.set(d.x, d.top - 4.5 * ph * ph, d.z);
    const k = (ph - tf) / 1.3; d.ring.visible = k > 0 && k < 1;
    if (d.ring.visible) { d.ring.scale.setScalar(0.03 + k * 0.45); d.ring.material.opacity = (1 - k) * 0.8; }
  }
}
window.__walk = { fp, enterWalk, goTo, makeScenes, scene, poseAt, tOfS };

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  if (state.t !== state.after) state.t += Math.sign(state.after - state.t) * Math.min(Math.abs(state.after - state.t), dt * 0.35);
  const R = state.t * state.t * 48;                      // erasure front, from Orin outward
  ERASE.uR.value = R;
  scar.visible = R > 0.01; if (scarLow) scarLow.visible = R > 0.01; if (labLight) labLight.visible = state.t < 0.3; if (labLight2) labLight2.visible = state.t < 0.3; roomLights.forEach(l => { l.visible = state.t < 0.3; });
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
  animateSite(dt, time);
  updateWalk(dt, time);
  if (!fp.on) controls.update();
  renderPass.camera = fp.on ? fpCam : camera;
  composer.render();
  if (!fp.on) updateLabels();
  requestAnimationFrame(frame);
}
const q = new URLSearchParams(location.search);
if (q.get('after') === '1') { state.after = 1; state.t = 1; [...$('stateSeg').children].forEach(x => x.classList.toggle('on', x.dataset.v === '1')); }
if (q.get('theme') === 'paper') { state.theme = 'paper'; document.body.classList.add('paper'); [...$('themeSeg').children].forEach(x => x.classList.toggle('on', x.dataset.v === 'paper')); }
build(); note();
$('boot').remove();
{ const wk = q.get('walk') || ((location.hash.match(/^#walk-([a-z-]+)/) || [])[1] || '').replace(/-/g, ' '); if (wk) { makeScenes(); const c = fp.chapters.find(c => c.name.toLowerCase() === wk) || fp.chapters[0]; let ki = q.get('at') ? +q.get('at') : c.ki; if (q.get('stop')) ki = fp.scenes[c.si].keys.map((k, i) => k.stop ? i : -1).filter(i => i >= 0)[+q.get('stop')]; enterWalk(c.si, ki, true); } }
frame();
