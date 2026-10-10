"""ساحة التحدي - the quiz court beside Nizwa Fort: a palm-frond shelter (عريش) with a
scoreboard, ten question pedestals in a ring, lantern poles with festive bunting in the
colours of the Omani flag and a mosaic floor. Placed in Nizwa-Fort space (Blender coords)."""
import sys
import os
import math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy
import bmesh
from mathutils import Vector
import lib
import scenery
import textures
from lib import TAU, rad

CX, CY = 11.0, -21.0          # court centre (in front of the round tower)
R_COURT = 12.6
R_STATIONS = 8.4
N_STATIONS = 10


def mats():
    M = {}
    M['court'] = lib.material("Q_Court", (0.85, 0.75, 0.6), 0.8, albedo="court_a")
    M['trim'] = lib.material("M_FortTrim", (0.85, 0.74, 0.6), 0.88, albedo="plaster_sand_a", normal="plaster_n",
                             rmap="plaster_r")
    M['white'] = lib.material("M_PlasterWhite", (0.95, 0.93, 0.88), 0.85, albedo="plaster_white_a",
                              normal="plaster_n", rmap="plaster_r", normal_strength=0.9)
    M['trunk'] = lib.material("M_PalmTrunk", (0.55, 0.46, 0.36), 0.92, albedo="trunk_a", normal="trunk_n")
    M['weave'] = lib.material("M_Weave", (0.7, 0.56, 0.36), 0.85, albedo="weave_a", normal="weave_n",
                              double_sided=True)
    M['frond'] = lib.material("M_FrondOld", (0.60, 0.50, 0.26), 0.75, double_sided=True)
    M['wood'] = lib.material("M_WoodDark", (0.25, 0.16, 0.09), 0.7, albedo="wood_dark_a", normal="wood_n",
                             rmap="wood_r")
    M['brass'] = lib.material("M_Brass", (0.86, 0.66, 0.34), 0.3, metal=1.0)
    M['iron'] = lib.material("M_Iron", (0.13, 0.12, 0.12), 0.5, metal=0.8)
    M['glass'] = lib.material("M_LanternGlass", (1.0, 0.85, 0.6), 0.3, emission=(1.0, 0.7, 0.38),
                              emission_strength=8.0)
    M['carpet'] = lib.material("M_Carpet", (0.6, 0.1, 0.1), 0.95, albedo="carpet_a", normal="carpet_n")
    M['fabric'] = lib.material("M_Fabric", (0.6, 0.1, 0.1), 0.85, albedo="fabric_a", normal="fabric_n")
    M['board'] = lib.material("M_Board", (0.93, 0.88, 0.77), 0.92)
    M['red'] = lib.material("Q_FlagRed", (0.80, 0.10, 0.14), 0.7, double_sided=True)
    M['green'] = lib.material("Q_FlagGreen", (0.05, 0.50, 0.22), 0.7, double_sided=True)
    M['whitef'] = lib.material("Q_FlagWhite", (0.97, 0.96, 0.92), 0.7, double_sided=True)
    M['clay'] = lib.material("M_Clay", (0.66, 0.36, 0.2), 0.8)
    M['rope'] = lib.material("Q_Rope", (0.55, 0.45, 0.3), 0.9)
    return M


def build():
    lib.reset()
    lib.use_collection("QuizCourt")
    M = mats()
    statics = []

    # ------------------------------------------------------------- floor
    bm = bmesh.new()
    lib.cyl(bm, CX, CY, 0.0, 0.12, R_COURT, R_COURT, segs=96)
    floor = lib.mesh_obj("court_floor", bm, [M['court']])
    me = floor.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops:
            co = l.vert.co
            l[uvl].uv = ((co.x - CX) / (2 * R_COURT) + 0.5, (co.y - CY) / (2 * R_COURT) + 0.5)
    bm.to_mesh(me)
    bm.free()
    lib.finalize(floor, 40)
    statics.append(floor)
    bm = bmesh.new()
    lib.tube(bm, CX, CY, 0.0, 0.22, R_COURT + 0.45, R_COURT - 0.02, segs=96)
    ring = lib.mesh_obj("court_ring", bm, [M['trim']])
    lib.finalize(ring, 40)
    lib.uv_cyl(ring, CX, CY, 2.0)
    statics.append(ring)

    # ------------------------------------------------------ areesh shelter
    h = 3.3
    s = 2.7
    bm = bmesh.new()
    for sx in (-1, 1):
        for sy in (-1, 1):
            lib.cyl(bm, CX + sx * s, CY + sy * s, 0.1, h, 0.17, 0.14, segs=12)
            lib.col_circle(CX + sx * s, CY + sy * s, 0.22, 5)
    posts = lib.mesh_obj("areesh_posts", bm, [M['trunk']])
    lib.finalize(posts, 50)
    lib.uv_cyl(posts, CX, CY, 1.1)
    statics.append(posts)
    bm = bmesh.new()
    for sy in (-1, 1):
        lib.box_mm(bm, CX - s - 0.3, CX + s + 0.3, CY + sy * s - 0.09, CY + sy * s + 0.09, h, h + 0.18)
    for sx in (-1, 1):
        lib.box_mm(bm, CX + sx * s - 0.09, CX + sx * s + 0.09, CY - s - 0.3, CY + s + 0.3, h + 0.18, h + 0.34)
    for i in range(9):
        x = CX - s + 2 * s * i / 8
        lib.cyl_axis(bm, (x, CY - s - 0.2, h + 0.4), (x, CY + s + 0.2, h + 0.4), 0.05, segs=6)
    beams = lib.mesh_obj("areesh_beams", bm, [M['wood']])
    lib.finalize(beams, 40)
    lib.uv_box(beams, 1.2)
    statics.append(beams)
    # thatch: woven mat + layered frond fringe
    bm = bmesh.new()
    lib.box_mm(bm, CX - s - 0.5, CX + s + 0.5, CY - s - 0.5, CY + s + 0.5, h + 0.45, h + 0.62)
    mat_roof = lib.mesh_obj("areesh_roof", bm, [M['weave']])
    lib.finalize(mat_roof, 40)
    lib.uv_box(mat_roof, 1.4)
    statics.append(mat_roof)
    bm = bmesh.new()
    rnd = __import__('random').Random(4)
    edge = s + 0.5
    for side in range(4):
        for i in range(34):
            t = -edge + 2 * edge * (i + rnd.random() * 0.5) / 34
            ln = rnd.uniform(0.35, 0.6)
            if side == 0:
                p, n = Vector((CX + t, CY - edge, h + 0.55)), Vector((0, -1, 0))
            elif side == 1:
                p, n = Vector((CX + t, CY + edge, h + 0.55)), Vector((0, 1, 0))
            elif side == 2:
                p, n = Vector((CX - edge, CY + t, h + 0.55)), Vector((-1, 0, 0))
            else:
                p, n = Vector((CX + edge, CY + t, h + 0.55)), Vector((1, 0, 0))
            tang = Vector((-n.y, n.x, 0)) * 0.05
            tip = p + n * 0.12 + Vector((0, 0, -ln))
            f = bm.faces.new((bm.verts.new(p - tang), bm.verts.new(p + tang), bm.verts.new(tip)))
    fringe = lib.mesh_obj("areesh_fringe", bm, [M['frond']])
    lib.finalize(fringe, 80, recalc=False)
    statics.append(fringe)
    # frond bundle on top
    bm = bmesh.new()
    for i in range(40):
        a = rnd.uniform(0, TAU)
        p = Vector((CX + rnd.uniform(-s, s), CY + rnd.uniform(-s, s), h + 0.62))
        d = Vector((math.cos(a), math.sin(a), 0.05))
        side = Vector((-d.y, d.x, 0)) * 0.12
        q = p + d * rnd.uniform(1.0, 1.6)
        bm.faces.new((bm.verts.new(p - side), bm.verts.new(p + side), bm.verts.new(q + side * 0.2),
                      bm.verts.new(q - side * 0.2)))
    top = lib.mesh_obj("areesh_top", bm, [M['frond']])
    lib.finalize(top, 80, recalc=False)
    statics.append(top)

    # carpet + cushions under the shelter
    bm = bmesh.new()
    lib.box_mm(bm, CX - 2.0, CX + 2.0, CY - 1.4, CY + 1.4, 0.12, 0.14)
    cp = lib.mesh_obj("areesh_carpet", bm, [M['carpet']])
    lib.uv_fit(cp, 1, 0)
    statics.append(cp)
    bm = bmesh.new()
    lib.box_mm(bm, CX - 2.2, CX + 2.2, CY + 1.6, CY + 2.3, 0.12, 0.42)
    lib.box_mm(bm, CX - 2.2, CX + 2.2, CY + 2.2, CY + 2.45, 0.42, 0.85)
    cus = lib.mesh_obj("areesh_cushions", bm, [M['fabric']])
    lib.bevel(cus, 0.05, 2)
    lib.finalize(cus, 40)
    lib.uv_box(cus, 1.2)
    statics.append(cus)
    lib.col_box(CX - 2.2, CX + 2.2, CY + 1.6, CY + 2.45, 0.42)

    # scoreboard (faces -Y) on two legs
    bm = bmesh.new()
    for sx in (-1, 1):
        lib.box_mm(bm, CX + sx * 1.55 - 0.07, CX + sx * 1.55 + 0.07, CY + 0.9, CY + 1.04, 0.1, 2.9)
    lib.box_mm(bm, CX - 1.62, CX + 1.62, CY + 0.88, CY + 1.06, 1.05, 1.17)
    lib.box_mm(bm, CX - 1.62, CX + 1.62, CY + 0.88, CY + 1.06, 2.83, 2.95)
    lib.box_mm(bm, CX - 1.62, CX - 1.5, CY + 0.88, CY + 1.06, 1.05, 2.95)
    lib.box_mm(bm, CX + 1.5, CX + 1.62, CY + 0.88, CY + 1.06, 1.05, 2.95)
    crest = lib.arch_pts(1.6, 2.95, 'pointed', 0.6, 12, 2.95)
    lib.prism(bm, crest, 0.12, M=lib.T(CX, CY + 0.97, 0))
    sbf = lib.mesh_obj("scoreboard_frame", bm, [M['wood']])
    lib.finalize(sbf, 40)
    lib.uv_box(sbf, 1.0)
    statics.append(sbf)
    lib.col_box(CX - 1.62, CX + 1.62, CY + 0.88, CY + 1.06, 3)
    bm = bmesh.new()
    lib.box_mm(bm, -1.5, 1.5, -0.02, 0.04, -0.83, 0.83)
    sb = lib.mesh_obj("Scoreboard", bm, [M['board']], loc=(CX, CY + 0.9, 2.0))

    # ------------------------------------------------------------ stations
    bm = bmesh.new()
    for i in range(N_STATIONS):
        a = -math.pi / 2 + TAU * i / N_STATIONS
        x, y = CX + R_STATIONS * math.cos(a), CY + R_STATIONS * math.sin(a)
        M8 = lib.T(x, y, 0.12) @ lib.Rz(math.pi / 8)
        lib.lathe(bm, [(0.0, 0.0), (0.5, 0.0), (0.5, 0.14), (0.42, 0.2), (0.33, 0.26), (0.3, 0.8), (0.36, 0.86),
                       (0.44, 0.92), (0.44, 1.0), (0.0, 1.0)], segs=8, M=M8)
        lib.col_circle(x, y, 0.52, 1.12)
        lib.empty(f"Station_{i + 1:02d}", (x, y, 1.15), size=0.3)
    ped = lib.mesh_obj("stations", bm, [M['white']])
    lib.finalize(ped, 30)
    lib.uv_box(ped, 1.0)
    statics.append(ped)
    bm = bmesh.new()
    for i in range(N_STATIONS):
        a = -math.pi / 2 + TAU * i / N_STATIONS
        x, y = CX + R_STATIONS * math.cos(a), CY + R_STATIONS * math.sin(a)
        M8 = lib.T(x, y, 0.12) @ lib.Rz(math.pi / 8)
        lib.lathe(bm, [(0.0, 1.0), (0.45, 1.0), (0.45, 1.04), (0.38, 1.06), (0.0, 1.06)], segs=8, M=M8)
        lib.lathe(bm, [(0.34, 0.5), (0.345, 0.5), (0.345, 0.56), (0.34, 0.56)], segs=8, M=M8)
    caps = lib.mesh_obj("station_caps", bm, [M['brass']])
    lib.finalize(caps, 30)
    statics.append(caps)

    # ------------------------------------------- lantern poles and bunting
    bm = bmesh.new()
    poles = []
    lights = []
    n_poles = 8
    for i in range(n_poles):
        a = TAU * (i + 0.5) / n_poles
        x, y = CX + (R_COURT - 0.3) * math.cos(a), CY + (R_COURT - 0.3) * math.sin(a)
        lights.append(scenery.lamp_post(bm, x, y, 0, 1, h=4.0))
        poles.append(Vector((x, y, 4.0)))
        lib.col_circle(x, y, 0.28, 4)
    lp = lib.mesh_obj("court_lamps", bm, [M['iron'], M['glass']])
    lib.finalize(lp, 40)
    statics.append(lp)
    for i, p in enumerate(lights):
        lib.empty(f"Light.{i:03d}", p, size=0.3)

    bm_r, bm_w, bm_g, bm_rope = bmesh.new(), bmesh.new(), bmesh.new(), bmesh.new()
    flags = [bm_r, bm_w, bm_g]
    anchors = poles + [Vector((CX + sx * s, CY + sy * s, h + 0.2)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    pairs = [(poles[i], poles[(i + 1) % n_poles]) for i in range(n_poles)]
    # strings from each pole to the nearest shelter corner (festive canopy)
    for i in range(n_poles):
        c = min(anchors[n_poles:], key=lambda q: (q - poles[i]).length)
        pairs.append((poles[i], c))
    k = 0
    for (pa, pb) in pairs:
        L = (pb - pa).length
        n = max(4, int(L / 0.55))
        sag = 0.06 * L
        pts = [pa.lerp(pb, t / n) + Vector((0, 0, -sag * 4 * (t / n) * (1 - t / n))) for t in range(n + 1)]
        for t in range(n):
            lib.cyl_axis(bm_rope, pts[t], pts[t + 1], 0.012, segs=4)
        for t in range(n):
            a, b = pts[t], pts[t + 1]
            mid = a.lerp(b, 0.5)
            tip = mid + Vector((0, 0, -0.32))
            f = flags[k % 3].faces.new((flags[k % 3].verts.new(a.lerp(b, 0.1)), flags[k % 3].verts.new(a.lerp(b, 0.9)),
                                        flags[k % 3].verts.new(tip)))
            k += 1
    for bmx, mat, name in ((bm_r, M['red'], "bunting_red"), (bm_w, M['whitef'], "bunting_white"),
                           (bm_g, M['green'], "bunting_green")):
        ob = lib.mesh_obj(name, bmx, [mat])
        lib.finalize(ob, 89, recalc=False, merge=False)
        statics.append(ob)
    rope = lib.mesh_obj("bunting_rope", bm_rope, [M['rope']])
    lib.finalize(rope, 60)
    statics.append(rope)

    # ------------------------------------------------- entrance sign + pots
    sx, sy = CX - 4.5, CY - R_COURT - 1.2
    bm = bmesh.new()
    for dx in (-1.6, 1.6):
        lib.cyl(bm, CX + dx, sy, 0.0, 3.6, 0.14, 0.12, segs=10)
        lib.col_circle(CX + dx, sy, 0.2, 4)
    lib.box_mm(bm, CX - 1.9, CX + 1.9, sy - 0.08, sy + 0.08, 3.55, 3.68)
    sign_frame = lib.mesh_obj("sign_posts", bm, [M['trunk']])
    lib.finalize(sign_frame, 50)
    lib.uv_box(sign_frame, 1.0)
    statics.append(sign_frame)
    bm = bmesh.new()
    lib.box_mm(bm, -1.55, 1.55, -0.04, 0.04, -0.42, 0.42)
    sign = lib.mesh_obj("Sign_Court", bm, [M['board']], loc=(CX, sy - 0.1, 2.95))
    bm = bmesh.new()
    lib.box_mm(bm, CX - 1.68, CX + 1.68, sy - 0.12, sy - 0.06, 2.48, 3.42)
    sgf = lib.mesh_obj("sign_frame", bm, [M['wood']])
    statics.append(sgf)
    bm = bmesh.new()
    for (px, py, sc) in ((CX - 2.4, sy + 0.2, 1.1), (CX + 2.4, sy + 0.2, 1.0), (CX + 2.9, sy + 0.6, 0.7)):
        lib.lathe(bm, [(0.0, 0), (0.25 * sc, 0), (0.42 * sc, 0.3 * sc), (0.38 * sc, 0.62 * sc), (0.18 * sc, 0.8 * sc),
                       (0.22 * sc, 0.9 * sc), (0.0, 0.9 * sc)], segs=16, M=lib.T(px, py, 0))
        lib.col_circle(px, py, 0.4 * sc, 0.9 * sc)
    pots = lib.mesh_obj("court_pots", bm, [M['clay']])
    lib.finalize(pots, 40)
    statics.append(pots)

    for ob in statics:
        if not ob.data.uv_layers:
            lib.uv_box(ob, 1.5)
    lib.join(statics, "Quiz_Static")
    lib.empty("Court_Center", (CX, CY, 0.12), size=1)
    lib.empty("Court_Entry", (CX - 4.5, CY - R_COURT - 3.5, 0.0), size=1)


if __name__ == "__main__":
    textures.build_all()
    build()
    lib.export_glb("quiz_court")
    lib.export_colliders("quiz_court", court=dict(x=CX, z=-CY, r=R_COURT))
    lib.setup_world()
    lib.add_sun((-0.6, -0.7, 0.5), 4.5)
    lib.add_camera((CX - 14, CY - 22, 9), (CX, CY, 1.5), 32)
    lib.setup_render((1280, 720), 32)
    lib.pack_and_save("quiz_court")
    lib.render_still(os.path.join(lib.RENDER_DIR, "quiz_court.jpg"))
