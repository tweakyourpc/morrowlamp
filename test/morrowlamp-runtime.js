/* ============================================================
   MORROWLAMP MACHINE — runtime contract
   A tiny synthetic cartridge, deliberately nothing like The
   Sunken Crown, exercising the generic half of the Machine:
   placement, containers, gated exits, darkness, scoring,
   save/load, undo, and the changed/refresh contract.
   Run with:  node test/morrowlamp-runtime.js
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

function cartridge() {
  return {
    meta: { id: 'test-vault', title: 'The Test Vault', version: '1.0.0' },
    world: {
      startRoom: 'hall',
      startInventory: ['torch'],
      rooms: {
        hall: {
          name: 'Marble Hall', desc: 'A hall of cold marble.', short: 'The marble hall.',
          exits: {
            n: { room: 'vault', objReq: 'grate', open: true, deny: 'The grate is closed.' },
            e: { room: 'crypt', flagReq: 'chanted', deny: 'The east arch is solid stone.' },
            w: { room: 'nowhere-at-all', deny: 'Nothing that way.' },
            s: { room: 'cellar', mysteryReq: 'whatever' }
          },
          notes: [{ when: { flags: { chanted: true } }, text: 'The east arch stands open.' }]
        },
        vault: { name: 'Vault', desc: 'A small vault.', exits: { s: 'hall' } },
        crypt: { name: 'Crypt', desc: 'A dark crypt.', dark: true, exits: { w: 'hall' } },
        cellar: { name: 'Cellar', desc: 'Unreachable by design.', exits: {} }
      },
      objects: {
        torch: { name: 'torch', aliases: ['torch'], at: 'inv', takeable: true, light: true, lit: true },
        grate: { name: 'iron grate', aliases: ['grate'], at: 'hall', container: true, open: false, locked: true, key: 'pin', desc: 'An iron grate is set in the north wall.' },
        chest: { name: 'chest', aliases: ['chest'], at: 'hall', container: true, open: false, contents: ['pin'], desc: 'A chest sits here.' },
        pin: { name: 'brass pin', aliases: ['pin', 'brass pin'], takeable: true },
        plinth: { name: 'plinth', aliases: ['plinth'], at: 'vault', container: true, open: true, contents: [], desc: 'A plinth stands here.', acceptText: 'You set {the target} on the plinth.', rejectText: 'The plinth wants treasure, not that.' },
        coin: { name: 'gold coin', aliases: ['coin'], at: 'vault', takeable: true, treasure: true, desc: 'A gold coin lies here.' },
        skull: { name: 'crystal skull', aliases: ['skull'], at: 'crypt', takeable: true, treasure: true, desc: 'A crystal skull grins here.' }
      }
    },
    profile: {
      score: { enabled: true, treasureFound: 3, treasureSecured: 7, ranks: [[0, 'Tourist'], [10, 'Looter'], [20, 'Vault Master']] },
      treasures: { enabled: true, list: ['coin', 'skull'], securedIn: 'plinth' },
      darkness: { enabled: true, warning: 'It is utterly black.', grace: 1, death: ['Something eats you.'] },
      light: { fuel: { object: 'torch', turns: 3, warnings: [[1, 'The torch gutters.']], outText: 'The torch dies.' } }
    },
    vocabulary: { verbs: { chant: { words: ['chant', 'intone'], form: 'text', prompt: 'Chant what?' } } },
    rules: [
      {
        id: 'chant-the-word', verb: 'chant', phrase: 'ossuary',
        when: { room: 'hall', flags: { chanted: false } },
        do: [{ set: 'chanted' }, { say: 'The east arch grinds open.' }, { sound: 'chime' }]
      },
      { id: 'chant-anything-else', verb: 'chant', do: [{ say: 'The hall swallows the word.' }] }
    ],
    endings: [{ id: 'victory', kind: 'win', text: ['The plinth is full. You have won.'] }]
  };
}

const make = () => Z.ml.runtime.create(cartridge());
const txt = (r) => r.messages.map((m) => m.text).join(' | ');

/* ---------------- placement and containers ---------------- */
function testContainers() {
  const rt = make();
  assert.ok(txt(rt.command('look')).includes('A chest sits here.'), 'room lists loose objects');
  assert.ok(txt(rt.command('take pin')).includes('You don\'t see that here.'), 'closed container hides contents');
  assert.ok(txt(rt.command('open chest')).includes('brass pin'), 'opening reveals contents');
  assert.ok(txt(rt.command('take pin')).includes('Taken.'), 'take from an open container');
  assert.deepStrictEqual(rt.inventory(), ['torch', 'pin']);
  rt.command('put pin in chest');
  rt.command('close chest');
  rt.command('open chest');
  assert.ok(txt(rt.command('take pin')).includes('Taken.'), 'contents survive a close/open cycle');
  console.log('  ok — containers and placement');
}

/* ---------------- exits fail closed ---------------- */
function testExitGating() {
  const rt = make();
  assert.ok(txt(rt.command('n')).includes('The grate is closed.'), 'objReq gate holds');
  assert.ok(txt(rt.command('e')).includes('solid stone'), 'flagReq gate holds');
  assert.ok(txt(rt.command('w')).includes('Nothing that way'), 'exit to a missing room is refused');
  /* An exit naming a requirement the Machine does not understand must be
     shut, not waved through. The old framework runtime waved it through. */
  assert.ok(!txt(rt.command('s')).includes('You go south'), 'unknown exit requirement fails closed');
  assert.strictEqual(rt.meta().room, 'hall');

  rt.command('open chest'); rt.command('take pin');
  rt.command('unlock grate with pin');
  assert.ok(txt(rt.command('n')).includes('The grate is closed.'), 'unlocking is not opening');
  rt.command('open grate');
  assert.ok(txt(rt.command('n')).includes('Vault'), 'gate opens once its object does');
  console.log('  ok — exits fail closed');
}

/* ---------------- rules ---------------- */
function testRules() {
  const rt = make();
  assert.ok(txt(rt.command('chant hello')).includes('swallows the word'), 'general rule catches the rest');
  assert.ok(!rt.flags().chanted);
  const r = rt.command('chant the ossuary word');
  assert.ok(txt(r).includes('grinds open'), 'phrase rule fires');
  assert.ok(rt.flags().chanted, 'rule set its flag');
  assert.ok(txt(rt.command('look')).includes('The east arch stands open.'), 'conditional room note appears');
  assert.ok(txt(rt.command('e')).includes('Crypt'), 'the rule really opened the way');
  console.log('  ok — rules, phrases, and conditional room notes');
}

/* ---------------- darkness and fuel ---------------- */
function testDarknessAndFuel() {
  const rt = make();
  rt.command('chant ossuary');
  rt.command('turn off torch');
  rt.command('e');
  assert.strictEqual(rt.meta().dead, false);
  assert.ok(txt(rt.command('look')).includes('utterly black'), 'first dark turn warns');
  assert.strictEqual(rt.meta().dead, false);
  rt.command('look');
  assert.strictEqual(rt.meta().dead, true, 'second dark turn is fatal');

  const lit = make();
  lit.command('chant ossuary');
  assert.strictEqual(lit.meta().fuel, 3);
  lit.command('look'); lit.command('look');
  assert.strictEqual(lit.meta().fuel, 3, 'fuel does not burn in lit rooms');
  lit.command('e');
  assert.strictEqual(lit.meta().fuel, 2, 'standing in the dark costs a turn of oil');
  assert.ok(txt(lit.command('look')).includes('The torch gutters.'), 'the low-fuel warning fires');
  assert.ok(txt(lit.command('look')).includes('The torch dies.'), 'the torch runs out');
  assert.strictEqual(lit.meta().hasLight, false, 'a dead torch is not a light');
  console.log('  ok — darkness grace, death, and lamp fuel');
}

/* ---------------- scoring, treasures, win ---------------- */
function testScoringAndWin() {
  const rt = make();
  rt.command('open chest'); rt.command('take pin');
  rt.command('unlock grate with pin'); rt.command('open grate');
  rt.command('n');
  assert.ok(txt(rt.command('take coin')).includes('Scored 3'), 'finding a treasure scores');
  assert.strictEqual(rt.meta().score, 3);
  assert.ok(txt(rt.command('put torch on plinth')).includes('wants treasure'), 'the case rejects non-treasure');
  const placed = rt.command('put coin on plinth');
  assert.ok(txt(placed).includes('You set the gold coin on the plinth.'), 'acceptText is used');
  assert.strictEqual(rt.meta().score, 10);
  assert.strictEqual(rt.meta().secured, 1);
  assert.strictEqual(rt.meta().rank, 'Looter');

  rt.command('s'); rt.command('chant ossuary'); rt.command('e');
  rt.command('take skull');
  rt.command('w'); rt.command('n');
  const win = rt.command('put skull on plinth');
  assert.ok(txt(win).includes('You have won.'), 'the win ending fires');
  assert.strictEqual(rt.meta().win, true);
  assert.strictEqual(rt.meta().score, 20);
  assert.strictEqual(rt.meta().rank, 'Vault Master');
  console.log('  ok — scoring, treasures, and the win ending');
}

/* ---------------- undo, save, load ---------------- */
function testUndoAndSave() {
  const rt = make();
  rt.command('open chest');
  rt.command('take pin');
  assert.ok(rt.inventory().includes('pin'));
  rt.command('undo');
  assert.ok(!rt.inventory().includes('pin'), 'undo returns the pin');

  rt.command('take pin');
  rt.command('chant ossuary');
  const saved = rt.serialize();
  const score = rt.meta().score;
  rt.command('e');
  const other = Z.ml.runtime.create(cartridge());
  other.restore(saved);
  assert.strictEqual(other.meta().room, 'hall', 'restored to the saved room');
  assert.ok(other.inventory().includes('pin'), 'restored inventory');
  assert.strictEqual(other.flags().chanted, true, 'restored flags');
  assert.strictEqual(other.meta().score, score);
  console.log('  ok — undo and save/load roundtrip');
}

/* ---------------- change reporting ---------------- */
function testChangeContract() {
  const rt = make();
  const look = rt.command('look');
  assert.ok(look.changed.includes('turns'));
  assert.ok(look.refresh.includes('hud'));
  const open = rt.command('open chest');
  assert.ok(open.changed.includes('objects'));
  assert.ok(open.refresh.includes('scene'));
  const chant = rt.command('chant ossuary');
  assert.ok(chant.changed.includes('flags'));
  console.log('  ok — changed/refresh categories');
}

/* ---------------- events ---------------- */
function testEvents() {
  const rt = make();
  const seen = [];
  rt.on('sound', (p) => seen.push('sound:' + p.name));
  rt.on('room', (p) => seen.push('room:' + p.room));
  rt.command('chant ossuary');
  rt.command('e');
  assert.ok(seen.includes('sound:chime'), 'rules can ring the bell');
  assert.ok(seen.includes('room:crypt'), 'room changes are announced');
  console.log('  ok — runtime events reach a listener');
}

const tests = [testContainers, testExitGating, testRules, testDarknessAndFuel,
  testScoringAndWin, testUndoAndSave, testChangeContract, testEvents];
let failed = 0;
console.log('\nMORROWLAMP MACHINE — runtime contract\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
