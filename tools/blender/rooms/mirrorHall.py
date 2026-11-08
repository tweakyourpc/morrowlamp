"""The Hall of Mirrors, dark.

Composition follows the EGA painter in js/scenes.js: five tall mirrors
across the far wall, more down the sides, a dozen of the room looking back
at itself; a torch in the middle of the far wall; and the leftmost mirror
slightly, subtly wrong: it does not quite reflect the torchlight. The way
back to the brass passage is a door in the east wall.

Two overlays: flour thrown at the wrong mirror traces the outline of a door
(the flourRevealed flag), and when it opens (mirrorOpened) the mirror
swings out into the hall on its hinge to show the way west.
"""
from __future__ import annotations

import math
import random

import kit

W = 5.2
NORTH = 3.8
SOUTH = -7.5
CEIL = 3.9
PANEL_W, PANEL_Z = 1.6, (0.25, 3.15)
PANELS = [-4.0, -2.0, 0.0, 2.0, 4.0]       # centres along the far wall; the first is the wrong one
DOOR = (0.3, 1.7)
DOOR_H = 2.5

HOTSPOTS = {
    "floor": 1,
    "mirror": 2,
    "exit:e": 3,
    "exit:w": 4,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(71)

    wall = kit.ashlar("mirror.wall", (0.11, 0.105, 0.1), (0.045, 0.043, 0.04), mortar=(0.02, 0.02, 0.02), course=0.36, block=0.6)
    floor_mat = kit.planks("black.floor", (0.06, 0.06, 0.075), (0.03, 0.03, 0.04), gap=(0.01, 0.01, 0.012), width=0.9, length=0.9)
    silver = kit.solid("mirror.silver", (0.82, 0.86, 0.88), rough=0.02, metal=1.0)
    wrong = kit.solid("mirror.wrong", (0.02, 0.025, 0.05), rough=0.08)
    frame_mat = kit.solid("mirror.frame", (0.35, 0.25, 0.1), rough=0.4, metal=1.0)
    flour = kit.solid("flour", (0.85, 0.84, 0.8), rough=0.95)
    passage = kit.stone("sanctum.stone", (0.09, 0.085, 0.09), (0.03, 0.028, 0.03), scale=4.0)
    brass = kit.solid("passage.brass", (0.5, 0.33, 0.13), rough=0.42, metal=1.0)

    # ---------------- shell, with an opening hidden behind the wrong mirror
    z0, z1 = PANEL_Z
    hx0 = PANELS[0] - PANEL_W / 2
    kit.hotspot([kit.box("floor", (2 * W, NORTH - SOUTH, 0.1), (0, (NORTH + SOUTH) / 2, -0.05), floor_mat)], HOTSPOTS["floor"])
    kit.box("ceiling", (2 * W, NORTH - SOUTH, 0.2), (0, (NORTH + SOUTH) / 2, CEIL + 0.1), wall)
    kit.wall_with_openings("north", -W, W, CEIL, 0.4, [(hx0, hx0 + PANEL_W, z0, z1)], wall, "X", NORTH + 0.2)
    kit.box("south", (2 * W, 0.4, CEIL), (0, SOUTH - 0.2, CEIL / 2), wall)
    kit.box("west", (0.4, NORTH - SOUTH, CEIL), (-W - 0.2, (NORTH + SOUTH) / 2, CEIL / 2), wall)
    kit.wall_with_openings("east", SOUTH, NORTH, CEIL, 0.4, [(DOOR[0], DOOR[1], 0.0, DOOR_H)], wall, "Y", W + 0.2)

    # ---------------- the mirrors
    mirrors = []
    for k, cx in enumerate(PANELS[1:], start=1):
        mirrors.append(kit.box(f"mirror.{k}", (PANEL_W - 0.12, 0.02, z1 - z0 - 0.12), (cx, NORTH - 0.02, (z0 + z1) / 2), silver))
        mirrors.append(kit.box(f"mirror.frame.{k}", (PANEL_W, 0.06, z1 - z0), (cx, NORTH + 0.01, (z0 + z1) / 2), frame_mat, bevel=0.02))
    for side in (-1, 1):
        for k, cy in enumerate((-1.2, 1.4)):
            x = side * (W - 0.02)
            mirrors.append(kit.box(f"mirror.side.{side}.{k}", (0.02, PANEL_W - 0.12, z1 - z0 - 0.12), (x, cy, (z0 + z1) / 2), silver))
            mirrors.append(kit.box(f"mirror.side.frame.{side}.{k}", (0.06, PANEL_W, z1 - z0), (x + side * 0.03, cy, (z0 + z1) / 2), frame_mat,
                                   bevel=0.02))
    # The wrong one, hung as a door on its left edge.
    leaf = kit.box("mirror.west.frame", (PANEL_W, 0.08, z1 - z0), (hx0, NORTH - 0.02, (z0 + z1) / 2), frame_mat, pivot=(-1, 0, 0), bevel=0.02)
    glass = kit.box("mirror.west", (PANEL_W - 0.12, 0.02, z1 - z0 - 0.12), (PANELS[0], NORTH - 0.07, (z0 + z1) / 2), wrong)
    kit.parent([glass], leaf)
    mirrors += [leaf, glass]
    kit.hotspot(mirrors, HOTSPOTS["mirror"])

    # Flour, thrown at it, tracing a door.
    traced = [kit.box("flour.top", (PANEL_W + 0.1, 0.03, 0.04), (PANELS[0], NORTH - 0.08, z1 + 0.03), flour),
              kit.box("flour.l", (0.04, 0.03, z1 - z0 + 0.08), (hx0 - 0.03, NORTH - 0.08, (z0 + z1) / 2), flour),
              kit.box("flour.r", (0.04, 0.03, z1 - z0 + 0.08), (hx0 + PANEL_W + 0.03, NORTH - 0.08, (z0 + z1) / 2), flour),
              kit.box("flour.drift", (PANEL_W + 0.4, 0.5, 0.01), (PANELS[0], NORTH - 0.35, 0.005), flour)]
    for k in range(14):
        traced.append(kit.sphere(f"flour.speck.{k}", 0.012, (PANELS[0] + rng.uniform(-1.0, 1.0), NORTH - rng.uniform(0.2, 1.0), 0.004), flour,
                                 scale=(1, 1, 0.3), segments=6))
    kit.hotspot(traced, HOTSPOTS["mirror"])

    # Behind it, the way to the sanctum.
    hc = PANELS[0]
    beyond = [kit.box("west.beyond.floor", (PANEL_W, 3.0, 0.1), (hc, NORTH + 1.7, z0 - 0.05), passage),
              kit.box("west.beyond.l", (0.1, 3.0, z1 - z0), (hx0 - 0.05, NORTH + 1.7, (z0 + z1) / 2), passage),
              kit.box("west.beyond.r", (0.1, 3.0, z1 - z0), (hx0 + PANEL_W + 0.05, NORTH + 1.7, (z0 + z1) / 2), passage),
              kit.box("west.beyond.top", (PANEL_W, 3.0, 0.1), (hc, NORTH + 1.7, z1 + 0.05), passage),
              kit.box("west.beyond.end", (PANEL_W, 0.1, z1 - z0), (hc, NORTH + 3.2, (z0 + z1) / 2), passage)]
    kit.hotspot(beyond, HOTSPOTS["exit:w"])
    kit.point("sanctum.weather", (0.75, 0.6, 1.0), 14, (hc, NORTH + 2.4, 1.6), radius=0.3)

    # ---------------- the way back to the brass passage
    dc = sum(DOOR) / 2
    way = [kit.box("east.beyond.floor", (2.5, DOOR[1] - DOOR[0], 0.1), (W + 1.45, dc, -0.05), brass),
           kit.box("east.beyond.back", (0.1, 2.0, 3.0), (W + 2.7, dc, 1.5), brass),
           kit.box("east.beyond.l", (2.5, 0.1, 3.0), (W + 1.45, DOOR[0] - 0.05, 1.5), brass),
           kit.box("east.beyond.r", (2.5, 0.1, 3.0), (W + 1.45, DOOR[1] + 0.05, 1.5), brass),
           kit.box("east.beyond.top", (2.5, DOOR[1] - DOOR[0], 0.1), (W + 1.45, dc, DOOR_H + 0.05), brass)]
    kit.hotspot(way, HOTSPOTS["exit:e"])
    kit.point("brass.glow", (1.0, 0.62, 0.28), 30, (W + 1.8, dc, 1.8), radius=0.3)

    # ---------------- the torch, high in the middle of the far wall
    kit.torch("torch", (0.0, NORTH - 0.32, 3.25), facing=(0.0, -1.0, 0.0), watts=40)
    kit.box("torch.plate", (0.3, 0.06, 0.4), (0.0, NORTH - 0.27, 3.3), frame_mat)
    _ = math

    # ---------------- light
    kit.world((0.002, 0.002, 0.003), 1.0)
    kit.area("fill", (0.35, 0.42, 0.55), 25, (0, -5.0, 3.0), (70, 0, 0), 3.0, scatter=False)

    cam = kit.camera((0.0, -6.0, 1.7), (0.0, 4.0, 1.5), lens=24.0)

    return {
        "room": "mirrorHall",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": [],
        "hiddenByDefault": [o.name for o in traced],
        "variants": [
            {"id": "flour", "when": {"flag": "flourRevealed"}, "show": [o.name for o in traced]},
            {"id": "mirror.open", "when": {"flag": "mirrorOpened"}, "rotate": {leaf.name: [0, 0, -72]}},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-4.6, 4.6, -2.3, 2.9], "blocks": []},
        "points": {"start": [0.0, -0.6], "w": [4.2, dc], "e": [-3.4, 2.2]},
        "walkTo": {"mirror": [-3.4, 2.2], "exit:w": [-3.9, 2.6], "exit:e": [4.55, dc]},
        "zones": [],
        "lights": {
            "ambient": [0.04, 0.045, 0.055],
            "key": {"color": [1.0, 0.6, 0.3], "dir": [0.0, -0.4, 0.9], "intensity": 0.25},
        },
        "music": "under",
        "exposure": 1.1,
    }
