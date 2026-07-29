/* The retired kkonrad.com mirror hands origin-scoped browser data to
 * keepclub.app without deleting the recovery copy at the old origin.
 *
 * Playwright fulfils both loopback origins from the two worktrees. That keeps
 * this high-risk bridge test independent of whichever previews occupy the
 * forwarded ports.
 */
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || chromium.executablePath();
const LEGACY_URL = 'http://127.0.0.1:8766/static/munin/index.html';

const types = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

const passed = [];
const failed = [];
const ok = (condition, message) =>
  (condition ? passed : failed).push((condition ? 'PASS  ' : 'FAIL  ') + message);

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block',
  });
  const routeTree = async (pattern, prefix, root) => {
    await context.route(pattern, async (route) => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      const suffix = pathname.slice(prefix.length) || 'index.html';
      const relative = normalize(suffix)
        .replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]+/, '');
      const file = join(root, relative);
      try {
        await route.fulfill({
          status: 200,
          contentType: types[extname(file)] || 'application/octet-stream',
          body: await readFile(file),
          headers: { 'cache-control': 'no-store' },
        });
      } catch {
        await route.fulfill({ status: 404, body: 'not found' });
      }
    });
  };
  await routeTree('http://127.0.0.1:8766/static/munin/**', '/static/munin/',
    '/workspaces/sandbox/projects/kkonrad.github.io/static/munin');
  await routeTree('http://127.0.0.1:8777/projects/keepclub/web/**',
    '/projects/keepclub/web/', '/workspaces/sandbox/projects/keepclub/web');
  const oldPage = await context.newPage();
  await oldPage.goto(LEGACY_URL, { waitUntil: 'networkidle' });
  const retired = await oldPage.evaluate(async () => ({
    marker: !!document.getElementById('app')
      && !!document.querySelector('script[src="munin.js"]'),
    courses: await fetch('courses/index.json').then((response) => response.json()),
    oldCourseStatus: await fetch('courses/day-skipper/course.json')
      .then((response) => response.status),
  }));
  ok(retired.marker, 'the landing page keeps the two legacy worker validation markers');
  ok(retired.courses?.courses?.length === 0 && retired.oldCourseStatus === 404,
    'the retired origin no longer serves a course or a second copy of the app');

  const legacyState = {
    v: 1,
    recs: {
      'legacy-card': {
        st: 'r', step: 0, ivl: 9, ea: 2.5, due: 120, rp: 4, lp: 0, pv: 0,
      },
    },
    day: '2026-07-29',
    newDone: 0,
    revDone: 1,
    streak: 1,
    lastDay: '2026-07-29',
    days: { '2026-07-29': 1 },
    revTotal: 4,
    revGood: 3,
    answers: 4,
    ach: {},
    settings: { newPerDay: 20, maxRev: 120, at: 7 },
  };
  await oldPage.evaluate(async (state) => {
    localStorage.setItem('munin/theme', 'dark');
    localStorage.setItem('munin/day-skipper/state/v1', JSON.stringify(state));
    localStorage.setItem('munin/local-moveabc/state/v1', JSON.stringify(state));
    localStorage.setItem('munin/last-course', 'local-moveabc');

    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('munin', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('decks', { keyPath: 'id' });
        request.result.createObjectStore('cards');
        request.result.createObjectStore('media');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['decks', 'cards', 'media'], 'readwrite');
      tx.objectStore('decks').put({
        id: 'local-moveabc',
        title: 'Legacy navigation',
        description: 'Imported at the retired address',
        count: 1,
        ids: ['legacy-card'],
        created: 1,
      });
      tx.objectStore('cards').put({
        title: 'Legacy navigation',
        cards: [{ id: 'legacy-card', front: 'Old front', back: 'Old back' }],
      }, 'local-moveabc');
      tx.objectStore('media').put({
        name: 'proof.png',
        kind: 'image',
        blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
      }, ['local-moveabc', 0]);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, legacyState);

  const popupReady = context.waitForEvent('page');
  await oldPage.click('#move');
  const newPage = await popupReady;
  await newPage.waitForSelector('.shelf.on', { timeout: 30000 });
  await oldPage.waitForFunction(() =>
    document.getElementById('status').textContent.includes('Move complete'));

  const moved = await newPage.evaluate(async () => {
    const progress = JSON.parse(
      localStorage.getItem('munin/day-skipper/state/v1') || 'null');
    const importedProgress = JSON.parse(
      localStorage.getItem('munin/local-moveabc/state/v1') || 'null');
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('munin', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const get = (store, key) => new Promise((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const [meta, cards, media] = await Promise.all([
      get('decks', 'local-moveabc'),
      get('cards', 'local-moveabc'),
      get('media', ['local-moveabc', 0]),
    ]);
    db.close();
    return {
      progress,
      importedProgress,
      theme: localStorage.getItem('munin/theme'),
      last: localStorage.getItem('munin/last-course'),
      meta,
      cards,
      mediaBytes: media ? await media.blob.arrayBuffer().then((b) => b.byteLength) : 0,
      notice: document.body.textContent,
    };
  });
  ok(moved.progress?.recs?.['legacy-card']?.rp === 4,
    'built-in course progress crosses the origin');
  ok(moved.importedProgress?.recs?.['legacy-card']?.rp === 4,
    'the imported deck review history crosses the origin');
  ok(moved.meta?.title === 'Legacy navigation' && moved.cards?.cards?.length === 1,
    'the imported deck and cards cross the origin');
  ok(moved.mediaBytes === 4, 'imported media crosses the origin');
  ok(moved.theme === 'dark', 'an unset keepclub.app theme inherits the old choice');
  ok(moved.last === null, 'the move lands on the shelf instead of forcing a course');
  ok(moved.notice.includes('moved 2 progress records and 1 imported deck'),
    'the new shelf reports exactly what moved');

  const original = await oldPage.evaluate(async () => {
    const progress = localStorage.getItem('munin/local-moveabc/state/v1');
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('munin', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const meta = await new Promise((resolve, reject) => {
      const request = db.transaction('decks').objectStore('decks').get('local-moveabc');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return { progress, meta, status: document.getElementById('status').textContent };
  });
  ok(!!original.progress && original.meta?.title === 'Legacy navigation',
    'the original progress and deck remain as a recovery copy');
  ok(original.status.includes('2 progress records')
      && original.status.includes('1 imported deck'),
    'the old page confirms the completed copy');

  await context.close();
} catch (error) {
  failed.push('FAIL  migration suite completed: ' + (error.stack || error));
} finally {
  if (browser) await browser.close();
}

console.log([...passed, ...failed].join('\n'));
console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
