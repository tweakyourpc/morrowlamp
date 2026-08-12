/* ============================================================
   THE SUNKEN CROWN — UI layer
   Terminal rendering, typewriter, HUD, map, inventory, save
   slots, overlays, title screen, tab completion, settings.
   Requires the DOM; skipped entirely under Node (tests).
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const world = Z.world;
  const engine = Z.engine;
  const parser = Z.parser;
  const audio = Z.audio;
  const save = Z.save;

  const TITLE_ART = [
    ' SSSS  U   U N   N K   K EEEEE N   N',
    'S      U   U NN  N K  K  E     NN  N',
    ' SSS   U   U N N N KKK   EEEE  N N N',
    '    S  U   U N  NN K  K  E     N  NN',
    'SSSS    UUU  N   N K   K EEEEE N   N',
    '',
    '    CCCC  RRRR   OOO  W   W N   N',
    '   C      R   R O   O W   W NN  N',
    '   C      RRRR  O   O W W W N N N',
    '   C      R  R  O   O WW WW N  NN',
    '    CCCC  R   R  OOO  W   W N   N'
  ].join('\n');

  const DIRECTIONS = ['n', 's', 'e', 'w', 'u', 'd'];
  const NS = 'http://www.w3.org/2000/svg';

  const DEFAULTS = { typewriter: 'normal', speech: 'off', fontsize: 1, theme: 'ember', sound: true };

  const ui = (function () {
    let settings = Object.assign({}, DEFAULTS);
    let titleShowing = false;
    let lastRoom = null;
    let history = [];
    let histIdx = 0;
    let outputGen = 0;       // bumped by clearOutput to cancel running typers
    let hintList = [];       // active tab-completion chips
    let hintIdx = -1;
    let slotMode = null;     // 'save' | 'load' | null
    let vocab = new Set();   // words for tab completion

    /* ---------------- helpers ---------------- */

    function byId(id) { return document.getElementById(id); }
    function el(tag, cls, text) {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text !== undefined) n.textContent = text;
      return n;
    }

    function autoscroll() {
      const out = byId('output');
      out.scrollTop = out.scrollHeight;
    }

    function speak(text) {
      if (settings.speech !== 'on') return;
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.05;
        global.speechSynthesis.cancel();
        global.speechSynthesis.speak(u);
      } catch (e) { /* speech is a nice-to-have */ }
    }

    /* ---------------- typewriter ---------------- */

    function instantText() {
      return settings.typewriter === 'off'
        || (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function appendMessage(item) {
      const out = byId('output');
      const text = String(item.text == null ? '' : item.text);
      const cls = item.cls || '';
      const div = el('div', 'msg' + (cls ? ' ' + cls : ''));
      const span = el('span', 'm-text');
      div.appendChild(span);
      out.appendChild(div);

      if (cls === 'room-name') speak(text);
      else if (cls === 'ascii') audio.blip();

      if (instantText() || text.length > 400) {
        span.textContent = text;
        autoscroll();
        return;
      }
      const gen = outputGen;
      const delay = settings.typewriter === 'fast' ? 5 : 14;
      let i = 0;
      (function step() {
        if (gen !== outputGen) return;   // output was cleared mid-typing
        i++;
        span.textContent = text.slice(0, i);
        if (i % 2 === 0) audio.tick();
        autoscroll();
        if (i < text.length) global.setTimeout(step, delay);
      })();
    }

    // Accepts array of {text, cls} or plain strings.
    function printMessages(list) {
      for (const item of list) {
        appendMessage(typeof item === 'string' ? { text: item, cls: '' } : item);
      }
    }

    function clearOutput() {
      outputGen++;
      const out = byId('output');
      out.innerHTML = '';
      titleShowing = false;
    }

    function echo(raw) {
      const div = el('div', 'msg command');
      const span = el('span', 'm-text', raw);
      div.appendChild(span);
      byId('output').appendChild(div);
      autoscroll();
    }

    /* ---------------- settings ---------------- */

    function applySettings() {
      const body = document.body;
      body.className = body.className.replace(/\btheme-\S+/g, '').trim();
      body.classList.add('theme-' + settings.theme);
      document.documentElement.style.fontSize = (settings.fontsize * 16) + 'px';
      audio.setEnabled(settings.sound);
      byId('btn-sound').textContent = settings.sound ? '♪ On' : '♪ Off';
      byId('set-typewriter').value = settings.typewriter;
      byId('set-speech').value = settings.speech;
      byId('set-fontsize').value = String(settings.fontsize);
      byId('set-theme').value = settings.theme;
    }

    function loadSettings() {
      const s = save.loadSettings();
      if (s) settings = Object.assign(DEFAULTS, s);
      applySettings();
    }

    function persistSettings() {
      save.saveSettings(settings);
      applySettings();
    }

    /* ---------------- HUD / panels ---------------- */

    function refresh() {
      const m = engine.meta();
      byId('hud-score').textContent = 'Score ' + m.score;
      byId('hud-turns').textContent = m.turns + ' moves';
      byId('hud-treasure').textContent = 'Treasures ' + m.treasuresPlaced + '/6';
      byId('room-status').textContent = '✦ ' + m.roomName;
      renderInventory();
      renderMap();
    }

    function renderInventory() {
      const list = byId('inv-list');
      list.innerHTML = '';
      const ids = engine.inventory();
      if (!ids.length) {
        list.appendChild(el('li', 'inv-empty', '— empty —'));
        return;
      }
      for (const id of ids) {
        const o = world.objects[id];
        if (!o) continue;
        const li = el('li');
        const dot = el('span', 'inv-dot', '◆');
        const name = document.createElement('span');
        name.textContent = o.name;
        li.appendChild(dot);
        li.appendChild(name);
        li.title = 'Examine ' + o.name;
        li.addEventListener('click', () => runCommand('examine ' + (o.aliases[0] || o.name)));
        list.appendChild(li);
      }
    }

    function exitTarget(room, dir) {
      const e = room.exits[dir];
      if (!e) return null;
      return typeof e === 'string' ? e : (e.room || null);
    }

    function exitGated(room, dir) {
      const e = room.exits[dir];
      return typeof e === 'object' && e !== null && !!(e.flagReq || e.objReq || e.guardReq);
    }

    // Which direction leads from the current room to rid (if any).
    function directionTo(rid) {
      const cur = world.rooms[engine.currentRoom()];
      for (const dir of DIRECTIONS) {
        if (exitTarget(cur, dir) === rid) return dir;
      }
      return null;
    }

    function renderMap() {
      const svg = byId('map');
      svg.innerHTML = '';
      const visited = engine.visited();
      const vset = new Set(visited);
      const cur = engine.currentRoom();

      // edges — dedupe pairs, only between visited rooms
      const seen = new Set();
      for (const rid of visited) {
        const room = world.rooms[rid];
        if (!room || !room.map) continue;
        for (const dir of DIRECTIONS) {
          const t = exitTarget(room, dir);
          if (!t || !vset.has(t)) continue;
          const a = rid < t ? rid : t;
          const b = rid < t ? t : rid;
          const key = a + '|' + b;
          if (seen.has(key)) continue;
          seen.add(key);
          const ra = world.rooms[a];
          const rb = world.rooms[b];
          if (!ra || !ra.map || !rb || !rb.map) continue;
          const line = document.createElementNS(NS, 'line');
          line.setAttribute('x1', ra.map[0]);
          line.setAttribute('y1', ra.map[1]);
          line.setAttribute('x2', rb.map[0]);
          line.setAttribute('y2', rb.map[1]);
          let cls = 'edge';
          if (exitGated(ra, dirFor(ra, b)) || exitGated(rb, dirFor(rb, a))) cls += ' secret';
          if (rid === cur && engine.canGo(dir).ok) cls += ' open';
          if (t === cur && engine.canGo(opposite(dir)).ok) cls += ' open';
          line.setAttribute('class', cls);
          svg.appendChild(line);
        }
      }

      // nodes
      for (const rid of visited) {
        const room = world.rooms[rid];
        if (!room || !room.map) continue;
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'node visited' + (rid === cur ? ' current' : ''));
        g.setAttribute('transform', 'translate(' + room.map[0] + ',' + room.map[1] + ')');
        const circle = document.createElementNS(NS, 'circle');
        circle.setAttribute('r', rid === cur ? 8 : 6);
        const label = document.createElementNS(NS, 'text');
        label.setAttribute('x', 10);
        label.setAttribute('y', 4);
        label.setAttribute('font-size', 9);
        label.textContent = room.name.split(' ')[0];
        g.appendChild(circle);
        g.appendChild(label);
        g.title = room.name;
        g.addEventListener('click', () => {
          const d = directionTo(rid);
          if (d) runCommand('go ' + d);
        });
        svg.appendChild(g);
      }
    }

    function dirFor(rid, target) {
      const room = world.rooms[rid];
      if (!room) return null;
      for (const dir of DIRECTIONS) {
        if (exitTarget(room, dir) === target) return dir;
      }
      return null;
    }

    function opposite(dir) {
      return { n: 's', s: 'n', e: 'w', w: 'e', u: 'd', d: 'u' }[dir];
    }

    /* ---------------- autosave / save slots ---------------- */

    function autosaveNow() {
      const m = engine.meta();
      if (m.death || m.win) return;
      save.autosave({ state: engine.serialize(), score: m.score, turns: m.turns, roomName: m.roomName });
    }

    function openSlotModal(mode, slot) {
      slotMode = mode;
      byId('slot-title').textContent = mode === 'save' ? 'Save Game' : 'Load Game';
      byId('slot-hint').textContent = 'Choose a slot.';
      const list = byId('slot-list');
      list.innerHTML = '';
      for (let s = 1; s <= 3; s++) {
        const info = save.slotInfo(s);
        const btn = el('button', 'btn slot-item');
        const main = document.createElement('span');
        const meta = el('span', 'slot-meta');
        if (info) {
          const d = new Date(info.savedAt);
          const when = isNaN(d.getTime()) ? '' : d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          main.textContent = 'Slot ' + s + ' — ' + info.room;
          meta.textContent = info.score + ' pts · ' + info.turns + ' turns' + (when ? ' · ' + when : '');
        } else {
          main.textContent = 'Slot ' + s + ' — empty';
        }
        btn.appendChild(main);
        btn.appendChild(meta);
        btn.addEventListener('click', () => useSlot(s));
        list.appendChild(btn);
      }
      byId('slot-backdrop').hidden = false;
      if (slot) {
        // 'save 2' / 'load 2' — act immediately
        useSlot(slot);
      }
    }

    function useSlot(s) {
      const m = engine.meta();
      if (slotMode === 'save') {
        save.write(s, { state: engine.serialize(), score: m.score, turns: m.turns, roomName: m.roomName });
        printMessages([{ text: 'Game saved to slot ' + s + '.', cls: 'info' }]);
      } else {
        const data = save.read(s);
        if (!data || !data.state) {
          printMessages([{ text: 'Slot ' + s + ' is empty.', cls: 'bad' }]);
          closeSlotModal();
          return;
        }
        engine.restore(data.state);
        clearOutput();
        printMessages([{ text: 'Game restored from slot ' + s + '.', cls: 'info' }]);
        printMessages(engine.describeRoom(engine.currentRoom(), true));
        refresh();
        autosaveNow();
      }
      closeSlotModal();
    }

    function closeSlotModal() {
      byId('slot-backdrop').hidden = true;
      slotMode = null;
      autoscroll();
    }

    /* ---------------- overlays ---------------- */

    function hideOverlays() {
      byId('death-overlay').hidden = true;
      byId('win-overlay').hidden = true;
    }

    function showDeathOverlay() {
      byId('death-overlay').hidden = false;
    }

    function showWinOverlay() {
      const m = engine.meta();
      byId('win-rank').textContent = rankName(m.score) + ' — Score ' + m.score;
      byId('win-overlay').hidden = false;
    }

    function rankName(score) {
      let name = 'Wandering Stranger';
      for (const [s, r] of world.ranks) {
        if (score >= s) name = r;
      }
      return name;
    }

    /* ---------------- command pipeline ---------------- */

    function runCommand(raw) {
      const text = String(raw == null ? '' : raw).trim();
      hideOverlays();
      if (!text) { byId('command').focus(); return; }
      echo(text);

      const action = parser.parse(text);
      const res = engine.handleAction(action);
      const m = res.meta || {};
      const messages = res.messages || [];

      // meta commands the engine handles by itself
      if (m.clear) { clearOutput(); return; }
      if (m.saveRequest !== undefined) { openSlotModal('save', m.saveRequest); return; }
      if (m.loadRequest !== undefined) { openSlotModal('load', m.loadRequest); return; }

      // sounds
      if (m.death) {
        audio.sting();
      } else if (m.win) {
        audio.fanfare();
      } else {
        const scored = messages.some((x) => x.cls === 'scored');
        const good = messages.some((x) => x.cls === 'good');
        const bad = messages.some((x) => x.cls === 'bad');
        if (bad) audio.thud();
        else if (scored || good) audio.chime();
        else if (m.room !== lastRoom) audio.blip();
      }
      lastRoom = m.room;

      printMessages(messages);
      refresh();

      if (m.death) { showDeathOverlay(); return; }
      if (m.win) { showWinOverlay(); return; }
      autosaveNow();
    }

    /* ---------------- tab completion ---------------- */

    function buildVocab() {
      const words = new Set();
      for (const v of parser.verbs) words.add(v);
      for (const d of parser.directions) words.add(d);
      for (const id in world.objects) {
        const o = world.objects[id];
        const src = [o.name].concat(o.aliases || []).join(' ');
        for (const w of src.toLowerCase().split(/[^a-z']+/)) {
          if (w.length > 1) words.add(w);
        }
      }
      return words;
    }

    function lastToken(str) {
      const t = /([^\s]+)\s*$/.exec(str);
      return t ? t[1] : '';
    }

    function fillHints() {
      const input = byId('command');
      hintList = [];
      hintIdx = -1;
      const str = input.value.slice(0, input.selectionStart || input.value.length);
      const tok = lastToken(str);
      if (!tok) { hideHints(); return; }
      const prefix = tok.toLowerCase();
      for (const w of vocab) {
        if (w.startsWith(prefix)) hintList.push(w);
      }
      if (!hintList.length) { hideHints(); return; }
      if (hintList.length === 1 && hintList[0] === tok.toLowerCase()) { hideHints(); return; }

      const box = byId('input-hints');
      box.innerHTML = '';
      for (let i = 0; i < hintList.length && i < 12; i++) {
        const w = hintList[i];
        const btn = el('button', 'btn hint-chip' + (i === hintIdx ? ' active' : ''), w);
        btn.addEventListener('click', () => {
          replaceLastToken(w);
          hideHints();
          input.focus();
        });
        box.appendChild(btn);
      }
      box.classList.add('show');
    }

    function hideHints() {
      hintList = [];
      hintIdx = -1;
      const box = byId('input-hints');
      box.innerHTML = '';
      box.classList.remove('show');
    }

    function replaceLastToken(word) {
      const input = byId('command');
      const pos = input.selectionStart || input.value.length;
      const before = input.value.slice(0, pos);
      const after = input.value.slice(pos);
      const m = /([^\s]+)\s*$/.exec(before);
      const head = m ? before.slice(0, before.length - m[0].length) : before;
      input.value = head + word + ' ' + after;
      input.selectionStart = input.selectionEnd = (head + word + ' ').length;
    }

    function cycleHints() {
      const box = byId('input-hints');
      if (!hintList.length || !box.classList.contains('show')) { fillHints(); return; }
      hintIdx = (hintIdx + 1) % hintList.length;
      Array.prototype.forEach.call(box.children, (btn, i) => {
        btn.classList.toggle('active', i === hintIdx);
      });
      if (hintList.length === 1) {
        replaceLastToken(hintList[0]);
        hideHints();
      }
    }

    /* ---------------- command history ---------------- */

    function pushHistory(cmd) {
      if (history[history.length - 1] !== cmd) history.push(cmd);
      if (history.length > 200) history.shift();
      histIdx = history.length;
    }

    function histMove(step) {
      const input = byId('command');
      const n = histIdx + step;
      if (n < 0 || n > history.length) return;
      histIdx = n;
      input.value = histIdx === history.length ? '' : history[histIdx];
      input.selectionStart = input.selectionEnd = input.value.length;
    }

    /* ---------------- title screen ---------------- */

    function showTitle() {
      clearOutput();
      titleShowing = true;
      const auto = save.readAutosave();
      const hasSave = !!(auto && auto.state);
      const wrap = el('div');
      wrap.appendChild(el('pre', 'title-art', TITLE_ART));
      wrap.appendChild(el('p', 'title-sub', 'the Sunken Halls — an original homage to the great text adventures'));
      wrap.appendChild(el('p', 'title-blink', hasSave ? 'Press ENTER to begin  ·  press C to continue' : 'Press ENTER to begin'));
      byId('output').appendChild(wrap);
      audio.blip();
    }

    function startNew() {
      titleShowing = false;
      engine.newGame();
      clearOutput();
      printMessages(engine.intro);
      printMessages(engine.describeRoom(engine.currentRoom(), true));
      lastRoom = engine.currentRoom();
      refresh();
      autosaveNow();
    }

    function continueGame() {
      const auto = save.readAutosave();
      if (!auto || !auto.state) { startNew(); return; }
      titleShowing = false;
      engine.restore(auto.state);
      clearOutput();
      printMessages([{ text: 'Welcome back to Ashcombe. The mist remembers you.', cls: 'dim' }]);
      printMessages(engine.describeRoom(engine.currentRoom(), true));
      lastRoom = engine.currentRoom();
      refresh();
      autosaveNow();
    }

    /* ---------------- init ---------------- */

    function init() {
      loadSettings();
      vocab = buildVocab();

      const input = byId('command');

      byId('input-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const cmd = input.value.trim();
        if (!cmd) return;
        pushHistory(cmd);
        hideHints();
        input.value = '';
        if (titleShowing) {
          startNew();
          return;
        }
        runCommand(cmd);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') { e.preventDefault(); histMove(-1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); histMove(1); }
        else if (e.key === 'Tab') { e.preventDefault(); cycleHints(); }
        else if (e.key === 'Escape') { hideHints(); }
      });
      input.addEventListener('input', hideHints);

      // topbar buttons
      byId('btn-help').addEventListener('click', () => runCommand('help'));
      byId('btn-save').addEventListener('click', () => runCommand('save'));
      byId('btn-load').addEventListener('click', () => runCommand('load'));
      byId('btn-undo').addEventListener('click', () => runCommand('undo'));
      byId('btn-sound').addEventListener('click', () => {
        settings.sound = !settings.sound;
        persistSettings();
      });
      byId('btn-settings').addEventListener('click', () => { byId('modal-backdrop').hidden = false; });

      // compass
      Array.prototype.forEach.call(document.querySelectorAll('.c-btn'), (btn) => {
        btn.addEventListener('click', () => runCommand('go ' + btn.dataset.dir));
      });

      // settings modal
      byId('btn-settings-close').addEventListener('click', () => { byId('modal-backdrop').hidden = true; });
      byId('set-typewriter').addEventListener('change', (e) => { settings.typewriter = e.target.value; persistSettings(); });
      byId('set-speech').addEventListener('change', (e) => { settings.speech = e.target.value; persistSettings(); });
      byId('set-fontsize').addEventListener('change', (e) => { settings.fontsize = parseFloat(e.target.value) || 1; persistSettings(); });
      byId('set-theme').addEventListener('change', (e) => { settings.theme = e.target.value; persistSettings(); });

      // slot modal
      byId('btn-slot-cancel').addEventListener('click', closeSlotModal);

      // overlays
      byId('btn-death-undo').addEventListener('click', () => runCommand('undo'));
      byId('btn-death-restart').addEventListener('click', () => runCommand('restart'));
      byId('btn-death-load').addEventListener('click', () => { hideOverlays(); openSlotModal('load', null); });
      byId('btn-win-restart').addEventListener('click', () => { hideOverlays(); runCommand('restart'); });
      byId('btn-win-keep').addEventListener('click', hideOverlays);

      // global keys: close modals, drive the title screen
      window.addEventListener('keydown', (e) => {
        audio.unlock();
        if (e.key === 'Escape') {
          if (!byId('modal-backdrop').hidden) { byId('modal-backdrop').hidden = true; return; }
          if (!byId('slot-backdrop').hidden) { closeSlotModal(); return; }
          if (!byId('death-overlay').hidden) { hideOverlays(); return; }
          if (!byId('win-overlay').hidden) { hideOverlays(); return; }
          return;
        }
        if (!titleShowing) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startNew();
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          continueGame();
        }
      });

      showTitle();
      input.focus();
    }

    return { init: init };
  })();

  Z.ui = ui;
  if (typeof module !== 'undefined') module.exports = Z;

  // auto-init in the browser
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => ui.init());
    } else {
      ui.init();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
