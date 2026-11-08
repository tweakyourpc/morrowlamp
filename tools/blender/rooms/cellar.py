"""The Cellar under the manor, dark.

Composition follows the EGA painter in js/scenes.js: the ladder coming
down through the trapdoor from the hall, shelves of jars on the left, the
wine rack on the right, the shovel leaning by the far wall, and the crack
in the middle of it breathing a cold draft. Dig, and the crack becomes a
tunnel mouth: the plug of stone and earth comes away and the way south
opens, roots and all.

It is a dark room. What light there is falls down the ladder from the
hall and seeps out of the crack; the lantern does the rest.
"""
from __future__ import annotations

import math
import random

import kit

W = 4.6
NORTH = 3.4
SOUTH = -7.5
CEIL = 2.7
CRACK = (0.0, 1.4, 0.0, 1.9)      # the opening the tunnel will be, in the north wall
SLIT = (0.62, 0.78, 0.2, 1.6)     # the crack itself, until then
LADDER = (-1.3, 1.0)

HOTSPOTS = {
    "floor": 1,
    "shelves": 2,
    "wineRack": 3,
    "crack": 4,
    "shovel": 5,
    "oilJar": 6,
    "pitchPot": 7,
    "emptyBottle": 8,
    "exit:u": 9,
    "exit:s": 10,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(31)

    rubble = kit.stone("cellar.rubble", (0.16, 0.15, 0.13), (0.05, 0.048, 0.045), scale=5.0)
    wall = kit.ashlar("cellar.wall", (0.15, 0.14, 0.125), (0.07, 0.065, 0.06), mortar=(0.03, 0.03, 0.028), course=0.3, block=0.5)
    dirt = kit.stone("dirt", (0.11, 0.085, 0.06), (0.04, 0.03, 0.02), scale=12.0)
    earth = kit.stone("earth", (0.13, 0.09, 0.05), (0.04, 0.028, 0.016), scale=6.0, bump=0.15)
    oak = kit.wood("cellar.wood", (0.15, 0.09, 0.045), (0.06, 0.035, 0.018), grain=10.0, rough=0.8)
    joist = kit.wood("trim", (0.22, 0.12, 0.06), (0.10, 0.05, 0.025), grain=9.0)
    iron = kit.solid("iron", (0.05, 0.05, 0.055), rough=0.55, metal=0.85)
    bottle = kit.solid("bottle.green", (0.02, 0.07, 0.03), rough=0.15, metal=0.0)
    empty = kit.solid("bottle.empty", (0.08, 0.16, 0.1), rough=0.1)
    jar = kit.solid("jar.green", (0.06, 0.14, 0.07), rough=0.2)
    oil = kit.solid("jar.oil", (0.45, 0.25, 0.05), rough=0.15)
    pitch = kit.solid("pitch", (0.02, 0.018, 0.015), rough=0.08)
    clay = kit.solid("clay.pot", (0.42, 0.17, 0.08), rough=0.75)
    root = kit.solid("root", (0.12, 0.08, 0.04), rough=0.9)
    black = kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)

    # ---------------- shell, low and close
    kit.hotspot([kit.box("floor", (2 * W, NORTH - SOUTH, 0.1), (0, (NORTH + SOUTH) / 2, -0.05), dirt)], HOTSPOTS["floor"])
    lx, ly = LADDER
    hole = (lx - 0.5, lx + 0.5, ly - 0.5, ly + 0.5)
    for k, (x0, x1, y0, y1) in enumerate(((-W, hole[0], SOUTH, NORTH), (hole[1], W, SOUTH, NORTH),
                                          (hole[0], hole[1], SOUTH, hole[2]), (hole[0], hole[1], hole[3], NORTH))):
        kit.box(f"ceiling.{k}", (x1 - x0, y1 - y0, 0.2), ((x0 + x1) / 2, (y0 + y1) / 2, CEIL + 0.1), oak)
    for i in range(7):
        y = SOUTH + 0.8 + i * 1.6
        kit.box(f"joist.{i}", (2 * W, 0.2, 0.24), (0, y, CEIL - 0.12), joist)
    kit.wall_with_openings("north", -W, W, CEIL, 0.4, [CRACK], wall, "X", NORTH + 0.2)
    kit.box("south.wall", (2 * W, 0.2, CEIL), (0, SOUTH, CEIL / 2), rubble)
    for x in (-W, W):
        kit.box(f"side.{x}", (0.4, NORTH - SOUTH, CEIL), (x + (0.2 if x > 0 else -0.2), (NORTH + SOUTH) / 2, CEIL / 2), rubble)

    # ---------------- the ladder up to the hall, and the hall's light down it
    shaft = [kit.box(f"hatch.shaft.{k}", s, p, wall) for k, (s, p) in enumerate((
        ((1.0, 0.1, 1.6), (lx, hole[3] + 0.05, CEIL + 0.8)), ((1.0, 0.1, 1.6), (lx, hole[2] - 0.05, CEIL + 0.8)),
        ((0.1, 1.0, 1.6), (hole[0] - 0.05, ly, CEIL + 0.8)), ((0.1, 1.0, 1.6), (hole[1] + 0.05, ly, CEIL + 0.8))))]
    ladder = shaft[:]
    for side in (-0.32, 0.32):
        ladder.append(kit.box(f"ladder.rail.{side}", (0.06, 0.06, CEIL + 0.9), (lx + side, ly + 0.2, (CEIL + 0.9) / 2 - 0.05), oak, rot=(-8, 0, 0)))
    for i in range(8):
        z = 0.3 + i * 0.36
        ladder.append(kit.box(f"ladder.rung.{i}", (0.64, 0.04, 0.04), (lx, ly + 0.2 + (z - 1.4) * math.tan(math.radians(8)), z), oak))
    kit.hotspot(ladder, HOTSPOTS["exit:u"])
    kit.area("hall.above", (1.0, 0.75, 0.45), 30, (lx, ly, CEIL + 1.5), (0, 0, 0), 0.9, scatter=False)

    # ---------------- the crack, and the plug of wall that will come away
    cx0, cx1, cz0, cz1 = CRACK
    sx0, sx1, sz0, sz1 = SLIT
    plug = [kit.box("plug.l", (sx0 - cx0, 0.4, cz1 - cz0), ((cx0 + sx0) / 2, NORTH + 0.2, (cz0 + cz1) / 2), wall),
            kit.box("plug.r", (cx1 - sx1, 0.4, cz1 - cz0), ((sx1 + cx1) / 2, NORTH + 0.2, (cz0 + cz1) / 2), wall),
            kit.box("plug.top", (sx1 - sx0, 0.4, cz1 - sz1), ((sx0 + sx1) / 2, NORTH + 0.2, (sz1 + cz1) / 2), wall),
            kit.box("plug.bottom", (sx1 - sx0, 0.4, sz0 - cz0), ((sx0 + sx1) / 2, NORTH + 0.2, (cz0 + sz0) / 2), wall)]
    for k in range(7):
        z = sz0 + 0.1 + k * 0.2
        side = -1 if k % 2 else 1
        plug.append(kit.rock(f"plug.chip.{k}", rng.uniform(0.05, 0.09), ((sx0 + sx1) / 2 + side * 0.09, NORTH - 0.02, z), rubble, seed=400 + k))
    plug.append(kit.box("crack.void", (0.5, 0.1, cz1 - cz0), ((sx0 + sx1) / 2, NORTH + 0.5, (cz0 + cz1) / 2), black))
    kit.hotspot(plug, HOTSPOTS["crack"])
    kit.point("crack.draft", (0.55, 0.8, 0.9), 3, ((sx0 + sx1) / 2, NORTH + 0.38, 0.9), radius=0.05)

    # Behind it all along: the tunnel the shovel will find.
    tc = (cx0 + cx1) / 2
    tunnel = [kit.box("tunnel.floor", (1.6, 4.0, 0.1), (tc, NORTH + 2.3, -0.2), earth, rot=(-6, 0, 0)),
              kit.box("tunnel.l", (0.2, 4.0, 2.2), (cx0 - 0.1, NORTH + 2.3, 0.9), earth),
              kit.box("tunnel.r", (0.2, 4.0, 2.2), (cx1 + 0.1, NORTH + 2.3, 0.9), earth),
              kit.box("tunnel.top", (1.6, 4.0, 0.2), (tc, NORTH + 2.3, cz1 + 0.05), earth),
              kit.box("tunnel.end", (1.6, 0.1, 2.2), (tc, NORTH + 4.2, 0.6), black)]
    for k in range(10):
        tunnel.append(kit.cylinder(f"tunnel.root.{k}", 0.008, rng.uniform(0.3, 0.8), (tc + rng.uniform(-0.6, 0.6), NORTH + 0.6 + k * 0.3, cz1 - 0.25),
                                   root, rot=(rng.uniform(-15, 15), rng.uniform(-15, 15), 0), segments=5))
    tunnel += kit.rock_line("tunnel.lip", (cx0 - 0.1, NORTH - 0.05, 0.1), (cx0 - 0.1, NORTH - 0.05, cz1), 5, 0.08, 0.16, rubble, seed=41)
    tunnel += kit.rock_line("tunnel.lip.r", (cx1 + 0.1, NORTH - 0.05, 0.1), (cx1 + 0.1, NORTH - 0.05, cz1), 5, 0.08, 0.16, rubble, seed=43)
    kit.hotspot(tunnel, HOTSPOTS["exit:s"])
    spoil = [kit.sphere("spoil", 0.7, (tc - 0.2, NORTH - 0.7, 0.0), earth, scale=(1.0, 0.7, 0.25))]
    spoil += kit.rock_line("spoil.stones", (tc - 0.8, NORTH - 0.6, 0.06), (tc + 0.6, NORTH - 1.0, 0.05), 6, 0.06, 0.14, rubble, seed=47)
    kit.hotspot(spoil, HOTSPOTS["floor"])

    # ---------------- shelves of jars that forgot their contents' names
    shx0, shx1, shy = -4.3, -2.3, NORTH - 0.25
    shelves = []
    for x in (shx0, shx1):
        shelves.append(kit.box(f"shelves.upright.{x}", (0.06, 0.4, 2.2), (x, shy, 1.1), oak))
    for k, z in enumerate((0.45, 1.1, 1.75)):
        shelves.append(kit.box(f"shelves.board.{k}", (shx1 - shx0 + 0.1, 0.4, 0.04), ((shx0 + shx1) / 2, shy, z), oak, bevel=0.004))
        for j in range(7):
            if (k == 1 and j in (1, 3)) or rng.random() < 0.15:
                continue
            h = rng.uniform(0.16, 0.26)
            shelves.append(kit.cylinder(f"jar.{k}.{j}", rng.uniform(0.06, 0.08), h, (shx0 + 0.18 + j * 0.27, shy + rng.uniform(-0.05, 0.08), z + 0.02 + h / 2),
                                        jar, segments=12))
            shelves.append(kit.cylinder(f"jar.lid.{k}.{j}", 0.07, 0.02, (shx0 + 0.18 + j * 0.27, shy, z + 0.03 + h), iron, segments=12))
    kit.hotspot(shelves, HOTSPOTS["shelves"])
    oil_jar = [kit.cylinder("oilJar", 0.08, 0.22, (shx0 + 0.45, shy - 0.08, 1.23), oil, segments=14),
               kit.cylinder("oilJar.lid", 0.085, 0.03, (shx0 + 0.45, shy - 0.08, 1.355), oak, segments=14)]
    # A clay pot, as the game says, so it reads against the dark shelf;
    # the pitch is the glossy black inside it.
    pitch_pot = [kit.cylinder("pitchPot", 0.1, 0.2, (shx0 + 1.0, shy - 0.08, 1.22), clay, segments=20, radius2=0.13),
                 kit.cylinder("pitchPot.pitch", 0.122, 0.01, (shx0 + 1.0, shy - 0.08, 1.31), pitch, segments=20),
                 kit.torus("pitchPot.rim", 0.13, 0.014, (shx0 + 1.0, shy - 0.08, 1.32), clay, segments=24, sides=6)]
    kit.hotspot(oil_jar, HOTSPOTS["oilJar"])
    kit.hotspot(pitch_pot, HOTSPOTS["pitchPot"])

    # ---------------- the wine rack, monuments to a party long over
    wx0, wx1, wy = 2.3, 4.3, NORTH - 0.25
    rack = []
    for k in range(5):
        x = wx0 + k * (wx1 - wx0) / 4
        rack.append(kit.box(f"rack.upright.{k}", (0.05, 0.4, 1.9), (x, wy, 0.95), oak))
    for k in range(5):
        z = 0.1 + k * 0.45
        rack.append(kit.box(f"rack.board.{k}", (wx1 - wx0 + 0.05, 0.4, 0.04), ((wx0 + wx1) / 2, wy, z), oak))
    for r in range(4):
        for c in range(4):
            if (r, c) == (1, 3):
                continue                 # the empty one lies here
            x = wx0 + (c + 0.5) * (wx1 - wx0) / 4
            z = 0.1 + r * 0.45 + 0.12
            for j in (-0.1, 0.1):
                if rng.random() < 0.2:
                    continue
                rack.append(kit.cylinder(f"bottle.{r}.{c}.{j}", 0.04, 0.3, (x + j, wy + 0.02, z), bottle, rot=(90, 0, 0), segments=10))
    kit.hotspot(rack, HOTSPOTS["wineRack"])
    ex, ez = wx0 + 3.5 * (wx1 - wx0) / 4, 0.1 + 0.45 + 0.12
    empty_bottle = [kit.cylinder("emptyBottle", 0.04, 0.3, (ex, wy - 0.06, ez), empty, rot=(90, 0, 0), segments=10),
                    kit.cylinder("emptyBottle.neck", 0.015, 0.08, (ex, wy - 0.25, ez), empty, rot=(90, 0, 0), segments=8)]
    kit.hotspot(empty_bottle, HOTSPOTS["emptyBottle"])

    # ---------------- the shovel, the honest tool of dishonest people
    shovel = [kit.cylinder("shovel.handle", 0.022, 1.25, (-0.62, NORTH - 0.32, 0.78), oak, rot=(12, 0, 0), segments=8),
              kit.box("shovel.grip", (0.16, 0.03, 0.03), (-0.62, NORTH - 0.19, 1.39), oak),
              kit.box("shovel.blade", (0.24, 0.02, 0.3), (-0.62, NORTH - 0.44, 0.15), iron, rot=(12, 0, 0), bevel=0.01)]
    kit.hotspot(shovel, HOTSPOTS["shovel"])

    kit.cylinder("barrel", 0.36, 0.85, (3.4, 0.9, 0.425), oak, segments=20, radius2=0.33)
    kit.torus("barrel.hoop", 0.37, 0.012, (3.4, 0.9, 0.62), iron)

    # ---------------- light: next to none
    kit.world((0.003, 0.004, 0.006), 1.0)
    kit.area("fill", (0.3, 0.36, 0.5), 30, (0, -5.5, 2.4), (65, 0, 0), 4.0, scatter=False)
    damp = kit.box("damp", (2 * W - 0.1, NORTH - SOUTH - 0.2, CEIL - 0.1), (0, (NORTH + SOUTH) / 2, CEIL / 2), kit.volume("damp", 0.02))
    damp.pass_index = 0

    cam = kit.camera((0.0, -6.0, 1.6), (0.0, 4.0, 1.15), lens=24.0)

    return {
        "room": "cellar",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["damp"],
        "hiddenByDefault": [o.name for o in tunnel + spoil + oil_jar + pitch_pot + empty_bottle + shovel],
        "variants": [
            {"id": "tunnel", "when": {"flag": "tunnelDug"}, "hide": [o.name for o in plug],
             "show": [o.name for o in tunnel + spoil]},
            {"id": "shovel", "when": {"here": "shovel"}, "show": [o.name for o in shovel]},
            {"id": "oilJar", "when": {"in": ["oilJar", "shelves"]}, "show": [o.name for o in oil_jar]},
            {"id": "pitchPot", "when": {"in": ["pitchPot", "shelves"]}, "show": [o.name for o in pitch_pot]},
            {"id": "emptyBottle", "when": {"in": ["emptyBottle", "wineRack"]}, "show": [o.name for o in empty_bottle]},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-4.0, 4.0, -2.3, 2.6],
                 "blocks": [[lx - 0.45, lx + 0.45, ly - 0.05, ly + 0.5], [2.9, 3.9, 0.4, 1.4]]},
        "points": {"start": [0.0, -0.6], "d": [lx, ly - 0.6], "u": [tc, 2.3]},
        "walkTo": {
            # Beside the shelf, not in front of it, so the hero does not hide the jar and the pot.
            "shelves": [-3.3, 2.3], "oilJar": [-2.0, 2.3], "pitchPot": [-2.0, 2.3],
            "wineRack": [3.3, 2.3], "emptyBottle": [3.3, 2.3],
            "crack": [tc, 2.3], "shovel": [-0.6, 2.3], "exit:s": [tc, 2.45], "exit:u": [lx, ly - 0.6],
        },
        "zones": [],
        "lights": {
            "ambient": [0.04, 0.045, 0.06],
            "key": {"color": [1.0, 0.75, 0.45], "dir": [0.0, -1.0, 0.0], "intensity": 0.2},
        },
        "music": "under",
        "exposure": 1.1,
    }
