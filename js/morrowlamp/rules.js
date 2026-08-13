/* ============================================================
   MORROWLAMP MACHINE — the rule book
   A small declarative dialect for puzzles. A rule matches on what
   the player just tried (verb / target / with / phrase), checks
   the state of the world (`when`), and performs a short list of
   actions (`do`). If the head matches but `when` does not, the
   optional `otherwise` list explains why.

     { id: 'dig-the-crack',
       verb: 'dig', target: 'crack', with: 'shovel',
       when: { room: 'cellar', carrying: ['shovel'], flags: { tunnelDug: false } },
       do:  [ { set: 'tunnelDug' }, { say: 'The crack opens…' } ],
       otherwise: [ { say: 'You need a shovel.' } ] }

   Rules are tried in order and the first one that resolves wins.
   Anything no rule claims falls through to the Machine's own verbs,
   so a cartridge only has to describe what is unusual about itself.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};
  const list = ml.list;

  /* The closed set of actions. The validator refuses anything not
     named here, which is how a typo becomes a compile error instead
     of a puzzle that silently never fires. */
  const ACTIONS = [
    'say', 'set', 'clear', 'score', 'goto', 'give', 'take', 'drop', 'destroy',
    'placeIn', 'open', 'close', 'unlock', 'lock', 'light', 'douse', 'refuel',
    'sound', 'music', 'die', 'end', 'describe', 'stop',
    /* Optional capabilities. A cartridge that has not switched stats or
       encounters on simply never writes these, and the validator says so
       if it writes them anyway. */
    'encounter', 'train', 'heal', 'hurt', 'outcome', 'award'
  ];

  /* The clauses `when` understands, for the same reason. */
  const CONDITIONS = [
    'room', 'notRoom', 'carrying', 'carryingAny', 'notCarrying', 'present', 'notPresent',
    'flags', 'open', 'lit', 'placed', 'notPlaced', 'visited', 'score', 'turns'
  ];

  const REFS = ['@target', '@with', '@room', '@player'];

  function resolveRef(value, action, ctx) {
    if (typeof value !== 'string' || value.charAt(0) !== '@') return value;
    switch (value) {
      case '@target': return action.target || null;
      case '@with': return action.with || null;
      case '@room': return ctx.state.room;
      case '@player': return 'player';
      default: return value;
    }
  }

  /* Text may carry {the target} style substitutions so one rule can
     answer for a whole family of objects without repeating itself.

     A '@s:' reference is resolved through the cartridge's strings table
     first, so a line kept in that table gets the same substitutions a
     line written inline would — otherwise moving prose into the table
     would quietly change what it says. */
  function expand(text, action, ctx) {
    const table = ctx && ctx.cart && ctx.cart.strings;
    text = ml.strings.resolve(text, table);
    if (Array.isArray(text)) return text.map((one) => expand(one, action, ctx));
    if (typeof text !== 'string') return text;
    return text.replace(/\{(the |a )?(target|with|room)\}/g, (whole, article, which) => {
      const id = which === 'room' ? ctx.state.room : (which === 'target' ? action.target : action.with);
      const name = which === 'room'
        ? ((ctx.world.roomDef(id) || {}).name || id)
        : ((ctx.world.object(id) || {}).name || id);
      if (!name) return whole;
      return (article || '') + name;
    });
  }

  /* ---------------- head matching ---------------- */

  function slotMatches(spec, value) {
    if (spec === undefined) return true;              // rule does not care
    const wanted = spec === null ? [null] : list(spec);
    /* `null` in the list means "this slot may be empty", so
       target: [null, 'lyre'] reads as "play" or "play the lyre". */
    if (!value) return wanted.includes(null);
    return wanted.includes('*') || wanted.includes(value);
  }

  function phraseMatches(spec, text) {
    if (spec === undefined) return true;
    const said = String(text || '').toLowerCase();
    for (const want of list(spec)) {
      if (want instanceof RegExp) { if (want.test(said)) return true; continue; }
      if (said.includes(String(want).toLowerCase())) return true;
    }
    return false;
  }

  function headMatches(rule, action) {
    if (rule.verb !== undefined && !list(rule.verb).includes(action.verb)) return false;
    if (!slotMatches(rule.target, action.target)) return false;
    if (!slotMatches(rule.with, action.with)) return false;
    if (!phraseMatches(rule.phrase, action.text)) return false;
    return true;
  }

  /* ---------------- conditions ---------------- */

  function conditionsHold(when, action, ctx) {
    if (!when) return true;
    const w = ctx.world, S = ctx.state;
    const id = (v) => resolveRef(v, action, ctx);

    if (when.room !== undefined && !list(when.room).map(id).includes(S.room)) return false;
    if (when.notRoom !== undefined && list(when.notRoom).map(id).includes(S.room)) return false;

    for (const item of list(when.carrying)) if (!w.carrying(id(item))) return false;
    /* `carrying` is every one of these; `carryingAny` is at least one —
       "whichever light source you happen to have" cannot be written with
       an AND. */
    if (when.carryingAny !== undefined) {
      const held = list(when.carryingAny).map(id);
      if (!held.some((item) => w.carrying(item))) return false;
    }
    for (const item of list(when.notCarrying)) if (w.carrying(id(item))) return false;
    for (const item of list(when.present)) if (!w.present(id(item))) return false;
    for (const item of list(when.notPresent)) if (w.present(id(item))) return false;

    for (const flag in (when.flags || {})) {
      if (!!S.flags[flag] !== !!when.flags[flag]) return false;
    }
    for (const oid in (when.open || {})) {
      if (w.isOpen(id(oid)) !== !!when.open[oid]) return false;
    }
    for (const oid in (when.lit || {})) {
      if (w.isLit(id(oid)) !== !!when.lit[oid]) return false;
    }
    for (const t of list(when.placed)) if (!S.secured.includes(id(t))) return false;
    for (const t of list(when.notPlaced)) if (S.secured.includes(id(t))) return false;
    for (const r of list(when.visited)) if (!S.visited[id(r)]) return false;

    if (when.score) {
      if (when.score.min !== undefined && S.score < when.score.min) return false;
      if (when.score.max !== undefined && S.score > when.score.max) return false;
    }
    if (when.turns) {
      if (when.turns.min !== undefined && S.turns < when.turns.min) return false;
      if (when.turns.max !== undefined && S.turns > when.turns.max) return false;
    }
    return true;
  }

  /* ---------------- actions ----------------
     `ctx.ops` is supplied by the runtime: the rule book decides what
     should happen, the runtime knows how. Keeping them apart is what
     lets rules be tested without booting a whole game. */

  function perform(steps, action, ctx) {
    let stopped = false;
    for (const step of list(steps)) {
      if (stopped) break;
      const ref = (v) => resolveRef(v, action, ctx);
      for (const key in step) {
        const value = step[key];
        switch (key) {
          case 'say':
            ctx.ops.say(list(value).map((t) => expand(t, action, ctx)), step.cls);
            break;
          case 'set':
            if (typeof value === 'string') ctx.ops.setFlag(value, true);
            else for (const flag in value) ctx.ops.setFlag(flag, value[flag]);
            break;
          case 'clear':
            for (const flag of list(value)) ctx.ops.setFlag(flag, false);
            break;
          case 'score': ctx.ops.score(value, step.reason); break;
          case 'goto': ctx.ops.goto(ref(value)); break;
          case 'give': case 'take': for (const t of list(value)) ctx.ops.give(ref(t)); break;
          case 'drop': for (const t of list(value)) ctx.ops.drop(ref(t)); break;
          case 'destroy': for (const t of list(value)) ctx.ops.destroy(ref(t)); break;
          case 'placeIn': ctx.ops.placeIn(ref(value.object), ref(value.container)); break;
          case 'open': for (const t of list(value)) ctx.ops.setOpen(ref(t), true); break;
          case 'close': for (const t of list(value)) ctx.ops.setOpen(ref(t), false); break;
          case 'unlock': for (const t of list(value)) ctx.ops.setLocked(ref(t), false); break;
          case 'lock': for (const t of list(value)) ctx.ops.setLocked(ref(t), true); break;
          case 'light': for (const t of list(value)) ctx.ops.setLit(ref(t), true); break;
          case 'douse': for (const t of list(value)) ctx.ops.setLit(ref(t), false); break;
          case 'refuel': ctx.ops.refuel(ref(value)); break;
          case 'sound': ctx.ops.sound(value); break;
          case 'music': ctx.ops.music(value); break;
          case 'die': ctx.ops.die(list(value).map((t) => expand(t, action, ctx))); stopped = true; break;
          case 'end': ctx.ops.end(value); stopped = true; break;
          case 'describe': ctx.ops.describe(); break;
          case 'encounter': ctx.ops.encounter(ref(value)); stopped = true; break;
          case 'train': ctx.ops.train(value.stat || value, value.by || 1); break;
          case 'award': ctx.ops.award(value); break;
          case 'heal': ctx.ops.heal(value); break;
          case 'hurt': ctx.ops.hurt(value); break;
          case 'outcome': ml.outcome.apply(value, ctx); stopped = true; break;
          case 'stop': stopped = true; break;
          case 'cls': case 'reason': break;   // modifiers consumed above
          default: break;                      // validator has already complained
        }
      }
    }
    return stopped;
  }

  /* ---------------- dispatch ----------------
     Returns true when a rule took responsibility for the turn. */
  function dispatch(rules, action, ctx) {
    for (const rule of (rules || [])) {
      if (!headMatches(rule, action)) continue;
      if (conditionsHold(rule.when, action, ctx)) {
        ctx.ops.ruleFired(rule.id);
        perform(rule.do, action, ctx);
        return true;
      }
      if (rule.otherwise) {
        ctx.ops.ruleFired(rule.id + ' (otherwise)');
        perform(rule.otherwise, action, ctx);
        return true;
      }
      /* Head matched, `when` failed, nothing to say about it: let a
         later rule or the Machine's default verb have a go. */
    }
    return false;
  }

  /* The runtime refuses verbs aimed at things that are not here. A rule
     may opt out with `reach: 'anywhere'` when it wants to answer for a
     target the player cannot yet reach — fishing a coin out from under
     a grating, for instance, where the coin is deliberately unreachable
     until the puzzle is solved. */
  function reachesAnywhere(rules, action) {
    for (const rule of (rules || [])) {
      if (rule.reach === 'anywhere' && headMatches(rule, action)) return true;
    }
    return false;
  }

  ml.rules = { ACTIONS, CONDITIONS, REFS, dispatch, headMatches, conditionsHold, perform, expand, resolveRef, reachesAnywhere };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
