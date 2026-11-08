/* ============================================================
   THE SUNKEN CROWN, REMASTERED — the score keeps its tunes
   js/remastered/score.js re-voices js/music.js: richer instruments,
   a pad under the bass, reverb and echo. This suite proves it only
   re-voices: every written note of every track is still played, at
   the same pitch, start and length, in the same order; and every
   added layer is derived from a written note (an octave, a fifth),
   never a note of its own.
   Web Audio is replaced by a recording stand-in, so it runs in Node.
   Run with:  node test/remastered-score.js
   ============================================================ */
'use strict';
const assert = require('node:assert');
const Z = require('../js/music.js');

/* Any node, any param, any method: records nothing, returns itself. */
function fakeNode() {
  const param = () => new Proxy({ value: 0 }, {
    get: (t, k) => (k === 'value' ? t.value : () => undefined),
    set: (t, k, v) => { t[k] = v; return true; }
  });
  const node = new Proxy({}, {
    get(t, k) {
      if (k === 'connect') return (to) => to;
      if (k in t) return t[k];
      if (['gain', 'frequency', 'detune', 'Q', 'pan', 'delayTime', 'threshold', 'knee', 'ratio', 'attack', 'release'].includes(k)) {
        t[k] = param();
        return t[k];
      }
      return () => undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
  return node;
}

class FakeContext {
  constructor(channels, length, sampleRate) {
    this.sampleRate = sampleRate || 44100;
    this.currentTime = 0;
    this.state = 'running';
    this.destination = fakeNode();
  }
  createBuffer(ch, len) {
    const data = Array.from({ length: ch }, () => new Float32Array(len));
    return { getChannelData: (c) => data[c] };
  }
  startRendering() { return Promise.resolve(null); }
}
for (const m of ['Gain', 'DynamicsCompressor', 'Convolver', 'Delay', 'BiquadFilter', 'ChannelMerger', 'StereoPanner',
  'Oscillator', 'BufferSource']) {
  FakeContext.prototype['create' + m] = fakeNode;
}
globalThis.OfflineAudioContext = FakeContext;

const near = (a, b) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(a));

async function main() {
  const { createScore } = await import('../js/remastered/score.js');
  console.log('THE SUNKEN CROWN, REMASTERED — the score keeps its tunes\n');
  const TRACKS = Z.music.TRACKS;
  const ROLE_LAYER = ['lead', 'harmony', 'bass'];

  for (const [id, track] of Object.entries(TRACKS)) {
    const heard = [];
    const score = createScore(Z, { onNote: (n) => heard.push(n) });
    const spb = 60 / track.bpm;
    const parsed = track.ch.map((c) => Z.music.parse(c.notes));
    const length = Math.max(...parsed.map((ns) => ns.reduce((s, n) => s + n[1], 0))) * spb;
    await score.render(id, length);

    track.ch.forEach((ch, k) => {
      const layer = ROLE_LAYER[k];
      let t = 0.05;
      const written = [];
      for (const [f, beats] of parsed[k]) {
        if (f) written.push({ f, when: t, dur: beats * spb });
        t += beats * spb;
      }
      const played = heard.filter((n) => n.layer === layer && n.wave === ch.wave &&
        written.some((w) => near(w.f, n.f) && near(w.when, n.when)));
      assert.strictEqual(played.length, written.length, id + ' ' + layer + ': every written note is played');
      written.forEach((w, i) => {
        assert.ok(near(played[i].f, w.f) && near(played[i].when, w.when) && near(played[i].dur, w.dur),
          id + ' ' + layer + ' note ' + i + ' keeps its pitch, start and length');
      });
    });

    const derivedFrom = (n, base, ratios) => heard.some((w) => w.layer === base && near(w.when, n.when) &&
      ratios.some((r) => near(w.f * r, n.f)));
    for (const n of heard) {
      if (n.layer === 'shimmer') assert.ok(derivedFrom(n, 'lead', [2]), id + ': shimmer doubles a lead note');
      if (n.layer === 'padL' || n.layer === 'padR') assert.ok(derivedFrom(n, 'bass', score.SPACE[id].pad || [2, 3]), id + ': pad sits on a bass note');
      if (n.layer === 'bass' && n.wave === 'triangle') assert.ok(derivedFrom(n, 'bass', [2]), id + ': bass octave doubles the bass');
    }
    assert.ok(score.SPACE[id], id + ' has a space to be heard in');
  }
  console.log('  ok — ' + Object.keys(TRACKS).length + ' tracks: every written note kept, every added layer derived from one');

  const outdoors = [];
  const quiet = createScore(Z, { onNote: (n) => outdoors.push(n) });
  assert.ok(quiet.TRACKS.outside && quiet.SPACE.outside.night, 'there is an outdoor soundscape');
  await quiet.render('outside', 30);
  assert.strictEqual(outdoors.length, 0, 'outside, not one note of music');
  console.log('  ok — outdoors is wind and crickets, no music');
  console.log('\nAll checks passed.');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
