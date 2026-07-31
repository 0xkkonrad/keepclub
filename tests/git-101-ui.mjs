/* Git 101's own browser smoke: deep link, theme, grouping, figure labels and
 * responsive width. It is separate from the long shell regression so this
 * course's assertions stay small and diagnostic.
 */
import { chromium } from 'playwright-core';

const EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || chromium.executablePath();
const URL = process.env.MUNIN_URL || 'http://127.0.0.1:8777/projects/keepclub/web/';
const out = [];
const fails = [];
const ok = (condition, message) =>
  (condition ? out : fails).push((condition ? 'PASS  ' : 'FAIL  ') + message);

const browser = await chromium.launch({ executablePath: EXE });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto(URL + '?course=git-101', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.getElementById('boot').hidden);
ok((await page.textContent('#course-title')).trim().toLowerCase() === 'git 101',
  'Git 101 deep link opens the course');
const orange = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
ok(orange === '#a63a1b', `Git 101 accent is burnt orange (${orange})`);
ok((await page.textContent('body')).includes('144 cards'),
  'Git 101 reports the compiled 144-card deck');

/* Nobody sits Git 101, so its course.json says `"exam": false` and the whole
 * countdown goes with it — the ask on Home, the row in Settings, and the
 * banner that only a date could raise. */
ok(await page.locator('#ask-exam').isHidden(), 'Git 101 never asks when your exam is');
ok(await page.locator('#exam-banner').isHidden(), 'Git 101 raises no exam banner');
await page.click('.setup-btn:visible');
await page.click('#setup-studying');
ok(await page.locator('#exam-row').isHidden(), 'Git 101 has no exam date row in Settings');
await page.click('#setup-close');
await page.waitForSelector('#setup', { state: 'hidden' });

await page.click('[data-go="browse"]');
await page.waitForSelector('#browse-index:not([hidden])');
ok((await page.locator('#browse-index .bgroup').count()) === 4,
  'Git 101 groups foundations before the agentic track');
await page.click('#browse-index [data-scope="mental-model"]');
await page.locator('#browse-list details').first().click();
await page.waitForSelector('#browse-list details[open] .figure');
const figure = await page.evaluate(() => {
  const svg = document.querySelector('#browse-list details[open] .figure');
  return {
    label: svg?.getAttribute('aria-label') || '',
    lit: [...svg.querySelectorAll('[data-l].on')]
      .map((node) => node.getAttribute('data-l')),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});
ok(figure.label.includes('three local areas')
    && figure.lit.includes('working')
    && figure.lit.includes('staging')
    && figure.lit.includes('repository'),
'Git 101 lights the working tree, staging area, and repository figure');
ok(figure.overflow === 0, 'Git 101 has no mobile horizontal overflow');
ok(errors.length === 0, `Git 101 raises no page errors (${errors.join('; ') || 'none'})`);

/* The control: a course that says nothing about an exam is a course that is
 * sat, and keeps both halves of the feature. */
const sailing = await browser.newContext({ viewport: { width: 390, height: 844 } });
const sailingPage = await sailing.newPage();
await sailingPage.goto(URL + '?course=day-skipper', { waitUntil: 'networkidle' });
await sailingPage.waitForFunction(() => document.getElementById('boot').hidden);
ok(await sailingPage.locator('#ask-exam').isVisible(), 'a sailing course still asks for the exam date');
await sailingPage.click('.setup-btn:visible');
await sailingPage.click('#setup-studying');
ok(await sailingPage.locator('#exam-row').isVisible(),
  'a sailing course keeps the exam date row in Settings');
await sailing.close();

await context.close();
await browser.close();
for (const line of out) console.log(line);
for (const line of fails) console.error(line);
if (fails.length) {
  console.error(`\n${fails.length} failing`);
  process.exit(1);
}
console.log(`\nall ${out.length} green`);
