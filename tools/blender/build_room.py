"""Build a remastered room from its Python builder and save it as a .blend.

    blender -b -P tools/blender/build_room.py -- hall [--out art/blender/rooms]

The builder's description (hotspots, variants, walk area, entry points) is
stored on the scene as JSON, so render_room.py needs only the .blend.
"""
from __future__ import annotations

import argparse
import importlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(HERE, "rooms")]

import bpy  # noqa: E402


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("room")
    ap.add_argument("--out", default=os.path.join(HERE, "..", "..", "art", "blender", "rooms"))
    args = ap.parse_args(argv)

    meta = importlib.import_module(args.room).build()
    scene = bpy.context.scene
    scene["morrow"] = json.dumps(meta)
    for name in meta.get("hiddenByDefault", []):
        bpy.data.objects[name].hide_render = True

    os.makedirs(args.out, exist_ok=True)
    path = os.path.abspath(os.path.join(args.out, args.room + ".blend"))
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
    print(f"built {args.room}: {len(bpy.data.objects)} objects -> {path}")


main()
