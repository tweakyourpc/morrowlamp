/* ============================================================
   THE SUNKEN CROWN — Node playthrough tests
   Run with:  node test/playthrough.js
   Exercises the pure-logic core (world + engine + parser)
   without the browser layer (no DOM, localStorage, or audio).
   ============================================================ */
'use strict';

const assert = require('node:assert');
const Z = require('../js/world.js');
require('../js/engine.js');
require('../js/parser.js');

/* ---------------- harness ---------------- */

function fresh() { Z.engine.newGame(); }
function cmd(s) { return Z.engine.handleAction(Z.parser.parse(s)); }
function txt(r) { return r.messages.map(m => m.text).join(' | '); }
const flags = () => Z.engine.flags;
const meta = () => Z.engine.meta();
const inv = () => Z.engine.inventory();
const has = (id) => inv().includes(id);

/* ---------------- parser units ---------------- */

function testParser() {
  const cases = [
    ['take the brass key', { verb: 'take', target: 'brassKey' }],
    ['x knife', { verb: 'examine', target: 'knife' }],
    ['go north', { verb: 'move', text: 'n' }],
    ['i', { verb: 'inventory' }],
    ['look at the note', { verb: 'examine', target: 'note' }],
    ['turn off lantern', { verb: 'turn', target: 'lantern', with: 'off' }],
    ['use lens on note', { verb: 'use', target: 'lens', with: 'note' }],
    ['climb ladder', { verb: 'climb', target: 'well' }],
    ['open cellar', { verb: 'open', target: 'hatch' }],
    ['say echo', { verb: 'say', text: 'echo' }],
    ['take brass key from clock', { verb: 'take', target: 'brassKey', with: 'clock' }],
    ['unlock hatch with brass key', { verb: 'unlock', target: 'hatch', with: 'brassKey' }],
    ['score', { verb: 'score' }]
  ];
  for (const [input, want] of cases) {
    assert.deepStrictEqual(Z.parser.parse(input), want, 'parse: ' + input);
  }

  // genuine ambiguity must stay an error, not crash or pick one
  const keyErr = Z.parser.parse('take key');
  assert.ok(keyErr.error && keyErr.error.includes('brass key') && keyErr.error.includes('vault key'), 'take key ambiguous');
  const statueErr = Z.parser.parse('take statue');
  assert.ok(statueErr.error && statueErr.error.includes('gates') && statueErr.error.includes('idol'), 'take statue ambiguous');

  // a name that repeats one of its own aliases must not self-ambiguate
  assert.deepStrictEqual(Z.parser.parse('take brass key'), { verb: 'take', target: 'brassKey' });
  console.log('  ok — parser units (' + cases.length + ' cases + ambiguity checks)');
}

/* ---------------- start state ---------------- */

function testStart() {
  fresh();
  assert.strictEqual(Z.engine.objectLocation('lantern').kind, 'inventory');
  assert.ok(Z.engine.describeObject('lantern').takeable);
  assert.strictEqual(meta().room, 'yard');
  const startResult = cmd('look');
  assert.ok(Array.isArray(startResult.changed), 'actions expose structured change categories');
  assert.ok(startResult.refresh.includes('hud'), 'turn actions request HUD refresh');
  assert.strictEqual(meta().score, 0);
  assert.deepStrictEqual(inv(), ['lantern', 'note']);
  const r = cmd(null);
  assert.deepStrictEqual(r.messages, [], 'null action -> empty messages');
  assert.strictEqual(meta().turns, 1);
  console.log('  ok — start state');
}

/* ---------------- open container + take (the clock) ---------------- */

function testClock() {
  fresh();
  cmd('n'); cmd('n');                      // yard -> porch -> hall
  assert.strictEqual(meta().room, 'hall');
  let r = cmd('open clock');
  assert.ok(txt(r).includes('brass key'), 'open clock reveals key');
  r = cmd('take brass key');
  assert.ok(txt(r).includes('Taken.'), 'take brass key');
  assert.ok(has('brassKey'));
  r = cmd('take music sheet');
  assert.ok(has('musicSheet'));
  cmd('read music sheet');
  assert.ok(flags().melodyKnown, 'melody known after reading the sheet');
  console.log('  ok — open clock / take from open container');
}

/* ---------------- open container contents remain recoverable ---------------- */
function testContainerRecovery() {
  fresh();
  cmd('n'); cmd('n');
  cmd('open clock');
  cmd('take brass key');
  cmd('take music sheet');
  cmd('open clock'); // already open: confirms the state is stable
  assert.ok(has('brassKey') && has('musicSheet'), 'clock contents can be taken');

  fresh();
  cmd('n'); cmd('n');
  cmd('open clock');
  cmd('take brass key');
  cmd('put brass key in clock');
  cmd('close clock');
  cmd('open clock');
  assert.ok(txt(cmd('take brass key')).includes('Taken.'), 'placed item can be recovered after reopening');
  assert.ok(has('brassKey'), 'recovered item returns to inventory');
  console.log('  ok — open container contents remain recoverable');
}

/* ---------------- unlock integrity ---------------- */

function testUnlockNeedsKey() {
  fresh();
  cmd('n'); cmd('n');                      // hall, key still in the clock
  const r = cmd('unlock hatch with brass key');
  assert.ok(txt(r).includes("don't have the brass key"), 'cannot unlock without holding the key');
  assert.ok(Z.engine.isLocked('hatch'));
  cmd('open clock'); cmd('take brass key');
  const r2 = cmd('unlock hatch with brass key');
  assert.ok(txt(r2).includes('unlocked'), 'unlock works with key in hand');
  assert.ok(!Z.engine.isLocked('hatch'));
  console.log('  ok — unlock requires the key');
}

/* ---------------- full win route (60 points) ---------------- */

function testWinRoute() {
  fresh();
  cmd('read note');
  cmd('n'); cmd('n');                      // hall
  cmd('open clock');
  cmd('take brass key');
  cmd('take music sheet');
  cmd('read music sheet');                 // melodyKnown
  cmd('w');                                // study
  cmd('take lyre');
  cmd('read book');
  cmd('e'); cmd('e');                      // kitchen
  cmd('take curtain');
  cmd('w');                                // hall
  cmd('unlock hatch with brass key');
  cmd('open hatch');
  cmd('d');                                // cellar (dark — lantern lit)
  cmd('take shovel');
  cmd('take pitchPot');
  cmd('dig');                              // tunnelDug
  assert.ok(flags().tunnelDug, 'tunnel dug');
  cmd('s'); cmd('s');                      // tunnel, caveMouth
  cmd('say echo');                         // gatesOpen
  assert.ok(flags().gatesOpen, 'gates opened by the echo');
  cmd('s'); cmd('w');                      // gatePassage, mirrorHall
  cmd('push mirror');                      // mirrorOpened
  assert.ok(flags().mirrorOpened, 'mirror opened');
  cmd('w');                                // mirrorSanctum
  cmd('take idol');                        // +5
  assert.strictEqual(meta().score, 5);

  cmd('e'); cmd('e'); cmd('s');            // guardroom
  let r = cmd('take vault key');           // sentinel refuses
  assert.ok(txt(r).includes('HALT'), 'sentinel halts the theft');
  assert.ok(!has('vaultKey'), 'vault key not taken while on guard');
  cmd('play lyre');                        // guardDancing
  assert.ok(flags().guardDancing, 'sentinel dancing');
  cmd('take vault key');
  assert.ok(has('vaultKey'), 'vault key taken once the guard dances');

  cmd('unlock vault door with vault key');
  cmd('open vault door');
  cmd('w');                                // vault
  cmd('take scepter');                     // +5 -> 10
  assert.strictEqual(meta().score, 10);

  cmd('e'); cmd('s');                      // guardroom, throne
  cmd('take crown');                       // +5 -> 15
  assert.strictEqual(meta().score, 15);
  cmd('d');                                // tomb
  cmd('open sarcophagus');
  cmd('take ring');                        // +5 -> 20
  assert.strictEqual(meta().score, 20);

  cmd('u'); cmd('n'); cmd('n'); cmd('n');  // throne, guardroom, gatePassage, caveMouth
  cmd('w');                                // lakeShore
  r = cmd('fix boat');                     // needs pitch + curtain
  assert.ok(txt(r).includes('patch the hole'), 'boat patched');
  assert.ok(flags().boatPatched, 'boatPatched flag set');
  cmd('w');                                // lakeIslet
  cmd('take chalice');                     // +5 -> 25
  assert.strictEqual(meta().score, 25);

  cmd('e'); cmd('e'); cmd('n'); cmd('u');  // lakeShore, caveMouth, tunnel, cellar
  cmd('u');                                // hall
  cmd('s'); cmd('s');                      // porch, yard
  cmd('climb well');                       // wellBottom
  cmd('take sunstone');                    // +5 -> 30
  assert.strictEqual(meta().score, 30);
  assert.strictEqual(meta().treasuresPlaced, 0, 'nothing placed yet');

  cmd('u'); cmd('n'); cmd('n');            // yard, porch, hall
  const puts = [
    ['crown', 35], ['scepter', 40], ['chalice', 45],
    ['idol', 50], ['ring', 55], ['sunstone', 60]
  ];
  for (const [id, score] of puts) {
    r = cmd('put ' + id + ' in cabinet');
    assert.ok(txt(r).includes('velvet cushion'), 'placed ' + id);
    assert.strictEqual(meta().score, score, 'score after placing ' + id);
  }

  assert.strictEqual(meta().treasuresPlaced, 6);
  assert.strictEqual(meta().win, true, 'game won');
  assert.strictEqual(meta().score, 60);
  assert.strictEqual(meta().room, 'hall');
  const last = cmd('score');
  assert.ok(txt(last).includes('Sunken King\'s Heir'), 'rank is Sunken King\'s Heir');
  console.log('  ok — full win route, 60 points, "Sunken King\'s Heir"');
}

/* ---------------- death scenarios ---------------- */

function testDarknessDeath() {
  fresh();
  cmd('turn off lantern');
  cmd('n'); cmd('n');                      // hall (lit — no problem)
  cmd('open clock');
  cmd('take brass key');
  cmd('unlock hatch with brass key');
  cmd('open hatch');
  cmd('d');                                // into the dark cellar
  assert.strictEqual(meta().room, 'cellar');
  assert.strictEqual(meta().death, false);
  let r = cmd('look');                     // first dark action: warning only
  assert.ok(txt(r).includes('pitch black'));
  assert.strictEqual(meta().death, false);
  r = cmd('look');                         // second dark action: the Umbra
  assert.strictEqual(meta().death, true);
  assert.ok(txt(r).includes('Umbra'), 'umbra death message');
  // dead actions are refused
  r = cmd('n');
  assert.ok(txt(r).includes('You are dead'), 'dead actions refused');
  // help still works when dead
  r = cmd('help');
  assert.ok(txt(r).includes('HOW TO PLAY'));
  console.log('  ok — darkness death (warning then Umbra)');
}

function testOilDeath() {
  fresh();
  cmd('n'); cmd('n');
  cmd('open clock');
  cmd('take brass key');
  cmd('unlock hatch with brass key');
  cmd('open hatch');
  cmd('d');
  cmd('take oil jar');
  assert.ok(has('oilJar'));
  const r = cmd('drink oil');
  assert.strictEqual(meta().death, true, 'lamp oil is fatal');
  assert.ok(txt(r).includes('fatal'), 'fatal message');
  console.log('  ok — drinking lamp oil kills (grandmother was right)');
}

/* ---------------- gate riddle ---------------- */

function testGateRiddle() {
  fresh();
  cmd('n'); cmd('n');
  cmd('open clock');
  cmd('take brass key');
  cmd('unlock hatch with brass key');
  cmd('open hatch');
  cmd('d');
  cmd('take shovel');
  cmd('dig');
  cmd('s'); cmd('s');                      // caveMouth
  assert.ok(!flags().gatesOpen, 'gates shut to begin with');
  cmd('say sandwich');                     // wrong word
  assert.ok(!flags().gatesOpen, 'wrong word does not open the gates');
  const r = cmd('say echo');
  assert.ok(flags().gatesOpen, 'echo opens the gates');
  assert.ok(txt(r).includes('unlatches'), 'gate-opening prose');
  console.log('  ok — gate riddle (echo)');
}

/* ---------------- undo ---------------- */

function testUndo() {
  fresh();
  cmd('n');
  assert.strictEqual(meta().room, 'porch');
  const r = cmd('undo');
  assert.strictEqual(meta().room, 'yard', 'undo returns to the yard');
  assert.ok(txt(r).includes('Time folds backward'), 'undo flavour');
  // undo across a real state change: take something, then undo
  cmd('n'); cmd('n');
  cmd('open clock');
  cmd('take brass key');
  assert.ok(has('brassKey'));
  cmd('undo');
  assert.ok(!has('brassKey'), 'undo un-takes the key');
  cmd('undo');
  assert.strictEqual(meta().room, 'hall', 'second undo rewinds the walk');
  console.log('  ok — undo (movement and item state)');
}

/* ---------------- serialize / restore roundtrip ---------------- */

function testSaveRoundtrip() {
  fresh();
  cmd('n'); cmd('n');
  cmd('open clock');
  cmd('take brass key');
  const snap = Z.engine.serialize();
  const before = meta();
  Z.engine.restore(snap);
  const after = meta();
  assert.strictEqual(after.room, before.room, 'room restored');
  assert.strictEqual(after.score, before.score, 'score restored');
  assert.deepStrictEqual(inv(), ['lantern', 'note', 'brassKey'], 'inventory restored');
  assert.ok(Z.engine.isOpen('clock'), 'container state restored');
  console.log('  ok — serialize/restore roundtrip');
}

/* ---------------- lens secret ---------------- */

function testLensSecret() {
  fresh();
  cmd('n'); cmd('n'); cmd('w');            // study
  cmd('take lens');                        // from the desk drawer (open)
  assert.ok(has('lens'));
  const r = cmd('use lens on note');
  assert.ok(txt(r).includes('last word'), 'lens reveals the secret line');
  assert.ok(flags().lensSecret, 'lensSecret flag set');
  console.log('  ok — lens + note secret');
}

/* ---------------- runner ---------------- */

const tests = [
  ['parser units', testParser],
  ['start state', testStart],
  ['open clock / take', testClock],
  ['container recovery', testContainerRecovery],
  ['unlock needs key', testUnlockNeedsKey],
  ['full win route', testWinRoute],
  ['darkness death', testDarknessDeath],
  ['oil death', testOilDeath],
  ['gate riddle', testGateRiddle],
  ['undo', testUndo],
  ['save roundtrip', testSaveRoundtrip],
  ['lens secret', testLensSecret]
];

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fresh();
    fn();
  } catch (err) {
    failed++;
    console.error('  FAIL — ' + name + ': ' + err.message);
    if (err.stack) console.error(err.stack.split('\n').slice(0, 4).join('\n'));
  }
}

console.log(failed ? '\n' + failed + ' test group(s) FAILED' : '\nAll ' + tests.length + ' test groups passed.');
process.exit(failed ? 1 : 0);
