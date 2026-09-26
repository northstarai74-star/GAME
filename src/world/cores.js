import * as THREE from 'three';
import { radialTexture } from './textures.js';

export function createCores({ rng, count, start, forward, bodies }) {
  const group = new THREE.Group();
  const coreGeo = new THREE.OctahedronGeometry(2.6, 0);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x9ffcff,
    emissive: 0x2ee6ff,
    emissiveIntensity: 2.4,
    metalness: 0.2,
    roughness: 0.15,
    flatShading: true,
  });
  const ringGeo = new THREE.TorusGeometry(4.8, 0.16, 8, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.0, 2.3) });
  const glowMat = new THREE.SpriteMaterial({
    map: radialTexture([
      [0, 'rgba(255,255,255,0.9)'],
      [0.25, 'rgba(120,240,255,0.35)'],
      [1, 'rgba(0,0,0,0)'],
    ]),
    color: new THREE.Color(0.5, 1.4, 1.6),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });

  const positions = [];
  const side = new THREE.Vector3().crossVectors(forward, THREE.Object3D.DEFAULT_UP).normalize();
  for (let i = 0; i < 5; i++) {
    positions.push(
      start.clone()
        .addScaledVector(forward, 110 + i * 85)
        .addScaledVector(side, Math.sin(i * 1.7) * 40)
        .add(new THREE.Vector3(0, Math.cos(i * 1.3) * 25, 0)),
    );
  }
  const tooClose = (p) =>
    bodies.some((b) => p.distanceTo(b.pos) < b.radius * 1.3 + 40) ||
    positions.some((q) => q.distanceTo(p) < 120);
  let guard = 0;
  while (positions.length < count && guard++ < 5000) {
    const a = rng() * Math.PI * 2;
    const r = 350 + Math.sqrt(rng()) * 2900;
    const p = new THREE.Vector3(Math.cos(a) * r, (rng() - 0.5) * 500, Math.sin(a) * r);
    if (!tooClose(p)) positions.push(p);
  }

  const items = positions.map((p, i) => {
    const g = new THREE.Group();
    g.position.copy(p);
    const core = new THREE.Mesh(coreGeo, coreMat);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    ring2.scale.setScalar(0.75);
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(26);
    g.add(core, ring, ring2, glow);
    group.add(g);
    return { group: g, core, ring, ring2, base: p.clone(), pos: g.position, phase: i * 1.37, collected: false };
  });

  return {
    group,
    items,
    total: items.length,
    update(dt, t) {
      for (const it of items) {
        if (it.collected) continue;
        it.core.rotation.y += dt * 1.4;
        it.core.rotation.x += dt * 0.6;
        it.ring.rotation.x += dt * 0.9;
        it.ring.rotation.y += dt * 0.4;
        it.ring2.rotation.y -= dt * 1.3;
        it.ring2.rotation.z += dt * 0.5;
        it.group.position.y = it.base.y + Math.sin(t * 1.4 + it.phase) * 1.5;
      }
    },
    collect(position, radius) {
      const got = [];
      for (const it of items) {
        if (it.collected || it.pos.distanceTo(position) > radius) continue;
        it.collected = true;
        it.group.visible = false;
        got.push(it);
      }
      return got;
    },
    nearest(position) {
      let best = null;
      let bestD = Infinity;
      for (const it of items) {
        if (it.collected) continue;
        const d = it.pos.distanceToSquared(position);
        if (d < bestD) {
          bestD = d;
          best = it;
        }
      }
      return best;
    },
  };
}
