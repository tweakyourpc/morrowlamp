/* ============================================================
   THE SUNKEN CROWN, REMASTERED — asset integrity
   The remastered shell trusts its manifests the way the classic
   shell trusts js/scenes.js. This suite is what earns that trust:
   every room names real objects and real exits, every overlay
   switches on a condition the runtime can answer, every voice clip
   still matches a line the cartridge can print, and the whole tier
   stays inside the size budget it promised.

   Pixel contents (the id and depth passes) are WebP and are checked
   at pack time by tools/blender/pack_room.py's round trip, not here.
   Run with:  node test/remastered-manifest.js
   ============================================================ */
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const Z = require('../js/morrowlamp/core.js');
for (const m of ['world', 'profile', 'outcome', 'rules', 'vocabulary', 'stats', 'encounter', 'runtime']) {
  require('../js/morrowlamp/' + m + '.js');
}
require('../js/world.js');
require('../js/cartridges/sunken-crown.js');
require('../js/remastered/voice-key.js');

const ROOT = path.join(__dirname, '..');
const REM = path.join(ROOT, 'remastered');
const cart = Z.cartridges['the-sunken-crown'];
const world = cart.world;
const PASSES = ['beauty', 'albedo', 'normal', 'emit', 'data'];
const CART_SOURCE = fs.readFileSync(path.join(ROOT, 'js/cartridges/sunken-crown.js'), 'utf8');

const KB = 1024;
const BUDGET = { roomArt: 350 * KB, voicePerRoom: 600 * KB, narrator: 8 * KB * KB, whole: 40 * KB * KB, epilogue: 16 * KB * KB };

const size = (file) => fs.statSync(file).size;
const rooms = () => fs.readdirSync(path.join(REM, 'rooms')).filter((d) => fs.existsSync(path.join(REM, 'rooms', d, 'room.json')));
const manifest = (id) => JSON.parse(fs.readFileSync(path.join(REM, 'rooms', id, 'room.json'), 'utf8'));
const exitsOf = (id) => Object.keys(world.rooms[id].exits || {});

function checkTarget(id, room, where) {
  if (id === 'floor') return;
  if (id.startsWith('exit:')) {
    assert.ok(exitsOf(room).includes(id.slice(5)), where + ': ' + id + ' is not an exit of ' + room);
    return;
  }
  assert.ok(world.objects[id], where + ': ' + id + ' is not an object in the cartridge');
}

function checkWhen(when, where) {
  if (when.open) assert.ok(world.objects[when.open], where + ': opens unknown object ' + when.open);
  if (when.in) for (const id of when.in) assert.ok(world.objects[id], where + ': unknown object ' + id);
  if (when.here) assert.ok(world.objects[when.here], where + ': unknown object ' + when.here);
  if (when.flag) assert.ok(CART_SOURCE.includes("'" + when.flag + "'") || CART_SOURCE.includes(when.flag + ':'),
    where + ': flag ' + when.flag + ' is never named by the cartridge');
}

function testRoomsAreRealRooms() {
  const list = rooms();
  assert.ok(list.length > 0, 'at least one room is remastered');
  for (const id of list) {
    const m = manifest(id);
    assert.strictEqual(m.room, id, id + '/room.json names itself');
    assert.ok(world.rooms[id], id + ' is a room in the cartridge');
    assert.strictEqual(m.camera.matrix.length, 16, id + ' has a camera matrix');
    assert.ok(m.camera.fov > 10 && m.camera.fov < 120, id + ' has a sane field of view');
    assert.ok(typeof m.exposure === 'number', id + ' records the exposure its passes were encoded with');
  }
  console.log('  ok — ' + list.length + ' remastered room(s), each a real room with a camera');
}

function testEveryPassIsShipped() {
  for (const id of rooms()) {
    const m = manifest(id);
    for (const p of PASSES) assert.ok(fs.existsSync(path.join(REM, 'rooms', id, m.passes[p])), id + ' ships ' + m.passes[p]);
    for (const v of m.variants) {
      for (const p of PASSES) assert.ok(fs.existsSync(path.join(REM, 'rooms', id, v.passes[p])), id + ' ships ' + v.passes[p]);
      const [x, y, w, h] = v.rect;
      assert.ok(x >= 0 && y >= 0 && x + w <= m.size[0] && y + h <= m.size[1], id + ' variant ' + v.id + ' fits the frame');
    }
  }
  console.log('  ok — every pass and overlay a manifest names is on disk');
}

function testHotspotsNameRealThings() {
  for (const id of rooms()) {
    const m = manifest(id);
    for (const name of Object.values(m.ids)) checkTarget(name, id, id + ' id pass');
    for (const key of Object.keys(m.walkTo)) checkTarget(key, id, id + ' walkTo');
    for (const z of m.zones) {
      checkTarget(z.id, id, id + ' zone');
      if (z.when) checkWhen(z.when, id + ' zone ' + z.id);
      if (z.fromHotspot) assert.ok(Object.values(m.ids).includes(z.fromHotspot), id + ' zone ' + z.id + ' borrows a real hotspot');
    }
    for (const v of m.variants) checkWhen(v.when || {}, id + ' variant ' + v.id);
    /* Every passable exit needs something to click. */
    const clickable = new Set(Object.values(m.ids).concat(m.zones.map((z) => z.id)));
    for (const dir of exitsOf(id)) {
      const exit = world.rooms[id].exits[dir];
      if (exit && typeof exit === 'object' && exit.room === null) continue;
      assert.ok(clickable.has('exit:' + dir), id + ' has no clickable way ' + dir);
    }
  }
  console.log('  ok — hotspots, stand points, zones and overlay conditions all name real objects and exits');
}

function testThePlayerStandsOnTheFloor() {
  const inside = (r, x, z) => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3];
  for (const id of rooms()) {
    const m = manifest(id);
    for (const [name, p] of Object.entries(m.points).concat(Object.entries(m.walkTo))) {
      assert.ok(inside(m.walk.area, p[0], p[2]), id + ' ' + name + ' stands inside the walkable area');
      for (const b of m.walk.blocks) assert.ok(!inside(b, p[0], p[2]), id + ' ' + name + ' does not stand inside furniture');
    }
  }
  console.log('  ok — every entry and stand point is on walkable floor');
}

function testVoiceMatchesTheScript() {
  const voiceDir = path.join(REM, 'voice');
  const index = JSON.parse(fs.readFileSync(path.join(voiceDir, 'index.json'), 'utf8'));
  const casting = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/voice/voices.json'), 'utf8'));
  const script = JSON.parse(execFileSync('node', [path.join(ROOT, 'tools/morrow.js'), 'strings',
    path.join(ROOT, 'js/cartridges/sunken-crown.js'), '--json'], { encoding: 'utf8', maxBuffer: 16 * KB * KB })).lines;
  const live = new Set(script.map((l) => l.key));

  /* The device voice speaks from index.script, so it must be the script. */
  assert.deepStrictEqual(Object.keys(index.script).sort(), Array.from(live).sort(), 'voice/index.json lists exactly the current script');
  assert.ok(index.narrators[index.default], 'the default narrator ' + index.default + ' is recorded');

  const keysOf = {};
  let clips = 0;
  for (const [id, n] of Object.entries(index.narrators)) {
    assert.ok(casting.narrators[id], id + ' is cast in voices.json');
    const lines = JSON.parse(fs.readFileSync(path.join(voiceDir, n.lines), 'utf8'));
    let bytes = 0;
    for (const [key, line] of Object.entries(lines)) {
      assert.ok(live.has(key), id + ' clip ' + key + ' is stale: no current line has that text');
      const file = path.join(voiceDir, id, line.file);
      assert.ok(fs.existsSync(file), id + ' clip ' + line.file + ' is on disk');
      bytes += size(file);
      if (index.written[key]) assert.notStrictEqual(line.speaker, 'narrator', id + ' reads ' + key + ' in its writer\'s voice');
    }
    assert.strictEqual(n.clips, Object.keys(lines).length, id + ': index.json counts its clips');
    assert.strictEqual(n.bytes, bytes, id + ': index.json knows its size');
    keysOf[id] = Object.keys(lines).sort();
    clips += Object.keys(lines).length;
  }
  /* Changing narrator never silences a line another narrator speaks,
     and no room is text only: every line of the script is recorded. */
  for (const [id, keys] of Object.entries(keysOf)) {
    assert.deepStrictEqual(keys, keysOf[index.default], id + ' records the same lines as ' + index.default);
  }
  const unvoiced = Array.from(live).filter((k) => !keysOf[index.default].includes(k));
  assert.deepStrictEqual(unvoiced.map((k) => index.script[k] + ' ' + k), [], 'every line of the script is recorded');
  for (const [key, writer] of Object.entries(index.written)) {
    assert.ok(live.has(key), 'written line ' + key + ' is in the script');
    assert.ok(casting.writers[writer], 'writer ' + writer + ' is cast in voices.json');
  }
  /* And the browser computes the same key the builder stored. */
  const sample = script.find((l) => keysOf[index.default].includes(l.key));
  if (sample) assert.strictEqual(Z.remastered.voiceKey(sample.text), sample.key, 'voice keys agree');
  console.log('  ok — ' + Object.keys(index.narrators).length + ' narrators, ' + clips + ' clips, none stale; ' +
    Object.keys(index.written).length + ' written lines read by their writers');
}

/* What a player actually downloads: text compressed as any web server
   sends it, images and audio as they are. Measured in 1.44 MB floppies,
   because that was the promise: a first visit on one floppy, the whole
   game, with one narrator, on no more than five. */
function testSizeBudget() {
  const zlib = require('node:zlib');
  const FLOPPY = 1474560;
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const wire = (f) => (/\.(js|css|html|json)$/.test(f) ? zlib.gzipSync(fs.readFileSync(f), { level: 9 }).length : size(f));
  const sum = (files) => files.reduce((n, f) => n + wire(f), 0);
  const floppies = (n) => (n / FLOPPY).toFixed(2);

  const artOf = (id) => walk(path.join(REM, 'rooms', id));
  for (const id of rooms()) {
    const art = artOf(id).filter((f) => f.endsWith('.webp')).reduce((n, f) => n + size(f), 0);
    assert.ok(art <= BUDGET.roomArt, id + ' art is ' + Math.round(art / KB) + ' KB, budget ' + BUDGET.roomArt / KB);
  }

  const voiceDir = path.join(REM, 'voice');
  const index = JSON.parse(fs.readFileSync(path.join(voiceDir, 'index.json'), 'utf8'));
  const clipsOf = (id, room) => {
    const lines = JSON.parse(fs.readFileSync(path.join(voiceDir, id, 'lines.json'), 'utf8'));
    return Object.values(lines).filter((l) => !room || l.room === room)
      .map((l) => path.join(voiceDir, id, l.file)).concat([path.join(voiceDir, id, 'lines.json')]);
  };
  /* A room's own lines are fetched as the player walks in; the shared
     ones ("common") one at a time as they are said, so only rooms have
     a budget. */
  for (const id of Object.keys(index.narrators)) {
    const perRoom = {};
    for (const f of clipsOf(id)) { const r = path.basename(path.dirname(f)); perRoom[r] = (perRoom[r] || 0) + size(f); }
    delete perRoom.common;
    delete perRoom[id];
    for (const [r, n] of Object.entries(perRoom)) assert.ok(n <= BUDGET.voicePerRoom, id + ' ' + r + ' voice is ' + Math.round(n / KB) + ' KB');
  }

  const html = fs.readFileSync(path.join(ROOT, 'remastered.html'), 'utf8');
  const scripts = (html.match(/src="([^"]+)"/g) || []).map((s) => s.slice(5, -1));
  const code = Array.from(new Set(scripts.concat(['css/remastered.css', 'remastered.html', 'remastered/actors/hero.glb',
    'js/vendor/three/three.core.min.js', 'js/vendor/three/three.module.min.js',
    'js/vendor/three/examples/jsm/loaders/GLTFLoader.js', 'js/vendor/three/examples/jsm/utils/BufferGeometryUtils.js'])
    .concat(fs.readdirSync(path.join(ROOT, 'js/remastered')).map((f) => 'js/remastered/' + f)))).map((f) => path.join(ROOT, f));
  const first = sum(code) + sum(artOf('hall')) + sum(clipsOf(index.default, 'hall')) + wire(path.join(voiceDir, 'index.json'));
  assert.ok(first <= FLOPPY, 'a first visit is ' + floppies(first) + ' floppies, promised one');

  /* The game, pictures and code, on five floppies. A narrator is the
     player's choice and is fetched room by room as it is heard, so the
     full recorded script has a budget of its own, like the film. */
  const allArt = rooms().flatMap(artOf);
  const game = sum(code) + sum(allArt) + wire(path.join(voiceDir, 'index.json'));
  assert.ok(game <= 5 * FLOPPY, 'the game is ' + floppies(game) + ' floppies, promised five at most');
  const heaviest = Math.max(...Object.keys(index.narrators).map((id) => sum(clipsOf(id))));
  assert.ok(heaviest <= BUDGET.narrator, 'a narrator\'s whole script is ' + Math.round(heaviest / KB) + ' KB, budget ' + BUDGET.narrator / KB);
  /* The epilogue film is fetched only at the win, so it has a budget of its own. */
  const epilogueDir = path.join(REM, 'epilogue');
  const film = fs.existsSync(epilogueDir) ? walk(epilogueDir).reduce((n, f) => n + size(f), 0) : 0;
  assert.ok(film <= BUDGET.epilogue, 'the epilogue film is ' + Math.round(film / KB) + ' KB, budget ' + BUDGET.epilogue / KB);
  const server = walk(REM).filter((f) => !f.startsWith(epilogueDir + path.sep)).reduce((n, f) => n + size(f), 0) + sum(code);
  assert.ok(server <= BUDGET.whole, 'everything served is ' + Math.round(server / KB) + ' KB');
  console.log('  ok — first visit ' + floppies(first) + ' floppies; ' + rooms().length + ' rooms ' +
    floppies(game) + ', a narrator ' + floppies(heaviest) + '; everything served ' + Math.round(server / KB) + ' KB' + (film ? '; the epilogue film ' + Math.round(film / KB) + ' KB' : ''));
}

/* Every voice the builder casts is credited in the game, with a
   licence and a source, before anyone plays (js/remastered/credits.js). */
function testEveryVoiceIsCredited() {
  const casting = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/voice/voices.json'), 'utf8'));
  const src = fs.readFileSync(path.join(ROOT, 'js/remastered/credits.js'), 'utf8');
  const block = /export const VOICES = \{([\s\S]*?)\n\};/.exec(src);
  assert.ok(block, 'credits.js has a VOICES table');
  const entries = {};
  for (const m of block[1].matchAll(/^  (\w+): \{([\s\S]*?)^  \}/gm)) entries[m[1]] = m[2];
  const cast = Object.keys(casting.narrators).concat(Object.keys(casting.cast || {}));
  for (const id of cast) {
    assert.ok(entries[id], 'voice ' + id + ' is credited in js/remastered/credits.js');
    for (const field of ['model', 'credit', 'data', 'licence', 'link']) assert.ok(new RegExp('\\b' + field + ': [\'\\[]').test(entries[id]), id + ' credit gives its ' + field);
  }
  /* And marketing/credits.txt is the same roll, written from it. */
  execFileSync('node', ['--no-warnings', path.join(ROOT, 'tools/credits.mjs'), '--check'], { stdio: 'pipe' });
  console.log('  ok — ' + cast.length + ' voices, each credited with its data, licence and source; credits.txt matches the roll');
}

/* Chris does not want floating dust or glowing specks anywhere, in the
   shell or in the rooms: twice now they have read as noise, or as a
   watermark. The shell may draw particles only as the Umbra's body, and
   no room builder may scatter glowing fungus or dust motes. */
function testNoDust() {
  for (const f of fs.readdirSync(path.join(ROOT, 'js/remastered'))) {
    if (!f.endsWith('.js') || f === 'creatures.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'js/remastered', f), 'utf8');
    assert.ok(!/new THREE\.Points\b|PointsMaterial/.test(src), 'js/remastered/' + f + ' draws particles (no dust, please)');
  }
  const rooms = path.join(ROOT, 'tools/blender/rooms');
  for (const f of fs.readdirSync(rooms).filter((x) => x.endsWith('.py'))) {
    const src = fs.readFileSync(path.join(rooms, f), 'utf8');
    assert.ok(!/kit\.(sphere|box)\(f"[\w.]*(fungus|mote|dust\.mote|firefl|spark|ember)/i.test(src), f + ' scatters glowing specks (no dust, please)');
  }
  console.log('  ok — no dust: no particles in the shell, no glowing specks in any room');
}

const tests = [testRoomsAreRealRooms, testEveryPassIsShipped, testHotspotsNameRealThings, testThePlayerStandsOnTheFloor,
  testVoiceMatchesTheScript, testEveryVoiceIsCredited, testNoDust, testSizeBudget];
let failed = 0;
console.log('\nTHE SUNKEN CROWN, REMASTERED — asset integrity\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
