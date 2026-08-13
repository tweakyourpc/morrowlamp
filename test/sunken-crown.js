/* ============================================================
   THE SUNKEN CROWN — full regression suite
   The flagship cartridge on the Morrowlamp Machine, which is now
   the only gameplay implementation: index.html, text.html and
   every compiled artifact run this same runtime over this same
   cartridge.

   Until consolidation there were two engines and this file's job
   was to prove they agreed. That comparison is gone because the
   second engine is gone; every assertion it was making about
   behaviour has been kept and now runs against the one runtime,
   together with the assertions that used to live in
   test/playthrough.js.

   The canonical winning route must reach the real ending: six
   treasures secured, sixty points, Sunken King's Heir.

   Run with:  node test/sunken-crown.js
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

/* ---------------- the cartridge describes the authored world ----------------
   js/world.js is cartridge content — the prose and geography the game was
   written in. The cartridge adapts it; nothing may be lost in the adapting. */
function testWorldParity() {
  const source = Z.world;
  const cart = CART.world;
  assert.strictEqual(Object.keys(cart.rooms).length, 18, 'all 18 scenes are present');
  assert.strictEqual(Object.keys(cart.rooms).length, Object.keys(source.rooms).length);
  assert.strictEqual(Object.keys(cart.objects).length, Object.keys(source.objects).length);
  assert.strictEqual(cart.startRoom, source.startRoom);
  assert.deepStrictEqual(cart.startInventory, source.startInventory);
  assert.deepStrictEqual(CART.profile.treasures.list, source.treasures);

  /* Every gated exit must still be gated. The `guardReq` spelling is
     translated to `flagReq` by the cartridge; nothing may be dropped. */
  for (const rid in source.rooms) {
    for (const dir in (source.rooms[rid].exits || {})) {
      const before = source.rooms[rid].exits[dir];
      const after = cart.rooms[rid].exits[dir];
      assert.ok(after !== undefined, rid + '.' + dir + ' survived the adapter');
      if (typeof before === 'string') { assert.strictEqual(after, before); continue; }
      const gatedBefore = !!(before.flagReq || before.guardReq || before.objReq);
      const gatedAfter = !!(after.flagReq || after.objReq);
      assert.strictEqual(gatedAfter, gatedBefore, rid + '.' + dir + ' keeps its gate');
      if (before.guardReq) assert.strictEqual(after.flagReq, before.guardReq, 'guardReq became flagReq');
    }
  }

  /* Every object is placed: in a room, in the player's hands, inside a
     container, or produced by a rule. Nothing is stranded. */
  const inContainer = new Set();
  for (const id in cart.objects) for (const c of (cart.objects[id].contents || [])) inContainer.add(c);
  const producedByRule = new Set();
  for (const rule of CART.rules) {
    for (const step of (rule.do || []).concat(rule.otherwise || [])) {
      for (const key of ['give', 'take', 'drop']) {
        if (step[key]) for (const t of [].concat(step[key])) producedByRule.add(t);
      }
    }
  }
  for (const id in cart.objects) {
    const placed = cart.objects[id].at !== undefined || inContainer.has(id) || producedByRule.has(id);
    assert.ok(placed, 'object ' + id + ' is placed somewhere');
  }
  console.log('  ok — the cartridge preserves the authored world and places every object');
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
  /* 260 is the figure the point-and-click build was tuned with; on
     consolidation both shells adopted it. */
  assert.strictEqual(meta().fuel, 260, 'the lantern starts full');
  cmd('n'); cmd('n'); cmd('look'); cmd('look');
  assert.strictEqual(meta().fuel, 260, 'lit rooms cost no oil');
  cmd('open clock'); cmd('take brass key');
  cmd('unlock hatch with brass key'); cmd('open hatch'); cmd('d');
  const afterEntry = meta().fuel;
  assert.ok(afterEntry < 260, 'the dark cellar burns oil');
  cmd('look');
  assert.strictEqual(meta().fuel, afterEntry - 1, 'one turn, one measure of oil');
  cmd('take oil');
  cmd('use oil on lantern');
  /* Refilled to full, less the measure this dark turn itself just burned. */
  assert.strictEqual(meta().fuel, 259, 'the jar refills the lantern');
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


/* ============================================================
   Assertions inherited from test/playthrough.js, which tested the
   retired engine. The behaviours are unchanged; only the runtime
   underneath them is.
   ============================================================ */

/* ---------------- the parser understands this game ---------------- */
function testParser() {
  fresh();
  const parse = (text) => rt.parse(text);
  const cases = [
    ['take the brass key', { verb: 'take', target: 'brassKey' }],
    ['x knife', { verb: 'examine', target: 'knife' }],
    ['go north', { verb: 'move', text: 'n' }],
    ['i', { verb: 'inventory' }],
    ['look at the note', { verb: 'examine', target: 'note' }],
    ['turn off lantern', { verb: 'turn', target: 'lantern', with: 'off' }],
    ['use lens on note', { verb: 'use', target: 'lens', with: 'note' }],
    ['open cellar', { verb: 'open', target: 'hatch' }],
    ['take brass key from clock', { verb: 'take', target: 'brassKey', with: 'clock' }],
    ['unlock hatch with brass key', { verb: 'unlock', target: 'hatch', with: 'brassKey' }],
    ['score', { verb: 'score' }]
  ];
  for (const [input, want] of cases) assert.deepStrictEqual(parse(input), want, 'parse: ' + input);

  assert.deepStrictEqual(parse('say echo'), { verb: 'say', text: 'echo' }, 'parse: say echo');
  assert.strictEqual(parse('climb ladder').verb, 'climb', 'parse: climb ladder');

  /* Genuine ambiguity must stay an error, not crash or silently pick one. */
  const keyErr = parse('take key');
  assert.ok(keyErr.error && keyErr.error.includes('brass key') && keyErr.error.includes('vault key'), 'take key is ambiguous');
  const statueErr = parse('take statue');
  assert.ok(statueErr.error && statueErr.error.includes('gates') && statueErr.error.includes('idol'), 'take statue is ambiguous');

  /* A name that repeats one of its own aliases must not self-ambiguate. */
  assert.deepStrictEqual(parse('take brass key'), { verb: 'take', target: 'brassKey' });
  console.log('  ok — parser units (' + (cases.length + 2) + ' cases + ambiguity checks)');
}

/* ---------------- the opening state ---------------- */
function testStart() {
  fresh();
  assert.ok(rt.describeObject('lantern').carried, 'the lantern starts in hand');
  assert.ok(rt.describeObject('lantern').takeable);
  assert.strictEqual(meta().room, 'yard');
  const first = cmd('look');
  assert.ok(Array.isArray(first.changed), 'actions expose structured change categories');
  assert.ok(first.refresh.includes('hud'), 'turn actions request a HUD refresh');
  assert.strictEqual(meta().score, 0);
  assert.deepStrictEqual(rt.inventory(), ['lantern', 'note']);
  const empty = rt.perform(null);
  assert.deepStrictEqual(empty.messages, [], 'a null action produces no messages');
  console.log('  ok — opening state');
}

/* ---------------- containers ---------------- */
function testClock() {
  fresh();
  cmd('n'); cmd('n');
  assert.strictEqual(meta().room, 'hall');
  assert.ok(txt(cmd('open clock')).includes('brass key'), 'opening the clock reveals the key');
  assert.ok(txt(cmd('take brass key')).includes('Taken.'), 'take the brass key');
  assert.ok(has('brassKey'));
  cmd('take music sheet');
  assert.ok(has('musicSheet'));
  cmd('read music sheet');
  assert.ok(flags().melodyKnown, 'the melody is known after reading the sheet');
  console.log('  ok — open a container and take from it');
}

function testContainerRecovery() {
  fresh();
  cmd('n'); cmd('n'); cmd('open clock');
  cmd('take brass key'); cmd('take music sheet');
  cmd('open clock');
  assert.ok(has('brassKey') && has('musicSheet'), 'the clock\'s contents can be taken');

  fresh();
  cmd('n'); cmd('n'); cmd('open clock'); cmd('take brass key');
  cmd('put brass key in clock');
  cmd('close clock');
  cmd('open clock');
  assert.ok(txt(cmd('take brass key')).includes('Taken.'), 'a placed item survives a close/open cycle');
  assert.ok(has('brassKey'), 'and returns to inventory');
  console.log('  ok — container contents remain recoverable');
}

function testUnlockNeedsKey() {
  fresh();
  cmd('n'); cmd('n');
  const denied = cmd('unlock hatch with brass key');
  assert.ok(txt(denied).includes('don\'t have'), 'the key must be in hand: ' + txt(denied));
  assert.ok(txt(cmd('open hatch')).includes('locked'), 'and the trapdoor stays locked');
  console.log('  ok — unlocking requires actually holding the key');
}

/* ---------------- the echo, and the lens ---------------- */
function testGateRiddle() {
  fresh();
  cmd('n'); cmd('n'); cmd('open clock'); cmd('take brass key');
  cmd('unlock hatch with brass key'); cmd('open hatch'); cmd('d');
  cmd('take shovel'); cmd('dig'); cmd('s'); cmd('s');
  assert.strictEqual(meta().room, 'caveMouth');
  assert.ok(txt(cmd('examine gates')).includes('borrow every voice'), 'the statue poses its riddle');
  assert.ok(!flags().gatesOpen);
  assert.ok(!txt(cmd('say silence')).includes('groan apart'), 'the wrong answer does nothing');
  assert.ok(txt(cmd('say echo')).includes('groan apart'), 'the right answer opens the gates');
  assert.ok(flags().gatesOpen);
  console.log('  ok — the gate riddle answers only to the echo');
}

function testLensSecret() {
  fresh();
  cmd('n'); cmd('n'); cmd('w');
  cmd('take lens');
  assert.ok(has('lens'), 'the lens is in the desk drawer');
  const read = txt(cmd('use lens on note'));
  assert.ok(read.includes('King\'s last word'), 'the lens reveals the hidden line');
  assert.ok(read.includes('mirror that shows no reflection'), 'including both halves of the hint');
  /* This used to assert a `lensSecret` flag as well. Nothing ever read
     it: neither `say echo` nor `push mirror` asks whether the player was
     told, and both work either way. The prover reported the write-only
     flag, the cartridge dropped it, and what is left here is the effect
     the rule actually has. */
  assert.strictEqual(flags().lensSecret, undefined, 'and keeps no state nothing reads');
  console.log('  ok — the lens reveals the note\'s secret');
}

const tests = [testParser, testStart, testWorldParity, testWinRoute, testPuzzlesResist,
  testDeaths, testDarknessIsNotCombat, testLurkerAmbush, testRpgLayer, testRaisingTheLight, testExamineAward,
  testLampFuel, testSaveLoadUndo, testTrophyCase,
  testClock, testContainerRecovery, testUnlockNeedsKey, testGateRiddle, testLensSecret];
let failed = 0;
console.log('\nTHE SUNKEN CROWN — full regression suite\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
