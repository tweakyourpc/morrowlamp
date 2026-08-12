/* ============================================================
   MORROWLAMP — the second cartridge
   Captain Thistle plays through on exactly the same runtime that
   runs The Sunken Crown. If anything Sunken-Crown-shaped has
   leaked into the Machine, this is where it shows up.
   Run with:  node test/cartridge-thistle.js
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
require('../js/cartridges/captains-thistle.js');

const CART = Z.cartridges['captains-thistle'];
let rt = null;
const fresh = () => (rt = Z.ml.runtime.create(CART));
const cmd = (s) => rt.command(s);
const txt = (r) => r.messages.map((m) => m.text).join(' | ');

/* ---------------- it is genuinely a different game ---------------- */
function testIndependence() {
  /* Nothing from The Sunken Crown is loaded in this process at all. */
  assert.strictEqual(Z.world, undefined, 'the Sunken Crown world is not loaded');
  assert.strictEqual(Z.scenes, undefined, 'the Sunken Crown scene painters are not loaded');
  assert.strictEqual(Z.sprites, undefined, 'the Sunken Crown sprite library is not loaded');
  assert.strictEqual(Z.engine, undefined, 'the original engine is not loaded');
  assert.ok(Z.ml.runtime, 'the Machine is loaded, and is all that is needed');

  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'cartridges', 'captains-thistle.js'), 'utf8');
  for (const forbidden of ['Z.scenes', 'Z.sprites', 'Z.world', 'Z.engine', 'sunken']) {
    assert.ok(!source.includes(forbidden), 'the cartridge does not reach for ' + forbidden);
  }

  assert.strictEqual(CART.presentation.renderer, 'cga', 'its own display adapter');
  assert.strictEqual(CART.presentation.audio, 'speaker', 'its own sound hardware');
  assert.strictEqual(Object.keys(CART.world.rooms).length, 4);
  assert.strictEqual(CART.profile.treasures.enabled, false, 'no treasure hunt here');
  assert.ok(typeof CART.presentation.art.scene('bay').paint === 'function', 'it brings its own painters');
  console.log('  ok — the cartridge shares the Machine and nothing else');
}

/* ---------------- the puzzle resists ---------------- */
function testPuzzleResists() {
  fresh();
  assert.ok(txt(cmd('take coin')).includes('one grating too wide'), 'the coin cannot be fished out by hand');
  assert.ok(!rt.flags().coinFreed);
  cmd('e');
  assert.ok(txt(cmd('n')).includes('No power, no door'), 'the bridge is shut without power');
  assert.strictEqual(rt.meta().room, 'corridor');
  cmd('e');
  assert.ok(txt(cmd('take fuse')).includes('The glass holds'), 'the machine wants paying');
  assert.ok(txt(cmd('kick vending machine')).includes('The glass holds'), 'kicking it does not work either');
  console.log('  ok — the vending machine cannot be cheated');
}

/* ---------------- the full route ---------------- */
function testPlaythrough() {
  fresh();
  cmd('e');
  cmd('open toolbox');
  assert.ok(txt(cmd('take magnet')).includes('Taken.'), 'the magnet comes out of the toolbox');
  cmd('w');
  const fished = cmd('use magnet on grating');
  assert.ok(txt(fished).includes('barnacle with a plan'), 'the magnet fishes the coin out');
  assert.ok(rt.inventory().includes('coin'), 'the coin is in hand');

  cmd('e'); cmd('e');
  const paid = cmd('put coin in vending machine');
  assert.ok(txt(paid).includes('institutional triumph'), 'the machine dispenses');
  assert.ok(rt.flags().vendorPaid);
  assert.ok(txt(cmd('take fuse')).includes('Taken.'), 'the fuse is collectable now');

  cmd('s');
  const fitted = cmd('put fuse in breaker');
  assert.ok(txt(fitted).includes('slides open'), 'power comes back');
  assert.ok(rt.flags().powerOn);

  const won = cmd('n');
  assert.strictEqual(rt.meta().room, 'bridge');
  assert.ok(txt(won).includes('WILL RETURN'), 'the ending fires on arrival');
  assert.strictEqual(rt.meta().win, true);
  assert.strictEqual(rt.meta().score, 25);
  assert.strictEqual(rt.meta().rank, 'Captain, Restored');
  console.log('  ok — Captain Thistle can be finished (25 points, Captain, Restored)');
}

/* ---------------- features it switched off stay off ---------------- */
function testProfileGating() {
  fresh();
  assert.strictEqual(rt.meta().fuel, null, 'no lamp, no oil');
  assert.strictEqual(rt.meta().treasures, 0, 'no treasure list');
  /* Every room is lit, so darkness can never fire. */
  for (const id in CART.world.rooms) assert.ok(!CART.world.rooms[id].dark);
  const scoreLine = txt(cmd('score'));
  assert.ok(scoreLine.includes('Score: 0'));
  assert.ok(!scoreLine.includes('Treasures'), 'the score line omits systems this game does not use');
  console.log('  ok — unused gameplay systems stay switched off');
}

const tests = [testIndependence, testPuzzleResists, testPlaythrough, testProfileGating];
let failed = 0;
console.log('\nCAPTAIN THISTLE AND THE VENDING MACHINE OF DOOM\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
