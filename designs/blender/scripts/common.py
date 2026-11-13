"""Shared helpers for the Epitaph Blender scenes.

Every scene script is run headless:
    blender -b --factory-startup -P scripts/<scene>.py -- --char <key> [--still] [--frames N]
It reads the character from chars.json, builds the scene from nothing, renders PNG frames
to renders/<scene>-<char>/ and (unless --still) encodes a looping .webm and .mp4.
"""
import bpy, json, math, os, subprocess, sys, argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, 'fonts')
PANEL = '#0e0a05'


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--char', required=True)
    p.add_argument('--still', action='store_true', help='render one frame only, for checking')
    p.add_argument('--frame', type=int, default=1, help='which frame the still shows')
    p.add_argument('--frames', type=int, default=144)
    p.add_argument('--samples', type=int, default=48)
    p.add_argument('--res', type=float, default=1.0, help='resolution scale')
    p.add_argument('--cut', action='store_true', help='one transparent PNG (no background) for thumbnails')
    a = p.parse_args(argv)
    with open(os.path.join(ROOT, 'chars.json'), encoding='utf-8') as f:
        a.c = json.load(f)[a.char]
    return a


def srgb(hexs, a=1.0):
    """'#rrggbb' -> linear RGBA, which is what Blender colour sockets expect."""
    h = hexs.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, a)


def reset(frames, fps=24, res=1.0, samples=48, env_color='#a07a48', env_strength=0.8):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = int(900 * res) // 2 * 2, int(616 * res) // 2 * 2
    sc.render.fps = fps
    sc.frame_start, sc.frame_end = 1, frames
    sc.eevee.taa_render_samples = samples
    try:
        sc.eevee.use_raytracing = True
        sc.eevee.use_shadows = True
    except AttributeError:
        pass
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.render.image_settings.file_format = 'PNG'
    # the world: the hero panel's ink colour, so the render sits in the frame with no seam
    w = bpy.data.worlds.new('World'); sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes['Background']
    bg.inputs[0].default_value = srgb(PANEL)
    bg.inputs[1].default_value = 1.0
    # what metal and gloss reflect: a warm studio gradient. The camera never sees it (it sees the panel colour).
    env = nt.nodes.new('ShaderNodeBackground'); env.inputs[1].default_value = env_strength
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.35; ramp.color_ramp.elements[0].color = srgb('#120a05')
    ramp.color_ramp.elements[1].position = 0.75; ramp.color_ramp.elements[1].color = srgb(env_color)
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = -1; mr.inputs['From Max'].default_value = 1
    nt.links.new(tc.outputs['Generated'], sep.inputs[0]); nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], env.inputs[0])
    lp = nt.nodes.new('ShaderNodeLightPath'); mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs[0]); nt.links.new(env.outputs[0], mix.inputs[1]); nt.links.new(bg.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], nt.nodes['World Output'].inputs[0])
    return sc


def glare(sc, threshold=0.8, size=7, mix=0.0):
    """Soft bloom on the brightest parts (gold glints, glowing rims), done in the compositor."""
    sc.use_nodes = True
    nt = sc.compositing_node_tree if hasattr(sc, 'compositing_node_tree') and sc.compositing_node_tree else sc.node_tree
    rl = nt.nodes.get('Render Layers') or nt.nodes.new('CompositorNodeRLayers')
    comp = nt.nodes.get('Composite') or nt.nodes.new('CompositorNodeComposite')
    g = nt.nodes.new('CompositorNodeGlare')
    for k, v in (('glare_type', 'FOG_GLOW'), ('threshold', threshold), ('size', size), ('mix', mix)):
        try: setattr(g, k, v)
        except Exception: pass
    for name, v in (('Threshold', threshold), ('Size', size / 9)):
        if name in g.inputs: g.inputs[name].default_value = v
    nt.links.new(rl.outputs['Image'], g.inputs[0])
    nt.links.new(g.outputs[0], comp.inputs[0])


def mat(name, base='#808080', metal=0.0, rough=0.5, emit=None, emit_strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(base)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = srgb(emit)
        b.inputs['Emission Strength'].default_value = emit_strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    return m


def node(m, kind, **kw):
    n = m.node_tree.nodes.new(kind)
    for k, v in kw.items():
        if k in n.inputs: n.inputs[k].default_value = v
        else: setattr(n, k, v)
    return n


def link(m, a, b):
    m.node_tree.links.new(a, b)


def bsdf(m):
    return m.node_tree.nodes['Principled BSDF']


def add_text(body, font_file, size=1.0, extrude=0.0, align='CENTER', valign='CENTER', bevel=0.0, mat_=None, name=None):
    cu = bpy.data.curves.new(name or 'Text', 'FONT')
    cu.body = body
    cu.font = bpy.data.fonts.load(os.path.join(FONTS, font_file), check_existing=True)
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = bevel
    cu.align_x = align
    cu.align_y = valign
    ob = bpy.data.objects.new(name or 'Text', cu)
    bpy.context.collection.objects.link(ob)
    if mat_: ob.data.materials.append(mat_)
    return ob


def cube(name, size, loc=(0, 0, 0), bevel=0.0, segs=3, mat_=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object; ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = ob.modifiers.new('Bevel', 'BEVEL'); mod.width = bevel; mod.segments = segs
        bpy.ops.object.shade_smooth()
    if mat_: ob.data.materials.append(mat_)
    return ob


def camera(loc, target, lens=50):
    bpy.ops.object.camera_add(location=loc)
    cam = bpy.context.object; cam.data.lens = lens
    t = bpy.data.objects.new('CamTarget', None); bpy.context.collection.objects.link(t); t.location = target
    c = cam.constraints.new('TRACK_TO'); c.target = t; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    bpy.context.scene.camera = cam
    return cam


def area_light(name, loc, target, energy, color='#ffffff', size=2.0):
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.object; l.name = name
    l.data.energy = energy; l.data.size = size; l.data.color = srgb(color)[:3]
    t = bpy.data.objects.new(name + 'T', None); bpy.context.collection.objects.link(t); t.location = target
    c = l.constraints.new('TRACK_TO'); c.target = t; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    return l


def key_every_frame(ob, frames, fn):
    """fn(t) with t in [0, 1) -> dict of {'location': (...), 'rotation_euler': (...), 'scale': (...)}.
    Keyed on every frame with linear interpolation, so loops are exact."""
    for f in range(1, frames + 1):
        t = (f - 1) / frames
        for prop, val in fn(t).items():
            setattr(ob, prop, val)
            ob.keyframe_insert(prop, frame=f)
    if ob.animation_data and ob.animation_data.action:
        try:
            for fc in ob.animation_data.action.fcurves:
                for k in fc.keyframe_points: k.interpolation = 'LINEAR'
        except AttributeError:  # Blender 5 layered actions
            for layer in ob.animation_data.action.layers:
                for strip in layer.strips:
                    for bag in strip.channelbags:
                        for fc in bag.fcurves:
                            for k in fc.keyframe_points: k.interpolation = 'LINEAR'


def render(sc, scene_name, a):
    out = os.path.join(ROOT, 'renders', f'{scene_name}-{a.char}')
    os.makedirs(out, exist_ok=True)
    if a.cut:
        # a thumbnail with no background: transparent film, RGBA PNG
        sc.render.film_transparent = True
        sc.render.image_settings.color_mode = 'RGBA'
        sc.frame_set(a.frame)
        sc.render.filepath = os.path.join(ROOT, 'renders', f'{scene_name}-{a.char}-cut.png')
        bpy.ops.render.render(write_still=True)
        print('CUT', sc.render.filepath)
        return
    if a.still:
        sc.frame_set(a.frame)
        sc.render.filepath = os.path.join(out, f'still-{a.frame:04d}.png')
        bpy.ops.render.render(write_still=True)
        print('STILL', sc.render.filepath)
        return
    sc.render.filepath = os.path.join(out, 'f_')
    bpy.ops.render.render(animation=True)
    fps = sc.render.fps
    pat = os.path.join(out, 'f_%04d.png')
    webm = os.path.join(ROOT, 'renders', f'{scene_name}-{a.char}.webm')
    mp4 = os.path.join(ROOT, 'renders', f'{scene_name}-{a.char}.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', pat, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-row-mt', '1', '-pix_fmt', 'yuv420p', webm], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', pat, '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], check=True)
    # a poster frame for the page while the video loads
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(out, 'f_0001.png'), '-q:v', '4', os.path.join(ROOT, 'renders', f'{scene_name}-{a.char}.jpg')], check=True)
    print('VIDEO', webm, os.path.getsize(webm), mp4, os.path.getsize(mp4))
