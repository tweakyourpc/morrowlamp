/* ============================================================
   MORROWLAMP GAME CARTRIDGE
   SIR CRUMBLY AND THE CELLAR RAT
   Morrowlamp Software — Demonstration Series, 1988

   Two rooms. One rat. One spoon.

   This cartridge has exactly one job: to prove that character
   stats and encounters are a capability of the Machine and not
   The Sunken Crown wearing a false moustache. Everything about
   its RPG layer is deliberately unlike Sunken Crown's:

     · two stats (MIGHT, NERVE), not five
     · one class, not three
     · ten health, not thirty
     · a completely different growth curve
     · one encounter, no darkness, no light source, no treasures

   If any of that had been baked into the runtime, this file
   could not exist.

   It has a second job now: it is the reference cartridge for the
   STRINGS TABLE. Not one line of prose is written where it is
   used. Every slot that would hold text holds '@s:some.key'
   instead, and all the writing lives in one block at the bottom
   of the file. Rewrite that block and you have rewritten the
   game; you cannot break a puzzle from inside it, because there
   is no structure in there to break. The validator refuses a key
   that does not resolve, so a typo is a build error rather than a
   blank line in somebody's transcript.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};

  const cartridge = {
    format: 'morrowlamp-cartridge',
    formatVersion: 2,
    meta: {
      id: 'sir-crumbly',
      title: 'SIR CRUMBLY AND THE CELLAR RAT',
      author: 'Morrowlamp Software, Demonstration Series',
      copyright: '© 1988 Morrowlamp Software. A teaching example. The rat is fictional.',
      version: '1.0.0',
      blurb: 'Two rooms, one rat, and a spoon you should not have brought.'
    },
    intro: '@s:intro',
    help: '@s:help',
    quitText: '@s:quit',
    startFlags: { ratBeaten: false },

    world: {
      startRoom: 'pantry',
      startInventory: ['spoon'],
      rooms: {
        pantry: {
          name: 'The Pantry',
          desc: '@s:pantry.desc',
          short: '@s:pantry.short',
          exits: { d: 'cellar' }
        },
        cellar: {
          name: 'The Cellar',
          desc: '@s:cellar.desc',
          short: '@s:cellar.short',
          exits: { u: 'pantry' },
          notes: [{ when: { flags: { ratBeaten: true } }, text: '@s:cellar.ratGone' }]
        }
      },
      objects: {
        spoon: {
          name: 'rusty spoon', aliases: ['spoon', 'rusty spoon', 'weapon'], at: 'inv', takeable: true,
          examine: '@s:spoon.examine'
        },
        rat: {
          name: 'cellar rat', aliases: ['rat', 'cellar rat', 'vermin'], at: 'cellar',
          desc: '@s:rat.desc',
          examine: '@s:rat.examine',
          cannotTake: '@s:rat.cannotTake'
        },
        cheese: {
          name: 'excellent cheese', aliases: ['cheese', 'wheel'], at: 'cellar', takeable: true,
          desc: '@s:cheese.desc',
          examine: '@s:cheese.examine',
          takeText: '@s:cheese.take'
        },
        barrel: {
          name: 'barrel', aliases: ['barrel', 'cask'], at: 'cellar',
          examine: '@s:barrel.examine'
        }
      }
    },

    vocabulary: {
      verbs: {
        attack: { words: ['attack', 'fight', 'hit', 'stab', 'poke', 'kill'], form: 'target', prompt: '@s:attack.prompt', fallback: '@s:attack.fallback' }
      }
    },

    rules: [
      {
        id: 'pick-a-fight', verb: 'attack', target: 'rat',
        when: { room: 'cellar', flags: { ratBeaten: false } },
        do: [{ encounter: 'cellarRat' }]
      },
      {
        id: 'the-rat-is-gone', verb: 'attack', target: 'rat',
        when: { flags: { ratBeaten: true } },
        do: [{ say: '@s:rat.alreadyGone' }]
      },
      {
        id: 'cheese-is-guarded', verb: 'take', target: 'cheese',
        when: { room: 'cellar', flags: { ratBeaten: false } },
        do: [{ say: '@s:cheese.guarded' }]
      }
    ],

    /* One encounter. Its actions are data; the Machine's combat handler
       reads them and has no idea what a spoon is. */
    encounters: {
      cellarRat: {
        kind: 'combat',
        opponent: { name: 'Cellar Rat', hp: 6, attack: [1, 3], defence: 1, xp: 12 },
        intro: '@s:fight.intro',
        hit: '@s:fight.hit',
        miss: '@s:fight.miss',
        defeated: '@s:fight.defeated',
        dodgeFrom: 'nerve',
        hurtTrains: 'nerve',
        actions: [
          { id: 'attack', label: 'Attack', kind: 'strike', uses: 'might', trains: 'might',
            hitText: '@s:fight.attack.hit',
            missText: '@s:fight.attack.miss' },
          { id: 'guard', label: 'Guard', kind: 'guard', trains: 'nerve',
            text: '@s:fight.guard' },
          { id: 'flee', label: 'Flee', kind: 'escape', uses: 'nerve', trains: 'nerve', chance: 0.4,
            text: '@s:fight.flee',
            failText: '@s:fight.flee.failed',
            /* Fleeing puts you back in the pantry — an outcome, decided
               here, not by the encounter system. */
            }
        ],
        onWin: { type: 'rules', do: [{ set: 'ratBeaten' }, { say: '@s:fight.won' }] },
        onFlee: { type: 'move', room: 'pantry', text: '@s:fight.fled' },
        onDefeat: { type: 'death', text: '@s:fight.lost' }
      }
    },

    profile: {
      turns: true,
      score: { ranks: [[0, 'Unarmoured'], [12, 'Rat-Tested'], [20, 'Cheese-Bearer']] },
      treasures: false,
      darkness: false,

      /* Two stats. One class. Ten health. Nothing like Sunken Crown. */
      stats: {
        list: { might: 'Might', nerve: 'Nerve' },
        classes: {
          knight: {
            name: 'Knight, Impoverished',
            blurb: 'Long on courage, short on equipment.',
            stats: { might: 3, nerve: 4 }
          }
        },
        health: { from: 'nerve', base: 6, perPoint: 1, perLevel: 3 },
        growth: { base: 2, per: 4, max: 20 },
        levels: { max: 5, factor: 12, power: 1.4 }
      },
      combat: true
    },

    endings: [
      {
        id: 'cheese-recovered', kind: 'win',
        when: { carrying: ['cheese'], flags: { ratBeaten: true } },
        score: 20,
        text: '@s:ending.win'
      }
    ],

    /* ------------------------------------------------------------
       THE WRITING
       Everything the game says, in one table, in reading order.

       Nothing in this block can change what the game *does*. There
       are no room ids here, no flags, no conditions and no actions
       — only keys and prose. Rewrite it in another voice, or
       another language, and the puzzle, the rat and the arithmetic
       of the fight are all exactly as they were.

       A key holding an array prints as several lines. A key
       nothing refers to is a warning; a reference to a key that is
       not here is a build error.
       ------------------------------------------------------------ */
    strings: {
      'intro': [
        'You are Sir Crumbly, a knight of modest reputation and no remaining budget.',
        'Your armour is in the shop. Your sword is in the other shop. What you have is a spoon.',
        'There is a rat in the cellar and a cheese behind it. This is the entire situation.'
      ],
      'help': [
        'Move with compass directions. Take things. ATTACK the rat.',
        'In a fight, type the name of an action: attack, guard, or flee.'
      ],
      'quit': 'You go home. The rat keeps the cheese. It was always going to end this way.',

      'pantry.desc': 'A pantry with empty shelves and one set of stairs going down into a cellar that smells of rat.',
      'pantry.short': 'The pantry. Down is where the trouble is.',
      'cellar.desc': 'A low cellar. On a barrel at the far end sits a cheese of obvious quality. Between you and it is a rat with opinions.',
      'cellar.short': 'The cellar. Cheese at the far end.',
      'cellar.ratGone': 'The rat is gone. The cheese is unguarded and slightly embarrassed about it.',

      'spoon.examine': 'A spoon. Rusty. It has never been sharpened, because it is a spoon.',
      'rat.desc': 'A rat the size of a small argument watches you from between you and the cheese.',
      'rat.examine': 'It is a rat. It is larger than a rat should be, and it has clearly won before.',
      'rat.cannotTake': 'You reach for the rat. The rat notes this, and files it.',
      'rat.alreadyGone': 'The rat has left. Attacking the space where it was seems unsporting.',
      'cheese.desc': 'An excellent cheese sits on a barrel.',
      'cheese.examine': 'A whole wheel of it, rinded and serious. Worth the spoon. Worth the rat, probably.',
      'cheese.take': 'You take the cheese. It is heavier than your armour and considerably more useful.',
      'cheese.guarded': 'You reach for the cheese. The rat makes a noise you did not know rats could make. You reconsider.',
      'barrel.examine': 'An empty barrel doing duty as a cheese plinth.',

      'attack.prompt': 'Attack what?',
      'attack.fallback': 'It does not deserve that.',

      'fight.intro': 'The rat squares up. It is 6 points of rat and it knows exactly what a spoon can do, which is not much.',
      'fight.hit': 'The rat darts in and bites your ankle.',
      'fight.miss': 'The rat feints, thinks better of it, and resets.',
      'fight.defeated': 'The rat sits down heavily, reconsiders its career, and leaves through a hole you had not noticed.',
      'fight.attack.hit': 'You poke the rat with the spoon for {damage}.',
      'fight.attack.miss': 'You poke the air beside the rat. The rat is unimpressed.',
      'fight.guard': 'You hold the spoon out in front of you like a very small shield.',
      'fight.flee': 'You retreat up the stairs with what dignity remains.',
      'fight.flee.failed': 'You turn to go. The rat is already between you and the stairs.',
      'fight.won': 'The cellar is yours. So, shortly, is the cheese.',
      'fight.fled': 'You arrive in the pantry, breathing hard, still holding a spoon.',
      'fight.lost': [
        'The rat stands over you, victorious, and eats the cheese itself.',
        'This is a low moment for knighthood.'
      ],

      'ending.win': [
        'You climb out of the cellar holding an excellent cheese, having defeated a rat with cutlery.',
        'It is not the deed the songs will pick, but it is the deed you did.',
        'SIR CRUMBLY WILL RETURN, probably, in "SIR CRUMBLY AND THE SLIGHTLY LARGER RAT".'
      ]
    },

    /* The route through this game, kept by the game rather than by a
       test, so `morrow prove` can play it and fail the build if the
       cartridge ever stops being finishable. Combat is resolved with
       the dice held steady: this proves the puzzle chain, not that a
       spoon is a reliable weapon. */
    walkthrough: {
      route: ['d', 'attack rat', 'take cheese'],
      ending: 'cheese-recovered',
      score: 20
    },

    presentation: {
      renderer: 'ega',
      audio: 'speaker',
      /* No painters, so no canvas: the parser shell is the honest choice
         and the compiler will not bundle a renderer this game never uses. */
      interface: 'parser'
    }
  };

  Z.cartridges = Z.cartridges || {};
  Z.cartridges['sir-crumbly'] = cartridge;
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
