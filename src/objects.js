import * as THREE from 'three';
import {
  mulberry32,
  gasGiantTexture,
  rockyTexture,
  asteroidTexture,
  ringTexture,
  glowTexture
} from './textures.js';

export const SUN_DIRECTION = new THREE.Vector3(0.62, 0.28, -0.73).normalize();

const noiseGLSL = /* glsl */ `
  vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)), dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                   mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
               mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                   mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
  }
  float fbm(vec3 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) { s += a * noise(p); p *= 2.02; a *= 0.5; }
    return s;
  }
`;

// Procedural nebula sky dome. Follows the camera so it never gets closer.
export function createSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      sunDir: { value: SUN_DIRECTION }
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir;
      varying vec3 vDir;
      ${noiseGLSL}
      void main() {
        vec3 d = normalize(vDir);
        float n1 = fbm(d * 2.2 + vec3(3.1, 0.0, 1.7));
        float n2 = fbm(d * 4.5 + vec3(n1 * 1.5));
        float band = exp(-pow(d.y * 2.4 + n1 * 0.9, 2.0));
        vec3 deep = vec3(0.008, 0.012, 0.03);
        vec3 violet = vec3(0.26, 0.08, 0.36);
        vec3 teal = vec3(0.03, 0.22, 0.30);
        vec3 ember = vec3(0.45, 0.16, 0.06);
        float neb = smoothstep(0.0, 0.65, n2 + 0.25) * band;
        vec3 col = deep;
        col += violet * neb * 0.55;
        col += teal * smoothstep(0.1, 0.7, n1 + 0.3) * band * 0.5;
        col += ember * pow(max(0.0, n2), 2.0) * band * 0.9;
        // Dust lanes
        col *= 0.55 + 0.45 * smoothstep(-0.3, 0.2, fbm(d * 7.0));
        // Warm scatter around the sun
        float s = max(0.0, dot(d, sunDir));
        col += vec3(1.0, 0.6, 0.3) * pow(s, 24.0) * 0.6 + vec3(1.0, 0.75, 0.5) * pow(s, 400.0) * 3.0;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 64, 32), material);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return sky;
}

// Stars with varied size and temperature, twinkling in the shader.
export function createStarfield() {
  const count = 7000;
  const rand = mulberry32(42);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const temps = [
    new THREE.Color('#9bb0ff'), new THREE.Color('#cad7ff'), new THREE.Color('#ffffff'),
    new THREE.Color('#fff4ea'), new THREE.Color('#ffd2a1'), new THREE.Color('#ffb56c')
  ];
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize().multiplyScalar(7000 + rand() * 1500);
    positions.set([v.x, v.y, v.z], i * 3);
    const c = temps[Math.floor(rand() * temps.length)];
    const bright = 0.6 + rand() * 0.9;
    colors.set([c.r * bright, c.g * bright, c.b * bright], i * 3);
    sizes[i] = rand() < 0.02 ? 5 + rand() * 4 : 1.2 + rand() * 2.2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, pixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute vec3 color;
      uniform float time;
      uniform float pixelRatio;
      varying vec3 vColor;
      void main() {
        float tw = 0.75 + 0.25 * sin(time * 2.0 + position.x * 0.013 + position.y * 0.021);
        vColor = color * tw;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * pixelRatio;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.0, d);
        a = a * a;
        gl_FragColor = vec4(vColor * a * 1.6, a);
      }
    `
  });
  const stars = new THREE.Points(geometry, material);
  stars.frustumCulled = false;
  return stars;
}

// Close-range dust that wraps around the player to sell speed.
export function createSpaceDust() {
  const count = 1400;
  const range = 400;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) positions[i] = (Math.random() - 0.5) * range;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0x9fb4d0,
    map: glowTexture(),
    size: 0.9,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.55,
    depthWrite: false
  });
  const dust = new THREE.Points(geometry, material);
  dust.frustumCulled = false;
  dust.userData.range = range;

  dust.userData.update = (center) => {
    const pos = geometry.attributes.position.array;
    const half = range / 2;
    for (let i = 0; i < pos.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const c = k === 0 ? center.x : k === 1 ? center.y : center.z;
        let d = pos[i + k] - c;
        if (d > half) pos[i + k] -= range;
        else if (d < -half) pos[i + k] += range;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  };
  return dust;
}

// Distant sun: bright core plus layered glow sprites (picked up by bloom).
export function createSun() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(140, 32, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.2, 2.2), toneMapped: false })
  );
  group.add(core);
  const glowTex = glowTexture();
  const layers = [
    [900, 'rgb(255,190,120)', 0.9],
    [2400, 'rgb(255,140,70)', 0.35]
  ];
  for (const [size, color, opacity] of layers) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      color: new THREE.Color(color),
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    sprite.scale.setScalar(size);
    group.add(sprite);
  }
  group.position.copy(SUN_DIRECTION).multiplyScalar(6000);
  return group;
}

// Fresnel rim glow shell around a planet.
function atmosphere(radius, color, power = 3.0, strength = 1.2) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      power: { value: power },
      strength: { value: strength },
      sunDir: { value: SUN_DIRECTION }
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorldNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 glowColor;
      uniform float power;
      uniform float strength;
      uniform vec3 sunDir;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorldNormal;
      void main() {
        float rim = pow(1.0 - abs(dot(vNormal, vView)), power);
        float lit = 0.25 + 0.75 * smoothstep(-0.4, 0.6, dot(-vWorldNormal, sunDir));
        gl_FragColor = vec4(glowColor * rim * strength * lit, rim);
      }
    `
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.12, 64, 32), material);
}

export function createPlanets() {
  const planets = [];

  // Banded gas giant
  const giantR = 720;
  const giant = new THREE.Mesh(
    new THREE.SphereGeometry(giantR, 96, 48),
    new THREE.MeshStandardMaterial({
      map: gasGiantTexture(11, [
        [0, [120, 62, 30]], [0.3, [196, 128, 70]], [0.5, [236, 206, 160]],
        [0.7, [178, 98, 52]], [1, [250, 232, 200]]
      ]),
      roughness: 0.9,
      metalness: 0
    })
  );
  giant.add(atmosphere(giantR, '#ffb070', 2.6, 1.0));
  giant.position.set(-2100, -250, -3100);
  giant.rotation.z = 0.25;
  giant.userData = { radius: giantR, spin: 0.004, name: 'Tethys Major' };
  planets.push(giant);

  // Ringed ice giant
  const iceR = 380;
  const ice = new THREE.Mesh(
    new THREE.SphereGeometry(iceR, 96, 48),
    new THREE.MeshStandardMaterial({
      map: gasGiantTexture(23, [
        [0, [40, 90, 150]], [0.4, [90, 160, 210]], [0.6, [160, 210, 235]], [1, [220, 240, 250]]
      ]),
      roughness: 0.85
    })
  );
  ice.add(atmosphere(iceR, '#7fd8ff', 3.0, 1.3));
  const ringGeo = new THREE.RingGeometry(iceR * 1.35, iceR * 2.3, 160, 1);
  // Remap UVs so the texture runs radially across the ring
  const pos = ringGeo.attributes.position;
  const uv = ringGeo.attributes.uv;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i);
    const t = (tmp.length() - iceR * 1.35) / (iceR * 0.95);
    uv.setXY(i, t, 0.5);
  }
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
    map: ringTexture(5),
    side: THREE.DoubleSide,
    transparent: true,
    roughness: 1,
    depthWrite: false
  }));
  ring.rotation.x = -Math.PI / 2 + 0.35;
  ice.add(ring);
  ice.position.set(2300, 380, -1300);
  ice.rotation.z = -0.2;
  ice.userData = { radius: iceR, spin: 0.01, name: 'Nereid' };
  planets.push(ice);

  // Small rocky moon near the play area
  const moonR = 170;
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(moonR, 96, 48),
    new THREE.MeshStandardMaterial({
      map: rockyTexture(31, [
        [0, [60, 52, 48]], [0.45, [120, 104, 90]], [0.55, [150, 132, 112]], [0.8, [190, 176, 160]], [1, [240, 240, 245]]
      ]),
      roughness: 1
    })
  );
  moon.add(atmosphere(moonR, '#c8b8a0', 4.0, 0.5));
  moon.position.set(700, -520, 1900);
  moon.userData = { radius: moonR, spin: 0.02, name: 'Kestrel' };
  planets.push(moon);

  return planets;
}

// Lumpy rock mesh built by displacing an icosphere.
const asteroidMaterials = [];
function getAsteroidMaterial(i) {
  if (!asteroidMaterials.length) {
    for (let k = 0; k < 3; k++) {
      asteroidMaterials.push(new THREE.MeshStandardMaterial({
        map: asteroidTexture(100 + k),
        roughness: 0.95,
        metalness: 0.05,
        flatShading: true,
        color: new THREE.Color().setHSL(0.07 + k * 0.02, 0.15, 0.75 + k * 0.08)
      }));
    }
  }
  return asteroidMaterials[i % asteroidMaterials.length];
}

export function createAsteroidMesh(radius, seed) {
  const rand = mulberry32(seed);
  const geometry = new THREE.IcosahedronGeometry(radius, radius > 12 ? 3 : 2);
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  const lobes = [];
  for (let i = 0; i < 5; i++) {
    lobes.push([new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize(), rand() * 0.35]);
  }
  // Displace by position so duplicated seam vertices stay together
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    let s = 1;
    for (const [dir, amt] of lobes) s += Math.max(0, n.dot(dir)) ** 3 * amt;
    const h = Math.sin(n.x * 9.1 + seed) * Math.sin(n.y * 7.3) * Math.sin(n.z * 8.7 + seed * 0.3);
    s += h * 0.08;
    s *= 0.85 + 0.15 * Math.abs(Math.sin(n.x * 3.1 + n.y * 2.3 + seed));
    v.copy(n).multiplyScalar(radius * s);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.scale(1, 0.75 + rand() * 0.25, 0.85 + rand() * 0.15);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, getAsteroidMaterial(seed));
  return mesh;
}

export function createDebrisGlow() {
  return glowTexture();
}
