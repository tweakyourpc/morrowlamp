"""Build the remastered hero: a hooded traveller with a lantern.

Styled after the box art (marketing/morrowlamp-github-marketing.png): a long
plum cloak that flares to the ankles, a deep peaked hood, a dark leather coat,
boots and satchel, and the brass lantern held out.

    blender -b --factory-startup -P tools/blender/build_actor.py -- \
        [--out remastered/actors/hero.glb] [--blend art/blender/actors/hero.blend]

One skinned mesh, rigidly weighted part by part (the cloak hides the
joints), an armature, and three actions: Idle, Walk, Reach. The lantern's
glass carries an empty named LanternLight, where the browser hangs its
point light. Blender is Z-up facing -Y; the glTF exporter makes that
Y-up facing +Z, which is what the browser expects.
"""
from __future__ import annotations

import argparse
import math
import os
import sys

import addon_utils
import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
FPS = 24

BONES = {
    # name: (head, tail, parent)
    "hips": ((0, 0, 0.95), (0, 0, 1.06), None),
    "spine": ((0, 0, 1.06), (0, 0, 1.28), "hips"),
    "chest": ((0, 0, 1.28), (0, 0, 1.46), "spine"),
    "neck": ((0, 0, 1.46), (0, 0, 1.55), "chest"),
    "head": ((0, 0, 1.55), (0, 0, 1.76), "neck"),
    "upper_arm.L": ((0.19, 0, 1.42), (0.21, 0.0, 1.14), "chest"),
    "forearm.L": ((0.21, 0.0, 1.14), (0.22, -0.02, 0.9), "upper_arm.L"),
    "hand.L": ((0.22, -0.02, 0.9), (0.22, -0.03, 0.81), "forearm.L"),
    "upper_arm.R": ((-0.19, 0, 1.42), (-0.21, 0.0, 1.14), "chest"),
    "forearm.R": ((-0.21, 0.0, 1.14), (-0.22, -0.02, 0.9), "upper_arm.R"),
    "hand.R": ((-0.22, -0.02, 0.9), (-0.22, -0.03, 0.81), "forearm.R"),
    "thigh.L": ((0.1, 0, 0.95), (0.1, 0, 0.52), "hips"),
    "shin.L": ((0.1, 0, 0.52), (0.1, 0.01, 0.1), "thigh.L"),
    "foot.L": ((0.1, 0.01, 0.1), (0.1, -0.13, 0.03), "shin.L"),
    "thigh.R": ((-0.1, 0, 0.95), (-0.1, 0, 0.52), "hips"),
    "shin.R": ((-0.1, 0, 0.52), (-0.1, 0.01, 0.1), "thigh.R"),
    "foot.R": ((-0.1, 0.01, 0.1), (-0.1, -0.13, 0.03), "shin.R"),
}


# ---------------------------------------------------------------- materials

def material(name: str, color: tuple[float, float, float], rough: float = 0.7, metal: float = 0.0,
             emit: tuple[float, float, float] | None = None, strength: float = 0.0) -> bpy.types.Material:
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    return m


# ---------------------------------------------------------------- one mesh, many parts

class Body:
    """Accumulates primitive parts into one bmesh, each part bound to one bone."""

    def __init__(self) -> None:
        self.bm = bmesh.new()
        self.deform = self.bm.verts.layers.deform.verify()
        self.groups = list(BONES)
        self.materials: list[bpy.types.Material] = []

    def _finish(self, verts: list, bone: str, mat: bpy.types.Material, matrix: Matrix, smooth: bool) -> list:
        bmesh.ops.transform(self.bm, matrix=matrix, verts=verts)
        if mat not in self.materials:
            self.materials.append(mat)
        mi = self.materials.index(mat)
        gi = self.groups.index(bone)
        faces = {f for v in verts for f in v.link_faces}
        for f in faces:
            f.material_index = mi
            f.smooth = smooth
        for v in verts:
            v[self.deform][gi] = 1.0
        return verts

    def cone(self, bone: str, mat, r1: float, r2: float, z0: float, z1: float, at=(0, 0), seg: int = 14,
             squash: float = 1.0, smooth: bool = True, cap: bool = True) -> list:
        res = bmesh.ops.create_cone(self.bm, cap_ends=cap, segments=seg, radius1=r1, radius2=r2, depth=z1 - z0)
        m = Matrix.Translation((at[0], at[1], (z0 + z1) / 2)) @ Matrix.Diagonal((1, squash, 1, 1))
        return self._finish(res["verts"], bone, mat, m, smooth)

    def limb(self, bone: str, mat, r1: float, r2: float, seg: int = 10) -> list:
        """A tapered cylinder running exactly from a bone's head to its tail."""
        head, tail = Vector(BONES[bone][0]), Vector(BONES[bone][1])
        axis = tail - head
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=axis.length)
        rot = Vector((0, 0, 1)).rotation_difference(axis.normalized()).to_matrix().to_4x4()
        return self._finish(res["verts"], bone, mat, Matrix.Translation((head + tail) / 2) @ rot, True)

    def ball(self, bone: str, mat, r: float, at, scale=(1, 1, 1), seg: int = 14) -> list:
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=max(6, seg // 2), radius=r)
        m = Matrix.Translation(at) @ Matrix.Diagonal((*scale, 1))
        return self._finish(res["verts"], bone, mat, m, True)

    def block(self, bone: str, mat, size, at, rot_x: float = 0.0) -> list:
        res = bmesh.ops.create_cube(self.bm, size=1.0)
        m = Matrix.Translation(at) @ Matrix.Rotation(math.radians(rot_x), 4, "X") @ Matrix.Diagonal((*size, 1))
        return self._finish(res["verts"], bone, mat, m, False)

    def object(self, armature: bpy.types.Object) -> bpy.types.Object:
        me = bpy.data.meshes.new("Hero")
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.materials:
            me.materials.append(m)
        obj = bpy.data.objects.new("Hero", me)
        bpy.context.scene.collection.objects.link(obj)
        for g in self.groups:
            obj.vertex_groups.new(name=g)
        obj.parent = armature
        mod = obj.modifiers.new("rig", "ARMATURE")
        mod.object = armature
        return obj


def open_hood(bm: bmesh.types.BMesh, verts: list, centre: Vector) -> None:
    """Cut the face opening out of a hood sphere."""
    faces = {f for v in verts for f in v.link_faces}
    cut = []
    for f in faces:
        c = f.calc_center_median() - centre
        if c.y < -0.03 and -0.07 < c.z < 0.1 and abs(c.x) < 0.085:
            cut.append(f)
    bmesh.ops.delete(bm, geom=cut, context="FACES")


def back_half(bm: bmesh.types.BMesh, verts: list, keep_front: float = 0.0) -> None:
    """Remove a cone's front faces so it hangs behind like a cape."""
    faces = {f for v in verts if v.is_valid for f in v.link_faces}
    bmesh.ops.delete(bm, geom=[f for f in faces if f.calc_center_median().y < keep_front], context="FACES")


# ---------------------------------------------------------------- rig

def folds(verts: list, centre: Vector, z_top: float, z_bottom: float, count: int = 9, depth: float = 0.035) -> None:
    """Ripple a cloak into folds: the radius swells and dips around it, a
    little at the shoulders and most at the hem."""
    for v in verts:
        rel = v.co - Vector((centre.x, centre.y, v.co.z))
        if rel.length < 1e-6:
            continue
        t = max(0.0, min(1.0, (z_top - v.co.z) / (z_top - z_bottom)))
        a = math.atan2(rel.y, rel.x)
        v.co += rel.normalized() * depth * t * math.sin(a * count + 0.6)


def build_armature() -> bpy.types.Object:
    data = bpy.data.armatures.new("HeroRig")
    rig = bpy.data.objects.new("HeroRig", data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (head, tail, parent) in BONES.items():
        b = data.edit_bones.new(name)
        b.head, b.tail = head, tail
        b.roll = 0.0
        if parent:
            b.parent = data.edit_bones[parent]
            b.use_connect = Vector(BONES[parent][1]) == Vector(head)
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return rig


def build_body(rig: bpy.types.Object) -> bpy.types.Object:
    skin = material("skin", (0.2, 0.13, 0.1), 0.6)                   # in the hood's shadow
    cloak = material("cloak", (0.13, 0.04, 0.09), 0.9)               # plum, as on the box
    hood_mat = material("cloak.hood", (0.10, 0.03, 0.07), 0.92)
    lining = material("cloak.lining", (0.28, 0.04, 0.05), 0.85)
    coat = material("coat", (0.13, 0.075, 0.04), 0.55)               # dark leather
    trousers = material("trousers", (0.05, 0.045, 0.045), 0.9)
    boots = material("boots", (0.06, 0.035, 0.02), 0.45)
    belt = material("belt", (0.035, 0.022, 0.014), 0.45)
    brass = material("lantern.brass", (0.78, 0.55, 0.22), 0.3, metal=1.0)
    flame = material("lantern.glass", (1.0, 0.8, 0.5), 0.2, emit=(1.0, 0.62, 0.28), strength=6.0)

    b = Body()
    # legs and boots
    for s in ("L", "R"):
        b.limb(f"thigh.{s}", trousers, 0.075, 0.06, seg=14)
        b.limb(f"shin.{s}", trousers, 0.058, 0.05, seg=14)
        x = 0.1 if s == "L" else -0.1
        b.block(f"foot.{s}", boots, (0.1, 0.25, 0.09), (x, -0.05, 0.045))
        b.cone(f"shin.{s}", boots, 0.066, 0.06, 0.06, 0.42, at=(x, 0.0), seg=16)      # tall boots
        b.cone(f"shin.{s}", boots, 0.072, 0.072, 0.4, 0.45, at=(x, 0.0), seg=16)      # turned-down tops
    # torso: coat, skirts, belt
    b.cone("spine", coat, 0.17, 0.19, 1.02, 1.3, squash=0.72)
    b.cone("chest", coat, 0.19, 0.16, 1.28, 1.47, squash=0.75)
    b.cone("hips", coat, 0.22, 0.17, 0.62, 1.04, squash=0.8)
    b.cone("hips", belt, 0.178, 0.178, 1.0, 1.05, squash=0.78)
    b.block("hips", brass, (0.06, 0.02, 0.04), (0, -0.142, 1.025))
    b.block("hips", belt, (0.09, 0.05, 0.1), (-0.13, -0.11, 0.96))              # belt pouch
    b.block("hips", coat, (0.06, 0.17, 0.15), (0.2, 0.05, 0.86))               # satchel on the left hip
    b.block("chest", belt, (0.05, 0.28, 0.03), (0.0, -0.12, 1.32), rot_x=0.0)   # strap across the chest
    # arms
    for s in ("L", "R"):
        b.limb(f"upper_arm.{s}", coat, 0.06, 0.052, seg=14)
        b.limb(f"forearm.{s}", coat, 0.052, 0.042, seg=14)
        hx = 0.22 if s == "L" else -0.22
        b.ball(f"hand.{s}", skin, 0.042, (hx, -0.03, 0.86), scale=(0.8, 1, 1.2))
    # head and hood
    b.ball("neck", skin, 0.05, (0, 0, 1.52), scale=(1, 1, 1.2))
    b.ball("head", skin, 0.1, (0, -0.01, 1.64), scale=(0.85, 0.95, 1.1))
    hood_c = Vector((0, 0.02, 1.67))
    hood = b.ball("head", hood_mat, 0.15, hood_c, scale=(1.0, 1.15, 1.12), seg=24)
    open_hood(b.bm, hood, hood_c)
    b.ball("head", hood_mat, 0.075, (0, 0.13, 1.72), scale=(0.8, 1.5, 0.95), seg=14)   # the hood's peak, falling back
    cowl = b.cone("head", hood_mat, 0.2, 0.14, 1.46, 1.66, at=(0, 0.03), squash=0.95, seg=24, cap=False)  # hood sides to the shoulders
    back_half(b.bm, cowl, keep_front=-0.06)
    b.cone("chest", hood_mat, 0.27, 0.19, 1.36, 1.53, squash=0.85, seg=24)               # mantle over the shoulders
    # The cloak, flaring from the shoulders to the ankles.
    # Deep enough at the hem that a full stride stays inside it.
    cape = b.cone("chest", cloak, 0.5, 0.23, 0.16, 1.44, squash=0.86, seg=40, cap=False)
    folds(cape, Vector((0, 0, 0)), 1.44, 0.16)
    back_half(b.bm, cape, keep_front=-0.04)
    lin = b.cone("chest", lining, 0.49, 0.225, 0.17, 1.43, squash=0.85, seg=40, cap=False)
    folds(lin, Vector((0, 0, 0)), 1.43, 0.17)
    back_half(b.bm, lin, keep_front=-0.04)
    # the lantern, hanging from the right hand
    lx, ly, lz = -0.22, -0.05, 0.7
    b.block("hand.R", brass, (0.11, 0.11, 0.02), (lx, ly, lz + 0.09))
    b.block("hand.R", brass, (0.12, 0.12, 0.025), (lx, ly, lz - 0.085))
    b.cone("hand.R", flame, 0.045, 0.045, lz - 0.075, lz + 0.08, at=(lx, ly), seg=12)
    for dx in (-0.05, 0.05):
        for dy in (-0.05, 0.05):
            b.block("hand.R", brass, (0.012, 0.012, 0.17), (lx + dx, ly + dy, lz))
    b.cone("hand.R", brass, 0.06, 0.02, lz + 0.1, lz + 0.15, at=(lx, ly), seg=12)
    b.block("hand.R", brass, (0.01, 0.01, 0.07), (lx, ly, lz + 0.18))

    body = b.object(rig)
    light = bpy.data.objects.new("LanternLight", None)
    bpy.context.scene.collection.objects.link(light)
    bone = rig.data.bones["hand.R"]
    light.parent = rig
    light.parent_type = "BONE"
    light.parent_bone = "hand.R"
    tail = Matrix.Translation(bone.tail_local) @ bone.matrix_local.to_3x3().to_4x4()
    light.matrix_parent_inverse = (rig.matrix_world @ tail).inverted()
    light.location = (lx, ly, lz)
    return body


# ---------------------------------------------------------------- animation

def world_x(rig: bpy.types.Object, bone: str, degrees: float) -> Quaternion:
    """A rotation about the world X axis (the walking plane), in bone space.
    Negative swings a limb forward, toward -Y."""
    rest = rig.data.bones[bone].matrix_local.to_quaternion()
    return rest.inverted() @ Quaternion((1, 0, 0), math.radians(degrees)) @ rest


def key(rig: bpy.types.Object, frame: int, pose: dict[str, float], lift: float = 0.0) -> None:
    for pb in rig.pose.bones:
        pb.rotation_quaternion = world_x(rig, pb.name, pose.get(pb.name, 0.0))
        pb.keyframe_insert("rotation_quaternion", frame=frame)
    hips = rig.pose.bones["hips"]
    rest = rig.data.bones["hips"].matrix_local.to_quaternion()
    hips.location = rest.inverted() @ Vector((0, 0, lift))
    hips.keyframe_insert("location", frame=frame)


CARRY = {"upper_arm.R": -12, "forearm.R": -38, "hand.R": 50}   # lantern held out, hanging plumb


def action(rig: bpy.types.Object, name: str, frames: list[tuple[int, dict, float]]) -> bpy.types.Action:
    rig.animation_data_create()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data.action = act
    for frame, pose, lift in frames:
        key(rig, frame, {**CARRY, **pose}, lift)
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
    return act


def animate(rig: bpy.types.Object) -> None:
    def stride(t: float) -> tuple[dict, float]:
        """One walking pose at phase t in [0, 1)."""
        s = math.sin(t * math.tau)
        pose = {
            "thigh.L": -24 * s, "thigh.R": 24 * s,
            "shin.L": 34 * max(0.0, math.sin(t * math.tau + 1.2)) ** 2,
            "shin.R": 34 * max(0.0, math.sin(t * math.tau + 1.2 + math.pi)) ** 2,
            "foot.L": 10 * s, "foot.R": -10 * s,
            "upper_arm.L": 16 * s, "forearm.L": -10 - 6 * s,
            "upper_arm.R": -12 - 5 * s,
            "spine": -3, "chest": 2 * abs(s), "head": 3,
        }
        return pose, 0.025 * abs(math.cos(t * math.tau)) - 0.012
    walk = [(i * 3, *stride(i / 8)) for i in range(9)]
    action(rig, "Walk", [(f, p, lift) for f, p, lift in walk])

    idle = []
    for i in range(5):
        t = i / 4
        breathe = math.sin(t * math.tau)
        idle.append((i * 12, {"chest": -1.5 * breathe, "head": 2 + breathe, "upper_arm.L": 3, "forearm.L": -8}, 0.004 * breathe))
    action(rig, "Idle", idle)

    reach = [(0, {"forearm.L": -8}, 0.0), (6, {"upper_arm.L": -62, "forearm.L": -20, "spine": -6, "head": 6}, -0.01),
             (11, {"upper_arm.L": -66, "forearm.L": -14, "spine": -6, "head": 8}, -0.01), (18, {"forearm.L": -8}, 0.0)]
    action(rig, "Reach", reach)
    rig.animation_data.action = bpy.data.actions["Idle"]


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "remastered", "actors", "hero.glb"))
    ap.add_argument("--blend", default=os.path.join(ROOT, "art", "blender", "actors", "hero.blend"))
    args = ap.parse_args(argv)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    addon_utils.enable("io_scene_gltf2")
    bpy.context.scene.render.fps = FPS
    rig = build_armature()
    build_body(rig)
    animate(rig)

    os.makedirs(os.path.dirname(args.blend), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend), compress=True)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(args.out), export_format="GLB", export_yup=True,
        export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
        export_optimize_animation_size=True, export_skins=True, export_def_bones=True,
        export_materials="EXPORT", export_lights=False, export_cameras=False)
    print(f"built hero -> {args.out} ({os.path.getsize(args.out)} bytes)")


main()
