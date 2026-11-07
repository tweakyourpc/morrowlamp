/* ============================================================
   MORROWLAMP GAME CARTRIDGE
   LAB SUPPORT: THE LAST LOGIN

   A small help-desk adventure set during an evening shift in the
   computer labs of Ringling College. The campus details are playful
   fiction; the ticket queue, printer jam and network closet are not.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};

  const cartridge = {
    format: 'morrowlamp-cartridge',
    formatVersion: 2,
    meta: {
      id: 'ringling-helpdesk',
      title: 'LAB SUPPORT: THE LAST LOGIN',
      author: 'Morrowlamp Software',
      copyright: 'A fictional help-desk adventure made for the computer labs of Ringling College.',
      version: '1.0.0',
      blurb: 'Three tickets. One critique in twenty minutes. The lab must not know fear.'
    },

    intro: [
      'It is 6:40 p.m. in the computer labs at Ringling College.',
      'The evening help-desk shift is yours, the coffee is technically warm, and the critique begins in twenty minutes.',
      'Three tickets are waiting: one workstation cannot log in, one printer has swallowed a page, and one lab has lost the network.',
      'Fix the queue, bring the ticket back to the desk, and try not to become part of the incident report.'
    ],
    help: [
      'Move with compass directions. Look at things, examine them, and take what you need.',
      'Use one thing on another with "use X on Y".',
      'Fix the workstation, printer and network switch, then submit the ticket at the Help Desk.'
    ],
    quitText: 'You close the ticket as "pending" and leave the lab lights humming behind you. Tomorrow is another queue.',
    startFlags: { loginFixed: false, printerFixed: false, networkFixed: false },

    world: {
      startRoom: 'helpDesk',
      startInventory: [],
      rooms: {
        helpDesk: {
          name: 'Help Desk',
          desc: 'The help desk sits between the humming lab doors and a corkboard covered in stickers, deadlines and one ancient note reading PLEASE RESTART FIRST. A ticket folder, a diagnostic USB drive and the lab phone wait on the counter.',
          short: 'The Help Desk. The queue is watching you.',
          exits: { n: 'labA', e: 'printStudio', w: 'networkCloset', s: 'studentLounge' }
        },
        labA: {
          name: 'Lab A — Workstations',
          desc: 'Rows of monitors glow in the dark like a cautious constellation. One workstation shows a login screen that has forgotten the password and is pretending this is your problem.',
          short: 'Lab A. One workstation is locked out.',
          exits: { s: 'helpDesk' }
        },
        printStudio: {
          name: 'Print Studio',
          desc: 'The large-format printer has stopped halfway through a poster and is making the small, proud clicking noise of a machine that knows it has trapped you.',
          short: 'The Print Studio. The printer has a page in its teeth.',
          exits: { w: 'helpDesk' }
        },
        networkCloset: {
          name: 'Network Closet',
          desc: 'A narrow closet full of blinking switches, labelled cables and the warm breath of equipment doing its best. A loose network cable lies beside the spare-parts shelf.',
          short: 'The Network Closet. The switch has an empty port.',
          exits: { e: 'helpDesk' }
        },
        studentLounge: {
          name: 'Student Lounge',
          desc: 'A sofa, a whiteboard full of thumbnail sketches and a vending machine that accepts payment only in exact change. It is not on your ticket route, but it has excellent acoustics for sighing.',
          short: 'The Student Lounge. Nobody here has filed a ticket, yet.',
          exits: { n: 'helpDesk' }
        }
      },
      objects: {
        ticket: {
          name: 'support ticket', aliases: ['ticket', 'tickets', 'queue'], at: 'helpDesk', takeable: true,
          desc: 'A yellow support ticket marked CRITIQUE DEADLINE: 7:00 PM.',
          examine: 'The ticket lists three requests: restore a workstation login, clear a printer jam, and reconnect Lab B to the network. At the bottom someone wrote: PLEASE DO NOT CLOSE THIS AS USER ERROR.',
          read: 'Ticket 1842: workstation login, printer jam, network drop. Priority: everything. Requester: a student who has already tried turning it off and on again.'
        },
        usb: {
          name: 'diagnostic USB drive', aliases: ['usb', 'drive', 'diagnostic drive'], at: 'helpDesk', takeable: true,
          desc: 'A labelled diagnostic USB drive sits beside the lab phone.',
          examine: 'A tiny drive with a large label: BOOT TOOLS — DO NOT LOSE. The label has been rewritten twice.'
        },
        workstation: {
          name: 'locked workstation', aliases: ['workstation', 'computer', 'terminal', 'pc'], at: 'labA',
          desc: 'A workstation waits at the end of the row, displaying a login prompt with the confidence of a locked door.',
          examine: 'The account is locked after too many attempts. The diagnostic drive can boot a repair environment.'
        },
        printer: {
          name: 'large-format printer', aliases: ['printer', 'plotter'], at: 'printStudio',
          desc: 'The large-format printer grips a poster halfway through a very important gradient.',
          examine: 'The paper path is jammed. A little access door is marked OPEN ONLY WHEN CALM.'
        },
        paper: {
          name: 'jammed paper', aliases: ['paper', 'page', 'poster'], at: 'printStudio', takeable: true,
          desc: 'A loose sheet of poster paper sticks out from the printer tray.',
          examine: 'It is the corner of a poster about an exhibition opening. The printer has improved its composition by tearing it.'
        },
        switch: {
          name: 'network switch', aliases: ['switch', 'network', 'hub'], at: 'networkCloset',
          desc: 'A network switch blinks with one dark port.',
          examine: 'Port 12 is empty. A hand-written label says LAB B, PLEASE BE GENTLE.'
        },
        cable: {
          name: 'patch cable', aliases: ['cable', 'ethernet cable', 'ethernet'], at: 'networkCloset', takeable: true,
          desc: 'A blue patch cable lies coiled beside the spare-parts shelf.',
          examine: 'A perfectly ordinary cable, which makes it the most trustworthy object in the closet.'
        }
      }
    },

    vocabulary: {
      verbs: {
        submit: { words: ['submit', 'close', 'resolve'], form: 'target', prompt: 'Submit what?', fallback: 'That ticket is not ready to close.' },
        reboot: { words: ['reboot', 'reset'], form: 'target', prompt: 'Restart what?', fallback: 'You restart it. It remains exactly as broken.' },
        plug: { words: ['plug', 'connect'], form: 'target', seps: ['into', 'in', 'to'], prompt: 'Plug what into what?', fallback: 'You connect it. Nothing useful happens.' }
      }
    },

    rules: [
      {
        id: 'repair-workstation', verb: ['use', 'reboot'], target: ['usb', 'workstation'], with: ['usb', 'workstation'],
        when: { room: 'labA', carrying: ['usb'], flags: { loginFixed: false } },
        do: [
          { set: 'loginFixed' }, { destroy: 'usb' },
          { say: 'You boot the diagnostic environment, clear the lockout and restart the workstation. The login screen returns, humbled but functional.' },
          { sound: 'chime' }
        ]
      },
      {
        id: 'workstation-needs-drive', reach: 'anywhere', verb: ['use', 'reboot'], target: 'workstation',
        when: { room: 'labA', flags: { loginFixed: false } },
        do: [{ say: 'The workstation is locked out. You need the diagnostic drive from the Help Desk.' }]
      },
      {
        id: 'clear-printer', verb: ['use', 'take'], target: ['paper', 'printer'], with: ['paper', 'printer'],
        when: { room: 'printStudio', carrying: ['paper'], flags: { printerFixed: false } },
        do: [
          { set: 'printerFixed' }, { destroy: 'paper' },
          { say: 'You ease the jammed sheet free, close the access door and press resume. The printer finishes the gradient without further drama.' },
          { sound: 'chime' }
        ]
      },
      {
        id: 'printer-needs-paper', verb: ['use', 'open', 'take'], target: 'printer',
        when: { room: 'printStudio', flags: { printerFixed: false } },
        do: [{ say: 'The printer is jammed. The loose paper is the part you can safely remove.' }]
      },
      {
        id: 'connect-network', verb: ['use', 'plug'], target: ['cable', 'switch'], with: ['cable', 'switch'],
        when: { room: 'networkCloset', carrying: ['cable'], flags: { networkFixed: false } },
        do: [
          { set: 'networkFixed' }, { destroy: 'cable' },
          { say: 'You click the patch cable into port 12. The switch blinks once, then Lab B comes back online across the building.' },
          { sound: 'chime' }
        ]
      },
      {
        id: 'switch-needs-cable', verb: ['use', 'plug', 'examine'], target: 'switch',
        when: { room: 'networkCloset', flags: { networkFixed: false } },
        do: [{ say: 'Port 12 is empty. The switch needs a patch cable.' }]
      },
      {
        id: 'submit-complete-ticket', verb: ['submit', 'close'], target: 'ticket',
        when: { room: 'helpDesk', carrying: ['ticket'], flags: { loginFixed: true, printerFixed: true, networkFixed: true } },
        do: [
          { say: 'You mark ticket 1842 RESOLVED, add three short explanations and one long apology to the printer, and send it back into the queue.' },
          { end: 'shift-complete' }
        ]
      },
      {
        id: 'submit-incomplete-ticket', verb: ['submit', 'close'], target: 'ticket',
        when: { room: 'helpDesk', carrying: ['ticket'] },
        do: [{ say: 'The ticket is not ready to close. The queue still has work in it, and the queue has excellent peripheral vision.' }]
      }
    ],

    profile: {
      turns: true,
      score: { ranks: [[0, 'On Hold'], [10, 'First Response'], [20, 'Lab Saver'], [30, 'Queue Whisperer']] },
      treasures: false,
      darkness: false
    },

    endings: [{
      id: 'shift-complete', kind: 'win',
      when: { flags: { loginFixed: true, printerFixed: true, networkFixed: true } },
      score: 30,
      text: [
        'The queue clears. For one shining minute, every workstation, printer and network port in the labs agrees to behave.',
        'A new ticket arrives: "The mouse is weird." You take a sip of coffee and open it.',
        'SHIFT COMPLETE. The lab lights stay on, which is the closest thing to a standing ovation.'
      ]
    }],

    walkthrough: {
      route: [
        'take ticket', 'take usb', 'n', 'use usb on workstation', 's',
        'e', 'take paper', 'use paper on printer', 'w',
        'w', 'take cable', 'use cable on switch', 'e', 'submit ticket'
      ],
      ending: 'shift-complete', score: 30
    },

    presentation: {
      renderer: 'ega', audio: 'speaker', interface: 'canvas',
      title: {
        enabled: true,
        heading: 'LAB SUPPORT: THE LAST LOGIN',
        subtitle: 'Ringling College Computer Labs · Evening Shift',
        prompt: 'START SUPPORT SHIFT',
        showClasses: false,
        showSplash: true
      },
      art: { scene: {
        helpDesk: {
          environment: 'wood_room', perspective: 'interior',
          features: [{ type: 'table', position: 'center', style: 'wood' }]
        },
        labA: {
          environment: 'wood_room', perspective: 'interior',
          features: [{ type: 'table', position: 'center', style: 'iron', object: 'workstation' }]
        },
        printStudio: {
          environment: 'wood_room', perspective: 'interior',
          features: [{ type: 'table', position: 'right_wall', style: 'iron', object: 'printer' }]
        },
        networkCloset: {
          environment: 'stone_chamber', perspective: 'corridor',
          features: [{ type: 'table', position: 'left_wall', style: 'iron', object: 'switch' }]
        },
        studentLounge: {
          environment: 'wood_room', perspective: 'interior',
          features: [{ type: 'table', position: 'center', style: 'wood' }]
        }
      } }
    }
  };

  Z.cartridges = Z.cartridges || {};
  Z.cartridges['ringling-helpdesk'] = cartridge;
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
