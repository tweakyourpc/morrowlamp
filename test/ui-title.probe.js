/* Canonical parser-shell title-flow probe. */
'use strict';
const assert = require('node:assert');
const { installDom } = require('./shell-boundary.js');
const dom = installDom();
const Z = require('../js/morrowlamp/core.js');
for (const name of ['world', 'profile', 'outcome', 'rules', 'vocabulary', 'stats', 'encounter', 'runtime', 'sound']) require('../js/morrowlamp/' + name + '.js');
require('../js/audio.js');
require('../js/world.js');
require('../js/cartridges/sunken-crown.js');
require('../js/morrowlamp/shell-parser.js');

const cart = Z.cartridges['the-sunken-crown'];
cart.presentation.title.enabled = true;
const root = dom.doc.getElementById('morrowlamp-app');
const shell = Z.ml.shellParser.mount({ cartridge: cart, root });
const overlay = root.parent ? root.parent : global.document.body;
const title = global.document.body.children.find((node) => node.className === 'ml-term-over');
assert.ok(title, 'title overlay shows on load');
const button = title.children[0].children.find((node) => node.tagName === 'BUTTON');
button.click();
assert.ok(shell.runtime.meta().room, 'title button starts the Machine');
assert.ok(root.allText().includes('Ashcombe Yard'), 'intro and starting room render');
console.log('  ok — canonical parser title flow starts the cartridge');
