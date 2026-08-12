/* ============================================================
   THE SUNKEN CROWN — game engine
   World state, actions, darkness, scoring, win/lose conditions.
   Pure logic: no DOM access, so it can run under Node for tests.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const world = Z.world;

  const UNDO_DEPTH = 20;
  const INTRO = [
    'Ashcombe, a manor that has been ignoring the weather for three hundred years, is yours now.',
    'The deed was pinned to your grandmother\'s wall for forty years, and she had one instruction:',
    '"Go when the mist comes. Look where the light lies, sing to the soldiers, and mind the echoes — they keep the King\'s last word."',
    'The mist has come.',
    'The halls of the Sunken King are below, and somewhere in the dark, six treasures are keeping his story.'
  ];

  function freshState() {
    return {
      room: world.startRoom,
      inv: world.startInventory.slice(),
      score: 0,
      turns: 0,
      darkWarning: false,
      dead: false,
      won: false,
      visited: {},
      flags: {},
      obj: {},       // objId -> {open, locked, lit, patched}
      contents: {},  // containerId -> [objId]
      loose: {},     // roomId -> [objId] dropped there (so drops survive)
      treasuresPlaced: [],
      prev: []       // undo snapshots
    };
  }

  const engine = (function () {
    let S = freshState();
    // When true, the presentation layer owns the darkness encounter (the
    // graphical build turns the Umbra into a fight instead of a flat death).
    let externalDark = false;
    function reset() { S = freshState(); S.visited[S.room] = true; }

    /* ---------------- helpers ---------------- */

    const obj = (id) => world.objects[id];
    const room = () => world.rooms[S.room];

    // Which room each object starts in. Undefined = lives inside a container.
    // (Kept here rather than in world.js so the world file stays pure data.)
    const HOME = {
      lantern: 'inv', note: 'inv',
      mailbox: 'yard', well: ['yard', 'wellBottom'],
      doormat: 'porch', door: 'porch',
      hatch: 'hall', chandelier: 'hall', clock: 'hall', cabinet: 'hall',
      lyre: 'study', picture: 'study', bookHistory: 'study', bookMusic: 'study',
      bookSecurity: 'study', desk: 'study',
      stove: 'kitchen', knife: 'kitchen', loaf: 'kitchen', curtain: 'kitchen', pantry: 'kitchen',
      shelves: 'cellar', shovel: 'cellar', crack: 'cellar', wineRack: 'cellar',
      gates: 'caveMouth', boat: 'lakeShore', sentinel: 'guardroom', vaultKey: 'guardroom',
      vaultDoor: 'guardroom',
      throne: 'throne', crown: 'throne', sarcophagus: 'tomb', scepter: 'vault',
      mirror: 'mirrorHall', idol: 'mirrorSanctum', plinth: 'lakeIslet', chalice: 'lakeIslet',
      sunstone: 'wellBottom'
    };

    // Is an object loose (not in a container, not carried) in the current room?
    function looseHere(id) {
      const home = HOME[id];
      const inHome = home === undefined ? false
        : (Array.isArray(home) ? home : [home]).includes(S.room);
      if (inHome) return true;
      const dropped = S.loose[S.room];
      return !!dropped && dropped.includes(id);
    }

    function st(id, key, dflt) {
      const o = S.obj[id];
      return o && key in o ? o[key] : dflt;
    }
    function setSt(id, key, val) {
      (S.obj[id] = S.obj[id] || {})[key] = val;
    }
    function contentsOf(id) {
      if (!(id in S.contents)) {
        S.contents[id] = (obj(id).contents || []).slice();
      }
      return S.contents[id];
    }
    function isOpen(id) { return st(id, 'open', obj(id).open) === true; }
    function isLocked(id) { return st(id, 'locked', obj(id).locked) === true; }

    // Where is an item? 'inv' | <containerId> | null (null = loose in the room)
    function location(id) {
      if (S.inv.includes(id)) return 'inv';
      // containers whose contents have been materialized (opened / used)
      for (const cid of Object.keys(S.contents)) {
        if (S.contents[cid].includes(id)) return cid;
      }
      // containers we have never touched yet — read from static world data
      for (const oid in world.objects) {
        const o = world.objects[oid];
        if (!o.container) continue;
        if (oid in S.contents) continue; // already checked above
        if ((o.contents || []).includes(id)) return oid;
      }
      return null;
    }

    // Items the player can see or reach in the current room:
    // loose in the room, or inside an open container that is itself in the room.
    function itemsInRoom() {
      const out = [];
      for (const oid in world.objects) {
        if (S.inv.includes(oid)) continue;
        const loc = location(oid);
        if (loc === null) { if (looseHere(oid)) out.push(oid); continue; }
        if (looseHere(loc) && isOpen(loc)) out.push(oid);
      }
      return out;
    }

    function hasLight() {
      if (!room().dark) return true;
      const candidates = S.inv.concat(itemsInRoom());
      for (const id of candidates) {
        const o = obj(id);
        if (!o) continue;
        if (o.light === true && st(id, 'lit', o.lit) !== false) return true;
        if (o.lightable === true && st(id, 'lit', false) === true) return true;
      }
      return false;
    }

    const out = [];
    function msg(text, cls) {
      if (Array.isArray(text)) { text.forEach(t => msg(t, cls)); return; }
      out.push({ text: String(text), cls: cls || '' });
    }
    function scoreDelta(n) { S.score += n; }

    function rank() {
      const r = world.ranks;
      for (let i = r.length - 1; i >= 0; i--) {
        if (S.score >= r[i][0]) return r[i][1];
      }
      return r[0][1];
    }

    function has(id) { return S.inv.includes(id); }

    /* ---------------- room description ---------------- */

    function describeRoom(rid, full) {
      const r = world.rooms[rid];
      const lines = [];
      lines.push({ text: r.name, cls: 'room-name' });

      if (r.dark && !hasLight()) {
        lines.push({ text: 'It is pitch black! You are likely to be eaten by an Umbra.', cls: 'bad' });
      } else {
        if (full || !S.visited[rid]) {
          lines.push({ text: r.desc, cls: '' });
        } else {
          lines.push({ text: r.short, cls: 'dim' });
        }
      }

      // dynamic flag notes
      if (rid === 'caveMouth' && S.flags.gatesOpen) lines.push({ text: 'The brass gates stand open to the south.', cls: 'dim' });
      if (rid === 'cellar' && S.flags.tunnelDug) lines.push({ text: 'A passage now gapes in the north wall (south).', cls: 'dim' });
      if (rid === 'guardroom' && S.flags.guardDancing) lines.push({ text: 'The sentinel dances down the passage, off duty at last.', cls: 'dim' });
      if (rid === 'mirrorHall' && S.flags.mirrorOpened) lines.push({ text: 'The west mirror stands open, a dark doorway beyond.', cls: 'dim' });
      if (rid === 'lakeShore' && S.flags.boatPatched) lines.push({ text: 'The patched boat floats at the water\'s edge, ready.', cls: 'dim' });

      // presence lines
      const pres = itemsInRoom().sort();
      for (const id of pres) {
        const o = obj(id);
        if (o.desc) lines.push({ text: o.desc, cls: 'dim' });
        if (o.container && isOpen(id) && contentsOf(id).length) {
          const names = contentsOf(id).map(cid => obj(cid).name);
          lines.push({ text: 'It contains: ' + names.join(', ') + '.', cls: 'dim' });
        }
      }
      return lines;
    }

    function changeRoom(rid) {
      S.room = rid;
      const full = !S.visited[rid];
      S.visited[rid] = true;
      return describeRoom(rid, full);
    }

    /* ---------------- undo ---------------- */

    function snapshot() {
      return JSON.stringify({
        room: S.room, inv: S.inv, score: S.score, turns: S.turns,
        darkWarning: S.darkWarning, dead: S.dead, won: S.won,
        visited: S.visited, flags: S.flags, obj: S.obj,
        contents: S.contents, loose: S.loose, treasuresPlaced: S.treasuresPlaced
      });
    }
    function pushUndo() {
      S.prev.push(snapshot());
      if (S.prev.length > UNDO_DEPTH) S.prev.shift();
    }
    function doUndo() {
      const snap = S.prev.pop();
      if (!snap) return false;
      S = Object.assign(S, JSON.parse(snap));
      return true;
    }

    /* ---------------- death & win ---------------- */

    function die(lines) {
      msg(lines);
      msg('You are dead. You have been — there is no gentle way to put this — un-adventured.', 'bad');
      S.dead = true;
      S.darkWarning = false;
    }

    function checkWin() {
      if (!S.won && S.treasuresPlaced.length === world.treasures.length) {
        S.won = true;
        msg([
          'You place the last treasure on its velvet cushion, and the cabinet — full at last — blazes with a light that has been waiting for this exact moment.',
          'The Sunken King\'s regalia is complete. His story is told; yours has just begun.',
          '✦ You have won the game: SCORE ' + S.score + ' — ' + rank() + ' ✦'
        ], 'good');
        return true;
      }
      return false;
    }

    /* ---------------- the verbs ---------------- */

    function vLook() {
      return describeRoom(S.room, true);
    }

    function vExamine(target, withId) {
      if (!target) return describeRoom(S.room, true);
      const o = obj(target);
      if (!o) return null;

      // lens + note/map combo
      if (withId === 'lens' && (target === 'note')) {
        S.flags.lensSecret = true;
        return [{ text: 'You hold the lens over the note. Between the lines, in a hand you know: "the King\'s last word is the name of his cavern. Say it, and mind the mirror that shows no reflection."', cls: 'info' }];
      }

      if (target === 'cabinet') {
        const lines = ['A brass plaque reads: "FOR THE REGALIA OF THE SUNKEN HALLS".', ''];
        for (const t of world.treasures) {
          const filled = S.treasuresPlaced.includes(t);
          lines.push((filled ? '✦ ' : '· ') + world.treasureNames[t].toUpperCase() + (filled ? ' — filled' : ' — awaiting'));
        }
        lines.push('', 'The cabinet has ' + (6 - S.treasuresPlaced.length) + ' cushion' + (6 - S.treasuresPlaced.length === 1 ? '' : 's') + ' still waiting.');
        return lines.map(t => ({ text: t, cls: 'dim' }));
      }

      if (o.examine) return [{ text: o.examine, cls: '' }];
      return [{ text: 'You see nothing special about the ' + o.name + '.', cls: 'dim' }];
    }

    function vTake(target, fromId) {
      const o = obj(target);
      if (!o) return null;
      if (!o.takeable) {
        // a few flavor responses for famous untakeable things
        if (target === 'sentinel') return 'You reach for the sentinel. Your hand passes through it. It does not notice, or does not care.';
        if (target === 'gates') return 'You try to take the brass gates. The brass gates decline, with thirty feet of gravity.';
        if (target === 'throne') return 'You try to take the throne. The skeleton of the King watches you with no eyes. You stop trying.';
        if (target === 'sarcophagus') return 'You could take the sarcophagus, technically. You decide the King has been moved around enough.';
        if (target === 'well') return 'You cannot take the well. The well is very much taken with itself.';
        return 'You can\'t take that.';
      }

      // sentinel's key needs the guard distracted
      if (target === 'vaultKey' && S.room === 'guardroom' && !S.flags.guardDancing) {
        return 'The sentinel\'s hand closes over the key without looking at you. "HALT. That is part of my uniform, and I am wearing it."';
      }

      const loc = location(target);

      if (fromId) {
        const f = obj(fromId);
        if (fromId === 'sentinel') {
          if (S.room !== 'guardroom') return 'You don\'t see that here.';
          if (!S.flags.guardDancing) return 'The sentinel\'s hand closes over the key without looking at you. "HALT. That is part of my uniform, and I am wearing it."';
          if (target !== 'vaultKey') return 'The sentinel is not carrying anything else. It is a ghost with a belt, not a warehouse.';
        } else {
          if (!f || !f.container) return 'That is not something you can take it from.';
          if (!(looseHere(fromId) || has(fromId))) return 'You don\'t see that here.';
          if (!isOpen(fromId)) return 'It is closed.';
          if (!contentsOf(fromId).includes(target)) return 'It isn\'t in there.';
          contentsOf(fromId).splice(contentsOf(fromId).indexOf(target), 1);
        }
      } else if (loc === 'inv') {
        return 'You already have it.';
      } else if (loc === null) {
        // loose in the room — fine
      } else if (typeof loc === 'string' && loc !== S.room) {
        // inside a container — the container must be here (loose or carried) and open
        if (!(looseHere(loc) || has(loc))) return 'You don\'t see that here.';
        if (!isOpen(loc)) return 'It is closed.';
        contentsOf(loc).splice(contentsOf(loc).indexOf(target), 1);
      } else {
        return 'You don\'t see that here.';
      }

      S.inv.push(target);
      const lines = [];
      if (o.takeText) lines.push(o.takeText);
      else lines.push('Taken.');
      if (o.treasure && !S.flags['treasureTaken_' + target]) {
        S.flags['treasureTaken_' + target] = true;
        scoreDelta(5);
        lines.push({ text: 'Scored 5 points (treasure found).', cls: 'scored' });
      }
      return lines;
    }

    function vDrop(target) {
      if (!has(target)) return 'You don\'t have that.';
      S.inv.splice(S.inv.indexOf(target), 1);
      // put back into its home container if it has one and the container is in this room
      const home = Object.keys(world.objects).find(oid => {
        const o = world.objects[oid];
        return o.container && (o.contents || []).includes(target);
      });
      if (home && looseHere(home) && isOpen(home)) {
        contentsOf(home).push(target);
        return 'You put the ' + obj(target).name + ' back where it belongs.';
      }
      (S.loose[S.room] = S.loose[S.room] || []).push(target);
      if (obj(target).treasure) return 'You put down the ' + obj(target).name + '. It watches you go.';
      return 'Dropped.';
    }

    function vInventory() {
      if (!S.inv.length) return [{ text: 'You are carrying nothing — a very light sentence.', cls: 'dim' }];
      const names = S.inv.map(id => obj(id).name);
      return [{ text: 'You are carrying:\n  ' + names.join('\n  '), cls: '' }];
    }

    function vOpen(target) {
      const o = obj(target);
      if (!o) return null;
      if (target === 'sarcophagus') return openSarcophagus();
      if (!o.container) {
        if (target === 'door') return o.openText || 'It creaks open.';
        if (target === 'gates') return 'You push at the brass gates. They do not budge. They do not seem to need to. Perhaps they are waiting for a word.';
        return 'You can\'t open that.';
      }
      if (isOpen(target)) return 'It is already open.';
      if (isLocked(target)) return 'It is locked.';
      setSt(target, 'open', true);
      const lines = [];
      if (o.openText) lines.push(o.openText);
      else lines.push('You open the ' + o.name + '.');
      const c = contentsOf(target);
      if (c.length) lines.push('Inside: ' + c.map(id => obj(id).name).join(', ') + '.');
      else lines.push('It is empty.');
      return lines;
    }

    function vClose(target) {
      const o = obj(target);
      if (!o || !o.container) return 'You can\'t close that.';
      if (!isOpen(target)) return 'It is already closed.';
      setSt(target, 'open', false);
      return 'You close the ' + o.name + '.';
    }

    function vUnlock(target, keyId) {
      const o = obj(target);
      if (!o || !o.container) return 'You can\'t unlock that.';
      if (!o.locked && !isLocked(target)) return 'It is already unlocked.';
      if (!keyId) return 'Unlock it with what?';
      const k = obj(keyId);
      if (!has(keyId) && !looseHere(keyId)) {
        return 'You don\'t have the ' + (k ? k.name : 'key') + '.';
      }
      if (o.key !== keyId) {
        return 'The ' + (k ? k.name : 'thing') + ' does not fit.';
      }
      setSt(target, 'locked', false);
      const lines = [];
      if (o.unlockText) lines.push(o.unlockText);
      else lines.push('The lock turns. It has been a long time since the lock turned.');
      return lines;
    }

    function vPut(target, containerId) {
      const c = obj(containerId);
      if (!c || !c.container) return 'You can\'t put things in that.';
      if (!(looseHere(containerId) || has(containerId))) return 'You don\'t see that here.';
      if (!has(target)) return 'You don\'t have that.';
      if (containerId === 'cabinet') {
        if (world.treasures.includes(target)) {
          if (S.treasuresPlaced.includes(target)) return 'The ' + obj(target).name + ' is already on its cushion.';
          S.inv.splice(S.inv.indexOf(target), 1);
          S.treasuresPlaced.push(target);
          scoreDelta(5);
          const lines = [];
          lines.push('You place the ' + obj(target).name + ' on its velvet cushion. The cabinet accepts it with a satisfied click.');
          lines.push({ text: 'Scored 5 points (treasure secured).', cls: 'scored' });
          // handleAction runs checkWin after these lines are emitted, so the
          // victory text lands last instead of jumping ahead of the placement
          return lines;
        }
        return 'The cabinet is reserved for the Regalia of the Sunken Halls. It accepts the ' + obj(target).name + ' with a look of deep disappointment, and gives it back.';
      }
      if (!isOpen(containerId)) return 'It is closed.';
      if (c === obj(target)) return 'You cannot put a thing inside itself. The universe has rules.';
      S.inv.splice(S.inv.indexOf(target), 1);
      contentsOf(containerId).push(target);
      return 'You put the ' + obj(target).name + ' in the ' + c.name + '.';
    }

    function vRead(target) {
      if (!target) return 'Read what?';
      const o = obj(target);
      if (!o) return null;
      if (target === 'musicSheet') {
        S.flags.melodyKnown = true;
        return [o.read, { text: '(You now know the lullaby of the Sunken King.)', cls: 'good' }];
      }
      if (o.read) return o.read;
      if (o.examine) return 'You can\'t read that, but you can examine it: ' + o.examine;
      return 'You can\'t read that.';
    }

    function vLight(target) {
      const o = obj(target);
      if (!o) return null;
      if (!target) return 'Light what?';
      if (target === 'candle') {
        if (st('candle', 'lit', false)) return 'The candle is already lit.';
        const flame = has('lantern') && st('lantern', 'lit', true) ||
                      location('lantern') === S.room && st('lantern', 'lit', true);
        if (!flame) return 'You have nothing to light it with. (The lantern, perhaps?)';
        setSt('candle', 'lit', true);
        return 'The candle catches. A small, stubborn star, refusing to go out.';
      }
      if (target === 'lantern') {
        setSt('lantern', 'lit', true);
        return 'The lantern burns bright again.';
      }
      if (o.lightable) {
        setSt(target, 'lit', true);
        return 'You light the ' + o.name + '.';
      }
      return 'You cannot light that.';
    }

    function vTurn(target, mode) {
      const o = obj(target);
      if (!o) return null;
      if (target === 'lantern' || (o.lightable || o.light)) {
        if (mode === 'off') {
          if (!st(target, 'lit', o.lit)) return 'It is not lit.';
          setSt(target, 'lit', false);
          return 'You extinguish the ' + o.name + '. The dark leans in, curious.';
        }
        if (mode === 'on') {
          setSt(target, 'lit', true);
          return 'You light the ' + o.name + '.';
        }
      }
      if (target === 'clock') return 'You cannot turn the clock. It stopped itself, and it has principles.';
      return 'You can\'t turn that on or off.';
    }

    function vDig() {
      if (S.room !== 'cellar') return 'You dig. The ground disagrees, and the ground has a better shovel.';
      if (S.flags.tunnelDug) return 'The passage is already dug. The wall is in the past.';
      if (!has('shovel')) return 'You dig at the crack with your bare hands, like a very determined badger. The crack is unimpressed. (You need a shovel.)';
      S.flags.tunnelDug = true;
      return [
        'You set the shovel against the crack and dig with the grim rhythm of someone who has done this before. ',
        'Dirt and root and stone give way, and the crack opens into a tunnel that descends into a wetter dark, breathing on your face like a held secret.'
      ].join('');
    }

    function vFix(target) {
      if (!target || target === 'boat' || obj(target) === obj('boat')) {
        if (S.room !== 'lakeShore') return 'There is nothing here that needs fixing.';
        if (S.flags.boatPatched) return 'The boat is already patched and waiting.';
        if (!has('pitchPot') || !has('curtain')) {
          const missing = [];
          if (!has('pitchPot')) missing.push('a pot of pitch');
          if (!has('curtain')) missing.push('a moth-eaten curtain');
          return 'You need ' + missing.join(' and ') + ' to fix the boat.';
        }
        S.flags.boatPatched = true;
        return obj('boat').fixText;
      }
      return 'You can\'t fix that.';
    }

    function vRow() {
      if (S.room === 'lakeShore') {
        if (!S.flags.boatPatched) return 'The boat has a hole the size of a fist. The water would come in faster than you could bail. (Try: fix boat)';
        msg('You push off and row across the black water, the boat creaking its gratitude. The glow-fungi shimmer under the hull.');
        return changeRoom('lakeIslet');
      }
      if (S.room === 'lakeIslet') {
        msg('You row back to the shore, the boat sighing with relief.');
        return changeRoom('lakeShore');
      }
      return 'There is no water to row on here.';
    }

    function playMelody() {
      if (S.room === 'guardroom' && !S.flags.guardDancing) {
        S.flags.guardDancing = true;
        msg([
          'Your fingers find the tune — the lullaby of the Sunken King — and the silver lyre sings it true, the way instruments remember being loved.',
          'The sentinel stops humming. It turns, slowly, like a compass finding north. And then it dances: great sweeping, ridiculous steps, its armour clanking in a rhythm it has waited a thousand years to hear.',
          '"MUSIC!" it booms, delighted. "At last, music! I am OFF DUTY!"',
          'It waltzes past you into the passage, leaving the south door — and its own belt — unguarded.'
        ], 'good');
        return [];
      }
      return null;
    }

    function vPlay(target) {
      const haveLyre = has('lyre');
      if (target && target !== 'lyre') {
        return 'You can\'t play that. (A lyre, on the other hand…)';
      }
      if (!haveLyre && target === 'lyre') return 'You don\'t have the lyre. It hangs in the study.';
      if (!S.flags.melodyKnown) {
        if (haveLyre) return 'You strum the lyre. Its strings are out of tune — it sounds like a cat falling downstairs. You have a feeling you need to learn the right song.';
        return 'You hum a tune you half-remember. The halls hold their breath, then let it out, unimpressed.';
      }
      const special = playMelody();
      if (special) return special;
      if (S.room === 'guardroom') return 'The sentinel applauds, mid-dance. You bow.';
      return 'The lullaby of the Sunken King rolls through the halls, and for a moment, the dark is less dark.';
    }

    function vSing() {
      if (!S.flags.melodyKnown) {
        if (S.room === 'guardroom') return 'You hum the sentinel\'s own tune back at it. It stops humming, offended: "That is MY tune." A professional disagreement follows.';
        return 'You hum a tune you half-remember. It echoes, politely.';
      }
      const special = playMelody();
      if (special) return special;
      return 'Your voice, passable at best, carries the lullaby true. The halls approve, in their silent way.';
    }

    function vSay(text) {
      const words = (text || '').toLowerCase();
      if (S.room === 'caveMouth' && !S.flags.gatesOpen) {
        if (words.includes('echo')) {
          S.flags.gatesOpen = true;
          return [
            'You whisper: "Echo."',
            'The word rolls across the cavern, and the cavern rolls it back — twice, richer each time. Somewhere deep in the brass, something unlatches. The great doors groan apart, thirty feet of patience giving in all at once.'
          ];
        }
        const responses = [
          'The statue\'s lips move, but no sound escapes. It waits.',
          'Your word enters the cavern and does not come back. The statue inclines its head, encouragingly, and waits.',
          'Nothing happens, except that the cavern repeats your word back at you with slightly more confidence than you said it.'
        ];
        return responses[Math.floor(Math.random() * responses.length)];
      }
      if (S.flags.gatesOpen && S.room === 'caveMouth') {
        return '"' + text + '," you say. The gates are already open, but they appreciate the attempt at ceremony.';
      }
      return 'You say "' + text + '." The dark keeps it, and gives you nothing back.';
    }

    function openSarcophagus() {
      if (isOpen('sarcophagus')) return 'The sarcophagus is already open. The King\'s bones keep their own counsel.';
      setSt('sarcophagus', 'open', true);
      msg([
        'You set your shoulder to the lid and push. It moves with a groan like a mountain rolling over. ',
        'Inside: the bones of a king, tidily arranged, and a heavy gold ring resting on his chest.',
        'A column of pale light rises, and the shade of the King stands before you — young, crowned, grinning.',
        '"Take it," it says. "I was buried with my ring, but I was buried with a better story. Tell it."',
        'It fades, laughing, and the tomb is quiet again.'
      ]);
      return 'Inside the sarcophagus: the King\'s signet ring.';
    }

    function vPush(target) {
      if (target === 'mirror') {
        if (S.room !== 'mirrorHall') return 'There are no mirrors here to push.';
        if (S.flags.mirrorOpened) return 'The west mirror is already open.';
        S.flags.mirrorOpened = true;
        const lead = S.flags.flourRevealed
          ? 'You push where the flour outlined the door. '
          : 'You press against the west mirror. For a heartbeat your reflection presses back — then ';
        return lead + 'the whole wall swings, silent as a held breath, and a narrow chamber opens beyond.';
      }
      if (target === 'sarcophagus') return openSarcophagus();
      if (target === 'gates') return 'You push at the brass gates. Thirty feet of brass decline to move. They seem to be waiting for a word.';
      if (target === 'statue') return 'You push the statue. It does not move. It was never going to.';
      if (target === 'boat') return 'You push the boat toward the water. It slides in with a wet sigh and immediately ships water through the hole.';
      if (target === 'throne') return 'You push the throne. The skeleton of the King does not react. You get the feeling it has seen this before.';
      return 'You push, to no effect. The universe does not budge.';
    }

    function vThrow(target, atId) {
      if (target === 'flour') {
        if (S.room === 'mirrorHall' && !S.flags.mirrorOpened) {
          S.flags.flourRevealed = true;
          return [
            'You upend the sack. Flour explodes in a white cloud — and clings to the west mirror, tracing its edges in white: ',
            'a door, outlined like a secret that has been standing up too long.'
          ];
        }
        return obj('flour').throw;
      }
      if (!has(target)) return 'You don\'t have that to throw.';
      S.inv.splice(S.inv.indexOf(target), 1);
      if (atId && atId === 'boat') return 'You hurl the ' + obj(target).name + ' at the boat. It bounces off, philosophically. The boat does not change its mind.';
      S.inv.push(target);
      return 'You throw the ' + obj(target).name + '. It lands nearby, unimpressed, and you pick it back up.';
    }

    function vEat(target) {
      const o = obj(target);
      if (!o) return null;
      if (target === 'loaf') {
        if (!has('loaf')) return 'You don\'t have it.';
        if (S.flags.loafEaten) return 'The loaf is gone. You ate it. It was bread.';
        S.flags.loafEaten = true;
        S.inv.splice(S.inv.indexOf('loaf'), 1);
        return o.eat;
      }
      if (target === 'sunstone') return 'You put the sunstone to your lips. It is warm, and it does not fit in your mouth. The sunstone appreciates the gesture.';
      if (target === 'emptyBottle') return 'You lick the bottle. It tastes like 1752, which tasted like regret.';
      return 'You raise the ' + o.name + ' to your mouth. On reflection, you do not eat that.';
    }

    function vDrink(target) {
      if (target === 'oilJar' || target === 'lantern') {
        die([
          'You take a sip of lamp oil.',
          'It is, it turns out, quite fatal.',
          'Your grandmother\'s note was very specific about this.'
        ]);
        return [];
      }
      if (target === 'emptyBottle') return 'You tilt the bottle. Nothing comes out, not even pride.';
      if (S.room === 'lakeShore' || S.room === 'lakeIslet') {
        if (target && obj(target)) return 'You drink from the ' + obj(target).name + '. It is water. It is ancient. It is fine.';
        return 'You cup the black water and drink. It is brackish and cold, and it has been down here longer than most kingdoms.';
      }
      if (target === 'well') return 'You drink from the well. The well is dry. This is, arguably, the point.';
      if (target) return 'You cannot drink that.';
      return 'Drink what?';
    }

    function vUse(target, withId) {
      if (!target) return 'Use what?';
      const o = obj(target);
      if (!o) return null;

      // lens on note
      if (target === 'lens' && withId === 'note') return vExamine('note', 'lens');
      if (target === 'note' && withId === 'lens') return vExamine('note', 'lens');

      // oil on lantern
      if (target === 'oilJar' && withId === 'lantern') return 'You carefully top up the lantern. It was, as it turns out, fine — but it accepts the tribute with grace.';
      if (target === 'lantern' && withId === 'oilJar') return vUse('oilJar', 'lantern');

      // patch materials on boat
      if ((target === 'pitchPot' || target === 'curtain') && withId === 'boat') return vFix('boat');
      if (target === 'boat') return vFix('boat');

      // keys on locks
      if (withId && obj(target) && obj(target).key) return vUnlock(target, withId);
      if (withId && obj(withId) && obj(withId).key) return vUnlock(withId, target);

      if (withId) return 'Using the ' + o.name + ' on the ' + obj(withId).name + ' accomplishes nothing, but it was worth a try.';
      return 'Use the ' + o.name + ' on what?';
    }

    function vClimb(target) {
      if (S.room === 'yard' && (target === 'well')) {
        msg('You take the rusty ladder and climb down into the dry well, hand over hand, into the honey-coloured glow.');
        return changeRoom('wellBottom');
      }
      if (S.room === 'wellBottom' && (target === 'ladder' || target === 'well')) {
        msg('You climb the rusty ladder back up into the yard, blinking in the mist.');
        return changeRoom('yard');
      }
      if (S.room === 'porch' && target === 'roof') return 'You do not climb onto the roof. The roof has enough problems.';
      return 'There is nothing here to climb.';
    }

    function vEnter(target) {
      if (S.room === 'yard' && target === 'well') return vClimb('well');
      if (S.room === 'yard' && (target === 'manor' || target === 'house' || target === 'porch' || target === 'door')) return changeRoom('porch');
      if (S.room === 'cellar' && target === 'crack') {
        if (!S.flags.tunnelDug) return 'The crack is wide enough for a fist, not for a treasure hunter.';
        return changeRoom('tunnel');
      }
      if (S.room === 'hall' && target === 'hatch') {
        if (!isOpen('hatch')) return 'The trapdoor is shut.';
        return changeRoom('cellar');
      }
      if (S.room === 'mirrorHall' && target === 'mirror') return vPush('mirror');
      if (S.room === 'boat') return 'You are not in the boat. The boat is in the water, mostly.';
      return 'You can\'t enter that.';
    }

    function vTalk() {
      if (S.room === 'guardroom') {
        if (S.flags.guardDancing) return 'The sentinel dances past, humming now in two parts. "Best shift I\'ve had in a thousand years!"';
        return 'The sentinel hums. "No melody, no passage," it says, without stopping humming. It glances at the key on its belt, proudly.';
      }
      return 'There is no one here to talk to. The portraits, technically, are listening.';
    }

    function vAttack(target) {
      if (target === 'sentinel' && S.room === 'guardroom') {
        if (has('knife')) return 'You lunge with the rusty knife. It passes through the sentinel like mist through a comb. The sentinel sighs. "I am a ghost, darling. The paperwork was enormous."';
        return 'You swing at the ghost with your bare hands. Your hands pass through. The sentinel tilts its head: "Was that a threat, or a stretch?"';
      }
      return 'Violence is not the answer. Here, the answer is usually a riddle.';
    }

    function vWait() { return 'Time passes. The dark does not, which is its way of being patient.'; }

    function vHelp() {
      return [
        { text: '— HOW TO PLAY —', cls: 'info' },
        'Move with compass directions or "go north". Look around with "look".',
        'Objects: take, drop, examine, open, close, lock, unlock, put X in Y, use X on Y.',
        'Special: read, light, dig, fix, row, play, sing, say, push, throw, eat, drink.',
        'Undo your last move with "undo" (or the Undo button). Save with "save 1..3", load with "load 1..3".',
        'Type "score" for your standing, "help" for this list, "clear" to tidy the screen.',
        'And remember: mind the echoes.',
        { text: '', cls: '' }
      ];
    }

    function vScore() {
      return 'Score: ' + S.score + '  Rank: ' + rank() + '  Moves: ' + S.turns +
        '  Treasures secured: ' + S.treasuresPlaced.length + '/' + world.treasures.length + '.';
    }

    function vVersion() {
      return [
        { text: 'THE SUNKEN CROWN — v1.0 (2026)', cls: 'info' },
        'An original homage to the great text adventures. Original story, original prose.',
        'Engine: hand-rolled parser, no dependencies, runs entirely in your browser.',
        'Your grandmother would be proud. The King\'s shade is, by his own account, "off duty".'
      ];
    }

    /* ---------------- movement ---------------- */

    function vMove(dir) {
      const r = room();
      const e = r.exits[dir];
      if (!e) return 'You can\'t go that way.';
      let target, deny = null;
      if (typeof e === 'string') {
        target = e;
      } else {
        target = e.room;
        let blocked = false;
        if (target && e.flagReq && !S.flags[e.flagReq]) blocked = true;
        if (target && e.guardReq && !S.flags[e.guardReq]) blocked = true;
        if (target && e.objReq) {
          if (e.open !== undefined && !isOpen(e.objReq)) blocked = true;
          if (e.lit !== undefined && !st(e.objReq, 'lit', false)) blocked = true;
        }
        deny = blocked ? (e.deny || 'You can\'t go that way.') : null;
      }
      if (!target) return deny || 'You can\'t go that way.';
      if (deny) return deny;
      msg('You go ' + { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down' }[dir] + '.', 'dim');
      return changeRoom(target);
    }

    /* ---------------- dispatcher ---------------- */

    const handlers = {
      help: vHelp,
      score: vScore,
      version: vVersion,
      look: vLook,
      examine: vExamine,
      take: vTake,
      drop: vDrop,
      inventory: vInventory,
      open: vOpen,
      close: vClose,
      lock: (t, w) => 'Lock it with what? It is locked, which is the point.',
      unlock: vUnlock,
      put: vPut,
      read: vRead,
      light: vLight,
      turn: vTurn,
      dig: vDig,
      fix: vFix,
      row: vRow,
      play: vPlay,
      sing: vSing,
      say: (t, w, text) => vSay(text),
      push: vPush,
      pull: (t) => t === 'mirror' ? 'You pull the mirror. It does not swing. It is a push door, and it has made its feelings known.' : 'You pull. Nothing gives. The universe is remarkably stiff.',
      throw: vThrow,
      eat: vEat,
      drink: vDrink,
      use: vUse,
      climb: vClimb,
      enter: vEnter,
      jump: (t) => S.room === 'yard' ? (msg('You jump into the well. It is a long way down. You land in the leaves at the bottom, unhurt and slightly embarrassed.'), changeRoom('wellBottom')) : 'You jump. You land. The universe takes note.',
      wait: vWait,
      move: (t, w, text) => vMove(text),
      talk: vTalk,
      attack: vAttack,
      give: (t, w) => {
        if (S.room === 'guardroom' && t === 'lyre' && has('lyre')) {
          return 'You offer the lyre to the sentinel. It looks at you, then at the lyre, and for a moment you could swear it was about to weep. "Keep it," it says. "Play it. That is the gift."';
        }
        return 'There is no one here to give things to.';
      },
      smell: () => {
        if (S.room === 'kitchen') return 'It smells of cold ash and old pies, and — faintly — of a better century.';
        if (S.room === 'cellar') return 'It smells of damp stone, lamp oil, and the idea of wine.';
        if (S.room === 'lakeShore' || S.room === 'lakeIslet') return 'It smells of deep water and minerals — like the earth exhaling.';
        return 'It smells of dust, adventure, and your own anticipation.';
      },
      listen: () => {
        if (S.room === 'guardroom') return S.flags.guardDancing ? 'The sentinel hums a waltz, two rooms away. The dark is keeping time.' : 'The sentinel hums an old tune. It is on the tip of your memory, and it is staying there.';
        if (S.room === 'gatePassage') return 'The brass passage hums a deep note, like a kettle far away.';
        return 'The halls are full of a low, patient silence, and underneath it — very faintly — the sound of a story waiting to be told.';
      }
    };

    function meta() {
      return {
        room: S.room,
        roomName: world.rooms[S.room].name,
        score: S.score,
        turns: S.turns,
        treasuresPlaced: S.treasuresPlaced.length,
        death: S.dead,
        win: S.won
      };
    }

    const PRESENCE_VERBS = ['examine', 'open', 'close', 'lock', 'unlock', 'read', 'light', 'turn', 'fix', 'eat', 'drink', 'use', 'push', 'pull', 'throw', 'attack', 'smell', 'listen', 'put', 'drop', 'enter', 'jump'];

    // Is a target physically present (carried, loose here, or inside an open container that is itself present)?
    function targetPresent(id) {
      if (!id) return true;
      if (has(id)) return true;
      if (looseHere(id)) return true;
      const loc = location(id);
      if (typeof loc === 'string' && loc !== 'inv') {
        return (looseHere(loc) || has(loc)) && isOpen(loc);
      }
      return false;
    }

    function handleActionCore(action) {
      out.length = 0;
      if (!action) return { messages: [], meta: meta() };

      // parser errors — a turn passes, but nothing is recorded for undo
      if (action.error) { msg(action.error, 'bad'); S.turns++; return { messages: out.slice(), meta: meta() }; }

      // meta commands handled first: no turn, no undo, alive or dead, dark or lit
      if (action.verb === 'undo') {
        if (doUndo()) {
          msg('Time folds backward like a river forgetting itself.', 'dim');
          return { messages: out.slice().concat(describeRoom(S.room, false)), meta: meta() };
        }
        return { messages: [{ text: 'Nothing to undo.', cls: '' }], meta: meta() };
      }
      if (action.verb === 'restart') {
        reset();
        msg('You wake in the mist…', 'dim');
        return { messages: out.slice().concat(describeRoom(S.room, true)), meta: meta() };
      }
      if (action.verb === 'quit') {
        msg('You set down the lantern and walk out into the mist, Ashcombe behind you — still yours, still waiting. The halls keep your name. (Close the tab, or "restart" to dive back in.)', 'dim');
        return { messages: out.slice(), meta: meta() };
      }
      if (action.verb === 'clear') {
        return { messages: [], meta: Object.assign(meta(), { clear: true }) };
      }
      if (action.verb === 'save' || action.verb === 'load') {
        const m = /^\s*([123])\s*$/.exec(action.text || '');
        const slot = m ? Number(m[1]) : null;
        return { messages: [], meta: Object.assign(meta(), action.verb === 'save' ? { saveRequest: slot } : { loadRequest: slot }) };
      }

      const bypass = ['help', 'score', 'version'];
      if (!bypass.includes(action.verb)) {
        if (S.dead) {
          msg('You are dead. (Use "undo" to try again, or "restart" for a new life.)', 'bad');
          return { messages: out.slice(), meta: meta() };
        }
        // darkness check
        if (!externalDark && room().dark && !hasLight()) {
          if (!S.darkWarning) {
            S.darkWarning = true;
            S.turns++;
            msg('It is pitch black! You are likely to be eaten by an Umbra.', 'bad');
            return { messages: out.slice(), meta: meta() };
          }
          S.turns++;
          die([
            'The Umbra is patient. It wraps around you like a second, colder skin, and the last thing you feel is its opinion of you.',
            'It collects your remains with a polite "thank you".'
          ]);
          return { messages: out.slice(), meta: meta() };
        }
        S.darkWarning = false;
      }

      // presence guard — a targeted verb must have its target here or carried
      if (action.target && PRESENCE_VERBS.includes(action.verb) && !targetPresent(action.target)) {
        S.turns++;
        msg('You don\'t see that here.', 'bad');
        return { messages: out.slice(), meta: meta() };
      }

      S.turns++;
      pushUndo();

      const h = handlers[action.verb];
      if (!h) { msg('I don\'t know how to do that.', 'bad'); return { messages: out.slice(), meta: meta() }; }

      let res;
      try {
        res = h(action.target, action.with, action.text);
      } catch (err) {
        msg('Something went wrong in the engine: ' + err.message, 'bad');
        return { messages: out.slice(), meta: meta() };
      }

      if (res) {
        if (Array.isArray(res)) {
          for (const item of res) {
            if (typeof item === 'string') msg(item);
            else if (item && item.text !== undefined) msg(item.text, item.cls);
          }
        } else {
          msg(res);
        }
      }

      // check win after any action
      if (!S.won) checkWin();
      return { messages: out.slice(), meta: meta() };
    }

    function stateDigest() { return JSON.parse(snapshot()); }

    function changedFields(before, after) {
      const changed = [];
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      if (before.room !== after.room) changed.push('room');
      if (!same(before.inv, after.inv)) changed.push('inventory');
      if (!same(before.obj, after.obj) || !same(before.contents, after.contents) || !same(before.loose, after.loose)) changed.push('objects');
      if (!same(before.flags, after.flags)) changed.push('flags');
      if (before.score !== after.score || !same(before.treasuresPlaced, after.treasuresPlaced)) changed.push('score');
      if (before.dead !== after.dead || before.won !== after.won) changed.push('status');
      if (before.turns !== after.turns) changed.push('turns');
      return changed;
    }

    function handleAction(action) {
      const before = stateDigest();
      const result = handleActionCore(action);
      const changed = changedFields(before, stateDigest());
      const refresh = new Set();
      if (changed.includes('room') || changed.includes('objects') || changed.includes('flags')) refresh.add('scene');
      if (changed.includes('inventory') || changed.includes('score') || changed.includes('turns')) refresh.add('hud');
      if (changed.includes('status')) refresh.add('overlays');
      return Object.assign({}, result, { action: action || null, changed, refresh: Array.from(refresh) });
    }

    function objectLocation(id) {
      const loc = location(id);
      if (S.inv.includes(id)) return { kind: 'inventory', id };
      if (loc && loc !== 'inv') return { kind: 'container', id: loc, open: isOpen(loc), room: looseHere(loc) ? S.room : null };
      if (looseHere(id)) return { kind: 'room', id: S.room };
      return { kind: 'unavailable', id };
    }

    function describeObject(id) {
      const o = obj(id);
      if (!o) return null;
      return {
        id, name: o.name || id, description: o.description || o.desc || '',
        takeable: !!o.takeable, container: !!o.container, open: isOpen(id),
        location: objectLocation(id), visible: itemsInRoom().includes(id),
        contents: o.container ? contentsOf(id).slice() : []
      };
    }

    /* ---------------- public API ---------------- */

    return {
      newGame: reset,
      intro: INTRO.slice(),

      restore(json) {
        S = Object.assign(freshState(), JSON.parse(json));
      },

      serialize() { return JSON.stringify(S); },

      handleAction,
      meta,

      // helpers for UI
      describeRoom: (rid, full) => describeRoom(rid, full),
      currentRoom: () => S.room,
      inventory: () => S.inv.slice(),
      isOpen, isLocked,
      location,
      canGo(dir) {
        const e = room().exits[dir];
        if (!e) return { ok: false, deny: 'You can\'t go that way.' };
        if (typeof e === 'string') return { ok: true };
        if (!e.room) return { ok: false, deny: e.deny };
        if (e.flagReq && !S.flags[e.flagReq]) return { ok: false, deny: e.deny };
        if (e.guardReq && !S.flags[e.guardReq]) return { ok: false, deny: e.deny };
        if (e.objReq) {
          if (e.open !== undefined && !isOpen(e.objReq)) return { ok: false, deny: e.deny };
          if (e.lit !== undefined && !st(e.objReq, 'lit', false)) return { ok: false, deny: e.deny };
        }
        return { ok: true };
      },
      // accessors for the graphical layer
      hasLight: () => hasLight(),
      isDark: (rid) => !!world.rooms[rid || S.room].dark,
      visibleItems: () => itemsInRoom(),
      visibleObjects: () => itemsInRoom().map((id) => describeObject(id)),
      objectLocation,
      describeObject,
      contentsOf: (id) => contentsOf(id).slice(),
      setExternalDarkness(v) { externalDark = !!v; },

      visited: () => Object.keys(S.visited),
      isTreasurePlaced: (id) => S.treasuresPlaced.includes(id),
      get flags() { return S.flags; },
      get state() { return S; }
    };
  })();

  Z.engine = engine;
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
