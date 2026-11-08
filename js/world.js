/* ============================================================
   THE SUNKEN CROWN — world data
   An original homage to the great text adventures. All prose
   and puzzles are original; no Infocom text is reproduced.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};

  /* Room exits may be:
       "n": "roomId"                       — always passable
       {room, flagReq, deny}               — requires story flag
       {room, objReq, open:true, deny}     — requires object state .open
       {room, objReq, lit:true, deny}      — requires object state .lit
  */

  const rooms = {
    yard: {
      name: 'Ashcombe Yard',
      dark: false,
      map: [300, 42],
      desc: [
        'A cobbled yard stretches before a grey manor house that has been ignoring the weather for three hundred years. ',
        'Morning mist coils around the gateposts, and the gravel road curls away east toward the wide world — and, your grandmother swore, toward a kingdom that sank into a hill. ',
        'A path runs west, round the side of the house.'
      ].join(''),
      short: 'The cobbled yard of Ashcombe. The mist has not made up its mind about you yet.',
      exits: {
        n: 'porch',
        w: 'kitchenGarden',
        e: { room: null, deny: 'The road curls away into the mist. Somewhere out there is a town with warm food and no umbras. Not today.' },
        s: { room: null, deny: 'The woods are thick with brambles and a low, patient sound. The trees can keep their secrets.' },
        d: { room: 'wellBottom', deny: 'The well is the only way down here.' }
      }
    },

    porch: {
      name: 'Front Porch',
      dark: false,
      map: [300, 108],
      desc: [
        'A wide porch with warped boards and a swinging chair that has not swung since anyone cared to push it. ',
        'The manor door ahead is banded in iron, worn smooth at the handle by centuries of hands. A doormat lies in front of it, doing its best.'
      ].join(''),
      short: 'The front porch. The iron-banded door waits, patient as a cat.',
      exits: {
        n: 'hall',
        s: 'yard'
      }
    },

    hall: {
      name: 'Entrance Hall',
      dark: false,
      map: [300, 172],
      desc: [
        'A grand entrance hall that has given up on grand. Dust hangs in the light like it owns the place. ',
        'A chandelier slumps overhead with only a few sad crystals left. A grandfather clock stands against the wall. ',
        'To the west, a study; to the east, a kitchen. A heavy trapdoor in the floor leads to the cellar, and a long glass cabinet against the north wall gleams, empty and expectant.'
      ].join(''),
      short: 'The entrance hall, dust-thick and dignified. A long glass cabinet gleams expectantly.',
      exits: {
        s: 'porch',
        w: 'study',
        e: 'kitchen',
        d: { room: 'cellar', objReq: 'hatch', open: true, deny: 'The trapdoor is shut. (Unlock it, then open it.)' },
        u: { room: 'grandmotherRoom', flagReq: 'stairsCrossed', deny: 'The middle steps of the grand staircase lie in a heap of rubble. The banister post at the top still stands. (Something long, looped over it, would get you up.)' }
      }
    },

    study: {
      name: 'The Study',
      dark: false,
      map: [188, 172],
      desc: [
        'A study walled in bookshelves, smelling of old paper and older decisions. ',
        'Over the cold hearth hangs a silver lyre, and above it a portrait of a king whose eyes follow you with mild professional interest. ',
        'A writing desk stands beneath the window, its drawer hanging open an inch, as if waiting to be discovered.'
      ].join(''),
      short: 'The study, full of books and a portrait that is watching you a little too closely.',
      exits: {
        e: 'hall'
      }
    },

    kitchen: {
      name: 'Kitchen',
      dark: false,
      map: [412, 172],
      desc: [
        'A kitchen where the last meal was cooked before the plumbing was invented. ',
        'A black iron stove stands cold, a table holds the remains of someone\'s unfinished business — a knife, a loaf of bread — and a moth-eaten curtain hangs by the window. ',
        'A pantry door stands ajar in the corner, and a back door is set in the north wall.'
      ].join(''),
      short: 'The kitchen. Everything here has been cold for a very long time.',
      exits: {
        w: 'hall',
        n: { room: 'kitchenGarden', objReq: 'backDoor', open: true, deny: 'The back door is shut, and bolted on this side.' },
        u: { room: 'grandmotherRoom', flagReq: 'servantStair', deny: 'There is no way up from the kitchen that you know of.' }
      }
    },

    cellar: {
      name: 'Cellar',
      dark: true,
      map: [300, 232],
      desc: [
        'A low stone cellar under the manor, cool as a held breath. ',
        'Shelves line the walls with jars that have forgotten their contents\' names. A shovel leans against the far wall, and a wine rack holds a row of empty bottles. ',
        'In the north wall, a crack exhales a cold draft — wide enough for a fist, not for a treasure hunter.'
      ].join(''),
      short: 'The cellar, cool and full of things that have waited politely.',
      exits: {
        u: 'hall',
        s: { room: 'tunnel', flagReq: 'tunnelDug', deny: 'A wall of packed earth. You would need to dig.' }
      }
    },

    tunnel: {
      name: 'Grassy Tunnel',
      dark: true,
      map: [300, 286],
      desc: [
        'A tunnel that does not believe in walls: roots hang like dusty curtains and grass grows from the ceiling, green as a held grudge. ',
        'The way you dug lies behind you; ahead, the tunnel descends into a deeper, wetter dark.'
      ].join(''),
      short: 'The grassy tunnel, descending into a wetter dark.',
      exits: {
        u: 'cellar',
        s: 'caveMouth'
      }
    },

    caveMouth: {
      name: 'Cavern of Echoes',
      dark: false,
      map: [300, 340],
      desc: [
        'A vast cavern that swallows sound and gives back only its opinion. ',
        'To the east, the tunnel collapses into rubble. To the west, a shore glows faintly blue. ',
        'To the south, set into the cliff face, twin brass doors rise thirty feet — and before them stands a statue of a woman, mouth open as if she died mid-word.'
      ].join(''),
      short: 'The Cavern of Echoes. Sound is a tourist here.',
      exits: {
        n: 'tunnel',
        w: 'lakeShore',
        e: { room: null, deny: 'The tunnel has collapsed here. This is, on balance, a good thing.' },
        s: { room: 'gatePassage', flagReq: 'gatesOpen', deny: 'The brass gates remain shut, thirty feet of stubborn.' }
      }
    },

    gatePassage: {
      name: 'Passage of Brass',
      dark: true,
      map: [188, 340],
      desc: [
        'Beyond the gates, a passage of riveted brass, warm as a struck bell, hums with a deep note you feel in your teeth. ',
        'It runs south into darkness, and a corridor opens west.'
      ].join(''),
      short: 'The brass passage, humming a note you feel in your teeth.',
      exits: {
        n: 'caveMouth',
        s: 'guardroom',
        w: 'mirrorHall'
      }
    },

    guardroom: {
      name: 'Guardroom of the Sunken King',
      dark: true,
      map: [188, 402],
      desc: [
        'A guardroom laid out as if the guard might return at any moment — which, in a manner of speaking, he has. ',
        'A spectral sentinel in tarnished plate stands before the south door, translucent, humming an old tune to itself. ',
        'A steel door stamped VAULT — DO NOT DISTURB sits to the west.'
      ].join(''),
      short: 'The guardroom. The spectral sentinel hums, and waits.',
      exits: {
        n: 'gatePassage',
        s: { room: 'throne', guardReq: 'guardDancing', deny: 'The sentinel plants itself in the doorway. "HALT. The King\'s slumber must not be disturbed."' },
        w: { room: 'vault', objReq: 'vaultDoor', open: true, deny: 'The steel door is shut, stamped VAULT — DO NOT DISTURB.' }
      }
    },

    throne: {
      name: 'Throne Room of the Sunken King',
      dark: true,
      map: [188, 464],
      desc: [
        'A throne room of black stone, vaulted so high the ceiling apologizes for itself. ',
        'On the throne sits a skeleton in moth-eaten robes — the Sunken King, at last at rest, patient as arithmetic. ',
        'At his feet, on a velvet cushion, rests the Enchanter\'s Crown, dusty and entirely unguarded. A stone staircase winds down behind the throne.'
      ].join(''),
      short: 'The throne room. The Sunken King keeps his appointment with eternity.',
      exits: {
        n: 'guardroom',
        d: 'tomb'
      }
    },

    tomb: {
      name: 'Tomb of the Sunken King',
      dark: true,
      map: [188, 524],
      desc: [
        'A round chamber hewn from living stone. In the centre, a sarcophagus of pale marble, carved with a king who looks considerably less tired than his skeleton. ',
        'The air is still and cold, and very, very patient.'
      ].join(''),
      short: 'The tomb. The air is patient.',
      exits: {
        u: 'throne'
      }
    },

    vault: {
      name: 'The Vault',
      dark: true,
      map: [92, 402],
      desc: [
        'The King\'s vault: shelves of dust where the real treasures once stood, and in the centre a single pedestal. ',
        'Upon it rests a jade scepter, carved with snakes that have been biting their own tails for a thousand years and feel fine about it.'
      ].join(''),
      short: 'The vault, mostly dust and one very fine scepter.',
      exits: {
        e: 'guardroom'
      }
    },

    mirrorHall: {
      name: 'Hall of Mirrors',
      dark: true,
      map: [92, 340],
      desc: [
        'Every wall is a mirror. A dozen versions of you watch you, none of them blinking at the same time. ',
        'The west wall catches your eye: the mirror there is slightly, subtly wrong — it does not quite reflect the torchlight.'
      ].join(''),
      short: 'The hall of mirrors. You are all over the place.',
      exits: {
        e: 'gatePassage',
        w: { room: 'mirrorSanctum', flagReq: 'mirrorOpened', deny: 'You press against the glass. It is a mirror, not a door. It knows you cannot tell the difference, and it forgives you.' }
      }
    },

    mirrorSanctum: {
      name: 'Sanctum of the Opal Idol',
      dark: true,
      map: [92, 402 + 62],
      desc: [
        'A small chamber hidden behind the false mirror. On a brass altar, the Opal Idol glows with its own internal weather — storms the size of coins turning over inside it. ',
        'It has waited here for someone worth the wait.'
      ].join(''),
      short: 'The sanctum, where the Opal Idol keeps its private weather.',
      exits: {
        e: 'mirrorHall'
      }
    },

    lakeShore: {
      name: 'Shore of the Sunken Lake',
      dark: false,
      map: [412, 340],
      desc: [
        'An underground lake, black as ink, glowing faintly blue with phosphorescent fungi. ',
        'A rotted rowboat lies half on the shore, holed the size of a fist, looking resigned. ',
        'Across the water, a small island rises, and on it, a stone plinth — with something small and golden on top.'
      ].join(''),
      short: 'The shore of the sunken lake. The boat looks resigned to its fate.',
      exits: {
        e: 'caveMouth',
        w: { room: 'lakeIslet', flagReq: 'boatPatched', deny: 'The boat has a hole the size of a fist. The water would come in faster than you could bail. (Try: fix boat)' }
      }
    },

    lakeIslet: {
      name: 'Islet of the Chalice',
      dark: false,
      map: [412, 402],
      desc: [
        'A small island of dry grass, absurdly tidy for a place no one has visited in a thousand years. ',
        'On the stone plinth rests a gilded chalice, dusty and unhurried, as if it expected you yesterday and is politely not mentioning it.'
      ].join(''),
      short: 'The islet, tidy and patient, with a very good chalice on it.',
      exits: {
        e: 'lakeShore'
      }
    },

    wellBottom: {
      name: 'Bottom of the Dry Well',
      dark: false,
      map: [412, 42],
      desc: [
        'A dry well, forty feet of stone and shadow above you. Old leaves carpet the floor, and among them lies a sunstone, glowing with a warm honey light, as if the well had swallowed a small piece of the sun and was keeping it.'
      ].join(''),
      short: 'The bottom of the dry well. The sunstone glows like a held breath of light.',
      exits: {
        u: 'yard'
      }
    },

    /* --- upstairs and the back of the house (story bible, sections 6 and 6b) --- */
    grandmotherRoom: {
      name: 'Grandmother\'s Room',
      dark: false,
      map: [188, 108],
      desc: [
        'A low room under the eaves, where the roof has fallen in and the moon has let itself in after it. ',
        'Moonlight lies across a narrow bed that was made forty years ago and never slept in since, and a writing table with its chair pushed back, as if she had only just stood up. ',
        'The grand stair drops away below; in the corner there is a narrow servants\' door; overhead, the hole in the roof, and the garden beyond it.'
      ].join(''),
      short: 'Your grandmother\'s room. The moon keeps it now.',
      exits: {
        d: { room: 'hall', flagReq: 'stairsCrossed', deny: 'From up here the gap in the stairs looks even worse. You need a way down that is not falling.' },
        e: { room: 'kitchen', flagReq: 'servantStair', deny: 'The servants\' door is stuck fast in its frame.' },
        u: { room: 'kitchenGarden', flagReq: 'ladderUp', deny: 'The hole in the roof opens on a long drop into the garden. Without a ladder, the garden would get you all at once.' }
      }
    },

    kitchenGarden: {
      name: 'Kitchen Garden',
      dark: false,
      map: [524, 172],
      desc: [
        'Behind the manor, a kitchen garden has gone back to being a field with ambitions. ',
        'Moonlight silvers the overgrown beds and a yew older than the house, and under the yew stands a single gravestone. ',
        'To the north a glasshouse glints, half its panes gone. The kitchen\'s back door is set in the wall to the south, and two storeys up the roof has a hole in it the shape of a bad winter. ',
        'From the woods comes a low, patient sound. A path runs west, round the side of the house, to the yard.'
      ].join(''),
      short: 'The overgrown kitchen garden. The yew keeps watch over its one grave.',
      exits: {
        w: 'yard',
        n: 'glasshouse',
        s: { room: 'kitchen', objReq: 'backDoor', open: true, deny: 'The back door is bolted from the inside.' },
        u: { room: 'grandmotherRoom', flagReq: 'ladderUp', deny: 'The hole in the roof is two storeys up. You would need a ladder, or wings, and you left your wings in your other coat.' }
      }
    },

    glasshouse: {
      name: 'The Glasshouse',
      dark: false,
      map: [524, 108],
      desc: [
        'A glasshouse that has lost its argument with the weather: half its panes lie on the floor, and the rest hold the moon in pieces. ',
        'Dead vines have climbed the frame and stayed there. On the potting bench, among clay pots and a trowel rusted to its own shadow, sits a phonograph with a brass horn like a frozen lily. ',
        'The garden is south.'
      ].join(''),
      short: 'The glasshouse, full of broken moonlight and your grandmother\'s phonograph.',
      exits: {
        s: 'kitchenGarden'
      }
    }
  };

  /* ---------- objects ---------- */
  const objects = {
    /* --- start inventory --- */
    lantern: {
      name: 'oil lantern',
      aliases: ['lantern', 'lamp', 'oil lantern', 'light'],
      takeable: true,
      light: true,
      lit: true,
      desc: '',
      examine: 'A brass lantern of the old school: reliable, heavy, and faintly judgmental. Its wick is trimmed, its glass is clean, and it is currently lit.',
      useText: 'You top up the lantern from the jar, even though it was fine. It hums with approval.'
    },
    note: {
      name: 'folded note',
      aliases: ['note', 'map', 'deed', 'letter', 'paper'],
      takeable: true,
      desc: '',
      examine: 'A folded note in your grandmother\'s hand. On it: a deed for Ashcombe, and a map with shaky annotations — "the well is dry", "the lake is deep", "the King keeps his secrets where the walls reflect".',
      read: [
        'The note reads:',
        '"To my favourite sceptic — Ashcombe is yours. The estate is a puzzle box; the Halls beneath it, a memory. Go when the mist comes. Look where the light lies, sing to the soldiers, and mind the echoes — they keep the King\'s last word."',
        'Scrawled at the bottom, in a different ink: "P.S. Don\'t drink the lamp oil."'
      ]
    },

    /* --- yard --- */
    mailbox: {
      name: 'mailbox',
      aliases: ['mailbox', 'box', 'mail'],
      takeable: false,
      container: true,
      open: true,
      contents: [],
      desc: 'A rusted mailbox gapes open on a crooked post, empty. The mailman has not called since the mist settled.',
      examine: 'The mailbox is empty. It has been empty so long it has begun to enjoy it.'
    },
    well: {
      name: 'dry well',
      aliases: ['well', 'stone well', 'rusty ladder'],
      takeable: false,
      desc: 'A stone well, dry as a sermon. A rusty ladder descends into shadow, and the faintest honey-coloured glow rises from below.',
      examine: 'Forty feet of rough stone, a ladder of dubious intent, and at the bottom — something glowing. The note said the well is dry. The note was right, and also wrong.'
    },

    /* --- the stairs, the back door, and what lies beyond them --- */
    stairs: {
      name: 'grand staircase',
      aliases: ['stairs', 'staircase', 'stair', 'steps', 'banister', 'post', 'banister post', 'grand staircase', 'rubble'],
      takeable: false,
      desc: 'A grand staircase climbs towards a landing it can no longer reach.',
      examine: 'The grand staircase climbs halfway to glory and then gives up: its middle steps lie in a heap of rubble at the bottom. Above the gap, the banister post at the top still stands, solid as a grudge. Something long, looped over that post, would get you up.'
    },
    backDoor: {
      name: 'back door',
      aliases: ['back door', 'bolt', 'backdoor'],
      takeable: false,
      container: true,
      open: false,
      desc: '',
      examine: 'A plank door set deep in the wall, with an iron bolt on the kitchen side.',
      openText: 'You draw the bolt and haul the back door open. Night air comes in, smelling of wet leaves and of something the woods are thinking about.'
    },
    servantDoor: {
      name: 'servants\' door',
      aliases: ['servants door', 'servants\' door', 'servant door', 'narrow door'],
      takeable: false,
      desc: '',
      examine: 'A narrow door for servants, painted the colour of not being noticed. It is stuck in its frame, not locked.'
    },
    roofHole: {
      name: 'hole in the roof',
      aliases: ['hole', 'roof', 'hole in the roof'],
      takeable: false,
      desc: '',
      examine: 'A hole the shape of a bad winter, two storeys up. The moon uses it as a door.'
    },
    cylinder: {
      name: 'wax cylinder',
      aliases: ['cylinder', 'wax cylinder', 'recording', 'record', 'sleeve'],
      takeable: true,
      desc: 'On the writing table, a wax cylinder sits in a cardboard sleeve.',
      examine: 'A brown wax cylinder in a cardboard sleeve. On the sleeve, in your grandmother\'s hand: "1. For whoever comes next. Play it in the glasshouse."'
    },
    verse: {
      name: 'page of verse',
      aliases: ['page', 'verse', 'second verse', 'page of verse', 'lullaby verse'],
      takeable: true,
      desc: 'Beside it lies a single page in the same hand.',
      read: [
        'In your grandmother\'s hand, under a heading underlined twice, THE SECOND VERSE:',
        '"Sleep now, keeper, the watch is done; the door is barred and the halls are won. Lay down the key that you held so long, and go where the halls have kept their song."'
      ]
    },
    grave: {
      name: 'gravestone',
      aliases: ['grave', 'gravestone', 'headstone', 'yew', 'tree', 'inscription'],
      takeable: false,
      desc: '',
      examine: [
        'A plain stone under the yew, the letters cut deep:',
        '"THE LAST ASHCOMBE BUT ONE. SHE WENT DOWN, AND SHE CAME BACK UP, WHICH IS MORE THAN MOST. SING IT ALL THE WAY THROUGH."'
      ]
    },
    phonograph: {
      name: 'phonograph',
      aliases: ['phonograph', 'gramophone', 'horn', 'player', 'bench', 'potting bench'],
      takeable: false,
      desc: '',
      examine: 'A cylinder phonograph with a brass horn like a frozen lily. Its crank still turns. It is waiting for a cylinder.'
    },
    ladder: {
      name: 'ladder',
      aliases: ['ladder', 'wooden ladder'],
      takeable: true,
      desc: 'A long wooden ladder is here.',
      examine: 'A long wooden ladder, grey with weather but sound. Long enough for a roof, if you were the kind of person who goes in through roofs.'
    },

    /* --- porch --- */
    doormat: {
      name: 'doormat',
      aliases: ['mat', 'doormat'],
      takeable: true,
      desc: 'A doormat lies here, inscribed with the word WELCOME.',
      examine: 'The W has worn almost entirely away. It now reads, philosophically: ELCOME.'
    },
    door: {
      name: 'iron-banded door',
      aliases: ['door', 'manor door', 'front door', 'manor', 'house'],
      takeable: false,
      desc: '',
      examine: 'A heavy oak door banded in iron, its handle worn smooth by centuries of hands. It swings inward freely, as if it has been waiting for you.',
      open: 'It creaks open, revealing the entrance hall beyond.'
    },

    /* --- hall --- */
    hatch: {
      name: 'cellar trapdoor',
      aliases: ['hatch', 'trapdoor', 'cellar door', 'cellar', 'floor'],
      takeable: false,
      container: true,
      open: false,
      locked: true,
      key: 'brassKey',
      desc: 'A heavy trapdoor is set into the floor, banded in iron, closed and locked.',
      examine: 'A trapdoor of thick oak, iron-banded, set flush in the floor. It is locked. You have a feeling the key is close by.',
      openText: 'You haul the trapdoor up. A wooden ladder descends into cool, breathing dark.',
      unlockText: 'The key turns in the lock with a sound like a held breath let out. The trapdoor is unlocked.'
    },
    chandelier: {
      name: 'chandelier',
      aliases: ['chandelier', 'crystal'],
      takeable: false,
      desc: 'Overhead, a chandelier slumps with a few last crystals clinging to it.',
      examine: 'A chandelier that has seen better centuries. It hangs crooked, its candles long dead. If it fell, it would be a magnificent, historic disaster.'
    },
    clock: {
      name: 'grandfather clock',
      aliases: ['clock', 'grandfather clock', 'grandfather'],
      takeable: false,
      container: true,
      open: false,
      contents: ['brassKey', 'musicSheet'],
      desc: '',
      examine: 'A towering clock, stopped at 9:41. There are little winding holes in its face. You can hear, very faintly, the idea of ticking — a habit the clock has not quite given up.',
      openText: 'The clock door swings open with a held-in sigh. Inside rests a brass key and a sheet of music, folded into thirds.'
    },
    brassKey: {
      name: 'brass key',
      aliases: ['brass key', 'key', 'clock key'],
      takeable: true,
      desc: '',
      examine: 'A key of polished brass, warm to the touch, as if the clock had been keeping it for you personally. It fits the cellar trapdoor, and knows it.'
    },
    musicSheet: {
      name: 'sheet of music',
      aliases: ['music', 'sheet', 'music sheet', 'song', 'score'],
      takeable: true,
      desc: '',
      examine: 'Sheet music, the ink faded to a confident brown. A lullaby, marked "for the King\'s sentinel, who remembers being human".',
      read: 'You study the music, humming bars under your breath. The melody is simple, and ancient, and yours now. (You know the lullaby of the Sunken King.)'
    },
    cabinet: {
      name: 'glass cabinet',
      aliases: ['cabinet', 'trophy cabinet', 'glass case', 'case'],
      takeable: false,
      container: true,
      open: true,
      contents: [],
      desc: 'A long glass cabinet gleams against the north wall, empty and expectant.',
      examine: 'A brass plaque reads: "FOR THE REGALIA OF THE SUNKEN HALLS". Inside, six velvet cushions wait on a shelf, each with a small nameplate: CROWN, SCEPTER, CHALICE, IDOL, RING, SUNSTONE.'
    },

    /* --- study --- */
    lyre: {
      name: 'silver lyre',
      aliases: ['lyre', 'harp'],
      takeable: true,
      desc: 'A silver lyre hangs above the cold hearth.',
      examine: 'A delicate lyre of tarnished silver. Its strings are out of tune — not loose enough to break, just loose enough to disappoint.',
      read: 'You pluck a string. It sounds like a cat falling downstairs.'
    },
    picture: {
      name: 'portrait',
      aliases: ['portrait', 'painting', 'picture', 'king'],
      takeable: false,
      desc: 'Above the hearth, a portrait of a stern king in a crown watches you.',
      examine: 'The portrait is of a king who has clearly just been told excellent news and is hiding it. A brass plate beneath reads: "I cannot have the last word, so I leave it to the halls."'
    },
    bookHistory: {
      name: 'book',
      aliases: ['book', 'tome', 'history', 'a history of the sunken kings', 'history of the sunken kings'],
      takeable: false,
      desc: 'On the shelves: "A History of the Sunken Kings", "On the Care of Musical Instruments", and a slim, worried-looking volume: "A Field Guide to Palace Security".',
      read: [
        'From "A History of the Sunken Kings":',
        '"...when the Halls sank, the court mage sealed the Cavern of Echoes behind doors of brass. They open, it is said, to the truest name of the cavern — a name spoken only by the cavern itself."'
      ]
    },
    bookMusic: {
      name: 'book on instruments',
      aliases: ['instruments', 'musical instruments', 'on the care of musical instruments'],
      takeable: false,
      desc: '',
      read: [
        'From "On the Care of Musical Instruments":',
        '"A lyre with loosened strings will still sing true if the player knows the tune by heart. The instrument remembers the hands that loved it."'
      ]
    },
    bookSecurity: {
      name: 'field guide',
      aliases: ['guide', 'security', 'field guide to palace security', 'palace security'],
      takeable: false,
      desc: '',
      read: [
        'From "A Field Guide to Palace Security" (the index is thumbed to "SENTINELS, SPECTRAL"):',
        '"The royal sentinel was a musician in life. No melody, no passage. Note: he keeps the Vault Key on his person at all times, and he is very proud of it."'
      ]
    },
    desk: {
      name: 'writing desk',
      aliases: ['desk', 'drawer'],
      takeable: false,
      container: true,
      open: true,
      contents: ['lens'],
      desc: 'A writing desk stands beneath the window, its drawer hanging open an inch.',
      examine: 'The drawer hangs open — empty, but for a brass-framed lens resting on a square of felt.'
    },
    lens: {
      name: 'brass-framed lens',
      aliases: ['lens', 'magnifier', 'magnifying glass', 'glass'],
      takeable: true,
      desc: '',
      examine: 'A fine magnifying lens in a brass frame. Everything becomes clearer. Some things, apparently, on purpose.'
    },

    /* --- kitchen --- */
    stove: {
      name: 'iron stove',
      aliases: ['stove', 'oven'],
      takeable: false,
      container: true,
      open: true,
      contents: [],
      desc: 'A black iron stove stands cold.',
      examine: 'Cold ash and the ghost of a smell of old pies. The pies are not in it anymore. The pie ghost, presumably, is.'
    },
    knife: {
      name: 'rusty knife',
      aliases: ['knife', 'blade', 'dagger'],
      takeable: true,
      desc: 'On the table rests a rusty knife.',
      examine: 'A knife that has seen better centuries, and said nothing about it. It is rusted, but it has a certain menace.'
    },
    loaf: {
      name: 'half-eaten loaf',
      aliases: ['loaf', 'bread'],
      takeable: true,
      desc: 'A half-eaten loaf of bread sits on the table, unfinished business.',
      examine: 'Bread, abandoned mid-sentence. It is stale, but it is bread, and it is on your side.',
      eat: 'You tear off a hunk. It is stale, it is dry, and it is, without question, the best meal you have had since you started adventuring.'
    },
    curtain: {
      name: 'moth-eaten curtain',
      aliases: ['curtain', 'cloth', 'rag', 'fabric'],
      takeable: true,
      desc: 'A moth-eaten curtain hangs by the window.',
      examine: 'A curtain the moths have been renovating for decades. There is enough cloth left to matter, if cloth ever matters.',
      takeText: 'You pull the curtain down with a puff of dust and a sigh of thread.'
    },
    pantry: {
      name: 'pantry',
      aliases: ['pantry', 'pantry door', 'cupboard'],
      takeable: false,
      container: true,
      open: true,
      contents: ['candle', 'flour'],
      desc: 'A pantry door stands ajar in the corner.',
      examine: 'A pantry of modest ambition. On its shelves: a stub of candle and a sack of flour, looking at each other the way old colleagues do.'
    },
    candle: {
      name: 'stub of candle',
      aliases: ['candle', 'stub', 'candle stub'],
      takeable: true,
      lightable: true,
      desc: '',
      examine: 'A candle stub, half melted by an older hope. It will burn, if you have a flame to give it.'
    },
    flour: {
      name: 'sack of flour',
      aliases: ['flour', 'sack', 'flour sack'],
      takeable: true,
      desc: '',
      examine: 'A sack of fine flour. In the dark, it would settle like snow. In a hall of mirrors, it could settle an argument.',
      throw: 'The flour bursts into a white cloud, then settles over everything in a slow, deliberate blizzard. You sneeze with great dignity.'
    },

    /* --- cellar --- */
    shelves: {
      name: 'shelves',
      aliases: ['shelves', 'shelf', 'jars'],
      takeable: false,
      container: true,
      open: true,
      contents: ['oilJar', 'pitchPot'],
      desc: 'Shelves line the walls, holding jars and a clay pot.',
      examine: 'Jars of things best not asked about, a jar of lamp oil, and a clay pot of pitch, tacky as a secret.'
    },
    oilJar: {
      name: 'jar of lamp oil',
      aliases: ['oil', 'lamp oil', 'oil jar', 'jar'],
      takeable: true,
      desc: '',
      examine: 'A jar of lamp oil, the colour of an old argument. The lantern would like this very much.',
      useText: 'You carefully top up the lantern. It was, as it turns out, fine — but it accepts the tribute with grace.'
    },
    pitchPot: {
      name: 'pot of pitch',
      aliases: ['pitch', 'tar', 'pot', 'pitch pot'],
      takeable: true,
      desc: '',
      examine: 'A clay pot of black pitch, still tacky after all these years. The perfect seal for a small hole in a boat.'
    },
    shovel: {
      name: 'shovel',
      aliases: ['shovel', 'spade'],
      takeable: true,
      desc: 'A shovel leans against the far wall.',
      examine: 'A sturdy shovel, the honest tool of dishonest people everywhere.'
    },
    crack: {
      name: 'crack in the wall',
      aliases: ['crack', 'wall', 'crack in the wall'],
      takeable: false,
      desc: 'In the north wall, a crack exhales a cold draft.',
      examine: 'The crack is wide enough for a fist, not for a treasure hunter. Cold air breathes out of it, patient as a held sigh.'
    },
    wineRack: {
      name: 'wine rack',
      aliases: ['wine rack', 'rack', 'wine', 'bottles'],
      takeable: false,
      container: true,
      open: true,
      contents: ['emptyBottle'],
      desc: 'A wine rack holds a row of empty bottles.',
      examine: 'A wine rack full of empty bottles. Each one is a small monument to a party that ended centuries ago.'
    },
    emptyBottle: {
      name: 'empty bottle',
      aliases: ['bottle', 'wine bottle'],
      takeable: true,
      desc: '',
      examine: 'An empty bottle. The label reads, in fading ink: "ASHCOMBE RED, 1752. Drink within a century." It was, by a wide margin, too late.',
      drink: 'You tilt the bottle. Nothing comes out, not even pride.'
    },

    /* --- underground --- */
    gates: {
      name: 'brass gates',
      aliases: ['gates', 'gate', 'brass doors', 'doors', 'doors of brass', 'statue', 'woman'],
      takeable: false,
      desc: '',
      examine: [
        'The twin brass doors are thirty feet tall and covered in a relief of a kingdom sinking slowly into a hill, which the brass depicts with a certain relish. ',
        'Before them, the statue of a woman, mouth open as if mid-word. At its base, an inscription:',
        '"I borrow every voice you give me, then return it from stone. I have no throat, but caves teach me to answer. What am I?"'
      ]
    },
    boat: {
      name: 'rotted rowboat',
      aliases: ['boat', 'rowboat', 'vessel'],
      takeable: false,
      desc: 'A rotted rowboat lies half on the shore, holed the size of a fist.',
      examine: 'A rowboat that has seen better floods. There is a hole in the hull the size of a fist, and a look on its face — boats have faces — that says "don\'t even think about it."',
      fixText: 'With the pitch and the curtain you patch the hole with the grim efficiency of someone who has done this before. The boat now looks merely resigned instead of doomed.'
    },
    sentinel: {
      name: 'spectral sentinel',
      aliases: ['sentinel', 'guard', 'ghost', 'spectre', 'soldier'],
      takeable: false,
      desc: 'A spectral sentinel in tarnished plate stands before the south door, humming an old tune to itself. On its belt hangs a heavy iron key.',
      examine: 'A translucent knight in armour that has rusted in exactly the places ghosts rust. It hums — something with a tune you almost recognize. On its belt, an iron key, worn smooth by centuries of pride.'
    },
    vaultKey: {
      name: 'iron vault key',
      aliases: ['vault key', 'key', 'iron key'],
      takeable: true,
      desc: '',
      examine: 'A heavy iron key, worn smooth. It opens the vault door, which is what keys are for, really.'
    },
    vaultDoor: {
      name: 'steel door',
      aliases: ['steel door', 'vault door', 'vault'],
      takeable: false,
      container: true,
      open: false,
      locked: true,
      key: 'vaultKey',
      desc: '',
      examine: 'A steel door, bolted and rusted, stamped: VAULT — DO NOT DISTURB. It is locked.'
    },

    /* --- throne room --- */
    throne: {
      name: 'throne of black stone',
      aliases: ['throne', 'skeleton', 'king', 'sunken king'],
      takeable: false,
      desc: 'On the throne sits the skeleton of the Sunken King, in moth-eaten robes, patient as arithmetic.',
      examine: 'The skeleton of the Sunken King, tidied up for eternity. In his ribcage, a small note on vellum, in a hand that shakes: "buried with my ring, but I was buried with a better story. Tell it."'
    },
    crown: {
      name: "Enchanter's Crown",
      aliases: ['crown', "enchanter's crown", 'enchanters crown'],
      takeable: true,
      treasure: true,
      desc: 'On a velvet cushion rests the Enchanter\'s Crown, dusty and entirely unguarded.',
      examine: 'A circlet of dark gold set with stones that seem to be trying to remember being stars. It weighs nothing at all, which is suspicious.',
      takeText: 'You lift the Enchanter\'s Crown. A sigh passes through the hall, as if the King approves of being robbed at last.'
    },

    /* --- tomb --- */
    sarcophagus: {
      name: 'marble sarcophagus',
      aliases: ['sarcophagus', 'coffin', 'tomb'],
      takeable: false,
      container: true,
      open: false,
      contents: ['ring'],
      desc: 'In the centre of the chamber, a sarcophagus of pale marble, carved with a king who looks considerably less tired than his skeleton.',
      examine: 'A heavy marble sarcophagus. The lid is carved with a king at rest, holding a ring to his chest. The lid looks pushable, if you were the pushing type.'
    },
    ring: {
      name: "King's signet ring",
      aliases: ['ring', 'signet', 'signet ring', 'kings ring'],
      takeable: true,
      treasure: true,
      desc: '',
      examine: 'A heavy gold signet ring, stamped with a crown sinking into a hill. It has been waiting a thousand years for a finger to fit, and it fits you perfectly, which is its way of claiming you.'
    },

    /* --- vault --- */
    scepter: {
      name: 'jade scepter',
      aliases: ['scepter', 'jade scepter', 'staff'],
      takeable: true,
      treasure: true,
      desc: 'Upon a pedestal rests a jade scepter, carved with snakes biting their own tails.',
      examine: 'A scepter of carved jade, green as a deep-held secret. The snakes biting their own tails look extremely satisfied with the arrangement.'
    },

    /* --- mirror hall --- */
    mirror: {
      name: 'mirrors',
      aliases: ['mirror', 'mirrors', 'wall mirror'],
      takeable: false,
      desc: '',
      examine: 'The west mirror is the odd one: it does not quite reflect the torchlight, and its edge catches the air a half-inch off the wall. It is a door pretending to be a mirror, which is the second-oldest profession.'
    },
    idol: {
      name: 'opal idol',
      aliases: ['idol', 'opal', 'opal idol', 'statue'],
      takeable: true,
      treasure: true,
      desc: 'On a brass altar, the Opal Idol glows with its own internal weather.',
      examine: 'An idol of dark stone, its heart a great opal with storms the size of coins turning over inside it. It has waited a long time for someone worth the wait. You are, by default, that someone.'
    },

    /* --- lake --- */
    plinth: {
      name: 'stone plinth',
      aliases: ['plinth', 'island', 'islet'],
      takeable: false,
      desc: '',
      examine: 'A stone plinth, weathered into smoothness, upon which rests a gilded chalice.'
    },
    chalice: {
      name: 'gilded chalice',
      aliases: ['chalice', 'cup', 'goblet'],
      takeable: true,
      treasure: true,
      desc: 'On the stone plinth rests a gilded chalice, dusty and unhurried.',
      examine: 'A chalice of gilded bronze, dusty as a cathedral hymn book. It is the sort of cup that makes you want to toast something important. You are, by default, important.'
    },

    /* --- well --- */
    sunstone: {
      name: 'sunstone',
      aliases: ['sunstone', 'stone', 'glowing stone'],
      takeable: true,
      treasure: true,
      light: true,
      desc: 'Among the leaves lies a sunstone, glowing with warm honey light.',
      examine: 'A smooth stone glowing from within, warm as a summer memory. It lights the dark without burning — the only king that kept its word.'
    }
  };

  Z.world = {
    title: 'THE SUNKEN CROWN',
    startRoom: 'yard',
    startInventory: ['lantern', 'note'],
    rooms,
    objects,
    treasures: ['crown', 'scepter', 'chalice', 'idol', 'ring', 'sunstone'],
    treasureNames: {
      crown: 'Enchanter\'s Crown',
      scepter: 'Jade Scepter',
      chalice: 'Gilded Chalice',
      idol: 'Opal Idol',
      ring: 'King\'s Signet Ring',
      sunstone: 'Sunstone'
    },
    ranks: [
      [0, 'Wandering Stranger'],
      [10, 'Curious Visitor'],
      [20, 'Adventurer'],
      [30, 'Treasure-Seeker'],
      [40, 'Scourge of Ashcombe'],
      [50, 'Keeper of the Halls'],
      [60, 'Sunken King\'s Heir']
    ]
  };

  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
