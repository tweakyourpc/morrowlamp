/* ============================================================
   MORROWLAMP MACHINE — the world model
   Rooms, exits, objects, containers, inventory, and the single
   authoritative answer to "where is that thing?".

   The world owns geography and possession. It does not own
   puzzles (rules.js), turns (runtime.js), or pixels (render.js).
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};
  const list = ml.list;

  const DIR_NAMES = {
    n: 'north', s: 'south', e: 'east', w: 'west',
    u: 'up', d: 'down', ne: 'northeast', nw: 'northwest',
    se: 'southeast', sw: 'southwest', in: 'in', out: 'out'
  };

  /* An exit is either a room id, or an object:
       { room, flagReq, flagNot, objReq, open, lit, deny }
     `room: null` means "there is scenery here but no way through".

     Gating FAILS CLOSED. If an exit names a requirement the Machine
     does not understand, the exit is shut. The old framework runtime
     ignored every requirement it did not recognise and cheerfully
     walked the player through locked doors; that bug does not get to
     travel forward into the Machine. */
  function exitTarget(exit) {
    return typeof exit === 'string' ? exit : (exit && exit.room) || null;
  }

  const KNOWN_EXIT_KEYS = ['room', 'flagReq', 'flagNot', 'objReq', 'open', 'lit', 'deny', 'note'];

  function create(def, state) {
    const rooms = def.rooms || {};
    const objects = def.objects || {};
    const S = state;

    function object(id) { return objects[id] || null; }
    function roomDef(id) { return rooms[id === undefined ? S.room : id] || null; }

    /* ---------- object state overlay ----------
       Static definitions stay pure data; every mutation lands in S.obj
       so a save file is a plain snapshot of the differences. */
    function st(id, key, dflt) {
      const o = S.obj[id];
      return o && ml.has(o, key) ? o[key] : dflt;
    }
    function setSt(id, key, value) {
      (S.obj[id] = S.obj[id] || {})[key] = value;
    }
    function isOpen(id) { const o = object(id); return !!o && st(id, 'open', o.open) === true; }
    function isLocked(id) { const o = object(id); return !!o && st(id, 'locked', o.locked) === true; }
    function isLit(id) {
      const o = object(id);
      if (!o) return false;
      /* A `light: true` object is lit unless something put it out;
         a `lightable` one is dark until somebody lights it. */
      return st(id, 'lit', o.light === true ? o.lit !== false : false) === true;
    }

    function contentsOf(id) {
      if (!(id in S.contents)) S.contents[id] = list((object(id) || {}).contents);
      return S.contents[id];
    }

    /* ---------- placement ----------
       `at` on an object definition is its home: a room id, a list of
       room ids (things visible from both ends of a ladder), 'inv' for
       start inventory, or absent when it begins inside a container. */
    function homeRooms(id) {
      const o = object(id);
      if (!o || o.at === undefined || o.at === null || o.at === 'inv') return [];
      return list(o.at);
    }

    function looseHere(id, rid) {
      const where = rid || S.room;
      if (S.moved[id]) {
        const dropped = S.loose[where];
        return !!dropped && dropped.includes(id);
      }
      if (homeRooms(id).includes(where)) return true;
      const dropped = S.loose[where];
      return !!dropped && dropped.includes(id);
    }

    /* 'inv' | <containerId> | null (null = loose in the world somewhere) */
    function locationOf(id) {
      if (S.inv.includes(id)) return 'inv';
      for (const cid of Object.keys(S.contents)) {
        if (S.contents[cid].includes(id)) return cid;
      }
      for (const cid in objects) {
        if (!objects[cid].container) continue;
        if (cid in S.contents) continue;
        if (list(objects[cid].contents).includes(id)) return cid;
      }
      return null;
    }

    /* Everything reachable from where the player is standing: loose in
       the room, or inside an open container that is itself in the room. */
    function itemsHere() {
      const out = [];
      for (const id in objects) {
        if (S.inv.includes(id)) continue;
        const loc = locationOf(id);
        if (loc === null) { if (looseHere(id)) out.push(id); continue; }
        if (looseHere(loc) && isOpen(loc)) out.push(id);
      }
      return out;
    }

    function carrying(id) { return S.inv.includes(id); }

    /* Present = carried, loose here, or inside an open container that is here. */
    function present(id) {
      if (!id) return false;
      if (carrying(id) || looseHere(id)) return true;
      const loc = locationOf(id);
      if (typeof loc === 'string' && loc !== 'inv') {
        return (looseHere(loc) || carrying(loc)) && isOpen(loc);
      }
      return false;
    }

    /* ---------- mutation ---------- */
    function detach(id) {
      if (carrying(id)) { S.inv.splice(S.inv.indexOf(id), 1); return; }
      const loc = locationOf(id);
      if (typeof loc === 'string' && loc !== 'inv') {
        const bag = contentsOf(loc);
        const i = bag.indexOf(id);
        if (i >= 0) bag.splice(i, 1);
        return;
      }
      for (const rid in S.loose) {
        const i = S.loose[rid].indexOf(id);
        if (i >= 0) S.loose[rid].splice(i, 1);
      }
      /* Leaving its home room is a move the save file has to remember,
         otherwise the object springs back the next time you walk in. */
      S.moved[id] = true;
    }

    function give(id) { detach(id); if (!S.inv.includes(id)) S.inv.push(id); }
    function dropAt(id, rid) {
      detach(id);
      const where = rid || S.room;
      (S.loose[where] = S.loose[where] || []).push(id);
      S.moved[id] = true;
    }
    function placeIn(id, containerId) {
      detach(id);
      contentsOf(containerId).push(id);
      S.moved[id] = true;
    }
    function destroy(id) { detach(id); S.gone[id] = true; }

    /* ---------- movement ---------- */
    function exitsOf(rid) { return (roomDef(rid) || {}).exits || {}; }

    function canGo(dir) {
      const e = exitsOf()[dir];
      if (!e) return { ok: false, deny: null };
      if (typeof e === 'string') return rooms[e] ? { ok: true, room: e } : { ok: false, deny: null };

      const target = e.room;
      if (!target || !rooms[target]) return { ok: false, deny: e.deny || null };

      for (const key in e) {
        if (!KNOWN_EXIT_KEYS.includes(key)) {
          /* Fail closed on anything unrecognised rather than waving it through. */
          return { ok: false, deny: e.deny || 'That way is shut.' };
        }
      }
      if (e.flagReq && !S.flags[e.flagReq]) return { ok: false, deny: e.deny || null, room: target };
      if (e.flagNot && S.flags[e.flagNot]) return { ok: false, deny: e.deny || null, room: target };
      if (e.objReq) {
        if (!object(e.objReq)) return { ok: false, deny: e.deny || 'That way is shut.' };
        if (e.open !== undefined && isOpen(e.objReq) !== !!e.open) return { ok: false, deny: e.deny || null, room: target };
        if (e.lit !== undefined && isLit(e.objReq) !== !!e.lit) return { ok: false, deny: e.deny || null, room: target };
      }
      return { ok: true, room: target };
    }

    function hasLight(rid) {
      const r = roomDef(rid);
      if (!r || !r.dark) return true;
      for (const id of S.inv.concat(itemsHere())) {
        const o = object(id);
        if (!o) continue;
        if ((o.light === true || o.lightable === true) && isLit(id)) return true;
      }
      return false;
    }

    return {
      def, rooms, objects, DIR_NAMES,
      object, roomDef, exitsOf, exitTarget,
      st, setSt, isOpen, isLocked, isLit, contentsOf,
      homeRooms, looseHere, locationOf, itemsHere, carrying, present,
      give, dropAt, placeIn, destroy, detach,
      canGo, hasLight,
      dirName: (d) => DIR_NAMES[d] || d
    };
  }

  ml.world = { create, exitTarget, DIR_NAMES, KNOWN_EXIT_KEYS };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
