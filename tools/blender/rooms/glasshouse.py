"""The glasshouse in the kitchen garden, at night.

Story bible section 6b. Composition follows the EGA painter in js/scenes.js:
an iron-and-glass house that has lost its argument with the weather, half
its panes on the floor and the rest holding the moon in pieces; dead vines up
the frame; the potting bench along the far wall with clay pots and, in the
middle of it, the grandmother's phonograph with its brass horn like a frozen
lily; the long ladder on its hooks along the left-hand wall. The garden is
south, behind the player.

The ladder is an overlay, so the hooks are bare once it has been taken.
"""
from __future__ import annotations

import math
import random

import kit

W = 3.6           # half-width
NORTH = 3.6       # the far end, behind the bench
SOUTH = -6.5
EAVE = 2.4
RIDGE = 3.7

HOTSPOTS = {
    "floor": 1,
    "phonograph": 2,
    "ladder": 3,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(71)

    bricks = kit.planks("glasshouse.bricks", (0.20, 0.11, 0.08), (0.12, 0.065, 0.045), gap=(0.05, 0.045, 0.04), width=0.11, length=0.23)
    iron = kit.solid("frame.iron", (0.06, 0.07, 0.065), rough=0.5, metal=0.8)
    pane = kit.glass("pane", (0.85, 0.92, 0.9), rough=0.08)
    grime = kit.glass("pane.grimy", (0.55, 0.62, 0.55), rough=0.3)
    deal = kit.wood("bench.deal", (0.26, 0.19, 0.11), (0.13, 0.09, 0.05), grain=7.0, rough=0.75)
    weathered = kit.wood("weathered", (0.19, 0.17, 0.14), (0.09, 0.08, 0.065), grain=26.0, along="Z", rough=0.8)
    terracotta = kit.solid("terracotta", (0.42, 0.17, 0.08), rough=0.75)
    vine = kit.wood("vine", (0.10, 0.08, 0.05), (0.04, 0.03, 0.02), grain=40.0, along="Z", rough=0.9)
    brass = kit.solid("horn.brass", (0.72, 0.52, 0.22), rough=0.25, metal=1.0)
    case = kit.wood("phonograph.case", (0.26, 0.12, 0.05), (0.12, 0.05, 0.02), grain=16.0, rough=0.35)
    rust = kit.solid("trowel.rust", (0.22, 0.09, 0.04), rough=0.9, metal=0.3)
    soil = kit.stone("soil", (0.09, 0.065, 0.045), (0.035, 0.025, 0.018), scale=20.0)
    night = kit.solid("garden.night", (0.02, 0.035, 0.05), rough=1.0)

    # ---------------- floor: old bricks, and the glass that came down
    kit.hotspot([kit.box("floor", (2 * W, NORTH - SOUTH, 0.1), (0, (NORTH + SOUTH) / 2, -0.05), bricks)], HOTSPOTS["floor"])
    for k in range(40):
        kit.box(f"shard.{k}", (rng.uniform(0.05, 0.25), rng.uniform(0.04, 0.2), 0.006), (rng.uniform(-W + 0.3, W - 0.3), rng.uniform(-2.5, 3.0), 0.004),
                pane, rot=(rng.uniform(-4, 4), rng.uniform(-4, 4), rng.uniform(0, 180)))

    # ---------------- the frame: uprights, a glazing bar course, and the roof ridge
    bays = [SOUTH + 1.0 + k * 1.3 for k in range(9)]
    for y in bays:
        for x in (-W, W):
            kit.box(f"upright.{x}.{y}", (0.05, 0.05, EAVE), (x, y, EAVE / 2), iron)
        for side in (-1, 1):
            run = math.hypot(W, RIDGE - EAVE)
            kit.box(f"rafter.{side}.{y}", (run, 0.04, 0.05), (side * W / 2, y, (EAVE + RIDGE) / 2), iron,
                    rot=(0, side * math.degrees(math.atan2(RIDGE - EAVE, W)), 0))
    for x in (-W, W):
        for z in (0.6, EAVE):
            kit.box(f"rail.{x}.{z}", (0.05, NORTH - SOUTH, 0.05), (x, (NORTH + SOUTH) / 2, z), iron)
    kit.box("ridge", (0.06, NORTH - SOUTH, 0.06), (0, (NORTH + SOUTH) / 2, RIDGE), iron)
    for x in [-W + k * (2 * W / 6) for k in range(7)]:
        kit.box(f"end.upright.{x}", (0.05, 0.05, EAVE + (RIDGE - EAVE) * (1 - abs(x) / W)), (x, NORTH, (EAVE + (RIDGE - EAVE) * (1 - abs(x) / W)) / 2), iron)
    kit.box("end.rail", (2 * W, 0.05, 0.05), (0, NORTH, 1.0), iron)
    kit.box("dwarf.wall.n", (2 * W, 0.25, 0.6), (0, NORTH + 0.12, 0.3), bricks)
    for x in (-W, W):
        kit.box(f"dwarf.wall.{x}", (0.25, NORTH - SOUTH, 0.6), (x + (0.12 if x > 0 else -0.12), (NORTH + SOUTH) / 2, 0.3), bricks)
    # The panes: half of them are on the floor.
    for i, y in enumerate(bays[:-1]):
        for x in (-W, W):
            if rng.random() < 0.5:
                kit.box(f"pane.side.{x}.{i}", (0.01, 1.25, EAVE - 0.65), (x, y + 0.65, (EAVE + 0.6) / 2), rng.choice((pane, grime)))
        for side in (-1, 1):
            if rng.random() < 0.45:
                run = math.hypot(W, RIDGE - EAVE)
                kit.box(f"pane.roof.{side}.{i}", (run, 1.25, 0.01), (side * W / 2, y + 0.65, (EAVE + RIDGE) / 2 + 0.02), rng.choice((pane, grime)),
                        rot=(0, side * math.degrees(math.atan2(RIDGE - EAVE, W)), 0))
    for k in range(6):
        x = -W + (k + 0.5) * (2 * W / 6)
        if k in (1, 4):
            continue
        kit.box(f"pane.end.{k}", (2 * W / 6 - 0.05, 0.01, EAVE - 1.0), (x, NORTH - 0.01, (EAVE + 1.0) / 2), grime)
    kit.box("garden.beyond", (30, 0.1, 12), (0, NORTH + 6.0, 4.0), night)

    # ---------------- dead vines, climbed the frame and stayed there
    for k in range(10):
        x = rng.choice((-W + 0.08, W - 0.08))
        y = rng.uniform(SOUTH + 2.0, NORTH - 0.5)
        z = 0.0
        for j in range(5):
            h = rng.uniform(0.4, 0.7)
            kit.cylinder(f"vine.{k}.{j}", 0.012, h, (x, y + rng.uniform(-0.1, 0.1), z + h / 2), vine, rot=(rng.uniform(-20, 20), rng.uniform(-15, 15), 0),
                         segments=6)
            z += h * 0.9

    # ---------------- the potting bench, and the phonograph on it
    by = NORTH - 0.55
    kit.box("bench.top", (5.2, 0.7, 0.06), (0, by, 0.86), deal, bevel=0.01)
    kit.box("bench.shelf", (5.0, 0.6, 0.04), (0, by, 0.3), deal)
    for x in (-2.5, -0.8, 0.8, 2.5):
        for dy in (-0.3, 0.3):
            kit.box(f"bench.leg.{x}.{dy}", (0.07, 0.07, 0.86), (x, by + dy, 0.43), deal)
    for k, x in enumerate((-2.2, -1.75, -1.35, 1.6, 2.15)):
        r = rng.uniform(0.09, 0.14)
        kit.cylinder(f"pot.{k}", r, r * 1.6, (x, by + rng.uniform(-0.15, 0.15), 0.89 + r * 0.8), terracotta, segments=16, radius2=r * 1.3)
    for k in range(6):
        kit.cylinder(f"pot.stack.{k}", 0.12, 0.16, (-1.0 + (k % 2) * 0.05, by - 0.05, 0.4 + k * 0.05), terracotta, segments=16, radius2=0.15)
    kit.box("soil.heap", (0.6, 0.35, 0.12), (2.0, by, 0.36), soil, bevel=0.05)
    kit.box("trowel.blade", (0.2, 0.08, 0.01), (1.25, by - 0.15, 0.895), rust, rot=(0, 0, 30))
    kit.cylinder("trowel.handle", 0.015, 0.14, (1.1, by - 0.24, 0.9), weathered, rot=(0, 90, 30), segments=8)
    px, pz = 0.2, 0.89
    phono = [kit.box("phono.case", (0.48, 0.34, 0.2), (px, by, pz + 0.1), case, bevel=0.015),
             kit.cylinder("phono.mandrel", 0.05, 0.22, (px, by - 0.02, pz + 0.27), kit.solid("mandrel", (0.45, 0.42, 0.38), rough=0.3, metal=0.8),
                          rot=(0, 90, 0), segments=18),
             kit.box("phono.carriage", (0.3, 0.04, 0.03), (px, by + 0.06, pz + 0.33), brass),
             kit.cylinder("phono.crank", 0.012, 0.14, (px + 0.28, by - 0.05, pz + 0.12), brass, rot=(0, 90, 0), segments=8),
             kit.box("phono.crank.arm", (0.02, 0.02, 0.1), (px + 0.35, by - 0.05, pz + 0.08), brass)]
    # The horn: a flared cone from the carriage, up and out to the right.
    horn = kit.cylinder("phono.horn", 0.03, 0.7, (px + 0.3, by + 0.05, pz + 0.65), brass, rot=(0, 52, 0), segments=28, radius2=0.3)
    phono.append(horn)
    phono.append(kit.cylinder("phono.horn.neck", 0.025, 0.25, (px + 0.08, by + 0.05, pz + 0.38), brass, rot=(0, 52, 0), segments=12))
    kit.hotspot(phono, HOTSPOTS["phonograph"])

    # ---------------- the ladder on its hooks, along the left-hand wall
    lx, lz = -W + 0.12, 1.55
    ladder = []
    for k, z in enumerate((lz - 0.2, lz + 0.2)):
        ladder.append(kit.box(f"ladder.rail.{k}", (0.05, 3.4, 0.06), (lx, 0.0, z), weathered))
    for k in range(12):
        ladder.append(kit.box(f"ladder.rung.{k}", (0.04, 0.035, 0.42), (lx, -1.55 + k * 0.28, lz), weathered))
    for y in (-1.2, 1.2):
        kit.box(f"hook.{y}", (0.12, 0.03, 0.03), (-W + 0.06, y, lz - 0.28), iron)
    kit.hotspot(ladder, HOTSPOTS["ladder"])

    # ---------------- light: the moon through the glass, broken into pieces
    kit.world((0.006, 0.01, 0.02), 1.0)
    kit.sun("moon", (0.62, 0.72, 1.0), 3.2, direction=(0.4, 0.5, -0.75), angle=0.4)
    kit.area("sky", (0.35, 0.45, 0.75), 40, (0, -2.0, RIDGE + 2.5), (0, 0, 0), 6.0, scatter=False)
    kit.area("fill", (0.35, 0.40, 0.60), 50, (0, -5.5, 2.4), (65, 0, 0), 4.0, scatter=False)
    haze = kit.box("haze", (2 * W - 0.1, NORTH - SOUTH - 0.2, RIDGE - 0.1), (0, (NORTH + SOUTH) / 2, RIDGE / 2), kit.volume("haze", 0.02))
    haze.pass_index = 0

    cam = kit.camera((0.0, -5.6, 1.6), (0.0, 3.6, 1.15), lens=22.0)

    return {
        "room": "glasshouse",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["haze"],
        "hiddenByDefault": [o.name for o in ladder],
        "variants": [{"id": "ladder", "when": {"here": "ladder"}, "show": [o.name for o in ladder]}],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-W + 0.5, W - 0.5, -2.5, by - 0.5], "blocks": []},
        "points": {"start": [0.0, -1.0], "n": [0.0, -2.2]},
        "walkTo": {"phonograph": [px, by - 0.75], "ladder": [-W + 0.7, 0.0], "exit:s": [0.0, -2.4]},
        "zones": [{"id": "exit:s", "rect": [0, 740, 1280, 60]}],
        "lights": {
            "ambient": [0.09, 0.11, 0.17],
            "key": {"color": [0.62, 0.72, 1.0], "dir": [0.4, -0.75, 0.5], "intensity": 0.45},
        },
        "music": "outside",
        "exposure": 1.15,
    }
