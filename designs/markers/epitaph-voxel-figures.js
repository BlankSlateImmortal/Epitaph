/* Epitaph voxel figures: the map markers, built from blocks.
 * FIGS[name](V) builds one figure in a Vox, facing +z, base at y = 0. Colour each block with FIG_COLORS[theme][material]; 'group' / 'groupGlow' take the marker's own colour.
 * Statues: storyborn (an angel at prayer, wings spread, halo behind), voided (an angel under a black veil, wings broken), fallen (a plain broken sword, edges chipped).
 * Characters: orin (a longsword driven into the ground), nera (a magic-tech staff), yona (a pink star).
 * Primordials (the most detailed): antholonious (hooded, staff of light, cloak breaking into stone), sils (cowled reaper, one wing, scythe),
 *   moinera (angel in a wind-caught gown, wings raised), chaos (Grisha, enthroned under a cracked slab, crown of spires, red eyes), lithia (the blood-red angel).
 * Saved 2026-11-16 from the America map. Plain JavaScript, no libraries. */
const PI = Math.PI;
const hash3 = (x, y, z) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

class Vox {
  constructor() { this.m = new Map(); }
  k(x, y, z) { return ((x + 256) * 512 + (y + 256)) * 512 + (z + 256); }
  set(x, y, z, t) { x = Math.round(x); y = Math.round(y); z = Math.round(z); if (t) this.m.set(this.k(x, y, z), [x, y, z, t]); else this.m.delete(this.k(x, y, z)); }
  get(x, y, z) { const v = this.m.get(this.k(x, y, z)); return v && v[3]; }
  box(x0, y0, z0, x1, y1, z1, t) { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) this.set(x, y, z, t); }
  disc(cx, cz, y, r, t, thick = 0) { for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let z = Math.floor(cz - r); z <= cz + r; z++) { const d = Math.hypot(x - cx, z - cz); if (d <= r && (!thick || d > r - thick)) this.set(x, y, z, t); } }
  ball(cx, cy, cz, r, t) { for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let z = Math.floor(cz - r); z <= cz + r; z++) if (Math.hypot(x - cx, y - cy, z - cz) <= r) this.set(x, y, z, t); }
  carve(fn) { for (const [key, v] of this.m) if (fn(v[0], v[1], v[2], v[3])) this.m.delete(key); }
  line(a, b, t, r = 0) { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 2); for (let s = 0; s <= n; s++) { const u = s / n, p = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; if (r) this.ball(...p, r, t); else this.set(...p, t); } }
}
// a wing: a fan of feathers in the plane behind the shoulders. side = ±1; spread 0..1; broken = snapped and drooping
function wing(V, side, sx, sy, sz, span, rise, mat, matD, opts = {}) {
  const { broken = false, torn = 0, droop = 0 } = opts;
  for (let i = 0; i <= span; i++) {
    const t = i / span; let top = sy + Math.sin(t * PI * 0.62) * rise - droop * t * t * span * 0.6;
    let len = (span * 0.55) * (1 - t * 0.55) + 2 + (i % 2 ? 0 : 1.5);                      // feather lengths, alternating, longest near the body
    let x = sx + side * i;
    if (broken && t > 0.42) {                                                                  // snapped at the wrist: the outer half hangs down
      const k = (t - 0.42) / 0.58; x = sx + side * (span * 0.42 + k * span * 0.25); top = sy + Math.sin(0.42 * PI * 0.62) * rise - k * span * 0.9; len *= 0.8;
    }
    for (let d = 0; d < len; d++) {
      if (torn && hash3(i, d, side + 7) < torn) continue;                                      // ragged gaps
      const y = top - d; if (y < 1) break;
      const edge = d > len - 2.5 || d < 1;
      V.set(x, y, sz, edge ? matD : mat); if (t < 0.35) V.set(x, y, sz - 1, mat);
    }
  }
}
const FIGS = {
  // Storyborn: an angel at prayer, hands together, wings spread wide, a halo standing behind the head
  storyborn(V) {
    V.disc(0, 0, 0, 7, 'stone'); V.disc(0, 0, 1, 6.2, 'marbleD'); V.disc(0, 0, 1, 6.2, 'group', 0.9);
    for (let y = 2; y < 17; y++) V.disc(0, 0, y, 3.6 - (y - 2) * 0.12 + (y % 3 === 0 ? 0.2 : 0), y % 4 === 1 ? 'marbleD' : 'marble');   // the robe, with folds
    for (let y = 17; y < 22; y++) V.disc(0, 0, y, 1.9 - (y - 17) * 0.05, 'marble');
    V.box(-3, 20, -1, 4, 22, 2, 'marble');                                                          // shoulders
    V.ball(0, 24, 0.3, 1.7, 'marble'); V.set(0, 23, 2, 'marbleD');                                // head, a little bowed
    V.line([-2.6, 20.5, 0], [-0.6, 19.5, 2.4], 'marble', 0.7); V.line([2.6, 20.5, 0], [0.6, 19.5, 2.4], 'marble', 0.7);   // arms
    V.box(0, 19, 2, 1, 23, 4, 'marbleD');                                                          // hands pressed together
    for (const s of [-1, 1]) wing(V, s, s * 2, 22, -2, 13, 7, 'marble', 'marbleD');
    for (let a = 0; a < 64; a++) { const t = a / 64 * PI * 2; for (const dr of [0, 0.6]) V.set(Math.cos(t) * (4.6 + dr), 24.5 + Math.sin(t) * (4.6 + dr), -3.5, 'gold'); }   // halo
    for (let a = 0; a < 12; a++) { const t = a / 12 * PI * 2; V.line([0, 24.5, -3.6], [Math.cos(t) * 4.2, 24.5 + Math.sin(t) * 4.2, -3.6], 'gold'); }
  },
  // Voided: an angel under a black veil to the ground, wings broken, feathers fallen
  voided(V) {
    V.disc(0, 0, 0, 7, 'stone'); V.disc(0, 0, 1, 6.2, 'stone'); V.disc(0, 0, 1, 6.2, 'group', 0.9);
    for (let a = 0; a < 6; a++) { const t = a * 1.1; V.line([Math.cos(t) * 2, 1, Math.sin(t) * 2], [Math.cos(t) * 5.6, 1, Math.sin(t) * 5.6], 'groupGlow'); }   // cracks of void light in the base
    for (let y = 2; y <= 25; y++) {                                                                 // the veil: a shell draped from the crown to the floor, folds round it
      const r0 = y > 22 ? 1.9 - (y - 22) * 0.45 : 1.9 + (22 - y) * 0.18;
      for (let a = 0; a < 72; a++) { const t = a / 72 * PI * 2, r = r0 + Math.sin(t * 7 + y * 0.2) * 0.45 * Math.min(1, (24 - y) / 8);
        V.set(Math.cos(t) * r, y, Math.sin(t) * r + (y > 19 ? 0.6 : 0) * Math.max(0, (y - 19) / 6), Math.sin(t * 7) > 0.6 ? 'veilHi' : 'veil'); }
      if (y > 3) V.disc(0, 0, y, r0 - 1.2, 'veil');
    }
    V.box(-1, 13, 3, 1, 15, 4, 'marble');                                                          // a pale hand holding the veil closed
    wing(V, -1, -2, 21, -3, 13, 5, 'ash', 'ashD', { broken: true, torn: 0.12 });                   // the left wing snapped and hanging
    wing(V, 1, 2, 21, -3, 8, 4, 'ash', 'ashD', { torn: 0.28, droop: 0.6 });                        // the right wing torn short
    for (const [x, z] of [[4, 3], [-5, 2], [3, -4], [-2, 5], [5, -1]]) V.box(x, 2, z, x + 2, 3, z + 1, 'ash');   // fallen feathers
  },
  // Fallen: no god (they reject them). A plain sword, broken: it hangs hilt-up over the base, the blade ending in a jagged
  // break, its edges chipped; the snapped-off tip lies on the base below. Grip wrapped in the Fallen's red.
  fallen(V) {
    V.disc(0, 0, 0, 7, 'stone'); V.disc(0, 0, 1, 6.2, 'group', 0.9);
    const lo = 9, hi = 22;                                                            // the blade runs from the break (lo) up to the guard (hi)
    for (let y = lo; y < hi; y++) for (let x = -2; x <= 2; x++) {
      const edge = Math.abs(x) === 2;
      if (edge && [12, 13, 17, 20].includes(y) && (x > 0) === (y % 2 === 0)) continue;                  // chips out of the edges
      if (y < lo + 3 && ((x * 7 + y * 3) % 5 + 5) % 5 < 3 - (y - lo)) continue;                         // the jagged break
      V.set(x, y, 0, edge ? 'steelHi' : x === 0 ? 'steelD' : 'steel'); }
    for (let x = -6; x <= 6; x++) for (const z of [-1, 0, 1]) V.set(x, hi, z, 'steelD');               // a plain straight crossguard
    V.set(-6, hi + 1, 0, 'steelD'); V.set(6, hi + 1, 0, 'steelD');
    for (let y = hi + 1; y < hi + 8; y++) { V.box(-1, y, -1, 1, y + 1, 1, y % 2 ? 'group' : 'leatherD'); V.set(0, y, 0, y % 2 ? 'group' : 'leatherD'); }   // red-wrapped grip
    V.box(-1, hi + 8, -1, 2, hi + 10, 2, 'steelD'); V.set(0, hi + 10, 0, 'steel');                      // pommel
    for (let k = 0; k < 8; k++) { const x = -1 + k * 0.5, z = 2 + k * 0.45, w = k < 5 ? 2 : k < 7 ? 1 : 0;   // the lost tip, lying on the base, tapering to its point
      for (let d = -w; d <= w; d++) V.set(x + d * 0.35, 2, z - d * 0.4, Math.abs(d) === w ? 'steelHi' : 'steel'); }
    for (const [x, z] of [[-3, 1], [-2, 4], [3, -2], [1, -3]]) V.set(x, 2, z, 'steelHi');                // shards
  }
};

// ---- character markers
// Orin: a longsword driven into the ground. The earth round it is cracked into smooth dark ground (Nothing's scar).
FIGS.orin = function (V) {
  V.disc(0, 0, 0, 7, 'stone'); V.disc(0, 0, 1, 6.2, 'earth');
  for (let a = 0; a < 7; a++) { const t = a * 0.9 + 0.3, len = 3 + (a % 3) * 1.4; V.line([Math.cos(t) * 0.8, 1, Math.sin(t) * 0.8], [Math.cos(t) * len, 1, Math.sin(t) * len], 'scar'); }
  V.disc(0, 0, 1, 1.8, 'scar'); V.box(-2, 2, -1, 3, 3, 2, 'earth'); V.set(-2, 3, 0, 'earth'); V.set(2, 3, 1, 'earth');       // heaved soil where it went in
  for (let y = 2; y < 24; y++) { const w = y > 21 ? 0 : 1;                                                                  // the blade, tapering to the ground, a dark fuller up its middle
    for (let x = -w - 1; x <= w + 1; x++) V.set(x, y, 0, x === 0 && y > 4 && y < 20 ? 'steelD' : Math.abs(x) === w + 1 ? 'steelHi' : 'steel'); }
  V.box(-1, 2, 0, 2, 4, 1, 'steelD');
  for (let x = -6; x <= 6; x++) { const up = Math.abs(x) > 4 ? 1 : 0; V.set(x, 24 + up, 0, 'steelD'); V.set(x, 24 + up, 1, 'steelD'); V.set(x, 24 + up, -1, 'steelD'); }   // crossguard, tips swept up
  V.set(-6, 26, 0, 'gold'); V.set(6, 26, 0, 'gold'); V.box(-1, 23, -1, 2, 25, 2, 'gold');
  for (let y = 25; y < 32; y++) { V.box(-1, y, -1, 1, y + 1, 1, y % 2 ? 'leather' : 'leatherD'); V.set(0, y, 0, y % 2 ? 'leather' : 'leatherD'); }   // wrapped grip
  V.ball(0, 33, 0, 1.5, 'gold'); V.set(0, 33, 1, 'scar');                                                                   // pommel with a dark stone
  for (let i = 0; i < 9; i++) V.set(1 + i * 0.6, 29 - i * 1.1, 1 + Math.sin(i) * 0.8, 'cloth');                            // a torn strip of cloth tied at the grip
};
// Nera: a magic-tech staff planted upright: a shod shaft wound with metal, a cage of tines round a glowing core, Storyborn glyph rings turning round it
FIGS.nera = function (V) {
  V.disc(0, 0, 0, 7, 'stone'); V.disc(0, 0, 1, 6.2, 'group', 0.9); V.disc(0, 0, 1, 2.2, 'steelD');
  for (let y = 2; y < 34; y++) { V.set(0, y, 0, 'wood'); V.set(1, y, 0, 'wood'); V.set(0, y, 1, 'wood'); V.set(1, y, 1, 'wood');            // the shaft
    if (y % 5 === 0) { V.box(-1, y, -1, 3, y + 1, 3, 'steel'); } }                                                        // metal bands
  for (let y = 4; y < 30; y++) { const t = y * 0.55; V.set(0.5 + Math.cos(t) * 1.6, y, 0.5 + Math.sin(t) * 1.6, 'steelD'); }   // a wire wound up the shaft
  V.box(-1, 34, -1, 3, 36, 3, 'steel');
  for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; for (let y = 0; y < 9; y++) { const r = 1.4 + Math.sin(y / 8 * PI) * 2.4;  // the cage of tines
    V.set(0.5 + Math.cos(a) * r, 36 + y, 0.5 + Math.sin(a) * r, 'steelHi'); } }
  V.ball(0.5, 40, 0.5, 1.9, 'core'); V.set(0.5, 45, 0.5, 'steelHi'); V.set(0.5, 46, 0.5, 'core');
  for (const [tilt, r, col] of [[0.5, 4.6, 'gold'], [-0.7, 5.6, 'glyph']]) for (let a = 0; a < 80; a++) { const t = a / 80 * PI * 2;   // glyph rings, gapped like script
    if ((a % 9) === 0) continue; const x = Math.cos(t) * r, z = Math.sin(t) * r; V.set(0.5 + x, 40 + z * Math.sin(tilt), 0.5 + z * Math.cos(tilt), col); }
};
// Yona: a pink star, faceted, floating over a small cloud of dream, with sparks round it
FIGS.yona = function (V) {
  V.disc(0, 0, 0, 7, 'stone'); V.disc(0, 0, 1, 6.2, 'group', 0.9);
  for (const [x, y, z, r] of [[0, 3, 0, 2.6], [-2.4, 3, 1, 1.9], [2.3, 3, -0.6, 2], [0.6, 4.4, 1.4, 1.7], [-1, 4.6, -1.2, 1.6]]) V.ball(x, y, z, r, 'cloud');   // the dream cloud
  const cy = 18, R = 10, r0 = 4.2, D = 3.2;                                                     // star: 5 points, depth D at the centre falling to 0 at the tips (faceted)
  const pts = []; for (let k = 0; k < 10; k++) { const a = PI / 2 + k * PI / 5, rr = k % 2 ? r0 : R; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  const inStar = (x, y) => { let c = false; for (let i = 0, j = 9; i < 10; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  for (let x = -R; x <= R; x++) for (let y = -R; y <= R; y++) { if (!inStar(x, y)) continue;
    const d = Math.hypot(x, y), a = Math.atan2(y, x), ridge = Math.abs(Math.cos(((a - PI / 2) * 5) / 2)), depth = Math.max(0.6, D * (1 - d / R) * (0.55 + 0.45 * ridge));
    for (let z = -Math.round(depth); z <= Math.round(depth); z++) V.set(x, cy + y, z, Math.abs(z) === Math.round(depth) ? (ridge > 0.8 ? 'pinkHi' : 'pink') : 'pinkD'); }
  for (const [x, y, z] of [[-9, 26, 2], [8, 9, -1], [11, 21, 1], [-7, 8, -2], [3, 30, 0], [-12, 16, 0]]) { V.set(x, y, z, 'spark'); V.set(x + 1, y, z, 'spark'); V.set(x - 1, y, z, 'spark'); V.set(x, y + 1, z, 'spark'); V.set(x, y - 1, z, 'spark'); }
  for (let y = 6; y < cy - 8; y++) V.set(0, y, 0, y % 2 ? 'spark' : 'pinkD');                   // a thread of light holding it up
};
// Colours for every material the figures use. Supply `group` per marker (Storyborn teal, Voided violet, Fallen red, or a character's colour).
// ---- the Primordials: the most detailed pieces. Each stands about 70 to 95 blocks tall.
// a tapered body of stacked rings: r(y) gives the radius, mat(x, y, z, a) the block; shell = wall thickness (0 = solid)
function tube(V, cx, cz, y0, y1, r, mat, shell = 1.8) {
  for (let y = y0; y < y1; y++) { const R = r(y); if (R <= 0) continue;
    const Rb = typeof R === 'function' ? 26 : R;
    for (let x = Math.floor(cx - Rb - 3); x <= cx + Rb + 3; x++) for (let z = Math.floor(cz - Rb - 3); z <= cz + Rb + 3; z++) {
      const a = Math.atan2(z - cz, x - cx), d = Math.hypot(x - cx, z - cz), Ra = typeof R === 'function' ? R(a) : R;
      if (d <= Ra && (!shell || d > Ra - shell || y === y1 - 1)) V.set(x, y, z, mat(x, y, z, a, d / Ra)); } }
}
const pick3 = (x, y, z, a, b, c) => { const h = hash3(x, y, z); return h < 0.3 ? a : h < 0.8 ? b : c; };
// a great wing: layered feather blades fanning down from an arm that rises out from the shoulder
function greatWing(V, side, sx, sy, sz, span, rise, mats, o = {}) {
  const { feathers = 22, drop = 18, ragged = 0, drips = 0, layers = 2, dripMat, droop = 0 } = o;
  for (let f = 0; f <= feathers; f++) {
    const t = f / feathers, ax = sx + side * t * span, ay = sy + Math.sin(t * PI * 0.55) * rise - droop * t * t * rise, az = sz - t * 3;
    const len = drop * (1 - t * 0.55) + (f % 2 ? 0 : 3) + (t > 0.85 ? 6 : 0), lean = side * (0.15 + t * 0.55);
    for (let L = 0; L < layers; L++) for (let k = 0; k < len; k++) {
      if (ragged && k > len * 0.5 && hash3(f, k, L + 3) < ragged) continue;
      const x = ax + lean * k * 0.6 + side * L * 0.5, y = ay - k + L * 1.2, z = az - L;
      if (y < 2) break;
      const m = k > len - 3 ? mats[2] : (f + L) % 3 === 0 ? mats[1] : mats[0];
      V.set(x, y, z, m); V.set(x + side * 0.5, y, z, m);
    }
    if (drips && hash3(f, 9, side) < drips) { const x = ax + lean * len * 0.6, y0 = ay - len; for (let y = y0; y > 1 && y > y0 - 10 - hash3(f, 2, side) * 50; y--) V.set(x, y, az, dripMat); }
  }
  for (let t = 0; t <= 1; t += 0.02) V.ball(sx + side * t * span, sy + Math.sin(t * PI * 0.55) * rise - droop * t * t * rise + 1, sz - t * 3, 1.3 - t * 0.6, mats[0]);   // the arm of the wing
}

// Antholonious (Fate): a hooded figure with a staff of light; his cloak comes apart into floating stone behind him
FIGS.antholonious = function (V) {
  for (let y = 0; y < 4; y++) tube(V, 0, 0, y, y + 1, () => 17 - y * 1.2 + (hash3(y, 1, 2) - 0.5), (x, yy, z) => pick3(x, yy, z, 'pstoneD', 'pstone', 'pstoneHi'), 0);
  for (let i = 0; i < 40; i++) { const a = hash3(i, 3, 1) * PI * 2, d = 12 + hash3(i, 4, 1) * 6; V.box(Math.round(Math.cos(a) * d), 0, Math.round(Math.sin(a) * d), Math.round(Math.cos(a) * d) + 2, 2 + Math.floor(hash3(i, 5, 1) * 3), Math.round(Math.sin(a) * d) + 2, 'pstone'); }
  const cloak = (x, y, z, a) => { const back = Math.cos(a - 3.7); return back > 0.55 && hash3(x, y, z) < 0.25 ? 'pstoneD' : pick3(x, y, z, 'pstoneD', 'pstone', 'pstoneHi'); };
  tube(V, 0, 0, 4, 46, y => a => { const back = Math.max(0, Math.cos(a - 3.7)); return 9 - (y - 4) * 0.11 + Math.sin(a * 9 + y * 0.15) * 0.6 + back * back * (46 - y) * 0.18; }, cloak);
  // the cloak breaking apart: chunks drifting off behind, more and smaller the further they go
  for (let i = 0; i < 140; i++) { const a = 3.7 + (hash3(i, 1, 9) - 0.5) * 1.6, y = 8 + hash3(i, 2, 9) * 40, d = 10 + (46 - y) * 0.2 + hash3(i, 3, 9) * 14, s = d > 18 ? 1 : 2;
    V.box(Math.round(Math.cos(a) * d), Math.round(y), Math.round(Math.sin(a) * d), Math.round(Math.cos(a) * d) + s, Math.round(y) + s, Math.round(Math.sin(a) * d) + s, hash3(i, 4, 9) < 0.5 ? 'pstone' : 'pstoneHi'); }
  tube(V, 0, 0, 46, 54, y => 5 + (y > 50 ? (54 - y) * 0.3 : 1), (x, y, z) => pick3(x, y, z, 'pstoneD', 'pstone', 'pstoneHi'), 0);
  V.box(-7, 50, -2, 8, 53, 3, 'pstone');                                                                           // shoulders under the hood
  // the hood: a tall cowl, its mouth a deep shadow
  for (let y = 52; y < 66; y++) { const r = 5.2 - Math.max(0, y - 60) * 0.7; for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) { const d = Math.hypot(x, (z - (y - 52) * 0.08) * 0.9); if (d <= r && d > r - 1.6) V.set(x, y, z + 1, z > 2 && y < 63 && Math.abs(x) < 3 ? null : pick3(x, y, z, 'pstoneD', 'pstone', 'pstoneHi')); } }
  for (let y = 54; y < 62; y++) for (let x = -2; x <= 2; x++) V.set(x, y, 2, 'shadow'); V.set(-1, 58, 3, 'fate'); V.set(1, 58, 3, 'fate');   // the face: shadow, two points of light
  V.box(0, 66, 1, 1, 68, 2, 'pstoneHi');
  // the right arm raised to the staff, a wide sleeve
  V.line([5, 50, 0], [10, 45, 4], 'pstone', 2.2); V.ball(11, 44, 5, 1.6, 'pstoneHi');
  for (let y = 2; y < 74; y++) V.box(11, y, 5, 13, y + 1, 7, y % 6 === 0 ? 'pstoneHi' : 'pstoneD');           // the staff
  for (let a = 0; a < 60; a++) { const t = a / 60 * PI * 2; if (t > 4.4 && t < 5.0) continue; V.set(12 + Math.cos(t) * 5, 79 + Math.sin(t) * 5, 6, 'pstoneHi'); V.set(12 + Math.cos(t) * 5.6, 79 + Math.sin(t) * 5.6, 6, 'pstone'); }
  V.box(10, 77, 4, 14, 81, 8, 'fate'); V.box(11, 81, 5, 13, 82, 7, 'fate'); V.box(11, 76, 5, 13, 77, 7, 'fate');     // the light it holds
  for (let i = 0; i < 18; i++) { const a = hash3(i, 7, 7) * PI * 2, d = 7 + hash3(i, 8, 7) * 4; V.box(12 + Math.round(Math.cos(a) * d), 74 + Math.round(hash3(i, 9, 7) * 12), 6 + Math.round(Math.sin(a) * 3), 13 + Math.round(Math.cos(a) * d), 75 + Math.round(hash3(i, 9, 7) * 12), 7 + Math.round(Math.sin(a) * 3), 'pstoneHi'); }
};

// Sils (Nothing): a cowled reaper on a round plinth, one great wing, a scythe arcing over his head. No face at all.
FIGS.sils = function (V) {
  for (const [y, r] of [[0, 17], [1, 16], [2, 15], [3, 13.5], [4, 12.5]]) tube(V, 0, 0, y, y + 1, () => r, (x, yy, z) => pick3(x, yy, z, 'voidD', 'void', 'voidHi'), 0);
  tube(V, 0, 0, 5, 10, y => a => 11 - (y - 5) * 0.3 + (hash3(Math.round(a * 20), y, 1) - 0.5) * 1.6, (x, y, z) => pick3(x, y, z, 'voidD', 'void', 'void'), 0);   // rocks round the hem
  tube(V, 0, 0, 8, 52, y => a => 9.5 - (y - 8) * 0.1 + Math.sin(a * 7 + y * 0.08) * 0.9 * (1 - (y - 8) / 60), (x, y, z, a) => (Math.sin(a * 7 + y * 0.08) > 0.5 ? 'voidHi' : pick3(x, y, z, 'voidD', 'void', 'void')));
  tube(V, 0, 0, 52, 58, y => 5.6 + (y < 55 ? 1.2 : 0), (x, y, z) => pick3(x, y, z, 'voidD', 'void', 'voidHi'), 0);
  for (let i = -5; i <= 5; i++) V.set(i, 53 - Math.abs(i) * 0.35, 6.4 - Math.abs(i) * 0.1, 'dimgold');            // a chain across the breast
  for (let y = 56; y < 74; y++) { const r = 6 - Math.max(0, y - 66) * 0.75; for (let x = -7; x <= 7; x++) for (let z = -7; z <= 7; z++) { const d = Math.hypot(x, z - (y - 56) * 0.12); if (d <= r && d > r - 1.7) V.set(x, y, z + 1, z > 2.5 && y < 70 && Math.abs(x) < 3.2 ? null : pick3(x, y, z, 'voidD', 'void', 'voidHi')); } }
  for (let y = 58; y < 69; y++) for (let x = -3; x <= 3; x++) V.set(x, y, 2, 'nothing');                            // inside the cowl: nothing
  V.box(0, 74, 1, 1, 76, 2, 'void');
  greatWing(V, -1, -3, 62, -5, 24, 16, ['void', 'voidHi', 'voidD'], { feathers: 26, drop: 30, layers: 3 });
  V.line([6, 56, 0], [9, 46, 3], 'void', 2.4); V.ball(9.5, 45, 4, 1.7, 'voidHi');                                    // the right arm to the scythe
  for (let y = 4; y < 84; y++) { const x = 9 + (y - 4) * -0.04; V.box(Math.round(x), y, 4, Math.round(x) + 2, y + 1, 6, y % 7 === 0 ? 'voidHi' : 'wood'); }
  for (let t = 0; t <= 1; t += 0.008) { const x = 6 - t * 22, y = 84 + Math.sin(t * PI) * 7 - t * 5, w = Math.max(1, 3.4 * (1 - t));   // the blade
    for (let k = 0; k < w; k++) V.set(x, y - k, 5, k < 1 ? 'bladeHi' : 'blade'); }
  for (let a = 0; a < 6; a++) V.set(Math.cos(a) * 14, 1, Math.sin(a) * 14, 'voidGlow');
};

// Moinera (Imagination): an angel in a flowing gown, one fold of it caught by a wind, wings raised behind her
FIGS.moinera = function (V) {
  V.box(-12, 0, -9, 13, 2, 10, 'marbleD'); V.box(-10, 2, -7, 11, 4, 8, 'marble'); V.box(-11, 4, -8, 12, 5, 9, 'marbleHi');
  const sway = y => Math.sin(y * 0.07) * 1.6;
  tube(V, 0, 0, 5, 38, y => a => 7.2 - (y - 5) * 0.1 + Math.sin(a * 8 + y * 0.25) * 0.55 + (Math.cos(a) > 0 ? Math.sin(y * 0.07) : 0) * 1.2, (x, y, z, a) => Math.sin(a * 8 + y * 0.25) > 0.6 ? 'marbleD' : pick3(x, y, z, 'marble', 'marble', 'marbleHi'));
  for (let i = 0; i < 70; i++) { const t = i / 70, x = 5 + t * 14, y = 30 - t * 12 + Math.sin(t * 6) * 2;                    // the fold the wind takes
    for (let k = 0; k < 6 - t * 4; k++) V.set(x, y - k, 2 - t * 3, k === 0 ? 'marbleHi' : 'marble'); }
  for (let a = 0; a < 40; a++) { const t = a / 40 * PI * 2; V.set(Math.cos(t) * 4.2, 38, Math.sin(t) * 4.2, 'pink'); V.set(Math.cos(t) * 4.2, 37, Math.sin(t) * 4.2, 'pink'); }   // her sash, in her colour
  tube(V, 0, 0, 38, 50, y => 3.8 + (y > 43 && y < 48 ? 0.8 : 0), (x, y, z) => pick3(x, y, z, 'marble', 'marble', 'marbleHi'), 0);
  V.box(-6, 48, -2, 7, 51, 3, 'marble'); for (let x = -5; x <= 5; x++) V.set(x, 50, 3, 'marbleD');                    // shoulders, a neckline
  V.line([-6, 49, 0], [-7, 38, 1], 'marble', 1.3); V.line([-7, 38, 1], [-6, 31, 3], 'marble', 1.1);                // left arm down, holding the gown
  V.line([6, 49, 0], [5, 42, 3], 'marble', 1.3); V.line([5, 42, 3], [1, 45, 4], 'marble', 1.1); V.ball(1, 45, 4.5, 1, 'marbleHi');   // right hand at her breast
  V.box(-1, 50, -1, 2, 53, 2, 'marble'); V.ball(0.5, 55.5, 0.5, 2.9, 'marble');                                      // neck, head
  for (let y = 46; y < 58; y++) for (let x = -4; x <= 5; x++) if (hash3(x, y, 4) < 0.85 && Math.abs(x - 0.5) < 3.4 + (58 - y) * 0.06) V.set(x, y, -3, 'marbleD');   // hair down her back
  for (let a = 0; a < 30; a++) { const t = a / 30 * PI * 2; V.set(0.5 + Math.cos(t) * 3.1, 57.5, 0.5 + Math.sin(t) * 3.1, 'gold'); } V.set(0.5, 57.5, 3.6, 'pinkHi');   // a circlet with a pink stone
  V.set(-0.5, 55.5, 3.3, 'marbleD'); V.set(1.5, 55.5, 3.3, 'marbleD');
  for (const s of [-1, 1]) { greatWing(V, s, s * 2.5, 50, -4, 17, 20, ['marble', 'marbleHi', 'marbleD'], { feathers: 24, drop: 26, layers: 3 }); }
};

// Chaos (Grisha): enthroned under a cracked slab, a mantle like a bell, a crown of uneven spires, red eyes
FIGS.chaos = function (V) {
  V.box(-18, 0, -12, 19, 3, 14, 'gstoneD'); V.box(-16, 3, -10, 17, 4, 12, 'gstone');
  V.box(-12, 4, -8, 13, 20, 8, 'gstone');                                                                             // the seat
  for (const s of [-1, 1]) { const x0 = s < 0 ? -15 : 11; V.box(x0, 4, -8, x0 + 4, 28, 10, 'gstoneD'); V.box(x0 - 1, 28, -8, x0 + 5, 30, 11, 'gstoneHi');
    for (let y = 6; y < 26; y += 4) V.box(x0, y, 10, x0 + 4, y + 1, 11, 'gstoneHi'); }                             // arms of the throne, ribbed
  V.box(-15, 20, -11, 16, 92, -7, 'gstone'); V.box(-17, 20, -11, -14, 92, -7, 'gstoneD'); V.box(15, 20, -11, 18, 92, -7, 'gstoneD');   // the great back
  for (let c = 0; c < 6; c++) { let x = -12 + hash3(c, 1, 1) * 26, y = 50 + hash3(c, 2, 1) * 40; for (let k = 0; k < 26; k++) { V.set(x, y, -7, 'crack'); x += (hash3(c, k, 3) - 0.5) * 2.4; y -= hash3(c, k, 4) * 1.6; if (y < 22) break; } }   // cracks
  for (let x = -22; x <= 22; x++) { V.set(x, 64, -6, 'crack'); V.set(x, 65, -6, 'gstoneD'); }                          // a bar of dark iron across the slab
  for (let x = -6; x <= 6; x++) V.set(x, 92, -9, 'gstoneHi'); V.carve((x, y, z) => y > 86 && z < -6 && (x === -4 || x === 7) && y < 92);
  // the seated figure: robe falling over the seat's edge in heavy folds
  for (let x = -9; x <= 9; x++) for (let y = 4; y < 24; y++) { const fold = Math.sin(x * 0.9) * 1.2 + (24 - y) * 0.12; for (let z = 7; z < 9 + fold; z++) V.set(x, y, z, Math.sin(x * 0.9) > 0.5 ? 'gstoneHi' : pick3(x, y, z, 'gstoneD', 'gstone', 'gstone')); }
  V.box(-9, 20, -2, 10, 26, 10, 'gstone');                                                                           // lap and knees
  tube(V, 0.5, 0, 26, 46, y => 6.2 - (y - 26) * 0.04, (x, y, z) => pick3(x, y, z, 'gstoneD', 'gstone', 'gstoneHi'), 0);
  tube(V, 0.5, 0, 44, 51, y => 12 - (y - 44) * 1.1, (x, y, z, a) => (Math.round(a * 12) % 2 ? 'gstoneHi' : 'gstone'), 0);   // the mantle
  for (const s of [-1, 1]) { V.line([s * 6, 44, 0], [s * 11, 30, 4], 'gstone', 2); V.box(s < 0 ? -14 : 10, 29, 2, s < 0 ? -9 : 15, 32, 9, 'gstoneHi'); }   // arms on the armrests, hands spread
  V.box(-3, 51, -2, 4, 53, 3, 'gstone');
  for (let y = 53; y < 62; y++) { const r = 3.8; for (let x = -4; x <= 5; x++) for (let z = -4; z <= 5; z++) { const d = Math.hypot(x - 0.5, z - 0.5); if (d <= r && d > r - 1.5) V.set(x, y, z, pick3(x, y, z, 'gstoneD', 'gstone', 'gstoneHi')); } }
  for (let y = 54; y < 60; y++) for (let x = -1; x <= 2; x++) V.set(x, y, 4, 'crack'); V.set(-0.5, 57, 5, 'eye'); V.set(1.5, 57, 5, 'eye');   // the face in shadow, red eyes
  V.box(-1, 59, 4, 3, 60, 5, 'gstoneHi');
  for (let i = 0; i < 9; i++) { const x = -4 + i, h = 6 + Math.round(hash3(i, 7, 7) * 9) + (i === 4 ? 6 : 0); V.box(x, 61, i % 2 ? 0 : 1, x + 1, 61 + h, (i % 2 ? 0 : 1) + 1, i % 3 ? 'gstoneHi' : 'gstone'); }   // the crown
  for (let x = -12; x <= 13; x++) V.set(x, 62, -1, 'crack');                                                         // the dark bar crossing behind his head
};

// Lithia (Reality): the blood-red angel. Wings flung up and out, and everything she is runs down in drips to a dark pool
FIGS.lithia = function (V) {
  tube(V, 0, 0, 0, 1, () => a => 15 + Math.sin(a * 5) * 2, (x, y, z) => pick3(x, y, z, 'bloodD', 'bloodD', 'blood'), 0);
  tube(V, 0, 0, 4, 34, y => a => 3.4 + (34 - y) * 0.03 + Math.sin(a * 6 + y * 0.3) * 0.5, (x, y, z, a) => (Math.cos(a - 0.6) > 0.8 && hash3(x, y, z) < 0.6 ? 'bone' : pick3(x, y, z, 'bloodD', 'blood', 'bloodHi')), 0);
  tube(V, 0, 0, 34, 60, y => 3.2 + (y > 46 && y < 54 ? 1 : 0) - (y > 56 ? (y - 56) * 0.4 : 0), (x, y, z) => pick3(x, y, z, 'bloodD', 'blood', 'bloodHi'), 0);
  V.box(-5, 55, -2, 6, 58, 3, 'blood'); V.box(-1, 58, -1, 2, 61, 2, 'blood'); V.ball(0.5, 63.5, 0.5, 2.8, 'blood');     // shoulders, neck, a smooth head
  V.line([5, 56, 0], [8, 44, 2], 'bone', 1.2); V.line([8, 44, 2], [9, 33, 3], 'bone', 1.0);                          // one white arm hanging
  for (let i = 0; i < 70; i++) { const a = hash3(i, 1, 4) * PI * 2, r = 3 + hash3(i, 2, 4), y0 = 8 + hash3(i, 3, 4) * 46, len = 6 + hash3(i, 4, 4) * 40;   // runs down the body
    for (let y = y0; y > y0 - len && y > 1; y--) V.set(Math.cos(a) * (r + 0.6), y, Math.sin(a) * (r + 0.6), hash3(i, 5, 4) < 0.25 ? 'bone' : 'bloodD'); }
  for (const s of [-1, 1]) greatWing(V, s, s * 2.5, 58, -3, 22, 30, ['blood', 'bloodHi', 'bloodD'], { feathers: 26, drop: 32, layers: 3, ragged: 0.12, drips: 0.75, dripMat: 'bloodD' });
};

const FIG_COLORS = {
  crt:   {
           pstone: '#d9d6cf', pstoneD: '#a9a59c', pstoneHi: '#f2f0ea', shadow: '#0c0b10', fate: '#ffe7a8', void: '#2c2832', voidD: '#1a171f', voidHi: '#45404e', nothing: '#020203', dimgold: '#9a7a3a', wood: '#4a3424', blade: '#cfc9d6', bladeHi: '#f4f0fa', voidGlow: '#9b8cff', marbleHi: '#fffaf0', pinkHi: '#ffc2e6', gstone: '#8f8f93', gstoneD: '#626266', gstoneHi: '#bdbdc2', crack: '#141416', eye: '#ff3a2a', blood: '#a3141a', bloodD: '#640a10', bloodHi: '#d0303a', bone: '#ece4dc',
           stone: '#4a3a28', marble: '#f1e6cf', marbleD: '#cbbd9e', gold: '#ffc04a', veil: '#120e16', veilHi: '#2a2230', ash: '#9a9284', ashD: '#6e6758',
           earth: '#6a4a2a', scar: '#0b0a0e', steel: '#b9bec6', steelD: '#6f7680', steelHi: '#eef2f6', leather: '#5a3a22', leatherD: '#3a2414', cloth: '#9a2a22',
           wood: '#5e3e22', core: '#ffcf7a', glyph: '#ffe7a0', cloud: '#f3d6e6', pink: '#ff7ac8', pinkD: '#d4509e', pinkHi: '#ffc2e6', spark: '#fff2fa' },
  paper: {
           pstone: '#e6e3dc', pstoneD: '#b7b2a8', pstoneHi: '#ffffff', shadow: '#16141c', fate: '#ffd36a', void: '#3a3542', voidD: '#25212b', voidHi: '#58525f', nothing: '#050507', dimgold: '#b08a3e', wood: '#5e4430', blade: '#d9d4e0', bladeHi: '#ffffff', voidGlow: '#6a5acd', marbleHi: '#ffffff', pinkHi: '#ffb6dc', gstone: '#9c9ca0', gstoneD: '#707074', gstoneHi: '#cacace', crack: '#1c1c20', eye: '#e8392e', blood: '#b0181f', bloodD: '#741018', bloodHi: '#dc3c46', bone: '#f6f0ea',
           stone: '#6a5a46', marble: '#ffffff', marbleD: '#ddd6c8', gold: '#e0a02a', veil: '#16121c', veilHi: '#322a3a', ash: '#a59e92', ashD: '#7a7366',
           earth: '#8a6a44', scar: '#141218', steel: '#c3c8d0', steelD: '#7a818c', steelHi: '#ffffff', leather: '#6a4a30', leatherD: '#4a3020', cloth: '#b5332a',
           wood: '#7a5634', core: '#ffb84a', glyph: '#f6d27a', cloud: '#f7e4ee', pink: '#e65aa8', pinkD: '#b83e86', pinkHi: '#ffb6dc', spark: '#ffffff' }
};
