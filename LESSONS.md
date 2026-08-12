# Lessons

Engineering notes kept from building Morrowlamp, in the hope they are useful to whoever
works on it next — or to anyone attempting something similar.

## What changed

The Sunken Crown became one cartridge for a reusable engine. There is now a Morrowlamp
Machine (`js/morrowlamp/`) that knows how to run an adventure and nothing about any
particular adventure, a declarative rule dialect, a compiler-grade cartridge validator, a
BUILD GAME pipeline that emits one self-contained HTML file, and a second tiny cartridge that
exists purely so coupling has somewhere to fail loudly.

## Durable rules

- **Before generalizing, check what the docs claim already exists.** Three documented
  features of the "framework" were not implemented: the rule dialect, a runtime with game
  state, and a conformance test. Reading the code first turned the plan from *extend* into
  *build, then make the description true*.
- **Keep the old implementation and make the two agree.** The original engine was left
  working, and a conformance test drives one canonical route through both it and the new
  runtime. Every behavioural drift during the port surfaced as a failing assertion within
  seconds instead of as a subtly different game months later.
- **A second use case is the only reliable test of an abstraction.** A four-room throwaway
  cartridge found two undeclared verbs, a `lantern` reference that had leaked into the
  generic shell, and a bundle that was shipping another game's art. None of that was visible
  with one game.
- **Fail closed on anything the runtime does not recognise, and make it a build error.** A
  gating keyword the engine has never heard of should shut the door and be reported at build
  time. Fail-open in an adventure game silently deletes the middle of the game.
- **Keep both closed sets closed.** Enumerating the legal rule actions and conditions turns
  every typo into an addressed compile error rather than a puzzle that never fires.
- **Gameplay features belong to the game, not the interface.** Lamp fuel lived in the
  point-and-click shell, which meant the text build had an eternal lantern. Moving it into
  the cartridge's gameplay profile fixed every front end at once.
- **Make the compiler a pure function of `{ cartridge, sources }`.** The browser supplies
  sources by fetch, the tests supply them from disk, and neither is a special case — so what
  the tests verify is exactly what ships.
- **Check self-containment mechanically.** A regex scan for `<script src>`, non-`data:`
  media, CSS `url()`, `fetch`, `WebSocket` and off-host URLs is twenty lines and turns
  "should be offline-safe" into a test. Assert on structure (module marker comments), not on
  substrings — prose in a comment mentioning a filename is not the same as shipping it.
- **Screenshots catch what tests do not.** A palette-name-versus-colour-value mix-up painted
  a whole floor black in a game whose tests all passed.

## Second-phase rules

- **A failing system should produce an outcome, not call a subsystem.** Darkness that says
  `{ type: 'encounter', encounter: 'umbra' }` stays ignorant of combat; darkness that calls
  `startFight('umbra')` has learned something it should never know. One dispatcher maps types
  to behaviour, and it is the only file that connects the two.
- **Name the abstraction one level above the first use case.** "Encounter" with combat as one
  kind cost nothing over "combat", and means a debate or a chase will not have to arrive
  disguised as an enemy with hit points.
- **Let a capability be `false` or a configuration object.** `stats: false` and `stats: {…}`
  read better than a parallel boolean, and the absence of a feature stays obvious.
- **A third cartridge earns its keep the same way the second did.** Two stats called MIGHT
  and NERVE immediately proved the stat system was not five-stat-shaped.
- **The same class of bug recurs: gameplay hiding in the presentation layer.** Lamp fuel was
  in the point-and-click shell last time; the monster ambush was this time. Both meant one
  front end silently had a different game. Worth grepping the shell for state changes.
- **grep treats a large compiled artifact as binary.** Without `-a` it reports nothing and
  exits 1, which reads exactly like "not found" — and briefly produced a confident diagnosis
  of a bug that did not exist. Verify a negative twice before acting on it.

## Verification

See README for the current test commands, then build all three cartridges from `author.html`
and play the artifacts offline.

