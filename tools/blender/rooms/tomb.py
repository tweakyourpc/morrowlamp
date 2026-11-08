"""The Tomb of the Sunken King, dark.

Composition follows the EGA painter in js/scenes.js: a round chamber hewn
from living stone, ribbed up into a low dome; in the middle the marble
sarcophagus with the king carved on its lid, considerably less tired than
his skeleton; and on the right the stair back up to the throne room.

Open the sarcophagus and the lid is shoved aside, carving and all, to show
the bones tidily arranged inside; the ring, while it is still in there, is
an overlay on that.
"""
from __future__ import annotations

import math
import random

import kit

CX, CY = 0.0, 1.4      # centre of the chamber
R = 5.6
DOME = 0.78            # the dome's height as a fraction of its radius
SARC = (0.0, 1.7)

HOTSPOTS = {
    "floor": 1,
    "sarcophagus": 2,
    "ring": 3,
    "exit:u": 4,
}


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(61)

    living = kit.stone("living.stone", (0.11, 0.105, 0.1), (0.035, 0.033, 0.03), scale=2.5, bump=0.15)
    floor_mat = kit.stone("tomb.floor", (0.1, 0.095, 0.09), (0.035, 0.033, 0.03), scale=10.0, bump=0.12)
    marble = kit.stone("marble", (0.62, 0.6, 0.56), (0.42, 0.41, 0.39), scale=5.0)
    bone = kit.solid("bone", (0.55, 0.5, 0.4), rough=0.6)
    gold = kit.solid("crown.gold", (0.8, 0.58, 0.18), rough=0.22, metal=1.0)
    gem = kit.solid("signet.stone", (0.05, 0.08, 0.3), rough=0.05)
    black = kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)

    # ---------------- the chamber: a floor and a dome of living stone
    kit.hotspot([kit.cylinder("floor", R + 0.1, 0.1, (CX, CY, -0.05), floor_mat, segments=64)], HOTSPOTS["floor"])
    kit.sphere("dome", R, (CX, CY, 0.0), living, scale=(1.0, 1.0, DOME), segments=48)
    for k in range(16):
        a = k / 16 * math.tau
        for j in range(5):
            t = j / 5
            elev = t * math.pi / 2 * 0.92
            r = R * math.cos(elev) - 0.1
            z = R * DOME * math.sin(elev)
            kit.box(f"rib.{k}.{j}", (0.22, 0.2, R * 0.33), (CX + math.cos(a) * r, CY + math.sin(a) * r, z + 0.4), living,
                    rot=(0, 90 - math.degrees(elev) * 0.6 - 90, math.degrees(a)))

    # ---------------- the sarcophagus, the king on its lid, and what is inside
    sx, sy = SARC
    sarc = [kit.box("sarc.base", (2.5, 1.15, 0.9), (sx, sy, 0.45), marble, bevel=0.03),
            kit.box("sarc.plinth", (2.8, 1.4, 0.16), (sx, sy, 0.08), marble, bevel=0.02),
            kit.box("sarc.hollow", (2.2, 0.85, 0.08), (sx, sy, 0.86), black)]
    for k in range(5):
        sarc.append(kit.cylinder(f"bones.{k}", 0.025, rng.uniform(0.3, 0.5), (sx - 0.7 + k * 0.32, sy + rng.uniform(-0.2, 0.2), 0.9), bone,
                                 rot=(90, 0, rng.uniform(-40, 40)), segments=8))
    sarc.append(kit.sphere("bones.skull", 0.11, (sx - 1.0, sy, 0.95), bone))
    lid = kit.box("sarc.lid", (2.65, 1.3, 0.16), (sx - 1.325, sy, 0.98), marble, pivot=(-1, 0, 0), bevel=0.03)
    effigy = [kit.sphere("effigy.head", 0.13, (sx - 0.95, sy, 1.15), marble, scale=(1.0, 0.9, 0.7)),
              kit.box("effigy.body", (1.5, 0.48, 0.16), (sx + 0.05, sy, 1.14), marble, bevel=0.06),
              kit.box("effigy.hands", (0.14, 0.2, 0.08), (sx - 0.4, sy, 1.25), marble, bevel=0.03)]
    for k in range(3):
        effigy.append(kit.box(f"effigy.crown.{k}", (0.04, 0.05, 0.08), (sx - 1.06, sy - 0.06 + k * 0.06, 1.25), marble))
    kit.parent(effigy, lid)
    sarc += [lid] + effigy
    kit.hotspot(sarc, HOTSPOTS["sarcophagus"])
    # Front right of the hollow, the corner the shoved lid uncovers: standing
    # on the near rim, facing the camera, so the wall and lid do not hide it.
    band = kit.torus("ring.band", 0.055, 0.013, (sx + 0.75, sy - 0.5, 0.968), gold, segments=24, sides=8)
    band.rotation_euler = (math.radians(90), 0, 0)
    ring = [band, kit.sphere("ring.seal", 0.026, (sx + 0.75, sy - 0.515, 1.03), gem, segments=10)]
    kit.hotspot(ring, HOTSPOTS["ring"])
    kit.point("sarc.inner", (0.7, 0.8, 1.0), 2, (sx + 0.4, sy - 0.3, 1.3), radius=0.1)

    # ---------------- the stair back up, on the right
    stair = []
    for k in range(7):
        z = 0.2 + k * 0.22
        stair.append(kit.box(f"stair.{k}", (1.3, 0.36, z), (3.3, 0.9 + k * 0.34, z / 2), living, bevel=0.01))
    stair.append(kit.box("stair.arch", (1.4, 0.4, 2.2), (3.3, 3.45, 2.5), black))
    stair.append(kit.box("stair.lintel", (1.8, 0.5, 0.3), (3.3, 3.3, 3.7), living, bevel=0.02))
    kit.hotspot(stair, HOTSPOTS["exit:u"])
    kit.point("stair.above", (1.0, 0.65, 0.35), 12, (3.3, 3.6, 3.2), radius=0.3)

    # ---------------- light: very, very patient
    kit.world((0.002, 0.002, 0.003), 1.0)
    kit.area("fill", (0.35, 0.4, 0.55), 18, (0, -3.6, 2.6), (70, 0, 0), 2.0, scatter=False)
    kit.point("dome.cold", (0.45, 0.55, 0.8), 25, (CX, CY, 3.6), radius=0.6)

    cam = kit.camera((0.0, -3.7, 1.7), (0.0, 5.0, 1.15), lens=20.0)

    return {
        "room": "tomb",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": [],
        "hiddenByDefault": [o.name for o in ring],
        "variants": [
            {"id": "sarc.open", "when": {"open": "sarcophagus"}, "rotate": {lid.name: [0, 0, 28]}},
            {"id": "ring", "base": "sarc.open", "when": {"open": "sarcophagus", "in": ["ring", "sarcophagus"]},
             "show": [o.name for o in ring]},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-3.0, 3.0, -1.4, 3.3],
                 "blocks": [[sx - 1.55, sx + 1.55, sy - 0.85, sy + 0.85], [2.55, 4.0, 0.7, 3.6]]},
        "points": {"start": [1.4, -0.6], "d": [2.1, 0.5]},
        "walkTo": {"sarcophagus": [sx - 0.3, sy - 1.05], "ring": [sx + 0.75, sy - 1.05], "exit:u": [2.3, 0.5]},
        "zones": [],
        "lights": {
            "ambient": [0.035, 0.04, 0.05],
            "key": {"color": [0.45, 0.55, 0.8], "dir": [0.0, -1.0, 0.0], "intensity": 0.2},
        },
        "music": "throne",
        "exposure": 1.1,
    }
