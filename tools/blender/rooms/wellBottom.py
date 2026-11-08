"""The bottom of the dry well, forty feet down.

Composition follows the EGA painter in js/scenes.js: a round shaft of
stone rising out of the picture, a pale shaft of night falling down it,
the rusty ladder on the right, and a floor of old leaves with the
sunstone glowing among them. The sunstone is its own lamp: while it lies
here it lights the leaves around it; take it and the well goes back to
moonlight.
"""
from __future__ import annotations

import math
import random

import kit

CX, CY = 0.0, 1.7   # centre of the shaft
R = 3.0             # its radius
TOP = 13.0          # forty feet, near enough
LADDER_A = math.radians(58)
STONE = (-0.35, 2.15)

HOTSPOTS = {
    "floor": 1,
    "well": 2,
    "sunstone": 3,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(23)

    shaft = kit.ashlar("well.stone", (0.15, 0.145, 0.135), (0.06, 0.058, 0.055), mortar=(0.02, 0.02, 0.02), course=0.28, block=0.5)
    leafbed = kit.stone("leafbed", (0.13, 0.07, 0.03), (0.04, 0.025, 0.012), scale=16.0)
    leaf_mats = [kit.solid("leaf.brown", (0.16, 0.08, 0.03), rough=0.85),
                 kit.solid("leaf.red", (0.22, 0.05, 0.03), rough=0.85),
                 kit.solid("leaf.dark", (0.06, 0.045, 0.03), rough=0.9)]
    rust = kit.solid("rust", (0.20, 0.08, 0.03), rough=0.75, metal=0.4)
    sun = kit.solid("sunstone", (1.0, 0.75, 0.35), rough=0.3, emission=(1.0, 0.68, 0.25), strength=30.0)

    # ---------------- the floor of old leaves
    floor = [kit.cylinder("floor", R + 0.2, 0.1, (CX, CY, -0.05), leafbed, segments=48)]
    for k in range(140):
        a, r = rng.uniform(0, math.tau), R * math.sqrt(rng.random()) * 0.95
        floor.append(kit.sphere(f"leaf.{k}", rng.uniform(0.05, 0.1), (CX + math.cos(a) * r, CY + math.sin(a) * r, 0.01),
                                rng.choice(leaf_mats), scale=(1.0, 0.55, 0.08), segments=8))
        floor[-1].rotation_euler = (rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2), rng.uniform(0, math.tau))
    kit.hotspot(floor, HOTSPOTS["floor"])

    # ---------------- the shaft, block by block, all the way up
    walls = []
    n = 30
    for k in range(n):
        a = k / n * math.tau
        walls.append(kit.box(f"shaft.{k}", (2 * math.pi * R / n + 0.03, 0.4, TOP), (CX + math.cos(a) * (R + 0.2), CY + math.sin(a) * (R + 0.2), TOP / 2),
                             shaft, rot=(0, 0, math.degrees(a) + 90)))
    # A few blocks have started to come away.
    for k in range(9):
        a = rng.uniform(0.2, math.pi - 0.2)
        z = rng.uniform(0.5, 5.0)
        kit.box(f"proud.{k}", (0.5, 0.18, 0.28), (CX + math.cos(a) * (R - 0.02), CY + math.sin(a) * (R - 0.02), z), shaft,
                rot=(0, 0, math.degrees(a) + 90 + rng.uniform(-6, 6)), bevel=0.02)

    # ---------------- the rusty ladder of dubious intent
    ladder = []
    tx, ty = -math.sin(LADDER_A), math.cos(LADDER_A)
    lx, ly = CX + math.cos(LADDER_A) * (R - 0.12), CY + math.sin(LADDER_A) * (R - 0.12)
    for side in (-1, 1):
        ladder.append(kit.box(f"ladder.rail.{side}", (0.04, 0.05, TOP), (lx + tx * side * 0.24, ly + ty * side * 0.24, TOP / 2), rust,
                              rot=(0, 0, math.degrees(LADDER_A))))
    for k in range(int(TOP / 0.3)):
        if rng.random() < 0.06:
            continue                    # rusted through
        ladder.append(kit.box(f"ladder.rung.{k}", (0.05, 0.48, 0.03), (lx - math.cos(LADDER_A) * 0.03, ly - math.sin(LADDER_A) * 0.03, 0.3 + k * 0.3),
                              rust, rot=(0, 0, math.degrees(LADDER_A))))
    kit.hotspot(ladder, HOTSPOTS["well"])      # the ladder is the way up; the walls are only walls

    # ---------------- the sunstone, a small piece of the sun
    stone = kit.sphere("sunstone", 0.085, (STONE[0], STONE[1], 0.07), sun, scale=(1.0, 0.85, 0.7), segments=16)
    glow = kit.point("sunstone.light", (1.0, 0.7, 0.32), 12, (STONE[0], STONE[1], 0.3), radius=0.12)
    kit.hotspot([stone], HOTSPOTS["sunstone"])

    # ---------------- light: the night, a long way up
    kit.world((0.006, 0.008, 0.016), 1.0)
    kit.sun("moon", (0.62, 0.72, 1.0), 1.6, direction=(0.22, 0.12, -1.0), angle=0.6)
    kit.area("mouth", (0.4, 0.5, 0.8), 400, (CX, CY, TOP + 0.5), (0, 0, 0), 2 * R, scatter=False)
    air = kit.box("air", (2 * R, 2 * R, TOP), (CX, CY, TOP / 2), kit.volume("well.air", 0.018, color=(0.85, 0.9, 1.0), anisotropy=0.6))
    air.pass_index = 0

    cam = kit.camera((0.0, -1.2, 1.5), (0.0, 4.7, 1.55), lens=18.0)

    return {
        "room": "wellBottom",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["air"],
        "hiddenByDefault": [stone.name, glow.name],
        "variants": [
            {"id": "sunstone", "when": {"here": "sunstone"}, "show": [stone.name, glow.name]},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-1.9, 1.9, 0.8, 3.6], "blocks": []},
        "points": {"start": [-0.9, 1.4], "u": [0.9, 3.1], "d": [0.9, 3.1]},
        "walkTo": {"well": [0.9, 3.1], "exit:u": [0.9, 3.1], "sunstone": [STONE[0], STONE[1] - 0.45]},
        # Up is the ladder, which is part of the well.
        "zones": [{"id": "exit:u", "fromHotspot": "well"}],
        "lights": {
            "ambient": [0.07, 0.08, 0.12],
            "key": {"color": [0.62, 0.72, 1.0], "dir": [0.2, -1.0, -0.1], "intensity": 0.35},
        },
        "music": "outside",
        "exposure": 1.1,
    }
