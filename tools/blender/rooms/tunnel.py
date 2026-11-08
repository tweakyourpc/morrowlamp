"""The Grassy Tunnel, dark.

Composition follows the EGA painter in js/scenes.js: earth walls closing
in on either side, grass growing down from the ceiling, roots hanging
like dusty curtains, and ahead the tunnel dropping away into a wetter
dark with a cold glimmer at the bottom of it. The way back up to the
cellar is behind the player, at the bottom of the picture.

There is nothing here to handle, so it wakes when the player handles
anything (wake: "look").
"""
from __future__ import annotations

import random

import kit

NEAR, FAR = -7.0, 3.4    # the dug stretch, camera end to the drop
HALF_NEAR, HALF_FAR = 2.0, 1.2
CEIL = 2.6

HOTSPOTS = {
    "floor": 1,
    "exit:s": 2,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(37)

    earth = kit.stone("earth", (0.13, 0.09, 0.05), (0.04, 0.028, 0.016), scale=6.0, bump=0.15)
    clay = kit.stone("clay", (0.10, 0.07, 0.045), (0.03, 0.02, 0.012), scale=14.0, bump=0.12)
    root = kit.solid("root", (0.12, 0.08, 0.04), rough=0.9)
    grass = kit.solid("grass.pale", (0.10, 0.2, 0.05), rough=0.8)
    grass2 = kit.solid("grass.bright", (0.16, 0.3, 0.06), rough=0.8)

    # ---------------- floor, walls and roof of dug earth
    kit.hotspot([kit.box("floor", (2 * HALF_NEAR + 1, FAR - NEAR, 0.2), (0, (NEAR + FAR) / 2, -0.1), clay)], HOTSPOTS["floor"])
    for side in (-1, 1):
        kit.box(f"wall.{side}", (0.6, FAR - NEAR + 0.4, CEIL + 0.4), (side * ((HALF_NEAR + HALF_FAR) / 2 + 0.3), (NEAR + FAR) / 2, CEIL / 2),
                earth, rot=(0, 0, side * 4.0))
        kit.rock_line(f"lump.{side}", (side * HALF_NEAR, NEAR + 1, 0.4), (side * HALF_FAR, FAR - 0.2, 0.4), 14, 0.25, 0.5, earth,
                      seed=500 + side, jitter=(0.15, 0.3, 0.3))
        kit.rock_line(f"lump.hi.{side}", (side * (HALF_NEAR - 0.1), NEAR + 1.5, 1.8), (side * (HALF_FAR - 0.1), FAR - 0.4, 1.8), 10, 0.25, 0.45,
                      earth, seed=520 + side, jitter=(0.15, 0.3, 0.4))
    kit.box("roof", (2 * HALF_NEAR + 1, FAR - NEAR, 0.3), (0, (NEAR + FAR) / 2, CEIL + 0.15), earth)

    # ---------------- grass from the ceiling, green as a held grudge, and roots
    for k in range(150):
        y = rng.uniform(NEAR + 2, FAR)
        half = HALF_NEAR + (HALF_FAR - HALF_NEAR) * (y - NEAR) / (FAR - NEAR)
        x = rng.uniform(-half + 0.2, half - 0.2)
        h = rng.uniform(0.08, 0.3)
        kit.cylinder(f"grass.{k}", 0.012, h, (x, y, CEIL - h / 2), grass2 if rng.random() < 0.3 else grass, segments=4, radius2=0.0,
                     rot=(180 + rng.uniform(-15, 15), rng.uniform(-15, 15), 0))
    for k in range(26):
        y = rng.uniform(NEAR + 2.5, FAR - 0.2)
        x = rng.uniform(-1.0, 1.0)
        length = rng.uniform(0.5, 1.4)
        for j in range(3):
            seg = length / 3
            kit.cylinder(f"root.{k}.{j}", 0.012 - j * 0.003, seg, (x + rng.uniform(-0.04, 0.04) * j, y, CEIL - seg * (j + 0.5)), root,
                         rot=(rng.uniform(-14, 14), rng.uniform(-14, 14), 0), segments=5)

    # ---------------- the way on, descending into a wetter dark
    way = [kit.prism("drop.arch.l", [(-HALF_FAR - 0.6, 0), (-0.9, 0), (-0.7, 1.6), (-0.4, 2.2), (-HALF_FAR - 0.6, CEIL + 0.3)], FAR, FAR + 0.6, earth),
           kit.prism("drop.arch.r", [(0.9, 0), (HALF_FAR + 0.6, 0), (HALF_FAR + 0.6, CEIL + 0.3), (0.4, 2.2), (0.7, 1.6)], FAR, FAR + 0.6, earth),
           kit.box("drop.lintel", (1.2, 0.6, CEIL - 2.1), (0, FAR + 0.3, (CEIL + 2.2) / 2 + 0.1), earth),
           kit.box("drop.ramp", (1.9, 4.5, 0.2), (0, FAR + 2.4, -0.9), clay, rot=(-24, 0, 0)),
           kit.box("drop.l", (0.3, 4.5, 3.0), (-1.0, FAR + 2.4, 0.2), earth),
           kit.box("drop.r", (0.3, 4.5, 3.0), (1.0, FAR + 2.4, 0.2), earth),
           kit.box("drop.top", (2.2, 4.5, 0.3), (0, FAR + 2.4, 1.8), earth, rot=(-14, 0, 0)),
           kit.box("drop.end", (2.2, 0.3, 3.0), (0, FAR + 4.6, -1.6), earth)]
    kit.hotspot(way, HOTSPOTS["exit:s"])
    kit.point("deep.glimmer", (0.45, 0.75, 0.9), 6, (0, FAR + 3.6, -0.8), radius=0.3)

    # ---------------- light: a cold breath ahead, the cellar's last warmth behind
    kit.world((0.003, 0.004, 0.005), 1.0)
    kit.point("behind", (0.9, 0.7, 0.45), 18, (0, NEAR + 0.5, 2.0), radius=0.4)
    kit.area("fill", (0.3, 0.33, 0.4), 12, (0, -5.0, 2.2), (70, 0, 0), 2.0, scatter=False)
    damp = kit.box("damp", (2 * HALF_NEAR, FAR - NEAR + 4, CEIL), (0, (NEAR + FAR) / 2 + 2, CEIL / 2), kit.volume("damp", 0.03))
    damp.pass_index = 0

    cam = kit.camera((0.0, -6.0, 1.6), (0.0, 4.0, 1.05), lens=24.0)

    return {
        "room": "tunnel",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["damp"],
        "hiddenByDefault": [],
        "variants": [],
        "wake": "look",
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-1.2, 1.2, -2.2, 2.9], "blocks": []},
        "points": {"start": [0.0, -0.8], "s": [0.0, -1.9], "n": [0.0, 2.6]},
        "walkTo": {"exit:s": [0.0, 2.85], "exit:u": [0.0, -2.15]},
        # Up, back to the cellar, is behind you.
        "zones": [{"id": "exit:u", "rect": [0, 740, 1280, 60]}],
        "lights": {
            "ambient": [0.035, 0.035, 0.04],
            "key": {"color": [0.45, 0.75, 0.9], "dir": [0.0, -0.3, -1.0], "intensity": 0.15},
        },
        "music": "under",
        "exposure": 1.1,
    }
