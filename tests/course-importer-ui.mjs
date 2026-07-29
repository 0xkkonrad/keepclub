/* Public course import/update flow as a creator and learner meet it. */
import { chromium } from 'playwright-core';

const URL_ = process.env.MUNIN_URL || 'http://127.0.0.1:8777/keepclub/web/';
const EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || chromium.executablePath();
const passed = [];
const failed = [];
const ok = (condition, message) =>
  (condition ? passed : failed).push((condition ? 'PASS  ' : 'FAIL  ') + message);

function storedZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const body = Buffer.from(entry.bytes);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    locals.push(local, body);
    centrals.push(central);
    offset += local.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const initial = `schemaVersion: 2
courseId: tiny-club
title: Tiny club
cards:
  - cardId: first
    front: Remember one thing.
  - cardId: second
    front: Notice another.
`;
const updated = `schemaVersion: 2
courseId: tiny-club
title: Tiny club, revised
cards:
  - cardId: second
    front: Notice another.
  - cardId: third
    front: Find a third thing.
`;
const invalid = `schemaVersion: 2
courseId: broken-club
cards:
  - cardId: repeated
    front: One
  - cardId: repeated
    front: Two
`;
const differentIdentity = `schemaVersion: 2
courseId: other-club
title: Tiny club, revised
cards:
  - cardId: second
    front: A reused card ID.
  - cardId: fourth
    front: A different course.
`;
const themed = `schemaVersion: 2
courseId: themed-memory-club
shortTitle: Pocket tower
tagline: Small steps, long memory.
cards:
  - cardId: first-step
    front: Remember the first step.
theme:
  accentColor: "#123456"
  accentColorDark: "#abcdef"
  accentInkColor: "#fedcba"
  accentInkColorDark: "#102030"
  paperColor: "#f8f1df"
  paperColorDark: "#20242c"
  loadingArtwork: theme/loading.png
  loadingText: Building the memory tower…
  loadingAnimation: pulse
`;
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

async function openImporter(page) {
  const shelf = page.locator('.shelf.on');
  if (!await shelf.count()) {
    await page.click('.shelf-btn');
    await shelf.waitFor();
  }
  await page.click('[data-byo]');
  await page.waitForSelector('#imp-input', { state: 'attached' });
}

async function giveYaml(page, source, name = 'course.keep.yml') {
  await page.setInputFiles('#imp-input', {
    name,
    mimeType: 'text/yaml',
    buffer: Buffer.from(source),
  });
}

async function waitForBoot(page, errors) {
  try {
    await page.waitForFunction(() => document.getElementById('boot').hidden,
      null, { timeout: 20000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      line: document.getElementById('boot-line')?.textContent,
      back: document.getElementById('boot-back')?.hidden,
      retry: Boolean(document.getElementById('boot-retry')),
      title: document.title,
    }));
    throw new Error(`course boot did not finish: ${JSON.stringify(state)}; `
      + `page errors: ${errors.join('; ')}`, { cause: error });
  }
}

const browser = await chromium.launch({ executablePath: EXE });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto(URL_, { waitUntil: 'networkidle' });
await page.waitForSelector('.shelf.on');
await openImporter(page);
ok((await page.textContent('.imp-how')).includes('.keep.yml')
    && (await page.textContent('.imp-how')).includes('.keep'),
'the shared importer names both public course artifacts');
ok((await page.getAttribute('.imp-how a', 'href')) === './docs/#quick-start',
  'the importer links to the live creator quick start');

await giveYaml(page, initial);
await page.waitForSelector('.imp-book:visible');
const preview = (await page.innerText('.imp-inner')).replace(/\s+/g, ' ');
ok(/2 cards ready to study/.test(preview) && /2 front-only cards/.test(preview),
  'the preview distinguishes valid front-only cards from lost answers');
ok(/stable ID tiny-club/.test(preview), 'the creator-owned course ID is visible before storage');

await Promise.all([page.waitForEvent('load'), page.click('[data-keep="new"]')]);
await waitForBoot(page, errors);
const imported = await page.evaluate(async () => ({
  title: document.querySelector('#course-title')?.textContent.trim(),
  resume: localStorage.getItem('munin/last-course'),
  schemaVersion: DECK.schemaVersion,
  courseId: DECK.courseId,
  ids: DECK.cards.map((card) => card.cardId),
  rows: await (await import('./lib/store.js')).list(),
}));
ok(imported.title === 'Tiny club' && imported.schemaVersion === 2
    && imported.courseId === 'tiny-club'
    && imported.ids.join(',') === 'first,second',
'the imported runtime keeps the descriptive public course and stable card IDs');
ok(/^local-[a-z0-9]+$/.test(imported.resume)
    && imported.rows[0]?.sourceCourseId === 'tiny-club',
'progress identity stays in the compatible local namespace while source identity is retained');

const rollback = await page.evaluate(async () => {
  const importedStore = await import('./lib/store.js');
  const id = localStorage.getItem('munin/last-course');
  const original = await importedStore.get(id);
  let rejected = false;
  try {
    await importedStore.put({ ...original, title: 'partial write' }, [
      {
        source: 'first.png',
        storageIndex: 0,
        mediaType: 'image',
        mimeType: 'image/png',
        bytes: new Uint8Array([1]),
      },
      {
        source: 'bad.png',
        storageIndex: {},
        mediaType: 'image',
        mimeType: 'image/png',
        bytes: new Uint8Array([2]),
      },
    ]);
  } catch {
    rejected = true;
  }
  const after = await importedStore.get(id);
  const leaked = await importedStore.mediaBlob(id, 0);
  await importedStore.put(original, []);
  return { rejected, title: after.title, leaked: !!leaked };
});
ok(rollback.rejected && rollback.title === 'Tiny club' && !rollback.leaked,
  'a synchronous media write failure aborts the whole IndexedDB replacement');

/* Give the retained card one review record before updating. */
await page.evaluate(() => {
  const card = DECK.cards.find((item) => item.cardId === 'second');
  startSession(card.sectionId, { allNew: true });
  session.queue = [card.cardId];
  session.total = 1;
  showCard();
});
await page.waitForSelector('.grade[data-g="3"]:visible');
await page.click('.grade[data-g="3"]');
await page.evaluate(() => writeNow());

await openImporter(page);
await giveYaml(page, updated);
await page.waitForSelector('.imp-book:visible');
const updatePreview = (await page.innerText('.imp-inner')).replace(/\s+/g, ' ');
ok(/update to the same course/i.test(updatePreview)
    && /1 card keeps/.test(updatePreview)
    && /1 card is new/.test(updatePreview)
    && /1 card leaves/.test(updatePreview),
'a stable-course update previews unchanged, added, and removed cards');
await Promise.all([page.waitForEvent('load'), page.click('[data-keep="replace"]')]);
await waitForBoot(page, errors);
const afterUpdate = await page.evaluate(() => ({
  ids: DECK.cards.map((card) => card.cardId),
  records: Object.keys(state.recs),
  title: document.querySelector('#course-title')?.textContent.trim(),
}));
ok(afterUpdate.ids.join(',') === 'second,third' && afterUpdate.title === 'Tiny club, revised',
  'the replacement lands atomically as the revised course');
ok(afterUpdate.records.includes('second') && !afterUpdate.records.includes('first'),
  'matching card progress survives while removed-card state is pruned');

await openImporter(page);
await giveYaml(page, invalid);
await page.waitForSelector('.imp-diags');
const refusal = (await page.innerText('.imp-inner')).replace(/\s+/g, ' ');
ok(/card\.duplicate_id/.test(refusal) && /Nothing was saved/.test(refusal),
  'schema errors are actionable and explicitly atomic');
ok(await page.locator('.imp-err[role="alert"]').count() === 1
    && await page.locator('[data-again]').evaluate((node) => node === document.activeElement),
  'an import failure is announced and moves keyboard focus to recovery');
const stillInstalled = await page.evaluate(async () => {
  const rows = await (await import('./lib/store.js')).list();
  return { rows: rows.length, ids: rows[0]?.ids };
});
ok(stillInstalled.rows === 1 && stillInstalled.ids.join(',') === 'second,third',
  'a failed import cannot partially replace the installed course');

await page.click('[data-again]');
await giveYaml(page, differentIdentity);
await page.waitForSelector('.imp-book:visible');
const identityPreview = await page.textContent('.imp-inner');
ok(/stable course ID differs/i.test(identityPreview)
    && !/update to the same course/i.test(identityPreview),
  'title and card overlap cannot impersonate a different public courseId as an update');

await page.click('.imp-x');
await openImporter(page);
await page.setInputFiles('#imp-input', {
  name: 'themed.keep',
  mimeType: 'application/zip',
  buffer: storedZip([
    { name: 'course.keep.yml', bytes: themed },
    { name: 'theme/loading.png', bytes: tinyPng },
  ]),
});
await page.waitForSelector('.imp-book:visible');
await Promise.all([page.waitForEvent('load'), page.click('[data-keep="new"]')]);
await page.waitForSelector('#boot-scene .boot-course-art', { state: 'attached' });
await page.waitForFunction(() => {
  const image = document.querySelector('#boot-scene .boot-course-art');
  return image?.complete && image.naturalWidth === 1;
});
const loadingPresentation = await page.evaluate(() => {
  const image = document.querySelector('#boot-scene .boot-course-art');
  return {
    line: document.querySelector('#boot-line')?.textContent,
    source: image?.getAttribute('src'),
    animation: image?.dataset.animation,
  };
});
ok(loadingPresentation.line === 'Building the memory tower…'
    && loadingPresentation.source?.startsWith('blob:')
    && loadingPresentation.animation === 'pulse',
  'a packaged course hydrates validated loading copy, artwork, and app-owned motion');

await waitForBoot(page, errors);
const themedLight = await page.evaluate(async () => {
  const style = getComputedStyle(document.documentElement);
  const rows = await (await import('./lib/store.js')).list();
  const record = rows.find((row) => row.sourceCourseId === 'themed-memory-club');
  return {
    documentTitle: document.title,
    header: document.querySelector('#course-title')?.textContent.trim(),
    tagline: document.querySelector('#home-sub')?.textContent.trim(),
    taglineHidden: document.querySelector('#home-sub')?.hidden,
    accent: style.getPropertyValue('--accent').trim(),
    ink: style.getPropertyValue('--accent-ink').trim(),
    paper: style.getPropertyValue('--surface').trim(),
    projectionKeys: Object.keys(record?.presentation || {}).sort(),
    themeKeys: Object.keys(record?.presentation?.theme || {}).sort(),
  };
});
ok(themedLight.documentTitle === 'keep club — Themed memory club'
    && themedLight.header === 'Pocket tower'
    && themedLight.tagline === 'Small steps, long memory.'
    && !themedLight.taglineHidden,
  'derived title, explicit short title, and tagline reach their distinct shell surfaces');
ok(themedLight.accent === '#123456' && themedLight.ink === '#fedcba'
    && themedLight.paper === '#f8f1df',
  'the public light accent, ink, and compatible paper token theme the shell');
ok(themedLight.projectionKeys.join(',') === 'shortTitle,tagline,theme'
    && themedLight.themeKeys.join(',') === [
      'accentColor', 'accentColorDark', 'accentInkColor', 'accentInkColorDark',
      'loadingAnimation', 'loadingArtwork', 'loadingText', 'paperColor', 'paperColorDark',
    ].sort().join(','),
  'storage retains only the validated descriptive presentation projection');

await page.click('#theme-btn');
const themedDark = await page.evaluate(() => {
  const style = getComputedStyle(document.documentElement);
  return {
    theme: document.documentElement.dataset.theme,
    accent: style.getPropertyValue('--accent').trim(),
    ink: style.getPropertyValue('--accent-ink').trim(),
    paper: style.getPropertyValue('--surface').trim(),
  };
});
ok(themedDark.theme === 'dark' && themedDark.accent === '#abcdef'
    && themedDark.ink === '#102030' && themedDark.paper === '#20242c',
  'the public dark accent, ink, and paper token survive the shell theme toggle');

ok(errors.length === 0, `the course import flow has no page errors (${errors.join('; ')})`);
await browser.close();

console.log([...passed, ...failed].join('\n'));
console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
