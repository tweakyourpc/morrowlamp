"""Two stills of the hero, front three-quarter and back, for checking a restyle.

    blender -b art/blender/actors/hero.blend -P tools/blender/preview_actor.py -- --out out/actor

Lit by a cold moon and the lantern, on a dark floor, in the Walk pose.
Renders on the GPU box like everything else.
"""
from __future__ import annotations

import argparse
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from render_room import has_oidn, use_gpu  # noqa: E402


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    args = ap.parse_args(argv)
    scene = bpy.context.scene
    rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    rig.animation_data.action = bpy.data.actions["Walk"]
    scene.frame_set(6)

    floor = bpy.data.meshes.new("floor")
    floor.from_pydata([(-6, -6, 0), (6, -6, 0), (6, 6, 0), (-6, 6, 0)], [], [(0, 1, 2, 3)])
    ground = bpy.data.objects.new("floor", floor)
    scene.collection.objects.link(ground)
    mat = bpy.data.materials.new("floor")
    mat.diffuse_color = (0.05, 0.05, 0.06, 1)
    floor.materials.append(mat)

    world = bpy.data.worlds.new("w")
    world.color = (0.01, 0.012, 0.02)
    scene.world = world
    moon = bpy.data.lights.new("moon", "SUN")
    moon.energy, moon.color = 2.5, (0.6, 0.7, 1.0)
    m = bpy.data.objects.new("moon", moon)
    m.rotation_euler = (math.radians(50), 0, math.radians(150))
    scene.collection.objects.link(m)
    lamp = bpy.data.lights.new("lantern", "POINT")
    lamp.energy, lamp.color, lamp.shadow_soft_size = 40, (1.0, 0.65, 0.3), 0.05
    l = bpy.data.objects.new("lantern", lamp)
    l.parent = bpy.data.objects["LanternLight"]
    scene.collection.objects.link(l)

    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "CYCLES"
    use_gpu(scene)
    has_oidn(scene)
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 900, 1200
    scene.view_settings.view_transform = "AgX"
    os.makedirs(args.out, exist_ok=True)
    for name, at in (("front", (-1.6, -2.6, 1.3)), ("back", (1.4, 2.6, 1.5))):
        cam.location = Vector(at)
        cam.rotation_euler = (Vector((0, 0, 1.0)) - Vector(at)).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(os.path.abspath(args.out), name + ".png")
        bpy.ops.render.render(write_still=True)
        print(f"[morrow] {name} -> {scene.render.filepath}", flush=True)


main()
