"""The Entrance Hall of Ashcombe, at night.

Composition follows the EGA painter in js/scenes.js (the long cabinet on
the north wall, the clock to its right, the chandelier overhead, the
trapdoor in the foreground, doors east and west) so the room reads as the
same place. The staircase climbs to a stairwell in the ceiling, up into the
grandmother's room under the eaves; the only hole in the roof is up there,
so what comes down the stairwell is that room's moonlight, and dust hangs
in it.
"""
from __future__ import annotations

import math
import random

import kit

W = 5.5          # half-width of the hall
NORTH = 4.0      # north wall plane
SOUTH = -7.5     # south wall, behind the camera
CEIL = 5.2
# The west door stands forward of the staircase; the east one opens on the kitchen passage.
DOORS = {"w": (1.45, 2.55), "e": (1.9, 3.3)}
DOOR_H = 2.6

HOTSPOTS = {
    "floor": 1,
    "cabinet": 2,
    "clock": 3,
    "chandelier": 4,
    "hatch": 5,
    "brassKey": 6,
    "musicSheet": 7,
    "exit:w": 8,
    "exit:e": 9,
    "stairs": 10,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(41)

    oak = kit.planks("floor.oak", (0.20, 0.11, 0.055), (0.13, 0.07, 0.035))
    panel = kit.wood("wainscot", (0.16, 0.085, 0.04), (0.07, 0.035, 0.018), grain=16.0, along="Z")
    trim = kit.wood("trim", (0.22, 0.12, 0.06), (0.10, 0.05, 0.025), grain=9.0)
    paper = kit.wallpaper("wallpaper", (0.20, 0.25, 0.20), (0.32, 0.30, 0.20), (0.10, 0.10, 0.07))
    plaster = kit.stone("plaster", (0.30, 0.29, 0.26), (0.16, 0.15, 0.13), scale=2.0)
    rubble_mat = kit.stone("rubble", (0.34, 0.32, 0.29), (0.12, 0.11, 0.10), scale=6.0)
    brass = kit.solid("brass", (0.62, 0.43, 0.17), rough=0.32, metal=1.0)
    iron = kit.solid("iron", (0.05, 0.05, 0.055), rough=0.55, metal=0.85)
    velvet = kit.solid("velvet", (0.28, 0.02, 0.04), rough=0.9, sheen=0.8)
    ivory = kit.solid("ivory", (0.62, 0.58, 0.47), rough=0.45)
    black = kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)
    wax = kit.solid("wax", (0.70, 0.66, 0.55), rough=0.5)
    paper_sheet = kit.solid("music.paper", (0.66, 0.62, 0.52), rough=0.7)
    crystal = kit.glass("crystal", (0.95, 0.97, 1.0), rough=0.02)
    pane = kit.glass("pane", (0.9, 0.93, 0.92), rough=0.06)

    # ---------------- shell
    kit.hotspot([kit.box("floor", (2 * W, NORTH - SOUTH, 0.1), (0, (NORTH + SOUTH) / 2, -0.05), oak)], HOTSPOTS["floor"])
    hatch_hole = (-0.8, 0.8, -1.6, -0.4)
    # The floor needs a real hole under the trapdoor.
    floor = kit.room_collection().objects["floor"]
    floor.select_set(False)
    cutter = kit.box("hatch.cut", (1.6, 1.2, 0.4), (0, -1.0, 0), None)
    mod = floor.modifiers.new("hatch", "BOOLEAN")
    mod.object = cutter
    mod.operation = "DIFFERENCE"
    cutter.hide_render = True
    cutter.hide_viewport = True

    kit.box("ceiling", (2 * W, NORTH - SOUTH, 0.2), (0, (NORTH + SOUTH) / 2, CEIL + 0.1), plaster)
    # The stairwell: the stairs go up through the ceiling here, into the room under the eaves.
    roof_hole = kit.box("stairwell", (1.8, 1.6, 0.6), (-3.8, 2.2, CEIL + 0.1), None)
    ceil = kit.room_collection().objects["ceiling"]
    m = ceil.modifiers.new("hole", "BOOLEAN")
    m.object = roof_hole
    m.operation = "DIFFERENCE"
    roof_hole.hide_render = True
    roof_hole.hide_viewport = True
    for i in range(7):
        y = SOUTH + 1.2 + i * 1.6
        if -4.2 < y < -2.0 or 1.5 < y < 3.0:
            continue
        kit.box(f"beam.{i}", (2 * W, 0.28, 0.32), (0, y, CEIL - 0.16), trim, bevel=0.01)

    # North wall: wainscot below, paper above, crown moulding.
    kit.box("north.paper", (2 * W, 0.1, CEIL), (0, NORTH + 0.05, CEIL / 2), paper)
    kit.box("north.wainscot", (2 * W, 0.06, 1.1), (0, NORTH - 0.03, 0.55), panel)
    kit.box("north.rail", (2 * W, 0.1, 0.07), (0, NORTH - 0.05, 1.12), trim, bevel=0.01)
    kit.box("north.crown", (2 * W, 0.18, 0.2), (0, NORTH - 0.09, CEIL - 0.1), trim, bevel=0.02)
    kit.box("south.wall", (2 * W, 0.1, CEIL), (0, SOUTH, CEIL / 2), paper)

    for side, x in (("w", -W), ("e", W)):
        DOOR_Y = DOORS[side]
        opening = [(DOOR_Y[0], DOOR_Y[1], 0.0, DOOR_H)]
        sign = 1 if x < 0 else -1          # +1 points into the room from this wall
        kit.wall_with_openings(f"{side}.paper", SOUTH, NORTH, CEIL, 0.1, opening, paper, "Y", x - sign * 0.05)
        kit.wall_with_openings(f"{side}.wainscot", SOUTH, NORTH, 1.1, 0.06, opening, panel, "Y", x + sign * 0.03)
        # Door frame and a dim corridor beyond.
        for y in DOOR_Y:
            kit.box(f"{side}.jamb.{y}", (0.22, 0.12, DOOR_H + 0.1), (x + sign * 0.05, y, (DOOR_H + 0.1) / 2), trim, bevel=0.015)
        kit.box(f"{side}.lintel", (0.24, DOOR_Y[1] - DOOR_Y[0] + 0.24, 0.22), (x + sign * 0.05, sum(DOOR_Y) / 2, DOOR_H + 0.11), trim, bevel=0.015)
        corridor = [
            kit.box(f"{side}.corr.floor", (3.0, 1.6, 0.1), (x - sign * 1.5, sum(DOOR_Y) / 2, -0.05), oak),
            kit.box(f"{side}.corr.back", (0.1, 1.6, 3.0), (x - sign * 3.0, sum(DOOR_Y) / 2, 1.5), paper),
            kit.box(f"{side}.corr.l", (3.0, 0.1, 3.0), (x - sign * 1.5, DOOR_Y[0] - 0.05, 1.5), paper),
            kit.box(f"{side}.corr.r", (3.0, 0.1, 3.0), (x - sign * 1.5, DOOR_Y[1] + 0.05, 1.5), paper),
            kit.box(f"{side}.corr.top", (3.0, 1.6, 0.1), (x - sign * 1.5, sum(DOOR_Y) / 2, 2.8), plaster),
        ]
        # The open door itself, swung back into the corridor.
        leaf = kit.box(f"{side}.door", (0.06, DOOR_Y[1] - DOOR_Y[0] - 0.1, DOOR_H - 0.05), (x - sign * 0.05, DOOR_Y[0] + 0.05, DOOR_H / 2), panel,
                       pivot=(0, -1, 0), bevel=0.01)
        leaf.rotation_euler = (0, 0, math.radians(70 * sign))
        kit.hotspot(corridor + [leaf], HOTSPOTS["exit:" + side])

    # ---------------- the long glass cabinet
    cab = []
    cx0, cx1, cy = -2.1, 2.1, 3.62
    cab.append(kit.box("cab.base", (cx1 - cx0, 0.62, 0.82), (0, cy, 0.41), trim, bevel=0.02))
    for i in range(4):
        x = cx0 + 0.55 + i * ((cx1 - cx0 - 1.1) / 3)
        cab.append(kit.box(f"cab.panel.{i}", (0.8, 0.02, 0.45), (x, cy - 0.32, 0.42), panel, bevel=0.008))
    cab.append(kit.box("cab.floor", (cx1 - cx0 - 0.08, 0.56, 0.04), (0, cy, 0.84), velvet))
    cab.append(kit.box("cab.back", (cx1 - cx0 - 0.08, 0.03, 1.3), (0, cy + 0.28, 1.5), velvet))
    cab.append(kit.box("cab.glass.front", (cx1 - cx0 - 0.08, 0.012, 1.3), (0, cy - 0.29, 1.5), pane))
    for x in (cx0 + 0.04, cx1 - 0.04):
        cab.append(kit.box(f"cab.glass.side.{x}", (0.012, 0.56, 1.3), (x, cy, 1.5), pane))
    cab.append(kit.box("cab.glass.top", (cx1 - cx0 - 0.08, 0.56, 0.012), (0, cy, 2.15), pane))
    for i in range(7):
        x = cx0 + 0.03 + i * ((cx1 - cx0 - 0.06) / 6)
        cab.append(kit.box(f"cab.mullion.{i}", (0.05, 0.05, 1.32), (x, cy - 0.29, 1.5), trim))
    cab.append(kit.box("cab.cornice", (cx1 - cx0 + 0.12, 0.72, 0.16), (0, cy, 2.24), trim, bevel=0.02))
    for i in range(6):
        x = cx0 + 0.36 + i * ((cx1 - cx0 - 0.72) / 5)
        cab.append(kit.cylinder(f"cab.plinth.{i}", 0.13, 0.12, (x, cy, 0.92), velvet, segments=20))
        cab.append(kit.box(f"cab.plaque.{i}", (0.16, 0.01, 0.05), (x, cy - 0.33, 0.72), brass, bevel=0.003))
    kit.hotspot(cab, HOTSPOTS["cabinet"])

    # ---------------- grandfather clock, stopped at 9:41 (the time every iPhone keynote shows)
    clk = []
    kx, ky = 3.95, 3.7
    clk.append(kit.box("clock.plinth", (0.62, 0.42, 0.5), (kx, ky, 0.25), trim, bevel=0.015))
    # The waist is a hollow case, so the open door shows what it kept.
    clk.append(kit.box("clock.waist.back", (0.48, 0.04, 1.25), (kx, ky + 0.15, 1.12), panel))
    for sx in (-0.22, 0.22):
        clk.append(kit.box(f"clock.waist.side.{sx}", (0.04, 0.34, 1.25), (kx + sx, ky, 1.12), panel, bevel=0.008))
    clk.append(kit.box("clock.waist.sill", (0.48, 0.34, 0.06), (kx, ky, 0.53), trim, bevel=0.008))
    clk.append(kit.box("clock.hood", (0.6, 0.42, 0.62), (kx, ky, 2.06), trim, bevel=0.015))
    clk.append(kit.box("clock.crest", (0.66, 0.46, 0.08), (kx, ky, 2.41), trim, bevel=0.02))
    face = kit.cylinder("clock.face", 0.23, 0.02, (kx, ky - 0.22, 2.06), ivory, rot=(90, 0, 0), segments=40)
    clk.append(face)
    clk.append(kit.cylinder("clock.bezel", 0.25, 0.015, (kx, ky - 0.215, 2.06), brass, rot=(90, 0, 0), segments=40))
    for h in range(12):
        a = math.radians(h * 30)
        clk.append(kit.box(f"clock.tick.{h}", (0.012, 0.004, 0.04),
                           (kx + math.sin(a) * 0.19, ky - 0.235, 2.06 + math.cos(a) * 0.19), iron, rot=(0, math.degrees(a), 0)))
    for name, length, angle in (("hour", 0.12, (9 + 41 / 60) * 30), ("minute", 0.18, 41 * 6)):
        a = math.radians(angle)
        clk.append(kit.box(f"clock.{name}", (0.014, 0.004, length),
                           (kx + math.sin(a) * length / 2, ky - 0.24, 2.06 + math.cos(a) * length / 2), iron, rot=(0, angle, 0)))
    # The waist door hinges on its left edge. Inside: the key and the music.
    door = kit.box("clock.door", (0.36, 0.03, 0.95), (kx - 0.18, ky - 0.185, 1.12), trim, pivot=(-1, 0, 0), bevel=0.008)
    door_glass = kit.box("clock.door.glass", (0.24, 0.01, 0.7), (kx, ky - 0.205, 1.12), pane)
    kit.parent([door_glass], door)
    clk += [door, door_glass]
    clk.append(kit.box("clock.cavity", (0.38, 0.02, 0.95), (kx, ky + 0.125, 1.12), black))
    clk.append(kit.box("clock.shelf", (0.36, 0.22, 0.02), (kx, ky - 0.02, 0.9), trim))
    pend = kit.cylinder("clock.pendulum", 0.07, 0.015, (kx, ky - 0.02, 1.05), brass, rot=(90, 0, 0), segments=24)
    rod = kit.box("clock.rod", (0.012, 0.01, 0.42), (kx, ky - 0.02, 1.28), brass)
    clk += [pend, rod]
    kit.hotspot(clk, HOTSPOTS["clock"])

    key_parts = [
        kit.cylinder("key.bow", 0.028, 0.008, (kx - 0.09, ky - 0.06, 0.915), brass, rot=(0, 0, 0), segments=16),
        kit.box("key.shank", (0.09, 0.012, 0.008), (kx - 0.03, ky - 0.06, 0.915), brass),
        kit.box("key.bit", (0.014, 0.03, 0.008), (kx + 0.005, ky - 0.05, 0.915), brass),
    ]
    sheet = kit.box("music.sheet", (0.14, 0.1, 0.012), (kx + 0.09, ky - 0.04, 0.917), paper_sheet, rot=(0, 0, 8))
    kit.hotspot(key_parts, HOTSPOTS["brassKey"])
    kit.hotspot([sheet], HOTSPOTS["musicSheet"])

    # ---------------- chandelier, slumped, a few crystals left
    chain = kit.cylinder("chandelier.chain", 0.012, CEIL - 3.75, (0, 1.6, (CEIL + 3.75) / 2), iron, segments=8)
    hub = kit.empty("chandelier", (0, 1.6, 3.75))
    parts = [kit.torus("chandelier.ring", 0.62, 0.025, (0, 1.6, 3.75), brass),
             kit.torus("chandelier.ring.inner", 0.3, 0.018, (0, 1.6, 3.7), brass)]
    for i in range(4):
        a = i / 4 * math.tau
        parts.append(kit.box(f"chandelier.spoke.{i}", (0.62, 0.02, 0.02), (math.cos(a) * 0.31, 1.6 + math.sin(a) * 0.31, 3.72),
                             brass, rot=(0, 0, math.degrees(a))))
    parts += [
             kit.sphere("chandelier.boss", 0.12, (0, 1.6, 3.65), brass, scale=(1, 1, 1.4))]
    for i in range(8):
        a = i / 8 * math.tau
        x, y = math.cos(a) * 0.62, 1.6 + math.sin(a) * 0.62
        parts.append(kit.cylinder(f"chandelier.cup.{i}", 0.045, 0.04, (x, y, 3.79), brass, segments=12, radius2=0.03))
        if i % 3 != 1:
            parts.append(kit.cylinder(f"chandelier.candle.{i}", 0.022, 0.07 + rng.random() * 0.1, (x, y, 3.86), wax, segments=10))
        if i in (0, 3, 5):
            parts.append(kit.sphere(f"chandelier.crystal.{i}", 0.035, (x, y, 3.62 - rng.random() * 0.1), crystal, scale=(0.6, 0.6, 1.6), segments=8))
    kit.parent(parts, hub)
    hub.rotation_euler = (math.radians(9), math.radians(-6), 0)      # slumped, the way it was described
    kit.hotspot([chain] + parts, HOTSPOTS["chandelier"])

    # ---------------- the cellar trapdoor, hinged at its north edge
    lid = kit.box("hatch.lid", (1.6, 1.2, 0.06), (0, hatch_hole[3], 0.0), kit.planks("hatch.boards", (0.17, 0.09, 0.045), (0.11, 0.06, 0.03), width=0.2, length=1.2),
                  pivot=(0, 1, 0), bevel=0.01)
    ring = kit.cylinder("hatch.ring", 0.07, 0.02, (0, -1.35, 0.04), iron, rot=(0, 0, 0), segments=24)
    straps = [kit.box(f"hatch.strap.{x}", (0.08, 1.1, 0.012), (x, -1.0, 0.035), iron) for x in (-0.55, 0.55)]
    kit.parent([ring] + straps, lid)
    cellar = kit.stone("cellarstone", (0.18, 0.17, 0.15), (0.06, 0.055, 0.05))
    shaft = [
        kit.box("hatch.shaft.n", (1.6, 0.06, 2.4), (0, hatch_hole[3] + 0.03, -1.2), cellar),
        kit.box("hatch.shaft.s", (1.6, 0.06, 2.4), (0, hatch_hole[2] - 0.03, -1.2), cellar),
        kit.box("hatch.shaft.w", (0.06, 1.2, 2.4), (-0.83, -1.0, -1.2), cellar),
        kit.box("hatch.shaft.e", (0.06, 1.2, 2.4), (0.83, -1.0, -1.2), cellar),
        kit.box("hatch.shaft.floor", (1.6, 1.2, 0.06), (0, -1.0, -2.4), black),
    ]
    for side in (-0.35, 0.35):
        shaft.append(kit.box(f"ladder.rail.{side}", (0.05, 0.05, 2.5), (side, -0.48, -1.15), trim))
    for i in range(6):
        shaft.append(kit.box(f"ladder.rung.{i}", (0.7, 0.04, 0.04), (0, -0.48, -2.1 + i * 0.4), trim))
    kit.hotspot([lid, ring] + straps + shaft, HOTSPOTS["hatch"])

    # ---------------- the staircase: its middle steps are the rubble at its foot
    # (story bible, section 6). The upper flight still reaches the landing,
    # and the banister post at the top is solid as a grudge.
    sx0, steps = -1.9 - 0.4, 13
    GAP = (4, 5, 6)
    stairs = []
    for i in range(steps):
        if i in GAP:
            continue
        x = sx0 - i * 0.24
        z = (i + 1) * 0.2
        stairs.append(kit.box(f"stair.{i}", (0.26, 1.3, 0.2), (x, 3.25, z - 0.1), trim, bevel=0.01))
        if i < GAP[0]:
            stairs.append(kit.box(f"stair.riser.{i}", (0.26, 1.3, z), (x, 3.25, z / 2), panel))
    # The upper flight hangs from the wall now, on what is left of its stringer.
    top_x = sx0 - (steps - 1) * 0.24
    # The flight rises towards -x, so its slope is a positive turn about y (+x end down).
    stairs.append(kit.box("stair.stringer", (2.0, 0.08, 0.3), (sx0 - 2.3, 3.92, 1.95), trim, rot=(0, 39.8, 0)))
    stairs.append(kit.box("landing", (0.75, 1.5, 0.14), (top_x - 0.3, 3.2, (steps * 0.2) - 0.07), trim, bevel=0.01))
    post_at = (top_x + 0.05, 2.55, steps * 0.2 + 0.55)
    stairs.append(kit.box("banister.post", (0.12, 0.12, 1.1), post_at, trim, bevel=0.01))
    stairs.append(kit.sphere("banister.cap", 0.09, (post_at[0], post_at[1], post_at[2] + 0.6), trim, segments=12))
    for i in range(0, steps, 2):
        if i in GAP:
            continue
        x = sx0 - i * 0.24
        stairs.append(kit.box(f"baluster.{i}", (0.04, 0.04, 0.9), (x, 2.62, (i + 1) * 0.2 + 0.45), trim))
    # The rail, broken where the steps are: 0.9 m above the nosings, either side of the gap.
    stairs.append(kit.box("handrail.low", (1.25, 0.07, 0.07), (sx0 - 0.36, 2.62, 1.4), trim, rot=(0, 39.8, 0)))
    stairs.append(kit.box("handrail.high", (1.56, 0.07, 0.07), (sx0 - 2.28, 2.62, 3.0), trim, rot=(0, 39.8, 0)))
    for i in range(26):
        r = 0.08 + rng.random() * 0.28
        stairs.append(kit.rock(f"rubble.{i}", r, (-3.5 + rng.gauss(0, 0.4), 2.75 + rng.gauss(0, 0.22), r * 0.4), rubble_mat, seed=i))
    for i in range(7):
        stairs.append(kit.box(f"rubble.beam.{i}", (0.1, 0.1, 0.9 + rng.random() * 0.8),
                              (-3.5 + rng.gauss(0, 0.4), 2.7 + rng.gauss(0, 0.2), 0.2),
                              trim, rot=(rng.uniform(50, 85), rng.uniform(-30, 30), rng.uniform(0, 180))))
    kit.hotspot(stairs, HOTSPOTS["stairs"])
    # The moth-eaten curtain, once it is tied over the post: a rope across the gap.
    rope_mat = kit.stone("curtain.rope", (0.30, 0.07, 0.22), (0.12, 0.03, 0.09), scale=11.0)
    a = (post_at[0], 2.55, post_at[2] + 0.4)
    b = (sx0 - 3 * 0.24, 2.6, 0.95)
    rope = []
    for k in range(8):
        t0, t1 = k / 8, (k + 1) / 8
        p0 = [a[j] + (b[j] - a[j]) * t0 for j in range(3)]
        p1 = [a[j] + (b[j] - a[j]) * t1 for j in range(3)]
        sag = math.sin(math.pi * (t0 + t1) / 2) * 0.12
        mid = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2 - sag)
        length = math.dist(p0, p1) + 0.02
        ang = math.degrees(math.atan2(p1[2] - p0[2], p1[0] - p0[0]))
        rope.append(kit.box(f"rope.{k}", (length, 0.06 + (k % 2) * 0.02, 0.05), mid, rope_mat, rot=(0, -ang, 0)))
    kit.hotspot(rope, HOTSPOTS["stairs"])

    # ---------------- dressing: a sconce pair and a dead portrait
    for x in (-2.6, 2.95):
        kit.box(f"sconce.plate.{x}", (0.12, 0.03, 0.22), (x + 0.0, NORTH - 0.02, 2.5), brass, bevel=0.005)
        kit.cylinder(f"sconce.candle.{x}", 0.025, 0.14, (x, NORTH - 0.12, 2.62), wax, segments=10)
    kit.box("portrait.frame", (0.9, 0.05, 1.1), (3.0, NORTH - 0.03, 3.3), brass, bevel=0.02)
    kit.box("portrait.canvas", (0.76, 0.02, 0.96), (3.0, NORTH - 0.06, 3.3), kit.stone("oilpaint", (0.16, 0.11, 0.06), (0.03, 0.025, 0.02), scale=3.0))

    # ---------------- light
    kit.world((0.012, 0.016, 0.03), 1.0)
    # Above the stairwell, the attic: a dark shaft of rafters and boards, not sky. The
    # moonlight from the hole in its roof comes down the stairwell and lands by the stairs.
    shaft_wood = kit.wood("attic.boards", (0.14, 0.11, 0.08), (0.07, 0.05, 0.035), rough=0.85)
    sx, sy, sz = -3.8, 2.2, CEIL + 0.2
    kit.box("attic.lid", (2.4, 2.2, 0.08), (sx, sy, sz + 1.5), shaft_wood)
    for name, size, loc in (("attic.n", (2.4, 0.08, 1.5), (sx, sy + 1.1, sz + 0.75)),
                            ("attic.s", (2.4, 0.08, 1.5), (sx, sy - 1.1, sz + 0.75)),
                            ("attic.e", (0.08, 2.2, 1.5), (sx + 1.2, sy, sz + 0.75)),
                            ("attic.w", (0.08, 2.2, 1.5), (sx - 1.2, sy, sz + 0.75))):
        kit.box(name, size, loc, shaft_wood)
    for k in range(3):
        kit.box(f"attic.rafter.{k}", (0.1, 2.2, 0.14), (sx - 0.8 + k * 0.8, sy, sz + 1.38), shaft_wood)
    kit.sun("moon", (0.62, 0.72, 1.0), 9.0, direction=(0.6, -0.4, -5.2), angle=0.6)
    attic_moon = kit.area("attic.moon", (0.45, 0.55, 0.9), 7, (sx - 0.7, sy + 0.3, sz + 1.3), (20, -25, 0), 0.9)
    attic_moon.visible_camera = False
    kit.point("east.spill", (1.0, 0.55, 0.25), 40, (W + 2.2, 2.6, 1.6), radius=0.4)
    kit.point("west.spill", (0.45, 0.5, 0.8), 18, (-W - 2.2, 2.6, 1.8), radius=0.4)
    kit.area("fill", (0.35, 0.42, 0.65), 140, (0, -5.5, 3.5), (60, 0, 0), 4.0, scatter=False)
    kit.area("bounce", (0.5, 0.45, 0.4), 60, (0, 0.5, CEIL - 0.3), (0, 0, 0), 5.0, scatter=False)

    dust = kit.box("dust", (2 * W - 0.1, NORTH - SOUTH - 0.2, CEIL - 0.1), (0, (NORTH + SOUTH) / 2, CEIL / 2), kit.volume("dust", 0.03))
    dust.pass_index = 0

    cam = kit.camera((0.0, -6.0, 1.7), (0.0, 4.0, 1.5), lens=24.0)

    return {
        "room": "hall",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["dust"],
        "hiddenByDefault": [o.name for o in key_parts] + [sheet.name] + [o.name for o in rope],
        "variants": [
            {"id": "clock.open", "when": {"open": "clock"},
             "rotate": {"clock.door": [0, 0, -105]}},
            {"id": "brassKey", "base": "clock.open", "when": {"open": "clock", "in": ["brassKey", "clock"]},
             "show": [o.name for o in key_parts]},
            {"id": "musicSheet", "base": "clock.open", "when": {"open": "clock", "in": ["musicSheet", "clock"]},
             "show": [sheet.name]},
            {"id": "hatch.open", "when": {"open": "hatch"},
             "rotate": {"hatch.lid": [-100, 0, 0]}},
            {"id": "stairs.rope", "when": {"flag": "curtainOnStairs"}, "show": [o.name for o in rope]},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-4.9, 4.9, -2.5, 3.0],
                 "blocks": [[-2.25, 2.25, 3.1, 4.0], [3.5, 4.4, 3.2, 4.0], [-5.0, -2.9, 1.95, 4.0],
                            [-0.85, 0.85, -1.65, -0.35]]},
        "points": {
            "start": [-2.4, -1.4], "n": [-1.6, -1.2], "w": [3.9, 1.6], "e": [-4.2, 1.55],
            "u": [1.2, -1.0], "d": [-2.4, 1.7],
        },
        "walkTo": {
            "cabinet": [0.0, 2.7], "clock": [3.05, 2.85], "chandelier": [0.3, 1.2], "hatch": [1.2, -1.0],
            "brassKey": [3.1, 2.9], "musicSheet": [3.1, 2.9],
            "exit:w": [-4.85, 1.7], "exit:e": [4.8, 2.6], "exit:s": [0.0, -2.45], "exit:d": [1.1, -1.0],
            "stairs": [-2.4, 1.7], "exit:u": [-2.4, 1.7],
        },
        # Exits with no geometry of their own, as screen rectangles (px, 1280x800).
        "zones": [{"id": "exit:s", "rect": [0, 748, 1280, 52]}, {"id": "exit:d", "fromHotspot": "hatch", "when": {"open": "hatch"}},
                  {"id": "exit:u", "fromHotspot": "stairs", "when": {"flag": "stairsCrossed"}}],
        "lights": {
            "ambient": [0.10, 0.12, 0.18],
            "key": {"color": [0.62, 0.72, 1.0], "dir": [-0.35, -0.9, 0.25], "intensity": 0.6},
        },
        # Drawn live over the render by the shell: the clock's face, once it is wound, keeps the
        # player's real time (Blender coordinates, the front of the dial).
        "live": {"clock": {"at": [3.95, 3.7 - 0.245, 2.06], "radius": 0.23, "when": {"flag": "clockRunning"}}},
        "music": "manor",
        "exposure": 1.1,
    }
