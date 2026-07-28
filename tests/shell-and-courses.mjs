/* The Munin shell, driven like a person: fresh profile → shelf → a course →
 * a study session → resume on the next cold open.
 * usage: serve the sandbox on :8765, then  node shell-and-courses.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
// Not `new URL(...)`: URL is shadowed by the app's address, three lines up.
const HERE = dirname(fileURLToPath(import.meta.url));
const REGISTERED = JSON.parse(
  readFileSync(join(HERE, '../web/courses/index.json'), 'utf8')).courses;
const tiles = await p.locator('.shelf-tile').count();
ok(tiles === REGISTERED.length + 1,
  `a tile per registered course, plus your-own-deck (${tiles} for ${REGISTERED.length})`);
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

/* ── the theme is Munin's: light until you say otherwise, then yours ── */
{
  // A device that prefers dark, which Munin does not ask. Every assertion in
  // this block is run on that device on purpose: "the default is light" is only
  // a claim worth testing where something else was on offer.
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const p2 = await c2.newPage();
  await p2.goto(URL, { waitUntil: 'networkidle' });
  await p2.waitForSelector('.shelf.on');
  const fresh = await p2.evaluate(() => ({
    attr: document.documentElement.dataset.theme,
    stored: localStorage.getItem('munin/theme'),
    glyph: document.querySelector('#shelf-theme [data-theme-glyph]').dataset.themeGlyph,
    bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
  }));
  ok(fresh.stored === null, `a fresh install has chosen nothing (${fresh.stored})`);
  ok(fresh.bg === '#f0eee7', `and opens on paper on a dark phone anyway (${fresh.bg})`);
  ok(fresh.attr === 'light', `the attribute says so out loud (${fresh.attr})`);
  ok(fresh.glyph === 'day', `and the button says which one it is showing (${fresh.glyph})`);
  ok(await p2.locator('#shelf-theme').isVisible(), 'the picker carries the theme button');

  // The button shows you the other one, so the first tap on an unchosen install
  // is dark whatever the phone prefers.
  await p2.click('#shelf-theme');
  const picked = await p2.evaluate(() => localStorage.getItem('munin/theme'));
  ok(picked === 'dark', `the first tap chooses the other one (${picked})`);
  await p2.click('#shelf-theme');
  const back = await p2.evaluate(() => localStorage.getItem('munin/theme'));
  ok(back === 'light', `and the next tap comes back (${back})`);
  // Two states and no third: tapping can never land on "follow the device".
  const seen = new Set([picked, back]);
  for (let i = 0; i < 4; i++) {
    await p2.click('#shelf-theme');
    seen.add(await p2.evaluate(() => localStorage.getItem('munin/theme')));
  }
  ok(seen.size === 2 && seen.has('light') && seen.has('dark'),
    `six taps visit two states, not three (${[...seen].join(', ')})`);

  /* Sunset, with the page open. The device used to be consulted and is not any
   * more — in either direction, chosen or not, with no reload. */
  {
    const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
    const p3 = await c3.newPage();
    await p3.goto(URL, { waitUntil: 'networkidle' });
    await p3.waitForSelector('.shelf.on');
    const bg = () => p3.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
    ok(await bg() === '#f0eee7', 'an unchosen install is light');
    await p3.emulateMedia({ colorScheme: 'dark' });
    ok(await bg() === '#f0eee7', 'and stays light when the device goes dark under it');
    const glyph = await p3.evaluate(() =>
      document.querySelector('#shelf-theme [data-theme-glyph]').dataset.themeGlyph);
    ok(glyph === 'day', `the drawing does not move either (${glyph})`);

    await p3.click('#shelf-theme');           // light showing → chooses dark
    await p3.emulateMedia({ colorScheme: 'light' });
    ok(await bg() === '#141519', 'and a chosen dark survives a device that turns light');
    await c3.close();
  }

  await p2.click('#shelf-theme');             // land on dark for the course check
  ok(await p2.evaluate(() => localStorage.getItem('munin/theme')) === 'dark', 'dark chosen');
  await Promise.all([p2.waitForEvent('load'), p2.click('[data-course="day-skipper"]')]);
  await p2.waitForFunction(() => document.getElementById('boot').hidden);
  const inCourse = await p2.evaluate(() => ({
    attr: document.documentElement.dataset.theme,
    glyph: document.getElementById('theme-glyph').dataset.themeGlyph,
    drawn: !!document.querySelector('#theme-glyph .dood-glyph path'),
  }));
  ok(inCourse.attr === 'dark', 'a course inherits the theme chosen on the picker');
  ok(inCourse.glyph === 'night', 'the course header agrees with the picker');
  ok(inCourse.drawn, 'and says so with a drawing, not a character');
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
  const label = (await p3.textContent('#shelf-install-btn')).trim();
  ok(label === 'install', `the offer is framed as installing ("${label}")`);
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

/* ── the picker survives a course that will not load, and reads no theme ── */
{
  const c5 = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p5 = await c5.newPage();
  const themeReads = [];
  await p5.route('**/courses/*/doodles.js', (r) => { themeReads.push(r.request().url()); r.continue(); });
  // One course.json that answers with a server error. Every other course, and
  // the picker itself, must be unaffected — this used to be a bare
  // Promise.all with no catch, so one bad course was a blank page with no way
  // back to anything.
  await p5.route('**/courses/competent-crew/course.json',
    (r) => r.fulfill({ status: 500, contentType: 'text/plain', body: 'nope' }));
  await p5.goto(URL, { waitUntil: 'networkidle' });
  await p5.waitForSelector('.shelf.on');
  ok(await p5.locator('[data-course="day-skipper"]').isVisible(),
    'a course that will not load does not take the picker down');
  ok((await p5.locator('.shelf-tile.broken').count()) === 1, 'and the shelf says which one');
  ok(await p5.locator('[data-byo]').isVisible(), 'your own deck is still reachable');
  // The emblem comes out of course.json now; the shelf used to fetch 43 KB of
  // each course's doodle file and mine one path out of it with a regex.
  ok(themeReads.length === 0, 'the picker draws without reading a single course theme file');
  await c5.close();
}

/* ── the loading screen belongs to the course, and paints before app.js ── */
{
  const c6 = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p6 = await c6.newPage();
  // munin.js runs at the end of <body>, so anything it does is done before
  // DOMContentLoaded — and long before app.js is fetched.
  await p6.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const s = document.getElementById('boot-scene');
      const p = document.getElementById('boot-line');
      // Measured while the screen is still up — app.js has not run, so this is
      // the layout a person actually sees.
      const sr = s && s.getBoundingClientRect(), pr = p && p.getBoundingClientRect();
      globalThis.__early = {
        from: s ? s.dataset.from : '',
        paths: s ? s.querySelectorAll('path').length : 0,
        line: p ? p.textContent : '',
        gap: sr && pr ? Math.round(pr.top - sr.bottom) : -1,
        offCentre: sr && pr
          ? Math.round(Math.abs((sr.top + pr.bottom) / 2 - innerHeight / 2)) : -1,
        at: performance.now(),
      };
      // How long the screen is actually up. It used to be two to four frames
      // on a warm load, which is why it is now held on purpose.
      const boot = document.getElementById('boot');
      if (boot) new MutationObserver((m, o) => {
        if (boot.hidden) { globalThis.__gone = performance.now(); o.disconnect(); }
      }).observe(boot, { attributes: true, attributeFilter: ['hidden'] });
    }, { once: true });
  });

  await p6.goto(URL, { waitUntil: 'networkidle' });
  await p6.waitForSelector('.shelf.on');
  const first = await p6.evaluate(() => globalThis.__early);
  ok(first.from === 'munin' && first.paths === 1,
    `first run paints Munin's own raven (${first.from})`);
  // .boot is a grid of two children with no row template. Rows stretch by
  // default, which put the drawing a quarter down the screen and its caption
  // three quarters down, with the gap rendering nowhere. Both numbers, because
  // either one alone passes while the screen still looks broken.
  ok(first.gap >= 0 && first.gap < 40,
    `the caption sits under the drawing, not adrift (${first.gap}px apart)`);
  ok(first.offCentre >= 0 && first.offCentre < 60,
    `and the two of them are centred as one (${first.offCentre}px off centre)`);

  // Held long enough to be a splash rather than a flicker. A floor, not a
  // duration: the assertion is that the screen was NOT taken away early.
  await p6.waitForFunction(() => globalThis.__gone, null, { timeout: 8000 });
  const up = await p6.evaluate(() => Math.round(globalThis.__gone - globalThis.__early.at));
  ok(up >= 700, `the splash is held long enough to be seen (${up}ms)`);

  // The shelf fetches the scenes of the courses on it. Without this the first
  // tap on a tile opens onto Munin's raven: the course's own drawing is only
  // replayed from a cache that that first open is what fills.
  const cached = await p6.waitForFunction(
    () => localStorage.getItem('munin/boot/day-skipper'), null, { timeout: 8000 })
    .then((h) => h.jsonValue(), () => '');
  ok(!!cached && JSON.parse(cached).html.includes('pathLength'),
    'the shelf fetches the scene of a course you have never opened');

  await Promise.all([p6.waitForEvent('load'), p6.click('[data-course="day-skipper"]')]);
  await p6.waitForFunction(() => document.getElementById('boot').hidden);
  const early = await p6.evaluate(() => globalThis.__early);
  ok(early.from.startsWith('day-skipper-'),
    `so the FIRST open paints the course's own scene before app.js (${early.from})`);
  ok(early.line === 'Loading deck…', `and says what the course says (${early.line})`);

  /* Progress: the words on it are the course's, not the engine's. */
  await p6.click('[data-go="stats"]');
  await p6.waitForSelector('#hoard-title');
  const said = await p6.evaluate(() => ({
    hoard: document.getElementById('hoard-title').textContent,
    first: document.querySelector('#ach-list b')?.textContent || '',
    notice: document.getElementById('notice').textContent,
    link: document.querySelector('#notice a')?.href || '',
    offline: document.getElementById('offline-note').textContent,
    offlineShown: !document.getElementById('offline-card').hidden,
    diagrams: new Set([...DECK.cards].filter((c) => c.m).map((c) => c.m)).size,
  }));
  ok(said.hoard === "Ship's log", `the course names the hoard in its own world (${said.hoard})`);
  ok(said.first === 'cast off', `and names what is in it (${said.first})`);
  ok(said.notice.includes('almanac'), 'the fineprint is this course\'s caveat');
  ok(said.link.includes('tiktok.com'), 'and carries the credit it owes');
  ok(said.offlineShown && said.offline.includes(`${said.diagrams} diagrams`),
    `offline counts this deck's diagrams (${said.diagrams})`);
  await c6.close();
}

/* ── a course's figure vocabulary is the course's ─────────────────────────
 *
 * ~50 rules naming one syllabus's rigging, sails and pontoons used to be in
 * app.css, applied over every deck anybody imported. They are the course's
 * now — which is only true if its stylesheet actually arrives and still wins. */
{
  const cf = await b.newContext({ viewport: { width: 390, height: 844 },
    serviceWorkers: 'block' });
  const pf = await cf.newPage();
  await pf.goto(URL + '?course=day-skipper', { waitUntil: 'networkidle' });
  await pf.waitForFunction(() => document.getElementById('boot').hidden);
  const css = await pf.evaluate(() => [...document.styleSheets]
    .some((s) => (s.href || '').endsWith('figures.css') && s.cssRules.length > 0));
  ok(css, "the course's own figure stylesheet is loaded");

  await pf.click('[data-go="browse"]');
  await pf.fill('#search', 'sail');
  await pf.waitForTimeout(600);
  const drawn = await pf.evaluate(async () => {
    const btn = document.querySelector('#browse-open');
    if (btn && !btn.hidden) btn.click();
    await new Promise((r) => setTimeout(r, 500));
    const el = document.querySelector('.figure .f-sail');
    if (!el) return null;
    return { fill: getComputedStyle(el).fill, cls: el.getAttribute('class') };
  });
  ok(drawn && drawn.fill === 'rgb(230, 227, 218)',
    `its own class still fills its own shape (${drawn && drawn.fill})`);
  // The pen exemption comes from course.json's figures.noPen now, not from a
  // list of one course's nouns in the engine.
  ok(drawn && /\bsoft\b/.test(drawn.cls),
    `and the course's noPen list decides the pen (${drawn && drawn.cls})`);
  await cf.close();
}

/* ── nothing is deleted from a list we could not read ──────────────────────
 *
 * Every one of these was a real defect, and every one of them destroyed
 * something the person had: an unanswerable question was being taken as the
 * answer "none of them exist". */
{
  const c7 = await b.newContext({ viewport: { width: 390, height: 844 },
    serviceWorkers: 'block' });   // the page's own behaviour, not the worker's
  const p7 = await c7.newPage();
  await p7.goto(URL, { waitUntil: 'networkidle' });
  await p7.waitForSelector('.shelf.on');

  // (a) A database that will not open must not be read as "you have no decks".
  await p7.evaluate(() => {
    localStorage.setItem('munin/local-abc123/state/v1', '{"answers":41}');
    localStorage.setItem('munin/local-def456/state/v1', '{"answers":7}');
  });
  await p7.addInitScript(() => {
    Object.defineProperty(indexedDB, 'open', { value: () => { throw new Error('blocked'); } });
  });
  await p7.reload({ waitUntil: 'networkidle' });
  await p7.waitForSelector('.shelf.on');
  const kept = await p7.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('local-')));
  ok(kept.length === 2, `a database that will not open loses no progress (${kept.length} of 2 kept)`);
  await c7.close();
}
{
  const c8 = await b.newContext({ viewport: { width: 390, height: 844 },
    serviceWorkers: 'block' });   // the page's own behaviour, not the worker's
  const p8 = await c8.newPage();
  await p8.goto(URL, { waitUntil: 'networkidle' });
  await p8.waitForSelector('.shelf.on');
  await p8.evaluate(() => {
    localStorage.setItem('munin/boot/day-skipper', JSON.stringify({ html: '<svg/>', from: 'x' }));
    localStorage.setItem('munin/boot/competent-crew', JSON.stringify({ html: '<svg/>', from: 'y' }));
  });

  // (b) A registry that will not load must not be read as "there are no
  // courses" — and must say something, because a course quietly missing from
  // the shelf is how you conclude your deck is gone.
  await p8.route('**/courses/index.json',
    (r) => r.fulfill({ status: 503, contentType: 'text/plain', body: 'nope' }));
  await p8.reload({ waitUntil: 'networkidle' });
  await p8.waitForSelector('.shelf.on');
  const after = await p8.evaluate(() => ({
    boots: Object.keys(localStorage).filter((k) => k.startsWith('munin/boot/')).length,
    said: document.body.innerText.toLowerCase(),
  }));
  ok(after.boots === 2, `an unreadable course list loses no cached scenes (${after.boots} of 2)`);
  ok(after.said.includes('not answering'), 'and the shelf says the courses are not answering');
  await c8.close();
}
{
  // (c) A request that never answers is not a request that failed. The shelf
  // has to arrive anyway, and the loading screen has to stay up until it does
  // rather than being cleared for a blank page.
  const c9 = await b.newContext({ viewport: { width: 390, height: 844 },
    serviceWorkers: 'block' });   // the page's own behaviour, not the worker's
  const p9 = await c9.newPage();
  await p9.route('**/courses/day-skipper/course.json', () => { /* never answers */ });
  await p9.goto(URL, { waitUntil: 'commit' });
  const drawn = await p9.waitForSelector('.shelf.on', { timeout: 20000 }).then(() => true, () => false);
  ok(drawn, 'a course.json that never answers still lets the picker draw');
  await c9.close();
}
{
  // (d) A stale shared link must not cost you the course you were in.
  const c10 = await b.newContext({ viewport: { width: 390, height: 844 },
    serviceWorkers: 'block' });   // the page's own behaviour, not the worker's
  const p10 = await c10.newPage();
  await p10.goto(URL, { waitUntil: 'networkidle' });
  await p10.waitForSelector('.shelf.on');
  await Promise.all([p10.waitForEvent('load'), p10.click('[data-course="day-skipper"]')]);
  await p10.waitForFunction(() => document.getElementById('boot').hidden);
  await p10.goto(URL + '?course=no-such-course', { waitUntil: 'networkidle' });
  await p10.waitForSelector('.shelf.on');
  const resume = await p10.evaluate(() => localStorage.getItem('munin/last-course'));
  ok(resume === 'day-skipper', `a dead deep link leaves the resume target alone (${resume})`);
  await c10.close();
}
{
  // (e) The dock's shortcuts must not eat the keys belonging to the control
  // under the reader's finger. A window handler that grades on Space whatever
  // has focus turns the Again button into the Good button and says nothing:
  // the schedule is corrupted by someone reading the label and believing it.
  const c11 = await b.newContext({ viewport: { width: 390, height: 844 },
    serviceWorkers: 'block' });
  const p11 = await c11.newPage();
  await p11.goto(URL, { waitUntil: 'networkidle' });
  await p11.waitForSelector('.shelf.on');
  await Promise.all([p11.waitForEvent('load'), p11.click('[data-course="day-skipper"]')]);
  await p11.waitForFunction(() => document.getElementById('boot').hidden);
  await p11.click('#study-all');
  await p11.click('#reveal-btn');
  await p11.waitForSelector('#grade-row:not([hidden])');
  await p11.focus('[data-g="1"]');
  await p11.keyboard.press(' ');
  await p11.evaluate(() => writeNow());
  const graded = await p11.evaluate(() => {
    const recs = JSON.parse(localStorage.getItem('munin/day-skipper/state/v1')).recs;
    const ids = Object.keys(recs);
    return { n: ids.length, st: ids.length === 1 ? recs[ids[0]].st : null };
  });
  ok(graded.n === 1, `Space on a grade button answers exactly one card (${graded.n})`);
  // "l" is learning, where Again puts it. "r" is review, where Good does.
  ok(graded.st === 'l',
    `and answers the button it was pressed on, not Good (st=${graded.st})`);
  await c11.close();
}
{
  // (f) A deep link is a way in, not a lock. Entering a course is a reload,
  // which carries the query string with it, so a ?course= that keeps winning
  // makes the picker decorative — and an imported deck unopenable, which reads
  // as the import having vanished.
  const c12 = await b.newContext({ viewport: { width: 390, height: 844 },
    serviceWorkers: 'block' });
  const p12 = await c12.newPage();
  await p12.goto(URL + '?course=day-skipper', { waitUntil: 'networkidle' });
  await p12.waitForFunction(() => document.getElementById('boot').hidden);
  ok((await p12.textContent('#course-title')).trim().toLowerCase() === 'day skipper',
    'a deep link opens the course it names');
  ok(!p12.url().includes('course='), `and spends itself doing it (${p12.url()})`);
  await p12.click('.shelf-btn');
  await p12.waitForSelector('.shelf.on');
  await Promise.all([p12.waitForEvent('load'), p12.click('[data-course="competent-crew"]')]);
  await p12.waitForFunction(() => document.getElementById('boot').hidden);
  ok((await p12.textContent('#course-title')).trim().toLowerCase() === 'competent crew',
    'after which the picker, not the address, decides where you go');
  await c12.close();
}

await b.close();
console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
