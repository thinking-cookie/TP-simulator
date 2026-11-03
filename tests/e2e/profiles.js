// Representative wheel layouts. Brands report steering and pedals on different axes, in different directions,
// sometimes with all pedals on one axis or on a separate USB device. Each profile describes one such layout.
// They are modelled on the patterns browsers show for real hardware, not exact copies of any one model.
//   d     = which plugged-in device (0 = first plugged in)
//   rest  = value with the pedal up, full = value floored
//   quirk = browser reports 0 for this axis until it is first moved (seen in Chrome on some pedal sets)

const BUTTONS = {
  up: { d: 0, b: 4 }, down: { d: 0, b: 5 },
  sigL: { d: 0, b: 0 }, sigR: { d: 0, b: 1 },
  lookL: { d: 0, b: 2 }, lookR: { d: 0, b: 3 },
  hand: { d: 0, b: 6 }, start: { d: 0, b: 7 }
};

module.exports = {
  // Pedals rest at +1 and go to -1, and read 0 until first touched.
  splitQuirk: {
    name: 'split pedals, rest +1, zero until touched',
    devices: [{ id: 'Thrustmaster T300RS Racing wheel (Vendor: 044f Product: b66e)', axes: [0, 0, 0, 0, 0, 0] }],
    steer: { d: 0, axis: 0, left: -1, right: 1, center: 0 },
    thr: { d: 0, axis: 2, rest: 1, full: -1, quirk: true },
    brk: { d: 0, axis: 5, rest: 1, full: -1, quirk: true },
    clu: { d: 0, axis: 1, rest: 1, full: -1, quirk: true },
    buttons: BUTTONS
  },
  // Pedals rest at -1 and go to +1, reported correctly from the start.
  splitRising: {
    name: 'split pedals, rest -1 to +1',
    devices: [{ id: 'Logitech G29 Driving Force Racing Wheel (Vendor: 046d Product: c24f)', axes: [0, 0, -1, -1, -1, 0, 0, 0, 0, 0] }],
    steer: { d: 0, axis: 0, left: -1, right: 1, center: 0 },
    thr: { d: 0, axis: 2, rest: -1, full: 1 },
    brk: { d: 0, axis: 3, rest: -1, full: 1 },
    clu: { d: 0, axis: 4, rest: -1, full: 1 },
    buttons: BUTTONS
  },
  // Older wheels: accelerator and brake share one axis (gas one way, brake the other). No clutch.
  combined: {
    name: 'combined pedal axis, no clutch',
    devices: [{ id: 'USB Racing Wheel (Vendor: 1234 Product: 5678)', axes: [0, 0, 0, 0] }],
    steer: { d: 0, axis: 0, left: -1, right: 1, center: 0 },
    thr: { d: 0, axis: 1, rest: 0, full: -1 },
    brk: { d: 0, axis: 1, rest: 0, full: 1 },
    clu: null,
    buttons: { up: { d: 0, b: 4 }, down: { d: 0, b: 5 }, sigL: { d: 0, b: 0 }, sigR: { d: 0, b: 1 } }
  },
  // Wheel base and pedals are two separate USB devices. Steering only reaches ±0.8 of the range.
  pedalBox: {
    name: 'separate pedal box, reduced steering range',
    devices: [
      { id: 'FANATEC CSL DD Wheel Base (Vendor: 0eb7 Product: 0020)', axes: [0, 0, 0] },
      { id: 'FANATEC CSL Pedals (Vendor: 0eb7 Product: 6204)', axes: [0, 0, 0] }
    ],
    steer: { d: 0, axis: 0, left: -0.8, right: 0.8, center: 0 },
    thr: { d: 1, axis: 0, rest: 0, full: 1 },
    brk: { d: 1, axis: 1, rest: 0, full: 1 },
    clu: { d: 1, axis: 2, rest: 0, full: 1 },
    buttons: BUTTONS
  }
};
