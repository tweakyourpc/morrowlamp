"""Ashcombe Yard, on the same misty night as the porch.

Composition follows the EGA painter in js/scenes.js: the grey manor square
across the back, gable to the sky, every window dark, the front door in
the middle; the treeline behind it; the gatepost and the crooked mailbox
on the left, the dry well on the right, and the road curling away east.
The moon hangs low behind the player, as it does on the porch, and mist
lies in the trees and along the ground.

Nothing in the yard changes, so it wakes when the player handles anything
here (wake: "look").
"""
from __future__ import annotations

import math
import random

import kit

FACADE = 8.2       # the manor's front wall
HALF = 7.0         # half its width
EAVES = 6.6
STOREY = 3.4     # the string course between the floors
RIDGE = 10.2
DOOR_W, DOOR_H = 1.3, 2.5
WELL = (3.3, 1.9)  # centre of the well
WELL_R = 0.85

HOTSPOTS = {
    "floor": 1,
    "well": 2,
    "mailbox": 3,
    "exit:n": 4,
    "exit:e": 5,
    "exit:w": 6,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(11)

    wall = kit.ashlar("manor.stone", (0.16, 0.16, 0.155), (0.08, 0.08, 0.085), mortar=(0.03, 0.03, 0.03))
    dressed = kit.ashlar("manor.dressed", (0.21, 0.20, 0.19), (0.12, 0.12, 0.115), mortar=(0.04, 0.04, 0.04), course=0.44, block=0.36)
    slate = kit.stone("slate", (0.10, 0.11, 0.13), (0.04, 0.045, 0.05), scale=14.0)
    cobbles = kit.stone("cobbles", (0.17, 0.16, 0.14), (0.05, 0.048, 0.045), scale=22.0)
    gravel = kit.stone("gravel", (0.20, 0.19, 0.17), (0.07, 0.065, 0.06), scale=40.0)
    leaves = kit.stone("leaves", (0.07, 0.11, 0.05), (0.015, 0.03, 0.012), scale=18.0)
    pines = kit.stone("pines", (0.03, 0.06, 0.035), (0.008, 0.016, 0.01), scale=9.0)
    weathered = kit.wood("porch.posts", (0.19, 0.17, 0.14), (0.09, 0.08, 0.065), grain=26.0, along="Z", rough=0.8)
    oak = kit.wood("door.oak", (0.20, 0.11, 0.05), (0.08, 0.04, 0.02), grain=14.0, along="Z", rough=0.6)
    iron = kit.solid("iron", (0.05, 0.05, 0.055), rough=0.55, metal=0.85)
    brass = kit.solid("brass.worn", (0.70, 0.52, 0.24), rough=0.22, metal=1.0)
    red = kit.solid("mailbox.red", (0.42, 0.05, 0.04), rough=0.55, metal=0.3)
    window = kit.glass("window", (0.55, 0.6, 0.62), rough=0.08)
    black = kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)
    rope = kit.solid("rope", (0.25, 0.20, 0.13), rough=0.95)

    # ---------------- the ground: cobbles by the house, gravel beyond
    kit.hotspot([kit.box("ground", (60, 40, 0.1), (0, 8, -0.05), gravel),
                 kit.box("cobbles", (2 * HALF + 2, 9.5, 0.04), (0, FACADE - 4.6, 0.0), cobbles)], HOTSPOTS["floor"])

    # ---------------- the manor: three storeys of grey indifference
    door_open = (-DOOR_W / 2 - 0.1, DOOR_W / 2 + 0.1, 0.0, DOOR_H + 0.1)
    windows = [(-5.1, -3.9, 1.0, 2.7), (3.9, 5.1, 1.0, 2.7),
               (-5.1, -3.9, 3.9, 5.6), (-2.6, -1.4, 3.9, 5.6), (1.4, 2.6, 3.9, 5.6), (3.9, 5.1, 3.9, 5.6)]
    # Built a storey at a time: wall_with_openings wants one opening per column.
    kit.wall_with_openings("facade.ground", -HALF, HALF, STOREY, 0.5, [door_open] + windows[:2], wall, "X", FACADE + 0.25)
    upper = [(u0, u1, v0 - STOREY, v1 - STOREY) for (u0, u1, v0, v1) in windows[2:]]
    for piece in kit.wall_with_openings("facade.upper", -HALF, HALF, EAVES - STOREY, 0.5, upper, wall, "X", FACADE + 0.25):
        piece.location.z += STOREY
    for x in (-HALF, HALF):
        kit.box(f"facade.side.{x}", (0.5, 8.0, EAVES), (x, FACADE + 4.0, EAVES / 2), wall)
    kit.box("facade.plinth", (2 * HALF + 0.4, 0.6, 0.4), (0, FACADE - 0.05, 0.2), dressed)
    kit.box("facade.string", (2 * HALF + 0.3, 0.3, 0.16), (0, FACADE - 0.05, 3.3), dressed, bevel=0.01)
    for (u0, u1, v0, v1) in windows:
        cx, cz, w, h = (u0 + u1) / 2, (v0 + v1) / 2, u1 - u0, v1 - v0
        kit.box(f"window.void.{cx}.{cz}", (w, 0.1, h), (cx, FACADE + 0.55, cz), black)
        kit.box(f"window.glass.{cx}.{cz}", (w, 0.01, h), (cx, FACADE + 0.3, cz), window)
        kit.box(f"window.mullion.{cx}.{cz}", (0.06, 0.06, h), (cx, FACADE + 0.27, cz), weathered)
        kit.box(f"window.transom.{cx}.{cz}", (w, 0.06, 0.06), (cx, FACADE + 0.27, cz + h * 0.15), weathered)
        kit.box(f"window.sill.{cx}.{cz}", (w + 0.25, 0.3, 0.1), (cx, FACADE - 0.02, v0 - 0.05), dressed, bevel=0.01)
        kit.box(f"window.head.{cx}.{cz}", (w + 0.25, 0.14, 0.24), (cx, FACADE - 0.0, v1 + 0.12), dressed, bevel=0.01)

    # The gable faces the yard; the roof runs back from it.
    pitch = math.degrees(math.atan2(RIDGE - EAVES, HALF))
    slope = math.hypot(HALF + 0.6, RIDGE - EAVES)
    kit.prism("gable", [(-HALF, EAVES), (HALF, EAVES), (0.0, RIDGE - 0.15)], FACADE, FACADE + 0.5, wall)
    for side in (-1, 1):
        kit.box(f"roof.{side}", (slope, 9.0, 0.16), (side * (HALF / 2 + 0.05), FACADE + 4.1, (EAVES + RIDGE) / 2 + 0.12), slate,
                rot=(0, side * pitch, 0))
        kit.box(f"roof.barge.{side}", (slope, 0.12, 0.26), (side * (HALF / 2 + 0.05), FACADE - 0.42, (EAVES + RIDGE) / 2 + 0.06),
                weathered, rot=(0, side * pitch, 0))
    kit.box("chimney", (0.9, 0.9, 2.6), (0.8, FACADE + 2.0, RIDGE + 0.4), wall)
    kit.box("chimney.cap", (1.1, 1.1, 0.16), (0.8, FACADE + 2.0, RIDGE + 1.75), dressed, bevel=0.01)

    # ---------------- the front door, north: the way in
    door = []
    for k in range(5):
        bw = DOOR_W / 5
        door.append(kit.box(f"door.board.{k}", (bw - 0.008, 0.1, DOOR_H), (-DOOR_W / 2 + bw * (k + 0.5), FACADE + 0.3, DOOR_H / 2),
                            oak, bevel=0.006))
    for bz in (0.4, 1.25, 2.1):
        door.append(kit.box(f"door.band.{bz}", (DOOR_W - 0.04, 0.025, 0.1), (0, FACADE + 0.24, bz), iron))
    door.append(kit.torus("door.ring", 0.07, 0.012, (0.4, FACADE + 0.22, 1.05), brass))
    door[-1].rotation_euler = (1.5708, 0, 0)
    for jx in (-DOOR_W / 2 - 0.22, DOOR_W / 2 + 0.22):
        door.append(kit.box(f"door.jamb.{jx}", (0.3, 0.3, DOOR_H + 0.1), (jx, FACADE + 0.02, (DOOR_H + 0.1) / 2), dressed, bevel=0.01))
    door.append(kit.box("door.lintel", (DOOR_W + 0.9, 0.32, 0.36), (0, FACADE + 0.02, DOOR_H + 0.28), dressed, bevel=0.015))
    for k, (y, z) in enumerate(((FACADE - 0.45, 0.08), (FACADE - 0.85, 0.04))):
        door.append(kit.box(f"door.step.{k}", (2.4, 0.4, z * 2), (0, y, z), dressed, bevel=0.01))
    kit.hotspot(door, HOTSPOTS["exit:n"])
    kit.box("door.void", (DOOR_W + 0.2, 0.1, DOOR_H + 0.1), (0, FACADE + 0.6, (DOOR_H + 0.1) / 2), black)

    # ---------------- the treeline behind the house
    for k in range(34):
        x = -26 + k * 1.6 + rng.uniform(-0.5, 0.5)
        y = FACADE + 9 + rng.uniform(0, 6)
        h = rng.uniform(6, 11)
        kit.cylinder(f"pine.{k}", rng.uniform(1.2, 2.0), h, (x, y, h / 2), pines, segments=10, radius2=0.0)
    for k in range(16):
        side = -1 if k % 2 else 1
        r = rng.uniform(0.6, 1.3)
        kit.rock(f"shrub.{k}", r, (side * rng.uniform(HALF + 0.8, 12), FACADE + rng.uniform(-3, 2), r * 0.4), leaves, seed=300 + k)

    # ---------------- the gatepost, and the gate that gave up
    gp = (-4.7, 2.4)
    kit.box("gatepost", (0.5, 0.5, 2.3), (gp[0], gp[1], 1.15), dressed, bevel=0.01)
    kit.box("gatepost.cap", (0.66, 0.66, 0.18), (gp[0], gp[1], 2.39), dressed, bevel=0.015)
    kit.sphere("gatepost.ball", 0.2, (gp[0], gp[1], 2.66), dressed)
    gate = [kit.box("gate.top", (0.05, 1.6, 0.05), (gp[0] + 0.4, gp[1] - 0.8, 1.5), iron),
            kit.box("gate.bottom", (0.05, 1.6, 0.05), (gp[0] + 0.4, gp[1] - 0.8, 0.25), iron)]
    for k in range(8):
        gate.append(kit.box(f"gate.bar.{k}", (0.03, 0.03, 1.3), (gp[0] + 0.4, gp[1] - 0.05 - k * 0.21, 0.88), iron))
    hinge = kit.empty("gate", (gp[0] + 0.4, gp[1], 0))
    kit.parent(gate, hinge)
    hinge.rotation_euler = (math.radians(4), 0, math.radians(-38))

    # ---------------- the mailbox on its crooked post
    mx, my = -3.0, 0.9
    post = kit.box("mailbox.post", (0.09, 0.09, 1.15), (mx, my, 0.56), weathered, rot=(3, 6, 0))
    body = kit.box("mailbox.body", (0.26, 0.46, 0.22), (mx + 0.06, my, 1.2), red, bevel=0.01)
    lid = kit.cylinder("mailbox.top", 0.13, 0.46, (mx + 0.06, my, 1.31), red, rot=(90, 0, 0), segments=20)
    flag = kit.box("mailbox.flag", (0.02, 0.05, 0.22), (mx + 0.2, my + 0.12, 1.32), red, rot=(0, -20, 0))
    kit.hotspot([post, body, lid, flag], HOTSPOTS["mailbox"])

    # ---------------- the road, curling away east into the mist
    road = []
    for k in range(9):
        t = k / 8
        x = 4.8 + t * 11
        y = 3.0 + math.sin(t * 1.4) * 5.0
        road.append(kit.box(f"road.{k}", (2.6, 2.4, 0.03), (x, y, 0.02), kit.stone("road", (0.24, 0.22, 0.19), (0.10, 0.09, 0.08), scale=30.0),
                            rot=(0, 0, -28 + t * 20)))
    kit.hotspot(road, HOTSPOTS["exit:e"])

    # ---------------- the path round the west side of the house, to the kitchen garden
    side_path = []
    for k in range(7):
        t = k / 6
        x = -4.6 - t * 4.2
        y = FACADE - 2.2 + t * 2.8
        side_path.append(kit.box(f"sidepath.{k}", (1.5, 1.4, 0.03), (x, y, 0.025), gravel, rot=(0, 0, 30 + t * 25)))
    kit.hotspot(side_path, HOTSPOTS["exit:w"])

    # ---------------- the dry well, east side, faintly lit from below
    wx, wy = WELL
    ring = []
    for k in range(16):
        a = k / 16 * math.tau
        ring.append(kit.box(f"well.ring.{k}", (0.36, 0.26, 0.72), (wx + math.cos(a) * WELL_R, wy + math.sin(a) * WELL_R, 0.36), dressed,
                            rot=(0, 0, math.degrees(a) + 90), bevel=0.02))
        ring.append(kit.box(f"well.shaft.{k}", (0.36, 0.1, 3.0), (wx + math.cos(a) * (WELL_R - 0.1), wy + math.sin(a) * (WELL_R - 0.1), -1.5),
                            wall, rot=(0, 0, math.degrees(a) + 90)))
    ring.append(kit.cylinder("well.floor", WELL_R, 0.05, (wx, wy, -3.0), black))
    for side in (-1, 1):
        ring.append(kit.box(f"well.post.{side}", (0.12, 0.12, 1.95), (wx + side * (WELL_R + 0.05), wy, 0.98), weathered, bevel=0.01))
    ring.append(kit.box("well.beam", (2 * WELL_R + 0.5, 0.16, 0.14), (wx, wy, 1.98), weathered, bevel=0.01))
    ring.append(kit.cylinder("well.windlass", 0.07, 2 * WELL_R, (wx, wy, 1.72), weathered, rot=(0, 90, 0), segments=12))
    ring.append(kit.cylinder("well.rope", 0.012, 1.3, (wx, wy - 0.05, 1.05), rope, segments=6))
    ring.append(kit.cylinder("well.bucket", 0.13, 0.2, (wx + 0.35, wy - 0.95, 0.1), weathered, segments=14, radius2=0.11))
    kit.hotspot(ring, HOTSPOTS["well"])
    kit.point("well.glow", (1.0, 0.72, 0.32), 14, (wx, wy, -2.4), radius=0.2)

    # ---------------- light: the porch's moon, low behind you, through mist
    kit.world((0.012, 0.016, 0.032), 1.0)   # a night sky, not a void
    kit.sun("moon", (0.62, 0.72, 1.0), 2.4, direction=(-0.75, 0.55, -0.4), angle=0.5)
    kit.area("sky", (0.35, 0.45, 0.75), 30, (0, -6.0, 9.0), (-30, 0, 0), 14.0, scatter=False)
    mist = kit.box("mist", (50, 34, 14), (0, 8, 6.5), kit.volume("mist", 0.012, color=(0.82, 0.87, 0.96), anisotropy=0.55))
    ground_mist = kit.volume("mist.low", 0.12, color=(0.85, 0.9, 1.0), anisotropy=0.4)
    low = [kit.box("mist.trees", (50, 8, 2.2), (0, FACADE + 10, 1.0), ground_mist),
           kit.box("mist.road", (12, 10, 0.8), (12, 6, 0.35), ground_mist)]
    for o in [mist] + low:
        o.pass_index = 0

    cam = kit.camera((0.0, -6.0, 1.7), (0.0, 8.0, 3.1), lens=24.0)

    return {
        "room": "yard",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["mist", "mist.trees", "mist.road"],
        "hiddenByDefault": [],
        "variants": [],
        "wake": "look",
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-4.4, 4.6, -1.3, FACADE - 1.0],
                 "blocks": [[wx - WELL_R - 0.25, wx + WELL_R + 0.25, wy - WELL_R - 0.25, wy + WELL_R + 0.25],
                            [mx - 0.25, mx + 0.35, my - 0.3, my + 0.3]]},
        # Arriving by a direction puts you beside the way back.
        "points": {"start": [-1.6, 0.4], "s": [0.0, FACADE - 1.3], "u": [wx - 1.25, wy - 0.3], "d": [wx - 1.25, wy - 0.3],
                   "w": [-4.0, FACADE - 2.4]},      # back round the west side from the garden
        "walkTo": {"well": [wx - 1.25, wy - 0.3], "mailbox": [mx + 0.7, my - 0.4], "exit:n": [0.0, FACADE - 1.1],
                   "exit:e": [4.5, 3.2], "exit:d": [wx - 1.25, wy - 0.3], "exit:w": [-4.3, FACADE - 2.4]},
        # Down is the well itself.
        # The side path is mostly hidden behind the gate from this camera, so the whole left
        # edge of the yard (gate, hedge, the corner of the house) leads round to the west.
        "zones": [{"id": "exit:d", "fromHotspot": "well"}, {"id": "exit:w", "rect": [0, 380, 235, 420]}],
        "lights": {
            "ambient": [0.09, 0.11, 0.17],
            "key": {"color": [0.62, 0.72, 1.0], "dir": [-0.75, -0.4, -0.55], "intensity": 0.45},
        },
        "music": "outside",
        "exposure": 1.1,
    }
