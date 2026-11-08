/* ============================================================
   THE SUNKEN CROWN, REMASTERED — the score
   The same notes as js/music.js, played on a deeper instrument.
   Nothing about the tunes changes: every track keeps its melody,
   harmony, bass line and tempo. What changes is the playing.

     lead     two slightly detuned voices of the original wave
              through a softening filter, vibrato on long notes,
              and a faint octave shimmer that lives only in the
              reverb
     harmony  a chorused pair with a slower attack and a longer
              release, so chords overlap like a held pad
     bass     the sine, plus a touch of octave and warmth
     pad      new, but derived: a filtered root-and-fifth bed
              under every long bass note
     space    per-track stereo reverb (an impulse made here, not
              shipped), a tempo-synced ping-pong echo on the lead,
              and in the caves, water dripping somewhere unseen
     tension  a layer the shell raises when danger is near: a
              heartbeat that quickens, then a high shiver of noise
     outside  no music at all under the open sky: night wind that
              gusts and drops, leaves after a gust, crickets, and
              now and then an owl a long way off

   Still no audio files: every sound is synthesized when it plays.
   Implements the js/music.js interface, so ml.sound can use it in
   place of the chip score.
   ============================================================ */

/* Where each track is heard. verb: reverb length in seconds, wet: how
   much of it, echo: lead echo level, drips: water in the dark, pad: the
   pad's two partials as multiples of the bass note (default octave and
   twelfth). */
const SPACE = {
  title:   { verb: 3.4, wet: 0.34, echo: 0.20 },
  manor:   { verb: 1.9, wet: 0.22, echo: 0.12 },
  under:   { verb: 4.8, wet: 0.42, echo: 0.24, drips: true },
  lake:    { verb: 6.0, wet: 0.46, echo: 0.30, drips: true },
  throne:  { verb: 6.5, wet: 0.50, echo: 0.26, drips: true },
  intrigue: { verb: 2.4, wet: 0.28, echo: 0.16 },
  tension: { verb: 3.2, wet: 0.30, echo: 0.10, drips: true },
  mirrors: { verb: 7.0, wet: 0.55, echo: 0.35, pad: [2, 2.5198] },   // a whole-tone third, not a fifth
  outside: { verb: 2.2, wet: 0.16, echo: 0, night: true },
  combat:  { verb: 1.4, wet: 0.14, echo: 0.06 },
  lullaby: { verb: 3.8, wet: 0.40, echo: 0.22 },
  victory: { verb: 2.6, wet: 0.26, echo: 0.12 }
};
const FALLBACK_SPACE = { verb: 2.5, wet: 0.28, echo: 0.12 };

const LOOKAHEAD = 0.25;   // seconds of audio scheduled ahead, as in js/music.js
const TICK = 40;          // ms between scheduler wakeups
const PAD_MIN = 1.0;      // seconds: bass notes at least this long get a pad
const MASTER = 0.42;   // the extra layers and reverb add about 10 dB; this sits ~3 dB above the chip score

/* Small deterministic generator, so impulses and drips are the same
   every time the game is played. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* A stereo room: a few early reflections, then filtered noise that
   decays 60 dB over `seconds` and darkens as it goes. */
function impulse(ctx, seconds) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const rand = rng(c ? 0x51ed : 0x0bad);
    let y = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      y += (rand() * 2 - 1 - y) * (0.85 - 0.7 * t);
      d[i] = y * Math.exp(-6.9 * t);
    }
    for (let k = 0; k < 6; k++) {
      const at = Math.floor(rate * (0.008 + rand() * 0.07));
      if (at < len) d[at] += (rand() * 2 - 1) * 0.6 * (1 - k / 6);
    }
  }
  return buf;
}

function brownNoise(ctx, seconds, seed) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const rand = rng(seed + c);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + rand() * 2 - 1) * 0.5;
      d[i] = last;
    }
  }
  return buf;
}

/* ---------------- the signal graph ---------------- */

function graph(ctx) {
  const out = ctx.createGain();
  out.gain.value = MASTER;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 3;
  comp.attack.value = 0.01;
  comp.release.value = 0.25;
  out.connect(comp).connect(ctx.destination);

  // Two reverbs, so a change of room can crossfade without a click.
  const verbIn = ctx.createGain();
  const verbs = [0, 1].map(() => {
    const conv = ctx.createConvolver();
    const level = ctx.createGain();
    level.gain.value = 0;
    verbIn.connect(conv).connect(level).connect(out);
    return { conv, level };
  });

  // Ping-pong echo: left tap, right tap, round again a little darker.
  const echoIn = ctx.createGain();
  const left = ctx.createDelay(2);
  const right = ctx.createDelay(2);
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2400;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const merge = ctx.createChannelMerger(2);
  const echoOut = ctx.createGain();
  echoIn.connect(left);
  left.connect(tone).connect(right);
  right.connect(feedback).connect(left);
  left.connect(merge, 0, 0);
  right.connect(merge, 0, 1);
  merge.connect(echoOut);
  echoOut.connect(out);
  echoOut.connect(verbIn);

  function bus(pan, verb, echo) {
    const input = ctx.createGain();
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    input.connect(p).connect(out);
    if (verb) { const s = ctx.createGain(); s.gain.value = verb; p.connect(s).connect(verbIn); }
    if (echo) { const s = ctx.createGain(); s.gain.value = echo; p.connect(s).connect(echoIn); }
    return input;
  }

  return {
    out, verbIn, verbs, echoIn, left, right,
    buses: {
      lead: bus(-0.12, 1.0, 1.0),
      harmony: bus(0.22, 1.0, 0),
      bass: bus(0, 0.2, 0),
      padL: bus(-0.45, 0.9, 0),
      padR: bus(0.45, 0.9, 0),
      shimmer: (() => { const g = ctx.createGain(); g.connect(verbIn); return g; })(),
      air: bus(0, 0.3, 0)
    },
    active: 0,
    space: null,
    impulses: new Map()
  };
}

/* ---------------- instruments ---------------- */

/* One note: `unison` oscillators of `wave`, optionally filtered, under a
   single envelope. Release is a decay after the gate, so tails ring. */
function voice(ctx, dest, wave, f, when, dur, o) {
  const n = o.unison.length;
  const peak = o.gain / Math.sqrt(n);
  const gate = Math.max(0.05, dur * (o.gate || 1));
  const end = when + gate + o.release * 1.5;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(peak, when + o.attack);
  env.gain.setTargetAtTime(peak * o.sustain, when + o.attack, o.decay);
  env.gain.setTargetAtTime(0.0001, when + gate, o.release / 3);
  env.connect(dest);
  let into = env;
  if (o.cutoff) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(o.cutoff * (o.bright || 1), when);
    lp.frequency.setTargetAtTime(o.cutoff, when + 0.01, 0.15);
    lp.connect(env);
    into = lp;
  }
  for (const cents of o.unison) {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(f, when);
    osc.detune.setValueAtTime(cents + (o.drift ? (o.rand() - 0.5) * o.drift : 0), when);
    if (o.vibrato && dur > 0.4) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.2;
      depth.gain.setValueAtTime(0, when);
      depth.gain.linearRampToValueAtTime(o.vibrato, when + Math.min(dur, 0.6));
      lfo.connect(depth).connect(osc.detune);
      lfo.start(when);
      lfo.stop(end);
    }
    osc.connect(into);
    osc.start(when);
    osc.stop(end);
  }
}

const harsh = (wave) => wave === 'square' || wave === 'sawtooth';

/* The arrangement: what each written note becomes. Each call to `note`
   is one layer, named, so a test can check the score is unchanged. */
function arrange(role, chan, f, dur, note, space) {
  if (role === 'lead') {
    note('lead', chan.wave, f, dur, {
      gain: chan.gain * 0.95, attack: 0.012, decay: 0.25, sustain: 0.65, release: 0.32, gate: 0.9,
      unison: [-7, 7], drift: chan.det, vibrato: 9, cutoff: harsh(chan.wave) ? 2600 : 0, bright: 1.8
    });
    note('shimmer', 'sine', f * 2, dur, {
      gain: chan.gain * 0.22, attack: 0.05, decay: 0.4, sustain: 0.7, release: 0.8, unison: [0]
    });
  } else if (role === 'harmony') {
    note('harmony', chan.wave, f, dur, {
      gain: chan.gain * 0.9, attack: dur > 1.2 ? 0.09 : 0.02, decay: 0.4, sustain: 0.8, release: 0.7, gate: 0.95,
      unison: [-6, 6], drift: chan.det, cutoff: harsh(chan.wave) ? 1800 : 0
    });
  } else {
    note('bass', chan.wave, f, dur, {
      gain: chan.gain * 0.85, attack: 0.012, decay: 0.3, sustain: 0.85, release: 0.25, gate: 0.92, unison: [0]
    });
    note('bass', 'triangle', f * 2, dur, {
      gain: chan.gain * 0.12, attack: 0.012, decay: 0.2, sustain: 0.6, release: 0.2, gate: 0.92, unison: [0]
    });
    if (dur >= PAD_MIN) {
      const pad = { gain: chan.gain * 0.16, attack: Math.min(dur * 0.4, 1.2), decay: 1, sustain: 1, release: 1.6,
        unison: [-10, 10], cutoff: 520 };
      const [lo, hi] = space.pad || [2, 3];
      note('padL', 'sawtooth', f * lo, dur, pad);
      note('padR', 'sawtooth', f * hi, dur, pad);
    }
  }
}

const ROLES = ['lead', 'harmony', 'bass'];

/* Tracks only this score has. Outside is a place, not a tune. */
const SOUNDSCAPES = {
  outside: { bpm: 60, amb: { cutoff: 520, gain: 0.045 }, ch: [] }
};

/* ---------------- the player ---------------- */

export function createScore(Z, options) {
  options = options || {};
  const TRACKS = Object.assign({}, Z.music.TRACKS, SOUNDSCAPES);
  const parse = Z.music.parse;
  let ctx = null;
  let g = null;
  let enabled = true;
  let cur = null;
  let timer = null;
  let amb = null;
  let tension = 0;
  let shiver = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    g = graph(ctx);
    return ctx;
  }

  function setSpace(c, gr, id, now) {
    const space = SPACE[id] || FALLBACK_SPACE;
    if (gr.space === space) return space;
    if (!gr.impulses.has(space.verb)) gr.impulses.set(space.verb, impulse(c, space.verb));
    const from = gr.verbs[gr.active];
    gr.active = 1 - gr.active;
    const to = gr.verbs[gr.active];
    to.conv.buffer = gr.impulses.get(space.verb);
    from.level.gain.cancelScheduledValues(now);
    from.level.gain.setTargetAtTime(0, now, 0.4);
    to.level.gain.cancelScheduledValues(now);
    to.level.gain.setTargetAtTime(space.wet, now, 0.4);
    gr.echoIn.gain.setTargetAtTime(space.echo, now, 0.2);
    gr.space = space;
    return space;
  }

  function startAir(c, gr, spec, now) {
    if (!spec) return null;
    const src = c.createBufferSource();
    src.buffer = brownNoise(c, 4, 0xa1);
    src.loop = true;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = spec.cutoff;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(spec.gain, now + 2);
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = spec.gain * 0.4;
    lfo.connect(lfoGain).connect(gain.gain);
    src.connect(filt).connect(gain).connect(gr.buses.air);
    src.start(now);
    lfo.start(now);
    return { src, gain, lfo };
  }

  function stopAir(c) {
    if (!amb) return;
    const { src, gain, lfo } = amb;
    amb = null;
    const t = c.currentTime;
    try {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.6);
      src.stop(t + 0.7);
      lfo.stop(t + 0.7);
    } catch (e) { /* already stopped */ }
  }

  /* A drop of water: a quick falling sine, mostly reverb. */
  function drip(c, gr, when, rand) {
    const osc = c.createOscillator();
    const env = c.createGain();
    const pan = c.createStereoPanner();
    const f = 1500 + rand() * 1500;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, when);
    osc.frequency.exponentialRampToValueAtTime(f * 0.55, when + 0.07);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(0.02, when + 0.003);
    env.gain.setTargetAtTime(0.0001, when + 0.004, 0.03);
    pan.pan.value = (rand() * 2 - 1) * 0.7;
    osc.connect(env).connect(pan);
    pan.connect(gr.out);
    const send = c.createGain();
    send.gain.value = 3;
    pan.connect(send).connect(gr.verbIn);
    osc.start(when);
    osc.stop(when + 0.3);
  }

  function noiseOf(c, gr) {
    if (!gr.noise) gr.noise = brownNoise(c, 3, 0x0d1e);
    return gr.noise;
  }

  /* A burst of filtered noise shaped by an envelope: wind, leaves. */
  function breath(c, gr, when, o) {
    const src = c.createBufferSource();
    src.buffer = noiseOf(c, gr);
    src.loop = true;
    const filt = c.createBiquadFilter();
    filt.type = o.type;
    filt.frequency.setValueAtTime(o.from, when);
    filt.frequency.linearRampToValueAtTime(o.to, when + o.rise);
    const env = c.createGain();
    const pan = c.createStereoPanner();
    pan.pan.setValueAtTime(o.panFrom, when);
    pan.pan.linearRampToValueAtTime(o.panTo, when + o.rise + o.fall);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(o.gain, when + o.rise);
    env.gain.linearRampToValueAtTime(0.0001, when + o.rise + o.fall);
    src.connect(filt).connect(env).connect(pan).connect(gr.buses.air);
    src.start(when, o.offset);
    src.stop(when + o.rise + o.fall + 0.1);
  }

  /* One cricket: three quick pulses of a high sine. */
  function chirp(c, gr, when, rand) {
    const f = 4100 + rand() * 500;
    const pan = c.createStereoPanner();
    pan.pan.value = (rand() * 2 - 1) * 0.8;
    pan.connect(gr.out);
    for (let k = 0; k < 3; k++) {
      const t = when + k * 0.045;
      const osc = c.createOscillator();
      const env = c.createGain();
      osc.frequency.value = f;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.004, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
      osc.connect(env).connect(pan);
      osc.start(t);
      osc.stop(t + 0.04);
    }
  }

  /* Hoo ... hoo-hoo, far away: mostly reverb. */
  function owl(c, gr, when, rand) {
    const pan = c.createStereoPanner();
    pan.pan.value = (rand() * 2 - 1) * 0.6;
    const dry = c.createGain();
    dry.gain.value = 0.35;
    pan.connect(dry).connect(gr.out);
    const send = c.createGain();
    send.gain.value = 1.6;
    pan.connect(send).connect(gr.verbIn);
    const base = 360 + rand() * 40;
    for (const [at, len] of [[0, 0.42], [0.75, 0.18], [1.0, 0.5]]) {
      const t = when + at;
      const osc = c.createOscillator();
      const env = c.createGain();
      osc.frequency.setValueAtTime(base * 1.04, t);
      osc.frequency.exponentialRampToValueAtTime(base * 0.94, t + len);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.016, t + 0.06);
      env.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(env).connect(pan);
      osc.start(t);
      osc.stop(t + len + 0.05);
    }
  }

  function night(c, gr, state, horizon) {
    const r = state.rand;
    const at = (t) => Math.max(t, c.currentTime);
    while (state.nextChirp < horizon) {
      chirp(c, gr, at(state.nextChirp), r);
      state.nextChirp += 0.7 + r() * 1.4;
    }
    while (state.nextGust < horizon) {
      const when = at(state.nextGust);
      const left = r() * 2 - 1;
      breath(c, gr, when, { type: 'bandpass', from: 380, to: 900, rise: 1.6 + r(), fall: 3 + r() * 2,
        gain: 0.03 + r() * 0.03, panFrom: left, panTo: -left * 0.6, offset: r() * 2 });
      breath(c, gr, when + 1.2, { type: 'highpass', from: 2600, to: 3400, rise: 0.4, fall: 1.4,
        gain: 0.01, panFrom: -left * 0.5, panTo: left * 0.3, offset: r() * 2 });
      state.nextGust += 6 + r() * 9;
    }
    while (state.nextOwl < horizon) {
      owl(c, gr, at(state.nextOwl), r);
      state.nextOwl += 16 + r() * 22;
    }
  }

  /* Lub-dub: two low thumps, the second softer. */
  function heartbeat(c, gr, when, level) {
    for (const [at, k] of [[0, 1], [0.22, 0.6]]) {
      const osc = c.createOscillator();
      const env = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(62, when + at);
      osc.frequency.exponentialRampToValueAtTime(38, when + at + 0.12);
      env.gain.setValueAtTime(0.0001, when + at);
      env.gain.exponentialRampToValueAtTime(0.07 * level * k, when + at + 0.01);
      env.gain.setTargetAtTime(0.0001, when + at + 0.02, 0.05);
      osc.connect(env).connect(gr.buses.bass);
      osc.start(when + at);
      osc.stop(when + at + 0.4);
    }
  }

  /* A high shiver of noise, trembling, for when it is very bad. */
  function startShiver(c, gr) {
    const src = c.createBufferSource();
    src.buffer = brownNoise(c, 3, 0x5417);
    src.loop = true;
    const band = c.createBiquadFilter();
    band.type = 'highpass';
    band.frequency.value = 2500;
    const gain = c.createGain();
    gain.gain.value = 0;
    const trem = c.createOscillator();
    const depth = c.createGain();
    trem.frequency.value = 9;
    depth.gain.value = 0;
    trem.connect(depth).connect(gain.gain);
    src.connect(band).connect(gain).connect(gr.buses.harmony);
    src.start();
    trem.start();
    return { src, gain, depth, trem };
  }

  function setTension(level) {
    tension = Math.max(0, Math.min(1, Number(level) || 0));
    if (!ctx || !g) return;
    const want = tension > 0.5 ? (tension - 0.5) * 0.5 : 0;
    if (want > 0 && !shiver) shiver = startShiver(ctx, g);
    if (shiver) {
      const t = ctx.currentTime;
      shiver.gain.gain.setTargetAtTime(want * 0.5, t, 0.8);
      shiver.depth.gain.setTargetAtTime(want * 0.5, t, 0.8);
    }
  }

  function makeState(id, track, start, then) {
    return {
      id, bpm: track.bpm, once: !!track.once, then: then || null,
      space: SPACE[id] || FALLBACK_SPACE,
      chans: track.ch.map((ch, k) => ({
        role: ROLES[Math.min(k, 2)], notes: parse(ch.notes), i: 0, t: start,
        wave: ch.wave, gain: ch.gain, det: ch.det || 0
      })),
      rand: rng(0x5eed),
      nextDrip: start + 1.5,
      nextBeat: start,
      nextChirp: start + 0.5,
      nextGust: start + 3,
      nextOwl: start + 9,
      endsAt: 0
    };
  }

  /* Schedule everything that starts before `horizon`. Returns true when
     a once-through track has played its last note. */
  function scheduleInto(c, gr, state, horizon, onNote) {
    const spb = 60 / state.bpm;
    let allDone = true;
    const play = (layer, wave, f, when, dur, o) => {
      if (onNote) onNote({ layer, wave, f, when, dur });
      o.rand = state.rand;
      voice(c, gr.buses[layer], wave, f, when, dur, o);
    };
    for (const chan of state.chans) {
      while (chan.t < horizon) {
        if (chan.i >= chan.notes.length) {
          if (state.once) break;
          chan.i = 0;
        }
        const [f, beats] = chan.notes[chan.i++];
        const dur = beats * spb;
        const when = Math.max(chan.t, c.currentTime);
        if (f) arrange(chan.role, chan, f, dur, (layer, wave, freq, d, o) => play(layer, wave, freq, when, d, o), state.space);
        chan.t += dur;
      }
      if (chan.i < chan.notes.length || !state.once) allDone = false;
    }
    if (tension > 0.15) {
      while (state.nextBeat < horizon) {
        heartbeat(c, gr, Math.max(state.nextBeat, c.currentTime), tension);
        state.nextBeat += 60 / (58 + 52 * tension);
      }
    } else state.nextBeat = Math.max(state.nextBeat, horizon);
    if (state.space.night) night(c, gr, state, horizon);
    if (state.space.drips) {
      while (state.nextDrip < horizon) {
        drip(c, gr, Math.max(state.nextDrip, c.currentTime), state.rand);
        state.nextDrip += 1.8 + state.rand() * 5;
      }
    }
    return allDone;
  }

  function tick() {
    if (!cur || !ctx) return;
    const done = scheduleInto(ctx, g, cur, ctx.currentTime + LOOKAHEAD, options.onNote);
    if (cur.once && done && ctx.currentTime > cur.endsAt) {
      const next = cur.then;
      stop();
      if (next) play(next);
    }
  }

  function trackLength(state) {
    const spb = 60 / state.bpm;
    return state.chans.reduce((mx, ch) => Math.max(mx, ch.notes.reduce((s, n) => s + n[1], 0) * spb), 0);
  }

  function play(id, opts) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    const track = TRACKS[id];
    if (!track) return;
    if (cur && cur.id === id && !track.once) return;
    stop(true);
    const start = c.currentTime + 0.08;
    cur = makeState(id, track, start, opts && opts.then);
    cur.endsAt = start + trackLength(cur);
    setSpace(c, g, id, c.currentTime);
    const left = 0.75 * 60 / track.bpm;   // a dotted eighth
    g.left.delayTime.setValueAtTime(left, c.currentTime);
    g.right.delayTime.setValueAtTime(left, c.currentTime);
    stopAir(c);
    amb = startAir(c, g, track.amb, c.currentTime);
    tick();
    timer = globalThis.setInterval(tick, TICK);
  }

  function stop(keepAir) {
    if (timer) { globalThis.clearInterval(timer); timer = null; }
    cur = null;
    if (!keepAir && ctx) stopAir(ctx);
  }

  /* Render `seconds` of a track without a speaker, for checking levels
     or listening offline. Resolves to an AudioBuffer. */
  function render(id, seconds, rate) {
    const OAC = globalThis.OfflineAudioContext;
    const track = TRACKS[id];
    if (!OAC || !track) return Promise.reject(new Error('cannot render ' + id));
    const c = new OAC(2, Math.ceil((rate || 44100) * seconds), rate || 44100);
    const gr = graph(c);
    setSpace(c, gr, id, 0);
    const state = makeState(id, track, 0.05, null);
    const beat = 0.75 * 60 / track.bpm;
    gr.left.delayTime.value = beat;
    gr.right.delayTime.value = beat;
    startAir(c, gr, track.amb, 0);
    scheduleInto(c, gr, state, seconds, options.onNote);
    return c.startRendering();
  }

  return {
    unlock() {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume();
    },
    play,
    stop,
    render,
    setTension,
    tension: () => tension,
    current: () => (cur ? cur.id : null),
    isEnabled: () => enabled,
    setEnabled(v) {
      enabled = !!v;
      if (!enabled) stop();
    },
    duck(ms) {
      if (!g || !ctx) return;
      const t = ctx.currentTime;
      g.out.gain.cancelScheduledValues(t);
      g.out.gain.setValueAtTime(g.out.gain.value, t);
      g.out.gain.linearRampToValueAtTime(MASTER * 0.28, t + 0.12);
      g.out.gain.linearRampToValueAtTime(MASTER, t + (ms || 1200) / 1000);
    },
    TRACKS,
    SPACE
  };
}
