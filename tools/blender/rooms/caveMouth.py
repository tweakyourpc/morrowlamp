"""The Cavern of Echoes.

Composition follows the EGA painter in js/scenes.js: a vast cavern under a
jagged roof; the shore glowing faintly blue through a gap on the left; the
collapse heaped up on the right; and across the back, set into the cliff,
the twin brass gates, thirty feet of stubborn, worked with a kingdom
sinking into a hill. Before them, to the right, the statue of a woman with
her mouth open as if she died mid-word. The tunnel the player came down is
behind them, at the bottom of the picture.

When the gates open (the gatesOpen flag) they swing back into the brass
passage, and its warm light spills out.
"""
from __future__ import annotations

import random

import kit


def unseen(*_args, **_kwargs) -> None:
    """Nothing: the glowing fungus specks read as dust on screen."""

CLIFF = 11.0
GATE_W, GATE_H = 5.4, 8.2
STATUE = (4.6, 8.0)
SHORE = (-5.6, 1.4, 4.8)     # x, and the y-span of the gap in the west wall

HOTSPOTS = {
    "floor": 1,
    "gates": 2,
    "exit:w": 3,
    "exit:e": 4,
    "exit:s": 5,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(43)

    rock = kit.stone("cave.rock", (0.13, 0.125, 0.12), (0.035, 0.034, 0.033), scale=3.0, bump=0.15)
    floor_mat = kit.stone("cave.floor", (0.12, 0.115, 0.11), (0.04, 0.038, 0.036), scale=9.0, bump=0.12)
    pale = kit.stone("statue.stone", (0.42, 0.41, 0.39), (0.24, 0.235, 0.225), scale=7.0)
    brass = kit.solid("gate.brass", (0.55, 0.36, 0.14), rough=0.38, metal=1.0)
    dark_brass = kit.solid("gate.brass.dark", (0.28, 0.17, 0.06), rough=0.5, metal=1.0)
    passage = kit.solid("passage.brass", (0.5, 0.33, 0.13), rough=0.42, metal=1.0)
    fungus = kit.solid("fungus", (0.3, 0.8, 0.9), rough=0.6, emission=(0.35, 0.85, 1.0), strength=6.0)
    lake = kit.water("lake", (0.004, 0.01, 0.02))
    black = kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)

    # ---------------- floor
    # The floor stops at the shore's edge: west of it the ground steps down to the water.
    kit.hotspot([kit.box("floor", (20 - SHORE[0], 26, 0.2), ((20 + SHORE[0]) / 2, 3, -0.1), floor_mat)], HOTSPOTS["floor"])
    for k in range(30):
        x = rng.uniform(-6, 6)
        y = rng.uniform(-1, 9)
        if abs(x) < 1.6 and y > 6:
            continue
        kit.rock(f"pebble.{k}", rng.uniform(0.06, 0.2), (x, y, 0.02), rock, seed=600 + k)

    # ---------------- the cliff, and the gates set into it
    gx0, gx1 = -GATE_W / 2, GATE_W / 2
    kit.wall_with_openings("cliff", -22, 22, 18, 1.4, [(gx0 - 0.4, gx1 + 0.4, 0.0, GATE_H + 0.5)], rock, "X", CLIFF + 0.7)
    kit.rock_line("cliff.face", (-14, CLIFF - 0.3, 0.6), (-3.8, CLIFF - 0.3, 0.6), 9, 0.6, 1.2, rock, seed=61, jitter=(0.6, 0.3, 0.4))
    kit.rock_line("cliff.face.r", (3.8, CLIFF - 0.3, 0.6), (14, CLIFF - 0.3, 0.6), 9, 0.6, 1.2, rock, seed=62, jitter=(0.6, 0.3, 0.4))
    frame = []
    for x in (gx0 - 0.25, gx1 + 0.25):
        frame.append(kit.box(f"gate.pillar.{x}", (0.5, 0.7, GATE_H + 0.5), (x, CLIFF - 0.1, (GATE_H + 0.5) / 2), dark_brass, bevel=0.03))
    frame.append(kit.box("gate.lintel", (GATE_W + 1.2, 0.8, 0.7), (0, CLIFF - 0.1, GATE_H + 0.75), dark_brass, bevel=0.03))
    leaves = []
    for side in (-1, 1):
        hinge_x = gx0 if side < 0 else gx1
        leaf = kit.box(f"gate.leaf.{side}", (GATE_W / 2, 0.25, GATE_H), (hinge_x, CLIFF, GATE_H / 2), brass, pivot=(side, 0, 0), bevel=0.02)
        parts = []
        cx = hinge_x - side * GATE_W / 4
        # A kingdom sinking into a hill, depicted with relish.
        parts.append(kit.sphere(f"relief.hill.{side}", 1.0, (cx, CLIFF - 0.14, 2.6), dark_brass, scale=(1.1, 0.12, 0.55)))
        for k, (dx, h) in enumerate(((-0.6, 1.1), (-0.15, 1.6), (0.35, 1.25), (0.75, 0.9))):
            parts.append(kit.box(f"relief.tower.{side}.{k}", (0.28, 0.08, h), (cx + dx, CLIFF - 0.15, 2.9 + h / 2), dark_brass, bevel=0.01))
            parts.append(kit.cylinder(f"relief.spire.{side}.{k}", 0.17, 0.3, (cx + dx, CLIFF - 0.15, 2.9 + h + 0.15), dark_brass,
                                      rot=(90, 0, 0), segments=4, radius2=0.0))
        for k in range(10):
            for x in (hinge_x - side * 0.2, hinge_x - side * (GATE_W / 2 - 0.2)):
                parts.append(kit.sphere(f"stud.{side}.{k}.{x:.2f}", 0.05, (x, CLIFF - 0.14, 0.5 + k * 0.8), dark_brass, segments=8))
        for z in (1.4, 4.7, 7.4):
            parts.append(kit.box(f"band.{side}.{z}", (GATE_W / 2 - 0.1, 0.06, 0.16), (cx, CLIFF - 0.14, z), dark_brass))
        kit.parent(parts, leaf)
        leaves.append(leaf)
        frame += [leaf] + parts

    # ---------------- the statue, mouth open as if she died mid-word
    sx, sy = STATUE
    statue = [kit.box("statue.plinth", (1.1, 1.1, 0.55), (sx, sy, 0.275), pale, bevel=0.03),
              kit.box("statue.plate", (0.6, 0.02, 0.18), (sx, sy - 0.56, 0.3), dark_brass),
              kit.cylinder("statue.robe", 0.42, 1.7, (sx, sy, 1.4), pale, segments=20, radius2=0.22),
              kit.sphere("statue.shoulders", 0.27, (sx, sy, 2.25), pale, scale=(1.3, 0.8, 0.6)),
              kit.cylinder("statue.neck", 0.07, 0.15, (sx, sy, 2.42), pale, segments=10),
              kit.sphere("statue.head", 0.16, (sx, sy, 2.6), pale, scale=(0.9, 1.0, 1.15)),
              kit.box("statue.mouth", (0.06, 0.02, 0.07), (sx, sy - 0.155, 2.54), black)]
    for side in (-1, 1):
        statue.append(kit.cylinder(f"statue.arm.{side}", 0.065, 0.8, (sx + side * 0.36, sy - 0.12, 1.85), pale,
                                   rot=(-30, side * -20, 0), segments=10))
    frame += statue
    kit.hotspot(frame, HOTSPOTS["gates"])

    # ---------------- behind the gates: the passage of brass
    beyond = [kit.box("beyond.floor", (4.6, 8, 0.1), (0, CLIFF + 4.5, -0.05), passage),
              kit.box("beyond.l", (0.1, 8, 7), (-2.3, CLIFF + 4.5, 3.5), passage),
              kit.box("beyond.r", (0.1, 8, 7), (2.3, CLIFF + 4.5, 3.5), passage),
              kit.box("beyond.top", (4.6, 8, 0.1), (0, CLIFF + 4.5, 7.0), passage),
              kit.box("beyond.end", (4.6, 0.1, 7), (0, CLIFF + 8.4, 3.5), black)]
    for k in range(3):
        y = CLIFF + 1.6 + k * 2.4
        for x in (-2.15, 2.15):
            beyond.append(kit.box(f"beyond.rib.{k}.{x}", (0.2, 0.25, 7), (x, y, 3.5), dark_brass))
    kit.hotspot(beyond, HOTSPOTS["exit:s"])
    kit.point("beyond.warm", (1.0, 0.62, 0.28), 120, (0, CLIFF + 3.0, 4.0), radius=0.6)

    # ---------------- the cavern walls and the jagged roof
    rocks = kit.rock_line("west.wall.near", (-6.6, -6, 0.8), (-6.4, SHORE[1] - 0.5, 0.8), 6, 0.9, 1.6, rock, seed=71, jitter=(0.4, 0.4, 0.5))
    rocks += kit.rock_line("west.wall.far", (-6.6, SHORE[2] + 0.7, 0.8), (-8.0, CLIFF, 1.0), 6, 0.9, 1.6, rock, seed=72, jitter=(0.4, 0.4, 0.5))
    rocks += kit.rock_line("west.wall.hi", (-7.6, -6, 3.2), (-8.2, CLIFF, 3.5), 12, 1.2, 2.0, rock, seed=73, jitter=(0.4, 0.4, 0.8))
    rocks += kit.rock_line("east.wall.hi", (7.8, -6, 3.0), (8.4, CLIFF, 3.5), 12, 1.2, 2.0, rock, seed=74, jitter=(0.4, 0.4, 0.8))
    rocks += kit.rock_line("east.wall.far", (7.6, 4.2, 0.9), (8.4, CLIFF, 0.9), 5, 1.0, 1.6, rock, seed=75, jitter=(0.4, 0.4, 0.5))
    for row in range(4):
        y = -6 + row * 4.6
        rocks += kit.rock_line(f"roof.{row}", (-9, y, 11.8 + rng.uniform(-0.6, 0.6)), (9, y + 1, 11.8 + rng.uniform(-0.6, 0.6)), 9, 1.4, 2.4, rock,
                               seed=80 + row, jitter=(0.6, 1.2, 1.4))
    kit.box("roof.slab", (24, 22, 0.6), (0, 3, 13.4), rock)
    for k in range(10):
        x = rng.uniform(-6, 6)
        y = rng.uniform(-2, 9)
        h = rng.uniform(0.6, 1.8)
        kit.cylinder(f"stalactite.{k}", rng.uniform(0.12, 0.25), h, (x, y, 9.5 - h / 2 + rng.uniform(-0.5, 0.5)), rock, segments=8, radius2=0.0,
                     rot=(180, 0, 0))

    # ---------------- west: the gap to the shore, glowing faintly blue
    shore = [kit.box("shore.ground", (5.0, SHORE[2] - SHORE[1] + 1.0, 0.2), (SHORE[0] - 2.5, (SHORE[1] + SHORE[2]) / 2, -0.12), floor_mat),
             kit.box("shore.water", (6.0, 8.0, 0.05), (SHORE[0] - 6.5, (SHORE[1] + SHORE[2]) / 2, -0.25), lake)]
    for k in range(18):
        unseen(f"shore.fungus.{k}", rng.uniform(0.025, 0.05), (SHORE[0] - rng.uniform(0.2, 3.5), rng.uniform(SHORE[1], SHORE[2]),
                                                                                rng.uniform(0.0, 0.4)), fungus, segments=8)
    kit.hotspot(shore, HOTSPOTS["exit:w"])
    kit.point("shore.glow", (0.3, 0.6, 1.0), 160, (SHORE[0] - 3.0, (SHORE[1] + SHORE[2]) / 2, 1.2), radius=1.0)
    for k in range(40):
        side = -1 if k % 3 else 1
        unseen(f"wall.fungus.{k}", rng.uniform(0.015, 0.035), (side * rng.uniform(6.2, 7.2), rng.uniform(-3, 9), rng.uniform(0.1, 3.5)),
                   fungus, segments=6)

    # ---------------- east: the collapse, on balance a good thing
    rubble = kit.rock_line("collapse.base", (5.3, -0.5, 0.3), (7.2, 3.6, 0.4), 10, 0.5, 1.0, rock, seed=91, jitter=(0.6, 0.6, 0.3))
    rubble += kit.rock_line("collapse.top", (6.0, 0.0, 1.3), (7.6, 3.4, 1.8), 7, 0.5, 0.9, rock, seed=92, jitter=(0.5, 0.5, 0.4))
    kit.hotspot(rubble, HOTSPOTS["exit:e"])

    # ---------------- light: the cave's own cold dark
    kit.world((0.004, 0.006, 0.01), 1.0)
    kit.area("vault.fill", (0.35, 0.45, 0.65), 900, (0, 2, 9.0), (0, 0, 0), 10.0, scatter=False)
    kit.area("front.fill", (0.4, 0.45, 0.6), 160, (0, -5.5, 3.5), (70, 0, 0), 5.0, scatter=False)
    kit.point("gate.kiss", (1.0, 0.8, 0.5), 25, (0, CLIFF - 3.5, 6.5), radius=1.0)
    air = kit.box("air", (18, 20, 11), (0, 2, 5.5), kit.volume("cave.air", 0.008, color=(0.8, 0.88, 1.0)))
    air.pass_index = 0

    cam = kit.camera((0.0, -6.0, 1.7), (0.0, CLIFF, 2.8), lens=24.0)

    # The camera looks south into the halls, so west belongs on the right: the room
    # was built the other way round, and is mirrored to match its compass.
    return kit.mirror_x({
        "room": "caveMouth",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["air"],
        "hiddenByDefault": [],
        "variants": [
            {"id": "gates.open", "when": {"flag": "gatesOpen"},
             "rotate": {leaves[0].name: [0, 0, 82], leaves[1].name: [0, 0, -82]}},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-5.4, 5.0, -1.3, CLIFF - 0.9],
                 "blocks": [[sx - 0.75, sx + 0.75, sy - 0.75, sy + 0.75], [5.0, 7.6, -0.6, 3.8]]},
        "points": {"start": [-2.2, 0.0], "s": [0.0, -1.0], "n": [0.0, CLIFF - 1.6], "e": [-4.8, (SHORE[1] + SHORE[2]) / 2]},
        "walkTo": {"gates": [0.0, CLIFF - 1.0], "exit:s": [0.0, CLIFF - 1.0], "exit:w": [-5.3, (SHORE[1] + SHORE[2]) / 2],
                   "exit:e": [4.8, 1.6], "exit:n": [0.0, -1.25]},
        # North, back up the tunnel, is behind you; south is through the gates once they open.
        "zones": [{"id": "exit:n", "rect": [0, 740, 1280, 60]},
                  {"id": "exit:w", "rect": [0, 400, 150, 300]},       # the shore gap, as the EGA scene draws it
                  {"id": "exit:s", "fromHotspot": "gates", "when": {"flag": "gatesOpen"}}],
        "lights": {
            "ambient": [0.07, 0.085, 0.12],
            "key": {"color": [0.4, 0.65, 1.0], "dir": [0.8, -0.3, 0.2], "intensity": 0.3},
        },
        "music": "under",
        "exposure": 1.1,
    })
