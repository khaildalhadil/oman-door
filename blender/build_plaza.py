"""ساحة «عُمان حكاية بحر» - the journey hub.

A circular heritage plaza with a relief map of Oman in a pool at its centre and four themed
entrances around it (navigation, Sumhuram, turtles, ivory trade), plus a
bonus gate to Nizwa Fort. Blender Z-up, three.js gets (x, z, -y)."""
import sys
import os
import math
import random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import bpy
import bmesh
from mathutils import Vector, Matrix
import lib
import props
import scenery
import textures
from lib import TAU, rad

R_PAV = 22.0
STATIONS = [
    # id, angle (deg, Blender, CCW from +X), theme colour (sRGB)
    ("nav", 200.0, (0.12, 0.30, 0.55)),
    ("sumhuram", 145.0, (0.55, 0.38, 0.22)),
    ("ivory", 90.0, (0.15, 0.42, 0.25)),
    ("turtles", 35.0, (0.05, 0.50, 0.58)),
]
BONUS_ANGLE = 270.0

# ---------------------------------------------------------- Oman outline
MAINLAND = [
    (56.37, 24.98), (56.47, 24.74), (56.62, 24.50), (56.75, 24.35), (57.05, 24.05), (57.35, 23.85), (57.65, 23.72),
    (57.90, 23.68), (58.20, 23.65), (58.55, 23.60), (58.80, 23.45), (58.95, 23.22), (59.20, 22.95), (59.53, 22.60),
    (59.80, 22.53), (59.83, 22.30), (59.65, 21.95), (59.50, 21.60), (59.20, 21.20), (58.85, 20.75), (58.60, 20.40),
    (58.25, 20.25), (57.85, 20.00), (57.70, 19.65), (57.75, 19.20), (57.60, 18.95), (57.10, 18.85), (56.65, 18.55),
    (56.30, 18.20), (55.60, 17.90), (55.25, 17.55), (55.05, 17.05), (54.69, 16.99), (54.40, 17.02), (54.10, 17.00),
    (53.95, 16.88), (53.60, 16.80), (53.40, 16.73), (53.10, 16.65), (52.95, 17.00), (52.75, 17.30), (52.00, 19.00),
    (53.20, 20.20), (54.20, 21.20), (55.20, 22.70), (55.65, 23.40), (55.75, 24.00), (55.85, 24.25), (56.00, 24.50),
    (56.10, 24.75),
]
MUSANDAM = [(56.08, 26.05), (56.20, 26.25), (56.32, 26.38), (56.40, 26.37), (56.48, 26.20), (56.42, 26.00),
            (56.35, 25.75), (56.28, 25.62), (56.15, 25.75), (56.10, 25.90)]
MASIRAH = [(58.65, 20.60), (58.85, 20.70), (58.95, 20.45), (58.85, 20.20), (58.70, 20.15), (58.62, 20.35)]
HAJAR = [(56.2, 25.9), (56.25, 24.9), (56.6, 24.1), (57.1, 23.45), (57.6, 23.15), (58.2, 23.05), (58.8, 22.85), (59.4, 22.55)]
DHOFAR = [(53.3, 17.1), (53.9, 17.2), (54.5, 17.3), (55.1, 17.45)]
LON0, LAT0, KS = 56.0, 21.4, 1.12
COSL = math.cos(math.radians(21.4))
MAP_X, MAP_Y, MAP_Z = 0.0, 0.0, 0.55
PINS = {
    "nav": (58.13, 22.57, "المضيبي"),
    "turtles": (59.78, 22.25, "رأس الجنز"),
    "ivory": (58.57, 23.62, "مسقط"),
    "sumhuram": (54.43, 17.04, "سمهرم"),
}


def proj(lon, lat):
    return (MAP_X + (lon - LON0) * COSL * KS, MAP_Y + (lat - LAT0) * KS)


def inside(poly, x, y):
    n = len(poly)
    c = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi):
            c = not c
        j = i
    return c


def seg_dist(px, py, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy + 1e-12)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def line_dist(px, py, line):
    return min(seg_dist(px, py, a, b) for a, b in zip(line[:-1], line[1:]))


def map_height(lon, lat):
    h = 0.06
    dh = line_dist(lon, lat, HAJAR)
    h += 1.15 * math.exp(-(dh / 0.3) ** 2)
    h += 0.45 * math.exp(-((lon - 57.25) ** 2 + (lat - 23.1) ** 2) / 0.05)   # Jebel Akhdar / Jebel Shams
    dd = line_dist(lon, lat, DHOFAR)
    h += 0.6 * math.exp(-(dd / 0.26) ** 2)
    h += 0.012 * math.sin(lon * 9) * math.sin(lat * 7)
    return max(0.03, h)


def map_texture():
    n = 1024
    polys = [MAINLAND, MUSANDAM, MASIRAH]
    xs = [p[0] for p in MAINLAND + MUSANDAM]
    ys = [p[1] for p in MAINLAND + MUSANDAM]
    lon0, lon1, lat0, lat1 = min(xs) - 0.2, max(xs) + 0.2, min(ys) - 0.2, max(ys) + 0.2
    u, v = textures.grid(n)
    lon = lon0 + u * (lon1 - lon0)
    lat = lat0 + v * (lat1 - lat0)
    sand = textures.C((0.90, 0.76, 0.52))
    col = np.empty((n, n, 3), np.float32)
    col[:] = sand
    # mountains (Hajar) brown -> darker with height, Dhofar green, Batinah coast green strip, Wahiba orange
    dh = np.full_like(lon, 9.0)
    for a, b in zip(HAJAR[:-1], HAJAR[1:]):
        ax, ay = a
        bx, by = b
        dx, dy = bx - ax, by - ay
        t = np.clip(((lon - ax) * dx + (lat - ay) * dy) / (dx * dx + dy * dy), 0, 1)
        dh = np.minimum(dh, np.hypot(lon - (ax + t * dx), lat - (ay + t * dy)))
    mount = np.exp(-(dh / 0.34) ** 2)
    col = col * (1 - mount[..., None]) + textures.C((0.52, 0.40, 0.30)) * mount[..., None]
    dd = np.full_like(lon, 9.0)
    for a, b in zip(DHOFAR[:-1], DHOFAR[1:]):
        ax, ay = a
        bx, by = b
        dx, dy = bx - ax, by - ay
        t = np.clip(((lon - ax) * dx + (lat - ay) * dy) / (dx * dx + dy * dy), 0, 1)
        dd = np.minimum(dd, np.hypot(lon - (ax + t * dx), lat - (ay + t * dy)))
    green = np.exp(-(dd / 0.3) ** 2)
    col = col * (1 - green[..., None]) + textures.C((0.30, 0.55, 0.26)) * green[..., None]
    batinah = np.exp(-(np.abs((lat - 23.95) + (lon - 57.3) * 0.62) / 0.12) ** 2) * ((lon > 56.4) & (lon < 58.4))
    col = col * (1 - 0.8 * batinah[..., None]) + textures.C((0.38, 0.58, 0.28)) * (0.8 * batinah)[..., None]
    wahiba = np.exp(-(((lon - 58.65) / 0.35) ** 2 + ((lat - 21.9) / 0.4) ** 2))
    col = col * (1 - 0.7 * wahiba[..., None]) + textures.C((0.93, 0.62, 0.36)) * (0.7 * wahiba)[..., None]
    rub = np.exp(-(((lon - 53.4) / 1.0) ** 2 + ((lat - 19.6) / 1.1) ** 2))
    col = col * (1 - 0.5 * rub[..., None]) + textures.C((0.95, 0.70, 0.42)) * (0.5 * rub)[..., None]
    col *= (1 + 0.06 * textures.noise(n, 2.0, 7))[..., None]
    textures.save_png("map_a", col)
    return lon0, lon1, lat0, lat1


def build_map(M, statics):
    lon0, lon1, lat0, lat1 = map_texture()
    m_map = lib.material("PZ_Map", (0.9, 0.8, 0.6), 0.85, albedo="map_a")
    m_base = M['trim']
    step = 0.055
    x0, y0 = proj(lon0, lat0)
    x1, y1 = proj(lon1, lat1)
    nx, ny = int((x1 - x0) / step), int((y1 - y0) / step)
    polys = [[proj(*p) for p in poly] for poly in (MAINLAND, MUSANDAM, MASIRAH)]
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    verts = {}

    def vert(i, j):
        key = (i, j)
        if key not in verts:
            x = x0 + i * step
            y = y0 + j * step
            lon = LON0 + (x - MAP_X) / (COSL * KS)
            lat = LAT0 + (y - MAP_Y) / KS
            verts[key] = bm.verts.new((x, y, MAP_Z + map_height(lon, lat)))
        return verts[key]
    for i in range(nx):
        for j in range(ny):
            cx = x0 + (i + 0.5) * step
            cy = y0 + (j + 0.5) * step
            if not any(inside(p, cx, cy) for p in polys):
                continue
            f = bm.faces.new((vert(i, j), vert(i + 1, j), vert(i + 1, j + 1), vert(i, j + 1)))
            for l in f.loops:
                co = l.vert.co
                l[uvl].uv = ((co.x - x0) / (x1 - x0), (co.y - y0) / (y1 - y0))
    relief = lib.mesh_obj("OmanMap", bm, [m_map])
    lib.finalize(relief, 70, recalc=False, merge=False)
    # island base following the outline
    bm = bmesh.new()
    for poly in polys:
        pts = poly[::-1] if _area(poly) < 0 else poly
        bot = [bm.verts.new((x, y, 0.15)) for x, y in pts]
        top = [bm.verts.new((x, y, MAP_Z + 0.04)) for x, y in pts]
        bm.faces.new(list(reversed(bot)))
        bm.faces.new(top)
        n = len(pts)
        for k in range(n):
            k2 = (k + 1) % n
            bm.faces.new((bot[k], bot[k2], top[k2], top[k]))
    base = lib.mesh_obj("map_base", bm, [m_base])
    lib.finalize(base, 50)
    lib.uv_box(base, 1.0)
    statics.append(base)
    for sid, (lon, lat, label) in PINS.items():
        x, y = proj(lon, lat)
        lib.empty(f"Pin_{sid}", (x, y, MAP_Z + map_height(lon, lat) + 0.05), size=0.2)
    return relief


def _area(poly):
    a = 0.0
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        a += x0 * y1 - x1 * y0
    return a / 2


def mats():
    M = {}
    M['paving'] = lib.material("M_Paving", (0.75, 0.68, 0.58), 0.8, albedo="paving_a", normal="paving_n",
                               rmap="paving_r")
    M['trim'] = lib.material("M_PlasterTrim", (0.85, 0.76, 0.62), 0.85, albedo="plaster_sand_a",
                             normal="plaster_n", rmap="plaster_r", normal_strength=0.9)
    M['white'] = lib.material("M_PlasterWhite", (0.95, 0.93, 0.88), 0.85, albedo="plaster_white_a",
                              normal="plaster_n", rmap="plaster_r", normal_strength=0.9)
    M['stone'] = lib.material("PZ_Stone", (0.78, 0.66, 0.52), 0.9, albedo="rock_a", normal="rock_n")
    M['wood'] = lib.material("M_DoorWood", (0.4, 0.25, 0.13), 0.6, albedo="wood_a", normal="wood_n", rmap="wood_r")
    M['wdark'] = lib.material("M_WoodDark", (0.25, 0.16, 0.09), 0.7, albedo="wood_dark_a", normal="wood_n",
                              rmap="wood_r")
    M['brass'] = lib.material("M_Brass", (0.86, 0.66, 0.34), 0.3, metal=1.0)
    M['iron'] = lib.material("M_Iron", (0.13, 0.12, 0.12), 0.5, metal=0.8)
    M['glass'] = lib.material("M_LanternGlass", (1.0, 0.85, 0.6), 0.3, emission=(1.0, 0.7, 0.38),
                              emission_strength=8.0)
    M['sand'] = lib.material("M_Sand", (0.88, 0.72, 0.5), 0.95, albedo="sand_a", normal="sand_n", rmap="sand_r")
    M['rock'] = lib.material("M_Rock", (0.5, 0.42, 0.35), 0.9, albedo="rock_a", normal="rock_n")
    M['water'] = lib.material("M_Water", (0.10, 0.32, 0.36), 0.05, metal=0.1)
    M['tile'] = lib.material("PZ_PoolTile", (0.12, 0.55, 0.62), 0.3)
    M['sail'] = lib.material("PZ_Sail", (0.95, 0.91, 0.82), 0.85, double_sided=True)
    M['rope'] = lib.material("Q_Rope", (0.55, 0.45, 0.3), 0.9)
    M['clay'] = lib.material("M_Clay", (0.66, 0.36, 0.2), 0.8)
    M['ivory'] = lib.material("PZ_Ivory", (0.95, 0.91, 0.80), 0.35)
    M['shell'] = lib.material("PZ_Shell", (0.34, 0.40, 0.20), 0.45)
    M['tskin'] = lib.material("PZ_TurtleSkin", (0.48, 0.50, 0.36), 0.6)
    M['coral1'] = lib.material("PZ_Coral1", (0.95, 0.45, 0.42), 0.6)
    M['coral2'] = lib.material("PZ_Coral2", (0.98, 0.70, 0.30), 0.6)
    M['robe'] = lib.material("PZ_Robe", (0.97, 0.97, 0.95), 0.7)
    M['kumma'] = lib.material("PZ_Kumma", (0.9, 0.85, 0.75), 0.6, albedo="embroid_a")
    M['silver'] = lib.material("G_Silver", (0.85, 0.85, 0.88), 0.25, metal=1.0)
    M['dress'] = lib.material("PZ_Dress", (0.55, 0.12, 0.45), 0.75, albedo="dress_a")
    M['emb'] = lib.material("G_Embroidery", (0.9, 0.7, 0.3), 0.45, metal=0.35, albedo="embroid_a")
    M['scarf'] = lib.material("G_Scarf", (0.75, 0.1, 0.25), 0.7, albedo="scarf_a", double_sided=True)
    M['sirwal'] = lib.material("G_Sirwal", (0.45, 0.06, 0.12), 0.75)
    M['mskin'] = lib.material("PZ_ManneSkin", (0.62, 0.48, 0.36), 0.5)
    M['fabric'] = lib.material("M_Fabric", (0.6, 0.1, 0.1), 0.85, albedo="fabric_a", normal="fabric_n")
    M['leaf'] = lib.material("PZ_Leaf", (0.36, 0.46, 0.22), 0.7)
    M['bark'] = lib.material("PZ_Bark", (0.58, 0.50, 0.42), 0.9)
    M['board'] = lib.material("M_Board", (0.93, 0.88, 0.77), 0.92)
    M['portal'] = lib.material("PZ_Portal", (0.1, 0.1, 0.1), 0.9, emission=(1.0, 0.8, 0.45), emission_strength=1.0)
    M['soil'] = lib.material("M_Soil", (0.36, 0.26, 0.18), 0.95)
    for sid, _, col in STATIONS:
        M['theme_' + sid] = lib.material("PZ_Theme_" + sid, col, 0.45, metal=0.1)
    return M


def arch_cut(w, spring, depth, M=None, bottom=-0.5, kind='pointed', k=0.3):
    return lib.cutter("cut", lambda bm: lib.prism(bm, lib.arch_pts(w, spring, kind, k, 16, bottom), depth, M=M))


def pavilion(M, sid, angle_deg, statics, wall_mat='white'):
    """Themed entrance facade. Local frame: front faces -Y, doorway centred at x = 0."""
    a = rad(angle_deg)
    px, py = R_PAV * math.cos(a), R_PAV * math.sin(a)
    W = Matrix.Translation((px, py, 0)) @ lib.Rz(a - math.pi / 2)
    lib.empty(f"Pav_{sid}", (px, py, 0), rot=(0, 0, a - math.pi / 2), size=1.0)

    def col_local(x, y, r, h):
        p = W @ Vector((x, y, 0))
        lib.col_circle(p.x, p.y, r, h)

    # main block with the arched doorway
    bm = bmesh.new()
    lib.box_mm(bm, -4.0, 4.0, -1.3, 1.3, 0, 6.3, M=W)
    block = lib.mesh_obj(f"pav_{sid}_block", bm, [M[wall_mat]])
    lib.bevel(block, 0.06, 2)
    lib.boolean(block, [arch_cut(2.7, 2.9, 4.0, M=W), arch_cut(3.5, 2.9, 0.6, M=W @ lib.T(0, -1.3, 0))])
    lib.finalize(block, 35)
    lib.uv_box(block, 3.0, (random.random(), random.random()))
    statics.append(block)
    for x in (-3.3, -2.25, 2.25, 3.3):
        col_local(x, 0, 0.95, 7)
    # flanking round towers with crenellations and a theme-coloured band
    bm = bmesh.new()
    for sx in (-1, 1):
        lib.cyl(bm, 0, 0, 0, 7.4, 1.25, 1.1, segs=28, M=W @ lib.T(sx * 4.5, 0.1, 0))
        lib.cyl(bm, 0, 0, 7.4, 0.3, 1.18, 1.3, segs=28, M=W @ lib.T(sx * 4.5, 0.1, 0))
        col_local(sx * 4.5, 0.1, 1.3, 9)
    tw = lib.mesh_obj(f"pav_{sid}_towers", bm, [M['trim']])
    lib.finalize(tw, 40)
    lib.uv_cyl(tw, 0, 0, 2.0)
    statics.append(tw)
    bm = bmesh.new()
    for sx in (-1, 1):
        lib.cyl(bm, 0, 0, 5.2, 0.35, 1.2, 1.17, segs=28, M=W @ lib.T(sx * 4.5, 0.1, 0))
        lib.crenels_ring(bm, (W @ Vector((sx * 4.5, 0.1, 0))).x, (W @ Vector((sx * 4.5, 0.1, 0))).y, 1.12, 7.7, 9,
                         w=0.5, d=0.32, h=0.42, tip=0.36, mi=1)
    tb = lib.mesh_obj(f"pav_{sid}_towerband", bm, [M['theme_' + sid], M['white']])
    lib.finalize(tb, 40)
    lib.uv_box(tb, 1.5)
    statics.append(tb)
    # theme-coloured band, cornice and sign board
    bm = bmesh.new()
    outer = lib.arch_pts(4.3, 2.9, 'pointed', 0.3, 16, 2.5)
    lib.prism(bm, outer, 0.18, M=W @ lib.T(0, -1.38, 0))
    band = lib.mesh_obj(f"pav_{sid}_band", bm, [M['theme_' + sid]])
    lib.boolean(band, [arch_cut(3.5, 2.9, 2.0, M=W @ lib.T(0, -1.3, 0), bottom=-1)])
    lib.finalize(band, 35)
    statics.append(band)
    bm = bmesh.new()
    lib.box_mm(bm, -4.2, 4.2, -1.5, 1.5, 6.3, 6.6, M=W)
    lib.box_mm(bm, -4.1, 4.1, -1.42, 1.42, 0, 0.5, M=W)
    lib.box_mm(bm, -1.95, 1.95, -1.62, -1.38, 4.0, 5.32, M=W)
    tr = lib.mesh_obj(f"pav_{sid}_trim", bm, [M['trim']])
    lib.bevel(tr, 0.04, 2)
    lib.boolean(tr, [arch_cut(3.5, 2.9, 4.0, M=W)])
    lib.finalize(tr, 35)
    lib.uv_box(tr, 2.5)
    statics.append(tr)
    # sign board (painted in the web app) and glowing portal
    bm = bmesh.new()
    lib.box_mm(bm, -1.8, 1.8, -0.03, 0.03, -0.55, 0.55)
    sign = lib.mesh_obj(f"Sign_{sid}", bm, [M['board']])
    sign.matrix_world = W @ lib.T(0, -1.66, 4.66)
    bm = bmesh.new()
    pts = lib.arch_pts(2.68, 2.88, 'pointed', 0.3, 16, 0.02)
    verts = [bm.verts.new((x, 0, z)) for x, z in pts]
    f = bm.faces.new(verts)
    uvl = bm.loops.layers.uv.verify()
    for l in f.loops:
        l[uvl].uv = ((l.vert.co.x + 1.34) / 2.68, l.vert.co.z / 4.2)
    portal = lib.mesh_obj(f"Portal_{sid}", bm, [M['portal']])
    portal.matrix_world = W @ lib.T(0, 0.25, 0)
    lib.flat(portal)
    # front pad with two lantern posts
    bm = bmesh.new()
    lib.cyl(bm, 0, 0, 0.0, 0.1, 3.4, 3.4, segs=40, M=W @ lib.T(0, -1.4, 0))
    pad = lib.mesh_obj(f"pav_{sid}_pad", bm, [M['trim']])
    lib.boolean(pad, [lib.cutter("c", lambda b: lib.box(b, (0, 0, 0), (9, 4, 1), M=W @ lib.T(0, 1.6, 0)))])
    lib.finalize(pad, 35)
    lib.uv_box(pad, 2.0)
    statics.append(pad)
    bm = bmesh.new()
    lights = []
    for sx in (-1, 1):
        p = W @ Vector((sx * 2.4, -2.9, 0))
        lights.append(scenery.lamp_post(bm, p.x, p.y, 0, 1, h=2.6))
        lib.col_circle(p.x, p.y, 0.22, 3)
    lp = lib.mesh_obj(f"pav_{sid}_lamps", bm, [M['iron'], M['glass']])
    lib.finalize(lp, 40)
    statics.append(lp)
    return W, col_local, lights


def decorate(M, sid, W, col_local, statics):
    bm = bmesh.new()
    mats_ = []

    def m(key):
        mat = M[key]
        if mat not in mats_:
            mats_.append(mat)
        return mats_.index(mat)

    if sid == "nav":
        # «مجلس العلم» (Hamad bin Saif: judge, historian, author): a great open book, a reading stand,
        # a manuscript chest; an open-book emblem crowns the gate
        lib.box(bm, (0, 0, 0.45), (1.7, 1.2, 0.9), mi=m('wdark'), M=W @ lib.T(-6.2, -2.4, 0))
        props.open_book(bm, W @ lib.T(-6.2, -2.4, 0.9) @ lib.Rx(rad(-14)), 1.55, 1.05, m('fabric'), m('board'), angle=0.2)
        col_local(-6.2, -2.4, 1.05, 1.5)
        props.lectern(bm, W @ lib.T(3.6, -2.9, 0) @ lib.Rz(rad(-15)), m('wdark'), m('fabric'), m('board'))
        col_local(3.6, -2.9, 0.4, 0.8)
        props.chest(bm, W @ lib.T(5.4, -1.2, 0), 1.1, 0.6, 0.6, m('wdark'), m('brass'))
        for k in range(5):
            props.scroll(bm, W @ lib.T(5.4, -1.35 + (k % 3) * 0.14, 0.68 + (k // 3) * 0.1), 0.6, 0.055, m('board'), m('wood'))
        col_local(5.4, -1.2, 0.7, 1.2)
        props.open_book(bm, W @ lib.T(0, -1.62, 6.0) @ lib.Rx(math.pi / 2), 1.3, 0.9, m('brass'), m('board'), angle=0.25)
    elif sid == "sumhuram":
        for (x, y, broken) in ((-3.0, -2.3, False), (3.0, -2.3, True), (-5.4, -0.6, True)):
            props.column(bm, W @ lib.T(x, y, 0), 4.6, 0.36, m('stone'), broken=broken)
            col_local(x, y, 0.5, 6)
        rnd = random.Random(5)
        for k in range(7):
            x, y = rnd.uniform(-7.5, 7.5), rnd.uniform(-4.2, -2.8)
            if abs(x) < 2.6:
                continue
            s = rnd.uniform(0.4, 0.8)
            lib.box(bm, (0, 0, s / 2), (s * 1.4, s, s), mi=m('stone'), M=W @ lib.T(x, y, 0) @ lib.Rz(rnd.uniform(0, 3)))
            col_local(x, y, s * 0.7, s)
        for (x, y, s) in ((5.2, -1.4, 1.1), (5.9, -0.7, 0.9), (4.7, -0.5, 0.8)):
            props.amphora(bm, W @ lib.T(x, y, 0), s, m('clay'))
            col_local(x, y, 0.25, 1)
        props.frankincense_tree(bm, W @ lib.T(-6.6, -2.4, 0), 1.3, m('bark'), m('leaf'), seed=3)
        col_local(-6.6, -2.4, 0.5, 3)
        lib.lathe(bm, [(0.0, 0.0), (0.25, 0.0), (0.18, 0.5), (0.3, 0.75), (0.3, 0.85), (0.0, 0.85)], segs=4,
                  M=W @ lib.T(2.3, -3.4, 0) @ lib.Rz(math.pi / 4), mi=m('clay'))
        col_local(2.3, -3.4, 0.35, 0.85)
        p = W @ Vector((2.3, -3.4, 0.9))
        lib.empty("Smoke_sumhuram", tuple(p), size=0.2)
        # broken crown
        for x in np.linspace(-3.8, 3.8, 9):
            hh = 0.3 + 0.5 * abs(math.sin(x * 2.3))
            lib.box(bm, (0, 0, 6.6 + hh / 2), (0.75, 2.4, hh), mi=m('stone'), M=W @ lib.T(x, 0, 0))
    elif sid == "ivory":
        # carved Zanzibar-style door frame inside the arch
        fr = W @ lib.T(0, -1.32, 0)
        outer = lib.arch_pts(3.3, 2.9, 'round', 0.3, 18, 0.0)
        inner = lib.arch_pts(2.7, 2.9, 'round', 0.3, 18, -0.1)
        lib.prism(bm, outer, 0.16, M=fr, mi=m('wdark'))
        for i in range(14):
            z = 0.2 + i * 0.2
            for sx in (-1, 1):
                lib.sphere(bm, (sx * 1.5, -0.1, z), 0.04, 8, 5, mi=m('brass'), M=fr)
        lib.box(bm, (0, -0.1, 3.0), (3.0, 0.1, 0.35), mi=m('wood'), M=fr)
        props.elephant(bm, W @ lib.T(-6.0, -2.0, 0.6) @ lib.Rz(rad(-25)), 1.6, {'body': m('ivory'), 'tusk': m('ivory')})
        lib.box(bm, (0, 0, 0.3), (2.6, 2.2, 0.6), mi=m('trim'), M=W @ lib.T(-6.0, -2.0, 0))
        col_local(-6.0, -2.0, 1.5, 3)
        props.chest(bm, W @ lib.T(5.0, -1.0, 0), 1.1, 0.6, 0.6, m('wdark'), m('brass'))
        props.chest(bm, W @ lib.T(5.1, -1.0, 0.6), 0.9, 0.5, 0.5, m('wood'), m('brass'))
        col_local(5.0, -1.0, 0.7, 1.2)
        for (x, y) in ((4.2, -2.4), (5.4, -2.6), (4.8, -3.1)):
            props.sack(bm, W @ lib.T(x, y, 0), 1.0, m('fabric'))
            col_local(x, y, 0.35, 0.7)
        # carved cornice + small domes
        for x in (-3.0, 0.0, 3.0):
            lib.lathe(bm, [(0.45, 6.6), (0.45, 6.8), (0.4, 7.05), (0.22, 7.3), (0.0, 7.4)], segs=16, M=W @ lib.T(x, 0, 0),
                      mi=m('theme_ivory'))
    elif sid == "turtles":
        # wave crown
        pts = [(x, 6.6 + 0.35 + 0.35 * math.sin(x * 1.6)) for x in np.linspace(4.1, -4.1, 24)]
        lib.prism(bm, [(-4.1, 6.6), (4.1, 6.6)] + pts, 2.6, mi=m('theme_turtles'), M=W)
        # turtle statue on a rock
        lib.ico(bm, W @ Vector((-5.8, -2.0, 0.35)), 0.9, 2, mi=m('stone'), scale=(1.4, 1.1, 0.55))
        props.turtle(bm, W @ lib.T(-5.8, -2.0, 0.75) @ lib.Rz(rad(-30)), 1.6, {'shell': m('shell'), 'skin': m('tskin')})
        col_local(-5.8, -2.0, 1.3, 1.3)
        # shallow beach basin with shells and coral
        bm2 = bmesh.new()
        lib.tube(bm2, 0, 0, 0, 0.45, 1.9, 1.7, segs=32)
        bm2.transform(W @ lib.T(5.4, -2.2, 0))
        bm.from_mesh(_tmp_mesh(bm2, m('trim')))
        lib.cyl(bm, 0, 0, 0.0, 0.25, 1.72, 1.72, segs=32, mi=m('sand'), M=W @ lib.T(5.4, -2.2, 0))
        rnd = random.Random(2)
        for k in range(8):
            a = rnd.uniform(0, TAU)
            r = rnd.uniform(0.3, 1.4)
            lib.ico(bm, W @ Vector((5.4 + math.cos(a) * r, -2.2 + math.sin(a) * r, 0.28)), rnd.uniform(0.08, 0.2), 1,
                    mi=m('coral1' if k % 2 else 'coral2'), scale=(1, 1, 1.6))
        col_local(5.4, -2.2, 1.95, 0.45)
        p = W @ Vector((5.4, -2.2, 0.33))
        bmw = bmesh.new()
        lib.cyl(bmw, p.x, p.y, 0.26, 0.04, 1.69, 1.69, segs=32)
        wtr = lib.mesh_obj("Water_TurtleBasin", bmw, [M['water']])
        lib.finalize(wtr, 40)
        lib.uv_box(wtr, 2.0)
        # mosaic dots around the arch
        for i in range(17):
            t = i / 16
            ang = math.pi * t
            x = 2.05 * math.cos(ang)
            z = 2.9 + 1.7 * math.sin(ang)
            lib.box(bm, (0, 0, 0), (0.22, 0.06, 0.22), mi=m('theme_turtles' if i % 2 else 'white'),
                    M=W @ lib.T(x, -1.5, z) @ lib.Ry(-ang + math.pi / 2))
    elif sid == "clothing":
        for sx, kind in ((-1, 'man'), (1, 'woman')):
            mm = W @ lib.T(sx * 5.4, -1.8, 0.05) @ lib.Rz(rad(sx * -15))
            mi_ = {'robe': m('robe') if kind == 'man' else m('dress'), 'skin': m('mskin'), 'kumma': m('kumma'),
                   'silver': m('silver'), 'stand': m('wdark'), 'emb': m('emb'), 'scarf': m('scarf'), 'sirwal': m('sirwal')}
            props.mannequin(bm, mm, kind, mi_, h=1.9)
            col_local(sx * 5.4, -1.8, 0.45, 2)
        # hanging textile banners on the facade
        for sx in (-1, 1):
            lib.box(bm, (0, 0, 0), (1.3, 0.05, 3.2), mi=m('fabric'), M=W @ lib.T(sx * 3.1, -1.36, 3.9))
            lib.cyl_axis(bm, W @ Vector((sx * 3.1 - 0.8, -1.42, 5.55)), W @ Vector((sx * 3.1 + 0.8, -1.42, 5.55)), 0.05,
                         segs=8, mi=m('wdark'))
        props.chest(bm, W @ lib.T(-3.2, -2.6, 0), 1.0, 0.55, 0.5, m('wdark'), m('brass'))
        col_local(-3.2, -2.6, 0.6, 0.6)
        for i, key in enumerate(('dress', 'scarf', 'robe')):
            lib.box(bm, (0, 0, 0), (0.8, 0.45, 0.12), mi=m(key), M=W @ lib.T(-3.2, -2.6, 0.56 + i * 0.12))
        # crenellated crown
        for x in np.linspace(-3.6, 3.6, 7):
            props_merlon(bm, W @ lib.T(x, 0, 6.6), m('theme_clothing'))
    ob = lib.mesh_obj(f"pav_{sid}_decor", bm, mats_)
    lib.finalize(ob, 40, recalc=False)
    lib.uv_box(ob, 1.5)
    statics.append(ob)


def props_merlon(bm, M, mi):
    lib.merlon(bm, M, w=0.65, d=1.2, h=0.55, tip=0.45, mi=mi)


def _tmp_mesh(bm2, mi):
    for f in bm2.faces:
        f.material_index = mi
    me = bpy.data.meshes.new("_tmp")
    bm2.to_mesh(me)
    bm2.free()
    return me


def bonus_gate(M, statics):
    a = rad(BONUS_ANGLE)
    px, py = (R_PAV + 4) * math.cos(a), (R_PAV + 4) * math.sin(a)
    W = Matrix.Translation((px, py, 0)) @ lib.Rz(a - math.pi / 2)
    lib.empty("Pav_bonus", (px, py, 0), rot=(0, 0, a - math.pi / 2), size=1.0)
    bm = bmesh.new()
    lib.box_mm(bm, -3.0, 3.0, -1.0, 1.0, 0, 5.0, M=W)
    blk = lib.mesh_obj("bonus_block", bm, [M['trim']])
    lib.bevel(blk, 0.05, 2)
    lib.boolean(blk, [arch_cut(2.4, 2.6, 3.0, M=W)])
    lib.finalize(blk, 35)
    lib.uv_box(blk, 3.0)
    statics.append(blk)
    bm = bmesh.new()
    for x in np.linspace(-2.6, 2.6, 6):
        lib.merlon(bm, W @ lib.T(x, 0, 5.0), w=0.6, d=1.6, h=0.5, tip=0.42)
    cr = lib.mesh_obj("bonus_crown", bm, [M['trim']])
    lib.uv_box(cr, 2.0)
    statics.append(cr)
    for x in (-2.0, 2.0):
        p = W @ Vector((x, 0, 0))
        lib.col_circle(p.x, p.y, 1.05, 6)
    bm = bmesh.new()
    lib.box_mm(bm, -1.5, 1.5, -0.03, 0.03, -0.42, 0.42)
    s = lib.mesh_obj("Sign_bonus", bm, [M['board']])
    s.matrix_world = W @ lib.T(0, -1.06, 3.65)
    bm = bmesh.new()
    pts = lib.arch_pts(2.38, 2.58, 'pointed', 0.3, 16, 0.02)
    f = bm.faces.new([bm.verts.new((x, 0, z)) for x, z in pts])
    uvl = bm.loops.layers.uv.verify()
    for l in f.loops:
        l[uvl].uv = ((l.vert.co.x + 1.2) / 2.4, l.vert.co.z / 3.8)
    portal = lib.mesh_obj("Portal_bonus", bm, [M['portal']])
    portal.matrix_world = W @ lib.T(0, 0.2, 0)


def build():
    lib.reset()
    lib.use_collection("Plaza")
    textures.build_all()
    random.seed(4)
    M = mats()
    statics = []

    # plaza floor, inner ring and outer wall
    bm = bmesh.new()
    lib.cyl(bm, 0, 0, -0.3, 0.36, 29.0, 29.0, segs=128)
    floor = lib.mesh_obj("plaza_floor", bm, [M['paving']])
    lib.boolean(floor, [lib.cutter("c", lambda b: lib.cyl(b, 0, 0, -1, 2, 10.0, 10.0, segs=96))])
    lib.finalize(floor, 40)
    lib.uv_box(floor, 3.5)
    statics.append(floor)
    bm = bmesh.new()
    lib.tube(bm, 0, 0, 0.0, 0.75, 10.6, 9.95, segs=96)          # pool rim
    lib.tube(bm, 0, 0, 0.0, 0.12, 13.6, 13.0, segs=96)          # decorative ring
    lib.tube(bm, 0, 0, 0.0, 1.0, 29.6, 29.0, segs=128)          # low perimeter wall
    rim = lib.mesh_obj("plaza_rims", bm, [M['trim']])
    lib.finalize(rim, 40)
    lib.uv_cyl(rim, 0, 0, 2.5)
    statics.append(rim)
    lib.col_circle(0, 0, 10.6, 0.75)
    bm = bmesh.new()
    for i in range(72):
        a = TAU * (i + 0.5) / 72
        lib.merlon(bm, lib.T(29.3 * math.cos(a), 29.3 * math.sin(a), 1.0) @ lib.Rz(a + math.pi / 2), w=0.7, d=0.6,
                   h=0.45, tip=0.38)
    mer = lib.mesh_obj("plaza_merlons", bm, [M['white']])
    lib.uv_box(mer, 2.0)
    statics.append(mer)
    # pool floor + water
    bm = bmesh.new()
    lib.cyl(bm, 0, 0, -0.35, 0.3, 10.0, 10.0, segs=96)
    pf = lib.mesh_obj("pool_floor", bm, [M['tile']])
    statics.append(pf)
    bm = bmesh.new()
    lib.cyl(bm, 0, 0, 0.3, 0.05, 9.98, 9.98, segs=96)
    water = lib.mesh_obj("Water_Pool", bm, [M['water']])
    lib.finalize(water, 40)
    lib.uv_box(water, 3.0)

    # relief map of Oman + little dhow + compass rose
    build_map(M, statics)
    bm = bmesh.new()
    props.dhow(bm, lib.T(5.4, -4.6, 0.42) @ lib.Rz(rad(150)), 1.6,
               {'hull': 0, 'deck': 0, 'sail': 1, 'rope': 2, 'trim': 3, 'wood': 0})
    boat = lib.mesh_obj("PoolDhow", bm, [M['wood'], M['sail'], M['rope'], M['brass']])
    lib.finalize(boat, 40, recalc=False)
    lib.uv_box(boat, 0.8)
    bm = bmesh.new()
    lib.cyl(bm, -6.2, -5.0, 0.36, 0.04, 1.3, 1.3, segs=48)
    for k in range(8):
        a = TAU * k / 8
        ln = 1.6 if k % 2 == 0 else 1.0
        tip = Vector((-6.2 + math.cos(a) * ln, -5.0 + math.sin(a) * ln, 0.42))
        side = Vector((-math.sin(a), math.cos(a), 0)) * 0.16
        c = Vector((-6.2, -5.0, 0.42))
        bm.faces.new((bm.verts.new(c + side), bm.verts.new(tip), bm.verts.new(c - side)))
    rose = lib.mesh_obj("compass_rose", bm, [M['brass']])
    lib.finalize(rose, 30)
    statics.append(rose)

    # five themed entrances + bonus gate
    for sid, ang, _ in STATIONS:
        W, col_local, lights = pavilion(M, sid, ang, statics, wall_mat='stone' if sid == 'sumhuram' else 'white')
        decorate(M, sid, W, col_local, statics)
        for i, p in enumerate(lights):
            lib.empty(f"Light_{sid}_{i}", p, size=0.3)
    bonus_gate(M, statics)

    # benches, planters with palms, perimeter lanterns
    bm = bmesh.new()
    palms = []
    for i, a in enumerate((rad(232), rad(308), rad(172), rad(118), rad(62), rad(8))):
        x, y = 15.6 * math.cos(a), 15.6 * math.sin(a)
        scenery.planter(bm, x, y, 0, 1, r=1.4)
        lib.col_circle(x, y, 1.45, 0.5)
        palms.append((x, y))
    for a in (rad(250), rad(290), rad(120), rad(60)):
        x, y = 12.2 * math.cos(a), 12.2 * math.sin(a)
        lib.box(bm, (0, 0, 0.42), (1.8, 0.5, 0.1), mi=0, M=lib.T(x, y, 0) @ lib.Rz(a + math.pi / 2))
        for sx in (-0.7, 0.7):
            lib.box(bm, (sx, 0, 0.2), (0.15, 0.45, 0.4), mi=0, M=lib.T(x, y, 0) @ lib.Rz(a + math.pi / 2))
        lib.col_circle(x, y, 0.8, 0.5)
    pl = lib.mesh_obj("plaza_planters", bm, [M['trim'], M['soil']])
    lib.finalize(pl, 40)
    lib.uv_box(pl, 2.0)
    statics.append(pl)
    bm = bmesh.new()
    lamps = []
    for i in range(12):
        a = TAU * (i + 0.5) / 12
        if any(abs(((a - rad(s[1])) + math.pi) % TAU - math.pi) < rad(12) for s in STATIONS):
            continue
        x, y = 27.4 * math.cos(a), 27.4 * math.sin(a)
        lamps.append(scenery.lamp_post(bm, x, y, 0, 1, h=3.2))
        lib.col_circle(x, y, 0.22, 3.5)
    lp = lib.mesh_obj("plaza_lamps", bm, [M['iron'], M['glass']])
    lib.finalize(lp, 40)
    statics.append(lp)
    for i, p in enumerate(lamps):
        lib.empty(f"Light_plaza_{i}", p, size=0.3)

    lib.join(statics, "Plaza_Static")

    # surroundings: dunes, mountains to the south and the sea to the north
    scenery.terrain("Terrain", (M['sand'], M['rock']), seed=12, dune_h=5, size=1400, res=200, flat_r=(40, 110),
                    corridor=(0, 1), flat_boxes=[(-45, 45, -45, 45, 25)], mtn_r=(220, 380), mtn_h=(40, 140),
                    mtn_bias=lambda a: np.clip(0.2 + 0.8 * (-np.sin(a)), 0.15, 1.0), sea_y=70)
    bm = bmesh.new()
    lib.box_mm(bm, -700, 700, 60, 700, -0.62, -0.6)
    sea = lib.mesh_obj("Water_Sea", bm, [M['water']])
    lib.uv_box(sea, 6.0)
    rnd = random.Random(9)
    pts = list(palms)
    for k in range(46):
        a = rnd.uniform(0, TAU)
        r = rnd.uniform(31.5, 46)
        pts.append((r * math.cos(a), r * math.sin(a)))
    scenery.scatter_palms(pts, seed=6)
    lib.empty("Spawn", (0, -16.5, 0), size=1.0)


if __name__ == "__main__":
    build()
    lib.export_glb("plaza")
    lib.export_colliders("plaza", bounds=dict(x0=-29, x1=29, z0=-29, z1=29), ground=0.06,
                         spawn=dict(x=0, z=16.5, yaw=3.14159), circle=dict(x=0, z=0, r=28.6))
    lib.setup_world()
    lib.add_sun((-0.4, -0.75, 0.5), 4.5)
    lib.add_camera((0, -46, 20), (0, 2, 1.5), 28)
    lib.setup_render((1600, 900), 32)
    lib.pack_and_save("plaza")
    lib.render_still(os.path.join(lib.RENDER_DIR, "plaza.jpg"))
    cam = bpy.context.scene.camera
    cam.location = (0, -19, 2.6)
    cam.rotation_euler = lib.look_rot(Vector((0, 8, 1.8)) - Vector(cam.location))
    cam.data.lens = 20
    lib.render_still(os.path.join(lib.RENDER_DIR, "plaza_eye.jpg"))
