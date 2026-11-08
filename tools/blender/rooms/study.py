"""The Study, at night.

Composition follows the EGA painter in js/scenes.js: books floor to
ceiling on the left of the north wall, the cold hearth in the middle with
the silver lyre hanging over it and the portrait of a king above that, the
window on the right with the writing desk beneath it, its drawer open an
inch, and the door back to the hall in the east wall. Moonlight comes in
at the window and lies across the desk and the rug.

The shelves are three hotspots, as they are in the EGA scene: history up
top, instruments in the middle, the field guide low down.
"""
from __future__ import annotations

import math
import random

import kit

W = 5.0          # half-width of the study
NORTH = 3.8
SOUTH = -7.5
CEIL = 3.9
DOOR = (0.35, 1.65)      # the east door, along the wall
DOOR_H = 2.4
HEARTH_X = 0.4
WIN = (2.4, 3.8, 1.0, 2.7)
DESK = (3.1, 3.0)

HOTSPOTS = {
    "floor": 1,
    "lyre": 2,
    "picture": 3,
    "desk": 4,
    "bookHistory": 5,
    "bookMusic": 6,
    "bookSecurity": 7,
    "lens": 8,
    "exit:e": 9,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(17)

    oak = kit.planks("floor.oak", (0.20, 0.11, 0.055), (0.13, 0.07, 0.035))
    panel = kit.wood("wainscot", (0.16, 0.085, 0.04), (0.07, 0.035, 0.018), grain=16.0, along="Z")
    trim = kit.wood("trim", (0.22, 0.12, 0.06), (0.10, 0.05, 0.025), grain=9.0)
    shelfwood = kit.wood("shelf.wood", (0.14, 0.075, 0.035), (0.06, 0.03, 0.015), grain=12.0)
    paper = kit.wallpaper("study.paper", (0.17, 0.09, 0.07), (0.25, 0.17, 0.10), (0.08, 0.05, 0.04))
    plaster = kit.stone("plaster", (0.30, 0.29, 0.26), (0.16, 0.15, 0.13), scale=2.0)
    hearth = kit.ashlar("hearth.stone", (0.24, 0.22, 0.20), (0.12, 0.115, 0.11), mortar=(0.04, 0.04, 0.04), course=0.26, block=0.42)
    soot = kit.stone("soot", (0.05, 0.045, 0.04), (0.01, 0.01, 0.01), scale=8.0)
    ash = kit.stone("ash", (0.22, 0.21, 0.2), (0.08, 0.08, 0.08), scale=30.0)
    brass = kit.solid("brass", (0.62, 0.43, 0.17), rough=0.32, metal=1.0)
    gilt = kit.solid("gilt", (0.75, 0.55, 0.2), rough=0.28, metal=1.0)
    silver = kit.solid("silver", (0.85, 0.86, 0.88), rough=0.22, metal=1.0)
    gut = kit.solid("lyre.strings", (0.8, 0.78, 0.7), rough=0.4)
    black = kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)
    pane = kit.glass("pane", (0.9, 0.93, 0.92), rough=0.06)
    rug_red = kit.solid("rug.red", (0.20, 0.025, 0.02), rough=0.95)
    rug_brown = kit.solid("rug.brown", (0.11, 0.05, 0.025), rough=0.95)
    paint = kit.stone("king.paint", (0.07, 0.09, 0.22), (0.02, 0.025, 0.07), scale=3.0)
    face = kit.solid("king.face", (0.55, 0.32, 0.24), rough=0.7)
    robe = kit.solid("king.robe", (0.4, 0.04, 0.04), rough=0.8)
    book_mats = [kit.solid(f"book.{c}", rgb, rough=0.7, sheen=0.3) for c, rgb in
                 (("red", (0.28, 0.04, 0.03)), ("green", (0.04, 0.16, 0.06)), ("blue", (0.04, 0.06, 0.2)),
                  ("plum", (0.2, 0.04, 0.16)), ("tan", (0.25, 0.17, 0.09)), ("black", (0.03, 0.03, 0.03)))]

    # ---------------- shell
    kit.hotspot([kit.box("floor", (2 * W, NORTH - SOUTH, 0.1), (0, (NORTH + SOUTH) / 2, -0.05), oak)], HOTSPOTS["floor"])
    kit.box("ceiling", (2 * W, NORTH - SOUTH, 0.2), (0, (NORTH + SOUTH) / 2, CEIL + 0.1), plaster)
    for i in range(5):
        kit.box(f"beam.{i}", (2 * W, 0.24, 0.26), (0, -4.5 + i * 2.0, CEIL - 0.13), trim, bevel=0.01)
    win = [(WIN[0], WIN[1], WIN[2], WIN[3])]
    kit.wall_with_openings("north.paper", -W, W, CEIL, 0.1, win, paper, "X", NORTH + 0.05)
    kit.box("north.wainscot", (2 * W, 0.06, 0.95), (0, NORTH - 0.03, 0.475), panel)
    kit.box("north.crown", (2 * W, 0.16, 0.18), (0, NORTH - 0.08, CEIL - 0.09), trim, bevel=0.02)
    kit.box("south.wall", (2 * W, 0.1, CEIL), (0, SOUTH, CEIL / 2), paper)
    kit.box("west.paper", (0.1, NORTH - SOUTH, CEIL), (-W - 0.05, (NORTH + SOUTH) / 2, CEIL / 2), paper)
    kit.box("west.wainscot", (0.06, NORTH - SOUTH, 0.95), (-W + 0.03, (NORTH + SOUTH) / 2, 0.475), panel)
    opening = [(DOOR[0], DOOR[1], 0.0, DOOR_H)]
    kit.wall_with_openings("east.paper", SOUTH, NORTH, CEIL, 0.1, opening, paper, "Y", W + 0.05)
    kit.wall_with_openings("east.wainscot", SOUTH, NORTH, 0.95, 0.06, opening, panel, "Y", W - 0.03)

    # ---------------- the east door back to the hall
    cy = sum(DOOR) / 2
    door = [
        kit.box("east.corr.floor", (3.0, 1.5, 0.1), (W + 1.5, cy, -0.05), oak),
        kit.box("east.corr.back", (0.1, 1.5, 3.0), (W + 3.0, cy, 1.5), paper),
        kit.box("east.corr.l", (3.0, 0.1, 3.0), (W + 1.5, DOOR[0] - 0.05, 1.5), paper),
        kit.box("east.corr.r", (3.0, 0.1, 3.0), (W + 1.5, DOOR[1] + 0.05, 1.5), paper),
        kit.box("east.corr.top", (3.0, 1.5, 0.1), (W + 1.5, cy, 2.8), plaster),
    ]
    for y in DOOR:
        door.append(kit.box(f"east.jamb.{y}", (0.2, 0.12, DOOR_H + 0.1), (W - 0.05, y, (DOOR_H + 0.1) / 2), trim, bevel=0.015))
    door.append(kit.box("east.lintel", (0.22, DOOR[1] - DOOR[0] + 0.24, 0.2), (W - 0.05, cy, DOOR_H + 0.1), trim, bevel=0.015))
    leaf = kit.box("east.door", (0.06, DOOR[1] - DOOR[0] - 0.1, DOOR_H - 0.05), (W + 0.05, DOOR[0] + 0.05, DOOR_H / 2), panel,
                   pivot=(0, -1, 0), bevel=0.01)
    leaf.rotation_euler = (0, 0, math.radians(-75))
    door.append(leaf)
    kit.hotspot(door, HOTSPOTS["exit:e"])
    kit.point("east.spill", (1.0, 0.6, 0.3), 14, (W + 2.2, cy, 1.8), radius=0.4)

    # ---------------- books, floor to ceiling, on the left of the north wall
    sx0, sx1, sy = -W + 0.1, -1.6, NORTH - 0.22
    carcass = [kit.box("shelf.back", (sx1 - sx0, 0.04, CEIL - 0.1), ((sx0 + sx1) / 2, NORTH - 0.06, (CEIL - 0.1) / 2), shelfwood)]
    for x in (sx0, sx1):
        carcass.append(kit.box(f"shelf.side.{x}", (0.06, 0.42, CEIL - 0.1), (x, sy, (CEIL - 0.1) / 2), shelfwood, bevel=0.005))
    rows = [0.08, 0.78, 1.48, 2.18, 2.88]
    shelves = {"bookSecurity": [], "bookMusic": [], "bookHistory": carcass}
    for r, z in enumerate(rows):
        owner = "bookSecurity" if r < 2 else "bookMusic" if r == 2 else "bookHistory"
        shelves[owner].append(kit.box(f"shelf.board.{r}", (sx1 - sx0, 0.42, 0.04), ((sx0 + sx1) / 2, sy, z), shelfwood, bevel=0.004))
        x = sx0 + 0.05
        while x < sx1 - 0.1:
            w = rng.uniform(0.04, 0.085)
            if rng.random() < 0.05:
                x += w * 2              # a gap where someone took one down
                continue
            h = rng.uniform(0.36, 0.56)
            lean = rng.uniform(-6, 6) if rng.random() < 0.12 else 0.0
            shelves[owner].append(kit.box(f"book.{r}.{x:.3f}", (w - 0.004, rng.uniform(0.24, 0.32), h), (x + w / 2, sy + 0.02, z + 0.02 + h / 2),
                                          rng.choice(book_mats), rot=(0, lean, 0), bevel=0.004))
            x += w
    for owner, objs in shelves.items():
        kit.hotspot(objs, HOTSPOTS[owner])

    # ---------------- the cold hearth, its lyre, its king
    hx = HEARTH_X
    kit.box("breast", (2.0, 0.5, CEIL), (hx, NORTH - 0.25, CEIL / 2), hearth)
    kit.box("firebox", (1.0, 0.4, 1.05), (hx, NORTH - 0.32, 0.525), soot)
    kit.box("firebox.back", (1.0, 0.05, 1.05), (hx, NORTH - 0.12, 0.525), black)
    kit.box("hearth.slab", (2.2, 0.6, 0.08), (hx, NORTH - 0.75, 0.04), hearth, bevel=0.01)
    kit.box("mantel", (2.3, 0.32, 0.1), (hx, NORTH - 0.62, 1.3), trim, bevel=0.012)
    kit.box("ash", (0.8, 0.3, 0.05), (hx, NORTH - 0.35, 0.03), ash)
    for k in range(3):
        kit.cylinder(f"log.{k}", 0.055, 0.6, (hx - 0.1 + k * 0.12, NORTH - 0.35, 0.09 + (k % 2) * 0.06), soot, rot=(0, 90, 20 * k - 20), segments=10)

    lyre = []
    ly, lz = NORTH - 0.53, 1.75
    lyre.append(kit.box("lyre.base", (0.32, 0.04, 0.05), (hx, ly, lz - 0.25), silver, bevel=0.01))
    for side in (-1, 1):
        for k, (dx, dz, ang) in enumerate(((0.13, -0.14, 8), (0.17, 0.02, -6), (0.15, 0.18, -22), (0.09, 0.29, -50))):
            lyre.append(kit.box(f"lyre.arm.{side}.{k}", (0.03, 0.03, 0.18), (hx + side * dx, ly, lz + dz), silver, rot=(0, side * ang, 0)))
    lyre.append(kit.cylinder("lyre.yoke", 0.014, 0.3, (hx, ly, lz + 0.31), silver, rot=(0, 90, 0), segments=10))
    for k in range(6):
        x = hx - 0.075 + k * 0.03
        lyre.append(kit.cylinder(f"lyre.string.{k}", 0.0025, 0.54, (x, ly + 0.005, lz + 0.04), gut, segments=5))
    kit.hotspot(lyre, HOTSPOTS["lyre"])

    picture = [kit.box("portrait.frame", (1.05, 0.06, 1.15), (hx, NORTH - 0.53, 2.95), gilt, bevel=0.025),
               kit.box("portrait.canvas", (0.88, 0.02, 0.98), (hx, NORTH - 0.57, 2.95), paint),
               kit.sphere("portrait.face", 0.13, (hx, NORTH - 0.585, 3.08), face, scale=(0.85, 0.1, 1.05)),
               kit.box("portrait.robe", (0.6, 0.02, 0.3), (hx, NORTH - 0.585, 2.62), robe),
               kit.box("portrait.plate", (0.32, 0.015, 0.06), (hx, NORTH - 0.57, 2.3), brass)]
    for k in range(3):
        picture.append(kit.box(f"portrait.crown.{k}", (0.035, 0.012, 0.09), (hx - 0.07 + k * 0.07, NORTH - 0.59, 3.27 + (k == 1) * 0.02), gilt))
    picture.append(kit.box("portrait.crown.band", (0.2, 0.012, 0.04), (hx, NORTH - 0.59, 3.22), gilt))
    kit.hotspot(picture, HOTSPOTS["picture"])

    # ---------------- the window, and the desk beneath it
    wx = (WIN[0] + WIN[1]) / 2
    wz = (WIN[2] + WIN[3]) / 2
    kit.box("window.glass", (WIN[1] - WIN[0], 0.01, WIN[3] - WIN[2]), (wx, NORTH + 0.08, wz), pane)
    kit.box("window.mullion", (0.05, 0.06, WIN[3] - WIN[2]), (wx, NORTH + 0.05, wz), trim)
    kit.box("window.transom", (WIN[1] - WIN[0], 0.06, 0.05), (wx, NORTH + 0.05, wz + 0.2), trim)
    kit.box("window.sill", (WIN[1] - WIN[0] + 0.3, 0.26, 0.06), (wx, NORTH - 0.1, WIN[2] - 0.03), trim, bevel=0.01)
    kit.box("window.night", (6.0, 0.1, 5.0), (wx, NORTH + 3.0, 2.0), kit.solid("night", (0.02, 0.03, 0.06), rough=1.0))

    dx, dy = DESK
    desk = [kit.box("desk.top", (1.7, 0.75, 0.05), (dx, dy, 0.78), trim, bevel=0.01)]
    for lx in (dx - 0.78, dx + 0.78):
        for ly2 in (dy - 0.32, dy + 0.32):
            desk.append(kit.box(f"desk.leg.{lx}.{ly2}", (0.06, 0.06, 0.76), (lx, ly2, 0.38), trim))
    desk.append(kit.box("desk.apron", (1.6, 0.04, 0.14), (dx, dy - 0.35, 0.69), trim))
    drawer_y = dy - 0.33 - 0.14          # pulled out a hand's breadth
    desk += [kit.box("drawer.front", (0.62, 0.03, 0.12), (dx, drawer_y - 0.2, 0.68), trim, bevel=0.006),
             kit.box("drawer.bottom", (0.56, 0.42, 0.01), (dx, drawer_y, 0.63), black),
             kit.box("drawer.side.l", (0.015, 0.42, 0.1), (dx - 0.29, drawer_y, 0.68), trim),
             kit.box("drawer.side.r", (0.015, 0.42, 0.1), (dx + 0.29, drawer_y, 0.68), trim),
             kit.cylinder("drawer.knob", 0.02, 0.03, (dx, drawer_y - 0.23, 0.68), brass, rot=(90, 0, 0), segments=10)]
    desk.append(kit.box("desk.inkwell", (0.07, 0.07, 0.06), (dx + 0.5, dy + 0.15, 0.83), kit.solid("ink", (0.02, 0.02, 0.04), rough=0.1)))
    desk.append(kit.box("desk.papers", (0.32, 0.24, 0.01), (dx - 0.3, dy + 0.05, 0.81), kit.solid("old.paper", (0.55, 0.5, 0.4), rough=0.8),
                        rot=(0, 0, 12)))
    kit.hotspot(desk, HOTSPOTS["desk"])
    # The lens lies propped on the drawer's papers, its rim just showing over the front.
    lz = 0.75
    lens = [kit.torus("lens.rim", 0.05, 0.009, (dx + 0.08, drawer_y - 0.1, lz), brass, segments=24, sides=8),
            kit.cylinder("lens.glass", 0.047, 0.006, (dx + 0.08, drawer_y - 0.1, lz), pane, segments=20),
            kit.box("lens.handle", (0.11, 0.016, 0.012), (dx + 0.19, drawer_y - 0.12, lz - 0.02), brass, rot=(0, 10, -15))]
    for o in lens[:2]:
        o.rotation_euler = (math.radians(55), 0, 0)
    kit.hotspot(lens, HOTSPOTS["lens"])

    # ---------------- a faded rug, and a reading chair
    kit.cylinder("rug", 1.7, 0.012, (0.0, 0.2, 0.006), rug_red, segments=48).scale = (1.0, 0.55, 1.0)
    kit.cylinder("rug.field", 1.45, 0.014, (0.0, 0.2, 0.007), rug_brown, segments=48).scale = (1.0, 0.5, 1.0)
    cx, cyy = -2.5, 1.2
    kit.box("chair.seat", (0.6, 0.6, 0.1), (cx, cyy, 0.45), kit.solid("leather", (0.14, 0.05, 0.03), rough=0.6), bevel=0.04, rot=(0, 0, 25))
    kit.box("chair.back", (0.6, 0.12, 0.7), (cx - 0.12, cyy + 0.26, 0.85), kit.solid("leather", (0.14, 0.05, 0.03), rough=0.6), bevel=0.04,
            rot=(-8, 0, 25))
    for k in range(4):
        a = math.radians(25 + 45 + k * 90)
        kit.box(f"chair.leg.{k}", (0.05, 0.05, 0.42), (cx + math.cos(a) * 0.36, cyy + math.sin(a) * 0.36, 0.21), trim)

    # ---------------- light: moonlight at the window, a candle's ghost of warmth from the hall
    kit.world((0.01, 0.014, 0.026), 1.0)
    kit.area("moon.window", (0.62, 0.72, 1.0), 900, (wx - 0.4, NORTH + 1.4, 3.6), (-60, 10, 0), 1.6)
    kit.area("fill", (0.35, 0.42, 0.65), 110, (0, -5.5, 3.2), (60, 0, 0), 4.0, scatter=False)
    kit.area("bounce", (0.5, 0.42, 0.36), 40, (0, 0.5, CEIL - 0.3), (0, 0, 0), 4.0, scatter=False)
    dust = kit.box("dust", (2 * W - 0.1, NORTH - SOUTH - 0.2, CEIL - 0.1), (0, (NORTH + SOUTH) / 2, CEIL / 2), kit.volume("dust", 0.03))
    dust.pass_index = 0

    cam = kit.camera((0.0, -6.0, 1.7), (0.0, 4.0, 1.45), lens=24.0)

    return {
        "room": "study",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["dust"],
        "hiddenByDefault": [o.name for o in lyre + lens],
        "variants": [
            {"id": "lyre", "when": {"here": "lyre"}, "show": [o.name for o in lyre]},
            {"id": "lens", "when": {"in": ["lens", "desk"]}, "show": [o.name for o in lens]},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-4.5, 4.5, -2.4, 2.7],
                 "blocks": [[dx - 0.95, dx + 0.95, dy - 0.75, dy + 0.5], [cx - 0.5, cx + 0.5, cyy - 0.45, cyy + 0.5]]},
        "points": {"start": [-0.5, -1.0], "w": [4.0, cy]},
        "walkTo": {
            "lyre": [hx, 2.3], "picture": [hx, 2.1], "desk": [dx - 0.2, 1.95], "lens": [dx - 0.2, 1.95],
            "bookHistory": [-3.3, 2.4], "bookMusic": [-3.3, 2.4], "bookSecurity": [-3.3, 2.4],
            "exit:e": [4.45, cy],
        },
        "zones": [],
        "lights": {
            "ambient": [0.10, 0.11, 0.16],
            "key": {"color": [0.62, 0.72, 1.0], "dir": [-0.3, -0.7, 0.6], "intensity": 0.45},
        },
        "music": "manor",
        "exposure": 1.1,
    }
