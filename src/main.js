import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createSky, createStarfield, createSpaceDust, createSun, createPlanets, SUN_DIRECTION } from './objects.js';
import { createPlayer } from './player.js';
import { setupControls } from './controls.js';
import { createHUD } from './hud.js';
import { createShip, updateShipEffects, flashShield } from './ship.js';
import { createParticles } from './effects.js';
import { createGame } from './game.js';
import { createAudio } from './audio.js';

// ---------- Renderer ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const pixelRatio = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.5, 20000);

// ---------- Environment ----------
// Sky, stars and sun ride along with the camera so they read as infinitely far away.
const skyRig = new THREE.Group();
const sky = createSky();
const stars = createStarfield();
const sun = createSun();
skyRig.add(sky, stars, sun);
scene.add(skyRig);

// Image-based lighting from the nebula so metal picks up its colours
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.add(createSky());
scene.environment = pmrem.fromScene(envScene, 0, 1, 20000).texture;
pmrem.dispose();

const sunLight = new THREE.DirectionalLight(0xfff0dd, 3.2);
sunLight.position.copy(SUN_DIRECTION).multiplyScalar(1000);
scene.add(sunLight);
scene.add(sunLight.target);
scene.add(new THREE.HemisphereLight(0x6a7cff, 0x1a0c10, 0.35));

const planets = createPlanets();
planets.forEach((p) => scene.add(p));

const dust = createSpaceDust();
scene.add(dust);

const particles = createParticles(6000);
scene.add(particles.points);

const ship = createShip();
scene.add(ship);

// ---------- Post-processing ----------
const renderTarget = new THREE.WebGLRenderTarget(
  window.innerWidth * pixelRatio,
  window.innerHeight * pixelRatio,
  { type: THREE.HalfFloatType, samples: 4 }
);
const composer = new EffectComposer(renderer, renderTarget);
composer.setPixelRatio(pixelRatio);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.55, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function particleScale() {
  return (window.innerHeight * pixelRatio) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
particles.resize(particleScale());

// ---------- Game ----------
const audio = createAudio();
const hud = createHUD();
const player = createPlayer();

const muzzleLocal = ship.userData.muzzles;
const events = {
  getMuzzle: (side) => muzzleLocal[side].clone().applyMatrix4(ship.matrixWorld),
  onScore: (points, pos) => { if (points >= 100 && pos) hud.toast(`+${points}`); },
  onKill: () => { shake = Math.max(shake, 0.4); },
  onAsteroidDestroyed: () => { shake = Math.max(shake, 0.15); },
  onPlayerHit: (amount) => {
    hud.damage(amount);
    flashShield(ship, player.shield > 1 ? 1 : 0.2);
    shake = Math.max(shake, Math.min(1, 0.3 + amount / 20));
  },
  onHitMarker: () => hud.hitMarker(),
  onPickup: (text, kind) => hud.toast(text, kind === 'crystal' ? 'cyan' : 'amber'),
  onWave: (n, count) => { hud.banner(`Wave ${n}`, `${count} hostile drones inbound`); audio.alert(); },
  onWaveCleared: (n) => hud.banner('Sector clear', `Wave ${n} bonus +${500 * n}`),
  onOverheat: () => hud.toast('Guns overheated')
};
const game = createGame(scene, particles, audio, events);

// ---------- State & UI ----------
const ui = {
  hud: document.getElementById('hud'),
  touch: document.getElementById('touch'),
  menu: document.getElementById('menu'),
  pause: document.getElementById('pause'),
  over: document.getElementById('over'),
  bestLine: document.getElementById('bestLine'),
  finalScore: document.getElementById('finalScore'),
  finalWave: document.getElementById('finalWave'),
  finalKills: document.getElementById('finalKills'),
  finalBest: document.getElementById('finalBest'),
  btnMute: document.getElementById('btnMute')
};

let state = 'menu'; // menu | playing | paused | dying | over
let shake = 0;
let deathTimer = 0;

function loadBest() {
  try { return Number(localStorage.getItem('spaceExplorerBest')) || 0; } catch (e) { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem('spaceExplorerBest', String(v)); } catch (e) { /* storage unavailable */ }
}
ui.bestLine.textContent = `Best score ${loadBest().toLocaleString()}`;

const controls = setupControls(canvas, {
  onPause: (forceOnly) => {
    if (state === 'playing') setState('paused');
    else if (state === 'paused' && !forceOnly) setState('playing');
  },
  onMute: toggleMute
});

function toggleMute() {
  const muted = audio.toggleMute();
  ui.btnMute.textContent = muted ? 'Sound off' : 'Sound on';
}

function setState(next) {
  state = next;
  const playing = next === 'playing';
  controls.enabled = playing;
  if (!playing) controls.releaseAll();
  ui.menu.hidden = next !== 'menu';
  ui.pause.hidden = next !== 'paused';
  ui.over.hidden = next !== 'over';
  ui.hud.hidden = !(playing || next === 'dying' || next === 'paused');
  ui.touch.hidden = !(playing && controls.isTouch);
  if (playing) {
    controls.lock();
    audio.init();
  } else {
    controls.unlock();
    audio.silenceEngine();
  }
  if (next === 'menu' || next === 'over') hud.clearOverlay();
}

function startGame() {
  audio.init();
  player.reset();
  particles.clear();
  game.reset(player);
  ship.visible = true;
  snapCamera();
  hud.banner('Launch', 'Clear the belt of hostile drones', 2.2);
  setState('playing');
}

function gameOver() {
  const best = Math.max(loadBest(), game.stats.score);
  saveBest(best);
  ui.finalScore.textContent = game.stats.score.toLocaleString();
  ui.finalWave.textContent = game.wave;
  ui.finalKills.textContent = game.stats.kills;
  ui.finalBest.textContent = `Best score ${best.toLocaleString()}`;
  ui.bestLine.textContent = `Best score ${best.toLocaleString()}`;
  setState('over');
}

document.getElementById('btnStart').addEventListener('click', startGame);
document.getElementById('btnRetry').addEventListener('click', startGame);
document.getElementById('btnResume').addEventListener('click', () => setState('playing'));
document.getElementById('btnQuit').addEventListener('click', startGame);
document.getElementById('btnPause').addEventListener('click', () => setState('paused'));
ui.btnMute.addEventListener('click', toggleMute);

// ---------- Camera ----------
const CAMERA_OFFSET = new THREE.Vector3(0, 5.5, 20);
const LOOK_AHEAD = new THREE.Vector3(0, 2.5, -40);
const desiredCameraPos = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const smoothedLook = new THREE.Vector3();
const smoothedUp = new THREE.Vector3(0, 1, 0);

function chaseTargets() {
  const boostPull = player.boosting ? 1.25 : 1;
  const offset = CAMERA_OFFSET.clone();
  offset.z *= boostPull;
  desiredCameraPos.copy(offset).applyQuaternion(player.quaternion).add(player.position);
  lookTarget.copy(LOOK_AHEAD).applyQuaternion(player.quaternion).add(player.position);
}

function snapCamera() {
  chaseTargets();
  camera.position.copy(desiredCameraPos);
  smoothedLook.copy(lookTarget);
  smoothedUp.copy(player.up);
  camera.up.copy(smoothedUp);
  camera.lookAt(smoothedLook);
}
snapCamera();

// ---------- Loop ----------
const clock = new THREE.Clock();
const bankQ = new THREE.Quaternion();
const exhaustColor = new THREE.Color();
const exhaustVel = new THREE.Vector3();
const exhaustPos = new THREE.Vector3();
let menuAngle = 0;

function updateShipTransform(dt, time) {
  ship.position.copy(player.position);
  ship.quaternion.copy(player.quaternion);
  // Bank into turns and when strafing; pitch slightly with climb
  const lateral = player.velocity.dot(player.right) / 200;
  const roll = THREE.MathUtils.clamp(player.turnRate * 0.35 - lateral * 0.6, -0.9, 0.9);
  const pitch = THREE.MathUtils.clamp(player.climbRate * 0.08, -0.3, 0.3);
  bankQ.setFromEuler(new THREE.Euler(pitch, 0, roll));
  ship.quaternion.multiply(bankQ);
  ship.updateMatrixWorld();
  updateShipEffects(ship, player.throttle, player.boosting, dt, time);
}

function emitExhaust(dt) {
  const rate = (player.boosting ? 160 : 30 + player.throttle * 80) * dt;
  for (const port of ship.userData.exhaustPorts) {
    port.getWorldPosition(exhaustPos);
    for (let i = 0; i < rate; i++) {
      exhaustVel.copy(player.forward).multiplyScalar(-(40 + Math.random() * 40)).add(player.velocity);
      exhaustVel.x += (Math.random() - 0.5) * 6;
      exhaustVel.y += (Math.random() - 0.5) * 6;
      exhaustVel.z += (Math.random() - 0.5) * 6;
      if (player.boosting) exhaustColor.setRGB(3.5, 1.8, 0.6);
      else exhaustColor.setRGB(0.6, 1.8, 3.2);
      particles.emit(exhaustPos, exhaustVel, exhaustColor, 0.8, 0.15, 0.3 + Math.random() * 0.2, 4);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  stars.material.uniforms.time.value = time;
  planets.forEach((p) => { p.rotation.y += p.userData.spin * dt; });

  if (state === 'playing' || state === 'dying') {
    if (state === 'playing') {
      player.update(dt, controls, time);
      updateShipTransform(dt, time);
    }
    game.update(dt, time, player, state === 'playing' ? controls : { fire: false }, planets);

    if (state === 'playing') {
      emitExhaust(dt);
      audio.setEngine(player.throttle, player.boosting);
      if (!player.alive) {
        state = 'dying';
        deathTimer = 2.2;
        ship.visible = false;
        particles.explode(player.position, 3, player.velocity, 'fire');
        particles.explode(player.position, 2, player.velocity, 'plasma');
        audio.explosion(3);
        audio.silenceEngine();
        controls.enabled = false;
        controls.unlock();
        ui.touch.hidden = true;
        shake = 1.2;
        player.velocity.multiplyScalar(0.2);
        hud.banner('Hull breach', 'Ship lost');
      }
    } else {
      player.position.addScaledVector(player.velocity, dt);
      deathTimer -= dt;
      if (deathTimer <= 0) gameOver();
    }

    // Chase camera with frame-rate independent smoothing
    chaseTargets();
    const k = 1 - Math.exp(-7 * dt);
    camera.position.lerp(desiredCameraPos, k);
    smoothedLook.lerp(lookTarget, 1 - Math.exp(-12 * dt));
    smoothedUp.lerp(player.up, 1 - Math.exp(-5 * dt)).normalize();
    camera.up.copy(smoothedUp);
    camera.lookAt(smoothedLook);

    // Widen FOV while boosting
    const targetFov = player.boosting ? 82 : 70;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-4 * dt));
      camera.updateProjectionMatrix();
      particles.resize(particleScale());
    }

    if (shake > 0) {
      const s = shake * shake * 1.4;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
      shake = Math.max(0, shake - dt * 2.2);
    }

    if (state !== 'over') hud.update(dt, player, game, camera);
  } else if (state === 'menu' || state === 'over') {
    // Slow orbit around the idle ship as an attract mode
    menuAngle += dt * 0.15;
    updateShipTransform(dt, time);
    const r = 26;
    camera.position.set(
      player.position.x + Math.sin(menuAngle) * r,
      player.position.y + 7,
      player.position.z + Math.cos(menuAngle) * r
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(player.position.x - 8, player.position.y + 2, player.position.z);
    if (state === 'menu' && Math.random() < 0.5) emitExhaust(dt * 0.5);
  }

  particles.update(dt);
  dust.userData.update(camera.position);
  skyRig.position.copy(camera.position);
  dust.material.opacity = 0.25 + player.throttle * 0.4;

  composer.render();
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  particles.resize(particleScale());
  stars.material.uniforms.pixelRatio.value = pixelRatio;
}
window.addEventListener('resize', onResize);

// Populate the belt behind the menu so the attract screen isn't empty
game.reset(player);
setState('menu');
animate();
