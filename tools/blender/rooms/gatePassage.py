"""The Passage of Brass, dark.

Composition follows the EGA painter in js/scenes.js: a corridor of riveted
brass, warm as a struck bell, its ribs running away south into darkness;
a corridor opening west on the left, faintly cold; a torch burning on the
right-hand wall. The gates the player came through are behind them, at the
bottom of the picture.

There is nothing here to handle, so it wakes when the player handles
anything (wake: "look").
"""
from __future__ import annotations

import random

import kit

HALF = 2.0
TOP = 4.0
NEAR, FAR = -7.0, 16.0
WEST = (1.0, 2.8)      # the west opening, along the left wall
WEST_H = 2.8

HOTSPOTS = {
    "floor": 1,
    "exit:s": 2,
    "exit:w": 3,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(47)

    plate = kit.solid("passage.brass", (0.5, 0.33, 0.13), rough=0.42, metal=1.0)
    rib_mat = kit.solid("gate.brass.dark", (0.28, 0.17, 0.06), rough=0.5, metal=1.0)
    deck = kit.planks("brass.deck", (0.34, 0.23, 0.09), (0.2, 0.13, 0.05), gap=(0.02, 0.012, 0.005), width=0.9, length=1.4)
    stone = kit.stone("side.stone", (0.12, 0.12, 0.13), (0.04, 0.04, 0.045), scale=5.0)
    black = kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)

    # ---------------- the deck and the brass skin
    kit.hotspot([kit.box("floor", (2 * HALF, FAR - NEAR, 0.1), (0, (NEAR + FAR) / 2, -0.05), deck)], HOTSPOTS["floor"])
    kit.box("roof", (2 * HALF, FAR - NEAR, 0.1), (0, (NEAR + FAR) / 2, TOP + 0.05), plate)
    kit.box("east.wall", (0.1, FAR - NEAR, TOP), (HALF + 0.05, (NEAR + FAR) / 2, TOP / 2), plate)
    kit.wall_with_openings("west.wall", NEAR, FAR, TOP, 0.1, [(WEST[0], WEST[1], 0.0, WEST_H)], plate, "Y", -HALF - 0.05)

    # Ribs every few paces, riveted, running away south.
    y = NEAR + 1.0
    k = 0
    while y < FAR - 1.0:
        if not (WEST[0] - 0.3 < y < WEST[1] + 0.3):
            for x in (-HALF + 0.08, HALF - 0.08):
                kit.box(f"rib.post.{k}.{x}", (0.16, 0.22, TOP), (x, y, TOP / 2), rib_mat, bevel=0.01)
                for z in range(9):
                    kit.sphere(f"rivet.{k}.{x}.{z}", 0.022, (x - 0.08 * (1 if x > 0 else -1), y, 0.3 + z * 0.42), rib_mat, segments=8)
        kit.box(f"rib.beam.{k}", (2 * HALF, 0.22, 0.18), (0, y, TOP - 0.09), rib_mat, bevel=0.01)
        for j in range(7):
            kit.sphere(f"rivet.top.{k}.{j}", 0.022, (-1.5 + j * 0.5, y - 0.11, TOP - 0.12), rib_mat, segments=8)
        y += 2.3
        k += 1
    for j in range(int((FAR - NEAR) / 1.15)):
        yy = NEAR + 0.6 + j * 1.15
        kit.box(f"seam.{j}", (0.02, 0.03, TOP - 0.2), (HALF - 0.01, yy, TOP / 2), rib_mat)

    # ---------------- the dark it runs into
    kit.hotspot([kit.box("far.void", (2 * HALF, 0.1, TOP), (0, FAR, TOP / 2), black),
                 kit.box("far.floor", (2 * HALF, 3.0, 0.1), (0, FAR - 1.5, -0.04), deck)], HOTSPOTS["exit:s"])

    # ---------------- the corridor opening west
    cy = sum(WEST) / 2
    side = [kit.box("west.corr.floor", (4.0, WEST[1] - WEST[0], 0.1), (-HALF - 2.0, cy, -0.05), stone),
            kit.box("west.corr.l", (4.0, 0.1, WEST_H + 0.2), (-HALF - 2.0, WEST[0] - 0.05, WEST_H / 2), stone),
            kit.box("west.corr.r", (4.0, 0.1, WEST_H + 0.2), (-HALF - 2.0, WEST[1] + 0.05, WEST_H / 2), stone),
            kit.box("west.corr.top", (4.0, WEST[1] - WEST[0], 0.1), (-HALF - 2.0, cy, WEST_H + 0.05), stone),
            kit.box("west.corr.end", (0.1, WEST[1] - WEST[0], WEST_H), (-HALF - 4.0, cy, WEST_H / 2), black)]
    for yy in WEST:
        side.append(kit.box(f"west.jamb.{yy}", (0.14, 0.2, WEST_H), (-HALF + 0.02, yy, WEST_H / 2), rib_mat, bevel=0.01))
    side.append(kit.box("west.lintel", (0.14, WEST[1] - WEST[0] + 0.3, 0.2), (-HALF + 0.02, cy, WEST_H + 0.08), rib_mat))
    kit.hotspot(side, HOTSPOTS["exit:w"])
    kit.point("west.cold", (0.45, 0.75, 0.9), 10, (-HALF - 3.0, cy, 1.6), radius=0.3)

    # ---------------- the torch on the right-hand wall
    kit.torch("torch", (HALF - 0.06, 2.4, 1.9), facing=(-1.0, 0.0, 0.0), watts=55)
    kit.torch("torch.far", (HALF - 0.06, 9.3, 1.9), facing=(-1.0, 0.0, 0.0), watts=35)
    _ = rng

    # ---------------- light: the torches, and a hum you feel in your teeth
    kit.world((0.003, 0.003, 0.004), 1.0)
    kit.area("fill", (0.5, 0.42, 0.32), 20, (0, -5.0, 3.0), (70, 0, 0), 3.0, scatter=False)
    air = kit.box("air", (2 * HALF, FAR - NEAR, TOP), (0, (NEAR + FAR) / 2, TOP / 2), kit.volume("brass.air", 0.02, color=(1.0, 0.85, 0.65)))
    air.pass_index = 0

    cam = kit.camera((0.0, -6.0, 1.7), (0.0, 10.0, 1.55), lens=24.0)

    # The camera looks south into the halls, so west belongs on the right: the room
    # was built the other way round, and is mirrored to match its compass.
    return kit.mirror_x({
        "room": "gatePassage",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["air"],
        "hiddenByDefault": [],
        "variants": [],
        "wake": "look",
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-1.5, 1.5, -2.2, 7.0], "blocks": []},
        "points": {"start": [0.6, -0.6], "s": [0.0, -1.9], "n": [0.0, 6.5], "e": [-1.3, cy]},
        "walkTo": {"exit:s": [0.0, 6.9], "exit:w": [-1.45, cy], "exit:n": [0.0, -2.15]},
        # North, back to the gates, is behind you.
        "zones": [{"id": "exit:n", "rect": [0, 740, 1280, 60]}],
        "lights": {
            "ambient": [0.05, 0.04, 0.03],
            "key": {"color": [1.0, 0.6, 0.3], "dir": [-1.0, -0.2, 0.0], "intensity": 0.35},
        },
        "music": "throne",
        "exposure": 1.1,
    })
