/* ============================================================
   THE SUNKEN CROWN, REMASTERED — voice keys
   One spoken line is found by the text the runtime printed. The
   voice builder and the browser must agree on that key exactly, so
   both use this file: Node requires it, the page loads it first.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const rm = Z.remastered = Z.remastered || {};

  function normalize(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  /* FNV-1a, 32 bits, over UTF-16 code units: small, stable, no deps. */
  function voiceKey(text) {
    const s = normalize(text);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  rm.voiceKey = voiceKey;
  rm.normalizeLine = normalize;
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
