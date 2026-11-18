/* Epitaph — settlement stones. A settlement stands on the map as an engraved standing stone (its epitaph) on a low plinth,
 * with sword slots cut into the plinth in front of it: the swords of the characters there stand in the slots, like a graveyard.
 *   storyborn  white marble, its face carved with glowing gold script (the Narrative)
 *   voided     black stone, its face smooth and blank, erased; a pale edge
 *   fallen     cracked through, the top half knocked askew
 * buildStone(kind, color) → { group, hit, parts }: base on y = 0, the slab's face toward +z, about 0.62 wide, 0.66 tall.
 * slotLocal(k): where the k-th sword stands (its tip), in the stone's own frame. */
import * as THREE from 'three';

export const SLOTS = [[-.07, .2], [.07, .2], [-.21, .17], [.21, .17], [-.32, .12], [.32, .12]];   // [x, z] on the plinth
export const PLINTH_H = .09;
export function slotLocal(k) {
  const s = SLOTS[k % SLOTS.length], ring = Math.floor(k / SLOTS.length);
  return new THREE.Vector3(s[0] * (1 + .35 * ring), PLINTH_H - .03, s[1] + ring * .12);    // tips sit a little into the slot
}

let RUNES = null;
function runeTexture() {                  // gold script for the Storyborn face: invented runes, white on black (emissive map)
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

export function buildStone(kind, color = '#6fb3a3') {
  const group = new THREE.Group(), parts = [];
  const add = (geo, mat, pos, rot) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (rot) m.rotation.set(...rot); m.castShadow = m.receiveShadow = true; group.add(m); parts.push(m); return m; };
  const stone = kind === 'voided' ? new THREE.MeshStandardMaterial({ color: '#141218', roughness: .25, metalness: .2 })
    : kind === 'fallen' ? new THREE.MeshStandardMaterial({ color: '#6b6158', roughness: .95 })
    : new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: .55 });
  const plinthMat = new THREE.MeshStandardMaterial({ color: kind === 'voided' ? '#1e1b22' : kind === 'fallen' ? '#4f4842' : '#cfc6b6', roughness: .9 });
  // the plinth, with its sword slots
  add(new THREE.BoxGeometry(.72, PLINTH_H, .5), plinthMat, [0, PLINTH_H / 2, .02]);
  const slotMat = new THREE.MeshBasicMaterial({ color: '#050406' });
  SLOTS.forEach(([x, z]) => add(new THREE.BoxGeometry(.05, .004, .018), slotMat, [x, PLINTH_H + .002, z]));
  // a band of the faction's colour round the plinth
  add(new THREE.BoxGeometry(.735, .014, .515), new THREE.MeshBasicMaterial({ color }), [0, PLINTH_H - .02, .02]);
  // the stone: a slab with a rounded top
  const W = .4, H = .5, D = .075, y0 = PLINTH_H;
  const slab = (h, top = true) => {
    const sh = new THREE.Shape(); sh.moveTo(-W / 2, 0); sh.lineTo(W / 2, 0); sh.lineTo(W / 2, h - (top ? W / 2 : 0));
    if (top) sh.absarc(0, h - W / 2, W / 2, 0, Math.PI, false); else sh.lineTo(-W / 2, h);
    sh.lineTo(-W / 2, 0);
    return new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 2 }).translate(0, 0, -D / 2);
  };
  if (kind === 'fallen') {                // cracked through: the lower part stands, the top half lies knocked askew against it
    add(slab(H * .55, false), stone, [0, y0, -.1]);
    const top = add(slab(H * .5), stone, [.05, y0 + H * .5, -.14], [-.35, 0, .4]);
    add(new THREE.BoxGeometry(.02, .03, .02), stone, [-.12, y0 + .005, .14]);  // a chip on the plinth
    void top;
  } else {
    const s = add(slab(H), stone, [0, y0, -.1]);
    void s;
    if (kind === 'voided') {              // the erased face: a blank, glossy panel edged in pale light
      add(new THREE.PlaneGeometry(W * .78, H * .7), new THREE.MeshStandardMaterial({ color: '#000', roughness: .05, metalness: .5 }), [0, y0 + H * .42, -.1 + D / 2 + .011]);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(W * .8, H * .72)), new THREE.LineBasicMaterial({ color: '#e6dccb', transparent: true, opacity: .7 }));
      edge.position.set(0, y0 + H * .42, -.1 + D / 2 + .012); group.add(edge);
    } else {                              // the Narrative carved in gold
      add(new THREE.PlaneGeometry(W * .74, H * .66), new THREE.MeshStandardMaterial({ color: '#d9cdb4', roughness: .6, emissive: '#ffc85a', emissiveMap: runeTexture(), emissiveIntensity: 1.1 }),
        [0, y0 + H * .44, -.1 + D / 2 + .011]);
    }
  }
  const hit = new THREE.Mesh(new THREE.BoxGeometry(.8, .7, .6).translate(0, .35, 0), new THREE.MeshBasicMaterial({ visible: false }));
  group.add(hit);
  return { group, hit, parts };
}
