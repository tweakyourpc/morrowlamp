/* ============================================================
   THE SUNKEN CROWN — sprites
   The actor is drawn parametrically so it can scale with
   perspective and be recoloured per class, like a classic
   adventure actor changing costume without changing the walk cycle.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};

  const CLASS_LOOK = {
    delver:  { tunic: 'red',    trim: 'yellow', legs: 'brown',  cloak: 'brown'  },
    scholar: { tunic: 'blue',   trim: 'ltcyan', legs: 'dkgray', cloak: 'blue'   },
    prowler: { tunic: 'green',  trim: 'ltgreen', legs: 'dkgray', cloak: 'green' }
  };

  /* Feet-anchored: (x, y) is where the boots meet the floor. */
  function drawActor(g, x, y, o) {
    const C = g.C;
    const look = CLASS_LOOK[o.cls] || CLASS_LOOK.delver;
    const s = o.scale || 1;
    const H = Math.max(12, Math.round(30 * s));
    const u = H / 30;                       // one "unit" of the 30px reference figure
    const P = (dx, dy, w, h, c) => g.px(x + dx * u, y + dy * u, Math.max(1, w * u), Math.max(1, h * u), c);

    const face = o.facing || 'down';
    const walking = !!o.walking;
    const fr = walking ? (o.frame % 4) : 0;
    // leg swing: frames 0..3 -> mid, forward, mid, back
    const swing = [0, 1, 0, -1][fr];
    const bob = (fr === 1 || fr === 3) ? -1 : 0;

    const skin = C.ltred, hair = C.brown;
    const tunic = C[look.tunic], trim = C[look.trim], legs = C[look.legs];
    const boot = C.black;

    // shadow
    g.stipple(x - 6 * u, y - 1 * u, 12 * u, 3 * u, C.black, 0.55);

    const by = bob;   // vertical bob applied to everything above the feet

    /* ---- legs ---- */
    if (face === 'left' || face === 'right') {
      const d = face === 'right' ? 1 : -1;
      P(-2 + swing * d, -13 + by, 3, 13, legs);
      P(-2 - swing * d, -13 + by, 3, 13, legs);
      P(-2 + swing * d, -3 + by, 4 * d > 0 ? 4 : 4, 3, boot);
      P(-2 - swing * d, -3 + by, 4, 3, boot);
    } else {
      P(-4 + swing, -13 + by, 3, 13, legs);
      P(1 - swing, -13 + by, 3, 13, legs);
      P(-4 + swing, -3 + by, 3, 3, boot);
      P(1 - swing, -3 + by, 3, 3, boot);
    }

    /* ---- torso ---- */
    const tw = (face === 'left' || face === 'right') ? 7 : 9;
    const tx = -(tw / 2);
    P(tx, -23 + by, tw, 11, tunic);
    P(tx, -17 + by, tw, 1, trim);            // belt
    P(tx, -23 + by, tw, 1, trim);            // collar

    /* ---- cloak, hanging behind ---- */
    if (face === 'up') P(tx - 1, -23 + by, tw + 2, 12, C[look.cloak]);
    if (face === 'left') P(1, -23 + by, 3, 11, C[look.cloak]);
    if (face === 'right') P(-4, -23 + by, 3, 11, C[look.cloak]);

    /* ---- arms ---- */
    const arm = -swing;
    if (face === 'left' || face === 'right') {
      P(-1, -22 + by + arm, 2, 9, tunic);
      P(-1, -14 + by + arm, 2, 2, skin);
    } else {
      P(tx - 2, -22 + by + arm, 2, 9, tunic);
      P(tx + tw, -22 + by - arm, 2, 9, tunic);
      P(tx - 2, -14 + by + arm, 2, 2, skin);
      P(tx + tw, -14 + by - arm, 2, 2, skin);
    }

    /* ---- head ---- */
    P(-3, -30 + by, 7, 7, skin);
    if (face === 'up') {
      P(-3, -30 + by, 7, 5, hair);           // back of the head
    } else if (face === 'left') {
      P(-3, -30 + by, 7, 3, hair);
      P(1, -30 + by, 3, 6, hair);            // hair falls behind
      P(-3, -26 + by, 1, 1, C.black);        // eye
    } else if (face === 'right') {
      P(-3, -30 + by, 7, 3, hair);
      P(-3, -30 + by, 3, 6, hair);
      P(3, -26 + by, 1, 1, C.black);
    } else {
      P(-3, -30 + by, 7, 3, hair);
      P(-2, -26 + by, 1, 1, C.black);
      P(2, -26 + by, 1, 1, C.black);
    }

    /* carried lantern glow, so the actor reads as the light source */
    if (o.lantern) {
      const lx = (face === 'left') ? -7 : (face === 'right') ? 7 : 6;
      P(lx - 1, -16 + by, 3, 4, C.yellow);
      g.stipple(x + (lx - 3) * u, y + (-18 + by) * u, 7 * u, 8 * u, C.yellow, 0.3);
    }
  }

  /* ---------------- monsters ---------------- */

  function drawUmbra(g, x, y, t, hurt) {
    const C = g.C;
    const wob = Math.sin(t / 260) * 3;
    const w = 46, h = 58;
    // body: a hole in the world, edged with dithered shadow
    g.stipple(x - w / 2 - 6, y - h - 6, w + 12, h + 12, C.black, 0.55);
    g.ellipse(x, y - h / 2, w / 2, h / 2, C.black);
    g.stipple(x - w / 2, y - h, w, h, hurt ? C.ltmagenta : C.magenta, 0.18);
    // tendrils
    for (let i = 0; i < 5; i++) {
      const tx = x - 18 + i * 9 + Math.sin(t / 200 + i) * 2;
      g.px(tx, y - 12, 2, 12 + (i % 3) * 4, C.black);
    }
    // eyes
    const ey = y - h + 16 + wob * 0.3;
    g.px(x - 9, ey, 5, 3, hurt ? C.white : C.ltred);
    g.px(x + 5, ey, 5, 3, hurt ? C.white : C.ltred);
    g.px(x - 8, ey + 1, 3, 1, C.yellow);
    g.px(x + 6, ey + 1, 3, 1, C.yellow);
  }

  function drawLurker(g, x, y, t, hurt) {
    const C = g.C;
    const bob = Math.sin(t / 300) * 2;
    g.stipple(x - 24, y - 4, 48, 5, C.black, 0.5);
    g.ellipse(x, y - 14 + bob, 20, 12, hurt ? C.white : C.ltgray);
    g.ellipse(x, y - 16 + bob, 14, 8, C.ltcyan);
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI + (i / 5) * Math.PI;
      g.line(x + Math.cos(a) * 16, y - 12 + bob, x + Math.cos(a) * 24, y - 2, C.dkgray);
    }
    g.px(x - 7, y - 20 + bob, 4, 3, C.black);
    g.px(x + 3, y - 20 + bob, 4, 3, C.black);
  }

  const MONSTER_ART = { umbra: drawUmbra, lurker: drawLurker };

  /* ---------------- the spectral sentinel (a puzzle, not a fight) ---------------- */

  function drawSentinel(g, x, y, t, dancing) {
    const C = g.C;
    const sway = dancing ? Math.sin(t / 180) * 5 : Math.sin(t / 900) * 1;
    const lift = dancing ? Math.abs(Math.sin(t / 180)) * 4 : 0;
    const gh = C.ltcyan;
    const S = (dx, dy, w, h, c) => g.stipple(x + dx + sway, y + dy - lift, w, h, c, 0.55);
    S(-8, -40, 16, 4, gh);            // helm crest
    S(-7, -37, 14, 9, gh);            // helm
    g.stipple(x - 4 + sway, y - 33 - lift, 8, 2, C.black, 0.8);   // visor slit
    S(-10, -28, 20, 16, gh);          // cuirass
    S(-14, -27, 4, 13, gh);           // arms
    S(10, -27, 4, 13, gh);
    S(-8, -12, 6, 12, gh);            // legs
    S(2, -12, 6, 12, gh);
    // the iron key on its belt — solid, because it is not a ghost
    if (!dancing) {
      g.px(x + 9 + sway, y - 15, 3, 6, C.ltgray);
      g.px(x + 9 + sway, y - 15, 3, 2, C.white);
    }
    g.stipple(x - 16 + sway, y - 44 - lift, 32, 46, C.white, 0.08);
  }

  /* ---------------- item icons ---------------- */

  /* Small icons used both for objects lying in a scene and for the
     inventory strip. Drawn around (x, y) as a ~14px centre. */
  function drawItem(g, id, x, y, scale) {
    if (scale && scale !== 1) {
      g.ctx.save();
      g.ctx.translate(x, y);
      g.ctx.scale(scale, scale);
      drawItem(g, id, 0, 0, 1);
      g.ctx.restore();
      return;
    }
    const C = g.C;
    const P = (dx, dy, w, h, c) => g.px(x + dx, y + dy, w, h, c);
    switch (id) {
      case 'lantern':
        P(-3, -8, 6, 2, C.brown); P(-4, -6, 8, 7, C.yellow);
        P(-2, -4, 4, 4, C.white); P(-4, 1, 8, 2, C.brown); break;
      case 'note': case 'musicSheet':
        P(-5, -6, 10, 12, C.white); P(-3, -4, 6, 1, C.dkgray);
        P(-3, -1, 6, 1, C.dkgray); P(-3, 2, 4, 1, C.dkgray); break;
      case 'brassKey': case 'vaultKey': {
        const c = id === 'brassKey' ? C.yellow : C.ltgray;
        P(-5, -3, 5, 5, c); P(-3, -1, 1, 1, C.black);
        P(0, -1, 6, 2, c); P(4, 1, 1, 2, c); P(2, 1, 1, 2, c); break;
      }
      case 'lens':
        P(-5, -5, 8, 8, C.ltcyan); P(-3, -3, 4, 4, C.white);
        P(2, 2, 4, 4, C.brown); break;
      case 'lyre':
        P(-5, -6, 2, 11, C.ltgray); P(4, -6, 2, 11, C.ltgray);
        P(-5, -7, 11, 2, C.white);
        for (let i = -2; i <= 2; i += 2) P(i, -5, 1, 10, C.yellow); break;
      case 'knife':
        P(-1, -7, 2, 9, C.ltgray); P(-1, -7, 1, 9, C.white);
        P(-3, 2, 6, 2, C.brown); P(-1, 4, 2, 3, C.brown); break;
      case 'loaf':
        g.ellipse(x, y, 7, 5, C.brown); g.ellipse(x, y - 1, 6, 3, C.yellow); break;
      case 'curtain':
        P(-6, -6, 12, 12, C.magenta); g.speck(x - 6, y - 6, 12, 12, C.black, 0.12, 7); break;
      case 'candle':
        P(-2, -3, 4, 8, C.white); P(-1, -6, 2, 3, C.yellow); P(-1, -8, 2, 2, C.ltred); break;
      case 'flour':
        g.ellipse(x, y + 1, 6, 6, C.white); P(-3, -6, 6, 3, C.ltgray); break;
      case 'oilJar':
        P(-4, -5, 8, 10, C.brown); P(-4, -5, 8, 3, C.dkgray); P(-2, -1, 4, 4, C.yellow); break;
      case 'pitchPot':
        P(-5, -4, 10, 9, C.brown); g.ellipse(x, y - 4, 5, 2, C.black); break;
      case 'shovel':
        P(-1, -8, 2, 10, C.brown); P(-4, 2, 8, 6, C.ltgray); P(-4, 2, 8, 2, C.white); break;
      case 'emptyBottle':
        P(-1, -8, 2, 3, C.green); P(-3, -5, 6, 10, C.green);
        P(-2, -3, 2, 6, C.ltgreen); break;
      case 'doormat':
        P(-7, -3, 14, 7, C.brown); g.speck(x - 7, y - 3, 14, 7, C.black, 0.2, 3); break;
      /* --- treasures --- */
      case 'crown':
        P(-6, -1, 12, 4, C.yellow); P(-6, -5, 2, 5, C.yellow);
        P(-1, -7, 2, 7, C.yellow); P(4, -5, 2, 5, C.yellow);
        P(-1, -7, 2, 2, C.ltred); P(-6, -6, 2, 2, C.ltcyan); P(4, -6, 2, 2, C.ltcyan); break;
      case 'scepter':
        P(-1, -4, 2, 12, C.green); P(-3, -8, 6, 5, C.ltgreen);
        P(-1, -7, 2, 3, C.white); break;
      case 'chalice':
        P(-5, -7, 10, 5, C.yellow); P(-4, -2, 8, 2, C.yellow);
        P(-1, 0, 2, 4, C.yellow); P(-4, 4, 8, 2, C.yellow);
        P(-3, -6, 6, 2, C.white); break;
      case 'idol':
        P(-4, -2, 8, 8, C.dkgray); P(-3, -7, 6, 6, C.dkgray);
        P(-2, -5, 4, 4, C.ltcyan); P(-1, -4, 2, 2, C.white); break;
      case 'ring':
        g.circle(x, y + 1, 5, C.yellow); g.circle(x, y + 1, 3, C.black);
        P(-2, -6, 4, 4, C.ltcyan); P(-1, -5, 2, 2, C.white); break;
      case 'sunstone':
        g.stipple(x - 8, y - 8, 16, 16, C.yellow, 0.35);
        g.circle(x, y, 5, C.yellow); g.circle(x, y - 1, 3, C.white); break;
      default:
        P(-4, -4, 8, 8, C.ltgray); P(-3, -3, 6, 6, C.dkgray); break;
    }
  }

  Z.sprites = {
    drawActor, drawItem, drawSentinel, drawUmbra, drawLurker,
    monster: (kind) => MONSTER_ART[kind] || drawUmbra,
    CLASS_LOOK
  };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
