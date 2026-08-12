/* ============================================================
   MORROWLAMP MACHINE — gameplay profile
   Optional systems, switched on per cartridge. A Morrowlamp game
   is not obliged to have score, treasures, darkness, or a lamp
   that runs out of oil just because the first one did.

   Every feature here defaults to OFF except the turn counter.
   A cartridge opts in; the Machine never assumes.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  const DEFAULTS = {
    turns: true,

    score: {
      enabled: false,
      treasureFound: 0,      // points the first time a treasure is picked up
      treasureSecured: 0,    // points for putting it where it belongs
      ranks: []              // [[threshold, 'Rank Name'], …] ascending
    },

    treasures: {
      enabled: false,
      list: [],              // object ids
      names: {},             // id -> display name for the trophy case
      securedIn: null,       // container id that counts as "secured"
      winOnAll: true         // securing every treasure ends the game
    },

    darkness: {
      enabled: false,
      warning: 'It is pitch black.',
      grace: 1,              // dark turns survived before the dark takes an interest
      /* What happens when the grace runs out. Darkness produces an
         OUTCOME and stops caring — see js/morrowlamp/outcome.js. It does
         not know what an encounter is, let alone what a fight is.
           { type: 'death',     text: […] }
           { type: 'encounter', encounter: 'umbra' }
           { type: 'move',      room: 'prisonCell' }              */
      onFail: { type: 'death', text: ['The dark closes over you.'] },
      /* Presentation may take the danger over entirely. The runtime then
         only reports it. */
      external: false
    },

    light: {
      /* An optional burning light source. Fuel is only consumed in rooms
         that are genuinely dark, which is why this is a gameplay rule and
         not, as it used to be, a detail of the point-and-click shell. */
      fuel: null             // { object, turns, warnings: [[left, text], …], outText, refill: {object, text} }
    },

    hunger: { enabled: false, turns: 0, warning: '', onFail: null },

    /* Character stats and encounters. See js/morrowlamp/stats.js and
       js/morrowlamp/encounter.js for the shape of the configuration. */
    stats: { enabled: false },
    combat: { enabled: false },

    timers: []               // [{ id, after, repeat, when, do }]
  };

  /* Which sections are capabilities: a cartridge may write
        stats: false                  — off, and obviously off
        stats: { list: {…} }          — on, configured
     rather than being forced to spell out `enabled: true` beside
     every option. An explicit `enabled: false` still wins. */
  const CAPABILITIES = ['score', 'treasures', 'darkness', 'hunger', 'stats', 'combat'];

  function mergeSection(base, override) {
    if (base === null || typeof base !== 'object' || Array.isArray(base)) {
      return override === undefined ? base : override;
    }
    const out = Object.assign({}, base);
    for (const key in (override || {})) out[key] = mergeSection(base[key], override[key]);
    return out;
  }

  function normalize(profile) {
    const given = profile || {};
    const p = ml.clone(DEFAULTS);

    for (const key in given) {
      if (CAPABILITIES.includes(key)) continue;
      p[key] = mergeSection(p[key], given[key]);
    }

    for (const key of CAPABILITIES) {
      const value = given[key];
      if (value === undefined) continue;
      if (value === false || value === null) { p[key] = mergeSection(p[key], { enabled: false }); continue; }
      if (value === true) { p[key] = mergeSection(p[key], { enabled: true }); continue; }
      /* An object switches the capability on unless it says otherwise. */
      p[key] = mergeSection(p[key], Object.assign({ enabled: true }, value));
    }

    /* Treasures imply scoring bookkeeping even if no points are awarded. */
    if (p.treasures.enabled && !p.treasures.list.length) p.treasures.enabled = false;

    /* `death: […]` was the old spelling of "what the dark does to you".
       Read it as the death outcome it always meant. */
    p.darkness.onFail = ml.outcome
      ? ml.outcome.normalize(p.darkness.onFail || (given.darkness || {}).death, ['The dark closes over you.'])
      : p.darkness.onFail;

    /* Encounters need somewhere for the player's health to live. */
    if (p.combat.enabled && !p.stats.enabled) p.stats = mergeSection(p.stats, { enabled: true });

    return p;
  }

  function rankFor(profile, score) {
    const ranks = profile.score.ranks || [];
    let name = null;
    for (const [threshold, label] of ranks) if (score >= threshold) name = label;
    return name || (ranks.length ? ranks[0][1] : null);
  }

  ml.profile = { DEFAULTS, normalize, rankFor };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
