/* ============================================================
   THE SUNKEN CROWN — tiny synthesized sound effects (Web Audio, no assets)
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};

  const audio = (function () {
    let ctx = null;
    let enabled = true;

    function ensure() {
      if (ctx) return ctx;
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      return ctx;
    }

    // Called on first user gesture to satisfy autoplay policies.
    function unlock() {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume();
    }

    function tone(freq, dur, type, gainVal, when, slideTo) {
      if (!enabled) return;
      const c = ensure();
      if (!c) return;
      const t0 = c.currentTime + (when || 0);
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(gainVal || 0.12, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }

    return {
      setEnabled(v) { enabled = !!v; },
      isEnabled() { return enabled; },
      unlock,
      // small blip on a successful move
      blip()  { tone(520, 0.06, 'triangle', 0.05); },
      // typing tick (very quiet)
      tick()  { tone(880, 0.02, 'square', 0.012); },
      // chime when treasure/score rises
      chime() { tone(660, 0.09, 'sine', 0.09); tone(990, 0.14, 'sine', 0.08, 0.08); },
      // dull thud on a failed / blocked action
      thud()  { tone(140, 0.14, 'sine', 0.09, 0, 90); },
      // error buzz for unknown commands
      buzz()  { tone(220, 0.12, 'sawtooth', 0.05, 0, 150); },
      // death sting
      sting() { tone(330, 0.5, 'sawtooth', 0.08, 0, 60); tone(196, 0.7, 'sine', 0.09, 0.05, 80); },
      // victory fanfare
      fanfare() {
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
          tone(f, 0.22, 'triangle', 0.1, i * 0.13));
      },
      // publisher splash: low mist, rising lantern tones, final sparkle
      splash() {
        tone(110, 2.4, 'sine', 0.035, 0, 180);
        tone(220, 1.8, 'triangle', 0.035, 1.0, 330);
        [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.34, 'sine', 0.055, 2.7 + i * 0.18));
        tone(1568, 0.55, 'triangle', 0.075, 3.55);
      }
    };
  })();

  Z.audio = audio;
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
