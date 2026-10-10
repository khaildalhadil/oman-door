"""Date palm (نخلة) - instanced many times in the web scenes."""
import sys
import os
import math
import random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bmesh
from mathutils import Vector
import lib
from lib import TAU, rad


def build():
    lib.reset()
    lib.use_collection("Palm")
    rnd = random.Random(7)

    m_trunk = lib.material("M_PalmTrunk", (0.55, 0.46, 0.36), 0.92, albedo="trunk_a", normal="trunk_n",
                           normal_strength=1.4)
    m_frond = lib.material("M_Frond", (0.30, 0.44, 0.17), 0.62, double_sided=True)
    m_old = lib.material("M_FrondOld", (0.60, 0.50, 0.26), 0.75, double_sided=True)
    m_dates = lib.material("M_Dates", (0.86, 0.52, 0.12), 0.38)

    H = 7.6
    lean = 0.055

    def center(t):
        return Vector((lean * H * t * t, 0.0, H * t))

    # ---------------- trunk ----------------
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    segs, rings_n = 14, 34
    rings = []
    for i in range(rings_n + 1):
        t = i / rings_n
        r = 0.27 * (1 - 0.22 * t) + 0.035 * (i % 2) + 0.16 * math.exp(-t * 14)
        c = center(t)
        rings.append([bm.verts.new(c + Vector((r * math.cos(TAU * k / segs), r * math.sin(TAU * k / segs), 0)))
                      for k in range(segs)])
    for i in range(rings_n):
        a, b = rings[i], rings[i + 1]
        for k in range(segs):
            k2 = (k + 1) % segs
            f = bm.faces.new((a[k], a[k2], b[k2], b[k]))
            for l, (kk, ii) in zip(f.loops, ((k, i), (k + 1, i), (k + 1, i + 1), (k, i + 1))):
                l[uvl].uv = (kk / segs * 2.0, (ii / rings_n) * H / 1.1)
    top = center(1.0)
    # crown bulb of leaf bases
    lib.lathe(bm, [(0.24, 0), (0.36, 0.35), (0.34, 0.75), (0.2, 1.05), (0.0, 1.2)], segs=segs,
              M=lib.T(*top), cap_bottom=False)
    trunk = lib.mesh_obj("Palm_Trunk", bm, [m_trunk])
    lib.finalize(trunk, angle=60)

    # ---------------- fronds ----------------
    bm = bmesh.new()
    n = 22
    up = Vector((0, 0, 1))
    for i in range(n):
        t = i / (n - 1)
        phi = i * 2.39996 + rnd.uniform(-0.2, 0.2)
        el = rad(-38 + 105 * t + rnd.uniform(-8, 8))
        L = rnd.uniform(3.3, 4.1) * (1.0 - 0.25 * max(0.0, t - 0.7))
        droop = 0.42 * (1.0 - 0.6 * t)
        old = t < 0.2
        mi = 1 if old else 0
        d = Vector((math.cos(el) * math.cos(phi), math.cos(el) * math.sin(phi), math.sin(el)))
        base = top + Vector((math.cos(phi) * 0.18, math.sin(phi) * 0.18, 0.45 + 0.55 * t))

        def spine(s):
            return base + d * (L * s) + Vector((0, 0, -droop * L * s * s))

        def tangent(s):
            return (d * L + Vector((0, 0, -2 * droop * L * s))).normalized()

        K = 28
        prev = None
        for k in range(K + 1):
            s = k / K
            p = spine(s)
            tg = tangent(s)
            side = tg.cross(up)
            if side.length < 1e-4:
                side = Vector((-math.sin(phi), math.cos(phi), 0))
            side.normalize()
            nf = side.cross(tg).normalized()
            w = 0.045 * (1 - s) + 0.008
            # rachis ribbon (vertical blade)
            cur = (bm.verts.new(p + nf * w), bm.verts.new(p - nf * w * 0.4))
            if prev:
                f = bm.faces.new((prev[0], prev[1], cur[1], cur[0]))
                f.material_index = mi
            prev = cur
            if s < 0.1:
                continue
            ll = 1.0 * math.sin(math.pi * min((s - 0.06) / 0.98, 1.0)) ** 0.65 + 0.15
            for sg in (-1, 1):
                ang = rad(28 + rnd.uniform(-6, 6))
                ld = (side * sg * math.cos(ang) + nf * math.sin(ang) + tg * 0.45).normalized()
                lw = 0.055
                b0 = p
                mid = b0 + ld * ll * 0.5 + Vector((0, 0, -0.05 * ll))
                tip = b0 + ld * ll + Vector((0, 0, -0.22 * ll * (1 - t * 0.5)))
                f = bm.faces.new((bm.verts.new(b0), bm.verts.new(mid - tg * lw),
                                  bm.verts.new(tip), bm.verts.new(mid + tg * lw)))
                f.material_index = mi
    fronds = lib.mesh_obj("Palm_Fronds", bm, [m_frond, m_old])
    lib.finalize(fronds, angle=80, recalc=False, merge=False)

    # ---------------- date clusters ----------------
    bm = bmesh.new()
    for c in range(3):
        a = TAU * c / 3 + 0.5
        root = top + Vector((math.cos(a) * 0.25, math.sin(a) * 0.25, 0.55))
        cc = top + Vector((math.cos(a) * 0.75, math.sin(a) * 0.75, -0.15))
        lib.cyl_axis(bm, root, cc, 0.035, 0.02, segs=5)
        for j in range(34):
            h = rnd.uniform(0.0, 0.7)
            rr = 0.22 * (1 - h / 0.9) + 0.04
            aa = rnd.uniform(0, TAU)
            p = cc + Vector((math.cos(aa) * rr, math.sin(aa) * rr, -h))
            lib.sphere(bm, p, 0.032, u=6, v=4, scale=(1, 1, 1.45))
    dates = lib.mesh_obj("Palm_Dates", bm, [m_dates])
    lib.finalize(dates, angle=80)

    for ob in (fronds, dates):
        lib.uv_box(ob, 1.0)
    return trunk


if __name__ == "__main__":
    build()
    lib.export_glb("palm")
    lib.setup_world()
    lib.add_sun((-0.4, -0.7, 0.55), 4.5)
    lib.add_camera((7, -11, 5.5), (0.3, 0, 6.2), 40)
    lib.setup_render((800, 800), 32)
    lib.pack_and_save("palm")
    lib.render_still(os.path.join(lib.RENDER_DIR, "palm.jpg"))
