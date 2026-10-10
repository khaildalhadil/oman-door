"""بوابة عُمان - a monumental Omani gateway inspired by the traditional city gates
(central pointed arch, twin round towers, crenellated parapets, studded doors)."""
import sys
import os
import math
import random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bmesh
import lib
import scenery
from lib import TAU, rad

GW, GD, GH = 9.0, 4.0, 11.0          # gatehouse half width, half depth, height
ARCH_W, ARCH_SPRING = 6.0, 5.6       # main arch
SIDE_W, SIDE_SPRING, SIDE_X = 2.4, 3.0, 6.2
TOWER_X = GW + 2.4


def mats():
    M = {}
    M['white'] = lib.material("M_PlasterWhite", (0.95, 0.93, 0.88), 0.85, albedo="plaster_white_a",
                              normal="plaster_n", rmap="plaster_r", normal_strength=0.9)
    M['trim'] = lib.material("M_PlasterTrim", (0.85, 0.76, 0.62), 0.85, albedo="plaster_sand_a",
                             normal="plaster_n", rmap="plaster_r", normal_strength=0.9)
    M['wood'] = lib.material("M_DoorWood", (0.4, 0.25, 0.13), 0.6, albedo="wood_a", normal="wood_n", rmap="wood_r")
    M['brass'] = lib.material("M_Brass", (0.86, 0.66, 0.34), 0.3, metal=1.0)
    M['iron'] = lib.material("M_Iron", (0.13, 0.12, 0.12), 0.5, metal=0.8)
    M['paving'] = lib.material("M_Paving", (0.75, 0.68, 0.58), 0.8, albedo="paving_a", normal="paving_n",
                               rmap="paving_r")
    M['sand'] = lib.material("M_Sand", (0.88, 0.72, 0.5), 0.95, albedo="sand_a", normal="sand_n", rmap="sand_r")
    M['rock'] = lib.material("M_Rock", (0.5, 0.42, 0.35), 0.9, albedo="rock_a", normal="rock_n")
    M['glass'] = lib.material("M_LanternGlass", (1.0, 0.85, 0.6), 0.3, emission=(1.0, 0.7, 0.38),
                              emission_strength=8.0)
    M['soil'] = lib.material("M_Soil", (0.36, 0.26, 0.18), 0.95)
    M['flagpole'] = lib.material("M_Pole", (0.92, 0.92, 0.9), 0.35, metal=0.6)
    return M


def arch_cut(w, spring, depth, x=0.0, y=0.0, bottom=-0.5, k=0.3, kind='pointed'):
    return lib.cutter("cut", lambda bm: lib.prism(bm, lib.arch_pts(w, spring, kind, k, 16, bottom), depth,
                                                  M=lib.T(x, y, 0)))


def gatehouse(M):
    statics = []
    # ---- main block with arches -------------------------------------------------
    bm = bmesh.new()
    lib.box_mm(bm, -GW, GW, -GD, GD, 0, GH)
    block = lib.mesh_obj("gate_block", bm, [M['white']])
    lib.bevel(block, 0.07, 2)
    cuts = [arch_cut(ARCH_W, ARCH_SPRING, GD * 2 + 2)]
    for sx in (-1, 1):
        cuts.append(arch_cut(SIDE_W, SIDE_SPRING, GD * 2 + 2, x=sx * SIDE_X))
    for sy in (-1, 1):
        cuts.append(arch_cut(ARCH_W + 1.3, ARCH_SPRING, 0.7, y=sy * GD))
        for sx in (-1, 1):
            cuts.append(arch_cut(SIDE_W + 0.6, SIDE_SPRING, 0.6, x=sx * SIDE_X, y=sy * GD))
            # blind niches in the upper storey
            cuts.append(arch_cut(1.5, 8.2, 0.6, x=sx * SIDE_X, y=sy * GD, bottom=6.6))
            cuts.append(arch_cut(0.8, 8.6, 0.5, x=sx * (SIDE_X + 1.55), y=sy * GD, bottom=7.4, kind='round'))
            cuts.append(arch_cut(0.8, 8.6, 0.5, x=sx * (SIDE_X - 1.55), y=sy * GD, bottom=7.4, kind='round'))
    lib.boolean(block, cuts)
    statics.append(block)

    # plinth / base course
    bm = bmesh.new()
    lib.box_mm(bm, -GW - 0.25, GW + 0.25, -GD - 0.25, GD + 0.25, 0, 0.85)
    plinth = lib.mesh_obj("gate_plinth", bm, [M['trim']])
    lib.bevel(plinth, 0.05, 2)
    lib.boolean(plinth, [arch_cut(ARCH_W + 1.3, ARCH_SPRING, GD * 2 + 2)] +
                [arch_cut(SIDE_W + 0.6, SIDE_SPRING, GD * 2 + 2, x=s * SIDE_X) for s in (-1, 1)])
    statics.append(plinth)

    # arch archivolts (raised trim around the arches)
    bm = bmesh.new()
    for sy in (-1, 1):
        outer = lib.arch_pts(ARCH_W + 2.0, ARCH_SPRING, 'pointed', 0.3, 16, ARCH_SPRING - 0.4)
        lib.prism(bm, outer, 0.24, M=lib.T(0, sy * (GD + 0.08), 0))
    arv = lib.mesh_obj("gate_archivolt", bm, [M['trim']])
    lib.boolean(arv, [arch_cut(ARCH_W + 1.3, ARCH_SPRING + 0.0, GD * 2 + 2, bottom=-1)])
    statics.append(arv)

    # cornices and string course
    bm = bmesh.new()
    lib.box_mm(bm, -GW - 0.18, GW + 0.18, -GD - 0.18, GD + 0.18, GH - 0.3, GH)
    lib.box_mm(bm, -GW - 0.38, GW + 0.38, -GD - 0.38, GD + 0.38, GH, GH + 0.38)
    lib.box_mm(bm, -GW - 0.1, GW + 0.1, -GD - 0.12, GD + 0.12, 6.1, 6.35)
    cor = lib.mesh_obj("gate_cornice", bm, [M['trim']])
    lib.bevel(cor, 0.04, 2)
    lib.boolean(cor, [arch_cut(ARCH_W + 1.3, ARCH_SPRING, GD * 2 + 2)])
    statics.append(cor)

    # parapet + merlons
    bm = bmesh.new()
    lib.rect_frame(bm, -GW - 0.1, GW + 0.1, -GD - 0.1, GD + 0.1, GH + 0.38, 0.85, 0.45)
    lib.crenels_rect(bm, -GW + 0.125, GW - 0.125, -GD + 0.125, GD - 0.125, GH + 1.23, 1.2)
    par = lib.mesh_obj("gate_parapet", bm, [M['white']])
    statics.append(par)

    # central crown above the arch with the brass medallion
    bm = bmesh.new()
    lib.box_mm(bm, -4.4, 4.4, -GD - 0.1, -GD + 3.2, GH + 0.38, GH + 3.6)
    crown = lib.mesh_obj("gate_crown", bm, [M['white']])
    lib.bevel(crown, 0.06, 2)
    lib.boolean(crown, [arch_cut(0.9, GH + 2.5, 0.6, x=sx, y=-GD - 0.1, bottom=GH + 1.2, kind='round')
                        for sx in (-3.1, 3.1)])
    statics.append(crown)
    bm = bmesh.new()
    lib.box_mm(bm, -4.62, 4.62, -GD - 0.32, -GD + 3.42, GH + 3.6, GH + 3.95)
    lib.crenels_line(bm, (-4.3, -GD + 0.12), (4.3, -GD + 0.12), GH + 3.95, 1.07, w=0.62, d=0.4, h=0.5, tip=0.42)
    lib.crenels_line(bm, (-4.3, -GD + 3.0), (-4.3, -GD + 0.6), GH + 3.95, 1.1, w=0.62, d=0.4, h=0.5, tip=0.42)
    lib.crenels_line(bm, (4.3, -GD + 0.6), (4.3, -GD + 3.0), GH + 3.95, 1.1, w=0.62, d=0.4, h=0.5, tip=0.42)
    cc = lib.mesh_obj("gate_crown_cornice", bm, [M['trim']])
    statics.append(cc)

    # brass medallion (emblem plate) and ring
    bm = bmesh.new()
    y0 = -GD - 0.1
    lib.cyl_axis(bm, (0, y0, GH + 1.95), (0, y0 - 0.14, GH + 1.95), 1.0, segs=48)
    lib.cyl_axis(bm, (0, y0 - 0.1, GH + 1.95), (0, y0 - 0.24, GH + 1.95), 0.7, 0.62, segs=48)
    lib.torus(bm, lib.T(0, y0 - 0.14, GH + 1.95) @ lib.Rx(math.pi / 2), 1.0, 0.07, 48, 8)
    # stylised crossed swords and dagger relief
    for sgn in (-1, 1):
        lib.cyl_axis(bm, (sgn * 0.62, y0 - 0.26, GH + 1.35), (-sgn * 0.62, y0 - 0.26, GH + 2.55), 0.035, segs=6)
    lib.cyl_axis(bm, (0, y0 - 0.3, GH + 1.45), (0, y0 - 0.3, GH + 2.45), 0.07, 0.02, segs=8)
    lib.box(bm, (0, y0 - 0.3, GH + 2.18), (0.5, 0.06, 0.08))
    med = lib.mesh_obj("gate_medallion", bm, [M['brass']])
    statics.append(med)

    # wall lanterns with brackets
    bm = bmesh.new()
    lights = []
    for sx in (-1, 1):
        x = sx * 4.18
        lib.box(bm, (x, -GD - 0.25, 6.0), (0.08, 0.5, 0.08), mi=0)
        lights.append(scenery.lantern(bm, (x, -GD - 0.48, 5.55), 0, 1, 1.0))
        x2 = sx * 4.18
        lib.box(bm, (x2, GD + 0.25, 6.0), (0.08, 0.5, 0.08), mi=0)
        lights.append(scenery.lantern(bm, (x2, GD + 0.48, 5.55), 0, 1, 1.0))
    lan = lib.mesh_obj("gate_lanterns", bm, [M['brass'], M['glass']])
    statics.append(lan)
    for i, p in enumerate(lights):
        lib.empty(f"Light.{i:03d}", p, size=0.3)
    return statics


def tower(M, x, name, flag_name):
    statics = []
    r0, r1, h = 3.65, 3.15, 15.5

    def r_at(z):
        return r0 + (r1 - r0) * z / h
    bm = bmesh.new()
    lib.cyl(bm, x, 0, 0, h, r0, r1, segs=56)
    body = lib.mesh_obj(name + "_body", bm, [M['white']])
    cuts = []
    for z in (7.4, 11.8):
        for a in (-90, -55, -125, 90, 35, 145):
            th = rad(a)
            rr = r_at(z)
            cuts.append(lib.cutter("slit", lambda bm, th=th, rr=rr, z=z: lib.box(
                bm, (0, 0, 0), (1.6, 0.22, 1.15), M=lib.T(x + rr * math.cos(th), rr * math.sin(th), z) @ lib.Rz(th))))
    lib.boolean(body, cuts)
    statics.append(body)

    bm = bmesh.new()
    lib.cyl(bm, x, 0, 0, 1.0, r0 + 0.3, r0 + 0.18, segs=56)
    for z in (5.2, 10.6):
        lib.cyl(bm, x, 0, z, 0.32, r_at(z) + 0.14, r_at(z + 0.32) + 0.14, segs=56)
    lib.cyl(bm, x, 0, h, 0.45, r1 + 0.05, r1 + 0.32, segs=56)
    trim = lib.mesh_obj(name + "_trim", bm, [M['trim']])
    statics.append(trim)

    bm = bmesh.new()
    lib.tube(bm, x, 0, h + 0.45, 1.0, r1 + 0.22, r1 - 0.25, segs=56)
    lib.crenels_ring(bm, x, 0, r1 - 0.01, h + 1.45, 15, w=0.72, d=0.46, h=0.55, tip=0.45)
    par = lib.mesh_obj(name + "_parapet", bm, [M['white']])
    statics.append(par)

    bm = bmesh.new()
    lib.cyl(bm, x, 0, h + 0.45, 7.0, 0.075, 0.06, segs=10)
    lib.sphere(bm, (x, 0, h + 7.55), 0.16, 10, 6, mi=1)
    pole = lib.mesh_obj(name + "_pole", bm, [M['flagpole'], M['brass']])
    statics.append(pole)
    lib.empty(flag_name, (x, 0, h + 7.25), size=0.5)

    for ob in statics:
        lib.finalize(ob, 35)
        lib.uv_cyl(ob, x, 0, 3.0)
    return statics


def side_walls(M):
    statics = []
    for sx in (-1, 1):
        x0, x1 = sx * 13.6, sx * 33.5
        xa, xb = min(x0, x1), max(x0, x1)
        bm = bmesh.new()
        lib.box_mm(bm, xa, xb, -0.85, 0.85, 0, 7.4)
        wall = lib.mesh_obj("wall", bm, [M['white']])
        lib.bevel(wall, 0.05, 2)
        cuts = []
        n = 4
        for i in range(n):
            cx = xa + (xb - xa) * (i + 0.5) / n
            cuts.append(arch_cut(1.3, 4.6, 0.5, x=cx, y=-0.85, bottom=2.4))
            cuts.append(arch_cut(1.3, 4.6, 0.5, x=cx, y=0.85, bottom=2.4))
        lib.boolean(wall, cuts)
        statics.append(wall)
        bm = bmesh.new()
        lib.box_mm(bm, xa, xb, -1.05, 1.05, 0, 0.7)
        lib.box_mm(bm, xa, xb, -1.08, 1.08, 7.4, 7.72)
        for i in range(n + 1):
            px = xa + (xb - xa) * i / n
            if abs(px) < 14.5:
                continue
            lib.box_mm(bm, px - 0.4, px + 0.4, -1.15, 1.15, 0, 7.4)
        tr = lib.mesh_obj("wall_trim", bm, [M['trim']])
        lib.bevel(tr, 0.04, 2)
        statics.append(tr)
        bm = bmesh.new()
        lib.crenels_line(bm, (xa, 0), (xb, 0), 7.72, 1.2, w=0.7, d=0.5, h=0.55, tip=0.45)
        statics.append(lib.mesh_obj("wall_merlons", bm, [M['white']]))
        # end tower
        ex = sx * 35.2
        bm = bmesh.new()
        lib.cyl(bm, ex, 0, 0, 10.2, 2.75, 2.35, segs=40)
        et = lib.mesh_obj("end_tower", bm, [M['white']])
        lib.uv_cyl(et, ex, 0, 3.0)
        bm = bmesh.new()
        lib.cyl(bm, ex, 0, 0, 0.8, 3.0, 2.9, segs=40)
        lib.cyl(bm, ex, 0, 10.2, 0.4, 2.4, 2.6, segs=40)
        lib.cyl(bm, ex, 0, 6.0, 0.28, 2.62, 2.6, segs=40)
        et2 = lib.mesh_obj("end_tower_trim", bm, [M['trim']])
        lib.uv_cyl(et2, ex, 0, 3.0)
        bm = bmesh.new()
        lib.tube(bm, ex, 0, 10.6, 0.85, 2.5, 2.1, segs=40)
        lib.crenels_ring(bm, ex, 0, 2.3, 11.45, 11, w=0.66, d=0.42, h=0.5, tip=0.42)
        et3 = lib.mesh_obj("end_tower_par", bm, [M['white']])
        lib.uv_cyl(et3, ex, 0, 3.0)
        for o in (et, et2, et3):
            lib.finalize(o, 35)
        statics += [et, et2, et3]
    return statics


def grounds(M):
    statics = []
    bm = bmesh.new()
    # plaza, passage and roads (paving)
    lib.box_mm(bm, -24, 24, -28, -4.3, -0.4, 0.06)
    lib.box_mm(bm, -2.95, 2.95, -4.3, 4.3, -0.4, 0.06)
    lib.box_mm(bm, -SIDE_X - 1.2, -SIDE_X + 1.2, -4.3, 4.3, -0.4, 0.06)
    lib.box_mm(bm, SIDE_X - 1.2, SIDE_X + 1.2, -4.3, 4.3, -0.4, 0.06)
    lib.box_mm(bm, -14, 14, 4.3, 22, -0.4, 0.06)
    lib.box_mm(bm, -4.5, 4.5, -170, -28, -0.4, 0.05)
    lib.box_mm(bm, -4.5, 4.5, 22, 160, -0.4, 0.05)
    pav = lib.mesh_obj("paving", bm, [M['paving']])
    lib.finalize(pav, 35)
    lib.uv_box(pav, 4.0)
    statics.append(pav)

    bm = bmesh.new()
    # curbs
    for sx in (-1, 1):
        lib.box_mm(bm, sx * 4.5 - 0.2, sx * 4.5 + 0.2, -170, -28, -0.2, 0.22)
        lib.box_mm(bm, sx * 4.5 - 0.2, sx * 4.5 + 0.2, 22, 160, -0.2, 0.22)
    lib.box_mm(bm, -24.2, -4.5, -28.2, -27.8, -0.2, 0.22)
    lib.box_mm(bm, 4.5, 24.2, -28.2, -27.8, -0.2, 0.22)
    lib.box_mm(bm, -24.2, -23.8, -28.2, -4.3, -0.2, 0.22)
    lib.box_mm(bm, 23.8, 24.2, -28.2, -4.3, -0.2, 0.22)
    # steps up to the gate
    lib.box_mm(bm, -GW - 0.8, GW + 0.8, -GD - 1.6, -GD - 0.2, -0.2, 0.14)
    for sx in (-1, 1):
        scenery.planter(bm, sx * 18.5, -9.5, 0, 1)
        scenery.planter(bm, sx * 18.5, -22.5, 0, 1)
        scenery.planter(bm, sx * 12.0, -24.5, 0, 1)
    curbs = lib.mesh_obj("curbs", bm, [M['trim'], M['soil']])
    lib.finalize(curbs, 35)
    lib.uv_box(curbs, 3.0)
    statics.append(curbs)

    # cannons and lamp posts
    bm = bmesh.new()
    scenery.cannon(bm, -7.6, -11.0, rad(10), 0, 1)
    scenery.cannon(bm, 7.6, -11.0, rad(-10), 0, 1)
    can = lib.mesh_obj("cannons", bm, [M['iron'], M['wood']])
    lib.finalize(can, 40)
    lib.uv_box(can, 1.5)
    statics.append(can)

    bm = bmesh.new()
    lamps = []
    for y in (-34, -54, -74, -94, -114):
        for sx in (-1, 1):
            lamps.append(scenery.lamp_post(bm, sx * 5.4, y, 0, 1))
    for (x, y) in ((-22.5, -26.5), (22.5, -26.5), (-22.5, -6), (22.5, -6)):
        lamps.append(scenery.lamp_post(bm, x, y, 0, 1))
    lp = lib.mesh_obj("lamps", bm, [M['iron'], M['glass']])
    lib.finalize(lp, 40)
    statics.append(lp)
    base = len([o for o in lib.bpy.data.objects if o.name.startswith("Light.")])
    for i, p in enumerate(lamps):
        lib.empty(f"Light.{base + i:03d}", p, size=0.3)
    return statics


def build():
    lib.reset()
    lib.use_collection("OmanGate")
    M = mats()
    statics = []
    statics += gatehouse(M)
    for ob in statics:
        lib.finalize(ob, 35)
        lib.uv_box(ob, 3.0, (0.13, 0.31))
    statics += tower(M, -TOWER_X, "towerL", "Flag_L")
    statics += tower(M, TOWER_X, "towerR", "Flag_R")
    sw = side_walls(M)
    for ob in sw:
        if not ob.data.uv_layers:
            lib.finalize(ob, 35)
            lib.uv_box(ob, 3.0, (0.41, 0.07))
    statics += sw
    statics += grounds(M)

    lib.join(statics, "Gate_Static")

    # doors (separate so they can swing open in the web app)
    for side, name in ((-1, "DoorL"), (1, "DoorR")):
        scenery.door_leaf(name, ARCH_W, ARCH_SPRING, 0.3, 0.24, 0.0, side, [M['wood'], M['brass'], M['iron']])

    # terrain with dunes and far mountains
    scenery.terrain("Terrain", (M['sand'], M['rock']), seed=5, dune_h=8,
                    flat_boxes=[(-40, 40, -40, 30, 25)],
                    mtn_bias=lambda a: 0.55 + 0.45 * (0.5 + 0.5 * __import__('numpy').sin(a * 3 + 1.0)))

    # palms
    rnd = random.Random(11)
    pts = []
    for y in range(-160, -30, 10):
        for sx in (-1, 1):
            pts.append((sx * (8.5 + rnd.uniform(-0.6, 0.8)), y + rnd.uniform(-1.5, 1.5)))
    for sx in (-1, 1):
        pts += [(sx * 18.5, -9.5), (sx * 18.5, -22.5), (sx * 12.0, -24.5)]
        for i in range(9):
            pts.append((sx * rnd.uniform(26, 44), rnd.uniform(-22, -4)))
        for i in range(10):
            pts.append((sx * rnd.uniform(7, 30), rnd.uniform(14, 60)))
    scenery.scatter_palms(pts, seed=4)

    # colliders for the playable character (three.js space is written by lib)
    lib.col_box(-GW - 0.25, -ARCH_W / 2, -GD - 0.25, GD + 0.25, 15)
    lib.col_box(ARCH_W / 2, GW + 0.25, -GD - 0.25, GD + 0.25, 15)
    lib.col_box(-ARCH_W / 2, ARCH_W / 2, -0.2, 0.2, 9, door=1)
    for sx in (-1, 1):
        lib.col_circle(sx * TOWER_X, 0, 3.95, 17)
        lib.col_box(sx * 13.6, sx * 33.6, -1.15, 1.15, 8)
        lib.col_circle(sx * 35.2, 0, 3.05, 12)
        lib.col_circle(sx * 7.6, -11.0, 0.95, 1.2)
        for (px, py) in ((18.5, -9.5), (18.5, -22.5), (12.0, -24.5)):
            lib.col_circle(sx * px, py, 1.32, 0.5)
        for y in (-34, -54, -74, -94, -114):
            lib.col_circle(sx * 5.4, y, 0.22, 3.6)
        for py in (-26.5, -6):
            lib.col_circle(sx * 22.5, py, 0.22, 3.6)
        lib.col_box(sx * 4.3, sx * 4.7, -170, -28, 0.22)
        lib.col_box(sx * 4.3, sx * 4.7, 22, 160, 0.22)
    lib.col_box(-GW - 0.8, GW + 0.8, -GD - 1.6, -GD - 0.2, 0.14)
    lib.empty("Hotspot_Gate", (0, -GD - 0.6, GH + 2.0), size=1.0)
    lib.empty("Cam_Start", (0, -62, 3.2), size=1.0)


if __name__ == "__main__":
    build()
    lib.export_glb("oman_gate")
    lib.export_colliders("oman_gate", bounds=dict(x0=-40, x1=40, z0=-8, z1=125), ground=0.06,
                         spawn=dict(x=0, z=46, yaw=3.14159))
    lib.setup_world()
    lib.add_sun((-0.55, -0.75, 0.42), 4.5)
    lib.add_camera((0, -46, 4.5), (0, 0, 8.2), 30)
    lib.setup_render((1280, 720), 48)
    lib.pack_and_save("oman_gate")
    lib.render_still(os.path.join(lib.RENDER_DIR, "gate_front.jpg"))
    cam = lib.bpy.context.scene.camera
    cam.location = (-34, -42, 12)
    cam.rotation_euler = lib.look_rot(lib.Vector((0, 0, 7)) - lib.Vector(cam.location))
    lib.render_still(os.path.join(lib.RENDER_DIR, "gate_34.jpg"))
