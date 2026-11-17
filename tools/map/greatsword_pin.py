"""Greatsword map pin (no engraving). Total length 1.0, origin at the blade tip, blade pointing down (-Z),
so the model drops onto a map coordinate as if stabbed into the ground. Front of the blade faces -Y.
Run:  blender -b --factory-startup -P tools/map/greatsword_pin.py -- [render]   (writes greatsword_pin.glb next to this file;
     copy it to assets/atlas3d/pins/greatsword.glb)"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
RENDER = 'render' in sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else False
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
hexc = lambda h: tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (1, 3, 5))

def mat(name, h, rough, metal, emit=None, vcol=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*hexc(h), 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if vcol:
        n = m.node_tree.nodes.new('ShaderNodeVertexColor'); n.layer_name = 'Col'
        m.node_tree.links.new(n.outputs['Color'], b.inputs['Base Color'])
        m.node_tree.links.new(n.outputs['Color'], b.inputs['Emission Color'])
        b.inputs['Emission Strength'].default_value = emit or 0
    return m
BLADE = mat('blade', '#7ca585', 0.25, 0.35, emit=0.22, vcol=True)
IRON = mat('iron', '#2a2b2f', 0.42, 0.85)
IRON_HI = mat('iron_light', '#5c5a5f', 0.35, 0.9)
BAND = mat('band', '#444b51', 0.35, 0.9)
GRIP = mat('grip', '#141416', 0.75, 0.1)

def new_obj(name, bm, m, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); scene.collection.objects.link(o); o.data.materials.append(m)
    for p in o.data.polygons: p.use_smooth = smooth
    return o

# ---------- blade: stations along its length, a flat-panelled diamond cross-section ----------
L_TIP, L_GUARD = 0.0, 0.63
def width(s):                       # s: 0 at the guard, 1 at the tip
    w = 0.108 * (1 + 0.06 * math.sin(math.pi * min(s, .72) / .72 * .9))
    if s > .72: w *= ((1 - s) / .28) ** .85
    return w
def thick(s): return 0.013 * (1 - .35 * s) * (1 if s < .9 else (1 - s) / .1 * .7 + .3)
def blade_rgb(s, edge):             # dark green at the guard, pale white-green at the tip, edges brighter
    stops = [(0, '#12291b'), (.18, '#2c5a3b'), (.42, '#6a9c7a'), (.68, '#a9cfb3'), (1, '#e8f5ec')]
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if s <= b:
            k = (s - a) / (b - a); c0, c1 = hexc(ca), hexc(cb); c = [x + (y - x) * k for x, y in zip(c0, c1)]; break
    return tuple(min(1, x * (1 + .6 * edge) + .04 * edge) for x in c)
N = 48
bm = bmesh.new(); col = bm.loops.layers.color.new('Col')
rings = []
for i in range(N):
    s = i / N; y = L_GUARD - s * (L_GUARD - L_TIP); w, t = width(s), thick(s)
    pw, be = w * .2, w * .16                              # half-width of the flat panel, width of the edge bevel
    xs = [(-w / 2, 0, 1), (-w / 2 + be, t * .38, .6), (-pw, t / 2, 0), (pw, t / 2, 0), (w / 2 - be, t * .38, .6), (w / 2, 0, 1),
          (w / 2 - be, -t * .38, .6), (pw, -t / 2, 0), (-pw, -t / 2, 0), (-w / 2 + be, -t * .38, .6)]
    rings.append([(bm.verts.new((x, z, y)), s, e) for x, z, e in xs])
tip = bm.verts.new((0, 0, L_TIP))
def paint(f, items):
    for l, (_, s, e) in zip(f.loops, items): l[col] = (*blade_rgb(s, e), 1)
for i in range(N - 1):
    A, Bn = rings[i], rings[i + 1]
    for j in range(10):
        k = (j + 1) % 10; it = [A[j], A[k], Bn[k], Bn[j]]
        paint(bm.faces.new([v for v, _, _ in it]), it)
for j in range(10):
    k = (j + 1) % 10; f = bm.faces.new([rings[-1][j][0], rings[-1][k][0], tip])
    for l in f.loops: l[col] = (*blade_rgb(1, 1), 1)
cap = bm.faces.new([v for v, _, _ in reversed(rings[0])])
for l in cap.loops: l[col] = (*blade_rgb(0, 0), 1)
blade = new_obj('blade', bm, BLADE, smooth=False)

# ---------- lathed round parts ----------
def lathe(name, prof, m, seg=20, z0=0):
    bm = bmesh.new(); R = []
    for k in range(seg):
        a = 2 * math.pi * k / seg; R.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z0 + z)) for r, z in prof])
    for k in range(seg):
        A, Bn = R[k], R[(k + 1) % seg]
        for i in range(len(prof) - 1): bm.faces.new([A[i], Bn[i], Bn[i + 1], A[i + 1]])
    top = bm.verts.new((0, 0, z0 + prof[-1][1])); bot = bm.verts.new((0, 0, z0 + prof[0][1]))
    for k in range(seg):
        bm.faces.new([R[k][-1], R[(k + 1) % seg][-1], top]); bm.faces.new([R[(k + 1) % seg][0], R[k][0], bot])
    return new_obj(name, bm, m)
G = L_GUARD
# grip in two wrapped sections, with ring bands at the collar, the middle and the pommel
lathe('collar', [(.019, G + .022), (.024, G + .026), (.024, G + .040), (.019, G + .045)], BAND)
lathe('grip_a', [(.017, G + .044), (.0185, G + .07), (.0175, G + .14), (.016, G + .155)], GRIP)
lathe('band_mid', [(.016, G + .153), (.021, G + .157), (.021, G + .168), (.016, G + .172)], BAND)
lathe('grip_b', [(.016, G + .17), (.0175, G + .2), (.017, G + .26), (.0165, G + .272)], GRIP)
lathe('pommel', [(.016, G + .27), (.022, G + .275), (.022, G + .29), (.019, G + .295), (.0205, G + .34), (.023, G + .35), (.023, G + .37),
                 (.020, G + .375), (.021, G + .405), (.024, G + .41), (.022, G + .42), (.012, G + .425)], IRON)

# ---------- cross-guard: a central block with a langet over the blade, tapered arms tilted toward the grip, knob ends ----------
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1, matrix=Matrix.Diagonal((.082, .046, .04, 1)) @ Matrix.Translation((0, 0, 0)))
for v in bm.verts: v.co.z += G + .012
# langet: a pointed plate running down onto the blade on both faces
for side in (-1, 1):
    a = bm.verts.new((-.03, side * .009, G - .006)); b = bm.verts.new((.03, side * .009, G - .006)); c = bm.verts.new((0, side * .009, G - .07))
    a2 = bm.verts.new((-.03, side * .021, G - .006)); b2 = bm.verts.new((.03, side * .021, G - .006)); c2 = bm.verts.new((0, side * .0115, G - .07))
    for f in ([a, b, c], [a2, c2, b2], [a, a2, b2, b], [b, b2, c2, c], [c, c2, a2, a]): bm.faces.new(f if side > 0 else list(reversed(f)))
guard = new_obj('guard', bm, IRON, smooth=False)
md = guard.modifiers.new('bev', 'BEVEL'); md.width = .004; md.segments = 2
for s in (-1, 1):
    tilt = math.radians(-11)                                             # arms angle toward the blade
    root = Vector((s * .03, 0, G + .012)); tipp = root + Vector((s * .14 * math.cos(tilt), 0, .14 * math.sin(tilt)))
    d = (tipp - root); L = d.length
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=.022, radius2=.0135, depth=L, location=(root + tipp) / 2)
    arm = bpy.context.active_object; arm.name = 'arm%d' % s; arm.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); arm.data.materials.append(IRON)
    for p in arm.data.polygons: p.use_smooth = True
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=.021, depth=.04, location=tipp + d.normalized() * .012)
    knob = bpy.context.active_object; knob.name = 'knob%d' % s; knob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); knob.data.materials.append(IRON_HI)
    md = knob.modifiers.new('bev', 'BEVEL'); md.width = .005; md.segments = 3
    for p in knob.data.polygons: p.use_smooth = True

# ---------- join, save, export ----------
for o in list(scene.objects):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects: o.select_set(True)
bpy.context.view_layer.objects.active = blade; bpy.ops.object.join(); blade.name = 'greatsword_pin'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'greatsword_pin.blend'))
kw = dict(filepath=os.path.join(HERE, 'greatsword_pin.glb'), export_format='GLB', export_apply=True)
try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
except TypeError: bpy.ops.export_scene.gltf(**kw)
print('TRIS', sum(len(p.vertices) - 2 for p in blade.data.polygons))

if RENDER:
    w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (.02, .02, .025, 1)
    for name, loc, size, e in [('key', (-1.5, -2, 1.8), 1.5, 120), ('fill', (2, -1.5, .6), 2, 50), ('rim', (.8, 2, 1.5), 1, 90)]:
        l = bpy.data.lights.new(name, 'AREA'); l.size = size; l.energy = e; o = bpy.data.objects.new(name, l); scene.collection.objects.link(o)
        o.location = loc; o.rotation_euler = (Vector((0, 0, .55)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam = bpy.data.cameras.new('cam'); cam.lens = 60; co = bpy.data.objects.new('cam', cam); scene.collection.objects.link(co); scene.camera = co
    co.location = (1.0, -2.9, .7); co.rotation_euler = (Vector((0, 0, .5)) - co.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 40; scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'; scene.render.threads = 2; scene.render.resolution_x = 700; scene.render.resolution_y = 1000
    scene.render.filepath = os.path.join(HERE, 'sword_render.png'); bpy.ops.render.render(write_still=True); print('RENDERED')
