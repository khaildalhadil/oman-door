"""Reusable heritage props for the plaza and the station scenes.

Every builder appends geometry into a bmesh `bm` using a local matrix `M`
and a dict `mi` that maps semantic slots (e.g. 'wood', 'sail') to material indices.
Local convention: +Z up, models face -Y unless stated otherwise."""
import math
import random
from mathutils import Vector, Matrix

import lib
from lib import TAU, rad


def _mi(mi, key, default=0):
    return mi.get(key, default)


# ------------------------------------------------------------------ dhow
def dhow(bm, M, L=6.0, mi=None, sail=True, deck=True):
    """Omani wooden sailing ship (ghanjah-like). Bow points to local +X, keel at z = -draft."""
    mi = mi or {}
    W = L * 0.28
    D = L * 0.16
    n, m = 22, 8

    def half_beam(t):
        if t > 0.42:
            return W / 2 * max(0.0, 1 - ((t - 0.42) / 0.58) ** 2) ** 0.55
        return W / 2 * (0.78 + 0.22 * math.sqrt(max(0.0, 1 - ((0.42 - t) / 0.42) ** 2)))

    def keel(t):
        return D * (0.55 + 0.45 * math.sin(math.pi * min(1, t * 1.15)))

    def sheer(t):
        return D * 0.3 + D * 0.55 * (2 * t - 1) ** 4 + (D * 0.35 if t > 0.9 else 0) * (t - 0.9) / 0.1

    rows = []
    for i in range(n + 1):
        t = i / n
        x = -L / 2 + t * L
        b, k, s = max(half_beam(t), 0.004), keel(t), sheer(t)
        ring = []
        for j in range(-m, m + 1):
            phi = abs(j) / m * math.pi / 2
            y = math.copysign(b * math.sin(phi) ** 0.6, j) if j else 0.0
            z = -k * math.cos(phi) + s * math.sin(phi) ** 2
            ring.append(bm.verts.new(M @ Vector((x, y, z))))
        rows.append(ring)
    for i in range(n):
        for j in range(2 * m):
            f = bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
            f.material_index = _mi(mi, 'hull')
    # transom (stern board) + bow cap
    f = bm.faces.new(list(reversed(rows[0])))
    f.material_index = _mi(mi, 'hull')
    f = bm.faces.new(rows[-1])
    f.material_index = _mi(mi, 'hull')
    # gunwale rail
    for side in (-1, 1):
        pts = []
        for i in range(n + 1):
            t = i / n
            pts.append(M @ Vector((-L / 2 + t * L, side * max(half_beam(t), 0.0), sheer(t) + 0.02)))
        for a, c in zip(pts[:-1], pts[1:]):
            lib.cyl_axis(bm, a, c, L * 0.008, segs=5, mi=_mi(mi, 'trim', _mi(mi, 'hull')))
    if deck:
        dz = D * 0.28
        outline = []
        for i in range(n + 1):
            t = i / n
            outline.append((-L / 2 + t * L, max(half_beam(t) * 0.97 - 0.01, 0.0)))
        top = [bm.verts.new(M @ Vector((x, y, dz))) for x, y in outline] + \
              [bm.verts.new(M @ Vector((x, -y, dz))) for x, y in reversed(outline)]
        f = bm.faces.new(top)
        f.material_index = _mi(mi, 'deck', _mi(mi, 'hull'))
        # raised stern castle
        lib.box(bm, (0, 0, 0), (L * 0.2, W * 0.74, D * 0.32), mi=_mi(mi, 'hull'),
                M=M @ lib.T(-L / 2 + L * 0.11, 0, dz + D * 0.16))
        lib.box(bm, (0, 0, 0), (L * 0.21, W * 0.76, D * 0.03), mi=_mi(mi, 'deck', 0),
                M=M @ lib.T(-L / 2 + L * 0.11, 0, dz + D * 0.33))
        # carved stern ornament
        lib.box(bm, (0, 0, 0), (L * 0.012, W * 0.5, D * 0.12), mi=_mi(mi, 'trim', 0),
                M=M @ lib.T(-L / 2 - 0.005, 0, sheer(0) + D * 0.12))
    # bowsprit
    lib.cyl_axis(bm, M @ Vector((L * 0.4, 0, sheer(0.9) + D * 0.1)), M @ Vector((L * 0.68, 0, sheer(1) + D * 0.45)),
                 L * 0.012, L * 0.007, segs=6, mi=_mi(mi, 'wood', _mi(mi, 'hull')))
    if not sail:
        return
    # main mast (raked forward) and mizzen
    mast_base = Vector((L * 0.08, 0, D * 0.2))
    mast_top = Vector((L * 0.16, 0, D * 0.2 + L * 0.62))
    lib.cyl_axis(bm, M @ mast_base, M @ mast_top, L * 0.018, L * 0.011, segs=8, mi=_mi(mi, 'wood', 0))
    lib.cyl_axis(bm, M @ Vector((-L * 0.3, 0, D * 0.4)), M @ Vector((-L * 0.27, 0, D * 0.4 + L * 0.38)),
                 L * 0.012, L * 0.008, segs=8, mi=_mi(mi, 'wood', 0))
    # lateen yards and sails
    for (base, top_pt, ya, yb, sc) in ((mast_base, mast_top, Vector((-L * 0.32, 0, L * 0.18)), Vector((L * 0.52, 0, L * 0.78)), 1.0),
                                       (Vector((-L * 0.3, 0, D * 0.4)), Vector((-L * 0.27, 0, L * 0.42)),
                                        Vector((-L * 0.55, 0, L * 0.16)), Vector((-L * 0.05, 0, L * 0.5)), 0.6)):
        lib.cyl_axis(bm, M @ ya, M @ yb, L * 0.009, L * 0.005, segs=6, mi=_mi(mi, 'wood', 0))
        # sail hangs from the yard down to a tack point near the deck, with a gentle belly
        tack = Vector((ya.x + (yb.x - ya.x) * 0.15, 0, D * 0.55 + (1 - sc) * L * 0.1))
        clew = Vector((ya.x + (yb.x - ya.x) * 0.02 - L * 0.03, 0, D * 0.6 + (1 - sc) * L * 0.1))
        rowsS = []
        nu, nv = 10, 8
        for a in range(nu + 1):
            s_ = a / nu
            top = ya.lerp(yb, s_)
            bottom = clew.lerp(tack, min(1.0, s_ * 1.6))
            row = []
            for b_ in range(nv + 1):
                v_ = b_ / nv
                p = top.lerp(bottom, v_)
                p.y += math.sin(math.pi * v_) * math.sin(math.pi * s_) * L * 0.06
                row.append(bm.verts.new(M @ p))
            rowsS.append(row)
        for a in range(nu):
            for b_ in range(nv):
                if a / nu > 0.62 and b_ / nv > 0.7:
                    continue
                f = bm.faces.new((rowsS[a][b_], rowsS[a + 1][b_], rowsS[a + 1][b_ + 1], rowsS[a][b_ + 1]))
                f.material_index = _mi(mi, 'sail', 0)
    # rigging
    for (a, b_) in ((mast_top, Vector((L * 0.62, 0, sheer(1) + D * 0.4))), (mast_top, Vector((-L * 0.48, 0.0, D * 0.5))),
                    (mast_top, Vector((0, W * 0.48, D * 0.4))), (mast_top, Vector((0, -W * 0.48, D * 0.4)))):
        lib.cyl_axis(bm, M @ a, M @ b_, L * 0.0025, segs=3, mi=_mi(mi, 'rope', 0))


# ---------------------------------------------------------------- turtle
def turtle(bm, M, size=1.0, mi=None, pose=0.0):
    """Green sea turtle. Faces local -Y. size = shell length."""
    mi = mi or {}
    s = size
    lib.sphere(bm, (0, 0, 0.12 * s), 0.5 * s, 28, 14, mi=_mi(mi, 'shell'), M=M, scale=(0.78, 1.0, 0.36))
    lib.sphere(bm, (0, 0, 0.06 * s), 0.47 * s, 24, 10, mi=_mi(mi, 'skin'), M=M, scale=(0.74, 0.96, 0.14))
    # head + neck
    lib.sphere(bm, (0, -0.58 * s, 0.1 * s), 0.13 * s, 14, 10, mi=_mi(mi, 'skin'), M=M, scale=(0.9, 1.25, 0.8))
    lib.cyl_axis(bm, M @ Vector((0, -0.38 * s, 0.09 * s)), M @ Vector((0, -0.52 * s, 0.1 * s)), 0.09 * s, 0.08 * s,
                 segs=10, mi=_mi(mi, 'skin'))
    for sx in (-1, 1):
        lib.sphere(bm, (sx * 0.065 * s, -0.66 * s, 0.14 * s), 0.025 * s, 8, 6, mi=_mi(mi, 'eye', _mi(mi, 'skin')), M=M)
    # flippers: long front, short rear
    for sx in (-1, 1):
        fm = M @ lib.T(sx * 0.38 * s, -0.22 * s, 0.06 * s) @ lib.Rz(sx * rad(35 + 15 * pose)) @ lib.Rx(rad(8))
        lib.sphere(bm, (sx * 0.28 * s, 0, 0), 0.32 * s, 14, 8, mi=_mi(mi, 'skin'), M=fm, scale=(1.0, 0.32, 0.07))
        rm = M @ lib.T(sx * 0.3 * s, 0.38 * s, 0.05 * s) @ lib.Rz(sx * rad(-30))
        lib.sphere(bm, (sx * 0.12 * s, 0.05 * s, 0), 0.16 * s, 10, 6, mi=_mi(mi, 'skin'), M=rm, scale=(1.0, 0.55, 0.12))
    lib.cyl_axis(bm, M @ Vector((0, 0.45 * s, 0.07 * s)), M @ Vector((0, 0.56 * s, 0.05 * s)), 0.03 * s, 0.005 * s,
                 segs=6, mi=_mi(mi, 'skin'))


# -------------------------------------------------------------- elephant
def elephant(bm, M, size=1.0, mi=None):
    """Stylised elephant statue standing on +Z, facing local -Y. size = shoulder height."""
    mi = mi or {}
    s = size
    body = _mi(mi, 'body')
    lib.sphere(bm, (0, 0.05 * s, 0.82 * s), 0.55 * s, 24, 16, mi=body, M=M, scale=(0.8, 1.15, 0.75))
    lib.sphere(bm, (0, -0.62 * s, 1.0 * s), 0.34 * s, 20, 14, mi=body, M=M, scale=(0.95, 0.9, 1.0))
    for sx in (-1, 1):
        for sy in (-1, 1):
            lib.cyl(bm, sx * 0.26 * s, sy * 0.36 * s + 0.04 * s, 0.0, 0.62 * s, 0.13 * s, 0.15 * s, segs=14, mi=body, M=M)
            lib.cyl(bm, sx * 0.26 * s, sy * 0.36 * s + 0.04 * s, 0.0, 0.05 * s, 0.15 * s, 0.14 * s, segs=14,
                    mi=_mi(mi, 'toe', body), M=M)
        # ears
        em = M @ lib.T(sx * 0.3 * s, -0.5 * s, 1.02 * s) @ lib.Rz(sx * rad(25))
        lib.sphere(bm, (sx * 0.12 * s, 0, -0.04 * s), 0.3 * s, 16, 10, mi=body, M=em, scale=(0.9, 0.12, 1.1))
        # tusks
        pts = [Vector((sx * 0.16 * s, -0.78 * s, 0.82 * s)), Vector((sx * 0.2 * s, -0.98 * s, 0.7 * s)),
               Vector((sx * 0.18 * s, -1.12 * s, 0.76 * s))]
        lib.cyl_axis(bm, M @ pts[0], M @ pts[1], 0.045 * s, 0.035 * s, segs=8, mi=_mi(mi, 'tusk', body))
        lib.cyl_axis(bm, M @ pts[1], M @ pts[2], 0.035 * s, 0.01 * s, segs=8, mi=_mi(mi, 'tusk', body))
        lib.sphere(bm, (sx * 0.14 * s, -0.86 * s, 1.08 * s), 0.03 * s, 8, 6, mi=_mi(mi, 'eye', body), M=M)
    # trunk: a curling chain of tapered segments
    p = Vector((0, -0.86 * s, 0.92 * s))
    r = 0.12 * s
    ang = rad(-70)
    for k in range(9):
        d = Vector((0, -math.cos(ang) * 0.13 * s, math.sin(ang) * 0.13 * s))
        q = p + d
        lib.cyl_axis(bm, M @ p, M @ q, r, r * 0.88, segs=12, mi=body)
        lib.sphere(bm, q, r * 0.88, 10, 6, mi=body, M=M)
        p, r = q, r * 0.88
        ang += rad(-14 if k < 6 else 35)
    lib.cyl_axis(bm, M @ Vector((0, 0.68 * s, 0.9 * s)), M @ Vector((0, 0.8 * s, 0.45 * s)), 0.025 * s, 0.015 * s,
                 segs=6, mi=body)


# ------------------------------------------------------------- mannequin
def mannequin(bm, M, kind='man', mi=None, h=1.75):
    """Costume display figure (faceless). kind 'man' = dishdasha + kumma + khanjar,
    'woman' = embroidered kandoora + sirwal + lihaf, 'dhofar' = long velvet dress."""
    mi = mi or {}
    k = h / 1.75
    S = lib.S(k)
    MM = M @ S
    # base stand
    lib.cyl(bm, 0, 0, 0.0, 0.06, 0.32, 0.3, segs=24, mi=_mi(mi, 'stand'), M=MM)
    skin = _mi(mi, 'skin')
    lib.sphere(bm, (0, 0, 1.6), 0.11, 18, 12, mi=skin, M=MM, scale=(0.9, 0.95, 1.1))
    lib.cyl(bm, 0, 0, 1.42, 0.1, 0.05, 0.045, segs=12, mi=skin, M=MM)
    if kind == 'man':
        robe = _mi(mi, 'robe')
        lib.lathe_uv(bm, [(0.27, 0.04), (0.25, 0.4), (0.22, 0.9), (0.24, 1.15), (0.23, 1.32), (0.15, 1.44), (0.06, 1.48)],
                     segs=28, M=MM @ lib.S(1, 0.75, 1), mi=robe, cap_bottom=True)
        for sx in (-1, 1):
            lib.cyl_axis(bm, MM @ Vector((sx * 0.21, 0, 1.36)), MM @ Vector((sx * 0.3, -0.02, 0.85)), 0.055, 0.06,
                         segs=10, mi=robe)
            lib.sphere(bm, (sx * 0.31, -0.03, 0.8), 0.045, 10, 6, mi=skin, M=MM)
        # tassel (فراخة) at the neck
        lib.cyl_axis(bm, MM @ Vector((0, -0.17, 1.4)), MM @ Vector((0, -0.19, 1.2)), 0.008, segs=5, mi=_mi(mi, 'tassel', robe))
        lib.sphere(bm, (0, -0.19, 1.18), 0.022, 8, 6, mi=_mi(mi, 'tassel', robe), M=MM)
        # kumma (embroidered cap)
        lib.lathe_uv(bm, [(0.115, 1.66), (0.118, 1.72), (0.1, 1.77), (0.0, 1.78)], segs=24, M=MM, mi=_mi(mi, 'kumma'),
                     urep=3.0)
        if mi.get('masar') is not None:
            lib.torus(bm, MM @ lib.T(0, 0, 1.71) @ lib.S(1, 0.95, 0.6), 0.12, 0.035, 24, 8, mi=mi['masar'])
        # belt + khanjar
        lib.torus(bm, MM @ lib.T(0, 0, 0.98) @ lib.S(1, 0.75, 1), 0.235, 0.02, 32, 6, mi=_mi(mi, 'silver'))
        km = MM @ lib.T(0, -0.2, 0.92) @ lib.Rx(rad(-12))
        lib.box(bm, (0, 0, 0.06), (0.05, 0.03, 0.12), mi=_mi(mi, 'silver'), M=km)
        lib.torus_arc(bm, km @ lib.T(0.0, 0, -0.03) @ lib.Rx(math.pi / 2), 0.07, 0.022, rad(180), rad(330), 10, 6,
                      mi=_mi(mi, 'silver'))
        lib.sphere(bm, (0, 0, 0.14), 0.03, 8, 6, mi=_mi(mi, 'silver'), M=km)
    else:
        dress = _mi(mi, 'robe')
        hem = 0.06 if kind == 'dhofar' else 0.62
        prof = [(0.2 if kind == 'woman' else 0.36, hem), (0.2, 0.9), (0.2, 1.15), (0.19, 1.32), (0.13, 1.44), (0.06, 1.48)]
        if kind == 'dhofar':
            prof = [(0.4, 0.03), (0.3, 0.5), (0.22, 0.9), (0.2, 1.15), (0.19, 1.32), (0.13, 1.44), (0.06, 1.48)]
        lib.lathe_uv(bm, prof, segs=28, M=MM @ lib.S(1, 0.8, 1), mi=dress, cap_bottom=True, urep=2.0)
        lib.lathe_uv(bm, [(prof[0][0] + 0.006, prof[0][1]), (prof[0][0] + 0.004, prof[0][1] + 0.07)], segs=28,
                     M=MM @ lib.S(1, 0.8, 1), mi=_mi(mi, 'emb'), urep=6.0)
        if kind == 'woman':
            for sx in (-1, 1):
                lib.lathe_uv(bm, [(0.06, 0.06), (0.065, 0.25), (0.07, 0.62)], segs=14, M=MM @ lib.T(sx * 0.09, 0, 0),
                             mi=_mi(mi, 'sirwal'))
                lib.lathe_uv(bm, [(0.068, 0.04), (0.068, 0.17)], segs=14, M=MM @ lib.T(sx * 0.09, 0, 0),
                             mi=_mi(mi, 'emb'), urep=2.0)
        for sx in (-1, 1):
            lib.cyl_axis(bm, MM @ Vector((sx * 0.18, 0, 1.36)), MM @ Vector((sx * 0.28, -0.02, 0.86)), 0.05, 0.075,
                         segs=10, mi=dress)
            lib.lathe_uv(bm, [(0.077, 0.0), (0.077, 0.06)], segs=12,
                         M=MM @ lib.T(sx * 0.282, -0.02, 0.84), mi=_mi(mi, 'emb'), urep=2.0)
            lib.sphere(bm, (sx * 0.29, -0.03, 0.8), 0.04, 10, 6, mi=skin, M=MM)
        # lihaf: hood + drape
        lib.sphere(bm, (0, 0.01, 1.62), 0.135, 20, 14, mi=_mi(mi, 'scarf'), M=MM, scale=(1.0, 1.05, 1.08))
        lib.lathe_uv(bm, [(0.3, 0.95), (0.25, 1.2), (0.19, 1.42), (0.12, 1.55)], segs=20, M=MM,
                     a0=rad(-20), a1=rad(200), mi=_mi(mi, 'scarf'), urep=2.0)


# ------------------------------------------------------------ small props
def amphora(bm, M, s=1.0, mi=0):
    lib.lathe(bm, [(0.0, 0.0), (0.05 * s, 0.0), (0.1 * s, 0.08 * s), (0.22 * s, 0.35 * s), (0.2 * s, 0.6 * s),
                   (0.08 * s, 0.78 * s), (0.07 * s, 0.9 * s), (0.1 * s, 0.94 * s), (0.0, 0.94 * s)], segs=16, M=M, mi=mi)
    for sx in (-1, 1):
        lib.torus_arc(bm, M @ lib.T(sx * 0.12 * s, 0, 0.76 * s) @ lib.Rx(math.pi / 2), 0.07 * s, 0.015 * s,
                      rad(-80) if sx > 0 else rad(100), rad(80) if sx > 0 else rad(260), 8, 5, mi=mi)


def barrel(bm, M, s=1.0, mi_wood=0, mi_band=0):
    lib.lathe(bm, [(0.0, 0.0), (0.26 * s, 0.0), (0.31 * s, 0.4 * s), (0.26 * s, 0.8 * s), (0.0, 0.8 * s)], segs=18, M=M,
              mi=mi_wood)
    for z in (0.12, 0.68):
        lib.torus(bm, M @ lib.T(0, 0, z * s), 0.28 * s + 0.005, 0.012 * s, 20, 4, mi=mi_band)


def chest(bm, M, w=1.0, d=0.55, h=0.55, mi_wood=0, mi_brass=0):
    lib.box(bm, (0, 0, h * 0.45), (w, d, h * 0.9), mi=mi_wood, M=M)
    lib.box(bm, (0, 0, h * 0.95), (w * 1.03, d * 1.05, h * 0.12), mi=mi_wood, M=M)
    for i in range(5):
        for j in range(2):
            lib.sphere(bm, (-w * 0.4 + i * w * 0.2, -d / 2 - 0.005, h * 0.3 + j * h * 0.35), 0.018, 6, 4, mi=mi_brass, M=M,
                       scale=(1, 0.6, 1))
    lib.box(bm, (0, -d / 2 - 0.01, h * 0.75), (w * 0.12, 0.02, h * 0.2), mi=mi_brass, M=M)


def sack(bm, M, s=1.0, mi=0):
    lib.sphere(bm, (0, 0, 0.32 * s), 0.3 * s, 14, 10, mi=mi, M=M, scale=(1.0, 0.85, 1.15))
    lib.cyl(bm, 0, 0, 0.62 * s, 0.1 * s, 0.07 * s, 0.1 * s, segs=10, mi=mi, M=M)


def column(bm, M, h=4.0, r=0.32, mi=0, broken=False):
    lib.box(bm, (0, 0, 0.12), (r * 2.6, r * 2.6, 0.24), mi=mi, M=M)
    hh = h * (0.62 if broken else 1.0)
    lib.cyl(bm, 0, 0, 0.24, hh - 0.24, r, r * 0.9, segs=20, mi=mi, M=M)
    if not broken:
        lib.cyl(bm, 0, 0, h - 0.05, 0.18, r * 0.95, r * 1.3, segs=20, mi=mi, M=M)
        lib.box(bm, (0, 0, h + 0.2), (r * 2.8, r * 2.8, 0.18), mi=mi, M=M)
    else:
        # jagged top
        for i in range(6):
            a = TAU * i / 6
            lib.box(bm, (math.cos(a) * r * 0.55, math.sin(a) * r * 0.55, hh + 0.06 + (i % 3) * 0.05),
                    (r * 0.6, r * 0.6, 0.12 + (i % 3) * 0.1), mi=mi, M=M @ lib.Rz(a))


def frankincense_tree(bm, M, s=1.0, mi_bark=0, mi_leaf=0, seed=1):
    """Boswellia sacra: short gnarly multi-stemmed tree with sparse leaf clusters."""
    rnd = random.Random(seed)
    for k in range(4):
        a = TAU * k / 4 + rnd.uniform(-0.3, 0.3)
        base = Vector((0, 0, 0))
        p = base
        r = 0.09 * s
        d = Vector((math.cos(a) * 0.35, math.sin(a) * 0.35, 1.0)).normalized()
        for seg in range(4):
            q = p + d * (0.45 * s)
            lib.cyl_axis(bm, M @ p, M @ q, r, r * 0.78, segs=7, mi=mi_bark)
            p, r = q, r * 0.78
            d = (d + Vector((rnd.uniform(-0.4, 0.4), rnd.uniform(-0.4, 0.4), 0.15))).normalized()
            if seg >= 1:
                for _ in range(3):
                    c = p + Vector((rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25), rnd.uniform(-0.05, 0.2))) * s
                    lib.ico(bm, M @ c, 0.16 * s, 1, mi=mi_leaf, scale=(1.2, 1.2, 0.55))


def astrolabe(bm, M, r=0.4, mi=0):
    """Brass astrolabe facing local -Y."""
    R = M @ lib.Rx(math.pi / 2)
    lib.cyl(bm, 0, 0, -0.02 * r, 0.04 * r, r, r, segs=40, mi=mi, M=R)
    lib.torus(bm, R @ lib.T(0, 0, 0.03 * r), r * 0.98, 0.035 * r, 40, 6, mi=mi)
    lib.torus(bm, R @ lib.T(0, 0, 0.04 * r), r * 0.62, 0.02 * r, 32, 5, mi=mi)
    for k in range(12):
        a = TAU * k / 12
        lib.box(bm, (0, 0, 0), (0.035 * r, 0.6 * r, 0.03 * r), mi=mi, M=R @ lib.Rz(a) @ lib.T(0, 0.55 * r, 0.05 * r))
    lib.box(bm, (0, 0, 0), (1.9 * r, 0.06 * r, 0.03 * r), mi=mi, M=R @ lib.Rz(rad(30)) @ lib.T(0, 0, 0.08 * r))
    lib.torus(bm, R @ lib.T(0, r * 1.12, 0) @ lib.Rx(math.pi / 2), 0.12 * r, 0.03 * r, 16, 5, mi=mi)


def book_row(bm, M, length, rnd, mi_covers, mi_pages, h=(0.22, 0.32), depth=0.22):
    """A row of standing books along local +X, spines facing local -Y."""
    x = 0.0
    while x < length - 0.04:
        t = rnd.uniform(0.035, 0.075)
        hh = rnd.uniform(*h)
        mi = rnd.choice(mi_covers)
        lib.box(bm, (x + t / 2, 0, hh / 2), (t, depth, hh), mi=mi, M=M)
        lib.box(bm, (x + t / 2, 0.012, hh / 2), (t * 0.8, depth, hh * 0.92), mi=mi_pages, M=M)
        x += t + 0.004


def scroll(bm, M, length=0.5, r=0.05, mi_paper=0, mi_wood=0):
    """A rolled manuscript along local X."""
    lib.cyl_axis(bm, M @ Vector((-length / 2, 0, 0)), M @ Vector((length / 2, 0, 0)), r, segs=12, mi=mi_paper)
    for sx in (-1, 1):
        lib.cyl_axis(bm, M @ Vector((sx * length / 2, 0, 0)), M @ Vector((sx * (length / 2 + 0.04), 0, 0)), r * 0.45,
                     segs=8, mi=mi_wood)


def open_book(bm, M, w=0.42, d=0.3, mi_cover=0, mi_pages=0, angle=0.22):
    """Open book lying on a surface (spine along local Y)."""
    for sx in (-1, 1):
        R = M @ lib.Ry(-sx * angle)
        lib.box(bm, (sx * w / 4, 0, 0.008), (w / 2, d, 0.016), mi=mi_cover, M=R)
        lib.box(bm, (sx * w / 4 * 0.97, 0, 0.026), (w / 2 * 0.94, d * 0.94, 0.022), mi=mi_pages, M=R)


def lectern(bm, M, mi_wood=0, mi_cover=0, mi_pages=0):
    """Folding Qur'an-style reading stand (رحل) with an open book, facing local -Y."""
    for sx in (-1, 1):
        lib.box(bm, (0, sx * 0.08, 0.22), (0.42, 0.03, 0.5), mi=mi_wood, M=M @ lib.Rx(sx * 0.62))
    open_book(bm, M @ lib.T(0, -0.04, 0.42) @ lib.Rx(-0.55), 0.46, 0.32, mi_cover, mi_pages, angle=0.18)


def anchor(bm, M, s=1.0, mi=0):
    lib.cyl_axis(bm, M @ Vector((0, 0, 0.1 * s)), M @ Vector((0, 0, 1.4 * s)), 0.05 * s, segs=8, mi=mi)
    lib.cyl_axis(bm, M @ Vector((-0.35 * s, 0, 1.25 * s)), M @ Vector((0.35 * s, 0, 1.25 * s)), 0.04 * s, segs=8, mi=mi)
    lib.torus(bm, M @ lib.T(0, 0, 1.5 * s) @ lib.Rx(math.pi / 2), 0.1 * s, 0.025 * s, 14, 5, mi=mi)
    lib.torus_arc(bm, M @ lib.T(0, 0, 0.45 * s) @ lib.Rx(math.pi / 2), 0.45 * s, 0.045 * s, rad(195), rad(345), 14, 6,
                  mi=mi)
    for sx in (-1, 1):
        lib.cyl_axis(bm, M @ Vector((sx * 0.43 * s, 0, 0.36 * s)), M @ Vector((sx * 0.5 * s, 0, 0.6 * s)), 0.06 * s,
                     0.005 * s, segs=6, mi=mi)


def rope_coil(bm, M, s=1.0, mi=0):
    for k in range(4):
        lib.torus(bm, M @ lib.T(0, 0, 0.03 * s + k * 0.045 * s), 0.22 * s - k * 0.02 * s, 0.025 * s, 20, 5, mi=mi)


def lantern_post(bm, x, y, mi_metal, mi_glass, h=2.8, M=None):
    import scenery
    return scenery.lamp_post(bm, x, y, mi_metal, mi_glass, h)
