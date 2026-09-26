import * as THREE from 'three';

function panelTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a1430';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let x = 0; x < 32; x++) {
    for (let y = 0; y < 8; y++) {
      const shade = 30 + Math.random() * 25;
      ctx.fillStyle = `rgb(${shade * 0.35},${shade * 0.6},${shade * 1.6})`;
      ctx.fillRect(x * 16 + 1, y * 16 + 1, 14, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createStation(envMap) {
  const root = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xb8bec8, metalness: 0.75, roughness: 0.35, envMap });
  const dark = new THREE.MeshStandardMaterial({ color: 0x30343c, metalness: 0.6, roughness: 0.5, envMap });
  const panelMat = new THREE.MeshStandardMaterial({
    map: panelTexture(),
    metalness: 0.5,
    roughness: 0.3,
    envMap,
    emissive: 0x0a1a3a,
    emissiveIntensity: 0.4,
  });
  const windowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.78, 0.45) });

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 34, 32), hull);
  root.add(hub);
  for (const s of [1, -1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 16), hull);
    cap.position.y = 17 * s;
    cap.scale.y = 0.6;
    root.add(cap);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 3, 32), dark);
    band.position.y = 9 * s;
    root.add(band);
  }

  const spinner = new THREE.Group();
  root.add(spinner);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(42, 4, 24, 128), hull);
  ring.rotation.x = Math.PI / 2;
  spinner.add(ring);
  const ringTrim = new THREE.Mesh(new THREE.TorusGeometry(42, 4.3, 6, 128, Math.PI * 2), dark);
  ringTrim.rotation.x = Math.PI / 2;
  ringTrim.scale.z = 0.25;
  spinner.add(ringTrim);

  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 36, 12), dark);
    spoke.rotation.z = Math.PI / 2;
    const holder = new THREE.Group();
    holder.rotation.y = (i * Math.PI) / 2;
    spoke.position.x = 24;
    holder.add(spoke);
    spinner.add(holder);
  }

  const windows = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 1.1, 0.4), windowMat, 128);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 128; i++) {
    const a = ((i % 64) / 64) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 46.05, i < 64 ? 1.4 : -1.4, Math.sin(a) * 46.05);
    dummy.rotation.set(0, Math.PI / 2 - a, 0);
    dummy.updateMatrix();
    windows.setMatrixAt(i, dummy.matrix);
  }
  spinner.add(windows);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 32, 8), dark);
  mast.position.y = 32;
  root.add(mast);
  for (const s of [1, -1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(52, 0.5, 14), panelMat);
    panel.position.set(s * 32, 40, 0);
    root.add(panel);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 8, 6), dark);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(s * 4, 40, 0);
    root.add(arm);
  }

  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(9, 32, 12, 0, Math.PI * 2, 0, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 0.4, roughness: 0.4, side: THREE.DoubleSide, envMap }),
  );
  dish.position.y = -34;
  root.add(dish);
  const dishStem = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 12, 8), dark);
  dishStem.position.y = -26;
  root.add(dishStem);

  const beacons = [];
  const beaconGeo = new THREE.SphereGeometry(0.7, 12, 8);
  const addBeacon = (parent, x, y, z, r, g, b, phase) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
    const mesh = new THREE.Mesh(beaconGeo, mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    beacons.push({ mat, base: new THREE.Color(r, g, b), phase });
  };
  addBeacon(root, 0, 48.5, 0, 4, 0.4, 0.3, 0);
  addBeacon(root, 58, 40, 0, 0.3, 4, 0.6, 0.5);
  addBeacon(root, -58, 40, 0, 4, 0.4, 0.3, 0.5);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    addBeacon(spinner, Math.cos(a) * 42, 4.5, Math.sin(a) * 42, 0.5, 2.5, 4, i * 0.25);
  }

  root.rotation.set(0.35, 0, 0.25);

  return {
    name: 'HALCYON STATION',
    kind: 'station',
    radius: 50,
    color: '#ffffff',
    root,
    pos: root.position,
    update(dt, t) {
      spinner.rotation.y += dt * 0.12;
      for (const b of beacons) {
        const on = (t * 0.8 + b.phase) % 1 < 0.15 ? 1 : 0.05;
        b.mat.color.copy(b.base).multiplyScalar(on);
      }
    },
  };
}
