import * as THREE from 'three';

const MOUSE_SENS = 0.0022;
const STICK_RATE = 1.9;
const WORLD_RADIUS = 2400;

export function createPlayer() {
  const player = {
    position: new THREE.Vector3(0, 0, 150),
    velocity: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    forward: new THREE.Vector3(0, 0, -1),
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
    radius: 4.5,

    speed: 0,
    throttle: 0,
    boosting: false,
    turnRate: 0,
    climbRate: 0,

    hull: 100,
    shield: 100,
    boost: 100,
    heat: 0,
    overheated: false,
    lastDamage: -10,
    alive: true,

    reset() {
      this.position.set(0, 0, 150);
      this.velocity.set(0, 0, 0);
      this.quaternion.identity();
      this.hull = 100;
      this.shield = 100;
      this.boost = 100;
      this.heat = 0;
      this.overheated = false;
      this.alive = true;
      this.lastDamage = -10;
      this.updateAxes();
    },

    updateAxes() {
      this.forward.set(0, 0, -1).applyQuaternion(this.quaternion);
      this.right.set(1, 0, 0).applyQuaternion(this.quaternion);
      this.up.set(0, 1, 0).applyQuaternion(this.quaternion);
    },

    // Returns damage dealt to hull (after shields absorb).
    takeDamage(amount, time) {
      this.lastDamage = time;
      const absorbed = Math.min(this.shield, amount * 0.8);
      this.shield -= absorbed;
      const toHull = amount - absorbed;
      this.hull = Math.max(0, this.hull - toHull);
      if (this.hull <= 0) this.alive = false;
      return toHull;
    },

    update(dt, controls, time) {
      // Rotation in the ship's own frame: yaw about local up, pitch about local right
      const yaw = -controls.lookX * MOUSE_SENS - controls.stickX * STICK_RATE * dt;
      const pitch = -controls.lookY * MOUSE_SENS - controls.stickY * STICK_RATE * dt;
      controls.lookX = 0;
      controls.lookY = 0;
      const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
      this.quaternion.multiply(qYaw).multiply(qPitch).normalize();
      this.updateAxes();

      // Smoothed turn rates drive the ship's visual banking
      const k = 1 - Math.exp(-8 * dt);
      this.turnRate += (yaw / Math.max(dt, 1e-3) - this.turnRate) * k;
      this.climbRate += (pitch / Math.max(dt, 1e-3) - this.climbRate) * k;

      // Boost energy
      const wantsBoost = controls.boost && controls.forward;
      if (wantsBoost && this.boost > (this.boosting ? 0 : 12)) {
        this.boosting = true;
        this.boost = Math.max(0, this.boost - 28 * dt);
      } else {
        this.boosting = false;
        this.boost = Math.min(100, this.boost + 14 * dt);
      }

      // Thrust
      const accel = new THREE.Vector3();
      if (controls.forward) accel.addScaledVector(this.forward, this.boosting ? 460 : 170);
      if (controls.backward) accel.addScaledVector(this.forward, -120);
      if (controls.left) accel.addScaledVector(this.right, -110);
      if (controls.right) accel.addScaledVector(this.right, 110);
      if (controls.up) accel.addScaledVector(this.up, 110);
      if (controls.down) accel.addScaledVector(this.up, -110);
      this.velocity.addScaledVector(accel, dt);
      this.velocity.multiplyScalar(Math.exp(-0.9 * dt));

      const maxSpeed = this.boosting ? 440 : 200;
      const spd = this.velocity.length();
      if (spd > maxSpeed) this.velocity.multiplyScalar(1 - Math.min(1, (spd - maxSpeed) / spd) * (1 - Math.exp(-3 * dt)));

      this.speed = this.velocity.length();
      this.throttle = THREE.MathUtils.clamp(this.speed / 200, 0, 1);

      this.position.addScaledVector(this.velocity, dt);

      // Soft boundary: push back toward the sector centre
      const dist = this.position.length();
      if (dist > WORLD_RADIUS) {
        const n = this.position.clone().normalize();
        this.velocity.addScaledVector(n, -(dist - WORLD_RADIUS) * 4 * dt);
      }

      // Shields recharge after 3 s without damage
      if (time - this.lastDamage > 3) this.shield = Math.min(100, this.shield + 14 * dt);

      // Weapon cooling
      this.heat = Math.max(0, this.heat - 32 * dt);
      if (this.overheated && this.heat < 35) this.overheated = false;
    }
  };
  return player;
}

export { WORLD_RADIUS };
