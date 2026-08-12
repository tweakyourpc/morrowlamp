/* ============================================================
   MORROWLAMP GAME CARTRIDGE
   CAPTAIN THISTLE AND THE VENDING MACHINE OF DOOM
   Morrowlamp Software — Educational Division, 1988

   Four rooms, one puzzle, no crowns anywhere.

   This cartridge exists to prove the Machine is a machine. It
   shares the runtime, the rule dialect, the renderer primitives
   and the sound hardware with The Sunken Crown, and shares
   absolutely nothing else: different rooms, different objects,
   different verbs, its own palette, and its own scene painters
   written from scratch against the drawing primitives in gfx.js.

   If The Sunken Crown were the only cartridge, coupling could
   hide in here forever. It cannot hide from a second game.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};

  /* ------------------------------------------------------------
     ART
     Four painters, about twenty lines each, drawn with the same
     primitives the Sunken Crown scenes use. Nothing from
     js/scenes.js or js/sprites.js is loaded, referenced, or
     needed — that is the whole point of this file.
     ------------------------------------------------------------ */
  function panelWall(g, y, h, face, trim) {
    g.px(0, y, 320, h, face);
    for (let x = 0; x < 320; x += 32) {
      g.px(x, y, 1, h, trim);
      g.px(x + 2, y + 3, 26, 2, trim);
    }
    g.px(0, y + h - 3, 320, 3, trim);
  }

  /* A deck receding to a vanishing point. `near` and `far` are palette
     NAMES, because that is what g.vgrad() wants — the grid lines then
     look them up as colours. Passing g.C values here paints black on
     black, which is a very authentic 1988 mistake but not the one we
     are going for. */
  function floorGrid(g, y, near, far) {
    g.vgrad(0, y, 320, 200 - y, [far, near]);
    for (let i = 1; i < 9; i++) {
      const t = i / 8;
      const gy = Math.round(y + (200 - y) * t * t);
      g.px(0, gy, 320, 1, g.C[far]);
    }
    for (let x = -160; x <= 480; x += 80) {
      g.line(160 + (x - 160) * 0.25, y, x, 200, g.C[far]);
    }
  }

  function strip(g, y, colour) { g.stipple(0, y, 320, 3, colour, 0.5); }

  const SCENES = {
    bay: {
      entry: { start: [96, 166] },
      paint(g) {
        const C = g.C;
        panelWall(g, 0, 128, C.dkgray, C.black);
        strip(g, 20, C.ltcyan);
        /* crates, stacked by somebody in a hurry */
        for (const [x, y, w, h] of [[16, 74, 44, 54], [62, 90, 34, 38], [232, 66, 56, 62], [206, 96, 26, 32]]) {
          g.px(x, y, w, h, C.brown);
          g.px(x + 3, y + 3, w - 6, h - 6, C.black);
          g.px(x + 6, y + 6, w - 12, h - 12, C.brown);
          g.px(x + 8, y + 10, w - 16, 2, C.yellow);
        }
        /* the bulkhead door east */
        g.px(276, 56, 40, 72, C.ltgray);
        g.px(280, 60, 32, 64, C.black);
        g.px(294, 86, 4, 12, C.ltgreen);
        floorGrid(g, 128, 'dkgray', 'black');
        /* the floor grating, with something glinting under it */
        g.px(112, 150, 56, 26, C.black);
        for (let x = 114; x < 168; x += 7) g.px(x, 150, 3, 26, C.ltgray);
        g.px(136, 160, 5, 4, C.yellow);
      },
      spots: [
        { id: 'grating', x: 108, y: 146, w: 64, h: 34, walkTo: [140, 182] },
        { id: 'crates', x: 12, y: 66, w: 92, h: 62, walkTo: [70, 150] }
      ],
      exits: [{ dir: 'e', x: 274, y: 54, w: 44, h: 76 }]
    },

    corridor: {
      entry: { start: [160, 168] },
      paint(g) {
        const C = g.C;
        g.vgrad(0, 0, 320, 200, ['black', 'dkgray']);
        /* a receding corridor: rings of frame narrowing to a far door */
        for (let i = 6; i >= 0; i--) {
          const k = i / 6, w = 40 + 260 * k, h = 30 + 150 * k;
          const x = 160 - w / 2, y = 104 - h / 2;
          g.px(x, y, w, h, i % 2 ? C.dkgray : C.ltgray);
          g.px(x + 4, y + 4, w - 8, h - 8, C.black);
        }
        g.px(140, 84, 40, 44, C.dkgray);
        g.px(144, 88, 32, 36, C.ltcyan);
        strip(g, 12, C.ltmagenta);
        /* breaker panel on the left wall */
        g.px(18, 66, 34, 44, C.ltgray);
        g.px(22, 70, 26, 36, C.black);
        g.px(26, 76, 18, 6, C.ltred);
        g.px(26, 88, 18, 6, C.dkgray);
        /* toolbox on the floor */
        g.px(238, 148, 34, 20, C.ltred);
        g.px(238, 144, 34, 6, C.red);
        g.px(250, 141, 10, 4, C.dkgray);
        floorGrid(g, 132, 'dkgray', 'black');
      },
      spots: [
        { id: 'breaker', x: 14, y: 62, w: 42, h: 52, walkTo: [70, 168] },
        { id: 'toolbox', x: 234, y: 138, w: 42, h: 32, walkTo: [230, 178] },
        { id: 'magnet', x: 244, y: 150, w: 16, h: 14, icon: true, iconAt: [252, 156], walkTo: [230, 178] }
      ],
      exits: [
        { dir: 'w', x: 0, y: 40, w: 14, h: 140 },
        { dir: 'e', x: 306, y: 40, w: 14, h: 140 },
        { dir: 'n', x: 138, y: 82, w: 44, h: 48 }
      ]
    },

    mess: {
      entry: { start: [200, 168] },
      paint(g) {
        const C = g.C;
        panelWall(g, 0, 120, C.ltgray, C.dkgray);
        strip(g, 16, C.yellow);
        /* the vending machine of doom, humming with menace */
        g.px(36, 34, 74, 106, C.ltred);
        g.px(40, 38, 66, 98, C.black);
        g.px(44, 42, 58, 62, C.ltcyan);
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 4; c++) g.px(48 + c * 14, 46 + r * 20, 10, 14, r === 1 && c === 2 ? C.yellow : C.ltmagenta);
        }
        g.px(44, 110, 58, 22, C.dkgray);
        g.px(50, 116, 20, 10, C.black);
        g.px(84, 114, 8, 8, C.ltgreen);
        /* a table nobody has wiped since the last captain */
        g.px(180, 118, 96, 6, C.brown);
        g.px(186, 124, 6, 26, C.brown);
        g.px(264, 124, 6, 26, C.brown);
        floorGrid(g, 140, 'dkgray', 'black');
      },
      spots: [
        { id: 'vendor', x: 32, y: 30, w: 82, h: 112, walkTo: [130, 172] },
        { id: 'fuse', x: 44, y: 110, w: 24, h: 20, icon: true, iconAt: [58, 120], walkTo: [130, 172] }
      ],
      exits: [{ dir: 's', x: 130, y: 150, w: 90, h: 50 }]
    },

    bridge: {
      entry: { start: [160, 170] },
      paint(g) {
        const C = g.C;
        g.vgrad(0, 0, 320, 96, ['black', 'blue']);
        /* the viewport, and a great many stars that cost nothing */
        g.px(28, 14, 264, 76, C.black);
        g.speck(28, 14, 264, 76, C.white, 0.03, 17);
        g.speck(28, 14, 264, 76, C.ltcyan, 0.012, 91);
        g.ellipse(232, 58, 26, 26, C.ltmagenta);
        g.stipple(206, 32, 52, 52, C.white, 0.14);
        g.px(24, 10, 272, 4, C.ltgray);
        g.px(24, 90, 272, 6, C.ltgray);
        panelWall(g, 96, 40, C.dkgray, C.black);
        /* consoles, blinking in a reassuring sort of way */
        for (const x of [30, 118, 206]) {
          g.px(x, 104, 84, 30, C.ltgray);
          g.px(x + 6, 108, 72, 16, C.black);
          for (let i = 0; i < 6; i++) g.px(x + 10 + i * 11, 112, 6, 4, i % 2 ? C.ltgreen : C.yellow);
        }
        floorGrid(g, 134, 'dkgray', 'black');
      },
      spots: [{ id: 'helm', x: 118, y: 100, w: 88, h: 38, walkTo: [160, 176] }],
      exits: [{ dir: 's', x: 130, y: 156, w: 90, h: 44 }]
    }
  };

  /* Item icons, drawn the same way — small, and entirely in code. */
  function drawItem(g, id, x, y, scale) {
    const C = g.C;
    if (scale && scale !== 1) {
      g.ctx.save(); g.ctx.translate(x, y); g.ctx.scale(scale, scale);
      drawItem(g, id, 0, 0, 1);
      g.ctx.restore();
      return;
    }
    const P = (dx, dy, w, h, c) => g.px(x + dx, y + dy, w, h, c);
    switch (id) {
      case 'magnet':
        P(-6, -5, 4, 10, C.ltred); P(2, -5, 4, 10, C.ltred);
        P(-6, -7, 12, 3, C.ltgray); break;
      case 'coin':
        P(-4, -4, 8, 8, C.yellow); P(-2, -2, 4, 4, C.brown); break;
      case 'fuse':
        P(-6, -3, 12, 6, C.ltcyan); P(-7, -2, 2, 4, C.ltgray);
        P(5, -2, 2, 4, C.ltgray); break;
      default:
        P(-3, -3, 6, 6, C.white);
    }
  }

  /* A stand-in captain: no shared sprite library, just a person. */
  function drawActor(g, x, y, o) {
    const C = g.C;
    const s = (o && o.scale) || 1;
    const P = (dx, dy, w, h, c) => g.px(x + dx * s, y + dy * s, Math.max(1, w * s), Math.max(1, h * s), c);
    P(-4, -30, 8, 8, C.brown);        // head
    P(-4, -32, 8, 3, C.ltred);        // extremely regulation cap
    P(-6, -22, 12, 14, C.ltcyan);     // tunic
    P(-9, -21, 3, 11, C.ltcyan);      // arms
    P(6, -21, 3, 11, C.ltcyan);
    P(-5, -8, 4, 8, C.dkgray);        // legs
    P(1, -8, 4, 8, C.dkgray);
    g.stipple(x - 8 * s, y - 1, 16 * s, 3, C.black, 0.5);
  }

  /* ------------------------------------------------------------
     THE CARTRIDGE
     ------------------------------------------------------------ */
  const cartridge = {
    format: 'morrowlamp-cartridge',
    formatVersion: 2,
    meta: {
      id: 'captains-thistle',
      title: 'CAPTAIN THISTLE AND THE VENDING MACHINE OF DOOM',
      author: 'Morrowlamp Software, Educational Division',
      copyright: '© 1988 Morrowlamp Software. Suitable for ages 9 and up, and for captains.',
      version: '1.0.0',
      blurb: 'Four rooms. One vending machine. The fate of a survey vessel.'
    },
    intro: [
      'The survey vessel THISTLE has lost main power, which is embarrassing,',
      'because you are its captain and there is nobody else aboard to blame.',
      'The breaker in Corridor Nine needs a fuse. The ship has exactly one spare.',
      'It is inside the mess hall vending machine, and the vending machine takes coins.'
    ],
    help: [
      'Move with compass directions. Look at things. Take things.',
      'Use one thing on another with "use X on Y", or put things in things.',
      'The ship is small. The puzzle is smaller. You will be fine.'
    ],
    quitText: 'You sit down in the dark and wait for someone to notice. Nobody does.',
    startFlags: { coinFreed: false, vendorPaid: false, powerOn: false },

    world: {
      startRoom: 'bay',
      startInventory: [],
      rooms: {
        bay: {
          name: 'Cargo Bay Four',
          desc: 'A cargo bay stacked with crates that have outlived their manifest. A bulkhead door leads east, and the floor grating hums under your boots.',
          short: 'Cargo Bay Four. The crates are still not labelled.',
          exits: { e: 'corridor' }
        },
        corridor: {
          name: 'Corridor Nine',
          desc: 'A corridor that recedes toward the bridge door with the confidence of a corridor that has never been anywhere. A breaker panel hangs open on the left wall, one socket conspicuously empty.',
          short: 'Corridor Nine. The breaker panel is still open.',
          exits: {
            w: 'bay',
            e: 'mess',
            n: { room: 'bridge', flagReq: 'powerOn', deny: 'The bridge door is dead. No power, no door, no bridge.' }
          },
          notes: [{ when: { flags: { powerOn: true } }, text: 'The bridge door stands open, lit a reassuring green.' }]
        },
        mess: {
          name: 'Mess Hall',
          desc: 'A mess hall with one table and one vending machine. The machine is red, tall, and radiates the specific menace of a device that has eaten money before.',
          short: 'The mess hall. The vending machine watches you.',
          exits: { s: 'corridor' }
        },
        bridge: {
          name: 'The Bridge',
          desc: 'The bridge of the THISTLE, consoles alight, viewport full of an entirely acceptable nebula. The helm is yours again.',
          short: 'The bridge. Everything is on.',
          exits: { s: 'corridor' }
        }
      },
      objects: {
        grating: {
          name: 'floor grating', aliases: ['grating', 'grate', 'floor'], at: 'bay',
          desc: 'A section of floor grating covers a shallow duct. Something small and round glints down there.',
          examine: 'Through the grating you can see a coin, lying in the duct with the smugness of a thing that knows you have no fingers that thin.'
        },
        crates: {
          name: 'crates', aliases: ['crates', 'crate', 'boxes'], at: 'bay',
          desc: 'Cargo crates are stacked against both walls.',
          examine: 'Survey equipment, ration packs, and one crate marked SPARE FUSES that contains, on inspection, a note reading "used them all — sorry — T."'
        },
        coin: {
          name: 'ship\'s coin', aliases: ['coin', 'credit', 'token'], takeable: true,
          desc: 'A ship\'s coin lies on the deck where the magnet dropped it.',
          examine: 'A brass ship\'s coin, stamped THISTLE on one side and VEND ONLY on the other. Somebody in procurement thought this was funny.'
        },
        toolbox: {
          name: 'toolbox', aliases: ['toolbox', 'tool box', 'box'], at: 'corridor',
          container: true, open: false, contents: ['magnet'],
          desc: 'A red toolbox sits against the wall.',
          examine: 'The ship\'s toolbox, which contains four spanners for a ship with no bolts, and one salvage magnet.',
          openText: 'The toolbox opens with the clatter of tools you will never need.'
        },
        magnet: {
          name: 'salvage magnet', aliases: ['magnet', 'salvage magnet'], takeable: true,
          examine: 'A horseshoe magnet on a short cord. Rated for hull plate. Wildly overqualified for a coin.'
        },
        breaker: {
          name: 'breaker panel', aliases: ['breaker', 'panel', 'socket', 'fusebox'], at: 'corridor',
          container: true, open: true, contents: [],
          desc: 'The breaker panel hangs open, one socket empty.',
          examine: 'Twelve fuses seated, one socket gaping. A label beneath it reads MAIN — DO NOT OPERATE VESSEL WITHOUT.'
        },
        vendor: {
          name: 'vending machine', aliases: ['vending machine', 'vendor', 'machine', 'vending'], at: 'mess',
          desc: 'The vending machine of doom stands against the wall, humming.',
          examine: 'Behind the glass: eleven bags of crisps and, on the middle shelf, one emergency fuse, which somebody has priced at one coin. There is a coin slot. There is always a coin slot.'
        },
        fuse: {
          name: 'emergency fuse', aliases: ['fuse'], takeable: true,
          desc: 'The emergency fuse sits in the vending machine\'s tray.',
          examine: 'A blue ceramic fuse, rated for a main bus, sold as a snack. The Educational Division would like you to know this is not how procurement should work.'
        },
        helm: {
          name: 'helm', aliases: ['helm', 'console', 'controls'], at: 'bridge',
          desc: 'The helm waits, lit and patient.',
          examine: 'Every light is green. There is nothing left to fix, which is the most alarming thing that has happened all day.'
        }
      }
    },

    vocabulary: {
      verbs: {
        pry:  { words: ['pry', 'lever', 'lift'], form: 'target', seps: ['with'], prompt: 'Pry what?', fallback: 'That does not lift.' },
        fish: { words: ['fish', 'hook'], form: 'target', seps: ['with'], optional: true, anywhere: true, fallback: 'There is nothing to fish for here.' },
        kick: { words: ['kick', 'shake', 'thump'], form: 'target', prompt: 'Kick what?', fallback: 'You kick it. It does not help, but it does feel correct.' },
        push: { words: ['push', 'press', 'shove'], form: 'target', prompt: 'Push what?', fallback: 'It does not move, and now your palm is dusty.' },
        give: { words: ['give', 'feed', 'insert'], form: 'target', seps: ['to', 'into'], prompt: 'Give what?', fallback: 'Nothing aboard wants it.' }
      }
    },

    rules: [
      {
        id: 'magnet-the-coin', reach: 'anywhere',
        verb: ['use', 'fish', 'pry'], target: ['magnet', 'grating'], with: ['magnet', 'grating'],
        when: { room: 'bay', carrying: ['magnet'], flags: { coinFreed: false } },
        do: [
          { set: 'coinFreed' },
          { give: 'coin' },
          { say: 'You lower the salvage magnet through the grating. There is a small, decisive clack, and the coin comes up stuck to it like a barnacle with a plan.' },
          { sound: 'chime' }
        ]
      },
      {
        id: 'no-magnet-no-coin', reach: 'anywhere',
        verb: ['use', 'fish', 'pry', 'take'], target: ['grating', 'coin'],
        when: { room: 'bay', flags: { coinFreed: false } },
        do: [{ say: 'Your fingers are exactly one grating too wide. You need something that reaches, and preferably something that grips.' }]
      },
      {
        id: 'feed-the-vendor', verb: ['put', 'use', 'give'], target: 'coin', with: 'vendor',
        when: { room: 'mess', carrying: ['coin'], flags: { vendorPaid: false } },
        do: [
          { set: 'vendorPaid' },
          { destroy: 'coin' },
          { drop: 'fuse' },
          { say: 'The coin goes in. The machine thinks about it for a long, editorial moment — then something turns over inside it and the emergency fuse drops into the tray with a clunk of pure institutional triumph.' },
          { sound: 'chime' }
        ]
      },
      {
        id: 'vendor-wants-payment', reach: 'anywhere',
        verb: ['take', 'push', 'kick'], target: ['fuse', 'vendor'],
        when: { room: 'mess', flags: { vendorPaid: false } },
        do: [{ say: 'The glass holds. The machine hums, patient and mercantile. It wants a coin, and it has all the time in the universe.' }]
      },
      {
        id: 'fit-the-fuse', verb: ['put', 'use'], target: 'fuse', with: 'breaker',
        when: { room: 'corridor', carrying: ['fuse'], flags: { powerOn: false } },
        do: [
          { set: 'powerOn' },
          { destroy: 'fuse' },
          { say: 'You seat the fuse in the empty socket. The ship comes back one system at a time, like someone waking up and remembering they have a job.' },
          { say: { cls: 'good', text: 'The bridge door slides open, lit a reassuring green.' } },
          { music: 'triumph' },
          { sound: 'chime' }
        ]
      },
      {
        id: 'breaker-needs-a-fuse', verb: ['examine', 'push', 'kick'], target: 'breaker',
        when: { flags: { powerOn: false } },
        do: [{ say: 'Twelve fuses seated, one socket gaping. Until something fills it, the THISTLE is a very large torch with no batteries.' }]
      }
    ],

    profile: {
      turns: true,
      score: {
        enabled: true,
        ranks: [[0, 'Adrift'], [10, 'Resourceful'], [25, 'Captain, Restored']]
      },
      treasures: { enabled: false },
      darkness: { enabled: false }
    },

    endings: [
      {
        id: 'power-restored', kind: 'win',
        when: { room: 'bridge' },
        score: 25,
        text: [
          'You take the helm. The nebula outside is, on reflection, quite a good one.',
          'Somewhere behind you the vending machine is already saving up for its next victim.',
          'CAPTAIN THISTLE WILL RETURN in "CAPTAIN THISTLE AND THE SLIGHTLY LARGER VENDING MACHINE".'
        ]
      }
    ],

    presentation: {
      renderer: 'cga',
      interface: 'canvas',
      audio: 'speaker',
      art: {
        music: null,
        scene: (id) => SCENES[id] || null,
        item: drawItem,
        actor: drawActor,
        itemScale: () => 1,
        actorScale: () => 1,
        clampToWalk: (scene, x, y) => [x, y]
      }
    }
  };

  Z.cartridges = Z.cartridges || {};
  Z.cartridges['captains-thistle'] = cartridge;
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
