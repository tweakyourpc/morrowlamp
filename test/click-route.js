/* ============================================================
   THE SUNKEN CROWN — winnable by pointing alone
   The cartridge's walkthrough proves the game can be won by typing.
   This suite proves it can be won the way the graphical shells play
   it: every step is a click, phrased by js/morrowlamp/interact.js
   exactly as the canvas and remastered shells phrase it, on a thing
   the player can actually see (or is holding), through an exit the
   runtime says is open. The only words typed are the riddle's
   answer, in the speech panel the shells open for it.
   Run with:  node test/click-route.js
   ============================================================ */
'use strict';
const assert = require('node:assert');
const Z = require('../js/morrowlamp/core.js');
for (const m of ['world', 'profile', 'outcome', 'rules', 'vocabulary', 'stats', 'encounter', 'runtime', 'interact']) {
  require('../js/morrowlamp/' + m + '.js');
}
require('../js/world.js');
require('../js/cartridges/sunken-crown.js');

const cart = Z.cartridges['the-sunken-crown'];
const ml = Z.ml;

/* [verb, thing] clicks a thing with a verb (walk, look, hand, talk);
   [dir] walks through an exit; ['use', held, thing] lifts an inventory
   item onto the cursor and clicks a thing with it; ['say', words]
   answers in the speech panel. */
const ROUTE = [
  ['n'], ['n'],
  ['hand', 'clock'], ['hand', 'brassKey'], ['look', 'musicSheet'], ['hand', 'musicSheet'],
  ['w'], ['hand', 'lyre'],
  ['e'], ['e'], ['hand', 'curtain'],
  ['w'], ['use', 'brassKey', 'hatch'], ['hand', 'hatch'], ['d'],
  ['hand', 'shovel'], ['hand', 'pitchPot'], ['use', 'shovel', 'crack'],
  ['s'], ['s'],
  ['talk', 'gates'], ['say', 'echo'],
  ['s'], ['w'], ['hand', 'mirror'], ['w'], ['hand', 'idol'],
  ['e'], ['e'], ['s'],
  ['use', 'lyre', 'sentinel'], ['hand', 'vaultKey'],
  ['use', 'vaultKey', 'vaultDoor'], ['hand', 'vaultDoor'], ['w'], ['hand', 'scepter'],
  ['e'], ['s'], ['hand', 'crown'],
  ['d'], ['hand', 'sarcophagus'], ['hand', 'ring'],
  ['u'], ['n'], ['n'], ['n'],
  ['w'], ['use', 'pitchPot', 'boat'], ['w'], ['hand', 'chalice'],
  ['e'], ['e'], ['n'], ['u'], ['u'],
  ['s'], ['s'], ['d'], ['hand', 'sunstone'],
  ['u'], ['n'], ['n'],
  ['use', 'crown', 'cabinet'], ['use', 'scepter', 'cabinet'], ['use', 'chalice', 'cabinet'],
  ['use', 'idol', 'cabinet'], ['use', 'ring', 'cabinet'], ['use', 'sunstone', 'cabinet']
];

function click(runtime, step, n) {
  const where = 'step ' + n + ' (' + step.join(' ') + ') in ' + runtime.meta().room;
  const presentation = cart.presentation || {};
  let action;
  if (step.length === 1) {
    const exit = runtime.exits().find((e) => e.dir === step[0]);
    assert.ok(exit && exit.ok, where + ': that way is open');
    action = ml.interact.commandFor(runtime, presentation, { kind: 'exit', dir: step[0] }, 'walk', null);
  } else if (step[0] === 'say') {
    action = { _text: (presentation.speech.verb || 'say') + ' ' + step[1] };
  } else {
    const [verb, a, b] = step;
    const held = verb === 'use' ? a : null;
    const thing = verb === 'use' ? b : a;
    if (held) assert.ok(runtime.inventory().includes(held), where + ': holding the ' + held);
    assert.ok(runtime.visibleObjects().some((o) => o.id === thing), where + ': the ' + thing + ' is in sight');
    action = ml.interact.commandFor(runtime, presentation, { kind: 'object', id: thing }, held ? 'walk' : verb, held);
    if (action && action._speech) return { meta: {}, messages: [], speech: true };
  }
  assert.ok(action, where + ': the click means something');
  return action._text !== undefined ? runtime.command(action._text) : runtime.perform(action);
}

function testWinnableByClicking() {
  const runtime = ml.runtime.create(cart);
  let last = null;
  // A click that only passes time (turns, oil, the hero's mood) has done nothing.
  const REAL = ['room', 'objects', 'flags', 'inventory', 'score', 'encounter', 'status'];
  let fights = 0;
  ROUTE.forEach((step, i) => {
    /* A creature may set on you along the way. The shells show a fight
       panel; press its Attack button until the fight is over. */
    for (let round = 0; runtime.encounter(); round++) {
      const attack = runtime.encounter().actions.find((a) => a.id === 'attack' && a.enabled);
      assert.ok(attack && round < 40, 'step ' + (i + 1) + ': the fight panel offers Attack, and the fight ends');
      const r = runtime.encounterAct('attack');
      assert.ok(!r.meta.dead, 'step ' + (i + 1) + ': the hero survives the fight');
      if (!runtime.encounter()) fights++;
    }
    last = click(runtime, step, i + 1);
    if (!last.speech) {
      assert.ok((last.changed || []).some((c) => REAL.includes(c)), 'step ' + (i + 1) + ' (' + step.join(' ') +
        ') changes the world, but the game said: ' + (last.messages || []).map((m) => m.text).join(' '));
    }
  });
  assert.ok(last.meta.win, 'the last click wins the game');
  assert.strictEqual(runtime.meta().score, cart.walkthrough.score, 'with the walkthrough\'s score');
  console.log('  ok — won in ' + ROUTE.length + ' clicks and ' + fights + ' fight(s), score ' + runtime.meta().score +
    ', typing only the riddle\'s answer');
}

/* The clues need not be typed for either: looking at anything with
   writing on it reads what a typist's "read" would. */
function testCluesReadableByClicking() {
  const runtime = ml.runtime.create(cart);
  const objects = cart.world.objects;
  const text = (r) => (r.messages || []).map((m) => m.text).join('\n');
  let read = 0;
  for (const [id, o] of Object.entries(objects)) {
    if (!o.read || o.examine) continue;
    const typed = text(ml.runtime.create(cart).perform({ verb: 'read', target: id }));
    const looked = text(runtime.perform(ml.interact.commandFor(runtime, cart.presentation || {}, { kind: 'object', id }, 'look', null)));
    assert.ok(typed && looked.includes(typed), 'looking at the ' + id + ' reads it, but the game said: ' + looked);
    read++;
  }
  assert.ok(read >= 3, 'the three study books are among them');
  console.log('  ok — looking at any of the ' + read + ' writings with no description of their own reads it');
}

/* Picking the music up before looking at it must not lose the
   lullaby: Look on the carried sheet in the inventory strip reads it. */
function testCarriedMusicReadableByClicking() {
  const runtime = ml.runtime.create(cart);
  for (const step of [['n'], ['n'], ['hand', 'clock'], ['hand', 'musicSheet']]) click(runtime, step, 0);
  assert.ok(runtime.inventory().includes('musicSheet'), 'the sheet is carried, unread');
  assert.strictEqual(ml.interact.commandForItem('musicSheet', 'hand', null), null, 'Hand on an item lifts it');
  const r = runtime.perform(ml.interact.commandForItem('musicSheet', 'look', null));
  assert.ok((r.messages || []).some((m) => /You now know the lullaby/.test(m.text)), 'Look on the carried sheet teaches the lullaby');
  console.log('  ok — music picked up unread can still be learned from the inventory');
}

/* The brass key clicked onto the grandfather clock winds it. The case is open
   (the key came out of it), so the click arrives as "put brass key in clock";
   it must wind the clock, not bury the key. Closed, it is "use ... on". */
function testTheKeyWindsTheClockByClicking() {
  for (const closeFirst of [false, true]) {
    const runtime = ml.runtime.create(cart);
    for (const step of [['n'], ['n'], ['hand', 'clock'], ['hand', 'brassKey']]) click(runtime, step, 0);
    if (closeFirst) runtime.command('close clock');
    const action = ml.interact.commandFor(runtime, cart.presentation || {}, { kind: 'object', id: 'clock' }, 'walk', 'brassKey');
    assert.strictEqual(action.verb, closeFirst ? 'use' : 'put', 'the click is phrased as the shell phrases it');
    runtime.perform(action);
    assert.strictEqual(runtime.flags().clockRunning, true, (closeFirst ? 'closed' : 'open') + ' case: the key winds the clock');
    assert.ok(runtime.inventory().includes('brassKey'), 'and the key stays in hand');
    const again = runtime.perform(ml.interact.commandFor(runtime, cart.presentation || {}, { kind: 'object', id: 'clock' }, 'walk', 'brassKey'));
    assert.ok((again.messages || []).some((m) => /going nicely/.test(m.text)), 'a second click leaves it be');
  }
  console.log('  ok — clicking the brass key on the clock winds it, case open or shut');
}

console.log('\nTHE SUNKEN CROWN — winnable by pointing alone\n');
let failed = 0;
for (const t of [testWinnableByClicking, testCluesReadableByClicking, testCarriedMusicReadableByClicking, testTheKeyWindsTheClockByClicking]) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll 4 groups passed.');
process.exitCode = failed ? 1 : 0;
