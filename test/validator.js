/* ============================================================
   MORROWLAMP — cartridge validator
   Every check gets a broken cartridge of its own, because a
   validator nobody has tried to fool is a validator that passes
   everything.
   Run with:  node test/validator.js
   ============================================================ */
'use strict';
const assert = require('node:assert');
const Z = require('../js/morrowlamp/core.js');
require('../js/morrowlamp/world.js');
require('../js/morrowlamp/profile.js');
require('../js/morrowlamp/outcome.js');
require('../js/morrowlamp/rules.js');
require('../js/morrowlamp/vocabulary.js');
require('../js/morrowlamp/stats.js');
require('../js/morrowlamp/encounter.js');
require('../js/morrowlamp/runtime.js');
require('../js/workshop/validator.js');
require('../js/world.js');
require('../js/cartridges/sunken-crown.js');
require('../js/cartridges/captains-thistle.js');

const V = Z.ml.validator;

function base() {
  return {
    /* A cartridge has to say what it is and which dialect it speaks. This
       fixture used to omit both, which is how a validator that never
       looked at either passed its own suite. */
    format: 'morrowlamp-cartridge',
    formatVersion: 2,
    meta: { id: 'test-game', title: 'Test Game', version: '1.0.0' },
    startFlags: { opened: false },
    world: {
      startRoom: 'a',
      startInventory: [],
      rooms: {
        a: { name: 'A', desc: 'Room A.', exits: { e: { room: 'b', flagReq: 'opened', deny: 'Shut.' } } },
        b: { name: 'B', desc: 'Room B.', exits: { w: 'a' } }
      },
      objects: {
        lever: { name: 'lever', aliases: ['lever'], at: 'a', desc: 'A lever.' },
        gem: { name: 'gem', aliases: ['gem'], at: 'b', takeable: true, desc: 'A gem.' },
        box: { name: 'box', aliases: ['box'], at: 'a', container: true, open: true, contents: [] }
      }
    },
    vocabulary: { verbs: { pull: { words: ['pull'], form: 'target', prompt: 'Pull what?' } } },
    rules: [{ id: 'pull-lever', verb: 'pull', target: 'lever', do: [{ set: 'opened' }, { say: 'Click.' }] }],
    profile: {
      score: { enabled: true, ranks: [[0, 'Start']] },
      treasures: { enabled: true, list: ['gem'], securedIn: 'box' }
    },
    endings: [{ id: 'done', kind: 'win', text: ['Done.'] }],
    presentation: { renderer: 'ega', audio: 'chip', interface: 'parser' }
  };
}

/* Apply a mutation to a fresh cartridge and return the validation. */
function broken(mutate) {
  const cart = base();
  mutate(cart);
  return V.validate(cart);
}
function saysError(result, fragment) {
  return result.errors.some((e) => e.includes(fragment));
}
function saysWarning(result, fragment) {
  return result.warnings.some((w) => w.includes(fragment));
}

function testCleanCartridge() {
  const result = V.validate(base());
  assert.ok(result.ok, 'a sound cartridge passes: ' + result.errors.join('; '));
  assert.ok(V.report(result).startsWith('CARTRIDGE VALIDATED'), 'the report says so');
  console.log('  ok — a sound cartridge validates');
}

function testShippedCartridges() {
  for (const id of ['the-sunken-crown', 'captains-thistle']) {
    const result = V.validate(Z.cartridges[id]);
    assert.ok(result.ok, id + ' must validate cleanly:\n' + result.errors.join('\n'));
  }
  console.log('  ok — both shipped cartridges validate cleanly');
}

function testWorldErrors() {
  assert.ok(saysError(broken((c) => { c.world.rooms.a.exits.n = 'tunel'; }), 'targets missing room "tunel"'), 'exit to nowhere');
  assert.ok(saysError(broken((c) => { c.world.startRoom = 'zzz'; }), 'startRoom "zzz" is not a room'), 'bad startRoom');
  assert.ok(saysError(broken((c) => { c.world.objects.gem.at = 'attic'; }), 'starts in missing room "attic"'), 'object in nowhere');
  assert.ok(saysError(broken((c) => { c.world.startInventory = ['ghost']; }), 'startInventory names missing object "ghost"'), 'phantom start item');
  assert.ok(saysError(broken((c) => { c.world.rooms.a.id = 'not-a'; }), 'conflicting id'), 'duplicate/conflicting id');
  assert.ok(saysError(broken((c) => { c.world.objects.box.key = 'nokey'; }), 'unlocked by missing object'), 'missing key');
  console.log('  ok — world errors are caught and addressed');
}

function testExitRequirementsFailLoud() {
  /* The guardReq class of bug: an exit gated on a word the runtime does
     not know fails closed, so it must be a build error, not a mystery. */
  const result = broken((c) => { c.world.rooms.a.exits.e = { room: 'b', guardReq: 'opened', deny: 'Shut.' }; });
  assert.ok(saysError(result, 'unknown requirement "guardReq"'), 'unknown exit requirement is an error');
  assert.ok(saysError(result, 'keep it shut forever'), 'and says what will actually happen');
  console.log('  ok — an exit requirement the runtime cannot honour is a build error');
}

function testContainerCycles() {
  const result = broken((c) => {
    c.world.objects.box.contents = ['crate'];
    c.world.objects.crate = { name: 'crate', container: true, contents: ['box'], at: 'a' };
  });
  assert.ok(saysError(result, 'is inside itself'), 'container cycle');
  console.log('  ok — container cycles are caught');
}

function testRuleErrors() {
  assert.ok(saysError(broken((c) => { c.rules[0].target = 'silver_key'; }), 'RULE 1 (pull-lever): target "silver_key" does not exist.'),
    'the message names the rule and the target');
  assert.ok(saysError(broken((c) => { c.rules[0].verb = 'yodel'; }), 'matches unknown verb "yodel"'), 'unknown verb');
  assert.ok(saysError(broken((c) => { c.rules[0].do = [{ frobnicate: 'lever' }]; }), 'unknown action "frobnicate"'), 'unknown action');
  assert.ok(saysError(broken((c) => { c.rules[0].when = { standingOn: 'lever' }; }), 'unknown condition "standingOn"'), 'unknown condition');
  assert.ok(saysError(broken((c) => { c.rules[0].do = [{ goto: 'atlantis' }]; }), 'goto names missing room "atlantis"'), 'goto nowhere');
  assert.ok(saysError(broken((c) => { c.rules[0].do = [{ end: 'ascension' }]; }), 'unknown ending "ascension"'), 'unknown ending');
  assert.ok(saysError(broken((c) => { c.rules[0].target = '@wrist'; }), 'unknown reference "@wrist"'), 'bad @reference');
  assert.ok(saysError(broken((c) => { c.rules.push({ id: 'pull-lever', verb: 'pull', do: [{ say: 'again' }] }); }), 'duplicate rule id'), 'duplicate rule id');
  assert.ok(saysError(broken((c) => { c.rules[0].do = []; delete c.rules[0].otherwise; }), 'does nothing'), 'empty rule');
  assert.ok(saysError(broken((c) => { c.rules[0].reach = 'sometimes'; }), 'reach must be "anywhere"'), 'bad reach');
  console.log('  ok — rule errors name the rule, the slot, and the value');
}

function testFlagReconciliation() {
  assert.ok(saysError(broken((c) => { c.rules[0].when = { flags: { thePriceIsPaid: true } }; }),
    'flag "thePriceIsPaid" is tested but never set'), 'a flag nothing sets is a dead condition');
  assert.ok(saysError(broken((c) => { c.world.rooms.a.exits.e.flagReq = 'neverSet'; }),
    'waits on flag "neverSet"'), 'an exit waiting on a flag nothing sets is a dead exit');
  console.log('  ok — flags that are tested but never set are refused');
}

function testProfileErrors() {
  assert.ok(saysError(broken((c) => { c.profile.treasures.list = ['ghost']; }), 'treasure list names missing object "ghost"'), 'phantom treasure');
  assert.ok(saysError(broken((c) => { c.world.objects.gem.takeable = false; }), 'is not takeable, so it can never be collected'), 'uncollectable treasure');
  assert.ok(saysError(broken((c) => { c.profile.treasures.securedIn = 'vault'; }), 'secured in missing object "vault"'), 'phantom trophy case');
  assert.ok(saysError(broken((c) => { c.profile.light = { fuel: { object: 'candle', turns: 10 } }; }), 'lamp fuel names missing object'), 'phantom lamp');
  assert.ok(saysError(broken((c) => { c.endings = []; }), 'no ending with kind:"win"'), 'unwinnable by omission');
  console.log('  ok — gameplay profile errors are caught');
}

function testUnreachableTreasure() {
  const result = broken((c) => {
    c.world.rooms.attic = { name: 'Attic', desc: 'Sealed.', exits: {} };
    c.world.objects.gem.at = 'attic';
  });
  assert.ok(saysError(result, 'starts in unreachable room "attic"; the game cannot be completed'), 'unreachable treasure is fatal');
  assert.ok(saysWarning(result, 'ROOM attic: is unreachable'), 'and the room is flagged too');
  console.log('  ok — a treasure nobody can reach is a build error');
}

function testPresentationErrors() {
  assert.ok(saysError(broken((c) => { c.presentation.renderer = 'svga'; }), 'unknown renderer profile "svga" (known: cga, ega, vga)'), 'renderer');
  assert.ok(saysError(broken((c) => { c.presentation.audio = 'gramophone'; }), 'unknown audio profile "gramophone"'), 'audio');
  assert.ok(saysError(broken((c) => { c.presentation.interface = 'holodeck'; }), 'unknown interface profile "holodeck"'), 'interface');
  assert.ok(saysWarning(broken((c) => { c.presentation.interface = 'canvas'; }), 'supplies no scene painters'), 'canvas with no art');
  console.log('  ok — presentation errors list the profiles that do exist');
}

function testReportFormatting() {
  const result = broken((c) => { c.rules[0].target = 'silver_key'; });
  const text = V.report(result);
  assert.ok(text.startsWith('COMPILATION HALTED — 1 error'), 'the header counts the errors');
  assert.ok(text.includes('RULE 1 (pull-lever)'), 'the body is addressed');
  console.log('  ok — the report reads like a compiler');
}

/* ---------------- the structured view ----------------
   The sentence is for a person; the code and the path are for anything
   that wants to jump to the fault or repair it. Both views describe the
   same set, which is the property worth pinning down: a finding that
   appears in one and not the other would make the pair a liability. */
function testFindingsAreStructured() {
  const result = broken((c) => { c.rules[0].do = [{ frobnicate: 'lever' }]; });
  assert.ok(Array.isArray(result.findings), 'a structured view is offered');
  assert.strictEqual(result.findings.filter((f) => f.severity === 'error').length, result.errors.length,
    'the two views count the same errors');
  assert.strictEqual(result.findings.filter((f) => f.severity === 'warning').length, result.warnings.length,
    'and the same warnings');
  for (const finding of result.findings) {
    assert.ok(finding.code && /^[a-z0-9-]+$/.test(finding.code), 'every finding carries a slug code: ' + finding.text);
    assert.strictEqual(typeof finding.path, 'string', 'and a path into the cartridge');
    assert.strictEqual(finding.text, finding.where + ': ' + finding.message, 'and its text is built from its parts');
  }
  const fault = result.findings.find((f) => f.code === 'unknown-action');
  assert.ok(fault, 'the unknown action is reported under a stable code');
  assert.strictEqual(fault.path, 'rules[0].do[0].frobnicate', 'and addressed precisely enough to jump to');
  console.log('  ok — findings carry a stable code and a path, and agree with the text view');
}

function testPathsAddressTheRealFault() {
  const cases = [
    [(c) => { c.world.rooms.a.exits.n = 'tunel'; }, 'exit-missing-room', 'world.rooms.a.exits.n'],
    [(c) => { c.world.objects.gem.at = 'attic'; }, 'object-missing-room', 'world.objects.gem.at'],
    [(c) => { c.rules[0].target = 'silver_key'; }, 'missing-object', 'rules[0].target'],
    [(c) => { c.rules[0].when = { standingOn: 'lever' }; }, 'unknown-condition', 'rules[0].when.standingOn'],
    [(c) => { c.presentation.renderer = 'svga'; }, 'unknown-renderer', 'presentation.renderer'],
    [(c) => { c.world.rooms.a.exits.e.guardReq = 'opened'; }, 'exit-unknown-requirement', 'world.rooms.a.exits.e.guardReq']
  ];
  for (const [mutate, code, path] of cases) {
    const finding = broken(mutate).findings.find((f) => f.code === code);
    assert.ok(finding, 'code "' + code + '" is reported');
    assert.strictEqual(finding.path, path, code + ' points at ' + path);
  }
  console.log('  ok — each finding\'s path addresses the field that is actually wrong');
}

/* ---------------- the strings table ----------------
   The seam is only safe because it is checked. A key that does not
   resolve has to be a build error, or moving prose into the table would
   trade a typo you can see for a blank line you cannot. */
function testStringReferences() {
  const missing = broken((c) => {
    c.strings = { 'lever.pulled': 'Click.' };
    c.rules[0].do = [{ set: 'opened' }, { say: '@s:lever.pushed' }];
  });
  assert.ok(saysError(missing, 'refers to string "lever.pushed", which is not in the strings table'),
    'a reference with no key is a build error');
  assert.ok(missing.findings.some((f) => f.code === 'string-missing'), 'reported under a stable code');

  const unused = broken((c) => {
    c.strings = { 'lever.pulled': 'Click.', 'never.used': 'Nobody says this.' };
    c.rules[0].do = [{ set: 'opened' }, { say: '@s:lever.pulled' }];
  });
  assert.ok(unused.ok, 'an unused key does not stop the build');
  assert.ok(saysWarning(unused, 'string "never.used" is declared but nothing refers to it'),
    'but it is worth mentioning');

  /* The Machine's own system messages are read by the runtime directly,
     so overriding one is a use, not an orphan. */
  const override = broken((c) => {
    c.strings = { dontSeeThat: 'There is no such thing aboard.' };
  });
  assert.ok(!override.warnings.some((w) => w.includes('dontSeeThat')),
    'overriding a system message is not reported as unused');

  const everywhere = broken((c) => {
    c.strings = { 'a.desc': 'A room.' };
    c.world.rooms.a.desc = '@s:a.desc';
    c.world.rooms.b.desc = '@s:b.desc';
  });
  assert.ok(saysError(everywhere, 'refers to string "b.desc"'), 'room descriptions are checked too');
  console.log('  ok — the strings table is checked in both directions');
}

function testCrumblyIsWrittenEntirelyInStrings() {
  /* The reference cartridge for the seam. If somebody writes a line of
     prose back into its structure, this is where it shows up. */
  require('../js/cartridges/sir-crumbly.js');
  const cart = Z.cartridges['sir-crumbly'];
  const result = V.validate(cart);
  assert.ok(result.ok, 'it validates: ' + result.errors.join('; '));
  assert.ok(Object.keys(cart.strings).length > 20, 'and keeps its writing in the table');
  for (const id in cart.world.rooms) {
    const room = cart.world.rooms[id];
    for (const slot of ['desc', 'short']) {
      if (room[slot] === undefined) continue;
      assert.ok(/^@s:/.test(room[slot]), 'ROOM ' + id + '.' + slot + ' is a reference, not prose');
    }
  }
  for (const id in cart.world.objects) {
    for (const slot of ['desc', 'examine']) {
      const value = cart.world.objects[id][slot];
      if (value === undefined) continue;
      assert.ok(/^@s:/.test(value), 'OBJECT ' + id + '.' + slot + ' is a reference, not prose');
    }
  }
  console.log('  ok — Sir Crumbly keeps every line of prose in its strings table');
}

/* ============================================================
   B-001 — FORMAT AND VERSION FAIL CLOSED
   The validator used to read neither field. A cartridge that said
   nothing about what it was, or claimed a dialect from the future,
   validated and compiled as though it were compatible.
   ============================================================ */
function testFormatMustBeDeclared() {
  const missing = broken((c) => { delete c.format; });
  assert.strictEqual(missing.ok, false, 'a cartridge with no format is refused');
  assert.ok(missing.findings.some((f) => f.code === 'format-missing'), 'under a stable code');
  assert.ok(saysError(missing, 'does not say what it is'), 'and says what is wrong');

  const wrong = broken((c) => { c.format = 'twine-story'; });
  assert.ok(wrong.findings.some((f) => f.code === 'format-unknown'), 'a foreign format is refused separately');
  assert.ok(saysError(wrong, 'this Workshop reads "morrowlamp-cartridge"'), 'and names what it does read');
  console.log('  ok — a cartridge that does not declare the Morrowlamp format is refused');
}

function testVersionMustBeSupported() {
  const cases = [
    [(c) => { delete c.formatVersion; }, 'version-missing'],
    [(c) => { c.formatVersion = null; }, 'version-missing'],
    [(c) => { c.formatVersion = 999; }, 'version-unsupported'],
    [(c) => { c.formatVersion = 1; }, 'version-unsupported'],
    [(c) => { c.formatVersion = '2'; }, 'version-unsupported'],
    [(c) => { c.formatVersion = 'two'; }, 'version-unsupported'],
    [(c) => { c.formatVersion = 2.5; }, 'version-unsupported']
  ];
  for (const [mutate, code] of cases) {
    const result = broken(mutate);
    assert.strictEqual(result.ok, false, 'refused: ' + code);
    assert.ok(result.findings.some((f) => f.code === code), 'reported as ' + code);
  }
  /* Fail closed: supported means listed, not "looks close enough". A
     string "2" is not version 2, and there is no coercion that would make
     it one. */
  assert.deepStrictEqual(V.SUPPORTED_VERSIONS, [2], 'exactly one dialect is supported today');
  assert.ok(V.validate(base()).ok, 'and the supported one still passes');
  console.log('  ok — a missing, older, newer or malformed version all fail closed');
}

function testFormatCheckIsShared() {
  /* One function, so the Workshop, the CLI, the compiler and a compiled
     adventure booting its own cartridge cannot disagree about this. */
  assert.strictEqual(typeof V.checkFormat, 'function', 'the boundary is exported');
  assert.deepStrictEqual(V.checkFormat(base()), [], 'a good cartridge yields no findings');
  const findings = V.checkFormat({ format: 'morrowlamp-cartridge' });
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].code, 'version-missing');
  assert.strictEqual(findings[0].severity, 'error');
  /* And validate() applies the same rule, so nothing can route around it. */
  assert.ok(V.validate({ format: 'morrowlamp-cartridge' }).findings.some((f) => f.code === 'version-missing'),
    'validate() enforces the same check');
  console.log('  ok — one shared format/version check, used by validate() too');
}

/* ============================================================
   B-002 — VALIDATION IS TOTAL
   Every one of these threw an exception out of the validator on
   the audited commit. A file a stranger wrote must produce a
   diagnostic, never a stack trace: an exception escapes the import
   callback, leaves the previous cartridge's "0 errors" on screen,
   and tells the operator nothing.
   ============================================================ */
function malformedShapes() {
  return {
    'null cartridge': () => null,
    'array cartridge': () => [],
    'string cartridge': () => 'hello',
    'number cartridge': () => 42,
    'null room entry': () => broken0((c) => { c.world.rooms.ghost = null; }),
    'string room entry': () => broken0((c) => { c.world.rooms.ghost = 'nope'; }),
    'null object entry': () => broken0((c) => { c.world.objects.ghost = null; }),
    'null encounter entry': () => broken0((c) => { c.encounters = { e: null }; }),
    'rules as object': () => broken0((c) => { c.rules = { a: 1 }; }),
    'rules as string': () => broken0((c) => { c.rules = 'nope'; }),
    'endings as object': () => broken0((c) => { c.endings = { a: 1 }; }),
    'world as string': () => broken0((c) => { c.world = 'nope'; }),
    'rooms as array': () => broken0((c) => { c.world.rooms = []; }),
    'objects as array': () => broken0((c) => { c.world.objects = []; }),
    'exits as string': () => broken0((c) => { c.world.rooms.a.exits = 'n'; }),
    'notes as string': () => broken0((c) => { c.world.rooms.a.notes = 'nope'; }),
    'null rule element': () => broken0((c) => { c.rules = [null]; }),
    'null ending element': () => broken0((c) => { c.endings = [null]; }),
    'null timer element': () => broken0((c) => { c.profile.timers = [null]; }),
    'null verb spec': () => broken0((c) => { c.vocabulary.verbs.push = null; }),
    'when as string': () => broken0((c) => { c.rules[0].when = 'nope'; }),
    'flags condition as string': () => broken0((c) => { c.rules[0].when = { flags: 'nope' }; }),
    'null action step': () => broken0((c) => { c.rules[0].do = [null]; }),
    'profile as string': () => broken0((c) => { c.profile = 'nope'; }),
    'stats list as null': () => broken0((c) => { c.profile.stats = { list: null, classes: null }; }),
    'null class entry': () => broken0((c) => { c.profile.stats = { list: { m: 'M' }, classes: { k: null } }; }),
    'encounter actions as object': () => broken0((c) => {
      c.profile.combat = true;
      c.profile.stats = { list: { m: 'M' }, classes: { k: { stats: { m: 1 } } } };
      c.encounters = { e: { kind: 'combat', opponent: { name: 'x', hp: 2 }, actions: { a: 1 } } };
    }),
    'null encounter action': () => broken0((c) => {
      c.profile.combat = true;
      c.profile.stats = { list: { m: 'M' }, classes: { k: { stats: { m: 1 } } } };
      c.encounters = { e: { kind: 'combat', opponent: { name: 'x', hp: 2 }, actions: [null] } };
    }),
    'fuel as string': () => broken0((c) => { c.profile.light = { fuel: 'nope' }; }),
    'fuel warnings as string': () => broken0((c) => { c.profile.light = { fuel: { object: 'gem', turns: 5, warnings: 'nope' } }; }),
    'deep outcome chain': () => broken0((c) => {
      let outcome = { type: 'say', text: ['x'] };
      for (let i = 0; i < 10000; i++) outcome = { type: 'encounter', encounter: 'nope', fallback: outcome };
      c.profile.darkness = { onFail: outcome };
    })
  };
}
/* A cartridge mutated but NOT validated, so the sweep above can drive
   `validate()` itself and observe what it does with the result. */
function broken0(mutate) {
  const cart = base();
  cart.profile = cart.profile || {};
  cart.vocabulary = cart.vocabulary || { verbs: {} };
  mutate(cart);
  return cart;
}

function testValidationIsTotal() {
  const shapes = malformedShapes();
  const threw = [];
  const silent = [];
  for (const [name, make] of Object.entries(shapes)) {
    let result;
    try {
      result = V.validate(make());
    } catch (err) {
      threw.push(name + ' (' + err.constructor.name + ': ' + err.message + ')');
      continue;
    }
    if (result.ok) silent.push(name);
    /* A diagnostic is only useful if it is addressed like every other. */
    for (const finding of result.findings) {
      assert.ok(finding.code && finding.where && typeof finding.path === 'string',
        name + ': every finding stays addressed');
    }
  }
  assert.deepStrictEqual(threw, [], 'no malformed cartridge may throw out of the validator:\n    ' + threw.join('\n    '));
  assert.deepStrictEqual(silent, [], 'and none may pass silently:\n    ' + silent.join('\n    '));
  console.log('  ok — ' + Object.keys(shapes).length + ' malformed shapes all report instead of throwing');
}

function testMalformedMessagesNameTheShape() {
  /* "must be an object, got null" is worth more than "cannot read
     properties of null", which is what the audit saw in a browser. */
  assert.ok(saysError(broken((c) => { c.world.rooms.ghost = null; }), 'room "ghost" must be an object, got null.'));
  assert.ok(saysError(broken((c) => { c.rules = { a: 1 }; }), 'rules must be an array, got an object.'));
  assert.ok(saysError(broken((c) => { c.endings = [null]; }), 'an ending must be an object, got null.'));
  assert.ok(saysError(broken((c) => { c.world = 'nope'; }), 'world must be an object, got the string "nope".'));
  console.log('  ok — malformed-shape messages say what arrived and what was wanted');
}

function testRecursionIsBounded() {
  let outcome = { type: 'say', text: ['x'] };
  for (let i = 0; i < 10000; i++) outcome = { type: 'encounter', encounter: 'nope', fallback: outcome };
  const result = broken((c) => { c.profile.darkness = { onFail: outcome }; });
  assert.strictEqual(result.ok, false);
  assert.ok(result.findings.some((f) => f.code === 'outcome-too-deep'),
    'a runaway outcome chain is reported, not a RangeError');
  assert.ok(V.OUTCOME_DEPTH > 0 && V.OUTCOME_DEPTH < 100, 'the bound is a small declared number');
  console.log('  ok — recursive outcome nesting is bounded and reported');
}

function testStructureBoundsAndExactProseShapes() {
  for (const mutate of [
    (c) => { c.rules = null; },
    (c) => { c.world.rooms = null; },
    (c) => { c.profile.timers = null; },
    (c) => { c.world.rooms.a.desc = { other: '@s:missing' }; },
    (c) => { c.world.rooms.a.desc = { other: 'literal' }; }
  ]) {
    let result;
    assert.doesNotThrow(() => { result = broken(mutate); });
    assert.strictEqual(result.ok, false);
  }
  const valid = broken((c) => { c.strings = { known: 'Known.' }; c.world.rooms.a.desc = ['literal', { text: '@s:known', cls: 'dim' }]; });
  assert.ok(valid.ok, 'supported one-level prose forms remain valid');
  const missing = broken((c) => { c.world.rooms.a.desc = '@s:missing'; });
  assert.strictEqual(missing.findings.find((f) => f.code === 'string-missing').path, 'world.rooms.a.desc');

  const deep = broken((c) => {
    let node = c.extra = {};
    for (let i = 0; i < 15000; i++) node.next = {} , node = node.next;
  });
  assert.ok(deep.findings.some((f) => f.code === 'structure-too-deep'));
  assert.ok(V.MAX_STRUCTURE_DEPTH === 256 && V.MAX_STRUCTURE_NODES === 50000);
  const many = broken((c) => { c.extra = Array.from({ length: V.MAX_STRUCTURE_NODES + 1 }, () => ({})); });
  assert.ok(many.findings.some((f) => f.code === 'structure-too-large'));

  let nested = { type: 'say', text: 'done' };
  for (let i = 0; i < 1000; i++) nested = { type: 'rules', do: [{ outcome: nested }] };
  const nestedResult = broken((c) => { c.profile.darkness = { onFail: nested }; });
  assert.strictEqual(nestedResult.ok, false);
  assert.ok(nestedResult.findings.some((f) => f.code === 'structure-too-deep'));
  console.log('  ok — null collections, exact prose leaves, hostile depth/size, and alternating nesting are total');
}

/* ============================================================
   B-003 — PROSE COVERAGE MATCHES RUNTIME RESOLUTION
   Every slot the runtime resolves is checked, and a reference in a
   slot it does not resolve is refused rather than printed raw.
   ============================================================ */

/* The slots the audit found unvalidated, plus the rest of the object
   message set found by reading every say()/pushText() call site. */
const SUPPORTED_SLOTS = [
  ['intro', (c, v) => { c.intro = v; }],
  ['help', (c, v) => { c.help = v; }],
  ['quitText', (c, v) => { c.quitText = v; }],
  ['world.rooms.a.desc', (c, v) => { c.world.rooms.a.desc = v; }],
  ['world.rooms.a.short', (c, v) => { c.world.rooms.a.short = v; }],
  ['world.rooms.a.notes[0].text', (c, v) => { c.world.rooms.a.notes = [{ when: { flags: { opened: true } }, text: v }]; }],
  ['world.rooms.a.exits.e.deny', (c, v) => { c.world.rooms.a.exits.e.deny = v; }],
  ['world.objects.lever.desc', (c, v) => { c.world.objects.lever.desc = v; }],
  ['world.objects.lever.examine', (c, v) => { c.world.objects.lever.examine = v; }],
  ['world.objects.lever.read', (c, v) => { c.world.objects.lever.read = v; }],
  ['world.objects.gem.takeText', (c, v) => { c.world.objects.gem.takeText = v; }],
  ['world.objects.lever.cannotTake', (c, v) => { c.world.objects.lever.cannotTake = v; }],
  ['world.objects.gem.dropText', (c, v) => { c.world.objects.gem.dropText = v; }],
  ['world.objects.box.cannotOpen', (c, v) => { c.world.objects.box.cannotOpen = v; }],
  ['world.objects.box.lockedText', (c, v) => { c.world.objects.box.lockedText = v; }],
  ['world.objects.box.openText', (c, v) => { c.world.objects.box.openText = v; }],
  ['world.objects.box.unlockText', (c, v) => { c.world.objects.box.unlockText = v; }],
  ['world.objects.box.acceptText', (c, v) => { c.world.objects.box.acceptText = v; }],
  ['world.objects.box.rejectText', (c, v) => { c.world.objects.box.rejectText = v; }],
  ['world.objects.lever.lightText', (c, v) => { c.world.objects.lever.lightText = v; }],
  ['world.objects.lever.douseText', (c, v) => { c.world.objects.lever.douseText = v; }],
  ['vocabulary.verbs.pull.prompt', (c, v) => { c.vocabulary.verbs.pull.prompt = v; }],
  ['vocabulary.verbs.pull.fallback', (c, v) => { c.vocabulary.verbs.pull.fallback = v; }],
  ['rules[0].do[1].say', (c, v) => { c.rules[0].do[1] = { say: v }; }],
  ['rules[0].otherwise[0].say', (c, v) => { c.rules[0].otherwise = [{ say: v }]; }],
  ['rules[0].do[1].die', (c, v) => { c.rules[0].do[1] = { die: v }; }],
  ['endings[0].text', (c, v) => { c.endings[0].text = v; }],
  ['profile.darkness.warning', (c, v) => { c.profile.darkness = { warning: v }; }],
  ['profile.darkness.onFail.text', (c, v) => { c.profile.darkness = { onFail: { type: 'death', text: v } }; }],
  ['profile.light.fuel.outText', (c, v) => { c.profile.light = { fuel: { object: 'gem', turns: 5, outText: v } }; }],
  ['profile.light.fuel.warnings[0][1]', (c, v) => { c.profile.light = { fuel: { object: 'gem', turns: 5, warnings: [[2, v]] } }; }],
  ['profile.timers[0].do[0].say', (c, v) => { c.profile.timers = [{ id: 't', after: 3, do: [{ say: v }] }]; }],
  ['encounters.rat.intro', (c, v) => { withCombat(c).intro = v; }],
  ['encounters.rat.hit', (c, v) => { withCombat(c).hit = v; }],
  ['encounters.rat.miss', (c, v) => { withCombat(c).miss = v; }],
  ['encounters.rat.defeated', (c, v) => { withCombat(c).defeated = v; }],
  ['encounters.rat.actions[0].hitText', (c, v) => { withCombat(c).actions[0].hitText = v; }],
  ['encounters.rat.actions[0].missText', (c, v) => { withCombat(c).actions[0].missText = v; }],
  ['encounters.rat.actions[0].deny', (c, v) => { withCombat(c).actions[0].deny = v; }],
  ['encounters.rat.onWin.text', (c, v) => { withCombat(c).onWin = { type: 'say', text: v }; }]
];

/* Slots that carry visible words but are NOT resolved: they are
   concatenated into generated sentences or handed straight to a shell's
   DOM. A reference in one of these would reach the player as a raw
   token, so it is refused. */
const UNSUPPORTED_SLOTS = [
  ['world.rooms.a.name', (c, v) => { c.world.rooms.a.name = v; }],
  ['world.objects.gem.name', (c, v) => { c.world.objects.gem.name = v; }],
  ['profile.score.ranks[0][1]', (c, v) => { c.profile.score = { enabled: true, ranks: [[0, v]] }; }],
  ['meta.title', (c, v) => { c.meta.title = v; }],
  ['strings.echo', (c, v) => { c.strings.echo = v; }],
  ['encounters.rat.opponent.name', (c, v) => { withCombat(c).opponent.name = v; }],
  ['encounters.rat.actions[0].label', (c, v) => { withCombat(c).actions[0].label = v; }],
  ['profile.stats.list.might', (c, v) => { withCombat(c); c.profile.stats.list.might = v; }],
  ['profile.stats.classes.knight.name', (c, v) => { withCombat(c); c.profile.stats.classes.knight.name = v; }],
  /* `prompt2` is only read where a separator splits a command and the
     second half is empty, which the parser's splitOn cannot produce. A
     reference there would never print, so it is refused rather than
     silently accepted as though it worked. */
  ['vocabulary.verbs.pull.prompt2', (c, v) => { c.vocabulary.verbs.pull.prompt2 = v; }]
];

function withCombat(cart) {
  cart.profile.combat = true;
  cart.profile.stats = cart.profile.stats || {
    list: { might: 'Might' },
    classes: { knight: { name: 'Knight', stats: { might: 3 } } }
  };
  cart.encounters = cart.encounters || {
    rat: {
      kind: 'combat', opponent: { name: 'Rat', hp: 4 },
      actions: [{ id: 'hit', kind: 'strike', uses: 'might' }]
    }
  };
  return cart.encounters.rat;
}

/* A fixture rich enough that every slot above has somewhere to live. */
function proseBase() {
  const cart = base();
  cart.strings = { known: 'Known text.' };
  cart.profile = cart.profile || {};
  cart.world.objects.box.key = 'gem';
  cart.rules[0].do.push({ say: 'placeholder' });
  return cart;
}

function testEverySupportedSlotIsChecked() {
  const missed = [], rejected = [];
  for (const [name, put] of SUPPORTED_SLOTS) {
    const good = proseBase();
    put(good, '@s:known');
    const g = V.validate(good);
    if (g.findings.some((f) => f.code === 'string-ref-unsupported')) rejected.push(name);

    const bad = proseBase();
    put(bad, '@s:nope');
    const b = V.validate(bad);
    const found = b.findings.find((f) => f.code === 'string-missing' && f.path === name);
    if (!found) missed.push(name + ' (got: ' + b.findings.filter((f) => /^string-/.test(f.code)).map((f) => f.code + '@' + f.path).join(', ') + ')');
  }
  assert.deepStrictEqual(rejected, [], 'a declared slot must accept a resolvable reference:\n    ' + rejected.join('\n    '));
  assert.deepStrictEqual(missed, [], 'a missing key must be an error at the exact path:\n    ' + missed.join('\n    '));
  console.log('  ok — all ' + SUPPORTED_SLOTS.length + ' supported prose slots validate their references');
}

function testUnsupportedSlotsRefuseReferences() {
  const silent = [];
  for (const [name, put] of UNSUPPORTED_SLOTS) {
    const cart = proseBase();
    put(cart, '@s:known');          // a key that EXISTS — still refused
    const result = V.validate(cart);
    const found = result.findings.find((f) => f.code === 'string-ref-unsupported' && f.path === name);
    if (!found) silent.push(name);
  }
  assert.deepStrictEqual(silent, [], 'a reference in an unresolved slot must be refused:\n    ' + silent.join('\n    '));
  console.log('  ok — all ' + UNSUPPORTED_SLOTS.length + ' unresolved slots refuse references instead of printing them raw');
}

function testLiteralContract() {
  /* Only the exact shape is reserved. Everything else is prose. */
  const literals = ['see @s:known below', '@s:known and more', '@s: known', '@s:has spaces', 'x@s:known', ''];
  for (const literal of literals) {
    const cart = proseBase();
    cart.world.rooms.a.desc = literal;
    const result = V.validate(cart);
    assert.ok(!result.findings.some((f) => /^string-(missing|ref-unsupported)$/.test(f.code)),
      JSON.stringify(literal) + ' is ordinary prose, not a reference');
  }
  /* And the reserved shape is reserved everywhere, including for a key
     that happens to exist. There is no escape; that is the contract. */
  const exact = proseBase();
  exact.world.objects.gem.name = '@s:known';
  assert.ok(V.validate(exact).findings.some((f) => f.code === 'string-ref-unsupported'),
    'an exact reference in an unresolved slot has no literal reading');
  console.log('  ok — only the exact @s:key shape is reserved, and it is reserved everywhere');
}

function testOneFindingPerMissingReference() {
  /* A missing key on a death/say outcome used to report twice, because
     the text was checked before the switch and again inside it. */
  const cart = proseBase();
  cart.profile.darkness = { onFail: { type: 'death', text: '@s:nope' } };
  const findings = V.validate(cart).findings
    .filter((f) => f.code === 'string-missing' && f.path === 'profile.darkness.onFail.text');
  assert.strictEqual(findings.length, 1, 'one missing reference, one finding (got ' + findings.length + ')');
  console.log('  ok — a missing reference is reported exactly once');
}

const tests = [testCleanCartridge, testShippedCartridges, testWorldErrors, testExitRequirementsFailLoud,
  testContainerCycles, testRuleErrors, testFlagReconciliation, testProfileErrors,
  testUnreachableTreasure, testPresentationErrors, testReportFormatting,
  testFindingsAreStructured, testPathsAddressTheRealFault,
  testStringReferences, testCrumblyIsWrittenEntirelyInStrings,
  testFormatMustBeDeclared, testVersionMustBeSupported, testFormatCheckIsShared,
  testValidationIsTotal, testMalformedMessagesNameTheShape, testRecursionIsBounded,
  testStructureBoundsAndExactProseShapes,
  testEverySupportedSlotIsChecked, testUnsupportedSlotsRefuseReferences,
  testLiteralContract, testOneFindingPerMissingReference];
let failed = 0;
console.log('\nMORROWLAMP — cartridge validator\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
