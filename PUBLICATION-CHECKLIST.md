# Publication checklist

What has to be true before this repository is pushed anywhere for the first time, and what
is true right now. `HANDOFF.md` has the evidence behind each line.

**Nothing here has been published. There is no remote. Nothing has been pushed.**

## Repository

| | Item | State |
| --- | --- | --- |
| ✅ | Git history sanitized: no private or internal material in any reachable commit | done, verified across all 11 commits and all 104 blobs |
| ✅ | No credentials, tokens or keys anywhere in history | none were ever present; nothing to rotate |
| ✅ | No absolute local filesystem paths in tracked files | guarded by `test/hygiene.js` |
| ✅ | Pre-rewrite safety bundle created, verified, stored outside the repository | see `HANDOFF.md` §6 |
| ✅ | Old to new commit correspondence recorded | see `HANDOFF.md` §6 |
| ✅ | Clean baseline tag exists and points at the right commit | `audit-rpg-baseline-clean-2026-08-12` |
| ✅ | Public documentation references only valid history | old hashes appear once, explicitly labelled as dead |
| ✅ | Working tree clean | |
| ✅ | No remote configured | |
| ✅ | MIT license and public project credit are present | see `LICENSE` and `CREDITS.md` |

## Code and build

| | Item | State |
| --- | --- | --- |
| ✅ | All test suites pass | 14 of 14 |
| ✅ | Zero literal NUL bytes in tracked text and in generated HTML | guarded by `test/hygiene.js` |
| ✅ | Three cartridges compile | Sunken Crown, Captain's Thistle, Sir Crumbly |
| ✅ | Artifacts pass the self-containment scan | 0 findings each |
| ✅ | Artifacts need no neighbouring files | verified in a browser from an otherwise empty directory |
| ✅ | Artifact sizes and hashes recorded | `HANDOFF.md` §10 |
| ✅ | CI runs the current suites, including the new ones | no package manager added |

## Behaviour

| | Item | State |
| --- | --- | --- |
| ✅ | Real graphical route completes in a browser | 60 points, Sunken King's Heir, legitimate ending |
| ✅ | Text-shell encounter commands work | Defend, Flee, Raise light, by real typing |
| ✅ | No shell owns gameplay stat mutation | the API for it was removed |
| ✅ | Low-oil display reads authoritative state | and fires, which it never did before |
| ✅ | Encounter art keyed correctly | proven by test; see the caveat below |
| ✅ | Combat behaviour differences resolved | all four restored, all four tested |

## Accuracy of claims

| | Item | State |
| --- | --- | --- |
| ✅ | README distinguishes gameplay parity from presentation parity | |
| ✅ | No claim that real-page behaviour is proven where only runtime tests exist | |
| ✅ | Routes covered through real shells are documented | |
| ✅ | Remaining presentation-shell duplication documented honestly | |
| ✅ | Provenance accurate, including the pre-publication rewrite | |
| ✅ | Shell convergence clearly marked future work | |
| ✅ | `.morrow` clearly marked future work | |

## Open before publishing

| | Item |
| --- | --- |
| ⬜ | **Look at the Cave Lurker.** Its painter selection is proven by test, but the artwork has not been seen by a human in a browser. See `HANDOFF.md` §9. |
| ⬜ | **Second independent audit** of this milestone before the first push. |

## Not started, deliberately

- Shell convergence (`publisher.js` + `shell-canvas.js`, `ui.js` + `shell-parser.js`)
- `.morrow` round-trip authoring
- Any new cartridge, graphics mode, animation, speech or sharing feature
