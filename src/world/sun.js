import * as THREE from 'three';
import { noiseGLSL } from '../glsl.js';
import { radialTexture } from './textures.js';

export const SUN_RADIUS = 120;

export function createSun() {
  const group = new THREE.Group();

  const surface = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vPos = position;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      ${noiseGLSL}
      uniform float uTime;
      varying vec3 vPos;
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vec3 p = normalize(vPos) * 3.0;
        float n = fbm(p + vec3(uTime * 0.03, uTime * 0.02, 0.0), 5);
        float n2 = fbm(p * 2.5 - vec3(0.0, uTime * 0.05, uTime * 0.02), 4);
        float heat = n * 0.6 + n2 * 0.4;
        vec3 col = mix(vec3(1.0, 0.25, 0.02), vec3(1.0, 0.72, 0.28), smoothstep(-0.4, 0.45, heat));
        col = mix(col, vec3(1.0, 0.95, 0.8), smoothstep(0.3, 0.65, heat));
        vec3 v = normalize(cameraPosition - vW);
        float mu = max(dot(normalize(vN), v), 0.0);
        col *= 0.5 + 0.5 * pow(mu, 0.45);
        gl_FragColor = vec4(col * 3.2, 1.0);
      }
    `,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS, 96, 48), surface);
  group.add(core);

  const coronaTex = radialTexture([
    [0, 'rgba(255,220,160,1)'],
    [0.12, 'rgba(255,170,90,0.75)'],
    [0.3, 'rgba(255,110,40,0.22)'],
    [0.6, 'rgba(255,70,20,0.05)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  const corona = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: coronaTex,
      color: new THREE.Color(1.6, 1.3, 1.0),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  corona.scale.setScalar(SUN_RADIUS * 9);
  group.add(corona);

  const light = new THREE.PointLight(0xfff0dc, 4.2, 0, 0);
  group.add(light);

  return {
    group,
    position: group.position,
    radius: SUN_RADIUS,
    update(t) {
      surface.uniforms.uTime.value = t;
      corona.material.rotation = t * 0.01;
      const pulse = 1 + Math.sin(t * 0.8) * 0.03;
      corona.scale.setScalar(SUN_RADIUS * 9 * pulse);
    },
  };
}
