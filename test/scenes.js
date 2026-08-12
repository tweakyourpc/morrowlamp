/* ============================================================
   THE SUNKEN CROWN — scene data integrity
   The 18 painters carry hand-typed object ids, directions and
   coordinates. A typo there is invisible until you click the
   thing in a browser, so check it all here instead.
   Run with:  node test/scenes.js
   ============================================================ */
'use strict';

const assert = require('node:assert');
const Z = require('../js/world.js');
require('../js/engine.js');
require('../js/scenes.js');
require('../js/rpg.js');

const { rooms, objects } = Z.world;
const scenes = Z.scenes.list;
const DIRS = ['n', 's', 'e', 'w', 'u', 'd'];
let failures = 0;
const bad = (m) => { failures++; console.error('  FAIL — ' + m); };

/* ---- 1. every room has a scene, and no scene invents a room ---- */
for (const rid in rooms) {
  if (!scenes[rid]) bad('room "' + rid + '" has no scene painter');
}
for (const sid in scenes) {
  if (!rooms[sid]) bad('scene "' + sid + '" is not a real room');
}

/* ---- 11. art scale stays independent from interaction geometry ---- */
for (const sid in scenes) {
  const sc = scenes[sid];
  const near = Z.scenes.actorScale(sc, 190);
  const far = Z.scenes.actorScale(sc, 140);
  if (!(near > far && near > 0)) bad(sid + ': actor art scale is not depth-aware');
  if (!(Z.scenes.itemScale(sc, 190) > 0)) bad(sid + ': item art scale is not positive');
}

/* ---- 2. hotspots must name real objects that can actually be there ---- */
const HOME_ROOMS = {};   // objId -> rooms it can legitimately appear in
for (const rid in rooms) HOME_ROOMS[rid] = new Set();

for (const sid in scenes) {
  const sc = scenes[sid];
  for (const s of (sc.spots || [])) {
    if (!objects[s.id]) { bad(sid + ': hotspot "' + s.id + '" is not a world object'); continue; }
    if (!Array.isArray(s.walkTo) || s.walkTo.length !== 2) {
      bad(sid + '/' + s.id + ': walkTo must be [x, y]');
      continue;
    }
    const [wx, wy] = s.walkTo;
    if (!Z.scenes.inWalk(sc, wx, wy)) {
      bad(sid + '/' + s.id + ': walkTo (' + wx + ',' + wy + ') is outside the walkable floor');
    }
    if (!s.icon && (s.w === undefined || s.h === undefined)) {
      bad(sid + '/' + s.id + ': scenery hotspot needs w and h');
    }
  }
}

/* ---- 3. exits must match the room's real exits ---- */
for (const sid in scenes) {
  const sc = scenes[sid];
  const roomExits = rooms[sid].exits || {};
  for (const e of (sc.exits || [])) {
    if (!DIRS.includes(e.dir)) { bad(sid + ': exit dir "' + e.dir + '" is not a compass direction'); continue; }
    if (!(e.dir in roomExits)) {
      bad(sid + ': scene has exit "' + e.dir + '" but the room does not');
      continue;
    }
    const target = roomExits[e.dir];
    const rid = typeof target === 'string' ? target : target.room;
    // A deny-only exit is fine to click — it should answer with flavour
    // rather than move you — but it must actually have something to say.
    if (!rid && !(target && target.deny)) {
      bad(sid + ': exit "' + e.dir + '" leads nowhere and has no deny message');
    }
    if (!Array.isArray(e.walkTo) || !Z.scenes.inWalk(sc, e.walkTo[0], e.walkTo[1])) {
      bad(sid + ': exit "' + e.dir + '" walkTo is outside the walkable floor');
    }
    // a gated exit must name the same flag the engine checks
    const need = typeof target === 'object' ? (target.flagReq || target.guardReq) : null;
    if (need && e.needs !== need) {
      bad(sid + '/' + e.dir + ': scene needs "' + e.needs + '" but the engine checks "' + need + '"');
    }
  }
  // every passable room exit should be reachable by clicking
  for (const d of DIRS) {
    const t = roomExits[d];
    if (!t) continue;
    const rid = typeof t === 'string' ? t : t.room;
    if (!rid) continue;                    // deny-only flavour exit, fine
    if (!(sc.exits || []).some((e) => e.dir === d)) {
      bad(sid + ': room exit "' + d + '" -> ' + rid + ' has no clickable zone');
    }
  }
}

/* ---- 4. entry points land on walkable floor ---- */
for (const sid in scenes) {
  const sc = scenes[sid];
  // every scene needs a "start" spot: restoring a save has no travel
  // direction to place the actor by, and the room centre is often scenery
  if (!sc.entry || !sc.entry.start) bad(sid + ': missing an entry.start position');
  for (const k in (sc.entry || {})) {
    const p = sc.entry[k];
    if (!Z.scenes.inWalk(sc, p[0], p[1])) {
      bad(sid + ': entry "' + k + '" (' + p + ') is off the walkable floor');
    }
  }
}

/* ---- 5. every takeable object is obtainable somewhere ---- */
const spotted = new Set();
for (const sid in scenes) for (const s of (scenes[sid].spots || [])) spotted.add(s.id);
for (const id in objects) {
  const o = objects[id];
  if (!o.takeable) continue;
  if (id === 'lantern' || id === 'note') continue;    // start inventory
  if (!spotted.has(id)) bad('takeable object "' + id + '" has no hotspot in any scene');
}

/* ---- 6. the six treasures are all clickable ---- */
for (const t of Z.world.treasures) {
  if (!spotted.has(t)) bad('treasure "' + t + '" cannot be clicked anywhere');
}

/* ---- 7. scale bands are sane ---- */
for (const sid in scenes) {
  const sc = scenes[sid];
  if (!sc.scale) continue;
  const [y0, s0, y1, s1] = sc.scale;
  if (y1 <= y0) bad(sid + ': scale band y1 must exceed y0');
  if (s0 <= 0 || s1 <= 0 || s0 > s1) bad(sid + ': scale must grow with depth');
}

/* ---- 8. music tracks exist ---- */
const TRACK_NAMES = ['title', 'manor', 'under', 'lake', 'throne', 'combat', 'lullaby', 'victory'];
for (const sid in scenes) {
  const m = scenes[sid].music;
  if (m && !TRACK_NAMES.includes(m)) bad(sid + ': unknown music track "' + m + '"');
}

/* ---- 9. dark scenes agree with the world's dark rooms ---- */
for (const rid in rooms) {
  const sc = scenes[rid];
  if (!sc) continue;
  if (!!rooms[rid].dark !== !!sc.dark) {
    bad(rid + ': room.dark=' + !!rooms[rid].dark + ' but scene.dark=' + !!sc.dark);
  }
}

/* ---- 10. the RPG layer stays winnable: no stat gates ---- */
const a = Z.rpg.begin('scholar');
assert.ok(a.hp > 0 && a.maxHp > 0, 'avatar starts alive');
assert.ok(Z.rpg.xpFor(2) > 0, 'xp curve is positive');
const before = a.stats.lore;
for (let i = 0; i < 60; i++) Z.rpg.use('lore', 1);
assert.ok(a.stats.lore > before, 'stats rise with use');
assert.ok(a.stats.lore <= 100, 'stats stay capped at 100');

console.log(failures
  ? '\n' + failures + ' scene problem(s) found'
  : 'All scene data checks passed (' + Object.keys(scenes).length + ' scenes).');
process.exit(failures ? 1 : 0);
