"""Build one trailer shot as a .blend, ready to render.

    blender -b -P tools/blender/build_trailer.py -- t03-hall [--out art/blender/trailer]

The room is its own builder's, at night as the game shows it; trailer/dress.py
adds the hero and the Umbra; the camera makes one move relative to the
room's own camera (trailer/shots.py). One shot per Blender process, as the
room and epilogue builders do it.
"""
from __future__ import annotations

import argparse
import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(HERE, "rooms"), os.path.join(HERE, "trailer")]

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import dress  # noqa: E402
import shots  # noqa: E402


def camera_move(shot: dict) -> None:
    scene = bpy.context.scene
    cam = scene.camera
    # From the rotation itself: matrix_world is stale until the scene next updates.
    basis = cam.rotation_euler.to_matrix()
    fwd, right = basis @ Vector((0, 0, -1)), basis @ Vector((1, 0, 0))
    at0 = cam.location.copy()
    at1 = at0 + fwd * shot.get("push", 0.0) + right * shot.get("drift", 0.0) + Vector((0, 0, shot.get("rise", 0.0)))
    look0 = at0 + fwd * 8.0
    look1 = look0 + right * shot.get("drift", 0.0) * 0.6 + Vector((0, 0, shot.get("rise", 0.0) * 0.5))
    target = bpy.data.objects.new("look", None)
    scene.collection.objects.link(target)
    track = cam.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    frames = shot["frames"]
    if frames == 1:
        cam.location, target.location = at1, look1
        return
    for frame, at, look in ((1, at0, look0), (frames, at1, look1)):
        cam.location, target.location = at, look
        cam.keyframe_insert("location", frame=frame)
        target.keyframe_insert("location", frame=frame)


def configure(shot: dict) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.resolution_x, scene.render.resolution_y = shot.get("size", shots.SIZE)
    scene.render.resolution_percentage = 100
    scene.render.fps = shots.FPS
    scene.frame_start, scene.frame_end = 1, shot["frames"]
    scene.render.use_motion_blur = False
    scene.render.use_persistent_data = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.use_overwrite = False
    scene.render.use_placeholder = True
    scene.cycles.samples = shot.get("samples", shots.SAMPLES)
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.03
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.volume_bounces = 1
    scene.cycles.sample_clamp_indirect = 6.0
    scene.cycles.seed = 7
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = shot.get("exposure", 0.8)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("shot")
    ap.add_argument("--out", default=os.path.join(HERE, "..", "..", "art", "blender", "trailer"))
    args = ap.parse_args(argv)

    shot = shots.by_id(args.shot)
    meta = importlib.import_module(shot["room"]).build()
    for name in meta.get("hiddenByDefault", []):
        bpy.data.objects[name].hide_render = True
    camera_move(shot)
    if "hero" in shot:
        dress.hero(meta, shot["hero"][0], shot["hero"][1], shot["frames"], back=shot.get("hero_back", 0.0),
                   lantern=shot.get("lantern", 90.0))
    if "umbra" in shot:
        dress.umbra(dress.point(meta, shot["umbra"]), shot["frames"])
    if "umbra_eyes" in shot:
        x, y, z = shot["umbra_eyes"]
        dress.eyes_only(Vector((x, y, 0)), z)
    configure(shot)

    os.makedirs(args.out, exist_ok=True)
    path = os.path.abspath(os.path.join(args.out, shot["id"] + ".blend"))
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
    print(f"built shot {shot['id']} ({shot['room']}, {shot['frames']} frames) -> {path}")


main()
