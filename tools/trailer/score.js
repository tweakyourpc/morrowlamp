/* ============================================================
   THE SUNKEN CROWN — the trailer's own score
   One cue, written to the edit in tools/trailer/cut.py: its sections
   change where the film changes, and its hits land on the title
   cards. The melodic beds are new tracks in js/music.js's notation,
   played by the remaster's score engine (js/remastered/score.js);
   the trailer things a game score never needs (braams, impacts,
   risers, drums, the chip-tune glitch at the EGA wake) are
   synthesized here. Still no audio files.

   The times below are where cut.py's EDIT puts each segment once its
   dissolves overlap. Change the edit, change MARKS.
   ============================================================ */

export const MARKS = {
  drowned: 4.4,       // "A KINGDOM DROWNED." (yard, 3.4 + its card offset)
  ega: 11.4,          // the EGA hall
  wake: 13.2,         // pixelize into the rendered hall
  danger: 28.2,       // the Umbra rises
  black: 37.1,        // fade to black before the throne
  reborn: 38.1,       // "A LEGEND REBORN."
  title: 42.7,        // THE SUNKEN CROWN
  features: [48.0, 50.0, 52.0, 54.0],
  end: 55.7,          // the end card
  total: 62.7
};

/* New beds, in the game's key and on its theme (the title's opening
   phrase, D A F A G F E). Each channel is written to the same length. */
export const TRACKS = {
  'tr-open': {
    bpm: 84, amb: { cutoff: 300, gain: 0.03 },
    ch: [
      { wave: 'triangle', gain: 0.05, det: 3, notes: '-:4 d5:2 a4:2 f4:2 a4:2 g4:3 f4' },
      { wave: 'sine', gain: 0.035, notes: '-:2 a3:6 bb3:4 a3:4' },
      { wave: 'sine', gain: 0.09, notes: 'd2:8 bb1:4 a1:4' }
    ]
  },
  'tr-descent': {
    bpm: 66, amb: { cutoff: 260, gain: 0.04 },
    ch: [
      { wave: 'sine', gain: 0.045, det: 3, notes: '-:2 a4:3 f4 e4:4 d4:2 c4:2 d4:2' },
      { wave: 'triangle', gain: 0.03, notes: 'd4:4 c4:4 bb3:4 a3:4' },
      { wave: 'sine', gain: 0.1, notes: 'd2:4 c2:4 bb1:4 a1:4' }
    ]
  },
  'tr-danger': {
    bpm: 132, amb: null,
    ch: [
      { wave: 'sawtooth', gain: 0.04, det: 6, notes: 'a4:2 bb4:2 a4:2 g4:2 a4:4 bb4:2 c5:2 d5:4' },
      { wave: 'square', gain: 0.022, notes: Array(10).fill('d3:0.5 d3:0.5 eb3:0.5 d3:0.5').join(' ') },
      { wave: 'sine', gain: 0.11, notes: Array(10).fill('d1 -').join(' ') }
    ]
  },
  'tr-end': {
    bpm: 60, amb: null,
    ch: [
      { wave: 'triangle', gain: 0.06, det: 2, notes: 'a4:2 d5:6' },
      { wave: 'sine', gain: 0.045, notes: 'f4:2 f4:6' },
      { wave: 'sine', gain: 0.09, notes: 'd2:8' }
    ]
  }
};

export const SPACES = {
  'tr-open': { verb: 4.2, wet: 0.40, echo: 0.24 },
  'tr-descent': { verb: 5.5, wet: 0.46, echo: 0.28, drips: true },
  'tr-danger': { verb: 1.8, wet: 0.18, echo: 0.06 },
  'tr-end': { verb: 5.0, wet: 0.44, echo: 0.22 }
};

/* ---------------- the trailer instruments ---------------- */

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function noise(c, seconds, seed) {
  const buf = c.createBuffer(2, Math.floor(c.sampleRate * seconds), c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const r = seeded(seed + ch);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  }
  return buf;
}

/* A big dark hall: the trailer's hits want more space than any room. */
function hall(c, seconds) {
  const buf = noise(c, seconds, 0x7a11);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0;
    for (let i = 0; i < d.length; i++) {
      const t = i / d.length;
      y += (d[i] - y) * (0.6 - 0.5 * t);
      d[i] = y * Math.exp(-6.9 * t);
    }
  }
  return buf;
}

function envelope(c, dest, when, peak, attack, hold, release) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + attack);
  g.gain.setValueAtTime(peak, when + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + hold + release);
  g.connect(dest);
  return g;
}

/* The boom under a title card: a falling sub, and a burst of dark noise. */
function impact(c, fx, when, size) {
  const sub = c.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(72, when);
  sub.frequency.exponentialRampToValueAtTime(27, when + 1.6);
  sub.connect(envelope(c, fx.dry, when, 0.8 * size, 0.012, 0.05, 2.6));
  sub.start(when);
  sub.stop(when + 3);
  const n = c.createBufferSource();
  n.buffer = fx.noise;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3200, when);
  lp.frequency.exponentialRampToValueAtTime(140, when + 1.1);
  const g = envelope(c, fx.dry, when, 0.32 * size, 0.012, 0.02, 1.3);
  const send = c.createGain();
  send.gain.value = 0.9;
  g.connect(send).connect(fx.verb);
  n.connect(lp).connect(g);
  n.start(when);
  n.stop(when + 1.6);
}

/* The brass "braam": root, fifth and octave on detuned saws, the
   filter opening as it swells and closing as it dies. */
function braam(c, fx, when, dur, root, level) {
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1.2;
  lp.frequency.setValueAtTime(140, when);
  lp.frequency.exponentialRampToValueAtTime(1500, when + 0.45);
  lp.frequency.exponentialRampToValueAtTime(380, when + dur);
  const g = envelope(c, fx.dry, when, level, 0.22, Math.max(0.1, dur - 1.7), 1.5);
  const send = c.createGain();
  send.gain.value = 0.6;
  g.connect(send).connect(fx.verb);
  lp.connect(g);
  for (const mult of [1, 1.5, 2]) {
    for (const cents of [-8, 0, 8]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = root * mult;
      o.detune.value = cents;
      o.connect(lp);
      o.start(when);
      o.stop(when + dur + 0.2);
    }
  }
}

/* Noise climbing to the next hit, cut dead on it. */
function riser(c, fx, from, to, level) {
  const n = c.createBufferSource();
  n.buffer = fx.noise;
  n.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 2.5;
  bp.frequency.setValueAtTime(300, from);
  bp.frequency.exponentialRampToValueAtTime(7000, to);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, from);
  g.gain.exponentialRampToValueAtTime(level, to - 0.09);
  g.gain.linearRampToValueAtTime(0, to);
  const send = c.createGain();
  send.gain.value = 0.5;
  g.connect(fx.dry);
  g.connect(send).connect(fx.verb);
  n.connect(bp).connect(g);
  n.start(from);
  n.stop(to + 0.05);
  const tone = c.createOscillator();
  tone.type = 'sine';
  tone.frequency.setValueAtTime(110, from);
  tone.frequency.exponentialRampToValueAtTime(880, to);
  const tg = c.createGain();
  tg.gain.setValueAtTime(0.0001, from);
  tg.gain.exponentialRampToValueAtTime(level * 0.35, to - 0.09);
  tg.gain.linearRampToValueAtTime(0, to);
  tone.connect(tg).connect(fx.dry);
  tone.start(from);
  tone.stop(to + 0.05);
}

/* A war drum: a thumped sine falling in pitch, and the stick's click. */
function drum(c, fx, when, level) {
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, when);
  o.frequency.exponentialRampToValueAtTime(46, when + 0.2);
  const g = envelope(c, fx.dry, when, level, 0.003, 0.01, 0.55);
  const send = c.createGain();
  send.gain.value = 0.35;
  g.connect(send).connect(fx.verb);
  o.connect(g);
  o.start(when);
  o.stop(when + 0.7);
  const n = c.createBufferSource();
  n.buffer = fx.noise;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1100;
  n.connect(lp).connect(envelope(c, fx.dry, when, level * 0.35, 0.001, 0.005, 0.08));
  n.start(when, (when * 7.3) % 1);
  n.stop(when + 0.12);
}

/* The theme carries on in the 1987 chip voice while the EGA hall is on
   screen, then the picture pixelates and the sound breaks up with it. */
function chip(c, fx, Z, when, bpm, notes) {
  const beat = 60 / bpm;
  let t = when;
  for (const [f, beats] of Z.music.parse(notes)) {
    if (f) {
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      o.connect(envelope(c, fx.dry, t, 0.06, 0.004, beats * beat * 0.85, 0.05));
      o.start(t);
      o.stop(t + beats * beat + 0.1);
    }
    t += beats * beat;
  }
}

function glitch(c, fx, when, seconds) {
  const o = c.createOscillator();
  o.type = 'square';
  const r = seeded(0x61c7);
  for (let t = 0; t < seconds; t += 0.03) o.frequency.setValueAtTime(880 * Math.pow(0.12, t / seconds) * (0.7 + r() * 0.6), when + t);
  o.connect(envelope(c, fx.dry, when, 0.05, 0.005, seconds * 0.6, seconds * 0.4));
  o.start(when);
  o.stop(when + seconds + 0.05);
  const n = c.createBufferSource();
  n.buffer = fx.noise;
  const hp = c.createBiquadFilter();
  hp.type = 'lowpass';
  hp.frequency.setValueAtTime(500, when);
  hp.frequency.exponentialRampToValueAtTime(6000, when + seconds);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.18, when + seconds);
  g.gain.exponentialRampToValueAtTime(0.0001, when + seconds + 0.9);
  const send = c.createGain();
  send.gain.value = 0.8;
  g.connect(fx.dry);
  g.connect(send).connect(fx.verb);
  n.connect(hp).connect(g);
  n.start(when);
  n.stop(when + seconds + 1);
}

/* A rendered bed, placed with a fade in and a fade out. */
function place(c, dest, buffer, when, fadeIn, fadeOutAt, fadeOut, level) {
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(level, when + fadeIn);
  g.gain.setValueAtTime(level, fadeOutAt);
  g.gain.linearRampToValueAtTime(0, fadeOutAt + fadeOut);
  src.connect(g).connect(dest);
  src.start(when);
}

/* The whole cue, as one stereo AudioBuffer. `score` is the remaster's
   score engine with TRACKS and SPACES already added. */
export async function renderTrailerScore(Z, score, rate) {
  const M = MARKS;
  const bed = (id, seconds) => score.render(id, seconds, rate);
  const [open, descent, danger, theme, end] = await Promise.all([
    bed('tr-open', 14), bed('tr-descent', 16), bed('tr-danger', 9.6), bed('title', 14), bed('tr-end', 9)
  ]);

  const c = new OfflineAudioContext(2, Math.ceil(rate * M.total), rate);
  const master = c.createGain();
  master.gain.value = 0.9;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 8;
  comp.ratio.value = 4;
  comp.attack.value = 0.005;
  comp.release.value = 0.3;
  master.connect(comp).connect(c.destination);
  const verb = c.createConvolver();
  verb.buffer = hall(c, 6);
  const wet = c.createGain();
  wet.gain.value = 0.5;
  verb.connect(wet).connect(master);
  const fx = { dry: master, verb, noise: noise(c, 4, 0x5eed) };

  // The beds.
  place(c, master, open, 0, 1.5, M.ega - 0.2, 0.8, 1.0);
  place(c, master, descent, M.wake + 0.5, 1.2, M.danger - 0.9, 0.9, 1.0);
  place(c, master, danger, M.danger, 0.05, M.black - 0.35, 0.3, 1.0);
  place(c, master, theme, M.title, 0.3, M.end - 0.8, 0.8, 1.15);
  place(c, master, end, M.end + 0.3, 0.8, M.total - 3.2, 3.0, 1.0);

  // The opening: a low swell under the logo, a boom for the drowned kingdom.
  braam(c, fx, 0.4, 3.6, 36.71, 0.05);          // D1
  impact(c, fx, M.drowned, 0.7);
  braam(c, fx, M.drowned, 4.0, 36.71, 0.06);

  // EGA: the theme goes on in chip voice, then breaks up into the wake.
  chip(c, fx, Z, M.ega, 84, 'e4:1.5 f4:0.5 a4:0.5 d5:0.5');
  glitch(c, fx, M.wake - 0.1, 1.1);
  impact(c, fx, M.wake + 1.0, 0.45);

  // The descent ends climbing to the Umbra.
  riser(c, fx, M.danger - 3.2, M.danger, 0.22);
  impact(c, fx, M.danger, 1.0);
  braam(c, fx, M.danger, 3.2, 36.71 * Math.pow(2, 1 / 12), 0.07);   // Eb1, the flat second

  // Drums under the danger, quickening into a roll that stops dead at the black.
  const beat = 60 / 132;
  for (let b = 0; b < 16; b++) {
    const t = M.danger + b * beat;
    drum(c, fx, t, [0, 3, 6, 8, 11, 14].includes(b) ? 0.55 : 0.3);
  }
  for (let t = M.danger + 16 * beat, k = 0; t < M.black - 0.12; t += beat / (k < 4 ? 2 : 4), k++) {
    drum(c, fx, t, 0.25 + 0.4 * (t - M.danger - 16 * beat) / (M.black - M.danger - 16 * beat));
  }
  impact(c, fx, M.black - 0.12, 0.6);

  // Out of the black: the reborn boom, a second braam, and the climb to the title.
  impact(c, fx, M.reborn, 0.9);
  braam(c, fx, M.reborn, 3.0, 36.71, 0.08);
  braam(c, fx, M.reborn + 2.3, 2.4, 55.0, 0.07); // A1
  riser(c, fx, M.reborn + 1.6, M.title, 0.25);
  impact(c, fx, M.title, 1.2);
  braam(c, fx, M.title, 6.0, 36.71, 0.09);
  braam(c, fx, M.title, 6.0, 73.42, 0.04);

  // A soft drum on each feature line, then the end card's sting.
  for (const t of M.features) drum(c, fx, t, 0.28);
  impact(c, fx, M.end + 0.4, 0.8);
  braam(c, fx, M.end + 0.4, 5.5, 36.71, 0.06);

  return c.startRendering();
}
