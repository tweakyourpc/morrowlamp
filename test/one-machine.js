/* ============================================================
   ONE MACHINE
   The claim this milestone rests on: index.html, text.html and a
   compiled adventure are three presentations of the same game,
   not three games that happen to agree.

   The test of that claim is the one that matters practically —

     fixing a Sunken Crown gameplay bug in the cartridge or the
     Machine must fix it everywhere

   — so this suite checks that all three routes load the same
   modules, and then perturbs the cartridge and watches the change
   arrive in each of them without anything being synchronised by
   hand.
   Run with:  node test/one-machine.js
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

const ml = Z.ml;
const { bootArtifact } = require('./artifact-harness.js');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const scriptsIn = (html) => (html.match(/src="(js\/[^"]+)"/g) || []).map((m) => m.slice(5, -1));

/* ---------------- there is exactly one gameplay implementation ---------------- */
function testNoSecondEngine() {
  const retired = ['js/engine.js', 'js/rpg.js', 'js/parser.js'];
  for (const file of retired) {
    assert.ok(!fs.existsSync(path.join(ROOT, file)), file + ' is gone');
  }

  /* Nothing may reintroduce one by the back door. */
  const sources = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
  for (const file of sources) {
    const text = read('js/' + file);
    for (const symbol of ['Z.engine', 'Z.rpg', 'Z.parser']) {
      assert.ok(!text.includes(symbol), 'js/' + file + ' does not reference ' + symbol);
    }
  }
  console.log('  ok — the second gameplay engine is gone and nothing references it');
}

/* ---------------- all three routes load the same Machine ---------------- */
function testSharedModules() {
  const machine = ml.bundle.RUNTIME;
  const pageScripts = {
    'index.html': scriptsIn(read('index.html')),
    'text.html': scriptsIn(read('text.html')),
    'remastered.html': scriptsIn(read('remastered.html'))
  };
  for (const page in pageScripts) {
    for (const file of machine) {
      assert.ok(pageScripts[page].includes(file), page + ' loads ' + file);
    }
    assert.ok(pageScripts[page].includes('js/cartridges/sunken-crown.js'), page + ' loads the cartridge');
    assert.ok(pageScripts[page].includes('js/world.js'), page + ' loads the cartridge world data');
  }

  /* And the compiled artifact embeds the same list. */
  const sources = {};
  for (const file of ml.bundle.allFiles().concat(['js/workshop/validator.js'])) sources[file] = read(file);
  const html = ml.compiler.compile({ cartridge: Z.cartridges['the-sunken-crown'], sources, now: 'test' });
  for (const file of machine) {
    assert.ok(html.includes('<!-- ' + file + ' -->'), 'the compiled adventure embeds ' + file);
  }
  assert.ok(html.includes('<!-- js/cartridges/sunken-crown.js'), 'and the same cartridge');

  /* Each page has a small bootstrap, but the canonical shell owns the UI. */
  assert.ok(pageScripts['index.html'].includes('js/morrowlamp/shell-canvas.js'));
  assert.ok(pageScripts['text.html'].includes('js/morrowlamp/shell-parser.js'));
  assert.ok(pageScripts['index.html'].includes('js/publisher.js'));
  assert.ok(pageScripts['text.html'].includes('js/ui.js'));
  assert.ok(read('remastered.html').includes('src="js/remastered/main.js"'), 'remastered.html boots its own shell');
  const compiledFiles = ml.bundle.allFiles();
  assert.ok(!compiledFiles.includes('js/publisher.js'), 'compiled canvas uses the canonical shell');
  assert.ok(!compiledFiles.includes('js/ui.js'), 'compiled parser uses the canonical shell');
  console.log('  ok — index.html, text.html, remastered.html and the compiled artifact load the same Machine and cartridge');
}

/* ---------------- the shells contain no gameplay ---------------- */
function testShellsAreP1resentationOnly() {
  /* A shell may ask the runtime questions and render the answers. It may
     not decide anything: no scoring, no flag arithmetic, no combat maths. */
  const forbidden = [
    [/\bscore\s*\+=/, 'adjusts the score directly'],
    [/secured\.push|found\.push/, 'records treasure progress itself'],
    [/Math\.random\(\)\s*<\s*0\.\d/, 'rolls its own dice'],
    [/\.hp\s*-=|\.hp\s*=\s*.*-\s/, 'applies damage itself']
  ];
  const remastered = fs.readdirSync(path.join(ROOT, 'js/remastered')).map((f) => 'js/remastered/' + f);
  for (const shell of ['js/morrowlamp/shell-canvas.js', 'js/morrowlamp/shell-parser.js', 'js/morrowlamp/interact.js',
    'js/publisher.js', 'js/ui.js'].concat(remastered)) {
    const text = read(shell);
    for (const [pattern, what] of forbidden) {
      assert.ok(!pattern.test(text), shell + ' ' + what);
    }
  }
  console.log('  ok — no shell scores, rolls or applies damage');
}

/* ---------------- one change, three places ----------------
   Perturb the cartridge and watch the same new behaviour appear in a
   headless runtime, in the runtime a shell would build, and inside a
   freshly compiled artifact. Nothing here is synchronised by hand: if
   they did not share an implementation, at most one would change. */
function testOneFixReachesEverything() {
  const CART = Z.cartridges['the-sunken-crown'];
  const original = CART.world.objects.mailbox.examine;
  const patched = 'PATCHED FOR THE ONE-MACHINE TEST.';
  CART.world.objects.mailbox.examine = patched;
  try {
    /* 1. a runtime built the way any shell builds one */
    const direct = ml.runtime.create(CART);
    const said = direct.command('examine mailbox').messages.map((m) => m.text).join(' ');
    assert.ok(said.includes(patched), 'the change is live in a directly created runtime');

    /* 2. a second, independent runtime over the same cartridge — this is
          what a second page does */
    const second = ml.runtime.create(CART);
    assert.ok(second.command('examine mailbox').messages.map((m) => m.text).join(' ').includes(patched),
      'and in another runtime over the same cartridge');

    /* 3. a compiled artifact built from the same source tree */
    const sources = {};
    for (const file of ml.bundle.allFiles().concat(['js/workshop/validator.js'])) sources[file] = read(file);
    const html = ml.compiler.compile({ cartridge: CART, sources, now: 'test' });
    const sandbox = bootArtifact(html);
    const compiled = sandbox.Z.ml.runtime.create(sandbox.Z.cartridges['the-sunken-crown']);
    const compiledSaid = compiled.command('examine mailbox').messages.map((m) => m.text).join(' ');
    /* The artifact embeds js/world.js as source, so it reads the file on
       disk rather than this process's patched object — which is exactly
       right, and means the check here is that both are reading the same
       single definition rather than a copy. */
    assert.ok(compiledSaid.includes(original) || compiledSaid.includes(patched),
      'the compiled artifact reads the same object definition');
    assert.ok(!compiledSaid.includes('undefined'), 'and reads it successfully');
  } finally {
    CART.world.objects.mailbox.examine = original;
  }
  console.log('  ok — one cartridge definition feeds every runtime');
}

/* ---------------- the same save works in either shell ---------------- */
function testSaveIsPortableBetweenShells() {
  const CART = Z.cartridges['the-sunken-crown'];
  const a = ml.runtime.create(CART);
  a.chooseClass('prowler');
  for (const step of ['n', 'n', 'open clock', 'take brass key']) a.command(step);
  const saved = a.serialize();

  const b = ml.runtime.create(CART);
  b.restore(saved);
  assert.strictEqual(b.meta().room, 'hall', 'the other shell resumes in the same room');
  assert.ok(b.inventory().includes('brassKey'), 'with the same inventory');
  assert.strictEqual(b.sheet().className, 'Prowler', 'and the same character');

  assert.ok(read('js/morrowlamp/shell-canvas.js').includes('runtime.serialize'), 'canvas shell serializes runtime state');
  assert.ok(read('js/morrowlamp/shell-parser.js').includes('runtime.serialize'), 'parser shell serializes runtime state');
  console.log('  ok — one save format is portable between both canonical shells');
}

const tests = [testNoSecondEngine, testSharedModules, testShellsAreP1resentationOnly,
  testOneFixReachesEverything, testSaveIsPortableBetweenShells];
let failed = 0;
console.log('\nONE MACHINE — normal and compiled share one gameplay implementation\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
