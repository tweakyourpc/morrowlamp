/* ============================================================
   THE SUNKEN CROWN — save/load (localStorage), autosave, undo snapshots
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};

  const KEY = 'sunkencrown_v1_';
  const SAVE_VERSION = 2;
  const GAME_ID = 'the-sunken-crown';
  const AUTOSAVE = KEY + 'autosave';
  const SETTINGS = KEY + 'settings';

  function base64UrlEncode(text) {
    const bytes = unescape(encodeURIComponent(text));
    return global.btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64UrlDecode(code) {
    const padded = code.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((code.length + 3) % 4);
    return decodeURIComponent(escape(global.atob(padded)));
  }

  const save = {
    slots: [1, 2, 3],

    /* One state representation, one compatibility boundary.
       Saves written before the shells were consolidated held a legacy
       engine snapshot plus a separate character sheet. Their shape is not
       the Machine's, and restoring one would produce a subtly broken game
       rather than an obvious error, so they are refused by name. Any shell
       that reads a save asks this first. */
    isCurrent(payload) {
      return !!(payload && payload.state && payload.machine);
    },
    staleMessage: 'That save was written by the pre-consolidation engine and cannot be read. Start a new game.',

    /* The payload every shell writes. */
    payload(runtime, cartridgeId) {
      const m = runtime.meta();
      return {
        machine: (global.Z && global.Z.ml && global.Z.ml.VERSION) || '?',
        cartridge: cartridgeId,
        state: runtime.serialize(),
        score: m.score, turns: m.turns, roomName: m.roomName
      };
    },

    write(slot, payload) {
      try {
        const record = Object.assign({}, payload, { saveVersion: SAVE_VERSION, gameId: GAME_ID, savedAt: Date.now() });
        localStorage.setItem(KEY + slot, JSON.stringify(record));
        return true;
      } catch (e) {
        return false;
      }
    },

    read(slot) {
      try {
        const raw = localStorage.getItem(KEY + slot);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    clear(slot) {
      localStorage.removeItem(KEY + slot);
    },

    autosave(payload) {
      try { localStorage.setItem(AUTOSAVE, JSON.stringify(Object.assign({}, payload, { saveVersion: SAVE_VERSION, gameId: GAME_ID }))); } catch (e) { /* ignore */ }
    },

    readAutosave() {
      try {
        const raw = localStorage.getItem(AUTOSAVE);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },

    loadSettings() {
      try {
        const raw = localStorage.getItem(SETTINGS);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },

    saveSettings(settings) {
      try { localStorage.setItem(SETTINGS, JSON.stringify(settings)); } catch (e) { /* ignore */ }
    },

    /* A copyable, self-contained save. It contains only the game and RPG
       state, never browser paths, hidden folders, or implementation metadata. */
    exportCode(payload) {
      return 'SC1-' + base64UrlEncode(JSON.stringify(Object.assign({}, payload, { saveVersion: SAVE_VERSION, gameId: GAME_ID })));
    },

    importCode(code) {
      try {
        const raw = String(code || '').trim().replace(/\s+/g, '');
        if (!raw.startsWith('SC1-')) return null;
        const data = JSON.parse(base64UrlDecode(raw.slice(4)));
        if (!data || typeof data.state !== 'string') return null;
        if (data.gameId && data.gameId !== GAME_ID) return null;
        return data;
      } catch (e) {
        return null;
      }
    },

    slotInfo(slot) {
      const p = save.read(slot);
      if (!p) return null;
      return {
        slot,
        score: p.score,
        turns: p.turns,
        room: p.roomName,
        savedAt: p.savedAt
      };
    }
  };

  Z.save = save;
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
