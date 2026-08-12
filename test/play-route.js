/* ============================================================
   A route driver that can fight.
   The canonical winning route is the PUZZLE solution — it says
   nothing about combat, because the original text engine has no
   combat to say anything about. Once a cartridge switches
   encounters on, walking that route means occasionally being
   interrupted by something with teeth.

   This driver plays the route and resolves whatever jumps out,
   which is what a player does. Shared by the conformance test
   and the compiler test so both drive the game identically.
   ============================================================ */
'use strict';

/* Dice that always roll low and always favour the player: every attack
   lands, every monster attack misses. Combat *mechanics* are tested with
   varied dice in test/encounters.js; here we only need the route to be
   reproducible. */
function luckyDice() { return () => 0.1; }

/* Dice that do the opposite, for testing the ways to lose. */
function unluckyDice() { return () => 0.99; }

function resolveEncounters(rt, log, limit) {
  let guard = limit || 40;
  while (rt.encounter() && guard-- > 0) {
    const actions = rt.encounter().actions.filter((a) => a.enabled);
    /* Prefer the strongest thing available, which for the Umbra is the
       light. Never flee: the route needs the way through. */
    const pick = actions.find((a) => a.id === 'light') || actions.find((a) => a.id === 'attack') || actions[0];
    if (!pick) break;
    const result = rt.encounterAct(pick.id);
    if (log) log.push('  [' + pick.id + '] ' + result.messages.map((m) => m.text).join(' / '));
    if (rt.meta().dead) break;
  }
}

function play(rt, route, log) {
  for (const step of route) {
    resolveEncounters(rt, log);
    if (rt.meta().dead || rt.meta().win) break;
    const result = rt.command(step);
    if (log) log.push(step + ' -> ' + result.messages.map((m) => m.text).join(' / '));
    resolveEncounters(rt, log);
  }
  return rt;
}

module.exports = { play, resolveEncounters, luckyDice, unluckyDice };
