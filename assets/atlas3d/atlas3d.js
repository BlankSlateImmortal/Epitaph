/* Epitaph — 3D Atlas (three.js, built entirely in code, no model files).
 *
 * Three looks over the same data:
 *   relief    a flat map table: land extruded with bevels, your countries raised
 *   globe     a planet of hexagonal columns, your countries taller and lit
 *   shattered Era 1: terraced voxel land cut by rifts, loose fragments floating
 *
 * Shared "illustrated" recipe (same idea as an orthographic product render):
 *   - OrthographicCamera, no perspective distortion
 *   - screen-space ink outlines (an inverted hull pushed out a fixed number of pixels)
 *   - hemisphere + key light, RoomEnvironment reflections, soft shadow on a
 *     transparent ShadowMaterial ground
 *   - everything eased with damp() so moves glide
 *
 * Data: assets/epitaph-world.js (places), assets/epitaph-library.js (your added
 * places), and the Dossier's localStorage ('epitaph-character-profiles') for
 * where each character is at each chapter. With no characters saved, a clearly
 * labelled demo trail is shown.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAND, BORDERS, COUNTRIES } from './geo.js';

const World = window.EpitaphWorld;
const $ = id => document.getElementById(id);
const num = v => typeof v === 'number' && isFinite(v);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = () => Math.min(innerWidth, innerHeight) < 640;

// ------------------------------------------------------------------ palettes
const THEMES = {
  crt: {
    bg: '#080603', sea: '#120c06', seaLine: '#3a2810', land: '#5e4423', landHi: '#8a6a3c',
    country: '#e09a32', countryHi: '#ffc864', ink: '#040302', border: '#2a1c0a',
    city: '#f1e6cf', fictional: '#e3b95c', glow: '#ffb238', atmo: '#ffb238', grid: '#ffb238',
    hemiSky: '#fff1d8', hemiGround: '#3a2a14', key: '#ffe6c0', env: 0.25, exposure: 1.05,
    shadow: '#000000', shadowOpacity: 0.55, outlinePx: 1.4,
    groups: { VOIDED: '#9b8cff', STORYBORN: '#6fb3a3', ANGEL: '#f1e6cf', DEMON: '#d4452b', ANTHOLONIUS: '#e3b95c', OTHER: '#b5904f' }
  },
  paper: {
    bg: '#f6eddd', sea: '#e7dcc6', seaLine: '#c9b896', land: '#efe2c8', landHi: '#fff6e6',
    country: '#f2b35a', countryHi: '#ffd28a', ink: '#141a2c', border: '#b8a37c',
    city: '#ffffff', fictional: '#f2c23a', glow: '#e8392e', atmo: '#f2b35a', grid: '#7a5532',
    hemiSky: '#fffaf3', hemiGround: '#c2ae90', key: '#fff6ea', env: 0.4, exposure: 1.0,
    shadow: '#7a5532', shadowOpacity: 0.32, outlinePx: 1.3,
    groups: { VOIDED: '#6a5acd', STORYBORN: '#3fa08a', ANGEL: '#ffffff', DEMON: '#e8392e', ANTHOLONIUS: '#e0a02a', OTHER: '#9c7a4a' }
  }
};
const CHAR_COLORS = ['#d4452b', '#6fb3a3', '#e3b95c', '#9b8cff', '#f1e6cf', '#ff7a45', '#7fc8ff', '#c78bd8'];

// ------------------------------------------------------------------ small math helpers
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
    const u = fade(x), v = fade(y);
    const a = perm[X] + Y, b = perm[X + 1] + Y;
    return lerp(lerp(grad(perm[a], x, y), grad(perm[b], x - 1, y), u),
                lerp(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u), v);
  };
}
const noise = makeNoise(7), noiseB = makeNoise(31);
const fbm = (x, y) => noise(x, y) * 0.6 + noise(x * 2.1, y * 2.1) * 0.28 + noise(x * 4.3, y * 4.3) * 0.12;

function ringBox(r) { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (let i = 0; i < r.length; i += 2) { a = Math.min(a, r[i]); b = Math.max(b, r[i]); c = Math.min(c, r[i + 1]); d = Math.max(d, r[i + 1]); } return [a, b, c, d]; }
function inRing(x, y, r) {
  let c = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function makeHitTest(polys) {
  const boxed = polys.map(p => ({ p, b: ringBox(p[0]) }));
  return (lng, lat) => {
    if (lng < -150) { for (const { p, b } of boxed) if (b[1] > 180 && hit(p, b, lng + 360, lat)) return true; }
    for (const { p, b } of boxed) if (hit(p, b, lng, lat)) return true;
    return false;
  };
  function hit(p, b, lng, lat) {
    {
      if (lng < b[0] || lng > b[1] || lat < b[2] || lat > b[3]) return false;
      if (!inRing(lng, lat, p[0])) return false;
      for (let k = 1; k < p.length; k++) if (inRing(lng, lat, p[k])) return false;
      return true;
    }
  }
}
const onLand = makeHitTest(LAND);
// Antarctica is a nominal territory in the World Database; it isn't raised or lit.
const MY_COUNTRIES = Object.fromEntries(Object.entries(COUNTRIES).filter(([id]) => id !== 'antarctic-territories'));
const countryTests = Object.entries(MY_COUNTRIES).map(([id, polys]) => [id, makeHitTest(polys)]);
const countryAt = (lng, lat) => { for (const [id, t] of countryTests) if (t(lng, lat)) return id; return null; };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const latLngToVec = (lat, lng) => {
  const phi = (90 - lat) * Math.PI / 180, th = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(-Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
};

// ------------------------------------------------------------------ ink outline (screen-space inverted hull)
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
// Smooth normals so the pushed-out hull has no cracks at hard corners.
function hullGeometry(geo) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.getAttribute('position').clone());
  if (geo.index) g.setIndex(geo.index.clone());
  const m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  return m;
}
function withOutline(mesh, theme, px) {
  const geo = hullGeometry(mesh.geometry);
  const mat = outlineMaterial(theme.ink, px ?? theme.outlinePx);
  const o = mesh.isInstancedMesh ? new THREE.InstancedMesh(geo, mat, mesh.count) : new THREE.Mesh(geo, mat);
  if (mesh.isInstancedMesh) o.instanceMatrix = mesh.instanceMatrix;
  o.raycast = () => {};
  mesh.add(o);
  mesh.userData.outline = o;
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
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;
controls.zoomSpeed = 1.2;

const hemi = new THREE.HemisphereLight('#fff', '#000', 1);
const key = new THREE.DirectionalLight('#fff', 1.6);
key.castShadow = true;
key.shadow.mapSize.set(isSmall() ? 2048 : 4096, isSmall() ? 2048 : 4096);
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
const fill = new THREE.DirectionalLight('#ffd9a0', 0.35);
scene.add(hemi, key, key.target, fill);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(9, 9);

const state = {
  view: 'relief', theme: 'crt',
  chapter: null, chapters: [],
  chars: [], demo: false,
  focus: null,          // { target: Vector3, zoom }
  spin: true, lastInteract: 0,
};

// ------------------------------------------------------------------ data
function loadCharacters() {
  let st = null;
  try { st = JSON.parse(localStorage.getItem('epitaph-character-profiles') || 'null'); } catch (e) { st = null; }
  const list = (st && Array.isArray(st.characters)) ? st.characters : [];
  const chars = list.map((c, i) => {
    const versions = (c.snapshots || []).filter(s => Number.isInteger(s.startChapter)).sort((a, b) => a.startChapter - b.startChapter);
    const stops = versions.map(s => ({ ch: s.startChapter, presence: s.presence || 'alive', r: World.resolve(s.location) }))
      .filter(s => s.r && num(s.r.lat) && num(s.r.lng));
    if (!stops.length) {   // no chapter numbers: fall back to the active version's place
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

  // Demo, only when the Dossier has nobody placed yet.
  const stop = (ch, id, presence = 'alive') => ({ ch, presence, r: World.resolve({ placeId: id }) });
  return {
    demo: true, titles: { 1: 'Demo', 2: 'Demo', 3: 'Demo', 4: 'Demo', 5: 'Demo' }, chapters: [1, 2, 3, 4, 5],
    chars: [
      { id: 'demo-orin', name: 'Orin (demo)', color: CHAR_COLORS[0], stops: [stop(1, 'johannesburg'), stop(2, 'demon-settlement-001'), stop(3, 'cairo'), stop(4, 'voided-settlement-001'), stop(5, 'temple-voided-001')] },
      { id: 'demo-b', name: 'Second (demo)', color: CHAR_COLORS[1], stops: [stop(1, 'johannesburg'), stop(3, 'storyborn-church-001'), stop(5, 'antholonius-temple-003')] }
    ].map(c => ({ ...c, stops: c.stops.filter(s => s.r) }))
  };
}
// Where each character is at the selected chapter, and the path that led there.
function charStateAt(c, ch) {
  if (ch == null) { const s = c.stops[c.stops.length - 1]; return { stop: s, path: c.stops }; }
  const upTo = c.stops.filter(s => s.ch == null || s.ch <= ch);
  if (!upTo.length) return null;
  const dead = upTo.find(s => s.presence === 'dead');
  return { stop: dead || upTo[upTo.length - 1], path: dead ? upTo.slice(0, upTo.indexOf(dead) + 1) : upTo };
}
const mappedPlaces = () => World.places().filter(p => num(p.lat) && num(p.lng));

// ------------------------------------------------------------------ view building blocks
let root = null;          // everything that belongs to the current view
let pickables = [];       // meshes the pointer can hover
let animated = [];        // per-frame callbacks for the current view
let surface = null;       // (lat, lng) -> { pos, normal } for the current view

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.0, envMapIntensity: 1, ...opts });
}
function shadowGround(theme, y, size) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
    new THREE.ShadowMaterial({ color: theme.shadow, opacity: theme.shadowOpacity, depthWrite: false }));
  g.rotation.x = -Math.PI / 2; g.position.y = y; g.receiveShadow = true; g.renderOrder = -1;
  return g;
}
function gridLines(theme, y, size, step, opacity) {
  const pts = [];
  for (let v = -size / 2; v <= size / 2 + 1e-6; v += step) { pts.push(v, y, -size / 2, v, y, size / 2, -size / 2, y, v, size / 2, y, v); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: theme.grid, transparent: true, opacity, depthWrite: false }));
}

// Flat projection: 1 degree = S units. x east, -z north.
// Below 60°S latitude is squeezed so Antarctica is a strip, not a wall.
const S = 0.1;
const fy = lat => lat >= -60 ? lat : -60 + (lat + 60) * 0.3;
function shapesFrom(polys, minArea = 0) {
  const out = [];
  for (const p of polys) {
    const outer = p[0];
    const pts = []; for (let i = 0; i < outer.length - 2; i += 2) pts.push(new THREE.Vector2(outer[i] * S, fy(outer[i + 1]) * S));
    if (Math.abs(THREE.ShapeUtils.area(pts)) < minArea) continue;
    const sh = new THREE.Shape(pts);
    for (let k = 1; k < p.length; k++) {
      const h = []; for (let i = 0; i < p[k].length - 2; i += 2) h.push(new THREE.Vector2(p[k][i] * S, fy(p[k][i + 1]) * S));
      sh.holes.push(new THREE.Path(h));
    }
    out.push(sh);
  }
  return out;
}
function extrudeFlat(shapes, depth, bevel) {
  const geos = shapes.map(sh => {
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
    g.rotateX(-Math.PI / 2);
    return g;
  });
  const merged = mergeGeometries(geos.map(g => { g.deleteAttribute('uv'); return g; }));
  geos.forEach(g => g.dispose());
  return merged;
}

// ---------- marker shapes (all lathe/box/cylinder, merged per kind)
const markerGeo = {};
function buildMarkerGeos() {
  // city pin: a slim obelisk on a disc, drawn as a lathe profile
  markerGeo.city = new THREE.LatheGeometry([
    [0, 0], [0.11, 0], [0.11, 0.03], [0.05, 0.05], [0.045, 0.32], [0.075, 0.36], [0, 0.48]
  ].map(([x, y]) => new THREE.Vector2(x, y)), 10);
  // temple: three stepped tiers and a spire
  markerGeo.temple = mergeGeometries([
    new THREE.BoxGeometry(0.34, 0.08, 0.34).translate(0, 0.04, 0),
    new THREE.BoxGeometry(0.24, 0.08, 0.24).translate(0, 0.12, 0),
    new THREE.BoxGeometry(0.14, 0.08, 0.14).translate(0, 0.2, 0),
    new THREE.ConeGeometry(0.05, 0.26, 4).translate(0, 0.37, 0)
  ].map(g => g.toNonIndexed()));
  // settlement: a cluster of round huts
  markerGeo.settlement = mergeGeometries([
    [0, 0, 0.09, 0.2], [0.13, 0.05, 0.065, 0.14], [-0.1, 0.09, 0.06, 0.12], [-0.04, -0.13, 0.055, 0.1]
  ].map(([x, z, r, h]) => mergeGeometries([
    new THREE.CylinderGeometry(r, r, h, 10).translate(x, h / 2, z).toNonIndexed(),
    new THREE.ConeGeometry(r * 1.2, r * 1.2, 10).translate(x, h + r * 0.6, z).toNonIndexed()
  ])));
  // ruin / other: a broken column
  markerGeo.ruin = mergeGeometries([
    new THREE.CylinderGeometry(0.06, 0.07, 0.3, 8).translate(0, 0.15, 0).toNonIndexed(),
    new THREE.BoxGeometry(0.2, 0.05, 0.12).rotateZ(0.5).translate(0.12, 0.03, 0.05).toNonIndexed()
  ]);
  markerGeo.other = markerGeo.ruin;
  // character token: a capsule on a ring base
  markerGeo.token = mergeGeometries([
    new THREE.CapsuleGeometry(0.09, 0.16, 4, 12).translate(0, 0.2, 0).toNonIndexed(),
    new THREE.TorusGeometry(0.14, 0.025, 6, 20).rotateX(Math.PI / 2).translate(0, 0.02, 0).toNonIndexed()
  ]);
  markerGeo.dead = mergeGeometries([
    new THREE.BoxGeometry(0.06, 0.4, 0.06).translate(0, 0.2, 0).toNonIndexed(),
    new THREE.BoxGeometry(0.24, 0.06, 0.06).translate(0, 0.29, 0).toNonIndexed()
  ]);
}
buildMarkerGeos();

const UP = new THREE.Vector3(0, 1, 0);
function placeOn(obj, at, scale = 1) {
  obj.position.copy(at.pos);
  obj.quaternion.setFromUnitVectors(UP, at.normal);
  obj.scale.setScalar(scale);
}

// Places, characters and trails on whatever surface the current view provides.
function addMarkers(theme, markerScale) {
  const T = THEMES[state.theme];
  const markers = new THREE.Group();
  root.add(markers);
  const byKey = {};
  mappedPlaces().forEach(p => {
    const kind = markerGeo[p.kind] ? p.kind : 'other';
    const color = p.group ? (T.groups[p.group] || T.groups.OTHER) : (p.fictional ? T.fictional : T.city);
    const m = new THREE.Mesh(markerGeo[kind], mat(color, { roughness: 0.5, emissive: p.group ? color : '#000', emissiveIntensity: p.group ? 0.35 : 0 }));
    // places that share a spot (a temple inside a city) are nudged apart
    const k = p.lat.toFixed(1) + ',' + p.lng.toFixed(1);
    const n = byKey[k] = (byKey[k] || 0) + 1;
    const lng = p.lng + (n - 1) * 0.9, lat = p.lat - (n - 1) * 0.6;
    placeOn(m, surface(lat, lng), markerScale);
    m.castShadow = true;
    m.userData.place = p;
    withOutline(m, T);
    markers.add(m);
    pickables.push(m);
  });

  // characters
  const tokens = new THREE.Group(); root.add(tokens);
  const stacks = {};
  state.chars.forEach(c => {
    const cs = charStateAt(c, state.chapter);
    if (!cs) return;
    const r = cs.stop.r;
    const k = r.key; const n = stacks[k] = (stacks[k] || 0) + 1;
    const at = surface(r.lat, r.lng);
    const dead = cs.stop.presence === 'dead';
    const t = new THREE.Mesh(dead ? markerGeo.dead : markerGeo.token, mat(c.color, { roughness: 0.35, emissive: c.color, emissiveIntensity: 0.25 }));
    placeOn(t, at, markerScale * 1.15);
    // fan tokens out around the place
    const side = new THREE.Vector3().crossVectors(at.normal, Math.abs(at.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP).normalize();
    const fwd = new THREE.Vector3().crossVectors(side, at.normal);
    const ang = (n - 1) * 2.1, rad = n > 1 ? 0.28 * markerScale : 0;
    t.position.addScaledVector(side, Math.cos(ang) * rad).addScaledVector(fwd, Math.sin(ang) * rad).addScaledVector(at.normal, 0.04);
    t.castShadow = true;
    t.userData.char = c; t.userData.charState = cs;
    withOutline(t, T);
    tokens.add(t); pickables.push(t);
    const base = t.position.clone();
    if (!reduceMotion && !dead) animated.push((time) => { t.position.copy(base).addScaledVector(at.normal, Math.sin(time * 2 + n) * 0.03 * markerScale); });
    labels.push({ obj: t, text: (dead ? '† ' : '') + c.name, color: c.color, offset: 0.62 * markerScale, normal: at.normal });

    // trail: arcs between each move, newest one carries a moving spark
    const pts = cs.path.map(s => s.r).filter((r, i, a) => i === 0 || r.key !== a[i - 1].key);
    for (let i = 1; i < pts.length; i++) {
      const curve = arcBetween(pts[i - 1], pts[i]);
      const newest = i === pts.length - 1;
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, newest ? 0.035 : 0.022, 6, false),
        new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: newest ? 0.95 : 0.45 }));
      root.add(tube);
      if (newest && !reduceMotion) {
        const spark = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff' }));
        root.add(spark);
        animated.push((time) => { spark.position.copy(curve.getPointAt((time * 0.25) % 1)); });
      }
    }
  });
}
let arcBetween = null;    // set by each view

// ------------------------------------------------------------------ VIEW 1: relief table
function buildRelief() {
  const T = THEMES[state.theme];
  const W = 372 * S, H = (84 - fy(-90)) * S, CZ = -(84 + fy(-90)) / 2 * S;
  const LAND_H = 0.22, COUNTRY_H = 0.32;

  // table slab with rounded corners
  const slabShape = new THREE.Shape();
  const r = 0.8, w = W + 2, h = H + 2;
  slabShape.moveTo(-w / 2 + r, -h / 2); slabShape.lineTo(w / 2 - r, -h / 2); slabShape.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0);
  slabShape.lineTo(w / 2, h / 2 - r); slabShape.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2);
  slabShape.lineTo(-w / 2 + r, h / 2); slabShape.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI);
  slabShape.lineTo(-w / 2, -h / 2 + r); slabShape.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5);
  const slabGeo = new THREE.ExtrudeGeometry(slabShape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 3, curveSegments: 8 });
  slabGeo.rotateX(-Math.PI / 2); slabGeo.translate(5 * S, -0.62, CZ);
  const slab = new THREE.Mesh(slabGeo, mat(T.sea, { roughness: 0.95 }));
  slab.receiveShadow = true;
  withOutline(slab, T, T.outlinePx * 1.4);
  root.add(slab);
  root.add(gridLines(T, 0.002, 36, 1.5, state.theme === 'crt' ? 0.10 : 0.16));
  root.add(shadowGround(T, -0.75, 80));

  // land, then your countries raised on top
  const land = new THREE.Mesh(extrudeFlat(shapesFrom(LAND, 0.004), LAND_H, 0.03), mat(T.land));
  land.castShadow = land.receiveShadow = true;
  withOutline(land, T);
  root.add(land);
  const cGeo = extrudeFlat(shapesFrom(Object.values(MY_COUNTRIES).flat(), 0.003), COUNTRY_H, 0.04);
  cGeo.translate(0, LAND_H, 0);
  const countries = new THREE.Mesh(cGeo, mat(T.country, { roughness: 0.6 }));
  countries.castShadow = countries.receiveShadow = true;
  withOutline(countries, T);
  root.add(countries);

  // borders drawn on the land
  const bp = [];
  BORDERS.forEach(l => { for (let i = 0; i < l.length - 2; i += 2) bp.push(l[i] * S, LAND_H + 0.035, -fy(l[i + 1]) * S, l[i + 2] * S, LAND_H + 0.035, -fy(l[i + 3]) * S); });
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  root.add(new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: T.border, transparent: true, opacity: 0.7 })));

  surface = (lat, lng) => {
    const top = countryAt(lng, lat) ? LAND_H + COUNTRY_H + 0.04 : onLand(lng, lat) ? LAND_H + 0.03 : 0.01;
    return { pos: new THREE.Vector3(lng * S, top, -fy(lat) * S), normal: UP.clone() };
  };
  arcBetween = (a, b) => {
    const p0 = surface(a.lat, a.lng).pos, p1 = surface(b.lat, b.lng).pos;
    const mid = p0.clone().lerp(p1, 0.5); mid.y += 0.6 + p0.distanceTo(p1) * 0.22;
    return new THREE.QuadraticBezierCurve3(p0.clone().setY(p0.y + 0.25), mid, p1.clone().setY(p1.y + 0.25));
  };
  addMarkers(T, 1);

  key.position.set(-14, 26, 14); key.target.position.set(0, 0, 0);
  setShadowBox(22);
  return { home: { az: -0.1, el: 0.98, zoom: 1, target: new THREE.Vector3(0.5, 0, CZ) }, fit: [W + 2, H + 2], minEl: 0.25, maxEl: 1.45 };
}

// ------------------------------------------------------------------ VIEW 2: column globe
function buildGlobe() {
  const T = THEMES[state.theme];
  const R = 6;
  const globe = new THREE.Group(); root.add(globe);

  const ocean = new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 64, 48), mat(T.sea, { roughness: 0.6 }));
  ocean.receiveShadow = true;
  withOutline(ocean, T, T.outlinePx * 1.6);
  globe.add(ocean);

  // graticule
  const gp = [];
  for (let lat = -60; lat <= 60; lat += 30) for (let lng = -180; lng < 180; lng += 3) {
    const a = latLngToVec(lat, lng).multiplyScalar(R * 1.002), b = latLngToVec(lat, lng + 3).multiplyScalar(R * 1.002); gp.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  for (let lng = -180; lng < 180; lng += 30) for (let lat = -87; lat < 87; lat += 3) {
    const a = latLngToVec(lat, lng).multiplyScalar(R * 1.002), b = latLngToVec(lat + 3, lng).multiplyScalar(R * 1.002); gp.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  globe.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: T.seaLine, transparent: true, opacity: 0.8 })));

  // land as hexagonal columns on a Fibonacci sphere
  const N = isSmall() ? 9000 : 16000;
  const cells = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), th = golden * i;
    const v = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr);
    const lat = Math.asin(v.y) * 180 / Math.PI;
    // inverse of latLngToVec: theta = atan2(z, -x), lng = theta - 180
    let lng = Math.atan2(v.z, -v.x) * 180 / Math.PI - 180;
    if (lng < -180) lng += 360;
    if (!onLand(lng, lat)) continue;
    const cid = countryAt(lng, lat);
    cells.push({ v, lat, lng, cid });
  }
  const colR = R * Math.sqrt(4 * Math.PI / N) * 0.47;
  const colGeo = new THREE.CylinderGeometry(colR, colR, 1, 6).translate(0, 0.5, 0);
  const cols = new THREE.InstancedMesh(colGeo, mat('#ffffff', { roughness: 0.7 }), cells.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color();
  const cLand = new THREE.Color(T.land), cHi = new THREE.Color(T.landHi), cC = new THREE.Color(T.country), cCH = new THREE.Color(T.countryHi);
  const heightOf = {};
  cells.forEach((c, i) => {
    const n = (fbm(c.lng * 0.05 + 10, c.lat * 0.05) + 1) / 2;
    const h = 0.08 + n * 0.32 + (c.cid ? 0.22 : 0);
    heightOf[i] = h;
    q.setFromUnitVectors(UP, c.v);
    m4.compose(c.v.clone().multiplyScalar(R * 0.99), q, sc.set(1, h, 1));
    cols.setMatrixAt(i, m4);
    col.copy(c.cid ? cC : cLand).lerp(c.cid ? cCH : cHi, n);
    cols.setColorAt(i, col);
  });
  cols.castShadow = cols.receiveShadow = true;
  withOutline(cols, T, T.outlinePx * 0.8);
  globe.add(cols);

  // atmosphere rim
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 64, 48), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(T.atmo) } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1. - abs(dot(vN, vec3(0.,0.,1.))), 3.); gl_FragColor = vec4(uColor, f*0.55); }`,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  globe.add(atmo);

  root.add(shadowGround(T, -R - 1.4, 60));
  const ring = gridLines(T, -R - 1.4, 30, 1.5, state.theme === 'crt' ? 0.08 : 0.14);
  root.add(ring);

  // surface: the top of the nearest column, or the ocean
  const top = (lat, lng) => {
    const v = latLngToVec(lat, lng);
    let best = -1, bd = 1e9;
    for (let i = 0; i < cells.length; i++) { const d = cells[i].v.distanceToSquared(v); if (d < bd) { bd = d; best = i; } }
    const h = best >= 0 && bd < (colR * 3 / R) ** 2 ? heightOf[best] : 0;
    return { pos: v.clone().multiplyScalar(R * 0.99 + h + 0.02), normal: v };
  };
  surface = top;
  arcBetween = (a, b) => {
    const va = latLngToVec(a.lat, a.lng), vb = latLngToVec(b.lat, b.lng);
    const ang = va.angleTo(vb);
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const v = new THREE.Vector3().copy(va).lerp(vb, t).normalize();
      if (ang > 3.1) v.copy(va).applyAxisAngle(new THREE.Vector3(0, 1, 0), t * ang).normalize();
      pts.push(v.multiplyScalar(R + 0.5 + Math.sin(Math.PI * t) * ang * 1.6));
    }
    return new THREE.CatmullRomCurve3(pts);
  };
  // markers ride with the globe
  const markerRoot = root; root = globe;
  addMarkers(T, 0.9);
  root = markerRoot;

  if (!reduceMotion) animated.push((time, dt) => { if (state.spin && performance.now() - state.lastInteract > 4000) globe.rotation.y += dt * 0.06; });
  state.globe = globe;

  key.position.set(-12, 18, 16); key.target.position.set(0, 0, 0);
  setShadowBox(10);
  return { home: { az: -0.4, el: 0.35, zoom: 1, target: new THREE.Vector3(0, 0, 0) }, fit: [R * 2.7, R * 2.7], minEl: -1.2, maxEl: 1.4 };
}

// ------------------------------------------------------------------ VIEW 3: shattered (Era 1)
function buildShattered() {
  const T = THEMES[state.theme];
  const step = isSmall() ? 1.8 : 1.25;           // degrees per cell
  const cell = step * S;
  const levels = 6, levelH = 0.12;
  const cells = [];
  const heightAt = new Map();
  const rift = (lng, lat) => Math.abs(noiseB(lng * 0.022, lat * 0.03)) < 0.045 || Math.abs(noiseB(lng * 0.012 + 40, lat * 0.02 + 7)) < 0.03;
  for (let lat = -72; lat < 84; lat += step) {
    for (let lng = -180; lng < 180; lng += step) {
      const cx = lng + step / 2, cy = lat + step / 2;
      if (!onLand(cx, cy)) continue;
      const cid = countryAt(cx, cy);
      if (rift(cx, cy) && !cid) { cells.push({ cx, cy, h: 0.04, lvl: -1, cid }); continue; }   // rift floor
      const n = (fbm(cx * 0.04, cy * 0.04) + 0.8) / 1.6;
      const lvl = Math.max(0, Math.min(levels - 1, Math.floor(n * levels)));
      const h = 0.12 + lvl * levelH + (cid ? 0.18 : 0);
      cells.push({ cx, cy, h, lvl, cid });
    }
  }
  cells.forEach(c => heightAt.set(Math.round(c.cx / step) + ',' + Math.round(c.cy / step), c.h));

  // cel-shaded voxels
  const ramp = new Uint8Array([90, 170, 255]);
  const gradient = new THREE.DataTexture(ramp, 3, 1, THREE.RedFormat); gradient.needsUpdate = true;
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  const toon = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradient });
  const boxGeo = new THREE.BoxGeometry(cell * 0.96, 1, cell * 0.96).translate(0, 0.5, 0);
  const vox = new THREE.InstancedMesh(boxGeo, toon, cells.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  const cLand = new THREE.Color(T.land), cHi = new THREE.Color(T.landHi), cC = new THREE.Color(T.country), cCH = new THREE.Color(T.countryHi), cRift = new THREE.Color(T.glow);
  cells.forEach((c, i) => {
    m4.makeScale(1, c.h, 1).setPosition(c.cx * S, 0, -fy(c.cy) * S);
    vox.setMatrixAt(i, m4);
    if (c.lvl < 0) col.set(T.ink);
    else col.copy(c.cid ? cC : cLand).lerp(c.cid ? cCH : cHi, c.lvl / (levels - 1));
    vox.setColorAt(i, col);
  });
  vox.castShadow = vox.receiveShadow = true;
  withOutline(vox, T, T.outlinePx * 0.7);
  root.add(vox);

  // rift glow: emissive floor under the chasms
  const riftCells = cells.filter(c => c.lvl < 0);
  if (riftCells.length) {
    const glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(cell * 1.6, cell * 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: T.glow, transparent: true, opacity: 0.85, blending: state.theme === 'crt' ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false }), riftCells.length);
    riftCells.forEach((c, i) => { m4.makeTranslation(c.cx * S, 0.05, -fy(c.cy) * S); glow.setMatrixAt(i, m4); });
    root.add(glow);
    if (!reduceMotion) animated.push(t => { glow.material.opacity = 0.55 + Math.sin(t * 1.7) * 0.25; });
  }

  // loose fragments drifting above the rifts
  const nFrag = Math.min(110, riftCells.length);
  const frag = new THREE.InstancedMesh(new THREE.BoxGeometry(cell * 0.8, cell * 0.8, cell * 0.8), mat(T.landHi), nFrag);
  const fragData = [];
  for (let i = 0; i < nFrag; i++) {
    const c = riftCells[Math.floor((i * 7919) % riftCells.length)];
    fragData.push({ x: c.cx * S + (noise(i, 1) * 0.3), z: -fy(c.cy) * S + noise(1, i) * 0.3, y: 0.9 + ((i * 37) % 10) / 10 * 1.4, ph: i * 1.3, s: 0.8 + ((i * 13) % 7) / 8 });
  }
  const placeFrags = (t) => {
    const e = new THREE.Euler(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    fragData.forEach((f, i) => {
      e.set(t * 0.3 + f.ph, t * 0.2 + f.ph * 2, 0); q.setFromEuler(e);
      p.set(f.x, f.y + Math.sin(t * 0.8 + f.ph) * 0.12, f.z); s.setScalar(f.s);
      m4.compose(p, q, s); frag.setMatrixAt(i, m4);
    });
    frag.instanceMatrix.needsUpdate = true;
  };
  placeFrags(0);
  frag.castShadow = true;
  withOutline(frag, T, T.outlinePx * 0.7);
  root.add(frag);
  if (!reduceMotion) animated.push(placeFrags);

  // sea floor + shadow
  const floor = new THREE.Mesh(new THREE.BoxGeometry(37, 0.3, 16.5).translate(0, -0.15, -1.3), mat(T.sea, { roughness: 1 }));
  floor.receiveShadow = true;
  withOutline(floor, T, T.outlinePx * 1.4);
  root.add(floor);
  root.add(gridLines(T, 0.003, 36, cell * 4, state.theme === 'crt' ? 0.07 : 0.12));
  root.add(shadowGround(T, -0.31, 80));

  surface = (lat, lng) => {
    const k = Math.round((Math.floor(lng / step) * step + step / 2) / step) + ',' + Math.round((Math.floor(lat / step) * step + step / 2) / step);
    const h = heightAt.get(k);
    return { pos: new THREE.Vector3(lng * S, (h ?? 0) + 0.01, -fy(lat) * S), normal: UP.clone() };
  };
  arcBetween = (a, b) => {
    const p0 = surface(a.lat, a.lng).pos, p1 = surface(b.lat, b.lng).pos;
    const mid = p0.clone().lerp(p1, 0.5); mid.y = Math.max(p0.y, p1.y) + 0.8 + p0.distanceTo(p1) * 0.2;
    return new THREE.QuadraticBezierCurve3(p0.clone().setY(p0.y + 0.3), mid, p1.clone().setY(p1.y + 0.3));
  };
  addMarkers(T, 1);

  key.position.set(-16, 22, 10); key.target.position.set(0, 0, 0);
  setShadowBox(22);
  return { home: { az: -0.3, el: 0.8, zoom: 1, target: new THREE.Vector3(0, 0, -0.5) }, fit: [37, 15], minEl: 0.25, maxEl: 1.45 };
}

function setShadowBox(half) {
  const c = key.shadow.camera;
  c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.near = 1; c.far = 120;
  c.updateProjectionMatrix();
  key.shadow.needsUpdate = true;
}

// ------------------------------------------------------------------ labels (HTML, projected each frame)
const labelLayer = $('labels');
let labels = [];
function syncLabelEls() {
  labelLayer.innerHTML = '';
  labels.forEach(l => {
    const el = document.createElement('div');
    el.className = 'map-label';
    el.textContent = l.text;
    el.style.setProperty('--c', l.color);
    labelLayer.appendChild(el);
    l.el = el;
  });
}
const tmpV = new THREE.Vector3(), camDir = new THREE.Vector3();
function updateLabels() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  camera.getWorldDirection(camDir);
  labels.forEach(l => {
    l.obj.getWorldPosition(tmpV);
    const n = l.normal.clone().applyQuaternion(l.obj.parent.getWorldQuaternion(new THREE.Quaternion()));
    tmpV.addScaledVector(n, l.offset);
    const facing = n.dot(camDir) < 0.15;
    tmpV.project(camera);
    const vis = facing && tmpV.z < 1 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1;
    l.el.style.opacity = vis ? 1 : 0;
    l.el.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * w}px, ${(-tmpV.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
  });
}

// ------------------------------------------------------------------ camera framing
let viewCfg = null;
const camState = { az: 0, el: 0.8, zoom: 1, target: new THREE.Vector3() };
function frame() {
  const w = canvas.clientWidth, h = canvas.clientHeight, aspect = w / Math.max(1, h);
  const [fw, fh] = viewCfg.fit;
  // fit the whole view, phone portrait included
  const halfH = Math.max(fh / 2, fw / 2 / aspect) * (state.view === 'globe' ? 1 : 0.94);
  camera.left = -halfH * aspect; camera.right = halfH * aspect; camera.top = halfH; camera.bottom = -halfH;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  outlineMats.forEach(m => m.uniforms.uRes.value.set(w, h));
}
function goHome(instant) {
  const hm = viewCfg.home;
  // portrait phones: start closer on flat maps, pinch out for the whole world
  const portrait = canvas.clientWidth < canvas.clientHeight;
  setCamera(hm.target, hm.az, hm.el, hm.zoom * (portrait && state.view !== 'globe' ? 1.9 : 1), instant);
}
function setCamera(target, az, el, zoom, instant) {
  const dist = 80;
  const pos = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(dist).add(target);
  if (instant) {
    controls.target.copy(target); camera.position.copy(pos); camera.zoom = zoom; camera.updateProjectionMatrix();
    state.focus = null;
  } else {
    state.focus = { target: target.clone(), pos, zoom };
  }
}
function focusOn(obj, zoom = 2.6) {
  const p = obj.getWorldPosition(new THREE.Vector3());
  const offset = camera.position.clone().sub(controls.target);
  if (state.view === 'globe') {
    // turn the planet so the point faces the camera
    const g = state.globe;
    const local = g.worldToLocal(p.clone()).normalize();
    const camFlat = new THREE.Vector3(offset.x, 0, offset.z).normalize();
    const lf = new THREE.Vector3(local.x, 0, local.z).normalize();
    let d = Math.atan2(camFlat.x, camFlat.z) - Math.atan2(lf.x, lf.z);
    state.globeTurn = g.rotation.y + Math.atan2(Math.sin(d), Math.cos(d));
    state.spin = false;
    state.focus = { target: new THREE.Vector3(0, 0, 0), pos: offset.normalize().multiplyScalar(80), zoom: Math.min(zoom, 1.8) };
    return;
  }
  state.focus = { target: p, pos: p.clone().add(offset), zoom };
}

// ------------------------------------------------------------------ build / rebuild
function disposeTree(o) {
  o.traverse(n => {
    if (n.geometry && !Object.values(markerGeo).includes(n.geometry)) n.geometry.dispose();
    if (n.material) { (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => { outlineMats.delete(m); m.dispose(); }); }
  });
}
function build() {
  if (root) { scene.remove(root); disposeTree(root); }
  root = new THREE.Group(); scene.add(root);
  pickables = []; animated = []; labels = []; state.globe = null; state.globeTurn = null;
  const T = THEMES[state.theme];
  document.documentElement.dataset.theme = state.theme;
  hemi.color.set(T.hemiSky); hemi.groundColor.set(T.hemiGround); hemi.intensity = 1.1;
  key.color.set(T.key); key.intensity = state.theme === 'crt' ? 2.0 : 1.8;
  fill.position.set(14, 8, -12);
  scene.environmentIntensity = T.env;
  renderer.toneMappingExposure = T.exposure;

  viewCfg = ({ relief: buildRelief, globe: buildGlobe, shattered: buildShattered })[state.view]();
  controls.minPolarAngle = Math.PI / 2 - viewCfg.maxEl;
  controls.maxPolarAngle = Math.PI / 2 - viewCfg.minEl;
  controls.minZoom = 0.6; controls.maxZoom = 8;
  syncLabelEls();
  frame();
  key.shadow.needsUpdate = true;
}

// ------------------------------------------------------------------ UI
function chapterLabel() {
  const ch = state.chapter;
  if (ch == null) return 'Latest';
  const t = state.titles[ch];
  return 'Ch ' + String(ch).padStart(2, '0') + (t && !state.demo ? ' · ' + t : '');
}
function renderLegend() {
  const ul = $('legendList');
  ul.innerHTML = '';
  state.chars.forEach(c => {
    const cs = charStateAt(c, state.chapter);
    const li = document.createElement('li');
    li.innerHTML = `<button type="button"><i style="background:${c.color}"></i><b></b><span></span></button>`;
    li.querySelector('b').textContent = c.name;
    li.querySelector('span').textContent = cs ? (cs.stop.presence === 'dead' ? '† ' : '') + cs.stop.r.name : 'not in story yet';
    li.querySelector('button').disabled = !cs;
    li.querySelector('button').addEventListener('click', () => {
      const tok = pickables.find(p => p.userData.char && p.userData.char.id === c.id);
      if (tok) focusOn(tok);
    });
    ul.appendChild(li);
  });
  $('demoNote').hidden = !state.demo;
}
function setChapterUI() {
  const idx = state.chapters.indexOf(state.chapter);
  $('chapterRange').max = Math.max(0, state.chapters.length - 1);
  $('chapterRange').value = idx < 0 ? state.chapters.length - 1 : idx;
  $('chapterRange').disabled = state.chapters.length < 2;
  $('chapterLabel').textContent = chapterLabel();
}
function setChapter(ch) {
  state.chapter = ch;
  setChapterUI();
  rebuildKeepCamera();
  renderLegend();
}
function rebuildKeepCamera() {
  const t = controls.target.clone(), p = camera.position.clone(), z = camera.zoom, rot = state.globe ? state.globe.rotation.y : null;
  build();
  controls.target.copy(t); camera.position.copy(p); camera.zoom = z; camera.updateProjectionMatrix();
  if (rot != null && state.globe) state.globe.rotation.y = rot;
}

document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
  if (state.view === b.dataset.view) return;
  state.view = b.dataset.view;
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x === b));
  try { localStorage.setItem('epitaph-atlas3d-view', state.view); } catch (e) {}
  build(); goHome(true); renderLegend();
}));
document.querySelectorAll('[data-theme-btn]').forEach(b => b.addEventListener('click', () => {
  state.theme = b.dataset.themeBtn;
  document.querySelectorAll('[data-theme-btn]').forEach(x => x.classList.toggle('on', x === b));
  try { localStorage.setItem('epitaph-atlas3d-theme', state.theme); } catch (e) {}
  rebuildKeepCamera();
}));
$('chapterRange').addEventListener('input', e => setChapter(state.chapters[+e.target.value] ?? null));
$('prevCh').addEventListener('click', () => { const i = state.chapters.indexOf(state.chapter); if (i > 0) setChapter(state.chapters[i - 1]); });
$('nextCh').addEventListener('click', () => { const i = state.chapters.indexOf(state.chapter); if (i >= 0 && i < state.chapters.length - 1) setChapter(state.chapters[i + 1]); });
$('homeBtn').addEventListener('click', () => { state.spin = true; state.globeTurn = null; goHome(false); });
$('legendToggle').addEventListener('click', () => $('legend').classList.toggle('open'));

// hover + click
const tip = $('tip');
canvas.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  tip.style.left = (e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px';
});
canvas.addEventListener('pointerleave', () => pointer.set(9, 9));
['pointerdown', 'wheel'].forEach(ev => canvas.addEventListener(ev, () => { state.lastInteract = performance.now(); state.focus = null; state.globeTurn = null; }, { passive: true }));
let hovered = null, downAt = null;
canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const hit = pick();
  if (hit) focusOn(hit);
});
function pick() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  return hits.length ? hits[0].object : null;
}
function describe(obj) {
  if (obj.userData.char) {
    const { char, charState } = obj.userData;
    const s = charState.stop;
    return `<b>${esc(char.name)}</b><span>${s.presence === 'dead' ? 'Died at' : 'At'} ${esc(s.r.label)}</span>` +
      (s.ch != null ? `<span>From chapter ${s.ch}</span>` : '');
  }
  const p = obj.userData.place;
  const here = state.chars.filter(c => { const cs = charStateAt(c, state.chapter); return cs && cs.stop.r.place && cs.stop.r.place.id === p.id; });
  const co = World.country(p.countryId);
  return `<b>${esc(p.name)}</b><span>${esc(World.KIND_LABEL[p.kind] || 'Place')}${co ? ' · ' + esc(co.name) : ''}${p.fictional ? ' · fictional' : ''}</span>` +
    (p.group ? `<span>${esc((World.SITE_GROUPS.find(g => g.id === p.group) || {}).label || p.group)} site</span>` : '') +
    (here.length ? `<span class="here">Here: ${here.map(c => esc(c.name)).join(', ')}</span>` : '');
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let frameCount = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  if (state.focus) {
    controls.target.x = damp(controls.target.x, state.focus.target.x, 5, dt);
    controls.target.y = damp(controls.target.y, state.focus.target.y, 5, dt);
    controls.target.z = damp(controls.target.z, state.focus.target.z, 5, dt);
    camera.position.lerp(state.focus.pos, 1 - Math.exp(-5 * dt));
    camera.zoom = damp(camera.zoom, state.focus.zoom, 5, dt);
    camera.updateProjectionMatrix();
    if (camera.position.distanceTo(state.focus.pos) < 0.01 && Math.abs(camera.zoom - state.focus.zoom) < 0.002) state.focus = null;
  }
  if (state.globe && state.globeTurn != null) state.globe.rotation.y = damp(state.globe.rotation.y, state.globeTurn, 4, dt);
  animated.forEach(f => f(time, dt));
  controls.update();
  if (state.view === 'globe' && state.globe) key.shadow.needsUpdate = true;
  // hover (every other frame is plenty)
  if ((frameCount++ & 1) === 0) {
    const hit = pointer.x < 2 ? pick() : null;
    if (hit !== hovered) {
      if (hovered && hovered.material.emissive) hovered.material.emissiveIntensity = hovered.userData.baseEmissive ?? hovered.material.emissiveIntensity;
      hovered = hit;
      if (hit) { hit.userData.baseEmissive = hit.userData.baseEmissive ?? hit.material.emissiveIntensity; hit.material.emissiveIntensity = 0.9; if (hit.material.emissive.getHex() === 0) hit.material.emissive.set('#553a10'); }
      tip.hidden = !hit; if (hit) tip.innerHTML = describe(hit);
      canvas.style.cursor = hit ? 'pointer' : '';
    }
  }
  renderer.render(scene, camera);
  updateLabels();
});
addEventListener('resize', frame);

// ------------------------------------------------------------------ start
function start() {
  const data = loadCharacters();
  state.chars = data.chars; state.chapters = data.chapters; state.titles = data.titles; state.demo = data.demo;
  state.chapter = state.chapters.length ? state.chapters[state.chapters.length - 1] : null;
  try {
    const v = localStorage.getItem('epitaph-atlas3d-view'); if (v && ['relief', 'globe', 'shattered'].includes(v)) state.view = v;
    const t = localStorage.getItem('epitaph-atlas3d-theme'); if (t && THEMES[t]) state.theme = t;
  } catch (e) {}
  const q = new URLSearchParams(location.search);
  if (['relief', 'globe', 'shattered'].includes(q.get('view'))) state.view = q.get('view');
  if (THEMES[q.get('theme')]) state.theme = q.get('theme');
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x.dataset.view === state.view));
  document.querySelectorAll('[data-theme-btn]').forEach(x => x.classList.toggle('on', x.dataset.themeBtn === state.theme));
  setChapterUI();
  if (isSmall()) $('legend').classList.remove('open');
  build(); goHome(true); renderLegend();
  $('boot').hidden = true;
  window.__atlas3d = { state, renderer, scene, camera };
}
start();
addEventListener('storage', e => { if (e.key === 'epitaph-character-profiles' || e.key === 'epitaph-library') { const d = loadCharacters(); Object.assign(state, { chars: d.chars, chapters: d.chapters, titles: d.titles, demo: d.demo }); setChapterUI(); rebuildKeepCamera(); renderLegend(); } });
