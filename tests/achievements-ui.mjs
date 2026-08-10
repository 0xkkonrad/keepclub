/* Browser integration for club-wide moments, sharing, and notification opt-in.
 *
 * This test owns its static server so it can be run directly:
 *   node tests/achievements-ui.mjs
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..', 'web');
const PORTS = [8777, 8765, 8766, 8239, 53682, 5050, 3118, 3051, 3050, 1455, 33687, 35795];
const out = [], fails = [];
const ok = (condition, message) =>
  (condition ? out : fails).push((condition ? 'PASS  ' : 'FAIL  ') + message);

const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
};

function staticServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const relative = decodeURIComponent(url.pathname) === '/'
        ? 'index.html'
        : decodeURIComponent(url.pathname).replace(/^\/+/, '');
      let file = path.resolve(WEB, relative);
      if (file !== WEB && !file.startsWith(WEB + path.sep)) {
        response.writeHead(403).end('forbidden');
        return;
      }
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      const body = await readFile(file);
      response.writeHead(200, {
        'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(body);
    } catch (_) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
    }
  });
}

async function listen() {
  for (const port of PORTS) {
    const server = staticServer();
    const result = await new Promise((resolve) => {
      server.once('error', (error) => resolve({ error }));
      server.listen(port, '127.0.0.1', () => resolve({ server, port }));
    });
    if (!result.error) return result;
    server.close();
    if (result.error.code !== 'EADDRINUSE') throw result.error;
  }
  throw new Error('no forwarded preview port is available');
}

const pad = (value) => String(value).padStart(2, '0');
const dayKey = (at) => {
  const date = new Date(at);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};
const shiftDay = (at, amount) => {
  const date = new Date(at);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.getTime();
};

const now = Date.now();
const today = dayKey(now);
const previousMonth = new Date(now);
previousMonth.setUTCDate(1);
previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
const previousMonthKey = `${previousMonth.getUTCFullYear()}-${pad(previousMonth.getUTCMonth() + 1)}`;
const previousDay = (day) => `${previousMonthKey}-${pad(day)}`;
const unlockedAt = shiftDay(now, -8);

const daySkipperDeck = JSON.parse(
  await readFile(path.join(WEB, 'courses', 'day-skipper', 'cards.json'), 'utf8'),
);
const crewDeck = JSON.parse(
  await readFile(path.join(WEB, 'courses', 'competent-crew', 'cards.json'), 'utf8'),
);
const ids = (deck, count) => deck.cards.slice(0, count).map((card) => card.i);
const solidRecord = () => ({
  st: 'r',
  step: 0,
  ivl: 30,
  ea: 2.5,
  due: shiftDay(now, 30),
  rp: 4,
  lp: 0,
  pv: 0,
});
const recs = (cardIds) => Object.fromEntries(cardIds.map((id) => [id, solidRecord()]));
const baseState = (overrides) => Object.assign({
  v: 1,
  recs: {},
  day: today,
  newDone: 0,
  revDone: 0,
  streak: 0,
  lastDay: today,
  days: {},
  revTotal: 20,
  revGood: 18,
  answers: 0,
  bestClean: 22,
  ach: {},
  settings: {
    newPerDay: 20,
    maxRev: 120,
    shuffle: true,
    examDate: '',
    examSkipped: true,
  },
}, overrides);

// Seven consecutive club days are deliberately divided between two legacy
// course state blobs. The completed previous month also spans both courses.
const seeded = {
  current: baseState({
    recs: recs(daySkipperDeck.cards
      .filter((card) => card.s === daySkipperDeck.sections[0].k)
      .map((card) => card.i)),
    days: {
      [dayKey(shiftDay(now, 0))]: 2,
      [dayKey(shiftDay(now, -2))]: 2,
      [dayKey(shiftDay(now, -4))]: 2,
      [dayKey(shiftDay(now, -6))]: 2,
      [previousDay(2)]: 3,
      [previousDay(12)]: 4,
    },
    answers: 100,
    bestClean: 37,
    // A private club-life find alongside the shareable one, so the sheet's
    // per-record Share button can be proven both present and absent.
    ach: { 'solid-pct-25': unlockedAt, 'night-watch': unlockedAt },
    privateNote: 'NEVER_SHARE_PRIVATE_NOTE_7KQ',
  }),
  other: baseState({
    recs: recs(ids(crewDeck, 5)),
    days: {
      [dayKey(shiftDay(now, -1))]: 1,
      [dayKey(shiftDay(now, -3))]: 1,
      [dayKey(shiftDay(now, -5))]: 1,
      // Day 20 and earlier: on the 1st of a month following a 28-day February
      // the streak reaches back to the 23rd, and an adjacent seeded day would
      // silently stretch the club streak past seven.
      [previousDay(20)]: 5,
    },
    answers: 40,
    ach: {
      'streak-7': unlockedAt,
      'solid-10': unlockedAt,
      // Course achievements from another deck must not bleed into this one.
      'solid-pct-50': unlockedAt,
    },
  }),
  syncSentinel: 'NEVER_SHARE_SYNC_KEY_9ZM',
  storageSentinel: 'NEVER_SHARE_STORAGE_VALUE_4HP',
};

// The seven streak days hang off `now`, so in the first days of a month some of
// them land inside the completed month the recap aggregates. Read the expected
// recap out of the seeded days instead of pinning a mid-month answer, and keep
// both courses in the sum so the check still proves the club-wide roll-up.
const recapDays = {};
for (const state of [seeded.current, seeded.other]) {
  for (const [key, value] of Object.entries(state.days)) {
    if (key.startsWith(`${previousMonthKey}-`)) recapDays[key] = (recapDays[key] || 0) + value;
  }
}
const recapStudyDays = Object.keys(recapDays).length;
const recapAnswers = Object.values(recapDays).reduce((sum, value) => sum + value, 0);
const recapCopy = `${recapStudyDays} study days · ${recapAnswers} answers · 39 solid now`;

const { server, port } = await listen();
const baseUrl = `http://127.0.0.1:${port}/`;
const defaultExecutable = process.env.HOME
  + '/.cache/ms-playwright/chromium_headless_shell-1217/'
  + 'chrome-headless-shell-linux64/chrome-headless-shell';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || defaultExecutable;
if (!existsSync(executablePath)) throw new Error(`Chromium not found at ${executablePath}`);

let browser;
let context;
try {
  browser = await chromium.launch({ executablePath });
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: 'UTC',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.addInitScript((seed) => {
    localStorage.setItem('munin/day-skipper/state/v1', JSON.stringify(seed.current));
    localStorage.setItem('munin/competent-crew/state/v1', JSON.stringify(seed.other));
    // The real sync key and an unrelated local value are hostile sentinels:
    // neither is valid enough to start Sync, but both would expose a privacy
    // failure if a share path serialized storage.
    localStorage.setItem('rya-ds/v1', JSON.stringify({ v: 1, key: seed.syncSentinel }));
    localStorage.setItem('test/private-share-sentinel', seed.storageSentinel);

    globalThis.__permissionRequests = 0;
    let permission = 'default';
    function MockNotification() {}
    Object.defineProperty(MockNotification, 'permission', {
      configurable: true,
      get: () => permission,
    });
    MockNotification.requestPermission = async () => {
      globalThis.__permissionRequests++;
      permission = 'granted';
      return permission;
    };
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: MockNotification,
    });

    globalThis.__shareCalls = [];
    globalThis.__clipboardCalls = [];
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => false,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data) => {
        globalThis.__shareCalls.push({
          title: data.title,
          text: data.text,
          url: data.url,
          files: Array.from(data.files || [], (file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
          })),
        });
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: async (items) => globalThis.__clipboardCalls.push({ kind: 'items', count: items.length }),
        writeText: async (text) => globalThis.__clipboardCalls.push({ kind: 'text', text }),
      },
    });
  }, seeded);

  await page.goto(baseUrl + '?course=day-skipper', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden, null, { timeout: 10000 });
  await page.click('[data-go="stats"]');
  await page.waitForFunction(() => !document.getElementById('s-stats').hidden);

  const progress = await page.evaluate(() => ({
    clubStreak: document.querySelector('#stat-tiles .tile b')?.textContent.trim(),
    membershipHidden: document.getElementById('membership-card').hidden,
    membershipCopy: document.getElementById('membership-copy').textContent.trim(),
    membershipStats: document.getElementById('membership-stats').textContent
      .replace(/\s+/g, ' ').trim(),
    monthHidden: document.getElementById('month-card').hidden,
    monthTitle: document.getElementById('month-title').textContent.trim(),
    monthCopy: document.getElementById('month-copy').textContent.trim(),
    achIds: [...document.querySelectorAll('#ach-list [data-ach-id]')]
      .map((button) => button.dataset.achId),
    momentIds: [...document.querySelectorAll('#ach-list [data-moment-id]')]
      .map((button) => button.dataset.momentId),
    locked50: [...document.querySelectorAll('#ach-list li.locked')]
      .some((row) => row.querySelector('b')?.textContent.trim() === '50% kept'),
    notificationHidden: document.getElementById('notifications-card').hidden,
    permissionRequests: globalThis.__permissionRequests,
  }));

  ok(progress.clubStreak === '7',
    `Progress derives one seven-day streak across both courses (${progress.clubStreak})`);
  ok(!progress.membershipHidden
      && /39 solid/.test(progress.membershipCopy)
      && /140 answers/.test(progress.membershipCopy)
      && /7 day streak/.test(progress.membershipCopy),
  `the membership card carries exact club totals (${progress.membershipCopy})`);
  ok(/7 day streak/.test(progress.membershipStats)
      && /39 solid/.test(progress.membershipStats)
      && /140 answers/.test(progress.membershipStats),
  `the membership stat row agrees with the card (${progress.membershipStats})`);
  ok(!progress.monthHidden
      && progress.monthTitle.endsWith('at the club')
      && progress.monthCopy === recapCopy,
  `the completed monthly recap aggregates both courses (${progress.monthTitle}: ${progress.monthCopy}`
  + `, expected ${recapCopy})`);
  ok(progress.achIds.includes('streak-7') && progress.achIds.includes('solid-10'),
    'club-scoped unlocks earned in another course appear as earned rows in Progress');
  ok(progress.achIds.includes('solid-pct-25')
      && !progress.achIds.includes('solid-pct-50')
      && progress.locked50,
  'course-scoped unlocks stay with their course while their locked row remains visible');
  ok(progress.momentIds.includes('personal-best:37')
      && progress.momentIds.includes(`section-kept:${daySkipperDeck.sections[0].k}`),
  'exact personal-best and kept-section moments remain openable from Progress');
  ok(!progress.notificationHidden && progress.permissionRequests === 0,
    'the opt-in is offered without requesting permission during render');

  await page.click('.setup-btn:visible');
  await page.click('#setup-device');
  await page.click('#notifications-btn');
  await page.waitForFunction(() => globalThis.__permissionRequests === 1);
  const notification = await page.evaluate(() => ({
    requests: globalThis.__permissionRequests,
    label: document.getElementById('notifications-btn').textContent.trim(),
    saved: JSON.parse(localStorage.getItem('keepclub/notifications/v1') || 'null'),
  }));
  ok(notification.requests === 1
      && notification.label === 'Turn off milestone notifications'
      && notification.saved?.enabled === true,
  'one explicit click requests permission and persists the opt-in');

  await page.keyboard.press('Escape');
  await page.click('#membership-share');
  await page.waitForFunction(() => globalThis.__shareCalls.length === 1, null, { timeout: 10000 });
  const sharing = await page.evaluate(() => ({
    payload: globalThis.__shareCalls[0],
    clipboard: globalThis.__clipboardCalls,
    status: document.getElementById('membership-share-status').textContent.trim(),
    storageKeys: Object.keys(localStorage),
  }));
  const serialized = JSON.stringify(sharing.payload);
  const sharedUrl = new URL(sharing.payload.url);
  ok(sharing.status === 'Shared.' && sharing.payload.title === 'keep club',
    'the membership share button reaches the native share surface');
  ok(sharedUrl.origin === new URL(baseUrl).origin
      && sharedUrl.pathname === '/'
      && sharedUrl.search === ''
      && sharedUrl.hash === '',
  `the club-wide membership card shares the clean app root (${sharedUrl.href})`);
  ok(!serialized.includes(seeded.syncSentinel)
      && !serialized.includes(seeded.storageSentinel)
      && !serialized.includes('NEVER_SHARE_PRIVATE_NOTE_7KQ')
      && !serialized.includes('rya-ds/v1')
      && !serialized.includes('munin/day-skipper/state/v1'),
  'share payloads contain no progress blobs, storage keys, private note, or Sync secret');
  ok(sharing.clipboard.length === 0,
    'a successful native share does not also write private data to the clipboard');
  ok(sharing.storageKeys.includes('rya-ds/v1')
      && sharing.storageKeys.includes('test/private-share-sentinel'),
  'privacy sentinels were present locally when the share boundary was exercised');

  // A private achievement's sheet has nothing to leave the device with — the
  // whole point of dropping the toast that just echoed the row was to give it
  // something else worth opening instead.
  await page.click('#ach-list [data-ach-id="night-watch"]');
  await page.waitForFunction(() => !document.getElementById('ach-sheet').hidden);
  const privateSheet = await page.evaluate(() => ({
    title: document.getElementById('ach-sheet-h').textContent.trim(),
    kind: document.getElementById('ach-sheet-kind').textContent.trim(),
    shareHidden: document.getElementById('ach-sheet-share').hidden,
  }));
  ok(privateSheet.title === 'night watch'
      && privateSheet.kind === 'club life'
      && privateSheet.shareHidden,
  `a private achievement opens its sheet with no share action (${JSON.stringify(privateSheet)})`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('ach-sheet').hidden);

  await page.click('#ach-list [data-ach-id="solid-pct-25"]');
  await page.waitForFunction(() => !document.getElementById('ach-sheet').hidden);
  await page.click('#ach-sheet-share');
  await page.waitForFunction(() => globalThis.__shareCalls.length === 2, null, { timeout: 10000 });
  const courseShare = new URL(await page.evaluate(() => globalThis.__shareCalls[1].url));
  ok(courseShare.search === '?course=day-skipper',
    `a course-scoped milestone keeps its validated course path (${courseShare.href})`);
  ok(pageErrors.length === 0,
    `the integrated surfaces raise no page errors (${pageErrors.join(' | ') || 'none'})`);
} catch (error) {
  failed.push('FAIL  browser integration completed: ' + (error.stack || error));
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log(out.concat(fails).join('\n'));
if (fails.length) {
  console.error(`\n${fails.length} failing`);
  process.exit(1);
}
console.log(`\nall ${out.length} green (${baseUrl})`);
