// Fake game controllers for end-to-end tests. Loaded into the page before the trainer starts.
// Replaces navigator.getGamepads() so tests can plug in "wheels" and "pedal boxes", move axes and press buttons,
// exactly as the browser would report real hardware. No physical device needed.
(() => {
  const pads = [];
  const fire = (type, gamepad) => {
    const e = new Event(type);
    Object.defineProperty(e, 'gamepad', { value: gamepad });
    window.dispatchEvent(e);
  };
  Object.defineProperty(navigator, 'getGamepads', {
    configurable: true,
    value: () => [0, 1, 2, 3].map(i => pads[i] || null)
  });
  window.__fake = {
    // Plug in a device. axes = starting values. Returns its slot number.
    plug(id, axes, buttons = 16) {
      const g = {
        id, index: pads.length, connected: true, mapping: '', timestamp: performance.now(),
        axes: axes.slice(),
        buttons: Array.from({ length: buttons }, () => ({ pressed: false, touched: false, value: 0 }))
      };
      pads.push(g);
      fire('gamepadconnected', g);
      return g.index;
    },
    unplug(i) { const g = pads[i]; pads[i] = null; if (g) { g.connected = false; fire('gamepaddisconnected', g); } },
    axis(i, a, v) { pads[i].axes[a] = v; pads[i].timestamp = performance.now(); },
    button(i, b, on) { pads[i].buttons[b] = { pressed: on, touched: on, value: on ? 1 : 0 }; pads[i].timestamp = performance.now(); }
  };
})();
