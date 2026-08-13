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

const tests = [testCleanCartridge, testShippedCartridges, testWorldErrors, testExitRequirementsFailLoud,
  testContainerCycles, testRuleErrors, testFlagReconciliation, testProfileErrors,
  testUnreachableTreasure, testPresentationErrors, testReportFormatting,
  testFindingsAreStructured, testPathsAddressTheRealFault,
  testStringReferences, testCrumblyIsWrittenEntirelyInStrings];
let failed = 0;
console.log('\nMORROWLAMP — cartridge validator\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
