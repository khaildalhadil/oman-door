import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import textures
textures.build_all(force=True)
