"""Universe: a slow-turning system (the fixed version is universe.fixed.py). An eclipsed central mass with a corona and the name circling it,
five worlds held in place on faint orbit rings, each turning on its own axis.
Each world is one of the other characters, textured after its sphere style on the type page."""
import bpy, math, os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import json

a = args(); c = a.c
with open(os.path.join(ROOT, 'chars.json'), encoding='utf-8') as f:
    ALL = json.load(f)
sc = reset(a.frames, res=a.res, samples=a.samples, env_color='#5a4a3a', env_strength=0.4)
rnd = random.Random(7)
ACC = c['acc']


def blended(m):
    for attr, v in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
        try: setattr(m, attr, v)
        except Exception: pass
    return m


def emit_mat(name, color, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.remove(nt.nodes['Principled BSDF'])
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = srgb(color); e.inputs[1].default_value = strength
    nt.links.new(e.outputs[0], nt.nodes['Material Output'].inputs[0])
    return m


def sphere(name, r, loc, m, seg=96):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r, location=loc)
    ob = bpy.context.object; ob.name = name; bpy.ops.object.shade_smooth(); ob.data.materials.append(m)
    return ob


# ---------- planet materials, one per sphere style ----------
def lit_mat(acc):          # Sils: a pale cratered moon with a hint of his colour
    m = mat('Lit', '#7a7482', rough=0.85)
    v = node(m, 'ShaderNodeTexVoronoi', Scale=7.0); b = node(m, 'ShaderNodeBump', Strength=0.6)
    link(m, v.outputs['Distance'], b.inputs['Height']); link(m, b.outputs['Normal'], bsdf(m).inputs['Normal'])
    nz = node(m, 'ShaderNodeTexNoise', Scale=4.0, Detail=6.0); rp = node(m, 'ShaderNodeValToRGB')
    rp.color_ramp.elements[0].color = srgb('#2a2730'); rp.color_ramp.elements[1].color = srgb('#a49cb0')
    link(m, nz.outputs['Fac'], rp.inputs['Fac']); link(m, rp.outputs['Color'], bsdf(m).inputs['Base Color'])
    return m


def marble_mat(acc, seed=1.0):  # Moinera: bone, ink and her colour swirled together
    m = mat('Marble', '#ffffff', rough=0.35)
    tc = node(m, 'ShaderNodeTexCoord'); nz = node(m, 'ShaderNodeTexNoise', Scale=1.6, Detail=4.0)
    nz.noise_dimensions = '4D'; nz.inputs['W'].default_value = seed
    mixv = node(m, 'ShaderNodeVectorMath', operation='ADD')
    sc_ = node(m, 'ShaderNodeVectorMath', operation='SCALE'); sc_.inputs['Scale'].default_value = 1.4
    link(m, nz.outputs['Color'], sc_.inputs[0]); link(m, tc.outputs['Object'], mixv.inputs[0]); link(m, sc_.outputs[0], mixv.inputs[1])
    wv = node(m, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='Z', Scale=2.2, Distortion=6.0, Detail=3.0)
    link(m, mixv.outputs[0], wv.inputs['Vector'])
    rp = node(m, 'ShaderNodeValToRGB'); el = rp.color_ramp.elements
    el[0].position = 0.0; el[0].color = srgb('#0e0a05'); el[1].position = 0.45; el[1].color = srgb('#f1e6cf')
    e2 = el.new(0.62); e2.color = srgb(acc); e3 = el.new(0.8); e3.color = srgb('#0e0a05')
    link(m, wv.outputs['Fac'], rp.inputs['Fac']); link(m, rp.outputs['Color'], bsdf(m).inputs['Base Color'])
    return m


def banded_mat(acc):        # Antholonious: a gas giant in gold and brown bands
    m = mat('Banded', '#ffffff', rough=0.5)
    wv = node(m, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='Z', Scale=3.0, Distortion=3.0, Detail=4.0)
    rp = node(m, 'ShaderNodeValToRGB'); el = rp.color_ramp.elements
    el[0].color = srgb('#2a2219'); el[1].color = srgb('#e8d2a0'); e2 = el.new(0.5); e2.color = srgb(acc); e3 = el.new(0.75); e3.color = srgb('#5e5040')
    link(m, wv.outputs['Fac'], rp.inputs['Fac']); link(m, rp.outputs['Color'], bsdf(m).inputs['Base Color'])
    return m


def core_mat(acc):          # Orin: a hot marbled core
    m = marble_mat(acc, seed=4.0)
    bsdf(m).inputs['Emission Color'].default_value = srgb(acc); bsdf(m).inputs['Emission Strength'].default_value = 0.6
    return m


def teal_mat(acc):          # Nera: deep sea-glass worlds
    m = mat('Teal', acc, rough=0.3)
    nz = node(m, 'ShaderNodeTexNoise', Scale=3.0, Detail=8.0); rp = node(m, 'ShaderNodeValToRGB')
    rp.color_ramp.elements[0].color = srgb('#0b1311'); rp.color_ramp.elements[1].color = srgb(acc)
    link(m, nz.outputs['Fac'], rp.inputs['Fac']); link(m, rp.outputs['Color'], bsdf(m).inputs['Base Color'])
    return m


line_m = blended(emit_mat('OrbitLine', '#f1e6cf', 0.25))
label_m = emit_mat('Label', '#f1e6cf', 1.2)

# ---------- the central mass: an eclipse ----------
core = sphere('Core', 1.05, (0, 0, 0), mat('CoreBlack', '#000000', rough=1.0))
corona = bpy.data.materials.new('Corona'); corona.use_nodes = True; blended(corona)
nt = corona.node_tree; nt.nodes.remove(nt.nodes['Principled BSDF'])
tc = nt.nodes.new('ShaderNodeTexCoord'); ln = nt.nodes.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'
mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 1.02; mr.inputs['From Max'].default_value = 2.0
rp = nt.nodes.new('ShaderNodeValToRGB'); el = rp.color_ramp.elements
el[0].position = 0.0; el[0].color = (1, 0.95, 0.85, 1); el[1].position = 1.0; el[1].color = (*srgb(ACC)[:3], 0)
e2 = el.new(0.05); e2.color = (*srgb('#ffb238')[:3], 0.9); e3 = el.new(0.18); e3.color = (*srgb(ACC)[:3], 0.35); e4 = el.new(0.5); e4.color = (*srgb(ACC)[:3], 0.06)
nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 5.0; nz.inputs['Detail'].default_value = 10.0; nz.inputs['Distortion'].default_value = 2.0
st = nt.nodes.new('ShaderNodeMapRange'); st.inputs['From Min'].default_value = 0.35; st.inputs['From Max'].default_value = 0.7; st.inputs['To Min'].default_value = 0.2
mixc = nt.nodes.new('ShaderNodeMath'); mixc.operation = 'MULTIPLY'
emis = nt.nodes.new('ShaderNodeEmission'); emis.inputs[1].default_value = 5.0
tr = nt.nodes.new('ShaderNodeBsdfTransparent'); ms = nt.nodes.new('ShaderNodeMixShader')
nt.links.new(tc.outputs['Object'], ln.inputs[0]); nt.links.new(ln.outputs['Value'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], rp.inputs['Fac'])
nt.links.new(tc.outputs['Object'], nz.inputs['Vector']); nt.links.new(nz.outputs['Fac'], st.inputs['Value'])
nt.links.new(rp.outputs['Color'], emis.inputs[0]); nt.links.new(rp.outputs['Alpha'], mixc.inputs[0]); nt.links.new(st.outputs['Result'], mixc.inputs[1])
nt.links.new(mixc.outputs[0], ms.inputs[0]); nt.links.new(tr.outputs[0], ms.inputs[1]); nt.links.new(emis.outputs[0], ms.inputs[2])
nt.links.new(ms.outputs[0], nt.nodes['Material Output'].inputs[0])
bpy.ops.mesh.primitive_plane_add(size=5.0, location=(0, 0.3, 0), rotation=(math.radians(90), 0, 0))
cp = bpy.context.object; cp.name = 'CoronaCard'; cp.data.materials.append(corona)

# ---------- orbit plane ----------
TILT = math.radians(16)   # orbit plane tilted toward the camera
sysroot = bpy.data.objects.new('System', None); bpy.context.collection.objects.link(sysroot)
sysroot.rotation_euler = (TILT, math.radians(-10), 0)
worlds = [('sils', 2.0, 200, 0.26, lit_mat), ('moinera', 2.85, 325, 0.46, marble_mat), ('antholonious', 3.75, 150, 0.36, banded_mat),
          ('orin', 4.55, 28, 0.32, core_mat), ('nera', 5.35, 250, 0.3, teal_mat)]
spinners = []
orbiters = []
for i, (key, R, deg, size, mk) in enumerate(worlds):
    ch = ALL[key]
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=0.006, major_segments=256, minor_segments=6)
    ring = bpy.context.object; ring.data.materials.append(line_m); ring.parent = sysroot
    ang = math.radians(deg)
    holder = bpy.data.objects.new('Hold_' + key, None); bpy.context.collection.objects.link(holder)
    holder.parent = sysroot; holder.location = (R * math.cos(ang), R * math.sin(ang), 0)
    orbiters.append((holder, R, ang))
    holder.rotation_euler = (-TILT, 0, 0)           # undo the plane tilt so each world stands upright
    spin = bpy.data.objects.new('Spin_' + key, None); bpy.context.collection.objects.link(spin); spin.parent = holder
    spin.rotation_euler = (math.radians(14), 0, 0)
    turner = bpy.data.objects.new('Turn_' + key, None); bpy.context.collection.objects.link(turner); turner.parent = spin
    if key == 'nera':
        for k, (off, rr) in enumerate(((-0.22, size * 0.75), (0.3, size * 0.42))):
            p = sphere('Nera' + str(k), rr, (0, 0, 0), mk(ch['acc'])); p.parent = turner; p.location = (off, 0, 0)
    else:
        p = sphere('P_' + key, size, (0, 0, 0), mk(ch['acc'])); p.parent = turner
    if key == 'antholonious':
        rm = blended(mat('Ring', '#e8d2a0', rough=0.4, alpha=0.75))
        bpy.ops.mesh.primitive_circle_add(vertices=128, radius=size * 2.1, fill_type='NGON')
        disc = bpy.context.object
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.inset(thickness=size * 0.7); bpy.ops.mesh.delete(type='FACE'); bpy.ops.object.mode_set(mode='OBJECT')
        disc.data.materials.append(rm); disc.parent = holder; disc.rotation_euler = (math.radians(16), math.radians(-12), 0)
    if key == 'orin':
        for k in range(2):
            bpy.ops.mesh.primitive_torus_add(major_radius=size * 1.7, minor_radius=0.008, major_segments=128, minor_segments=6)
            t = bpy.context.object; t.data.materials.append(line_m); t.parent = spin; t.rotation_euler = (math.radians(70), math.radians(30 + k * 60), 0)
    spinners.append(turner)

# ---------- stars ----------
star_m = emit_mat('Star', '#f1e6cf', 3.0)
for i in range(220):
    th, ph = rnd.uniform(0, 2 * math.pi), rnd.uniform(-1, 1)
    x, z = rnd.uniform(-16, 16), rnd.uniform(-10, 10)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rnd.uniform(0.012, 0.035), location=(x, rnd.uniform(6, 14), z))
    bpy.context.object.data.materials.append(star_m)

camera((0, -15.5, 2.6), (0, 0, -0.2), lens=38)
area_light('Key', (-6, -8, 5), (0, 0, 0), 2500, '#ffe2b8', size=6)
area_light('Rim', (6, 6, 3), (0, 0, 0), 1500, ACC, size=6)

# ---------- motion: every world turns once per loop (the binary pair turns twice), the name ring once ----------
for i, t_ob in enumerate(spinners):
    turns = 2 if t_ob.name.endswith('nera') else 1
    direction = -1 if i % 2 else 1
    key_every_frame(t_ob, a.frames, lambda t, d=direction, n=turns: {'rotation_euler': (0, 0, d * n * 2 * math.pi * t)})

# every world travels one full orbit per loop, all at the same angular speed, so the gaps between them never
# change and none of them can pass in front of or touch another
for holder, R, ang in orbiters:
    key_every_frame(holder, a.frames, lambda t, R=R, ang=ang: {'location': (R * math.cos(ang + 2 * math.pi * t), R * math.sin(ang + 2 * math.pi * t), 0)})

render(sc, 'universe', a)
