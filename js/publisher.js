/* ============================================================
   THE SUNKEN CROWN — point-and-click controller
   Drives the pure engine with synthesized action objects, so
   every puzzle, flag and score rule from the text game still
   applies. This layer owns the actor, the cursor verbs, the
   darkness encounter, and the combat round.

   AI orchestration author: @tweakyourpc
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const world = Z.world, engine = Z.engine, scenes = Z.scenes;
  const gfx = Z.gfx, sprites = Z.sprites, rpg = Z.rpg;
  const audio = Z.audio, music = Z.music, save = Z.save;

  const VERBS = ['walk', 'look', 'hand', 'talk', 'attack'];
  const VERB_LABEL = { walk: 'Walk', look: 'Look', hand: 'Hand', talk: 'Talk', attack: 'Attack', item: 'Use' };
  const UNDO_MAX = 20;
  /* Turns of burn time in the dark. Generous — this is tension, not a
     timer puzzle — and the sunstone is a permanent backup light. */
  const LAMP_FULL = 260;
  /* Where the two of you stand when it comes to blows. */
  const FOE_X = 214, FOE_Y = 178, HERO_X = 96, HERO_Y = 178;

  const game = (function () {
    let g = null, bg = null, bgG = null, bgKey = '';
    let scene = null, sceneId = null;
    let raf = 0, last = 0, T = 0;
    let started = false;
    let splashG = null, titleHeroG = null, splashStart = 0, splashDone = false;
    let profileIndex = 1, speechEnabled = false;

    const actor = { x: 160, y: 170, tx: 160, ty: 170, facing: 'down', frame: 0, phase: 0, walking: false, moving: false };
    let verb = 'walk';
    let held = null;              // inventory item riding the cursor
    let pending = null;           // action to run when the walk finishes
    let hover = '';
    let darkTurns = 0;
    let danceUntil = 0;
    let undoStack = [];

    const $ = (id) => document.getElementById(id);

    /* ---------------- procedural publisher splash ---------------- */

    function drawSplash(ts) {
      if (!splashG || splashDone) return;
      const p = Math.max(0, Math.min(1, (ts - splashStart) / 5200));
      const C = splashG.C;
      splashG.clear(C.black);

      // A few fixed stars make the reveal stable, while their brightness twinkles.
      const stars = [[34, 28], [72, 18], [112, 35], [206, 23], [252, 36], [286, 17], [145, 12]];
      for (let i = 0; i < stars.length; i++) {
        const a = Math.max(0, Math.min(1, (p - .08) * 3));
        if (a <= 0) continue;
        const twinkle = Math.sin(ts / 170 + i * 2.1) > .45;
        if (twinkle || p > .82) splashG.px(stars[i][0], stars[i][1], 1, 1, C.ltgray);
      }

      const rise = Math.max(0, Math.min(1, (p - .18) / .45));
      if (rise > 0) {
        splashG.poly([[0, 165], [42, 120], [76, 148], [126, 94], [178, 145], [224, 108], [320, 165]], C.blue);
        splashG.poly([[0, 176], [66, 139], [112, 160], [160, 121], [220, 156], [276, 128], [320, 176]], C.dkgray);
        splashG.stipple(0, 124, 320, 52, C.ltblue, rise * .22);
      }

      const reveal = Math.max(0, Math.min(1, (p - .42) / .3));
      if (reveal > 0) {
        // Crescent and hanging lantern, reconstructed from the EGA primitives.
        splashG.circle(160, 77, 32, C.yellow);
        splashG.circle(171, 68, 29, C.black);
        splashG.line(160, 44, 160, 52, C.brown);
        splashG.line(160, 52, 153, 60, C.yellow);
        splashG.line(160, 52, 167, 60, C.yellow);
        splashG.poly([[151, 61], [169, 61], [174, 68], [169, 91], [151, 91], [146, 68]], C.brown);
        splashG.px(151, 68, 18, 2, C.yellow);
        splashG.px(153, 72, 14, 14, C.ltgray);
        splashG.px(157, 75, 6, 8, C.yellow);
        splashG.line(146, 93, 174, 93, C.yellow);
        splashG.line(153, 96, 167, 96, C.yellow);

        const ctx = splashG.ctx;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.textAlign = 'center';
        ctx.fillStyle = C.yellow;
        ctx.font = 'bold 11px monospace';
        ctx.fillText('MORROWLAMP', 160, 133);
        ctx.font = 'bold 8px monospace';
        ctx.fillText('SOFTWARE', 160, 146);
        ctx.restore();
      }

      if (p > .78) {
        const flash = Math.max(0, 1 - (p - .78) / .22);
        const cx = 192, cy = 45;
        const arm = Math.round(8 + flash * 10);
        splashG.px(cx - arm, cy, arm * 2 + 1, 1, C.white);
        splashG.px(cx, cy - arm, 1, arm * 2 + 1, C.white);
        splashG.px(cx - 2, cy - 2, 5, 5, C.yellow);
      }

      if (p >= 1) finishSplash();
    }

    function drawTitleHero() {
      const g = titleHeroG;
      const C = g.C;
      g.clear(C.black);
      g.vgrad(0, 0, 320, 112, ['blue', 'black']);
      g.px(0, 79, 320, 33, C.dkgray);
      g.poly([[0, 82], [44, 49], [83, 73], [126, 34], [181, 76], [224, 43], [320, 84]], C.blue);
      g.poly([[0, 89], [69, 63], [115, 83], [167, 55], [225, 84], [279, 61], [320, 86], [320, 112], [0, 112]], C.dkgray);
      g.px(26, 59, 84, 31, C.ltgray);
      g.poly([[17, 59], [68, 39], [119, 59]], C.brown);
      g.px(37, 67, 10, 11, C.black); g.px(76, 67, 10, 11, C.black);
      g.px(53, 70, 4, 4, C.ltcyan); g.px(82, 70, 4, 4, C.ltcyan);
      g.px(62, 78, 13, 12, C.black); g.px(67, 82, 3, 3, C.yellow);
      g.px(220, 70, 29, 5, C.brown); g.px(226, 75, 4, 17, C.brown); g.px(242, 75, 4, 17, C.brown);
      g.circle(235, 79, 9, C.black); g.circle(235, 79, 6, C.dkgray);
      g.px(126, 94, 55, 7, C.brown); g.px(136, 101, 7, 11, C.brown); g.px(166, 101, 7, 11, C.brown);
      g.stipple(122, 100, 64, 12, C.yellow, .2);
      sprites.drawActor(g, 151, 106, { cls: 'delver', scale: .82, facing: 'right', frame: 0, walking: false, lantern: true });
      sprites.drawUmbra(g, 274, 105, 0, false);
      g.ctx.save();
      g.ctx.imageSmoothingEnabled = false;
      g.ctx.fillStyle = C.yellow;
      g.ctx.font = 'bold 8px monospace';
      g.ctx.fillText('THE HALLS ARE BELOW', 8, 13);
      g.ctx.restore();
    }

    function finishSplash() {
      if (splashDone) return;
      splashDone = true;
      $('overlay-splash').hidden = true;
      $('overlay-title').hidden = false;
    }

    /* ---------------- narration ---------------- */

    function say(lines, cls) {
      const box = $('msgbox');
      const arr = Array.isArray(lines) ? lines : [lines];
      const spoken = [];
      for (const item of arr) {
        const o = typeof item === 'string' ? { text: item, cls: cls || '' } : item;
        if (!o || o.text === undefined || o.text === '') continue;
        spoken.push(String(o.text));
        const d = document.createElement('div');
        d.className = 'line' + (o.cls ? ' ' + o.cls : '');
        d.textContent = o.text;
        box.appendChild(d);
      }
      while (box.children.length > 200) box.removeChild(box.firstChild);
      box.scrollTop = box.scrollHeight;
      if (speechEnabled && global.speechSynthesis && global.SpeechSynthesisUtterance) {
        try { global.speechSynthesis.cancel(); global.speechSynthesis.speak(new global.SpeechSynthesisUtterance(spoken.join(' '))); } catch (e) { /* optional */ }
      }
    }

    /* ---------------- scene state ---------------- */

    function sceneFlags() {
      const F = engine.flags;
      const vis = engine.visibleItems();
      return {
        gatesOpen: !!F.gatesOpen, tunnelDug: !!F.tunnelDug,
        mirrorOpened: !!F.mirrorOpened, flourRevealed: !!F.flourRevealed,
        boatPatched: !!F.boatPatched, guardDancing: !!F.guardDancing,
        hatchOpen: engine.isOpen('hatch'), clockOpen: engine.isOpen('clock'),
        vaultOpen: engine.isOpen('vaultDoor'), sarcOpen: engine.isOpen('sarcophagus'),
        crownTaken: !vis.includes('crown'), idolTaken: !vis.includes('idol'),
        sunstoneTaken: !vis.includes('sunstone')
      };
    }

    /* Hotspot rectangles, normalised and filtered to what's actually there. */
    function activeSpots() {
      if (!scene) return [];
      const vis = engine.visibleItems();
      const F = engine.flags;
      const out = [];
      const defined = new Set();
      for (const s of (scene.spots || [])) {
        defined.add(s.id);
        if (s.onlyIf && !F[s.onlyIf]) continue;
        // Inventory items are no longer scene objects. Keeping them active
        // here made a second click target an item the player already held.
        const present = vis.includes(s.id);
        if (s.icon && !vis.includes(s.id)) continue;      // taken, or not revealed
        if (!s.icon && !present) continue;                // scenery that has gone
        const rect = (s.w && s.h)
          ? [s.x, s.y, s.w, s.h]
          : [s.x - 11, s.y - 11, 22, 22];
        out.push({
          id: s.id, rect, walkTo: s.walkTo,
          icon: !!s.icon, iconAt: s.iconAt || [s.x, s.y],
          label: (world.objects[s.id] || {}).name || s.id
        });
      }

      // Containers can receive arbitrary carried objects. If a scene has no
      // authored hotspot for one of those contents, synthesize a small icon
      // hotspot inside the open container so the player can recover it.
      for (const id of vis) {
        if (defined.has(id) || !world.objects[id]) continue;
        for (const containerId in world.objects) {
          const container = world.objects[containerId];
          if (!container.container || !engine.isOpen(containerId)) continue;
          if (!engine.contentsOf(containerId).includes(id)) continue;
          const cs = (scene.spots || []).find((spot) => spot.id === containerId);
          if (!cs) continue;
          const contents = engine.contentsOf(containerId);
          const index = contents.indexOf(id);
          const cx = (cs.x || 0) + (cs.w || 22) / 2 + ((index % 3) - 1) * 10;
          const cy = (cs.y || 0) + Math.min((cs.h || 22) / 2, 18) + Math.floor(index / 3) * 10;
          out.push({
            id, rect: [cx - 9, cy - 9, 18, 18], walkTo: cs.walkTo || [cx, cy],
            icon: true, iconAt: [cx, cy],
            label: (world.objects[id] || {}).name || id
          });
          break;
        }
      }
      return out;
    }

    function activeExits() {
      if (!scene) return [];
      return (scene.exits || []).filter((e) => {
        if (e.needs && !engine.flags[e.needs]) return false;
        return true;
      });
    }

    function hit(list, x, y) {
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i].rect || [list[i].x, list[i].y, list[i].w, list[i].h];
        if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return list[i];
      }
      return null;
    }

    /* ---------------- rendering ---------------- */

    function repaintBackground() {
      const f = sceneFlags();
      const key = sceneId + '|' + JSON.stringify(f);
      if (key === bgKey) return;
      bgKey = key;
      bgG.clear(bgG.C.black);
      if (scene && scene.paint) scene.paint(bgG, f);
    }

    function draw() {
      if (!scene) return;
      repaintBackground();
      g.ctx.drawImage(bg, 0, 0, gfx.W, gfx.H);

      const f = engine.flags;
      const drawables = [];

      // loose items lying in the room
      for (const s of activeSpots()) {
        if (!s.icon) continue;
        const itemScale = scenes.itemScale(scene, s.iconAt[1]) * (g.profileName === 'vga' ? 1.18 : 1);
        drawables.push({ y: s.iconAt[1], fn: () => sprites.drawItem(g, s.id, s.iconAt[0], s.iconAt[1], itemScale) });
      }

      // the spectral sentinel, still on duty or just going off it
      if (sceneId === 'guardroom' && (!f.guardDancing || T < danceUntil)) {
        const dancing = !!f.guardDancing;
        const sx = dancing ? 160 + Math.sin((T - danceUntil) / 260) * 40 : 160;
        drawables.push({ y: 168, fn: () => sprites.drawSentinel(g, sx, 168, T, dancing) });
      }

      // the actor
      drawables.push({
        y: actor.y,
        fn: () => sprites.drawActor(g, actor.x, actor.y, {
          cls: rpg.avatar() ? rpg.avatar().cls : 'delver',
          scale: scenes.actorScale(scene, actor.y) * (g.profileName === 'vga' ? 1.10 : 1),
          facing: actor.facing, frame: actor.frame, walking: actor.walking,
          lantern: engine.inventory().includes('lantern') && engine.isDark() && engine.hasLight()
        })
      });

      // an active monster squares up on the right, in front of everything
      const fight = rpg.active();
      if (fight) {
        drawables.push({ y: 999, fn: () => sprites.monster(fight.kind)(g, FOE_X, FOE_Y, T, fight.hp < fight.maxHp * 0.4) });
      }

      drawables.sort((a, b) => a.y - b.y);
      for (const d of drawables) d.fn();

      if (scene.fg) scene.fg(g, sceneFlags(), T);

      // darkness: a pool of lamplight, or nothing at all
      if (engine.isDark()) {
        if (engine.hasLight()) {
          // centred above the actor's head so wall-height scenery — thrones,
          // portraits, altars — falls inside the pool rather than above it
          const r = engine.inventory().includes('sunstone') ? 146 : 120;
          g.darkness(actor.x, actor.y - 30, r);
          g.lightPool(actor.x, actor.y - 8, r * 0.46, g.C.yellow);
        } else {
          g.darkness(actor.x, actor.y - 20, fight ? 68 : 0);
        }
      }
    }

    function update(dt) {
      if (actor.moving) {
        const dx = actor.tx - actor.x, dy = actor.ty - actor.y;
        const d = Math.hypot(dx, dy);
        const sc = scenes.scaleAt(scene, actor.y);
        const spd = 46 + 34 * sc;
        if (d <= Math.max(1.5, spd * dt)) {
          actor.x = actor.tx; actor.y = actor.ty;
          actor.moving = false; actor.walking = false;
          arrive();
        } else {
          const step = spd * dt;
          actor.x += (dx / d) * step;
          actor.y += (dy / d) * step;
          actor.phase += step * 0.30;
          actor.frame = Math.floor(actor.phase) % 4;
          actor.walking = true;
          actor.facing = Math.abs(dx) > Math.abs(dy) * 1.1
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'down' : 'up');
        }
      }
    }

    function loop(ts) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (ts - last) / 1000 || 0);
      last = ts; T = ts;
      drawSplash(ts);
      if (!started) return;
      update(dt);
      draw();
    }

    /* ---------------- walking and arrival ---------------- */

    function walkTo(x, y, then) {
      const p = scenes.clampToWalk(scene, x, y);
      actor.tx = p[0]; actor.ty = p[1];
      pending = then || null;
      const d = Math.hypot(actor.tx - actor.x, actor.ty - actor.y);
      if (d < 2) { actor.moving = false; arrive(); return; }
      actor.moving = true;
      rpg.use('agi', 1);
    }

    function arrive() {
      const p = pending;
      pending = null;
      if (p) p();
    }

    /* ---------------- the engine bridge ---------------- */

    function pushUndo() {
      undoStack.push(rpg.serialize());
      if (undoStack.length > UNDO_MAX) undoStack.shift();
    }

    function run(action) {
      if (!action) return;
      pushUndo();

      // watch for treasure milestones so the adventure feeds the RPG layer
      const t = action.target;
      const isTreasure = t && world.treasures.includes(t);
      const hadIt = isTreasure && !!engine.flags['treasureTaken_' + t];
      const placedBefore = engine.meta().treasuresPlaced;

      const res = engine.handleAction(action);
      const m = res.meta || {};
      const msgs = res.messages || [];

      const bad = msgs.some((x) => x.cls === 'bad');
      const scored = msgs.some((x) => x.cls === 'scored' || x.cls === 'good');
      if (bad) audio.thud(); else if (scored) audio.chime();

      say(msgs);

      if (isTreasure && !hadIt && engine.flags['treasureTaken_' + t]) say(rpg.award(30));
      if (engine.meta().treasuresPlaced > placedBefore) say(rpg.award(25));

      // the lullaby is the one tune the game plays diegetically
      if (action.verb === 'play' || action.verb === 'sing') {
        if (engine.flags.melodyKnown) {
          music.play('lullaby', { then: scene.music || 'manor' });
          if (engine.flags.guardDancing && !danceUntil) danceUntil = T + 6000;
        }
      }

      refresh();

      if (m.win) { onWin(); return; }
      if (m.death) { onDeath('engine'); return; }

      burnLamp();
      checkDark();
      autosave();
    }

    /* Is the lantern specifically the thing that is burning? */
    function lanternLit() {
      if (!engine.inventory().includes('lantern')) return false;
      const o = engine.state.obj.lantern;
      return !o || o.lit !== false;
    }

    /* The lamp only burns oil where it is actually needed. Fuel lives on
       engine.flags so it rides along with saves and undo for free. */
    function burnLamp() {
      if (!engine.isDark() || !lanternLit()) return;
      const F = engine.flags;
      if (F.lampFuel === undefined) F.lampFuel = LAMP_FULL;
      F.lampFuel--;
      if (F.lampFuel === 60) say([{ text: 'The lantern flame has gone thin and blue. It will not last forever.', cls: 'dim' }]);
      else if (F.lampFuel === 25) say([{ text: 'The lantern gutters. You can see the oil line from outside the glass now.', cls: 'bad' }]);
      else if (F.lampFuel <= 0) {
        engine.handleAction({ verb: 'turn', target: 'lantern', with: 'off' });   // messages discarded on purpose
        say([{ text: 'The lantern burns down to nothing and goes out. The dark steps in immediately, as if it had been queuing.', cls: 'bad' }]);
        audio.thud();
      }
    }

    /* Verb + hotspot -> an engine action. */
    function actionFor(id) {
      const o = world.objects[id];
      if (!o) return null;

      if (verb === 'look') {
        const up = rpg.firstLook(id);
        if (up) say([{ text: up, cls: 'scored' }]);
        return { verb: 'examine', target: id };
      }
      if (verb === 'talk') {
        if (id === 'gates' && sceneId === 'caveMouth' && !engine.flags.gatesOpen) {
          openSpeak();
          return null;
        }
        return { verb: 'talk', target: id };
      }
      if (verb === 'attack') {
        rpg.use('str', 1);
        return { verb: 'attack', target: id };
      }
      if (verb === 'item' && held) return useOn(held, id);

      // Hand: the context-sensitive one
      if (o.takeable) return { verb: 'take', target: id };
      if (o.container) return engine.isOpen(id)
        ? { verb: 'close', target: id }
        : { verb: 'open', target: id };
      if (id === 'door') return { verb: 'open', target: id };
      if (id === 'sarcophagus' || id === 'mirror') return { verb: 'push', target: id };
      rpg.use('str', 1);
      return { verb: 'push', target: id };
    }

    /* Using a carried item on something. Mirrors the gestures the
       text parser supported, so no puzzle needs typing. */
    function useOn(item, id) {
      const target = world.objects[id];
      if (item === 'oilJar' && id === 'lantern') {
        engine.flags.lampFuel = LAMP_FULL;
        engine.handleAction({ verb: 'turn', target: 'lantern', with: 'on' });
        return { verb: 'use', target: 'oilJar', with: 'lantern' };
      }
      if (item === 'lyre') return { verb: 'play', target: 'lyre' };
      if (item === 'musicSheet') return { verb: 'read', target: 'musicSheet' };
      if (item === 'shovel' && (id === 'crack' || sceneId === 'cellar')) { rpg.use('str', 3); return { verb: 'dig' }; }
      if ((item === 'pitchPot' || item === 'curtain') && id === 'boat') return { verb: 'fix', target: 'boat' };
      if (item === 'flour' && id === 'mirror') return { verb: 'throw', target: 'flour' };
      if (target && target.key === item) return { verb: 'unlock', target: id, with: item };
      if (target && target.container && !engine.isLocked(id)) return { verb: 'put', target: item, with: id };
      return { verb: 'use', target: item, with: id };
    }

    /* ---------------- clicking ---------------- */

    function stageClick(cx, cy) {
      if (rpg.active()) return;                      // combat owns the input
      if (!$('speak-panel').hidden) return;

      const spots = activeSpots();
      const exits = activeExits();

      if (verb === 'walk') {
        const ex = hit(exits.map((e) => ({ ...e, rect: [e.x, e.y, e.w, e.h] })), cx, cy);
        if (ex) { walkTo(ex.walkTo[0], ex.walkTo[1], () => go(ex.dir)); return; }
        const sp = hit(spots, cx, cy);
        if (sp) { walkTo(sp.walkTo[0], sp.walkTo[1]); return; }
        walkTo(cx, cy);
        return;
      }

      const sp = hit(spots, cx, cy);
      if (sp) {
        walkTo(sp.walkTo[0], sp.walkTo[1], () => {
          const a = actionFor(sp.id);
          if (a) run(a);
          if (verb === 'item') clearHeld();
        });
        return;
      }

      const ex = hit(exits.map((e) => ({ ...e, rect: [e.x, e.y, e.w, e.h] })), cx, cy);
      if (ex && verb === 'look') { say([{ text: 'A way ' + dirName(ex.dir) + '.', cls: 'dim' }]); return; }

      if (verb === 'look') { say([{ text: 'You see nothing special there.', cls: 'dim' }]); return; }
      if (verb === 'item') { say([{ text: 'You wave the ' + world.objects[held].name + ' at nothing in particular.', cls: 'dim' }]); return; }
      say([{ text: 'Nothing there responds to that.', cls: 'dim' }]);
    }

    function dirName(d) {
      return { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down' }[d];
    }

    function go(dir) {
      const before = engine.currentRoom();
      run({ verb: 'move', text: dir });
      const after = engine.currentRoom();
      if (after !== before) enterRoom(after, dir);
    }

    /* ---------------- rooms ---------------- */

    function enterRoom(rid, camefrom) {
      sceneId = rid;
      scene = scenes.get(rid);
      if (!scene) { scene = scenes.get('yard'); sceneId = 'yard'; }
      bgKey = '';
      // Fall back through: the direction travelled, a declared start, the
      // room centre — then clamp, so a restored save can never strand the
      // actor off the walkable floor.
      const ent = scene.entry || {};
      const e = scenes.clampToWalk(scene, ...(ent[camefrom] || ent.start || [160, 172]));
      actor.x = e[0]; actor.y = e[1];
      actor.tx = actor.x; actor.ty = actor.y;
      actor.moving = false; actor.walking = false;
      danceUntil = 0;
      audio.blip();

      const track = scene.music || 'manor';
      if (music.current() !== track && music.current() !== 'lullaby') music.play(track);

      // an optional early scrap, to teach the combat panel. The flag lives
      // on engine.flags so it survives saves and page reloads — as a plain
      // controller variable it re-triggered every time the page was loaded.
      if (rid === 'lakeShore' && !engine.flags.lurkerMet) {
        engine.flags.lurkerMet = true;
        global.setTimeout(() => beginFight('lurker'), 700);
      }
      refresh();
      checkDark();
    }

    /* ---------------- darkness and the Umbra ---------------- */

    function checkDark() {
      if (!engine.isDark() || engine.hasLight()) { darkTurns = 0; return; }
      if (rpg.active()) return;
      darkTurns++;
      if (darkTurns === 1) {
        say([{ text: 'It is pitch black. Something in here is deciding what you are.', cls: 'bad' }]);
        audio.thud();
        return;
      }
      if (darkTurns >= 2) beginFight('umbra');
    }

    /* ---------------- combat ---------------- */

    function beginFight(kind) {
      if (rpg.active()) return;
      const f = rpg.start(kind, { room: sceneId });
      if (!f) return;
      // square off, so the pair of you are both actually visible
      const p = scenes.clampToWalk(scene, HERO_X, HERO_Y);
      actor.x = p[0]; actor.y = p[1];
      actor.tx = p[0]; actor.ty = p[1];
      actor.moving = false; actor.walking = false;
      actor.facing = 'right';
      music.play('combat');
      audio.sting();
      say(f.log);
      $('combat-panel').hidden = false;
      renderCombat();
    }

    function renderCombat() {
      const f = rpg.active();
      if (!f) return;
      const a = rpg.avatar();
      $('cb-name').textContent = f.name;
      const pct = Math.max(0, (f.hp / f.maxHp) * 100);
      $('cb-hp').style.width = pct + '%';
      $('cb-round').textContent = 'Round ' + f.round;
      const lit = lightSource();
      const btn = $('cb-light');
      btn.disabled = !lit;
      btn.textContent = lit ? ('Raise ' + world.objects[lit].name) : 'No light to raise';
      $('cb-you').style.width = Math.max(0, (a.hp / a.maxHp) * 100) + '%';
      $('cb-youhp').textContent = a.hp + ' / ' + a.maxHp;
    }

    /* What could we hold up at a thing that hates light? */
    function lightSource() {
      const inv = engine.inventory();
      if (inv.includes('sunstone')) return 'sunstone';
      if (inv.includes('lantern')) return 'lantern';
      if (inv.includes('candle')) return 'candle';
      return null;
    }

    function combatAct(what) {
      const f = rpg.active();
      if (!f || f.over) return;
      const ctx = {};
      if (what === 'light') {
        const src = lightSource();
        if (!src) return;
        ctx.light = world.objects[src].name;
        // raising an unlit lantern means lighting it first — which also
        // happens to solve the darkness that summoned the Umbra
        if (src === 'lantern' || src === 'candle') {
          engine.handleAction({ verb: 'turn', target: src, with: 'on' });
        }
      }
      if (what === 'attack') ctx.weapon = engine.inventory().includes('knife');

      const r = rpg.act(what, ctx);
      say(r.lines);
      if (r.lines.some((l) => l.cls === 'bad')) audio.thud();
      else if (r.lines.some((l) => l.cls === 'good')) audio.chime();

      renderCombat();
      refresh();

      if (!r.over) return;

      rpg.endFight();
      $('combat-panel').hidden = true;

      if (r.died) { onDeath('combat'); return; }
      music.play(scene.music || 'manor');
      if (r.won) audio.fanfare();
      darkTurns = -4;                         // a grace period before the dark tries again
      autosave();
    }

    /* ---------------- panels ---------------- */

    function iconCanvas(id, size) {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const gg = gfx.create(c, { profile: gfx.profileNames[profileIndex], resize: false });
      gg.ctx.setTransform(size / 26, 0, 0, size / 26, 0, 0);
      sprites.drawItem(gg, id, 13, 13);
      gg.ctx.setTransform(1, 0, 0, 1, 0, 0);
      return c;
    }

    function refresh() {
      const m = engine.meta();
      const a = rpg.avatar();
      $('hud-room').textContent = m.roomName;
      $('hud-score').textContent = 'Score ' + m.score;
      $('hud-treasure').textContent = 'Regalia ' + m.treasuresPlaced + '/6';

      if (a) {
        $('st-class').textContent = rpg.CLASSES[a.cls].name + ' · Level ' + a.level;
        $('st-hp-bar').style.width = Math.max(0, (a.hp / a.maxHp) * 100) + '%';
        $('st-hp-text').textContent = a.hp + ' / ' + a.maxHp;
        const need = rpg.xpFor(a.level + 1), have = a.xp, base = rpg.xpFor(a.level);
        const pct = Math.max(0, Math.min(100, ((have - base) / Math.max(1, need - base)) * 100));
        $('st-xp-bar').style.width = pct + '%';
        $('st-xp-text').textContent = a.xp + ' xp (' + rpg.xpToNext() + ' to go)';
        const list = $('st-stats');
        list.innerHTML = '';
        for (const k of ['str', 'agi', 'vit', 'lore', 'luck']) {
          const li = document.createElement('li');
          const n = document.createElement('span');
          n.textContent = rpg.STAT_NAMES[k];
          const v = document.createElement('b');
          v.textContent = a.stats[k];
          li.appendChild(n); li.appendChild(v);
          list.appendChild(li);
        }
      }

      const strip = $('inv-strip');
      strip.innerHTML = '';
      const inv = engine.inventory();
      if (!inv.length) {
        const d = document.createElement('div');
        d.className = 'inv-empty';
        d.textContent = 'carrying nothing';
        strip.appendChild(d);
      }
      for (const id of inv) {
        const o = world.objects[id];
        if (!o) continue;
        const b = document.createElement('button');
        b.className = 'inv-item' + (held === id ? ' held' : '');
        b.title = o.name;
        b.appendChild(iconCanvas(id, 34));
        const lab = document.createElement('span');
        lab.textContent = o.name;
        if (id === 'lantern') {
          const fuel = engine.flags.lampFuel;
          if (!lanternLit()) { lab.textContent = o.name + ' (out)'; b.classList.add('spent'); }
          else if (fuel !== undefined && fuel <= 60) { lab.textContent = o.name + ' (low)'; b.classList.add('low'); }
        }
        b.appendChild(lab);
        b.addEventListener('click', () => {
          if (verb === 'look') { run({ verb: 'examine', target: id }); return; }
          // item-on-item: the lens reads the note, the oil feeds the lamp
          if (held && held !== id) {
            const a = useOn(held, id);
            clearHeld();
            if (a) run(a);
            return;
          }
          if (held === id) { clearHeld(); return; }
          held = id; verb = 'item';
          syncVerbs();
          refresh();
        });
        strip.appendChild(b);
      }
    }

    function cycleProfile() {
      profileIndex = (profileIndex + 1) % gfx.profileNames.length;
      const name = gfx.profileNames[profileIndex];
      gfx.setDefaultProfile(name);
      const canvas = $('stage');
      g = gfx.create(canvas, { profile: name });
      bgG = gfx.create(bg, { profile: name });
      splashG = gfx.create($('splash-stage'), { profile: name });
      titleHeroG = gfx.create($('title-hero'), { profile: name, logicalWidth: 320, logicalHeight: 112 });
      bgKey = '';
      $('btn-video').textContent = gfx.getProfile(name).name;
      drawTitleHero();
      refresh();
    }

    function clearHeld() {
      held = null;
      if (verb === 'item') verb = 'walk';
      syncVerbs();
      refresh();
    }

    function syncVerbs() {
      for (const v of VERBS) {
        const b = $('vb-' + v);
        if (b) b.classList.toggle('on', verb === v);
      }
      const stage = $('stage');
      stage.dataset.verb = verb;
      $('cursor-label').textContent = verb === 'item' && held
        ? 'Use ' + world.objects[held].name + ' on…'
        : VERB_LABEL[verb];
    }

    /* ---------------- speak (the cavern riddle) ---------------- */

    function openSpeak() {
      $('speak-panel').hidden = false;
      $('speak-riddle').textContent =
        'I borrow every voice you give me, then return it from stone. I have no throat, but caves teach me to answer. What am I?';
      $('speak-input').value = '';
      $('speak-input').focus();
    }

    function submitSpeak() {
      const v = $('speak-input').value.trim();
      $('speak-panel').hidden = true;
      if (!v) return;
      say([{ text: '"' + v + '"', cls: 'command' }]);
      run({ verb: 'say', text: v });
      if (engine.flags.gatesOpen) {
        rpg.use('lore', 3);
        const lines = rpg.award(50);
        say(lines);
        bgKey = '';
        refresh();
      }
    }

    /* ---------------- overlays ---------------- */

    function onDeath(how) {
      music.stop();
      audio.sting();
      $('death-why').textContent = how === 'combat'
        ? 'Whatever was in the dark with you has finished its business.'
        : 'Ashcombe keeps what it is given.';
      $('overlay-death').hidden = false;
    }

    function onWin() {
      music.play('victory');
      $('win-rank').textContent = 'Score ' + engine.meta().score + ' · ' +
        rpg.CLASSES[rpg.avatar().cls].name + ' level ' + rpg.avatar().level;
      $('overlay-win').hidden = false;
    }

    function doUndo() {
      const res = engine.handleAction({ verb: 'undo' });
      const snap = undoStack.pop();
      if (snap) rpg.restore(snap);
      say(res.messages);
      $('overlay-death').hidden = true;
      $('combat-panel').hidden = true;
      rpg.endFight();
      darkTurns = 0;
      enterRoom(engine.currentRoom(), 'u');
      music.play(scene.music || 'manor');
    }

    /* ---------------- save ---------------- */

    function autosave() {
      const m = engine.meta();
      if (m.death || m.win) return;
      save.autosave({
        state: engine.serialize(), rpg: rpg.serialize(),
        score: m.score, turns: m.turns, roomName: m.roomName
      });
    }

    function saveTo(slot) {
      const m = engine.meta();
      save.write(slot, {
        state: engine.serialize(), rpg: rpg.serialize(),
        score: m.score, turns: m.turns, roomName: m.roomName
      });
      say([{ text: 'Saved to slot ' + slot + '.', cls: 'info' }]);
    }

    function loadFrom(slot) {
      const d = save.read(slot);
      if (!d || !d.state) { say([{ text: 'Slot ' + slot + ' is empty.', cls: 'bad' }]); return false; }
      engine.restore(d.state);
      if (d.rpg) rpg.restore(d.rpg);
      resumeInto();
      say([{ text: 'Restored from slot ' + slot + '.', cls: 'info' }]);
      return true;
    }

    function portablePayload() {
      const m = engine.meta();
      return { state: engine.serialize(), rpg: rpg.serialize(), score: m.score, turns: m.turns, roomName: m.roomName };
    }

    function exportCode() {
      const code = save.exportCode(portablePayload());
      global.prompt('Copy this portable save code. It contains no file path or external service reference:', code);
    }

    function importCode() {
      const code = global.prompt('Paste a portable save code:');
      if (!code) return;
      const data = save.importCode(code);
      if (!data) {
        say([{ text: 'That save code is not valid for The Sunken Crown.', cls: 'bad' }]);
        return;
      }
      engine.restore(data.state);
      if (data.rpg) rpg.restore(data.rpg);
      if (!rpg.isReady()) rpg.begin('delver');
      resumeInto();
      say([{ text: 'Portable save restored.', cls: 'info' }]);
    }

    function resumeInto(camefrom) {
      started = true;
      $('overlay-title').hidden = true;
      $('overlay-death').hidden = true;
      $('overlay-win').hidden = true;
      $('combat-panel').hidden = true;
      rpg.endFight();
      undoStack = [];
      darkTurns = 0;
      enterRoom(engine.currentRoom(), camefrom || 'start');
      say(engine.describeRoom(engine.currentRoom(), true));
      refresh();
    }

    /* ---------------- start ---------------- */

    function startNew(cls) {
      engine.newGame();
      engine.setExternalDarkness(true);
      rpg.begin(cls);
      $('msgbox').innerHTML = '';
      say(engine.intro.map((t) => ({ text: t, cls: 'intro' })));
      resumeInto();
      music.play(scene.music || 'manor');
    }

    /* ---------------- init ---------------- */

    function init() {
      const canvas = $('stage');
      canvas.width = gfx.W; canvas.height = gfx.H;
      g = gfx.create(canvas, { profile: gfx.profileNames[profileIndex] });

      splashG = gfx.create($('splash-stage'), { profile: gfx.profileNames[profileIndex] });
      titleHeroG = gfx.create($('title-hero'), { profile: gfx.profileNames[profileIndex], logicalWidth: 320, logicalHeight: 112 });
      drawTitleHero();
      splashStart = performance.now();
      audio.splash();
      $('overlay-splash').addEventListener('click', () => {
        audio.unlock();
        finishSplash();
      });

      bg = document.createElement('canvas');
      bg.width = gfx.W; bg.height = gfx.H;
      bgG = gfx.create(bg, { profile: gfx.profileNames[profileIndex] });

      engine.setExternalDarkness(true);
      scene = scenes.get('yard'); sceneId = 'yard';

      /* stage input */
      const toStage = (ev) => {
        const r = canvas.getBoundingClientRect();
        return [
          Math.round(((ev.clientX - r.left) / r.width) * gfx.W),
          Math.round(((ev.clientY - r.top) / r.height) * gfx.H)
        ];
      };

      canvas.addEventListener('click', (ev) => {
        if (!started) return;
        const [x, y] = toStage(ev);
        stageClick(x, y);
      });

      canvas.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        if (held) { clearHeld(); return; }
        const i = VERBS.indexOf(verb);
        verb = VERBS[(i + 1) % VERBS.length];
        syncVerbs();
      });

      canvas.addEventListener('mousemove', (ev) => {
        if (!started) return;
        const [x, y] = toStage(ev);
        const sp = hit(activeSpots(), x, y);
        const ex = sp ? null : hit(activeExits().map((e) => ({ ...e, rect: [e.x, e.y, e.w, e.h] })), x, y);
        const label = sp ? sp.label : (ex ? ('go ' + dirName(ex.dir)) : '');
        if (label !== hover) { hover = label; $('hover-label').textContent = label; }
      });

      /* verb bar */
      for (const v of VERBS) {
        $('vb-' + v).addEventListener('click', () => {
          verb = v; held = null; syncVerbs(); refresh();
        });
      }

      /* combat */
      $('cb-attack').addEventListener('click', () => combatAct('attack'));
      $('cb-defend').addEventListener('click', () => combatAct('defend'));
      $('cb-light').addEventListener('click', () => combatAct('light'));
      $('cb-flee').addEventListener('click', () => combatAct('flee'));

      /* speak */
      $('speak-go').addEventListener('click', submitSpeak);
      $('speak-cancel').addEventListener('click', () => { $('speak-panel').hidden = true; });
      $('speak-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submitSpeak(); }
        if (e.key === 'Escape') $('speak-panel').hidden = true;
      });

      /* top bar */
      $('btn-undo').addEventListener('click', doUndo);
      $('btn-save').addEventListener('click', () => saveTo(1));
      $('btn-load').addEventListener('click', () => loadFrom(1));
      $('btn-export').addEventListener('click', exportCode);
      $('btn-import').addEventListener('click', importCode);
      $('btn-music').addEventListener('click', () => {
        const on = !music.isEnabled();
        music.setEnabled(on);
        $('btn-music').textContent = on ? '♫ Music' : '♫ Muted';
        if (on && started) music.play(scene.music || 'manor');
      });
      $('btn-sfx').addEventListener('click', () => {
        const on = !audio.isEnabled();
        audio.setEnabled(on);
        $('btn-sfx').textContent = on ? '♪ Sound' : '♪ Muted';
      });
      $('btn-video').addEventListener('click', cycleProfile);
      $('btn-speech').addEventListener('click', () => {
        speechEnabled = !speechEnabled;
        $('btn-speech').textContent = speechEnabled ? 'Speech on' : 'Speech off';
        if (!speechEnabled && global.speechSynthesis) global.speechSynthesis.cancel();
      });
      $('btn-text').addEventListener('click', () => { global.location.href = 'text.html'; });

      /* overlays */
      $('btn-death-undo').addEventListener('click', doUndo);
      $('btn-death-restart').addEventListener('click', () => {
        $('overlay-death').hidden = true;
        $('overlay-title').hidden = false;
      });
      $('btn-win-again').addEventListener('click', () => {
        $('overlay-win').hidden = true;
        $('overlay-title').hidden = false;
      });
      $('btn-win-stay').addEventListener('click', () => { $('overlay-win').hidden = true; });

      /* class select */
      for (const cls of Object.keys(rpg.CLASSES)) {
        const b = $('cls-' + cls);
        if (!b) continue;
        b.addEventListener('click', () => {
          music.unlock(); audio.unlock();
          startNew(cls);
        });
      }
      const cont = $('btn-continue');
      const auto = save.readAutosave();
      if (auto && auto.state) {
        cont.hidden = false;
        cont.addEventListener('click', () => {
          music.unlock(); audio.unlock();
          engine.restore(auto.state);
          engine.setExternalDarkness(true);
          if (auto.rpg) rpg.restore(auto.rpg);
          if (!rpg.isReady()) rpg.begin('delver');
          $('msgbox').innerHTML = '';
          say([{ text: 'The mist remembers you.', cls: 'dim' }]);
          resumeInto();
          music.play(scene.music || 'manor');
        });
      }

      global.addEventListener('keydown', (e) => {
        music.unlock(); audio.unlock();
        if (!splashDone) {
          finishSplash();
          return;
        }
        if (e.key === 'Escape') {
          if (held) { clearHeld(); return; }
          $('speak-panel').hidden = true;
        }
        if (!started) return;
        const map = { '1': 'walk', '2': 'look', '3': 'hand', '4': 'talk', '5': 'attack' };
        if (map[e.key]) { verb = map[e.key]; held = null; syncVerbs(); refresh(); }
        if (e.key === 'Tab') {
          e.preventDefault();
          const i = VERBS.indexOf(verb);
          verb = VERBS[(i + 1) % VERBS.length];
          syncVerbs();
        }
      });

      syncVerbs();
      refresh();
      raf = requestAnimationFrame(loop);
    }

    return { init };
  })();

  Z.game = game;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => game.init());
    } else {
      game.init();
    }
  }
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
