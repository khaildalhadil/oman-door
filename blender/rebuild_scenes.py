import os, sys, runpy
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
for script in sys.argv[sys.argv.index("--") + 1:]:
    print("=" * 20, script)
    runpy.run_path(os.path.join(HERE, script), run_name="__main__")
print("ALL DONE")
