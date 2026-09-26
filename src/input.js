const BLOCKED = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown']);

export function createInput(canvas) {
  const keys = new Set();
  const pressed = [];
  let dx = 0;
  let dy = 0;
  let locked = false;
  let dragging = false;
  const listeners = new Set();

  window.addEventListener('keydown', (e) => {
    if (BLOCKED.has(e.code)) e.preventDefault();
    if (!e.repeat) pressed.push(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    listeners.forEach((fn) => fn(locked));
  });

  window.addEventListener('mousedown', () => (dragging = true));
  window.addEventListener('mouseup', () => (dragging = false));
  window.addEventListener('mousemove', (e) => {
    if (!locked && !dragging) return;
    dx += e.movementX;
    dy += e.movementY;
  });

  return {
    keys,
    get locked() {
      return locked;
    },
    onLockChange(fn) {
      listeners.add(fn);
    },
    lock() {
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch {
        // Pointer lock unavailable; drag-to-steer still works.
      }
    },
    unlock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    consumeMouse() {
      const r = { dx, dy };
      dx = dy = 0;
      return r;
    },
    consumePressed() {
      return pressed.splice(0);
    },
  };
}
