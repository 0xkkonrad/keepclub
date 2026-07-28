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

await Promise.all([p.waitForEvent('load'), p.click('[data-keep="new"]')]);
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
  await p.goto(URL_, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.getElementById('boot').hidden);
  const media = await p.evaluate(() => ({
    img: (DECK.cards.filter((c) => /<img[^>]+src="blob:/.test(c.q + c.a))).length,
    snd: (DECK.cards.filter((c) => /<audio[^>]+src="blob:/.test(c.q + c.a))).length,
    left: DECK.cards.filter((c) => /munin-media:/.test(c.q + c.a)).length,
  }));
  ok(media.img === 1 && media.snd === 1, `the picture and the sound are wired up (${media.img}/${media.snd})`);
  ok(media.left === 0, 'no placeholder is left unresolved');
  const shown = await p.evaluate(async () => {
    const card = DECK.cards.find((c) => /<img/.test(c.q));
    const src = /src="([^"]+)"/.exec(card.q)[1];
    const r = await fetch(src);
    const b = await r.blob();
    return { type: b.type, size: b.size };
  });
  ok(shown.size > 0 && shown.type === 'image/png',
    `the picture is a real png off the device (${shown.type}, ${shown.size} bytes)`);
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
  await p.keyboard.press('Escape');
  ok((await p.locator('.imp').count()) === 0, 'escape closes the importer');
  ok(await p.evaluate(() => document.querySelector('.shelf')?.inert === false),
    'and the shelf is reachable again');
}

/* Removing a deck takes two taps and takes its history with it. */
{
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
}

/* Built-in courses are untouched by any of this. */
{
  await p.goto(URL_, { waitUntil: 'networkidle' });
  await p.waitForSelector('.shelf.on');
  ok((await p.locator('.shelf-tile:not(.byo)').count()) === 2, 'the two courses are still there');
  ok((await p.evaluate(() => localStorage.getItem('rya-ds/v1'))) === null,
    "the live Day Skipper app's storage is never touched");
}

/* Two copies of one deck are told apart by what is on each of them.
 *
 * "keep both" is offered on the very screen that has just established the two
 * files are the same deck, and it used to leave two rows identical down to the
 * pixel: the name, the card count, the date and even the raven are all worked
 * out from the deck. Removing the wrong one is two taps and there is no undo,
 * and neither row said which one held the answers. */
{
  const rows = () => p.evaluate(() =>
    [...document.querySelectorAll('.shelf-row .shelf-tile small')].map((s) => s.textContent));
  await p.click('[data-byo]');
  await p.waitForSelector('#imp-file');
  await give(p, 'legacy.apkg');
  await p.waitForSelector('.imp .imp-book', { timeout: 20000 });
  await Promise.all([p.waitForEvent('load'), p.click('[data-keep="new"]')]);
  await p.waitForFunction(() => document.getElementById('boot').hidden, null, { timeout: 20000 });
  await p.click('.shelf-btn');
  await p.waitForSelector('.shelf.on');
  const one = await rows();
  ok(one.length === 1 && /not started/.test(one[0]),
    `a deck nobody has opened says so (${one[0]})`);
  await p.click('#shelf-x');

  await p.click('#study-all');
  for (let i = 0; i < 2; i++) {
    await p.waitForSelector('#reveal-btn:visible');
    await p.click('#reveal-btn');
    await p.waitForSelector('.grade[data-g="3"]:visible');
    await p.click('.grade[data-g="3"]');
  }
  await p.evaluate(() => writeNow());
  await p.click('#end-btn');
  await p.waitForSelector('.shelf-btn', { state: 'visible' });

  await p.click('.shelf-btn');
  await p.waitForSelector('.shelf.on');
  await p.click('[data-byo]');
  await p.waitForSelector('#imp-file');
  await give(p, 'legacy.apkg');
  await p.waitForSelector('.imp .imp-book', { timeout: 20000 });
  ok(await p.locator('[data-keep="new"]').isVisible(), 'the same file again offers to keep both');
  await Promise.all([p.waitForEvent('load'), p.click('[data-keep="new"]')]);
  await p.waitForFunction(() => document.getElementById('boot').hidden, null, { timeout: 20000 });
  await p.click('.shelf-btn');
  await p.waitForSelector('.shelf.on');
  const two = await rows();
  ok(two.length === 2, `keeping both leaves two rows (${two.length})`);
  ok(two[0] !== two[1], `and they do not read the same (${two.join('  //  ')})`);
  ok(two.some((t) => /2 answered/.test(t)) && two.some((t) => /not started/.test(t)),
    'one of them holds your answers and says how many, the other says it is untouched');

  // A state key that cannot be read is not a claim about anything: the row goes
  // back to saying nothing rather than reporting "not started" over the top of
  // work that may well be there.
  const ids = await p.evaluate(async () =>
    (await (await import('./lib/store.js')).list()).map((d) => d.id));
  await p.evaluate((k) => localStorage.setItem(`munin/${k}/state/v1`, '{not json'), ids[0]);
  await p.click('#shelf-x');
  await p.click('.shelf-btn');
  await p.waitForSelector('.shelf.on');
  const junk = await rows();
  ok(junk.some((t) => !/answered|not started/.test(t)),
    `an unreadable state key makes the row quiet, not wrong (${junk.join('  //  ')})`);
}

ok(errors.length === 0, `no uncaught errors in the whole run (${errors.slice(0, 2).join(' | ') || 'none'})`);

await b.close();
console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
