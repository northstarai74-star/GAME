import * as THREE from 'three';
import { createScene } from './scene.js';
import { createPlayer } from './player.js';
import { setupControls } from './controls.js';
import { updateHUD } from './hud.js';
import { createShip, updateShipEffects } from './ship.js';

const canvas = document.querySelector('canvas') || createCanvas();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.setPixelRatio(window.devicePixelRatio);

const scene = createScene();
const player = createPlayer();
const controls = setupControls(player);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  10000
);

const ship = createShip();
scene.add(ship);

// Third-person chase camera: offset in the ship's local space
const CAMERA_OFFSET = new THREE.Vector3(0, 6, 22);
const LOOK_AHEAD = new THREE.Vector3(0, 2, -30);
const CAMERA_STIFFNESS = 6;

const desiredCameraPos = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const smoothedLook = new THREE.Vector3();

function getChaseTargets() {
  desiredCameraPos.copy(CAMERA_OFFSET).applyQuaternion(player.quaternion).add(player.position);
  lookTarget.copy(LOOK_AHEAD).applyQuaternion(player.quaternion).add(player.position);
}

getChaseTargets();
camera.position.copy(desiredCameraPos);
smoothedLook.copy(lookTarget);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  // Update player
  player.update(deltaTime, controls);

  // Ship follows player transform, banking slightly when strafing
  ship.position.copy(player.position);
  ship.quaternion.copy(player.quaternion);
  const lateral = player.velocity.dot(player.right) / player.maxSpeed;
  ship.rotateZ(-lateral * 2.5);
  updateShipEffects(ship, player.speed / player.maxSpeed, clock.elapsedTime);

  // Chase camera: frame-rate independent smoothing toward a point behind the ship
  getChaseTargets();
  const t = 1 - Math.exp(-CAMERA_STIFFNESS * deltaTime);
  camera.position.lerp(desiredCameraPos, t);
  smoothedLook.lerp(lookTarget, t);
  camera.up.copy(player.up);
  camera.lookAt(smoothedLook);

  // Update HUD
  updateHUD(player);

  renderer.render(scene, camera);
}

function createCanvas() {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);

animate();
