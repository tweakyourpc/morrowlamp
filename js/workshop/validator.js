/* ============================================================
   MORROWLAMP GAME WORKSHOP — cartridge validator
   Think like a compiler. A cartridge that cannot possibly work
   should be refused before it reaches a player, and refused with
   an address:

     RULE 17 (dig-the-crack): target "silver_key" does not exist.
     ROOM cellar: exit "s" targets missing room "tunel".
     DISPLAY: unknown renderer profile "svga" (known: cga, ega, vga).

   Pure: no DOM, no runtime, no side effects. The Workshop calls
   it before building, the tests call it directly, and a cartridge
   author can call it from a scratch file.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  const RENDERERS = ['cga', 'ega', 'vga'];
  const AUDIO = ['speaker', 'chip', 'synth'];
  const INTERFACES = ['canvas', 'parser'];

  function listOf(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }

  function validate(cartridge) {
    const errors = [], warnings = [];
    const err = (where, message) => errors.push(where + ': ' + message);
    const warn = (where, message) => warnings.push(where + ': ' + message);

    if (!cartridge || typeof cartridge !== 'object') {
      return { ok: false, errors: ['CARTRIDGE: nothing to validate.'], warnings: [] };
    }

    /* The closed vocabularies the rule dialect defines. Held here so the
       checks below can quote them back at the author. */
    const knownConditions = (ml.rules && ml.rules.CONDITIONS) || [];
    const knownActions = (ml.rules && ml.rules.ACTIONS) || [];
    const knownRefs = (ml.rules && ml.rules.REFS) || [];

    /* Flags are gathered as the whole cartridge is read, then reconciled
       at the end: anything tested but never set is a dead condition. */
    const setFlags = new Set(Object.keys((cartridge.startFlags) || {}));
    const testedFlags = new Set();

    /* ---------------- metadata ---------------- */
    const meta = cartridge.meta || {};
    if (!meta.id || !/^[a-z0-9][a-z0-9-]*$/.test(String(meta.id))) {
      err('META', 'id must be a lowercase slug (letters, digits, hyphens), got ' + JSON.stringify(meta.id));
    }
    if (!meta.title || !String(meta.title).trim()) err('META', 'title is required.');
    if (!meta.version) warn('META', 'no version; compiled games will be stamped "0.0.0".');

    const world = cartridge.world || {};
    const rooms = world.rooms || {};
    const objects = world.objects || {};
    const roomIds = Object.keys(rooms);
    const objectIds = Object.keys(objects);

    if (!roomIds.length) err('WORLD', 'a cartridge needs at least one room.');

    /* ---------------- duplicate ids ----------------
       Object keys cannot literally repeat, so the duplicate that can
       actually happen is an `id` field disagreeing with its key. */
    for (const id of roomIds) {
      if (rooms[id].id !== undefined && rooms[id].id !== id) {
        err('ROOM ' + id, 'declares a conflicting id "' + rooms[id].id + '".');
      }
    }
    for (const id of objectIds) {
      if (objects[id].id !== undefined && objects[id].id !== id) {
        err('OBJECT ' + id, 'declares a conflicting id "' + objects[id].id + '".');
      }
      if (rooms[id]) warn('OBJECT ' + id, 'shares its id with a room; harmless, but confusing to read.');
    }

    /* ---------------- start state ---------------- */
    if (!world.startRoom) err('WORLD', 'startRoom is required.');
    else if (!rooms[world.startRoom]) err('WORLD', 'startRoom "' + world.startRoom + '" is not a room.');
    for (const id of listOf(world.startInventory)) {
      if (!objects[id]) err('WORLD', 'startInventory names missing object "' + id + '".');
      else if (objects[id].takeable === false) warn('WORLD', 'startInventory holds "' + id + '", which is marked not takeable.');
    }

    /* ---------------- rooms and exits ---------------- */
    const KNOWN_EXIT_KEYS = (ml.world && ml.world.KNOWN_EXIT_KEYS) || ['room', 'flagReq', 'flagNot', 'objReq', 'open', 'lit', 'deny', 'note'];
    for (const id of roomIds) {
      const room = rooms[id];
      const where = 'ROOM ' + id;
      if (!room.name) err(where, 'has no name.');
      if (!room.desc) warn(where, 'has no description; the player will arrive somewhere blank.');

      for (const dir in (room.exits || {})) {
        const exit = room.exits[dir];
        const label = where + ': exit "' + dir + '"';
        if (typeof exit === 'string') {
          if (!rooms[exit]) err(where, 'exit "' + dir + '" targets missing room "' + exit + '".');
          continue;
        }
        if (!exit || typeof exit !== 'object') { err(where, 'exit "' + dir + '" is neither a room id nor an exit object.'); continue; }
        if (exit.room && !rooms[exit.room]) err(where, 'exit "' + dir + '" targets missing room "' + exit.room + '".');
        if (!exit.room && !exit.deny) warn(where, 'exit "' + dir + '" leads nowhere and says nothing about it.');
        for (const key in exit) {
          if (!KNOWN_EXIT_KEYS.includes(key)) {
            /* This is the guardReq class of bug: a requirement the runtime
               has never heard of. It fails closed, so the exit is simply
               dead, which is worse than an error at build time. */
            err(where, 'exit "' + dir + '" uses unknown requirement "' + key + '"; the runtime will keep it shut forever.');
          }
        }
        if (exit.objReq && !objects[exit.objReq]) err(where, 'exit "' + dir + '" is gated on missing object "' + exit.objReq + '".');
        if (exit.objReq && exit.open === undefined && exit.lit === undefined) {
          warn(where, 'exit "' + dir + '" names objReq "' + exit.objReq + '" but tests neither open nor lit.');
        }
        void label;
      }

      for (const note of listOf(room.notes)) {
        if (!note.text) err(where, 'has a conditional note with no text.');
        checkConditions(note.when, where + ' note');
      }
    }

    /* ---------------- objects ---------------- */
    for (const id of objectIds) {
      const o = objects[id];
      const where = 'OBJECT ' + id;
      if (!o.name) err(where, 'has no name.');
      for (const at of listOf(o.at)) {
        if (at === 'inv') continue;
        if (!rooms[at]) err(where, 'starts in missing room "' + at + '".');
      }
      for (const child of listOf(o.contents)) {
        if (!objects[child]) err(where, 'contains missing object "' + child + '".');
      }
      if (listOf(o.contents).length && !o.container) {
        warn(where, 'has contents but is not marked container:true; they will never be reachable.');
      }
      if (o.key && !objects[o.key]) err(where, 'is unlocked by missing object "' + o.key + '".');
      if (o.locked && !o.key) warn(where, 'is locked with no key; only a rule can open it.');
      if (o.at === undefined && !isInsideSomething(id)) {
        warn(where, 'has no starting location and is in no container; only a rule can produce it.');
      }
    }

    function isInsideSomething(id) {
      for (const cid of objectIds) if (listOf(objects[cid].contents).includes(id)) return true;
      return false;
    }

    /* container cycles */
    const visiting = new Set(), done = new Set();
    function walkContainer(id, trail) {
      if (visiting.has(id)) { err('OBJECT ' + id, 'is inside itself (' + trail.concat(id).join(' → ') + ').'); return; }
      if (done.has(id)) return;
      visiting.add(id);
      for (const child of listOf(objects[id].contents)) {
        if (objects[child] && objects[child].container) walkContainer(child, trail.concat(id));
      }
      visiting.delete(id);
      done.add(id);
    }
    for (const id of objectIds) if (objects[id].container) walkContainer(id, []);

    /* ---------------- vocabulary ---------------- */
    const coreVerbs = ml.vocabulary ? Object.keys(ml.vocabulary.CORE_VERBS) : [];
    const cartVerbs = Object.keys((cartridge.vocabulary || {}).verbs || {});
    const knownVerbs = new Set(coreVerbs.concat(cartVerbs));
    const FORMS = ['none', 'target', 'text', 'direction', 'onoff', 'slot'];
    for (const verb of cartVerbs) {
      const spec = cartridge.vocabulary.verbs[verb];
      const where = 'VERB ' + verb;
      if (spec.form && !FORMS.includes(spec.form)) err(where, 'unknown form "' + spec.form + '" (known: ' + FORMS.join(', ') + ').');
      if (spec.as && !knownVerbs.has(spec.as)) err(where, 'aliases missing verb "' + spec.as + '".');
      if (!listOf(spec.words).length) warn(where, 'declares no words; only its canonical name will be typeable.');
    }

    /* ---------------- conditions ---------------- */
    function isRef(value) { return typeof value === 'string' && value.charAt(0) === '@'; }

    function checkRef(value, where, what) {
      if (!isRef(value)) return false;
      if (!knownRefs.includes(value)) err(where, 'unknown reference "' + value + '" in ' + what + ' (known: ' + knownRefs.join(', ') + ').');
      return true;
    }

    function checkObjectRef(value, where, what) {
      if (value === null || value === undefined || value === '*') return;
      if (checkRef(value, where, what)) return;
      if (!objects[value]) err(where, what + ' "' + value + '" does not exist.');
    }

    function checkConditions(when, where) {
      if (!when) return;
      for (const key in when) {
        if (!knownConditions.includes(key)) {
          err(where, 'unknown condition "' + key + '" (known: ' + knownConditions.join(', ') + ').');
          continue;
        }
        const value = when[key];
        if (key === 'room' || key === 'notRoom' || key === 'visited') {
          for (const rid of listOf(value)) {
            if (isRef(rid)) { checkRef(rid, where, key); continue; }
            if (!rooms[rid]) err(where, 'condition ' + key + ' names missing room "' + rid + '".');
          }
        } else if (['carrying', 'notCarrying', 'present', 'notPresent', 'placed', 'notPlaced'].includes(key)) {
          for (const oid of listOf(value)) checkObjectRef(oid, where, 'condition ' + key);
        } else if (key === 'flags') {
          for (const flag in value) {
            testedFlags.add(flag);
            if (typeof value[flag] !== 'boolean') err(where, 'flag condition "' + flag + '" must be true or false.');
          }
        } else if (key === 'open' || key === 'lit') {
          for (const oid in value) checkObjectRef(oid, where, 'condition ' + key);
        }
      }
    }

    function checkActions(steps, where) {
      for (const step of listOf(steps)) {
        if (!step || typeof step !== 'object') { err(where, 'action steps must be objects.'); continue; }
        for (const key in step) {
          if (key === 'cls' || key === 'reason') continue;
          if (!knownActions.includes(key)) {
            err(where, 'unknown action "' + key + '" (known: ' + knownActions.join(', ') + ').');
            continue;
          }
          const value = step[key];
          switch (key) {
            case 'set':
              if (typeof value === 'string') setFlags.add(value);
              else for (const flag in value) setFlags.add(flag);
              break;
            case 'clear':
              for (const flag of listOf(value)) setFlags.add(flag);
              break;
            case 'goto':
              if (!isRef(value) && !rooms[value]) err(where, 'goto names missing room "' + value + '".');
              break;
            case 'give': case 'take': case 'drop': case 'destroy':
            case 'open': case 'close': case 'unlock': case 'lock':
            case 'light': case 'douse': case 'refuel':
              for (const oid of listOf(value)) checkObjectRef(oid, where, 'action ' + key);
              break;
            case 'placeIn':
              if (!value || typeof value !== 'object') { err(where, 'placeIn needs { object, container }.'); break; }
              checkObjectRef(value.object, where, 'placeIn object');
              checkObjectRef(value.container, where, 'placeIn container');
              break;
            case 'score':
              if (typeof value !== 'number') err(where, 'score must be a number.');
              break;
            case 'end':
              if (!(cartridge.endings || []).some((e) => e.id === value)) err(where, 'ends with unknown ending "' + value + '".');
              break;
            case 'say': case 'die':
              if (!listOf(value).length) err(where, key + ' has nothing to say.');
              break;
            default: break;
          }
        }
      }
    }

    /* ---------------- rules ---------------- */
    const ruleIds = new Set();
    (cartridge.rules || []).forEach((rule, index) => {
      const where = 'RULE ' + (index + 1) + (rule.id ? ' (' + rule.id + ')' : '');
      if (!rule.id) warn(where, 'has no id; error messages will only be able to give its number.');
      else if (ruleIds.has(rule.id)) err(where, 'duplicate rule id "' + rule.id + '".');
      else ruleIds.add(rule.id);

      if (rule.verb === undefined && rule.phrase === undefined) {
        warn(where, 'matches no verb and no phrase, so it will try to answer every turn.');
      }
      for (const verb of listOf(rule.verb)) {
        if (!knownVerbs.has(verb)) err(where, 'matches unknown verb "' + verb + '"; add it to vocabulary.verbs.');
      }
      for (const slot of ['target', 'with']) {
        if (rule[slot] === undefined) continue;
        const values = rule[slot] === null ? [null] : listOf(rule[slot]);
        for (const value of values) {
          if (value === null || value === '*') continue;
          checkObjectRef(value, where, slot);
        }
      }
      if (rule.reach !== undefined && rule.reach !== 'anywhere') {
        err(where, 'reach must be "anywhere" if present, got ' + JSON.stringify(rule.reach) + '.');
      }
      checkConditions(rule.when, where);
      checkActions(rule.do, where);
      if (rule.otherwise) checkActions(rule.otherwise, where + ' otherwise');
      if (!listOf(rule.do).length && !rule.otherwise) err(where, 'does nothing.');
    });

    /* ---------------- gameplay profile ---------------- */
    const profile = cartridge.profile || {};
    const treasures = profile.treasures || {};
    if (treasures.enabled) {
      if (!listOf(treasures.list).length) err('PROFILE', 'treasures are enabled but the list is empty.');
      for (const id of listOf(treasures.list)) {
        if (!objects[id]) err('PROFILE', 'treasure list names missing object "' + id + '".');
        else if (!objects[id].takeable) err('PROFILE', 'treasure "' + id + '" is not takeable, so it can never be collected.');
      }
      if (treasures.securedIn && !objects[treasures.securedIn]) {
        err('PROFILE', 'treasures are secured in missing object "' + treasures.securedIn + '".');
      }
    }
    const light = profile.light || {};
    if (light.fuel) {
      if (!objects[light.fuel.object]) err('PROFILE', 'lamp fuel names missing object "' + light.fuel.object + '".');
      if (!(light.fuel.turns > 0)) err('PROFILE', 'lamp fuel needs a positive turn count.');
      const anyDark = roomIds.some((id) => rooms[id].dark);
      if (!anyDark) warn('PROFILE', 'lamp fuel is configured but no room is dark, so it will never burn.');
    }
    if ((profile.darkness || {}).enabled && !roomIds.some((id) => rooms[id].dark)) {
      warn('PROFILE', 'darkness is enabled but no room is marked dark.');
    }
    for (const timer of listOf(profile.timers)) {
      const where = 'TIMER ' + (timer.id || '?');
      if (!timer.id) err(where, 'timers need an id.');
      if (!(timer.after >= 0)) err(where, 'timers need an "after" turn count.');
      checkConditions(timer.when, where);
      checkActions(timer.do, where);
    }

    /* ---------------- outcomes ----------------
       An outcome says what happens when a system fails or fires. Its
       type set is closed for the same reason the action set is. */
    const outcomeTypes = (ml.outcome && ml.outcome.TYPES) || [];
    function checkOutcome(outcome, where) {
      if (!outcome) return;
      if (typeof outcome === 'string' || Array.isArray(outcome)) return;  // death shorthand
      if (!outcomeTypes.includes(outcome.type)) {
        err(where, 'unknown outcome type "' + outcome.type + '" (known: ' + outcomeTypes.join(', ') + ').');
        return;
      }
      switch (outcome.type) {
        case 'encounter':
          if (!(cartridge.encounters || {})[outcome.encounter]) {
            err(where, 'names missing encounter "' + outcome.encounter + '".');
          } else if (!(profileRaw.combat === true || (profileRaw.combat && profileRaw.combat.enabled !== false))) {
            err(where, 'starts encounter "' + outcome.encounter + '" but profile.combat is off, so it can never run.');
          }
          if (outcome.fallback) checkOutcome(outcome.fallback, where + ' fallback');
          break;
        case 'move':
          if (!rooms[outcome.room]) err(where, 'moves the player to missing room "' + outcome.room + '".');
          break;
        case 'end':
          if (!(cartridge.endings || []).some((e) => e.id === outcome.ending)) {
            err(where, 'names unknown ending "' + outcome.ending + '".');
          }
          break;
        case 'rules':
          checkActions(outcome.do, where);
          break;
        case 'death': case 'say':
          if (!listOf(outcome.text).length) err(where, 'has no text.');
          break;
        default: break;
      }
    }
    const profileRaw = cartridge.profile || {};
    checkOutcome((profileRaw.darkness || {}).onFail, 'DARKNESS onFail');

    /* ---------------- stats ---------------- */
    const statsRaw = profileRaw.stats;
    const statsOn = statsRaw === true || (statsRaw && statsRaw !== false && statsRaw.enabled !== false);
    /* `stats` omitted entirely is a different statement from `stats: false`.
       The first leaves the decision to the Machine; the second is the author
       saying this game has no character system — which combat contradicts,
       because a fight needs somewhere to keep the player's health. */
    const statsDeclaredOff = statsRaw === false || statsRaw === null ||
      (statsRaw && typeof statsRaw === 'object' && statsRaw.enabled === false);
    const statIds = statsOn ? Object.keys((statsRaw === true ? {} : statsRaw).list || {}) : [];
    if (statsOn) {
      if (!statIds.length) err('STATS', 'stats are enabled but no stat list is declared.');
      const classes = (statsRaw === true ? {} : statsRaw).classes || {};
      if (!Object.keys(classes).length) err('STATS', 'stats are enabled but no class is declared.');
      for (const id in classes) {
        for (const stat in (classes[id].stats || {})) {
          if (!statIds.includes(stat)) err('CLASS ' + id, 'starts with unknown stat "' + stat + '".');
        }
      }
      const health = (statsRaw === true ? {} : statsRaw).health || {};
      if (health.from && !statIds.includes(health.from)) {
        err('STATS', 'health is derived from unknown stat "' + health.from + '".');
      }
      const startClass = (statsRaw === true ? {} : statsRaw).startClass;
      if (startClass && !classes[startClass]) err('STATS', 'startClass "' + startClass + '" is not a declared class.');
      const awards = (statsRaw === true ? {} : statsRaw).awards || {};
      for (const trigger in awards) {
        if (trigger !== 'examine') err('STATS', 'unknown award trigger "' + trigger + '" (known: examine).');
        else if (!statIds.includes(awards[trigger].stat)) {
          err('STATS', 'the examine award names unknown stat "' + awards[trigger].stat + '".');
        }
      }
    }
    function checkStat(id, where, what) {
      if (!id) return;
      if (!statsOn) { err(where, what + ' names stat "' + id + '" but stats are switched off.'); return; }
      if (!statIds.includes(id)) err(where, what + ' names unknown stat "' + id + '" (known: ' + statIds.join(', ') + ').');
    }

    /* ---------------- encounters ---------------- */
    const combatOn = profileRaw.combat === true || (profileRaw.combat && profileRaw.combat.enabled !== false);

    /* The one constraint combat places on another capability. It belongs to
       combat, not to the encounter layer: a non-combat encounter would have
       no such requirement. */
    if (combatOn && statsDeclaredOff) {
      err('PROFILE', 'combat is enabled but stats is explicitly disabled. ' +
        'Combat needs somewhere to keep the player\'s health: configure stats, or disable combat.');
    }
    if (combatOn && statsRaw === undefined) {
      warn('PROFILE', 'combat is enabled and stats is not configured; the player will get a ' +
        'default health pool with no named stats, classes or growth. Declare `stats` to change that.');
    }
    const encounterKinds = (ml.encounter && ml.encounter.KINDS) || [];
    const actionKinds = (ml.encounter && ml.encounter.ACTION_KINDS) || [];
    for (const id in (cartridge.encounters || {})) {
      const enc = cartridge.encounters[id];
      const where = 'ENCOUNTER ' + id;
      if (!combatOn) { warn(where, 'is declared but profile.combat is off, so nothing can start it.'); }
      if (!encounterKinds.includes(enc.kind)) {
        err(where, 'unknown kind "' + enc.kind + '" (known: ' + encounterKinds.join(', ') + ').');
      }
      const opponent = enc.opponent || {};
      if (!opponent.name) err(where, 'has no opponent name.');
      if (!(opponent.hp > 0)) err(where, 'opponent needs positive hp.');
      if (opponent.attack && (!Array.isArray(opponent.attack) || opponent.attack.length !== 2)) {
        err(where, 'opponent attack must be a [low, high] pair.');
      }
      checkStat(enc.dodgeFrom, where, 'dodgeFrom');
      checkStat(enc.hurtTrains, where, 'hurtTrains');

      const seen = new Set();
      const actions = listOf(enc.actions);
      if (!actions.length) warn(where, 'declares no actions; the default attack/defend/flee set will be used.');
      for (const action of actions) {
        const label = where + ' action ' + (action.id || '?');
        if (!action.id) { err(label, 'actions need an id.'); continue; }
        if (seen.has(action.id)) err(label, 'duplicate action id.');
        seen.add(action.id);
        if (action.kind && !actionKinds.includes(action.kind)) {
          err(label, 'unknown action kind "' + action.kind + '" (known: ' + actionKinds.join(', ') + ').');
        }
        checkStat(action.uses, label, 'uses');
        checkStat(action.trains, label, 'trains');
        checkStat(action.bonusFrom, label, 'bonusFrom');
        checkStat(action.luck, label, 'luck');
        if (action.damage && (!Array.isArray(action.damage) || action.damage.length !== 2)) {
          err(label, 'damage must be a [low, high] pair.');
        }
        if (action.when) checkConditions(action.when, label);
        if (action.do) checkActions(action.do, label);
        if (action.when && !action.deny) warn(label, 'has a condition but no `deny` message to explain itself.');
      }
      for (const hook of ['onWin', 'onFlee', 'onDefeat']) {
        if (enc[hook]) checkOutcome(enc[hook], where + ' ' + hook);
      }
    }

    /* A rule that starts an encounter, or trains a stat, in a cartridge
       that has not switched the capability on. */
    for (const rule of (cartridge.rules || [])) {
      for (const step of listOf(rule.do).concat(listOf(rule.otherwise))) {
        if (!step) continue;
        const where = 'RULE ' + (rule.id || '?');
        if (step.encounter) {
          if (!(cartridge.encounters || {})[step.encounter]) err(where, 'starts missing encounter "' + step.encounter + '".');
          else if (!combatOn) err(where, 'starts an encounter but profile.combat is off.');
        }
        if (step.train) checkStat(step.train.stat || step.train, where, 'train');
        if ((step.heal !== undefined || step.hurt !== undefined) && !statsOn) {
          err(where, 'heals or hurts the player, but stats are switched off so there is no health to change.');
        }
        if (step.outcome) checkOutcome(step.outcome, where + ' outcome');
      }
    }

    /* ---------------- endings ---------------- */
    const endingIds = new Set();
    let hasWin = false;
    (cartridge.endings || []).forEach((ending, index) => {
      const where = 'ENDING ' + (index + 1) + (ending.id ? ' (' + ending.id + ')' : '');
      if (!ending.id) err(where, 'endings need an id.');
      else if (endingIds.has(ending.id)) err(where, 'duplicate ending id "' + ending.id + '".');
      else endingIds.add(ending.id);
      if (!listOf(ending.text).length) err(where, 'has no text.');
      if (ending.kind === 'win') hasWin = true;
      checkConditions(ending.when, where);
    });
    if (!hasWin && !(treasures.enabled && treasures.winOnAll !== false)) {
      warn('ENDINGS', 'nothing here can end the game in victory.');
    }
    if (treasures.enabled && treasures.winOnAll !== false && !hasWin) {
      err('ENDINGS', 'treasures.winOnAll is set but there is no ending with kind:"win" to fire.');
    }

    /* ---------------- flags ---------------- */
    for (const flag of testedFlags) {
      if (!setFlags.has(flag)) {
        err('FLAGS', 'flag "' + flag + '" is tested but never set; declare it in startFlags or set it in a rule.');
      }
    }
    for (const id of roomIds) {
      for (const dir in (rooms[id].exits || {})) {
        const exit = rooms[id].exits[dir];
        if (typeof exit === 'string') continue;
        for (const key of ['flagReq', 'flagNot']) {
          if (exit[key] && !setFlags.has(exit[key])) {
            err('ROOM ' + id, 'exit "' + dir + '" waits on flag "' + exit[key] + '", which no rule ever sets.');
          }
        }
      }
    }

    /* ---------------- presentation ---------------- */
    const presentation = cartridge.presentation || {};
    if (presentation.renderer && !RENDERERS.includes(presentation.renderer)) {
      err('DISPLAY', 'unknown renderer profile "' + presentation.renderer + '" (known: ' + RENDERERS.join(', ') + ').');
    }
    if (presentation.audio && !AUDIO.includes(presentation.audio)) {
      err('SOUND', 'unknown audio profile "' + presentation.audio + '" (known: ' + AUDIO.join(', ') + ').');
    }
    if (presentation.interface && !INTERFACES.includes(presentation.interface)) {
      err('INTERFACE', 'unknown interface profile "' + presentation.interface + '" (known: ' + INTERFACES.join(', ') + ').');
    }
    if (presentation.interface === 'canvas' && !(presentation.art && presentation.art.scene)) {
      warn('DISPLAY', 'the canvas interface is selected but the cartridge supplies no scene painters; rooms will be blank.');
    }

    /* ---------------- reachability ----------------
       Walk the map as a player who can eventually satisfy every gate,
       which is the honest question: is this room connected at all? */
    const reached = new Set();
    const queue = rooms[world.startRoom] ? [world.startRoom] : [];
    while (queue.length) {
      const id = queue.shift();
      if (reached.has(id)) continue;
      reached.add(id);
      for (const dir in (rooms[id].exits || {})) {
        const exit = rooms[id].exits[dir];
        const target = typeof exit === 'string' ? exit : exit && exit.room;
        if (target && rooms[target] && !reached.has(target)) queue.push(target);
      }
    }
    /* Rules can teleport, so a room a rule can `goto` counts as reached. */
    for (const rule of (cartridge.rules || [])) {
      for (const step of listOf(rule.do).concat(listOf(rule.otherwise))) {
        if (step && step.goto && rooms[step.goto]) reached.add(step.goto);
      }
    }
    for (const id of roomIds) {
      if (!reached.has(id)) warn('ROOM ' + id, 'is unreachable from ' + world.startRoom + '.');
    }
    /* A treasure in a room nobody can enter is a game that cannot be won. */
    for (const id of listOf(treasures.list)) {
      const homes = listOf((objects[id] || {}).at).filter((at) => at !== 'inv');
      if (!homes.length) continue;
      if (!homes.some((at) => reached.has(at))) {
        err('PROFILE', 'treasure "' + id + '" starts in unreachable room "' + homes[0] + '"; the game cannot be completed.');
      }
    }

    return { ok: errors.length === 0, errors, warnings, cartridge };
  }

  /* A single block of text a Workshop panel can print verbatim. */
  function report(result) {
    const lines = [];
    lines.push(result.ok ? 'CARTRIDGE VALIDATED — 0 errors' : 'COMPILATION HALTED — ' + result.errors.length + ' error' + (result.errors.length === 1 ? '' : 's'));
    for (const e of result.errors) lines.push('  ' + e);
    if (result.warnings.length) {
      lines.push(result.warnings.length + ' warning' + (result.warnings.length === 1 ? '' : 's') + ':');
      for (const w of result.warnings) lines.push('  ' + w);
    }
    return lines.join('\n');
  }

  ml.validator = { validate, report, RENDERERS, AUDIO, INTERFACES };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
