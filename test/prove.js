/* ============================================================
   MORROWLAMP — the prover
   A validator proves a cartridge is well formed. This proves it
   can be finished, which is the claim a player cares about, and
   the two are genuinely different: every cartridge below that
   fails here validates perfectly.

   A prover nobody has tried to fool would pass everything, so
   each check gets a game that is broken in exactly one way.
   Run with:  node test/prove.js
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
require('../js/workshop/prove.js');
require('../js/world.js');
require('../js/cartridges/sunken-crown.js');
require('../js/cartridges/captains-thistle.js');
require('../js/cartridges/sir-crumbly.js');

const ml = Z.ml;
const P = ml.prove;

/* A two-room game with a door, a key and a way to win. Small enough to
   read, complete enough to break in interesting ways. */
function base() {
  return {
    format: 'morrowlamp-cartridge',
    formatVersion: 2,
    meta: { id: 'provable', title: 'A Provable Game', version: '1.0.0' },
    startFlags: { unlocked: false },
    world: {
      startRoom: 'hall',
      startInventory: [],
      rooms: {
        hall: {
          name: 'Hall', desc: 'A hall with a locked door east.',
          exits: { e: { room: 'vault', flagReq: 'unlocked', deny: 'The door is locked.' } }
        },
        vault: { name: 'Vault', desc: 'The vault.', exits: { w: 'hall' } }
      },
      objects: {
        key: { name: 'iron key', aliases: ['key'], at: 'hall', takeable: true, desc: 'An iron key lies here.' },
        door: { name: 'door', aliases: ['door'], at: 'hall', desc: 'A locked door.' }
      }
    },
    vocabulary: { verbs: {} },
    rules: [{
      id: 'unlock-the-door', verb: ['unlock', 'use'], target: ['door', 'key'], with: ['key', 'door'],
      when: { room: 'hall', carrying: ['key'], flags: { unlocked: false } },
      do: [{ set: 'unlocked' }, { say: 'The lock turns.' }, { score: 10 }]
    }],
    profile: { score: { enabled: true, ranks: [[0, 'Outside'], [10, 'Inside']] } },
    endings: [{ id: 'got-in', kind: 'win', when: { room: 'vault' }, text: ['You are in.'] }],
    walkthrough: { route: ['take key', 'unlock door with key', 'e'], ending: 'got-in', score: 10 },
    presentation: { renderer: 'ega', audio: 'chip', interface: 'parser' }
  };
}

function bent(mutate) {
  const cart = base();
  mutate(cart);
  return cart;
}
function codes(findings) { return findings.map((f) => f.code); }

/* ---------------- the honest case ---------------- */
function testAWinnableGameProves() {
  const cart = base();
  assert.ok(ml.validator.validate(cart).ok, 'the fixture validates first');
  const result = P.run(cart);
  assert.ok(result.ok, 'and it proves: ' + (result.walkthrough.text || ''));
  assert.strictEqual(result.walkthrough.ending, 'got-in');
  assert.strictEqual(result.walkthrough.score, 10);
  assert.strictEqual(result.walkthrough.steps, 3);
  assert.ok(P.report(result).startsWith('WALKTHROUGH PROVED'), 'and the report says so');
  console.log('  ok — a winnable game proves, with its ending and its score');
}

/* ---------------- the ways it must fail ---------------- */
function testAnUnwinnableGameFails() {
  /* The puzzle is removed, so the route walks into a door that will
     never open. The cartridge is still perfectly well formed. */
  const cart = bent((c) => {
    c.rules = [{ id: 'unlock-the-door', verb: 'unlock', target: 'door', do: [{ say: 'It will not budge.' }] }];
    c.startFlags.unlocked = false;
    /* Keep the flag legal for the validator: something must set it. */
    c.rules.push({ id: 'never', verb: 'wait', do: [{ set: 'unlocked' }], reach: 'anywhere' });
    c.rules[1].when = { room: 'nowhere-at-all' };
  });
  cart.world.rooms['nowhere-at-all'] = { name: 'Nowhere', desc: 'Unreachable.', exits: {} };

  assert.ok(ml.validator.validate(cart).ok, 'the broken game still VALIDATES — that is the point');
  const result = P.run(cart);
  assert.strictEqual(result.ok, false, 'but it does not prove');
  assert.strictEqual(result.walkthrough.reason, 'failed');
  assert.strictEqual(result.walkthrough.step, 3, 'and names the step it died on');
  assert.strictEqual(result.walkthrough.command, 'e');
  assert.ok(/without reaching an ending/.test(result.walkthrough.message), 'and says what went wrong');
  assert.ok(P.report(result).startsWith('WALKTHROUGH FAILED'));
  console.log('  ok — a game that validates but cannot be won fails, at the step it fails on');
}

function testTheWrongEndingFails() {
  const cart = bent((c) => { c.walkthrough.ending = 'some-other-ending'; });
  const result = P.run(cart);
  assert.strictEqual(result.ok, false);
  assert.ok(/ended on "got-in", not the declared "some-other-ending"/.test(result.walkthrough.message),
    'the declared ending is held to');
  console.log('  ok — reaching the wrong ending is a failure');
}

function testTheWrongScoreFails() {
  const cart = bent((c) => { c.walkthrough.score = 999; });
  const result = P.run(cart);
  assert.strictEqual(result.ok, false);
  assert.ok(/scored 10, not the declared 999/.test(result.walkthrough.message), 'the declared score is held to');
  console.log('  ok — finishing on the wrong score is a failure');
}

function testDeathIsAFailure() {
  const cart = bent((c) => {
    c.rules.push({ id: 'fatal-key', verb: 'take', target: 'key', do: [{ die: ['The key was a trap.'] }] });
    c.rules.unshift(c.rules.pop());
  });
  const result = P.run(cart);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.walkthrough.step, 1, 'the step that killed the player is named');
  assert.ok(/died/.test(result.walkthrough.message));
  console.log('  ok — dying on the route is a failure, and the route says where');
}

function testNoWalkthroughIsAWarningNotAFailure() {
  const cart = bent((c) => { delete c.walkthrough; });
  const result = P.run(cart);
  assert.strictEqual(result.ok, true, 'a game with no declared route is not failed');
  assert.ok(codes(result.findings).includes('no-walkthrough'), 'but it is not proven either, and says so');
  assert.ok(P.report(result).startsWith('NOT PROVEN'));
  console.log('  ok — an undeclared walkthrough is "not proven", not "broken"');
}

/* ---------------- dead content ---------------- */
function testShadowedRule() {
  const cart = bent((c) => {
    /* A broad rule with no `when` takes every turn it matches, so the
       specific rule written after it can never fire. */
    c.rules.unshift({ id: 'catch-all', verb: ['unlock', 'use'], do: [{ say: 'Nothing happens.' }] });
  });
  const found = P.deadContent(cart).find((f) => f.code === 'rule-shadowed');
  assert.ok(found, 'the shadowed rule is reported');
  assert.ok(/RULE 1 \(catch-all\)/.test(found.message), 'and the rule doing the shadowing is named');
  assert.strictEqual(found.path, 'rules[1]');

  /* A rule with a `when` and no `otherwise` falls through, so it
     shadows nothing. */
  const innocent = bent((c) => {
    c.rules.unshift({ id: 'conditional', verb: ['unlock', 'use'], when: { room: 'vault' }, do: [{ say: 'No.' }] });
  });
  assert.ok(!codes(P.deadContent(innocent)).includes('rule-shadowed'),
    'a rule that can fall through shadows nothing');
  console.log('  ok — a rule an earlier rule always claims first is reported');
}

function testUnproducibleObject() {
  const cart = bent((c) => {
    c.world.objects.ghost = { name: 'ghost', aliases: ['ghost'], desc: 'A ghost.' };
  });
  const found = P.deadContent(cart).find((f) => f.code === 'object-unproducible');
  assert.ok(found && /ghost/.test(found.where), 'an object nothing can produce is reported');

  const given = bent((c) => {
    c.world.objects.ghost = { name: 'ghost', aliases: ['ghost'], desc: 'A ghost.' };
    c.rules[0].do.push({ give: 'ghost' });
  });
  assert.ok(!codes(P.deadContent(given)).includes('object-unproducible'),
    'an object a rule gives is producible');
  console.log('  ok — an object the player can never meet is reported');
}

function testFlagNeverRead() {
  const cart = bent((c) => { c.rules[0].do.push({ set: 'somethingHappened' }); });
  assert.ok(codes(P.deadContent(cart)).includes('flag-never-read'), 'a write-only flag is reported');
  console.log('  ok — a flag that is set but never tested is reported');
}

function testUnfirableEnding() {
  const cart = bent((c) => {
    c.endings.push({ id: 'orphan', kind: 'lose', text: ['Nobody can see this.'] });
  });
  const found = P.deadContent(cart).find((f) => f.code === 'ending-unfirable');
  assert.ok(found && /orphan/.test(found.where), 'an ending nothing can fire is reported');
  console.log('  ok — an ending with no `when` and no rule to end it is reported');
}

function testCleanCartridgesStayQuiet() {
  /* The checks above are only useful if they are silent on good work. */
  for (const id of ['the-sunken-crown', 'captains-thistle', 'sir-crumbly']) {
    const findings = P.deadContent(Z.cartridges[id]);
    assert.deepStrictEqual(findings, [], id + ' should report no dead content, got: ' +
      findings.map((f) => f.text).join('; '));
  }
  console.log('  ok — the shipped cartridges report no dead content');
}

/* ---------------- the shipped games ---------------- */
function testShippedCartridgesProve() {
  for (const id of ['the-sunken-crown', 'captains-thistle', 'sir-crumbly']) {
    const result = P.run(Z.cartridges[id]);
    assert.ok(result.walkthrough.declared, id + ' declares a walkthrough');
    assert.ok(result.ok, id + ' must prove: ' + (result.walkthrough.text || ''));
  }
  console.log('  ok — every shipped cartridge proves it can be finished');
}

function testTheCanonicalRouteHasOneSource() {
  /* The Sunken Crown's route lives in the cartridge, because it is a
     claim the game makes about itself. `test/winning-route.js` holds the
     same route for the suites that drive the compiled artifact, where
     the cartridge is inside the file being tested. Two copies of a route
     that silently disagreed would make both proofs worthless. */
  const fromCartridge = Z.cartridges['the-sunken-crown'].walkthrough.route;
  const fromTest = require('./winning-route.js');
  assert.deepStrictEqual(fromCartridge, fromTest,
    'the cartridge\'s walkthrough and test/winning-route.js must be the same route');
  console.log('  ok — the canonical route is the same in the cartridge and in the test suite');
}

const tests = [testAWinnableGameProves, testAnUnwinnableGameFails, testTheWrongEndingFails,
  testTheWrongScoreFails, testDeathIsAFailure, testNoWalkthroughIsAWarningNotAFailure,
  testShadowedRule, testUnproducibleObject, testFlagNeverRead, testUnfirableEnding,
  testCleanCartridgesStayQuiet, testShippedCartridgesProve, testTheCanonicalRouteHasOneSource];
let failed = 0;
console.log('\nMORROWLAMP — the prover\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
