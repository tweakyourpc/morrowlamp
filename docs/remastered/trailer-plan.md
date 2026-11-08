# The trailer: plan

Chris (2026-11-07): "we need a game preview promotional plug for the game. Use [the marketing
artwork] as inspiration. Update the hero and make the video for placement on YouTube so I can
turn this into a real indie game."

The inspiration is `marketing/morrowlamp-github-marketing.png`, the README's hero image: an
80s box-art board. Its look: night blues and old gold; a hooded traveller in a long plum cloak,
lantern held out, wading a flooded crypt towards a glowing crown; a shadow with red eyes and
tentacles rising behind; carved gold capitals for THE SUNKEN CROWN; the Morrowlamp crescent and
lantern; and its lines, "A kingdom drowned. A crown unclaimed. A legend reborn." and "Big
adventure. Small download."

## 1. The hero, restyled after the box art

`tools/blender/build_actor.py`, same rig, same actions (Idle, Walk, Reach) and the same
`LanternLight` empty, so the browser needs no change:

- a long plum cloak that flares to the ankles, a deep pointed hood, smooth shading;
- a dark leather coat and boots, a belt with a pouch, a strap across the chest;
- a brighter brass lantern.

Exported to `remastered/actors/hero.glb`; the `.blend` is reused by the trailer.

## 2. The trailer

**Format, for YouTube:** 1920 x 1080, 24 fps, H.264 High, AAC 48 kHz stereo, about 70
seconds, `+faststart`. A 1280 x 720 thumbnail.

**Everything is ours:** the rooms, the hero and the creature are Blender, the music is the
game's own score rendered offline, the fonts are open-licence (Cormorant Garamond, EB
Garamond). No narration, so no voice licences to clear; the words are title cards.

**The edit** (music cue in brackets):

| Time | Shot | Words |
|---|---|---|
| 0-4 | Black, then the Morrowlamp crescent and lantern (title) | MORROWLAMP SOFTWARE PRESENTS |
| 4-9 | The yard at night, mist, the camera drifting towards the manor (title) | A KINGDOM DROWNED. |
| 9-13 | The hero crosses the yard with the lantern (title) | |
| 13-19 | The hall in EGA, waking into the rendered room (title) | EVERY ROOM BEGINS IN EGA... / ...AND WAKES AS YOU PLAY |
| 19-23 | The cellar by lantern light (tension) | |
| 23-27 | The cave mouth: the brass gates and the statue (tension) | A CROWN UNCLAIMED. |
| 27-31 | The lake shore, glowing fungi, the boat (tension) | |
| 31-35 | The Umbra rises from the dark water, red eyes (combat) | |
| 35-38 | The spectral sentinel (combat) | |
| 38-41 | The mirror hall (tension) | |
| 41-47 | The throne room: the crown on its cushion, the camera pushing in (lullaby) | A LEGEND REBORN. |
| 47-53 | The title: THE SUNKEN CROWN, REMASTERED, over the crown (lullaby) | |
| 53-63 | Features over the study, the glasshouse and the grandmother's room (lullaby) | 21 HAND-BUILT ROOMS / FOUR NARRATORS / CLASSIC EGA OR MODERN / PLAYS IN YOUR BROWSER |
| 63-70 | End card (lullaby) | BIG ADVENTURE. SMALL DOWNLOAD. / PLAY FREE: morrowlamp.netlify.app |

The epilogue is not shown: it is the ending.

## 3. How it is built

As the epilogue film, one unattended `srjob` job on legion:

| Piece | File |
|---|---|
| Shots: room, camera move, length, hero walk, creature | `tools/blender/trailer/shots.py` |
| Dressing: the hero in the room, the Umbra, extra mist and light | `tools/blender/trailer/dress.py` |
| Build a shot's .blend (locally) | `tools/blender/build_trailer.py` |
| Render frames (legion) | `tools/blender/render_epilogue.py` (shared: it renders any shot .blend) |
| Music cues and EGA frames, rendered in headless Chromium (legion's Playwright) | `tools/trailer/capture.mjs` and `tools/trailer/capture.html` |
| Title cards, HTML rendered to transparent PNGs | `tools/trailer/cards.html` |
| The whole job: shots, cues, cards, cut, mix, thumbnail | `tools/blender/trailer_job.sh` |
| Send, preview, status, fetch | `tools/blender/send_trailer.sh` |

Output: `out/trailer/sunken-crown-trailer.mp4` and `thumbnail.jpg`, fetched to
`marketing/trailer/`.

## 4. The trailer's own score (2026-11-07)

Chris wanted a real soundtrack under the trailer, to hear first before it replaces the mix of the
game's cues. `tools/trailer/score.js` writes one cue to the edit. Its sections change where the film
changes, and its hits land on the title cards. Each time comes from `cut.py`'s EDIT and is listed in
`MARKS` there.

| Time | Picture | Score |
|---|---|---|
| 0 to 11.4 s | Logo, the yard, the hero | The title theme, slow and distant, over a low swell; a boom on "A kingdom drowned" |
| 11.4 to 13.2 s | The EGA hall | The theme carries on in the 1987 chip voice, then breaks up as the picture pixelates |
| 13.2 to 28.2 s | Hall, cellar, cave, lake | A dark descent bed with drips, climbing on a riser |
| 28.2 to 37.1 s | The Umbra, the sentinel, the mirrors | An impact, an Eb braam (the flat second), war drums quickening into a roll that stops dead at the black |
| 38.1 to 42.7 s | The throne | A boom on "A legend reborn", two braams, a riser |
| 42.7 to 55.7 s | The title and the feature lines | The game's own title theme in full over a D braam; a soft drum on each feature line |
| 55.7 s to the end | The end card | A sting, then a held D minor close that rings out |

The beds are new tracks in `js/music.js` notation, played by the remaster's score engine. The
trailer instruments (braam, impact, riser, drum, chip, glitch) are synthesized in the same
OfflineAudioContext. It renders on legion with `tools/blender/send_trailer.sh --score`, which writes
`marketing/trailer/trailer-score.m4a` and `sunken-crown-trailer-scored-preview.mp4`. It uses no
shots and no re-cut. Once Chris approves the score, the film is cut with it in place of the cue mix
(`SCORE=1` in `trailer_job.sh`, which passes `--score` to `cut.py`).

## 5. The grandmother's voiceover (2026-11-07)

Chris asked for a voiceover in the grandmother's voice, over the same score. She speaks to the
grandchild who stopped believing her at nine, and it should feel like coming home to the games of
childhood without ever saying so. The script, with each line's start time, is
`tools/trailer/voiceover.json`. `tools/trailer/voiceover.py` voices it as the game casts her (the
`grandmother` writer in `tools/voice/voices.json`: ljspeech through her filter), with several takes
and Whisper picking the clearest. A line that would overlap the one before is pushed later and
reported. `cut.py --voiceover-preview` ducks the score under her voice with a sidechain and brings the
mix to -14 LUFS. `tools/blender/send_trailer.sh --voiceover` runs all of it on legion and fetches
`marketing/trailer/trailer-score-voiceover.m4a` and `sunken-crown-trailer-voiceover-preview.mp4`.
Whisper transcribed the finished mix word for word.
