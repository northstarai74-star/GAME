import * as THREE from 'three';
import { createNoise3D, mulberry32 } from '../noise.js';

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (a, b, t) => {
  t = clamp01((t - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function ramp(stops, t, out) {
  if (t <= stops[0][0]) return setRGB(out, stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    if (t <= t1) {
      const [t0, c0] = stops[i - 1];
      const f = (t - t0) / (t1 - t0);
      out[0] = c0[0] + (c1[0] - c0[0]) * f;
      out[1] = c0[1] + (c1[1] - c0[1]) * f;
      out[2] = c0[2] + (c1[2] - c0[2]) * f;
      return out;
    }
  }
  return setRGB(out, stops[stops.length - 1][1]);
}

function setRGB(out, c) {
  out[0] = c[0];
  out[1] = c[1];
  out[2] = c[2];
  return out;
}

function mixInto(out, c, f) {
  out[0] += (c[0] - out[0]) * f;
  out[1] += (c[1] - out[1]) * f;
  out[2] += (c[2] - out[2]) * f;
}

function grey(out, v) {
  const g = clamp01(v) * 255;
  out[0] = out[1] = out[2] = g;
}

// Samples fn at the 3D unit-sphere point for each equirectangular pixel, so textures are seamless.
function paint(w, h, layers, fn) {
  const canvases = [];
  const imgs = [];
  for (let l = 0; l < layers; l++) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    canvases.push(c);
    imgs.push(c.getContext('2d').createImageData(w, h));
  }
  const datas = imgs.map((img) => img.data);
  const outs = Array.from({ length: layers }, () => [0, 0, 0, 255]);

  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI;
    const y = Math.sin(lat);
    const cl = Math.cos(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * Math.PI * 2;
      const x = cl * Math.cos(lon);
      const z = cl * Math.sin(lon);
      for (let l = 0; l < layers; l++) outs[l][3] = 255;
      fn(x, y, z, outs);
      const k = (j * w + i) * 4;
      for (let l = 0; l < layers; l++) {
        const d = datas[l];
        const o = outs[l];
        d[k] = o[0];
        d[k + 1] = o[1];
        d[k + 2] = o[2];
        d[k + 3] = o[3];
      }
    }
  }
  canvases.forEach((c, l) => c.getContext('2d').putImageData(imgs[l], 0, 0));
  return canvases;
}

function tex(canvas, color = true) {
  const t = new THREE.CanvasTexture(canvas);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function terraTextures(seed) {
  const n = createNoise3D(seed);
  const ocean = [[-0.6, [3, 14, 44]], [-0.15, [6, 36, 90]], [0, [22, 92, 150]]];
  const land = [
    [0, [200, 186, 136]],
    [0.025, [92, 134, 62]],
    [0.12, [52, 100, 44]],
    [0.22, [96, 110, 60]],
    [0.3, [124, 104, 78]],
    [0.4, [150, 144, 138]],
    [0.48, [240, 242, 248]],
  ];
  const [color, bump] = paint(1024, 512, 2, (x, y, z, [c, b]) => {
    const w = n.fbm(x * 1.2 + 11, y * 1.2, z * 1.2, 3) * 0.5;
    let h = n.fbm(x * 1.6 + w, y * 1.6 + w, z * 1.6 - w, 6) + 0.03;
    if (h > 0) h += n.ridged(x * 3.5, y * 3.5, z * 3.5, 4) * 0.18 * smooth(0, 0.08, h);
    if (h < 0) ramp(ocean, h, c);
    else ramp(land, h, c);
    const ice = Math.abs(y) + n.fbm(x * 5, y * 5, z * 5, 3) * 0.18;
    if (ice > 0.88) {
      const f = smooth(0.88, 0.94, ice);
      mixInto(c, [236, 242, 250], f);
      h = Math.max(h, 0.1 * f);
    }
    grey(b, h < 0 ? 0.2 : 0.2 + h * 1.6);
  });
  const [clouds] = paint(1024, 512, 1, (x, y, z, [c]) => {
    const w = n.fbm(x * 2 + 3, y * 2, z * 2, 3) * 0.8;
    const v = n.fbm(x * 2.5 + w + 40, y * 5 + w, z * 2.5 + w, 6);
    c[0] = c[1] = c[2] = 255;
    c[3] = smooth(0.02, 0.32, v) * 235;
  });
  return { map: tex(color), bumpMap: tex(bump, false), clouds: tex(clouds) };
}

export function lavaTextures(seed) {
  const n = createNoise3D(seed);
  const rock = [[-0.5, [18, 12, 11]], [0, [46, 30, 25]], [0.4, [92, 70, 58]]];
  const [color, emissive, bump] = paint(512, 256, 3, (x, y, z, [c, e, b]) => {
    const h = n.fbm(x * 2.2, y * 2.2, z * 2.2, 5);
    ramp(rock, h, c);
    const w = n.fbm(x * 1.5 + 5, y * 1.5, z * 1.5, 3) * 0.8;
    const r = 1 - Math.abs(n.fbm(x * 3 + w, y * 3 + w, z * 3 + w, 4));
    const crack = smooth(0.9, 0.985, r);
    const pool = smooth(0.22, 0.42, -h);
    const glow = Math.max(crack, pool * 0.85);
    const dim = 1 - glow * 0.7;
    c[0] *= dim;
    c[1] *= dim;
    c[2] *= dim;
    e[0] = 255 * glow;
    e[1] = (70 + 110 * glow) * glow;
    e[2] = 18 * glow;
    grey(b, 0.5 + h - glow * 0.4);
  });
  return { map: tex(color), emissiveMap: tex(emissive), bumpMap: tex(bump, false) };
}

export function iceTextures(seed) {
  const n = createNoise3D(seed);
  const ice = [[-0.5, [110, 150, 196]], [-0.1, [168, 204, 230]], [0.2, [222, 238, 248]], [0.5, [250, 252, 255]]];
  const [color, bump] = paint(512, 256, 2, (x, y, z, [c, b]) => {
    const h = n.fbm(x * 2.5, y * 2.5, z * 2.5, 5);
    ramp(ice, h, c);
    const w = n.fbm(x * 2 + 9, y * 2, z * 2, 2) * 0.6;
    const r = 1 - Math.abs(n.fbm(x * 4 + w, y * 4 + w, z * 4, 3));
    const cr = smooth(0.93, 0.99, r);
    mixInto(c, [60, 120, 185], cr * 0.75);
    grey(b, 0.5 + h * 0.8 - cr * 0.35);
  });
  return { map: tex(color), bumpMap: tex(bump, false) };
}

const gasPalettes = {
  amber: [
    [0, [92, 58, 38]],
    [0.25, [168, 112, 70]],
    [0.45, [222, 190, 146]],
    [0.6, [240, 226, 198]],
    [0.8, [196, 138, 88]],
    [0.9, [176, 84, 52]],
    [1, [120, 74, 48]],
  ],
  violet: [
    [0, [36, 22, 72]],
    [0.3, [104, 64, 156]],
    [0.5, [196, 150, 222]],
    [0.7, [110, 186, 210]],
    [1, [54, 46, 118]],
  ],
};

export function gasTextures(seed, palette) {
  const n = createNoise3D(seed);
  const rand = mulberry32(seed + 7);
  const pal = gasPalettes[palette];
  let sx = rand() - 0.5, sy = (rand() - 0.5) * 0.5, sz = rand() - 0.5;
  const sl = Math.hypot(sx, sy, sz);
  sx /= sl; sy /= sl; sz /= sl;
  const [color] = paint(1024, 512, 1, (x, y, z, [c]) => {
    const turb = n.fbm(x * 2, y * 7, z * 2, 5);
    const t = y * 2.6 + turb * 0.28 + n.fbm(x * 0.7, y * 0.7, z * 0.7, 2) * 0.25;
    const band = 0.5 + 0.5 * Math.sin(t * 9);
    const fine = 0.5 + 0.5 * Math.sin(t * 31 + turb * 4);
    let v = band * 0.75 + fine * 0.25;
    const d = x * sx + y * sy + z * sz;
    if (d > 0.955) {
      const s = smooth(0.955, 0.993, d);
      const swirl = n.fbm(x * 14, y * 14, z * 14, 3);
      v = v * (1 - s) + (0.88 + swirl * 0.35) * s;
    }
    ramp(pal, v, c);
  });
  return { map: tex(color) };
}

export function moonTextures(seed) {
  const n = createNoise3D(seed);
  const rand = mulberry32(seed);
  const craters = [];
  for (let i = 0; i < 70; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 0.03 + rand() ** 3 * 0.22;
    craters.push([s * Math.cos(th), u, s * Math.sin(th), 1 - Math.cos(r)]);
  }
  const [color, bump] = paint(512, 256, 2, (x, y, z, [c, b]) => {
    let v = 0.55 + n.fbm(x * 3, y * 3, z * 3, 5) * 0.5;
    let h = 0.5 + n.fbm(x * 6, y * 6, z * 6, 4) * 0.3;
    for (const [cx, cy, cz, k] of craters) {
      const q = (1 - (x * cx + y * cy + z * cz)) / k;
      if (q < 1.4) {
        if (q < 0.85) {
          v *= 0.82;
          h -= 0.25 * (1 - q / 0.85);
        } else if (q < 1.15) {
          v *= 1.12;
          h += 0.15;
        }
      }
    }
    grey(c, v * 0.62);
    grey(b, h);
  });
  return { map: tex(color), bumpMap: tex(bump, false) };
}

export function ringTexture(seed) {
  const n = createNoise3D(seed);
  const w = 1024;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = 4;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, 4);
  for (let i = 0; i < w; i++) {
    const r = i / (w - 1);
    const v = 0.5 + 0.5 * n.noise(r * 60, 0.3, 0.7);
    const v2 = 0.5 + 0.5 * n.noise(r * 220, 1.1, 0.2);
    let a = (0.3 + 0.7 * v) * (0.55 + 0.45 * v2);
    a *= smooth(0, 0.06, r) * smooth(1, 0.86, r);
    a *= 1 - 0.92 * smooth(0.5, 0.52, r) * smooth(0.6, 0.58, r);
    const col = [230 - v * 50, 212 - v * 60, 178 - v * 70];
    for (let j = 0; j < 4; j++) {
      const k = (j * w + i) * 4;
      img.data[k] = col[0];
      img.data[k + 1] = col[1];
      img.data[k + 2] = col[2];
      img.data[k + 3] = a * 235;
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(c);
}

export function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return tex(c);
}
