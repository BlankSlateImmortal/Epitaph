/* Epitaph settlement statues, built from blocks (kept from the map-markers work, designs/markers on the markers-page branch).
 * FIGS[name](V) builds one statue in a Vox, facing +z, base at y = 0. Colour each block with FIG_COLORS[theme][material];
 * 'group' / 'groupGlow' take the marker's own colour (Storyborn teal, Voided violet, Fallen red).
 *   storyborn  an angel at prayer, hands together, wings spread, a gold halo behind the head
 *   voided     an angel under a black veil to the ground, wings broken, feathers fallen, a pale hand holding the veil closed
 *   fallen     no god: a plain sword, broken, hanging hilt-up over the base; the snapped tip lies below, edges chipped
 * The character figures that were in the same file were dropped: characters are the sword pins now (assets/atlas3d/pins).
 * Plain JavaScript, no libraries. */
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

// colours for every material the statues use (Signal = crt, Paper = paper)
const FIG_COLORS = {
  crt:   { stone: '#4a3a28', marble: '#f1e6cf', marbleD: '#cbbd9e', gold: '#ffc04a', veil: '#120e16', veilHi: '#2a2230', ash: '#9a9284', ashD: '#6e6758', steel: '#b9bec6', steelD: '#6f7680', steelHi: '#eef2f6', leatherD: '#3a2414' },
  paper: { stone: '#6a5a46', marble: '#ffffff', marbleD: '#ddd6c8', gold: '#e0a02a', veil: '#16121c', veilHi: '#322a3a', ash: '#a59e92', ashD: '#7a7366', steel: '#c3c8d0', steelD: '#7a818c', steelHi: '#ffffff', leatherD: '#4a3020' }
};
