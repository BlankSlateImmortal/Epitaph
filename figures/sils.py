"""Sils — Shelter-DS-style low-poly figure, rigged and animated, with a two-handed jian on his left hip.
Run headless:  blender -b -P sils.py -- <outdir>
Writes sils.blend and sils.glb (actions: Idle, Click, Examine). Character faces -Y, Z up.
Hair, sleeves and the robe hem are split into bone chains (hair_*, lock_*, sleeve_*, skirt_*) that the
web page drives with spring physics, so they flow on their own on top of the keyed animation."""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix, Euler, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.dirname(os.path.abspath(__file__))
TEX = OUT
rad = math.radians
clamp = lambda v, a, b: max(a, min(b, v))
lerp = lambda a, b, k: a + (b - a) * k
smooth = lambda k: k * k * (3 - 2 * k)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
coll = scene.collection

# ------------------------------------------------------------------ materials
def material(name, color, image=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    lin = lambda c: (c / 255 / 12.92) if c / 255 <= .04045 else ((c / 255 + .055) / 1.055) ** 2.4
    bsdf.inputs['Base Color'].default_value = (*[lin(c) for c in color], 1)
    bsdf.inputs['Roughness'].default_value = 1.0
    if image:
        img = bpy.data.images.load(os.path.join(TEX, image))
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img; tx.interpolation = 'Closest'
        nt.links.new(tx.outputs['Color'], bsdf.inputs['Base Color'])
    return m

MATS = {
    'skin': material('skin', (236, 230, 224)),
    'face': material('face', (255, 255, 255), 'sils_face.png'),
    'hair': material('hair', (255, 255, 255), 'sils_hair.png'),
    'robe': material('robe', (22, 22, 26)),
    'robe_in': material('robe_in', (12, 12, 15)),
    'collar': material('collar', (255, 255, 255), 'sils_collar.png'),
    'sash': material('sash', (30, 28, 34)),
    'cord': material('cord', (110, 18, 24)),
    'pants': material('pants', (18, 18, 22)),
    'boot': material('boot', (16, 16, 20)),
    'sole': material('sole', (226, 220, 210)),
    'blade': material('blade', (255, 255, 255), 'sils_blade.png'),
    'steel': material('steel', (58, 58, 66)),
    'grip_w': material('grip_w', (206, 198, 184)),
    'grip_d': material('grip_d', (34, 32, 36)),
    'tassel': material('tassel', (110, 18, 24)),
    'scab': material('scab', (16, 16, 20)),
    'fit': material('fit', (140, 136, 132)),
}

# ------------------------------------------------------------------ layout constants
HC = Vector((0, 0, 1.36))            # head centre
HS = (.168, .175, .19)               # scalp radii
CH_TOP = 1.28                         # where hair chains leave the head
CHAINS = {  # name: azimuth (0 = front, + = his left), end z, radius scale top -> bottom, forward pull
    'hair_sl': (1.42, .6, 1.2, 1.32, 0), 'hair_bl': (2.2, .57, 1.15, 1.28, 0), 'hair_bc': (math.pi, .55, 1.12, 1.24, 0),
    'hair_br': (-2.2, .57, 1.15, 1.28, 0), 'hair_sr': (-1.42, .6, 1.2, 1.32, 0),
    'lock_l': (1.08, .82, 1.1, 1.1, .04), 'lock_r': (-1.08, .82, 1.1, 1.1, .04),
}
CH_NAMES = list(CHAINS)
def chain_pt(c, k):
    a, zend, o0, o1, fw = CHAINS[c]
    z = lerp(CH_TOP, zend, k); o = lerp(o0, o1, min(1, k * 1.5))
    return Vector((math.sin(a) * HS[0] * o, -math.cos(a) * HS[1] * o - fw * k, z))
# sword on the left hip: hilt forward and up, tip down and back
SW_D = Vector((.1, .7, -.7)).normalized()
SW_M0 = Vector((.17, -.08, .82))
SW_Z = SW_D.cross(Vector((0, 0, 1))).normalized()
SW_X = SW_D.cross(SW_Z)
BL, GRIP = .56, .18

BONES = [  # name, head, tail, parent
    ('root', (0, 0, 0), (0, 0, .15), None),
    ('hips', (0, 0, .72), (0, 0, .86), 'root'),
    ('skirt_1', (0, 0, .72), (0, 0, .36), 'hips'),
    ('skirt_end', (0, 0, .36), (0, 0, .3), 'skirt_1'),
    ('spine', (0, 0, .86), (0, 0, 1.0), 'hips'),
    ('chest', (0, 0, 1.0), (0, 0, 1.13), 'spine'),
    ('neck', (0, 0, 1.13), (0, 0, 1.22), 'chest'),
    ('head', (0, 0, 1.22), (0, 0, 1.56), 'neck'),
    ('sword', tuple(SW_M0), tuple(SW_M0 + SW_D * BL), 'hips'),
]
for c in CH_NAMES:
    pts = [chain_pt(c, i / 3) for i in range(4)]
    for i in range(3):
        BONES.append((f'{c}_{i + 1}', tuple(pts[i]), tuple(pts[i + 1]), 'head' if i == 0 else f'{c}_{i}'))
    BONES.append((f'{c}_end', tuple(pts[3]), tuple(pts[3] + Vector((0, 0, -.05))), f'{c}_3'))
for s, sx in (('L', 1), ('R', -1)):
    lo = s.lower()
    BONES += [
        (f'shoulder.{s}', (sx * .03, 0, 1.1), (sx * .16, 0, 1.09), 'chest'),
        (f'upper_arm.{s}', (sx * .17, 0, 1.08), (sx * .215, 0, .85), f'shoulder.{s}'),
        (f'forearm.{s}', (sx * .215, 0, .85), (sx * .25, -.01, .64), f'upper_arm.{s}'),
        (f'hand.{s}', (sx * .25, -.01, .64), (sx * .257, -.015, .55), f'forearm.{s}'),
        (f'sleeve_{lo}_1', (sx * .25, -.01, .64), (sx * .265, -.01, .5), f'forearm.{s}'),
        (f'sleeve_{lo}_end', (sx * .265, -.01, .5), (sx * .27, -.01, .46), f'sleeve_{lo}_1'),
        (f'thigh.{s}', (sx * .08, 0, .72), (sx * .085, 0, .4), 'hips'),
        (f'shin.{s}', (sx * .085, 0, .4), (sx * .09, 0, .1), f'thigh.{s}'),
        (f'foot.{s}', (sx * .09, 0, .1), (sx * .09, -.08, .03), f'shin.{s}'),
    ]
ALL = [b[0] for b in BONES]

# ------------------------------------------------------------------ mesh helpers
PARTS = []
def finish(bm, name, weights, mats, smooth_=True, layer=None):
    lay = bm.verts.layers.int.get('chain') if layer else None
    tags = [v[lay] for v in bm.verts] if lay else None
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = smooth_
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob)
    for mname in mats: me.materials.append(MATS[mname])
    groups = {}
    for v in me.vertices:
        ws = weights(v.co, tags[v.index]) if tags is not None else weights(v.co)
        for b, w in ws.items():
            if w <= 1e-3: continue
            g = groups.get(b) or ob.vertex_groups.new(name=b); groups[b] = g
            g.add([v.index], w, 'REPLACE')
    PARTS.append(ob); return ob

def rigid(b): return lambda co, *a: {b: 1.0}
def ramp(z, z0, z1): return clamp((z - z0) / (z1 - z0), 0, 1)

def lathe(bm, profile, segs, mat=0, cap_top=False, cap_bot=False, M=None):
    rings = []
    for pr in profile:
        z, rx, ry = pr[:3]; cx = pr[3] if len(pr) > 3 else 0; cy = pr[4] if len(pr) > 4 else 0
        ring = []
        for j in range(segs):
            a = j / segs * 2 * math.pi
            co = Vector((cx + math.sin(a) * rx, cy - math.cos(a) * ry, z))
            if M: co = M @ co
            ring.append(bm.verts.new(co))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for j in range(segs):
            bm.faces.new((rings[i][j], rings[i][(j + 1) % segs], rings[i + 1][(j + 1) % segs], rings[i + 1][j])).material_index = mat
    if cap_bot: bm.faces.new(list(reversed(rings[0]))).material_index = mat
    if cap_top: bm.faces.new(rings[-1]).material_index = mat
    return rings

def ellipsoid(bm, c, r, u=10, v=7, mat=0, M=None):
    res = bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=1)
    for vt in res['verts']:
        co = Vector((c[0] + vt.co.x * r[0], c[1] + vt.co.y * r[1], c[2] + vt.co.z * r[2]))
        vt.co = M @ co if M else co
    for f in {f for vt in res['verts'] for f in vt.link_faces}: f.material_index = mat
    return res['verts']

def clump(bm, pts, widths, thick, outs, mat=0, uvl=None, tag=None, lay=None):
    n = len(pts); rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        o = outs[i] - t * outs[i].dot(t); o.normalize()
        sd = t.cross(o).normalized()
        w, th = widths[i], thick[i]
        ring = [bm.verts.new(p + sd * w), bm.verts.new(p + o * th), bm.verts.new(p - sd * w), bm.verts.new(p - o * th * .55)]
        if lay is not None:
            for v in ring: v[lay] = tag
        rings.append(ring)
    us = [0, .5, 1, .5]
    for i in range(n - 1):
        for j in range(4):
            f = bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][(j + 1) % 4], rings[i][(j + 1) % 4])); f.material_index = mat
            if uvl is not None:
                for lp, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, (j + 1) % 4), (i, (j + 1) % 4))):
                    lp[uvl].uv = (us[jj], 1 - ii / (n - 1))
    bm.faces.new(list(reversed(rings[0]))).material_index = mat
    bm.faces.new(rings[-1]).material_index = mat

# ------------------------------------------------------------------ head
HR = (.155, .16, .178)
def head_shape(co):
    x, y, z = co
    if z < -.04:
        k = clamp((-.04 - z) / .14, 0, 1)
        x *= 1 - .48 * k; y *= 1 - .22 * k
        if y < 0: y -= .012 * k
    return Vector((x, y, z))
bm = bmesh.new(); uvl = bm.loops.layers.uv.verify()
res = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=12, radius=1)
for v in res['verts']: v.co = head_shape(Vector((v.co.x * HR[0], v.co.y * HR[1], v.co.z * HR[2]))) + HC
bm.normal_update()
S = .17
for f in bm.faces:
    f.material_index = 1 if f.normal.y < -.12 else 0
    for lp in f.loops:
        p = lp.vert.co - HC; lp[uvl].uv = (.5 + p.x / (2 * S), .5 + p.z / (2 * S))
for sx in (1, -1): ellipsoid(bm, (sx * .148, .005, 1.345), (.018, .03, .04), 6, 5, 0)
lathe(bm, [(1.11, .046, .044), (1.2, .044, .042), (1.27, .05, .05)], 8, 0)
finish(bm, 'head', lambda co: {'head': ramp(co.z, 1.17, 1.24), 'neck': 1 - ramp(co.z, 1.17, 1.24)}, ['skin', 'face'])

# ------------------------------------------------------------------ robe
ROBE = [(1.18, .062, .058), (1.15, .13, .08), (1.11, .175, .095), (1.04, .178, .1), (.96, .165, .1), (.86, .148, .094),
        (.76, .158, .103), (.6, .176, .114), (.44, .185, .122), (.28, .196, .13), (.13, .208, .136), (.1, .21, .138)]
def robe_r(z):
    for a, b in zip(ROBE, ROBE[1:]):
        if b[0] <= z <= a[0]:
            k = (z - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], k), lerp(a[2], b[2], k)
    return ROBE[-1][1], ROBE[-1][2]
def body_w(co, *a):
    z = co.z
    sk = clamp((.72 - z) / .55, 0, 1) * .9
    if z < .72: w = {'skirt_1': sk, 'hips': 1 - sk}
    elif z < .86: w = {'hips': 1 - ramp(z, .8, .9), 'spine': ramp(z, .8, .9)}
    elif z < 1.0: w = {'spine': 1 - ramp(z, .95, 1.03), 'chest': ramp(z, .95, 1.03)}
    else: w = {'chest': 1.0}
    if z > 1.0 and abs(co.x) > .12:
        s = 'L' if co.x > 0 else 'R'; k = ramp(abs(co.x), .12, .18) * .6
        w = {kk: vv * (1 - k) for kk, vv in w.items()}; w[f'shoulder.{s}'] = k
    if z > 1.15: w = {'chest': 1 - ramp(z, 1.15, 1.19), 'neck': ramp(z, 1.15, 1.19)}
    return w
bm = bmesh.new()
segs = 16; rings = []
for (z, rx, ry) in ROBE:
    ring = []
    for j in range(segs):
        a = j / segs * 2 * math.pi
        pl = 1 + (.045 * math.cos(a * 8) * ramp(.8 - z, 0, .5))
        ring.append(bm.verts.new(Vector((math.sin(a) * rx * pl, -math.cos(a) * ry * pl, z))))
    rings.append(ring)
for i in range(len(rings) - 1):
    for j in range(segs):
        bm.faces.new((rings[i][j], rings[i][(j + 1) % segs], rings[i + 1][(j + 1) % segs], rings[i + 1][j])).material_index = 0
inner = []
for (z, rx, ry) in ROBE[6:]:
    inner.append([bm.verts.new(Vector((math.sin(j / segs * 2 * math.pi) * rx * .93, -math.cos(j / segs * 2 * math.pi) * ry * .93, z))) for j in range(segs)])
for i in range(len(inner) - 1):
    for j in range(segs):
        bm.faces.new((inner[i][j], inner[i + 1][j], inner[i + 1][(j + 1) % segs], inner[i][(j + 1) % segs])).material_index = 1
for j in range(segs):
    bm.faces.new((rings[-1][j], rings[-1][(j + 1) % segs], inner[-1][(j + 1) % segs], inner[-1][j])).material_index = 1
lathe(bm, [(.81, .158, .1), (.89, .156, .098)], segs, 2, M=Matrix.Scale(1.04, 4))
lathe(bm, [(.836, .166, .108), (.846, .166, .108)], segs, 3, M=Matrix.Scale(1.05, 4))
finish(bm, 'robe', body_w, ['robe', 'robe_in', 'sash', 'cord'])

def on_robe(z, a, off=.008):
    rx, ry = robe_r(z); return Vector((math.sin(a) * (rx + off), -math.cos(a) * (ry + off), z))
bm = bmesh.new(); uvl = bm.loops.layers.uv.verify()
for (a0, a1, o, w) in ((-.62, .42, .004, .02), (.62, -.42, .008, .023)):
    pts, outs = [], []; n = 9
    for i in range(n):
        k = i / (n - 1); z = lerp(1.17, .875, k); a = lerp(a0, a1, k ** 1.3)
        p = on_robe(z, a, o); pts.append(p); outs.append(Vector((p.x, p.y, 0)).normalized())
    clump(bm, pts, [w * (.75 + .25 * i / (n - 1)) for i in range(n)], [.003] * n, outs, 0, uvl)
finish(bm, 'collar', body_w, ['collar'])

# ------------------------------------------------------------------ arms, hands, legs, boots
def arm_matrix(a, b):
    a, b = Vector(a), Vector(b); d = (b - a)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return Matrix.Translation(a) @ q.to_matrix().to_4x4(), d.length
for s, sx in (('L', 1), ('R', -1)):
    lo = s.lower()
    bm = bmesh.new()
    M, L = arm_matrix((sx * .17, 0, 1.08), (sx * .215, 0, .85))
    lathe(bm, [(-.02, .062, .062), (L * .5, .066, .066), (L + .01, .07, .07)], 10, 0, M=M)
    finish(bm, f'sleeve_up.{s}', rigid(f'upper_arm.{s}'), ['robe'])
    bm = bmesh.new()
    M, L = arm_matrix((sx * .215, 0, .85), (sx * .25, -.01, .64))
    rr = lathe(bm, [(-.01, .07, .07), (L * .45, .082, .08), (L * .9, .1, .095), (L + .06, .112, .104)], 12, 0, M=M)
    inn = lathe(bm, [(L + .06, .105, .097), (L * .55, .078, .074)], 12, 1, M=M)
    for j in range(12):
        bm.faces.new((rr[-1][j], rr[-1][(j + 1) % 12], inn[0][(j + 1) % 12], inn[0][j])).material_index = 1
    def sleeve_w(co, *a, s=s, lo=lo):
        k = ramp(-co.z, -.72, -.55)
        return {f'forearm.{s}': 1 - k * .8, f'sleeve_{lo}_1': k * .8}
    finish(bm, f'sleeve_lo.{s}', sleeve_w, ['robe', 'robe_in'])
    bm = bmesh.new()
    hp = Vector((sx * .252, -.012, .6))
    ellipsoid(bm, hp, (.026, .036, .046), 8, 6, 0)
    ellipsoid(bm, hp + Vector((0, -.028, .012)), (.012, .014, .024), 6, 4, 0)
    finish(bm, f'hand.{s}', rigid(f'hand.{s}'), ['skin'])
    bm = bmesh.new()
    lathe(bm, [(.12, .045, .045, sx * .09, 0), (.4, .055, .055, sx * .086, 0), (.72, .07, .07, sx * .08, 0)], 8, 0)
    finish(bm, f'leg.{s}', lambda co, *a, s=s: {f'thigh.{s}': ramp(co.z, .36, .44), f'shin.{s}': 1 - ramp(co.z, .36, .44)}, ['pants'])
    bm = bmesh.new()
    ellipsoid(bm, (sx * .09, -.03, .075), (.05, .085, .055), 10, 6, 0)
    lathe(bm, [(0, .055, .095, sx * .09, -.03), (.03, .056, .096, sx * .09, -.03)], 12, 1, cap_top=True, cap_bot=True)
    finish(bm, f'boot.{s}', rigid(f'foot.{s}'), ['boot', 'sole'])

# ------------------------------------------------------------------ sword + scabbard (built along +Y, guard at origin)
MSW = Matrix((SW_X, SW_D, SW_Z)).transposed().to_4x4(); MSW.translation = SW_M0
ALONG_Y = Matrix.Rotation(rad(-90), 4, 'X')        # lathe +Z -> +Y
ALONG_NY = Matrix.Rotation(rad(90), 4, 'X')        # lathe +Z -> -Y
bm = bmesh.new(); uvl = bm.loops.layers.uv.verify()
n = 12; pts, ws, ts, outs = [], [], [], []
for i in range(n):
    k = i / (n - 1); y = lerp(.015, BL, k)
    w = .019 - .004 * k if k < .86 else lerp(.0156, .0012, (k - .86) / .14)
    pts.append(MSW @ Vector((0, y, 0))); ws.append(w); ts.append(.0045 * (1 - .5 * k)); outs.append(SW_Z.copy())
clump(bm, pts, ws, ts, outs, 0, uvl)
ellipsoid(bm, (0, 0, 0), (.046, .014, .02), 10, 6, 1, M=MSW)                          # guard
for sx in (1, -1): ellipsoid(bm, (sx * .042, .01, 0), (.016, .012, .014), 6, 4, 1, M=MSW)
for i in range(8):                                                                       # cord-wrapped grip
    lathe(bm, [(.008 + i * .021, .0135, .0135), (.008 + (i + 1) * .021, .013, .013)], 8, 2 + (i % 2), M=MSW @ ALONG_NY)
ellipsoid(bm, (0, -.185, 0), (.02, .016, .02), 8, 6, 1, M=MSW)                        # pommel
lathe(bm, [(.195, .006, .006), (.26, .016, .012)], 6, 4, cap_top=True, M=MSW @ ALONG_NY)  # tassel
finish(bm, 'sword', rigid('sword'), ['blade', 'steel', 'grip_w', 'grip_d', 'tassel'])
bm = bmesh.new()
lathe(bm, [(-.01, .03, .019), (.04, .03, .019)], 10, 1, M=MSW @ ALONG_Y)
lathe(bm, [(.04, .028, .017), (BL - .03, .024, .015)], 10, 0, M=MSW @ ALONG_Y)
lathe(bm, [(BL - .03, .025, .016), (BL + .03, .012, .01)], 10, 1, cap_top=True, M=MSW @ ALONG_Y)
finish(bm, 'scabbard', rigid('hips'), ['scab', 'fit'])

# ------------------------------------------------------------------ hair
def scalp(a, z, out=1.0):
    k = math.sqrt(max(0.0, 1 - (z / (HS[2] * out)) ** 2))
    return HC + Vector((math.sin(a) * HS[0] * out * k, -math.cos(a) * HS[1] * out * k, z))
def chain_weights(c, z):
    zend = CHAINS[c][1]
    s = clamp((CH_TOP - z) / (CH_TOP - zend) * 3, -.5, 2.5)
    names = ['head', f'{c}_1', f'{c}_2', f'{c}_3']; centres = [-.5, .5, 1.5, 2.5]
    w = {nm: max(0.0, 1 - abs(s - cc)) for nm, cc in zip(names, centres)}
    tot = sum(w.values()) or 1
    return {k: v / tot for k, v in w.items()}
def hair_w(co, tag):
    if tag < 0: return {'head': 1.0}
    return chain_weights(CH_NAMES[tag], co.z)
def nearest_chain(a, pool):
    return min(pool, key=lambda c: abs(math.atan2(math.sin(a - CHAINS[c][0]), math.cos(a - CHAINS[c][0]))))

bm = bmesh.new(); uvl = bm.loops.layers.uv.verify(); lay = bm.verts.layers.int.new('chain')
res = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=12, radius=1)
for v in res['verts']:
    p = Vector((v.co.x * HS[0], v.co.y * HS[1], v.co.z * HS[2]))
    if p.z > .1 and abs(p.x) < .03 and p.y < .05: p.z -= .012 * (1 - abs(p.x) / .03)
    v.co = HC + p + Vector((0, .006, .004)); v[lay] = -1
bm.normal_update()
capf = {f for v in res['verts'] for f in v.link_faces}
kill = [f for f in capf if (f.calc_center_median() - HC).y < -.035 and (f.calc_center_median() - HC).z < .095]
bmesh.ops.delete(bm, geom=kill, context='FACES')
for f in bm.faces:
    for lp in f.loops: lp[uvl].uv = (.5, .05)

def lock(a_top, a_mid, a_end, z_end, w0, out_end=1.18, n=10, forward=0.0, crown=.172, chain=None):
    tag = CH_NAMES.index(chain) if chain else -1
    pts, outs, ws = [], [], []
    zs = [crown - .005, .13, .07, .0, -.06]
    for i, z in enumerate(zs):
        a = lerp(a_top, a_mid, i / (len(zs) - 1)); o = lerp(1.02, 1.1, i / (len(zs) - 1))
        pts.append(scalp(a, z, o))
    rest = n - len(zs); zrel_end = z_end - HC.z
    for i in range(1, rest + 1):
        k = i / rest; z = lerp(-.06, zrel_end, k); a = lerp(a_mid, a_end, k)
        o = lerp(1.1, out_end, min(1, k * 1.6))
        pts.append(HC + Vector((math.sin(a) * HS[0] * o, -math.cos(a) * HS[1] * o - forward * k, z)))
    for i, p in enumerate(pts):
        ov = Vector((p.x - HC.x, p.y - HC.y, 0)); ov.normalize()
        if i < 3: ov = (p - HC).normalized()
        outs.append(ov)
        k = i / (len(pts) - 1)
        ws.append(w0 * (1 - .75 * k ** 1.6) if k > .1 else w0 * (.6 + 4 * k))
    clump(bm, pts, ws, [w * .55 for w in ws], outs, 0, uvl, tag, lay)

BACK = ['hair_sl', 'hair_bl', 'hair_bc', 'hair_br', 'hair_sr']
for i, a in enumerate([1.25, 1.6, 1.95, 2.3, 2.65, 2.95, -2.95, -2.65, -2.3, -1.95, -1.6, -1.25]):
    z_end = .56 + .04 * math.cos(i * 1.7) - (.05 if abs(a) > 2.6 else 0)
    lock(math.copysign(.1, a) + a * .15, a, a * (1.04 if abs(a) < 2 else 1), z_end, .05,
         out_end=1.32 if abs(a) < 1.9 else 1.22, chain=nearest_chain(a, BACK))
for a, ze in ((1.3, .9), (1.5, .95), (-1.3, .9), (-1.5, .95)):
    lock(math.copysign(.12, a), a, a * .93, ze, .042, out_end=1.12, chain='hair_sl' if a > 0 else 'hair_sr')
for a in (1.08, -1.08):
    lock(math.copysign(.08, a), a, a * .9, .82, .04, out_end=1.1, forward=.04, chain='lock_l' if a > 0 else 'lock_r')
for a, ze, w in ((.78, 1.17, .03), (.92, 1.1, .032), (-.78, 1.17, .03), (-.92, 1.1, .032), (-.3, 1.3, .016)):
    lock(math.copysign(.03, a), a, a * 1.05, ze, w, out_end=1.04, n=8)
finish(bm, 'hair', hair_w, ['hair'], smooth_=False, layer=True)

# ------------------------------------------------------------------ armature
arm_data = bpy.data.armatures.new('SilsRig')
rig = bpy.data.objects.new('SilsRig', arm_data); coll.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = {}
for name, h, t, parent in BONES:
    b = arm_data.edit_bones.new(name); b.head = h; b.tail = t; b.roll = 0
    if name == 'sword': b.align_roll(SW_Z)
    if parent: b.parent = eb[parent]; b.use_connect = False
    eb[name] = b
bpy.ops.object.mode_set(mode='OBJECT')
for ob in PARTS:
    ob.parent = rig
    mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
bpy.ops.object.select_all(action='DESELECT')
for ob in PARTS: ob.select_set(True)
bpy.context.view_layer.objects.active = PARTS[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active; body.name = 'Sils'
for m in list(body.modifiers)[1:]: body.modifiers.remove(m)

# ------------------------------------------------------------------ animation helpers
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
PB = rig.pose.bones
for pb in PB: pb.rotation_mode = 'QUATERNION'
upd = lambda: bpy.context.view_layer.update()

def setrot(name, e):
    pb = PB[name]
    R = Euler((rad(e[0]), rad(e[1]), rad(e[2])), 'XYZ').to_matrix().to_4x4()
    Mr = pb.bone.matrix_local.to_3x3().to_4x4()
    pb.rotation_quaternion = (Mr.inverted() @ R @ Mr).to_quaternion()

GROUPS = {'hair1': [f'{c}_1' for c in BACK], 'hair2': [f'{c}_2' for c in BACK], 'hair3': [f'{c}_3' for c in BACK],
          'lockL': ['lock_l_1'], 'lockR': ['lock_r_1'], 'sleeveL': ['sleeve_l_1'], 'sleeveR': ['sleeve_r_1'], 'skirt': ['skirt_1']}
BASE = {'head': (10, 0, 3), 'neck': (4, 0, 0), 'chest': (3, 0, 0),
        'upper_arm.L': (-2, -7, 0), 'upper_arm.R': (-2, 7, 0), 'forearm.L': (-7, 0, 0), 'forearm.R': (-7, 0, 0),
        'hair1': (-12, 0, 0), 'hair2': (2, 0, 0), 'lockL': (-10, 0, 0), 'lockR': (-10, 0, 0)}
def P(**kw):
    p = dict(BASE)
    for k, v in kw.items(): p[k.replace('__', '.')] = v
    out = {}
    for k, v in p.items():
        for nm in GROUPS.get(k, [k]): out[nm] = v
    return out
def key(frame, pose, lift=0.0):
    for n in ALL:
        setrot(n, pose.get(n, (0, 0, 0)))
        PB[n].keyframe_insert('rotation_quaternion', frame=frame)
    PB['root'].location = (0, lift, 0); PB['root'].keyframe_insert('location', frame=frame)
    PB['sword'].location = (0, 0, 0); PB['sword'].keyframe_insert('location', frame=frame)
def new_action(): rig.animation_data_create(); rig.animation_data.action = None
def finish_action(name):
    act = rig.animation_data.action; act.name = name; act.use_fake_user = True
    rig.animation_data.action = None; return act

# ------------------------------------------------------------------ Idle (6 s loop)
new_action()
key(1, P())
key(40, P(chest=(4.5, 0, 0), head=(12, 0, -2), hair1=(-11, 2, 0), hair2=(4, 0, 2), hair3=(3, 0, 0), lockL=(-8, 0, 3), lockR=(-12, 0, -2), skirt=(1.5, 0, 0)))
key(80, P(head=(4, -4, 0), neck=(2, 0, 0), chest=(2, 0, 0), hair1=(-7, -2, 0), hair2=(-2, 0, -2), hair3=(-3, 0, 0), lockL=(-6, 0, -2), lockR=(-7, 0, 2),
          skirt=(-1, 0, 1), upper_arm__L=(-2, -9, 0), upper_arm__R=(-2, 9, 0)))
key(112, P(head=(3, -6, 2), neck=(1, 0, 0), chest=(2.5, 0, 0), hair1=(-8, 1, 0), hair2=(-1, 0, 1), hair3=(2, 0, 0), skirt=(0, 0, -1)))
key(150, P(head=(12, 0, 5), chest=(4, 0, 0), hair1=(-13, -1, 0), hair2=(3, 0, -1), hair3=(2, 0, 0), skirt=(1, 0, 0)))
key(181, P())
idle = finish_action('Idle')

# ------------------------------------------------------------------ Click (3 s): arms open, rising
new_action()
key(1, P())
open_ = dict(head=(-24, 0, 0), neck=(-8, 0, 0), chest=(-7, 0, 0), spine=(-3, 0, 0),
             upper_arm__L=(-10, -80, 0), upper_arm__R=(-10, 80, 0), forearm__L=(0, -6, 0), forearm__R=(0, 6, 0),
             hand__L=(0, -15, 0), hand__R=(0, 15, 0), sleeveL=(0, 25, 0), sleeveR=(0, -25, 0),
             hair1=(10, 0, 0), hair2=(12, 0, 0), hair3=(10, 0, 0), lockL=(8, 0, -14), lockR=(8, 0, 14), skirt=(-3, 0, 0))
key(8, P(head=(20, 0, 0), chest=(6, 0, 0), upper_arm__L=(-2, -3, 0), upper_arm__R=(-2, 3, 0)))
key(26, P(**open_), lift=.06)
o2 = dict(open_); o2.update(head=(-28, 0, 4), upper_arm__L=(-12, -84, 0), upper_arm__R=(-12, 84, 0), hair2=(16, 0, 3), hair3=(14, 0, -3))
key(56, P(**o2), lift=.075)
key(76, P(head=(8, 0, 2), upper_arm__L=(-4, -20, 0), upper_arm__R=(-4, 20, 0), hair1=(-6, 0, 0)), lift=.02)
key(91, P())
click = finish_action('Click')

# ------------------------------------------------------------------ Examine (7.2 s): draw, study the blade, sheathe
def frame_from(o, y, zhint):
    y = Vector(y).normalized(); z = Vector(zhint); z = (z - y * z.dot(y)).normalized(); x = y.cross(z)
    M = Matrix((x, y, z)).transposed().to_4x4(); M.translation = Vector(o); return M
def mblend(A, B, k):
    M = A.to_quaternion().slerp(B.to_quaternion(), k).to_matrix().to_4x4()
    M.translation = A.translation.lerp(B.translation, k); return M
SH = frame_from(SW_M0, SW_D, SW_Z)
PART = frame_from(SW_M0 - SW_D * .3, SW_D, SW_Z)
SW_KEYS = [
    (1, SH), (24, SH), (40, PART),
    (48, frame_from((-.02, -.3, 1.0), (.05, -.2, 1), (.2, -1, -.2))),
    (62, frame_from((-.07, -.3, 1.05), (.6, -.2, .75), (.1, -1, -.1))),
    (85, frame_from((-.12, -.28, 1.07), (1, -.12, .06), (0, -.5, .87))),
    (115, frame_from((-.11, -.29, 1.1), (1, -.18, .22), (0, -.97, -.1))),
    (140, frame_from((-.12, -.28, 1.08), (1, -.08, .1), (0, -.3, .95))),
    (150, frame_from((-.12, -.28, 1.08), (1, -.08, .1), (0, -.3, .95))),
    (163, frame_from((.02, -.32, 1.12), (.1, .35, -.93), SW_Z)),
    (175, PART), (200, SH), (216, SH),
]
def sword_at(f):
    for (f0, A), (f1, B) in zip(SW_KEYS, SW_KEYS[1:]):
        if f0 <= f <= f1: return mblend(A, B, smooth((f - f0) / (f1 - f0)))
    return SW_KEYS[-1][1].copy()
def hand_frame(point, handY, handZ):
    y = handY.normalized(); z = (handZ - y * handZ.dot(y)).normalized(); x = y.cross(z)
    M = Matrix((x, y, z)).transposed().to_4x4(); M.translation = point; return M
def target(kind, S):
    if kind[0] == 'grip':
        R = S.to_3x3(); Y, Z = R @ Vector((0, 1, 0)), R @ Vector((0, 0, 1))
        p = S @ Vector((0, -.065, 0)); return hand_frame(p + Z * .035, -Z, Y)
    if kind[0] == 'scab':
        R = SH.to_3x3(); Y, Z = R @ Vector((0, 1, 0)), R @ Vector((0, 0, 1))
        p = SH @ Vector((0, .08, 0)); return hand_frame(p + Z * .035, -Z, Y)
    if kind[0] == 'blade':
        R = S.to_3x3(); X, Z = R @ Vector((1, 0, 0)), R @ Vector((0, 0, 1))
        p = S @ Vector((0, kind[1], 0)); return hand_frame(p - Z * .03 - X * .035, X, Z)
HAND_KEYS = {
    'R': [(1, ('fk',)), (16, ('grip',)), (200, ('grip',)), (216, ('fk',))],
    'L': [(1, ('fk',)), (14, ('scab',)), (46, ('scab',)), (72, ('blade', .3)), (150, ('blade', .3)), (168, ('scab',)), (205, ('scab',)), (216, ('fk',))],
}
def hand_at(side, f, S):
    keys = HAND_KEYS[side]
    for (f0, k0), (f1, k1) in zip(keys, keys[1:]):
        if f0 <= f <= f1:
            t = smooth((f - f0) / (f1 - f0)) if f1 > f0 else 1
            T0 = None if k0[0] == 'fk' else target(k0, S); T1 = None if k1[0] == 'fk' else target(k1, S)
            if T0 is None and T1 is None: return None, 0
            if T0 is None: return T1, t
            if T1 is None: return T0, 1 - t
            return mblend(T0, T1, t), 1
    return None, 0
def solve(side, M):
    sx = 1 if side == 'L' else -1
    ua, fa, hd = PB[f'upper_arm.{side}'], PB[f'forearm.{side}'], PB[f'hand.{side}']
    A = ua.head.copy(); W = M.translation.copy()
    L1, L2 = ua.bone.length, fa.bone.length
    D = W - A; dist = clamp(D.length, .03, L1 + L2 - .002); dn = D.normalized()
    pole = Vector((sx * .8, .5, -.45))
    pp = (pole - dn * pole.dot(dn)).normalized()
    a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist); h = math.sqrt(max(0.0, L1 * L1 - a * a))
    E = A + dn * a + pp * h; W2 = A + dn * dist
    def fr(head, Y, ref):
        Y = Y.normalized(); Z = (ref - Y * ref.dot(Y)).normalized(); X = Y.cross(Z)
        R = Matrix((X, Y, Z)).transposed().to_4x4(); R.translation = head; return R
    ua.matrix = fr(A, E - A, pp); upd()
    fa.matrix = fr(E, W2 - E, pp); upd()
    H = M.copy(); H.translation = W2; hd.matrix = H; upd()
def body_at(f, keys):
    for (f0, A), (f1, B) in zip(keys, keys[1:]):
        if f0 <= f <= f1:
            k = smooth((f - f0) / (f1 - f0)); out = {}
            for n in set(A) | set(B):
                a, b = A.get(n, (0, 0, 0)), B.get(n, (0, 0, 0)); out[n] = tuple(lerp(a[i], b[i], k) for i in range(3))
            return out
    return keys[-1][1]
EX_BODY = [
    (1, P()),
    (16, P(spine=(6, 0, 10), chest=(4, 0, 10), neck=(4, 0, 0), head=(22, 0, 16), hair1=(-16, 0, 0))),
    (40, P(spine=(2, 0, 6), chest=(0, 0, 4), head=(14, 0, -6))),
    (62, P(spine=(0, 0, 0), chest=(-2, 0, -4), head=(4, 0, -8))),
    (85, P(chest=(0, 0, -4), head=(8, 0, 10))),
    (115, P(chest=(0, 0, -2), head=(12, 0, 22), neck=(2, 0, 4))),
    (140, P(chest=(0, 0, -5), head=(6, 0, -6))),
    (160, P(spine=(4, 0, 8), chest=(3, 0, 8), head=(22, 0, 14))),
    (200, P(spine=(6, 0, 10), chest=(4, 0, 10), head=(24, 0, 16), hair1=(-16, 0, 0))),
    (216, P()),
]
new_action()
EXN = 216
for f in range(1, EXN + 1):
    pose = body_at(f, EX_BODY)
    for n in ALL: setrot(n, pose.get(n, (0, 0, 0)))
    PB['root'].location = (0, 0, 0); PB['sword'].location = (0, 0, 0)
    upd()
    S = sword_at(f)
    PB['sword'].matrix = S; upd()
    for side in ('R', 'L'):
        T, w = hand_at(side, f, S)
        if T is None or w <= 0: continue
        fk = PB[f'hand.{side}'].matrix.copy()
        solve(side, mblend(fk, T, w) if w < 1 else T)
    for n in ALL: PB[n].keyframe_insert('rotation_quaternion', frame=f)
    PB['root'].keyframe_insert('location', frame=f); PB['sword'].keyframe_insert('location', frame=f)
examine = finish_action('Examine')

bpy.ops.object.mode_set(mode='OBJECT')
rig.animation_data.action = idle
scene.frame_start, scene.frame_end = 1, 181
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'sils.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'sils.glb'), export_format='GLB', export_animations=True,
                          export_animation_mode='ACTIONS', export_skins=True, export_apply=False, export_yup=True)
print('SILS OK', len(body.data.vertices), 'verts', len(rig.data.bones), 'bones')
