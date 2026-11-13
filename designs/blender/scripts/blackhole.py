"""Sils: a black hole, no text. A shader-driven accretion disk (differential rotation, Doppler-bright on one side,
seamless loop), a lensed copy of the disk standing up behind the hole, and a photon ring.
(The version with letters falling in is blackhole.with-text.py.)"""
import bpy, math, os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

a = args(); c = a.c
sc = reset(a.frames, res=a.res, samples=a.samples, env_color='#3a3048', env_strength=0.3)
ACC = c['acc']
rnd = random.Random(3)
RH, R_IN, R_OUT = 1.0, 1.35, 4.6


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


def disk_material(name='Disk', gain=7.0):
    """Emission swirl in polar coordinates. Angle advances by K * t / r^1.5 (inner gas laps the outer),
    and two copies of the pattern (time t and t-1) are blended by t so the loop has no seam."""
    m = bpy.data.materials.new(name); m.use_nodes = True; blended(m)
    nt = m.node_tree; nt.nodes.remove(nt.nodes['Principled BSDF']); N = nt.nodes.new; L = nt.links.new

    def math_(op, a_=None, b_=None, v1=None, v2=None):
        n = N('ShaderNodeMath'); n.operation = op
        if a_ is not None: L(a_, n.inputs[0])
        elif v1 is not None: n.inputs[0].default_value = v1
        if b_ is not None: L(b_, n.inputs[1])
        elif v2 is not None: n.inputs[1].default_value = v2
        return n.outputs[0]

    tc = N('ShaderNodeTexCoord'); sep = N('ShaderNodeSeparateXYZ'); L(tc.outputs['Object'], sep.inputs[0])
    x, y = sep.outputs['X'], sep.outputs['Y']
    r = math_('SQRT', math_('ADD', math_('MULTIPLY', x, x), math_('MULTIPLY', y, y)))
    ang = math_('ARCTAN2', y, x)
    fr = N('ShaderNodeValue'); fr.label = 'frame'
    d = fr.outputs[0].driver_add('default_value'); d.driver.expression = 'frame'
    t = math_('DIVIDE', math_('SUBTRACT', fr.outputs[0], None, v2=1.0), None, v2=float(a.frames))
    speed = math_('DIVIDE', None, math_('POWER', r, None, v2=1.5), v1=2 * math.pi * 3.0 * R_IN ** 1.5)

    def pattern(time_):
        a2 = math_('ADD', ang, math_('MULTIPLY', speed, time_))
        cx_ = math_('MULTIPLY', math_('COSINE', a2), None, v2=1.6); sy_ = math_('MULTIPLY', math_('SINE', a2), None, v2=1.6)
        comb = N('ShaderNodeCombineXYZ'); L(cx_, comb.inputs[0]); L(sy_, comb.inputs[1]); L(math_('MULTIPLY', r, None, v2=7.0), comb.inputs[2])
        nz = N('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.4; nz.inputs['Detail'].default_value = 8.0; nz.inputs['Roughness'].default_value = 0.6
        L(comb.outputs[0], nz.inputs['Vector'])
        return nz.outputs['Fac']

    pa, pb = pattern(t), pattern(math_('SUBTRACT', t, None, v2=1.0))
    mixv = math_('ADD', math_('MULTIPLY', pa, math_('SUBTRACT', None, t, v1=1.0)), math_('MULTIPLY', pb, t))
    streak = N('ShaderNodeMapRange'); L(mixv, streak.inputs['Value'])
    streak.inputs['From Min'].default_value = 0.35; streak.inputs['From Max'].default_value = 0.75
    # radial profile: hot near the inner edge, fading out at both edges
    rad = N('ShaderNodeMapRange'); L(r, rad.inputs['Value']); rad.inputs['From Min'].default_value = R_IN * 0.92; rad.inputs['From Max'].default_value = R_OUT
    ramp = N('ShaderNodeValToRGB'); el = ramp.color_ramp.elements
    el[0].position = 0.0; el[0].color = (0, 0, 0, 0); el[1].position = 1.0; el[1].color = (*srgb(ACC)[:3], 0)
    e1 = el.new(0.04); e1.color = (1, 0.97, 1, 1); e2 = el.new(0.16); e2.color = (*srgb('#d9c8ff')[:3], 1)
    e3 = el.new(0.42); e3.color = (*srgb(ACC)[:3], 0.8); e4 = el.new(0.75); e4.color = (*srgb('#3a2a6a')[:3], 0.3)
    L(rad.outputs['Result'], ramp.inputs['Fac'])
    # Doppler beaming: the side coming toward the camera is brighter
    dop = math_('ADD', math_('MULTIPLY', math_('COSINE', ang), None, v2=0.65), None, v2=1.0)
    strength = math_('MULTIPLY', math_('MULTIPLY', streak.outputs['Result'], dop), None, v2=gain)
    em = N('ShaderNodeEmission'); L(ramp.outputs['Color'], em.inputs[0]); L(strength, em.inputs[1])
    alpha = math_('MULTIPLY', ramp.outputs['Alpha'], math_('ADD', math_('MULTIPLY', streak.outputs['Result'], None, v2=0.8), None, v2=0.2))
    tr = N('ShaderNodeBsdfTransparent'); ms = N('ShaderNodeMixShader')
    L(alpha, ms.inputs[0]); L(tr.outputs[0], ms.inputs[1]); L(em.outputs[0], ms.inputs[2])
    L(ms.outputs[0], nt.nodes['Material Output'].inputs[0])
    return m


def annulus(name, r0, r1, m, rot=(0, 0, 0), loc=(0, 0, 0)):
    bpy.ops.mesh.primitive_circle_add(vertices=256, radius=r1, fill_type='NGON', location=loc, rotation=rot)
    ob = bpy.context.object; ob.name = name
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.inset(thickness=r1 - r0); bpy.ops.mesh.delete(type='FACE')
    bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.subdivide(number_cuts=2); bpy.ops.object.mode_set(mode='OBJECT')
    ob.data.materials.append(m)
    return ob


disk_m = disk_material()
# the disk itself, flat, seen nearly edge-on
annulus('Disk', R_IN, R_OUT, disk_m)
# its lensed image: the far side of the disk, bent up over the top and down under the bottom of the hole
lens = annulus('Lensed', RH * 1.16, RH * 1.62, disk_material('Lens', 3.2), rot=(math.radians(90), 0, 0), loc=(0, 0.6, 0))
# horizon and photon ring
bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=RH)
hz = bpy.context.object; hz.data.materials.append(mat('Horizon', '#000000', rough=1.0)); bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_torus_add(major_radius=RH * 1.04, minor_radius=0.012, major_segments=192, minor_segments=8, rotation=(math.radians(90), 0, 0), location=(0, -0.02, 0))
bpy.context.object.data.materials.append(emit_mat('PhotonRing', '#ffffff', 12.0))

# ---------- stars ----------
star_m = emit_mat('Star', '#f1e6cf', 3.0)
for i in range(240):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rnd.uniform(0.01, 0.03), location=(rnd.uniform(-14, 14), rnd.uniform(5, 14), rnd.uniform(-9, 9)))
    bpy.context.object.data.materials.append(star_m)

camera((0, -12.5, 1.9), (0, 0, 0.05), lens=46)
render(sc, 'blackhole', a)
