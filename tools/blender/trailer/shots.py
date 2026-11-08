"""The trailer's Blender shots (docs/remastered/trailer-plan.md).

Each shot is a room as the game has it, at night, with one camera move
relative to the room's own camera: `push` metres forward along its view,
`drift` sideways, `rise` up. `hero` walks the restyled hero between two of
the room's own points (names from its builder's `points` or `walkTo`, or
[x, y] in Blender metres), its lantern `lantern` watts; `umbra` raises the shadow at a point;
`exposure` overrides the film's 0.8. The cut
(tools/trailer/cut.py) decides where each shot sits in the edit.
"""
from __future__ import annotations

FPS = 24
SIZE = (1920, 1080)
SAMPLES = 64

SHOTS = [
    {"id": "t01-yard", "room": "yard", "frames": 120, "push": 3.0, "rise": -0.3},
    {"id": "t02-yard-hero", "room": "yard", "frames": 96, "push": 1.0, "drift": 0.6, "rise": -0.5,
     "hero": ("start", "exit:n")},
    {"id": "t03-hall", "room": "hall", "frames": 120, "push": 1.4, "hero": ("start", "cabinet")},
    # The cellar is lit by the hero's lantern alone, as in the game; on film it wants more of it.
    {"id": "t04-cellar", "room": "cellar", "frames": 96, "push": 1.0, "hero": ("start", "shelves"),
     "exposure": 2.2, "lantern": 260},
    {"id": "t05-cave", "room": "caveMouth", "frames": 96, "push": 2.2, "rise": 0.4},
    {"id": "t06-lake", "room": "lakeShore", "frames": 96, "push": 1.5, "hero": ("start", "boat")},
    {"id": "t07-umbra", "room": "lakeShore", "frames": 96, "push": 0.8, "drift": -0.8, "umbra": "creature"},
    {"id": "t08-sentinel", "room": "guardroom", "frames": 72, "push": 1.5},
    {"id": "t09-mirrors", "room": "mirrorHall", "frames": 72, "push": 1.5, "drift": 0.5},
    {"id": "t10-throne", "room": "throne", "frames": 144, "push": 2.6, "hero": ("start", "crown"), "umbra_eyes": (0.0, 3.6, 3.9)},
    {"id": "t11-throne-title", "room": "throne", "frames": 144, "push": 0.6, "rise": 0.3, "umbra_eyes": (0.0, 3.6, 3.9)},
    {"id": "t12-study", "room": "study", "frames": 60, "push": 0.8, "drift": 0.4},
    {"id": "t13-glasshouse", "room": "glasshouse", "frames": 60, "push": 0.9},
    {"id": "t14-grandmother", "room": "grandmotherRoom", "frames": 60, "push": 0.8, "drift": -0.4},
    {"id": "t15-garden", "room": "kitchenGarden", "frames": 60, "push": 1.0, "rise": 0.3},
    # The YouTube thumbnail: one still, the box art's composition. The hero, from
    # behind, wades towards the crown; the shadow's eyes behind the throne.
    {"id": "thumb", "room": "throne", "frames": 1, "size": (1280, 720), "samples": 256, "push": 1.6, "rise": -0.2,
     "hero": ([-0.75, 0.2], "crown"), "umbra_eyes": (0.0, 3.6, 3.5)},
]


def by_id(shot_id: str) -> dict:
    for s in SHOTS:
        if s["id"] == shot_id:
            return s
    raise KeyError(shot_id)
