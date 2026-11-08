"""Render the frames of one epilogue shot on the GPU box.

    blender -b art/blender/epilogue/03-hall.blend -P tools/blender/render_epilogue.py -- \
        --out out/epilogue/03-hall [--frames 72] [--samples 64]

Frames already on disk are skipped (the .blend asks Blender not to
overwrite, and to drop a placeholder before it starts each one), so a job
that stops part way through resumes when it is run again. `--frames` renders
only the frames named, for a preview of the look and the time a frame takes.
"""
from __future__ import annotations

import argparse
import os
import sys
import time

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from render_room import has_oidn, use_gpu  # noqa: E402

started = {}


def report_start(scene, *_):
    started["t"] = time.time()


def report_done(scene, *_):
    print(f"[morrow] frame {scene.frame_current} in {time.time() - started.get('t', time.time()):.1f}s", flush=True)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--frames", default="", help="comma-separated frames; default: the whole shot")
    ap.add_argument("--samples", type=int, default=0)
    args = ap.parse_args(argv)

    scene = bpy.context.scene
    device = use_gpu(scene)
    denoise = has_oidn(scene)
    if args.samples:
        scene.cycles.samples = args.samples
    os.makedirs(args.out, exist_ok=True)
    scene.render.filepath = os.path.join(os.path.abspath(args.out), "####")
    bpy.app.handlers.render_pre.append(report_start)
    bpy.app.handlers.render_post.append(report_done)
    print(f"[morrow] {os.path.basename(bpy.data.filepath)}: {device}, denoiser {'OIDN' if denoise else 'none'}, "
          f"{scene.cycles.samples} samples, frames {scene.frame_start}-{scene.frame_end}", flush=True)

    if args.frames:
        for f in (int(x) for x in args.frames.split(",")):
            scene.frame_set(f)
            scene.render.filepath = os.path.join(os.path.abspath(args.out), f"{f:04d}")
            bpy.ops.render.render(write_still=True)
    else:
        bpy.ops.render.render(animation=True)
    print(f"[morrow] wrote {args.out}", flush=True)


main()
