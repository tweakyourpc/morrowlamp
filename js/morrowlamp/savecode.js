/* ============================================================
   MORROWLAMP — save codes
   A whole game, as a code a player can write on paper and type back
   in later: Crockford base32 (no I, L, O or U, so nothing is misread),
   in groups of four. Like the passwords of the old cartridge games,
   but it keeps everything: where every object is, every door, every
   flag, the score and the character sheet.

   It stays short by writing down only what has changed since the
   game began, so an early code is a few groups long and a late one a
   dozen or so. Every list it needs (rooms, objects, flags, treasures,
   classes) comes from the cartridge, sorted, so it works for any
   cartridge. A checksum, folded with a signature of those lists,
   catches a typo and refuses a code made by a different version.

   The code is made from a runtime's serialize() and read back into
   something its restore() accepts; nothing here decides anything.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  const VERSION = 1;
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const CHECK_BITS = 12;
  const KINDS = ['inv', 'gone', 'room', 'container'];   // where an object that has moved is now
  const list = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
  const width = (n) => (n <= 1 ? 1 : Math.ceil(Math.log2(n)));

  class CodeError extends Error {
    constructor(reason, message) { super(message); this.reason = reason; }
  }

  /* ---------------- the cartridge's vocabulary ---------------- */
  function tablesFor(cart) {
    if (cart.__saveTables) return cart.__saveTables;
    const world = cart.world || {};
    const rooms = Object.keys(world.rooms || {}).sort();
    const objects = Object.keys(world.objects || {}).sort();
    const defs = world.objects || {};
    const containers = objects.filter((id) => defs[id].container);
    const takeable = objects.filter((id) => defs[id].takeable);
    // Things whose open, locked or lit can change: doors, lids and lamps.
    const switchable = objects.filter((id) => {
      const d = defs[id];
      return d.container || d.light || d.lightable || ['open', 'locked', 'lit', 'openable', 'lockable', 'key'].some((k) => d[k] !== undefined);
    });
    // Every flag a rule can set, and every one the game starts with.
    const flags = new Set(Object.keys(cart.startFlags || {}));
    const walk = (v) => {
      if (Array.isArray(v)) { v.forEach(walk); return; }
      if (!v || typeof v !== 'object') return;
      if (v.set !== undefined) {
        if (typeof v.set === 'string') flags.add(v.set);
        else if (Array.isArray(v.set)) v.set.forEach((f) => typeof f === 'string' && flags.add(f));
        else if (v.set && typeof v.set === 'object') Object.keys(v.set).forEach((f) => flags.add(f));
      }
      if (v.clear !== undefined) list(v.clear).forEach((f) => typeof f === 'string' && flags.add(f));
      for (const k of Object.keys(v)) if (typeof v[k] === 'object') walk(v[k]);
    };
    walk(cart.rules || []);
    walk(cart.timers || []);
    walk(cart.encounters || {});
    // The profile as the runtime sees it, defaults filled in.
    const profile = ml.profile.normalize(cart.profile);
    const treasures = list(profile.treasures && profile.treasures.list).slice().sort();
    const stats = profile.stats && profile.stats.enabled ? ml.stats.config(profile.stats) : null;
    const t = {
      rooms, objects, containers, takeable, switchable, defs, treasures,
      flags: Array.from(flags).sort(),
      timers: list(cart.timers).map((x) => x.id),
      classes: stats ? Object.keys(stats.classes || {}).sort() : [],
      statNames: stats ? Object.keys(stats.list || {}).sort() : [],
      startInv: list(world.startInventory),
      stats,
      fuelStart: profile.light && profile.light.fuel ? profile.light.fuel.turns : null
    };
    t.home = homeTable(t);
    t.signature = hash([VERSION, cart.meta && cart.meta.id, t.rooms, t.objects, t.flags, t.treasures, t.classes, t.statNames, t.timers].join('|'));
    Object.defineProperty(cart, '__saveTables', { value: t, enumerable: false });
    return t;
  }

  /* Where each object begins: the inventory, a container, or a room. */
  function homeTable(t) {
    const home = {};
    for (const id of t.objects) {
      const at = t.defs[id].at;
      if (t.startInv.includes(id) || at === 'inv') home[id] = { kind: 'inv' };
      else if (at !== undefined && at !== null) home[id] = { kind: 'home' };
      else home[id] = { kind: 'none' };
    }
    for (const c of t.containers) {
      for (const id of list(t.defs[c].contents)) home[id] = { kind: 'container', where: c };
    }
    return home;
  }

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* Where an object is now, worked out from the state the way the
     world works it out: gone, carried, in a container, dropped in a
     room, or still at home. */
  function whereIs(t, S, id) {
    if (S.gone && S.gone[id]) return { kind: 'gone' };
    if (list(S.inv).includes(id)) return { kind: 'inv' };
    for (const c of Object.keys(S.contents || {})) if (S.contents[c].includes(id)) return { kind: 'container', where: c };
    const home = t.home[id];
    if (home.kind === 'container' && !(home.where in (S.contents || {}))) return home;
    for (const r of Object.keys(S.loose || {})) if (S.loose[r].includes(id)) return { kind: 'room', where: r };
    if (home.kind === 'home' && !(S.moved && S.moved[id])) return { kind: 'home' };
    if (home.kind === 'none') return { kind: 'none' };   // not in the world yet: a rule brings it later
    return { kind: 'gone' };   // moved out of its room and placed nowhere: as good as gone
  }
  const same = (a, b) => a.kind === b.kind && (a.where || null) === (b.where || null);

  /* ---------------- bits ---------------- */
  function writer() {
    const bits = [];
    return {
      bits,
      put(value, n) {
        if (!(value >= 0 && value < 2 ** n)) throw new CodeError('range', 'value ' + value + ' does not fit in ' + n + ' bits');
        for (let i = n - 1; i >= 0; i--) bits.push((value >>> i) & 1);
      },
      cap(value, n) { this.put(Math.max(0, Math.min(2 ** n - 1, Math.round(value || 0))), n); },
      flag(b) { bits.push(b ? 1 : 0); },
      /* A count of any size, short when it is small: 0 is one bit, 1-2 three, 3-6 five. */
      num(value) {
        const v = Math.max(0, Math.round(value || 0)) + 1;
        const n = Math.floor(Math.log2(v));
        for (let i = 0; i < n; i++) bits.push(0);
        this.put(v, n + 1);
      },
      signed(value) { const v = Math.round(value || 0); this.num(v >= 0 ? v * 2 : -v * 2 - 1); }
    };
  }
  function reader(bits) {
    let at = 0;
    return {
      get(n) {
        let v = 0;
        for (let i = 0; i < n; i++) {
          if (at >= bits.length) throw new CodeError('short', 'the code is too short');
          v = v * 2 + bits[at++];
        }
        return v;
      },
      flag() { return this.get(1) === 1; },
      num() {
        let n = 0;
        while (this.get(1) === 0) { n++; if (n > 30) throw new CodeError('short', 'the code is damaged'); }
        return ((1 << n) | this.get(n)) - 1;
      },
      signed() { const v = this.num(); return v % 2 ? -(v + 1) / 2 : v / 2; },
      left: () => bits.length - at
    };
  }

  function checksum(bits, signature) {
    let h = signature ^ 0x9e3779b9;
    for (const b of bits) { h ^= b + 0x51; h = Math.imul(h, 16777619) >>> 0; }
    return (h ^ (h >>> 16)) & (2 ** CHECK_BITS - 1);
  }

  function toText(bits) {
    const padded = bits.slice();
    while (padded.length % 5) padded.push(0);
    let s = '';
    for (let i = 0; i < padded.length; i += 5) {
      let v = 0;
      for (let k = 0; k < 5; k++) v = v * 2 + padded[i + k];
      s += ALPHABET[v];
    }
    return s.match(/.{1,4}/g).join('-');
  }
  function fromText(text) {
    const clean = String(text || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    if (!clean) throw new CodeError('empty', 'there is no code');
    const bits = [];
    for (const ch of clean) {
      const v = ALPHABET.indexOf(ch);
      if (v < 0) throw new CodeError('letter', '"' + ch + '" is not in a save code');
      for (let k = 4; k >= 0; k--) bits.push((v >>> k) & 1);
    }
    return bits;
  }

  /* A list of indices, or a bit for every member, whichever is shorter. */
  function putSet(w, members, universe) {
    const idx = members.map((m) => universe.indexOf(m)).filter((i) => i >= 0).sort((a, b) => a - b);
    const each = width(universe.length);
    const asList = 2 * Math.floor(Math.log2(idx.length + 1)) + 1 + idx.length * each;
    if (asList < universe.length) {
      w.flag(0);
      w.num(idx.length);
      for (const i of idx) w.put(i, each);
    } else {
      w.flag(1);
      for (let i = 0; i < universe.length; i++) w.flag(idx.includes(i));
    }
  }
  /* Most members of a set come from a short list of likely ones (things
     that can be carried, things that can open): index into that, and
     list the rare others against everything. */
  function putSplit(w, members, likely, all) {
    putSet(w, members.filter((m) => likely.includes(m)), likely);
    const rest = all.filter((m) => !likely.includes(m));
    putSet(w, members.filter((m) => !likely.includes(m)), rest);
  }
  function getSplit(r, likely, all) {
    return getSet(r, likely).concat(getSet(r, all.filter((m) => !likely.includes(m))));
  }

  function getSet(r, universe) {
    const out = [];
    if (r.flag()) {
      for (let i = 0; i < universe.length; i++) if (r.flag()) out.push(universe[i]);
    } else {
      const n = r.num();
      for (let k = 0; k < n; k++) out.push(universe[r.get(width(universe.length))]);
    }
    return out;
  }

  /* ---------------- encode ---------------- */
  function encode(cart, state) {
    const t = tablesFor(cart);
    const S = typeof state === 'string' ? JSON.parse(state) : state;
    if (S.dead) throw new CodeError('dead', 'a game that has ended in death has no code');
    if (S.encounter && !S.encounter.over) throw new CodeError('fight', 'finish the fight first');
    const w = writer();
    w.put(VERSION, 3);
    w.put(t.rooms.indexOf(S.room), width(t.rooms.length));
    w.num(S.score);
    w.num(S.turns);
    w.flag(S.fuel !== null && S.fuel !== undefined);
    if (S.fuel !== null && S.fuel !== undefined) w.signed((t.fuelStart || 0) - S.fuel);   // oil burned (or, refilled, gained)
    w.signed(S.darkTurns);
    w.flag(S.won);
    putSet(w, Object.keys(S.visited || {}).filter((r) => S.visited[r]), t.rooms);

    // Flags: only the ones that differ from how the game starts.
    const changed = [];
    for (const [f, v] of Object.entries(S.flags || {})) {
      if (typeof v !== 'boolean' && v !== undefined) throw new CodeError('flag', 'flag ' + f + ' is not true or false');
      if (!t.flags.includes(f)) throw new CodeError('flag', 'flag ' + f + ' is not one the cartridge knows');
      if (!!v !== !!(cart.startFlags || {})[f]) changed.push(f);
    }
    putSet(w, changed, t.flags);

    // Objects away from where they began.
    const away = t.objects.filter((id) => !same(whereIs(t, S, id), t.home[id]));
    const awayOrder = away.filter((m) => t.takeable.includes(m)).concat(away.filter((m) => !t.takeable.includes(m)));
    putSplit(w, away, t.takeable, t.objects);
    for (const id of awayOrder) {
      const now = whereIs(t, S, id);
      w.put(KINDS.indexOf(now.kind === 'none' ? 'gone' : now.kind), 2);
      if (now.kind === 'room') w.put(t.rooms.indexOf(now.where), width(t.rooms.length));
      if (now.kind === 'container') w.put(t.containers.indexOf(now.where), width(t.containers.length));
    }

    // Doors, lids and lamps: open, locked and lit, where they differ from the definition.
    const props = ['open', 'locked', 'lit'];
    const touched = t.objects.filter((id) => {
      const o = (S.obj || {})[id];
      if (!o) return false;
      for (const k of Object.keys(o)) if (!props.includes(k)) throw new CodeError('prop', id + '.' + k + ' cannot be written down');
      return props.some((k) => k in o);
    });
    const touchedOrder = touched.filter((m) => t.switchable.includes(m)).concat(touched.filter((m) => !t.switchable.includes(m)));
    putSplit(w, touched, t.switchable, t.objects);
    for (const id of touchedOrder) for (const k of props) {
      const v = S.obj[id][k];
      w.put(v === undefined ? 0 : v ? 2 : 1, 2);
    }

    putSet(w, list(S.found), t.treasures);
    putSet(w, list(S.secured), t.treasures);
    for (const id of t.timers) w.num((S.timers || {})[id]);

    w.flag(!!S.sheet);
    if (S.sheet) {
      const sh = S.sheet;
      // Only what play has changed: stats as steps from the class's own,
      // health as what is missing, the maximum only if the formula would not give it.
      const base = (t.stats.classes[sh.cls] || {}).stats || {};
      w.put(Math.max(0, t.classes.indexOf(sh.cls)), width(t.classes.length));
      w.num(sh.xp); w.num((sh.level || 1) - 1); w.num(sh.wins);
      for (const s of t.statNames) w.signed(((sh.stats || {})[s] || 0) - (base[s] || 0));
      for (const s of t.statNames) w.num((sh.gains || {})[s]);
      const derived = ml.stats.maxHpFor(t.stats, sh);
      w.flag(sh.maxHp !== derived);
      if (sh.maxHp !== derived) w.num(sh.maxHp);
      w.signed(sh.maxHp - sh.hp);
      putSet(w, Object.keys(sh.seen || {}).filter((k) => sh.seen[k]), t.objects);
    }

    const sum = checksum(w.bits, t.signature);
    w.put(sum, CHECK_BITS);
    return toText(w.bits);
  }

  /* ---------------- decode ---------------- */
  function decode(cart, text) {
    const t = tablesFor(cart);
    const all = fromText(text);
    // The checksum sits right after the payload; the rest is padding.
    let payloadEnd = -1;
    for (let end = all.length - CHECK_BITS; end >= Math.max(0, all.length - CHECK_BITS - 4); end--) {
      const body = all.slice(0, end);
      let v = 0;
      for (let i = end; i < end + CHECK_BITS; i++) v = v * 2 + all[i];
      if (v === checksum(body, t.signature) && all.slice(end + CHECK_BITS).every((b) => b === 0)) { payloadEnd = end; break; }
    }
    if (payloadEnd < 0) throw new CodeError('check', 'that code does not check out: a letter may be wrong, or it is from another version of the game');
    const r = reader(all.slice(0, payloadEnd));
    if (r.get(3) !== VERSION) throw new CodeError('version', 'that code is from another version of the game');

    const S = {};
    S.room = t.rooms[r.get(width(t.rooms.length))];
    S.score = r.num();
    S.turns = r.num();
    S.fuel = r.flag() ? (t.fuelStart || 0) - r.signed() : null;
    S.darkTurns = r.signed();
    S.won = r.flag();
    S.dead = false;
    S.ending = null;
    S.visited = {};
    for (const room of getSet(r, t.rooms)) S.visited[room] = true;
    S.flags = Object.assign({}, cart.startFlags || {});
    for (const f of getSet(r, t.flags)) S.flags[f] = !(cart.startFlags || {})[f];

    // Rebuild placement the way the world records it.
    S.inv = t.startInv.slice();
    S.contents = {};
    S.loose = {};
    S.moved = {};
    S.gone = {};
    const bagOf = (c) => (S.contents[c] = S.contents[c] || list(t.defs[c].contents).slice());
    for (const id of getSplit(r, t.takeable, t.objects)) {
      const kind = KINDS[r.get(2)];
      const where = kind === 'room' ? t.rooms[r.get(width(t.rooms.length))]
        : kind === 'container' ? t.containers[r.get(width(t.containers.length))] : null;
      const home = t.home[id];
      if (home.kind === 'inv') S.inv = S.inv.filter((x) => x !== id);
      if (home.kind === 'container') { const bag = bagOf(home.where); bag.splice(bag.indexOf(id), 1); }
      S.moved[id] = true;
      if (kind === 'inv') S.inv.push(id);
      else if (kind === 'gone') S.gone[id] = true;
      else if (kind === 'room') (S.loose[where] = S.loose[where] || []).push(id);
      else if (kind === 'container') bagOf(where).push(id);
    }

    S.obj = {};
    const touched = getSplit(r, t.switchable, t.objects);
    for (const id of touched) {
      for (const k of ['open', 'locked', 'lit']) {
        const v = r.get(2);
        if (v) (S.obj[id] = S.obj[id] || {})[k] = v === 2;
      }
    }
    S.found = getSet(r, t.treasures);
    S.secured = getSet(r, t.treasures);
    S.timers = {};
    for (const id of t.timers) { const n = r.num(); if (n) S.timers[id] = n; }

    if (r.flag()) {
      const sh = { cls: t.classes[r.get(width(t.classes.length))] };
      const base = (t.stats.classes[sh.cls] || {}).stats || {};
      sh.xp = r.num(); sh.level = r.num() + 1; sh.wins = r.num();
      sh.stats = {}; for (const s of t.statNames) sh.stats[s] = (base[s] || 0) + r.signed();
      sh.gains = {}; for (const s of t.statNames) { const g = r.num(); if (g) sh.gains[s] = g; }
      sh.maxHp = r.flag() ? r.num() : ml.stats.maxHpFor(t.stats, sh);
      sh.hp = sh.maxHp - r.signed();
      sh.seen = {}; for (const id of getSet(r, t.objects)) sh.seen[id] = true;
      S.sheet = sh;
    } else S.sheet = null;
    S.encounter = null;
    S.prev = [];
    return S;
  }

  /* The same game, said two ways: what a save code keeps. Used by the
     test that proves a code loses nothing, and handy for a shell that
     wants to know whether two states differ. */
  function digest(cart, state) {
    const t = tablesFor(cart);
    const S = typeof state === 'string' ? JSON.parse(state) : state;
    const where = {};
    for (const id of t.objects) { const w = whereIs(t, S, id); where[id] = w.kind + (w.where ? ':' + w.where : ''); }
    const flags = {};
    for (const f of t.flags) flags[f] = !!(S.flags || {})[f];
    const props = {};
    for (const id of t.objects) {
      const o = (S.obj || {})[id] || {};
      for (const k of ['open', 'locked', 'lit']) if (k in o) props[id + '.' + k] = o[k];
    }
    const sh = S.sheet;
    return JSON.stringify({
      room: S.room, score: S.score, turns: S.turns, fuel: S.fuel, darkTurns: S.darkTurns, won: !!S.won,
      visited: t.rooms.filter((r) => S.visited && S.visited[r]), flags, where, props,
      found: list(S.found).slice().sort(), secured: list(S.secured).slice().sort(),
      timers: t.timers.map((id) => (S.timers || {})[id] || 0),
      sheet: sh && { cls: sh.cls, xp: sh.xp, level: sh.level, hp: sh.hp, maxHp: sh.maxHp, wins: sh.wins,
        stats: t.statNames.map((x) => (sh.stats || {})[x] || 0),
        gains: t.statNames.map((s) => (sh.gains || {})[s] || 0), seen: Object.keys(sh.seen || {}).filter((k) => sh.seen[k]).sort() }
    });
  }

  ml.savecode = { encode, decode, digest, CodeError, ALPHABET };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
