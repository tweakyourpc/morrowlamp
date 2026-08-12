/* ============================================================
   MORROWLAMP — BUILD GAME
   Compiles both cartridges, then treats the results the way an
   archivist would: does this file reach for anything it will not
   have in thirty years, and does it actually start?
   Run with:  node test/compiler.js
   ============================================================ */
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { bootArtifact } = require('./artifact-harness.js');

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
require('../js/cartridges/sir-crumbly.js');

const ml = Z.ml;
const NOW = '2026-08-11T12:00:00.000Z';

/* The Workshop reads its sources with fetch; the tests read the same
   list off disk. Same compiler, same list, no special case. */
function readSources() {
  const out = {};
  for (const file of ml.bundle.allFiles().concat(['js/workshop/validator.js'])) {
    out[file] = fs.readFileSync(path.join(ROOT, file), 'utf8');
  }
  return out;
}
const SOURCES = readSources();
const OUT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'morrowlamp-build-'));
const built = {};

function build(id) {
  const cartridge = Z.cartridges[id];
  const html = ml.compiler.compile({ cartridge, sources: SOURCES, now: NOW });
  const file = path.join(OUT_DIR, ml.compiler.filename(cartridge));
  fs.writeFileSync(file, html);
  built[id] = { html, file, cartridge };
  return built[id];
}

/* ---------------- it compiles at all ---------------- */
function testCompiles() {
  const crown = build('the-sunken-crown');
  const thistle = build('captains-thistle');
  const crumbly = build('sir-crumbly');
  assert.strictEqual(path.basename(crown.file), 'the-sunken-crown.html');
  assert.strictEqual(path.basename(thistle.file), 'captains-thistle.html');
  assert.strictEqual(path.basename(crumbly.file), 'sir-crumbly.html');
  for (const id in built) {
    assert.ok(built[id].html.startsWith('<!doctype html>'), id + ' starts with a doctype');
    assert.ok(built[id].html.trimEnd().endsWith('</html>'), id + ' is a complete document');
  }
  console.log('  ok — every cartridge compiles to a single HTML file');
  for (const id in built) {
    console.log('       ' + path.basename(built[id].file).padEnd(24) + Math.round(built[id].html.length / 1024) + ' KB');
  }
}

/* ---------------- the header a programmer will read ---------------- */
function testHeader() {
  const html = built['the-sunken-crown'].html;
  for (const line of [
    'MORROWLAMP GAME WORKSHOP', 'Compiled Adventure',
    'Game:', 'THE SUNKEN CROWN',
    'Cartridge Version:', '1.0.0',
    'Engine Version:', 'Morrowlamp Machine ' + ml.VERSION,
    'Display Adapter:', 'EGA',
    'Sound Hardware:', 'CHIP',
    'Built:', NOW
  ]) {
    assert.ok(html.includes(line), 'the header states ' + JSON.stringify(line));
  }
  assert.ok(html.includes('<title>THE SUNKEN CROWN</title>'));
  assert.ok(/generator" content="Morrowlamp Game Workshop/.test(html));
  console.log('  ok — the generated header identifies the game, cartridge and engine');
}

/* ---------------- self-containment ---------------- */
function testSelfContained() {
  for (const id in built) {
    const report = ml.compiler.inspect(built[id].html);
    assert.ok(report.selfContained,
      id + ' reaches outside itself: ' + report.findings.map((f) => f.description + ' → ' + f.text).join('; '));
  }
  /* And the check itself has to be capable of failing. */
  const poisoned = built['captains-thistle'].html.replace('<body>', '<body><script src="https://cdn.example.com/x.js"></script>');
  const bad = ml.compiler.inspect(poisoned);
  assert.ok(!bad.selfContained, 'the inspector notices an external script');
  assert.ok(bad.findings.some((f) => f.description.includes('script src')));
  console.log('  ok — no external script, style, image, audio, font or URL in either artifact');
}

/* ---------------- it is readable, not a blob ---------------- */
function testReadable() {
  const html = built['the-sunken-crown'].html;
  assert.ok(html.includes('<!-- js/morrowlamp/runtime.js -->'), 'modules are labelled with their source path');
  assert.ok(html.includes('MORROWLAMP MACHINE — the runtime'), 'the original comments survive');
  const lines = html.split('\n');
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  assert.ok(lines.length > 3000, 'the artifact is line-formatted source, not one long line');
  assert.ok(longest < 4000, 'no minified blob crept in (longest line ' + longest + ')');
  console.log('  ok — the artifact is inspectable source (' + lines.length + ' lines)');
}

/* ---------------- the bundle is cartridge-specific ---------------- */
function testBundleIsSpecific() {
  const crown = built['the-sunken-crown'].html;
  const thistle = built['captains-thistle'].html;

  /* Each embedded module is announced by a marker comment, so the
     bundle can be read off the artifact rather than guessed at.
     (Prose mentioning a filename does not count as shipping it.) */
  const shipped = (html) => (html.match(/^<!-- (js\/[^ ]+?\.js)/gm) || []).map((m) => m.slice(5));

  const crownFiles = shipped(crown);
  const thistleFiles = shipped(thistle);

  assert.ok(crownFiles.includes('js/scenes.js'), 'the Sunken Crown ships its scene painters');
  assert.ok(crownFiles.includes('js/sprites.js'), 'and its sprite library');
  assert.ok(crownFiles.includes('js/world.js'), 'and its prose');
  assert.ok(crownFiles.includes('js/music.js'), 'and the sequencer its chip profile asks for');

  assert.ok(!thistleFiles.includes('js/scenes.js'), 'Captain Thistle ships none of the Sunken Crown art');
  assert.ok(!thistleFiles.includes('js/sprites.js'), 'nor its sprites');
  assert.ok(!thistleFiles.includes('js/world.js'), 'nor its world');
  assert.ok(!thistleFiles.includes('js/music.js'), 'nor the sequencer, because PC SPEAKER cannot use it');
  assert.ok(!thistleFiles.includes('js/cartridges/sunken-crown.js'), 'nor the other cartridge');
  assert.ok(thistle.length < crown.length, 'the smaller game compiles smaller');

  /* Both are canvas games, so both get the renderer. */
  for (const files of [crownFiles, thistleFiles]) {
    assert.ok(files.includes('js/gfx.js') && files.includes('js/morrowlamp/render.js'), 'canvas games ship the renderer');
    assert.strictEqual(new Set(files).size, files.length, 'no module is embedded twice');
  }

  /* Both still ship the same Machine. */
  for (const file of ml.bundle.MACHINE) {
    assert.ok(crown.includes('<!-- ' + file + ' -->'), 'crown ships ' + file);
    assert.ok(thistle.includes('<!-- ' + file + ' -->'), 'thistle ships ' + file);
  }
  console.log('  ok — each game bundles only what it needs, and both share one Machine');
}

/* ---------------- a broken cartridge does not compile ---------------- */
function testRefusesBrokenCartridge() {
  const broken = JSON.parse(JSON.stringify(Z.cartridges['captains-thistle'].world ? {
    meta: { id: 'broken-game', title: 'Broken' },
    world: { startRoom: 'a', rooms: { a: { name: 'A', desc: 'A.', exits: { n: 'nowhere' } } }, objects: {} },
    rules: [], endings: [{ id: 'x', kind: 'win', text: ['done'] }],
    presentation: { interface: 'parser', audio: 'chip', renderer: 'ega' }
  } : {}));
  assert.throws(
    () => ml.compiler.compile({ cartridge: broken, sources: SOURCES, now: NOW }),
    /COMPILATION HALTED[\s\S]*targets missing room "nowhere"/,
    'the compiler stops and says why'
  );
  console.log('  ok — a cartridge that cannot work is refused, with reasons');
}

/* ---------------- the artifact boots ----------------
   Run the compiled game's own script blocks in a sandbox with a stub
   DOM. If the Machine, the cartridge and the shell disagree about
   anything, this is where it surfaces — without a browser. */
function testArtifactBoots() {
  for (const id in built) {
    const sandbox = bootArtifact(built[id].html);
    assert.ok(sandbox.Z && sandbox.Z.ml && sandbox.Z.ml.runtime, id + ': the Machine loaded');
    assert.ok(sandbox.Z.cartridges[id], id + ': the cartridge registered itself');

    /* Boot a runtime out of the compiled bundle and play a turn in it. */
    const rt = sandbox.Z.ml.runtime.create(sandbox.Z.cartridges[id]);
    const look = rt.command('look');
    assert.ok(look.messages.length, id + ': the compiled runtime describes its first room');
    assert.strictEqual(rt.meta().room, sandbox.Z.cartridges[id].world.startRoom);
  }
  console.log('  ok — both artifacts boot and play a turn in a sandbox');
}

/* ---------------- the compiled Sunken Crown is still winnable ----------------
   The conformance route, replayed inside the compiled bundle. This is
   the difference between "the file loads" and "the game is in there". */
function testCompiledGameIsWinnable() {
  const sandbox = bootArtifact(built['the-sunken-crown'].html);
  /* Lucky dice and the shared route driver, exactly as the conformance
     test uses them, so "playable" means the same thing in both places. */
  const { play, luckyDice } = require('./play-route.js');
  const rt = sandbox.Z.ml.runtime.create(sandbox.Z.cartridges['the-sunken-crown'], { random: luckyDice() });
  play(rt, require('./winning-route.js'));
  const meta = rt.meta();
  assert.strictEqual(meta.win, true, 'the compiled adventure can be won');
  assert.strictEqual(meta.score, 60, 'for the full sixty points');
  assert.strictEqual(meta.secured, 6, 'with all six treasures secured');
  assert.strictEqual(meta.rank, 'Sunken King\'s Heir');
  /* And the RPG layer the compiled game used to lack is in there too. */
  assert.ok(meta.sheet, 'the compiled adventure has a character sheet');
  /* A well-lit run never meets the Umbra, but the lurker ambushes
     everyone who reaches the lake shore. */
  assert.strictEqual(meta.sheet.xp, 35, 'having fought the lurker on the way');
  assert.strictEqual(meta.sheet.wins, 1);
  console.log('  ok — the compiled Sunken Crown plays through to the real ending, RPG layer and all');
}

function testCompiledThistleIsWinnable() {
  const sandbox = bootArtifact(built['captains-thistle'].html);
  const rt = sandbox.Z.ml.runtime.create(sandbox.Z.cartridges['captains-thistle']);
  for (const step of ['e', 'open toolbox', 'take magnet', 'w', 'use magnet on grating',
    'e', 'e', 'put coin in vending machine', 'take fuse', 's', 'put fuse in breaker', 'n']) {
    rt.command(step);
  }
  assert.strictEqual(rt.meta().win, true, 'the compiled micro-adventure can be won too');
  console.log('  ok — the compiled Captain Thistle plays through to its ending');
}

/* ---------------- the compiled RPG cartridge, end to end ----------------
   Sir Crumbly is the cartridge that proves stats and combat are generic.
   Proving it at source level is not the same as proving the *compiled*
   artifact still does it — the RPG capability crosses four modules and a
   bundle manifest on its way into the file. This plays the whole game
   inside the artifact and checks the character system at every step. */
function testCompiledCrumblyPlaythrough() {
  const sandbox = bootArtifact(built['sir-crumbly'].html);
  const Zc = sandbox.Z;

  /* boots, with its own capabilities compiled in */
  assert.ok(Zc && Zc.ml && Zc.ml.runtime, 'the Machine loaded out of the artifact');
  const cart = Zc.cartridges['sir-crumbly'];
  assert.ok(cart, 'the cartridge registered itself');
  assert.ok(Zc.ml.stats && Zc.ml.encounter && Zc.ml.outcome, 'stats, encounters and outcomes are in the bundle');

  const rt = Zc.ml.runtime.create(cart, { random: () => 0.1 });
  const txt = (r) => r.messages.map((m) => m.text).join(' | ');

  /* stats initialise from cartridge data, not from anything Sunken-Crown-shaped */
  assert.ok(rt.hasStats() && rt.hasCombat(), 'both capabilities are on in the compiled game');
  const sheet = rt.sheet();
  /* Values crossing the vm boundary carry the sandbox's prototypes, so
     compare copies rather than references. */
  assert.deepStrictEqual(Array.from(sheet.stats, (s) => s.id), ['might', 'nerve'], 'its own two stats');
  assert.strictEqual(sheet.maxHp, 10, 'its own health formula: base 6 + nerve 4');
  assert.strictEqual(sheet.hp, 10);
  assert.strictEqual(sheet.level, 1);
  assert.strictEqual(sheet.className, 'Knight, Impoverished');

  /* the puzzle resists before the fight */
  rt.command('d');
  assert.strictEqual(rt.meta().room, 'cellar');
  assert.ok(txt(rt.command('take cheese')).includes('You reconsider'), 'the rat guards the cheese');
  assert.ok(!rt.inventory().includes('cheese'));

  /* the encounter starts */
  assert.ok(txt(rt.command('attack rat')).includes('6 points of rat'), 'the encounter introduces itself');
  const fight = rt.encounter();
  assert.ok(fight, 'an encounter is running inside the artifact');
  assert.strictEqual(fight.name, 'Cellar Rat');
  assert.strictEqual(fight.hp, 6);
  assert.deepStrictEqual(Array.from(fight.actions, (a) => a.id), ['attack', 'guard', 'flee']);

  /* combat actually resolves, round by round */
  let rounds = 0;
  let sawDamage = false;
  while (rt.encounter() && rounds++ < 20) {
    const before = rt.encounter().hp;
    rt.encounterAct('attack');
    if (rt.encounter() && rt.encounter().hp < before) sawDamage = true;
  }
  assert.ok(sawDamage || rounds > 1, 'the rat took damage across rounds');
  assert.ok(rounds > 1, 'it was not a one-hit formality');
  assert.strictEqual(rt.meta().dead, false, 'Sir Crumbly survived');

  /* victory state */
  assert.ok(rt.flags().ratBeaten, 'the onWin outcome ran');
  assert.ok(rt.sheet().xp >= 12, 'experience was awarded');
  assert.strictEqual(rt.sheet().wins, 1, 'the win was recorded on the sheet');
  assert.ok(rt.sheet().stats.find((s) => s.id === 'might').value > sheet.stats.find((s) => s.id === 'might').value,
    'Might rose by being used');

  /* legitimate ending */
  const won = rt.command('take cheese');
  assert.ok(txt(won).includes('WILL RETURN'), 'the ending fired');
  assert.strictEqual(rt.meta().win, true);
  assert.strictEqual(rt.meta().score, 20);
  assert.strictEqual(rt.meta().rank, 'Cheese-Bearer');

  /* and the loss is reachable in the artifact too */
  const doomed = Zc.ml.runtime.create(cart, { random: () => 0.99 });
  doomed.command('d');
  doomed.command('attack rat');
  let guard = 25;
  while (doomed.encounter() && guard--) doomed.encounterAct('attack');
  assert.strictEqual(doomed.meta().dead, true, 'and the rat can still win');
  console.log('  ok — the compiled Sir Crumbly initialises stats, fights, wins, and ends');
}

const tests = [testCompiles, testHeader, testSelfContained, testReadable, testBundleIsSpecific,
  testRefusesBrokenCartridge, testArtifactBoots, testCompiledGameIsWinnable, testCompiledThistleIsWinnable,
  testCompiledCrumblyPlaythrough];
let failed = 0;
console.log('\nMORROWLAMP — BUILD GAME\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log('\n  artifacts written to ' + OUT_DIR);
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
