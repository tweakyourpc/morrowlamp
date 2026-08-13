#!/usr/bin/env node
/* ============================================================
   MORROWLAMP — the workbench, from a terminal

     node tools/morrow.js validate <cartridge>
     node tools/morrow.js prove    <cartridge>
     node tools/morrow.js build    <cartridge> [-o out.html]
     node tools/morrow.js play     <cartridge> [--route file] [--command …]

   Everything here is assembly, not new machinery. `compile()` is
   already a pure function of { cartridge, sources }, the validator
   is already pure, and the prover already plays a route on the real
   Machine. This file is the door they were missing: a way to work on
   a cartridge without a browser, with exit codes, so a script — or
   somebody's agent — can iterate on a game and be told, precisely,
   what is wrong with it.

   No dependencies, no package.json, no build step. Node and this
   repository, which is the whole promise of the project.
   ============================================================ */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/* ---------------- the Machine ----------------
   Load order matters and is the bundle manifest's business, but the
   manifest itself is one of the modules, so the floor is laid by hand
   and everything after it comes from `ml.bundle`. */
const Z = require(path.join(ROOT, 'js/morrowlamp/core.js'));
for (const m of ['world', 'profile', 'outcome', 'rules', 'vocabulary', 'stats', 'encounter', 'runtime']) {
  require(path.join(ROOT, 'js/morrowlamp', m + '.js'));
}
require(path.join(ROOT, 'js/workshop/validator.js'));
require(path.join(ROOT, 'js/workshop/bundle.js'));
require(path.join(ROOT, 'js/workshop/compiler.js'));
require(path.join(ROOT, 'js/workshop/prove.js'));
const ml = Z.ml;

/* ---------------- reading a cartridge ----------------
   Two tiers, exactly as the format intends. A developer cartridge is
   JavaScript and may carry painter functions; a Workshop cartridge is
   JSON and cannot. Both are cartridges and neither is a special case. */
function loadCartridge(file) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) die('no such cartridge: ' + file);

  if (/\.json$|\.morrow$/i.test(full)) {
    let data;
    try { data = JSON.parse(fs.readFileSync(full, 'utf8')); }
    catch (err) { die(file + ' is not readable JSON: ' + err.message); }
    if (data.format && data.format !== 'morrowlamp-cartridge') {
      die(file + ' declares format "' + data.format + '"; this is not a Morrowlamp cartridge.');
    }
    const id = (data.meta || {}).id;
    if (id) { Z.cartridges = Z.cartridges || {}; Z.cartridges[id] = data; }
    return data;
  }

  /* A source cartridge registers itself into Z.cartridges when it runs.
     Some carry their world or their art in sibling files; those are
     content, not engine, so load whatever this repository ships before
     asking the cartridge to run. */
  const before = new Set(Object.keys(Z.cartridges || {}));
  try { require(path.join(ROOT, 'js/world.js')); } catch (err) { void err; }
  try { require(full); }
  catch (err) { die('could not load ' + file + ':\n  ' + err.message); }
  const added = Object.keys(Z.cartridges || {}).filter((id) => !before.has(id));
  if (!added.length) die(file + ' loaded but registered no cartridge in Z.cartridges.');
  return Z.cartridges[added[added.length - 1]];
}

/* The Workshop reads its own sources over fetch; here they come off
   disk. Same list, same compiler, so what this builds is what the
   Workshop builds. */
function readSources() {
  const out = {};
  for (const file of ml.bundle.allFiles().concat(['js/workshop/validator.js'])) {
    out[file] = fs.readFileSync(path.join(ROOT, file), 'utf8');
  }
  return out;
}

/* ---------------- commands ---------------- */

function cmdValidate(cartridge, flags) {
  const result = ml.validator.validate(cartridge);
  if (flags.json) {
    print(JSON.stringify({ ok: result.ok, findings: result.findings }, null, 2));
  } else {
    print(ml.validator.report(result));
  }
  return result.ok ? 0 : 1;
}

function cmdProve(cartridge, flags) {
  const check = ml.validator.validate(cartridge);
  if (!check.ok) {
    /* There is no point playing a cartridge that cannot be built. Say
       why, in the validator's words, and stop. */
    print(ml.validator.report(check));
    return 1;
  }
  const result = ml.prove.run(cartridge);
  if (flags.json) {
    print(JSON.stringify({ ok: result.ok, walkthrough: result.walkthrough, findings: result.findings }, null, 2));
  } else {
    print(ml.prove.report(result));
    if (flags.verbose && result.walkthrough.log) {
      print('');
      for (const line of result.walkthrough.log) print(line);
    }
  }
  return result.ok ? 0 : 1;
}

function cmdBuild(cartridge, flags) {
  let html;
  try {
    html = ml.compiler.compile({
      cartridge,
      sources: readSources(),
      /* A JSON cartridge has no source file to embed, so it travels as
         data. A JS one embeds its own source and keeps its painters. */
      allowDataCartridge: true
    });
  } catch (err) {
    print(String(err.message || err));
    return 1;
  }
  const name = flags.out || ml.compiler.filename(cartridge);
  const full = path.resolve(process.cwd(), name);
  fs.writeFileSync(full, html);

  const plan = ml.bundle.filesFor(cartridge);
  if (flags.json) {
    const report = ml.compiler.inspect(html);
    print(JSON.stringify({ ok: report.selfContained, file: full, bytes: html.length, findings: report.findings }, null, 2));
  } else {
    print(ml.compiler.buildLog(cartridge, html, plan));
    print('');
    print('WRITTEN TO ' + full);
  }
  return ml.compiler.inspect(html).selfContained ? 0 : 1;
}

function cmdPlay(cartridge, flags) {
  const check = ml.validator.validate(cartridge);
  if (!check.ok) { print(ml.validator.report(check)); return 1; }

  let route = flags.command.slice();
  if (flags.route) {
    const text = fs.readFileSync(path.resolve(process.cwd(), flags.route), 'utf8');
    route = text.split('\n').map((line) => line.trim()).filter((line) => line && line.charAt(0) !== '#');
  }
  if (!route.length) {
    const declared = ml.prove.routeOf(cartridge);
    if (!declared || !declared.route.length) {
      die('nothing to play: give --route <file>, --command "…", or declare a walkthrough in the cartridge.');
    }
    route = declared.route;
  }

  const rt = ml.runtime.create(cartridge, { random: ml.prove.luckyDice() });
  const log = [];
  print(ml.strings.resolve(cartridge.intro, cartridge.strings) ? String(
    [].concat(ml.strings.resolve(cartridge.intro, cartridge.strings)).join('\n')) : '');
  for (const step of route) {
    ml.prove.resolveEncounters(rt, log);
    for (const line of log.splice(0)) print(line);
    const meta = rt.meta();
    if (meta.dead || meta.win) break;
    print('> ' + step);
    const result = rt.command(step);
    for (const message of result.messages) print('  ' + message.text);
    ml.prove.resolveEncounters(rt, log);
    for (const line of log.splice(0)) print(line);
  }
  const meta = rt.meta();
  print('');
  print('— ' + (meta.win ? 'WON' : meta.dead ? 'DIED' : 'STOPPED') +
    ' in ' + meta.roomName + ', ' + meta.score + ' points, ' + meta.turns + ' turns' +
    (meta.ending ? ', ending "' + meta.ending + '"' : '') + ' —');
  return meta.win ? 0 : 1;
}

const COMMANDS = { validate: cmdValidate, prove: cmdProve, build: cmdBuild, play: cmdPlay };

/* ---------------- argument reading ---------------- */
const USAGE = [
  'MORROWLAMP — the workbench, from a terminal',
  '',
  '  node tools/morrow.js validate <cartridge> [--json]',
  '  node tools/morrow.js prove    <cartridge> [--json] [--verbose]',
  '  node tools/morrow.js build    <cartridge> [-o out.html] [--json]',
  '  node tools/morrow.js play     <cartridge> [--route file] [--command "…"]',
  '',
  'A cartridge is a .js source file or a .json (.morrow) data file.',
  'Every command exits 0 when it is happy and 1 when it is not.',
  '',
  'Examples:',
  '  node tools/morrow.js validate js/cartridges/sunken-crown.js',
  '  node tools/morrow.js prove    js/cartridges/sir-crumbly.js',
  '  node tools/morrow.js build    js/cartridges/captains-thistle.js -o /tmp/thistle.html'
].join('\n');

function parse(argv) {
  const flags = { command: [] };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') flags.json = true;
    else if (arg === '--verbose' || arg === '-v') flags.verbose = true;
    else if (arg === '-o' || arg === '--out') flags.out = argv[++i];
    else if (arg === '--route') flags.route = argv[++i];
    else if (arg === '--command' || arg === '-c') flags.command.push(argv[++i]);
    else if (arg === '-h' || arg === '--help') flags.help = true;
    else if (arg.charAt(0) === '-') die('unknown option ' + arg + '\n\n' + USAGE);
    else rest.push(arg);
  }
  return { flags, rest };
}

function print(text) { process.stdout.write(String(text) + '\n'); }
function die(message) { process.stderr.write(String(message) + '\n'); process.exit(2); }

function main(argv) {
  const { flags, rest } = parse(argv);
  const [name, file] = rest;
  if (flags.help || !name) { print(USAGE); return name ? 0 : 2; }
  const run = COMMANDS[name];
  if (!run) die('unknown command "' + name + '"\n\n' + USAGE);
  if (!file) die(name + ' needs a cartridge.\n\n' + USAGE);
  return run(loadCartridge(file), flags);
}

process.exit(main(process.argv.slice(2)));
