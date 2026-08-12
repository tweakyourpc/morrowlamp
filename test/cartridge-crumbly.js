/* ============================================================
   MORROWLAMP — the third cartridge
   Sir Crumbly exists to prove the RPG capability is a capability
   and not The Sunken Crown in a false moustache. Two stats, one
   class, ten-ish health, one rat.

   The strongest assertion in this file is the negative one: with
   nothing from Sunken Crown loaded in the process at all, the
   stats and combat systems still work.
   Run with:  node test/cartridge-crumbly.js
   ============================================================ */
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

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
require('../js/cartridges/sir-crumbly.js');

const CART = Z.cartridges['sir-crumbly'];
const { luckyDice, unluckyDice } = require('./play-route.js');

const make = (random) => Z.ml.runtime.create(CART, { random: random || luckyDice() });
const txt = (r) => r.messages.map((m) => m.text).join(' | ');

/* ---------------- nothing of Sunken Crown is here ---------------- */
function testIndependence() {
  assert.strictEqual(Z.world, undefined, 'the Sunken Crown world is not loaded');
  assert.strictEqual(Z.cartridges['the-sunken-crown'], undefined, 'nor is the Sunken Crown cartridge');
  assert.ok(Z.ml.stats && Z.ml.encounter, 'the RPG capability is the Machine\'s, and it is here');

  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'cartridges', 'sir-crumbly.js'), 'utf8');
  for (const forbidden of ['Z.world', 'Z.scenes', 'Z.sprites', 'umbra', 'lantern', 'delver']) {
    assert.ok(!source.toLowerCase().includes(forbidden.toLowerCase()), 'the cartridge does not reach for ' + forbidden);
  }
  assert.ok(Z.ml.validator.validate(CART).ok, 'and it validates cleanly');
  console.log('  ok — the cartridge shares the Machine and nothing else');
}

/* ---------------- its RPG layer looks nothing like Sunken Crown's ---------------- */
function testItsOwnRpgLayer() {
  const rt = make();
  const sheet = rt.sheet();
  assert.deepStrictEqual(sheet.stats.map((s) => s.id), ['might', 'nerve'], 'two stats, not five');
  assert.deepStrictEqual(sheet.stats.map((s) => s.name), ['Might', 'Nerve']);
  assert.strictEqual(rt.classes().length, 1, 'one class, not three');
  assert.strictEqual(sheet.className, 'Knight, Impoverished');
  /* health = base 6 + nerve 4 * 1 = 10 */
  assert.strictEqual(sheet.maxHp, 10, 'ten health, from this cartridge\'s own formula');
  assert.strictEqual(rt.statsConfig.levels.max, 5, 'and its own level ceiling');
  console.log('  ok — two stats, one class, ten health: none of it Sunken Crown\'s');
}

/* ---------------- the rat guards the cheese ---------------- */
function testTheRatGuards() {
  const rt = make();
  rt.command('d');
  assert.ok(txt(rt.command('take cheese')).includes('You reconsider'), 'the cheese is guarded');
  assert.ok(!rt.inventory().includes('cheese'));
  assert.strictEqual(rt.meta().win, false);
  console.log('  ok — the cheese cannot simply be taken');
}

/* ---------------- the fight ---------------- */
function testTheFight() {
  const rt = make();
  rt.command('d');
  const started = rt.command('attack rat');
  assert.ok(txt(started).includes('6 points of rat'), 'the encounter introduces itself');
  const enc = rt.encounter();
  assert.strictEqual(enc.name, 'Cellar Rat');
  assert.strictEqual(enc.hp, 6);
  assert.deepStrictEqual(enc.actions.map((a) => a.id), ['attack', 'guard', 'flee']);
  assert.ok(!enc.actions.some((a) => a.id === 'light'), 'no light action: this game has no darkness');

  let guard = 20;
  while (rt.encounter() && guard--) rt.encounterAct('attack');
  assert.ok(rt.flags().ratBeaten, 'beating it runs the onWin outcome');
  assert.ok(rt.sheet().xp >= 12, 'and awards its experience');
  assert.strictEqual(rt.meta().dead, false);

  assert.ok(txt(rt.command('take cheese')).includes('heavier than your armour'), 'the cheese is free now');
  assert.strictEqual(rt.meta().win, true, 'and that is the game');
  assert.strictEqual(rt.meta().score, 20);
  assert.strictEqual(rt.meta().rank, 'Cheese-Bearer');
  console.log('  ok — Sir Crumbly can defeat a rat with a spoon and win (20 points, Cheese-Bearer)');
}

/* ---------------- and can lose to it ---------------- */
function testTheRatCanWin() {
  const rt = make(unluckyDice());
  rt.command('d');
  rt.command('attack rat');
  let guard = 20;
  while (rt.encounter() && guard--) rt.encounterAct('attack');
  assert.strictEqual(rt.meta().dead, true, 'ten health does not go far');
  assert.ok(!rt.flags().ratBeaten);
  console.log('  ok — and the rat can win, which is the low moment for knighthood');
}

/* ---------------- fleeing goes somewhere, because the cartridge said so ---------------- */
function testFleeing() {
  /* 0.35 beats the declared flee chance of 0.4. */
  const rt = make(() => 0.35);
  rt.command('d');
  rt.command('attack rat');
  const fled = rt.encounterAct('flee');
  assert.ok(txt(fled).includes('what dignity remains'));
  assert.strictEqual(rt.encounter(), null, 'the encounter ended');
  assert.strictEqual(rt.meta().room, 'pantry', 'the onFlee outcome moved you upstairs');
  assert.strictEqual(rt.meta().dead, false);
  assert.ok(!rt.flags().ratBeaten, 'and the rat still has the cheese');
  console.log('  ok — fleeing resolves through an outcome the cartridge chose');
}

/* ---------------- the capabilities it declined stay off ---------------- */
function testDeclinedCapabilities() {
  const rt = make();
  assert.strictEqual(rt.meta().treasures, 0, 'no treasure hunt');
  assert.strictEqual(rt.meta().fuel, null, 'no lamp');
  assert.strictEqual(rt.profile.darkness.enabled, false, 'no darkness');
  for (const id in CART.world.rooms) assert.ok(!CART.world.rooms[id].dark);
  assert.ok(rt.hasStats() && rt.hasCombat(), 'but stats and combat are on');
  console.log('  ok — the capabilities it declined stay off');
}

const tests = [testIndependence, testItsOwnRpgLayer, testTheRatGuards, testTheFight,
  testTheRatCanWin, testFleeing, testDeclinedCapabilities];
let failed = 0;
console.log('\nSIR CRUMBLY AND THE CELLAR RAT\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
