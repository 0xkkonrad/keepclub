/* Cards you write, as the layer underneath the editor: a card of your own in a
 * deck the app ships, an edit over a card the course wrote, a card taken out,
 * and every one of them still there after a reload.
 *
 * Browser-level like the notes suite, and for the same reason: none of this
 * lives in one function. A card is written through the single-writer rule,
 * stored in its own per-deck document, rendered from Markdown to sanitized HTML
 * by the course reader, merged into DECK.cards before the indexes are built,
 * and re-validated by the load sanitiser on the way back.
 *
 * The last case in this file is the one that matters most: the boot sweep
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

const reload = async (page) => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
};

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

await b.close();
console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
