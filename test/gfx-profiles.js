/* Renderer profile contract without requiring a browser. */
'use strict';
const assert = require('node:assert');
global.document = { createElement() { return makeCanvas(); } };
function makeContext() {
  return {
    imageSmoothingEnabled: false, setTransform() {}, fillRect() {}, createPattern() { return {}; },
    createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData() {},
    drawImage() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, fill() {},
    ellipse() {}, moveTo() {}, lineTo() {}, closePath() {}
  };
}
function makeCanvas() { return { width: 0, height: 0, getContext() { return makeContext(); } }; }
const Z = require('../js/gfx.js');
const ega = Z.gfx.create(makeCanvas(), { profile: 'ega' });
const vgaCanvas = makeCanvas();
const vga = Z.gfx.create(vgaCanvas, { profile: 'vga' });
assert.strictEqual(ega.W, 320); assert.strictEqual(ega.H, 200);
assert.strictEqual(vga.W, 320); assert.strictEqual(vga.H, 200);
assert.strictEqual(vgaCanvas.width, 640); assert.strictEqual(vgaCanvas.height, 400);
assert.notStrictEqual(vga.C.yellow, ega.C.yellow);
const heroCanvas = makeCanvas();
const hero = Z.gfx.create(heroCanvas, { profile: 'vga', logicalWidth: 320, logicalHeight: 112 });
assert.strictEqual(hero.H, 112); assert.strictEqual(heroCanvas.height, 224);
console.log('Renderer CGA/EGA/VGA profile checks passed.');
