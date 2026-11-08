// The trailer's music, EGA frames and title cards, rendered in headless
// Chromium (legion's Playwright, from the Showrig kit). Run by
// tools/blender/trailer_job.sh, unattended:
//
//   node tools/trailer/capture.mjs <out dir> [--score-only]
//
// It serves the render folder itself (a random local port), so it needs
// nothing running. Writes <out>/audio/<cue>.wav and trailer-score.wav, <out>/ega/<room>.png and
// <out>/cards/<card>.png (transparent, 1920x1080; the thumbnail's is 1280x720).
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_DIR || join(process.env.HOME, '.local/share/showrig-deps/playwright/node_modules/playwright');
const { chromium } = require(PW);

const ROOT = resolve(process.env.MORROW_RENDER_DIR || process.cwd());
const OUT = resolve(process.argv[2] || 'out/trailer');
const SCORE_ONLY = process.argv.includes('--score-only');

// The music cues, in the order the edit plays them (cut.py lays them out).
export const CUES = [['title', 21], ['tension', 15], ['combat', 9], ['lullaby', 34]];
const EGA = ['hall'];
const CARDS = ['presents', 'drowned', 'ega1', 'ega2', 'unclaimed', 'reborn', 'title', 'f1', 'f2', 'f3', 'f4', 'end', 'thumb'];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.ttf': 'font/ttf', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/tools/trailer/`;

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  for (const dir of ['audio', 'ega', 'cards']) await mkdir(join(OUT, dir), { recursive: true });

  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[capture] page error:', e.message));
  await page.goto(base + 'capture.html');
  await page.waitForFunction(() => window.captureReady === true);
  const b64score = await page.evaluate(() => window.renderTrailerScore());
  await writeFile(join(OUT, 'audio', 'trailer-score.wav'), Buffer.from(b64score, 'base64'));
  console.log('[morrow] trailer score');
  if (!SCORE_ONLY) await everythingElse(page);
} finally {
  await browser.close();
  server.close();
}

async function everythingElse(page) {
  for (const [id, seconds] of CUES) {
    const b64 = await page.evaluate(([i, s]) => window.renderCue(i, s), [id, seconds]);
    await writeFile(join(OUT, 'audio', id + '.wav'), Buffer.from(b64, 'base64'));
    console.log(`[morrow] cue ${id}: ${seconds}s`);
  }
  for (const room of EGA) {
    const url = await page.evaluate((r) => window.paintEga(r, 'ega'), room);
    await writeFile(join(OUT, 'ega', room + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log(`[morrow] ega ${room}`);
  }

  for (const card of CARDS) {
    const size = card === 'thumb' ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };
    const p = await browser.newPage({ viewport: size });
    await p.goto(base + 'cards.html?card=' + card);
    await p.waitForFunction(() => window.cardReady === true);
    await p.screenshot({ path: join(OUT, 'cards', card + '.png'), omitBackground: true });
    await p.close();
    console.log(`[morrow] card ${card}`);
  }
}
