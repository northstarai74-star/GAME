import * as THREE from 'three';

export function createExhaust(max = 1200) {
  const pos = new Float32Array(max * 3);
  const vel = new Float32Array(max * 3);
  const alpha = new Float32Array(max);
  const size = new Float32Array(max);
  const baseSize = new Float32Array(max);
  const mix = new Float32Array(max);
  const life = new Float32Array(max);
  const maxLife = new Float32Array(max);
  const boost = new Float32Array(max);

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const alphaAttr = new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
  const sizeAttr = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
  const mixAttr = new THREE.BufferAttribute(mix, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aAlpha', alphaAttr);
  geo.setAttribute('aSize', sizeAttr);
  geo.setAttribute('aMix', mixAttr);

  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      attribute float aSize;
      attribute float aMix;
      uniform float uScale;
      varying float vA;
      varying float vM;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = max(-mv.z, 0.1);
        gl_PointSize = min(aSize * uScale / dist, 90.0);
        vA = aAlpha * smoothstep(4.0, 12.0, dist);
        vM = aMix;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      varying float vM;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 col = mix(vec3(0.35, 1.0, 1.7), vec3(1.0, 0.25, 1.5), vM);
        gl_FragColor = vec4(col * a * vA, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  let head = 0;
  const carry = [0, 0];
  const nozzlePos = new THREE.Vector3();
  const back = new THREE.Vector3();

  function emitOne(p, v, s, b) {
    const i = head;
    head = (head + 1) % max;
    pos[i * 3] = p.x + (Math.random() - 0.5) * 0.4;
    pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * 0.4;
    pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.4;
    vel[i * 3] = v.x + (Math.random() - 0.5) * 3;
    vel[i * 3 + 1] = v.y + (Math.random() - 0.5) * 3;
    vel[i * 3 + 2] = v.z + (Math.random() - 0.5) * 3;
    life[i] = 0;
    maxLife[i] = 0.12 + Math.random() * 0.15 + b * 0.12;
    baseSize[i] = s;
    boost[i] = b;
  }

  return {
    points,
    update(dt, ship, camera, renderHeight) {
      mat.uniforms.uScale.value = (renderHeight * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

      ship.object.updateMatrixWorld();
      back.set(0, 0, 1).applyQuaternion(ship.quaternion);
      const rate = 40 + ship.throttle * 160 + ship.boostLevel * 200;
      const exitSpeed = 14 + ship.throttle * 22 + ship.boostLevel * 40;
      const v = back.clone().multiplyScalar(exitSpeed).add(ship.velocity);
      const s = 0.5 + ship.throttle * 0.35 + ship.boostLevel * 0.5;
      ship.nozzles.forEach((n, idx) => {
        n.mesh.getWorldPosition(nozzlePos);
        carry[idx] += rate * dt;
        while (carry[idx] >= 1) {
          carry[idx] -= 1;
          emitOne(nozzlePos, v, s, ship.boostLevel);
        }
      });

      for (let i = 0; i < max; i++) {
        if (life[i] >= maxLife[i]) {
          alpha[i] = 0;
          continue;
        }
        life[i] += dt;
        const t = Math.min(1, life[i] / maxLife[i]);
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        alpha[i] = (1 - t) * (1 - t);
        size[i] = baseSize[i] * (1 + t * 1.2);
        mix[i] = Math.min(1, t * 1.3 + boost[i] * 0.3);
      }
      posAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      mixAttr.needsUpdate = true;
    },
  };
}
