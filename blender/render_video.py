"""Placeholder cinematic for the video screen inside the fort + hero stills for the web UI.
Renders with Eevee: camera glides towards Oman Gate while its doors swing open."""
import sys
import os
import glob
import shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy
from mathutils import Vector
import lib

FAST = "--fast" in sys.argv


def instance_palms():
    path = os.path.join(lib.BLEND_DIR, "palm.blend")
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n.startswith("Palm_")]
    protos = [o for o in dst.objects if o is not None]
    coll = bpy.data.collections.new("PalmInstances")
    bpy.context.scene.collection.children.link(coll)
    bpy.context.view_layer.update()
    for e in [o for o in bpy.data.objects if o.type == 'EMPTY' and o.name.startswith("Palm.")]:
        for p in protos:
            ob = bpy.data.objects.new(p.name + "_i", p.data)
            ob.matrix_world = e.matrix_world @ p.matrix_world
            coll.objects.link(ob)


def open_scene(name):
    bpy.ops.wm.open_mainfile(filepath=os.path.join(lib.BLEND_DIR, name + ".blend"))
    instance_palms()


def key_cam(cam, tgt, frame, loc, look):
    cam.location = loc
    tgt.location = look
    cam.keyframe_insert("location", frame=frame)
    tgt.keyframe_insert("location", frame=frame)


def gate_film():
    open_scene("oman_gate")
    sc = bpy.context.scene
    lib.setup_render((1280, 720), 12 if FAST else 32)
    cam = sc.camera
    cam.data.lens = 28
    tgt = bpy.data.objects.new("CamTarget", None)
    sc.collection.objects.link(tgt)
    c = cam.constraints.new('TRACK_TO')
    c.target = tgt
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'
    key_cam(cam, tgt, 1, (-24, -72, 2.6), (0, 0, 7.5))
    key_cam(cam, tgt, 70, (-7, -33, 4.2), (0, 0, 6.8))
    key_cam(cam, tgt, 140, (0, -10.5, 2.9), (0, 12, 3.6))
    key_cam(cam, tgt, 192, (0, 6.0, 2.4), (0, 40, 3.0))
    for name, sgn in (("DoorL", 1), ("DoorR", -1)):
        d = bpy.data.objects[name]
        d.rotation_euler.z = 0
        d.keyframe_insert("rotation_euler", frame=72)
        d.rotation_euler.z = sgn * lib.rad(84)
        d.keyframe_insert("rotation_euler", frame=138)
    sc.frame_start, sc.frame_end = 1, 192
    sc.render.fps = 24

    # poster frame
    sc.frame_set(64)
    lib.render_still(os.path.join(lib.WEB_VIDEO, "placeholder-poster.jpg"))

    tmp = os.path.join(lib.RENDER_DIR, "film_tmp")
    os.makedirs(tmp, exist_ok=True)
    for f in glob.glob(os.path.join(tmp, "*")):
        os.remove(f)
    r = sc.render
    r.image_settings.media_type = 'VIDEO'
    r.image_settings.file_format = 'FFMPEG'
    r.ffmpeg.format = 'MPEG4'
    r.ffmpeg.codec = 'H264'
    r.ffmpeg.constant_rate_factor = 'HIGH'
    r.ffmpeg.ffmpeg_preset = 'GOOD'
    r.ffmpeg.audio_codec = 'NONE'
    r.filepath = os.path.join(tmp, "film_")
    bpy.ops.render.render(animation=True)
    out = sorted(glob.glob(os.path.join(tmp, "*.mp4")))
    if out:
        dst = os.path.join(lib.WEB_VIDEO, "placeholder.mp4")
        shutil.copyfile(out[-1], dst)
        print("VIDEO", dst, round(os.path.getsize(dst) / 1e6, 2), "MB")
    else:
        print("VIDEO missing", os.listdir(tmp))


def hero_stills():
    img_dir = os.path.join(lib.PROJECT, "web", "public", "images")
    os.makedirs(img_dir, exist_ok=True)
    open_scene("oman_gate")
    sc = bpy.context.scene
    lib.setup_render((1920, 1080), 32)
    cam = sc.camera
    cam.data.lens = 30
    cam.location = (-6, -52, 3.0)
    cam.rotation_euler = lib.look_rot(Vector((0, 0, 9.0)) - Vector(cam.location))
    lib.render_still(os.path.join(img_dir, "hero-gate.jpg"))
    open_scene("nizwa_fort")
    sc = bpy.context.scene
    lib.setup_render((1920, 1080), 32)
    cam = sc.camera
    cam.location = (40, -95, 26)
    cam.rotation_euler = lib.look_rot(Vector((-12, 8, 10)) - Vector(cam.location))
    lib.render_still(os.path.join(img_dir, "hero-fort.jpg"))


if __name__ == "__main__":
    hero_stills()
    gate_film()
