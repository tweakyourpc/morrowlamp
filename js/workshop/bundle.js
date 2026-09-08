/* ============================================================
   MORROWLAMP GAME WORKSHOP — bundle manifest
   Which source files a compiled adventure actually needs. Kept
   as data so the compiler can be a pure function and the tests
   can read the same list off disk that the browser fetches.

   A cartridge that uses the parser interface does not pay for the
   renderer; a cartridge that brings its own painters does not pay
   for another game's art. That is the difference between a game
   factory and one game with a build script.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  /* The gameplay runtime, in load order. This is the part that decides
     what happens in a game, and every page and every compiled adventure
     loads exactly this list — that is what "one Machine" means. */
  const RUNTIME = [
    'js/morrowlamp/core.js',
    'js/morrowlamp/world.js',
    'js/morrowlamp/profile.js',
    'js/morrowlamp/outcome.js',
    'js/morrowlamp/rules.js',
    'js/morrowlamp/vocabulary.js',
    'js/morrowlamp/stats.js',
    'js/morrowlamp/encounter.js',
    'js/morrowlamp/runtime.js'
  ];

  /* Everything a compiled adventure needs from the Machine: the runtime
     plus the sound-hardware adapter its shell drives. The hand-written
     pages drive js/audio.js and js/music.js directly instead, which is a
     presentation choice and changes no gameplay. */
  const MACHINE = RUNTIME.concat(['js/morrowlamp/sound.js']);

  /* Rendering primitives, needed only by the canvas interface. */
  const RENDERER = [
    'js/gfx.js',
    'js/morrowlamp/scene.js',
    'js/morrowlamp/render.js'
  ];

  const SHELLS = {
    canvas: RENDERER.concat(['js/morrowlamp/shell-canvas.js']),
    parser: ['js/morrowlamp/shell-parser.js']
  };

  /* Synthesized sound. `speaker` still wants the effect set; only the
     music-capable profiles pay for the sequencer. */
  const AUDIO = {
    speaker: ['js/audio.js'],
    chip: ['js/audio.js', 'js/music.js'],
    synth: ['js/audio.js', 'js/music.js']
  };

  /* Files a particular cartridge needs alongside the Machine. These are
     that game's content, not the engine's: The Sunken Crown's prose,
     scene painters and sprite library live here, and Captain Thistle's
     list is empty because it draws itself. */
  const CARTRIDGE_FILES = {
    'the-sunken-crown': {
      content: ['js/world.js', 'js/gfx.js', 'js/sprites.js', 'js/scenes.js'],
      cartridge: 'js/cartridges/sunken-crown.js'
    },
    'captains-thistle': {
      content: [],
      cartridge: 'js/cartridges/captains-thistle.js'
    },
    'sir-crumbly': {
      content: [],
      cartridge: 'js/cartridges/sir-crumbly.js'
    },
    'ringling-helpdesk': {
      content: [],
      cartridge: 'js/cartridges/ringling-helpdesk.js'
    }
  };

  /* Resolve the whole ordered file list for one cartridge, with no
     duplicates: gfx.js is both a renderer primitive and something the
     Sunken Crown painters need, and must still appear exactly once. */
  function filesFor(cartridge) {
    const meta = cartridge.meta || {};
    const presentation = cartridge.presentation || {};
    const shell = SHELLS[presentation.interface] ? presentation.interface : 'parser';
    const audio = AUDIO[presentation.audio] ? presentation.audio : 'chip';
    const extra = CARTRIDGE_FILES[meta.id] || { content: [], cartridge: null };

    const ordered = []
      .concat(MACHINE)
      .concat(SHELLS[shell])
      .concat(AUDIO[audio])
      .concat(extra.content);

    const seen = new Set();
    const machine = [];
    for (const file of ordered) {
      if (seen.has(file)) continue;
      seen.add(file);
      machine.push(file);
    }
    return { machine, cartridgeFile: extra.cartridge, shell, audio };
  }

  /* Everything any cartridge could need — what the Workshop preloads. */
  function allFiles() {
    const seen = new Set();
    const out = [];
    const add = (file) => { if (!seen.has(file)) { seen.add(file); out.push(file); } };
    MACHINE.forEach(add);
    RENDERER.forEach(add);
    Object.keys(SHELLS).forEach((k) => SHELLS[k].forEach(add));
    Object.keys(AUDIO).forEach((k) => AUDIO[k].forEach(add));
    for (const id in CARTRIDGE_FILES) {
      CARTRIDGE_FILES[id].content.forEach(add);
      if (CARTRIDGE_FILES[id].cartridge) add(CARTRIDGE_FILES[id].cartridge);
    }
    return out;
  }

  ml.bundle = { RUNTIME, MACHINE, RENDERER, SHELLS, AUDIO, CARTRIDGE_FILES, filesFor, allFiles };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
