/* Epitaph — the map (atlas-3d.html). Replaced the old Relief / Globe / Shattered Atlas 3D.
 *
 * Two zoom levels in the Atlas 3D look (orthographic camera, ink outlines, toon blocks):
 *   01 EPITAPH  the planet: a globe of hex columns. Earth is one small island on it
 *               (not to scale); the rest is unmapped. Era 1: The Binding wraps the planet.
 *   02 EARTH    the board: real Earth in blocks (Equal Earth projection, real elevation).
 *               Era 1: the gods went straight through Antarctica → a crater down to
 *               Blankslate ringed by impact mountains, sea +60 m, a floating island above.
 *
 * Lore: Exploratory Ideas/Lore/Epitaph Map.md and Lore Decisions 2026-11-12.md (vault).
 * Data: assets/atlas3d/earth.png + earth.json, built by tools/map/build_circle.py
 *       (R relief · G low land 0.25 m · B sea depth · A inside the round island),
 *       places from assets/epitaph-world.js, characters from the Dossier's localStorage.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadPins, buildPin, designFor } from './pins/pins.js?v=10';
import { buildStone, buildScabbard, slotLocal } from './stones.js?v=2';
import { openCloseup, isOpen as closeupOpen } from './closeup.js?v=12';

const World = window.EpitaphWorld;
const $ = id => document.getElementById(id);
const num = v => typeof v === 'number' && isFinite(v);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = () => Math.min(innerWidth, innerHeight) < 640;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const UP = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ palettes (from Atlas 3D)
const THEMES = {
  crt: {
    bg: '#080603', sea: '#120c06', seaLine: '#3a2810', land: '#5e4423', landHi: '#d9b06a',
    ink: '#040302', city: '#f1e6cf', glow: '#ffb238', atmo: '#ffb238', grid: '#ffb238',
    hemiSky: '#fff1d8', hemiGround: '#3a2a14', key: '#ffe6c0', env: 0.25, exposure: 1.05,
    shadow: '#000000', shadowOpacity: 0.55, outlinePx: 1.4,
    seaBands: ['#5a4426', '#46341d', '#372916', '#2b2011'], flood: '#3aa6b0', rock: '#3a2b1a', ice: '#f4e6c8',
    ghost: '#3a2a16', binding: '#ffb238', sunk: '#3aa6b0', edge: '#ffb238',
    groups: { VOIDED: '#9b8cff', STORYBORN: '#6fb3a3', FALLEN: '#d4452b', OTHER: '#b5904f' }
  },
  paper: {
    bg: '#f6eddd', sea: '#c9d6e6', seaLine: '#9fb2cc', land: '#9cc27a', landHi: '#f4efe4',
    ink: '#141a2c', city: '#ffffff', glow: '#ff8a3d', atmo: '#f2b35a', grid: '#7a5532',
    hemiSky: '#fffaf3', hemiGround: '#c2ae90', key: '#fff6ea', env: 0.4, exposure: 1.0,
    shadow: '#7a5532', shadowOpacity: 0.3, outlinePx: 1.3,
    seaBands: ['#6a86c4', '#5470b0', '#45609e', '#38508a'], flood: '#1aa39a', rock: '#8a7a66', ice: '#ffffff',
    ghost: '#d9ccb2', binding: '#141a2c', sunk: '#1aa39a', edge: '#141a2c',
    groups: { VOIDED: '#6a5acd', STORYBORN: '#3fa08a', FALLEN: '#e8392e', OTHER: '#9c7a4a' }
  }
};
const CHAR_COLORS = ['#d4452b', '#6fb3a3', '#e3b95c', '#9b8cff', '#f1e6cf', '#ff7a45', '#7fc8ff', '#c78bd8'];
// land colour ramp by height band (dark lowland → pale peaks), blended from land → landHi
const rampColor = (T, band) => new THREE.Color(T.land).lerp(new THREE.Color(T.landHi), Math.min(1, band / 7));

// ------------------------------------------------------------------ noise
function makeNoise(seed) {
  const perm = new Uint8Array(512), p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed >>> 0 || 1;
  for (let i = 255; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  return (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y), a = perm[X] + Y, b = perm[X + 1] + Y;
    return lerp(lerp(grad(perm[a], x, y), grad(perm[b], x - 1, y), u), lerp(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u), v);
  };
}
const noise = makeNoise(7), noiseB = makeNoise(31);
const fbm = (x, y) => noise(x, y) * 0.6 + noise(x * 2.1, y * 2.1) * 0.28 + noise(x * 4.3, y * 4.3) * 0.12;

// ------------------------------------------------------------------ Equal Earth (matches the heightmap)
const EE = { xmax: 2.7066297319215575, ymax: 1.3173627591574133 };
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, MM = Math.sqrt(3) / 2;
function eeXY(lng, lat) {
  const p = Math.asin(MM * Math.sin(lat * Math.PI / 180)), p2 = p * p, p6 = p2 * p2 * p2;
  return [(lng * Math.PI / 180) * Math.cos(p) / (MM * (A1 + 3 * A2 * p2 + p6 * (7 * A3 + 9 * A4 * p2))), p * (A1 + A2 * p2 + p6 * (A3 + A4 * p2))];
}
// Composite "Earth island" layout (see map-data/build_composite.py): Equal Earth for the main
// continents (seam in the Bering Strait), Antarctica whole as a round piece below.
let LAY = null;
function eeUV(lng, lat) {
  const L = LAY;
  if (lat >= L.latCut) {
    const lr = ((lng - L.lon0 + 540) % 360) - 180;
    const [x, y] = eeXY(lr, lat);
    const px = L.mainX0 + (x / L.xmax + 1) / 2 * L.mainW, py = L.mainY0 + (L.ymax - y) / (L.ymax - L.ycut) * L.mainH;
    return [px / L.W, 1 - py / L.H];
  }
  const r = (lat + 90) / L.cdisc * L.rd, a = (lng - L.lonUp) * Math.PI / 180;
  return [(L.dcx + r * Math.sin(a)) / L.W, 1 - (L.dcy - r * Math.cos(a)) / L.H];
}

// ------------------------------------------------------------------ elevation data (CPU)
let DATA = null;
async function loadData() {
  LAY = await (await fetch('assets/atlas3d/earth.json?v=2')).json();
  setLayoutConstants();
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'assets/atlas3d/earth.png?v=2'; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  DATA = { w: img.width, h: img.height, px: g.getImageData(0, 0, img.width, img.height).data };
}
function texel(u, v) {
  const x = Math.min(DATA.w - 1, Math.max(0, Math.floor(u * DATA.w))), y = Math.min(DATA.h - 1, Math.max(0, Math.floor((1 - v) * DATA.h)));
  const i = (y * DATA.w + x) * 4; return DATA.px.subarray(i, i + 4);
}
function elevM(t) {
  if (t[2] > 0) return -Math.pow(Math.max(t[2] - 1, 0) / 254, 2) * 8000;
  if (t[1] < 255) return t[1] / 4;
  return Math.pow(Math.max(t[0] - 1, 0) / 254, 2) * 8800;
}
const LEVELS = [250, 700, 1400, 2400, 3800, 5500, 7500, 9500, 11500];
const landLevel = h => { for (let i = 0; i < LEVELS.length; i++) if (h < LEVELS[i]) return i; return 9; };
const seaBand = d => d < 200 ? 0 : d < 2000 ? 1 : d < 4200 ? 2 : 3;

// The strike point (uv on the Equal Earth map): central Antarctica, enlarged so it reads.
const CRATER = { c: [0.5, 0.5], r: [0.1, 0.1] };
const PIT_STEPS = 7;
const craterDist = (u, v) => Math.hypot((u - CRATER.c[0]) / CRATER.r[0], (v - CRATER.c[1]) / CRATER.r[1]);

// One map point in one era → { kind, band, elev }
// kind: land · sea · sunk (flooded land) · pit (crater) · rim (impact mountains) · out (beyond Earth)
function earthAt(u, v, era) {
  const t = texel(u, v);
  if (t[3] < 128) return { kind: 'out' };
  const e = elevM(t), sea = era ? 60 : 0;
  let rim = 0;
  if (era) {
    const d = craterDist(u, v);
    if (d < 1) return { kind: 'pit', band: Math.min(PIT_STEPS, Math.floor((1 - d) / (0.84 / PIT_STEPS)) + 1), elev: e };
    if (d < 2.3) {
      const n = (fbm(u * 60, v * 60) + 1) / 2;
      rim = 11000 * Math.exp(-(((d - 1.12) / 0.2) ** 2)) * (0.5 + n) + 4000 * Math.exp(-(((d - 1.6) / 0.35) ** 2)) * n;
    }
  }
  const eff = e < 0 ? e + rim * 1.3 : e + rim;
  if (eff < sea) return e >= 0 && rim < 200 ? { kind: 'sunk', band: 0, elev: e } : { kind: 'sea', band: seaBand(sea - e), elev: e };
  return { kind: rim > 700 ? 'rim' : 'land', band: landLevel(eff), elev: e };
}

// ------------------------------------------------------------------ ink outline (screen-space inverted hull, from Atlas 3D)
const outlineMats = new Set();
function outlineMaterial(color, px) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPx: { value: px }, uRes: { value: new THREE.Vector2(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight) } },
    vertexShader: `
      uniform float uPx; uniform vec2 uRes;
      void main(){
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
          m = modelMatrix * instanceMatrix;
        #endif
        vec4 wp = m * vec4(position, 1.0);
        vec3 wn = normalize(mat3(m) * normal);
        vec4 c0 = projectionMatrix * viewMatrix * wp;
        vec4 c1 = projectionMatrix * viewMatrix * vec4(wp.xyz + wn * 0.05, 1.0);
        vec2 d = c1.xy / c1.w - c0.xy / c0.w;
        float l = length(d);
        if (l > 1e-6) c0.xy += (d / l) * uPx * 2.0 / uRes * c0.w;
        c0.z += 0.0004 * c0.w;
        gl_Position = c0;
      }`,
    fragmentShader: `uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }`,
    side: THREE.BackSide
  });
  outlineMats.add(m);
  return m;
}
function hullGeometry(geo) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.getAttribute('position').clone());
  if (geo.index) g.setIndex(geo.index.clone());
  const m = mergeVertices(g, 1e-4); m.computeVertexNormals(); return m;
}
function withOutline(mesh, T, px) {
  const mat = outlineMaterial(T.ink, px ?? T.outlinePx);
  const o = mesh.isInstancedMesh ? new THREE.InstancedMesh(hullGeometry(mesh.geometry), mat, mesh.count) : new THREE.Mesh(hullGeometry(mesh.geometry), mat);
  if (mesh.isInstancedMesh) o.instanceMatrix = mesh.instanceMatrix;
  o.raycast = () => {};
  mesh.add(o); mesh.userData.outline = o;
  return mesh;
}

// ------------------------------------------------------------------ engine
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.localClippingEnabled = true;          // Unbound swords are cut where they pass through their barrier
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = true; controls.zoomSpeed = 1.2;
const hemi = new THREE.HemisphereLight('#fff', '#000', 1);
const key = new THREE.DirectionalLight('#fff', 1.6);
key.castShadow = true;
key.shadow.mapSize.set(isSmall() ? 2048 : 4096, isSmall() ? 2048 : 4096);
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
const fill = new THREE.DirectionalLight('#ffd9a0', 0.35);
scene.add(hemi, key, key.target, fill);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(9, 9);

const state = { view: 'planet', theme: 'crt', era: 1, eraT: 1, chapter: null, chapters: [], chars: [], demo: false, focus: null, spin: true, lastInteract: 0 };

// ------------------------------------------------------------------ data: characters + places
function loadCharacters() {
  let st = null;
  try { st = JSON.parse(localStorage.getItem('epitaph-character-profiles') || 'null'); } catch (e) { st = null; }
  const list = (st && Array.isArray(st.characters)) ? st.characters : [];
  const chars = list.map((c, i) => {
    const versions = (c.snapshots || []).filter(s => Number.isInteger(s.startChapter)).sort((a, b) => a.startChapter - b.startChapter);
    const stops = versions.map(s => ({ ch: s.startChapter, presence: s.presence || 'alive', r: World.resolve(s.location), snapId: s.id, locked: !!s.locked, objective: s.objective || '' })).filter(s => s.r && ((num(s.r.lat) && num(s.r.lng)) || (num(s.r.u) && num(s.r.v))));
    if (!stops.length) {
      const snap = (c.snapshots || []).find(s => s.id === c.activeSnapshotId) || (c.snapshots || [])[0];
      const r = snap && World.resolve(snap.location);
      if (r && (num(r.lat) || num(r.u))) stops.push({ ch: null, presence: snap.presence || 'alive', r, snapId: snap.id, locked: !!snap.locked, objective: snap.objective || '' });
    }
    return { id: c.id, name: c.name || 'Unnamed', race: c.race || '', color: CHAR_COLORS[i % CHAR_COLORS.length], stops };
  });
  state.unplaced = chars.filter(c => !c.stops.length).map(c => c.name);       // in the Dossier, but no location yet
  chars.splice(0, chars.length, ...chars.filter(c => c.stops.length));
  const chapters = new Set((st && st.chapters || []).map(c => c.number).filter(Number.isInteger));
  chars.forEach(c => c.stops.forEach(s => Number.isInteger(s.ch) && chapters.add(s.ch)));
  const titles = {}; (st && st.chapters || []).forEach(c => { if (Number.isInteger(c.number)) titles[c.number] = c.title || ''; });
  if (chars.length) return { chars, chapters: [...chapters].sort((a, b) => a - b), titles, demo: false };
  const stop = (ch, id) => ({ ch, presence: 'alive', r: World.resolve({ placeId: id }) });
  return {
    demo: true, titles: {}, chapters: [1, 2, 3, 4, 5],
    chars: [
      { id: 'demo-orin', name: 'Orin (demo)', color: CHAR_COLORS[0], stops: [stop(1, 'aurelia'), stop(3, 'cairo'), stop(4, 'voided-settlement-001'), stop(5, 'temple-voided-001')] },
      { id: 'demo-b', name: 'Second (demo)', color: CHAR_COLORS[1], stops: [stop(1, 'johannesburg'), stop(3, 'storyborn-church-001'), stop(5, 'storyborn-settlement-001')] }
    ].map(c => ({ ...c, stops: c.stops.filter(s => s.r) }))
  };
}
function charStateAt(c, ch) {
  if (ch == null) { const s = c.stops[c.stops.length - 1]; return { stop: s, path: c.stops }; }
  const upTo = c.stops.filter(s => s.ch == null || s.ch <= ch);
  if (!upTo.length) return null;
  const dead = upTo.find(s => s.presence === 'dead');
  return { stop: dead || upTo[upTo.length - 1], path: dead ? upTo.slice(0, upTo.indexOf(dead) + 1) : upTo };
}
// Lore filter: Era 0 is real Earth with no fake cities. Era 1 adds the special sites
// (Angels and Demons are dropped) and Aurelia / Verdant Reach as Era 1 settlements.
const ERA1_FICTIONAL = new Set(['aurelia', 'verdant-reach']);
function placesFor(era) {
  return World.places().filter(p => {
    if (!num(p.lat) || !num(p.lng)) return false;
    if (p.group === 'ANGEL' || p.group === 'DEMON') return false;
    if (era === 0) return !p.fictional && (p.eras || []).includes('ERA_0');
    if (p.fictional) return ERA1_FICTIONAL.has(p.id);
    return true;
  });
}

// ------------------------------------------------------------------ view plumbing
let root = null, pickables = [], animated = [], surface = null, labels = [], viewCfg = null;
let markerRoot = null, markerAnim = [], markerArgs = null;   // the place + character markers, rebuilt alone when a pin moves
let eraHooks = [];          // (eraT) => void, called while the era changes
function mat(color, opts = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, envMapIntensity: 1, ...opts }); }
function shadowGround(T, y, size) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShadowMaterial({ color: T.shadow, opacity: T.shadowOpacity, depthWrite: false }));
  g.rotation.x = -Math.PI / 2; g.position.y = y; g.receiveShadow = true; g.renderOrder = -1; return g;
}
function gridLines(T, y, size, step, opacity) {
  const pts = [];
  for (let v = -size / 2; v <= size / 2 + 1e-6; v += step) pts.push(v, y, -size / 2, v, y, size / 2, -size / 2, y, v, size / 2, y, v);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: T.grid, transparent: true, opacity, depthWrite: false }));
}
function toonMaterial() {
  const ramp = new Uint8Array([90, 170, 255]);
  const gradient = new THREE.DataTexture(ramp, 3, 1, THREE.RedFormat); gradient.needsUpdate = true;
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  return new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradient });
}
function glyphStrip(T) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 48;
  const g = c.getContext('2d'); g.fillStyle = T.binding; g.font = 'bold 26px Space Mono, monospace';
  const s = 'THE BINDING · PLAY YOUR PART · NO GOD PASSES · THE SCRIBE WITNESSES · ';
  let x = 0; while (x < c.width) { g.fillText(s, x, 34); x += g.measureText(s).width; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1); return t;
}
function sealTexture(T) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'); g.translate(256, 256); g.strokeStyle = T.glow; g.fillStyle = T.glow;
  for (const [r, w] of [[236, 7], [212, 2], [150, 6], [80, 6]]) { g.lineWidth = w; g.strokeRect(-r, -r, r * 2, r * 2); }
  g.save(); g.rotate(Math.PI / 4); g.lineWidth = 5; g.strokeRect(-110, -110, 220, 220); g.restore();
  g.fillRect(-28, -28, 56, 56);
  g.font = 'bold 28px Space Mono, monospace'; g.textAlign = 'center';
  for (let s = 0; s < 4; s++) { g.save(); g.rotate(s * Math.PI / 2); g.fillText('BLANKSLATE', 0, -172); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- marker shapes (from Atlas 3D)
const markerGeo = {};
(function buildMarkerGeos() {
  markerGeo.city = new THREE.LatheGeometry([[0, 0], [0.11, 0], [0.11, 0.03], [0.05, 0.05], [0.045, 0.32], [0.075, 0.36], [0, 0.48]].map(([x, y]) => new THREE.Vector2(x, y)), 10);
  markerGeo.temple = mergeGeometries([
    new THREE.BoxGeometry(0.34, 0.08, 0.34).translate(0, 0.04, 0), new THREE.BoxGeometry(0.24, 0.08, 0.24).translate(0, 0.12, 0),
    new THREE.BoxGeometry(0.14, 0.08, 0.14).translate(0, 0.2, 0), new THREE.ConeGeometry(0.05, 0.26, 4).translate(0, 0.37, 0)].map(g => g.toNonIndexed()));
  markerGeo.settlement = mergeGeometries([[0, 0, 0.09, 0.2], [0.13, 0.05, 0.065, 0.14], [-0.1, 0.09, 0.06, 0.12], [-0.04, -0.13, 0.055, 0.1]].map(([x, z, r, h]) => mergeGeometries([
    new THREE.CylinderGeometry(r, r, h, 10).translate(x, h / 2, z).toNonIndexed(), new THREE.ConeGeometry(r * 1.2, r * 1.2, 10).translate(x, h + r * 0.6, z).toNonIndexed()])));
  markerGeo.ruin = mergeGeometries([new THREE.CylinderGeometry(0.06, 0.07, 0.3, 8).translate(0, 0.15, 0).toNonIndexed(), new THREE.BoxGeometry(0.2, 0.05, 0.12).rotateZ(0.5).translate(0.12, 0.03, 0.05).toNonIndexed()]);
  markerGeo.other = markerGeo.ruin;
  markerGeo.token = mergeGeometries([new THREE.CapsuleGeometry(0.09, 0.16, 4, 12).translate(0, 0.2, 0).toNonIndexed(), new THREE.TorusGeometry(0.14, 0.025, 6, 20).rotateX(Math.PI / 2).translate(0, 0.02, 0).toNonIndexed()]);
  markerGeo.dead = mergeGeometries([new THREE.BoxGeometry(0.06, 0.4, 0.06).translate(0, 0.2, 0).toNonIndexed(), new THREE.BoxGeometry(0.24, 0.06, 0.06).translate(0, 0.29, 0).toNonIndexed()]);
})();
// ---------- settlement stones (assets/atlas3d/stones.js): an engraved standing stone on a plinth with sword slots
const STONE_S = 0.85;                           // grave size in marker units (about 0.5 tall)
const sheathed = new Set();                     // 'charId|placeKey' whose scabbard has already risen (it rises once per arrival)
const stonePal = T => ({ land: T.land, landHi: T.landHi, rock: T.rock, ink: T.ink, glow: T.glow });
const PIN_GAP = 0.46;                           // how far a sword stands from a plain place's marker
let stones = {};                                // placeId → { g, scale, taken: Map(charId → slot) } for the current markers
const stoneKind = p => (p.group === 'STORYBORN' || (p.fictional && !p.group)) ? 'storyborn' : p.group === 'VOIDED' ? 'voided' : p.group === 'FALLEN' ? 'fallen' : null;
// slot k of a stone, in the markers' space (a sword's tip goes here)
function slotPos(st, k) { return slotLocal(k).multiplyScalar(st.scale).applyQuaternion(st.g.quaternion).add(st.g.position); }
function freeSlot(st, exceptId) { const used = new Set([...st.taken].filter(([id]) => id !== exceptId).map(([, k]) => k)); let k = 0; while (used.has(k)) k++; return k; }
function placeOn(obj, at, scale = 1) { obj.position.copy(at.pos); obj.quaternion.setFromUnitVectors(UP, at.normal); obj.scale.setScalar(scale); }
let arcBetween = null;

// places + characters + trails on the current surface
function addMarkers(T, markerScale, parent = root) {
  markerArgs = { T, markerScale, parent };
  markerRoot = new THREE.Group(); parent.add(markerRoot); parent = markerRoot; stones = {};
  const era = state.era;
  const byKey = {};
  // a fictional city whose own Storyborn site stands inside it (Verdant Reach) is drawn once: the site's statue
  const shown = placesFor(era), representedBy = new Set(shown.filter(q => q.group === 'STORYBORN' && q.cityId).map(q => q.cityId));
  shown.forEach(p => {
    if (p.fictional && !p.group && representedBy.has(p.id)) return;
    const [u, v] = eeUV(p.lng, p.lat);
    const here = earthAt(u, v, era);
    const sunk = era === 1 && !p.group && !p.fictional && (here.kind === 'sunk' || here.kind === 'sea');
    const kind = markerGeo[p.kind] ? p.kind : 'other';
    const color = p.group ? (T.groups[p.group] || T.groups.OTHER) : sunk ? T.sunk : p.fictional ? T.groups.STORYBORN : T.city;
    // settlements stand as Epitaph stones (assets/atlas3d/stones.js); cities are flat dots
    const statue = sunk ? null : stoneKind(p);
    const k = p.lat.toFixed(1) + ',' + p.lng.toFixed(1);
    const n = byKey[k] = (byKey[k] || 0) + 1;
    const spread = state.view === 'planet' ? 1.2 : 4.2;   // places sharing a spot (a temple in a city) sit side by side
    const at = surface(p.lat - (n - 1) * spread * 0.55, p.lng + (n - 1) * spread);
    const flat = geo => geo.rotateX(-Math.PI / 2);
    if (statue) {
      const c = T.groups[statue.toUpperCase()] || T.groups.OTHER, st = buildStone(statue, c, stonePal(T));
      const g = st.group; placeOn(g, at, markerScale * STONE_S); g.userData.place = p;
      st.hit.userData.place = p; st.hit.userData.sunk = false; pickables.push(st.hit);
      st.parts.forEach(m => { if (!m.material.isMeshBasicMaterial) withOutline(m, T); });
      stones[p.id] = { g, scale: markerScale * STONE_S, taken: new Map() };
      parent.add(g);
      return;
    }
    const g = new THREE.Group(); placeOn(g, at, markerScale); g.userData.place = p; g.userData.sunk = sunk;
    const hit = new THREE.Mesh(flat(new THREE.CircleGeometry(.16, 16)), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = .02; hit.userData.place = p; hit.userData.sunk = sunk; g.add(hit); pickables.push(hit);
    {
      const dot = new THREE.Mesh(flat(new THREE.CircleGeometry(.06, 16)), new THREE.MeshBasicMaterial({ color, transparent: sunk, opacity: sunk ? .7 : 1 }));
      const halo = new THREE.Mesh(flat(new THREE.RingGeometry(.075, .09, 24)), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .45, depthWrite: false }));
      dot.position.y = halo.position.y = .025; g.add(dot, halo);
    }
    parent.add(g);
  });
  // the story's chapters take place in Era 1; only Vale (sent about 100 years back) also stands in Era 0
  const chars = era === 1 ? state.chars : state.chars.filter(stayInEra0);
  const stacks = {}, poses = readPoses();
  chars.forEach(c => {                                                 // swords that remember a slot claim it first
    const cs = charStateAt(c, state.chapter), st = cs && cs.stop.r.kind !== 'point' && cs.stop.r.place && stones[cs.stop.r.place.id];
    const pose = poses[c.id];
    if (st && pose && pose.key === cs.stop.r.key && Number.isInteger(pose.slot) && ![...st.taken.values()].includes(pose.slot)) st.taken.set(c.id, pose.slot);
  });
  chars.forEach(c => {
    const cs = charStateAt(c, state.chapter);
    if (!cs) return;
    const r = cs.stop.r, n = stacks[r.key] = (stacks[r.key] || 0) + 1;
    const at = spotAt(r); if (!at) return;                              // a spot beyond the board shows on the planet only
    const dead = cs.stop.presence === 'dead';
    const t = dead || !PIN_TEMPLATE ? new THREE.Mesh(dead ? markerGeo.dead : markerGeo.token, mat(c.color, { roughness: 0.35, emissive: c.color, emissiveIntensity: 0.25 })) : makePin(T, c);
    placeOn(t, at, markerScale * (t.userData.isPin ? PIN_LEN : 1.15));
    const side = new THREE.Vector3().crossVectors(at.normal, Math.abs(at.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP).normalize();
    const fwd = new THREE.Vector3().crossVectors(side, at.normal);
    const ang = 2.4 + (n - 1) * 2.1, rad = r.kind === 'point' && n === 1 ? 0 : PIN_GAP * markerScale;   // tokens stand beside the place marker, not on it
    const st = r.kind !== 'point' && r.place && stones[r.place.id];
    if (st && t.userData.isPin) {                                      // in the stone's sword slots, upright
      if (!st.taken.has(c.id)) st.taken.set(c.id, freeSlot(st, c.id));
      t.position.copy(slotPos(st, st.taken.get(c.id))); t.quaternion.copy(st.g.quaternion);
      // its scabbard rises out of the plinth when it arrives, and sinks while the sword is carried away
      const sc = buildScabbard(c.color, stonePal(T)); withOutline(sc, T);
      sc.position.copy(t.position); sc.quaternion.copy(t.quaternion); sc.scale.copy(t.scale); parent.add(sc);
      const tag = c.id + '|' + r.key, nrm = at.normal.clone(), base = t.position.clone(), depth = .55 * t.scale.x;
      let up = sheathed.has(tag) || reduceMotion ? 1 : 0; sheathed.add(tag);
      markerAnim.push((time, dt) => {
        const want = drag.active && drag.active.pin === t && drag.active.verdict.ok ? 0 : 1;
        up += (want - up) * (1 - Math.exp(-(want ? 3 : 9) * (dt || .016)));
        const e = up * up * (3 - 2 * up);
        sc.visible = e > .02; sc.position.copy(base).addScaledVector(nrm, -depth * (1 - e));
      });
    } else t.position.addScaledVector(side, Math.cos(ang) * rad).addScaledVector(fwd, Math.sin(ang) * rad).addScaledVector(at.normal, 0.04);
    t.castShadow = true; t.userData.char = c; t.userData.charState = cs;
    if (t.userData.isPin) {
      const pose = poses[c.id];
      if (!st && pose && (pose.key === r.key || (pose.placeId && 'place:' + pose.placeId === r.key)) && n === 1)   // keep the angle it landed at
        t.quaternion.setFromUnitVectors(UP, at.normal).multiply(new THREE.Quaternion().fromArray(pose.q));
      if (!st) t.position.addScaledVector(at.normal, -0.08 * markerScale);          // the point is buried a little
      t.userData.hit.userData = { char: c, charState: cs, pin: t, at, scale: markerScale };
      pickables.push(t.userData.hit);
      markerAnim.push(time => t.userData.update(reduceMotion ? 0 : time));          // the design's own effects (glyphs, fading glass, the seal)
    } else {
      withOutline(t, T); pickables.push(t);
      const base = t.position.clone();
      if (!reduceMotion && !dead) markerAnim.push(time => { t.position.copy(base).addScaledVector(at.normal, Math.sin(time * 2 + n) * 0.03 * markerScale); });
    }
    parent.add(t);
    t.userData.rest = { pos: t.position.clone(), quat: t.quaternion.clone() };
    const where = r.kind === 'point' ? (r.to ? ' → ' + r.to.name : ' · ?') : '';
    labels.push({ obj: t, text: (dead ? '† ' : '') + c.name + where, color: c.color, offset: (t.userData.isPin ? 0.86 : 0.62) * markerScale, normal: at.normal, marker: true });
    const pts = cs.path.map(s => s.r).filter((q, i, a) => i === 0 || q.key !== a[i - 1].key);
    for (let i = 1; i < pts.length; i++) {
      const curve = arcBetween(pts[i - 1], pts[i]), newest = i === pts.length - 1;
      if (!curve) continue;                                             // one end is beyond this view
      parent.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, (newest ? 0.035 : 0.022) * markerScale, 6, false), new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: newest ? 0.95 : 0.45 })));
      if (newest && !reduceMotion) {
        const spark = new THREE.Mesh(new THREE.SphereGeometry(0.07 * markerScale, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff' }));
        parent.add(spark);
        markerAnim.push(time => { spark.position.copy(curve.getPointAt((time * 0.25) % 1)); });
      }
    }
  });
}

// ------------------------------------------------------------------ impacts: block shockwave + camera jolt
// When a sword hits, the view it is on (board or planet) hands its nearby columns to quake(): each column hops
// up and falls back with a small bounce, timed by its distance so a wave rolls outward. A slanted hit makes the
// wave lopsided: taller and longer in the direction the sword was travelling.
const IMPACT = {
  lift: 0.34,       // tallest hop, in marker units, for the hardest hit
  reach: 3.2,       // wave radius for the hardest hit, in marker units (a gentle drop is about a third)
  speed: 7,         // how fast the wave spreads (marker units per second)
  gravity: 9,       // how quickly lifted columns fall back
  skew: 0.9,        // how lopsided a slanted hit makes the wave (0 = always round)
  shake: 0.18       // camera jolt for the hardest hit
};
let groundImpact = null;                         // set by the view builder: (pos, dir, power, slant) => list of columns
const quakes = [];
const shake = { t: 1, amp: 0 };
function impact(pos, normal, vel, power, scale) {
  if (reduceMotion || !groundImpact) return;
  power = Math.max(0, Math.min(1, power));
  const vt = vel ? vel.clone().addScaledVector(normal, -vel.dot(normal)) : new THREE.Vector3();
  const slant = vel && vel.lengthSq() > 1e-8 ? Math.min(1, vt.length() / vel.length()) : 0;
  const dir = vt.lengthSq() > 1e-8 ? vt.normalize() : null;
  const reach = IMPACT.reach * scale * (0.35 + 0.65 * power);
  const q = groundImpact(pos, reach);           // [{ r, d (unit vector from impact, along the ground), set(lift) }], plus flush()
  if (!q || !q.cols.length) return;
  const g = IMPACT.gravity * scale, items = [];
  q.cols.forEach(cl => {
    const cos = dir ? cl.d.dot(dir) : 0;
    const rEff = cl.r / (1 + 0.6 * IMPACT.skew * slant * Math.max(0, cos));              // reaches further ahead
    if (rEff > reach) return;
    const fall = Math.exp(-rEff / (reach * 0.42)), inner = smooth01(cl.r / (0.45 * scale));  // the column under the sword barely moves
    const A = IMPACT.lift * scale * power * fall * inner * Math.max(0.15, 1 + IMPACT.skew * slant * cos);
    if (A < 0.004 * scale) return;
    const v0 = Math.sqrt(2 * g * A);
    items.push({ set: cl.set, delay: rEff / (IMPACT.speed * scale), v0, T1: 2 * v0 / g, v1: v0 * 0.42 });
  });
  if (!items.length) return;
  let t = 0;
  quakes.push({ step(dt) {
    t += dt; let live = false;
    items.forEach(it => {
      let tau = t - it.delay, lift = 0;
      if (tau > 0) {
        if (tau < it.T1) lift = it.v0 * tau - g * tau * tau / 2;                         // the hop
        else if ((tau -= it.T1) < 2 * it.v1 / g) lift = it.v1 * tau - g * tau * tau / 2;  // a small bounce
        else { if (!it.done) { it.done = true; it.set(0); } return; }
      }
      live = true; it.set(Math.max(0, lift));
    });
    q.flush();
    return !live;
  } });
  shake.t = 0; shake.amp = Math.max(shake.amp * (1 - shake.t), IMPACT.shake * scale * power);
}

// ------------------------------------------------------------------ VIEW 02: the Earth board (Shattered look, real data)
let BW = 36, BH = 26;
function setLayoutConstants() {
  BH = BW * LAY.H / LAY.W;
  const cr = 13 / LAY.cdisc * LAY.rd;               // crater out to ~77°S
  CRATER.c = [LAY.dcx / LAY.W, 1 - LAY.dcy / LAY.H];
  CRATER.r = [cr / LAY.W, cr / LAY.H];
  EARTH_FIT_X = 0.92; EARTH_FIT_Y = 0.92 * LAY.H / LAY.W;
}
const uvToBoard = (u, v) => new THREE.Vector3((u - 0.5) * BW, 0, -(v - 0.5) * BH);
function buildEarth() {
  const T = THEMES[state.theme];
  const NX = isSmall() ? 170 : 230, NZ = Math.round(NX * BH / BW), cell = BW / NX;
  const BASE = 0.7, LEVEL_H = 0.11, PIT_DEPTH = 0.62;
  const topOf = c => c.kind === 'pit' ? -c.band / PIT_STEPS * PIT_DEPTH
    : c.kind === 'sea' || c.kind === 'sunk' ? 0.05 : 0.16 + c.band * LEVEL_H;
  const colOf = c => {
    if (c.kind === 'sea') return new THREE.Color(T.seaBands[c.band]);
    if (c.kind === 'sunk') return new THREE.Color(T.flood);
    if (c.kind === 'pit') return new THREE.Color(T.rock).lerp(new THREE.Color(T.glow), Math.pow(c.band / PIT_STEPS, 3));
    if (c.kind === 'rim') return c.band >= 7 ? new THREE.Color(T.ice) : new THREE.Color(T.rock).lerp(rampColor(T, c.band), 0.25);
    return rampColor(T, c.band);
  };
  const cells = [], index = new Int32Array(NX * NZ).fill(-1);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const u = (i + 0.5) / NX, v = (j + 0.5) / NZ;
    const c0 = earthAt(u, v, 0);
    if (c0.kind === 'out') continue;
    const c1 = earthAt(u, v, 1);
    index[j * NX + i] = cells.length;
    cells.push({ x: (u - 0.5) * BW, z: -(v - 0.5) * BH, c: [c0, c1], d: craterDist(u, v), state: -1 });
  }
  const maxD = Math.max(...cells.map(c => c.d)); state.waveMaxD = maxD;
  cells.forEach(c => { c.delay = Math.min(1, c.d / maxD) * 0.85; });

  const boxGeo = new THREE.BoxGeometry(cell * 0.96, 1, cell * 0.96).translate(0, 0.5, 0);
  const vox = new THREE.InstancedMesh(boxGeo, toonMaterial(), cells.length);
  vox.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cells.length * 3), 3);
  const m4 = new THREE.Matrix4();
  const write = (idx, era) => {
    const cl = cells[idx], c = cl.c[era], top = topOf(c);
    m4.makeScale(1, top + BASE, 1).setPosition(cl.x, -BASE, cl.z);
    vox.setMatrixAt(idx, m4); vox.setColorAt(idx, colOf(c)); cl.state = era;
  };
  const applyEra = (eraT, target) => {
    let changed = false;
    for (let i = 0; i < cells.length; i++) {
      const cl = cells[i];
      const want = target === 1 ? (eraT > cl.delay ? 1 : 0) : ((1 - eraT) > (0.85 - cl.delay) ? 0 : 1);
      if (cl.state !== want) { write(i, want); changed = true; }
    }
    if (changed) { vox.instanceMatrix.needsUpdate = true; vox.instanceColor.needsUpdate = true; }
  };
  for (let i = 0; i < cells.length; i++) write(i, state.era);
  vox.castShadow = vox.receiveShadow = true;
  withOutline(vox, T, T.outlinePx * 0.7);
  root.add(vox);
  eraHooks.push(applyEra);
  groundImpact = (pos, reach) => {
    const cols = [], i0 = Math.floor((pos.x / BW + 0.5) * NX), j0 = Math.floor((-pos.z / BH + 0.5) * NZ), k = Math.ceil(reach / cell) + 1;
    for (let j = j0 - k; j <= j0 + k; j++) for (let i = i0 - k; i <= i0 + k; i++) {
      if (i < 0 || j < 0 || i >= NX || j >= NZ) continue;
      const idx = index[j * NX + i]; if (idx < 0) continue;
      const cl = cells[idx], dx = cl.x - pos.x, dz = cl.z - pos.z, r = Math.hypot(dx, dz);
      if (r > reach * 1.7) continue;
      cols.push({ r, d: new THREE.Vector3(dx, 0, dz).normalize(), set: lift => {
        const c = cl.c[Math.max(0, cl.state)];
        m4.makeScale(1, topOf(c) + BASE, 1).setPosition(cl.x, -BASE + lift, cl.z); vox.setMatrixAt(idx, m4);
      } });
    }
    return { cols, flush: () => { vox.instanceMatrix.needsUpdate = true; } };
  };

  // Era 1 set pieces, grouped so they can rise and fade with the era
  const lore = new THREE.Group(); root.add(lore);
  const cw = uvToBoard(CRATER.c[0], CRATER.c[1]);
  const crx = CRATER.r[0] * BW, crz = CRATER.r[1] * BH;
  const seal = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(crx, crz) * 0.62, Math.min(crx, crz) * 0.62).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: sealTexture(T), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  seal.position.set(cw.x, -PIT_DEPTH + 0.02, cw.z);
  lore.add(seal);
  const pitLight = new THREE.PointLight(T.glow, 0, 6, 1.5); pitLight.position.set(cw.x, -PIT_DEPTH + 0.4, cw.z); lore.add(pitLight);

  // floating island: a block chunk (ice cap on a rock cone)
  const fl = []; const R = Math.max(4, Math.round(Math.min(crx, crz) / cell * 0.55)), D = Math.round(R * 1.7);
  for (let y = 2; y >= -D; y--) {
    const r = y >= 0 ? R - (y === 2 ? 1.6 : y === 1 ? 0.6 : 0) : R * (1 + y / (D + 1)) + noise(y * 0.7, 3.3) * 1.1;
    for (let z = -R; z <= R; z++) for (let x = -R; x <= R; x++) {
      const rr = Math.hypot(x, z) + noise(x * 0.9 + y, z * 0.9) * 0.8;
      if (rr <= r) fl.push([x, y, z, y >= 0 && !(y === 0 && rr > R - 1.2)]);
    }
  }
  const floater = new THREE.InstancedMesh(new THREE.BoxGeometry(cell * 0.96, cell * 0.96, cell * 0.96), toonMaterial(), fl.length);
  fl.forEach(([x, y, z, ice], i) => {
    m4.makeTranslation(x * cell, y * cell, z * cell); floater.setMatrixAt(i, m4);
    floater.setColorAt(i, ice ? new THREE.Color(T.ice) : new THREE.Color(T.rock).multiplyScalar(0.85 + (noise(x, z + y) + 1) * 0.2));
  });
  floater.castShadow = true;
  withOutline(floater, T, T.outlinePx * 0.7);
  const floatGroup = new THREE.Group(); floatGroup.add(floater); lore.add(floatGroup);
  floatGroup.userData.lore = 'floater';
  labels.push({ obj: floatGroup, text: 'The floating island', color: T.glow, offset: cell * 4, normal: UP.clone(), era: 1 });

  // loose fragments around the strike (Shattered's drifting blocks, only here)
  const nFrag = 70, fragData = [];
  const frag = new THREE.InstancedMesh(new THREE.BoxGeometry(cell * 0.8, cell * 0.8, cell * 0.8), mat(T.rock), nFrag);
  for (let i = 0; i < nFrag; i++) {
    const a = i * 2.39996, rr = 0.6 + ((i * 37) % 23) / 23 * 1.4;
    fragData.push({ a, rr, y: 0.5 + ((i * 53) % 17) / 17 * 2.2, ph: i * 1.3, s: 0.7 + ((i * 13) % 7) / 8, w: 0.04 + ((i * 7) % 5) / 60 });
  }
  frag.castShadow = true;
  withOutline(frag, T, T.outlinePx * 0.7);
  lore.add(frag);

  const islandTop = 2.6;
  const placeLore = (time, eraT) => {
    const e = eraT * eraT * (3 - 2 * eraT);
    lore.visible = eraT > 0.01;
    seal.material.opacity = e; seal.rotation.y = time * 0.1;
    pitLight.intensity = e * 6;
    floatGroup.position.set(cw.x, THREE.MathUtils.lerp(-PIT_DEPTH, islandTop, e) + Math.sin(time * 0.8) * 0.05, cw.z);
    floatGroup.rotation.y = time * 0.04;
    const q = new THREE.Quaternion(), eu = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    fragData.forEach((f, i) => {
      const a = f.a + time * f.w;
      eu.set(time * 0.3 + f.ph, time * 0.2 + f.ph * 2, 0); q.setFromEuler(eu);
      p.set(cw.x + Math.cos(a) * crx * f.rr, THREE.MathUtils.lerp(-PIT_DEPTH, f.y, e) + Math.sin(time * 0.8 + f.ph) * 0.08, cw.z + Math.sin(a) * crz * f.rr * 1.6);
      s.setScalar(f.s * e + 1e-4); m4.compose(p, q, s); frag.setMatrixAt(i, m4);
    });
    frag.instanceMatrix.needsUpdate = true;
  };
  animated.push((time) => placeLore(time, state.eraT));

  // the board edge: Earth ends here, the open sea of Epitaph begins
  const edgePts = LAY.outline.map(([u, v]) => uvToBoard(u, v).setY(0.08));
  const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(edgePts), new THREE.LineDashedMaterial({ color: T.edge, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.7 }));
  edge.computeLineDistances(); root.add(edge);

  root.add(gridLines(T, -BASE - 0.002, 60, cell * 6, state.theme === 'crt' ? 0.07 : 0.12));
  root.add(shadowGround(T, -BASE - 0.01, 90));

  surface = (lat, lng) => {
    const [u, v] = eeUV(lng, lat);
    const i = Math.floor(u * NX), j = Math.floor(v * NZ);
    const idx = i >= 0 && j >= 0 && i < NX && j < NZ ? index[j * NX + i] : -1;
    const top = idx >= 0 ? topOf(cells[idx].c[state.era]) : 0.05;
    return { pos: uvToBoard(u, v).setY(top + 0.01), normal: UP.clone() };
  };
  arcBetween = (a, b) => {
    const s0 = spotAt(a), s1 = spotAt(b); if (!s0 || !s1) return null;
    const p0 = s0.pos, p1 = s1.pos;
    const mid = p0.clone().lerp(p1, 0.5); mid.y = Math.max(p0.y, p1.y) + 0.8 + p0.distanceTo(p1) * 0.2;
    return new THREE.QuadraticBezierCurve3(p0.clone().setY(p0.y + 0.3), mid, p1.clone().setY(p1.y + 0.3));
  };
  addMarkers(T, 1);

  // lore labels
  const lbl = (text, pos, era) => { const o = new THREE.Object3D(); o.position.copy(pos); root.add(o); labels.push({ obj: o, text, color: T.glow, offset: 0, normal: UP.clone(), era }); };
  lbl('Blankslate · down the crater', cw.clone().setY(0.25), 1);
  lbl('Impact mountains', uvToBoard(CRATER.c[0] - CRATER.r[0] * 1.25, CRATER.c[1] + CRATER.r[1] * 0.6).setY(1.2), 1);
  lbl('Antarctica · closest to the core', cw.clone().setY(0.6), 0);
  lbl('Open sea · the rest of Epitaph', uvToBoard(1.0, 0.62).setY(0.1), 'both');

  key.position.set(-16, 22, 10); key.target.position.set(0, 0, 0);
  setShadowBox(22);
  return { home: { az: -0.2, el: 0.9, zoom: 1, target: new THREE.Vector3(0, 0, 0.6) }, fit: [BW + 3, BH + 2], minEl: 0.25, maxEl: 1.45 };
}

// ------------------------------------------------------------------ VIEW 01: Epitaph, the planet (Globe look)
const PR = 6;                                      // planet radius
const CAP = 30 * Math.PI / 180;                    // angular radius of the Earth patch (not to scale)
const EARTH_DIR = new THREE.Vector3(0, 0.26, 1).normalize();
const capE1 = new THREE.Vector3().crossVectors(UP, EARTH_DIR).normalize();        // east on the patch
const capE2 = new THREE.Vector3().crossVectors(EARTH_DIR, capE1).normalize();     // north on the patch
let EARTH_FIT_X = 0.92, EARTH_FIT_Y = 0.66;         // map uv rectangle → patch disc units (set from the layout)
// patch disc (px, py in [-1, 1]) → unit vector on the sphere (exponential map around EARTH_DIR)
function capToDir(px, py) {
  const r = Math.hypot(px, py), ang = r * CAP;
  if (r < 1e-9) return EARTH_DIR.clone();
  const dir = capE1.clone().multiplyScalar(px / r).addScaledVector(capE2, py / r);
  return EARTH_DIR.clone().multiplyScalar(Math.cos(ang)).addScaledVector(dir, Math.sin(ang)).normalize();
}
function uvToDir(u, v) { return capToDir((u * 2 - 1) * EARTH_FIT_X, (v * 2 - 1) * EARTH_FIT_Y); }

function buildPlanet() {
  const T = THEMES[state.theme];
  const planet = new THREE.Group(); root.add(planet);
  state.planet = planet;

  const ocean = new THREE.Mesh(new THREE.SphereGeometry(PR * 0.995, 72, 54), mat(T.sea, { roughness: 0.6 }));
  ocean.receiveShadow = true;
  withOutline(ocean, T, T.outlinePx * 1.6);
  planet.add(ocean);
  // graticule
  const gp = [], ll = (lat, lng) => { const phi = (90 - lat) * Math.PI / 180, th = (lng + 180) * Math.PI / 180; return new THREE.Vector3(-Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)).multiplyScalar(PR * 1.002); };
  for (let lat = -60; lat <= 60; lat += 30) for (let lng = -180; lng < 180; lng += 3) { const a = ll(lat, lng), b = ll(lat, lng + 3); gp.push(a.x, a.y, a.z, b.x, b.y, b.z); }
  for (let lng = -180; lng < 180; lng += 30) for (let lat = -87; lat < 87; lat += 3) { const a = ll(lat, lng), b = ll(lat + 3, lng); gp.push(a.x, a.y, a.z, b.x, b.y, b.z); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  planet.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: T.seaLine, transparent: true, opacity: 0.8 })));

  // Earth: dense hex columns inside the patch, sampled from the real map
  const N = isSmall() ? 9000 : 15000, golden = Math.PI * (3 - Math.sqrt(5));
  const earthCells = [];
  for (let i = 0; i < N; i++) {
    const r = Math.sqrt((i + 0.5) / N), th = i * golden;
    const px = r * Math.cos(th), py = r * Math.sin(th);
    const u = (px / EARTH_FIT_X + 1) / 2, v = (py / EARTH_FIT_Y + 1) / 2;
    if (u < 0 || u > 1 || v < 0 || v > 1) continue;
    const c0 = earthAt(u, v, 0);
    if (c0.kind === 'out') continue;
    earthCells.push({ dir: capToDir(px, py), c: [c0, earthAt(u, v, 1)], d: craterDist(u, v), state: -1 });
  }
  const capCellR = PR * CAP * Math.sqrt(1 / N) * 0.95;
  const colGeo = new THREE.CylinderGeometry(capCellR, capCellR, 1, 6).translate(0, 0.5, 0);
  const cols = new THREE.InstancedMesh(colGeo, mat('#ffffff', { roughness: 0.7 }), earthCells.length);
  cols.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(earthCells.length * 3), 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const hOf = c => c.kind === 'land' ? 0.04 + c.band * 0.05 : c.kind === 'rim' ? 0.1 + c.band * 0.06 : c.kind === 'sunk' ? 0.02 : c.kind === 'pit' ? 0.001 : 0.012;
  const cOf = c => c.kind === 'sea' ? new THREE.Color(T.seaBands[c.band]) : c.kind === 'sunk' ? new THREE.Color(T.flood)
    : c.kind === 'pit' ? new THREE.Color(T.glow) : c.kind === 'rim' ? new THREE.Color(T.rock).lerp(new THREE.Color(T.ice), c.band >= 7 ? 1 : 0.2) : rampColor(T, c.band);
  const write = (i, era) => {
    const cl = earthCells[i], c = cl.c[era];
    q.setFromUnitVectors(UP, cl.dir);
    m4.compose(cl.dir.clone().multiplyScalar(PR * 0.995), q, sc.set(1, hOf(c), 1));
    cols.setMatrixAt(i, m4); cols.setColorAt(i, cOf(c)); cl.state = era;
  };
  earthCells.forEach((_, i) => write(i, state.era));
  cols.castShadow = cols.receiveShadow = true;
  withOutline(cols, T, T.outlinePx * 0.6);
  cols.userData.earth = true;
  planet.add(cols); pickables.push(cols);
  groundImpact = (pos, reach) => {
    const list = [], at = pos.clone().normalize(), n = at, tq = new THREE.Quaternion(), ts = new THREE.Vector3(), tm = new THREE.Matrix4();
    earthCells.forEach((cl, i) => {
      const p = cl.dir.clone().multiplyScalar(PR), r = p.distanceTo(at.clone().multiplyScalar(PR));
      if (r > reach * 1.7) return;
      const d = p.clone().sub(at.clone().multiplyScalar(PR)); d.addScaledVector(n, -d.dot(n)); if (d.lengthSq() > 1e-12) d.normalize();
      list.push({ r, d, set: lift => {
        const c = cl.c[Math.max(0, cl.state)];
        tq.setFromUnitVectors(UP, cl.dir);
        tm.compose(cl.dir.clone().multiplyScalar(PR * 0.995 + lift), tq, ts.set(1, hOf(c), 1)); cols.setMatrixAt(i, tm);
      } });
    });
    return { cols: list, flush: () => { cols.instanceMatrix.needsUpdate = true; } };
  };
  const maxD = Math.max(...earthCells.map(c => c.d)); state.waveMaxD = maxD;
  eraHooks.push((eraT, target) => {
    let changed = false;
    earthCells.forEach((cl, i) => {
      const delay = Math.min(1, cl.d / maxD) * 0.85;
      const want = target === 1 ? (eraT > delay ? 1 : 0) : ((1 - eraT) > (0.85 - delay) ? 0 : 1);
      if (cl.state !== want) { write(i, want); changed = true; }
    });
    if (changed) { cols.instanceMatrix.needsUpdate = true; cols.instanceColor.needsUpdate = true; }
  });

  // Earth's shore: a dashed outline around the island
  const edgePts = LAY.outline.map(([u, v]) => uvToDir(u, v).multiplyScalar(PR * 1.006));
  const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(edgePts), new THREE.LineDashedMaterial({ color: T.edge, dashSize: 0.12, gapSize: 0.08 }));
  edge.computeLineDistances(); planet.add(edge);
  const earthTag = new THREE.Object3D(); earthTag.position.copy(uvToDir(0.5, 0.98).multiplyScalar(PR * 1.02)); planet.add(earthTag);
  labels.push({ obj: earthTag, text: 'EARTH · click to open', color: T.edge, offset: 0.3, normal: uvToDir(0.5, 0.98) });

  // the rest of Epitaph: unmapped. Faint ghost landmasses, placeholders until the lore decides.
  const G = isSmall() ? 5000 : 9000, ghost = [];
  for (let i = 0; i < G; i++) {
    const y = 1 - (i / (G - 1)) * 2, rr = Math.sqrt(1 - y * y), th = golden * i;
    const v = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr);
    if (v.angleTo(EARTH_DIR) < CAP * 1.18) continue;
    const n = fbm(v.x * 1.4 + 3, v.y * 1.4 + v.z * 0.9);
    if (n > 0.08) ghost.push({ v, h: 0.03 + (n - 0.08) * 0.5 });
  }
  const gR = PR * Math.sqrt(4 * Math.PI / G) * 0.42;
  const ghosts = new THREE.InstancedMesh(new THREE.CylinderGeometry(gR, gR, 1, 6).translate(0, 0.5, 0), mat(T.ghost, { roughness: 0.9, transparent: true, opacity: 0.55 }), ghost.length);
  ghost.forEach((g, i) => { q.setFromUnitVectors(UP, g.v); m4.compose(g.v.clone().multiplyScalar(PR * 0.995), q, sc.set(1, g.h, 1)); ghosts.setMatrixAt(i, m4); });
  planet.add(ghosts);
  const unk = new THREE.Object3D(); unk.position.copy(EARTH_DIR.clone().applyAxisAngle(UP, 2.2).multiplyScalar(PR * 1.05)); planet.add(unk);
  labels.push({ obj: unk, text: 'Unmapped · the real continents', color: T.grid, offset: 0.2, normal: EARTH_DIR.clone().applyAxisAngle(UP, 2.2) });

  // strike glow at Antarctica (Era 1)
  const strikeDir = uvToDir(CRATER.c[0], CRATER.c[1]);
  const strike = new THREE.Mesh(new THREE.CircleGeometry(capCellR * 9, 24), new THREE.MeshBasicMaterial({ color: T.glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  strike.position.copy(strikeDir.clone().multiplyScalar(PR * 1.004)); strike.lookAt(strikeDir.clone().multiplyScalar(PR * 2)); planet.add(strike);

  // atmosphere rim
  planet.add(new THREE.Mesh(new THREE.SphereGeometry(PR * 1.12, 64, 48), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(T.atmo) } },
    vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uColor; varying vec3 vN; void main(){ float f = pow(1. - abs(dot(vN, vec3(0.,0.,1.))), 3.); gl_FragColor = vec4(uColor, f*0.5); }`,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  })));

  // The Binding: a shell of script lines around the whole planet (Era 1)
  const binding = new THREE.Group(); planet.add(binding);
  const bR = PR * 1.22, bp = [];
  const P = (lat, lng) => { const phi = (90 - lat) * Math.PI / 180, th = lng * Math.PI / 180; return [Math.sin(phi) * Math.cos(th) * bR, Math.cos(phi) * bR, Math.sin(phi) * Math.sin(th) * bR]; };
  for (let lat = -75; lat <= 75; lat += 15) for (let lng = 0; lng < 360; lng += 4) bp.push(...P(lat, lng), ...P(lat, lng + 4));
  for (let lng = 0; lng < 360; lng += 15) for (let lat = -88; lat < 88; lat += 4) bp.push(...P(lat, lng), ...P(lat + 4, lng));
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  const bMat = new THREE.LineBasicMaterial({ color: T.binding, transparent: true, opacity: 0, depthWrite: false });
  binding.add(new THREE.LineSegments(bg, bMat));
  const bText = new THREE.MeshBasicMaterial({ map: glyphStrip(T), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(bR * 1.002, bR * 1.002, 0.3, 160, 1, true), bText); binding.add(band);
  const band2 = band.clone(); band2.rotation.z = 1.1; binding.add(band2);
  const bTag = new THREE.Object3D(); bTag.position.set(0, bR * 0.98, 0); binding.add(bTag);
  labels.push({ obj: bTag, text: 'The Binding · around the whole planet', color: T.binding, offset: 0.2, normal: UP.clone(), era: 1 });
  animated.push((time) => {
    const e = state.eraT * state.eraT * (3 - 2 * state.eraT);
    bMat.opacity = e * (state.theme === 'crt' ? 0.22 : 0.18); bText.opacity = e * 0.6;
    binding.visible = e > 0.01; band.rotation.y = time * 0.05; band2.rotation.y = -time * 0.04;
    strike.material.opacity = e * (0.55 + Math.sin(time * 2) * 0.2);
  });

  root.add(shadowGround(T, -PR - 1.4, 60));
  root.add(gridLines(T, -PR - 1.4, 30, 1.5, state.theme === 'crt' ? 0.08 : 0.14));

  // markers ride on the Earth patch
  surface = (lat, lng) => {
    const [u, v] = eeUV(lng, lat), dir = uvToDir(u, v), c = earthAt(u, v, state.era);
    return { pos: dir.clone().multiplyScalar(PR * 0.995 + hOf(c) + 0.01), normal: dir };
  };
  arcBetween = (a, b) => {
    const s0 = spotAt(a), s1 = spotAt(b); if (!s0 || !s1) return null;
    const pa = s0.pos, pb = s1.pos, pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(pa.clone().lerp(pb, t).normalize().multiplyScalar(PR + 0.12 + Math.sin(Math.PI * t) * pa.distanceTo(pb) * 0.25)); }
    return new THREE.CatmullRomCurve3(pts);
  };
  addMarkers(T, 0.32, planet);

  if (!reduceMotion) animated.push((time, dt) => { if (state.spin && performance.now() - state.lastInteract > 5000) planet.rotation.y += dt * 0.04; });
  key.position.set(-12, 18, 16); key.target.position.set(0, 0, 0);
  setShadowBox(10);
  return { home: { az: 0.0, el: 0.3, zoom: 1, target: new THREE.Vector3(0, 0, 0) }, fit: [PR * 2.8, PR * 2.8], minEl: -1.2, maxEl: 1.4 };
}

function setShadowBox(half) {
  const c = key.shadow.camera;
  c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.near = 1; c.far = 120;
  c.updateProjectionMatrix(); key.shadow.needsUpdate = true;
}

// ------------------------------------------------------------------ labels
const labelLayer = $('labels');
function syncLabelEls() {
  labelLayer.innerHTML = '';
  labels.forEach(l => { const el = document.createElement('div'); el.className = 'map-label'; el.textContent = l.text; el.style.setProperty('--c', l.color); labelLayer.appendChild(el); l.el = el; });
}
const tmpV = new THREE.Vector3(), camDir = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
function updateLabels() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  camera.getWorldDirection(camDir);
  const e = state.eraT;
  labels.forEach(l => {
    l.obj.getWorldPosition(tmpV);
    const n = l.normal.clone().applyQuaternion(l.obj.parent.getWorldQuaternion(tmpQ));
    tmpV.addScaledVector(n, l.offset);
    const facing = n.dot(camDir) < 0.15 && l.obj.visible !== false;     // a sunk sword takes its label with it
    tmpV.project(camera);
    const eraOk = l.era === undefined || l.era === 'both' || (l.era === 1 ? e > 0.6 : e < 0.4);
    const vis = eraOk && facing && tmpV.z < 1 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1;
    l.el.style.opacity = vis ? 1 : 0;
    l.el.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * w}px, ${(-tmpV.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
  });
}

// ------------------------------------------------------------------ camera
function frame() {
  const w = canvas.clientWidth, h = canvas.clientHeight, aspect = w / Math.max(1, h);
  const [fw, fh] = viewCfg.fit;
  const halfH = Math.max(fh / 2, fw / 2 / aspect) * (state.view === 'planet' ? 1 : 0.94);
  camera.left = -halfH * aspect; camera.right = halfH * aspect; camera.top = halfH; camera.bottom = -halfH;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  outlineMats.forEach(m => m.uniforms.uRes.value.set(w, h));
}
function setCamera(target, az, el, zoom, instant) {
  const pos = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(80).add(target);
  if (instant) { controls.target.copy(target); camera.position.copy(pos); camera.zoom = zoom; camera.updateProjectionMatrix(); state.focus = null; }
  else state.focus = { target: target.clone(), pos, zoom };
}
function goHome(instant) {
  const hm = viewCfg.home, portrait = canvas.clientWidth < canvas.clientHeight;
  setCamera(hm.target, hm.az, hm.el, hm.zoom * (portrait && state.view !== 'planet' ? 1.9 : 1), instant);
  if (state.planet) state.planet.rotation.y = 0;
}
function focusOn(obj, zoom = 2.6) {
  const p = obj.getWorldPosition(new THREE.Vector3()), offset = camera.position.clone().sub(controls.target);
  if (state.view === 'planet') { state.spin = false; state.focus = { target: new THREE.Vector3(0, 0, 0), pos: offset.normalize().multiplyScalar(80), zoom: 1.6 }; return; }
  state.focus = { target: p, pos: p.clone().add(offset), zoom };
}

// ------------------------------------------------------------------ build
function disposeTree(o) {
  o.traverse(n => {
    if (n.geometry && !Object.values(markerGeo).includes(n.geometry)) n.geometry.dispose();
    if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => { outlineMats.delete(m); m.map?.dispose(); m.dispose(); });
  });
}
function build() {
  if (root) { scene.remove(root); disposeTree(root); }
  root = new THREE.Group(); scene.add(root);
  pickables = []; animated = []; labels = []; eraHooks = []; markerAnim = []; markerRoot = null; state.planet = null;
  if (drag.active) endDrag(true);
  travels.length = 0; quakes.length = 0; groundImpact = null;
  const T = THEMES[state.theme];
  document.documentElement.dataset.theme = state.theme === 'crt' ? 'crt' : 'paper';
  hemi.color.set(T.hemiSky); hemi.groundColor.set(T.hemiGround); hemi.intensity = 1.1;
  key.color.set(T.key); key.intensity = state.theme === 'crt' ? 2.0 : 1.8;
  fill.position.set(14, 8, -12);
  scene.environmentIntensity = T.env; renderer.toneMappingExposure = T.exposure;
  viewCfg = (state.view === 'planet' ? buildPlanet : buildEarth)();
  controls.minPolarAngle = Math.PI / 2 - viewCfg.maxEl; controls.maxPolarAngle = Math.PI / 2 - viewCfg.minEl;
  controls.minZoom = 0.6; controls.maxZoom = 9;
  syncLabelEls(); frame(); renderKeys(); renderLore();
  $('brandView').textContent = state.view === 'planet' ? 'EPITAPH' : 'EARTH';
}
function rebuildKeepCamera() {
  const t = controls.target.clone(), p = camera.position.clone(), z = camera.zoom, rot = state.planet ? state.planet.rotation.y : null;
  build();
  controls.target.copy(t); camera.position.copy(p); camera.zoom = z; camera.updateProjectionMatrix();
  if (rot != null && state.planet) state.planet.rotation.y = rot;
}

// ------------------------------------------------------------------ UI
function renderKeys() {
  const T = THEMES[state.theme], k = [];
  k.push([T.city, 'City']);
  if (state.era === 1) k.push([T.sunk, 'Sunk city (+60 m)'], [T.groups.STORYBORN, 'Storyborn'], [T.groups.VOIDED, 'Voided (hidden)'], [T.groups.FALLEN, 'Fallen (none yet)']);
  $('keys').innerHTML = k.map(([c, t]) => `<span><em style="background:${c}"></em>${t}</span>`).join('');
}
function renderLore() {
  const T = THEMES[state.theme];
  const e0 = [
    [T.landHi, '<b>Real Earth</b>, no fake cities. One island on a planet nearly the size of the Milky Way.'],
    [T.edge, '<b>The shore</b> (dashed): past it, open sea and the real continents of Epitaph.'],
    [T.ink, '<b>No barrier yet.</b> The Scribe hasn\'t raised one.'],
  ];
  const e1 = [
    [T.glow, '<b>The crater</b>: the gods went straight through Antarctica, down to <b>Blankslate</b>.'],
    [T.rock, '<b>Impact mountains</b> ring it; the sea can\'t get in.'],
    [T.flood, '<b>+60 m sea</b>: Antarctica\'s ice is gone. Teal land has sunk.'],
    [T.ice, '<b>The floating island</b> hangs where they struck.'],
    [T.binding, '<b>The Binding</b> wraps the whole planet' + (state.view === 'planet' ? '.' : ' (see 01 Epitaph).')],
  ];
  $('loreTitle').textContent = state.era === 1 ? 'Era 1 · after the siege' : 'Era 0 · before the siege';
  $('loreList').innerHTML = (state.era === 1 ? e1 : e0).map(([c, t]) => `<li><i style="background:${c}"></i>${t}</li>`).join('');
}
function renderLegend() {
  const ul = $('legendList'); ul.innerHTML = '';
  if (state.era !== 1) { ul.innerHTML = '<li style="font-size:10px;opacity:.7;padding:4px">The story\'s chapters take place in Era 1.</li>'; $('demoNote').hidden = true; return; }
  state.chars.forEach(c => {
    const cs = charStateAt(c, state.chapter);
    const li = document.createElement('li');
    li.innerHTML = `<button type="button"><i style="background:${c.color}"></i><b></b><span></span></button>`;
    li.querySelector('b').textContent = c.name;
    li.querySelector('span').textContent = cs ? (cs.stop.presence === 'dead' ? '† ' : '') + cs.stop.r.name : 'not in story yet';
    li.querySelector('button').disabled = !cs;
    li.querySelector('button').addEventListener('click', () => { const tok = pickables.find(p => p.userData.char && p.userData.char.id === c.id); if (tok) focusOn(tok); openRecord(c.id); });
    ul.appendChild(li);
  });
  const un = state.unplaced || [];
  $('unplaced').hidden = !un.length || state.demo;
  $('unplaced').innerHTML = un.length ? `<b>Not on the map</b>${un.map(esc).join(', ')}. Set a location for them in the Dossier.` : '';
  $('demoNote').hidden = !state.demo;
  if (recordId) openRecord(recordId);
}
// ---- a character's record (moved from the old 2D Atlas): where they are, how they are, their objective, their trail
let recordId = null;
function openRecord(id) {
  const c = state.chars.find(x => x.id === id), box = $('record');
  if (!c) { closeRecord(); return; }
  recordId = id;
  const cs = charStateAt(c, state.chapter), s = cs && cs.stop;
  const PRESENCE = { alive: 'Alive', dead: 'Dead', missing: 'Missing' };
  const ch = s && s.ch != null ? s.ch : state.chapter;
  const trail = c.stops.map(st => `<li class="${s === st ? 'now' : ''}"><span>${st.ch != null ? 'CH ' + String(st.ch).padStart(2, '0') : 'Now'}</span><span>${esc(st.r.kind === 'point' ? st.r.name : st.r.label)}${st.presence === 'dead' ? ' · †' : ''}</span></li>`).join('');
  box.style.setProperty('--c', c.color);
  box.innerHTML = `<h4><span>${esc(c.name)}</span><button type="button" aria-label="Close the record" id="recordClose">×</button></h4>` +
    (s ? `<dl><dt>Where</dt><dd>${esc(s.r.kind === 'point' ? s.r.name : s.r.path || s.r.label)}</dd><dt>State</dt><dd>${PRESENCE[s.presence] || 'Alive'}</dd>` +
         (s.objective ? `<dt>Objective</dt><dd>${esc(s.objective)}</dd>` : '') + (s.ch != null ? `<dt>Since</dt><dd>Chapter ${s.ch}</dd>` : '') + `</dl>`
       : `<p>Not in the story yet at this chapter.</p>`) +
    `<dt style="font-family:'Bebas Neue',sans-serif;letter-spacing:.1em;font-size:13px;color:var(--amber)">Trail</dt><ol>${trail}</ol>` +
    `<a href="index.html?char=${encodeURIComponent(c.id)}${Number.isInteger(ch) ? '&ch=' + ch : ''}">Open in the Dossier →</a>`;
  box.hidden = false; $('lore').hidden = true;
  $('recordClose').addEventListener('click', closeRecord);
}
function closeRecord() { recordId = null; $('record').hidden = true; $('lore').hidden = false; }
function setChapterUI() {
  const idx = state.chapters.indexOf(state.chapter);
  $('chapterRange').max = Math.max(0, state.chapters.length - 1);
  $('chapterRange').value = idx < 0 ? state.chapters.length - 1 : idx;
  $('chapterRange').disabled = state.chapters.length < 2 || state.era !== 1;
  const ch = state.chapter;
  $('chapterLabel').textContent = state.era !== 1 ? 'Era 0' : ch == null ? 'Latest' : 'Ch ' + String(ch).padStart(2, '0') + (state.titles[ch] && !state.demo ? ' · ' + state.titles[ch] : '');
}
function setChapter(ch) {
  const before = pinPositions();                 // where every sword stands now
  state.chapter = ch; setChapterUI();
  if (markerRoot && !drag.active) { refreshMarkers(); if (!reduceMotion) flyToChapter(before); }
  else rebuildKeepCamera();
  renderLegend();
}
const remember = () => { try { localStorage.setItem('epitaph-map-prefs', JSON.stringify({ view: state.view, theme: state.theme, era: state.era })); } catch (e) {} };
// ---- switching views with a zoom: Epitaph → Earth dives onto the Earth patch, fades, and the board pulls back from close in;
// Earth → Epitaph zooms in on the board, fades, and the planet pulls back out from its Earth patch
const zfx = { cam: null, veil: null, busy: false };
const veil = document.createElement('div');
Object.assign(veil.style, { position: 'absolute', inset: '0', pointerEvents: 'none', opacity: '0', zIndex: '2' });
canvas.parentElement.appendChild(veil);
const easeInOut = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, easeOut = k => 1 - Math.pow(1 - k, 3), easeIn = k => k * k * k;
function tweenCam(to, dur, ease, done) { zfx.cam = { t: 0, dur, ease, done, to, from: { target: controls.target.clone(), pos: camera.position.clone(), zoom: camera.zoom } }; }
function fadeVeil(to, dur, done) { veil.style.background = THEMES[state.theme].bg; zfx.veil = { t: 0, dur, done, from: +veil.style.opacity || 0, to }; }
function stepViewFx(dt) {
  const c = zfx.cam;
  if (c) {
    c.t += dt; const k = c.ease(Math.min(1, c.t / c.dur));
    controls.target.lerpVectors(c.from.target, c.to.target, k); camera.position.lerpVectors(c.from.pos, c.to.pos, k);
    camera.zoom = c.from.zoom + (c.to.zoom - c.from.zoom) * k; camera.updateProjectionMatrix();
    if (c.t >= c.dur) { zfx.cam = null; c.done && c.done(); }
  }
  const f = zfx.veil;
  if (f) { f.t += dt; const k = Math.min(1, f.t / f.dur); veil.style.opacity = String(f.from + (f.to - f.from) * k); if (k >= 1) { zfx.veil = null; f.done && f.done(); } }
}
function switchView(v) {
  state.view = v; remember();
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x.dataset.view === v));
  build(); goHome(true); renderLegend();
}
const camPose = () => ({ target: controls.target.clone(), pos: camera.position.clone(), zoom: camera.zoom });
function setView(v) {
  if (state.view === v || zfx.busy) return;
  if (reduceMotion || !viewCfg || drag.active) { switchView(v); return; }
  zfx.busy = true; controls.enabled = false; state.focus = null; state.spin = false;
  const finish = () => { zfx.busy = false; controls.enabled = true; state.lastInteract = performance.now(); };
  if (v === 'earth') {
    // dive: face the Earth patch square on and zoom into it
    const dir = EARTH_DIR.clone(); if (state.planet) dir.applyQuaternion(state.planet.quaternion);
    const target = dir.clone().multiplyScalar(PR);
    tweenCam({ target, pos: target.clone().addScaledVector(dir, 80), zoom: 3.6 }, 1.0, easeInOut, () => fadeVeil(1, .22, () => {
      switchView('earth');
      const home = camPose(); camera.zoom = home.zoom * 3.2; camera.updateProjectionMatrix();
      fadeVeil(0, .3); tweenCam(home, 1.15, easeOut, finish);
    }));
  } else {
    // out: push in on the board, then the planet pulls back from its Earth patch
    const p = camPose();
    tweenCam({ target: p.target, pos: p.pos, zoom: p.zoom * 2.6 }, .55, easeIn, () => fadeVeil(1, .2, () => {
      switchView('planet');
      const home = camPose(), dir = EARTH_DIR.clone(), target = dir.clone().multiplyScalar(PR);
      controls.target.copy(target); camera.position.copy(target).addScaledVector(dir, 80); camera.zoom = 3.6; camera.updateProjectionMatrix();
      fadeVeil(0, .3); tweenCam(home, 1.2, easeOut, () => { state.spin = true; finish(); });
    }));
  }
}
let eraBusy = false;
const stayInEra0 = c => designFor(c) === 'vale';
// Era 0 clicked: every sword but Vale's sinks into the ground at once, one after another, in a puff of block dust
function vanishPins() {
  let i = 0;
  pickables.forEach(h => {
    const pin = h.userData.pin; if (!pin || !h.userData.char || stayInEra0(h.userData.char)) return;
    if (reduceMotion) { pin.visible = false; return; }
    const start = pin.position.clone(), n = state.view === 'planet' ? start.clone().normalize() : UP.clone(), down = pin.scale.x * 1.15, delay = i++ * .07;
    pin.userData.travelling = true; let t = -delay, puffed = false;
    travels.push({ step(dt) {
      t += dt; if (t < 0) return false;
      if (!puffed) { puffed = true; burst(start, n, h.userData.scale, false); }
      const k = Math.min(1, t / .55), e = k * k * (3 - 2 * k);
      pin.position.copy(start).addScaledVector(n, -down * e + Math.sin(k * Math.PI) * .03 * h.userData.scale);
      pin.rotateOnAxis(UP, dt * 6 * (1 - k));                         // a twist as it goes
      if (k >= 1) { this.finish(); return true; }
      return false;
    }, finish() { pin.visible = false; pin.userData.travelling = false; } });
  });
}
// Era 0 from a later chapter: first rewind the chapter slider, one chapter at a time from where it is now (not from the newest),
// down to the first chapter, the swords flying back each step; then switch eras
let rewinding = false;
function setEra(era) {
  if (state.era === era || rewinding) return;
  const idx = state.chapter == null ? state.chapters.length - 1 : state.chapters.indexOf(state.chapter);
  if (era === 0 && state.era === 1 && idx > 0 && !reduceMotion && !drag.active) {
    rewinding = true; $('chapterRange').disabled = true;
    const steps = idx, wait = Math.min(.45, Math.max(.12, 2.4 / steps)) * 1000;
    let i = idx;
    const tick = () => {
      i -= 1; setChapter(state.chapters[i]); $('chapterRange').disabled = true;
      if (i > 0) setTimeout(tick, wait);
      else setTimeout(() => { rewinding = false; applyEra(0); }, 900);       // let the last flights land, then switch
    };
    setTimeout(tick, 60);
    return;
  }
  applyEra(era);
}
function applyEra(era) {
  if (state.era === era) return;
  if (era === 0) { eraReturn = null; vanishPins(); }
  state.era = era; remember();
  document.querySelectorAll('[data-era]').forEach(x => x.classList.toggle('on', +x.dataset.era === era));
  eraBusy = true;            // markers are rebuilt once the wave has finished
  renderLore(); renderKeys(); setChapterUI(); renderLegend();
  if (era === 1 && !reduceMotion && markerRoot) { refreshMarkers(); startEraReturn(); }   // swords wait underground for the wave
  if (reduceMotion) { state.eraT = era; rebuildKeepCamera(); eraBusy = false; }
}

document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
document.querySelectorAll('[data-era]').forEach(b => b.addEventListener('click', () => setEra(+b.dataset.era)));
document.querySelectorAll('[data-theme-btn]').forEach(b => b.addEventListener('click', () => {
  state.theme = b.dataset.themeBtn; remember();
  document.querySelectorAll('[data-theme-btn]').forEach(x => x.classList.toggle('on', x === b));
  rebuildKeepCamera();
}));
$('chapterRange').addEventListener('input', e => !rewinding && setChapter(state.chapters[+e.target.value] ?? null));
$('prevCh').addEventListener('click', () => { if (rewinding) return; const i = state.chapters.indexOf(state.chapter); if (i > 0) setChapter(state.chapters[i - 1]); });
$('nextCh').addEventListener('click', () => { if (rewinding) return; const i = state.chapters.indexOf(state.chapter); if (i >= 0 && i < state.chapters.length - 1) setChapter(state.chapters[i + 1]); });
$('homeBtn').addEventListener('click', () => { state.spin = true; goHome(false); });
$('legendToggle').addEventListener('click', () => $('legend').classList.toggle('open'));
const LibUI = window.EpitaphLibraryUI;
if (LibUI) {
  $('libraryBtn').addEventListener('click', () => LibUI.open());
  LibUI.hooks.onChange = () => { const d = loadCharacters(); Object.assign(state, { chars: d.chars, chapters: d.chapters, titles: d.titles, demo: d.demo }); setChapterUI(); rebuildKeepCamera(); renderLegend(); };
  LibUI.hooks.showPlace = id => {
    const go = () => { const m = pickables.find(p => p.userData.place && p.userData.place.id === id); if (m) focusOn(m, 3.2); };
    if (state.view !== 'earth') { setView('earth'); setTimeout(go, 2600); } else go();
    if (matchMedia('(max-width:700px)').matches) LibUI.close();
  };
} else $('libraryBtn').hidden = true;

// hover + click
const tip = $('tip');
canvas.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  tip.style.left = (e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px';
});
canvas.addEventListener('pointerleave', () => pointer.set(9, 9));
['pointerdown', 'wheel'].forEach(ev => canvas.addEventListener(ev, () => { state.lastInteract = performance.now(); state.focus = null; }, { passive: true }));
let hovered = null, downAt = null;
canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const hit = pick();
  if (!hit) return;
  if (hit.userData.earth) { setView('earth'); return; }      // planet → Earth board
  const pl = hit.userData.place, statueSite = pl && state.era === 1 && (World.STATUES || []).includes(pl.id);
  if (statueSite) { openSettlementCloseup(pl); return; }        // a statue site: everyone snapped to it, in its close-up
  const site = siteOf(pl);
  if (site) { location.href = site; return; }                 // a place with a built site opens it
  focusOn(hit);
});
function pick() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  return hits.length ? hits[0].object : null;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// a place opens a site if it has one, or if it belongs to a city that has one (e.g. a temple in Aurelia)
const siteOf = p => p ? ((World.SITES || {})[p.id] || (World.SITES || {})[p.cityId] || null) : null;
function describe(obj) {
  if (obj.userData.earth) return '<b>Earth</b><span>An island on Epitaph. Click to open the board.</span>';
  if (obj.userData.char) {
    const { char, charState } = obj.userData, s = charState.stop;
    return `<b>${esc(char.name)}</b><span>${s.r.kind === 'point' ? esc(s.r.name) : (s.presence === 'dead' ? 'Died at ' : 'At ') + esc(s.r.label)}</span>` + (s.ch != null ? `<span>From chapter ${s.ch}</span>` : '') +
      (obj.userData.pin && s.presence !== 'dead' ? `<span class="here">${s.locked ? 'Chapter locked: reopen it in the Dossier to move' : 'Click for a close-up · drag to move them'}</span>` : '');
  }
  const p = obj.userData.place;
  const here = state.era === 1 ? state.chars.filter(c => { const cs = charStateAt(c, state.chapter); return cs && cs.stop.r.place && cs.stop.r.place.id === p.id; }) : [];
  const co = World.country(p.countryId);
  return `<b>${esc(p.name)}</b><span>${esc(World.KIND_LABEL[p.kind] || 'Place')}${co ? ' · ' + esc(co.name) : ''}</span>` +
    (obj.userData.sunk ? '<span>Sunk: the sea rose ~60 m in Era 1.</span>' : '') +
    (p.fictional ? '<span>Era 1 settlement</span>' : '') +
    (siteOf(p) ? '<span class="here">Click to open the site</span>' : '') +
    (p.group ? `<span>${esc((World.SITE_GROUPS.find(g => g.id === p.group) || {}).label || p.group)} site${p.group === 'VOIDED' ? ' · hidden' : ''}</span>` : '') +
    (here.length ? `<span class="here">Here: ${here.map(c => esc(c.name)).join(', ')}</span>` : '');
}

// ------------------------------------------------------------------ character pins: pick up, carry, magnet, drop
// Each living character stands on the map as a greatsword stuck in the ground (assets/atlas3d/pins/greatsword.glb,
// built by tools/map/greatsword_pin.py; origin at the blade tip, length 1). Press and drag a sword to pull it out;
// it swings from the grip as you carry it. Only places listed in EpitaphWorld.STATUES hold a pin: near one it is
// pulled in like a magnet, and dropping it there stabs it in and saves that place as the character's location for
// the chapter on show (the Dossier tab updates itself). Dropped anywhere else, it flies back.
let PIN_TEMPLATE = null;
const PIN_LEN = 0.78;                       // sword length in marker units
async function loadPin() {
  try { PIN_TEMPLATE = await loadPins(); }
  catch (e) { console.warn('Sword pins not loaded; characters use plain tokens.', e); }
}
// A character's sword: their design from pins.js (designFor: own design for Orin, Nera, Yona, Gaia, Val;
// otherwise their type), a ring in their map colour, and an invisible handle to grab.
// Origin at the blade tip, about 1 unit long, like the rest of the drag code expects.
function makePin(T, char) {
  const pin = new THREE.Group(), built = buildPin(designFor(char), { ring: false });
  built.group.position.y = 0.07;                                    // pins.js sinks the tip 0.07 below its origin
  const meshes = []; built.group.traverse(o => { if (o.isMesh) meshes.push(o); });   // collect first: outlines are meshes too
  meshes.forEach(o => {
    o.castShadow = true;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m && !m.transparent && m.visible !== false) withOutline(o, T, T.outlinePx * 0.8);   // no ink on glass, glow or the Voided hole
  });
  pin.add(built.group);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: char.color }));
  ring.position.y = 0.1; pin.add(ring);
  const h = Math.max(1, built.height || 1);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.34, h + 0.05, 0.2).translate(0, (h + 0.05) / 2, 0), new THREE.MeshBasicMaterial({ visible: false }));
  pin.add(hit);
  Object.assign(pin.userData, { isPin: true, hit, ring, design: built.design, built, glow: () => {}, update: t => built.update(t, camera) });
  return pin;
}

const PROFILES_KEY = 'epitaph-character-profiles';
const drag = { active: null, pending: null };
const fx = [];                               // short-lived effects: dust rings and block debris
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpN = new THREE.Vector3(), qBase = new THREE.Quaternion(), qTilt = new THREE.Quaternion();
const smooth01 = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const easeOutBack = x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

// tangent axes at a surface normal (side, forward)
function tangents(n) {
  const side = new THREE.Vector3().crossVectors(n, Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP).normalize();
  return [side, new THREE.Vector3().crossVectors(side, n)];
}
// where a pin stands beside a place marker (same spot addMarkers uses for the first character there)
function landingFor(at, scale) {
  const [side, fwd] = tangents(at.normal), ang = 2.4, rad = PIN_GAP * scale;
  return at.pos.clone().addScaledVector(side, Math.cos(ang) * rad).addScaledVector(fwd, Math.sin(ang) * rad).addScaledVector(at.normal, 0.04 - 0.08 * scale);
}
// pointer → a point on the map surface, in the markers' local space
function pointerToSurface(e, handH = 0) {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const parent = markerArgs.parent, ray = raycaster.ray;
  if (state.view === 'planet') {
    const c = parent.getWorldPosition(new THREE.Vector3());
    const air = ray.intersectSphere(new THREE.Sphere(c, PR + handH), new THREE.Vector3());
    if (!air) return null;
    const hand = parent.worldToLocal(air.clone()), n = hand.clone().normalize();
    return { pos: n.clone().multiplyScalar(PR), hand, normal: n };          // ground point straight below the hand
  }
  const air = ray.intersectPlane(new THREE.Plane(UP, -(0.35 + handH)), new THREE.Vector3());
  if (!air) return null;
  const hand = parent.worldToLocal(air);
  return { pos: hand.clone().setY(hand.y - handH), hand, normal: UP.clone() };
}
function statueAnchors(scale, charId) {
  const ids = new Set(World.STATUES || []);
  return placesFor(state.era).filter(p => ids.has(p.id)).map(p => {
    const st = stones[p.id], slot = st ? freeSlot(st, charId) : null;
    const at = st ? { pos: st.g.position.clone(), normal: UP.clone().applyQuaternion(st.g.quaternion) } : surface(p.lat, p.lng);
    const land = st ? slotPos(st, slot) : landingFor(at, scale);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 40), new THREE.MeshBasicMaterial({ color: THEMES[state.theme].glow, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), at.normal); ring.position.copy(at.pos).addScaledVector(at.normal, 0.02);
    ring.scale.setScalar(scale); markerRoot.add(ring);
    return { place: p, at, land, ring, slot };
  });
}
// a puff of block dust and a ring where a pin leaves or hits the ground
function burst(pos, normal, scale, strong) {
  const T = THEMES[state.theme], parent = markerRoot;
  if (!parent || reduceMotion) return;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 1, 48), new THREE.MeshBasicMaterial({ color: T.glow, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal); ring.position.copy(pos).addScaledVector(normal, 0.03 * scale); parent.add(ring);
  const n = strong ? 22 : 12, cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: T.landHi, roughness: 0.9 }), n);
  const [side, fwd] = tangents(normal), parts = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (0.8 + Math.random() * 1.4) * scale * (strong ? 1.3 : 0.9);
    parts.push({ p: pos.clone().addScaledVector(normal, 0.05 * scale), v: side.clone().multiplyScalar(Math.cos(a) * sp).addScaledVector(fwd, Math.sin(a) * sp).addScaledVector(normal, (1.2 + Math.random() * 1.6) * scale), s: (0.025 + Math.random() * 0.03) * scale, r: Math.random() * 6 });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3();
  // place every cube at its start before the first frame draws (otherwise they render as one unit-sized block)
  parts.forEach((pt, i) => cubes.setMatrixAt(i, m4.compose(pt.p, q, sv.setScalar(pt.s))));
  cubes.instanceMatrix.needsUpdate = true; cubes.frustumCulled = false;
  parent.add(cubes);
  fx.push({ t: 0, life: strong ? 0.8 : 0.6, step(t, dt) {
    const k = t / this.life;
    ring.scale.setScalar((0.12 + 0.55 * smooth01(k * 1.4)) * scale * (strong ? 1.3 : 1)); ring.material.opacity = 0.8 * (1 - k);
    parts.forEach((pt, i) => {
      pt.v.addScaledVector(normal, -6 * scale * dt); pt.p.addScaledVector(pt.v, dt);
      const s = pt.s * (1 - k); m4.compose(pt.p, q.setFromEuler(e.set(pt.r + t * 6, pt.r, 0)), sv.setScalar(Math.max(1e-4, s))); cubes.setMatrixAt(i, m4);
    });
    cubes.instanceMatrix.needsUpdate = true;
  }, end() { parent.remove(ring, cubes); ring.geometry.dispose(); ring.material.dispose(); cubes.geometry.dispose(); cubes.material.dispose(); } });
}

// ---- reading and writing the Dossier
function canMove(cs) {
  if (state.demo) return { ok: true, demo: true };
  if (cs.stop.presence === 'dead') return { ok: false, why: 'The dead stay where they fell.' };
  if (cs.stop.locked) return { ok: false, why: `Chapter ${cs.stop.ch ?? ''} is locked canon. Reopen it in the Dossier to move this pin.` };
  return { ok: true };
}
function saveLocation(charId, snapId, ref) {
  let st; try { st = JSON.parse(localStorage.getItem(PROFILES_KEY) || 'null'); } catch (e) { st = null; }
  const c = st && (st.characters || []).find(x => x.id === charId);
  const snap = c && ((c.snapshots || []).find(s => s.id === snapId) || (c.snapshots || []).find(s => s.id === c.activeSnapshotId));
  if (!snap) return 'That character is no longer in the Dossier.';
  if (snap.locked) return 'That chapter was locked in the Dossier, so the move was not saved.';
  snap.location = ref;
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(st)); } catch (e) { return 'The browser could not save the move (storage may be full).'; }
  return null;
}
function refreshMarkers() {
  if (!markerArgs || !markerRoot) return;
  const { T, markerScale, parent } = markerArgs;
  travels.length = 0;
  const old = markerRoot; old.parent.remove(old); disposeTree(old);
  pickables = pickables.filter(p => { let o = p; while (o) { if (o === old) return false; o = o.parent; } return true; });
  labels = labels.filter(l => !l.marker); markerAnim = [];
  addMarkers(T, markerScale, parent === old ? root : parent);
  syncLabelEls();
}
let toastTimer = 0;
function say(html, ms = 2600) { tip.hidden = false; tip.innerHTML = html; clearTimeout(toastTimer); if (ms) toastTimer = setTimeout(() => { if (!drag.active) tip.hidden = true; }, ms); }

// ---- the drag itself
function beginDrag(hitObj, e) {
  const { char, charState: cs, pin, at, scale } = hitObj.userData;
  const verdict = canMove(cs);
  const d = { char, cs, pin, scale, home: { pos: pin.position.clone(), normal: at.normal.clone() }, verdict,
    phase: verdict.ok ? 'lift' : 'refuse', t: 0, hand: pin.position.clone(), handPrev: null, vel: new THREE.Vector3(), velPrev: new THREE.Vector3(),
    tilt: new THREE.Vector2(), tiltV: new THREE.Vector2(), normal: at.normal.clone(), target: null, anchors: [], aim: null, pointerId: e.pointerId };
  drag.active = d; controls.enabled = false; state.lastInteract = performance.now(); state.focus = null;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  canvas.style.cursor = verdict.ok ? 'grabbing' : 'not-allowed';
  if (!verdict.ok) { say(`<b>${esc(char.name)}</b><span>${esc(verdict.why)}</span>`); return; }
  d.anchors = statueAnchors(scale, d.char.id);
  pin.userData.built?.setFree(true);                                // loose parts (Moinera's chain) swing free while held
  // the sword hangs from the cursor on a golden thread: the cursor end floats at anchorH above the ground,
  // and the scroll wheel lets thread out (sword lower, slower wider swing) or reels it in
  const s = d.pin.scale.x;
  d.anchorH = s + 2.6 * scale;
  d.Lmin = 0.25 * scale; d.Lmax = d.anchorH - s - 0.15 * scale;
  d.L = d.Lt = Math.min(d.Lmax, Math.max(d.Lmin, d.anchorH - s - 0.9 * scale));   // the point starts 0.9 above the ground
  d.aim = { pos: d.home.pos.clone(), normal: d.home.normal.clone(), hand: d.home.pos.clone().addScaledVector(d.home.normal, s + d.L) };
  d.thread = makeThread(scale);
  burst(d.home.pos, d.home.normal, scale, false);
  say(`<b>${esc(char.name)}</b><span>Carry the sword to a site with a statue.</span><span>Scroll to let out or reel in the thread.</span>`, 0);
}
function moveDrag(e) {
  const d = drag.active; if (!d || !(d.phase === 'carry' || d.phase === 'lift')) return;
  state.lastInteract = performance.now();
  const hit = pointerToSurface(e, d.anchorH); if (!hit) return;
  // magnet: the nearest statue site within reach pulls the sword toward its landing spot
  const reach = SNAP * d.scale; let best = null, bd = Infinity;
  d.anchors.forEach(a => { const dist = a.land.distanceTo(hit.pos); if (dist < bd) { bd = dist; best = a; } });
  d.target = best && bd < reach ? best : null;
  const pull = d.target ? smooth01((reach - bd) / (reach * 0.7)) * 0.85 : 0;
  const normal = d.target ? hit.normal.clone().lerp(d.target.at.normal, pull).normalize() : hit.normal;
  const pos = hit.pos.clone().lerp(d.target ? d.target.land : hit.pos, pull);
  d.aim = { pos, normal, hand: hit.hand.clone().lerp(d.target ? d.target.land.clone().addScaledVector(d.target.at.normal, d.anchorH) : hit.hand, pull) };
  const r = canvas.getBoundingClientRect(); tip.style.left = (e.clientX - r.left + 16) + 'px'; tip.style.top = (e.clientY - r.top + 16) + 'px';
  tip.innerHTML = d.target ? `<b>${esc(d.char.name)}</b><span class="here">Drop at ${esc(d.target.place.name)}</span>` : `<b>${esc(d.char.name)}</b><span>Only sites with a statue hold a pin.</span>`;
}
function releaseDrag() {
  const d = drag.active; if (!d) return;
  if (d.phase === 'refuse') { if (d.t > 0.45) endDrag(); else d.releaseAfter = true; return; }
  const s = d.pin.scale.x, q = d.pin.quaternion.clone(), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  d.letGo = { anchor: d.hand.clone(), pommel: d.pin.position.clone().addScaledVector(up, s) };
  // a rigid body: centre of the blade, its velocity (hand + swing) and its spin (from the swing)
  const [side, fwd] = tangents(d.normal), swing = side.clone().multiplyScalar(d.tiltV.x).addScaledVector(fwd, d.tiltV.y);
  const v = d.phase === 'carry' ? d.vel.clone().addScaledVector(swing, d.L + 0.5 * s) : new THREE.Vector3();
  const vmax = 20 * d.scale; if (v.length() > vmax) v.setLength(vmax);
  d.body = { q, com: d.pin.position.clone().addScaledVector(up, 0.5 * s), v, omega: new THREE.Vector3().crossVectors(swing, d.normal) };
  d.phase = 'fly'; d.t = 0;
}
function endDrag(silent) {
  const d = drag.active; if (!d) return;
  d.anchors.forEach(a => { a.ring.parent && a.ring.parent.remove(a.ring); a.ring.geometry.dispose(); a.ring.material.dispose(); });
  if (d.thread) { d.thread.group.parent && d.thread.group.parent.remove(d.thread.group); d.thread.dispose(); }
  d.pin.userData.built?.setFree(false);
  try { canvas.releasePointerCapture(d.pointerId); } catch (e) {}
  drag.active = null; controls.enabled = true; canvas.style.cursor = '';
  if (!silent && !tip.innerHTML.includes('class="err"')) { clearTimeout(toastTimer); toastTimer = setTimeout(() => { tip.hidden = true; }, 1800); }
}
function landed(d) {                            // the sword is back home (Esc)
  burst(d.dest.pos, d.dest.normal, d.scale, false);
  impact(d.dest.pos, d.dest.normal, null, 0.2, d.scale);
  say(`<b>${esc(d.char.name)}</b><span>Put back where it was.</span>`, 1600);
}
function makeThread(scale) {
  const group = new THREE.Group(), gold = '#ffcf5a';
  const line = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0 }));
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.035 * scale, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff2c4', transparent: true, opacity: 0 }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.075 * scale, 12, 8), new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(line, bead, halo); markerRoot.add(group);
  const r = 0.011 * scale, dir = new THREE.Vector3();
  return {
    group,
    set(a, b, opacity, time = 0) {          // a: cursor end, b: the sword's pommel
      dir.copy(b).sub(a); const len = Math.max(1e-4, dir.length());
      line.position.copy(a).addScaledVector(dir, 0.5); line.quaternion.setFromUnitVectors(UP, dir.normalize()); line.scale.set(r, len, r);
      bead.position.copy(a); halo.position.copy(a); halo.scale.setScalar(1 + 0.25 * Math.sin(time * 5));
      line.material.opacity = opacity; bead.material.opacity = opacity; halo.material.opacity = opacity * 0.45;
      group.visible = opacity > 0.01;
    },
    dispose() { [line, bead, halo].forEach(m => { m.geometry.dispose(); m.material.dispose(); }); }
  };
}
// hang the sword by its pommel from the thread's cursor end: rigid pendulum of thread + blade
function poseHang(d, anchor, n, tilt, L, extraYaw = 0) {
  poseAt(d, anchor, n, tilt, extraYaw);                         // sets the orientation
  const s = d.pin.scale.x, down = tmpA.set(0, -1, 0).applyQuaternion(d.pin.quaternion);
  const pommel = anchor.clone().addScaledVector(down, L);
  d.pin.position.copy(pommel).addScaledVector(down, s);           // the tip is one sword-length below the pommel
  return pommel;
}
function poseAt(d, gripPos, n, tilt, extraYaw = 0) {
  // the sword hangs from its grip (0.8 of the way up), tilted by the swing
  qBase.setFromUnitVectors(UP, n);
  if (extraYaw) qBase.multiply(qTilt.setFromAxisAngle(UP, extraYaw));
  const [side, fwd] = tangents(n), ang = tilt.length();
  if (ang > 1e-4) { const u = side.clone().multiplyScalar(tilt.x).addScaledVector(fwd, tilt.y).normalize(); qTilt.setFromAxisAngle(tmpA.crossVectors(u, n).normalize(), ang); d.pin.quaternion.copy(qTilt).multiply(qBase); }
  else d.pin.quaternion.copy(qBase);
  const s = d.pin.scale.x;
  d.pin.position.copy(gripPos).sub(tmpB.set(0, 0.8 * s, 0).applyQuaternion(d.pin.quaternion));
}
// ---- back to Era 1: as the era wave passes each sword's place it rises slowly out of the ground into the air; once the wave
// is done and every sword is up, they all drop together. ERA_RETURN = 'staggered' drops each as soon as it is up instead.
const ERA_RETURN = 'together';
let eraReturn = null;
function startEraReturn() {
  const maxD = state.waveMaxD || 1, list = [];
  state.chars.forEach(c => {
    if (stayInEra0(c)) return;
    const cs = charStateAt(c, state.chapter); if (!cs) return;
    const [u, v] = mapUV(cs.stop.r);
    list.push({ id: c.id, delay: Math.min(1, craterDist(u, v) / maxD) * .85, phase: 'wait', t: 0 });
  });
  eraReturn = list.length ? { list, time: 0 } : null;
}
function stepEraReturn(dt) {
  const R = eraReturn; if (!R) return;
  R.time += dt;
  let allUp = true, allDone = true;
  R.list.forEach(e => {
    const h = pickables.find(p => p.userData.pin && p.userData.char && p.userData.char.id === e.id);
    if (!h) { if (e.phase !== 'done') allDone = false; return; }
    const pin = h.userData.pin, rest = pin.userData.rest, sc = h.userData.scale;
    const n = state.view === 'planet' ? rest.pos.clone().normalize() : UP.clone(), L = pin.scale.x * 1.15, hover = .9 * sc;
    if (e.phase !== 'done') pin.userData.travelling = true;
    if (e.phase === 'wait') {
      pin.visible = false;
      if (state.eraT >= e.delay - 1e-3) { e.phase = 'rise'; e.t = 0; pin.visible = true; burst(rest.pos, n, sc, false); pin.userData.built?.setFree(true); }
    }
    if (e.phase === 'rise') {                                         // slowly up out of the ground, a little twist as it comes
      e.t += dt; const k = Math.min(1, e.t / 1.5), ek = 1 - Math.pow(1 - k, 3);
      pin.position.copy(rest.pos).addScaledVector(n, -L + (L + hover) * ek); pin.quaternion.copy(rest.quat); pin.rotateOnAxis(UP, (1 - ek) * 2.5);
      if (k >= 1) { e.phase = 'hover'; e.t = 0; }
    }
    if (e.phase === 'hover') {                                        // waiting in the air, a gentle bob
      e.t += dt; pin.position.copy(rest.pos).addScaledVector(n, hover + Math.sin(R.time * 2 + e.delay * 9) * .03 * sc); pin.quaternion.copy(rest.quat);
      if (ERA_RETURN === 'staggered' && e.t > .3) { e.phase = 'drop'; e.t = 0; }
    }
    if (e.phase === 'drop') {                                         // point-first into its place
      e.t += dt; const k = Math.min(1, e.t / .28);
      pin.position.copy(rest.pos).addScaledVector(n, hover * (1 - k * k)); pin.quaternion.copy(rest.quat);
      if (k >= 1) { e.phase = 'settle'; e.t = 0; burst(rest.pos, n, sc, true); impact(rest.pos, n, null, .35, sc); pin.userData.built?.setFree(false); }
    }
    if (e.phase === 'settle') {
      e.t += dt; const sd = Math.exp(-6 * e.t);
      pin.position.copy(rest.pos).addScaledVector(n, -.05 * sc * sd);
      pin.quaternion.copy(rest.quat).premultiply(qTilt.setFromAxisAngle(tangents(n)[0], Math.sin(e.t * 24) * .14 * sd));
      if (e.t > .6) { e.phase = 'done'; pin.position.copy(rest.pos); pin.quaternion.copy(rest.quat); pin.userData.travelling = false; }
    }
    if (e.phase === 'wait' || e.phase === 'rise') allUp = false;
    if (e.phase !== 'done') allDone = false;
  });
  if (ERA_RETURN === 'together' && allUp && state.eraT >= 1) R.list.forEach(e => { if (e.phase === 'hover') { e.phase = 'drop'; e.t = 0; } });
  if (allDone) eraReturn = null;
}
function updatePins(dt, time) {
  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; if (f.t >= f.life) { f.end(); fx.splice(i, 1); } else f.step(f.t, dt); }
  for (let i = travels.length - 1; i >= 0; i--) if (travels[i].step(dt)) travels.splice(i, 1);
  for (let i = quakes.length - 1; i >= 0; i--) if (quakes[i].step(dt)) quakes.splice(i, 1);
  stepEraReturn(dt);
  const d = drag.active; if (!d) return;
  d.t += dt;
  const s = d.pin.scale.x, lift = 0.9 * d.scale;
  d.anchors.forEach(a => {
    const on = a === d.target, pulse = 0.5 + 0.5 * Math.sin(time * 6);
    const flying = d.phase === 'fly', done = !(flying || d.phase === 'carry' || d.phase === 'lift');
    a.ring.material.opacity = done ? a.ring.material.opacity * 0.9 : on ? 0.75 + 0.25 * pulse : 0.28 + 0.12 * pulse;
    a.ring.scale.setScalar(d.scale * (on ? 1.35 + 0.15 * pulse : 1));
  });
  if (d.phase === 'refuse') {                     // a stubborn wiggle: it will not come out
    const k = Math.max(0, 1 - d.t / 0.45), w = Math.sin(d.t * 55) * 0.09 * k;
    qBase.setFromUnitVectors(UP, d.home.normal); d.pin.quaternion.copy(qBase).multiply(qTilt.setFromAxisAngle(new THREE.Vector3(0, 0, 1), w));
    d.pin.position.copy(d.home.pos);
    if (d.t > 0.45 && d.releaseAfter) endDrag();
    return;
  }
  const gripHome = d.home.pos.clone().addScaledVector(d.home.normal, 0.8 * s);
  if (d.phase === 'lift') {                       // strain, then pull free and rise with a little overshoot
    const strain = 0.16;
    if (d.t < strain) {
      const w = Math.sin(d.t * 70) * 0.05;
      poseAt(d, gripHome.clone().addScaledVector(d.home.normal, 0.02 * s * Math.sin(d.t * 90)), d.home.normal, new THREE.Vector2(w, 0));
    } else {
      const k = Math.min(1, (d.t - strain) / 0.38), e = easeOutBack(k);
      const start = d.home.pos.clone().addScaledVector(d.home.normal, s + d.L);      // thread straight up from the pommel
      d.hand.copy(start).lerp(d.aim.hand, e);
      const pommel = poseHang(d, d.hand, d.home.normal.clone().lerp(d.aim.normal, k).normalize(), new THREE.Vector2(), d.L, Math.sin(k * Math.PI) * 0.6);
      d.thread.set(d.hand, pommel, smooth01(k * 1.5), time);
      if (k >= 1) { d.phase = 'carry'; d.handPrev = d.hand.clone(); }
    }
    return;
  }
  if (d.phase === 'carry') {                      // follow the pointer; the blade swings like a pendulum from the grip
    const target = d.aim.hand;
    d.hand.x = damp(d.hand.x, target.x, 30, dt); d.hand.y = damp(d.hand.y, target.y, 30, dt); d.hand.z = damp(d.hand.z, target.z, 30, dt);
    d.normal.lerp(d.aim.normal, 1 - Math.exp(-10 * dt)).normalize();
    d.vel.copy(d.hand).sub(d.handPrev).divideScalar(Math.max(dt, 1e-3)); d.handPrev.copy(d.hand);
    const acc = d.vel.clone().sub(d.velPrev).divideScalar(Math.max(dt, 1e-3)); d.velPrev.copy(d.vel);
    const [side, fwd] = tangents(d.normal), ax = acc.dot(side) / d.scale, az = acc.dot(fwd) / d.scale;
    d.L = damp(d.L, d.Lt, 12, dt);
    const reach = (d.L + 0.55 * s) / d.scale;                     // pendulum length: longer thread, slower and wider swing
    const w2 = 100 / reach, damping = 2.4, push = 0.055;          // stiffness, damping, how hard motion throws the blade
    d.tiltV.x += (-w2 * d.tilt.x - damping * d.tiltV.x - ax * push * w2 * 0.1) * dt;
    d.tiltV.y += (-w2 * d.tilt.y - damping * d.tiltV.y - az * push * w2 * 0.1) * dt;
    d.tilt.addScaledVector(d.tiltV, dt);
    if (d.tilt.length() > 1.45) d.tilt.setLength(1.45);
    const pommel = poseHang(d, d.hand, d.normal, d.tilt, d.L, Math.sin(time * 1.3) * 0.15);
    d.thread.set(d.hand, pommel, 1, time);
    return;
  }
  if (d.thread && d.letGo) { const k = smooth01(d.t / 0.22); d.thread.set(d.letGo.anchor, d.letGo.pommel.clone().lerp(d.letGo.anchor, k), 1 - k, time); }
  if (d.phase === 'fly') { flyStep(d, dt); return; }
  if (d.phase === 'stab') { stuckStep(d, dt); return; }
  // return: straighten, travel home, then fall point-first and stab in with a wobble
  const travel = d.phase === 'return' ? 0.42 : 0.12, fall = 0.2;
  const above = d.dest.pos.clone().addScaledVector(d.dest.normal, lift * 0.75 + 0.8 * s);
  if (d.t < travel) {
    const k = smooth01(d.t / travel), arc = d.phase === 'return' ? Math.sin(k * Math.PI) * 0.6 * d.scale : 0;
    const from = d.fallFrom.clone().add(tmpB.set(0, 0.8 * s, 0).applyQuaternion(d.fallQ));
    d.hand.copy(from).lerp(above, k).addScaledVector(d.dest.normal, arc);
    d.tilt.multiplyScalar(Math.exp(-14 * dt));
    poseAt(d, d.hand, d.normal.lerp(d.dest.normal, k).normalize(), d.tilt);
  } else if (d.t < travel + fall) {
    const k = (d.t - travel) / fall, g = k * k;                                         // accelerating fall
    const stab = d.dest.pos.clone().addScaledVector(d.dest.normal, 0.8 * s - 0.05 * d.scale);   // a touch deeper than rest
    d.hand.copy(above).lerp(stab, g); d.tilt.set(0, 0);
    poseAt(d, d.hand, d.dest.normal, d.tilt);
    d.landedAt = null;
  } else {
    if (!d.landedAt) { d.landedAt = d.t; landed(d); }
    const k = d.t - d.landedAt, settle = Math.exp(-5 * k);
    const rest = d.dest.pos.clone().addScaledVector(d.dest.normal, 0.8 * s - 0.05 * d.scale * settle);
    poseAt(d, rest, d.dest.normal, new THREE.Vector2(Math.sin(k * 26) * 0.16 * settle, Math.sin(k * 19 + 1) * 0.06 * settle));
    if (k > 0.75) { poseAt(d, d.dest.pos.clone().addScaledVector(d.dest.normal, 0.8 * s), d.dest.normal, new THREE.Vector2()); endDrag(); }
  }
}
// ---- thrown: ballistic flight with spin, the point turning into the wind; statue sites pull it in
const MAX_LEAN = 55 * Math.PI / 180;           // a landed sword leans at most this far from upright
const SNAP = 1.1;                                // statue-site magnet reach, in marker units
const NEAR_PLACE = 2.6;                          // within this of a map place, an off-site sword is 'en route' to it
// A map point → lat/lng: the exact reverse of the map's projection (board or planet → map uv → lat/lng).
// The layout has two pieces (Equal Earth for the main continents, seam in the Bering Strait; Antarctica as a
// round piece below), so each is inverted on its own.
function uvToLatLng(u, v) {
  const L = LAY, px = u * L.W, py = (1 - v) * L.H;
  // main piece: invert the placement, then Equal Earth (Newton on the latitude parameter)
  const x = ((px - L.mainX0) / L.mainW * 2 - 1) * L.xmax, y = L.ymax - (py - L.mainY0) / L.mainH * (L.ymax - L.ycut);
  let p = y / A1;
  for (let k = 0; k < 12; k++) {
    const p2 = p * p, p6 = p2 * p2 * p2;
    const f = p * (A1 + A2 * p2 + p6 * (A3 + A4 * p2)) - y, df = A1 + 3 * A2 * p2 + p6 * (7 * A3 + 9 * A4 * p2);
    p -= f / df;
  }
  const p2 = p * p, p6 = p2 * p2 * p2;
  const latM = Math.asin(Math.max(-1, Math.min(1, Math.sin(p) / MM))) * 180 / Math.PI;
  const lr = x * MM * (A1 + 3 * A2 * p2 + p6 * (7 * A3 + 9 * A4 * p2)) / Math.cos(p) * 180 / Math.PI;
  const wrap = a => ((a + 540) % 360) - 180;
  if (latM >= L.latCut && Math.abs(lr) <= 180) return { lat: latM, lng: wrap(lr + L.lon0) };
  // Antarctica: polar coordinates around its centre
  const dx = px - L.dcx, dy = L.dcy - py, r = Math.hypot(dx, dy);
  const latA = r / L.rd * L.cdisc - 90;
  if (latA < L.latCut) return { lat: latA, lng: wrap(Math.atan2(dx, dy) * 180 / Math.PI + L.lonUp) };
  // off the island (the open sea of Epitaph): the nearest sensible reading
  return { lat: Math.max(L.latCut, Math.min(89.9, latM)), lng: wrap(Math.max(-180, Math.min(180, lr)) + L.lon0) };
}
// Spots beyond Earth (the planet's unmapped lands and seas, the board's open sea) have no lat/lng: they are kept as map uv,
// which both views can place (the planet anywhere on its sphere, the board inside its rectangle)
const onEarthUV = (u, v) => u >= 0 && u <= 1 && v >= 0 && v <= 1 && earthAt(u, v, state.era).kind !== 'out';
const offEarthHeight = () => state.view === 'planet' ? PR * 0.995 + 0.012 : 0.06;
function mapUV(r) { return num(r.u) && num(r.v) && !num(r.lat) ? [r.u, r.v] : eeUV(r.lng, r.lat); }
function spotAt(r) {
  if (!(num(r.u) && num(r.v) && !num(r.lat))) return surface(r.lat, r.lng);
  if (state.view === 'planet') { const dir = uvToDir(r.u, r.v); return { pos: dir.clone().multiplyScalar(offEarthHeight()), normal: dir }; }
  if (r.u < 0 || r.u > 1 || r.v < 0 || r.v > 1) return null;              // off the board: only the planet shows it
  return { pos: uvToBoard(r.u, r.v).setY(offEarthHeight()), normal: UP.clone() };
}
function uvAt(p) {
  let u, v;
  if (state.view === 'planet') {
    const dir = p.clone().normalize(), ang = Math.acos(Math.max(-1, Math.min(1, dir.dot(EARTH_DIR))));
    const r = ang / CAP, sa = Math.sin(ang);
    const px = sa > 1e-9 ? r * dir.dot(capE1) / sa : 0, py = sa > 1e-9 ? r * dir.dot(capE2) / sa : 0;
    u = (px / EARTH_FIT_X + 1) / 2; v = (py / EARTH_FIT_Y + 1) / 2;
  } else { u = p.x / BW + 0.5; v = -p.z / BH + 0.5; }
  return { u, v };
}
function latLngAt(p) { const { u, v } = uvAt(p); return uvToLatLng(u, v); }
function nearestPlace(pos, scale) {
  const planet = state.view === 'planet';
  let best = null, bd = Infinity;
  placesFor(state.era).forEach(pl => {
    const q = surface(pl.lat, pl.lng).pos, dd = planet ? q.distanceTo(pos) : Math.hypot(q.x - pos.x, q.z - pos.z);
    if (dd < bd) { bd = dd; best = pl; }
  });
  return best && bd < NEAR_PLACE * scale ? best : null;
}
function groundAt(d, p) {
  // ground under a point: the site's own height near a statue site, otherwise a rough land level
  const n = state.view === 'planet' ? p.clone().normalize() : UP.clone();
  const near = nearestSite(d, p);
  const h = near && near.dist < 2.6 * d.scale ? (state.view === 'planet' ? near.a.land.length() : near.a.land.y) : (state.view === 'planet' ? PR : 0.35);
  return { n, h, near };
}
function nearestSite(d, p) {
  let best = null, bd = Infinity;
  d.anchors.forEach(a => { const flat = state.view === 'planet' ? a.land.clone().normalize().multiplyScalar(PR).distanceTo(p.clone().normalize().multiplyScalar(PR)) : Math.hypot(a.land.x - p.x, a.land.z - p.z); if (flat < bd) { bd = flat; best = a; } });
  return best ? { a: best, dist: bd } : null;
}
function flyStep(d, dt) {
  const b = d.body, s = d.pin.scale.x, G = 14 * d.scale;
  let { n, h, near } = groundAt(d, b.com);
  if (!(near && near.dist < 2.6 * d.scale)) {                        // away from statue sites: the actual terrain below
    const uv = uvAt(b.com);
    if (onEarthUV(uv.u, uv.v)) {
      b.ll = uvToLatLng(uv.u, uv.v);
      const g = surface(b.ll.lat, b.ll.lng).pos;
      h = (state.view === 'planet' ? g.length() : g.y) - 0.01 + 0.04 - 0.08 * d.scale;   // where a resting sword's tip sits
    } else h = offEarthHeight() + 0.04 - 0.08 * d.scale;              // beyond Earth: sea level
  }
  const acc = n.clone().multiplyScalar(-G);
  // the magnet: near a statue site the flight bends toward it and slows sideways
  const reach = SNAP * d.scale;
  if (near && near.dist < reach * 1.5) {
    const w = 1 - near.dist / (reach * 1.5), delta = near.a.land.clone().sub(b.com); delta.addScaledVector(n, -delta.dot(n));
    acc.addScaledVector(delta, 34 * w);
    const vt = b.v.clone().addScaledVector(n, -b.v.dot(n)); b.v.addScaledVector(vt, -2.5 * w * dt);
    d.target = near.a;
  } else d.target = null;
  b.v.addScaledVector(acc, dt).multiplyScalar(Math.exp(-0.25 * dt));
  b.com.addScaledVector(b.v, dt);
  // spin, damped; then the point turns toward the direction of travel (point first, like a dart)
  b.omega.multiplyScalar(Math.exp(-1.2 * dt));
  const ang = b.omega.length() * dt;
  if (ang > 1e-6) b.q.premultiply(qTilt.setFromAxisAngle(tmpA.copy(b.omega).normalize(), ang));
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(b.q), speed = b.v.length();
  if (speed > 1.5 * d.scale) {
    const want = b.v.clone().normalize().negate();                 // up points away from the direction of travel
    const turn = Math.min(1, dt * 3.5 * Math.min(1, speed / (8 * d.scale)));
    b.q.premultiply(qTilt.setFromUnitVectors(up, up.clone().lerp(want, turn).normalize()));
  }
  b.q.normalize();
  const up2 = new THREE.Vector3(0, 1, 0).applyQuaternion(b.q), tip = b.com.clone().addScaledVector(up2, -0.5 * s);
  d.pin.quaternion.copy(b.q); d.pin.position.copy(tip);
  const tipH = state.view === 'planet' ? tip.length() : tip.y;
  if (tipH > h && d.t < 6) return;
  // impact: lean is capped so it never lies flat (and a pommel-first landing is turned point-down)
  const lean = up2.angleTo(n);
  if (lean > MAX_LEAN) {
    const axis = tmpA.crossVectors(n, up2); if (axis.lengthSq() < 1e-8) axis.copy(tangents(n)[0]); axis.normalize();   // pommel-first: tip it over to one side
    b.q.premultiply(qTilt.setFromUnitVectors(up2, n.clone().applyAxisAngle(axis, MAX_LEAN)));
  }
  const hitSite = near && near.dist < reach * 1.15 ? near.a : null;
  let land, spot = null;
  if (hitSite) land = hitSite.land.clone();
  else {                                                                // off the statue sites: work out where on the map it is
    const ground = tip.clone().addScaledVector(n, h - tipH), uv = uvAt(ground);
    land = ground;                                                    // stays exactly where it hit
    if (!onEarthUV(uv.u, uv.v)) spot = { status: 'unknown', u: +uv.u.toFixed(5), v: +uv.v.toFixed(5), placeId: null };   // beyond Earth
    else {
      const ll = uvToLatLng(uv.u, uv.v), at = surface(ll.lat, ll.lng), near = nearestPlace(at.pos, d.scale);
      spot = near ? { status: 'enroute', lat: +ll.lat.toFixed(3), lng: +ll.lng.toFixed(3), toPlaceId: near.id, countryId: near.countryId || null, placeId: null }
                  : { status: 'unknown', lat: +ll.lat.toFixed(3), lng: +ll.lng.toFixed(3), placeId: null };
    }
  }
  d.stick = { from: tip.clone(), land, n: hitSite ? hitSite.at.normal.clone() : n, q: hitSite ? new THREE.Quaternion().setFromUnitVectors(UP, hitSite.at.normal) : b.q.clone(), t: 0,   // into a stone's slot: upright
    site: hitSite, spinAxis: tmpA.crossVectors(n, up2).lengthSq() > 1e-6 ? tmpA.clone().normalize() : new THREE.Vector3(1, 0, 0), hard: Math.min(1, speed / (10 * d.scale)) };
  d.phase = 'stab'; d.t = 0;
  burst(land, d.stick.n, d.scale, true);
  impact(land, d.stick.n, b.v, 0.25 + 0.75 * Math.min(1, speed / (12 * d.scale)), d.scale);
  settleAt(d, hitSite ? World.makeRef(null, hitSite.place.id) : spot, d.stick.q, d.stick.n);
}
function stuckStep(d, dt) {
  const st = d.stick, s = d.pin.scale.x; st.t += dt;
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(st.q);
  const slide = smooth01(st.t / 0.12);                                   // the snap onto the site
  const depth = (0.05 + 0.07 * st.hard) * d.scale * Math.exp(-4 * st.t);    // drives in, then eases back to the resting depth
  const wob = Math.sin(st.t * 24) * (0.1 + 0.12 * st.hard) * Math.exp(-5 * st.t);
  d.pin.quaternion.copy(st.q).premultiply(qTilt.setFromAxisAngle(st.spinAxis, wob));
  d.pin.position.copy(st.from).lerp(st.land, slide).addScaledVector(up, -depth);
  if (st.t > 0.8) { d.pin.quaternion.copy(st.q); endDrag(); }
}
// ---- the close-up (assets/atlas3d/closeup.js): what kind of ground is under a character's sword
function regionAt(r) {
  const site = r.place ? siteOf(r.place) : null;
  if (site) return { region: 'site', site };
  const [u, v] = mapUV(r);
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) {                      // beyond Earth on the planet: unmapped land, or the open sea
    const dir = uvToDir(u, v), land = fbm(dir.x * 1.4 + 3, dir.y * 1.4 + dir.z * 0.9) > 0.08;
    return { region: land ? 'plains' : (r.status === 'enroute' ? 'boat' : 'underwater') };
  }
  const here = earthAt(u, v, 1);
  const enroute = r.kind === 'point' && r.status === 'enroute';
  if (here.kind === 'pit') return { region: 'pit' };
  if (here.kind === 'rim') return { region: 'rim' };
  if (here.kind === 'out') return { region: enroute ? 'boat' : 'underwater' };       // past Earth's edge: the open sea of Epitaph
  if (here.kind === 'sea') return { region: enroute ? 'boat' : here.band === 0 ? 'coast' : 'underwater' };
  if (here.kind === 'sunk') return { region: enroute ? 'boat' : 'drowned' };
  const d = 0.006;                                   // dry land within a few map pixels of the water: the coast
  for (const [a, b] of [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]]) { const k = earthAt(u + a, v + b, 1).kind; if (k === 'sea' || k === 'sunk' || k === 'out') return { region: 'coast' }; }
  if (r.lat < -60 || r.lat > 68) return { region: 'ice' };
  if (here.band >= 3) return { region: 'mountains' };
  if (here.band === 2) return { region: 'hills' };
  return { region: 'plains' };
}
function openPinCloseup(ud) {
  if (!ud || !ud.char || !ud.charState) return;
  const r = ud.charState.stop.r, reg = regionAt(r);
  // swords standing close together on the map share the close-up (the clicked one first)
  const here = ud.pin.getWorldPosition(new THREE.Vector3()), near = .75 * ud.scale;          // 'very close' on the map
  const company = pickables.filter(h => h.userData.pin && h.userData.char && h !== ud.hit && h.userData.char.id !== ud.char.id && h.userData.pin.visible !== false)
    .map(h => ({ c: h.userData.char, d: h.userData.pin.getWorldPosition(new THREE.Vector3()).distanceTo(here) }))
    .filter(x => x.d < near).sort((a, b) => a.d - b.d).map(x => x.c);
  tip.hidden = true;
  openCloseup({
    mount: canvas.parentElement, char: ud.char, chars: [ud.char, ...company], region: reg.region, siteUrl: reg.site || null, theme: state.theme,
    where: (r.kind === 'point' ? r.name : r.label || r.name) + (ud.charState.stop.ch != null ? ' · chapter ' + ud.charState.stop.ch : '')
  });
}
// a settlement with a statue, opened from its marker: everyone whose sword stands there this chapter (a site inside a city
// counts for the city, e.g. the Temple of the Voided in Aurelia), around its statue or standing giant in its built site
function openSettlementCloseup(p) {
  const ids = new Set([p.id, ...World.places().filter(q => q.cityId === p.id).map(q => q.id)]);
  const chars = state.chars.filter(c => { const cs = charStateAt(c, state.chapter); return cs && cs.stop.r.place && (ids.has(cs.stop.r.place.id) || ids.has(cs.stop.r.place.cityId)); });
  const reg = regionAt({ place: p, lat: p.lat, lng: p.lng, kind: 'place' });
  const statue = (p.group === 'STORYBORN' || (p.fictional && !p.group)) ? 'storyborn' : p.group === 'VOIDED' ? 'voided' : p.group === 'FALLEN' ? 'fallen' : null;
  tip.hidden = true;
  openCloseup({
    mount: canvas.parentElement, chars, title: p.name, region: reg.region === 'site' ? 'plains' : reg.region, siteUrl: reg.site || null, theme: state.theme,
    statue: reg.site ? null : statue, statueColor: THEMES[state.theme].groups[(statue || 'other').toUpperCase()] || THEMES[state.theme].groups.OTHER,
    where: (state.chapter != null ? 'Chapter ' + state.chapter : 'Latest') + ' · ' + (chars.length ? chars.length + (chars.length === 1 ? ' sword' : ' swords') : 'no swords')
  });
}
// ---- landed sword poses, remembered per character so a thrown sword keeps its angle
const POSE_KEY = 'epitaph-map-pin-poses';
const readPoses = () => { try { return JSON.parse(localStorage.getItem(POSE_KEY) || '{}') || {}; } catch (e) { return {}; } };
function savePose(charId, key, q, n, slot = null) {
  const rel = new THREE.Quaternion().setFromUnitVectors(UP, n).invert().multiply(q);
  const all = readPoses(); all[charId] = { key, q: rel.toArray().map(x => +x.toFixed(4)) };
  if (Number.isInteger(slot)) all[charId].slot = slot;
  try { localStorage.setItem(POSE_KEY, JSON.stringify(all)); } catch (e) {}
}
function settleAt(d, ref, q, n) {
  const r = World.resolve(ref);
  if (r) savePose(d.char.id, r.key, q, n, d.stick && d.stick.site ? d.stick.site.slot : null);
  const where = r ? (r.kind === 'point' ? r.name : 'Now at ' + r.name) : 'Here';
  if (d.verdict.demo) { say(`<b>${esc(d.char.name)}</b><span class="here">${esc(where)}</span><span>Demo pin, not saved. Add characters in the Dossier to keep moves.</span>`, 3200); return; }
  const err = saveLocation(d.char.id, d.cs.stop.snapId, ref);
  if (err) { say(`<b>${esc(d.char.name)}</b><span class="err">${esc(err)}</span>`, 4000); return; }
  say(`<b>${esc(d.char.name)}</b><span class="here">${esc(where)}</span><span>Saved to the Dossier${d.cs.stop.ch != null ? ' · chapter ' + d.cs.stop.ch : ''}.</span>`, 2600);
  setTimeout(() => {
    if (drag.active) return;
    const data = loadCharacters(); Object.assign(state, { chars: data.chars, chapters: data.chapters, titles: data.titles, demo: data.demo });
    refreshMarkers(); renderLegend(); setChapterUI();
  }, 1000);
}
// ---- chapter travel: when the chapter changes, each sword flies from where it was to its next place
const travels = [];
function pinPositions() {
  const out = {};
  pickables.forEach(h => { const pin = h.userData.pin; if (pin && h.userData.char) out[h.userData.char.id] = { pos: pin.position.clone(), q: pin.quaternion.clone() }; });
  return out;
}
function flyToChapter(before) {
  travels.splice(0).forEach(tr => tr.finish());
  let i = 0;
  pickables.forEach(h => {
    const pin = h.userData.pin; if (!pin || !h.userData.char) return;
    const from = before[h.userData.char.id], to = { pos: pin.position.clone(), q: pin.quaternion.clone() }, scale = h.userData.scale;
    if (from && from.pos.distanceTo(to.pos) < 0.05 * scale) return;            // stayed put
    const nrm = p => state.view === 'planet' ? p.clone().normalize() : UP.clone();
    const start = from || { pos: to.pos.clone().addScaledVector(nrm(to.pos), 4 * scale), q: to.q.clone(), drop: true };
    travels.push(makeTravel(pin, start, to, scale, i++ * 0.14, nrm));
  });
}
function makeTravel(pin, A, B, scale, delay, nrm) {
  const s = pin.scale.x, nA = nrm(A.pos), nB = nrm(B.pos), lift = 0.7 * scale;
  const upA = new THREE.Vector3(0, 1, 0).applyQuaternion(A.q);
  const a1 = A.pos.clone().addScaledVector(upA, s * 0.15).addScaledVector(nA, lift);     // pulled out, hovering
  const b1 = B.pos.clone().addScaledVector(nB, lift + 0.4 * scale);                       // above the landing
  const dist = a1.distanceTo(b1), planet = state.view === 'planet';
  const path = u => {                                                                      // an arc from a1 to b1
    if (planet) {
      const ra = a1.length(), rb = b1.length(), dir = a1.clone().normalize().lerp(b1.clone().normalize(), u).normalize();
      return dir.multiplyScalar(ra + (rb - ra) * u + Math.sin(Math.PI * u) * (dist * 0.3 + 0.4 * scale));
    }
    return a1.clone().lerp(b1, u).addScaledVector(UP, Math.sin(Math.PI * u) * (dist * 0.28 + 0.8 * scale));
  };
  const T_OUT = A.drop ? 0 : 0.3, T_FLY = A.drop ? 0.25 : Math.min(1.6, 0.6 + dist / (14 * scale)), T_DIVE = 0.22, T_WOB = 0.5;
  const qFly = new THREE.Quaternion(), tmp = new THREE.Vector3();
  pin.position.copy(A.pos); pin.quaternion.copy(A.q); pin.userData.travelling = true; pin.userData.built?.setFree(true);
  let t = -delay, landed = false, started = false;
  const tr = {
    step(dt) {
      t += dt; if (t < 0) return false;
      if (!started) { started = true; if (!A.drop) burst(A.pos, nA, scale, false); }
      if (t < T_OUT) {                                                   // strain and pull free
        const k = smooth01(t / T_OUT), w = Math.sin(t * 60) * 0.05 * (1 - k);
        pin.quaternion.copy(A.q).slerp(qFly.setFromUnitVectors(UP, nA), k).premultiply(qTilt.setFromAxisAngle(tangents(nA)[0], w));
        pin.position.copy(A.pos).lerp(a1, k * k);
      } else if (t < T_OUT + T_FLY) {                                    // fly the arc, point first
        const u = (t - T_OUT) / T_FLY, e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        const p = path(e), ahead = path(Math.min(1, e + 0.02));
        pin.position.copy(p);
        tmp.copy(ahead).sub(p);
        if (tmp.lengthSq() > 1e-8) { const want = qFly.setFromUnitVectors(UP, tmp.normalize().negate()); pin.quaternion.slerp(want, Math.min(1, dt * 10)); }
      } else if (t < T_OUT + T_FLY + T_DIVE) {                           // turn point-down and dive in
        const k = (t - T_OUT - T_FLY) / T_DIVE;
        pin.quaternion.slerp(B.q, Math.min(1, dt * 18));
        pin.position.copy(b1).lerp(B.pos.clone().addScaledVector(nB, -0.06 * scale), k * k);
      } else {
        if (!landed) { landed = true; pin.quaternion.copy(B.q); burst(B.pos, nB, scale, true); impact(B.pos, nB, null, 0.4, scale); }
        const k = t - T_OUT - T_FLY - T_DIVE, settle = Math.exp(-6 * k);
        pin.position.copy(B.pos).addScaledVector(nB, -0.06 * scale * settle);
        pin.quaternion.copy(B.q).premultiply(qTilt.setFromAxisAngle(tangents(nB)[0], Math.sin(k * 24) * 0.14 * settle));
        if (k > T_WOB) { this.finish(); return true; }
      }
      return false;
    },
    finish() { pin.position.copy(B.pos); pin.quaternion.copy(B.q); pin.userData.travelling = false; pin.userData.built?.setFree(false); }
  };
  return tr;
}
// press on a sword: a click (no movement) still focuses it; a drag picks it up
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || drag.active || state.era !== 1) return;
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const hit = pick();
  if (!hit || !hit.userData.pin || hit.userData.pin.userData.travelling) return;
  e.stopImmediatePropagation();                 // the camera stays put while a sword is held
  drag.pending = { hit, x: e.clientX, y: e.clientY, id: e.pointerId };
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
}, { capture: true });
canvas.addEventListener('pointermove', e => {
  if (drag.pending && !drag.active && Math.hypot(e.clientX - drag.pending.x, e.clientY - drag.pending.y) > 5) { beginDrag(drag.pending.hit, e); drag.pending = null; }
  if (drag.active) moveDrag(e);
}, { capture: true });
const finishPress = e => {
  if (drag.pending) {                           // it was a click: focus the sword as before
    const p = drag.pending; drag.pending = null;
    try { canvas.releasePointerCapture(p.id); } catch (err) {}
    e.stopImmediatePropagation(); focusOn(p.hit); openPinCloseup(p.hit.userData); return;
  }
  if (drag.active) { e.stopImmediatePropagation(); releaseDrag(); }
};
canvas.addEventListener('pointerup', finishPress, { capture: true });
canvas.addEventListener('pointercancel', finishPress, { capture: true });
canvas.addEventListener('wheel', e => {
  const d = drag.active; if (!d || !(d.phase === 'carry' || d.phase === 'lift')) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
  d.Lt = Math.min(d.Lmax, Math.max(d.Lmin, d.Lt + px * 0.0025 * d.scale));     // scroll down: more thread
}, { capture: true, passive: false });
addEventListener('keydown', e => {
  const d = drag.active; if (e.key !== 'Escape' || !d || d.phase !== 'carry') return;
  d.fallFrom = d.pin.position.clone(); d.fallQ = d.pin.quaternion.clone(); d.t = 0;
  d.letGo = { anchor: d.hand.clone(), pommel: d.pin.position.clone().add(tmpB.set(0, d.pin.scale.x, 0).applyQuaternion(d.fallQ)) };
  d.dest = { pos: d.home.pos.clone(), normal: d.home.normal.clone() }; d.phase = 'return';
});

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let frameCount = 0;
renderer.setAnimationLoop(() => {
  if (closeupOpen()) { clock.getDelta(); return; }         // the close-up has the screen; the map waits
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  // era wave: linear progress so the rebuild travels evenly from the strike point
  if (state.eraT !== state.era) {
    state.eraT += Math.sign(state.era - state.eraT) * Math.min(Math.abs(state.era - state.eraT), dt * 0.5);
    const prog = state.era === 1 ? state.eraT : 1 - state.eraT;
    eraHooks.forEach(f => f(state.era === 1 ? prog : 1 - prog, state.era));
    if (state.eraT === state.era && eraBusy) {
      eraBusy = false; const before = pinPositions(); rebuildKeepCamera();
      if (state.era === 1 && !reduceMotion && !eraReturn) flyToChapter(before);   // (the wave return handles the swords when it's running)
    }
  }
  stepViewFx(dt);
  if (state.focus) {
    controls.target.x = damp(controls.target.x, state.focus.target.x, 5, dt);
    controls.target.y = damp(controls.target.y, state.focus.target.y, 5, dt);
    controls.target.z = damp(controls.target.z, state.focus.target.z, 5, dt);
    camera.position.lerp(state.focus.pos, 1 - Math.exp(-5 * dt));
    camera.zoom = damp(camera.zoom, state.focus.zoom, 5, dt); camera.updateProjectionMatrix();
    if (camera.position.distanceTo(state.focus.pos) < 0.01 && Math.abs(camera.zoom - state.focus.zoom) < 0.002) state.focus = null;
  }
  animated.forEach(f => f(time, dt));
  markerAnim.forEach(f => f(time, dt));
  updatePins(dt, time);
  controls.update();
  if (state.view === 'planet') key.shadow.needsUpdate = true;
  if ((frameCount++ & 1) === 0 && !drag.active) {
    const hit = pointer.x < 2 ? pick() : null;
    if (hit !== hovered) {
      if (hovered && hovered.material.emissive && !hovered.userData.earth) hovered.material.emissiveIntensity = hovered.userData.baseEmissive ?? hovered.material.emissiveIntensity;
      hovered = hit;
      if (hit && hit.material.emissive && !hit.userData.earth) { hit.userData.baseEmissive = hit.userData.baseEmissive ?? hit.material.emissiveIntensity; hit.material.emissiveIntensity = 0.9; if (hit.material.emissive.getHex() === 0) hit.material.emissive.set('#553a10'); }
      tip.hidden = !hit; if (hit) tip.innerHTML = describe(hit);
      canvas.style.cursor = hit ? (hit.userData.pin ? 'grab' : 'pointer') : '';
    }
  }
  // camera jolt after an impact: a short, fast, decaying shake
  let jolt = null;
  if (shake.t < 0.45 && shake.amp > 0) {
    shake.t += dt; const k = Math.max(0, 1 - shake.t / 0.45) ** 2;
    jolt = new THREE.Vector3(Math.sin(time * 91) * 0.8, Math.sin(time * 77 + 1) * 0.6, Math.sin(time * 83 + 2) * 0.8).multiplyScalar(shake.amp * k);
    camera.position.add(jolt);
  }
  renderer.render(scene, camera);
  if (jolt) camera.position.sub(jolt);
  updateLabels();
});
addEventListener('resize', frame);

// ------------------------------------------------------------------ start
async function start() {
  await Promise.all([loadData(), loadPin()]);
  const data = loadCharacters();
  Object.assign(state, { chars: data.chars, chapters: data.chapters, titles: data.titles, demo: data.demo });
  state.chapter = state.chapters.length ? state.chapters[state.chapters.length - 1] : null;
  try {
    const p = JSON.parse(localStorage.getItem('epitaph-map-prefs') || 'null');
    if (p) { if (['planet', 'earth'].includes(p.view)) state.view = p.view; if (THEMES[p.theme]) state.theme = p.theme; if (p.era === 0) { state.era = 0; state.eraT = 0; } }
  } catch (e) {}
  const q = new URLSearchParams(location.search);
  const oldView = { globe: 'planet', relief: 'earth', shattered: 'earth' }[q.get('view')];   // links to the old Atlas 3D
  if (oldView) state.view = oldView;
  if (['planet', 'earth'].includes(q.get('view'))) state.view = q.get('view');
  if (q.get('era') === '1') { state.era = 1; state.eraT = 1; }
  if (THEMES[q.get('theme')]) state.theme = q.get('theme');
  if (q.get('era') === '0') { state.era = 0; state.eraT = 0; }
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x.dataset.view === state.view));
  document.querySelectorAll('[data-theme-btn]').forEach(x => x.classList.toggle('on', x.dataset.themeBtn === state.theme));
  document.querySelectorAll('[data-era]').forEach(x => x.classList.toggle('on', +x.dataset.era === state.era));
  setChapterUI();
  if (isSmall()) $('legend').classList.remove('open');
  build(); goHome(true); renderLegend();
  $('boot').hidden = true;
  // deep links (formerly the 2D Atlas): ?item=<id> opens it in the Library; ?char=<id>[&ch=<n>] opens their record there
  const itemId = q.get('item');
  if (itemId && LibUI && window.EpitaphLibrary && EpitaphLibrary.item(itemId)) LibUI.open('items', { mode: 'itemDetail', id: itemId });
  const charId = q.get('char'), ch = parseInt(q.get('ch'), 10);
  if (charId && state.chars.some(c => c.id === charId)) {
    if (state.era !== 1) setEra(1);
    if (Number.isInteger(ch) && state.chapters.includes(ch)) setChapter(ch);
    openRecord(charId);
    const tok = pickables.find(p => p.userData.char && p.userData.char.id === charId); if (tok) focusOn(tok);
  }
}
start().catch(err => { $('boot').textContent = 'Could not load the map: ' + err; console.error(err); });
addEventListener('storage', e => { if (e.key === 'epitaph-character-profiles' || e.key === 'epitaph-library') { const d = loadCharacters(); Object.assign(state, { chars: d.chars, chapters: d.chapters, titles: d.titles, demo: d.demo }); setChapterUI(); rebuildKeepCamera(); renderLegend(); } });
