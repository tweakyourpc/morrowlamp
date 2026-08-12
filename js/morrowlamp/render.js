/* ============================================================
   MORROWLAMP MACHINE — display adapter
   Chooses a renderer profile and hands the cartridge's painters a
   drawing surface. The primitives themselves live in js/gfx.js,
   which is Machine, not game: dithering, palettes, and pixel-safe
   scaling belong to every Morrowlamp title.

   A profile is not a filter over finished art. CGA, EGA and VGA
   hand the painter a different palette and a different dither
   grain, and the painter draws accordingly.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  const PROFILES = {
    cga: { id: 'cga', name: 'CGA', hardware: 'IBM Color Graphics Adapter', colors: 4 },
    ega: { id: 'ega', name: 'EGA', hardware: 'IBM Enhanced Graphics Adapter', colors: 16 },
    vga: { id: 'vga', name: 'VGA', hardware: 'IBM Video Graphics Array', colors: 256 }
  };

  function known(name) { return Object.prototype.hasOwnProperty.call(PROFILES, String(name || '').toLowerCase()); }
  function names() { return Object.keys(PROFILES); }

  /* The art contract a cartridge fulfils. Every method is optional;
     a cartridge with no art at all still runs under the parser shell. */
  function artOf(cartridge) {
    const art = (cartridge.presentation || {}).art || {};
    return {
      scene: art.scene ? art.scene.bind(art) : () => null,
      item: art.item ? art.item.bind(art) : null,
      actor: art.actor ? art.actor.bind(art) : null,
      itemScale: art.itemScale ? art.itemScale.bind(art) : () => 1,
      actorScale: art.actorScale ? art.actorScale.bind(art) : () => 1,
      clampToWalk: art.clampToWalk ? art.clampToWalk.bind(art) : (scene, x, y) => [x, y],
      /* Drawn during an encounter, if the cartridge has a picture of
         whatever is fighting you. Keyed by encounter id; a cartridge with
         no such painter simply fights in prose. */
      opponent: art.opponent ? art.opponent.bind(art) : null,
      palette: art.palette || null,
      music: art.music || null
    };
  }

  function create(canvas, options) {
    options = options || {};
    const profile = known(options.profile) ? String(options.profile).toLowerCase() : 'ega';
    if (!Z.gfx) throw new Error('Morrowlamp display adapter needs js/gfx.js');
    const g = Z.gfx.create(canvas, {
      profile,
      logicalWidth: options.logicalWidth,
      logicalHeight: options.logicalHeight,
      resize: options.resize
    });
    g.adapter = PROFILES[profile];
    return g;
  }

  ml.render = { PROFILES, names, known, create, artOf };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
