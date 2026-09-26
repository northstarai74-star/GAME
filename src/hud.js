import * as THREE from 'three';

const RADAR_RANGE = 1600;
const FLARES = [
  { t: 0.0, size: 220, cls: 'f-glow' },
  { t: 0.45, size: 34, cls: 'f-ring' },
  { t: 0.7, size: 70, cls: 'f-hex' },
  { t: 1.1, size: 22, cls: 'f-dot' },
  { t: 1.35, size: 120, cls: 'f-ring' },
  { t: 1.7, size: 48, cls: 'f-hex' },
  { t: 2.1, size: 180, cls: 'f-halo' },
];

function fmtDist(units) {
  const m = units * 10;
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m)} m`;
}

export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function createHUD() {
  const $ = (id) => document.getElementById(id);
  const el = {
    speed: $('speed'),
    boost: $('boost-bar'),
    throttle: $('throttle-bar'),
    cores: $('cores'),
    timer: $('timer'),
    targetDist: $('target-dist'),
    steer: $('steer'),
    message: $('message'),
    markers: $('markers'),
    flares: $('flares'),
    radar: $('radar'),
    heat: $('heat'),
  };
  const radar = el.radar.getContext('2d');

  const markerPool = new Map();
  function marker(key, cls) {
    let m = markerPool.get(key);
    if (!m) {
      const div = document.createElement('div');
      div.className = `marker ${cls}`;
      div.innerHTML = '<div class="m-icon"></div><div class="m-label"></div>';
      el.markers.appendChild(div);
      m = { div, label: div.querySelector('.m-label'), text: '' };
      markerPool.set(key, m);
    }
    return m;
  }

  const coreArrow = document.createElement('div');
  coreArrow.className = 'edge-arrow';
  el.markers.appendChild(coreArrow);

  const flareEls = FLARES.map((f) => {
    const d = document.createElement('div');
    d.className = `flare ${f.cls}`;
    d.style.width = d.style.height = `${f.size}px`;
    el.flares.appendChild(d);
    return d;
  });
  let flareVis = 0;

  let msgTimer = 0;
  const v = new THREE.Vector3();
  const cam = new THREE.Vector3();
  const inv = new THREE.Quaternion();
  const ray = new THREE.Vector3();
  const toC = new THREE.Vector3();

  function project(pos, camera, w, h) {
    cam.copy(pos).applyMatrix4(camera.matrixWorldInverse);
    const behind = cam.z > 0;
    v.copy(cam).applyMatrix4(camera.projectionMatrix);
    return {
      behind,
      onScreen: !behind && Math.abs(v.x) < 1 && Math.abs(v.y) < 1,
      x: (v.x * 0.5 + 0.5) * w,
      y: (-v.y * 0.5 + 0.5) * h,
      cx: cam.x,
      cy: cam.y,
    };
  }

  function occluded(from, to, bodies) {
    ray.subVectors(to, from);
    const len = ray.length();
    ray.divideScalar(len);
    for (const b of bodies) {
      toC.subVectors(b.pos, from);
      const along = toC.dot(ray);
      if (along < 0 || along > len) continue;
      if (toC.lengthSq() - along * along < b.radius * b.radius) return true;
    }
    return false;
  }

  function drawRadar(ship, bodies, cores, sunPos) {
    const W = el.radar.width;
    const R = W / 2 - 8;
    radar.clearRect(0, 0, W, W);
    radar.save();
    radar.translate(W / 2, W / 2);
    radar.strokeStyle = 'rgba(94,242,255,0.22)';
    radar.lineWidth = 1;
    for (const f of [1, 0.66, 0.33]) {
      radar.beginPath();
      radar.arc(0, 0, R * f, 0, Math.PI * 2);
      radar.stroke();
    }
    radar.beginPath();
    radar.moveTo(-R, 0);
    radar.lineTo(R, 0);
    radar.moveTo(0, -R);
    radar.lineTo(0, R);
    radar.stroke();

    inv.copy(ship.quaternion).invert();
    const plot = (pos, color, size, shape) => {
      v.subVectors(pos, ship.position).applyQuaternion(inv);
      let x = (v.x / RADAR_RANGE) * R;
      let y = (v.z / RADAR_RANGE) * R;
      const d = Math.hypot(x, y);
      let edge = false;
      if (d > R) {
        x *= R / d;
        y *= R / d;
        edge = true;
      }
      radar.globalAlpha = edge ? 0.45 : 1;
      radar.fillStyle = color;
      radar.strokeStyle = color;
      if (!edge && Math.abs(v.y) > 20) {
        radar.beginPath();
        radar.moveTo(x, y);
        radar.lineTo(x, y + Math.max(-14, Math.min(14, (-v.y / RADAR_RANGE) * R)));
        radar.stroke();
      }
      radar.beginPath();
      if (shape === 'square') radar.rect(x - size, y - size, size * 2, size * 2);
      else radar.arc(x, y, size, 0, Math.PI * 2);
      radar.fill();
    };
    plot(sunPos, '#ffc861', 6);
    for (const b of bodies) plot(b.pos, b.color, b.kind === 'planet' ? 4.5 : 3, b.kind === 'station' ? 'square' : 'circle');
    for (const c of cores.items) if (!c.collected) plot(c.pos, '#5ef2ff', 2);
    radar.globalAlpha = 1;
    radar.fillStyle = '#ffffff';
    radar.beginPath();
    radar.moveTo(0, -7);
    radar.lineTo(5, 5);
    radar.lineTo(0, 2);
    radar.lineTo(-5, 5);
    radar.closePath();
    radar.fill();
    radar.restore();
  }

  function updateFlares(camera, sunPos, bodies, w, h, dt) {
    const p = project(sunPos, camera, w, h);
    const ndcDist = Math.hypot(p.x / w - 0.5, p.y / h - 0.5) * 2;
    const visible = !p.behind && ndcDist < 1.3 && !occluded(camera.position, sunPos, bodies);
    const target = visible ? Math.max(0, 1 - ndcDist * 0.8) : 0;
    flareVis += (target - flareVis) * Math.min(1, dt * 10);
    const cx = w / 2;
    const cy = h / 2;
    FLARES.forEach((f, i) => {
      const x = p.x + (cx - p.x) * f.t;
      const y = p.y + (cy - p.y) * f.t;
      const s = flareEls[i].style;
      s.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      s.opacity = (flareVis * (i === 0 ? 0.9 : 0.55)).toFixed(3);
    });
  }

  return {
    flash(text, kind = 'info', duration = 2.2) {
      el.message.textContent = text;
      el.message.className = `show ${kind}`;
      msgTimer = duration;
    },
    update(dt, s) {
      const { camera, ship, cores, bodies, sunPos, w, h } = s;
      camera.updateMatrixWorld();

      if (msgTimer > 0) {
        msgTimer -= dt;
        if (msgTimer <= 0) el.message.className = '';
      }

      el.speed.textContent = Math.round(ship.velocity.length() * 10);
      el.boost.style.width = `${ship.energy}%`;
      el.boost.classList.toggle('low', ship.energy < 25);
      el.throttle.style.width = `${Math.round(ship.throttle * 100)}%`;
      el.cores.textContent = `${s.collected} / ${cores.total}`;
      el.timer.textContent = fmtTime(s.elapsed);
      el.heat.classList.toggle('show', s.heat);

      const r = Math.min(w, h) * 0.16;
      el.steer.style.transform = `translate(${ship.steer.x * r}px, ${ship.steer.y * r}px) translate(-50%, -50%)`;

      for (const b of bodies) {
        const m = marker(b.name, b.kind);
        const p = project(b.pos, camera, w, h);
        const d = camera.position.distanceTo(b.pos);
        const show = s.showMarkers && p.onScreen && d > b.radius * 2.2;
        m.div.style.display = show ? '' : 'none';
        if (!show) continue;
        const text = `${b.name} · ${fmtDist(d - b.radius)}`;
        if (text !== m.text) {
          m.label.textContent = text;
          m.text = text;
        }
        m.div.style.transform = `translate(${p.x}px, ${p.y}px)`;
      }

      const core = cores.nearest(ship.position);
      const cm = marker('core', 'core');
      if (core && s.showMarkers) {
        const d = ship.position.distanceTo(core.pos);
        el.targetDist.textContent = fmtDist(d);
        const p = project(core.pos, camera, w, h);
        if (p.onScreen) {
          cm.div.style.display = '';
          coreArrow.style.display = 'none';
          cm.div.style.transform = `translate(${p.x}px, ${p.y}px)`;
          const text = fmtDist(d);
          if (text !== cm.text) {
            cm.label.textContent = text;
            cm.text = text;
          }
        } else {
          cm.div.style.display = 'none';
          coreArrow.style.display = '';
          let ax = p.cx;
          let ay = -p.cy;
          if (Math.abs(ax) + Math.abs(ay) < 1e-4) ay = 1;
          const ang = Math.atan2(ay, ax);
          const rx = w * 0.42;
          const ry = h * 0.4;
          coreArrow.style.transform = `translate(${w / 2 + Math.cos(ang) * rx}px, ${h / 2 + Math.sin(ang) * ry}px) translate(-50%, -50%) rotate(${ang}rad)`;
        }
      } else {
        el.targetDist.textContent = '—';
        cm.div.style.display = 'none';
        coreArrow.style.display = 'none';
      }

      updateFlares(camera, sunPos, bodies, w, h, dt);
      drawRadar(ship, bodies, cores, sunPos);
    },
  };
}
