import * as THREE from 'three';
import { radialTexture } from './world/textures.js';

const FORWARD = new THREE.Vector3(0, 0, -1);

function buildModel(envMap) {
  const model = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xd5d9e2, metalness: 0.65, roughness: 0.3, envMap, envMapIntensity: 1.3 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x2b303b, metalness: 0.8, roughness: 0.4, envMap });
  const accent = new THREE.MeshStandardMaterial({ color: 0xff5a36, metalness: 0.3, roughness: 0.45, emissive: 0xff3a1a, emissiveIntensity: 0.3, envMap });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x0b1f3a,
    metalness: 1,
    roughness: 0.05,
    envMap,
    envMapIntensity: 2.2,
    emissive: 0x0a3a6a,
    emissiveIntensity: 0.5,
  });

  const profile = [[0, 4.6], [0.35, 4.0], [0.8, 2.8], [1.15, 1.2], [1.3, -0.5], [1.25, -2.2], [1.0, -3.2], [0, -3.2]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const fuselageGeo = new THREE.LatheGeometry(profile, 28);
  fuselageGeo.rotateX(-Math.PI / 2);
  fuselageGeo.scale(1, 0.72, 1);
  model.add(new THREE.Mesh(fuselageGeo, hull));

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.8, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  cockpit.scale.set(0.85, 0.65, 2.1);
  cockpit.position.set(0, 0.55, -0.9);
  model.add(cockpit);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.9, -1.0);
  wingShape.lineTo(5.8, 1.9);
  wingShape.lineTo(5.9, 2.7);
  wingShape.lineTo(0.9, 2.6);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1 });
  wingGeo.rotateX(Math.PI / 2);
  const finGeo = new THREE.BoxGeometry(0.12, 0.9, 1.1);
  const stripeGeo = new THREE.BoxGeometry(2.4, 0.06, 0.3);
  const lights = [];
  for (const s of [1, -1]) {
    const wing = new THREE.Mesh(wingGeo, hull);
    wing.position.y = 0.0;
    wing.scale.x = s;
    model.add(wing);
    const fin = new THREE.Mesh(finGeo, accent);
    fin.position.set(5.85 * s, 0.35, 2.3);
    model.add(fin);
    const stripe = new THREE.Mesh(stripeGeo, accent);
    stripe.position.set(3.2 * s, 0.03, 1.6);
    stripe.rotation.y = -0.55 * s;
    model.add(stripe);
    const lightMat = new THREE.MeshBasicMaterial({ color: s > 0 ? new THREE.Color(0.3, 3, 0.6) : new THREE.Color(3, 0.3, 0.2) });
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), lightMat);
    light.position.set(5.95 * s, -0.05, 2.0);
    model.add(light);
    lights.push({ mat: lightMat, base: lightMat.color.clone() });
  }

  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.lineTo(1.9, 0);
  tailShape.lineTo(2.7, 1.7);
  tailShape.lineTo(2.1, 1.7);
  tailShape.closePath();
  const tailGeo = new THREE.ExtrudeGeometry(tailShape, { depth: 0.14, bevelEnabled: false });
  tailGeo.rotateY(-Math.PI / 2);
  tailGeo.translate(0.07, 0, 0);
  const tail = new THREE.Mesh(tailGeo, hull);
  tail.position.set(0, 0.55, 0.4);
  model.add(tail);

  const engineGeo = new THREE.CylinderGeometry(0.55, 0.72, 2.8, 24);
  engineGeo.rotateX(Math.PI / 2);
  const collarGeo = new THREE.TorusGeometry(0.72, 0.09, 8, 28);
  const nozzleGeo = new THREE.CircleGeometry(0.55, 24);
  const flareTex = radialTexture([
    [0, 'rgba(255,255,255,1)'],
    [0.2, 'rgba(140,230,255,0.6)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  const nozzles = [];
  for (const s of [1, -1]) {
    const engine = new THREE.Mesh(engineGeo, trim);
    engine.position.set(1.45 * s, -0.15, 2.4);
    model.add(engine);
    const collar = new THREE.Mesh(collarGeo, accent);
    collar.position.set(1.45 * s, -0.15, 3.78);
    model.add(collar);
    const nozzleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 2.6) });
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.position.set(1.45 * s, -0.15, 3.82);
    model.add(nozzle);
    const flare = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: flareTex, color: new THREE.Color(0.6, 1.6, 2.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    );
    flare.position.set(1.45 * s, -0.15, 4.1);
    model.add(flare);
    nozzles.push({ mesh: nozzle, mat: nozzleMat, flare });
  }

  return { model, nozzles, lights };
}

export function createShip(envMap) {
  const object = new THREE.Group();
  const { model, nozzles, lights } = buildModel(envMap);
  object.add(model);

  const velocity = new THREE.Vector3();
  const angVel = new THREE.Vector3();
  const targetAng = new THREE.Vector3();
  const steer = new THREE.Vector2();
  const thrust = new THREE.Vector3();
  const dq = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const baseNozzle = new THREE.Color(0.4, 1.6, 2.6);
  const boostNozzle = new THREE.Color(1.6, 0.8, 3.2);
  const tmpColor = new THREE.Color();

  const ship = {
    object,
    velocity,
    steer,
    nozzles,
    radius: 4,
    throttle: 0,
    boosting: false,
    boostLevel: 0,
    energy: 100,
    get position() {
      return object.position;
    },
    get quaternion() {
      return object.quaternion;
    },
    forward(target) {
      return target.copy(FORWARD).applyQuaternion(object.quaternion);
    },
    update(dt, t, input, controllable) {
      const keys = input.keys;
      const held = (code) => controllable && keys.has(code);
      if (controllable) {
        const m = input.consumeMouse();
        steer.x += m.dx * 0.0022;
        steer.y += m.dy * 0.0022;
      } else {
        input.consumeMouse();
      }
      if (steer.length() > 1) steer.normalize();
      steer.multiplyScalar(Math.exp(-dt * 0.6));

      const roll = (held('KeyQ') ? 1 : 0) - (held('KeyE') ? 1 : 0);
      targetAng.set(-steer.y * 1.7, -steer.x * 1.7, roll * 2.4);
      angVel.lerp(targetAng, 1 - Math.exp(-dt * 6));
      dq.setFromEuler(euler.set(angVel.x * dt, angVel.y * dt, angVel.z * dt, 'XYZ'));
      object.quaternion.multiply(dq).normalize();

      const throttleIn = (held('KeyW') ? 1 : 0) - (held('KeyS') ? 1 : 0);
      const strafe = (held('KeyD') ? 1 : 0) - (held('KeyA') ? 1 : 0);
      const lift = (held('Space') ? 1 : 0) - (held('KeyC') ? 1 : 0);
      ship.boosting = (held('ShiftLeft') || held('ShiftRight')) && throttleIn > 0 && ship.energy > 1;
      ship.energy = Math.min(100, Math.max(0, ship.energy + (ship.boosting ? -24 : 11) * dt));
      ship.throttle += (Math.max(0, throttleIn) - ship.throttle) * (1 - Math.exp(-dt * 5));
      ship.boostLevel += ((ship.boosting ? 1 : 0) - ship.boostLevel) * (1 - Math.exp(-dt * 4));

      const accel = ship.boosting ? 270 : 95;
      thrust.set(strafe * 0.6, lift * 0.6, -throttleIn).applyQuaternion(object.quaternion);
      velocity.addScaledVector(thrust, accel * dt);
      velocity.multiplyScalar(Math.exp(-dt * (ship.boosting ? 0.95 : 1.1)));
      object.position.addScaledVector(velocity, dt);

      const k = 1 - Math.exp(-dt * 5);
      model.rotation.z += (angVel.y * 0.55 - strafe * 0.25 - model.rotation.z) * k;
      model.rotation.x += (angVel.x * 0.12 + lift * 0.08 - model.rotation.x) * k;
      model.position.y = Math.sin(t * 1.6) * 0.06;

      const glow = 0.8 + ship.throttle * 1.6 + ship.boostLevel * 1.8;
      tmpColor.copy(baseNozzle).lerp(boostNozzle, ship.boostLevel).multiplyScalar(glow);
      for (const n of nozzles) {
        n.mat.color.copy(tmpColor);
        n.flare.material.color.copy(tmpColor).multiplyScalar(0.35);
        n.flare.scale.setScalar(1.2 + ship.throttle * 1.4 + ship.boostLevel * 2);
      }
      const blink = (t % 1.2) < 0.1 ? 1 : 0.15;
      for (const l of lights) l.mat.color.copy(l.base).multiplyScalar(blink);
    },
  };
  return ship;
}
