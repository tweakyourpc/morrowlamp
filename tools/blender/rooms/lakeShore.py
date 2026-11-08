"""The Shore of the Sunken Lake.

Composition follows the EGA painter in js/scenes.js: an underground lake,
black as ink, glowing faintly blue with the fungi on its roof and along its
shore; across the water a small island with a stone plinth, and something
small and golden on top of it; the rotted rowboat lying half on the shore
on the right, holed the size of a fist; and the way back to the cavern
through the rocks at the right-hand edge.

Patch the boat (the boatPatched flag) and the hole is stopped with curtain
and pitch; the boat is then the way west.
"""
from __future__ import annotations

import math
import random

import kit


def unseen(*_args, **_kwargs) -> None:
    """Nothing: the glowing fungus specks read as dust on screen."""

SHORE = 0.8        # the waterline
ISLET = (-7.5, 14.0)       # well to the west: you row west to reach it
BOAT = (2.4, 1.0)

HOTSPOTS = {
    "floor": 1,
    "boat": 2,
    "plinth": 3,
    "exit:e": 4,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(79)

    rock = kit.stone("cave.rock", (0.13, 0.125, 0.12), (0.035, 0.034, 0.033), scale=3.0, bump=0.15)
    shore = kit.stone("shore.stone", (0.06, 0.06, 0.065), (0.016, 0.017, 0.02), scale=12.0, bump=0.12)
    lake = kit.water("lake", (0.004, 0.01, 0.02))
    fungus = kit.solid("fungus", (0.3, 0.8, 0.9), rough=0.6, emission=(0.35, 0.85, 1.0), strength=6.0)
    grass = kit.stone("islet.grass", (0.06, 0.12, 0.05), (0.02, 0.04, 0.015), scale=10.0)
    plinth_stone = kit.stone("pedestal.stone", (0.3, 0.29, 0.27), (0.15, 0.145, 0.14), scale=6.0)
    gold = kit.solid("crown.gold", (0.8, 0.58, 0.18), rough=0.22, metal=1.0)
    hull = kit.wood("boat.rotten", (0.16, 0.11, 0.07), (0.06, 0.04, 0.025), grain=18.0, rough=0.85)
    cloth = kit.stone("curtain", (0.30, 0.07, 0.22), (0.12, 0.03, 0.09), scale=11.0)
    pitch = kit.solid("pitch", (0.02, 0.018, 0.015), rough=0.3)
    black = kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)

    # ---------------- the shore and the water
    ground = [kit.box("shore", (30, 12, 0.3), (0, SHORE - 6.0, -0.15), shore)]
    ground += kit.rock_line("waterline", (-9, SHORE + 0.1, -0.05), (9, SHORE + 0.1, -0.05), 22, 0.12, 0.3, shore, seed=81, jitter=(0.3, 0.2, 0.05))
    kit.hotspot(ground, HOTSPOTS["floor"])
    kit.box("lake", (60, 40, 0.05), (0, SHORE + 20, -0.18), lake)

    # ---------------- the far island, and something small and golden on it
    ix, iy = ISLET
    far = [kit.sphere("far.islet", 2.4, (ix, iy, -0.4), grass, scale=(1.0, 0.6, 0.25)),
           kit.box("far.plinth", (0.35, 0.35, 0.9), (ix, iy, 0.45), plinth_stone),
           kit.box("far.plinth.top", (0.5, 0.5, 0.08), (ix, iy, 0.94), plinth_stone),
           kit.cylinder("far.chalice", 0.07, 0.16, (ix, iy, 1.06), gold, segments=12, radius2=0.1)]
    kit.hotspot(far, HOTSPOTS["plinth"])
    kit.point("far.gleam", (1.0, 0.8, 0.4), 30, (ix + 0.3, iy - 0.6, 1.5), radius=0.2)

    # ---------------- the cavern: a high roof lost in the dark
    # The roof is far above, so it reads as open darkness, not a ceiling of
    # boulders; the back wall rises to meet it, so there is no edge to see past.
    kit.box("roof", (70, 60, 0.5), (0, 20, 9.5), rock)
    kit.box("back.wall", (70, 0.5, 12), (0, 40, 4.0), rock)
    kit.rock_line("far.wall", (-22, 33, 0.8), (22, 33, 0.8), 16, 2.0, 3.2, rock, seed=95, jitter=(1.0, 2.0, 1.2))
    kit.rock_line("west.wall", (-11, 4, 0.6), (-13, 20, 1.0), 7, 0.9, 1.6, rock, seed=96, jitter=(0.8, 0.5, 0.8))
    for k in range(14):
        x, y = rng.uniform(-12, 12), rng.uniform(4, 30)
        d = rng.uniform(0.6, 1.8)        # hangs from the roof's underside, point down
        kit.cylinder(f"stalactite.{k}", 0.01, d, (x, y, 9.25 - d / 2), rock, segments=7, radius2=rng.uniform(0.12, 0.3))
    # Glowing fungus used to be scattered here; on screen it read as dust, so it is gone.
    # unseen() still draws the same random numbers, so every rock stays where it was.
    for k in range(140):
        x, y = rng.uniform(-16, 16), rng.uniform(2, 34)
        unseen(f"roof.fungus.{k}", rng.uniform(0.04, 0.09), (x, y, 9.2 + rng.uniform(-0.05, 0.05)), fungus, segments=6)
    # On the shore the fungi keep to the damp: the waterline and the stones.
    for k in range(26):
        x, y = rng.uniform(-6, 6), SHORE + rng.uniform(-0.5, 0.15)
        unseen(f"shore.fungus.{k}", rng.uniform(0.012, 0.03), (x, y, 0.02), fungus, segments=6, scale=(1, 1, 0.6))
    for k in range(18):
        r = rng.uniform(0.05, 0.16)
        kit.rock(f"shingle.{k}", r, (rng.uniform(-5, 4), rng.uniform(-2.4, SHORE - 0.3), r * 0.3), shore, seed=300 + k)

    # ---------------- the rotted rowboat, resigned
    bx, by = BOAT
    hub = kit.empty("boat", (bx, by, 0.0))
    parts = [kit.box("boat.keel", (2.2, 0.5, 0.06), (bx, by, 0.05), hull)]
    for side in (-1, 1):
        parts.append(kit.box(f"boat.side.{side}", (2.2, 0.05, 0.42), (bx, by + side * 0.38, 0.24), hull, rot=(side * -22, 0, 0)))
    parts.append(kit.box("boat.transom", (0.05, 0.8, 0.4), (bx + 1.1, by, 0.24), hull))
    parts.append(kit.prism("boat.bow", [(-0.3, 0.0), (0.0, 0.0), (0.0, 0.45)], by - 0.4, by + 0.4, hull))
    parts[-1].location.x = bx - 1.1
    parts.append(kit.box("boat.thwart", (0.2, 0.75, 0.04), (bx + 0.2, by, 0.32), hull))
    parts.append(kit.cylinder("boat.hole", 0.08, 0.03, (bx + 0.25, by - 0.43, 0.2), black, rot=(70, 0, 0), segments=12))
    kit.parent(parts, hub)
    hub.rotation_euler = (math.radians(4), math.radians(-6), math.radians(18))
    patch = [kit.cylinder("patch.cloth", 0.11, 0.02, (bx + 0.25, by - 0.45, 0.2), cloth, rot=(70, 0, 0), segments=12),
             kit.sphere("patch.pitch", 0.07, (bx + 0.25, by - 0.47, 0.2), pitch, scale=(1.2, 0.4, 0.9))]
    kit.parent(patch, hub)
    kit.hotspot(parts + patch, HOTSPOTS["boat"])

    # ---------------- the way back to the cavern, through the rocks on the right
    way = kit.rock_line("east.rocks", (4.8, -2.5, 1.0), (5.5, SHORE, 1.2), 5, 0.8, 1.2, rock, seed=97, jitter=(0.3, 0.3, 0.5))
    way += [kit.box("east.gap.floor", (3.0, 2.0, 0.1), (6.5, -0.4, -0.05), shore),
            kit.box("east.gap.dark", (0.1, 2.0, 2.4), (8.0, -0.4, 1.2), black)]
    kit.hotspot(way, HOTSPOTS["exit:e"])

    # ---------------- light: the fungi, the water's faint blue, a gleam of gold
    kit.world((0.002, 0.004, 0.008), 1.0)
    kit.area("roof.glow", (0.3, 0.6, 0.9), 420, (0, 10, 6.8), (0, 0, 0), 20.0, scatter=False)
    kit.area("front.fill", (0.3, 0.45, 0.65), 35, (0, -5.5, 3.0), (70, 0, 0), 4.0, scatter=False)
    kit.point("shore.glow", (0.3, 0.7, 1.0), 25, (-2.0, -0.5, 0.4), radius=0.6)
    air = kit.box("air", (30, 34, 8), (0, 12, 4), kit.volume("lake.air", 0.006, color=(0.75, 0.9, 1.0)))
    air.pass_index = 0

    cam = kit.camera((0.0, -6.0, 1.7), (0.0, 8.0, 1.25), lens=24.0)

    return {
        "room": "lakeShore",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["air"],
        "hiddenByDefault": [o.name for o in patch],
        "variants": [
            {"id": "boat.patched", "when": {"flag": "boatPatched"}, "show": [o.name for o in patch]},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-4.4, 4.5, -2.2, SHORE - 0.2], "blocks": [[bx - 1.3, bx + 1.3, by - 0.7, by + 0.7]]},
        # creature: where the lurker unfolds itself from under the shore stones.
        "points": {"start": [-1.5, -0.8], "w": [4.0, -0.4], "e": [bx - 1.2, -0.3], "creature": [-1.3, 0.25]},
        "walkTo": {"boat": [bx - 1.2, -0.3], "plinth": [-1.8, 0.2], "exit:e": [4.4, -0.4], "exit:w": [bx - 1.2, -0.3]},
        # West, across the water, is the boat once it floats.
        "zones": [{"id": "exit:w", "fromHotspot": "boat", "when": {"flag": "boatPatched"}}],
        "lights": {
            "ambient": [0.06, 0.09, 0.13],
            "key": {"color": [0.35, 0.7, 1.0], "dir": [0.0, -1.0, 0.0], "intensity": 0.35},
        },
        "music": "lake",
        "exposure": 1.1,
    }
