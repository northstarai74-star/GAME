import * as THREE from 'three';

export function createStarfield() {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 5000;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 4000;      // x
    positions[i + 1] = (Math.random() - 0.5) * 4000;  // y
    positions[i + 2] = (Math.random() - 0.5) * 4000;  // z
  }

  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2,
    sizeAttenuation: true
  });

  return new THREE.Points(starGeometry, starMaterial);
}

export function createPlanets() {
  const planets = [];

  // Jupiter-like planet
  const jupiter = new THREE.Mesh(
    new THREE.IcosahedronGeometry(80, 4),
    new THREE.MeshPhongMaterial({
      color: 0xc88b3a,
      emissive: 0x332211,
      shininess: 5
    })
  );
  jupiter.position.set(300, 0, 300);
  jupiter.castShadow = true;
  jupiter.receiveShadow = true;
  planets.push(jupiter);

  // Saturn-like planet
  const saturn = new THREE.Mesh(
    new THREE.IcosahedronGeometry(60, 4),
    new THREE.MeshPhongMaterial({
      color: 0xfad5a5,
      emissive: 0x332211,
      shininess: 5
    })
  );
  saturn.position.set(-400, 200, -300);
  saturn.castShadow = true;
  saturn.receiveShadow = true;
  planets.push(saturn);

  // Neptune-like planet
  const neptune = new THREE.Mesh(
    new THREE.IcosahedronGeometry(50, 4),
    new THREE.MeshPhongMaterial({
      color: 0x4166f5,
      emissive: 0x0a0a1a,
      shininess: 5
    })
  );
  neptune.position.set(200, -300, -500);
  neptune.castShadow = true;
  neptune.receiveShadow = true;
  planets.push(neptune);

  // Sun-like star
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(40, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0xfdb813,
      emissive: 0xfdb813
    })
  );
  sun.position.set(600, 400, 200);
  planets.push(sun);

  return planets;
}

export function createAsteroids() {
  const asteroids = [];

  for (let i = 0; i < 50; i++) {
    const size = Math.random() * 15 + 5;
    const geometry = new THREE.IcosahedronGeometry(size, 1);
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL(0.1, 0.3, 0.4),
      emissive: 0x111111,
      shininess: 3
    });

    const asteroid = new THREE.Mesh(geometry, material);
    asteroid.position.set(
      (Math.random() - 0.5) * 1000,
      (Math.random() - 0.5) * 1000,
      (Math.random() - 0.5) * 1000
    );

    asteroid.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    asteroid.castShadow = true;
    asteroid.receiveShadow = true;
    asteroids.push(asteroid);
  }

  return asteroids;
}
