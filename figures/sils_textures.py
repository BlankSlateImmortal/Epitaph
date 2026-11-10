"""Paint Sils's low-res DS-style textures (face, hair, collar). Run: python3 sils_textures.py <outdir>"""
import sys, os, random
from PIL import Image, ImageDraw

out = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(__file__)
SKIN = (236, 230, 224)
BLOOD = (138, 16, 22)
INK = (14, 10, 16)

# ---- face 128x128: projected onto the front of the head (u = x, v = z)
f = Image.new('RGB', (128, 128), SKIN)
d = ImageDraw.Draw(f)
# soft shading down the sides of the face
for x in range(128):
    k = abs(x - 64) / 64
    if k > .62:
        a = min(1, (k - .62) / .38) * 22
        d.line([(x, 0), (x, 127)], fill=tuple(int(c - a) for c in SKIN))
# under-eye shadow
for cx, s in ((43, -1), (85, 1)):
    d.line([(cx - 9, 77), (cx + 9, 77)], fill=(196, 182, 190))
# eyes: sharp, half-lidded, looking slightly down; dark red irises
for cx, s in ((43, -1), (85, 1)):        # s = outer-corner direction (viewer's left / right)
    inner, outer = cx - s * 11, cx + s * 11
    # sclera (almond, top cut by the lid)
    d.polygon([(inner, 72), (cx, 69), (outer, 67), (cx + s * 4, 75), (cx - s * 5, 75)], fill=(238, 232, 230))
    # iris + pupil, top hidden by lid
    d.ellipse([cx - 5, 67, cx + 4, 77], fill=(96, 14, 24))
    d.ellipse([cx - 3, 69, cx + 2, 76], fill=(40, 6, 12))
    d.point((cx + 1 * s, 70), fill=(240, 200, 200))
    # heavy upper lid line, rising toward the outer corner, small flick
    d.line([(inner - s * 1, 71), (cx, 68), (outer, 66)], fill=INK, width=3)
    d.line([(outer, 66), (outer + s * 3, 64)], fill=INK, width=2)
    # lid fill above the line (skin, slightly shadowed)
    d.polygon([(inner - s, 70), (cx, 67), (outer, 65), (outer, 62), (inner - s, 66)], fill=(214, 204, 206))
    d.line([(inner - s, 70), (cx, 67), (outer, 65)], fill=INK, width=2)
    # lower lash, outer half only
    d.line([(cx + s * 2, 76), (outer - s, 74)], fill=(70, 50, 60), width=1)
    # brow: thin, low and straight
    d.line([(cx - 10, 58 + (2 if s < 0 else 0)), (cx + 10, 58 + (0 if s < 0 else 2))], fill=(30, 26, 32), width=2)
# nose + mouth
d.line([(66, 84), (67, 89)], fill=(196, 176, 172), width=1)
d.line([(65, 90), (68, 90)], fill=(186, 164, 160), width=1)
d.line([(57, 101), (64, 102), (71, 101)], fill=(132, 92, 96), width=2)
# blood: a trail from under his right eye (viewer's left) and one from the mouth corner
d.line([(46, 80), (47, 94), (45, 108), (46, 127)], fill=BLOOD, width=2)
d.line([(47, 86), (48, 100)], fill=(160, 30, 36), width=1)
d.line([(57, 102), (55, 112), (56, 127)], fill=BLOOD, width=2)
d.ellipse([53, 112, 57, 116], fill=BLOOD)
f.save(os.path.join(out, 'sils_face.png'))

# ---- hair 16x64: v runs root -> tip; one dull sheen band near the crown
h = Image.new('RGB', (16, 64), (12, 12, 16))
d = ImageDraw.Draw(h)
for y in range(64):
    base = 12 + (6 if y > 40 else 0)
    band = max(0, 1 - abs(y - 9) / 4)
    c = int(base + band * 46)
    d.line([(0, y), (15, y)], fill=(c, c, int(c * 1.12) + 3))
for x in (3, 8, 12):
    d.line([(x, 0), (x, 63)], fill=(6, 6, 9))
h.save(os.path.join(out, 'sils_hair.png'))

# ---- collar 16x64: white inner robe with blood soaked into it
c = Image.new('RGB', (16, 64), (226, 220, 210))
d = ImageDraw.Draw(c)
d.line([(0, 0), (0, 63)], fill=(180, 172, 162)); d.line([(15, 0), (15, 63)], fill=(196, 188, 178))
r = random.Random(4)
for _ in range(16):
    x, y = r.randint(1, 14), r.randint(22, 50); s = r.randint(1, 3)
    d.ellipse([x - s, y - s, x + s, y + s], fill=BLOOD if r.random() < .7 else (160, 40, 44))
d.line([(6, 18), (7, 30)], fill=BLOOD, width=2)
c.save(os.path.join(out, 'sils_collar.png'))
print('textures ->', out)
