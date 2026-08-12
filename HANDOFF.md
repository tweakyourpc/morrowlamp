# HANDOFF

For whoever picks this up next. `README.md` describes what the system is; this file describes
where the bodies are buried.

---

## Iteration two: the RPG layer became a capability

Stats and combat are no longer things The Sunken Crown has and other games do not. They are
capabilities of the Machine, configured entirely from cartridge data:

- `js/morrowlamp/outcome.js` — a system that fails says WHAT HAPPENS, not which subsystem to
  run. Darkness produces `{ type: 'encounter' | 'death' | 'move' | … }` and stops.
- `js/morrowlamp/stats.js` — stat names, classes, health formula, growth curve and level
  thresholds all come from the cartridge. No stat is named in the Machine.
- `js/morrowlamp/encounter.js` — a bounded exchange that suspends play. **Combat is one
  kind.** The abstraction is not called "fight" so that a debate or a chase does not have to
  pretend to be one later.
- `js/cartridges/sir-crumbly.js` — two rooms, one rat, two stats called MIGHT and NERVE. Its
  only job is to fail loudly if any of the above turns out to be Sunken Crown shaped.
- The Sunken Crown switched both capabilities on and the compiled game got its character
  sheet, its class choice, the Cave Lurker, the Umbra, and the examine award back.
- The lurker ambush moved out of `js/publisher.js` — where only the graphical build ever saw
  it — into cartridge data, so every front end now has it.

---

## Iteration one: the factory

The repository went from *"a retro adventure game partially generalized into a framework"* to
*"a small adventure-game factory that compiles cartridges into standalone HTML"*.

Concretely:

1. **A real runtime was built** (`js/morrowlamp/`). What existed before was
   `js/framework-runtime.js` — sixty lines of look / move / take / examine, with no flags,
   score, darkness, rules, save or endings.
2. **The rule dialect was built.** The previous docs described one as existing. It did not:
   `manifest.rules` was literally `{deterministic: true, statChecksAreHelpfulOnly: true}`.
   The dialect was written to the shape those docs implied, so the description became true
   rather than the description being changed.
3. **The Sunken Crown became a cartridge** and is the conformance target.
4. **A second cartridge was written** so coupling has somewhere to fail loudly.
5. **BUILD GAME was built.** One cartridge in, one self-contained HTML file out.
6. **The validator became a compiler front end** with addressed diagnostics.
7. **The `guardReq` fail-open was closed for good** — see below.
8. **Documentation was corrected** where it described things that did not exist.

Retired: `js/schema.js`, `js/validator.js`, `js/framework-runtime.js`, `js/exporter.js`,
`js/author.js`, `test/framework.js`. Their dead `<script>` tags were removed from
`index.html`, which is otherwise untouched.

---

## The one invariant that must not break

```
ORIGINAL ENGINE            js/engine.js + js/world.js
        ≡
MACHINE + CARTRIDGE        js/morrowlamp/* + js/cartridges/sunken-crown.js
        ≡
COMPILED ARTIFACT          the-sunken-crown.html
```

All three play `test/winning-route.js` to six treasures, sixty points and
"Sunken King's Heir". `test/conformance-sunken-crown.js` proves the first equivalence;
`test/compiler.js` proves the second.

If you change puzzle behaviour, change it in **both** the original engine and the cartridge,
or the conformance test will stop you. That friction is the point: it is what stopped the two
implementations drifting apart during this iteration.

---

## Things that will bite you

**`g.vgrad()` takes palette NAMES, not colour values.** `g.vgrad(0, y, 320, h, ['black',
'dkgray'])`, not `[C.black, C.dkgray]`. Passing values paints black on black. This was found
by looking at a screenshot, not by a test, and every other primitive (`g.px`, `g.stipple`,
`g.poly`) takes the opposite thing — a resolved colour from `g.C`.

**Exit gating fails closed, deliberately.** `ml.world.canGo()` refuses any exit carrying a
key it does not recognise. Add a new gating keyword and you must add it to
`KNOWN_EXIT_KEYS` in `js/morrowlamp/world.js` *and* to the validator's copy, or every exit
using it silently becomes a wall. The validator turns that into a build error, which is why
the copy exists.

**The presence guard runs before the rule book.** A verb aimed at an object that is not here
is refused before any rule sees it. A rule that needs to answer for an unreachable target —
fishing a coin out from under a grating — must say `reach: 'anywhere'`.

**Capabilities are `false` or a configuration object.** `stats: false` and `stats: { … }`
are both legal; `enabled: true` never has to be written, and an explicit `enabled: false`
still wins. If you add a capability, add it to `CAPABILITIES` in `profile.js` or it will not
get that treatment.

**Darkness must never learn what a fight is.** It produces an outcome
(`js/morrowlamp/outcome.js`) and stops. `outcome.js` holds the only line that connects an
outcome to the encounter system. If you find yourself adding `if (combat)` to darkness,
hunger or a timer, add an outcome type instead.

**Encounter action ordering matters for the route driver.** `test/play-route.js` prefers the
`light` action when it exists, because that is how the Umbra is beaten. A new encounter whose
strongest option has a different id will need that driver taught about it.

**`target: [null, 'lyre']` means "the verb may stand alone, or take the lyre".** A bare
`null` in the list is how "play" and "play lyre" match the same rule. Getting this wrong is
silent: the rule simply never fires and the verb's `fallback` answers instead. That exact bug
cost an hour during this iteration.

**Verbs must be declared.** The Machine ships a core verb set; anything else — `dig`, `push`,
`row`, `say` — must appear in the cartridge's `vocabulary.verbs`, or rules matching it never
run. The validator catches this now (`matches unknown verb "push"`), and caught two live
instances in Captain Thistle when it was first written.

**The Workshop cannot build from `file://`.** It fetches its own source files to embed them.
Compiled adventures have no such problem. The error message says so.

---

## `guardReq`, for the record

`js/world.js` gates the guardroom→throne exit with `guardReq: 'guardDancing'` — a second
spelling of `flagReq` that only the original engine ever understood.

- `js/engine.js` handles it correctly in both `vMove()` and `canGo()`. That was already true
  when this iteration started.
- `js/framework-runtime.js` ignored **every** exit requirement, including this one. Deleted.
- `ml.world.canGo()` fails closed on anything unrecognised.
- `js/workshop/validator.js` reports an unknown requirement as an error, naming the
  consequence.
- `js/cartridges/sunken-crown.js` translates `guardReq` → `flagReq` in its world adapter.
- `test/conformance-sunken-crown.js` asserts that every gate in the original data survives
  the translation, and `test/validator.js` asserts an unknown requirement is fatal.

Five places, because a fail-open in an adventure game is the kind of bug that quietly deletes
the middle of the game and nobody notices.

---

## Where the seams still are

Listed in README under *Remaining legacy coupling*. The short version: `index.html` still
runs `js/engine.js`, `js/rpg.js` and `js/publisher.js`, so the game logic and the RPG layer
each exist twice — once bespoke, once generic. They agree on behaviour because the
conformance test makes them, not because they share code.

There is no longer a gameplay feature the compiled game lacks for want of the RPG layer. What
the compiled game still does not do is *animate*: no walking, no frame-by-frame fight. That
is presentation, and it is the next milestone's problem rather than an architectural gap.

---

## Next recommended milestone

**Rebuild `index.html` on the Machine and retire `js/engine.js`.**

The RPG layer is done and generic, so the compiled game no longer lacks a gameplay feature
the legacy engine has. What remains is that the legacy engine still *exists* and still runs
the flagship page — which means every puzzle behaviour lives in two places and the
conformance test is doing the work of holding them together.

Sketch:

1. Point `index.html` at the Machine + the Sunken Crown cartridge, keeping `js/publisher.js`
   as the shell for now (it is a good shell; it just needs a different engine underneath).
2. Move the two things `publisher.js` still owns that are really gameplay: actor walking is
   presentation and stays, but the fight animation timing should be driven off runtime
   events rather than its own clock.
3. Delete `js/engine.js` and `js/rpg.js`. At that point `test/playthrough.js` and
   `test/conformance-sunken-crown.js` are testing the same engine and can merge.
4. `js/parser.js` and `js/ui.js` go the same way, and `text.html` becomes the parser shell.

The conformance test is the safety line for all of it: it fails the moment the two
implementations stop agreeing, which is exactly when you want to know.

**Then: round-trip authoring and `.morrow`.** See the README section for the decision that
has already been taken about semantic scene descriptions. Do not start it before the engine
merge — a second cartridge format on top of two engines is one thing too many.

Two smaller pieces worth doing at any time:

- **Profile-aware scene painters.** Let a painter receive `g.profileName` and draw more
  detail at VGA rather than the same geometry twice the size. This is an art pass, not an
  architecture change; the hook already exists, and the `.morrow` scene vocabulary will want
  it anyway.
- **Walking in the canvas shell.** `js/scenes.js` already publishes `walk` polygons and
  `clampToWalk`, and the art contract already exposes them. The shell just doesn't use them
  yet.

---

## Verification

From this directory:

```sh
node test/playthrough.js
node test/scenes.js
node test/ui-title.probe.js
node test/gfx-profiles.js
node test/morrowlamp-runtime.js
node test/encounters.js
node test/validator.js
node test/workshop.js
node test/conformance-sunken-crown.js
node test/cartridge-thistle.js
node test/cartridge-crumbly.js
node test/compiler.js
```

Then by hand, because a screenshot catches things a test does not:

```sh
python3 -m http.server 8000
```

- `author.html` → insert **THE SUNKEN CROWN** → the panels fill with the real game →
  **BUILD GAME** → `the-sunken-crown.html` downloads.
- Open the downloaded file with the network off. Play it. Save, wander, load.
- Back in the Workshop, insert **CAPTAIN THISTLE**, build, play. It should look and sound
  like a different machine, because it is.
- And **SIR CRUMBLY**, which compiles to a parser game with two stats and a rat.
- `index.html` → the original build, unchanged, CGA/EGA/VGA still cycling.
