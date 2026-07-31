/* Service-worker update and offline regressions need a server whose deploy can
 * change underneath one browser profile. This one is local and disposable.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = new URL('../web/', import.meta.url).pathname.replace(/\/$/, '');
const EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || chromium.executablePath();
const out = [], fails = [];
const ok = (c, m) => (c ? out : fails).push((c ? 'PASS  ' : 'FAIL  ') + m);
const state = {
  gen: 'one', pageTag: 'base', delayImages: 0,
  fail: new Set(), spoof: new Set(), requests: [], v2Cards: false,
};
const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
  if (!rel || rel.endsWith('/')) rel += 'index.html';
  state.requests.push(rel);
  if (state.fail.has(rel)) {
    res.writeHead(503, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    res.end('temporarily unavailable');
    return;
  }
  if (state.spoof.has(rel)) {
    res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
    res.end('<!doctype html><title>Sign in to Wi-Fi</title>');
    return;
  }
  try {
    const path = resolve(ROOT, rel);
    if (!path.startsWith(ROOT + '/')) throw new Error('outside');
    let body = await readFile(path);
    if (state.v2Cards && rel === 'courses/day-skipper/cards.json') {
      body = Buffer.from(JSON.stringify({
        schemaVersion: 2,
        courseId: 'day-skipper',
        cards: [{
          cardId: 'media-card',
          front: '**Which diagram is this?**',
          media: [
            {
              side: 'front',
              mediaType: 'image',
              source: 'img/ds-other-marks.png',
              alternativeText: 'A chart symbol prompt',
            },
            {
              side: 'back',
              mediaType: 'image',
              source: 'img/ds-tidal-datums.png',
              alternativeText: 'The answer diagram',
            },
          ],
        }],
      }));
    }
    if (rel === 'index.html') {
      body = Buffer.from(String(body).replace('</head>',
        `<meta name="qa-page" content="${state.pageTag}"></head>`));
    }
    if (state.delayImages && extname(rel) === '.png') {
      await new Promise((done) => setTimeout(done, state.delayImages));
    }
    if (rel === 'sw.js') {
      body = Buffer.from(String(body).replace(
        /^const BUILD = .*;$/m,
        `const BUILD = { shell: 'qa-${state.gen}', courses: { 'day-skipper': 'qa-${state.gen}', 'competent-crew': 'qa-${state.gen}' } };`,
      ));
    }
    res.writeHead(200, {
      'content-type': mime[extname(rel)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    res.end('not found');
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const b = await chromium.launch({ executablePath: EXE });

async function controlled(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((done) =>
        navigator.serviceWorker.addEventListener('controllerchange', done, { once: true }));
    }
  });
}

async function cachesAt(page) {
  return page.evaluate(async () => {
    const out = {};
    for (const name of await caches.keys()) {
      out[name] = (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname);
    }
    return out;
  });
}

/* A partial deploy may not replace the last complete offline generation. */
{
  state.gen = 'one';
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '?course=day-skipper', { waitUntil: 'networkidle' });
  await controlled(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  const mediaRuntime = await page.evaluate(async () => {
    const module = await import('./lib/course-media.js');
    const sandbox = document.createElement('div');
    const front = document.createElement('div');
    const back = document.createElement('div');
    sandbox.append(front, back);
    document.body.append(sandbox);
    const card = {
      media: [
        {
          side: 'front', mediaType: 'image', source: 'img/prompt.png',
          alternativeText: 'Prompt diagram', width: 20, height: 10,
        },
        {
          side: 'back', mediaType: 'video', source: 'video/answer.webm',
          posterImage: 'img/poster.png',
          transcript: '<p>Transcript</p>',
          captionTracks: [{ source: 'captions/en.vtt', language: 'en' }],
        },
        {
          side: 'back', mediaType: 'audio', source: 'audio/answer.mp3',
          transcript: '<p>Spoken answer</p>',
        },
      ],
    };
    module.renderCourseMediaSide(front, card, 'front', {
      base: 'courses/day-skipper/',
    });
    module.renderCourseMediaSide(back, card, 'back', {
      base: 'courses/day-skipper/',
    });
    await new Promise((done) => setTimeout(done, 20));
    const image = sandbox.querySelector('img');
    const video = sandbox.querySelector('video');
    const audio = sandbox.querySelector('audio');
    const remote = await module.resolveCourseMediaSource('asset.png', {
      resolveMediaSource: async () => 'https://evil.example/asset.png',
    });
    const result = {
      imageAlt: image?.alt,
      imageWidth: image?.getAttribute('width'),
      imageSameOrigin: image?.src.startsWith(location.origin + '/courses/day-skipper/'),
      controls: video?.controls,
      autoplay: video?.autoplay,
      audioControls: audio?.controls,
      audioAutoplay: audio?.autoplay,
      audioSameOrigin: audio?.src.startsWith(location.origin + '/courses/day-skipper/'),
      videoSameOrigin: video?.src.startsWith(location.origin + '/courses/day-skipper/'),
      posterSameOrigin: video?.poster.startsWith(location.origin + '/courses/day-skipper/'),
      trackSameOrigin: video?.querySelector('track')?.src.startsWith(
        location.origin + '/courses/day-skipper/',
      ),
      transcript: !!sandbox.querySelector('.course-media-transcript'),
      remote,
    };
    sandbox.remove();
    return result;
  });
  ok(mediaRuntime.imageAlt === 'Prompt diagram'
      && mediaRuntime.imageWidth === '20'
      && mediaRuntime.imageSameOrigin
      && mediaRuntime.controls
      && mediaRuntime.autoplay === false
      && mediaRuntime.audioControls
      && mediaRuntime.audioAutoplay === false
      && mediaRuntime.audioSameOrigin
      && mediaRuntime.videoSameOrigin
      && mediaRuntime.posterSameOrigin
      && mediaRuntime.trackSameOrigin
      && mediaRuntime.transcript
      && mediaRuntime.remote === null,
  `descriptive image/video media renders safe controls and refuses remote origins (${
    JSON.stringify(mediaRuntime)})`);
  const cachedReader = await cachesAt(page);
  const shellPaths = cachedReader['munin-shell-qa-one'] || [];
  const readerPaths = [
    '/lib/course.js',
    '/lib/legacy-course.js',
    '/lib/course-runtime.js',
    '/lib/course-markdown.js',
    '/lib/course-media.js',
    '/lib/course-yaml.js',
    '/lib/vendor/commonmark-parser-0.31.2.min.js',
    '/lib/vendor/yaml-2.9.0.min.js',
  ];
  ok(readerPaths.every((path) => shellPaths.includes(path)),
    'the complete format-2 JSON/YAML, Markdown, and media reader graph is offline');
  state.gen = 'two';
  state.fail.add('app.js');
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()))
    .catch(() => {});
  await page.waitForTimeout(1600);
  const caches = await cachesAt(page);
  const names = Object.keys(caches);
  const oldComplete = names.includes('munin-shell-qa-one')
    && caches['munin-shell-qa-one'].includes('/app.js');
  const badGone = !names.includes('munin-shell-qa-two');
  ok(oldComplete && badGone,
    `a failed update keeps the complete old shell and removes the partial new one (${names.join(', ')})`);
  state.fail.clear();
  await ctx.close();
}

/* A captive-portal page is not an offline diagram. */
{
  state.gen = 'captive';
  const victim = 'courses/competent-crew/img/cc-beaufort.png';
  state.spoof.add(victim);
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '?course=competent-crew', { waitUntil: 'networkidle' });
  await controlled(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  await page.click('[data-go="stats"]');
  await page.click('.setup-btn:visible');
  await page.click('#setup-device');
  await page.click('#prefetch-btn');
  await page.waitForFunction(() => !document.getElementById('prefetch-btn').disabled,
    null, { timeout: 20000 });
  const result = await page.evaluate(async (path) => {
    const url = new URL(path, location.href).href;
    const hit = await caches.match(url);
    return {
      button: document.getElementById('prefetch-btn').textContent,
      cachedType: hit ? hit.headers.get('content-type') : null,
    };
  }, victim);
  ok(/retry/i.test(result.button) && result.cachedType === null,
    `HTML returned for an image is reported failed and not cached (${result.button})`);
  state.spoof.delete(victim);
  state.requests.length = 0;
  const retried = await page.evaluate(async (path) => {
    const r = await fetch(new URL(path, location.href));
    return r.headers.get('content-type');
  }, victim);
  ok(retried === 'image/png' && state.requests.includes(victim),
    'a later real image reaches the network instead of a poisoned cache');
  await ctx.close();
}

/* A captive portal cannot replace the cached application document. */
{
  state.gen = 'nav-captive';
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '?course=day-skipper', { waitUntil: 'networkidle' });
  await controlled(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  state.spoof.add('index.html');
  await page.reload({ waitUntil: 'load' });
  const result = await page.evaluate(async () => {
    const cached = await caches.match('./', { ignoreSearch: true });
    return {
      app: !!document.getElementById('app'),
      cachedApp: !!cached && /id=["']app["']/.test(await cached.text()),
    };
  });
  ok(result.app && result.cachedApp,
    'captive-portal HTML cannot replace a valid cached app page');
  state.spoof.delete('index.html');
  await ctx.close();
}

/* A changed page is not served until the matching code is complete. */
{
  state.gen = 'page-code-one';
  state.pageTag = 'one';
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '?course=day-skipper', { waitUntil: 'networkidle' });
  await controlled(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  state.pageTag = 'two';
  state.fail.add('app.js');
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  const coherent = await page.evaluate(() => ({
    page: document.querySelector('meta[name="qa-page"]')?.content,
    app: !!document.getElementById('app'),
  }));
  ok(coherent.app && coherent.page === 'one',
    `a partial page/code deploy serves the coherent cached generation (${coherent.page})`);
  state.fail.clear();
  state.pageTag = 'base';
  await ctx.close();
}

/* The actual app boot seam admits v2 and renders both card sides. */
{
  state.gen = 'live-v2';
  state.v2Cards = true;
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '?course=day-skipper', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  await page.click('#study-all');
  await page.waitForSelector(
    '#card-q + .course-media-side[data-media-side="front"] img',
  );
  const front = await page.evaluate(() => ({
    text: document.getElementById('card-q').innerHTML,
    src: document.querySelector(
      '#card-q + .course-media-side[data-media-side="front"] img',
    )?.src,
    legacyPlate: !document.getElementById('card-fig').hidden,
  }));
  await page.click('#reveal-btn');
  await page.waitForSelector(
    '#card-a + .course-media-side[data-media-side="back"] img',
  );
  const back = await page.getAttribute(
    '#card-a + .course-media-side[data-media-side="back"] img', 'src',
  );
  ok(front.text.includes('<strong>Which diagram is this?</strong>')
      && front.src?.includes('/courses/day-skipper/img/ds-other-marks.png')
      && front.legacyPlate === false
      && back?.includes('/courses/day-skipper/img/ds-tidal-datums.png'),
  'live app boot validates v2, renders descriptive front/back media, and avoids the legacy plate');
  await ctx.close();
  state.v2Cards = false;
}

/* A bad course response in a partial deploy falls back to the complete cache. */
{
  state.gen = 'course-one';
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '?course=day-skipper', { waitUntil: 'networkidle' });
  await controlled(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);

  state.gen = 'course-two';
  state.fail.add('courses/day-skipper/cards.json');
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()))
    .catch(() => {});
  await page.waitForTimeout(1600);
  const beforeReload = await cachesAt(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  const result = await page.evaluate(() => ({
    title: document.getElementById('course-title').textContent.trim(),
    cards: DECK.cards.length,
  }));
  const caches = await cachesAt(page);
  ok(result.cards > 0 && result.title.length > 0
      && Object.keys(caches).includes('munin-course-day-skipper-qa-course-one')
      && !(beforeReload['munin-course-day-skipper-qa-course-two'] || [])
        .includes('/courses/day-skipper/cards.json')
      && !(caches['munin-course-day-skipper-qa-course-two'] || [])
        .includes('/courses/day-skipper/cards.json'),
  `a partial course update opens from its last complete cache (${result.cards} cards; `
    + `${result.title || 'no title'}; before=${Object.keys(beforeReload).join(', ')}; `
    + `after=${Object.keys(caches).join(', ')})`);
  state.fail.clear();
  await ctx.close();
}

/* Invalid optional metadata cannot evict the last sound course generation. */
{
  state.gen = 'optional-one';
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '?course=day-skipper', { waitUntil: 'networkidle' });
  await controlled(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  state.gen = 'optional-two';
  state.spoof.add('courses/day-skipper/figures.json');
  state.spoof.add('courses/day-skipper/videos.json');
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()))
    .catch(() => {});
  await page.waitForTimeout(1600);
  const caches = await cachesAt(page);
  ok(Object.keys(caches).includes('munin-course-day-skipper-qa-optional-one')
      && !Object.keys(caches).includes('munin-course-day-skipper-qa-optional-two'),
  `wrong-MIME optional metadata preserves the complete course (${Object.keys(caches).join(', ')})`);
  state.spoof.delete('courses/day-skipper/figures.json');
  state.spoof.delete('courses/day-skipper/videos.json');
  await ctx.close();
}

/* Closing the requester does not cancel the worker's offline batch. */
{
  state.gen = 'closed-client';
  const ctx = await b.newContext();
  const source = await ctx.newPage();
  await source.goto(BASE + '?course=competent-crew', { waitUntil: 'networkidle' });
  await controlled(source);
  await source.reload({ waitUntil: 'load' });
  await source.waitForFunction(() => document.getElementById('boot').hidden);
  const observer = await ctx.newPage();
  await observer.goto(BASE + '?course=competent-crew', { waitUntil: 'load' });
  await observer.waitForFunction(() => document.getElementById('boot').hidden);
  const urls = await source.evaluate(() =>
    Array.from(new Set(DECK.cards.map(backImage).filter(Boolean)
      .map((item) => new URL(courseMediaUrl(item), location.href).href))).slice(0, 3));
  state.delayImages = 120;
  await source.evaluate((batch) => navigator.serviceWorker.controller.postMessage({
    type: 'prefetch', urls: batch, requestId: 'closing-client',
  }), urls);
  await source.waitForTimeout(60);
  await source.close();
  await observer.waitForTimeout(800);
  const saved = await observer.evaluate(async (batch) => {
    const hits = [];
    for (const url of batch) hits.push(!!(await caches.match(url)));
    return hits;
  }, urls);
  ok(saved.every(Boolean),
    `prefetch completes after its requesting tab closes (${saved.filter(Boolean).length}/${saved.length})`);
  state.delayImages = 0;
  await ctx.close();
}

/* Progress messages belong only to the tab that requested that batch. */
{
  state.gen = 'tabs';
  const ctx = await b.newContext();
  const day = await ctx.newPage();
  await day.goto(BASE + '?course=day-skipper', { waitUntil: 'networkidle' });
  await controlled(day);
  await day.reload({ waitUntil: 'load' });
  await day.waitForFunction(() => document.getElementById('boot').hidden);
  await day.click('[data-go="stats"]');
  const original = await day.textContent('#prefetch-btn');

  const crew = await ctx.newPage();
  await crew.goto(BASE + '?course=competent-crew', { waitUntil: 'networkidle' });
  await crew.waitForFunction(() => document.getElementById('boot').hidden);
  await crew.click('[data-go="stats"]');
  await crew.click('.setup-btn:visible');
  await crew.click('#setup-device');
  await crew.click('#prefetch-btn');
  await crew.waitForFunction(() => !document.getElementById('prefetch-btn').disabled,
    null, { timeout: 20000 });
  await day.waitForTimeout(150);
  const untouched = await day.textContent('#prefetch-btn');
  ok(untouched === original,
    `another tab's prefetch cannot claim this course is saved (${untouched.trim()})`);
  await ctx.close();
}

await b.close();
await new Promise((done) => server.close(done));
console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
