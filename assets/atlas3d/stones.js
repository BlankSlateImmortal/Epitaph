/* Epitaph — settlement graves. A settlement stands on the map as an engraved standing stone (its epitaph) on a low plinth.
 * The swords of the characters there stand upright in the ground in front of it, like a graveyard.
 * They take the map's own palette (pal: { land, landHi, rock, ink, glow }) and matte shading, so they sit in the terrain:
 *   storyborn  pale stone, its face carved with faint gold script (the Narrative)
 *   voided     dark stone, its face smooth and blank, erased
 *   fallen     cracked through, the top half knocked askew
 * buildStone(kind, color, pal) → { group, hit, parts }: base on y = 0 (set a little into the ground), face toward +z.
 * slotLocal(k): where the k-th sword stands (its tip, buried a little), in the stone's own frame. */
import * as THREE from 'three';

export const SLOTS = [[-.07, .2], [.07, .2], [-.21, .17], [.21, .17], [-.32, .12], [.32, .12]];   // [x, z] on the plinth
export function slotLocal(k) {
  const s = SLOTS[k % SLOTS.length], ring = Math.floor(k / SLOTS.length);
  return new THREE.Vector3(s[0] * (1 + .35 * ring), -.06, s[1] + ring * .12);
}
const DEFAULT_PAL = { land: '#5e4423', landHi: '#d9b06a', rock: '#3a2b1a', ink: '#040302', glow: '#ffb238' };
const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
const matte = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .9, metalness: 0, ...extra });

let RUNES = null;
function runeTexture() {                  // the Storyborn script: invented runes, white on black (an emissive map)
  if (RUNES) return RUNES;
  const c = document.createElement('canvas'); c.width = 128; c.height = 192; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 128, 192); x.strokeStyle = '#fff'; x.lineWidth = 3; x.lineCap = 'round';
  let seed = 11; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let row = 0; row < 8; row++) for (let col = 0; col < 5; col++) {
    if (r() < .15) continue;
    const cx = 16 + col * 24, cy = 18 + row * 22; x.beginPath(); x.moveTo(cx + (r() - .5) * 12, cy + (r() - .5) * 12);
    for (let k = 0; k < 3; k++) x.lineTo(cx + (r() - .5) * 14, cy + (r() - .5) * 14);
    x.stroke();
  }
  RUNES = new THREE.CanvasTexture(c); return RUNES;
}

export function buildStone(kind, color = '#6fb3a3', pal = DEFAULT_PAL) {
  pal = { ...DEFAULT_PAL, ...pal };
  const group = new THREE.Group(), parts = [];
  const add = (geo, mat, pos, rot) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (rot) m.rotation.set(...rot); m.castShadow = m.receiveShadow = true; group.add(m); parts.push(m); return m; };
  // stone in the terrain's own colours: Storyborn pale like the high ground, Voided dark like the rock, Fallen weathered between
  const stone = matte(kind === 'voided' ? mix(pal.rock, pal.ink, .45) : kind === 'fallen' ? mix(pal.rock, pal.land, .5) : mix(pal.land, pal.landHi, .78));
  // the stone: a slab with a rounded top
  const W = .38, H = .46, D = .07, y0 = -.03;                 // set a little into the ground
  const slab = (h, top = true) => {
    const sh = new THREE.Shape(); sh.moveTo(-W / 2, 0); sh.lineTo(W / 2, 0); sh.lineTo(W / 2, h - (top ? W / 2 : 0));
    if (top) sh.absarc(0, h - W / 2, W / 2, 0, Math.PI, false); else sh.lineTo(-W / 2, h);
    sh.lineTo(-W / 2, 0);
    return new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 2 }).translate(0, 0, -D / 2);
  };
  const faceZ = -.1 + D / 2 + .011;
  if (kind === 'fallen') {                // cracked through: the lower part stands, the top half lies knocked askew against it
    add(slab(H * .55, false), stone, [0, y0, -.1]);
    add(slab(H * .5), stone, [.05, y0 + H * .5, -.14], [-.35, 0, .4]);
    add(new THREE.BoxGeometry(.02, .03, .02), stone, [-.12, 0, .1]);  // a chip on the ground
  } else {
    add(slab(H), stone, [0, y0, -.1]);
    if (kind === 'voided')                // the erased face: a blank recess, a shade darker than the stone
      add(new THREE.PlaneGeometry(W * .74, H * .64), matte(mix(pal.rock, pal.ink, .7)), [0, y0 + H * .42, faceZ]);
    else                                  // the Narrative, faintly lit gold in the stone
      add(new THREE.PlaneGeometry(W * .72, H * .62), matte(mix(pal.land, pal.landHi, .62), { emissive: mix(pal.glow, color, .25), emissiveMap: runeTexture(), emissiveIntensity: .55 }),
        [0, y0 + H * .44, faceZ]);
  }
  const hit = new THREE.Mesh(new THREE.BoxGeometry(.8, .65, .6).translate(0, .32, 0), new THREE.MeshBasicMaterial({ visible: false }));
  group.add(hit);
  return { group, hit, parts };
}
