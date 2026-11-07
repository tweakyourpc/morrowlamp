/* Morrowlamp page bootstrap. Presentation lives in shell-canvas.js. */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};
  const cartridge = (Z.cartridges || {})['the-sunken-crown'];
  if (!cartridge || !ml.shellCanvas) throw new Error('The canvas shell or cartridge is not loaded.');
  Z.game = ml.shellCanvas.mount({
    cartridge,
    root: document.getElementById('morrowlamp-app') || document.body
  });
})(typeof window !== 'undefined' ? window : globalThis);
