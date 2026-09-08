/* Editor history and draft recovery contract. */
'use strict';
const assert = require('node:assert');
const Z = require('../js/morrowlamp/core.js');
require('../js/workshop/editor-state.js');

function storage() {
  const data = {};
  return {
    getItem(key) { return data[key] === undefined ? null : data[key]; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; }
  };
}

function cartridge() {
  return { meta: { id: 'draft-test' }, world: { rooms: { start: { name: 'Start' } } } };
}

const store = storage();
const history = Z.ml.editorState.create({ storage: store });
const original = cartridge();
history.begin(original);
history.capture(original);
original.meta.title = 'A NEW TITLE';
history.changed(original);
assert.ok(history.canUndo(), 'an edit creates an undo point');
const undone = history.undo(original);
assert.strictEqual(undone.meta.title, undefined, 'undo restores the prior cartridge');
assert.ok(history.canRedo(), 'undo creates a redo point');
const redone = history.redo(undone);
assert.strictEqual(redone.meta.title, 'A NEW TITLE', 'redo restores the edit');

const recovered = history.recover(cartridge());
assert.strictEqual(recovered.meta.title, 'A NEW TITLE', 'draft recovery reads the latest saved version');
assert.ok(history.isDirty(redone), 'the edited cartridge remains dirty relative to its baseline');
history.discard(redone);
assert.strictEqual(history.recover(cartridge()), null, 'discard removes the local draft');
console.log('  ok — editor history, redo, dirty state, and draft recovery work');
