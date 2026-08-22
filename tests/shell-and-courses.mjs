/* The keep club shell, driven like a person: fresh profile → shelf → a course →
 * a study session → resume on the next cold open.
 * usage: serve the sandbox on :8765, then  node shell-and-courses.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || chromium.executablePath();
const URL = process.env.MUNIN_URL || 'http://127.0.0.1:8777/projects/keepclub/web/';

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

/* ── share keep club, without leaking a course or local state ── */
ok(await p.locator('#shelf-share').isVisible(), 'the course selector carries a share button');
await p.evaluate(() => {
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: async (data) => { globalThis.__sharedKeepClub = data; },
  });
});
await p.click('#shelf-share');
await p.waitForFunction(() => !!globalThis.__sharedKeepClub);
const shared = await p.evaluate(() => globalThis.__sharedKeepClub);
ok(shared.title === 'keep club' && shared.text === 'membership pays in memories.'
    && shared.url === new globalThis.URL('./', URL).href,
  `the native share sheet gets the clean selector link (${shared.url})`);

await p.evaluate(() => {
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (value) => { globalThis.__copiedKeepClub = value; } },
  });
});
await p.click('#shelf-share');
await p.waitForFunction(() => !!globalThis.__copiedKeepClub);
const copied = await p.evaluate(() => globalThis.__copiedKeepClub);
ok(copied === new globalThis.URL('./', URL).href,
  `without a share sheet, the same clean link is copied (${copied})`);
ok((await p.textContent('#shelf-share')).trim() === 'copied',
  'the copy fallback confirms what happened');

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

/* ── reopening resumes the last course and its active session ── */
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForSelector('#reveal-btn:visible');
ok((await p.textContent('#course-title')).trim().toLowerCase() === 'competent crew',
  'cold open resumes the last course, no shelf tap');
ok(await p.evaluate(() => current === 'study' && session.done === 2),
  'the same tab also resumes its active study queue');
await p.click('#study-back');
await p.waitForSelector('#study-all:visible');

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
  const syncCalls = [];
  await p6.route('https://dyaxdgpaideblyhpxyft.supabase.co/rest/v1/rpc/**',
    async (route) => {
      const request = route.request();
      const body = request.postDataJSON();
      const fn = new globalThis.URL(request.url()).pathname.split('/').pop();
      syncCalls.push({ fn, body });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fn === 'sync_get_v2'
          ? []
          : [{ ok: true, rev: 1, data: body.p_data }]),
      });
    });
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
    `first run paints keep club's tower (${first.from})`);
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
  const runtimeCourse = await p6.evaluate(() => ({
    schemaVersion: DECK.schemaVersion,
    courseId: DECK.courseId,
    descriptiveCard: Object.hasOwn(DECK.cards[0], 'cardId')
      && Object.hasOwn(DECK.cards[0], 'front'),
    compactCard: Object.hasOwn(DECK.cards[0], 'i')
      || Object.hasOwn(DECK.cards[0], 'q'),
  }));
  ok(runtimeCourse.schemaVersion === 2 && runtimeCourse.courseId === 'day-skipper'
      && runtimeCourse.descriptiveCard && !runtimeCourse.compactCard,
    'a fetched legacy course is normalized before entering shared runtime state');

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
    diagrams: new Set([...DECK.cards].map(backImage).filter(Boolean)
      .map((item) => item.source)).size,
    about: document.getElementById('about-copy').textContent,
    shortcuts: document.getElementById('about-shortcuts').textContent,
    author: document.getElementById('about-author').href,
    source: document.getElementById('about-source').href,
  }));
  ok(said.hoard === "Ship's log", `the course names the hoard in its own world (${said.hoard})`);
  ok(said.first === 'cast off', `and names what is in it (${said.first})`);
  ok(said.notice.includes('almanac'), 'the fineprint is this course\'s caveat');
  ok(said.link.includes('tiktok.com'), 'and carries the credit it owes');
  ok(/keep club.*open-source.*flashcard app.*kkonrad/is.test(said.about)
      && said.author === 'https://kkonrad.com/',
    'About names keep club, its open source, and kkonrad');
  ok(said.source === 'https://github.com/0xkkonrad/keepclub',
    'About links to the source repository');
  ok(/keyboard.*space shows the answer.*1–4.*u undoes/is.test(said.shortcuts),
    'About documents the desktop study shortcuts');
  ok(said.offlineShown && said.offline.includes(`${said.diagrams} diagrams`),
    `offline counts this deck's diagrams (${said.diagrams})`);
  /* "How this works" is on the picker now, not on Home: it is what the app is,
   * which is a thing you read before you have chosen a deck. Read it where a
   * person meets it — through the pill, from whichever tab they are on. */
  await p6.click('.shelf-btn');
  await p6.waitForSelector('.shelf.on[role="dialog"] #how');
  ok((await p6.textContent('#how')).replace(/\s+/g, ' ')
    .includes('only share it if you turn on Sync'),
    'the getting-started privacy copy describes opt-in Sync truthfully');
  await p6.click('#shelf-x');
  await p6.waitForSelector('.shelf.on', { state: 'detached' });

  await p6.click('.setup-btn:visible');
  await p6.click('#setup-keeping');
  ok(await p6.locator('[data-sync="new"]').isVisible(),
    'a built-in course offers account-free device sync');
  await p6.click('[data-sync="join"]');
  await p6.fill('#sync-join', '01234-56789-ABCDE-FGHJK-MNPQR');
  await p6.evaluate(() => {
    globalThis.__storageSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('storage blocked'); };
    globalThis.confirm = () => true;
  });
  await p6.press('#sync-join', 'Enter');
  const failedJoin = await p6.evaluate(() => ({
    on: DSSync.enabled(),
    joinVisible: !document.getElementById('sync-join').hidden,
    toast: document.getElementById('toast').textContent,
  }));
  await p6.evaluate(() => {
    Storage.prototype.setItem = globalThis.__storageSetItem;
    delete globalThis.__storageSetItem;
  });
  ok(!failedJoin.on && failedJoin.joinVisible && /storage is blocked/i.test(failedJoin.toast),
    'joining a Sync key stays visibly off when its identity cannot be stored');
  await p6.click('[data-sync="new"]');
  await p6.waitForFunction(() => DSSync.status().at > 0);
  const synced = await p6.evaluate(() => ({
    key: document.getElementById('sync-key').textContent,
    localKey: DSSync.KEY,
    stored: localStorage.getItem(DSSync.KEY),
  }));
  ok(/^(?:[0-9A-HJKMNP-TV-Z]{5}-){4}[0-9A-HJKMNP-TV-Z]{5}$/.test(synced.key),
    'sync gives the learner one readable 25-character key');
  ok(synced.localKey === 'munin/sync-off' && JSON.parse(synced.stored).key,
    'the released sync storage key is retained');
  ok(syncCalls.some((call) => call.fn === 'sync_get_v2'
      && call.body.p_app === 'day-skipper' && call.body.p_writer_version === 2)
      && syncCalls.some((call) => call.fn === 'sync_put_v2'
        && call.body.p_app === 'day-skipper' && call.body.p_writer_version === 2),
    'sync uses the fenced writer capability in the active course namespace');
  await p6.evaluate(() => {
    globalThis.__resetConfirmCalls = 0;
    globalThis.confirm = () => { globalThis.__resetConfirmCalls++; return true; };
  });
  await p6.click('#reset-btn');
  const resetGuard = await p6.evaluate(() => ({
    on: DSSync.enabled(),
    confirms: globalThis.__resetConfirmCalls,
    toast: document.getElementById('toast').textContent,
  }));
  ok(resetGuard.on && resetGuard.confirms === 0 && /turn sync off/i.test(resetGuard.toast),
    'a synced deck refuses local erase before making a misleading destructive promise');
  await p6.click('#import-btn');
  const restoreGuard = await p6.textContent('#toast');
  ok(/turn sync off/i.test(restoreGuard),
    'an exact backup restore is refused until shared progress is disconnected');
  await c6.close();
}

/* Firefox Android installs from its browser menu and never supplies the
 * beforeinstallprompt event Chrome uses. Keep the manual route discoverable. */
{
  const cf = await b.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:141.0) Gecko/141.0 Firefox/141.0',
  });
  const pf = await cf.newPage();
  await pf.goto(URL, { waitUntil: 'networkidle' });
  await pf.waitForFunction(() => document.getElementById('boot').hidden);
  const shelfOffer = await pf.evaluate(() => ({
    visible: !document.getElementById('shelf-install').hidden,
    text: document.getElementById('shelf-install').textContent,
  }));
  ok(shelfOffer.visible && /firefox menu/i.test(shelfOffer.text)
      && /install/i.test(shelfOffer.text),
    'Firefox Android gets its menu-based install instructions');
  await cf.close();
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

{
  /* (g) Back is one press per movement, and it made three of them.
   *
   * Entering a course is a fresh load, which used to REPLACE the picker rather
   * than go on top of it, so the phone's Back gesture threw you out of the app
   * from a course, from a tab, and from the courses overlay. The picker and the
   * course share one address, so the entry each of them sits on is what says
   * which is which — and a cold open on that same bare address still resumes. */
  const c13 = await b.newContext({ viewport: { width: 390, height: 844 },
    serviceWorkers: 'block' });
  const p13 = await c13.newPage();
  // A press, and then long enough for the reload it may cause to land.
  const press = async () => {
    await p13.goBack({ waitUntil: 'commit' }).catch(() => {});
    await p13.waitForTimeout(1200);
  };
  const at = () => p13.evaluate(() => ({
    shelf: !!document.querySelector('.shelf.on'),
    overlay: !!document.querySelector('.shelf[role="dialog"]'),
    course: globalThis.COURSE ? COURSE.id : null,
    screen: typeof current === 'undefined' ? null : current,
    last: localStorage.getItem('munin/last-course'),
  }));
  await p13.goto(URL, { waitUntil: 'networkidle' });
  await p13.waitForSelector('.shelf.on');
  await Promise.all([p13.waitForEvent('load'), p13.click('[data-course="day-skipper"]')]);
  await p13.waitForFunction(() => document.getElementById('boot').hidden);

  // Two tabs deep is still one press: Back comes home, not back through Browse.
  await p13.click('[data-go="browse"]');
  await p13.click('[data-go="stats"]');
  await press();
  let now = await at();
  ok(now.course === 'day-skipper' && now.screen === 'home',
    `Back from a tab comes home rather than out of the app (${now.screen})`);

  // The overlay closes on Back, with the course still open behind it.
  await p13.click('.shelf-btn');
  await p13.waitForSelector('.shelf[role="dialog"]');
  await press();
  now = await at();
  ok(!now.overlay && now.course === 'day-skipper',
    'Back closes the courses overlay and leaves you in the course');

  // Closing it with the ✕ has to spend that entry too, or the next Back press
  // pops a panel that is not on screen and looks like a press that went missing.
  await p13.click('.shelf-btn');
  await p13.waitForSelector('.shelf[role="dialog"]');
  await p13.click('#shelf-x');
  await p13.waitForSelector('.shelf[role="dialog"]', { state: 'detached' });
  await press();
  now = await at();
  ok(now.shelf && !now.overlay,
    'closing the overlay with the ✕ leaves no history entry behind for Back to waste');
  // Back on the picker, and it still works as a picker.
  await Promise.all([p13.waitForEvent('load'), p13.click('[data-course="day-skipper"]')]);
  await p13.waitForFunction(() => document.getElementById('boot').hidden);

  // Changing course from an overlay opened on a tab consumes both temporary
  // entries. Back must not reveal the old course or spend a press on a vanished
  // panel before it reaches the picker.
  await p13.click('[data-go="stats"]');
  await p13.click('.shelf-btn');
  await p13.waitForSelector('.shelf[role="dialog"]');
  await Promise.all([
    p13.waitForEvent('load'),
    p13.click('[data-course="competent-crew"]'),
  ]);
  await p13.waitForFunction(() => document.getElementById('boot').hidden);
  now = await at();
  ok(now.course === 'competent-crew' && now.screen === 'home',
    `choosing from an overlaid tab opens only the new course (${now.course}/${now.screen})`);

  // And from the course itself: the picker, with the resume pointer untouched
  // — the bare URL means the shelf here and "carry on" on a cold open.
  await press();
  now = await at();
  ok(now.shelf && !now.course,
    'Back from a switched course lands on the picker without an old-course stop');
  ok(now.last === 'competent-crew',
    `and does not forget which course you were in (${now.last})`);
  const tiles13 = await p13.locator('.shelf-tile').count();
  ok(tiles13 === REGISTERED.length + 1,
    `the picker it lands on is the real one, drawn fresh (${tiles13} tiles)`);

  // From the picker, Back is the way out of the app. It is not a trap.
  await press();
  ok(!p13.url().startsWith('http'), `and Back off the picker leaves Munin (${p13.url()})`);
  await c13.close();
}
{
  // (h) Reload now restores the session. Its history entry must still unwind
  // with one Back press, landing on this course's Home rather than doing
  // nothing or leaving the app.
  const c14 = await b.newContext({ viewport: { width: 390, height: 844 },
    serviceWorkers: 'block' });
  const p14 = await c14.newPage();
  await p14.goto(URL, { waitUntil: 'networkidle' });
  await p14.waitForSelector('.shelf.on');
  await Promise.all([p14.waitForEvent('load'), p14.click('[data-course="day-skipper"]')]);
  await p14.waitForFunction(() => document.getElementById('boot').hidden);
  await p14.click('#study-all');
  await p14.waitForSelector('#reveal-btn:visible');
  await p14.reload({ waitUntil: 'networkidle' });
  await p14.waitForFunction(() => document.getElementById('boot').hidden);
  await p14.goBack({ waitUntil: 'commit' }).catch(() => {});
  await p14.waitForTimeout(1500);
  const after14 = await p14.evaluate(() => ({
    screen: current,
    course: COURSE.id,
    url: location.href,
  }));
  ok(after14.screen === 'home' && after14.course === 'day-skipper'
      && after14.url.startsWith('http'),
    'one Back press after a reload mid-session moves, and moves inside the app');
  await c14.close();
}
{
  /* (i) Practising ahead is practice: the schedule does not move.
   *
   * Once the day's cards are done the home button offers the ones scheduled
   * for later. Answering one used to be recorded as a review passed on the day
   * it was due — a card answered fifteen seconds ago grew from "tomorrow" to
   * "in three days" — so a quiet afternoon of extra work pushed the deck out
   * to the interval cap without a day having passed. */
  const c15 = await b.newContext({ viewport: { width: 390, height: 844 },
    serviceWorkers: 'block' });
  const p15 = await c15.newPage();
  await p15.goto(URL, { waitUntil: 'networkidle' });
  await p15.waitForSelector('.shelf.on');
  await Promise.all([p15.waitForEvent('load'), p15.click('[data-course="competent-crew"]')]);
  await p15.waitForFunction(() => document.getElementById('boot').hidden);
  // Two new cards a day, so today's plan is two cards long. Competent Crew
  // ships no exam date, so the number asked for is the number used.
  await p15.click('[data-go="stats"]');
  await p15.click('.setup-btn:visible');
  await p15.click('#setup-studying');
  await p15.fill('#set-new', '2');
  await p15.dispatchEvent('#set-new', 'change');
  await p15.keyboard.press('Escape');
  await p15.click('[data-go="home"]');
  const answer = async (g) => {
    await p15.waitForSelector('#reveal-btn:visible');
    await p15.click('#reveal-btn');
    await p15.waitForSelector(`.grade[data-g="${g}"]:visible`);
    await p15.click(`.grade[data-g="${g}"]`);
    await p15.waitForTimeout(80);
  };
  await p15.click('#study-all');
  await answer(3);
  await answer(3);
  await p15.waitForSelector('#done-home:visible');
  await p15.click('#done-home');
  await p15.evaluate(() => writeNow());
  const KEY = 'munin/competent-crew/state/v1';
  const before15 = await p15.evaluate((k) => localStorage.getItem(k), KEY);
  const btn15 = (await p15.textContent('#study-all')).trim();
  ok(/^practise/i.test(btn15), `the day's work done, the button offers practice ("${btn15}")`);
  ok((await p15.textContent('#today-note')).includes('nothing you answer counts'),
    'and says what it costs before you tap it: nothing counts');

  await p15.click('#study-all');
  await p15.waitForSelector('#reveal-btn:visible');
  ok((await p15.textContent('#toast')).toLowerCase().startsWith('practice'),
    'the session opens by saying it is practice');
  await p15.click('#reveal-btn');
  await p15.waitForSelector('.grade[data-g="3"]:visible');
  const dock15 = await p15.evaluate(() => ({
    ask: document.getElementById('grade-ask').textContent,
    ivs: [1, 2, 3, 4].map((g) => document.getElementById('iv' + g).textContent).join(''),
  }));
  ok(dock15.ivs === '', 'the grade buttons promise no dates, because none will be applied');
  ok(dock15.ask.toLowerCase().includes('practice'), `and the line above them says so ("${dock15.ask}")`);
  await p15.click('.grade[data-g="3"]');
  await p15.waitForTimeout(120);
  const mid15 = await p15.evaluate(() => ({
    left: document.getElementById('study-left').textContent,
    done: session.done,
  }));
  ok(mid15.done === 1 && /1 done/.test(mid15.left),
    `the session still counts its own cards (${mid15.left})`);
  // Answer the whole of it, Again included, and the schedule must not have moved.
  for (let i = 0; i < 80; i++) {
    if (!(await p15.locator('#reveal-btn').isVisible())) break;
    await answer(i === 0 ? 1 : 3);
  }
  await p15.waitForSelector('#done-home:visible');
  await p15.evaluate(() => writeNow());
  const after15 = await p15.evaluate((k) => localStorage.getItem(k), KEY);
  ok(after15 === before15,
    'a whole practice round changes not one due date, interval, streak or day count');
  const done15 = await p15.evaluate(() => ({
    line: document.getElementById('done-line').textContent,
    stats: document.getElementById('done-stats').innerText.replace(/\s+/g, ' '),
  }));
  ok(done15.line.toLowerCase().includes('practice'),
    `the summary says the same thing at the end ("${done15.line}")`);
  ok(/\b0 new\b/.test(done15.stats),
    `and claims no new cards were started, because none were (${done15.stats})`);
  await p15.click('#done-home');

  // The ordinary session it sits beside is untouched: roll the day over and the
  // next real answer is recorded exactly as before.
  await p15.evaluate(() => {
    state.day = '2000-01-01';
    state.lastDay = '2000-01-01';
    writeNow();
  });
  await p15.reload({ waitUntil: 'networkidle' });
  await p15.waitForFunction(() => document.getElementById('boot').hidden);
  await p15.click('#study-all');
  await answer(3);
  await p15.evaluate(() => writeNow());
  const real15 = await p15.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  ok(Object.keys(real15.recs).length >= 3 && real15.answers >= 3,
    `a real session still writes to the schedule (${Object.keys(real15.recs).length} cards answered)`);
  await c15.close();
}

await b.close();
console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
