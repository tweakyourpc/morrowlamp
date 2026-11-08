# The Sunken Crown, Remastered (Blender art, deeper story, voiced)

## Context

The Sunken Crown is the flagship cartridge of the Morrowlamp Workshop
(`~/CODING/EXPERIMENT/MORROWLAMP GAME WORKSHOP`). Every pixel is EGA-painted in code and
every sound is synthesized, which is the whole point of Morrowlamp. Chris wants a modern
version of the same game with Blender-made, high-end graphics, a richer story and voiced
speech, while it stays small, light and playable in a browser.

Decisions made:
- **Graphics:** pre-rendered Blender backgrounds with depth and normal passes, plus a small
  rigged 3D hero in three.js, and a live lantern-relighting shader.
- **Story:** deepen the existing skeleton (Ashcombe, grandmother, the well, six regalia,
  18 rooms, the puzzle chain) with real characters, dialogue and an emotional arc.
- **Voice:** every line pre-voiced offline (Piper/Kokoro), shipped as low-bitrate Opus,
  lazy-loaded per room.
- **Home:** a new *remastered shell* on the existing Morrowlamp Machine. The Machine,
  validator, prover and retro shells stay as they are, so the game remains provably winnable
  and the EGA build keeps working as "one game, several presentations".

## Architecture

```
cartridge (sunken-crown.js + strings table)  ── unchanged Machine (js/morrowlamp/*)
          │                                           │ runtime bus events:
          │                                           │ room, examine, take, open,
          ▼                                           │ encounter, death, win, sound, music
remastered/manifest.json ──► js/remastered/shell.js ◄─┘
  per room: passes, camera,       ├─ compositor.js   (WebGL2: albedo+normal+depth → lit frame)
  hotspot mask, walk mask,        ├─ hero.js         (three.js glTF actor, depth-tested vs room)
  voice index                     ├─ voice.js        (text-hash → Opus line, per-room prefetch)
                                  └─ ui.js           (verb bar, inventory, dialogue, combat panel)
```

- `remastered.html` loads the **same runtime module list** as `index.html`/`text.html`
  (`js/workshop/bundle.js` is the list to reuse), then `js/remastered/*`. No gameplay
  logic in the shell, the same rule `test/one-machine.js` enforces today.
- Commands go through `rt.command()` / the same verb→command mapping as
  `js/morrowlamp/shell-canvas.js` (`commandFor`, `computeHotspots`). Reuse that logic and
  don't fork it. Pull the hit-test and verb mapping into a shared helper if needed.
- No build step stays true: vendor `three.module.min.js` (pinned version) under
  `js/vendor/` as an ES module.
- Not single-file. This is an opt-in **asset tier**: a static folder you can serve. A
  service worker caches it for offline play. The README philosophy section gets a short
  note that the remaster is the deliberate exception and the retro builds stay asset-free.

## Art pipeline (Blender → browser)

1. **One `.blend` per room** under `art/blender/rooms/<roomId>.blend`, linking a shared
   `art/blender/library.blend` (materials, props, regalia, lantern). The fixed camera
   matches the room's composition in `js/scenes.js` so the hotspot layout stays familiar.
2. **`tools/blender/render_room.py`** (headless, `blender -b <file> -P ...`). Renders at
   1280×720:
   - `albedo`, `normal` (view space), `depth` (16-bit, linear), `ambient` (moonlight/fill
     only, no lantern), `emission` (fires, sunstone, glowing runes).
   - `ids`: object-index pass. Each hotspot object gets a pass index matching its cartridge
     object id. The script vectorizes it into hotspot polygons, so hotspots come from the
     art and aren't hand-typed.
   - `walk`: a floor mask from a "walkable" collection.
   - `camera.json`: fov, world matrix, near/far, so the three.js camera matches exactly.
3. Render on legion (`ssh showrig-worker`, Blender 5.2). Local is Blender 4.0.2, so the
   script must stick to API that works in both, or target 5.2 only. Use
   `mod.properties.inputs.<id>.value` for Geometry Nodes inputs (5.2 API).
4. **`tools/blender/pack_room.sh`**: ffmpeg/avifenc encodes passes to AVIF (WebP
   fallback), with ids and walk masks as tiny lossless PNGs. Budget: **≤ 350 KB per room
   across all passes**.
5. **Hero and creatures:** one low-poly rigged hero (~5k tris, 3 class variants by
   material/accessory: Delver, Scholar, Prowler) with idle/walk/reach/talk/hit clips;
   Umbra, Cave Lurker and Sentinel as small glTF with meshopt compression. Exported by
   `tools/blender/export_actor.py`. Budget **≤ 1.2 MB** for all actors.
6. **Lantern shader (compositor.js):** deferred 2D lighting. A point light at the hero's
   hand reconstructs world position from depth and shades the albedo with the normal map,
   added to the ambient and emission passes. It's driven by Machine state: `darkness`
   (ambient level), `light.fuel` (radius, and flicker when the warnings fire), the sunstone
   (steady, cool light). This turns the existing darkness/oil mechanic into the visual
   centerpiece. If WebGL2 is missing, it falls back to a static `ambient+lantern` still.

## Story (deepen the skeleton)

- **Story bible first:** `docs/remastered/story-bible.md` covers cast, arc, tone and
  room-by-room beats, for Chris to approve before any lines are written. Starting cast:
  the grandmother, heard only through wax-cylinder recordings found around the manor
  (voiced collectibles that carry the backstory); the Echo, a character rather than a
  puzzle prop; the Mirror; the Sunken King's ghost; the Sentinel, given a motive.
- **Use the documented seam:** move the Sunken Crown's narrative into the cartridge
  `strings` table (`@s:` keys, with `js/cartridges/sir-crumbly.js` as the reference
  pattern). Writing then can't break puzzles, and `test/strings-contract.js` guards it.
- New dialogue goes through `talk` rules and `talk`-kind encounter actions that already
  exist in the dialect. No Machine changes are expected. If one is needed, it's a deliberate
  Machine change with its own test (README: "a gap in the Machine worth fixing on purpose").
- Up to ~3 new rooms if the bible needs them. Each new room gets a semantic scene
  (`js/morrowlamp/scene.js`) so the retro shells still render it.
- Update the cartridge `walkthrough` and `test/winning-route.js` together;
  `node tools/morrow.js prove` must pass.

## Voice pipeline

- **`tools/morrow.js strings <cartridge> --json`**: a new subcommand that dumps every
  resolved narrative line with its key, speaker (room narration → narrator; talk rules →
  character) and a normalized-text hash.
- **`tools/voice/build_voices.py`**:
  - Splits each line into sentences, **one Piper call per sentence** (multi-sentence
    calls turn sentence 2+ into noise). It renders 3 takes, scores them with local
    Whisper, keeps the best, and joins them with ffmpeg.
  - Encodes Opus, mono, 20-24 kbps. A `voices.json` maps speaker → voice model (use Kokoro
    on legion if it's installed, Piper otherwise).
  - Incremental: only re-renders lines whose hash changed. Output goes to
    `remastered/voice/<roomId>/<hash>.opus` plus `voice-index.json`.
  - Run ruff + mypy on it (linting skill).
- **Runtime (`voice.js`):** looks up each runtime message by normalized-text hash, so
  there's no Machine change. It plays the matching clip, fetches the current room's clips
  on enter and prefetches adjacent rooms. Generated system lines ("You open the box")
  show as text only. Mute, voice volume and subtitles always stay on screen.
- Budget: at ~10-15k words, **≤ 12 MB of voice total, never more than ~600 KB fetched
  per room**.

## Size budget (enforced by test)

| | Budget |
|---|---|
| First load (HTML, JS, three.js, title room, hero) | ≤ 1.5 MB |
| Per room (art + voice) | ≤ 1 MB |
| Whole game | ≤ 25 MB |

Music: keep the synthesized `js/music.js` score and add procedural Web Audio ambience
(drips, wind, water) per room at zero bytes.

## Milestones

0. **Vertical slice: the Entrance Hall.** Render passes, hero walking in, lantern
   relighting, glass cabinet hotspot, 3 voiced lines. Chris approves the look and the
   voices before scaling up.
1. Pipeline scripts hardened (render, pack, export, voice, `strings` subcommand).
2. Story bible approved, strings migration, new dialogue and rules; prove passes.
3. All rooms rendered and packed, creatures in, combat panel.
4. Full voice pass, then the polish, performance and offline service worker.

## Critical files

- New: `remastered.html`, `js/remastered/{shell,compositor,hero,voice,ui}.js`,
  `js/vendor/three.module.min.js`, `remastered/manifest.json`,
  `remastered/rooms/<id>/*`, `remastered/voice/*`, `art/blender/**`,
  `tools/blender/{render_room.py,export_actor.py,pack_room.sh}`,
  `tools/voice/build_voices.py`, `docs/remastered/story-bible.md`.
- Modified: `js/cartridges/sunken-crown.js` and `js/world.js` (story/strings),
  `tools/morrow.js` (`strings` subcommand), `test/one-machine.js` (include the remastered
  route), `test/winning-route.js`, `README.md`.
- Reused, not changed: `js/morrowlamp/*` (Machine), `js/workshop/{validator,prove,import}.js`,
  hotspot/verb mapping in `js/morrowlamp/shell-canvas.js`.

## Verification

- All existing suites stay green (`node test/*.js`, listed in the README), especially
  `one-machine.js`, `sunken-crown.js`, `strings-contract.js` and `prove.js`.
- New `test/remastered-manifest.js`, mirroring `test/scenes.js`: every room has every
  pass and a camera; every hotspot id in the id mask is a real object; every walk-to point
  lands on the walk mask; every passable exit has a zone; every voiced hash maps to a
  current string (and stale clips are flagged); size budgets hold.
- `test/shell-boundary.js` extended to boot `js/remastered/shell.js` against the stub DOM
  and drive the winning route.
- In the browser (Claude in Chrome), serve the folder (`python3 -m http.server`), play
  the full winning route in `remastered.html`, and check that the lantern lights rooms and
  dims as oil runs low, voice plays, and saves restore across `index.html`/`text.html`.
  Screenshot every room, record a GIF of the slice, and check network totals against the
  budget.
