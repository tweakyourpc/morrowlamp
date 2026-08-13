# Lessons

Engineering notes kept from building Morrowlamp, in the hope they are useful to whoever
works on it next, or to anyone attempting something similar.

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
  sources by fetch, the tests supply them from disk, and neither is a special case, so what
  the tests verify is exactly what ships.
- **Check self-containment mechanically.** A regex scan for `<script src>`, non-`data:`
  media, CSS `url()`, `fetch`, `WebSocket` and off-host URLs is twenty lines and turns
  "should be offline-safe" into a test. Assert on structure (module marker comments), not on
  substrings, prose in a comment mentioning a filename is not the same as shipping it.
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
  exits 1, which reads exactly like "not found", and briefly produced a confident diagnosis
  of a bug that did not exist. Verify a negative twice before acting on it.

## Third-phase rules, from a green suite and a broken page

- **A green suite that asks the runtime what would happen proves nothing about the shell that
  asks it something else.** Twelve suites passed while `index.html` carried three defects.
  The runtime was right every time; the shell read the wrong field, drew from the wrong key,
  and skipped the one function that routes typed words into a fight. Test the boundary that
  broke, which means booting the actual shell and asserting on what it did.
- **An escape hatch will be used as a door.** The runtime offered `train()` "for a shell that
  wants to report something strenuous". A shell used it on every mouse click, outside a turn
  and outside undo. Deleting the method fixed more than fixing the caller would have: there
  is now no way to express the bug.
- **Two names for the same idea will drift.** `fight.kind` is how the Machine classifies an
  encounter; `fight.id` is which encounter it is. Both are strings, both were in scope, one
  was passed to a table keyed by the other, and the default fallback made it look fine. If a
  contract exists, go through it, even when reaching past it is one character shorter.
- **A guard that never fires is not a passing test, it is a missing one.** The low-oil warning
  read a field that has never existed. `fuel !== undefined` was false forever, so the branch
  never ran and nothing ever complained. Assert that a warning *does* fire, not merely that
  it does not fire wrongly.
- **A control character is correct behaviour and wrong bytes.** A raw NUL made a perfectly
  good separator and turned the module, and every artifact built from it, into a binary blob
  for git, grep and every code viewer. The escape is identical to the interpreter and
  completely different to the toolchain.
- **When generalizing, list the behaviours you are about to lose.** Four combat behaviours
  vanished during consolidation, none deliberately: a formula quietly changed which stat it
  read, and a flat weapon bonus lost both its producer and its consumer in different commits.
  Nobody decided any of it. A diff of *behaviour* is not a diff of code.
- **Deleting a file does not delete it from history.** Obvious, and still the thing that made
  the repository unpublishable. Bundle first, then rewrite, then scan what you rewrote rather
  than what you meant to rewrite.

## Verification

See README for the current test commands, then build all three cartridges from `author.html`
and play the artifacts offline.

