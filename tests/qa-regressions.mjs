/* Cross-surface regressions found by the deep QA pass.
 * These are deliberately browser-level: the defects lived between storage,
 * wall-clock time, global input handlers, optional assets and modal chrome.
 */
import { chromium } from 'playwright-core';

const EXE = process.env.HOME
  + '/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell';
const URL = process.env.MUNIN_URL || 'http://127.0.0.1:8777/projects/keepclub/web/';
const VIDEO_FILE = new globalThis.URL('../web/courses/day-skipper/videos.json', import.meta.url).pathname;
const out = [], fails = [];
const ok = (c, m) => (c ? out : fails).push((c ? 'PASS  ' : 'FAIL  ') + m);
const b = await chromium.launch({ executablePath: EXE });

const fakeClock = (initial) => {
  const RealDate = Date;
  globalThis.__muninNow = initial;
  globalThis.__setMuninNow = (v) => { globalThis.__muninNow = v; };
  class FakeDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [globalThis.__muninNow])); }
    static now() { return globalThis.__muninNow; }
  }
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  globalThis.Date = FakeDate;
};

async function coursePage(options = {}, id = 'day-skipper') {
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block', ...options,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL + '?course=' + id, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  return { ctx, page, errors };
}

/* Held keys and unrevealed numeric grades never answer a card. */
{
  const { ctx, page, errors } = await coursePage();
  await page.click('#study-all');
  const before = await page.evaluate(() => ({
    id: session.queue[0], recs: Object.keys(state.recs).length,
  }));
  const repeatEnter = await page.evaluate(() => {
    const e = new KeyboardEvent('keydown',
      { key: 'Enter', repeat: true, bubbles: true, cancelable: true });
    $('#reveal-btn').dispatchEvent(e);
    return { prevented: e.defaultPrevented, revealed: session.revealed };
  });
  await page.keyboard.press('3');
  const unrevealed = await page.evaluate(() => ({
    revealed: session.revealed, recs: Object.keys(state.recs).length,
  }));
  if (!unrevealed.revealed) await page.click('#reveal-btn');
  await page.evaluate(() => dispatchEvent(new KeyboardEvent('keydown',
    { key: '3', repeat: true, bubbles: true })));
  const repeated = await page.evaluate(() => ({
    id: session.queue[0], done: session.done, recs: Object.keys(state.recs).length,
  }));
  ok(!unrevealed.revealed && unrevealed.recs === before.recs,
    '1–4 are inert until the answer has been revealed');
  ok(repeatEnter.prevented && !repeatEnter.revealed,
    'held Enter cannot activate the next study control');
  ok(repeated.id === before.id && repeated.done === 0 && repeated.recs === before.recs,
    'a repeated grade key cannot answer the same dock twice');
  ok(errors.length === 0, `shortcut checks raise no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The async course picker is one history-aware, focus-contained dialog. */
{
  const { ctx, page } = await coursePage();
  await page.evaluate(() => {
    const button = document.querySelector('.shelf-btn');
    button.click();
    button.click();
  });
  await page.waitForSelector('.shelf.on[role="dialog"]');
  await page.waitForTimeout(100);
  const opened = await page.locator('.shelf.on[role="dialog"]').count();
  let trapped = true;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    trapped &&= await page.evaluate(() =>
      !!document.querySelector('.shelf.on[role="dialog"]')?.contains(document.activeElement));
  }
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => !document.querySelector('.shelf.on[role="dialog"]'));
  const returned = await page.evaluate(() => ({
    app: !!document.getElementById('app'),
    focus: document.activeElement?.classList.contains('shelf-btn'),
  }));
  ok(opened === 1, `rapid taps open one course dialog (${opened})`);
  ok(trapped, 'Tab stays inside the course dialog');
  ok(returned.app && returned.focus,
    'browser Back dismisses the course dialog and restores its opener');
  await ctx.close();
}

/* Browser Back from Study returns focus to the Home study action. */
{
  const { ctx, page } = await coursePage();
  await page.click('#study-all');
  await page.click('#reveal-btn');
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => current === 'home');
  const focus = await page.evaluate(() => document.activeElement?.id);
  ok(focus === 'study-all', `leaving Study restores a useful Home focus target (${focus})`);
  await ctx.close();
}

/* One course can have only one active writer across tabs. */
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
  });
  const a = await ctx.newPage();
  const c = await ctx.newPage();
  await a.goto(URL + '?course=competent-crew', { waitUntil: 'networkidle' });
  await a.waitForFunction(() => document.getElementById('boot').hidden);
  await c.goto(URL, { waitUntil: 'networkidle' });
  await c.waitForFunction(() => document.getElementById('boot').hidden);
  const sections = await a.evaluate(() =>
    DECK.sections.slice(0, 2).map((s) => s.sectionId));
  await a.evaluate((sk) => startSession(sk, {}), sections[0]);
  await c.evaluate((sk) => startSession(sk, {}), sections[1]);
  await c.waitForTimeout(100);
  const second = await c.evaluate(() => ({
    studying: current === 'study', session: !!session, toast: $('#toast').textContent,
  }));
  await a.evaluate(() => { reveal(); answer(3); writeNow(); });
  const saved = await a.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('munin/competent-crew/state/v1'));
    return { answers: s.answers, records: Object.keys(s.recs).length };
  });
  ok(!second.studying && !second.session && /another tab/i.test(second.toast),
    'a second tab is stopped before it can overwrite an active study session');
  ok(saved.answers === 1 && saved.records === 1,
    'the lock-owning tab still records its answer normally');
  await ctx.close();
}

/* The lock hand-off includes the final synchronous state commit. */
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
  });
  const a = await ctx.newPage();
  const c = await ctx.newPage();
  await Promise.all([
    a.goto(URL + '?course=competent-crew', { waitUntil: 'networkidle' }),
    c.goto(URL + '?course=competent-crew', { waitUntil: 'networkidle' }),
  ]);
  await Promise.all([
    a.waitForFunction(() => document.getElementById('boot').hidden),
    c.waitForFunction(() => document.getElementById('boot').hidden),
  ]);
  const first = await a.evaluate(() => {
    startSession(null, {});
    session.queue = [session.queue[0]];
    session.total = 1;
    showCard();
    const id = session.queue[0];
    reveal();
    answer(3);
    return id;
  });
  const second = await c.evaluate((firstId) => {
    startSession(null, {});
    const id = session.queue.find((x) => x !== firstId) || session.queue[0];
    session.queue = [id];
    session.total = 1;
    showCard();
    reveal();
    answer(3);
    return id;
  }, first);
  const saved = await c.evaluate(() => {
    const s = JSON.parse(localStorage.getItem(KEY));
    return { answers: s.answers, ids: Object.keys(s.recs) };
  });
  ok(first !== second && saved.answers === 2
      && saved.ids.includes(first) && saved.ids.includes(second),
  `a finishing tab commits before handing the lease to the next tab (${saved.answers} answers)`);
  await ctx.close();
}

/* A corrupt or clock-skewed future timestamp is not an immortal lease. */
{
  const { ctx, page } = await coursePage({}, 'competent-crew');
  const reclaimed = await page.evaluate(() => {
    localStorage.setItem(STUDY_LOCK_KEY,
      JSON.stringify({ owner: 'dead-tab', at: Date.now() + 3600000 }));
    startSession(null, {});
    return { studying: current === 'study', owner: readStudyLock()?.owner };
  });
  ok(reclaimed.studying && reclaimed.owner !== 'dead-tab',
    'a future-dated stale study lock is reclaimed');
  await ctx.close();
}

/* Idle-tab settings cannot race the active tab's whole-document study state. */
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
  });
  const a = await ctx.newPage();
  const c = await ctx.newPage();
  await Promise.all([
    a.goto(URL + '?course=competent-crew', { waitUntil: 'networkidle' }),
    c.goto(URL + '?course=competent-crew', { waitUntil: 'networkidle' }),
  ]);
  await Promise.all([
    a.waitForFunction(() => document.getElementById('boot').hidden),
    c.waitForFunction(() => document.getElementById('boot').hidden),
  ]);
  await a.evaluate(() => { startSession(null, {}); writeNow(); });
  await c.evaluate(() => go('stats'));
  await c.fill('#set-new', '77');
  await c.dispatchEvent('#set-new', 'change');
  const refused = await c.evaluate(() => ({
    setting: state.settings.newPerDay,
    stored: JSON.parse(localStorage.getItem(KEY)).settings.newPerDay,
    toast: $('#toast').textContent,
  }));
  await a.evaluate(() => { reveal(); answer(3); writeNow(); });
  const afterGrade = await a.evaluate(() => {
    const s = JSON.parse(localStorage.getItem(KEY));
    return { setting: s.settings.newPerDay, answers: s.answers };
  });
  ok(refused.setting === 20 && refused.stored === 20
      && /another tab is studying/i.test(refused.toast)
      && afterGrade.setting === 20 && afterGrade.answers === 1,
  'an idle tab cannot create a setting/grade last-writer conflict');
  await ctx.close();
}

/* Manual history erasure is also a deck-wide cross-tab reset. */
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
  });
  const a = await ctx.newPage();
  const c = await ctx.newPage();
  await Promise.all([
    a.goto(URL + '?course=competent-crew', { waitUntil: 'networkidle' }),
    c.goto(URL + '?course=competent-crew', { waitUntil: 'networkidle' }),
  ]);
  await Promise.all([
    a.waitForFunction(() => document.getElementById('boot').hidden),
    c.waitForFunction(() => document.getElementById('boot').hidden),
  ]);
  await c.evaluate(() => {
    startSession(null, {});
    reveal();
    answer(3);
    writeNow();
  });
  await a.waitForFunction(() => state.answers === 1);
  await a.evaluate(() => go('stats'));
  a.on('dialog', (d) => d.accept());
  const staleReload = c.waitForEvent('load');
  await a.click('#reset-btn');
  await staleReload;
  await c.waitForFunction(() => document.getElementById('boot').hidden);
  await c.evaluate(() =>
    dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  await a.waitForTimeout(100);
  const erased = await a.evaluate(() => {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s ? { answers: s.answers, records: Object.keys(s.recs || {}).length } : null;
  });
  ok(!erased || (!erased.answers && !erased.records),
    `manual erase cannot be resurrected by a stale study tab (${JSON.stringify(erased)})`);
  await ctx.close();
}

/* A storage ceiling becomes a durable recovery state, not a stream of answers
 * that appear to work and then all vanish on reload. */
{
  const { ctx, page } = await coursePage();
  await page.click('#study-all');
  await page.click('#reveal-btn');
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === KEY) throw new DOMException('full', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  });
  await page.click('[data-g="3"]');
  await page.waitForTimeout(350);
  const first = await page.evaluate(() => ({ answers: state.answers, blocked: saveBlocked }));
  await page.evaluate(() => { reveal(); answer(3); });
  const second = await page.evaluate(() => {
    const answers = state.answers;
    leaveStudy(false);
    go('stats');
    return { answers, warning: $('#backup-state').textContent, toast: $('#toast').textContent };
  });
  ok(first.blocked && second.answers === first.answers,
    'after a save failure, further grades are blocked before mutating progress');
  ok(/not saving/i.test(second.warning) && /export/i.test(second.warning + second.toast),
    'the storage failure remains visible with an export recovery path');
  await ctx.close();
}

/* A session that crosses midnight attributes the grade to the new day. */
{
  const before = Date.parse('2026-07-28T23:59:00Z');
  const { ctx, page, errors } = await coursePage({ timezoneId: 'UTC' }, 'competent-crew');
  // Reload with the clock installed before app.js constructs the fresh state.
  await page.addInitScript(fakeClock, before);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  await page.click('#study-all');
  await page.click('#reveal-btn');
  await page.evaluate((v) => __setMuninNow(v), Date.parse('2026-07-29T00:01:00Z'));
  await page.click('.grade[data-g="3"]');
  const s = await page.evaluate(() => ({
    day: state.day, days: { ...state.days }, newDone: state.newDone,
  }));
  ok(s.day === '2026-07-29' && s.days['2026-07-29'] === 1 && !s.days['2026-07-28'],
    `a post-midnight answer belongs to 29 July (${JSON.stringify(s.days)})`);
  ok(s.newDone === 1, 'the new-day card counter rolls before the grade');
  ok(errors.length === 0, `midnight rollover raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Intervals advance by calendar days, including the short DST day. */
{
  const before = Date.parse('2026-03-08T04:30:00Z'); // 7 Mar, 23:30 in New York
  const ctx = await b.newContext({
    timezoneId: 'America/New_York', serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  await page.addInitScript(fakeClock, before);
  await page.goto(URL + '?course=competent-crew', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  const due = await page.evaluate(() => {
    const id = DECK.cards[0].cardId;
    grade(id, 3, 1);
    return { from: dayKey(Date.now()), due: dayKey(state.recs[id].due) };
  });
  ok(due.from === '2026-03-07' && due.due === '2026-03-08',
    `one day means the next local date across spring-forward (${due.from} → ${due.due})`);
  await ctx.close();
}

/* Session summary accuracy and Undo's session-local video state. */
{
  const { ctx, page, errors } = await coursePage();
  await page.evaluate(() => {
    startSession(null, {});
    session.queue = [session.queue[0]];
    session.total = 1;
    session.startedNew = 1;
    showCard();
  });
  await page.click('#reveal-btn');
  await page.click('[data-g="1"]');
  await page.waitForTimeout(500);
  await page.click('#reveal-btn');
  await page.click('[data-g="3"]');
  await page.waitForSelector('#s-done:not([hidden])');
  const firstTry = await page.locator('#done-stats div').nth(1).locator('b').textContent();
  ok(firstTry === '0%', `Again then Good is not called first-try correct (${firstTry})`);

  await page.evaluate(() => leaveStudy(false));
  await page.waitForFunction(() => Object.keys(VIDEOS.cards || {}).length > 0);
  await page.evaluate(() => {
    const id = Object.keys(VIDEOS.cards)[0];
    const c = byId.get(id);
    startSession(c.sectionId, { allNew: true });
    session.queue = [id];
    session.total = 1;
    showCard();
  });
  await page.click('#reveal-btn');
  await page.click('[data-g="1"]');
  await page.waitForTimeout(500);
  await page.click('#undo-btn');
  const reel = await page.evaluate(() => session.reel.slice());
  ok(reel.length === 0, `Undo removes clips added by the undone grade (${reel.length} left)`);
  ok(errors.length === 0, `summary/Undo checks raise no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The diagram viewer is the topmost modal and owns every Tab stop. */
{
  const { ctx, page } = await coursePage();
  await page.waitForFunction(() => !!FIGURES);
  const encodedMediaUrl = await page.evaluate(() =>
    courseMediaUrl({ source: 'img/100% #?.png' }));
  ok(encodedMediaUrl.endsWith('img/100%25%20%23%3F.png'),
    `diagram URL encoding preserves path separators and quotes unsafe filename bytes (${encodedMediaUrl})`);
  await page.evaluate(() => {
    const c = DECK.cards.find((x) =>
      backImage(x) || (x.figure && FIGURES[x.figure.figureId]));
    document.querySelector('[data-go="browse"]').focus();
    openLightbox(c);
  });
  const modal = await page.evaluate(() => ({
    app: $('#app').inert,
    skip: document.querySelector('.skip').inert,
    shelf: document.querySelector('.shelf-btn').inert,
    lightboxZ: Number(getComputedStyle($('#lightbox')).zIndex),
    shelfZ: Number(getComputedStyle(document.querySelector('.shelf-btn')).zIndex),
  }));
  let inside = true;
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    inside &&= await page.evaluate(() => $('#lightbox').contains(document.activeElement));
  }
  ok(modal.app && modal.skip && modal.shelf && modal.lightboxZ > modal.shelfZ,
    `the lightbox inerts and visually covers every background control (${modal.lightboxZ}>${modal.shelfZ})`);
  ok(inside, 'Tab cannot escape the open lightbox');
  await ctx.close();
}

/* Closing a diagram before its image arrives cancels its pending layout work. */
{
  const ctx = await b.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  let held = null;
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/courses/day-skipper/img/*.png', (route) => { held = route; });
  await page.goto(URL + '?course=day-skipper', { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  await page.evaluate(async () => {
    openLightbox(DECK.cards.find((c) => backImage(c)));
    const lateLoad = $('#lb-img').onload;
    closeLightbox(true);
    // Model the load event already queued by the browser at the moment close()
    // removed the src. The callback used to measure lb.node after clearing it.
    if (lateLoad) lateLoad();
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  ok(errors.length === 0,
    `closing a still-loading diagram leaves no stale fit callback (${errors.join(' | ') || 'none'})`);
  if (held) await held.abort().catch(() => {});
  await ctx.close();
}

/* Definitively removed optional assets retire old cached branding. */
{
  const { ctx, page } = await coursePage();
  await page.waitForFunction(() => localStorage.getItem('munin/boot/day-skipper'));
  await page.route('**/courses/day-skipper/boot.html',
    (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'removed' }));
  await page.route('**/courses/day-skipper/boot.css',
    (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'removed' }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  await page.waitForTimeout(100);
  const cached = await page.evaluate(() => localStorage.getItem('munin/boot/day-skipper'));
  ok(cached === null, 'a 404 boot scene clears the obsolete replay cache');
  const safe = await page.evaluate(() => ({
    scene: safeScene('<path style="fill:url(https://tracker.invalid/p)" '
      + 'filter="url(https://tracker.invalid/f)" fill="url(#local)"/>'),
    css: safeCss('#boot{background:url(https://tracker.invalid/p)}'
      + '@keyframes x{from{fill:url(https://tracker.invalid/k)}to{opacity:1}}'),
    layer: safeCss('@layer escaped{body{display:none!important}#boot{color:red}}'),
  }));
  ok(!/tracker\.invalid/.test(safe.scene + safe.css) && /url\(#local\)/.test(safe.scene),
    'cached boot sanitizers retain local fragments but remove external resource URLs');
  ok(!/\bbody\b/.test(safe.layer),
    'a named @layer cannot carry an unscoped rule out of the boot screen');
  await ctx.close();
}

/* Optional-file behavior follows the folder, not redundant course metadata. */
{
  const ctx = await b.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.route('**/courses/day-skipper/course.json', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    delete data.figures;
    await route.fulfill({ response, json: data });
  });
  await page.goto(URL + '?course=day-skipper', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  const css = await page.evaluate(() => [...document.styleSheets]
    .some((s) => (s.href || '').endsWith('/figures.css')));
  ok(css, 'figures.css loads when present even without course.json.figures metadata');
  await ctx.close();
}

/* Optional video metadata arriving late updates the card already on screen. */
{
  const ctx = await b.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  let held = null;
  await page.route('**/courses/day-skipper/videos.json', (route) => { held = route; });
  await page.goto(URL + '?course=day-skipper', { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  const target = 'e633f0d73a';
  await page.evaluate((id) => {
    const c = byId.get(id);
    startSession(c.sectionId, { allNew: true });
    session.queue = [id];
    session.total = 1;
    showCard();
  }, target);
  await page.click('#reveal-btn');
  await page.click('[data-g="2"]');
  await held.fulfill({ path: VIDEO_FILE, contentType: 'application/json' });
  await page.waitForFunction((id) => !!VIDEOS.cards[id] && session.reel.length > 0, target);
  await page.click('#reveal-btn');
  const video = await page.evaluate(() => ({
    hidden: $('#card-video').hidden,
    clips: $('#card-video').querySelectorAll('video').length,
    reel: session.reel.length,
  }));
  ok(!video.hidden && video.clips > 0 && video.reel > 0,
    `late video metadata populates the current card and recap (${video.clips}/${video.reel} clips)`);
  await ctx.close();
}

/* A short session can finish before its optional video map arrives. */
{
  const ctx = await b.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  let held = null;
  await page.route('**/courses/day-skipper/videos.json', (route) => { held = route; });
  await page.goto(URL + '?course=day-skipper', { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  const target = 'e633f0d73a';
  await page.evaluate((id) => {
    const c = byId.get(id);
    startSession(c.sectionId, { allNew: true });
    session.queue = [id];
    session.total = 1;
    showCard();
    for (let i = 0; i < 6 && session; i++) {
      reveal();
      answer(2);
    }
  }, target);
  await page.waitForSelector('#s-done:not([hidden])');
  await held.fulfill({ path: VIDEO_FILE, contentType: 'application/json' });
  await page.waitForFunction(() => !document.getElementById('done-reel').hidden);
  const recap = await page.evaluate(() => ({
    reel: lastReel.length,
    clips: document.querySelectorAll('#done-reel video').length,
  }));
  ok(recap.reel > 0 && recap.clips > 0,
    `video metadata arriving after Done still fills the recap (${recap.clips} clips)`);
  await ctx.close();
}

/* Large search indexes yield between bounded chunks. */
{
  const { ctx, page } = await coursePage();
  const yields = await page.evaluate(async () => {
    const original = DECK;
    const real = setTimeout;
    let n = 0;
    globalThis.setTimeout = (fn, ms, ...args) => {
      if (ms === 0) n++;
      return real(fn, ms, ...args);
    };
    DECK = { cards: Array.from({ length: 1201 }, (_, i) => ({
      cardId: String(i), front: `Question ${i}`, back: `Answer ${i}`,
    })) };
    await Promise.resolve(indexDeck());
    DECK = original;
    await Promise.resolve(indexDeck());
    globalThis.setTimeout = real;
    return n;
  });
  ok(yields >= 2, `large-deck indexing yields to the browser (${yields} yields)`);
  await ctx.close();
}

await b.close();
console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
