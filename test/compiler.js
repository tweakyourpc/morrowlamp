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
const vm = require('node:vm');

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
  assert.strictEqual(path.basename(crown.file), 'the-sunken-crown.html');
  assert.strictEqual(path.basename(thistle.file), 'captains-thistle.html');
  assert.ok(crown.html.startsWith('<!doctype html>'));
  assert.ok(crown.html.trimEnd().endsWith('</html>'));
  console.log('  ok — both cartridges compile to a single HTML file each');
  console.log('       ' + path.basename(crown.file) + '  ' + Math.round(crown.html.length / 1024) + ' KB');
  console.log('       ' + path.basename(thistle.file) + '  ' + Math.round(thistle.html.length / 1024) + ' KB');
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
function stubDom() {
  function makeNode(tag) {
    const node = {
      tagName: String(tag || 'div').toUpperCase(),
      children: [], style: {}, dataset: {}, classList: {
        _set: new Set(),
        add(...c) { c.forEach((x) => node.classList._set.add(x)); },
        remove(...c) { c.forEach((x) => node.classList._set.delete(x)); },
        toggle(c, on) { if (on) node.classList._set.add(c); else node.classList._set.delete(c); },
        contains: (c) => node.classList._set.has(c)
      },
      textContent: '', innerHTML: '', value: '', id: '', className: '',
      appendChild(child) { node.children.push(child); return child; },
      append(...kids) { kids.forEach((k) => node.children.push(k)); },
      remove() {},
      addEventListener() {}, removeEventListener() {},
      focus() {}, click() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }),
      getContext: () => makeContext(),
      width: 0, height: 0
    };
    return node;
  }
  function makeContext() {
    const noop = () => {};
    return {
      imageSmoothingEnabled: false, fillStyle: '', strokeStyle: '', font: '', textAlign: '',
      setTransform: noop, fillRect: noop, strokeRect: noop, clearRect: noop, fillText: noop,
      createPattern: () => ({}), createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: noop, drawImage: noop, save: noop, restore: noop, translate: noop, scale: noop,
      beginPath: noop, rect: noop, clip: noop, fill: noop, stroke: noop, ellipse: noop, arc: noop,
      moveTo: noop, lineTo: noop, closePath: noop
    };
  }
  const head = makeNode('head');
  const body = makeNode('body');
  const document = {
    head, body,
    createElement: makeNode,
    getElementById(id) {
      const walk = (node) => {
        if (node.id === id) return node;
        for (const child of node.children) { const found = walk(child); if (found) return found; }
        return null;
      };
      return walk(body) || walk(head);
    },
    addEventListener() {}, querySelector: () => null
  };
  const sandbox = {
    document,
    window: null,
    location: { protocol: 'http:', href: 'http://localhost/game.html' },
    localStorage: {
      _d: {},
      getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
      setItem(k, v) { this._d[k] = String(v); },
      removeItem(k) { delete this._d[k]; }
    },
    console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    Blob: function () {}, URL: { createObjectURL: () => 'blob:', revokeObjectURL: () => {} },
    Math, Date, JSON, parseInt, parseFloat, isNaN, Object, Array, String, Number, Boolean,
    Error, RegExp, Set, Map, Uint8ClampedArray, Promise
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

function bootArtifact(html) {
  const sandbox = stubDom();
  vm.createContext(sandbox);
  const blocks = [];
  const re = /<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) blocks.push(match[1]);
  const jsonRe = /<script id="morrowlamp-cartridge" type="application\/json">([\s\S]*?)<\/script>/i;
  const jsonMatch = jsonRe.exec(html);
  if (jsonMatch) {
    const node = sandbox.document.createElement('script');
    node.id = 'morrowlamp-cartridge';
    node.textContent = jsonMatch[1];
    sandbox.document.body.appendChild(node);
  }
  for (const block of blocks) {
    vm.runInContext(block.replace(/<\\\/script/g, '</script'), sandbox, { timeout: 15000 });
  }
  return sandbox;
}

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

const tests = [testCompiles, testHeader, testSelfContained, testReadable, testBundleIsSpecific,
  testRefusesBrokenCartridge, testArtifactBoots, testCompiledGameIsWinnable, testCompiledThistleIsWinnable];
let failed = 0;
console.log('\nMORROWLAMP — BUILD GAME\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log('\n  artifacts written to ' + OUT_DIR);
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
