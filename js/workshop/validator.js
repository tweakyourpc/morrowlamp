/* ============================================================
   MORROWLAMP GAME WORKSHOP — cartridge validator
   Think like a compiler. A cartridge that cannot possibly work
   should be refused before it reaches a player, and refused with
   an address:

     RULE 17 (dig-the-crack): target "silver_key" does not exist.
     ROOM cellar: exit "s" targets missing room "tunel".
     DISPLAY: unknown renderer profile "svga" (known: cga, ega, vga).

   Every finding carries three things beyond that sentence: a
   stable `code` slug, a `path` into the cartridge, and a severity.
   The sentence is for a person reading the diagnostics panel; the
   code and path are for anything that wants to jump to the fault
   or repair it. `errors` and `warnings` stay plain strings so that
   everything already reading them keeps working; `findings` is the
   structured view of the same set.

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

  /* The sigil that makes a piece of text a lookup into cartridge.strings
     rather than the text itself. Deliberately not a bare {brace}: the rule
     dialect already expands {the target} inside prose, and the two must
     never be able to be mistaken for one another. */
  const STRING_REF = /^@s:([A-Za-z0-9._-]+)$/;

  function listOf(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }

  function validate(cartridge) {
    const findings = [];
    const record = (severity, code, where, path, message) => {
      findings.push({ severity, code, where, path, message, text: where + ': ' + message });
    };
    const err = (code, where, path, message) => record('error', code, where, path, message);
    const warn = (code, where, path, message) => record('warning', code, where, path, message);

    if (!cartridge || typeof cartridge !== 'object') {
      err('no-cartridge', 'CARTRIDGE', '', 'nothing to validate.');
      return finish();
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

    /* Likewise for the strings table: every @s: reference is collected as
       it is met, and reconciled against the declared keys at the end. */
    const strings = cartridge.strings || {};
    const usedStrings = new Set();

    /* ---------------- the strings table ----------------
       Any prose slot may hold '@s:some.key' instead of the text itself.
       Checking it here, in one place, is what makes the strings table a
       safe seam: a writer can rewrite every line in the game and the
       worst they can produce is a named key that does not resolve. */
    function checkText(value, where, path, what) {
      for (const line of listOf(value)) {
        const text = (line && typeof line === 'object') ? line.text : line;
        for (const one of listOf(text)) {
          if (typeof one !== 'string') continue;
          const match = STRING_REF.exec(one);
          if (!match) continue;
          usedStrings.add(match[1]);
          if (!Object.prototype.hasOwnProperty.call(strings, match[1])) {
            err('string-missing', where, path, (what ? what + ' ' : '') +
              'refers to string "' + match[1] + '", which is not in the strings table.');
          }
        }
      }
    }

    if (cartridge.strings !== undefined && (typeof strings !== 'object' || Array.isArray(strings))) {
      err('strings-not-a-table', 'STRINGS', 'strings', 'strings must be an object of key: text.');
    }
    for (const slot of ['intro', 'help', 'quitText']) {
      checkText(cartridge[slot], 'CARTRIDGE', slot, 'the ' + slot);
    }

    /* ---------------- metadata ---------------- */
    const meta = cartridge.meta || {};
    if (!meta.id || !/^[a-z0-9][a-z0-9-]*$/.test(String(meta.id))) {
      err('meta-id', 'META', 'meta.id', 'id must be a lowercase slug (letters, digits, hyphens), got ' + JSON.stringify(meta.id));
    }
    if (!meta.title || !String(meta.title).trim()) err('meta-title', 'META', 'meta.title', 'title is required.');
    if (!meta.version) warn('meta-version', 'META', 'meta.version', 'no version; compiled games will be stamped "0.0.0".');

    const world = cartridge.world || {};
    const rooms = world.rooms || {};
    const objects = world.objects || {};
    const roomIds = Object.keys(rooms);
    const objectIds = Object.keys(objects);

    if (!roomIds.length) err('no-rooms', 'WORLD', 'world.rooms', 'a cartridge needs at least one room.');

    /* ---------------- duplicate ids ----------------
       Object keys cannot literally repeat, so the duplicate that can
       actually happen is an `id` field disagreeing with its key. */
    for (const id of roomIds) {
      if (rooms[id].id !== undefined && rooms[id].id !== id) {
        err('room-id-conflict', 'ROOM ' + id, 'world.rooms.' + id + '.id', 'declares a conflicting id "' + rooms[id].id + '".');
      }
    }
    for (const id of objectIds) {
      if (objects[id].id !== undefined && objects[id].id !== id) {
        err('object-id-conflict', 'OBJECT ' + id, 'world.objects.' + id + '.id', 'declares a conflicting id "' + objects[id].id + '".');
      }
      if (rooms[id]) warn('id-shared-with-room', 'OBJECT ' + id, 'world.objects.' + id, 'shares its id with a room; harmless, but confusing to read.');
    }

    /* ---------------- start state ---------------- */
    if (!world.startRoom) err('no-start-room', 'WORLD', 'world.startRoom', 'startRoom is required.');
    else if (!rooms[world.startRoom]) err('start-room-missing', 'WORLD', 'world.startRoom', 'startRoom "' + world.startRoom + '" is not a room.');
    for (const id of listOf(world.startInventory)) {
      if (!objects[id]) err('start-item-missing', 'WORLD', 'world.startInventory', 'startInventory names missing object "' + id + '".');
      else if (objects[id].takeable === false) warn('start-item-fixed', 'WORLD', 'world.startInventory', 'startInventory holds "' + id + '", which is marked not takeable.');
    }

    /* ---------------- rooms and exits ---------------- */
    const KNOWN_EXIT_KEYS = (ml.world && ml.world.KNOWN_EXIT_KEYS) || ['room', 'flagReq', 'flagNot', 'objReq', 'open', 'lit', 'deny', 'note'];
    for (const id of roomIds) {
      const room = rooms[id];
      const where = 'ROOM ' + id;
      const base = 'world.rooms.' + id;
      if (!room.name) err('room-no-name', where, base + '.name', 'has no name.');
      if (!room.desc) warn('room-no-desc', where, base + '.desc', 'has no description; the player will arrive somewhere blank.');
      checkText(room.desc, where, base + '.desc', 'the description');
      checkText(room.short, where, base + '.short', 'the short description');

      for (const dir in (room.exits || {})) {
        const exit = room.exits[dir];
        const path = base + '.exits.' + dir;
        if (typeof exit === 'string') {
          if (!rooms[exit]) err('exit-missing-room', where, path, 'exit "' + dir + '" targets missing room "' + exit + '".');
          continue;
        }
        if (!exit || typeof exit !== 'object') { err('exit-malformed', where, path, 'exit "' + dir + '" is neither a room id nor an exit object.'); continue; }
        if (exit.room && !rooms[exit.room]) err('exit-missing-room', where, path, 'exit "' + dir + '" targets missing room "' + exit.room + '".');
        if (!exit.room && !exit.deny) warn('exit-nowhere', where, path, 'exit "' + dir + '" leads nowhere and says nothing about it.');
        for (const key in exit) {
          if (!KNOWN_EXIT_KEYS.includes(key)) {
            /* This is the guardReq class of bug: a requirement the runtime
               has never heard of. It fails closed, so the exit is simply
               dead, which is worse than an error at build time. */
            err('exit-unknown-requirement', where, path + '.' + key,
              'exit "' + dir + '" uses unknown requirement "' + key + '"; the runtime will keep it shut forever.');
          }
        }
        if (exit.objReq && !objects[exit.objReq]) err('exit-missing-objreq', where, path + '.objReq', 'exit "' + dir + '" is gated on missing object "' + exit.objReq + '".');
        if (exit.objReq && exit.open === undefined && exit.lit === undefined) {
          warn('exit-objreq-untested', where, path + '.objReq', 'exit "' + dir + '" names objReq "' + exit.objReq + '" but tests neither open nor lit.');
        }
        checkText(exit.deny, where, path + '.deny', 'the deny message');
      }

      listOf(room.notes).forEach((note, i) => {
        const path = base + '.notes[' + i + ']';
        if (!note.text) err('note-no-text', where, path, 'has a conditional note with no text.');
        checkText(note.text, where, path + '.text', 'the note');
        checkConditions(note.when, where + ' note', path + '.when');
      });
    }

    /* ---------------- objects ---------------- */
    for (const id of objectIds) {
      const o = objects[id];
      const where = 'OBJECT ' + id;
      const base = 'world.objects.' + id;
      if (!o.name) err('object-no-name', where, base + '.name', 'has no name.');
      checkText(o.desc, where, base + '.desc', 'the description');
      checkText(o.examine, where, base + '.examine', 'the examine text');
      for (const slot of ['takeText', 'cannotTake', 'openText', 'read']) {
        checkText(o[slot], where, base + '.' + slot, 'the ' + slot);
      }
      for (const at of listOf(o.at)) {
        if (at === 'inv') continue;
        if (!rooms[at]) err('object-missing-room', where, base + '.at', 'starts in missing room "' + at + '".');
      }
      for (const child of listOf(o.contents)) {
        if (!objects[child]) err('object-missing-content', where, base + '.contents', 'contains missing object "' + child + '".');
      }
      if (listOf(o.contents).length && !o.container) {
        warn('contents-not-container', where, base + '.container', 'has contents but is not marked container:true; they will never be reachable.');
      }
      if (o.key && !objects[o.key]) err('object-missing-key', where, base + '.key', 'is unlocked by missing object "' + o.key + '".');
      if (o.locked && !o.key) warn('locked-no-key', where, base + '.key', 'is locked with no key; only a rule can open it.');
      if (o.at === undefined && !isInsideSomething(id)) {
        warn('object-no-home', where, base + '.at', 'has no starting location and is in no container; only a rule can produce it.');
      }
    }

    function isInsideSomething(id) {
      for (const cid of objectIds) if (listOf(objects[cid].contents).includes(id)) return true;
      return false;
    }

    /* container cycles */
    const visiting = new Set(), done = new Set();
    function walkContainer(id, trail) {
      if (visiting.has(id)) { err('container-cycle', 'OBJECT ' + id, 'world.objects.' + id + '.contents', 'is inside itself (' + trail.concat(id).join(' → ') + ').'); return; }
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
      const base = 'vocabulary.verbs.' + verb;
      if (spec.form && !FORMS.includes(spec.form)) err('verb-unknown-form', where, base + '.form', 'unknown form "' + spec.form + '" (known: ' + FORMS.join(', ') + ').');
      if (spec.as && !knownVerbs.has(spec.as)) err('verb-alias-missing', where, base + '.as', 'aliases missing verb "' + spec.as + '".');
      if (!listOf(spec.words).length) warn('verb-no-words', where, base + '.words', 'declares no words; only its canonical name will be typeable.');
      checkText(spec.prompt, where, base + '.prompt', 'the prompt');
      checkText(spec.fallback, where, base + '.fallback', 'the fallback');
    }

    /* ---------------- conditions ---------------- */
    function isRef(value) { return typeof value === 'string' && value.charAt(0) === '@'; }

    function checkRef(value, where, path, what) {
      if (!isRef(value)) return false;
      if (!knownRefs.includes(value)) err('unknown-reference', where, path, 'unknown reference "' + value + '" in ' + what + ' (known: ' + knownRefs.join(', ') + ').');
      return true;
    }

    function checkObjectRef(value, where, path, what) {
      if (value === null || value === undefined || value === '*') return;
      if (checkRef(value, where, path, what)) return;
      if (!objects[value]) err('missing-object', where, path, what + ' "' + value + '" does not exist.');
    }

    function checkConditions(when, where, path) {
      if (!when) return;
      for (const key in when) {
        const at = path + '.' + key;
        if (!knownConditions.includes(key)) {
          err('unknown-condition', where, at, 'unknown condition "' + key + '" (known: ' + knownConditions.join(', ') + ').');
          continue;
        }
        const value = when[key];
        if (key === 'room' || key === 'notRoom' || key === 'visited') {
          for (const rid of listOf(value)) {
            if (isRef(rid)) { checkRef(rid, where, at, key); continue; }
            if (!rooms[rid]) err('missing-room', where, at, 'condition ' + key + ' names missing room "' + rid + '".');
          }
        } else if (['carrying', 'notCarrying', 'present', 'notPresent', 'placed', 'notPlaced'].includes(key)) {
          for (const oid of listOf(value)) checkObjectRef(oid, where, at, 'condition ' + key);
        } else if (key === 'flags') {
          for (const flag in value) {
            testedFlags.add(flag);
            if (typeof value[flag] !== 'boolean') err('flag-not-boolean', where, at + '.' + flag, 'flag condition "' + flag + '" must be true or false.');
          }
        } else if (key === 'open' || key === 'lit') {
          for (const oid in value) checkObjectRef(oid, where, at + '.' + oid, 'condition ' + key);
        }
      }
    }

    function checkActions(steps, where, path) {
      listOf(steps).forEach((step, i) => {
        const stepPath = path + '[' + i + ']';
        if (!step || typeof step !== 'object') { err('action-not-object', where, stepPath, 'action steps must be objects.'); return; }
        for (const key in step) {
          if (key === 'cls' || key === 'reason') continue;
          const at = stepPath + '.' + key;
          if (!knownActions.includes(key)) {
            err('unknown-action', where, at, 'unknown action "' + key + '" (known: ' + knownActions.join(', ') + ').');
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
              if (!isRef(value) && !rooms[value]) err('missing-room', where, at, 'goto names missing room "' + value + '".');
              break;
            case 'give': case 'take': case 'drop': case 'destroy':
            case 'open': case 'close': case 'unlock': case 'lock':
            case 'light': case 'douse': case 'refuel':
              for (const oid of listOf(value)) checkObjectRef(oid, where, at, 'action ' + key);
              break;
            case 'placeIn':
              if (!value || typeof value !== 'object') { err('placein-malformed', where, at, 'placeIn needs { object, container }.'); break; }
              checkObjectRef(value.object, where, at + '.object', 'placeIn object');
              checkObjectRef(value.container, where, at + '.container', 'placeIn container');
              break;
            case 'score':
              if (typeof value !== 'number') err('score-not-number', where, at, 'score must be a number.');
              break;
            case 'end':
              if (!(cartridge.endings || []).some((e) => e.id === value)) err('unknown-ending', where, at, 'ends with unknown ending "' + value + '".');
              break;
            case 'say': case 'die':
              if (!listOf(value).length) err('nothing-to-say', where, at, key + ' has nothing to say.');
              checkText(value, where, at, 'the ' + key);
              break;
            default: break;
          }
        }
      });
    }

    /* ---------------- rules ---------------- */
    const ruleIds = new Set();
    (cartridge.rules || []).forEach((rule, index) => {
      const where = 'RULE ' + (index + 1) + (rule.id ? ' (' + rule.id + ')' : '');
      const base = 'rules[' + index + ']';
      if (!rule.id) warn('rule-no-id', where, base + '.id', 'has no id; error messages will only be able to give its number.');
      else if (ruleIds.has(rule.id)) err('rule-duplicate-id', where, base + '.id', 'duplicate rule id "' + rule.id + '".');
      else ruleIds.add(rule.id);

      if (rule.verb === undefined && rule.phrase === undefined) {
        warn('rule-matches-anything', where, base, 'matches no verb and no phrase, so it will try to answer every turn.');
      }
      for (const verb of listOf(rule.verb)) {
        if (!knownVerbs.has(verb)) err('rule-unknown-verb', where, base + '.verb', 'matches unknown verb "' + verb + '"; add it to vocabulary.verbs.');
      }
      for (const slot of ['target', 'with']) {
        if (rule[slot] === undefined) continue;
        const values = rule[slot] === null ? [null] : listOf(rule[slot]);
        for (const value of values) {
          if (value === null || value === '*') continue;
          checkObjectRef(value, where, base + '.' + slot, slot);
        }
      }
      if (rule.reach !== undefined && rule.reach !== 'anywhere') {
        err('rule-bad-reach', where, base + '.reach', 'reach must be "anywhere" if present, got ' + JSON.stringify(rule.reach) + '.');
      }
      checkConditions(rule.when, where, base + '.when');
      checkActions(rule.do, where, base + '.do');
      if (rule.otherwise) checkActions(rule.otherwise, where + ' otherwise', base + '.otherwise');
      if (!listOf(rule.do).length && !rule.otherwise) err('rule-does-nothing', where, base, 'does nothing.');
    });

    /* ---------------- gameplay profile ---------------- */
    const profile = cartridge.profile || {};
    const treasures = profile.treasures || {};
    if (treasures.enabled) {
      if (!listOf(treasures.list).length) err('treasures-empty', 'PROFILE', 'profile.treasures.list', 'treasures are enabled but the list is empty.');
      for (const id of listOf(treasures.list)) {
        if (!objects[id]) err('treasure-missing', 'PROFILE', 'profile.treasures.list', 'treasure list names missing object "' + id + '".');
        else if (!objects[id].takeable) err('treasure-not-takeable', 'PROFILE', 'world.objects.' + id + '.takeable', 'treasure "' + id + '" is not takeable, so it can never be collected.');
      }
      if (treasures.securedIn && !objects[treasures.securedIn]) {
        err('treasure-case-missing', 'PROFILE', 'profile.treasures.securedIn', 'treasures are secured in missing object "' + treasures.securedIn + '".');
      }
    }
    const light = profile.light || {};
    if (light.fuel) {
      if (!objects[light.fuel.object]) err('fuel-object-missing', 'PROFILE', 'profile.light.fuel.object', 'lamp fuel names missing object "' + light.fuel.object + '".');
      if (!(light.fuel.turns > 0)) err('fuel-no-turns', 'PROFILE', 'profile.light.fuel.turns', 'lamp fuel needs a positive turn count.');
      const anyDark = roomIds.some((id) => rooms[id].dark);
      if (!anyDark) warn('fuel-never-burns', 'PROFILE', 'profile.light.fuel', 'lamp fuel is configured but no room is dark, so it will never burn.');
    }
    if ((profile.darkness || {}).enabled && !roomIds.some((id) => rooms[id].dark)) {
      warn('darkness-no-dark-room', 'PROFILE', 'profile.darkness', 'darkness is enabled but no room is marked dark.');
    }
    listOf(profile.timers).forEach((timer, i) => {
      const where = 'TIMER ' + (timer.id || '?');
      const base = 'profile.timers[' + i + ']';
      if (!timer.id) err('timer-no-id', where, base + '.id', 'timers need an id.');
      if (!(timer.after >= 0)) err('timer-no-after', where, base + '.after', 'timers need an "after" turn count.');
      checkConditions(timer.when, where, base + '.when');
      checkActions(timer.do, where, base + '.do');
    });

    /* ---------------- outcomes ----------------
       An outcome says what happens when a system fails or fires. Its
       type set is closed for the same reason the action set is. */
    const outcomeTypes = (ml.outcome && ml.outcome.TYPES) || [];
    function checkOutcome(outcome, where, path) {
      if (!outcome) return;
      if (typeof outcome === 'string' || Array.isArray(outcome)) { checkText(outcome, where, path, 'the text'); return; }
      if (!outcomeTypes.includes(outcome.type)) {
        err('unknown-outcome-type', where, path + '.type', 'unknown outcome type "' + outcome.type + '" (known: ' + outcomeTypes.join(', ') + ').');
        return;
      }
      /* Every outcome shape may carry a line to print alongside whatever
         else it does, so the text check belongs before the switch. */
      checkText(outcome.text, where, path + '.text', 'the text');
      switch (outcome.type) {
        case 'encounter':
          if (!(cartridge.encounters || {})[outcome.encounter]) {
            err('missing-encounter', where, path + '.encounter', 'names missing encounter "' + outcome.encounter + '".');
          } else if (!(profileRaw.combat === true || (profileRaw.combat && profileRaw.combat.enabled !== false))) {
            err('encounter-combat-off', where, path + '.encounter', 'starts encounter "' + outcome.encounter + '" but profile.combat is off, so it can never run.');
          }
          if (outcome.fallback) checkOutcome(outcome.fallback, where + ' fallback', path + '.fallback');
          break;
        case 'move':
          if (!rooms[outcome.room]) err('missing-room', where, path + '.room', 'moves the player to missing room "' + outcome.room + '".');
          break;
        case 'end':
          if (!(cartridge.endings || []).some((e) => e.id === outcome.ending)) {
            err('unknown-ending', where, path + '.ending', 'names unknown ending "' + outcome.ending + '".');
          }
          break;
        case 'rules':
          checkActions(outcome.do, where, path + '.do');
          break;
        case 'death': case 'say':
          if (!listOf(outcome.text).length) err('outcome-no-text', where, path + '.text', 'has no text.');
          checkText(outcome.text, where, path + '.text', 'the text');
          break;
        default: break;
      }
    }
    const profileRaw = cartridge.profile || {};
    checkOutcome((profileRaw.darkness || {}).onFail, 'DARKNESS onFail', 'profile.darkness.onFail');

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
      if (!statIds.length) err('stats-no-list', 'STATS', 'profile.stats.list', 'stats are enabled but no stat list is declared.');
      const classes = (statsRaw === true ? {} : statsRaw).classes || {};
      if (!Object.keys(classes).length) err('stats-no-classes', 'STATS', 'profile.stats.classes', 'stats are enabled but no class is declared.');
      for (const id in classes) {
        for (const stat in (classes[id].stats || {})) {
          if (!statIds.includes(stat)) err('class-unknown-stat', 'CLASS ' + id, 'profile.stats.classes.' + id + '.stats.' + stat, 'starts with unknown stat "' + stat + '".');
        }
      }
      const health = (statsRaw === true ? {} : statsRaw).health || {};
      if (health.from && !statIds.includes(health.from)) {
        err('health-unknown-stat', 'STATS', 'profile.stats.health.from', 'health is derived from unknown stat "' + health.from + '".');
      }
      const startClass = (statsRaw === true ? {} : statsRaw).startClass;
      if (startClass && !classes[startClass]) err('unknown-start-class', 'STATS', 'profile.stats.startClass', 'startClass "' + startClass + '" is not a declared class.');
      /* Triggers the runtime fires by itself, plus any name a rule invokes
         with `{ award: '…' }` — a cartridge may define its own moments. */
      const BUILT_IN_TRIGGERS = ['examine', 'treasureFound', 'treasureSecured'];
      const ruleTriggers = new Set();
      for (const rule of (cartridge.rules || [])) {
        for (const step of listOf(rule.do).concat(listOf(rule.otherwise))) {
          if (step && step.award) ruleTriggers.add(step.award);
        }
      }
      const awards = (statsRaw === true ? {} : statsRaw).awards || {};
      for (const trigger in awards) {
        const at = 'profile.stats.awards.' + trigger;
        if (!BUILT_IN_TRIGGERS.includes(trigger) && !ruleTriggers.has(trigger)) {
          err('award-never-fired', 'STATS', at, 'award trigger "' + trigger + '" is never fired (built in: ' +
            BUILT_IN_TRIGGERS.join(', ') + '; or name it in a rule\'s { award: … }).');
        }
        const spec = awards[trigger] || {};
        if (spec.stat && !statIds.includes(spec.stat)) {
          err('award-unknown-stat', 'STATS', at + '.stat', 'the ' + trigger + ' award names unknown stat "' + spec.stat + '".');
        }
        if (!spec.stat && !spec.xp) err('award-grants-nothing', 'STATS', at, 'the ' + trigger + ' award grants nothing.');
      }
      for (const trigger of ruleTriggers) {
        if (!awards[trigger]) err('award-undeclared', 'STATS', 'profile.stats.awards', 'a rule fires award "' + trigger + '", which is not declared in stats.awards.');
      }

      /* Exertion says which ordinary verbs are physical work. Both halves
         have to be real: a verb nobody can type trains nothing, and a stat
         that does not exist is a typo the author wants to hear about. */
      const exertion = (statsRaw === true ? {} : statsRaw).exertion || {};
      for (const verb in exertion) {
        const at = 'profile.stats.exertion.' + verb;
        if (!knownVerbs.has(verb)) {
          err('exertion-unknown-verb', 'STATS', at, 'exertion names unknown verb "' + verb + '"; add it to vocabulary.verbs.');
        }
        const spec = exertion[verb];
        const statId = (spec && typeof spec === 'object') ? spec.stat : spec;
        if (!statId) { err('exertion-no-stat', 'STATS', at, 'the ' + verb + ' exertion names no stat.'); continue; }
        if (!statIds.includes(statId)) {
          err('exertion-unknown-stat', 'STATS', at, 'the ' + verb + ' exertion names unknown stat "' + statId + '".');
        }
      }
    }
    function checkStat(id, where, path, what) {
      if (!id) return;
      if (!statsOn) { err('stat-while-off', where, path, what + ' names stat "' + id + '" but stats are switched off.'); return; }
      if (!statIds.includes(id)) err('unknown-stat', where, path, what + ' names unknown stat "' + id + '" (known: ' + statIds.join(', ') + ').');
    }

    /* ---------------- encounters ---------------- */
    const combatOn = profileRaw.combat === true || (profileRaw.combat && profileRaw.combat.enabled !== false);

    /* The one constraint combat places on another capability. It belongs to
       combat, not to the encounter layer: a non-combat encounter would have
       no such requirement. */
    if (combatOn && statsDeclaredOff) {
      err('combat-without-stats', 'PROFILE', 'profile.stats', 'combat is enabled but stats is explicitly disabled. ' +
        'Combat needs somewhere to keep the player\'s health: configure stats, or disable combat.');
    }
    if (combatOn && statsRaw === undefined) {
      warn('combat-default-stats', 'PROFILE', 'profile.stats', 'combat is enabled and stats is not configured; the player will get a ' +
        'default health pool with no named stats, classes or growth. Declare `stats` to change that.');
    }
    const encounterKinds = (ml.encounter && ml.encounter.KINDS) || [];
    const actionKinds = (ml.encounter && ml.encounter.ACTION_KINDS) || [];
    for (const id in (cartridge.encounters || {})) {
      const enc = cartridge.encounters[id];
      const where = 'ENCOUNTER ' + id;
      const base = 'encounters.' + id;
      if (!combatOn) { warn('encounter-unstartable', where, base, 'is declared but profile.combat is off, so nothing can start it.'); }
      if (!encounterKinds.includes(enc.kind)) {
        err('encounter-unknown-kind', where, base + '.kind', 'unknown kind "' + enc.kind + '" (known: ' + encounterKinds.join(', ') + ').');
      }
      const opponent = enc.opponent || {};
      if (!opponent.name) err('opponent-no-name', where, base + '.opponent.name', 'has no opponent name.');
      if (!(opponent.hp > 0)) err('opponent-no-hp', where, base + '.opponent.hp', 'opponent needs positive hp.');
      if (opponent.attack && (!Array.isArray(opponent.attack) || opponent.attack.length !== 2)) {
        err('opponent-bad-attack', where, base + '.opponent.attack', 'opponent attack must be a [low, high] pair.');
      }
      checkStat(enc.dodgeFrom, where, base + '.dodgeFrom', 'dodgeFrom');
      checkStat(enc.hurtTrains, where, base + '.hurtTrains', 'hurtTrains');
      for (const slot of ['intro', 'hit', 'miss', 'defeated']) checkText(enc[slot], where, base + '.' + slot, 'the ' + slot + ' text');

      const seen = new Set();
      const actions = listOf(enc.actions);
      if (!actions.length) warn('encounter-no-actions', where, base + '.actions', 'declares no actions; the default attack/defend/flee set will be used.');
      actions.forEach((action, i) => {
        const label = where + ' action ' + (action.id || '?');
        const at = base + '.actions[' + i + ']';
        if (!action.id) { err('action-no-id', label, at + '.id', 'actions need an id.'); return; }
        if (seen.has(action.id)) err('action-duplicate-id', label, at + '.id', 'duplicate action id.');
        seen.add(action.id);
        if (action.kind && !actionKinds.includes(action.kind)) {
          err('action-unknown-kind', label, at + '.kind', 'unknown action kind "' + action.kind + '" (known: ' + actionKinds.join(', ') + ').');
        }
        checkStat(action.uses, label, at + '.uses', 'uses');
        checkStat(action.trains, label, at + '.trains', 'trains');
        checkStat(action.bonusFrom, label, at + '.bonusFrom', 'bonusFrom');
        checkStat(action.luck, label, at + '.luck', 'luck');
        if (action.damage && (!Array.isArray(action.damage) || action.damage.length !== 2)) {
          err('action-bad-damage', label, at + '.damage', 'damage must be a [low, high] pair.');
        }
        if (action.when) checkConditions(action.when, label, at + '.when');
        if (action.do) checkActions(action.do, label, at + '.do');
        checkText(action.deny, label, at + '.deny', 'the deny message');
        for (const slot of ['hitText', 'missText', 'text', 'failText']) {
          checkText(action[slot], label, at + '.' + slot, 'the ' + slot);
        }
        if (action.when && !action.deny) warn('action-silent-condition', label, at + '.deny', 'has a condition but no `deny` message to explain itself.');
      });
      for (const hook of ['onWin', 'onFlee', 'onDefeat']) {
        if (enc[hook]) checkOutcome(enc[hook], where + ' ' + hook, base + '.' + hook);
      }
    }

    /* A rule that starts an encounter, or trains a stat, in a cartridge
       that has not switched the capability on. */
    (cartridge.rules || []).forEach((rule, index) => {
      const base = 'rules[' + index + ']';
      listOf(rule.do).concat(listOf(rule.otherwise)).forEach((step) => {
        if (!step) return;
        const where = 'RULE ' + (rule.id || '?');
        if (step.encounter) {
          if (!(cartridge.encounters || {})[step.encounter]) err('missing-encounter', where, base, 'starts missing encounter "' + step.encounter + '".');
          else if (!combatOn) err('encounter-combat-off', where, base, 'starts an encounter but profile.combat is off.');
        }
        if (step.train) checkStat(step.train.stat || step.train, where, base, 'train');
        if ((step.heal !== undefined || step.hurt !== undefined) && !statsOn) {
          err('heal-without-stats', where, base, 'heals or hurts the player, but stats are switched off so there is no health to change.');
        }
        if (step.outcome) checkOutcome(step.outcome, where + ' outcome', base);
      });
    });

    /* ---------------- endings ---------------- */
    const endingIds = new Set();
    let hasWin = false;
    (cartridge.endings || []).forEach((ending, index) => {
      const where = 'ENDING ' + (index + 1) + (ending.id ? ' (' + ending.id + ')' : '');
      const base = 'endings[' + index + ']';
      if (!ending.id) err('ending-no-id', where, base + '.id', 'endings need an id.');
      else if (endingIds.has(ending.id)) err('ending-duplicate-id', where, base + '.id', 'duplicate ending id "' + ending.id + '".');
      else endingIds.add(ending.id);
      if (!listOf(ending.text).length) err('ending-no-text', where, base + '.text', 'has no text.');
      checkText(ending.text, where, base + '.text', 'the text');
      if (ending.kind === 'win') hasWin = true;
      checkConditions(ending.when, where, base + '.when');
    });
    if (!hasWin && !(treasures.enabled && treasures.winOnAll !== false)) {
      warn('no-victory', 'ENDINGS', 'endings', 'nothing here can end the game in victory.');
    }
    if (treasures.enabled && treasures.winOnAll !== false && !hasWin) {
      err('no-win-ending', 'ENDINGS', 'endings', 'treasures.winOnAll is set but there is no ending with kind:"win" to fire.');
    }

    /* ---------------- flags ---------------- */
    for (const flag of testedFlags) {
      if (!setFlags.has(flag)) {
        err('flag-never-set', 'FLAGS', 'startFlags.' + flag, 'flag "' + flag + '" is tested but never set; declare it in startFlags or set it in a rule.');
      }
    }
    for (const id of roomIds) {
      for (const dir in (rooms[id].exits || {})) {
        const exit = rooms[id].exits[dir];
        if (typeof exit === 'string') continue;
        for (const key of ['flagReq', 'flagNot']) {
          if (exit[key] && !setFlags.has(exit[key])) {
            err('exit-flag-never-set', 'ROOM ' + id, 'world.rooms.' + id + '.exits.' + dir + '.' + key,
              'exit "' + dir + '" waits on flag "' + exit[key] + '", which no rule ever sets.');
          }
        }
      }
    }

    /* ---------------- unused strings ----------------
       Not an error: a writer may stage prose ahead of the rule that will
       use it, and a key retired from one draft is not a broken game.

       A key that overrides one of the Machine's own system messages is
       used by definition — nothing in the cartridge points at it, the
       runtime reads it directly. */
    const systemStrings = (ml.runtime && ml.runtime.SYSTEM_STRINGS) || {};
    for (const key in strings) {
      if (Object.prototype.hasOwnProperty.call(systemStrings, key)) continue;
      if (!usedStrings.has(key)) {
        warn('string-unused', 'STRINGS', 'strings.' + key, 'string "' + key + '" is declared but nothing refers to it.');
      }
    }

    /* ---------------- presentation ---------------- */
    const presentation = cartridge.presentation || {};
    if (presentation.renderer && !RENDERERS.includes(presentation.renderer)) {
      err('unknown-renderer', 'DISPLAY', 'presentation.renderer', 'unknown renderer profile "' + presentation.renderer + '" (known: ' + RENDERERS.join(', ') + ').');
    }
    if (presentation.audio && !AUDIO.includes(presentation.audio)) {
      err('unknown-audio', 'SOUND', 'presentation.audio', 'unknown audio profile "' + presentation.audio + '" (known: ' + AUDIO.join(', ') + ').');
    }
    if (presentation.interface && !INTERFACES.includes(presentation.interface)) {
      err('unknown-interface', 'INTERFACE', 'presentation.interface', 'unknown interface profile "' + presentation.interface + '" (known: ' + INTERFACES.join(', ') + ').');
    }
    if (presentation.interface === 'canvas' && !(presentation.art && presentation.art.scene)) {
      warn('canvas-no-art', 'DISPLAY', 'presentation.art.scene', 'the canvas interface is selected but the cartridge supplies no scene painters; rooms will be blank.');
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
      if (!reached.has(id)) warn('room-unreachable', 'ROOM ' + id, 'world.rooms.' + id, 'is unreachable from ' + world.startRoom + '.');
    }
    /* A treasure in a room nobody can enter is a game that cannot be won. */
    for (const id of listOf(treasures.list)) {
      const homes = listOf((objects[id] || {}).at).filter((at) => at !== 'inv');
      if (!homes.length) continue;
      if (!homes.some((at) => reached.has(at))) {
        err('treasure-unreachable', 'PROFILE', 'world.objects.' + id + '.at', 'treasure "' + id + '" starts in unreachable room "' + homes[0] + '"; the game cannot be completed.');
      }
    }

    return finish();

    /* One place builds the result, so the string view and the structured
       view can never disagree about what was found. */
    function finish() {
      const errors = findings.filter((f) => f.severity === 'error');
      const warnings = findings.filter((f) => f.severity === 'warning');
      return {
        ok: errors.length === 0,
        errors: errors.map((f) => f.text),
        warnings: warnings.map((f) => f.text),
        findings,
        cartridge
      };
    }
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

  ml.validator = { validate, report, RENDERERS, AUDIO, INTERFACES, STRING_REF };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
