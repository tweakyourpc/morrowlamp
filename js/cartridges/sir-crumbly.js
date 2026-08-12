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
    intro: [
      'You are Sir Crumbly, a knight of modest reputation and no remaining budget.',
      'Your armour is in the shop. Your sword is in the other shop. What you have is a spoon.',
      'There is a rat in the cellar and a cheese behind it. This is the entire situation.'
    ],
    help: [
      'Move with compass directions. Take things. ATTACK the rat.',
      'In a fight, type the name of an action: attack, guard, or flee.'
    ],
    quitText: 'You go home. The rat keeps the cheese. It was always going to end this way.',
    startFlags: { ratBeaten: false },

    world: {
      startRoom: 'pantry',
      startInventory: ['spoon'],
      rooms: {
        pantry: {
          name: 'The Pantry',
          desc: 'A pantry with empty shelves and one set of stairs going down into a cellar that smells of rat.',
          short: 'The pantry. Down is where the trouble is.',
          exits: { d: 'cellar' }
        },
        cellar: {
          name: 'The Cellar',
          desc: 'A low cellar. On a barrel at the far end sits a cheese of obvious quality. Between you and it is a rat with opinions.',
          short: 'The cellar. Cheese at the far end.',
          exits: { u: 'pantry' },
          notes: [{ when: { flags: { ratBeaten: true } }, text: 'The rat is gone. The cheese is unguarded and slightly embarrassed about it.' }]
        }
      },
      objects: {
        spoon: {
          name: 'rusty spoon', aliases: ['spoon', 'rusty spoon', 'weapon'], at: 'inv', takeable: true,
          examine: 'A spoon. Rusty. It has never been sharpened, because it is a spoon.'
        },
        rat: {
          name: 'cellar rat', aliases: ['rat', 'cellar rat', 'vermin'], at: 'cellar',
          desc: 'A rat the size of a small argument watches you from between you and the cheese.',
          examine: 'It is a rat. It is larger than a rat should be, and it has clearly won before.',
          cannotTake: 'You reach for the rat. The rat notes this, and files it.'
        },
        cheese: {
          name: 'excellent cheese', aliases: ['cheese', 'wheel'], at: 'cellar', takeable: true,
          desc: 'An excellent cheese sits on a barrel.',
          examine: 'A whole wheel of it, rinded and serious. Worth the spoon. Worth the rat, probably.',
          takeText: 'You take the cheese. It is heavier than your armour and considerably more useful.'
        },
        barrel: {
          name: 'barrel', aliases: ['barrel', 'cask'], at: 'cellar',
          examine: 'An empty barrel doing duty as a cheese plinth.'
        }
      }
    },

    vocabulary: {
      verbs: {
        attack: { words: ['attack', 'fight', 'hit', 'stab', 'poke', 'kill'], form: 'target', prompt: 'Attack what?', fallback: 'It does not deserve that.' }
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
        do: [{ say: 'The rat has left. Attacking the space where it was seems unsporting.' }]
      },
      {
        id: 'cheese-is-guarded', verb: 'take', target: 'cheese',
        when: { room: 'cellar', flags: { ratBeaten: false } },
        do: [{ say: 'You reach for the cheese. The rat makes a noise you did not know rats could make. You reconsider.' }]
      }
    ],

    /* One encounter. Its actions are data; the Machine's combat handler
       reads them and has no idea what a spoon is. */
    encounters: {
      cellarRat: {
        kind: 'combat',
        opponent: { name: 'Cellar Rat', hp: 6, attack: [1, 3], defence: 1, xp: 12 },
        intro: 'The rat squares up. It is 6 points of rat and it knows exactly what a spoon can do, which is not much.',
        hit: 'The rat darts in and bites your ankle.',
        miss: 'The rat feints, thinks better of it, and resets.',
        defeated: 'The rat sits down heavily, reconsiders its career, and leaves through a hole you had not noticed.',
        dodgeFrom: 'nerve',
        hurtTrains: 'nerve',
        actions: [
          { id: 'attack', label: 'Attack', kind: 'strike', uses: 'might', trains: 'might',
            hitText: 'You poke the rat with the spoon for {damage}.',
            missText: 'You poke the air beside the rat. The rat is unimpressed.' },
          { id: 'guard', label: 'Guard', kind: 'guard', trains: 'nerve',
            text: 'You hold the spoon out in front of you like a very small shield.' },
          { id: 'flee', label: 'Flee', kind: 'escape', uses: 'nerve', trains: 'nerve', chance: 0.4,
            text: 'You retreat up the stairs with what dignity remains.',
            failText: 'You turn to go. The rat is already between you and the stairs.',
            /* Fleeing puts you back in the pantry — an outcome, decided
               here, not by the encounter system. */
            }
        ],
        onWin: { type: 'rules', do: [{ set: 'ratBeaten' }, { say: 'The cellar is yours. So, shortly, is the cheese.' }] },
        onFlee: { type: 'move', room: 'pantry', text: 'You arrive in the pantry, breathing hard, still holding a spoon.' },
        onDefeat: { type: 'death', text: ['The rat stands over you, victorious, and eats the cheese itself.', 'This is a low moment for knighthood.'] }
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
        text: [
          'You climb out of the cellar holding an excellent cheese, having defeated a rat with cutlery.',
          'It is not the deed the songs will pick, but it is the deed you did.',
          'SIR CRUMBLY WILL RETURN, probably, in "SIR CRUMBLY AND THE SLIGHTLY LARGER RAT".'
        ]
      }
    ],

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
