"""Moinera: a living slime. Metaballs merge and split as they drift on looping paths, so the mass is
always rearranging. Glossy, translucent, glowing faintly from inside, with a marbled swirl of her
colour, bone and ink moving through it."""
import bpy, math, os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

a = args(); c = a.c
sc = reset(a.frames, res=a.res, samples=a.samples, env_color='#8a6a90', env_strength=1.1)
ACC = c['acc']
rnd = random.Random(11)

# ---------- material ----------
m = mat('Slime', ACC, rough=0.06)
b = bsdf(m)
for k, v in (('Transmission Weight', 0.75), ('Subsurface Weight', 0.25), ('Subsurface Scale', 0.4), ('Coat Weight', 0.6), ('Coat Roughness', 0.05), ('IOR', 1.38)):
    if k in b.inputs: b.inputs[k].default_value = v
if 'Subsurface Radius' in b.inputs: b.inputs['Subsurface Radius'].default_value = (1.0, 0.45, 0.8)
# a marbled swirl, drifting with time (looped by moving around a circle in 4D noise space)
tc = node(m, 'ShaderNodeTexCoord')
fr = node(m, 'ShaderNodeValue'); drv = fr.outputs[0].driver_add('default_value'); drv.driver.expression = 'frame'
ang = node(m, 'ShaderNodeMath', operation='MULTIPLY'); m.node_tree.links.new(fr.outputs[0], ang.inputs[0]); ang.inputs[1].default_value = 2 * math.pi / a.frames
cosn = node(m, 'ShaderNodeMath', operation='COSINE'); link(m, ang.outputs[0], cosn.inputs[0])
nz = node(m, 'ShaderNodeTexNoise', Scale=1.2, Detail=4.0); nz.noise_dimensions = '4D'
link(m, cosn.outputs[0], nz.inputs['W'])
add = node(m, 'ShaderNodeVectorMath', operation='ADD'); scl = node(m, 'ShaderNodeVectorMath', operation='SCALE'); scl.inputs['Scale'].default_value = 1.6
link(m, nz.outputs['Color'], scl.inputs[0]); link(m, tc.outputs['Object'], add.inputs[0]); link(m, scl.outputs[0], add.inputs[1])
wv = node(m, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='Z', Scale=0.9, Distortion=11.0, Detail=6.0, **{'Detail Roughness': 0.7})
link(m, add.outputs[0], wv.inputs['Vector'])
rp = node(m, 'ShaderNodeValToRGB'); el = rp.color_ramp.elements
el[0].position = 0.3; el[0].color = srgb('#5a1f4c'); el[1].position = 0.75; el[1].color = srgb(ACC)
e2 = el.new(0.5); e2.color = srgb('#f6dcea'); e3 = el.new(0.6); e3.color = srgb(ACC)
marb = node(m, 'ShaderNodeTexNoise', Scale=1.3, Detail=9.0, Distortion=4.5); marb.noise_dimensions = '4D'
link(m, add.outputs[0], marb.inputs['Vector']); link(m, cosn.outputs[0], marb.inputs['W'])
link(m, marb.outputs['Fac'], rp.inputs['Fac']); link(m, rp.outputs['Color'], b.inputs['Base Color'])
if 'Emission Color' in b.inputs:
    link(m, rp.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = 0.35

# ---------- metaballs ----------
mb = bpy.data.metaballs.new('Slime'); mb.resolution = 0.06; mb.render_resolution = 0.035; mb.threshold = 0.6
ob = bpy.data.objects.new('Slime', mb); bpy.context.collection.objects.link(ob); ob.data.materials.append(m)
balls = []
for i in range(13):
    e = mb.elements.new(); e.radius = rnd.uniform(0.75, 1.15); e.stiffness = 2.0
    # each ball loops on its own small Lissajous path; integer frequencies so the whole loop is seamless
    fx, fy, fz = rnd.choice((1, 2)), rnd.choice((1, 2, 3)), rnd.choice((1, 2))
    px, py, pz = (rnd.uniform(0, 2 * math.pi) for _ in range(3))
    ax, ay, az = rnd.uniform(0.45, 0.95), rnd.uniform(0.25, 0.55), rnd.uniform(0.3, 0.7)
    balls.append((e, fx, fy, fz, px, py, pz, ax, ay, az))
# droplets that pull away and fall back in
for i in range(4):
    e = mb.elements.new(); e.radius = rnd.uniform(0.3, 0.45); e.stiffness = 2.0
    balls.append((e, 1, 1, 2, rnd.uniform(0, 6.28), rnd.uniform(0, 6.28), rnd.uniform(0, 6.28), rnd.uniform(1.2, 1.6), 0.4, rnd.uniform(0.8, 1.1)))

for f in range(1, a.frames + 1):
    t = (f - 1) / a.frames * 2 * math.pi
    for e, fx, fy, fz, px, py, pz, ax, ay, az in balls:
        e.co = (ax * math.sin(fx * t + px), ay * math.sin(fy * t + py), az * math.sin(fz * t + pz))
        e.keyframe_insert('co', frame=f)
# keep it turning slowly too
key_every_frame(ob, a.frames, lambda t: {'rotation_euler': (0, 0, 2 * math.pi * t)})

# a dim pool of her colour under it

camera((0, -7.0, 1.2), (0, 0, 0), lens=46)
area_light('Key', (-3.5, -4, 4), (0, 0, 0), 600, '#fff0f6', size=3)
area_light('Rim', (3.5, 3.5, 2.5), (0, 0, 0), 1100, ACC, size=3)
area_light('Under', (0, -2, -1.2), (0, 0, 0), 120, ACC, size=2)
render(sc, 'slime', a)
