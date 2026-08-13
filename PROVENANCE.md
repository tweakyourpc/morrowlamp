# Provenance

Where this repository came from, stated plainly, because the honest version is
more useful than a tidy one.

## Morrowlamp grew out of a game

Morrowlamp Game Workshop began as **The Sunken Crown**, a single point-and-click
adventure. The framework was extracted from that game experimentally, over
several iterations, by generalizing the parts that turned out not to be specific
to it. The Sunken Crown is now one cartridge among three, and the conformance
target that keeps the rest honest.

## This repository does not contain that early history

The original Sunken Crown lives in a **separate** git repository, which has two
commits:

- `8af81e2`: Initial release of The Sunken Crown
- `cf5c006`: Show Morrowlamp marketing art in README

Both predate all framework work. **They are historical references, not ancestors
of this repository's first commit.** No attempt has been made to graft, rebase,
subtree, or otherwise manufacture a connection between them and the commits here,
because no such connection exists in fact.

All Morrowlamp framework development happened in an untracked working directory
alongside that repository. It was never committed, stashed or tagged as it went.
**The intermediate history, the iteration that built the Machine, the compiler
and the first two cartridges, and the iteration that made stats and encounters a
generic capability, was therefore not preserved and cannot be recovered.** It is
gone, and this file exists partly to say so rather than to let a clean commit
graph imply otherwise.

## What the first commit is

Before this repository was created, the working tree was copied and reviewed by an
independent audit that had no context from the development sessions. The first
commit here is that exact reviewed tree, plus only `.gitignore` and this file, 
neither of which changes runtime behaviour.

It is tagged `audit-rpg-baseline-clean-2026-08-12`.

That commit is a **baseline**, not a beginning. It is the first point at which the
project's history became durable, and the rollback point for everything after it.

## Repository hygiene before publication

This repository was never pushed anywhere. Before it became publishable, its history was
rewritten to remove material that should not have been committed in the first place: local
development-environment notes about an unrelated internal service, including a private
network address, and a working directory belonging to a local tool. Those files had already
been deleted from the working tree, which does not remove them from history, so the history
itself was rewritten.

The rewrite also replaced a literal NUL byte in one module with its escape, so that every
commit in this repository is readable as text by git, grep and a code viewer.

Because rewriting changes every commit hash, the pre-sanitization hashes and the tag that
pointed at them **no longer name anything in this repository**. They were never published,
and they are not preserved here as if they were still valid. The commit-for-commit
correspondence is recorded in `HANDOFF.md` for the next auditor, together with the location
of the pre-rewrite bundle, which is kept outside the repository.

What survived is the shape of the work: the same eleven milestones, in the same order, with
the same trees apart from the removals described above.

## Fiction and fact

"Morrowlamp Software", its 1987 copyright lines, its Educational and Demonstration
Divisions, and the boxed-software voice throughout the interface are **invented**.
They are part of the project's aesthetic: an imaginary development system from a
1987 that had browsers. There is no such company, there never was, and nothing
here is affiliated with any real historical software publisher.

The code, prose, puzzles, procedural artwork and synthesized music were developed for this
project through the human-directed, multi-agent process described in [CREDITS.md](CREDITS.md).

## Authorship

**Created and orchestrated by Christopher Davis.** Generative AI systems contributed in
multiple software and creative roles under human direction. Christopher Davis does not claim
to have personally written The Sunken Crown's fictional narrative. See
[CREDITS.md](CREDITS.md) for the concise development-methodology statement.
