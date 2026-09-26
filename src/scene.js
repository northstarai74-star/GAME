import * as THREE from 'three';
import { createStarfield, createPlanets, createAsteroids } from './objects.js';

export function createScene() {
  const scene = new THREE.Scene();

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
  sunLight.position.set(500, 300, 200);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.far = 2000;
  sunLight.shadow.camera.left = -1000;
  sunLight.shadow.camera.right = 1000;
  sunLight.shadow.camera.top = 1000;
  sunLight.shadow.camera.bottom = -1000;
  scene.add(sunLight);

  // Create environment
  const starfield = createStarfield();
  scene.add(starfield);

  const planets = createPlanets();
  planets.forEach(planet => scene.add(planet));

  const asteroids = createAsteroids();
  asteroids.forEach(asteroid => scene.add(asteroid));

  return scene;
}
