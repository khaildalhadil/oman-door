"""The five station scenes of «عُمان تُروى من جديد».

  blender -b -P build_stations.py -- nav sumhuram turtles ivory clothing

Each scene exports  web/public/models/station_<id>.glb  +  station_<id>_colliders.json
Named empties used by the web app:
  Item_<key>   information points        Exit          portal back to the plaza
  Dig_<n>/Art_<n>  (sumhuram)            Lamp_<n>, Hatch_<n>  (turtles)
  Scroll_<n> (nav) MapTop (ivory)        Piece_<key>, Mirror  (clothing)
  Board_<key> painted boards (Board_name = station title plaque)
  Light_*      lantern positions"""
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


# ------------------------------------------------------------------ shared
def base_mats():
    M = {}
    M['paving'] = lib.material("M_Paving", (0.75, 0.68, 0.58), 0.8, albedo="paving_a", normal="paving_n", rmap="paving_r")
    M['trim'] = lib.material("M_PlasterTrim", (0.85, 0.76, 0.62), 0.85, albedo="plaster_sand_a", normal="plaster_n",
                             rmap="plaster_r")
    M['white'] = lib.material("M_PlasterWhite", (0.95, 0.93, 0.88), 0.85, albedo="plaster_white_a", normal="plaster_n",
                              rmap="plaster_r")
    M['inner'] = lib.material("M_InnerPlaster", (0.9, 0.83, 0.72), 0.9, albedo="plaster_inner_a", normal="plaster_n",
                              rmap="plaster_r")
    M['stone'] = lib.material("PZ_Stone", (0.78, 0.66, 0.52), 0.9, albedo="rock_a", normal="rock_n")
    M['wood'] = lib.material("M_DoorWood", (0.4, 0.25, 0.13), 0.6, albedo="wood_a", normal="wood_n", rmap="wood_r")
    M['wdark'] = lib.material("M_WoodDark", (0.25, 0.16, 0.09), 0.7, albedo="wood_dark_a", normal="wood_n", rmap="wood_r")
    M['beam'] = lib.material("M_Beam", (0.3, 0.2, 0.12), 0.75, albedo="wood_dark_a", normal="wood_n")
    M['weave'] = lib.material("M_Weave", (0.7, 0.56, 0.36), 0.85, albedo="weave_a", normal="weave_n", double_sided=True)
    M['brass'] = lib.material("M_Brass", (0.86, 0.66, 0.34), 0.3, metal=1.0)
    M['iron'] = lib.material("M_Iron", (0.13, 0.12, 0.12), 0.5, metal=0.8)
    M['glass'] = lib.material("M_LanternGlass", (1.0, 0.85, 0.6), 0.3, emission=(1.0, 0.7, 0.38), emission_strength=8.0)
    M['sand'] = lib.material("M_Sand", (0.88, 0.72, 0.5), 0.95, albedo="sand_a", normal="sand_n", rmap="sand_r")
    M['rock'] = lib.material("M_Rock", (0.5, 0.42, 0.35), 0.9, albedo="rock_a", normal="rock_n")
    M['water'] = lib.material("M_Water", (0.10, 0.32, 0.36), 0.05, metal=0.1)
    M['sail'] = lib.material("PZ_Sail", (0.95, 0.91, 0.82), 0.85, double_sided=True)
    M['rope'] = lib.material("Q_Rope", (0.55, 0.45, 0.3), 0.9)
    M['clay'] = lib.material("M_Clay", (0.66, 0.36, 0.2), 0.8)
    M['carpet'] = lib.material("M_Carpet", (0.6, 0.1, 0.1), 0.95, albedo="carpet_a", normal="carpet_n")
    M['fabric'] = lib.material("M_Fabric", (0.6, 0.1, 0.1), 0.85, albedo="fabric_a", normal="fabric_n")
    M['frieze'] = lib.material("M_Frieze", (0.9, 0.8, 0.6), 0.8, albedo="frieze_a")
    M['board'] = lib.material("M_Board", (0.93, 0.88, 0.77), 0.92)
    M['portal'] = lib.material("PZ_Portal", (0.1, 0.1, 0.1), 0.9, emission=(1.0, 0.8, 0.45), emission_strength=1.0)
    M['leaf'] = lib.material("PZ_Leaf", (0.36, 0.46, 0.22), 0.7)
    M['bark'] = lib.material("PZ_Bark", (0.58, 0.50, 0.42), 0.9)
    M['soil'] = lib.material("M_Soil", (0.36, 0.26, 0.18), 0.95)
    M['wglow'] = lib.material("M_WindowGlow", (1.0, 0.86, 0.62), 0.9, emission=(1.0, 0.82, 0.58), emission_strength=5.0)
    return M


class Kit:
    """Collects bmesh geometry per material, then emits one object per material."""

    def __init__(self, M):
        self.M = M
        self.bms = {}

    def bm(self, key):
        if key not in self.bms:
            self.bms[key] = bmesh.new()
        return self.bms[key]

    def emit(self, prefix, statics, uv_tile=2.0):
        for key, bm in self.bms.items():
            ob = lib.mesh_obj(f"{prefix}_{key}", bm, [self.M[key]])
            lib.finalize(ob, 40, recalc=False)
            lib.uv_box(ob, uv_tile)
            statics.append(ob)
        self.bms = {}


def multi(name, bm, mats_list, statics, uv=1.5, angle=40):
    ob = lib.mesh_obj(name, bm, mats_list)
    lib.finalize(ob, angle, recalc=False)
    lib.uv_box(ob, uv)
    statics.append(ob)
    return ob


def exit_portal(M, statics, x, y, yaw, w=2.6, theme=None):
    """Heritage arch back to the plaza. yaw = direction the arch faces (front = local -Y)."""
    W = Matrix.Translation((x, y, 0)) @ lib.Rz(yaw)
    bm = bmesh.new()
    lib.box_mm(bm, -2.6, 2.6, -0.7, 0.7, 0, 4.6, M=W)
    blk = lib.mesh_obj("exit_block", bm, [M['trim']])
    lib.bevel(blk, 0.05, 2)
    lib.boolean(blk, [lib.cutter("c", lambda b: lib.prism(b, lib.arch_pts(w, 2.5, 'pointed', 0.3, 16, -0.5), 3.0, M=W))])
    lib.finalize(blk, 35)
    lib.uv_box(blk, 2.5)
    statics.append(blk)
    bm = bmesh.new()
    for xx in np.linspace(-2.3, 2.3, 5):
        lib.merlon(bm, W @ lib.T(xx, 0, 4.6), w=0.6, d=1.3, h=0.45, tip=0.4)
    cr = lib.mesh_obj("exit_crown", bm, [M['trim']])
    lib.uv_box(cr, 2.0)
    statics.append(cr)
    bm = bmesh.new()
    pts = lib.arch_pts(w - 0.02, 2.48, 'pointed', 0.3, 16, 0.02)
    f = bm.faces.new([bm.verts.new((px, 0, pz)) for px, pz in pts])
    uvl = bm.loops.layers.uv.verify()
    for l in f.loops:
        l[uvl].uv = ((l.vert.co.x + w / 2) / w, l.vert.co.z / 3.7)
    portal = lib.mesh_obj("Portal_exit", bm, [M['portal']])
    portal.matrix_world = W @ lib.T(0, 0.1, 0)
    lib.empty("Exit", tuple(W @ Vector((0, -0.8, 0))), size=0.6)
    for sx in (-1, 1):
        p = W @ Vector((sx * 1.95, 0, 0))
        lib.col_circle(p.x, p.y, 0.7, 5)


def door_exit(M, Y, T=0.6, w=2.4):
    """Glowing portal inside the south doorway of a room() hall + the Exit marker just inside."""
    bm = bmesh.new()
    pts = lib.arch_pts(w + 0.04, 2.7, 'pointed', 0.3, 16, 0.0)
    f = bm.faces.new([bm.verts.new((px, 0, pz)) for px, pz in pts])
    uvl = bm.loops.layers.uv.verify()
    for l in f.loops:
        l[uvl].uv = ((l.vert.co.x + w / 2) / w, l.vert.co.z / 3.9)
    portal = lib.mesh_obj("Portal_exit", bm, [M['portal']])
    portal.matrix_world = lib.T(0, -Y - T * 0.5, 0)
    lib.empty("Exit", (0, -Y + 0.5, 0), size=0.6)


def lamps_row(M, statics, pts, h=3.0, prefix="Light"):
    bm = bmesh.new()
    out = []
    for i, (x, y) in enumerate(pts):
        out.append(scenery.lamp_post(bm, x, y, 0, 1, h=h))
        lib.col_circle(x, y, 0.22, h + 0.5)
    multi(prefix + "_posts", bm, [M['iron'], M['glass']], statics)
    for i, p in enumerate(out):
        lib.empty(f"{prefix}_{i}", p, size=0.3)
    return out


def room(M, statics, X=9.0, Y=7.0, H=6.0, wall='inner', windows=(), door_s=True, niches=(), beams=True, frieze=True,
         door_glow=False):
    """Rectangular hall centred on the origin. windows: [(side, pos)] side in 'E','W','N'."""
    T = 0.6

    def wall_obj(name, x0, x1, y0, y1, cuts):
        bm = bmesh.new()
        lib.box_mm(bm, x0, x1, y0, y1, 0, H + 0.5)
        ob = lib.mesh_obj(name, bm, [M[wall]])
        if cuts:
            lib.boolean(ob, cuts)
        lib.finalize(ob, 35)
        lib.uv_box(ob, 3.0)
        statics.append(ob)

    def ac(w, spring, depth, x, y, bottom=-0.5, yaw=0.0):
        return lib.cutter("c", lambda b: lib.prism(b, lib.arch_pts(w, spring, 'pointed', 0.3, 16, bottom), depth,
                                                   M=lib.T(x, y, 0) @ lib.Rz(yaw)))
    cuts_s = [ac(2.4, 2.7, 2.0, 0, -Y - T / 2)] if door_s else []
    cuts_n, cuts_e, cuts_w = [], [], []
    for side, pos in windows:
        if side == 'N':
            cuts_n.append(ac(1.4, 3.1, 2.0, pos, Y + T / 2, bottom=1.4))
        elif side == 'E':
            cuts_e.append(ac(1.4, 3.1, 2.0, X + T / 2, pos, bottom=1.4, yaw=math.pi / 2))
        else:
            cuts_w.append(ac(1.4, 3.1, 2.0, -X - T / 2, pos, bottom=1.4, yaw=math.pi / 2))
    for side, pos in niches:
        if side == 'N':
            cuts_n.append(ac(1.1, 2.5, 0.7, pos, Y, bottom=1.1))
        elif side == 'E':
            cuts_e.append(ac(1.1, 2.5, 0.7, X, pos, bottom=1.1, yaw=math.pi / 2))
        elif side == 'W':
            cuts_w.append(ac(1.1, 2.5, 0.7, -X, pos, bottom=1.1, yaw=math.pi / 2))
    wall_obj("wall_s", -X - T, X + T, -Y - T, -Y, cuts_s)
    wall_obj("wall_n", -X - T, X + T, Y, Y + T, cuts_n)
    wall_obj("wall_e", X, X + T, -Y, Y, cuts_e)
    wall_obj("wall_w", -X - T, -X, -Y, Y, cuts_w)
    bm = bmesh.new()
    lib.box_mm(bm, -X, X, -Y, Y, -0.3, 0.0)
    lib.box_mm(bm, -1.3, 1.3, -Y - T, -Y, -0.3, 0.0)
    fl = lib.mesh_obj("floor", bm, [M['trim']])
    lib.finalize(fl, 35)
    lib.uv_box(fl, 3.0)
    statics.append(fl)
    bm = bmesh.new()
    lib.box_mm(bm, -X, X, -Y, Y, H + 0.3, H + 0.55)
    statics.append(lib.mesh_obj("ceiling", bm, [M[wall]]))
    if beams:
        bm = bmesh.new()
        n = int(2 * X / 0.75)
        for i in range(n + 1):
            x = -X + 0.3 + (2 * X - 0.6) * i / n
            lib.cyl_axis(bm, (x, -Y, H - 0.02), (x, Y, H - 0.02), 0.12, 0.11, segs=10)
        lib.box_mm(bm, -X, X, -0.2, 0.2, H - 0.5, H - 0.12)
        ob = lib.mesh_obj("beams", bm, [M['beam']])
        lib.finalize(ob, 50)
        lib.uv_box(ob, 1.5)
        statics.append(ob)
        bm = bmesh.new()
        lib.box_mm(bm, -X, X, -Y, Y, H + 0.11, H + 0.3)
        ob = lib.mesh_obj("palm_mat", bm, [M['weave']])
        lib.uv_box(ob, 1.6)
        statics.append(ob)
    if frieze:
        bm = bmesh.new()
        z0, z1 = H - 1.0, H - 0.6
        lib.box_mm(bm, -X, X, Y - 0.03, Y, z0, z1)
        lib.box_mm(bm, -X, -1.3, -Y, -Y + 0.03, z0, z1)
        lib.box_mm(bm, 1.3, X, -Y, -Y + 0.03, z0, z1)
        lib.box_mm(bm, -X, -X + 0.03, -Y, Y, z0, z1)
        lib.box_mm(bm, X - 0.03, X, -Y, Y, z0, z1)
        fr = lib.mesh_obj("frieze", bm, [M['frieze']])
        me = fr.data
        b2 = bmesh.new()
        b2.from_mesh(me)
        uvl = b2.loops.layers.uv.verify()
        for f in b2.faces:
            for l in f.loops:
                co = l.vert.co
                along = co.x if abs(f.normal.y) > 0.5 else co.y
                l[uvl].uv = (along / 3.0, (co.z - z0) / (z1 - z0))
        b2.to_mesh(me)
        b2.free()
        statics.append(fr)
    # window glow panes
    bm = bmesh.new()
    for side, pos in windows:
        pts = lib.arch_pts(1.5, 3.1, 'pointed', 0.3, 12, 1.3)
        if side == 'N':
            lib.prism(bm, pts, 0.04, M=lib.T(pos, Y + T - 0.05, 0))
        elif side == 'E':
            lib.prism(bm, pts, 0.04, M=lib.T(X + T - 0.05, pos, 0) @ lib.Rz(math.pi / 2))
        else:
            lib.prism(bm, pts, 0.04, M=lib.T(-X - T + 0.05, pos, 0) @ lib.Rz(math.pi / 2))
    if windows:
        lib.mesh_obj("Window_Glow", bm, [M['wglow']])
    if door_s and door_glow:
        bm = bmesh.new()
        lib.prism(bm, lib.arch_pts(2.5, 2.7, 'pointed', 0.3, 12, 0.0), 0.04, M=lib.T(0, -Y - T + 0.05, 0))
        lib.mesh_obj("Door_Glow", bm, [M['wglow']])
    lib.export_bounds = dict(x0=-X, x1=X, z0=-Y, z1=Y)


def hanging_lanterns(M, statics, pts, z=3.6, H=6.0):
    bm = bmesh.new()
    out = []
    for (x, y) in pts:
        out.append(scenery.lantern(bm, (x, y, z), 0, 1, 1.3, hanging=True))
        lib.cyl_axis(bm, (x, y, z + 1.3), (x, y, H - 0.1), 0.012, segs=4)
    multi("lanterns", bm, [M['brass'], M['glass']], statics)
    for i, p in enumerate(out):
        lib.empty(f"Light_{i}", p, size=0.3)


def finish(name, statics, bounds, spawn, ground=0.0):
    lib.join(statics, name + "_Static")
    lib.export_glb("station_" + name)
    lib.export_colliders("station_" + name, bounds=bounds, ground=ground, spawn=spawn)


# ====================================================== 1. Hamad bin Saif
def build_nav():
    """«مجلس العلم»: majlis + library for the station on حمد بن سيف البوسعيدي (judge, historian, author).
    No figure of the person: the story is told by places, books and manuscripts."""
    lib.reset()
    lib.use_collection("StationNav")
    M = base_mats()
    statics = []
    rnd = random.Random(19)
    X, Y, H = 10.0, 7.0, 6.2
    room(M, statics, X, Y, H, wall='inner', windows=[('E', -3.0), ('W', -3.0)], niches=[('N', -7.0), ('N', 7.0)])
    paper = lib.material("ST_Paper", (0.93, 0.88, 0.74), 0.9)
    covers = [lib.material(n, c, 0.7) for n, c in (("ST_BookRed", (0.42, 0.09, 0.07)), ("ST_BookGreen", (0.08, 0.27, 0.16)),
                                                   ("ST_BookBlue", (0.10, 0.16, 0.34)), ("ST_BookBrown", (0.33, 0.2, 0.1)))]
    cushion = lib.material("ST_Cushion", (0.55, 0.12, 0.1), 0.9, albedo="fabric_a")
    lib_mats = [M['wdark'], paper] + covers          # 0 wood, 1 paper, 2..5 covers
    C = [2, 3, 4, 5]

    # --- west wall: tall bookshelves (books standing, spines facing the room)
    bm = bmesh.new()
    y0, y1, x0 = -5.6, 4.1, -X
    lib.box_mm(bm, x0, x0 + 0.62, y0, y1, 0, 0.12, mi=0)
    for k in range(5):
        z = 0.12 + k * 0.78
        lib.box_mm(bm, x0, x0 + 0.62, y0, y1, z, z + 0.05, mi=0)
    for yy in np.linspace(y0, y1, 6):
        lib.box_mm(bm, x0, x0 + 0.62, yy - 0.04, yy + 0.04, 0, 3.4, mi=0)
    lib.box_mm(bm, x0, x0 + 0.66, y0 - 0.05, y1 + 0.05, 3.4, 3.52, mi=0)
    bays = np.linspace(y0, y1, 6)
    for k in range(4):
        z = 0.17 + k * 0.78
        for b0, b1 in zip(bays[:-1], bays[1:]):
            props.book_row(bm, lib.T(x0 + 0.33, b0 + 0.06, z) @ lib.Rz(math.pi / 2), (b1 - b0) - 0.12, rnd, C, 1,
                           h=(0.4, 0.62), depth=0.36)
    multi("bookshelves", bm, lib_mats, statics, uv=0.6)
    lib.col_box(x0, x0 + 0.75, y0, y1, 3.6)
    lib.empty("Item_books", (-7.4, 0.2, 0), size=0.4)

    # --- east wall: manuscript cabinet (cubbies with rolled manuscripts)
    bm = bmesh.new()
    cy0, cy1, cx1 = -0.4, 4.6, X
    cols, rows = 6, 4
    for i in range(cols + 1):
        yy = cy0 + (cy1 - cy0) * i / cols
        lib.box_mm(bm, cx1 - 0.6, cx1, yy - 0.04, yy + 0.04, 0, 3.0, mi=0)
    for j in range(rows + 1):
        z = j * 3.0 / rows
        lib.box_mm(bm, cx1 - 0.6, cx1, cy0, cy1, z, z + 0.05, mi=0)
    for i in range(cols):
        for j in range(rows):
            yc = cy0 + (cy1 - cy0) * (i + 0.5) / cols
            zc = j * 3.0 / rows + 0.11
            for k in range(rnd.randint(3, 5)):
                yy = yc + (k % 3 - 1) * 0.13
                zz = zc + (k // 3) * 0.11
                props.scroll(bm, lib.T(cx1 - 0.3, yy, zz), 0.46, 0.055, 1, 0)
    multi("manuscripts", bm, [M['wdark'], paper], statics, uv=0.6)
    lib.col_box(cx1 - 0.7, cx1, cy0, cy1, 3.2)
    lib.empty("Item_manuscripts", (7.5, 2.1, 0), size=0.4)

    # --- north: the judge's majlis (carpet, cushions, low desk) + name plaque
    bm = bmesh.new()
    lib.box_mm(bm, -3.8, 3.8, 3.4, 6.95, 0.0, 0.025)
    cp = lib.mesh_obj("majlis_carpet", bm, [M['carpet']])
    lib.uv_fit(cp, 0, 1)
    statics.append(cp)
    bm = bmesh.new()
    for x in np.linspace(-3.1, 3.1, 6):
        lib.box(bm, (x, 6.55, 0.45), (1.0, 0.3, 0.6))       # back cushions (masnad)
        lib.box(bm, (x, 6.05, 0.1), (1.05, 0.75, 0.2))      # seat cushions
    for sx in (-1, 1):
        for y in (4.2, 5.2):
            lib.box(bm, (sx * 3.45, y, 0.1), (0.75, 1.0, 0.2))
            lib.box(bm, (sx * 3.75, y, 0.45), (0.3, 1.0, 0.6))
    multi("cushions", bm, [cushion], statics, uv=0.7)
    lib.col_box(-3.9, 3.9, 5.6, 6.95, 0.8)
    lib.col_box(3.05, 3.95, 3.6, 5.8, 0.8)
    lib.col_box(-3.95, -3.05, 3.6, 5.8, 0.8)
    bm = bmesh.new()
    lib.box_mm(bm, -1.2, 1.2, 4.3, 4.95, 0.38, 0.45, mi=0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            lib.box_mm(bm, sx * 1.1 - 0.05, sx * 1.1 + 0.05, 4.62 + sy * 0.25 - 0.05, 4.62 + sy * 0.25 + 0.05, 0, 0.38,
                       mi=0)
    props.open_book(bm, lib.T(-0.35, 4.62, 0.45), 0.44, 0.3, 2, 1)
    lib.cyl(bm, 0.55, 4.55, 0.45, 0.08, 0.05, 0.04, segs=10, mi=3)                     # inkwell
    lib.cyl_axis(bm, (0.55, 4.55, 0.52), (0.75, 4.75, 0.78), 0.008, 0.002, segs=5, mi=1)  # quill
    for k in range(3):
        lib.box(bm, (0, 0, 0), (0.3, 0.22, 0.004), mi=1,
                M=lib.T(0.75 + k * 0.02, 4.68, 0.456 + k * 0.004) @ lib.Rz(rad(rnd.uniform(-12, 12))))
    multi("judge_desk", bm, [M['wdark'], paper, covers[0], M['iron']], statics, uv=0.6)
    lib.col_box(-1.3, 1.3, 4.2, 5.05, 0.6)
    bm = bmesh.new()
    lib.box_mm(bm, -1.6, 1.6, -0.05, 0.05, -0.62, 0.62)
    b = lib.mesh_obj("Board_name", bm, [M['board']])
    b.matrix_world = lib.T(0, Y - 0.08, 3.55)
    bm = bmesh.new()
    lib.box_mm(bm, -1.72, 1.72, Y - 0.06, Y - 0.02, 2.82, 4.28)
    multi("name_frame", bm, [M['brass']], statics)
    lib.empty("Item_judge", (0.0, 2.7, 0), size=0.4)

    # --- north-west niche: seeking knowledge in Nizwa (reading stand + lantern)
    bm = bmesh.new()
    lib.box_mm(bm, -8.2, -5.8, 4.9, 6.6, 0.0, 0.02, mi=2)
    props.lectern(bm, lib.T(-7.0, 5.7, 0.02), 0, 1, 3)
    multi("nizwa_corner", bm, [M['wdark'], covers[1], M['carpet'], paper], statics, uv=0.6)
    lib.col_box(-7.5, -6.5, 5.3, 6.2, 0.8)
    lib.empty("Item_nizwa", (-6.6, 3.5, 0), size=0.4)

    # --- centre: low reading table with books and manuscripts
    bm = bmesh.new()
    lib.box_mm(bm, -1.6, 1.6, -0.9, 0.9, 0.46, 0.56, mi=0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            lib.box_mm(bm, sx * 1.45 - 0.06, sx * 1.45 + 0.06, sy * 0.75 - 0.06, sy * 0.75 + 0.06, 0, 0.46, mi=0)
    props.open_book(bm, lib.T(-0.3, 0.0, 0.56) @ lib.Rz(rad(8)), 0.62, 0.42, 2, 1)
    for k in range(3):
        props.scroll(bm, lib.T(0.9, -0.35 + k * 0.16, 0.6), 0.5, 0.055, 1, 0)
    for k in range(4):
        lib.box(bm, (-1.15, 0.45, 0.6 + k * 0.05), (0.32, 0.24, 0.045), mi=3 + k % 3)
    multi("reading_table", bm, [M['wdark'], paper] + covers, statics, uv=0.6)
    lib.col_box(-1.7, 1.7, -1.0, 1.0, 0.75)

    # --- south-east: «النشأة» corner — a chest and a painted board
    bm = bmesh.new()
    props.chest(bm, lib.T(8.6, -6.2, 0), 1.1, 0.6, 0.6, 0, 1)
    multi("origin_chest", bm, [M['wdark'], M['brass']], statics, uv=0.8)
    lib.col_box(8.0, 9.2, -6.6, -5.8, 0.8)
    bm = bmesh.new()
    lib.box_mm(bm, -0.9, 0.9, -0.05, 0.05, -0.6, 0.6)
    b = lib.mesh_obj("Board_origin", bm, [M['board']])
    b.matrix_world = lib.T(X - 0.08, -4.9, 2.3) @ lib.Rz(-math.pi / 2)
    lib.empty("Item_origin", (8.0, -4.4, 0), size=0.4)

    # --- south-west: chest with books
    bm = bmesh.new()
    props.chest(bm, lib.T(-8.6, -6.3, 0), 1.0, 0.55, 0.55, 0, 1)
    for k in range(3):
        lib.box(bm, (-8.6, -6.3, 0.6 + k * 0.05), (0.34, 0.25, 0.045), mi=2 + k)
    multi("sw_chest", bm, [M['wdark'], M['brass']] + covers, statics, uv=0.8)
    lib.col_box(-9.2, -8.0, -6.7, -5.9, 0.8)

    # manuscripts to collect (the web app draws the glowing scrolls)
    for i, (x, y) in enumerate(((-3.8, -2.6), (4.7, 4.3), (-7.4, -4.9), (4.4, -3.7))):
        lib.empty(f"Scroll_{i + 1}", (x, y, 0), size=0.3)

    hanging_lanterns(M, statics, [(-4.5, -2.0), (4.5, -2.0), (0, -0.2)], z=3.7, H=H)
    door_exit(M, Y)
    finish("nav", statics, dict(x0=-X, x1=X, z0=-Y, z1=Y), dict(x=0, z=5.0, yaw=3.14159), ground=0.0)


# ============================================================ 2. sumhuram
def build_sumhuram():
    lib.reset()
    lib.use_collection("StationSumhuram")
    M = base_mats()
    statics = []
    rnd = random.Random(7)
    kit = Kit(M)

    def wall(x0, x1, y0, y1, h, jag=True):
        bmw = kit.bm('stone')
        lib.box_mm(bmw, x0, x1, y0, y1, 0, h)
        if jag:
            L = max(abs(x1 - x0), abs(y1 - y0))
            n = int(L / 1.1)
            for i in range(n):
                t = (i + 0.5) / n
                cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                hh = rnd.uniform(0.05, 0.45)
                lib.box(bmw, (cx, cy, h + hh / 2), (0.9 if abs(x1 - x0) > abs(y1 - y0) else (x1 - x0),
                                                     0.9 if abs(y1 - y0) >= abs(x1 - x0) else (y1 - y0), hh))
        lib.col_box(x0, x1, y0, y1, h + 0.3)

    # city wall (north wall has the monumental gate at x = 0)
    t = 0.9
    X0, X1, Y0, Y1 = -14.0, 12.0, -10.0, 12.0
    wall(X0, -2.2, Y1 - t, Y1, 2.6)
    wall(2.2, X1, Y1 - t, Y1, 2.6)
    wall(X0, X0 + t, Y0, Y1, 2.2)
    wall(X1 - t, X1, Y0, 3.0, 1.8)
    wall(X1 - t, X1, 6.0, Y1, 2.0)
    wall(X0, -3.5, Y0, Y0 + t, 1.6)
    wall(-0.5, X1, Y0, Y0 + t, 1.4)
    # gate towers + passage with three successive door frames
    for sx in (-1, 1):
        bmg = kit.bm('stone')
        lib.box_mm(bmg, sx * 2.2 - (0 if sx > 0 else 3.2), sx * 2.2 + (3.2 if sx > 0 else 0), Y1 - 1.2, Y1 + 4.5, 0, 4.4)
        lib.col_box(sx * 2.2 - (0 if sx > 0 else 3.2), sx * 2.2 + (3.2 if sx > 0 else 0), Y1 - 1.2, Y1 + 4.5, 5)
    for k, y in enumerate((Y1 + 3.9, Y1 + 2.2, Y1 + 0.4)):
        bmd = kit.bm('wdark')
        for sx in (-1, 1):
            lib.box(bmd, (sx * 1.95, y, 1.5), (0.3, 0.4, 3.0))
        lib.box(bmd, (0, y, 3.1), (4.3, 0.45, 0.3))
    # inner rooms (low ruin walls)
    for (x0, x1, y0, y1, h) in ((-12, -6, 2, 2.6, 1.2), (-6.6, -6, -4, 2.6, 1.0), (-12, -8, -4, -3.4, 0.9),
                                (3, 9, 6.5, 7.1, 1.1), (3, 3.6, 0, 7.1, 1.0), (6, 9, 0, 0.6, 0.8),
                                (-3, 2, -6, -5.4, 0.7)):
        wall(x0, x1, y0, y1, h)
    # temple platform with columns
    bmp = kit.bm('trim')
    lib.box_mm(bmp, -4.5, 1.0, 3.5, 8.5, 0, 0.45)
    lib.col_box(-4.5, 1.0, 3.5, 8.5, 0.45)
    for i, (x, y) in enumerate(((-3.8, 4.2), (0.3, 4.2), (-3.8, 7.8), (0.3, 7.8))):
        props.column(kit.bm('stone'), lib.T(x, y, 0.45), 3.4, 0.3, 0, broken=(i % 2 == 1))
        lib.col_circle(x, y, 0.42, 4)
    # steps to the platform
    for k in range(2):
        lib.box_mm(bmp, -2.6, -0.9, 3.5 - 0.5 * (k + 1), 3.5 - 0.5 * k, 0, 0.15 + 0.15 * k)
    # frankincense grove outside the west wall
    for i, (x, y) in enumerate(((-18, 4), (-20, -1), (-17.5, -6), (-21, 8))):
        props.frankincense_tree(kit.bm('bark'), lib.T(x, y, 0), 1.3, 0, 0, seed=i + 2)
        lib.col_circle(x, y, 0.5, 3)
    # leaves need their own material: rebuild leaves separately
    kit.bms['bark'].free()
    del kit.bms['bark']
    bmt = bmesh.new()
    for i, (x, y) in enumerate(((-18, 4), (-20, -1), (-17.5, -6), (-21, 8))):
        props.frankincense_tree(bmt, lib.T(x, y, 0), 1.3, 0, 1, seed=i + 2)
    multi("frankincense", bmt, [M['bark'], M['leaf']], statics, uv=1.0)
    # amphorae and scattered blocks
    bma = kit.bm('clay')
    for (x, y, s) in ((-10.5, 0.8, 1.0), (-9.8, 1.2, 0.8), (7.8, 2.2, 1.1), (8.3, 1.4, 0.9)):
        props.amphora(bma, lib.T(x, y, 0), s, 0)
        lib.col_circle(x, y, 0.25, 1)
    for k in range(14):
        x, y = rnd.uniform(-13, 11), rnd.uniform(-9, 11)
        s = rnd.uniform(0.3, 0.6)
        lib.box(kit.bm('stone'), (0, 0, s / 2), (s * 1.3, s, s), M=lib.T(x, y, 0) @ lib.Rz(rnd.uniform(0, 3)))
    # dig spots + buried artifacts (raised by the web app)
    digs = [(-9.0, -1.0), (-3.0, 0.0), (6.0, 4.0), (-9.5, 6.5), (5.5, -5.5)]
    for i, (x, y) in enumerate(digs):
        lib.empty(f"Dig_{i + 1}", (x, y, 0), size=0.6)
    art_m = [M['clay'], M['brass'], M['sand'], M['stone'], M['clay']]
    for i, (x, y) in enumerate(digs):
        bm = bmesh.new()
        if i == 0:
            props.amphora(bm, lib.T(0, 0, 0), 0.7, 0)
        elif i == 1:
            lib.cyl(bm, 0, 0, 0, 0.03, 0.14, 0.14, segs=24)
            lib.cyl(bm, 0, 0, 0.03, 0.006, 0.1, 0.1, segs=24)
        elif i == 2:
            for k in range(7):
                lib.ico(bm, (rnd.uniform(-0.12, 0.12), rnd.uniform(-0.12, 0.12), 0.05 + rnd.uniform(0, 0.08)), 0.06, 1,
                        scale=(1.2, 1, 0.8))
        elif i == 3:
            lib.box(bm, (0, 0, 0.25), (0.6, 0.15, 0.5))
            for k in range(4):
                lib.box(bm, (-0.2 + k * 0.13, -0.08, 0.32), (0.06, 0.02, 0.18))
        else:
            lib.lathe(bm, [(0.0, 0.0), (0.12, 0.0), (0.1, 0.12), (0.18, 0.22), (0.18, 0.28), (0.0, 0.28)], segs=4)
        ob = lib.mesh_obj(f"Art_{i + 1}", bm, [art_m[i]], loc=(x, y, -0.6))
        lib.finalize(ob, 40)
        lib.uv_box(ob, 0.5)
    # storage jars by the store rooms («مخازن اللبان»)
    for (x, y, s_) in ((8.1, -2.3, 1.0), (8.7, -1.6, 0.85), (7.7, -3.1, 0.9), (9.0, -2.8, 1.05)):
        props.amphora(bma, lib.T(x, y, 0), s_, 0)
        lib.col_circle(x, y, 0.25, 1)
    # the ancient cemetery south of the walls: low stone cairns and upright stones
    bmc = kit.bm('stone')
    for k in range(16):
        x, y = -12.0 + (k % 6) * 1.25 + rnd.uniform(-0.2, 0.2), -11.4 - (k // 6) * 1.1 + rnd.uniform(-0.2, 0.2)
        lib.ico(bmc, (x, y, 0.05), rnd.uniform(0.35, 0.5), 1, scale=(1.3, 0.9, 0.45))
        if k % 2 == 0:
            lib.box(bmc, (x, y + 0.35, 0.35), (0.28, 0.12, 0.6), M=lib.Rz(0))
        lib.col_circle(x, y, 0.45, 0.6)
    # information points (the encyclopedia sections)
    lib.empty("Item_gate", (0.0, Y1 + 7.0, 0), size=0.5)
    lib.empty("Item_store", (7.0, -1.4, 0), size=0.5)
    lib.empty("Item_secrets", (-4.6, -3.4, 0), size=0.5)
    lib.empty("Item_fort", (6.6, 9.0, 0), size=0.5)
    lib.empty("Item_tomb", (-3.9, -12.6, 0), size=0.5)
    # name plaque facing the arrival point
    bm = bmesh.new()
    lib.box_mm(bm, -1.3, 1.3, -0.05, 0.05, -0.7, 0.7)
    b = lib.mesh_obj("Board_name", bm, [M['board']])
    b.matrix_world = lib.T(4.0, 18.8, 1.6) @ lib.Rz(math.pi)
    bm = bmesh.new()
    for sx in (-1.15, 1.15):
        lib.cyl(bm, sx, 0, -1.6, 2.6, 0.08, 0.08, segs=6, M=lib.T(4.0, 18.8, 1.6) @ lib.Rz(math.pi))
    multi("name_posts", bm, [M['wdark']], statics)
    lib.col_circle(4.0, 18.8, 1.3, 3)
    kit.emit("ruins", statics, uv_tile=2.2)
    # ground plateau + lagoon (khor) to the east and the sea to the south
    bm = bmesh.new()
    lib.box_mm(bm, -40, 17, -40, 40, -3.0, 0.0)
    pl = lib.mesh_obj("plateau", bm, [M['sand']])
    lib.finalize(pl, 35)
    lib.uv_box(pl, 6)
    statics.append(pl)
    bm = bmesh.new()
    for k in range(40):
        y = -40 + k * 2.05
        lib.ico(bm, (17.4 + rnd.uniform(-0.3, 0.4), y, -1.4), rnd.uniform(1.0, 1.6), 1, scale=(0.9, 1.1, 1.0))
    multi("cliff", bm, [M['rock']], statics, uv=3)
    bm = bmesh.new()
    lib.box_mm(bm, 17, 600, -600, 600, -1.62, -1.6)
    w = lib.mesh_obj("Water_Khor", bm, [M['water']])
    lib.uv_box(w, 6)
    lib.col_box(16.8, 40, -40, 40, 6)
    scenery.terrain("Terrain", (M['sand'], M['rock']), seed=33, dune_h=3, size=900, res=150, flat_r=(42, 90),
                    corridor=(0, 1), flat_boxes=[(-45, 20, -45, 45, 20)], mtn_r=(140, 260), mtn_h=(40, 120),
                    mtn_bias=lambda a: np.clip(0.3 + np.sin(a) * 0.8, 0.0, 1.0))
    exit_portal(M, statics, -6.0, 26.0, 0.0)
    finish("sumhuram", statics, dict(x0=-26, x1=16.5, z0=-30, z1=14), dict(x=0, z=-22.0, yaw=0.0))


# ============================================================= 3. turtles
def build_turtles():
    lib.reset()
    lib.use_collection("StationTurtles")
    M = base_mats()
    statics = []
    rnd = random.Random(11)
    shell = lib.material("PZ_Shell", (0.30, 0.36, 0.20), 0.45)
    tskin = lib.material("PZ_TurtleSkin", (0.42, 0.45, 0.33), 0.6)
    egg = lib.material("ST_Egg", (0.96, 0.94, 0.88), 0.5)
    # beach: sloping sand from the dunes (south) down to the sea (north)
    bm = bmesh.new()
    nx, ny = 60, 40
    verts = {}
    for i in range(nx + 1):
        for j in range(ny + 1):
            x = -30 + 60 * i / nx
            y = -24 + 40 * j / ny
            z = 0.8 - (y + 24) / 36 * 1.15 + 0.08 * math.sin(x * 0.7) * math.cos(y * 0.5)
            if y < -18:
                z += (-18 - y) * 0.25
            verts[(i, j)] = bm.verts.new((x, y, z))
    for i in range(nx):
        for j in range(ny):
            bm.faces.new((verts[(i, j)], verts[(i + 1, j)], verts[(i + 1, j + 1)], verts[(i, j + 1)]))
    beach = lib.mesh_obj("beach", bm, [M['sand']])
    lib.finalize(beach, 60, recalc=False, merge=False)
    lib.uv_box(beach, 4)
    statics.append(beach)
    zb_ = lambda yy: 0.8 - (yy + 24) / 36 * 1.15
    lib.col_ramp(-30, 30, -18, 12, zb_(-18), zb_(12))
    # rocks closing the cove
    bm = bmesh.new()
    for sx in (-1, 1):
        for k in range(9):
            x = sx * (22 + rnd.uniform(0, 6))
            y = -20 + k * 4.5
            r = rnd.uniform(1.5, 3.2)
            lib.ico(bm, (x, y, 0.4), r, 2, scale=(1.2, 1.0, 0.8))
            lib.col_circle(x, y, r * 1.1, 4)
    multi("rocks", bm, [M['rock']], statics, uv=3)
    # dune grass and the ranger hut
    bm = bmesh.new()
    for k in range(70):
        x, y = rnd.uniform(-20, 20), rnd.uniform(-23, -15)
        for b_ in range(5):
            a = rnd.uniform(0, TAU)
            h = rnd.uniform(0.3, 0.7)
            base = Vector((x, y, 0.8 + (-18 - y) * 0.25 * (y < -18) + 0.6))
            tip = base + Vector((math.cos(a) * 0.15, math.sin(a) * 0.15, h))
            side = Vector((-math.sin(a), math.cos(a), 0)) * 0.03
            bm.faces.new((bm.verts.new(base - side), bm.verts.new(base + side), bm.verts.new(tip)))
    grass = lib.mesh_obj("grass", bm, [lib.material("ST_Grass", (0.55, 0.55, 0.3), 0.8, double_sided=True)])
    lib.finalize(grass, 89, recalc=False, merge=False)
    statics.append(grass)
    bm = bmesh.new()
    lib.box_mm(bm, -13, -8, -26, -21, 1.8, 4.6)
    hut = lib.mesh_obj("hut", bm, [M['wood']])
    lib.uv_box(hut, 1.5)
    statics.append(hut)
    bm = bmesh.new()
    lib.box_mm(bm, -13.5, -7.5, -26.5, -20.5, 4.6, 4.9)
    multi("hut_roof", bm, [M['weave']], statics)
    lib.col_box(-13.5, -7.5, -26.5, -20.5, 6)
    # info boards on posts
    for key, (x, y, yaw) in {'reserve': (-4.5, -17.5, 0.0), 'protect': (7.5, -14.5, rad(-15))}.items():
        bm = bmesh.new()
        lib.box_mm(bm, -1.0, 1.0, -0.05, 0.05, -0.6, 0.6)
        b = lib.mesh_obj(f"Board_{key}", bm, [M['board']])
        b.matrix_world = lib.T(x, y, 2.3) @ lib.Rz(yaw)
        bm = bmesh.new()
        for sx in (-0.85, 0.85):
            lib.cyl(bm, sx, 0, -1.6, 2.3, 0.07, 0.07, segs=6, M=lib.T(x, y, 1.0) @ lib.Rz(yaw))
        multi(f"board_posts_{key}", bm, [M['wdark']], statics)
        lib.col_circle(x, y, 1.0, 3)
        lib.empty(f"Item_{key}", (x, y - 1.4, 0), size=0.4)
    # bright beach lamps that confuse hatchlings (switched off in the activity)
    out = []
    bm = bmesh.new()
    for i, x in enumerate((-12.0, 1.0, 13.0)):
        y = -9.0
        zb = 0.8 - (y + 24) / 36 * 1.15
        p = scenery.lamp_post(bm, x, y, 0, 1, h=3.4)
        out.append((x, y, zb + 3.6))
        lib.col_circle(x, y, 0.25, 4)
    lamp = lib.mesh_obj("beach_lamps", bm, [M['iron'], lib.material("ST_LampGlass", (1, 0.95, 0.8), 0.3,
                                                                       emission=(1, 0.9, 0.7), emission_strength=10)])
    for v in lamp.data.vertices:
        y = v.co.y
        v.co.z += 0.8 - (y + 24) / 36 * 1.15
    lib.finalize(lamp, 40)
    statics.append(lamp)
    for i, p in enumerate(out):
        lib.empty(f"Lamp_{i + 1}", p, size=0.4)
    # mother turtle with her nest, egg nest, hatchlings
    bm = bmesh.new()
    zh = lambda y: 0.8 - (y + 24) / 36 * 1.15
    props.turtle(bm, lib.T(-6.0, -1.0, zh(-1.0) - 0.05) @ lib.Rz(rad(160)), 1.1, {'shell': 0, 'skin': 1})
    lib.col_circle(-6.0, -1.0, 0.75, 0.6)
    lib.empty("Item_green", (-6.0, -3.2, 0), size=0.4)
    lib.ico(bm, (-6.0, -2.0, zh(-2.0) - 0.05), 0.7, 2, mi=2, scale=(1.4, 0.8, 0.25))
    for k in range(14):
        a = rnd.uniform(0, TAU)
        r = rnd.uniform(0, 0.35)
        lib.sphere(bm, (6.0 + math.cos(a) * r, -3.0 + math.sin(a) * r, zh(-3.0) - 0.08 + rnd.uniform(0, 0.06)), 0.045, 8, 6,
                   mi=3)
    lib.tube(bm, 6.0, -3.0, zh(-3.0) - 0.15, 0.2, 0.7, 0.45, segs=24, mi=2)
    lib.empty("Item_nest", (6.0, -5.0, 0), size=0.4)
    multi("turtles", bm, [shell, tskin, M['sand'], egg], statics, uv=1.0)
    # hatchling template (hidden; cloned by the web app) + spawn points
    bm = bmesh.new()
    props.turtle(bm, lib.T(0, 0, 0), 0.12, {'shell': 0, 'skin': 1})
    tpl = lib.mesh_obj("Hatchling", bm, [shell, tskin], loc=(0, 0, -5))
    lib.finalize(tpl, 50)
    for i in range(8):
        a = TAU * i / 8
        x = 6.0 + math.cos(a) * 0.9 + (i % 2) * 0.3
        y = -3.0 + math.sin(a) * 0.9
        lib.empty(f"Hatch_{i + 1}", (x, y, zh(y)), size=0.15)
    # sea: water surface and an invisible wall a little way into it
    bm = bmesh.new()
    lib.box_mm(bm, -600, 600, 8.5, 600, -0.32, -0.3)
    sea = lib.mesh_obj("Water_Sea", bm, [M['water']])
    lib.uv_box(sea, 6)
    lib.col_box(-40, 40, 10.5, 40, 6)
    exit_portal(M, statics, -14.0, -15.0, math.pi * 0.85)
    for o in [o for o in bpy.data.objects if o.name in ("exit_block", "exit_crown", "Portal_exit", "Exit")]:
        o.location.z += 0.62
    finish("turtles", statics, dict(x0=-21, x1=21, z0=-10.5, z1=17.5), dict(x=0, z=13.5, yaw=3.14159), ground=-0.5)


# ============================================================== 4. ivory
def build_ivory():
    lib.reset()
    lib.use_collection("StationIvory")
    M = base_mats()
    statics = []
    X, Y, H = 10.0, 7.0, 6.2
    room(M, statics, X, Y, H, wall='inner', windows=[('E', -3.0), ('E', 3.0), ('W', -3.0)],
         niches=[('W', 3.2), ('N', -6.5), ('N', 6.5)])
    rnd = random.Random(5)
    ivory = lib.material("PZ_Ivory", (0.95, 0.91, 0.80), 0.35)
    glass = lib.material("ST_Glass", (0.85, 0.92, 0.95), 0.05, metal=0.0)
    # carved Zanzibar door on the north wall (closed, decorative)
    bm = bmesh.new()
    fr = lib.T(0, Y - 0.05, 0)
    lib.prism(bm, lib.arch_pts(3.0, 3.0, 'round', 0.3, 18, 0.0), 0.14, M=fr, mi=0)
    lib.prism(bm, lib.arch_pts(2.4, 2.9, 'round', 0.3, 18, 0.05), 0.2, M=fr @ lib.T(0, -0.05, 0), mi=1)
    for i in range(12):
        for sx in (-1, 1):
            lib.sphere(bm, (sx * 0.55, Y - 0.2, 0.3 + i * 0.22), 0.04, 8, 5, mi=2)
    multi("zanzibar_door", bm, [M['wdark'], M['wood'], M['brass']], statics)
    # map table in the centre (top painted by the web app)
    bm = bmesh.new()
    lib.box_mm(bm, -2.0, 2.0, -1.3, 1.3, 0.9, 1.0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            lib.box_mm(bm, sx * 1.8 - 0.08, sx * 1.8 + 0.08, sy * 1.1 - 0.08, sy * 1.1 + 0.08, 0, 0.9)
    multi("map_table", bm, [M['wdark']], statics)
    lib.col_box(-2.0, 2.0, -1.3, 1.3, 1.2)
    bm = bmesh.new()
    bm_v = [bm.verts.new(p) for p in ((-1.9, -1.2, 1.005), (1.9, -1.2, 1.005), (1.9, 1.2, 1.005), (-1.9, 1.2, 1.005))]
    f = bm.faces.new(bm_v)
    uvl = bm.loops.layers.uv.verify()
    for l, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        l[uvl].uv = uv
    lib.mesh_obj("MapTop", bm, [M['board']])
    lib.empty("Item_network", (0.0, -2.4, 0), size=0.4)
    # goods: chests, clove sacks, spice baskets, textile rolls
    bm = bmesh.new()
    for (x, y, s) in ((-8.6, -5.8, 1.0), (-7.4, -5.9, 0.9), (-8.6, -5.8 + 0.0, 1.0)):
        pass
    for (x, y) in ((-8.2, -5.6), (-6.9, -5.7)):
        props.chest(bm, lib.T(x, y, 0), 1.1, 0.6, 0.6, 0, 1)
        lib.col_box(x - 0.6, x + 0.6, y - 0.35, y + 0.35, 0.7)
    props.chest(bm, lib.T(-7.6, -5.6, 0.6), 0.9, 0.5, 0.5, 0, 1)
    multi("chests", bm, [M['wdark'], M['brass']], statics, uv=1.0)
    bm = bmesh.new()
    for k, (x, y) in enumerate(((7.8, -5.6), (8.5, -4.9), (7.2, -4.8), (8.2, -4.0), (7.7, -3.3))):
        props.sack(bm, lib.T(x, y, 0), 1.0, 0)
        lib.col_circle(x, y, 0.35, 0.8)
    multi("clove_sacks", bm, [lib.material("ST_Jute", (0.62, 0.50, 0.33), 0.95)], statics, uv=0.6)
    lib.empty("Item_cloves", (6.3, -4.4, 0), size=0.4)
    bm = bmesh.new()
    spice_cols = [(0.75, 0.25, 0.1), (0.85, 0.65, 0.1), (0.45, 0.25, 0.12), (0.9, 0.85, 0.75)]
    for k, col in enumerate(spice_cols):
        x, y = 4.0 + k * 1.0, -6.2
        lib.lathe(bm, [(0.0, 0.0), (0.35, 0.0), (0.4, 0.3), (0.0, 0.3)], segs=16, M=lib.T(x, y, 0), mi=0)
        lib.sphere(bm, (x, y, 0.3), 0.32, 14, 8, mi=k + 1, scale=(1, 1, 0.45))
        lib.col_circle(x, y, 0.42, 0.5)
    multi("spices", bm, [M['weave']] + [lib.material(f"ST_Spice{k}", c, 0.95) for k, c in enumerate(spice_cols)], statics,
          uv=0.8)
    bm = bmesh.new()
    for k in range(6):
        y = -3.0 + k * 0.5
        lib.cyl_axis(bm, (-9.6, y, 0.25 + (k % 2) * 0.45), (-8.0, y, 0.25 + (k % 2) * 0.45), 0.22, segs=14,
                     mi=k % 3)
    multi("textiles", bm, [M['fabric'], M['carpet'], lib.material("ST_Indigo", (0.15, 0.2, 0.5), 0.85)], statics, uv=0.8)
    lib.col_box(-9.8, -7.8, -3.4, 0.0, 1.0)
    # museum case with two historic tusks + protection board
    bm = bmesh.new()
    lib.box_mm(bm, 4.5, 8.5, 4.6, 6.0, 0, 0.9)
    multi("case_base", bm, [M['wdark']], statics)
    bm = bmesh.new()
    for sx in (-1, 1):
        pts = [Vector((6.5 + sx * 0.2, 5.3, 1.0)), Vector((6.5 + sx * 1.0, 5.25, 1.25)), Vector((6.5 + sx * 1.7, 5.3, 1.7))]
        lib.cyl_axis(bm, pts[0], pts[1], 0.09, 0.075, segs=12)
        lib.cyl_axis(bm, pts[1], pts[2], 0.075, 0.015, segs=12)
    multi("tusks", bm, [ivory], statics)
    bm = bmesh.new()
    lib.box_mm(bm, 4.55, 8.45, 4.65, 5.95, 0.9, 2.3)
    lib.mesh_obj("Case_Glass", bm, [glass])
    lib.col_box(4.5, 8.5, 4.6, 6.0, 2.4)
    lib.empty("Item_ivory", (6.5, 3.4, 0), size=0.4)
    bm = bmesh.new()
    lib.box_mm(bm, -1.1, 1.1, -0.04, 0.04, -0.7, 0.7)
    b = lib.mesh_obj("Board_protect", bm, [M['board']])
    b.matrix_world = lib.T(X - 0.06, 5.0, 2.4) @ lib.Rz(-math.pi / 2)  # painted side (local -Y) faces the room
    lib.empty("Item_protect", (X - 1.6, 5.0, 0), size=0.4)
    # model dhow on a stand + zanzibar painting
    bm = bmesh.new()
    props.dhow(bm, lib.T(-7.0, 4.8, 1.25) @ lib.Rz(rad(10)), 1.8,
               {'hull': 0, 'deck': 0, 'sail': 1, 'rope': 2, 'trim': 3, 'wood': 0})
    lib.box_mm(bm, -8.2, -5.8, 4.4, 5.2, 0, 0.95, mi=0)
    multi("model_dhow", bm, [M['wood'], M['sail'], M['rope'], M['brass']], statics, uv=0.6)
    lib.col_box(-8.2, -5.8, 4.4, 5.2, 1.2)
    lib.empty("Item_zanzibar", (-7.0, 3.0, 0), size=0.4)
    hanging_lanterns(M, statics, [(-4.5, -2.0), (4.5, -2.0), (0, 3.0)], z=3.7, H=H)
    door_exit(M, Y)
    finish("ivory", statics, dict(x0=-X, x1=X, z0=-Y, z1=Y), dict(x=0, z=5.0, yaw=3.14159), ground=0.0)


# =========================================================== 5. clothing
def build_clothing():
    lib.reset()
    lib.use_collection("StationClothing")
    M = base_mats()
    statics = []
    X, Y, H = 10.0, 7.0, 6.2
    room(M, statics, X, Y, H, wall='white', windows=[('E', 0.0), ('W', 0.0)],
         niches=[('N', -7.5), ('N', 7.5), ('E', -4.5), ('W', -4.5)])
    robe = lib.material("PZ_Robe", (0.97, 0.97, 0.95), 0.7)
    kumma = lib.material("PZ_Kumma", (0.9, 0.85, 0.75), 0.6, albedo="embroid_a")
    silver = lib.material("G_Silver", (0.85, 0.85, 0.88), 0.25, metal=1.0)
    dress = lib.material("PZ_Dress", (0.55, 0.12, 0.45), 0.75)
    velvet = lib.material("ST_Velvet", (0.10, 0.26, 0.58), 0.45)
    emb = lib.material("G_Embroidery", (0.9, 0.7, 0.3), 0.45, metal=0.35, albedo="embroid_a")
    scarf = lib.material("G_Scarf", (0.75, 0.1, 0.25), 0.7, albedo="scarf_a", double_sided=True)
    sirwal = lib.material("G_Sirwal", (0.45, 0.06, 0.12), 0.75)
    mskin = lib.material("PZ_ManneSkin", (0.62, 0.48, 0.36), 0.5)
    bisht = lib.material("ST_Bisht", (0.12, 0.10, 0.09), 0.6)
    masar = lib.material("ST_Masar", (0.75, 0.55, 0.35), 0.8, albedo="fabric_a")
    mats_ = [robe, kumma, silver, dress, velvet, emb, scarf, sirwal, mskin, M['wdark'], bisht, masar]
    idx = {m.name: i for i, m in enumerate(mats_)}
    bm = bmesh.new()
    figs = [
        # (x, y, yaw, kind, mats)
        (-6.5, 4.6, 0.0, 'man', dict(robe=robe, kumma=kumma, silver=silver, skin=mskin, stand=M['wdark'])),
        (-3.2, 5.0, 0.0, 'man', dict(robe=robe, kumma=kumma, silver=silver, skin=mskin, stand=M['wdark'], masar=masar)),
        (3.2, 5.0, 0.0, 'woman', dict(robe=dress, emb=emb, scarf=scarf, sirwal=sirwal, skin=mskin, stand=M['wdark'])),
        (6.5, 4.6, 0.0, 'dhofar', dict(robe=velvet, emb=emb, scarf=scarf, skin=mskin, stand=M['wdark'])),
    ]
    for (x, y, yaw, kind, mm) in figs:
        props.mannequin(bm, lib.T(x, y, 0.22) @ lib.Rz(yaw), kind, {k: idx[v.name] for k, v in mm.items()}, h=1.85)
        lib.col_circle(x, y, 0.6, 2.2)
    # bisht cloak over the formal figure (open front)
    lib.lathe_uv(bm, [(0.36, 0.5 + 0.22), (0.3, 1.0 + 0.22), (0.27, 1.32 + 0.22), (0.18, 1.45 + 0.22)], segs=24,
                 M=lib.T(-3.2, 5.0, 0) @ lib.S(1.06, 0.9, 1.06), a0=rad(-60), a1=rad(240), mi=idx['ST_Bisht'])
    multi("mannequins", bm, mats_, statics, uv=0.8)
    # round platforms
    bm = bmesh.new()
    for (x, y, *_r) in figs:
        lib.cyl(bm, x, y, 0, 0.22, 0.75, 0.75, segs=32)
    multi("platforms", bm, [M['trim']], statics)
    # display table with kummas and a khanjar, fabric shelves
    bm = bmesh.new()
    lib.box_mm(bm, -1.6, 1.6, 4.8, 6.2, 0.85, 0.95, mi=0)
    for sx in (-1, 1):
        lib.box_mm(bm, sx * 1.45 - 0.07, sx * 1.45 + 0.07, 4.9, 6.1, 0, 0.85, mi=0)
    for k in range(3):
        lib.lathe_uv(bm, [(0.115, 0.95), (0.118, 1.01), (0.1, 1.06), (0.0, 1.07)], segs=20,
                     M=lib.T(-0.9 + k * 0.6, 5.3, 0), mi=1, urep=3.0)
    km = lib.T(1.0, 5.6, 1.0) @ lib.Rx(math.pi / 2)
    lib.torus_arc(bm, km, 0.12, 0.035, rad(180), rad(330), 12, 6, mi=2)
    lib.box(bm, (1.0, 5.6, 0.99), (0.08, 0.3, 0.05), mi=2)
    multi("display_table", bm, [M['wdark'], kumma, silver], statics, uv=0.8)
    lib.col_box(-1.6, 1.6, 4.8, 6.2, 1.1)
    bm = bmesh.new()
    for k in range(4):
        lib.box_mm(bm, X - 0.6, X - 0.05, -6.0 + k * 0.05, -2.0, 0.6 + k * 0.7, 0.66 + k * 0.7, mi=0)
        for j in range(5):
            lib.cyl_axis(bm, (X - 0.55, -5.6 + j * 0.75, 0.82 + k * 0.7), (X - 0.1, -5.6 + j * 0.75, 0.82 + k * 0.7), 0.15,
                         segs=12, mi=1 + (j + k) % 3)
    multi("shelves", bm, [M['wdark'], M['fabric'], dress, velvet], statics, uv=0.8)
    lib.col_box(X - 0.7, X, -6.1, -1.9, 3.5)
    # carpet runner
    bm = bmesh.new()
    lib.box_mm(bm, -1.5, 1.5, -6.5, 3.5, 0.0, 0.02)
    cp = lib.mesh_obj("runner", bm, [M['carpet']])
    lib.uv_fit(cp, 0, 1)
    statics.append(cp)
    # the mirror (wardrobe activity)
    bm = bmesh.new()
    lib.box_mm(bm, -X + 0.05, -X + 0.2, -6.0, -3.0, 0.2, 2.8, mi=0)
    lib.box_mm(bm, -X + 0.2, -X + 0.24, -5.8, -3.2, 0.4, 2.6, mi=1)
    multi("mirror", bm, [M['wood'], lib.material("ST_Mirror", (0.9, 0.92, 0.95), 0.05, metal=1.0)], statics)
    lib.empty("Mirror", (-X + 1.4, -4.5, 0), size=0.5)
    lib.col_box(-X, -X + 0.3, -6.0, -3.0, 3)
    # info points and pieces to identify
    for key, (x, y) in {'dishdasha': (-6.5, 3.0), 'kumma': (0.0, 3.6), 'khanjar': (-3.2, 3.3), 'women': (3.2, 3.3),
                        'dhofar': (6.5, 3.0)}.items():
        lib.empty(f"Item_{key}", (x, y, 0), size=0.4)
    pieces = {'dishdasha': (-6.5, 4.32, 1.2), 'kumma': (-6.5, 4.6, 2.0), 'masar': (-3.2, 5.0, 2.05),
              'khanjar': (-3.2, 4.62, 1.05), 'lihaf': (3.2, 4.85, 1.9), 'sirwal': (3.2, 4.8, 0.45)}
    for key, (x, y, z) in pieces.items():
        lib.empty(f"Piece_{key}", (x, y - 0.35, z), size=0.2)
    hanging_lanterns(M, statics, [(-5, -1.5), (5, -1.5), (0, 1.5)], z=3.8, H=H)
    door_exit(M, Y)
    finish("clothing", statics, dict(x0=-X, x1=X, z0=-Y, z1=Y), dict(x=0, z=5.0, yaw=3.14159), ground=0.0)


BUILDERS = {'nav': build_nav, 'sumhuram': build_sumhuram, 'turtles': build_turtles, 'ivory': build_ivory,
            'clothing': build_clothing}

PREVIEW = {
    'nav': ((6.5, -6.2, 3.6), (-1.5, 3, 1.4)),
    'sumhuram': ((10, 34, 10), (-2, 2, 0)),
    'turtles': ((10, -24, 6), (0, 0, 0)),
    'ivory': ((7, -6, 3.5), (-2, 2, 1.2)),
    'clothing': ((0, -6, 2.4), (0, 4, 1.4)),
}

if __name__ == "__main__":
    textures.build_all()
    which = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(BUILDERS)
    for sid in which:
        print("=" * 10, sid)
        BUILDERS[sid]()
        lib.setup_world()
        lib.add_sun((-0.4, -0.7, 0.55), 4.0 if sid not in ('nav', 'ivory', 'clothing') else 1.0)
        if sid in ('nav', 'ivory', 'clothing'):
            pl = bpy.data.lights.new("Fill", 'POINT')
            pl.energy = 2500
            o = bpy.data.objects.new("Fill", pl)
            bpy.context.scene.collection.objects.link(o)
            o.location = (0, 0, 4.5)
        pos, tgt = PREVIEW[sid]
        lib.add_camera(pos, tgt, 22 if sid in ('nav', 'ivory', 'clothing') else 28)
        lib.setup_render((1280, 720), 24)
        lib.pack_and_save("station_" + sid)
        try:  # preview only — never block the export of the next station
            lib.render_still(os.path.join(lib.RENDER_DIR, f"station_{sid}.jpg"))
        except RuntimeError as e:
            print("preview render skipped:", e)
