"""The Throne Room of the Sunken King, dark.

Composition follows the EGA painter in js/scenes.js: black stone columns
going up into a vault so high the ceiling apologizes for itself; the
throne in the middle on its dais with the Sunken King sitting in it, a
skeleton in moth-eaten robes; the Enchanter's Crown on a velvet cushion at
his feet, entirely unguarded; a torch on either side; and on the right the
stair winding down behind the throne. The guardroom is behind the player,
at the bottom of the picture.

The crown is an overlay, so it goes when it is taken.
"""
from __future__ import annotations

import math
import random

import kit

W = 5.5
NORTH = 4.6
SOUTH = -7.5
CEIL = 9.0
DAIS = (0.0, 3.0)
WELL = (2.8, 4.3, 1.2, 3.4)     # the stairwell in the floor: x0, x1, y0, y1

HOTSPOTS = {
    "floor": 1,
    "throne": 2,
    "crown": 3,
    "exit:d": 4,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(59)

    basalt = kit.stone("basalt", (0.05, 0.05, 0.06), (0.015, 0.015, 0.02), scale=4.0)
    polished = kit.planks("black.floor", (0.06, 0.06, 0.075), (0.03, 0.03, 0.04), gap=(0.01, 0.01, 0.012), width=0.9, length=0.9)
    wall = kit.ashlar("throne.wall", (0.07, 0.07, 0.08), (0.03, 0.03, 0.035), mortar=(0.01, 0.01, 0.012), course=0.5, block=0.9)
    bone = kit.solid("bone", (0.55, 0.5, 0.4), rough=0.6)
    robe = kit.stone("robe.moth", (0.26, 0.04, 0.2), (0.07, 0.01, 0.05), scale=14.0)
    velvet = kit.solid("velvet", (0.28, 0.02, 0.04), rough=0.9, sheen=0.8)
    gold = kit.solid("crown.gold", (0.8, 0.58, 0.18), rough=0.22, metal=1.0)
    ruby = kit.solid("ruby", (0.6, 0.02, 0.04), rough=0.05, transmission=0.6)
    black = kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)

    # ---------------- floor, with the stairwell cut out of it
    x0, x1, y0, y1 = WELL
    floor = []
    for k, (a, b, c, d) in enumerate(((-W, x0, SOUTH, NORTH), (x1, W, SOUTH, NORTH), (x0, x1, SOUTH, y0), (x0, x1, y1, NORTH))):
        floor.append(kit.box(f"floor.{k}", (b - a, d - c, 0.1), ((a + b) / 2, (c + d) / 2, -0.05), polished))
    kit.hotspot(floor, HOTSPOTS["floor"])
    kit.box("north", (2 * W, 0.4, CEIL), (0, NORTH + 0.2, CEIL / 2), wall)
    kit.box("south", (2 * W, 0.4, CEIL), (0, SOUTH - 0.2, CEIL / 2), wall)
    for x in (-W, W):
        kit.box(f"side.{x}", (0.4, NORTH - SOUTH, CEIL), (x + (0.2 if x > 0 else -0.2), (NORTH + SOUTH) / 2, CEIL / 2), wall)
    kit.box("vault", (2 * W, NORTH - SOUTH, 0.3), (0, (NORTH + SOUTH) / 2, CEIL), black)
    for k in range(5):
        y = -5.5 + k * 2.5
        kit.box(f"rib.{k}", (2 * W, 0.4, 0.5), (0, y, CEIL - 1.2), basalt, rot=(0, 0, 0))

    # ---------------- columns of black stone
    for k, (cx, cy) in enumerate(((-4.4, 3.2), (4.4, 3.8), (-4.4, -0.6), (4.4, -0.6), (0.0, NORTH - 0.35))):
        kit.cylinder(f"column.{k}", 0.42, CEIL, (cx, cy, CEIL / 2), basalt, segments=24)
        kit.box(f"column.base.{k}", (1.1, 1.1, 0.3), (cx, cy, 0.15), basalt, bevel=0.03)
        kit.box(f"column.cap.{k}", (1.1, 1.1, 0.3), (cx, cy, CEIL - 0.15), basalt, bevel=0.03)

    # ---------------- the dais, the throne, the king at last at rest
    dx, dy = DAIS
    throne = [kit.box("dais.lower", (3.4, 2.4, 0.22), (dx, dy, 0.11), basalt, bevel=0.02),
              kit.box("dais.upper", (2.6, 1.8, 0.22), (dx, dy + 0.2, 0.33), basalt, bevel=0.02),
              kit.box("throne.seat", (1.3, 0.9, 0.55), (dx, dy + 0.35, 0.72), basalt, bevel=0.03),
              kit.box("throne.back", (1.4, 0.3, 2.6), (dx, dy + 0.8, 1.75), basalt, bevel=0.03),
              kit.prism("throne.crest", [(-0.7, 0), (0.7, 0), (0.35, 0.5), (0.0, 0.75), (-0.35, 0.5)], dy + 0.65, dy + 0.95, basalt)]
    throne[-1].location.z = 3.05
    for side in (-1, 1):
        throne.append(kit.box(f"throne.arm.{side}", (0.22, 0.9, 0.5), (dx + side * 0.75, dy + 0.35, 1.1), basalt, bevel=0.03))
    king = [kit.sphere("king.skull", 0.14, (dx, dy + 0.55, 1.95), bone, scale=(0.9, 1.0, 1.1)),
            kit.box("king.jaw", (0.14, 0.1, 0.06), (dx, dy + 0.47, 1.83), bone, bevel=0.01),
            kit.box("king.eye.l", (0.04, 0.02, 0.04), (dx - 0.05, dy + 0.42, 1.98), black),
            kit.box("king.eye.r", (0.04, 0.02, 0.04), (dx + 0.05, dy + 0.42, 1.98), black),
            kit.cylinder("king.robe", 0.38, 0.85, (dx, dy + 0.55, 1.4), robe, segments=16, radius2=0.22),
            kit.box("king.lap", (0.8, 0.7, 0.18), (dx, dy + 0.2, 1.06), robe, bevel=0.04),
            kit.box("king.hem", (0.8, 0.12, 0.6), (dx, dy - 0.12, 0.72), robe, rot=(6, 0, 0))]
    for k in range(4):
        king.append(kit.box(f"king.rib.{k}", (0.3, 0.06, 0.025), (dx, dy + 0.33, 1.6 - k * 0.08), bone))
    for side in (-1, 1):
        king.append(kit.cylinder(f"king.arm.{side}", 0.03, 0.55, (dx + side * 0.42, dy + 0.35, 1.38), bone, rot=(55, 0, side * 10), segments=8))
        king.append(kit.cylinder(f"king.shin.{side}", 0.03, 0.5, (dx + side * 0.18, dy - 0.15, 0.55), bone, rot=(6, 0, 0), segments=8))
        king.append(kit.box(f"king.foot.{side}", (0.08, 0.2, 0.04), (dx + side * 0.18, dy - 0.25, 0.46), bone))
    kit.hotspot(throne + king, HOTSPOTS["throne"])

    # ---------------- the crown on its cushion, entirely unguarded
    cx, cy = dx, dy - 1.45
    cushion = kit.box("cushion", (0.6, 0.45, 0.12), (cx, cy, 0.06), velvet, bevel=0.05)
    kit.hotspot([cushion], HOTSPOTS["throne"])
    crown = [kit.cylinder("crown.band", 0.13, 0.08, (cx, cy, 0.18), gold, segments=24)]
    for k in range(6):
        a = k / 6 * math.tau
        crown.append(kit.cylinder(f"crown.point.{k}", 0.025, 0.11, (cx + math.cos(a) * 0.12, cy + math.sin(a) * 0.12, 0.27), gold, segments=6,
                                  radius2=0.0))
        crown.append(kit.sphere(f"crown.gem.{k}", 0.016, (cx + math.cos(a + 0.5) * 0.135, cy + math.sin(a + 0.5) * 0.135, 0.18), ruby, segments=8))
    kit.hotspot(crown, HOTSPOTS["crown"])
    kit.point("crown.gleam", (1.0, 0.85, 0.6), 3, (cx, cy - 0.3, 0.6), radius=0.1)

    # ---------------- the stair winding down behind the throne, on the right
    stair = []
    for k in range(7):
        z = -0.22 - k * 0.22
        stair.append(kit.box(f"stair.{k}", (x1 - x0, 0.32, 0.22), ((x0 + x1) / 2, y0 + 0.16 + k * 0.3, z), basalt, bevel=0.01))
    stair += [kit.box("well.l", (0.1, y1 - y0, 2.2), (x0 - 0.05, (y0 + y1) / 2, -1.1), wall),
              kit.box("well.r", (0.1, y1 - y0, 2.2), (x1 + 0.05, (y0 + y1) / 2, -1.1), wall),
              kit.box("well.back", (x1 - x0, 0.1, 2.2), ((x0 + x1) / 2, y1 + 0.05, -1.1), wall),
              kit.box("well.dark", (x1 - x0, y1 - y0, 0.1), ((x0 + x1) / 2, (y0 + y1) / 2, -2.2), black)]
    for x in (x0, x1):
        stair.append(kit.box(f"well.curb.{x}", (0.18, y1 - y0, 0.4), (x, (y0 + y1) / 2, 0.2), basalt, bevel=0.02))
    kit.hotspot(stair, HOTSPOTS["exit:d"])

    # ---------------- torches either side
    kit.torch("torch.l", (-4.4, 2.75, 2.2), facing=(0.0, -1.0, 0.0), watts=55)
    kit.torch("torch.r", (4.4, 3.35, 2.2), facing=(0.0, -1.0, 0.0), watts=55)
    _ = rng

    # ---------------- light: torches, and the vault's blue dark
    kit.world((0.003, 0.003, 0.005), 1.0)
    kit.area("fill", (0.3, 0.35, 0.55), 30, (0, -5.0, 3.0), (70, 0, 0), 3.0, scatter=False)
    kit.area("vault.blue", (0.25, 0.3, 0.6), 120, (0, 1.0, CEIL - 1.5), (0, 0, 0), 6.0, scatter=False)
    air = kit.box("air", (2 * W, NORTH - SOUTH, CEIL), (0, (NORTH + SOUTH) / 2, CEIL / 2), kit.volume("throne.air", 0.01))
    air.pass_index = 0

    cam = kit.camera((0.0, -6.0, 1.7), (0.0, 4.0, 1.9), lens=24.0)

    return {
        "room": "throne",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["air"],
        "hiddenByDefault": [o.name for o in crown],
        "variants": [
            {"id": "crown", "when": {"here": "crown"}, "show": [o.name for o in crown]},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-4.6, 4.6, -2.3, 3.2],
                 "blocks": [[dx - 1.75, dx + 1.75, dy - 1.25, dy + 1.4], [x0 - 0.15, x1 + 0.15, y0 - 0.1, y1],
                            [cx - 0.35, cx + 0.35, cy - 0.25, cy + 0.25]]},
        "points": {"start": [-1.5, -0.6], "s": [0.0, -1.9], "u": [x0 - 0.4, 0.8]},
        "walkTo": {"throne": [dx + 0.6, cy - 0.3], "crown": [cx, cy - 0.45], "exit:d": [x0 - 0.4, 0.8], "exit:n": [0.0, -2.2]},
        "zones": [{"id": "exit:n", "rect": [0, 740, 1280, 60]}],
        "lights": {
            "ambient": [0.04, 0.04, 0.06],
            "key": {"color": [1.0, 0.6, 0.3], "dir": [0.0, -0.3, 0.95], "intensity": 0.3},
        },
        "music": "throne",
        "exposure": 1.1,
    }
