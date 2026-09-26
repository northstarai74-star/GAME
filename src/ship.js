import * as THREE from 'three';
import { hullTexture, glowTexture } from './textures.js';

// Player fighter. Nose points down -Z to match the player's forward vector.
export function createShip() {
  const ship = new THREE.Group();

  const hullMap = hullTexture();
  const hull = new THREE.MeshStandardMaterial({ map: hullMap, metalness: 0.75, roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b222e, metalness: 0.6, roughness: 0.45 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xe0892a, metalness: 0.4, roughness: 0.4 });
  const canopy = new THREE.MeshPhysicalMaterial({
    color: 0x0a2a44,
    metalness: 0.2,
    roughness: 0.05,
    clearcoat: 1,
    emissive: 0x0b3a5c,
    emissiveIntensity: 0.6
  });

  // Fuselage: lathe profile, rotated so its axis runs along Z
  const profile = [
    [0, -5.2], [0.35, -4.8], [0.8, -3.6], [1.15, -1.8], [1.3, 0.2], [1.35, 2.4], [1.2, 3.6], [0.9, 4.2], [0, 4.25]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const fuselageGeo = new THREE.LatheGeometry(profile, 24);
  fuselageGeo.rotateX(Math.PI / 2);
  fuselageGeo.scale(1, 0.72, 1);
  const fuselage = new THREE.Mesh(fuselageGeo, hull);
  ship.add(fuselage);

  // Canopy
  const canopyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), canopy);
  canopyMesh.scale.set(1, 0.9, 2.3);
  canopyMesh.position.set(0, 0.62, -1.6);
  ship.add(canopyMesh);

  // Swept wings, extruded with a bevel
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -1.4);
  wingShape.lineTo(5.6, 1.4);
  wingShape.lineTo(5.9, 2.6);
  wingShape.lineTo(4.8, 2.6);
  wingShape.lineTo(0, 2.4);
  wingShape.lineTo(0, -1.4);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 2
  });
  wingGeo.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, hull);
    wing.scale.x = side;
    wing.position.set(0.6 * side, 0.05, 0);
    wing.rotation.z = side * -0.06;
    ship.add(wing);

    // Accent stripe along the leading edge
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.24, 0.35), accent);
    stripe.position.set(3.4 * side, 0.1, 0.25);
    stripe.rotation.y = side * -0.46;
    ship.add(stripe);

    // Wingtip cannon
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 8), dark);
    gun.rotation.x = Math.PI / 2;
    gun.position.set(5.9 * side, 0.05, 0.9);
    ship.add(gun);

    // Tail fins, canted outward
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.8, 1.9), hull);
    fin.position.set(0.95 * side, 0.95, 3.1);
    fin.rotation.z = side * -0.35;
    fin.rotation.x = 0.35;
    ship.add(fin);

    // Nav light: red port, green starboard
    const nav = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({
        color: side < 0 ? new THREE.Color(4, 0.3, 0.3) : new THREE.Color(0.3, 4, 0.6),
        toneMapped: false
      })
    );
    nav.position.set(5.9 * side, 0.2, 2.5);
    ship.add(nav);
  }

  // Engines
  const nacelleGeo = new THREE.CylinderGeometry(0.62, 0.72, 2.6, 16);
  const nozzleGeo = new THREE.CylinderGeometry(0.58, 0.45, 0.4, 16, 1, true);
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 3.2, 5), toneMapped: false });
  const glowTex = glowTexture('rgba(210,245,255,1)', 'rgba(90,200,255,0.55)');
  const flames = [];
  const exhaustPorts = [];
  for (const x of [-1.25, 1.25]) {
    const nacelle = new THREE.Mesh(nacelleGeo, dark);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(x, -0.1, 3.2);
    ship.add(nacelle);

    const nozzle = new THREE.Mesh(nozzleGeo, hull);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(x, -0.1, 4.6);
    ship.add(nozzle);

    const core = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), coreMat);
    core.position.set(x, -0.1, 4.55);
    ship.add(core);

    const flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      color: 0x8fe3ff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    flame.position.set(x, -0.1, 5.2);
    ship.add(flame);
    flames.push(flame);

    const port = new THREE.Object3D();
    port.position.set(x, -0.1, 5.0);
    ship.add(port);
    exhaustPorts.push(port);
  }

  // Gun muzzles in local space
  const muzzles = [new THREE.Vector3(-5.9, 0.05, -0.8), new THREE.Vector3(5.9, 0.05, -0.8)];

  // Shield bubble, flashes when hit
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(7.2, 32, 16),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { strength: { value: 0 } },
      vertexShader: /* glsl */ `
        varying float vRim;
        void main() {
          vec3 n = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vRim = pow(1.0 - abs(dot(n, normalize(-mv.xyz))), 2.5);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float strength;
        varying float vRim;
        void main() {
          gl_FragColor = vec4(vec3(0.4, 0.9, 1.4) * vRim * strength, vRim * strength);
        }
      `
    })
  );
  shield.scale.set(1, 0.55, 1.1);
  ship.add(shield);

  ship.userData = { flames, exhaustPorts, muzzles, shield, navTime: 0 };
  return ship;
}

// Engine glow follows throttle; shield flash decays.
export function updateShipEffects(ship, throttle, boosting, dt, time) {
  const { flames, shield } = ship.userData;
  const flicker = 1 + Math.sin(time * 50) * 0.06 + Math.sin(time * 31) * 0.04;
  const size = (0.9 + throttle * 1.1 + (boosting ? 1.2 : 0)) * flicker;
  for (const flame of flames) {
    flame.scale.set(size, size, 1);
    flame.material.color.setHex(boosting ? 0xffc27a : 0x8fe3ff);
  }
  const s = shield.material.uniforms.strength;
  s.value = Math.max(0, s.value - dt * 2.5);
}

export function flashShield(ship, amount = 1) {
  ship.userData.shield.material.uniforms.strength.value = amount;
}
