"""The King's Vault, dark.

Composition follows the EGA painter in js/scenes.js: shelves of dust on
either side where the real treasures once stood, their outlines still
clean in the grime; a single pedestal in the middle with the jade scepter
on it, faintly green; and the doorway back to the guardroom in the east
wall, with the guardroom's torchlight beyond.

The scepter is an overlay, so it goes when it is taken.
"""
from __future__ import annotations

import math
import random

import kit

W = 4.4
NORTH = 3.6
SOUTH = -7.5
CEIL = 3.4
DOOR = (1.2, 2.6)
DOOR_H = 2.5
PEDESTAL = (0.0, 2.0)

HOTSPOTS = {
    "floor": 1,
    "scepter": 2,
    "exit:e": 3,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(67)

    wall = kit.ashlar("vault.wall", (0.12, 0.115, 0.11), (0.05, 0.048, 0.046), mortar=(0.02, 0.02, 0.02), course=0.36, block=0.6)
    flags = kit.planks("guard.flags", (0.13, 0.125, 0.12), (0.07, 0.068, 0.065), gap=(0.015, 0.015, 0.015), width=0.6, length=0.8)
    pale = kit.stone("pedestal.stone", (0.3, 0.29, 0.27), (0.15, 0.145, 0.14), scale=6.0)
    oak = kit.wood("shelf.old", (0.12, 0.07, 0.035), (0.05, 0.03, 0.015), grain=12.0, rough=0.85)
    dust = kit.solid("dust.grey", (0.22, 0.21, 0.2), rough=1.0)
    jade = kit.solid("jade", (0.08, 0.35, 0.16), rough=0.18, emission=(0.1, 0.5, 0.2), strength=0.6)
    gold = kit.solid("crown.gold", (0.8, 0.58, 0.18), rough=0.22, metal=1.0)

    # ---------------- shell
    kit.hotspot([kit.box("floor", (2 * W, NORTH - SOUTH, 0.1), (0, (NORTH + SOUTH) / 2, -0.05), flags)], HOTSPOTS["floor"])
    kit.box("ceiling", (2 * W, NORTH - SOUTH, 0.2), (0, (NORTH + SOUTH) / 2, CEIL + 0.1), wall)
    kit.box("north", (2 * W, 0.4, CEIL), (0, NORTH + 0.2, CEIL / 2), wall)
    kit.box("south", (2 * W, 0.4, CEIL), (0, SOUTH - 0.2, CEIL / 2), wall)
    kit.box("west", (0.4, NORTH - SOUTH, CEIL), (-W - 0.2, (NORTH + SOUTH) / 2, CEIL / 2), wall)
    kit.wall_with_openings("east", SOUTH, NORTH, CEIL, 0.4, [(DOOR[0], DOOR[1], 0.0, DOOR_H)], wall, "Y", W + 0.2)

    # ---------------- the way back to the guardroom, its torchlight beyond
    dc = sum(DOOR) / 2
    way = [kit.box("east.beyond.floor", (2.5, DOOR[1] - DOOR[0], 0.1), (W + 1.45, dc, -0.05), flags),
           kit.box("east.beyond.back", (0.1, 2.0, 3.0), (W + 2.7, dc, 1.5), wall),
           kit.box("east.beyond.l", (2.5, 0.1, 3.0), (W + 1.45, DOOR[0] - 0.05, 1.5), wall),
           kit.box("east.beyond.r", (2.5, 0.1, 3.0), (W + 1.45, DOOR[1] + 0.05, 1.5), wall),
           kit.box("east.beyond.top", (2.5, DOOR[1] - DOOR[0], 0.1), (W + 1.45, dc, DOOR_H + 0.05), wall)]
    leaf = kit.box("east.door", (0.16, DOOR[1] - DOOR[0] - 0.04, DOOR_H - 0.04), (W + 0.2, DOOR[0] + 0.02, DOOR_H / 2),
                   kit.stone("vault.steel", (0.32, 0.31, 0.3), (0.16, 0.08, 0.04), scale=6.0), pivot=(0, -1, 0), bevel=0.02)
    leaf.rotation_euler = (0, 0, math.radians(-80))       # standing open, back into the guardroom
    kit.hotspot(way + [leaf], HOTSPOTS["exit:e"])
    kit.point("guardroom.torch", (1.0, 0.6, 0.3), 45, (W + 1.8, dc, 2.0), radius=0.2)

    # ---------------- shelves of dust where the real treasures once stood
    for side in (-1, 1):
        x = side * (W - 0.3)
        kit.box(f"shelf.back.{side}", (0.05, 3.0, 2.8), (x + side * 0.22, 1.8, 1.4), oak)
        for k in range(4):
            z = 0.5 + k * 0.6
            kit.box(f"shelf.{side}.{k}", (0.45, 3.0, 0.04), (x, 1.8, z), oak, bevel=0.004)
            # The clean shapes where things used to stand.
            for j in range(3):
                if rng.random() < 0.3:
                    continue
                y = 0.8 + j * 0.9 + rng.uniform(-0.15, 0.15)
                kit.box(f"dust.{side}.{k}.{j}", (0.35, 0.6, 0.006), (x, y, z + 0.022), dust)
                kit.box(f"outline.{side}.{k}.{j}", (0.2, 0.3, 0.007), (x, y, z + 0.024), oak)

    # ---------------- the pedestal, and the jade scepter on it
    px, py = PEDESTAL
    kit.box("pedestal.foot", (0.9, 0.9, 0.15), (px, py, 0.075), pale, bevel=0.02)
    kit.cylinder("pedestal.shaft", 0.22, 0.85, (px, py, 0.57), pale, segments=20)
    kit.box("pedestal.top", (0.7, 0.7, 0.1), (px, py, 1.05), pale, bevel=0.02)
    scepter = [kit.cylinder("scepter.rod", 0.025, 0.7, (px, py, 1.12), jade, rot=(0, 90, 18), segments=10)]
    rx, ry = math.cos(math.radians(18)), math.sin(math.radians(18))
    for k in range(3):
        t = -0.2 + k * 0.2
        coil = kit.torus(f"scepter.snake.{k}", 0.034, 0.01, (px + rx * t, py + ry * t, 1.12), jade, segments=16, sides=6)
        coil.rotation_euler = (0, math.radians(90), math.radians(18))
        scepter.append(coil)
    scepter.append(kit.sphere("scepter.head", 0.05, (px + rx * 0.37, py + ry * 0.37, 1.12), jade))
    scepter.append(kit.cylinder("scepter.cap", 0.035, 0.03, (px - rx * 0.36, py - ry * 0.36, 1.12), gold, rot=(0, 90, 18), segments=10))
    kit.hotspot(scepter, HOTSPOTS["scepter"])
    glow = kit.point("scepter.glow", (0.35, 0.9, 0.5), 4, (px, py, 1.35), radius=0.15)

    # ---------------- light: the guardroom's torch through the door, and the jade's own
    kit.world((0.002, 0.002, 0.003), 1.0)
    kit.area("fill", (0.35, 0.4, 0.5), 45, (0, -5.0, 2.6), (70, 0, 0), 3.0, scatter=False)
    air = kit.box("air", (2 * W, NORTH - SOUTH, CEIL), (0, (NORTH + SOUTH) / 2, CEIL / 2), kit.volume("vault.air", 0.02))
    air.pass_index = 0

    cam = kit.camera((0.0, -6.0, 1.7), (0.0, 4.0, 1.3), lens=24.0)

    return {
        "room": "vault",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["air"],
        "hiddenByDefault": [o.name for o in scepter] + [glow.name],
        "variants": [
            {"id": "scepter", "when": {"here": "scepter"}, "show": [o.name for o in scepter] + [glow.name]},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-3.6, 3.9, -2.3, 2.9], "blocks": [[px - 0.55, px + 0.55, py - 0.55, py + 0.55]]},
        "points": {"start": [-1.4, -0.6], "w": [3.5, dc]},
        "walkTo": {"scepter": [px, py - 0.85], "exit:e": [3.85, dc]},
        # The doorway is seen edge-on; the right-hand edge of the picture is the way out, as in the EGA scene.
        "zones": [{"id": "exit:e", "rect": [1180, 230, 100, 340]}],
        "lights": {
            "ambient": [0.04, 0.045, 0.045],
            "key": {"color": [1.0, 0.6, 0.3], "dir": [-1.0, -0.2, 0.0], "intensity": 0.3},
        },
        "music": "throne",
        "exposure": 1.1,
    }
