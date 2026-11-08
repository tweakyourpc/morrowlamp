"""The Guardroom of the Sunken King, dark.

Composition follows the EGA painter in js/scenes.js: an arms rack on the
left, the south door in the middle of the far wall with a torch either
side, the spectral sentinel planted in front of it, and on the right the
steel vault door, stamped, bolted and rusted. The passage of brass is
behind the player, at the bottom of the picture.

Three things change here, each an overlay: the sentinel gives up the
doorway and dances (the guardDancing flag), which is also when the vault
key he was standing on shows; and the vault door swings open.
"""
from __future__ import annotations

import math
import random

import kit

W = 5.0
NORTH = 3.8
SOUTH = -7.5
CEIL = 3.8
DOOR = (-0.75, 0.75, 0.0, 2.7)     # the south door, in the far wall
VAULT = (2.3, 4.0, 0.0, 2.5)       # the vault door's opening, in the far wall
SENTINEL = (0.0, 3.0)
KEY = (0.85, 2.75)

HOTSPOTS = {
    "floor": 1,
    "sentinel": 2,
    "vaultDoor": 3,
    "vaultKey": 4,
    "exit:s": 5,
    "exit:w": 6,
}


def sentinel_figure(prefix: str, x: float, y: float, mat, blade, dance: bool) -> list:
    """Tarnished plate with no one inside. Dancing, he lifts a knee and his arms."""
    parts = []
    lean = 12 if dance else 0
    for side in (-1, 1):
        knee = 35 if dance and side > 0 else 0
        parts.append(kit.cylinder(f"{prefix}.leg.{side}", 0.11, 0.95, (x + side * 0.16, y, 0.5 + (0.12 if knee else 0)), mat,
                                  rot=(-knee, 0, 0), segments=12, radius2=0.09))
        parts.append(kit.box(f"{prefix}.boot.{side}", (0.18, 0.3, 0.1), (x + side * 0.16, y - 0.06 - (0.25 if knee else 0), 0.05 + (0.3 if knee else 0)), mat,
                             bevel=0.02))
    parts.append(kit.cylinder(f"{prefix}.body", 0.3, 0.8, (x, y, 1.38), mat, rot=(0, lean, 0), segments=16, radius2=0.36))
    parts.append(kit.box(f"{prefix}.skirt", (0.62, 0.36, 0.22), (x, y, 0.98), mat, bevel=0.04))
    for side in (-1, 1):
        parts.append(kit.sphere(f"{prefix}.pauldron.{side}", 0.17, (x + side * 0.42, y, 1.78), mat, scale=(1.2, 1.0, 0.8)))
        up = dance
        parts.append(kit.cylinder(f"{prefix}.arm.{side}", 0.075, 0.7, (x + side * (0.55 if up else 0.48), y, 2.15 if up else 1.4), mat,
                                  rot=(0, side * (150 if up else 8), 0), segments=10))
    parts.append(kit.cylinder(f"{prefix}.helm", 0.17, 0.34, (x, y, 2.08), mat, rot=(0, lean, 0), segments=16, radius2=0.14))
    parts.append(kit.box(f"{prefix}.visor", (0.22, 0.02, 0.04), (x, y - 0.17, 2.1), kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)))
    parts.append(kit.cylinder(f"{prefix}.plume", 0.03, 0.3, (x, y, 2.38), mat, segments=8, radius2=0.0))
    if not dance:
        parts.append(kit.cylinder(f"{prefix}.halberd", 0.025, 2.6, (x + 0.62, y - 0.05, 1.3), blade, segments=8))
        parts.append(kit.box(f"{prefix}.halberd.head", (0.28, 0.02, 0.32), (x + 0.7, y - 0.05, 2.45), blade, bevel=0.01))
    return parts


def build() -> dict:
    kit.reset_scene()
    rng = random.Random(53)

    wall = kit.ashlar("guard.wall", (0.12, 0.115, 0.11), (0.05, 0.048, 0.046), mortar=(0.02, 0.02, 0.02), course=0.36, block=0.6)
    flags = kit.planks("guard.flags", (0.13, 0.125, 0.12), (0.07, 0.068, 0.065), gap=(0.015, 0.015, 0.015), width=0.6, length=0.8)
    plaster = kit.stone("guard.vault", (0.08, 0.08, 0.085), (0.03, 0.03, 0.032), scale=3.0)
    oak = kit.wood("cellar.wood", (0.15, 0.09, 0.045), (0.06, 0.035, 0.018), grain=10.0, rough=0.8)
    iron = kit.solid("iron", (0.05, 0.05, 0.055), rough=0.55, metal=0.85)
    steel = kit.stone("vault.steel", (0.32, 0.31, 0.3), (0.16, 0.08, 0.04), scale=6.0)
    blade = kit.solid("blade", (0.4, 0.4, 0.42), rough=0.35, metal=0.9)
    ghost = kit.solid("spectral", (0.2, 0.42, 0.5), rough=0.25, transmission=0.95, emission=(0.18, 0.55, 0.65), strength=0.45)
    brass = kit.solid("brass", (0.62, 0.43, 0.17), rough=0.32, metal=1.0)
    stamp = kit.solid("stamp", (0.05, 0.05, 0.05), rough=0.6)
    black = kit.solid("void", (0.0, 0.0, 0.0), rough=1.0)

    # ---------------- shell
    kit.hotspot([kit.box("floor", (2 * W, NORTH - SOUTH, 0.1), (0, (NORTH + SOUTH) / 2, -0.05), flags)], HOTSPOTS["floor"])
    kit.box("ceiling", (2 * W, NORTH - SOUTH, 0.2), (0, (NORTH + SOUTH) / 2, CEIL + 0.1), plaster)
    for i in range(5):
        kit.box(f"arch.{i}", (2 * W, 0.4, 0.3), (0, -5.5 + i * 2.2, CEIL - 0.15), wall)
    kit.wall_with_openings("north", -W, W, CEIL, 0.4, [DOOR, VAULT], wall, "X", NORTH + 0.2)
    kit.box("south.wall", (2 * W, 0.2, CEIL), (0, SOUTH, CEIL / 2), wall)
    for x in (-W, W):
        kit.box(f"side.{x}", (0.4, NORTH - SOUTH, CEIL), (x + (0.2 if x > 0 else -0.2), (NORTH + SOUTH) / 2, CEIL / 2), wall)

    # ---------------- the south door, and the stair beyond it the sentinel is so serious about
    dc = (DOOR[0] + DOOR[1]) / 2
    beyond = [kit.box("south.beyond.floor", (1.6, 3.0, 0.1), (dc, NORTH + 1.7, -0.05), flags),
              kit.box("south.beyond.l", (0.1, 3.0, 3.0), (DOOR[0] - 0.05, NORTH + 1.7, 1.5), wall),
              kit.box("south.beyond.r", (0.1, 3.0, 3.0), (DOOR[1] + 0.05, NORTH + 1.7, 1.5), wall),
              kit.box("south.beyond.top", (1.6, 3.0, 0.1), (dc, NORTH + 1.7, 2.75), wall),
              kit.box("south.beyond.end", (1.6, 0.1, 3.0), (dc, NORTH + 3.2, 1.5), black)]
    for x in (DOOR[0] - 0.12, DOOR[1] + 0.12):
        beyond.append(kit.box(f"south.jamb.{x}", (0.26, 0.5, DOOR[3] + 0.1), (x, NORTH, (DOOR[3] + 0.1) / 2), wall, bevel=0.02))
    beyond.append(kit.box("south.lintel", (DOOR[1] - DOOR[0] + 0.6, 0.5, 0.36), (dc, NORTH, DOOR[3] + 0.18), wall, bevel=0.02))
    kit.hotspot(beyond, HOTSPOTS["exit:s"])
    kit.point("south.blue", (0.45, 0.75, 0.9), 8, (dc, NORTH + 2.4, 1.6), radius=0.3)
    kit.torch("torch.l", (DOOR[0] - 0.7, NORTH - 0.06, 2.0), facing=(0.0, -1.0, 0.0), watts=45)
    kit.torch("torch.r", (DOOR[1] + 0.7, NORTH - 0.06, 2.0), facing=(0.0, -1.0, 0.0), watts=45)

    # ---------------- the sentinel, standing, and the same sentinel dancing
    standing = sentinel_figure("sentinel", SENTINEL[0], SENTINEL[1], ghost, blade, dance=False)
    dancing = sentinel_figure("sentinel.dance", -1.7, 2.5, ghost, blade, dance=True)
    kit.hotspot(standing + dancing, HOTSPOTS["sentinel"])
    key = [kit.torus("vaultKey.bow", 0.04, 0.01, (KEY[0], KEY[1], 0.012), iron, segments=20, sides=6),
           kit.box("vaultKey.shank", (0.16, 0.02, 0.016), (KEY[0] + 0.12, KEY[1], 0.012), iron),
           kit.box("vaultKey.bit", (0.03, 0.05, 0.016), (KEY[0] + 0.19, KEY[1] - 0.02, 0.012), iron)]
    kit.hotspot(key, HOTSPOTS["vaultKey"])

    # ---------------- the vault door: stamped, bolted, rusted
    vx0, vx1, _, vz1 = VAULT
    vc = (vx0 + vx1) / 2
    leaf = kit.box("vault.leaf", (vx1 - vx0 - 0.04, 0.16, vz1 - 0.04), (vx0 + 0.02, NORTH - 0.02, vz1 / 2), steel, pivot=(-1, 0, 0), bevel=0.02)
    parts = [kit.text("vault.word", "VAULT", 0.22, (vc, NORTH - 0.105, 1.95), stamp, rot=(90, 0, 0), depth=0.004),
             kit.text("vault.warning", "DO NOT DISTURB", 0.07, (vc, NORTH - 0.105, 1.75), stamp, rot=(90, 0, 0), depth=0.003),
             kit.torus("vault.wheel", 0.24, 0.025, (vc, NORTH - 0.14, 1.05), iron, segments=32, sides=8),
             kit.cylinder("vault.hub", 0.05, 0.08, (vc, NORTH - 0.13, 1.05), iron, rot=(90, 0, 0), segments=12)]
    parts[2].rotation_euler = (math.radians(90), 0, 0)
    for k in range(4):
        parts.append(kit.box(f"vault.spoke.{k}", (0.46, 0.02, 0.025), (vc, NORTH - 0.13, 1.05), iron, rot=(0, k * 45, 0)))
    for k in range(9):
        z = 0.2 + k * 0.27
        for x in (vx0 + 0.12, vx1 - 0.12):
            parts.append(kit.sphere(f"vault.bolt.{k}.{x}", 0.03, (x, NORTH - 0.11, z), iron, segments=8))
    for z in (0.35, 2.15):
        parts.append(kit.box(f"vault.hinge.{z}", (0.12, 0.08, 0.2), (vx0 + 0.04, NORTH - 0.12, z), iron))
    kit.parent(parts, leaf)
    kit.hotspot([leaf] + parts, HOTSPOTS["vaultDoor"])
    for x in (vx0 - 0.1, vx1 + 0.1):
        kit.box(f"vault.jamb.{x}", (0.2, 0.5, vz1 + 0.15), (x, NORTH, (vz1 + 0.15) / 2), iron, bevel=0.01)
    kit.box("vault.lintel", (vx1 - vx0 + 0.4, 0.5, 0.2), (vc, NORTH, vz1 + 0.12), iron)
    inside = [kit.box("vault.in.floor", (vx1 - vx0, 3.0, 0.1), (vc, NORTH + 1.6, -0.05), flags),
              kit.box("vault.in.back", (vx1 - vx0, 0.1, 2.6), (vc, NORTH + 3.1, 1.3), wall),
              kit.box("vault.in.l", (0.1, 3.0, 2.6), (vx0 - 0.05, NORTH + 1.6, 1.3), wall),
              kit.box("vault.in.r", (0.1, 3.0, 2.6), (vx1 + 0.05, NORTH + 1.6, 1.3), wall),
              kit.box("vault.in.top", (vx1 - vx0, 3.0, 0.1), (vc, NORTH + 1.6, 2.55), wall)]
    kit.hotspot(inside, HOTSPOTS["exit:w"])
    kit.point("vault.green", (0.4, 0.9, 0.5), 5, (vc, NORTH + 2.4, 1.2), radius=0.2)

    # ---------------- the arms rack, because a guardroom should look like one
    ax = -3.6
    kit.box("rack.rail", (1.6, 0.12, 0.1), (ax, NORTH - 0.15, 2.1), oak)
    kit.box("rack.foot", (1.6, 0.3, 0.1), (ax, NORTH - 0.25, 0.1), oak)
    for k in range(4):
        x = ax - 0.55 + k * 0.36
        kit.cylinder(f"rack.spear.{k}", 0.02, 2.4, (x, NORTH - 0.22, 1.25), oak, rot=(rng.uniform(-3, 3), rng.uniform(-3, 3), 0), segments=6)
        kit.cylinder(f"rack.tip.{k}", 0.04, 0.22, (x, NORTH - 0.22, 2.55), blade, segments=6, radius2=0.0)
    kit.cylinder("shield", 0.36, 0.05, (ax + 1.4, NORTH - 0.08, 1.4), brass, rot=(90, 0, 0), segments=24)
    kit.box("bench", (1.4, 0.4, 0.45), (-3.9, 1.0, 0.225), oak, bevel=0.01)

    # ---------------- light: two torches and the ghost's own glow
    kit.world((0.003, 0.003, 0.004), 1.0)
    kit.point("ghost.glow", (0.4, 0.75, 0.85), 7, (SENTINEL[0], SENTINEL[1] - 0.6, 1.6), radius=0.5)
    kit.area("fill", (0.35, 0.38, 0.5), 25, (0, -5.0, 3.0), (70, 0, 0), 3.0, scatter=False)
    air = kit.box("air", (2 * W, NORTH - SOUTH, CEIL), (0, (NORTH + SOUTH) / 2, CEIL / 2), kit.volume("guard.air", 0.015))
    air.pass_index = 0

    cam = kit.camera((0.0, -6.0, 1.7), (0.0, 4.0, 1.4), lens=24.0)

    return {
        "room": "guardroom",
        "camera": cam.name,
        "hotspots": HOTSPOTS,
        "utilityHidden": ["air"],
        "hiddenByDefault": [o.name for o in dancing + key],
        "variants": [
            {"id": "sentinel.dance", "when": {"flag": "guardDancing"},
             "hide": [o.name for o in standing], "show": [o.name for o in dancing]},
            {"id": "vaultKey", "base": "sentinel.dance", "when": {"flag": "guardDancing", "here": "vaultKey"},
             "show": [o.name for o in key]},
            {"id": "vault.open", "when": {"open": "vaultDoor"}, "rotate": {leaf.name: [0, 0, 80]}},
        ],
        # Blender coordinates; render_room.py converts them for three.js.
        "walk": {"area": [-4.5, 4.5, -2.3, 2.9],
                 "blocks": [[SENTINEL[0] - 0.55, SENTINEL[0] + 0.55, SENTINEL[1] - 0.45, SENTINEL[1] + 0.45], [-4.7, -3.1, 0.7, 1.3]]},
        "points": {"start": [-2.2, -0.5], "s": [0.0, -1.9], "n": [-1.0, 2.1], "e": [vc - 0.2, 2.1]},
        "walkTo": {"sentinel": [-0.9, 2.2], "vaultKey": [KEY[0], 2.2], "vaultDoor": [vc - 0.2, 2.2],
                   "exit:s": [0.0, 2.45], "exit:w": [vc - 0.2, 2.4], "exit:n": [0.0, -2.2]},
        "zones": [{"id": "exit:n", "rect": [0, 740, 1280, 60]},
                  {"id": "exit:w", "fromHotspot": "vaultDoor", "when": {"open": "vaultDoor"}}],
        "lights": {
            "ambient": [0.05, 0.05, 0.06],
            "key": {"color": [1.0, 0.6, 0.3], "dir": [0.0, -0.4, 0.9], "intensity": 0.3},
        },
        "music": "throne",
        "exposure": 1.1,
    }
