/* ============================================================
   MORROWLAMP — save codes
   A code a player writes down must bring back the very same game.
   For every step of the proven walkthrough, the game is saved as a
   code, read back into a fresh runtime, compared with the original,
   and played on to the win. A mistyped code, a code from another
   game and a code for a dead hero are refused with a reason.
   Run with:  node test/savecode.js
   ============================================================ */
'use strict';
const assert = require('node:assert');
const Z = require('../js/morrowlamp/core.js');
for (const m of ['world', 'profile', 'outcome', 'rules', 'vocabulary', 'stats', 'encounter', 'runtime', 'savecode']) {
  require('../js/morrowlamp/' + m + '.js');
}
require('../js/workshop/validator.js');
require('../js/workshop/prove.js');
require('../js/world.js');
require('../js/cartridges/sunken-crown.js');

const cart = Z.cartridges['the-sunken-crown'];
const ml = Z.ml;
const route = cart.walkthrough.route;
const fresh = () => ml.runtime.create(cart, { random: ml.prove.luckyDice() });
const play = (rt, cmds) => { for (const c of cmds) { rt.command(c); ml.prove.resolveEncounters(rt); } };

function testEveryStepRoundTrips() {
  let longest = 0;
  for (let k = 0; k <= route.length; k++) {
    const rt = fresh();
    play(rt, route.slice(0, k));
    const code = ml.savecode.encode(cart, rt.serialize());
    assert.match(code, /^[0-9A-HJKMNP-TV-Z]{1,4}(-[0-9A-HJKMNP-TV-Z]{1,4})*$/, 'step ' + k + ': the code is base32 in groups of four');
    longest = Math.max(longest, code.replace(/-/g, '').length);
    const back = ml.savecode.decode(cart, code);
    assert.strictEqual(ml.savecode.digest(cart, back), ml.savecode.digest(cart, rt.serialize()), 'step ' + k + ': the code keeps the whole game');
    const again = fresh();
    again.restore(back);
    play(again, route.slice(k));
    assert.ok(again.meta().win, 'step ' + k + ': a game restored from its code can still be won');
  }
  assert.ok(longest <= 60, 'the longest code is ' + longest + ' characters');
  console.log('  ok — all ' + (route.length + 1) + ' steps round-trip and win; longest code ' + longest + ' characters');
}

function testCodesAreForgiving() {
  const rt = fresh();
  play(rt, route.slice(0, 10));
  const code = ml.savecode.encode(cart, rt.serialize());
  const want = ml.savecode.digest(cart, rt.serialize());
  // Lower case, no dashes, spaces, and O/I/L for 0/1 all read the same.
  const sloppy = code.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
  assert.strictEqual(ml.savecode.digest(cart, ml.savecode.decode(cart, sloppy)), want, 'case, spacing and look-alike letters do not matter');
  console.log('  ok — lower case, spaces and O/I/L for 0/1 are all accepted');
}

function testBadCodesAreRefused() {
  const rt = fresh();
  play(rt, route.slice(0, 20));
  const code = ml.savecode.encode(cart, rt.serialize());
  const chars = code.replace(/-/g, '');
  let caught = 0;
  for (let i = 0; i < chars.length; i++) {
    const swap = chars.slice(0, i) + (chars[i] === '7' ? '8' : '7') + chars.slice(i + 1);
    try { ml.savecode.decode(cart, swap); } catch (e) { assert.ok(e instanceof ml.savecode.CodeError); caught++; }
  }
  assert.ok(caught >= chars.length - 1, 'a single wrong letter is caught (' + caught + ' of ' + chars.length + ')');
  assert.throws(() => ml.savecode.decode(cart, ''), (e) => e.reason === 'empty');
  assert.throws(() => ml.savecode.decode(cart, 'HELLO-WORLD'), ml.savecode.CodeError);
  assert.throws(() => ml.savecode.decode(cart, '!!!!'), (e) => e.reason === 'letter');
  const dead = JSON.parse(rt.serialize());
  dead.dead = true;
  assert.throws(() => ml.savecode.encode(cart, dead), (e) => e.reason === 'dead');
  console.log('  ok — wrong letters, empty and foreign codes are refused; a dead hero has no code');
}

const tests = [testEveryStepRoundTrips, testCodesAreForgiving, testBadCodesAreRefused];
let failed = 0;
console.log('MORROWLAMP — save codes\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.log('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
