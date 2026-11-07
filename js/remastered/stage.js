/* ============================================================
   THE SUNKEN CROWN, REMASTERED — the stage
   A pre-rendered room relit live, with a real 3D actor in it.

   The room is one full-screen quad. Its shader reconstructs every
   pixel's world position from the depth pass, adds the player's
   lantern (diffuse light with screen-space shadows, and a halo in
   the air), and writes gl_FragDepth, so the hero is hidden by the
   cabinet exactly where Blender says the cabinet is.
   ============================================================ */
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';

const ROOM_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const ROOM_FRAG = /* glsl */`
uniform sampler2D tBeauty, tAlbedo, tNormal, tEmit, tData;
uniform mat4 camWorld, camProj, camView;
uniform vec2 tanHalf;
uniform float depthRange, exposure, blackout, time;
uniform vec3 lanternPos, lanternColor;
uniform float lanternPower, lanternReach, haze;
varying vec2 vUv;

vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 unReinhard(vec3 c) { c = min(c, vec3(0.996)); return c / (1.0 - c); }

float depthAt(vec2 tuv) {
  vec4 d = texture2D(tData, tuv);
  return (floor(d.r * 255.0 + 0.5) * 256.0 + floor(d.g * 255.0 + 0.5)) / 65535.0 * depthRange;
}

/* March from the surface toward the lantern in screen space; anything
   in the depth pass standing in front of the ray casts a shadow. */
float shadow(vec3 world, vec3 lamp) {
  float lit = 1.0;
  for (int i = 1; i <= 14; i++) {
    float t = float(i) / 15.0;
    vec3 p = mix(world, lamp, t);
    vec4 v = camView * vec4(p, 1.0);
    vec4 c = camProj * v;
    vec2 s = c.xy / c.w * 0.5 + 0.5;
    if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) continue;
    float scene = depthAt(vec2(s.x, 1.0 - s.y));
    float rayDepth = -v.z;
    float gap = rayDepth - scene;
    float occluded = smoothstep(0.04, 0.12, gap) * (1.0 - smoothstep(0.7, 1.4, gap));
    lit = min(lit, 1.0 - occluded * 0.85);
  }
  return lit;
}

void main() {
  vec2 tuv = vec2(vUv.x, 1.0 - vUv.y);
  float depth = depthAt(tuv);
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 view = vec3(ndc * tanHalf * depth, -depth);
  vec3 world = (camWorld * vec4(view, 1.0)).xyz;

  vec3 beauty = unReinhard(toLin(texture2D(tBeauty, tuv).rgb));
  vec3 albedo = toLin(texture2D(tAlbedo, tuv).rgb);
  vec3 emit = unReinhard(toLin(texture2D(tEmit, tuv).rgb));
  vec3 n = normalize(texture2D(tNormal, tuv).rgb * 2.0 - 1.0);

  vec3 lit = beauty * blackout;
  if (lanternPower > 0.0) {
    vec3 toLamp = lanternPos - world;
    float dist = max(length(toLamp), 0.05);
    vec3 L = toLamp / dist;
    float wrap = max(dot(n, L) * 0.8 + 0.2, 0.0);
    float fall = lanternPower / (dist * dist + 0.25) * (1.0 - smoothstep(lanternReach * 0.55, lanternReach, dist));
    float s = fall > 0.002 ? shadow(world, lanternPos) : 1.0;
    lit += albedo * lanternColor * wrap * fall * s * exposure;

    /* The lantern's glow in the dust: closest approach of the view ray. */
    vec3 ro = camWorld[3].xyz;
    vec3 rd = normalize(world - ro);
    float along = clamp(dot(lanternPos - ro, rd), 0.0, length(world - ro));
    float miss = length(ro + rd * along - lanternPos);
    lit += lanternColor * haze * lanternPower * exposure * 0.012 / (miss * miss + 0.015);
  }
  lit += emit;
  gl_FragColor = vec4(toSrgb(lit / (1.0 + lit)), 1.0);

  vec4 clip = camProj * vec4(view, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
}
`;

function texture(canvas, nearest) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace;
  t.flipY = false;
  t.generateMipmaps = false;
  t.minFilter = t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  return t;
}

export function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createStage(canvas, options) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ReinhardToneMapping;   // the same curve the passes were encoded with

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1.6, 0.1, 60);

  const uniforms = {
    tBeauty: { value: null }, tAlbedo: { value: null }, tNormal: { value: null }, tEmit: { value: null }, tData: { value: null },
    camWorld: { value: new THREE.Matrix4() }, camProj: { value: new THREE.Matrix4() }, camView: { value: new THREE.Matrix4() },
    tanHalf: { value: new THREE.Vector2(1, 1) }, depthRange: { value: 40 }, exposure: { value: 1 }, blackout: { value: 1 },
    time: { value: 0 }, lanternPos: { value: new THREE.Vector3() }, lanternColor: { value: new THREE.Color(1.0, 0.62, 0.3) },
    lanternPower: { value: 0 }, lanternReach: { value: 7 }, haze: { value: 1 }
  };
  const roomMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms, vertexShader: ROOM_VERT, fragmentShader: ROOM_FRAG, depthTest: false, depthWrite: true, toneMapped: false
  }));
  roomMesh.frustumCulled = false;
  roomMesh.renderOrder = -10;
  roomMesh.visible = false;
  scene.add(roomMesh);

  const hemi = new THREE.HemisphereLight(0x8899cc, 0x221811, 0.6);
  const moon = new THREE.DirectionalLight(0xa0b8ff, 0.8);
  scene.add(hemi, moon, moon.target);

  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, toneMapped: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.renderOrder = 1;
  scene.add(blob);

  /* ---------------- the hero ---------------- */
  const hero = { root: new THREE.Group(), mixer: null, actions: {}, current: null, lantern: null, light: null };
  hero.root.visible = false;
  scene.add(hero.root);
  const ready = new GLTFLoader().loadAsync(options.heroUrl).then((gltf) => {
    hero.root.add(gltf.scene);
    gltf.scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; } });
    hero.mixer = new THREE.AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) hero.actions[clip.name] = hero.mixer.clipAction(clip);
    hero.lantern = gltf.scene.getObjectByName('LanternLight');
    hero.light = new THREE.PointLight(0xffa060, 0, 9, 2);
    hero.lantern.add(hero.light);
    play('Idle');
  });

  function play(name, fade = 0.2) {
    const next = hero.actions[name];
    if (!next || hero.current === next) return;
    next.reset().fadeIn(fade).play();
    if (hero.current) hero.current.fadeOut(fade);
    hero.current = next;
  }

  /* ---------------- room ---------------- */
  let room = null;
  const textures = {};
  const W = 1280, H = 800;

  function setRoom(next) {
    room = next;
    roomMesh.visible = !!room;
    hero.root.visible = !!room;
    blob.visible = !!room;
    if (!room) return;
    for (const k of Object.keys(textures)) textures[k].dispose();
    for (const p of ['beauty', 'albedo', 'normal', 'emit', 'data']) {
      textures[p] = texture(room.canvases[p], p === 'data');
      uniforms['t' + p[0].toUpperCase() + p.slice(1)].value = textures[p];
    }
    const cam = room.manifest.camera;
    const m = new THREE.Matrix4().fromArray(cam.matrix);
    m.decompose(camera.position, camera.quaternion, camera.scale);
    camera.fov = cam.fov;
    camera.aspect = cam.aspect;
    camera.near = cam.near;
    camera.far = cam.far;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    uniforms.camWorld.value.copy(camera.matrixWorld);
    uniforms.camView.value.copy(camera.matrixWorldInverse);
    uniforms.camProj.value.copy(camera.projectionMatrix);
    const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    uniforms.tanHalf.value.set(tv * cam.aspect, tv);
    uniforms.depthRange.value = cam.depthRange;
    uniforms.exposure.value = Math.pow(2, room.manifest.exposure || 0);
    renderer.toneMappingExposure = uniforms.exposure.value;

    const lights = room.manifest.lights || {};
    const amb = lights.ambient || [0.1, 0.1, 0.15];
    hemi.color.setRGB(amb[0] * 4, amb[1] * 4, amb[2] * 4);
    const key = lights.key;
    if (key) {
      moon.color.setRGB(...key.color);
      moon.intensity = key.intensity;
      moon.position.set(-key.dir[0], -key.dir[1], -key.dir[2]).multiplyScalar(10);
    }
  }

  function refreshTextures() {
    for (const k of Object.keys(textures)) textures[k].needsUpdate = true;
  }

  /* ---------------- per frame ---------------- */
  const clock = new THREE.Clock();
  const lampWorld = new THREE.Vector3();
  let lamp = { on: false, low: false };

  function setLantern(state) { lamp = state; }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    uniforms.time.value = t;
    if (hero.mixer) hero.mixer.update(dt);
    if (options.onFrame) options.onFrame(dt, t);

    let power = 0;
    if (lamp.on && hero.lantern && hero.root.visible) {
      const flicker = 1 + Math.sin(t * 13.1) * 0.03 + Math.sin(t * 7.3) * 0.04 +
        (lamp.low ? Math.max(0, Math.sin(t * 2.3)) * Math.sin(t * 31) * 0.35 : 0);
      power = (lamp.low ? 0.55 : 0.8) * flicker;
      hero.lantern.getWorldPosition(lampWorld);
    }
    uniforms.lanternPower.value = power;
    uniforms.lanternPos.value.copy(lampWorld);
    if (hero.light) hero.light.intensity = power * 3.2;
    uniforms.blackout.value = lamp.pitchBlack ? 0.04 : 1.0;
    blob.position.set(hero.root.position.x, 0.012, hero.root.position.z);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
  }
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  /* Screen pixel (in room image space, 1280x800) to a point on the floor. */
  const ray = new THREE.Raycaster();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function floorAt(px, py) {
    ray.setFromCamera(new THREE.Vector2(px / W * 2 - 1, 1 - py / H * 2), camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(floor, hit) ? hit : null;
  }

  return { renderer, scene, setRoom, refreshTextures, hero, play, setLantern, floorAt, ready, THREE };
}
