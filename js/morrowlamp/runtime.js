/* ============================================================
   MORROWLAMP MACHINE — the runtime
   The turn loop. It takes a parsed action, gives the cartridge's
   rule book first refusal, falls back to the Machine's own verbs,
   burns lamp oil, runs timers, checks endings, and reports what
   changed so a shell knows what to redraw.

   Headless by design: no DOM, no canvas, no audio. Presentation
   subscribes to events. This file runs under Node, which is why
   the conformance test can play the whole game without a browser.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};
  const list = ml.list;

  const UNDO_DEPTH = 20;

  function create(cartridge, options) {
    options = options || {};
    const cart = cartridge;
    const worldDef = cart.world || {};
    const profile = ml.profile.normalize(cart.profile);
    const statsConfig = ml.stats.config(profile.stats);
    /* Injectable so a test can make the dice behave. */
    const random = options.random || Math.random;
    const rules = cart.rules || [];
    const strings = Object.assign({
      cannotGoThatWay: 'You can\'t go that way.',
      dontSeeThat: 'You don\'t see that here.',
      taken: 'Taken.',
      dropped: 'Dropped.',
      carryingNothing: 'You are carrying nothing.',
      carryingPrefix: 'You are carrying:',
      alreadyHave: 'You already have it.',
      cannotTake: 'You can\'t take that.',
      cannotOpen: 'You can\'t open that.',
      cannotClose: 'You can\'t close that.',
      alreadyOpen: 'It is already open.',
      alreadyClosed: 'It is already closed.',
      itIsLocked: 'It is locked.',
      itIsClosed: 'It is closed.',
      cannotUnlock: 'You can\'t unlock that.',
      alreadyUnlocked: 'It is already unlocked.',
      unlockWithWhat: 'Unlock it with what?',
      wrongKey: 'That does not fit.',
      lockTurns: 'The lock turns.',
      nothingSpecial: 'You see nothing special about {the target}.',
      cannotRead: 'You can\'t read that.',
      cannotLight: 'You cannot light that.',
      alreadyLit: 'It is already lit.',
      notLit: 'It is not lit.',
      cannotPut: 'You can\'t put things in that.',
      thingInItself: 'You cannot put a thing inside itself.',
      dontHaveThat: 'You don\'t have that.',
      timePasses: 'Time passes.',
      dead: 'You are dead. (Use "undo" to try again, or "restart" to begin over.)',
      unknownVerb: 'I don\'t know how to do that.',
      nothingToUndo: 'Nothing to undo.',
      undone: 'Time folds backward.'
    }, cart.strings || {});

    /* ---------------- state ---------------- */
    function fresh() {
      return {
        room: worldDef.startRoom,
        inv: list(worldDef.startInventory),
        score: 0,
        turns: 0,
        dead: false,
        won: false,
        ending: null,
        darkTurns: 0,
        visited: {},
        flags: Object.assign({}, cart.startFlags || {}),
        obj: {},
        contents: {},
        loose: {},
        moved: {},
        gone: {},
        found: [],       // treasures picked up at least once
        secured: [],     // treasures placed where they belong
        fuel: profile.light.fuel ? profile.light.fuel.turns : null,
        timers: {},
        sheet: profile.stats.enabled ? ml.stats.create(statsConfig, cart.startClass || profile.stats.startClass) : null,
        encounter: null, // { id, name, hp, maxHp, round, guarding, over }
        prev: []
      };
    }

    let S = fresh();
    let world = ml.world.create(worldDef, S);
    let vocabulary = ml.vocabulary.create(cart, () => S.room);
    const bus = ml.emitter();

    let out = [];                 // messages accumulated during the current turn
    let lastRule = null;
    let externalDark = !!profile.darkness.external;

    function rebind() {
      world = ml.world.create(worldDef, S);
    }

    function reset() {
      S = fresh();
      rebind();
      S.visited[S.room] = true;
      bus.emit('reset', { state: S });
    }

    /* ---------------- output ---------------- */
    function say(text, cls) {
      for (const line of list(text)) {
        if (line === null || line === undefined) continue;
        if (typeof line === 'object' && line.text !== undefined) out.push({ text: String(line.text), cls: line.cls || '' });
        else out.push({ text: String(line), cls: cls || '' });
      }
    }

    /* ---------------- helpers ---------------- */
    const objectName = (id) => ((world.object(id) || {}).name || id);
    const isTreasure = (id) => profile.treasures.enabled && profile.treasures.list.includes(id);

    function rank() { return ml.profile.rankFor(profile, S.score); }

    function addScore(points, reason) {
      if (!points) return;
      S.score += points;
      if (profile.score.enabled && reason) {
        say({ text: 'Scored ' + points + ' point' + (points === 1 ? '' : 's') + ' (' + reason + ').', cls: 'scored' });
      }
    }

    function roomNotes(rid) {
      const r = world.roomDef(rid);
      const lines = [];
      for (const note of list(r && r.notes)) {
        if (ml.rules.conditionsHold(note.when, {}, ctx())) lines.push({ text: note.text, cls: note.cls || 'dim' });
      }
      return lines;
    }

    function describeRoom(rid, full) {
      const id = rid || S.room;
      const r = world.roomDef(id);
      if (!r) return [{ text: 'You are nowhere. This is a bug in the cartridge.', cls: 'bad' }];
      const lines = [{ text: r.name, cls: 'room-name' }];

      if (r.dark && !world.hasLight(id)) {
        lines.push({ text: profile.darkness.warning, cls: 'bad' });
        return lines;
      }
      lines.push({ text: (full || !S.visited[id]) ? (r.desc || '') : (r.short || r.desc || ''), cls: full || !S.visited[id] ? '' : 'dim' });
      lines.push.apply(lines, roomNotes(id));

      for (const oid of world.itemsHere().slice().sort()) {
        const o = world.object(oid);
        if (o.desc) lines.push({ text: o.desc, cls: 'dim' });
        if (o.container && world.isOpen(oid) && world.contentsOf(oid).length) {
          lines.push({ text: 'It contains: ' + world.contentsOf(oid).map(objectName).join(', ') + '.', cls: 'dim' });
        }
      }
      return lines;
    }

    function goto(rid) {
      if (!world.roomDef(rid)) return;
      S.room = rid;
      const first = !S.visited[rid];
      S.visited[rid] = true;
      S.darkTurns = 0;
      say(describeRoom(rid, first));
      bus.emit('room', { room: rid, first });
    }

    /* ---------------- undo ---------------- */
    function snapshot() {
      const copy = Object.assign({}, S);
      delete copy.prev;
      return JSON.stringify(copy);
    }
    function pushUndo() {
      S.prev.push(snapshot());
      if (S.prev.length > UNDO_DEPTH) S.prev.shift();
    }
    function popUndo() {
      const snap = S.prev.pop();
      if (!snap) return false;
      const prev = S.prev;
      S = Object.assign(S, JSON.parse(snap));
      S.prev = prev;
      rebind();
      return true;
    }

    /* ---------------- endings ---------------- */
    function die(lines) {
      say(lines, 'bad');
      S.dead = true;
      S.ending = 'death';
      bus.emit('death', { text: lines });
    }

    function endGame(endingId) {
      const ending = (cart.endings || []).find((e) => e.id === endingId);
      if (!ending) return;
      S.ending = ending.id;
      if (ending.score) addScore(ending.score, ending.reason);
      say(ending.text, ending.cls || 'good');
      if (ending.kind === 'death') { S.dead = true; bus.emit('death', { text: ending.text }); return; }
      S.won = true;
      bus.emit('win', { ending: ending.id, score: S.score, rank: rank() });
    }

    function checkEndings() {
      if (S.won || S.dead) return;
      if (profile.treasures.enabled && profile.treasures.winOnAll &&
          S.secured.length === profile.treasures.list.length) {
        const win = (cart.endings || []).find((e) => e.kind === 'win');
        if (win) { endGame(win.id); return; }
      }
      for (const ending of (cart.endings || [])) {
        if (!ending.when) continue;
        if (ml.rules.conditionsHold(ending.when, {}, ctx())) { endGame(ending.id); return; }
      }
    }

    /* ---------------- treasure bookkeeping ---------------- */
    function noteTreasureFound(id) {
      if (!isTreasure(id) || S.found.includes(id)) return;
      S.found.push(id);
      addScore(profile.score.treasureFound, 'treasure found');
      grantAward('treasureFound');
    }
    function noteTreasureSecured(id) {
      if (!isTreasure(id) || S.secured.includes(id)) return false;
      S.secured.push(id);
      addScore(profile.score.treasureSecured, 'treasure secured');
      grantAward('treasureSecured');
      return true;
    }

    /* Awards are the character system's reaction to something the cartridge
       cares about. The runtime knows the trigger names; the cartridge
       decides whether each is worth a stat, some experience, or nothing. */
    function grantAward(trigger, weight) {
      const spec = (profile.stats.awards || {})[trigger];
      if (!spec || !S.sheet) return;
      say(ml.stats.grant(statsConfig, S.sheet, spec, weight));
    }

    /* ---------------- rule operations ---------------- */
    const ops = {
      say,
      setFlag(flag, value) { S.flags[flag] = value; },
      score: (n, reason) => addScore(n, reason),
      goto,
      give(id) { if (!id || !world.object(id)) return; world.give(id); noteTreasureFound(id); },
      drop(id) { if (id && world.object(id)) world.dropAt(id, S.room); },
      destroy(id) { if (id && world.object(id)) world.destroy(id); },
      placeIn(id, containerId) {
        if (!id || !world.object(id) || !world.object(containerId)) return;
        if (profile.treasures.securedIn === containerId && isTreasure(id)) {
          world.detach(id);
          noteTreasureSecured(id);
          return;
        }
        world.placeIn(id, containerId);
      },
      setOpen(id, value) { if (world.object(id)) world.setSt(id, 'open', value); },
      setLocked(id, value) { if (world.object(id)) world.setSt(id, 'locked', value); },
      setLit(id, value) { if (world.object(id)) world.setSt(id, 'lit', value); },
      refuel(id) {
        const fuel = profile.light.fuel;
        if (fuel && (!id || fuel.object === id)) S.fuel = fuel.turns;
      },
      sound(name) { bus.emit('sound', { name }); },
      music(name) { bus.emit('music', { name }); },
      die,
      end: endGame,
      /* The only door between an outcome and the encounter system.
         Returns false when this cartridge has no such encounter, so the
         outcome dispatcher can fall back rather than strand the player. */
      encounter(id) { return startEncounter(id); },
      award(trigger, weight) { grantAward(trigger, weight); },
      train(stat, by) {
        if (!S.sheet) return;
        const line = ml.stats.use(statsConfig, S.sheet, stat, by);
        if (line) say({ text: line, cls: 'scored' });
      },
      heal(n) { if (S.sheet) ml.stats.heal(S.sheet, n); },
      hurt(n) {
        if (!S.sheet) return;
        if (ml.stats.damage(S.sheet, n)) die(['You are out of strength, and out of luck.']);
      },
      describe() { say(describeRoom(S.room, true)); },
      ruleFired(id) { lastRule = id; }
    };

    function ctx() {
      return {
        world, state: S, profile, ops, cart,
        sheet: S.sheet, statsConfig, random
      };
    }

    /* ---------------- encounters ----------------
       The runtime owns when an encounter is running and whose turn it
       is. What an encounter *is* belongs to encounter.js, and what a
       particular encounter contains belongs to the cartridge. */
    function startEncounter(id) {
      if (!profile.combat.enabled) return false;
      const def = ml.encounter.definition(cart, id);
      if (!def) return false;
      /* This kind of encounter may need something this cartridge has not
         given it. Refuse rather than start a fight nobody can lose. */
      const blocked = ml.encounter.cannotRun(def, ctx());
      if (blocked) {
        if (global.console) global.console.warn('morrowlamp: encounter "' + id + '" cannot run — ' + blocked);
        return false;
      }
      if (S.encounter && !S.encounter.over) return true;
      S.encounter = ml.encounter.begin(def, id);
      say(def.intro || (S.encounter.name + ' blocks your way.'), 'bad');
      bus.emit('encounter', { id, state: ml.clone(S.encounter), actions: encounterActions() });
      return true;
    }

    function encounterDef() {
      return S.encounter ? ml.encounter.definition(cart, S.encounter.id) : null;
    }

    function encounterActions() {
      const def = encounterDef();
      return def ? ml.encounter.available(def, ctx()) : [];
    }

    function encounterAct(actionId) {
      out = [];
      const def = encounterDef();
      if (!def || !S.encounter || S.encounter.over) {
        return { messages: [], meta: meta() };
      }
      const result = ml.encounter.act(def, S.encounter, actionId, ctx());
      say(result.lines);
      if (profile.turns) S.turns++;

      if (result.over) {
        const finished = S.encounter;
        S.encounter = null;
        /* Whatever was in the dark has had its turn. A cartridge may buy
           the player some turns before the dark takes an interest again,
           so that surviving a fight in an unlit room is survivable rather
           than a fight that restarts on the very next move. Counting from
           a negative number is exactly the head start it sounds like. */
        if (profile.darkness.enabled && profile.darkness.respite) {
          S.darkTurns = -Math.abs(profile.darkness.respite);
        }
        if (result.died) {
          ml.outcome.apply(def.onDefeat || { type: 'death', text: def.defeatedBy || ['It finishes what it started.'] }, ctx());
        } else if (result.won) {
          bus.emit('encounterWon', { id: finished.id });
          if (def.onWin) ml.outcome.apply(def.onWin, ctx());
        } else if (result.fled) {
          bus.emit('encounterFled', { id: finished.id });
          if (def.onFlee) ml.outcome.apply(def.onFlee, ctx());
        }
        checkEndings();
      }
      bus.emit('encounter', {
        id: S.encounter ? S.encounter.id : null,
        state: S.encounter ? ml.clone(S.encounter) : null,
        actions: encounterActions()
      });
      return { messages: out.slice(), meta: meta() };
    }

    /* ---------------- the Machine's own verbs ----------------
       Deliberately generic. Everything peculiar to a game belongs
       in that game's rule book, not here. */
    const verbs = {
      look: () => say(describeRoom(S.room, true)),

      examine(target) {
        if (!target) { say(describeRoom(S.room, true)); return; }
        const o = world.object(target);
        if (!o) { say(strings.dontSeeThat, 'bad'); return; }
        if (o.examine) { say(o.examine); }
        else say(ml.rules.expand(strings.nothingSpecial, { target }, ctx()), 'dim');
        /* Looking into the trophy case reports the hunt, not the contents.
           Generic: any cartridge with `treasures.securedIn` gets this. */
        if (profile.treasures.enabled && profile.treasures.securedIn === target) {
          say('', 'dim');
          for (const t of profile.treasures.list) {
            const filled = S.secured.includes(t);
            const label = (profile.treasures.names[t] || objectName(t)).toUpperCase();
            say((filled ? '✦ ' : '· ') + label + (filled ? ' — filled' : ' — awaiting'), 'dim');
          }
          const left = profile.treasures.list.length - S.secured.length;
          say('', 'dim');
          say('The case has ' + left + ' place' + (left === 1 ? '' : 's') + ' still waiting.', 'dim');
        } else if (o.container && world.isOpen(target)) {
          const c = world.contentsOf(target);
          say(c.length ? 'It contains: ' + c.map(objectName).join(', ') + '.' : 'It is empty.', 'dim');
        }
        /* Studying something new can teach you something, once, if the
           cartridge says so. `awards.examine` names the stat; the Machine
           does not know or care that this game calls it Lore. */
        if ((profile.stats.awards || {}).examine && S.sheet && !S.sheet.seen[target]) {
          S.sheet.seen[target] = true;
          const klass = statsConfig.classes[S.sheet.cls] || {};
          grantAward('examine', (klass.awards && klass.awards.examine) || undefined);
        }
        bus.emit('examine', { id: target });
      },

      move(target, withArg, text) {
        /* Direction arrives as free text ("n"), not as a resolved object. */
        const dir = text || target;
        if (!dir) { say(strings.cannotGoThatWay, 'bad'); return; }
        const check = world.canGo(dir);
        if (!check.ok) { say(check.deny || strings.cannotGoThatWay, 'bad'); return; }
        say('You go ' + world.dirName(dir) + '.', 'dim');
        goto(check.room);
      },

      enter(target) {
        /* Walking into a thing: if any exit here is gated on that object
           or leads through it, use it. Otherwise the rule book's problem. */
        const exits = world.exitsOf();
        for (const dir in exits) {
          const e = exits[dir];
          if (typeof e === 'object' && e && e.objReq === target) { verbs.move(null, null, dir); return; }
        }
        say(strings.dontSeeThat, 'bad');
      },

      take(target, fromId) {
        const o = world.object(target);
        if (!o) { say(strings.dontSeeThat, 'bad'); return; }
        if (!o.takeable) { say(o.cannotTake || strings.cannotTake, 'bad'); return; }
        if (world.carrying(target)) { say(strings.alreadyHave); return; }

        const container = fromId || (world.locationOf(target) !== 'inv' ? world.locationOf(target) : null);
        if (container) {
          if (!(world.looseHere(container) || world.carrying(container))) { say(strings.dontSeeThat, 'bad'); return; }
          if (!world.isOpen(container)) { say(strings.itIsClosed, 'bad'); return; }
          if (!world.contentsOf(container).includes(target)) { say(strings.dontSeeThat, 'bad'); return; }
        } else if (!world.looseHere(target)) {
          say(strings.dontSeeThat, 'bad'); return;
        }

        world.give(target);
        say(o.takeText || strings.taken);
        noteTreasureFound(target);
        bus.emit('take', { id: target });
      },

      drop(target) {
        if (!world.carrying(target)) { say(strings.dontHaveThat, 'bad'); return; }
        world.dropAt(target, S.room);
        say(world.object(target).dropText || strings.dropped);
      },

      inventory() {
        if (!S.inv.length) { say(strings.carryingNothing, 'dim'); return; }
        say(strings.carryingPrefix + '\n  ' + S.inv.map(objectName).join('\n  '));
      },

      open(target) {
        const o = world.object(target);
        if (!o) { say(strings.dontSeeThat, 'bad'); return; }
        if (!o.container) { say(o.cannotOpen || strings.cannotOpen, 'bad'); return; }
        if (world.isOpen(target)) { say(strings.alreadyOpen); return; }
        if (world.isLocked(target)) { say(o.lockedText || strings.itIsLocked, 'bad'); return; }
        world.setSt(target, 'open', true);
        say(o.openText || ('You open the ' + o.name + '.'));
        const c = world.contentsOf(target);
        say(c.length ? 'Inside: ' + c.map(objectName).join(', ') + '.' : 'It is empty.', 'dim');
        bus.emit('open', { id: target });
      },

      close(target) {
        const o = world.object(target);
        if (!o || !o.container) { say(strings.cannotClose, 'bad'); return; }
        if (!world.isOpen(target)) { say(strings.alreadyClosed); return; }
        world.setSt(target, 'open', false);
        say('You close the ' + o.name + '.');
      },

      unlock(target, keyId) {
        const o = world.object(target);
        if (!o || !o.key) { say(strings.cannotUnlock, 'bad'); return; }
        if (!world.isLocked(target)) { say(strings.alreadyUnlocked); return; }
        if (!keyId) { say(strings.unlockWithWhat, 'bad'); return; }
        if (!world.carrying(keyId) && !world.looseHere(keyId)) {
          say('You don\'t have the ' + objectName(keyId) + '.', 'bad'); return;
        }
        if (o.key !== keyId) { say('The ' + objectName(keyId) + ' does not fit.', 'bad'); return; }
        world.setSt(target, 'locked', false);
        say(o.unlockText || strings.lockTurns);
        bus.emit('unlock', { id: target });
      },

      lock(target, keyId) {
        const o = world.object(target);
        if (!o || !o.key) { say(strings.cannotUnlock, 'bad'); return; }
        if (world.isLocked(target)) { say('It is already locked.'); return; }
        if (o.key !== keyId) { say(strings.unlockWithWhat, 'bad'); return; }
        world.setSt(target, 'open', false);
        world.setSt(target, 'locked', true);
        say('The lock closes.');
      },

      put(target, containerId) {
        const c = world.object(containerId);
        if (!c) { say(strings.cannotPut, 'bad'); return; }
        if (!world.carrying(target)) { say(strings.dontHaveThat, 'bad'); return; }
        if (target === containerId) { say(strings.thingInItself); return; }
        if (!(world.looseHere(containerId) || world.carrying(containerId))) { say(strings.dontSeeThat, 'bad'); return; }

        /* The trophy case: securing a treasure is a scoring event, not
           just a change of address. */
        if (profile.treasures.enabled && profile.treasures.securedIn === containerId) {
          if (!isTreasure(target)) {
            say(c.rejectText || ('The ' + c.name + ' does not accept the ' + objectName(target) + '.'));
            return;
          }
          if (S.secured.includes(target)) { say('The ' + objectName(target) + ' is already in place.'); return; }
          world.detach(target);
          say(ml.rules.expand(c.acceptText || 'You place {the target} inside the ' + c.name + '.', { target }, ctx()));
          noteTreasureSecured(target);
          bus.emit('secured', { id: target, count: S.secured.length });
          return;
        }

        if (!c.container) { say(strings.cannotPut, 'bad'); return; }
        if (!world.isOpen(containerId)) { say(strings.itIsClosed, 'bad'); return; }
        world.placeIn(target, containerId);
        say('You put the ' + objectName(target) + ' in the ' + c.name + '.');
      },

      read(target) {
        const o = world.object(target);
        if (!o) { say(strings.dontSeeThat, 'bad'); return; }
        if (o.read) { say(o.read); return; }
        if (o.examine) { say(o.examine); return; }
        say(strings.cannotRead, 'bad');
      },

      light(target) {
        const o = world.object(target);
        if (!o) { say(strings.dontSeeThat, 'bad'); return; }
        if (!o.light && !o.lightable) { say(strings.cannotLight, 'bad'); return; }
        if (world.isLit(target)) { say(strings.alreadyLit); return; }
        world.setSt(target, 'lit', true);
        say(o.lightText || ('You light the ' + o.name + '.'));
        bus.emit('light', { id: target, lit: true });
      },

      turn(target, mode) {
        const o = world.object(target);
        if (!o) { say(strings.dontSeeThat, 'bad'); return; }
        if (!o.light && !o.lightable) { say('You can\'t turn that on or off.', 'bad'); return; }
        if (mode === 'off') {
          if (!world.isLit(target)) { say(strings.notLit); return; }
          world.setSt(target, 'lit', false);
          say(o.douseText || ('You extinguish the ' + o.name + '.'));
          bus.emit('light', { id: target, lit: false });
          return;
        }
        verbs.light(target);
      },

      use(target, withId) {
        /* The one universal combination worth building in: a key in a lock. */
        const t = world.object(target), w = world.object(withId);
        if (t && t.key && withId) { verbs.unlock(target, withId); return; }
        if (w && w.key && target) { verbs.unlock(withId, target); return; }
        if (withId) { say('Using the ' + objectName(target) + ' on the ' + objectName(withId) + ' accomplishes nothing.', 'dim'); return; }
        say('Use the ' + objectName(target) + ' on what?');
      },

      wait: () => say(strings.timePasses, 'dim'),

      score() {
        const parts = ['Score: ' + S.score];
        const r = rank();
        if (r) parts.push('Rank: ' + r);
        parts.push('Moves: ' + S.turns);
        if (profile.treasures.enabled) {
          parts.push('Treasures secured: ' + S.secured.length + '/' + profile.treasures.list.length);
        }
        say(parts.join('  ') + '.');
      },

      version() {
        say([
          { text: (cart.meta.title || 'A Morrowlamp Adventure') + ' — v' + (cart.meta.version || '1.0'), cls: 'info' },
          cart.meta.author ? 'By ' + cart.meta.author + '.' : null,
          cart.meta.copyright || null,
          'Morrowlamp Machine ' + ml.VERSION + '. No frameworks, no assets, no network.'
        ].filter(Boolean));
      },

      help() {
        say([{ text: '— HOW TO PLAY —', cls: 'info' }].concat(
          list(cart.help || [
            'Move with compass directions, or "go north".',
            'Look around with "look"; study things with "examine".',
            'Objects: take, drop, open, close, unlock, put X in Y, use X on Y.',
            'Undo with "undo". Save with "save 1", load with "load 1".'
          ])
        ));
      }
    };

    /* ---------------- lamp oil ----------------
       Fuel is a gameplay rule, not a detail of the interface. It burns
       only in rooms that are genuinely dark, so exploring the lit half
       of a game costs nothing. */
    function burnFuel() {
      const fuel = profile.light.fuel;
      if (!fuel || S.fuel === null) return;
      const id = fuel.object;
      if (!world.carrying(id) || !world.isLit(id)) return;
      const r = world.roomDef(S.room);
      if (!r || !r.dark) return;
      S.fuel--;
      for (const [left, text] of list(fuel.warnings)) {
        if (S.fuel === left) say(text, 'bad');
      }
      if (S.fuel <= 0) {
        world.setSt(id, 'lit', false);
        say(fuel.outText || 'Your light goes out.', 'bad');
        bus.emit('light', { id, lit: false });
      }
    }

    function refuel() {
      const fuel = profile.light.fuel;
      if (fuel) S.fuel = fuel.turns;
    }

    function runTimers() {
      for (const timer of list(profile.timers)) {
        const fired = S.timers[timer.id] || 0;
        if (!timer.repeat && fired) continue;
        if (S.turns < timer.after) continue;
        if (timer.every && (S.turns - timer.after) % timer.every !== 0) continue;
        if (timer.when && !ml.rules.conditionsHold(timer.when, {}, ctx())) continue;
        S.timers[timer.id] = fired + 1;
        ml.rules.perform(timer.do, {}, ctx());
      }
    }

    /* ---------------- the turn ---------------- */
    const META_VERBS = ['undo', 'restart', 'quit', 'clear', 'save', 'load'];
    const FREE_VERBS = ['help', 'score', 'version'];

    /* Verbs whose target must actually be here. Movement and meta verbs
       are exempt, and so is any verb a cartridge marks `anywhere`. */
    function needsPresence(verb) {
      if (META_VERBS.includes(verb) || FREE_VERBS.includes(verb)) return false;
      if (verb === 'move' || verb === 'look' || verb === 'inventory' || verb === 'wait') return false;
      const spec = vocabulary.spec(verb);
      if (spec && spec.anywhere) return false;
      return true;
    }

    function digest() {
      return {
        room: S.room, inv: S.inv.slice(), score: S.score, turns: S.turns,
        dead: S.dead, won: S.won, flags: JSON.stringify(S.flags),
        obj: JSON.stringify(S.obj), contents: JSON.stringify(S.contents),
        loose: JSON.stringify(S.loose), secured: S.secured.slice(), fuel: S.fuel,
        sheet: JSON.stringify(S.sheet), encounter: JSON.stringify(S.encounter)
      };
    }

    function changedBetween(before, after) {
      const changed = [];
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      if (before.room !== after.room) changed.push('room');
      if (!same(before.inv, after.inv)) changed.push('inventory');
      if (before.obj !== after.obj || before.contents !== after.contents || before.loose !== after.loose) changed.push('objects');
      if (before.flags !== after.flags) changed.push('flags');
      if (before.score !== after.score || !same(before.secured, after.secured)) changed.push('score');
      if (before.dead !== after.dead || before.won !== after.won) changed.push('status');
      if (before.turns !== after.turns) changed.push('turns');
      if (before.fuel !== after.fuel) changed.push('light');
      if (before.sheet !== after.sheet) changed.push('character');
      if (before.encounter !== after.encounter) changed.push('encounter');
      return changed;
    }

    function meta() {
      return {
        room: S.room,
        roomName: (world.roomDef(S.room) || {}).name || S.room,
        score: S.score, turns: S.turns, rank: rank(),
        dead: S.dead, win: S.won, ending: S.ending,
        treasures: profile.treasures.list.length,
        secured: S.secured.length,
        fuel: S.fuel,
        dark: !!(world.roomDef(S.room) || {}).dark,
        hasLight: world.hasLight(S.room),
        sheet: S.sheet ? ml.stats.summary(statsConfig, S.sheet) : null,
        encounter: S.encounter && !S.encounter.over
          ? Object.assign({}, S.encounter, { actions: encounterActions() })
          : null,
        lastRule
      };
    }

    function core(action) {
      out = [];
      lastRule = null;
      if (!action) return { messages: [], meta: meta() };

      if (action.error) { say(action.error, 'bad'); if (profile.turns) S.turns++; return { messages: out.slice(), meta: meta() }; }

      const verb = action.verb;

      /* Meta verbs: no turn, no undo entry, allowed while dead or blind. */
      if (verb === 'undo') {
        if (popUndo()) { say(strings.undone, 'dim'); say(describeRoom(S.room, false)); }
        else say(strings.nothingToUndo);
        return { messages: out.slice(), meta: meta() };
      }
      if (verb === 'restart') { reset(); say(describeRoom(S.room, true)); return { messages: out.slice(), meta: meta() }; }
      if (verb === 'clear') return { messages: [], meta: Object.assign(meta(), { clear: true }) };
      if (verb === 'quit') { say(cart.quitText || 'You set the adventure down. It waits.', 'dim'); return { messages: out.slice(), meta: meta() }; }
      if (verb === 'save' || verb === 'load') {
        const slot = /^[0-9]$/.test(action.text || '') ? Number(action.text) : null;
        return { messages: [], meta: Object.assign(meta(), verb === 'save' ? { saveRequest: slot } : { loadRequest: slot }) };
      }

      if (!FREE_VERBS.includes(verb)) {
        if (S.dead || S.won) { say(S.dead ? strings.dead : 'The adventure is over. ("restart" to begin again.)', 'dim'); return { messages: out.slice(), meta: meta() }; }

        /* An encounter suspends ordinary play. A typed command that
           names one of its actions is taken as that action, so the
           parser shell can fight without a combat panel. */
        if (S.encounter && !S.encounter.over) {
          const wanted = String(action.text || verb || '').toLowerCase().trim();
          const match = encounterActions().find((a) => a.id === wanted || a.label.toLowerCase() === wanted);
          if (match) return encounterAct(match.id);
          const names = encounterActions().map((a) => a.label).join(', ');
          say(S.encounter.name + ' is on you. Your options: ' + names + '.', 'bad');
          return { messages: out.slice(), meta: meta() };
        }

        if (profile.darkness.enabled && !externalDark) {
          const r = world.roomDef(S.room);
          if (r && r.dark && !world.hasLight(S.room)) {
            if (profile.turns) S.turns++;
            S.darkTurns++;
            if (S.darkTurns <= profile.darkness.grace) {
              say(profile.darkness.warning, 'bad');
              bus.emit('darkness', { turns: S.darkTurns, fatal: false });
              return { messages: out.slice(), meta: meta() };
            }
            /* The dark has run out of patience. What that MEANS is the
               cartridge's business: darkness produces an outcome and
               stops there. It does not know what an encounter is. */
            bus.emit('darkness', { turns: S.darkTurns, fatal: true });
            S.darkTurns = 0;
            ml.outcome.apply(profile.darkness.onFail, ctx());
            return { messages: out.slice(), meta: meta() };
          }
          S.darkTurns = 0;
        }
      }

      if (action.target && needsPresence(verb) && !world.present(action.target) &&
          !ml.rules.reachesAnywhere(rules, action)) {
        if (profile.turns) S.turns++;
        say(strings.dontSeeThat, 'bad');
        return { messages: out.slice(), meta: meta() };
      }

      if (profile.turns) S.turns++;
      pushUndo();

      /* The cartridge gets first refusal on every turn. */
      let handled = false;
      try {
        handled = ml.rules.dispatch(rules, action, ctx());
      } catch (err) {
        say('The rule book faulted: ' + err.message, 'bad');
        return { messages: out.slice(), meta: meta() };
      }

      if (!handled) {
        const fn = verbs[verb];
        if (fn) {
          try { fn(action.target, action.with, action.text); }
          catch (err) { say('The Machine faulted: ' + err.message, 'bad'); return { messages: out.slice(), meta: meta() }; }
        } else {
          const spec = vocabulary.spec(verb);
          say((spec && spec.fallback) || strings.unknownVerb, 'bad');
        }
      }

      /* Some verbs are work. A cartridge that runs a character system may
         say which ones and what they wear in, and the Machine applies it
         here — inside the turn, inside the undo frame this turn already
         pushed, and identically in every shell. A shell that wants a
         gesture to count as exertion asks for the verb; it does not reach
         past this and adjust the sheet itself. */
      exert(verb);

      burnFuel();
      runTimers();
      checkEndings();
      return { messages: out.slice(), meta: meta() };
    }

    /* What a verb costs the body. The Machine knows only that using a
       stat trains it; which verbs use which stat is the cartridge's. */
    function exert(verb) {
      if (!verb || !profile.stats.enabled || !S.sheet) return;
      const spec = (profile.stats.exertion || {})[verb];
      if (!spec) return;
      ops.train(spec.stat || spec, spec.by || 1);
    }

    function perform(action) {
      const before = digest();
      const result = core(action);
      const changed = changedBetween(before, digest());
      const refresh = new Set();
      if (changed.includes('room') || changed.includes('objects') || changed.includes('flags')) refresh.add('scene');
      if (changed.includes('inventory') || changed.includes('score') || changed.includes('turns') || changed.includes('light')) refresh.add('hud');
      if (changed.includes('character')) refresh.add('character');
      if (changed.includes('encounter')) { refresh.add('encounter'); refresh.add('scene'); }
      if (changed.includes('status')) refresh.add('overlays');
      const full = Object.assign({}, result, { action: action || null, changed, refresh: Array.from(refresh) });
      bus.emit('turn', full);
      return full;
    }

    function command(text) {
      /* Mid-encounter, a typed word is first offered to the encounter's
         own actions. "shoo" is not a verb the parser has ever heard of,
         but it is what the cartridge called this action, and a player
         with no combat panel has no other way to say it. */
      if (S.encounter && !S.encounter.over) {
        const wanted = String(text || '').trim().toLowerCase();
        const match = encounterActions().find((a) => a.id === wanted || a.label.toLowerCase() === wanted);
        if (match) return api.encounterAct(match.id);
      }
      return perform(vocabulary.parse(text));
    }

    reset();

    const api = {
      cartridge: cart,
      profile,
      world,
      vocabulary,
      on: bus.on,
      emit: bus.emit,

      newGame: reset,
      perform,
      command,
      parse: (t) => vocabulary.parse(t),
      meta,
      describeRoom,
      intro: () => list(cart.intro),

      /* Read-only views a shell needs. */
      state: () => S,
      flags: () => S.flags,
      inventory: () => S.inv.slice(),
      visibleObjects: () => world.itemsHere().map((id) => describeObject(id)),
      describeObject,
      /* Which rooms the player has been in — what a map UI draws. */
      visited: () => Object.keys(S.visited),
      canGo: (dir) => world.canGo(dir),
      exits: () => {
        const outExits = [];
        for (const dir in world.exitsOf()) {
          const check = world.canGo(dir);
          outExits.push({ dir, ok: check.ok, room: check.room || null, deny: check.deny || null });
        }
        return outExits;
      },
      setExternalDarkness(v) { externalDark = !!v; },
      refuel,

      /* Character stats, present only when the cartridge asked for them. */
      statsConfig,
      hasStats: () => profile.stats.enabled,
      hasCombat: () => profile.combat.enabled,
      classes: () => Object.keys(statsConfig.classes).map((id) => Object.assign({ id }, statsConfig.classes[id])),
      chooseClass(id) {
        if (!profile.stats.enabled) return null;
        S.sheet = ml.stats.create(statsConfig, id);
        bus.emit('character', { sheet: ml.stats.summary(statsConfig, S.sheet) });
        return S.sheet;
      },
      sheet: () => (S.sheet ? ml.stats.summary(statsConfig, S.sheet) : null),
      /* There is deliberately no `train` or `award` here. A shell that
         wants a gesture to count as work sends the verb through `perform`
         and lets `stats.exertion` decide, so the change lands inside a
         turn, inside an undo frame, and in every shell at the same rate.
         A shell reaching in to nudge a stat directly is the bug this
         omission exists to prevent. */

      /* Encounters. `encounterAct` is the shell's door in; the parser
         shell reaches the same place by typing an action's name. */
      encounter: () => (S.encounter && !S.encounter.over
        ? Object.assign({}, S.encounter, { actions: encounterActions() })
        : null),
      encounterAct(actionId) {
        const before = digest();
        const result = encounterAct(actionId);
        const changed = changedBetween(before, digest());
        const full = Object.assign({}, result, { action: { verb: 'encounter', target: actionId }, changed, refresh: ['scene', 'hud', 'character', 'encounter'] });
        bus.emit('turn', full);
        return full;
      },
      startEncounter,

      serialize: () => JSON.stringify(Object.assign({}, S, { prev: [] })),
      restore(json) {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        S = Object.assign(fresh(), data);
        S.prev = [];
        rebind();
        return true;
      }
    };

    return api;

    function describeObject(id) {
      const o = world.object(id);
      if (!o) return null;
      return {
        id, name: o.name || id, desc: o.desc || '', examine: o.examine || '',
        takeable: !!o.takeable, container: !!o.container,
        open: world.isOpen(id), locked: world.isLocked(id), lit: world.isLit(id),
        carried: world.carrying(id), here: world.looseHere(id),
        treasure: isTreasure(id),
        contents: o.container ? world.contentsOf(id).slice() : []
      };
    }
  }

  ml.runtime = { create, UNDO_DEPTH };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
