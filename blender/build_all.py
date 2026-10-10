"""Rebuild every asset:  blender -b --factory-startup -P build_all.py  [-- --video] [--textures]

textures -> palm -> Maryam -> Oman Gate -> Nizwa Fort -> interior -> challenge court -> plaza -> 5 stations
(GLB + colliders to web/public/models, .blend to blender/blend, previews to blender/renders)
With --video it also renders the placeholder film + hero stills (render_video.py)."""
import os
import sys
import runpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

flags = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
sys.argv = sys.argv[:1]  # the build scripts read their own "--" arguments (e.g. build_stations.py station ids)

import textures
textures.build_all(force="--textures" in flags)
for script in ("build_palm.py", "build_girl.py", "build_gate.py", "build_fort.py", "build_interior.py",
               "build_quiz.py", "build_plaza.py", "build_stations.py"):
    print("=" * 20, script)
    runpy.run_path(os.path.join(HERE, script), run_name="__main__")
if "--video" in flags:
    runpy.run_path(os.path.join(HERE, "render_video.py"), run_name="__main__")
print("ALL DONE")
