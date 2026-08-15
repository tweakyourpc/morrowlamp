/* ============================================================
   MORROWLAMP MACHINE — parser interface shell
   The same cartridge, no canvas: a scrolling transcript and a
   command line. Useful for cartridges with no art, for accessible
   play, and as proof that the interface really is separable from
   the game.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z = global.Z || {};
  const ml = Z.ml = Z.ml || {};

  const CSS = `
.ml-term{--ink:#c8e6c8;--dim:#7f9c7f;--warm:#ffe18a;background:#0a0f0a;color:var(--ink);
  font:15px/1.6 ui-monospace,"DejaVu Sans Mono",Menlo,Consolas,monospace;min-height:100vh;margin:0;
  padding:20px;display:flex;flex-direction:column;align-items:center}
.ml-term-inner{width:100%;max-width:760px;display:flex;flex-direction:column;gap:10px}
.ml-term h1{color:var(--warm);font-size:18px;letter-spacing:.12em;margin:0}
.ml-term-status{color:var(--dim);font-size:13px}
.ml-term-log{flex:1;min-height:60vh;white-space:pre-wrap}
.ml-term-log p{margin:0 0 8px}
.ml-term-log .room-name{color:var(--warm);letter-spacing:.06em}
.ml-term-log .dim{color:var(--dim)}
.ml-term-log .bad{color:#ff9b9b}
.ml-term-log .good{color:#b8e6b0}
.ml-term-log .scored{color:var(--warm)}
.ml-term-log .info{color:#9fd0ff}
.ml-term-row{display:flex;gap:8px}
.ml-term-row span{color:var(--warm)}
.ml-term-row input{flex:1;background:transparent;border:0;border-bottom:1px solid #2c3a2c;
  color:var(--ink);font:inherit;padding:4px 0}
.ml-term-row input:focus{outline:none;border-color:var(--warm)}
.ml-term-over{position:fixed;inset:0;background:#050805f2;color:var(--ink);display:flex;align-items:center;justify-content:center;padding:24px;z-index:10}
.ml-term-card{max-width:700px;text-align:center;border:1px solid #394f39;background:#0d160d;padding:24px}
.ml-term-card h1{color:var(--warm);letter-spacing:.12em}
.ml-term-card p{text-align:left;color:var(--dim)}
`;

  function mount(options) {
    const cart = options.cartridge;
    const runtime = options.runtime || ml.runtime.create(cart);
    const root = options.root || document.body;
    const sound = ml.sound.create({ profile: (cart.presentation || {}).audio, enabled: options.sound !== false });
    sound.attach(runtime);

    if (!document.getElementById('ml-term-css')) {
      const style = document.createElement('style');
      style.id = 'ml-term-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    root.classList.add('ml-term');

    const inner = document.createElement('div');
    inner.className = 'ml-term-inner';
    const heading = document.createElement('h1');
    heading.textContent = cart.meta.title || 'A MORROWLAMP ADVENTURE';
    const status = document.createElement('div');
    status.className = 'ml-term-status';
    const log = document.createElement('div');
    log.className = 'ml-term-log';
    const row = document.createElement('form');
    row.className = 'ml-term-row';
    const caret = document.createElement('span');
    caret.textContent = '>';
    const input = document.createElement('input');
    input.autocomplete = 'off';
    input.spellcheck = false;
    row.append(caret, input);
    inner.append(heading, status, log, row);
    root.appendChild(inner);

    function print(messages) {
      for (const line of messages) {
        const p = document.createElement('p');
        p.className = line.cls || '';
        p.textContent = line.text;
        log.appendChild(p);
      }
      window.scrollTo(0, document.body.scrollHeight);
    }

    function renderStatus() {
      const m = runtime.meta();
      const bits = [m.roomName];
      if (runtime.profile.score.enabled) bits.push('Score ' + m.score);
      if (runtime.profile.treasures.enabled) bits.push(m.secured + '/' + m.treasures);
      bits.push('Moves ' + m.turns);
      if (m.sheet) bits.push('Health ' + m.sheet.hp + '/' + m.sheet.maxHp + '  Level ' + m.sheet.level);
      if (m.encounter) bits.push(m.encounter.name + ' ' + m.encounter.hp + '/' + m.encounter.maxHp);
      status.textContent = bits.join('   ·   ');
    }

    /* Mid-encounter the terminal lists the options, because there is no
       combat panel here — typing the name of an action is the interface. */
    function announceEncounter() {
      const fight = runtime.encounter();
      if (!fight) return;
      const options = fight.actions
        .map((a) => (a.enabled ? a.label : a.label + ' (' + (a.deny || 'not now') + ')'))
        .join('   ');
      print([{ text: 'Your options: ' + options, cls: 'info' }]);
    }

    const SAVE_KEY = 'morrowlamp:' + (cart.meta.id || 'game') + ':';

    /* `command` routes an encounter action name to the encounter before
       the parser ever sees it; `perform` takes an already-parsed action.
       Typing is the only interface here, so always go through `command`. */
    function submit(text) {
      const result = runtime.command(text);
      handle(result);
    }

    function run(action) { handle(runtime.perform(action)); }

    function handle(result) {
      if (result.meta.clear) log.textContent = '';
      print(result.messages);
      const save = result.meta.saveRequest, load = result.meta.loadRequest;
      if (save !== undefined && save !== null) {
        try {
          localStorage.setItem(SAVE_KEY + save, JSON.stringify({ cartridge: cart.meta.id, state: runtime.serialize() }));
          print([{ text: 'Saved to slot ' + save + '.', cls: 'good' }]);
        } catch (err) { print([{ text: 'Saving is not available here.', cls: 'bad' }]); }
      }
      if (load !== undefined && load !== null) {
        try {
          const raw = localStorage.getItem(SAVE_KEY + load);
          if (!raw) print([{ text: 'Slot ' + load + ' is empty.', cls: 'bad' }]);
          else {
            runtime.restore(JSON.parse(raw).state);
            print([{ text: 'Restored.', cls: 'good' }]);
            print(runtime.describeRoom(runtime.meta().room, true));
          }
        } catch (err) { print([{ text: 'That save could not be read.', cls: 'bad' }]); }
      }
      renderStatus();
      announceEncounter();
    }

    row.addEventListener('submit', (event) => {
      event.preventDefault();
      sound.unlock();
      const text = input.value;
      input.value = '';
      if (!text.trim()) return;
      print([{ text: '> ' + text, cls: 'dim' }]);
      submit(text);
    });

    function begin() {
      print(runtime.intro().map((t) => ({ text: t, cls: 'dim' })));
      print([{ text: '', cls: '' }]);
      print(runtime.describeRoom(runtime.meta().room, true));
      renderStatus();
      announceEncounter();
      input.focus();
    }

    const title = (cart.presentation || {}).title;
    if (title && title.enabled) {
      const over = document.createElement('div');
      over.className = 'ml-term-over';
      const card = document.createElement('div');
      card.className = 'ml-term-card';
      const heading = document.createElement('h1');
      heading.textContent = title.heading || cart.meta.title || 'A MORROWLAMP ADVENTURE';
      card.appendChild(heading);
      if (title.subtitle || cart.meta.blurb) {
        const subtitle = document.createElement('p');
        subtitle.textContent = title.subtitle || cart.meta.blurb;
        card.appendChild(subtitle);
      }
      const prompt = document.createElement('button');
      prompt.className = 'ml-btn';
      prompt.textContent = title.prompt || 'BEGIN';
      prompt.addEventListener('click', () => { over.remove(); begin(); });
      card.appendChild(prompt);
      over.appendChild(card);
      document.body.appendChild(over);
      const titleKey = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        document.removeEventListener('keydown', titleKey);
        over.remove();
        begin();
      };
      document.addEventListener('keydown', titleKey);
    } else begin();

    return { runtime, sound, run, submit, print };
  }

  ml.shellParser = { mount, CSS };
  if (typeof module !== 'undefined') module.exports = Z;
})(typeof window !== 'undefined' ? window : globalThis);
