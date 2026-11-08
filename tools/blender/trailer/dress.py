"""Dress a room for a trailer shot: the hero walking with the lantern lit,
and the Umbra, the shadow from the box art, rising with red eyes.

The hero is appended from art/blender/actors/hero.blend (build_actor.py),
so the trailer shows exactly the model the game plays. The Umbra is made
here: in the game it is drawn live in three.js (js/remastered/creatures.js),
and this is its Blender likeness, not a copy of that code.
"""
from __future__ import annotations

import math
import os

import bpy
from mathutils import Vector

import kit

HERE = os.path.dirname(os.path.abspath(__file__))
HERO_BLEND = os.path.abspath(os.path.join(HERE, "..", "..", "..", "art", "blender", "actors", "hero.blend"))
WALK_SPEED = 1.1          # metres a second
FPS = 24


def point(meta: dict, name) -> Vector:
    if isinstance(name, (list, tuple)) and not isinstance(name, str):
        return Vector((name[0], name[1], 0.0))
    p = meta.get("points", {}).get(name) or meta.get("walkTo", {}).get(name)
    if p is None:
        raise KeyError(f"no point {name!r} in {meta['room']}")
    return Vector((p[0], p[1], 0.0))


def linear(obj: bpy.types.Object) -> None:
    anim = obj.animation_data
    if anim and anim.action and hasattr(anim.action, "fcurves"):
        for fc in anim.action.fcurves:
            for k in fc.keyframe_points:
                k.interpolation = "LINEAR"


def hero(meta: dict, frm, to, frames: int, back: float = 0.0, lantern: float = 90.0) -> bpy.types.Object:
    """Walk the hero from `frm` towards `to`, arriving at the end of the shot.
    `back` stands them that far short of `to`, facing it (for a still)."""
    with bpy.data.libraries.load(HERO_BLEND, link=False) as (src, dst):
        dst.objects = list(src.objects)
        dst.actions = list(src.actions)
    for o in dst.objects:
        bpy.context.scene.collection.objects.link(o)
    rig = bpy.data.objects["HeroRig"]
    a, b = point(meta, frm), point(meta, to)
    cam = bpy.context.scene.camera.location
    if (b - a).length < 1e-3:                       # a still: stand short of the target, towards the camera
        towards = Vector((cam.x - b.x, cam.y - b.y, 0)).normalized()
        a = b + towards * (back + 0.01)
        b = b + towards * back
    d = (b - a)
    reach = min(d.length, WALK_SPEED * frames / FPS)
    start = b - d.normalized() * reach if d.length > 1e-3 else a
    yaw = math.atan2(d.x, -d.y) if d.length > 1e-3 else 0.0
    rig.rotation_euler = (0, 0, yaw)
    walk = bpy.data.actions["Walk"]
    anim = rig.animation_data or rig.animation_data_create()
    anim.action = None
    track = anim.nla_tracks.new()
    strip = track.strips.new("Walk", 1, walk)
    if frames > 1:
        length = walk.frame_range[1] - walk.frame_range[0]
        strip.repeat = frames / length + 1
        rig.location = start
        rig.keyframe_insert("location", frame=1)
        rig.location = b
        rig.keyframe_insert("location", frame=frames)
        linear(rig)
    else:                                           # a still stands at `frm`, facing `to`
        rig.location = a
    lamp = bpy.data.lights.new("hero.lantern", "POINT")
    lamp.energy, lamp.color, lamp.shadow_soft_size = lantern, (1.0, 0.66, 0.32), 0.04
    light = bpy.data.objects.new("hero.lantern", lamp)
    light.parent = bpy.data.objects["LanternLight"]
    bpy.context.scene.collection.objects.link(light)
    return rig


def smoke_material(name: str) -> bpy.types.Material:
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (0.02, 0.008, 0.02, 1)
    coords = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    noise.inputs["Scale"].default_value = 2.2
    noise.inputs["Detail"].default_value = 6.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[1].position = 0.72
    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    dens = nt.nodes.new("ShaderNodeMath")
    dens.operation = "MULTIPLY"
    dens.inputs[1].default_value = 14.0
    nt.links.new(coords.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(coords.outputs["Object"], grad.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], mul.inputs[0])
    nt.links.new(grad.outputs["Fac"], mul.inputs[1])
    nt.links.new(mul.outputs[0], dens.inputs[0])
    nt.links.new(dens.outputs[0], vol.inputs["Density"])
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    m["noise"] = noise.name
    return m


def umbra(at: Vector, frames: int, rise: bool = True, scale: float = 1.0, base_z: float = 0.0) -> bpy.types.Object:
    """The shadow: a swirl of smoke, reaching arms, and two red eyes."""
    root = kit.empty("umbra", (at.x, at.y, base_z))
    parts = []
    smoke = smoke_material("umbra.smoke")
    body = kit.box("umbra.body", (2.4 * scale, 1.8 * scale, 3.2 * scale), (at.x, at.y, base_z + 1.4 * scale), smoke)
    parts.append(body)
    flesh = kit.solid("umbra.flesh", (0.015, 0.008, 0.015), rough=0.35, sheen=0.4)
    for k in range(6):
        ang = -1.0 + k * 0.4
        side = -1 if k < 3 else 1
        x, z, r = at.x + side * 0.25 * scale, base_z + 0.6 * scale, 0.12 * scale
        tilt = 0.0
        for j in range(7):
            tilt += 0.18 + 0.04 * k
            seg = 0.32 * scale
            dx = side * math.sin(tilt) * seg
            dz = math.cos(tilt) * seg
            c = kit.cylinder(f"umbra.arm.{k}.{j}", r, seg * 1.1, (x + dx / 2, at.y + ang * 0.3 * scale, z + dz / 2), flesh,
                             rot=(0, math.degrees(side * tilt), 0), segments=10, radius2=r * 0.78)
            parts.append(c)
            x, z, r = x + dx, z + dz, r * 0.78
    eye = kit.solid("umbra.eye", (1.0, 0.1, 0.05), rough=0.3, emission=(1.0, 0.08, 0.03), strength=45.0)
    for side in (-1, 1):
        parts.append(kit.sphere(f"umbra.eye.{side}", 0.065 * scale, (at.x + side * 0.16 * scale, at.y - 0.6 * scale, base_z + 2.35 * scale), eye,
                                scale=(1.4, 0.6, 0.7), segments=12))
    glow = kit.point("umbra.glow", (1.0, 0.1, 0.05), 25 * scale, (at.x, at.y - 0.9 * scale, base_z + 2.3 * scale), radius=0.1)
    parts.append(glow)
    kit.parent(parts, root)
    noise = smoke.node_tree.nodes[smoke["noise"]]
    w = noise.inputs["W"]
    w.default_value = 0.0
    w.keyframe_insert("default_value", frame=1)
    w.default_value = 0.6 * max(1, frames) / FPS
    w.keyframe_insert("default_value", frame=max(2, frames))
    if rise and frames > 1:
        root.location.z = base_z - 2.2 * scale
        root.keyframe_insert("location", frame=1)
        root.location.z = base_z
        root.keyframe_insert("location", frame=int(frames * 0.85))
    return root


def eyes_only(at: Vector, z: float) -> None:
    """Just the eyes in the dark behind the throne, watching."""
    eye = kit.solid("umbra.eye", (1.0, 0.1, 0.05), rough=0.3, emission=(1.0, 0.08, 0.03), strength=60.0)
    for side in (-1, 1):
        kit.sphere(f"watch.eye.{side}", 0.07, (at.x + side * 0.2, at.y, z), eye, scale=(1.5, 0.6, 0.7), segments=12)
    kit.point("watch.glow", (1.0, 0.1, 0.05), 12, (at.x, at.y - 0.4, z), radius=0.1)
