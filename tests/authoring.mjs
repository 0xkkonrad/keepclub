/* Cards you write, as the layer underneath the editor and as the editor itself:
 * a card of your own in a deck the app ships, an edit over a card the course
 * wrote, a card taken out, and every one of them still there after a reload —
 * then the same things again through the sheet, the Browse rows and the study
 * dock, which is where a person actually meets them.
 *
 * Browser-level like the notes suite, and for the same reason: none of this
 * lives in one function. A card is written through the single-writer rule,
 * stored in its own per-deck document, rendered from Markdown to sanitized HTML
 * by the course reader, merged into DECK.cards before the indexes are built,
 * and re-validated by the load sanitiser on the way back.
 *
 * The last case in the layer half is the one that matters most: the boot sweep
 * deletes review history for every card it cannot find, so a cards document
 * that will not open must stop the sweep rather than feed it.
 */
import { chromium } from 'playwright-core';

const EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || chromium.executablePath();
const URL = process.env.MUNIN_URL || 'http://127.0.0.1:8777/projects/keepclub/web/';
const out = [], fails = [];
const ok = (c, m) => (c ? out : fails).push((c ? 'PASS  ' : 'FAIL  ') + m);
const b = await chromium.launch({ executablePath: EXE });

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

/* One course of our own at the fetch boundary, the way front-only-ui.mjs does
 * it. The structural refusals are about the shape of a deck — the only card in
 * it, the last card in a section — and asserting them against a 537-card
 * syllabus would mean building the shape by taking 536 cards out of it. */
async function fixturePage(course, id = 'day-skipper') {
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(`**/courses/${id}/cards.json`, (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify(course),
  }));
  await page.goto(URL + '?course=' + id, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  return { ctx, page, errors };
}

const reload = async (page) => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
};

/** Browse, narrowed to something, because the unnarrowed screen is the index of
 *  sections rather than a list of rows. */
async function browseFor(page, query) {
  await page.click('[data-go="browse"]');
  await page.fill('#search', query);
  await page.waitForFunction((text) =>
    document.getElementById('browse-count').textContent.length > 0
      && document.getElementById('search').value === text, query);
  await page.waitForTimeout(200);
}

/** Every native confirm this page raises, answered, with what it asked kept.
 *  `accept` is on the returned object so one watcher can say yes to the first
 *  question and no to the next. */
function watchDialogs(page) {
  const watcher = { asked: [], accept: true };
  page.on('dialog', (d) => {
    watcher.asked.push(d.message());
    if (watcher.accept) d.accept(); else d.dismiss();
  });
  return watcher;
}

const sheetOpen = (page) => page.waitForSelector('#card-sheet:not([hidden])');
const sheetShut = (page) => page.waitForFunction(() =>
  document.getElementById('card-sheet').hidden);

/** The stored document, as JSON, straight out of localStorage. */
const stored = (page) => page.evaluate(() =>
  JSON.parse(localStorage.getItem(CARDS_KEY) || 'null'));

/* A card of your own: written, indexed, counted, and stored under an id in the
 * reserved namespace. */
{
  const { ctx, page, errors } = await coursePage();
  const before = await page.evaluate(() => ({
    cards: DECK.cards.length,
    section: sectionOf.get(DECK.sections[0].sectionId).cardCount,
  }));
  const wrote = await page.evaluate(() => writeCard({
    front: 'What does **springing off** mean?',
    back: 'Using a spring line to swing the bow or stern off the pontoon.',
    section: DECK.sections[0].sectionId,
  }));
  const doc = await stored(page);
  const drawn = await page.evaluate((id) => {
    const card = byId.get(id);
    return {
      cards: DECK.cards.length,
      front: card.front,
      back: card.back,
      section: card.sectionId,
      count: sectionOf.get(card.sectionId).cardCount,
      yours: card._yours === true,
      placeholder: document.getElementById('search').placeholder,
    };
  }, wrote.id);
  ok(wrote.ok && /^u\.[a-f0-9]{12}$/.test(wrote.id),
    `a card you write takes an id in the reserved namespace (${wrote.id})`);
  ok(drawn.cards === before.cards + 1 && drawn.count === before.section + 1,
    `it is in the deck and in its section's count (${drawn.cards} cards, section holds ${drawn.count})`);
  ok(drawn.front === '<p>What does <strong>springing off</strong> mean?</p>',
    `Markdown is rendered to sanitized HTML, not left as asterisks (${drawn.front.trim()})`);
  ok(drawn.yours && /pontoon/.test(drawn.back),
    'the card knows it is yours, and its answer is there');
  ok(/Search 538 cards/.test(drawn.placeholder),
    `the numbers counted off the deck move with it (${drawn.placeholder})`);
  ok(doc && doc.cards[wrote.id].front === 'What does **springing off** mean?'
      && doc.cards[wrote.id].at > 0 && doc.cards[wrote.id].ed > 0,
  'the document stores what was typed, with its written and edited stamps');
  ok(await page.evaluate(() => localStorage.getItem(KEY) === null
      || !('cards' in JSON.parse(localStorage.getItem(KEY)))),
  'and stores it beside the review document rather than inside it');

  await reload(page);
  const back = await page.evaluate((id) => {
    const card = byId.get(id);
    return { front: card.front, cards: DECK.cards.length, written: writtenCardCount() };
  }, wrote.id);
  ok(back.cards === before.cards + 1 && back.written === 1
      && back.front === '<p>What does <strong>springing off</strong> mean?</p>',
  'the card comes back through the load sanitiser, rendered again from its Markdown');
  ok(errors.length === 0, `writing a card raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Editing a card the course ships. The shipped card is untouched underneath, so
 * taking the edit back is free. */
{
  const { ctx, page, errors } = await coursePage({}, 'competent-crew');
  const target = await page.evaluate(() => DECK.cards[0].cardId);
  const edited = await page.evaluate((id) => editCard(id, {
    front: 'What is the *sheet* on a sail?',
    back: 'The line that controls it.',
  }), target);
  const after = await page.evaluate((id) => ({
    cards: DECK.cards.length,
    front: byId.get(id).front,
    marked: byId.get(id)._edited === true,
    shipped: shippedCard(id).front,
    rewritten: authorRewroteCard(id),
    was: cardRecord(id).was,
  }), target);
  ok(edited.ok && after.cards === 200,
    `an edit replaces a card rather than adding one (${after.cards} cards)`);
  ok(after.front === '<p>What is the <em>sheet</em> on a sail?</p>' && after.marked,
    `the deck draws your words, marked as yours (${after.front.trim()})`);
  ok(after.shipped !== after.front && /^[a-f0-9]{8}\./.test(after.was),
    'the card the course ships is untouched, and the edit carries its fingerprint');
  ok(after.rewritten === false,
    'nothing claims the author rewrote a card they have not touched');

  // The author rewrites the card under you. Only the fingerprint can tell.
  const noticed = await page.evaluate((id) => {
    shippedCard(id).front = '<p>An answer the author has since corrected.</p>';
    return authorRewroteCard(id);
  }, target);
  ok(noticed,
    'a course card rewritten after you edited it is detected by the fingerprint, not guessed at');

  await reload(page);
  const kept = await page.evaluate((id) => byId.get(id).front, target);
  const reverted = await page.evaluate((id) => revertCard(id), target);
  const gone = await page.evaluate((id) => ({
    front: byId.get(id).front,
    cards: DECK.cards.length,
    record: cardRecord(id),
  }), target);
  ok(kept === '<p>What is the <em>sheet</em> on a sail?</p>',
    'the edit survives a reload');
  ok(reverted.ok && gone.cards === 200 && !/sheet<\/em>/.test(gone.front),
    'reverting puts the shipped card back without dropping it from the deck');
  ok(gone.record && gone.record.front === '' && gone.record.ed > gone.record.at,
    'and leaves an emptied record, so another device cannot hand the edit back');
  ok(errors.length === 0, `editing a course card raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Hiding a card the course should not have shipped, and un-hiding it. */
{
  const { ctx, page, errors } = await coursePage();
  const target = await page.evaluate(() => DECK.cards[2].cardId);
  const before = await page.evaluate((id) =>
    sectionOf.get(byId.get(id).sectionId).cardCount, target);
  await page.evaluate((id) => {
    // A card with history behind it, which is the case that has to be safe.
    state.recs[id] = { st: 'r', step: 0, ivl: 4, ea: 2.5, due: Date.now(), rp: 3, lp: 0, pv: 0 };
    writeNow();
  }, target);
  const hidden = await page.evaluate((id) => hideCard(id), target);
  await reload(page);
  const after = await page.evaluate((value) => ({
    cards: DECK.cards.length,
    inDeck: byId.has(value.id),
    history: !!state.recs[value.id],
    hidden: cardRecord(value.id).hidden === true,
    section: sectionOf.get(value.section).cardCount,
  }), { id: target, section: await page.evaluate((id) => shippedCard(id).sectionId, target) });
  ok(hidden.ok && after.cards === 536 && !after.inDeck,
    `a hidden card leaves the deck (${after.cards} cards)`);
  ok(after.hidden && after.history,
    'the hide is a marked, emptied record, and the sweep leaves its history alone');
  ok(after.section === before - 1,
    `the section it was in counts one fewer (${before} → ${after.section})`);

  const back = await page.evaluate((id) => revertCard(id), target);
  const restored = await page.evaluate((id) => ({
    cards: DECK.cards.length, inDeck: byId.has(id), history: !!state.recs[id],
  }), target);
  ok(back.ok && restored.cards === 537 && restored.inDeck && restored.history,
    'and un-hiding it brings the card back with the history it had');
  ok(errors.length === 0, `hiding a card raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Deleting a card you wrote is permanent, and is a marker rather than a hole. */
{
  const { ctx, page, errors } = await coursePage();
  const id = await page.evaluate(async () =>
    (await writeCard({ front: 'A card to delete' })).id);
  const refused = await page.evaluate(() => deleteCard(DECK.cards[0].cardId));
  const deleted = await page.evaluate((value) => deleteCard(value), id);
  await reload(page);
  const after = await page.evaluate((value) => ({
    inDeck: byId.has(value),
    record: cardRecord(value),
    written: writtenCardCount(),
    cards: DECK.cards.length,
  }), id);
  ok(!refused.ok && /hide it instead/i.test(refused.say),
    `a card the course ships is not deleted, and the refusal says what to do (${refused.say})`);
  ok(deleted.ok && !after.inDeck && after.written === 0 && after.cards === 537,
    'a card you wrote goes when you delete it');
  ok(after.record && after.record.front === '' && !after.record.section
      && after.record.ed > after.record.at,
  'the delete is an emptied record with a newer edit stamp, exactly as a deleted note is');
  ok(errors.length === 0, `deleting a card raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The reserved namespace, in both directions. */
{
  const { ctx, page, errors } = await coursePage();
  const layer = await page.evaluate(() => {
    localStorage.setItem(CARDS_KEY, JSON.stringify({
      v: 1,
      cards: {
        // Only `u.` and hex is a card of your own. Anything else under the
        // prefix came from somewhere that is not this app.
        'u.aabb11223344': { at: 1, ed: 1, front: 'kept', section: 'terms' },
        'u.NOTHEX': { at: 1, ed: 1, front: 'refused', section: 'terms' },
        'u.a b': { at: 1, ed: 1, front: 'refused', section: 'terms' },
        'u.': { at: 1, ed: 1, front: 'refused', section: 'terms' },
      },
    }));
    return true;
  });
  await reload(page);
  const kept = await page.evaluate(() => Object.keys(cardLayer).sort());
  ok(layer && kept.join() === 'u.aabb11223344',
    `the layer accepts one shape of written id and no other (${kept.join() || 'none'})`);

  const reader = await page.evaluate(async () => {
    const { readCourse } = await import('./lib/course.js');
    const { normalizeLegacyCourse } = await import('./lib/legacy-course.js');
    const v2 = readCourse({
      schemaVersion: 2,
      courseId: 'reserved-check',
      cards: [{ cardId: 'u.aabb1122', front: 'A card the course should not ship' }],
    });
    const legacy = normalizeLegacyCourse({
      format: 1,
      name: 'Reserved check',
      course: 'reserved-check',
      sections: [{ k: 'one', t: 'One', n: 1, o: 1 }],
      cards: [{ i: 'u.aabb1122', s: 'one', q: 'Question', a: 'Answer' }],
    }, { courseId: 'reserved-check' });
    const fine = readCourse({
      schemaVersion: 2,
      courseId: 'plain-check',
      cards: [{ cardId: 'unusual-but-fine', front: 'A card the course may ship' }],
    });
    return {
      v2: !v2.course && v2.diagnostics.some((item) => item.code === 'course.reserved_id'),
      legacy: !legacy.course
        && legacy.diagnostics.some((item) => item.code === 'course.reserved_id'),
      fine: !!fine.course,
    };
  });
  ok(reader.v2 && reader.legacy,
    'and both course readers refuse a shipped card in that namespace');
  ok(reader.fine,
    'while an id that merely begins with a u is a perfectly good course id');

  const shipped = await page.evaluate(async () => {
    const ids = [];
    for (const course of ['day-skipper', 'competent-crew']) {
      const deck = await (await fetch('courses/' + course + '/cards.json')).json();
      for (const card of deck.cards) if (String(card.i).startsWith('u.')) ids.push(card.i);
    }
    return ids;
  });
  ok(shipped.length === 0,
    'no course this app ships uses the reserved prefix today');
  ok(errors.length === 0, `the reserved namespace raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Whatever is in that document, the deck still opens. */
{
  const { ctx, page, errors } = await coursePage();
  await page.evaluate(() => {
    // Everything a corrupt file, an older build or a hand-edited document can
    // put here: the wrong type for a record, ids that are not ids, text that is
    // not text, stamps that are not numbers, and the one key that could reach
    // the prototype if it were ever used unchecked.
    localStorage.setItem(CARDS_KEY, `{"v":1,"cards":{
      "__proto__": {"at": 1, "ed": 1, "front": "prototype"},
      "Not An Id": {"at": 1, "ed": 1, "front": "refused"},
      "u.aabb11": "a string, not a record",
      "u.aabb22": {"at": "soon", "ed": null, "front": "kept, with sane stamps", "section": 42},
      "u.aabb33": {"at": 5, "ed": 9, "front": 12345},
      "u.aabb44": {"at": 5, "front": "no edit stamp", "section": "terms"},
      "terms-not-a-real-card": {"at": 5, "ed": 9, "front": "an override of nothing"}
    }}`);
  });
  await reload(page);
  const survived = await page.evaluate(() => ({
    booted: document.getElementById('boot').hidden,
    ids: Object.keys(cardLayer).sort(),
    proto: Object.getPrototypeOf(cardLayer) === Object.prototype && !('at' in Object.prototype),
    loose: byId.get('u.aabb22').sectionId,
    stamps: cardLayer['u.aabb22'],
    empty: cardLayer['u.aabb33'].front,
    fallback: cardLayer['u.aabb44'].ed === cardLayer['u.aabb44'].at,
    cards: DECK.cards.length,
    section: sectionOf.get('u.loose') ? sectionOf.get('u.loose').title : '',
    grouped: groupFor.has('u.loose'),
  }));
  ok(survived.booted && survived.ids.join() === 'terms-not-a-real-card,u.aabb22,u.aabb33,u.aabb44',
    `a corrupt cards document does not stop the deck opening (${survived.ids.join()})`);
  ok(survived.proto, 'a "__proto__" card id cannot reach the prototype');
  ok(survived.stamps.at === 0 && survived.stamps.ed === 0 && survived.empty === '',
    'unreadable stamps become zero and a front that is not text becomes no card');
  ok(survived.fallback,
    'a missing edit stamp falls back to the written one rather than to zero');
  ok(survived.loose === 'u.loose' && survived.section === 'Cards you wrote'
      && survived.grouped,
  `a card whose section is gone is placed rather than dropped (${survived.loose})`);
  ok(survived.cards === 539,
    `an override of a card this deck does not have adds nothing (${survived.cards} cards)`);

  await page.evaluate(() => localStorage.setItem(CARDS_KEY, '{"v":1,"cards":"nope"}'));
  await reload(page);
  const blunt = await page.evaluate(() => ({
    booted: document.getElementById('boot').hidden,
    layer: JSON.stringify(cardLayer),
    loaded: cardLayerLoaded,
  }));
  ok(blunt.booted && blunt.layer === '{}' && !blunt.loaded,
    'a block that is not a block is no cards — and is not mistaken for the answer "none"');
  ok(errors.length === 0, `a corrupt cards document raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The trap this whole layer is built around. The boot sweep deletes review
 * history for every card it cannot find; a cards document that will not open
 * must stop it, or every card somebody wrote loses its history for ever on the
 * next boot — quietly, and with nothing to restore it from. */
{
  const { ctx, page, errors } = await coursePage();
  const id = await page.evaluate(async () => {
    const written = await writeCard({ front: 'Answered, then orphaned' });
    state.recs[written.id] = {
      st: 'r', step: 0, ivl: 4, ea: 2.5, due: Date.now(), rp: 7, lp: 0, pv: 0,
    };
    writeNow();
    return written.id;
  });
  await page.evaluate(() => localStorage.setItem(CARDS_KEY, '{oops'));
  await reload(page);
  const unreadable = await page.evaluate((value) => ({
    loaded: cardLayerLoaded,
    inDeck: byId.has(value),
    history: state.recs[value] ? state.recs[value].rp : null,
    swept: sweepUnknownRecords(),
  }), id);
  ok(!unreadable.loaded && !unreadable.inDeck,
    'a cards document that will not parse leaves the layer unloaded');
  ok(unreadable.history === 7 && unreadable.swept === false,
    'and the sweep does not run, so the card\'s review history is still there');

  // The other half: when the document does open, the sweep is the sweep.
  await page.evaluate((value) => {
    localStorage.setItem(CARDS_KEY, '{"v":1,"cards":{}}');
    state.recs[value] = { st: 'r', step: 0, ivl: 4, ea: 2.5, due: Date.now(), rp: 7, lp: 0, pv: 0 };
    writeNow();
  }, id);
  await reload(page);
  const readable = await page.evaluate((value) => ({
    loaded: cardLayerLoaded, history: !!state.recs[value],
  }), id);
  ok(readable.loaded && !readable.history,
    'a readable document is an answer, and history for a card that is really gone is swept');
  ok(errors.length === 0, `the sweep raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Two idle tabs are both allowed to write — the study lease is only held while
 * somebody is answering — so the tab that did not write has to hear about it. */
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
  });
  const one = await ctx.newPage();
  const two = await ctx.newPage();
  await Promise.all([
    one.goto(URL + '?course=competent-crew', { waitUntil: 'networkidle' }),
    two.goto(URL + '?course=competent-crew', { waitUntil: 'networkidle' }),
  ]);
  await Promise.all([
    one.waitForFunction(() => document.getElementById('boot').hidden),
    two.waitForFunction(() => document.getElementById('boot').hidden),
  ]);
  const id = await one.evaluate(async () =>
    (await writeCard({ front: 'Written in the other tab' })).id);
  let adopted = false;
  try {
    await two.waitForFunction((value) => byId.has(value), id, { timeout: 5000 });
    adopted = true;
  } catch (e) { adopted = false; }
  const seen = await two.evaluate(() => ({
    cards: DECK.cards.length, placeholder: document.getElementById('search').placeholder,
  }));
  ok(adopted && seen.cards === 201 && /Search 201 cards/.test(seen.placeholder),
    `the other tab takes the card and every number counted off the deck (${seen.cards})`);
  await ctx.close();
}

/* One writer per deck, cards included. */
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
  });
  const studying = await ctx.newPage();
  const idle = await ctx.newPage();
  await Promise.all([
    studying.goto(URL + '?course=competent-crew', { waitUntil: 'networkidle' }),
    idle.goto(URL + '?course=competent-crew', { waitUntil: 'networkidle' }),
  ]);
  await Promise.all([
    studying.waitForFunction(() => document.getElementById('boot').hidden),
    idle.waitForFunction(() => document.getElementById('boot').hidden),
  ]);
  await studying.evaluate(() => {
    startSession(null, {});
    reveal();
    answer(3);
    writeNow();
  });
  const refused = await idle.evaluate(() => writeCard({ front: 'Written from an idle tab' }));
  const after = await idle.evaluate(() => ({
    cards: DECK.cards.length,
    written: writtenCardCount(),
    document: localStorage.getItem(CARDS_KEY),
  }));
  ok(!refused.ok && /another tab/i.test(refused.say),
    `the refusal names the cause and the way out (${refused.say})`);
  ok(after.cards === 200 && after.written === 0
      && (after.document === null || after.document === '{"v":1,"cards":{}}'),
  'and nothing was written into the deck the other tab is studying');
  await ctx.close();
}

/* A card that is not a card, and a deck already holding as many as it keeps. */
{
  const { ctx, page, errors } = await coursePage();
  const refusals = await page.evaluate(async () => ({
    blank: await writeCard({ front: '   \n  ' }),
    unsupported: await writeCard({ front: '# A heading is not in the subset' }),
    link: await writeCard({ front: 'Read [this](javascript:alert(1))' }),
  }));
  ok(!refusals.blank.ok && refusals.blank.say === 'A card needs a question.',
    `a card with no question is refused in the app's own words (${refusals.blank.say})`);
  ok(!refusals.unsupported.ok && /subset/i.test(refusals.unsupported.say),
    `and the reader's own diagnostic is what says why (${refusals.unsupported.say})`);
  ok(!refusals.link.ok && /https/i.test(refusals.link.say),
    `an unsafe link never reaches the deck (${refusals.link.say})`);

  await page.evaluate(() => {
    const now = Date.now();
    const cards = {};
    for (let i = 0; i < 250; i++) {
      // Newest edit first, so what the ceiling drops is the oldest writing.
      cards['u.' + i.toString(16).padStart(12, '0')] =
        { at: now - i * 1000, ed: now - i * 1000, front: 'card ' + i, section: 'terms' };
    }
    localStorage.setItem(CARDS_KEY, JSON.stringify({ v: 1, cards }));
  });
  await reload(page);
  await page.waitForFunction(() =>
    /cards of your own/i.test(document.getElementById('toast').textContent));
  const capped = await page.evaluate(() => ({
    written: writtenCardCount(),
    newest: !!byId.get('u.000000000000'),
    last: !!byId.get('u.0000000000c7'),
    dropped: !byId.get('u.0000000000c8'),
    toast: document.getElementById('toast').textContent,
    away: document.getElementById('toast').classList.contains('away'),
  }));
  ok(capped.written === 200 && capped.newest && capped.last && capped.dropped,
    `a document over the ceiling comes back at it (${capped.written})`);
  ok(/50 cards/.test(capped.toast) && !capped.away,
    `and the app says what it cost instead of losing them quietly (${capped.toast})`);
  ok(errors.length === 0, `the ceilings raise no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* A card written into an imported deck is made of the same sanitized HTML the
 * deck is: that is what makes this layer worth having in an Anki import, and it
 * is the reason the Markdown is rendered rather than stored and shown. */
{
  const { ctx, page, errors } = await coursePage();
  const rendered = await page.evaluate(async () => {
    const written = await writeCard({
      front: 'Two things:\n\n- **one**\n- *two*',
      back: 'A link to <https://example.com> and a <script>bad()</script> tag.',
    });
    const card = byId.get(written.id);
    const host = document.createElement('div');
    host.innerHTML = card.back;
    return {
      front: card.front,
      back: card.back,
      scripts: host.querySelectorAll('script').length,
      owned: !!window.__owned,
    };
  });
  ok(/<ul>/.test(rendered.front) && /<strong>one<\/strong>/.test(rendered.front),
    'a list written into a card is a list on the card');
  ok(rendered.scripts === 0 && !rendered.owned && /&lt;script&gt;/.test(rendered.back),
    'and markup typed into a card is characters on the card, never markup');
  ok(errors.length === 0, `rendering a written card raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* ── the sheet, and the screens it is opened from ── */

/* Writing a card the way a person does it: from Browse, through two boxes. */
{
  const { ctx, page, errors } = await coursePage();
  await page.click('[data-go="browse"]');
  await page.click('#browse-write');
  await sheetOpen(page);
  const opened = await page.evaluate(() => ({
    title: document.getElementById('card-sheet-h').textContent,
    save: document.getElementById('card-save').textContent,
    focus: document.activeElement?.id,
    sections: document.getElementById('card-where').hidden
      ? 0 : document.getElementById('card-section').options.length,
    picked: document.getElementById('card-section').value,
    more: document.getElementById('card-more').hidden,
    idShown: /u\.[a-f0-9]/.test(document.getElementById('card-sheet').textContent),
    fine: document.querySelector('.sheet-fine').textContent.replace(/\s+/g, ' ').trim(),
    labels: [...document.querySelectorAll('.sheet-label')].map((el) => el.textContent),
    placeholder: document.getElementById('card-back').placeholder,
    preview: document.querySelectorAll('#card-sheet [data-preview], #card-sheet .preview').length,
  }));
  ok(/^new card$/i.test(opened.title) && opened.focus === 'card-front',
    `Write a card opens the sheet with the cursor in the question (${opened.title})`);
  ok(opened.sections === 24 && opened.picked === 'terms',
    `a deck with more than one section offers them, starting where you are (${opened.sections})`);
  ok(opened.labels.join(', ') === 'Question, Answer, Section'
      && /grade yourself/.test(opened.placeholder),
  `the app's own words, and an answer that says it may be left empty (${opened.labels.join(', ')})`);
  ok(opened.more && !opened.idShown,
    'a new card offers nothing to take away, and its id is never on screen');
  ok(opened.preview === 0
      && /\*emphasis\*, \*\*strong\*\*, lists and https links also work; nothing else does/i
        .test(opened.fine),
  `no preview and no toggle, one muted line naming what works (${opened.fine})`);

  await page.click('#card-save');
  await page.waitForFunction(() =>
    document.getElementById('card-say').textContent.length > 0);
  const empty = await page.evaluate(() => document.getElementById('card-say').textContent);
  ok(empty === 'A card needs a question.',
    `a card with no question is refused in the sheet's own status line (${empty})`);

  await page.fill('#card-front', 'What does **springing off** mean?');
  await page.fill('#card-back', 'Using a spring line to swing the bow or stern off the pontoon.');
  await page.click('#card-save');
  await page.waitForFunction(() =>
    document.getElementById('card-say').textContent === 'Card written.');
  const written = await page.evaluate(() => ({
    front: document.getElementById('card-front').value,
    back: document.getElementById('card-back').value,
    open: !document.getElementById('card-sheet').hidden,
    focus: document.activeElement?.id,
    cards: DECK.cards.length,
    written: writtenCardCount(),
  }));
  ok(written.open && written.front === '' && written.back === '' && written.focus === 'card-front',
    'the sheet stays open with the boxes cleared, because writing one card is usually writing two');
  ok(written.cards === 538 && written.written === 1,
    `and the card is in the deck (${written.cards} cards)`);

  await page.fill('#card-front', 'A question with nothing to reveal');
  await page.click('#card-save');
  await page.waitForFunction(() => DECK.cards.length === 539);
  await page.click('#card-close');
  await sheetShut(page);

  await browseFor(page, 'springing off');
  const row = await page.evaluate(() => {
    const li = document.querySelector('#browse-list li');
    return {
      id: li.dataset.card,
      question: li.querySelector('.b-q').textContent,
      strong: li.querySelectorAll('.b-q strong').length,
      acts: li.querySelector('.b-acts').textContent.replace(/\s+/g, ' ').trim(),
      count: document.getElementById('browse-count').textContent,
      placeholder: document.getElementById('search').placeholder,
    };
  });
  ok(/^u\.[a-f0-9]{12}$/.test(row.id) && row.strong === 1,
    `the card is a row in Browse, with its Markdown rendered (${row.id})`);
  ok(row.acts === 'Written by you. Edit',
    `the row says whose card it is and offers to edit it (${row.acts})`);
  ok(/of 539 cards/.test(row.count) && /Search 539 cards/.test(row.placeholder),
    `and every number counted off the deck moved with it (${row.count})`);

  const backless = await page.evaluate(() => {
    const card = DECK.cards.find((c) => c.front.includes('nothing to reveal'));
    return { back: card.back, backed: hasBackContent(card) };
  });
  ok(backless.back === undefined && !backless.backed,
    'a card left with no answer is the front-only kind the runtime already grades');
  ok(errors.length === 0, `writing through the sheet raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Fixing a card the course wrote, from the row it is on. The sheet's first fill
 * has to come out of sanitized HTML, because there is no Markdown behind a card
 * nobody has edited yet. */
{
  const { ctx, page, errors } = await coursePage({}, 'competent-crew');
  const watcher = watchDialogs(page);
  const target = await page.evaluate(() => DECK.cards[0].cardId);
  const section = await page.evaluate(() => DECK.sections[0].sectionId);
  await page.click('[data-go="browse"]');
  await page.selectOption('#sect-filter', section);
  await page.waitForTimeout(200);
  const row = `#browse-list li[data-card="${target}"]`;
  await page.click(row + ' summary');
  await page.click(row + ' [data-card-edit]');
  await sheetOpen(page);
  const seeded = await page.evaluate((id) => ({
    title: document.getElementById('card-sheet-h').textContent,
    front: document.getElementById('card-front').value,
    shipped: shippedCard(id).front,
    where: !document.getElementById('card-where').hidden,
    more: document.getElementById('card-more').textContent.replace(/\s+/g, ' ').trim(),
    warn: document.getElementById('card-warn').hidden,
  }), target);
  ok(/^edit card$/i.test(seeded.title) && seeded.front.length > 0
      && !/[<>]/.test(seeded.front),
  `the sheet opens on the card's own words, written back out as text (${seeded.front.slice(0, 40)}…)`);
  ok(!seeded.where,
    'a course card is not offered a section: the shipped card is what says where it lives');
  ok(seeded.more === 'Hide this card',
    `and the course ships it, so it is hidden rather than deleted (${seeded.more})`);
  ok(seeded.warn,
    'a card the subset can write says nothing about what it cannot');

  await page.fill('#card-front', 'What is the *sheet* on a sail?');
  await page.fill('#card-back', 'The line that controls it.');
  await page.click('#card-save');
  await sheetShut(page);
  const edited = await page.evaluate((id) => {
    const li = document.querySelector(`#browse-list li[data-card="${id}"]`);
    return {
      question: li.querySelector('.b-q').textContent,
      em: li.querySelectorAll('.b-q em').length,
      acts: li.querySelector('.b-acts').textContent.replace(/\s+/g, ' ').trim(),
      cards: DECK.cards.length,
      focus: document.activeElement?.tagName,
    };
  }, target);
  ok(edited.cards === 200 && /What is the sheet on a sail\?/.test(edited.question)
      && edited.em === 1,
  `an edit replaces the card rather than adding one (${edited.cards} cards)`);
  ok(edited.acts === 'Edited by you. Show the original Edit',
    `the row says the card is yours now and offers the original back (${edited.acts})`);

  await page.click(`#browse-list li[data-card="${target}"] [data-card-revert]`);
  await page.waitForFunction((id) => byId.get(id)._edited !== true, target);
  const reverted = await page.evaluate((id) => ({
    question: byId.get(id).front,
    shipped: shippedCard(id).front,
    acts: document.querySelector(`#browse-list li[data-card="${id}"] .b-acts`)
      .textContent.replace(/\s+/g, ' ').trim(),
  }), target);
  ok(watcher.asked.length === 1 && /no undo/i.test(watcher.asked[0]),
    `taking your version back asks first, because your words go (${watcher.asked[0]})`);
  ok(reverted.question === reverted.shipped && reverted.acts === 'Edit',
    'and the card the course ships is back on the row');
  ok(errors.length === 0, `editing from a row raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* What the reader refuses, said in the reader's own words, after Save. */
{
  const { ctx, page, errors } = await coursePage();
  await page.click('[data-go="browse"]');
  await page.click('#browse-write');
  await sheetOpen(page);
  await page.fill('#card-front', 'A question');
  await page.fill('#card-back', '# A heading is not in the subset');
  await page.click('#card-save');
  await page.waitForFunction(() =>
    document.getElementById('card-say').textContent.length > 0);
  const said = await page.evaluate(() => ({
    say: document.getElementById('card-say').textContent,
    listed: !document.getElementById('card-diags').hidden,
    cards: DECK.cards.length,
  }));
  ok(/outside the course format 2 subset/.test(said.say)
      && /Use paragraphs, line breaks, emphasis/.test(said.say),
  `the status line carries the parser's own message and its correction (${said.say})`);
  ok(/^Answer — /.test(said.say) && !said.listed,
    'with the box named, and nothing under it repeating the one sentence it just said');
  ok(said.cards === 537, 'and nothing was written into the deck');

  // Two, and the status line has room for one of them.
  await page.fill('#card-front', '# A heading');
  await page.click('#card-save');
  await page.waitForFunction(() =>
    !document.getElementById('card-diags').hidden);
  const both = await page.evaluate(() => ({
    rows: document.querySelectorAll('#card-diags li').length,
    code: document.querySelector('#card-diags code')?.textContent,
    sides: [...document.querySelectorAll('#card-diags span')].map((el) =>
      el.textContent.split(' — ')[0]),
    place: document.querySelector('#card-diags small')?.textContent,
    correction: [...document.querySelectorAll('#card-diags small')].pop()?.textContent,
  }));
  ok(both.rows === 2 && both.sides.join() === 'Question,Answer'
      && both.code === 'markdown.unsupported_construct',
  `a second error brings the list, naming which box each one is about (${both.sides.join()})`);
  ok(/^line \d+, column \d+$/.test(both.place) && /Use paragraphs/.test(both.correction),
    `with where in the text it is and what to do about it (${both.place})`);

  await page.fill('#card-front', 'A question');

  await page.fill('#card-back', 'A heading is not in the subset');
  await page.click('#card-save');
  await page.waitForFunction(() => DECK.cards.length === 538);
  const cleared = await page.evaluate(() => ({
    say: document.getElementById('card-say').textContent,
    listed: !document.getElementById('card-diags').hidden,
  }));
  ok(cleared.say === 'Card written.' && !cleared.listed,
    'and the diagnostics go when the card they were about does');
  ok(errors.length === 0, `diagnostics raise no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The sheet is a dialog: one history entry, the Tab key, and the control that
 * opened it gets the focus back. */
{
  const { ctx, page, errors } = await coursePage();
  await page.click('[data-go="browse"]');
  await page.click('#browse-write');
  await sheetOpen(page);
  const open = await page.evaluate(() => ({
    app: document.getElementById('app').inert,
    skip: document.querySelector('.skip').inert,
    shelf: document.querySelector('.shelf-btn')?.inert,
    role: document.getElementById('card-sheet').getAttribute('role'),
    modal: document.getElementById('card-sheet').getAttribute('aria-modal'),
    labelled: document.getElementById('card-sheet').getAttribute('aria-labelledby'),
    status: document.getElementById('card-say').getAttribute('role'),
    overflow: document.body.style.overflow,
    outside: document.getElementById('card-sheet').parentElement.id,
  }));
  let trapped = true;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    trapped &&= await page.evaluate(() =>
      document.getElementById('card-sheet').contains(document.activeElement));
  }
  ok(open.app && open.skip && open.shelf && open.role === 'dialog'
      && open.modal === 'true' && open.labelled === 'card-sheet-h',
  'the open sheet inerts every control behind it and says it is modal');
  ok(open.status === 'status' && open.overflow === 'hidden' && open.outside !== 'app',
    'it lives outside #app, which is what lets it be typed into while #app is inert');
  ok(trapped, 'Tab stays inside the sheet');

  await page.evaluate(() => history.back());
  await sheetShut(page);
  const closed = await page.evaluate(() => ({
    focus: document.activeElement?.id,
    app: document.getElementById('app').inert,
    overflow: document.body.style.overflow,
  }));
  ok(closed.focus === 'browse-write' && !closed.app && closed.overflow === '',
    'browser Back closes the sheet and hands focus back to the button that opened it');

  await page.click('#browse-write');
  await sheetOpen(page);
  await page.keyboard.press('Escape');
  await sheetShut(page);
  const afterEscape = await page.evaluate(() => ({
    focus: document.activeElement?.id, screen: current,
  }));
  ok(afterEscape.focus === 'browse-write' && afterEscape.screen === 'browse',
    'Escape closes the sheet and does not take a screen with it');

  // Closing from inside must consume its own history entry, or the next Back
  // press is eaten by a sheet that is no longer there.
  await page.click('#browse-write');
  await sheetOpen(page);
  await page.click('#card-cancel');
  await sheetShut(page);
  await page.waitForTimeout(200);
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => current === 'home');
  ok(await page.evaluate(() => current) === 'home',
    'a closed sheet leaves no stray history entry behind it');

  // Another tab rebuilding the deck underneath is the re-render hook: the sheet
  // has to notice, and it must not take the half-written question away to do it.
  await page.click('[data-go="browse"]');
  await page.click('#browse-write');
  await sheetOpen(page);
  await page.fill('#card-front', 'Half a question, still being typed');
  const survived = await page.evaluate(() => {
    renderDeckChanged();
    return document.getElementById('card-front').value;
  });
  ok(survived === 'Half a question, still being typed',
    'a re-render underneath the sheet leaves what you were typing alone');
  ok(errors.length === 0, `the sheet chrome raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The path §4b is about: the card in front of you is wrong. Editing it is safe
 * mid-session; taking it out of the deck is not, and is refused with a reason. */
{
  const { ctx, page, errors } = await coursePage();
  const watcher = watchDialogs(page);
  const id = await page.evaluate(async () => {
    const written = await writeCard({ front: 'A card with a mistake in it' });
    startSession(null, {});
    session.queue = [written.id, DECK.cards[0].cardId];
    session.total = 2;
    session.done = 0;
    showCard();
    return written.id;
  });
  await page.click('#fix-btn');
  await sheetOpen(page);
  const onCard = await page.evaluate(() => ({
    front: document.getElementById('card-front').value,
    more: document.getElementById('card-more').textContent.replace(/\s+/g, ' ').trim(),
  }));
  ok(onCard.front === 'A card with a mistake in it',
    'Fix this card opens the sheet on the card that is up');
  ok(onCard.more === 'Delete this card',
    `and a card you wrote is deleted rather than hidden (${onCard.more})`);

  await page.click('[data-card-delete]');
  await page.waitForFunction(() =>
    document.getElementById('card-say').textContent.length > 0);
  const refused = await page.evaluate((value) => ({
    say: document.getElementById('card-say').textContent,
    still: byId.has(value),
    open: !!session,
  }), id);
  ok(refused.say === 'This card is in the session you have open. End the session first.',
    `deleting the card you are studying is refused with the reason (${refused.say})`);
  ok(refused.still && refused.open && watcher.asked.length === 0,
    'the card is still there and the session is still open, and it never asked');

  await page.fill('#card-front', 'A card with the mistake taken out');
  await page.click('#card-save');
  await sheetShut(page);
  const fixed = await page.evaluate(() => ({
    onScreen: document.getElementById('card-q').textContent.trim(),
    open: !!session,
    left: session.queue.length,
    screen: current,
    focus: document.activeElement?.id,
  }));
  ok(fixed.open && fixed.left === 2 && fixed.screen === 'study',
    'editing mid-session leaves the session exactly where it was');
  ok(fixed.onScreen === 'A card with the mistake taken out',
    `and the card on screen is drawn again from the deck that changed (${fixed.onScreen})`);
  ok(fixed.focus === 'fix-btn', 'focus comes back to the control that opened the sheet');
  ok(errors.length === 0, `fixing a card mid-session raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Hiding a course card through the sheet, and finding it again afterwards. A
 * hidden card is not in the deck, so without a list of its own there would be
 * nowhere to take the hiding back from. */
{
  const { ctx, page, errors } = await coursePage({}, 'competent-crew');
  watchDialogs(page);
  const target = await page.evaluate(() => DECK.cards[3].cardId);
  const section = await page.evaluate(() => DECK.cards[3].sectionId);
  await page.evaluate((id) => {
    state.recs[id] = { st: 'r', step: 0, ivl: 4, ea: 2.5, due: Date.now(), rp: 6, lp: 0, pv: 0 };
    writeNow();
  }, target);
  await page.click('[data-go="browse"]');
  await page.selectOption('#sect-filter', section);
  await page.waitForTimeout(200);
  await page.click(`#browse-list li[data-card="${target}"] summary`);
  await page.click(`#browse-list li[data-card="${target}"] [data-card-edit]`);
  await sheetOpen(page);
  await page.click('[data-card-hide]');
  await sheetShut(page);
  const hidden = await page.evaluate((id) => ({
    inDeck: byId.has(id),
    cards: DECK.cards.length,
    toast: document.getElementById('toast').textContent,
    button: document.getElementById('browse-hidden').textContent,
    shown: document.getElementById('browse-hidden').hidden,
    listShut: document.getElementById('hidden-list').hidden,
    history: !!state.recs[id],
  }), target);
  ok(!hidden.inDeck && hidden.cards === 199 && hidden.history,
    `a hidden card leaves the deck and keeps its history (${hidden.cards} cards)`);
  ok(!hidden.shown && /cards you hid \(1\)/i.test(hidden.button) && hidden.listShut,
    `Browse offers the cards you hid, closed until you ask (${hidden.button})`);
  ok(/browse/i.test(hidden.toast),
    `and the app says where to find it again (${hidden.toast})`);

  await page.click('#browse-hidden');
  await page.waitForSelector('#hidden-list:not([hidden])');
  const listed = await page.evaluate((id) => ({
    rows: document.querySelectorAll('#hidden-list li').length,
    id: document.querySelector('#hidden-list li').dataset.card,
    question: document.querySelector('#hidden-list .b-q').textContent.length > 0,
    said: document.querySelector('#hidden-list .b-mine').textContent,
    button: document.getElementById('browse-hidden').textContent,
    expanded: document.getElementById('browse-hidden').getAttribute('aria-expanded'),
  }), target);
  ok(listed.rows === 1 && listed.id === target && listed.question,
    'the list holds the card, with the question the course wrote on it');
  ok(listed.said === 'Hidden by you.' && listed.expanded === 'true'
      && /close/i.test(listed.button),
  `and says why it is there (${listed.said})`);

  await page.click('#hidden-list [data-card-revert]');
  await page.waitForFunction((id) => byId.has(id), target);
  const back = await page.evaluate((id) => ({
    cards: DECK.cards.length,
    history: state.recs[id] ? state.recs[id].rp : null,
    button: document.getElementById('browse-hidden').hidden,
    listShut: document.getElementById('hidden-list').hidden,
  }), target);
  ok(back.cards === 200 && back.history === 6,
    'bringing it back is free, and the history it kept is still on it');
  ok(back.button && back.listShut,
    'and with nothing hidden the offer goes away rather than opening on nothing');
  ok(errors.length === 0, `hiding through the sheet raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The author rewrites a card you have edited. Without `was` there is no way to
 * ask; with it, the choice is offered rather than made for you. */
{
  const { ctx, page, errors } = await coursePage({}, 'competent-crew');
  const watcher = watchDialogs(page);
  const target = await page.evaluate(() => DECK.cards[0].cardId);
  const section = await page.evaluate(() => DECK.cards[0].sectionId);
  await page.evaluate((id) => editCard(id, { front: 'My own wording of it.' }), target);
  await page.click('[data-go="browse"]');
  await page.selectOption('#sect-filter', section);
  await page.waitForTimeout(200);
  // The row's controls live in the answer, so the answer has to be open. A
  // re-render carries that forward, which is what the rest of this block leans on.
  await page.click(`#browse-list li[data-card="${target}"] summary`);
  const before = await page.evaluate((id) =>
    document.querySelector(`#browse-list li[data-card="${id}"] .b-acts`)
      .textContent.replace(/\s+/g, ' ').trim(), target);
  ok(before === 'Edited by you. Show the original Edit',
    `an edit nobody has moved under says only that it is yours (${before})`);

  const acts = await page.evaluate((id) => {
    shippedCard(id).front = '<p>The wording the author has since corrected.</p>';
    renderBrowse();
    return document.querySelector(`#browse-list li[data-card="${id}"] .b-acts`)
      .textContent.replace(/\s+/g, ' ').trim();
  }, target);
  ok(acts === 'The author rewrote this card after you edited it. Keep yours Take theirs Edit',
    `once the author has, the row offers the choice rather than making it (${acts})`);

  await page.click(`#browse-list li[data-card="${target}"] [data-card-keep]`);
  await page.waitForFunction((id) => !authorRewroteCard(id), target);
  const kept = await page.evaluate((id) => ({
    front: byId.get(id).front,
    acts: document.querySelector(`#browse-list li[data-card="${id}"] .b-acts`)
      .textContent.replace(/\s+/g, ' ').trim(),
    toast: document.getElementById('toast').textContent,
  }), target);
  ok(/My own wording of it/.test(kept.front)
      && kept.acts === 'Edited by you. Show the original Edit',
  `Keep yours leaves your words and stops asking (${kept.acts})`);
  ok(watcher.asked.length === 0 && kept.toast === 'Yours stays.',
    'and it changes no words, so it asks nothing');

  const again = await page.evaluate((id) => {
    shippedCard(id).front = '<p>Corrected a second time.</p>';
    renderBrowse();
    return authorRewroteCard(id);
  }, target);
  await page.click(`#browse-list li[data-card="${target}"] [data-card-revert]`);
  await page.waitForFunction((id) => byId.get(id)._edited !== true, target);
  const theirs = await page.evaluate((id) => ({
    front: byId.get(id).front,
    acts: document.querySelector(`#browse-list li[data-card="${id}"] .b-acts`)
      .textContent.replace(/\s+/g, ' ').trim(),
  }), target);
  ok(again && /Corrected a second time/.test(theirs.front) && theirs.acts === 'Edit',
    'and Take theirs drops your layer, putting the card the course ships back');
  ok(watcher.asked.length === 1 && /no undo/i.test(watcher.asked[0]),
    `which asks first, because your words are what goes (${watcher.asked[0]})`);
  ok(errors.length === 0, `the rewrite choice raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* A card written in markup the two boxes cannot write. Saying so is the whole
 * job: a converter that quietly dropped an imported card's picture would delete
 * it the moment somebody fixed a typo underneath it. */
{
  const { ctx, page, errors } = await fixturePage({
    format: 1,
    name: 'Markup fixture',
    course: 'day-skipper',
    sections: [{ k: 'one', t: 'One', n: 4, o: 1 }],
    cards: [
      {
        i: 'plain', s: 'one',
        q: '<p>What is <b>bold</b> and <i>italic</i> and a <a href="https://example.com/x">link</a>?</p>',
        a: '<ul><li>One item</li><li>A second</li></ul>',
      },
      {
        i: 'pictured', s: 'one',
        q: '<p>What is this?</p><p><img src="munin-media:0" alt="a picture"></p>',
        a: '<p>A picture inside the words.</p>',
      },
      { i: 'tabled', s: 'one', q: '<p>A table card</p>', a: '<table><tr><td>cell</td></tr></table>' },
      {
        i: 'bare', s: 'one',
        q: 'A word, <b>one in bold</b> and a line<br>broken in two.',
        a: 'Asterisks *are just characters* here.',
      },
    ],
  });
  const converted = await page.evaluate(() => ({
    plain: htmlToCardSource(shippedCard('plain').front),
    list: htmlToCardSource(shippedCard('plain').back),
    pictured: htmlToCardSource(shippedCard('pictured').front),
    tabled: htmlToCardSource(shippedCard('tabled').back),
    bare: htmlToCardSource(shippedCard('bare').front),
    stars: htmlToCardSource(shippedCard('bare').back),
  }));
  ok(converted.bare.text === 'A word, **one in bold** and a line  \nbroken in two.'
      && converted.bare.lost.length === 0,
  `an unwrapped run of inline markup is one line, not one paragraph each (${JSON.stringify(converted.bare.text)})`);
  ok(converted.stars.text === 'Asterisks \\*are just characters\\* here.',
    `and a card that merely contains asterisks still does after a round trip (${converted.stars.text})`);
  ok(converted.plain.text
      === 'What is **bold** and *italic* and a [link](https://example.com/x)?'
      && converted.plain.lost.length === 0,
  `the constructs the subset has come back as the Markdown that makes them (${converted.plain.text})`);
  ok(converted.list.text === '- One item\n- A second' && converted.list.lost.length === 0,
    `including a list (${JSON.stringify(converted.list.text)})`);
  ok(converted.pictured.lost.includes('media')
      && converted.pictured.text === 'What is this?',
  'a picture inside a card is named rather than dropped in silence');
  ok(converted.tabled.lost.includes('table') && /cell/.test(converted.tabled.text),
    `and anything else keeps its words while its shape is named (${converted.tabled.lost.join()})`);

  await page.click('[data-go="browse"]');
  await page.click('#browse-write');
  await sheetOpen(page);
  await page.fill('#card-front', 'A card in the only section there is');
  await page.click('#card-save');
  await page.waitForFunction(() => DECK.cards.length === 5);
  const alone = await page.evaluate(() => ({
    where: document.getElementById('card-where').hidden,
    section: DECK.cards[DECK.cards.length - 1].sectionId,
    sections: DECK.sections.length,
  }));
  ok(alone.where && alone.sections === 1 && alone.section === 'one',
    'a deck with one section asks nothing about sections and puts the card in it');
  await page.keyboard.press('Escape');
  await sheetShut(page);

  await page.selectOption('#sect-filter', 'one');
  await page.waitForTimeout(200);
  await page.click('#browse-list li[data-card="pictured"] summary');
  await page.click('#browse-list li[data-card="pictured"] [data-card-edit]');
  await sheetOpen(page);
  const warned = await page.evaluate(() => ({
    shown: !document.getElementById('card-warn').hidden,
    text: document.getElementById('card-warn').textContent,
  }));
  ok(warned.shown && /picture/.test(warned.text) && /without it/.test(warned.text),
    `the sheet says what it cannot hold before the first such edit (${warned.text})`);
  await page.keyboard.press('Escape');
  await sheetShut(page);
  await page.click('#browse-list li[data-card="plain"] summary');
  await page.click('#browse-list li[data-card="plain"] [data-card-edit]');
  await sheetOpen(page);
  const quiet = await page.evaluate(() =>
    document.getElementById('card-warn').hidden);
  ok(quiet, 'and says nothing at all about a card it can write back out exactly');
  ok(errors.length === 0, `the first fill raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The two structural refusals, both hard errors in the course reader: a deck
 * holds at least one card, a declared section at least one. */
{
  const { ctx, page, errors } = await fixturePage({
    format: 1,
    name: 'Shape fixture',
    course: 'day-skipper',
    sections: [{ k: 'big', t: 'Ropework and knots', n: 2, o: 1 },
      { k: 'small', t: 'One thing only', n: 1, o: 2 }],
    cards: [
      { i: 'big-one', s: 'big', q: '<p>First</p>', a: '<p>A</p>' },
      { i: 'big-two', s: 'big', q: '<p>Second</p>', a: '<p>B</p>' },
      { i: 'only-one', s: 'small', q: '<p>The only card in its section</p>', a: '<p>C</p>' },
    ],
  });
  const watcher = watchDialogs(page);
  const costs = await page.evaluate(() => ({
    ordinary: cardRemovalCost('big-one'),
    last: cardRemovalCost('only-one'),
  }));
  ok(!costs.ordinary.refuse && !costs.ordinary.warn,
    'a card with neighbours costs nothing to take out');
  ok(costs.last.warn === 'This is the last card in One thing only, so the section goes with it.',
    `the last card in a section says what goes with it (${costs.last.warn})`);

  await page.click('[data-go="browse"]');
  await page.selectOption('#sect-filter', 'small');
  await page.waitForTimeout(200);
  await page.click('#browse-list li[data-card="only-one"] summary');
  await page.click('#browse-list li[data-card="only-one"] [data-card-edit]');
  await sheetOpen(page);
  await page.click('[data-card-hide]');
  await sheetShut(page);
  const gone = await page.evaluate(() => ({
    sections: DECK.sections.map((s) => s.sectionId),
    cards: DECK.cards.length,
    options: [...document.getElementById('sect-filter').options].map((o) => o.value),
    filter: document.getElementById('sect-filter').value,
  }));
  ok(watcher.asked.some((m) => /so the section goes with it/.test(m)),
    `and says it before it does it (${watcher.asked.join(' / ')})`);
  ok(gone.sections.join() === 'big' && gone.cards === 2,
    `so the section goes (${gone.sections.join() || 'none'})`);
  ok(!gone.options.includes('small') && gone.filter !== 'small',
    'and the filter stops offering a section that is no longer there');

  const cornered = await page.evaluate(async () => {
    await hideCard('big-one');
    return { cost: cardRemovalCost('big-two'), cards: DECK.cards.length };
  });
  ok(cornered.cards === 1 && cornered.cost.refuse
      === 'This is the only card in this deck. A deck needs at least one, so remove '
        + 'the whole deck from the courses screen instead.',
  `the last card of all is refused, and the refusal says where to go (${cornered.cost.refuse})`);

  await page.click('[data-go="browse"]');
  await page.selectOption('#sect-filter', 'big');
  await page.waitForTimeout(200);
  await page.click('#browse-list li[data-card="big-two"] summary');
  await page.click('#browse-list li[data-card="big-two"] [data-card-edit]');
  await sheetOpen(page);
  await page.click('[data-card-hide]');
  await page.waitForFunction(() =>
    document.getElementById('card-say').textContent.length > 0);
  const held = await page.evaluate(() => ({
    say: document.getElementById('card-say').textContent,
    cards: DECK.cards.length,
    open: !document.getElementById('card-sheet').hidden,
  }));
  ok(/only card in this deck/.test(held.say) && held.cards === 1 && held.open,
    'and the sheet says so rather than emptying the deck');
  ok(errors.length === 0, `the structural refusals raise no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Every number the app counts off the deck moves when the deck does — including
 * the ones that are nowhere near the card you just wrote. */
{
  const { ctx, page, errors } = await fixturePage({
    format: 1,
    name: 'Counting fixture',
    course: 'day-skipper',
    sections: [{ k: 'one', t: 'One', n: 2, o: 1 }, { k: 'two', t: 'Two', n: 2, o: 2 }],
    cards: [
      { i: 'a', s: 'one', q: '<p>A</p>', a: '<p>1</p>' },
      { i: 'bb', s: 'one', q: '<p>B</p>', a: '<p>2</p>' },
      { i: 'c', s: 'two', q: '<p>C</p>', a: '<p>3</p>' },
      { i: 'd', s: 'two', q: '<p>D</p>', a: '<p>4</p>' },
    ],
  });
  const tileBefore = await page.evaluate(() => {
    go('browse');
    return [...document.querySelectorAll('.btile-n')].map((el) => el.textContent);
  });
  const before = await page.evaluate(() => {
    // Every card in section one answered and solid, so the section counts as
    // swept and as kept: both are per-section denominators.
    for (const id of ['a', 'bb']) {
      state.recs[id] = {
        st: 'r', step: 0, ivl: 30, ea: 2.5, due: Date.now() + 30 * 86400000, rp: 3, lp: 0, pv: 0,
      };
    }
    writeNow();
    go('home');
    const context = achievementContext(null);
    return {
      sub: document.getElementById('home-sub').textContent,
      note: document.getElementById('today-note').textContent,
      frieze: document.querySelectorAll('#frieze .dood:not(.unearned)').length,
      swept: context.sweptSections,
      kept: context.keptSectionKeys.length,
      why: document.getElementById('ask-why').textContent,
    };
  });
  await page.evaluate(() => writeCard({ front: 'A fifth card', section: 'one' }));
  const after = await page.evaluate(() => {
    const context = achievementContext(null);
    go('stats');
    const mastery = [...document.querySelectorAll('#mastery .m-n')].map((el) => el.textContent);
    go('home');
    return {
      sub: document.getElementById('home-sub').textContent,
      note: document.getElementById('today-note').textContent,
      frieze: document.querySelectorAll('#frieze .dood:not(.unearned)').length,
      swept: context.sweptSections,
      kept: context.keptSectionKeys.length,
      why: document.getElementById('ask-why').textContent,
      mastery,
      build: document.getElementById('build-line').textContent,
      count: (go('browse'), document.getElementById('browse-count').textContent),
      tiles: [...document.querySelectorAll('.btile-n')].map((el) => el.textContent),
    };
  });
  ok(tileBefore.join() === '2 cards,2 cards' && after.tiles.join() === '3 cards,2 cards',
    `the section tiles are rebuilt rather than served from the copy made at boot (${after.tiles.join()})`);
  ok(before.sub === '4 cards · 2 sections' && after.sub === '5 cards · 2 sections',
    `Home counts the deck it is looking at (${after.sub})`);
  ok(/all 4 in/.test(before.note) && /all 5 in/.test(after.note),
    `the pacing is worked out over the deck that exists now (${after.note})`);
  ok(before.frieze === 5 && after.frieze === 4,
    `the frieze is filled against the deck's own size (${before.frieze} → ${after.frieze})`);
  ok(before.swept === 1 && after.swept === 0 && before.kept === 1 && after.kept === 0,
    'a card written into a section you had finished un-finishes it, which is the honest answer');
  ok(/these 5 cards a day/.test(after.why) && !/these 4 cards/.test(after.why),
    `and the line above the exam date is re-said rather than left at boot's number (${after.why})`);
  ok(after.mastery.some((line) => /3 total/.test(line)) && /5 cards/.test(after.build),
    `Progress counts it too (${after.mastery.join(' | ')})`);
  ok(/5 cards in 2 sections/.test(after.count),
    `and so does Browse (${after.count})`);
  ok(errors.length === 0, `the moving numbers raise no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

await b.close();
console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
