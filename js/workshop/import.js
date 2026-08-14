/* ============================================================
   MORROWLAMP GAME WORKSHOP — the import boundary
   The one place a cartridge that came from somewhere else is
   allowed in, and the one place that decides whether it may.

   There used to be three of these: the Workshop had one wired
   into a file-reader callback, the CLI had a second, and the
   compiler relied on a third by way of the validator. They did
   not agree. Both hand-written ones tested the format only when
   it was present and truthy, so a file that declared no format at
   all walked straight past — and neither of them looked at the
   version at any point.

   THE ORDER IS THE CONTRACT:

     parse  →  format identity  →  supported version  →  structure

   Each step is fatal. There is no migration layer and no "close
   enough": a dialect is supported when the validator lists its
   version and not before.

   THIS FUNCTION MUTATES NOTHING. It does not touch Z.cartridges,
   it does not touch the page, it does not touch the bench. It
   reads text and returns a verdict; the caller decides what to do
   with it. That is what makes "a rejected file leaves the Workshop
   exactly as it was" a property of the design rather than a
   promise somebody has to keep remembering, and it is what makes
   the boundary testable under Node, where there is no file input
   and no DOM to drive.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  /* Every refusal names why in one word, so a caller can tell a
     malformed file from an unsupported one without reading prose. */
  const REASONS = ['unreadable', 'not-json', 'wrong-format', 'invalid', 'validator-faulted'];

  function finding(code, where, path, message) {
    return { severity: 'error', code, where, path, message, text: where + ': ' + message };
  }

  function refuse(reason, name, headline, findings) {
    const lines = [headline];
    for (const f of findings) lines.push('  ' + f.text);
    return {
      ok: false, reason, name: name || null, cartridge: null, id: null,
      findings, report: lines.join('\n')
    };
  }

  /* `text` is the file's contents. `options.name` is what to call it in
     the diagnostics, and `options.taken` is a set or array of cartridge
     ids already on the shelf, used only to suggest a free id — the
     caller still does the inserting. */
  function read(text, options) {
    options = options || {};
    const name = options.name || 'that file';

    if (typeof text !== 'string' || !text.trim()) {
      return refuse('unreadable', name, 'CANNOT READ ' + name,
        [finding('empty-file', 'FILE', '', 'there is nothing in it.')]);
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      return refuse('not-json', name, 'CANNOT READ ' + name,
        [finding('not-json', 'FILE', '', 'it is not valid JSON. ' + err.message)]);
    }

    /* Format and version, by the same function the validator and every
       compiled adventure use. A file that does not say what it is, or
       says a version this build does not implement, stops here — before
       the structural checks, whose messages would only be confusing for
       a dialect we do not read. */
    const formatFindings = ml.validator.checkFormat(data);
    if (formatFindings.length) {
      return refuse('wrong-format', name, 'CARTRIDGE REFUSED — ' + name, formatFindings);
    }

    /* Structure. The validator is meant to be total — every malformed
       shape is a diagnostic, never an exception — and `test/validator.js`
       holds it to that by calling it directly with hostile input.

       The catch below is a net under that promise, not a substitute for
       it. If it ever fires, the validator has a bug: the right response
       is to fix the validator, and meanwhile the operator gets an honest
       refusal instead of a silent exception escaping into a callback and
       leaving the last cartridge's "0 errors" on screen. */
    let check;
    try {
      check = ml.validator.validate(data);
    } catch (err) {
      return refuse('validator-faulted', name, 'CARTRIDGE REFUSED — ' + name, [
        finding('validator-faulted', 'VALIDATOR', '',
          'the validator faulted on this file: ' + (err && err.message ? err.message : String(err)) +
          '. The file is refused. This is a bug in the validator, which is supposed to ' +
          'report every malformed cartridge rather than throw on one.')
      ]);
    }

    if (!check.ok) {
      const errors = check.findings.filter((f) => f.severity === 'error');
      return refuse('invalid', name, 'CARTRIDGE REFUSED — ' + name, errors);
    }

    /* Accepted. Suggest an id that does not collide: a loaded copy of a
       shipped title is a fourth cartridge, never a replacement for the
       one the compiler embeds. The caller inserts under this id. */
    const taken = options.taken instanceof Set ? options.taken : new Set(options.taken || []);
    const wanted = String((data.meta || {}).id || 'loaded-cartridge');
    let id = wanted;
    let n = 1;
    while (taken.has(id)) id = wanted + '-' + (++n);

    return {
      ok: true, reason: null, name, cartridge: data, id,
      renamed: id !== wanted,
      findings: check.findings,
      report: ml.validator.report(check)
    };
  }

  ml.import = { read, REASONS };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
