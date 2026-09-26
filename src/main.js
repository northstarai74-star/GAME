import * as THREE from 'three';
import './style.css';
import { createSky } from './world/sky.js';
import { createSun } from './world/sun.js';
import { createPlanets } from './world/planets.js';
import { createAsteroidBelt } from './world/asteroids.js';
import { createStation } from './world/station.js';
import { createCores } from './world/cores.js';
import { createShip } from './ship.js';
import { createExhaust } from './effects/exhaust.js';
import { createBursts } from './effects/bursts.js';
import { createPostFX } from './postfx.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHUD, fmtTime } from './hud.js';
import { mulberry32 } from './noise.js';

const SECTOR_RADIUS = 4200;
const START = new THREE.Vector3(344, 40, 258);
const START_DIR = new THREE.Vector3(0.8, 0, 0.6).normalize();

const canvas = document.getElementById('game');
const ui = {
  hud: document.getElementById('hud'),
  overlay: document.getElementById('overlay'),
  loading: document.getElementById('loading'),
  loadingText: document.getElementById('loading-text'),
  start: document.getElementById('start'),
  result: document.getElementById('result'),
  tagline: document.getElementById('tagline'),
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.5, 40000);
const post = createPostFX(renderer, scene, camera);
const input = createInput(canvas);
const audio = createAudio();
const hud = createHUD();
const clock = new THREE.Clock();

let world = null;
let state = 'loading';
let elapsed = 0;
let collected = 0;
let combo = 0;
let comboTimer = 0;
let shake = 0;
let impactCooldown = 0;
let camBlend = 0;
let warnCooldown = 0;

const setLoading = (text) => {
  ui.loadingText.textContent = text;
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
};

async function buildWorld() {
  await setLoading('Igniting star…');
  const sky = createSky(renderer);
  scene.add(sky.group, sky.dust);
  const sun = createSun();
  scene.add(sun.group);
  scene.add(new THREE.AmbientLight(0x4a5577, 0.5));
  scene.add(new THREE.HemisphereLight(0x6a7cff, 0x2a0f35, 0.45));

  const planets = await createPlanets(sun.position, setLoading);
  planets.filter((p) => p.kind === 'planet').forEach((p) => scene.add(p.root));

  await setLoading('Seeding asteroid belt…');
  const belt = createAsteroidBelt();
  scene.add(belt.group);

  const station = createStation(sky.envMap);
  station.root.position.set(470, 55, 300);
  scene.add(station.root);

  const bodies = [...planets, station];
  const cores = createCores({ rng: mulberry32(2024), count: 30, start: START, forward: START_DIR, bodies });
  scene.add(cores.group);

  const ship = createShip(sky.envMap);
  ship.object.position.copy(START);
  ship.object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), START_DIR);
  scene.add(ship.object);

  const exhaust = createExhaust();
  scene.add(exhaust.points);
  const bursts = createBursts();
  scene.add(bursts.group);

  return { sky, sun, planets, belt, station, bodies, cores, ship, exhaust, bursts, camQuat: ship.quaternion.clone() };
}

function showOverlay(mode) {
  ui.overlay.classList.remove('hidden');
  ui.overlay.dataset.mode = mode;
  ui.loading.classList.add('hidden');
  ui.start.classList.remove('hidden');
  ui.start.textContent = mode === 'paused' ? 'RESUME' : mode === 'won' ? 'FLY AGAIN' : 'LAUNCH';
  ui.hud.classList.toggle('hidden', mode === 'menu' || mode === 'won');
}

function startOrResume() {
  if (state === 'won') {
    window.location.reload();
    return;
  }
  audio.init();
  input.lock();
  ui.overlay.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  if (state === 'menu') {
    world.camQuat.copy(camera.quaternion);
    audio.launch();
    hud.flash('FOLLOW THE CYAN MARKER TO THE NEAREST ENERGY CORE', 'info', 5);
  }
  state = 'playing';
}

function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  input.unlock();
  audio.suspend();
  showOverlay('paused');
}

function win() {
  state = 'won';
  input.unlock();
  audio.win();
  let best = null;
  try {
    best = Number(localStorage.getItem('stellar-drift-best')) || null;
    if (!best || elapsed < best) {
      localStorage.setItem('stellar-drift-best', String(elapsed));
      best = elapsed;
    }
  } catch {
    best = elapsed;
  }
  ui.result.innerHTML = `<div class="r-title">SECTOR CLEARED</div>
    <div class="r-row"><span>Time</span><b>${fmtTime(elapsed)}</b></div>
    <div class="r-row"><span>Best</span><b>${fmtTime(best)}</b></div>`;
  ui.result.classList.remove('hidden');
  showOverlay('won');
}

ui.start.addEventListener('click', startOrResume);
input.onLockChange((locked) => {
  if (!locked && state === 'playing') pause();
});

function impact(strength) {
  if (impactCooldown > 0 || strength < 12) return;
  impactCooldown = 0.4;
  shake = Math.min(1.2, shake + strength / 60);
  post.impactFlash(Math.min(0.5, strength / 120));
  audio.impact(strength);
  hud.flash('HULL IMPACT', 'warn', 1.2);
}

const tmp = new THREE.Vector3();
function resolveCollisions() {
  const { ship, bodies, sun, belt } = world;
  const all = [...bodies, { pos: sun.position, radius: sun.radius }];
  for (const b of all) {
    const min = b.radius + ship.radius;
    tmp.subVectors(ship.position, b.pos);
    const d = tmp.length();
    if (d >= min) continue;
    tmp.divideScalar(d || 1);
    ship.position.copy(b.pos).addScaledVector(tmp, min);
    const vn = ship.velocity.dot(tmp);
    if (vn < 0) {
      ship.velocity.addScaledVector(tmp, -vn * 1.5);
      impact(-vn);
    }
  }
  const hit = belt.collide(ship.position, ship.velocity, ship.radius);
  if (hit) impact(hit);

  const r = ship.position.length();
  if (r > SECTOR_RADIUS) {
    tmp.copy(ship.position).divideScalar(r);
    ship.velocity.addScaledVector(tmp, -(r - SECTOR_RADIUS) * 0.05);
    if (warnCooldown <= 0) {
      hud.flash('LEAVING SECTOR — TURN BACK', 'warn', 2);
      warnCooldown = 3;
    }
  }
}

function collectCores(dt) {
  const { ship, cores, bursts } = world;
  comboTimer -= dt;
  if (comboTimer <= 0) combo = 0;
  for (const it of cores.collect(ship.position, 13)) {
    collected++;
    combo++;
    comboTimer = 8;
    ship.energy = Math.min(100, ship.energy + 35);
    bursts.spawn(it.pos);
    audio.collect(combo - 1);
    const left = cores.total - collected;
    hud.flash(left ? `ENERGY CORE SECURED · ${left} REMAINING${combo > 1 ? ` · CHAIN x${combo}` : ''}` : 'ALL CORES SECURED', 'good', 2.5);
    if (!left) setTimeout(win, 1200);
  }
}

const menuPos = new THREE.Vector3();
const followPos = new THREE.Vector3();
const menuQuat = new THREE.Quaternion();
const lookM = new THREE.Matrix4();
const lookTarget = new THREE.Vector3();
const camOffset = new THREE.Vector3();

function updateCamera(dt, t) {
  const { ship, camQuat } = world;
  camQuat.slerp(ship.quaternion, 1 - Math.exp(-dt * 5.5));
  const speed = ship.velocity.length();
  camOffset.set(0, 3.2, 12 + speed * 0.018).applyQuaternion(camQuat);
  followPos.copy(ship.position).add(camOffset);

  const a = t * 0.12 + 2.2;
  menuPos.set(Math.sin(a) * 17, 4 + Math.sin(t * 0.3) * 1.5, Math.cos(a) * 17).add(ship.position);
  lookTarget.copy(ship.position).add(tmp.set(0, 0.6, 0));
  lookM.lookAt(menuPos, lookTarget, THREE.Object3D.DEFAULT_UP);
  menuQuat.setFromRotationMatrix(lookM);

  const target = state === 'playing' || state === 'paused' ? 1 : 0;
  camBlend += Math.sign(target - camBlend) * Math.min(Math.abs(target - camBlend), dt / 1.3);
  const e = camBlend * camBlend * (3 - 2 * camBlend);
  camera.position.lerpVectors(menuPos, followPos, e);
  camera.quaternion.slerpQuaternions(menuQuat, camQuat, e);

  const jitter = shake + ship.boostLevel * 0.06;
  if (jitter > 0) {
    camera.position.x += (Math.random() - 0.5) * jitter;
    camera.position.y += (Math.random() - 0.5) * jitter;
    camera.position.z += (Math.random() - 0.5) * jitter;
  }
  shake = Math.max(0, shake - dt * 2.5);

  const fov = 68 + ship.boostLevel * 16 + Math.min(speed, 250) * 0.025;
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 4));
    camera.updateProjectionMatrix();
  }
}

function handleKeys() {
  for (const code of input.consumePressed()) {
    if (code === 'KeyM') hud.flash(audio.toggleMute() ? 'AUDIO MUTED' : 'AUDIO ON', 'info', 1.2);
    if (code === 'KeyP' && state === 'playing') pause();
  }
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (!world) return;

  const playing = state === 'playing';
  handleKeys();
  impactCooldown -= dt;
  warnCooldown -= dt;

  const { ship, sky, sun, planets, belt, station, cores, exhaust, bursts, bodies } = world;
  ship.update(dt, t, input, playing);
  if (playing) {
    resolveCollisions();
    collectCores(dt);
    elapsed += dt;
  }

  sun.update(t);
  planets.forEach((p) => p.update(dt));
  belt.update(dt);
  station.update(dt, t);
  cores.update(dt, t);
  updateCamera(dt, t);

  const speed = ship.velocity.length();
  sky.update(camera, t, Math.min(1, speed / 120));
  const h = renderer.domElement.height;
  exhaust.update(dt, ship, camera, h);
  bursts.update(dt, camera);

  const w = window.innerWidth;
  const hh = window.innerHeight;
  hud.update(dt, {
    camera,
    ship,
    cores,
    bodies,
    sunPos: sun.position,
    w,
    h: hh,
    elapsed,
    collected,
    showMarkers: state === 'playing' || state === 'paused',
    heat: playing && ship.position.distanceTo(sun.position) < sun.radius * 2.6,
  });
  audio.update(ship.throttle, ship.boostLevel, speed, playing);
  post.render(dt, t, ship.boostLevel);
}

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  post.setSize(w, h);
});

buildWorld().then((w) => {
  world = w;
  state = 'menu';
  showOverlay('menu');
  clock.getDelta();
});
tick();
