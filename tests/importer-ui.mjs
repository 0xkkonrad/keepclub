/* The importer as a person meets it: pick "your own deck", hand over a real
 * .apkg, read the receipt, study the cards, come back tomorrow.
 * usage: serve the sandbox on :8765, then  node importer-ui.mjs
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || chromium.executablePath();
const URL_ = process.env.MUNIN_URL || 'http://127.0.0.1:8777/projects/keepclub/web/';
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
  'the example of a dropped card is the deck\u2019s words, with none of keep club\u2019s plumbing');
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
  await p.click('#study-back');
  await p.waitForSelector('#study-all:visible');
  await p.click('[data-go="stats"]');
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
    img: (DECK.cards.filter((c) =>
      /<img[^>]+src="munin-media:/.test(c.front + (c.back || '')))).length,
    snd: (DECK.cards.filter((c) =>
      /<audio[^>]+src="munin-media:/.test(c.front + (c.back || '')))).length,
    made: globalThis.__madeObjectUrls,
    schemaVersion: DECK.schemaVersion,
    courseId: DECK.courseId,
    descriptiveCard: Object.hasOwn(DECK.cards[0], 'cardId')
      && !Object.hasOwn(DECK.cards[0], 'i'),
  }));
  ok(media.img === 1 && media.snd === 1,
    `the stored deck keeps one picture and one sound reference (${media.img}/${media.snd})`);
  ok(media.made === 0, `opening the deck does not eagerly load all media (${media.made} object URLs)`);
  ok(media.schemaVersion === 2 && /^local-/.test(media.courseId) && media.descriptiveCard,
    'an IndexedDB-backed Anki course is normalized before runtime use');
  const shown = await p.evaluate(async () => {
    const card = DECK.cards.find((c) => /<img/.test(c.front));
    startSession(card.sectionId, { allNew: true });
    session.queue = [card.cardId];
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
    const card = DECK.cards.find((c) => /<audio\b/.test(c.front + (c.back || '')));
    startSession(card.sectionId, { allNew: true });
    session.queue = [card.cardId];
    session.total = 1;
    showCard();
    if (/<audio\b/.test(card.back || '')) reveal();
    return { id: card.cardId, records: Object.keys(state.recs).length };
  });
  await p.waitForSelector('#card-q audio, #card-a audio');
  await p.locator('#card-q audio, #card-a audio').focus();
  await p.keyboard.press(' ');
  const afterSpace = await p.evaluate(() => ({
    id: currentCard()?.cardId, records: Object.keys(state.recs).length, studying: current === 'study',
  }));
  ok(afterSpace.studying && afterSpace.id === audio.id && afterSpace.records === audio.records,
    'Space on native audio controls does not grade the flashcard');
  await p.evaluate(() => leaveStudy(false));
}

/* Re-importing the same deck: your progress is the thing at risk, so it is the
 * thing the screen is about — along with the other thing in this deck that only
 * this device has, which no file being imported can put back. */
{
  // One of each kind of record, so the layer under this deck holds both a card
  // that exists because somebody typed it and an edit over a card the file
  // brought.
  const mine = await p.evaluate(async () => {
    const shipped = DECK.cards[0].cardId;
    const wrote = await writeCard({ front: 'A card I wrote into an imported deck' });
    const fixed = await editCard(shipped, { front: 'Fixed by me before the re-import' });
    writeNow();
    return { ok: wrote.ok && fixed.ok, id: wrote.id, shipped };
  });
  ok(mine.ok, 'a card written into the imported deck, and one of its own edited');
  await p.click('.shelf-btn');
  await p.waitForSelector('.shelf.on');
  ok((await p.locator('.shelf-row').count()) === 1, 'the imported deck sits on the shelf');
  await p.click('[data-byo]');
  await p.waitForSelector('#imp-file');
  await give(p, 'legacy.apkg');
  await p.waitForSelector('.imp .imp-book', { timeout: 20000 });
  ok(await p.locator('[data-keep="replace"]').isVisible(), 'it recognises a deck you already have');
  const said = await p.textContent('.imp-inner');
  ok(said.includes('keeping my progress'), 'and offers to keep the progress');
  ok(/written or edited 2 cards in this deck/.test(said) && /Yours are kept/.test(said),
    `the receipt accounts for the cards only this device has (${
      /You have written[^.]*\.[^.]*\./.exec(said)?.[0] || said.slice(0, 90)})`);
  await Promise.all([p.waitForEvent('load'), p.click('[data-keep="replace"]')]);
  await p.waitForFunction(() => document.getElementById('boot').hidden, null, { timeout: 20000 });
  const kept = await p.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(`munin/${k}/state/v1`) || '{}');
    return Object.keys(s.recs || {}).length;
  }, id);
  ok(kept >= 2, `replacing a deck keeps what you had done (${kept} cards still answered)`);
  const layer = await p.evaluate((k) => {
    const doc = JSON.parse(localStorage.getItem(`munin/${k}/cards/v1`) || 'null');
    return doc ? Object.values(doc.cards).filter((rec) => rec.front).length : 0;
  }, id);
  const drawn = await p.evaluate((m) => ({
    written: !!byId.get(m.id),
    fixed: /Fixed by me/.test(byId.get(m.shipped)?.front || ''),
  }), mine);
  ok(layer === 2 && drawn.written && drawn.fixed,
    `and keeps them, in the deck as well as in the document (${layer} records)`);
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
  const said = await p.textContent('.imp-inner');
  ok(said.includes('start over'),
    'a same-title deck with different cards is identified as a fresh start');
  // The other replace kept them and said so. This one cannot: the records are
  // keyed by the outgoing deck's card ids, so what would survive is edits over
  // nothing and cards written into a deck that is not here any more.
  ok(/written or edited 2 cards in this deck/.test(said)
      && /Starting over takes them/.test(said) && /export a backup/.test(said),
  `and says the cards you wrote go with the progress, and where to put them first (${
    /You have written[^.]*\.[^.]*\./.exec(said)?.[0] || said.slice(0, 90)})`);
  await Promise.all([p.waitForEvent('load'), p.click('[data-keep="replace"]')]);
  await p.waitForFunction(() => document.getElementById('boot').hidden, null, { timeout: 20000 });
  const layerGone = await p.evaluate((k) =>
    localStorage.getItem(`munin/${k}/cards/v1`), id);
  ok(layerGone === null,
    'start over takes the layer with the account, as the line above the button said');
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
  const refusalFocus = await p.evaluate(() => ({
    role: document.querySelector('.imp-err')?.getAttribute('role'),
    focused: document.activeElement === document.querySelector('.imp-err'),
  }));
  ok(refusalFocus.role === 'alert' && refusalFocus.focused,
    'an import refusal is announced and keeps meaningful focus inside the dialog');
  await p.click('[data-again]');
  await p.waitForSelector('#imp-file');
  ok(await p.evaluate(() => document.activeElement?.id === 'imp-file'),
    'trying another file returns focus to the picker');
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

/* Removing a deck takes two taps and takes both of its documents with it. */
{
  // Erasing progress deliberately keeps the layer and says so; removing the
  // deck is the one thing that takes it, because there is nothing left for it
  // to be a layer over.
  const wrote = await p.evaluate(async () => {
    const card = await writeCard({ front: 'A card in a deck about to go' });
    return card.ok;
  });
  ok(wrote, 'a card written into the deck that is about to be removed');
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
    cards: localStorage.getItem(`munin/${k}/cards/v1`),
    last: localStorage.getItem('munin/last-course'),
  }), id);
  ok(gone.state === null, 'the second tap takes the deck and its history');
  ok(gone.cards === null, 'and the cards written into it, which nothing else now describes');
  ok(gone.last === null, 'and it stops being the deck you resume into');
  const left = await p.evaluate(async () => (await (await import('./lib/store.js')).list()).length);
  ok(left === 0, 'and the database is empty again');
  await staleRemoval.waitForSelector('.shelf.on');
  await staleRemoval.evaluate(() =>
    dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  const stayedGone = await p.evaluate((k) => ({
    state: localStorage.getItem(`munin/${k}/state/v1`),
    cards: localStorage.getItem(`munin/${k}/cards/v1`),
  }), id);
  ok(stayedGone.state === null && stayedGone.cards === null,
    'an open study tab cannot recreate a removed deck’s orphaned documents');
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

/* A deck of your own, made by its first card.
 *
 * The second path on this same screen, beside choosing a file rather than
 * instead of it. A course with no cards is a document the reader refuses, so
 * the deck cannot exist before the card does — which makes the two things worth
 * proving here that nothing is written until Save, and that a deck standing
 * next to it keeps its pictures when it is: store.put() clears a deck's whole
 * media range before writing, and the creation path hands it an empty list. */
{
  const cw = await b.newContext({ viewport: { width: 390, height: 844 } });
  const pw = await cw.newPage();
  const werrors = [];
  pw.on('pageerror', (e) => werrors.push(String(e)));
  /* Every [deck, index] key in the media store, straight out of the database:
   * the question is whether another deck's pictures are still there, and the
   * app's own resolver would only answer it one index at a time. */
  const mediaKeys = () => pw.evaluate(() => new Promise((res, rej) => {
    const open = indexedDB.open('munin', 1);
    open.onerror = () => rej(open.error);
    open.onsuccess = () => {
      const q = open.result.transaction('media').objectStore('media').getAllKeys();
      q.onsuccess = () => res(q.result.map((key) => key.join(' / ')).sort());
      q.onerror = () => rej(q.error);
    };
  }));
  await pw.goto(URL_, { waitUntil: 'networkidle' });
  await pw.waitForSelector('.shelf.on');

  // A deck with pictures and sound in it, standing beside the one about to be
  // made.
  await pw.click('[data-byo]');
  await pw.waitForSelector('#imp-file');
  await give(pw, 'legacy.apkg');
  await pw.waitForSelector('.imp .imp-book', { timeout: 20000 });
  await Promise.all([pw.waitForEvent('load'), pw.click('[data-keep="new"]')]);
  await pw.waitForFunction(() => document.getElementById('boot').hidden, null, { timeout: 20000 });
  const neighbourMedia = await mediaKeys();
  ok(neighbourMedia.length > 0,
    `the imported deck beside it holds media (${neighbourMedia.join(', ')})`);

  await pw.click('.shelf-btn');
  await pw.waitForSelector('.shelf.on');
  await pw.click('[data-byo]');
  await pw.waitForSelector('#imp-mine');
  ok((await pw.textContent('#imp-mine')).toLowerCase().includes('first card'),
    'the pick screen offers writing your own cards beside choosing a file');
  ok(await pw.locator('#imp-file').isVisible(),
    'and it is a second path on that screen, not a replacement for the first');
  await pw.click('#imp-mine');
  await pw.waitForSelector('#byo-deck-name');

  // The two boxes are the card sheet's own, cloned. If that clone ever stopped
  // renaming what it copies, the labels here would point at the sheet's hidden
  // boxes instead of these ones.
  {
    const sheet = await pw.evaluate(() => {
      const seen = new Set(), dupes = [];
      for (const el of document.querySelectorAll('[id]')) {
        if (seen.has(el.id)) dupes.push(el.id);
        seen.add(el.id);
      }
      return {
        dupes,
        labels: [...document.querySelectorAll('.imp-own label[for]')]
          .map((l) => l.textContent.trim() + ' → ' + (document.getElementById(l.htmlFor)
            ? l.htmlFor : 'nothing')),
        fine: document.querySelector('.imp-own .sheet-fine')?.textContent || '',
        says: document.querySelector('.imp-sub')?.textContent || '',
      };
    });
    ok(sheet.dupes.length === 0,
      `borrowing the card sheet's form leaves no two elements sharing an id (${sheet.dupes.join(', ') || 'none'})`);
    ok(sheet.labels.length === 3 && sheet.labels.every((l) => !l.endsWith('nothing')),
      `the name and the two boxes each have a label of their own (${sheet.labels.join(' · ')})`);
    ok(/\*\*strong\*\*/.test(sheet.fine),
      'and the sheet’s own line about what Markdown does comes with them');
    ok(/stays on this device/.test(sheet.says) && /does not sync/.test(sheet.says)
        && /backup/.test(sheet.says),
    `it says plainly where a deck you write lives (${sheet.says.replace(/\s+/g, ' ')})`);
  }

  // Nothing is written until the card is.
  await pw.fill('#byo-deck-name', 'Thrown away');
  await pw.fill('#byo-card-front', 'A question nobody kept');
  await pw.click('#byo-card-cancel');
  await pw.waitForSelector('#imp-file');
  await pw.click('.imp-x');
  await pw.waitForSelector('.shelf.on');
  ok((await pw.evaluate(async () =>
    (await (await import('./lib/store.js')).list()).length)) === 1,
  'a creation called off halfway leaves no deck behind');
  ok((await pw.locator('.shelf-row').count()) === 1, 'and no tile on the shelf');

  await pw.click('[data-byo]');
  await pw.waitForSelector('#imp-mine');
  await pw.click('#imp-mine');
  await pw.waitForSelector('#byo-deck-name');
  await pw.click('#byo-card-save');
  ok((await pw.textContent('#byo-card-say')) === 'A deck needs a name.',
    'a deck with no name is refused, and named as the reason');
  await pw.fill('#byo-deck-name', 'Knots I keep forgetting');
  await pw.click('#byo-card-save');
  ok((await pw.textContent('#byo-card-say')) === 'A card needs a question.',
    'and so is a deck with no card in it, in the sheet’s own words');

  // The reader every course in this app goes through is the one that decides,
  // and it is its own message that is printed.
  await pw.fill('#byo-card-front', '[the format](javascript:alert(1))');
  await pw.click('#byo-card-save');
  await pw.waitForFunction(() =>
    /https/.test(document.getElementById('byo-card-say').textContent), null, { timeout: 8000 });
  const refused = await pw.textContent('#byo-card-say');
  ok(/^Question — /.test(refused) && /mailto/.test(refused),
    `a side the reader will not take is refused in the reader's own words (${refused})`);
  ok((await pw.evaluate(async () =>
    (await (await import('./lib/store.js')).list()).length)) === 1,
  'and a card that would not read wrote no deck');

  await pw.fill('#byo-card-front', 'What knot **joins** two ropes of a size?');
  await pw.fill('#byo-card-back', 'A sheet bend.');
  await pw.click('#byo-card-save');
  await pw.waitForSelector('[data-open]', { timeout: 15000 });
  const made = await pw.evaluate(() => document.querySelector('.imp-body').textContent);
  ok(/Knots I keep forgetting/.test(made) && /one card/.test(made),
    'the deck is made, and the screen says what it holds');
  ok(/Browse is where you write the next card/.test(made) && /does not sync/.test(made),
    'and where the second card goes, and that this one stays here');
  ok((await mediaKeys()).join(', ') === neighbourMedia.join(', '),
    'the imported deck standing beside it keeps every one of its pictures');

  // "back to your decks" has to reach a shelf that knows about it: the one
  // behind this sheet was drawn before the deck existed.
  await Promise.all([pw.waitForEvent('load'), pw.click('[data-shelf]')]);
  await pw.waitForSelector('.shelf.on');
  const shelved = await pw.$$eval('.shelf-row .shelf-tile b', (ns) => ns.map((x) => x.textContent));
  ok(shelved.includes('Knots I keep forgetting'),
    `and the deck is on the shelf the way out of the sheet leads to (${shelved.join(' | ')})`);
  ok(shelved.length === 2, 'beside the one that was already there');
  const madeRow = await pw.$$eval('.shelf-row .shelf-tile small', (ns) => ns.map((x) => x.textContent));
  ok(madeRow.some((t) => /· 1 card ·/.test(t)),
    `its row counts one card rather than one cards (${madeRow.join(' | ')})`);

  const ownId = await pw.evaluate(async () => (await (await import('./lib/store.js')).list())
    .find((d) => d.importFormat === 'own').id);
  await Promise.all([pw.waitForEvent('load'), pw.click(`[data-course="${ownId}"]`)]);
  await pw.waitForFunction(() => document.getElementById('boot').hidden, null, { timeout: 20000 });
  await pw.waitForFunction(() => document.getElementById('boot').hidden, null, { timeout: 20000 });
  ok(/^local-[a-z0-9]+$/.test(ownId) && (await pw.textContent('#course-title')).trim()
      === 'Knots I keep forgetting', `it opens as a deck like any other (${ownId})`);

  // Studied straight away, off the document the creation path wrote — with the
  // Markdown rendered, which is the whole reason the deck is stored as typed.
  await pw.click('#study-all');
  await pw.waitForSelector('#reveal-btn:visible');
  ok(/<strong>joins<\/strong>/.test(await pw.innerHTML('#card-q')),
    'the card it was made by is studied immediately, as Markdown rendered once');
  await pw.click('#reveal-btn');
  await pw.waitForSelector('.grade[data-g="3"]:visible');
  ok((await pw.textContent('#card-a')).trim() === 'A sheet bend.', 'and it reveals its answer');
  await pw.click('.grade[data-g="3"]');
  await pw.waitForTimeout(300);
  await pw.evaluate(() => writeNow());

  // The second card is the layer over it — the same layer every other deck in
  // this app has, which is what keeps the model to one shape.
  const second = await pw.evaluate(async () => {
    const wrote = await writeCard({ front: 'What knot makes a fixed loop?', back: 'A bowline.' });
    return {
      ok: wrote.ok,
      cards: DECK.cards.length,
      yours: DECK.cards.filter((c) => c._yours === true).length,
      layer: Object.keys(JSON.parse(localStorage.getItem(CARDS_KEY)).cards).length,
    };
  });
  const inDocument = await pw.evaluate(async (id) =>
    (await (await import('./lib/store.js')).get(id)).deck.cards.length, ownId);
  ok(second.ok && second.cards === 2, `a second card joins the deck (${second.cards} cards)`);
  ok(second.layer === 1 && inDocument === 1,
    'the card that made the deck is in the deck’s document and the next one is in the layer');
  ok(second.yours === 2, 'and both of them read as cards you wrote');

  // And out again, taking both documents with it.
  await pw.click('.shelf-btn');
  await pw.waitForSelector('.shelf.on');
  await pw.click(`[data-del="${ownId}"]`);
  await pw.waitForTimeout(ARM_MS + 50);
  await Promise.all([pw.waitForEvent('load'), pw.click(`[data-del="${ownId}"]`)]);
  await pw.waitForFunction(() => document.getElementById('boot').hidden
      || !!document.querySelector('.shelf.on'), null, { timeout: 20000 });
  const orphans = await pw.evaluate(async (id) => ({
    decks: (await (await import('./lib/store.js')).list()).map((d) => d.id),
    state: localStorage.getItem(`munin/${id}/state/v1`),
    cards: localStorage.getItem(`munin/${id}/cards/v1`),
    last: localStorage.getItem('munin/last-course'),
  }), ownId);
  ok(!orphans.decks.includes(ownId), 'removing it takes the deck');
  ok(orphans.state === null && orphans.cards === null,
    'and both of the documents it left in local storage');
  ok(orphans.last !== ownId, 'and it stops being the deck you resume into');
  ok((await mediaKeys()).join(', ') === neighbourMedia.join(', '),
    'while the deck beside it still has its pictures at the end of all of it');
  ok(werrors.length === 0,
    `writing a deck of your own raises no page errors (${werrors.slice(0, 2).join(' | ') || 'none'})`);
  await cw.close();
}

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

/* A deck you wrote here is not something a file replaces.
 *
 * Both rulings about replacing are about a deck a file could be another copy
 * of: the same deck again keeps the layer, a different deck under the same name
 * takes it and starts over. A deck of your own carries no sourceCourseId — no
 * file is an update to one — so it could only ever land on the second, and that
 * one deletes the deck's own document along with the layer. That document IS
 * the cards, and nothing puts it back: the backup file is per-course and holds
 * the history, the notes and the layer, never the deck. So a file that merely
 * shares its name is a different deck, and a different deck is a second row.
 */
{
  const co = await b.newContext({ viewport: { width: 390, height: 844 } });
  const po = await co.newPage();
  const oerrors = [];
  po.on('pageerror', (e) => oerrors.push(String(e)));
  await po.goto(URL_, { waitUntil: 'networkidle' });
  await po.waitForSelector('.shelf.on');

  // A deck of your own, named after the deck inside legacy.apkg, with a second
  // card written into its layer on top of the one that made it.
  await po.click('[data-byo]');
  await po.waitForSelector('#imp-mine');
  await po.click('#imp-mine');
  await po.waitForSelector('#byo-deck-name');
  await po.fill('#byo-deck-name', 'Sailing');
  await po.fill('#byo-card-front', 'The card that made my deck');
  await po.fill('#byo-card-back', 'Its answer.');
  await po.click('#byo-card-save');
  await po.waitForSelector('[data-open]', { timeout: 15000 });
  await Promise.all([po.waitForEvent('load'), po.click('[data-open]')]);
  await po.waitForFunction(() => document.getElementById('boot').hidden, null, { timeout: 20000 });
  await po.evaluate(async () => {
    await writeCard({ front: 'A second card, in the layer' });
    writeNow();
  });
  const ownId = await po.evaluate(() => COURSE.id);

  // The shelf counts the deck as it is now, not as the record was written. The
  // deck's own record still says one card and cannot be rewritten — store.put()
  // clears a deck's whole media range before it writes — so the row reads the
  // layer beside it.
  await po.click('.shelf-btn');
  await po.waitForSelector('.shelf.on');
  const row = await po.$$eval('.shelf-row .shelf-tile small', (ns) => ns.map((x) => x.textContent));
  const record = await po.evaluate(async (id) =>
    (await (await import('./lib/store.js')).get(id)).cards, ownId);
  ok(row.some((t) => /2 cards/.test(t)),
    `the shelf row counts the cards written into a deck since (${row.join(' | ')})`);
  ok(record === 1,
    `without rewriting the deck record, which would take its pictures with it (${record})`);

  // And now a file called Sailing.
  await po.click('[data-byo]');
  await po.waitForSelector('#imp-file');
  await give(po, 'legacy.apkg');
  await po.waitForSelector('.imp .imp-book', { timeout: 20000 });
  const offered = await po.$$eval('.imp-acts button', (ns) => ns.map((x) => x.textContent.trim()));
  const receipt = await po.evaluate(() => document.querySelector('.imp-body').innerText);
  ok(!offered.some((t) => /replace/.test(t)),
    `a file sharing a name with a deck you wrote offers no replace (${offered.join(' | ')})`);
  ok(!/already have a deck called/.test(receipt),
    'and does not claim to have seen this deck before');

  await Promise.all([po.waitForEvent('load'), po.click('[data-keep="new"]')]);
  await po.waitForFunction(() => document.getElementById('boot').hidden, null, { timeout: 20000 });
  await po.click('.shelf-btn');
  await po.waitForSelector('.shelf.on');
  const both = await po.evaluate(async (id) => {
    const decks = await (await import('./lib/store.js')).list();
    return {
      count: decks.length,
      own: decks.some((d) => d.id === id && d.importFormat === 'own'),
      layer: localStorage.getItem(`munin/${id}/cards/v1`),
    };
  }, ownId);
  ok(both.count === 2 && both.own,
    `the deck somebody wrote is still there beside the one just imported (${both.count} decks)`);
  ok(both.layer && Object.keys(JSON.parse(both.layer).cards).length === 1,
    'with the card written into it still in its layer');
  ok(oerrors.length === 0,
    `a file beside a deck of your own raises no page errors (${oerrors.slice(0, 2).join(' | ') || 'none'})`);
  await co.close();
}

await b.close();
console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
