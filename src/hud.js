import * as THREE from 'three';

const $ = (id) => document.getElementById(id);

export function createHUD() {
  const el = {
    score: $('score'), wave: $('wave'), hostiles: $('hostiles'), crystals: $('crystals'),
    speed: $('speed'), speedo: $('speedo'), position: $('position'), sector: $('sector'), kills: $('kills'),
    reticle: $('reticle'), banner: $('banner'), bannerBig: $('bannerBig'), bannerSmall: $('bannerSmall'),
    toasts: $('toasts'), vignette: $('vignette'), alarm: $('alarm')
  };
  const gauges = {};
  for (const [key, id] of [['hull', 'gHull'], ['shield', 'gShield'], ['boost', 'gBoost'], ['heat', 'gHeat']]) {
    const root = $(id);
    gauges[key] = { root, fill: root.querySelector('.fill'), value: root.querySelector('.value'), last: -1 };
  }

  const radar = $('radar');
  const rctx = radar.getContext('2d');
  const overlay = $('overlay2d');
  const octx = overlay.getContext('2d');
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    overlay.width = Math.floor(window.innerWidth * dpr);
    overlay.height = Math.floor(window.innerHeight * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  let bannerTimer = 0;
  let damageFlash = 0;
  let hitTimer = 0;

  function setGauge(key, v, warnBelow = -1) {
    const g = gauges[key];
    const rounded = Math.round(v);
    if (rounded === g.last) return;
    g.last = rounded;
    g.fill.style.transform = `scaleX(${Math.max(0, v) / 100})`;
    g.value.textContent = rounded;
    g.root.classList.toggle('warn', warnBelow >= 0 && v < warnBelow);
  }

  function banner(big, small = '', seconds = 2.6) {
    el.bannerBig.textContent = big;
    el.bannerSmall.textContent = small;
    el.banner.classList.add('show');
    bannerTimer = seconds;
  }

  function toast(text, tone = 'amber') {
    const t = document.createElement('div');
    t.className = 'toast' + (tone === 'cyan' ? ' cyan' : '');
    t.textContent = text;
    el.toasts.appendChild(t);
    setTimeout(() => t.remove(), 1000);
    while (el.toasts.children.length > 5) el.toasts.firstChild.remove();
  }

  function damage(amount) {
    damageFlash = Math.min(1, damageFlash + 0.25 + amount / 40);
  }

  function hitMarker() {
    hitTimer = 0.12;
  }

  const rel = new THREE.Vector3();
  const invQ = new THREE.Quaternion();

  // Top-down radar in the ship's frame: up on the radar is straight ahead.
  function drawRadar(player, game) {
    const w = radar.width, h = radar.height;
    const cx = w / 2, cy = h / 2, R = w / 2 - 6;
    const range = 800;
    rctx.clearRect(0, 0, w, h);

    rctx.strokeStyle = 'rgba(111, 227, 255, 0.18)';
    rctx.lineWidth = 2;
    for (const f of [0.33, 0.66, 1]) {
      rctx.beginPath();
      rctx.arc(cx, cy, R * f, 0, Math.PI * 2);
      rctx.stroke();
    }
    rctx.beginPath();
    rctx.moveTo(cx, cy - R); rctx.lineTo(cx, cy + R);
    rctx.moveTo(cx - R, cy); rctx.lineTo(cx + R, cy);
    rctx.stroke();

    // Forward view cone
    rctx.fillStyle = 'rgba(111, 227, 255, 0.06)';
    rctx.beginPath();
    rctx.moveTo(cx, cy);
    rctx.arc(cx, cy, R, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6);
    rctx.closePath();
    rctx.fill();

    invQ.copy(player.quaternion).invert();
    const plot = (pos, color, size, shape) => {
      rel.subVectors(pos, player.position).applyQuaternion(invQ);
      const d = Math.hypot(rel.x, rel.z);
      let x = rel.x / range * R;
      let y = rel.z / range * R;
      let edge = false;
      if (d > range) {
        x = rel.x / d * R;
        y = rel.z / d * R;
        edge = true;
        if (shape !== 'enemy') return;
      }
      rctx.fillStyle = color;
      rctx.globalAlpha = edge ? 0.6 : 1;
      if (shape === 'enemy') {
        rctx.beginPath();
        rctx.moveTo(cx + x, cy + y - size);
        rctx.lineTo(cx + x + size, cy + y + size);
        rctx.lineTo(cx + x - size, cy + y + size);
        rctx.closePath();
        rctx.fill();
        // Height tick: above or below the ship
        rctx.fillRect(cx + x - 1, cy + y, 2, THREE.MathUtils.clamp(-rel.y / range * R, -20, 20));
      } else {
        rctx.beginPath();
        rctx.arc(cx + x, cy + y, size, 0, Math.PI * 2);
        rctx.fill();
      }
      rctx.globalAlpha = 1;
    };

    for (const a of game.asteroids) plot(a.mesh.position, 'rgba(160, 170, 185, 0.55)', Math.max(2, Math.min(7, a.radius / 5)), 'rock');
    for (const p of game.pickups) plot(p.mesh.position, p.kind === 'repair' ? '#7dffb0' : '#6fe3ff', 3, 'pickup');
    for (const e of game.enemies) plot(e.mesh.position, '#ff4d5e', 7, 'enemy');

    rctx.fillStyle = '#ffb347';
    rctx.beginPath();
    rctx.moveTo(cx, cy - 8); rctx.lineTo(cx + 6, cy + 6); rctx.lineTo(cx - 6, cy + 6);
    rctx.closePath();
    rctx.fill();
  }

  const proj = new THREE.Vector3();

  // Target brackets for hostiles, with edge arrows when off screen.
  function drawOverlay(camera, player, game) {
    const W = overlay.width, H = overlay.height;
    octx.clearRect(0, 0, W, H);
    octx.lineWidth = 2 * dpr;
    octx.font = `${11 * dpr}px 'Share Tech Mono', monospace`;
    octx.textAlign = 'center';

    for (const e of game.enemies) {
      const dist = e.mesh.position.distanceTo(player.position);
      proj.copy(e.mesh.position).project(camera);
      const behind = proj.z > 1;
      let x = (proj.x * 0.5 + 0.5) * W;
      let y = (-proj.y * 0.5 + 0.5) * H;
      const margin = 40 * dpr;
      const onScreen = !behind && x > margin && x < W - margin && y > margin && y < H - margin;

      if (onScreen) {
        const s = THREE.MathUtils.clamp(900 / dist, 10, 34) * dpr;
        octx.strokeStyle = e.flash > 0 ? '#ffffff' : '#ff4d5e';
        const c = s * 0.45;
        octx.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          octx.moveTo(x + sx * s, y + sy * s - sy * c);
          octx.lineTo(x + sx * s, y + sy * s);
          octx.lineTo(x + sx * s - sx * c, y + sy * s);
        }
        octx.stroke();
        octx.fillStyle = '#ff4d5e';
        octx.fillText(`${Math.round(dist)} m`, x, y + s + 14 * dpr);
      } else {
        // Direction from centre in screen space; flip when behind the camera
        let dx = x - W / 2, dy = y - H / 2;
        if (behind) { dx = -dx; dy = -dy; }
        const ang = Math.atan2(dy, dx);
        const rx = W / 2 - margin, ry = H / 2 - margin;
        const t = Math.min(rx / Math.abs(Math.cos(ang) || 1e-6), ry / Math.abs(Math.sin(ang) || 1e-6));
        const ax = W / 2 + Math.cos(ang) * t;
        const ay = H / 2 + Math.sin(ang) * t;
        octx.save();
        octx.translate(ax, ay);
        octx.rotate(ang);
        octx.fillStyle = 'rgba(255, 77, 94, 0.85)';
        octx.beginPath();
        octx.moveTo(12 * dpr, 0);
        octx.lineTo(-6 * dpr, 8 * dpr);
        octx.lineTo(-6 * dpr, -8 * dpr);
        octx.closePath();
        octx.fill();
        octx.restore();
      }
    }
  }

  function update(dt, player, game, camera) {
    el.score.textContent = String(game.stats.score).padStart(6, '0');
    el.wave.textContent = game.wave || '-';
    el.hostiles.textContent = game.enemies.length;
    el.crystals.textContent = game.stats.crystals;
    el.kills.textContent = game.stats.kills;
    el.speed.textContent = Math.round(player.speed);
    el.speedo.classList.toggle('boosting', player.boosting);
    const p = player.position;
    el.position.textContent = `${p.x.toFixed(0)} ${p.y.toFixed(0)} ${p.z.toFixed(0)}`;
    const sx = String.fromCharCode(75 + Math.floor(p.x / 800));
    el.sector.textContent = `${sx}-${7 + Math.floor(p.z / 800)}`;

    setGauge('hull', player.hull, 30);
    setGauge('shield', player.shield);
    setGauge('boost', player.boost);
    setGauge('heat', player.heat);
    gauges.heat.root.classList.toggle('overheat', player.overheated);
    el.alarm.hidden = !(player.hull < 30 && player.alive);

    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) el.banner.classList.remove('show');
    }
    damageFlash = Math.max(0, damageFlash - dt * 1.6);
    const lowHull = player.alive && player.hull < 30 ? 0.25 + 0.15 * Math.sin(performance.now() / 180) : 0;
    el.vignette.style.opacity = Math.max(damageFlash, lowHull);
    hitTimer -= dt;
    el.reticle.classList.toggle('hit', hitTimer > 0);

    drawRadar(player, game);
    drawOverlay(camera, player, game);
  }

  function clearOverlay() {
    octx.clearRect(0, 0, overlay.width, overlay.height);
    damageFlash = 0;
    el.vignette.style.opacity = 0;
  }

  return { update, banner, toast, damage, hitMarker, clearOverlay };
}
