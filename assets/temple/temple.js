/* Epitaph — Temple of the Voided (three.js, built entirely in code, no model files).
 *
 * One cathedral builder (nave, aisles, flying buttresses, transept, apse with
 * ambulatory, towers, rose windows, lancets) and five variations on top of it:
 *   hollow    the full cathedral: twin west towers, crossing spire
 *   needle    one colossal west tower, tall narrow nave, no transept
 *   sundered  cut by a rift; the east half lifts off and drifts, glowing inside
 *   sunken    half swallowed by the ground and leaning, spires snapped
 *   inverted  on a floating shard of ground, its mirror image hanging beneath
 * A seed varies bays, heights, spires and windows within each variation.
 *
 * Same "illustrated" recipe as the 3D Atlas: orthographic camera, screen-space
 * ink outlines (inverted hull), hemisphere + key light, soft shadows.
 * Signal palette adds bloom so the violet glass glows.
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
const isSmall = () => Math.min(innerWidth, innerHeight) < 640;

// ------------------------------------------------------------------ palettes
const THEMES = {
  crt: {
    bg: '#08070b', stone: '#1c1a21', trim: '#2b2731', roof: '#0f0d12', dark: '#030204', earth: '#0c0a0e',
    glow: '#9b8cff', glowBoost: 2.4, ink: '#000000', voidCore: '#000000',
    hemiSky: '#5a5280', hemiGround: '#060504', hemi: 0.45, key: '#cfc6ff', keyI: 1.5,
    rim: '#7b6cff', rimI: 1.4, under: '#6a5acd', underI: 0.4,
    env: 0.12, shadowOpacity: 0.7, outlinePx: 1.3, bloom: 0.75, additive: true
  },
  paper: {
    bg: '#f6eddd', stone: '#4a4553', trim: '#625c6c', roof: '#272330', dark: '#16131c', earth: '#b4a78f',
    glow: '#6a5acd', glowBoost: 1, ink: '#141a2c', voidCore: '#141a2c',
    hemiSky: '#fffaf3', hemiGround: '#c2ae90', hemi: 1.1, key: '#fff6ea', keyI: 2.2,
    rim: '#ffffff', rimI: 0.3, under: '#c2ae90', underI: 0.3,
    env: 0.45, shadowOpacity: 0.3, outlinePx: 1.6, bloom: 0, additive: false
  }
};

const VARIANTS = [
  { id: 'hollow', name: 'Hollow Nave', desc: 'The full cathedral: twin west towers, flying buttresses, a transept with rose windows and a spire over the crossing.' },
  { id: 'needle', name: 'Needle', desc: 'One colossal west tower over a tall, narrow nave. No transept; everything points up.' },
  { id: 'sundered', name: 'Sundered', desc: 'Cut through by a rift. The east half has torn free and drifts above, glowing from inside.' },
  { id: 'sunken', name: 'Sunken', desc: 'Half swallowed by the ground and leaning. The spires have snapped; the glass still burns.' },
  { id: 'inverted', name: 'Inverted', desc: 'Raised on a floating shard of ground, with its mirror image hanging upside down beneath it.' }
];

// ------------------------------------------------------------------ helpers
const rng = seed => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Place a geometry: local rotation order Z, X, then Y (yaw last).
function xf(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  geo.applyMatrix4(new THREE.Matrix4().compose(V(x, y, z), q, V(1, 1, 1)));
  return geo;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const cone = (r, h, seg) => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0);

function lancet(w, h) {           // pointed (equilateral) gothic arch, base at y=0, facing +z
  const sy = Math.max(0.01, h - w * 0.866), s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(-w / 2, sy);
  s.absarc(w / 2, sy, w, PI, PI * 2 / 3, true);
  s.absarc(-w / 2, sy, w, PI / 3, 0, true);
  s.lineTo(w / 2, 0); s.closePath();
  return s;
}
const lancetSlab = (w, h, d) => new THREE.ExtrudeGeometry(lancet(w, h), { depth: d, bevelEnabled: false, curveSegments: 6 });

function gable(len, w, h) {       // triangular prism, length along z
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2);
}
function leanTo(w, h, len) {      // right-triangle prism: high side at u=0, slopes down along +u
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(w, 0); s.lineTo(0, h); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2);
}
function flyer(span, y1, y2) {    // flying buttress arm, wall at u=0 (height y1) to pier at u=span (y2); u runs along +z
  const s = new THREE.Shape();
  s.moveTo(0, y1 + 0.3); s.lineTo(span, y2 + 0.35); s.lineTo(span, y2 - 0.3);
  s.quadraticCurveTo(span * 0.12, y2 - 0.3, 0, y1 - 1.1); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -0.12); g.rotateY(-PI / 2);
  return g;
}
// Displace vertices by a hash of their position, so shared corners move together (stays watertight).
function jitter(geo, amt, seed) {
  const p = geo.attributes.position;
  const h = (a, b, c, k) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + k * 19.3 + seed) * 43758.5453; return s - Math.floor(s) - 0.5; };
  for (let i = 0; i < p.count; i++) {
    const x = +p.getX(i).toFixed(3), y = +p.getY(i).toFixed(3), z = +p.getZ(i).toFixed(3);
    p.setXYZ(i, x + h(x, y, z, 1) * amt, y + h(x, y, z, 2) * amt, z + h(x, y, z, 3) * amt);
  }
  geo.computeVertexNormals();
  return geo;
}

class Kit {
  constructor() { this.b = { stone: [], trim: [], roof: [], dark: [], earth: [], glow: [] }; }
  add(kind, g) {
    if (g.index) g = g.toNonIndexed();
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.clearGroups();
    this.b[kind].push(g);
  }
  merge() {
    const out = {};
    for (const [k, list] of Object.entries(this.b)) if (list.length) out[k] = mergeGeometries(list, false);
    return out;
  }
}

// ------------------------------------------------------------------ cathedral parts
function addWindow(kit, { x, y, z, ry, w, h, frame = true }) {
  const F = { x, y, z, ry }, off = frame ? 0.15 : 0.03;
  if (frame) kit.add('trim', xf(lancetSlab(w + 0.3, h + 0.25, 0.14), { x, y: y - 0.12, z, ry }));
  kit.add('glow', xf(new THREE.ShapeGeometry(lancet(w, h), 6).translate(0, 0, off), F));
  if (frame && w > 0.5) kit.add('trim', xf(box(0.07, h * 0.8, 0.05).translate(0, 0, off + 0.01), F));
}
function addRose(kit, { x, y, z, ry, r }) {
  const F = { x, y, z, ry };
  kit.add('trim', xf(new THREE.CylinderGeometry(r + 0.28, r + 0.28, 0.16, 24).rotateX(PI / 2).translate(0, 0, 0.08), F));
  kit.add('glow', xf(new THREE.CircleGeometry(r, 32).translate(0, 0, 0.17), F));
  kit.add('trim', xf(new THREE.TorusGeometry(r * 0.5, 0.06, 6, 24).translate(0, 0, 0.19), F));
  kit.add('trim', xf(new THREE.TorusGeometry(r, 0.08, 6, 32).translate(0, 0, 0.19), F));
  for (let k = 0; k < 6; k++) kit.add('trim', xf(box(0.07, r * 2, 0.05).translate(0, -r, 0.19).rotateZ(k * PI / 6), F));
}
function pinnacle(kit, x, y, z, s = 1) {
  kit.add('trim', xf(box(0.34 * s, 0.6 * s, 0.34 * s), { x, y, z }));
  kit.add('roof', xf(cone(0.3 * s, 1.3 * s, 4), { x, y: y + 0.6 * s, z, ry: PI / 4 }));
}
function finial(kit, x, y, z, s = 1) {
  kit.add('glow', xf(new THREE.OctahedronGeometry(0.22 * s), { x, y: y + 0.2 * s, z }));
}
function turret(kit, x, z, h) {
  kit.add('stone', xf(new THREE.CylinderGeometry(0.42, 0.46, h, 8).translate(0, h / 2, 0), { x, z }));
  kit.add('roof', xf(cone(0.52, 1.9, 8), { x, y: h, z }));
  finial(kit, x, h + 1.9, z, 0.7);
}

function tower(kit, x, z, T, skipWest) {
  const { w, h } = T, hb = h * 0.58, w2 = w * 0.84;
  kit.add('stone', xf(box(w, hb, w), { x, z }));
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    kit.add('stone', xf(box(0.6, hb + 0.6, 0.6), { x: x + a * w / 2, z: z + b * w / 2 }));
    pinnacle(kit, x + a * w / 2, hb + 0.6, z + b * w / 2, 0.9);
  }
  kit.add('trim', xf(box(w + 0.3, 0.3, w + 0.3), { x, y: hb, z }));
  kit.add('stone', xf(box(w2, h - hb, w2), { x, y: hb, z }));
  for (let f = 0; f < 4; f++) {
    const ry = f * PI / 2, nx = Math.sin(ry), nz = Math.cos(ry), tx = Math.cos(ry), tz = -Math.sin(ry);
    for (const o of [-1, 1]) {
      addWindow(kit, { x: x + nx * w2 / 2 + tx * o * w2 * 0.2, y: hb + (h - hb) * 0.22, z: z + nz * w2 / 2 + tz * o * w2 * 0.2,
        ry, w: w2 * 0.22, h: (h - hb) * 0.55 });
    }
    if (!(skipWest && f === 3)) addWindow(kit, { x: x + nx * w / 2, y: hb * 0.5, z: z + nz * w / 2, ry, w: 0.6, h: hb * 0.28 });
  }
  kit.add('trim', xf(box(w2 + 0.3, 0.45, w2 + 0.3), { x, y: h, z }));
  for (const a of [-1, 1]) for (const b of [-1, 1]) pinnacle(kit, x + a * w2 / 2, h + 0.45, z + b * w2 / 2, 1.1);
  const r = w2 * 0.6, sy = h + 0.45;
  if (T.broken) {
    const sh = T.spire * 0.3;
    kit.add('stone', xf(new THREE.CylinderGeometry(r * 0.5, r, sh, 8).translate(0, sh / 2, 0), { x, y: sy, z, ry: PI / 8 }));
    kit.add('glow', xf(new THREE.CylinderGeometry(r * 0.44, r * 0.44, 0.06, 8), { x, y: sy + sh + 0.01, z, ry: PI / 8 }));
    return V(x, sy + sh, z);
  }
  kit.add('roof', xf(cone(r, T.spire, 8), { x, y: sy, z, ry: PI / 8 }));
  kit.add('trim', xf(new THREE.CylinderGeometry(r * 0.72, r * 0.76, 0.22, 8), { x, y: sy + T.spire * 0.26, z, ry: PI / 8 }));
  finial(kit, x, sy + T.spire, z, 1.2);
  return V(x, sy + T.spire, z);
}

function portal(kit, { x, z, ry, s = 1 }) {
  const F = { x, z, ry };
  kit.add('trim', xf(lancetSlab(2.8 * s, 4.8 * s, 0.3), F));
  kit.add('trim', xf(lancetSlab(2.3 * s, 4.4 * s, 0.4), F));
  kit.add('dark', xf(lancetSlab(1.8 * s, 3.9 * s, 0.46), F));
  kit.add('glow', xf(new THREE.PlaneGeometry(0.07 * s, 2.9 * s).translate(0, 1.45 * s, 0.47), F));
}

function buildCathedral(p, kit) {
  const { bays, bayLen, naveW, naveH, aisleW, aisleH } = p;
  const L = bays * bayLen, x0 = -L / 2, x1 = L / 2, hw = naveW / 2, ao = hw + aisleW;
  const roofH = naveW * 0.78, tw = naveW * 0.92;
  const T = p.towers, twin = T && T.kind === 'twin';
  const info = { x0, x1, L, hw, ao, roofH, naveH, tips: [], cx: null };
  let cx = null;
  if (p.transept) {
    const ti = Math.min(bays - 2, Math.max(2, Math.round(p.transept.at * bays)));
    cx = x0 + (ti + 0.5) * bayLen; info.cx = cx;
  }
  const towerEnd = twin ? x0 + T.w - 0.3 : x0;
  const free = (x, m = 0.5) => !(cx !== null && Math.abs(x - cx) < tw / 2 + m) && x > towerEnd + 0.3;

  // nave
  kit.add('stone', box(L, naveH, naveW));
  kit.add('roof', xf(gable(L + 0.5, naveW + 0.6, roofH), { y: naveH, ry: PI / 2 }));
  kit.add('trim', xf(box(L + 0.2, 0.3, naveW + 0.3), { y: naveH - 0.3 }));
  kit.add('trim', xf(box(L + 0.3, 0.18, 0.18), { y: naveH + roofH - 0.04 }));

  const aRoofH = 1.6, cy0 = aisleH + 2.0, ch = naveH - 0.7 - cy0;
  const pierTop = aisleH + 2.4, y1 = naveH * 0.8, y2 = pierTop - 0.5;
  for (const s of [1, -1]) {
    const ry = s > 0 ? 0 : PI;
    kit.add('stone', xf(box(L, aisleH, aisleW), { z: s * (hw + aisleW / 2) }));
    kit.add('roof', xf(leanTo(aisleW + 0.35, aRoofH, L + 0.2), { y: aisleH, z: s * hw, ry: s > 0 ? -PI / 2 : PI / 2 }));
    for (let i = 0; i < bays; i++) {
      const xc = x0 + (i + 0.5) * bayLen;
      if (!free(xc)) continue;
      addWindow(kit, { x: xc, y: cy0, z: s * hw, ry, w: p.winW, h: ch });
      addWindow(kit, { x: xc, y: 1.1, z: s * ao, ry, w: p.winW * 0.85, h: aisleH - 2.0 });
    }
    for (let i = 1; i <= bays; i++) {
      const bx = x0 + i * bayLen;
      if (!free(bx, 0.2)) continue;
      kit.add('stone', xf(box(0.6, pierTop, 0.9), { x: bx, z: s * (ao + 0.45) }));
      kit.add('stone', xf(box(0.75, pierTop * 0.45, 1.2), { x: bx, z: s * (ao + 0.55) }));
      pinnacle(kit, bx, pierTop, s * (ao + 0.45), 1);
      kit.add('stone', xf(flyer(aisleW + 0.25, y1, y2), { x: bx, z: s * hw, ry }));
    }
  }

  // transept + crossing
  if (cx !== null) {
    const arm = p.transept.arm, half = hw + arm;
    kit.add('stone', xf(box(tw, naveH, half * 2), { x: cx }));
    kit.add('roof', xf(gable(half * 2 + 0.5, tw + 0.6, roofH * 0.95), { x: cx, y: naveH }));
    kit.add('trim', xf(box(tw + 0.3, 0.3, half * 2 + 0.2), { x: cx, y: naveH - 0.3 }));
    for (const s of [1, -1]) {
      const zf = s * half, ry = s > 0 ? 0 : PI;
      addRose(kit, { x: cx, y: naveH * 0.64, z: zf, ry, r: tw * 0.3 });
      for (const t of [-1, 1]) {
        addWindow(kit, { x: cx + t * tw * 0.22, y: 1.2, z: zf, ry, w: 0.55, h: naveH * 0.36 });
        turret(kit, cx + t * tw / 2, zf, naveH + 0.8);
        if (arm > aisleW + 1.2) addWindow(kit, { x: cx + t * tw / 2, y: 1.4, z: s * (ao + (arm - aisleW) / 2), ry: t > 0 ? PI / 2 : -PI / 2, w: 0.7, h: naveH * 0.45 });
      }
      finial(kit, cx, naveH + roofH * 0.95, zf + s * 0.25, 1);
    }
    if (p.crossing) {
      const by = naveH + roofH * 0.55, lh = 2.6;
      kit.add('stone', xf(new THREE.CylinderGeometry(1.0, 1.15, lh, 8).translate(0, lh / 2, 0), { x: cx, y: by, ry: PI / 8 }));
      for (let k = 0; k < 8; k++) {
        const a = k * PI / 4;
        addWindow(kit, { x: cx + Math.sin(a) * 1.0, y: by + 0.5, z: Math.cos(a) * 1.0, ry: a, w: 0.36, h: 1.4, frame: false });
      }
      const top = by + lh;
      kit.add('trim', xf(new THREE.CylinderGeometry(1.3, 1.3, 0.25, 8), { x: cx, y: top, ry: PI / 8 }));
      if (p.crossing.broken) {
        kit.add('stone', xf(new THREE.CylinderGeometry(0.55, 1.1, 1.4, 8).translate(0, 0.7, 0), { x: cx, y: top, ry: PI / 8 }));
        info.tips.push(V(cx, top + 1.4, 0));
      } else {
        kit.add('roof', xf(cone(1.2, p.crossing.h, 8), { x: cx, y: top, ry: PI / 8 }));
        finial(kit, cx, top + p.crossing.h, 0, 1.1);
        info.tips.push(V(cx, top + p.crossing.h, 0));
      }
    }
  }

  // apse with ambulatory
  if (p.apse) {
    const seg = 7, r = hw;
    kit.add('stone', xf(new THREE.CylinderGeometry(r, r, naveH, seg, 1, false, 0, PI).translate(0, naveH / 2, 0), { x: x1 }));
    kit.add('roof', xf(new THREE.ConeGeometry(r + 0.3, roofH, seg, 1, false, 0, PI).translate(0, roofH / 2, 0), { x: x1, y: naveH }));
    kit.add('stone', xf(new THREE.CylinderGeometry(ao, ao, aisleH, seg, 1, false, 0, PI).translate(0, aisleH / 2, 0), { x: x1 }));
    kit.add('roof', xf(new THREE.ConeGeometry(ao + 0.3, 1.8, seg, 1, false, 0, PI).translate(0, 0.9, 0), { x: x1, y: aisleH }));
    const d = r * Math.cos(PI / 14), da = ao * Math.cos(PI / 14);
    for (let k = 0; k < seg; k++) {
      const a = (k + 0.5) * PI / seg;
      addWindow(kit, { x: x1 + Math.sin(a) * d, y: aisleH + 1.9, z: Math.cos(a) * d, ry: a, w: 0.55, h: naveH - aisleH - 2.6 });
      addWindow(kit, { x: x1 + Math.sin(a) * da, y: 1.1, z: Math.cos(a) * da, ry: a, w: 0.6, h: aisleH - 2.0 });
    }
    for (let k = 1; k < seg; k++) {
      const a = k * PI / seg, sa = Math.sin(a), ca = Math.cos(a);
      kit.add('stone', xf(box(0.6, pierTop, 0.9), { x: x1 + sa * (ao + 0.45), z: ca * (ao + 0.45), ry: a }));
      pinnacle(kit, x1 + sa * (ao + 0.45), pierTop, ca * (ao + 0.45), 1);
      kit.add('stone', xf(flyer(aisleW + 0.25, y1, y2), { x: x1 + sa * r, z: ca * r, ry: a }));
    }
  }

  // west front
  let xmin = x0 - 0.6, zmax = ao + 0.9;
  if (twin) {
    const fx = x0 - 0.45;
    kit.add('stone', xf(box(0.6, naveH + 0.2, naveW + 0.2), { x: x0 - 0.15 }));
    const gs = new THREE.Shape(); gs.moveTo(-hw - 0.1, 0); gs.lineTo(hw + 0.1, 0); gs.lineTo(0, roofH + 0.35); gs.closePath();
    kit.add('stone', xf(new THREE.ExtrudeGeometry(gs, { depth: 0.6, bevelEnabled: false }), { x: fx, y: naveH + 0.2, ry: PI / 2 }));
    finial(kit, x0 - 0.15, naveH + roofH + 0.55, 0, 1.2);
    portal(kit, { x: fx, z: 0, ry: -PI / 2 });
    const rr = Math.min(naveW * 0.32, (naveH - 5.6) / 2.4);
    addRose(kit, { x: fx, y: 5.4 + rr + 0.25, z: 0, ry: -PI / 2, r: rr });
    const tx = x0 + T.w / 2 - 0.3;
    for (const s of [1, -1]) {
      const tz = s * (hw - 0.3 + T.w / 2);
      info.tips.push(tower(kit, tx, tz, T, true));
      portal(kit, { x: tx - T.w / 2, z: tz, ry: -PI / 2, s: 0.62 });
    }
    xmin = x0 - 0.9; zmax = Math.max(zmax, hw - 0.3 + T.w + 0.4);
  } else if (T) {
    const tx = x0 - T.w / 2 + 0.3, fx = tx - T.w / 2;
    info.tips.push(tower(kit, tx, 0, T, true));
    portal(kit, { x: fx, z: 0, ry: -PI / 2, s: 1.05 });
    const hb = T.h * 0.58, rr = Math.min(T.w * 0.3, 1.6);
    addRose(kit, { x: fx, y: Math.max(5.9 + rr, hb * 0.62), z: 0, ry: -PI / 2, r: rr });
    for (const s of [1, -1]) portal(kit, { x: x0, z: s * (hw + aisleW / 2), ry: -PI / 2, s: 0.5 });
    xmin = fx - 0.8;
  }
  if (cx !== null) zmax = Math.max(zmax, hw + p.transept.arm + 0.7);
  info.xmin = xmin; info.xmax = x1 + (p.apse ? ao + 1.1 : 0.6); info.zmax = zmax;
  info.maxH = Math.max(naveH + roofH, ...info.tips.map(t => t.y));
  return info;
}

function addPlinth(kit, info, PL) {
  const cx = (info.xmin + info.xmax) / 2, w = info.xmax - info.xmin, d = info.zmax * 2;
  for (let k = 0; k < 3; k++) {
    const m = 1.8 - k * 0.55;
    kit.add('stone', xf(box(w + m * 2, PL / 3, d + m * 2), { x: cx, y: -PL + k * PL / 3 }));
  }
  kit.add('stone', xf(box(2.2, PL, 3.2), { x: info.xmin - 2.2, y: -PL }));
}

// ------------------------------------------------------------------ materials + outlines
function outlineMaterial(color, px, planes) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPx: { value: px }, uRes: { value: drawRes } },
    vertexShader: `
      #include <clipping_planes_pars_vertex>
      uniform float uPx; uniform vec2 uRes;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 wn = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * wp;
        vec4 c0 = projectionMatrix * mvPosition;
        vec4 c1 = projectionMatrix * viewMatrix * vec4(wp.xyz + wn * 0.05, 1.0);
        vec2 d = c1.xy / c1.w - c0.xy / c0.w;
        float l = length(d);
        if (l > 1e-6) c0.xy += (d / l) * uPx * 2.0 / uRes * c0.w;
        c0.z += 0.0004 * c0.w;
        gl_Position = c0;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: `
      #include <clipping_planes_pars_fragment>
      uniform vec3 uColor;
      void main(){
        #include <clipping_planes_fragment>
        gl_FragColor = vec4(uColor, 1.0);
      }`,
    side: THREE.BackSide, clipping: !!planes, clippingPlanes: planes || null
  });
}
function hullOf(geo) {
  if (geo.userData.hull) return geo.userData.hull;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.getAttribute('position').clone());
  const m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  return (geo.userData.hull = m);
}
function withOutline(mesh, theme, planes) {
  const o = new THREE.Mesh(hullOf(mesh.geometry), outlineMaterial(theme.ink, theme.outlinePx, planes));
  o.raycast = () => {};
  mesh.add(o);
  return mesh;
}
const glowColor = th => new THREE.Color(th.glow).multiplyScalar(th.glowBoost);
function makeMats(th, planes) {
  const std = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0.06, flatShading: true,
    envMapIntensity: th.env, clippingPlanes: planes || null, ...extra });
  return {
    stone: std(th.stone), trim: std(th.trim), roof: std(th.roof, { roughness: 0.55, metalness: 0.3 }),
    dark: std(th.dark), earth: std(th.earth, { roughness: 1 }),
    glow: new THREE.MeshBasicMaterial({ color: glowColor(th), clippingPlanes: planes || null, side: THREE.DoubleSide })
  };
}
function meshesFrom(geos, th, planes, backGlow) {
  const mats = makeMats(th, planes), g = new THREE.Group();
  for (const [k, geo] of Object.entries(geos)) {
    const m = new THREE.Mesh(geo, mats[k]);
    if (k !== 'glow') { m.castShadow = m.receiveShadow = true; withOutline(m, th, planes); }
    g.add(m);
  }
  if (backGlow) {
    const bm = new THREE.MeshBasicMaterial({ color: glowColor(th).multiplyScalar(0.42), side: THREE.BackSide, clippingPlanes: planes });
    for (const k of ['stone', 'trim', 'roof', 'dark']) if (geos[k]) g.add(new THREE.Mesh(geos[k], bm));
  }
  return g;
}
function rockGeo(r, seed, sx = 1, sy = 1, sz = 1) {
  return jitter(new THREE.IcosahedronGeometry(r, 0).scale(sx, sy, sz), r * 0.45, seed);
}

// ------------------------------------------------------------------ engine
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
const drawRes = new THREE.Vector2(1, 1);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 800);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.screenSpacePanning = true; controls.minZoom = 0.4; controls.maxZoom = 6;
controls.autoRotateSpeed = 0.5;

const hemi = new THREE.HemisphereLight('#fff', '#000', 1);
const key = new THREE.DirectionalLight('#fff', 2);
key.castShadow = true;
key.shadow.mapSize.set(isSmall() ? 2048 : 4096, isSmall() ? 2048 : 4096);
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
const rim = new THREE.DirectionalLight('#fff', 1);
const under = new THREE.DirectionalLight('#fff', 0.5);
scene.add(hemi, key, key.target, rim, under);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.4, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const state = { variant: 'hollow', theme: 'crt', seed: 1, spin: !reduceMotion, R: 30, lastInteract: 0 };
let root = null, anim = null;

function disposeTree(o) {
  const seen = new Set();
  o.traverse(n => {
    if (n.geometry && !seen.has(n.geometry)) { seen.add(n.geometry); n.geometry.dispose(); n.geometry.userData.hull?.dispose(); }
    const ms = Array.isArray(n.material) ? n.material : n.material ? [n.material] : [];
    for (const m of ms) if (!seen.has(m)) { seen.add(m); m.dispose(); }
  });
}

function applyTheme(th) {
  scene.background = new THREE.Color(th.bg);
  hemi.color.set(th.hemiSky); hemi.groundColor.set(th.hemiGround); hemi.intensity = th.hemi;
  key.color.set(th.key); key.intensity = th.keyI;
  rim.color.set(th.rim); rim.intensity = th.rimI;
  under.color.set(th.under); under.intensity = th.underI;
  bloom.enabled = th.bloom > 0; bloom.strength = th.bloom;
  document.documentElement.dataset.theme = state.theme === 'paper' ? 'paper' : 'crt';
}

function makeOrb(th, r) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshBasicMaterial({ color: th.voidCore })));
  const rimMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(th.glow).multiplyScalar(th.additive ? 2.2 : 1) }, uT: { value: 0 } },
    vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uT; varying vec3 vN;
      void main(){ float f = pow(1.0 - abs(vN.z), 2.2); gl_FragColor = vec4(uColor * (1.2 + 0.4 * sin(uT * 1.7)), f); }`,
    transparent: true, depthWrite: false, blending: th.additive ? THREE.AdditiveBlending : THREE.NormalBlending
  });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r * 1.22, 48, 32), rimMat));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.8, r * 0.025, 6, 120), new THREE.MeshBasicMaterial({ color: glowColor(th) }));
  ring.rotation.set(1.25, 0, 0.3);
  g.add(ring);
  g.userData = { rimMat, ring };
  return g;
}

function addFragment(parent, th, mats, pos, size, seed) {
  const m = new THREE.Mesh(rockGeo(size, seed, 1, 0.8 + (seed % 5) * 0.12, 1), mats.stone);
  m.castShadow = true;
  withOutline(m, th);
  m.position.copy(pos);
  m.rotation.set(seed * 1.3, seed * 0.7, seed * 2.1);
  parent.add(m);
  anim.frags.push({ m, y: pos.y, ph: seed * 0.9, sp: 0.4 + (seed % 7) * 0.08, amp: 0.15 + (seed % 3) * 0.1, rs: ((seed % 2) ? 1 : -1) * (0.1 + (seed % 4) * 0.05) });
}

function rebuild(refit) {
  if (root) { scene.remove(root); disposeTree(root); }
  const th = THEMES[state.theme];
  const vi = VARIANTS.findIndex(v => v.id === state.variant);
  const r = rng(state.seed * 7919 + vi * 104729 + 17);
  const p = makeParams(state.variant, r);
  root = new THREE.Group(); scene.add(root);
  anim = { frags: [], B: null, orb: null, pts: null };
  applyTheme(th);

  const PL = 1.05, kit = new Kit();
  const info = buildCathedral(p, kit);
  const grounded = !p.sink && !p.inverted;
  if (grounded) addPlinth(kit, info, PL);
  const geos = kit.merge();
  const fragMats = makeMats(th);
  const xc = (info.xmin + info.xmax) / 2;
  let orbPos;

  if (p.split) {
    const sx = info.x0 + p.split.at * info.L;
    const local = new THREE.Plane().setFromNormalAndCoplanarPoint(V(-1, 0.3, 0.22).normalize(), V(sx, p.naveH * 0.5, 0));
    const planeA = new THREE.Plane();
    const A = meshesFrom(geos, th, [planeA], true);
    A.position.y = PL; root.add(A); A.updateMatrixWorld(true);
    planeA.copy(local).applyMatrix4(A.matrixWorld);

    const planeB = new THREE.Plane();
    const inner = meshesFrom(geos, th, [planeB], true);
    inner.position.x = -sx;
    const rk = new Kit();
    const rx = (info.xmax - sx) / 2 + 0.6;
    rk.add('earth', xf(jitter(new THREE.ConeGeometry(1, 1, 9, 3).scale(rx, 5, info.zmax * 0.95).rotateX(PI), 0.5, state.seed), { x: (sx + info.xmax) / 2 + 0.3, y: -PL - 2.5 }));
    inner.add(meshesFrom(rk.merge(), th));
    const pivot = new THREE.Group(); pivot.add(inner);
    pivot.position.set(sx + p.split.drift, PL + p.split.lift, 0);
    pivot.rotation.z = -p.split.tilt;
    root.add(pivot);
    anim.B = { pivot, inner, local: local.clone().negate(), plane: planeB, y: pivot.position.y, rz: pivot.rotation.z };
    pivot.updateMatrixWorld(true); planeB.copy(anim.B.local).applyMatrix4(inner.matrixWorld);

    for (let i = 0; i < 18; i++) {
      const pos = V(sx - 1 + r() * (p.split.drift + 2.5), PL + 0.5 + r() * (p.split.lift + p.naveH * 0.9), (r() - 0.5) * info.ao * 2.2);
      addFragment(root, th, fragMats, pos, 0.25 + r() * 0.7, i + 1 + state.seed);
    }
    orbPos = V(sx + p.split.drift * 0.5, PL + info.maxH * 0.62 + p.split.lift, 0);
  } else if (p.sink) {
    const g = meshesFrom(geos, th);
    const w = new THREE.Group(); w.add(g);
    w.rotation.set(p.sink.tilt, 0, p.sink.roll); w.position.y = -p.sink.depth;
    root.add(w); w.updateMatrixWorld(true);
    const ek = new Kit();
    const ex = (info.xmax - info.xmin) / 2, ez = info.zmax;
    const field = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: th.earth, roughness: 1, envMapIntensity: th.env }));
    field.rotation.x = -PI / 2; field.position.y = 0.02; field.receiveShadow = true; field.userData.noFit = true;
    root.add(field);
    ek.add('earth', xf(jitter(new THREE.CylinderGeometry(1, 1.25, 0.6, 40, 1).scale(ex + 3, 1, ez + 3), 0.2, 3), { x: xc, y: -0.25 }));
    for (let i = 0; i < 110; i++) {
      const a = r() * PI * 2, t = 0.75 + r() * 0.6;
      const s = 0.25 + r() * 0.9;
      ek.add('earth', xf(rockGeo(s, i + 9, 1, 0.55, 1), { x: xc + Math.cos(a) * (ex + 0.4) * t, y: 0.05 + r() * 0.15, z: Math.sin(a) * (ez + 0.4) * t, ry: r() * PI }));
    }
    for (let i = 0; i < 9; i++) {
      const a = r() * PI * 2;
      ek.add('earth', xf(rockGeo(1.2 + r() * 1.2, i + 51, 1.6, 0.45, 1.2), { x: xc + Math.cos(a) * (ex + 2.5), y: 0, z: Math.sin(a) * (ez + 2.5), ry: r() * PI }));
    }
    root.add(meshesFrom(ek.merge(), th));
    info.tips.forEach((tp, i) => {
      const wp = tp.clone().applyMatrix4(g.matrixWorld);
      for (let k = 0; k < 3; k++) addFragment(root, th, fragMats, V(wp.x + (r() - 0.5) * 2.5, wp.y + 1.2 + r() * 3.5, wp.z + (r() - 0.5) * 2.5), 0.2 + r() * 0.45, i * 5 + k + 3 + state.seed);
    });
    orbPos = V(xc + 2, info.maxH - p.sink.depth + 5, -2);
  } else if (p.inverted) {
    const thick = 1.8;
    root.add(meshesFrom(geos, th));
    const mirror = meshesFrom(geos, th);
    mirror.scale.y = -1; mirror.position.y = -thick;
    root.add(mirror);
    const ik = new Kit();
    const ex = (info.xmax - info.xmin) / 2 + 1.4, ez = info.zmax + 1.2;
    ik.add('earth', xf(jitter(new THREE.CylinderGeometry(1, 0.9, thick, 14, 2).scale(ex, 1, ez), 0.3, state.seed + 2), { x: xc, y: -thick / 2 }));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI * 2 + r() * 0.4;
      ik.add('earth', xf(rockGeo(0.7 + r() * 0.9, i + 71, 1, 1.6, 1), { x: xc + Math.cos(a) * ex * 0.97, y: -thick / 2 + (r() - 0.5) * 0.8, z: Math.sin(a) * ez * 0.97 }));
    }
    root.add(meshesFrom(ik.merge(), th));
    for (let i = 0; i < 16; i++) {
      const a = r() * PI * 2, t = 1.25 + r() * 0.6;
      addFragment(root, th, fragMats, V(xc + Math.cos(a) * ex * t, -thick / 2 + (r() - 0.5) * info.maxH * 0.9, Math.sin(a) * ez * t), 0.3 + r() * 0.8, i + 31 + state.seed);
    }
    orbPos = V(xc, -thick / 2, ez + 6);
  } else {
    const g = meshesFrom(geos, th);
    g.position.y = PL; root.add(g);
    const tip = info.tips.reduce((a, b) => (b.y >= a.y ? b : a), V(0, -1, 0));
    orbPos = p.orb === 'spire' ? V(tip.x, PL + tip.y + 2.2, tip.z) : V(info.cx ?? 0, PL + info.maxH + 4, 0);
  }

  if (grounded) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ color: state.theme === 'paper' ? '#7a5532' : '#000', opacity: th.shadowOpacity }));
    ground.rotation.x = -PI / 2; ground.receiveShadow = true;
    root.add(ground);
  }

  anim.orb = makeOrb(th, p.orb === 'spire' ? 1.0 : 1.4);
  anim.orb.position.copy(orbPos);
  anim.orbY = orbPos.y;
  root.add(anim.orb);

  // fit
  const bb = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse(o => { if (o.isMesh && !o.userData.noFit && !(o.material instanceof THREE.ShadowMaterial)) { o.geometry.computeBoundingBox(); bb.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  const sphere = bb.getBoundingSphere(new THREE.Sphere());
  state.R = sphere.radius;

  // shadows sized to the scene
  const R = sphere.radius;
  key.position.copy(sphere.center).add(V(-0.55, 1, 0.45).normalize().multiplyScalar(R * 2.5));
  key.target.position.copy(sphere.center);
  const sc = key.shadow.camera; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 0.1; sc.far = R * 5; sc.updateProjectionMatrix();
  rim.position.copy(sphere.center).add(V(1, 0.4, -0.8));
  under.position.copy(sphere.center).add(V(0, -1, 0.3));
  rim.target = key.target; under.target = key.target;

  // drifting motes
  const N = isSmall() ? 260 : 460, pos = new Float32Array(N * 3), sp = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = sphere.center.x + (r() - 0.5) * R * 1.6;
    pos[i * 3 + 1] = bb.min.y + r() * (bb.max.y - bb.min.y + 3);
    pos[i * 3 + 2] = sphere.center.z + (r() - 0.5) * R * 1.6;
    sp[i] = 0.3 + r() * 0.9;
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: new THREE.Color(th.glow).multiplyScalar(th.additive ? 2 : 1), size: 2.4, sizeAttenuation: false,
    transparent: true, opacity: th.additive ? 0.8 : 0.55, depthWrite: false, blending: th.additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  root.add(pts);
  anim.pts = { pts, sp, y0: bb.min.y, y1: bb.max.y + 3 };

  if (refit) {
    controls.target.copy(sphere.center);
    camera.position.copy(sphere.center).add(V(-1, p.inverted ? 0.42 : 0.62, 1.05).normalize().multiplyScalar(R * 4));
    camera.zoom = 1; camera.near = 0.1; camera.far = R * 10;
    camera.updateProjectionMatrix();
    controls.maxPolarAngle = p.inverted ? PI * 0.95 : PI * 0.49;
    controls.update();
  }
  resize();
  updateCard();
}

function makeParams(id, r) {
  const naveH = 9 + r() * 2.5;
  const p = {
    bays: 6 + Math.floor(r() * 3), bayLen: 2.1 + r() * 0.4, naveW: 4 + r() * 0.6, naveH,
    aisleW: 2.1, aisleH: naveH * 0.45,
    transept: { at: 0.55 + r() * 0.15, arm: 3.8 + r() * 1.4 },
    towers: { kind: 'twin', w: 3.2 + r() * 0.5, h: naveH * (1.35 + r() * 0.3), spire: naveH * (0.9 + r() * 0.5), broken: false },
    crossing: { h: naveH * (0.7 + r() * 0.5), broken: false },
    apse: true, winW: 0.72 + r() * 0.18, orb: 'crossing'
  };
  if (id === 'needle') {
    p.bays = 5 + Math.floor(r() * 2); p.naveW = 3.4 + r() * 0.3; p.naveH = 11 + r() * 2;
    p.aisleH = p.naveH * 0.42; p.aisleW = 1.8; p.transept = null; p.crossing = null;
    p.towers = { kind: 'single', w: 4.6 + r() * 0.6, h: p.naveH * (1.85 + r() * 0.3), spire: p.naveH * (1.5 + r() * 0.6), broken: false };
    p.orb = 'spire';
  } else if (id === 'sundered') {
    p.split = { at: 0.42 + r() * 0.12, lift: 3 + r() * 2.5, drift: 3.8 + r() * 2, tilt: 0.1 + r() * 0.12 };
  } else if (id === 'sunken') {
    p.sink = { depth: p.naveH * (0.3 + r() * 0.12), tilt: 0.1 + r() * 0.08, roll: (r() - 0.5) * 0.12 };
    p.towers.broken = true; p.crossing.broken = true;
  } else if (id === 'inverted') {
    p.bays = 4 + Math.floor(r() * 2); p.transept.at = 0.6; p.transept.arm = 2.9 + r() * 0.8;
    p.inverted = true;
  }
  return p;
}

// ------------------------------------------------------------------ view + UI
function resize() {
  const el = canvas.parentElement, w = el.clientWidth, h = el.clientHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  renderer.getDrawingBufferSize(drawRes);
  const aspect = w / Math.max(1, h), narrow = innerWidth < 760;
  const halfH = state.R * 0.95 * Math.max(1, 1 / aspect) * (narrow ? 0.9 : 1);
  const shift = narrow ? halfH * 0.16 : 0;   // lift the model above the info card on phones
  camera.left = -halfH * aspect; camera.right = halfH * aspect; camera.top = halfH - shift; camera.bottom = -halfH - shift;
  camera.updateProjectionMatrix();
}

function updateCard() {
  const i = VARIANTS.findIndex(v => v.id === state.variant), v = VARIANTS[i];
  $('cardNo').textContent = `VARIATION ${String(i + 1).padStart(2, '0')}`;
  $('cardName').textContent = v.name;
  $('cardDesc').textContent = v.desc;
  $('cardSeed').textContent = `SEED ${state.seed}`;
  document.querySelectorAll('[data-variant]').forEach(b => b.classList.toggle('on', b.dataset.variant === state.variant));
  document.querySelectorAll('[data-theme-btn]').forEach(b => b.classList.toggle('on', b.dataset.themeBtn === state.theme));
  $('spinBtn').classList.toggle('on', state.spin);
  const q = new URLSearchParams({ v: state.variant, seed: state.seed });
  if (state.theme === 'paper') q.set('theme', 'paper');
  history.replaceState(null, '', `?${q}`);
}

function savePng() {
  composer.render();
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `temple-of-the-voided-${state.variant}-${state.seed}.png`;
  a.click();
}

function initUI() {
  const seg = $('variantSeg');
  VARIANTS.forEach((v, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.variant = v.id;
    b.innerHTML = `<small>${String(i + 1).padStart(2, '0')}</small>${v.name}`;
    b.addEventListener('click', () => { if (state.variant !== v.id) { state.variant = v.id; rebuild(true); } });
    seg.appendChild(b);
  });
  document.querySelectorAll('[data-theme-btn]').forEach(b => b.addEventListener('click', () => {
    state.theme = b.dataset.themeBtn;
    try { localStorage.setItem('epitaph-temple-theme', state.theme); } catch (e) {}
    rebuild(false);
  }));
  $('rerollBtn').addEventListener('click', () => { state.seed = 1 + Math.floor(Math.random() * 9999); rebuild(true); });
  $('spinBtn').addEventListener('click', () => { state.spin = !state.spin; updateCard(); });
  $('saveBtn').addEventListener('click', savePng);
  controls.addEventListener('start', () => { state.lastInteract = performance.now(); });
  controls.addEventListener('end', () => { state.lastInteract = performance.now(); });
  addEventListener('resize', resize);
}

function readState() {
  const q = new URLSearchParams(location.search);
  if (VARIANTS.some(v => v.id === q.get('v'))) state.variant = q.get('v');
  const s = parseInt(q.get('seed'), 10); if (s > 0) state.seed = s;
  let t = q.get('theme');
  if (!t) { try { t = localStorage.getItem('epitaph-temple-theme'); } catch (e) {} }
  if (t === 'paper' || t === 'crt') state.theme = t;
}

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime, still = reduceMotion;
  if (anim?.B) {
    const B = anim.B;
    if (!still) { B.pivot.position.y = B.y + Math.sin(t * 0.6) * 0.3; B.pivot.rotation.z = B.rz + Math.sin(t * 0.37) * 0.025; }
    B.pivot.updateMatrixWorld(true);
    B.plane.copy(B.local).applyMatrix4(B.inner.matrixWorld);
  }
  if (anim && !still) {
    for (const f of anim.frags) { f.m.position.y = f.y + Math.sin(t * f.sp + f.ph) * f.amp; f.m.rotation.y += f.rs * dt; }
    if (anim.orb) {
      anim.orb.position.y = anim.orbY + Math.sin(t * 0.8) * 0.25;
      anim.orb.userData.rimMat.uniforms.uT.value = t;
      anim.orb.userData.ring.rotation.z += dt * 0.4;
    }
    if (anim.pts) {
      const a = anim.pts.pts.geometry.attributes.position, { sp, y0, y1 } = anim.pts;
      for (let i = 0; i < sp.length; i++) { let y = a.getY(i) + sp[i] * dt; if (y > y1) y = y0; a.setY(i, y); }
      a.needsUpdate = true;
    }
  }
  controls.autoRotate = state.spin && !still && performance.now() - state.lastInteract > 5000;
  controls.update(dt);
  composer.render();
}

try {
  readState();
  initUI();
  rebuild(true);
  $('boot').hidden = true;
  frame();
} catch (err) {
  console.error(err);
  $('boot').textContent = 'COULD NOT START 3D. ' + (err && err.message ? err.message : '');
}
