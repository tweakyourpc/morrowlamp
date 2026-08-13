# HANDOFF

State of the work, for whoever picks it up, and for the independent audit that comes before
publication. `README.md` says what the system is; `PROVENANCE.md` says where it came from;
this file says what was just done to it and what to be suspicious of.

---

## 1. Repository

Independent git repository, branch `main`, no remote configured, nothing pushed.
All commands in this document are relative to the repository root.
Node v22 or similar. No package manager, no dependencies, no build step.

## 2-6. Commits

| | Commit | What |
| --- | --- | --- |
| baseline | `fdae308` | `chore: establish independently audited Morrowlamp baseline`, tagged `audit-rpg-baseline-2026-08-11` |
| audit fixes | `a6be6cb` | `fix: tighten combat capability contract and verify compiled Crumbly` |
| consolidation | `84125b3` | `refactor: route Sunken Crown UI through the Morrowlamp Machine` |
| | `163891e` | `refactor: retire the duplicate legacy gameplay engine` |
| | `fe44cc1` | `test: converge on one unified runtime regression suite` |
| | `45d640a` | `fix: repair three defects found by driving the real index.html` |
| | `74705cc` | `test: prove one gameplay Machine serves every shell` |
| docs | final commit | this file, README, PROVENANCE, LESSONS |

Consolidation range: `a6be6cb..HEAD`. Tags: `audit-rpg-baseline-2026-08-11` only.

`fdae308` is the exact tree an independent audit reviewed, plus `.gitignore` and
`PROVENANCE.md`. It has not been amended, rebased or squashed, and is the rollback point.

## 7. Files removed

| File | Why |
| --- | --- |
| `js/engine.js` | second implementation of world state, movement, rules, score, treasures, darkness |
| `js/rpg.js` | second implementation of stats, levelling, combat |
| `js/parser.js` | second command parser |
| `test/playthrough.js` | tested the retired engine; its distinctive assertions moved into `test/sunken-crown.js` |
| `test/conformance-sunken-crown.js` | renamed to `test/sunken-crown.js`; the two-engine comparison it existed for is gone |
| local development-environment notes | notes about an unrelated internal service, and the local tooling status of the machine this was written on; neither belongs in a public game repository. Removed from the working tree, and later from the history as well, see §"Repository hygiene". |

## 8. Files added

`PROVENANCE.md`, `LESSONS.md`, `.gitignore`, `test/one-machine.js`,
`test/artifact-harness.js` (extracted from `test/compiler.js`), `test/sunken-crown.js`
(renamed from the conformance suite).

## 9. Architecture before

```
js/world.js ──► js/engine.js + js/rpg.js ────► js/publisher.js ──► index.html
            └─► js/engine.js + js/parser.js ─► js/ui.js ────────► text.html

js/cartridges/sunken-crown.js ──► js/morrowlamp/* ──► compiler ──► standalone HTML
```

Two gameplay implementations of the same game, agreeing only because a conformance test made
them.

## 10. Architecture after

```
js/cartridges/sunken-crown.js   (+ js/world.js, js/scenes.js, js/sprites.js as its content)
              |
              v
      js/morrowlamp/*    ← the only gameplay implementation
        /     |      \
publisher.js ui.js  compiler
   |          |        |
index.html  text.html  standalone HTML
```

## 11. Test results

12 suites, all exit 0:

```
scenes · ui-title.probe · gfx-profiles · morrowlamp-runtime · encounters · validator
workshop · sunken-crown · cartridge-thistle · cartridge-crumbly · one-machine · compiler
```

Run them from the repository root as `node test/<name>.js`.

## 12. Artifact sizes

Freshly built by `node test/compiler.js`, which writes to a temp directory and prints it:

| Artifact | Size |
| --- | --- |
| `the-sunken-crown.html` | ~310 KB |
| `captains-thistle.html` | ~192 KB |
| `sir-crumbly.html` | ~147 KB |

All three pass the self-containment scan (15 patterns: external script/style/media, CSS
`url()` and `@import`, `fetch`, `XHR`, `WebSocket`, `EventSource`, `sendBeacon`, dynamic
`import()`, `iframe`, `new Image`/`new Audio`, off-host URLs).

## 13. Remaining legacy coupling

Listed in README under *Remaining legacy coupling*. In short: no second gameplay engine
remains, but `js/publisher.js` and `js/ui.js` are Sunken-Crown-specific *shells* that
duplicate presentation work the generic `shell-canvas.js` / `shell-parser.js` already do for
compiled games. That is duplicated UI, not duplicated gameplay, and merging the two lineages
is the obvious next milestone. `publisher.js` also contains a few per-object gestures
(`sarcophagus` and `mirror` answer Hand with a push), game knowledge in a game-specific
shell, which is where it belongs, but worth knowing about.

## 14. Known differences between the pages and a compiled adventure

Tabulated in README under *Known differences*. All presentation: walking animation, the
procedural splash, save-slot count, speech. No gameplay differences are known, and if the
auditor finds one, that is a bug, not a design decision.

## 15. Save compatibility

- Post-consolidation saves carry a `machine` stamp and are interchangeable between
  `index.html` and `text.html`.
- Pre-consolidation saves are **refused by name** in both shells, via `save.isCurrent()`, with
  a message telling the player to start a new game. No migration was written; these were
  browser-local saves of a pre-1.0 project.
- Compiled adventures use their own `localStorage` key per cartridge and do not share slots
  with the pages.

## 16. Deliberate behaviour changes

Two things changed on purpose, because the two implementations disagreed and one had to win:

- **Lamp fuel is 260 turns everywhere.** `index.html` used 260; the text build and compiled
  artifacts used 120. 260 is the figure the graphical build was actually tuned with.
- **Experience awards now happen in every shell.** Treasures found (30), treasures secured
  (25) and the gate riddle (50) were awarded only by `index.html` before; they are cartridge
  data now, so the terminal and compiled games award them too.

---

## What the auditor should specifically try to disprove

1. **That there is really only one gameplay implementation.** Look for game logic that crept
   back into `js/publisher.js` or `js/ui.js`, anything that decides an outcome rather than
   rendering one. `test/one-machine.js` checks four patterns; it is not exhaustive.
2. **That `index.html` genuinely lost nothing.** Play it. The claimed feature set is class
   selection, character sheet, score, treasures, inventory, darkness, lamp fuel, Cave Lurker,
   Umbra, combat panel, monster sprites, the one-time examine award, save/load/undo, the full
   winning route and the legitimate ending. Three defects were found this way *after* the
   suites were green, assume there are more.
3. **That the Machine stayed clean.** Grep is not enough; read the branch logic in
   `js/morrowlamp/runtime.js` and `encounter.js` for anything that only makes sense for one
   game.
4. **That the combat/stats contract is actually enforced.** Put `combat: true, stats: false`
   in a cartridge and confirm the build stops. Then try to reach a running combat encounter
   with no character sheet.
5. **That the compiled artifacts are self-contained.** Do not trust the scanner: open one,
   disconnect the machine, and play it.
6. **That the tests are not circular.** `test/one-machine.js` reads the same bundle manifest
   the compiler uses; if that manifest were wrong, both would be wrong together.
7. **That the save refusal is correct rather than merely convenient.** A pre-consolidation
   save is rejected rather than migrated. Decide whether that is acceptable.
8. **That nothing needed is ignored.** `.gitignore` excludes compiled artifact filenames
   (`the-sunken-crown.html` and friends) because they are build products, which also means a
   stray build in the working tree will not appear in `git status`. Check with
   `git status --ignored`.

---

## Next milestone (not started)

Merge the two shell lineages: `publisher.js` and `shell-canvas.js` do the same job for the
same game, and `ui.js` and `shell-parser.js` likewise. The generic pair is poorer (no walking,
no splash); the specific pair is not reusable. One good canvas shell and one good parser
shell, both cartridge-driven, would remove the last duplication in the project.

After that, and not before: `.morrow` round-trip authoring and the semantic declarative scene
vocabulary described in README. **Do not start `.morrow` while two shell lineages still
exist**, a second cartridge format on top of duplicated shells is one thing too many.
