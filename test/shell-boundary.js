/* ============================================================
   MORROWLAMP — canonical shell contract
   The page bootstraps and the compiled artifacts must use the same
   reusable shells. This suite mounts those shells directly against a
   small DOM stub and checks that they render runtime decisions without
   owning gameplay.
   ============================================================ */
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');

function installDom() {
  const elements = new Map();
  const noop = () => {};
  function context() {
    return { fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: '', lineWidth: 1,
      setTransform: noop, clearRect: noop, fillRect: noop, strokeRect: noop, fillText: noop, strokeText: noop,
      measureText: () => ({ width: 10 }), createPattern: () => ({}), createLinearGradient: () => ({ addColorStop: noop }),
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData: noop, drawImage: noop, save: noop, restore: noop, translate: noop, scale: noop,
      rotate: noop, beginPath: noop, rect: noop, clip: noop, fill: noop, stroke: noop, ellipse: noop,
      arc: noop, moveTo: noop, lineTo: noop, closePath: noop, quadraticCurveTo: noop
    };
  }
  function makeEl(tag) {
    const el = { tagName: String(tag).toUpperCase(), children: [], style: {}, listeners: {},
      className: '', id: '', textContent: '', value: '', hidden: false, disabled: false,
      scrollTop: 0, scrollHeight: 0, classList: { _set: new Set(), add(...v) { v.forEach((x) => this._set.add(x)); },
        remove(...v) { v.forEach((x) => this._set.delete(x)); }, toggle(x, on) { on ? this._set.add(x) : this._set.delete(x); }, contains(x) { return this._set.has(x); } },
      appendChild(c) { this.children.push(c); return c; }, append(...c) { this.children.push(...c); },
      remove() { this._removed = true; }, addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
      removeEventListener() {}, click() { (this.listeners.click || []).forEach((fn) => fn({ preventDefault: noop })); },
      focus: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }),
      getContext: () => context(), allText() { return [this.textContent || ''].concat(this.children.map((x) => x.allText ? x.allText() : x.textContent || '')).join(' '); } };
    Object.defineProperty(el, 'innerHTML', { get: () => '', set: () => { el.children = []; } });
    return el;
  }
  const doc = { readyState: 'complete', body: makeEl('body'), head: makeEl('head'), listeners: {},
    getElementById(id) { if (!elements.has(id)) { const el = makeEl('div'); el.id = id; elements.set(id, el); } return elements.get(id); },
    createElement: makeEl, createElementNS: (_ns, tag) => makeEl(tag), querySelectorAll: () => [],
    addEventListener(t, fn) { (doc.listeners[t] = doc.listeners[t] || []).push(fn); },
    removeEventListener(t, fn) { doc.listeners[t] = (doc.listeners[t] || []).filter((f) => f !== fn); } };
  const frames = [];
  global.document = doc;
  global.window = { document: doc, addEventListener() {}, scrollTo: noop, matchMedia: () => ({ matches: false, addEventListener: noop }),
    setTimeout: () => 0, clearTimeout: noop, requestAnimationFrame: (fn) => { frames.push(fn); return frames.length; },
    cancelAnimationFrame: noop, performance: { now: () => Date.now() }, speechSynthesis: { cancel: noop, speak: noop }, location: { protocol: 'http:' } };
  global.requestAnimationFrame = global.window.requestAnimationFrame;
  global.cancelAnimationFrame = global.window.cancelAnimationFrame;
  global.performance = global.window.performance;
  global.AudioContext = undefined;
  global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) { this.text = text; };
  global.__speechLog = [];
  global.speechSynthesis = { cancel() {}, speak(utterance) { global.__speechLog.push(utterance.text); } };
  global.window.SpeechSynthesisUtterance = global.SpeechSynthesisUtterance;
  global.window.speechSynthesis = global.speechSynthesis;
  global.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
  return { doc, speech: global.speechSynthesis, speechLog: global.__speechLog, tick(n) { for (let i = 0; i < (n || 1); i++) { const f = frames.splice(0); f.forEach((fn) => fn(Date.now() + i * 40)); } } };
}

function loadMachine() {
  const Z = require('../js/morrowlamp/core.js');
  for (const name of ['world', 'profile', 'outcome', 'rules', 'vocabulary', 'stats', 'encounter', 'runtime', 'render', 'sound']) require('../js/morrowlamp/' + name + '.js');
  require('../js/audio.js');
  require('../js/music.js');
  require('../js/gfx.js');
  require('../js/sprites.js');
  require('../js/scenes.js');
  require('../js/world.js');
  require('../js/cartridges/sunken-crown.js');
  require('../js/morrowlamp/interact.js');
  require('../js/morrowlamp/shell-canvas.js');
  require('../js/morrowlamp/shell-parser.js');
  return Z;
}

function graphical() {
  const dom = installDom();
  const Z = loadMachine();
  const cart = Z.cartridges['the-sunken-crown'];
  cart.presentation.title.enabled = false;
  const root = dom.doc.getElementById('morrowlamp-app');
  const shell = Z.ml.shellCanvas.mount({ cartridge: cart, root, title: false });
  const text = () => root.allText();
  const check = (name, fn) => { try { fn(); console.log('  ok — ' + name); } catch (e) { e.message = name + ': ' + e.message; throw e; } };
  check('canonical canvas shell mounts', () => assert.ok(shell.runtime));
  check('typed commands route through the Machine', () => { shell.run({ _text: 'look' }); assert.match(text(), /Ashcombe Yard|mailbox|mist/i); });
  check('encounter art uses the cartridge encounter id', () => { const art = Z.cartridges['the-sunken-crown'].presentation.art; assert.ok(art.opponent); });
  check('shell has no direct gameplay mutation API', () => { assert.strictEqual(typeof shell.runtime.train, 'undefined'); assert.strictEqual(typeof shell.runtime.award, 'undefined'); });
  check('room movement can animate without changing the turn contract', () => { const before = shell.runtime.meta().turns; shell.run({ _text: 'n' }); dom.tick(30); assert.ok(shell.runtime.meta().turns > before); });
  return true;
}

function parser() {
  const dom = installDom();
  const Z = loadMachine();
  const cart = Z.cartridges['the-sunken-crown'];
  cart.presentation.title.enabled = false;
  const root = dom.doc.getElementById('morrowlamp-app');
  const shell = Z.ml.shellParser.mount({ cartridge: cart, root });
  const form = root.children.find((x) => x.className === 'ml-term-inner').children.find((x) => x.tagName === 'FORM');
  const input = form.children.find((x) => x.tagName === 'INPUT');
  const output = () => root.allText();
  const submit = (value) => { input.value = value; form.listeners.submit[0]({ preventDefault() {} }); };
  assert.ok(shell.runtime);
  submit('look');
  assert.match(output(), /Ashcombe Yard|mailbox|mist/i);
  shell.runtime.state().encounter = Z.ml.encounter.begin(cart.encounters.umbra, 'umbra');
  submit('defend');
  assert.match(output(), /wait|set yourself|guard/i);
  console.log('  ok — canonical parser shell mounts, looks, and routes encounter actions');
  return true;
}

function restoredCanvasPresentation() {
  const dom = installDom();
  const Z = loadMachine();
  const cart = Z.cartridges['the-sunken-crown'];
  cart.presentation.title.enabled = true;
  const root = dom.doc.getElementById('morrowlamp-app');
  const shell = Z.ml.shellCanvas.mount({ cartridge: cart, root });
  const overlays = () => root.children.filter((node) => node.className === 'ml-over' && !node._removed);
  assert.ok(overlays().length === 1, 'the splash overlay appears first');
  const splashButton = overlays()[0].children[0].children.find((node) => node.tagName === 'BUTTON');
  assert.ok(splashButton, 'the splash has a continue control');
  splashButton.click();
  assert.ok(overlays()[0].allText().includes('CHOOSE WHO GOES'), 'the readable class picker follows the splash: ' + overlays()[0].allText());
  assert.ok(overlays()[0].allText().includes('Delver'), 'class choices remain visible: ' + overlays()[0].allText());
  assert.ok(root.children.includes(overlays()[0]), 'title overlay stays inside the themed shell');

  const speechButton = root.children.find((node) => node.className === 'ml-bar').children.find((node) => node.textContent === 'Speech off');
  assert.ok(speechButton, 'the shell exposes speech');
  speechButton.click();
  shell.run({ _text: 'look' });
  assert.ok(dom.speechLog.length, 'speech synthesis receives transcript text');

  cart.presentation.title.enabled = false;
  const floorShell = Z.ml.shellCanvas.mount({ cartridge: cart, root: dom.doc.createElement('main'), title: false });
  const before = floorShell.runtime.meta().turns;
  floorShell.canvas.listeners.click[0]({ clientX: 24, clientY: 190 });
  assert.strictEqual(floorShell.runtime.meta().turns, before, 'walking to bare floor is presentation-only');
  console.log('  ok — splash, class picker, speech, and bare-floor walking are restored');
}

if (require.main === module) {
  try { console.log('\nSHELL BOUNDARIES — canonical reusable shells\n'); graphical(); parser(); restoredCanvasPresentation(); console.log('\nAll canonical shell checks passed.'); }
  catch (e) { console.error('FAIL — ' + e.message); process.exitCode = 1; }
}

module.exports = { installDom, graphical, parser, restoredCanvasPresentation };
