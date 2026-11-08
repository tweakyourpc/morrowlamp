/* ============================================================
   REPOSITORY HYGIENE
   Properties of the files themselves rather than of the game:
   that the source is text, that a compiled adventure is text, and
   that nothing local or private has crept into a public tree.

   These are cheap checks for expensive mistakes. A single NUL byte
   in one module made git, grep, GitHub's blob viewer and every diff
   tool treat that module — and every adventure compiled from it —
   as binary, and nothing noticed for eight commits.
   Run with:  node test/hygiene.js
   ============================================================ */
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

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
require('../js/morrowlamp/render.js');
require('../js/workshop/validator.js');
require('../js/workshop/bundle.js');
require('../js/workshop/compiler.js');
require('../js/world.js');
require('../js/cartridges/sunken-crown.js');
require('../js/cartridges/captains-thistle.js');
require('../js/cartridges/sir-crumbly.js');
const ml = Z.ml;

/* Files that are legitimately not text. Anything else claiming to be
   binary is a bug in the file, not an exception to add here. */
const BINARY = [/\.png$/i, /\.jpe?g$/i, /\.gif$/i, /\.ico$/i, /\.woff2?$/i,
  /* the remastered asset tier: Blender passes, voice clips, the hero, source scenes */
  /\.webp$/i, /\.webm$/i, /\.glb$/i, /\.blend$/i];
const isBinary = (file) => BINARY.some((re) => re.test(file));

function tracked() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT })
    .toString('utf8').split('\0').filter(Boolean);
}

/* ---------------- no literal NUL bytes in tracked text ---------------- */
function testSourceIsText() {
  const offenders = [];
  for (const file of tracked()) {
    if (isBinary(file)) continue;
    const bytes = fs.readFileSync(path.join(ROOT, file));
    if (bytes.includes(0)) offenders.push(file);
  }
  assert.deepStrictEqual(offenders, [], 'tracked text files contain literal NUL bytes: ' + offenders.join(', '));
  console.log('  ok — every tracked text file is free of literal NUL bytes (' + tracked().length + ' files)');
}

/* ---------------- and none in anything we ship ----------------
   The compiler inlines module source verbatim, so a control character
   in any bundled file reaches every artifact built from it. Checking
   the source alone would not catch a NUL introduced by the compiler. */
function testArtifactsAreText() {
  const sources = {};
  for (const file of ml.bundle.allFiles().concat(['js/workshop/validator.js'])) {
    sources[file] = fs.readFileSync(path.join(ROOT, file), 'utf8');
  }
  for (const id of ['the-sunken-crown', 'captains-thistle', 'sir-crumbly']) {
    const html = ml.compiler.compile({ cartridge: Z.cartridges[id], sources, now: 'test' });
    assert.ok(!Buffer.from(html, 'utf8').includes(0), id + '.html contains a literal NUL byte');
    console.log('  ok — compiled ' + id + ' is text (' + Buffer.byteLength(html, 'utf8') + ' bytes, no NULs)');
  }
}

/* ---------------- nothing private, nothing local ----------------
   This repository is intended to be published. A local path is merely
   untidy; the rest are things that should never have been in a public
   tree and were removed once already. */
function testNothingPrivate() {
  const FORBIDDEN = [
    [/\b192\.168\.\d+\.\d+/, 'a private LAN address'],
    [/\b10\.\d+\.\d+\.\d+\b/, 'a private LAN address'],
    [/TextStrata/i, 'an internal service name'],
    [/MarkBase/i, 'an internal service name'],
    [/(^|[^\w.])\.codex\b/, 'an agent staging directory'],
    [/\/home\/[a-z]/i, 'an absolute local path'],
    [/\/Users\/[A-Za-z]/, 'an absolute local path'],
    [/\bghp_[A-Za-z0-9]{20,}/, 'a GitHub token'],
    [/\bsk-[A-Za-z0-9]{20,}/, 'an API key'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key']
  ];
  const offenders = [];
  for (const file of tracked()) {
    if (isBinary(file)) continue;
    /* This suite necessarily contains the patterns it searches for. */
    if (file === 'test/hygiene.js') continue;
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    text.split('\n').forEach((line, i) => {
      for (const [pattern, what] of FORBIDDEN) {
        if (pattern.test(line)) offenders.push(file + ':' + (i + 1) + ' — ' + what);
      }
    });
  }
  assert.deepStrictEqual(offenders, [], 'private or local material in a public tree:\n    ' + offenders.join('\n    '));
  console.log('  ok — no private LAN addresses, internal service names, credentials or local paths');
}

const tests = [testSourceIsText, testArtifactsAreText, testNothingPrivate];
let failed = 0;
console.log('\nHYGIENE — the repository is text, and fit to publish\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
