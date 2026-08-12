/* ============================================================
   MORROWLAMP MACHINE — character stats
   An optional capability. The Machine does not know what a stat
   is called, how many there are, what a class is, or which one
   feeds your health — the cartridge says all of it as data:

     stats: {
       list:    { str: 'Strength', vit: 'Vitality' },
       classes: { knight: { name, blurb, stats: { str: 20, vit: 14 } } },
       health:  { from: 'vit', base: 10, perPoint: 0.5, perLevel: 4 },
       growth:  { base: 3, per: 8, max: 100 },
       levels:  { max: 20, factor: 40, power: 1.6 }
     }

   Nothing here is a function, so a cartridge carrying stats is
   still plain data and still survives a trip through JSON.

   Stats rise by being used, the way Quest for Glory did it. What
   using them *means* is decided by whatever calls `use()` — an
   encounter action, or a rule.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  const DEFAULTS = {
    list: {},
    classes: {},
    health: { from: null, base: 20, perPoint: 0, perLevel: 4 },
    growth: { base: 3, per: 8, max: 100 },
    levels: { max: 20, factor: 40, power: 1.6 },
    startClass: null
  };

  function config(profileStats) {
    const c = Object.assign({}, DEFAULTS, profileStats || {});
    c.health = Object.assign({}, DEFAULTS.health, (profileStats || {}).health);
    c.growth = Object.assign({}, DEFAULTS.growth, (profileStats || {}).growth);
    c.levels = Object.assign({}, DEFAULTS.levels, (profileStats || {}).levels);
    return c;
  }

  function xpFor(cfg, level) {
    return Math.round(cfg.levels.factor * Math.pow(level, cfg.levels.power));
  }

  function maxHpFor(cfg, sheet) {
    const from = cfg.health.from;
    const points = from && sheet.stats[from] ? sheet.stats[from] : 0;
    return Math.round(cfg.health.base + points * cfg.health.perPoint + (sheet.level - 1) * cfg.health.perLevel);
  }

  function create(cfg, classId) {
    const klass = cfg.classes[classId] || cfg.classes[Object.keys(cfg.classes)[0]] || { stats: {} };
    const sheet = {
      cls: classId || Object.keys(cfg.classes)[0] || null,
      stats: Object.assign({}, klass.stats),
      xp: 0, level: 1, hp: 0, maxHp: 0,
      wins: 0,
      seen: {},     // things studied, for one-time awards
      gains: {}     // per-stat use counters, for diminishing returns
    };
    sheet.maxHp = maxHpFor(cfg, sheet);
    sheet.hp = sheet.maxHp;
    return sheet;
  }

  /* Using a stat nudges it upward, with the gains getting stingier the
     higher it already is. Returns a line to print, or null. */
  function use(cfg, sheet, stat, weight) {
    if (!sheet || sheet.stats[stat] === undefined) return null;
    const total = (sheet.gains[stat] = (sheet.gains[stat] || 0) + (weight || 1));
    const current = sheet.stats[stat];
    const need = cfg.growth.base + Math.floor(current / cfg.growth.per);
    if (total < need || current >= cfg.growth.max) return null;
    sheet.gains[stat] = 0;
    sheet.stats[stat] = current + 1;
    if (cfg.health.from === stat) {
      const was = sheet.maxHp;
      sheet.maxHp = maxHpFor(cfg, sheet);
      sheet.hp += sheet.maxHp - was;
    }
    return (cfg.list[stat] || stat) + ' rose to ' + sheet.stats[stat] + '.';
  }

  function award(cfg, sheet, xp) {
    if (!sheet || !xp) return [];
    sheet.xp += xp;
    const lines = [{ text: 'You gain ' + xp + ' experience.', cls: 'scored' }];
    while (sheet.level < cfg.levels.max && sheet.xp >= xpFor(cfg, sheet.level + 1)) {
      sheet.level++;
      const was = sheet.maxHp;
      sheet.maxHp = maxHpFor(cfg, sheet);
      sheet.hp = sheet.maxHp;
      lines.push({
        text: '✦ You have reached level ' + sheet.level + '. Health ' + was + ' → ' + sheet.maxHp + ', and fully restored.',
        cls: 'good'
      });
    }
    return lines;
  }

  function damage(sheet, n) {
    if (!sheet) return false;
    sheet.hp = Math.max(0, sheet.hp - n);
    return sheet.hp <= 0;
  }

  function heal(sheet, n) {
    if (!sheet) return;
    sheet.hp = Math.min(sheet.maxHp, sheet.hp + n);
  }

  function xpToNext(cfg, sheet) {
    if (!sheet || sheet.level >= cfg.levels.max) return 0;
    return Math.max(0, xpFor(cfg, sheet.level + 1) - sheet.xp);
  }

  /* A shape a shell can render without knowing the game. */
  function summary(cfg, sheet) {
    if (!sheet) return null;
    const klass = cfg.classes[sheet.cls] || {};
    return {
      cls: sheet.cls,
      className: klass.name || sheet.cls || 'Adventurer',
      level: sheet.level, xp: sheet.xp, xpToNext: xpToNext(cfg, sheet),
      hp: sheet.hp, maxHp: sheet.maxHp, wins: sheet.wins,
      stats: Object.keys(cfg.list).map((id) => ({ id, name: cfg.list[id], value: sheet.stats[id] || 0 }))
    };
  }

  /* An award is a small, once-per-thing recognition that the player did
     something the cartridge cares about: `{ stat, by, xp }`. What the
     triggers are is up to the runtime; what they are worth is up to the
     cartridge. */
  function grant(cfg, sheet, spec, weight) {
    const lines = [];
    if (!sheet || !spec) return lines;
    if (spec.stat) {
      const line = use(cfg, sheet, spec.stat, weight || spec.by || 1);
      if (line) lines.push({ text: line, cls: 'scored' });
    }
    if (spec.xp) for (const line of award(cfg, sheet, spec.xp)) lines.push(line);
    return lines;
  }

  ml.stats = { DEFAULTS, config, create, use, award, grant, damage, heal, xpFor, xpToNext, maxHpFor, summary };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
