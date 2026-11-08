"""Shared Blender building kit for Morrowlamp remastered rooms.

Primitives, procedural materials and the conventions every room builder
follows: Blender Z-up, metres, the camera looking down +Y at the north
wall, and pass indices that name hotspots in the id pass.

Runs inside Blender 4.0+ only.
"""
from __future__ import annotations

import math
from typing import Iterable, Sequence

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

Vec3 = Sequence[float]

ROOT_COLLECTION = "Room"


# ---------------------------------------------------------------- scene setup

def reset_scene() -> bpy.types.Scene:
    """Start from an empty scene with a single Room collection."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    coll = bpy.data.collections.new(ROOT_COLLECTION)
    scene.collection.children.link(coll)
    return scene


def room_collection() -> bpy.types.Collection:
    return bpy.data.collections[ROOT_COLLECTION]


def link(obj: bpy.types.Object, collection: bpy.types.Collection | None = None) -> bpy.types.Object:
    (collection or room_collection()).objects.link(obj)
    return obj


# ---------------------------------------------------------------- materials

def _input(node: bpy.types.Node, names: Iterable[str]) -> bpy.types.NodeSocket:
    """Principled inputs were renamed in 4.0; accept either spelling."""
    for name in names:
        if name in node.inputs:
            return node.inputs[name]
    raise KeyError(f"none of {list(names)} on {node.bl_idname}")


def _principled(m: bpy.types.Material) -> bpy.types.Node:
    m.use_nodes = True
    return m.node_tree.nodes["Principled BSDF"]


def solid(name: str, color: Vec3, rough: float = 0.6, metal: float = 0.0,
          sheen: float = 0.0, transmission: float = 0.0, emission: Vec3 | None = None,
          strength: float = 0.0) -> bpy.types.Material:
    """A flat Principled material with a little roughness noise for dust."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    bsdf = _principled(m)
    _input(bsdf, ["Base Color"]).default_value = (*color, 1.0)
    _input(bsdf, ["Metallic"]).default_value = metal
    _input(bsdf, ["Sheen Weight", "Sheen"]).default_value = sheen
    _input(bsdf, ["Transmission Weight", "Transmission"]).default_value = transmission
    if emission is not None:
        _input(bsdf, ["Emission Color", "Emission"]).default_value = (*emission, 1.0)
        _input(bsdf, ["Emission Strength"]).default_value = strength
    _dusty_roughness(m, bsdf, rough)
    return m


def _dusty_roughness(m: bpy.types.Material, bsdf: bpy.types.Node, rough: float) -> None:
    nt = m.node_tree
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Detail"].default_value = 6.0
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs["To Min"].default_value = max(0.0, rough - 0.12)
    ramp.inputs["To Max"].default_value = min(1.0, rough + 0.12)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Value"])
    nt.links.new(ramp.outputs["Result"], _input(bsdf, ["Roughness"]))


def glass(name: str = "glass", tint: Vec3 = (0.92, 0.95, 0.93), rough: float = 0.04) -> bpy.types.Material:
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    bsdf = _principled(m)
    _input(bsdf, ["Base Color"]).default_value = (*tint, 1.0)
    _input(bsdf, ["Roughness"]).default_value = rough
    _input(bsdf, ["Transmission Weight", "Transmission"]).default_value = 1.0
    _input(bsdf, ["IOR"]).default_value = 1.45
    return m


def _object_coords(nt: bpy.types.NodeTree, scale: Vec3 = (1, 1, 1)) -> bpy.types.NodeSocket:
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = scale
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    return mp.outputs["Vector"]


def _mix_color(nt: bpy.types.NodeTree, fac, a, b) -> bpy.types.NodeSocket:
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    nt.links.new(fac, mix.inputs[0])
    for sock, value in ((mix.inputs[6], a), (mix.inputs[7], b)):
        if isinstance(value, bpy.types.NodeSocket):
            nt.links.new(value, sock)
        else:
            sock.default_value = (*value, 1.0)
    return mix.outputs[2]


def wood(name: str, light: Vec3, dark: Vec3, grain: float = 6.0, rough: float = 0.55,
         along: str = "X") -> bpy.types.Material:
    """Wave-and-noise wood grain running along one object axis."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    bsdf = _principled(m)
    nt = m.node_tree
    stretch = {"X": (0.15, 1.0, 1.0), "Y": (1.0, 0.15, 1.0), "Z": (1.0, 1.0, 0.15)}[along]
    vec = _object_coords(nt, stretch)
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "RINGS"
    wave.inputs["Scale"].default_value = grain
    wave.inputs["Distortion"].default_value = 7.0
    wave.inputs["Detail"].default_value = 4.0
    nt.links.new(vec, wave.inputs["Vector"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.0
    nt.links.new(vec, noise.inputs["Vector"])
    fac = nt.nodes.new("ShaderNodeMath")
    fac.operation = "MULTIPLY"
    nt.links.new(wave.outputs["Fac"], fac.inputs[0])
    nt.links.new(noise.outputs["Fac"], fac.inputs[1])
    nt.links.new(_mix_color(nt, fac.outputs[0], dark, light), _input(bsdf, ["Base Color"]))
    _dusty_roughness(m, bsdf, rough)
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    nt.links.new(wave.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], _input(bsdf, ["Normal"]))
    return m


def planks(name: str, light: Vec3, dark: Vec3, gap: Vec3 = (0.02, 0.015, 0.01),
           width: float = 0.18, length: float = 1.6) -> bpy.types.Material:
    """Floorboards: a brick pattern for the boards, wood grain inside each."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    bsdf = _principled(m)
    nt = m.node_tree
    vec = _object_coords(nt)
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.offset = 0.37
    brick.offset_frequency = 1
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Mortar Size"].default_value = 0.004
    brick.inputs["Mortar Smooth"].default_value = 0.2
    brick.inputs["Brick Width"].default_value = length
    brick.inputs["Row Height"].default_value = width
    brick.inputs["Color1"].default_value = (*light, 1)
    brick.inputs["Color2"].default_value = (*dark, 1)
    brick.inputs["Mortar"].default_value = (*gap, 1)
    nt.links.new(vec, brick.inputs["Vector"])
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 4.0
    wave.inputs["Distortion"].default_value = 9.0
    wave.inputs["Detail"].default_value = 5.0
    sep = nt.nodes.new("ShaderNodeMapping")
    sep.inputs["Scale"].default_value = (0.08, 1.0, 1.0)
    nt.links.new(vec, sep.inputs["Vector"])
    nt.links.new(sep.outputs["Vector"], wave.inputs["Vector"])
    grain = nt.nodes.new("ShaderNodeMix")
    grain.data_type = "RGBA"
    grain.blend_type = "MULTIPLY"
    grain.inputs[0].default_value = 0.35
    nt.links.new(brick.outputs["Color"], grain.inputs[6])
    nt.links.new(wave.outputs["Color"], grain.inputs[7])
    nt.links.new(grain.outputs[2], _input(bsdf, ["Base Color"]))
    _dusty_roughness(m, bsdf, 0.5)
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    bump.invert = True
    nt.links.new(brick.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], _input(bsdf, ["Normal"]))
    return m


def wallpaper(name: str, ground: Vec3, figure: Vec3, stain: Vec3, scale: float = 5.0) -> bpy.types.Material:
    """Faded damask: a voronoi figure on a ground, water-stained from above."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    bsdf = _principled(m)
    nt = m.node_tree
    vec = _object_coords(nt)
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.feature = "SMOOTH_F1"
    vor.inputs["Scale"].default_value = scale
    nt.links.new(vec, vor.inputs["Vector"])
    stripes = nt.nodes.new("ShaderNodeTexWave")
    stripes.wave_profile = "SIN"
    stripes.inputs["Scale"].default_value = scale * 0.6
    nt.links.new(vec, stripes.inputs["Vector"])
    fig = nt.nodes.new("ShaderNodeMath")
    fig.operation = "MULTIPLY"
    nt.links.new(vor.outputs["Distance"], fig.inputs[0])
    nt.links.new(stripes.outputs["Fac"], fig.inputs[1])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.12
    ramp.color_ramp.elements[0].color = (*figure, 1)
    ramp.color_ramp.elements[1].position = 0.2
    ramp.color_ramp.elements[1].color = (*ground, 1)
    nt.links.new(fig.outputs[0], ramp.inputs["Fac"])
    damp = nt.nodes.new("ShaderNodeTexNoise")
    damp.inputs["Scale"].default_value = 1.2
    damp.inputs["Detail"].default_value = 8.0
    nt.links.new(vec, damp.inputs["Vector"])
    edge = nt.nodes.new("ShaderNodeMapRange")
    edge.inputs["From Min"].default_value = 0.6
    edge.inputs["From Max"].default_value = 0.78
    nt.links.new(damp.outputs["Fac"], edge.inputs["Value"])
    faint = nt.nodes.new("ShaderNodeMath")
    faint.operation = "MULTIPLY"
    faint.inputs[1].default_value = 0.45
    nt.links.new(edge.outputs["Result"], faint.inputs[0])
    nt.links.new(_mix_color(nt, faint.outputs[0], ramp.outputs["Color"], stain), _input(bsdf, ["Base Color"]))
    _dusty_roughness(m, bsdf, 0.8)
    return m


def stone(name: str, light: Vec3, dark: Vec3, scale: float = 4.0, bump: float = 0.5) -> bpy.types.Material:
    """Mottled stone, earth or plaster. A strong, fine `bump` is costly in the
    packed normal pass; big rough surfaces (caves, earth) want it gentler."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    bsdf = _principled(m)
    nt = m.node_tree
    vec = _object_coords(nt)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 10.0
    nt.links.new(vec, noise.inputs["Vector"])
    nt.links.new(_mix_color(nt, noise.outputs["Fac"], dark, light), _input(bsdf, ["Base Color"]))
    _dusty_roughness(m, bsdf, 0.85)
    relief = nt.nodes.new("ShaderNodeBump")
    relief.inputs["Strength"].default_value = bump
    nt.links.new(noise.outputs["Fac"], relief.inputs["Height"])
    nt.links.new(relief.outputs["Normal"], _input(bsdf, ["Normal"]))
    return m


def ashlar(name: str, light: Vec3, dark: Vec3, mortar: Vec3 = (0.05, 0.05, 0.05),
           course: float = 0.32, block: float = 0.62) -> bpy.types.Material:
    """Dressed stone in courses: a brick pattern on the wall's X-Z face,
    each block mottled and pitted, the mortar raked back."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    bsdf = _principled(m)
    nt = m.node_tree
    vec = _object_coords(nt)
    swap = nt.nodes.new("ShaderNodeMapping")       # run the courses along Z, not Y
    swap.inputs["Rotation"].default_value = (math.radians(90), 0, 0)
    nt.links.new(vec, swap.inputs["Vector"])
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.offset = 0.5
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Mortar Size"].default_value = 0.012
    brick.inputs["Mortar Smooth"].default_value = 0.3
    brick.inputs["Bias"].default_value = 0.2
    brick.inputs["Brick Width"].default_value = block
    brick.inputs["Row Height"].default_value = course
    brick.inputs["Color1"].default_value = (*light, 1)
    brick.inputs["Color2"].default_value = (*dark, 1)
    brick.inputs["Mortar"].default_value = (*mortar, 1)
    nt.links.new(swap.outputs["Vector"], brick.inputs["Vector"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Detail"].default_value = 8.0
    nt.links.new(vec, noise.inputs["Vector"])
    mottle = nt.nodes.new("ShaderNodeMix")
    mottle.data_type = "RGBA"
    mottle.blend_type = "MULTIPLY"
    mottle.inputs[0].default_value = 0.5
    nt.links.new(brick.outputs["Color"], mottle.inputs[6])
    nt.links.new(noise.outputs["Color"], mottle.inputs[7])
    # Weather: broad dark stains where rain has run for a century or three.
    weather = nt.nodes.new("ShaderNodeTexNoise")
    weather.inputs["Scale"].default_value = 0.9
    weather.inputs["Detail"].default_value = 6.0
    stretch = nt.nodes.new("ShaderNodeMapping")
    stretch.inputs["Scale"].default_value = (1.0, 1.0, 0.25)
    nt.links.new(vec, stretch.inputs["Vector"])
    nt.links.new(stretch.outputs["Vector"], weather.inputs["Vector"])
    stain = nt.nodes.new("ShaderNodeMapRange")
    stain.inputs["From Min"].default_value = 0.45
    stain.inputs["From Max"].default_value = 0.7
    stain.inputs["To Max"].default_value = 0.65
    nt.links.new(weather.outputs["Fac"], stain.inputs["Value"])
    nt.links.new(_mix_color(nt, stain.outputs["Result"], mottle.outputs[2], [c * 0.35 for c in dark]),
                 _input(bsdf, ["Base Color"]))
    _dusty_roughness(m, bsdf, 0.9)
    height = nt.nodes.new("ShaderNodeMath")
    height.operation = "MULTIPLY_ADD"
    height.inputs[2].default_value = 0.0
    nt.links.new(brick.outputs["Fac"], height.inputs[0])
    nt.links.new(noise.outputs["Fac"], height.inputs[1])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    bump.invert = True
    nt.links.new(height.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], _input(bsdf, ["Normal"]))
    return m


def text(name: str, body: str, size: float, loc: Vec3, mat: bpy.types.Material,
         rot: Vec3 = (0, 0, 0), depth: float = 0.002) -> bpy.types.Object:
    """Lettering in Blender's built-in font, centred on `loc`."""
    curve = bpy.data.curves.new(name, type="FONT")
    curve.body = body
    curve.size = size
    curve.extrude = depth
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    obj = bpy.data.objects.new(name, curve)
    obj.data.materials.append(mat)
    link(obj)
    return _place(obj, loc, rot)


def volume(name: str, density: float, color: Vec3 = (0.9, 0.92, 1.0), anisotropy: float = 0.35) -> bpy.types.Material:
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Density"].default_value = density
    vol.inputs["Color"].default_value = (*color, 1)
    vol.inputs["Anisotropy"].default_value = anisotropy
    nt.links.new(vol.outputs[0], nt.nodes["Material Output"].inputs["Volume"])
    return m


# ---------------------------------------------------------------- geometry

def _mesh_object(name: str, bm: bmesh.types.BMesh, mat: bpy.types.Material | None) -> bpy.types.Object:
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    if mat is not None:
        me.materials.append(mat)
    return link(obj)


def _place(obj: bpy.types.Object, loc: Vec3, rot: Vec3 | None) -> bpy.types.Object:
    obj.location = loc
    if rot is not None:
        obj.rotation_euler = Euler([math.radians(a) for a in rot])
    return obj


def box(name: str, size: Vec3, loc: Vec3, mat: bpy.types.Material | None, rot: Vec3 | None = None,
        bevel: float = 0.0, pivot: Vec3 = (0.0, 0.0, 0.0)) -> bpy.types.Object:
    """An axis-aligned box of real size. `pivot` moves the origin, in units
    of half-extents (-1..1 per axis), so doors can hinge on an edge."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    offset = Vector([-p * 0.5 for p in pivot])
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector([o * s for o, s in zip(offset, size)]), verts=bm.verts)
    obj = _mesh_object(name, bm, mat)
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
    return _place(obj, loc, rot)


def cylinder(name: str, radius: float, depth: float, loc: Vec3, mat: bpy.types.Material | None,
             rot: Vec3 | None = None, segments: int = 24, radius2: float | None = None) -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius,
                          radius2=radius if radius2 is None else radius2, depth=depth)
    for f in bm.faces:
        f.smooth = len(f.verts) == 4
    return _place(_mesh_object(name, bm, mat), loc, rot)


def torus(name: str, major: float, minor: float, loc: Vec3, mat: bpy.types.Material | None,
          segments: int = 48, sides: int = 10) -> bpy.types.Object:
    bm = bmesh.new()
    rings = []
    for i in range(segments):
        a = i / segments * math.tau
        centre = Vector((math.cos(a) * major, math.sin(a) * major, 0.0))
        out = Vector((math.cos(a), math.sin(a), 0.0))
        rings.append([bm.verts.new(centre + out * math.cos(b) * minor + Vector((0, 0, math.sin(b) * minor)))
                      for b in (j / sides * math.tau for j in range(sides))])
    for i in range(segments):
        r0, r1 = rings[i], rings[(i + 1) % segments]
        for j in range(sides):
            f = bm.faces.new((r0[j], r1[j], r1[(j + 1) % sides], r0[(j + 1) % sides]))
            f.smooth = True
    return _place(_mesh_object(name, bm, mat), loc, None)


def sphere(name: str, radius: float, loc: Vec3, mat: bpy.types.Material | None,
           scale: Vec3 = (1, 1, 1), segments: int = 16) -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=max(6, segments // 2), radius=radius)
    for f in bm.faces:
        f.smooth = True
    obj = _place(_mesh_object(name, bm, mat), loc, None)
    obj.scale = scale
    return obj


def rock(name: str, radius: float, loc: Vec3, mat: bpy.types.Material, seed: int) -> bpy.types.Object:
    """A lumpy displaced icosphere for rubble."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=radius)
    import random
    rng = random.Random(seed)
    for v in bm.verts:
        v.co *= 0.75 + rng.random() * 0.45
    obj = _place(_mesh_object(name, bm, mat), loc, (rng.uniform(0, 90), rng.uniform(0, 90), rng.uniform(0, 360)))
    obj.scale = (1.0, 0.8 + rng.random() * 0.5, 0.5 + rng.random() * 0.4)
    return obj


def wall_with_openings(name: str, x0: float, x1: float, height: float, thickness: float,
                       openings: Sequence[tuple[float, float, float, float]], mat: bpy.types.Material,
                       axis: str, at: float) -> list[bpy.types.Object]:
    """A wall along X (axis='X', at=y) or Y (axis='Y', at=x) built from
    boxes around rectangular openings (u0, u1, v0, v1 in wall space)."""
    pieces: list[bpy.types.Object] = []
    cuts = sorted(openings)
    u = x0
    spans: list[tuple[float, float, float, float]] = []
    for (u0, u1, v0, v1) in cuts:
        if u0 > u:
            spans.append((u, u0, 0.0, height))
        if v0 > 0:
            spans.append((u0, u1, 0.0, v0))
        if v1 < height:
            spans.append((u0, u1, v1, height))
        u = u1
    if u < x1:
        spans.append((u, x1, 0.0, height))
    for i, (u0, u1, v0, v1) in enumerate(spans):
        cu, cv = (u0 + u1) / 2, (v0 + v1) / 2
        if axis == "X":
            pieces.append(box(f"{name}.{i}", (u1 - u0, thickness, v1 - v0), (cu, at, cv), mat))
        else:
            pieces.append(box(f"{name}.{i}", (thickness, u1 - u0, v1 - v0), (at, cu, cv), mat))
    return pieces


def parent(children: Iterable[bpy.types.Object], to: bpy.types.Object) -> None:
    # World matrices are stale until the depsgraph runs; without this, a fresh
    # child snaps to its parent's origin at scale 1.
    bpy.context.view_layer.update()
    for child in children:
        world = child.matrix_world.copy()
        child.parent = to
        child.matrix_parent_inverse = to.matrix_world.inverted()
        child.matrix_world = world


def empty(name: str, loc: Vec3, rot: Vec3 | None = None) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    link(obj)
    return _place(obj, loc, rot)


def hotspot(objs: Iterable[bpy.types.Object], index: int) -> None:
    """Tag geometry with the pass index that names it in the id pass."""
    for obj in objs:
        obj.pass_index = index
        for child in obj.children_recursive:
            child.pass_index = index


# ---------------------------------------------------------------- lights and camera

def sun(name: str, color: Vec3, strength: float, direction: Vec3, angle: float = 1.0) -> bpy.types.Object:
    """A sun lamp whose light travels along `direction`."""
    data = bpy.data.lights.new(name, "SUN")
    data.color = color
    data.energy = strength
    data.angle = math.radians(angle)
    obj = link(bpy.data.objects.new(name, data))
    obj.location = (0, 0, 10)
    obj.rotation_euler = Vector(direction).to_track_quat("-Z", "Y").to_euler()
    return obj


def point(name: str, color: Vec3, watts: float, loc: Vec3, radius: float = 0.1) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "POINT")
    data.color = color
    data.energy = watts
    data.shadow_soft_size = radius
    return _place(link(bpy.data.objects.new(name, data)), loc, None)


def area(name: str, color: Vec3, watts: float, loc: Vec3, rot: Vec3, size: float,
         scatter: bool = True) -> bpy.types.Object:
    """`scatter=False` keeps a fill light out of the fog, so only the key
    light draws shafts in it."""
    data = bpy.data.lights.new(name, "AREA")
    data.color = color
    data.energy = watts
    data.size = size
    obj = _place(link(bpy.data.objects.new(name, data)), loc, rot)
    obj.visible_volume_scatter = scatter
    return obj


def camera(loc: Vec3, look_at: Vec3, lens: float = 24.0) -> bpy.types.Object:
    data = bpy.data.cameras.new("Camera")
    data.lens = lens
    data.sensor_fit = "HORIZONTAL"
    data.sensor_width = 36.0
    data.clip_start = 0.1
    data.clip_end = 60.0
    cam = link(bpy.data.objects.new("Camera", data))
    cam.location = loc
    direction = Vector(look_at) - Vector(loc)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    return cam


def mirror_x(meta: dict, width: int = 1280) -> dict:
    """Mirror a finished room left to right, scene and description alike.

    For a room built the wrong way round for its compass: with the camera
    looking south into it, west is on the right, so a room whose builder put
    its west exit on the left is mirrored at the end of build() and returns
    this. Every top-level object is reflected through the YZ plane (location
    x negated, rotations about y and z negated, scale x negated, so its
    children follow); the camera moves to its mirror pose without a negative
    scale. The builder's floor coordinates, its screen-space zones and its
    key light are mirrored to match. Text would read backwards, so a room
    with kit.text in it cannot be mirrored this way.
    """
    for o in bpy.data.objects:
        if o.parent is not None:
            continue
        if o.type == "FONT":
            raise ValueError(f"{o.name}: text cannot be mirrored")
        o.location.x = -o.location.x
        o.rotation_mode = "XYZ"
        o.rotation_euler.y = -o.rotation_euler.y
        o.rotation_euler.z = -o.rotation_euler.z
        if o.type != "CAMERA":
            o.scale.x = -o.scale.x

    def flip(v):
        return [-v[0]] + list(v[1:]) if isinstance(v, (list, tuple)) and v and isinstance(v[0], (int, float)) else v

    out = dict(meta)
    walk = dict(meta.get("walk", {}))
    if "area" in walk:
        x0, x1, *rest = walk["area"]
        walk["area"] = [-x1, -x0] + rest
    walk["blocks"] = [[-b[1], -b[0]] + list(b[2:]) for b in walk.get("blocks", [])]
    out["walk"] = walk
    for key in ("points", "walkTo"):
        out[key] = {k: flip(v) for k, v in meta.get(key, {}).items()}
    zones = []
    for z in meta.get("zones", []):
        z = dict(z)
        if "rect" in z:
            x, y, w, h = z["rect"]
            z["rect"] = [width - x - w, y, w, h]
        zones.append(z)
    out["zones"] = zones
    lights = dict(meta.get("lights", {}))
    if "key" in lights and "dir" in lights["key"]:
        lights["key"] = dict(lights["key"], dir=flip(lights["key"]["dir"]))
    out["lights"] = lights
    out["mirrored"] = True
    return out


def screen_rect(objs: Iterable[bpy.types.Object], cam: bpy.types.Object, size: tuple[int, int] = (1280, 800),
                pad: int = 6) -> list[int]:
    """Where objects land on screen, as [x, y, w, h] in pixels from the top left.

    For a zone that must only be clickable sometimes (a hidden door): the
    hotspot pass is always live, so the door gets no hotspot of its own and
    the manifest names this rectangle instead, with a `when`.
    """
    from bpy_extras.object_utils import world_to_camera_view
    scene = bpy.context.scene
    scene.render.resolution_x, scene.render.resolution_y = size
    bpy.context.view_layer.update()
    xs, ys = [], []
    for obj in objs:
        for corner in obj.bound_box:
            p = world_to_camera_view(scene, cam, obj.matrix_world @ Vector(corner))
            xs.append(p.x * size[0])
            ys.append((1.0 - p.y) * size[1])
    x0, x1 = max(0, int(min(xs)) - pad), min(size[0], int(max(xs)) + pad)
    y0, y1 = max(0, int(min(ys)) - pad), min(size[1], int(max(ys)) + pad)
    return [x0, y0, x1 - x0, y1 - y0]


def world(color: Vec3, strength: float) -> None:
    w = bpy.data.worlds.new("World")
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*color, 1)
    bg.inputs["Strength"].default_value = strength
    bpy.context.scene.world = w


# Blender is Z-up; glTF and three.js are Y-up. One matrix, used everywhere.
TO_THREE = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))


def to_three(v: Vec3) -> list[float]:
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


# ---------------------------------------------------------------- underground dressing

def water(name: str, color: Vec3, rough: float = 0.05, ripple: float = 0.12) -> bpy.types.Material:
    """Still black water: a dark mirror with a slow ripple in the normal."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    bsdf = _principled(m)
    nt = m.node_tree
    _input(bsdf, ["Base Color"]).default_value = (*color, 1.0)
    _input(bsdf, ["Roughness"]).default_value = rough
    _input(bsdf, ["IOR"]).default_value = 1.33
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1.6
    noise.inputs["Detail"].default_value = 3.0
    nt.links.new(_object_coords(nt, (1.0, 2.5, 1.0)), noise.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = ripple
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], _input(bsdf, ["Normal"]))
    return m


def flame(name: str, loc: Vec3, watts: float = 40.0, color: Vec3 = (1.0, 0.52, 0.2),
          size: float = 1.0) -> list[bpy.types.Object]:
    """A small self-lit tongue of fire and the light it gives."""
    fire = solid("flame", (1.0, 0.6, 0.25), rough=1.0, emission=(1.0, 0.55, 0.2), strength=18.0)
    core = sphere(name, 0.045 * size, loc, fire, scale=(1.0, 1.0, 2.3), segments=10)
    lamp = point(name + ".light", color, watts, (loc[0], loc[1], loc[2] + 0.06 * size), radius=0.05 * size)
    return [core, lamp]


def torch(name: str, loc: Vec3, facing: Vec3 = (0.0, -1.0, 0.0), watts: float = 40.0) -> list[bpy.types.Object]:
    """An iron wall bracket holding a burning brand, leaning away from the
    wall along `facing` (a unit vector in the floor plane)."""
    iron = solid("iron", (0.05, 0.05, 0.055), rough=0.55, metal=0.85)
    pitchwood = wood("torch.wood", (0.16, 0.09, 0.04), (0.05, 0.03, 0.015), grain=20.0, along="Z")
    fx, fy = facing[0], facing[1]
    lean = (-fy * 18.0, fx * 18.0, 0.0)
    parts = [box(name + ".bracket", (0.08, 0.08, 0.14), loc, iron, bevel=0.005),
             cylinder(name + ".stick", 0.025, 0.42, (loc[0] + fx * 0.07, loc[1] + fy * 0.07, loc[2] + 0.12), pitchwood,
                      rot=lean, segments=10, radius2=0.035)]
    tip = (loc[0] + fx * 0.14, loc[1] + fy * 0.14, loc[2] + 0.38)
    return parts + flame(name + ".flame", tip, watts=watts)


def rock_line(prefix: str, start: Vec3, end: Vec3, count: int, rmin: float, rmax: float,
              mat: bpy.types.Material, seed: int, jitter: Vec3 = (0.2, 0.2, 0.2)) -> list[bpy.types.Object]:
    """Boulders strung from `start` to `end`: cave walls, roofs and rubble."""
    import random
    rng = random.Random(seed)
    out = []
    for i in range(count):
        t = i / max(1, count - 1)
        p = [a + (b - a) * t + rng.uniform(-j, j) for a, b, j in zip(start, end, jitter)]
        out.append(rock(f"{prefix}.{i}", rng.uniform(rmin, rmax), p, mat, seed=seed * 1000 + i))
    return out


def prism(name: str, outline: Sequence[tuple[float, float]], y0: float, y1: float,
          mat: bpy.types.Material | None) -> bpy.types.Object:
    """A polygon drawn in the X-Z plane (a gable, a ramp, a broken arch)
    extruded along Y from y0 to y1."""
    bm = bmesh.new()
    front = [bm.verts.new((x, y0, z)) for x, z in outline]
    back = [bm.verts.new((x, y1, z)) for x, z in outline]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], back[i], back[j], front[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _mesh_object(name, bm, mat)
