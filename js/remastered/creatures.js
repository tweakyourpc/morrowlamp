/* ============================================================
   THE SUNKEN CROWN, REMASTERED — creatures
   The things that come for you, built here from primitives: they
   cost nothing to download, and the hero's lantern lights them the
   way it lights the hero.

     lurker   pale, lumpy, segmented, eight jointed legs, a cluster
              of black eyes and mandibles that click. It unfolds out
              of the ground, lunges, flinches white, curls up to die.
     umbra    smoke that has decided to be someone: a slow swirl of
              dark with a faint violet edge, and two red eyes that
              open last.

   Presentation only. The runtime fights the fight; this acts it
   out: spawn, attack, hurt, die, leave.
   ============================================================ */
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ease = (x) => x * x * (3 - 2 * x);
const pulse = (x) => Math.sin(Math.PI * Math.min(1, Math.max(0, x)));

function glowTexture(rgb) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(' + rgb + ',1)');
  grad.addColorStop(0.35, 'rgba(' + rgb + ',0.35)');
  grad.addColorStop(1, 'rgba(' + rgb + ',0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function shadowBlob(texture, size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  m.renderOrder = 1;
  return m;
}

/* ---------------- the cave lurker ---------------- */

function lurker(blobTex) {
  const rand = rng(0x1c4e);
  const root = new THREE.Group();          // stands on the floor, faces +z
  const body = new THREE.Group();
  root.add(body, shadowBlob(blobTex, 1.9));
  const shell = new THREE.MeshStandardMaterial({ color: 0xd8d0bf, roughness: 0.4, metalness: 0.0 });
  const limb = new THREE.MeshStandardMaterial({ color: 0xa69d8b, roughness: 0.55 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.06, metalness: 0.5 });

  /* Chitin: a sphere pushed about by a few crossed waves, so no two
     plates are smooth or the same. */
  const lump = (s, at, amp = 0.07) => {
    const g = new THREE.SphereGeometry(1, 30, 20);
    const p = g.attributes.position;
    const k = [rand() * 6, rand() * 6, rand() * 6];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 1 + amp * Math.sin(5 * x + k[0]) * Math.sin(4 * y + k[1]) * Math.sin(6 * z + k[2]);
      p.setXYZ(i, x * s[0] * n, y * s[1] * n, z * s[2] * n);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, shell);
    m.position.set(...at);
    body.add(m);
    return m;
  };
  lump([0.4, 0.25, 0.34], [0, 0.36, 0]);                       // thorax
  lump([0.25, 0.19, 0.24], [0, 0.33, 0.36]);                   // head
  for (let k = 0; k < 4; k++) {                                // abdomen, in plates
    lump([0.46 - 0.07 * k, 0.27 - 0.035 * k, 0.21], [0, 0.4 - 0.03 * k, -0.3 - 0.19 * k], 0.05);
  }

  for (const [x, y, r] of [[-0.07, 0.44, 0.03], [0.07, 0.44, 0.03], [-0.13, 0.41, 0.022], [0.13, 0.41, 0.022],
    [-0.04, 0.38, 0.018], [0.04, 0.38, 0.018]]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), eye);
    e.position.set(x, y, 0.56);
    body.add(e);
  }

  const mandibles = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.09, 0.27, 0.55);
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 8), limb);
    m.rotation.x = Math.PI / 2 + 0.5;                          // forward and down
    m.position.set(0, -0.04, 0.09);
    pivot.add(m);
    body.add(pivot);
    return { pivot, side };
  });

  const feelers = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1, 0.46, 0.5);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.6, 6), limb);
    f.position.y = 0.3;
    pivot.add(f);
    pivot.rotation.set(1.0, 0, side * -0.5);
    body.add(pivot);
    return { pivot, side };
  });

  /* Eight legs. Each is built along +x and turned to its side; the
     knee folds it down to the ground. */
  const L1 = 0.45, L2 = 0.68;
  const legs = [];
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.28, 0.36, 0.2 - k * 0.17);
      hip.rotation.y = (side > 0 ? 0 : Math.PI) + side * (0.55 - k * 0.37);
      const upper = new THREE.Group();
      const u = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.036, L1, 8), limb);
      u.rotation.z = -Math.PI / 2;
      u.position.x = L1 / 2;
      const knee = new THREE.Group();
      knee.position.x = L1;
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.026, L2, 7), limb);
      l.rotation.z = -Math.PI / 2;
      l.position.x = L2 / 2;
      knee.add(l, new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), shell));
      upper.add(u, knee);
      hip.add(upper);
      body.add(hip);
      legs.push({ hip, upper, knee, phase: rand() * 6.28, baseY: hip.rotation.y });
    }
  }

  let fold = 1;          // 1 folded flat, 0 standing
  let flash = 0;
  return {
    root, mats: [shell, limb],
    height: 0.6,
    pose(t, s) {
      // s: { rise 0..1, lunge 0..1, rear 0..1, recoil 0..1, curl 0..1, sink 0..1, hurt 0..1 }
      fold = 1 - s.rise + s.curl;
      flash = s.hurt;
      body.position.y = (s.rise - 1) * 0.55 - s.curl * 0.2 - s.sink * 0.6 + Math.sin(t * 2.2) * 0.015 * (1 - s.curl);
      body.position.z = s.lunge * 0.5 - s.recoil * 0.22;
      body.rotation.x = -0.4 * s.rear;
      body.rotation.z = 0.45 * s.curl;
      for (const leg of legs) {
        const twitch = (1 - s.curl) * Math.sin(t * 3.1 + leg.phase) * 0.07;
        leg.upper.rotation.z = 0.75 - fold * 0.65 + twitch + s.rear * 0.2;
        leg.knee.rotation.z = -2.05 + fold * 1.1 + s.curl * 0.6 - twitch * 0.5;
        leg.hip.rotation.y = leg.baseY + Math.sin(t * 1.7 + leg.phase) * 0.05 * (1 - s.curl);
      }
      const click = (1 - s.curl) * (0.12 + 0.1 * Math.max(0, Math.sin(t * 9)) * (Math.sin(t * 0.7) > 0.3 ? 1 : 0.2));
      for (const m of mandibles) m.pivot.rotation.y = m.side * click;
      for (const f of feelers) f.pivot.rotation.z = f.side * (-0.5 + Math.sin(t * 1.3 + f.side) * 0.15);
      for (const m of [shell, limb]) m.emissive.setRGB(flash * 0.7, flash * 0.7, flash * 0.65);
    }
  };
}

/* ---------------- the umbra ---------------- */

function umbra(pointScale) {
  const rand = rng(0x0b1a);
  const root = new THREE.Group();
  const N = 900;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    // An ellipsoid of smoke, thickest at its heart.
    const u = rand() * 2 - 1, a = rand() * Math.PI * 2, r = Math.pow(rand(), 0.6);
    const q = Math.sqrt(1 - u * u);
    pos.set([q * Math.cos(a) * 0.48 * r, 1.15 + u * 0.82 * r, q * Math.sin(a) * 0.36 * r], i * 3);
    seed[i] = rand() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const uniforms = { time: { value: 0 }, presence: { value: 0 }, hurt: { value: 0 }, scale: { value: 1 }, spread: { value: 0 } };
  const vert = /* glsl */`
    attribute float seed; uniform float time, scale, spread; varying float vSeed; varying float vLow;
    void main() {
      vec3 p = position;
      float a = time * 0.5 + seed;
      p.x += sin(a * 1.3) * 0.07; p.z += cos(a * 1.1) * 0.07;
      float low = clamp((1.0 - p.y) * 1.6, 0.0, 1.0);                 // the bottom streams away
      p.y -= low * fract(time * 0.18 + seed * 0.37) * 0.6;
      p += normalize(p - vec3(0.0, 1.15, 0.0) + 0.001) * spread * (0.5 + fract(seed) * 1.5);
      vSeed = seed; vLow = low;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = scale * (110.0 + fract(seed * 3.1) * 130.0) / -mv.z;   // big and soft, so they merge into one shape
      gl_Position = projectionMatrix * mv;
    }`;
  const smoke = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms, vertexShader: vert, transparent: true, depthWrite: false, toneMapped: false,
    fragmentShader: /* glsl */`
      uniform float presence; varying float vLow;
      void main() { float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
        float soft = (1.0 - r * 2.0) * (1.0 - r * 2.0);
        gl_FragColor = vec4(0.01, 0.0, 0.018, presence * (0.11 - vLow * 0.06) * soft); }`
  }));
  const rim = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms, vertexShader: vert, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
    fragmentShader: /* glsl */`
      uniform float presence, hurt; varying float vSeed;
      void main() { float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
        float edge = step(0.9, fract(vSeed * 7.13));
        vec3 c = mix(vec3(0.16, 0.02, 0.22), vec3(0.9, 0.8, 1.0), hurt);
        float soft = (1.0 - r * 2.0) * (1.0 - r * 2.0);
        gl_FragColor = vec4(c * presence * edge * (0.12 + hurt * 0.5) * soft, 1.0); }`
  }));
  smoke.frustumCulled = rim.frustumCulled = false;
  smoke.renderOrder = 3;
  rim.renderOrder = 4;
  root.add(smoke, rim);

  const glow = glowTexture('255,40,20');
  const eyes = [-1, 1].map((side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.1, 1.58, 0.3);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3018, toneMapped: false }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.scale.set(0.28, 0.28, 1);
    g.add(ball, halo);
    root.add(g);
    return g;
  });

  return {
    root, height: 1.6, mats: [],
    pose(t, s) {
      uniforms.time.value = t;
      uniforms.scale.value = pointScale();
      uniforms.presence.value = s.rise * (1 - s.sink) * (1 - s.curl);
      uniforms.hurt.value = s.hurt;
      uniforms.spread.value = s.curl * 1.2 + s.lunge * 0.15;
      root.position.y = Math.sin(t * 0.9) * 0.04;
      root.children[0].position.z = root.children[1].position.z = s.lunge * 0.6 - s.recoil * 0.3;
      // The eyes open last, blink now and then, and go out first.
      const open = Math.max(0, (s.rise - 0.75) * 4) * (1 - s.curl) * (1 - s.sink);
      const blink = (t % 5.3) < 0.12 ? 0.1 : 1;
      for (const e of eyes) {
        e.scale.set(open, open * blink, open);
        e.position.z = 0.3 + s.lunge * 0.6 - s.recoil * 0.3;
      }
    }
  };
}

/* ---------------- the cast ---------------- */

const BUILD = { lurker, umbra };
const TIMES = { rise: 1.5, attack: 0.7, hurt: 0.4, die: 1.6, leave: 1.3 };

export function createCreatures(stage, blobTexture) {
  const blobTex = blobTexture();
  const pointScale = () => stage.renderer.getPixelRatio() * stage.renderer.domElement.clientHeight / 800;
  let cur = null;      // { id, c, clock, acts: [{name, at}], ending }

  function clear() {
    if (!cur) return;
    stage.scene.remove(cur.c.root);
    cur.c.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    cur = null;
  }

  /* Bring `id` on at `at` (three.js floor point), facing `toward`. */
  function spawn(id, at, toward) {
    clear();
    const make = BUILD[id] || BUILD.lurker;
    const c = id === 'umbra' ? make(pointScale) : make(blobTex);
    c.root.position.set(at[0], 0, at[2]);
    c.root.rotation.y = Math.atan2(toward[0] - at[0], toward[2] - at[2]);
    stage.scene.add(c.root);
    cur = { id, c, clock: 0, acts: [{ name: 'rise', at: 0 }], ending: null };
  }

  function act(name) {
    if (!cur || cur.ending) return;
    if (name === 'die' || name === 'leave') cur.ending = name;
    cur.acts.push({ name, at: cur.clock });
  }

  function update(dt, t) {
    if (!cur) return;
    cur.clock += dt;
    const s = { rise: 0, lunge: 0, rear: 0, recoil: 0, curl: 0, sink: 0, hurt: 0 };
    for (const a of cur.acts) {
      const k = (cur.clock - a.at) / TIMES[a.name];
      if (a.name === 'rise') s.rise = ease(Math.min(1, k));
      if (a.name === 'attack') { s.lunge = Math.max(s.lunge, pulse(k)); s.rear = Math.max(s.rear, pulse(k * 1.4)); }
      if (a.name === 'hurt') { s.recoil = Math.max(s.recoil, pulse(k)); s.hurt = Math.max(s.hurt, k < 1 ? 1 - k : 0); }
      if (a.name === 'die') s.curl = ease(Math.min(1, k));
      if (a.name === 'leave') s.sink = ease(Math.min(1, k));
    }
    cur.acts = cur.acts.filter((a) => a.name === 'rise' || a.name === 'die' || a.name === 'leave' ||
      cur.clock - a.at < TIMES[a.name]);
    cur.c.pose(t, s);
    // A lurker that has died stays where it fell; anything that left, or an umbra undone, goes.
    const gone = cur.acts.find((a) => (a.name === 'leave' || (a.name === 'die' && cur.id === 'umbra')) &&
      cur.clock - a.at > TIMES[a.name]);
    if (gone) clear();
  }

  return {
    spawn, act, clear, update,
    showing: () => (cur ? cur.id : null),
    ending: () => !!(cur && cur.ending)
  };
}
