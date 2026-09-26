import * as THREE from 'three';
import { createScene } from './scene.js';
import { createPlayer } from './player.js';
import { setupControls } from './controls.js';
import { updateHUD } from './hud.js';

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
camera.position.copy(player.position);

let lastTime = Date.now();
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  // Update player
  player.update(deltaTime, controls);

  // Update camera to follow player
  camera.position.lerp(player.position, 0.1);
  camera.lookAt(player.position.clone().add(player.forward.clone().multiplyScalar(10)));

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
