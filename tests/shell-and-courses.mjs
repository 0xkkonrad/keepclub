/* The Munin shell, driven like a person: fresh profile → shelf → a course →
 * a study session → resume on the next cold open.
 * usage: serve the sandbox on :8765, then  node shell-and-courses.mjs
 */
import { chromium } from 'playwright-core';

const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell';
const URL = process.env.MUNIN_URL || 'http://127.0.0.1:8765/projects/munin/web/';

const out = [], fails = [];
const ok = (c, m) => (c ? out : fails).push((c ? 'PASS  ' : 'FAIL  ') + m);

const b = await chromium.launch({ executablePath: EXE });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();

/* ── first run: the shelf ── */
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForSelector('.shelf.on');
ok(true, 'fresh profile lands on the shelf');
ok((await p.locator('.shelf-tile').count()) === 3, 'two courses + your-own-deck tile');
const teal = await p.evaluate(() =>
  getComputedStyle(document.querySelector('.shelf-mark .dood')).color);
ok(teal === 'rgb(14, 63, 57)', `shelf raven wears ink teal (${teal})`);

/* ── pick Day Skipper ── */
await Promise.all([p.waitForEvent('load'), p.click('[data-course="day-skipper"]')]);
await p.waitForSelector('#study-all');
ok((await p.textContent('#course-title')).trim().toLowerCase() === 'day skipper', 'Day Skipper title');
const indigo = await p.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
ok(indigo === '#3a30d8', `Day Skipper accent is indigo (${indigo})`);

/* ── the courses pill overlays the shelf; switch to Competent Crew ── */
await p.click('.shelf-btn');
await p.waitForSelector('.shelf.on');
await Promise.all([p.waitForEvent('load'), p.click('[data-course="competent-crew"]')]);
await p.waitForSelector('#study-all');
ok((await p.textContent('#course-title')).trim().toLowerCase() === 'competent crew', 'Competent Crew title');
const slate = await p.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
ok(slate === '#33608d', `Competent Crew accent is harbor slate (${slate})`);
ok((await p.textContent('body')).toLowerCase().includes('when is your exam'),
  'no inherited exam date: Competent Crew asks instead');
ok((await p.textContent('body')).includes('200 cards'),
  'cram copy sized to this deck, not 537');

/* ── a real session: two cards answered ── */
// #study-all is static markup: wait for boot to finish (overlay hides last).
await p.waitForFunction(() => document.getElementById('boot').hidden);
ok(await p.locator('.shelf-btn').isVisible(), 'courses pill on the home screen');
await p.click('#study-all');
await p.waitForSelector('#reveal-btn:visible');
ok(!(await p.locator('.shelf-btn').isVisible()), 'courses pill leaves during a session');
for (let i = 0; i < 2; i++) {
  await p.waitForSelector('#reveal-btn:visible');
  await p.click('#reveal-btn');
  await p.waitForSelector('.grade[data-g="3"]:visible');
  await p.click('.grade[data-g="3"]');
}
// State writes are debounced; writeNow() is the app's own flush.
await p.evaluate(() => writeNow());
const st = await p.evaluate(() => ({
  state: localStorage.getItem('munin/competent-crew/state/v1'),
  last: localStorage.getItem('munin/last-course'),
  dsState: localStorage.getItem('rya-ds/v1'),
}));
ok(!!st.state && Object.keys(JSON.parse(st.state).recs || {}).length >= 2, 'two answers persisted per-course');
ok(st.last === 'competent-crew', 'resume target follows the entered course');
ok(st.dsState === null, "the live Day Skipper app's storage key is never touched");

/* ── cold open resumes the last course ── */
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForSelector('#study-all');
ok((await p.textContent('#course-title')).trim().toLowerCase() === 'competent crew',
  'cold open resumes the last course, no shelf tap');

/* ── the theme is Munin's, and it is light until you say otherwise ── */
{
  // A device that prefers dark: the default still wins, because it is a choice.
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const p2 = await c2.newPage();
  await p2.goto(URL, { waitUntil: 'networkidle' });
  await p2.waitForSelector('.shelf.on');
  const fresh = await p2.evaluate(() => document.documentElement.dataset.theme);
  ok(fresh === 'light', `fresh install is light even on a dark device (${fresh})`);
  ok(await p2.locator('#shelf-theme').isVisible(), 'the picker carries the theme button');

  await p2.click('#shelf-theme');
  const picked = await p2.evaluate(() => localStorage.getItem('munin/theme'));
  ok(picked === 'dark', `the picker's button changes the theme (${picked})`);

  await Promise.all([p2.waitForEvent('load'), p2.click('[data-course="day-skipper"]')]);
  await p2.waitForFunction(() => document.getElementById('boot').hidden);
  const inCourse = await p2.evaluate(() => ({
    attr: document.documentElement.dataset.theme,
    glyph: document.getElementById('theme-glyph').textContent,
  }));
  ok(inCourse.attr === 'dark', 'a course inherits the theme chosen on the picker');
  ok(inCourse.glyph === '\u263E', 'the course header agrees with the picker');
  await c2.close();
}

/* ── the install offer: shown where it can be acted on, nowhere else ── */
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'
  + ' (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const offer = (pg) => pg.evaluate(() => {
  const c = document.getElementById('shelf-install');
  return {
    shown: !c.hidden,
    steps: [...c.querySelectorAll('.shelf-install-steps li')].length,
    btn: !c.querySelector('#shelf-install-btn').hidden,
  };
});
{
  // A browser that can neither prompt nor be told how says nothing at all.
  const c3 = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p3 = await c3.newPage();
  await p3.goto(URL, { waitUntil: 'networkidle' });
  await p3.waitForSelector('.shelf.on');
  ok(!(await offer(p3)).shown, 'no install offer where installing is impossible');

  // Chrome's event is fired once, early — synthesised here, since headless
  // never decides it is installable. The picker must catch it: on first run
  // there is no course, so app.js does not exist yet.
  await p3.evaluate(() => {
    const e = new Event('beforeinstallprompt');
    e.prompt = () => { globalThis.__prompted = true; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    dispatchEvent(e);
  });
  const chrome = await offer(p3);
  ok(chrome.shown && chrome.btn && chrome.steps === 0,
    'a promptable browser gets one button on the picker');
  await p3.click('#shelf-install-btn');
  await p3.waitForFunction(() => globalThis.__prompted === true, { timeout: 3000 });
  ok(true, "the picker's button reaches the browser's own install prompt");
  await c3.close();

  // iOS has no install API, so the offer is instructions instead.
  const c4 = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE });
  const p4 = await c4.newPage();
  await p4.goto(URL, { waitUntil: 'networkidle' });
  await p4.waitForSelector('.shelf.on');
  const ios = await offer(p4);
  ok(ios.shown && ios.steps === 2 && !ios.btn, 'iPhone gets the two steps and no button');
  await c4.close();
}

/* ── robustness: junk in the URL or in storage never strands anyone ── */
{
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await c2.newPage();
  await p2.goto(URL + '?course=not-a-course', { waitUntil: 'networkidle' });
  await p2.waitForSelector('.shelf.on');
  ok(true, 'bogus ?course= is ignored, shelf shown');
  await p2.evaluate(() => localStorage.setItem('munin/last-course', 'deleted-course'));
  await p2.goto(URL, { waitUntil: 'networkidle' });
  await p2.waitForSelector('.shelf.on');
  ok(true, 'a resume pointer at a removed course falls back to the shelf');
  await c2.close();
}

await b.close();
console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
