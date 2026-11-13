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
    groups: { VOIDED: '#9b8cff', STORYBORN: '#6fb3a3', ANTHOLONIUS: '#e3b95c', FALLEN: '#d4452b', OTHER: '#b5904f' }
  },
  paper: {
    bg: '#f6eddd', sea: '#c9d6e6', seaLine: '#9fb2cc', land: '#9cc27a', landHi: '#f4efe4',
    ink: '#141a2c', city: '#ffffff', glow: '#ff8a3d', atmo: '#f2b35a', grid: '#7a5532',
    hemiSky: '#fffaf3', hemiGround: '#c2ae90', key: '#fff6ea', env: 0.4, exposure: 1.0,
    shadow: '#7a5532', shadowOpacity: 0.3, outlinePx: 1.3,
    seaBands: ['#6a86c4', '#5470b0', '#45609e', '#38508a'], flood: '#1aa39a', rock: '#8a7a66', ice: '#ffffff',
    ghost: '#d9ccb2', binding: '#141a2c', sunk: '#1aa39a', edge: '#141a2c',
    groups: { VOIDED: '#6a5acd', STORYBORN: '#3fa08a', ANTHOLONIUS: '#e0a02a', FALLEN: '#e8392e', OTHER: '#9c7a4a' }
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
    uniforms: { uColor: { value: new THREE.Color(color) }, uPx: { value: px }, uRes: { value: new THREE.Vector2(1, 1) } },
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
    const stops = versions.map(s => ({ ch: s.startChapter, presence: s.presence || 'alive', r: World.resolve(s.location) })).filter(s => s.r && num(s.r.lat) && num(s.r.lng));
    if (!stops.length) {
      const snap = (c.snapshots || []).find(s => s.id === c.activeSnapshotId) || (c.snapshots || [])[0];
      const r = snap && World.resolve(snap.location);
      if (r && num(r.lat)) stops.push({ ch: null, presence: snap.presence || 'alive', r });
    }
    return { id: c.id, name: c.name || 'Unnamed', color: CHAR_COLORS[i % CHAR_COLORS.length], stops };
  }).filter(c => c.stops.length);
  const chapters = new Set((st && st.chapters || []).map(c => c.number).filter(Number.isInteger));
  chars.forEach(c => c.stops.forEach(s => Number.isInteger(s.ch) && chapters.add(s.ch)));
  const titles = {}; (st && st.chapters || []).forEach(c => { if (Number.isInteger(c.number)) titles[c.number] = c.title || ''; });
  if (chars.length) return { chars, chapters: [...chapters].sort((a, b) => a - b), titles, demo: false };
  const stop = (ch, id) => ({ ch, presence: 'alive', r: World.resolve({ placeId: id }) });
  return {
    demo: true, titles: {}, chapters: [1, 2, 3, 4, 5],
    chars: [
      { id: 'demo-orin', name: 'Orin (demo)', color: CHAR_COLORS[0], stops: [stop(1, 'aurelia'), stop(3, 'cairo'), stop(4, 'voided-settlement-001'), stop(5, 'temple-voided-001')] },
      { id: 'demo-b', name: 'Second (demo)', color: CHAR_COLORS[1], stops: [stop(1, 'johannesburg'), stop(3, 'storyborn-church-001'), stop(5, 'antholonius-temple-003')] }
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
function placeOn(obj, at, scale = 1) { obj.position.copy(at.pos); obj.quaternion.setFromUnitVectors(UP, at.normal); obj.scale.setScalar(scale); }
let arcBetween = null;

// places + characters + trails on the current surface
function addMarkers(T, markerScale, parent = root) {
  const era = state.era;
  const byKey = {};
  placesFor(era).forEach(p => {
    const [u, v] = eeUV(p.lng, p.lat);
    const here = earthAt(u, v, era);
    const sunk = era === 1 && !p.group && !p.fictional && (here.kind === 'sunk' || here.kind === 'sea');
    const kind = markerGeo[p.kind] ? p.kind : 'other';
    const color = p.group ? (T.groups[p.group] || T.groups.OTHER) : sunk ? T.sunk : p.fictional ? T.groups.STORYBORN : T.city;
    const m = new THREE.Mesh(sunk ? markerGeo.ruin : markerGeo[kind], mat(color, { roughness: 0.5, emissive: p.group ? color : '#000', emissiveIntensity: p.group ? 0.35 : 0, transparent: sunk, opacity: sunk ? 0.75 : 1 }));
    const k = p.lat.toFixed(1) + ',' + p.lng.toFixed(1);
    const n = byKey[k] = (byKey[k] || 0) + 1;
    placeOn(m, surface(p.lat - (n - 1) * 0.8, p.lng + (n - 1) * 1.2), markerScale * (sunk ? 0.8 : 1));
    m.castShadow = true;
    m.userData.place = p; m.userData.sunk = sunk;
    withOutline(m, T);
    parent.add(m); pickables.push(m);
  });
  if (era !== 1) return;     // the story's chapters all take place in Era 1
  const stacks = {};
  state.chars.forEach(c => {
    const cs = charStateAt(c, state.chapter);
    if (!cs) return;
    const r = cs.stop.r, n = stacks[r.key] = (stacks[r.key] || 0) + 1;
    const at = surface(r.lat, r.lng), dead = cs.stop.presence === 'dead';
    const t = new THREE.Mesh(dead ? markerGeo.dead : markerGeo.token, mat(c.color, { roughness: 0.35, emissive: c.color, emissiveIntensity: 0.25 }));
    placeOn(t, at, markerScale * 1.15);
    const side = new THREE.Vector3().crossVectors(at.normal, Math.abs(at.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP).normalize();
    const fwd = new THREE.Vector3().crossVectors(side, at.normal);
    const ang = (n - 1) * 2.1, rad = n > 1 ? 0.28 * markerScale : 0;
    t.position.addScaledVector(side, Math.cos(ang) * rad).addScaledVector(fwd, Math.sin(ang) * rad).addScaledVector(at.normal, 0.04);
    t.castShadow = true; t.userData.char = c; t.userData.charState = cs;
    withOutline(t, T);
    parent.add(t); pickables.push(t);
    const base = t.position.clone();
    if (!reduceMotion && !dead) animated.push(time => { t.position.copy(base).addScaledVector(at.normal, Math.sin(time * 2 + n) * 0.03 * markerScale); });
    labels.push({ obj: t, text: (dead ? '† ' : '') + c.name, color: c.color, offset: 0.62 * markerScale, normal: at.normal });
    const pts = cs.path.map(s => s.r).filter((q, i, a) => i === 0 || q.key !== a[i - 1].key);
    for (let i = 1; i < pts.length; i++) {
      const curve = arcBetween(pts[i - 1], pts[i]), newest = i === pts.length - 1;
      parent.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, (newest ? 0.035 : 0.022) * markerScale, 6, false), new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: newest ? 0.95 : 0.45 })));
      if (newest && !reduceMotion) {
        const spark = new THREE.Mesh(new THREE.SphereGeometry(0.07 * markerScale, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff' }));
        parent.add(spark);
        animated.push(time => { spark.position.copy(curve.getPointAt((time * 0.25) % 1)); });
      }
    }
  });
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
  const maxD = Math.max(...cells.map(c => c.d));
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
    const p0 = surface(a.lat, a.lng).pos, p1 = surface(b.lat, b.lng).pos;
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
  const maxD = Math.max(...earthCells.map(c => c.d));
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
    const pa = surface(a.lat, a.lng).pos, pb = surface(b.lat, b.lng).pos, pts = [];
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
    const facing = n.dot(camDir) < 0.15;
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
  pickables = []; animated = []; labels = []; eraHooks = []; state.planet = null;
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
  if (state.era === 1) k.push([T.sunk, 'Sunk city (+60 m)'], [T.groups.STORYBORN, 'Storyborn'], [T.groups.VOIDED, 'Voided (hidden)'], [T.groups.ANTHOLONIUS, 'Antholonius'], [T.groups.FALLEN, 'Fallen (none yet)']);
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
    li.querySelector('button').addEventListener('click', () => { const tok = pickables.find(p => p.userData.char && p.userData.char.id === c.id); if (tok) focusOn(tok); });
    ul.appendChild(li);
  });
  $('demoNote').hidden = !state.demo;
}
function setChapterUI() {
  const idx = state.chapters.indexOf(state.chapter);
  $('chapterRange').max = Math.max(0, state.chapters.length - 1);
  $('chapterRange').value = idx < 0 ? state.chapters.length - 1 : idx;
  $('chapterRange').disabled = state.chapters.length < 2 || state.era !== 1;
  const ch = state.chapter;
  $('chapterLabel').textContent = state.era !== 1 ? 'Era 0' : ch == null ? 'Latest' : 'Ch ' + String(ch).padStart(2, '0') + (state.titles[ch] && !state.demo ? ' · ' + state.titles[ch] : '');
}
function setChapter(ch) { state.chapter = ch; setChapterUI(); rebuildKeepCamera(); renderLegend(); }
const remember = () => { try { localStorage.setItem('epitaph-map-prefs', JSON.stringify({ view: state.view, theme: state.theme, era: state.era })); } catch (e) {} };
function setView(v) {
  if (state.view === v) return;
  state.view = v; remember();
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x.dataset.view === v));
  build(); goHome(true); renderLegend();
}
let eraBusy = false;
function setEra(era) {
  if (state.era === era) return;
  state.era = era; remember();
  document.querySelectorAll('[data-era]').forEach(x => x.classList.toggle('on', +x.dataset.era === era));
  eraBusy = true;            // markers are rebuilt once the wave has finished
  renderLore(); renderKeys(); setChapterUI(); renderLegend();
  if (reduceMotion) { state.eraT = era; rebuildKeepCamera(); eraBusy = false; }
}

document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
document.querySelectorAll('[data-era]').forEach(b => b.addEventListener('click', () => setEra(+b.dataset.era)));
document.querySelectorAll('[data-theme-btn]').forEach(b => b.addEventListener('click', () => {
  state.theme = b.dataset.themeBtn; remember();
  document.querySelectorAll('[data-theme-btn]').forEach(x => x.classList.toggle('on', x === b));
  rebuildKeepCamera();
}));
$('chapterRange').addEventListener('input', e => setChapter(state.chapters[+e.target.value] ?? null));
$('prevCh').addEventListener('click', () => { const i = state.chapters.indexOf(state.chapter); if (i > 0) setChapter(state.chapters[i - 1]); });
$('nextCh').addEventListener('click', () => { const i = state.chapters.indexOf(state.chapter); if (i >= 0 && i < state.chapters.length - 1) setChapter(state.chapters[i + 1]); });
$('homeBtn').addEventListener('click', () => { state.spin = true; goHome(false); });
$('legendToggle').addEventListener('click', () => $('legend').classList.toggle('open'));

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
  focusOn(hit);
});
function pick() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  return hits.length ? hits[0].object : null;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function describe(obj) {
  if (obj.userData.earth) return '<b>Earth</b><span>An island on Epitaph. Click to open the board.</span>';
  if (obj.userData.char) {
    const { char, charState } = obj.userData, s = charState.stop;
    return `<b>${esc(char.name)}</b><span>${s.presence === 'dead' ? 'Died at' : 'At'} ${esc(s.r.label)}</span>` + (s.ch != null ? `<span>From chapter ${s.ch}</span>` : '');
  }
  const p = obj.userData.place;
  const here = state.era === 1 ? state.chars.filter(c => { const cs = charStateAt(c, state.chapter); return cs && cs.stop.r.place && cs.stop.r.place.id === p.id; }) : [];
  const co = World.country(p.countryId);
  return `<b>${esc(p.name)}</b><span>${esc(World.KIND_LABEL[p.kind] || 'Place')}${co ? ' · ' + esc(co.name) : ''}</span>` +
    (obj.userData.sunk ? '<span>Sunk: the sea rose ~60 m in Era 1.</span>' : '') +
    (p.fictional ? '<span>Era 1 settlement</span>' : '') +
    (p.group ? `<span>${esc((World.SITE_GROUPS.find(g => g.id === p.group) || {}).label || p.group)} site${p.group === 'VOIDED' ? ' · hidden' : ''}</span>` : '') +
    (here.length ? `<span class="here">Here: ${here.map(c => esc(c.name)).join(', ')}</span>` : '');
}

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let frameCount = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  // era wave: linear progress so the rebuild travels evenly from the strike point
  if (state.eraT !== state.era) {
    state.eraT += Math.sign(state.era - state.eraT) * Math.min(Math.abs(state.era - state.eraT), dt * 0.5);
    const prog = state.era === 1 ? state.eraT : 1 - state.eraT;
    eraHooks.forEach(f => f(state.era === 1 ? prog : 1 - prog, state.era));
    if (state.eraT === state.era && eraBusy) { eraBusy = false; rebuildKeepCamera(); }
  }
  if (state.focus) {
    controls.target.x = damp(controls.target.x, state.focus.target.x, 5, dt);
    controls.target.y = damp(controls.target.y, state.focus.target.y, 5, dt);
    controls.target.z = damp(controls.target.z, state.focus.target.z, 5, dt);
    camera.position.lerp(state.focus.pos, 1 - Math.exp(-5 * dt));
    camera.zoom = damp(camera.zoom, state.focus.zoom, 5, dt); camera.updateProjectionMatrix();
    if (camera.position.distanceTo(state.focus.pos) < 0.01 && Math.abs(camera.zoom - state.focus.zoom) < 0.002) state.focus = null;
  }
  animated.forEach(f => f(time, dt));
  controls.update();
  if (state.view === 'planet') key.shadow.needsUpdate = true;
  if ((frameCount++ & 1) === 0) {
    const hit = pointer.x < 2 ? pick() : null;
    if (hit !== hovered) {
      if (hovered && hovered.material.emissive && !hovered.userData.earth) hovered.material.emissiveIntensity = hovered.userData.baseEmissive ?? hovered.material.emissiveIntensity;
      hovered = hit;
      if (hit && hit.material.emissive && !hit.userData.earth) { hit.userData.baseEmissive = hit.userData.baseEmissive ?? hit.material.emissiveIntensity; hit.material.emissiveIntensity = 0.9; if (hit.material.emissive.getHex() === 0) hit.material.emissive.set('#553a10'); }
      tip.hidden = !hit; if (hit) tip.innerHTML = describe(hit);
      canvas.style.cursor = hit ? 'pointer' : '';
    }
  }
  renderer.render(scene, camera);
  updateLabels();
});
addEventListener('resize', frame);

// ------------------------------------------------------------------ start
async function start() {
  await loadData();
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
}
start().catch(err => { $('boot').textContent = 'Could not load the map: ' + err; console.error(err); });
addEventListener('storage', e => { if (e.key === 'epitaph-character-profiles' || e.key === 'epitaph-library') { const d = loadCharacters(); Object.assign(state, { chars: d.chars, chapters: d.chapters, titles: d.titles, demo: d.demo }); setChapterUI(); rebuildKeepCamera(); renderLegend(); } });
