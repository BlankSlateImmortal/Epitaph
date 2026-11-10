"""Sils — Shelter-DS-style low-poly figure, rigged and animated.
Run headless:  blender -b -P sils.py -- <outdir>
Writes sils.blend and sils.glb (actions: Idle, Click). Character faces -Y, Z up."""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.dirname(os.path.abspath(__file__))
TEX = OUT
rad = math.radians
clamp = lambda v, a, b: max(a, min(b, v))
lerp = lambda a, b, k: a + (b - a) * k

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
}
MAT_ORDER = list(MATS)

# ------------------------------------------------------------------ bones
HC = Vector((0, 0, 1.36))            # head centre
BONES = [  # name, head, tail, parent
    ('root', (0, 0, 0), (0, 0, .15), None),
    ('hips', (0, 0, .72), (0, 0, .86), 'root'),
    ('skirt', (0, 0, .72), (0, 0, .36), 'hips'),
    ('spine', (0, 0, .86), (0, 0, 1.0), 'hips'),
    ('chest', (0, 0, 1.0), (0, 0, 1.13), 'spine'),
    ('neck', (0, 0, 1.13), (0, 0, 1.22), 'chest'),
    ('head', (0, 0, 1.22), (0, 0, 1.56), 'neck'),
    ('hair_b1', (0, .14, 1.3), (0, .17, 1.06), 'head'),
    ('hair_b2', (0, .17, 1.06), (0, .19, .82), 'hair_b1'),
    ('hair_b3', (0, .19, .82), (0, .2, .55), 'hair_b2'),
]
for s, sx in (('L', 1), ('R', -1)):
    BONES += [
        (f'lock.{s}1', (sx * .15, -.12, 1.25), (sx * .16, -.13, 1.04), 'head'),
        (f'lock.{s}2', (sx * .16, -.13, 1.04), (sx * .165, -.135, .8), f'lock.{s}1'),
        (f'shoulder.{s}', (sx * .03, 0, 1.1), (sx * .16, 0, 1.09), 'chest'),
        (f'upper_arm.{s}', (sx * .17, 0, 1.08), (sx * .215, 0, .85), f'shoulder.{s}'),
        (f'forearm.{s}', (sx * .215, 0, .85), (sx * .25, -.01, .64), f'upper_arm.{s}'),
        (f'hand.{s}', (sx * .25, -.01, .64), (sx * .257, -.015, .55), f'forearm.{s}'),
        (f'sleeve.{s}', (sx * .25, -.01, .64), (sx * .265, -.01, .5), f'forearm.{s}'),
        (f'thigh.{s}', (sx * .08, 0, .72), (sx * .085, 0, .4), 'hips'),
        (f'shin.{s}', (sx * .085, 0, .4), (sx * .09, 0, .1), f'thigh.{s}'),
        (f'foot.{s}', (sx * .09, 0, .1), (sx * .09, -.08, .03), f'shin.{s}'),
    ]

# ------------------------------------------------------------------ mesh helpers
PARTS = []
def finish(bm, name, weights, mats, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob)
    for mname in mats: me.materials.append(MATS[mname])
    groups = {}
    for v in me.vertices:
        for b, w in weights(v.co).items():
            if w <= 1e-3: continue
            g = groups.get(b) or ob.vertex_groups.new(name=b); groups[b] = g
            g.add([v.index], w, 'REPLACE')
    PARTS.append(ob); return ob

def rigid(b): return lambda co: {b: 1.0}
def ramp(z, z0, z1): return clamp((z - z0) / (z1 - z0), 0, 1)

def lathe(bm, profile, segs, mat=0, cap_top=False, cap_bot=False, M=None, pleat=0, uv=None):
    """profile: list of (z, rx, ry[, cx, cy]) along local +Z. Returns rings."""
    rings = []
    for i, pr in enumerate(profile):
        z, rx, ry = pr[:3]; cx = pr[3] if len(pr) > 3 else 0; cy = pr[4] if len(pr) > 4 else 0
        ring = []
        for j in range(segs):
            a = j / segs * 2 * math.pi
            k = 1 + (pleat * math.cos(a * segs / 2) if pleat and i > 0 else 0) * (1 if callable(pleat) is False else 1)
            co = Vector((cx + math.sin(a) * rx * k, cy - math.cos(a) * ry * k, z))
            if M: co = M @ co
            ring.append(bm.verts.new(co))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for j in range(segs):
            f = bm.faces.new((rings[i][j], rings[i][(j + 1) % segs], rings[i + 1][(j + 1) % segs], rings[i + 1][j])); f.material_index = mat
    if cap_bot: bm.faces.new(list(reversed(rings[0]))).material_index = mat
    if cap_top: bm.faces.new(rings[-1]).material_index = mat
    return rings

def ellipsoid(bm, c, r, u=10, v=7, mat=0):
    res = bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=1)
    for vt in res['verts']: vt.co = Vector((c[0] + vt.co.x * r[0], c[1] + vt.co.y * r[1], c[2] + vt.co.z * r[2]))
    for f in {f for vt in res['verts'] for f in vt.link_faces}: f.material_index = mat
    return res['verts']

def clump(bm, pts, widths, thick, outs, mat=0, uvl=None):
    """Hair lock / strap: diamond cross-section swept along pts. outs: outward vector per point."""
    n = len(pts); rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        o = outs[i] - t * outs[i].dot(t); o.normalize()
        sd = t.cross(o).normalized()
        w, th = widths[i], thick[i]
        rings.append([bm.verts.new(p + sd * w), bm.verts.new(p + o * th), bm.verts.new(p - sd * w), bm.verts.new(p - o * th * .55)])
    us = [0, .5, 1, .5]
    for i in range(n - 1):
        for j in range(4):
            q = (rings[i][j], rings[i + 1][j], rings[i + 1][(j + 1) % 4], rings[i][(j + 1) % 4])
            f = bm.faces.new(q); f.material_index = mat
            if uvl is not None:
                for lp, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, (j + 1) % 4), (i, (j + 1) % 4))):
                    lp[uvl].uv = (us[jj] if jj != 3 else .5, 1 - ii / (n - 1))
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
for v in res['verts']:
    v.co = head_shape(Vector((v.co.x * HR[0], v.co.y * HR[1], v.co.z * HR[2]))) + HC
bm.normal_update()
S = .17
for f in bm.faces:
    front = f.normal.y < -.12
    f.material_index = 1 if front else 0
    for lp in f.loops:
        p = lp.vert.co - HC
        lp[uvl].uv = (.5 + p.x / (2 * S), .5 + p.z / (2 * S))
# ears tucked under the hair, neck
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
def body_w(co):
    z = co.z; w = {}
    sk = clamp((.72 - z) / .55, 0, 1) * .85
    if z < .72: w = {'skirt': sk, 'hips': 1 - sk}
    elif z < .86: w = {'hips': 1 - ramp(z, .8, .9), 'spine': ramp(z, .8, .9)}
    elif z < 1.0: w = {'spine': 1 - ramp(z, .95, 1.03), 'chest': ramp(z, .95, 1.03)}
    else: w = {'chest': 1.0}
    if z > 1.0 and abs(co.x) > .12:
        s = 'L' if co.x > 0 else 'R'; k = ramp(abs(co.x), .12, .18) * .6
        w = {kk: vv * (1 - k) for kk, vv in w.items()}; w[f'shoulder.{s}'] = k
    if z > 1.15: w = {'chest': 1 - ramp(z, 1.15, 1.19), 'neck': ramp(z, 1.15, 1.19)}
    return w

bm = bmesh.new()
segs = 16
rings = []
for i, (z, rx, ry) in enumerate(ROBE):
    ring = []
    for j in range(segs):
        a = j / segs * 2 * math.pi
        pl = 1 + (.045 * math.cos(a * 8) * ramp(.8 - z, 0, .5))       # pleats deepen toward the hem
        ring.append(bm.verts.new(Vector((math.sin(a) * rx * pl, -math.cos(a) * ry * pl, z))))
    rings.append(ring)
for i in range(len(rings) - 1):
    for j in range(segs):
        bm.faces.new((rings[i][j], rings[i][(j + 1) % segs], rings[i + 1][(j + 1) % segs], rings[i + 1][j])).material_index = 0
# inner lining (slightly smaller, flipped) so the hem reads as cloth from below
inner = []
for (z, rx, ry) in ROBE[6:]:
    inner.append([bm.verts.new(Vector((math.sin(j / segs * 2 * math.pi) * rx * .93, -math.cos(j / segs * 2 * math.pi) * ry * .93, z))) for j in range(segs)])
for i in range(len(inner) - 1):
    for j in range(segs):
        bm.faces.new((inner[i][j], inner[i + 1][j], inner[i + 1][(j + 1) % segs], inner[i][(j + 1) % segs])).material_index = 1
for j in range(segs):
    bm.faces.new((rings[-1][j], rings[-1][(j + 1) % segs], inner[-1][(j + 1) % segs], inner[-1][j])).material_index = 1
# sash + red cord
lathe(bm, [(.81, .158, .1), (.89, .156, .098)], segs, 2, M=Matrix.Scale(1.04, 4))
lathe(bm, [(.836, .166, .108), (.846, .166, .108)], segs, 3, M=Matrix.Scale(1.05, 4))
finish(bm, 'robe', body_w, ['robe', 'robe_in', 'sash', 'cord'])

# crossed white collar (left over right), blood on it
def on_robe(z, a, off=.008):
    rx, ry = robe_r(z); return Vector((math.sin(a) * (rx + off), -math.cos(a) * (ry + off), z))
bm = bmesh.new(); uvl = bm.loops.layers.uv.verify()
for (a0, a1, o, w) in ((-.62, .42, .004, .02), (.62, -.42, .008, .023)):
    pts, outs = [], []
    n = 9
    for i in range(n):
        k = i / (n - 1); z = lerp(1.17, .875, k); a = lerp(a0, a1, k ** 1.3)
        p = on_robe(z, a, o); pts.append(p); outs.append(Vector((p.x, p.y, 0)).normalized())
    clump(bm, pts, [w * (.75 + .25 * i / (n - 1)) for i in range(n)], [.003] * n, outs, 0, uvl)
finish(bm, 'collar', body_w, ['collar'])

# ------------------------------------------------------------------ arms
def arm_matrix(a, b):
    a, b = Vector(a), Vector(b); d = (b - a)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return Matrix.Translation(a) @ q.to_matrix().to_4x4(), d.length
for s, sx in (('L', 1), ('R', -1)):
    bm = bmesh.new()
    M, L = arm_matrix((sx * .17, 0, 1.08), (sx * .215, 0, .85))
    lathe(bm, [(-.02, .062, .062), (L * .5, .066, .066), (L + .01, .07, .07)], 10, 0, M=M)
    finish(bm, f'sleeve_up.{s}', rigid(f'upper_arm.{s}'), ['robe'])
    bm = bmesh.new()
    M, L = arm_matrix((sx * .215, 0, .85), (sx * .25, -.01, .64))
    # wide hanging sleeve: bell that widens past the wrist and droops on the inner side
    prof = [(-.01, .07, .07), (L * .45, .082, .08), (L * .9, .1, .095, 0, 0), (L + .06, .112, .104, 0, 0)]
    rr = lathe(bm, prof, 12, 0, M=M)
    inn = lathe(bm, [(L + .06, .105, .097), (L * .55, .078, .074)], 12, 1, M=M)
    for j in range(12):
        bm.faces.new((rr[-1][j], rr[-1][(j + 1) % 12], inn[0][(j + 1) % 12], inn[0][j])).material_index = 1
    def sleeve_w(co, s=s, sx=sx):
        k = ramp(-co.z, -.7, -.55)
        return {f'forearm.{s}': 1 - k * .7, f'sleeve.{s}': k * .7}
    finish(bm, f'sleeve_lo.{s}', sleeve_w, ['robe', 'robe_in'])
    # hand: big DS mitten with thumb, palm facing the leg
    bm = bmesh.new()
    hp = Vector((sx * .252, -.012, .6))
    ellipsoid(bm, hp, (.026, .036, .046), 8, 6, 0)
    ellipsoid(bm, hp + Vector((0, -.028, .012)), (.012, .014, .024), 6, 4, 0)
    finish(bm, f'hand.{s}', rigid(f'hand.{s}'), ['skin'])
    # legs (barely seen) + cloth boots with white soles
    bm = bmesh.new()
    lathe(bm, [(.12, .045, .045, sx * .09, 0), (.4, .055, .055, sx * .086, 0), (.72, .07, .07, sx * .08, 0)], 8, 0)
    finish(bm, f'leg.{s}', lambda co, s=s: {f'thigh.{s}': ramp(co.z, .36, .44), f'shin.{s}': 1 - ramp(co.z, .36, .44)}, ['pants'])
    bm = bmesh.new()
    ellipsoid(bm, (sx * .09, -.03, .075), (.05, .085, .055), 10, 6, 0)
    lathe(bm, [(0, .055, .095, sx * .09, -.03), (.03, .056, .096, sx * .09, -.03)], 12, 1, cap_top=True, cap_bot=True)
    finish(bm, f'boot.{s}', rigid(f'foot.{s}'), ['boot', 'sole'])

# ------------------------------------------------------------------ hair
HS = (.168, .175, .19)      # scalp radii (a bit bigger than the head)
def scalp(a, z, out=1.0):
    k = math.sqrt(max(0.0, 1 - (z / (HS[2] * out)) ** 2))
    return HC + Vector((math.sin(a) * HS[0] * out * k, -math.cos(a) * HS[1] * out * k, z))
def hair_w(co):
    z = co.z
    if co.y < -.05 and abs(co.x) > .1 and z < 1.24:          # front locks
        s = 'L' if co.x > 0 else 'R'
        k1 = ramp(1.24 - z, 0, .1); k2 = ramp(1.04 - z, 0, .12)
        return {'head': 1 - k1, f'lock.{s}1': k1 * (1 - k2), f'lock.{s}2': k2}
    k1 = ramp(1.26 - z, 0, .1); k2 = ramp(1.06 - z, 0, .12); k3 = ramp(.82 - z, 0, .12)
    return {'head': 1 - k1, 'hair_b1': k1 * (1 - k2), 'hair_b2': k2 * (1 - k3), 'hair_b3': k3}

bm = bmesh.new(); uvl = bm.loops.layers.uv.verify()
# scalp cap with a centre part
res = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=12, radius=1)
for v in res['verts']:
    p = Vector((v.co.x * HS[0], v.co.y * HS[1], v.co.z * HS[2]))
    if p.z > .1 and abs(p.x) < .03 and p.y < .05: p.z -= .012 * (1 - abs(p.x) / .03)   # part line
    v.co = HC + p + Vector((0, .006, .004))
bm.normal_update()
capf = {f for v in res['verts'] for f in v.link_faces}
kill = [f for f in capf if (f.calc_center_median() - HC).y < -.035 and (f.calc_center_median() - HC).z < .095]
bmesh.ops.delete(bm, geom=kill, context='FACES')
for f in bm.faces:
    for lp in f.loops: lp[uvl].uv = (.5, .05)

def lock(a_top, a_mid, a_end, z_end, w0, out_end=1.18, drift=0.0, n=10, forward=0.0, crown=.172):
    """A lock from near the crown, over the scalp, then falling to z_end (world)."""
    pts, outs, ws = [], [], []
    zs = [crown - .005, .13, .07, .0, -.06]
    for i, z in enumerate(zs):
        a = lerp(a_top, a_mid, i / (len(zs) - 1)); o = lerp(1.02, 1.1, i / (len(zs) - 1))
        p = scalp(a, z, o); pts.append(p)
    base = pts[-1]
    rest = n - len(zs)
    zrel_end = z_end - HC.z
    for i in range(1, rest + 1):
        k = i / rest; z = lerp(-.06, zrel_end, k)
        a = lerp(a_mid, a_end, k)
        o = lerp(1.1, out_end, min(1, k * 1.6))
        r = HS[0] * o
        p = HC + Vector((math.sin(a) * r * (1 + drift * k), -math.cos(a) * HS[1] * o - forward * k, z))
        pts.append(p)
    for i, p in enumerate(pts):
        ov = Vector((p.x - HC.x, p.y - HC.y, 0)); ov.normalize()
        if i < 3: ov = (p - HC).normalized()
        outs.append(ov)
        k = i / (len(pts) - 1)
        ws.append(w0 * (1 - .75 * k ** 1.6) if k > .1 else w0 * (.6 + 4 * k))
    clump(bm, pts, ws, [w * .55 for w in ws], outs, 0, uvl)

# back curtain: falls to the thighs, widening over the shoulders
for i, a in enumerate([1.25, 1.6, 1.95, 2.3, 2.65, 2.95, -2.95, -2.65, -2.3, -1.95, -1.6, -1.25]):
    z_end = .56 + .04 * math.cos(i * 1.7) - (.05 if abs(a) > 2.6 else 0)
    lock(math.copysign(.1, a) + a * .15, a, a * (1.04 if abs(a) < 2 else 1), z_end, .05, out_end=1.32 if abs(a) < 1.9 else 1.22)
# side locks covering the ears and cheeks
for a, ze in ((1.3, .9), (1.5, .95), (-1.3, .9), (-1.5, .95)):
    lock(math.copysign(.12, a), a, a * .93, ze, .042, out_end=1.12)
# long front locks over the chest (lock bones)
for a in (1.08, -1.08):
    lock(math.copysign(.08, a), a, a * .9, .82, .04, out_end=1.1, forward=.04)
# face-framing strands from the part, one falling across his right eye
for a, ze, w in ((.78, 1.17, .03), (.92, 1.1, .032), (-.78, 1.17, .03), (-.92, 1.1, .032), (-.3, 1.3, .016)):
    lock(math.copysign(.03, a), a, a * 1.05, ze, w, out_end=1.04, n=8)
finish(bm, 'hair', hair_w, ['hair'], smooth=False)

# ------------------------------------------------------------------ armature
arm_data = bpy.data.armatures.new('SilsRig')
rig = bpy.data.objects.new('SilsRig', arm_data); coll.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = {}
for name, h, t, parent in BONES:
    b = arm_data.edit_bones.new(name); b.head = h; b.tail = t; b.roll = 0
    if parent: b.parent = eb[parent]; b.use_connect = False
    eb[name] = b
bpy.ops.object.mode_set(mode='OBJECT')

for ob in PARTS:
    ob.parent = rig
    mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = rig

# join into one skinned mesh
bpy.ops.object.select_all(action='DESELECT')
for ob in PARTS: ob.select_set(True)
bpy.context.view_layer.objects.active = PARTS[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active; body.name = 'Sils'
# keep a single Armature modifier
for m in list(body.modifiers)[1:]: body.modifiers.remove(m)

# ------------------------------------------------------------------ animation
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
PB = rig.pose.bones
for pb in PB: pb.rotation_mode = 'QUATERNION'

def setrot(name, e):
    pb = PB[name]
    R = Euler((rad(e[0]), rad(e[1]), rad(e[2])), 'XYZ').to_matrix().to_4x4()
    Mr = pb.bone.matrix_local.to_3x3().to_4x4()
    pb.rotation_quaternion = (Mr.inverted() @ R @ Mr).to_quaternion()

ALL = [b[0] for b in BONES]
BASE = {  # armature-space degrees: +X bows forward, -Y raises the left arm
    'head': (10, 0, 3), 'neck': (4, 0, 0), 'chest': (3, 0, 0),
    'upper_arm.L': (-2, -7, 0), 'upper_arm.R': (-2, 7, 0), 'forearm.L': (-7, 0, 0), 'forearm.R': (-7, 0, 0),
    'hair_b1': (-16, 0, 0), 'hair_b2': (2, 0, 0), 'lock.L1': (-14, 0, 0), 'lock.R1': (-14, 0, 0),
}
def key(frame, pose, lift=0.0):
    for n in ALL:
        setrot(n, pose.get(n, (0, 0, 0)))
        PB[n].keyframe_insert('rotation_quaternion', frame=frame)
    PB['root'].location = (0, lift, 0)
    PB['root'].keyframe_insert('location', frame=frame)
def P(**kw):
    p = dict(BASE)
    for k, v in kw.items(): p[k.replace('__', '.')] = v
    return p

def new_action(name):
    rig.animation_data_create(); rig.animation_data.action = None
    return name

def finish_action(name):
    act = rig.animation_data.action; act.name = name; act.use_fake_user = True
    rig.animation_data.action = None
    return act

# Idle (6 s loop): bowed and still, breathing; the head drifts up to look at you, then sinks again;
# the long hair moves as if underwater.
new_action('Idle')
key(1, P())
key(40, P(chest=(4.5, 0, 0), head=(12, 0, -2), hair_b1=(-13, 2, 0), hair_b2=(5, 0, 2), hair_b3=(4, 0, 0),
          lock__L1=(-11, 0, 3), lock__R1=(-16, 0, -2), skirt=(1.5, 0, 0)))
key(80, P(head=(7, -4, 0), neck=(2, 0, 0), chest=(2, 0, 0), hair_b1=(-8, -2, 0), hair_b2=(-3, 0, -2), hair_b3=(-4, 0, 0),
          lock__L1=(-7, 0, -2), lock__R1=(-9, 0, 2), skirt=(-1, 0, 1), upper_arm__L=(-2, -9, 0), upper_arm__R=(-2, 9, 0)))
key(112, P(head=(5, -6, 2), neck=(1, 0, 0), chest=(2.5, 0, 0), hair_b1=(-9, 1, 0), hair_b2=(-1, 0, 1), hair_b3=(2, 0, 0),
           lock__L1=(-9, 0, 1), lock__R1=(-10, 0, 0), skirt=(0, 0, -1)))
key(150, P(head=(12, 0, 5), chest=(4, 0, 0), hair_b1=(-17, -1, 0), hair_b2=(4, 0, -1), hair_b3=(3, 0, 0), skirt=(1, 0, 0)))
key(181, P())
idle = finish_action('Idle')

# Click (3 s): the head tips back, arms open wide, he rises a little off the ground; hair and sleeves lift.
new_action('Click')
key(1, P())
open_ = dict(head=(-24, 0, 0), neck=(-8, 0, 0), chest=(-7, 0, 0), spine=(-3, 0, 0),
             upper_arm__L=(-10, -80, 0), upper_arm__R=(-10, 80, 0), forearm__L=(0, -6, 0), forearm__R=(0, 6, 0),
             hand__L=(0, -15, 0), hand__R=(0, 15, 0), sleeve__L=(0, 25, 0), sleeve__R=(0, -25, 0),
             hair_b1=(10, 0, 0), hair_b2=(12, 0, 0), hair_b3=(10, 0, 0), lock__L1=(8, 0, -14), lock__R1=(8, 0, 14), skirt=(-3, 0, 0))
key(8, P(head=(24, 0, 0), chest=(6, 0, 0), upper_arm__L=(-2, -3, 0), upper_arm__R=(-2, 3, 0)))
key(26, P(**open_), lift=.06)
o2 = dict(open_); o2.update(head=(-28, 0, 4), upper_arm__L=(-12, -84, 0), upper_arm__R=(-12, 84, 0), hair_b2=(16, 0, 3), hair_b3=(14, 0, -3))
key(56, P(**o2), lift=.075)
key(76, P(head=(10, 0, 2), upper_arm__L=(-4, -20, 0), upper_arm__R=(-4, 20, 0), hair_b1=(-6, 0, 0)), lift=.02)
key(91, P())
click = finish_action('Click')
bpy.ops.object.mode_set(mode='OBJECT')
rig.animation_data.action = idle
scene.frame_start, scene.frame_end = 1, 181

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'sils.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'sils.glb'), export_format='GLB', export_animations=True,
                          export_animation_mode='ACTIONS', export_skins=True, export_apply=False, export_yup=True)
print('SILS OK', len(body.data.vertices), 'verts', len(body.data.polygons), 'faces')
