// End-to-end tests for steering wheel and pedal support, using fake controllers (no hardware).
const { test, expect } = require('@playwright/test');
const P = require('./profiles');
const H = require('./helpers');

const MAXS = 0.64;   // the car's full steering lock in the trainer

// ---------- Setup works for every layout, then the car actually drives ----------
for (const [key, profile] of Object.entries(P)) {
  test.describe(`${profile.name}`, () => {
    test('setup maps every control and the car drives on it', async ({ page }) => {
      const errors = await H.load(page);
      await H.plug(page, profile);
      await H.runSetup(page, profile);

      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tp-wheel-v1')));
      expect(saved.steer).toMatchObject({ axis: profile.steer.axis });
      expect(saved.thr).toMatchObject({ axis: profile.thr.axis, rest: profile.thr.rest, full: profile.thr.full });
      expect(saved.brk).toMatchObject({ axis: profile.brk.axis, rest: profile.brk.rest, full: profile.brk.full });
      if (profile.clu) expect(saved.clu).toMatchObject({ axis: profile.clu.axis });
      else expect(saved.clu).toBeUndefined();

      const s = profile.steer, thr = profile.thr, brk = profile.brk;
      // Half right on the wheel = half lock on the car
      await H.setAxis(page, s.d, s.axis, H.steerRaw(s, 0.5));
      await expect.poll(async () => (await H.car(page)).steer).toBeCloseTo(0.5 * MAXS, 1);
      // Full left = full lock left
      await H.setAxis(page, s.d, s.axis, s.left);
      await expect.poll(async () => (await H.car(page)).steer).toBeCloseTo(-MAXS, 2);
      await H.setAxis(page, s.d, s.axis, s.center);

      // Accelerator moves the car forward in D
      await H.setAxis(page, thr.d, thr.axis, H.pedalRaw(thr, 0.8));
      await expect.poll(async () => (await H.car(page)).v, { timeout: 5000 }).toBeGreaterThan(2);
      await H.setAxis(page, thr.d, thr.axis, thr.rest);

      // Brake stops it
      await H.setAxis(page, brk.d, brk.axis, H.pedalRaw(brk, 1));
      await expect.poll(async () => (await H.car(page)).v, { timeout: 5000 }).toBe(0);

      // Gear down button selects Reverse when stopped; gear up goes back to Drive.
      // Foot stays on the brake: without it the car creeps in R and the trainer (rightly) refuses D while moving.
      await H.press(page, profile.buttons.down);
      await expect.poll(async () => (await H.car(page)).gear).toBe('R');
      await H.press(page, profile.buttons.up);
      await expect.poll(async () => (await H.car(page)).gear).toBe('D');
      await H.setAxis(page, brk.d, brk.axis, brk.rest);

      // Signal button
      await H.press(page, profile.buttons.sigL);
      await expect.poll(async () => (await H.car(page)).signal).toBe('L');

      expect(errors).toEqual([]);
    });
  });
}

// ---------- Pedals are analogue, not on/off ----------
test('more accelerator means more speed', async ({ page }) => {
  await H.load(page);
  const p = P.splitRising;
  await H.plug(page, p); await H.runSetup(page, p);
  const speedAfter = async x => {
    await page.click('#restart'); await H.focusGame(page);
    await H.setAxis(page, p.thr.d, p.thr.axis, H.pedalRaw(p.thr, x));
    await page.waitForTimeout(1500);
    const v = (await H.car(page)).v;
    await H.setAxis(page, p.thr.d, p.thr.axis, p.thr.rest);
    return v;
  };
  const light = await speedAfter(0.25), floored = await speedAfter(1);
  expect(light).toBeGreaterThan(0.3);
  expect(floored).toBeGreaterThan(light * 2);
});

test('handbrake and blind-spot buttons work while held', async ({ page }) => {
  await H.load(page);
  const p = P.splitRising;
  await H.plug(page, p); await H.runSetup(page, p);
  await H.setButton(page, 0, p.buttons.hand.b, true);
  await expect.poll(async () => (await H.car(page)).hand).toBe(true);
  await H.setButton(page, 0, p.buttons.hand.b, false);
  await expect.poll(async () => (await H.car(page)).hand).toBe(false);

  const t0 = await H.state(page, () => window.__tp.S.lastCheck.L || 0);
  await H.setButton(page, 0, p.buttons.lookL.b, true);
  await page.waitForTimeout(600);
  const t1 = await H.state(page, () => window.__tp.S.lastCheck.L);
  await H.setButton(page, 0, p.buttons.lookL.b, false);
  expect(t1).toBeGreaterThan(t0);
});

// ---------- Manual gearbox with a real clutch pedal ----------
test('manual: clutch pedal controls the biting point, shifting needs the clutch', async ({ page }) => {
  await H.load(page, { manual: true });
  const p = P.splitRising;
  await H.plug(page, p); await H.runSetup(page, p);
  expect((await H.car(page)).gear).toBe('N');

  // Shifting without the clutch grinds and stays in neutral
  await H.press(page, p.buttons.up);
  expect((await H.car(page)).gear).toBe('N');

  // Clutch down: engine pedal reads pressed, shift into 1st works
  await H.setAxis(page, p.clu.d, p.clu.axis, p.clu.full);
  await expect.poll(() => H.state(page, () => window.__tp.S.eng.pedal)).toBeLessThan(0.05);
  await H.press(page, p.buttons.up);
  await expect.poll(async () => (await H.car(page)).gear).toBe('1');

  // Half clutch follows the foot exactly
  await H.setAxis(page, p.clu.d, p.clu.axis, H.pedalRaw(p.clu, 0.5));
  await expect.poll(() => H.state(page, () => window.__tp.S.eng.pedal)).toBeCloseTo(0.5, 1);

  // Dump the clutch with no gas: the engine stalls, like a real car
  await H.setAxis(page, p.clu.d, p.clu.axis, p.clu.rest);
  await expect.poll(() => H.state(page, () => window.__tp.S.eng.on), { timeout: 4000 }).toBe(false);
});

// ---------- The setup catches wrong moves ----------
test('setup gives clear hints for wrong inputs', async ({ page }) => {
  await H.load(page);
  const p = P.combined;
  await H.plug(page, p);
  await page.click('#whBtn');
  await H.expectStep(page, 'Turn the wheel fully left');
  await H.sweep(page, 0, 0, 0, -1, 0);
  await H.expectStep(page, 'Turn the wheel fully right');

  await H.setAxis(page, 0, 0, -1);   // left again
  await expect(page.locator('#whS')).toHaveText("That's left. Turn the wheel right.");
  await H.setAxis(page, 0, 0, 0); await page.waitForTimeout(200);
  await H.sweep(page, 0, 0, 0, 1, 0);
  await H.expectStep(page, 'Press the accelerator');

  await H.setAxis(page, 0, 0, 0.9);   // steering instead of a pedal
  await expect(page.locator('#whS')).toHaveText("That's the steering. Press the pedal.");
  await H.setAxis(page, 0, 0, 0); await page.waitForTimeout(200);
  await H.sweep(page, 0, 1, 0, -1, 0);
  await H.expectStep(page, 'Press the brake');

  await H.setAxis(page, 0, 1, -1);   // accelerator again
  await expect(page.locator('#whS')).toHaveText("That's the accelerator. Press the brake.");
  await H.setAxis(page, 0, 1, 0); await page.waitForTimeout(200);
  await H.sweep(page, 0, 1, 0, 1, 0);   // same axis, other way = brake on a combined pedal
  await H.expectStep(page, 'Press the clutch');
  await H.skip(page);

  await H.press(page, { d: 0, b: 4 });
  await H.expectStep(page, 'Gear down / Reverse');
  await H.press(page, { d: 0, b: 4 });   // same button twice
  await expect(page.locator('#whS')).toContainText('already "Gear up / Drive"');
});

// ---------- No hardware, unplugging, keyboard fallback, saving ----------
test('no controller yet: tells the player to press a button, then finds it', async ({ page }) => {
  await H.load(page);
  await page.click('#whBtn');
  await expect(page.locator('#whS')).toContainText('No wheel found yet');
  await H.plug(page, P.splitRising);
  await expect(page.locator('#whS')).toContainText('Found: Logitech G29 Driving Force Racing Wheel');
  await H.expectStep(page, 'Turn the wheel fully left');
});

test('unplugging mid-drive falls back to the keyboard without errors', async ({ page }) => {
  const errors = await H.load(page);
  const p = P.splitRising;
  await H.plug(page, p); await H.runSetup(page, p);
  await H.setAxis(page, 0, 0, 0.5);
  await expect.poll(async () => (await H.car(page)).steer).toBeGreaterThan(0.2);
  await page.evaluate(() => window.__fake.unplug(0));
  await page.keyboard.down('a');
  await expect.poll(async () => (await H.car(page)).steer).toBeLessThan(-0.2);
  await page.keyboard.up('a');
  expect(errors).toEqual([]);
});

test('keyboard still works with a wheel connected', async ({ page }) => {
  await H.load(page);
  const p = P.splitRising;
  await H.plug(page, p); await H.runSetup(page, p);
  await page.keyboard.down('w');
  await expect.poll(async () => (await H.car(page)).v, { timeout: 5000 }).toBeGreaterThan(1);
  await page.keyboard.up('w');
});

test('setup is remembered after reload, and can be removed', async ({ page }) => {
  await H.load(page);
  const p = P.pedalBox;
  await H.plug(page, p); await H.runSetup(page, p);

  await page.reload(); await H.focusGame(page);
  await H.plug(page, p);
  await H.setAxis(page, 0, 0, 0.8);   // this wheel's full right is 0.8
  await expect.poll(async () => (await H.car(page)).steer).toBeCloseTo(MAXS, 2);

  await page.click('#whBtn');
  await expect(page.locator('#whT')).toHaveText('Wheel settings');
  await page.click('#wsRemove');
  expect(await page.evaluate(() => localStorage.getItem('tp-wheel-v1'))).toBeNull();
});

test('game waits while the setup popup is open', async ({ page }) => {
  await H.load(page);
  await H.plug(page, P.splitRising);
  await page.click('#whBtn');
  const before = await H.car(page);
  await page.keyboard.down('w');   // the popup swallows keys, and the game is paused
  await H.setAxis(page, 0, 2, 1);  // even a floored pedal does nothing while setting up
  await page.waitForTimeout(800);
  const after = await H.car(page);
  expect(after.x).toBe(before.x);
  expect(after.v).toBe(before.v);
  await page.keyboard.up('w');
});


// ---------- Wheel settings: centre, dead zone, rotation ----------
// Default rotation 900°, so one degree of wheel = 1/450 of the raw axis on each side.
const DEG = d => d / 450;
async function settingsUp(page) {
  const errors = await H.load(page);
  const p = P.splitRising;
  await H.plug(page, p); await H.runSetup(page, p);
  return { errors, p };
}
const steerNow = async page => (await H.car(page)).steer;
async function openSettings(page) {
  await page.click('#whBtn');
  await expect(page.locator('#whT')).toHaveText('Wheel settings');
}
async function closeSettings(page) {
  await page.locator('#whRow .btn', { hasText: 'Done' }).click();
  await expect(page.locator('#wh')).toBeHidden();
  await H.focusGame(page);
}
async function setRange(page, sel, v) {
  await page.locator(sel).evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(v));
}

test('settings: the drawn wheel turns with the real wheel and the car follows', async ({ page }) => {
  const { errors } = await settingsUp(page);
  await openSettings(page);
  await H.setAxis(page, 0, 0, DEG(90));   // 90° right
  await expect(page.locator('#wsWheel')).toHaveAttribute('transform', 'rotate(90.0 120 120)');
  await expect(page.locator('#wsWheelTxt')).toHaveText('90° right of centre');
  await expect(page.locator('#wsCarTxt')).toHaveText(/% right$/);
  await H.setAxis(page, 0, 0, DEG(-2));   // inside the default ±3° zone
  await expect(page.locator('#wsCarTxt')).toHaveText('Straight');
  await expect(page.locator('#wsPill')).toContainText('Within ±3° of centre');
  expect(errors).toEqual([]);
});

test('settings: dead centre zone keeps the car straight, then turns smoothly past it', async ({ page }) => {
  await settingsUp(page);
  await openSettings(page);
  await setRange(page, '#wsDz', 10);
  await expect(page.locator('#wsDzV')).toHaveText('± 10°');
  await closeSettings(page);

  await H.setAxis(page, 0, 0, DEG(9));    // 9° right: inside ±10°
  await page.waitForTimeout(300);
  expect(await steerNow(page)).toBe(0);
  await H.setAxis(page, 0, 0, DEG(-9.5));
  await page.waitForTimeout(300);
  expect(await steerNow(page)).toBe(0);
  await H.setAxis(page, 0, 0, DEG(12));   // just past: small turn, no jump
  await expect.poll(() => steerNow(page)).toBeGreaterThan(0);
  expect(await steerNow(page)).toBeLessThan(0.01 * MAXS * 2);
  await H.setAxis(page, 0, 0, 1);         // end stop still reaches full lock
  await expect.poll(() => steerNow(page)).toBeCloseTo(MAXS, 3);
});

test('settings: "Set centre here" makes the current wheel position straight ahead', async ({ page }) => {
  await settingsUp(page);
  await openSettings(page);
  await H.setAxis(page, 0, 0, DEG(20));   // wheel sits 20° right when "straight"
  await expect(page.locator('#wsWheelTxt')).toHaveText('20° right of centre');
  await page.click('#wsCentre');
  await expect(page.locator('#wsWheelTxt')).toHaveText('On centre');
  await expect(page.locator('#wsCentreTxt')).toHaveText("Centre moved 20° right of your wheel's own middle.");
  // the blue centre mark moved to 20° on the ring (top of the ring is 0°)
  const x1 = Number(await page.locator('#wsCl').getAttribute('x1'));
  expect(x1).toBeGreaterThan(120 + 90 * Math.sin(19 * Math.PI / 180));
  await closeSettings(page);

  await page.waitForTimeout(200);
  expect(await steerNow(page)).toBe(0);                    // 20° right now drives straight
  await H.setAxis(page, 0, 0, 0);                          // wheel's own middle is now 20° LEFT of centre
  await expect.poll(() => steerNow(page)).toBeLessThan(0);
  await H.setAxis(page, 0, 0, 1);                          // both end stops still give full lock
  await expect.poll(() => steerNow(page)).toBeCloseTo(MAXS, 3);
  await H.setAxis(page, 0, 0, -1);
  await expect.poll(() => steerNow(page)).toBeCloseTo(-MAXS, 3);

  await openSettings(page);
  await page.locator('#whRow .btn', { hasText: 'Reset' }).click();
  await expect(page.locator('#wsCentreTxt')).toContainText("Centre is your wheel's own middle");
});

test('settings: wheel rotation changes how many degrees a turn is', async ({ page }) => {
  await settingsUp(page);
  await openSettings(page);
  await page.selectOption('#wsRot', '270');
  await H.setAxis(page, 0, 0, 0.5);       // half way to the stop on a 270° wheel = 67.5°
  await expect(page.locator('#wsWheelTxt')).toHaveText('67.5° right of centre');
  await closeSettings(page);
  // (67.5 - 3) / (135 - 3) of full lock
  await expect.poll(() => steerNow(page)).toBeCloseTo((64.5 / 132) * MAXS, 3);
});

test('settings are saved and come back after a reload', async ({ page }) => {
  const { p } = await settingsUp(page);
  await openSettings(page);
  await setRange(page, '#wsDz', 6.5);
  await page.selectOption('#wsRot', '1080');
  await H.setAxis(page, 0, 0, 10 / 540);   // 10° right on a 1080° wheel
  await page.click('#wsCentre');
  await closeSettings(page);

  await page.reload(); await H.focusGame(page);
  await H.plug(page, p);
  await openSettings(page);
  await expect(page.locator('#wsDzV')).toHaveText('± 6.5°');
  await expect(page.locator('#wsRot')).toHaveValue('1080');
  await expect(page.locator('#wsCentreTxt')).toHaveText("Centre moved 10° right of your wheel's own middle.");
});

test('settings with the wheel unplugged: says so, and the centre button waits', async ({ page }) => {
  await settingsUp(page);
  await page.evaluate(() => window.__fake.unplug(0));
  await openSettings(page);
  await expect(page.locator('#whS')).toContainText('Wheel not connected');
  await expect(page.locator('#wsCentre')).toBeDisabled();
  await expect(page.locator('#wsWheelTxt')).toHaveText('—');
});
