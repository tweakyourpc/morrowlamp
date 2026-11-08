// The game's credits as plain text, from the same roll the game shows
// (js/remastered/credits.js), for the marketing folder and the films.
//
//   node tools/credits.mjs           write marketing/credits.txt
//   node tools/credits.mjs --check   exit 1 if marketing/credits.txt is out of date
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTHOR_LINKS, ROLL, VOICES } from '../js/remastered/credits.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'marketing', 'credits.txt');
const WIDTH = 64;

function wrap(text) {
  const out = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > WIDTH) { out.push(line); line = word; } else line = line ? line + ' ' + word : word;
  }
  if (line) out.push(line);
  return out;
}

function text() {
  const out = [];
  ROLL.forEach((block, i) => {
    if (i) out.push('', '');
    if (block.title) out.push(...block.title.map((t) => t.toUpperCase()), '');
    if (block.heading) out.push(block.heading.toUpperCase());
    out.push(...(block.lines || []));
    (block.paragraphs || []).forEach((p, k) => out.push(...(k ? [''] : []), ...wrap(p)));
    if (block.voices) {
      for (const v of Object.values(VOICES)) out.push('', v.role, '  ' + v.model, ...v.credit.map((c) => '  ' + c));
      out.push('', ...block.after);
    }
    if (i === 0) {
      const pad = Math.max(...AUTHOR_LINKS.map(([label]) => label.length)) + 2;
      out.push('', ...AUTHOR_LINKS.map(([label, href]) => label.padEnd(pad) + href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')));
    }
  });
  return out.join('\n') + '\n';
}

const want = text();
if (process.argv.includes('--check')) {
  let have = '';
  try { have = readFileSync(OUT, 'utf8'); } catch { /* missing counts as stale */ }
  if (have !== want) { console.error('marketing/credits.txt is out of date: run node tools/credits.mjs'); process.exit(1); }
} else {
  writeFileSync(OUT, want);
  console.log('wrote ' + OUT);
}
