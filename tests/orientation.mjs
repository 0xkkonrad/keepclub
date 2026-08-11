/* Device-local screen orientation, driven through Settings with a validated
 * fake ScreenOrientation API. The real API is available only to installed or
 * fullscreen apps, so browser automation has to provide both halves of that
 * platform contract before the control can be exercised honestly. */
import { chromium } from 'playwright-core';

const EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || chromium.executablePath();
const URL = process.env.MUNIN_URL || 'http://127.0.0.1:8777/projects/keepclub/web/';
const LOCK_KEY = 'munin/orientation-lock/v1';
const out = [], fails = [];
const ok = (condition, message) =>
  (condition ? out : fails).push((condition ? 'PASS  ' : 'FAIL  ') + message);

const browser = await chromium.launch({ executablePath: EXE });

/* Runs at document_start on every navigation in the context. Besides recording
 * calls, lock() validates the four exact values admitted by ScreenOrientation:
 * a test double that accepted any string would miss a lossy `landscape` lock. */
const fakeScreenOrientation = ({
  installed = true,
  supported = true,
  type = 'landscape-secondary',
  reject = false,
  savedTarget = null,
}) => {
  const nativeMatchMedia = globalThis.matchMedia.bind(globalThis);
  globalThis.matchMedia = (query) => {
    if (!/^\(display-mode:\s*(standalone|minimal-ui|fullscreen)\)$/.test(query)) {
      return nativeMatchMedia(query);
    }
    const events = new EventTarget();
    return {
      matches: installed && query.includes('standalone'),
      media: query,
      onchange: null,
      addListener(listener) { events.addEventListener('change', listener); },
      removeListener(listener) { events.removeEventListener('change', listener); },
      addEventListener(...args) { events.addEventListener(...args); },
      removeEventListener(...args) { events.removeEventListener(...args); },
      dispatchEvent(event) { return events.dispatchEvent(event); },
    };
  };
  Object.defineProperty(navigator, 'standalone', {
    configurable: true,
    value: installed,
  });

  // Tests which open an existing device preference need it in place before
  // munin.js reconciles at boot. addInitScript also runs on the opaque initial
  // about:blank, where storage is unavailable, hence the narrow guard.
  try {
    if (savedTarget) localStorage.setItem('munin/orientation-lock/v1', savedTarget);
  } catch (error) { /* the real navigation runs this script again */ }

  const getItem = Storage.prototype.getItem;
  Storage.prototype.getItem = function getOrientationItem(key) {
    if (key === 'munin/orientation-lock/v1' && globalThis.__orientationRejectGet) {
      throw new DOMException('Storage read refused', 'SecurityError');
    }
    return getItem.call(this, key);
  };
  const removeItem = Storage.prototype.removeItem;
  Storage.prototype.removeItem = function removeOrientationItem(key) {
    if (key === 'munin/orientation-lock/v1' && globalThis.__orientationRejectRemove) {
      throw new DOMException('Storage removal refused', 'QuotaExceededError');
    }
    return removeItem.call(this, key);
  };

  const calls = [];
  const valid = new Set([
    'portrait-primary', 'portrait-secondary',
    'landscape-primary', 'landscape-secondary',
  ]);
  const events = new EventTarget();
  let current = type;
  let active = null;
  let onchange = null;
  const orientation = supported ? {
    get type() { return current; },
    get angle() {
      return current === 'portrait-primary' ? 0
        : current === 'landscape-primary' ? 90
          : current === 'portrait-secondary' ? 180 : 270;
    },
    get onchange() { return onchange; },
    set onchange(listener) { onchange = listener; },
    addEventListener(...args) { events.addEventListener(...args); },
    removeEventListener(...args) { events.removeEventListener(...args); },
    dispatchEvent(event) { return events.dispatchEvent(event); },
    async lock(value) {
      calls.push({ op: 'lock', value });
      if (!valid.has(value)) throw new TypeError(`invalid orientation: ${value}`);
      if (globalThis.__orientationReject) {
        throw new DOMException('The platform refused the lock', 'NotAllowedError');
      }
      current = value;
      active = value;
    },
    unlock() {
      calls.push({ op: 'unlock', value: active });
      if (document.hidden) {
        throw new DOMException('A hidden document cannot unlock', 'InvalidStateError');
      }
      active = null;
    },
  } : undefined;

  Object.defineProperty(screen, 'orientation', {
    configurable: true,
    value: orientation,
  });
  globalThis.__orientationCalls = calls;
  globalThis.__orientationReject = reject;
  globalThis.__orientationRejectGet = false;
  globalThis.__orientationRejectRemove = false;
  globalThis.__orientationActive = () => active;
  globalThis.__orientationStored = () =>
    getItem.call(localStorage, 'munin/orientation-lock/v1');
  globalThis.__orientationHidden = false;
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get() { return globalThis.__orientationHidden; },
  });
};

async function coursePage(options = {}, id = 'day-skipper') {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    serviceWorkers: 'block',
  });
  await context.addInitScript(fakeScreenOrientation, options);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL + '?course=' + id, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  return { context, page, errors };
}

async function openDeviceSettings(page) {
  await page.click('.setup-btn:visible');
  await page.click('#setup-device');
  await page.waitForSelector('#orientation-row:visible');
}

const snapshot = (page) => page.evaluate(() => {
  writeNow();
  const stored = JSON.parse(localStorage.getItem(KEY) || 'null');
  const payload = syncPayload();
  return {
    settings: JSON.stringify(state.settings),
    at: state.settings.at,
    storedSettings: JSON.stringify(stored && stored.settings),
    payload: JSON.stringify(payload),
    stateDeviceKeys: Object.keys(state).filter((key) => /orient|rotat/i.test(key)),
    settingsDeviceKeys: Object.keys(state.settings).filter((key) => /orient|rotat/i.test(key)),
    payloadDeviceKeys: Object.keys(payload).filter((key) => /orient|rotat/i.test(key)),
  };
});

/* Happy path: fresh means browser-controlled rotation; disabling records the
 * exact current direction only after the API accepts it, and never edits the
 * per-course/synced review document. */
{
  const { context, page, errors } = await coursePage();
  await openDeviceSettings(page);
  const before = await snapshot(page);
  const fresh = await page.evaluate((key) => ({
    checked: document.getElementById('set-auto-rotate').checked,
    disabled: document.getElementById('set-auto-rotate').disabled,
    saved: localStorage.getItem(key),
    calls: globalThis.__orientationCalls,
    apiKey: MuninOrientation.key,
  }), LOCK_KEY);
  ok(fresh.checked && !fresh.disabled && fresh.saved === null
      && fresh.calls.length === 0,
  'a fresh installed app defaults to enabled auto-rotation without calling the platform');
  ok(fresh.apiKey === LOCK_KEY,
    `the preference owns one global versioned key (${fresh.apiKey})`);

  await page.uncheck('#set-auto-rotate');
  await page.waitForFunction((key) =>
    localStorage.getItem(key) === 'landscape-secondary', LOCK_KEY);
  const disabled = await page.evaluate((key) => ({
    checked: document.getElementById('set-auto-rotate').checked,
    saved: localStorage.getItem(key),
    calls: globalThis.__orientationCalls,
    hint: document.getElementById('orientation-hint').textContent.trim(),
  }), LOCK_KEY);
  ok(!disabled.checked
      && disabled.saved === 'landscape-secondary'
      && disabled.calls.some((call) =>
        call.op === 'lock' && call.value === 'landscape-secondary'),
  `turning auto-rotation off locks and stores the exact current orientation (${
    disabled.saved})`);
  ok(/locked in landscape/i.test(disabled.hint),
    `the successful state is said beside the control (${disabled.hint})`);

  const after = await snapshot(page);
  ok(after.settings === before.settings
      && after.at === before.at
      && after.storedSettings === before.storedSettings,
  'the device-only choice leaves state.settings, settings.at, and its stored copy untouched');
  ok(after.payload === before.payload
      && after.stateDeviceKeys.length === 0
      && after.settingsDeviceKeys.length === 0
      && after.payloadDeviceKeys.length === 0,
  'the Sync payload is byte-for-byte unchanged and carries no orientation field');

  /* Every document gets a new ScreenOrientation lock. The device key survives
   * both an ordinary reload and a course change, unlike state.settings. */
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  await page.waitForFunction(() => globalThis.__orientationCalls.some((call) =>
    call.op === 'lock' && call.value === 'landscape-secondary'));
  await openDeviceSettings(page);
  ok(!(await page.isChecked('#set-auto-rotate')),
    'a reload reapplies the saved lock and restores the unchecked control');

  await page.goto(URL + '?course=competent-crew', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  await page.waitForFunction(() => globalThis.__orientationCalls.some((call) =>
    call.op === 'lock' && call.value === 'landscape-secondary'));
  await openDeviceSettings(page);
  const otherBefore = await snapshot(page);
  const acrossCourse = await page.evaluate((key) => ({
    checked: document.getElementById('set-auto-rotate').checked,
    saved: localStorage.getItem(key),
  }), LOCK_KEY);
  ok(!acrossCourse.checked && acrossCourse.saved === 'landscape-secondary',
    'the same lock follows the device into another course');

  await page.check('#set-auto-rotate');
  await page.waitForFunction((key) =>
    localStorage.getItem(key) === null
      && globalThis.__orientationCalls.some((call) => call.op === 'unlock'), LOCK_KEY);
  const enabled = await page.evaluate((key) => ({
    checked: document.getElementById('set-auto-rotate').checked,
    saved: localStorage.getItem(key),
    calls: globalThis.__orientationCalls,
  }), LOCK_KEY);
  ok(enabled.checked && enabled.saved === null
      && enabled.calls.some((call) => call.op === 'unlock'),
  'turning auto-rotation back on unlocks the screen and removes the device key');
  const otherAfter = await snapshot(page);
  ok(otherAfter.settings === otherBefore.settings
      && otherAfter.at === otherBefore.at
      && otherAfter.payload === otherBefore.payload,
  'unlocking is also absent from course settings and the Sync payload');
  ok(errors.length === 0,
    `the successful lock/reapply/unlock path raises no page errors (${errors.join(' | ') || 'none'})`);
  await context.close();
}

/* Durable intent changes before the physical unlock. If removal is refused,
 * the app must not unlock and then leave a saved lock which the next document
 * silently reapplies. */
{
  const { context, page, errors } = await coursePage();
  await openDeviceSettings(page);
  await page.uncheck('#set-auto-rotate');
  await page.waitForFunction((key) =>
    localStorage.getItem(key) === 'landscape-secondary', LOCK_KEY);
  const before = await page.evaluate(() => ({
    active: globalThis.__orientationActive(),
    unlocks: globalThis.__orientationCalls.filter((call) => call.op === 'unlock').length,
  }));
  await page.evaluate(() => { globalThis.__orientationRejectRemove = true; });
  // As with lock rejection, the application deliberately rolls the attempted
  // check back, so click without Playwright asserting the transient state.
  await page.click('#set-auto-rotate');
  await page.waitForFunction(() =>
    MuninOrientation.error === 'storage'
      && !document.getElementById('set-auto-rotate').checked);
  const refused = await page.evaluate((key) => ({
    checked: document.getElementById('set-auto-rotate').checked,
    disabled: document.getElementById('set-auto-rotate').disabled,
    hint: document.getElementById('orientation-hint').textContent.trim(),
    saved: localStorage.getItem(key),
    active: globalThis.__orientationActive(),
    applied: MuninOrientation.applied,
    error: MuninOrientation.error,
    unlocks: globalThis.__orientationCalls.filter((call) => call.op === 'unlock').length,
  }), LOCK_KEY);
  ok(!refused.checked && !refused.disabled
      && refused.saved === 'landscape-secondary'
      && refused.active === 'landscape-secondary'
      && refused.applied === 'landscape-secondary',
  'failed preference removal keeps the saved target, active lock, and unchecked UI aligned');
  ok(refused.error === 'storage'
      && refused.unlocks === before.unlocks
      && /could not remember/i.test(refused.hint),
  `storage refusal is classified without calling unlock (${refused.hint})`);
  ok(errors.length === 0,
    `the storage-removal refusal raises no page error (${errors.join(' | ') || 'none'})`);
  await context.close();
}

/* A storage read failure is not evidence that the saved preference disappeared.
 * Preserve the physical lock until durable intent becomes readable again. */
{
  const { context, page, errors } = await coursePage();
  await openDeviceSettings(page);
  await page.uncheck('#set-auto-rotate');
  await page.waitForFunction((key) =>
    localStorage.getItem(key) === 'landscape-secondary', LOCK_KEY);
  const before = await page.evaluate(() => ({
    active: globalThis.__orientationActive(),
    applied: MuninOrientation.applied,
    locks: globalThis.__orientationCalls.filter((call) => call.op === 'lock').length,
    unlocks: globalThis.__orientationCalls.filter((call) => call.op === 'unlock').length,
  }));

  const unreadable = await page.evaluate(async () => {
    globalThis.__orientationRejectGet = true;
    const reconciled = await MuninOrientation.reconcile();
    return {
      reconciled,
      checked: document.getElementById('set-auto-rotate').checked,
      disabled: document.getElementById('set-auto-rotate').disabled,
      hint: document.getElementById('orientation-hint').textContent.trim(),
      persisted: globalThis.__orientationStored(),
      active: globalThis.__orientationActive(),
      applied: MuninOrientation.applied,
      error: MuninOrientation.error,
      locks: globalThis.__orientationCalls.filter((call) => call.op === 'lock').length,
      unlocks: globalThis.__orientationCalls.filter((call) => call.op === 'unlock').length,
    };
  });
  ok(unreadable.reconciled === false
      && !unreadable.checked && unreadable.disabled
      && unreadable.persisted === 'landscape-secondary'
      && unreadable.active === before.active
      && unreadable.applied === before.applied,
  'an unreadable saved target leaves the active/applied lock and unchecked disabled UI intact');
  ok(unreadable.error === 'storage'
      && unreadable.locks === before.locks
      && unreadable.unlocks === before.unlocks
      && /could not remember/i.test(unreadable.hint),
  `read failure is shown as storage trouble without a lock or unlock call (${unreadable.hint})`);

  const restored = await page.evaluate(async () => {
    globalThis.__orientationRejectGet = false;
    const reconciled = await MuninOrientation.reconcile();
    return {
      reconciled,
      checked: document.getElementById('set-auto-rotate').checked,
      disabled: document.getElementById('set-auto-rotate').disabled,
      saved: globalThis.__orientationStored(),
      active: globalThis.__orientationActive(),
      applied: MuninOrientation.applied,
      error: MuninOrientation.error,
      locks: globalThis.__orientationCalls.filter((call) => call.op === 'lock').length,
      unlocks: globalThis.__orientationCalls.filter((call) => call.op === 'unlock').length,
      lastLock: globalThis.__orientationCalls.filter((call) => call.op === 'lock').at(-1),
    };
  });
  ok(restored.reconciled
      && !restored.checked && !restored.disabled
      && restored.saved === 'landscape-secondary'
      && restored.active === 'landscape-secondary'
      && restored.applied === 'landscape-secondary'
      && restored.error === null,
  'once reads recover, reconciliation returns to the persisted lock and usable unchecked control');
  ok(restored.locks === before.locks + 1
      && restored.unlocks === before.unlocks
      && restored.lastLock?.value === 'landscape-secondary',
  'read recovery reapplies the exact saved target without ever unlocking');
  ok(errors.length === 0,
    `the unreadable/read-recovery path raises no page error (${errors.join(' | ') || 'none'})`);
  await context.close();
}

/* A platform rejection is expected on some otherwise-capable devices. It must
 * roll the optimistic checkbox back, store nothing, explain itself, and stay
 * out of the uncaught-error channel. */
{
  const { context, page, errors } = await coursePage({ reject: true });
  await openDeviceSettings(page);
  const before = await snapshot(page);
  // click(), rather than uncheck(): Playwright's uncheck() insists the final
  // state is false, while the behavior under test deliberately restores true
  // before that assertion runs.
  await page.click('#set-auto-rotate');
  await page.waitForFunction(() =>
    globalThis.__orientationCalls.some((call) => call.op === 'lock')
      && document.getElementById('set-auto-rotate').checked);
  const rejected = await page.evaluate((key) => ({
    checked: document.getElementById('set-auto-rotate').checked,
    disabled: document.getElementById('set-auto-rotate').disabled,
    saved: localStorage.getItem(key),
    hint: document.getElementById('orientation-hint').textContent.trim(),
  }), LOCK_KEY);
  const after = await snapshot(page);
  ok(rejected.checked && !rejected.disabled && rejected.saved === null,
    'a rejected lock rolls back to auto-rotate and persists no false promise');
  ok(/could not change.*may still rotate/i.test(rejected.hint),
    `the rejection is explained beside the usable control (${rejected.hint})`);
  ok(after.settings === before.settings && after.at === before.at
      && after.payload === before.payload,
  'a rejected device request leaves course state and Sync untouched');
  ok(errors.length === 0,
    `a normal ScreenOrientation rejection raises no page error (${errors.join(' | ') || 'none'})`);
  await context.close();
}

/* A lock saved by the installed app must remain clearable from a plain tab or
 * a browser which cannot expose ScreenOrientation anymore. Applying it is not
 * possible there; removing durable intent is. */
{
  const target = 'portrait-secondary';
  const { context, page, errors } = await coursePage({
    installed: false, savedTarget: target, type: target,
  });
  await openDeviceSettings(page);
  const saved = await page.evaluate((key) => ({
    checked: document.getElementById('set-auto-rotate').checked,
    disabled: document.getElementById('set-auto-rotate').disabled,
    hint: document.getElementById('orientation-hint').textContent.trim(),
    value: localStorage.getItem(key),
    calls: globalThis.__orientationCalls,
  }), LOCK_KEY);
  ok(!saved.checked && !saved.disabled && saved.value === target
      && saved.calls.length === 0 && /saved for the installed app.*clear it here/i.test(saved.hint),
  `a plain tab leaves a saved lock clearable without claiming to apply it (${saved.hint})`);
  await page.check('#set-auto-rotate');
  await page.waitForFunction((key) => localStorage.getItem(key) === null, LOCK_KEY);
  const cleared = await page.evaluate(() => ({
    checked: document.getElementById('set-auto-rotate').checked,
    disabled: document.getElementById('set-auto-rotate').disabled,
    calls: globalThis.__orientationCalls,
  }));
  ok(cleared.checked && cleared.disabled && cleared.calls.length === 0,
    'the plain tab removes the preference without making an unavailable platform call');
  ok(errors.length === 0, 'clearing a saved lock in a plain tab raises no page errors');
  await context.close();
}
{
  const target = 'portrait-secondary';
  const { context, page, errors } = await coursePage({
    supported: false, savedTarget: target, type: target,
  });
  await openDeviceSettings(page);
  const saved = await page.evaluate((key) => ({
    checked: document.getElementById('set-auto-rotate').checked,
    disabled: document.getElementById('set-auto-rotate').disabled,
    hint: document.getElementById('orientation-hint').textContent.trim(),
    value: localStorage.getItem(key),
  }), LOCK_KEY);
  ok(!saved.checked && !saved.disabled && saved.value === target
      && /screen lock is saved.*clear it.*browser cannot apply/i.test(saved.hint),
  `an unsupported browser also leaves the saved choice clearable (${saved.hint})`);
  await page.check('#set-auto-rotate');
  await page.waitForFunction((key) => localStorage.getItem(key) === null, LOCK_KEY);
  const cleared = await page.evaluate(() => ({
    checked: document.getElementById('set-auto-rotate').checked,
    disabled: document.getElementById('set-auto-rotate').disabled,
    error: MuninOrientation.error,
  }));
  ok(cleared.checked && cleared.disabled && cleared.error === null,
    'clearing the saved choice succeeds even after ScreenOrientation support disappears');
  ok(errors.length === 0, 'clearing a saved lock without API support raises no page errors');
  await context.close();
}

/* Storage changes arrive in hidden tabs too, but browsers may refuse unlock()
 * there. The tab remembers the physical release and reconciles immediately on
 * its next foreground visibility event. */
{
  const { context, page, errors } = await coursePage();
  await openDeviceSettings(page);
  await page.uncheck('#set-auto-rotate');
  await page.waitForFunction((key) =>
    localStorage.getItem(key) === 'landscape-secondary', LOCK_KEY);
  await page.evaluate(() => {
    globalThis.__orientationHidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
  });

  const peer = await context.newPage();
  await peer.goto(new globalThis.URL('docs/', URL).href, { waitUntil: 'domcontentloaded' });
  await peer.evaluate((key) => localStorage.removeItem(key), LOCK_KEY);
  await page.waitForFunction((key) =>
    localStorage.getItem(key) === null && MuninOrientation.needsRelease, LOCK_KEY);
  const deferred = await page.evaluate(() => ({
    active: globalThis.__orientationActive(),
    applied: MuninOrientation.applied,
    needsRelease: MuninOrientation.needsRelease,
    unlocks: globalThis.__orientationCalls.filter((call) => call.op === 'unlock').length,
  }));
  ok(deferred.active === 'landscape-secondary'
      && deferred.applied === 'landscape-secondary'
      && deferred.needsRelease
      && deferred.unlocks === 0,
  'cross-tab removal in a hidden locked tab defers release without attempting unlock');

  await page.evaluate(() => {
    globalThis.__orientationHidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() =>
    !MuninOrientation.needsRelease
      && MuninOrientation.applied === null
      && globalThis.__orientationActive() === null);
  const foreground = await page.evaluate((key) => ({
    checked: document.getElementById('set-auto-rotate').checked,
    saved: localStorage.getItem(key),
    unlocks: globalThis.__orientationCalls.filter((call) => call.op === 'unlock').length,
  }), LOCK_KEY);
  ok(foreground.checked && foreground.saved === null && foreground.unlocks === 1,
    'foreground reconciliation performs the deferred unlock and clears active state');
  ok(errors.length === 0,
    `hidden-tab reconciliation raises no page error (${errors.join(' | ') || 'none'})`);
  await peer.close();
  await context.close();
}

/* Fullscreen is the standards-level alternative to installation for browsers
 * which gate lock() to an immersive document. */
{
  const { context, page, errors } = await coursePage({ installed: false });
  await openDeviceSettings(page);
  ok(await page.isDisabled('#set-auto-rotate'),
    'an ordinary tab starts outside the orientation-lock context');
  await page.evaluate(() => {
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.documentElement,
    });
    document.dispatchEvent(new Event('fullscreenchange'));
  });
  await page.waitForFunction(() =>
    MuninOrientation.inLockContext()
      && !document.getElementById('set-auto-rotate').disabled);
  await page.uncheck('#set-auto-rotate');
  await page.waitForFunction((key) =>
    localStorage.getItem(key) === 'landscape-secondary', LOCK_KEY);
  const fullscreen = await page.evaluate(() => ({
    active: globalThis.__orientationActive(),
    call: globalThis.__orientationCalls.find((item) => item.op === 'lock'),
  }));
  ok(fullscreen.active === 'landscape-secondary'
      && fullscreen.call?.value === 'landscape-secondary',
  'document.fullscreenElement makes an ordinary tab eligible for exact-direction locking');
  ok(errors.length === 0, 'the fullscreen lock path raises no page errors');
  await context.close();
}

/* Unsupported and browser-tab states still show the requested setting, but do
 * not present an enabled switch which the platform cannot honour. */
{
  const { context, page, errors } = await coursePage({ supported: false });
  await openDeviceSettings(page);
  const state = await page.evaluate((key) => ({
    visible: !!document.getElementById('orientation-row').getClientRects().length,
    checked: document.getElementById('set-auto-rotate').checked,
    disabled: document.getElementById('set-auto-rotate').disabled,
    hint: document.getElementById('orientation-hint').textContent.trim(),
    saved: localStorage.getItem(key),
  }), LOCK_KEY);
  ok(state.visible && state.checked && state.disabled && state.saved === null
      && /device.s rotation lock.*browser cannot control/i.test(state.hint),
  `an unsupported installed browser points to the device lock without pretending it worked (${
    state.hint})`);
  ok(errors.length === 0, 'the unsupported API shape raises no page errors');
  await context.close();
}
{
  const { context, page, errors } = await coursePage({ installed: false });
  await openDeviceSettings(page);
  const state = await page.evaluate((key) => ({
    visible: !!document.getElementById('orientation-row').getClientRects().length,
    checked: document.getElementById('set-auto-rotate').checked,
    disabled: document.getElementById('set-auto-rotate').disabled,
    hint: document.getElementById('orientation-hint').textContent.trim(),
    saved: localStorage.getItem(key),
    calls: globalThis.__orientationCalls,
  }), LOCK_KEY);
  ok(state.visible && state.checked && state.disabled && state.saved === null
      && state.calls.length === 0
      && /installed or open full screen/i.test(state.hint),
  `an ordinary browser tab names the install/full-screen requirement (${
    state.hint})`);
  ok(errors.length === 0, 'the not-installed state raises no page errors');
  await context.close();
}

await browser.close();

console.log(out.concat(fails).join('\n'));
if (fails.length) {
  console.error(`\n${fails.length} failing`);
  process.exit(1);
}
console.log(`\nall ${out.length} green`);
