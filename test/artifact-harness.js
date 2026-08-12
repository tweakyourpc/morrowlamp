/* ============================================================
   A sandbox for compiled adventures.
   Boots a finished .html artifact in node:vm against a stub DOM
   and hands back its globals, so a test can play the compiled
   game rather than the source modules it was built from.

   Test-only. Nothing in js/ knows this exists, and no production
   code has a test path in it.
   ============================================================ */
'use strict';
const vm = require('node:vm');

function stubDom() {
  function makeNode(tag) {
    const node = {
      tagName: String(tag || 'div').toUpperCase(),
      children: [], style: {}, dataset: {}, classList: {
        _set: new Set(),
        add(...c) { c.forEach((x) => node.classList._set.add(x)); },
        remove(...c) { c.forEach((x) => node.classList._set.delete(x)); },
        toggle(c, on) { if (on) node.classList._set.add(c); else node.classList._set.delete(c); },
        contains: (c) => node.classList._set.has(c)
      },
      textContent: '', innerHTML: '', value: '', id: '', className: '',
      appendChild(child) { node.children.push(child); return child; },
      append(...kids) { kids.forEach((k) => node.children.push(k)); },
      remove() {},
      addEventListener() {}, removeEventListener() {},
      focus() {}, click() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }),
      getContext: () => makeContext(),
      width: 0, height: 0,
      /* Shells scroll their transcript as it grows. */
      scrollTop: 0, scrollHeight: 0, hidden: false, disabled: false, title: '',
      autocomplete: '', spellcheck: false, placeholder: '', type: ''
    };
    return node;
  }
  function makeContext() {
    const noop = () => {};
    return {
      imageSmoothingEnabled: false, fillStyle: '', strokeStyle: '', font: '', textAlign: '',
      setTransform: noop, fillRect: noop, strokeRect: noop, clearRect: noop, fillText: noop,
      createPattern: () => ({}), createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: noop, drawImage: noop, save: noop, restore: noop, translate: noop, scale: noop,
      beginPath: noop, rect: noop, clip: noop, fill: noop, stroke: noop, ellipse: noop, arc: noop,
      moveTo: noop, lineTo: noop, closePath: noop
    };
  }
  const head = makeNode('head');
  const body = makeNode('body');
  const document = {
    head, body,
    createElement: makeNode,
    getElementById(id) {
      const walk = (node) => {
        if (node.id === id) return node;
        for (const child of node.children) { const found = walk(child); if (found) return found; }
        return null;
      };
      return walk(body) || walk(head);
    },
    addEventListener() {}, removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => []
  };
  const sandbox = {
    document,
    window: null,
    location: { protocol: 'http:', href: 'http://localhost/game.html' },
    localStorage: {
      _d: {},
      getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
      setItem(k, v) { this._d[k] = String(v); },
      removeItem(k) { delete this._d[k]; }
    },
    console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    /* The parser shell keeps its transcript pinned to the bottom. */
    scrollTo() {}, requestAnimationFrame: (fn) => setTimeout(fn, 0), cancelAnimationFrame() {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    Event: function Event(type) { this.type = type; },
    Blob: function () {}, URL: { createObjectURL: () => 'blob:', revokeObjectURL: () => {} },
    Math, Date, JSON, parseInt, parseFloat, isNaN, Object, Array, String, Number, Boolean,
    Error, RegExp, Set, Map, Uint8ClampedArray, Promise
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

function bootArtifact(html) {
  const sandbox = stubDom();
  vm.createContext(sandbox);
  const blocks = [];
  const re = /<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) blocks.push(match[1]);
  const jsonRe = /<script id="morrowlamp-cartridge" type="application\/json">([\s\S]*?)<\/script>/i;
  const jsonMatch = jsonRe.exec(html);
  if (jsonMatch) {
    const node = sandbox.document.createElement('script');
    node.id = 'morrowlamp-cartridge';
    node.textContent = jsonMatch[1];
    sandbox.document.body.appendChild(node);
  }
  for (const block of blocks) {
    vm.runInContext(block.replace(/<\\\/script/g, '</script'), sandbox, { timeout: 15000 });
  }
  return sandbox;
}

module.exports = { stubDom, bootArtifact };
