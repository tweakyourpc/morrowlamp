/* ============================================================
   MORROWLAMP MACHINE — encounters
   An encounter is a bounded exchange that suspends ordinary play:
   the player picks from a short list of actions until it resolves.
   Combat is ONE KIND of encounter, and the only kind implemented
   today — but the abstraction is not named "fight", because a
   debate, a magical duel, a chase or a drinking contest are the
   same shape and should not have to pretend to be swordplay.

     encounters: {
       cellarRat: {
         kind: 'combat',
         opponent: { name: 'Cellar Rat', hp: 6, attack: [1, 3], defence: 1, xp: 10 },
         intro: '…', hit: '…', miss: '…', defeated: '…',
         actions: [
           { id: 'attack', label: 'Attack', kind: 'strike', uses: 'str', trains: 'str' },
           { id: 'flee',   label: 'Flee',   kind: 'escape', uses: 'agi', trains: 'agi' }
         ]
       }
     }

   Every action is data. An action's `when` clause is evaluated by
   the ordinary rule-book condition checker, so "raise the lantern"
   is expressed with the same vocabulary a puzzle would use, and
   the encounter system never learns what a lantern is.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};
  const list = ml.list;

  const KINDS = ['combat'];
  const ACTION_KINDS = ['strike', 'guard', 'escape', 'talk'];

  const DEFAULT_ACTIONS = [
    { id: 'attack', label: 'Attack', kind: 'strike' },
    { id: 'defend', label: 'Defend', kind: 'guard' },
    { id: 'flee', label: 'Flee', kind: 'escape' }
  ];

  function definition(cartridge, id) {
    return ((cartridge.encounters || {})[id]) || null;
  }

  /* What each KIND of encounter needs before it can run. Combat needs a
     health pool to subtract from; a future `debate` or `chase` would declare
     its own requirement, or none. The generic layer asks — it does not know
     why the answer is what it is, and it does not require stats itself. */
  const REQUIREMENTS = {
    combat: (ctx) => (ctx.sheet
      ? null
      : 'there is nowhere to keep the player\'s health (stats are disabled)')
  };

  function cannotRun(def, ctx) {
    const check = REQUIREMENTS[def.kind || 'combat'];
    return check ? check(ctx) : null;
  }

  function actionsFor(def) {
    return list(def.actions).length ? list(def.actions) : DEFAULT_ACTIONS;
  }

  /* ---------------- starting ---------------- */
  function begin(def, id) {
    const opponent = def.opponent || {};
    return {
      id,
      kind: def.kind || 'combat',
      name: opponent.name || def.name || 'Something',
      hp: opponent.hp || 1,
      maxHp: opponent.hp || 1,
      round: 1,
      guarding: false,
      over: false
    };
  }

  /* Which actions the player may take right now: an action whose
     `when` clause fails is still shown, but explains itself. */
  function available(def, ctx) {
    return actionsFor(def).map((action) => {
      const ok = !action.when || ml.rules.conditionsHold(action.when, {}, ctx);
      return {
        id: action.id,
        label: action.label || action.id,
        kind: action.kind || 'strike',
        enabled: ok,
        deny: ok ? null : (action.deny || null)
      };
    });
  }

  function roll(random, lo, hi) { return lo + Math.floor(random() * (hi - lo + 1)); }

  /* ---------------- one exchange ----------------
     `ctx` carries the runtime's ops, state, world and profile, plus a
     `random` so a test can make the dice behave. Returns a result the
     runtime turns into messages and state changes. */
  function act(def, state, actionId, ctx) {
    const random = ctx.random || Math.random;
    const sheet = ctx.sheet;
    const cfg = ctx.statsConfig;
    const lines = [];
    const opponent = def.opponent || {};
    const action = actionsFor(def).find((a) => a.id === actionId);

    if (!action) return { lines: [{ text: 'That is not one of your options.', cls: 'bad' }], over: false };
    if (action.when && !ml.rules.conditionsHold(action.when, {}, ctx)) {
      return { lines: [{ text: action.deny || 'You cannot do that here.', cls: 'bad' }], over: false };
    }

    /* Most lines below are handed to the runtime whole and get their
       '@s:' reference resolved when they become messages. The two that
       are built up by hand — a hit line carries {damage}, the opponent's
       hit line carries the damage it dealt — have to resolve first, or
       the substitution would be performed on the reference instead of on
       the prose it names. */
    const text = (value) => ml.strings.resolve(value, (ctx.cart || {}).strings);

    const stat = (id) => (sheet && id && sheet.stats[id] !== undefined ? sheet.stats[id] : 0);
    const train = (id, weight) => {
      if (!sheet || !id) return;
      const line = ml.stats.use(cfg, sheet, id, weight);
      if (line) lines.push({ text: line, cls: 'scored' });
    };

    state.guarding = false;
    let won = false, fled = false, died = false;

    switch (action.kind || 'strike') {
      case 'strike': {
        /* A `damage` range makes the action deterministic in strength;
           without one it is derived from the stat the action uses. */
        const skill = stat(action.uses);
        /* Landing a blow and landing it hard are not the same talent.
           `uses` is the strength behind the swing; `hitFrom` is the aim,
           and defaults to the same stat for a cartridge that draws no
           distinction. */
        const aim = action.hitFrom ? stat(action.hitFrom) : skill;
        const chance = action.always ? 1 : (action.hitChance !== undefined ? action.hitChance : 0.55 + aim / 260 + stat(action.luck) / 500);
        if (random() < chance) {
          let damage;
          if (action.damage) {
            damage = roll(random, action.damage[0], action.damage[1]) + Math.floor(stat(action.bonusFrom) / 10);
          } else {
            damage = roll(random, 2 + Math.floor(skill / 12), 5 + Math.floor(skill / 6)) + (sheet ? sheet.level : 1);
            damage = Math.max(1, damage - Math.floor((opponent.defence || 0) / 3));
          }
          /* Circumstances the cartridge says are worth extra damage —
             carrying a knife rather than swinging a fist, most obviously.
             Written as ordinary rule conditions, so the encounter system
             learns nothing about knives. */
          for (const extra of (action.bonus || [])) {
            if (!extra || !extra.damage) continue;
            if (extra.when && !ml.rules.conditionsHold(extra.when, {}, ctx)) continue;
            damage += extra.damage;
          }
          state.hp -= damage;
          lines.push({ text: String(text(action.hitText) || 'You strike for {damage}.').replace('{damage}', damage), cls: action.cls || '' });
        } else {
          lines.push({ text: action.missText || ('You swing wide. ' + state.name + ' is not where it was.'), cls: 'dim' });
        }
        train(action.trains, action.weight || 2);
        /* An action may also change the world — raising an unlit lamp
           lights it, which is a fact about lamps, not about fighting.
           These are ordinary rule actions, so the encounter system does
           not learn anything new to support them. */
        if (action.do) ml.rules.perform(action.do, {}, ctx);
        break;
      }

      case 'guard':
        state.guarding = true;
        lines.push({ text: action.text || 'You set yourself and wait for it to come.', cls: 'dim' });
        train(action.trains, action.weight || 2);
        break;

      case 'escape': {
        /* Getting away is mostly quickness and partly luck, the same two
           terms a strike uses and in the same order. An action that names
           no luck stat simply has no luck term. */
        const chance = action.chance !== undefined
          ? action.chance
          : 0.32 + stat(action.uses) / 180 + stat(action.luck) / 400;
        if (random() < chance) {
          lines.push({ text: action.text || 'You break away and put a great deal of distance between you and it.', cls: 'good' });
          train(action.trains, action.weight || 2);
          state.over = true;
          return { lines, over: true, won: false, fled: true, died: false };
        }
        lines.push({ text: action.failText || 'You turn to run. It is already in front of you.', cls: 'bad' });
        break;
      }

      case 'talk':
        lines.push({ text: action.text || 'You say your piece. It changes nothing.', cls: 'dim' });
        train(action.trains, action.weight || 1);
        break;

      default:
        break;
    }

    /* Has it given up? */
    if (state.hp <= 0) {
      lines.push({ text: def.defeated || (state.name + ' is finished.'), cls: 'good' });
      if (sheet) {
        sheet.wins++;
        for (const line of ml.stats.award(cfg, sheet, opponent.xp || 0)) lines.push(line);
      }
      state.over = true;
      return { lines, over: true, won: true, fled: false, died: false };
    }

    /* Its turn. */
    const dodge = 0.10 + stat(def.dodgeFrom) / 300;
    if (random() < dodge) {
      lines.push({ text: def.miss || (state.name + ' misses.'), cls: 'dim' });
      train(def.dodgeFrom, 1);
    } else {
      const range = opponent.attack || [1, 3];
      let damage = roll(random, range[0], range[1]);
      if (state.guarding) damage = Math.max(1, Math.floor(damage / 2));
      died = sheet ? ml.stats.damage(sheet, damage) : false;
      lines.push({ text: (text(def.hit) || (state.name + ' hits you.')) + ' You take ' + damage + '.', cls: 'bad' });
      train(def.hurtTrains, 1);
    }

    if (died) {
      state.over = true;
      return { lines, over: true, won: false, fled: false, died: true };
    }

    state.round++;
    return { lines, over: false, won, fled, died };
  }

  ml.encounter = { KINDS, ACTION_KINDS, DEFAULT_ACTIONS, REQUIREMENTS, definition, cannotRun, actionsFor, begin, available, act };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
