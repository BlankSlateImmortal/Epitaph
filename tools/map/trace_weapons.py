"""Trace weapon outlines from reference images (vault: World Buildinig/Items) for tools/map/traced_weapons.py.
Each weapon: separate it from the background, trace its outline and holes, turn it upright (tip at the origin, blade up),
scale it so the tip-to-guard length is 0.63 (the pins' layout), and keep the map back to the image for texturing.
Run with numpy + scipy + Pillow:  python trace_weapons.py OUT.json"""
import json, math, sys
import numpy as np
import os
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

D = '/home/antholonious/Downloads/Epitaph/World Buildinig/Items/'
G = 0.63

def moore(mask):
    """the boundary of the one blob in mask, as an ordered list of (x, y) pixel centres"""
    ys, xs = np.nonzero(mask); i = np.lexsort((xs, ys))[0]; start = (int(xs[i]), int(ys[i]))
    nb = [(-1, 0), (-1, -1), (0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1)]
    H, W = mask.shape
    inside = lambda p: 0 <= p[0] < W and 0 <= p[1] < H and mask[p[1], p[0]]
    pts, cur, back = [start], start, 0
    for _ in range(200000):
        for k in range(8):
            d = (back + k) % 8; q = (cur[0] + nb[d][0], cur[1] + nb[d][1])
            if inside(q):
                back = (d + 5) % 8; cur = q; break
        else: break
        if cur == start: break
        pts.append(cur)
    return pts

def rdp(pts, eps):
    """Ramer-Douglas-Peucker, iterative"""
    P = np.array(pts, float); keep = np.zeros(len(P), bool); keep[0] = keep[-1] = True; stack = [(0, len(P) - 1)]
    while stack:
        i0, i1 = stack.pop()
        if i1 <= i0 + 1: continue
        a, b = P[i0], P[i1]; ab = b - a; L = np.hypot(*ab); seg = P[i0 + 1:i1] - a
        d = np.abs(ab[0] * seg[:, 1] - ab[1] * seg[:, 0]) / L if L > 0 else np.hypot(seg[:, 0], seg[:, 1])
        k = int(np.argmax(d))
        if d[k] > eps: m = i0 + 1 + k; keep[m] = True; stack += [(i0, m), (m, i1)]
    return [tuple(p) for p in P[keep].astype(int).tolist()]

def ring(blob, eps=1.0):
    p = moore(blob); n = len(p)
    if n < 8: return None
    h = n // 2; r = rdp(p[:h + 1], eps)[:-1] + rdp(p[h:] + [p[0]], eps)[:-1]   # closed: simplify in two halves
    return r if len(r) >= 3 else None

def rings_of(comp, min_hole=25):
    out = [ring(comp)]
    holes, n = ndi.label(~comp)
    border = set(np.unique(np.concatenate([holes[0], holes[-1], holes[:, 0], holes[:, -1]])))
    for i in range(1, n + 1):
        if i in border: continue
        h = holes == i
        if h.sum() >= min_hole: out.append(ring(h, .8))
    return [r for r in out if r]

def place(rings, tip, guard):
    """image px → model: tip at the origin, the guard straight up at y = G (model y points up, image y down)"""
    tip, guard = np.array(tip, float), np.array(guard, float)
    ux, uy = guard[0] - tip[0], -(guard[1] - tip[1]); L = math.hypot(ux, uy); s = G / L
    rot = math.pi / 2 - math.atan2(uy, ux); c, si = math.cos(rot), math.sin(rot)
    def to_model(p):
        x, y = (p[0] - tip[0]) * s, -(p[1] - tip[1]) * s
        return [x * c - y * si, x * si + y * c]
    inv = {'tip': tip.tolist(), 's': s, 'rot': rot}          # model (x, y) → image: rotate by -rot, divide by s, flip y, add tip
    return [[to_model(p) for p in r] for r in rings], inv

def thick_line(img, a, b, w):
    d = ImageDraw.Draw(img); d.line([tuple(a), tuple(b)], fill=255, width=int(w * 2)); d.ellipse([a[0] - w, a[1] - w, a[0] + w, a[1] + w], fill=255); d.ellipse([b[0] - w, b[1] - w, b[0] + w, b[1] + w], fill=255)

def load(f): return np.asarray(Image.open(D + f).convert('RGB')).astype(int)

OUTDIR = None
def repaint(a, mask, key, colors=7):
    """a cleaned, repainted texture: the weapon's colour areas flattened to a few tones (not the reference itself),
    spread outward past the outline so bevelled edges pick up the nearest colour"""
    mask = ndi.binary_erosion(mask, iterations=2)                  # drop the anti-aliased rim
    _, (iy, ix) = ndi.distance_transform_edt(~mask, return_indices=True)
    a = a[iy, ix]                                                   # the background becomes the nearest weapon colour first
    img = Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.MedianFilter(3))
    q = np.asarray(img.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB'))
    out = np.asarray(Image.fromarray(q).filter(ImageFilter.ModeFilter(5)))
    name = 'tex_' + key + '.png'; Image.fromarray(out.astype(np.uint8)).save(OUTDIR + '/' + name); return name

def white_bg(a):
    m = ~((a > 232).all(2)); m = ndi.binary_opening(m, iterations=1); return ndi.binary_closing(m, iterations=2)

OUTDIR = os.path.dirname(os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'traced.json'))
out = []
# ---- Lithia's scissor blade (one piece on white)
a = load('scissor blade lithia.jpg'); m = white_bg(a)
lab, n = ndi.label(m); big = 1 + int(np.argmax(ndi.sum(m, lab, range(1, n + 1))))
rg, inv = place(rings_of(lab == big), tip=(690, 1026), guard=(240, 382))
out.append({'name': 'scissor', 'tex': repaint(a, lab == big, 'scissor'), 'size': [a.shape[1], a.shape[0]], 'rings': rg, 'inv': inv})

# ---- Sils's Terminus Harvester (two pieces on white): the guard is the widest cross-section; the tip the far end of the blade
a = load('Sils blade Terminus harvester.jpg'); m = white_bg(a)
lab, n = ndi.label(m); sizes = ndi.sum(m, lab, range(1, n + 1)); order = np.argsort(-sizes)[:2] + 1
hv_tex = repaint(a, np.isin(lab, order), 'harvester', 6)
for idx, name in zip(sorted(order, key=lambda i: np.nonzero(lab == i)[1].mean()), ['harvester_long', 'harvester_broad']):
    comp = lab == idx; ys, xs = np.nonzero(comp); P = np.stack([xs, ys], 1).astype(float); c0 = P.mean(0)
    w, V = np.linalg.eigh(np.cov((P - c0).T)); ax = V[:, np.argmax(w)]; t = (P - c0) @ ax; nrm = np.array([-ax[1], ax[0]]); q = (P - c0) @ nrm
    bins = np.linspace(t.min(), t.max(), 120); wid = [np.ptp(q[(t >= bins[k]) & (t < bins[k + 1])]) if ((t >= bins[k]) & (t < bins[k + 1])).any() else 0 for k in range(119)]
    k = int(np.argmax(wid)); sel = (t >= bins[k]) & (t < bins[k + 1]); guard = P[sel].mean(0)
    tg = (guard - c0) @ ax; far = t.argmin() if tg > 0 else t.argmax(); tip = P[far]    # the tip: the end away from the guard
    if name == 'harvester_long': tip = P[np.argmin(P[:, 1])]                           # its blade runs up to the top of the image
    rg, inv = place(rings_of(comp), tip=tip, guard=guard)
    if name == 'harvester_broad': continue                     # removed: Sils carries only the long blade
    out.append({'name': name, 'tex': hv_tex, 'size': [a.shape[1], a.shape[0]], 'rings': rg, 'inv': inv})

# ---- Vale's Twin Serpents (a photo): silver by brightness, plus the black wrapped grips drawn in by hand
a = load('vale - twin serpents.jpg'); L = a.mean(2)
m = L > 88
hand = Image.new('L', (a.shape[1], a.shape[0]), 0)
thick_line(hand, (538, 118), (646, 52), 9); thick_line(hand, (602, 172), (701, 107), 8)   # grips, guard collar → pommel
m = m | (np.asarray(hand) > 0)
m = ndi.binary_opening(m, iterations=1); m = ndi.binary_closing(m, iterations=3)
lab, n = ndi.label(m); sizes = ndi.sum(m, lab, range(1, n + 1)); order = np.argsort(-sizes)[:2] + 1
vs_tex = repaint(a, np.isin(lab, order), 'serpents', 7)
for idx, name, tip, guard in [(None, 'serpent_a', (11, 452), (528, 118)), (None, 'serpent_b', (60, 490), (592, 180))]:
    # pick the blob containing the guard point
    comp = lab == lab[guard[1], guard[0]]
    rg, inv = place(rings_of(comp), tip=tip, guard=guard)
    out.append({'name': name, 'tex': vs_tex, 'size': [a.shape[1], a.shape[0]], 'rings': rg, 'inv': inv})

# ---- Lithia wounded: the scissor blade snapped, like the Fallen sword: a jagged break, chips out of both edges, and the
# lost tip as its own piece with the matching break
def clip(ring, B, keep_upper):
    """Sutherland-Hodgman against the line y = B"""
    inside = (lambda p: p[1] >= B) if keep_upper else (lambda p: p[1] <= B)
    out = []
    for i, cur in enumerate(ring):
        prev = ring[i - 1]
        if inside(cur):
            if not inside(prev): t = (B - prev[1]) / (cur[1] - prev[1]); out.append([prev[0] + t * (cur[0] - prev[0]), B])
            out.append(list(cur))
        elif inside(prev): t = (B - prev[1]) / (cur[1] - prev[1]); out.append([prev[0] + t * (cur[0] - prev[0]), B])
    return out
def jag(x, B): return B + .016 * (abs(((x * 55 + .3) % 1) - .5) * 2 - .5) + .006 * math.sin(x * 160)
def jagged(ring, B):
    """replace the straight cut along y = B with a zigzag"""
    out = []
    for i, p in enumerate(ring):
        q = ring[(i + 1) % len(ring)]
        out.append([p[0], jag(p[0], B) if abs(p[1] - B) < 1e-9 else p[1]])
        if abs(p[1] - B) < 1e-9 and abs(q[1] - B) < 1e-9:
            n = max(2, int(abs(q[0] - p[0]) / .006))
            for k in range(1, n): x = p[0] + (q[0] - p[0]) * k / n; out.append([x, jag(x, B)])
    return out
def chip(ring, y, side, depth=.013, h=.013):
    """a V-shaped chip out of the edge at height y: side +1 the right edge, -1 the left"""
    best = None
    for i, p in enumerate(ring):
        q = ring[(i + 1) % len(ring)]
        if (p[1] - y) * (q[1] - y) <= 0 and p[1] != q[1]:
            x = p[0] + (y - p[1]) / (q[1] - p[1]) * (q[0] - p[0])
            if best is None or (x - best[1]) * side > 0: best = (i, x)
    if best is None: return ring
    i, x = best; p, q = ring[i], ring[(i + 1) % len(ring)]; d = 1 if q[1] > p[1] else -1
    pts = [[x, y - d * h], [x - side * depth, y], [x, y + d * h]]
    return ring[:i + 1] + pts + ring[i + 1:]
sc = out[0]; B = .3
up = [jagged(clip(r, B, True), B) for r in sc['rings']]; up = [r for r in up if len(r) >= 3]
up[0] = chip(chip(chip(up[0], .41, 1), .5, -1), .36, -1, .009, .009)
lo = [jagged(clip(r, B, False), B) for r in sc['rings']]; lo = [r for r in lo if len(r) >= 3 and max(p[1] for p in r) > .02]
out.append({**sc, 'name': 'scissor_broken', 'rings': up, 'break': B})
out.append({**sc, 'name': 'scissor_tip', 'rings': lo[:1] + [r for r in lo[1:] if max(p[1] for p in r) < B - .01], 'break': B})

json.dump(out, open(sys.argv[1] if len(sys.argv) > 1 else 'traced.json', 'w'))
for o in out:
    xs = [p[0] for r in o['rings'] for p in r]; ys = [p[1] for r in o['rings'] for p in r]
    print(o['name'], 'rings', len(o['rings']), 'points', sum(len(r) for r in o['rings']), 'x %.3f..%.3f y %.3f..%.3f' % (min(xs), max(xs), min(ys), max(ys)))
