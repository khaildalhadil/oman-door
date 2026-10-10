"""Interior of Nizwa Fort: a traditional Omani majlis hall with palm-trunk ceiling,
niches, latticed windows, carpet, cushions, dallah coffee set, information boards
and a carved wooden frame holding the video screen."""
import sys
import os
import math
import random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bmesh
from mathutils import Vector
import lib
import scenery
from lib import TAU, rad

RX, RY, RH, WT = 9.0, 6.0, 6.5, 0.6   # half sizes, height, wall thickness
SCREEN_W, SCREEN_H, SCREEN_Z = 4.8, 2.7, 2.95


def mats():
    M = {}
    M['wall'] = lib.material("M_InnerPlaster", (0.9, 0.83, 0.72), 0.9, albedo="plaster_inner_a",
                             normal="plaster_n", rmap="plaster_r", normal_strength=0.8)
    M['floor'] = lib.material("M_FloorPlaster", (0.75, 0.6, 0.45), 0.75, albedo="plaster_fort_a",
                              normal="plaster_n", rmap="plaster_r", normal_strength=0.6)
    M['beam'] = lib.material("M_Beam", (0.3, 0.2, 0.12), 0.75, albedo="wood_dark_a", normal="wood_n", rmap="wood_r")
    M['weave'] = lib.material("M_Weave", (0.7, 0.56, 0.36), 0.85, albedo="weave_a", normal="weave_n")
    M['wood'] = lib.material("M_DoorWood", (0.4, 0.25, 0.13), 0.6, albedo="wood_a", normal="wood_n", rmap="wood_r")
    M['brass'] = lib.material("M_Brass", (0.86, 0.66, 0.34), 0.3, metal=1.0)
    M['iron'] = lib.material("M_Iron", (0.13, 0.12, 0.12), 0.5, metal=0.8)
    M['fabric'] = lib.material("M_Fabric", (0.6, 0.1, 0.1), 0.85, albedo="fabric_a", normal="fabric_n")
    M['seat'] = lib.material("M_SeatBase", (0.42, 0.07, 0.08), 0.9)
    M['carpet'] = lib.material("M_Carpet", (0.6, 0.1, 0.1), 0.95, albedo="carpet_a", normal="carpet_n")
    M['frieze'] = lib.material("M_Frieze", (0.9, 0.8, 0.6), 0.8, albedo="frieze_a")
    M['board'] = lib.material("M_Board", (0.93, 0.88, 0.77), 0.92)
    M['screen'] = lib.material("M_Screen", (0.02, 0.02, 0.02), 0.35)
    M['wglow'] = lib.material("M_WindowGlow", (1.0, 0.86, 0.62), 0.9, emission=(1.0, 0.82, 0.58),
                              emission_strength=5.0)
    M['dglow'] = lib.material("M_DoorGlow", (1.0, 0.92, 0.78), 0.9, emission=(1.0, 0.9, 0.74),
                              emission_strength=6.0)
    M['clay'] = lib.material("M_Clay", (0.66, 0.36, 0.2), 0.8)
    M['glass'] = lib.material("M_LanternGlass", (1.0, 0.85, 0.6), 0.3, emission=(1.0, 0.7, 0.38),
                              emission_strength=8.0)
    M['leather'] = lib.material("M_Leather", (0.35, 0.2, 0.1), 0.6)
    M['dates'] = lib.material("M_Dates", (0.55, 0.28, 0.1), 0.35)
    M['white'] = lib.material("M_Porcelain", (0.95, 0.94, 0.9), 0.2)
    return M


def arch_cut(w, spring, depth, x=0.0, y=0.0, bottom=-0.5, k=0.3, kind='pointed', yaw=0.0):
    return lib.cutter("cut", lambda bm: lib.prism(bm, lib.arch_pts(w, spring, kind, k, 16, bottom), depth,
                                                  M=lib.T(x, y, 0) @ lib.Rz(yaw)))


def shell(M, statics):
    def wall(name, x0, x1, y0, y1, cuts):
        bm = bmesh.new()
        lib.box_mm(bm, x0, x1, y0, y1, 0, RH + 0.6)
        ob = lib.mesh_obj(name, bm, [M['wall']])
        if cuts:
            lib.boolean(ob, cuts)
        statics.append(ob)
        return ob

    # back wall (+Y): niches flanking the video screen
    cuts = [arch_cut(1.0, 2.55, 0.7, x=sx * 3.95, y=RY, bottom=1.25) for sx in (-1, 1)]
    wall("wall_back", -RX - WT, RX + WT, RY, RY + WT, cuts)
    # front wall (-Y): door + niches
    cuts = [arch_cut(2.2, 2.6, 2.0, x=0, y=-RY - WT / 2)]
    cuts += [arch_cut(1.0, 2.55, 0.7, x=sx * 3.4, y=-RY, bottom=1.25) for sx in (-1, 1)]
    cuts += [arch_cut(1.0, 2.55, 0.7, x=sx * 7.6, y=-RY, bottom=1.25) for sx in (-1, 1)]
    wall("wall_front", -RX - WT, RX + WT, -RY - WT, -RY, cuts)
    # side walls with two latticed windows each
    for sx, name in ((-1, "wall_left"), (1, "wall_right")):
        cuts = [arch_cut(1.3, 3.1, 2.0, x=sx * (RX + WT / 2), y=wy, bottom=1.35, yaw=math.pi / 2)
                for wy in (-3.6, 3.6)]
        x0, x1 = (-RX - WT, -RX) if sx < 0 else (RX, RX + WT)
        wall(name, x0, x1, -RY, RY, cuts)

    # floor & ceiling slab
    bm = bmesh.new()
    lib.box_mm(bm, -RX, RX, -RY, RY, -0.3, 0.0)
    lib.box_mm(bm, -1.1, 1.1, -RY - WT, -RY, -0.3, 0.0)
    fl = lib.mesh_obj("floor", bm, [M['floor']])
    lib.finalize(fl, 35)
    lib.uv_box(fl, 3.0)
    bm = bmesh.new()
    lib.box_mm(bm, -RX, RX, -RY, RY, RH + 0.32, RH + 0.6)
    statics.append(lib.mesh_obj("ceiling_slab", bm, [M['wall']]))
    statics.append(fl)

    # skirting + frieze band (custom UVs so the pattern runs along the walls)
    bm = bmesh.new()
    lib.box_mm(bm, -RX, RX, RY - 0.04, RY, 0, 0.28)
    lib.box_mm(bm, -RX, -1.1, -RY, -RY + 0.04, 0, 0.28)
    lib.box_mm(bm, 1.1, RX, -RY, -RY + 0.04, 0, 0.28)
    lib.box_mm(bm, -RX, -RX + 0.04, -RY, RY, 0, 0.28)
    lib.box_mm(bm, RX - 0.04, RX, -RY, RY, 0, 0.28)
    sk = lib.mesh_obj("skirting", bm, [M['beam']])
    lib.finalize(sk, 35)
    lib.uv_box(sk, 1.5)
    statics.append(sk)

    bm = bmesh.new()
    fz0, fz1 = 5.25, 5.75
    lib.box_mm(bm, -RX, RX, RY - 0.03, RY, fz0, fz1)
    lib.box_mm(bm, -RX, RX, -RY, -RY + 0.03, fz0, fz1)
    lib.box_mm(bm, -RX, -RX + 0.03, -RY, RY, fz0, fz1)
    lib.box_mm(bm, RX - 0.03, RX, -RY, RY, fz0, fz1)
    fr = lib.mesh_obj("frieze", bm, [M['frieze']])
    lib.finalize(fr, 35)
    me = fr.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        for l in f.loops:
            co = l.vert.co
            along = co.x if abs(n.y) > 0.5 else co.y
            l[uvl].uv = (along / 3.0, (co.z - fz0) / (fz1 - fz0))
    bm.to_mesh(me)
    bm.free()
    statics.append(fr)
    # moulding lines above / below the frieze
    bm = bmesh.new()
    for z in (fz0 - 0.06, fz1):
        lib.box_mm(bm, -RX, RX, RY - 0.07, RY, z, z + 0.06)
        lib.box_mm(bm, -RX, RX, -RY, -RY + 0.07, z, z + 0.06)
        lib.box_mm(bm, -RX, -RX + 0.07, -RY, RY, z, z + 0.06)
        lib.box_mm(bm, RX - 0.07, RX, -RY, RY, z, z + 0.06)
    ml = lib.mesh_obj("frieze_moulding", bm, [M['beam']])
    lib.finalize(ml, 35)
    lib.uv_box(ml, 1.5)
    statics.append(ml)


def ceiling(M, statics):
    bm = bmesh.new()
    for gy in (-3.0, 3.0):
        lib.box_mm(bm, -RX, RX, gy - 0.18, gy + 0.18, RH - 0.55, RH - 0.15)
    gird = lib.mesh_obj("girders", bm, [M['beam']])
    lib.finalize(gird, 35)
    lib.uv_box(gird, 2.0)
    statics.append(gird)

    bm = bmesh.new()
    rnd = random.Random(2)
    n = 23
    for i in range(n):
        x = -RX + 0.45 + (2 * RX - 0.9) * i / (n - 1)
        r = 0.12 + rnd.uniform(-0.015, 0.02)
        lib.cyl_axis(bm, (x, -RY, RH - 0.02), (x + rnd.uniform(-0.05, 0.05), RY, RH - 0.02), r, r * 0.92, segs=10)
    logs = lib.mesh_obj("palm_beams", bm, [M['beam']])
    lib.finalize(logs, 50)
    # UV along each log (u = length, v = around)
    centers = [-RX + 0.45 + (2 * RX - 0.9) * i / (n - 1) for i in range(n)]
    me = logs.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        c = f.calc_center_median()
        xc = min(centers, key=lambda v: abs(v - c.x))
        ac = math.atan2(c.z - (RH - 0.02), c.x - xc)
        for l in f.loops:
            co = l.vert.co
            a = math.atan2(co.z - (RH - 0.02), co.x - xc)
            a = ac + (a - ac + math.pi) % TAU - math.pi
            l[uvl].uv = (co.y / 2.0, a / TAU * 0.8)
    bm.to_mesh(me)
    bm.free()
    statics.append(logs)

    bm = bmesh.new()
    lib.box_mm(bm, -RX, RX, -RY, RY, RH + 0.11, RH + 0.32)
    mat = lib.mesh_obj("palm_mat", bm, [M['weave']])
    lib.finalize(mat, 35)
    lib.uv_box(mat, 1.6)
    statics.append(mat)


def windows_and_door(M, statics):
    bm_wood, bm_glow = bmesh.new(), bmesh.new()
    for sx in (-1, 1):
        for wy in (-3.6, 3.6):
            xin = sx * RX
            # lattice (mashrabiya) inside the opening
            for i in range(7):
                yy = wy - 0.6 + 1.2 * i / 6
                top = lib.arch_top_at(yy - wy, 1.3, 3.1) - 0.02
                lib.box_mm(bm_wood, xin + sx * 0.18, xin + sx * 0.24, yy - 0.025, yy + 0.025, 1.35, top)
            for j in range(9):
                z = 1.45 + j * 0.25
                if z > 3.1:
                    hw = 0.62 * math.sqrt(max(0.0, 1 - ((z - 3.1) / 0.75) ** 2))
                else:
                    hw = 0.63
                if hw > 0.05:
                    lib.box_mm(bm_wood, xin + sx * 0.18, xin + sx * 0.24, wy - hw, wy + hw, z - 0.025, z + 0.025)
            # sill and glowing sky behind
            lib.box_mm(bm_wood, xin - 0.05 if sx > 0 else xin - 0.1, xin + 0.1 if sx > 0 else xin + 0.05,
                       wy - 0.85, wy + 0.85, 1.25, 1.36)
            pts = lib.arch_pts(1.4, 3.1, 'pointed', 0.3, 12, 1.3)
            M2 = lib.T(sx * (RX + WT - 0.05), wy, 0) @ lib.Rz(math.pi / 2)
            lib.prism(bm_glow, pts, 0.04, M=M2)
            lib.empty(f"Window.{0 if sx < 0 else 2}{0 if wy < 0 else 1}", (sx * (RX + 0.2), wy, 2.3), size=0.4)
    # door glow + open door leaves
    lib.prism(bm_glow, lib.arch_pts(2.3, 2.6, 'pointed', 0.3, 12, 0.0), 0.04, M=lib.T(0, -RY - WT + 0.05, 0))
    lib.box_mm(bm_wood, -1.25, 1.25, -RY - 0.05, -RY + 0.06, 0.0, 0.04)
    wd = lib.mesh_obj("lattice", bm_wood, [M['wood']])
    lib.finalize(wd, 35)
    lib.uv_box(wd, 1.5)
    gl = lib.mesh_obj("Window_Glow", bm_glow, [M['wglow']])
    lib.finalize(gl, 35)
    statics.append(wd)
    for side, name in ((-1, "InnerDoorL"), (1, "InnerDoorR")):
        ob = scenery.door_leaf(name, 2.2, 2.6, 0.3, 0.12, -RY + 0.12, side, [M['wood'], M['brass'], M['iron']],
                               stud_dx=0.3, stud_dz=0.4, bands=(0.4, 1.6), knock_z=1.3, stud_r=0.035)
        ob.rotation_euler.z = rad(-100) * side
        statics.append(ob)


def screen(M, statics):
    hw, hh = SCREEN_W / 2, SCREEN_H / 2
    y = RY - 0.08
    bm = bmesh.new()
    fw = 0.28
    z0, z1 = SCREEN_Z - hh, SCREEN_Z + hh
    lib.box_mm(bm, -hw - fw, hw + fw, y - 0.14, RY, z0 - fw, z0)
    lib.box_mm(bm, -hw - fw, hw + fw, y - 0.14, RY, z1, z1 + fw)
    lib.box_mm(bm, -hw - fw, -hw, y - 0.14, RY, z0, z1)
    lib.box_mm(bm, hw, hw + fw, y - 0.14, RY, z0, z1)
    # inner bead and carved crest
    lib.box_mm(bm, -hw - 0.05, hw + 0.05, y - 0.19, y - 0.12, z1 + 0.02, z1 + 0.08)
    lib.box_mm(bm, -hw - 0.05, hw + 0.05, y - 0.19, y - 0.12, z0 - 0.08, z0 - 0.02)
    crest = lib.arch_pts(2.6, z1 + fw + 0.05, 'pointed', 0.6, 14, z1 + fw)
    lib.prism(bm, crest, 0.12, M=lib.T(0, y - 0.08, 0))
    frame = lib.mesh_obj("screen_frame", bm, [M['wood']])
    lib.bevel(frame, 0.02, 2)
    lib.finalize(frame, 35)
    lib.uv_box(frame, 1.2)
    statics.append(frame)
    bm = bmesh.new()
    for (x, z) in ((-hw - fw / 2, z0 - fw / 2), (hw + fw / 2, z0 - fw / 2), (-hw - fw / 2, z1 + fw / 2),
                   (hw + fw / 2, z1 + fw / 2), (0, z1 + fw + 0.7)):
        lib.sphere(bm, (x, y - 0.17, z), 0.07, 10, 6, scale=(1, 0.6, 1))
    statics.append(lib.mesh_obj("screen_brass", bm, [M['brass']]))
    # the screen itself (UV 0..1, faces -Y)
    bm = bmesh.new()
    lib.quad(bm, (-hw, y - 0.02, z0), (hw, y - 0.02, z0), (hw, y - 0.02, z1), (-hw, y - 0.02, z1))
    scr = lib.mesh_obj("VideoScreen", bm, [M['screen']])
    lib.uv_fit(scr, 0, 2)
    lib.flat(scr)

    # Omani wooden chest (مندوس) below the screen
    bm = bmesh.new()
    cx, cy = 0.0, RY - 0.55
    lib.box_mm(bm, cx - 0.9, cx + 0.9, cy - 0.38, cy + 0.38, 0.08, 0.72)
    lib.box_mm(bm, cx - 0.94, cx + 0.94, cy - 0.42, cy + 0.42, 0.72, 0.86)
    for sx in (-1, 1):
        for sy in (-1, 1):
            lib.box_mm(bm, cx + sx * 0.84 - 0.06, cx + sx * 0.84 + 0.06, cy + sy * 0.32 - 0.06, cy + sy * 0.32 + 0.06, 0, 0.1)
    chest = lib.mesh_obj("chest", bm, [M['wood']])
    lib.bevel(chest, 0.015, 2)
    lib.finalize(chest, 35)
    lib.uv_box(chest, 1.0)
    statics.append(chest)
    bm = bmesh.new()
    for i in range(9):
        for j in range(3):
            lib.sphere(bm, (cx - 0.8 + i * 0.2, cy - 0.385, 0.22 + j * 0.2), 0.022, 8, 4, scale=(1, 0.6, 1))
    for xx in (-0.6, 0.0, 0.6):
        lib.box_mm(bm, cx + xx - 0.03, cx + xx + 0.03, cy - 0.43, cy - 0.38, 0.1, 0.86)
    lib.box_mm(bm, cx - 0.1, cx + 0.1, cy - 0.45, cy - 0.41, 0.6, 0.78)
    statics.append(lib.mesh_obj("chest_brass", bm, [M['brass']]))


def boards(M):
    specs = [("Board_1", (-RX + 0.06, 0.0, 2.75), rad(90), 3.0, 2.0),
             ("Board_2", (RX - 0.06, 0.0, 2.75), rad(-90), 3.0, 2.0),
             ("Board_3", (-6.55, RY - 0.06, 2.75), 0.0, 2.3, 2.0),
             ("Board_4", (6.55, RY - 0.06, 2.75), 0.0, 2.3, 2.0)]
    for name, loc, yaw, w, h in specs:
        bm = bmesh.new()
        hw, hh = w / 2, h / 2
        lib.box_mm(bm, -hw, hw, -0.02, 0.04, -hh, hh)
        bd = lib.mesh_obj(name, bm, [M['board']], loc=loc, rot=(0, 0, yaw))
        lib.finalize(bd, 35)
        bm = bmesh.new()
        f = 0.12
        lib.box_mm(bm, -hw - f, hw + f, -0.08, 0.05, hh, hh + f)
        lib.box_mm(bm, -hw - f, hw + f, -0.08, 0.05, -hh - f, -hh)
        lib.box_mm(bm, -hw - f, -hw, -0.08, 0.05, -hh, hh)
        lib.box_mm(bm, hw, hw + f, -0.08, 0.05, -hh, hh)
        fr = lib.mesh_obj(name + "_frame", bm, [M['wood']], loc=loc, rot=(0, 0, yaw))
        lib.finalize(fr, 35)
        lib.uv_box(fr, 1.0)


def majlis(M, statics):
    bm_fab, bm_seat = bmesh.new(), bmesh.new()

    def run(p0, p1, inward):
        """Cushion run along a wall from p0 to p1; inward = unit vector into the room."""
        p0, p1 = Vector(p0), Vector(p1)
        d = (p1 - p0)
        L = d.length
        dn = d.normalized()
        yaw = math.atan2(dn.y, dn.x)
        Mw = lib.T(p0.x, p0.y, 0) @ lib.Rz(yaw)
        # local: x along wall, -y into room? choose so +y points to wall
        lib.box(bm_seat, (L / 2, -0.4, 0.06), (L, 0.8, 0.12), M=Mw)
        lib.box(bm_fab, (L / 2, -0.4, 0.2), (L - 0.04, 0.76, 0.16), M=Mw)
        lib.box(bm_fab, (L / 2, -0.08, 0.52), (L - 0.06, 0.16, 0.5), M=Mw @ lib.T(0, 0, 0) )
        k = max(1, int(L / 1.7))
        for i in range(k + 1):
            x = L * i / k
            x = min(max(x, 0.15), L - 0.15)
            a = Mw @ Vector((x, -0.05, 0.38))
            b = Mw @ Vector((x, -0.75, 0.38))
            lib.cyl_axis(bm_fab, a, b, 0.11, segs=12)

    # wall runs (direction chosen so local -Y points into the room)
    run((-RX + 0.02, -RY + 0.9), (-RX + 0.02, RY - 1.0), None)   # left wall: going +Y, local -y = +X
    run((RX - 0.02, RY - 1.0), (RX - 0.02, -RY + 0.9), None)      # right wall: going -Y, local -y = -X
    run((-1.6, -RY + 0.02), (-RX + 0.9, -RY + 0.02), None)        # front left
    run((RX - 0.9, -RY + 0.02), (1.6, -RY + 0.02), None)          # front right
    fab = lib.mesh_obj("cushions", bm_fab, [M['fabric']])
    lib.finalize(fab, 50)
    lib.uv_box(fab, 1.2)
    seat = lib.mesh_obj("seat_base", bm_seat, [M['seat']])
    lib.finalize(seat, 35)
    statics += [fab, seat]

    # carpet
    bm = bmesh.new()
    lib.box_mm(bm, -3.75, 3.75, -2.5, 2.5, 0.0, 0.025)
    cp = lib.mesh_obj("Carpet", bm, [M['carpet']])
    lib.uv_fit(cp, 1, 0)
    lib.finalize(cp, 35)
    statics.append(cp)

    # coffee tray, dallah, cups, dates
    bm_b, bm_w, bm_st = bmesh.new(), bmesh.new(), bmesh.new()
    lib.cyl(bm_st, 0, 0, 0.02, 0.24, 0.32, 0.26, segs=24)
    lib.cyl(bm_b, 0, 0, 0.26, 0.03, 0.7, 0.7, segs=48)
    lib.torus(bm_b, lib.T(0, 0, 0.29), 0.7, 0.025, 48, 6)
    dm = lib.T(0.22, 0.12, 0.29) @ lib.S(1.35)
    lib.lathe(bm_b, [(0.0, 0.0), (0.105, 0.0), (0.115, 0.02), (0.1, 0.07), (0.07, 0.13), (0.055, 0.19),
                     (0.06, 0.21), (0.088, 0.24), (0.093, 0.265), (0.06, 0.295), (0.028, 0.35), (0.034, 0.37),
                     (0.015, 0.4), (0.022, 0.42), (0.0, 0.44)], segs=24, M=dm)
    sp0 = dm @ Vector((0.07, 0, 0.12))
    sp1 = dm @ Vector((0.2, 0, 0.33))
    lib.cyl_axis(bm_b, sp0, sp1, 0.03, 0.014, segs=10)
    lib.torus(bm_b, dm @ lib.T(-0.09, 0, 0.2) @ lib.Rx(math.pi / 2), 0.075, 0.012, 16, 5)
    for i in range(5):
        a = TAU * i / 5 + 0.7
        lib.lathe(bm_w, [(0.0, 0.0), (0.024, 0.0), (0.04, 0.055), (0.036, 0.057), (0.0, 0.018)], segs=14,
                  M=lib.T(-0.15 + 0.42 * math.cos(a) * 0.6, -0.1 + 0.42 * math.sin(a) * 0.6, 0.29))
    lib.lathe(bm_b, [(0.0, 0.0), (0.08, 0.0), (0.19, 0.07), (0.2, 0.09), (0.17, 0.08), (0.0, 0.03)], segs=24,
              M=lib.T(-0.28, 0.22, 0.29))
    tray = lib.mesh_obj("coffee_brass", bm_b, [M['brass']])
    lib.finalize(tray, 40)
    stand = lib.mesh_obj("coffee_white", bm_w, [M['white']])
    lib.finalize(stand, 40)
    bm = bmesh.new()
    rnd = random.Random(5)
    for i in range(16):
        a, r = rnd.uniform(0, TAU), rnd.uniform(0, 0.12)
        lib.sphere(bm, (-0.28 + r * math.cos(a), 0.22 + r * math.sin(a), 0.36 + rnd.uniform(0, 0.03)), 0.022,
                   6, 4, scale=(1, 1.5, 1))
    dates = lib.mesh_obj("dates", bm, [M['dates']])
    lib.finalize(dates, 60)
    st = lib.mesh_obj("tray_stand", bm_st, [M['wood']])
    lib.finalize(st, 40)
    lib.uv_box(st, 1.0)
    statics += [tray, stand, dates, st]

    # incense burner (مبخرة) and clay jars in the niches
    bm = bmesh.new()
    lib.lathe(bm, [(0.0, 0.0), (0.16, 0.0), (0.16, 0.06), (0.11, 0.1), (0.13, 0.24), (0.19, 0.3), (0.19, 0.34),
                   (0.0, 0.34)], segs=4, M=lib.T(7.6, 4.6, 0) @ lib.Rz(math.pi / 4))
    mb = lib.mesh_obj("mabkhara", bm, [M['wood']])
    lib.finalize(mb, 30)
    lib.uv_box(mb, 0.6)
    statics.append(mb)
    bm = bmesh.new()
    for (x, y) in ((-3.95, RY + 0.17), (3.95, RY + 0.17), (-3.4, -RY - 0.17), (3.4, -RY - 0.17),
                   (-7.6, -RY - 0.17), (7.6, -RY - 0.17)):
        s = 0.9
        lib.lathe(bm, [(0.0, 0), (0.1 * s, 0), (0.2 * s, 0.14 * s), (0.18 * s, 0.34 * s), (0.08 * s, 0.46 * s),
                       (0.1 * s, 0.52 * s), (0.0, 0.52 * s)], segs=14, M=lib.T(x, y, 1.25))
    jars = lib.mesh_obj("jars", bm, [M['clay']])
    lib.finalize(jars, 40)
    statics.append(jars)

    # shields and crossed swords on the front wall
    bm_b, bm_l, bm_i = bmesh.new(), bmesh.new(), bmesh.new()
    for sx in (-1, 1):
        x = sx * 5.5
        y = -RY + 0.05
        for sg in (-1, 1):
            lib.box(bm_i, (0, 0, 0), (1.5, 0.03, 0.05),
                    M=lib.T(x, y + 0.06, 3.3) @ lib.Ry(sg * rad(40)))
        lib.cyl_axis(bm_l, (x, y + 0.02, 3.3), (x, y + 0.14, 3.3), 0.42, 0.4, segs=36)
        lib.cyl_axis(bm_b, (x, y + 0.14, 3.3), (x, y + 0.2, 3.3), 0.12, 0.06, segs=20)
        for i in range(6):
            a = TAU * i / 6
            lib.sphere(bm_b, (x + 0.28 * math.cos(a), y + 0.15, 3.3 + 0.28 * math.sin(a)), 0.035, 8, 4)
    statics += [lib.mesh_obj("shield_brass", bm_b, [M['brass']]), lib.mesh_obj("shield_leather", bm_l, [M['leather']]),
                lib.mesh_obj("swords", bm_i, [M['iron']])]


def lanterns(M, statics):
    bm = bmesh.new()
    lights = []
    for (x, y) in ((-4.6, -1.5), (4.6, -1.5), (-4.6, 2.2), (4.6, 2.2), (0, 0.4)):
        z = 3.55 if x else 3.9
        lights.append(scenery.lantern(bm, (x, y, z), 0, 1, 1.35, hanging=True))
        lib.cyl_axis(bm, (x, y, z + 1.36), (x, y, RH - 0.12), 0.012, segs=4)
    lan = lib.mesh_obj("lanterns", bm, [M['brass'], M['glass']])
    lib.finalize(lan, 40)
    statics.append(lan)
    for i, p in enumerate(lights):
        lib.empty(f"Light.{i:03d}", p, size=0.3)


def build():
    lib.reset()
    lib.use_collection("FortInterior")
    M = mats()
    statics = []
    shell(M, statics)
    ceiling(M, statics)
    windows_and_door(M, statics)
    screen(M, statics)
    majlis(M, statics)
    lanterns(M, statics)
    boards(M)
    for ob in statics:
        if not ob.data.uv_layers:
            lib.finalize(ob, 35)
            lib.uv_box(ob, 2.5)
    lib.join(statics, "Interior_Static")
    # colliders for the playable character
    lib.col_box(-RX, -RX + 0.85, -RY + 0.9, RY - 1.0, 0.36)
    lib.col_box(RX - 0.85, RX, -RY + 0.9, RY - 1.0, 0.36)
    lib.col_box(-RX + 0.9, -1.6, -RY, -RY + 0.85, 0.36)
    lib.col_box(1.6, RX - 0.9, -RY, -RY + 0.85, 0.36)
    lib.col_circle(0, 0, 0.75, 0.32)
    lib.col_box(-0.95, 0.95, RY - 0.98, RY, 0.86)
    lib.col_circle(7.6, 4.6, 0.25, 0.34)
    for sx in (-1, 1):
        lib.col_box(sx * 1.1 - 0.2, sx * 1.1 + 0.2, -RY + 0.05, -RY + 1.2, 3.0)
    lib.empty("Cam_Start", (0, -4.6, 1.65), size=0.5)
    lib.empty("Cam_Look", (0, RY, SCREEN_Z - 0.2), size=0.5)


if __name__ == "__main__":
    build()
    lib.export_glb("fort_interior")
    lib.export_colliders("fort_interior", bounds=dict(x0=-RX, x1=RX, z0=-RY, z1=RY), ground=0.025,
                         spawn=dict(x=0, z=4.6, yaw=3.14159))
    lib.setup_world((0.35, 0.3, 0.25), (0.6, 0.5, 0.4), 0.6)
    pl = lib.bpy.data.lights.new("Fill", 'POINT')
    pl.energy = 1800
    pl.color = (1.0, 0.75, 0.45)
    o = lib.bpy.data.objects.new("Fill", pl)
    lib.bpy.context.scene.collection.objects.link(o)
    o.location = (0, 0, 4.2)
    for (x, y) in ((-4.6, -1.5), (4.6, -1.5), (-4.6, 2.2), (4.6, 2.2)):
        p2 = lib.bpy.data.lights.new("L", 'POINT')
        p2.energy = 250
        p2.color = (1.0, 0.7, 0.4)
        o2 = lib.bpy.data.objects.new("L", p2)
        lib.bpy.context.scene.collection.objects.link(o2)
        o2.location = (x, y, 3.9)
    lib.add_camera((0, -5.3, 1.7), (0, 6, 2.6), 24)
    lib.setup_render((1280, 720), 48)
    lib.pack_and_save("fort_interior")
    lib.render_still(os.path.join(lib.RENDER_DIR, "interior.jpg"))
    cam = lib.bpy.context.scene.camera
    cam.location = (6, 4.5, 2.2)
    cam.rotation_euler = lib.look_rot(lib.Vector((-3, -3, 1.2)) - lib.Vector(cam.location))
    lib.render_still(os.path.join(lib.RENDER_DIR, "interior2.jpg"))
