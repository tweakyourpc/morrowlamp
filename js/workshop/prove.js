/* ============================================================
   MORROWLAMP GAME WORKSHOP — the prover
   The validator proves a cartridge is well formed. That is a
   different claim from proving it can be finished, and the second
   one is the one a player cares about. A game can validate
   perfectly and still be unwinnable: the key is behind the door
   the key opens, the rule that sets the flag is shadowed by an
   earlier rule, the treasure is in a room whose only exit waits
   on a flag that rule was supposed to set.

   Two layers, cheapest first.

     WALKTHROUGH   A cartridge may carry the route through itself.
                   The prover plays it on the real Machine, with
                   the dice held steady, and reports the step it
                   died on if it does not reach the ending.

     DEAD CONTENT  A static read for things that cannot ever
                   happen: a rule an earlier rule always claims
                   first, an object nothing can produce, an ending
                   nothing can fire. Warnings, all of them — a game
                   in progress is allowed to have loose ends.

   Deliberately NOT a solver. Searching the state space of a
   closed rule dialect is a tempting research project; a declared
   route gets most of the safety for almost none of the cost, and
   it doubles as the cartridge's own regression test.

   Kept out of the validator on purpose. `validate()` promises to
   be pure and instant — the Workshop calls it on every keystroke
   — and playing a whole adventure is neither.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  /* A route is not allowed to run forever: a cartridge whose ending
     condition never fires would otherwise hang the Workshop. */
  const ENCOUNTER_LIMIT = 60;

  function list(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value.slice() : [value];
  }

  /* The declared route, in either shape it may be written:
       walkthrough: ['n', 'take lamp', …]
       walkthrough: { route: [...], ending: '…', score: 20 } */
  function routeOf(cartridge) {
    const declared = (cartridge || {}).walkthrough;
    if (!declared) return null;
    if (Array.isArray(declared)) return { route: declared };
    if (!Array.isArray(declared.route)) return { route: [], malformed: true };
    return declared;
  }

  /* ---------------- the walkthrough ----------------
     Dice that always roll low: every blow the player throws lands and
     every blow thrown at them misses. A route is a proof that the
     PUZZLES can be solved, not that the arithmetic of a fight is
     survivable on a bad night — `test/encounters.js` is where varied
     dice belong. Without this a proof would be flaky, which is worse
     than no proof at all. */
  function luckyDice() { return () => 0.1; }

  /* An encounter suspends ordinary play, so a route that walks into one
     has to fight its way out before the next step means anything. Prefer
     whatever the cartridge put first; never flee, because fleeing leaves
     the route somewhere it did not expect to be. */
  function resolveEncounters(rt, log) {
    let guard = ENCOUNTER_LIMIT;
    while (rt.encounter() && guard-- > 0) {
      const actions = rt.encounter().actions.filter((a) => a.enabled);
      const pick = actions.find((a) => a.kind !== 'escape') || actions[0];
      if (!pick) break;
      const result = rt.encounterAct(pick.id);
      if (log) log.push('  [' + pick.id + '] ' + result.messages.map((m) => m.text).join(' / '));
      if (rt.meta().dead) break;
    }
    return guard > 0;
  }

  function walkthrough(cartridge, options) {
    options = options || {};
    const declared = routeOf(cartridge);
    if (!declared) {
      return { ok: false, declared: false, reason: 'no-walkthrough', log: [] };
    }
    if (declared.malformed) {
      return { ok: false, declared: true, reason: 'malformed', log: [],
        message: 'walkthrough.route must be an array of commands.' };
    }
    if (!ml.runtime) {
      return { ok: false, declared: true, reason: 'no-runtime', log: [],
        message: 'the Machine is not loaded, so nothing can be played.' };
    }

    const log = [];
    const rt = ml.runtime.create(cartridge, { random: options.random || luckyDice() });
    const route = declared.route;

    for (let i = 0; i < route.length; i++) {
      if (!resolveEncounters(rt, log)) {
        return fail(i, route[i], 'an encounter would not end after ' + ENCOUNTER_LIMIT + ' rounds.');
      }
      const before = rt.meta();
      if (before.dead) return fail(i, route[i], 'the player was already dead.');
      if (before.win) break;

      const result = rt.command(route[i]);
      const said = result.messages.map((m) => m.text).join(' / ');
      log.push(route[i] + ' -> ' + said);
      if (!resolveEncounters(rt, log)) {
        return fail(i, route[i], 'an encounter would not end after ' + ENCOUNTER_LIMIT + ' rounds.');
      }
      if (rt.meta().dead) return fail(i, route[i], 'the player died here. ' + said);
    }
    resolveEncounters(rt, log);

    const meta = rt.meta();
    if (meta.dead) return fail(route.length - 1, route[route.length - 1], 'the player died.');
    if (!meta.win) {
      return fail(route.length - 1, route[route.length - 1],
        'the route ran out in ' + (meta.room || 'nowhere') + ' without reaching an ending.');
    }
    /* The route reached AN ending. If the cartridge said which one, and
       what it should be worth, hold it to that: a game that starts
       ending on the wrong note is a regression worth failing on. */
    if (declared.ending && meta.ending !== declared.ending) {
      return fail(route.length - 1, route[route.length - 1],
        'the route ended on "' + meta.ending + '", not the declared "' + declared.ending + '".');
    }
    if (declared.score !== undefined && meta.score !== declared.score) {
      return fail(route.length - 1, route[route.length - 1],
        'the route scored ' + meta.score + ', not the declared ' + declared.score + '.');
    }

    return {
      ok: true, declared: true, log, steps: route.length,
      ending: meta.ending, score: meta.score, turns: meta.turns
    };

    function fail(index, step, message) {
      return {
        ok: false, declared: true, reason: 'failed', log,
        step: index + 1, of: route.length, command: step, message,
        text: 'WALKTHROUGH step ' + (index + 1) + '/' + route.length +
          ' ("' + step + '"): ' + message
      };
    }
  }

  /* ---------------- dead content ----------------
     Static, no simulation. Everything here is a warning: an author
     mid-draft is entitled to prose nothing reaches yet. */

  /* Does rule `a`'s head claim everything rule `b`'s head claims? A slot
     the earlier rule leaves undefined matches anything, which is exactly
     how a broad rule ends up swallowing a specific one written later. */
  function slotCovers(a, b) {
    if (a === undefined) return true;             // earlier rule does not care
    if (b === undefined) return false;            // later rule is the broader one
    const wide = (a === null ? [null] : list(a));
    const narrow = (b === null ? [null] : list(b));
    if (wide.includes('*')) return true;
    return narrow.every((value) => wide.includes(value));
  }

  function headCovers(a, b) {
    return slotCovers(a.verb, b.verb) && slotCovers(a.target, b.target) &&
      slotCovers(a.with, b.with) && a.phrase === undefined;
  }

  function deadContent(cartridge) {
    const findings = [];
    const warn = (code, where, path, message) =>
      findings.push({ severity: 'warning', code, where, path, message, text: where + ': ' + message });

    const world = cartridge.world || {};
    const rooms = world.rooms || {};
    const objects = world.objects || {};
    const rules = cartridge.rules || [];

    /* 1. A rule an earlier rule always claims first. `dispatch` stops at
          the first rule whose head matches and which takes the turn — a
          rule with no `when`, or with an `otherwise`, always takes it. */
    rules.forEach((rule, index) => {
      for (let j = 0; j < index; j++) {
        const earlier = rules[j];
        const alwaysClaims = !earlier.when || !!earlier.otherwise;
        if (!alwaysClaims) continue;
        if (!headCovers(earlier, rule)) continue;
        warn('rule-shadowed', 'RULE ' + (index + 1) + (rule.id ? ' (' + rule.id + ')' : ''),
          'rules[' + index + ']',
          'can never fire: RULE ' + (j + 1) + (earlier.id ? ' (' + earlier.id + ')' : '') +
          ' matches everything this one does and always takes the turn.');
        return;
      }
    });

    /* 2. An object nothing can ever put in the player's way. */
    const produced = new Set(list(world.startInventory));
    for (const id in objects) {
      for (const at of list(objects[id].at)) if (at) produced.add(id);
      for (const child of list(objects[id].contents)) produced.add(child);
    }
    const fromSteps = (steps) => {
      for (const step of list(steps)) {
        if (!step) continue;
        for (const key of ['give', 'take', 'drop']) for (const id of list(step[key])) produced.add(id);
        if (step.placeIn && step.placeIn.object) produced.add(step.placeIn.object);
      }
    };
    for (const rule of rules) { fromSteps(rule.do); fromSteps(rule.otherwise); }
    for (const timer of list((cartridge.profile || {}).timers)) fromSteps(timer.do);
    for (const id in (cartridge.encounters || {})) {
      for (const action of list(cartridge.encounters[id].actions)) fromSteps(action.do);
      for (const hook of ['onWin', 'onFlee', 'onDefeat']) {
        const outcome = cartridge.encounters[id][hook];
        if (outcome && outcome.type === 'rules') fromSteps(outcome.do);
      }
    }
    for (const id in objects) {
      if (!produced.has(id)) {
        warn('object-unproducible', 'OBJECT ' + id, 'world.objects.' + id,
          'starts nowhere and no rule ever gives, drops or places it; the player can never meet it.');
      }
    }

    /* 3. A flag written but never read. Harmless, and usually a rename
          that only got done on one side. */
    const written = new Set(), read = new Set();
    const readWhen = (when) => { for (const flag in ((when || {}).flags || {})) read.add(flag); };
    const writeSteps = (steps) => {
      for (const step of list(steps)) {
        if (!step) continue;
        if (typeof step.set === 'string') written.add(step.set);
        else for (const flag in (step.set || {})) written.add(flag);
        for (const flag of list(step.clear)) written.add(flag);
      }
    };
    for (const rule of rules) { readWhen(rule.when); writeSteps(rule.do); writeSteps(rule.otherwise); }
    for (const timer of list((cartridge.profile || {}).timers)) { readWhen(timer.when); writeSteps(timer.do); }
    for (const ending of list(cartridge.endings)) readWhen(ending.when);
    for (const id in rooms) {
      for (const note of list(rooms[id].notes)) readWhen(note.when);
      for (const dir in (rooms[id].exits || {})) {
        const exit = rooms[id].exits[dir];
        if (exit && typeof exit === 'object') {
          if (exit.flagReq) read.add(exit.flagReq);
          if (exit.flagNot) read.add(exit.flagNot);
        }
      }
    }
    for (const id in (cartridge.encounters || {})) {
      for (const action of list(cartridge.encounters[id].actions)) readWhen(action.when);
    }
    for (const flag of written) {
      if (!read.has(flag)) {
        warn('flag-never-read', 'FLAGS', 'startFlags.' + flag,
          'flag "' + flag + '" is set but nothing ever tests it.');
      }
    }

    /* 4. An ending nothing can fire: no `when` to satisfy and no rule
          that names it. */
    const ended = new Set();
    const endSteps = (steps) => {
      for (const step of list(steps)) {
        if (!step) continue;
        if (step.end) ended.add(step.end);
        if (step.outcome && step.outcome.type === 'end') ended.add(step.outcome.ending);
      }
    };
    for (const rule of rules) { endSteps(rule.do); endSteps(rule.otherwise); }
    for (const timer of list((cartridge.profile || {}).timers)) endSteps(timer.do);
    list(cartridge.endings).forEach((ending, index) => {
      if (ending.when || ended.has(ending.id)) return;
      /* A win ending fires on its own when the treasure system says the
         game is complete, so that one is not orphaned. */
      const treasures = (cartridge.profile || {}).treasures || {};
      if (ending.kind === 'win' && treasures.enabled && treasures.winOnAll !== false) return;
      warn('ending-unfirable', 'ENDING ' + (index + 1) + (ending.id ? ' (' + ending.id + ')' : ''),
        'endings[' + index + ']', 'has no `when` and no rule ends with it, so nothing can fire it.');
    });

    /* 5. An encounter nothing starts. The validator covers the case
          where combat is off entirely; this is the one where combat is
          on and the encounter was simply never wired up. */
    const started = new Set();
    const startSteps = (steps) => {
      for (const step of list(steps)) {
        if (!step) continue;
        if (step.encounter) started.add(step.encounter);
        if (step.outcome && step.outcome.type === 'encounter') started.add(step.outcome.encounter);
      }
    };
    for (const rule of rules) { startSteps(rule.do); startSteps(rule.otherwise); }
    for (const timer of list((cartridge.profile || {}).timers)) startSteps(timer.do);
    const darkFail = ((cartridge.profile || {}).darkness || {}).onFail;
    if (darkFail && darkFail.type === 'encounter') started.add(darkFail.encounter);
    for (const id in (cartridge.encounters || {})) {
      if (!started.has(id)) {
        warn('encounter-never-started', 'ENCOUNTER ' + id, 'encounters.' + id,
          'nothing starts this encounter.');
      }
    }

    return findings;
  }

  /* ---------------- the whole pass ---------------- */
  function run(cartridge, options) {
    options = options || {};
    const route = walkthrough(cartridge, options);
    const findings = deadContent(cartridge);
    /* A missing walkthrough is a warning, not a failure: plenty of
       cartridges are worth building before anyone has written the route
       through them. A DECLARED route that does not work is a failure,
       because it is a claim the cartridge made about itself. */
    if (!route.declared) {
      findings.push({
        severity: 'warning', code: 'no-walkthrough', where: 'WALKTHROUGH', path: 'walkthrough',
        message: 'this cartridge declares no walkthrough, so nothing here proves it can be finished.',
        text: 'WALKTHROUGH: this cartridge declares no walkthrough, so nothing here proves it can be finished.'
      });
    }
    return { ok: route.declared ? route.ok : true, walkthrough: route, findings };
  }

  function report(result) {
    const lines = [];
    const route = result.walkthrough;
    if (!route.declared) {
      lines.push('NOT PROVEN — no walkthrough declared');
    } else if (route.ok) {
      lines.push('WALKTHROUGH PROVED — ' + route.steps + ' steps, ' +
        (route.ending ? 'ending "' + route.ending + '", ' : '') + route.score + ' points');
    } else {
      lines.push('WALKTHROUGH FAILED');
      lines.push('  ' + (route.text || route.message || route.reason));
    }
    const warnings = result.findings.filter((f) => f.severity === 'warning');
    if (warnings.length) {
      lines.push(warnings.length + ' warning' + (warnings.length === 1 ? '' : 's') + ':');
      for (const w of warnings) lines.push('  ' + w.text);
    }
    return lines.join('\n');
  }

  ml.prove = { run, report, walkthrough, deadContent, routeOf, luckyDice, resolveEncounters, ENCOUNTER_LIMIT };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
