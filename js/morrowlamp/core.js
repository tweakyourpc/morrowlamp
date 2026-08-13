/* ============================================================
   MORROWLAMP MACHINE — core
   The smallest shared floor the rest of the Machine stands on:
   a namespace, a deep copy, and an event bus small enough to
   read in one sitting.

   Nothing in js/morrowlamp/ may know anything about any
   particular game. If a line of code here mentions a lantern,
   a crown, or a sentinel, it is in the wrong file.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  /* The Machine's own version. Stamped into every compiled game so a
     recovered adventure can say which engine built it. */
  ml.VERSION = '2.0.0';

  ml.clone = function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  };

  /* Coerce the "string or array" shorthand the cartridge format uses
     everywhere (verb: 'dig' and verb: ['dig','excavate'] are both legal). */
  ml.list = function list(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value.slice() : [value];
  };

  ml.has = function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  };

  /* ---------------- the strings table ----------------
     Any prose slot in a cartridge may hold '@s:some.key' instead of the
     text itself, and the key is looked up in `cartridge.strings`. That
     lets a whole game's writing live in one table, so it can be rewritten
     — or translated, or handed to somebody else entirely — without anyone
     touching a rule, an exit or a puzzle.

     The sigil is deliberately not a bare {brace}: the rule book already
     expands {the target} inside prose and the two must never be able to
     be mistaken for one another.

     A key that does not resolve is a build error the validator raises. If
     one reaches here anyway (a hand-edited cartridge, say) the key itself
     is shown rather than an empty line, because a visible '@s:door.locked'
     in the transcript is a bug somebody will report. */
  const STRING_REF = /^@s:([A-Za-z0-9._-]+)$/;

  ml.strings = {
    REF: STRING_REF,
    /* One value: a string, or a { text, cls } line, or an array of either. */
    resolve: function resolve(value, table) {
      if (!table) return value;
      if (Array.isArray(value)) return value.map((v) => resolve(v, table));
      if (value && typeof value === 'object' && value.text !== undefined) {
        return Object.assign({}, value, { text: resolve(value.text, table) });
      }
      if (typeof value !== 'string') return value;
      const match = STRING_REF.exec(value);
      if (!match) return value;
      return ml.has(table, match[1]) ? table[match[1]] : value;
    }
  };

  /* An event bus. Shells subscribe; the runtime publishes. This is the
     only channel the runtime uses to reach presentation, which is what
     keeps the runtime headless and testable under Node. */
  ml.emitter = function emitter() {
    const handlers = new Map();
    return {
      on(name, fn) {
        if (!handlers.has(name)) handlers.set(name, []);
        handlers.get(name).push(fn);
        return () => {
          const arr = handlers.get(name) || [];
          const i = arr.indexOf(fn);
          if (i >= 0) arr.splice(i, 1);
        };
      },
      emit(name, payload) {
        for (const fn of (handlers.get(name) || []).slice()) {
          try { fn(payload); } catch (err) {
            /* A broken listener must never take the game down with it. */
            if (global.console) global.console.error('morrowlamp listener failed on "' + name + '":', err);
          }
        }
      }
    };
  };

  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
