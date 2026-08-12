/* ============================================================
   MORROWLAMP MACHINE — stats, encounters, outcomes
   The generic half of the RPG capability, against a synthetic
   cartridge with stats called things no adventure game has ever
   called them. If any of this only works for Sunken Crown's five
   stats or Sunken Crown's Umbra, it fails here.
   Run with:  node test/encounters.js
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

const ml = Z.ml;

/* Deliberately absurd: one stat, called BRIO. */
function cartridge() {
  return {
    meta: { id: 'brio-test', title: 'A Study In Brio', version: '1.0.0' },
    startFlags: { settled: false },
    world: {
      startRoom: 'lawn',
      startInventory: ['umbrella'],
      rooms: {
        lawn: { name: 'The Lawn', desc: 'A lawn. A goose.', exits: { n: { room: 'house', flagReq: 'settled', deny: 'The goose is between you and the door.' } } },
        house: { name: 'The House', desc: 'Safe at last.', exits: { s: 'lawn' } },
        pit: { name: 'The Pit', desc: 'It is dark and there is no way out.', dark: true, exits: {} }
      },
      objects: {
        umbrella: { name: 'umbrella', aliases: ['umbrella'], at: 'inv', takeable: true },
        goose: { name: 'goose', aliases: ['goose'], at: 'lawn', desc: 'A goose regards you.' }
      }
    },
    vocabulary: { verbs: { confront: { words: ['confront', 'approach'], form: 'target', prompt: 'Confront what?' } } },
    rules: [
      { id: 'confront-goose', verb: 'confront', target: 'goose', when: { flags: { settled: false } }, do: [{ encounter: 'theGoose' }] },
      { id: 'practise', verb: 'wait', do: [{ train: { stat: 'brio', by: 5 } }, { say: 'You practise looking confident.' }] }
    ],
    encounters: {
      theGoose: {
        kind: 'combat',
        opponent: { name: 'The Goose', hp: 8, attack: [2, 4], defence: 0, xp: 20 },
        intro: 'The goose has decided.',
        hit: 'The goose connects.',
        miss: 'The goose misjudges.',
        defeated: 'The goose concedes the lawn with enormous dignity.',
        dodgeFrom: 'brio',
        hurtTrains: 'brio',
        actions: [
          { id: 'attack', label: 'Shoo', kind: 'strike', uses: 'brio', trains: 'brio' },
          { id: 'guard', label: 'Hide behind umbrella', kind: 'guard', trains: 'brio',
            when: { carrying: ['umbrella'] }, deny: 'You have nothing to hide behind.' },
          { id: 'flee', label: 'Run', kind: 'escape', chance: 0.5, trains: 'brio' }
        ],
        onWin: { type: 'rules', do: [{ set: 'settled' }, { say: 'The way north is clear.' }] },
        onFlee: { type: 'say', text: 'You will have to come back.' },
        onDefeat: { type: 'death', text: ['Felled by a goose. The lawn keeps your name.'] }
      }
    },
    profile: {
      stats: {
        list: { brio: 'Brio' },
        classes: { visitor: { name: 'Visitor', stats: { brio: 10 } } },
        health: { from: 'brio', base: 5, perPoint: 1, perLevel: 2 },
        growth: { base: 2, per: 5, max: 30 },
        levels: { max: 3, factor: 15, power: 1.5 }
      },
      combat: true,
      darkness: { enabled: true, warning: 'Black as a hat.', grace: 0, onFail: { type: 'move', room: 'lawn', text: 'You grope your way out.' } }
    },
    endings: [{ id: 'inside', kind: 'win', when: { room: 'house' }, text: ['You are indoors. The goose is not.'] }],
    presentation: { interface: 'parser', audio: 'speaker', renderer: 'ega' }
  };
}

const make = (random) => ml.runtime.create(cartridge(), { random: random || (() => 0.1) });
const txt = (r) => r.messages.map((m) => m.text).join(' | ');

/* ---------------- capabilities are off unless asked for ---------------- */
function testCapabilityShape() {
  const off = ml.profile.normalize({ stats: false, combat: false });
  assert.strictEqual(off.stats.enabled, false);
  assert.strictEqual(off.combat.enabled, false);

  /* A configuration object switches the capability on without anybody
     having to write `enabled: true` next to it. */
  const on = ml.profile.normalize({ stats: { list: { brio: 'Brio' } } });
  assert.strictEqual(on.stats.enabled, true, 'a config object implies enabled');
  assert.deepStrictEqual(on.stats.list, { brio: 'Brio' });

  /* And an explicit false still wins over a configuration object. */
  const vetoed = ml.profile.normalize({ stats: { enabled: false, list: { brio: 'Brio' } } });
  assert.strictEqual(vetoed.stats.enabled, false, 'an explicit enabled:false wins');

  /* Combat needs somewhere to keep your health. */
  const implied = ml.profile.normalize({ combat: true });
  assert.strictEqual(implied.stats.enabled, true, 'combat implies stats');

  const none = ml.profile.normalize({});
  assert.strictEqual(none.stats.enabled, false, 'and none of it happens by default');
  console.log('  ok — a capability is false, or a configuration that implies enabled');
}

/* ---------------- stats are entirely cartridge-defined ---------------- */
function testStatsAreCartridgeDefined() {
  const rt = make();
  const sheet = rt.sheet();
  assert.deepStrictEqual(sheet.stats.map((s) => s.id), ['brio'], 'one stat, called what the cartridge called it');
  assert.strictEqual(sheet.stats[0].name, 'Brio');
  assert.strictEqual(sheet.maxHp, 15, 'health formula: base 5 + brio 10 * 1');
  assert.strictEqual(sheet.className, 'Visitor');
  assert.strictEqual(sheet.level, 1);

  /* Growth curve is the cartridge's too. */
  const before = rt.sheet().stats[0].value;
  rt.command('wait');
  assert.ok(rt.sheet().stats[0].value > before, 'a rule can train a stat');
  console.log('  ok — stat names, classes, health and growth all come from the cartridge');
}

/* ---------------- encounters ---------------- */
function testEncounterFlow() {
  const rt = make();
  assert.ok(txt(rt.command('n')).includes('goose is between you'), 'the way is barred first');
  const started = rt.command('confront goose');
  assert.ok(txt(started).includes('The goose has decided.'));
  const enc = rt.encounter();
  assert.ok(enc, 'an encounter is running');
  assert.strictEqual(enc.name, 'The Goose');
  assert.strictEqual(enc.hp, 8);
  assert.deepStrictEqual(enc.actions.map((a) => a.id), ['attack', 'guard', 'flee']);
  assert.strictEqual(enc.actions[0].label, 'Shoo', 'labels are the cartridge\'s words');

  /* Ordinary play is suspended while it runs. */
  assert.ok(txt(rt.command('look')).includes('Your options'), 'you cannot wander off mid-encounter');
  assert.ok(rt.encounter(), 'and the encounter is still there');

  while (rt.encounter()) rt.encounterAct('attack');
  assert.ok(rt.flags().settled, 'onWin ran its rule actions');
  assert.ok(rt.sheet().xp >= 20, 'and the win awarded experience');
  assert.ok(txt(rt.command('n')).includes('The House'), 'the way is open now');
  assert.strictEqual(rt.meta().win, true);
  console.log('  ok — an encounter suspends play, resolves, and reports its outcome');
}

function testActionConditions() {
  const rt = make();
  rt.command('confront goose');
  assert.strictEqual(rt.encounter().actions.find((a) => a.id === 'guard').enabled, true);

  const bare = make();
  bare.command('drop umbrella');
  bare.command('confront goose');
  const guard = bare.encounter().actions.find((a) => a.id === 'guard');
  assert.strictEqual(guard.enabled, false, 'an action whose `when` fails is disabled');
  assert.strictEqual(guard.deny, 'You have nothing to hide behind.', 'and explains itself');
  assert.ok(txt(bare.encounterAct('guard')).includes('nothing to hide behind'), 'and refuses if attempted');
  console.log('  ok — encounter actions use the ordinary rule condition vocabulary');
}

function testLosingAndFleeing() {
  const doomed = make(() => 0.99);
  doomed.command('confront goose');
  let guard = 20;
  while (doomed.encounter() && guard--) doomed.encounterAct('attack');
  assert.strictEqual(doomed.meta().dead, true, 'you can lose to a goose');

  /* 0.4 < flee chance 0.5, and > attack hit chance for brio 10. */
  const runner = make(() => 0.4);
  runner.command('confront goose');
  const fled = runner.encounterAct('flee');
  assert.ok(txt(fled).includes('You will have to come back.'), 'onFlee outcome fired');
  assert.strictEqual(runner.encounter(), null, 'and the encounter is over');
  assert.strictEqual(runner.flags().settled, false, 'without the reward');
  assert.strictEqual(runner.meta().dead, false);
  console.log('  ok — losing and fleeing each reach their own outcome');
}

/* ---------------- a typed command can fight ---------------- */
function testParserCanFight() {
  const rt = make();
  rt.command('confront goose');
  const said = txt(rt.command('shoo'));
  assert.ok(said.includes('strike') || said.includes('swing'),
    'an action label typed as a command is taken as that action: ' + said);
  assert.ok(rt.meta().turns > 0);
  console.log('  ok — the parser shell can fight without a combat panel');
}

/* ---------------- outcomes ---------------- */
function testOutcomeTypes() {
  /* This cartridge's darkness moves you instead of killing you, which is
     the whole point: darkness does not know what it is triggering. */
  const rt = make();
  rt.state().room = 'pit';
  /* grace 0 means no warning at all: the first dark turn is the last. */
  const out = rt.command('look');
  assert.ok(txt(out).includes('grope your way out'), 'the dark moves you instead of killing you');
  assert.strictEqual(rt.meta().room, 'lawn', 'to somewhere else entirely');
  assert.strictEqual(rt.meta().dead, false, 'nobody died');

  assert.deepStrictEqual(ml.outcome.normalize('Squashed.'), { type: 'death', text: ['Squashed.'] },
    'a bare string still reads as a death');
  assert.strictEqual(ml.outcome.normalize(undefined), null);
  console.log('  ok — darkness produces move / death / encounter outcomes without knowing the difference');
}

/* ---------------- an unknown encounter fails safe ---------------- */
function testMissingEncounterFallsBack() {
  const cart = cartridge();
  cart.profile.darkness.onFail = { type: 'encounter', encounter: 'nothing-like-this', fallback: { type: 'death', text: ['The pit keeps you.'] } };
  const rt = ml.runtime.create(cart, { random: () => 0.1 });
  rt.state().room = 'pit';
  assert.ok(txt(rt.command('look')).includes('The pit keeps you.'), 'the declared fallback runs');
  assert.strictEqual(rt.meta().dead, true);

  /* And with encounters switched off entirely, the same cartridge data
     still resolves rather than stranding the player. */
  const noCombat = cartridge();
  noCombat.profile.combat = false;
  noCombat.profile.stats = false;
  noCombat.profile.darkness.onFail = { type: 'encounter', encounter: 'theGoose' };
  const plain = ml.runtime.create(noCombat, { random: () => 0.1 });
  plain.state().room = 'pit';
  plain.command('look');
  assert.strictEqual(plain.meta().dead, true, 'no encounter system means a death, not a hang');
  assert.strictEqual(plain.meta().encounter, null);
  console.log('  ok — an encounter that cannot run fails safe');
}

/* ---------------- save and load carry the sheet ---------------- */
function testPersistence() {
  const rt = make();
  rt.command('wait'); rt.command('wait');
  rt.command('confront goose');
  const saved = rt.serialize();
  const brio = rt.sheet().stats[0].value;

  const other = make();
  other.restore(saved);
  assert.strictEqual(other.sheet().stats[0].value, brio, 'the character sheet survives a save');
  assert.ok(other.encounter(), 'and so does the fight you were in the middle of');
  assert.strictEqual(other.encounter().name, 'The Goose');
  console.log('  ok — the sheet and a running encounter both survive save/load');
}

const tests = [testCapabilityShape, testStatsAreCartridgeDefined, testEncounterFlow,
  testActionConditions, testLosingAndFleeing, testParserCanFight, testOutcomeTypes,
  testMissingEncounterFallsBack, testPersistence];
let failed = 0;
console.log('\nMORROWLAMP MACHINE — stats, encounters, outcomes\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
