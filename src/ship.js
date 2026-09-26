import * as THREE from 'three';

// Simple low-poly spaceship. Nose points down -Z to match the player's forward vector.
export function createShip() {
  const ship = new THREE.Group();

  const hullMat = new THREE.MeshPhongMaterial({ color: 0xb0b8c8, shininess: 60 });
  const accentMat = new THREE.MeshPhongMaterial({ color: 0x2255aa, shininess: 30 });
  const cockpitMat = new THREE.MeshPhongMaterial({
    color: 0x66ccff,
    emissive: 0x113355,
    shininess: 100,
    transparent: true,
    opacity: 0.85
  });

  // Fuselage
  const body = new THREE.Mesh(new THREE.ConeGeometry(1.2, 8, 8), hullMat);
  body.rotation.x = -Math.PI / 2;
  ship.add(body);

  // Cockpit
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), cockpitMat);
  cockpit.scale.set(1, 0.7, 1.6);
  cockpit.position.set(0, 0.7, -0.5);
  ship.add(cockpit);

  // Wings
  const wingGeo = new THREE.BoxGeometry(9, 0.2, 2.5);
  const wings = new THREE.Mesh(wingGeo, accentMat);
  wings.position.set(0, 0, 1.5);
  ship.add(wings);

  // Tail fin
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 1.8), accentMat);
  fin.position.set(0, 1, 3);
  ship.add(fin);

  // Engines
  const engineGeo = new THREE.CylinderGeometry(0.5, 0.6, 2, 12);
  const glowGeo = new THREE.SphereGeometry(0.45, 12, 8);
  const flames = [];
  for (const x of [-1.6, 1.6]) {
    const engine = new THREE.Mesh(engineGeo, hullMat);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(x, -0.2, 3.5);
    ship.add(engine);

    const flame = new THREE.Mesh(
      glowGeo,
      new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.8 })
    );
    flame.position.set(x, -0.2, 4.6);
    ship.add(flame);
    flames.push(flame);
  }

  ship.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true;
  });

  ship.userData.flames = flames;
  return ship;
}

// Scale engine glow with current speed.
export function updateShipEffects(ship, speedRatio, time) {
  const flicker = 1 + Math.sin(time * 40) * 0.08;
  const len = (0.6 + speedRatio * 3) * flicker;
  for (const flame of ship.userData.flames) {
    flame.scale.set(1, 1, len);
    flame.position.z = 4.5 + len * 0.4;
  }
}
