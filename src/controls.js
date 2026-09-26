export function setupControls(player) {
  const controls = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false
  };

  const keys = {};

  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    updateControls();
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    updateControls();
  });

  function updateControls() {
    controls.forward = keys['w'] || keys['arrowup'];
    controls.backward = keys['s'] || keys['arrowdown'];
    controls.left = keys['a'] || keys['arrowleft'];
    controls.right = keys['d'] || keys['arrowright'];
    controls.up = keys[' '];
    controls.down = keys['control'];
  }

  // Mouse look
  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;

  window.addEventListener('mousedown', () => {
    mouseDown = true;
  });

  window.addEventListener('mouseup', () => {
    mouseDown = false;
  });

  window.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;

    const deltaX = e.movementX;
    const deltaY = e.movementY;

    player.yaw -= deltaX * 0.005;
    player.pitch -= deltaY * 0.005;

    // Clamp pitch
    player.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.pitch));
  });

  // Lock pointer on click
  document.addEventListener('click', () => {
    if (document.pointerLockElement !== document.documentElement) {
      document.documentElement.requestPointerLock();
    }
  });

  return controls;
}
