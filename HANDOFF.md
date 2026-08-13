# HANDOFF

State of the work, for whoever picks it up, and for the independent audit that comes before
publication. `README.md` says what the system is; `PROVENANCE.md` says where it came from;
this file says what was just done to it and what to be suspicious of.

---

## 1. Repository

Independent git repository, branch `main`, no remote configured, nothing pushed.
All commands in this document are relative to the repository root.
Node v22 or similar. No package manager, no dependencies, no build step.

## 2. The previous audit

An independent Codex audit reviewed the tree at the end of the consolidation milestone and
returned:

- **Engineering: ACCEPT WITH FINDINGS**
- **Publication: NOT READY TO PUBLISH**

This milestone is the response to that verdict. It fixed the publication blockers, added
regression coverage aimed at the class of defect the audit found, sanitized the unpushed
history, and stopped. No new features were built. Shell convergence and `.morrow` were not
started and remain the next milestone.

## 3. Each publication blocker and the fix applied

**A. The graphical shell owned gameplay mutation.**
`js/publisher.js` called `rt.train()` from three places: once on every mouse click on bare
floor, and twice from the verb handler. None took a turn, so none was inside an undo frame,
none refreshed the character panel, and the level-up line was discarded before it could
print. Agility could be ground by clicking the ground, and a text player trained at a
different rate than a mouse player of the same cartridge.

Fixed by moving the decision into the Machine. A cartridge declares `stats.exertion` (which
ordinary verbs are physical work and what they wear in) and the runtime applies it inside the
turn, after the verb is handled, inside the undo frame the turn already pushed.
`runtime.train()` and `runtime.award()` were **removed from the shell-facing API**, so the
door is closed rather than merely unused. `js/workshop/validator.js` checks that an exertion
names a real verb and a real stat.

**B. Text-shell encounter commands were unreachable.**
`js/ui.js` called `parse()` then `perform()`, skipping `command()`, which is the only place a
typed word is offered to the running encounter before the parser sees it. "Defend", "Flee"
and "Raise light" are action names the cartridge chose, not verbs, so on the one page whose
entire interface is typing they could not be typed. `attack` worked only by accident.

Fixed by routing the text shell's submit through `rt.command()`. No Umbra-specific parser
logic and no new vocabulary verbs were added; the generic encounter-name match that already
existed now gets reached. A fight also lists its own action labels when it starts, taken from
`meta().encounter.actions`.

**C. Private material in unpushed history.** See §6.

**D. Four combat behaviours lost in consolidation.** See §4.

**E. The Cave Lurker drew the Umbra.**
`js/publisher.js` asked for monster art keyed by `fight.kind`, which is `'combat'` for every
fight in the game, so the sprite table's default fired and both encounters drew the Umbra.
The lurker painter existed and was never selected.

Fixed by going through the art contract the canvas shell already used:
`art.opponent(g, fight.id, …)`, with `js/morrowlamp/render.js` added to `index.html`. The
contract now also passes the animation clock, so the picture still moves.

**F. The low-oil indicator read a field that does not exist.**
It read `rt.flags().lampFuel`. There is no such field anywhere in the repository, so the
guard short-circuited and the "(low)" state and its CSS class had **never once fired** in the
history of the build. Fixed to read `rt.meta().fuel`, the Machine's own number, with the
threshold taken from the cartridge's first fuel warning rather than a constant typed into the
shell.

**G. Literal NUL bytes.**
One raw `0x00` in `js/morrowlamp/vocabulary.js`, used as an alias-index key separator. It was
deliberate and correct as behaviour and wrong as a byte: it made git, grep, GitHub's blob
viewer and every diff tool treat that module as binary, and because the module is in the
runtime bundle, **every compiled adventure inherited it**. Replaced with the `\u0000` escape,
which is behaviour-identical. `test/hygiene.js` now fails if any tracked text file or any
compiled artifact contains one.

**H. Dead state.** A `darkTurns` counter left in `js/publisher.js` when the darkness rules
moved into the Machine: declared, never assigned, never read. Removed. The runtime's own
`S.darkTurns` is live and was not touched.

**I. Found during this milestone, not in the audit.** Driving the real page turned up a
fourth shell-boundary defect: the combat panel opened from the runtime's encounter event but
closed only from inside its own button handler, so a fight ending by any other route left the
panel on screen. Not reachable in ordinary play today, but the same fault as the rest, and
fixed the same way.

## 4. Behavioural compatibility decisions

The audit reported four differences from the previous Sunken Crown implementation that were
not documented as intentional. All four were consolidation losses rather than decisions, and
all four were **restored**, expressed as cartridge configuration so that no Sunken-Crown
shape entered generic code.

| Behaviour | Before consolidation | After consolidation | Now |
| --- | --- | --- | --- |
| Attack accuracy | `0.55 + agi/260 + luck/500` | the same formula fed by **strength**, because one field drove both aim and damage | restored. Encounter actions take an optional `hitFrom`; the cartridge sets `uses: 'str'`, `hitFrom: 'agi'`. Aim and weight are not the same talent. |
| Rusty knife | `+2` damage when carrying it | gone entirely, both the producer and the consumer were deleted, nothing replaced them | restored as a generic `bonus: [{ when: … }]` on a strike action, evaluated with the same rule conditions everything else uses. The cartridge writes `when: { carrying: ['knife'] }`. |
| Luck when fleeing | `0.32 + agi/180 + luck/400` | the luck term was dropped; the Prowler's "quick to get away" perk was worth nothing | restored. The escape branch honours `action.luck` exactly as the strike branch always did. |
| Post-combat darkness | `darkTurns = -4` after a fight, six dark turns of respite | gone; `darkTurns` kept its pre-fight value, so surviving the Umbra in an unlit room restarted the fight on the very next move | restored as `profile.darkness.respite`, which the cartridge sets to 4. Verified end to end: six free dark turns, against two before the fix. |

Nothing was retained as an intentional difference, so there is nothing in this section to
argue with on design grounds, only on whether the restorations are faithful. They were
checked numerically against the formulas recovered from the retired engine, not by eye.

Two **earlier** deliberate changes still stand and are unchanged by this milestone: lamp fuel
is 260 turns everywhere, and experience awards happen in every shell.

One **new** deliberate change: the free-click agility grind was not restored. It took no
turn, no other shell had it, and it rewarded clicking the floor. Walking now trains agility
through the `move` verb, in every shell, at the same rate.

## 5. Commits

Eleven commits, all rewritten by the history sanitization in §6.

| | Commit | What |
| --- | --- | --- |
| baseline | `3e29daf` | `chore: establish independently audited Morrowlamp baseline`, tagged `audit-rpg-baseline-clean-2026-08-12` |
| audit fixes | `3e17fa9` | `fix: tighten combat capability contract and verify compiled Crumbly` |
| consolidation | `46a2e15` | `refactor: route Sunken Crown UI through the Morrowlamp Machine` |
| | `165d681` | `refactor: retire the duplicate legacy gameplay engine` |
| | `4336aab` | `test: converge on one unified runtime regression suite` |
| | `408ce35` | `fix: repair three defects found by driving the real index.html` |
| | `3073cfb` | `test: prove one gameplay Machine serves every shell` |
| | `b838a5c` | `docs: document the consolidated architecture and prepare for review` |
| release remediation | `2d99eea` | `fix: return gameplay decisions from the shells to the Machine` |
| | `819661a` | `test: drive the real shells, and keep the repository text` |
| | `7976e2e` | `fix: close the combat panel when the Machine says the fight is over` |

Plus the documentation commit this file is part of.

## 6. History sanitization

**Why.** The audit found that files deleted from the working tree were still present in
history: local development-environment notes for an unrelated internal service, containing a
private network address and internal route names, plus a local tool's staging directory. All
eleven commits carried them, and the baseline tag pointed at the commit that introduced them.
The repository had never been pushed, so this was fixable rather than merely regrettable.

**Method.** `git filter-branch` over all refs with a tree-filter running an idempotent
scrubbing script, plus a message-filter, then `reflog expire` and `gc --prune=now`, then the
old tag deleted and a new one created. The scrub removed the private files and directory,
replaced the status line that named an internal service, replaced the handoff table row that
named the removed files, removed absolute local paths, and escaped the NUL byte in every
historical copy of `vocabulary.js`.

**Safety.** A full `git bundle` of the pre-rewrite repository, all refs, was created and
verified before anything destructive ran, `git bundle verify` plus a clone-from-bundle
smoke test that reproduced the original HEAD. It is stored outside the repository:

```
../morrowlamp-pre-remediation-2026-08-12.bundle
sha256 ae1437f7e4c5fd779de24b2be5dda73a7f8c3f3693739074ab6ece7c3abdd7cd
3,759,541 bytes · 11 commits · original HEAD 9548827370e2439bc94a414d0d55f180b5bf3711
```

**Old to new correspondence.** These old hashes name objects that no longer exist here. They
were never published. They are recorded so an auditor comparing notes against the previous
audit can line the two up.

```
fdae308 -> 3e29daf    45d640a -> 408ce35
a6be6cb -> 3e17fa9    74705cc -> 3073cfb
84125b3 -> 46a2e15    9548827 -> b838a5c
163891e -> 165d681    ff21d4e -> 2d99eea
fe44cc1 -> 4336aab    d17e7f8 -> 819661a
                      3ab1de6 -> 7976e2e
```

Old tag `audit-rpg-baseline-2026-08-11` deleted. New tag
`audit-rpg-baseline-clean-2026-08-12` on `3e29daf`.

**Verification after the rewrite.** Every reachable commit was scanned for `192.168.`,
`10.0.0.`, the internal service names, the agent directory, `/home/…`, and credential
patterns (`ghp_`, `AKIA`, `sk-`, `Bearer `, `PRIVATE KEY`). Note that the paragraph you are
reading will itself match several of those, because it lists them; so will `test/hygiene.js`,
which searches for them. Those two files aside, **there are no surviving matches anywhere in
reachable history**. All 104 blobs in history were read: exactly one contains a NUL byte, and
it is the marketing PNG.

**No credentials or secrets were found at any point**, before or after. Nothing had to be
rotated.

## 7. Architecture

Unchanged by this milestone.

```
js/cartridges/sunken-crown.js   (+ js/world.js, js/scenes.js, js/sprites.js as its content)
              |
              v
      js/morrowlamp/*    <- the only gameplay implementation
        /     |      \
publisher.js ui.js  compiler
   |          |        |
index.html  text.html  standalone HTML
```

## 8. Test results

**14 suites, all exit 0.**

```
scenes · ui-title.probe · gfx-profiles · morrowlamp-runtime · encounters · validator
workshop · sunken-crown · cartridge-thistle · cartridge-crumbly · one-machine · compiler
shell-boundary · hygiene
```

Two are new.

`test/shell-boundary.js` boots the real `js/publisher.js` and the real `js/ui.js` against a
stubbed page whose hidden-element state is seeded from `index.html` and `text.html`, so the
stub cannot drift from the markup. It clicks scene coordinates read from the scene data,
submits the command form, and runs the real animation frames so the real draw path executes.
Its three sections run in child processes because each shell expects to own the page globals.

**Eleven of its checks fail against the audited build and pass against this one.** That was
verified by stashing `js/` back to the audited state and running them. Two of its graphical
checks (LOOK, and a room change the shell did not initiate) pass in both directions, those
defects were fixed in an earlier commit, and these are guards rather than reproductions.

Its third section establishes which Machine each route runs **without consulting the bundle
manifest**, since the compiler is generated from that manifest and the manifest agreeing with
itself proves nothing. It reads the pages' own script tags, compares them against the modules
a compiled artifact actually built, and asks both the same gameplay question.

`test/hygiene.js` covers properties of the files rather than the game: zero literal NUL bytes
in tracked text and in all three compiled artifacts, and no private addresses, internal
service names, credentials or absolute local paths anywhere in the tree.

Both run in CI. The workflow is still checkout, Node, plain `node test/<name>.js`, with no
package manager.

## 9. What a real browser actually did

Chrome, pages served over HTTP from the repository root. This is the part no suite covers.

**`index.html`, exercised by real mouse clicks:** splash, title, class selection (Delver and
Prowler), character sheet, LOOK on a scene hotspot, movement by clicking an exit, inventory
rendering, item-on-object (all six treasures placed in the cabinet by click), containers,
darkness, lighting and dousing the lantern, the low-oil indicator, the Umbra encounter panel
with Defend and Raise light clicked for real, the guard mechanic visibly halving damage, the
Umbra defeated, the panel closing, undo, autosave resume, and the ending.

Final state reached in the browser: **score 60, rank Sunken King's Heir, 6/6 regalia,
Entrance Hall, ending `regalia-complete`, Delver level 4.** No console errors at any point.

"Agility rose to 31." appeared as an ordinary turn message, which is the exertion fix visible
in the real product. The restored darkness respite was confirmed live: `darkTurns` was `-4`
after the Umbra died.

**`text.html`, exercised by real typing:** title, start, parser commands, and the three
commands the audit said were broken. `defend`, `raise light` and `flee` all executed their
encounter actions. `flee` typed outside a fight correctly falls through to the parser as an
unknown word, which is the generic path behaving properly. Save to a slot, move, load,
restored to the saved room. No console errors.

The final release audit also opened **each compiled artifact through `file://` from a separate
directory containing only that HTML file, with browser networking disabled**. All three
booted and reached their legitimate endings; each requested only its own local document.

**Honestly stated boundary.** The long treasure-collection route in `index.html` was driven by
issuing commands to the actual page's own runtime rather than by sixty hand clicks. All six
final inventory-to-cabinet deposits used the real inventory buttons, canvas click path, and
win overlay. Representative LOOK, movement, container, item-on-object, undo, save/load,
low-oil, darkness, Defend, and Raise light interactions also used their real controls.

The final release audit visually inspected the Cave Lurker in Chrome. Its pale segmented body,
turquoise shell and legs are plainly distinct from the Umbra's dark shadow treatment; the
combat panel also identifies it as Cave Lurker.

## 10. Artifacts

Built fresh with a pinned build stamp so the hashes are reproducible; the stamp is the only
thing that varies between builds.

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| `the-sunken-crown.html` | 322,831 | `fb2c8486f5f006840d6d8e8f6ef9bdf3def1d85f7ada1142817ec8f0e8814ae1` |
| `captains-thistle.html` | 201,318 | `c3a4c49534aa5886c2f11586f1e097fb2f07ba6fe42b7bd37ca910f08ea9bd00` |
| `sir-crumbly.html` | 154,750 | `7a30ff7322b95a8fde5190b34453d9c99f62067fafab8d9f9723aa02aedae2d4` |

All three: boot in the sandbox, zero NUL bytes, `selfContained: true` with no findings from
the 15-pattern inspector, no `js/` or `css/` references of any kind. The Sunken Crown
artifact plays the canonical route to 60 points and Sunken King's Heir inside the sandbox.
Artifacts are **not committed**; `.gitignore` treats them as build products by policy.

## 11. Final pre-publication state

- HEAD: the documentation commit at the tip of `main` (see `git log -1`).
- Clean baseline tag: `audit-rpg-baseline-clean-2026-08-12` on `3e29daf`.
- Working tree: clean.
- At the final local gate, no remote was configured and nothing had yet been pushed.

## 11a. The authoring-loop milestone

Everything above describes the state at publication. This section describes the milestone
after it, which closed the authoring loop and added a winnability proof. No gameplay was
redesigned; one piece of dead state was removed (see below).

**What was built.**

1. **Cartridge import.** `js/workshop/workshop.js` could write a cartridge out as JSON and had
   no way to read one back. The Workshop could therefore never resume its own work, and a
   cartridge written anywhere else could never get in. **Load cartridge…** and a drop target
   on the slot now do the other half. A loaded file is parsed, format-checked and *validated*
   before it reaches the bench; a broken one prints the compiler's own report in the
   diagnostics panel and is not added to the shelf.
2. **Structured validator findings.** `validate()` now returns `findings`, each with a stable
   `code` slug and a `path` into the cartridge (`rules[16].do[2].goto`). `errors` and
   `warnings` are still plain strings and `report()` is unchanged, so nothing that read the
   old shape moved. *(The plan called for finding objects with a `toString()`; the tests match
   on `.includes`, which is a String method, so keeping the string arrays and adding a third
   structured view was the safer and simpler shape.)*
3. **`tools/morrow.js`.** validate / prove / build / play from a terminal, exit 0 or 1,
   `--json` where it makes sense. Reuses `ml.bundle.filesFor`, `ml.compiler.compile` and the
   prover; no new machinery, no dependencies.
4. **`js/workshop/prove.js`.** A cartridge may declare its own `walkthrough`; the prover plays
   it on the real Machine with steady dice and fails at the step it falls over on, checking the
   declared ending and score. Plus a static dead-content read: shadowed rules, unproducible
   objects, write-only flags, unfirable endings, unstarted encounters. *(The plan had the
   validator run this. It does not: `validate()` promises to be pure and instant and the
   Workshop calls it on every keystroke. Proving is a separate button and a separate command.)*
5. **The strings table.** Any prose slot may hold `'@s:some.key'`, resolved from
   `cartridge.strings`, the same table that already overrode the Machine's system messages.
   `js/cartridges/sir-crumbly.js` is converted entirely and is the reference for it.
6. **Test and Text tabs** in `author.html`. Test mounts the cartridge on the real generic
   shell inside a panel; Text lists every string key with an editable field.

**What it found.**

- **The shells printed `@s:` references verbatim.** `describeRoom`, `describeObject` and
  `intro()` bypassed `say()`, so a strings-table cartridge showed `@s:pantry.desc` on screen
  while every Node suite was green. Found by opening the Test tab and looking. All three now
  go through one resolver in `runtime.js`; nothing leaves that file as text without passing
  through it. **This is the third time a defect has lived in the gap between "the runtime is
  right" and "the screen is right", and the second time only a real page found it.**
- **`lensSecret` was a write-only flag** in The Sunken Crown: set by `lens-on-note`, read by
  nothing. `say echo` and `push mirror` never asked whether the player had been told. The
  prover reported it on its first run against the flagship; the flag is gone and
  `test/sunken-crown.js` now asserts the rule's actual effect instead of the dead state.

**New suites.** `test/prove.js` (13 groups, including a cartridge that validates perfectly and
cannot be won), plus new groups in `test/validator.js` (structured findings, paths, the
strings table in both directions) and `test/workshop.js` (JSON round trip). All 15 suites
green. CI runs `test/prove.js` and additionally proves all three cartridges through the CLI.

**Verified by hand in a browser** at `author.html`: load/save round trip, three kinds of
refusal (bad JSON, wrong format, invalid cartridge), Prove on The Sunken Crown, the Text tab
against Sir Crumbly's 33 keys, and the Test tab mounting both the parser shell (Sir Crumbly,
played through the rat) and the canvas shell (Captain Thistle, CGA, hotspots, verb bar).

**Known rough edge:** the canvas shell's title card is positioned for a full page, so on the
Test tab it dims the whole Workshop until BEGIN is pressed. It works; it looks odd. Fixing it
belongs with shell convergence.

## 12. Remaining known issues

0. **A Workshop-made cartridge can only ever be a parser game.** Painters are functions and do
   not survive JSON, so `presentation.art.scene` is unreachable from the JSON tier. This is the
   cap on the whole authoring loop and the reason the semantic `.morrow` scene description is
   the next milestone.
1. **Two shell lineages still exist.** `publisher.js` and `shell-canvas.js` do the same job
   for the same game, as do `ui.js` and `shell-parser.js`. That is duplicated presentation,
   not duplicated gameplay, and it is the next milestone.
2. **`publisher.js` still contains a few per-object gestures** (`sarcophagus` and `mirror`
   answer Hand with a push). Game knowledge in a game-specific shell, which is where it
   belongs, but worth knowing about.
3. **`.gitignore` names artifact filenames per cartridge.** The compiler derives the output
   filename from the cartridge id, so a fourth cartridge's build would land in the working
   tree untracked *and* unignored, and would show up in `git status` as a candidate to
   commit.
4. **The marketing PNG carries embedded C2PA metadata** identifying it as AI-generated. It is
   disclosed rather than stripped.
5. **Presentation parity is not tested across shells** and is not claimed to be.

---

## What the next auditor should specifically try to disprove

Do not take any of the above on trust. In rough order of what would be most damaging if true:

1. **That no shell still decides gameplay.** `runtime.train`/`award` are gone, but look for
   any other place a shell writes to `rt.state()` or reasons about outcomes rather than
   rendering them. `test/shell-boundary.js` checks a handful of specific behaviours; it is
   not a proof of absence.
2. **That the four restored combat behaviours are faithful.** The old formulas were recovered
   from a deleted file in a rewritten history. Read them out of the safety bundle and check
   the arithmetic independently, including the divisors.
3. **That `stats.exertion` is a generic seam and not Sunken Crown in disguise.** Write a
   cartridge that uses it differently and confirm the Machine does not care.
4. **That `index.html` genuinely lost nothing.** Play it properly, with a focused eye on the
   Cave Lurker's artwork, which §9 admits nobody has seen.
5. **That the history is actually clean.** Re-run an adversarial scan with your own pattern
   list rather than mine. Check the bundle to see what was removed and judge whether the
   removal was complete and whether it was honest.
6. **That the shell-boundary tests would fail if the bugs came back.** Reintroduce each of
   the seven defects one at a time and confirm something goes red. If one does not, that test
   is decoration.
7. **That the stubbed page is not lying.** The DOM stub is seeded from the real HTML, but it
   is still a stub. Find a behaviour that passes against the stub and fails in a browser.
8. **That the compiled artifacts are self-contained.** Do not trust the inspector. Open one,
   disconnect the machine, and play it to the end.
9. **That the save refusal is correct rather than merely convenient.** Pre-consolidation
   saves are rejected rather than migrated.
10. **That this document is accurate.** Particularly §9, which is the only place claiming
    things a test does not.

---

## Next milestone (not started)

Merge the two shell lineages: `publisher.js` and `shell-canvas.js` do the same job for the
same game, and `ui.js` and `shell-parser.js` likewise. The generic pair is poorer (no walking,
no splash); the specific pair is not reusable. One good canvas shell and one good parser
shell, both cartridge-driven, would remove the last duplication in the project.

After that, and not before: `.morrow` round-trip authoring and the semantic declarative scene
vocabulary described in README. **Do not start `.morrow` while two shell lineages still
exist**, a second cartridge format on top of duplicated shells is one thing too many.
