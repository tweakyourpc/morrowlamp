/* ============================================================
   THE SUNKEN CROWN — music
   A tiny multi-channel sequencer in the spirit of the AdLib /
   MT-32-era adventure scores: square lead, pulse harmony,
   sine bass, and a filtered-noise ambience bed. No audio files.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};

  const SEMI = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

  /* "a4" -> 440. "-" is a rest, "_" holds the previous note. */
  function freq(name) {
    const m = /^([a-g])([#b]?)(-?\d)$/.exec(name);
    if (!m) return null;
    let n = SEMI[m[1]];
    if (m[2] === '#') n++;
    if (m[2] === 'b') n--;
    const midi = n + (Number(m[3]) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* "a4 c5:2 - g4" -> [[freq,beats], ...] */
  function parse(str) {
    const out = [];
    for (const tok of String(str).trim().split(/\s+/)) {
      if (!tok) continue;
      const [nm, b] = tok.split(':');
      const beats = b ? parseFloat(b) : 1;
      if (nm === '_') {
        if (out.length) out[out.length - 1][1] += beats;
        continue;
      }
      out.push([nm === '-' ? null : freq(nm), beats]);
    }
    return out;
  }

  /* ---------------- the score ---------------- */
  /* Each track: bpm, an optional ambience bed, and channels.
     Channels loop independently but are written to equal length. */

  const TRACKS = {
    title: {
      bpm: 76, amb: null,
      ch: [
        { wave: 'square', gain: 0.055, det: 4, notes:
          'd5:2 a4:2 f4:2 a4:2 g4:3 f4 e4:4 - :4 ' +
          'd5:2 a4:2 bb4:2 d5:2 c5:3 a4 d4:4 - :4' },
        { wave: 'triangle', gain: 0.05, notes:
          'f4:2 f4:2 d4:2 d4:2 bb3:4 a3:4 - :4 ' +
          'f4:2 f4:2 g4:2 g4:2 e4:4 f4:4 - :4' },
        { wave: 'sine', gain: 0.09, notes:
          'd2:4 bb1:4 g1:4 a1:4 d2:4 bb1:4 a1:4 d2:4' }
      ]
    },

    manor: {
      bpm: 104, amb: null,
      ch: [
        { wave: 'square', gain: 0.045, det: 3, notes:
          'a4 b4 c5 e5 d5 c5 b4 g4 a4 c5 e5 a5 g5:2 e5:2 ' +
          'f5 e5 d5 c5 b4 a4 g#4 b4 a4:4 - :4' },
        { wave: 'square', gain: 0.028, notes:
          '- :8 a3 c4 e4 c4 a3 c4 e4 c4 ' +
          'd4 f4 a4 f4 e4 g#4 b4 g#4 a3:4 - :4' },
        { wave: 'sine', gain: 0.075, notes:
          'a2:2 e2:2 a2:2 e2:2 f2:2 c3:2 f2:2 c3:2 ' +
          'd2:2 a2:2 d2:2 a2:2 e2:2 b2:2 e2:4' }
      ]
    },

    under: {
      bpm: 60, amb: { cutoff: 320, gain: 0.05 },
      ch: [
        { wave: 'triangle', gain: 0.05, det: 6, notes:
          'e4:3 g4 f#4:3 e4 c4:4 d4:4 e4:6 - :2 ' +
          'b3:3 d4 c4:3 b3 a3:4 b3:4 e3:6 - :2' },
        { wave: 'sine', gain: 0.035, notes:
          'b3:8 a3:8 g3:8 b3:8 g3:8 f#3:8 e3:8 - :8' },
        { wave: 'sine', gain: 0.1, notes:
          'e1:8 e1:8 c1:8 d1:8 e1:8 c1:8 a0:8 e1:8' }
      ]
    },

    lake: {
      bpm: 68, amb: { cutoff: 620, gain: 0.045 },
      ch: [
        { wave: 'sine', gain: 0.05, det: 5, notes:
          'd5:2 e5:2 g5:4 f#5:2 e5:2 d5:4 a4:2 b4:2 d5:4 e5:8 ' +
          'b4:2 d5:2 e5:4 d5:2 b4:2 a4:4 g4:2 a4:2 b4:4 d5:8' },
        { wave: 'triangle', gain: 0.03, notes:
          'a4:8 b4:8 f#4:8 a4:8 g4:8 f#4:8 e4:8 g4:8' },
        { wave: 'sine', gain: 0.085, notes:
          'g2:8 d2:8 e2:8 a2:8 g2:8 d2:8 a1:8 d2:8' }
      ]
    },

    throne: {
      bpm: 58, amb: { cutoff: 260, gain: 0.04 },
      ch: [
        { wave: 'square', gain: 0.05, det: 3, notes:
          'd4:4 f4:2 a4:2 d5:6 c5:2 bb4:4 a4:4 g4:6 f4:2 ' +
          'e4:4 g4:2 bb4:2 a4:6 f4:2 d4:8 - :8' },
        { wave: 'triangle', gain: 0.04, notes:
          'a3:8 f3:8 d4:8 bb3:8 c4:8 a3:8 d4:8 a3:8' },
        { wave: 'sine', gain: 0.1, notes:
          'd2:8 bb1:8 f2:8 c2:8 g1:8 d2:8 a1:8 d2:8' }
      ]
    },

    combat: {
      bpm: 148, amb: null,
      ch: [
        { wave: 'sawtooth', gain: 0.045, det: 6, notes:
          'd4 d4 a4 d4 f4 e4 d4 c4 d4 d4 a4 d4 bb4 a4 g4 f4 ' +
          'e4 e4 b4 e4 g4 f4 e4 d4 a4:2 g4 f4 e4:2 d4:2' },
        { wave: 'square', gain: 0.026, notes:
          'a3 - a3 - f3 - e3 - a3 - a3 - d4 - c4 - ' +
          'b3 - b3 - g3 - f3 - e4 - d4 - a3:2 - :2' },
        { wave: 'sine', gain: 0.11, notes:
          'd2:2 d2:2 d2:2 d2:2 bb1:2 bb1:2 c2:2 c2:2 ' +
          'e2:2 e2:2 e2:2 e2:2 a1:2 a1:2 d2:2 d2:2' }
      ]
    },

    /* The lullaby of the Sunken King — the tune on the sheet of
       music, and the one the sentinel has been waiting to hear. */
    lullaby: {
      bpm: 72, amb: null, once: true,
      ch: [
        { wave: 'triangle', gain: 0.07, det: 2, notes:
          'a4:2 c5 b4 a4:2 g4:2 e4:3 g4 a4:4 ' +
          'c5:2 e5 d5 c5:2 b4:2 a4:3 b4 c5:4 ' +
          'e5:2 d5 c5 b4:2 a4:2 g4:3 e4 a4:6 - :2' },
        { wave: 'sine', gain: 0.05, notes:
          'a3:4 e3:4 c4:4 a3:4 e3:4 a3:4 f3:4 g3:4 ' +
          'c4:4 b3:4 a3:4 e3:4 a3:6 - :2' },
        { wave: 'sine', gain: 0.075, notes:
          'a2:8 c3:8 e2:8 a2:8 f2:8 c3:8 g2:8 a2:8 e2:8 a2:8' }
      ]
    },

    victory: {
      bpm: 120, amb: null, once: true,
      ch: [
        { wave: 'square', gain: 0.06, notes:
          'd4 f4 a4 d5:2 a4 d5 f5:4 e5:2 d5:2 a4:2 d5:6' },
        { wave: 'triangle', gain: 0.04, notes:
          'a3 d4 f4 a4:2 f4 a4 d5:4 c5:2 a4:2 f4:2 a4:6' },
        { wave: 'sine', gain: 0.1, notes:
          'd2:4 d2:4 bb1:4 a1:2 d2:8' }
      ]
    }
  };

  /* ---------------- the sequencer ---------------- */

  const music = (function () {
    let ctx = null, master = null;
    let enabled = true;
    let cur = null;            // {id, chans:[{notes,i,t,...}], beat, amb}
    let timer = null;
    let ambNodes = null;
    let noiseBuf = null;

    const LOOKAHEAD = 0.25;    // seconds of audio scheduled in advance
    const TICK = 40;           // ms between scheduler wakeups

    function ensure() {
      if (ctx) return ctx;
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      return ctx;
    }

    function unlock() {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume();
    }

    function makeNoise() {
      if (noiseBuf) return noiseBuf;
      const len = ctx.sampleRate * 2;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        // brown-ish noise reads as air and water, white noise reads as static
        last = (last + Math.random() * 2 - 1) * 0.5;
        d[i] = last;
      }
      return noiseBuf;
    }

    function startAmbience(spec) {
      stopAmbience();
      if (!spec) return;
      const src = ctx.createBufferSource();
      src.buffer = makeNoise();
      src.loop = true;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = spec.cutoff;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(spec.gain, ctx.currentTime + 2);
      // a slow swell, so the cave breathes
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = spec.gain * 0.4;
      lfo.connect(lfoGain).connect(gain.gain);
      src.connect(filt).connect(gain).connect(master);
      src.start();
      lfo.start();
      ambNodes = { src, gain, lfo };
    }

    function stopAmbience() {
      if (!ambNodes) return;
      const { src, gain, lfo } = ambNodes;
      ambNodes = null;
      try {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
        src.stop(ctx.currentTime + 0.7);
        lfo.stop(ctx.currentTime + 0.7);
      } catch (e) { /* already stopped */ }
    }

    function playNote(chan, f, when, dur) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = chan.wave;
      osc.frequency.setValueAtTime(f, when);
      // a touch of detune drift gives the chip lead some warmth
      if (chan.det) osc.detune.setValueAtTime((Math.random() - 0.5) * chan.det, when);
      const peak = chan.gain;
      const gate = Math.max(0.05, dur * 0.88);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(peak, when + 0.015);
      gain.gain.exponentialRampToValueAtTime(peak * 0.6, when + Math.min(gate, 0.18));
      gain.gain.exponentialRampToValueAtTime(0.0001, when + gate);
      osc.connect(gain).connect(master);
      osc.start(when);
      osc.stop(when + gate + 0.03);
    }

    function schedule() {
      if (!cur || !ctx) return;
      const spb = 60 / cur.bpm;
      const horizon = ctx.currentTime + LOOKAHEAD;
      let allDone = true;

      for (const chan of cur.chans) {
        while (chan.t < horizon) {
          if (chan.i >= chan.notes.length) {
            if (cur.once) break;
            chan.i = 0;                 // loop
          }
          const [f, beats] = chan.notes[chan.i++];
          const dur = beats * spb;
          if (f) playNote(chan, f, Math.max(chan.t, ctx.currentTime), dur);
          chan.t += dur;
        }
        if (chan.i < chan.notes.length || !cur.once) allDone = false;
      }

      if (cur.once && allDone && ctx.currentTime > cur.endsAt) {
        const nextUp = cur.then;
        stop();
        if (nextUp) play(nextUp);
      }
    }

    function play(id, opts) {
      if (!enabled) { cur = cur || null; return; }
      const c = ensure();
      if (!c) return;
      if (c.state === 'suspended') c.resume();
      const track = TRACKS[id];
      if (!track) return;
      if (cur && cur.id === id && !track.once) return;   // already playing

      stop(true);
      const start = ctx.currentTime + 0.08;
      cur = {
        id, bpm: track.bpm, once: !!track.once,
        then: (opts && opts.then) || null,
        chans: track.ch.map((c2) => ({
          notes: parse(c2.notes), i: 0, t: start,
          wave: c2.wave, gain: c2.gain, det: c2.det || 0
        })),
        endsAt: 0
      };
      const spb = 60 / track.bpm;
      cur.endsAt = start + cur.chans.reduce(
        (mx, ch) => Math.max(mx, ch.notes.reduce((s, n) => s + n[1], 0) * spb), 0);

      startAmbience(track.amb);
      schedule();
      timer = global.setInterval(schedule, TICK);
    }

    function stop(keepAmb) {
      if (timer) { global.clearInterval(timer); timer = null; }
      cur = null;
      if (!keepAmb) stopAmbience();
    }

    return {
      unlock, play, stop,
      current: () => (cur ? cur.id : null),
      isEnabled: () => enabled,
      setEnabled(v) {
        enabled = !!v;
        if (!enabled) stop();
      },
      /* duck the score under an important line of narration */
      duck(ms) {
        if (!master || !ctx) return;
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0.25, t + 0.12);
        master.gain.linearRampToValueAtTime(0.9, t + (ms || 1200) / 1000);
      },
      TRACKS
    };
  })();

  Z.music = music;
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
