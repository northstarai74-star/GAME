import * as THREE from 'three';
import { noiseGLSL } from '../glsl.js';
import { mulberry32 } from '../noise.js';

const nebulaFragment = /* glsl */ `
${noiseGLSL}
varying vec3 vDir;
uniform float uTime;
void main() {
  vec3 d = normalize(vDir);
  float n1 = fbm(d * 1.6 + vec3(0.0, 0.0, uTime * 0.002), 5);
  float n2 = fbm(d * 3.2 + vec3(5.2), 5);
  float lanes = fbm(d * 5.0 + vec3(2.0), 4);
  float band = exp(-pow(d.y * 2.4 + n1 * 0.7 - 0.15, 2.0) * 2.5);

  vec3 col = vec3(0.003, 0.004, 0.012);
  col += vec3(0.26, 0.06, 0.34) * smoothstep(-0.1, 0.8, n1 + 0.2) * 0.5;
  col += vec3(0.03, 0.16, 0.32) * smoothstep(0.0, 0.9, n2 + 0.25) * 0.45;
  col += vec3(0.42, 0.18, 0.12) * smoothstep(0.35, 0.8, n1 * n2 * 3.0) * 0.35;
  col += vec3(0.30, 0.24, 0.40) * band * 0.22 * (0.6 + 0.4 * n2);
  col *= 1.0 - 0.7 * smoothstep(0.1, 0.5, lanes) * band;
  gl_FragColor = vec4(col, 1.0);
}
`;

const nebulaVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

function createNebulaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: nebulaVertex,
    fragmentShader: nebulaFragment,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

function createStars(count, rng, pixelRatio) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const palette = [
    [0.65, 0.78, 1.0],
    [0.85, 0.9, 1.0],
    [1.0, 1.0, 1.0],
    [1.0, 0.93, 0.78],
    [1.0, 0.78, 0.55],
  ];
  for (let i = 0; i < count; i++) {
    const u = rng() * 2 - 1;
    const th = rng() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 12000 + rng() * 3000;
    pos[i * 3] = s * Math.cos(th) * r;
    pos[i * 3 + 1] = u * r;
    pos[i * 3 + 2] = s * Math.sin(th) * r;
    const c = palette[Math.floor(rng() * palette.length)];
    const b = 0.5 + rng() * 0.8;
    col[i * 3] = c[0] * b;
    col[i * 3 + 1] = c[1] * b;
    col[i * 3 + 2] = c[2] * b;
    size[i] = rng() < 0.02 ? 4 + rng() * 3 : 1.2 + rng() ** 2 * 2.6;
    phase[i] = rng() * 10;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      void main() {
        float tw = 0.7 + 0.3 * sin(uTime * (1.2 + aPhase * 0.3) + aPhase * 7.0);
        vColor = aColor * tw;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.0, d), 2.0);
        gl_FragColor = vec4(vColor * a * 1.6, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

function createDust(count, box, rng, pixelRatio) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) pos[i] = rng() * box;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uCam: { value: new THREE.Vector3() },
      uBox: { value: box },
      uPixelRatio: { value: pixelRatio },
      uSpeed: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform vec3 uCam;
      uniform float uBox;
      uniform float uPixelRatio;
      uniform float uSpeed;
      varying float vA;
      void main() {
        vec3 p = mod(position - uCam, uBox) - uBox * 0.5 + uCam;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = -mv.z;
        gl_PointSize = clamp(90.0 / dist, 1.0, 5.0) * uPixelRatio;
        vA = smoothstep(uBox * 0.5, uBox * 0.15, dist) * smoothstep(1.0, 6.0, dist) * (0.35 + uSpeed);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, d) * vA;
        gl_FragColor = vec4(vec3(0.7, 0.85, 1.0) * a, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

export function createSky(renderer) {
  const rng = mulberry32(4242);
  const pr = renderer.getPixelRatio();
  const group = new THREE.Group();

  const nebulaMat = createNebulaMaterial();
  const nebula = new THREE.Mesh(new THREE.SphereGeometry(16000, 64, 32), nebulaMat);
  nebula.renderOrder = -10;
  nebula.frustumCulled = false;
  group.add(nebula);

  const stars = createStars(6000, rng, pr);
  stars.renderOrder = -9;
  group.add(stars);

  const dust = createDust(1400, 500, rng, pr);

  // Environment map from the nebula so metal surfaces reflect the sky.
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), nebulaMat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();

  return {
    group,
    dust,
    envMap,
    update(camera, t, speedFactor) {
      group.position.copy(camera.position);
      nebulaMat.uniforms.uTime.value = t;
      stars.material.uniforms.uTime.value = t;
      dust.material.uniforms.uCam.value.copy(camera.position);
      dust.material.uniforms.uSpeed.value = speedFactor;
    },
  };
}
