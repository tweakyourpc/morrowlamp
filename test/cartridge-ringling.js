/* LAB SUPPORT: THE LAST LOGIN conformance and playthrough. */
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
require('../js/cartridges/ringling-helpdesk.js');

const CART = Z.cartridges['ringling-helpdesk'];
const text = (result) => result.messages.map((message) => message.text).join(' | ');
const fresh = () => Z.ml.runtime.create(CART);

function testContract() {
  const result = Z.ml.validator.validate(CART);
  assert.ok(result.ok, Z.ml.validator.report(result));
  assert.strictEqual(CART.presentation.interface, 'canvas');
  assert.ok(CART.presentation.art.scene.helpDesk, 'the help desk has a semantic scene');
  assert.ok(CART.presentation.title.showSplash, 'the graphical title flow is enabled');
  assert.strictEqual(Object.keys(CART.world.rooms).length, 5);
  assert.strictEqual(Object.keys(CART.world.objects).length, 7);
  assert.strictEqual(CART.walkthrough.ending, 'shift-complete');
  console.log('  ok — Ringling help-desk cartridge validates as a five-room graphical game');
}

function testTicketCannotCloseEarly() {
  const rt = fresh();
  rt.command('take ticket');
  assert.match(text(rt.command('submit ticket')), /not ready to close/i);
  assert.strictEqual(rt.meta().win, false);
  console.log('  ok — the support ticket resists an early close');
}

function testPlaythrough() {
  const rt = fresh();
  for (const command of CART.walkthrough.route) rt.command(command);
  assert.strictEqual(rt.meta().win, true);
  assert.strictEqual(rt.meta().ending, 'shift-complete');
  assert.strictEqual(rt.meta().score, 30);
  assert.ok(rt.flags().loginFixed && rt.flags().printerFixed && rt.flags().networkFixed);
  console.log('  ok — the full help-desk shift resolves all three tickets (30 points)');
}

function testProof() {
  const result = Z.ml.prove.run(CART);
  assert.ok(result.ok, result.text || 'the declared walkthrough should prove the game');
  assert.strictEqual(result.walkthrough.ending, 'shift-complete');
  assert.strictEqual(result.walkthrough.score, 30);
  console.log('  ok — the cartridge proves its own declared route');
}

const tests = [testContract, testTicketCannotCloseEarly, testPlaythrough, testProof];
let failed = 0;
console.log('\nLAB SUPPORT: THE LAST LOGIN\n');
for (const test of tests) {
  try { test(); } catch (error) { failed++; console.error('  FAIL — ' + test.name + ': ' + error.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
