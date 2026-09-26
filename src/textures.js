import * as THREE from 'three';

// Small seeded RNG so every run gets the same planets.
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D value noise with fractal octaves, wrapping horizontally for equirect maps.
function makeNoise2D(rand, period) {
  const size = 256;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();

  const smooth = (t) => t * t * (3 - 2 * t);
  const at = (x, y) => grid[((y % size + size) % size) * size + ((x % size + size) % size)];

  function noise(x, y, p) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const x0 = xi % p, x1 = (xi + 1) % p;
    const a = at(x0, yi), b = at(x1, yi), c = at(x0, yi + 1), d = at(x1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }

  return function fbm(x, y, octaves = 5) {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += noise(x * freq, y * freq, period * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  };
}

function lerpColor(stops, t) {
  t = Math.min(1, Math.max(0, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
    }
  }
  return stops[stops.length - 1][1];
}

function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  paint(img.data, width, height);
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Banded gas giant with turbulent flow.
export function gasGiantTexture(seed, stops) {
  const rand = mulberry32(seed);
  const fbm = makeNoise2D(rand, 16);
  return canvasTexture(1024, 512, (data, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = (x / w) * 16;
        const v = (y / h) * 8;
        const turb = fbm(u * 0.5, v * 2.5, 5);
        const band = Math.sin((y / h) * 38 + turb * 6.0) * 0.5 + 0.5;
        const detail = fbm(u * 2, v * 6, 4);
        const t = band * 0.75 + detail * 0.25;
        const [r, g, b] = lerpColor(stops, t);
        const i = (y * w + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
      }
    }
  });
}

// Rocky or icy world with continents and craters.
export function rockyTexture(seed, stops) {
  const rand = mulberry32(seed);
  const fbm = makeNoise2D(rand, 8);
  return canvasTexture(1024, 512, (data, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = (x / w) * 8;
        const v = (y / h) * 4;
        const n = fbm(u, v, 6);
        const lat = Math.abs(y / h - 0.5) * 2;
        const t = n + Math.max(0, lat - 0.75) * 1.4;
        const [r, g, b] = lerpColor(stops, t);
        const i = (y * w + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
      }
    }
  });
}

// Grey rock surface for asteroids.
export function asteroidTexture(seed) {
  const rand = mulberry32(seed);
  const fbm = makeNoise2D(rand, 8);
  const stops = [
    [0, [40, 36, 34]],
    [0.45, [96, 88, 80]],
    [0.6, [130, 118, 104]],
    [1, [170, 160, 146]]
  ];
  return canvasTexture(512, 256, (data, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = fbm((x / w) * 8, (y / h) * 4, 6);
        const [r, g, b] = lerpColor(stops, n * 1.1);
        const i = (y * w + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
      }
    }
  });
}

// Radial ring bands; u runs from inner to outer edge.
export function ringTexture(seed) {
  const rand = mulberry32(seed);
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  for (let x = 0; x < 1024; x++) {
    const t = x / 1024;
    const gap = t > 0.55 && t < 0.6 ? 0.1 : 1;
    const a = (0.25 + rand() * 0.6) * gap * Math.sin(t * Math.PI) ** 0.4;
    const shade = 180 + rand() * 60;
    ctx.fillStyle = `rgba(${shade}, ${shade * 0.88}, ${shade * 0.72}, ${a})`;
    ctx.fillRect(x, 0, 1, 8);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Soft radial glow used for sprites and particles.
export function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, mid);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Brushed hull panels with seams, used on the ship.
export function hullTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(7);
  ctx.fillStyle = '#b9c2cf';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rand() * 8) * 64;
    const y = Math.floor(rand() * 16) * 32;
    const shade = 170 + Math.floor(rand() * 40);
    ctx.fillStyle = `rgb(${shade}, ${shade + 6}, ${shade + 14})`;
    ctx.fillRect(x, y, 64 * (1 + Math.floor(rand() * 2)), 32);
  }
  ctx.strokeStyle = 'rgba(40, 48, 60, 0.55)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 512; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
  for (let y = 0; y <= 512; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
