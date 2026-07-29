/* The custom mobile refresh gesture, driven with real TouchEvents.
 *
 * usage: serve the sandbox on :8765, then node pull-to-refresh.mjs
 */
import { chromium } from 'playwright-core';

const EXE = process.env.HOME
  + '/.cache/ms-playwright/chromium_headless_shell-1217/'
  + 'chrome-headless-shell-linux64/chrome-headless-shell';
const URL_ = process.env.MUNIN_URL || 'http://127.0.0.1:8777/projects/keepclub/web/';
const out = [], fails = [];
const ok = (condition, message) =>
  (condition ? out : fails).push((condition ? 'PASS  ' : 'FAIL  ') + message);

const browser = await chromium.launch({ executablePath: EXE });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const touch = (type, x, y) => page.evaluate(({ type, x, y }) => {
  const target = document.querySelector('.shelf.on') || document.body;
  const point = new Touch({
    identifier: 7,
    target,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y,
    pageX: x,
    pageY: y,
  });
  const event = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: type === 'touchend' ? [] : [point],
    targetTouches: type === 'touchend' ? [] : [point],
    changedTouches: [point],
  });
  return { accepted: target.dispatchEvent(event), prevented: event.defaultPrevented };
}, { type, x, y });

await page.goto(URL_, { waitUntil: 'networkidle' });
await page.waitForSelector('.shelf.on');
await page.waitForFunction(() => document.getElementById('boot').hidden);
ok(await page.locator('#pull-refresh').count() === 1,
  'the shell mounts one pull-to-refresh status');

/* A scrollable surface owns a downward drag until it reaches its own top. */
const scrolled = await page.evaluate(() => {
  const shelf = document.querySelector('.shelf.on');
  const filler = document.createElement('div');
  filler.id = 'pull-test-filler';
  filler.style.height = '1000px';
  shelf.appendChild(filler);
  shelf.scrollTop = 120;
  return shelf.scrollTop;
});
await touch('touchstart', 100, 20);
await touch('touchmove', 100, 180);
const whileScrolled = await page.evaluate(() => ({
  distance: getComputedStyle(document.documentElement)
    .getPropertyValue('--pull-refresh-distance').trim(),
  shown: document.getElementById('pull-refresh').classList.contains('on'),
}));
await touch('touchend', 100, 180);
ok(scrolled > 0 && !whileScrolled.shown && (!whileScrolled.distance || whileScrolled.distance === '0px'),
  'pulling a scrolled surface does not steal its gesture');
await page.evaluate(() => {
  document.getElementById('pull-test-filler').remove();
  document.querySelector('.shelf.on').scrollTop = 0;
});

/* A short pull gives feedback and settles without navigating. */
await page.evaluate(() => { window.__pullRefreshDocument = Math.random(); });
await touch('touchstart', 100, 20);
const shortMove = await touch('touchmove', 100, 80);
const shortState = await page.evaluate(() => ({
  text: document.querySelector('.pull-refresh-text').textContent,
  shown: document.getElementById('pull-refresh').classList.contains('on'),
}));
await touch('touchend', 100, 80);
await page.waitForTimeout(260);
const shortDone = await page.evaluate(() => ({
  sameDocument: !!window.__pullRefreshDocument,
  shown: document.getElementById('pull-refresh').classList.contains('on'),
}));
ok(shortMove.prevented && shortState.shown && /pull down/.test(shortState.text),
  'a short downward pull shows feedback and owns the overscroll');
ok(shortDone.sameDocument && !shortDone.shown,
  'releasing below the threshold settles without reloading');

/* Crossing the threshold changes the instruction, but a failed state flush
 * must still be able to stop the destructive half of the gesture. */
await page.evaluate(() => {
  window.__pullRefreshOriginalWrite = window.writeNow;
  window.writeNow = () => false;
});
await touch('touchstart', 100, 20);
await touch('touchmove', 100, 170);
const armed = await page.evaluate(() => ({
  text: document.querySelector('.pull-refresh-text').textContent,
  ready: document.getElementById('pull-refresh').classList.contains('ready'),
  distance: parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue('--pull-refresh-distance')),
}));
await touch('touchend', 100, 170);
await page.waitForTimeout(380);
const refused = await page.evaluate(() => ({
  sameDocument: !!window.__pullRefreshDocument,
  text: document.querySelector('.pull-refresh-text').textContent,
}));
ok(armed.ready && armed.distance > 70 && /release/.test(armed.text),
  'a decisive pull arms at the peanut-ui threshold');
ok(refused.sameDocument && /refresh stopped/.test(refused.text),
  'a failed progress flush stops the reload');
await page.evaluate(() => {
  window.writeNow = window.__pullRefreshOriginalWrite;
  delete window.__pullRefreshOriginalWrite;
});
await page.waitForTimeout(1200);

/* With state safe, release paints Refreshing and causes a real reload. */
await touch('touchstart', 100, 20);
await touch('touchmove', 100, 170);
const load = page.waitForEvent('load');
await touch('touchend', 100, 170);
const refreshing = await page.evaluate(() => ({
  text: document.querySelector('.pull-refresh-text').textContent,
  refreshing: document.getElementById('pull-refresh').classList.contains('refreshing'),
}));
await load;
await page.waitForSelector('.shelf.on');
await page.waitForFunction(() => document.getElementById('boot').hidden);
const navigation = await page.evaluate(() =>
  performance.getEntriesByType('navigation')[0]?.type);
ok(refreshing.refreshing && /refreshing/.test(refreshing.text),
  'release paints the refreshing state before navigation');
ok(navigation === 'reload', `the armed gesture reloads the page (${navigation})`);
ok(errors.length === 0, `pull-to-refresh raises no page errors (${errors.join(' | ') || 'none'})`);

await context.close();
await browser.close();

console.log(out.concat(fails).join('\n'));
if (fails.length) {
  console.error(`\n${fails.length} failing`);
  process.exit(1);
}
console.log(`\nall ${out.length} green`);
