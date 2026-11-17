"""Sword shapes for the map pins: every shape in one file, assets/atlas3d/pins/swords.glb.
Same layout as the jade greatsword (greatsword.glb): blade tip at the origin, blade up +Y in three.js (+Z here),
guard at y = 0.63, hilt above. Material slots by name, filled in by pins.js: blade, iron (guard), iron_light (pommel and
knobs), band (rings), grip. Each shape is one object named after it.

  falchion (Nera) · stiletto (Yona) · zweihander (Gaia) · executioner (Val) · sabre (Vale) · flamberge (Grisha)
  khopesh (Sils) · estoc (Antholonious) · scimitar (Moinera) · gladius (Lithia)
  kept for future characters: katana · rapier · sawback

Run:  blender -b --factory-startup -P tools/map/sword_shapes.py -- [OUT.glb] [sheet.png]
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'atlas3d', 'pins', 'swords.glb')
SHEET = argv[1] if len(argv) > 1 else None
G = 0.63
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
MATS = {}
for n, c in [('blade', (.75, .78, .8)), ('iron', (.2, .2, .22)), ('iron_light', (.4, .4, .42)), ('band', (.5, .48, .45)), ('grip', (.15, .1, .07))]:
    m = bpy.data.materials.new(n); m.use_nodes = True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*c, 1); MATS[n] = m
SLOT = {n: i for i, n in enumerate(MATS)}


class Shape:
    def __init__(self): self.bm = bmesh.new()

    def face(self, vs, mat):
        try: f = self.bm.faces.new(vs); f.material_index = SLOT[mat]; f.smooth = mat != 'blade'
        except ValueError: pass

    # ---------- the blade: a sweep along a 2D centerline (x, z) from the guard (t=0) to the tip (t=1)
    def blade(self, path, halfw, thick, single=False, end='point', n=72, edge=1):
        pts = [Vector(path(i / n)) for i in range(n + 1)]
        rings = []
        for i in range(n + 1):
            t = i / n
            a, b = pts[max(0, i - 1)], pts[min(n, i + 1)]
            tg = (b - a).normalized(); nx, nz = -tg.y * edge, tg.x * edge       # in-plane normal (toward the edge side: the outside of a curve)
            w, th = halfw(t), thick(t)
            if single:      # spine on the -normal side, edge on the +normal side
                sec = [(-w, -.45), (-w, .45), (.15, .5), (.62, .32), (1.0, 0), (.62, -.32), (.15, -.5)]
                sec = [((-w if x == -w else x * w), y * th) for x, y in sec]
            else:
                pw, be = .22, .16
                sec = [(-w, 0), (-w + be * w * 2, .38 * th), (-pw * w, .5 * th), (pw * w, .5 * th), (w - be * w * 2, .38 * th), (w, 0),
                       (w - be * w * 2, -.38 * th), (pw * w, -.5 * th), (-pw * w, -.5 * th), (-w + be * w * 2, -.38 * th)]
            c = pts[i]
            rings.append([self.bm.verts.new((c.x + nx * u, y, c.y + nz * u)) for u, y in sec])
        k = len(rings[0])
        last = n if end == 'point' else n + 1
        for i in range(last - 1 if end == 'point' else n):
            for j in range(k):
                self.face([rings[i][j], rings[i][(j + 1) % k], rings[i + 1][(j + 1) % k], rings[i + 1][j]], 'blade')
        if end == 'point':
            tip = self.bm.verts.new((pts[-1].x, 0, pts[-1].y))
            for j in range(k): self.face([rings[n - 1][j], rings[n - 1][(j + 1) % k], tip], 'blade')
        else:
            self.face(list(reversed(rings[n])), 'blade')
        self.face(rings[0], 'blade')

    # ---------- turned parts (grip, rings, pommels): a lathe profile [(r, z), ...] around the Z axis
    def lathe(self, prof, mat, z0=G, seg=16, x=0.0, sx=1.0):
        R = []
        for s in range(seg):
            a = 2 * math.pi * s / seg
            R.append([self.bm.verts.new((x + r * math.cos(a) * sx, r * math.sin(a), z0 + z)) for r, z in prof])
        for s in range(seg):
            A, B = R[s], R[(s + 1) % seg]
            for i in range(len(prof) - 1): self.face([A[i], B[i], B[i + 1], A[i + 1]], mat)
        top = self.bm.verts.new((x, 0, z0 + prof[-1][1])); bot = self.bm.verts.new((x, 0, z0 + prof[0][1]))
        for s in range(seg):
            self.face([R[s][-1], R[(s + 1) % seg][-1], top], mat); self.face([R[(s + 1) % seg][0], R[s][0], bot], mat)

    def box(self, c, size, mat):
        r = bmesh.ops.create_cube(self.bm, size=1)
        for v in r['verts']: v.co = Vector((c[0] + v.co.x * size[0], c[1] + v.co.y * size[1], c[2] + v.co.z * size[2]))
        for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = SLOT[mat]; f.smooth = False

    def tube(self, pts, r, mat, seg=8):
        P = [Vector(p) for p in pts]; R = []
        for i, p in enumerate(P):
            tg = (P[min(len(P) - 1, i + 1)] - P[max(0, i - 1)]).normalized()
            u = tg.cross(Vector((0, 1, 0))); u = u.normalized() if u.length > 1e-6 else Vector((1, 0, 0)); w = tg.cross(u)
            R.append([self.bm.verts.new(p + (u * math.cos(2 * math.pi * s / seg) + w * math.sin(2 * math.pi * s / seg)) * r) for s in range(seg)])
        for i in range(len(R) - 1):
            for s in range(seg): self.face([R[i][s], R[i][(s + 1) % seg], R[i + 1][(s + 1) % seg], R[i + 1][s]], mat)

    def spike(self, a, b, r, mat, flat=.45, seg=6):
        A, B = Vector(a), Vector(b); d = B - A
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=seg, radius1=r, radius2=.0006, depth=d.length)
        M = Matrix.Translation((A + B) / 2) @ d.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4() @ Matrix.Diagonal((1, flat, 1, 1))
        for v in res['verts']: v.co = M @ v.co
        for f in {f for v in res['verts'] for f in v.link_faces}: f.material_index = SLOT[mat]; f.smooth = False

    def disc(self, c, r, mat, depth=.004, seg=20):     # a round inset on both faces of a blade (reads as a hole)
        for side in (-1, 1):
            res = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=depth)
            M = Matrix.Translation((c[0], side * c[1], c[2])) @ Matrix.Rotation(math.pi / 2, 4, 'X')
            for v in res['verts']: v.co = M @ v.co
            for f in {f for v in res['verts'] for f in v.link_faces}: f.material_index = SLOT[mat]; f.smooth = True

    def grip(self, length, r, bands=(), r_end=None, z0=G + .03):
        r_end = r_end or r
        prof = [(r, 0), (r * 1.06, length * .15), (r * 1.04, length * .85), (r_end, length)]
        self.lathe(prof, 'grip', z0)
        for f in bands: self.lathe([(r * .98, -.006), (r * 1.25, -.004), (r * 1.25, .004), (r * .98, .006)], 'band', z0 + f * length)
        return z0 + length

    def finish(self, name):
        bmesh.ops.delete(self.bm, geom=[v for v in self.bm.verts if not v.link_faces], context='VERTS')
        me = bpy.data.meshes.new(name); self.bm.to_mesh(me); self.bm.free()
        for m in MATS.values(): me.materials.append(m)
        o = bpy.data.objects.new(name, me); scene.collection.objects.link(o)
        zs = [v.co.z for v in me.vertices]; lo = min(zs)
        low = [v.co for v in me.vertices if v.co.z < lo + 1e-4]; x0 = sum(c.x for c in low) / len(low)
        for v in me.vertices: v.co.z -= lo; v.co.x -= x0                 # the lowest point (where it meets the ground) at the origin
        me.update(); return o


def straight(L=G): return lambda t: (0.0, L * (1 - t))
def taper_tip(w, start=.82, power=.8):
    return lambda t: w(t) * (1 if t < start else max(0.0, (1 - t) / (1 - start)) ** power)

# ---------------------------------------------------------------- the shapes
def falchion():                       # Nera: heavy, single-edged, widening toward a clipped point
    S = Shape()
    S.blade(lambda t: (-.025 * t * t, G * (1 - t)), taper_tip(lambda t: .036 + .03 * t, .86, .6), lambda t: .016 * (1 - .4 * t), single=True)
    S.box((0, 0, G + .012), (.15, .03, .024), 'iron'); S.box((.075, 0, G + .012), (.022, .032, .03), 'iron_light'); S.box((-.075, 0, G + .012), (.022, .032, .03), 'iron_light')
    top = S.grip(.2, .017, bands=(.5,))
    S.lathe([(.018, 0), (.03, .01), (.03, .03), (.012, .04)], 'iron_light', top)
    return S.finish('falchion')

def stiletto():                       # Yona: a thin needle of a dagger, a small round guard
    S = Shape()
    S.blade(straight(), lambda t: .021 * (1 - t) ** .85 + .003, lambda t: .016 * (1 - t * .7))
    S.lathe([(.006, -.005), (.045, -.004), (.045, .004), (.006, .005)], 'iron', G + .005, seg=24)
    top = S.grip(.16, .012, bands=(.0, .5, 1.0))
    S.lathe([(.01, 0), (.02, .012), (.016, .026), (0.002, .032)], 'iron_light', top)
    return S.finish('stiletto')

def zweihander():                     # Gaia: huge, a narrow ricasso with parrying hooks, a long crossguard, a long grip
    S = Shape()
    S.blade(straight(), taper_tip(lambda t: .03 if t < .16 else .052, .84, .9), lambda t: .016)
    for s in (-1, 1):                 # parrying hooks on the ricasso
        S.tube([(s * .03, 0, G - .1), (s * .06, 0, G - .095), (s * .07, 0, G - .07)], .006, 'iron')
        S.tube([(s * .02, 0, G + .012), (s * .12, 0, G + .016), (s * .2, 0, G + .03), (s * .225, 0, G + .055)], .011, 'iron')
        S.lathe([(0, -.012), (.016, -.004), (.016, .004), (0, .012)], 'iron_light', G + .058, x=s * .228)
    S.box((0, 0, G + .012), (.07, .036, .03), 'iron')
    top = S.grip(.32, .018, bands=(.33, .66))
    S.lathe([(.016, 0), (.034, .02), (.03, .045), (.008, .062)], 'iron_light', top)
    return S.finish('zweihander')

def executioner():                    # Val: broad, flat-ended, no point
    S = Shape()
    S.blade(straight(), lambda t: .055 - .004 * t, lambda t: .013, end='flat')
    S.box((0, 0, G + .012), (.17, .028, .022), 'iron')
    top = S.grip(.26, .017, bands=(.5,))
    S.lathe([(.016, 0), (.04, .008), (.04, .026), (.014, .034)], 'iron_light', top)
    return S.finish('executioner')

def sabre():                          # Vale: curved, single-edged, a knuckle guard
    S = Shape()
    S.blade(lambda t: (-.07 * t * t, G * (1 - t)), taper_tip(lambda t: .028, .85, .7), lambda t: .012 * (1 - .3 * t), single=True)
    S.box((0, 0, G + .01), (.08, .03, .018), 'iron'); S.lathe([(0, -.01), (.013, -.003), (.013, .003), (0, .01)], 'iron_light', G + .01, x=-.045)
    top = S.grip(.17, .015, bands=(.0,), r_end=.017)
    S.tube([(.04, 0, G + .012), (.065, 0, G + .06), (.07, 0, G + .12), (.045, 0, top - .005), (.01, 0, top + .01)], .006, 'iron')   # the knuckle guard
    S.lathe([(.017, 0), (.022, .01), (.012, .025)], 'iron_light', top)
    return S.finish('sabre')

def flamberge():                      # Grisha: a wavy, flame-shaped blade
    S = Shape()
    W = 6
    S.blade(lambda t: (.009 * math.sin(2 * math.pi * W * t) * (1 - t), G * (1 - t)),
            taper_tip(lambda t: .04 * (1 + .2 * math.sin(2 * math.pi * W * t + 1.2)), .86, .8), lambda t: .015, n=140)
    S.box((0, 0, G + .012), (.24, .03, .022), 'iron')
    for s in (-1, 1): S.lathe([(0, -.014), (.016, -.004), (.016, .004), (0, .014)], 'iron_light', G + .012, x=s * .125)
    top = S.grip(.24, .017, bands=(.5,))
    S.lathe([(.016, 0), (.032, .015), (.028, .04), (.006, .05)], 'iron_light', top)
    return S.finish('flamberge')

def khopesh():                        # Sils: a sickle-sword; a straight neck, then a hooked blade, edge on the outside
    S = Shape()
    neck, R = .36, .155
    def path(t):
        if t < .32: return (0.0, G - (G - neck) * t / .32)
        th = (t - .32) / .68 * math.radians(215)
        return (R - R * math.cos(th), neck - R * math.sin(th))
    S.blade(path, lambda t: .016 if t < .32 else (.016 + .03 * min(1, (t - .32) / .15)) * (1 if t < .9 else (1 - t) / .1 * .9 + .1), lambda t: .013, single=True, n=110, edge=-1)
    S.box((0, 0, G + .01), (.07, .03, .02), 'iron')
    top = S.grip(.2, .016, bands=(.0, 1.0))
    S.lathe([(.016, 0), (.026, .012), (.01, .03)], 'iron_light', top)
    return S.finish('khopesh')

def estoc():                          # Antholonious: long and needle-pointed, like a quill nib; a guard with a side ring
    S = Shape()
    S.blade(straight(), lambda t: .019 * (1 - t) ** .5 + .002, lambda t: .019 * (1 - t) ** .5 + .002)
    S.box((0, 0, G + .012), (.2, .024, .02), 'iron')
    for s in (-1, 1): S.lathe([(0, -.01), (.012, -.004), (.012, .004), (0, .01)], 'iron_light', G + .012, x=s * .1)
    ring = [(.035 * math.cos(a), 0, G - .02 + .035 * math.sin(a)) for a in [i / 24 * 2 * math.pi for i in range(25)]]
    S.tube([(p[0], p[1] + 0, p[2]) for p in ring], .004, 'iron')
    top = S.grip(.27, .014, bands=(.5,))
    S.lathe([(.014, 0), (.024, .015), (.02, .035), (.006, .05), (.012, .058), (0.001, .068)], 'iron_light', top)
    return S.finish('estoc')

def scimitar():                       # Moinera: a deep sweeping curve, widening toward a sharp tip; drooping quillons
    S = Shape()
    S.blade(lambda t: (-.15 * t ** 1.8, G * (1 - t)), taper_tip(lambda t: .022 + .028 * t, .86, .55), lambda t: .012, single=True, n=90)
    for s in (-1, 1): S.tube([(0, 0, G + .012), (s * .05, 0, G + .006), (s * .075, 0, G - .02), (s * .08, 0, G - .045)], .007, 'iron')
    top = S.grip(.17, .015, bands=(.0,), r_end=.018)
    S.lathe([(.018, 0), (.024, .008), (.014, .025)], 'iron_light', top)
    return S.finish('scimitar')

def gladius():                        # Lithia: short and leaf-shaped, an oval guard, a ribbed grip, a big round pommel
    S = Shape()
    S.blade(straight(), taper_tip(lambda t: .036 * (1 + .28 * math.sin(math.pi * min(1, t / .8))), .8, .9), lambda t: .016)
    S.lathe([(.005, -.012), (.05, -.008), (.05, .008), (.005, .012)], 'iron', G + .01, seg=24, sx=1.0)
    top = S.grip(.14, .018, bands=(.25, .5, .75))
    S.lathe([(.016, 0), (.04, .02), (.04, .045), (.016, .065), (0.002, .07)], 'iron_light', top)
    return S.finish('gladius')

# ---------- kept for future characters
def katana():
    S = Shape()
    S.blade(lambda t: (-.05 * t * t, G * (1 - t)), taper_tip(lambda t: .022, .93, .5), lambda t: .013, single=True)
    S.lathe([(.006, -.004), (.05, -.004), (.05, .004), (.006, .004)], 'iron', G + .006, seg=28)
    top = S.grip(.24, .015, bands=[i / 8 for i in range(9)])
    S.lathe([(.016, 0), (.017, .012), (.012, .018)], 'iron_light', top)
    return S.finish('katana')

def rapier():
    S = Shape()
    S.blade(straight(), lambda t: .014 * (1 - t) ** .6 + .002, lambda t: .01)
    S.box((0, 0, G + .012), (.2, .018, .016), 'iron')
    for s in (-1, 1):
        S.tube([(s * .012, 0, G + .012), (s * .06, 0, G - .03), (s * .04, 0, G - .07), (0, 0, G - .06)], .004, 'iron')
    top = S.grip(.2, .013, bands=[i / 6 for i in range(7)])
    S.tube([(.08, 0, G + .016), (.07, 0, G + .1), (.03, 0, top - .01), (.006, 0, top + .005)], .005, 'iron')
    S.lathe([(.013, 0), (.026, .016), (.022, .034), (.004, .045)], 'iron_light', top)
    return S.finish('rapier')

def sawback():
    S = Shape()
    S.blade(straight(), taper_tip(lambda t: .036, .86, .8), lambda t: .016, single=True)
    for i in range(10):              # teeth along the spine
        z = G - .05 - i * .045; S.box((-.04, 0, z), (.012, .012, .02), 'blade')
    S.box((0, 0, G + .012), (.12, .03, .022), 'iron')
    top = S.grip(.2, .017, bands=(.5,))
    S.lathe([(.017, 0), (.028, .012), (.012, .03)], 'iron_light', top)
    return S.finish('sawback')

# ---------------------------------------------------------------- the character weapons (refs in the vault: World Buildinig/Items)
def grisha_katana():                  # Grisha: a long curved blade, a spiky guard like black scales, a wrapped grip, a diamond pommel
    S = Shape()
    S.blade(lambda t: (-.085 * t * t, G * (1 - t)), taper_tip(lambda t: .024 - .004 * t, .9, .6), lambda t: .013, single=True)
    gz = G + .01
    for k in range(5):                # big layered scales sweeping back down over the base of the blade, the spine side bigger
        for s in (-1, 1):
            a = math.radians(-35 - k * 11); L = (.08 + .016 * (4 - k)) * (1.3 if s < 0 else .85)
            x0 = s * (.016 + k * .005); z0 = gz + .03 - k * .022
            S.spike((x0, 0, z0), (x0 + s * L * math.cos(a), 0, z0 + L * math.sin(a)), .02, 'iron', flat=.55)
    for k in range(3): S.spike((0, 0, gz + .01 + k * .02), ((-1) ** k * .045, 0, gz + .09 + k * .02), .014, 'iron', flat=.55)
    S.box((0, 0, gz), (.05, .03, .03), 'iron')
    top = S.grip(.26, .014, bands=[i / 7 for i in range(8)], z0=gz + .03)
    S.lathe([(0, 0), (.026, .028), (0, .07)], 'iron_light', top, seg=4)
    return S.finish('grisha_katana')

def scissor():                        # Lithia: one half of a pair of giant scissors: a single-edged blade, a pivot hole, a looped handle
    S = Shape()
    S.blade(lambda t: (.02 * t * t, G * (1 - t)), taper_tip(lambda t: .036 + .004 * t, .84, .7), lambda t: .014, single=True)
    S.disc((-.012, .0072, G - .085), .011, 'band'); S.disc((.006, .0072, .14), .007, 'band')
    S.box((.03, 0, G - .02), (.05, .02, .06), 'iron')                  # the flare where blade meets handle
    loop = [(-.02, 0, G + .01), (-.045, 0, G + .09), (-.06, 0, G + .17), (-.03, 0, G + .23), (.03, 0, G + .25), (.075, 0, G + .2),
            (.07, 0, G + .12), (.035, 0, G + .05), (.0, 0, G + .02)]
    S.tube(loop + [loop[0]], .013, 'grip', seg=10)
    for k in range(5): S.spike((.066 - k * .006, 0, G + .2 - k * .03), (.04 - k * .006, 0, G + .19 - k * .03), .011, 'iron_light', flat=.9)   # teeth inside the loop
    return S.finish('scissor')

def harvester_long():                 # Sils (Terminus Harvester, 1 of 2): a long thin curved blade, a flat cross guard, a knotted grip
    S = Shape()
    S.blade(lambda t: (-.06 * t ** 1.6, G * (1 - t)), taper_tip(lambda t: .018 + .006 * math.sin(math.pi * t), .88, .6), lambda t: .011, single=True)
    S.box((0, 0, G + .012), (.21, .026, .022), 'iron'); S.box((0, -.0135, G + .012), (.18, .002, .008), 'band'); S.box((0, .0135, G + .012), (.18, .002, .008), 'band')
    top = S.grip(.22, .015, bands=(.12, .3, .62))
    S.lathe([(.016, 0), (.02, .012), (.014, .02), (.002, .026)], 'iron_light', top)
    return S.finish('harvester_long')

def harvester_broad():                # Sils (Terminus Harvester, 2 of 2): a broad curved blade widening toward its point
    S = Shape()
    S.blade(lambda t: (.05 * t * t, G * (1 - t)), taper_tip(lambda t: .03 + .028 * t, .86, .55), lambda t: .013, single=True, edge=-1)
    S.box((0, 0, G + .012), (.2, .026, .022), 'iron'); S.box((0, -.0135, G + .012), (.17, .002, .008), 'band'); S.box((0, .0135, G + .012), (.17, .002, .008), 'band')
    top = S.grip(.15, .016, bands=(.2, .6))
    S.lathe([(.016, 0), (.022, .012), (.012, .03)], 'iron_light', top)
    return S.finish('harvester_broad')

def serpent():                        # Vale (Twin Serpents): a slender curved blade with a spur near the guard, winged guard and pommel
    S = Shape()
    S.blade(lambda t: (-.05 * t * t + .015 * math.sin(math.pi * t), G * (1 - t)), taper_tip(lambda t: .022 + .008 * (1 - t), .86, .6), lambda t: .012, single=True)
    S.spike((-.022, 0, G - .05), (-.05, 0, G - .1), .01, 'blade')      # the spur on the spine
    gz = G + .012
    S.lathe([(0, -.014), (.02, -.004), (.02, .006), (0, .016)], 'iron', gz, seg=4)
    for s in (-1, 1):                 # wings of the guard: two feathers each side, swept up
        S.spike((s * .015, 0, gz), (s * .1, 0, gz + .05), .018, 'iron_light', flat=.5); S.spike((s * .015, 0, gz - .005), (s * .08, 0, gz - .02), .012, 'iron_light', flat=.5)
    top = S.grip(.17, .013, bands=(.0,), z0=gz + .015)
    for s in (-1, 1): S.spike((s * .008, 0, top), (s * .04, 0, top + .03), .008, 'iron_light')
    S.lathe([(.013, 0), (.018, .01), (.006, .024)], 'iron_light', top)
    return S.finish('serpent')

def nera_scythe():                    # Nera: a mechanical scythe planted spike-down: spear foot, a long pole with machined parts, a folding blade
    S = Shape()
    S.blade(lambda t: (0.0, .13 * (1 - t)), lambda t: .018 * (1 - t) + .003, lambda t: .012, n=24)   # the spear foot (its tip at the ground)
    S.lathe([(.012, 0), (.012, 1.12)], 'grip', .13, seg=10)                                          # the pole
    for z, h in [(.3, .07), (.62, .1), (.95, .06)]:
        S.box((0, 0, z), (.03, .028, h), 'iron'); S.box((0, .0145, z), (.022, .002, h * .6), 'band')  # machined collars, lit panels
    S.box((.02, 0, .68), (.04, .012, .025), 'iron_light')                                            # a trigger block
    hz = 1.25
    S.box((.02, 0, hz), (.07, .04, .06), 'iron'); S.box((.02, .021, hz), (.05, .002, .03), 'band')    # the head housing
    S.blade(lambda t: (.05 + .5 * t, hz + .02 - .03 * t - .11 * t ** 3), taper_tip(lambda t: .03 - .012 * t, .8, .7), lambda t: .012, single=True, edge=-1, n=60)
    S.blade(lambda t: (-.01 - .07 * t, hz - .01 - .05 * t * t), taper_tip(lambda t: .014, .6, .8), lambda t: .01, single=True, n=20)   # the back hook
    return S.finish('nera_scythe')

def moinera_dagger():                 # Moinera (dual blades, 1 of 2): a leaf-bladed dagger, flared hooks at the guard, a long wrapped handle, a ring for the chain
    S = Shape()
    S.blade(straight(), taper_tip(lambda t: .03 * (1 + .25 * math.sin(math.pi * min(1, t / .7))), .7, .8), lambda t: .015)
    gz = G + .012
    S.box((0, 0, gz), (.07, .028, .028), 'iron')
    for s in (-1, 1):
        S.spike((s * .03, 0, gz), (s * .065, 0, gz + .05), .012, 'iron'); S.spike((s * .03, 0, gz - .01), (s * .05, 0, gz - .06), .01, 'iron')
    top = S.grip(.34, .014, bands=(.0, .25, .5, .75, 1.0), z0=gz + .02)
    ring = [(.018 * math.cos(a), 0, top + .025 + .018 * math.sin(a)) for a in [i / 16 * 2 * math.pi for i in range(17)]]
    S.tube(ring, .004, 'iron_light')
    return S.finish('moinera_dagger')

SHAPES = [falchion, stiletto, zweihander, executioner, sabre, flamberge, khopesh, estoc, scimitar, gladius, katana, rapier, sawback,
          grisha_katana, scissor, harvester_long, harvester_broad, serpent, nera_scythe, moinera_dagger]
objs = [f() for f in SHAPES]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True)
print('SHAPES', ', '.join(f'{o.name}:{len(o.data.polygons)}' for o in objs))

if SHEET:                            # a contact sheet: every shape side by side, front view, to check the outlines
    for o in objs[:-7]: o.hide_render = True                    # the sheet shows the character weapons
    objs = objs[-7:]
    for i, o in enumerate(objs): o.location.x = i * .62
    W = len(objs) * .62 + .2, 1.5
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = max(W[0], W[1] * 2400 / 640)
    co = bpy.data.objects.new('cam', cam); scene.collection.objects.link(co); scene.camera = co
    co.location = ((len(objs) - 1) * .62 / 2, -5, .7); co.rotation_euler = (math.pi / 2, 0, 0)
    scene.render.engine = 'BLENDER_WORKBENCH'; scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'MATERIAL'
    scene.render.resolution_x, scene.render.resolution_y = 2400, 640; scene.render.filepath = SHEET
    bpy.ops.render.render(write_still=True); print('SHEET')
