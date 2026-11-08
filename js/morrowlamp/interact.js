/* ============================================================
   MORROWLAMP MACHINE — interaction phrasing
   How a pointing interface turns "this verb, on that thing,
   maybe holding this item" into a command the runtime already
   understands. Shared by every graphical shell, so a click means
   the same thing however the room happens to be drawn.

   Nothing here decides what happens. It only phrases requests.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  /* `spot` is { kind: 'exit', dir, walkTo } or { kind: 'object', id }.
     `held` is the inventory item lifted onto the cursor, if any; the
     caller puts it back once the returned action has used it. */
  function commandFor(runtime, presentation, spot, verb, held) {
    if (!spot) return null;
    if (spot.kind === 'exit') return { verb: 'move', text: spot.dir, _walkTo: spot.walkTo };
    const info = runtime.describeObject(spot.id);
    if (!info) return null;

    if (held) {
      if (info.container && info.open) return { verb: 'put', target: held, with: spot.id };
      return { verb: 'use', target: held, with: spot.id };
    }
    switch (verb) {
      case 'look': return { verb: 'examine', target: spot.id };
      case 'talk': {
        const speech = (presentation || {}).speech;
        if (speech && speech.target === spot.id && (!speech.room || speech.room === runtime.meta().room)) {
          return { _speech: speech };
        }
        return { verb: 'talk', target: spot.id };
      }
      case 'hand':
        if (info.takeable && !info.carried) return { verb: 'take', target: spot.id };
        if (info.container) return { verb: info.open ? 'close' : 'open', target: spot.id };
        return { verb: 'push', target: spot.id };
      case 'walk':
      default:
        if (info.container && !info.open) return { verb: 'open', target: spot.id };
        return { verb: 'examine', target: spot.id };
    }
  }

  /* A click on an item in the inventory strip. Holding another item
     uses the two together; Look or Talk examines the item where it is,
     so something picked up before it was looked at can still be read.
     Anything else returns null: the shell lifts the item onto the
     cursor, or puts it back. */
  function commandForItem(id, verb, held) {
    if (held && held !== id) return { verb: 'use', target: held, with: id };
    if (!held && (verb === 'look' || verb === 'talk')) return { verb: 'examine', target: id };
    return null;
  }

  /* Whether an action consumed the held item, so the shell can drop it
     off the cursor. */
  function usesHeld(action, held) {
    return !!(held && action && action.target === held && action.with);
  }

  function exitLabel(cart, dir, check) {
    const name = check.room ? ((cart.world.rooms[check.room] || {}).name || '') : '';
    const dirName = (ml.world.DIR_NAMES[dir] || dir);
    return check.ok && name ? dirName + ' — ' + name : dirName;
  }

  ml.interact = { commandFor, commandForItem, usesHeld, exitLabel };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
