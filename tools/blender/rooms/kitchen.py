"""The Kitchen, at night.

Composition follows the EGA painter in js/scenes.js: the black iron stove
on the left with its flue going up, the window with its moth-eaten curtain
right of centre, the table in the middle holding someone's unfinished
business (a knife, a loaf), the pantry door ajar in the right-hand corner
with its shelves just visible, and the way back to the hall in the west
wall. Flagstones underfoot. Moonlight at the window.

Everything a player can take is an overlay, so the table and the pantry
empty as the game goes on.
"""
from __future__ import annotations

import math
import random

import kit

W = 5.0
NORTH = 3.8
SOUTH = -7.5
CEIL = 3.6
DOOR = (0.0, 1.3)        # the west door, along the wall
DOOR_H = 2.35
WIN = (1.2, 2.5, 1.1, 2.7)
PANTRY = (3.4, 4.6, 0.0, 2.3)
TABLE = (0.3, 1.3)
BACK = (-1.65, -0.55, 0.0, 2.3)      # the back door, to the kitchen garden (story bible, 6b)
SERVANT = (1.95, 2.65, 0.0, 2.15)    # the servants' stair, in the east wall behind the pantry

HOTSPOTS = {
    "floor": 1,
    "stove": 2,
    "curtain": 3,
    "pantry": 4,
    "knife": 5,
    "loaf": 6,
    "candle": 7,
    "flour": 8,
    "exit:w": 9,
    "backDoor": 10,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(29)

    flags = kit.planks("flagstones", (0.21, 0.205, 0.19), (0.13, 0.125, 0.12), gap=(0.03, 0.03, 0.03), width=0.5, length=0.62)
    wall = kit.ashlar("kitchen.wall", (0.30, 0.29, 0.27), (0.17, 0.165, 0.155), mortar=(0.08, 0.08, 0.075), course=0.3, block=0.55)
    plaster = kit.stone("plaster", (0.30, 0.29, 0.26), (0.16, 0.15, 0.13), scale=2.0)
    trim = kit.wood("trim", (0.22, 0.12, 0.06), (0.10, 0.05, 0.025), grain=9.0)
    deal = kit.wood("deal", (0.30, 0.22, 0.13), (0.15, 0.10, 0.055), grain=7.0, rough=0.7)
    iron = kit.solid("iron", (0.05, 0.05, 0.055), rough=0.55, metal=0.85)
    castiron = kit.stone("castiron", (0.04, 0.04, 0.042), (0.015, 0.015, 0.017), scale=20.0)
    copper = kit.solid("copper", (0.55, 0.25, 0.14), rough=0.35, metal=1.0)
    steel = kit.solid("knife.steel", (0.35, 0.3, 0.27), rough=0.4, metal=0.9)
    crust = kit.stone("crust", (0.42, 0.24, 0.09), (0.25, 0.12, 0.04), scale=12.0)
    crumb = kit.stone("crumb", (0.6, 0.52, 0.36), (0.45, 0.38, 0.25), scale=30.0)
    cloth = kit.stone("curtain", (0.30, 0.07, 0.22), (0.12, 0.03, 0.09), scale=11.0)
    sacking = kit.stone("sacking", (0.45, 0.4, 0.3), (0.28, 0.24, 0.17), scale=25.0)
    wax = kit.solid("wax", (0.70, 0.66, 0.55), rough=0.5)
    black = kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)
    pane = kit.glass("pane", (0.9, 0.93, 0.92), rough=0.06)

    # ---------------- shell
    kit.hotspot([kit.box("floor", (2 * W, NORTH - SOUTH, 0.1), (0, (NORTH + SOUTH) / 2, -0.05), flags)], HOTSPOTS["floor"])
    kit.box("ceiling", (2 * W, NORTH - SOUTH, 0.2), (0, (NORTH + SOUTH) / 2, CEIL + 0.1), plaster)
    for i in range(5):
        kit.box(f"beam.{i}", (2 * W, 0.26, 0.28), (0, -4.6 + i * 2.1, CEIL - 0.14), trim, bevel=0.01)
    kit.wall_with_openings("north", -W, W, CEIL, 0.3, [WIN, PANTRY, BACK], wall, "X", NORTH + 0.15)
    kit.box("south.wall", (2 * W, 0.1, CEIL), (0, SOUTH, CEIL / 2), wall)
    kit.wall_with_openings("east", SOUTH, NORTH, CEIL, 0.3, [SERVANT], wall, "Y", W + 0.15)

    # ---------------- the back door, bolted on this side, and the night behind it
    bx = (BACK[0] + BACK[1]) / 2
    back = [kit.box("back.night", (3.0, 0.1, 3.0), (bx, NORTH + 1.6, 1.4), kit.solid("garden.night", (0.02, 0.035, 0.05), rough=1.0)),
            kit.box("back.step", (BACK[1] - BACK[0], 1.2, 0.08), (bx, NORTH + 0.7, -0.04), flags)]
    for x in BACK[:2]:
        back.append(kit.box(f"back.jamb.{x}", (0.12, 0.34, BACK[3] + 0.1), (x, NORTH, (BACK[3] + 0.1) / 2), trim))
    back.append(kit.box("back.lintel", (BACK[1] - BACK[0] + 0.24, 0.34, 0.16), (bx, NORTH, BACK[3] + 0.1), trim))
    back_leaf = kit.box("back.leaf", (BACK[1] - BACK[0] - 0.04, 0.06, BACK[3] - 0.04), (BACK[0] + 0.02, NORTH + 0.02, BACK[3] / 2), deal,
                        pivot=(-1, 0, 0), bevel=0.01)
    bolt = [kit.box("back.bolt", (0.22, 0.03, 0.04), (BACK[1] - 0.2, NORTH - 0.03, 1.2), iron),
            kit.box("back.bolt.keep", (0.05, 0.05, 0.08), (BACK[1] - 0.06, NORTH - 0.03, 1.2), iron)]
    for k, z in enumerate((0.4, 1.9)):
        back.append(kit.box(f"back.hinge.{k}", (0.24, 0.02, 0.05), (BACK[0] + 0.14, NORTH - 0.02, z), iron))
    kit.parent(bolt, back_leaf)
    kit.hotspot(back + [back_leaf] + bolt, HOTSPOTS["backDoor"])

    # ---------------- the servants' door, painted the colour of not being noticed
    sc = (SERVANT[0] + SERVANT[1]) / 2
    servant_leaf = kit.box("servant.leaf", (0.05, SERVANT[1] - SERVANT[0] - 0.02, SERVANT[3] - 0.02), (W + 0.03, SERVANT[0] + 0.01, SERVANT[3] / 2),
                           plaster, pivot=(0, -1, 0))
    for k in range(5):
        z = 0.2 + k * 0.4
        kit.box(f"servant.step.{k}", (0.6, SERVANT[1] - SERVANT[0], 0.18), (W + 0.5 + k * 0.28, sc, z), deal)
    kit.box("servant.dark", (0.1, SERVANT[1] - SERVANT[0] + 0.2, 3.0), (W + 2.0, sc, 1.5), black)
    kit.wall_with_openings("west", SOUTH, NORTH, CEIL, 0.3, [(DOOR[0], DOOR[1], 0.0, DOOR_H)], wall, "Y", -W - 0.15)

    # ---------------- the way back to the hall
    cy = sum(DOOR) / 2
    door = [
        kit.box("west.corr.floor", (3.0, 1.3, 0.1), (-W - 1.5, cy, -0.05), kit.planks("floor.oak", (0.20, 0.11, 0.055), (0.13, 0.07, 0.035))),
        kit.box("west.corr.back", (0.1, 1.3, 3.0), (-W - 3.0, cy, 1.5), plaster),
        kit.box("west.corr.l", (3.0, 0.1, 3.0), (-W - 1.5, DOOR[0] - 0.05, 1.5), plaster),
        kit.box("west.corr.r", (3.0, 0.1, 3.0), (-W - 1.5, DOOR[1] + 0.05, 1.5), plaster),
        kit.box("west.corr.top", (3.0, 1.3, 0.1), (-W - 1.5, cy, 2.7), plaster),
    ]
    for y in DOOR:
        door.append(kit.box(f"west.jamb.{y}", (0.34, 0.12, DOOR_H + 0.1), (-W, y, (DOOR_H + 0.1) / 2), trim, bevel=0.015))
    door.append(kit.box("west.lintel", (0.36, DOOR[1] - DOOR[0] + 0.24, 0.2), (-W, cy, DOOR_H + 0.1), trim, bevel=0.015))
    kit.hotspot(door, HOTSPOTS["exit:w"])
    kit.point("west.spill", (0.45, 0.5, 0.8), 10, (-W - 2.2, cy, 1.8), radius=0.4)

    # ---------------- the black iron stove, cold
    sx, sy = -3.35, 3.05
    stove = [kit.box("stove.body", (1.8, 0.8, 0.82), (sx, sy, 0.41), castiron, bevel=0.02),
             kit.box("stove.top", (1.95, 0.9, 0.06), (sx, sy, 0.85), iron, bevel=0.01),
             kit.box("stove.rail", (1.9, 0.03, 0.03), (sx, sy - 0.5, 0.74), iron),
             kit.box("stove.oven", (0.7, 0.03, 0.5), (sx + 0.4, sy - 0.41, 0.42), iron, bevel=0.01),
             kit.box("stove.firebox", (0.5, 0.03, 0.34), (sx - 0.45, sy - 0.41, 0.5), black),
             kit.box("stove.firedoor", (0.04, 0.42, 0.34), (sx - 0.72, sy - 0.62, 0.5), iron, rot=(0, 0, 30)),
             kit.cylinder("stove.flue", 0.12, CEIL - 0.88, (sx + 0.5, sy + 0.2, (CEIL + 0.88) / 2), iron, segments=16)]
    for k, px in enumerate((-0.5, 0.0)):
        stove.append(kit.cylinder(f"stove.plate.{k}", 0.17, 0.02, (sx + px, sy - 0.05, 0.89), iron, segments=24))
    for k in range(4):
        stove.append(kit.box(f"stove.foot.{k}", (0.1, 0.1, 0.08), (sx + (-0.8 if k % 2 else 0.8), sy + (-0.3 if k < 2 else 0.3), 0.04), iron))
    kit.hotspot(stove, HOTSPOTS["stove"])
    kit.box("pot.shelf", (1.6, 0.28, 0.05), (sx, NORTH - 0.14, 1.9), deal)
    for k in range(3):
        kit.cylinder(f"pot.{k}", 0.13 + k * 0.03, 0.18, (sx - 0.5 + k * 0.5, NORTH - 0.16, 2.02), copper, segments=18)

    # ---------------- the window, and the curtain the moths have been at
    wx, wz = (WIN[0] + WIN[1]) / 2, (WIN[2] + WIN[3]) / 2
    kit.box("window.glass", (WIN[1] - WIN[0], 0.01, WIN[3] - WIN[2]), (wx, NORTH + 0.15, wz), pane)
    kit.box("window.mullion", (0.05, 0.06, WIN[3] - WIN[2]), (wx, NORTH + 0.12, wz), trim)
    kit.box("window.transom", (WIN[1] - WIN[0], 0.06, 0.05), (wx, NORTH + 0.12, wz + 0.25), trim)
    kit.box("window.sill", (WIN[1] - WIN[0] + 0.3, 0.3, 0.06), (wx, NORTH - 0.12, WIN[2] - 0.03), deal, bevel=0.01)
    kit.box("window.night", (6.0, 0.1, 5.0), (wx, NORTH + 3.0, 2.0), kit.solid("night", (0.02, 0.03, 0.06), rough=1.0))
    kit.cylinder("curtain.rod", 0.015, 1.9, (wx, NORTH - 0.08, WIN[3] + 0.12), iron, rot=(0, 90, 0), segments=8)
    curtain = []
    for k in range(6):
        curtain.append(kit.box(f"curtain.fold.{k}", (0.13, 0.03, 1.85 - (k % 2) * 0.06), (WIN[0] - 0.25 + k * 0.12, NORTH - 0.1 + (k % 2) * 0.03,
                                                                                         WIN[3] + 0.1 - 0.93), cloth, rot=(0, 0, 25 if k % 2 else -25)))
    kit.hotspot(curtain, HOTSPOTS["curtain"])

    # ---------------- the pantry, ajar in the corner
    px0, px1 = PANTRY[0], PANTRY[1]
    pc = (px0 + px1) / 2
    pantry = [kit.box("pantry.floor", (px1 - px0, 1.4, 0.1), (pc, NORTH + 0.85, -0.05), flags),
              kit.box("pantry.back", (px1 - px0, 0.1, 2.4), (pc, NORTH + 1.55, 1.2), plaster),
              kit.box("pantry.l", (0.1, 1.4, 2.4), (px0 - 0.05, NORTH + 0.85, 1.2), plaster),
              kit.box("pantry.r", (0.1, 1.4, 2.4), (px1 + 0.05, NORTH + 0.85, 1.2), plaster),
              kit.box("pantry.top", (px1 - px0, 1.4, 0.1), (pc, NORTH + 0.85, 2.35), plaster)]
    for k, z in enumerate((0.5, 1.05, 1.6)):
        pantry.append(kit.box(f"pantry.shelf.{k}", (px1 - px0, 0.45, 0.03), (pc, NORTH + 1.3, z), deal))
        for j in range(3):
            if (k + j) % 3 == 1:
                continue
            pantry.append(kit.cylinder(f"pantry.jar.{k}.{j}", 0.07, 0.18, (px0 + 0.25 + j * 0.35, NORTH + 1.35, z + 0.105),
                                       kit.solid("crock", (0.35, 0.3, 0.22), rough=0.4), segments=14))
    for y in (px0, px1):
        pantry.append(kit.box(f"pantry.jamb.{y}", (0.12, 0.34, PANTRY[3] + 0.1), (y, NORTH, (PANTRY[3] + 0.1) / 2), trim))
    pantry.append(kit.box("pantry.lintel", (px1 - px0 + 0.24, 0.34, 0.16), (pc, NORTH, PANTRY[3] + 0.1), trim))
    # Hinged on the right, so it opens away from the room's eye and shows the shelves.
    leaf = kit.box("pantry.door", (px1 - px0 - 0.08, 0.05, PANTRY[3] - 0.04), (px1 - 0.04, NORTH - 0.12, PANTRY[3] / 2), deal,
                   pivot=(1, 0, 0), bevel=0.01)
    pantry.append(kit.cylinder("pantry.knob", 0.025, 0.04, (px0 + 0.12, NORTH - 0.15, 1.05), iron, rot=(90, 0, 0)))
    leaf.rotation_euler = (0, 0, math.radians(48))
    kit.parent([pantry[-1]], leaf)
    pantry.append(leaf)
    kit.hotspot(pantry, HOTSPOTS["pantry"])
    # The right-hand end of the top shelf: the only part of it the room can see.
    candle = [kit.cylinder("candle", 0.025, 0.09, (px1 - 0.3, NORTH + 1.15, 1.665), wax, segments=12),
              kit.cylinder("candle.dish", 0.06, 0.012, (px1 - 0.3, NORTH + 1.15, 1.622), copper, segments=16)]
    flour = [kit.sphere("flour.sack", 0.22, (px1 - 0.35, NORTH + 1.15, 0.2), sacking, scale=(1.0, 0.85, 1.0)),
             kit.cylinder("flour.neck", 0.07, 0.12, (px1 - 0.35, NORTH + 1.15, 0.43), sacking, segments=10, radius2=0.04)]
    kit.hotspot(candle, HOTSPOTS["candle"])
    kit.hotspot(flour, HOTSPOTS["flour"])

    # ---------------- the table, and someone's unfinished business
    tx, ty = TABLE
    table = [kit.box("table.top", (2.1, 0.95, 0.07), (tx, ty, 0.78), deal, bevel=0.01)]
    for lx in (tx - 0.95, tx + 0.95):
        for ly in (ty - 0.38, ty + 0.38):
            table.append(kit.box(f"table.leg.{lx}.{ly}", (0.08, 0.08, 0.75), (lx, ly, 0.375), deal))
    kit.box("bench", (1.8, 0.32, 0.06), (tx, ty + 0.8, 0.45), deal, bevel=0.008)
    for lx in (tx - 0.75, tx + 0.75):
        kit.box(f"bench.leg.{lx}", (0.06, 0.28, 0.43), (lx, ty + 0.8, 0.215), deal)
    kit.box("board", (0.5, 0.32, 0.03), (tx + 0.35, ty - 0.08, 0.83), deal, bevel=0.006, rot=(0, 0, -8))
    knife = [kit.box("knife.blade", (0.2, 0.03, 0.006), (tx - 0.3, ty - 0.12, 0.822), steel, rot=(0, 0, 18)),
             kit.box("knife.handle", (0.11, 0.025, 0.02), (tx - 0.45, ty - 0.17, 0.828), trim, rot=(0, 0, 18), bevel=0.004)]
    loaf = [kit.sphere("loaf", 0.13, (tx + 0.35, ty - 0.06, 0.9), crust, scale=(1.4, 0.95, 0.7)),
            kit.box("loaf.cut", (0.012, 0.2, 0.15), (tx + 0.18, ty - 0.06, 0.9), crumb)]
    for k in range(5):
        kit.sphere(f"crumb.{k}", 0.01, (tx + 0.05 + rng.uniform(-0.15, 0.15), ty - 0.2 + rng.uniform(-0.1, 0.1), 0.82), crumb)
    kit.hotspot(knife, HOTSPOTS["knife"])
    kit.hotspot(loaf, HOTSPOTS["loaf"])
    kit.cylinder("bucket", 0.18, 0.32, (2.6, 2.9, 0.16), deal, segments=16, radius2=0.15)

    # ---------------- light: the moon at the window, a faint blue from the hall passage
    kit.world((0.01, 0.014, 0.026), 1.0)
    kit.area("moon.window", (0.62, 0.72, 1.0), 900, (wx + 0.3, NORTH + 1.4, 3.6), (-60, -10, 0), 1.6)
    kit.area("fill", (0.35, 0.42, 0.65), 110, (0, -5.5, 3.0), (60, 0, 0), 4.0, scatter=False)
    kit.area("bounce", (0.5, 0.45, 0.4), 40, (0, 0.5, CEIL - 0.3), (0, 0, 0), 4.0, scatter=False)
    kit.point("pantry.dim", (0.5, 0.55, 0.7), 6, (pc, NORTH + 0.6, 2.0), radius=0.2)
    dust = kit.box("dust", (2 * W - 0.1, NORTH - SOUTH - 0.2, CEIL - 0.1), (0, (NORTH + SOUTH) / 2, CEIL / 2), kit.volume("dust", 0.025))
    dust.pass_index = 0

    cam = kit.camera((0.0, -6.0, 1.7), (0.0, 4.0, 1.4), lens=24.0)

    return {
        "room": "kitchen",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["dust"],
        "hiddenByDefault": [o.name for o in knife + loaf + curtain + candle + flour],
        "variants": [
            {"id": "knife", "when": {"here": "knife"}, "show": [o.name for o in knife]},
            {"id": "loaf", "when": {"here": "loaf"}, "show": [o.name for o in loaf]},
            {"id": "curtain", "when": {"here": "curtain"}, "show": [o.name for o in curtain]},
            {"id": "candle", "when": {"in": ["candle", "pantry"]}, "show": [o.name for o in candle]},
            {"id": "flour", "when": {"in": ["flour", "pantry"]}, "show": [o.name for o in flour]},
            {"id": "backDoor.open", "when": {"open": "backDoor"}, "rotate": {back_leaf.name: [0, 0, -105]}},
            {"id": "servantStair", "when": {"flag": "servantStair"}, "rotate": {servant_leaf.name: [0, 0, 100]}},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-4.5, 4.5, -2.4, 2.9],
                 "blocks": [[tx - 1.15, tx + 1.15, ty - 0.6, ty + 1.05], [sx - 1.05, sx + 1.05, sy - 0.65, sy + 0.5]]},
        "points": {"start": [0.3, -0.9], "e": [-4.0, cy], "s": [bx, 2.5], "d": [4.2, 2.3]},
        "walkTo": {
            "stove": [-2.1, 2.1], "curtain": [wx - 0.4, 2.7], "pantry": [pc, 2.75], "candle": [pc, 2.75], "flour": [pc, 2.75],
            "knife": [tx - 0.3, 0.45], "loaf": [tx + 0.35, 0.45], "exit:w": [-4.45, cy],
            "backDoor": [bx, 2.85], "exit:n": [bx, 2.85], "exit:u": [4.4, 2.3],
        },
        # The servants' stair has no hotspot of its own (that would give it
        # away); it is a screen rectangle, live once the stair is known.
        "zones": [{"id": "exit:n", "fromHotspot": "backDoor"},
                  {"id": "exit:u", "rect": kit.screen_rect([servant_leaf], cam), "when": {"flag": "servantStair"}}],
        "lights": {
            "ambient": [0.10, 0.11, 0.16],
            "key": {"color": [0.62, 0.72, 1.0], "dir": [-0.2, -0.7, 0.65], "intensity": 0.45},
        },
        "music": "manor",
        "exposure": 1.1,
    }
