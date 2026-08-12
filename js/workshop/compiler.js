/* ============================================================
   MORROWLAMP GAME WORKSHOP — the compiler
   BUILD GAME. One cartridge in, one HTML file out.

   The output is the modern equivalent of an .EXE: runtime,
   cartridge, rules, interface, styles, procedural renderer and
   synthesized audio, all in a single document with no siblings,
   no server, no network and no installation. Open it from a disk
   in thirty years and it still runs.

   `compile()` is a pure function of { cartridge, sources }. The
   browser supplies sources by fetch; the tests supply them from
   disk. Neither path is a special case, so what the tests check
   is exactly what the Workshop ships.

   Nothing is minified. A compiled adventure should be readable by
   whoever finds it.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  const COMPILER_VERSION = '1.0.0';

  /* A closing script tag inside embedded source would end the block
     early, which is the one classic way to produce a broken artifact. */
  function safeScript(text) {
    return String(text).replace(/<\/script/gi, '<\\/script');
  }
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
  }
  /* No `--` may appear inside an HTML comment. */
  function safeComment(text) {
    return String(text).replace(/--+/g, '–');
  }

  function pad(label, value) {
    return '  ' + (label + ':').padEnd(20) + value;
  }

  function header(cartridge, options) {
    const meta = cartridge.meta || {};
    const presentation = cartridge.presentation || {};
    const built = options.now || new Date().toISOString();
    return [
      '<!--',
      '  MORROWLAMP GAME WORKSHOP',
      '  Compiled Adventure',
      '',
      pad('Game', meta.title || 'Untitled'),
      pad('Cartridge', meta.id || 'untitled'),
      pad('Cartridge Version', meta.version || '0.0.0'),
      pad('Author', meta.author || 'unknown'),
      pad('Engine Version', 'Morrowlamp Machine ' + (ml.VERSION || '?')),
      pad('Compiler Version', COMPILER_VERSION),
      pad('Display Adapter', String(presentation.renderer || 'ega').toUpperCase()),
      pad('Sound Hardware', String(presentation.audio || 'chip').toUpperCase()),
      pad('Interface', String(presentation.interface || 'parser').toUpperCase()),
      pad('Built', built),
      '',
      '  This file is self-contained. It loads no scripts, styles, images,',
      '  fonts or audio from anywhere: every scene is drawn in code and',
      '  every note is synthesized at runtime. It needs no server, no',
      '  installation and no network, and it will still work on a dead',
      '  one. Copy it to a disk and it is archived.',
      '',
      '  Nothing here is minified on purpose. Read it.',
      '-->'
    ].map(safeComment).join('\n');
  }

  function moduleBlock(path, source) {
    return '<!-- ' + safeComment(path) + ' -->\n<script>\n' + safeScript(source) + '\n</script>';
  }

  /* Cartridges come in two shapes. One written as a source file (with
     painter functions in it) is embedded as that source and re-executes
     in the page. One assembled in the Workshop is plain data and is
     embedded as JSON. Both end up at Z.cartridges[id]. */
  function cartridgeBlock(cartridge, sources, cartridgeFile) {
    if (cartridgeFile && sources[cartridgeFile]) {
      return moduleBlock(cartridgeFile + '  (game cartridge)', sources[cartridgeFile]);
    }
    const json = JSON.stringify(cartridge, null, 2);
    return '<!-- game cartridge (data) -->\n' +
      '<script id="morrowlamp-cartridge" type="application/json">\n' + safeScript(json) + '\n</script>\n' +
      '<script>\n' +
      '(function () {\n' +
      '  var Z = window.Z = window.Z || {};\n' +
      '  Z.cartridges = Z.cartridges || {};\n' +
      '  var data = JSON.parse(document.getElementById(\'morrowlamp-cartridge\').textContent);\n' +
      '  Z.cartridges[data.meta.id] = data;\n' +
      '})();\n' +
      '</script>';
  }

  function bootBlock(cartridge, shell) {
    const id = (cartridge.meta || {}).id;
    const mount = shell === 'canvas' ? 'shellCanvas' : 'shellParser';
    return [
      '<!-- boot -->',
      '<script>',
      '(function () {',
      '  \'use strict\';',
      '  var Z = window.Z;',
      '  var cartridge = Z.cartridges[' + JSON.stringify(id) + '];',
      '  if (!cartridge) { document.body.textContent = \'This adventure image is missing its cartridge.\'; return; }',
      '  var check = Z.ml.validator ? Z.ml.validator.validate(cartridge) : { ok: true };',
      '  if (!check.ok) { document.body.textContent = Z.ml.validator.report(check); return; }',
      '  Z.ml.' + mount + '.mount({ cartridge: cartridge, root: document.body });',
      '})();',
      '</script>'
    ].join('\n');
  }

  function compile(options) {
    options = options || {};
    const cartridge = options.cartridge;
    const sources = options.sources || {};
    if (!cartridge) throw new Error('BUILD GAME: no cartridge supplied.');

    if (ml.validator && options.validate !== false) {
      const check = ml.validator.validate(cartridge);
      if (!check.ok) {
        const error = new Error(ml.validator.report(check));
        error.validation = check;
        throw error;
      }
    }

    const plan = ml.bundle.filesFor(cartridge);
    const missing = plan.machine.filter((f) => !sources[f]);
    if (plan.cartridgeFile && !sources[plan.cartridgeFile] && !options.allowDataCartridge) {
      missing.push(plan.cartridgeFile);
    }
    if (missing.length) throw new Error('BUILD GAME: source not loaded for ' + missing.join(', '));

    const meta = cartridge.meta || {};
    const blocks = plan.machine.map((path) => moduleBlock(path, sources[path]));
    /* The validator travels with the game so a compiled adventure can
       still explain itself if its cartridge is ever hand-edited. */
    if (sources['js/workshop/validator.js']) {
      blocks.push(moduleBlock('js/workshop/validator.js', sources['js/workshop/validator.js']));
    }
    blocks.push(cartridgeBlock(cartridge, sources, plan.cartridgeFile));
    blocks.push(bootBlock(cartridge, plan.shell));

    const title = escapeHtml(meta.title || 'A Morrowlamp Adventure');
    const description = escapeHtml(meta.blurb || 'A Morrowlamp adventure.');

    return [
      '<!doctype html>',
      header(cartridge, options),
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta name="description" content="' + description + '">',
      '<meta name="generator" content="Morrowlamp Game Workshop ' + COMPILER_VERSION + '">',
      '<title>' + title + '</title>',
      '<style>',
      'html,body{margin:0;padding:0;background:#0a0c12}',
      '</style>',
      '</head>',
      '<body>',
      '',
      blocks.join('\n\n'),
      '',
      '</body>',
      '</html>',
      ''
    ].join('\n');
  }

  function filename(cartridge) {
    const id = (cartridge.meta || {}).id || 'morrowlamp-game';
    return String(id).replace(/[^a-z0-9-]+/gi, '-').toLowerCase() + '.html';
  }

  /* ---------------- source loading ----------------
     In the browser the Workshop must read its own source files to put
     them in the compiled game. Over http:// that is a fetch. Over
     file:// the browser refuses, which is not a bug we can fix here —
     so say so plainly, in period. */
  function loadSources(paths, base) {
    const root = base || '';
    const out = {};
    /* Cache-bust. Without this the browser happily hands back the copy it
       fetched before you edited the file, and BUILD GAME silently compiles
       yesterday's engine into today's game — which is a very hard bug to
       see, because the artifact looks perfectly fine. */
    const stamp = '?built=' + Date.now();
    return Promise.all(paths.map((path) =>
      fetch(root + path + stamp, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(path + ' (' + response.status + ')');
          return response.text();
        })
        .then((text) => { out[path] = text; })
    )).then(() => out)
      .catch((err) => {
        if (global.location && global.location.protocol === 'file:') {
          throw new Error(
            'DISK ERROR — the Workshop cannot read its own source files from file://.\n' +
            'Serve the folder instead:  python3 -m http.server 8000\n' +
            'then open http://localhost:8000/author.html and BUILD GAME again.\n' +
            '(Compiled adventures have no such trouble: they run straight off a disk.)'
          );
        }
        throw new Error('BUILD GAME: could not read ' + err.message);
      });
  }

  function download(text, name) {
    const blob = new Blob([text], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  /* ---------------- artifact inspection ----------------
     The promise this project makes is that a compiled game reaches for
     nothing outside itself. That promise is worth checking mechanically,
     both in the tests and, if anyone likes, in the Workshop. */
  const EXTERNAL_PATTERNS = [
    [/<script[^>]*\ssrc\s*=/i, 'a <script src> pointing somewhere else'],
    [/<link[^>]*\shref\s*=/i, 'a <link href> stylesheet or icon'],
    [/<img[^>]*\ssrc\s*=\s*["'](?!data:)/i, 'an <img> loading a file'],
    [/<(audio|video|source|track)[^>]*\ssrc\s*=\s*["'](?!data:)/i, 'an audio or video source'],
    [/url\(\s*["']?(?!data:)(?:https?:)?\/\//i, 'a CSS url() reaching off the page'],
    [/@import/i, 'a CSS @import'],
    [/\bfetch\s*\(/i, 'a fetch() call'],
    [/XMLHttpRequest/i, 'an XMLHttpRequest'],
    [/new\s+WebSocket/i, 'a WebSocket'],
    [/new\s+(Image|Audio)\s*\(/i, 'an Image or Audio loader'],
    [/["'](?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/i, 'a URL to another host']
  ];

  function inspect(html) {
    const findings = [];
    for (const [pattern, description] of EXTERNAL_PATTERNS) {
      const match = pattern.exec(html);
      if (match) findings.push({ description, at: match.index, text: match[0].slice(0, 60) });
    }
    return {
      selfContained: findings.length === 0,
      findings,
      bytes: html.length,
      title: (/<title>([^<]*)<\/title>/i.exec(html) || [])[1] || null
    };
  }

  /* ---------------- the build readout ----------------
     Everything below is computed from numbers the compiler already has.
     It is completely unnecessary, which is precisely why a machine
     called MORROWLAMP has to print it. */
  function dots(label, width) {
    const text = String(label);
    return text + '.'.repeat(Math.max(3, (width || 34) - text.length));
  }

  function buildLog(cartridge, html, plan) {
    const world = cartridge.world || {};
    const profile = ml.profile.normalize(cartridge.profile);
    const presentation = cartridge.presentation || {};
    const rooms = Object.keys(world.rooms || {}).length;
    const objects = Object.keys(world.objects || {}).length;
    const rules = (cartridge.rules || []).length;
    const encounters = Object.keys(cartridge.encounters || {}).length;
    const report = inspect(html);

    const lines = [
      'MORROWLAMP ADVENTURE COMPILER ' + COMPILER_VERSION,
      '',
      dots('READING GAME CARTRIDGE') + ' OK',
      dots('VALIDATING WORLD MAP') + ' OK',
      dots('VALIDATING OBJECT TABLE') + ' OK',
      dots('COMPILING RULE BOOK') + ' OK'
    ];
    if (profile.stats.enabled) lines.push(dots('LINKING CHARACTER SYSTEM') + ' OK');
    if (profile.combat.enabled) lines.push(dots('LINKING ENCOUNTER SYSTEM') + ' OK');
    if (plan.shell === 'canvas') {
      lines.push(dots('INSTALLING ' + String(presentation.renderer || 'ega').toUpperCase() + ' DISPLAY DRIVER') + ' OK');
    } else {
      lines.push(dots('INSTALLING TEXT DISPLAY DRIVER') + ' OK');
    }
    lines.push(dots('INSTALLING SYNTHESIZED AUDIO') + ' OK');
    lines.push(dots('PACKING GAME MACHINE') + ' OK');
    lines.push(dots('SEALING ADVENTURE IMAGE') + ' ' + (report.selfContained ? 'OK' : 'WARN'));
    lines.push('');

    const counts = [rooms + ' ROOMS', objects + ' OBJECTS', rules + ' RULES'];
    if (profile.treasures.enabled) counts.push(profile.treasures.list.length + ' TREASURES');
    if (encounters) counts.push(encounters + ' ENCOUNTER' + (encounters === 1 ? '' : 'S'));
    counts.push((plan.machine.length + 1) + ' MODULES');
    lines.push(counts.join('\n'));
    lines.push('');
    lines.push('BUILD COMPLETE');
    lines.push('');
    lines.push(filename(cartridge).toUpperCase());
    lines.push(html.length.toLocaleString('en-US') + ' BYTES');
    if (!report.selfContained) {
      lines.push('');
      lines.push('WARNING: ' + report.findings.map((f) => f.description).join('; '));
    }
    return lines.join('\n');
  }

  ml.compiler = { COMPILER_VERSION, compile, filename, loadSources, download, inspect, buildLog, safeScript, EXTERNAL_PATTERNS };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
