/* Epitaph — the pin close-up (opened by clicking a sword on the map).
 *
 * A big, turnable view of one character's sword, standing in a small scene that copies the region it is in:
 *   plains · hills · mountains · snow (ice) · impact mountains (rim) · the crater (pit)
 *   coast (tip in the surf, the rest dry) · boat (en route across open sea) · underwater (open sea)
 *   drowned (land the +60 m sea took: ruins on the seabed)
 * A place with a built site (Aurelia, the Hollow Reach) opens that site instead, with the sword standing
 * in it at giant size (the site page's ?embed=1&pin=… mode).
 * Region comes from the map (regionAt in epitaph-map.js); the sword from pins/pins.js.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadPins, buildPin, designFor, DESIGN_LABEL, patch } from './pins/pins.js?v=4';

export const REGION_LABEL = {
  plains: 'Plains', hills: 'Hills', mountains: 'Mountains', ice: 'Snowfield', rim: 'Impact mountains', pit: 'The crater',
  coast: 'Coast', boat: 'At sea', underwater: 'Under the sea', drowned: 'Sunken land', site: 'Site'
};
const PAL = {
  crt: {
    bg: '#0d0905', horizon: '#3d2c18', sky: '#fff1d8', gnd: '#2a1d0e', key: '#ffe2b8', rim: '#ffb238',
    earth: '#4a3822', grass: '#5c6128', grass2: '#8a7d38', rock: '#4d4033', rock2: '#6e5d48', snow: '#efe4cc', sand: '#b8955a', sand2: '#8f7244',
    water: '#2f6f73', deep: '#0b2a2c', seabed: '#5d5a3e', foam: '#efe2c8', wood: '#6b4528', wood2: '#3d2716', glow: '#ffb238', ice: '#cfe3e6', ruin: '#8a8270', kelp: '#4f5a26', pit: '#07060a'
  },
  paper: {
    bg: '#efe6d4', horizon: '#e6d6b8', sky: '#fffaf3', gnd: '#c2ae90', key: '#fff6ea', rim: '#ffffff',
    earth: '#c9b48e', grass: '#9cbf6e', grass2: '#c4cf86', rock: '#9a8b76', rock2: '#b8a991', snow: '#ffffff', sand: '#e8d3a2', sand2: '#d4b980',
    water: '#5c9fc2', deep: '#2e6e8e', seabed: '#c9b98a', foam: '#ffffff', wood: '#9a6a40', wood2: '#6b4528', glow: '#ff8a3d', ice: '#e4f2f6', ruin: '#d8cfbd', kelp: '#6f8a3e', pit: '#141a2c'
  }
};

// ------------------------------------------------------------------ small noise (JS)
const hash = (x, z, s) => { const v = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
function vn(x, z, s = 0) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, s), b = hash(ix + 1, iz, s), c = hash(ix, iz + 1, s), d = hash(ix + 1, iz + 1, s);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
const fbm = (x, z, s = 0) => .55 * vn(x, z, s) + .3 * vn(x * 2.1, z * 2.1, s + 3) + .15 * vn(x * 4.3, z * 4.3, s + 7);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rand = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();

// ------------------------------------------------------------------ scene parts
const TC = { value: 0 };                         // scene time, shared by the scene's shaders
function terrain(hFn, colFn, { size = 26, seg = 170 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2), p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = hFn(x, z); p.setY(i, y); }
  geo.computeVertexNormals();
  const n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) { colFn(c, p.getX(i), p.getY(i), p.getZ(i), 1 - n.getY(i)); col.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true }));
  m.receiveShadow = true; return m;
}
function swayMat(color, amount, extra = {}) {    // instanced blades that lean in the wind, more at the top
  const m = new THREE.MeshStandardMaterial({ color, roughness: .9, flatShading: true, side: THREE.DoubleSide, ...extra });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = TC;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float sw = sin(uTime*1.4 + ip.x*2.3 + ip.z*1.7)*.6 + sin(uTime*.6 + ip.x*.7)*.4;
      transformed.x += sw * position.y * ${amount.toFixed(3)}; transformed.z += sw * position.y * ${(amount * .4).toFixed(3)};`);
  };
  return m;
}
function scatter(scene, geo, mat, n, hFn, { r0 = .2, r1 = 3.5, s0 = .7, s1 = 1.3, colors = null, tilt = 0, sy = null, cast = false, where = null } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  let k = 0;
  for (let tries = 0; k < n && tries < n * 20; tries++) {
    const a = rand() * Math.PI * 2, r = r0 + Math.sqrt(rand()) * (r1 - r0), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (where && !where(x, z)) continue;
    const s = s0 + rand() * (s1 - s0);
    e.set((rand() - .5) * tilt, rand() * Math.PI * 2, (rand() - .5) * tilt); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, hFn(x, z), z), q, new THREE.Vector3(s, sy ? s * (sy[0] + rand() * (sy[1] - sy[0])) : s, s));
    im.setMatrixAt(k, m4);
    if (colors) im.setColorAt(k, c.set(colors[Math.floor(rand() * colors.length)]).offsetHSL(0, 0, (rand() - .5) * .06));
    k++;
  }
  im.count = k; im.castShadow = cast; im.receiveShadow = true; scene.add(im); return im;
}
function rockGeo(seed = 1) {
  const g = new THREE.DodecahedronGeometry(.1, 0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = .75 + vn(x * 30 + seed, z * 30 + y * 20, seed) * .5; p.setXYZ(i, x * k, y * k * .7, z * k); }
  g.computeVertexNormals(); return g;
}
function particles(scene, { n = 120, r = 3, y0 = 0, y1 = 3, size = 2.4, color = '#fff', opacity = .7, vy = .2, drift = .1, wobble = .1, from = null }) {
  const pos = new Float32Array(n * 3), st = [];
  const seed = (p, fresh) => { const a = rand() * 6.283, rr = Math.sqrt(rand()) * r; p.x = from ? from[0] + (rand() - .5) * .08 : Math.cos(a) * rr; p.z = from ? from[2] + (rand() - .5) * .08 : Math.sin(a) * rr; p.y = fresh ? y0 + rand() * (y1 - y0) : (vy > 0 ? y0 : y1); p.ph = rand() * 6.283; p.v = vy * (.6 + rand() * .8); };
  for (let i = 0; i < n; i++) { const p = {}; seed(p, true); st.push(p); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity, depthWrite: false }));
  scene.add(pts);
  return (t, dt) => {
    st.forEach((p, i) => {
      p.y += p.v * dt; p.x += drift * dt + Math.sin(t * 1.3 + p.ph) * wobble * dt; p.z += Math.cos(t * 1.1 + p.ph) * wobble * dt;
      if (p.y > y1 || p.y < y0) seed(p, false);
      pos.set([p.x, p.y, p.z], i * 3);
    });
    geo.attributes.position.needsUpdate = true;
  };
}
function waterMesh(color, { size = 30, seg = 140, amp = .02, opacity = .8, shore = false, y = 0, foam = '#efe2c8' } = {}) {
  const fc = new THREE.Color(foam);
  const m = patch(new THREE.MeshStandardMaterial({ color, roughness: .18, metalness: .1, transparent: true, opacity }), { uTime: TC }, shore ? `
      float sx = .15*sin(-1.3*vObj.y);
      float d = sx - vObj.x;                                   // > 0 out in the water
      float fl = smoothstep(.09, 0., abs(d - .05 - .04*sin(uTime*1.3 + vObj.y*2.)));
      totalEmissiveRadiance += vec3(${fc.r.toFixed(3)},${fc.g.toFixed(3)},${fc.b.toFixed(3)}) * fl * .55;
      diffuseColor.a *= mix(.35, 1., smoothstep(0., 1.6, d));
      if (d < -.02) discard;` : `
      float cr = smoothstep(.75, 1., sin(vObj.x*2.1+uTime*1.1)*.6 + sin(vObj.y*2.7-uTime*.9)*.4);
      totalEmissiveRadiance += vec3(${fc.r.toFixed(3)},${fc.g.toFixed(3)},${fc.b.toFixed(3)}) * cr * .12;`,
    `transformed.z += (sin(position.x*2.1+uTime*1.1)*.6 + sin(position.y*2.7-uTime*.9)*.4 + sin((position.x+position.y)*4.3+uTime*1.7)*.2) * ${amp.toFixed(3)};`);
  const w = new THREE.Mesh(new THREE.PlaneGeometry(size, size, seg, seg), m); w.rotation.x = -Math.PI / 2; w.position.y = y; w.receiveShadow = true; return w;
}

// ------------------------------------------------------------------ regions: each adds scenery and says where the sword stands
const REGIONS = {
  plains(s, P) {
    const h = (x, z) => (fbm(x * .5, z * .5) - .5) * .25 + smooth(6, 11, Math.hypot(x, z)) * (.6 + fbm(x * .3, z * .3, 4));
    s.add(terrain(h, (c, x, y) => c.set(P.grass).lerp(new THREE.Color(P.earth), .35 - y * .3 + vn(x * 2, 0) * .2)));
    scatter(s, new THREE.ConeGeometry(.012, .15, 3).translate(0, .075, 0), swayMat('#ffffff', .35), 1800, h, { r0: .14, r1: 4.5, s0: .6, s1: 1.4, colors: [P.grass, P.grass2, P.grass, P.sand2] });
    scatter(s, rockGeo(2), new THREE.MeshStandardMaterial({ color: P.rock2, roughness: .9, flatShading: true }), 9, h, { r0: .6, r1: 3.5, s0: .6, s1: 1.6, cast: true });
    return { ground: h(0, 0), fx: [particles(s, { n: 70, r: 3.5, y0: .05, y1: 1.6, color: P.sand, size: 2, vy: .02, drift: .08, wobble: .15, opacity: .55 })] };
  },
  hills(s, P) {
    const h = (x, z) => .5 * (fbm(x * .35, z * .35, 2) - .45) * 2 - smooth(.3, 2.6, Math.hypot(x, z)) * .35 + smooth(5, 10, Math.hypot(x, z)) * 1.2;
    s.add(terrain(h, (c, x, y, z, sl) => c.set(P.grass).lerp(new THREE.Color(P.rock), Math.min(1, sl * 3))));
    scatter(s, new THREE.ConeGeometry(.012, .13, 3).translate(0, .065, 0), swayMat('#ffffff', .3), 1100, h, { r0: .14, r1: 4, colors: [P.grass, P.grass2] });
    const tint = (g, col) => { const c = new THREE.Color(col), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    const tree = mergeGeometries([tint(new THREE.ConeGeometry(.16, .55, 6).translate(0, .42, 0), P.kelp), tint(new THREE.ConeGeometry(.12, .4, 6).translate(0, .62, 0), P.grass), tint(new THREE.CylinderGeometry(.025, .035, .18, 5).translate(0, .09, 0), P.wood2)]);
    scatter(s, tree, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true }), 18, h, { r0: 1.4, r1: 4.5, s0: .7, s1: 1.4, cast: true });
    scatter(s, rockGeo(3), new THREE.MeshStandardMaterial({ color: P.rock2, roughness: .9, flatShading: true }), 14, h, { r0: .5, r1: 4, s0: .7, s1: 2, cast: true });
    return { ground: h(0, 0), fx: [] };
  },
  mountains(s, P, dark = false) {
    const h = (x, z) => {
      const r = Math.hypot(x, z), a = Math.atan2(z, x);
      return smooth(.7, 3.6, r) * (.9 + 1.1 * fbm(Math.cos(a) * 2 + 5, Math.sin(a) * 2, 1)) * (1 - .8 * smooth(-.2, .9, Math.sin(a)))
        - smooth(.5, 2.4, z) * 1.3 + (fbm(x * 1.6, z * 1.6, 5) - .5) * .18;
    };
    const rock = new THREE.Color(dark ? '#2b2420' : P.rock), snow = new THREE.Color(P.snow);
    s.add(terrain(h, (c, x, y, z, sl) => c.copy(rock).lerp(new THREE.Color(P.rock2), vn(x * 3, z * 3) * .4).lerp(snow, smooth(dark ? .35 : .55, dark ? .7 : .9, y) * (1 - Math.min(1, sl * 1.3)))));
    scatter(s, rockGeo(5), new THREE.MeshStandardMaterial({ color: dark ? '#3a302a' : P.rock2, roughness: .9, flatShading: true }), 14, h, { r0: .4, r1: 2.5, s0: .5, s1: 1.6, cast: true, where: (x, z) => z < .6 });
    return { ground: h(0, 0), fx: [particles(s, { n: 160, r: 4, y0: -1, y1: 3.5, color: P.snow, size: 2.2, vy: -.25, drift: .25, wobble: .3, opacity: .8 })] };
  },
  rim(s, P) { return REGIONS.mountains(s, P, true); },
  ice(s, P) {
    const h = (x, z) => (fbm(x * .4, z * .4, 9) - .5) * .35 + smooth(5, 10, Math.hypot(x, z)) * .8;
    s.add(terrain(h, (c, x, y, z) => c.set(P.snow).lerp(new THREE.Color(P.ice), vn(x * 1.5, z * 1.5) * .6)));
    scatter(s, new THREE.ConeGeometry(.06, .5, 4).translate(0, .22, 0), new THREE.MeshStandardMaterial({ color: P.ice, roughness: .15, metalness: .1, transparent: true, opacity: .85, flatShading: true }), 26, h, { r0: .7, r1: 3.8, s0: .5, s1: 1.8, tilt: .7, cast: true, sy: [.7, 1.6] });
    return { ground: h(0, 0), fx: [particles(s, { n: 200, r: 4, y0: -.5, y1: 3.5, color: '#ffffff', size: 2.2, vy: -.3, drift: .45, wobble: .35, opacity: .85 })] };
  },
  pit(s, P) {
    const C = new THREE.Vector3(2.7, 0, -.3), black = new THREE.MeshStandardMaterial({ color: P.pit, roughness: .95, side: THREE.DoubleSide });
    const h = (x, z) => (fbm(x * .8, z * .8, 3) - .5) * .12;
    const gnd = terrain(h, (c, x, y) => c.set(P.rock).lerp(new THREE.Color('#1a1512'), .5 + vn(x * 2, y * 9) * .3)); s.add(gnd);
    const R0 = 2.1, steps = 7, st = .3, pitG = new THREE.Group(); pitG.position.copy(C); s.add(pitG);
    gnd.material.onBeforeCompile = sh => {                                              // cut the ground away over the pit
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed,1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('void main() {', `void main() { if (length(vW.xz - vec2(${C.x.toFixed(2)}, ${C.z.toFixed(2)})) < ${R0.toFixed(2)}) discard;`);
    };
    for (let k = 0; k < steps; k++) {
      const r = R0 - k * (R0 - .45) / steps, rn = R0 - (k + 1) * (R0 - .45) / steps, y0 = -k * st, y1 = -(k + 1) * st;
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, st, 72, 1, true), black); wall.position.y = (y0 + y1) / 2; pitG.add(wall);
      const fl = new THREE.Mesh(new THREE.RingGeometry(rn, r, 72, 1).rotateX(-Math.PI / 2), black); fl.position.y = y1; pitG.add(fl);
      const edge = new THREE.Mesh(new THREE.TorusGeometry(r, .006, 4, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: P.glow, transparent: true, opacity: .25 + .06 * k })); edge.position.y = y0; pitG.add(edge);
    }
    const core = new THREE.Mesh(new THREE.CircleGeometry(.45, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: P.glow })); core.position.y = -steps * st + .01; pitG.add(core);
    const light = new THREE.PointLight(P.glow, 6, 6, 1.6); light.position.set(0, -steps * st + .4, 0); pitG.add(light);
    scatter(s, rockGeo(8), new THREE.MeshStandardMaterial({ color: '#3a302a', roughness: .9, flatShading: true }), 10, h, { r0: .5, r1: 3.5, s0: .5, s1: 1.4, cast: true, where: (x, z) => Math.hypot(x - C.x, z - C.z) > R0 + .2 });
    const motes = particles(s, { n: 60, r: 1, y0: -2, y1: 2.2, color: P.glow, size: 2.4, vy: .25, wobble: .2, opacity: .8 });
    pitG.add(s.children[s.children.length - 1]);                                         // motes rise out of the pit
    return { ground: h(0, 0), fx: [motes, t => { light.intensity = 5 + Math.sin(t * 1.7) * 1.5; }], cam: { pos: [-1.6, 1.5, 2.6], target: [.6, .3, 0] } };
  },
  coast(s, P) {
    const shore = z => .15 * Math.sin(1.3 * z);
    const h = (x, z) => Math.max(-.4, .2 * (x - shore(z)) + (fbm(x * 1.2, z * 1.2, 6) - .5) * .05) + Math.max(0, x - 2) * .2;
    s.add(terrain(h, (c, x, y) => c.set(P.sand2).lerp(new THREE.Color(P.sand), smooth(-.1, .1, y)).lerp(new THREE.Color(P.grass), smooth(.5, .7, y))));
    s.add(waterMesh(P.water, { amp: .012, shore: true, opacity: .85, foam: P.foam }));
    scatter(s, rockGeo(4), new THREE.MeshStandardMaterial({ color: P.rock, roughness: .85, flatShading: true }), 10, h, { r0: .6, r1: 3, s0: .6, s1: 1.8, cast: true });
    scatter(s, new THREE.ConeGeometry(.012, .16, 3).translate(0, .08, 0), swayMat('#ffffff', .4), 500, h, { r0: 1, r1: 4.5, colors: [P.grass2, P.sand2], where: (x, z) => x - shore(z) > 1.6 });
    const x0 = shore(0) - .18;
    return { at: [x0, 0], ground: h(x0, 0), fx: [particles(s, { n: 40, r: 3, y0: .05, y1: 1.2, color: P.foam, size: 1.8, vy: .03, drift: .1, wobble: .2, opacity: .5 })], cam: { pos: [1.6, 1.0, 2.8], target: [-.1, .5, 0] } };
  },
  boat(s, P) {
    s.add(waterMesh(P.water, { amp: .05, opacity: .95, foam: P.foam }));
    const boat = new THREE.Group(); s.add(boat);
    const L = 1.8, W = .62, H = .26, hull = new THREE.BoxGeometry(L, H, W, 30, 4, 10), p = hull.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = x / (L / 2), yb = (y + H / 2) / H;
      const taper = t > 0 ? 1 - t * t * .96 : 1 - t * t * .5;
      p.setZ(i, z * taper * (.45 + .55 * yb)); p.setY(i, y + t * t * .16 * yb - (1 - yb) * (1 - Math.abs(z) / (W / 2)) * .05);
    }
    hull.computeVertexNormals();
    const plank = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d'); x.fillStyle = P.wood; x.fillRect(0, 0, 64, 256); x.fillStyle = 'rgba(0,0,0,.3)'; for (let k = 0; k < 256; k += 32) x.fillRect(0, k, 64, 2); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const wood = new THREE.MeshStandardMaterial({ color: P.wood2, roughness: .8, flatShading: true }), deck = new THREE.MeshStandardMaterial({ map: plank, roughness: .85 });
    const hm = new THREE.Mesh(hull, [wood, wood, deck, wood, wood, wood]); hm.castShadow = hm.receiveShadow = true; boat.add(hm);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.016, .022, 1.25, 6).translate(0, .625, 0), wood); mast.position.set(-.55, H / 2, 0); mast.castShadow = true; boat.add(mast);
    const flagG = new THREE.PlaneGeometry(.32, .16, 10, 1).translate(.16, 0, 0);
    const flagM = new THREE.MeshStandardMaterial({ color: P.glow, side: THREE.DoubleSide, roughness: .8 });
    flagM.onBeforeCompile = sh => { sh.uniforms.uTime = TC; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z += sin(position.x*18. - uTime*6.)*.03*position.x*3.;'); };
    const flag = new THREE.Mesh(flagG, flagM); flag.position.set(-.55, H / 2 + 1.15, 0); boat.add(flag);
    return {
      parent: boat, ground: H / 2, fx: [t => { boat.position.y = Math.sin(t * 1.1) * .035 - .1; boat.rotation.z = Math.sin(t * .9) * .045; boat.rotation.x = Math.sin(t * 1.3 + 1) * .03; }],
      flag: flagM, cam: { pos: [2.3, 1.5, 3.2], target: [0, .6, 0] }
    };
  },
  underwater(s, P, ruins = false) {
    const h = (x, z) => (fbm(x * .5, z * .5, 11) - .5) * .5 + Math.sin(x * 2.2 + z * .6) * .04 + smooth(5, 10, Math.hypot(x, z)) * 1.5;
    const bed = terrain(h, (c, x, y) => c.set(P.seabed).lerp(new THREE.Color(P.deep), .25 - y * .3));
    patch(bed.material, { uTime: TC }, `
      vec2 q = vObj.xz * 2.6; float cs = 0.;
      for (int i = 0; i < 3; i++) { q += vec2(sin(q.y + uTime*.55), cos(q.x - uTime*.45)) * .6; cs += abs(sin(q.x) * sin(q.y)); }
      cs = pow(max(0., 1. - cs / 3.), 5.);
      totalEmissiveRadiance += vec3(.55, .9, .85) * cs * .28;`);
    s.add(bed);
    const surf = waterMesh(P.water, { amp: .06, opacity: .45, y: 3.4, foam: '#ffffff' }); surf.material.side = THREE.DoubleSide; s.add(surf);
    const kelp = new THREE.PlaneGeometry(.03, 1, 1, 10).translate(0, .5, 0);
    scatter(s, kelp, swayMat(P.kelp, .22, { transparent: true, opacity: .95 }), 22, h, { r0: 1.1, r1: 4, s0: .7, s1: 1.4, sy: [.6, 2.4] });
    scatter(s, rockGeo(6), new THREE.MeshStandardMaterial({ color: P.rock, roughness: .9, flatShading: true }), 12, h, { r0: .5, r1: 3.5, s0: .6, s1: 1.8, cast: true });
    // light shafts from the surface
    const shaftTex = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 128; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 8, 128); return new THREE.CanvasTexture(c); })();
    const shafts = [];
    for (let k = 0; k < 7; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(.35 + rand() * .4, 4.2).translate(0, -2.1, 0), new THREE.MeshBasicMaterial({ map: shaftTex, color: '#cfeee6', transparent: true, opacity: .08 + rand() * .07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.position.set((rand() - .5) * 5, 3.4, (rand() - .5) * 4 - .5); m.rotation.set(0, rand() * Math.PI, .25); s.add(m); shafts.push(m);
    }
    if (ruins) {
      const stone = new THREE.MeshStandardMaterial({ color: P.ruin, roughness: .95, flatShading: true });
      const add = (geo, x, z, ry = 0, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, stone); m.position.set(x, h(x, z), z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = true; s.add(m); };
      [[-1.2, -.8, 1.1], [-.6, -1.2, .5], [.9, -1.1, .8], [1.5, -.4, .35], [-1.6, .6, .6]].forEach(([x, z, hh], i) => add(new THREE.CylinderGeometry(.08, .09, hh, 10).translate(0, hh / 2, 0), x, z, 0, i === 3 ? .5 : 0, i === 4 ? -.4 : 0));
      add(new THREE.BoxGeometry(1.2, .06, .3).translate(0, .03, 0), .2, -1.6, .3);
      add(new THREE.BoxGeometry(.5, .5, .08).translate(0, .25, 0), 1.8, .8, -.6, 0, .15);
      add(new THREE.BoxGeometry(.9, .12, .5).translate(0, .06, 0), -.9, 1.3, .8, .12);
      const road = new THREE.Mesh(new THREE.PlaneGeometry(.5, 7).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: P.rock2, roughness: 1 })); road.position.set(.9, h(.9, 0) + .015, 0); road.rotation.y = .4; s.add(road);
    }
    const bubbles = particles(s, { n: 26, r: .1, y0: .1, y1: 3.4, color: '#e8fbff', size: 3, vy: .35, wobble: .25, opacity: .7, from: [0, 0, 0] });
    const motes = particles(s, { n: 120, r: 4, y0: -.3, y1: 3.2, color: '#cfe6dc', size: 1.6, vy: .015, drift: .03, wobble: .08, opacity: .45 });
    return { ground: h(0, 0), fog: [P.deep, .6, 7.5], fx: [bubbles, motes, t => shafts.forEach((m, i) => { m.rotation.z = .25 + Math.sin(t * .3 + i) * .06; m.material.opacity = (.08 + (i % 3) * .03) * (.75 + .25 * Math.sin(t * .8 + i * 2)); })], cam: { pos: [2.1, 1.2, 2.6], target: [0, .6, 0] } };
  },
  drowned(s, P) { return REGIONS.underwater(s, P, true); },
};

// ------------------------------------------------------------------ overlay
const CSS = `
.cu{position:absolute;inset:0;z-index:20;display:grid;grid-template-rows:auto 1fr auto;background:rgba(4,3,2,.94);opacity:0;transition:opacity .25s}
.cu.on{opacity:1}
html[data-theme="paper"] .cu{background:rgba(246,237,221,.97);color:#141a2c}
.cu-stage{position:relative;min-height:0}
.cu-stage canvas,.cu-stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;touch-action:none}
.cu-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line);position:relative;z-index:2}
.cu-head b{display:block;font-family:'Bebas Neue',sans-serif;font-weight:400;font-size:30px;letter-spacing:.08em;line-height:1;color:var(--bone)}
html[data-theme="paper"] .cu-head b{color:#141a2c}
.cu-head span{display:block;font-size:11px;color:var(--dust);margin-top:4px}
.cu-head i{display:inline-block;width:9px;height:9px;transform:rotate(45deg);margin-right:8px}
.cu-tag{display:inline-block;font-family:var(--f-crt);font-size:16px;letter-spacing:.08em;text-transform:uppercase;color:var(--amber);border:1px solid var(--amber-dim);padding:0 7px;margin:6px 6px 0 0}
.cu-x{font-family:'Bebas Neue',sans-serif;letter-spacing:.12em;font-size:15px;padding:7px 14px 6px;background:transparent;border:1px solid var(--line);color:var(--dust);cursor:pointer}
.cu-x:hover,.cu-x:focus-visible{color:var(--bone);border-color:var(--amber);outline:none}
.cu-foot{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 18px;border-top:1px solid var(--line);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dust)}
.cu-foot a{color:var(--amber);text-decoration:none;font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:.1em}
.cu-foot a:hover{text-decoration:underline}
.cu-load{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--f-crt);font-size:20px;color:var(--amber);letter-spacing:.1em;pointer-events:none}
`;
let cur = null;
export const isOpen = () => !!cur;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function openCloseup({ mount, char, region, theme = 'crt', where = '', siteUrl = null, onClose = null }) {
  closeCloseup(true);
  if (!document.getElementById('cu-css')) { const st = document.createElement('style'); st.id = 'cu-css'; st.textContent = CSS; document.head.appendChild(st); }
  const design = designFor(char), P = PAL[theme] || PAL.crt, kind = siteUrl ? 'site' : (REGIONS[region] ? region : 'plains');
  const el = document.createElement('div'); el.className = 'cu'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Close-up of ' + char.name);
  el.innerHTML = `<header class="cu-head"><div><b><i style="background:${esc(char.color || '#ffb238')}"></i>${esc(char.name)}</b>
      <span class="cu-tag">${esc(DESIGN_LABEL[design] || design)}</span><span class="cu-tag">${esc(REGION_LABEL[kind])}</span><span>${esc(where)}</span></div>
      <button type="button" class="cu-x">Close ✕</button></header>
    <div class="cu-stage"><div class="cu-load">RAISING THE SCENE…</div></div>
    <footer class="cu-foot"><span>drag to turn · scroll to zoom · esc to close</span>${siteUrl ? `<a href="${esc(siteUrl)}">Open the site →</a>` : ''}</footer>`;
  mount.appendChild(el); requestAnimationFrame(() => el.classList.add('on'));
  const stage = el.querySelector('.cu-stage'), load = el.querySelector('.cu-load');
  const state = { el, onClose, raf: 0, renderer: null, ro: null };
  cur = state;
  const onKey = e => { if (e.key === 'Escape') closeCloseup(); };
  addEventListener('keydown', onKey); state.offKey = () => removeEventListener('keydown', onKey);
  el.querySelector('.cu-x').addEventListener('click', () => closeCloseup());
  el.querySelector('.cu-x').focus({ preventScroll: true });

  if (siteUrl) {                                     // a built site: open it with the sword standing in it, giant
    const f = document.createElement('iframe');
    const q = new URLSearchParams({ embed: '1', pin: design, ring: char.color || '', theme: theme === 'paper' ? 'paper' : 'crt' });
    f.src = siteUrl + (siteUrl.includes('?') ? '&' : '?') + q; f.title = 'Site with ' + char.name + "'s sword";
    f.addEventListener('load', () => { load.remove(); });
    stage.appendChild(f); return;
  }

  await loadPins();
  if (cur !== state) return;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  state.renderer = renderer;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = theme === 'paper' ? 1.0 : 1.08;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.localClippingEnabled = true;
  stage.appendChild(renderer.domElement); load.remove();
  const scene = new THREE.Scene(), pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .5;
  const out = REGIONS[kind](scene, P) || {};
  const fogC = out.fog ? out.fog[0] : P.bg;
  const horizon = out.fog ? fogC : P.horizon;                  // a soft sky: page colour overhead, fading to the haze at the horizon
  const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
  { const x = sky.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, out.fog ? new THREE.Color(fogC).multiplyScalar(.55).getStyle() : P.bg); g.addColorStop(.62, horizon); g.addColorStop(1, horizon); x.fillStyle = g; x.fillRect(0, 0, 4, 256); }
  const skyT = new THREE.CanvasTexture(sky); skyT.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyT; scene.fog = new THREE.Fog(horizon, out.fog ? out.fog[1] : 4.5, out.fog ? out.fog[2] : 11);
  const under = kind === 'underwater' || kind === 'drowned';
  scene.add(new THREE.HemisphereLight(under ? '#bfeee6' : P.sky, P.gnd, under ? .9 : .75));
  const key = new THREE.DirectionalLight(under ? '#d6fff4' : P.key, under ? 1.6 : 2.3); key.position.set(2.5, 4, 2); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .5, far: 12 }); key.shadow.bias = -.0005; key.shadow.normalBias = .02;
  const rimL = new THREE.DirectionalLight(P.rim, .7); rimL.position.set(-3, 2, -2.5);
  scene.add(key, rimL);
  if (out.flag && char.color) out.flag.color.set(char.color);

  const pin = buildPin(design, { ring: char.color });
  const at = out.at || [0, 0];
  pin.group.position.set(at[0], out.ground ?? 0, at[1]); pin.group.rotation.y = .5;
  pin.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  (out.parent || scene).add(pin.group);

  const camera = new THREE.PerspectiveCamera(35, 1, .05, 60);
  const c = out.cam || { pos: [2.0, 1.1, 2.5], target: [0, .55, 0] };
  const tgt = new THREE.Vector3(...c.target).add(new THREE.Vector3(at[0], (out.ground ?? 0), at[1]));
  camera.position.copy(tgt).add(new THREE.Vector3(...c.pos).sub(new THREE.Vector3(...c.target)));
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(tgt); controls.enableDamping = true; controls.enablePan = false;
  controls.minDistance = 1.1; controls.maxDistance = 6.5; controls.maxPolarAngle = under ? 1.75 : 1.52;
  controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches; controls.autoRotateSpeed = .5;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  state.ro = new ResizeObserver(resize); state.ro.observe(stage); resize();
  const clock = new THREE.Clock();
  const loop = () => {
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime; TC.value = t;
    (out.fx || []).forEach(f => f(t, dt));
    pin.update(t, camera); controls.update(); renderer.render(scene, camera);
    state.raf = requestAnimationFrame(loop);
  };
  loop();
}

export function closeCloseup(silent = false) {
  const s = cur; if (!s) return; cur = null;
  cancelAnimationFrame(s.raf); s.offKey?.(); s.ro?.disconnect();
  if (s.renderer) { s.renderer.dispose(); s.renderer.forceContextLoss(); }
  s.el.classList.remove('on'); setTimeout(() => s.el.remove(), silent ? 0 : 250);
  if (!silent) s.onClose?.();
}
