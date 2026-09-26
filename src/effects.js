import * as THREE from 'three';

// One pooled additive particle system for exhaust, sparks and explosions.
export function createParticles(maxCount = 5000) {
  const positions = new Float32Array(maxCount * 3);
  const colors = new Float32Array(maxCount * 3);
  const sizes = new Float32Array(maxCount);
  const alphas = new Float32Array(maxCount);

  const vel = new Float32Array(maxCount * 3);
  const life = new Float32Array(maxCount);
  const maxLife = new Float32Array(maxCount);
  const startSize = new Float32Array(maxCount);
  const endSize = new Float32Array(maxCount);
  const drag = new Float32Array(maxCount);
  let cursor = 0;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { scale: { value: window.innerHeight / 2 } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float alpha;
      attribute vec3 color;
      uniform float scale;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * scale / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * a * vAlpha, a * vAlpha);
      }
    `
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  function emit(p, v, color, size0, size1, lifetime, dragK = 1.5) {
    const i = cursor;
    cursor = (cursor + 1) % maxCount;
    positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
    vel[i * 3] = v.x; vel[i * 3 + 1] = v.y; vel[i * 3 + 2] = v.z;
    colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
    life[i] = lifetime;
    maxLife[i] = lifetime;
    startSize[i] = size0;
    endSize[i] = size1;
    drag[i] = dragK;
  }

  const tmpV = new THREE.Vector3();
  const tmpC = new THREE.Color();

  function randomDir(out) {
    out.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    if (out.lengthSq() < 1e-4) out.set(0, 1, 0);
    return out.normalize();
  }

  // Fireball, sparks and smoke. `scale` ~ size of the thing that blew up.
  function explode(pos, scale = 1, baseVel = null, palette = 'fire') {
    const fire = palette === 'fire';
    const n = Math.floor(90 * Math.min(scale, 3));
    for (let k = 0; k < n; k++) {
      randomDir(tmpV).multiplyScalar((20 + Math.random() * 70) * scale);
      if (baseVel) tmpV.addScaledVector(baseVel, 0.5);
      const t = Math.random();
      if (fire) tmpC.setRGB(3 + t * 2, 1.2 + t * 1.3, 0.3 + t * 0.4);
      else tmpC.setRGB(2.5 + t, 0.5 + t * 0.4, 0.6 + t * 0.8);
      emit(pos, tmpV, tmpC, 6 * scale, 18 * scale, 0.5 + Math.random() * 0.6, 3);
    }
    // Sparks
    for (let k = 0; k < n * 0.6; k++) {
      randomDir(tmpV).multiplyScalar((90 + Math.random() * 160) * scale);
      tmpC.setRGB(4, 3, 1.8);
      emit(pos, tmpV, tmpC, 1.2, 0.3, 0.6 + Math.random() * 0.7, 1.2);
    }
    // Smoke
    for (let k = 0; k < n * 0.4; k++) {
      randomDir(tmpV).multiplyScalar((8 + Math.random() * 25) * scale);
      tmpC.setRGB(0.18, 0.16, 0.2);
      emit(pos, tmpV, tmpC, 10 * scale, 30 * scale, 1.4 + Math.random(), 1.2);
    }
  }

  function sparks(pos, normal, color = new THREE.Color(3, 2.4, 1.4), count = 14) {
    for (let k = 0; k < count; k++) {
      randomDir(tmpV).add(normal).normalize().multiplyScalar(40 + Math.random() * 80);
      emit(pos, tmpV, color, 1.4, 0.2, 0.3 + Math.random() * 0.3, 2);
    }
  }

  function update(dt) {
    for (let i = 0; i < maxCount; i++) {
      if (life[i] <= 0) {
        if (alphas[i] !== 0) { alphas[i] = 0; sizes[i] = 0; }
        continue;
      }
      life[i] -= dt;
      const k = Math.exp(-drag[i] * dt);
      vel[i * 3] *= k; vel[i * 3 + 1] *= k; vel[i * 3 + 2] *= k;
      positions[i * 3] += vel[i * 3] * dt;
      positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
      positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const t = 1 - Math.max(0, life[i]) / maxLife[i];
      sizes[i] = startSize[i] + (endSize[i] - startSize[i]) * t;
      alphas[i] = (1 - t) * (1 - t);
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
    geometry.attributes.alpha.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }

  // Pixels per world unit at distance 1: drawingBufferHeight / (2 * tan(fov / 2))
  function resize(pixelScale) {
    material.uniforms.scale.value = pixelScale;
  }

  function clear() {
    life.fill(0);
  }

  return { points, emit, explode, sparks, update, resize, clear };
}
