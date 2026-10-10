"""Shared scenery pieces: terrain with Hajar-like mountains, lanterns, cannons, palms, doors."""
import math
import random
import numpy as np
import bmesh
from mathutils import Vector

import lib
from lib import TAU, rad
import textures


def sstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def terrain(name, mats, size=1400.0, res=220, flat_r=(40, 95), corridor=(9, 28), seed=3,
            dune_h=7.0, mtn_r=(230, 360), mtn_h=(45, 120), mtn_bias=None, flat_boxes=(), sea_y=None):
    """Sand terrain that is flat near the origin and rises into rocky mountains far away.

    mats = (sand, rock). `corridor` keeps a flat strip along the Y axis for the road.
    `mtn_bias(angle) -> factor` scales mountain height by direction.
    `flat_boxes` = [(x0, x1, y0, y1, margin)] extra flattened areas.
    """
    n = res + 1
    lin = np.linspace(-size / 2, size / 2, n, dtype=np.float32)
    X, Y = np.meshgrid(lin, lin)
    R = np.hypot(X, Y)
    k = 256
    dn = textures.noise(k, 3.4, seed)
    rn = 1 - np.abs(textures.noise(k, 2.6, seed + 1))
    sm = textures.noise(k, 3.6, seed + 4)
    fn = textures.noise(k, 2.0, seed + 2)

    def samp(a, scale):
        u = (X / scale) % 1.0 * (k - 1)
        v = (Y / scale) % 1.0 * (k - 1)
        i0, j0 = np.floor(u).astype(int), np.floor(v).astype(int)
        fu, fv = u - i0, v - j0
        i1, j1 = (i0 + 1) % k, (j0 + 1) % k
        return (a[j0, i0] * (1 - fu) * (1 - fv) + a[j0, i1] * fu * (1 - fv) +
                a[j1, i0] * (1 - fu) * fv + a[j1, i1] * fu * fv)
    dunes = dune_h * np.clip(0.5 + 0.35 * samp(dn, 900.0), 0, None) ** 1.4 + 1.2 * samp(fn, 1700.0)
    mask = sstep(flat_r[0], flat_r[1], R) * sstep(corridor[0], corridor[1], np.abs(X))
    for (x0, x1, y0, y1, mg) in flat_boxes:
        dx = np.maximum(np.maximum(x0 - X, X - x1), 0)
        dy = np.maximum(np.maximum(y0 - Y, Y - y1), 0)
        mask = mask * sstep(0, mg, np.hypot(dx, dy))
    h = dunes * mask
    ang = np.arctan2(Y, X)
    bias = mtn_bias(ang) if mtn_bias else 1.0
    # sample scales are >= res * grid spacing so the noise never aliases into spikes
    big = np.clip(0.5 + 0.32 * samp(sm, 3200.0), 0, 1)
    ridg = np.clip(samp(rn, 1900.0), 0, 1)
    ridges = big * (0.6 + 0.4 * ridg) + 0.05 * samp(fn, 1700.0)
    m = sstep(mtn_r[0], mtn_r[1], R) * (mtn_h[0] + (mtn_h[1] - mtn_h[0]) * np.clip(ridges, 0, None) ** 1.25) * bias + sstep(mtn_r[0] - 60, mtn_r[1] + 250, R) * 18 * bias
    h = h + m - 0.03
    if sea_y is not None:
        # coastline: the land slopes down below the water north of sea_y
        h = h - sstep(sea_y, sea_y + 35, Y) * (h + 4.0)
    bm = bmesh.new()
    verts = [[bm.verts.new((float(X[j, i]), float(Y[j, i]), float(h[j, i]))) for i in range(n)] for j in range(n)]
    for j in range(res):
        for i in range(res):
            f = bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
            hz = (h[j, i] + h[j, i + 1] + h[j + 1, i] + h[j + 1, i + 1]) / 4
            slope = abs(h[j, i] - h[j + 1, i + 1]) / (size / res)
            f.material_index = 1 if (hz > 16 + 4 * max(-1.0, min(1.0, float(fn[(j * 7) % k, (i * 7) % k])))) else 0
    ob = lib.mesh_obj(name, bm, list(mats))
    lib.finalize(ob, angle=89, merge=False, recalc=False)  # open surface: keep the +Z winding
    # different tiling for sand (near) and rock (far): uv in metres / tile
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        tile = 7.0 if f.material_index == 0 else 28.0
        for l in f.loops:
            co = l.vert.co
            l[uvl].uv = (co.x / tile, (co.y + co.z * 0.6) / tile)
    bm.to_mesh(me)
    bm.free()
    return ob


def lantern(bm, base, mi_metal, mi_glass, scale=1.0, hanging=False):
    """Omani brass lantern (فانوس). base = bottom centre."""
    s = scale
    M = lib.T(*base) @ lib.S(s)
    lib.lathe(bm, [(0.0, 0.0), (0.16, 0.0), (0.2, 0.06), (0.14, 0.1)], segs=6, M=M, mi=mi_metal, cap_bottom=False)
    lib.lathe(bm, [(0.14, 0.1), (0.17, 0.25), (0.17, 0.48), (0.13, 0.56)], segs=6, M=M, mi=mi_glass,
              cap_bottom=True, cap_top=True)
    lib.lathe(bm, [(0.15, 0.55), (0.24, 0.6), (0.12, 0.74), (0.04, 0.84), (0.05, 0.9), (0.0, 0.95)],
              segs=6, M=M, mi=mi_metal, cap_bottom=True)
    for i in range(6):
        a = TAU * (i + 0.5) / 6
        p0 = Vector(base) + Vector((math.cos(a) * 0.168 * s, math.sin(a) * 0.168 * s, 0.1 * s))
        p1 = p0 + Vector((0, 0, 0.47 * s))
        lib.cyl_axis(bm, p0, p1, 0.012 * s, segs=4, mi=mi_metal)
    if hanging:
        lib.torus(bm, lib.T(base[0], base[1], base[2] + 0.98 * s) @ lib.Rx(math.pi / 2), 0.05 * s, 0.012 * s,
                  10, 4, mi=mi_metal)
    return Vector(base) + Vector((0, 0, 0.33 * s))


def lamp_post(bm, x, y, mi_metal, mi_glass, h=3.4):
    lib.cyl(bm, x, y, 0, 0.35, 0.22, 0.18, segs=8, mi=mi_metal)
    lib.cyl(bm, x, y, 0.35, h - 0.35, 0.075, 0.06, segs=8, mi=mi_metal)
    lib.cyl(bm, x, y, h - 0.05, 0.08, 0.17, 0.17, segs=8, mi=mi_metal)
    return lantern(bm, (x, y, h + 0.03), mi_metal, mi_glass, 1.1)


def cannon(bm, x, y, yaw, mi_iron, mi_wood, elev=8):
    """Old bronze/iron cannon on a wooden carriage, barrel pointing along local -Y."""
    M = lib.T(x, y, 0) @ lib.Rz(yaw)
    # barrel along local Z then tipped to point -Y
    B = M @ lib.T(0, 0.35, 0.95) @ lib.Rx(math.pi / 2 - rad(elev))
    prof = [(0.0, -0.32), (0.09, -0.32), (0.13, -0.25), (0.11, -0.2), (0.26, -0.16), (0.28, 0.0),
            (0.27, 0.12), (0.30, 0.16), (0.24, 0.22), (0.22, 0.9), (0.25, 0.95), (0.2, 1.0),
            (0.17, 2.1), (0.21, 2.16), (0.21, 2.3), (0.12, 2.3), (0.12, 2.2), (0.0, 2.2)]
    lib.lathe(bm, prof, segs=18, M=B, mi=mi_iron, cap_bottom=False, cap_top=False)
    lib.cyl_axis(bm, (B @ Vector((-0.38, 0, 0.12))), (B @ Vector((0.38, 0, 0.12))), 0.06, segs=8, mi=mi_iron)
    # carriage cheeks
    for sx in (-0.33, 0.33):
        lib.box(bm, (sx, 0.25, 0.62), (0.1, 1.5, 0.42), mi=mi_wood, M=M)
        lib.box(bm, (sx, 0.85, 0.42), (0.1, 0.5, 0.42), mi=mi_wood, M=M)
    lib.box(bm, (0, 0.6, 0.45), (0.66, 0.8, 0.1), mi=mi_wood, M=M)
    # wheels
    for sx in (-0.48, 0.48):
        c = M @ Vector((sx, -0.1, 0.55))
        lib.cyl_axis(bm, c - (M.to_3x3() @ Vector((0.07, 0, 0))), c + (M.to_3x3() @ Vector((0.07, 0, 0))),
                     0.55, segs=20, mi=mi_wood)
        lib.cyl_axis(bm, c - (M.to_3x3() @ Vector((0.075, 0, 0))), c + (M.to_3x3() @ Vector((0.075, 0, 0))),
                     0.2, segs=12, mi=mi_iron)
    a0 = M @ Vector((-0.6, -0.1, 0.55))
    a1 = M @ Vector((0.6, -0.1, 0.55))
    lib.cyl_axis(bm, a0, a1, 0.05, segs=8, mi=mi_iron)


def door_leaf(name, w, spring, k, thickness, y, side, mats, gap=0.035, stud_r=0.05,
              stud_dx=0.42, stud_dz=0.55, bands=(0.6, 2.9, 5.0), knock_z=3.2):
    """One leaf of an Omani studded door shaped to a pointed arch. side=-1 left, +1 right.
    The object origin is the hinge so the web app can swing it open."""
    hw = w / 2
    xh = side * (hw - gap)
    xc = side * gap

    def top(x):
        return lib.arch_top_at(x, w, spring, k) - gap
    xs = [xc + (xh - xc) * i / 14 for i in range(15)]
    arc = [(x, top(x)) for x in xs]
    if side < 0:
        pts = [(xh, 0.02), (xc, 0.02)] + arc[:]
    else:
        pts = [(xc, 0.02), (xh, 0.02)] + list(reversed(arc))
    # remove duplicated corner points
    clean = []
    for p in pts:
        if not clean or (abs(p[0] - clean[-1][0]) > 1e-4 or abs(p[1] - clean[-1][1]) > 1e-4):
            clean.append(p)
    bm = bmesh.new()
    O = lib.T(-xh, -y, 0)
    lib.prism(bm, clean, thickness, M=O @ lib.T(0, y, 0), mi=0)
    front = y - thickness / 2
    xmin, xmax = min(xh, xc), max(xh, xc)
    # iron bands
    for bz in bands:
        if bz < top(xc) - 0.2:
            lib.box_mm(bm, xmin + 0.02, xmax - 0.02, front - 0.035, front, bz - 0.06, bz + 0.06, mi=2, M=O)
    # brass studs
    zz = 0.42
    while zz < top(xmax if side < 0 else xmin):
        xx = xmin + 0.22
        while xx < xmax - 0.15:
            if zz < top(xx) - 0.28:
                lib.sphere(bm, (xx, front - 0.01, zz), stud_r, u=8, v=5, mi=1, M=O, scale=(1, 0.65, 1))
            xx += stud_dx
        zz += stud_dz
    # ring knocker
    kx = xc + side * 0.45
    lib.cyl_axis(bm, O @ Vector((kx, front, knock_z + 0.18)), O @ Vector((kx, front - 0.04, knock_z + 0.18)), 0.09,
                 segs=12, mi=1)
    lib.torus(bm, O @ lib.T(kx, front - 0.07, knock_z) @ lib.Rx(math.pi / 2), 0.16, 0.022, 20, 6, mi=1)
    ob = lib.mesh_obj(name, bm, list(mats), loc=(xh, y, 0))
    lib.finalize(ob, angle=40)
    lib.uv_box(ob, 2.0)
    return ob


def scatter_palms(points, seed=1, prefix="Palm"):
    rnd = random.Random(seed)
    for i, (x, y) in enumerate(points):
        s = rnd.uniform(0.85, 1.25)
        e = lib.empty(f"{prefix}.{i:03d}", (x, y, 0), (rnd.uniform(-0.05, 0.05), rnd.uniform(-0.05, 0.05),
                                                       rnd.uniform(0, TAU)))
        e.scale = (s, s, s)


def planter(bm, x, y, mi_rim, mi_soil, r=1.3):
    lib.tube(bm, x, y, 0, 0.5, r, r - 0.22, segs=24, mi=mi_rim)
    lib.cyl(bm, x, y, 0, 0.4, r - 0.2, segs=24, mi=mi_soil)
