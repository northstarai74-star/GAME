import * as THREE from 'three';
import { radialTexture } from '../world/textures.js';

export function createBursts(poolSize = 6) {
  const group = new THREE.Group();
  const ringGeo = new THREE.RingGeometry(0.85, 1, 64);
  const flashTex = radialTexture([
    [0, 'rgba(255,255,255,1)'],
    [0.3, 'rgba(120,240,255,0.5)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  const pool = Array.from({ length: poolSize }, () => {
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.6, 2.4, 2.6),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const flash = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: flashTex, color: new THREE.Color(1.2, 2.2, 2.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    );
    ring.visible = flash.visible = false;
    group.add(ring, flash);
    return { ring, flash, t: -1 };
  });
  let next = 0;

  return {
    group,
    spawn(position) {
      const b = pool[next];
      next = (next + 1) % pool.length;
      b.t = 0;
      b.ring.position.copy(position);
      b.flash.position.copy(position);
      b.ring.visible = b.flash.visible = true;
    },
    update(dt, camera) {
      for (const b of pool) {
        if (b.t < 0) continue;
        b.t += dt;
        const k = b.t / 0.9;
        if (k >= 1) {
          b.t = -1;
          b.ring.visible = b.flash.visible = false;
          continue;
        }
        const e = 1 - (1 - k) ** 3;
        b.ring.scale.setScalar(3 + e * 45);
        b.ring.quaternion.copy(camera.quaternion);
        b.ring.material.opacity = (1 - k) ** 2;
        b.flash.scale.setScalar(40 * (1 - k) + 6);
        b.flash.material.opacity = (1 - k) ** 1.5;
      }
    },
  };
}
