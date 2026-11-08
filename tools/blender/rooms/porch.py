"""The front porch of Ashcombe, on a misty night.

Composition follows the EGA painter in js/scenes.js: the iron-banded door
a little left of centre, posts at either side holding the porch roof up
(mostly), the swing chair that has not swung hanging to the right, warped
boards, and the doormat in front of the door doing its best. Moonlight
comes from behind the player, low, through mist; the porch roof keeps the
door in shadow, so the lantern finds it.

Only the doormat can be taken (an overlay); the porch wakes when the player handles
anything here (wake: "look").
"""
from __future__ import annotations

import random

import kit

HALF = 2.85        # half-width of the porch deck, post to post: the posts frame the picture
FRONT = -2.05      # front edge of the deck
WALL = 2.55        # the house wall plane
ROOF = 3.1         # porch ceiling height
GROUND = -0.45     # the yard, a step and a half down
DOOR_X = -0.1
DOOR_W, DOOR_H = 1.4, 2.6

HOTSPOTS = {
    "floor": 1,
    "door": 2,
    "doormat": 3,
    "exit:s": 4,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(7)

    boards = kit.wood("porch.boards", (0.24, 0.20, 0.15), (0.10, 0.085, 0.065), grain=10.0, rough=0.75)
    weathered = kit.wood("porch.posts", (0.19, 0.17, 0.14), (0.09, 0.08, 0.065), grain=26.0, along="Z", rough=0.8)
    oak = kit.wood("door.oak", (0.20, 0.11, 0.05), (0.08, 0.04, 0.02), grain=14.0, along="Z", rough=0.6)
    wall = kit.ashlar("facade", (0.17, 0.165, 0.155), (0.085, 0.085, 0.09), mortar=(0.03, 0.03, 0.03))
    dressed = kit.ashlar("surround", (0.22, 0.21, 0.19), (0.13, 0.125, 0.12), mortar=(0.04, 0.04, 0.04), course=0.44, block=0.36)
    slate = kit.stone("slate", (0.10, 0.11, 0.13), (0.04, 0.045, 0.05), scale=14.0)
    gravel = kit.stone("gravel", (0.20, 0.19, 0.17), (0.07, 0.065, 0.06), scale=40.0)
    leaves = kit.stone("leaves", (0.07, 0.11, 0.05), (0.015, 0.03, 0.012), scale=18.0)
    iron = kit.solid("iron", (0.05, 0.05, 0.055), rough=0.55, metal=0.85)
    brass = kit.solid("brass.worn", (0.70, 0.52, 0.24), rough=0.22, metal=1.0)
    cushion = kit.solid("cushion", (0.30, 0.04, 0.035), rough=0.9, sheen=0.6)
    coir = kit.wood("coir", (0.30, 0.21, 0.11), (0.13, 0.085, 0.04), grain=80.0, rough=0.95)
    ink = kit.solid("mat.letters", (0.06, 0.035, 0.02), rough=0.95)
    window = kit.glass("window", (0.55, 0.6, 0.62), rough=0.08)
    black = kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)

    # ---------------- the deck: warped boards over a dark gap
    deck = []
    y = FRONT
    i = 0
    while y < WALL - 0.05:
        w = 0.14
        board = kit.box(f"board.{i}", (2 * HALF + 0.3, w - 0.012, 0.05), (rng.gauss(0, 0.02), y + w / 2, -0.025), boards,
                        rot=(rng.uniform(-0.7, 0.7), rng.uniform(-0.25, 0.25), rng.uniform(-0.15, 0.15)), bevel=0.004)
        deck.append(board)
        y += w
        i += 1
    deck.append(kit.box("deck.under", (2 * HALF + 0.3, WALL - FRONT, 0.05), (0, (WALL + FRONT) / 2, -0.09), black))
    kit.hotspot(deck, HOTSPOTS["floor"])

    # Steps down to the yard, and the yard itself: walking there leaves.
    away = [kit.box("yard", (24, 10, 0.1), (0, FRONT - 5, GROUND - 0.05), gravel)]
    for k, (y0, z) in enumerate(((FRONT, -0.17), (FRONT - 0.36, -0.32))):
        away.append(kit.box(f"step.{k}", (2.6, 0.38, 0.06), (0, y0 - 0.19, z), boards, bevel=0.006))
        away.append(kit.box(f"step.riser.{k}", (2.6, 0.04, z - GROUND), (0, y0 - 0.02, (z + GROUND) / 2), weathered))
    away.append(kit.box("deck.skirt", (2 * HALF + 0.3, 0.05, -GROUND), (0, FRONT - 0.03, GROUND / 2), weathered))
    kit.hotspot(away, HOTSPOTS["exit:s"])

    # ---------------- the house: dressed stone, a door, two dark windows
    openings = [(DOOR_X - DOOR_W / 2 - 0.1, DOOR_X + DOOR_W / 2 + 0.1, 0.0, DOOR_H + 0.1),
                (-3.1, -2.0, 1.0, 2.7), (2.0, 3.1, 1.0, 2.7)]
    kit.wall_with_openings("facade", -9.0, 9.0, 7.0, 0.4, openings, wall, "X", WALL + 0.2)
    kit.box("facade.plinth", (18, 0.5, 0.35), (0, WALL + 0.05, GROUND + 0.17), dressed)
    for wx in (-2.55, 2.55):
        kit.box(f"window.void.{wx}", (1.1, 0.1, 1.7), (wx, WALL + 0.35, 1.85), black)
        kit.box(f"window.glass.{wx}", (1.1, 0.01, 1.7), (wx, WALL + 0.12, 1.85), window)
        kit.box(f"window.sill.{wx}", (1.35, 0.3, 0.1), (wx, WALL - 0.05, 0.96), dressed, bevel=0.01)
        kit.box(f"window.head.{wx}", (1.35, 0.12, 0.22), (wx, WALL - 0.02, 2.8), dressed, bevel=0.01)
        kit.box(f"window.mullion.{wx}", (0.05, 0.05, 1.7), (wx, WALL + 0.1, 1.85), weathered)
        kit.box(f"window.transom.{wx}", (1.1, 0.05, 0.05), (wx, WALL + 0.1, 2.25), weathered)
        # Shutters: the left one hangs open by one hinge.
        side = -1 if wx < 0 else 1
        kit.box(f"shutter.{wx}", (0.55, 0.04, 1.75), (wx + side * 0.84, WALL - 0.04, 1.85), weathered,
                rot=(0, 0, 0) if side > 0 else (4, 0, -10))
    # The door surround: jambs and a lintel of bigger blocks.
    for jx in (DOOR_X - DOOR_W / 2 - 0.22, DOOR_X + DOOR_W / 2 + 0.22):
        kit.box(f"surround.jamb.{jx}", (0.3, 0.3, DOOR_H + 0.1), (jx, WALL - 0.02, (DOOR_H + 0.1) / 2), dressed, bevel=0.01)
    kit.box("surround.lintel", (DOOR_W + 0.9, 0.32, 0.36), (DOOR_X, WALL - 0.02, DOOR_H + 0.28), dressed, bevel=0.015)
    kit.box("door.void", (DOOR_W + 0.2, 0.1, DOOR_H + 0.1), (DOOR_X, WALL + 0.45, (DOOR_H + 0.1) / 2), black)

    # ---------------- the iron-banded door, its handle worn smooth
    door = []
    n = 5
    for k in range(n):
        bw = DOOR_W / n
        door.append(kit.box(f"door.board.{k}", (bw - 0.008, 0.1, DOOR_H), (DOOR_X - DOOR_W / 2 + bw * (k + 0.5), WALL + 0.12, DOOR_H / 2),
                            oak, bevel=0.006))
    for bz in (0.42, 1.32, 2.22):
        door.append(kit.box(f"door.band.{bz}", (DOOR_W - 0.04, 0.025, 0.11), (DOOR_X, WALL + 0.06, bz), iron, bevel=0.004))
        for k in range(6):
            door.append(kit.sphere(f"door.rivet.{bz}.{k}", 0.013, (DOOR_X - DOOR_W / 2 + 0.12 + k * 0.23, WALL + 0.045, bz), iron,
                                   segments=8))
    ring = kit.torus("door.ring", 0.075, 0.012, (DOOR_X + 0.42, WALL + 0.02, 1.08), brass)
    ring.rotation_euler = (1.5708, 0, 0)        # hangs flat against the door
    door.append(ring)
    door.append(kit.cylinder("door.boss", 0.035, 0.03, (DOOR_X + 0.42, WALL + 0.04, 1.15), brass, rot=(90, 0, 0), segments=16))
    door.append(kit.box("door.keyplate", (0.06, 0.012, 0.14), (DOOR_X + 0.42, WALL + 0.05, 0.93), iron, bevel=0.003))
    kit.hotspot(door, HOTSPOTS["door"])

    # A wall lantern by the door, cold for a long time now.
    kit.box("lamp.bracket", (0.04, 0.3, 0.04), (DOOR_X - 1.25, WALL - 0.12, 2.2), iron)
    kit.box("lamp.cage", (0.2, 0.2, 0.3), (DOOR_X - 1.25, WALL - 0.28, 2.05), window, bevel=0.01)
    kit.box("lamp.cap", (0.26, 0.26, 0.06), (DOOR_X - 1.25, WALL - 0.28, 2.23), iron, bevel=0.01)

    # ---------------- the doormat, doing its best: ELCOME
    mat = kit.box("doormat", (1.1, 0.64, 0.025), (DOOR_X, 1.78, 0.012), coir, rot=(0, 0, 1.5), bevel=0.01)
    letters = kit.text("doormat.word", "ELCOME", 0.13, (DOOR_X + 0.04, 1.78, 0.027), ink, rot=(0, 0, 1.5))
    ghost = kit.text("doormat.w", "W", 0.13, (DOOR_X - 0.36, 1.77, 0.026), kit.solid("mat.ghost", (0.18, 0.12, 0.06), rough=0.95),
                     rot=(0, 0, 1.5))
    kit.hotspot([mat, letters, ghost], HOTSPOTS["doormat"])

    # ---------------- posts, rails and a roof that mostly holds
    for px in (-HALF, HALF):
        kit.box(f"post.{px}", (0.2, 0.2, ROOF), (px, FRONT + 0.1, ROOF / 2), weathered, bevel=0.01)
        kit.box(f"post.base.{px}", (0.3, 0.3, 0.16), (px, FRONT + 0.1, 0.08), weathered, bevel=0.01)
        kit.box(f"post.cap.{px}", (0.3, 0.3, 0.12), (px, FRONT + 0.1, ROOF - 0.06), weathered, bevel=0.01)
        # A side rail back to the house; the front is open, as the old picture had it.
        kit.box(f"rail.side.{px}", (0.08, WALL - FRONT - 0.2, 0.08), (px, (WALL + FRONT) / 2 + 0.05, 0.92), weathered)
        for k in range(15):
            if rng.random() < 0.12:
                continue                       # gone, these hundred years
            by = FRONT + 0.35 + k * 0.29
            kit.box(f"baluster.side.{px}.{k}", (0.045, 0.045, 0.86), (px, by, 0.45), weathered,
                    rot=(rng.uniform(-2, 2), rng.uniform(-2, 2), 0))
    kit.box("ceiling", (2 * HALF + 0.6, WALL - FRONT + 0.2, 0.05), (0, (WALL + FRONT) / 2, ROOF + 0.03),
            kit.planks("ceiling.boards", (0.16, 0.14, 0.11), (0.09, 0.08, 0.065), width=0.12, length=3.0))
    kit.box("fascia", (2 * HALF + 0.6, 0.18, 0.34), (0, FRONT + 0.05, ROOF - 0.1), weathered, bevel=0.01)
    for bx in (-1.7, 0.0, 1.7):
        kit.box(f"rafter.{bx}", (0.12, WALL - FRONT, 0.16), (bx, (WALL + FRONT) / 2, ROOF - 0.06), weathered)
    kit.box("roof", (2 * HALF + 0.9, 3.0, 0.08), (0, FRONT + 1.0, ROOF + 0.7), slate, rot=(26, 0, 0))

    # ---------------- the swing chair that has not swung
    sx, sy = 1.85, 1.55
    for cx in (sx - 0.66, sx + 0.66):
        kit.cylinder(f"swing.chain.{cx}", 0.008, ROOF - 0.95, (cx, sy, (ROOF + 0.95) / 2), iron, segments=6)
    kit.box("swing.seat", (1.42, 0.5, 0.05), (sx, sy, 0.52), weathered, bevel=0.008)
    kit.box("swing.cushion", (1.3, 0.44, 0.07), (sx, sy - 0.01, 0.585), cushion, bevel=0.025)
    for k in range(7):
        kit.box(f"swing.slat.{k}", (0.12, 0.03, 0.5), (sx - 0.6 + k * 0.2, sy + 0.24, 0.82), weathered, rot=(-10, 0, 0))
    kit.box("swing.top", (1.42, 0.05, 0.06), (sx, sy + 0.29, 1.08), weathered)
    for ax in (sx - 0.68, sx + 0.68):
        kit.box(f"swing.arm.{ax}", (0.06, 0.5, 0.05), (ax, sy, 0.76), weathered)
        kit.box(f"swing.armpost.{ax}", (0.05, 0.05, 0.24), (ax, sy - 0.22, 0.64), weathered)

    # ---------------- the garden has had its way at either side
    for k in range(26):
        side = -1 if k % 2 else 1
        r = 0.35 + rng.random() * 0.45
        kit.rock(f"shrub.{k}", r, (side * rng.uniform(HALF + 0.5, 7.5), rng.uniform(-1.0, WALL - 0.2), GROUND + r * 0.5), leaves, seed=100 + k)

    # ---------------- light: a low moon behind you, through mist
    # The moon is low and to the right: it rakes the stone, throws the posts'
    # shadows across the boards, and leaves the door to the lantern.
    kit.world((0.004, 0.006, 0.012), 1.0)
    kit.sun("moon", (0.62, 0.72, 1.0), 2.4, direction=(-0.75, 0.55, -0.4), angle=0.5)
    kit.area("sky", (0.35, 0.45, 0.75), 16, (0, -7.0, 6.0), (-35, 0, 0), 10.0, scatter=False)
    kit.area("porch.bounce", (0.42, 0.44, 0.52), 6, (0, 0.4, ROOF - 0.2), (0, 0, 0), 4.0, scatter=False)
    mist = kit.box("mist", (22, 16, 6.5), (0, -1.5, 2.6), kit.volume("mist", 0.007, color=(0.82, 0.87, 0.96), anisotropy=0.55))
    mist.pass_index = 0
    # And the mist that came, lying in the garden and on the yard, never on the boards.
    ground_mist = kit.volume("mist.low", 0.16, color=(0.85, 0.9, 1.0), anisotropy=0.4)
    low = [kit.box("mist.front", (22, 8, 0.9), (0, FRONT - 4.2, GROUND + 0.4), ground_mist)]
    for side in (-1, 1):
        low.append(kit.box(f"mist.side.{side}", (7, 5, 1.3), (side * (HALF + 3.7), 0.3, GROUND + 0.6), ground_mist))
    for o in low:
        o.pass_index = 0

    cam = kit.camera((0.0, -6.0, 1.7), (0.0, 4.0, 1.25), lens=24.0)   # tipped down a little, to keep the ceiling a frame

    return {
        "room": "porch",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["mist", "mist.front", "mist.side.-1", "mist.side.1"],
        # The doormat can be taken now (to patch the boat), so it is an overlay.
        "hiddenByDefault": [mat.name, letters.name, ghost.name],
        "variants": [{"id": "doormat", "when": {"here": "doormat"}, "show": [mat.name, letters.name, ghost.name]}],
        "wake": "look",
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-HALF + 0.3, HALF - 0.3, FRONT + 0.2, WALL - 0.4],
                 "blocks": [[sx - 0.8, sx + 0.8, sy - 0.35, sy + 0.45]]},
        "points": {"start": [-1.5, -0.8], "n": [0.0, -1.55], "s": [DOOR_X, 1.7]},
        "walkTo": {"door": [DOOR_X, 1.95], "doormat": [DOOR_X, 1.1], "exit:n": [DOOR_X, 2.1], "exit:s": [0.0, FRONT + 0.25]},
        # Exits with no geometry of their own, as screen rectangles (px, 1280x800).
        "zones": [{"id": "exit:n", "fromHotspot": "door"}, {"id": "exit:s", "rect": [0, 740, 1280, 60]}],
        "lights": {
            "ambient": [0.09, 0.11, 0.17],
            "key": {"color": [0.62, 0.72, 1.0], "dir": [-0.75, -0.4, -0.55], "intensity": 0.45},
        },
        "music": "outside",
        "exposure": 1.1,
    }

