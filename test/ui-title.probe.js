/* DOM-stub probe: verifies ui.js title-screen flow without a browser. */
'use strict';
const assert = require('node:assert');

/* ---- minimal DOM stubs ---- */
const elements = new Map();
function makeEl(tag) {
  return {
    tag, children: [], className: '', textContent: '', title: '', value: '',
    hidden: false, style: {}, dataset: {}, scrollTop: 0, scrollHeight: 0,
    selectionStart: 0, selectionEnd: 0, listeners: {},
    set innerHTML(v) { this.children = []; },
    get innerHTML() { return ''; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    setAttribute() {}, getAttribute() { return null; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    focus() {}
  };
}
const winHandlers = {};
const doc = {
  readyState: 'complete',
  body: makeEl('body'),
  documentElement: { style: {} },
  getElementById(id) { if (!elements.has(id)) elements.set(id, makeEl('div')); return elements.get(id); },
  createElement(t) { return makeEl(t); },
  createElementNS(_ns, t) { return makeEl(t); },
  querySelectorAll() { return []; },
  addEventListener() {}
};
global.window = {
  addEventListener(t, fn) { (winHandlers[t] = winHandlers[t] || []).push(fn); },
  matchMedia: () => ({ matches: false }),
  speechSynthesis: { cancel() {}, speak() {} },
  setTimeout: (fn, ms) => 0
};
global.document = doc;
global.localStorage = (() => { const m = new Map(); return {
  getItem(k) { return m.has(k) ? m.get(k) : null; },
  setItem(k, v) { m.set(k, String(v)); },
  removeItem(k) { m.delete(k); }
}; })();
global.AudioContext = undefined;
// stub setTimeout never runs callbacks, so disable the typewriter for instant text
global.localStorage.setItem('sunkencrown_v1_settings', JSON.stringify({ typewriter: 'off' }));

/* ---- load game modules in browser order ---- */
require('../js/world.js');
require('../js/engine.js');
require('../js/parser.js');
require('../js/audio.js');
require('../js/save.js');

const out = () => doc.getElementById('output').children;
const key = (k) => { for (const fn of winHandlers.keydown || []) fn({ key: k, preventDefault() {} }); };
const submit = (text) => {
  const f = doc.getElementById('input-form').listeners.submit[0];
  doc.getElementById('command').value = text;
  f({ preventDefault() {} });
};
const txt = () => out().map(d => d.textContent || d.children.map(c => c.textContent).join('')).join(' ');

function titleVisible() {
  return out().some(d => d.children && d.children.some(c => c.className === 'title-art'));
}

/* ---- scenario 1: fresh load, no autosave ---- */
require('../js/ui.js');
assert.ok(titleVisible(), 'title art shows on load');

key('c');  // titleShowing must be true: C starts (no autosave -> new game)
assert.ok(!titleVisible(), 'C on title starts the game (no autosave)');
assert.ok(txt().includes('Ashcombe Yard') || txt().includes('Entrance Hall'), 'game intro printed: ' + txt().slice(0, 60));

// after the game started, typing c + Enter is a command -> parser error (expected)
submit('c');
assert.ok(txt().includes('I don\'t understand'), 'post-title "c" reaches the parser');
console.log('  ok — scenario 1: fresh load, C starts the game');

/* ---- scenario 2: autosave present -> C resumes ---- */
require('../js/engine.js'); // ensure engine attached
const Z = require('../js/world.js');
Z.engine.newGame();
Z.engine.handleAction(Z.parser.parse('n'));
const state = Z.engine.serialize();
global.localStorage.setItem('sunkencrown_v1_autosave', JSON.stringify({ state, score: 0, turns: 2, roomName: 'Front Porch' }));

delete require.cache[require.resolve('../js/ui.js')];
require('../js/ui.js');  // re-init with autosave present
assert.ok(titleVisible(), 'title shows again');
key('c');
assert.ok(!titleVisible(), 'C resumes the game');
assert.ok(txt().includes('Welcome back to Ashcombe'), 'resume message: ' + txt().slice(0, 60));
const cur = Z.engine.currentRoom();
console.log('  ok — scenario 2: autosave present, C resumes (room: ' + cur + ')');

/* ---- scenario 3: Enter on title starts a fresh game ---- */
global.localStorage.removeItem('sunkencrown_v1_autosave');
delete require.cache[require.resolve('../js/ui.js')];
require('../js/ui.js');
assert.ok(titleVisible(), 'title shows (no autosave)');
key('Enter');
assert.ok(!titleVisible(), 'Enter starts the game');
assert.ok(txt().includes('Ashcombe Yard'), 'starts in the yard');
console.log('  ok — scenario 3: Enter on title starts fresh game');

console.log('\nUI title-flow probe: ALL PASSED');
