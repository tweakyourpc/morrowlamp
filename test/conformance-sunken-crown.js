/* ============================================================
   MORROWLAMP CONFORMANCE — THE SUNKEN CROWN
   The invariant that matters most in this repository:

     ORIGINAL ENGINE (js/engine.js + js/world.js)
   and
     MORROWLAMP MACHINE + SUNKEN CROWN CARTRIDGE

   must agree about the important outcome of the same game.

   The canonical winning route below is the one in
   test/playthrough.js (testWinRoute), typed into the generic
   runtime instead of the bespoke one. It must reach the real
   ending: six treasures secured, sixty points, Sunken King's Heir.

   Run with:  node test/conformance-sunken-crown.js
   ============================================================ */
'use strict';
const assert = require('node:assert');

/* The Machine. */
const Z = require('../js/morrowlamp/core.js');
require('../js/morrowlamp/world.js');
require('../js/morrowlamp/profile.js');
require('../js/morrowlamp/outcome.js');
require('../js/morrowlamp/rules.js');
require('../js/morrowlamp/vocabulary.js');
require('../js/morrowlamp/stats.js');
require('../js/morrowlamp/encounter.js');
require('../js/morrowlamp/runtime.js');

/* The cartridge, and the world prose it shares with the original build. */
require('../js/world.js');
require('../js/cartridges/sunken-crown.js');

/* The original engine, for the cross-check. */
require('../js/engine.js');
require('../js/parser.js');

const CART = Z.cartridges['the-sunken-crown'];
const { play, resolveEncounters, luckyDice, unluckyDice } = require('./play-route.js');

let rt = null;
/* The Sunken Crown now has encounters, so a reproducible run needs
   reproducible dice. Combat mechanics are tested in test/encounters.js. */
function fresh(random) { rt = Z.ml.runtime.create(CART, { random: random || luckyDice() }); return rt; }
function cmd(s) { return rt.command(s); }
function txt(r) { return r.messages.map((m) => m.text).join(' | '); }
const meta = () => rt.meta();
const flags = () => rt.flags();
const has = (id) => rt.inventory().includes(id);

/* The canonical route, shared with the compiler test so every engine
   that claims to run this game is driven down the same path. */
const WINNING_ROUTE = require('./winning-route.js');

/* ---------------- the cartridge describes the same world ---------------- */
function testWorldParity() {
  const legacy = Z.world;
  const cart = CART.world;
  assert.strictEqual(Object.keys(cart.rooms).length, 18, 'all 18 scenes are present');
  assert.strictEqual(Object.keys(cart.rooms).length, Object.keys(legacy.rooms).length);
  assert.strictEqual(Object.keys(cart.objects).length, Object.keys(legacy.objects).length);
  assert.strictEqual(cart.startRoom, legacy.startRoom);
  assert.deepStrictEqual(cart.startInventory, legacy.startInventory);
  assert.deepStrictEqual(CART.profile.treasures.list, legacy.treasures);

  /* Every gated exit must still be gated. The `guardReq` spelling is
     translated to `flagReq` by the cartridge; nothing may be dropped. */
  for (const rid in legacy.rooms) {
    for (const dir in (legacy.rooms[rid].exits || {})) {
      const before = legacy.rooms[rid].exits[dir];
      const after = cart.rooms[rid].exits[dir];
      assert.ok(after !== undefined, rid + '.' + dir + ' survived the adapter');
      if (typeof before === 'string') { assert.strictEqual(after, before); continue; }
      const gatedBefore = !!(before.flagReq || before.guardReq || before.objReq);
      const gatedAfter = !!(after.flagReq || after.objReq);
      assert.strictEqual(gatedAfter, gatedBefore, rid + '.' + dir + ' keeps its gate');
      if (before.guardReq) assert.strictEqual(after.flagReq, before.guardReq, 'guardReq became flagReq');
    }
  }

  /* Placement parity: at the start of the game, both engines must agree
     about which objects are visible in which room. */
  Z.engine.newGame();
  const machine = Z.ml.runtime.create(CART, { random: luckyDice() });
  for (const rid in legacy.rooms) {
    Z.engine.newGame();
    Z.engine.state.room = rid;
    const legacyHere = Z.engine.visibleItems().slice().sort();
    machine.newGame();
    machine.state().room = rid;
    const machineHere = machine.visibleObjects().map((o) => o.id).sort();
    assert.deepStrictEqual(machineHere, legacyHere, 'object placement matches in ' + rid);
  }
  console.log('  ok — cartridge world matches the original world data');
}

/* ---------------- the route ---------------- */
function testWinRoute() {
  fresh();
  const trace = [];
  play(rt, WINNING_ROUTE, trace);

  const report = (msg) => msg + '\n    last steps:\n      ' + trace.slice(-6).join('\n      ');

  assert.ok(flags().melodyKnown, report('the lullaby was learned'));
  assert.ok(flags().tunnelDug, report('the tunnel was dug'));
  assert.ok(flags().gatesOpen, report('the echo opened the gates'));
  assert.ok(flags().mirrorOpened, report('the mirror opened'));
  assert.ok(flags().guardDancing, report('the sentinel danced'));
  assert.ok(flags().boatPatched, report('the boat was patched'));

  assert.strictEqual(meta().secured, 6, report('six treasures secured'));
  assert.strictEqual(meta().score, 60, report('full score'));
  assert.strictEqual(meta().win, true, report('the game was won'));
  assert.strictEqual(meta().ending, 'regalia-complete', report('the real ending fired'));
  assert.strictEqual(meta().room, 'hall', report('finished in the entrance hall'));
  assert.strictEqual(meta().rank, 'Sunken King\'s Heir', report('final rank'));
  for (const t of CART.profile.treasures.list) assert.ok(!has(t), 'treasure ' + t + ' is in the case, not the pocket');
  console.log('  ok — canonical route reaches the real ending (60 points, Sunken King\'s Heir)');
}

/* ---------------- the two engines agree ---------------- */
function testEngineAgreement() {
  Z.engine.newGame();
  for (const step of WINNING_ROUTE) Z.engine.handleAction(Z.parser.parse(step));
  const legacy = Z.engine.meta();

  fresh();
  play(rt, WINNING_ROUTE);
  const machine = meta();

  assert.strictEqual(machine.score, legacy.score, 'scores agree');
  assert.strictEqual(machine.secured, legacy.treasuresPlaced, 'secured treasure counts agree');
  assert.strictEqual(machine.win, legacy.win, 'both reach the win state');
  assert.strictEqual(machine.room, legacy.room, 'both finish in the same room');

  /* The original engine only ever reports its rank inside the score line. */
  const legacyScoreLine = Z.engine.handleAction(Z.parser.parse('score')).messages.map((m) => m.text).join(' ');
  assert.ok(legacyScoreLine.includes(machine.rank), 'both award the same rank: ' + machine.rank);

  const legacyFlags = Z.engine.flags;
  for (const flag of ['melodyKnown', 'tunnelDug', 'gatesOpen', 'mirrorOpened', 'guardDancing', 'boatPatched']) {
    assert.strictEqual(!!rt.flags()[flag], !!legacyFlags[flag], 'flag ' + flag + ' agrees');
  }
  console.log('  ok — original engine and Morrowlamp Machine agree on the outcome');
}

/* ---------------- the puzzles are real puzzles ---------------- */
function testPuzzlesResist() {
  fresh();
  cmd('n'); cmd('n'); cmd('open clock'); cmd('take brass key');
  cmd('open hatch');
  assert.ok(txt(cmd('d')).includes('trapdoor is shut'), 'the cellar stays shut until the hatch is unlocked');

  fresh();
  cmd('n'); cmd('n'); cmd('open clock'); cmd('take brass key');
  cmd('unlock hatch with brass key'); cmd('open hatch'); cmd('d');
  assert.ok(txt(cmd('dig')).includes('need a shovel'), 'digging needs the shovel');
  assert.ok(txt(cmd('s')).includes('wall of packed earth'), 'the tunnel is not there yet');

  fresh();
  cmd('n'); cmd('n'); cmd('open clock'); cmd('take brass key');
  cmd('unlock hatch with brass key'); cmd('open hatch'); cmd('d');
  cmd('take shovel'); cmd('dig'); cmd('s'); cmd('s');
  assert.ok(txt(cmd('s')).includes('remain shut'), 'the gates need the word');
  assert.ok(!txt(cmd('say knock knock')).includes('groan apart'), 'the wrong word does not open them');
  cmd('say echo');
  cmd('s'); cmd('s');
  assert.ok(txt(cmd('s')).includes('HALT'), 'the sentinel blocks the throne room');
  assert.ok(txt(cmd('take vault key')).includes('HALT'), 'the sentinel keeps its key');
  assert.ok(!has('vaultKey'));
  assert.ok(!flags().guardDancing, 'the sentinel is still on duty');
  assert.ok(txt(cmd('play lyre')).includes('A lyre, on the other hand'), 'no lyre, no music');
  assert.ok(!flags().guardDancing, 'humming without the lyre does not move it');
  console.log('  ok — the puzzles refuse to be skipped');
}

/* ---------------- deaths ---------------- */
function testDeaths() {
  /* The dark no longer kills outright: it produces an outcome, and in
     THIS cartridge the outcome is a fight. Lose the fight and it kills
     you, which is the behaviour the graphical build always had and the
     text build never did. */
  fresh(unluckyDice());
  cmd('n'); cmd('n'); cmd('open clock'); cmd('take brass key');
  cmd('unlock hatch with brass key'); cmd('open hatch');
  /* Leave the lantern behind entirely: with it in hand you could raise
     it, and raising it is how you survive this. */
  cmd('drop lantern');
  cmd('d');
  assert.strictEqual(meta().room, 'cellar');
  assert.ok(txt(cmd('look')).includes('pitch black'), 'the dark warns once');
  assert.strictEqual(meta().dead, false);
  const summoned = cmd('look');
  assert.ok(txt(summoned).includes('opens two red eyes'), 'the second dark turn summons the Umbra');
  assert.ok(meta().encounter, 'and an encounter is now running');
  assert.strictEqual(meta().encounter.name, 'The Umbra');
  assert.strictEqual(meta().dead, false, 'the dark itself did not kill you');

  /* With no light to raise and the dice against you, it wins. */
  assert.strictEqual(rt.encounter().actions.find((a) => a.id === 'light').enabled, false,
    'no lantern, no light to raise');
  resolveEncounters(rt, null);
  assert.strictEqual(meta().dead, true, 'losing to the Umbra is fatal');

  fresh();
  cmd('n'); cmd('n'); cmd('open clock'); cmd('take brass key');
  cmd('unlock hatch with brass key'); cmd('open hatch'); cmd('d');
  cmd('take oil');
  assert.ok(txt(cmd('drink oil')).includes('quite fatal'), 'grandmother was right');
  assert.strictEqual(meta().dead, true);
  console.log('  ok — the dark summons the Umbra, and lamp oil still kills');
}

/* ---------------- the dark produces an outcome, not a fight ----------------
   Darkness must not know what an encounter is. Prove it by switching
   encounters off: the same darkness code has to fall back to a death. */
function testDarknessIsNotCombat() {
  const noCombat = Z.ml.clone(CART);
  noCombat.profile = Object.assign({}, CART.profile, { combat: false, stats: false });
  noCombat.presentation = Object.assign({}, CART.presentation, { art: undefined });
  const plain = Z.ml.runtime.create(noCombat, { random: luckyDice() });
  plain.command('turn off lantern');
  for (const step of ['n', 'n', 'open clock', 'take brass key', 'unlock hatch with brass key', 'open hatch', 'd']) plain.command(step);
  plain.command('look');
  const fell = plain.command('look').messages.map((m) => m.text).join(' | ');
  assert.strictEqual(plain.meta().dead, true, 'with no encounter system the dark simply kills');
  assert.ok(fell.includes('second, colder skin'), 'and uses the declared fallback text');
  assert.strictEqual(plain.meta().encounter, null, 'no encounter was started');
  console.log('  ok — darkness produces an outcome; with combat off it falls back to death');
}

/* ---------------- the lurker ambush ----------------
   This used to live in js/publisher.js, which meant only the
   point-and-click build ever met it. It is cartridge data now. */
function testLurkerAmbush() {
  fresh();
  const trace = [];
  play(rt, WINNING_ROUTE.slice(0, WINNING_ROUTE.indexOf('fix boat')), trace);
  assert.ok(rt.flags().lurkerMet, 'reaching the lake shore wakes the lurker');
  assert.ok(trace.some((line) => line.includes('Something pale unfolds itself')), 'and it introduces itself');
  assert.ok(trace.some((line) => line.includes('sighs through a hole in its side')), 'and it can be beaten');
  assert.ok(rt.sheet().xp >= 35, 'beating it awards its experience');
  console.log('  ok — the lurker ambush is cartridge data and reaches every front end');
}

/* ---------------- lamp oil is now a game rule ---------------- */
function testLampFuel() {
  fresh();
  assert.strictEqual(meta().fuel, 120, 'the lantern starts full');
  cmd('n'); cmd('n'); cmd('look'); cmd('look');
  assert.strictEqual(meta().fuel, 120, 'lit rooms cost no oil');
  cmd('open clock'); cmd('take brass key');
  cmd('unlock hatch with brass key'); cmd('open hatch'); cmd('d');
  const afterEntry = meta().fuel;
  assert.ok(afterEntry < 120, 'the dark cellar burns oil');
  cmd('look');
  assert.strictEqual(meta().fuel, afterEntry - 1, 'one turn, one measure of oil');
  cmd('take oil');
  cmd('use oil on lantern');
  /* Refilled to full, less the measure this dark turn itself just burned. */
  assert.strictEqual(meta().fuel, 119, 'the jar refills the lantern');
  console.log('  ok — lamp oil is a gameplay rule, not a detail of the interface');
}

/* ---------------- the RPG layer ----------------
   The character sheet the original build had and the compiled game
   did not. Everything here comes out of the cartridge: five stats,
   three classes, the health formula, the growth curve. */
function testRpgLayer() {
  fresh();
  assert.ok(rt.hasStats() && rt.hasCombat(), 'The Sunken Crown switches both capabilities on');

  const classes = rt.classes().map((c) => c.id).sort();
  assert.deepStrictEqual(classes, ['delver', 'prowler', 'scholar'], 'three classes, from the cartridge');

  const scholar = rt.chooseClass('scholar');
  assert.strictEqual(scholar.stats.lore, 45, 'the Scholar reads the footnotes');
  const sheet = rt.sheet();
  assert.strictEqual(sheet.className, 'Scholar');
  assert.strictEqual(sheet.stats.length, 5, 'five stats');
  assert.deepStrictEqual(sheet.stats.map((s) => s.id), ['str', 'agi', 'vit', 'lore', 'luck']);
  /* health = base 24 + vit 22 * 0.7, rounded */
  assert.strictEqual(sheet.maxHp, 39, 'health comes from the cartridge formula');

  rt.chooseClass('delver');
  assert.strictEqual(rt.sheet().maxHp, 49, 'a different class, a different constitution');

  /* Stats rise by being used, and the Umbra is where Strength gets used. */
  const before = rt.sheet().stats.find((s) => s.id === 'str').value;
  rt.startEncounter('umbra');
  assert.ok(rt.encounter(), 'an encounter can be started directly');
  assert.deepStrictEqual(rt.encounter().actions.map((a) => a.id), ['attack', 'defend', 'light', 'flee']);
  for (let i = 0; i < 12 && rt.encounter(); i++) rt.encounterAct('attack');
  assert.ok(rt.sheet().stats.find((s) => s.id === 'str').value > before, 'Strength rose by being used');
  assert.ok(!rt.encounter(), 'and the Umbra came apart');
  assert.ok(rt.sheet().xp >= 60, 'which was worth experience');
  console.log('  ok — the RPG layer is cartridge data on a generic Machine');
}

/* ---------------- studying things teaches you something ----------------
   The original build awarded one-time Lore for examining anything new,
   and more of it to a Scholar. That was inside js/rpg.js; it is a
   cartridge award now, and the Machine has no idea what Lore is. */
function testExamineAward() {
  const gains = {};
  for (const cls of ['scholar', 'delver']) {
    fresh();
    rt.chooseClass(cls);
    const before = rt.sheet().stats.find((s) => s.id === 'lore').value;
    for (const thing of ['lantern', 'note', 'mailbox', 'well', 'doormat']) cmd('examine ' + thing);
    gains[cls] = rt.sheet().stats.find((s) => s.id === 'lore').value - before;
    /* Looking at the same thing twice teaches nothing the second time. */
    const held = rt.sheet().stats.find((s) => s.id === 'lore').value;
    for (let i = 0; i < 6; i++) cmd('examine lantern');
    assert.strictEqual(rt.sheet().stats.find((s) => s.id === 'lore').value, held, 'the award is once per thing');
  }
  assert.ok(gains.scholar > 0, 'a Scholar learns from looking closely');
  assert.ok(gains.scholar >= gains.delver, 'and learns at least as fast as a Delver');
  console.log('  ok — examining something new teaches you a little, once');
}

/* ---------------- the lantern is the answer to the dark ---------------- */
function testRaisingTheLight() {
  fresh();
  /* Carrying an unlit lantern: raising it both lights it and hurts the
     thing that came out of the dark, which is the puzzle inside the fight. */
  cmd('turn off lantern');
  rt.startEncounter('umbra');
  const light = rt.encounter().actions.find((a) => a.id === 'light');
  assert.ok(light.enabled, 'the light action is available while carrying the lantern');
  const result = rt.encounterAct('light');
  const said = result.messages.map((m) => m.text).join(' | ');
  assert.ok(said.includes('recoils, shrieking'), 'it hurts');
  assert.ok(rt.describeObject('lantern').lit, 'and the lantern is lit again afterwards');

  /* Drop the lantern and the option explains itself instead of vanishing. */
  const empty = Z.ml.runtime.create(CART, { random: luckyDice() });
  empty.command('drop lantern');
  empty.startEncounter('umbra');
  const denied = empty.encounter().actions.find((a) => a.id === 'light');
  assert.strictEqual(denied.enabled, false);
  assert.ok(denied.deny.includes('nothing bright enough'));
  console.log('  ok — raising the light lights the lantern and wounds the Umbra');
}

/* ---------------- save, load, undo ---------------- */
function testSaveLoadUndo() {
  fresh();
  cmd('n'); cmd('n'); cmd('open clock'); cmd('take brass key');
  const saved = rt.serialize();
  cmd('w'); cmd('take lyre');
  assert.ok(has('lyre'));

  const other = Z.ml.runtime.create(CART, { random: luckyDice() });
  other.restore(saved);
  assert.strictEqual(other.meta().room, 'hall');
  assert.ok(other.inventory().includes('brassKey'));
  assert.ok(!other.inventory().includes('lyre'));

  cmd('undo');
  assert.ok(!has('lyre'), 'undo puts the lyre back on the wall');
  console.log('  ok — save, load, and undo');
}

/* ---------------- the trophy case reports itself ---------------- */
function testTrophyCase() {
  fresh();
  cmd('n'); cmd('n');
  const before = txt(cmd('examine cabinet'));
  assert.ok(before.includes('CROWN — awaiting'), 'the case lists what is missing');
  assert.ok(before.includes('6 places still waiting'));
  console.log('  ok — the trophy case reports the hunt');
}

const tests = [testWorldParity, testWinRoute, testEngineAgreement, testPuzzlesResist,
  testDeaths, testDarknessIsNotCombat, testLurkerAmbush, testRpgLayer, testRaisingTheLight, testExamineAward,
  testLampFuel, testSaveLoadUndo, testTrophyCase];
let failed = 0;
console.log('\nMORROWLAMP CONFORMANCE — THE SUNKEN CROWN\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' conformance groups passed.');
process.exit(failed ? 1 : 0);
