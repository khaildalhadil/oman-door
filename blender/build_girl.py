"""مريم - a stylised Omani girl in traditional dress (embroidered kandoora, sirwal with
embroidered ankle cuffs and a printed lihaf head scarf).

The character is a hierarchy of rigid parts whose origins sit at the joints, so the web app
can animate her procedurally (walk / run / jump / cheer) by rotating named nodes:
Girl > Hips > (Skirt, LegL, LegR, Spine > (Head > (EyeL, EyeR), ScarfTail, ArmL > ForearmL, ArmR > ForearmR))
Blender: Z up, she faces -Y. three.js: Y up, she faces +Z.
"""
import sys
import os
import math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy
import bmesh
from mathutils import Vector
import lib
import textures
from lib import TAU, rad

FRONT = -math.pi / 2          # lathe angle that points to the face (-Y)


def mats():
    M = {}
    M['skin'] = lib.material("G_Skin", (0.88, 0.69, 0.55), 0.55)
    M['face'] = lib.material("G_Face", (1, 1, 1), 0.5, albedo="face_open")
    M['dress'] = lib.material("G_Dress", (0.06, 0.48, 0.35), 0.8, albedo="dress_a", normal="dress_n",
                              normal_strength=0.6, double_sided=True)
    M['emb'] = lib.material("G_Embroidery", (0.9, 0.7, 0.3), 0.45, metal=0.35, albedo="embroid_a",
                            normal="embroid_n", normal_strength=0.8, double_sided=True)
    M['sirwal'] = lib.material("G_Sirwal", (0.45, 0.06, 0.12), 0.75)
    M['scarf'] = lib.material("G_Scarf", (0.75, 0.1, 0.25), 0.7, albedo="scarf_a", double_sided=True)
    M['gold'] = lib.material("G_Gold", (0.95, 0.75, 0.35), 0.3, metal=1.0)
    M['silver'] = lib.material("G_Silver", (0.85, 0.85, 0.88), 0.25, metal=1.0)
    M['eye'] = lib.material("G_Eye", (0.08, 0.05, 0.04), 0.15)
    M['eyehi'] = lib.material("G_EyeHi", (1, 1, 1), 0.2, emission=(1, 1, 1), emission_strength=1.5)
    M['hair'] = lib.material("G_Hair", (0.12, 0.07, 0.05), 0.5)
    M['blush'] = lib.material("G_Blush", (0.92, 0.55, 0.52), 0.6)
    M['lips'] = lib.material("G_Lips", (0.70, 0.28, 0.32), 0.45)
    M['shoe'] = lib.material("G_Shoe", (0.55, 0.12, 0.10), 0.5)
    return M


def strip(bm, pts, w, mi, uscale=4.5):
    """Embroidered ribbon along a centreline (pts bottom -> top), width along X."""
    uvl = bm.loops.layers.uv.verify()
    L = 0.0
    X = Vector((w, 0, 0))
    for k in range(len(pts) - 1):
        p0, p1 = Vector(pts[k]), Vector(pts[k + 1])
        seg = (p1 - p0).length
        f = bm.faces.new([bm.verts.new(p) for p in (p0 - X, p0 + X, p1 + X, p1 - X)])
        f.material_index = mi
        for l, uv in zip(f.loops, ((L * uscale, 0), (L * uscale, 1), ((L + seg) * uscale, 1), ((L + seg) * uscale, 0))):
            l[uvl].uv = uv
        L += seg


def node(name, parent, loc, bm=None, mats=()):
    """Create a joint: an empty (no mesh) or a mesh whose origin is the joint."""
    if bm is None:
        ob = bpy.data.objects.new(name, None)
        ob.empty_display_size = 0.05
        lib.link(ob)
    else:
        ob = lib.mesh_obj(name, bm, list(mats))
    if parent is not None:
        ob.parent = parent
    ob.location = loc
    return ob


def build():
    lib.reset()
    lib.use_collection("Maryam")
    M = mats()

    root = node("Girl", None, (0, 0, 0))
    hips = node("Hips", root, (0, 0, 0.70))

    # ---------------------------------------------------------------- skirt
    bm = bmesh.new()
    prof = [(0.265, -0.53), (0.25, -0.45), (0.215, -0.30), (0.175, -0.14), (0.15, -0.03), (0.138, 0.03)]
    lib.lathe_uv(bm, prof, segs=36, M=lib.T(0, 0, 0), mi=0, urep=2.0, vrep=1.5)
    hem = [(0.272, -0.53), (0.268, -0.47)]
    lib.lathe_uv(bm, hem, segs=36, mi=1, urep=6.0, vrep=1.0)
    lib.lathe_uv(bm, [(0.272, -0.53), (0.262, -0.531)], segs=36, mi=1, urep=6.0)
    # embroidered front panel down the skirt
    strip(bm, [(0, -(r + 0.004), z) for (r, z) in prof], 0.034, 1)
    skirt = node("Skirt", hips, (0, 0, 0), bm, [M['dress'], M['emb']])
    lib.finalize(skirt, 60, recalc=False)

    # ----------------------------------------------------------------- legs
    for side, name in ((1, "LegL"), (-1, "LegR")):
        bm = bmesh.new()
        lib.lathe_uv(bm, [(0.05, -0.47), (0.056, -0.30), (0.062, -0.1), (0.06, 0.0)], segs=14, mi=0)
        lib.lathe_uv(bm, [(0.06, -0.62), (0.063, -0.55), (0.06, -0.47)], segs=14, mi=1, urep=2.0)
        lib.sphere(bm, (0, -0.035, -0.645), 0.05, 12, 8, mi=2, scale=(1.0, 1.9, 0.75))
        lib.torus(bm, lib.T(0, 0, -0.565), 0.064, 0.007, 16, 5, mi=3)
        leg = node(name, hips, (side * 0.075, 0, -0.02), bm, [M['sirwal'], M['emb'], M['shoe'], M['gold']])
        lib.finalize(leg, 50, recalc=False)

    # ---------------------------------------------------------------- torso
    bm = bmesh.new()
    S = lib.S(1.0, 0.8, 1.0)
    tprof = [(0.135, 0.0), (0.142, 0.06), (0.15, 0.15), (0.145, 0.22), (0.125, 0.28), (0.08, 0.315), (0.045, 0.33)]
    lib.lathe_uv(bm, tprof, segs=36, M=S, mi=0, urep=2.0, vrep=0.6)
    lib.lathe_uv(bm, [(0.14, 0.0), (0.145, 0.045)], segs=36, M=S, mi=1, urep=6.0)
    # yoke / neckline embroidery
    lib.lathe_uv(bm, [(0.128, 0.27), (0.085, 0.31), (0.06, 0.322)], segs=36, M=S, mi=1, urep=6.0)
    # front placket
    strip(bm, [(0, -(r * 0.8 + 0.004), z) for (r, z) in tprof[:-2]], 0.03, 1)
    # silver necklace with a pendant
    lib.torus(bm, lib.T(0, -0.006, 0.305) @ lib.S(1, 0.85, 1) @ lib.Rx(rad(-12)), 0.072, 0.0045, 32, 4, mi=2)
    lib.sphere(bm, (0, -0.09, 0.27), 0.012, 10, 6, mi=2, scale=(1, 0.5, 1.3))
    spine = node("Spine", hips, (0, 0, 0), bm, [M['dress'], M['emb'], M['silver']])
    lib.finalize(spine, 60, recalc=False)

    # ----------------------------------------------------------------- head
    bm = bmesh.new()
    C = Vector((0, 0, 0.17))
    lib.cyl(bm, 0, 0, -0.01, 0.07, 0.042, 0.04, segs=12, mi=1)               # neck
    lib.sphere(bm, C + Vector((0, -0.131, -0.024)), 0.009, 10, 6, mi=1, scale=(1, 0.8, 1.1))  # tiny nose
    # head: unit sphere with a lon/lat UV layout (front = -Y) so the painted face lands correctly
    hb = bmesh.new()
    bmesh.ops.create_uvsphere(hb, u_segments=64, v_segments=40, radius=1.0)
    huv = hb.loops.layers.uv.verify()
    for f in hb.faces:
        c = f.calc_center_median()
        lc = math.atan2(c.x, -c.y)
        for l in f.loops:
            p = l.vert.co
            lon = math.atan2(p.x, -p.y)
            if abs(p.x) < 1e-6 and abs(p.y) < 1e-6:
                lon = lc
            lon = lc + (lon - lc + math.pi) % TAU - math.pi
            lat = math.asin(max(-1.0, min(1.0, p.z)))
            l[huv].uv = (lon / TAU + 0.5, lat / math.pi + 0.5)
    bmesh.ops.transform(hb, matrix=lib.T(*C) @ lib.S(0.135, 0.13, 0.14), verts=hb.verts)
    me_tmp = bpy.data.meshes.new("tmp_head")
    hb.to_mesh(me_tmp)
    hb.free()
    bm.from_mesh(me_tmp)
    bpy.data.meshes.remove(me_tmp)
    # scarf hood with a face opening
    hood = bmesh.new()
    bmesh.ops.create_uvsphere(hood, u_segments=40, v_segments=26, radius=0.153,
                              matrix=lib.T(*(C + Vector((0, 0.014, 0.012)))) @ lib.S(1.06, 1.1, 1.1))
    kill = []
    for f in hood.faces:
        c = f.calc_center_median() - C
        if c.y < -0.02 and (c.x / 0.11) ** 2 + ((c.z + 0.012) / 0.099) ** 2 < 1.0:
            kill.append(f)
    bmesh.ops.delete(hood, geom=kill, context='FACES')
    # wrap the scarf under the chin: taper the lower half and pull it towards the neck
    for v in hood.verts:
        rel = v.co - C
        t = max(0.0, min(1.0, (-rel.z - 0.02) / 0.13))
        v.co.x = C.x + rel.x * (1 - 0.28 * t)
        if rel.y < 0:
            v.co.y = C.y + rel.y * (1 - 0.18 * t)
        # a softer, slightly peaked crown
        u = max(0.0, (rel.z - 0.09) / 0.07)
        v.co.z += 0.012 * u * max(0.0, rel.y + 0.05) / 0.2
    huv = hood.loops.layers.uv.verify()
    for f in hood.faces:
        for l in f.loops:
            p = l.vert.co - C
            l[huv].uv = (math.atan2(p.y, p.x) / TAU * 3, p.z * 4)
    for f in hood.faces:
        f.material_index = 2
    me_tmp = bpy.data.meshes.new("tmp")
    hood.to_mesh(me_tmp)
    hood.free()
    bm.from_mesh(me_tmp)
    bpy.data.meshes.remove(me_tmp)
    # gold trim around the face opening
    lib.torus(bm, lib.T(0, -0.122, C.z - 0.012) @ lib.Rx(math.pi / 2) @ lib.S(1.05, 0.93, 1.0),
              0.105, 0.0055, 40, 6, mi=3)
    head = node("Head", spine, (0, 0, 0.31), bm, [M['face'], M['skin'], M['scarf'], M['gold']])
    lib.finalize(head, 50, recalc=False)

    # ------------------------------------------------------- scarf drape (back)
    bm = bmesh.new()
    dprof = [(0.24, -0.33), (0.215, -0.22), (0.18, -0.08), (0.15, 0.0), (0.11, 0.05)]
    lib.lathe_uv(bm, dprof, segs=24, mi=0, a0=rad(-25), a1=rad(205), urep=2.0, vrep=1.6)
    lib.lathe_uv(bm, [(0.245, -0.345), (0.24, -0.33)], segs=24, mi=1, a0=rad(-25), a1=rad(205), urep=5.0)
    tail = node("ScarfTail", spine, (0, 0.0, 0.30), bm, [M['scarf'], M['gold']])
    lib.finalize(tail, 60, recalc=False)
    # shoulder wrap (static part of the scarf)
    bm = bmesh.new()
    lib.lathe_uv(bm, [(0.16, 0.24), (0.14, 0.29), (0.095, 0.33), (0.06, 0.35)], segs=30, M=lib.S(1.0, 0.85, 1.0),
                 mi=0, a0=rad(-30), a1=rad(210), urep=2.0)
    wrap = node("ScarfWrap", spine, (0, 0, 0), bm, [M['scarf']])
    lib.finalize(wrap, 60, recalc=False)

    # ----------------------------------------------------------------- arms
    for side, sname in ((1, "L"), (-1, "R")):
        bm = bmesh.new()
        lib.sphere(bm, (0, 0, 0), 0.05, 14, 10)
        lib.lathe_uv(bm, [(0.042, -0.21), (0.046, -0.1), (0.05, 0.0)], segs=16, mi=0, urep=1.0)
        arm = node("Arm" + sname, spine, (side * 0.15, 0, 0.255), bm, [M['dress']])
        lib.finalize(arm, 60, recalc=False)
        bm = bmesh.new()
        lib.lathe_uv(bm, [(0.068, -0.2), (0.055, -0.12), (0.044, 0.0)], segs=18, mi=0, urep=1.0)
        lib.lathe_uv(bm, [(0.07, -0.205), (0.066, -0.16)], segs=18, mi=1, urep=3.0)
        lib.sphere(bm, (0, 0, -0.235), 0.036, 12, 8, mi=2, scale=(0.85, 0.7, 1.15))
        lib.sphere(bm, (side * -0.024, -0.016, -0.228), 0.012, 8, 6, mi=2, scale=(1, 1, 1.6))
        lib.torus(bm, lib.T(0, 0, -0.212), 0.04, 0.005, 16, 5, mi=3)
        lib.torus(bm, lib.T(0, 0, -0.222), 0.038, 0.004, 16, 5, mi=3)
        fore = node("Forearm" + sname, arm, (0, 0, -0.21), bm, [M['dress'], M['emb'], M['skin'], M['gold']])
        lib.finalize(fore, 60, recalc=False)

    # rest pose: arms slightly away from the body
    bpy.data.objects["ArmL"].rotation_euler = (0, rad(-15), 0)
    bpy.data.objects["ArmR"].rotation_euler = (0, rad(15), 0)
    bpy.data.objects["ForearmL"].rotation_euler = (rad(-10), 0, 0)
    bpy.data.objects["ForearmR"].rotation_euler = (rad(-10), 0, 0)
    return root


if __name__ == "__main__":
    textures.build_all()
    build()
    lib.export_glb("girl")
    lib.setup_world()
    lib.add_sun((-0.5, -0.8, 0.6), 4.0)
    pl = bpy.data.lights.new("Fill", 'AREA')
    pl.energy = 60
    pl.size = 2
    o = bpy.data.objects.new("Fill", pl)
    bpy.context.scene.collection.objects.link(o)
    o.location = (1.5, -2.0, 1.5)
    o.rotation_euler = lib.look_rot(Vector((0, 0, 0.9)) - Vector(o.location))
    lib.add_camera((0.9, -2.6, 1.15), (0, 0, 0.78), 50)
    lib.setup_render((900, 1100), 48)
    lib.pack_and_save("girl")
    lib.render_still(os.path.join(lib.RENDER_DIR, "girl_34.jpg"))
    cam = bpy.context.scene.camera
    cam.location = (0, -1.25, 1.2)
    cam.rotation_euler = lib.look_rot(Vector((0, 0, 1.16)) - Vector(cam.location))
    lib.render_still(os.path.join(lib.RENDER_DIR, "girl_face.jpg"))
    # transparent portrait for the web intro screen
    sc = bpy.context.scene
    sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = 480, 600
    cam.data.lens = 50
    cam.location = (0.75, -2.7, 0.95)
    cam.rotation_euler = lib.look_rot(Vector((0, 0, 0.72)) - Vector(cam.location))
    sc.render.image_settings.media_type = 'IMAGE'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.filepath = os.path.join(lib.PROJECT, "web", "public", "images", "maryam.png")
    bpy.ops.render.render(write_still=True)
    sc.render.film_transparent = False
    sc.render.resolution_x, sc.render.resolution_y = 900, 1100
    cam.location = (-1.6, 2.2, 1.1)
    cam.rotation_euler = lib.look_rot(Vector((0, 0, 0.75)) - Vector(cam.location))
    lib.render_still(os.path.join(lib.RENDER_DIR, "girl_back.jpg"))
