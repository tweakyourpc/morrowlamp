"""The epilogue film's shots: Ashcombe restored, and let (story bible 6c).

One entry per shot, in the order the player first meets the house. Each
names a room builder, the restoration that dresses it for the morning after,
and one slow camera move: the camera goes from `cam` to `cam_to` while it
looks from `look` to `look_to`. Blender coordinates, metres.

The film is assembled in this order by epilogue_job.sh; docs/remastered/
epilogue-plan.md has the reasoning.
"""
from __future__ import annotations

FPS = 24
SECONDS = 6            # each shot
DISSOLVE = 18          # frames of crossfade between shots
SIZE = (1280, 800)     # the stage's own size
SAMPLES = 64
LENS = 24.0

SHOTS = [
    {"id": "01-yard", "room": "yard",
     "cam": (0.0, -6.0, 1.7), "look": (0.0, 8.0, 3.1), "cam_to": (0.0, -1.5, 1.65), "look_to": (0.0, 8.2, 2.4)},
    {"id": "02-porch", "room": "porch",
     "cam": (0.0, -5.5, 1.7), "look": (0.0, 4.0, 1.25), "cam_to": (0.0, -1.0, 1.6), "look_to": (-0.1, 2.55, 1.3)},
    {"id": "03-hall", "room": "hall",
     "cam": (-1.2, -5.0, 1.7), "look": (-3.8, 2.6, 1.8), "cam_to": (0.6, -3.0, 1.6), "look_to": (0.0, 3.6, 1.4)},
    {"id": "04-study", "room": "study",
     "cam": (-1.5, -5.5, 1.7), "look": (-2.5, 3.8, 1.6), "cam_to": (1.0, -4.0, 1.6), "look_to": (0.4, 3.8, 1.4)},
    {"id": "05-kitchen", "room": "kitchen",
     "cam": (-2.5, -5.5, 1.7), "look": (-1.1, 3.8, 1.3), "cam_to": (1.5, -3.0, 1.6), "look_to": (0.5, 3.8, 1.2)},
    {"id": "06-grandmother", "room": "grandmotherRoom",
     "cam": (0.8, -5.2, 1.5), "look": (-1.0, 1.0, 1.3), "cam_to": (-0.6, -3.2, 1.4), "look_to": (-2.7, -1.5, 0.8)},   # the bed, front left
    {"id": "07-garden", "room": "kitchenGarden",
     "cam": (0.0, -6.0, 1.2), "look": (0.0, 7.0, 2.5), "cam_to": (0.5, -2.5, 2.6), "look_to": (0.0, 7.0, 4.6)},
    {"id": "08-glasshouse", "room": "glasshouse",
     "cam": (0.0, -5.4, 1.5), "look": (0.0, 3.6, 1.1), "cam_to": (0.15, 0.6, 1.35), "look_to": (0.2, 3.05, 1.05)},
]


def frames() -> int:
    return FPS * SECONDS


def by_id(shot_id: str) -> dict:
    for s in SHOTS:
        if s["id"] == shot_id:
            return s
    raise KeyError(shot_id)
