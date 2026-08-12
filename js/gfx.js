/* ============================================================
   THE SUNKEN CROWN — EGA-style pixel graphics primitives
   A 320x200 16-colour surface with ordered (Bayer) dithering,
   which is how classic pixel artists faked a far larger palette.
   No image assets: every scene is drawn in code.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};

  const W = 320, H = 200;

  /* The IBM EGA 16. Everything in the game is mixed from these. */
  const EGA = {
    black: [0, 0, 0], blue: [0, 0, 170], green: [0, 170, 0], cyan: [0, 170, 170],
    red: [170, 0, 0], magenta: [170, 0, 170], brown: [170, 85, 0], ltgray: [170, 170, 170],
    dkgray: [85, 85, 85], ltblue: [85, 85, 255], ltgreen: [85, 255, 85], ltcyan: [85, 255, 255],
    ltred: [255, 85, 85], ltmagenta: [255, 85, 255], yellow: [255, 255, 85], white: [255, 255, 255]
  };
  const VGA = {
    black: [8, 12, 20], blue: [38, 66, 160], green: [43, 150, 75], cyan: [38, 180, 180],
    red: [170, 55, 50], magenta: [170, 70, 170], brown: [165, 105, 45], ltgray: [165, 175, 190],
    dkgray: [65, 75, 95], ltblue: [92, 145, 255], ltgreen: [115, 230, 125], ltcyan: [110, 235, 235],
    ltred: [255, 110, 100], ltmagenta: [245, 130, 245], yellow: [255, 225, 90], white: [255, 255, 245]
  };
  const CGA = {
    black: [0, 0, 0], blue: [0, 0, 170], green: [0, 170, 0], cyan: [0, 170, 170],
    red: [170, 0, 0], magenta: [170, 0, 170], brown: [170, 85, 0], ltgray: [170, 170, 170],
    dkgray: [85, 85, 85], ltblue: [85, 85, 255], ltgreen: [85, 255, 85], ltcyan: [85, 255, 255],
    ltred: [255, 85, 85], ltmagenta: [255, 85, 255], yellow: [255, 255, 85], white: [255, 255, 255]
  };
  const PROFILES = {
    cga: { id: 'cga', name: 'CGA', width: 320, height: 200, scale: 1, palette: CGA, dithering: 'coarse' },
    ega: { id: 'ega', name: 'EGA', width: 320, height: 200, scale: 1, palette: EGA, dithering: 'ordered' },
    vga: { id: 'vga', name: 'VGA', width: 640, height: 400, scale: 2, palette: VGA, dithering: 'fine' }
  };
  function hexPalette(palette) {
    const out = {};
    for (const k in palette) out[k] = '#' + palette[k].map((v) => v.toString(16).padStart(2, '0')).join('');
    return out;
  }
  const HEX = hexPalette(EGA);

  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  let defaultProfile = 'ega';

  function create(canvas, options) {
    options = options || {};
    const profile = PROFILES[options.profile || defaultProfile] || PROFILES.ega;
    const PAL = profile.palette;
    const COLORS = hexPalette(PAL);
    const logicalW = options.logicalWidth || W;
    const logicalH = options.logicalHeight || H;
    const ctx = canvas.getContext('2d');
    if (options.resize !== false) {
      canvas.width = logicalW * profile.scale;
      canvas.height = logicalH * profile.scale;
    }
    ctx.setTransform(profile.scale, 0, 0, profile.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const patCache = new Map();

    /* A 4x4 repeating pattern of `color` covering `f` of the pixels.
       Cached, and aligned to the canvas origin so adjacent shapes
       share one coherent dither grid. */
    function stipplePattern(color, f) {
      const q = Math.max(0, Math.min(16, Math.round(f * 16)));
      const key = color + '|' + q;
      let p = patCache.get(key);
      if (p) return p;
      const c = document.createElement('canvas');
      c.width = 4; c.height = 4;
      const cx = c.getContext('2d');
      cx.fillStyle = color;
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          if (BAYER[y][x] < q) cx.fillRect(x, y, 1, 1);
        }
      }
      p = ctx.createPattern(c, 'repeat');
      patCache.set(key, p);
      return p;
    }

    const R = Math.round;

    const g = {
      ctx, W: logicalW, H: logicalH, C: COLORS, PAL,

      clear(c) {
      ctx.fillStyle = c || COLORS.black;
        ctx.fillRect(0, 0, logicalW, logicalH);
      },

      /* solid rectangle, pixel-snapped */
      px(x, y, w, h, c) {
      ctx.fillStyle = c;
        ctx.fillRect(R(x), R(y), Math.max(1, R(w)), Math.max(1, R(h)));
      },

      /* paint `c` over whatever is there, covering fraction f (0..1) */
      stipple(x, y, w, h, c, f) {
        if (f <= 0) return;
        if (f >= 1) return g.px(x, y, w, h, c);
        ctx.fillStyle = stipplePattern(c, f);
        ctx.fillRect(R(x), R(y), Math.max(1, R(w)), Math.max(1, R(h)));
      },

      /* two-tone dither: c1 base, c2 stippled on top at ratio f */
      dith(x, y, w, h, c1, c2, f) {
        g.px(x, y, w, h, c1);
        g.stipple(x, y, w, h, c2, f);
      },

      /* Smooth dithered vertical gradient through a list of palette colours.
         Uses ImageData so long sweeps (skies, cavern walls) stay cheap. */
      vgrad(x, y, w, h, colors) {
        x = R(x); y = R(y); w = R(w); h = R(h);
        if (w <= 0 || h <= 0 || colors.length === 0) return;
        const rgb = colors.map((n) => PAL[n] || PAL.black);
        if (rgb.length === 1) return g.px(x, y, w, h, COLORS[colors[0]]);
        const img = ctx.createImageData(w, h);
        const d = img.data;
        for (let yy = 0; yy < h; yy++) {
          const t = (yy / Math.max(1, h - 1)) * (rgb.length - 1);
          const i = Math.min(rgb.length - 2, Math.floor(t));
          const f = t - i;
          const a = rgb[i], b = rgb[i + 1];
          const brow = BAYER[(y + yy) & 3];
          for (let xx = 0; xx < w; xx++) {
            const pick = (brow[(x + xx) & 3] / 16) < f ? b : a;
            const o = (yy * w + xx) * 4;
            d[o] = pick[0]; d[o + 1] = pick[1]; d[o + 2] = pick[2]; d[o + 3] = 255;
          }
        }
        const tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        tmp.getContext('2d').putImageData(img, 0, 0);
        ctx.drawImage(tmp, x, y, w, h);
      },

      line(x0, y0, x1, y1, c) {
        x0 = R(x0); y0 = R(y0); x1 = R(x1); y1 = R(y1);
        ctx.fillStyle = c;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
          ctx.fillRect(x0, y0, 1, 1);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      },

      poly(pts, c) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(R(pts[0][0]), R(pts[0][1]));
        for (let i = 1; i < pts.length; i++) ctx.lineTo(R(pts[i][0]), R(pts[i][1]));
        ctx.closePath();
        ctx.fill();
      },

      ellipse(cx, cy, rx, ry, c) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(R(cx), R(cy), Math.max(1, R(rx)), Math.max(1, R(ry)), 0, 0, Math.PI * 2);
        ctx.fill();
      },

      circle(cx, cy, r, c) { g.ellipse(cx, cy, r, r, c); },

      /* deterministic speckle — same seed always paints the same grit */
      speck(x, y, w, h, c, density, seed) {
        let s = (seed || 1) >>> 0;
        ctx.fillStyle = c;
        const n = Math.floor(w * h * (density || 0.05));
        for (let i = 0; i < n; i++) {
          s = (s * 1664525 + 1013904223) >>> 0;
          const px = x + (s >>> 16) % w;
          s = (s * 1664525 + 1013904223) >>> 0;
          const py = y + (s >>> 16) % h;
          ctx.fillRect(R(px), R(py), 1, 1);
        }
      },

      /* masonry: staggered courses with a mortar line */
      brick(x, y, w, h, face, mortar, bw, bh) {
        g.px(x, y, w, h, face);
        bw = bw || 16; bh = bh || 8;
        for (let row = 0, yy = y; yy < y + h; yy++, row++) {
          if ((yy - y) % bh === 0) g.px(x, yy, w, 1, mortar);
        }
        let row = 0;
        for (let yy = y; yy < y + h; yy += bh, row++) {
          const off = (row % 2) * (bw / 2);
          for (let xx = x + off; xx < x + w; xx += bw) {
            g.px(xx, yy, 1, Math.min(bh, y + h - yy), mortar);
          }
        }
      },

      /* soft pool of lamplight — dithered rings, not a smooth blur */
      lightPool(cx, cy, r, c) {
        for (let i = 6; i >= 1; i--) {
          const rr = r * (i / 6);
          const f = 0.16 * (1 - i / 7);
          ctx.fillStyle = stipplePattern(c, f);
          ctx.beginPath();
          ctx.ellipse(R(cx), R(cy), R(rr), R(rr * 0.62), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      },

      /* darkness mask with a hole punched around the light source */
      darkness(cx, cy, r) {
        if (r <= 0) { g.stipple(0, 0, logicalW, logicalH, COLORS.black, 1); return; }
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, logicalW, logicalH);
        ctx.ellipse(R(cx), R(cy), R(r), R(r * 0.82), 0, 0, Math.PI * 2, true);
        ctx.fill('evenodd');
        ctx.fillStyle = COLORS.black;
        ctx.fill('evenodd');
        ctx.restore();
        // dithered falloff ring so the edge isn't a hard circle
        for (let i = 0; i < 4; i++) {
          const rr = r * (1 + i * 0.12);
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(R(cx), R(cy), R(rr), R(rr * 0.82), 0, 0, Math.PI * 2);
          ctx.ellipse(R(cx), R(cy), R(rr * 0.88), R(rr * 0.82 * 0.88), 0, 0, Math.PI * 2, true);
          ctx.clip('evenodd');
          g.stipple(0, 0, logicalW, logicalH, COLORS.black, 0.75 - i * 0.18);
          ctx.restore();
        }
      },

      save() { ctx.save(); },
      restore() { ctx.restore(); },
      clip(x, y, w, h) {
        ctx.beginPath();
        ctx.rect(R(x), R(y), R(w), R(h));
        ctx.clip();
      }
    };

    g.profile = profile;
    g.profileName = profile.id;
    g.C = COLORS;
    g.PAL = PAL;
    return g;
  }

  Z.gfx = {
    create, W, H, HEX, PAL: EGA, BAYER, PROFILES,
    profileNames: Object.keys(PROFILES),
    setDefaultProfile(name) { if (PROFILES[name]) defaultProfile = name; return defaultProfile; },
    getDefaultProfile() { return defaultProfile; },
    getProfile(name) { return PROFILES[name] || PROFILES.ega; }
  };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
