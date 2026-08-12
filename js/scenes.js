/* ============================================================
   THE SUNKEN CROWN — scenes
   One painter per room, drawn in code against the EGA palette.
   Also carries the click data: walkable floor, hotspots (which
   map to world.js object ids), exit zones and entry points.
   Pure data + draw functions — no load-time canvas dependency.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};

  /* ---------------- shared scenery helpers ---------------- */

  /* A dressed stone wall with mortar and a little damp staining. */
  function stoneWall(g, x, y, w, h, face, mortar, seed) {
    g.brick(x, y, w, h, face, mortar, 22, 11);
    g.speck(x, y, w, h, mortar, 0.03, seed || 11);
  }

  /* A recessed doorway; returns nothing, purely decorative. */
  function doorway(g, x, y, w, h, jamb, dark) {
    g.px(x - 2, y - 2, w + 4, h + 2, jamb);
    g.px(x, y, w, h, dark);
    g.stipple(x, y, w, Math.min(h, 8), jamb, 0.4);
  }

  /* Wall torch with a dithered halo. */
  function torch(g, x, y, t) {
    const C = g.C;
    g.px(x - 1, y, 2, 8, C.brown);
    const flick = 1 + Math.sin((t || 0) / 90) * 0.5;
    g.stipple(x - 7, y - 10, 14, 14, C.yellow, 0.22);
    g.px(x - 2, y - 5 - flick, 4, 5, C.ltred);
    g.px(x - 1, y - 6 - flick, 2, 4, C.yellow);
    g.px(x - 1, y - 7 - flick, 1, 2, C.white);
  }

  /* Dusty shaft of light from an unseen window. */
  function lightShaft(g, x1, x2, x3, x4, ytop, ybot, c) {
    g.ctx.save();
    g.ctx.beginPath();
    g.ctx.moveTo(x1, ytop); g.ctx.lineTo(x2, ytop);
    g.ctx.lineTo(x4, ybot); g.ctx.lineTo(x3, ybot);
    g.ctx.closePath();
    g.ctx.clip();
    g.stipple(0, ytop, 320, ybot - ytop, c, 0.18);
    g.ctx.restore();
  }

  const S = {};
  const scene = (id, def) => { S[id] = def; };

  /* ============================================================
     ABOVE GROUND
     ============================================================ */

  scene('yard', {
    music: 'manor',
    scale: [138, 0.55, 190, 1.0],
    walk: [[14, 138, 292, 54]],
    entry: { start: [118, 172], s: [160, 150], u: [214, 176], d: [214, 176] },
    paint(g, f) {
      const C = g.C;
      // Flat overcast dithering to mist. This has to reach all the way
      // down to the ground line, or the strips either side of the manor
      // are left unpainted.
      g.vgrad(0, 0, 320, 138, ['ltgray', 'ltgray', 'white']);
      // treeline, standing on the ground line behind the house
      for (let x = -6; x < 330; x += 13) {
        const h = 24 + ((x * 7) % 16);
        g.poly([[x, 138], [x + 6, 138 - h], [x + 12, 138]], C.green);
      }
      g.stipple(0, 106, 320, 32, C.white, 0.4);                // mist pooling in the trees
      // the manor: three storeys of grey indifference
      g.px(40, 26, 240, 112, C.dkgray);
      stoneWall(g, 40, 40, 240, 98, C.dkgray, C.black, 5);
      g.poly([[30, 42], [160, 8], [290, 42]], C.brown);        // roof
      for (let ry = 12; ry < 42; ry += 5) {                    // shingle courses
        const k = (42 - ry) * (130 / 34);
        g.px(30 + k, ry, 260 - 2 * k, 1, C.black);
      }
      g.px(150, 4, 12, 18, C.dkgray);                          // chimney
      g.px(148, 2, 16, 4, C.ltgray);
      // windows, all of them dark
      for (const [wx, wy] of [[64, 56], [104, 56], [196, 56], [236, 56], [64, 96], [236, 96]]) {
        g.px(wx, wy, 20, 26, C.black);
        g.px(wx + 9, wy, 2, 26, C.dkgray);
        g.px(wx, wy + 12, 20, 2, C.dkgray);
        g.stipple(wx, wy, 20, 10, C.ltblue, 0.2);
      }
      doorway(g, 142, 92, 26, 46, C.brown, C.black);           // front door, north
      g.px(152, 112, 3, 3, C.yellow);
      // ground
      g.vgrad(0, 138, 320, 62, ['brown', 'dkgray']);
      g.speck(0, 138, 320, 62, C.black, 0.05, 21);
      g.speck(0, 138, 320, 62, C.ltgray, 0.025, 77);
      // gateposts and the road curling east
      g.px(6, 108, 12, 46, C.ltgray); g.px(4, 104, 16, 6, C.dkgray);
      g.poly([[300, 140], [320, 138], [320, 176], [286, 160]], C.ltgray);
      g.stipple(286, 138, 34, 40, C.brown, 0.4);
      // the dry well, east side
      g.ellipse(246, 168, 26, 11, C.dkgray);
      g.ellipse(246, 166, 22, 8, C.black);
      stoneWall(g, 222, 150, 48, 18, C.ltgray, C.dkgray, 3);
      g.px(224, 146, 4, 22, C.brown); g.px(264, 146, 4, 22, C.brown);
      g.px(220, 142, 52, 5, C.brown);
      g.stipple(232, 160, 28, 10, C.yellow, 0.28);             // glow from below
      // mailbox on its crooked post
      g.px(38, 132, 4, 22, C.brown);
      g.px(28, 118, 24, 15, C.ltred);
      g.px(28, 118, 24, 3, C.red);
      g.px(50, 122, 3, 7, C.dkgray);
    },
    spots: [
      { id: 'well', x: 216, y: 138, w: 60, h: 36, walkTo: [214, 176] },
      { id: 'mailbox', x: 26, y: 116, w: 28, h: 20, walkTo: [58, 160] },
      { id: 'door', x: 140, y: 90, w: 30, h: 48, walkTo: [156, 146], hint: 'the manor door' }
    ],
    exits: [
      { dir: 'n', x: 138, y: 88, w: 34, h: 52, walkTo: [156, 144] },
      { dir: 'e', x: 288, y: 136, w: 32, h: 44, walkTo: [286, 168] },
      { dir: 'd', x: 220, y: 140, w: 52, h: 32, walkTo: [214, 176] }
    ]
  });

  scene('porch', {
    music: 'manor',
    scale: [140, 0.6, 192, 1.0],
    walk: [[18, 140, 284, 52]],
    entry: { start: [90, 170], n: [160, 178], s: [160, 150] },
    paint(g) {
      const C = g.C;
      g.vgrad(0, 0, 320, 30, ['black', 'dkgray']);             // porch ceiling
      g.px(0, 26, 320, 6, C.brown);
      // house wall behind
      stoneWall(g, 0, 32, 320, 108, C.dkgray, C.black, 9);
      // posts holding the roof up, mostly
      for (const px of [10, 300]) {
        g.px(px, 30, 12, 112, C.brown);
        g.stipple(px, 30, 4, 112, C.black, 0.4);
      }
      // the iron-banded door
      doorway(g, 132, 56, 48, 84, C.brown, C.brown);
      g.px(132, 56, 48, 84, C.brown);
      g.stipple(132, 56, 48, 84, C.black, 0.22);
      for (const by of [66, 92, 120]) {
        g.px(130, by, 52, 6, C.dkgray);
        g.speck(130, by, 52, 6, C.black, 0.2, by);
      }
      g.circle(170, 100, 3, C.yellow);                         // handle, worn smooth
      g.px(154, 56, 4, 84, C.black);
      // swinging chair that has not swung
      g.px(232, 30, 2, 34, C.dkgray); g.px(268, 30, 2, 34, C.dkgray);
      g.px(226, 64, 50, 8, C.brown);
      g.px(226, 60, 50, 5, C.red);
      g.px(226, 72, 4, 10, C.brown); g.px(272, 72, 4, 10, C.brown);
      // warped boards
      g.vgrad(0, 140, 320, 60, ['brown', 'dkgray']);
      for (let x = 0; x < 320; x += 18) g.px(x, 140, 1, 60, C.black);
      for (let y = 146; y < 200; y += 13) g.stipple(0, y, 320, 1, C.black, 0.5);
      g.speck(0, 140, 320, 60, C.black, 0.05, 31);
      // doormat, doing its best
      g.px(134, 152, 44, 16, C.brown);
      g.px(134, 152, 44, 3, C.dkgray);
      g.speck(136, 154, 40, 12, C.black, 0.22, 4);
      g.px(146, 158, 22, 3, C.dkgray);
    },
    spots: [
      { id: 'door', x: 130, y: 54, w: 52, h: 88, walkTo: [156, 150] },
      { id: 'doormat', x: 132, y: 150, w: 48, h: 20, walkTo: [156, 176] }
    ],
    exits: [
      { dir: 'n', x: 130, y: 54, w: 52, h: 88, walkTo: [156, 150] },
      { dir: 's', x: 0, y: 182, w: 320, h: 18, walkTo: [160, 188] }
    ]
  });

  scene('hall', {
    music: 'manor',
    scale: [132, 0.55, 192, 1.0],
    walk: [[16, 132, 288, 60]],
    entry: { start: [70, 170], n: [160, 180], w: [232, 158], e: [88, 158], u: [160, 160], d: [160, 160] },
    paint(g, f) {
      const C = g.C;
      g.vgrad(0, 0, 320, 40, ['black', 'dkgray']);             // high ceiling
      stoneWall(g, 0, 24, 320, 108, C.dkgray, C.black, 13);
      g.stipple(0, 24, 320, 40, C.black, 0.3);
      // dusty light from a window we never see
      lightShaft(g, 96, 132, 60, 150, 24, 132, C.yellow);
      // side doorways
      doorway(g, 8, 62, 34, 70, C.brown, C.black);             // west, study
      doorway(g, 278, 62, 34, 70, C.brown, C.black);           // east, kitchen
      g.stipple(10, 64, 30, 66, C.brown, 0.15);
      g.stipple(280, 64, 30, 66, C.red, 0.12);
      // the glass trophy cabinet, north wall
      g.px(112, 54, 96, 78, C.brown);
      g.px(116, 58, 88, 66, C.black);
      g.stipple(116, 58, 88, 66, C.ltcyan, 0.16);              // glass sheen
      for (let i = 0; i < 3; i++) g.px(116, 78 + i * 20, 88, 2, C.brown);
      g.px(158, 58, 2, 66, C.brown);
      g.px(112, 128, 96, 6, C.dkgray);
      // grandfather clock, stopped at 11:41 forever
      g.px(228, 40, 30, 92, C.brown);
      g.stipple(228, 40, 30, 92, C.black, 0.25);
      g.px(232, 46, 22, 24, C.black);
      g.circle(243, 58, 9, C.ltgray);
      g.circle(243, 58, 7, C.white);
      g.line(243, 58, 243, 52, C.black);                       // 11
      g.line(243, 58, 248, 61, C.black);                       // 41
      g.px(232, 76, 22, 50, C.black);
      if (f.clockOpen) g.stipple(232, 76, 22, 50, C.yellow, 0.2);
      else g.px(240, 96, 6, 20, C.yellow);                     // pendulum, still
      // chandelier, slumped
      g.px(150, 0, 2, 20, C.dkgray);
      g.px(132, 18, 38, 4, C.ltgray);
      for (const cx of [136, 150, 164]) {
        g.px(cx, 22, 2, 6, C.ltgray);
        g.px(cx - 1, 26, 4, 4, C.ltcyan);
      }
      g.stipple(126, 14, 50, 20, C.white, 0.12);
      // floor
      g.vgrad(0, 132, 320, 68, ['dkgray', 'black']);
      for (let x = -40; x < 360; x += 26) g.line(x, 200, 160 + (x - 160) * 0.35, 132, C.black);
      for (let y = 136; y < 200; y += 10) g.stipple(0, y, 320, 1, C.black, 0.4);
      // the trapdoor to the cellar
      const tx = 128, ty = 154;
      g.poly([[tx, ty], [tx + 62, ty], [tx + 74, ty + 30], [tx - 12, ty + 30]], C.brown);
      g.stipple(tx - 12, ty, 86, 30, C.black, f.hatchOpen ? 0.72 : 0.3);
      if (f.hatchOpen) {
        g.poly([[tx + 6, ty + 4], [tx + 56, ty + 4], [tx + 64, ty + 26], [tx - 2, ty + 26]], C.black);
        g.stipple(tx + 4, ty + 6, 60, 20, C.ltcyan, 0.1);
      } else {
        g.px(tx + 4, ty + 6, 54, 3, C.dkgray);
        g.px(tx + 2, ty + 18, 58, 3, C.dkgray);
        g.px(tx + 28, ty + 10, 8, 8, C.yellow);                // the lock
      }
    },
    spots: [
      { id: 'cabinet', x: 110, y: 52, w: 100, h: 82, walkTo: [160, 148] },
      { id: 'clock', x: 226, y: 38, w: 34, h: 96, walkTo: [226, 150] },
      { id: 'chandelier', x: 126, y: 0, w: 50, h: 34, walkTo: [150, 150] },
      { id: 'hatch', x: 114, y: 152, w: 88, h: 34, walkTo: [160, 190] },
      { id: 'brassKey', x: 238, y: 100, icon: true, walkTo: [226, 150] },
      { id: 'musicSheet', x: 250, y: 108, icon: true, walkTo: [226, 150] }
    ],
    exits: [
      { dir: 'w', x: 4, y: 58, w: 42, h: 78, walkTo: [40, 156] },
      { dir: 'e', x: 274, y: 58, w: 42, h: 78, walkTo: [280, 156] },
      { dir: 's', x: 0, y: 186, w: 320, h: 14, walkTo: [160, 190] },
      { dir: 'd', x: 114, y: 152, w: 88, h: 34, walkTo: [160, 190] }
    ]
  });

  scene('study', {
    music: 'manor',
    scale: [136, 0.58, 192, 1.0],
    walk: [[16, 136, 288, 56]],
    entry: { start: [120, 172], w: [278, 160] },
    paint(g, f) {
      const C = g.C;
      stoneWall(g, 0, 0, 320, 136, C.brown, C.black, 17);
      g.stipple(0, 0, 320, 136, C.black, 0.35);
      // bookshelves, floor to ceiling, west side
      g.px(4, 8, 104, 128, C.brown);
      for (let sy = 12; sy < 132; sy += 24) {
        g.px(6, sy + 20, 100, 4, C.dkgray);
        for (let bx = 8; bx < 104; bx += 5) {
          const h = 14 + ((bx * 3 + sy) % 5);
          const col = [C.red, C.green, C.blue, C.magenta, C.dkgray][(bx + sy) % 5];
          g.px(bx, sy + 20 - h, 4, h, col);
          g.px(bx, sy + 20 - h, 4, 2, C.yellow);
        }
      }
      // window with grey light
      g.px(240, 20, 56, 52, C.black);
      g.px(244, 24, 48, 44, C.ltgray);
      g.stipple(244, 24, 48, 44, C.white, 0.5);
      g.px(266, 20, 4, 52, C.brown); g.px(240, 42, 56, 4, C.brown);
      lightShaft(g, 244, 292, 210, 320, 68, 136, C.white);
      // the cold hearth
      g.px(132, 72, 76, 64, C.dkgray);
      g.px(140, 88, 60, 48, C.black);
      stoneWall(g, 132, 72, 76, 16, C.ltgray, C.dkgray, 2);
      g.speck(146, 118, 48, 16, C.dkgray, 0.3, 8);
      // portrait of a king hiding excellent news
      g.px(140, 6, 60, 60, C.yellow);
      g.px(144, 10, 52, 52, C.blue);
      g.ellipse(170, 34, 13, 16, C.ltred);                     // face
      g.px(160, 18, 20, 6, C.yellow);                          // crown
      g.px(162, 12, 3, 7, C.yellow); g.px(169, 10, 3, 9, C.yellow); g.px(176, 12, 3, 7, C.yellow);
      g.px(165, 32, 2, 2, C.black); g.px(174, 32, 2, 2, C.black);
      g.px(166, 42, 9, 2, C.brown);
      g.px(150, 50, 40, 12, C.red);
      g.px(154, 68, 32, 4, C.ltgray);                          // brass plate
      // the writing desk
      g.px(216, 100, 84, 12, C.brown);
      g.px(220, 112, 8, 30, C.brown); g.px(288, 112, 8, 30, C.brown);
      g.px(230, 112, 54, 16, C.brown);
      g.px(232, 116, 50, 9, C.black);                          // the drawer, open an inch
      g.stipple(232, 116, 50, 9, C.ltcyan, 0.15);
      // floor
      g.vgrad(0, 136, 320, 64, ['brown', 'black']);
      for (let x = -20; x < 340; x += 30) g.line(x, 200, 160 + (x - 160) * 0.4, 136, C.black);
      // faded rug
      g.ellipse(150, 176, 74, 22, C.red);
      g.ellipse(150, 176, 62, 16, C.brown);
      g.stipple(76, 154, 148, 44, C.black, 0.25);
      doorway(g, 300, 70, 20, 66, C.brown, C.black);
    },
    spots: [
      { id: 'lyre', x: 158, y: 82, w: 30, h: 22, walkTo: [168, 154], icon: true, iconAt: [172, 84] },
      { id: 'picture', x: 138, y: 4, w: 64, h: 64, walkTo: [168, 152] },
      { id: 'desk', x: 214, y: 98, w: 88, h: 46, walkTo: [252, 158] },
      { id: 'bookHistory', x: 4, y: 8, w: 106, h: 128, walkTo: [96, 160] },
      { id: 'bookMusic', x: 4, y: 60, w: 106, h: 40, walkTo: [96, 160], quiet: true },
      { id: 'bookSecurity', x: 4, y: 100, w: 106, h: 36, walkTo: [96, 160], quiet: true },
      { id: 'lens', x: 256, y: 120, icon: true, walkTo: [252, 158] }
    ],
    exits: [{ dir: 'e', x: 296, y: 66, w: 24, h: 72, walkTo: [288, 160] }]
  });

  scene('kitchen', {
    music: 'manor',
    scale: [138, 0.58, 192, 1.0],
    walk: [[16, 138, 288, 54]],
    entry: { start: [120, 170], e: [40, 160] },
    paint(g, f) {
      const C = g.C;
      stoneWall(g, 0, 0, 320, 138, C.ltgray, C.dkgray, 23);
      g.stipple(0, 0, 320, 138, C.black, 0.3);
      g.stipple(0, 0, 320, 40, C.black, 0.3);
      // window, moth-eaten curtain
      g.px(196, 22, 48, 46, C.black);
      g.px(200, 26, 40, 38, C.ltgray);
      g.stipple(200, 26, 40, 38, C.white, 0.45);
      g.px(190, 16, 60, 6, C.brown);
      g.px(192, 20, 26, 52, C.magenta);
      g.stipple(192, 20, 26, 52, C.black, 0.3);
      g.speck(192, 20, 26, 52, C.black, 0.18, 12);
      // black iron stove
      g.px(20, 62, 76, 76, C.black);
      g.px(16, 56, 84, 8, C.dkgray);
      g.px(28, 78, 40, 30, C.dkgray);
      g.px(32, 82, 32, 22, C.black);
      g.circle(48, 93, 6, C.dkgray);
      g.px(56, 40, 14, 22, C.dkgray);                          // flue
      g.px(30, 66, 8, 6, C.ltgray); g.px(48, 66, 8, 6, C.ltgray);
      // pantry, ajar in the corner
      doorway(g, 268, 50, 44, 88, C.brown, C.black);
      g.px(268, 50, 20, 88, C.brown);
      g.stipple(288, 52, 22, 84, C.ltcyan, 0.1);
      for (let sy = 62; sy < 132; sy += 22) g.px(290, sy, 20, 3, C.brown);
      // the table, and someone's unfinished business
      g.px(112, 106, 96, 8, C.brown);
      g.px(118, 114, 7, 28, C.brown); g.px(196, 114, 7, 28, C.brown);
      g.stipple(112, 106, 96, 8, C.white, 0.15);
      // floor: flagstones
      g.vgrad(0, 138, 320, 62, ['dkgray', 'black']);
      for (let y = 140, i = 0; y < 200; y += 12, i++) {
        g.px(0, y, 320, 1, C.black);
        for (let x = (i % 2) * 16; x < 320; x += 32) g.px(x, y, 1, 12, C.black);
      }
      g.speck(0, 138, 320, 62, C.ltgray, 0.03, 44);
    },
    spots: [
      { id: 'stove', x: 14, y: 40, w: 90, h: 100, walkTo: [72, 158] },
      { id: 'curtain', x: 188, y: 16, w: 34, h: 58, walkTo: [196, 156] },
      { id: 'pantry', x: 266, y: 48, w: 48, h: 92, walkTo: [262, 162] },
      { id: 'knife', x: 138, y: 100, icon: true, walkTo: [140, 152] },
      { id: 'loaf', x: 176, y: 100, icon: true, walkTo: [176, 152] },
      { id: 'candle', x: 298, y: 78, icon: true, walkTo: [262, 162] },
      { id: 'flour', x: 298, y: 112, icon: true, walkTo: [262, 162] }
    ],
    exits: [{ dir: 'w', x: 0, y: 60, w: 22, h: 78, walkTo: [24, 160] }]
  });

  /* ============================================================
     THE CELLAR AND THE WAY DOWN
     ============================================================ */

  scene('cellar', {
    music: 'under', dark: true,
    scale: [140, 0.6, 190, 1.0],
    walk: [[18, 140, 284, 52]],
    entry: { start: [160, 170], d: [160, 152], u: [160, 152], s: [160, 180], n: [160, 180] },
    paint(g, f) {
      const C = g.C;
      g.clear(C.black);
      stoneWall(g, 0, 0, 320, 140, C.dkgray, C.black, 29);
      g.stipple(0, 0, 320, 60, C.black, 0.45);
      // ladder up to the hall
      g.px(146, 0, 5, 44, C.brown); g.px(174, 0, 5, 44, C.brown);
      for (let y = 6; y < 44; y += 10) g.px(146, y, 33, 4, C.brown);
      g.stipple(140, 0, 46, 20, C.yellow, 0.16);
      // shelves of jars that forgot their contents' names
      g.px(6, 44, 92, 6, C.brown);
      g.px(6, 76, 92, 6, C.brown);
      g.px(6, 44, 5, 96, C.brown); g.px(92, 44, 5, 96, C.brown);
      for (let jx = 14; jx < 90; jx += 13) {
        g.px(jx, 32, 9, 12, C.green);
        g.stipple(jx, 32, 9, 12, C.black, 0.3);
        g.px(jx, 30, 9, 3, C.dkgray);
      }
      // wine rack, monuments to a party that ended centuries ago
      g.px(224, 62, 88, 78, C.brown);
      for (let ry = 66; ry < 136; ry += 18) {
        g.px(226, ry, 84, 2, C.dkgray);
        for (let rx = 230; rx < 306; rx += 20) {
          g.circle(rx + 7, ry + 9, 7, C.black);
          g.circle(rx + 7, ry + 9, 5, C.green);
          g.stipple(rx + 2, ry + 4, 12, 12, C.black, 0.3);
        }
      }
      // the crack that exhales a cold draft
      if (f.tunnelDug) {
        g.poly([[128, 138], [148, 62], [184, 58], [206, 138]], C.black);
        g.stipple(130, 60, 74, 78, C.dkgray, 0.18);
        g.stipple(136, 84, 62, 54, C.green, 0.1);
      } else {
        g.poly([[152, 138], [158, 76], [166, 62], [172, 78], [176, 138]], C.black);
        g.stipple(150, 62, 28, 76, C.ltcyan, 0.08);
      }
      // floor
      g.vgrad(0, 140, 320, 60, ['dkgray', 'black']);
      g.speck(0, 140, 320, 60, C.black, 0.12, 51);
      g.speck(0, 140, 320, 60, C.ltgray, 0.02, 52);
      // shovel, the honest tool of dishonest people
      g.px(104, 84, 4, 54, C.brown);
      g.px(98, 130, 16, 14, C.ltgray);
      g.stipple(98, 130, 16, 5, C.white, 0.4);
    },
    spots: [
      { id: 'shelves', x: 4, y: 28, w: 96, h: 114, walkTo: [70, 168] },
      { id: 'wineRack', x: 222, y: 60, w: 92, h: 82, walkTo: [244, 168] },
      { id: 'crack', x: 128, y: 58, w: 80, h: 82, walkTo: [166, 172] },
      { id: 'shovel', x: 96, y: 82, w: 20, h: 62, walkTo: [108, 168] },
      { id: 'oilJar', x: 30, y: 62, icon: true, walkTo: [70, 168] },
      { id: 'pitchPot', x: 62, y: 62, icon: true, walkTo: [70, 168] },
      { id: 'emptyBottle', x: 288, y: 100, icon: true, walkTo: [268, 168] }
    ],
    exits: [
      { dir: 'u', x: 140, y: 0, w: 46, h: 48, walkTo: [162, 150] },
      { dir: 's', x: 128, y: 58, w: 80, h: 84, walkTo: [166, 172], needs: 'tunnelDug' }
    ]
  });

  scene('tunnel', {
    music: 'under', dark: true,
    scale: [138, 0.6, 190, 1.0],
    walk: [[30, 138, 260, 54]],
    entry: { start: [160, 168], s: [160, 150], u: [160, 150], n: [160, 182], d: [160, 182] },
    paint(g) {
      const C = g.C;
      g.clear(C.black);
      // earth walls closing in
      g.vgrad(0, 0, 320, 140, ['brown', 'black']);
      g.speck(0, 0, 320, 140, C.black, 0.2, 61);
      g.poly([[0, 0], [0, 140], [56, 140], [96, 40], [96, 0]], C.black);
      g.poly([[320, 0], [320, 140], [264, 140], [224, 40], [224, 0]], C.black);
      g.stipple(56, 0, 208, 140, C.brown, 0.25);
      // grass from the ceiling, green as a held grudge
      for (let x = 90; x < 234; x += 4) {
        const h = 8 + ((x * 5) % 12);
        g.px(x, 0, 1, h, C.green);
        if (x % 12 === 0) g.px(x, 0, 1, h + 5, C.ltgreen);
      }
      // roots hanging like dusty curtains
      for (let i = 0; i < 9; i++) {
        const rx = 96 + i * 15;
        let y = 6;
        let x = rx;
        while (y < 60 + (i % 3) * 20) {
          g.px(x, y, 2, 4, C.brown);
          x += ((i + y) % 3) - 1;
          y += 4;
        }
      }
      // the way on, descending into a wetter dark
      g.ellipse(160, 130, 46, 40, C.black);
      g.stipple(120, 96, 80, 44, C.ltcyan, 0.06);
      // floor
      g.vgrad(0, 138, 320, 62, ['brown', 'black']);
      g.speck(0, 138, 320, 62, C.black, 0.16, 63);
      g.speck(0, 150, 320, 50, C.green, 0.02, 64);
    },
    spots: [],
    exits: [
      { dir: 'u', x: 0, y: 130, w: 320, h: 20, walkTo: [160, 146] },
      { dir: 's', x: 116, y: 96, w: 88, h: 60, walkTo: [160, 180] }
    ]
  });

  /* ============================================================
     THE SUNKEN HALLS
     ============================================================ */

  scene('caveMouth', {
    music: 'under',
    scale: [136, 0.5, 192, 1.0],
    walk: [[10, 136, 300, 56]],
    entry: { start: [80, 170], s: [160, 148], n: [160, 184], w: [40, 168], e: [280, 168] },
    paint(g, f) {
      const C = g.C;
      g.clear(C.black);
      g.vgrad(0, 0, 320, 136, ['black', 'dkgray']);
      // cavern roof, jagged
      g.poly([[0, 0], [320, 0], [320, 20], [270, 40], [220, 16], [160, 44], [96, 14], [44, 38], [0, 18]], C.black);
      g.speck(0, 20, 320, 90, C.black, 0.1, 71);
      // west: the shore, glowing faintly blue
      g.stipple(0, 96, 70, 60, C.ltcyan, 0.16);
      g.poly([[0, 100], [40, 112], [40, 176], [0, 176]], C.black);
      g.stipple(2, 104, 38, 70, C.ltblue, 0.2);
      // east: the collapse, on balance a good thing
      g.poly([[262, 130], [286, 92], [320, 108], [320, 176], [262, 176]], C.dkgray);
      g.speck(262, 92, 58, 84, C.black, 0.25, 72);
      // south: thirty feet of stubborn brass
      const gx = 108, gw = 104;
      g.px(gx - 8, 30, gw + 16, 110, C.dkgray);
      if (f.gatesOpen) {
        g.px(gx, 40, gw, 100, C.black);
        g.px(gx, 40, 16, 100, C.brown);                        // doors folded back
        g.px(gx + gw - 16, 40, 16, 100, C.brown);
        g.stipple(gx + 16, 40, gw - 32, 100, C.yellow, 0.1);
        g.stipple(gx + 16, 40, gw - 32, 100, C.brown, 0.12);
      } else {
        g.px(gx, 40, gw, 100, C.brown);
        g.stipple(gx, 40, gw, 100, C.yellow, 0.22);
        g.px(gx + gw / 2 - 1, 40, 2, 100, C.black);
        // relief of a kingdom sinking into a hill, depicted with relish
        g.ellipse(gx + 26, 104, 22, 12, C.dkgray);
        g.ellipse(gx + 78, 104, 22, 12, C.dkgray);
        for (const [tx, ty] of [[18, 88], [30, 82], [42, 90], [70, 90], [84, 84], [94, 92]]) {
          g.px(gx + tx, ty, 5, 16, C.dkgray);
          g.px(gx + tx, ty - 4, 5, 5, C.dkgray);
        }
        for (let by = 50; by < 138; by += 12) {
          g.px(gx + 4, by, 3, 3, C.yellow);
          g.px(gx + gw - 7, by, 3, 3, C.yellow);
        }
      }
      // the statue, mouth open as if she died mid-word
      const sx = 232;
      g.px(sx - 14, 128, 28, 12, C.ltgray);
      g.px(sx - 10, 78, 20, 52, C.ltgray);
      g.stipple(sx - 10, 78, 20, 52, C.dkgray, 0.35);
      g.ellipse(sx, 68, 9, 11, C.ltgray);
      g.px(sx - 3, 70, 6, 6, C.black);                         // the open mouth
      g.px(sx - 16, 84, 8, 34, C.ltgray);
      g.px(sx + 8, 84, 8, 34, C.ltgray);
      g.px(sx - 18, 126, 36, 4, C.dkgray);                     // inscription plate
      // floor
      g.vgrad(0, 136, 320, 64, ['dkgray', 'black']);
      g.speck(0, 136, 320, 64, C.black, 0.14, 73);
      g.speck(0, 136, 320, 64, C.ltgray, 0.02, 74);
      g.stipple(0, 150, 60, 50, C.ltcyan, 0.1);
    },
    spots: [
      { id: 'gates', x: 100, y: 28, w: 120, h: 114, walkTo: [160, 158] },
      { id: 'gates', x: 214, y: 60, w: 36, h: 80, walkTo: [214, 158], alias: 'statue' }
    ],
    exits: [
      { dir: 'n', x: 0, y: 184, w: 320, h: 16, walkTo: [160, 188] },
      { dir: 'w', x: 0, y: 100, w: 42, h: 78, walkTo: [24, 170] },
      { dir: 'e', x: 276, y: 100, w: 44, h: 78, walkTo: [292, 170] },
      { dir: 's', x: 100, y: 28, w: 120, h: 114, walkTo: [160, 152], needs: 'gatesOpen' }
    ]
  });

  scene('gatePassage', {
    music: 'throne', dark: true,
    scale: [140, 0.55, 192, 1.0],
    walk: [[24, 140, 272, 52]],
    entry: { start: [90, 170], s: [160, 150], n: [160, 184], w: [60, 168], e: [260, 168] },
    paint(g, f) {
      const C = g.C;
      g.clear(C.black);
      // riveted brass, warm as a struck bell
      g.vgrad(0, 0, 320, 140, ['brown', 'black']);
      g.stipple(0, 0, 320, 140, C.yellow, 0.14);
      // perspective ribs running south
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const w = 300 - t * 200, h = 130 - t * 86;
        const x = 160 - w / 2, y = 6 + t * 40;
        g.px(x, y, 4, h, C.dkgray);
        g.px(x + w - 4, y, 4, h, C.dkgray);
        g.px(x, y, w, 4, C.dkgray);
        for (let ry = y + 8; ry < y + h; ry += 14) {
          g.px(x + 1, ry, 2, 2, C.yellow);
          g.px(x + w - 3, ry, 2, 2, C.yellow);
        }
      }
      g.px(140, 46, 40, 96, C.black);                          // the dark it runs into
      g.stipple(140, 46, 40, 96, C.brown, 0.12);
      // corridor opening west
      doorway(g, 6, 66, 40, 74, C.dkgray, C.black);
      g.stipple(8, 68, 36, 70, C.ltcyan, 0.1);
      torch(g, 268, 60);
      // floor
      g.vgrad(0, 140, 320, 60, ['brown', 'black']);
      g.stipple(0, 140, 320, 60, C.yellow, 0.08);
      for (let x = -60; x < 380; x += 34) g.line(x, 200, 160 + (x - 160) * 0.3, 140, C.black);
    },
    spots: [],
    exits: [
      { dir: 'n', x: 0, y: 184, w: 320, h: 16, walkTo: [160, 190] },
      { dir: 's', x: 138, y: 44, w: 44, h: 98, walkTo: [160, 150] },
      { dir: 'w', x: 0, y: 62, w: 50, h: 80, walkTo: [40, 168] }
    ]
  });

  scene('guardroom', {
    music: 'throne', dark: true,
    scale: [138, 0.55, 192, 1.0],
    walk: [[20, 138, 280, 54]],
    entry: { start: [80, 172], s: [160, 150], n: [160, 184], e: [70, 168], w: [250, 168] },
    paint(g, f) {
      const C = g.C;
      g.clear(C.black);
      stoneWall(g, 0, 0, 320, 138, C.dkgray, C.black, 83);
      g.stipple(0, 0, 320, 50, C.black, 0.4);
      // arms rack, because a guardroom should look like one
      g.px(16, 54, 4, 86, C.brown);
      g.px(16, 54, 64, 5, C.brown);
      for (const sx of [26, 44, 62]) {
        g.px(sx, 59, 3, 34, C.ltgray);
        g.px(sx - 4, 59, 11, 4, C.dkgray);
      }
      // the vault door, west: stamped, bolted, rusted
      const vx = 232;
      g.px(vx, 52, 68, 88, C.dkgray);
      if (f.vaultOpen) {
        g.px(vx + 6, 58, 56, 82, C.black);
        g.px(vx + 6, 58, 10, 82, C.ltgray);
        g.stipple(vx + 16, 58, 46, 82, C.ltcyan, 0.08);
      } else {
        g.px(vx + 6, 58, 56, 82, C.ltgray);
        g.stipple(vx + 6, 58, 56, 82, C.brown, 0.28);           // rust
        g.px(vx + 10, 74, 48, 8, C.dkgray);                     // VAULT plate
        g.speck(vx + 12, 76, 44, 4, C.black, 0.4, 5);
        for (let by = 62; by < 138; by += 12) {
          g.px(vx + 8, by, 3, 3, C.black);
          g.px(vx + 59, by, 3, 3, C.black);
        }
        g.circle(vx + 34, 108, 10, C.dkgray);                   // wheel
        g.circle(vx + 34, 108, 6, C.ltgray);
        g.line(vx + 24, 108, vx + 44, 108, C.dkgray);
        g.line(vx + 34, 98, vx + 34, 118, C.dkgray);
      }
      // the south door the sentinel is so serious about
      doorway(g, 132, 52, 56, 88, C.brown, C.black);
      g.stipple(134, 54, 52, 84, C.ltcyan, f.guardDancing ? 0.14 : 0.05);
      torch(g, 104, 42);
      torch(g, 216, 42);
      // floor
      g.vgrad(0, 138, 320, 62, ['dkgray', 'black']);
      for (let y = 142, i = 0; y < 200; y += 14, i++) {
        g.px(0, y, 320, 1, C.black);
        for (let x = (i % 2) * 20; x < 320; x += 40) g.px(x, y, 1, 14, C.black);
      }
    },
    spots: [
      { id: 'vaultDoor', x: 230, y: 50, w: 72, h: 92, walkTo: [222, 166] },
      { id: 'sentinel', x: 132, y: 46, w: 58, h: 96, walkTo: [128, 170] },
      { id: 'vaultKey', x: 176, y: 118, icon: true, walkTo: [150, 170], onlyIf: 'guardDancing' }
    ],
    exits: [
      { dir: 'n', x: 0, y: 184, w: 320, h: 16, walkTo: [160, 190] },
      { dir: 's', x: 130, y: 50, w: 60, h: 92, walkTo: [160, 152], needs: 'guardDancing' },
      { dir: 'w', x: 230, y: 50, w: 72, h: 92, walkTo: [222, 166] }
    ]
  });

  scene('throne', {
    music: 'throne', dark: true,
    scale: [140, 0.55, 192, 1.0],
    walk: [[20, 140, 280, 52]],
    entry: { start: [100, 172], s: [160, 152], n: [160, 184], d: [252, 168], u: [252, 168] },
    paint(g, f) {
      const C = g.C;
      g.clear(C.black);
      // black stone, vaulted so high the ceiling apologizes
      g.vgrad(0, 0, 320, 140, ['black', 'dkgray']);
      for (const cx of [40, 160, 280]) {
        g.px(cx - 14, 0, 28, 140, C.dkgray);
        g.stipple(cx - 14, 0, 10, 140, C.black, 0.45);
        g.stipple(cx + 6, 0, 8, 140, C.white, 0.06);
      }
      g.poly([[0, 0], [320, 0], [320, 26], [230, 6], [160, 30], [90, 6], [0, 26]], C.black);
      // the throne
      const tx = 160;
      g.px(tx - 34, 60, 68, 80, C.black);
      g.stipple(tx - 34, 60, 68, 80, C.dkgray, 0.3);
      g.px(tx - 40, 54, 80, 8, C.dkgray);
      g.px(tx - 40, 118, 80, 22, C.dkgray);
      g.stipple(tx - 40, 118, 80, 22, C.black, 0.35);
      g.px(tx - 26, 22, 52, 34, C.black);                      // high back
      g.stipple(tx - 26, 22, 52, 34, C.blue, 0.18);
      // the Sunken King, at last at rest, patient as arithmetic
      g.ellipse(tx, 74, 9, 10, C.ltgray);                      // skull
      g.px(tx - 4, 72, 3, 3, C.black); g.px(tx + 2, 72, 3, 3, C.black);
      g.px(tx - 4, 80, 9, 2, C.black);
      g.px(tx - 12, 84, 24, 30, C.magenta);                    // moth-eaten robes
      g.stipple(tx - 12, 84, 24, 30, C.black, 0.4);
      for (let i = 0; i < 4; i++) g.px(tx - 8, 90 + i * 5, 17, 2, C.ltgray);
      g.px(tx - 20, 88, 8, 24, C.ltgray); g.px(tx + 13, 88, 8, 24, C.ltgray);
      g.px(tx - 10, 114, 7, 24, C.ltgray); g.px(tx + 4, 114, 7, 24, C.ltgray);
      // the crown, on its cushion, entirely unguarded
      if (!f.crownTaken) {
        g.px(tx - 16, 142, 32, 12, C.red);
        g.stipple(tx - 16, 142, 32, 12, C.black, 0.25);
      }
      // stairs winding down behind the throne
      for (let i = 0; i < 5; i++) {
        g.px(236 + i * 2, 132 + i * 9, 62 - i * 4, 9, C.dkgray);
        g.px(236 + i * 2, 132 + i * 9, 62 - i * 4, 2, C.ltgray);
      }
      g.px(240, 128, 58, 8, C.black);
      torch(g, 60, 50); torch(g, 260, 50);
      // floor
      g.vgrad(0, 140, 320, 60, ['dkgray', 'black']);
      g.stipple(0, 140, 320, 60, C.blue, 0.08);
      for (let x = -60; x < 380; x += 40) g.line(x, 200, 160 + (x - 160) * 0.3, 140, C.black);
    },
    spots: [
      { id: 'throne', x: 120, y: 20, w: 80, h: 122, walkTo: [160, 168] },
      { id: 'crown', x: 160, y: 140, icon: true, walkTo: [160, 172] }
    ],
    exits: [
      { dir: 'n', x: 0, y: 184, w: 320, h: 16, walkTo: [160, 190] },
      { dir: 'd', x: 234, y: 126, w: 76, h: 56, walkTo: [252, 174] }
    ]
  });

  scene('tomb', {
    music: 'throne', dark: true,
    scale: [140, 0.6, 190, 1.0],
    walk: [[26, 140, 268, 50]],
    entry: { start: [230, 170], d: [252, 156], u: [252, 156] },
    paint(g, f) {
      const C = g.C;
      g.clear(C.black);
      // a round chamber hewn from living stone
      g.vgrad(0, 0, 320, 140, ['black', 'dkgray']);
      g.ellipse(160, 150, 168, 118, C.dkgray);
      g.stipple(0, 0, 320, 140, C.black, 0.35);
      g.speck(0, 0, 320, 140, C.black, 0.12, 91);
      for (let a = 0; a < 12; a++) {
        const ang = Math.PI + (a / 11) * Math.PI;
        g.line(160 + Math.cos(ang) * 150, 150 + Math.sin(ang) * 106, 160, 150, C.black);
      }
      // stairs back up
      for (let i = 0; i < 4; i++) g.px(250 + i * 3, 108 + i * 8, 54 - i * 6, 8, C.dkgray);
      // the sarcophagus
      const sx = 150, sy = 116;
      g.px(sx - 62, sy, 124, 44, C.ltgray);
      g.stipple(sx - 62, sy, 124, 44, C.dkgray, 0.28);
      g.px(sx - 66, sy - 8, 132, 10, C.white);
      g.stipple(sx - 66, sy - 8, 132, 10, C.ltgray, 0.4);
      if (f.sarcOpen) {
        g.px(sx - 58, sy - 6, 116, 12, C.black);
        g.px(sx - 20, sy - 14, 96, 10, C.white);               // lid shoved aside
        g.stipple(sx - 58, sy - 6, 116, 12, C.ltcyan, 0.1);
        g.px(sx - 40, sy - 2, 60, 5, C.ltgray);                // bones, tidily arranged
      } else {
        // a king carved considerably less tired than his skeleton
        g.ellipse(sx, sy - 4, 8, 5, C.white);
        g.px(sx - 5, sy - 2, 10, 3, C.ltgray);
        g.px(sx - 14, sy + 2, 28, 26, C.white);
        g.stipple(sx - 14, sy + 2, 28, 26, C.ltgray, 0.35);
        g.px(sx - 4, sy + 8, 9, 9, C.ltgray);                  // the ring, held to his chest
      }
      g.speck(sx - 62, sy, 124, 44, C.dkgray, 0.06, 92);
      // floor
      g.vgrad(0, 140, 320, 60, ['dkgray', 'black']);
      g.speck(0, 140, 320, 60, C.black, 0.14, 93);
    },
    spots: [
      { id: 'sarcophagus', x: 84, y: 106, w: 136, h: 56, walkTo: [150, 176] },
      { id: 'ring', x: 150, y: 112, icon: true, walkTo: [150, 176] }
    ],
    exits: [{ dir: 'u', x: 244, y: 100, w: 76, h: 60, walkTo: [258, 160] }]
  });

  scene('vault', {
    music: 'throne', dark: true,
    scale: [140, 0.6, 190, 1.0],
    walk: [[24, 140, 272, 50]],
    entry: { start: [100, 170], w: [268, 160], e: [268, 160] },
    paint(g, f) {
      const C = g.C;
      g.clear(C.black);
      stoneWall(g, 0, 0, 320, 140, C.dkgray, C.black, 97);
      g.stipple(0, 0, 320, 140, C.black, 0.3);
      // shelves of dust where the real treasures once stood
      for (const [bx, bw] of [[8, 96], [212, 96]]) {
        g.px(bx, 30, bw, 110, C.brown);
        g.stipple(bx, 30, bw, 110, C.black, 0.4);
        for (let sy = 44; sy < 138; sy += 24) {
          g.px(bx + 2, sy, bw - 4, 4, C.dkgray);
          g.stipple(bx + 4, sy - 6, bw - 8, 6, C.ltgray, 0.18);   // dust outlines
        }
      }
      // the pedestal
      g.px(140, 96, 40, 10, C.ltgray);
      g.px(148, 106, 24, 34, C.ltgray);
      g.stipple(148, 106, 24, 34, C.dkgray, 0.35);
      g.px(138, 136, 44, 8, C.dkgray);
      g.stipple(120, 60, 80, 80, C.ltgreen, 0.06);
      doorway(g, 292, 60, 28, 80, C.dkgray, C.black);
      g.vgrad(0, 140, 320, 60, ['dkgray', 'black']);
      g.speck(0, 140, 320, 60, C.ltgray, 0.04, 98);
    },
    spots: [{ id: 'scepter', x: 160, y: 88, icon: true, walkTo: [160, 168] }],
    exits: [{ dir: 'e', x: 288, y: 56, w: 32, h: 86, walkTo: [280, 164] }]
  });

  scene('mirrorHall', {
    music: 'under', dark: true,
    scale: [140, 0.6, 190, 1.0],
    walk: [[26, 140, 268, 50]],
    entry: { start: [160, 170], w: [268, 162], e: [52, 162] },
    paint(g, f) {
      const C = g.C;
      g.clear(C.black);
      stoneWall(g, 0, 0, 320, 140, C.dkgray, C.black, 101);
      // every wall a mirror; a dozen of you, none blinking together
      for (let i = 0; i < 5; i++) {
        const mx = 8 + i * 62;
        g.px(mx, 26, 52, 108, C.ltgray);
        g.px(mx + 3, 29, 46, 102, C.black);
        g.stipple(mx + 3, 29, 46, 102, C.ltcyan, 0.14);
        g.stipple(mx + 3, 29, 46, 40, C.white, 0.1);
        // a faint standing figure in each, slightly wrong
        g.stipple(mx + 20, 66, 12, 44, C.ltgray, 0.3);
        g.stipple(mx + 21, 56, 10, 10, C.ltgray, 0.35);
      }
      // the west mirror does not quite reflect the torchlight
      const wx = 8;
      if (f.mirrorOpened) {
        g.px(wx + 3, 29, 46, 102, C.black);
        g.px(wx + 3, 29, 8, 102, C.ltgray);
        g.stipple(wx + 11, 29, 38, 102, C.ltmagenta, 0.08);
      } else {
        g.px(wx + 3, 29, 46, 102, C.black);
        g.stipple(wx + 3, 29, 46, 102, C.blue, 0.12);
        if (f.flourRevealed) {
          g.px(wx, 24, 56, 3, C.white);                        // flour tracing a door
          g.px(wx, 132, 56, 3, C.white);
          g.px(wx - 2, 24, 3, 111, C.white);
          g.px(wx + 52, 24, 3, 111, C.white);
          g.speck(wx - 6, 20, 66, 122, C.white, 0.06, 6);
        }
      }
      torch(g, 160, 40);
      g.vgrad(0, 140, 320, 60, ['dkgray', 'black']);
      g.stipple(0, 140, 320, 60, C.ltcyan, 0.06);
      for (let x = -40; x < 360; x += 30) g.line(x, 200, 160 + (x - 160) * 0.3, 140, C.black);
    },
    spots: [{ id: 'mirror', x: 4, y: 24, w: 60, h: 114, walkTo: [56, 168] }],
    exits: [
      { dir: 'e', x: 288, y: 60, w: 32, h: 82, walkTo: [280, 166] },
      { dir: 'w', x: 4, y: 24, w: 60, h: 114, walkTo: [56, 168], needs: 'mirrorOpened' }
    ]
  });

  scene('mirrorSanctum', {
    music: 'lake', dark: true,
    scale: [142, 0.62, 190, 1.0],
    walk: [[40, 142, 240, 48]],
    entry: { start: [100, 172], w: [258, 164], e: [258, 164] },
    paint(g, f) {
      const C = g.C;
      g.clear(C.black);
      stoneWall(g, 0, 0, 320, 142, C.dkgray, C.black, 103);
      g.stipple(0, 0, 320, 142, C.black, 0.45);
      // the brass altar
      g.px(126, 104, 68, 12, C.brown);
      g.px(136, 116, 48, 26, C.brown);
      g.stipple(136, 116, 48, 26, C.black, 0.3);
      g.px(122, 100, 76, 6, C.yellow);
      g.stipple(122, 100, 76, 6, C.white, 0.3);
      // the idol's own internal weather lights the room
      if (!f.idolTaken) {
        g.stipple(96, 44, 128, 100, C.ltcyan, 0.14);
        g.stipple(116, 60, 88, 76, C.white, 0.1);
      }
      doorway(g, 292, 66, 28, 76, C.dkgray, C.black);
      g.vgrad(0, 142, 320, 58, ['dkgray', 'black']);
      g.stipple(0, 142, 320, 58, C.ltcyan, 0.08);
    },
    spots: [{ id: 'idol', x: 160, y: 92, icon: true, walkTo: [160, 172] }],
    exits: [{ dir: 'e', x: 288, y: 62, w: 32, h: 82, walkTo: [278, 168] }]
  });

  /* ============================================================
     THE SUNKEN LAKE
     ============================================================ */

  scene('lakeShore', {
    music: 'lake',
    scale: [150, 0.62, 192, 1.0],
    walk: [[14, 150, 292, 42]],
    entry: { start: [90, 176], w: [250, 172], e: [60, 172] },
    paint(g, f) {
      const C = g.C;
      g.clear(C.black);
      // roof glow fading back to black at the far shore — this has to
      // reach the waterline or a band of raw canvas shows through
      g.vgrad(0, 0, 320, 96, ['black', 'blue', 'black']);
      g.speck(0, 0, 320, 58, C.ltcyan, 0.01, 111);             // fungi on the roof
      // the far island, and something small and golden on it
      g.ellipse(72, 96, 46, 12, C.dkgray);
      g.px(66, 78, 10, 18, C.ltgray);
      g.px(62, 74, 18, 5, C.ltgray);
      g.px(69, 68, 5, 6, C.yellow);
      g.stipple(58, 62, 30, 22, C.yellow, 0.14);
      // the lake, black as ink, glowing faintly blue
      g.vgrad(0, 96, 320, 60, ['blue', 'black']);
      g.stipple(0, 96, 320, 60, C.ltblue, 0.12);
      for (let y = 100; y < 154; y += 4) {
        const w = 10 + ((y * 7) % 40);
        g.stipple((y * 13) % 280, y, w, 1, C.ltcyan, 0.5);
        g.stipple((y * 29) % 260, y + 2, w / 2, 1, C.white, 0.35);
      }
      g.stipple(40, 88, 70, 16, C.ltcyan, 0.2);                // reflection of the islet
      // phosphorescent fungi along the shore
      for (let i = 0; i < 26; i++) {
        const fx = (i * 37) % 316, fy = 152 + ((i * 17) % 40);
        g.circle(fx, fy, 1 + (i % 2), C.ltcyan);
        g.stipple(fx - 4, fy - 4, 9, 9, C.ltcyan, 0.2);
      }
      // shore
      g.vgrad(0, 150, 320, 50, ['dkgray', 'black']);
      g.speck(0, 150, 320, 50, C.black, 0.12, 113);
      // the rotted rowboat, resigned
      const bx = 214, by = 158;
      g.poly([[bx - 44, by], [bx + 44, by], [bx + 32, by + 22], [bx - 32, by + 22]], C.brown);
      g.stipple(bx - 44, by, 88, 22, C.black, 0.35);
      g.px(bx - 40, by, 80, 4, C.dkgray);
      if (f.boatPatched) {
        g.ellipse(bx + 6, by + 12, 9, 6, C.black);
        g.stipple(bx - 4, by + 6, 22, 14, C.magenta, 0.4);     // curtain and pitch
        g.stipple(0, 150, 320, 20, C.ltcyan, 0.06);
      } else {
        g.ellipse(bx + 6, by + 12, 8, 6, C.black);
      }
      g.px(bx - 26, by + 4, 52, 3, C.dkgray);                  // thwart
      g.stipple(0, 96, 320, 8, C.white, 0.1);
    },
    spots: [
      { id: 'boat', x: 168, y: 154, w: 92, h: 30, walkTo: [196, 178] },
      { id: 'plinth', x: 46, y: 62, w: 52, h: 40, walkTo: [90, 168], quiet: true }
    ],
    exits: [
      { dir: 'e', x: 288, y: 150, w: 32, h: 50, walkTo: [282, 176] },
      { dir: 'w', x: 168, y: 154, w: 92, h: 30, walkTo: [196, 178], needs: 'boatPatched' }
    ]
  });

  scene('lakeIslet', {
    music: 'lake',
    scale: [144, 0.62, 190, 1.0],
    walk: [[40, 144, 240, 46]],
    entry: { start: [90, 176], w: [180, 168], e: [180, 168] },
    paint(g, f) {
      const C = g.C;
      g.clear(C.black);
      g.vgrad(0, 0, 320, 54, ['black', 'blue']);
      g.speck(0, 0, 320, 54, C.ltcyan, 0.01, 121);
      // water all around, right down to the frame edge
      g.vgrad(0, 54, 320, 146, ['blue', 'black']);
      g.stipple(0, 54, 320, 96, C.ltblue, 0.1);
      for (let y = 60; y < 148; y += 5) {
        g.stipple((y * 19) % 290, y, 14 + (y % 26), 1, C.ltcyan, 0.45);
      }
      // the islet: absurdly tidy for a thousand years alone
      g.ellipse(160, 168, 130, 34, C.green);
      g.stipple(30, 140, 260, 60, C.brown, 0.3);
      g.ellipse(160, 162, 118, 24, C.ltgreen);
      g.stipple(42, 140, 236, 44, C.green, 0.45);
      for (let i = 0; i < 60; i++) {
        const gx2 = 40 + (i * 41) % 240, gy = 150 + ((i * 13) % 38);
        g.px(gx2, gy, 1, 3 + (i % 3), C.green);
      }
      // the stone plinth
      g.px(146, 106, 28, 10, C.ltgray);
      g.px(152, 116, 16, 34, C.ltgray);
      g.stipple(152, 116, 16, 34, C.dkgray, 0.4);
      g.px(142, 146, 36, 8, C.dkgray);
      g.speck(142, 106, 36, 48, C.black, 0.06, 122);
      g.stipple(120, 76, 80, 46, C.yellow, 0.08);
    },
    spots: [
      { id: 'plinth', x: 138, y: 104, w: 44, h: 50, walkTo: [160, 176] },
      { id: 'chalice', x: 160, y: 96, icon: true, walkTo: [160, 176] }
    ],
    exits: [{ dir: 'e', x: 0, y: 150, w: 40, h: 50, walkTo: [46, 176] }]
  });

  scene('wellBottom', {
    music: 'manor',
    scale: [140, 0.62, 190, 1.0],
    walk: [[54, 140, 212, 50]],
    entry: { start: [130, 176], d: [160, 156], u: [160, 156] },
    paint(g, f) {
      const C = g.C;
      g.clear(C.black);
      // forty feet of stone and shadow above you
      g.vgrad(0, 0, 320, 140, ['black', 'dkgray']);
      g.poly([[0, 0], [46, 0], [70, 140], [0, 140]], C.black);
      g.poly([[320, 0], [274, 0], [250, 140], [320, 140]], C.black);
      stoneWall(g, 46, 0, 228, 140, C.dkgray, C.black, 131);
      g.stipple(46, 0, 228, 140, C.black, 0.4);
      // the circle of grey daylight, very far up
      g.ellipse(160, 4, 48, 9, C.ltgray);
      g.stipple(112, 0, 96, 16, C.white, 0.5);
      lightShaft(g, 116, 204, 66, 254, 6, 140, C.white);
      // the rusty ladder of dubious intent
      g.px(196, 0, 6, 140, C.brown);
      g.px(224, 0, 6, 140, C.brown);
      for (let y = 8; y < 140; y += 12) {
        g.px(196, y, 34, 4, C.brown);
        g.stipple(196, y, 34, 4, C.black, 0.3);
      }
      // floor of old leaves
      g.vgrad(0, 140, 320, 60, ['brown', 'black']);
      for (let i = 0; i < 90; i++) {
        const lx = (i * 53) % 320, ly = 142 + ((i * 29) % 56);
        g.ellipse(lx, ly, 4, 2, [C.brown, C.red, C.dkgray][i % 3]);
      }
      // the sunstone, a small piece of the sun the well swallowed
      if (!f.sunstoneTaken) {
        g.stipple(96, 140, 88, 54, C.yellow, 0.22);
        g.stipple(112, 152, 56, 34, C.yellow, 0.3);
      }
    },
    spots: [
      { id: 'well', x: 190, y: 0, w: 46, h: 142, walkTo: [200, 168], alias: 'ladder' },
      { id: 'sunstone', x: 138, y: 168, icon: true, walkTo: [148, 182] }
    ],
    exits: [{ dir: 'u', x: 188, y: 0, w: 50, h: 146, walkTo: [200, 168] }]
  });

  /* ---------------- lookup helpers ---------------- */

  /* Perspective scale for a floor position. */
  function scaleAt(sceneDef, y) {
    const [y0, s0, y1, s1] = sceneDef.scale || [140, 0.7, 190, 1.0];
    const t = Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
    return s0 + (s1 - s0) * t;
  }

  /* Art scale is intentionally separate from hitboxes. Scene painters use
     logical geometry, while actors and loose objects need a readable visual
     scale that can be tuned without changing gameplay coordinates. */
  function actorScale(sceneDef, y) {
    return scaleAt(sceneDef, y) * (sceneDef.actorScale || 1.16);
  }

  function itemScale(sceneDef, y) {
    const depth = scaleAt(sceneDef, y);
    return (sceneDef.itemScale || 1.0) * (0.9 + depth * 0.22);
  }

  /* Nearest walkable point to (x, y) — clamp rather than refuse. */
  function clampToWalk(sceneDef, x, y) {
    const boxes = sceneDef.walk || [[0, 140, 320, 56]];
    let best = null, bestD = Infinity;
    for (const [bx, by, bw, bh] of boxes) {
      const cx = Math.max(bx, Math.min(bx + bw, x));
      const cy = Math.max(by, Math.min(by + bh, y));
      const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
      if (d < bestD) { bestD = d; best = [cx, cy]; }
    }
    return best;
  }

  function inWalk(sceneDef, x, y) {
    for (const [bx, by, bw, bh] of (sceneDef.walk || [])) {
      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return true;
    }
    return false;
  }

  Z.scenes = { list: S, get: (id) => S[id], scaleAt, actorScale, itemScale, clampToWalk, inWalk };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
