/* ============================================================
   MORROWLAMP MACHINE — vocabulary and parsing
   Verb-first parsing over an alias index built from the cartridge,
   with phrasal verbs, fuzzy spelling recovery, and proper
   ambiguity questions.

   Generalized from the original Sunken Crown parser. The grammar
   that used to live in a forty-case switch statement is now a
   table: each verb declares a FORM, and the parser knows how to
   read each form. A cartridge adds verbs by adding rows.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  const DIRECTIONS = {
    n: 'n', north: 'n', s: 's', south: 's', e: 'e', east: 'e', w: 'w', west: 'w',
    u: 'u', up: 'u', d: 'd', down: 'd', ne: 'ne', northeast: 'ne', nw: 'nw', northwest: 'nw',
    se: 'se', southeast: 'se', sw: 'sw', southwest: 'sw', in: 'in', out: 'out'
  };

  /* FORMS
       none      — "look", "inventory"
       target    — "take X", optionally "take X from Y" via `seps`
       text      — "say hello sailor" (raw text is preserved)
       direction — "go north"
       onoff     — "turn off the lantern"
       slot      — "save 2"
     `optional: true` lets a target verb stand alone ("dig", "play"). */
  const CORE_VERBS = {
    move:      { words: ['go', 'walk', 'head', 'travel', 'run'], form: 'direction' },
    look:      { words: ['look', 'l'], form: 'none', at: ['at', 'on', 'in', 'into', 'inside', 'under', 'around'] },
    examine:   { words: ['examine', 'x', 'inspect', 'search', 'study', 'check'], form: 'target', optional: true, prompt: 'Examine what?' },
    take:      { words: ['take', 'get', 'grab', 'pick', 'loot'], form: 'target', seps: ['from', 'out of'], prompt: 'Take what?' },
    drop:      { words: ['drop', 'discard'], form: 'target', prompt: 'Drop what?' },
    put:       { words: ['put', 'place', 'insert'], form: 'target', seps: ['in', 'into', 'onto', 'on'], prompt: 'Put what, where?' },
    inventory: { words: ['inventory', 'i', 'inv'], form: 'none' },
    open:      { words: ['open'], form: 'target', prompt: 'Open what?' },
    close:     { words: ['close', 'shut'], form: 'target', prompt: 'Close what?' },
    lock:      { words: ['lock'], form: 'target', seps: ['with'], prompt: 'Lock what?' },
    unlock:    { words: ['unlock'], form: 'target', seps: ['with'], prompt: 'Unlock what?' },
    read:      { words: ['read', 'peruse'], form: 'target', prompt: 'Read what?' },
    light:     { words: ['light', 'ignite', 'kindle'], form: 'target', seps: ['with'], prompt: 'Light what?' },
    turn:      { words: ['turn'], form: 'onoff', prompt: 'Turn what on or off?' },
    extinguish:{ words: ['extinguish', 'douse', 'snuff'], form: 'target', prompt: 'Extinguish what?', as: 'turn', mode: 'off' },
    use:       { words: ['use', 'apply'], form: 'target', seps: ['on', 'with', 'against', 'using'], prompt: 'Use what?' },
    wait:      { words: ['wait', 'z'], form: 'none' },
    score:     { words: ['score'], form: 'none' },
    help:      { words: ['help', 'h', '?'], form: 'none' },
    save:      { words: ['save'], form: 'slot' },
    load:      { words: ['load', 'restore'], form: 'slot' },
    undo:      { words: ['undo', 'oops'], form: 'none' },
    restart:   { words: ['restart', 'new'], form: 'none' },
    quit:      { words: ['quit', 'q'], form: 'none' },
    clear:     { words: ['clear', 'cls'], form: 'none' },
    version:   { words: ['version', 'credits', 'about'], form: 'none' }
  };

  function norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9\s?]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function stripArticles(s) {
    return (' ' + norm(s) + ' ')
      .replace(/\s(a|an|the|some|my|your|this|that)\s/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = new Array(n + 1), cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      const tmp = prev; prev = cur; cur = tmp;
    }
    return prev[n];
  }

  function create(cartridge, getRoomId) {
    const objects = (cartridge.world || {}).objects || {};
    const rooms = (cartridge.world || {}).rooms || {};
    const vocab = cartridge.vocabulary || {};

    /* Cartridge verbs are merged over the core set, so a game can add
       "dig" or rename "attack" without the Machine knowing why. */
    const VERBS = Object.assign({}, ml.clone(CORE_VERBS));
    for (const canon in (vocab.verbs || {})) {
      VERBS[canon] = Object.assign({ words: [canon], form: 'target', optional: true }, VERBS[canon], vocab.verbs[canon]);
    }

    const verbLookup = {};
    for (const canon in VERBS) {
      verbLookup[canon] = canon;
      for (const w of (VERBS[canon].words || [])) verbLookup[norm(w)] = canon;
    }

    /* ---------- alias index ---------- */
    const aliasIndex = [];
    const seen = new Set();
    for (const id in objects) {
      const o = objects[id];
      for (const word of [o.name].concat(o.aliases || [])) {
        const p = stripArticles(word);
        const key = p + '\u0000' + id;
        /* A name that repeats one of its own aliases must not make an
           object ambiguous with itself. */
        if (p && !seen.has(key)) { seen.add(key); aliasIndex.push({ p, id }); }
      }
    }

    function ambiguity(entries) {
      const names = entries.map((e) => (objects[e.id] || {}).name || e.id);
      return { error: 'Do you mean the ' + names.join(' or the ') + '?' };
    }

    function resolve(phrase) {
      const p = stripArticles(phrase);
      if (!p) return null;

      let hits = aliasIndex.filter((e) => e.p === p);
      if (hits.length === 1) return hits[0].id;
      if (hits.length > 1) return ambiguity(hits);

      let best = [], bestLen = 0;
      for (const e of aliasIndex) {
        if (e.p && p.endsWith(e.p)) {
          if (e.p.length > bestLen) { best = [e]; bestLen = e.p.length; }
          else if (e.p.length === bestLen && bestLen > 0) best.push(e);
        }
      }
      if (best.length === 1) return best[0].id;
      if (best.length > 1) return ambiguity(best);

      if (p.length > 3 && p.endsWith('s')) {
        hits = aliasIndex.filter((e) => e.p === p.slice(0, -1));
        if (hits.length === 1) return hits[0].id;
        if (hits.length > 1) return ambiguity(hits);
      }

      const maxDist = p.length >= 8 ? 2 : (p.length >= 4 ? 1 : 0);
      if (maxDist > 0) {
        let fuzzy = [], bestDist = Infinity;
        for (const e of aliasIndex) {
          const d = levenshtein(p, e.p);
          if (d < bestDist) { fuzzy = [e]; bestDist = d; }
          else if (d === bestDist) fuzzy.push(e);
        }
        if (fuzzy.length === 1 && bestDist <= maxDist) return fuzzy[0].id;
      }
      return null;
    }

    function resolveOr(phrase, prompt) {
      if (!phrase) return { error: prompt };
      const r = resolve(phrase);
      if (r && r.error) return r;
      if (r) return r;
      return { error: 'You don\'t see that here.' };
    }

    /* "go to the kitchen" — a room name naming one of this room's exits. */
    function resolveExitByName(phrase) {
      const p = stripArticles(phrase);
      if (!p) return null;
      const r = rooms[getRoomId()];
      for (const dir in ((r || {}).exits || {})) {
        const e = r.exits[dir];
        const rid = typeof e === 'string' ? e : e && e.room;
        if (rid && rooms[rid] && stripArticles(rooms[rid].name) === p) return dir;
      }
      return null;
    }

    function splitOn(phrase, sep) {
      const i = phrase.indexOf(' ' + sep + ' ');
      if (i < 0) return null;
      return [phrase.slice(0, i).trim(), phrase.slice(i + sep.length + 2).trim()];
    }

    function parse(input) {
      if (!input || !String(input).trim()) return null;
      const raw = norm(input);
      const firstWord = raw.split(' ')[0];

      if (DIRECTIONS[raw]) return { verb: 'move', text: DIRECTIONS[raw] };

      const canon = verbLookup[firstWord];
      if (!canon) return { error: 'I don\'t understand "' + String(input).trim() + '". (Try "help".)' };

      const spec = VERBS[canon];
      const verb = spec.as || canon;
      let phrase = stripArticles(raw.slice(firstWord.length));
      const restRaw = String(input).trim().replace(/^\S+\s*/, '').trim();

      switch (spec.form) {
        case 'none': {
          if (!phrase) return { verb };
          /* "look at the note" quietly becomes an examine. */
          if (spec.at) {
            const stripped = phrase.replace(new RegExp('^(' + spec.at.join('|') + ')\\b'), '').trim();
            if (stripped) {
              const r = resolve(stripped);
              if (r && r.error) return r;
              if (r) return { verb: 'examine', target: r };
            }
          }
          return { verb };
        }

        case 'text':
          if (!restRaw) return { error: spec.prompt || 'Say what?' };
          return { verb, text: restRaw };

        case 'slot':
          return /^[0-9]$/.test(phrase) ? { verb, text: phrase } : { verb };

        case 'direction': {
          if (!phrase) return { verb };
          const p = phrase.replace(/^(to|toward|towards|into)\b/, '').trim();
          if (DIRECTIONS[p]) return { verb, text: DIRECTIONS[p] };
          const dir = resolveExitByName(p);
          if (dir) return { verb, text: dir };
          const r = resolve(p);
          if (r && !r.error) return { verb: 'enter', target: r };
          return { verb };
        }

        case 'onoff': {
          if (!phrase) return { error: spec.prompt };
          let m = /^(on|off)\s+(.+)$/.exec(phrase) || null;
          let mode = null, rest = phrase;
          if (m) { mode = m[1]; rest = m[2]; }
          else {
            m = /^(.+?)\s+(on|off)$/.exec(phrase);
            if (m) { mode = m[2]; rest = m[1]; }
          }
          const r = resolveOr(rest, spec.prompt);
          if (r && r.error) return r;
          return mode ? { verb, target: r, with: mode } : { verb, target: r };
        }

        case 'target':
        default: {
          /* "pick up the key" / "put the key down" */
          if (firstWord === 'pick') {
            if (/^up\b/.test(phrase)) phrase = phrase.replace(/^up\s*/, '');
            else if (/\s+up$/.test(phrase)) phrase = phrase.replace(/\s+up$/, '');
            else return { error: spec.prompt || 'Take what?' };
          }
          if (canon === 'put') {
            const down = /^(.+?)\s+down$/.exec(phrase);
            if (down) {
              const r = resolveOr(down[1], 'Put what?');
              if (r && r.error) return r;
              return { verb: 'drop', target: r };
            }
          }
          if (canon === 'climb' || spec.climb) {
            if (phrase === 'up') return { verb: 'move', text: 'u' };
            if (phrase === 'down') return { verb: 'move', text: 'd' };
            phrase = phrase.replace(/^(up|down)\s+/, '');
          }

          for (const sep of (spec.seps || [])) {
            const sp = splitOn(phrase, sep);
            if (sp) {
              const a = resolveOr(sp[0], spec.prompt);
              if (a && a.error) return a;
              const b = resolveOr(sp[1], spec.prompt2 || 'What do you want to use?');
              if (b && b.error) return b;
              const out = { verb, target: a, with: b };
              if (spec.mode) out.with = spec.mode;
              return out;
            }
          }

          if (!phrase) {
            if (spec.optional) return spec.mode ? { verb, with: spec.mode } : { verb };
            return { error: spec.prompt || 'What?' };
          }

          const r = spec.optional ? resolve(phrase) : resolveOr(phrase, spec.prompt);
          if (r && r.error) return r;
          if (!r) {
            /* An optional-target verb aimed at something unknown: let the
               room name save it ("enter kitchen"), else pass the text on
               so a `phrase` rule can still hear it. */
            const dir = resolveExitByName(phrase);
            if (dir) return { verb: 'move', text: dir };
            return spec.optional ? { verb, text: phrase } : { error: 'You don\'t see that here.' };
          }
          const out = { verb, target: r };
          if (spec.mode) out.with = spec.mode;
          return out;
        }
      }
    }

    return {
      parse, resolve, VERBS, DIRECTIONS,
      verbs: () => Object.keys(VERBS),
      words: () => Object.keys(verbLookup),
      isVerb: (word) => !!verbLookup[norm(word)],
      spec: (canon) => VERBS[canon] || null,
      aliasIndex
    };
  }

  ml.vocabulary = { create, CORE_VERBS, DIRECTIONS, norm, stripArticles, levenshtein };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
