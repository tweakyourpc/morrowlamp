/* ============================================================
   THE SUNKEN CROWN — the stairs and the back of the house
   The story bible's first new rooms (docs/remastered/story-bible.md,
   sections 6 and 6b): every way up the broken stairs, the ladder
   through the roof, the back door, the servants' stair, the
   phonograph, and the second verse. Each choice that uses something
   up must leave the game winnable, so one group wins the whole game
   with the curtain tied to the stairs and the doormat in the boat.
   Run with:  node test/upstairs.js
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

function game(cls) {
  const runtime = ml.runtime.create(cart);
  if (cls) runtime.chooseClass(cls);
  return runtime;
}

/* Type each command, fighting through any encounter on the way, and
   return everything the game said. */
function play(runtime, commands) {
  const said = [];
  for (const c of commands) {
    for (let n = 0; runtime.encounter() && n < 40; n++) runtime.encounterAct('attack');
    const r = runtime.command(c);
    said.push(...(r.messages || []).map((m) => m.text));
  }
  return said.join('\n');
}

const room = (runtime) => runtime.meta().room;
const TO_HALL = ['n', 'n'];

function testTheCurtainIsTheSharedWayUp() {
  const g = game('scholar');     // the one class with no climb of its own
  const said = play(g, TO_HALL.concat(['climb stairs']));
  assert.strictEqual(room(g), 'hall', 'without a rope or a class route, the stairs do not take you up');
  assert.match(said, /looped over it/, 'the stairs say what they need');
  play(g, ['e', 'take curtain', 'w', 'tie curtain to stairs']);
  assert.strictEqual(room(g), 'grandmotherRoom', 'the curtain gets you up');
  assert.ok(!g.inventory().includes('curtain'), 'and stays tied to the stairs');
  play(g, ['d']);
  assert.strictEqual(room(g), 'hall', 'and is the way back down');
  console.log('  ok — the curtain, tied to the banister post, is the way up and stays there');
}

function testEachClassHasItsOwnWay() {
  const delver = game('delver');
  play(delver, TO_HALL.concat(['climb stairs']));
  assert.strictEqual(room(delver), 'grandmotherRoom', 'the Delver hauls up the stairs');
  const prowler = game('prowler');
  play(prowler, TO_HALL.concat(['jump']));
  assert.strictEqual(room(prowler), 'grandmotherRoom', 'the Prowler jumps the gap');
  const scholar = game('scholar');
  play(scholar, TO_HALL.concat(['climb stairs']));
  assert.strictEqual(room(scholar), 'hall', 'the Scholar cannot climb it');
  play(scholar, ['examine stairs', 'e', 'u']);
  assert.strictEqual(room(scholar), 'grandmotherRoom', 'but reads of the servants\' stair, which starts in the kitchen');
  console.log('  ok — Delver climbs, Prowler jumps, Scholar finds the servants\' stair');
}

function testTheClassConditionIsChecked() {
  assert.ok(ml.rules.CONDITIONS.includes('class'), 'class is a known condition');
  const g = game('delver');
  const ctx = { world: { carrying: () => false, present: () => false, isOpen: () => false, isLit: () => false }, state: g.state() };
  assert.ok(ml.rules.conditionsHold({ class: 'delver' }, {}, ctx), 'a Delver is a Delver');
  assert.ok(!ml.rules.conditionsHold({ class: ['scholar', 'prowler'] }, {}, ctx), 'and nothing else');
  assert.ok(!ml.rules.conditionsHold({ class: 'delver' }, {}, { world: ctx.world, state: { room: 'hall', flags: {}, secured: [], visited: {} } }),
    'with no character sheet, no class clause holds');
  console.log('  ok — the class condition holds for the chosen class only');
}

function testTheLadderAndTheRoof() {
  const g = game();
  play(g, ['w']);
  assert.strictEqual(room(g), 'kitchenGarden', 'a path runs round the side of the house');
  play(g, ['u']);
  assert.strictEqual(room(g), 'kitchenGarden', 'the roof is out of reach without a ladder');
  play(g, ['n', 'take ladder', 's', 'use ladder on roof', 'u']);
  assert.strictEqual(room(g), 'grandmotherRoom', 'the ladder, propped against the house, reaches her room');
  play(g, ['u']);
  assert.strictEqual(room(g), 'kitchenGarden', 'and is the way back out');
  play(g, ['take ladder', 'u']);
  assert.strictEqual(room(g), 'kitchenGarden', 'taking the ladder down closes the roof again');
  assert.ok(g.inventory().includes('ladder'), 'and the ladder is carried');
  console.log('  ok — the ladder goes up against the house and comes down again');
}

function testTheBackDoorAndTheServantsStair() {
  const g = game();
  play(g, ['w', 's']);
  assert.strictEqual(room(g), 'kitchenGarden', 'the back door is bolted from the inside');
  play(g, ['w'].concat(TO_HALL, ['e', 'open back door', 'n']));   // back round the west side to the yard
  assert.strictEqual(room(g), 'kitchenGarden', 'opened from the kitchen, it leads into the garden');
  play(g, ['s']);
  assert.strictEqual(room(g), 'kitchen', 'and back');
  const d = game('delver');
  play(d, TO_HALL.concat(['climb stairs', 'e']));
  assert.strictEqual(room(d), 'grandmotherRoom', 'the servants\' door starts stuck');
  play(d, ['push servants door', 'e']);
  assert.strictEqual(room(d), 'kitchen', 'and once pushed open, leads down to the kitchen');
  console.log('  ok — the back door opens from the kitchen side; the servants\' door from upstairs');
}

function testTheCylinderPlaysInTheGlasshouse() {
  const g = game('delver');
  play(g, TO_HALL.concat(['climb stairs', 'take cylinder']));
  assert.match(play(g, ['play cylinder']), /something to play it on/, 'nothing to play it on upstairs');
  const said = play(g, ['push servants door', 'e', 'open back door', 'n', 'n', 'play cylinder']);
  assert.strictEqual(room(g), 'glasshouse');
  assert.match(said, /I put it back/, 'the grandmother\'s recording plays on the phonograph');
  console.log('  ok — the wax cylinder plays her recording on the glasshouse phonograph');
}

function testTheSecondVerseReleasesTheSentinel() {
  const g = game('delver');
  const route = cart.walkthrough.route;
  const upTo = (cmd) => route.slice(0, route.indexOf(cmd));
  /* Up the stairs for the verse, after the music and the lyre. */
  play(g, upTo('e').concat(['e', 'climb stairs', 'read verse', 'd']));
  assert.ok(g.flags().secondVerse, 'the verse is learned');
  play(g, route.slice(route.indexOf('e') + 1, route.indexOf('play lyre')));
  assert.strictEqual(room(g), 'guardroom');
  const said = play(g, ['play lyre']);
  assert.match(said, /the rest of it/, 'both verses release the sentinel');
  assert.ok(g.inventory().includes('vaultKey'), 'and he hands over the vault key himself');
  const rest = route.slice(route.indexOf('play lyre') + 1).filter((c) => c !== 'take vault key');
  play(g, rest);
  assert.ok(g.meta().win, 'and the game is still won');
  console.log('  ok — the second verse releases the sentinel, who hands over the key; still winnable');
}

function testTheVerseAloneIsNotTheTune() {
  const g = game('delver');
  const route = cart.walkthrough.route.filter((c) => c !== 'read music sheet');
  const toLyre = route.slice(0, route.indexOf('e') + 1).concat(['climb stairs', 'read verse', 'd']);
  play(g, toLyre.concat(route.slice(route.indexOf('e') + 1, route.indexOf('play lyre'))));
  assert.strictEqual(room(g), 'guardroom');
  const said = play(g, ['play lyre']);
  assert.match(said, /not the tune/, 'with only the words, the game says the tune is missing');
  assert.ok(!g.flags().guardDancing, 'and the sentinel stays put');
  console.log('  ok — the second verse alone says the tune is missing, and points at the music');
}

function testWinWithTheCurtainOnTheStairs() {
  const g = game('scholar');
  const route = cart.walkthrough.route.slice();
  /* Take the doormat first, and tie the curtain to the stairs as soon as it is carried. */
  route.splice(route.indexOf('n') + 1, 0, 'take doormat');
  route.splice(route.indexOf('take curtain') + 2, 0, 'tie curtain to stairs', 'd');
  play(g, route);
  assert.ok(g.flags().curtainOnStairs, 'the curtain went on the stairs');
  assert.ok(g.flags().boatPatched, 'the doormat patched the boat');
  assert.ok(g.meta().win, 'the game is won');
  assert.strictEqual(g.meta().score, cart.walkthrough.score, 'with the full score');
  console.log('  ok — won with the curtain on the stairs and the doormat in the boat');
}

console.log('\nTHE SUNKEN CROWN — the stairs and the back of the house\n');
let failed = 0;
const groups = [testTheCurtainIsTheSharedWayUp, testEachClassHasItsOwnWay, testTheClassConditionIsChecked,
  testTheLadderAndTheRoof, testTheBackDoorAndTheServantsStair, testTheCylinderPlaysInTheGlasshouse,
  testTheSecondVerseReleasesTheSentinel, testTheVerseAloneIsNotTheTune, testWinWithTheCurtainOnTheStairs];
for (const t of groups) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + groups.length + ' groups passed.');
process.exitCode = failed ? 1 : 0;
