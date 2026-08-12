/* ============================================================
   MORROWLAMP MACHINE — outcomes
   A system that has failed, expired or been triggered says WHAT
   HAPPENS, not WHICH SUBSYSTEM SHOULD RUN.

     darkness.onFail = { type: 'encounter', encounter: 'umbra' }
     darkness.onFail = { type: 'death', text: 'You stumble into the abyss.' }
     darkness.onFail = { type: 'move', room: 'prisonCell' }

   Darkness knows none of those words beyond "outcome". The
   dispatcher below decides what each type means, and only the
   `encounter` type ever reaches the encounter system — which is
   in turn the only thing that knows what combat is.

   Adding a type here is how the seam widens later without
   darkness, hunger or a timer having to change at all.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};
  const list = ml.list;

  const TYPES = ['death', 'encounter', 'move', 'say', 'end', 'rules'];

  /* Older cartridges wrote a bare line of text where an outcome now
     goes. Read that as a death, so the shorthand keeps working. */
  function normalize(value, fallbackText) {
    if (!value) return fallbackText ? { type: 'death', text: list(fallbackText) } : null;
    if (typeof value === 'string' || Array.isArray(value)) return { type: 'death', text: list(value) };
    return value;
  }

  /* `ops` is the runtime's operation table — the same one the rule
     book performs against, so an outcome cannot do anything a rule
     could not have done. */
  function apply(outcome, ctx) {
    const o = normalize(outcome);
    if (!o) return null;
    switch (o.type) {
      case 'death':
        ctx.ops.die(list(o.text));
        return 'death';

      case 'encounter':
        /* The one line in the Machine that connects an outcome to the
           encounter system. Nothing above here knows what happens next. */
        if (ctx.ops.encounter(o.encounter)) return 'encounter';
        /* No such encounter, or encounters are switched off in this
           cartridge: fail safe rather than stranding the player in a
           fight that does not exist. */
        if (o.fallback) return apply(o.fallback, ctx);
        ctx.ops.die(list(o.text || 'Something in the dark takes an interest in you.'));
        return 'death';

      case 'move':
        if (o.text) ctx.ops.say(list(o.text));
        ctx.ops.goto(o.room);
        return 'move';

      case 'say':
        ctx.ops.say(list(o.text), o.cls);
        return 'say';

      case 'end':
        ctx.ops.end(o.ending);
        return 'end';

      case 'rules':
        /* An escape hatch for a cartridge that wants several things at
           once: run a list of ordinary rule actions. */
        ml.rules.perform(o.do, {}, ctx);
        return 'rules';

      default:
        return null;
    }
  }

  ml.outcome = { TYPES, normalize, apply };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
