"""Build one shot of the epilogue film as a .blend, ready to render.

    blender -b -P tools/blender/build_epilogue.py -- 03-hall [--out art/blender/epilogue]

The shot's room is built by its own builder, restored and put in daylight by
epilogue/restore.py, and given its camera move from epilogue/shots.py. One
shot per Blender process, as build_room.py does it: builders share material
names, and a fresh process keeps each room's own.
"""
from __future__ import annotations

import argparse
import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(HERE, "rooms"), os.path.join(HERE, "epilogue")]

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import restore  # noqa: E402
import shots  # noqa: E402


def animate_camera(shot: dict, frames: int) -> None:
    scene = bpy.context.scene
    cam = scene.camera
    cam.data.lens = shots.LENS
    target = bpy.data.objects.new("look", None)
    scene.collection.objects.link(target)
    track = cam.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    for frame, at, look in ((1, shot["cam"], shot["look"]), (frames, shot["cam_to"], shot["look_to"])):
        cam.location = Vector(at)
        target.location = Vector(look)
        cam.keyframe_insert("location", frame=frame)
        target.keyframe_insert("location", frame=frame)


def configure(frames: int) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.resolution_x, scene.render.resolution_y = shots.SIZE
    scene.render.resolution_percentage = 100
    scene.render.fps = shots.FPS
    scene.frame_start, scene.frame_end = 1, frames
    scene.render.use_motion_blur = False
    scene.render.use_persistent_data = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.use_overwrite = False       # a rerun resumes where the last one stopped
    scene.render.use_placeholder = True
    scene.cycles.samples = shots.SAMPLES
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.03
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.sample_clamp_indirect = 6.0
    scene.cycles.seed = 7
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = 0.0


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("shot")
    ap.add_argument("--out", default=os.path.join(HERE, "..", "..", "art", "blender", "epilogue"))
    args = ap.parse_args(argv)

    shot = shots.by_id(args.shot)
    room = importlib.import_module(shot["room"])
    meta = room.build()
    for name in meta.get("hiddenByDefault", []):
        bpy.data.objects[name].hide_render = True
    restore.RESTORE[shot["room"]](room)
    frames = shots.frames()
    animate_camera(shot, frames)
    configure(frames)

    os.makedirs(args.out, exist_ok=True)
    path = os.path.abspath(os.path.join(args.out, shot["id"] + ".blend"))
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
    print(f"built shot {shot['id']} ({shot['room']}, {frames} frames) -> {path}")


main()
