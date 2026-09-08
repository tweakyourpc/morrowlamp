/* ============================================================
   MORROWLAMP — semantic scene contract
   Run with: node test/semantic-scenes.js
   ============================================================ */
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Z = require('../js/morrowlamp/core.js');
for (const name of ['world', 'profile', 'outcome', 'rules', 'vocabulary', 'stats', 'encounter', 'runtime']) require('../js/morrowlamp/' + name + '.js');
require('../js/morrowlamp/scene.js');
require('../js/morrowlamp/render.js');
require('../js/workshop/validator.js');
require('../js/workshop/bundle.js');
require('../js/workshop/compiler.js');
const ml = Z.ml;

function cartridge() {
  return {
    format: 'morrowlamp-cartridge', formatVersion: 2,
    meta: { id: 'semantic-test', title: 'Semantic Test', version: '1.0.0' },
    world: {
      startRoom: 'hall', startInventory: [],
      rooms: { hall: { name: 'Hall', desc: 'A hall.', exits: { e: 'yard' } }, yard: { name: 'Yard', desc: 'A yard.', exits: { w: 'hall' } } },
      objects: { door: { name: 'door', aliases: ['door'], at: 'hall', desc: 'A door.' } }
    },
    vocabulary: { verbs: {} }, rules: [],
    endings: [{ id: 'done', kind: 'win', when: { room: 'yard' }, text: ['Done.'] }],
    presentation: { renderer: 'ega', audio: 'chip', interface: 'canvas', art: { scene: {
      hall: { environment: 'stone_chamber', perspective: 'interior', features: [
        { type: 'door', position: 'north', style: 'iron', object: 'door' },
        { type: 'torch', position: 'left_wall', lit: true }
      ] }
    } } }
  };
}

function fakeG() {
  const calls = [];
  const C = { black: '#000', blue: '#00a', ltblue: '#55f', green: '#0a0', cyan: '#0aa', red: '#a00', magenta: '#a0a', brown: '#a50', ltgray: '#aaa', dkgray: '#555', ltgreen: '#5f5', ltcyan: '#5ff', ltred: '#f55', ltmagenta: '#f5f', yellow: '#ff5', white: '#fff' };
  const g = { W: 320, H: 200, C,
    vgrad(...args) { calls.push(['vgrad', args]); }, px(...args) { calls.push(['px', args]); },
    line(...args) { calls.push(['line', args]); }, ellipse(...args) { calls.push(['ellipse', args]); },
    stipple(...args) { calls.push(['stipple', args]); }
  };
  return { g, calls };
}

function testValidatesAndBuilds() {
  const cart = cartridge();
  const result = ml.validator.validate(cart);
  assert.ok(result.ok, result.errors.join('; '));
  const art = ml.render.artOf(cart);
  const scene = art.scene('hall');
  assert.strictEqual(scene.spots[0].id, 'door');
  assert.ok(scene.exits.some((e) => e.dir === 'e'));
  const fake = fakeG();
  scene.paint(fake.g);
  assert.ok(fake.calls.length > 10, 'semantic scene paints through the display primitives');
  assert.ok(art.actor && art.item, 'data scenes receive generic actor and item renderers');
  console.log('  ok — a semantic scene validates, resolves, paints, and supplies generic art');
}

function testRejectsBadVocabulary() {
  const cart = cartridge();
  cart.presentation.art.scene.hall.environment = 'space_station';
  cart.presentation.art.scene.hall.features[0].position = 'ceiling';
  cart.presentation.art.scene.hall.features[0].object = 'missing';
  const result = ml.validator.validate(cart);
  assert.ok(!result.ok);
  for (const path of ['presentation.art.scene.hall.environment', 'presentation.art.scene.hall.features[0].position', 'presentation.art.scene.hall.features[0].object']) {
    assert.ok(result.findings.some((f) => f.path === path), 'diagnostic addresses ' + path);
  }
  console.log('  ok — unsupported semantic vocabulary and object bindings fail with paths');
}

function testRoundTripAndBundle() {
  const cart = cartridge();
  const copy = JSON.parse(JSON.stringify(cart));
  assert.deepStrictEqual(copy.presentation.art.scene, cart.presentation.art.scene);
  assert.strictEqual(typeof copy.presentation.art.scene.hall.paint, 'undefined');
  const canvas = ml.bundle.filesFor(cart).machine;
  assert.ok(canvas.indexOf('js/morrowlamp/scene.js') < canvas.indexOf('js/morrowlamp/render.js'));
  const parser = ml.bundle.filesFor(Object.assign({}, cart, { presentation: { interface: 'parser' } })).machine;
  assert.ok(!parser.includes('js/morrowlamp/scene.js'));
  const sources = {};
  for (const file of ml.bundle.allFiles().concat(['js/workshop/validator.js'])) sources[file] = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const html = ml.compiler.compile({ cartridge: cart, sources, allowDataCartridge: true, now: '2026-08-15T12:00:00.000Z' });
  assert.ok(html.includes('<!-- js/morrowlamp/scene.js -->'));
  assert.ok(ml.compiler.inspect(html).selfContained);
  console.log('  ok — semantic scenes survive JSON and only canvas builds ship the adapter');
}

const tests = [testValidatesAndBuilds, testRejectsBadVocabulary, testRoundTripAndBundle];
let failed = 0;
console.log('\nMORROWLAMP — semantic scene contract\n');
for (const test of tests) {
  try { test(); } catch (err) { failed++; console.error('  FAIL — ' + test.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
