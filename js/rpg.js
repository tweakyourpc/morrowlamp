/* ============================================================
   THE SUNKEN CROWN — the RPG layer
   Stats improve by being used, the way Quest for Glory did it,
   so the character sheet is a record of how you played rather
   than a menu you filled in. Skill checks only ever *help* —
   nothing here can gate a puzzle, so the game stays winnable.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};

  const CLASSES = {
    delver: {
      name: 'Delver',
      blurb: 'A digger of other people\'s history. Strong arms, short patience, excellent shovel.',
      stats: { str: 40, agi: 25, vit: 35, lore: 15, luck: 15 },
      perk: 'Hits harder, and shrugs off the cold better than most.'
    },
    scholar: {
      name: 'Scholar',
      blurb: 'You read the footnotes. Everyone else died in the first chapter; you annotated it.',
      stats: { str: 18, agi: 22, vit: 22, lore: 45, luck: 23 },
      perk: 'Examining things teaches you more, and riddles come quicker.'
    },
    prowler: {
      name: 'Prowler',
      blurb: 'You have never once used a door that was offered to you.',
      stats: { str: 24, agi: 42, vit: 24, lore: 22, luck: 38 },
      perk: 'Harder to hit, luckier in the dark, and quick to get away.'
    }
  };

  const STAT_NAMES = {
    str: 'Strength', agi: 'Agility', vit: 'Vitality',
    lore: 'Lore', luck: 'Luck'
  };

  /* XP needed to reach each level. */
  function xpFor(level) { return Math.round(40 * Math.pow(level, 1.6)); }

  const MONSTERS = {
    umbra: {
      name: 'The Umbra', kind: 'umbra',
      hp: 30, atk: [4, 9], def: 6, xp: 60,
      intro: 'The dark thickens, gathers itself, and opens two red eyes. The Umbra has been patient. It is done being patient.',
      hit: 'It wraps around you like a second, colder skin.',
      miss: 'It pours through the space where you were.',
      dies: 'The Umbra comes apart like smoke remembering it was only ever smoke. The cold goes out of the room.',
      lightWeak: true
    },
    lurker: {
      name: 'Cave Lurker', kind: 'lurker',
      hp: 22, atk: [3, 6], def: 4, xp: 35,
      intro: 'Something pale unfolds itself from under the shore stones, and decides you are the most interesting thing to happen here in a century.',
      hit: 'It rakes at you with too many legs.',
      miss: 'It skitters wide, clicking with irritation.',
      dies: 'The lurker curls up, sighs through a hole in its side, and is still.',
      lightWeak: false
    }
  };

  const rpg = (function () {
    let A = null;                   // the avatar
    let fight = null;               // active combat, or null

    function fresh(cls) {
      const c = CLASSES[cls] || CLASSES.delver;
      const st = Object.assign({}, c.stats);
      const a = {
        cls, stats: st,
        xp: 0, level: 1,
        hp: 0, maxHp: 0,
        kills: 0,
        seen: {},                   // things examined, for one-time Lore
        gains: {}                   // per-stat use counters (diminishing returns)
      };
      a.maxHp = maxHpFor(a);
      a.hp = a.maxHp;
      return a;
    }

    function maxHpFor(a) {
      return Math.round(24 + a.stats.vit * 0.7 + (a.level - 1) * 6);
    }

    /* Using a stat nudges it upward, with the gains getting stingier.
       Returns the message to show if the stat actually went up. */
    function use(stat, weight) {
      if (!A || !A.stats[stat]) return null;
      const n = (A.gains[stat] = (A.gains[stat] || 0) + (weight || 1));
      const cur = A.stats[stat];
      // higher stats need more use; nothing climbs past 100
      const need = 3 + Math.floor(cur / 8);
      if (n < need || cur >= 100) return null;
      A.gains[stat] = 0;
      A.stats[stat] = cur + 1;
      if (stat === 'vit') {
        const was = A.maxHp;
        A.maxHp = maxHpFor(A);
        A.hp += A.maxHp - was;
      }
      return STAT_NAMES[stat] + ' rose to ' + A.stats[stat] + '.';
    }

    function award(xp) {
      if (!A) return [];
      A.xp += xp;
      const out = [{ text: 'You gain ' + xp + ' experience.', cls: 'scored' }];
      while (A.level < 20 && A.xp >= xpFor(A.level + 1)) {
        A.level++;
        const was = A.maxHp;
        A.maxHp = maxHpFor(A);
        A.hp = A.maxHp;                      // levelling patches you up
        out.push({
          text: '✦ You have reached level ' + A.level + '. Vigour ' + was + ' → ' + A.maxHp + ', and fully restored.',
          cls: 'good'
        });
      }
      return out;
    }

    function damage(n) {
      if (!A) return false;
      A.hp = Math.max(0, A.hp - n);
      return A.hp <= 0;
    }

    function heal(n) {
      if (!A) return;
      A.hp = Math.min(A.maxHp, A.hp + n);
    }

    function roll(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

    /* ---------------- combat ---------------- */

    function start(kind, opts) {
      const m = MONSTERS[kind];
      if (!m) return null;
      fight = {
        kind, name: m.name, spec: m,
        hp: m.hp, maxHp: m.hp,
        defending: false,
        round: 1,
        over: false,
        room: (opts && opts.room) || null,
        log: [{ text: m.intro, cls: 'bad' }]
      };
      return fight;
    }

    function active() { return fight; }
    function endFight() { const f = fight; fight = null; return f; }

    /* One exchange. `what` is 'attack' | 'defend' | 'flee' | 'light'.
       Returns {lines, over, won, fled, died}. */
    function act(what, ctx) {
      if (!fight || fight.over) return { lines: [], over: true };
      const lines = [];
      const m = fight.spec;
      let won = false, fled = false, died = false;
      fight.defending = false;

      if (what === 'attack') {
        const power = A.stats.str;
        const hitChance = 0.55 + A.stats.agi / 260 + A.stats.luck / 500;
        if (Math.random() < hitChance) {
          let dmg = roll(2 + Math.floor(power / 12), 5 + Math.floor(power / 6)) + A.level;
          dmg = Math.max(1, dmg - Math.floor(m.def / 3));
          if (ctx && ctx.weapon) { dmg += 2; }
          fight.hp -= dmg;
          lines.push({ text: 'You strike for ' + dmg + '.', cls: '' });
        } else {
          lines.push({ text: 'You swing wide. ' + fight.name + ' is not where it was.', cls: 'dim' });
        }
        const up = use('str', 2);
        if (up) lines.push({ text: up, cls: 'scored' });

      } else if (what === 'light') {
        if (m.lightWeak && ctx && ctx.light) {
          const dmg = roll(10, 18) + Math.floor(A.stats.lore / 10);
          fight.hp -= dmg;
          lines.push({
            text: 'You hold the ' + ctx.light + ' up and force it forward. The Umbra recoils, shrieking, and comes apart at the edges — ' + dmg + ' damage.',
            cls: 'good'
          });
          const up = use('lore', 2);
          if (up) lines.push({ text: up, cls: 'scored' });
        } else if (ctx && ctx.light) {
          lines.push({ text: 'You brandish the ' + ctx.light + '. ' + fight.name + ' is unimpressed by your lighting choices.', cls: 'dim' });
        } else {
          lines.push({ text: 'You have nothing bright enough to matter here.', cls: 'bad' });
        }

      } else if (what === 'defend') {
        fight.defending = true;
        lines.push({ text: 'You set yourself and wait for it to come.', cls: 'dim' });
        const up = use('vit', 2);
        if (up) lines.push({ text: up, cls: 'scored' });

      } else if (what === 'flee') {
        const chance = 0.32 + A.stats.agi / 180 + A.stats.luck / 400;
        if (Math.random() < chance) {
          lines.push({ text: 'You break away and put a great deal of dark between you and it.', cls: 'good' });
          const up = use('agi', 2);
          if (up) lines.push({ text: up, cls: 'scored' });
          fight.over = true;
          return { lines, over: true, won: false, fled: true, died: false };
        }
        lines.push({ text: 'You turn to run. It is already in front of you.', cls: 'bad' });
      }

      if (fight.hp <= 0) {
        lines.push({ text: m.dies, cls: 'good' });
        A.kills++;
        for (const l of award(m.xp)) lines.push(l);
        fight.over = true;
        won = true;
        return { lines, over: true, won, fled, died };
      }

      /* the monster's turn */
      const dodge = 0.10 + A.stats.agi / 300;
      if (Math.random() < dodge) {
        lines.push({ text: m.miss, cls: 'dim' });
        const up = use('agi', 1);
        if (up) lines.push({ text: up, cls: 'scored' });
      } else {
        let dmg = roll(m.atk[0], m.atk[1]);
        if (fight.defending) dmg = Math.max(1, Math.floor(dmg / 2));
        died = damage(dmg);
        lines.push({ text: m.hit + ' You take ' + dmg + '.', cls: 'bad' });
        const up = use('vit', 1);
        if (up) lines.push({ text: up, cls: 'scored' });
      }

      if (died) {
        fight.over = true;
        return { lines, over: true, won: false, fled: false, died: true };
      }

      fight.round++;
      return { lines, over: false, won: false, fled: false, died: false };
    }

    return {
      CLASSES, STAT_NAMES, MONSTERS, xpFor,

      begin(cls) { A = fresh(cls); fight = null; return A; },
      avatar: () => A,
      isReady: () => !!A,
      use, award, heal, damage,
      maxHpFor,

      /* one-time Lore for looking closely at something new */
      firstLook(id) {
        if (!A || A.seen[id]) return null;
        A.seen[id] = true;
        const bonus = A.cls === 'scholar' ? 2 : 1;
        return use('lore', bonus);
      },

      start, act, active, endFight,

      xpToNext() {
        if (!A) return 0;
        return Math.max(0, xpFor(A.level + 1) - A.xp);
      },

      serialize() { return JSON.stringify({ a: A }); },
      restore(json) {
        try {
          const d = JSON.parse(json);
          if (d && d.a) { A = d.a; fight = null; return true; }
        } catch (e) { /* a corrupt sheet is not worth dying over */ }
        return false;
      }
    };
  })();

  Z.rpg = rpg;
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
