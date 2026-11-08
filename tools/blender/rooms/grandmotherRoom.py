"""The grandmother's room, up the broken stairs, at night.

Story bible section 6. Composition follows the EGA painter in js/scenes.js:
a low room under the eaves, the roof fallen in overhead and the moon let in
through the hole; her narrow bed at the front left, made forty years ago; the
writing table on the right with its chair pushed back, and on it the wax
cylinder and the page of the second verse; the narrow servants' door in the
right-hand corner; the stairwell at the back left, where the hall's stairs
come up (they climb north along the hall's west wall).

The cylinder and the page are overlays, so the table empties as they are
taken. The servants' door swings open once the stair behind it is found,
and the top of the ladder shows in the hole once it stands in the garden.
"""
from __future__ import annotations

import math
import random

import kit

W = 4.0          # half-width of the room
NORTH = 3.0      # north wall plane
SOUTH = -6.5     # behind the camera
EAVE = 1.7       # where the sloping ceiling meets the side walls
RIDGE = 3.6      # the ridge, running north-south
HOLE = (-2.6, -0.6, 0.8, 3.0)        # the hole in the west slope, out to the north gable (seen from the garden)
SERVANT = (1.2, 2.0, 0.0, 1.95)      # the servants' door, in the east wall
WELL = (-3.6, -1.9, 0.9, 2.6)        # the stairwell, back left, over the top of the hall's stairs

HOTSPOTS = {
    "floor": 1,
    "cylinder": 2,
    "verse": 3,
    "servantDoor": 4,
    "roofHole": 5,
    "exit:d": 6,
}


def roof_z(x: float) -> float:
    """Height of the sloping ceiling at x: the eaves at the walls, the ridge in the middle."""
    return EAVE + (RIDGE - EAVE) * (1.0 - abs(x) / W)


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(53)

    boards = kit.planks("bedroom.boards", (0.22, 0.15, 0.09), (0.12, 0.08, 0.045), width=0.16, length=1.8)
    plaster = kit.stone("bedroom.plaster", (0.34, 0.32, 0.30), (0.20, 0.19, 0.18), scale=2.5, bump=0.15)
    paper = kit.wallpaper("bedroom.paper", (0.26, 0.24, 0.20), (0.18, 0.13, 0.12), (0.14, 0.12, 0.09), scale=6.0)
    rafter = kit.wood("rafter", (0.18, 0.12, 0.07), (0.08, 0.05, 0.03), grain=10.0)
    oak = kit.wood("bedroom.oak", (0.24, 0.14, 0.07), (0.10, 0.06, 0.03), grain=12.0, rough=0.6)
    linen = kit.solid("linen", (0.55, 0.53, 0.48), rough=0.9, sheen=0.4)
    quilt = kit.stone("quilt", (0.30, 0.12, 0.10), (0.12, 0.10, 0.14), scale=9.0, bump=0.1)
    card = kit.solid("sleeve.card", (0.40, 0.31, 0.20), rough=0.85)
    wax = kit.solid("cylinder.wax", (0.30, 0.17, 0.07), rough=0.35)
    page = kit.solid("verse.page", (0.70, 0.66, 0.56), rough=0.9)
    ink = kit.solid("verse.ink", (0.08, 0.06, 0.05), rough=0.9)
    slate = kit.stone("slate", (0.10, 0.11, 0.13), (0.04, 0.045, 0.05), scale=14.0)
    sky = kit.solid("night.sky", (0.03, 0.05, 0.12), rough=1.0, emission=(0.04, 0.07, 0.16), strength=1.0)
    black = kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)

    # ---------------- floor, with the stairwell cut out of it at the back left
    floor = []
    x0, x1, y0, y1 = WELL
    floor.append(kit.box("floor.back", (2 * W, NORTH - y1, 0.1), (0, (NORTH + y1) / 2, -0.05), boards))
    floor.append(kit.box("floor.right", (W - x1, y1 - SOUTH, 0.1), ((W + x1) / 2, (y1 + SOUTH) / 2, -0.05), boards))
    floor.append(kit.box("floor.front", (x1 + W, y0 - SOUTH, 0.1), ((x1 - W) / 2, (y0 + SOUTH) / 2, -0.05), boards))
    floor.append(kit.box("floor.left", (x0 + W, y1 - y0, 0.1), ((x0 - W) / 2, (y0 + y1) / 2, -0.05), boards))
    kit.hotspot(floor, HOTSPOTS["floor"])

    # ---------------- the stairwell: the top of the grand stair, and a dark drop
    well = [kit.box("well.dark", (x1 - x0, y1 - y0, 0.1), ((x0 + x1) / 2, (y0 + y1) / 2, -2.4), black)]
    for k in range(4):
        well.append(kit.box(f"well.step.{k}", (x1 - x0 - 0.1, 0.3, 0.06), ((x0 + x1) / 2, y1 - 0.2 - k * 0.3, -0.25 - k * 0.22), oak))
    for x in (x1,):
        well.append(kit.box(f"well.rail.{x}", (0.07, y1 - y0, 0.07), (x, (y0 + y1) / 2, 0.9), oak))
        for k in range(5):
            well.append(kit.box(f"well.baluster.{k}", (0.04, 0.04, 0.9), (x, y0 + 0.15 + k * (y1 - y0 - 0.3) / 4, 0.45), oak))
    well.append(kit.box("well.newel", (0.12, 0.12, 1.15), (x1, y1, 0.57), oak, bevel=0.01))
    kit.hotspot(well, HOTSPOTS["exit:d"])

    # ---------------- walls and the low sloping ceiling under the eaves
    kit.wall_with_openings("east", SOUTH, NORTH, EAVE, 0.2, [SERVANT[:2] + (0.0, SERVANT[3])], paper, "Y", W + 0.1)
    kit.box("west", (0.2, NORTH - SOUTH, EAVE), (-W - 0.1, (NORTH + SOUTH) / 2, EAVE / 2), paper)
    # The north gable, broken at its top left where the hole runs out to it.
    kit.prism("north.gable", [(-W, 0.0), (W, 0.0), (W, EAVE), (0.0, RIDGE), (HOLE[1], roof_z(HOLE[1])),
                              (HOLE[1] - 0.35, roof_z(HOLE[1]) - 0.55), (HOLE[0] + 0.5, roof_z(HOLE[0] + 0.5) - 0.7),
                              (HOLE[0], roof_z(HOLE[0])), (-W, EAVE)], NORTH, NORTH + 0.2, paper)
    kit.box("south", (2 * W, 0.1, RIDGE), (0, SOUTH, RIDGE / 2), plaster)
    hx0, hx1, hy0, hy1 = HOLE
    slope = math.degrees(math.atan2(RIDGE - EAVE, W))
    for side in (-1, 1):
        # Each slope of the ceiling, in strips along y so the hole can be left out.
        cx = side * W / 2
        cz = (EAVE + RIDGE) / 2
        width = math.hypot(W, RIDGE - EAVE)
        for k, (ya, yb) in enumerate(((SOUTH, hy0), (hy0, hy1), (hy1, NORTH))):
            if yb - ya < 0.05:
                continue
            if side < 0 and k == 1:
                # The hole is in the west slope: leave a ragged gap.
                for j, (xa, xb) in enumerate(((-W, hx0), (hx1, 0.0))):
                    if xb - xa < 0.05:
                        continue
                    mx = (xa + xb) / 2
                    kit.box(f"ceil.{side}.{k}.{j}", ((xb - xa) / math.cos(math.radians(slope)) + 0.02, yb - ya, 0.06),
                            (mx, (ya + yb) / 2, roof_z(mx) + 0.03), plaster, rot=(0, -slope, 0))
                continue
            kit.box(f"ceil.{side}.{k}", (width, yb - ya, 0.06), (cx, (ya + yb) / 2, cz + 0.03), plaster,
                    rot=(0, side * slope, 0))
    for k in range(6):
        y = SOUTH + 1.0 + k * 1.6
        if hy0 < y < hy1:
            continue
        for side in (-1, 1):
            kit.box(f"rafter.{k}.{side}", (math.hypot(W, RIDGE - EAVE), 0.1, 0.14), (side * W / 2, y, (EAVE + RIDGE) / 2 - 0.05), rafter,
                    rot=(0, side * slope, 0))
    # The hole: broken laths and slates round its edge, and the night beyond.
    hole = [kit.box("hole.sky", (6.0, 6.0, 0.1), ((hx0 + hx1) / 2, (hy0 + hy1) / 2, RIDGE + 2.5), sky)]
    for k in range(14):
        t = k / 13
        x = hx0 + (hx1 - hx0) * t
        for y in (hy0, hy1):
            hole.append(kit.box(f"hole.lath.{k}.{y}", (0.04, 0.35 + rng.random() * 0.3, 0.03), (x, y + rng.uniform(-0.1, 0.1), roof_z(x) + 0.05),
                                rafter, rot=(rng.uniform(-20, 20), -slope, rng.uniform(-30, 30))))
    for k in range(10):
        x = rng.uniform(hx0, hx1)
        hole.append(kit.box(f"hole.slate.{k}", (0.3, 0.2, 0.02), (x, rng.choice((hy0, hy1)) + rng.uniform(-0.15, 0.15), roof_z(x) + 0.12),
                            slate, rot=(rng.uniform(-25, 25), -slope + rng.uniform(-15, 15), rng.uniform(0, 90))))
    kit.hotspot(hole, HOTSPOTS["roofHole"])
    # Rubble from the roof, swept nowhere for forty years.
    for k in range(9):
        r = 0.05 + rng.random() * 0.1
        # Clear of the stairwell, which the hole hangs over.
        kit.rock(f"roof.rubble.{k}", r, (rng.uniform(WELL[1] + 0.2, hx1), rng.uniform(hy0, hy1 - 0.3), r * 0.4), slate, seed=500 + k)

    # ---------------- the narrow bed, made forty years ago and never slept in since
    bx, by = -2.7, -1.5
    kit.box("bed.frame", (1.0, 2.0, 0.3), (bx, by, 0.35), oak, bevel=0.02)
    kit.box("bed.head", (1.0, 0.08, 1.0), (bx, by + 1.0, 0.5), oak, bevel=0.02)
    kit.box("bed.foot", (1.0, 0.08, 0.6), (bx, by - 1.0, 0.3), oak, bevel=0.02)
    kit.box("bed.mattress", (0.92, 1.9, 0.16), (bx, by, 0.58), linen, bevel=0.05)
    kit.box("bed.quilt", (0.98, 1.4, 0.05), (bx, by - 0.25, 0.68), quilt, bevel=0.02)
    kit.sphere("bed.pillow", 0.22, (bx, by + 0.72, 0.72), linen, scale=(1.6, 0.8, 0.45))
    for k in range(4):
        kit.box(f"bed.leg.{k}", (0.08, 0.08, 0.2), (bx + (-0.45 if k % 2 else 0.45), by + (-0.95 if k < 2 else 0.95), 0.1), oak)

    # ---------------- the writing table, its chair pushed back
    tx, ty = 2.2, 1.9
    kit.box("table.top", (1.4, 0.7, 0.05), (tx, ty, 0.76), oak, bevel=0.01)
    for k in range(4):
        kit.box(f"table.leg.{k}", (0.06, 0.06, 0.74), (tx + (-0.64 if k % 2 else 0.64), ty + (-0.29 if k < 2 else 0.29), 0.37), oak)
    kit.box("table.drawer", (0.6, 0.03, 0.12), (tx, ty - 0.36, 0.66), oak, bevel=0.005)
    # Pushed back and to the right, as if she had just stood up: clear of the
    # table top, so the camera sees what she left there.
    cx, cy = tx + 0.95, ty - 0.95
    chair = [kit.box("chair.seat", (0.46, 0.44, 0.04), (cx, cy, 0.46), oak, bevel=0.01),
             kit.box("chair.back", (0.46, 0.04, 0.5), (cx, cy - 0.22, 0.75), oak, bevel=0.01)]
    for k in range(4):
        chair.append(kit.box(f"chair.leg.{k}", (0.04, 0.04, 0.45), (cx + (-0.2 if k % 2 else 0.2), cy + (-0.2 if k < 2 else 0.2), 0.22), oak))
    pivot = kit.empty("chair", (cx, cy, 0.0))
    kit.parent(chair, pivot)
    pivot.rotation_euler = (0, 0, math.radians(-38))
    # What she left on it: the cylinder in its sleeve, and the page.
    cylinder = [kit.cylinder("cylinder.sleeve", 0.06, 0.17, (tx - 0.35, ty + 0.05, 0.875), card, segments=20),
                kit.cylinder("cylinder.wax", 0.052, 0.04, (tx - 0.35, ty + 0.05, 0.98), wax, segments=20)]
    # The page is propped against the sleeve, tilted up towards the room.
    sheet = kit.box("verse.page", (0.34, 0.44, 0.004), (tx + 0.1, ty + 0.05, 0.86), page)
    lines = [kit.box(f"verse.line.{k}", (0.22 - (k % 3) * 0.03, 0.01, 0.002), (tx + 0.1, ty + 0.19 - k * 0.045, 0.863), ink) for k in range(7)]
    kit.parent(lines, sheet)
    sheet.rotation_euler = (math.radians(-55), 0, math.radians(10))
    verse = [sheet] + lines
    kit.hotspot(cylinder, HOTSPOTS["cylinder"])
    kit.hotspot(verse, HOTSPOTS["verse"])

    # ---------------- the servants' door, stuck in its frame
    sy0, sy1 = SERVANT[0], SERVANT[1]
    servant = []
    for y in (sy0, sy1):
        servant.append(kit.box(f"servant.jamb.{y}", (0.26, 0.08, SERVANT[3] + 0.05), (W, y, (SERVANT[3] + 0.05) / 2), oak))
    servant.append(kit.box("servant.lintel", (0.26, sy1 - sy0 + 0.16, 0.1), (W, (sy0 + sy1) / 2, SERVANT[3] + 0.05), oak))
    leaf = kit.box("servant.leaf", (0.05, sy1 - sy0 - 0.02, SERVANT[3] - 0.02), (W + 0.02, sy0 + 0.01, SERVANT[3] / 2), paper, pivot=(0, -1, 0))
    servant.append(leaf)
    servant.append(kit.box("servant.dark", (0.1, sy1 - sy0, SERVANT[3]), (W + 0.9, (sy0 + sy1) / 2, SERVANT[3] / 2), black))
    kit.hotspot(servant, HOTSPOTS["servantDoor"])

    # ---------------- the top of the ladder, in the hole, once it stands in the garden
    ladder = []
    for k, x in enumerate((hx0 + 0.6, hx0 + 1.05)):
        ladder.append(kit.box(f"ladder.rail.{k}", (0.05, 0.05, 1.2), (x, (hy0 + hy1) / 2 - 0.3, roof_z(x) + 0.2), rafter, rot=(-18, 0, 0)))
    for k in range(3):
        ladder.append(kit.box(f"ladder.rung.{k}", (0.45, 0.03, 0.03), (hx0 + 0.82, (hy0 + hy1) / 2 - 0.3 + 0.12 * k, roof_z(hx0 + 0.8) - 0.15 + k * 0.3),
                              rafter))
    kit.hotspot(ladder, HOTSPOTS["roofHole"])

    # ---------------- light: the moon through the hole, and very little else
    kit.world((0.006, 0.008, 0.016), 1.0)
    kit.sun("moon", (0.62, 0.72, 1.0), 7.0, direction=(0.35, 0.25, -1.0), angle=0.5)
    kit.area("hole.sky", (0.45, 0.55, 0.9), 60, ((hx0 + hx1) / 2, (hy0 + hy1) / 2, RIDGE + 0.6), (0, 0, 0), 1.5)
    kit.area("fill", (0.35, 0.40, 0.60), 70, (0, -5.0, 2.6), (65, 0, 0), 4.0, scatter=False)
    kit.point("stair.glow", (0.5, 0.45, 0.4), 6, ((x0 + x1) / 2, (y0 + y1) / 2, -1.2), radius=0.3)
    dust = kit.box("dust", (2 * W - 0.1, NORTH - SOUTH - 0.2, RIDGE - 0.1), (0, (NORTH + SOUTH) / 2, RIDGE / 2), kit.volume("dust", 0.035))
    dust.pass_index = 0

    cam = kit.camera((0.0, -5.6, 1.6), (0.0, 3.0, 1.15), lens=22.0)

    return {
        "room": "grandmotherRoom",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["dust"],
        "hiddenByDefault": [o.name for o in cylinder + verse + ladder],
        "variants": [
            {"id": "cylinder", "when": {"here": "cylinder"}, "show": [o.name for o in cylinder]},
            {"id": "verse", "when": {"here": "verse"}, "show": [o.name for o in verse]},
            {"id": "servantDoor.open", "when": {"flag": "servantStair"}, "rotate": {leaf.name: [0, 0, 100]}},
            {"id": "ladder", "when": {"flag": "ladderUp"}, "show": [o.name for o in ladder]},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-3.6, 3.6, -2.6, 2.6],
                 "blocks": [[x0 - 0.1, x1 + 0.15, y0 - 0.1, y1 + 0.15], [bx - 0.6, bx + 0.6, by - 1.1, by + 1.1],
                            [tx - 0.8, tx + 0.8, ty - 0.45, ty + 0.4]]},
        # Every way in arrives moving up: the stair, the servants' stair, the ladder.
        "points": {"start": [0.3, -0.6], "u": [-1.4, 1.4]},
        "walkTo": {"cylinder": [tx - 0.35, 1.2], "verse": [tx + 0.2, 1.2], "servantDoor": [3.3, 1.6], "roofHole": [-1.2, 0.5],
                   "exit:d": [-1.5, 1.4], "exit:e": [3.4, 1.6], "exit:u": [-1.2, 0.5]},
        "zones": [{"id": "exit:e", "fromHotspot": "servantDoor", "when": {"flag": "servantStair"}},
                  {"id": "exit:u", "fromHotspot": "roofHole", "when": {"flag": "ladderUp"}}],
        "lights": {
            "ambient": [0.08, 0.10, 0.16],
            "key": {"color": [0.62, 0.72, 1.0], "dir": [0.35, -1.0, 0.25], "intensity": 0.5},
        },
        "music": "intrigue",
        "exposure": 1.2,
    }
