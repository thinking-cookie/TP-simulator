const path = require('path');
const { expect } = require('@playwright/test');

const FAKE = path.join(__dirname, 'fake-wheel.js');
const ORDER = ['up', 'down', 'sigL', 'sigR', 'lookL', 'lookR', 'hand', 'start', 'horn', 'restart'];
const STEP_TITLE = { up: 'Gear up / Drive', down: 'Gear down / Reverse', sigL: 'Left signal', sigR: 'Right signal',
  lookL: 'Check left blind spot', lookR: 'Check right blind spot', hand: 'Handbrake', start: 'Start engine', horn: 'Horn', restart: 'Restart run' };

// Open the trainer with fake controllers available and every first-visit popup out of the way.
async function load(page, { manual = false } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript({ path: FAKE });
  await page.addInitScript(manual => {
    const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
    set('tp-player', 'E2E'); set('tp-tut-hide', '1'); set('tp-fb-done', '1'); set('tp-traffic', '0');
    set('tp-gearbox', manual ? 'manual' : 'auto');
  }, manual);
  await page.goto('/index.html?e2e=1');
  await focusGame(page);
  return errors;
}

async function focusGame(page) {
  await page.evaluate(() => {
    ['gate', 'tut', 'fb', 'ov'].forEach(id => { const e = document.getElementById(id); if (e) e.hidden = true; });
    document.getElementById('cv').focus();
    window.dispatchEvent(new Event('focus'));
  });
}

const state = (page, fn) => page.evaluate(fn);
const car = page => state(page, () => ({ ...window.__tp.S.car, hand: window.__tp.S.hand, signal: window.__tp.S.signal }));

// Plug in every device of a profile. Axes marked `quirk` start at 0, like a browser that hasn't seen them move.
async function plug(page, profile) {
  for (const d of profile.devices) await page.evaluate(([id, axes]) => window.__fake.plug(id, axes), [d.id, d.axes]);
}
const setAxis = (page, d, axis, v) => page.evaluate(([d, a, v]) => window.__fake.axis(d, a, v), [d, axis, v]);
const setButton = (page, d, b, on) => page.evaluate(([d, b, on]) => window.__fake.button(d, b, on), [d, b, on]);

// Press and release a button. Held for a few frames so even a slow machine sees it.
async function press(page, { d, b }) {
  await setButton(page, d, b, true); await page.waitForTimeout(300);
  await setButton(page, d, b, false); await page.waitForTimeout(150);
}
// Move an axis smoothly to `to`, hold, then back to `back`, like a hand or foot would.
// In the setup popup, it holds until the popup says "Got it", like a player waiting for the cue.
async function sweep(page, d, axis, from, to, back) {
  for (const f of [0.33, 0.66, 1]) { await setAxis(page, d, axis, from + (to - from) * f); await page.waitForTimeout(60); }
  if (await page.locator('#wh').isVisible()) await expect(page.locator('#whS')).toContainText('Got it', { timeout: 4000 });
  else await page.waitForTimeout(150);
  await setAxis(page, d, axis, back);
}
// Pedal position 0..1 to the raw value this profile reports.
const pedalRaw = (p, x) => p.rest + (p.full - p.rest) * x;
// Steering -1..1 to raw value.
const steerRaw = (s, x) => x < 0 ? s.center + (s.left - s.center) * -x : s.center + (s.right - s.center) * x;

const title = page => page.locator('#whT');
const skip = page => page.locator('#whRow .btn').last().click();
async function expectStep(page, text) {
  try { await expect(title(page)).toHaveText(text, { timeout: 8000 }); }
  catch (e) {   // say what the popup was showing, so a failure is easy to read
    const shown = await page.evaluate(() => [document.getElementById('whT').textContent, document.getElementById('whS').textContent, JSON.stringify(navigator.getGamepads().filter(Boolean).map(g => g.axes))]);
    throw new Error(`Expected setup step "${text}" but popup shows "${shown[0]}" / "${shown[1]}". Axes: ${shown[2]}`);
  }
}

// Walk the whole setup popup the way a player would, using the profile's layout.
async function runSetup(page, profile) {
  await page.click('#whBtn');
  await expectStep(page, 'Turn the wheel fully left');   // rest step passes on its own after 1.5 s of stillness
  const s = profile.steer;
  await sweep(page, s.d, s.axis, s.center, s.left, s.center);
  await expectStep(page, 'Turn the wheel fully right');
  await sweep(page, s.d, s.axis, s.center, s.right, s.center);
  await expectStep(page, 'Press the accelerator');
  for (const [k, next] of [['thr', 'Press the brake'], ['brk', 'Press the clutch'], ['clu', 'Gear up / Drive']]) {
    const p = profile[k];
    if (p) {
      const start = p.quirk ? 0 : p.rest;
      await sweep(page, p.d, p.axis, start, p.full, p.rest);
      if (p.quirk) await setAxis(page, p.d, p.axis, p.rest);
    } else await skip(page);
    await expectStep(page, next);
  }
  for (let i = 0; i < ORDER.length; i++) {
    const k = ORDER[i];
    await expectStep(page, STEP_TITLE[k]);
    if (!profile.buttons[k]) { await skip(page); continue; }
    // press; if a busy test machine missed the tap, press again, as a person would
    for (let n = 0; n < 3; n++) {
      await press(page, profile.buttons[k]);
      if (await title(page).textContent() !== STEP_TITLE[k]) break;
      await page.waitForTimeout(400);
    }
  }
  await expectStep(page, 'Check it works');
  await page.locator('#whRow .btn', { hasText: 'Save and drive' }).click();
  await expect(page.locator('#wh')).toBeHidden();
  await focusGame(page);
}

module.exports = { load, focusGame, car, state, plug, setAxis, setButton, press, sweep, pedalRaw, steerRaw, runSetup, expectStep, skip, title };
