/* ============================================================
   THE SUNKEN CROWN, REMASTERED — the shell
   Presentation only, like every Morrowlamp shell: it phrases clicks
   as commands through ml.interact, hands them to the one Machine,
   and shows what comes back. It never scores, rolls or decides.

   Rooms with Blender passes are shown on the relit stage with the
   3D hero walking in them; rooms not remastered yet fall back to
   their EGA painters, so the whole game is playable here today.
   ============================================================ */
import { createStage, blobTexture } from './stage.js';
import { createCreatures } from './creatures.js';
import { loadRoom, activeVariants, holds } from './room.js';
import { createVoice } from './voice.js';
import { createScore } from './score.js';
import { MOODS, tensionOf } from './moods.js';
import { AUTHOR, AUTHOR_LINKS, VOICES, ROLL } from './credits.js';

const Z = window.Z;
const ml = Z.ml;
const ROOT = 'remastered/';
const IMG_W = 1280, IMG_H = 800, EGA_SCALE = 4;
const SPEED = 1.45;              // metres per second; matches the Walk clip's stride
const SMALL_ITEM_RADIUS = 14;    // px: a key on a shelf is 14x7 at this distance

const cart = Z.cartridges['the-sunken-crown'];
const presentation = cart.presentation || {};
const art = ml.render.artOf(cart);
const runtime = ml.runtime.create(cart);
// ?score=chip plays the classic chip score, for comparing the two.
const chipScore = new URLSearchParams(location.search).get('score') === 'chip';
const score = chipScore ? null : createScore(Z);
const sound = ml.sound.create({ profile: presentation.audio, score });
sound.attach(runtime);
const voice = createVoice(ROOT, { duck: (ms) => sound.duck(ms) });

const VERBS = [
  { id: 'walk', label: 'Walk', key: '1', icon: 'M5 20l3-7 3 2v5M8 13l2-6 4 2 2 4M12 4.5a1.5 1.5 0 1 0 0-.01' },
  { id: 'look', label: 'Look', key: '2', icon: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  { id: 'hand', label: 'Hand', key: '3', icon: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v8c0 4-3 7-6 7s-5-2-6-4l-2-4a1.5 1.5 0 0 1 2.6-1.5L8 15' },
  { id: 'talk', label: 'Talk', key: '4', icon: 'M4 5h16v10H9l-5 4V5z' },
  { id: 'attack', label: 'Attack', key: '5', icon: 'M14.5 4l5.5 0 0 5.5-9 9-2-2-2 2-2-2 2-2-2-2 9-8.5z' }
];

/* ---------------- DOM ---------------- */
const $ = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const svgIcon = (d) => {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', d);
  s.appendChild(p);
  return s;
};

const app = document.getElementById('rm-app');
const top = $('header', 'rm-top');
const brand = $('div', 'rm-brand');
brand.append($('b', null, 'THE SUNKEN CROWN'), $('span', null, 'remastered'));
const status = $('div', 'rm-status');
const tools = $('div', 'rm-tools');
const button = (label, title, fn) => {
  const b = $('button', 'rm-btn', label);
  b.title = title;
  b.addEventListener('click', () => { sound.unlock(); fn(b); });
  tools.appendChild(b);
  return b;
};
top.append(brand, status, tools);

const stageWrap = $('div', 'rm-stagewrap');
const stage = $('div', 'rm-stage');
const glCanvas = $('canvas', 'rm-gl');
const egaCanvas = $('canvas', 'rm-ega');
egaCanvas.hidden = true;
const hover = $('div', 'rm-hover');
const roomName = $('div', 'rm-roomname');
const subs = $('div', 'rm-subs');
const badge = $('div', 'rm-badge', 'EGA · not yet remastered');
badge.hidden = true;
const fade = $('div', 'rm-fade on');
const fight = $('div', 'rm-fight');
fight.hidden = true;
stage.append(glCanvas, egaCanvas, hover, roomName, subs, badge, fight, fade);
stageWrap.appendChild(stage);

const dock = $('nav', 'rm-dock');
const verbBox = $('div', 'rm-verbs');
const verbButtons = {};
for (const v of VERBS) {
  const b = $('button', 'rm-verb');
  b.append(svgIcon(v.icon), $('span', null, v.label), $('kbd', null, v.key));
  b.addEventListener('click', () => setVerb(v.id));
  verbButtons[v.id] = b;
  verbBox.appendChild(b);
}
const inv = $('div', 'rm-inv');
dock.append(verbBox, inv);

const log = $('aside', 'rm-log');
log.hidden = true;
const logBody = $('div', 'rm-logbody');
const cmd = $('form', 'rm-cmd');
const cmdInput = $('input');
cmdInput.placeholder = 'Type a command…';
cmdInput.autocomplete = 'off';
cmd.append(cmdInput, $('button', 'rm-btn', 'Do'));
log.append(logBody, cmd);

const sheet = $('aside', 'rm-sheet');
sheet.hidden = true;

app.append(top, stageWrap, dock, log, sheet);

/* ---------------- state ---------------- */
let verb = 'walk';
let held = null;
let room = null;              // remastered room, or null for the EGA fallback
let asleep = null;            // a remastered room still shown in retro, waiting to be woken
let egaScene = null;
let egaG = null;
let lastClick = null;         // [px, py, walkKey] of the last stage click, where a reveal starts

/* ---------------- rooms wake as you play them ----------------
   A room first appears as its retro picture. The first thing the
   player does there that changes the world (takes, opens, uses,
   talks, solves, finds) wakes it into the rendered room, dissolving
   outward from where they acted. Woken rooms stay woken, so the
   look of a room says whether you have made your mark on it yet. */
const PREFS = 'morrowlamp:remastered:';
const pref = (k, d) => { try { const v = localStorage.getItem(PREFS + k); return v === null ? d : v; } catch (e) { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(PREFS + k, v); } catch (e) { /* private window */ } };
let wakeAsYouPlay = pref('wake', '1') === '1';
let retro = pref('retro', 'ega');
const woken = new Set();
// Not 'character': examining things nudges the hero's stats, and looking should not count.
const MEANINGFUL = ['objects', 'flags', 'inventory', 'score', 'encounter'];
runtime.on('reset', () => woken.clear());
let path = [];
let pending = null;
let heroYaw = 0;
const hero = { x: 0, z: 0 };

const three = createStage(glCanvas, { heroUrl: ROOT + 'actors/hero.glb', onFrame: tick });
const creatures = createCreatures(three, blobTexture);
runtime.on('encounterWon', () => creatures.act('die'));
runtime.on('encounterFled', () => creatures.act('leave'));
const { THREE } = three;

/* ---------------- walking ---------------- */
function inside(r, x, z, pad = 0) { return x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad; }

function clampWalk(x, z) {
  const walk = room.manifest.walk;
  const a = walk.area;
  x = Math.max(a[0], Math.min(a[1], x));
  z = Math.max(a[2], Math.min(a[3], z));
  for (const b of walk.blocks) {
    if (!inside(b, x, z, 0.25)) continue;
    const exits = [[b[0] - 0.26, z], [b[1] + 0.26, z], [x, b[2] - 0.26], [x, b[3] + 0.26]]
      .filter(([px, pz]) => inside(a, px, pz) && !walk.blocks.some((o) => inside(o, px, pz, 0.25)));
    if (!exits.length) continue;
    exits.sort((p, q) => Math.hypot(p[0] - x, p[1] - z) - Math.hypot(q[0] - x, q[1] - z));
    [x, z] = exits[0];
  }
  return [x, z];
}

function segmentHits(b, ax, az, bx, bz) {
  for (let i = 1; i < 24; i++) {
    const t = i / 24;
    if (inside(b, ax + (bx - ax) * t, az + (bz - az) * t, 0.22)) return true;
  }
  return false;
}

/* Straight line, or one detour round the corner of whatever is in the way. */
function route(tx, tz) {
  const [x, z] = clampWalk(tx, tz);
  const blocks = room.manifest.walk.blocks;
  const blocker = blocks.find((b) => segmentHits(b, hero.x, hero.z, x, z));
  if (!blocker) return [[x, z]];
  const corners = [[blocker[0] - 0.3, blocker[2] - 0.3], [blocker[1] + 0.3, blocker[2] - 0.3],
    [blocker[0] - 0.3, blocker[3] + 0.3], [blocker[1] + 0.3, blocker[3] + 0.3]]
    .filter(([cx, cz]) => !blocks.some((b) => segmentHits(b, hero.x, hero.z, cx, cz) || segmentHits(b, cx, cz, x, z)));
  if (!corners.length) return [[x, z]];
  corners.sort((p, q) => (Math.hypot(p[0] - hero.x, p[1] - hero.z) + Math.hypot(p[0] - x, p[1] - z)) -
    (Math.hypot(q[0] - hero.x, q[1] - hero.z) + Math.hypot(q[0] - x, q[1] - z)));
  return [corners[0], [x, z]];
}

function walkTo(point, then) {
  pending = then || null;
  if (!room || !point) { path = []; finishWalk(); return; }
  path = route(point[0], point[2] !== undefined ? point[2] : point[1]);
  three.play('Walk');
}

function finishWalk() {
  three.play('Idle', 0.25);
  const next = pending;
  pending = null;
  if (next) next();
}

function tick(dt, t) {
  creatures.update(dt, t);
  if (path.length) {
    const [tx, tz] = path[0];
    const dx = tx - hero.x, dz = tz - hero.z;
    const d = Math.hypot(dx, dz);
    const step = SPEED * dt;
    if (d <= step) {
      hero.x = tx; hero.z = tz;
      path.shift();
      if (!path.length) finishWalk();
    } else {
      hero.x += dx / d * step;
      hero.z += dz / d * step;
      heroYaw = turnToward(heroYaw, Math.atan2(dx, dz), dt * 9);
    }
  }
  three.hero.root.position.set(hero.x, 0, hero.z);
  three.hero.root.rotation.y = heroYaw;
}

function turnToward(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}

/* Arriving by a direction means facing along it: north is into the
   picture, away from the camera. */
const ARRIVAL_YAW = { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 };

function placeHero(point, via) {
  path = [];
  if (!point) return;
  [hero.x, hero.z] = clampWalk(point[0], point[2]);
  heroYaw = ARRIVAL_YAW[via] !== undefined ? ARRIVAL_YAW[via] : 0;
}

/* ---------------- what is under the pointer ---------------- */
function exitSpot(dir) {
  const check = runtime.exits().find((e) => e.dir === dir);
  if (!check) return null;
  return { kind: 'exit', dir, ok: check.ok, label: ml.interact.exitLabel(cart, dir, check), walkKey: 'exit:' + dir };
}

function objectSpot(id) {
  if (!id || id === 'floor' || !runtime.visibleObjects().some((o) => o.id === id)) return null;
  const info = runtime.describeObject(id);
  return info ? { kind: 'object', id, label: info.name, walkKey: id } : null;
}

function remasteredSpots(px, py) {
  const found = { object: null, exit: null, floor: false };
  const s = room.sample(px, py);
  const id = s && s.id;
  if (id && id.startsWith('exit:')) found.exit = exitSpot(id.slice(5));
  else found.object = objectSpot(id);
  if (id === 'floor') found.floor = true;
  for (const z of room.manifest.zones || []) {
    if (z.when && !holds(z.when, runtime)) continue;
    const hit = z.rect ? (px >= z.rect[0] && px <= z.rect[0] + z.rect[2] && py >= z.rect[1] && py <= z.rect[1] + z.rect[3])
      : z.fromHotspot === id;
    if (hit) found.exit = found.exit || exitSpot(z.id.slice(5));
  }
  /* Small loose things are hard to hit; look a little way around. */
  if (!found.object || !runtime.describeObject(found.object.id).takeable) {
    let best = null;
    for (let r = 3; r <= SMALL_ITEM_RADIUS && !best; r += 3) {
      for (let a = 0; a < 12 && !best; a++) {
        const q = room.sample(px + Math.cos(a / 12 * 6.283) * r, py + Math.sin(a / 12 * 6.283) * r);
        const spot = q && objectSpot(q.id);
        if (spot && runtime.describeObject(spot.id).takeable) best = spot;
      }
    }
    if (best) found.object = best;
  }
  return found;
}

function egaSpots(px, py) {
  const x = px / EGA_SCALE, y = py / EGA_SCALE;
  const found = { object: null, exit: null, floor: false };
  if (!egaScene) return found;
  const flags = runtime.flags();
  const within = (r) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
  for (const s of egaScene.spots || []) {
    if (s.onlyIf && !flags[s.onlyIf]) continue;
    const rect = s.w && s.h ? [s.x, s.y, s.w, s.h] : [s.x - 11, s.y - 11, 22, 22];
    if (within(rect)) found.object = objectSpot(s.id) || found.object;
  }
  for (const e of egaScene.exits || []) {
    if (e.needs && !flags[e.needs]) continue;
    if (within([e.x, e.y, e.w, e.h])) found.exit = exitSpot(e.dir) || found.exit;
  }
  return found;
}

/* Same tie-break as the classic shell: walking means the exit, any
   other verb (or an item in hand) means the thing itself. */
function hitTest(px, py) {
  const f = room ? remasteredSpots(px, py) : egaSpots(px, py);
  const objectFirst = !!held || verb !== 'walk';
  const spot = objectFirst ? (f.object || f.exit) : (f.exit || f.object);
  return { spot, floor: f.floor };
}

function stagePoint(event) {
  const r = stage.getBoundingClientRect();
  return [(event.clientX - r.left) / r.width * IMG_W, (event.clientY - r.top) / r.height * IMG_H];
}

stage.addEventListener('mousemove', (event) => {
  const [px, py] = stagePoint(event);
  const { spot } = hitTest(px, py);
  hover.textContent = spot ? (held ? 'Use ' + nameOf(held) + ' on ' + spot.label : spot.label) : '';
  hover.style.left = (event.clientX - stage.getBoundingClientRect().left) + 'px';
  hover.style.top = (event.clientY - stage.getBoundingClientRect().top) + 'px';
  stage.classList.toggle('pointing', !!spot);
});
stage.addEventListener('mouseleave', () => { hover.textContent = ''; });
stage.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  if (held) { held = null; renderInventory(); return; }
  const i = VERBS.findIndex((v) => v.id === verb);
  setVerb(VERBS[(i + 1) % VERBS.length].id);
});
stage.addEventListener('click', (event) => {
  sound.unlock();
  if (fade.classList.contains('on')) return;
  const [px, py] = stagePoint(event);
  const { spot, floor } = hitTest(px, py);
  lastClick = [px, py, spot ? spot.walkKey : null];
  const holding = held;
  const action = ml.interact.commandFor(runtime, presentation, spot, verb, holding);
  if (ml.interact.usesHeld(action, holding)) { held = null; renderInventory(); }
  if (action && action._speech) { openSpeech(action._speech); return; }
  if (action) {
    const target = room && room.manifest.walkTo[spot.walkKey];
    const reach = verb === 'hand' || !!holding;
    walkTo(target, () => {
      if (reach && room) { three.play('Reach', 0.15); setTimeout(() => three.play('Idle', 0.3), 700); }
      run(action);
    });
    return;
  }
  if (!spot && verb === 'walk' && !held && room) {
    const p = three.floorAt(px, py);
    if (p && (floor || p.z < 4)) walkTo([p.x, 0, p.z]);
  }
});

/* ---------------- the clock that keeps your time ----------------
   The grandfather clock stopped at 9:41. Once the player winds it (the
   Machine sets clockRunning), its face shows the player's own time: drawn
   live over the render, where the room's manifest says the dial is, and
   painted by the EGA scene in a retro room. Presentation only: the Machine
   knows the clock is going, the shell knows what time it is. */
function drawClockFace(ctx, size, at, dim) {
  const r = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(r, r);
  ctx.fillStyle = dim ? '#c3bdb0' : '#efe6d0';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a2420';
  for (let h = 0; h < 12; h++) {
    const a = h / 12 * Math.PI * 2;
    ctx.lineWidth = size * 0.022;
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * r * 0.7, -Math.cos(a) * r * 0.7);
    ctx.lineTo(Math.sin(a) * r * 0.86, -Math.cos(a) * r * 0.86);
    ctx.stroke();
  }
  const mins = at.getMinutes() + at.getSeconds() / 60;
  const hours = (at.getHours() % 12) + mins / 60;
  ctx.lineCap = 'round';
  for (const [turns, len, w] of [[hours / 12, 0.48, 0.06], [mins / 60, 0.74, 0.04]]) {
    const a = turns * Math.PI * 2;
    ctx.lineWidth = size * w;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(a) * r * len, -Math.cos(a) * r * len); ctx.stroke();
  }
  ctx.fillStyle = '#2a2420';
  ctx.beginPath(); ctx.arc(0, 0, size * 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

let live = null;
function setLive() {
  if (live) {
    three.scene.remove(live.mesh);
    live.mesh.geometry.dispose(); live.mesh.material.dispose(); live.tex.dispose();
    live = null;
  }
  const spec = room && room.manifest.live && room.manifest.live.clock;
  if (!spec) return;
  const THREE = three.THREE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(spec.radius, 48), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  mesh.position.set(spec.at[0], spec.at[1], spec.at[2]);   // the dial faces the room, along +z
  mesh.renderOrder = 2;
  three.scene.add(mesh);
  live = { mesh, canvas, tex, spec };
  updateLive();
}

function updateLive() {
  if (live) {
    const on = holds(live.spec.when, runtime);
    live.mesh.visible = on;
    if (on) { drawClockFace(live.canvas.getContext('2d'), 256, new Date(), true); live.tex.needsUpdate = true; }
  }
  // The EGA hall paints its own clock: repaint while it is going, so the hands move.
  if (!room && egaScene && runtime.flags().clockRunning && egaScene === art.scene('hall') && !document.querySelector('.rm-over')) paintEga();
}
setInterval(updateLive, 500);

/* ---------------- the turn ---------------- */
function run(action) {
  const before = runtime.meta().room;
  voice.stop();
  let result;
  if (action._text !== undefined) result = runtime.command(action._text);
  else {
    const clean = Object.assign({}, action);
    delete clean._walkTo;
    delete clean._text;
    result = runtime.perform(clean);
  }
  if (result.meta.clear) logBody.textContent = '';
  present(result.messages);
  if (result.meta.saveRequest !== undefined && result.meta.saveRequest !== null) saveGame(result.meta.saveRequest);
  if (result.meta.loadRequest !== undefined && result.meta.loadRequest !== null) loadGame(result.meta.loadRequest);
  const after = runtime.meta().room;
  if (after !== before) enterRoom(after, action.verb === 'move' ? action.text : null);
  else if (!wakeIfMeaningful(result)) refresh();
  updateMood();
  if (result.meta.win) showEnd('win');
  else if (result.meta.dead) showEnd('death');
}

/* The chip score has no tension layer; the remastered one listens. */
function roomMusic(id) {
  const music = MOODS[id] || (room && room.manifest.music) || (egaScene && egaScene.music) || art.music;
  if (music) sound.music(music);
}

function updateMood() {
  if (score) score.setTension(tensionOf(runtime, lanternState(), runtime.meta().room));
}

let subsTimer = 0;
function present(messages) {
  const spoken = [];
  let arrived = false;
  for (const m of messages) {
    if (!m.text && m.text !== 0) { logBody.appendChild($('p', 'gap')); continue; }
    logBody.appendChild($('p', m.cls || '', m.text));
    if (m.cls === 'room-name') { showRoomName(m.text); arrived = true; continue; }
    if (m.cls === 'dim' || m.cls === 'info') continue;
    spoken.push(m);
  }
  logBody.scrollTop = logBody.scrollHeight;
  if (!spoken.length) {
    // A room you have seen before has nothing new to say; the last room's words go.
    if (arrived) { voice.stop(); hideSubsSoon(0); }
    return;
  }

  subs.textContent = '';
  for (const m of spoken) {
    const writer = voice.writerOf(m.text);
    subs.appendChild($('p', ((m.cls || '') + (writer ? ' written ' + writer : '')).trim(), m.text));
  }
  subs.classList.add('on');
  let voiced = 0;
  spoken.forEach((m, i) => {
    if (voice.say(m.text, { onEnd: () => { if (i === spoken.length - 1) hideSubsSoon(1500); } })) voiced++;
  });
  clearTimeout(subsTimer);
  if (!voiced) hideSubsSoon(2500 + spoken.reduce((n, m) => n + m.text.length, 0) * 45);
}
function hideSubsSoon(ms) {
  clearTimeout(subsTimer);
  subsTimer = setTimeout(() => subs.classList.remove('on'), ms);
}

let nameTimer = 0;
function showRoomName(text) {
  roomName.textContent = text;
  roomName.classList.add('on');
  clearTimeout(nameTimer);
  nameTimer = setTimeout(() => roomName.classList.remove('on'), 2600);
}

/* ---------------- rooms ---------------- */
async function enterRoom(id, via) {
  fade.classList.add('on');
  hover.textContent = '';
  creatures.clear();
  path = []; pending = null;
  const [next] = await Promise.all([loadRoom(ROOT, id), new Promise((r) => setTimeout(r, 350))]);
  if (runtime.meta().room !== id) return;      // the player moved on while it loaded
  const awake = next && (!wakeAsYouPlay || woken.has(id));
  room = awake ? next : null;
  asleep = awake ? null : next;
  egaScene = art.scene(id);
  voice.prefetch(id);
  if (room) {
    room.compose(activeVariants(room, runtime));
    three.setRoom(room);
    const points = room.manifest.points;
    placeHero(points[via] || points.start || [0, 0, 0], via);
  } else {
    three.setRoom(null);
  }
  setLive();
  egaCanvas.hidden = !!room;
  badge.hidden = !!room || !!asleep;   // a sleeping room keeps its secret
  badge.textContent = ml.render.PROFILES[retro].name + ' · not yet remastered';
  stage.classList.toggle('ega', !room);
  roomMusic(id);
  updateMood();
  refresh();
  fade.classList.remove('on');
}

/* A room with nothing to change (the porch) says wake: "look" in its
   manifest, and wakes the first time the player handles anything there. */
function wakeIfMeaningful(result) {
  if (!asleep || !result || !result.changed) return false;
  const changedWorld = result.changed.some((c) => MEANINGFUL.includes(c));
  const touched = asleep.manifest.wake === 'look' && result.action && result.action.target;
  if (!changedWorld && !touched) return false;
  wake(asleep);
  return true;
}

/* Swap the retro picture for the rendered room underneath, then eat the
   retro picture away in dithered blocks, outward from the player's
   click, with a gold edge where the two meet. */
function wake(next) {
  const id = runtime.meta().room;
  woken.add(id);
  const snap = $('canvas', 'rm-wake');
  snap.width = IMG_W;
  snap.height = IMG_H;
  const sc = snap.getContext('2d');
  sc.imageSmoothingEnabled = false;
  sc.drawImage(egaCanvas, 0, 0, IMG_W, IMG_H);
  stage.insertBefore(snap, hover);

  asleep = null;
  room = next;
  room.compose(activeVariants(room, runtime));
  three.setRoom(room);
  setLive();
  const points = room.manifest.points;
  const key = lastClick && lastClick[2];
  placeHero((key && room.manifest.walkTo[key]) || points.start || [0, 0, 0], null);
  egaCanvas.hidden = true;
  stage.classList.remove('ega');
  refresh();
  sound.play('chime');

  const CELL = 8;
  const cols = IMG_W / CELL, rows = IMG_H / CELL;
  const [ox, oy] = lastClick ? lastClick : [IMG_W / 2, IMG_H / 2];
  const far = Math.max(Math.hypot(ox, oy), Math.hypot(IMG_W - ox, oy), Math.hypot(ox, IMG_H - oy), Math.hypot(IMG_W - ox, IMG_H - oy));
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const when = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = Math.hypot(x * CELL + CELL / 2 - ox, y * CELL + CELL / 2 - oy) / far;
      when[y * cols + x] = d * 0.82 + (BAYER[(y & 3) * 4 + (x & 3)] / 16) * 0.18;
    }
  }
  const gone = new Uint8Array(cols * rows);
  const DURATION = 1600;
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / DURATION);
    const eased = p * p * (3 - 2 * p);
    for (let i = 0; i < when.length; i++) {
      if (gone[i]) continue;
      const x = (i % cols) * CELL, y = Math.floor(i / cols) * CELL;
      if (when[i] <= eased) { sc.clearRect(x, y, CELL, CELL); gone[i] = 1; }
      else if (when[i] <= eased + 0.035) { sc.fillStyle = 'rgba(255, 214, 140, 0.55)'; sc.fillRect(x, y, CELL, CELL); }
    }
    if (p < 1) requestAnimationFrame(step);
    else snap.remove();
  };
  requestAnimationFrame(step);
}

function paintEga() {
  if (!egaG || egaG.adapter.id !== retro) egaG = ml.render.create(egaCanvas, { profile: retro });
  const g = egaG;
  g.clear(g.C.black);
  const m = runtime.meta();
  if (egaScene && egaScene.paint) egaScene.paint(g, runtime.flags());
  if (egaScene && art.item) {
    for (const s of egaScene.spots || []) {
      if (s.icon && objectSpot(s.id)) art.item(g, s.id, (s.iconAt || [s.x, s.y])[0], (s.iconAt || [s.x, s.y])[1], art.itemScale(egaScene, s.y));
    }
  }
  const fight = runtime.encounter();
  if (fight && art.opponent) art.opponent(g, fight.id, 232, 168, { hurt: fight.hp < fight.maxHp * 0.4, round: fight.round });
  if (egaScene && egaScene.fg) egaScene.fg(g, runtime.flags(), 0);
  if (m.dark && !m.hasLight) {
    g.clear(g.C.black);
    g.ctx.fillStyle = g.C.ltgray;
    g.ctx.font = '10px monospace';
    g.ctx.textAlign = 'center';
    g.ctx.fillText('IT IS PITCH BLACK', g.W / 2, g.H / 2);
  }
}

function lanternState() {
  const m = runtime.meta();
  const fuel = runtime.profile.light.fuel;
  const id = fuel && fuel.object;
  const info = id ? runtime.describeObject(id) : null;
  const carried = info && runtime.inventory().includes(id);
  const warnAt = fuel && fuel.warnings && fuel.warnings[0] && fuel.warnings[0][0];
  return {
    on: !!(carried && info.lit) || (m.dark && m.hasLight),
    low: !!(carried && info.lit && warnAt !== undefined && m.fuel !== null && m.fuel <= warnAt),
    pitchBlack: m.dark && !m.hasLight
  };
}

/* ---------------- chrome ---------------- */
function setVerb(id) {
  verb = id;
  held = null;
  for (const k in verbButtons) verbButtons[k].classList.toggle('on', k === verb);
  renderInventory();
}

function nameOf(id) { return (runtime.describeObject(id) || {}).name || id; }

function itemIcon(id) {
  if (!art.item) return null;
  const c = document.createElement('canvas');
  c.width = c.height = 26;
  const ig = ml.render.create(c, { profile: 'ega', resize: false });
  art.item(ig, id, 13, 13, 1);
  return c;
}

function renderInventory() {
  inv.textContent = '';
  const items = runtime.inventory();
  if (!items.length) { inv.appendChild($('span', 'rm-empty', 'You carry nothing.')); return; }
  for (const id of items) {
    const b = $('button', 'rm-item' + (held === id ? ' held' : ''));
    const icon = itemIcon(id);
    if (icon) b.appendChild(icon);
    b.appendChild($('span', null, nameOf(id)));
    b.addEventListener('click', () => {
      sound.unlock();
      const action = ml.interact.commandForItem(id, verb, held);
      if (action) { if (action.with) held = null; run(action); return; }
      held = held === id ? null : id;
      renderInventory();
    });
    inv.appendChild(b);
  }
}

function renderStatus() {
  const m = runtime.meta();
  const bits = [m.roomName];
  if (runtime.profile.score.enabled) bits.push(m.score + ' pts');
  if (runtime.profile.treasures.enabled) bits.push(m.secured + '/' + m.treasures + ' regalia');
  if (m.fuel !== null && m.fuel !== undefined) bits.push('oil ' + m.fuel);
  status.textContent = bits.join('  ·  ');
}

function renderSheet() {
  const s = runtime.hasStats() ? runtime.sheet() : null;
  sheet.textContent = '';
  if (!s) return;
  sheet.appendChild($('h2', null, s.className + ' · level ' + s.level));
  const meter = (label, v, max, cls) => {
    const row = $('div', 'rm-meter ' + (cls || ''));
    const bar = $('i');
    bar.style.width = Math.max(0, Math.min(100, v / (max || 1) * 100)) + '%';
    row.append($('span', null, label), $('div', 'rm-bar'), $('b', null, v + ' / ' + max));
    row.children[1].appendChild(bar);
    return row;
  };
  sheet.appendChild(meter('Health', s.hp, s.maxHp, 'hp'));
  sheet.appendChild(meter('Experience', s.xp, s.xp + s.xpToNext, 'xp'));
  const ul = $('ul');
  for (const st of s.stats) { const li = $('li'); li.append($('span', null, st.name), $('b', null, String(st.value))); ul.appendChild(li); }
  sheet.appendChild(ul);
}

function renderEncounter() {
  const f = runtime.encounter();
  fight.hidden = !f;
  if (!f) return;
  fight.textContent = '';
  const head = $('div', 'rm-fight-head');
  head.append($('b', null, f.name), $('span', null, 'Round ' + f.round + '  ·  ' + f.hp + ' / ' + f.maxHp));
  fight.appendChild(head);
  const acts = $('div', 'rm-fight-acts');
  for (const a of f.actions) {
    const b = $('button', 'rm-btn', a.label);
    b.disabled = !a.enabled;
    if (!a.enabled && a.deny) b.title = a.deny;
    b.addEventListener('click', () => {
      sound.unlock();
      const hpBefore = f.hp;
      const r = runtime.encounterAct(a.id);
      actOutRound(a, hpBefore, r);
      present(r.messages);
      if (!wakeIfMeaningful(r)) refresh();
      updateMood();
      if (r.meta.win) showEnd('win');
      else if (r.meta.dead) showEnd('death');
    });
    acts.appendChild(b);
  }
  fight.appendChild(acts);
}

function refresh() {
  if (room && room.compose(activeVariants(room, runtime))) three.refreshTextures();
  if (!room) paintEga();
  updateLive();
  three.setLantern(lanternState());
  renderInventory();
  renderStatus();
  renderSheet();
  renderEncounter();
  syncCreature();
}

/* ---------------- whatever is fighting you ----------------
   The runtime fights; the stage only shows it. A creature comes on
   when an encounter starts, flinches when the numbers say it was hurt,
   lunges when the fight goes on, and dies or slinks off when the
   runtime says the fight is over. */
function syncCreature() {
  const f = runtime.encounter();
  if (!room) { creatures.clear(); return; }
  if (f && creatures.showing() !== f.id) {
    const at = creatureSpot();
    creatures.spawn(f.id, at, [hero.x, 0, hero.z]);
    path = [];
    heroYaw = Math.atan2(at[0] - hero.x, at[2] - hero.z);
  } else if (!f && creatures.showing() && !creatures.ending()) creatures.clear();
}

/* Where a room says its creature waits, or a step ahead of the hero;
   never hidden behind the hero from where the camera stands. */
function creatureSpot() {
  const p = room.manifest.points.creature;
  let x = p ? p[0] : hero.x + (hero.x > 0 ? -1.1 : 1.1);
  let z = p ? p[2] : hero.z - 1.3;
  if (z < hero.z && Math.abs(x - hero.x) < 1.0) x = hero.x + (hero.x > 0 ? -1.3 : 1.3);
  [x, z] = clampWalk(x, z);
  return [x, 0, z];
}

function actOutRound(action, hpBefore, result) {
  if (!room) return;
  if (action.kind === 'strike') { three.play('Reach', 0.12); setTimeout(() => three.play('Idle', 0.3), 650); }
  const after = runtime.encounter();
  if (after && after.hp < hpBefore) creatures.act('hurt');      // a win or a flee arrives as its own event
  if (after || result.meta.dead) setTimeout(() => creatures.act('attack'), 420);
}

/* ---------------- tools ---------------- */
const SAVE_KEY = 'morrowlamp:' + (cart.meta.id || 'game') + ':';   // shared with index.html's slots
function saveGame(slot) {
  try {
    localStorage.setItem(SAVE_KEY + (slot || 1), JSON.stringify({
      cartridge: cart.meta.id, version: cart.meta.version, engine: ml.VERSION, savedAt: Date.now(), state: runtime.serialize(),
      remastered: { woken: Array.from(woken) }     // the classic shells read only `state`
    }));
    present([{ text: 'Game saved to slot ' + (slot || 1) + '.', cls: 'info' }]);
  } catch (err) { present([{ text: 'This browser will not keep saves for this page.', cls: 'info' }]); }
}
function loadGame(slot) {
  try {
    const raw = localStorage.getItem(SAVE_KEY + (slot || 1));
    if (!raw) { present([{ text: 'Slot ' + (slot || 1) + ' is empty.', cls: 'info' }]); return; }
    const data = JSON.parse(raw);
    if (data.cartridge !== cart.meta.id) { present([{ text: 'That save belongs to a different game.', cls: 'info' }]); return; }
    resume(data.state, (data.remastered && data.remastered.woken) || Object.keys(JSON.parse(data.state).visited || {}));
  } catch (err) { present([{ text: 'That save could not be read.', cls: 'info' }]); }
}

/* ---------------- carrying on ----------------
   Every turn is saved in this browser, so a refresh carries on where the
   player was; a death is not saved over, so refreshing after one goes
   back to the move before it. A save code is the same game written out
   (ml.savecode), to carry to another browser or keep on paper. */
const AUTO_KEY = SAVE_KEY + 'auto';
function autosave() {
  const m = runtime.meta();
  try {
    if (m.win) { localStorage.removeItem(AUTO_KEY); return; }
    if (m.dead) return;
    localStorage.setItem(AUTO_KEY, JSON.stringify({
      cartridge: cart.meta.id, version: cart.meta.version, savedAt: Date.now(), state: runtime.serialize(),
      remastered: { woken: Array.from(woken) }
    }));
  } catch (err) { /* a private window keeps nothing; the game still plays */ }
}
function autosaved() {
  try {
    const data = JSON.parse(localStorage.getItem(AUTO_KEY) || 'null');
    return data && data.cartridge === cart.meta.id && data.state ? data : null;
  } catch (err) { return null; }
}
// After the shell has finished with the turn, so the rooms it woke are kept too.
runtime.on('turn', () => queueMicrotask(autosave));
runtime.on('reset', () => { try { localStorage.removeItem(AUTO_KEY); } catch (err) { /* nothing kept */ } });

/* Put a whole game in place: from the autosave, a slot or a code. */
async function resume(state, wokenRooms) {
  runtime.restore(state);
  woken.clear();
  for (const id of wokenRooms || []) woken.add(id);
  logBody.textContent = '';
  await voice.ready;
  await three.ready;
  present(runtime.describeRoom(runtime.meta().room, true));
  await enterRoom(runtime.meta().room, null);
  renderStatus();
  renderInventory();
  autosave();
}

function saveCode() {
  try { return { code: ml.savecode.encode(cart, runtime.serialize()) }; } catch (err) { return { why: err.message }; }
}

function showGameMenu() {
  overlay((card, close) => {
    card.classList.add('game-menu');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Game');
    card.append($('h1', null, 'Game'),
      $('p', 'note', 'Your game is saved in this browser after every move, so closing or refreshing the page carries on where you were.'));

    card.appendChild($('h2', null, 'Your save code'));
    const made = saveCode();
    if (made.code) {
      const code = $('p', 'rm-code', made.code);
      code.setAttribute('aria-label', 'Save code ' + made.code.split('').join(' '));
      const copy = $('button', 'rm-btn ghost', 'Copy');
      copy.type = 'button';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(made.code); copy.textContent = 'Copied'; } catch (err) { copy.textContent = 'Select it and copy'; }
      });
      card.append(code, $('p', 'note', 'Write it down to carry on later, in any browser. Letters and numbers only; dashes, spaces and case do not matter.'), copy);
    } else card.appendChild($('p', 'note', 'No code right now: ' + made.why + '.'));

    card.appendChild($('h2', null, 'Carry on from a code'));
    const form = $('form', 'rm-code-form');
    const field = $('input');
    field.autocomplete = 'off';
    field.spellcheck = false;
    field.setAttribute('aria-label', 'Save code');
    field.placeholder = 'XXXX-XXXX-XXXX';
    const go = $('button', 'rm-btn', 'Load');
    const said = $('p', 'note error');
    said.setAttribute('role', 'status');
    form.append(field, go);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      let state;
      try { state = ml.savecode.decode(cart, field.value); } catch (err) { said.textContent = 'That did not work: ' + err.message + '.'; field.focus(); return; }
      close();
      await resume(state, Object.keys(state.visited || {}));
      present([{ text: 'Carrying on from your code.', cls: 'info' }]);
    });
    card.append(form, said);

    card.appendChild($('h2', null, 'Start again'));
    const restart = $('button', 'rm-btn ghost', 'Restart the game');
    restart.type = 'button';
    const sure = $('div', 'rm-confirm');
    sure.hidden = true;
    const yes = $('button', 'rm-btn', 'Yes, start again');
    const no = $('button', 'rm-btn ghost', 'Keep playing');
    for (const b of [yes, no]) b.type = 'button';
    sure.append($('p', 'note', 'This game ends here. Keep its code first if you want to come back to it.'), yes, no);
    restart.addEventListener('click', () => { restart.hidden = true; sure.hidden = false; no.focus(); });
    no.addEventListener('click', () => { sure.hidden = true; restart.hidden = false; restart.focus(); });
    yes.addEventListener('click', () => {
      close();
      document.removeEventListener('keydown', esc);
      logBody.textContent = '';
      run({ verb: 'restart' });
      showTitle();
    });
    card.append(restart, sure);

    card.appendChild($('h2', null, 'Saved games'));
    const slots = $('div', 'rm-row');
    const save = $('button', 'rm-btn ghost', 'Save to slot 1');
    const load = $('button', 'rm-btn ghost', 'Load slot 1');
    for (const b of [save, load]) b.type = 'button';
    save.addEventListener('click', () => { saveGame(1); close(); document.removeEventListener('keydown', esc); });
    load.addEventListener('click', () => { close(); document.removeEventListener('keydown', esc); loadGame(1); });
    slots.append(save, load);
    card.append(slots, $('p', 'note', 'Slot 1 is shared with the classic edition.'));

    const done = $('button', 'rm-btn', 'Close');
    done.type = 'button';
    const esc = (event) => { if (event.key === 'Escape') done.click(); };
    done.addEventListener('click', () => { document.removeEventListener('keydown', esc); close(); });
    document.addEventListener('keydown', esc);
    card.appendChild(done);
    requestAnimationFrame(() => done.focus({ preventScroll: true }));
  });
}

button('Undo', 'Take back the last move', () => run({ verb: 'undo' }));
button('Game', 'Your save code, restart, and saved games', () => showGameMenu());
const vBtn = button('Voice', 'Choose the narrator', () => overlay((card, close) => {
  card.append($('h1', null, 'Who tells the story?'), narratorPicker());
  const done = $('button', 'rm-btn', 'Done');
  done.addEventListener('click', () => { voice.stop(); close(); });
  card.appendChild(done);
}));
const mBtn = button('Music on', 'Music and effects', (b) => { sound.setEnabled(!sound.isEnabled()); b.textContent = sound.isEnabled() ? 'Music on' : 'Music off'; b.classList.toggle('off', !sound.isEnabled()); });
button('Text', 'Transcript and typed commands (L)', () => toggleLog());
button('Hero', 'Character sheet (C)', () => { sheet.hidden = !sheet.hidden; });
/* Debugging aid: show every rendered room at once, woken or not. Woken
   rooms stay woken either way; switching back puts the rest to sleep. */
const modernLabel = () => (wakeAsYouPlay ? 'Rooms: wake' : 'Rooms: modern');
const modernBtn = button(modernLabel(), 'Force rendered graphics in every room, before you have woken it', (b) => {
  setWakeAsYouPlay(!wakeAsYouPlay);
  b.textContent = modernLabel();
  if (!fade.classList.contains('on')) enterRoom(runtime.meta().room, null);
});
function setWakeAsYouPlay(on) {
  wakeAsYouPlay = on;
  setPref('wake', on ? '1' : '0');
  modernBtn.textContent = modernLabel();
  modernBtn.classList.toggle('on', !on);
}
modernBtn.classList.toggle('on', !wakeAsYouPlay);
const classic = $('a', 'rm-btn', 'Classic');
classic.href = 'index.html';
classic.title = 'The original EGA edition';
tools.appendChild(classic);
void vBtn; void mBtn;

/* ---------------- the narrator ---------------- */
/* A line to audition a narrator with: this room's description if it is
   in the script, otherwise the Entrance Hall's. */
function sampleLine() {
  for (const id of [runtime.meta().room, 'hall']) {
    const line = runtime.describeRoom(id, true).find((m) => m.text && voice.has(m.text));
    if (line) return line.text;
  }
  return null;
}

function sizeLabel(bytes) {
  return bytes > 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB';
}

function narratorPicker() {
  const list = $('div', 'rm-narrators');
  const rows = [];
  const mark = () => { for (const r of rows) r.el.classList.toggle('on', r.id === voice.narrator()); };
  for (const c of voice.choices()) {
    const row = $('button', 'rm-narrator');
    row.type = 'button';
    const head = $('b', null, c.label);
    const blurb = $('span', null, c.blurb || '');
    row.append(head, blurb);
    if (c.kind === 'recorded' && c.bytes) row.appendChild($('em', null, sizeLabel(c.bytes) + ' recorded so far'));
    row.addEventListener('click', async () => {
      sound.unlock();
      await voice.setNarrator(c.id);
      mark();
      vBtn.classList.toggle('off', !voice.isEnabled());
      const text = sampleLine();
      if (text) voice.say(text);
    });
    rows.push({ id: c.id, el: row });
    list.appendChild(row);
  }
  mark();
  return list;
}

function toggleLog(force) {
  log.hidden = force !== undefined ? !force : !log.hidden;
  if (!log.hidden) { logBody.scrollTop = logBody.scrollHeight; cmdInput.focus(); }
}

cmd.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = cmdInput.value.trim();
  cmdInput.value = '';
  if (!text) return;
  logBody.appendChild($('p', 'typed', '> ' + text));
  run({ _text: text });
});

document.addEventListener('keydown', (event) => {
  if (event.target === cmdInput) { if (event.key === 'Escape') toggleLog(false); return; }
  if (document.querySelector('.rm-over')) return;
  const v = VERBS.find((x) => x.key === event.key);
  if (v) { setVerb(v.id); return; }
  if (event.key === 'Escape') { held = null; renderInventory(); }
  if (event.key === 'Tab') { event.preventDefault(); const i = VERBS.findIndex((x) => x.id === verb); setVerb(VERBS[(i + 1) % VERBS.length].id); }
  if (event.key === 'l' || event.key === 'L' || event.key === 'Enter') { event.preventDefault(); toggleLog(true); }
  if (event.key === 'c' || event.key === 'C') sheet.hidden = !sheet.hidden;
});

/* A cheat for seeing the ending without winning: the Konami code
   (up up down down left right left right B A) plays the epilogue film
   and the listing, then puts you back in the game where you were. */
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konami = 0;
document.addEventListener('keydown', (event) => {
  if (event.target === cmdInput || document.querySelector('.rm-film-over')) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  // A third Up still leaves the first two counted, so a fumbled start does not reset it.
  konami = key === KONAMI[konami] ? konami + 1 : (key === KONAMI[0] ? (konami === 2 ? 2 : 1) : 0);
  if (konami < KONAMI.length) return;
  konami = 0;
  sound.unlock();
  playEpilogue(() => roomMusic(runtime.meta().room));
});

/* ---------------- overlays ---------------- */
function overlay(build) {
  const over = $('div', 'rm-over');
  const card = $('div', 'rm-card');
  build(card, () => over.remove());
  over.appendChild(card);
  app.appendChild(over);
  return over;
}

function openSpeech(config) {
  overlay((card, close) => {
    card.append($('h1', null, config.heading || 'Speak'), $('p', null, config.prompt || 'What do you say?'));
    const form = $('form', 'rm-cmd');
    const field = $('input');
    field.autocomplete = 'off';
    form.append(field, $('button', 'rm-btn', config.submit || 'Say it'));
    const cancel = $('button', 'rm-btn ghost', 'Cancel');
    cancel.addEventListener('click', close);
    card.append(form, cancel);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = field.value.trim();
      if (!value) return;
      close();
      run({ _text: (config.verb || 'say') + ' ' + value });
    });
    field.focus();
  });
}

/* The epilogue (story bible 6c, docs/remastered/epilogue-plan.md):
   Ashcombe restored, and let. The film is fetched only now, at the win,
   and plays silent under the live lullaby; the captions are the page's,
   so their words can change without a re-render. With no film on the
   server it goes straight to the end card. */
const EPILOGUE = ROOT + 'epilogue/';
const CAPTIONS = [
  [0.4, 'One year later.'],
  [5.4, 'A new doormat. It says the whole word.'],
  [10.6, 'The staircase reaches the landing again, and the regalia are home.'],
  [15.9, 'The fire is lit. The King in the portrait looks pleased; he was always going to.'],
  [21.1, 'The kitchen has had its first hot meal in two hundred years.'],
  [26.4, 'Her room has a skylight now. The moon still visits.'],
  [31.6, 'The garden remembered it was a garden.'],
  [36.9, 'And the phonograph still plays, for anyone who asks.']
];

function playEpilogue(then) {
  const over = $('div', 'rm-film-over');
  const film = $('video', 'rm-film');
  const caption = $('p', 'rm-film-cap');
  const skip = $('button', 'rm-btn ghost rm-film-skip', 'Skip');
  film.muted = true;
  film.playsInline = true;
  film.preload = 'auto';
  film.poster = EPILOGUE + 'poster.jpg';
  let finished = false;
  const finish = (listing) => {
    if (finished) return;
    finished = true;
    over.remove();
    if (listing) showListing(then); else then();
  };
  film.addEventListener('error', () => finish(false));
  film.addEventListener('ended', () => finish(true));
  film.addEventListener('timeupdate', () => {
    const now = CAPTIONS.filter(([t]) => film.currentTime >= t).pop();
    const text = now ? now[1] : '';
    if (caption.textContent !== text) caption.textContent = text;
  });
  skip.addEventListener('click', () => finish(true));
  over.append(film, caption, skip);
  app.appendChild(over);
  film.src = EPILOGUE + 'epilogue.mp4';
  sound.music('lullaby');
  film.play().catch(() => finish(false));
}

function showListing(then) {
  overlay((card, close) => {
    card.classList.add('listing');
    card.append($('p', 'kicker', 'StayAway · Holiday homes'),
      $('h1', null, 'Ashcombe Manor'),
      $('p', 'sub', 'Entire manor house · sleeps 8 · glasshouse · kitchen garden · well (capped)'),
      $('p', 'stars', '★★★★★  4.98 · 212 reviews'),
      $('p', 'review', '"Lovely period property. Charming staircase. Slightly haunted, in a good way."'),
      $('p', 'host', 'Your host: the Sentinel. Superhost, off duty.'));
    const next = $('button', 'rm-btn', 'Continue');
    next.addEventListener('click', () => { close(); then(); });
    card.appendChild(next);
  });
}

function showEnd(kind) {
  if (kind === 'win' && !showEnd.filmShown) {
    showEnd.filmShown = true;
    playEpilogue(() => showEnd(kind));
    return;
  }
  const m = runtime.meta();
  overlay((card, close) => {
    card.appendChild($('h1', null, kind === 'win' ? 'The adventure is complete' : 'You have died'));
    if (kind === 'win') {
      // The house is mended, and its clock with it: going again, at the player's own time.
      const face = $('canvas', 'rm-end-clock');
      face.width = face.height = 160;
      face.setAttribute('role', 'img');
      const tell = () => {
        const now = new Date();
        drawClockFace(face.getContext('2d'), 160, now, false);
        face.setAttribute('aria-label', 'The hall clock, showing ' + now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }));
      };
      tell();
      const ticking = setInterval(() => { if (!face.isConnected) { clearInterval(ticking); return; } tell(); }, 1000);
      card.append(face, $('p', 'rm-end-clock-note', 'The hall clock is going again, and it keeps your time.'));
    }
    card.appendChild($('p', null, m.score + ' points' + (m.rank ? ' — ' + m.rank : '') + '  ·  ' + m.turns + ' moves'));
    if (kind !== 'win') {
      const undo = $('button', 'rm-btn', 'Undo last move');
      undo.addEventListener('click', () => { close(); run({ verb: 'undo' }); });
      card.appendChild(undo);
    }
    const made = $('p', 'rm-title-foot');
    made.append('The Sunken Crown is by ' + AUTHOR.name + '. More on ', outLink(AUTHOR.github, 'GitHub'), '.');
    card.appendChild(made);
    const again = $('button', 'rm-btn', 'Play again');
    again.addEventListener('click', () => { close(); logBody.textContent = ''; showEnd.filmShown = false; run({ verb: 'restart' }); });
    card.appendChild(again);
  });
}

/* The prologue: the cartridge's story-so-far, a page per room picture,
   read aloud by the chosen narrator. It sits over the title card, which
   is still there when the player closes it. */
function showPrologue() {
  const pages = presentation.prologue || [];
  let at = 0;
  voice.prefetch('prologue');
  const over = overlay((card, close) => {
    card.classList.add('prologue');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Prologue');
    const picture = $('img', 'rm-prologue-pic');
    picture.alt = '';
    const heading = $('h1');
    heading.tabIndex = -1;
    const body = $('div', 'rm-prologue-text');
    const count = $('p', 'rm-prologue-count');
    const back = $('button', 'rm-btn ghost', 'Back');
    const next = $('button', 'rm-btn');
    const skip = $('button', 'rm-btn ghost', 'Skip');
    for (const b of [back, next, skip]) b.type = 'button';
    const done = () => { voice.stop(); document.removeEventListener('keydown', keys); close(); };
    const show = (n) => {
      voice.stop();
      at = n;
      const page = pages[at];
      picture.src = ROOT + 'rooms/' + page.room + '/beauty.webp';
      heading.textContent = page.heading || '';
      body.textContent = '';
      const lines = [].concat(page.text);
      for (const line of lines) body.appendChild($('p', null, line));
      count.textContent = (at + 1) + ' of ' + pages.length;
      back.disabled = at === 0;
      next.textContent = at === pages.length - 1 ? 'To the adventure' : 'Next';
      skip.hidden = at === pages.length - 1;
      for (const line of lines) voice.say(line);
    };
    const keys = (event) => {
      if (event.key === 'ArrowRight') { event.preventDefault(); next.click(); }
      if (event.key === 'ArrowLeft' && at > 0) { event.preventDefault(); show(at - 1); }
      if (event.key === 'Escape') done();
    };
    back.addEventListener('click', () => show(at - 1));
    next.addEventListener('click', () => (at < pages.length - 1 ? show(at + 1) : done()));
    skip.addEventListener('click', done);
    document.addEventListener('keydown', keys);
    const nav = $('div', 'rm-prologue-nav');
    nav.append(back, count, next);
    card.append(picture, $('p', 'kicker', 'Prologue'), heading, body, nav, skip);
    show(0);
    requestAnimationFrame(() => next.focus());
  });
  return over;
}

/* A link that leaves the game opens beside it, never in its place. */
function outLink(href, text) {
  const a = $('a', null, text || href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''));
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

/* The credits, rolling as they do at the end of a film: the author's
   links stay above the roll, which scrolls itself until the player
   takes over (hover, focus, scroll or Pause), and keeps still for
   anyone who asks their system for reduced motion. The voices come with
   links to their sources. */
const ROLL_SPEED = 28;   // px per second

function creditLines(parent, lines) {
  for (const line of lines) parent.appendChild(line ? $('p', null, line) : $('div', 'gap'));
}

function showCredits() {
  overlay((card, close) => {
    card.classList.add('credits');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'About and credits');
    const links = $('p', 'rm-author-links');
    AUTHOR_LINKS.forEach(([label, href], i) => links.append(i ? ' · ' : '', label + ' ', outLink(href)));
    card.append($('p', 'kicker', 'About & credits'), links);

    const roll = $('div', 'rm-roll');
    roll.tabIndex = 0;
    roll.setAttribute('aria-label', 'Credits');
    const body = $('div', 'rm-roll-body');
    for (const block of ROLL) {
      const sec = $('section', block.title ? 'opening' : null);
      if (block.title) block.title.forEach((t, i) => sec.appendChild($(i ? 'p' : 'h1', i ? 'sub' : null, t)));
      if (block.heading) sec.appendChild($('h2', null, block.heading));
      creditLines(sec, block.lines || []);
      for (const para of block.paragraphs || []) sec.appendChild($('p', 'prose', para));
      if (block.voices) {
        for (const v of Object.values(VOICES)) {
          const who = $('div', 'voice');
          who.append($('p', 'role', v.role));
          const model = $('p');
          model.appendChild(outLink(v.link, v.model));
          who.appendChild(model);
          creditLines(who, v.credit);
          sec.appendChild(who);
        }
        creditLines(sec, [''].concat(block.after || []));
      }
      body.appendChild(sec);
    }
    roll.appendChild(body);
    card.appendChild(roll);

    const controls = $('div', 'rm-roll-nav');
    const play = $('button', 'rm-btn ghost');
    const back = $('button', 'rm-btn', 'Close');
    for (const b of [play, back]) b.type = 'button';
    controls.append(play, back);
    card.appendChild(controls);

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rolling = !still, held = false, last = 0, at = 0, raf = 0;
    const label = () => { play.textContent = rolling ? 'Pause' : 'Play'; };
    const step = (t) => {
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      if (rolling && !held) {
        at = Math.min(at + ROLL_SPEED * dt, roll.scrollHeight - roll.clientHeight);
        roll.scrollTop = at;
        if (at >= roll.scrollHeight - roll.clientHeight - 1) { rolling = false; label(); }
      } else at = roll.scrollTop;
      raf = requestAnimationFrame(step);
    };
    const stop = () => { if (rolling) { rolling = false; label(); } };
    play.addEventListener('click', () => {
      if (!rolling && roll.scrollTop >= roll.scrollHeight - roll.clientHeight - 1) roll.scrollTop = at = 0;
      rolling = !rolling;
      label();
    });
    roll.addEventListener('wheel', stop, { passive: true });
    roll.addEventListener('touchstart', stop, { passive: true });
    roll.addEventListener('keydown', (event) => { if (/^(Arrow|Page|Home|End| )/.test(event.key)) stop(); });
    roll.addEventListener('pointerenter', () => { held = true; });
    roll.addEventListener('pointerleave', () => { held = false; });
    roll.addEventListener('focusin', () => { held = true; });
    roll.addEventListener('focusout', () => { held = false; });
    const done = () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', esc); close(); };
    const esc = (event) => { if (event.key === 'Escape') done(); };
    back.addEventListener('click', done);
    document.addEventListener('keydown', esc);
    label();
    // A moment on the title before it starts to roll.
    setTimeout(() => { raf = requestAnimationFrame(step); }, still ? 0 : 1200);
    requestAnimationFrame(() => back.focus({ preventScroll: true }));
  });
}

function showTitle() {
  const title = presentation.title || {};
  overlay((card, close) => {
    card.classList.add('title');
    card.append($('p', 'kicker', 'Morrowlamp Software presents'), $('h1', null, title.heading || cart.meta.title),
      $('p', 'sub', 'Remastered'));
    const saved = autosaved();
    if (saved) {
      const goOn = $('button', 'rm-btn rm-continue', 'Continue');
      goOn.type = 'button';
      const when = new Date(saved.savedAt || Date.now());
      const room = (cart.world.rooms[JSON.parse(saved.state).room] || {}).name || '';
      goOn.addEventListener('click', async () => {
        sound.unlock();
        close();
        await resume(saved.state, (saved.remastered && saved.remastered.woken) || []);
      });
      card.append(goOn, $('p', 'rm-continue-note', 'Your game in ' + room + ', saved ' +
        when.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + '. Or begin a new one below.'));
      requestAnimationFrame(() => goOn.focus({ preventScroll: true }));
    }
    for (const line of runtime.intro()) card.appendChild($('p', 'intro', line));
    if ((presentation.prologue || []).length) {
      const story = $('button', 'rm-btn ghost rm-story', 'Read the prologue');
      story.type = 'button';
      story.title = 'The legend of the Sunken King, and what this game is about';
      story.addEventListener('click', async () => { sound.unlock(); await voice.ready; showPrologue(); });
      card.appendChild(story);
    }

    const begin = async () => {
      sound.unlock();
      voice.stop();
      close();
      await voice.ready;
      await three.ready;
      await enterRoom(runtime.meta().room, null);
      // Every room is remastered now, so the game begins where the story does: the yard.
      present(runtime.describeRoom(runtime.meta().room, true));
    };
    const classes = runtime.hasStats() ? runtime.classes() : [];
    if (classes.length > 1) {
      card.appendChild($('h2', null, 'Who goes down the well?'));
      const row = $('div', 'rm-classes');
      for (const k of classes) {
        const b = $('button', 'rm-class');
        b.append($('b', null, k.name || k.id));
        if (k.blurb) b.appendChild($('span', null, k.blurb));
        b.addEventListener('click', () => { runtime.chooseClass(k.id); begin(); });
        row.appendChild(b);
      }
      card.appendChild(row);
    } else {
      const go = $('button', 'rm-btn', title.prompt || 'Begin');
      go.addEventListener('click', begin);
      card.appendChild(go);
    }

    const wakeRow = $('label', 'rm-check');
    const wakeBox = $('input');
    wakeBox.type = 'checkbox';
    wakeBox.checked = wakeAsYouPlay;
    wakeBox.addEventListener('change', () => setWakeAsYouPlay(wakeBox.checked));
    wakeRow.append(wakeBox, $('span', null, 'Rooms start in'));
    const retroPick = $('select', 'rm-select');
    for (const id of ['cga', 'ega', 'vga']) {
      const o = $('option', null, ml.render.PROFILES[id].name);
      o.value = id;
      o.selected = id === retro;
      retroPick.appendChild(o);
    }
    retroPick.addEventListener('change', () => { retro = retroPick.value; setPref('retro', retro); });
    wakeRow.append(retroPick, $('span', null, 'and wake up when you do something in them'));
    card.appendChild(wakeRow);
    voice.ready.then(() => {
      const pick = $('details', 'rm-pick');
      const current = voice.choices().find((c) => c.id === voice.narrator());
      pick.append($('summary', null, 'Narrator: ' + (current ? current.label : 'Text only')), narratorPicker());
      pick.addEventListener('click', () => {
        const now = voice.choices().find((c) => c.id === voice.narrator());
        pick.querySelector('summary').textContent = 'Narrator: ' + (now ? now.label : 'Text only');
      });
      card.appendChild(pick);
      card.appendChild(titleFooter());
    });
  });
}

function titleFooter() {
  const foot = $('p', 'rm-title-foot');
  const about = $('button', 'rm-link', 'About & credits');
  about.type = 'button';
  about.title = 'Who made the game, and whose voices the narrators are';
  about.addEventListener('click', showCredits);
  foot.append(about, ' · A game by ' + AUTHOR.name + ' · ', outLink(AUTHOR.github, 'GitHub'));
  return foot;
}

/* ---------------- boot ---------------- */
setVerb('walk');
renderStatus();
showTitle();
window.__remastered = { runtime, three, voice, get room() { return room; }, hero, run };
