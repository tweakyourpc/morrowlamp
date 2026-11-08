/* ============================================================
   THE SUNKEN CROWN, REMASTERED — the voice
   Every line the runtime prints is looked up by its text key; a
   line in the script is spoken, in order, one after another.

   The player picks the narrator:
     a recorded narrator  clips fetched per room as the player
                          arrives, and the lines that belong
                          everywhere one by one as they are said,
                          so the script is never downloaded at once
     device               the browser's own speech synthesis:
                          nothing to download, quality varies
     off                  subtitles only

   Written words are not the narrator's: the grandmother's note and
   the chroniclers' books are read in their writers' voices (recorded
   that way, or a second device voice), whoever narrates.
   ============================================================ */

const DEVICE = 'device';
const OFF = 'off';
const STORE = 'morrowlamp:remastered:narrator';

function remembered() {
  try { return localStorage.getItem(STORE); } catch (e) { return null; }
}
function remember(id) {
  try { localStorage.setItem(STORE, id); } catch (e) { /* private window: forget it */ }
}

export function createVoice(root, options) {
  const Z = window.Z;
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  let index = { narrators: {}, script: {}, written: {} };
  let lines = {};                // key -> clip entry, for the chosen recorded narrator
  let narrator = OFF;
  const clips = new Map();       // narrator/file -> HTMLAudioElement
  const queue = [];
  let playing = null;            // HTMLAudioElement or a SpeechSynthesisUtterance
  let volume = 0.9;
  let room = null;

  async function load(id) {
    lines = {};
    if (id === DEVICE || id === OFF || !index.narrators[id]) return;
    try {
      const r = await fetch(root + 'voice/' + index.narrators[id].lines);
      lines = r.ok ? await r.json() : {};
    } catch (e) { lines = {}; }
  }

  const ready = fetch(root + 'voice/index.json')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then(async (j) => {
      if (j) index = j;
      const want = remembered() || index.default || DEVICE;
      narrator = choices().some((c) => c.id === want) ? want : (index.default || OFF);
      await load(narrator);
    });

  function choices() {
    const list = Object.entries(index.narrators || {}).map(([id, n]) => ({
      id, label: n.label, blurb: n.blurb, bytes: n.bytes, seconds: n.seconds, kind: 'recorded'
    }));
    if (synth) list.push({ id: DEVICE, label: 'Device voice', blurb: 'Your browser reads aloud. Nothing to download.', kind: 'device' });
    list.push({ id: OFF, label: 'Text only', blurb: 'Subtitles, no speech.', kind: 'off' });
    return list;
  }

  function clip(entry) {
    const src = root + 'voice/' + narrator + '/' + entry.file;
    if (!clips.has(src)) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = src;
      clips.set(src, audio);
    }
    return clips.get(src);
  }

  /* A room's own lines are fetched as the player arrives. The lines
     that belong everywhere (verbs, carried things, the fights) are a
     long list nobody hears all of, so each is fetched when first said. */
  function prefetch(id) {
    room = id;
    for (const entry of Object.values(lines)) {
      if (entry.room === id) clip(entry);
    }
  }

  function deviceVoice() {
    const all = synth.getVoices().filter((v) => /^en/i.test(v.lang));
    return all.find((v) => /en-GB/i.test(v.lang) && v.localService) || all.find((v) => /en-GB/i.test(v.lang)) || all[0] || null;
  }

  /* Someone other than the narrator, for words on paper. */
  function writerVoice() {
    const all = synth.getVoices().filter((v) => /^en/i.test(v.lang));
    const narrating = deviceVoice();
    return all.find((v) => v !== narrating && v.lang === (narrating && narrating.lang)) ||
      all.find((v) => v !== narrating) || narrating;
  }

  /* The same split the voice builder makes: a message that is all
     quotation, or the quotation that ends it after a colon. */
  function writtenParts(text) {
    const t = text.trim();
    if (/^[“"][^”"]+[”"]$/.test(t)) return [{ text: t, written: true }];
    const m = /^(.*:)\s*([“"][^”"]+[”"])\s*$/.exec(t);
    if (m) return [{ text: m[1], written: false }, { text: m[2], written: true }];
    return [{ text: t, written: false }];
  }

  function speakDevice(key, text, onStart, done) {
    const parts = index.written && index.written[key] ? writtenParts(text) : [{ text, written: false }];
    const words = text.split(/\s+/).length;
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part.text);
      const v = part.written ? writerVoice() : deviceVoice();
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = part.written ? 0.88 : 0.95;
      u.pitch = part.written ? 0.9 : 1;
      u.volume = volume;
      if (i === 0) {
        u.onstart = () => {
          if (options.duck) options.duck(words / 2.6 * 1000 + 400);
          if (onStart) onStart();
        };
      }
      if (i === parts.length - 1) { u.onend = done; u.onerror = done; }
      playing = u;
      synth.speak(u);
    });
  }

  function next() {
    if (playing || !queue.length) return;
    const { key, text, onStart, onEnd } = queue.shift();
    const done = () => { playing = null; if (onEnd) onEnd(); next(); };
    if (narrator === DEVICE) { speakDevice(key, text, onStart, done); return; }
    const entry = lines[key];
    const audio = clip(entry);
    playing = audio;
    audio.currentTime = 0;
    audio.volume = volume;
    if (options.duck) options.duck((entry.seconds || 4) * 1000 + 400);
    if (onStart) onStart();
    const finish = () => { audio.onended = audio.onerror = null; done(); };
    audio.onended = finish;
    audio.onerror = finish;
    audio.play().catch(finish);
  }

  function speakable(key) {
    if (narrator === OFF) return false;
    if (narrator === DEVICE) return !!(index.script && index.script[key]);
    return !!lines[key];
  }

  /* Returns true when the line will be spoken. */
  function say(text, hooks) {
    const key = Z.remastered.voiceKey(text);
    if (!speakable(key)) return false;
    queue.push({ key, text, onStart: hooks && hooks.onStart, onEnd: hooks && hooks.onEnd });
    next();
    return true;
  }

  function stop() {
    queue.length = 0;
    if (synth) synth.cancel();
    if (playing && playing.pause) { playing.pause(); playing.onended = playing.onerror = null; }
    playing = null;
  }

  async function setNarrator(id) {
    stop();
    if (!choices().some((c) => c.id === id)) return narrator;
    narrator = id;
    remember(id);
    await load(id);
    if (room) prefetch(room);
    return narrator;
  }

  return {
    ready, say, stop, prefetch, setNarrator, choices,
    narrator: () => narrator,
    has: (text) => speakable(Z.remastered.voiceKey(text)),
    /* Who wrote this line, if it is written words: 'grandmother', ... */
    writerOf: (text) => (index.written && index.written[Z.remastered.voiceKey(text)]) || null,
    isEnabled: () => narrator !== OFF,
    setVolume(v) { volume = v; if (playing) playing.volume = v; },
    count: () => Object.keys(lines).length
  };
}
