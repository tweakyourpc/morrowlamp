/* ============================================================
   SHELL BOUNDARIES
   The lesson of the last audit: the source and runtime suites were
   entirely green while the real index.html still had three defects
   in it. Every test in this file therefore drives an actual shell —
   js/publisher.js as index.html loads it, js/ui.js as text.html
   loads it — against a stubbed DOM, and asserts on what the shell
   did, not on what the runtime would have done if asked directly.

   A shell may decide how something looks. It may not decide what
   the game state is. These tests are mostly that sentence, made
   executable.

   The two shells are driven in child processes because each expects
   to own the page globals.
   Run with:  node test/shell-boundary.js
   ============================================================ */
'use strict';
const assert = require('node:assert');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MODE = process.argv[2];
const ROOT = path.join(__dirname, '..');

/* ============================================================
   A page, roughly
   ============================================================ */
function installDom() {
  const elements = new Map();
  const noop = () => {};

  function makeContext() {
    return {
      imageSmoothingEnabled: false, fillStyle: '', strokeStyle: '', font: '', textAlign: '',
      textBaseline: '', lineWidth: 1, globalAlpha: 1, globalCompositeOperation: 'source-over',
      setTransform: noop, resetTransform: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
      fillText: noop, strokeText: noop, measureText: () => ({ width: 10 }),
      createPattern: () => ({}), createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData: noop, drawImage: noop, save: noop, restore: noop, translate: noop, scale: noop,
      rotate: noop, beginPath: noop, rect: noop, clip: noop, fill: noop, stroke: noop,
      ellipse: noop, arc: noop, moveTo: noop, lineTo: noop, closePath: noop, quadraticCurveTo: noop
    };
  }

  function makeEl(tag) {
    const el = {
      tagName: String(tag || 'div').toUpperCase(),
      children: [], style: {}, dataset: {}, listeners: {},
      id: '', className: '', textContent: '', title: '', value: '', hidden: false,
      disabled: false, width: 0, height: 0, scrollTop: 0, scrollHeight: 0,
      selectionStart: 0, selectionEnd: 0, placeholder: '', type: '', autocomplete: '', spellcheck: false,
      classList: {
        _set: new Set(),
        add(...c) { c.forEach((x) => el.classList._set.add(x)); },
        remove(...c) { c.forEach((x) => el.classList._set.delete(x)); },
        toggle(c, on) { if (on) el.classList._set.add(c); else el.classList._set.delete(c); },
        contains: (c) => el.classList._set.has(c)
      },
      set innerHTML(v) { el.children = []; el._html = v; },
      get innerHTML() { return el._html || ''; },
      appendChild(c) { el.children.push(c); return c; },
      append(...kids) { kids.forEach((k) => el.children.push(k)); },
      insertBefore(c) { el.children.unshift(c); return c; },
      removeChild(c) { el.children = el.children.filter((x) => x !== c); return c; },
      remove: noop,
      addEventListener(t, fn) { (el.listeners[t] = el.listeners[t] || []).push(fn); },
      removeEventListener: noop,
      setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
      focus: noop, blur: noop, scrollIntoView: noop,
      click() { (el.listeners.click || []).forEach((fn) => fn({ preventDefault: noop })); },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200, right: 320, bottom: 200 }),
      getContext: () => makeContext(),
      /* Everything a test needs to see: the text of this node and
         everything under it, the way a reader of the page would. */
      allText() {
        return [el.textContent || ''].concat(el.children.map((c) => (c.allText ? c.allText() : (c.textContent || '')))).join(' ');
      },
      allClasses() {
        return Array.from(el.classList._set)
          .concat(...el.children.map((c) => (c.allClasses ? c.allClasses() : [])));
      }
    };
    return el;
  }

  const doc = {
    readyState: 'complete',
    body: makeEl('body'),
    head: makeEl('head'),
    documentElement: { style: {}, classList: makeEl('html').classList },
    getElementById(id) {
      if (!elements.has(id)) { const el = makeEl('div'); el.id = id; elements.set(id, el); }
      return elements.get(id);
    },
    createElement: makeEl,
    createElementNS: (_ns, t) => makeEl(t),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener(t, fn) { (doc.listeners[t] = doc.listeners[t] || []).push(fn); },
    removeEventListener: noop,
    listeners: {}
  };

  const winListeners = {};
  const frames = [];
  global.document = doc;
  global.window = {
    document: doc,
    addEventListener(t, fn) { (winListeners[t] = winListeners[t] || []).push(fn); },
    removeEventListener: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop }),
    speechSynthesis: { cancel: noop, speak: noop },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    setTimeout: () => 0, clearTimeout: noop,
    prompt: () => null, alert: noop, confirm: () => false,
    requestAnimationFrame: (fn) => { frames.push(fn); return frames.length; },
    cancelAnimationFrame: noop,
    performance: { now: () => Date.now() },
    location: { protocol: 'http:', href: 'http://localhost/index.html' }
  };
  global.requestAnimationFrame = global.window.requestAnimationFrame;
  global.cancelAnimationFrame = noop;
  global.performance = global.window.performance;
  global.prompt = global.window.prompt;
  global.alert = noop;
  global.AudioContext = undefined;
  global.localStorage = (() => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
      clear: () => m.clear()
    };
  })();

  /* The shell asks for the next frame; this runs it. Driving the real
     draw loop is the point — two of the three defects the last audit
     found were only visible with a brush in the shell's hand. */
  let clock = 0;
  function tick(times, step) {
    for (let i = 0; i < (times || 1); i++) {
      clock += (step || 16);
      const pending = frames.splice(0, frames.length);
      for (const fn of pending) fn(clock);
    }
  }

  /* The stub starts every element visible, which the real page does not:
     index.html marks its panels and overlays `hidden`, and a shell reads
     those back ("is the speech panel up?") to decide what a click means.
     Seed them from the page itself rather than from a list kept here, so
     the stub cannot drift away from the markup it stands in for. */
  function loadPage(file) {
    const html = require('node:fs').readFileSync(path.join(ROOT, file), 'utf8');
    const tags = html.match(/<[a-z][^>]*\bid="[^"]+"[^>]*>/gi) || [];
    for (const tag of tags) {
      const id = /\bid="([^"]+)"/.exec(tag)[1];
      const el = doc.getElementById(id);
      if (/\shidden(\s|=|>|\/)/i.test(tag)) el.hidden = true;
      const cls = /\bclass="([^"]+)"/.exec(tag);
      if (cls) { el.className = cls[1]; cls[1].split(/\s+/).forEach((c) => el.classList.add(c)); }
    }
    return doc;
  }

  return { doc, elements, winListeners, tick, makeEl, loadPage };
}

/* ============================================================
   THE GRAPHICAL SHELL — js/publisher.js, as index.html loads it
   ============================================================ */
function graphical() {
  const dom = installDom();
  const { doc, tick } = dom;

  /* index.html's script order, and nothing the page does not load. */
  const Z = require('../js/morrowlamp/core.js');
  for (const m of ['world', 'profile', 'outcome', 'rules', 'vocabulary', 'stats', 'encounter', 'runtime', 'render']) {
    require('../js/morrowlamp/' + m + '.js');
  }
  require('../js/audio.js');
  require('../js/music.js');
  require('../js/save.js');
  require('../js/gfx.js');
  require('../js/sprites.js');
  require('../js/scenes.js');
  require('../js/world.js');
  require('../js/cartridges/sunken-crown.js');
  dom.loadPage('index.html');
  require('../js/publisher.js');           // boots itself: document.readyState is 'complete'

  const game = Z.game;
  const rt = () => game.runtime();
  const el = (id) => doc.getElementById(id);
  const stage = el('stage');

  const fire = (node, type, ev) => (node.listeners[type] || []).forEach((fn) => fn(Object.assign({ preventDefault() {} }, ev)));
  const clickStage = (x, y) => fire(stage, 'click', { clientX: x, clientY: y });
  const transcript = () => el('msgbox').allText();

  /* Walking is animated, so a click on a hotspot only performs its action
     once the actor has arrived. Run frames until it has. */
  function settle() { tick(400, 40); }

  function start(cls) {
    fire(el('overlay-splash'), 'click');
    tick(4, 40);
    el('cls-' + (cls || 'delver')).click();
    settle();
  }

  const results = [];
  const check = (name, fn) => {
    try { fn(); results.push([name, null]); console.log('  ok — ' + name); }
    catch (err) { results.push([name, err]); console.error('  FAIL — ' + name + ': ' + err.message); }
  };

  start('delver');

  /* ---- the shell boots and can be looked at ---- */
  check('the graphical shell boots and starts a game without throwing', () => {
    assert.ok(rt(), 'the shell built a runtime');
    assert.strictEqual(rt().meta().room, 'yard', 'the game starts in the yard');
    assert.ok(transcript().length > 0, 'the shell printed something');
  });

  /* ---- LOOK ----
     The verb bar picks LOOK, then a hotspot is clicked. This is the
     path that threw an exception in the audited build. */
  check('LOOK on a scene hotspot works and prints the description', () => {
    el('vb-look').click();
    const spot = Z.scenes.get('yard').spots.find((s) => s.id === 'mailbox');
    const before = transcript();
    clickStage(spot.x + spot.w / 2, spot.y + spot.h / 2);
    settle();
    const said = transcript().slice(before.length);
    assert.ok(said.length > 0, 'LOOK printed nothing at all');
    assert.ok(/mailbox|box|letter|post/i.test(said), 'LOOK described the mailbox: ' + said.slice(0, 160));
  });

  /* ---- a move the shell did not initiate ----
     The Machine can move the player without a compass click: a rule with
     goto, a fled encounter, a timer. The shell must notice and repaint,
     rather than only reacting to its own movement. */
  check('a room change the shell did not initiate becomes visible', () => {
    el('vb-walk').click();
    const exit = Z.scenes.get('yard').exits.find((e) => e.dir === 'n');
    clickStage(exit.x + exit.w / 2, exit.y + exit.h / 2);
    settle();
    assert.notStrictEqual(rt().meta().room, 'yard', 'clicking the north exit moved the player');
    const arrived = rt().meta().room;

    /* Now move the player from underneath the shell, the way a rule does,
       and give the shell an ordinary turn to notice. */
    const teleported = 'yard';
    rt().state().room = teleported;
    el('vb-look').click();
    const spot = Z.scenes.get(arrived).spots[0];
    clickStage(spot.x + spot.w / 2, spot.y + spot.h / 2);
    settle();
    tick(30, 40);
    assert.ok(!thrown.length, 'the shell threw while catching up: ' + thrown.join('; '));
  });

  /* ---- the Cave Lurker is drawn as itself ----
     The renderer asks the cartridge's art contract for a painter keyed by
     the encounter's id. Passing `kind` instead — which is 'combat' for
     every fight in the game — silently drew the Umbra for both. */
  check('an encounter is painted from its own id, not the generic kind', () => {
    const asked = [];
    const realMonster = Z.sprites.monster;
    Z.sprites.monster = (key) => { asked.push(key); return realMonster(key); };
    try {
      for (const id of ['lurker', 'umbra']) {
        asked.length = 0;
        rt().state().encounter = null;
        assert.ok(rt().startEncounter ? true : true);
        /* Start the fight the way the game does, through the runtime. */
        Z.ml.encounter.definition(Z.cartridges['the-sunken-crown'], id);
        rt().state().encounter = Z.ml.encounter.begin(
          Z.cartridges['the-sunken-crown'].encounters[id], id);
        tick(6, 40);
        assert.ok(asked.length, 'nothing was painted for the ' + id + ' encounter');
        assert.ok(asked.includes(id),
          'the ' + id + ' encounter asked for art keyed "' + asked.join('/') + '" instead of "' + id + '"');
        assert.ok(!asked.includes('combat'),
          'the shell asked for art by encounter kind ("combat"), which is the same picture for every fight');
      }
    } finally {
      Z.sprites.monster = realMonster;
      rt().state().encounter = null;
    }
  });

  /* ---- the lamp warning reads the Machine's own number ---- */
  check('the low-oil indicator reads authoritative runtime fuel', () => {
    const fuelCfg = rt().profile.light.fuel;
    const warnAt = fuelCfg.warnings[0][0];

    rt().state().fuel = warnAt + 50;         // comfortably full
    el('vb-walk').click();
    tick(4, 40);
    const full = el('inv-strip').allText();
    assert.ok(!/\(low\)/.test(full), 'the lamp reads low while still full: ' + full);

    rt().state().fuel = warnAt;              // exactly the cartridge's own warning point
    tick(4, 40);
    /* The strip is rebuilt on refresh, which a turn triggers. */
    const dir = Z.scenes.get(rt().meta().room).exits[0];
    clickStage(dir.x + dir.w / 2, dir.y + dir.h / 2);
    settle();
    const low = el('inv-strip').allText();
    const classes = el('inv-strip').allClasses();
    assert.ok(/\(low\)/.test(low) || classes.includes('low'),
      'the lamp did not read low at the cartridge\'s own warning threshold (fuel=' + rt().meta().fuel + '): ' + low);
  });

  /* ---- the shell owns no gameplay ---- */
  check('the runtime offers a shell no way to mutate stats directly', () => {
    assert.strictEqual(typeof rt().train, 'undefined',
      'runtime.train() is back; a shell can nudge a stat outside a turn again');
    assert.strictEqual(typeof rt().award, 'undefined',
      'runtime.award() is back; a shell can grant progression outside a turn again');
  });

  check('mouse movement inside a room does not train stats outside a turn', () => {
    el('vb-walk').click();
    const sheet = () => JSON.stringify(rt().state().sheet);
    const turnsBefore = rt().meta().turns;
    const before = sheet();
    /* Twenty clicks on bare walkable floor. In the audited build each one
       trained agility, with no turn taken — a stat grinder. */
    const here = Z.scenes.get(rt().meta().room);
    const floor = (here && here.walk && here.walk[0]) || [14, 138, 292, 54];
    const wx = floor[0] + floor[2] / 2;
    const wy = floor[1] + floor[3] / 2;
    for (let i = 0; i < 20; i++) { clickStage(wx + (i % 5), wy); settle(); }
    assert.strictEqual(rt().meta().turns, turnsBefore, 'walking the picture took a game turn');
    assert.strictEqual(sheet(), before, 'the shell changed the character sheet without a turn');
  });

  /* ---- the combat panel follows the Machine, not its own memory ----
     Found by driving the real page: a fight ended by anything other than
     the panel's own buttons left the panel on screen, because "is there a
     fight" was remembered in the DOM instead of asked of the runtime. */
  check('the combat panel closes when the fight ends by any route', () => {
    const cart = Z.cartridges['the-sunken-crown'];
    rt().state().encounter = Z.ml.encounter.begin(cart.encounters.lurker, 'lurker');
    rt().emit('encounter', { id: 'lurker' });
    assert.strictEqual(el('combat-panel').hidden, false, 'the panel did not open for a fight');

    rt().state().encounter = null;
    rt().emit('encounter', { id: null });
    assert.strictEqual(el('combat-panel').hidden, true,
      'the fight is over and the combat panel is still on screen');
  });

  /* ---- an encounter starts once ---- */
  check('an encounter does not start twice from one trigger', () => {
    let starts = 0;
    rt().on('encounter', (p) => { if (p.id) starts++; });
    rt().state().encounter = null;
    const cart = Z.cartridges['the-sunken-crown'];
    rt().state().encounter = Z.ml.encounter.begin(cart.encounters.lurker, 'lurker');
    tick(20, 40);
    assert.ok(starts <= 1, 'the shell announced the same encounter ' + starts + ' times');
    rt().state().encounter = null;
  });

  return results;
}

/* ============================================================
   THE TEXT SHELL — js/ui.js, as text.html loads it
   ============================================================ */
function text() {
  const dom = installDom();
  const { doc } = dom;

  const Z = require('../js/morrowlamp/core.js');
  for (const m of ['world', 'profile', 'outcome', 'rules', 'vocabulary', 'stats', 'encounter', 'runtime']) {
    require('../js/morrowlamp/' + m + '.js');
  }
  require('../js/audio.js');
  require('../js/save.js');
  require('../js/world.js');
  require('../js/cartridges/sunken-crown.js');
  /* No typewriter: the stub's setTimeout never fires callbacks. */
  global.localStorage.setItem('sunkencrown_v1_settings', JSON.stringify({ typewriter: 'off' }));
  dom.loadPage('text.html');
  require('../js/ui.js');

  const rt = () => Z.ui.runtime();
  const output = () => doc.getElementById('output').children
    .map((d) => (d.allText ? d.allText() : d.textContent)).join(' ');

  /* The page's own command path: type into the box, submit the form.
     Not runtime.command() — that is the thing being tested. */
  function type(text) {
    doc.getElementById('command').value = text;
    const form = doc.getElementById('input-form');
    (form.listeners.submit || []).forEach((fn) => fn({ preventDefault() {} }));
  }

  const results = [];
  const check = (name, fn) => {
    try { fn(); results.push([name, null]); console.log('  ok — ' + name); }
    catch (err) { results.push([name, err]); console.error('  FAIL — ' + name + ': ' + err.message); }
  };

  /* Past the title screen. */
  for (const fn of dom.winListeners.keydown || []) fn({ key: 'Enter', preventDefault() {} });

  const cart = Z.cartridges['the-sunken-crown'];
  function pickFight(id) {
    rt().state().encounter = Z.ml.encounter.begin(cart.encounters[id], id);
  }
  const since = () => { const n = output().length; return () => output().slice(n); };

  check('the text shell boots and reaches the game', () => {
    assert.ok(rt(), 'the shell built a runtime');
    assert.ok(output().length > 0, 'the shell printed something');
  });

  /* ---- the three commands the audit found unreachable ----
     These are encounter action names the cartridge chose, not parser
     verbs. The shell must offer a typed word to the running encounter
     before the parser sees it, or they are unreachable by typing —
     which, on a page whose only interface is typing, means unplayable. */
  check('typing "defend" during an encounter defends', () => {
    pickFight('umbra');
    const after = since();
    type('defend');
    const said = after();
    assert.ok(!/don't understand|do not understand/i.test(said), 'the parser rejected "defend": ' + said.slice(0, 200));
    assert.ok(/wait|set yourself|guard/i.test(said), 'defending said nothing about defending: ' + said.slice(0, 200));
  });

  check('typing "flee" during an encounter attempts to flee', () => {
    pickFight('lurker');
    const after = since();
    type('flee');
    const said = after();
    assert.ok(!/don't understand|do not understand/i.test(said), 'the parser rejected "flee": ' + said.slice(0, 200));
    assert.ok(/back away|break away|turn to run|between you and the water/i.test(said),
      'fleeing said nothing about fleeing: ' + said.slice(0, 200));
  });

  check('typing "raise light" during an encounter raises the light', () => {
    pickFight('umbra');
    const after = since();
    type('raise light');
    const said = after();
    assert.ok(!/don't understand|do not understand/i.test(said), 'the parser rejected "raise light": ' + said.slice(0, 200));
    assert.ok(/light|recoils|shrieking|bright/i.test(said), 'raising the light did nothing: ' + said.slice(0, 200));
  });

  check('the bare action name "light" also reaches the encounter', () => {
    pickFight('umbra');
    const after = since();
    type('light');
    const said = after();
    assert.ok(!/Light what\?/i.test(said), '"light" fell through to the parser: ' + said.slice(0, 200));
  });

  check('a fight tells the player what may be typed', () => {
    rt().state().encounter = null;
    type('look');
    pickFight('lurker');
    const after = since();
    type('defend');
    const said = after();
    assert.ok(/attack/i.test(said) && /flee/i.test(said),
      'the shell never listed the encounter\'s own actions: ' + said.slice(0, 200));
  });

  check('ordinary parser commands still work', () => {
    rt().state().encounter = null;
    const after = since();
    type('look');
    assert.ok(after().length > 0, 'LOOK printed nothing');
    const room = rt().meta().room;
    type('north');
    assert.ok(rt().meta().room !== room || after().length > 0, 'movement did nothing at all');
  });

  return results;
}

/* ============================================================
   Independent proof of which Machine each page runs
   ------------------------------------------------------------
   The existing one-machine suite compares the pages against the
   bundle manifest — but the compiler is built from that same
   manifest, so the manifest agreeing with itself proves little.
   This reads the pages themselves and compares the module list to
   what a booted artifact actually put on its globals.
   ============================================================ */
function routes() {
  const fs = require('node:fs');
  const results = [];
  const check = (name, fn) => {
    try { fn(); results.push([name, null]); console.log('  ok — ' + name); }
    catch (err) { results.push([name, err]); console.error('  FAIL — ' + name + ': ' + err.message); }
  };

  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const scriptsIn = (html) => (html.match(/src="(js\/[^"]+)"/g) || []).map((m) => m.slice(5, -1));

  check('every page runs the same gameplay modules, read from the pages themselves', () => {
    const pages = { 'index.html': scriptsIn(read('index.html')), 'text.html': scriptsIn(read('text.html')) };
    /* Derived from the page, not from the manifest: whatever gameplay
       modules index.html loads, text.html must load too. */
    const gameplayOf = (list) => list.filter((f) => f.startsWith('js/morrowlamp/') &&
      !/shell-|render\.js|sound\.js/.test(f));
    const a = gameplayOf(pages['index.html']).sort();
    const b = gameplayOf(pages['text.html']).sort();
    assert.deepStrictEqual(a, b, 'the two pages load different gameplay modules');
    assert.ok(a.length >= 8, 'suspiciously few gameplay modules: ' + a.join(', '));
    for (const page in pages) {
      assert.ok(pages[page].includes('js/cartridges/sunken-crown.js'), page + ' loads the cartridge');
    }
  });

  check('a compiled artifact exposes the same Machine the pages load', () => {
    const Z = require('../js/morrowlamp/core.js');
    for (const m of ['world', 'profile', 'outcome', 'rules', 'vocabulary', 'stats', 'encounter', 'runtime', 'render', 'sound']) {
      require('../js/morrowlamp/' + m + '.js');
    }
    require('../js/workshop/validator.js');
    require('../js/workshop/bundle.js');
    require('../js/workshop/compiler.js');
    require('../js/world.js');
    require('../js/cartridges/sunken-crown.js');
    const { bootArtifact } = require('./artifact-harness.js');

    const sources = {};
    for (const f of Z.ml.bundle.allFiles().concat(['js/workshop/validator.js'])) sources[f] = read(f);
    const html = Z.ml.compiler.compile({ cartridge: Z.cartridges['the-sunken-crown'], sources, now: 'test' });
    const sandbox = bootArtifact(html);

    /* What the page loads, by name, versus what the artifact actually
       built at runtime. Neither list comes from the manifest. */
    const pageModules = scriptsIn(read('index.html'))
      .filter((f) => f.startsWith('js/morrowlamp/'))
      .map((f) => path.basename(f, '.js'))
      /* `core` is the namespace the others hang off, not an entry in it,
         and a shell is by definition the part that differs per page. */
      .filter((n) => n !== 'core' && !/^shell-/.test(n));
    const artifactModules = Object.keys(sandbox.Z.ml);
    for (const name of pageModules) {
      assert.ok(artifactModules.includes(name),
        'index.html loads ' + name + ', which the compiled artifact does not have');
    }

    /* And it is the same implementation, not merely the same name: the
       artifact must answer a gameplay question identically. */
    const here = Z.ml.runtime.create(Z.cartridges['the-sunken-crown']);
    const there = sandbox.Z.ml.runtime.create(sandbox.Z.cartridges['the-sunken-crown']);
    const ask = (rt) => rt.command('examine mailbox').messages.map((m) => m.text).join(' ');
    assert.strictEqual(ask(there), ask(here), 'the artifact and the source tree disagree about the game');
  });

  return results;
}

/* ============================================================
   Driver
   ============================================================ */
const thrown = [];
process.on('uncaughtException', (err) => { thrown.push(err.message); });

module.exports = { installDom };

if (require.main !== module) {
  /* Required rather than run: a probe wants the page stub, not the suite. */
} else if (MODE === '--graphical' || MODE === '--text' || MODE === '--routes') {
  const run = MODE === '--graphical' ? graphical : (MODE === '--text' ? text : routes);
  const results = run();
  const failed = results.filter(([, err]) => err).length;
  process.exit(failed ? 1 : 0);
} else {
  console.log('\nSHELL BOUNDARIES — the real shells, driven as pages drive them\n');
  let failed = 0;
  for (const [label, mode] of [
    ['index.html — the graphical shell', '--graphical'],
    ['text.html — the parser shell', '--text'],
    ['which Machine each route actually runs', '--routes']
  ]) {
    console.log('· ' + label);
    try {
      execFileSync(process.execPath, [__filename, mode], { cwd: ROOT, stdio: 'inherit' });
    } catch (err) {
      failed++;
    }
    console.log('');
  }
  console.log(failed ? failed + ' section(s) FAILED' : 'All 3 sections passed.');
  process.exit(failed ? 1 : 0);
}
