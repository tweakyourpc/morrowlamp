# The epilogue film: plan

Story bible section 6c, Chris's idea (2026-11-07): when the adventure is complete, Ashcombe is
fixed up, every room made modern, and the manor let as a holiday home, shown as a rendered
cinema sequence. Chris chose a rendered video and asked for the whole job to run on legion
with no AI once it is sent.

## What the player sees

1. The win, as now. Then the screen fades to the film.
2. **The film,** about 50 seconds, 1280 x 800 (the stage's own size), 24 frames a second,
   silent. The lullaby plays over it live, from the game's own score engine, so no audio is
   rendered. Captions are drawn by the page over the film, so their words can change without
   a re-render.
3. **The listing,** an HTML card after the film: the manor on a made-up booking site
   ("StayAway"), a review, and the sentinel as host. Then the usual end card.

The text edition gets the same epilogue as words at the end of the winning text.

## The shots

Eight rooms, in the order the player first meets the house, six seconds each, joined by
three-quarter-second dissolves. Every shot is the room's own builder, restored and in daylight,
with one slow camera move.

| # | Room | Restored | Camera |
|---|---|---|---|
| 1 | yard | Morning sun, mist gone, the well capped, flowers along the house | Slow push towards the front door |
| 2 | porch | A new doormat that says WELCOME, all of it; potted plants by the door | Push towards the door |
| 3 | hall | The stair gap rebuilt, rubble gone, the six regalia lit in the cabinet, the chandelier lit, a rug | Pan from the stairs to the cabinet |
| 4 | study | Lamps lit, a rug and an armchair, plants | Slow drift along the shelves |
| 5 | kitchen | A modern island under pendant lights, stools, the back door open on the garden | Dolly past the table |
| 6 | grandmotherRoom | The roof hole glazed as a skylight, the best bedroom: new quilt, rug, lamp | Push towards the bed under the skylight |
| 7 | kitchenGarden | Roof mended, lawn and flowers, back door open | Rise and push towards the house |
| 8 | glasshouse | Every pane back, plants in every pot, the phonograph on the bench | Push towards the phonograph |

## How it is built

| Piece | File | Runs |
|---|---|---|
| Shot list | `tools/blender/epilogue/shots.py` | Imported by the builder |
| Restoration and daylight | `tools/blender/epilogue/restore.py` | Imported by the builder |
| Build one shot's .blend | `tools/blender/build_epilogue.py` | Locally, in seconds (no rendering) |
| Render a shot's frames | `tools/blender/render_epilogue.py` | On legion, Blender 5.3, OptiX and OIDN |
| The whole job | `tools/blender/epilogue_job.sh` | On legion, inside `srjob`: every shot, resumable, then ffmpeg |
| Send, preview and fetch | `tools/blender/send_epilogue.sh` | Locally |

`send_epilogue.sh` builds the eight .blend files, syncs them to legion, and starts one `srjob`
job. The job renders every frame of every shot (skipping frames already on disk, so a rerun
resumes), cuts each shot to a clip, joins them with dissolves, fades in and out, and writes
`out/epilogue/epilogue.mp4` (H.264, `+faststart`) and a poster frame. `send_epilogue.sh --fetch`
copies them into `remastered/epilogue/`. `--preview` renders one frame of each shot instead, to
check the look before the long job.

Render settings: Cycles on the GPU, 64 samples with adaptive sampling and OIDN, AgX view,
persistent data on (scene kept between frames).

## Budget

The film is fetched only when the game is won, so it is not part of the first visit or the
five-floppy game. It has its own budget in `test/remastered-manifest.js`.

## Not in this pass

- Endings that change the film (Heir, Thief, Keeper): one film for now.
- The underground rooms: the epilogue is the house.
