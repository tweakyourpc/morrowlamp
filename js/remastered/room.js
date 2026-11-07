/* ============================================================
   THE SUNKEN CROWN, REMASTERED — rooms
   A remastered room is a set of Blender passes plus variant
   overlays (an open clock door, a key on its shelf). This module
   loads them and composes the passes for the current game state
   into canvases: textures for the stage, and the data pass kept
   on the CPU so a click can ask "what is under this pixel?".
   ============================================================ */

const PASSES = ['beauty', 'albedo', 'normal', 'emit', 'data'];
const cache = new Map();

async function bitmap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ': ' + res.status);
  /* Data passes must arrive byte-exact: no colour management, no
     premultiplication. Beauty passes are sRGB already. */
  return createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
}

async function loadImages(base, passes) {
  const out = {};
  await Promise.all(PASSES.map(async (p) => { out[p] = await bitmap(base + passes[p]); }));
  return out;
}

/* null when the room has not been remastered yet. */
export async function loadRoom(root, id) {
  if (cache.has(id)) return cache.get(id);
  const base = root + 'rooms/' + id + '/';
  const task = (async () => {
    const res = await fetch(base + 'room.json');
    if (!res.ok) return null;
    const manifest = await res.json();
    const images = await loadImages(base, manifest.passes);
    const variants = await Promise.all(manifest.variants.map(async (v) => ({ ...v, images: await loadImages(base, v.passes) })));
    return createRoom(manifest, images, variants);
  })().catch((err) => { console.warn('[remastered] room ' + id + ' unavailable:', err); return null; });
  cache.set(id, task);
  return task;
}

function createRoom(manifest, images, variants) {
  const [W, H] = manifest.size;
  const canvases = {};
  for (const p of PASSES) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    canvases[p] = c;
  }
  let pixels = null;
  let activeKey = null;

  /* Lay the active variants over the base. Variant masks are binary,
     so drawing them leaves untouched pixels byte-exact. */
  function compose(active) {
    const key = active.map((v) => v.id).join('|');
    if (key === activeKey) return false;
    activeKey = key;
    for (const p of PASSES) {
      const ctx = canvases[p].getContext('2d', { willReadFrequently: p === 'data' });
      ctx.imageSmoothingEnabled = false;
      ctx.globalCompositeOperation = 'copy';
      ctx.drawImage(images[p], 0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      for (const v of active) {
        const [x, y, w, h] = v.rect;
        if (p === 'beauty' || p === 'data') ctx.drawImage(v.images[p], x, y, w, h);
        else {
          /* Lighting passes carry no alpha of their own; borrow the
             beauty overlay's mask so they change exactly where it does. */
          const tmp = maskedCopy(v.images[p], v.images.beauty, w, h);
          ctx.drawImage(tmp, x, y, w, h);
        }
      }
    }
    pixels = canvases.data.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    return true;
  }

  function sample(px, py) {
    if (!pixels) return null;
    const x = Math.max(0, Math.min(W - 1, px | 0));
    const y = Math.max(0, Math.min(H - 1, py | 0));
    const i = (y * W + x) * 4;
    const depth = ((pixels[i] << 8) | pixels[i + 1]) / 65535 * manifest.camera.depthRange;
    return { id: manifest.ids[String(pixels[i + 2])] || null, depth };
  }

  return { manifest, canvases, variants, compose, sample, size: [W, H] };
}

function maskedCopy(img, maskImg, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(maskImg, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}

/* Which overlays the game state calls for right now. Conditions read
   the runtime and nothing else: { open: id }, { in: [item, holder] },
   { here: item } (lying loose in this room) and { flag: name }. Every
   condition given must hold. */
export function activeVariants(room, runtime) {
  return room.variants.filter((v) => holds(v.when || {}, runtime));
}

export function holds(when, runtime) {
  if (when.open) {
    const o = runtime.describeObject(when.open);
    if (!o || !o.open) return false;
  }
  if (when.in) {
    const [item, holder] = when.in;
    const h = runtime.describeObject(holder);
    if (!h || !(h.contents || []).includes(item)) return false;
  }
  if (when.here) {
    const o = runtime.describeObject(when.here);
    if (!o || !o.here) return false;
  }
  if (when.flag && !runtime.flags()[when.flag]) return false;
  return true;
}
