"""قلعة نزوى - Nizwa Fort with its great round tower (1650s, Imam Sultan bin Saif Al Ya'rubi),
the castle compound, the main studded gate with murder-hole box, the nearby mosque,
the souq arcade, a falaj channel and the palm oasis with the Hajar mountains behind."""
import sys
import os
import math
import random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import bmesh
from mathutils import Vector
import lib
import scenery
from lib import TAU, rad

TX, TY = 6.0, 16.0              # round tower centre
TR0, TR1, TH = 21.0, 19.2, 24.0  # radius bottom / top, height of the solid drum
GATE_X = -23.0                   # main gate centre
GATE_W, GATE_SPRING = 3.6, 4.4
HOUSES = []


def mats():
    M = {}
    M['fort'] = lib.material("M_FortPlaster", (0.78, 0.64, 0.48), 0.88, albedo="plaster_fort_a",
                             normal="plaster_n", rmap="plaster_r", normal_strength=1.0)
    M['trim'] = lib.material("M_FortTrim", (0.85, 0.74, 0.6), 0.88, albedo="plaster_sand_a",
                             normal="plaster_n", rmap="plaster_r", normal_strength=1.0)
    M['white'] = lib.material("M_MosqueWhite", (0.95, 0.93, 0.88), 0.85, albedo="plaster_white_a",
                              normal="plaster_n", rmap="plaster_r", normal_strength=0.8)
    M['dome'] = lib.material("M_DomeBlue", (0.16, 0.45, 0.66), 0.22, metal=0.15)
    M['gold'] = lib.material("M_Gold", (0.96, 0.76, 0.36), 0.25, metal=1.0)
    M['wood'] = lib.material("M_DoorWood", (0.4, 0.25, 0.13), 0.6, albedo="wood_a", normal="wood_n", rmap="wood_r")
    M['wdark'] = lib.material("M_WoodDark", (0.25, 0.16, 0.09), 0.7, albedo="wood_dark_a", normal="wood_n",
                              rmap="wood_r")
    M['brass'] = lib.material("M_Brass", (0.86, 0.66, 0.34), 0.3, metal=1.0)
    M['iron'] = lib.material("M_Iron", (0.13, 0.12, 0.12), 0.5, metal=0.8)
    M['paving'] = lib.material("M_Paving", (0.75, 0.68, 0.58), 0.8, albedo="paving_a", normal="paving_n",
                               rmap="paving_r")
    M['sand'] = lib.material("M_Sand", (0.88, 0.72, 0.5), 0.95, albedo="sand_a", normal="sand_n", rmap="sand_r")
    M['rock'] = lib.material("M_Rock", (0.5, 0.42, 0.35), 0.9, albedo="rock_a", normal="rock_n")
    M['glass'] = lib.material("M_LanternGlass", (1.0, 0.85, 0.6), 0.3, emission=(1.0, 0.7, 0.38),
                              emission_strength=8.0)
    M['soil'] = lib.material("M_Soil", (0.36, 0.26, 0.18), 0.95)
    M['shadow'] = lib.material("M_Shadow", (0.06, 0.05, 0.045), 1.0)
    M['water'] = lib.material("M_Water", (0.10, 0.32, 0.36), 0.05, metal=0.1)
    M['pole'] = lib.material("M_Pole", (0.92, 0.92, 0.9), 0.35, metal=0.6)
    return M


def arch_cut(w, spring, depth, x=0.0, y=0.0, bottom=-0.5, k=0.3, kind='pointed', yaw=0.0):
    return lib.cutter("cut", lambda bm: lib.prism(bm, lib.arch_pts(w, spring, kind, k, 16, bottom), depth,
                                                  M=lib.T(x, y, 0) @ lib.Rz(yaw)))


def box_cut(center, size, yaw=0.0):
    return lib.cutter("cut", lambda bm: lib.box(bm, (0, 0, 0), size, M=lib.T(*center) @ lib.Rz(yaw)))


def solid(name, mat, build, bevel=0.06):
    bm = bmesh.new()
    build(bm)
    ob = lib.mesh_obj(name, bm, [mat])
    if bevel:
        lib.bevel(ob, bevel, 2)
    return ob


def windows(bm_wood, bm_iron, cuts, x, y, z, yaw, w=0.95, h=1.35, bars=True):
    """Recessed window: cutter + wooden shutters + lintel/sill + iron bars. local -Y = outward."""
    M = lib.T(x, y, z) @ lib.Rz(yaw)
    cuts.append(box_cut((x, y, z), (w, 1.4, h), yaw))
    lib.box(bm_wood, (0, 0.42, 0), (w + 0.02, 0.08, h + 0.02), M=M)
    lib.box(bm_wood, (0, -0.04, h / 2 + 0.08), (w + 0.4, 0.3, 0.16), M=M)
    lib.box(bm_wood, (0, -0.04, -h / 2 - 0.06), (w + 0.25, 0.26, 0.12), M=M)
    if bars:
        for i in range(3):
            bx = -w / 2 + w * (i + 1) / 4
            p0 = M @ Vector((bx, 0.1, -h / 2))
            p1 = M @ Vector((bx, 0.1, h / 2))
            lib.cyl_axis(bm_iron, p0, p1, 0.022, segs=5)


def spouts(bm, pts, z):
    """Wooden water spouts (مرازيب). pts = [(x, y, yaw)] where local -Y points outward."""
    for (x, y, yaw) in pts:
        lib.box(bm, (0, -0.55, 0), (0.2, 1.1, 0.18), M=lib.T(x, y, z) @ lib.Rz(yaw))


def round_tower(M, statics):
    def r_at(z):
        return TR0 + (TR1 - TR0) * z / TH
    # solid drum with a ring of small gun ports
    bm = bmesh.new()
    lib.cyl(bm, TX, TY, 0, TH, TR0, TR1, segs=96)
    drum = lib.mesh_obj("tower_drum", bm, [M['fort']])
    cuts = []
    for i in range(36):
        a = TAU * (i + 0.5) / 36
        rr = r_at(20.5)
        cuts.append(box_cut((TX + rr * math.cos(a), TY + rr * math.sin(a), 20.5), (1.4, 0.38, 0.42), a))
    for i in range(18):
        a = TAU * (i + 0.25) / 18
        rr = r_at(11.0)
        cuts.append(box_cut((TX + rr * math.cos(a), TY + rr * math.sin(a), 11.0), (1.4, 0.28, 0.9), a))
    lib.boolean(drum, cuts)
    lib.finalize(drum, 30)
    lib.uv_cyl(drum, TX, TY, 3.5)
    statics.append(drum)

    # bands, plinth, cornice
    bm = bmesh.new()
    lib.cyl(bm, TX, TY, 0, 1.4, TR0 + 0.45, TR0 + 0.25, segs=96)
    lib.cyl(bm, TX, TY, 15.0, 0.4, r_at(15.0) + 0.16, r_at(15.4) + 0.16, segs=96)
    lib.cyl(bm, TX, TY, TH - 0.1, 0.6, TR1 + 0.1, TR1 + 0.45, segs=96)
    trim = lib.mesh_obj("tower_trim", bm, [M['trim']])
    lib.finalize(trim, 30)
    lib.uv_cyl(trim, TX, TY, 3.5)
    statics.append(trim)

    # parapet ring with 24 cannon ports and crenellations
    z0 = TH + 0.5
    bm = bmesh.new()
    lib.tube(bm, TX, TY, z0, 4.2, TR1 + 0.25, TR1 - 1.2, segs=96)
    par = lib.mesh_obj("tower_parapet", bm, [M['fort']])
    cuts = []
    for i in range(24):
        a = TAU * i / 24
        rr = TR1 - 0.5
        cuts.append(arch_cut(1.0, z0 + 2.1, 3.0, bottom=z0 + 1.1, kind='round', x=0, y=0, yaw=0))
        c = cuts[-1]
        c.data.transform(lib.T(TX + rr * math.cos(a), TY + rr * math.sin(a), 0) @ lib.Rz(a + math.pi / 2))
    for i in range(48):
        a = TAU * (i + 0.5) / 48
        rr = TR1 - 0.5
        cuts.append(box_cut((TX + rr * math.cos(a), TY + rr * math.sin(a), z0 + 3.25), (3.0, 0.16, 0.6), a))
    lib.boolean(par, cuts)
    lib.finalize(par, 30)
    lib.uv_cyl(par, TX, TY, 3.5)
    statics.append(par)

    bm = bmesh.new()
    lib.crenels_ring(bm, TX, TY, TR1 - 0.48, z0 + 4.2, 84, w=0.9, d=1.35, h=0.7, tip=0.55)
    cren = lib.mesh_obj("tower_merlons", bm, [M['fort']])
    lib.finalize(cren, 35)
    lib.uv_cyl(cren, TX, TY, 3.5)
    statics.append(cren)

    # cannons on the roof + spouts + guard room + flag
    bm = bmesh.new()
    for i, a in enumerate((-100, -70, -130, 200)):
        th = rad(a)
        rr = TR1 - 3.6
        scenery.cannon(bm, TX + rr * math.cos(th), TY + rr * math.sin(th), th + math.pi / 2, 0, 1, elev=4)
    bm.transform(lib.T(0, 0, TH + 0.5))
    can = lib.mesh_obj("tower_cannons", bm, [M['iron'], M['wood']])
    lib.finalize(can, 40)
    lib.uv_box(can, 1.5)
    statics.append(can)

    bm = bmesh.new()
    pts = []
    for i in range(20):
        a = TAU * (i + 0.5) / 20
        pts.append((TX + (TR1 + 0.1) * math.cos(a), TY + (TR1 + 0.1) * math.sin(a), a + math.pi / 2))
    spouts(bm, pts, z0 + 0.3)
    sp = lib.mesh_obj("tower_spouts", bm, [M['wdark']])
    lib.finalize(sp, 35)
    lib.uv_box(sp, 1.0)
    statics.append(sp)

    gr = solid("tower_guardroom", M['fort'], lambda bm: lib.box_mm(bm, TX + 4, TX + 11, TY + 3, TY + 9, TH, TH + 3.6))
    lib.boolean(gr, [arch_cut(1.1, TH + 1.9, 0.8, x=TX + 7.5, y=TY + 3, bottom=TH - 0.2)])
    statics.append(gr)
    bm = bmesh.new()
    lib.box_mm(bm, TX + 3.8, TX + 11.2, TY + 2.8, TY + 9.2, TH + 3.6, TH + 3.9)
    lib.crenels_rect(bm, TX + 4.0, TX + 11.0, TY + 3.0, TY + 9.0, TH + 3.9, 1.0, w=0.55, d=0.3, h=0.4, tip=0.35)
    statics.append(lib.mesh_obj("tower_guardroom_top", bm, [M['trim']]))

    bm = bmesh.new()
    lib.cyl(bm, TX, TY, TH, 11.0, 0.12, 0.09, segs=10)
    lib.sphere(bm, (TX, TY, TH + 11.1), 0.22, 10, 6, mi=1)
    statics.append(lib.mesh_obj("tower_flagpole", bm, [M['pole'], M['gold']]))
    lib.empty("Flag_Tower", (TX, TY, TH + 10.7), size=0.6)


def compound(M, statics):
    X0, X1, Y0, Y1 = -40.0, -6.0, -6.0, 30.0
    t, H = 2.4, 14.0
    bm_wood, bm_iron = bmesh.new(), bmesh.new()

    # walls are separate solids so every boolean works on a clean manifold box
    front = solid("fort_wall_front", M['fort'], lambda bm: lib.box_mm(bm, X0, X1, Y0, Y0 + t, 0, H))
    cuts = []
    for x in (-35.5, -31.0, -15.5, -11.0):
        windows(bm_wood, bm_iron, cuts, x, Y0, 9.4, 0.0)
        cuts.append(box_cut((x, Y0, 3.4), (0.22, 1.4, 1.1)))
    cuts.append(arch_cut(GATE_W, GATE_SPRING, 8.0, x=GATE_X, y=Y0))
    lib.boolean(front, cuts)
    west = solid("fort_wall_west", M['fort'], lambda bm: lib.box_mm(bm, X0, X0 + t, Y0 + t, Y1 - t, 0, H))
    cuts = []
    for y in (2.0, 9.0, 16.0, 23.0):
        windows(bm_wood, bm_iron, cuts, X0, y, 9.4, -math.pi / 2)
    lib.boolean(west, cuts)
    north = solid("fort_wall_north", M['fort'], lambda bm: lib.box_mm(bm, X0, X1, Y1 - t, Y1, 0, H))
    east = solid("fort_wall_east", M['fort'], lambda bm: lib.box_mm(bm, X1 - t, X1, Y0 + t, Y1 - t, 0, H))
    statics += [front, west, north, east]

    bm = bmesh.new()
    gx0, gx1 = GATE_X - 5.0, GATE_X + 5.0
    for (a, b) in ((X0 - 0.3, gx0), (gx1, X1 + 0.3)):
        lib.box_mm(bm, a, b, Y0 - 0.3, Y0 + 0.5, 0, 1.2)
        lib.box_mm(bm, a, b, Y0 - 0.12, Y0 + 0.5, 5.8, 6.05)
    lib.box_mm(bm, X0 - 0.3, X0 + 0.5, Y0 + 0.5, Y1 + 0.3, 0, 1.2)
    lib.box_mm(bm, X0 + 0.5, X1 + 0.3, Y1 - 0.5, Y1 + 0.3, 0, 1.2)
    lib.box_mm(bm, X1 - 0.5, X1 + 0.3, Y0 + 0.5, Y1 - 0.5, 0, 1.2)
    lib.box_mm(bm, X0 - 0.3, X1 + 0.3, Y0 - 0.3, Y0 + 0.5, H - 0.35, H)
    lib.box_mm(bm, X0 - 0.3, X0 + 0.5, Y0 + 0.5, Y1 + 0.3, H - 0.35, H)
    lib.box_mm(bm, X0 + 0.5, X1 + 0.3, Y1 - 0.5, Y1 + 0.3, H - 0.35, H)
    lib.box_mm(bm, X1 - 0.5, X1 + 0.3, Y0 + 0.5, Y1 - 0.5, H - 0.35, H)
    tr = lib.mesh_obj("fort_trim", bm, [M['trim']])
    statics.append(tr)

    bm = bmesh.new()
    lib.box_mm(bm, X0, X1, Y0, Y0 + 0.5, H, H + 1.0)
    lib.box_mm(bm, X0, X0 + 0.5, Y0, Y1, H, H + 1.0)
    lib.box_mm(bm, X0, X1, Y1 - 0.5, Y1, H, H + 1.0)
    lib.crenels_line(bm, (X0 + 0.25, Y0 + 0.25), (X1, Y0 + 0.25), H + 1.0, 1.25, w=0.75, d=0.5, h=0.6, tip=0.5)
    lib.crenels_line(bm, (X0 + 0.25, Y1 - 0.25), (X0 + 0.25, Y0 + 0.25), H + 1.0, 1.25, w=0.75, d=0.5, h=0.6, tip=0.5)
    lib.crenels_line(bm, (X1, Y1 - 0.25), (X0 + 0.25, Y1 - 0.25), H + 1.0, 1.25, w=0.75, d=0.5, h=0.6, tip=0.5)
    statics.append(lib.mesh_obj("fort_parapet", bm, [M['fort']]))

    sp = bmesh.new()
    spouts(sp, [(x, Y0, 0.0) for x in (-37, -29, -17, -9)] + [(X0, y, -math.pi / 2) for y in (-1, 12, 25)], H + 0.4)

    # SW round corner tower
    bm = bmesh.new()
    lib.cyl(bm, X0, Y0, 0, 18.0, 5.0, 4.4, segs=48)
    ct = lib.mesh_obj("corner_round", bm, [M['fort']])
    cuts = [box_cut((X0 + 4.7 * math.cos(a), Y0 + 4.7 * math.sin(a), z), (1.4, 0.22, 1.0), a)
            for z in (8.0, 13.0) for a in (rad(-60), rad(-120), rad(180))]
    lib.boolean(ct, cuts)
    lib.finalize(ct, 35)
    lib.uv_cyl(ct, X0, Y0, 3.0)
    bm = bmesh.new()
    lib.cyl(bm, X0, Y0, 0, 1.0, 5.35, 5.2, segs=48)
    lib.cyl(bm, X0, Y0, 18.0, 0.45, 4.45, 4.75, segs=48)
    lib.tube(bm, X0, Y0, 18.45, 1.0, 4.6, 4.05, segs=48)
    lib.crenels_ring(bm, X0, Y0, 4.33, 19.45, 18, w=0.7, d=0.5, h=0.55, tip=0.45)
    ctt = lib.mesh_obj("corner_round_trim", bm, [M['trim']])
    lib.finalize(ctt, 35)
    lib.uv_cyl(ctt, X0, Y0, 3.0)
    statics += [ct, ctt]

    # NW square tower
    sq = solid("corner_square", M['fort'], lambda bm: lib.box_mm(bm, X0 - 3.5, X0 + 4.5, Y1 - 4.5, Y1 + 3.5, 0, 19.5))
    cuts = []
    windows(bm_wood, bm_iron, cuts, X0 + 0.5, Y1 - 4.5, 15.0, 0.0, 0.8, 1.1)
    windows(bm_wood, bm_iron, cuts, X0 - 3.5, Y1, 15.0, -math.pi / 2, 0.8, 1.1)
    lib.boolean(sq, cuts)
    statics.append(sq)
    bm = bmesh.new()
    lib.box_mm(bm, X0 - 3.75, X0 + 4.75, Y1 - 4.75, Y1 + 3.75, 19.5, 19.9)
    lib.crenels_rect(bm, X0 - 3.4, X0 + 4.4, Y1 - 4.4, Y1 + 3.4, 19.9, 1.1, w=0.7, d=0.45, h=0.55, tip=0.45)
    statics.append(lib.mesh_obj("corner_square_top", bm, [M['trim']]))

    # inner buildings rising above the walls
    def building(name, x0, x1, y0, y1, h, wins):
        b = solid(name, M['fort'], lambda bm: lib.box_mm(bm, x0, x1, y0, y1, 0, h))
        cuts = []
        for (wx, wy, wz, yaw) in wins:
            windows(bm_wood, bm_iron, cuts, wx, wy, wz, yaw, 0.85, 1.15)
        if cuts:
            lib.boolean(b, cuts)
        statics.append(b)
        bm = bmesh.new()
        lib.box_mm(bm, x0 - 0.2, x1 + 0.2, y0 - 0.2, y1 + 0.2, h - 0.3, h)
        lib.rect_frame(bm, x0, x1, y0, y1, h, 0.8, 0.4)
        lib.crenels_rect(bm, x0 + 0.2, x1 - 0.2, y0 + 0.2, y1 - 0.2, h + 0.8, 1.1, w=0.62, d=0.36, h=0.5, tip=0.4)
        statics.append(lib.mesh_obj(name + "_top", bm, [M['trim']]))
        spouts(sp, [(x, y0, 0.0) for x in np.linspace(x0 + 1.5, x1 - 1.5, 3)], h + 0.2)

    building("residence", -36.5, -21.0, 7.0, 27.0, 19.0,
             [(x, 7.0, 16.6, 0.0) for x in (-34, -30.5, -27, -23.5)] + [(-36.5, y, 16.6, -math.pi / 2) for y in (11, 17, 23)])
    building("majlis_block", -19.0, -8.0, 1.5, 12.0, 16.5,
             [(x, 1.5, 15.2, 0.0) for x in (-16.5, -13.5, -10.5)])
    building("stair_tower", -34.0, -29.0, -1.0, 4.0, 22.0, [(-31.5, -1.0, 19.5, 0.0)])

    sp_ob = lib.mesh_obj("fort_spouts", sp, [M['wdark']])
    lib.finalize(sp_ob, 35)
    lib.uv_box(sp_ob, 1.0)
    statics.append(sp_ob)
    wd = lib.mesh_obj("fort_window_wood", bm_wood, [M['wdark']])
    lib.finalize(wd, 35)
    lib.uv_box(wd, 1.5)
    ir = lib.mesh_obj("fort_window_iron", bm_iron, [M['iron']])
    lib.finalize(ir, 60)
    statics += [wd, ir]


def main_gate(M, statics):
    x0, x1, y0, y1 = GATE_X - 5.0, GATE_X + 5.0, -10.5, -3.6
    gh = solid("gatehouse", M['fort'], lambda bm: lib.box_mm(bm, x0, x1, y0, y1, 0, 15.5))
    cuts = [arch_cut(GATE_W, GATE_SPRING, 12.0, x=GATE_X, y=-6.0),
            arch_cut(GATE_W + 1.2, GATE_SPRING, 0.8, x=GATE_X, y=y0),
            box_cut((GATE_X - 3.2, y0, 12.0), (0.22, 1.4, 1.2)),
            box_cut((GATE_X + 3.2, y0, 12.0), (0.22, 1.4, 1.2))]
    lib.boolean(gh, cuts)
    statics.append(gh)

    bm = bmesh.new()
    lib.box_mm(bm, x0 - 0.3, x1 + 0.3, y0 - 0.3, y1, 0, 1.0)
    lib.box_mm(bm, x0 - 0.3, x1 + 0.3, y0 - 0.3, y1, 15.5, 15.9)
    lib.box_mm(bm, x0 - 0.12, x1 + 0.12, y0 - 0.12, y1, 7.6, 7.85)
    outer = lib.arch_pts(GATE_W + 2.2, GATE_SPRING, 'pointed', 0.3, 16, GATE_SPRING - 0.5)
    lib.prism(bm, outer, 0.26, M=lib.T(GATE_X, y0 - 0.08, 0))
    tr = lib.mesh_obj("gatehouse_trim", bm, [M['trim']])
    lib.boolean(tr, [arch_cut(GATE_W + 1.2, GATE_SPRING, 12.0, x=GATE_X, y=-6.0)])
    statics.append(tr)

    # machicolation box (murder holes) above the gate
    bm = bmesh.new()
    lib.box_mm(bm, GATE_X - 1.9, GATE_X + 1.9, y0 - 1.25, y0, 9.4, 12.1)
    lib.box_mm(bm, GATE_X - 2.05, GATE_X + 2.05, y0 - 1.4, y0, 12.1, 12.35)
    for cx in (GATE_X - 1.6, GATE_X, GATE_X + 1.6):
        lib.box_mm(bm, cx - 0.22, cx + 0.22, y0 - 1.15, y0, 8.6, 9.4)
        lib.box_mm(bm, cx - 0.22, cx + 0.22, y0 - 0.7, y0, 8.0, 8.6)
    lib.crenels_line(bm, (GATE_X - 1.75, y0 - 1.05), (GATE_X + 1.75, y0 - 1.05), 12.35, 0.9,
                     w=0.55, d=0.3, h=0.45, tip=0.35)
    mach = lib.mesh_obj("machicolation", bm, [M['trim']])
    lib.boolean(mach, [box_cut((cx, y0 - 1.2, 10.7), (0.16, 0.6, 0.9)) for cx in (GATE_X - 1.0, GATE_X, GATE_X + 1.0)])
    statics.append(mach)

    bm = bmesh.new()
    lib.box_mm(bm, x0, x1, y0, y0 + 0.45, 15.9, 16.8)
    lib.box_mm(bm, x0, x0 + 0.45, y0, y1, 15.9, 16.8)
    lib.box_mm(bm, x1 - 0.45, x1, y0, y1, 15.9, 16.8)
    lib.crenels_line(bm, (x0 + 0.2, y0 + 0.22), (x1 - 0.2, y0 + 0.22), 16.8, 1.05, w=0.7, d=0.45, h=0.55, tip=0.45)
    statics.append(lib.mesh_obj("gatehouse_parapet", bm, [M['fort']]))

    # steps and lanterns
    bm = bmesh.new()
    for i in range(3):
        lib.box_mm(bm, x0 - 0.5 + i * 0.4, x1 + 0.5 - i * 0.4, y0 - 2.6 + i * 0.75, y0 + 0.2, -0.2, 0.17 + i * 0.15)
    st = lib.mesh_obj("gate_steps", bm, [M['trim']])
    statics.append(st)
    bm = bmesh.new()
    lights = []
    for sx in (-1, 1):
        lib.box(bm, (GATE_X + sx * 2.55, y0 - 0.25, 5.6), (0.08, 0.5, 0.08))
        lights.append(scenery.lantern(bm, (GATE_X + sx * 2.55, y0 - 0.5, 5.15), 0, 1, 1.0))
    statics.append(lib.mesh_obj("gate_lanterns", bm, [M['brass'], M['glass']]))
    for i, p in enumerate(lights):
        lib.empty(f"Light.{i:03d}", p, size=0.3)

    # dark passage behind the doors so the interior reads as deep
    bm = bmesh.new()
    lib.box_mm(bm, GATE_X - 1.9, GATE_X + 1.9, -2.0, -1.4, 0, 6.5)
    statics.append(lib.mesh_obj("gate_void", bm, [M['shadow']]))

    for side, name in ((-1, "DoorL"), (1, "DoorR")):
        scenery.door_leaf(name, GATE_W, GATE_SPRING, 0.3, 0.2, -7.6, side, [M['wood'], M['brass'], M['iron']],
                          stud_dx=0.36, stud_dz=0.48, bands=(0.6, 2.4, 4.0), knock_z=2.6)
    # door hinge x is at GATE_X +/- w/2 -> move leaves under the gate
    for name in ("DoorL", "DoorR"):
        ob = lib.bpy.data.objects[name]
        ob.location.x += GATE_X


def mosque(M, statics):
    cx, cy = -67.0, -1.0
    x0, x1, y0, y1 = cx - 11, cx + 11, cy - 11, cy + 11
    base = solid("mosque_base", M['white'], lambda bm: lib.box_mm(bm, x0, x1, y0, y1, 0, 9.5))
    cuts = []
    for i in range(5):
        x = x0 + 22 * (i + 0.5) / 5
        cuts.append(arch_cut(2.0, 5.6, 0.8, x=x, y=y0, bottom=1.4 if i != 2 else -0.5))
        cuts.append(arch_cut(2.0, 5.6, 0.8, x=x, y=y1, bottom=1.4))
    for i in range(5):
        y = y0 + 22 * (i + 0.5) / 5
        cuts.append(arch_cut(2.0, 5.6, 0.8, x=x0, y=y, bottom=1.4, yaw=math.pi / 2))
        cuts.append(arch_cut(2.0, 5.6, 0.8, x=x1, y=y, bottom=1.4, yaw=math.pi / 2))
    lib.boolean(base, cuts)
    statics.append(base)
    bm = bmesh.new()
    for i in range(5):
        x = x0 + 22 * (i + 0.5) / 5
        if i != 2:
            lib.box_mm(bm, x - 1.0, x + 1.0, y0 + 0.25, y0 + 0.35, 1.4, 7.0)
        lib.box_mm(bm, x - 1.0, x + 1.0, y1 - 0.35, y1 - 0.25, 1.4, 7.0)
        y = y0 + 22 * (i + 0.5) / 5
        lib.box_mm(bm, x0 + 0.25, x0 + 0.35, y - 1.0, y + 1.0, 1.4, 7.0)
        lib.box_mm(bm, x1 - 0.35, x1 - 0.25, y - 1.0, y + 1.0, 1.4, 7.0)
    lib.box_mm(bm, cx - 1.0, cx + 1.0, y0 + 0.3, y0 + 0.4, 0.0, 7.0)
    statics.append(lib.mesh_obj("mosque_screens", bm, [M['wdark']]))

    bm = bmesh.new()
    lib.box_mm(bm, x0 - 0.25, x1 + 0.25, y0 - 0.25, y1 + 0.25, 9.5, 9.85)
    lib.box_mm(bm, x0 - 0.2, x1 + 0.2, y0 - 0.2, y1 + 0.2, 0, 0.7)
    lib.crenels_rect(bm, x0 + 0.1, x1 - 0.1, y0 + 0.1, y1 - 0.1, 9.85, 0.95, w=0.55, d=0.3, h=0.55, tip=0.4)
    lib.cyl(bm, cx, cy, 9.85, 0.5, 7.2, 7.0, segs=64)
    statics.append(lib.mesh_obj("mosque_trim", bm, [M['trim']]))

    drum = solid("mosque_drum", M['white'], lambda bm: lib.cyl(bm, cx, cy, 10.35, 3.2, 6.4, 6.4, segs=64), bevel=0)
    lib.boolean(drum, [arch_cut(0.9, 12.2, 14.0, x=cx, y=cy, bottom=11.0, kind='round', yaw=a)
                       for a in (0, math.pi / 4, math.pi / 2, 3 * math.pi / 4)])
    lib.uv_cyl(drum, cx, cy, 3.0)
    statics.append(drum)

    bm = bmesh.new()
    prof = []
    for i in range(17):
        t = i / 16
        a = t * math.pi / 2
        r = 6.6 * math.cos(a) ** 0.85 * (1 + 0.06 * math.sin(t * math.pi))
        prof.append((max(r, 0.0), 13.55 + 7.2 * math.sin(a) ** 1.1))
    prof[-1] = (0.0, prof[-1][1])
    lib.lathe(bm, prof, segs=64, M=lib.T(cx, cy, 0), cap_bottom=False)
    statics.append(lib.mesh_obj("mosque_dome", bm, [M['dome']]))
    bm = bmesh.new()
    lib.cyl(bm, cx, cy, 13.4, 0.3, 6.75, 6.75, segs=64)
    lib.lathe(bm, [(0.0, 20.6), (0.5, 20.7), (0.35, 21.2), (0.45, 21.6), (0.25, 22.0), (0.3, 22.3), (0.08, 22.6),
                   (0.06, 23.6), (0.0, 23.8)], segs=16, M=lib.T(cx, cy, 0))
    lib.torus(bm, lib.T(cx, cy, 24.15) @ lib.Rx(math.pi / 2), 0.38, 0.06, 20, 6)
    statics.append(lib.mesh_obj("mosque_gold", bm, [M['gold']]))

    # minaret
    mx, my = x1 - 1.5, y0 + 1.5
    bm = bmesh.new()
    lib.box_mm(bm, mx - 2.2, mx + 2.2, my - 2.2, my + 2.2, 0, 11.5)
    lib.cyl(bm, mx, my, 11.5, 11.0, 1.7, 1.5, segs=8)
    lib.cyl(bm, mx, my, 23.2, 4.0, 1.15, 1.1, segs=8)
    mn = lib.mesh_obj("minaret", bm, [M['white']])
    lib.boolean(mn, [arch_cut(0.5, 25.6, 4.0, x=mx, y=my, bottom=24.4, kind='round', yaw=a)
                     for a in (0, math.pi / 2)])
    statics.append(mn)
    bm = bmesh.new()
    lib.box_mm(bm, mx - 2.4, mx + 2.4, my - 2.4, my + 2.4, 11.3, 11.6)
    lib.cyl(bm, mx, my, 22.5, 0.35, 1.55, 2.4, segs=16)
    lib.tube(bm, mx, my, 22.85, 0.9, 2.4, 2.2, segs=16)
    lib.cyl(bm, mx, my, 27.2, 0.3, 1.2, 1.5, segs=16)
    statics.append(lib.mesh_obj("minaret_trim", bm, [M['trim']]))
    bm = bmesh.new()
    lib.lathe(bm, [(1.25, 27.5), (1.2, 28.3), (0.8, 29.1), (0.3, 29.6), (0.0, 29.8)], segs=24, M=lib.T(mx, my, 0),
              cap_bottom=True)
    statics.append(lib.mesh_obj("minaret_dome", bm, [M['dome']]))
    bm = bmesh.new()
    lib.lathe(bm, [(0.0, 29.7), (0.22, 29.9), (0.12, 30.3), (0.05, 31.3), (0.0, 31.5)], segs=12, M=lib.T(mx, my, 0))
    statics.append(lib.mesh_obj("minaret_gold", bm, [M['gold']]))


def souq(M, statics):
    x0, x1, y0, y1 = -55.0, -31.0, -33.0, -24.0
    b = solid("souq", M['fort'], lambda bm: lib.box_mm(bm, x0, x1, y0, y1, 0, 6.2))
    n = 7
    cuts = [arch_cut(2.3, 3.0, 4.0, x=x0 + (x1 - x0) * (i + 0.5) / n, y=y0) for i in range(n)]
    lib.boolean(b, cuts)
    statics.append(b)
    bm = bmesh.new()
    for i in range(n):
        x = x0 + (x1 - x0) * (i + 0.5) / n
        lib.box_mm(bm, x - 1.2, x + 1.2, y0 + 1.9, y0 + 2.0, 0, 4.5)
    lib.box_mm(bm, x0, x1, y0 + 2.0, y1, 0, 0.04)
    statics.append(lib.mesh_obj("souq_shadow", bm, [M['shadow']]))
    bm = bmesh.new()
    lib.box_mm(bm, x0 - 0.2, x1 + 0.2, y0 - 0.2, y1 + 0.2, 6.2, 6.45)
    lib.crenels_rect(bm, x0 + 0.1, x1 - 0.1, y0 + 0.1, y1 - 0.1, 6.45, 1.0, w=0.5, d=0.3, h=0.45, tip=0.35)
    statics.append(lib.mesh_obj("souq_top", bm, [M['trim']]))
    # goods: a few clay pots in front of the arches
    bm = bmesh.new()
    rnd = random.Random(3)
    for i in range(12):
        px = rnd.uniform(x0 + 1, x1 - 1)
        py = y0 - rnd.uniform(0.6, 1.6)
        s = rnd.uniform(0.6, 1.0)
        lib.lathe(bm, [(0.0, 0), (0.22 * s, 0), (0.36 * s, 0.25 * s), (0.3 * s, 0.55 * s), (0.14 * s, 0.68 * s),
                       (0.17 * s, 0.76 * s), (0.0, 0.76 * s)], segs=12, M=lib.T(px, py, 0))
    pots = lib.mesh_obj("souq_pots", bm, [lib.material("M_Clay", (0.66, 0.36, 0.2), 0.8)])
    statics.append(pots)


def houses(M, statics, rnd):
    spots = [(48, -52), (70, -30), (92, -8), (62, 52), (-100, -40), (-108, 25), (35, -78), (-92, 60)]
    for i, (x, y) in enumerate(spots):
        w, d, h = rnd.uniform(7, 11), rnd.uniform(6, 9), rnd.uniform(4.5, 7.5)
        HOUSES.append((x - w / 2 - 0.15, x + w / 2 + 0.15, y - d / 2 - 0.15, y + d / 2 + 0.15, h + 0.8))
        b = solid(f"house{i}", M['fort'], lambda bm: lib.box_mm(bm, x - w / 2, x + w / 2, y - d / 2, y + d / 2, 0, h))
        cuts = [arch_cut(1.1, 1.9, 1.0, x=x, y=y - d / 2, bottom=-0.5)]
        lib.boolean(b, cuts)
        statics.append(b)
        bm = bmesh.new()
        lib.box_mm(bm, x - w / 2 - 0.15, x + w / 2 + 0.15, y - d / 2 - 0.15, y + d / 2 + 0.15, h, h + 0.2)
        lib.rect_frame(bm, x - w / 2, x + w / 2, y - d / 2, y + d / 2, h + 0.2, 0.6, 0.3)
        lib.box_mm(bm, x - 0.55, x + 0.55, y - d / 2 + 0.3, y - d / 2 + 0.38, 0, 2.3)
        statics.append(lib.mesh_obj(f"house{i}_top", bm, [M['trim']]))


def falaj_and_grounds(M, statics):
    FY = -40.0
    bm = bmesh.new()
    # stone channel walls
    for (xa, xb) in ((-160, GATE_X - 5.2), (GATE_X + 5.2, 140)):
        lib.box_mm(bm, xa, xb, FY - 0.85, FY - 0.5, -0.3, 0.5)
        lib.box_mm(bm, xa, xb, FY + 0.5, FY + 0.85, -0.3, 0.5)
        lib.box_mm(bm, xa, xb, FY - 0.5, FY + 0.5, -0.3, 0.02)
    # bridge
    lib.box_mm(bm, GATE_X - 5.6, GATE_X + 5.6, FY - 1.6, FY + 1.6, -0.3, 0.55)
    ch = lib.mesh_obj("falaj_channel", bm, [M['trim']])
    lib.finalize(ch, 35)
    lib.uv_box(ch, 2.0)
    statics.append(ch)
    bm = bmesh.new()
    lib.box_mm(bm, -160, 140, FY - 0.5, FY + 0.5, 0.0, 0.32)
    water = lib.mesh_obj("Water_Falaj", bm, [M['water']])
    lib.finalize(water, 35)
    lib.uv_box(water, 2.0)

    bm = bmesh.new()
    lib.box_mm(bm, -58, 22, -37, -5.8, -0.4, 0.06)
    lib.box_mm(bm, GATE_X - 4.5, GATE_X + 4.5, -220, -37, -0.4, 0.05)
    lib.box_mm(bm, GATE_X - 5.6, GATE_X + 5.6, FY - 1.6, FY + 1.6, -0.3, 0.58)
    lib.box_mm(bm, GATE_X - 2.0, GATE_X + 2.0, -10.5, -1.4, -0.4, 0.07)
    pav = lib.mesh_obj("paving", bm, [M['paving']])
    lib.finalize(pav, 35)
    lib.uv_box(pav, 4.0)
    statics.append(pav)
    bm = bmesh.new()
    # ramps up onto the bridge
    for sgn in (-1, 1):
        ya = FY + sgn * 1.6
        yb = FY + sgn * 5.0
        y_lo, y_hi = (min(ya, yb), max(ya, yb))
        z_lo_y = yb
        vs = []
        for (x, y, z) in ((GATE_X - 4.5, ya, 0.58), (GATE_X + 4.5, ya, 0.58), (GATE_X + 4.5, yb, 0.06),
                          (GATE_X - 4.5, yb, 0.06), (GATE_X - 4.5, ya, 0.0), (GATE_X + 4.5, ya, 0.0),
                          (GATE_X + 4.5, yb, 0.0), (GATE_X - 4.5, yb, 0.0)):
            vs.append(bm.verts.new((x, y, z)))
        for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
            bm.faces.new([vs[i] for i in f])
    rp = lib.mesh_obj("ramps", bm, [M['paving']])
    lib.finalize(rp, 35)
    lib.uv_box(rp, 4.0)
    statics.append(rp)

    bm = bmesh.new()
    lamps = []
    for y in (-50, -70, -90, -110, -130, -150):
        for sx in (-1, 1):
            lamps.append(scenery.lamp_post(bm, GATE_X + sx * 5.6, y, 0, 1))
    for (x, y) in ((-56, -35.5), (20, -35.5), (-56, -8), (GATE_X - 7, -14), (GATE_X + 7, -14)):
        lamps.append(scenery.lamp_post(bm, x, y, 0, 1))
    for sx in (-1, 1):
        scenery.planter(bm, GATE_X + sx * 10, -20, 2, 3)
        scenery.planter(bm, GATE_X + sx * 22, -30, 2, 3)
    lp = lib.mesh_obj("lamps", bm, [M['iron'], M['glass'], M['trim'], M['soil']])
    lib.finalize(lp, 40)
    lib.uv_box(lp, 2.0)
    statics.append(lp)
    base = len([o for o in lib.bpy.data.objects if o.name.startswith("Light.")])
    for i, p in enumerate(lamps):
        lib.empty(f"Light.{base + i:03d}", p, size=0.3)

    bm = bmesh.new()
    scenery.cannon(bm, GATE_X - 7.5, -16.5, rad(12), 0, 1)
    scenery.cannon(bm, GATE_X + 7.5, -16.5, rad(-12), 0, 1)
    can = lib.mesh_obj("plaza_cannons", bm, [M['iron'], M['wood']])
    lib.finalize(can, 40)
    lib.uv_box(can, 1.5)
    statics.append(can)


def build():
    lib.reset()
    lib.use_collection("NizwaFort")
    M = mats()
    rnd = random.Random(21)
    statics = []
    round_tower(M, statics)
    compound(M, statics)
    main_gate(M, statics)
    mosque(M, statics)
    souq(M, statics)
    houses(M, statics, rnd)
    falaj_and_grounds(M, statics)
    for ob in statics:
        if not ob.data.uv_layers:
            lib.finalize(ob, 35)
            lib.uv_box(ob, 3.0, (rnd.random(), rnd.random()))
    lib.join(statics, "Fort_Static")

    scenery.terrain("Terrain", (M['sand'], M['rock']), seed=9, dune_h=4.5, size=1600, res=240,
                    flat_r=(60, 140), corridor=(10, 30),
                    flat_boxes=[(-140, 120, -90, 90, 40), (-36, -10, -300, -80, 22)], mtn_r=(250, 420), mtn_h=(40, 170),
                    mtn_bias=lambda a: 0.35 + 0.65 * np.clip(np.sin(a) * 0.9 + 0.3, 0, 1))
    # shift the terrain under the gate road (road runs along x = GATE_X)
    pts = []
    tries = 0
    while len(pts) < 95 and tries < 5000:
        tries += 1
        x, y = rnd.uniform(-150, 150), rnd.uniform(-110, 85)
        ok = True
        if math.hypot(x - TX, y - TY) < TR0 + 8:
            ok = False
        if -48 < x < -2 and -16 < y < 36:
            ok = False
        if -82 < x < -50 and -16 < y < 14:
            ok = False
        if -60 < x < 26 and -46 < y < -2:
            ok = False
        if abs(x - GATE_X) < 9 and y < -30:
            ok = False
        if abs(y + 40) < 3:
            ok = False
        if -58 < x < -28 and -38 < y < -20:
            ok = False
        for (hx, hy) in ((48, -52), (70, -30), (92, -8), (62, 52), (-100, -40), (-108, 25), (35, -78), (-92, 60)):
            if math.hypot(x - hx, y - hy) < 9:
                ok = False
        if ok:
            pts.append((x, y))
    for y in range(-200, -48, 11):
        for sx in (-1, 1):
            pts.append((GATE_X + sx * rnd.uniform(9.5, 11), y + rnd.uniform(-2, 2)))
    for sx in (-1, 1):
        pts.append((GATE_X + sx * 10, -20))
        pts.append((GATE_X + sx * 22, -30))
    scenery.scatter_palms(pts, seed=8)

    # colliders for the playable character
    lib.col_circle(TX, TY, TR0 + 0.5, 32)
    lib.col_box(-40.3, -6.0, -6.3, 30.3, 16)
    lib.col_circle(-40.0, -6.0, 5.4, 20)
    lib.col_box(-43.6, -35.4, 25.4, 33.6, 21)
    lib.col_box(GATE_X - 5.3, GATE_X - GATE_W / 2, -10.8, -3.6, 17)
    lib.col_box(GATE_X + GATE_W / 2, GATE_X + 5.3, -10.8, -3.6, 17)
    lib.col_box(GATE_X - GATE_W / 2, GATE_X + GATE_W / 2, -7.75, -7.45, 6, door=1)
    for i in range(3):
        lib.col_box(GATE_X - 5.5 + i * 0.4, GATE_X + 5.5 - i * 0.4, -10.5 - 2.6 + i * 0.75, -10.3, 0.17 + i * 0.15)
    lib.col_box(-78.2, -55.8, -12.2, 10.2, 12)
    lib.col_box(-55.2, -30.8, -33.2, -23.8, 7)
    for (hx0, hx1, hy0, hy1, hh) in HOUSES:
        lib.col_box(hx0, hx1, hy0, hy1, hh)
    FY = -40.0
    for (xa, xb) in ((-160, GATE_X - 5.2), (GATE_X + 5.2, 140)):
        lib.col_box(xa, xb, FY - 0.85, FY + 0.85, 0.5)
    lib.col_box(GATE_X - 5.6, GATE_X + 5.6, FY - 1.6, FY + 1.6, 0.58)
    lib.col_ramp(GATE_X - 4.5, GATE_X + 4.5, FY - 5.0, FY - 1.6, 0.06, 0.58)
    lib.col_ramp(GATE_X - 4.5, GATE_X + 4.5, FY + 5.0, FY + 1.6, 0.06, 0.58)
    for sx in (-1, 1):
        lib.col_circle(GATE_X + sx * 7.5, -16.5, 0.95, 1.2)
        lib.col_circle(GATE_X + sx * 10, -20, 1.32, 0.5)
        lib.col_circle(GATE_X + sx * 22, -30, 1.32, 0.5)
    for y in (-50, -70, -90, -110, -130, -150):
        for sx in (-1, 1):
            lib.col_circle(GATE_X + sx * 5.6, y, 0.22, 3.6)
    for (x, y) in ((-56, -35.5), (20, -35.5), (-56, -8), (GATE_X - 7, -14), (GATE_X + 7, -14)):
        lib.col_circle(x, y, 0.22, 3.6)
    lib.empty("Hotspot_Tower", (TX, TY, TH + 7.0), size=1.0)
    lib.empty("Hotspot_Gate", (GATE_X, -12.0, 13.5), size=1.0)
    lib.empty("Hotspot_Mosque", (-67.0, -1.0, 26.0), size=1.0)
    lib.empty("Hotspot_Falaj", (8.0, -40.0, 2.0), size=1.0)
    lib.empty("Hotspot_Souq", (-43.0, -33.0, 8.5), size=1.0)
    lib.empty("Door_Target", (GATE_X, -7.6, 2.6), size=1.0)


if __name__ == "__main__":
    build()
    lib.export_glb("nizwa_fort")
    lib.export_colliders("nizwa_fort", bounds=dict(x0=-125, x1=105, z0=-78, z1=84), ground=0.06,
                         spawn=dict(x=GATE_X, z=52, yaw=3.14159), spawnBack=dict(x=GATE_X, z=15.5, yaw=0))
    lib.setup_world()
    lib.add_sun((-0.6, -0.7, 0.5), 4.5)
    lib.add_camera((-10, -125, 22), (-8, 5, 12), 32)
    lib.setup_render((1280, 720), 48)
    lib.pack_and_save("nizwa_fort")
    lib.render_still(os.path.join(lib.RENDER_DIR, "fort_front.jpg"))
    cam = lib.bpy.context.scene.camera
    cam.location = (70, -85, 45)
    cam.rotation_euler = lib.look_rot(lib.Vector((-12, 8, 8)) - lib.Vector(cam.location))
    lib.render_still(os.path.join(lib.RENDER_DIR, "fort_aerial.jpg"))
    cam.location = (GATE_X + 4, -36, 3.5)
    cam.rotation_euler = lib.look_rot(lib.Vector((GATE_X, -8, 6)) - lib.Vector(cam.location))
    lib.render_still(os.path.join(lib.RENDER_DIR, "fort_gate.jpg"))
