import * as THREE from 'three';
import {
  terraTextures,
  lavaTextures,
  iceTextures,
  gasTextures,
  moonTextures,
  ringTexture,
} from './textures.js';

export const PLANET_DEFS = [
  { name: 'TERRA NOVA', type: 'terra', radius: 60, pos: [560, 0, 420], atmo: 0x4f9dff, strength: 1.6, spin: 0.02, tilt: 0.4, seed: 11, color: '#5aa9ff' },
  { name: 'KHARON', type: 'lava', radius: 38, pos: [-380, 30, 260], atmo: 0xff5a1f, strength: 1.3, spin: 0.03, tilt: 0.1, seed: 23, color: '#ff7a3d' },
  { name: 'ZEPHYR', type: 'gas', palette: 'amber', radius: 170, pos: [-1900, -80, -900], atmo: 0xffd49a, strength: 0.9, spin: 0.035, tilt: 0.35, seed: 37, rings: true, color: '#e8b57a' },
  { name: 'GLACIUS', type: 'ice', radius: 52, pos: [1600, 120, -1500], atmo: 0x9fe8ff, strength: 1.4, spin: 0.025, tilt: 0.2, seed: 41, color: '#a8ecff' },
  { name: 'VESPER', type: 'gas', palette: 'violet', radius: 110, pos: [300, -220, -2600], atmo: 0xc18bff, strength: 1.1, spin: 0.04, tilt: -0.25, seed: 53, color: '#c79bff' },
];

const atmoVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vCenter;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

function createAtmosphere(radius, color, sunPos, strength) {
  const uniforms = {
    uColor: { value: new THREE.Color(color) },
    uSun: { value: sunPos },
    uStrength: { value: strength },
  };
  const group = new THREE.Group();

  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.015, 64, 48),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: atmoVertex,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uSun;
        uniform float uStrength;
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          vec3 n = normalize(vN);
          vec3 v = normalize(cameraPosition - vW);
          vec3 l = normalize(uSun - vW);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);
          float lit = smoothstep(-0.25, 0.55, dot(n, l));
          gl_FragColor = vec4(uColor * fres * lit * uStrength, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.18, 64, 48),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: atmoVertex,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uSun;
        uniform float uStrength;
        varying vec3 vN;
        varying vec3 vW;
        varying vec3 vCenter;
        void main() {
          vec3 n = normalize(vN);
          vec3 v = normalize(cameraPosition - vW);
          float d = max(dot(-n, v), 0.0);
          float glow = pow(smoothstep(0.0, 0.6, d), 2.4);
          vec3 p = normalize(vW - vCenter);
          vec3 limb = normalize(p - v * dot(p, v) + 1e-5);
          vec3 l = normalize(uSun - vCenter);
          float lit = smoothstep(-0.35, 0.6, dot(limb, l));
          gl_FragColor = vec4(uColor * glow * lit * uStrength * 0.9, 1.0);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  group.add(halo, rim);
  return group;
}

function createRings(radius, seed) {
  const inner = radius * 1.35;
  const outer = radius * 2.35;
  const geo = new THREE.RingGeometry(inner, outer, 160, 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
  }
  const mat = new THREE.MeshStandardMaterial({
    map: ringTexture(seed),
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 1,
    metalness: 0,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

function surfaceMaterial(def) {
  switch (def.type) {
    case 'terra': {
      const t = terraTextures(def.seed);
      return {
        material: new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bumpMap, bumpScale: 3, roughness: 0.8, metalness: 0 }),
        clouds: t.clouds,
      };
    }
    case 'lava': {
      const t = lavaTextures(def.seed);
      return {
        material: new THREE.MeshStandardMaterial({
          map: t.map,
          bumpMap: t.bumpMap,
          bumpScale: 3,
          emissive: 0xffffff,
          emissiveMap: t.emissiveMap,
          emissiveIntensity: 2.4,
          roughness: 0.95,
        }),
      };
    }
    case 'ice': {
      const t = iceTextures(def.seed);
      return { material: new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bumpMap, bumpScale: 2, roughness: 0.55, metalness: 0.05 }) };
    }
    default: {
      const t = gasTextures(def.seed, def.palette);
      return { material: new THREE.MeshStandardMaterial({ map: t.map, roughness: 0.9, metalness: 0 }) };
    }
  }
}

function buildPlanet(def, sunPos) {
  const root = new THREE.Group();
  root.position.fromArray(def.pos);
  const tilted = new THREE.Group();
  tilted.rotation.z = def.tilt;
  root.add(tilted);

  const { material, clouds } = surfaceMaterial(def);
  const body = new THREE.Mesh(new THREE.SphereGeometry(def.radius, 128, 64), material);
  tilted.add(body);

  let cloudMesh = null;
  if (clouds) {
    cloudMesh = new THREE.Mesh(
      new THREE.SphereGeometry(def.radius * 1.012, 128, 64),
      new THREE.MeshStandardMaterial({ map: clouds, transparent: true, depthWrite: false, roughness: 1 }),
    );
    tilted.add(cloudMesh);
  }

  if (def.rings) tilted.add(createRings(def.radius, def.seed));

  root.add(createAtmosphere(def.radius, def.atmo, sunPos, def.strength));

  const planet = {
    name: def.name,
    kind: 'planet',
    radius: def.radius,
    color: def.color,
    root,
    pos: root.position,
    update(dt) {
      body.rotation.y += def.spin * dt;
      if (cloudMesh) cloudMesh.rotation.y += def.spin * 1.35 * dt;
    },
  };
  return planet;
}

function buildMoon(parent, sunPos) {
  const t = moonTextures(77);
  const radius = 14;
  const pivot = new THREE.Group();
  pivot.rotation.z = 0.25;
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 32),
    new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bumpMap, bumpScale: 2.5, roughness: 1 }),
  );
  moon.position.set(175, 0, 0);
  pivot.add(moon);
  parent.root.add(pivot);
  const world = new THREE.Vector3();
  return {
    name: 'SELENE',
    kind: 'moon',
    radius,
    color: '#b8b8c0',
    root: pivot,
    pos: world,
    update(dt) {
      pivot.rotation.y += 0.035 * dt;
      moon.rotation.y += 0.05 * dt;
      moon.getWorldPosition(world);
    },
  };
}

export async function createPlanets(sunPos, onProgress) {
  const planets = [];
  for (let i = 0; i < PLANET_DEFS.length; i++) {
    const def = PLANET_DEFS[i];
    await onProgress(`Forging ${def.name.toLowerCase()} (${i + 1}/${PLANET_DEFS.length})…`);
    planets.push(buildPlanet(def, sunPos));
  }
  const moon = buildMoon(planets[0], sunPos);
  moon.update(0);
  planets.push(moon);
  return planets;
}
