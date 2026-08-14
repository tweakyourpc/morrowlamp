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

   THREE PROPERTIES THIS FILE HAS TO HAVE, all three of which it
   lacked when an audit went looking:

   1. IT FAILS CLOSED ON FORMAT AND VERSION. A cartridge that does
      not say what it is, or says a version this build does not
      implement, is refused. There is no migration framework and no
      "accept unknown for flexibility": a version is supported when
      it appears in SUPPORTED_VERSIONS and not before.

   2. IT IS TOTAL. Every input is a diagnostic, never an exception.
      This file is pointed at files a stranger wrote; assuming a
      collection is a collection or an entry is an object is the
      same mistake as assuming a rule's target exists. Collections
      are shape-checked before they are iterated, entries before
      they are dereferenced, and recursive structures are bounded.

   3. ITS PROSE COVERAGE MATCHES THE RUNTIME'S. Every slot the
      runtime resolves '@s:' references in is declared here, and
      the whole cartridge is then swept for reference-shaped values
      sitting anywhere else. A reference the runtime would print
      raw is a build error, not a surprise in somebody's transcript.

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

  /* ---------------- the format contract ----------------
     What this build of the Workshop knows how to run. A cartridge
     naming anything else is refused rather than guessed at: a future
     dialect that quietly half-works is worse than one that is turned
     away at the door. */
  const FORMAT = 'morrowlamp-cartridge';
  const SUPPORTED_VERSIONS = [2];

  /* The sigil that makes a piece of text a lookup into cartridge.strings
     rather than the text itself. Deliberately not a bare {brace}: the rule
     dialect already expands {the target} inside prose, and the two must
     never be able to be mistaken for one another.

     The shape below is RESERVED wherever it appears in a cartridge. Text
     that merely starts with the sigil — 'see @s:foo below', '@s:key with
     spaces' — does not match and is ordinary prose. There is no escape
     for an exact match: a cartridge cannot print the literal text
     '@s:door.locked', and the validator says so rather than leaving it
     to chance. Resolution is single-pass; a table value that is itself a
     reference is not looked up again. */
  const STRING_REF = /^@s:([A-Za-z0-9._-]+)$/;

  /* Outcomes may nest through `fallback`. Real cartridges nest two or
     three deep; a file that nests thousands deep is either a mistake or
     an attempt to end the conversation with a stack overflow. */
  const OUTCOME_DEPTH = 32;

  function listOf(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }

  function plainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  /* Say what arrived, in words, so the message is useful to somebody
     looking at a file rather than at a debugger. */
  function describeType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'an array';
    if (typeof value === 'object') return 'an object';
    return 'the ' + typeof value + ' ' + JSON.stringify(value);
  }

  /* ---------------- format and version ----------------
     Exported on its own because the import boundary checks it before it
     is willing to run anything else, and `validate()` checks it again so
     that the compiler, and a compiled adventure booting its own embedded
     cartridge, fail closed by the same rule. */
  function checkFormat(cartridge) {
    const out = [];
    const add = (code, message) => out.push({
      severity: 'error', code, where: 'FORMAT', path: code.indexOf('version') === 0 ? 'formatVersion' : 'format',
      message, text: 'FORMAT: ' + message
    });

    if (!plainObject(cartridge)) {
      add('format-missing', 'a cartridge must be an object, got ' + describeType(cartridge) + '.');
      return out;
    }
    if (cartridge.format === undefined || cartridge.format === null || cartridge.format === '') {
      add('format-missing', 'this file does not say what it is. A cartridge must declare format: "' + FORMAT + '".');
    } else if (cartridge.format !== FORMAT) {
      add('format-unknown', 'declares format ' + JSON.stringify(cartridge.format) + '; this Workshop reads "' + FORMAT + '".');
    }

    const version = cartridge.formatVersion;
    if (version === undefined || version === null) {
      add('version-missing', 'no formatVersion. Supported: ' + SUPPORTED_VERSIONS.join(', ') + '.');
    } else if (!SUPPORTED_VERSIONS.includes(version)) {
      add('version-unsupported', 'formatVersion ' + JSON.stringify(version) +
        ' is not supported by this build (supported: ' + SUPPORTED_VERSIONS.join(', ') + ').');
    }
    return out;
  }

  /* Where a path lives, in the house style, so a finding raised by the
     whole-tree sweep reads like one raised by a hand-written check. */
  function whereFor(path) {
    let m;
    if ((m = /^world\.rooms\.([^.[]+)/.exec(path))) return 'ROOM ' + m[1];
    if ((m = /^world\.objects\.([^.[]+)/.exec(path))) return 'OBJECT ' + m[1];
    if ((m = /^encounters\.([^.[]+)/.exec(path))) return 'ENCOUNTER ' + m[1];
    if ((m = /^vocabulary\.verbs\.([^.[]+)/.exec(path))) return 'VERB ' + m[1];
    if ((m = /^rules\[(\d+)\]/.exec(path))) return 'RULE ' + (Number(m[1]) + 1);
    if ((m = /^endings\[(\d+)\]/.exec(path))) return 'ENDING ' + (Number(m[1]) + 1);
    if ((m = /^profile\.timers\[(\d+)\]/.exec(path))) return 'TIMER ' + (Number(m[1]) + 1);
    if (/^strings\./.test(path)) return 'STRINGS';
    if (/^profile\./.test(path)) return 'PROFILE';
    if (/^presentation\./.test(path)) return 'DISPLAY';
    if (/^meta\./.test(path)) return 'META';
    return 'CARTRIDGE';
  }

  function validate(cartridge) {
    const findings = [];
    const record = (severity, code, where, path, message) => {
      findings.push({ severity, code, where, path, message, text: where + ': ' + message });
    };
    const err = (code, where, path, message) => record('error', code, where, path, message);
    const warn = (code, where, path, message) => record('warning', code, where, path, message);

    if (!plainObject(cartridge)) {
      err('no-cartridge', 'CARTRIDGE', '', 'nothing to validate: expected a cartridge object, got ' + describeType(cartridge) + '.');
      return finish();
    }

    /* Format and version first, by the same rule the import boundary
       uses. Structural checks still run afterwards: an author fixing a
       version wants to see the rest of the report too. */
    for (const finding of checkFormat(cartridge)) findings.push(finding);

    /* The closed vocabularies the rule dialect defines. Held here so the
       checks below can quote them back at the author. */
    const knownConditions = (ml.rules && ml.rules.CONDITIONS) || [];
    const knownActions = (ml.rules && ml.rules.ACTIONS) || [];
    const knownRefs = (ml.rules && ml.rules.REFS) || [];

    /* ---------------- shape guards ----------------
       Nothing below iterates a collection or dereferences an entry
       without coming through one of these three first. */
    function keysOf(value, code, where, path, what) {
      if (value === undefined || value === null) return [];
      if (!plainObject(value)) {
        err(code, where, path, what + ' must be an object of entries, got ' + describeType(value) + '.');
        return [];
      }
      return Object.keys(value);
    }
    function arrayOf(value, code, where, path, what) {
      if (value === undefined || value === null) return [];
      if (!Array.isArray(value)) {
        err(code, where, path, what + ' must be an array, got ' + describeType(value) + '.');
        return [];
      }
      return value;
    }
    /* An element that should be an object. Returns null once it has said
       so, and every caller skips the entry rather than reading through it. */
    function entryOf(value, where, path, what) {
      if (plainObject(value)) return value;
      err('entry-malformed', where, path, what + ' must be an object, got ' + describeType(value) + '.');
      return null;
    }
    const objectAt = (value) => (plainObject(value) ? value : {});

    /* Flags are gathered as the whole cartridge is read, then reconciled
       at the end: anything tested but never set is a dead condition. */
    const setFlags = new Set(Object.keys(objectAt(cartridge.startFlags)));
    const testedFlags = new Set();

    /* ---------------- the prose contract ----------------
       `prose()` does two jobs at once, and that is the point: it checks
       the reference AND records that this path is a slot the runtime
       resolves. The sweep at the bottom then reports any reference-shaped
       value found anywhere else in the cartridge. The two halves cannot
       drift apart, because adding a prose field without declaring it here
       does not silently print a raw token — it fails the build. */
    const strings = objectAt(cartridge.strings);
    const usedStrings = new Set();
    const proseSlots = [];

    function prose(value, where, path, what) {
      proseSlots.push(path);
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

    if (cartridge.strings !== undefined && !plainObject(cartridge.strings)) {
      err('strings-not-a-table', 'STRINGS', 'strings', 'strings must be an object of key: text, got ' + describeType(cartridge.strings) + '.');
    }
    prose(cartridge.intro, 'CARTRIDGE', 'intro', 'the intro');
    prose(cartridge.help, 'CARTRIDGE', 'help', 'the help text');
    prose(cartridge.quitText, 'CARTRIDGE', 'quitText', 'the quit text');

    /* ---------------- metadata ---------------- */
    const meta = objectAt(cartridge.meta);
    if (cartridge.meta !== undefined && !plainObject(cartridge.meta)) {
      err('meta-malformed', 'META', 'meta', 'meta must be an object, got ' + describeType(cartridge.meta) + '.');
    }
    if (!meta.id || !/^[a-z0-9][a-z0-9-]*$/.test(String(meta.id))) {
      err('meta-id', 'META', 'meta.id', 'id must be a lowercase slug (letters, digits, hyphens), got ' + JSON.stringify(meta.id));
    }
    if (!meta.title || !String(meta.title).trim()) err('meta-title', 'META', 'meta.title', 'title is required.');
    if (!meta.version) warn('meta-version', 'META', 'meta.version', 'no version; compiled games will be stamped "0.0.0".');

    if (cartridge.world !== undefined && !plainObject(cartridge.world)) {
      err('world-malformed', 'WORLD', 'world', 'world must be an object, got ' + describeType(cartridge.world) + '.');
    }
    const world = objectAt(cartridge.world);
    const roomIds = keysOf(world.rooms, 'rooms-not-an-object', 'WORLD', 'world.rooms', 'world.rooms');
    const objectIds = keysOf(world.objects, 'objects-not-an-object', 'WORLD', 'world.objects', 'world.objects');
    const rooms = objectAt(world.rooms);
    const objects = objectAt(world.objects);
    const roomAt = (id) => objectAt(rooms[id]);
    const objectAtId = (id) => objectAt(objects[id]);

    if (!roomIds.length) err('no-rooms', 'WORLD', 'world.rooms', 'a cartridge needs at least one room.');

    /* Collections read in several passes are shaped once, so a malformed
       one is reported once rather than at every pass. */
    const rules = arrayOf(cartridge.rules, 'rules-not-an-array', 'RULES', 'rules', 'rules');
    const endings = arrayOf(cartridge.endings, 'endings-not-an-array', 'ENDINGS', 'endings', 'endings');
    const encounterIds = keysOf(cartridge.encounters, 'encounters-not-an-object', 'ENCOUNTERS', 'encounters', 'encounters');
    const encounters = objectAt(cartridge.encounters);
    const endingIdSet = new Set();
    for (const ending of endings) if (plainObject(ending) && ending.id !== undefined) endingIdSet.add(ending.id);

    /* The profile is read early because the rule book needs it: a rule may
       carry an `outcome`, and an outcome that starts an encounter has to
       know whether combat is switched on at all. */
    if (cartridge.profile !== undefined && !plainObject(cartridge.profile)) {
      err('profile-malformed', 'PROFILE', 'profile', 'profile must be an object, got ' + describeType(cartridge.profile) + '.');
    }
    const profile = objectAt(cartridge.profile);
    const treasures = objectAt(profile.treasures);
    const combatOn = profile.combat === true || (plainObject(profile.combat) && profile.combat.enabled !== false);

    /* ---------------- duplicate ids ----------------
       Object keys cannot literally repeat, so the duplicate that can
       actually happen is an `id` field disagreeing with its key. */
    for (const id of roomIds) {
      const room = entryOf(rooms[id], 'ROOM ' + id, 'world.rooms.' + id, 'room "' + id + '"');
      if (!room) continue;
      if (room.id !== undefined && room.id !== id) {
        err('room-id-conflict', 'ROOM ' + id, 'world.rooms.' + id + '.id', 'declares a conflicting id "' + room.id + '".');
      }
    }
    for (const id of objectIds) {
      const o = entryOf(objects[id], 'OBJECT ' + id, 'world.objects.' + id, 'object "' + id + '"');
      if (!o) continue;
      if (o.id !== undefined && o.id !== id) {
        err('object-id-conflict', 'OBJECT ' + id, 'world.objects.' + id + '.id', 'declares a conflicting id "' + o.id + '".');
      }
      if (rooms[id]) warn('id-shared-with-room', 'OBJECT ' + id, 'world.objects.' + id, 'shares its id with a room; harmless, but confusing to read.');
    }

    /* ---------------- start state ---------------- */
    if (!world.startRoom) err('no-start-room', 'WORLD', 'world.startRoom', 'startRoom is required.');
    else if (!rooms[world.startRoom]) err('start-room-missing', 'WORLD', 'world.startRoom', 'startRoom "' + world.startRoom + '" is not a room.');
    for (const id of listOf(world.startInventory)) {
      if (!objects[id]) err('start-item-missing', 'WORLD', 'world.startInventory', 'startInventory names missing object "' + id + '".');
      else if (objectAtId(id).takeable === false) warn('start-item-fixed', 'WORLD', 'world.startInventory', 'startInventory holds "' + id + '", which is marked not takeable.');
    }

    /* ---------------- rooms and exits ---------------- */
    const KNOWN_EXIT_KEYS = (ml.world && ml.world.KNOWN_EXIT_KEYS) || ['room', 'flagReq', 'flagNot', 'objReq', 'open', 'lit', 'deny', 'note'];
    for (const id of roomIds) {
      if (!plainObject(rooms[id])) continue;      // already reported above
      const room = rooms[id];
      const where = 'ROOM ' + id;
      const base = 'world.rooms.' + id;
      if (!room.name) err('room-no-name', where, base + '.name', 'has no name.');
      if (!room.desc) warn('room-no-desc', where, base + '.desc', 'has no description; the player will arrive somewhere blank.');
      prose(room.desc, where, base + '.desc', 'the description');
      prose(room.short, where, base + '.short', 'the short description');

      const exitDirs = keysOf(room.exits, 'exits-not-an-object', where, base + '.exits', 'exits');
      for (const dir of exitDirs) {
        const exit = room.exits[dir];
        const path = base + '.exits.' + dir;
        if (typeof exit === 'string') {
          if (!rooms[exit]) err('exit-missing-room', where, path, 'exit "' + dir + '" targets missing room "' + exit + '".');
          continue;
        }
        if (!plainObject(exit)) { err('exit-malformed', where, path, 'exit "' + dir + '" is neither a room id nor an exit object.'); continue; }
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
        prose(exit.deny, where, path + '.deny', 'the deny message');
      }

      arrayOf(room.notes, 'notes-not-an-array', where, base + '.notes', 'notes').forEach((note, i) => {
        const path = base + '.notes[' + i + ']';
        if (!entryOf(note, where, path, 'a room note')) return;
        if (!note.text) err('note-no-text', where, path, 'has a conditional note with no text.');
        prose(note.text, where, path + '.text', 'the note');
        checkConditions(note.when, where + ' note', path + '.when');
      });
    }

    /* ---------------- objects ---------------- */
    /* Every message the runtime prints from an object definition, read off
       the `say()` and `pushText()` call sites in js/morrowlamp/runtime.js
       rather than remembered. All of these reach the player through the
       one resolver, so all of them resolve, so all of them are checked.
       `acceptText` reaches it through `ml.rules.expand()`, which resolves
       first and interpolates {the target} second.

       Deliberately absent: `name`. It resolves through `describeObject`
       but is concatenated into generated sentences ("You open the " +
       o.name) everywhere else, so it is not reference-capable and the
       sweep rejects a reference there. */
    const OBJECT_PROSE = ['desc', 'examine', 'read', 'takeText', 'cannotTake', 'dropText',
      'cannotOpen', 'lockedText', 'openText', 'unlockText', 'lightText', 'douseText',
      'acceptText', 'rejectText'];

    for (const id of objectIds) {
      if (!plainObject(objects[id])) continue;    // already reported above
      const o = objects[id];
      const where = 'OBJECT ' + id;
      const base = 'world.objects.' + id;
      if (!o.name) err('object-no-name', where, base + '.name', 'has no name.');
      for (const slot of OBJECT_PROSE) prose(o[slot], where, base + '.' + slot, 'the ' + slot);
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
      for (const cid of objectIds) if (listOf(objectAtId(cid).contents).includes(id)) return true;
      return false;
    }

    /* container cycles */
    const visiting = new Set(), done = new Set();
    function walkContainer(id, trail) {
      if (visiting.has(id)) { err('container-cycle', 'OBJECT ' + id, 'world.objects.' + id + '.contents', 'is inside itself (' + trail.concat(id).join(' → ') + ').'); return; }
      if (done.has(id)) return;
      visiting.add(id);
      for (const child of listOf(objectAtId(id).contents)) {
        if (objectAtId(child).container) walkContainer(child, trail.concat(id));
      }
      visiting.delete(id);
      done.add(id);
    }
    for (const id of objectIds) if (objectAtId(id).container) walkContainer(id, []);

    /* ---------------- vocabulary ---------------- */
    const coreVerbs = ml.vocabulary ? Object.keys(ml.vocabulary.CORE_VERBS) : [];
    const vocabulary = objectAt(cartridge.vocabulary);
    const cartVerbs = keysOf(vocabulary.verbs, 'verbs-not-an-object', 'VOCABULARY', 'vocabulary.verbs', 'vocabulary.verbs');
    const verbDefs = objectAt(vocabulary.verbs);
    const knownVerbs = new Set(coreVerbs.concat(cartVerbs));
    const FORMS = ['none', 'target', 'text', 'direction', 'onoff', 'slot'];
    for (const verb of cartVerbs) {
      const where = 'VERB ' + verb;
      const base = 'vocabulary.verbs.' + verb;
      const spec = entryOf(verbDefs[verb], where, base, 'verb "' + verb + '"');
      if (!spec) continue;
      if (spec.form && !FORMS.includes(spec.form)) err('verb-unknown-form', where, base + '.form', 'unknown form "' + spec.form + '" (known: ' + FORMS.join(', ') + ').');
      if (spec.as && !knownVerbs.has(spec.as)) err('verb-alias-missing', where, base + '.as', 'aliases missing verb "' + spec.as + '".');
      if (!listOf(spec.words).length) warn('verb-no-words', where, base + '.words', 'declares no words; only its canonical name will be typeable.');
      /* The prompt (a `text` or `onoff` verb used with no argument) and the
         fallback (a verb no rule claimed) are both printed to the player.

         `prompt2` is deliberately NOT here. It is only read where a
         separator splits a command into two halves and the second half is
         empty, and the parser's `splitOn` requires content on both sides,
         so that branch cannot be reached today. Declaring it supported
         would mean claiming coverage for a line nothing can print. */
      prose(spec.prompt, where, base + '.prompt', 'the prompt');
      prose(spec.fallback, where, base + '.fallback', 'the fallback');
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
      if (when === undefined || when === null) return;
      if (!plainObject(when)) {
        err('when-malformed', where, path, 'a `when` clause must be an object of conditions, got ' + describeType(when) + '.');
        return;
      }
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
        } else if (['carrying', 'carryingAny', 'notCarrying', 'present', 'notPresent', 'placed', 'notPlaced'].includes(key)) {
          for (const oid of listOf(value)) checkObjectRef(oid, where, at, 'condition ' + key);
        } else if (key === 'flags') {
          if (!plainObject(value)) { err('flags-malformed', where, at, 'the flags condition must be an object, got ' + describeType(value) + '.'); continue; }
          for (const flag in value) {
            testedFlags.add(flag);
            if (typeof value[flag] !== 'boolean') err('flag-not-boolean', where, at + '.' + flag, 'flag condition "' + flag + '" must be true or false.');
          }
        } else if (key === 'open' || key === 'lit') {
          if (!plainObject(value)) { err('condition-malformed', where, at, 'the ' + key + ' condition must be an object, got ' + describeType(value) + '.'); continue; }
          for (const oid in value) checkObjectRef(oid, where, at + '.' + oid, 'condition ' + key);
        }
      }
    }

    function checkActions(steps, where, path) {
      listOf(steps).forEach((step, i) => {
        const stepPath = path + '[' + i + ']';
        if (!plainObject(step)) { err('action-not-object', where, stepPath, 'action steps must be objects, got ' + describeType(step) + '.'); return; }
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
              else for (const flag in objectAt(value)) setFlags.add(flag);
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
              if (!plainObject(value)) { err('placein-malformed', where, at, 'placeIn needs { object, container }.'); break; }
              checkObjectRef(value.object, where, at + '.object', 'placeIn object');
              checkObjectRef(value.container, where, at + '.container', 'placeIn container');
              break;
            case 'score':
              if (typeof value !== 'number') err('score-not-number', where, at, 'score must be a number.');
              break;
            case 'end':
              if (!endingIdSet.has(value)) err('unknown-ending', where, at, 'ends with unknown ending "' + value + '".');
              break;
            case 'say': case 'die':
              if (!listOf(value).length) err('nothing-to-say', where, at, key + ' has nothing to say.');
              prose(value, where, at, 'the ' + key);
              break;
            case 'outcome':
              checkOutcome(value, where + ' outcome', at, 0);
              break;
            default: break;
          }
        }
      });
    }

    /* ---------------- rules ---------------- */
    const ruleIds = new Set();
    rules.forEach((rule, index) => {
      const base = 'rules[' + index + ']';
      if (!plainObject(rule)) { err('entry-malformed', 'RULE ' + (index + 1), base, 'a rule must be an object, got ' + describeType(rule) + '.'); return; }
      const where = 'RULE ' + (index + 1) + (rule.id ? ' (' + rule.id + ')' : '');
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
    if (treasures.enabled) {
      if (!listOf(treasures.list).length) err('treasures-empty', 'PROFILE', 'profile.treasures.list', 'treasures are enabled but the list is empty.');
      for (const id of listOf(treasures.list)) {
        if (!objects[id]) err('treasure-missing', 'PROFILE', 'profile.treasures.list', 'treasure list names missing object "' + id + '".');
        else if (!objectAtId(id).takeable) err('treasure-not-takeable', 'PROFILE', 'world.objects.' + id + '.takeable', 'treasure "' + id + '" is not takeable, so it can never be collected.');
      }
      if (treasures.securedIn && !objects[treasures.securedIn]) {
        err('treasure-case-missing', 'PROFILE', 'profile.treasures.securedIn', 'treasures are secured in missing object "' + treasures.securedIn + '".');
      }
    }
    const light = objectAt(profile.light);
    if (light.fuel !== undefined && light.fuel !== null && !plainObject(light.fuel)) {
      err('fuel-malformed', 'PROFILE', 'profile.light.fuel', 'lamp fuel must be an object, got ' + describeType(light.fuel) + '.');
    } else if (plainObject(light.fuel)) {
      const fuel = light.fuel;
      if (!objects[fuel.object]) err('fuel-object-missing', 'PROFILE', 'profile.light.fuel.object', 'lamp fuel names missing object "' + fuel.object + '".');
      if (!(fuel.turns > 0)) err('fuel-no-turns', 'PROFILE', 'profile.light.fuel.turns', 'lamp fuel needs a positive turn count.');
      const anyDark = roomIds.some((id) => roomAt(id).dark);
      if (!anyDark) warn('fuel-never-burns', 'PROFILE', 'profile.light.fuel', 'lamp fuel is configured but no room is dark, so it will never burn.');
      /* Each warning is [turnsLeft, text]; the text is printed verbatim. */
      arrayOf(fuel.warnings, 'fuel-warnings-not-an-array', 'PROFILE', 'profile.light.fuel.warnings', 'lamp fuel warnings').forEach((entry, i) => {
        const at = 'profile.light.fuel.warnings[' + i + ']';
        if (!Array.isArray(entry) || entry.length !== 2) {
          err('fuel-warning-malformed', 'PROFILE', at, 'a fuel warning must be a [turnsLeft, text] pair.');
          return;
        }
        prose(entry[1], 'PROFILE', at + '[1]', 'the fuel warning');
      });
      prose(fuel.outText, 'PROFILE', 'profile.light.fuel.outText', 'the light-goes-out message');
    }
    const darkness = objectAt(profile.darkness);
    if (darkness.enabled && !roomIds.some((id) => roomAt(id).dark)) {
      warn('darkness-no-dark-room', 'PROFILE', 'profile.darkness', 'darkness is enabled but no room is marked dark.');
    }
    prose(darkness.warning, 'PROFILE', 'profile.darkness.warning', 'the darkness warning');

    arrayOf(profile.timers, 'timers-not-an-array', 'PROFILE', 'profile.timers', 'timers').forEach((timer, i) => {
      const base = 'profile.timers[' + i + ']';
      if (!plainObject(timer)) { err('entry-malformed', 'TIMER ' + (i + 1), base, 'a timer must be an object, got ' + describeType(timer) + '.'); return; }
      const where = 'TIMER ' + (timer.id || (i + 1));
      if (!timer.id) err('timer-no-id', where, base + '.id', 'timers need an id.');
      if (!(timer.after >= 0)) err('timer-no-after', where, base + '.after', 'timers need an "after" turn count.');
      checkConditions(timer.when, where, base + '.when');
      checkActions(timer.do, where, base + '.do');
    });

    /* ---------------- outcomes ----------------
       An outcome says what happens when a system fails or fires. Its
       type set is closed for the same reason the action set is, and its
       nesting is bounded for the same reason a parser has a stack limit. */
    const outcomeTypes = (ml.outcome && ml.outcome.TYPES) || [];
    function checkOutcome(outcome, where, path, depth) {
      if (!outcome) return;
      if (depth > OUTCOME_DEPTH) {
        err('outcome-too-deep', where, path, 'outcomes nest more than ' + OUTCOME_DEPTH + ' fallbacks deep; this is not a game, it is a loop.');
        return;
      }
      /* The shorthand: a bare line of text, or several, means death. */
      if (typeof outcome === 'string' || Array.isArray(outcome)) { prose(outcome, where, path, 'the text'); return; }
      if (!plainObject(outcome)) {
        err('outcome-malformed', where, path, 'an outcome must be text or an object, got ' + describeType(outcome) + '.');
        return;
      }
      if (!outcomeTypes.includes(outcome.type)) {
        err('unknown-outcome-type', where, path + '.type', 'unknown outcome type "' + outcome.type + '" (known: ' + outcomeTypes.join(', ') + ').');
        return;
      }
      /* Every outcome shape may carry a line to print alongside whatever
         else it does, so the text is checked once, here, for all of them.
         It used to be checked again inside the death/say branch, which
         reported every missing key twice. */
      prose(outcome.text, where, path + '.text', 'the text');
      switch (outcome.type) {
        case 'encounter':
          if (!encounters[outcome.encounter]) {
            err('missing-encounter', where, path + '.encounter', 'names missing encounter "' + outcome.encounter + '".');
          } else if (!combatOn) {
            err('encounter-combat-off', where, path + '.encounter', 'starts encounter "' + outcome.encounter + '" but profile.combat is off, so it can never run.');
          }
          if (outcome.fallback) checkOutcome(outcome.fallback, where + ' fallback', path + '.fallback', depth + 1);
          break;
        case 'move':
          if (!rooms[outcome.room]) err('missing-room', where, path + '.room', 'moves the player to missing room "' + outcome.room + '".');
          break;
        case 'end':
          if (!endingIdSet.has(outcome.ending)) {
            err('unknown-ending', where, path + '.ending', 'names unknown ending "' + outcome.ending + '".');
          }
          break;
        case 'rules':
          checkActions(outcome.do, where, path + '.do');
          break;
        case 'death': case 'say':
          if (!listOf(outcome.text).length) err('outcome-no-text', where, path + '.text', 'has no text.');
          break;
        default: break;
      }
    }

    /* ---------------- stats ---------------- */
    const statsRaw = profile.stats;
    const statsOn = statsRaw === true || (plainObject(statsRaw) && statsRaw.enabled !== false);
    /* `stats` omitted entirely is a different statement from `stats: false`.
       The first leaves the decision to the Machine; the second is the author
       saying this game has no character system — which combat contradicts,
       because a fight needs somewhere to keep the player's health. */
    const statsDeclaredOff = statsRaw === false || statsRaw === null ||
      (plainObject(statsRaw) && statsRaw.enabled === false);
    const statsCfg = plainObject(statsRaw) ? statsRaw : {};
    const statIds = statsOn ? keysOf(statsCfg.list, 'stats-list-malformed', 'STATS', 'profile.stats.list', 'the stat list') : [];
    if (statsOn) {
      if (!statIds.length) err('stats-no-list', 'STATS', 'profile.stats.list', 'stats are enabled but no stat list is declared.');
      const classIds = keysOf(statsCfg.classes, 'stats-classes-malformed', 'STATS', 'profile.stats.classes', 'the class list');
      const classes = objectAt(statsCfg.classes);
      if (!classIds.length) err('stats-no-classes', 'STATS', 'profile.stats.classes', 'stats are enabled but no class is declared.');
      for (const id of classIds) {
        const cls = entryOf(classes[id], 'CLASS ' + id, 'profile.stats.classes.' + id, 'class "' + id + '"');
        if (!cls) continue;
        for (const stat in objectAt(cls.stats)) {
          if (!statIds.includes(stat)) err('class-unknown-stat', 'CLASS ' + id, 'profile.stats.classes.' + id + '.stats.' + stat, 'starts with unknown stat "' + stat + '".');
        }
      }
      const health = objectAt(statsCfg.health);
      if (health.from && !statIds.includes(health.from)) {
        err('health-unknown-stat', 'STATS', 'profile.stats.health.from', 'health is derived from unknown stat "' + health.from + '".');
      }
      const startClass = statsCfg.startClass;
      if (startClass && !classes[startClass]) err('unknown-start-class', 'STATS', 'profile.stats.startClass', 'startClass "' + startClass + '" is not a declared class.');
      /* Triggers the runtime fires by itself, plus any name a rule invokes
         with `{ award: '…' }` — a cartridge may define its own moments. */
      const BUILT_IN_TRIGGERS = ['examine', 'treasureFound', 'treasureSecured'];
      const ruleTriggers = new Set();
      for (const rule of rules) {
        if (!plainObject(rule)) continue;
        for (const step of listOf(rule.do).concat(listOf(rule.otherwise))) {
          if (plainObject(step) && step.award) ruleTriggers.add(step.award);
        }
      }
      const awardIds = keysOf(statsCfg.awards, 'stats-awards-malformed', 'STATS', 'profile.stats.awards', 'the award table');
      const awards = objectAt(statsCfg.awards);
      for (const trigger of awardIds) {
        const at = 'profile.stats.awards.' + trigger;
        if (!BUILT_IN_TRIGGERS.includes(trigger) && !ruleTriggers.has(trigger)) {
          err('award-never-fired', 'STATS', at, 'award trigger "' + trigger + '" is never fired (built in: ' +
            BUILT_IN_TRIGGERS.join(', ') + '; or name it in a rule\'s { award: … }).');
        }
        const spec = objectAt(awards[trigger]);
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
      const exertionIds = keysOf(statsCfg.exertion, 'stats-exertion-malformed', 'STATS', 'profile.stats.exertion', 'the exertion table');
      const exertion = objectAt(statsCfg.exertion);
      for (const verb of exertionIds) {
        const at = 'profile.stats.exertion.' + verb;
        if (!knownVerbs.has(verb)) {
          err('exertion-unknown-verb', 'STATS', at, 'exertion names unknown verb "' + verb + '"; add it to vocabulary.verbs.');
        }
        const spec = exertion[verb];
        const statId = plainObject(spec) ? spec.stat : spec;
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
    for (const id of encounterIds) {
      const where = 'ENCOUNTER ' + id;
      const base = 'encounters.' + id;
      const enc = entryOf(encounters[id], where, base, 'encounter "' + id + '"');
      if (!enc) continue;
      if (!combatOn) { warn('encounter-unstartable', where, base, 'is declared but profile.combat is off, so nothing can start it.'); }
      if (!encounterKinds.includes(enc.kind)) {
        err('encounter-unknown-kind', where, base + '.kind', 'unknown kind "' + enc.kind + '" (known: ' + encounterKinds.join(', ') + ').');
      }
      const opponent = objectAt(enc.opponent);
      if (!opponent.name) err('opponent-no-name', where, base + '.opponent.name', 'has no opponent name.');
      if (!(opponent.hp > 0)) err('opponent-no-hp', where, base + '.opponent.hp', 'opponent needs positive hp.');
      if (opponent.attack && (!Array.isArray(opponent.attack) || opponent.attack.length !== 2)) {
        err('opponent-bad-attack', where, base + '.opponent.attack', 'opponent attack must be a [low, high] pair.');
      }
      checkStat(enc.dodgeFrom, where, base + '.dodgeFrom', 'dodgeFrom');
      checkStat(enc.hurtTrains, where, base + '.hurtTrains', 'hurtTrains');
      for (const slot of ['intro', 'hit', 'miss', 'defeated']) prose(enc[slot], where, base + '.' + slot, 'the ' + slot + ' text');

      const seen = new Set();
      const actions = arrayOf(enc.actions, 'actions-not-an-array', where, base + '.actions', 'encounter actions');
      if (!actions.length) warn('encounter-no-actions', where, base + '.actions', 'declares no actions; the default attack/defend/flee set will be used.');
      actions.forEach((action, i) => {
        const at = base + '.actions[' + i + ']';
        if (!plainObject(action)) { err('entry-malformed', where, at, 'an encounter action must be an object, got ' + describeType(action) + '.'); return; }
        const label = where + ' action ' + (action.id || '?');
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
        for (const slot of ['deny', 'hitText', 'missText', 'text', 'failText']) {
          prose(action[slot], label, at + '.' + slot, 'the ' + slot);
        }
        if (action.when && !action.deny) warn('action-silent-condition', label, at + '.deny', 'has a condition but no `deny` message to explain itself.');
      });
      for (const hook of ['onWin', 'onFlee', 'onDefeat']) {
        if (enc[hook]) checkOutcome(enc[hook], where + ' ' + hook, base + '.' + hook, 0);
      }
    }

    checkOutcome(darkness.onFail, 'DARKNESS onFail', 'profile.darkness.onFail', 0);

    /* A rule that starts an encounter, or trains a stat, in a cartridge
       that has not switched the capability on. */
    rules.forEach((rule, index) => {
      if (!plainObject(rule)) return;
      const base = 'rules[' + index + ']';
      listOf(rule.do).concat(listOf(rule.otherwise)).forEach((step) => {
        if (!plainObject(step)) return;
        const where = 'RULE ' + (rule.id || (index + 1));
        if (step.encounter) {
          if (!encounters[step.encounter]) err('missing-encounter', where, base, 'starts missing encounter "' + step.encounter + '".');
          else if (!combatOn) err('encounter-combat-off', where, base, 'starts an encounter but profile.combat is off.');
        }
        if (step.train) checkStat(plainObject(step.train) ? step.train.stat : step.train, where, base, 'train');
        if ((step.heal !== undefined || step.hurt !== undefined) && !statsOn) {
          err('heal-without-stats', where, base, 'heals or hurts the player, but stats are switched off so there is no health to change.');
        }
      });
    });

    /* ---------------- endings ---------------- */
    const seenEndingIds = new Set();
    let hasWin = false;
    endings.forEach((ending, index) => {
      const base = 'endings[' + index + ']';
      if (!plainObject(ending)) { err('entry-malformed', 'ENDING ' + (index + 1), base, 'an ending must be an object, got ' + describeType(ending) + '.'); return; }
      const where = 'ENDING ' + (index + 1) + (ending.id ? ' (' + ending.id + ')' : '');
      if (!ending.id) err('ending-no-id', where, base + '.id', 'endings need an id.');
      else if (seenEndingIds.has(ending.id)) err('ending-duplicate-id', where, base + '.id', 'duplicate ending id "' + ending.id + '".');
      else seenEndingIds.add(ending.id);
      if (!listOf(ending.text).length) err('ending-no-text', where, base + '.text', 'has no text.');
      prose(ending.text, where, base + '.text', 'the text');
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
      const exits = objectAt(roomAt(id).exits);
      for (const dir in exits) {
        const exit = exits[dir];
        if (!plainObject(exit)) continue;
        for (const key of ['flagReq', 'flagNot']) {
          if (exit[key] && !setFlags.has(exit[key])) {
            err('exit-flag-never-set', 'ROOM ' + id, 'world.rooms.' + id + '.exits.' + dir + '.' + key,
              'exit "' + dir + '" waits on flag "' + exit[key] + '", which no rule ever sets.');
          }
        }
      }
    }

    /* ---------------- the prose sweep ----------------
       Everything above declared, slot by slot, where the runtime resolves
       a '@s:' reference. This walks the WHOLE cartridge looking for the
       reserved shape anywhere else, because a reference in a slot nothing
       resolves is not prose — it is a token the player will read.

       Iterative rather than recursive: this runs on files a stranger
       wrote, and a deeply nested one must produce a finding rather than a
       stack overflow. */
    function sweepForReferences() {
      const covered = (path) => proseSlots.some((slot) =>
        path === slot || path.indexOf(slot + '.') === 0 || path.indexOf(slot + '[') === 0);

      const seen = new Set();
      const stack = [{ node: cartridge, path: '' }];
      while (stack.length) {
        const { node, path } = stack.pop();
        if (typeof node === 'string') {
          const match = STRING_REF.exec(node);
          if (match && !covered(path)) {
            /* The strings table is read once, not recursively, so a table
               value that is itself a reference is never looked up. */
            const message = path.indexOf('strings.') === 0
              ? 'holds "' + node + '". The strings table is not read recursively, so this would reach the player as written.'
              : 'holds "' + node + '", but this slot does not support string references; write the text here directly.';
            err('string-ref-unsupported', whereFor(path), path, message);
          }
          continue;
        }
        if (!node || typeof node !== 'object') continue;
        if (seen.has(node)) continue;
        seen.add(node);
        if (Array.isArray(node)) {
          for (let i = node.length - 1; i >= 0; i--) stack.push({ node: node[i], path: path + '[' + i + ']' });
          continue;
        }
        for (const key of Object.keys(node)) {
          stack.push({ node: node[key], path: path ? path + '.' + key : key });
        }
      }
    }
    sweepForReferences();

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
    const presentation = objectAt(cartridge.presentation);
    if (presentation.renderer && !RENDERERS.includes(presentation.renderer)) {
      err('unknown-renderer', 'DISPLAY', 'presentation.renderer', 'unknown renderer profile "' + presentation.renderer + '" (known: ' + RENDERERS.join(', ') + ').');
    }
    if (presentation.audio && !AUDIO.includes(presentation.audio)) {
      err('unknown-audio', 'SOUND', 'presentation.audio', 'unknown audio profile "' + presentation.audio + '" (known: ' + AUDIO.join(', ') + ').');
    }
    if (presentation.interface && !INTERFACES.includes(presentation.interface)) {
      err('unknown-interface', 'INTERFACE', 'presentation.interface', 'unknown interface profile "' + presentation.interface + '" (known: ' + INTERFACES.join(', ') + ').');
    }
    if (presentation.interface === 'canvas' && !(plainObject(presentation.art) && presentation.art.scene)) {
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
      const exits = objectAt(roomAt(id).exits);
      for (const dir in exits) {
        const exit = exits[dir];
        const target = typeof exit === 'string' ? exit : (plainObject(exit) ? exit.room : null);
        if (target && rooms[target] && !reached.has(target)) queue.push(target);
      }
    }
    /* Rules can teleport, so a room a rule can `goto` counts as reached. */
    for (const rule of rules) {
      if (!plainObject(rule)) continue;
      for (const step of listOf(rule.do).concat(listOf(rule.otherwise))) {
        if (plainObject(step) && step.goto && rooms[step.goto]) reached.add(step.goto);
      }
    }
    for (const id of roomIds) {
      if (!reached.has(id)) warn('room-unreachable', 'ROOM ' + id, 'world.rooms.' + id, 'is unreachable from ' + world.startRoom + '.');
    }
    /* A treasure in a room nobody can enter is a game that cannot be won. */
    for (const id of listOf(treasures.list)) {
      const homes = listOf(objectAtId(id).at).filter((at) => at !== 'inv');
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

  ml.validator = {
    validate, report, checkFormat,
    RENDERERS, AUDIO, INTERFACES, STRING_REF,
    FORMAT, SUPPORTED_VERSIONS, OUTCOME_DEPTH
  };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
