import * as THREE from 'three';
import { createNoise3D, mulberry32 } from '../noise.js';

function rockGeometry(seed) {
  const n = createNoise3D(seed);
  const rng = mulberry32(seed);
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const stretch = new THREE.Vector3(0.8 + rng() * 0.6, 0.7 + rng() * 0.4, 0.8 + rng() * 0.5);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = 1 + n.fbm(v.x * 1.3 + seed, v.y * 1.3, v.z * 1.3, 4) * 0.6;
    v.multiplyScalar(d).multiply(stretch);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function createAsteroidBelt({ inner = 1080, outer = 1380, perVariant = 600 } = {}) {
  const rng = mulberry32(99);
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.05, flatShading: true });
  const rocks = [];
  const m = new THREE.Matrix4();
  const color = new THREE.Color();

  for (let variant = 0; variant < 3; variant++) {
    const mesh = new THREE.InstancedMesh(rockGeometry(variant * 17 + 3), mat, perVariant);
    mesh.frustumCulled = false;
    for (let i = 0; i < perVariant; i++) {
      const a = rng() * Math.PI * 2;
      const r = inner + (outer - inner) * ((rng() + rng()) / 2);
      const y = (rng() + rng() + rng() - 1.5) * 32;
      const big = rng() < 0.03;
      const s = big ? 12 + rng() * 14 : 1.2 + rng() ** 2 * 7;
      const rock = {
        mesh,
        index: i,
        pos: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
        quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * 6, rng() * 6, rng() * 6)),
        scale: new THREE.Vector3(s, s, s),
        radius: s * 1.1,
        axis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
        spin: (rng() - 0.5) * (big ? 0.15 : 0.9),
      };
      rocks.push(rock);
      m.compose(rock.pos, rock.quat, rock.scale);
      mesh.setMatrixAt(i, m);
      const tone = 0.25 + rng() * 0.3;
      color.setRGB(tone * (1.05 + rng() * 0.15), tone * (0.95 + rng() * 0.05), tone * (0.85 + rng() * 0.1));
      mesh.setColorAt(i, color);
    }
    group.add(mesh);
  }

  const dq = new THREE.Quaternion();
  const local = new THREE.Vector3();
  const push = new THREE.Vector3();
  const mid = (inner + outer) / 2;

  return {
    group,
    rocks,
    update(dt) {
      group.rotation.y += dt * 0.006;
      for (const r of rocks) {
        dq.setFromAxisAngle(r.axis, r.spin * dt);
        r.quat.multiply(dq);
        m.compose(r.pos, r.quat, r.scale);
        r.mesh.setMatrixAt(r.index, m);
      }
      for (const child of group.children) child.instanceMatrix.needsUpdate = true;
    },
    // Resolves ship-vs-rock overlap; returns impact speed (0 if none).
    collide(position, velocity, shipRadius) {
      local.copy(position).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -group.rotation.y);
      const radial = Math.hypot(local.x, local.z);
      if (Math.abs(radial - mid) > (outer - inner) / 2 + 60 || Math.abs(local.y) > 140) return 0;
      let impact = 0;
      for (const r of rocks) {
        const min = r.radius + shipRadius;
        push.subVectors(local, r.pos);
        const d2 = push.lengthSq();
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 1;
        push.divideScalar(d);
        local.copy(r.pos).addScaledVector(push, min);
        push.applyAxisAngle(THREE.Object3D.DEFAULT_UP, group.rotation.y);
        const vn = velocity.dot(push);
        if (vn < 0) {
          velocity.addScaledVector(push, -vn * 1.5);
          impact = Math.max(impact, -vn);
        }
      }
      if (impact > 0) position.copy(local).applyAxisAngle(THREE.Object3D.DEFAULT_UP, group.rotation.y);
      return impact;
    },
  };
}
