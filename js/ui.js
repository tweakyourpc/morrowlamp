/* Morrowlamp page bootstrap. Presentation lives in shell-parser.js. */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};
  const cartridge = (Z.cartridges || {})['the-sunken-crown'];
  if (!cartridge || !ml.shellParser) throw new Error('The parser shell or cartridge is not loaded.');
  Z.ui = ml.shellParser.mount({
    cartridge,
    root: document.getElementById('morrowlamp-app') || document.body
  });
})(typeof window !== 'undefined' ? window : globalThis);
