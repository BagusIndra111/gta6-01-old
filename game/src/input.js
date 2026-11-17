// Keyboard + mouse input. One object the whole game reads: keys held, mouse
// position in canvas pixels, and edge-triggered presses (justPressed).

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let anyKey = false;

  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
    anyKey = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
    anyKey = true;
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  return {
    keys, mouse,
    down(...names) { return names.some((n) => keys.has(n)); },
    axis(neg, pos) { return (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0); },
    // True once, on the frame the key went down. Call once per frame.
    justPressed(name) { return pressed.has(name); },
    anyKeyPressed() { return anyKey; },
    endFrame() { pressed.clear(); mouse.clicked = false; anyKey = false; },
  };
}
