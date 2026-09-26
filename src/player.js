import * as THREE from 'three';

export function createPlayer() {
  return {
    position: new THREE.Vector3(0, 0, 100),
    velocity: new THREE.Vector3(0, 0, 0),
    forward: new THREE.Vector3(0, 0, -1),
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),

    speed: 0,
    maxSpeed: 300,
    acceleration: 200,
    friction: 0.85,

    pitch: 0,
    yaw: 0,

    update(deltaTime, controls) {
      // Handle input
      let inputAccel = new THREE.Vector3();

      if (controls.forward) inputAccel.add(this.forward);
      if (controls.backward) inputAccel.sub(this.forward);
      if (controls.left) inputAccel.sub(this.right);
      if (controls.right) inputAccel.add(this.right);
      if (controls.up) inputAccel.add(this.up);
      if (controls.down) inputAccel.sub(this.up);

      // Apply acceleration
      if (inputAccel.length() > 0) {
        inputAccel.normalize();
        this.velocity.add(inputAccel.multiplyScalar(this.acceleration * deltaTime));
      }

      // Apply friction
      this.velocity.multiplyScalar(this.friction);

      // Limit speed
      if (this.velocity.length() > this.maxSpeed) {
        this.velocity.normalize().multiplyScalar(this.maxSpeed);
      }

      this.speed = this.velocity.length();

      // Update position
      this.position.add(this.velocity.clone().multiplyScalar(deltaTime));

      // Boundary check
      const boundary = 2000;
      this.position.clamp(
        new THREE.Vector3(-boundary, -boundary, -boundary),
        new THREE.Vector3(boundary, boundary, boundary)
      );

      // Update rotation based on camera
      const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
      new THREE.Quaternion().setFromEuler(euler);

      this.forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);
      this.right = new THREE.Vector3(1, 0, 0).applyEuler(euler);
      this.up = new THREE.Vector3(0, 1, 0).applyEuler(euler);
    }
  };
}
