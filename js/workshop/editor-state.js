/* ============================================================
   MORROWLAMP GAME WORKSHOP — editor state
   Pure history and draft-recovery helpers for the authoring surface.
   Gameplay never sees this module; it only owns snapshots of a cartridge
   while somebody is editing it.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  function clone(value) {
    return ml.clone ? ml.clone(value) : JSON.parse(JSON.stringify(value));
  }

  function create(options) {
    options = options || {};
    const storage = options.storage || null;
    const prefix = options.prefix || 'morrowlamp:draft:';
    let past = [];
    let future = [];
    let saved = null;

    function key(cartridge) {
      return prefix + String(((cartridge || {}).meta || {}).id || 'untitled');
    }

    function begin(cartridge) {
      past = [];
      future = [];
      saved = JSON.stringify(cartridge || null);
    }

    function capture(cartridge) {
      if (!cartridge) return;
      const now = JSON.stringify(cartridge);
      if (!past.length || past[past.length - 1] !== now) past.push(now);
      future = [];
    }

    function changed(cartridge) {
      if (storage && cartridge) {
        try { storage.setItem(key(cartridge), JSON.stringify(clone(cartridge))); } catch (_) { /* optional */ }
      }
    }

    function undo(cartridge) {
      if (!cartridge || !past.length) return null;
      future.push(JSON.stringify(cartridge));
      return JSON.parse(past.pop());
    }

    function redo(cartridge) {
      if (!cartridge || !future.length) return null;
      past.push(JSON.stringify(cartridge));
      return JSON.parse(future.pop());
    }

    function recover(cartridge) {
      if (!storage || !cartridge) return null;
      try {
        const raw = storage.getItem(key(cartridge));
        if (!raw || raw === JSON.stringify(cartridge)) return null;
        return JSON.parse(raw);
      } catch (_) { return null; }
    }

    function discard(cartridge) {
      if (!storage || !cartridge) return;
      try { storage.removeItem(key(cartridge)); } catch (_) { /* optional */ }
    }

    function isDirty(cartridge) {
      return !!cartridge && JSON.stringify(cartridge) !== saved;
    }

    return {
      begin, capture, changed, undo, redo, recover, discard, isDirty,
      canUndo: () => past.length > 0,
      canRedo: () => future.length > 0,
      clone
    };
  }

  ml.editorState = { create };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
