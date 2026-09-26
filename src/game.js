import * as THREE from 'three';
import { createAsteroidMesh } from './objects.js';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Closest approach of segment a->b to point c, returns squared distance.
function segmentPointDistSq(a, b, c) {
  tmp.subVectors(b, a);
  tmp2.subVectors(c, a);
  const len = tmp.lengthSq();
  const t = len > 0 ? THREE.MathUtils.clamp(tmp2.dot(tmp) / len, 0, 1) : 0;
  tmp.multiplyScalar(t).add(a);
  return tmp.distanceToSquared(c);
}

function createEnemyMesh() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.85, roughness: 0.3 });
  const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.6, 0.5), toneMapped: false });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 1), metal);
  core.scale.set(1, 0.8, 1.2);
  g.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.28, 8, 32), metal);
  g.add(ring);
  const glow = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.1, 6, 32), red);
  glow.position.z = -0.3;
  g.add(glow);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.5, 0.9), metal);
    const a = (i / 3) * Math.PI * 2;
    blade.position.set(Math.cos(a) * 4.8, Math.sin(a) * 4.8, 0.6);
    blade.rotation.z = a + Math.PI / 2;
    g.add(blade);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), red);
  eye.position.z = -2.9;
  g.add(eye);
  g.userData.ring = ring;
  g.userData.glow = glow;
  return g;
}

function createCrystalMesh(kind) {
  const color = kind === 'repair' ? new THREE.Color(0.6, 3.2, 1.2) : new THREE.Color(0.8, 2.6, 3.6);
  const g = new THREE.Group();
  const inner = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.6, 0),
    new THREE.MeshBasicMaterial({ color, toneMapped: false })
  );
  inner.scale.set(1, 1.6, 1);
  g.add(inner);
  const shell = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.4, 0),
    new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.45, toneMapped: false })
  );
  shell.scale.set(1, 1.5, 1);
  g.add(shell);
  return g;
}

export function createGame(scene, particles, audio, events) {
  const asteroids = [];
  const enemies = [];
  const pickups = [];
  const bolts = [];

  // Laser bolt pool
  const boltGeo = new THREE.CylinderGeometry(0.18, 0.18, 7, 6);
  boltGeo.rotateX(Math.PI / 2);
  const playerBoltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 3.5, 5), toneMapped: false });
  const enemyBoltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.8, 0.5), toneMapped: false });
  for (let i = 0; i < 160; i++) {
    const mesh = new THREE.Mesh(boltGeo, playerBoltMat);
    mesh.visible = false;
    scene.add(mesh);
    bolts.push({ mesh, vel: new THREE.Vector3(), prev: new THREE.Vector3(), life: 0, owner: null, damage: 0 });
  }

  let seedCounter = 1;
  let wave = 0;
  let waveTimer = 3;
  let waveActive = false;
  let fireCooldown = 0;
  let gunSide = 0;
  const stats = { score: 0, kills: 0, crystals: 0 };

  function spawnAsteroid(radius, position, velocity) {
    const mesh = createAsteroidMesh(radius, seedCounter++);
    mesh.position.copy(position);
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    scene.add(mesh);
    asteroids.push({
      mesh,
      radius,
      hp: radius * 1.6,
      vel: velocity || new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6),
      spin: new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6)
    });
  }

  function randomFieldPoint(minDistFrom, minDist) {
    const p = new THREE.Vector3();
    for (let tries = 0; tries < 20; tries++) {
      // Flattened belt: wide in X/Z, thinner in Y
      const r = 150 + Math.random() * 1250;
      const a = Math.random() * Math.PI * 2;
      p.set(Math.cos(a) * r, (Math.random() - 0.5) * 360, Math.sin(a) * r);
      if (!minDistFrom || p.distanceTo(minDistFrom) > minDist) break;
    }
    return p;
  }

  function randomAsteroidRadius() {
    const r = Math.random();
    if (r < 0.6) return 5 + Math.random() * 8;
    if (r < 0.9) return 14 + Math.random() * 14;
    return 32 + Math.random() * 30;
  }

  function populateField(center) {
    for (let i = 0; i < 150; i++) spawnAsteroid(randomAsteroidRadius(), randomFieldPoint(center, 140));
    for (let i = 0; i < 12; i++) spawnPickup(randomFieldPoint(center, 80), 'crystal');
  }

  function spawnPickup(position, kind = 'crystal') {
    const mesh = createCrystalMesh(kind);
    mesh.position.copy(position);
    scene.add(mesh);
    pickups.push({ mesh, kind, vel: new THREE.Vector3(), age: 0 });
  }

  function spawnEnemy(player) {
    const mesh = createEnemyMesh();
    const dir = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.4, Math.random() - 0.5).normalize();
    mesh.position.copy(player.position).addScaledVector(dir, 700 + Math.random() * 300);
    scene.add(mesh);
    enemies.push({
      mesh,
      radius: 5.5,
      hp: 30 + wave * 6,
      maxSpeed: 120 + wave * 10,
      vel: new THREE.Vector3(),
      fireTimer: 1.5 + Math.random() * 2,
      fireInterval: Math.max(0.9, 2.4 - wave * 0.12),
      orbit: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      orbitSpeed: (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.4),
      flash: 0
    });
  }

  function fireBolt(owner, origin, direction, speed, damage, inheritVel) {
    const bolt = bolts.find((b) => b.life <= 0);
    if (!bolt) return;
    bolt.owner = owner;
    bolt.life = owner === 'player' ? 1.3 : 2.2;
    bolt.damage = damage;
    bolt.mesh.material = owner === 'player' ? playerBoltMat : enemyBoltMat;
    bolt.mesh.position.copy(origin);
    bolt.prev.copy(origin);
    bolt.vel.copy(direction).multiplyScalar(speed);
    if (inheritVel) bolt.vel.add(inheritVel);
    bolt.mesh.quaternion.setFromUnitVectors(Z_AXIS, direction);
    bolt.mesh.visible = true;
  }

  function destroyAsteroid(index, hitDir) {
    const a = asteroids[index];
    const pos = a.mesh.position.clone();
    scene.remove(a.mesh);
    a.mesh.geometry.dispose();
    asteroids.splice(index, 1);
    particles.explode(pos, Math.min(2.5, a.radius / 10), a.vel, 'fire');
    audio.explosion(Math.min(2, a.radius / 15));
    const points = Math.round(10 + a.radius * 2);
    addScore(points, pos);

    if (a.radius > 14) {
      const pieces = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < pieces; i++) {
        const off = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        const v = off.clone().multiplyScalar(15 + Math.random() * 20).add(a.vel);
        if (hitDir) v.addScaledVector(hitDir, 10);
        spawnAsteroid(a.radius * (0.4 + Math.random() * 0.15), pos.clone().addScaledVector(off, a.radius * 0.5), v);
      }
    }
    if (Math.random() < 0.45) spawnPickup(pos, 'crystal');
    events.onAsteroidDestroyed?.(pos);
  }

  function destroyEnemy(index) {
    const e = enemies[index];
    const pos = e.mesh.position.clone();
    scene.remove(e.mesh);
    enemies.splice(index, 1);
    particles.explode(pos, 2.2, e.vel, 'plasma');
    particles.explode(pos, 1.2, e.vel, 'fire');
    audio.explosion(2);
    stats.kills++;
    addScore(250 + wave * 50, pos);
    spawnPickup(pos, Math.random() < 0.35 ? 'repair' : 'crystal');
    events.onKill?.(pos);
  }

  function addScore(points, pos) {
    stats.score += points;
    events.onScore?.(points, pos);
  }

  function reset(player) {
    for (const a of asteroids) { scene.remove(a.mesh); a.mesh.geometry.dispose(); }
    for (const e of enemies) scene.remove(e.mesh);
    for (const p of pickups) scene.remove(p.mesh);
    asteroids.length = enemies.length = pickups.length = 0;
    for (const b of bolts) { b.life = 0; b.mesh.visible = false; }
    stats.score = stats.kills = stats.crystals = 0;
    wave = 0;
    waveTimer = 3;
    waveActive = false;
    fireCooldown = 0;
    populateField(player.position);
  }

  function collidePlayerWithSphere(player, center, radius, velocityOfOther, time, surface = 'rock') {
    const d = tmp.subVectors(player.position, center);
    const dist = d.length();
    const minDist = radius + player.radius;
    if (dist >= minDist || dist === 0) return;
    const n = d.divideScalar(dist);
    player.position.copy(center).addScaledVector(n, minDist);
    const rel = player.velocity.clone().sub(velocityOfOther || new THREE.Vector3());
    const vn = rel.dot(n);
    if (vn < 0) {
      player.velocity.addScaledVector(n, -vn * 1.4);
      const impact = -vn;
      if (impact > 25) {
        const dmg = (impact - 25) * 0.22;
        player.takeDamage(dmg, time);
        events.onPlayerHit?.(dmg, surface);
        audio.damage();
      }
      particles.sparks(player.position.clone().addScaledVector(n, -player.radius), n);
    }
  }

  function update(dt, time, player, controls, planets) {
    // Waves
    if (!waveActive) {
      waveTimer -= dt;
      if (waveTimer <= 0) {
        wave++;
        waveActive = true;
        const count = Math.min(12, 2 + wave);
        for (let i = 0; i < count; i++) spawnEnemy(player);
        events.onWave?.(wave, count);
      }
    } else if (enemies.length === 0) {
      waveActive = false;
      waveTimer = 5;
      addScore(500 * wave, null);
      events.onWaveCleared?.(wave);
    }

    // Player weapons
    fireCooldown -= dt;
    if (controls.fire && player.alive && fireCooldown <= 0 && !player.overheated) {
      fireCooldown = 0.11;
      const muzzle = events.getMuzzle(gunSide);
      gunSide = 1 - gunSide;
      // Converge on a point ahead of the ship
      const aim = player.position.clone().addScaledVector(player.forward, 320);
      const dir = aim.sub(muzzle).normalize();
      fireBolt('player', muzzle, dir, 900, 10, player.velocity);
      player.heat += 6.5;
      if (player.heat >= 100) {
        player.heat = 100;
        player.overheated = true;
        events.onOverheat?.();
      }
      audio.laser();
    }

    // Asteroids drift and spin
    for (const a of asteroids) {
      a.mesh.position.addScaledVector(a.vel, dt);
      a.mesh.rotation.x += a.spin.x * dt;
      a.mesh.rotation.y += a.spin.y * dt;
      a.mesh.rotation.z += a.spin.z * dt;
      if (player.alive) collidePlayerWithSphere(player, a.mesh.position, a.radius * 0.92, a.vel, time);
    }

    // Keep the belt populated
    if (asteroids.length < 120) {
      spawnAsteroid(randomAsteroidRadius(), randomFieldPoint(player.position, 700));
    }

    // Planets are solid too
    if (player.alive) {
      for (const p of planets) collidePlayerWithSphere(player, p.getWorldPosition(new THREE.Vector3()), p.userData.radius, null, time, 'planet');
    }

    // Enemies
    for (const e of enemies) {
      const toPlayer = tmp2.subVectors(player.position, e.mesh.position);
      const dist = toPlayer.length();
      // Orbit a point near the player
      e.orbit.applyAxisAngle(player.up, e.orbitSpeed * dt).normalize();
      const target = player.position.clone().addScaledVector(e.orbit, 110 + (e.orbitSpeed > 0 ? 30 : 0));
      const desired = target.sub(e.mesh.position);
      const dLen = desired.length();
      if (dLen > 0) desired.multiplyScalar(Math.min(e.maxSpeed, dLen * 1.2) / dLen);
      e.vel.lerp(desired, 1 - Math.exp(-1.6 * dt));

      // Avoid asteroids
      for (const a of asteroids) {
        const off = e.mesh.position.clone().sub(a.mesh.position);
        const d = off.length();
        const min = a.radius + e.radius + 8;
        if (d < min && d > 0) {
          e.vel.addScaledVector(off.divideScalar(d), (min - d) * 6 * dt * 10);
          if (d < a.radius + e.radius) e.mesh.position.copy(a.mesh.position).addScaledVector(off, a.radius + e.radius);
        }
      }
      e.mesh.position.addScaledVector(e.vel, dt);
      e.mesh.lookAt(player.position);
      e.mesh.rotateY(Math.PI);
      e.mesh.userData.ring.rotation.z += dt * 3;
      e.flash = Math.max(0, e.flash - dt * 6);
      e.mesh.userData.glow.material.color.setRGB(5 + e.flash * 10, 0.6 + e.flash * 8, 0.5 + e.flash * 8);

      // Fire with target lead
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && dist < 520 && player.alive) {
        e.fireTimer = e.fireInterval * (0.7 + Math.random() * 0.6);
        const t = dist / 380;
        const lead = player.position.clone().addScaledVector(player.velocity, t * 0.8);
        lead.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(dist * 0.06));
        const dir = lead.sub(e.mesh.position).normalize();
        const origin = e.mesh.position.clone().addScaledVector(dir, 5);
        fireBolt('enemy', origin, dir, 380, 7 + wave * 0.6, null);
        audio.enemyLaser();
      }
    }
    // Bolts
    for (const b of bolts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.prev.copy(b.mesh.position);
      b.mesh.position.addScaledVector(b.vel, dt);
      let hit = false;

      if (b.owner === 'player') {
        for (let i = enemies.length - 1; i >= 0 && !hit; i--) {
          const e = enemies[i];
          if (segmentPointDistSq(b.prev, b.mesh.position, e.mesh.position) < (e.radius + 1) ** 2) {
            hit = true;
            e.hp -= b.damage;
            e.flash = 1;
            e.vel.addScaledVector(b.vel, 0.02);
            particles.sparks(b.mesh.position.clone(), b.vel.clone().normalize().negate(), new THREE.Color(4, 1, 0.8), 18);
            audio.hit();
            events.onHitMarker?.();
            if (e.hp <= 0) destroyEnemy(i);
          }
        }
      } else if (player.alive) {
        if (segmentPointDistSq(b.prev, b.mesh.position, player.position) < (player.radius + 2) ** 2) {
          hit = true;
          player.takeDamage(b.damage, time);
          particles.sparks(b.mesh.position.clone(), b.vel.clone().normalize().negate(), new THREE.Color(1, 3, 4), 16);
          events.onPlayerHit?.(b.damage, 'laser');
          audio.damage();
        }
      }

      for (let i = asteroids.length - 1; i >= 0 && !hit; i--) {
        const a = asteroids[i];
        if (segmentPointDistSq(b.prev, b.mesh.position, a.mesh.position) < a.radius * a.radius * 0.85) {
          hit = true;
          const n = b.prev.clone().sub(a.mesh.position).normalize();
          particles.sparks(a.mesh.position.clone().addScaledVector(n, a.radius * 0.9), n);
          if (b.owner === 'player') {
            a.hp -= b.damage;
            a.vel.addScaledVector(b.vel, 0.3 / a.radius);
            events.onHitMarker?.();
            if (a.hp <= 0) destroyAsteroid(i, b.vel.clone().normalize());
          }
        }
      }

      if (hit || b.life <= 0) {
        b.life = 0;
        b.mesh.visible = false;
      }
    }

    // Pickups: spin, magnetise toward the player, collect
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.age += dt;
      p.mesh.rotation.y += dt * 1.6;
      p.mesh.children[1].rotation.x += dt * 0.8;
      const d = tmp.subVectors(player.position, p.mesh.position);
      const dist = d.length();
      if (player.alive && dist < 70) {
        p.vel.addScaledVector(d.normalize(), 600 * dt);
      }
      p.vel.multiplyScalar(Math.exp(-2 * dt));
      p.mesh.position.addScaledVector(p.vel, dt);
      if (player.alive && dist < player.radius + 3) {
        scene.remove(p.mesh);
        pickups.splice(i, 1);
        audio.pickup();
        if (p.kind === 'repair') {
          player.hull = Math.min(100, player.hull + 25);
          events.onPickup?.('Hull +25', 'repair');
        } else {
          stats.crystals++;
          player.shield = Math.min(100, player.shield + 10);
          player.boost = Math.min(100, player.boost + 20);
          addScore(50, null);
          events.onPickup?.('Crystal +50', 'crystal');
        }
      } else if (p.age > 90) {
        scene.remove(p.mesh);
        pickups.splice(i, 1);
      }
    }
  }

  return {
    asteroids,
    enemies,
    pickups,
    stats,
    get wave() { return wave; },
    get waveActive() { return waveActive; },
    reset,
    update
  };
}
