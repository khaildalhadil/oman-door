"""Quick preview render of every prop (blender -b -P props_preview.py)."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh
import lib
import props
import textures
from lib import rad


def build():
    lib.reset()
    textures.build_all()
    m = {
        'hull': lib.material("P_Hull", (0.42, 0.26, 0.13), 0.6, albedo="wood_a", normal="wood_n"),
        'deck': lib.material("P_Deck", (0.6, 0.45, 0.3), 0.7, albedo="wood_a"),
        'sail': lib.material("P_Sail", (0.93, 0.89, 0.8), 0.9, double_sided=True),
        'rope': lib.material("P_Rope", (0.55, 0.45, 0.3), 0.9),
        'trim': lib.material("P_Trim", (0.85, 0.7, 0.35), 0.4, metal=0.6),
        'shell': lib.material("P_Shell", (0.3, 0.33, 0.18), 0.5),
        'skin': lib.material("P_Skin", (0.45, 0.45, 0.33), 0.6),
        'stone': lib.material("P_Stone", (0.85, 0.82, 0.74), 0.8, albedo="plaster_white_a"),
        'ivory': lib.material("P_Ivory", (0.95, 0.92, 0.82), 0.4),
        'robe': lib.material("P_Robe", (0.96, 0.96, 0.94), 0.7),
        'kumma': lib.material("P_Kumma", (0.9, 0.85, 0.75), 0.6, albedo="embroid_a"),
        'silver': lib.material("P_Silver", (0.85, 0.85, 0.88), 0.25, metal=1.0),
        'dress': lib.material("P_Dress", (0.5, 0.1, 0.4), 0.8, albedo="dress_a"),
        'emb': lib.material("P_Emb", (0.9, 0.7, 0.3), 0.5, albedo="embroid_a"),
        'scarf': lib.material("P_Scarf", (0.75, 0.1, 0.25), 0.7, albedo="scarf_a", double_sided=True),
        'clay': lib.material("P_Clay", (0.66, 0.36, 0.2), 0.8),
        'brass': lib.material("P_Brass", (0.86, 0.66, 0.34), 0.3, metal=1.0),
        'leaf': lib.material("P_Leaf", (0.35, 0.45, 0.2), 0.7),
        'bark': lib.material("P_Bark", (0.55, 0.48, 0.4), 0.9),
    }
    keys = list(m.keys())
    idx = {k: i for i, k in enumerate(keys)}
    bm = bmesh.new()
    props.dhow(bm, lib.T(-6, 4, 0.6), 6.0, {'hull': idx['hull'], 'deck': idx['deck'], 'sail': idx['sail'],
                                           'rope': idx['rope'], 'trim': idx['trim'], 'wood': idx['hull']})
    props.turtle(bm, lib.T(-2, -1, 0), 1.0, {'shell': idx['shell'], 'skin': idx['skin']})
    props.elephant(bm, lib.T(1.5, 3, 0), 1.6, {'body': idx['stone'], 'tusk': idx['ivory']})
    props.mannequin(bm, lib.T(4.5, 0, 0), 'man', {'robe': idx['robe'], 'skin': idx['bark'], 'kumma': idx['kumma'],
                                                  'silver': idx['silver'], 'stand': idx['hull']})
    props.mannequin(bm, lib.T(5.5, 0, 0), 'woman', {'robe': idx['dress'], 'skin': idx['bark'], 'emb': idx['emb'],
                                                    'sirwal': idx['hull'], 'scarf': idx['scarf'], 'stand': idx['hull']})
    props.mannequin(bm, lib.T(6.5, 0, 0), 'dhofar', {'robe': idx['dress'], 'skin': idx['bark'], 'emb': idx['emb'],
                                                     'scarf': idx['scarf'], 'stand': idx['hull']})
    props.column(bm, lib.T(-4, -3, 0), 3.5, 0.3, idx['stone'])
    props.column(bm, lib.T(-3, -3.5, 0), 3.5, 0.3, idx['stone'], broken=True)
    props.frankincense_tree(bm, lib.T(0, -3, 0), 1.0, idx['bark'], idx['leaf'])
    props.astrolabe(bm, lib.T(2, -2, 1.2), 0.5, idx['brass'])
    props.anchor(bm, lib.T(3, -3, 0), 0.8, idx['brass'])
    props.chest(bm, lib.T(0.5, 0, 0), mi_wood=idx['hull'], mi_brass=idx['brass'])
    props.sack(bm, lib.T(-0.6, 0.3, 0), 1.0, idx['bark'])
    props.amphora(bm, lib.T(-1, -2.5, 0), 1.0, idx['clay'])
    props.barrel(bm, lib.T(-0.5, -1.8, 0), 1.0, idx['hull'], idx['brass'])
    props.rope_coil(bm, lib.T(-1.5, -1.6, 0), 1.0, idx['rope'])
    ob = lib.mesh_obj("props", bm, [m[k] for k in keys])
    lib.finalize(ob, 40, recalc=False)
    lib.uv_box(ob, 1.0)
    bm = bmesh.new()
    lib.box_mm(bm, -12, 12, -8, 10, -0.1, 0)
    lib.mesh_obj("floor", bm, [lib.material("P_Floor", (0.8, 0.72, 0.6), 0.9)])


if __name__ == "__main__":
    build()
    lib.setup_world()
    lib.add_sun((-0.5, -0.8, 0.6), 4.0)
    lib.add_camera((0, -14, 6), (0, 1, 1.4), 30)
    lib.setup_render((1600, 900), 32)
    lib.render_still(os.path.join(lib.RENDER_DIR, "props.jpg"))
