/* ============================================================
   MORROWLAMP — the strings contract
   The validator declares which slots resolve a '@s:' reference.
   The runtime is what actually resolves them. This suite is the
   only thing that makes those two the same statement.

   It builds one cartridge in which EVERY declared prose slot holds
   a reference, plays it through the paths that print each of them,
   and then asserts two things about the whole transcript:

     · every sentinel appeared, so the slot really did resolve;
     · the string '@s:' appears nowhere, so nothing leaked raw.

   The second assertion is the one that matters. An audit found the
   validator checking slots the runtime did not resolve and the
   runtime resolving slots the validator did not check, in both
   directions, while every other suite was green — because no test
   ever compared the two lists.
   Run with:  node test/strings-contract.js
   ============================================================ */
'use strict';
const assert = require('node:assert');
const Z = require('../js/morrowlamp/core.js');
require('../js/morrowlamp/world.js');
require('../js/morrowlamp/profile.js');
require('../js/morrowlamp/outcome.js');
require('../js/morrowlamp/rules.js');
require('../js/morrowlamp/vocabulary.js');
require('../js/morrowlamp/stats.js');
require('../js/morrowlamp/encounter.js');
require('../js/morrowlamp/runtime.js');
require('../js/workshop/validator.js');

const ml = Z.ml;

/* Every slot below holds '@s:<key>' in the cartridge and 'RESOLVED
   <key>' in the table, so a sentinel in the transcript proves that
   exact slot resolved and nothing else did it by accident. */
const KEYS = [
  'intro', 'help', 'quit',
  'room.desc', 'room.short', 'room.note', 'exit.deny',
  'obj.desc', 'obj.examine', 'obj.read', 'obj.take', 'obj.cannotTake', 'obj.drop',
  'obj.cannotOpen', 'obj.locked', 'obj.open', 'obj.unlock', 'obj.light', 'obj.douse',
  'case.accept', 'case.reject',
  'verb.prompt', 'verb.fallback',
  'rule.say', 'ending.text',
  'dark.warning', 'fuel.warn', 'fuel.out',
  'fight.intro', 'fight.hit', 'fight.miss', 'fight.defeated',
  'fight.action.hit', 'fight.action.miss', 'fight.won'
];
const ref = (key) => '@s:' + key;
const sentinel = (key) => 'RESOLVED ' + key;

function cartridge() {
  const strings = {};
  for (const key of KEYS) strings[key] = sentinel(key);
  return {
    format: 'morrowlamp-cartridge',
    formatVersion: 2,
    meta: { id: 'prose-contract', title: 'Prose Contract', version: '1.0.0' },
    intro: ref('intro'),
    help: ref('help'),
    quitText: ref('quit'),
    startFlags: { opened: false },
    strings,
    world: {
      startRoom: 'hall',
      startInventory: [],
      rooms: {
        hall: {
          name: 'Hall',
          desc: ref('room.desc'),
          short: ref('room.short'),
          notes: [{ when: { flags: { opened: true } }, text: ref('room.note') }],
          exits: {
            e: { room: 'vault', flagReq: 'opened', deny: ref('exit.deny') },
            d: 'cellar'
          }
        },
        cellar: { name: 'Cellar', desc: 'A cellar.', dark: true, exits: { u: 'hall' } },
        vault: { name: 'Vault', desc: 'The vault.', exits: { w: 'hall' } }
      },
      objects: {
        lever: {
          name: 'lever', aliases: ['lever'], at: 'hall',
          desc: ref('obj.desc'), examine: ref('obj.examine'), read: ref('obj.read'),
          cannotTake: ref('obj.cannotTake'), cannotOpen: ref('obj.cannotOpen')
        },
        gem: {
          name: 'gem', aliases: ['gem'], at: 'hall', takeable: true,
          takeText: ref('obj.take'), dropText: ref('obj.drop')
        },
        stone: { name: 'stone', aliases: ['stone'], at: 'hall', takeable: true },
        key: { name: 'key', aliases: ['key'], at: 'hall', takeable: true },
        box: {
          name: 'box', aliases: ['box'], at: 'hall', container: true, locked: true, key: 'key',
          lockedText: ref('obj.locked'), openText: ref('obj.open'), unlockText: ref('obj.unlock')
        },
        /* `lightable`, not `light`: the second means "already burning",
           and a lamp that starts lit can never print its lightText. */
        lamp: {
          name: 'lamp', aliases: ['lamp'], at: 'hall', takeable: true, lightable: true,
          lightText: ref('obj.light'), douseText: ref('obj.douse')
        },
        cabinet: {
          name: 'cabinet', aliases: ['cabinet'], at: 'hall', container: true, open: true,
          acceptText: ref('case.accept'), rejectText: ref('case.reject')
        }
      }
    },
    vocabulary: {
      verbs: {
        /* Two verbs, because the two slots are reached by different
           shapes: a `text` verb used with no argument prints its prompt,
           and a `target` verb no rule claims prints its fallback. */
        pull: { words: ['pull'], form: 'target', fallback: ref('verb.fallback') },
        chant: { words: ['chant'], form: 'text', prompt: ref('verb.prompt') }
      }
    },
    rules: [
      { id: 'pull-lever', verb: 'pull', target: 'lever', do: [{ set: 'opened' }, { say: ref('rule.say') }] },
      /* The fight has to start from a command, so its opening line comes
         back in a turn's messages the way a player would see it. */
      { id: 'wake-the-rat', verb: 'pull', target: 'stone', do: [{ encounter: 'rat' }] }
    ],
    encounters: {
      rat: {
        kind: 'combat',
        opponent: { name: 'Rat', hp: 3, attack: [1, 1], defence: 0, xp: 4 },
        intro: ref('fight.intro'),
        hit: ref('fight.hit'),
        miss: ref('fight.miss'),
        defeated: ref('fight.defeated'),
        actions: [
          { id: 'strike', label: 'Strike', kind: 'strike', uses: 'might', trains: 'might',
            hitText: ref('fight.action.hit'), missText: ref('fight.action.miss') }
        ],
        onWin: { type: 'say', text: ref('fight.won') }
      }
    },
    profile: {
      turns: true,
      combat: true,
      stats: {
        list: { might: 'Might' },
        classes: { knight: { name: 'Knight', stats: { might: 5 } } },
        health: { from: 'might', base: 20, perPoint: 1, perLevel: 2 }
      },
      treasures: { enabled: true, list: ['gem'], securedIn: 'cabinet', winOnAll: false },
      darkness: { enabled: true, warning: ref('dark.warning'), grace: 5 },
      light: { fuel: { object: 'lamp', turns: 2, warnings: [[1, ref('fuel.warn')]], outText: ref('fuel.out') } }
    },
    endings: [{ id: 'in', kind: 'win', when: { room: 'vault' }, text: ref('ending.text') }],
    presentation: { renderer: 'ega', audio: 'chip', interface: 'parser' }
  };
}

/* Each probe drives the paths that print one group of slots. A fresh
   runtime per probe, so one probe cannot mask another. */
const PROBES = [
  ['the opening', ['intro', 'room.desc', 'obj.desc'], (rt, say) => {
    say(rt.intro().map((t) => ({ text: t })));
    say(rt.describeRoom(rt.meta().room, true));
  }],
  ['help and quit', ['help', 'quit'], (rt) => { rt.command('help'); rt.command('quit'); }],
  ['a blocked exit', ['exit.deny'], (rt) => { rt.command('e'); }],
  ['examining and reading', ['obj.examine', 'obj.read'], (rt) => { rt.command('examine lever'); rt.command('read lever'); }],
  ['taking and dropping', ['obj.take', 'obj.drop', 'obj.cannotTake'], (rt) => {
    rt.command('take gem'); rt.command('drop gem'); rt.command('take lever');
  }],
  ['a container', ['obj.cannotOpen', 'obj.locked', 'obj.unlock', 'obj.open'], (rt) => {
    rt.command('open lever');
    rt.command('open box');
    rt.command('take key');
    rt.command('unlock box with key');
    rt.command('open box');
  }],
  ['a light source', ['obj.light', 'obj.douse'], (rt) => {
    rt.command('take lamp'); rt.command('light lamp'); rt.command('douse lamp');
  }],
  ['the trophy case', ['case.accept', 'case.reject'], (rt) => {
    rt.command('take stone'); rt.command('put stone in cabinet');
    rt.command('take gem'); rt.command('put gem in cabinet');
  }],
  ['a verb with no argument, and one no rule claims', ['verb.prompt', 'verb.fallback'], (rt) => {
    rt.command('chant');
    rt.command('pull gem');
  }],
  ['a rule firing, and the note it reveals', ['rule.say', 'room.note'], (rt) => {
    rt.command('pull lever');
    rt.command('look');
  }],
  /* Carrying a light, so the trip down and back actually happens: you
     cannot walk out of a dark room you cannot see. */
  ['the short description on return', ['room.short'], (rt) => {
    rt.command('take lamp'); rt.command('light lamp');
    rt.command('d'); rt.command('u');
  }],
  ['the dark', ['dark.warning'], (rt) => { rt.command('d'); }],
  ['lamp oil running out', ['fuel.warn', 'fuel.out'], (rt) => {
    rt.command('take lamp'); rt.command('light lamp');
    rt.command('d'); rt.command('wait'); rt.command('wait');
  }],
  ['a fight, start to finish', ['fight.intro', 'fight.action.hit', 'fight.defeated', 'fight.won'], (rt) => {
    rt.command('take stone');
    rt.command('pull stone');
    let guard = 20;
    while (rt.encounter() && guard-- > 0) rt.encounterAct('strike');
  }],
  ['the ending', ['ending.text'], (rt) => { rt.command('pull lever'); rt.command('e'); }]
];

/* Dice that make the player's blows land, so the fight probe is
   deterministic; the opponent's own lines are exercised separately. */
const lucky = () => 0.1;
const unlucky = () => 0.99;

function runProbe(drive, random) {
  const cart = cartridge();
  const rt = ml.runtime.create(cart, { random: random || lucky });
  const transcript = [];
  const collect = (messages) => { for (const m of messages || []) transcript.push(m.text); };
  const originalCommand = rt.command;
  rt.command = (text) => { const r = originalCommand(text); collect(r.messages); return r; };
  const originalAct = rt.encounterAct;
  rt.encounterAct = (id) => { const r = originalAct(id); collect(r.messages); return r; };
  drive(rt, collect);
  return transcript;
}

/* ---------------- the cartridge itself is legal ---------------- */
function testTheFixtureValidates() {
  const result = ml.validator.validate(cartridge());
  assert.ok(result.ok, 'a cartridge using every declared prose slot must validate:\n  ' + result.errors.join('\n  '));
  console.log('  ok — a cartridge with a reference in every declared slot validates');
}

/* ---------------- every declared slot resolves ---------------- */
function testEveryDeclaredSlotResolves() {
  const missing = [];
  const leaked = [];
  for (const [name, keys, drive] of PROBES) {
    const transcript = runProbe(drive);
    const text = transcript.join('\n');
    for (const key of keys) {
      if (!text.includes(sentinel(key))) missing.push(name + ' → ' + key);
    }
    for (const line of transcript) {
      if (line.includes('@s:')) leaked.push(name + ' → ' + JSON.stringify(line.slice(0, 70)));
    }
  }
  assert.deepStrictEqual(leaked, [],
    'a raw reference reached the player:\n    ' + leaked.join('\n    '));
  assert.deepStrictEqual(missing, [],
    'a declared prose slot did not resolve:\n    ' + missing.join('\n    '));
  console.log('  ok — every declared slot resolved, across ' + PROBES.length + ' probes, with no raw token anywhere');
}

function testTheOpponentsOwnLinesResolve() {
  /* `hit` is built by concatenation (the line plus the damage), which is
     exactly the shape that silently defeats a resolver applied too late. */
  const transcript = runProbe((rt) => {
    rt.command('pull stone');
    let guard = 10;
    while (rt.encounter() && guard-- > 0) rt.encounterAct('strike');
  }, unlucky);
  const text = transcript.join('\n');
  assert.ok(!text.includes('@s:'), 'no raw token in a losing fight:\n' + text);
  assert.ok(text.includes(sentinel('fight.hit')) || text.includes(sentinel('fight.miss')),
    'the opponent\'s own lines resolve');
  assert.ok(text.includes(sentinel('fight.action.miss')), 'and so does a missed swing');
  console.log('  ok — opponent lines resolve even where the text is concatenated');
}

/* ---------------- and the validator agrees ---------------- */
function testTheValidatorChecksWhatTheRuntimeResolves() {
  /* For each key: break exactly that reference and require the validator
     to report it. A slot that resolves at runtime but validates silently
     is the B-003 failure in one direction. */
  const unchecked = [];
  for (const key of KEYS) {
    const cart = cartridge();
    delete cart.strings[key];
    const result = ml.validator.validate(cart);
    const found = result.findings.some((f) => f.code === 'string-missing' && f.message.includes('"' + key + '"'));
    if (!found) unchecked.push(key);
  }
  assert.deepStrictEqual(unchecked, [],
    'these slots resolve at runtime but their references are not validated:\n    ' + unchecked.join('\n    '));
  console.log('  ok — all ' + KEYS.length + ' runtime-resolved slots are validated');
}

function testTheRuntimeResolvesWhatTheValidatorAccepts() {
  /* The other direction, by construction: the fixture puts a reference in
     every slot the validator accepts without complaint, and the probes
     above proved each one printed resolved. What is left to check is that
     the validator does not quietly accept a reference somewhere the
     probes never look — so assert it refuses the known-unresolved slots. */
  const shouldRefuse = [
    ['world.rooms.hall.name', (c) => { c.world.rooms.hall.name = '@s:intro'; }],
    ['world.objects.gem.name', (c) => { c.world.objects.gem.name = '@s:intro'; }],
    ['encounters.rat.actions[0].label', (c) => { c.encounters.rat.actions[0].label = '@s:intro'; }],
    ['encounters.rat.opponent.name', (c) => { c.encounters.rat.opponent.name = '@s:intro'; }],
    ['profile.stats.list.might', (c) => { c.profile.stats.list.might = '@s:intro'; }]
  ];
  const accepted = [];
  for (const [path, mutate] of shouldRefuse) {
    const cart = cartridge();
    mutate(cart);
    const result = ml.validator.validate(cart);
    if (!result.findings.some((f) => f.code === 'string-ref-unsupported' && f.path === path)) accepted.push(path);
  }
  assert.deepStrictEqual(accepted, [],
    'the validator accepted a reference the runtime would print raw:\n    ' + accepted.join('\n    '));
  console.log('  ok — a reference in a slot the runtime does not resolve is refused, not printed');
}

function testShippedCartridgesPrintNoRawReferences() {
  /* The end of the argument: play the one cartridge written entirely in
     the table and confirm the player never sees the machinery. */
  require('../js/cartridges/sir-crumbly.js');
  const cart = Z.cartridges['sir-crumbly'];
  const rt = ml.runtime.create(cart, { random: lucky });
  const transcript = rt.intro().slice();
  const push = (r) => { for (const m of r.messages) transcript.push(m.text); };
  push({ messages: rt.describeRoom(rt.meta().room, true) });
  for (const step of cart.walkthrough.route) {
    let guard = 20;
    while (rt.encounter() && guard-- > 0) push(rt.encounterAct(rt.encounter().actions[0].id));
    push(rt.command(step));
  }
  const raw = transcript.filter((line) => String(line).includes('@s:'));
  assert.deepStrictEqual(raw, [], 'Sir Crumbly printed a raw reference: ' + raw.join(' | '));
  assert.strictEqual(rt.meta().win, true, 'and still finishes');
  console.log('  ok — Sir Crumbly plays to its ending with no raw reference in the transcript');
}

const tests = [testTheFixtureValidates, testEveryDeclaredSlotResolves, testTheOpponentsOwnLinesResolve,
  testTheValidatorChecksWhatTheRuntimeResolves, testTheRuntimeResolvesWhatTheValidatorAccepts,
  testShippedCartridgesPrintNoRawReferences];
let failed = 0;
console.log('\nMORROWLAMP — the strings contract\n');
for (const t of tests) {
  try { t(); } catch (err) { failed++; console.error('  FAIL — ' + t.name + ': ' + err.message); }
}
console.log(failed ? '\n' + failed + ' group(s) FAILED' : '\nAll ' + tests.length + ' groups passed.');
process.exit(failed ? 1 : 0);
