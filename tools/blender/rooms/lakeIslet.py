"""The Islet of the Chalice.

Composition follows the EGA painter in js/scenes.js: a small island of dry
grass, absurdly tidy for a place no one has visited in a thousand years,
with black water glowing faintly blue all around it to the edge of the
picture; the stone plinth in the middle with the gilded chalice on top,
dusty and unhurried; and the patched rowboat drawn up on the left, the way
back east to the shore.

The chalice is an overlay, so it goes when it is taken.
"""
from __future__ import annotations

import math
import random

import kit


def unseen(*_args, **_kwargs) -> None:
    """Nothing: the glowing fungus specks read as dust on screen."""

ISLE = (0.0, 0.9)
PLINTH = (0.0, 1.4)
BOAT = (-3.4, -1.0)

HOTSPOTS = {
    "floor": 1,
    "plinth": 2,
    "chalice": 3,
    "exit:e": 4,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(83)

    rock = kit.stone("cave.rock", (0.13, 0.125, 0.12), (0.035, 0.034, 0.033), scale=3.0, bump=0.15)
    lake = kit.water("lake", (0.004, 0.01, 0.02))
    turf = kit.stone("islet.turf", (0.12, 0.17, 0.06), (0.05, 0.08, 0.025), scale=14.0)
    blade_mats = [kit.solid("blade.dry", (0.22, 0.24, 0.1), rough=0.8), kit.solid("blade.green", (0.08, 0.18, 0.05), rough=0.8)]
    earth = kit.stone("earth", (0.13, 0.09, 0.05), (0.04, 0.028, 0.016), scale=6.0, bump=0.15)
    plinth_stone = kit.stone("pedestal.stone", (0.3, 0.29, 0.27), (0.15, 0.145, 0.14), scale=6.0)
    gold = kit.solid("crown.gold", (0.8, 0.58, 0.18), rough=0.22, metal=1.0)
    fungus = kit.solid("fungus", (0.3, 0.8, 0.9), rough=0.6, emission=(0.35, 0.85, 1.0), strength=6.0)
    hull = kit.wood("boat.rotten", (0.16, 0.11, 0.07), (0.06, 0.04, 0.025), grain=18.0, rough=0.85)
    cloth = kit.stone("curtain", (0.30, 0.07, 0.22), (0.12, 0.03, 0.09), scale=11.0)
    pitch = kit.solid("pitch", (0.02, 0.018, 0.015), rough=0.3)

    # ---------------- the islet, absurdly tidy
    ix, iy = ISLE
    ground = [kit.sphere("islet", 4.2, (ix, iy, -0.42), turf, scale=(1.0, 0.72, 0.11), segments=48),
              kit.sphere("islet.bank", 4.4, (ix, iy, -0.5), earth, scale=(1.0, 0.74, 0.1), segments=48)]
    for k in range(220):
        a, r = rng.uniform(0, math.tau), 3.8 * math.sqrt(rng.random())
        x, y = ix + math.cos(a) * r, iy + math.sin(a) * r * 0.7
        h = rng.uniform(0.06, 0.16)
        ground.append(kit.cylinder(f"blade.{k}", 0.008, h, (x, y, 0.02 + h / 2), rng.choice(blade_mats), segments=3, radius2=0.0,
                                   rot=(rng.uniform(-12, 12), rng.uniform(-12, 12), 0)))
    kit.hotspot(ground, HOTSPOTS["floor"])
    kit.box("lake", (60, 50, 0.05), (0, 12, -0.18), lake)

    # ---------------- the stone plinth, and the chalice on it
    px, py = PLINTH
    plinth = [kit.box("plinth.foot", (0.6, 0.6, 0.12), (px, py, 0.06), plinth_stone, bevel=0.02),
              kit.box("plinth.shaft", (0.36, 0.36, 0.95), (px, py, 0.6), plinth_stone),
              kit.box("plinth.top", (0.55, 0.55, 0.08), (px, py, 1.11), plinth_stone, bevel=0.015)]
    kit.hotspot(plinth, HOTSPOTS["plinth"])
    chalice = [kit.cylinder("chalice.foot", 0.07, 0.015, (px, py, 1.16), gold, segments=20),
               kit.cylinder("chalice.stem", 0.014, 0.12, (px, py, 1.23), gold, segments=10),
               kit.sphere("chalice.knop", 0.024, (px, py, 1.24), gold, segments=10),
               kit.cylinder("chalice.cup", 0.045, 0.1, (px, py, 1.34), gold, segments=20, radius2=0.07)]
    kit.hotspot(chalice, HOTSPOTS["chalice"])
    gleam = kit.point("chalice.gleam", (1.0, 0.82, 0.45), 6, (px + 0.2, py - 0.4, 1.6), radius=0.1)

    # ---------------- the patched boat, drawn up on the left: the way back
    bx, by = BOAT
    hub = kit.empty("boat", (bx, by, -0.05))
    boat = [kit.box("boat.keel", (2.2, 0.5, 0.06), (bx, by, 0.0), hull)]
    for side in (-1, 1):
        boat.append(kit.box(f"boat.side.{side}", (2.2, 0.05, 0.42), (bx, by + side * 0.38, 0.19), hull, rot=(side * -22, 0, 0)))
    boat.append(kit.box("boat.transom", (0.05, 0.8, 0.4), (bx - 1.1, by, 0.19), hull))
    boat.append(kit.box("boat.thwart", (0.2, 0.75, 0.04), (bx - 0.2, by, 0.27), hull))
    boat.append(kit.cylinder("patch.cloth", 0.11, 0.02, (bx - 0.25, by - 0.45, 0.15), cloth, rot=(70, 0, 0), segments=12))
    boat.append(kit.sphere("patch.pitch", 0.07, (bx - 0.25, by - 0.47, 0.15), pitch, scale=(1.2, 0.4, 0.9)))
    kit.parent(boat, hub)
    hub.rotation_euler = (0, math.radians(-4), math.radians(-30))
    kit.hotspot(boat, HOTSPOTS["exit:e"])

    # ---------------- the cavern, far off, and the fungi on its roof
    kit.box("roof", (60, 50, 0.5), (0, 14, 8.5), rock)
    kit.rock_line("far.wall", (-22, 26, 1.5), (22, 26, 1.5), 14, 2.5, 4.0, rock, seed=101, jitter=(1.0, 2.0, 2.0))
    for k in range(120):
        unseen(f"roof.fungus.{k}", rng.uniform(0.03, 0.07), (rng.uniform(-14, 14), rng.uniform(0, 24), 8.2 + rng.uniform(-0.1, 0.1)),
                   fungus, segments=6)
    for k in range(30):
        unseen(f"far.fungus.{k}", rng.uniform(0.04, 0.09), (rng.uniform(-18, 18), 24.5, rng.uniform(0.0, 2.5)), fungus, segments=6)

    # ---------------- light: the lake's blue, and the gold's own small gleam
    kit.world((0.002, 0.004, 0.008), 1.0)
    kit.area("roof.glow", (0.3, 0.6, 0.9), 800, (0, 6, 7.5), (0, 0, 0), 16.0, scatter=False)
    kit.area("front.fill", (0.3, 0.45, 0.65), 90, (0, -5.5, 3.0), (70, 0, 0), 4.0, scatter=False)
    air = kit.box("air", (30, 30, 8), (0, 10, 4), kit.volume("lake.air", 0.006, color=(0.75, 0.9, 1.0)))
    air.pass_index = 0

    cam = kit.camera((0.0, -6.0, 1.7), (0.0, 6.0, 0.95), lens=24.0)

    return {
        "room": "lakeIslet",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["air"],
        "hiddenByDefault": [o.name for o in chalice] + [gleam.name],
        "variants": [
            {"id": "chalice", "when": {"here": "chalice"}, "show": [o.name for o in chalice] + [gleam.name]},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-3.0, 3.0, -1.6, 2.4], "blocks": [[px - 0.45, px + 0.45, py - 0.45, py + 0.45]]},
        "points": {"start": [-1.2, -0.7], "w": [-2.3, -0.5]},
        "walkTo": {"plinth": [px, py - 0.75], "chalice": [px, py - 0.75], "exit:e": [-2.6, -0.8]},
        "zones": [],
        "lights": {
            "ambient": [0.06, 0.09, 0.13],
            "key": {"color": [0.35, 0.7, 1.0], "dir": [0.0, -1.0, 0.0], "intensity": 0.35},
        },
        "music": "lake",
        "exposure": 1.1,
    }
