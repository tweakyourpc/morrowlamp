/* ============================================================
   MORROWLAMP — the import boundary
   The one place a cartridge from somewhere else gets in. What is
   tested here is not "does the validator work" — that is
   test/validator.js — but the boundary's own contract:

     · the order is parse → format → version → structure;
     · every step is fatal;
     · nothing is mutated unless the answer is yes.

   The last one is the reason this file exists. Before the audit,
   `test/workshop.js` round-tripped a cartridge through
   JSON.stringify and JSON.parse and called that an import test.
   It never touched the acceptance path, so the acceptance path
   was never tested, and it was wrong in two ways at once.
   Run with:  node test/import.js
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
require('../js/workshop/import.js');
require('../js/cartridges/sir-crumbly.js');

const ml = Z.ml;

/* A small cartridge that really validates, serialized the way the
   Workshop's "Save cartridge (JSON)" writes one. */
function goodCartridge() {
  return {
    format: 'morrowlamp-cartridge',
    formatVersion: 2,
    meta: { id: 'imported', title: 'An Imported Game', version: '1.0.0' },
    intro: ['You arrive.'],
    startFlags: { opened: false },
    world: {
      startRoom: 'hall',
      startInventory: [],
      rooms: {
        hall: { name: 'Hall', desc: 'A hall.', exits: { e: { room: 'vault', flagReq: 'opened', deny: 'Shut.' } } },
        vault: { name: 'Vault', desc: 'The vault.', exits: { w: 'hall' } }
      },
      objects: { lever: { name: 'lever', aliases: ['lever'], at: 'hall', desc: 'A lever.' } }
    },
    vocabulary: { verbs: { pull: { words: ['pull'], form: 'target', prompt: 'Pull what?' } } },
    rules: [{ id: 'pull-it', verb: 'pull', target: 'lever', do: [{ set: 'opened' }, { say: 'Click.' }] }],
    endings: [{ id: 'in', kind: 'win', when: { room: 'vault' }, text: ['You are in.'] }],
    presentation: { renderer: 'ega', audio: 'chip', interface: 'parser' }
  };
}
const asJson = (mutate) => {
  const cart = goodCartridge();
  if (mutate) mutate(cart);
  return JSON.stringify(cart, null, 2);
};

/* ---------------- it accepts what it should ---------------- */
function testAcceptsAGoodCartridge() {
  const result = ml.import.read(asJson(), { name: 'imported.json' });
  assert.strictEqual(result.ok, true, 'a sound cartridge is accepted: ' + result.report);
  assert.strictEqual(result.reason, null);
  assert.strictEqual(result.id, 'imported', 'and keeps its id when nothing collides');
  assert.strictEqual(result.cartridge.meta.title, 'An Imported Game', 'and comes back whole');
  assert.ok(result.report.startsWith('CARTRIDGE VALIDATED'), 'with the validator\'s own report');
  console.log('  ok — a sound cartridge is accepted and returned whole');
}

function testAcceptsEveryShippedCartridgeAsJson() {
  /* Sir Crumbly is the fully JSON-representable tier: it must survive the
     round trip and come back through the real boundary. */
  const text = JSON.stringify(Z.cartridges['sir-crumbly'], null, 2);
  const result = ml.import.read(text, { name: 'sir-crumbly.json', taken: ['sir-crumbly'] });
  assert.strictEqual(result.ok, true, 'Sir Crumbly re-imports: ' + result.report);
  assert.strictEqual(result.id, 'sir-crumbly-2', 'and is offered a free id rather than shadowing the shipped one');
  assert.strictEqual(result.renamed, true);
  console.log('  ok — a shipped cartridge round-trips through the real boundary');
}

function testSuggestsAFreeId() {
  const taken = ['imported', 'imported-2', 'imported-3'];
  const result = ml.import.read(asJson(), { name: 'x.json', taken });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.id, 'imported-4', 'the first free id is offered');
  console.log('  ok — a colliding id is given the next free one, never overwritten');
}

/* ---------------- and refuses what it should ---------------- */
function refusal(text, name) {
  return ml.import.read(text, { name: name || 'bad.json' });
}

function testRefusalOrderIsTheContract() {
  /* Each step is fatal, and the earlier failure is the one reported: a
     file that is not JSON is never asked about its version. */
  const notJson = refusal('{ this is not json');
  assert.strictEqual(notJson.ok, false);
  assert.strictEqual(notJson.reason, 'not-json');
  assert.ok(/not valid JSON/.test(notJson.report));

  const empty = refusal('   ');
  assert.strictEqual(empty.reason, 'unreadable');

  const noFormat = refusal(asJson((c) => { delete c.format; delete c.formatVersion; }));
  assert.strictEqual(noFormat.reason, 'wrong-format', 'a missing format stops at the format step');
  assert.ok(noFormat.findings.some((f) => f.code === 'format-missing'));
  assert.ok(noFormat.findings.some((f) => f.code === 'version-missing'));

  const oldVersion = refusal(asJson((c) => { c.formatVersion = 999; }));
  assert.strictEqual(oldVersion.reason, 'wrong-format');
  assert.ok(oldVersion.findings.some((f) => f.code === 'version-unsupported'));

  const foreign = refusal(asJson((c) => { c.format = 'twine-story'; }));
  assert.strictEqual(foreign.reason, 'wrong-format');

  /* Only a file that IS a cartridge of a version we read gets as far as
     the structural checks. */
  const broken = refusal(asJson((c) => { c.rules[0].do = [{ frobnicate: 'lever' }]; }));
  assert.strictEqual(broken.reason, 'invalid', 'a well-versioned but broken cartridge fails at structure');
  assert.ok(broken.findings.some((f) => f.code === 'unknown-action'));
  console.log('  ok — parse → format → version → structure, each step fatal and reported in order');
}

function testMalformedIsRefusedWithoutThrowing() {
  const shapes = {
    'null': 'null',
    'array': '[1,2,3]',
    'string': '"hello"',
    'number': '42',
    'null room': asJson((c) => { c.world.rooms.ghost = null; }),
    'rules as object': asJson((c) => { c.rules = { a: 1 }; }),
    'endings as object': asJson((c) => { c.endings = { a: 1 }; }),
    'null verb spec': asJson((c) => { c.vocabulary.verbs.pull = null; }),
    'world as string': asJson((c) => { c.world = 'nope'; })
  };
  for (const [name, text] of Object.entries(shapes)) {
    let result;
    assert.doesNotThrow(() => { result = refusal(text, name + '.json'); }, name + ' must not throw');
    assert.strictEqual(result.ok, false, name + ' is refused');
    assert.ok(result.findings.length, name + ' says why');
    assert.notStrictEqual(result.reason, 'validator-faulted',
      name + ' must be a validator DIAGNOSTIC, not a caught exception — the net is not the fix');
  }
  console.log('  ok — ' + Object.keys(shapes).length + ' malformed files are refused as diagnostics, not caught exceptions');
}

/* ---------------- and changes nothing when it refuses ----------------
   The property that makes a failed import safe. It is structural here:
   `read()` has no way to reach the shelf at all, so this test is really
   asserting that the design has not been quietly undone. */
function testRefusalMutatesNothing() {
  const before = JSON.stringify(Z.cartridges);
  const beforeIds = Object.keys(Z.cartridges).slice();
  const bad = [
    '{ not json',
    'null',
    asJson((c) => { delete c.format; }),
    asJson((c) => { c.formatVersion = 999; }),
    asJson((c) => { c.world.rooms.ghost = null; }),
    asJson((c) => { c.rules[0].do = [{ frobnicate: 'x' }]; })
  ];
  for (const text of bad) {
    const result = ml.import.read(text, { name: 'bad.json', taken: beforeIds });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.cartridge, null, 'a refusal hands back no cartridge');
    assert.strictEqual(result.id, null, 'and claims no id');
  }
  assert.strictEqual(JSON.stringify(Z.cartridges), before, 'the shelf is byte-identical after six refusals');
  console.log('  ok — six refusals leave the shelf and every cartridge on it untouched');
}

function testAcceptanceAlsoMutatesNothing() {
  /* Even on success the boundary only decides. Inserting is the caller's
     job, which is what lets the Workshop refuse to insert and still show
     the report. */
  const before = JSON.stringify(Z.cartridges);
  const result = ml.import.read(asJson(), { name: 'imported.json' });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(JSON.stringify(Z.cartridges), before,
    'a successful read still does not put anything on the shelf');
  assert.ok(!Z.cartridges.imported, 'the caller inserts, not the boundary');
  console.log('  ok — even an accepted cartridge is not shelved by the boundary itself');
}

function testAcceptedCartridgeActuallyRuns() {
  /* Accepting a file is only meaningful if what comes back is playable. */
  const result = ml.import.read(asJson(), { name: 'imported.json' });
  const rt = ml.runtime.create(result.cartridge);
  assert.ok(rt.command('e').messages.some((m) => m.text.includes('Shut.')), 'the gate holds');
  rt.command('pull lever');
  rt.command('e');
  assert.strictEqual(rt.meta().win, true, 'and the imported cartridge can be finished');
  console.log('  ok — what comes back through the boundary is a working cartridge');
}

const tests = [testAcceptsAGoodCartridge, testAcceptsEveryShippedCartridgeAsJson, testSuggestsAFreeId,
  testRefusalOrderIsTheContract, testMalformedIsRefusedWithoutThrowing,
  testRefusalMutatesNothing, testAcceptanceAlsoMutatesNothing, testAcceptedCartridgeActuallyRuns];
let failed = 0;
console.log('\nMORROWLAMP — the import boundary\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
