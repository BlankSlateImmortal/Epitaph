"""Antholonious: the closed book, as a real 3D object.
Z is up, the cover faces the camera (-Y), the spine is on the left (-X)."""
import bpy, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

a = args(); c = a.c
sc = reset(a.frames, res=a.res, samples=a.samples)
GOLD = c['acc']
W, H, T, B = 1.7, 2.36, 0.54, 0.07          # width, height, thickness, board thickness
FY = -T / 2                                   # front face of the book

# ---------- materials ----------
leather = mat('Leather', '#2a130a', rough=0.55)
n = leather.node_tree.nodes
noise = node(leather, 'ShaderNodeTexNoise', Scale=6.0, Detail=8.0, Roughness=0.6)
ramp = node(leather, 'ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = srgb('#1a0b06'); ramp.color_ramp.elements[1].color = srgb('#3e1a0e')
link(leather, noise.outputs['Fac'], ramp.inputs['Fac']); link(leather, ramp.outputs['Color'], bsdf(leather).inputs['Base Color'])
vor = node(leather, 'ShaderNodeTexVoronoi', Scale=180.0)
bump = node(leather, 'ShaderNodeBump', Strength=0.18, Distance=0.02)
link(leather, vor.outputs['Distance'], bump.inputs['Height']); link(leather, bump.outputs['Normal'], bsdf(leather).inputs['Normal'])
rough_noise = node(leather, 'ShaderNodeTexNoise', Scale=40.0)
rr = node(leather, 'ShaderNodeMapRange', **{'To Min': 0.35, 'To Max': 0.75})
link(leather, rough_noise.outputs['Fac'], rr.inputs['Value']); link(leather, rr.outputs['Result'], bsdf(leather).inputs['Roughness'])

leather_dark = mat('LeatherDark', '#1b0d06', rough=0.6)
gold = mat('Gold', GOLD, metal=1.0, rough=0.22)
gnoise = node(gold, 'ShaderNodeTexNoise', Scale=60.0)
gb = node(gold, 'ShaderNodeBump', Strength=0.05)
link(gold, gnoise.outputs['Fac'], gb.inputs['Height']); link(gold, gb.outputs['Normal'], bsdf(gold).inputs['Normal'])
iron = mat('Keyhole', '#0a0503', rough=0.8)

pages = mat('Pages', '#e9dcc0', rough=0.85)
wave = node(pages, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='Y', Scale=70.0, Distortion=1.5, Detail=2.0)
pr = node(pages, 'ShaderNodeValToRGB')
pr.color_ramp.elements[0].color = srgb('#b9a37a'); pr.color_ramp.elements[1].color = srgb('#efe2c4')
link(pages, wave.outputs['Fac'], pr.inputs['Fac']); link(pages, pr.outputs['Color'], bsdf(pages).inputs['Base Color'])
ribbon_m = mat('Ribbon', '#7a1f16', rough=0.3)
try: bsdf(ribbon_m).inputs['Sheen Weight'].default_value = 0.6
except KeyError: pass
floor_m = mat('Floor', '#070402', rough=1.0)

# ---------- the book ----------
root = bpy.data.objects.new('Book', None); bpy.context.collection.objects.link(root)
parts = []
parts.append(cube('FrontBoard', (W, B, H), (0, FY + B / 2, 0), bevel=0.018, mat_=leather))
parts.append(cube('BackBoard', (W, B, H), (0, -FY - B / 2, 0), bevel=0.018, mat_=leather))
parts.append(cube('PageBlock', (W - 0.1, T - 2 * B + 0.004, H - 0.09), (0.02, 0, 0), bevel=0.004, segs=2, mat_=pages))
# rounded spine: an elliptical cylinder down the left side
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=T / 2, depth=H, location=(-W / 2 + 0.02, 0, 0))
sp = bpy.context.object; sp.name = 'Spine'; sp.scale = (0.3, 1.0, 1.0); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.ops.object.shade_smooth(); sp.data.materials.append(leather); parts.append(sp)
SX = -W / 2 + 0.02 - (T / 2) * 0.3            # outermost x of the spine
# raised gilt bands across the spine
for z in (0.82, 0.56, -0.6, -0.86):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=T / 2 * 1.04, depth=0.045, location=(-W / 2 + 0.02, 0, z))
    bd = bpy.context.object; bd.scale = (0.315, 1.0, 1.0); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); bpy.ops.object.shade_smooth()
    bd.data.materials.append(gold); parts.append(bd)
# kanji down the spine, one character at a time
for i, ch in enumerate(c['glyph']):
    t = add_text(ch, 'NotoSerifJP-Black.ttf', size=0.33, extrude=0.01, mat_=gold, name='Kanji' + str(i))
    t.rotation_euler = (math.radians(90), 0, math.radians(-90))
    t.location = (SX - 0.004, 0, 0.26 - i * 0.38)
    parts.append(t)


def ring_curve(name, pts, closed=True, bevel=0.006, y=FY - 0.003):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = bevel; cu.bevel_resolution = 2
    s = cu.splines.new('POLY'); s.points.add(len(pts) - 1)
    for p, (x, z) in zip(s.points, pts): p.co = (x, y, z, 1)
    s.use_cyclic_u = closed
    ob = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(ob); ob.data.materials.append(gold)
    parts.append(ob); return ob


# gilt frames on the cover
for k, inset in enumerate((0.11, 0.17)):
    x0, z0 = W / 2 - inset, H / 2 - inset
    ring_curve('Frame' + str(k), [(-x0 + 0.02, -z0), (x0 + 0.02, -z0), (x0 + 0.02, z0), (-x0 + 0.02, z0)], bevel=0.007 if k == 0 else 0.004)
# corner diamonds
for sx in (-1, 1):
    for sz in (-1, 1):
        d = cube('Diamond', (0.055, 0.012, 0.055), (sx * (W / 2 - 0.17) + 0.02, FY - 0.006, sz * (H / 2 - 0.17)), bevel=0.004, segs=2, mat_=gold)
        d.rotation_euler = (0, math.radians(45), 0); parts.append(d)
# the emblem: a sunburst ring and an open eye
EZ = 0.42
ring_curve('EmblemRing', [(0.02 + 0.27 * math.cos(t * math.pi / 32), EZ + 0.27 * math.sin(t * math.pi / 32)) for t in range(64)], bevel=0.008)
for i in range(16):
    ang = i * math.pi / 8
    r0, r1 = (0.31, 0.4) if i % 2 == 0 else (0.31, 0.35)
    ring_curve('Ray' + str(i), [(0.02 + r0 * math.cos(ang), EZ + r0 * math.sin(ang)), (0.02 + r1 * math.cos(ang), EZ + r1 * math.sin(ang))], closed=False, bevel=0.006)
eye = [(0.02 + 0.17 * math.cos(t * math.pi / 24), EZ + 0.095 * math.sin(t * math.pi / 24) * abs(math.sin(t * math.pi / 24)) ** 0.35) for t in range(48)]
ring_curve('Eye', eye, bevel=0.007)
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.055, depth=0.016, location=(0.02, FY - 0.006, EZ), rotation=(math.radians(90), 0, 0))
pu = bpy.context.object; pu.data.materials.append(gold); bpy.ops.object.shade_smooth(); parts.append(pu)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, location=(0.02, FY - 0.016, EZ))
ps = bpy.context.object; ps.data.materials.append(iron); parts.append(ps)
# the concept, the rule and the name
cw = c['concept'].upper()
tsize = min(0.36, 1.15 / max(3, len(cw) * 0.62))
title = add_text(cw, 'BodoniModa-SemiBold.ttf', size=tsize, extrude=0.008, bevel=0.002, mat_=gold, name='Title')
title.rotation_euler = (math.radians(90), 0, 0); title.location = (0.02, FY - 0.002, -0.24); parts.append(title)
parts.append(cube('Rule', (0.62, 0.008, 0.008), (0.02, FY - 0.004, -0.44), mat_=gold))
nm = add_text(c['name'], 'BodoniModa-Regular.ttf', size=0.1, extrude=0.004, mat_=gold, name='Name')
nm.rotation_euler = (math.radians(90), 0, 0); nm.location = (0.02, FY - 0.002, -0.56); parts.append(nm)
# clasp: a strap round the fore-edge and a gold lock plate on the cover
parts.append(cube('Strap', (0.36, T + 0.035, 0.2), (W / 2 - 0.12, 0, -0.62), bevel=0.012, mat_=leather_dark))
parts.append(cube('Plate', (0.17, 0.03, 0.27), (W / 2 - 0.25, FY - 0.03, -0.62), bevel=0.02, mat_=gold))
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.026, depth=0.02, location=(W / 2 - 0.25, FY - 0.046, -0.58), rotation=(math.radians(90), 0, 0))
kh = bpy.context.object; kh.data.materials.append(iron); parts.append(kh)
parts.append(cube('KeySlot', (0.018, 0.02, 0.07), (W / 2 - 0.25, FY - 0.046, -0.635), mat_=iron))
# ribbon bookmark hanging from the bottom
bpy.ops.mesh.primitive_plane_add(size=1, location=(0.42, 0.02, -H / 2 - 0.22))
rb = bpy.context.object; rb.scale = (0.075, 1, 0.5); rb.rotation_euler = (math.radians(90), math.radians(4), 0)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
sol = rb.modifiers.new('Solid', 'SOLIDIFY'); sol.thickness = 0.006
rb.data.materials.append(ribbon_m); parts.append(rb)

for p in parts:
    p.parent = root

# ---------- floor, camera, lights ----------
camera((-2.7, -6.4, 0.85), (0.05, 0, -0.08), lens=58)
area_light('Key', (-3.2, -4.2, 3.4), (0, 0, 0), 300, '#ffd9a0', size=2.4)
area_light('Rim', (3.4, 3.2, 1.8), (0, 0, 0.2), 900, GOLD, size=2.0)
area_light('Fill', (3.5, -4.0, -0.4), (0, 0, 0), 90, '#8a6a4a', size=4.0)
area_light('Glint', (0.6, -3.0, 4.2), (0, 0, 0.4), 260, '#fff1c8', size=0.8)
try: glare(sc, threshold=1.0, size=6)
except Exception as e: print('glare skipped:', e)

# ---------- motion: a slow sway and float that loops exactly ----------
key_every_frame(root, a.frames, lambda t: {
    'rotation_euler': (math.radians(2.0 * math.sin(2 * math.pi * t)), 0, math.radians(16 + 18 * math.sin(2 * math.pi * t))),
    'location': (0, 0, 0.06 * math.sin(4 * math.pi * t)),
})

render(sc, 'book', a)
