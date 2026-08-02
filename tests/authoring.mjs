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
  const empty = await page.evaluate(() => ({
    say: document.getElementById('card-say').textContent,
    focus: document.activeElement?.id,
    invalid: document.getElementById('card-front').getAttribute('aria-invalid'),
    describedBy: document.getElementById('card-front').getAttribute('aria-describedby'),
    nativeDisabled: document.getElementById('card-save').disabled,
  }));
  ok(empty.say === 'A card needs a question.',
    `a card with no question is refused in the sheet's own status line (${empty.say})`);
  ok(empty.focus === 'card-front' && empty.invalid === 'true'
      && empty.describedBy === 'card-say' && !empty.nativeDisabled,
  'an invalid async save keeps focus in the question and exposes its status to assistive tech');

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
  ok(fixed.focus === 'card-scroll',
    'a successful in-session edit returns focus to the card, not the edit action');
  const doneBeforeSpace = await page.evaluate(() => session.done);
  await page.keyboard.press('Space');
  const afterSpace = await page.evaluate(() => ({
    sheet: !document.getElementById('card-sheet').hidden,
    done: session.done,
  }));
  ok(!afterSpace.sheet && afterSpace.done === doneBeforeSpace + 1,
    'Space after an in-session edit grades the revealed card instead of reopening the editor');
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

/* ── the cards you write, crossing between devices ── */

/* The blob is assembled here and taken apart here, and the two halves have to
 * agree: the cards go out as their own block beside the state, and the state
 * document on this device still holds none of them. A cards key inside the
 * document mergeState rebuilds key by key is the one shape this feature was
 * designed away from. */
{
  const { ctx, page, errors } = await coursePage();
  const wrote = await page.evaluate(() => writeCard({ front: 'A card to carry' }));
  const wire = await page.evaluate(() => {
    addNote('a note to carry');
    writeNow();
    const payload = syncPayload();
    return {
      cards: Object.keys(payload.cards),
      notes: Object.keys(payload.notes).length,
      recs: Object.keys(payload.cards).length,
      stateDoc: JSON.parse(localStorage.getItem(KEY)),
      cardsDoc: JSON.parse(localStorage.getItem(CARDS_KEY)),
    };
  });
  ok(wire.cards.length === 1 && wire.cards[0] === wrote.id && wire.notes === 1,
    'what goes on the wire carries both documents as two blocks in one blob');
  ok(wire.stateDoc.cards === undefined && !!wire.cardsDoc.cards[wrote.id],
    'and the state document on the device still holds no cards key');
  // The blob comes back through the sanitiser the transport was given, not
  // through sanitise(), which knows nothing about a cards block and would drop
  // the other device's cards on the way in.
  const roundTrip = await page.evaluate(() => {
    const raw = JSON.parse(JSON.stringify(syncPayload()));
    return {
      plain: sanitise(raw).cards,
      synced: Object.keys(sanitiseSynced(raw).cards).length,
      hostile: Object.keys(sanitiseSynced({ recs: {}, cards: 'not a block' }).cards).length,
    };
  });
  ok(roundTrip.plain === undefined && roundTrip.synced === 1,
    'the blob arrives through a sanitiser that knows both blocks');
  ok(roundTrip.hostile === 0, 'and a cards block that is not a block becomes no cards');
  ok(errors.length === 0, `the sync payload raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* A card written on another device arrives, and the deck it lands in is the
 * deck: indexed, counted, and stored where the next boot will read it. */
{
  const { ctx, page, errors } = await coursePage();
  const landed = await page.evaluate(async () => {
    const merged = Object.assign({}, syncPayload(), {
      cards: {
        'u.abcdef012345': {
          at: 1000, ed: 1000, front: 'Written on the phone', back: 'And answered here',
        },
      },
      notes: { aa11: { at: 900, ed: 900, text: 'and a note with it' } },
    });
    adoptSynced(merged);
    await adopting;
    const card = byId.get('u.abcdef012345');
    return {
      front: card && card.front,
      yours: !!(card && card._yours),
      cards: DECK.cards.length,
      placeholder: document.getElementById('search').placeholder,
      notes: liveNotes().length,
      stored: JSON.parse(localStorage.getItem(CARDS_KEY)).cards['u.abcdef012345'].front,
    };
  });
  ok(landed.front === '<p>Written on the phone</p>' && landed.yours,
    `a card from another device is rendered into this deck (${landed.front})`);
  ok(landed.cards === 538 && /Search 538 cards/.test(landed.placeholder),
    `and every number counted off the deck moves with it (${landed.placeholder})`);
  ok(landed.notes === 1 && landed.stored === 'Written on the phone',
    'both blocks are adopted, and the cards block is written to its own document');
  ok(errors.length === 0, `adopting a merged deck raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The sharp edge. A card you had answered was deleted on the other device, so
 * the card goes and its history goes with it — but said out loud, once, rather
 * than discovered as a number that fell on its own. A card merely hidden is not
 * that: hiding is free to undo, which it would not be if the history had gone.
 */
{
  const { ctx, page, errors } = await coursePage();
  const shipped = await page.evaluate(() => DECK.cards[0].cardId);
  const swept = await page.evaluate(async (shippedId) => {
    const wrote = await writeCard({ front: 'A card I have answered' });
    state.recs[wrote.id] = { st: 'r', step: 0, ivl: 4, ea: 2.5, due: 1, rp: 14, lp: 0, pv: 0 };
    state.recs[shippedId] = { st: 'r', step: 0, ivl: 4, ea: 2.5, due: 1, rp: 9, lp: 0, pv: 0 };
    writeNow();
    const merged = Object.assign({}, syncPayload(), {
      cards: {
        [wrote.id]: { at: 1, ed: Date.now() + 1000, front: '', back: '' },
        [shippedId]: { at: 1, ed: Date.now() + 1000, front: '', back: '', hidden: true },
      },
    });
    adoptSynced(merged);
    // Nothing said out loud here: the adoption itself has to say it. Most syncs
    // are not asked for by anybody, and a sentence that only a button could
    // print would leave the commonest case silent.
    await adopting;
    return {
      gone: !byId.has(wrote.id) && !Object.hasOwn(state.recs, wrote.id),
      hiddenGone: !byId.has(shippedId),
      hiddenHistory: Object.hasOwn(state.recs, shippedId),
      hidden: hiddenCards().length,
      toast: document.getElementById('toast').textContent,
      sticky: !document.getElementById('toast').classList.contains('away'),
    };
  }, shipped);
  ok(swept.gone, 'a card deleted on another device takes its review history here too');
  ok(/deleted on another device/.test(swept.toast) && swept.sticky,
    `and the app says so rather than letting the number fall quietly (${swept.toast})`);
  ok(swept.hiddenGone && swept.hiddenHistory && swept.hidden === 1,
    'a card only hidden over there keeps its history, because bringing it back is free');
  ok(errors.length === 0, `the history sweep raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* One ceiling, shared. The number the app quotes while somebody types is the
 * number the merge arrives at, and it counts both of the things they write. */
{
  const { ctx, page, errors } = await coursePage();
  const full = await page.evaluate(async () => {
    const now = Date.now();
    state.notes = {};
    for (let i = 0; i < 199; i++) {
      state.notes['n' + i.toString(36).padStart(4, '0')] =
        { at: now - i, ed: now - i, text: 'note ' + i };
    }
    const first = await writeCard({ front: 'The two hundredth thing I have written' });
    const second = await writeCard({ front: 'And the two hundred and first' });
    return {
      first: first.ok,
      second,
      note: addNote('one note too many'),
      agreed: WRITTEN_LIVE === DSSync.WRITTEN_LIVE
        && WRITTEN_SLOTS === DSSync.WRITTEN_SLOTS,
    };
  });
  ok(full.agreed,
    'the app and the merge hold the same two numbers, which is the whole point of them');
  ok(full.first && !full.second.ok,
    'the two hundredth thing written is kept and the next one is refused');
  ok(/notes and cards of your own/.test(full.second.say)
      && /200/.test(full.second.say),
  `and the refusal names the ceiling they share (${full.second.say})`);
  ok(full.note === false,
    'the ceiling is the same one from the notes side: a card fills the slot a note wanted');
  ok(errors.length === 0, `the shared ceiling raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The single-writer rule covers a merge as much as it covers a keystroke. An
 * idle tab that adopted one would swap the deck out from under the tab actually
 * answering cards — and it would do it in pieces, the review document refused
 * and put back while the cards document went in. Nothing is lost by refusing:
 * the server still holds the merge. */
{
  const { ctx, page, errors } = await coursePage();
  const held = await page.evaluate(async () => {
    const wrote = await writeCard({ front: 'A card I have answered' });
    state.recs[wrote.id] = { st: 'r', step: 0, ivl: 4, ea: 2.5, due: 1, rp: 6, lp: 0, pv: 0 };
    writeNow();
    const before = DECK.cards.length;
    // The other tab takes the deck, the way it does — over storage.
    localStorage.setItem(STUDY_LOCK_KEY,
      JSON.stringify({ owner: 'the-other-tab', at: Date.now() }));
    adoptSynced(Object.assign({}, syncPayload(), {
      cards: { [wrote.id]: { at: 1, ed: Date.now() + 1000, front: '', back: '' } },
      notes: { bb22: { at: 1, ed: Date.now(), text: 'and a note with it' } },
    }));
    await adopting;
    const stored = JSON.parse(localStorage.getItem(CARDS_KEY)).cards[wrote.id];
    return {
      deck: DECK.cards.length === before && byId.has(wrote.id),
      layer: !!(cardRecord(wrote.id) || {}).front && !!stored.front,
      notes: liveNotes().length,
      history: Object.hasOwn(state.recs, wrote.id),
      toast: document.getElementById('toast').textContent,
    };
  });
  ok(held.deck && held.layer,
    'a merge arriving while another tab studies is not adopted, in either document');
  ok(held.notes === 0 && held.history,
    'and it takes nothing with it: no note lands, and no review record goes');
  ok(/another tab is studying/i.test(held.toast),
    `the refusal says which tab has the deck (${held.toast})`);
  ok(errors.length === 0, `the refused adoption raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* A deck that is not a built-in course does not sync, and the screen a person
 * would ask on says so in words rather than by having no button.
 *
 * Driven through an import, because the pick screen's own second path is a
 * later item — but it is the same deck to this half: both take a `local-` id,
 * and every part of the layer's sync path hangs off that one test. */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.shelf.on');
  await page.click('[data-byo]');
  await page.waitForSelector('#imp-input', { state: 'attached' });
  await page.setInputFiles('#imp-input', {
    name: 'mine.keep.yml',
    mimeType: 'text/yaml',
    buffer: Buffer.from(`schemaVersion: 2
courseId: a-deck-of-my-own
title: A deck of my own
cards:
  - cardId: only
    front: The only card in it.
`),
  });
  await page.waitForSelector('.imp-book:visible');
  await Promise.all([page.waitForEvent('load'), page.click('[data-keep="new"]')]);
  await page.waitForFunction(() => document.getElementById('boot').hidden,
    null, { timeout: 20000 });
  const local = await page.evaluate(async () => {
    const wrote = await writeCard({ front: 'A card in a deck of my own' });
    const before = DSSync.status();
    await runSync();
    go('stats');
    return {
      id: COURSE.id,
      wrote: wrote.ok,
      available: before.available,
      on: before.on,
      line: document.getElementById('sync-state').textContent,
      actions: document.getElementById('sync-actions').innerHTML,
    };
  });
  ok(/^local-[a-z0-9]+$/.test(local.id) && local.wrote,
    `a card can be written into a deck that stays on this device (${local.id})`);
  ok(local.available === false && local.on === false,
    'and the sync path is inert there: there is no identity to sync it under');
  ok(/stays on this device/.test(local.line) && /backup file/.test(local.line)
      && local.actions === '',
  `the screen says so where somebody would ask (${local.line})`);
  ok(errors.length === 0, `a local deck raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* ── the layer's lifecycle ── */

/** Hand a JSON document to the restore <input>, which is what picking a file in
 *  the dialog resolves to. The toast is emptied first so waiting for one is
 *  waiting for this restore rather than seeing the last one's — and the wait
 *  after it is for the sentences a restore says on top of its own, which are
 *  the costly ones. */
async function restore(page, payload) {
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await page.setInputFiles('#import-file', {
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  await page.waitForFunction(
    () => document.getElementById('toast').textContent.length > 0);
  await page.waitForTimeout(300);
  await page.evaluate(() => writeNow());
}

/* The backup file is the whole of what this deck holds, and since the layer
 * exists that is two documents. It matters most where Sync never runs: for a
 * deck of your own the file is the only copy the cards in it will ever have. */
{
  const { ctx, page, errors } = await coursePage();
  const wrote = await page.evaluate(async () => {
    const shipped = DECK.cards[0].cardId;
    const mine = await writeCard({ front: 'A card only the file has' });
    await editCard(shipped, { front: 'Edited only in the file' });
    const doomed = await writeCard({ front: 'Answered here, deleted later' });
    // Answered, so the file carries a review record for a card of somebody's
    // own — which is what the tombstone case below turns on.
    state.recs[doomed.id] = {
      st: 'r', step: 0, ivl: 4, ea: 2.5, due: Date.now() + 4 * 86400000, rp: 2, lp: 0, pv: 0,
    };
    writeNow();
    return { shipped, mine: mine.id, doomed: doomed.id };
  });
  // A note beside them, because the sentence has to name three things at once
  // and it used to be built out of nested conditionals — which is how a deck
  // full of hand-written cards came to be told it held nothing but settings.
  await page.click('#notes-open');
  await page.fill('#notes-text', 'A note beside the cards');
  await page.click('#notes-save');
  await page.click('#notes-close');
  await page.click('[data-go="stats"]');
  const offer = await page.evaluate(() =>
    document.getElementById('backup-state').textContent);
  ok(/your 1 note, the 3 cards you have written or edited and your settings\./.test(offer),
    `the line above the button counts the whole layer, edits and all (${offer})`);
  ok(await page.evaluate(() => /your own\s+cards are merged/.test(
    document.getElementById('backup-state').previousElementSibling.textContent)),
  'and the standing copy above it does not promise a restore replaces them');

  // The anchor's click is stubbed rather than the Blob URL, the way notes.mjs
  // does it: the file the app hands the browser is exactly what is read here.
  const exported = await page.evaluate(async () => {
    let captured = null;
    const create = URL.createObjectURL;
    const click = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => { captured = blob; return create.call(URL, blob); };
    HTMLAnchorElement.prototype.click = function () {};
    document.getElementById('export-btn').click();
    URL.createObjectURL = create;
    HTMLAnchorElement.prototype.click = click;
    return {
      text: await captured.text(),
      toast: document.getElementById('toast').textContent,
      stateDoc: localStorage.getItem(KEY),
    };
  });
  const payload = JSON.parse(exported.text);
  const live = Object.entries(payload.cards || {}).filter(([, rec]) => rec.front);
  ok(live.length === 3 && payload.cards[wrote.mine].front === 'A card only the file has'
      && payload.cards[wrote.shipped].was,
  `the file carries the layer as its own block, fingerprints and all (${live.length} records)`);
  ok(payload.cardsWritten === 2 && payload.cardsWithHistory === 1,
    `and is stamped with what a person opening it would want to know (${payload.cardsWritten} written)`);
  ok(!('cards' in JSON.parse(exported.stateDoc)),
    'while the review document on the device still holds no cards key of its own');
  ok(exported.toast === 'Exported 1 card of history, 1 note and '
      + '3 cards you have written or edited.',
  `and the app says that is what it exported, in one sentence (${exported.toast})`);
  ok(errors.length === 0, `exporting a layer raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();

  /* Restore merges the two layers, exactly as it merges the two sets of notes.
   * Replacing would be the wrong answer twice over: the cards are the other
   * document and never travelled inside this one, and a card somebody wrote is
   * the one thing in the file nothing else can reproduce. */
  const next = await coursePage();
  const dialogs = watchDialogs(next.page);
  const here = await next.page.evaluate(async () => {
    const own = await writeCard({ front: 'Only on the restoring device' });
    writeNow();
    return own.id;
  });
  await next.page.click('[data-go="stats"]');
  await restore(next.page, payload);
  const landed = await next.page.evaluate((ids) => ({
    mine: !!byId.get(ids.mine),
    here: !!byId.get(ids.here),
    doomed: !!byId.get(ids.doomed),
    shipped: byId.get(ids.shipped)?.front,
    records: Object.keys(state.recs).length,
    written: liveCardCount(),
    toast: document.getElementById('toast').textContent,
  }), Object.assign({ here }, wrote));
  ok(landed.mine && landed.here && landed.doomed,
    'a restore keeps the cards on both sides, the way it keeps the notes');
  ok(/Edited only in the file/.test(landed.shipped || ''),
    `and an edit over a course card arrives applied to the card it is about (${landed.shipped})`);
  ok(landed.records === 1 && landed.written === 4,
    `the review history in the file lands on the card it belongs to (${landed.records} records, ${landed.written} cards)`);
  ok(/merged too/.test(dialogs.asked.join(' ')) && /are all kept/.test(dialogs.asked.join(' ')),
    `the confirm said what would happen to them before it happened (${dialogs.asked.join(' | ')})`);
  ok(/4 cards you have written or edited/.test(landed.toast),
    `and the message afterwards counts them (${landed.toast})`);

  /* The sharp edge, on the restore path. The same file again, over a device
   * that has since deleted one of its cards: the delete is the newer record and
   * it stands, so the history the file is putting back has nothing left to be
   * about. It goes, and it is said — a number on Progress falling on its own is
   * exactly what somebody notices a week later and cannot explain. */
  await next.page.evaluate((id) => deleteCard(id), wrote.doomed);
  await restore(next.page, payload);
  const after = await next.page.evaluate((id) => ({
    inDeck: !!byId.get(id),
    record: Object.hasOwn(state.recs, id),
    stored: Object.hasOwn(
      JSON.parse(localStorage.getItem(KEY)).recs, id),
    toast: document.getElementById('toast').textContent,
  }), wrote.doomed);
  ok(!after.inDeck,
    'an older file does not resurrect a card deleted on this device');
  ok(!after.record && !after.stored,
    'and the review history it brought back for that card does not stay behind it');
  // And said as what it is. The card was deleted HERE, so the sentence about a
  // card another device deleted is not the one this is: what happened is that a
  // file offered history back for a card that is not in this deck any more.
  ok(/deleted on this device/.test(after.toast) && /did not come back/.test(after.toast),
    `said out loud rather than found later (${after.toast})`);
  ok(!/another device/.test(after.toast),
    'and not blamed on a device that had nothing to do with it');
  ok(next.errors.length === 0,
    `restoring a layer raises no page errors (${next.errors.join(' | ') || 'none'})`);
  await next.ctx.close();
}

/* Erasing progress offers to erase review history, and that is all it takes.
 * The cards are in a document that button never touches — which is exactly why
 * it has to say so, because a person about to erase a deck cannot be left
 * guessing whether the cards they wrote into it count as review history. */
{
  const { ctx, page, errors } = await coursePage({}, 'competent-crew');
  const dialogs = watchDialogs(page);
  const mine = await page.evaluate(async () => {
    const shipped = DECK.cards[0].cardId;
    const wrote = await writeCard({ front: 'Kept across an erase' });
    await editCard(shipped, { front: 'Fixed, and still fixed afterwards' });
    startSession(null, {});
    reveal();
    answer(3);
    writeNow();
    leaveStudy(false);
    return { id: wrote.id, shipped };
  });
  await page.click('[data-go="stats"]');
  await page.click('.setup-btn:visible');
  await page.click('#setup-keeping');
  await page.click('#reset-btn');
  await page.waitForFunction(() => state.answers === 0);
  await page.evaluate(() => writeNow());
  const kept = await page.evaluate((ids) => ({
    records: Object.keys(state.recs).length,
    inDeck: !!byId.get(ids.id),
    shipped: byId.get(ids.shipped)?.front,
    stored: Object.values(JSON.parse(localStorage.getItem(CARDS_KEY)).cards)
      .filter((rec) => rec.front).length,
    toast: document.getElementById('toast').textContent,
  }), mine);
  ok(kept.records === 0, 'erasing progress still erases every review');
  ok(kept.inDeck && kept.stored === 2 && /still fixed/.test(kept.shipped || ''),
    `and keeps the layer it never offered to destroy (${kept.stored} records)`);
  ok(/2 cards you have written or edited/.test(dialogs.asked.join(' '))
      && /are kept/.test(dialogs.asked.join(' ')),
  `the confirm says so before it is pressed (${dialogs.asked.join(' | ')})`);
  ok(/2 cards you have written or edited are still here/.test(kept.toast),
    `and the message afterwards says it again (${kept.toast})`);
  ok(errors.length === 0, `erasing with a layer raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* ── a deck of your own ───────────────────────────────────────────────────
 *
 * A deck nobody shipped. Its own card is in its own document, because a course
 * with no cards is not a document the reader will take and so the deck had to
 * be created by that card; every card after it is in the layer, exactly as in
 * any other deck. Two homes for a card somebody wrote, and the point of this
 * section is that the app has one model for them: the deck's document is what
 * this deck ships, and the layer goes over the top of it.
 *
 * Made through the screen a person makes one on, rather than by writing a
 * document into the database: what the creation path stores is half of what is
 * being asserted here. */
async function ownDeckPage(name, front, back) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.shelf.on');
  await page.click('[data-byo]');
  await page.waitForSelector('#imp-mine');
  await page.click('#imp-mine');
  await page.waitForSelector('#byo-deck-name');
  await page.fill('#byo-deck-name', name);
  await page.fill('#byo-card-front', front);
  if (back) await page.fill('#byo-card-back', back);
  await page.click('#byo-card-save');
  await page.waitForSelector('[data-open]', { timeout: 15000 });
  await Promise.all([page.waitForEvent('load'), page.click('[data-open]')]);
  await page.waitForFunction(() => document.getElementById('boot').hidden,
    null, { timeout: 20000 });
  return { ctx, page, errors };
}

{
  const { ctx, page, errors } = await ownDeckPage(
    'Ropework', 'What knot **joins** two ropes of a size?', 'A sheet bend.');
  const dialogs = watchDialogs(page);

  const alone = await page.evaluate(async () => {
    const only = DECK.cards[0].cardId;
    openCardSheet({ cardId: only });
    const refused = await removeCardFromSheet();
    const said = document.getElementById('card-say').textContent;
    closeCardSheet(false);
    return {
      only,
      inLayer: Object.keys(JSON.parse(localStorage.getItem(CARDS_KEY) || '{"cards":{}}').cards).length,
      yours: DECK.cards[0]._yours === true,
      ok: refused.ok,
      said,
    };
  });
  ok(!alone.ok && /only card in this deck/.test(alone.said)
      && /courses screen/.test(alone.said),
  `the card that made the deck cannot leave it while it is the only one (${alone.said})`);
  ok(alone.inLayer === 0,
    'and until something is written the layer over this deck holds nothing at all');
  ok(alone.yours, 'the card in the deck’s own document still reads as a card you wrote');

  const both = await page.evaluate(async () => {
    const wrote = await writeCard({ front: 'What knot makes a fixed loop?', back: 'A bowline.' });
    startSession(null, {});
    reveal();
    answer(3);
    reveal();
    answer(3);
    writeNow();
    leaveStudy(false);
    go('browse');
    document.querySelector('.btile')?.click();
    return { id: wrote.id, answered: Object.keys(state.recs).length };
  });
  await page.waitForTimeout(200);
  const notices = await page.$$eval('.b-mine', (nodes) => nodes.map((node) => node.textContent));
  ok(notices.length === 2 && notices.every((t) => /Written by you/.test(t)),
    `Browse says who wrote each of them, wherever it lives (${notices.join(' | ')})`);
  ok(both.answered === 2, 'both are answered like any other card');

  /* The two of them go different ways, and that is the difference the two homes
   * make. The card in the deck's own document is hidden — taken out of the
   * deck, its record kept, its history kept, free to bring back. The one in the
   * layer is deleted, which is permanent and takes the answers with it. */
  const hidden = await page.evaluate(async (only) => {
    openCardSheet({ cardId: only });
    const result = await removeCardFromSheet();
    return {
      ok: result.ok,
      cards: DECK.cards.length,
      records: Object.keys(state.recs).length,
      list: hiddenCards().length,
    };
  }, alone.only);
  ok(hidden.ok && hidden.cards === 1 && hidden.list === 1,
    `the card the deck was made by is hidden rather than deleted (${hidden.cards} card left)`);
  ok(hidden.records === 2, 'so the history of answering it stays, because bringing it back is free');

  const back = await page.evaluate(async (only) => {
    const result = await revertCard(only);
    return { ok: result.ok, cards: DECK.cards.length, front: byId.get(only)?.front || '' };
  }, alone.only);
  ok(back.ok && back.cards === 2 && /<strong>joins<\/strong>/.test(back.front),
    'and bringing it back is one press, on the card that was written');

  const deleted = await page.evaluate(async (ids) => {
    openCardSheet({ cardId: ids.id });
    const gone = await removeCardFromSheet();
    openCardSheet({ cardId: ids.only });
    const refused = await removeCardFromSheet();
    const said = document.getElementById('card-say').textContent;
    closeCardSheet(false);
    return {
      gone: gone.ok,
      cards: DECK.cards.length,
      records: Object.keys(state.recs).length,
      refused: refused.ok,
      said,
    };
  }, { id: both.id, only: alone.only });
  ok(deleted.gone && deleted.cards === 1 && deleted.records === 1,
    'the one in the layer is deleted for good, and takes the history of answering it');
  ok(dialogs.asked.some((m) => /answered it 1 time/.test(m)),
    `having asked first, with the number that makes it a decision (${dialogs.asked.join(' | ')})`);
  ok(!deleted.refused && /only card in this deck/.test(deleted.said),
    'and the last card standing is refused again, however it got to be the last one');

  await reload(page);
  const after = await page.evaluate(() => ({
    cards: DECK.cards.length,
    yours: DECK.cards.filter((c) => c._yours === true).length,
    front: DECK.cards[0].front,
  }));
  ok(after.cards === 1 && after.yours === 1 && /<strong>joins<\/strong>/.test(after.front),
    'and a cold open reads the deck’s own document back the same way');
  ok(errors.length === 0,
    `a deck of your own raises no page errors (${errors.slice(0, 2).join(' | ') || 'none'})`);
  await ctx.close();
}

/* Editing the card a deck was made by is an override, like any other edit over
 * a card a deck ships — which is what makes it free to take back. There is no
 * second write path into the document, and there had better not be: store.put()
 * clears a deck's whole media range before it rewrites it. */
{
  const { ctx, page, errors } = await ownDeckPage('Tides', 'What is a spring tide?');
  const edited = await page.evaluate(async () => {
    const only = DECK.cards[0].cardId;
    await editCard(only, { front: 'What is a **spring** tide?', back: 'The biggest of the month.' });
    return {
      only,
      front: byId.get(only).front,
      record: JSON.parse(localStorage.getItem(CARDS_KEY)).cards[only],
      inDocument: 1,
    };
  });
  ok(/<strong>spring<\/strong>/.test(edited.front),
    'the card the deck was made by can be fixed from inside the deck');
  ok(!!edited.record && !!edited.record.was,
    'as an override in the layer, fingerprinted against what the document holds');
  const stored_ = await page.evaluate(async () => {
    const id = localStorage.getItem('munin/last-course');
    const deck = (await (await import('./lib/store.js')).get(id)).deck;
    return { cards: deck.cards.length, front: deck.cards[0].front };
  });
  ok(stored_.cards === 1 && stored_.front === 'What is a spring tide?',
    'the deck’s own document is untouched by it, which is what makes the edit free to undo');
  const reverted = await page.evaluate(async (only) => {
    await revertCard(only);
    return byId.get(only).front;
  }, edited.only);
  ok(!/<strong>/.test(reverted) && /spring tide/.test(reverted),
    `and showing the original brings back the card that was written (${reverted})`);
  ok(errors.length === 0,
    `editing a deck of your own raises no page errors (${errors.slice(0, 2).join(' | ') || 'none'})`);
  await ctx.close();
}

/* Cards go where the deck goes. store.remove() takes both documents as the deck
 * is removed, and the shell sweeps whatever a still-open tab wrote back, every
 * time the shelf draws — from a list it actually has, never from an empty one.
 * The removal itself is in importer-ui.mjs, where there is a real deck to
 * remove; this is the sweep behind it. */
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.shelf');
  await page.evaluate(() => {
    const doc = JSON.stringify({ v: 1, cards: { 'u.aabbccddeeff': {
      at: 1, ed: 1, front: 'a card in a deck that is going away', back: '',
    } } });
    localStorage.setItem('munin/local-abcdef12/cards/v1', doc);
    localStorage.setItem('munin/day-skipper/cards/v1', doc);
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.shelf');
  let swept = false;
  try {
    await page.waitForFunction(
      () => localStorage.getItem('munin/local-abcdef12/cards/v1') === null,
      null, { timeout: 5000 });
    swept = true;
  } catch (e) { swept = false; }
  const builtIn = await page.evaluate(() =>
    localStorage.getItem('munin/day-skipper/cards/v1'));
  ok(swept, 'the cards written into a deck that is no longer here go with its progress');
  ok(builtIn && JSON.parse(builtIn).cards['u.aabbccddeeff'].front,
    'a course that is still here keeps its layer when the shelf sweeps');
  ok(errors.length === 0, `the orphan sweep raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* ── what the four reviews found, held down ──────────────────────────────── */

/* A ceiling that only ever bit in memory.
 *
 * The cards block arrives at the joint pass already held to 200 by its own
 * sanitiser, so the joint pass has nothing left to take and answers "nothing
 * moved" — and nobody wrote the shorter document back over the longer one. The
 * next boot dropped the same fifty records and said so again, for ever. */
{
  const { ctx, page, errors } = await coursePage();
  await page.evaluate(() => {
    const cards = {};
    const now = Date.now();
    for (let i = 0; i < 250; i++) {
      cards['u.' + i.toString(16).padStart(8, '0')] = {
        at: now - i * 1000, ed: now - i * 1000, front: 'q' + i, back: 'a' + i, section: '',
      };
    }
    localStorage.setItem(CARDS_KEY, JSON.stringify({ v: 1, cards }));
  });
  await reload(page);
  await page.waitForFunction(() =>
    /could not be kept/.test(document.getElementById('toast').textContent));
  const first = await page.evaluate(() => ({
    live: liveCardCount(),
    stored: Object.keys(JSON.parse(localStorage.getItem(CARDS_KEY)).cards).length,
  }));
  await reload(page);
  await page.waitForTimeout(400);
  const second = await page.evaluate(() => ({
    toast: document.getElementById('toast').textContent,
    stored: Object.keys(JSON.parse(localStorage.getItem(CARDS_KEY)).cards).length,
  }));
  ok(first.live === 200 && first.stored === 200,
    `a cards document over the ceiling is written back at the ceiling (${first.stored} stored)`);
  ok(second.toast === '' && second.stored === 200,
    `so the next boot has nothing left to drop and says nothing (${second.toast || 'silent'})`);
  ok(errors.length === 0, `holding the ceiling to disk raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Two blocks losing at once, in one sentence.
 *
 * Three toasts in a row wrote over each other on the one element, and each
 * counter is read and cleared where it is counted — so a boot that dropped
 * notes AND cards said only the cards, and the notes were never mentioned on
 * that boot or on any boot after it. */
{
  const { ctx, page, errors } = await coursePage();
  await page.evaluate(() => {
    const now = Date.now();
    state.notes = {};
    const cards = {};
    for (let i = 0; i < 150; i++) {
      state.notes['n' + i.toString(36).padStart(4, '0')] =
        { at: now, ed: now - i * 2, text: 'note ' + i };
      cards['u.' + i.toString(16).padStart(8, '0')] =
        { at: now, ed: now - i * 2 - 1, front: 'q' + i, back: 'a' + i, section: '' };
    }
    writeNow();
    localStorage.setItem(CARDS_KEY, JSON.stringify({ v: 1, cards }));
  });
  await reload(page);
  await page.waitForFunction(() =>
    /could not be kept/.test(document.getElementById('toast').textContent));
  const said = await page.evaluate(() => ({
    toast: document.getElementById('toast').textContent,
    notes: liveNotes().length,
    cards: liveCardCount(),
  }));
  ok(said.notes + said.cards === 200,
    `two legal blocks meeting one ceiling come down to it together (${said.notes} notes, ${said.cards} cards)`);
  ok(/50 notes and 50 cards/.test(said.toast),
    `and one sentence names both, because neither can be said over the other (${said.toast})`);
  ok(errors.length === 0, `the joint drop raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* And what the eviction cost, which is the thing the ceiling exists to protect.
 *
 * Eviction is by edit stamp across both kinds, and a note carries no review
 * history while a card does — so a note edited today beats a card written a
 * year ago, and the ceiling whose stated purpose is to protect the review
 * history is the thing that takes it. It goes; it must not go quietly. */
{
  const { ctx, page, errors } = await coursePage();
  await page.evaluate(() => {
    const now = Date.now();
    state.notes = {};
    state.recs = {};
    const cards = {};
    for (let i = 0; i < 150; i++) {
      state.notes['n' + i.toString(36).padStart(4, '0')] = { at: now, ed: now, text: 'note ' + i };
    }
    for (let i = 0; i < 100; i++) {
      const id = 'u.' + i.toString(16).padStart(8, '0');
      const old = now - 365 * 86400000 - i * 1000;
      cards[id] = { at: old, ed: old, front: 'q' + i, back: 'a' + i, section: '' };
      state.recs[id] = {
        st: 'r', step: 0, ivl: 5, ea: 2.5, due: now, rp: 3, lp: 0, pv: 0,
      };
    }
    writeNow();
    localStorage.setItem(CARDS_KEY, JSON.stringify({ v: 1, cards }));
  });
  await reload(page);
  await page.waitForFunction(() =>
    /could not be kept/.test(document.getElementById('toast').textContent));
  await page.waitForTimeout(400);
  const cost = await page.evaluate(() => ({
    toast: document.getElementById('toast').textContent,
    cards: liveCardCount(),
    recs: Object.keys(state.recs).filter((id) => id.startsWith('u.')).length,
    stored: Object.keys(JSON.parse(localStorage.getItem(KEY)).recs)
      .filter((id) => id.startsWith('u.')).length,
  }));
  ok(cost.cards === 50 && cost.recs === 50 && cost.stored === 50,
    `the history of an evicted card goes with the card, on the device too (${cost.stored} left)`);
  ok(/50 cards/.test(cost.toast) && /What you had answered of 50 of them went with them/.test(cost.toast),
    `and the sentence about the ceiling says what it took (${cost.toast})`);
  ok(errors.length === 0, `the eviction raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* An override for a card the course has since dropped.
 *
 * Built-in ids are a hash of the question, so rewording a question retires the
 * old id and mints a new one, and the override is left keyed to a card that is
 * not in the deck. It is in no list, no screen can reach it, and while it
 * counted as a live card it held a slot against the ceiling this deck shares
 * with its notes and exempted a review record from the sweep for ever. */
{
  const { ctx, page, errors } = await coursePage();
  const ghost = await page.evaluate(async () => {
    const now = Date.now();
    // What a course update leaves behind: an override keyed by an id the deck
    // does not ship, with the review history for it still here.
    cardLayer['deadbeef01'] = { at: now, ed: now, front: 'my fix', back: 'x', was: 'zz.1' };
    state.recs['deadbeef01'] = {
      st: 'r', step: 0, ivl: 3, ea: 2.5, due: now, rp: 4, lp: 0, pv: 0,
    };
    const before = liveCardCount();
    sweepUnknownRecords();
    return {
      before,
      after: liveCardCount(),
      pinned: Object.hasOwn(state.recs, 'deadbeef01'),
      inDeck: byId.has('deadbeef01'),
    };
  });
  ok(!ghost.inDeck && ghost.before === 0 && ghost.after === 0,
    `an override for a card the deck does not ship is not a card you have written (${ghost.after})`);
  ok(!ghost.pinned,
    'and the review history under it is swept like any other card the deck does not have');
  ok(errors.length === 0, `the orphaned override raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* A hidden card is still the exception, which is what the clause above is for. */
{
  const { ctx, page, errors } = await coursePage();
  const kept = await page.evaluate(async () => {
    const id = DECK.cards[0].cardId;
    state.recs[id] = { st: 'r', step: 0, ivl: 3, ea: 2.5, due: Date.now(), rp: 4, lp: 0, pv: 0 };
    await hideCard(id);
    sweepUnknownRecords();
    return { id, inDeck: byId.has(id), kept: Object.hasOwn(state.recs, id) };
  });
  ok(!kept.inDeck && kept.kept,
    'a card you hid keeps what you had answered of it, because bringing it back is free');
  ok(errors.length === 0, `hiding raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Save on a shipped card nobody has touched must change nothing.
 *
 * The first fill escapes the inline markers, and nothing above a text node can
 * see where a line begins — so a question reading "3. Rule three of the
 * collision regulations" came back into the box unchanged and Save stored an
 * ordered list, which draws as "1.". "- 5 degrees of variation" lost its minus
 * sign the same way. The ones the subset has no construct for were refused
 * outright, with a message about Markdown to somebody who never typed any. */
{
  const { ctx, page, errors } = await coursePage();
  const round = await page.evaluate(async () => {
    const shipped = [
      '<p>3. Rule three of the collision regulations</p>',
      '<p>- 5 degrees of variation</p>',
      '<p>+ 5 metres of chain</p>',
      '<p># of crew aboard the yacht</p>',
      '<p>&gt; 30 knots means what force?</p>',
      '<p>---</p>',
      '<p>1) the first thing you do</p>',
      '<p>line one<br>- line two</p>',
      '<ul><li>- not a list inside a list</li><li>plain</li></ul>',
      '<p>Ordinary <strong>bold</strong> and *stars*</p>',
    ];
    const out = [];
    for (const html of shipped) {
      const box = htmlToCardSource(html);
      const checked = await checkCard({ front: box.text });
      out.push({
        html,
        refused: !checked.ok,
        say: checked.say || '',
        again: checked.ok ? await renderCardSide(box.text, '$.cards[0].front') : '',
      });
    }
    return out;
  });
  // The line breaks between blocks are the renderer's own — the shipped HTML has
  // none — so they are taken out of both sides. Everything else has to match:
  // a word, a marker, a tag or a space inside a line.
  const same = (a, b) => a.replace(/\s*\n\s*/g, '') === b.replace(/\s*\n\s*/g, '');
  const refused = round.filter((c) => c.refused);
  const changed = round.filter((c) => !c.refused && !same(c.again, c.html));
  ok(refused.length === 0,
    `a card the course ships is not refused by the boxes it is put into (${
      refused.map((c) => c.html).join(' | ') || 'none refused'})`);
  ok(changed.length === 0,
    `and pressing Save on one nobody has edited gives the card back word for word (${
      changed.map((c) => `${c.html} → ${c.again}`).join(' | ') || 'all identical'})`);
  ok(errors.length === 0, `the first fill raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Writing a card asks for the round trip that carries it.
 *
 * writeNow() schedules a sync after every write to the REVIEW document, and the
 * cards are the other document — so a card fixed from Browse and then put down
 * went nowhere until the next grade, the next setting or the next session. The
 * study dock was covered only by accident, because leaving a session writes
 * review history. */
{
  const { ctx, page, errors } = await coursePage();
  const asked = await page.evaluate(async () => {
    let count = 0;
    const real = DSSync.schedule;
    DSSync.schedule = (...args) => { count++; return real.apply(DSSync, args); };
    const wrote = await writeCard({ front: 'A card written from Browse' });
    const onWrite = count; count = 0;
    await editCard(wrote.id, { front: 'A card written from Browse, fixed' });
    const onEdit = count; count = 0;
    await editCard(DECK.cards[0].cardId, { front: 'An override of a shipped card' });
    const onOverride = count;
    DSSync.schedule = real;
    return { onWrite, onEdit, onOverride, inPayload: !!syncPayload().cards[wrote.id] };
  });
  ok(asked.onWrite === 1 && asked.onEdit === 1 && asked.onOverride === 1,
    `every write to the layer asks for a sync (${asked.onWrite}, ${asked.onEdit}, ${asked.onOverride})`);
  ok(asked.inPayload, 'and what it would send holds the card');
  ok(errors.length === 0, `scheduling raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* A side cut at the ceiling, in code points.
 *
 * An emoji is two code units, so cutting at 2,000 of those can land inside one.
 * On screen that is a replacement character; in the blob it is a lone
 * surrogate, which the server's JSON parser refuses — one card written slightly
 * too long would stop the whole deck syncing. */
{
  const { ctx, page, errors } = await coursePage();
  const cut = await page.evaluate(async () => {
    const wrote = await writeCard({ front: 'a'.repeat(1999) + '\u{1F600}' + 'and more' });
    const record = cardRecord(wrote.id);
    const last = record.front.charCodeAt(record.front.length - 1);
    return {
      ok: wrote.ok,
      points: [...record.front].length,
      lone: last >= 0xd800 && last <= 0xdbff,
      whole: record.front.endsWith('\u{1F600}'),
    };
  });
  ok(cut.ok && cut.points === 2000,
    `a side longer than the ceiling is cut to it, counted in code points (${cut.points})`);
  ok(!cut.lone && cut.whole,
    'and the cut never lands inside a character, so no half of one reaches the blob');
  ok(errors.length === 0, `the long side raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* A blob that would not cross is refused where the card is on screen.
 *
 * The ceilings are counts and have to be, but a count cannot bound bytes and
 * bytes are what the server measures: 200 records at their full length is four
 * times the blob it takes. syncOnce() refuses to send an oversized one, which
 * is right and is also far too late — that refusal stops the review history
 * crossing as well as the writing, and on the other device it names cards that
 * device cannot see. */
{
  const { ctx, page, errors } = await coursePage();
  const full = await page.evaluate(async () => {
    DSSync.turnOn();
    const side = 'x'.repeat(1990);
    let refused = '';
    for (let i = 0; i < 90 && !refused; i++) {
      const wrote = await writeCard({ front: `${side} q${i}`, back: `${side} a${i}` });
      if (!wrote.ok) refused = wrote.say;
    }
    return {
      refused,
      fits: DSSync.blobBytes(syncPayload()) <= DSSync.MAX_BYTES,
      live: liveCardCount(),
      ceiling: DSSync.WRITTEN_LIVE,
      stored: Object.keys(JSON.parse(localStorage.getItem(CARDS_KEY)).cards).length,
    };
  });
  ok(full.fits && full.live < full.ceiling,
    `writing stops at the bytes sync carries, well before the count ceiling (${full.live} of ${full.ceiling})`);
  ok(/as much as sync can carry/.test(full.refused) && /Shorten it/.test(full.refused),
    `and the refusal names the cause and the way out (${full.refused})`);
  ok(full.stored === full.live,
    `while nothing that would not go was stored (${full.stored} stored, ${full.live} live)`);
  ok(errors.length === 0, `the byte bound raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* A deck that does not sync is not held to a server's limit. */
{
  const { ctx, page, errors } = await coursePage();
  const off = await page.evaluate(async () => {
    const side = 'x'.repeat(1990);
    for (let i = 0; i < 70; i++) {
      const wrote = await writeCard({ front: `${side} q${i}`, back: `${side} a${i}` });
      if (!wrote.ok) return { refused: wrote.say, live: liveCardCount() };
    }
    return { refused: '', live: liveCardCount() };
  });
  ok(!off.refused && off.live === 70,
    `with sync off there is no blob to overflow and no refusal to make (${off.live} written)`);
  ok(errors.length === 0, `writing with sync off raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* A cards document that will not parse says so.
 *
 * The sweeps already knew the difference between "no cards" and "the question
 * could not be answered". What nothing did was say it: every card somebody had
 * written was simply missing from Browse, and the obvious thing to do about
 * that — write it again — is the one act that replaces the document. */
{
  const { ctx, page, errors } = await coursePage();
  await page.evaluate(() => {
    localStorage.setItem(CARDS_KEY, '{"v":1,"cards":{"u.aaaa":{');
  });
  await reload(page);
  await page.waitForFunction(() =>
    /could not be read/.test(document.getElementById('toast').textContent));
  const unread = await page.evaluate(() => ({
    toast: document.getElementById('toast').textContent,
    sticky: !document.getElementById('toast').classList.contains('away'),
    loaded: cardLayerLoaded,
  }));
  ok(!unread.loaded && unread.sticky,
    'a cards document that will not open leaves the layer unread rather than empty');
  ok(/could not be read/.test(unread.toast) && /replaces what is stored/.test(unread.toast),
    `and says so, with what writing a card would cost (${unread.toast})`);
  ok(errors.length === 0, `the unreadable document raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Deleting a card here is not another device's doing.
 *
 * mergeState takes the union of the review records and never removes one, so
 * the server's copy of a record this device just deleted comes straight back on
 * the next round — and the sweep that clears it again told the phone that had
 * asked the question that some other device had answered it. */
{
  const { ctx, page, errors } = await coursePage();
  const blame = await page.evaluate(async () => {
    const wrote = await writeCard({ front: 'A card about to be deleted' });
    state.recs[wrote.id] = {
      st: 'r', step: 0, ivl: 5, ea: 2.5, due: Date.now(), rp: 3, lp: 0, pv: 0,
    };
    writeNow();
    // What the server is holding: this device's own blob, from before the
    // delete, with the review record still in it.
    const server = JSON.parse(JSON.stringify(syncPayload()));
    await deleteCard(wrote.id);
    const goneHere = !Object.hasOwn(state.recs, wrote.id);
    const merged = DSSync.mergeState(syncPayload(), server);
    document.getElementById('toast').textContent = '';
    adoptSynced(merged);
    await adopting;
    return {
      goneHere,
      cameBack: Object.hasOwn(merged.recs, wrote.id),
      toast: document.getElementById('toast').textContent,
      stillGone: !Object.hasOwn(state.recs, wrote.id),
    };
  });
  ok(blame.goneHere && blame.cameBack && blame.stillGone,
    'the record a delete took comes back in the union and is taken again');
  ok(blame.toast === '',
    `and the device that did the deleting is not told another device did it (${blame.toast || 'silent'})`);
  ok(errors.length === 0, `the round after a delete raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The layer's line, and Edit, on the row rather than inside the answer.
 *
 * Browse opens as an index of sections and a row's answer is a closed
 * disclosure, so everything inside it needed that specific card's answer opened
 * to be seen at all. That put "the author rewrote this card after you edited
 * it" — and the choice between keeping yours and taking theirs — behind a tap
 * nobody had a reason to make, which is the one outcome `was` exists to
 * prevent. */
{
  const { ctx, page, errors } = await coursePage();
  const cardId = await page.evaluate(async () => {
    const card = DECK.cards.find((c) => c.back);
    await editCard(card.cardId, { front: 'zzq a wording of my own' });
    // The author rewriting it under you is what the fingerprint notices.
    cardRecord(card.cardId).was = 'ffffffff.1';
    await applyCardLayer();
    return card.cardId;
  });
  await browseFor(page, 'zzq');
  const row = await page.evaluate((id) => {
    const li = document.querySelector(`#browse-list li[data-card="${CSS.escape(id)}"]`);
    if (!li) return { missing: true };
    const notice = li.querySelector('.b-moved');
    const details = li.querySelector('details');
    return {
      open: !!(details && details.open),
      noticeHidden: !!(notice && notice.closest('details')),
      keepHidden: !!(li.querySelector('[data-card-keep]')
        && li.querySelector('[data-card-keep]').closest('details')),
      editHidden: !!(li.querySelector('[data-card-edit]')
        && li.querySelector('[data-card-edit]').closest('details')),
      onScreen: li.innerText,
    };
  }, cardId);
  ok(!row.open && !row.noticeHidden && !row.keepHidden,
    'the line saying the author rewrote this card is on the row, not behind its answer');
  // Lowercased by CSS, so read case-insensitively — the gotcha the README
  // records for every other assertion about the app's own chrome.
  const shown = row.onScreen.toLowerCase();
  ok(!row.editHidden && /edit/.test(shown),
    `and so is Edit, which is what "fix a card from wherever you hit it" means (${
      row.onScreen.replace(/\s+/g, ' ').slice(0, 120)})`);
  ok(/rewrote this card/.test(shown) && /keep yours/.test(shown) && /take theirs/.test(shown),
    'so the choice is on screen without opening anything');
  ok(errors.length === 0, `the row's own line raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* And a row action leaves focus in the page it rebuilt. */
{
  const { ctx, page, errors } = await coursePage();
  const watcher = watchDialogs(page);
  const cardId = await page.evaluate(async () => {
    const card = DECK.cards.find((c) => c.back);
    await editCard(card.cardId, { front: 'zzq a wording of my own' });
    cardRecord(card.cardId).was = 'ffffffff.1';
    await applyCardLayer();
    return card.cardId;
  });
  await browseFor(page, 'zzq');
  const landed = await page.evaluate(async (id) => {
    const li = document.querySelector(`#browse-list li[data-card="${CSS.escape(id)}"]`);
    const keep = li.querySelector('[data-card-keep]');
    keep.focus();
    keep.click();
    await new Promise((res) => setTimeout(res, 600));
    return {
      tag: document.activeElement.tagName,
      text: (document.activeElement.textContent || '').trim().slice(0, 20),
    };
  }, cardId);
  ok(landed.tag !== 'BODY',
    `keeping your version puts focus back on the list it rebuilt (${landed.tag} ${landed.text})`);
  ok(watcher.asked.length === 0, 'and asks nothing, because nothing about it is permanent');
  ok(errors.length === 0, `the row action raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The cards you hid belong to the deck, so they close when what is on screen
 * changes rather than sitting above a count that describes something else. */
{
  const { ctx, page, errors } = await coursePage();
  await page.evaluate(async () => { await hideCard(DECK.cards[0].cardId); });
  await page.click('[data-go="browse"]');
  await page.waitForTimeout(200);
  await page.click('#browse-hidden');
  await page.waitForSelector('#hidden-list:not([hidden])');
  const opened = await page.evaluate(() =>
    document.querySelectorAll('#hidden-list li').length);
  await page.fill('#search', 'spring tide');
  await page.waitForTimeout(500);
  const searched = await page.evaluate(() => ({
    open: !document.getElementById('hidden-list').hidden,
    offered: !document.getElementById('browse-hidden').hidden,
  }));
  await page.click('[data-go="home"]');
  await page.waitForTimeout(200);
  await page.click('[data-go="browse"]');
  await page.waitForTimeout(300);
  const returned = await page.evaluate(() =>
    !document.getElementById('hidden-list').hidden);
  ok(opened === 1, `the list opens on the cards you hid (${opened})`);
  ok(!searched.open && searched.offered,
    'a search closes it, and leaves the way back to it one press away');
  ok(!returned, 'and leaving Browse does not bring it back open over something else');
  ok(errors.length === 0, `the hidden list raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* A deck of one card, counted in words rather than in numbers.
 *
 * A deck written here starts at exactly one card in exactly one section, which
 * is what made every "N cards" in the app reachable at one. */
{
  const { ctx, page, errors } = await fixturePage({
    format: 1,
    name: 'One card',
    course: 'day-skipper',
    sections: [{ k: 'only', t: 'Only section', n: 1, o: 1 }],
    cards: [{ i: 'aaaaaaaa01', s: 'only', q: '<p>The only question</p>', a: '<p>The only answer</p>' }],
  });
  const said = await page.evaluate(() => {
    go('home');
    const row = document.querySelector('#section-list button');
    go('stats');
    return {
      meta: row.querySelector('.sect-meta').textContent,
      label: row.getAttribute('aria-label'),
      note: document.getElementById('today-note').textContent,
      build: document.getElementById('build-line').textContent,
    };
  });
  ok(/\b1 card\b/.test(said.meta) && !/1 cards/.test(said.meta),
    `Home's section row counts one card as one card (${said.meta})`);
  ok(!/1 cards/.test(said.label),
    `and so does the label the button is read out under (${said.label})`);
  ok(!/all 1 in/.test(said.note),
    `the pacing does not say "all 1" about a deck of one (${said.note})`);
  ok(!/1 cards/.test(said.build),
    `and neither does the build line on Progress (${said.build})`);
  ok(errors.length === 0, `a deck of one card raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

await b.close();
console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
