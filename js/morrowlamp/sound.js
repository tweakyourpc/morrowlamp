/* ============================================================
   MORROWLAMP MACHINE — sound hardware
   Three profiles, all synthesized at runtime. No samples, no
   soundfonts, no files: every note is an oscillator that did not
   exist a moment ago.

     SPEAKER — one square-wave voice, as the PC speaker had. Beeps
               only; no music, because that hardware could not
               really do music and pretending otherwise is a lie.
     CHIP    — the multi-voice chip-style score (js/music.js) plus
               the effect set (js/audio.js). The house default.
     SYNTH   — the same score with softer waveforms and a longer
               tail, for people who bought the expensive card.

   Wiring a cartridge's runtime events to whichever hardware is
   installed happens here, so neither the runtime nor the shell
   needs to know which one it is.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  const PROFILES = {
    speaker: { id: 'speaker', name: 'PC SPEAKER', music: false, effects: true, blurb: 'One voice. It is enough.' },
    chip:    { id: 'chip', name: 'SOUND CHIP', music: true, effects: true, blurb: 'Multi-channel square and triangle.' },
    synth:   { id: 'synth', name: 'SYNTHESIZER', music: true, effects: true, blurb: 'Softer waves, longer tails.' }
  };

  function known(name) { return Object.prototype.hasOwnProperty.call(PROFILES, String(name || '').toLowerCase()); }
  function names() { return Object.keys(PROFILES); }

  function create(options) {
    options = options || {};
    const profile = PROFILES[known(options.profile) ? String(options.profile).toLowerCase() : 'chip'];
    const fx = Z.audio || null;
    const score = profile.music ? (Z.music || null) : null;
    let enabled = options.enabled !== false;

    const api = {
      profile,
      isEnabled: () => enabled,
      setEnabled(v) {
        enabled = !!v;
        if (fx) fx.setEnabled(enabled);
        if (score) score.setEnabled(enabled);
      },
      unlock() {
        if (fx && fx.unlock) fx.unlock();
        if (score && score.unlock) score.unlock();
      },
      /* Effects are named by the cartridge; unknown names are ignored
         rather than thrown, so a cartridge may ask for a sound this
         hardware profile simply does not have. */
      play(name) {
        if (!enabled || !fx) return;
        const fn = fx[name];
        if (typeof fn === 'function') fn();
        else if (typeof fx.blip === 'function') fx.blip();
      },
      music(track) {
        if (!enabled || !score) return;
        if (!track) { score.stop(); return; }
        if (score.current() === track) return;
        if (score.TRACKS && !score.TRACKS[track]) return;
        score.play(track);
      },
      stopMusic() { if (score) score.stop(); },
      duck(ms) { if (score && score.duck) score.duck(ms); },

      /* Subscribe to a runtime so a cartridge's { sound: … } and
         { music: … } rule actions actually make a noise. */
      attach(runtime) {
        runtime.on('sound', (p) => api.play(p.name));
        runtime.on('music', (p) => api.music(p.name));
        runtime.on('win', () => api.play('fanfare'));
        runtime.on('death', () => api.play('sting'));
        runtime.on('secured', () => api.play('chime'));
        return api;
      }
    };

    api.setEnabled(enabled);
    return api;
  }

  ml.sound = { PROFILES, names, known, create };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
