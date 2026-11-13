"""Circular "Earth island" heightmap for the Epitaph map.

Layout (image y grows downward):
  main  : Equal Earth, central meridian LON0, latitudes LAT_CUT..90, across the top
  disc  : Antarctica, south-polar azimuthal equidistant out to LAT_CUT, whole and round,
          set below the main map with the Antarctic Peninsula (lon LON_UP) pointing up
  island: a smooth blob around both (blurred union), everything else is open sea (alpha 0)

Usage: python3 -I build_circle.py <tiles_dir> <out_dir> <geo.js> [seed]
  tiles_dir: AWS Terrain Tiles (terrarium) at zoom 4, named 4_<x>_<y>.png, x,y in 0..15, from
             https://s3.amazonaws.com/elevation-tiles-prod/terrarium/4/<x>/<y>.png
  geo.js   : tools/map/geo.js (Natural Earth land, used as a land mask)
  seed     : shapes of the invented continents and islands (the site uses 57)
  e.g. python3 -I tools/map/build_circle.py /tmp/tiles assets/atlas3d tools/map/geo.js 57
Writes <out_dir>/earth.png (same RGBA packing as build_maps.py) and <out_dir>/earth.json.
"""
import json
import re
import sys
import numpy as np
from PIL import Image, ImageDraw

tiles_dir, out_dir, geo_path = sys.argv[1:4]

# ---------------------------------------------------------------- elevation sampling
Z, T = 4, 256
N = (1 << Z) * T
merc = np.zeros((N, N), dtype=np.float32)
for x in range(1 << Z):
    for y in range(1 << Z):
        a = np.asarray(Image.open(f"{tiles_dir}/4_{x}_{y}.png").convert("RGB"), dtype=np.float32)
        merc[y * T:(y + 1) * T, x * T:(x + 1) * T] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
MAXLAT = np.degrees(np.arctan(np.sinh(np.pi)))


def sample(lon, lat):
    lon = (lon + 180) % 360 - 180
    latc = np.clip(lat, -MAXLAT, MAXLAT)
    px = (lon + 180) / 360 * N - 0.5
    lr = np.radians(latc)
    py = (1 - np.log(np.tan(lr) + 1 / np.cos(lr)) / np.pi) / 2 * N - 0.5
    x0 = np.floor(px).astype(int); y0 = np.clip(np.floor(py).astype(int), 0, N - 2)
    fx = px - x0; fy = np.clip(py - y0, 0, 1)
    x0m = x0 % N; x1m = (x0 + 1) % N
    e = (merc[y0, x0m] * (1 - fx) * (1 - fy) + merc[y0, x1m] * fx * (1 - fy)
         + merc[y0 + 1, x0m] * (1 - fx) * fy + merc[y0 + 1, x1m] * fx * fy)
    e = np.where(lat < -MAXLAT, 2800.0, e)
    e = np.where(lat > MAXLAT, -4000.0, e)
    return e


LAND = json.loads(re.search(r"export const LAND=(\[.*?\]\]\]);", open(geo_path).read(), re.S).group(1))
MW, MH = 4096, 2048
mask_img = Image.new("1", (MW, MH), 0)
for poly in LAND:
    layer = np.zeros((MH, MW), dtype=bool)
    for ring in poly:
        pts = [((ring[i] + 180) / 360 * MW, (90 - ring[i + 1]) / 180 * MH) for i in range(0, len(ring), 2)]
        if len(pts) >= 3:
            r = Image.new("1", (MW, MH), 0); ImageDraw.Draw(r).polygon(pts, fill=1)
            layer ^= np.asarray(r)
    mask_img = Image.fromarray(np.asarray(mask_img) | layer)
LANDMASK = np.asarray(mask_img)


def elev(lon, lat):
    e = sample(lon, lat)
    lonw = (lon + 180) % 360 - 180
    mx = np.clip(((lonw + 180) / 360 * MW).astype(int), 0, MW - 1)
    my = np.clip(((90 - lat) / 180 * MH).astype(int), 0, MH - 1)
    return np.where(LANDMASK[my, mx] & (e < 0) & (e > -10), 0.5, e)


def blur(a, sigma):
    rad = int(sigma * 3)
    k = np.exp(-0.5 * (np.arange(-rad, rad + 1) / sigma) ** 2); k /= k.sum()
    a = np.pad(a, rad, mode="edge")
    a = np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), 1, a)
    return np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), 0, a)


# ---------------------------------------------------------------- Equal Earth
A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796
M = np.sqrt(3) / 2


def ee_forward(lon, lat):
    p = np.arcsin(M * np.sin(np.radians(lat))); p2 = p * p; p6 = p2 * p2 * p2
    return (np.radians(lon) * np.cos(p) / (M * (A1 + 3 * A2 * p2 + p6 * (7 * A3 + 9 * A4 * p2))),
            p * (A1 + A2 * p2 + p6 * (A3 + A4 * p2)))


def ee_inverse(x, y):
    p = y.copy()
    for _ in range(12):
        p2 = p * p; p6 = p2 * p2 * p2
        p = p - (p * (A1 + A2 * p2 + p6 * (A3 + A4 * p2)) - y) / (A1 + 3 * A2 * p2 + p6 * (7 * A3 + 9 * A4 * p2))
    p2 = p * p; p6 = p2 * p2 * p2
    lon = M * x * (A1 + 3 * A2 * p2 + p6 * (7 * A3 + 9 * A4 * p2)) / np.cos(p)
    return np.degrees(lon), np.degrees(np.arcsin(np.clip(np.sin(p) / M, -1, 1)))


# ---------------------------------------------------------------- layout: everything inside one circle
LON0, LAT_CUT, LON_UP, CDISC = 11.0, -58.0, -60.0, 32.0
XMAX = float(ee_forward(np.array(180.0), np.array(0.0))[0])
YMAX = float(ee_forward(np.array(0.0), np.array(90.0))[1])
YCUT = float(ee_forward(np.array(0.0), np.array(LAT_CUT))[1])
W = H = 2400
CX = CY = W / 2
RC = 0.485 * W                     # the island circle
SAFE = 0.93 * RC                   # all content stays inside this

def boundary_pts(mainW, mainX0, mainY0, mainH):
    pts = []
    for lat in np.linspace(LAT_CUT, 90, 90):
        for lon in (-180.0, 180.0):
            x, y = ee_forward(np.array(lon), np.array(lat))
            pts.append((mainX0 + (float(x) / XMAX + 1) / 2 * mainW, mainY0 + (YMAX - float(y)) / (YMAX - YCUT) * mainH))
    return pts

# search the largest main map (with Antarctica's disc under it) that fits the safe circle
best = None
for f in np.linspace(0.99, 0.5, 200):
    mainW = f * 2 * SAFE
    mainH = mainW * (YMAX - YCUT) / (2 * XMAX)
    Rd = 0.13 * mainW
    GAP = 0.012 * W
    total = mainH + GAP + 2 * Rd
    for off in np.linspace(-0.15, 0.15, 31):
        mainY0 = CY - total / 2 + off * W
        mainX0 = CX - mainW / 2
        dcx, dcy = CX - 0.02 * W, mainY0 + mainH + GAP + Rd
        ok = all(np.hypot(px - CX, py - CY) <= SAFE for px, py in boundary_pts(mainW, mainX0, mainY0, mainH))
        ok = ok and np.hypot(dcx - CX, dcy - CY) + Rd <= SAFE
        if ok:
            best = (mainW, mainH, Rd, mainX0, mainY0, dcx, dcy); break
    if best:
        break
mainW, mainH, Rd, mainX0, mainY0, dcx, dcy = best

ys, xs = np.mgrid[0:H, 0:W].astype(np.float64) + 0.5
ex = ((xs - mainX0) / mainW * 2 - 1) * XMAX
ey = YMAX - (ys - mainY0) / mainH * (YMAX - YCUT)
lon_r, lat_m = ee_inverse(ex, ey)
in_main = (np.abs(lon_r) <= 180) & (ey <= YMAX) & (ey >= YCUT)
lon_m = (lon_r + LON0 + 180) % 360 - 180
dx, dy = xs - dcx, dcy - ys
rr = np.hypot(dx, dy)
in_disc = rr <= Rd
lat_d = -90 + rr / Rd * CDISC
lon_d = (np.degrees(np.arctan2(dx, dy)) + LON_UP + 180) % 360 - 180
circle_r = np.hypot(xs - CX, ys - CY)
inside = circle_r <= RC

e = np.full((H, W), -4300.0)
em = elev(lon_m, lat_m)
# nothing may be cut by a seam: drop land touching the main map's edges or the disc's rim
near_edge = (np.abs(lon_r) > 176.5) | (lat_m < LAT_CUT + 2.0)
em = np.where(near_edge & (em >= 0), -150.0, em)
e = np.where(in_main, em, e)
ed = elev(lon_d, lat_d)
ed = np.where((lat_d > LAT_CUT - 2.5) & (ed >= 0), -150.0, ed)
e = np.where(in_disc, ed, e)

# ---------------------------------------------------------------- invented lands: continents + islands
SEED = int(sys.argv[4]) if len(sys.argv) > 4 else 23
rng = np.random.default_rng(SEED)
content = (in_main | in_disc)
Q = 4                                                    # work at 1/4 resolution, then upsample
h4, w4 = H // Q, W // Q
def up(a):
    return np.asarray(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), dtype=np.float64) / 255
def noise_field(cell, sigma, seed):
    g = np.random.default_rng(seed).standard_normal((H // cell, W // cell))
    g = blur(g, sigma); g = np.clip(g / g.std(), -2.5, 2.5) / 2.5
    return np.asarray(Image.fromarray(((g + 1) * 127.5).astype(np.uint8)).resize((W, H), Image.BICUBIC), dtype=np.float64) / 127.5 - 1
coast = noise_field(16, 2.0, SEED + 1) * 0.55 + noise_field(8, 2.0, SEED + 2) * 0.3 + noise_field(4, 1.4, SEED + 3) * 0.18 + noise_field(2, 1.0, SEED + 4) * 0.1
ridgeN = 1 - np.abs(noise_field(8, 1.6, SEED + 5))
ridgeN2 = 1 - np.abs(noise_field(4, 1.2, SEED + 6))

# free space: inside the shore with a margin, away from the real continents' frames
cont4 = np.asarray(Image.fromarray(content.astype(np.uint8) * 255).resize((w4, h4)), dtype=np.float64) / 255
yy4, xx4 = np.mgrid[0:h4, 0:w4] * Q + Q / 2
shore4 = np.hypot(xx4 - CX, yy4 - CY) > RC * 0.88
forbid4 = np.clip(cont4 + shore4, 0, 1)
pot4 = np.clip(1 - blur(forbid4, 10.0) * 3.2, 0, 1)      # 1 deep in free water, 0 near anything forbidden
pot = up(pot4)

def zone_centroid(mask4):
    w_ = pot4 * mask4
    if w_.sum() < 1:
        return None
    return float((xx4 * w_).sum() / w_.sum()), float((yy4 * w_).sum() / w_.sum()), float(np.sqrt((w_ > 0.5).sum() * Q * Q / np.pi))

fields = []                                               # (field, peak, kind)
ang = np.arctan2(xs - CX, -(ys - CY))                     # 0 = up (north), clockwise
rad = np.hypot(xs - CX, ys - CY)
# 1) the northern continent: a long band curving along the shore above the known world
top_r = (mainY0 + (CY - RC)) / 2
band_r = CY - top_r
span = np.radians(rng.uniform(42, 56))
radial = 1 - np.abs(rad - band_r - 0.012 * W * np.sin(ang * 5 + rng.uniform(0, 6))) / (0.045 * W * (1 + 0.45 * np.cos(ang * 3 + rng.uniform(0, 6))))
angular = 1 - (np.abs(ang - rng.uniform(-0.15, 0.15)) / span) ** 2
f_north = np.minimum(radial, angular)
fields.append((f_north, rng.uniform(3500, 5200), 'continent'))
# 2) + 3) continents in the open corners either side of Antarctica
for side in (-1, 1):
    zone4 = ((xx4 - dcx) * side > Rd + 0.03 * W) & (yy4 > mainY0 + mainH)
    zc = zone_centroid(zone4.astype(np.float64))
    if not zc:
        continue
    zx, zy, zr = zc
    f = np.full((H, W), -9.0)
    for lobe in range(3):                                # a few overlapping lobes → bays and peninsulas
        th = rng.uniform(0, np.pi); c_, s_ = np.cos(th), np.sin(th)
        ox, oy = (rng.uniform(-0.35, 0.35) * zr, rng.uniform(-0.3, 0.3) * zr) if lobe else (0, 0)
        u_, v_ = (xs - zx - ox) * c_ + (ys - zy - oy) * s_, -(xs - zx - ox) * s_ + (ys - zy - oy) * c_
        ax, ay = zr * rng.uniform(0.45, 0.7) * (1 if not lobe else 0.75), zr * rng.uniform(0.25, 0.42)
        f = np.maximum(f, 1 - np.hypot(u_ / ax, v_ / ay))
    fields.append((f, rng.uniform(2500, 4500), 'continent'))

land_field = np.full((H, W), -1.0)
heights = np.full((H, W), -9999.0)
for f, peak, kind in fields:
    val = f + coast * 0.7 - (1 - pot) * 1.7
    inner = np.clip(val / 0.45, 0, 1)
    spine = np.clip(ridgeN * 0.7 + ridgeN2 * 0.3, 0, 1) ** 2.2
    h = 30 + inner ** 1.1 * (350 + spine * peak)
    heights = np.where(val > 0, np.maximum(heights, h), heights)
    land_field = np.maximum(land_field, val)

# 4) islands and archipelagos in what's left
taken4 = np.asarray(Image.fromarray(((land_field > -0.2) | content).astype(np.uint8) * 255).resize((w4, h4)), dtype=np.float64) > 0
islands = []
for _ in range(5000):
    x, y = rng.uniform(0, W), rng.uniform(0, H)
    r = rng.uniform(0.016, 0.034) * W
    i0, j0 = int(x // Q), int(y // Q)
    rr = int(r * 2.2 // Q) + 2
    if np.hypot(x - CX, y - CY) + r * 1.8 > RC * 0.88:
        continue
    sub = taken4[max(0, j0 - rr):j0 + rr + 1, max(0, i0 - rr):i0 + rr + 1]
    if sub.any() or any(np.hypot(x - a, y - b) < (r + rb) * 1.8 for a, b, rb, _k in islands):
        continue
    islands.append((x, y, r, ['archipelago', 'volcano', 'blob', 'crescent'][len(islands) % 4]))
    if len(islands) >= 7:
        break
for (x, y, r, kind) in islands:
    if kind == 'archipelago':
        th = rng.uniform(0, np.pi); c_, s_ = np.cos(th), np.sin(th); d = np.full((H, W), 9.0)
        for i in range(int(rng.integers(4, 7))):
            t = (i / 5 - 0.5) * 2.2
            px_, py_ = x + t * r * 1.3 * c_ - np.sin(t * 1.7) * r * 0.5 * s_, y + t * r * 1.3 * s_ + np.sin(t * 1.7) * r * 0.5 * c_
            d = np.minimum(d, np.hypot(xs - px_, ys - py_) / (r * rng.uniform(0.25, 0.45)))
        peak = rng.uniform(400, 1100)
    elif kind == 'crescent':
        rr_ = np.hypot(xs - x, ys - y); th_ = np.arctan2(ys - y, xs - x) - rng.uniform(0, 6.28)
        d = np.abs(rr_ - r) / (r * 0.34); d = np.where(np.cos(th_) < -0.5, 9.0, d); peak = rng.uniform(500, 1300)
    elif kind == 'volcano':
        d = np.hypot(xs - x, ys - y) / (r * 0.8); peak = rng.uniform(3800, 5200)
    else:
        d = np.hypot(xs - x, ys - y) / r; peak = rng.uniform(900, 2200)
    d = d + coast * 0.6
    val = 1 - d
    h = 30 + np.clip(val, 0, 1) ** (2.2 if kind == 'volcano' else 1.3) * peak
    heights = np.where(val > 0, np.maximum(heights, h), heights)
    land_field = np.maximum(land_field, val * 0.45)

# a believable sea floor for the open water: abyssal plains, mid-ocean ridges, trenches, seamounts
plain = -4300 + 700 * noise_field(32, 2.0, SEED + 10) + 350 * noise_field(16, 2.0, SEED + 11) + 150 * noise_field(4, 1.2, SEED + 12)
ridge_line = 1 - np.abs(noise_field(24, 2.0, SEED + 13))
ridge = np.clip((ridge_line - 0.82) / 0.18, 0, 1) ** 1.5 * (1500 + 600 * noise_field(8, 1.5, SEED + 14))
rift = np.clip((ridge_line - 0.975) / 0.025, 0, 1) * 500          # the rift valley along the ridge crest
trench_line = 1 - np.abs(noise_field(20, 2.0, SEED + 15))
trench = np.clip((trench_line - 0.93) / 0.07, 0, 1) * np.clip(noise_field(32, 2.0, SEED + 16) * 2, 0, 1) * 2600
bathy = plain + ridge - rift - trench
for _ in range(int(rng.integers(10, 16))):                         # seamounts and guyots
    sx, sy = rng.uniform(0, W), rng.uniform(0, H)
    sr = rng.uniform(0.006, 0.016) * W
    top = rng.uniform(-1600, -350)
    bump = np.exp(-((xs - sx) ** 2 + (ys - sy) ** 2) / (2 * sr * sr))
    bathy = np.maximum(bathy, bathy + (top - bathy) * bump)
bathy = np.minimum(bathy, -120)

# continental shelf (shallow), then the slope down to the deep, around the invented land
lf = land_field
shelf_top = -60 - 160 * np.clip(-lf / 0.1, 0, 1)
t_slope = np.clip((-lf - 0.1) / 0.28, 0, 1) ** 0.8
shelf = np.where(lf > -0.1, shelf_top, (1 - t_slope) * -260 + t_slope * bathy)
sea_new = np.maximum(bathy, shelf)
e = np.where(~content & (land_field > 0), heights, e)
e = np.where(~content & (land_field <= 0), sea_new, e)
print("continents", len(fields), "islands", len(islands))

# blend the sea floor across the seams (real ocean ↔ open sea) so no edge shows
cm = np.asarray(Image.fromarray(content.astype(np.uint8) * 255).resize((W // 4, H // 4)), dtype=np.float64) / 255
seam = blur(cm, 10.0)
seam = 1 - np.abs(seam * 2 - 1)                                   # 1 at the boundary, 0 away from it
seam = np.asarray(Image.fromarray((np.clip(seam, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), dtype=np.float64) / 255
sea_only = np.where(e < 0, e, -4300.0)
sm4 = np.asarray(Image.fromarray(np.clip((sea_only + 9000) / 9000 * 65535, 0, 65535).astype(np.uint16)).resize((W // 4, H // 4), Image.BILINEAR), dtype=np.float64) / 65535 * 9000 - 9000
sm4 = blur(sm4, 10.0)
smooth = np.asarray(Image.fromarray(np.clip((sm4 + 9000) / 9000 * 65535, 0, 65535).astype(np.uint16)).resize((W, H), Image.BILINEAR), dtype=np.float64) / 65535 * 9000 - 9000
e = np.where(e < 0, e * (1 - seam) + smooth * seam, e)
print("islands", len(islands))

land = e >= 0
relief = blur(np.clip(e, 0, 8800), 3.0)
r_ = np.where(land, 1 + 254 * np.sqrt(np.clip(relief, 0, 8800) / 8800), 0)
g_ = np.where(land, np.where(e < 63, np.round(e * 4), 255), 0)
b_ = np.where(land, 0, 1 + 254 * np.sqrt(np.clip(-e, 0, 8000) / 8000))
img = np.stack([r_, g_, b_, np.where(inside, 255, 0)], -1)
img[~inside] = 0
Image.fromarray(img.astype(np.uint8), "RGBA").save(f"{out_dir}/earth.png", optimize=True)

outline_uv = [[round((CX + RC * np.cos(a)) / W, 5), round(1 - (CY + RC * np.sin(a)) / H, 5)] for a in np.linspace(0, 2 * np.pi, 240, endpoint=False)]
meta = {"W": W, "H": H, "lon0": LON0, "latCut": LAT_CUT, "lonUp": LON_UP, "cdisc": CDISC,
        "xmax": XMAX, "ymax": YMAX, "ycut": YCUT, "mainX0": mainX0, "mainY0": mainY0, "mainW": mainW, "mainH": mainH,
        "dcx": dcx, "dcy": dcy, "rd": Rd, "circle": [CX / W, 1 - CY / H, RC / W], "outline": outline_uv,
        "seed": SEED}
json.dump(meta, open(f"{out_dir}/earth.json", "w"))
print("main", round(mainW), round(mainH), "disc r", round(Rd))
