"""The kitchen garden, behind the manor, by moonlight.

Story bible section 6b. Composition follows the EGA painter in js/scenes.js:
looking south at the back of the house. It is the same house the yard sees
from the front: the same width, eaves and ridge, and a gable end, because the
ridge runs front to back. Looking south, east is on the left and west on the
right, so the kitchen's back door is in the left half (the kitchen is the
east room), the hole the shape of a bad winter breaks the right-hand edge of
the gable (it is in the west slope, over the grandmother's stairwell), and
the path round the west side of the house to the yard leaves on the right.
The yew and its one grave stand on the left; the overgrown beds in front.
The glasshouse is behind the player (north), so that way out is the foot of
the picture.

Outdoors keeps Chris's rule: no music, only the night. The ladder is an
overlay, leaning from the beds to the hole, once it has been propped there.
"""
from __future__ import annotations

import math
import random

import kit

WALL = 7.0         # the back wall of the manor
HALF = 7.0         # half its width, eaves and ridge: as the yard has the front (yard.py)
EAVES = 6.6
STOREY = 3.4       # the floor between, as the yard has it: openings above and below are cut from separate walls
RIDGE = 10.2
DOOR = (-3.0, -1.9, 0.0, 2.3)        # the back door, in the kitchen's (east) half
NOTCH = (0.35, 0.75)                 # the hole: how far up the gable's west (right) edge it breaks it
YEW = (-6.3, 3.4)        # well left of the back door, so it never hides it
GRAVE = (-5.0, 2.4)

HOTSPOTS = {
    "floor": 1,
    "backDoor": 2,
    "roofHole": 3,
    "grave": 4,
    "ladder": 5,
    "exit:w": 6,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(61)

    grass = kit.stone("grass.night", (0.07, 0.10, 0.05), (0.025, 0.04, 0.02), scale=30.0, bump=0.2)
    earth = kit.stone("bed.earth", (0.10, 0.075, 0.05), (0.04, 0.03, 0.02), scale=18.0, bump=0.2)
    leaves = kit.stone("leaves", (0.06, 0.10, 0.045), (0.015, 0.03, 0.012), scale=18.0)
    yew_mat = kit.stone("yew", (0.03, 0.06, 0.035), (0.008, 0.02, 0.01), scale=14.0)
    bark = kit.wood("bark", (0.12, 0.08, 0.05), (0.05, 0.03, 0.02), grain=30.0, along="Z", rough=0.9)
    gravel = kit.stone("gravel", (0.20, 0.19, 0.17), (0.07, 0.065, 0.06), scale=40.0)
    wall = kit.ashlar("back.wall", (0.17, 0.165, 0.155), (0.085, 0.085, 0.09), mortar=(0.03, 0.03, 0.03))
    dressed = kit.ashlar("back.dressed", (0.22, 0.21, 0.19), (0.13, 0.125, 0.12), mortar=(0.04, 0.04, 0.04), course=0.44, block=0.36)
    slate = kit.stone("slate", (0.10, 0.11, 0.13), (0.04, 0.045, 0.05), scale=14.0)
    oak = kit.wood("door.oak", (0.20, 0.11, 0.05), (0.08, 0.04, 0.02), grain=14.0, along="Z", rough=0.6)
    weathered = kit.wood("weathered", (0.19, 0.17, 0.14), (0.09, 0.08, 0.065), grain=26.0, along="Z", rough=0.8)
    headstone = kit.stone("headstone", (0.32, 0.31, 0.29), (0.16, 0.16, 0.15), scale=9.0, bump=0.3)
    lichen = kit.solid("letters", (0.07, 0.07, 0.06), rough=0.95)
    iron = kit.solid("iron", (0.05, 0.05, 0.055), rough=0.55, metal=0.85)
    window = kit.glass("window", (0.55, 0.6, 0.62), rough=0.08)
    black = kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)

    # ---------------- the garden: grass gone to field, and the old beds
    kit.hotspot([kit.box("ground", (40, 30, 0.1), (0, 2, -0.05), grass)], HOTSPOTS["floor"])
    for k, (bx, by) in enumerate(((3.2, 1.0), (0.0, 1.0), (3.0, 3.4), (-0.4, 3.4))):
        kit.box(f"bed.{k}", (2.4, 1.3, 0.25), (bx, by, 0.12), earth, bevel=0.02)
        for side in (-1, 1):
            kit.box(f"bed.edge.{k}.{side}", (2.5, 0.08, 0.3), (bx, by + side * 0.68, 0.15), weathered)
        for j in range(7):
            r = rng.uniform(0.18, 0.42)
            kit.rock(f"bed.weeds.{k}.{j}", r, (bx + rng.uniform(-1.1, 1.1), by + rng.uniform(-0.5, 0.5), 0.25 + r * 0.3), leaves, seed=600 + k * 10 + j)

    # ---------------- the back of the manor: its north gable end
    openings = [(DOOR[0] - 0.12, DOOR[1] + 0.12, 0.0, DOOR[3] + 0.12),
                (2.4, 3.4, 1.2, 2.8), (-4.6, -3.6, 4.0, 5.6), (-0.5, 0.5, 4.0, 5.6), (3.4, 4.4, 4.0, 5.6)]
    # kit.wall_with_openings cuts one opening per column, so each storey is its own wall.
    kit.wall_with_openings("back", -HALF, HALF, STOREY, 0.5, [o for o in openings if o[3] <= STOREY], wall, "X", WALL + 0.25)
    for piece in kit.wall_with_openings("back.upper", -HALF, HALF, EAVES - STOREY, 0.5,
                                        [(u0, u1, v0 - STOREY, v1 - STOREY) for (u0, u1, v0, v1) in openings if v0 >= STOREY],
                                        wall, "X", WALL + 0.25):
        piece.location.z += STOREY
    kit.box("back.plinth", (2 * HALF + 0.4, 0.6, 0.4), (0, WALL - 0.05, 0.2), dressed)
    kit.box("back.string", (2 * HALF + 0.3, 0.3, 0.16), (0, WALL - 0.05, 3.3), dressed, bevel=0.01)
    for (wx0, wx1, wz0, wz1) in openings[1:]:
        wx, wz = (wx0 + wx1) / 2, (wz0 + wz1) / 2
        kit.box(f"window.void.{wx}.{wz}", (wx1 - wx0, 0.1, wz1 - wz0), (wx, WALL + 0.45, wz), black)
        kit.box(f"window.glass.{wx}.{wz}", (wx1 - wx0, 0.01, wz1 - wz0), (wx, WALL + 0.15, wz), window)
        kit.box(f"window.sill.{wx}.{wz}", (wx1 - wx0 + 0.25, 0.3, 0.1), (wx, WALL - 0.05, wz0 - 0.05), dressed, bevel=0.01)

    # The gable, broken on its right-hand (west) edge where the hole is. The edge runs from
    # the eaves at x = HALF up to the ridge at x = 0; `along(t)` is the point t of the way up.
    def along(t: float) -> tuple[float, float]:
        return HALF * (1 - t), EAVES + (RIDGE - EAVES) * t
    (ax, az), (bx_, bz) = along(NOTCH[0]), along(NOTCH[1])
    gable = [(-HALF, EAVES), (HALF, EAVES), (ax, az), (ax - 0.5, az - 0.35), (ax - 1.1, az + 0.05), (bx_ + 0.2, bz - 0.55), (bx_, bz),
             (0.0, RIDGE)]
    kit.prism("gable", gable, WALL, WALL + 0.5, wall)
    # The roof runs back from the gable, and overhangs it a little at the verges.
    pitch = math.degrees(math.atan2(RIDGE - EAVES, HALF))
    run = math.hypot(HALF, RIDGE - EAVES)
    depth = 12.0
    for side in (-1, 1):
        roof = kit.box(f"roof.{side}", (run + 0.4, depth, 0.14), (side * HALF / 2, WALL + depth / 2 - 0.2, (EAVES + RIDGE) / 2 + 0.1), slate,
                       rot=(0, side * pitch, 0))
        if side > 0:
            # The west slope's broken corner: cut back from the verge where the hole is.
            cut = kit.box("roof.hole.cut", (abs(ax - bx_) + 1.2, 3.0, 1.6), ((ax + bx_) / 2, WALL + 1.0, (az + bz) / 2), None)
            m = roof.modifiers.new("hole", "BOOLEAN")
            m.object = cut
            m.operation = "DIFFERENCE"
            cut.hide_render = True
            cut.hide_viewport = True
    kit.box("verge.board.e", (0.12, 0.18, run + 0.3), (-HALF / 2 - 0.05, WALL - 0.08, (EAVES + RIDGE) / 2 + 0.1), weathered, rot=(0, 90 - pitch, 0))
    # The hole: the dark of the grandmother's room, broken battens and slates round the break.
    hx, hz = (ax + bx_) / 2, (az + bz) / 2
    hole = [kit.box("hole.dark", (abs(ax - bx_) + 0.6, 1.2, 1.3), (hx - 0.3, WALL + 0.9, hz - 0.3), black)]
    for k in range(9):
        t = NOTCH[0] + (NOTCH[1] - NOTCH[0]) * k / 8
        x, z = along(t)
        hole.append(kit.box(f"hole.batten.{k}", (0.05, 0.6 + rng.random() * 0.5, 0.04), (x - 0.2, WALL + 0.3, z - 0.1 + rng.uniform(-0.2, 0.2)),
                            weathered, rot=(rng.uniform(-30, 30), pitch + rng.uniform(-25, 25), rng.uniform(-20, 20))))
    for k in range(6):
        x, z = along(rng.uniform(*NOTCH))
        hole.append(kit.box(f"hole.slate.{k}", (0.32, 0.22, 0.02), (x - rng.uniform(0, 0.5), WALL + rng.uniform(0.1, 0.6), z + rng.uniform(-0.3, 0.2)),
                            slate, rot=(rng.uniform(-30, 30), pitch + rng.uniform(-30, 30), rng.uniform(0, 60))))
    kit.hotspot(hole, HOTSPOTS["roofHole"])
    # Fallen slates in the bed beneath it.
    for k in range(8):
        kit.box(f"fallen.slate.{k}", (0.3, 0.2, 0.02), (rng.uniform(hx - 1.2, hx + 0.8), rng.uniform(5.4, 6.6), 0.03), slate,
                rot=(rng.uniform(-10, 10), rng.uniform(-10, 10), rng.uniform(0, 180)))

    # ---------------- the back door, bolted from the inside
    dx = (DOOR[0] + DOOR[1]) / 2
    door = [kit.box("door.void", (DOOR[1] - DOOR[0], 0.1, DOOR[3]), (dx, WALL + 0.55, DOOR[3] / 2), black)]
    for x in (DOOR[0] - 0.12, DOOR[1] + 0.12):
        door.append(kit.box(f"door.jamb.{x}", (0.24, 0.3, DOOR[3] + 0.12), (x, WALL - 0.02, (DOOR[3] + 0.12) / 2), dressed, bevel=0.01))
    door.append(kit.box("door.lintel", (DOOR[1] - DOOR[0] + 0.5, 0.32, 0.3), (dx, WALL - 0.02, DOOR[3] + 0.25), dressed, bevel=0.01))
    door.append(kit.box("door.step", (DOOR[1] - DOOR[0] + 0.4, 0.5, 0.12), (dx, WALL - 0.3, 0.06), dressed, bevel=0.01))
    leaf = kit.box("door.leaf", (DOOR[1] - DOOR[0] - 0.02, 0.07, DOOR[3] - 0.02), (DOOR[1] - 0.01, WALL + 0.15, DOOR[3] / 2), oak,
                   pivot=(1, 0, 0), bevel=0.008)
    door.append(leaf)
    for z in (0.5, 1.8):
        door.append(kit.box(f"door.strap.{z}", (DOOR[1] - DOOR[0] - 0.1, 0.02, 0.07), (dx, WALL + 0.1, z), iron))
    door.append(kit.point("kitchen.dim", (0.5, 0.42, 0.32), 4, (dx, WALL + 1.6, 1.4), radius=0.2))
    kit.hotspot([o for o in door if o.type == "MESH"], HOTSPOTS["backDoor"])

    # ---------------- the yew, older than the house, and the one grave under it
    yx, yy = YEW
    yew = [kit.cylinder("yew.trunk", 0.35, 3.0, (yx, yy, 1.5), bark, segments=14, radius2=0.22)]
    for k in range(9):
        r = rng.uniform(1.0, 1.6)
        yew.append(kit.sphere(f"yew.crown.{k}", r, (yx + rng.uniform(-1.0, 1.0), yy + rng.uniform(-0.8, 0.8), 3.0 + rng.uniform(0, 2.2)), yew_mat,
                              scale=(1.0, 1.0, 1.3), segments=12))
    gx, gy = GRAVE
    # Turned a little towards the middle of the garden.
    stone = [kit.box("grave.stone", (0.7, 0.14, 0.85), (gx, gy, 0.42), headstone, bevel=0.02, rot=(0, -3, 8)),
             kit.cylinder("grave.top", 0.35, 0.14, (gx, gy, 0.86), headstone, rot=(90, 0, 8), segments=24),
             kit.box("grave.mound", (0.8, 1.6, 0.12), (gx - 0.18, gy - 0.9, 0.04), earth, bevel=0.04, rot=(0, 0, 8)),
             kit.text("grave.words", "ASHCOMBE", 0.07, (gx, gy - 0.075, 0.7), lichen, rot=(90, 0, 8))]
    kit.hotspot(stone + yew, HOTSPOTS["grave"])

    # ---------------- the path round the west corner of the house, to the yard
    path = []
    for k in range(6):
        t = k / 5
        path.append(kit.box(f"path.{k}", (1.4, 1.5, 0.03), (4.8 + t * 3.0, 1.5 + t * 4.8, 0.02), gravel, rot=(0, 0, 30 + t * 20)))
    kit.hotspot(path, HOTSPOTS["exit:w"])

    # ---------------- the ladder, once it leans from the beds up the gable to the hole
    ladder = []
    lx = hx - 0.4
    foot_y, top_y, top_z = WALL - 2.2, WALL - 0.08, hz - 0.5
    lean = math.degrees(math.atan2(top_y - foot_y, top_z))
    length = math.hypot(top_y - foot_y, top_z)
    for k, x in enumerate((lx - 0.28, lx + 0.28)):
        ladder.append(kit.box(f"ladder.rail.{k}", (0.07, 0.07, length), (x, (foot_y + top_y) / 2, top_z / 2), weathered, rot=(-lean, 0, 0)))
    for k in range(int(length / 0.3)):
        t = (k + 0.5) / int(length / 0.3)
        ladder.append(kit.box(f"ladder.rung.{k}", (0.56, 0.04, 0.04), (lx, foot_y + (top_y - foot_y) * t, top_z * t), weathered))
    kit.hotspot(ladder, HOTSPOTS["ladder"])

    # ---------------- the woods all round, and the low, patient sound in them
    for k in range(22):
        side = -1 if k % 2 else 1
        r = rng.uniform(0.8, 1.6)
        kit.rock(f"shrub.{k}", r, (side * rng.uniform(7.5, 13), rng.uniform(-3, 9), r * 0.5), leaves, seed=700 + k)

    # ---------------- light: the moon high behind the player, and mist on the beds
    kit.world((0.004, 0.006, 0.012), 1.0)
    # From behind the player's right, so the yew's shadow falls away from the back door.
    kit.sun("moon", (0.62, 0.72, 1.0), 2.6, direction=(-0.45, 0.8, -0.55), angle=0.5)
    kit.area("sky", (0.35, 0.45, 0.75), 18, (0, -6.0, 7.0), (-30, 0, 0), 10.0, scatter=False)
    mist = kit.box("mist", (26, 18, 7.0), (0, 2.0, 3.0), kit.volume("mist", 0.006, color=(0.82, 0.87, 0.96), anisotropy=0.55))
    mist.pass_index = 0
    low = kit.box("mist.low", (26, 14, 0.8), (0, 1.5, 0.35), kit.volume("mist.low", 0.12, color=(0.85, 0.9, 1.0), anisotropy=0.4))
    low.pass_index = 0

    cam = kit.camera((0.0, -7.0, 1.7), (0.0, 7.0, 4.4), lens=24.0)

    return {
        "room": "kitchenGarden",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["mist", "mist.low"],
        "hiddenByDefault": [o.name for o in ladder],
        "variants": [
            {"id": "ladder", "when": {"flag": "ladderUp"}, "show": [o.name for o in ladder]},
            {"id": "backDoor.open", "when": {"open": "backDoor"}, "rotate": {leaf.name: [0, 0, 100]}},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-5.6, 5.0, -2.4, WALL - 0.7],
                 "blocks": [[GRAVE[0] - 0.5, GRAVE[0] + 0.6, GRAVE[1] - 1.8, GRAVE[1] + 0.3], [YEW[0] - 0.6, YEW[0] + 0.6, YEW[1] - 0.6, YEW[1] + 0.6]]},
        "points": {"start": [0.0, -0.6], "w": [4.3, 1.8], "n": [dx, WALL - 1.1], "s": [0.0, -2.1], "u": [lx + 0.7, WALL - 2.5]},
        "walkTo": {"backDoor": [dx, WALL - 0.9], "roofHole": [lx + 0.7, WALL - 2.5], "ladder": [lx + 0.7, WALL - 2.5],
                   "grave": [gx + 1.0, gy - 1.0], "exit:w": [4.6, 1.8], "exit:s": [dx, WALL - 0.9], "exit:n": [0.0, -2.3],
                   "exit:u": [lx + 0.7, WALL - 2.5]},
        "zones": [{"id": "exit:s", "fromHotspot": "backDoor"},
                  {"id": "exit:n", "rect": [0, 740, 1280, 60]},
                  {"id": "exit:u", "fromHotspot": "roofHole", "when": {"flag": "ladderUp"}}],
        "lights": {
            "ambient": [0.09, 0.11, 0.17],
            "key": {"color": [0.62, 0.72, 1.0], "dir": [-0.45, -0.55, 0.8], "intensity": 0.45},
        },
        "music": "outside",
        "exposure": 1.15,
    }
