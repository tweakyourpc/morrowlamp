/* ============================================================
   MORROWLAMP GAME WORKSHOP — bundle manifest and the blank slate
   Replaces the old test/framework.js, which exercised the retired
   manifest/exporter pair. The contract worth testing now is the
   one the Workshop actually depends on: that the bundle manifest
   describes real files in a workable order, and that a cartridge
   started from the Workshop's blank template validates, plays,
   and compiles without anybody editing the runtime.
   Run with:  node test/workshop.js
   ============================================================ */
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
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
require('../js/workshop/bundle.js');
require('../js/workshop/compiler.js');
require('../js/world.js');
require('../js/cartridges/sunken-crown.js');
require('../js/cartridges/captains-thistle.js');

const ml = Z.ml;

/* ---------------- the bundle manifest is honest ---------------- */
function testBundleFilesExist() {
  const all = ml.bundle.allFiles();
  assert.ok(all.length > 8, 'the manifest lists a real bundle');
  for (const file of all) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), 'bundle names a file that exists: ' + file);
  }
  assert.strictEqual(new Set(all).size, all.length, 'no file is listed twice');
  console.log('  ok — every file in the bundle manifest exists (' + all.length + ' files)');
}

function testLoadOrder() {
  /* core.js must come first: everything else hangs off Z.ml. */
  assert.strictEqual(ml.bundle.MACHINE[0], 'js/morrowlamp/core.js');
  const machineIndex = (f) => ml.bundle.MACHINE.indexOf(f);
  assert.ok(machineIndex('js/morrowlamp/rules.js') < machineIndex('js/morrowlamp/runtime.js'),
    'the rule book loads before the runtime that dispatches to it');
  assert.ok(machineIndex('js/morrowlamp/world.js') < machineIndex('js/morrowlamp/runtime.js'),
    'the world model loads before the runtime');

  for (const id in Z.cartridges) {
    const plan = ml.bundle.filesFor(Z.cartridges[id]);
    assert.strictEqual(plan.machine[0], 'js/morrowlamp/core.js', id + ' starts with core.js');
    if (plan.machine.includes('js/morrowlamp/render.js')) {
      assert.ok(plan.machine.indexOf('js/gfx.js') < plan.machine.indexOf('js/morrowlamp/render.js'),
        id + ': drawing primitives load before the display adapter');
    }
  }
  console.log('  ok — the bundle load order is coherent');
}

function testPresentationDrivesTheBundle() {
  const parserGame = ml.clone(Z.cartridges['captains-thistle']);
  parserGame.presentation = { renderer: 'ega', audio: 'speaker', interface: 'parser' };
  const plan = ml.bundle.filesFor(parserGame);
  assert.ok(plan.machine.includes('js/morrowlamp/shell-parser.js'), 'a parser game gets the parser shell');
  assert.ok(!plan.machine.includes('js/morrowlamp/shell-canvas.js'), 'and not the canvas shell');
  assert.ok(!plan.machine.includes('js/gfx.js'), 'and does not pay for the renderer at all');
  assert.ok(!plan.machine.includes('js/music.js'), 'and PC SPEAKER does not pay for the sequencer');

  const richGame = ml.clone(parserGame);
  richGame.presentation = { renderer: 'vga', audio: 'synth', interface: 'canvas' };
  const rich = ml.bundle.filesFor(richGame);
  assert.ok(rich.machine.includes('js/gfx.js') && rich.machine.includes('js/music.js'),
    'a canvas game with a sequencer gets both');
  assert.ok(rich.machine.length > plan.machine.length, 'more presentation costs more modules');
  console.log('  ok — presentation choices really change what is bundled');
}

/* ---------------- the Workshop's blank cartridge ----------------
   The template the New Cartridge button produces, copied here. If
   the Workshop ever ships a starting point that does not work, this
   is the test that says so. */
function blankCartridge() {
  return {
    format: 'morrowlamp-cartridge',
    formatVersion: 2,
    meta: { id: 'my-adventure', title: 'A NEW ADVENTURE', author: '', version: '0.1.0', blurb: '' },
    intro: ['A door waits in the mist.'],
    startFlags: { doorOpened: false },
    world: {
      startRoom: 'threshold',
      startInventory: [],
      rooms: {
        threshold: {
          name: 'The Threshold', desc: 'A door waits in the mist, shut.', short: 'The threshold.',
          exits: { n: { room: 'beyond', flagReq: 'doorOpened', deny: 'The door is shut.' } }
        },
        beyond: { name: 'Beyond', desc: 'Past the door, the mist thins and something is finally visible.', exits: { s: 'threshold' } }
      },
      objects: {
        door: { name: 'door', aliases: ['door'], at: 'threshold', desc: 'A shut door stands in the mist.', examine: 'An ordinary door in an unlikely place.' }
      }
    },
    vocabulary: {
      verbs: {
        /* `push` is not one of the Machine's core verbs — a game that
           wants it must say so. The validator will tell you if a rule
           ever matches a verb nobody taught the parser. */
        push: { words: ['push', 'press', 'shove'], form: 'target', prompt: 'Push what?', fallback: 'It does not budge.' }
      }
    },
    rules: [{
      id: 'open-the-door', verb: ['open', 'push'], target: 'door',
      when: { flags: { doorOpened: false } },
      do: [{ set: 'doorOpened' }, { say: 'The door swings open. North it is.' }],
      otherwise: [{ say: 'It is already open.' }]
    }],
    profile: { score: { enabled: true, ranks: [[0, 'Visitor'], [10, 'Arrived']] } },
    endings: [{ id: 'through', kind: 'win', when: { room: 'beyond' }, score: 10, text: ['You are through. That is the whole adventure. Now make a bigger one.'] }],
    presentation: { renderer: 'ega', audio: 'chip', interface: 'parser' }
  };
}

function testBlankCartridgeValidates() {
  const result = ml.validator.validate(blankCartridge());
  assert.ok(result.ok, 'the Workshop\'s starting point validates: ' + result.errors.join('; '));
  console.log('  ok — the blank cartridge the Workshop hands you validates');
}

function testBlankCartridgePlays() {
  const rt = ml.runtime.create(blankCartridge());
  const txt = (r) => r.messages.map((m) => m.text).join(' | ');
  assert.ok(txt(rt.command('n')).includes('The door is shut.'), 'the gate holds before the puzzle');
  assert.ok(txt(rt.command('open door')).includes('swings open'), 'the rule fires');
  assert.ok(txt(rt.command('open door')).includes('already open'), 'and the otherwise branch answers next time');
  rt.command('n');
  assert.strictEqual(rt.meta().room, 'beyond');
  assert.strictEqual(rt.meta().win, true, 'the template can be finished');
  assert.strictEqual(rt.meta().score, 10);
  assert.strictEqual(rt.meta().rank, 'Arrived');
  console.log('  ok — the blank cartridge plays start to finish on the stock runtime');
}

function testBlankCartridgeCompiles() {
  const cartridge = blankCartridge();
  const sources = {};
  for (const file of ml.bundle.allFiles().concat(['js/workshop/validator.js'])) {
    sources[file] = fs.readFileSync(path.join(ROOT, file), 'utf8');
  }
  /* A cartridge assembled in the Workshop has no source file of its own,
     so it is embedded as JSON. Both routes must work. */
  const html = ml.compiler.compile({ cartridge, sources, allowDataCartridge: true, now: '2026-08-11T12:00:00.000Z' });
  assert.ok(html.includes('id="morrowlamp-cartridge" type="application/json"'), 'a data cartridge is embedded as JSON');
  assert.ok(html.includes('"my-adventure"'), 'and carries its id');
  assert.ok(ml.compiler.inspect(html).selfContained, 'and the result is still self-contained');
  assert.strictEqual(ml.compiler.filename(cartridge), 'my-adventure.html');
  console.log('  ok — a cartridge with no source file of its own still compiles (' + Math.round(html.length / 1024) + 'K)');
}

/* ---------------- nobody had to edit the runtime ---------------- */
function testRuntimeKnowsNothingAboutAnyGame() {
  const forbidden = ['sunken', 'crown', 'lantern', 'sentinel', 'thistle', 'umbra', 'ashcombe', 'vending'];
  const machineFiles = ml.bundle.MACHINE.concat(ml.bundle.RENDERER, ml.bundle.SHELLS.canvas, ml.bundle.SHELLS.parser)
    .filter((f) => f.startsWith('js/morrowlamp/'));
  for (const file of new Set(machineFiles)) {
    /* Comments may name a game while explaining a decision; code may not. */
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const word of forbidden) {
      assert.ok(!source.toLowerCase().includes(word),
        file + ' mentions "' + word + '" in code; the Machine must not know about any particular game');
    }
  }
  console.log('  ok — no Machine file names any game in its code');
}

const tests = [testBundleFilesExist, testLoadOrder, testPresentationDrivesTheBundle,
  testBlankCartridgeValidates, testBlankCartridgePlays, testBlankCartridgeCompiles,
  testRuntimeKnowsNothingAboutAnyGame];
let failed = 0;
console.log('\nMORROWLAMP GAME WORKSHOP — bundle and blank slate\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
