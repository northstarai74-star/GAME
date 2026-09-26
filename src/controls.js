// Keyboard, mouse (pointer lock) and touch input, merged into one control state.
export function setupControls(canvas, { onPause, onMute } = {}) {
  const controls = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    fire: false,
    boost: false,
    // Accumulated mouse movement since last frame, in pixels
    lookX: 0,
    lookY: 0,
    // Continuous steering rate from the touch stick, -1..1
    stickX: 0,
    stickY: 0,
    enabled: false,
    isTouch: window.matchMedia('(pointer: coarse)').matches
  };

  const keys = {};
  let mouseFire = false;
  const touch = { thrust: false, brake: false, fire: false, boost: false };

  function refresh() {
    controls.forward = keys['KeyW'] || keys['ArrowUp'] || touch.thrust;
    controls.backward = keys['KeyS'] || keys['ArrowDown'] || touch.brake;
    controls.left = keys['KeyA'] || keys['ArrowLeft'];
    controls.right = keys['KeyD'] || keys['ArrowRight'];
    controls.up = keys['KeyR'] || keys['KeyE'];
    controls.down = keys['KeyF'] || keys['KeyQ'];
    controls.fire = keys['Space'] || mouseFire || touch.fire;
    controls.boost = keys['ShiftLeft'] || keys['ShiftRight'] || touch.boost;
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') onPause?.();
    if (e.code === 'KeyM') onMute?.();
    keys[e.code] = true;
    refresh();
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    refresh();
  });

  // Drop held keys when the window loses focus so the ship doesn't keep flying.
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    mouseFire = false;
    refresh();
  });

  const locked = () => document.pointerLockElement === canvas;

  canvas.addEventListener('mousedown', (e) => {
    if (!controls.enabled || controls.isTouch) return;
    if (!locked()) {
      try {
        const req = canvas.requestPointerLock();
        if (req && req.catch) req.catch(() => {});
      } catch (err) { /* pointer lock unavailable; drag to steer instead */ }
    }
    if (e.button === 0) mouseFire = true;
    refresh();
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseFire = false;
    refresh();
  });

  let dragging = false;
  canvas.addEventListener('mousedown', () => { dragging = true; });
  window.addEventListener('mouseup', () => { dragging = false; });

  window.addEventListener('mousemove', (e) => {
    if (!controls.enabled) return;
    if (!locked() && !dragging) return;
    controls.lookX += e.movementX;
    controls.lookY += e.movementY;
  });

  document.addEventListener('pointerlockchange', () => {
    // Leaving pointer lock with Esc should pause the game
    if (!locked() && controls.enabled && !controls.isTouch) onPause?.(true);
  });

  // Touch stick
  const stick = document.getElementById('stick');
  const knob = document.getElementById('knob');
  let stickId = null;
  function setStick(clientX, clientY) {
    const r = stick.getBoundingClientRect();
    let dx = (clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (clientY - (r.top + r.height / 2)) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    controls.stickX = dx;
    controls.stickY = dy;
    knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
  }
  stick.addEventListener('pointerdown', (e) => {
    stickId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    setStick(e.clientX, e.clientY);
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) setStick(e.clientX, e.clientY);
  });
  const releaseStick = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    controls.stickX = controls.stickY = 0;
    knob.style.transform = '';
  };
  stick.addEventListener('pointerup', releaseStick);
  stick.addEventListener('pointercancel', releaseStick);

  // Touch buttons: held while pressed
  const bind = (id, key) => {
    const el = document.getElementById(id);
    const on = (e) => { e.preventDefault(); touch[key] = true; el.classList.add('active'); refresh(); };
    const off = () => { touch[key] = false; el.classList.remove('active'); refresh(); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  };
  bind('tThrust', 'thrust');
  bind('tBrake', 'brake');
  bind('tFire', 'fire');
  bind('tBoost', 'boost');

  controls.releaseAll = () => {
    for (const k in keys) keys[k] = false;
    mouseFire = false;
    Object.keys(touch).forEach((k) => { touch[k] = false; });
    controls.lookX = controls.lookY = 0;
    refresh();
  };

  controls.lock = () => {
    if (controls.isTouch) return;
    try {
      const req = canvas.requestPointerLock();
      if (req && req.catch) req.catch(() => {});
    } catch (err) { /* ignore */ }
  };

  controls.unlock = () => {
    if (locked()) document.exitPointerLock();
  };

  return controls;
}
