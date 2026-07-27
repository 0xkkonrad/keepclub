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
await p.click('#study-all');
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

await b.close();
console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
