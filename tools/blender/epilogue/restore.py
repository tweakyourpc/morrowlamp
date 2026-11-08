"""Ashcombe restored: the morning after, for the epilogue film (story bible 6c).

Each function takes a room just built by its own builder and dresses it for
the film: the decay hidden (rubble, dust, mist, the holes in the roof), the
night swapped for daylight, and the repairs and new furniture added. They
work by object and material names from the builders, and place new things
with the builders' own constants, so a room that moves keeps its dressing.
"""
from __future__ import annotations

import math
import random

import bpy

import kit

SKY = (0.42, 0.58, 0.85)
SUN = (1.0, 0.93, 0.82)
WARM = (1.0, 0.78, 0.5)


# ---------------------------------------------------------------- helpers

def hide(*prefixes: str) -> None:
    for o in bpy.data.objects:
        if any(o.name == p or o.name.startswith(p) for p in prefixes):
            o.hide_render = True
            o.hide_viewport = True


def show(*prefixes: str) -> None:
    for o in bpy.data.objects:
        if any(o.name == p or o.name.startswith(p) for p in prefixes):
            o.hide_render = False
            o.hide_viewport = False


def swap(fragment: str, mat: bpy.types.Material) -> None:
    """Give every surface whose material name contains `fragment` a new material."""
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        for slot in o.material_slots:
            if slot.material and fragment in slot.material.name and slot.material is not mat:
                slot.material = mat


def material(name: str) -> bpy.types.Material:
    return bpy.data.materials[name]


def daylight(sun_dir: tuple, sun: float = 4.0, sky: float = 1.0, fills: tuple = ()) -> None:
    """Out with the moon and every lamp the night needed; in with the morning."""
    for o in list(bpy.data.objects):
        if o.type == "LIGHT":
            bpy.data.objects.remove(o, do_unlink=True)
    kit.world(SKY, sky)
    kit.sun("day.sun", SUN, sun, direction=sun_dir, angle=1.5)
    for k, (loc, rot, size, watts) in enumerate(fills):
        kit.area(f"day.fill.{k}", (1.0, 0.96, 0.9), watts, loc, rot, size, scatter=False)
    day_sky = kit.solid("day.sky", SKY, rough=1.0, emission=SKY, strength=1.6)
    swap("night", day_sky)
    swap("void", kit.solid("lived.in", (0.07, 0.055, 0.04), rough=0.9))


def plant(name: str, x: float, y: float, z: float = 0.0, s: float = 1.0, seed: int = 1) -> None:
    rng = random.Random(seed)
    pot = kit.solid("pot.fresh", (0.55, 0.25, 0.12), rough=0.6)
    leaf = kit.stone("foliage", (0.10, 0.30, 0.07), (0.03, 0.12, 0.03), scale=12.0, bump=0.2)
    kit.cylinder(f"{name}.pot", 0.18 * s, 0.32 * s, (x, y, z + 0.16 * s), pot, segments=18, radius2=0.22 * s)
    for k in range(5):
        kit.sphere(f"{name}.leaf.{k}", rng.uniform(0.16, 0.26) * s,
                   (x + rng.uniform(-0.12, 0.12) * s, y + rng.uniform(-0.12, 0.12) * s, z + (0.45 + rng.uniform(0, 0.35)) * s), leaf, segments=10)


def flowers(name: str, x: float, y: float, w: float, d: float, n: int, seed: int) -> None:
    rng = random.Random(seed)
    colours = [(0.8, 0.15, 0.2), (0.95, 0.75, 0.15), (0.75, 0.4, 0.85), (0.95, 0.95, 0.9), (0.95, 0.45, 0.2)]
    mats = [kit.solid(f"petal.{i}", c, rough=0.6, sheen=0.3) for i, c in enumerate(colours)]
    stem = kit.stone("foliage", (0.10, 0.30, 0.07), (0.03, 0.12, 0.03), scale=12.0, bump=0.2)
    for k in range(n):
        px, py = x + rng.uniform(-w / 2, w / 2), y + rng.uniform(-d / 2, d / 2)
        kit.sphere(f"{name}.bush.{k}", rng.uniform(0.12, 0.2), (px, py, 0.18), stem, segments=8)
        kit.sphere(f"{name}.bloom.{k}", rng.uniform(0.05, 0.08), (px, py, 0.32 + rng.uniform(0, 0.12)), rng.choice(mats), segments=8)


def rug(name: str, x: float, y: float, w: float, d: float, colour: tuple, rot: float = 0.0) -> None:
    kit.box(name, (w, d, 0.015), (x, y, 0.008), kit.stone(name + ".weave", colour, tuple(c * 0.55 for c in colour), scale=6.0, bump=0.05),
            rot=(0, 0, rot), bevel=0.005)


def floor_lamp(name: str, x: float, y: float) -> None:
    brass = kit.solid("lamp.brass", (0.7, 0.52, 0.25), rough=0.3, metal=1.0)
    shade = kit.solid("lamp.shade", (0.9, 0.82, 0.65), rough=0.8, emission=WARM, strength=3.0)
    kit.cylinder(f"{name}.base", 0.16, 0.03, (x, y, 0.015), brass, segments=20)
    kit.cylinder(f"{name}.pole", 0.015, 1.45, (x, y, 0.75), brass, segments=8)
    kit.cylinder(f"{name}.shade", 0.24, 0.3, (x, y, 1.55), shade, segments=24, radius2=0.15)
    kit.point(f"{name}.light", WARM, 60, (x, y, 1.45), radius=0.15)


def table_lamp(name: str, x: float, y: float, z: float) -> None:
    shade = kit.solid("lamp.shade", (0.9, 0.82, 0.65), rough=0.8, emission=WARM, strength=3.0)
    kit.cylinder(f"{name}.base", 0.07, 0.25, (x, y, z + 0.125), kit.solid("lamp.ceramic", (0.2, 0.32, 0.4), rough=0.3), segments=16)
    kit.cylinder(f"{name}.shade", 0.15, 0.2, (x, y, z + 0.35), shade, segments=20, radius2=0.1)
    kit.point(f"{name}.light", WARM, 25, (x, y, z + 0.32), radius=0.08)


def armchair(name: str, x: float, y: float, rot: float, colour: tuple = (0.18, 0.28, 0.22)) -> None:
    cloth = kit.solid(name + ".cloth", colour, rough=0.85, sheen=0.5)
    parts = [kit.box(f"{name}.seat", (0.8, 0.8, 0.42), (0, 0, 0.21), cloth, bevel=0.06),
             kit.box(f"{name}.back", (0.8, 0.2, 0.55), (0, 0.32, 0.65), cloth, bevel=0.06)]
    for side in (-1, 1):
        parts.append(kit.box(f"{name}.arm.{side}", (0.16, 0.8, 0.3), (side * 0.36, 0, 0.55), cloth, bevel=0.05))
    pivot = kit.empty(name, (0, 0, 0))
    kit.parent(parts, pivot)
    pivot.location = (x, y, 0)
    pivot.rotation_euler = (0, 0, math.radians(rot))


def staircase() -> None:
    """The hall's grand staircase, rebuilt properly: a closed, panelled flight
    of oak treads and painted risers with a runner up the middle, a full
    balustrade on the open side, newel posts, and the landing at the top.
    Same footprint as the builder's broken one (rooms/hall.py)."""
    sx0, n, run, rise = -2.3, 13, 0.24, 0.2
    y_open, y_wall, yc, width = 2.6, 3.9, 3.25, 1.3
    oak = kit.wood("stair.oak.new", (0.36, 0.22, 0.11), (0.20, 0.12, 0.06), grain=10.0, rough=0.35)
    paint = kit.solid("stair.paint", (0.82, 0.80, 0.74), rough=0.5)
    carpet = kit.stone("stair.runner", (0.42, 0.06, 0.07), (0.22, 0.03, 0.04), scale=14.0, bump=0.1)
    angle = math.degrees(math.atan2(rise, run))
    top_x = sx0 - (n - 1) * run
    for i in range(n):
        x, z = sx0 - i * run, (i + 1) * rise
        kit.box(f"newstair.tread.{i}", (run + 0.03, width, 0.04), (x, yc, z - 0.02), oak, bevel=0.008)
        kit.box(f"newstair.riser.{i}", (0.02, width - 0.02, rise - 0.04), (x + run / 2, yc, z - rise / 2 - 0.02), paint)
        kit.box(f"newstair.runner.{i}", (run + 0.035, 0.72, 0.008), (x, yc, z + 0.004), carpet)
        kit.box(f"newstair.runner.rise.{i}", (0.008, 0.72, rise - 0.04), (x + run / 2 + 0.012, yc, z - rise / 2 - 0.02), carpet)
        kit.cylinder(f"newstair.baluster.{i}", 0.018, 0.86, (x, y_open + 0.06, z + 0.43), paint, segments=10)
    # Closed underneath, in panelling: no gaps left to fall through.
    foot, head = sx0 + run / 2, top_x - run / 2
    kit.prism("newstair.side", [(foot, 0.0), (head, 0.0), (head, n * rise - 0.04)], y_open, y_wall, material("wainscot"))
    kit.box("newstair.string", (math.hypot(foot - head, n * rise) + 0.1, 0.06, 0.26), ((foot + head) / 2, y_open, n * rise / 2 - 0.02),
            paint, rot=(0, angle, 0))
    rail_len = math.hypot(foot - head, n * rise)
    kit.box("newstair.rail", (rail_len, 0.08, 0.07), ((foot + head) / 2 - 0.05, y_open + 0.06, n * rise / 2 + 0.9), oak, rot=(0, angle, 0), bevel=0.01)
    for k, (x, z) in enumerate(((sx0 + 0.1, 0.0), (top_x - 0.08, n * rise))):
        kit.box(f"newstair.newel.{k}", (0.14, 0.14, 1.15), (x, y_open + 0.06, z + 0.575), oak, bevel=0.012)
        kit.sphere(f"newstair.newel.cap.{k}", 0.1, (x, y_open + 0.06, z + 1.2), oak, segments=14)
    kit.box("newstair.landing", (0.8, width + 0.2, 0.12), (top_x - 0.3, yc, n * rise - 0.06), oak, bevel=0.01)
    kit.box("newstair.landing.rail", (0.45, 0.07, 0.07), (top_x - 0.3, y_open + 0.06, n * rise + 0.9), oak)
    for k in range(3):
        kit.cylinder(f"newstair.landing.baluster.{k}", 0.018, 0.86, (top_x - 0.18 - k * 0.14, y_open + 0.06, n * rise + 0.43), paint, segments=10)


# ---------------------------------------------------------------- rooms

def yard(m) -> None:
    hide("mist")
    daylight((-0.45, 0.7, -0.55), sun=4.5, sky=1.1)
    wx, wy = m.WELL
    kit.cylinder("well.lid", m.WELL_R + 0.2, 0.07, (wx, wy, 0.76), kit.wood("lid.oak", (0.32, 0.2, 0.1), (0.16, 0.1, 0.05), grain=12.0), segments=32)
    for k, (x0, x1) in enumerate(((-m.HALF + 0.4, -1.1), (1.1, m.HALF - 0.4))):
        flowers(f"yard.bed.{k}", (x0 + x1) / 2, m.FACADE - 0.6, x1 - x0, 0.7, 26, seed=10 + k)


def porch(m) -> None:
    hide("mist")
    daylight((-0.4, 0.7, -0.5), sun=4.0, sky=1.0, fills=(((0, 0.0, m.ROOF - 0.2), (0, 0, 0), 4.0, 120),))
    mat = kit.box("doormat.new", (1.1, 0.64, 0.025), (m.DOOR_X, 1.78, 0.012), material("coir"), rot=(0, 0, 1.5), bevel=0.01)
    mat.hide_render = False
    kit.text("doormat.new.word", "WELCOME", 0.12, (m.DOOR_X, 1.78, 0.027), material("mat.letters"), rot=(0, 0, 1.5))
    for side in (-1, 1):
        plant(f"porch.plant.{side}", m.DOOR_X + side * 1.15, m.WALL - 0.35, s=1.2, seed=20 + side)


def hall(m) -> None:
    hide("rubble", "dust", "rope.", "stair.", "baluster.", "handrail", "landing", "banister")
    daylight((0.25, -0.15, -1.0), sun=6.0, sky=0.8,
             fills=(((0, -5.5, 3.5), (60, 0, 0), 5.0, 520), ((0, 0.5, m.CEIL - 0.3), (0, 0, 0), 5.0, 300)))
    staircase()
    # The regalia, home at last, on their six plinths.
    gold = kit.solid("regalia.gold", (0.85, 0.62, 0.2), rough=0.2, metal=1.0)
    jade = kit.solid("regalia.jade", (0.1, 0.5, 0.3), rough=0.15)
    opal = kit.solid("regalia.opal", (0.6, 0.7, 0.85), rough=0.1, emission=(0.4, 0.55, 0.9), strength=0.6)
    sunlit = kit.solid("regalia.sunstone", (1.0, 0.7, 0.3), rough=0.2, emission=(1.0, 0.65, 0.25), strength=6.0)
    cy, top = 3.62, 0.98
    xs = [-2.1 + 0.36 + i * ((4.2 - 0.72) / 5) for i in range(6)]
    kit.torus("regalia.crown", 0.1, 0.022, (xs[0], cy, top + 0.04), gold)
    for k in range(6):
        a = k / 6 * math.tau
        kit.cylinder(f"regalia.crown.spike.{k}", 0.012, 0.09, (xs[0] + math.cos(a) * 0.1, cy + math.sin(a) * 0.1, top + 0.1), gold, segments=6, radius2=0.002)
    kit.cylinder("regalia.scepter", 0.014, 0.5, (xs[1], cy, top + 0.25), gold, rot=(0, 12, 0), segments=10)
    kit.sphere("regalia.scepter.jade", 0.045, (xs[1] + 0.05, cy, top + 0.5), jade)
    kit.cylinder("regalia.chalice.foot", 0.06, 0.02, (xs[2], cy, top + 0.01), gold, segments=20)
    kit.cylinder("regalia.chalice.stem", 0.014, 0.12, (xs[2], cy, top + 0.08), gold, segments=10)
    kit.cylinder("regalia.chalice.cup", 0.03, 0.12, (xs[2], cy, top + 0.2), gold, segments=20, radius2=0.07)
    kit.sphere("regalia.idol", 0.08, (xs[3], cy, top + 0.12), opal, scale=(0.8, 0.8, 1.4))
    ring = kit.torus("regalia.ring", 0.04, 0.01, (xs[4], cy, top + 0.05), gold)
    ring.rotation_euler = (math.radians(90), 0, 0)
    kit.sphere("regalia.ring.seal", 0.018, (xs[4], cy - 0.01, top + 0.09), kit.solid("signet", (0.05, 0.08, 0.3), rough=0.05))
    kit.sphere("regalia.sunstone", 0.08, (xs[5], cy, top + 0.09), sunlit)
    kit.point("cabinet.glow", WARM, 40, (0, cy - 0.1, 2.0), radius=0.3)
    # The chandelier, with candles in it again.
    flame = kit.solid("candle.flame", (1.0, 0.8, 0.5), rough=0.5, emission=(1.0, 0.7, 0.35), strength=12.0)
    for k in range(8):
        a = k / 8 * math.tau
        kit.sphere(f"chandelier.flame.{k}", 0.025, (math.cos(a) * 0.62, 1.6 + math.sin(a) * 0.62, 3.88), flame, segments=8)
    kit.point("chandelier.light", WARM, 160, (0, 1.6, 3.7), radius=0.5)
    rug("hall.rug", 0.0, 0.6, 4.0, 2.6, (0.45, 0.1, 0.08))


def study(m) -> None:
    hide("dust")
    daylight((-0.2, -0.8, -0.55), sun=4.0, sky=0.8,
             fills=(((0, -5.5, 3.0), (60, 0, 0), 5.0, 420), (((m.WIN[0] + m.WIN[1]) / 2, m.NORTH + 1.2, 2.0), (-60, 0, 0), 1.6, 700)))
    armchair("study.chair", m.HEARTH_X + 1.8, 1.4, 200)
    floor_lamp("study.lamp", m.HEARTH_X + 2.5, 2.1)
    dx, dy = m.DESK
    table_lamp("study.desklamp", dx - 0.5, dy, 0.8)
    plant("study.plant", -1.3, m.NORTH - 0.5, s=1.1, seed=31)
    ember = kit.solid("ember", (1.0, 0.4, 0.1), rough=0.5, emission=(1.0, 0.35, 0.08), strength=8.0)
    for k in range(3):
        kit.cylinder(f"hearth.log.{k}", 0.06, 0.6, (m.HEARTH_X - 0.2 + k * 0.2, m.NORTH - 0.55, 0.12 + (k % 2) * 0.08), ember,
                     rot=(0, 90, 20 * (k - 1)), segments=10)
    kit.point("hearth.fire", (1.0, 0.5, 0.2), 120, (m.HEARTH_X, m.NORTH - 0.8, 0.45), radius=0.3)


def kitchen(m) -> None:
    hide("dust", "table.", "bench", "board", "knife", "loaf", "crumb", "bucket")
    daylight((0.2, -0.7, -0.6), sun=4.0, sky=0.9,
             fills=(((0, -5.5, 3.0), (60, 0, 0), 5.0, 420), (((m.WIN[0] + m.WIN[1]) / 2, m.NORTH + 1.2, 2.2), (-60, 0, 0), 1.6, 600)))
    tx, ty = m.TABLE
    kit.box("island.base", (2.4, 0.9, 0.86), (tx, ty, 0.43), kit.solid("island.green", (0.08, 0.16, 0.12), rough=0.5), bevel=0.01)
    kit.box("island.top", (2.55, 1.02, 0.05), (tx, ty, 0.885), kit.solid("marble", (0.85, 0.85, 0.82), rough=0.18), bevel=0.01)
    glow = kit.solid("pendant.bulb", (1.0, 0.9, 0.7), rough=0.4, emission=WARM, strength=10.0)
    shade = kit.solid("pendant.shade", (0.06, 0.06, 0.06), rough=0.4, metal=0.6)
    for k, x in enumerate((tx - 0.9, tx, tx + 0.9)):
        kit.cylinder(f"pendant.cord.{k}", 0.006, m.CEIL - 2.5, (x, ty, (m.CEIL + 2.5) / 2), shade, segments=6)
        kit.cylinder(f"pendant.shade.{k}", 0.05, 0.22, (x, ty, 2.4), shade, segments=20, radius2=0.18)
        kit.sphere(f"pendant.bulb.{k}", 0.05, (x, ty, 2.32), glow, segments=10)
        kit.point(f"pendant.light.{k}", WARM, 45, (x, ty, 2.25), radius=0.08)
    wood = kit.wood("stool.oak", (0.32, 0.2, 0.1), (0.16, 0.1, 0.05), grain=12.0)
    for k, x in enumerate((tx - 0.8, tx, tx + 0.8)):
        kit.cylinder(f"stool.seat.{k}", 0.18, 0.05, (x, ty - 0.85, 0.66), wood, segments=20)
        kit.cylinder(f"stool.leg.{k}", 0.025, 0.64, (x, ty - 0.85, 0.32), shade, segments=8)
    leaf = bpy.data.objects.get("back.leaf")
    if leaf:
        leaf.rotation_euler = (0, 0, math.radians(-105))
    wx = (m.WIN[0] + m.WIN[1]) / 2
    for k, x in enumerate((wx - 0.45, wx + 0.45)):
        plant(f"kitchen.sill.{k}", x, m.NORTH - 0.12, z=m.WIN[2], s=0.6, seed=40 + k)


def grandmotherRoom(m) -> None:
    hide("hole.lath", "hole.slate", "roof.rubble", "dust", "ladder.", "cylinder.", "verse.")
    daylight((0.3, 0.25, -1.0), sun=6.0, sky=1.0, fills=(((0, -5.0, 2.6), (65, 0, 0), 4.0, 300),))
    hx0, hx1, hy0, hy1 = m.HOLE
    slope = math.degrees(math.atan2(m.RIDGE - m.EAVE, m.W))
    cx = (hx0 + hx1) / 2
    kit.box("skylight", ((hx1 - hx0) / math.cos(math.radians(slope)) + 0.05, hy1 - hy0 + 0.05, 0.02), (cx, (hy0 + hy1) / 2, m.roof_z(cx) + 0.05),
            kit.glass("skylight.glass", (0.95, 0.97, 0.97), rough=0.02), rot=(0, -slope, 0))
    swap("quilt", kit.stone("quilt.new", (0.30, 0.42, 0.58), (0.20, 0.28, 0.40), scale=9.0, bump=0.1))
    swap("linen", kit.solid("linen.new", (0.85, 0.84, 0.8), rough=0.9, sheen=0.4))
    # The bed is at the front left and the stairwell at the back left: the rug and the
    # bedside table keep to the bed's side of the room.
    rug("bedroom.rug", -0.9, -1.3, 1.4, 2.0, (0.55, 0.42, 0.28))
    oak = material("bedroom.oak")
    kit.box("bedside", (0.45, 0.4, 0.55), (-1.9, -0.3, 0.275), oak, bevel=0.01)
    table_lamp("bedside.lamp", -1.9, -0.3, 0.55)
    plant("bedroom.plant", 3.3, 2.6, s=1.0, seed=51)
    vase = kit.cylinder("table.vase", 0.06, 0.2, (2.0, 1.95, 0.89), kit.solid("vase", (0.2, 0.35, 0.5), rough=0.2), segments=16)
    vase.hide_render = False
    flowers("table.posy", 2.0, 1.95, 0.12, 0.12, 4, seed=52)
    for o in bpy.data.objects:
        if o.name.startswith("table.posy"):
            o.location.z += 0.72
    kit.box("picture.frame", (0.9, 0.04, 0.65), (0.0, m.NORTH - 0.02, 1.3), material("rafter"), bevel=0.01)
    kit.box("picture.canvas", (0.78, 0.02, 0.53), (0.0, m.NORTH - 0.05, 1.3), kit.stone("painting", (0.45, 0.55, 0.65), (0.25, 0.3, 0.2), scale=3.0))


def kitchenGarden(m) -> None:
    hide("hole.", "fallen.slate", "mist", "ladder.")
    # Before daylight(), whose night-to-day swap would otherwise take the lawn for sky.
    swap("grass.night", kit.stone("lawn", (0.14, 0.32, 0.07), (0.07, 0.2, 0.04), scale=30.0, bump=0.2))
    daylight((0.5, 0.6, -0.55), sun=4.5, sky=1.1)
    # The roof mended: the gable whole again, and the west slope uncut.
    kit.prism("gable.mended", [(-m.HALF, m.EAVES), (m.HALF, m.EAVES), (0.0, m.RIDGE)], m.WALL - 0.01, m.WALL + 0.5, material("back.wall"))
    west = bpy.data.objects.get("roof.1")
    if west and "hole" in west.modifiers:
        west.modifiers.remove(west.modifiers["hole"])
    swap("leaves", kit.stone("leaves.day", (0.12, 0.30, 0.08), (0.04, 0.14, 0.03), scale=18.0))
    swap("yew", kit.stone("yew.day", (0.06, 0.16, 0.06), (0.02, 0.07, 0.025), scale=14.0))
    for k, (bx, by) in enumerate(((3.2, 1.0), (0.0, 1.0), (3.0, 3.4), (-0.4, 3.4))):   # as kitchenGarden.py has the beds
        flowers(f"garden.bed.{k}", bx, by, 2.2, 1.1, 14, seed=60 + k)
    leaf = bpy.data.objects.get("door.leaf")
    if leaf:
        leaf.rotation_euler = (0, 0, math.radians(100))


def glasshouse(m) -> None:
    hide("pane.", "shard.", "vine.", "haze", "ladder.")
    swap("garden.night", kit.solid("garden.day", (0.2, 0.4, 0.15), rough=1.0, emission=(0.25, 0.45, 0.2), strength=1.2))
    daylight((0.3, 0.5, -0.8), sun=5.0, sky=1.2, fills=(((0, -5.5, 2.4), (65, 0, 0), 4.0, 150),))
    glass = kit.glass("pane.clean", (0.92, 0.96, 0.94), rough=0.03)
    angle = math.degrees(math.atan2(m.RIDGE - m.EAVE, m.W))
    run = math.hypot(m.W, m.RIDGE - m.EAVE)
    bays = [m.SOUTH + 1.0 + k * 1.3 for k in range(9)]
    for i, y in enumerate(bays[:-1]):
        for x in (-m.W, m.W):
            kit.box(f"glazed.side.{x}.{i}", (0.01, 1.25, m.EAVE - 0.65), (x, y + 0.65, (m.EAVE + 0.6) / 2), glass)
        for side in (-1, 1):
            kit.box(f"glazed.roof.{side}.{i}", (run, 1.25, 0.01), (side * m.W / 2, y + 0.65, (m.EAVE + m.RIDGE) / 2 + 0.02), glass,
                    rot=(0, side * angle, 0))
    for o in list(bpy.data.objects):
        if o.name.startswith("pot.") and not o.name.startswith("pot.stack"):
            plant(f"bench.{o.name}", o.location.x, o.location.y, z=o.location.z + 0.05, s=0.5, seed=sum(map(ord, o.name)))   # stable across builds, unlike hash()
    for k, (x, y) in enumerate(((-2.6, -1.5), (2.6, -1.2), (-2.7, 1.3), (2.7, 1.6))):
        plant(f"glasshouse.plant.{k}", x, y, s=1.3, seed=70 + k)
    flowers("glasshouse.bloom", 0.0, m.NORTH - 0.55, 4.4, 0.5, 10, seed=75)
    for o in bpy.data.objects:
        if o.name.startswith("glasshouse.bloom"):
            o.location.z += 0.9


RESTORE = {"yard": yard, "porch": porch, "hall": hall, "study": study, "kitchen": kitchen,
           "grandmotherRoom": grandmotherRoom, "kitchenGarden": kitchenGarden, "glasshouse": glasshouse}
