/* ============================================================
   MORROWLAMP GAME CARTRIDGE
   THE SUNKEN CROWN — Morrowlamp Software, 1987 (allegedly)

   Everything specific to this game and nothing else. The rooms
   and prose live in js/world.js, which is cartridge content too:
   the original text build and this cartridge read the same words,
   so the two can never drift apart.

   What this file adds on top of that prose:
     · placement  — which room each object starts in
     · overrides  — per-object text the Machine's default verbs use
     · vocabulary — the verbs this game needs beyond the core set
     · rules      — the puzzles, declaratively
     · profile    — score, treasures, darkness, lamp oil
     · endings    — how it finishes
     · presentation — display adapter, sound hardware, interface

   Nothing here reaches into the Machine, and the Machine contains
   no mention of crowns, sentinels, or lamp oil.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const source = Z.world;   // js/world.js — rooms, objects, prose

  /* ------------------------------------------------------------
     PLACEMENT
     Which room each object begins in. `inv` is start inventory;
     an array means the thing is visible from more than one place
     (the well is both a hole in the yard and a ceiling below);
     an object with no entry begins inside a container.
     ------------------------------------------------------------ */
  const PLACEMENT = {
    lantern: 'inv', note: 'inv',
    mailbox: 'yard', well: ['yard', 'wellBottom'],
    doormat: 'porch', door: 'porch',
    hatch: 'hall', chandelier: 'hall', clock: 'hall', cabinet: 'hall',
    lyre: 'study', picture: 'study', bookHistory: 'study', bookMusic: 'study',
    bookSecurity: 'study', desk: 'study',
    stove: 'kitchen', knife: 'kitchen', loaf: 'kitchen', curtain: 'kitchen', pantry: 'kitchen',
    shelves: 'cellar', shovel: 'cellar', crack: 'cellar', wineRack: 'cellar',
    gates: 'caveMouth', boat: 'lakeShore',
    sentinel: 'guardroom', vaultKey: 'guardroom', vaultDoor: 'guardroom',
    throne: 'throne', crown: 'throne',
    sarcophagus: 'tomb', scepter: 'vault',
    mirror: 'mirrorHall', idol: 'mirrorSanctum',
    plinth: 'lakeIslet', chalice: 'lakeIslet',
    sunstone: 'wellBottom'
  };

  /* Per-object text the Machine's built-in verbs reach for. These used
     to be `if (target === 'sentinel')` branches inside the engine. */
  const OVERRIDES = {
    cabinet: {
      acceptText: 'You place {the target} on its velvet cushion. The cabinet accepts it with a satisfied click.',
      rejectText: 'The cabinet is reserved for the Regalia of the Sunken Halls. It accepts your offering with a look of deep disappointment, and gives it back.'
    },
    lantern: {
      lightText: 'The lantern burns bright again.',
      douseText: 'You extinguish the oil lantern. The dark leans in, curious.'
    },
    candle: { lightText: 'The candle catches. A small, stubborn star, refusing to go out.' },
    sentinel: { cannotTake: 'You reach for the sentinel. Your hand passes through it. It does not notice, or does not care.' },
    gates: { cannotTake: 'You try to take the brass gates. The brass gates decline, with thirty feet of gravity.', cannotOpen: 'You push at the brass gates. They do not budge. They do not seem to need to. Perhaps they are waiting for a word.' },
    throne: { cannotTake: 'You try to take the throne. The skeleton of the King watches you with no eyes. You stop trying.' },
    sarcophagus: { lockedText: 'The lid does not lift. It wants a shoulder, not a handle.' },
    well: { cannotTake: 'You cannot take the well. The well is very much taken with itself.' },
    hatch: { lockedText: 'The trapdoor is shut and locked. (Unlock it, then open it.)' },
    vaultDoor: { lockedText: 'The steel door is locked. The sentinel is extremely proud of the key.' }
  };

  /* Notes that appear under a room description once the world changes.
     Formerly five hardcoded `if (rid === …)` lines in the engine. */
  const NOTES = {
    caveMouth: [{ when: { flags: { gatesOpen: true } }, text: 'The brass gates stand open to the south.' }],
    cellar: [{ when: { flags: { tunnelDug: true } }, text: 'A passage now gapes in the north wall (south).' }],
    guardroom: [{ when: { flags: { guardDancing: true } }, text: 'The sentinel dances down the passage, off duty at last.' }],
    mirrorHall: [{ when: { flags: { mirrorOpened: true } }, text: 'The west mirror stands open, a dark doorway beyond.' }],
    lakeShore: [{ when: { flags: { boatPatched: true } }, text: 'The patched boat floats at the water\'s edge, ready.' }]
  };

  /* ------------------------------------------------------------
     WORLD ADAPTER
     ------------------------------------------------------------ */
  function buildWorld() {
    const rooms = {}, objects = {};

    for (const id in source.rooms) {
      const r = source.rooms[id];
      const room = {
        id, name: r.name, desc: r.desc, short: r.short,
        dark: !!r.dark, map: r.map ? r.map.slice() : null,
        exits: {}
      };
      for (const dir in (r.exits || {})) {
        const e = r.exits[dir];
        if (typeof e === 'string') { room.exits[dir] = e; continue; }
        const exit = Object.assign({}, e);
        /* `guardReq` was a second spelling of `flagReq` that only the
           original engine understood — and the reason a generic runtime
           could walk straight past a guard it had never heard of. The
           Machine has one gating vocabulary; the cartridge speaks it. */
        if (exit.guardReq) { exit.flagReq = exit.guardReq; delete exit.guardReq; }
        room.exits[dir] = exit;
      }
      if (NOTES[id]) room.notes = NOTES[id];
      rooms[id] = room;
    }

    for (const id in source.objects) {
      const o = Object.assign({ id }, source.objects[id], OVERRIDES[id] || {});
      if (PLACEMENT[id] !== undefined) o.at = PLACEMENT[id];
      objects[id] = o;
    }

    return {
      startRoom: source.startRoom,
      startInventory: source.startInventory.slice(),
      rooms, objects
    };
  }

  /* ------------------------------------------------------------
     VOCABULARY — the verbs this particular game needs
     ------------------------------------------------------------ */
  const vocabulary = {
    verbs: {
      dig:    { words: ['dig'], form: 'target', optional: true, anywhere: true, fallback: 'You dig. The ground disagrees, and the ground has a better shovel.' },
      fix:    { words: ['fix', 'repair', 'mend', 'patch'], form: 'target', seps: ['with'], optional: true, anywhere: true, prompt: 'Fix what?', fallback: 'You can\'t fix that.' },
      row:    { words: ['row', 'sail', 'paddle'], form: 'target', optional: true, anywhere: true, fallback: 'There is no water to row on here.' },
      play:   { words: ['play', 'strum'], form: 'target', optional: true, anywhere: true, fallback: 'You can\'t play that. (A lyre, on the other hand…)' },
      sing:   { words: ['sing', 'hum'], form: 'target', optional: true, anywhere: true, fallback: 'You hum a tune you half-remember. It echoes, politely.' },
      say:    { words: ['say', 'whisper', 'shout', 'speak', 'answer', 'tell', 'chant'], form: 'text', anywhere: true, prompt: 'Say what?' },
      push:   { words: ['push', 'press'], form: 'target', prompt: 'Push what?', fallback: 'You push, to no effect. The universe does not budge.' },
      pull:   { words: ['pull', 'tug'], form: 'target', prompt: 'Pull what?', fallback: 'You pull. Nothing follows.' },
      throw:  { words: ['throw', 'toss', 'hurl', 'fling'], form: 'target', seps: ['at'], prompt: 'Throw what?', fallback: 'You throw it. It lands nearby, unimpressed, and you pick it back up.' },
      eat:    { words: ['eat', 'taste', 'munch'], form: 'target', prompt: 'Eat what?', fallback: 'You raise it to your mouth. On reflection, you do not eat that.' },
      drink:  { words: ['drink', 'sip'], form: 'target', optional: true, prompt: 'Drink what?', fallback: 'You cannot drink that.' },
      climb:  { words: ['climb'], form: 'target', climb: true, prompt: 'Climb what?', fallback: 'There is nothing here to climb.' },
      enter:  { words: ['enter'], form: 'target', prompt: 'Enter what?', fallback: 'You can\'t enter that.' },
      jump:   { words: ['jump', 'leap'], form: 'target', optional: true, anywhere: true, fallback: 'You jump on the spot. The halls are unmoved.' },
      talk:   { words: ['talk', 'greet', 'hail'], form: 'target', optional: true, anywhere: true, fallback: 'There is no one here to talk to. The portraits, technically, are listening.' },
      attack: { words: ['attack', 'kill', 'fight', 'hit', 'swing'], form: 'target', prompt: 'Attack what?', fallback: 'Violence is not the answer. Here, the answer is usually a riddle.' },
      give:   { words: ['give', 'offer'], form: 'target', seps: ['to'], prompt: 'Give what?', fallback: 'Nobody here wants it.' },
      smell:  { words: ['smell', 'sniff'], form: 'target', optional: true, anywhere: true, fallback: 'Cold stone, old dust, and the faint suggestion of a kingdom.' },
      listen: { words: ['listen', 'hear'], form: 'target', optional: true, anywhere: true, fallback: 'You listen. The halls breathe, slowly, and say nothing.' }
    }
  };

  /* ------------------------------------------------------------
     THE RULE BOOK
     Every puzzle in The Sunken Crown, declaratively. Read top to
     bottom: the first rule whose head and conditions match wins.
     ------------------------------------------------------------ */
  const rules = [
    /* --- the lullaby --- */
    {
      id: 'read-the-music', verb: 'read', target: 'musicSheet',
      do: [
        { say: '@sheet' },
        { set: 'melodyKnown' },
        { say: { text: '(You now know the lullaby of the Sunken King.)', cls: 'good' } },
        { sound: 'chime' }
      ]
    },

    /* --- the lens and the note --- */
    {
      id: 'lens-on-note', verb: ['use', 'examine'], target: ['lens', 'note'], with: ['lens', 'note'],
      when: { carrying: ['lens'], present: ['note'] },
      do: [
        { set: 'lensSecret' },
        { say: { text: 'You hold the lens over the note. Between the lines, in a hand you know: "the King\'s last word is the name of his cavern. Say it, and mind the mirror that shows no reflection."', cls: 'info' } }
      ]
    },

    /* --- the sentinel and the vault key --- */
    {
      id: 'guarded-vault-key', verb: 'take', target: 'vaultKey',
      when: { room: 'guardroom', flags: { guardDancing: false } },
      do: [{ say: 'The sentinel\'s hand closes over the key without looking at you. "HALT. That is part of my uniform, and I am wearing it."' }]
    },
    {
      id: 'take-key-from-sentinel', verb: 'take', target: 'vaultKey', with: 'sentinel',
      when: { room: 'guardroom', flags: { guardDancing: true } },
      do: [{ give: 'vaultKey' }, { say: 'You lift the key from the dancing sentinel\'s belt. It does not notice; it is busy.' }]
    },

    /* --- music sets the sentinel dancing --- */
    {
      id: 'play-the-lullaby', verb: ['play', 'sing'], target: [null, 'lyre'],
      when: { room: 'guardroom', flags: { melodyKnown: true, guardDancing: false } },
      do: [
        { set: 'guardDancing' },
        { say: { cls: 'good', text: 'Your fingers find the tune — the lullaby of the Sunken King — and the silver lyre sings it true, the way instruments remember being loved.' } },
        { say: { cls: 'good', text: 'The sentinel stops humming. It turns, slowly, like a compass finding north. And then it dances: great sweeping, ridiculous steps, its armour clanking in a rhythm it has waited a thousand years to hear.' } },
        { say: { cls: 'good', text: '"MUSIC!" it booms, delighted. "At last, music! I am OFF DUTY!"' } },
        { say: { cls: 'good', text: 'It waltzes past you into the passage, leaving the south door — and its own belt — unguarded.' } },
        { music: 'triumph' }
      ]
    },
    {
      id: 'play-untuned-lyre', verb: 'play', target: 'lyre',
      when: { carrying: ['lyre'], flags: { melodyKnown: false } },
      do: [{ say: 'You strum the lyre. Its strings are out of tune — it sounds like a cat falling downstairs. You have a feeling you need to learn the right song.' }]
    },
    {
      id: 'play-the-lullaby-elsewhere', verb: ['play', 'sing'], target: [null, 'lyre'],
      when: { flags: { melodyKnown: true } },
      do: [{ say: 'The lullaby of the Sunken King rolls through the halls, and for a moment, the dark is less dark.' }]
    },

    /* --- the cavern of echoes --- */
    {
      id: 'speak-the-echo', verb: 'say', phrase: 'echo',
      when: { room: 'caveMouth', flags: { gatesOpen: false } },
      do: [
        { say: 'You whisper: "Echo."' },
        { set: 'gatesOpen' },
        { say: 'The word rolls across the cavern, and the cavern rolls it back — twice, richer each time. Somewhere deep in the brass, something unlatches. The great doors groan apart, thirty feet of patience giving in all at once.' },
        { sound: 'chime' }
      ]
    },
    {
      id: 'speak-the-wrong-word', verb: 'say',
      when: { room: 'caveMouth', flags: { gatesOpen: false } },
      do: [{ say: 'The statue\'s lips move, but no sound escapes. Your word enters the cavern and does not come back. The statue inclines its head, encouragingly, and waits.' }]
    },
    {
      id: 'speak-anywhere-else', verb: 'say',
      do: [{ say: 'Your voice goes out into the dark. The dark keeps it, and gives you nothing back.' }]
    },

    /* --- digging out of the cellar --- */
    {
      id: 'dig-the-crack', verb: 'dig', target: [null, 'crack', 'shovel'],
      when: { room: 'cellar', carrying: ['shovel'], flags: { tunnelDug: false } },
      do: [
        { set: 'tunnelDug' },
        { say: 'You set the shovel against the crack and dig with the grim rhythm of someone who has done this before. Dirt and root and stone give way, and the crack opens into a tunnel that descends into a wetter dark, breathing on your face like a held secret.' },
        { sound: 'thud' }
      ]
    },
    {
      id: 'dig-already-dug', verb: 'dig',
      when: { room: 'cellar', flags: { tunnelDug: true } },
      do: [{ say: 'The passage is already dug. The wall is in the past.' }]
    },
    {
      id: 'dig-bare-handed', verb: 'dig',
      when: { room: 'cellar', notCarrying: ['shovel'] },
      do: [{ say: 'You dig at the crack with your bare hands, like a very determined badger. The crack is unimpressed. (You need a shovel.)' }]
    },
    {
      id: 'enter-the-crack', verb: ['enter', 'climb'], target: 'crack',
      when: { room: 'cellar', flags: { tunnelDug: true } },
      do: [{ goto: 'tunnel' }],
      otherwise: [{ say: 'The crack is wide enough for a fist, not for a treasure hunter.' }]
    },

    /* --- the hall of mirrors --- */
    {
      id: 'flour-on-the-mirrors', verb: 'throw', target: 'flour',
      when: { room: 'mirrorHall', carrying: ['flour'], flags: { mirrorOpened: false } },
      do: [
        { set: 'flourRevealed' },
        { say: 'You upend the sack. Flour explodes in a white cloud — and clings to the west mirror, tracing its edges in white: a door, outlined like a secret that has been standing up too long.' }
      ]
    },
    {
      id: 'open-the-mirror-door', verb: ['push', 'pull', 'enter', 'open'], target: 'mirror',
      when: { room: 'mirrorHall', flags: { mirrorOpened: false, flourRevealed: true } },
      do: [
        { set: 'mirrorOpened' },
        { say: 'You push where the flour outlined the door, and the whole wall swings, silent as a held breath, and a narrow chamber opens beyond.' }
      ]
    },
    {
      id: 'push-the-mirror-blind', verb: ['push', 'pull', 'enter', 'open'], target: 'mirror',
      when: { room: 'mirrorHall', flags: { mirrorOpened: false } },
      do: [
        { set: 'mirrorOpened' },
        { say: 'You press against the west mirror. For a heartbeat your reflection presses back — then the whole wall swings, silent as a held breath, and a narrow chamber opens beyond.' }
      ]
    },
    {
      id: 'mirror-already-open', verb: ['push', 'pull', 'enter', 'open'], target: 'mirror',
      when: { room: 'mirrorHall', flags: { mirrorOpened: true } },
      do: [{ say: 'The west mirror is already open.' }]
    },

    /* --- the king's tomb --- */
    {
      id: 'open-the-sarcophagus', verb: ['open', 'push', 'pull'], target: 'sarcophagus',
      when: { open: { sarcophagus: false } },
      do: [
        { open: 'sarcophagus' },
        { say: 'You set your shoulder to the lid and push. It moves with a groan like a mountain rolling over.' },
        { say: 'Inside: the bones of a king, tidily arranged, and a heavy gold ring resting on his chest.' },
        { say: 'A column of pale light rises, and the shade of the King stands before you — young, crowned, grinning.' },
        { say: '"Take it," it says. "I was buried with my ring, but I was buried with a better story. Tell it."' },
        { say: 'It fades, laughing, and the tomb is quiet again.' }
      ],
      otherwise: [{ say: 'The sarcophagus is already open. The King\'s bones keep their own counsel.' }]
    },

    /* --- the boat --- */
    {
      id: 'patch-the-boat', verb: ['fix', 'use'], target: [null, 'boat', 'pitchPot', 'curtain'], with: [null, 'boat', 'pitchPot', 'curtain'],
      when: { room: 'lakeShore', carrying: ['pitchPot', 'curtain'], flags: { boatPatched: false } },
      do: [
        { set: 'boatPatched' },
        { say: 'With the pitch and the curtain you patch the hole with the grim efficiency of someone who has done this before. The boat now looks merely resigned instead of doomed.' }
      ]
    },
    {
      id: 'patch-the-boat-empty-handed', verb: 'fix', target: [null, 'boat'],
      when: { room: 'lakeShore', flags: { boatPatched: false } },
      do: [{ say: 'You need a pot of pitch and something to stuff the hole with to fix the boat.' }]
    },
    {
      id: 'boat-already-patched', verb: 'fix', target: [null, 'boat'],
      when: { room: 'lakeShore', flags: { boatPatched: true } },
      do: [{ say: 'The boat is already patched and waiting.' }]
    },
    {
      id: 'row-across', verb: ['row', 'enter'], target: [null, 'boat'],
      when: { room: 'lakeShore', flags: { boatPatched: true } },
      do: [
        { say: 'You push off and row across the black water, the boat creaking its gratitude. The glow-fungi shimmer under the hull.' },
        { goto: 'lakeIslet' }
      ]
    },
    {
      id: 'row-a-holed-boat', verb: 'row', target: [null, 'boat'],
      when: { room: 'lakeShore', flags: { boatPatched: false } },
      do: [{ say: 'The boat has a hole the size of a fist. The water would come in faster than you could bail. (Try: fix boat)' }]
    },
    {
      id: 'row-back', verb: ['row', 'enter'], target: [null, 'boat'],
      when: { room: 'lakeIslet' },
      do: [{ say: 'You row back to the shore, the boat sighing with relief.' }, { goto: 'lakeShore' }]
    },

    /* --- the well --- */
    {
      id: 'climb-down-the-well', verb: ['climb', 'enter'], target: 'well',
      when: { room: 'yard' },
      do: [
        { say: 'You take the rusty ladder and climb down into the dry well, hand over hand, into the honey-coloured glow.' },
        { goto: 'wellBottom' }
      ]
    },
    {
      id: 'climb-out-of-the-well', verb: ['climb', 'enter'], target: 'well',
      when: { room: 'wellBottom' },
      do: [
        { say: 'You climb the rusty ladder back up into the yard, blinking in the mist.' },
        { goto: 'yard' }
      ]
    },

    /* --- doors that are only scenery --- */
    {
      id: 'enter-the-manor', verb: ['enter', 'open'], target: ['door', 'doormat'],
      when: { room: 'yard' },
      do: [{ goto: 'porch' }]
    },
    {
      id: 'open-the-manor-door', verb: 'open', target: 'door',
      when: { room: 'porch' },
      do: [{ say: 'It creaks open, revealing the entrance hall beyond.' }, { goto: 'hall' }]
    },
    {
      id: 'look-under-the-doormat', verb: ['examine', 'push', 'pull', 'take'], target: 'doormat',
      when: { room: 'porch' },
      do: [{ say: 'The W has worn almost entirely away. It now reads, philosophically: ELCOME. There is nothing under it but three hundred years of porch.' }]
    },

    /* --- lighting the candle --- */
    {
      id: 'light-the-candle', verb: 'light', target: 'candle',
      when: { present: ['candle'], lit: { lantern: true }, carrying: ['lantern'] },
      do: [{ light: 'candle' }, { say: 'The candle catches. A small, stubborn star, refusing to go out.' }]
    },
    {
      id: 'light-the-candle-without-a-flame', verb: 'light', target: 'candle',
      when: { lit: { candle: false } },
      do: [{ say: 'You have nothing to light it with. (The lantern, perhaps?)' }]
    },

    /* --- lamp oil --- */
    {
      id: 'refill-the-lantern', verb: 'use', target: ['oilJar', 'lantern'], with: ['oilJar', 'lantern'],
      when: { carrying: ['oilJar', 'lantern'] },
      do: [
        { refuel: 'lantern' },
        { say: 'You carefully top up the lantern from the jar. It hums with approval, and the oil line climbs back to the brim.' }
      ]
    },
    {
      id: 'drink-the-lamp-oil', verb: 'drink', target: ['oilJar', 'lantern'],
      do: [{ die: ['You take a sip of lamp oil.', 'It is, it turns out, quite fatal.', 'Your grandmother\'s note was very specific about this.'] }]
    },

    /* --- bread --- */
    {
      id: 'eat-the-loaf', verb: 'eat', target: 'loaf',
      when: { carrying: ['loaf'], flags: { loafEaten: false } },
      do: [
        { set: 'loafEaten' },
        { destroy: 'loaf' },
        { say: 'You tear off a hunk. It is stale, it is dry, and it is, without question, the best meal you have had since you started adventuring.' }
      ]
    },
    {
      id: 'the-loaf-is-gone', verb: 'eat', target: 'loaf',
      when: { flags: { loafEaten: true } },
      do: [{ say: 'The loaf is gone. You ate it. It was bread.' }]
    },
    {
      id: 'eat-the-sunstone', verb: 'eat', target: 'sunstone',
      do: [{ say: 'You put the sunstone to your lips. It is warm, and it does not fit in your mouth. The sunstone appreciates the gesture.' }]
    },

    /* --- drinking --- */
    {
      id: 'drink-the-lake', verb: 'drink', target: [null, '*'],
      when: { room: ['lakeShore', 'lakeIslet'] },
      do: [{ say: 'You cup the black water and drink. It is brackish and cold, and it has been down here longer than most kingdoms.' }]
    },
    {
      id: 'drink-the-dry-well', verb: 'drink', target: 'well',
      do: [{ say: 'You drink from the well. The well is dry. This is, arguably, the point.' }]
    },
    {
      id: 'drink-the-empty-bottle', verb: 'drink', target: 'emptyBottle',
      do: [{ say: 'You tilt the bottle. Nothing comes out, not even pride.' }]
    },

    /* --- the sentinel is a person, not a puzzle --- */
    {
      id: 'talk-to-the-dancing-sentinel', verb: 'talk',
      when: { room: 'guardroom', flags: { guardDancing: true } },
      do: [{ say: 'The sentinel dances past, humming now in two parts. "Best shift I\'ve had in a thousand years!"' }]
    },
    {
      id: 'talk-to-the-sentinel', verb: 'talk',
      when: { room: 'guardroom' },
      do: [{ say: 'The sentinel hums. "No melody, no passage," it says, without stopping humming. It glances at the key on its belt, proudly.' }]
    },
    {
      id: 'attack-the-sentinel', verb: 'attack', target: 'sentinel',
      when: { carrying: ['knife'] },
      do: [{ say: 'You lunge with the rusty knife. It passes through the sentinel like mist through a comb. The sentinel sighs. "I am a ghost, darling. The paperwork was enormous."' }]
    },
    {
      id: 'attack-the-sentinel-barehanded', verb: 'attack', target: 'sentinel',
      do: [{ say: 'You swing at the ghost with your bare hands. Your hands pass through. The sentinel tilts its head: "Was that a threat, or a stretch?"' }]
    },

    /* --- the gates --- */
    {
      id: 'push-the-gates', verb: ['push', 'pull'], target: 'gates',
      do: [{ say: 'You push at the brass gates. Thirty feet of brass decline to move. They seem to be waiting for a word.' }]
    },

    /* --- listening, which the game rewards --- */
    {
      id: 'listen-at-the-cave-mouth', verb: 'listen',
      when: { room: 'caveMouth' },
      do: [{ say: 'The cavern breathes. Every sound you make comes back richer, as if the stone were improving on you. It is very nearly telling you its name.' }]
    },
    {
      id: 'listen-to-the-sentinel', verb: 'listen',
      when: { room: 'guardroom', flags: { guardDancing: false } },
      do: [{ say: 'The sentinel hums an old tune. It is on the tip of your memory, and it is staying there.' }]
    }
  ];

  /* The music sheet's own prose lives in world.js; the rule above points
     at it with a marker rather than copying the words a second time. */
  for (const rule of rules) {
    for (const step of rule.do || []) {
      if (step.say === '@sheet') step.say = source.objects.musicSheet.read;
    }
  }

  /* ------------------------------------------------------------
     GAMEPLAY PROFILE
     ------------------------------------------------------------ */
  const profile = {
    turns: true,
    score: {
      enabled: true,
      treasureFound: 5,
      treasureSecured: 5,
      ranks: source.ranks
    },
    treasures: {
      enabled: true,
      list: source.treasures.slice(),
      names: Object.assign({}, source.treasureNames),
      securedIn: 'cabinet',
      winOnAll: true
    },
    darkness: {
      enabled: true,
      warning: 'It is pitch black! You are likely to be eaten by an Umbra.',
      grace: 1,
      /* The dark produces an outcome and stops caring. In THIS game the
         outcome is a fight; in another it could be a death, or a move to
         a prison cell. Darkness has no opinion. If the encounter system
         is switched off, the fallback keeps the original death intact. */
      onFail: {
        type: 'encounter',
        encounter: 'umbra',
        fallback: {
          type: 'death',
          text: [
            'The Umbra is patient. It wraps around you like a second, colder skin, and the last thing you feel is its opinion of you.',
            'It collects your remains with a polite "thank you".'
          ]
        }
      }
    },
    light: {
      /* The lamp only burns oil where it is actually needed. This used to
         live in the point-and-click shell, which meant the text build and
         any compiled game quietly had an eternal lantern. */
      fuel: {
        object: 'lantern',
        turns: 120,
        warnings: [
          [60, 'The lantern\'s flame shortens. Half the oil is gone.'],
          [25, 'The lantern gutters. You can see the oil line from outside the glass now.'],
          [8, 'The lantern is running on fumes and stubbornness.']
        ],
        outText: 'The lantern burns down to nothing and goes out. The dark steps in immediately, as if it had been queuing.'
      }
    },
    /* ----------------------------------------------------------
       THE RPG LAYER
       Five stats that rise by being used, Quest for Glory style,
       so the character sheet ends up a record of how you played.

       DESIGN RULE, local to this game: skill checks only ever
       HELP. Nothing here can gate a puzzle or lock you out of the
       ending — stats change how comfortably you get there, never
       whether you can. The Machine does not enforce that, because
       it is a decision about The Sunken Crown and not about
       adventure games; it holds because no rule and no exit in
       this cartridge is conditioned on a stat, and the Machine
       offers no way to write one that is.
       ---------------------------------------------------------- */
    stats: {
      list: { str: 'Strength', agi: 'Agility', vit: 'Vitality', lore: 'Lore', luck: 'Luck' },
      classes: {
        delver: {
          name: 'Delver',
          blurb: 'A digger of other people\'s history. Strong arms, short patience, excellent shovel.',
          perk: 'Hits harder, and shrugs off the cold better than most.',
          stats: { str: 40, agi: 25, vit: 35, lore: 15, luck: 15 }
        },
        scholar: {
          name: 'Scholar',
          blurb: 'You read the footnotes. Everyone else died in the first chapter; you annotated it.',
          perk: 'Examining things teaches you more, and riddles come quicker.',
          awards: { examine: 2 },
          stats: { str: 18, agi: 22, vit: 22, lore: 45, luck: 23 }
        },
        prowler: {
          name: 'Prowler',
          blurb: 'You have never once used a door that was offered to you.',
          perk: 'Harder to hit, luckier in the dark, and quick to get away.',
          stats: { str: 24, agi: 42, vit: 24, lore: 22, luck: 38 }
        }
      },
      /* Looking closely at something new teaches you a little, once per
         thing — and the Scholar gets more out of it, which is the whole
         point of being a Scholar. */
      awards: { examine: { stat: 'lore', by: 1 } },
      health: { from: 'vit', base: 24, perPoint: 0.7, perLevel: 6 },
      growth: { base: 3, per: 8, max: 100 },
      levels: { max: 20, factor: 40, power: 1.6 },
      startClass: 'delver'
    },
    combat: true,

    /* The lurker ambushes you the first time you reach the lake shore.
       In the original build this lived in the point-and-click layer,
       which meant the text version never met it at all. */
    timers: [
      {
        id: 'lurker-ambush', after: 0, repeat: true,
        when: { room: 'lakeShore', flags: { lurkerMet: false } },
        do: [{ set: 'lurkerMet' }, { encounter: 'lurker' }]
      }
    ]
  };

  /* ------------------------------------------------------------
     CARTRIDGE
     ------------------------------------------------------------ */
  const cartridge = {
    format: 'morrowlamp-cartridge',
    formatVersion: 2,
    meta: {
      id: 'the-sunken-crown',
      title: 'THE SUNKEN CROWN',
      author: 'Morrowlamp Software',
      copyright: '© 1987 Morrowlamp Software. All rights reserved in this and several adjacent realities.',
      version: '1.0.0',
      blurb: 'A point-and-click adventure beneath a very old hill.'
    },
    intro: [
      'Ashcombe, a manor that has been ignoring the weather for three hundred years, is yours now.',
      'The deed was pinned to your grandmother\'s wall for forty years, and she had one instruction:',
      '"Go when the mist comes. Look where the light lies, sing to the soldiers, and mind the echoes — they keep the King\'s last word."',
      'The mist has come.',
      'The halls of the Sunken King are below, and somewhere in the dark, six treasures are keeping his story.'
    ],
    help: [
      'Move with compass directions or "go north". Look around with "look".',
      'Objects: take, drop, examine, open, close, lock, unlock, put X in Y, use X on Y.',
      'Special: read, light, dig, fix, row, play, sing, say, push, throw, eat, drink.',
      'Undo your last move with "undo". Save with "save 1..3", load with "load 1..3".',
      'And remember: mind the echoes.'
    ],
    quitText: 'You set down the lantern and walk out into the mist, Ashcombe behind you — still yours, still waiting. The halls keep your name.',
    startFlags: {
      melodyKnown: false, gatesOpen: false, guardDancing: false, tunnelDug: false,
      mirrorOpened: false, flourRevealed: false, boatPatched: false,
      loafEaten: false, lensSecret: false, lurkerMet: false
    },
    world: buildWorld(),
    vocabulary,
    rules,
    profile,

    /* ------------------------------------------------------------
       ENCOUNTERS
       Two things down here will fight you. Both are described as
       data; the Machine's combat handler reads them and remains
       entirely ignorant of umbras, lanterns and caves.
       ------------------------------------------------------------ */
    encounters: {
      umbra: {
        kind: 'combat',
        opponent: { name: 'The Umbra', hp: 30, attack: [4, 9], defence: 6, xp: 60 },
        intro: 'The dark thickens, gathers itself, and opens two red eyes. The Umbra has been patient. It is done being patient.',
        hit: 'It wraps around you like a second, colder skin.',
        miss: 'It pours through the space where you were.',
        defeated: 'The Umbra comes apart like smoke remembering it was only ever smoke. The cold goes out of the room.',
        dodgeFrom: 'agi',
        hurtTrains: 'vit',
        actions: [
          { id: 'attack', label: 'Attack', kind: 'strike', uses: 'str', luck: 'luck', trains: 'str',
            missText: 'You swing wide. The Umbra is not where it was, and possibly never was.' },
          { id: 'defend', label: 'Defend', kind: 'guard', trains: 'vit',
            text: 'You set yourself and wait for it to come.' },
          { id: 'light', label: 'Raise light', kind: 'strike',
            /* The lantern is the answer to the dark, so raising it also
               lights it — which solves the problem that summoned the
               creature in the first place. `do` runs ordinary rule
               actions, so nothing new had to be invented for this. */
            when: { carrying: ['lantern'] },
            deny: 'You have nothing bright enough to matter here.',
            always: true, damage: [10, 18], bonusFrom: 'lore', trains: 'lore',
            hitText: 'You hold the lantern up and force it forward. The Umbra recoils, shrieking, and comes apart at the edges — {damage} damage.',
            cls: 'good',
            do: [{ light: 'lantern' }] },
          { id: 'flee', label: 'Flee', kind: 'escape', uses: 'agi', trains: 'agi',
            text: 'You break away and put a great deal of dark between you and it.',
            failText: 'You turn to run. It is already in front of you.' }
        ],
        onDefeat: {
          type: 'death',
          text: [
            'The Umbra is patient. It wraps around you like a second, colder skin, and the last thing you feel is its opinion of you.',
            'It collects your remains with a polite "thank you".'
          ]
        }
      },

      lurker: {
        kind: 'combat',
        opponent: { name: 'Cave Lurker', hp: 22, attack: [3, 6], defence: 4, xp: 35 },
        intro: 'Something pale unfolds itself from under the shore stones, and decides you are the most interesting thing to happen here in a century.',
        hit: 'It rakes at you with too many legs.',
        miss: 'It skitters wide, clicking with irritation.',
        defeated: 'The lurker curls up, sighs through a hole in its side, and is still.',
        dodgeFrom: 'agi',
        hurtTrains: 'vit',
        actions: [
          { id: 'attack', label: 'Attack', kind: 'strike', uses: 'str', luck: 'luck', trains: 'str' },
          { id: 'defend', label: 'Defend', kind: 'guard', trains: 'vit',
            text: 'You put the lantern between you and it, and wait.' },
          { id: 'flee', label: 'Flee', kind: 'escape', uses: 'agi', trains: 'agi',
            text: 'You back away over the stones. It lets you, which is somehow worse.',
            failText: 'It is between you and the water, and it knows it.' }
        ],
        onDefeat: {
          type: 'death',
          text: ['The lurker was faster than you, in the end, and it has all the time in the world down here.']
        }
      }
    },
    endings: [
      {
        id: 'regalia-complete', kind: 'win',
        text: [
          'You place the last treasure on its velvet cushion, and the cabinet — full at last — blazes with a light that has been waiting for this exact moment.',
          'The Sunken King\'s regalia is complete. His story is told; yours has just begun.'
        ]
      }
    ],
    presentation: {
      renderer: 'ega',
      interface: 'canvas',
      audio: 'chip',
      /* Scene painters and sprites are cartridge art, supplied by
         js/scenes.js and js/sprites.js and drawn with the Machine's
         rendering primitives from js/gfx.js. They are looked up lazily
         so the cartridge still loads under Node, where there is no
         canvas and nothing to paint on. */
      art: {
        music: 'manor',
        scene: (id) => (Z.scenes ? Z.scenes.get(id) : null),
        item: (g, id, x, y, scale) => (Z.sprites ? Z.sprites.drawItem(g, id, x, y, scale) : undefined),
        /* The shell says "carrying a light"; in this game that is the
           oil lantern, which is a fact about Ashcombe, not about the
           Machine — so the translation happens here. */
        actor: (g, x, y, o) => (Z.sprites
          ? Z.sprites.drawActor(g, x, y, Object.assign({ cls: 'delver' }, o, { lantern: !!(o && o.carryingLight) }))
          : undefined),
        /* The encounter ids happen to match the monster art keys, which is
           a fact about this cartridge and stated here rather than assumed
           anywhere in the Machine. */
        opponent: (g, id, x, y, o) => (Z.sprites ? Z.sprites.monster(id)(g, x, y, 0, !!(o && o.hurt)) : undefined),
        itemScale: (scene, y) => (Z.scenes ? Z.scenes.itemScale(scene, y) : 1),
        actorScale: (scene, y) => (Z.scenes ? Z.scenes.actorScale(scene, y) : 1),
        clampToWalk: (scene, x, y) => (Z.scenes ? Z.scenes.clampToWalk(scene, x, y) : [x, y])
      }
    }
  };

  Z.cartridges = Z.cartridges || {};
  Z.cartridges['the-sunken-crown'] = cartridge;
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
