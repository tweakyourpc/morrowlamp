"""The Sanctum of the Opal Idol, dark but for the idol.

Composition follows the EGA painter in js/scenes.js: a small stone chamber
behind the false mirror; a brass altar in the middle; on it the Opal Idol,
storms the size of coins turning over inside it, lighting the room with
its own weather; and the way back to the Hall of Mirrors in the east wall.

The idol is an overlay, light and all, so the room goes dark when it is
taken.
"""
from __future__ import annotations

import random

import kit

W = 3.8
NORTH = 3.0
SOUTH = -7.5
CEIL = 3.3
DOOR = (0.2, 1.6)
DOOR_H = 2.4
ALTAR = (0.0, 1.6)

HOTSPOTS = {
    "floor": 1,
    "idol": 2,
    "exit:e": 3,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(73)

    wall = kit.ashlar("sanctum.wall", (0.11, 0.1, 0.11), (0.045, 0.04, 0.045), mortar=(0.02, 0.02, 0.02), course=0.32, block=0.5)
    floor_mat = kit.stone("sanctum.floor", (0.09, 0.085, 0.09), (0.03, 0.028, 0.03), scale=8.0)
    brass = kit.solid("brass", (0.62, 0.43, 0.17), rough=0.32, metal=1.0)
    gilt = kit.solid("gilt", (0.75, 0.55, 0.2), rough=0.28, metal=1.0)
    shell = kit.glass("opal.shell", (0.92, 0.95, 1.0), rough=0.12)
    storms = [kit.solid(f"opal.storm.{c}", rgb, rough=0.5, emission=rgb, strength=9.0) for c, rgb in
              (("cyan", (0.3, 0.85, 1.0)), ("rose", (1.0, 0.35, 0.75)), ("gold", (1.0, 0.8, 0.35)), ("white", (0.9, 0.95, 1.0)))]
    milk = kit.solid("opal.milk", (0.8, 0.85, 0.9), rough=0.3, transmission=0.5, emission=(0.55, 0.7, 0.85), strength=1.2)
    black = kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)

    # ---------------- shell
    kit.hotspot([kit.box("floor", (2 * W, NORTH - SOUTH, 0.1), (0, (NORTH + SOUTH) / 2, -0.05), floor_mat)], HOTSPOTS["floor"])
    kit.box("ceiling", (2 * W, NORTH - SOUTH, 0.2), (0, (NORTH + SOUTH) / 2, CEIL + 0.1), wall)
    kit.box("north", (2 * W, 0.4, CEIL), (0, NORTH + 0.2, CEIL / 2), wall)
    kit.box("south", (2 * W, 0.4, CEIL), (0, SOUTH - 0.2, CEIL / 2), wall)
    kit.box("west", (0.4, NORTH - SOUTH, CEIL), (-W - 0.2, (NORTH + SOUTH) / 2, CEIL / 2), wall)
    kit.wall_with_openings("east", SOUTH, NORTH, CEIL, 0.4, [(DOOR[0], DOOR[1], 0.0, DOOR_H)], wall, "Y", W + 0.2)
    dc = sum(DOOR) / 2
    way = [kit.box("east.beyond.floor", (2.5, DOOR[1] - DOOR[0], 0.1), (W + 1.45, dc, -0.05), floor_mat),
           kit.box("east.beyond.back", (0.1, 2.0, 3.0), (W + 2.7, dc, 1.5), black),
           kit.box("east.beyond.l", (2.5, 0.1, 3.0), (W + 1.45, DOOR[0] - 0.05, 1.5), wall),
           kit.box("east.beyond.r", (2.5, 0.1, 3.0), (W + 1.45, DOOR[1] + 0.05, 1.5), wall),
           kit.box("east.beyond.top", (2.5, DOOR[1] - DOOR[0], 0.1), (W + 1.45, dc, DOOR_H + 0.05), wall)]
    kit.hotspot(way, HOTSPOTS["exit:e"])
    # Niches in the walls, empty: whatever stood in them left for the idol's sake.
    for k, x in enumerate((-2.4, 2.4)):
        kit.box(f"niche.{k}", (0.8, 0.1, 1.2), (x, NORTH - 0.02, 1.7), black)
        kit.box(f"niche.sill.{k}", (1.0, 0.2, 0.08), (x, NORTH - 0.08, 1.06), gilt)

    # ---------------- the brass altar
    ax, ay = ALTAR
    kit.box("altar.base", (1.3, 0.8, 0.8), (ax, ay, 0.4), brass, bevel=0.02)
    kit.box("altar.top", (1.5, 0.95, 0.08), (ax, ay, 0.84), gilt, bevel=0.02)
    kit.box("altar.step", (1.8, 1.2, 0.12), (ax, ay, 0.06), brass, bevel=0.02)
    for k in range(5):
        kit.box(f"altar.band.{k}", (1.32, 0.82, 0.03), (ax, ay, 0.15 + k * 0.14), gilt)

    # ---------------- the Opal Idol, with its own weather
    idol = [kit.box("idol.foot", (0.2, 0.2, 0.06), (ax, ay, 0.91), gilt, bevel=0.01),
            kit.sphere("idol.body", 0.11, (ax, ay, 1.06), milk, scale=(0.85, 0.75, 1.35)),
            kit.sphere("idol.head", 0.07, (ax, ay, 1.26), milk),
            kit.sphere("idol.shell", 0.13, (ax, ay, 1.1), shell, scale=(0.9, 0.8, 1.5))]
    for k in range(6):
        idol.append(kit.sphere(f"idol.storm.{k}", rng.uniform(0.012, 0.025), (ax + rng.uniform(-0.05, 0.05), ay + rng.uniform(-0.04, 0.04),
                                                                             1.0 + rng.uniform(0.0, 0.24)), storms[k % len(storms)], segments=8))
    kit.hotspot(idol, HOTSPOTS["idol"])
    weather = [kit.point("idol.light", (0.6, 0.75, 1.0), 40, (ax, ay - 0.15, 1.35), radius=0.15),
               kit.point("idol.light.rose", (1.0, 0.45, 0.8), 10, (ax + 0.1, ay - 0.2, 1.1), radius=0.1)]

    # ---------------- light: next to none without it
    kit.world((0.002, 0.002, 0.003), 1.0)
    kit.area("fill", (0.35, 0.4, 0.55), 15, (0, -5.0, 2.6), (70, 0, 0), 3.0, scatter=False)

    cam = kit.camera((0.0, -6.0, 1.7), (0.0, 4.0, 1.2), lens=24.0)

    return {
        "room": "mirrorSanctum",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": [],
        "hiddenByDefault": [o.name for o in idol + weather],
        "variants": [
            {"id": "idol", "when": {"here": "idol"}, "show": [o.name for o in idol + weather]},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-3.2, 3.3, -2.3, 2.5], "blocks": [[ax - 0.95, ax + 0.95, ay - 0.65, ay + 0.65]]},
        "points": {"start": [-1.0, -0.4], "w": [2.9, dc]},
        "walkTo": {"idol": [ax, ay - 0.9], "exit:e": [3.25, dc]},
        "zones": [],
        "lights": {
            "ambient": [0.05, 0.055, 0.07],
            "key": {"color": [0.6, 0.75, 1.0], "dir": [0.0, -1.0, 0.3], "intensity": 0.35},
        },
        "music": "lake",
        "exposure": 1.1,
    }
