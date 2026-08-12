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

const tests = [testCleanCartridge, testShippedCartridges, testWorldErrors, testExitRequirementsFailLoud,
  testContainerCycles, testRuleErrors, testFlagReconciliation, testProfileErrors,
  testUnreachableTreasure, testPresentationErrors, testReportFormatting];
let failed = 0;
console.log('\nMORROWLAMP — cartridge validator\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
