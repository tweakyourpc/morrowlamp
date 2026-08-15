/* ============================================================
   MORROWLAMP MACHINE — canvas interface shell
   The hybrid front end: a procedurally drawn scene with clickable
   hotspots and exits, a verb bar, an inventory strip, a status
   line, a message log, and a command line for anyone who would
   rather type.

   It knows about a runtime and an art provider, and nothing about
   any particular game. Swap the cartridge and it draws a
   different adventure without a line changing here.

   It also carries its own stylesheet, because a compiled
   adventure has to be one file and one file only.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  const CSS = `
.ml-shell{--ink:#e9e4d6;--dim:#9aa3b8;--panel:#161a24;--edge:#39405480;--warm:#ffe18a;
  background:#0a0c12;color:var(--ink);font:15px/1.5 ui-monospace,"DejaVu Sans Mono",Menlo,Consolas,monospace;
  min-height:100vh;margin:0;display:flex;flex-direction:column;align-items:center;gap:10px;padding:12px}
.ml-shell *{box-sizing:border-box}
.ml-bar{width:100%;max-width:980px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;
  background:var(--panel);border:1px solid var(--edge);border-radius:5px;padding:8px 10px}
.ml-title{color:var(--warm);font-weight:700;letter-spacing:.08em;margin-right:auto}
.ml-stat{color:var(--dim);font-size:13px;white-space:nowrap}
.ml-btn{background:#232838;color:var(--ink);border:1px solid var(--edge);border-radius:4px;
  padding:5px 10px;font:inherit;font-size:13px;cursor:pointer}
.ml-btn:hover{background:#2e3548}
.ml-btn.on{background:var(--warm);color:#151515;border-color:var(--warm)}
.ml-main{width:100%;max-width:980px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start}
.ml-stagecol{flex:1 1 640px;min-width:320px;display:flex;flex-direction:column;gap:8px}
.ml-stage{position:relative;background:#000;border:1px solid var(--edge);border-radius:4px;overflow:hidden}
.ml-stage canvas{display:block;width:100%;height:auto;image-rendering:pixelated;cursor:crosshair}
.ml-hover{position:absolute;left:0;right:0;bottom:0;padding:3px 8px;font-size:12px;
  background:#000000bb;color:var(--warm);pointer-events:none;min-height:20px}
.ml-verbs{display:flex;gap:6px;flex-wrap:wrap}
.ml-log{background:var(--panel);border:1px solid var(--edge);border-radius:4px;padding:10px;
  height:180px;overflow-y:auto;font-size:14px}
.ml-log p{margin:0 0 6px}
.ml-log .room-name{color:var(--warm);font-weight:700;letter-spacing:.06em}
.ml-log .dim{color:var(--dim)}
.ml-log .bad{color:#ff9b9b}
.ml-log .good{color:#b8e6b0}
.ml-log .scored{color:var(--warm)}
.ml-log .info{color:#9fd0ff}
.ml-side{flex:0 1 300px;min-width:240px;display:flex;flex-direction:column;gap:10px}
.ml-panel{background:var(--panel);border:1px solid var(--edge);border-radius:4px;padding:10px}
.ml-panel h2{margin:0 0 8px;font-size:12px;letter-spacing:.14em;color:var(--dim);text-transform:uppercase}
.ml-inv{display:flex;flex-wrap:wrap;gap:6px;min-height:32px}
.ml-item{background:#232838;border:1px solid var(--edge);border-radius:4px;padding:4px 8px;
  font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px}
.ml-item canvas{display:block;image-rendering:pixelated;width:24px;height:24px}
.ml-item.sel{background:var(--warm);color:#151515}
.ml-item.low{border-color:#8a6a20;color:var(--warm)}
.ml-item.spent{border-color:#6a2020;color:#c8564f;opacity:.75}
.ml-cmd{display:flex;gap:6px}
.ml-cmd input{flex:1;background:#0a0c12;color:var(--ink);border:1px solid var(--edge);
  border-radius:4px;padding:7px 9px;font:inherit;font-size:14px}
.ml-exits{font-size:13px;color:var(--dim)}
.ml-meter{display:flex;align-items:center;gap:8px;font-size:12px;margin-bottom:6px}
.ml-meter span:first-child{color:var(--dim);width:74px}
.ml-bargraph{flex:1;height:9px;background:#0a0c12;border:1px solid var(--edge);border-radius:2px;overflow:hidden}
.ml-bargraph i{display:block;height:100%;background:var(--warm)}
.ml-bargraph.hp i{background:#c8564f}
.ml-bargraph.xp i{background:#5f8fd0}
.ml-bargraph.foe i{background:#8d4fc8}
.ml-statlist{list-style:none;margin:8px 0 0;padding:0;font-size:12.5px;columns:2;column-gap:14px}
.ml-statlist li{display:flex;justify-content:space-between;color:var(--dim)}
.ml-statlist b{color:var(--ink);font-weight:400}
.ml-fight{position:absolute;left:8px;right:8px;bottom:26px;background:#0a0c12ee;border:1px solid var(--warm);
  border-radius:4px;padding:9px 11px}
.ml-fight .ml-fight-head{display:flex;justify-content:space-between;font-size:12px;color:var(--warm);margin-bottom:6px}
.ml-fight .ml-fight-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.ml-classes{display:flex;flex-direction:column;gap:8px;margin:14px 0 4px;text-align:left}
.ml-class{background:#232838;border:1px solid var(--edge);border-radius:4px;padding:9px 11px;cursor:pointer;
  color:var(--ink);font:inherit}
.ml-class:hover{border-color:var(--warm)}
.ml-class b{display:block;color:var(--warm);font-size:13px}
.ml-class span{display:block;color:var(--dim);font-size:12px;margin-top:2px}
.ml-over{position:fixed;inset:0;background:#050609ee;display:flex;align-items:center;justify-content:center;
  padding:20px;z-index:20}
.ml-card{background:var(--panel);border:1px solid var(--edge);border-radius:6px;padding:22px;
  max-width:620px;text-align:center}
.ml-card h1{color:var(--warm);letter-spacing:.1em;margin:0 0 6px;font-size:26px}
.ml-card p{color:var(--dim);text-align:left}
.ml-card .ml-btn{margin-top:12px;font-size:15px;padding:8px 18px}
`;

  const VERBS = [
    { id: 'walk', label: 'Walk', key: '1' },
    { id: 'look', label: 'Look', key: '2' },
    { id: 'hand', label: 'Hand', key: '3' },
    { id: 'talk', label: 'Talk', key: '4' }
  ];

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function mount(options) {
    const cart = options.cartridge;
    const runtime = options.runtime || ml.runtime.create(cart);
    const root = options.root || document.body;
    const presentation = cart.presentation || {};
    const art = ml.render.artOf(cart);
    const sound = ml.sound.create({ profile: presentation.audio, enabled: options.sound !== false });
    sound.attach(runtime);

    let profileName = ml.render.known(presentation.renderer) ? presentation.renderer : 'ega';
    let verb = 'walk';
    let carried = null;          // inventory item lifted onto the cursor
    let hotspots = [];
    let g = null, bg = null, bgG = null, bgKey = '';
    let actor = null;
    let actorFrame = 0;
    let actorFacing = 1;
    let actorAnimation = null;

    /* ---------------- chrome ---------------- */
    if (!document.getElementById('ml-shell-css')) {
      const style = el('style');
      style.id = 'ml-shell-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    root.classList.add('ml-shell');

    const bar = el('div', 'ml-bar');
    const titleTag = el('span', 'ml-title', cart.meta.title || 'A MORROWLAMP ADVENTURE');
    const statRoom = el('span', 'ml-stat');
    const statScore = el('span', 'ml-stat');
    const btnSave = el('button', 'ml-btn', 'Save');
    const btnLoad = el('button', 'ml-btn', 'Load');
    const btnUndo = el('button', 'ml-btn', 'Undo');
    const btnVideo = el('button', 'ml-btn', profileName.toUpperCase());
    const btnSound = el('button', 'ml-btn on', '♪ ' + sound.profile.name);
    const btnCodeOut = el('button', 'ml-btn', 'Code out');
    const btnCodeIn = el('button', 'ml-btn', 'Code in');
    bar.append(titleTag, statRoom, statScore, btnUndo, btnSave, btnLoad, btnCodeOut, btnCodeIn, btnVideo, btnSound);

    const main = el('div', 'ml-main');
    const stageCol = el('div', 'ml-stagecol');
    const stage = el('div', 'ml-stage');
    const canvas = el('canvas');
    const hover = el('div', 'ml-hover', '');
    const fightPanel = el('div', 'ml-fight');
    fightPanel.hidden = true;
    stage.append(canvas, hover, fightPanel);

    const verbBar = el('div', 'ml-verbs');
    const verbButtons = {};
    for (const v of VERBS) {
      const b = el('button', 'ml-btn' + (v.id === verb ? ' on' : ''), v.label + ' (' + v.key + ')');
      b.addEventListener('click', () => setVerb(v.id));
      verbButtons[v.id] = b;
      verbBar.appendChild(b);
    }

    const log = el('div', 'ml-log');
    const cmdRow = el('form', 'ml-cmd');
    const input = el('input');
    input.placeholder = 'or type a command…';
    input.autocomplete = 'off';
    const cmdGo = el('button', 'ml-btn', 'Do');
    cmdRow.append(input, cmdGo);
    stageCol.append(stage, verbBar, log, cmdRow);

    const side = el('div', 'ml-side');

    /* The character sheet only exists if the cartridge asked for stats. */
    const charPanel = el('div', 'ml-panel');
    charPanel.appendChild(el('h2', null, 'Character'));
    const charBody = el('div');
    charPanel.appendChild(charBody);
    charPanel.hidden = !runtime.hasStats();

    const invPanel = el('div', 'ml-panel');
    invPanel.appendChild(el('h2', null, 'Carrying'));
    const invStrip = el('div', 'ml-inv');
    invPanel.appendChild(invStrip);
    const exitPanel = el('div', 'ml-panel');
    exitPanel.appendChild(el('h2', null, 'Ways out'));
    const exitList = el('div', 'ml-exits');
    exitPanel.appendChild(exitList);
    side.append(charPanel, invPanel, exitPanel);

    main.append(stageCol, side);
    root.append(bar, main);

    /* ---------------- drawing ---------------- */
    function buildSurfaces() {
      g = ml.render.create(canvas, { profile: profileName });
      bg = document.createElement('canvas');
      bgG = ml.render.create(bg, { profile: profileName });
      bgKey = '';
    }
    buildSurfaces();

    function currentScene() { return art.scene(runtime.meta().room); }

    function entryPoint(scene) {
      return (scene && scene.entry && (scene.entry.start || scene.entry.n)) || [160, 170];
    }

    function ensureActor(scene) {
      const entry = entryPoint(scene);
      if (!actor) actor = { x: entry[0], y: entry[1] };
      return actor;
    }

    function animateActorTo(target) {
      if (!target) return;
      const current = ensureActor(currentScene());
      const start = { x: current.x, y: current.y };
      const distance = Math.hypot(target[0] - start.x, target[1] - start.y);
      if (distance < 2) { current.x = target[0]; current.y = target[1]; repaint(); return; }
      actorFacing = target[0] < start.x ? -1 : 1;
      const started = performance.now();
      const duration = Math.max(180, Math.min(900, distance * 4));
      if (actorAnimation) cancelAnimationFrame(actorAnimation);
      const step = (now) => {
        const t = Math.min(1, (now - started) / duration);
        const eased = t * t * (3 - 2 * t);
        current.x = start.x + (target[0] - start.x) * eased;
        current.y = start.y + (target[1] - start.y) * eased;
        actorFrame = Math.floor(now / 90) % 4;
        repaint();
        if (t < 1) actorAnimation = requestAnimationFrame(step);
        else { actorAnimation = null; current.x = target[0]; current.y = target[1]; repaint(); }
      };
      actorAnimation = requestAnimationFrame(step);
    }

    function visibleIds() { return runtime.visibleObjects().map((o) => o.id); }

    /* Which rectangles are clickable right now: authored hotspots for
       things that are actually here, plus synthesized ones for anything
       sitting in an open container the scene did not plan for. */
    function computeHotspots(scene) {
      const out = [];
      if (!scene) return out;
      const vis = visibleIds();
      const flags = runtime.flags();
      const defined = new Set();

      for (const s of (scene.spots || [])) {
        defined.add(s.id);
        if (s.onlyIf && !flags[s.onlyIf]) continue;
        if (!vis.includes(s.id)) continue;
        const rect = (s.w && s.h) ? [s.x, s.y, s.w, s.h] : [s.x - 11, s.y - 11, 22, 22];
        out.push({
          kind: 'object', id: s.id, rect,
          icon: !!s.icon, iconAt: s.iconAt || [s.x, s.y],
          label: (runtime.describeObject(s.id) || {}).name || s.id
        });
      }

      for (const id of vis) {
        if (defined.has(id)) continue;
        const info = runtime.describeObject(id);
        if (!info) continue;
        const holder = findHolder(id, scene);
        if (!holder) continue;
        out.push({ kind: 'object', id, rect: holder.rect, icon: true, iconAt: holder.at, label: info.name });
      }

      for (const e of (scene.exits || [])) {
        if (e.needs && !flags[e.needs]) continue;
        const check = runtime.exits().find((x) => x.dir === e.dir);
        if (!check) continue;
        out.push({ kind: 'exit', dir: e.dir, rect: [e.x, e.y, e.w, e.h], walkTo: e.walkTo,
          ok: check.ok, label: exitLabel(e.dir, check) });
      }
      return out;
    }

    function findHolder(id, scene) {
      for (const info of runtime.visibleObjects()) {
        if (!info.container || !info.open || !info.contents.includes(id)) continue;
        const spot = (scene.spots || []).find((s) => s.id === info.id);
        if (!spot) continue;
        const index = info.contents.indexOf(id);
        const cx = (spot.x || 0) + (spot.w || 22) / 2 + ((index % 3) - 1) * 10;
        const cy = (spot.y || 0) + Math.min((spot.h || 22) / 2, 18) + Math.floor(index / 3) * 10;
        return { rect: [cx - 9, cy - 9, 18, 18], at: [cx, cy] };
      }
      return null;
    }

    function exitLabel(dir, check) {
      const name = check.room ? ((cart.world.rooms[check.room] || {}).name || '') : '';
      const dirName = (ml.world.DIR_NAMES[dir] || dir);
      return check.ok && name ? dirName + ' — ' + name : dirName;
    }

    function sceneFlags() { return runtime.flags(); }

    function repaint() {
      const scene = currentScene();
      const m = runtime.meta();
      if (!scene) {
        g.clear(g.C.black);
        drawTextPlate(m.roomName);
        hotspots = [];
        return;
      }
      const key = m.room + '|' + JSON.stringify(sceneFlags());
      if (key !== bgKey) {
        bgKey = key;
        bgG.clear(bgG.C.black);
        if (scene.paint) scene.paint(bgG, sceneFlags());
      }
      g.ctx.drawImage(bg, 0, 0, g.W, g.H);

      hotspots = computeHotspots(scene);

      /* Loose objects that the scene wants drawn as icons. */
      const drawables = [];
      if (art.item) {
        for (const h of hotspots) {
          if (h.kind !== 'object' || !h.icon) continue;
          const scale = art.itemScale(scene, h.iconAt[1]);
          drawables.push({ y: h.iconAt[1], fn: () => art.item(g, h.id, h.iconAt[0], h.iconAt[1], scale) });
        }
      }
      if (art.actor) {
        const entry = entryPoint(scene);
        const pose = ensureActor(scene);
        drawables.push({
          y: pose.y,
          /* `carryingLight` is as specific as the shell is allowed to be:
             whether the player is lighting their own way here. Which
             prop that is — a lamp, a torch, a glowing rock — is the
             cartridge's business, decided in its actor painter. */
          fn: () => art.actor(g, pose.x, pose.y, {
            scale: art.actorScale(scene, pose.y),
            facing: actorFacing, frame: actorFrame, walking: !!actorAnimation,
            carryingLight: m.dark && m.hasLight
          })
        });
      }
      /* Whatever is fighting you stands in front of everything else. */
      const fight = runtime.encounter();
      if (fight && art.opponent) {
        drawables.push({ y: 9999, fn: () => art.opponent(g, fight.id, 232, 168, { hurt: fight.hp < fight.maxHp * 0.4, round: fight.round }) });
      }

      drawables.sort((a, b) => a.y - b.y);
      for (const d of drawables) d.fn();

      /* The dark is drawn, not merely described. */
      if (m.dark && !m.hasLight) {
        g.clear(g.C.black);
        drawTextPlate('IT IS PITCH BLACK');
      }
      if (scene.fg) scene.fg(g, sceneFlags(), 0);
    }

    function drawTextPlate(text) {
      const ctx = g.ctx;
      ctx.save();
      ctx.fillStyle = g.C.ltgray;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(text || ''), g.W / 2, g.H / 2);
      ctx.restore();
    }

    /* ---------------- interaction ---------------- */
    function setVerb(id) {
      verb = id;
      carried = null;
      for (const key in verbButtons) verbButtons[key].classList.toggle('on', key === verb);
      renderInventory();
    }

    function canvasPoint(event) {
      const rect = canvas.getBoundingClientRect();
      return [
        Math.round((event.clientX - rect.left) / rect.width * g.W),
        Math.round((event.clientY - rect.top) / rect.height * g.H)
      ];
    }

    function findInKind(x, y, kind) {
      for (let i = hotspots.length - 1; i >= 0; i--) {
        const h = hotspots[i];
        if (h.kind !== kind) continue;
        const r = h.rect;
        if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return h;
      }
      return null;
    }

    /* A trapdoor's clickable area is deliberately the same rectangle as
       the exit standing on top of it, so an overlap is not a mistake to
       break ties on arbitrarily: which one a click means depends on what
       the player is doing. Walking (no item in hand, Walk selected) means
       the exit; anything else — Look, Hand, Talk, or using a held item on
       whatever is there — means the object underneath. */
    function hitTest(x, y) {
      const objectFirst = !!carried || verb !== 'walk';
      const first = objectFirst ? findInKind(x, y, 'object') : findInKind(x, y, 'exit');
      if (first) return first;
      return objectFirst ? findInKind(x, y, 'exit') : findInKind(x, y, 'object');
    }

    /* Turn a click into a command the runtime already understands. The
       shell never invents game logic; it only phrases requests. */
    function commandFor(spot) {
      if (!spot) return null;
      if (spot.kind === 'exit') return { verb: 'move', text: spot.dir, _walkTo: spot.walkTo };
      const info = runtime.describeObject(spot.id);
      if (!info) return null;

      if (carried) {
        const held = carried;
        carried = null;
        if (info.container && info.open) return { verb: 'put', target: held, with: spot.id };
        return { verb: 'use', target: held, with: spot.id };
      }
      switch (verb) {
        case 'look': return { verb: 'examine', target: spot.id };
        case 'talk': return { verb: 'talk', target: spot.id };
        case 'hand':
          if (info.takeable && !info.carried) return { verb: 'take', target: spot.id };
          if (info.container) return { verb: info.open ? 'close' : 'open', target: spot.id };
          return { verb: 'push', target: spot.id };
        case 'walk':
        default:
          if (info.container && !info.open) return { verb: 'open', target: spot.id };
          return { verb: 'examine', target: spot.id };
      }
    }

    canvas.addEventListener('mousemove', (event) => {
      const [x, y] = canvasPoint(event);
      const spot = hitTest(x, y);
      hover.textContent = spot ? (carried ? 'Use ' + labelOf(carried) + ' on ' + spot.label : spot.label) : '';
    });
    canvas.addEventListener('mouseleave', () => { hover.textContent = ''; });
    canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      if (carried) { carried = null; renderInventory(); return; }
      const i = VERBS.findIndex((v) => v.id === verb);
      setVerb(VERBS[(i + 1) % VERBS.length].id);
    });
    canvas.addEventListener('click', (event) => {
      sound.unlock();
      const [x, y] = canvasPoint(event);
      const action = commandFor(hitTest(x, y));
      if (action) run(action);
      else renderInventory();
    });

    function labelOf(id) { return (runtime.describeObject(id) || {}).name || id; }

    /* Whether a carried item is *the* fuelled light source, and if so
       how it should read: lit and plentiful, lit and low, or spent.
       Read entirely from the cartridge's own profile.light.fuel config
       and meta().fuel, the same numbers the status bar already shows —
       no item id is assumed here, so a cartridge with no light system,
       or a different one, is untouched. */
    function fuelState(id) {
      const fuel = runtime.profile.light.fuel;
      if (!fuel || fuel.object !== id) return null;
      const lit = (runtime.describeObject(id) || {}).lit;
      if (!lit) return { cls: 'spent', text: 'out' };
      const level = runtime.meta().fuel;
      const warnAt = fuel.warnings && fuel.warnings[0] && fuel.warnings[0][0];
      if (level !== null && level !== undefined && warnAt !== undefined && level <= warnAt) return { cls: 'low', text: 'low' };
      return null;
    }

    /* A small still portrait of a carried object, drawn through the same
       art.item(g, id, x, y, scale) contract the scene uses — never the
       cartridge's painters directly, so a cartridge with no item art
       just renders a text-only button. */
    function itemIcon(id) {
      if (!art.item) return null;
      const size = 28;
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ig = ml.render.create(c, { profile: profileName, resize: false });
      ig.ctx.setTransform(size / 26, 0, 0, size / 26, 0, 0);
      art.item(ig, id, 13, 13, 1);
      ig.ctx.setTransform(1, 0, 0, 1, 0, 0);
      return c;
    }

    function renderInventory() {
      invStrip.textContent = '';
      const inv = runtime.inventory();
      if (!inv.length) { invStrip.appendChild(el('span', 'ml-stat', 'nothing')); return; }
      for (const id of inv) {
        const state = fuelState(id);
        const label = labelOf(id) + (state ? ' (' + state.text + ')' : '');
        const cls = 'ml-item' + (carried === id ? ' sel' : '') + (state ? ' ' + state.cls : '');
        const b = el('button', cls);
        const icon = itemIcon(id);
        if (icon) b.appendChild(icon);
        b.appendChild(el('span', null, label));
        b.addEventListener('click', () => {
          if (carried && carried !== id) { const held = carried; carried = null; run({ verb: 'use', target: held, with: id }); return; }
          carried = carried === id ? null : id;
          renderInventory();
        });
        invStrip.appendChild(b);
      }
    }

    function renderExits() {
      const ways = runtime.exits().filter((e) => e.ok);
      exitList.textContent = '';
      if (!ways.length) { exitList.appendChild(el('span', null, 'none obvious')); return; }
      for (const e of ways) {
        const b = el('button', 'ml-btn', ml.world.DIR_NAMES[e.dir] || e.dir);
        b.addEventListener('click', () => run({ verb: 'move', text: e.dir }));
        exitList.appendChild(b);
      }
    }

    function meter(label, value, max, kind, text) {
      const row = el('div', 'ml-meter');
      row.appendChild(el('span', null, label));
      const bar = el('div', 'ml-bargraph' + (kind ? ' ' + kind : ''));
      const fill = el('i');
      fill.style.width = Math.max(0, Math.min(100, (value / (max || 1)) * 100)) + '%';
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(el('span', null, text !== undefined ? text : value + ' / ' + max));
      return row;
    }

    function renderCharacter() {
      if (!runtime.hasStats()) return;
      const sheet = runtime.sheet();
      charBody.textContent = '';
      if (!sheet) return;
      charBody.appendChild(el('p', 'ml-stat', sheet.className + ' · Level ' + sheet.level));
      charBody.appendChild(meter('Health', sheet.hp, sheet.maxHp, 'hp'));
      const span = Math.max(1, sheet.xp + sheet.xpToNext);
      charBody.appendChild(meter('Experience', sheet.xp, span, 'xp', sheet.xp + ' xp'));
      const list = el('ul', 'ml-statlist');
      for (const stat of sheet.stats) {
        const li = el('li');
        li.appendChild(el('span', null, stat.name));
        li.appendChild(el('b', null, String(stat.value)));
        list.appendChild(li);
      }
      charBody.appendChild(list);
    }

    /* The combat panel is a rendering of whatever actions the encounter
       declared. The shell has no list of its own. */
    function renderEncounter() {
      const fight = runtime.encounter();
      fightPanel.hidden = !fight;
      if (!fight) return;
      fightPanel.textContent = '';
      const head = el('div', 'ml-fight-head');
      head.appendChild(el('span', null, fight.name));
      head.appendChild(el('span', null, 'Round ' + fight.round));
      fightPanel.appendChild(head);
      fightPanel.appendChild(meter('', fight.hp, fight.maxHp, 'foe', fight.hp + ' / ' + fight.maxHp));
      const sheet = runtime.sheet();
      if (sheet) fightPanel.appendChild(meter('You', sheet.hp, sheet.maxHp, 'hp'));
      const acts = el('div', 'ml-fight-acts');
      for (const action of fight.actions) {
        const button = el('button', 'ml-btn', action.label);
        button.disabled = !action.enabled;
        if (!action.enabled && action.deny) button.title = action.deny;
        button.addEventListener('click', () => {
          sound.unlock();
          const result = runtime.encounterAct(action.id);
          print(result.messages);
          refresh();
          if (result.meta.win) showEnd('win');
          else if (result.meta.dead) showEnd('death');
        });
        acts.appendChild(button);
      }
      fightPanel.appendChild(acts);
    }

    function renderStatus() {
      const m = runtime.meta();
      statRoom.textContent = m.roomName;
      const bits = [];
      if (runtime.profile.score.enabled) bits.push('Score ' + m.score);
      if (runtime.profile.treasures.enabled) bits.push(m.secured + '/' + m.treasures);
      bits.push('Moves ' + m.turns);
      if (m.fuel !== null && m.fuel !== undefined) bits.push('Oil ' + m.fuel);
      statScore.textContent = bits.join('  ·  ');
    }

    function print(messages) {
      for (const line of messages) {
        const p = el('p', line.cls || '', line.text);
        log.appendChild(p);
      }
      log.scrollTop = log.scrollHeight;
    }

    /* ---------------- the turn ---------------- */
    function run(action) {
      const beforeRoom = runtime.meta().room;
      const walkTo = action && action._walkTo;
      let result;
      if (action && action._text !== undefined) result = runtime.command(action._text);
      else {
        const clean = Object.assign({}, action);
        delete clean._walkTo;
        delete clean._text;
        result = runtime.perform(clean);
      }
      if (result.meta.clear) log.textContent = '';
      print(result.messages);
      if (result.meta.saveRequest !== undefined && result.meta.saveRequest !== null) saveGame(result.meta.saveRequest);
      if (result.meta.loadRequest !== undefined && result.meta.loadRequest !== null) loadGame(result.meta.loadRequest);
      refresh();
      if (beforeRoom !== runtime.meta().room) animateActorTo(entryPoint(currentScene()));
      else if (walkTo) animateActorTo(walkTo);
      if (result.meta.win) showEnd('win');
      else if (result.meta.dead) showEnd('death');
    }

    function encodeCode(value) {
      const bytes = unescape(encodeURIComponent(JSON.stringify(value)));
      return 'ML1-' + btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function decodeCode(code) {
      const raw = String(code || '').trim();
      if (!raw.startsWith('ML1-')) throw new Error('unknown save code');
      const bytes = raw.slice(4).replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(bytes))));
    }

    btnCodeOut.addEventListener('click', () => {
      const code = encodeCode({ cartridge: cart.meta.id, state: runtime.serialize() });
      if (global.prompt) global.prompt('Copy this save code:', code);
      else print([{ text: code, cls: 'info' }]);
    });
    btnCodeIn.addEventListener('click', () => {
      if (!global.prompt) return;
      const code = global.prompt('Paste a save code:');
      if (!code) return;
      try {
        const saved = decodeCode(code);
        if (saved.cartridge !== cart.meta.id) throw new Error('wrong cartridge');
        runtime.restore(saved.state);
        print([{ text: 'Restored from code.', cls: 'good' }]);
        refresh();
      } catch (err) {
        print([{ text: 'That save code could not be read.', cls: 'bad' }]);
      }
    });

    function refresh() {
      repaint();
      renderInventory();
      renderExits();
      renderStatus();
      renderCharacter();
      renderEncounter();
    }

    cmdRow.addEventListener('submit', (event) => {
      event.preventDefault();
      sound.unlock();
      const text = input.value;
      input.value = '';
      if (!text.trim()) return;
      print([{ text: '> ' + text, cls: 'dim' }]);
      run({ _text: text });
    });

    document.addEventListener('keydown', (event) => {
      if (event.target === input) return;
      const v = VERBS.find((x) => x.key === event.key);
      if (v) { setVerb(v.id); return; }
      if (event.key === 'Escape') { carried = null; renderInventory(); }
      if (event.key === 'Tab') { event.preventDefault(); const i = VERBS.findIndex((x) => x.id === verb); setVerb(VERBS[(i + 1) % VERBS.length].id); }
    });

    /* ---------------- persistence ----------------
       localStorage may be unavailable when a compiled adventure is
       opened straight off a disk. That is not an error; it is 1987. */
    const SAVE_KEY = 'morrowlamp:' + (cart.meta.id || 'game') + ':';
    function saveGame(slot) {
      try {
        localStorage.setItem(SAVE_KEY + (slot || 1), JSON.stringify({
          cartridge: cart.meta.id, version: cart.meta.version,
          engine: ml.VERSION, savedAt: Date.now(), state: runtime.serialize()
        }));
        print([{ text: 'Game saved to slot ' + (slot || 1) + '.', cls: 'good' }]);
      } catch (err) {
        print([{ text: 'This browser will not let a file:// page keep saves. Serve the folder to save.', cls: 'bad' }]);
      }
    }
    function loadGame(slot) {
      try {
        const raw = localStorage.getItem(SAVE_KEY + (slot || 1));
        if (!raw) { print([{ text: 'Slot ' + (slot || 1) + ' is empty.', cls: 'bad' }]); return; }
        const data = JSON.parse(raw);
        if (data.cartridge !== cart.meta.id) { print([{ text: 'That save belongs to a different cartridge.', cls: 'bad' }]); return; }
        runtime.restore(data.state);
        log.textContent = '';
        print([{ text: 'Game restored.', cls: 'good' }]);
        print(runtime.describeRoom(runtime.meta().room, true));
        refresh();
      } catch (err) {
        print([{ text: 'That save could not be read.', cls: 'bad' }]);
      }
    }
    btnSave.addEventListener('click', () => saveGame(1));
    btnLoad.addEventListener('click', () => loadGame(1));
    btnUndo.addEventListener('click', () => run({ verb: 'undo' }));
    btnVideo.addEventListener('click', () => {
      const all = ml.render.names();
      profileName = all[(all.indexOf(profileName) + 1) % all.length];
      btnVideo.textContent = profileName.toUpperCase();
      buildSurfaces();
      repaint();
    });
    btnSound.addEventListener('click', () => {
      sound.setEnabled(!sound.isEnabled());
      btnSound.classList.toggle('on', sound.isEnabled());
      btnSound.textContent = (sound.isEnabled() ? '♪ ' : '· ') + sound.profile.name;
    });

    /* ---------------- overlays ---------------- */
    function overlay(build) {
      const over = el('div', 'ml-over');
      const card = el('div', 'ml-card');
      build(card, () => over.remove());
      over.appendChild(card);
      document.body.appendChild(over);
      return over;
    }

    function showTitle() {
      const title = presentation.title || {};
      overlay((card, close) => {
        card.appendChild(el('h1', null, title.heading || cart.meta.title || 'A MORROWLAMP ADVENTURE'));
        if (title.subtitle || cart.meta.blurb) card.appendChild(el('p', 'ml-stat', title.subtitle || cart.meta.blurb));
        for (const line of runtime.intro()) card.appendChild(el('p', null, line));

        const begin = () => {
          sound.unlock();
          if (art.music) sound.music(art.music);
          close();
          refresh();
          input.focus();
        };

        /* A cartridge with more than one class asks; one with a single
           class, or none, simply starts. The shell does not decide. */
        const classes = title.showClasses === false ? [] : (runtime.hasStats() ? runtime.classes() : []);
        if (classes.length > 1) {
          card.appendChild(el('h2', 'ml-stat', 'CHOOSE WHO GOES'));
          const box = el('div', 'ml-classes');
          for (const klass of classes) {
            const button = el('button', 'ml-class');
            button.appendChild(el('b', null, klass.name || klass.id));
            if (klass.blurb) button.appendChild(el('span', null, klass.blurb));
            const line = Object.keys(klass.stats || {})
              .map((id) => (runtime.statsConfig.list[id] || id).slice(0, 4).toUpperCase() + ' ' + klass.stats[id])
              .join(' · ');
            if (line) button.appendChild(el('span', null, line));
            button.addEventListener('click', () => { runtime.chooseClass(klass.id); begin(); });
            box.appendChild(button);
          }
          card.appendChild(box);
        } else {
          const go = el('button', 'ml-btn', title.prompt || 'BEGIN');
          go.addEventListener('click', begin);
          card.appendChild(go);
        }
        if (cart.meta.copyright) card.appendChild(el('p', 'ml-stat', cart.meta.copyright));
      });
    }

    function showEnd(kind) {
      const m = runtime.meta();
      overlay((card, close) => {
        card.appendChild(el('h1', null, kind === 'win' ? 'THE ADVENTURE IS COMPLETE' : 'YOU HAVE DIED'));
        const summary = ['Score ' + m.score + (m.rank ? ' — ' + m.rank : ''), 'Moves ' + m.turns];
        if (runtime.profile.treasures.enabled) summary.push('Treasures secured ' + m.secured + '/' + m.treasures);
        card.appendChild(el('p', null, summary.join('   ·   ')));
        if (kind !== 'win') {
          const undo = el('button', 'ml-btn', 'Undo last move');
          undo.addEventListener('click', () => { close(); run({ verb: 'undo' }); });
          card.appendChild(undo);
        }
        const again = el('button', 'ml-btn', 'Play again');
        again.addEventListener('click', () => { close(); log.textContent = ''; run({ verb: 'restart' }); });
        card.appendChild(again);
      });
    }

    /* ---------------- boot ---------------- */
    print(runtime.describeRoom(runtime.meta().room, true));
    refresh();
    if (options.title !== false && presentation.title && presentation.title.enabled !== false) showTitle();

    return { runtime, sound, refresh, run, print, setVerb, canvas };
  }

  ml.shellCanvas = { mount, CSS, VERBS };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
