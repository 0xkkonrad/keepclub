/* The importer as a person meets it: pick "your own deck", hand over a real
 * .apkg, read the receipt, study the cards, come back tomorrow.
 * usage: serve the sandbox on :8765, then  node importer-ui.mjs
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell';
const URL_ = process.env.MUNIN_URL || 'http://127.0.0.1:8765/projects/munin/web/';
const FIX = (n) => new URL(`./fixtures/${n}`, import.meta.url);

const out = [], fails = [];
const ok = (c, m) => (c ? out : fails).push((c ? 'PASS  ' : 'FAIL  ') + m);
/* Kept in step with ARM_MS in munin.js: how long an armed delete refuses a
 * confirm, so that one double-tap cannot be both taps. */
const ARM_MS = 400;

const b = await chromium.launch({ executablePath: EXE });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
await p.addInitScript(() => {
  const make = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);
  globalThis.__madeObjectUrls = 0;
  globalThis.__revokedObjectUrls = 0;
  URL.createObjectURL = (blob) => {
    globalThis.__madeObjectUrls++;
    return make(blob);
  };
  URL.revokeObjectURL = (url) => {
    globalThis.__revokedObjectUrls++;
    return revoke(url);
  };
});

/** Hand a file to the importer's <input>, which is what a drop resolves to. */
async function give(page, name) {
  const bytes = readFileSync(FIX(name));
  await page.setInputFiles('#imp-input', {
    name, mimeType: 'application/zip', buffer: bytes,
  });
}

await p.goto(URL_, { waitUntil: 'networkidle' });
await p.waitForSelector('.shelf.on');
await p.click('[data-byo]');
await p.waitForSelector('#imp-file');
ok(true, 'the "your own deck" tile opens the importer');
ok((await p.textContent('.imp-how')).toLowerCase().includes('file → export'),
  'it says where an .apkg comes from');

await give(p, 'legacy.apkg');
await p.waitForSelector('.imp .imp-book', { timeout: 20000 });
const receipt = await p.textContent('.imp .imp-book');
// The document has to reconcile: what was in the file = kept + dropped.
{
  const inFile = Number(/(\d+)\s*cards in the package/.exec(receipt)?.[1]);
  const kept = Number(/(\d+)\s*kept/.exec(receipt)?.[1]);
  const dropped = [...receipt.matchAll(/(\d+)\s*cards? dropped/g)].reduce((t, m) => t + Number(m[1]), 0);
  ok(inFile === 13 && kept === 11 && dropped === 2,
    `the receipt states the opening balance (${inFile} in the file, ${kept} kept, ${dropped} dropped)`);
  ok(inFile === kept + dropped, 'and the three numbers add up');
}
ok(/4 sections/.test(receipt) && /anki decks/.test(receipt),
  'it says what a section is, in Anki\u2019s words');
ok(/dropped/.test(receipt), 'it says what was dropped');
ok(/question side came out empty/.test(receipt), 'and why');
ok(/note type is missing/.test(receipt), 'including the card whose note type was absent');
ok(/gone\.png/.test(receipt), 'it names the picture the package did not contain');
ok(!/munin-front-side/.test(receipt) && !/[\u0000-\u0008]/.test(receipt),
  'the example of a dropped card is the deck\u2019s words, with none of Munin\u2019s plumbing');
ok(/scheduling does not come across/.test(receipt), 'it warns that scheduling is not carried over');
ok(/suspended/.test(receipt), 'it mentions the suspended card');
ok((await p.textContent('.imp-h')) === 'Sailing', 'the deck is named after what its decks share');

/* Nothing is stored until you say so. */
{
  const before = await p.evaluate(() => localStorage.getItem('munin/last-course'));
  ok(before === null, 'reading a package does not commit it');
}

{
  const loaded = p.waitForEvent('load');
  const savingFocus = await p.evaluate(() => {
    document.querySelector('[data-keep="new"]').click();
    const work = document.querySelector('.imp-work');
    const e = new KeyboardEvent('keydown',
      { key: 'Tab', bubbles: true, cancelable: true });
    dispatchEvent(e);
    return {
      status: work?.getAttribute('role'),
      closeDisabled: document.querySelector('.imp-x')?.disabled,
      active: document.activeElement === work,
      prevented: e.defaultPrevented,
    };
  });
  ok(savingFocus.status === 'status' && savingFocus.closeDisabled,
    'saving becomes a truthful, non-dismissible status');
  ok(savingFocus.active && savingFocus.prevented,
    'and its no-controls interval keeps keyboard focus inside the dialog');
  await loaded;
}
await p.waitForFunction(() => document.getElementById('boot').hidden, null, { timeout: 20000 });
ok((await p.textContent('#course-title')).trim() === 'Sailing', 'keeping it opens the deck');
const id = await p.evaluate(() => localStorage.getItem('munin/last-course'));
ok(/^local-[a-z0-9]+$/.test(id), `the imported deck becomes the resume target (${id})`);

/* The deck behaves like any other course. */
{
  ok((await p.textContent('body')).includes('11 cards'), 'the deck size is the imported one');
  await p.click('#study-all');
  await p.waitForSelector('#reveal-btn:visible');
  const q = await p.textContent('#card-q');
  ok(q.trim().length > 0, `a card shows its question ("${q.trim().slice(0, 40)}")`);
  await p.click('#reveal-btn');
  await p.waitForSelector('.grade[data-g="3"]:visible');
  const a = await p.textContent('#card-a');
  ok(a.trim().length > 0, 'and its answer');
  await p.click('.grade[data-g="3"]');
  await p.waitForSelector('#reveal-btn:visible');
  await p.click('#reveal-btn');
  await p.waitForSelector('.grade[data-g="3"]:visible');
  await p.click('.grade[data-g="3"]');
  await p.evaluate(() => writeNow());
  const st = await p.evaluate((k) => localStorage.getItem(`munin/${k}/state/v1`), id);
  ok(st && Object.keys(JSON.parse(st).recs || {}).length >= 2, 'answers are kept under the deck’s own key');
}

/* The account does not disappear when you start studying. */
{
  await p.click('[data-go="stats"], [data-nav="stats"], #nav-stats, .nav [data-screen="stats"]')
    .catch(() => p.evaluate(() => go('stats')));
  await p.waitForSelector('#s-stats:not([hidden])');
  const stats = await p.textContent('#s-stats');
  ok(/where this deck came from/i.test(stats), 'Progress keeps the import receipt');
  ok(/cards in the package/.test(stats) && /imported \d+ \w+ \d{4}/.test(stats),
    'with the same numbers and the date it arrived');
  await p.evaluate(() => go('home'));
}

/* Pictures and sound came out of the package and are served from the device. */
{
  // A cold Home boot has rendered no card, so none of the deck's Blobs should
  // have been pulled out of IndexedDB yet.
  await p.goto(URL_, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.getElementById('boot').hidden);
  const media = await p.evaluate(() => ({
    img: (DECK.cards.filter((c) => /<img[^>]+src="munin-media:/.test(c.q + c.a))).length,
    snd: (DECK.cards.filter((c) => /<audio[^>]+src="munin-media:/.test(c.q + c.a))).length,
    made: globalThis.__madeObjectUrls,
  }));
  ok(media.img === 1 && media.snd === 1,
    `the stored deck keeps one picture and one sound reference (${media.img}/${media.snd})`);
  ok(media.made === 0, `opening the deck does not eagerly load all media (${media.made} object URLs)`);
  const shown = await p.evaluate(async () => {
    const card = DECK.cards.find((c) => /<img/.test(c.q));
    startSession(card.s, { allNew: true });
    session.queue = [card.i];
    session.total = 1;
    showCard();
    const img = document.querySelector('#card-q img');
    for (let i = 0; i < 100 && !img.src.startsWith('blob:'); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const src = img.src;
    const r = await fetch(src);
    const b = await r.blob();
    return { type: b.type, size: b.size, src, made: globalThis.__madeObjectUrls };
  });
  ok(shown.size > 0 && shown.type === 'image/png',
    `the picture is a real png off the device (${shown.type}, ${shown.size} bytes)`);
  ok(shown.src.startsWith('blob:') && shown.made === 1,
    `only displayed media is resolved (${shown.made} object URL)`);

  const restored = await p.evaluate(async (old) => {
    dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    const img = document.querySelector('#card-q img');
    for (let i = 0; i < 100 && (!img.src.startsWith('blob:') || img.src === old); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const response = await fetch(img.src);
    return {
      old, src: img.src, size: (await response.blob()).size,
      made: globalThis.__madeObjectUrls, revoked: globalThis.__revokedObjectUrls,
    };
  }, shown.src);
  ok(restored.revoked === 1 && restored.made === 2
      && restored.src !== restored.old && restored.size > 0,
  `BFCache restore replaces revoked imported media (${restored.revoked} revoked, ${restored.made} made)`);

  // Native media controls own Space. The global study shortcut used to turn
  // this into a Good grade and finish the card instead of toggling playback.
  const audio = await p.evaluate(() => {
    const card = DECK.cards.find((c) => /<audio\b/.test(c.q + c.a));
    startSession(card.s, { allNew: true });
    session.queue = [card.i];
    session.total = 1;
    showCard();
    if (/<audio\b/.test(card.a)) reveal();
    return { id: card.i, records: Object.keys(state.recs).length };
  });
  await p.waitForSelector('#card-q audio, #card-a audio');
  await p.locator('#card-q audio, #card-a audio').focus();
  await p.keyboard.press(' ');
  const afterSpace = await p.evaluate(() => ({
    id: currentCard()?.i, records: Object.keys(state.recs).length, studying: current === 'study',
  }));
  ok(afterSpace.studying && afterSpace.id === audio.id && afterSpace.records === audio.records,
    'Space on native audio controls does not grade the flashcard');
  await p.evaluate(() => leaveStudy(false));
}

/* Re-importing the same deck: your progress is the thing at risk, so it is the
 * thing the screen is about. */
{
  await p.click('.shelf-btn');
  await p.waitForSelector('.shelf.on');
  ok((await p.locator('.shelf-row').count()) === 1, 'the imported deck sits on the shelf');
  await p.click('[data-byo]');
  await p.waitForSelector('#imp-file');
  await give(p, 'legacy.apkg');
  await p.waitForSelector('.imp .imp-book', { timeout: 20000 });
  ok(await p.locator('[data-keep="replace"]').isVisible(), 'it recognises a deck you already have');
  ok((await p.textContent('.imp-inner')).includes('keeping my progress'),
    'and offers to keep the progress');
  await Promise.all([p.waitForEvent('load'), p.click('[data-keep="replace"]')]);
  await p.waitForFunction(() => document.getElementById('boot').hidden, null, { timeout: 20000 });
  const kept = await p.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(`munin/${k}/state/v1`) || '{}');
    return Object.keys(s.recs || {}).length;
  }, id);
  ok(kept >= 2, `replacing a deck keeps what you had done (${kept} cards still answered)`);
  const count = await p.evaluate(async () => (await (await import('./lib/store.js')).list()).length);
  ok(count === 1, 'and does not leave a second copy behind');
}

/* A same-title but unrelated deck takes the explicit start-over path. */
{
  // Keep a second copy of the old account alive. It must hear the reset and
  // must not put its stale whole-document state back on pagehide.
  const stale = await ctx.newPage();
  await stale.goto(URL_, { waitUntil: 'networkidle' });
  await stale.waitForFunction(() => document.getElementById('boot').hidden);
  await p.click('.shelf-btn');
  await p.waitForSelector('.shelf.on');
  await p.click('[data-byo]');
  await p.waitForSelector('#imp-file');
  await give(p, 'replacement.apkg');
  await p.waitForSelector('.imp .imp-book', { timeout: 20000 });
  ok((await p.textContent('.imp-inner')).includes('start over'),
    'a same-title deck with different cards is identified as a fresh start');
  await Promise.all([p.waitForEvent('load'), p.click('[data-keep="replace"]')]);
  await p.waitForFunction(() => document.getElementById('boot').hidden, null, { timeout: 20000 });
  const fresh = await p.evaluate(() => ({
    records: Object.keys(state.recs).length,
    answers: state.answers,
    today: Object.values(state.days).reduce((a, n) => a + Number(n || 0), 0),
    streak: state.streak,
    achievements: Object.keys(state.ach).length,
  }));
  ok(Object.values(fresh).every((v) => v === 0),
    `start over clears the old deck's whole account (${JSON.stringify(fresh)})`);
  await stale.waitForFunction(() => document.getElementById('boot').hidden);
  await stale.evaluate(() =>
    dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  await p.waitForTimeout(100);
  const afterStaleLeave = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s ? { records: Object.keys(s.recs || {}).length, answers: s.answers } : null;
  });
  ok(!afterStaleLeave || (!afterStaleLeave.records && !afterStaleLeave.answers),
    `a stale tab cannot resurrect progress after start over (${JSON.stringify(afterStaleLeave)})`);
  await stale.close();
}

/* The modern format, through the same door. */
{
  await p.click('.shelf-btn');
  await p.waitForSelector('.shelf.on');
  await p.click('[data-byo]');
  await p.waitForSelector('#imp-file');
  await give(p, 'modern.apkg');
  await p.waitForSelector('.imp .imp-book', { timeout: 30000 });
  ok((await p.textContent('.imp-sub')).includes('current'), 'a current export is read as one');
  await p.click('[data-cancel]');
  ok((await p.locator('.imp').count()) === 0, 'throwing it away closes the importer');
}

/* Refusals say what is wrong. */
{
  await p.click('[data-byo]');
  await p.waitForSelector('#imp-file');
  await give(p, 'notzip.apkg');
  await p.waitForSelector('.imp-err', { timeout: 15000 });
  ok((await p.textContent('.imp-err')).includes('could not be read'), 'junk is refused in plain words');
  await p.click('[data-again]');
  await p.waitForSelector('#imp-file');
  ok(true, 'and you can try another file without starting over');
  await p.click('.imp-x');
}

/* The importer is a dialog: escape closes it and the shelf behind is inert. */
{
  await p.click('[data-byo]');
  await p.waitForSelector('#imp-file');
  ok(await p.evaluate(() => document.querySelector('.shelf')?.inert === true),
    'the shelf behind the importer is out of tab reach');
  let trapped = true;
  for (let i = 0; i < 8; i++) {
    await p.keyboard.press('Tab');
    trapped &&= await p.evaluate(() =>
      !!document.querySelector('.imp')?.contains(document.activeElement));
  }
  ok(trapped, 'Tab stays inside the importer dialog');
  await p.keyboard.press('Escape');
  ok((await p.locator('.imp').count()) === 0, 'escape closes the importer');
  ok(await p.evaluate(() => document.querySelector('.shelf')?.inert === false),
    'and the shelf is reachable again');
  const repeatEscape = await p.evaluate(() => {
    const e = new KeyboardEvent('keydown',
      { key: 'Escape', repeat: true, bubbles: true, cancelable: true });
    dispatchEvent(e);
    return { prevented: e.defaultPrevented, shelf: !!document.querySelector('.shelf.on') };
  });
  ok(repeatEscape.prevented && repeatEscape.shelf,
    'held Escape cannot cascade through the underlying shelf');
}

/* Removing a deck takes two taps and takes its history with it. */
{
  const staleRemoval = await ctx.newPage();
  await staleRemoval.goto(URL_, { waitUntil: 'networkidle' });
  await staleRemoval.waitForFunction(() => document.getElementById('boot').hidden);
  await staleRemoval.evaluate(() => startSession(null, {}));
  await p.waitForSelector('.shelf.on');
  await p.click('[data-del]');
  ok((await p.textContent('[data-del]')).trim() === 'remove?', 'the first tap asks');
  await p.click('.shelf-sub');
  ok((await p.textContent('[data-del]')).trim() === '\u2715',
    'touching anything else puts the armed delete away');
  await p.click('[data-del]');
  // A double-tap is one gesture, not two decisions. The confirm that lands
  // inside the guard is refused, and the deck is still there to prove it —
  // otherwise the whole arm/confirm dance is theatre a phone taps straight
  // through, and the progress goes with the deck.
  await p.click('[data-del]');
  ok((await p.evaluate(async () =>
    (await (await import('./lib/store.js')).list()).length)) === 1,
  'a second tap inside the guard leaves the deck alone');
  ok((await p.textContent('[data-del]')).trim() === 'remove?',
    'and it stays armed, waiting for a deliberate second tap');
  await p.waitForTimeout(ARM_MS + 50);
  // Removing the deck you are currently inside reloads: the session behind the
  // overlay is otherwise still running over a deck that no longer exists.
  await Promise.all([p.waitForEvent('load'), p.click('[data-del]')]);
  await p.waitForSelector('.shelf.on');
  const gone = await p.evaluate((k) => ({
    state: localStorage.getItem(`munin/${k}/state/v1`),
    last: localStorage.getItem('munin/last-course'),
  }), id);
  ok(gone.state === null, 'the second tap takes the deck and its history');
  ok(gone.last === null, 'and it stops being the deck you resume into');
  const left = await p.evaluate(async () => (await (await import('./lib/store.js')).list()).length);
  ok(left === 0, 'and the database is empty again');
  await staleRemoval.waitForSelector('.shelf.on');
  await staleRemoval.evaluate(() =>
    dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  const stayedGone = await p.evaluate((k) =>
    localStorage.getItem(`munin/${k}/state/v1`), id);
  ok(stayedGone === null,
    'an open study tab cannot recreate a removed deck’s orphaned progress');
  await staleRemoval.close();
}

/* Built-in courses are untouched by any of this. */
{
  await p.goto(URL_, { waitUntil: 'networkidle' });
  await p.waitForSelector('.shelf.on');
  ok((await p.locator('.shelf-tile:not(.byo)').count()) === 2, 'the two courses are still there');
  ok((await p.evaluate(() => localStorage.getItem('rya-ds/v1'))) === null,
    "the live Day Skipper app's storage is never touched");
}

ok(errors.length === 0, `no uncaught errors in the whole run (${errors.slice(0, 2).join(' | ') || 'none'})`);

/* A committed deck remains usable if only the resume-pointer write fails. */
{
  const cq = await b.newContext({ viewport: { width: 390, height: 844 },
    serviceWorkers: 'block' });
  const pq = await cq.newPage();
  const qerrors = [];
  pq.on('pageerror', (e) => qerrors.push(String(e)));
  await pq.goto(URL_, { waitUntil: 'networkidle' });
  await pq.waitForSelector('.shelf.on');
  await pq.click('[data-byo]');
  await give(pq, 'legacy.apkg');
  await pq.waitForSelector('.imp .imp-book', { timeout: 20000 });
  await pq.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'munin/last-course') throw new DOMException('full', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  });
  await pq.click('[data-keep="new"]');
  const opened = await pq.waitForFunction(() =>
    document.getElementById('boot').hidden
      && document.getElementById('course-title').textContent.trim() === 'Sailing',
  null, { timeout: 8000 }).then(() => true, () => false);
  const committed = await pq.evaluate(async () =>
    (await (await import('./lib/store.js')).list()).length);
  ok(opened && committed === 1 && (await pq.locator('.imp').count()) === 0,
    'a resume-pointer quota error cannot strand a successfully saved deck');
  ok(qerrors.length === 0,
    `resume-pointer recovery has no unhandled rejection (${qerrors.join(' | ') || 'none'})`);
  await cq.close();
}

/* Database deletion stays truthful when best-effort history cleanup is blocked. */
{
  const cr = await b.newContext({ viewport: { width: 390, height: 844 },
    serviceWorkers: 'block' });
  const pr = await cr.newPage();
  await pr.goto(URL_, { waitUntil: 'networkidle' });
  await pr.waitForSelector('.shelf.on');
  await pr.click('[data-byo]');
  await give(pr, 'legacy.apkg');
  await pr.waitForSelector('.imp .imp-book', { timeout: 20000 });
  await Promise.all([pr.waitForEvent('load'), pr.click('[data-keep="new"]')]);
  await pr.waitForFunction(() => document.getElementById('boot').hidden);
  const rid = await pr.evaluate(() => localStorage.getItem('munin/last-course'));
  await pr.evaluate((id) => {
    localStorage.setItem(`munin/${id}/state/v1`, '{"v":1}');
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (key === `munin/${id}/state/v1`) throw new DOMException('blocked', 'SecurityError');
      return remove.call(this, key);
    };
  }, rid);
  await pr.click('.shelf-btn');
  await pr.waitForSelector('.shelf.on');
  await pr.click(`[data-del="${rid}"]`);
  await pr.waitForTimeout(ARM_MS + 50);
  await pr.click(`[data-del="${rid}"]`);
  await pr.waitForTimeout(500);
  const removal = await pr.evaluate(async (id) => ({
    decks: (await (await import('./lib/store.js')).list()).length,
    tile: !!document.querySelector(`[data-course="${id}"]`),
  }), rid);
  ok(removal.decks === 0 && !removal.tile,
    'a committed database deletion cannot leave a ghost shelf tile');
  await cr.close();
}

await b.close();
console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
