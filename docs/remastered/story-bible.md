# The Sunken Crown, Remastered: story bible

**Status: design notes, draft. Not approved.** Nothing here is to be built until Chris approves
it (milestone 2 in `HANDOFF.md`). These notes come from Chris's play-through on 2026-11-07 and
his verdict: "if you can do things in any order with no degradation of game play or reward then
it is just an open world sim vs a true RPG."

The job of this bible is to turn the game from a treasure hunt into a story with choices that
matter, without throwing away the 18 rendered rooms, the Machine, or the proof that the game can
always be won.

---

## 1. What the game is today

| Part | Today |
|---|---|
| Rooms | 18: yard, porch, hall, study, kitchen, cellar, tunnel, cave mouth, gate passage, guardroom, throne room, tomb, vault, mirror hall, mirror sanctum, lake shore, lake islet, well bottom |
| Goal | Put six regalia in the hall cabinet: crown, scepter, chalice, idol, ring, sunstone |
| Puzzles | One answer each, in a lock-and-key chain: key, hatch, shovel, echo riddle, lullaby, vault key, pitch and curtain, boat, well |
| Rules | 48, most of them jokes or refusals around those puzzles |
| Endings | One: `regalia-complete`. Every winning game ends the same way with the same score, 60 |
| Fights | Two. The Cave Lurker, once, on the lake shore. The Umbra, only if you stand in the dark, which almost never happens: the lantern holds 260 turns and the oil jar refills it |
| Failure | Death in either fight. Nothing else can go wrong or be lost |
| Character | Delver, Scholar or Prowler change starting stats (and the Scholar learns more from looking). No puzzle, line or route depends on the choice |
| Story | The grandmother's note, three books, a portrait and the king's skeleton. Nobody wants anything, and nothing you do changes what anyone thinks of you |

So Chris is right on every count. Order does not matter, choices do not exist, and the only
cost is a fight most players never see. It is a good classic adventure skeleton with no spine.

## 2. What the Machine already gives us

Most of what follows is writing and design, not engine work. Already in the Machine and the
cartridge dialect:

- **Flags and conditions.** Any rule can require flags, items carried, items present, rooms and
  lit lights, and can set and clear flags, give, take, destroy, move the player and start
  encounters.
- **Encounters** with attack, defend, flee and talk-kind actions, stat-driven, and an `onDefeat`
  outcome that need not be death.
- **Darkness** whose failure outcome is configurable (a fight today; the code comments name a
  prison cell as another option).
- **More than one ending.** `endings` is a list, each with its own conditions and text.
- **Classes, stats, experience and awards** (lore for examining, xp for treasures and riddles).
- **Timers.** Rules that fire after a number of turns.
- **The prover and the click-route test,** which prove the game can be won, by typing and by
  pointing.

**To verify before relying on them:** whether a rule can test a stat ("if lore is 40 or more"),
and whether endings can be ranked when more than one condition holds. If either is missing it
is a small, deliberate Machine change with its own test, as the plan already allows.

**The constraint that matters most.** Branching must never strand the player. Every choice that
closes a door must leave another one open, and the prover has to show that every ending is
reachable and that no state leaves the game unwinnable. This is what keeps branches honest, and
it should be designed in from the start, not tested in at the end.

## 3. Pillars

1. **The treasure is not yours.** The central question: who should have the Sunken King's
   regalia, and what does taking it cost? Every choice in the game is a small answer to it.
2. **Choices close doors.** At least three decisions are permanent and change the route, not
   just the text.
3. **Who you are changes how you solve it.** Each class has its own way through at least three
   puzzles. The shared way still exists, so no class is locked out.
4. **The world remembers.** Characters react to what you did earlier, out loud, in their own
   voices.
5. **Light is a resource.** The lantern running low is a real worry, so lighting the candle,
   saving the oil and leaving a room early are decisions.

## 4. The cast, with motives

The current game has props. A story needs people who want things.

| Character | Today | Proposed motive |
|---|---|---|
| **The grandmother** | One note | Came down the well forty years ago and came back without the crown. Her recordings (wax cylinders found around the manor and the halls) reveal why, a piece at a time. What she did and regretted is the player's warning, or their example |
| **The Sunken King's ghost** | A skeleton | Did not sink by accident. Wants his story told truly, not his treasure returned. Judges the player at the end by what they did, not by what they carry |
| **The Sentinel** | A joke guard who dances | Bound to guard the vault until relieved properly. Music frees him; violence binds him tighter. He remembers which you chose |
| **The Echo** | A riddle answer | The cavern's own voice. It repeats, but it also remembers, and it can be lied to |
| **The Cave Lurker** | A one-off fight | Not a monster: the last living thing down here, starving. Can be killed, fed (the loaf finally matters) or left alone, and each leads somewhere different |
| **The Umbra** | The dark | What is left of the court mage who sealed the halls. Fights you if you trespass in the dark; talks to you if you come with a light and the right words |

## 5. Ideas, sized by effort

Effort here means build cost on this project: rules and lines only (S), new state with new
lines and some re-rendered overlays or voice (M), or new rooms, art and endings (L).

### Small: rules and lines, no new art

| Idea | What changes |
|---|---|
| **The sentinel remembers.** Attack him first and he becomes hostile: the lullaby no longer works and the vault needs another way in (see the Prowler route below) | A flag, two rules, new lines |
| **Feed the lurker.** Give it the loaf and it leads you to something on the shore instead of fighting. Kill it and that is gone | A rule, a flag, an item placement |
| **The loaf heals.** Eating it restores health in or out of a fight, so it is worth saving | One rule step |
| **Light is scarce.** Cut the lantern to around 140 turns and make the oil jar the only refill. The candle becomes a real backup, and long detours have a price | Profile numbers, a balance pass |
| **Wrong answers cost.** A wrong word to the Echo wakes the Umbra, or the Echo stops answering until you leave and return | Two rules |
| **Class routes.** The Scholar can read the cavern's name off the History book without asking the Echo. The Prowler can lift the vault key off the sentinel without music, but only once and only if they never attacked him. The Delver can dig from the cellar straight into the vault, skipping the key | One alternate rule per puzzle, plus a stat check if the Machine supports it |

### Medium: new state, lines and some re-renders

| Idea | What changes |
|---|---|
| **The grandmother's recordings.** Five or six wax cylinders around the game, in her own voice. Each one is optional, and together they reveal what she did and why she came back empty-handed. How many you found changes the final scene | Objects, voiced lines (the writers' voice system is already built for this), small overlays |
| **Mutually exclusive treasures.** Taking the sunstone from the well floods the lake, so the chalice on the islet must be fetched first or lost. Or the reverse. The player learns that order matters | Flags, an overlay for the flooded shore, rule changes, prover work |
| **The king's ghost speaks.** He appears in the throne room after you take the crown and asks why. Your answer (and your earlier choices) sets up the ending | Dialogue rules, a ghost in three.js like the creatures |
| **The broken stairs.** Chris's chosen design, in section 6 | Rules, one new room, a hall re-render |
| **Reputation.** A single hidden tally of mercy against greed, moved by the lurker, the sentinel, the Umbra and what you do with the treasures. Characters' lines change with it | A counter (or a few flags), many line variants |

### Large: new rooms, endings and structure

| Idea | What changes |
|---|---|
| **Several endings.** For example: **The Heir** (return the regalia to the king, and he lets the halls rest); **The Thief** (keep them, and Ashcombe prospers while the well never quite stops breathing); **The Keeper** (take the sentinel's place and guard the halls, as perhaps the grandmother almost did); **Lost** (death, or the Umbra's prison) | The endings list, final-scene text and voice, maybe one new room for the epilogue |
| **Three acts.** Act one: the manor and the grandmother's mystery. Act two: the halls, the choices. Act three: the king's judgment. Each act closes behind you, so what you carry forward matters | Gating rules, pacing, rewrite of room text |
| **Up to three new rooms**, as the plan allows: the grandmother's room upstairs, an epilogue room, and one room that only some routes reach | Builders, renders on legion, semantic scenes for the retro shells |

## 6. The broken stairs (chosen design)

Today the hall's grand staircase is scenery: "up" answers "The grand staircase ends in a heap of
rubble and a hole in the roof. Up is not an option." The game points at it and then shuts the
door, which Chris found a let-down and a missed opportunity. This design makes it the first
place the game asks the player to choose.

**The puzzle: getting up.**

- Looking at the stairs shows the middle steps are gone, but the banister post at the top is
  solid. Something long enough to loop over it would get you up.
- **The shared way:** tie the **curtain** over the post and climb. It stays there for good.
- **The cost:** the boat also needs the curtain. Use it on the stairs and the boat needs other
  stuffing: the **doormat** ("you plug the hole with ELCOME"). The joke item earns its place,
  and the game teaches that what you use in one place is gone from another. Either order still
  wins; the order changes the route.
- **Class routes,** so the character choice starts to matter:
  - the **Delver** hauls up on the broken stringers by strength;
  - the **Prowler** jumps the gap;
  - the **Scholar** learns from the study's History book of a servants' stair behind the
    kitchen pantry.

**The reward: the grandmother's room.**

- Under the hole in the roof, lit by moonlight, untouched for forty years.
- Her first **wax-cylinder recording**, in her own voice: she went down the well, came back
  without the crown, and never said why. It opens the mystery the other recordings answer.
- A **second verse of the lullaby.** The first verse sets the sentinel dancing; with the second
  he is released from his post for good. That seeds the branching endings (section 5, large).

**What it touches.**

| Part | Work |
|---|---|
| World | One new room, `grandmotherRoom`, above the hall; the hall's `u` exit opens when the stairs are crossed |
| Rules | About six: look at the stairs, tie the curtain, the three class routes, patch the boat with the doormat |
| Story | The recording, the second verse, room text, the sentinel's release |
| Voice | The new lines for every narrator; the grandmother's recording in her writer voice |
| Art | EGA scene first (section 7); later a Blender builder for the room and a hall re-render with the curtain tied over the post (which also fixes the hall's chandelier bug) |
| Proof | Walkthrough, `test/winning-route.js`, `test/click-route.js` and the prover for both curtain orders and each class route |

## 6b. The back of the house (chosen design)

Today the outdoors is only the front yard: the road east and the woods south refuse you, and
the only other way is down the well. Two things already point behind the manor: the kitchen
window with the curtain, and the hole in the roof above the broken stairs. Outdoors keeps
Chris's rule: no music, only night sounds.

**The kitchen garden.** Behind the manor, reached by a path round the side of the house (west
from the yard) or through the kitchen's back door, which is bolted from the inside: open it
from the kitchen and it becomes a shortcut. Overgrown beds, moonlight, and the woods' "low,
patient sound" closer here.

- **The grandmother's grave,** under a yew. Its carved inscription, in its own voice, says she
  went down and came back up, and tells whoever reads it to sing the King's song all the way
  through: a pointer to the second verse.
- **The hole in the roof,** seen from outside: a fourth way into her room.

**The glasshouse.** Her potting bench, broken panes, dead vines.

- **The phonograph.** Wax cylinders are silent until played here, so the back of the house is
  the story's home base: you come back to hear what she left.
- **A ladder** on hooks. Prop it against the house and climb through the roof into her room.
  It costs neither the curtain nor the doormat, but you have to find it first; it can be taken
  down again, so nothing is ever stranded.

**First pass (built 2026-11-07, text and EGA only).** One cylinder, in her room; the second
verse as a page in her hand, also in her room. The second verse changes the sentinel scene
(he is released and hands you the key himself) but not the score. More cylinders, the well
trade-off and the endings come with the rest of the bible.

## 6c. The epilogue: Ashcombe restored, and let (Chris's idea, 2026-11-07)

When the adventure is complete, the game ends with a rendered cinema sequence instead of a
paragraph: Ashcombe fixed up, every room made modern, and the manor rented out as a holiday let.
It is the payoff for the player and a showcase of the remaster's rendering work.

**The sequence.** About 60 to 90 seconds. Morning: the first daylight in the game. The camera
moves through the restored house in the order the player first saw it: the yard with the well
capped and planted, the porch with a new doormat that says WELCOME (all of it), the hall with
the staircase rebuilt and the regalia lit in the cabinet, the study, the kitchen, the
grandmother's room made into the best bedroom, the garden and the glasshouse back in flower.
It ends on a booking page for the manor: a listing photo, a five-star review ("Lovely period
property. Charming staircase. Slightly haunted, in a good way."), and the sentinel, off duty,
as the host. Light music: the lullaby, played properly at last.

**What it touches.**

| Part | Work |
|---|---|
| Story | The epilogue text and the listing; it fits every ending, with lines that change by ending (the Heir's house is restored with the King's blessing, the Thief's is paid for with the regalia) |
| Art | A restored, daylit state of each room shown: a variant set in each room builder (new materials, repairs, furniture), rendered on legion |
| Cinema | Either camera moves rendered in Blender as a video, or the restored stills animated live in the browser (slow pans and dissolves, like the rooms waking). See the question below |
| Machine | None: the ending already has its own text; the shells play the sequence when the `regalia-complete` ending fires |

**Name.** Not the real company: a made-up booking site (for example "StayAway"), so the joke
does not borrow a brand.

**Open question.** A rendered video (true camera moves, the best look, roughly 10 to 25 MB) or
live stills (about 150 KB a room, 3 MB in all, keeps the game near its floppy budget)?

## 7. Production order: text first, Blender last

Chris's decision (2026-11-07): rebuild the story in text first, then pictures, and save the
Blender renders for last. A room that is not rendered yet shows its EGA picture in the
remaster, so unfinished parts are visible at a glance, the same way rooms that have not woken
up stay EGA. This already works: the remaster falls back to the EGA scene for any room with no
`remastered/rooms/<room>/room.json`.

1. **Text.** Write and play the new story in the text edition (`text.html`): rules, strings,
   endings, the walkthrough for each ending, and the prover. Text is the cheapest thing to
   change, so this is where the design gets argued out and played until it is right.
2. **EGA pictures.** Semantic scenes for new rooms and new states, painted in code: tiny,
   quick, and shared by the classic edition and the remaster's fallback. WebGL pieces that need
   no Blender (the king's ghost, built like the creatures in `js/remastered/creatures.js`) can be
   made here too.
3. **Voice.** Record a room's lines only once its text is locked, so nothing is recorded twice.
4. **Blender, last.** Build and render a room on legion only when its text and its states (which
   overlays it needs) are final. Existing rooms whose states change are re-rendered then, not
   before.

**Rule for agents:** no voice recording or Blender render for a room until Chris has approved
its text. Until then it stays EGA in the remaster.

## 8. A first slice to prove the idea

A small vertical slice that shows the change without committing to the whole rewrite:

1. **The broken stairs** (section 6), which also gives the doormat and the curtain their choice.
2. **The sentinel remembers** (small).
3. **Feed the lurker, and the loaf heals** (small).
4. **Light is scarce** (small).
5. **Two endings, Heir and Thief,** chosen by what you do with the crown after the king's ghost
   asks (medium).

That is about twenty rules, one new room, one ghost, a few dozen lines and one balance pass,
built in the order of section 7. It gives four permanent choices and two endings, and is enough to tell whether the game feels like an RPG
before the bigger pieces are built. The prover and click-route test must cover both endings.

## 9. Costs to keep in view

- **Voice.** Every new or changed line must be recorded for each of the four narrators, and
  written things for their writers. The hall's 72 clips show the pipeline works; the full script
  is about 34 minutes a narrator.
- **Art.** New states (a flooded shore, a hostile sentinel, an opened stair) are overlays and
  re-renders on legion, about a minute a room. New rooms are a builder each.
- **Proof.** Branches multiply the routes the prover and the click-route test must check. Design
  every branch with its proof in mind.
- **The classic edition.** The EGA shells run the same cartridge, so every branch appears there
  too. New rooms need semantic scenes for them.

## 10. Questions for Chris

1. Which pillar matters most: choices that close doors, class routes, or the story and its
   endings?
2. How dark should it get? Today's tone is gentle and funny. Real consequences (a hostile
   sentinel, a starving lurker, a flooded lake) pull it towards melancholy.
3. Is death a fair consequence, or should failures send you somewhere (the Umbra's prison, back
   up the well) instead?
4. How many endings, and should the player be able to see that they missed one?
5. Should the class choice be made at the start, as now, or earned by how you play?
6. The yard's text says "Morning mist" but the render is night. Which is it?
7. Start with the first slice in section 8, or plan the whole story first?
