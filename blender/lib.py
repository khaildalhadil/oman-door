"""
Shared helpers for the Oman 3D journey Blender pipeline.

Everything is built procedurally with bmesh so the scenes are fully
reproducible:   blender -b -P build_all.py

Conventions (Blender space):
  * Z is up, the "front" of every monument faces -Y (towards the visitor).
  * Units are metres.
  * The glTF exporter converts to Y-up, so Blender (x, y, z) -> three.js (x, z, -y).
"""
import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
TEX_DIR = os.path.join(HERE, "textures")
BLEND_DIR = os.path.join(HERE, "blend")
RENDER_DIR = os.path.join(HERE, "renders")
WEB_MODELS = os.path.join(PROJECT, "web", "public", "models")
WEB_VIDEO = os.path.join(PROJECT, "web", "public", "video")
for _d in (TEX_DIR, BLEND_DIR, RENDER_DIR, WEB_MODELS, WEB_VIDEO):
    os.makedirs(_d, exist_ok=True)

TAU = math.tau
rad = math.radians


# --------------------------------------------------------------------------
# scene / objects
# --------------------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    _COLL[0] = None
    COLLIDERS.clear()
    return sc


_COLL = [None]


def use_collection(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    _COLL[0] = c
    return c


def link(ob):
    (_COLL[0] or bpy.context.scene.collection).objects.link(ob)
    return ob


def mesh_obj(name, bm, mats=(), loc=None, rot=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    if loc is not None:
        ob.location = loc
    if rot is not None:
        ob.rotation_euler = rot
    return link(ob)


def empty(name, loc, rot=(0, 0, 0), size=1.0, kind='PLAIN_AXES'):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type = kind
    ob.empty_display_size = size
    ob.location = loc
    ob.rotation_euler = rot
    return link(ob)


def T(x, y=0.0, z=0.0):
    return Matrix.Translation((x, y, z))


def Rz(a):
    return Matrix.Rotation(a, 4, 'Z')


def Rx(a):
    return Matrix.Rotation(a, 4, 'X')


def Ry(a):
    return Matrix.Rotation(a, 4, 'Y')


def S(x, y=None, z=None):
    y = x if y is None else y
    z = x if z is None else z
    return Matrix.Diagonal((x, y, z, 1.0))


# --------------------------------------------------------------------------
# bmesh primitives (all append into an existing bmesh)
# --------------------------------------------------------------------------
def _mi(verts, mi):
    if mi:
        for v in verts:
            for f in v.link_faces:
                f.material_index = mi
    return verts


def box(bm, center, size, mi=0, M=None):
    m = T(*center) @ S(*size)
    if M is not None:
        m = M @ m
    return _mi(bmesh.ops.create_cube(bm, size=1.0, matrix=m)['verts'], mi)


def box_mm(bm, x0, x1, y0, y1, z0, z1, mi=0, M=None):
    return box(bm, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
               (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)), mi, M)


def cyl(bm, x, y, z0, h, r1, r2=None, segs=32, mi=0, cap=True, M=None):
    r2 = r1 if r2 is None else r2
    m = T(x, y, z0 + h / 2)
    if M is not None:
        m = M @ m
    vs = bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=segs,
                               radius1=r1, radius2=r2, depth=h, matrix=m)['verts']
    return _mi(vs, mi)


def cyl_axis(bm, p0, p1, r1, r2=None, segs=16, mi=0, cap=True):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    r2 = r1 if r2 is None else r2
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    m = T(*((p0 + p1) / 2)) @ q.to_matrix().to_4x4()
    vs = bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=segs,
                               radius1=r1, radius2=r2, depth=d.length, matrix=m)['verts']
    return _mi(vs, mi)


def sphere(bm, center, r, u=12, v=8, mi=0, M=None, scale=(1, 1, 1)):
    m = T(*center) @ S(*scale)
    if M is not None:
        m = M @ m
    vs = bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r, matrix=m)['verts']
    return _mi(vs, mi)


def ico(bm, center, r, sub=1, mi=0, scale=(1, 1, 1)):
    m = T(*center) @ S(*scale)
    vs = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r, matrix=m)['verts']
    return _mi(vs, mi)


def lathe(bm, prof, segs=24, M=None, mi=0, cap_bottom=True, cap_top=True):
    """Surface of revolution around local Z. prof = [(r, z), ...] bottom -> top."""
    M = M or Matrix()
    angs = [TAU * i / segs for i in range(segs)]
    rings = []
    for r, z in prof:
        if r < 1e-6:
            rings.append([bm.verts.new(M @ Vector((0, 0, z)))])
        else:
            rings.append([bm.verts.new(M @ Vector((r * math.cos(a), r * math.sin(a), z))) for a in angs])
    faces = []
    for a, b in zip(rings[:-1], rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for i in range(segs):
                faces.append(bm.faces.new((a[0], b[(i + 1) % segs], b[i])))
        elif len(b) == 1:
            for i in range(segs):
                faces.append(bm.faces.new((a[i], a[(i + 1) % segs], b[0])))
        else:
            for i in range(segs):
                j = (i + 1) % segs
                faces.append(bm.faces.new((a[i], a[j], b[j], b[i])))
    if cap_bottom and len(rings[0]) > 1:
        faces.append(bm.faces.new(list(reversed(rings[0]))))
    if cap_top and len(rings[-1]) > 1:
        faces.append(bm.faces.new(rings[-1]))
    for f in faces:
        f.material_index = mi
    return faces


def lathe_uv(bm, prof, segs=24, M=None, mi=0, urep=1.0, vrep=1.0, a0=0.0, a1=TAU, cap_bottom=False,
             cap_top=False):
    """Surface of revolution with a proper cylindrical UV layout (seam column duplicated).
    prof = [(r, z), ...] bottom -> top. a0..a1 limits the sweep (partial lathe for drapes)."""
    M = M or Matrix()
    uvl = bm.loops.layers.uv.verify()
    zs = [p[1] for p in prof]
    zmin, zmax = min(zs), max(zs)
    grid_v = []
    for r, z in prof:
        grid_v.append([bm.verts.new(M @ Vector((max(r, 1e-4) * math.cos(a0 + (a1 - a0) * i / segs),
                                                max(r, 1e-4) * math.sin(a0 + (a1 - a0) * i / segs), z)))
                       for i in range(segs + 1)])
    faces = []
    for j in range(len(prof) - 1):
        vj = (prof[j][1] - zmin) / max(zmax - zmin, 1e-6) * vrep
        vk = (prof[j + 1][1] - zmin) / max(zmax - zmin, 1e-6) * vrep
        for i in range(segs):
            vs = (grid_v[j][i], grid_v[j][i + 1], grid_v[j + 1][i + 1], grid_v[j + 1][i])
            f = bm.faces.new(vs)
            f.material_index = mi
            uvs = ((i / segs * urep, vj), ((i + 1) / segs * urep, vj),
                   ((i + 1) / segs * urep, vk), (i / segs * urep, vk))
            for l, uv in zip(f.loops, uvs):
                l[uvl].uv = uv
            faces.append(f)
    if cap_bottom:
        f = bm.faces.new(list(reversed(grid_v[0][:segs])))
        f.material_index = mi
    if cap_top:
        f = bm.faces.new(grid_v[-1][:segs])
        f.material_index = mi
    return faces


def torus_arc(bm, M, R, r, a0, a1, segs=12, rsegs=6, mi=0):
    """Open torus segment (used for smiles, ribbons)."""
    rings = []
    for i in range(segs + 1):
        a = a0 + (a1 - a0) * i / segs
        ca, sa = math.cos(a), math.sin(a)
        ring = []
        for j in range(rsegs):
            b = TAU * j / rsegs
            rr = R + r * math.cos(b)
            ring.append(bm.verts.new(M @ Vector((rr * ca, rr * sa, r * math.sin(b)))))
        rings.append(ring)
    for i in range(segs):
        a, b = rings[i], rings[i + 1]
        for j in range(rsegs):
            k = (j + 1) % rsegs
            f = bm.faces.new((a[j], b[j], b[k], a[k]))
            f.material_index = mi


# --------------------------------------------------------------------------
# colliders for the web character controller (written as JSON, three.js space)
# --------------------------------------------------------------------------
COLLIDERS = []


def col_box(x0, x1, y0, y1, h, **extra):
    """Axis aligned obstacle given in Blender XY. h = height (players can jump over low ones)."""
    COLLIDERS.append(dict(t="b", x0=round(min(x0, x1), 3), x1=round(max(x0, x1), 3),
                          z0=round(min(-y0, -y1), 3), z1=round(max(-y0, -y1), 3), h=round(h, 3), **extra))


def col_circle(x, y, r, h, **extra):
    COLLIDERS.append(dict(t="c", x=round(x, 3), z=round(-y, 3), r=round(r, 3), h=round(h, 3), **extra))


def col_ramp(x0, x1, y_low, y_high, h_low, h_high):
    """Walkable slope: height h_low at Blender y_low rising to h_high at y_high."""
    COLLIDERS.append(dict(t="r", x0=round(min(x0, x1), 3), x1=round(max(x0, x1), 3),
                          za=round(-y_low, 3), zb=round(-y_high, 3), ha=h_low, hb=h_high))


def export_colliders(name, **meta):
    import json
    path = os.path.join(WEB_MODELS, name + "_colliders.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(dict(colliders=COLLIDERS, **meta), f, ensure_ascii=False, separators=(",", ":"))
    print("colliders", path, len(COLLIDERS))


def prism(bm, pts, depth, M=None, mi=0):
    """Extrude a CCW 2D profile (u -> X, v -> Z) along Y, centred on y=0."""
    M = M or Matrix()
    d = depth / 2
    front = [bm.verts.new(M @ Vector((u, -d, v))) for u, v in pts]
    back = [bm.verts.new(M @ Vector((u, d, v))) for u, v in pts]
    fs = [bm.faces.new(front), bm.faces.new(list(reversed(back)))]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        fs.append(bm.faces.new((front[i], back[i], back[j], front[j])))
    for f in fs:
        f.material_index = mi
    return fs


def arch_pts(w, spring, kind='pointed', k=0.3, segs=14, bottom=0.0):
    """Arch opening profile (CCW). Pointed = two arcs whose centres are k*w/2 apart."""
    hw = w / 2
    pts = [(-hw, bottom), (hw, bottom), (hw, spring)]
    if kind == 'round':
        for i in range(1, segs):
            a = math.pi * i / segs
            pts.append((hw * math.cos(a), spring + hw * math.sin(a)))
    else:
        c = hw * k
        R = hw + c
        a1 = math.acos(c / R)
        for i in range(1, segs + 1):
            a = a1 * i / segs
            pts.append((-c + R * math.cos(a), spring + R * math.sin(a)))
        for i in range(segs - 1, 0, -1):
            a = a1 * i / segs
            pts.append((c - R * math.cos(a), spring + R * math.sin(a)))
    pts.append((-hw, spring))
    return pts


def arch_apex(w, spring, kind='pointed', k=0.3):
    hw = w / 2
    if kind == 'round':
        return spring + hw
    c = hw * k
    R = hw + c
    return spring + math.sqrt(R * R - c * c)


def arch_top_at(x, w, spring, k=0.3):
    """Height of a pointed arch intrados at horizontal offset x from its centre."""
    hw = w / 2
    c = hw * k
    R = hw + c
    cx = c if x <= 0 else -c
    return spring + math.sqrt(max(R * R - (x - cx) ** 2, 0.0))


def merlon(bm, M, w=0.7, d=0.45, h=0.6, tip=0.42, mi=0):
    """Omani style crenellation: block with a pyramidal point."""
    hw, hd = w / 2, d / 2

    def P(x, y, z):
        return bm.verts.new(M @ Vector((x, y, z)))
    b = [P(-hw, -hd, 0), P(hw, -hd, 0), P(hw, hd, 0), P(-hw, hd, 0)]
    t = [P(-hw, -hd, h), P(hw, -hd, h), P(hw, hd, h), P(-hw, hd, h)]
    a = P(0, 0, h + tip)
    fs = [bm.faces.new((b[3], b[2], b[1], b[0]))]
    for i in range(4):
        j = (i + 1) % 4
        fs.append(bm.faces.new((b[i], b[j], t[j], t[i])))
        fs.append(bm.faces.new((t[i], t[j], a)))
    for f in fs:
        f.material_index = mi


def crenels_line(bm, p0, p1, z, spacing=1.15, mi=0, **kw):
    p0, p1 = Vector((p0[0], p0[1])), Vector((p1[0], p1[1]))
    v = p1 - p0
    L = v.length
    n = max(1, int(round(L / spacing)))
    ang = math.atan2(v.y, v.x)
    for i in range(n):
        p = p0 + v * ((i + 0.5) / n)
        merlon(bm, T(p.x, p.y, z) @ Rz(ang), mi=mi, **kw)


def crenels_ring(bm, cx, cy, r, z, count, mi=0, phase=0.0, **kw):
    for i in range(count):
        a = TAU * (i + phase) / count
        merlon(bm, T(cx + r * math.cos(a), cy + r * math.sin(a), z) @ Rz(a + math.pi / 2), mi=mi, **kw)


def crenels_rect(bm, x0, x1, y0, y1, z, spacing=1.15, mi=0, **kw):
    crenels_line(bm, (x0, y0), (x1, y0), z, spacing, mi, **kw)
    crenels_line(bm, (x1, y0), (x1, y1), z, spacing, mi, **kw)
    crenels_line(bm, (x1, y1), (x0, y1), z, spacing, mi, **kw)
    crenels_line(bm, (x0, y1), (x0, y0), z, spacing, mi, **kw)


def tube(bm, x, y, z0, h, r_out, r_in, segs=48, mi=0, r_out_top=None, r_in_top=None):
    rot = r_out if r_out_top is None else r_out_top
    rit = r_in if r_in_top is None else r_in_top
    angs = [TAU * i / segs for i in range(segs)]

    def ring(r, z):
        return [bm.verts.new((x + r * math.cos(a), y + r * math.sin(a), z)) for a in angs]
    ob, ot = ring(r_out, z0), ring(rot, z0 + h)
    ib, it = ring(r_in, z0), ring(rit, z0 + h)
    fs = []
    for i in range(segs):
        j = (i + 1) % segs
        fs.append(bm.faces.new((ob[i], ob[j], ot[j], ot[i])))
        fs.append(bm.faces.new((ib[j], ib[i], it[i], it[j])))
        fs.append(bm.faces.new((ot[i], ot[j], it[j], it[i])))
        fs.append(bm.faces.new((ob[j], ob[i], ib[i], ib[j])))
    for f in fs:
        f.material_index = mi


def rect_frame(bm, x0, x1, y0, y1, z0, h, t, mi=0):
    """Four walls of thickness t along the inside of a rectangle (parapets)."""
    box_mm(bm, x0, x1, y0, y0 + t, z0, z0 + h, mi)
    box_mm(bm, x0, x1, y1 - t, y1, z0, z0 + h, mi)
    box_mm(bm, x0, x0 + t, y0 + t, y1 - t, z0, z0 + h, mi)
    box_mm(bm, x1 - t, x1, y0 + t, y1 - t, z0, z0 + h, mi)


def torus(bm, M, R, r, segs=24, rsegs=8, mi=0):
    rings = []
    for i in range(segs):
        a = TAU * i / segs
        ca, sa = math.cos(a), math.sin(a)
        ring = []
        for j in range(rsegs):
            b = TAU * j / rsegs
            rr = R + r * math.cos(b)
            ring.append(bm.verts.new(M @ Vector((rr * ca, rr * sa, r * math.sin(b)))))
        rings.append(ring)
    for i in range(segs):
        a, b = rings[i], rings[(i + 1) % segs]
        for j in range(rsegs):
            k = (j + 1) % rsegs
            f = bm.faces.new((a[j], b[j], b[k], a[k]))
            f.material_index = mi


def quad(bm, p0, p1, p2, p3, mi=0):
    f = bm.faces.new([bm.verts.new(p) for p in (p0, p1, p2, p3)])
    f.material_index = mi
    return f


# --------------------------------------------------------------------------
# modifiers / mesh processing
# --------------------------------------------------------------------------
def apply_mods(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    name = old.name
    if old.users == 0:
        bpy.data.meshes.remove(old)
    me.name = name


def bevel(ob, width=0.05, segs=2, angle=40):
    m = ob.modifiers.new("bevel", 'BEVEL')
    m.width = width
    m.segments = segs
    m.limit_method = 'ANGLE'
    m.angle_limit = rad(angle)
    m.use_clamp_overlap = True
    apply_mods(ob)


def boolean(target, cutters, op='DIFFERENCE'):
    """Boolean `target` with a list of cutter objects (removed afterwards)."""
    coll = bpy.data.collections.new("_cutters")
    bpy.context.scene.collection.children.link(coll)
    for c in cutters:
        for uc in list(c.users_collection):
            uc.objects.unlink(c)
        coll.objects.link(c)
    backup = target.data.copy()
    before = len(target.data.polygons)
    for solver in ('MANIFOLD', 'EXACT'):
        m = target.modifiers.new("bool", 'BOOLEAN')
        m.operation = op
        m.operand_type = 'COLLECTION'
        m.collection = coll
        m.solver = solver
        apply_mods(target)
        if len(target.data.polygons) >= max(4, before // 4):
            break
        print(f"[boolean] {solver} failed on {target.name}, retrying")
        bad = target.data
        target.data = backup.copy()
        bpy.data.meshes.remove(bad)
    bpy.data.meshes.remove(backup)
    for c in list(coll.objects):
        me = c.data
        bpy.data.objects.remove(c)
        if me and me.users == 0:
            bpy.data.meshes.remove(me)
    bpy.data.collections.remove(coll)


def cutter(name, build):
    bm = bmesh.new()
    build(bm)
    return mesh_obj(name, bm)


def finalize(ob, angle=35, recalc=True, merge=True):
    """Merge, fix normals and set smooth/sharp edges by angle (export friendly)."""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    if merge:
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    if recalc:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    lim = rad(angle)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2:
            e.smooth = e.calc_face_angle(math.pi) < lim
        else:
            e.smooth = False
    bm.to_mesh(me)
    bm.free()


def flat(ob):
    for p in ob.data.polygons:
        p.use_smooth = False


# --------------------------------------------------------------------------
# UVs
# --------------------------------------------------------------------------
def uv_box(ob, tile=2.0, offset=(0.0, 0.0)):
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.verify()
    mw = ob.matrix_world
    rot = mw.to_3x3()
    ox, oy = offset
    for f in bm.faces:
        n = rot @ f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            co = mw @ l.vert.co
            if ax == 0:
                u, v = (co.y if n.x > 0 else -co.y), co.z
            elif ax == 1:
                u, v = (-co.x if n.y > 0 else co.x), co.z
            else:
                u, v = co.x, (co.y if n.z > 0 else -co.y)
            l[uvl].uv = (u / tile + ox, v / tile + oy)
    bm.to_mesh(me)
    bm.free()


def uv_cyl(ob, cx, cy, tile=2.0, offset=(0.0, 0.0)):
    """Cylindrical mapping for walls of round towers, planar for caps."""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.verify()
    ox, oy = offset
    for f in bm.faces:
        n = f.normal
        if abs(n.z) > 0.7:
            for l in f.loops:
                co = l.vert.co
                l[uvl].uv = (co.x / tile + ox, co.y / tile + oy)
            continue
        c = f.calc_center_median()
        ac = math.atan2(c.y - cy, c.x - cx)
        for l in f.loops:
            co = l.vert.co
            a = math.atan2(co.y - cy, co.x - cx)
            da = (a - ac + math.pi) % TAU - math.pi
            r = math.hypot(co.x - cx, co.y - cy)
            r = max(r, 0.5)
            l[uvl].uv = (((ac + da) * r) / tile + ox, co.z / tile + oy)
    bm.to_mesh(me)
    bm.free()


def uv_fit(ob, axis_u=0, axis_v=2, flip_u=False):
    """Map the bounding box of the mesh to 0..1 on two axes (screens, carpets)."""
    me = ob.data
    xs = [v.co for v in me.vertices]
    umin = min(c[axis_u] for c in xs)
    umax = max(c[axis_u] for c in xs)
    vmin = min(c[axis_v] for c in xs)
    vmax = max(c[axis_v] for c in xs)
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops:
            co = l.vert.co
            u = (co[axis_u] - umin) / max(umax - umin, 1e-6)
            if flip_u:
                u = 1 - u
            l[uvl].uv = (u, (co[axis_v] - vmin) / max(vmax - vmin, 1e-6))
    bm.to_mesh(me)
    bm.free()


# --------------------------------------------------------------------------
# joining
# --------------------------------------------------------------------------
def join(objs, name):
    """Join objects (identity or not) into one mesh, keeping material slots."""
    bpy.context.view_layer.update()
    bm = bmesh.new()
    mats = []
    for ob in objs:
        me = ob.data.copy()
        me.transform(ob.matrix_world)
        # remap material indices into the shared slot list
        remap = []
        for m in me.materials:
            if m not in mats:
                mats.append(m)
            remap.append(mats.index(m))
        for p in me.polygons:
            p.material_index = remap[p.material_index] if remap else 0
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    for ob in objs:
        me = ob.data
        bpy.data.objects.remove(ob)
        if me.users == 0:
            bpy.data.meshes.remove(me)
    return mesh_obj(name, bm, mats)


def join_by_material(objs, prefix):
    groups = {}
    for ob in objs:
        key = ob.data.materials[0].name if ob.data.materials else "none"
        groups.setdefault(key, []).append(ob)
    out = []
    for key, obs in groups.items():
        out.append(join(obs, f"{prefix}_{key.replace('M_', '')}"))
    return out


# --------------------------------------------------------------------------
# materials
# --------------------------------------------------------------------------
_COLORSPACE = {}


def _set_colorspace(img, data):
    if not data:
        return
    for cs in ('Non-Color', 'Generic Data', 'Raw', 'Linear'):
        try:
            img.colorspace_settings.name = cs
            return
        except TypeError:
            continue


def load_img(name, data=False):
    path = os.path.join(TEX_DIR, name + ".png")
    img = bpy.data.images.load(path, check_existing=True)
    _set_colorspace(img, data)
    return img


def _bsdf(mat):
    nt = mat.node_tree
    for n in nt.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            return nt, n
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(b.outputs[0], out.inputs[0])
    return nt, b


def material(name, color=(0.8, 0.8, 0.8), rough=0.7, metal=0.0, albedo=None, normal=None,
             rmap=None, normal_strength=1.0, emission=None, emission_strength=0.0,
             double_sided=False):
    """PBR material that survives the glTF exporter unchanged."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt, b = _bsdf(mat)
    b.inputs['Base Color'].default_value = (*srgb_to_lin(color), 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    x = -500
    if albedo:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = load_img(albedo)
        t.location = (x, 300)
        nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if rmap:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = load_img(rmap, data=True)
        t.location = (x, 0)
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        sep.location = (x + 250, 0)
        nt.links.new(t.outputs['Color'], sep.inputs[0])
        nt.links.new(sep.outputs[1], b.inputs['Roughness'])
        nt.links.new(sep.outputs[2], b.inputs['Metallic'])
    if normal:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = load_img(normal, data=True)
        t.location = (x, -300)
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.location = (x + 250, -300)
        nm.inputs['Strength'].default_value = normal_strength
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    if emission is not None:
        b.inputs['Emission Color'].default_value = (*srgb_to_lin(emission), 1.0)
        b.inputs['Emission Strength'].default_value = emission_strength
    mat.use_backface_culling = not double_sided
    mat.diffuse_color = (*srgb_to_lin(color), 1.0)
    return mat


def srgb_to_lin(c):
    def f(x):
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return tuple(f(x) for x in c[:3])


# --------------------------------------------------------------------------
# lighting / camera / export
# --------------------------------------------------------------------------
def look_rot(direction):
    return Vector(direction).to_track_quat('-Z', 'Y').to_euler()


def add_sun(direction_to_sun, strength=4.0, color=(1.0, 0.86, 0.68), angle=1.5):
    d = Vector(direction_to_sun).normalized()
    ld = bpy.data.lights.new("Sun", 'SUN')
    ld.energy = strength
    ld.color = color
    ld.angle = rad(angle)
    ob = bpy.data.objects.new("Sun", ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.rotation_euler = look_rot(-d)
    return ob


def add_camera(loc, target, lens=35):
    cd = bpy.data.cameras.new("Camera")
    cd.lens = lens
    cd.clip_end = 3000
    ob = bpy.data.objects.new("Camera", cd)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = look_rot(Vector(target) - Vector(loc))
    bpy.context.scene.camera = ob
    return ob


def setup_world(zenith=(0.32, 0.52, 0.78), horizon=(0.98, 0.82, 0.62), strength=1.0):
    w = bpy.data.worlds.new("Sky")
    bpy.context.scene.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = strength
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (*srgb_to_lin(horizon), 1)
    ramp.color_ramp.elements[1].position = 0.45
    ramp.color_ramp.elements[1].color = (*srgb_to_lin(zenith), 1)
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs[0], out.inputs[0])
    return w


def setup_render(res=(1280, 720), samples=32, engine='BLENDER_EEVEE'):
    sc = bpy.context.scene
    sc.render.engine = engine
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    try:
        sc.eevee.taa_render_samples = samples
        sc.eevee.use_shadows = True
        sc.eevee.use_raytracing = True
    except Exception:
        pass
    try:
        sc.view_settings.view_transform = 'AgX'
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        try:
            sc.view_settings.view_transform = 'Filmic'
        except Exception:
            pass


def render_still(path):
    sc = bpy.context.scene
    sc.render.image_settings.media_type = 'IMAGE'
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.quality = 90
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def pack_and_save(name):
    for img in bpy.data.images:
        if img.source == 'FILE' and not img.packed_file:
            try:
                img.pack()
            except Exception as e:
                print("pack failed", img.name, e)
    path = os.path.join(BLEND_DIR, name + ".blend")
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
    print("saved", path)


def export_glb(name, exclude_types=('CAMERA', 'LIGHT')):
    # hide helper objects (camera / lights) from the export
    for ob in bpy.data.objects:
        ob.hide_render = False
    sel_ok = []
    for ob in bpy.context.scene.objects:
        if ob.type not in exclude_types:
            sel_ok.append(ob)
    for ob in bpy.context.scene.objects:
        ob.select_set(ob in sel_ok)
    path = os.path.join(WEB_MODELS, name + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_image_format='WEBP',
        export_image_quality=82,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_animations=False,
        export_vertex_color='NONE',
    )
    print("exported", path, round(os.path.getsize(path) / 1e6, 2), "MB")
