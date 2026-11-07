/* ============================================================
   MORROWLAMP GAME WORKSHOP — the console
   Wires author.html to the validator, the bundle manifest and the
   compiler. Shipped cartridges are inspected read-only; a new
   cartridge is fully editable.

   Deliberately small. This is a workshop, not an IDE: enough form
   to prove the architecture, and no more. The interesting work
   happens in the Machine and the compiler, not in here.
   ============================================================ */
(function (global) {
  'use strict';
  const Z = global.Z, ml = Z.ml;
  const $ = (id) => document.getElementById(id);

  /* The two titles on the shelf are reference material: they are read
     from their source files at build time, so editing them here would
     be a lie the compiler could not honour. */
  const READ_ONLY = new Set(Object.keys(ml.bundle.CARTRIDGE_FILES));

  let current = null;        // the cartridge on the bench
  let editable = false;
  let sources = null;        // module source text, fetched once
  let sourceState = 'loading';
  let selection = { room: null, object: null, rule: null };
  let sceneRoom = null;
  const history = ml.editorState.create({ storage: global.localStorage || null });

  function updateEditorStatus() {
    if (!current) {
      $('editor-status').textContent = 'No cartridge inserted.';
      $('btn-undo').disabled = true;
      $('btn-redo').disabled = true;
      $('btn-recover').disabled = true;
      return;
    }
    $('editor-status').textContent = (editable ? (history.isDirty(current) ? 'Unsaved draft' : 'Saved state') : 'Read-only reference') +
      ' · ' + current.meta.id;
    $('btn-undo').disabled = !editable || !history.canUndo();
    $('btn-redo').disabled = !editable || !history.canRedo();
    $('btn-recover').disabled = !editable || !history.recover(current);
  }

  function edit(label, mutate, redraw) {
    if (!current || !editable) return;
    if ($('test-stage') && $('test-stage').children.length) stopTest();
    history.capture(current);
    mutate();
    history.changed(current);
    if (redraw) redraw();
    updateEditorStatus();
    validate();
  }

  function replaceCurrent(next) {
    if (!next) return;
    current = next;
    Z.cartridges[current.meta.id] = current;
    selection = { room: null, object: null, rule: null };
    sceneRoom = null;
    renderShelf();
    renderAll();
    updateEditorStatus();
    validate();
  }

  /* ---------------- diagnostics readout ---------------- */
  function readout(text, kind) {
    const node = $('readout');
    node.textContent = text;
    node.className = 'readout' + (kind ? ' ' + kind : '');
  }
  function lamp(id, text, kind) {
    const node = $(id);
    node.textContent = text;
    node.parentNode.className = 'lamp' + (kind ? ' ' + kind : '');
  }

  /* ---------------- source preload ----------------
     The Workshop has to be able to read its own source files to put
     them inside a compiled game. Do it once, up front, so BUILD GAME
     is instant and any disk trouble is reported before the operator
     has invested any work. */
  function preload() {
    const files = ml.bundle.allFiles().concat(['js/workshop/validator.js']);
    lamp('lamp-source', 'READING ' + files.length + ' FILES', 'busy');
    ml.compiler.loadSources(files)
      .then((loaded) => {
        sources = loaded;
        sourceState = 'ready';
        const bytes = Object.keys(loaded).reduce((n, k) => n + loaded[k].length, 0);
        lamp('lamp-source', files.length + ' FILES · ' + Math.round(bytes / 1024) + 'K', 'lit');
        /* A cartridge inserted while the disk was still spinning left
           BUILD GAME disabled. Re-check now that the sources are in. */
        if (current) validate();
      })
      .catch((err) => {
        sourceState = 'failed';
        lamp('lamp-source', 'DISK ERROR', 'out');
        readout(String(err.message || err), 'bad');
      });
  }

  /* ---------------- cartridge shelf ---------------- */
  function renderShelf() {
    const list = $('cart-list');
    list.textContent = '';
    for (const id in Z.cartridges) {
      const cart = Z.cartridges[id];
      const button = document.createElement('button');
      button.className = 'cart' + (current && current.meta.id === id ? ' on' : '');
      const name = document.createElement('b');
      name.textContent = cart.meta.title;
      const sub = document.createElement('span');
      const rooms = Object.keys((cart.world || {}).rooms || {}).length;
      const objects = Object.keys((cart.world || {}).objects || {}).length;
      sub.textContent = (READ_ONLY.has(id) ? 'reference · ' : 'editable · ') +
        rooms + ' rooms · ' + objects + ' objects · ' + (cart.rules || []).length + ' rules';
      button.append(name, sub);
      button.addEventListener('click', () => insert(id));
      list.appendChild(button);
    }
  }

  function insert(id) {
    /* A game left running on the bench belongs to the cartridge that
       was in the slot, not to this one. */
    stopTest();
    current = Z.cartridges[id];
    editable = !READ_ONLY.has(id);
    if (editable) {
      current.editor = current.editor || {};
      current.editor.map = current.editor.map || {};
    }
    history.begin(current);
    selection = { room: null, object: null, rule: null };
    sceneRoom = null;
    $('bench-title').textContent = current.meta.title + (editable ? '' : '  ·  READ-ONLY REFERENCE CARTRIDGE');
    lamp('lamp-cart', current.meta.id.toUpperCase(), 'lit');
    lamp('lamp-image', '—', '');
    renderShelf();
    renderAll();
    updateEditorStatus();
    validate();
  }

  /* ---------------- form binding ---------------- */
  function readPath(object, path) {
    return path.split('.').reduce((node, key) => (node === undefined || node === null ? node : node[key]), object);
  }
  function writePath(object, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    let node = object;
    for (const key of keys) node = node[key] = node[key] || {};
    node[last] = value;
  }

  function bindFields() {
    for (const field of document.querySelectorAll('[data-path]')) {
      field.addEventListener('input', () => {
        if (!current || !editable) return;
        const path = field.getAttribute('data-path');
        const value = field.getAttribute('data-lines')
          ? field.value.split('\n').filter((line) => line.trim().length)
          : field.value;
        edit(path, () => writePath(current, path, value));
        if (path === 'meta.title') $('bench-title').textContent = value;
        renderShelf();
        if (path === 'presentation.interface') renderPresentation();
      });
    }
  }

  function renderGameSheet() {
    for (const field of document.querySelectorAll('[data-path]')) {
      const value = readPath(current, field.getAttribute('data-path'));
      field.value = Array.isArray(value) ? value.join('\n') : (value === undefined || value === null ? '' : value);
      field.readOnly = !editable && field.tagName !== 'SELECT';
      if (field.tagName === 'SELECT') field.disabled = !editable;
    }
  }

  /* ---------------- memory map ---------------- */
  function renderMemoryMap() {
    const rows = $('memory-map');
    rows.textContent = '';
    if (!current) return;
    const plan = ml.bundle.filesFor(current);
    const world = current.world || {};
    const profile = ml.profile.normalize(current.profile);
    const entries = [
      ['ROOMS', Object.keys(world.rooms || {}).length],
      ['OBJECTS', Object.keys(world.objects || {}).length],
      ['RULES', (current.rules || []).length],
      ['VERBS', Object.keys((current.vocabulary || {}).verbs || {}).length + ' custom'],
      ['ENDINGS', (current.endings || []).length],
      ['TREASURES', profile.treasures.enabled ? profile.treasures.list.length : 'none'],
      ['STATS', profile.stats.enabled ? Object.keys(profile.stats.list || {}).length + ' · ' + Object.keys(profile.stats.classes || {}).length + ' classes' : 'off'],
      ['ENCOUNTERS', Object.keys(current.encounters || {}).length || 'none'],
      ['MODULES', plan.machine.length + (plan.cartridgeFile ? 1 : 0)]
    ];
    for (const [label, value] of entries) {
      const tr = document.createElement('tr');
      const th = document.createElement('td');
      th.className = 'muted';
      th.textContent = label;
      const td = document.createElement('td');
      td.innerHTML = '';
      const code = document.createElement('code');
      code.textContent = String(value);
      td.appendChild(code);
      tr.append(th, td);
      rows.appendChild(tr);
    }
  }

  /* ---------------- world editor ---------------- */
  function exitSummary(room) {
    const bits = [];
    for (const dir in (room.exits || {})) {
      const exit = room.exits[dir];
      const target = typeof exit === 'string' ? exit : exit && exit.room;
      const gated = typeof exit === 'object' && exit && (exit.flagReq || exit.objReq);
      bits.push(dir + '→' + (target || '·') + (gated ? '*' : ''));
    }
    return bits.join(' ') || '—';
  }

  function renderRoomMap() {
    const host = $('room-map');
    host.textContent = '';
    if (!current) return;
    const rooms = (current.world || {}).rooms || {};
    const positions = ((current.editor || {}).map || {});
    const ids = Object.keys(rooms), coords = {};
    ids.forEach((id, index) => {
      coords[id] = positions[id] || { x: 28 + (index % 4) * 174, y: 28 + Math.floor(index / 4) * 112 };
    });
    const svg = document.createElement('svg');
    svg.setAttribute('viewBox', '0 0 720 300');
    for (const from of ids) for (const dir in (rooms[from].exits || {})) {
      const edge = rooms[from].exits[dir], to = typeof edge === 'string' ? edge : edge && edge.room;
      if (!to || !coords[to] || ids.indexOf(to) < ids.indexOf(from)) continue;
      const line = document.createElement('line');
      line.setAttribute('x1', coords[from].x + 60); line.setAttribute('y1', coords[from].y + 28);
      line.setAttribute('x2', coords[to].x + 60); line.setAttribute('y2', coords[to].y + 28);
      line.setAttribute('stroke', '#65708a'); line.setAttribute('stroke-width', '2'); svg.appendChild(line);
    }
    host.appendChild(svg);
    ids.forEach((id) => {
      const room = rooms[id], pos = coords[id], node = document.createElement('button');
      node.className = 'map-room' + (selection.room === id ? ' on' : '');
      node.style.left = pos.x + 'px'; node.style.top = pos.y + 'px';
      const name = document.createElement('b'); name.textContent = room.name || id;
      const detail = document.createElement('span'); detail.textContent = id + ' · ' + Object.keys(room.exits || {}).length + ' exits';
      node.append(name, detail);
      node.addEventListener('click', () => { selection.room = id; renderRoomMap(); renderRoomEditor(); });
      node.addEventListener('pointerdown', (event) => {
        if (!editable) return;
        const startX = event.clientX, startY = event.clientY, original = { x: pos.x, y: pos.y };
        const move = (moveEvent) => {
          positions[id] = { x: Math.max(8, original.x + moveEvent.clientX - startX), y: Math.max(8, original.y + moveEvent.clientY - startY) };
          node.style.left = positions[id].x + 'px'; node.style.top = positions[id].y + 'px';
        };
        const stop = () => {
          document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', stop);
          if (positions[id].x !== original.x || positions[id].y !== original.y) { history.capture(current); history.changed(current); updateEditorStatus(); }
        };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', stop);
      });
      host.appendChild(node);
    });
  }

  function renderRooms() {
    const rows = $('room-rows');
    rows.textContent = '';
    const rooms = (current.world || {}).rooms || {};
    for (const id in rooms) {
      const room = rooms[id];
      const tr = document.createElement('tr');
      tr.className = 'pick' + (selection.room === id ? ' on' : '');
      for (const value of [id, room.name || '', exitSummary(room), room.dark ? 'yes' : '']) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      }
      tr.addEventListener('click', () => { selection.room = selection.room === id ? null : id; renderRooms(); });
      rows.appendChild(tr);
    }
    renderRoomMap();
    renderRoomEditor();
  }

  function fieldRow(label, value, onChange, options) {
    const wrap = document.createElement('div');
    const tag = document.createElement('label');
    tag.textContent = label;
    wrap.appendChild(tag);
    const input = document.createElement(options && options.multiline ? 'textarea' : 'input');
    input.value = value === undefined || value === null ? '' : value;
    input.readOnly = !editable;
    input.addEventListener('input', () => { if (editable) edit(label, () => onChange(input.value)); });
    wrap.appendChild(input);
    return wrap;
  }

  function renderRoomEditor() {
    const host = $('room-editor');
    host.textContent = '';
    if (!selection.room) return;
    const room = current.world.rooms[selection.room];
    const box = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'ROOM ' + selection.room;
    box.appendChild(legend);
    box.appendChild(fieldRow('Name', room.name, (v) => { room.name = v; renderRooms(); }));
    box.appendChild(fieldRow('Description', room.desc, (v) => { room.desc = v; }, { multiline: true }));
    box.appendChild(fieldRow('Short description', room.short, (v) => { room.short = v; }));
    box.appendChild(fieldRow('Exits (dir:room, comma separated)', exitsToText(room), (v) => {
      textToExits(room, v);
      renderRooms();
    }));
    if (editable) {
      const remove = document.createElement('button');
      remove.className = 'danger';
      remove.textContent = 'Delete room';
      remove.style.marginTop = '10px';
      remove.addEventListener('click', () => {
        edit('delete room', () => {
          delete current.world.rooms[selection.room];
          selection.room = null;
          renderAll();
        });
      });
      box.appendChild(remove);
    }
    host.appendChild(box);
  }

  /* Exits are edited as text, because "n:hall, d:cellar" is faster to
     read and type than four nested widgets. Gated exits are shown but
     only editable in the cartridge source. */
  function exitsToText(room) {
    const bits = [];
    for (const dir in (room.exits || {})) {
      const exit = room.exits[dir];
      if (typeof exit === 'string') { bits.push(dir + ':' + exit); continue; }
      bits.push(dir + ':' + (exit.room || '') + (exit.flagReq ? ' [' + exit.flagReq + ']' : '') + (exit.objReq ? ' [' + exit.objReq + ']' : ''));
    }
    return bits.join(', ');
  }
  function textToExits(room, text) {
    const next = {};
    for (const chunk of String(text).split(',')) {
      const bit = chunk.trim();
      if (!bit) continue;
      const match = /^([a-z]+)\s*:\s*([a-zA-Z0-9_-]*)\s*(?:\[([a-zA-Z0-9_]+)\])?$/.exec(bit);
      if (!match) continue;
      const [, dir, target, gate] = match;
      const existing = room.exits && room.exits[dir];
      if (gate || (existing && typeof existing === 'object')) {
        next[dir] = Object.assign({}, typeof existing === 'object' ? existing : {}, { room: target || null });
        if (gate) next[dir].flagReq = gate;
      } else {
        next[dir] = target;
      }
    }
    room.exits = next;
  }

  function renderObjects() {
    const rows = $('object-rows');
    rows.textContent = '';
    const objects = (current.world || {}).objects || {};
    for (const id in objects) {
      const o = objects[id];
      const tr = document.createElement('tr');
      tr.className = 'pick' + (selection.object === id ? ' on' : '');
      const where = o.at === undefined ? inContainer(id) : (Array.isArray(o.at) ? o.at.join(' / ') : o.at);
      for (const value of [id, o.name || '', where || '—', o.takeable ? 'yes' : '']) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      }
      tr.addEventListener('click', () => { selection.object = selection.object === id ? null : id; renderObjects(); });
      rows.appendChild(tr);
    }
    renderObjectEditor();
  }

  function inContainer(id) {
    const objects = current.world.objects;
    for (const cid in objects) {
      const contents = objects[cid].contents || [];
      if (contents.includes(id)) return 'inside ' + cid;
    }
    return null;
  }

  function renderObjectEditor() {
    const host = $('object-editor');
    host.textContent = '';
    if (!selection.object) return;
    const o = current.world.objects[selection.object];
    const box = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'OBJECT ' + selection.object;
    box.appendChild(legend);
    box.appendChild(fieldRow('Name', o.name, (v) => { o.name = v; renderObjects(); }));
    box.appendChild(fieldRow('Other words for it (comma separated)', (o.aliases || []).join(', '),
      (v) => { o.aliases = v.split(',').map((s) => s.trim()).filter(Boolean); }));
    box.appendChild(fieldRow('Line shown in the room', o.desc, (v) => { o.desc = v; }, { multiline: true }));
    box.appendChild(fieldRow('Examine text', o.examine, (v) => { o.examine = v; }, { multiline: true }));
    box.appendChild(fieldRow('Starts in (room id, or "inv")', Array.isArray(o.at) ? o.at.join(', ') : (o.at || ''),
      (v) => {
        const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
        if (!parts.length) delete o.at;
        else o.at = parts.length === 1 ? parts[0] : parts;
        renderObjects();
      }));

    const check = document.createElement('label');
    check.style.display = 'flex';
    check.style.alignItems = 'center';
    check.style.gap = '8px';
    const box2 = document.createElement('input');
    box2.type = 'checkbox';
    box2.checked = !!o.takeable;
    box2.style.width = 'auto';
    box2.disabled = !editable;
    box2.addEventListener('change', () => edit('toggle portable', () => { o.takeable = box2.checked; renderObjects(); }));
    check.append(box2, document.createTextNode('Portable — the player can pick it up'));
    box.appendChild(check);

    if (editable) {
      const remove = document.createElement('button');
      remove.className = 'danger';
      remove.textContent = 'Delete object';
      remove.style.marginTop = '10px';
      remove.addEventListener('click', () => {
        edit('delete object', () => {
          delete current.world.objects[selection.object];
          selection.object = null;
          renderAll();
        });
      });
      box.appendChild(remove);
    }
    host.appendChild(box);
  }

  /* ---------------- rule book ---------------- */
  function describeHead(rule) {
    const bits = [];
    const say = (label, value) => {
      if (value === undefined) return;
      bits.push(label + ' ' + (Array.isArray(value) ? value.map((v) => (v === null ? '—' : v)).join('/') : value));
    };
    say('verb', rule.verb);
    say('target', rule.target);
    say('with', rule.with);
    say('phrase', rule.phrase);
    return bits.join('  ') || 'anything';
  }
  function describeBody(rule) {
    const steps = (rule.do || []).map((step) => Object.keys(step).filter((k) => k !== 'cls' && k !== 'reason')[0]);
    return steps.join(' → ') + (rule.otherwise ? '   (+ otherwise)' : '');
  }

  function renderRules() {
    const rows = $('rule-rows');
    rows.textContent = '';
    const rules = current.rules || [];
    $('rules-count').textContent = rules.length + ' rule' + (rules.length === 1 ? '' : 's') +
      ', tried in order. The first one that matches wins.';
    rules.forEach((rule, index) => {
      const tr = document.createElement('tr');
      tr.className = 'pick' + (selection.rule === index ? ' on' : '');
      const cells = [String(index + 1), rule.id || '(unnamed)', describeHead(rule), describeBody(rule)];
      cells.forEach((value, i) => {
        const td = document.createElement('td');
        if (i === 2 || i === 3) { const code = document.createElement('code'); code.textContent = value; td.appendChild(code); }
        else td.textContent = value;
        tr.appendChild(td);
      });
      tr.addEventListener('click', () => { selection.rule = selection.rule === index ? null : index; renderRules(); });
      rows.appendChild(tr);
    });
    renderRuleEditor();
  }

  function renderRuleEditor() {
    const host = $('rule-editor');
    host.textContent = '';
    if (selection.rule === null) return;
    const rule = current.rules[selection.rule];
    const box = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'RULE ' + (selection.rule + 1) + (rule.id ? ' (' + rule.id + ')' : '');
    box.appendChild(legend);

    let advancedSource = null;
    const guide = document.createElement('div');
    guide.className = 'guide-grid';
    const guideInput = (label, value, onChange, multiline) => {
      const wrap = document.createElement('label'); wrap.textContent = label;
      const input = document.createElement(multiline ? 'textarea' : 'input');
      input.value = value === undefined || value === null ? '' : value;
      input.readOnly = !editable;
      input.addEventListener('input', () => edit(label, () => {
        onChange(input.value);
        if (advancedSource) advancedSource.value = JSON.stringify(rule, null, 2);
      }));
      wrap.appendChild(input); return wrap;
    };
    const guideSelect = (label, value, options, onChange) => {
      const wrap = document.createElement('label'); wrap.textContent = label;
      const select = document.createElement('select');
      options.forEach((option) => {
        const item = document.createElement('option'); item.value = option.value; item.textContent = option.label; select.appendChild(item);
      });
      select.value = value === undefined || value === null ? '' : value;
      select.disabled = !editable;
      select.addEventListener('change', () => edit(label, () => onChange(select.value), renderRules));
      wrap.appendChild(select); return wrap;
    };
    const verbs = Object.keys(ml.vocabulary.CORE_VERBS).concat(Object.keys((current.vocabulary || {}).verbs || {}));
    const verbOptions = Array.from(new Set(verbs)).map((id) => ({ value: id, label: id }));
    const targetOptions = [{ value: '', label: '(no target)' }].concat(Object.keys((current.world || {}).objects || {}).map((id) => ({ value: id, label: id })));
    const verb = Array.isArray(rule.verb) ? rule.verb[0] : (rule.verb || '');
    const target = Array.isArray(rule.target) ? (rule.target.find((id) => id) || '') : (rule.target || '');
    guide.appendChild(guideInput('Rule id', rule.id, (value) => { rule.id = value; }));
    guide.appendChild(guideSelect('When the player', verb, verbOptions, (value) => { rule.verb = value; }));
    guide.appendChild(guideSelect('On this object', target, targetOptions, (value) => { rule.target = value || null; }));
    guide.appendChild(guideInput('Say this', rule.do && rule.do[0] && rule.do[0].say, (value) => {
      rule.do = rule.do || [];
      if (rule.do[0] && Object.keys(rule.do[0]).length === 1 && rule.do[0].say !== undefined) rule.do[0].say = value;
      else rule.do.unshift({ say: value });
    }, true));
    box.appendChild(guide);

    const advanced = document.createElement('details'); advanced.className = 'advanced-rule';
    const summary = document.createElement('summary'); summary.textContent = 'Advanced JSON'; advanced.appendChild(summary);
    const source = document.createElement('textarea'); source.style.minHeight = '220px'; advancedSource = source;
    source.value = JSON.stringify(rule, null, 2);
    source.readOnly = !editable;
    advanced.appendChild(source); box.appendChild(advanced);

    if (editable) {
      const row = document.createElement('div');
      row.className = 'row';
      row.style.marginTop = '10px';
      const apply = document.createElement('button');
      apply.textContent = 'Apply';
      apply.addEventListener('click', () => {
        try {
          const parsed = JSON.parse(source.value);
          edit('apply advanced rule', () => { current.rules[selection.rule] = parsed; }, renderRules);
        } catch (err) {
          readout('RULE ' + (selection.rule + 1) + ': that is not valid JSON.\n  ' + err.message, 'bad');
        }
      });
      const remove = document.createElement('button');
      remove.className = 'danger';
      remove.textContent = 'Delete rule';
      remove.addEventListener('click', () => {
        edit('delete rule', () => {
          current.rules.splice(selection.rule, 1);
          selection.rule = null;
          renderRules();
        });
      });
      row.append(apply, remove);
      box.appendChild(row);
    }
    host.appendChild(box);
  }

  /* ---------------- display and sound ---------------- */
  function fillSelect(select, entries, value) {
    select.textContent = '';
    for (const entry of entries) {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = entry.name;
      select.appendChild(option);
    }
    select.value = value;
  }

  function renderPresentation() {
    const presentation = current.presentation || (current.presentation = {});
    fillSelect($('f-renderer'), ml.render.names().map((id) => ml.render.PROFILES[id]), presentation.renderer || 'ega');
    fillSelect($('f-audio'), ml.sound.names().map((id) => ml.sound.PROFILES[id]), presentation.audio || 'chip');
    fillSelect($('f-interface'), [
      { id: 'canvas', name: 'CANVAS — scene, hotspots and a command line' },
      { id: 'parser', name: 'PARSER — transcript and a command line' }
    ], presentation.interface || 'parser');

    const adapter = ml.render.PROFILES[presentation.renderer || 'ega'];
    $('hint-renderer').textContent = adapter ? adapter.hardware + ' · ' + adapter.colors + ' colours' : '';
    const hardware = ml.sound.PROFILES[presentation.audio || 'chip'];
    $('hint-audio').textContent = hardware ? hardware.blurb + (hardware.music ? '' : ' No music on this hardware.') : '';
    $('hint-interface').textContent = (presentation.art && presentation.art.scene)
      ? 'This cartridge supplies its own scene painters.'
      : 'No painters supplied; the canvas interface would show empty rooms.';

    const rows = $('profile-rows');
    rows.textContent = '';
    const profile = ml.profile.normalize(current.profile);
    const lines = [
      ['Score', profile.score.enabled ? 'on · ' + profile.score.ranks.length + ' ranks' : 'off'],
      ['Treasures', profile.treasures.enabled ? profile.treasures.list.length + ', secured in ' + (profile.treasures.securedIn || '—') : 'off'],
      ['Darkness', profile.darkness.enabled ? 'on · ' + profile.darkness.grace + ' turn grace' : 'off'],
      ['Light fuel', profile.light.fuel ? profile.light.fuel.object + ' · ' + profile.light.fuel.turns + ' turns' : 'off'],
      ['Turn counter', profile.turns ? 'on' : 'off'],
      ['Hunger', profile.hunger.enabled ? 'on' : 'off'],
      ['Character stats', profile.stats.enabled ? 'on' : 'off'],
      ['Combat', profile.combat.enabled ? 'on' : 'off'],
      ['Timed events', (profile.timers || []).length || 'none']
    ];
    for (const [label, value] of lines) {
      const tr = document.createElement('tr');
      const th = document.createElement('td');
      th.className = 'muted';
      th.textContent = label;
      const td = document.createElement('td');
      const code = document.createElement('code');
      code.textContent = String(value);
      td.appendChild(code);
      tr.append(th, td);
      rows.appendChild(tr);
    }
    renderSceneEditor();
  }

  function sceneSelect(label, value, choices, onChange) {
    const wrap = document.createElement('label');
    wrap.textContent = label;
    const select = document.createElement('select');
    for (const choice of choices) {
      const option = document.createElement('option');
      option.value = choice;
      option.textContent = choice || '(none)';
      select.appendChild(option);
    }
    select.value = value || choices[0];
    select.disabled = !editable;
    select.addEventListener('change', () => { if (editable) { onChange(select.value); validate(); } });
    wrap.appendChild(select);
    return wrap;
  }

  function renderSceneEditor() {
    const host = $('scene-editor');
    if (!host) return;
    host.textContent = '';
    if (!current) return;
    const presentation = current.presentation || (current.presentation = {});
    const art = presentation.art || {};
    const semantic = art.scene && typeof art.scene === 'object' && !Array.isArray(art.scene) ? art.scene : null;
    if (!semantic) {
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent = art.scene && typeof art.scene === 'function'
        ? 'This reference cartridge supplies bespoke painter functions.'
        : 'No semantic scenes are installed.';
      host.appendChild(note);
      if (editable && !(art.scene && typeof art.scene === 'function')) {
        const button = document.createElement('button');
        button.textContent = 'Create semantic scenes';
        button.addEventListener('click', () => {
          presentation.art = presentation.art || {};
          presentation.art.scene = {};
          for (const id of Object.keys((current.world || {}).rooms || {})) {
            presentation.art.scene[id] = { environment: 'stone_chamber', perspective: 'interior', features: [] };
          }
          sceneRoom = current.world.startRoom;
          renderPresentation();
          validate();
        });
        host.appendChild(button);
      }
      return;
    }
    const rooms = Object.keys((current.world || {}).rooms || {});
    if (!rooms.length) return;
    if (!sceneRoom || !semantic[sceneRoom]) sceneRoom = rooms[0];
    host.appendChild(sceneSelect('Room', sceneRoom, rooms, (value) => { sceneRoom = value; renderSceneEditor(); }));
    const spec = semantic[sceneRoom] || { environment: 'stone_chamber', perspective: 'interior', features: [] };
    if (editable && !semantic[sceneRoom]) semantic[sceneRoom] = spec;
    host.appendChild(sceneSelect('Environment', spec.environment, ml.scene.ENVIRONMENTS, (value) => { spec.environment = value; }));
    host.appendChild(sceneSelect('Perspective', spec.perspective, ml.scene.PERSPECTIVES, (value) => { spec.perspective = value; }));

    const label = document.createElement('p');
    label.className = 'hint'; label.textContent = 'Features'; host.appendChild(label);
    const features = Array.isArray(spec.features) ? spec.features : [];
    if (editable && !Array.isArray(spec.features)) spec.features = features;
    features.forEach((feature, index) => {
      const box = document.createElement('fieldset');
      const legend = document.createElement('legend'); legend.textContent = 'FEATURE ' + (index + 1); box.appendChild(legend);
      box.appendChild(sceneSelect('Type', feature.type, ml.scene.FEATURES, (value) => { feature.type = value; renderSceneEditor(); }));
      box.appendChild(sceneSelect('Position', feature.position, ml.scene.POSITIONS, (value) => { feature.position = value; }));
      box.appendChild(sceneSelect('Style', feature.style || 'plain', ml.scene.STYLES, (value) => { feature.style = value; }));
      box.appendChild(sceneSelect('Gameplay object', feature.object || '', [''].concat(Object.keys((current.world || {}).objects || {})), (value) => {
        if (value) feature.object = value; else delete feature.object;
      }));
      if (feature.type === 'torch') {
        const lit = document.createElement('label');
        const check = document.createElement('input'); check.type = 'checkbox'; check.checked = feature.lit !== false; check.disabled = !editable;
        check.addEventListener('change', () => { feature.lit = check.checked; validate(); });
        lit.append(check, document.createTextNode(' Lit')); box.appendChild(lit);
      }
      if (editable) {
        const remove = document.createElement('button'); remove.className = 'danger'; remove.textContent = 'Remove feature';
        remove.addEventListener('click', () => { features.splice(index, 1); renderSceneEditor(); validate(); }); box.appendChild(remove);
      }
      host.appendChild(box);
    });
    if (editable) {
      const add = document.createElement('button'); add.textContent = 'Add feature';
      add.addEventListener('click', () => { features.push({ type: 'door', position: 'north', style: 'wood' }); renderSceneEditor(); validate(); });
      host.appendChild(add);
    }
  }

  /* ---------------- the writing ----------------
     Every line of prose a cartridge holds in its strings table, in one
     list. This is the panel somebody who is not going to touch a rule
     works in: the keys are fixed, the text is not, and nothing typed
     here can change what the game does. */
  function renderStrings() {
    const host = $('string-editor');
    host.textContent = '';
    const table = current.strings;
    const intro = $('text-intro');

    if (!table || !Object.keys(table).length) {
      intro.textContent = 'This cartridge keeps its prose inline, where it is used. A cartridge may ' +
        'instead put every line in a strings table and refer to it as "@s:some.key" — see ' +
        'js/cartridges/sir-crumbly.js, which is written entirely that way. Then all the writing ' +
        'in the game is here, and none of the machinery is.';
      $('btn-add-string').disabled = !editable;
      return;
    }
    const keys = Object.keys(table);
    intro.textContent = keys.length + ' string' + (keys.length === 1 ? '' : 's') +
      '. Rewriting any of them rewrites the game; none of them can break it. ' +
      'A key holding several lines prints as several lines.';
    $('btn-add-string').disabled = !editable;

    for (const key of keys) {
      const box = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = key;
      box.appendChild(legend);
      const value = table[key];
      const field = document.createElement('textarea');
      /* An array is several lines of prose; a blank line between them
         would be indistinguishable from one long line, so join on a
         single newline and split the same way. */
      field.value = Array.isArray(value) ? value.join('\n') : String(value === undefined ? '' : value);
      field.readOnly = !editable;
      field.addEventListener('input', () => {
        if (!editable) return;
        const lines = field.value.split('\n');
        table[key] = lines.length > 1 ? lines : field.value;
        validate();
      });
      box.appendChild(field);
      host.appendChild(box);
    }
  }

  function renderAll() {
    if (!current) return;
    renderGameSheet();
    renderMemoryMap();
    renderRooms();
    renderObjects();
    renderRules();
    renderStrings();
    renderPresentation();
  }

  /* ---------------- validate and build ---------------- */
  function validate() {
    if (!current) return null;
    const result = ml.validator.validate(current);
    readout(ml.validator.report(result), result.ok ? (result.warnings.length ? '' : 'ok') : 'bad');
    $('btn-build').disabled = !result.ok || sourceState !== 'ready';
    updateEditorStatus();
    return result;
  }

  function build() {
    if (!current) return;
    if (sourceState !== 'ready') {
      readout('The Workshop has not finished reading its own source files.', 'bad');
      return;
    }
    const check = validate();
    if (!check.ok) {
      lamp('lamp-image', 'HALTED', 'out');
      return;
    }
    lamp('lamp-image', 'COMPILING', 'busy');
    let html;
    try {
      html = ml.compiler.compile({ cartridge: current, sources, allowDataCartridge: editable });
    } catch (err) {
      lamp('lamp-image', 'HALTED', 'out');
      readout(String(err.message || err), 'bad');
      return;
    }

    const name = ml.compiler.filename(current);
    const report = ml.compiler.inspect(html);
    const plan = ml.bundle.filesFor(current);
    ml.compiler.download(html, name);

    lamp('lamp-image', Math.round(html.length / 1024) + 'K', 'lit');
    readout(ml.compiler.buildLog(current, html, plan) + '\n\n' + [
      'ADVENTURE IMAGE CREATED — ' + name,
      '',
      'The file is in your downloads folder. It needs no server, no',
      'network and no installation: open it and it plays. Copy it to a',
      'disk and it is archived.'
    ].join('\n'), report.selfContained ? 'ok' : 'bad');
  }

  function blankCartridge() {
    return {
      format: 'morrowlamp-cartridge',
      formatVersion: 2,
      meta: { id: 'my-adventure', title: 'A NEW ADVENTURE', author: '', version: '0.1.0', blurb: '' },
      intro: ['A door waits in the mist.'],
      startFlags: { doorOpened: false },
      world: {
        startRoom: 'threshold',
        startInventory: [],
        rooms: {
          threshold: {
            name: 'The Threshold', desc: 'A door waits in the mist, shut.', short: 'The threshold.',
            exits: { n: { room: 'beyond', flagReq: 'doorOpened', deny: 'The door is shut.' } }
          },
          beyond: { name: 'Beyond', desc: 'Past the door, the mist thins and something is finally visible.', exits: { s: 'threshold' } }
        },
        objects: {
          door: { name: 'door', aliases: ['door'], at: 'threshold', desc: 'A shut door stands in the mist.', examine: 'An ordinary door in an unlikely place.' }
        }
      },
      vocabulary: {
        verbs: {
          /* `push` is not one of the Machine's core verbs — a game that
             wants it must say so. The validator will tell you if a rule
             ever matches a verb nobody taught the parser. */
          push: { words: ['push', 'press', 'shove'], form: 'target', prompt: 'Push what?', fallback: 'It does not budge.' }
        }
      },
      rules: [{
        id: 'open-the-door', verb: ['open', 'push'], target: 'door',
        when: { flags: { doorOpened: false } },
        do: [{ set: 'doorOpened' }, { say: 'The door swings open. North it is.' }],
        otherwise: [{ say: 'It is already open.' }]
      }],
      profile: { score: { enabled: true, ranks: [[0, 'Visitor'], [10, 'Arrived']] } },
      endings: [{ id: 'through', kind: 'win', when: { room: 'beyond' }, score: 10, text: ['You are through. That is the whole adventure. Now make a bigger one.'] }],
      presentation: {
        renderer: 'ega', audio: 'chip', interface: 'parser',
        art: { scene: {
          threshold: { environment: 'stone_chamber', perspective: 'interior', features: [{ type: 'door', position: 'north', style: 'wood', object: 'door' }] },
          beyond: { environment: 'wood_room', perspective: 'interior', features: [] }
        } }
      }
    };
  }

  /* ---------------- loading a cartridge ----------------
     The other half of "Save cartridge (JSON)". Without it the Workshop
     could write work it could never read back, which made it a machine
     for producing games and not one for making them. A file arriving
     from a text editor, or from somebody else's, comes in the same way:
     it is checked before it reaches the bench, so a broken file explains
     itself in the diagnostics panel instead of throwing to the console. */
  function acceptCartridge(text, name) {
    /* The decision belongs to `ml.import.read`, which parses, checks the
       format and the version, validates, and mutates nothing. This
       function does the two things that are actually the Workshop's
       business: printing the verdict, and — only when the verdict is
       yes — putting the cartridge on the shelf.

       Nothing above this line can touch Z.cartridges or the bench, which
       is why a refused file cannot leave the Workshop half-changed. */
    const result = ml.import.read(text, { name, taken: Object.keys(Z.cartridges) });
    if (!result.ok) {
      readout(result.report, 'bad');
      return result;
    }

    const cartridge = result.cartridge;
    cartridge.meta = cartridge.meta || {};
    cartridge.meta.id = result.id;
    Z.cartridges[result.id] = cartridge;
    renderShelf();
    insert(result.id);
    readout(result.report +
      '\n\nLOADED ' + (name || result.id) +
      '\nInserted as "' + result.id + '" and ready to edit.',
    result.findings.some((f) => f.severity === 'warning') ? '' : 'ok');
    return result;
  }

  function readFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => acceptCartridge(String(reader.result), file.name);
    reader.onerror = () => readout('DISK ERROR — could not read ' + file.name, 'bad');
    reader.readAsText(file);
  }

  /* ---------------- proving it can be finished ----------------
     Kept out of validate(), which runs on every keystroke and promises
     to be instant. Playing a whole adventure is neither. */
  function prove() {
    if (!current) return;
    const check = validate();
    if (!check.ok) return;
    if (!ml.prove) { readout('The prover is not loaded.', 'bad'); return; }
    lamp('lamp-image', 'PROVING', 'busy');
    let result;
    try {
      result = ml.prove.run(current);
    } catch (err) {
      lamp('lamp-image', 'FAULT', 'out');
      readout('THE MACHINE FAULTED WHILE PLAYING\n  ' + (err.message || err), 'bad');
      return;
    }
    lamp('lamp-image', result.walkthrough.declared ? (result.ok ? 'PROVED' : 'FAILED') : '—',
      result.walkthrough.declared ? (result.ok ? 'lit' : 'out') : '');
    readout(ml.prove.report(result), result.ok ? (result.findings.length ? '' : 'ok') : 'bad');
  }

  /* ---------------- playing it on the bench ----------------
     The same mount a compiled adventure uses, pointed at a panel
     instead of at the whole document. Nothing here is a preview: it is
     the cartridge, on the Machine, through the shell it declared. */
  function stopTest() {
    const stage = $('test-stage');
    stage.textContent = '';
    /* Each shell dresses its own root. Take the costume off, or the
       empty panel keeps the last game's styling and the next mount
       inherits it. */
    stage.className = '';
    $('btn-test-stop').disabled = true;
  }

  function startTest() {
    if (!current) return;
    const check = validate();
    if (!check.ok) {
      readout(ml.validator.report(check) + '\n\nNothing will be played until that is fixed.', 'bad');
      return;
    }
    stopTest();
    const plan = ml.bundle.filesFor(current);
    const mount = plan.shell === 'canvas' ? ml.shellCanvas : ml.shellParser;
    if (!mount) { readout('The ' + plan.shell + ' shell is not loaded.', 'bad'); return; }
    const stage = $('test-stage');
    try {
      mount.mount({ cartridge: current, root: stage });
    } catch (err) {
      stopTest();
      readout('THE SHELL FAULTED\n  ' + (err.message || err), 'bad');
      return;
    }
    $('btn-test-stop').disabled = false;
    readout('PLAYING ' + current.meta.title + ' on the ' + plan.shell.toUpperCase() + ' shell.\n' +
      'This is the cartridge as the Machine runs it. Stop when you have seen enough.', 'ok');
  }

  /* ---------------- add buttons ---------------- */
  function uniqueId(bag, stem) {
    let n = 1;
    while (bag[stem + n]) n++;
    return stem + n;
  }

  $('btn-new').addEventListener('click', () => {
    const cart = blankCartridge();
    let id = cart.meta.id, n = 1;
    while (Z.cartridges[id]) id = cart.meta.id + '-' + (++n);
    cart.meta.id = id;
    Z.cartridges[id] = cart;
    renderShelf();
    insert(id);
  });

  $('btn-add-room').addEventListener('click', () => {
    if (!current || !editable) return;
    edit('add room', () => {
      const id = uniqueId(current.world.rooms, 'room');
      current.world.rooms[id] = { name: 'New Room', desc: 'Nothing has been written here yet.', exits: {} };
      if (current.presentation && current.presentation.art && current.presentation.art.scene && typeof current.presentation.art.scene === 'object') {
        current.presentation.art.scene[id] = { environment: 'stone_chamber', perspective: 'interior', features: [] };
      }
      selection.room = id;
      renderAll();
    });
  });

  $('btn-add-object').addEventListener('click', () => {
    if (!current || !editable) return;
    edit('add object', () => {
      const id = uniqueId(current.world.objects, 'thing');
      current.world.objects[id] = {
        name: 'new thing', aliases: ['thing'], at: current.world.startRoom,
        takeable: true, desc: 'A new thing lies here.', examine: 'Nothing has been written about it yet.'
      };
      selection.object = id;
      renderAll();
    });
  });

  $('btn-add-rule').addEventListener('click', () => {
    if (!current || !editable) return;
    edit('add rule', () => {
      current.rules = current.rules || [];
      current.rules.push({
        id: 'rule-' + (current.rules.length + 1),
        verb: 'look', target: Object.keys(current.world.objects)[0] || null,
        do: [{ say: 'Nothing happens yet.' }]
      });
      selection.rule = current.rules.length - 1;
      renderRules();
    });
  });

  $('btn-add-string').addEventListener('click', () => {
    if (!current || !editable) return;
    edit('add string', () => {
      current.strings = current.strings || {};
      const key = uniqueId(current.strings, 'line');
      current.strings[key] = 'Nothing has been written here yet.';
      renderStrings();
    });
  });

  $('btn-load').addEventListener('click', () => $('file-cart').click());
  $('file-cart').addEventListener('change', (event) => {
    readFile(event.target.files && event.target.files[0]);
    /* Cleared so loading the same file twice in a row still fires. */
    event.target.value = '';
  });

  /* Dropping the file on the slot is the same path as choosing it. */
  const slot = $('cart-list').parentNode;
  for (const name of ['dragenter', 'dragover']) {
    slot.addEventListener(name, (event) => { event.preventDefault(); slot.style.outline = '1px dashed currentColor'; });
  }
  for (const name of ['dragleave', 'drop']) {
    slot.addEventListener(name, () => { slot.style.outline = ''; });
  }
  slot.addEventListener('drop', (event) => {
    event.preventDefault();
    readFile(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]);
  });

  $('btn-prove').addEventListener('click', prove);
  $('btn-test-start').addEventListener('click', startTest);
  $('btn-test-stop').addEventListener('click', stopTest);
  $('btn-test-stop').disabled = true;

  $('btn-undo').addEventListener('click', () => {
    if (!current || !editable) return;
    const next = history.undo(current);
    if (next) replaceCurrent(next);
  });
  $('btn-redo').addEventListener('click', () => {
    if (!current || !editable) return;
    const next = history.redo(current);
    if (next) replaceCurrent(next);
  });
  $('btn-recover').addEventListener('click', () => {
    if (!current || !editable) return;
    const next = history.recover(current);
    if (!next) return;
    history.begin(next);
    replaceCurrent(next);
    readout('DRAFT RECOVERED — the last locally saved version is back on the bench.', 'ok');
  });

  $('btn-validate').addEventListener('click', validate);
  $('btn-build').addEventListener('click', build);
  $('btn-json').addEventListener('click', () => {
    if (!current) return;
    const blob = new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = current.meta.id + '.cartridge.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => {
      for (const other of document.querySelectorAll('.tab')) other.classList.toggle('on', other === tab);
      for (const sheet of document.querySelectorAll('.sheet')) {
        sheet.classList.toggle('on', sheet.id === 'sheet-' + tab.getAttribute('data-sheet'));
      }
    });
  }

  /* ---------------- boot ---------------- */
  $('engine-stamp').textContent = 'MORROWLAMP MACHINE ' + ml.VERSION + ' · COMPILER ' + ml.compiler.COMPILER_VERSION;
  bindFields();
  renderShelf();
  preload();
  insert('the-sunken-crown');
})(window);
