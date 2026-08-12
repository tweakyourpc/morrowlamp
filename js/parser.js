/* ============================================================
   THE SUNKEN CROWN — command parser
   Verb-first parsing over a hand-rolled alias index, with
   phrasal verbs (turn off, use X on Y, pick up…), fuzzy
   spelling recovery, and Zork-style ambiguity messages.
   Pure logic: no DOM access, so it can run under Node for tests.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const world = Z.world;
  const engine = Z.engine;

  /* ---------------- normalization ---------------- */

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // remove filler words: "the brass key" -> "brass key"
  function stripArticles(s) {
    return (' ' + norm(s) + ' ')
      .replace(/\s(a|an|the|some|my|your|this|that)\s/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const normalizePhrase = (s) => stripArticles(s);

  /* ---------------- vocabulary ---------------- */

  const DIRECTIONS = {
    n: 'n', north: 'n',
    s: 's', south: 's',
    e: 'e', east: 'e',
    w: 'w', west: 'w',
    u: 'u', up: 'u',
    d: 'd', down: 'd'
  };

  // canonical verb -> aliases (canonical is always a key too)
  const VERBS = {
    move: ['go', 'walk', 'head', 'travel', 'run'],
    look: ['look', 'l'],
    examine: ['examine', 'x', 'inspect', 'search', 'study', 'check'],
    take: ['take', 'get', 'grab', 'pick', 'loot'],
    drop: ['drop', 'leave', 'discard'],
    put: ['put', 'place', 'insert', 'set'],
    inventory: ['inventory', 'i', 'inv'],
    open: ['open'],
    close: ['close', 'shut'],
    lock: ['lock'],
    unlock: ['unlock'],
    read: ['read', 'peruse'],
    light: ['light', 'ignite', 'kindle'],
    turn: ['turn'],
    extinguish: ['extinguish', 'douse', 'blow'],
    dig: ['dig'],
    fix: ['fix', 'repair', 'mend', 'patch'],
    row: ['row', 'sail', 'paddle'],
    play: ['play', 'strum'],
    sing: ['sing', 'hum'],
    say: ['say', 'whisper', 'shout', 'speak', 'answer', 'tell', 'chant'],
    push: ['push', 'press'],
    pull: ['pull', 'tug'],
    throw: ['throw', 'toss', 'hurl', 'fling'],
    use: ['use', 'apply'],
    eat: ['eat', 'taste', 'munch'],
    drink: ['drink', 'sip'],
    climb: ['climb'],
    enter: ['enter'],
    jump: ['jump', 'leap'],
    wait: ['wait', 'z', 'sleep'],
    talk: ['talk', 'greet', 'hail'],
    attack: ['attack', 'kill', 'fight', 'hit', 'swing'],
    give: ['give', 'offer'],
    smell: ['smell', 'sniff'],
    listen: ['listen', 'hear'],
    help: ['help', 'h'],
    score: ['score'],
    save: ['save'],
    load: ['load'],
    restart: ['restart', 'new'],
    undo: ['undo'],
    quit: ['quit', 'q'],
    clear: ['clear', 'cls'],
    version: ['version', 'credits', 'about']
  };

  const verbLookup = {};
  for (const canon in VERBS) {
    verbLookup[canon] = canon;
    for (const a of VERBS[canon]) verbLookup[a] = canon;
  }

  /* ---------------- object alias index ---------------- */

  const aliasIndex = [];   // {p, id}
  const seenAlias = new Set();
  for (const id in world.objects) {
    const o = world.objects[id];
    const words = [o.name].concat(o.aliases || []);
    for (const w of words) {
      const p = normalizePhrase(w);
      // de-duplicate per object: a name that repeats an alias must not
      // make an object match itself twice and fake an ambiguity
      if (p && !seenAlias.has(p + '\u0000' + id)) {
        seenAlias.add(p + '\u0000' + id);
        aliasIndex.push({ p, id });
      }
    }
  }

  function ambiguityError(entries) {
    const names = entries.map(e => world.objects[e.id].name);
    return { error: 'Do you mean the ' + names.join(' or the ') + '?' };
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = new Array(n + 1);
    let cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      const tmp = prev; prev = cur; cur = tmp;
    }
    return prev[n];
  }

  // Resolve a noun phrase to an object id, or return {error}.
  // Returns null when the phrase is empty.
  function resolve(phrase) {
    if (!phrase) return null;
    const p = normalizePhrase(phrase);
    if (!p) return null;

    // (a) exact alias-phrase match
    let hits = aliasIndex.filter(e => e.p === p);
    if (hits.length === 1) return hits[0].id;
    if (hits.length > 1) return ambiguityError(hits);

    // (b) longest suffix match ("into the well" -> "well")
    let best = [];
    let bestLen = 0;
    for (const e of aliasIndex) {
      if (e.p && p.endsWith(e.p)) {
        if (e.p.length > bestLen) { best = [e]; bestLen = e.p.length; }
        else if (e.p.length === bestLen && bestLen > 0) best.push(e);
      }
    }
    if (best.length === 1) return best[0].id;
    if (best.length > 1) return ambiguityError(best);

    // (c) singularize ("keys" -> "key")
    if (p.length > 3 && p.endsWith('s')) {
      const sing = p.slice(0, -1);
      hits = aliasIndex.filter(e => e.p === sing);
      if (hits.length === 1) return hits[0].id;
      if (hits.length > 1) return ambiguityError(hits);
    }

    // (d) fuzzy spelling recovery
    const maxDist = p.length >= 8 ? 2 : (p.length >= 4 ? 1 : 0);
    if (maxDist > 0) {
      let fuzzy = [];
      let bestDist = Infinity;
      for (const e of aliasIndex) {
        const d = levenshtein(p, e.p);
        if (d < bestDist) { fuzzy = [e]; bestDist = d; }
        else if (d === bestDist) fuzzy.push(e);
      }
      if (fuzzy.length === 1 && bestDist <= maxDist) return fuzzy[0].id;
    }
    return null;
  }

  // Resolve a phrase to an exit direction of the current room.
  function resolveRoom(phrase) {
    const p = normalizePhrase(phrase);
    if (!p) return null;
    const r = world.rooms[engine.currentRoom()];
    if (!r || !r.exits) return null;
    for (const dir in r.exits) {
      const e = r.exits[dir];
      const rid = typeof e === 'string' ? e : e.room;
      if (!rid) continue;
      const target = world.rooms[rid];
      if (target && normalizePhrase(target.name) === p) return dir;
    }
    return null;
  }

  function resolveOr(phrase, what) {
    if (!phrase) return { error: what };
    const r = resolve(phrase);
    if (r && r.error) return r;
    if (r) return r;
    return { error: 'You don\'t see that here.' };
  }

  // split "a on b" at the separator word, first occurrence only
  function splitOn(phrase, sep) {
    const i = phrase.indexOf(' ' + sep + ' ');
    if (i < 0) return null;
    return [phrase.slice(0, i).trim(), phrase.slice(i + sep.length + 2).trim()];
  }

  /* ---------------- the parser ---------------- */

  function parse(input) {
    if (!input || !input.trim()) return null;

    const raw = norm(input);
    const firstWord = raw.split(' ')[0];

    // bare compass words
    if (DIRECTIONS[raw]) return { verb: 'move', text: DIRECTIONS[raw] };

    const canon = verbLookup[firstWord];
    if (!canon) return { error: 'I don\'t understand "' + input.trim() + '". (Try "help".)' };

    const phrase = normalizePhrase(raw.slice(firstWord.length));
    const restRaw = input.trim().replace(/^\S+\s*/, '');

    switch (canon) {
      case 'say': {
        if (!restRaw) return { error: 'Say what?' };
        return { verb: 'say', text: restRaw.trim() };
      }

      case 'move': {
        if (!phrase) return { verb: 'move' };
        let p = phrase.replace(/^(to|toward|towards)\b/, '').trim();
        if (DIRECTIONS[p]) return { verb: 'move', text: DIRECTIONS[p] };
        const dir = resolveRoom(p);
        if (dir) return { verb: 'move', text: dir };
        return { verb: 'move' };
      }

      case 'look': {
        if (!phrase) return { verb: 'look' };
        const p = phrase.replace(/^(at|on|in|into|inside|under|around)\b/, '').trim();
        if (!p) return { verb: 'look' };
        const r = resolve(p);
        if (r && r.error) return r;
        if (r) return { verb: 'examine', target: r };
        return { verb: 'look' };
      }

      case 'examine': {
        if (!phrase) return { verb: 'look' };
        const r = resolveOr(phrase, 'You don\'t see that here.');
        if (r && r.error) return r;
        return { verb: 'examine', target: r };
      }

      case 'take': {
        if (!phrase) return { error: 'Take what?' };
        if (firstWord === 'pick') {
          let p = phrase;
          if (/^up\b/.test(p)) p = p.replace(/^up\s*/, '');
          else if (/\s+up$/.test(p)) p = p.replace(/\s+up$/, '');
          else return { error: 'Take what?' };
          const r = resolveOr(p, 'Take what?');
          if (r && r.error) return r;
          return { verb: 'take', target: r };
        }
        const sp = splitOn(phrase, 'from');
        if (sp) {
          const r = resolveOr(sp[0], 'Take what?');
          if (r && r.error) return r;
          const f = resolveOr(sp[1], 'Take it from what?');
          if (f && f.error) return f;
          return { verb: 'take', target: r, with: f };
        }
        const r = resolveOr(phrase, 'Take what?');
        if (r && r.error) return r;
        return { verb: 'take', target: r };
      }

      case 'drop': {
        const r = resolveOr(phrase, 'Drop what?');
        if (r && r.error) return r;
        return { verb: 'drop', target: r };
      }

      case 'put': {
        if (!phrase) return { error: 'Put what, where?' };
        const dm = /^(.+?)\s+down$/.exec(phrase);
        if (dm) {
          const r = resolveOr(dm[1], 'Put what?');
          if (r && r.error) return r;
          return { verb: 'drop', target: r };
        }
        for (const sep of ['in', 'into', 'onto', 'on']) {
          const sp = splitOn(phrase, sep);
          if (sp) {
            const r = resolveOr(sp[0], 'Put what?');
            if (r && r.error) return r;
            const c = resolveOr(sp[1], 'Put it where?');
            if (c && c.error) return c;
            return { verb: 'put', target: r, with: c };
          }
        }
        const r = resolveOr(phrase, 'Put what, where?');
        if (r && r.error) return r;
        return { verb: 'put', target: r };
      }

      case 'open': {
        const r = resolveOr(phrase, 'Open what?');
        if (r && r.error) return r;
        return { verb: 'open', target: r };
      }
      case 'close': {
        const r = resolveOr(phrase, 'Close what?');
        if (r && r.error) return r;
        return { verb: 'close', target: r };
      }
      case 'lock': {
        const r = resolveOr(phrase, 'Lock what?');
        if (r && r.error) return r;
        return { verb: 'lock', target: r };
      }
      case 'unlock': {
        if (!phrase) return { error: 'Unlock what?' };
        const sp = splitOn(phrase, 'with');
        if (sp) {
          const r = resolveOr(sp[0], 'Unlock what?');
          if (r && r.error) return r;
          const k = resolveOr(sp[1], 'Unlock it with what?');
          if (k && k.error) return k;
          return { verb: 'unlock', target: r, with: k };
        }
        const r = resolveOr(phrase, 'Unlock what?');
        if (r && r.error) return r;
        return { verb: 'unlock', target: r };
      }

      case 'read': {
        const r = resolveOr(phrase, 'Read what?');
        if (r && r.error) return r;
        return { verb: 'read', target: r };
      }

      case 'light': {
        const r = resolveOr(phrase, 'Light what?');
        if (r && r.error) return r;
        return { verb: 'light', target: r };
      }

      case 'turn': {
        if (!phrase) return { error: 'Turn what on or off?' };
        let m = /^(on|off)\s+(.+)$/.exec(phrase);
        if (m) {
          const r = resolveOr(m[2], 'Turn what on or off?');
          if (r && r.error) return r;
          return { verb: 'turn', target: r, with: m[1] };
        }
        m = /^(.+?)\s+(on|off)$/.exec(phrase);
        if (m) {
          const r = resolveOr(m[1], 'Turn what on or off?');
          if (r && r.error) return r;
          return { verb: 'turn', target: r, with: m[2] };
        }
        const r = resolveOr(phrase, 'Turn what on or off?');
        if (r && r.error) return r;
        return { verb: 'turn', target: r };
      }

      case 'extinguish': {
        const p = phrase.replace(/^out\s+/, '');
        if (!p) return { error: 'Extinguish what?' };
        const r = resolveOr(p, 'Extinguish what?');
        if (r && r.error) return r;
        return { verb: 'turn', target: r, with: 'off' };
      }

      case 'dig': {
        return { verb: 'dig', target: resolve(phrase) || null };
      }

      case 'fix': {
        const r = resolveOr(phrase, 'Fix what?');
        if (r && r.error) return r;
        return { verb: 'fix', target: r };
      }

      case 'use': {
        if (!phrase) return { error: 'Use what?' };
        for (const sep of ['on', 'with', 'against', 'using']) {
          const sp = splitOn(phrase, sep);
          if (sp) {
            const r = resolveOr(sp[0], 'Use what?');
            if (r && r.error) return r;
            const w = resolveOr(sp[1], 'Use it on what?');
            if (w && w.error) return w;
            return { verb: 'use', target: r, with: w };
          }
        }
        const r = resolveOr(phrase, 'Use what?');
        if (r && r.error) return r;
        return { verb: 'use', target: r };
      }

      case 'throw': {
        if (!phrase) return { error: 'Throw what?' };
        const sp = splitOn(phrase, 'at');
        if (sp) {
          const r = resolveOr(sp[0], 'Throw what?');
          if (r && r.error) return r;
          const a = resolveOr(sp[1], 'Throw it at what?');
          if (a && a.error) return a;
          return { verb: 'throw', target: r, with: a };
        }
        const r = resolveOr(phrase, 'Throw what?');
        if (r && r.error) return r;
        return { verb: 'throw', target: r };
      }

      case 'push': {
        const r = resolveOr(phrase, 'Push what?');
        if (r && r.error) return r;
        return { verb: 'push', target: r };
      }
      case 'pull': {
        const r = resolveOr(phrase, 'Pull what?');
        if (r && r.error) return r;
        return { verb: 'pull', target: r };
      }

      case 'give': {
        if (!phrase) return { error: 'Give what?' };
        const p = phrase.replace(/^to\s+/, '');
        const sp = splitOn(p, 'to');
        if (sp) {
          const r = resolveOr(sp[0], 'Give what?');
          if (r && r.error) return r;
          const g = resolveOr(sp[1], 'Give it to whom?');
          if (g && g.error) return g;
          return { verb: 'give', target: r, with: g };
        }
        const r = resolveOr(p, 'Give what?');
        if (r && r.error) return r;
        return { verb: 'give', target: r };
      }

      case 'climb': {
        if (!phrase) return { error: 'Climb what?' };
        if (phrase === 'up') return { verb: 'move', text: 'u' };
        if (phrase === 'down') return { verb: 'move', text: 'd' };
        const p = phrase.replace(/^(up|down)\s+/, '');
        const r = resolveOr(p, 'Climb what?');
        if (r && r.error) return r;
        return { verb: 'climb', target: r };
      }

      case 'enter': {
        if (!phrase) return { error: 'Enter what?' };
        const r = resolve(phrase);
        if (r && r.error) return r;
        if (r) return { verb: 'enter', target: r };
        const dir = resolveRoom(phrase);
        if (dir) return { verb: 'move', text: dir };
        return { error: 'You don\'t see that here.' };
      }

      case 'eat': {
        const r = resolveOr(phrase, 'Eat what?');
        if (r && r.error) return r;
        return { verb: 'eat', target: r };
      }

      case 'attack': {
        const r = resolveOr(phrase, 'Attack what?');
        if (r && r.error) return r;
        return { verb: 'attack', target: r };
      }

      case 'talk': {
        if (!phrase) return { verb: 'talk' };
        const r = resolve(phrase.replace(/^to\s+/, ''));
        if (r && r.error) return r;
        return { verb: 'talk', target: r };
      }

      case 'save':
      case 'load': {
        if (/^[123]$/.test(phrase)) return { verb: canon, text: phrase };
        return { verb: canon };
      }

      // verbs that work fine with no resolvable target
      case 'drink':
      case 'smell':
      case 'listen':
      case 'jump':
      case 'row':
      case 'sing':
      case 'play':
      case 'wait': {
        if (!phrase) return { verb: canon };
        const r = resolve(phrase);
        if (r && r.error) return r;
        return { verb: canon, target: r };
      }

      default:
        return { verb: canon };
    }
  }

  Z.parser = {
    parse,
    resolve,
    verbs: Object.keys(verbLookup),
    directions: Object.keys(DIRECTIONS)
  };

  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
