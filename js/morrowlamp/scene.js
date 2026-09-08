/* ============================================================
   MORROWLAMP MACHINE — semantic scene adapter
   A small, JSON-safe vocabulary for Workshop-authored pictures.

   Developer cartridges may still provide painter functions. Data
   cartridges provide a room map under presentation.art.scene and this
   adapter interprets it through the active display profile.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  const ENVIRONMENTS = ['stone_chamber', 'wood_room', 'cave', 'deck'];
  const PERSPECTIVES = ['interior', 'exterior', 'corridor'];
  const POSITIONS = ['north', 'south', 'east', 'west', 'center', 'left_wall', 'right_wall', 'far', 'foreground'];
  const FEATURES = ['door', 'torch', 'table', 'crate', 'window', 'stairs', 'water'];
  const STYLES = ['plain', 'wood', 'iron', 'stone'];

  const POSITION_POINTS = {
    north: [160, 62], south: [160, 156], east: [270, 112], west: [50, 112],
    center: [160, 112], left_wall: [62, 104], right_wall: [258, 104],
    far: [160, 76], foreground: [160, 154]
  };

  function plain(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function point(position) { return POSITION_POINTS[position] || POSITION_POINTS.center; }

  function sceneObject(cartridge, roomId, spec) {
    const world = cartridge.world || {};
    const room = (world.rooms || {})[roomId] || {};
    const data = plain(spec) ? spec : {};
    const features = Array.isArray(data.features) ? data.features : [];
    const spots = [];
    const claimed = new Set();

    features.forEach((feature) => {
      if (!plain(feature) || !feature.object) return;
      const p = point(feature.position);
      claimed.add(feature.object);
      spots.push({
        id: feature.object, x: p[0], y: p[1], w: feature.type === 'door' ? 42 : 28,
        h: feature.type === 'door' ? 70 : 28, walkTo: [160, 174],
        icon: feature.type !== 'door' && feature.type !== 'stairs', iconAt: p
      });
    });

    /* Objects remain usable even when an author has not decorated every
       one. Stable placement makes a data cartridge playable while it is
       still being assembled in the Workshop. */
    const objects = world.objects || {};
    const loose = Object.keys(objects).filter((id) => {
      const o = objects[id] || {};
      const homes = Array.isArray(o.at) ? o.at : [o.at];
      return homes.includes(roomId) && !claimed.has(id);
    });
    loose.forEach((id, index) => {
      const p = [68 + (index % 5) * 48, 150 + Math.floor(index / 5) * 12];
      spots.push({ id, x: p[0], y: p[1], w: 24, h: 24, walkTo: [160, 174], icon: true, iconAt: p });
    });

    const exits = [];
    const roomExits = room.exits || {};
    Object.keys(roomExits).forEach((dir) => {
      const edge = {
        n: [126, 0, 68, 28], s: [126, 172, 68, 28],
        e: [292, 62, 28, 76], w: [0, 62, 28, 76],
        u: [226, 52, 70, 58], d: [24, 52, 70, 58]
      }[dir] || [140, 0, 40, 24];
      exits.push({ dir, x: edge[0], y: edge[1], w: edge[2], h: edge[3], walkTo: [160, 174] });
    });

    const entry = { start: [160, 174] };
    Object.keys(roomExits).forEach((dir) => {
      entry[dir] = ({ n: [160, 150], s: [160, 150], e: [270, 150], w: [50, 150], u: [210, 150], d: [110, 150] }[dir] || [160, 150]);
    });

    return {
      semantic: data,
      entry,
      spots,
      exits,
      paint(g) { paint(g, data); }
    };
  }

  function paint(g, spec) {
    const env = spec.environment || 'stone_chamber';
    const perspective = spec.perspective || 'interior';
    const C = g.C;
    const sx = g.W / 320, sy = g.H / 200;
    const px = (x, y, w, h, c) => g.px(x * sx, y * sy, w * sx, h * sy, c);
    const line = (a, b, c, d, colour) => g.line(a * sx, b * sy, c * sx, d * sy, colour);
    const ellipse = (x, y, rx, ry, colour) => g.ellipse(x * sx, y * sy, rx * sx, ry * sy, colour);

    if (env === 'cave') g.vgrad(0, 0, g.W, g.H, ['black', 'dkgray', 'black']);
    else if (env === 'deck' || perspective === 'exterior') g.vgrad(0, 0, g.W, Math.round(130 * sy), ['blue', 'ltblue', 'black']);
    else if (env === 'wood_room') g.vgrad(0, 0, g.W, g.H, ['brown', 'dkgray']);
    else g.vgrad(0, 0, g.W, g.H, ['dkgray', 'black']);

    const floorY = perspective === 'corridor' ? 126 : 138;
    px(0, floorY, 320, 200 - floorY, env === 'wood_room' ? C.brown : C.black);
    for (let i = 1; i < 7; i++) {
      const y = floorY + Math.round((200 - floorY) * i * i / 36);
      line(0, y, 320, y, env === 'wood_room' ? C.dkgray : C.dkgray);
    }
    for (let x = -160; x <= 480; x += 64) line(160, floorY, x, 200, C.dkgray);

    (spec.features || []).forEach((feature) => {
      if (!plain(feature)) return;
      const p = point(feature.position);
      const style = feature.style || 'plain';
      const base = C[style] || C.dkgray;
      switch (feature.type) {
        case 'door':
          px(p[0] - 22, p[1] - 45, 44, 70, base);
          px(p[0] - 17, p[1] - 40, 34, 60, C.black);
          px(p[0] + 10, p[1] - 10, 4, 5, C.yellow);
          break;
        case 'torch':
          line(p[0], p[1] + 24, p[0], p[1] - 4, base);
          px(p[0] - 4, p[1] - 12, 8, 8, feature.lit === false ? C.dkgray : C.yellow);
          if (feature.lit !== false) ellipse(p[0], p[1] - 16, 10, 12, C.yellow);
          break;
        case 'table':
          px(p[0] - 38, p[1] - 8, 76, 10, base);
          px(p[0] - 30, p[1] + 2, 7, 30, base); px(p[0] + 23, p[1] + 2, 7, 30, base);
          break;
        case 'crate':
          px(p[0] - 22, p[1] - 22, 44, 44, base);
          line(p[0] - 18, p[1] - 18, p[0] + 18, p[1] + 18, C.black);
          line(p[0] + 18, p[1] - 18, p[0] - 18, p[1] + 18, C.black);
          break;
        case 'window':
          px(p[0] - 30, p[1] - 24, 60, 42, C.black);
          px(p[0] - 25, p[1] - 19, 50, 32, C.ltblue);
          line(p[0], p[1] - 19, p[0], p[1] + 13, base);
          line(p[0] - 25, p[1] - 3, p[0] + 25, p[1] - 3, base);
          break;
        case 'stairs':
          for (let i = 0; i < 5; i++) px(p[0] - 30 + i * 6, p[1] - i * 7, 60 - i * 12, 5, base);
          break;
        case 'water':
          px(p[0] - 50, p[1] - 18, 100, 36, C.blue);
          for (let i = -35; i < 45; i += 20) line(p[0] + i, p[1], p[0] + i + 10, p[1], C.ltcyan);
          break;
        default: break;
      }
    });
  }

  function actor(g, x, y, options) {
    const C = g.C;
    const s = (options && options.scale) || 1;
    const p = (dx, dy, w, h, c) => g.px(x + dx * s, y + dy * s, Math.max(1, w * s), Math.max(1, h * s), c);
    p(-4, -28, 8, 8, C.brown); p(-6, -20, 12, 14, C.ltcyan);
    p(-8, -19, 3, 10, C.ltcyan); p(6, -19, 3, 10, C.ltcyan);
    p(-5, -7, 4, 7, C.dkgray); p(1, -7, 4, 7, C.dkgray);
    g.stipple(x - 8 * s, y + 1 * s, 16 * s, 3 * s, C.black, 0.5);
  }

  function item(g, id, x, y, scale) {
    const C = g.C;
    const s = scale || 1;
    g.px(x - 5 * s, y - 5 * s, 10 * s, 10 * s, C.white);
    g.px(x - 2 * s, y - 2 * s, 4 * s, 4 * s, C.yellow);
    void id;
  }

  function defaultScene(cartridge, roomId) {
    return sceneObject(cartridge, roomId, { environment: 'stone_chamber', perspective: 'interior', features: [] });
  }

  ml.scene = {
    ENVIRONMENTS, PERSPECTIVES, POSITIONS, FEATURES, STYLES,
    point, build: sceneObject, defaultScene, actor, item
  };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
