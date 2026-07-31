/* Writing a deck out, as the file itself and as the screen that offers it.
 *
 * The promise this feature makes is narrow enough to state in one sentence, so
 * it is gated in one place: every card in a file keep club writes comes back
 * word for word and under the same id, and nothing else in it does. Everything
 * below is either that sentence or one of the ways of not keeping it.
 *
 * Half of this is pure and runs in node against web/lib/course-export.js: the
 * document, the emitter, the gate, and the text a person can type that a YAML
 * writer can lose — quotes, colons, leading dashes, hard breaks, control
 * characters and astral pairs. The other half is browser-level for the same
 * reason authoring.mjs is: what a file holds depends on the layer, the deck and
 * the reader, and none of that lives in one function.
 *
 * The case that matters most is the unreadable layer. Exporting over one writes
 * a short file that looks like proof there was nothing there, so it is refused
 * before any count is taken — every count would be a count of nothing.
 */
import { chromium } from 'playwright-core';
import {
  buildDeckExport, deckFileShape, emitCourseYaml, exportFileName, writeCourseFile,
} from '../web/lib/course-export.js';
import { readCourseFile } from '../web/lib/course-package.js';
import { courseSchema, validate } from './json-schema.mjs';

const EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || chromium.executablePath();
const URL_ = process.env.MUNIN_URL || 'http://127.0.0.1:8777/projects/keepclub/web/';
const out = [], fails = [];
const ok = (c, m) => (c ? out : fails).push((c ? 'PASS  ' : 'FAIL  ') + m);
/* Fixed, so that two exports of one deck are byte-identical and a failure here
 * is never yesterday's date. */
const NOW = new Date(2026, 6, 31, 9, 30, 0);

const shippedDeck = (cards, extra = {}) => ({
  courseId: 'day-skipper', title: 'RYA Day Skipper', cards, ...extra,
});
const layerRecord = (front, back = '', at = 1, extra = {}) =>
  ({ at, ed: at, front, back, ...extra });

/* ── the file, in node ── */

/* Everything a person can type that a YAML writer can quietly change under
 * them. Each one is written into the layer, exported, and read back through the
 * reader the importer uses — not through a second parser, which could agree
 * with the emitter about something they were both wrong about. */
{
  /* The escapes are the app's own: cardSourceLine() puts a backslash in front
   * of a leading list, quote or heading marker on the way into the boxes, so
   * "3. Rule three" is what a person sees and `3\\.` is what the layer holds.
   * Anything the reader would refuse is not the exporter's problem: these are
   * all texts a card can actually be saved with. */
  const hostile = [
    ['plain prose', 'A plain question with nothing special in it.'],
    ['colon', 'Rule 5: what does it require?'],
    ['leading dash', '\\- 5 degrees of variation'],
    ['leading hash', '\\# of crew aboard the yacht'],
    ['ordered list', '3\\. Rule three of the collision regulations'],
    ['double quotes', 'What does "starboard" mean?'],
    ['single quotes', "What is a 'spring line' for?"],
    ['markdown', 'What does **springing off** mean, in *one* line?'],
    ['hard break', 'One black ball, forward.  \nBy night, an all-round white light.'],
    ['blank line', 'First paragraph.\n\nSecond paragraph.'],
    ['bullet list', '- one\n- two'],
    ['link', 'See [the rules](https://example.org/rules).'],
    ['tab', 'Column one\tcolumn two'],
    ['carriage return', 'A line\rand another'],
    ['crlf', 'A line\r\nand another'],
    ['astral', 'Which flag is 𝄞 and which is 🚢?'],
    ['combining marks', 'Qué significa la señal?'],
    ['trailing spaces', 'Ends in three spaces   '],
    ['yaml keywords', 'null'],
    ['yaml booleans', 'yes'],
    ['document marker', '\\-\\-\\-'],
    ['long line', `${'a very long clause that keeps going '.repeat(30)}end`],
    ['anchor characters', '&anchor \\*alias <<merge'],
    ['brace flow', '{a: 1, b: [2, 3]}'],
  ];
  const layer = {};
  hostile.forEach(([, text], index) => {
    layer[`u.${index.toString(16).padStart(4, '0')}`] = layerRecord(text, `back of ${text}`, index + 1);
  });
  const file = await writeCourseFile({
    kind: 'layer', stored: null, shipped: shippedDeck([]), layer, own: false, now: NOW,
  });
  ok(file.ok, `hostile card text produces a file the reader accepts (${file.say || 'clean'})`);
  const back = await readCourseFile(file.text, { fileName: file.fileName });
  const returned = new Map((back.authoredCourse?.cards || []).map((c) => [c.cardId, c]));
  const lost = hostile.filter(([, text], index) => {
    const card = returned.get(index.toString(16).padStart(4, '0'));
    return !card || card.front !== text || card.back !== `back of ${text}`;
  });
  ok(lost.length === 0,
    `every one of the ${hostile.length} hostile card texts comes back byte for byte (${
      lost.map(([name]) => name).join(', ') || 'none lost'})`);
  ok(!/\n&|\n\s*\*[a-z]/.test(file.text) && !back.diagnostics.some((d) =>
    d.code === 'document.disallowed_anchor'),
  'and none of it makes the emitter write an anchor or an alias');
}

/* A card with no answer stays a card with no answer: `back: ''` parses and
 * warns, and omitting the key is what makes a front-only card front-only. */
{
  const file = await writeCourseFile({
    kind: 'layer',
    stored: null,
    shipped: shippedDeck([]),
    layer: { 'u.aa': layerRecord('Front only, no answer.') },
    own: false,
    now: NOW,
  });
  ok(file.ok && !/back:/.test(file.text),
    'a card with no answer is written with no back key rather than a blank one');
  ok(!file.diagnostics.some((d) => d.code === 'field.empty_back'),
    'so the reader never has to remove one');
  ok(!/undefined/.test(file.text), 'and nothing anywhere is emitted as undefined');
}

/* The two warnings a layer export always raises are expected and are not bugs.
 * Inventing an author to silence one would be the worse outcome: keep club does
 * not know who is at the keyboard. */
{
  const file = await writeCourseFile({
    kind: 'layer',
    stored: null,
    shipped: shippedDeck([]),
    layer: { 'u.aa': layerRecord('A question.', 'An answer.') },
    own: false,
    now: NOW,
  });
  const codes = file.diagnostics.map((d) => d.code).sort();
  ok(file.ok && codes.join(', ') === 'course.missing_description, metadata.missing_attribution',
    `a layer export raises exactly the two expected warnings and no errors (${codes.join(', ')})`);
}

/* Written ids lose the reserved prefix, deterministically, and a derived id
 * that would collide with a card the course already ships is moved rather than
 * left to be refused as a duplicate. */
{
  const shipped = shippedDeck([{ cardId: 'a1b2c3d4e5', front: '<p>Shipped</p>' }]);
  const layer = {
    a1b2c3d4e5: layerRecord('An edit over the shipped card.', 'Its answer.', 1, { was: 'x' }),
    'u.a1b2c3d4e5': layerRecord('A card of my own whose id collides.', '', 2),
    'u.beefbeefbeef': layerRecord('A card of my own that does not.', '', 3),
  };
  const first = await writeCourseFile({
    kind: 'layer', stored: null, shipped, layer, own: false, now: NOW,
  });
  const second = await writeCourseFile({
    kind: 'layer', stored: null, shipped, layer, own: false, now: NOW,
  });
  const ids = first.document.cards.map((card) => card.cardId);
  ok(first.ok && ids.join(', ') === 'a1b2c3d4e5, a1b2c3d4e5.1, beefbeefbeef',
    `a written id loses "u." and moves aside where the course already owns it (${ids.join(', ')})`);
  ok(!ids.some((id) => id.startsWith('u.')),
    'and no reserved id reaches the file, which the reader refuses outright');
  ok(first.text === second.text,
    'two exports of one deck on one day are byte-identical, so the ids are stable');
}

/* The whole deck, from a document with sections and groups: hides taken out,
 * overrides in place, the cards you wrote in a section of their own — with a
 * titled group, because an ungrouped section and an untitled group are both
 * refused. applyCardLayer() writes exactly that shape into DECK with an empty
 * group title, which is legal there and illegal here. */
const knots = {
  schemaVersion: 2,
  courseId: 'knot-basics',
  title: 'Knot basics',
  authors: [{ name: 'Jane Roe' }],
  license: { identifier: 'CC-BY-SA-4.0' },
  sections: [
    { sectionId: 'bends', title: 'Bends' },
    { sectionId: 'hitches', title: 'Hitches' },
  ],
  groups: [{ groupId: 'rope', title: 'Rope work', sectionIds: ['bends', 'hitches'] }],
  cards: [
    { cardId: 'sheet-bend', sectionId: 'bends', front: 'Sheet bend?', back: 'Two ropes.' },
    { cardId: 'reef-knot', sectionId: 'bends', front: 'Reef knot?', back: 'Two ends.' },
    { cardId: 'clove-hitch', sectionId: 'hitches', front: 'Clove hitch?', back: 'A post.' },
  ],
};
{
  const layer = {
    'clove-hitch': layerRecord('Clove hitch — when?', 'Around a post, quickly.', 1, { was: 'y' }),
    'reef-knot': { at: 2, ed: 2, front: '', back: '', hidden: true },
    'u.aabbccddeeff': layerRecord('Bowline?', 'A fixed loop.', 3, { section: 'nowhere' }),
  };
  const file = await writeCourseFile({
    kind: 'whole',
    stored: knots,
    shipped: { courseId: 'knot-basics', title: 'Knot basics', cards: [] },
    layer,
    own: false,
    now: NOW,
  });
  const doc = file.document;
  ok(file.ok, `a whole deck with a layer over it produces a file the reader accepts (${file.say || 'clean'})`);
  ok(doc.courseId === 'knot-basics.yours',
    `a file with your cards folded in goes out under an id of its own (${doc.courseId})`);
  ok(doc.cards.length === 3 && !doc.cards.some((c) => c.cardId === 'reef-knot'),
    `the card you hid is not in it (${doc.cards.map((c) => c.cardId).join(', ')})`);
  ok(doc.cards.find((c) => c.cardId === 'clove-hitch').front === 'Clove hitch — when?',
    'the card you edited carries your words under the course’s own id');
  ok(doc.sections.some((s) => s.sectionId === 'cards-you-wrote' && s.title)
      && doc.groups.some((g) => g.sectionIds.includes('cards-you-wrote') && g.title),
  'a card you wrote gets a titled section and a titled group rather than u.loose');
  ok(JSON.stringify(doc.authors) === JSON.stringify(knots.authors)
      && JSON.stringify(doc.license) === JSON.stringify(knots.license),
  'and the author and licence the deck came with travel with it');
  ok(doc.extensions['app.keepclub/export'].kind === 'whole-deck'
      && doc.extensions['app.keepclub/export'].from === 'knot-basics'
      && doc.extensions['app.keepclub/export'].exportedOn === '2026-07-31',
  'the file says what it is and where it came from, in the only machine-readable place there is');
  ok(!/\bhidden\b|\bwas:|\bed:|\brp:/.test(file.text),
    'and nothing of the layer’s own bookkeeping is in the text');
}

/* Nothing of yours, and the deck keeps its own identity — which is what makes
 * two exports of an untouched deck the same file, and what lets one of them be
 * an update to the deck it came from rather than a second row. */
{
  const file = await writeCourseFile({
    kind: 'whole',
    stored: knots,
    shipped: { courseId: 'knot-basics', title: 'Knot basics', cards: [] },
    layer: {},
    own: false,
    now: NOW,
  });
  ok(file.ok && file.document.courseId === 'knot-basics',
    `a deck with nothing of yours in it keeps the id it came with (${file.document.courseId})`);
  ok(file.fileName === 'knot-basics.keep.yml',
    `and is named for its title rather than for a course id (${file.fileName})`);
}

/* THE FORK, IN BOTH OF THE THINGS THE IMPORTER MATCHES ON.
 *
 * A file with your cards folded in must never land back on the deck it came
 * from. match() identifies a file by its course id first and by its title after
 * it (`web/import.js:756, 772`), and the second match is the destructive one —
 * "a different deck under the same name" clears the state document and the
 * layer. So a fork that changes only the id is a fork that still lands, and
 * takes the notes and the review history with it.
 *
 * Each case below is one way of handing back the value the fork has to differ
 * from. */
{
  const shipped = { courseId: 'knot-basics', title: 'Knot basics', cards: [] };
  const mine = { 'u.aabbccddeeff': layerRecord('Bowline?', 'A fixed loop.', 3) };
  const forked = await buildDeckExport({
    kind: 'whole', stored: knots, shipped, layer: mine, own: false, now: NOW,
  });
  ok(forked.courseId !== knots.courseId && forked.title !== knots.title,
    `a forked file differs from the deck it came from in the id and in the title (${
      forked.courseId} / ${forked.title})`);
  ok(forked.document.title === forked.title && /with your cards/.test(forked.title),
    `and the title says which of the two files this is (${forked.document.title})`);

  const ceiling = 'c'.repeat(128);
  const atCeiling = await buildDeckExport({
    kind: 'whole',
    stored: { ...knots, courseId: ceiling },
    shipped: { ...shipped, courseId: ceiling },
    layer: mine,
    own: false,
    now: NOW,
  });
  ok(atCeiling.courseId !== ceiling && atCeiling.courseId.length <= 128,
    `an id already at the format's ceiling still forks (${atCeiling.courseId.slice(-12)}, ${
      atCeiling.courseId.length} characters)`);
  const longTitle = 'T'.repeat(200);
  const atTitleCeiling = await buildDeckExport({
    kind: 'whole',
    stored: { ...knots, title: longTitle },
    shipped: { ...shipped, title: longTitle },
    layer: mine,
    own: false,
    now: NOW,
  });
  ok(atTitleCeiling.title !== longTitle && [...atTitleCeiling.title].length <= 200,
    `and so does a title at its own (${[...atTitleCeiling.title].length} characters)`);

  /* Exporting a fork, importing it and exporting again. Every pass has to differ
   * from the deck it was written out of, or that pass is the one where the
   * chain quietly stops forking and the file lands back where it came from —
   * which is how a 128-character id got away with it. */
  let chained = { ...knots, courseId: 'a'.repeat(126), title: 'T'.repeat(198) };
  let landed = '';
  for (let pass = 1; pass <= 4; pass++) {
    const step = await buildDeckExport({
      kind: 'whole',
      stored: chained,
      shipped: { ...shipped, courseId: chained.courseId, title: chained.title },
      layer: mine,
      own: false,
      now: NOW,
    });
    if (step.courseId === chained.courseId || step.title === chained.title) landed ||= `pass ${pass}`;
    chained = { ...chained, courseId: step.courseId, title: step.title };
  }
  ok(!landed, `and a fork of a fork forks too, at the ceiling (${landed || 'four passes, four forks'})`);

  const plain = await buildDeckExport({
    kind: 'whole', stored: knots, shipped, layer: {}, own: false, now: NOW,
  });
  ok(plain.courseId === knots.courseId && plain.title === knots.title,
    'a file with nothing of yours in it is still that course, and keeps both');
  ok(plain.fileName !== forked.fileName,
    `so the author's file and yours are never one name in one folder (${plain.fileName} / ${
      forked.fileName})`);
}

/* Round trip, byte for byte.
 *
 * An untouched deck goes out, comes back and goes out again as the same file to
 * the byte, comments and all — which is what "the id tracks versions, not the
 * filename" is worth: nothing about the file drifts when nothing about the deck
 * has. */
{
  const first = await writeCourseFile({
    kind: 'whole',
    stored: knots,
    shipped: { courseId: 'knot-basics', title: 'Knot basics', cards: [] },
    layer: {},
    own: false,
    now: NOW,
  });
  const read = await readCourseFile(first.text, { fileName: first.fileName });
  const again = await writeCourseFile({
    kind: 'whole',
    stored: read.authoredCourse,
    shipped: { courseId: read.course.courseId, title: read.course.title, cards: [] },
    layer: {},
    own: false,
    now: NOW,
  });
  ok(first.text === again.text,
    'a file exported, imported and exported again is byte-for-byte the same file');
  ok(read.course.cards.length === first.document.cards.length,
    `and the reader finds every card in it (${read.course.cards.length})`);
}

/* A deck of your own, whose document and layer are two homes for one kind of
 * card. Out, back in, and out again: the document is identical to the byte.
 *
 * The comment header is the one part that moves, and it should — the first file
 * was written from a deck with a card in its layer and the second from a deck
 * whose cards are all in its document, and the header is the sentence that says
 * so. Everything the reader will ever look at is below it and does not move. */
{
  const own = {
    schemaVersion: 2,
    courseId: 'local-mfx3k2a1',
    title: 'Rope work',
    cards: [{ cardId: 'aabbccddee', front: 'What is a bowline for?', back: 'A loop.' }],
  };
  const shipped = { courseId: 'local-mfx3k2a1', title: 'Rope work', cards: [] };
  const first = await writeCourseFile({
    kind: 'whole',
    stored: own,
    shipped,
    layer: {
      'u.0102030405': layerRecord('What is a *sheet bend* for?', 'Two ropes.  \nUnequal.', 1),
    },
    own: true,
    now: NOW,
  });
  const read = await readCourseFile(first.text, { fileName: first.fileName });
  const again = await writeCourseFile({
    kind: 'whole', stored: read.authoredCourse, shipped, layer: {}, own: true, now: NOW,
  });
  const body = (text) => text.split('\n').filter((line) => !line.startsWith('#')).join('\n');
  ok(first.ok && read.course && again.ok, 'a deck of your own exports, imports and exports again');
  ok(body(first.text) === body(again.text),
    'and every byte the reader sees is the same on the second pass');
  ok(JSON.stringify(read.authoredCourse.cards) === JSON.stringify(first.document.cards),
    'the cards come back word for word and under the same ids');
  ok(read.authoredCourse.courseId === 'local-mfx3k2a1',
    `a deck you made keeps its own identity through the round trip (${read.authoredCourse.courseId})`);
}

/* The emitted document against the schema creators are handed, not only against
 * the reader. The two are meant to say the same thing. */
{
  const cases = [
    ['a layer export', await writeCourseFile({
      kind: 'layer',
      stored: null,
      shipped: shippedDeck([{ cardId: 'aaaa000001', front: '<p>x</p>' }]),
      layer: {
        aaaa000001: layerRecord('An edit.', 'Its answer.', 1, { was: 'z' }),
        'u.ff00ff00': layerRecord('A card of my own.', '', 2),
      },
      own: false,
      now: NOW,
    })],
    ['a whole-deck export', await writeCourseFile({
      kind: 'whole',
      stored: knots,
      shipped: { courseId: 'knot-basics', title: 'Knot basics', cards: [] },
      layer: { 'u.aabbccddeeff': layerRecord('Bowline?', 'A fixed loop.', 3) },
      own: false,
      now: NOW,
    })],
  ];
  for (const [name, file] of cases) {
    const errors = validate(file.document, courseSchema);
    ok(errors.length === 0, `${name} validates against the shipped schema (${
      errors.slice(0, 2).join('; ') || 'clean'})`);
    ok(!JSON.stringify(file.document).includes('"u.'),
      `${name} carries no reserved id in any position`);
  }
}

/* A stored document that no longer validates. It is stored data — written by an
 * older build, or edited by hand — so the gate between it and a file is the
 * whole point, and reaching this is a bug in the exporter rather than anything
 * the person did. */
{
  const broken = {
    ...knots,
    cards: [...knots.cards, { cardId: 'sheet-bend', sectionId: 'bends', front: 'A duplicate id.' }],
  };
  const file = await writeCourseFile({
    kind: 'whole',
    stored: broken,
    shipped: { courseId: 'knot-basics', title: 'Knot basics', cards: [] },
    layer: {},
    own: false,
    now: NOW,
  });
  ok(!file.ok && file.text === '',
    'a document the reader refuses is not written, so no file goes out');
  ok(/repeated/i.test(file.say) && /unique/i.test(file.say),
    `and the refusal is the reader’s own message and correction (${file.say})`);
}

/* A file over the size this app will read back in.
 *
 * It is a caveat and not a refusal: the reader's ceiling is a bound on what
 * keep club will parse, and withholding somebody's own words over a limit of
 * ours is not on. The gate cannot be the round trip here — readCourseFile()
 * refuses the bytes before it parses them, so its answer is a foregone
 * limit.input_bytes that says nothing about the document — and taking that for
 * a verdict is what turned the one deck whose cards have no other copy into the
 * one deck that could not be written out. */
{
  const filler = 'a very long clause that keeps going and going '.repeat(40);
  const big = {
    schemaVersion: 2,
    courseId: 'big-club',
    title: 'Big club',
    cards: Array.from({ length: 1500 }, (unused, index) => ({
      cardId: String(index).padStart(10, '0'),
      front: `Question ${index}. ${filler}`,
      back: `Answer ${index}. ${filler}`,
    })),
  };
  const file = await writeCourseFile({
    kind: 'whole',
    stored: big,
    shipped: { courseId: 'big-club', title: 'Big club', cards: [] },
    layer: {},
    own: false,
    now: NOW,
  });
  ok(file.bytes > 5 * 1024 * 1024, `the file is over the reader's ceiling (${file.bytes} bytes)`);
  ok(file.ok && file.text.length > 0 && file.overLimit,
    `and it is still written, with the caveat that says why (ok ${file.ok}, over ${file.overLimit})`);
  ok(file.say === '', 'so nothing about it reads as a refusal');
  const back = await readCourseFile(file.text, { fileName: file.fileName });
  ok(!back.course && back.diagnostics.some((item) => item.code === 'limit.input_bytes'),
    'the caveat is true: this app will not read it back in');

  /* The gate is still a gate. A document the reader refuses is refused whatever
   * it weighs — the size is the one thing that must not become an amnesty. */
  const broken = await writeCourseFile({
    kind: 'whole',
    stored: { ...big, cards: [...big.cards, { ...big.cards[0], front: 'A duplicate id.' }] },
    shipped: { courseId: 'big-club', title: 'Big club', cards: [] },
    layer: {},
    own: false,
    now: NOW,
  });
  ok(!broken.ok && broken.text === '' && /repeated/i.test(broken.say),
    `a document the reader refuses is still not written at any size (${broken.say})`);
}

/* A whole deck can only come out of a stored document. Asked for one without,
 * the file falls back to the layer rather than going out under the deck's name
 * holding nothing but what the layer had. */
{
  const file = await buildDeckExport({
    kind: 'whole',
    stored: null,
    shipped: shippedDeck([]),
    layer: { 'u.aa': layerRecord('A card of my own.') },
    own: false,
    now: NOW,
  });
  ok(file.kind === 'layer' && file.document.courseId === 'day-skipper.yours',
    `a whole-deck export with no document to copy becomes a layer export (${file.kind})`);
}

/* The shape is decided by what the stored document is made of, not by where the
 * deck came from — provenance and representability agree three times out of
 * four, and the fourth is the one that would have written a broken file. */
{
  const shapes = [
    ['built-in', deckFileShape({ sourceFormat: 'legacy-v1', stored: null, own: false })],
    ['anki', deckFileShape({ sourceFormat: 'legacy-v1', stored: { cards: [] }, own: false })],
    ['keep', deckFileShape({ sourceFormat: 'course-v2', stored: knots, own: false })],
    ['own', deckFileShape({ sourceFormat: 'course-v2', stored: knots, own: true })],
    ['media', deckFileShape({
      sourceFormat: 'course-v2',
      stored: {
        ...knots,
        cards: [{ ...knots.cards[0], media: [
          { side: 'front', mediaType: 'image', source: 'img/one.png' },
          { side: 'back', mediaType: 'audio', source: 'snd/two.mp3' },
        ] }],
      },
      own: false,
    })],
  ];
  const said = shapes.map(([name, shape]) => `${name}=${shape.kind}/${shape.why}`).join(' ');
  ok(said === 'built-in=layer/built-in anki=layer/anki keep=whole/authored '
    + 'own=whole/own media=layer/media', `each kind of deck gets the shape it can honestly produce (${said})`);
  const media = shapes.find(([name]) => name === 'media')[1].assets;
  ok(media.pictures === 1 && media.sounds === 1 && media.total === 2,
    `and a deck carrying media is counted in what it actually carries (${JSON.stringify(media)})`);
}

/* The name is for the human who has to find it in a downloads folder. */
{
  ok(exportFileName('RYA Day Skipper — cards you wrote', 'day-skipper.yours')
    === 'rya-day-skipper-cards-you-wrote.keep.yml',
  'the file is named after its own title');
  ok(exportFileName('Knot basics — with your cards', 'knot-basics.yours')
    === 'knot-basics-with-your-cards.keep.yml',
  'a forked deck is named by the forked title, so it never wears the author’s own filename');
  ok(exportFileName('日本語', 'local-mfx3k2a1') === 'local-mfx3k2a1.keep.yml',
    'and a title that slugs to nothing falls back to the course id');
  ok(!/\d{4}-\d{2}-\d{2}/.test(exportFileName('Knot basics', 'knot-basics')),
    'with no date in it: the id is what tracks versions, not the filename');
}

/* The header a person reads first, which is the only part of the file that can
 * say what it is in a sentence. */
{
  const file = await buildDeckExport({
    kind: 'layer',
    stored: null,
    shipped: shippedDeck([]),
    layer: { 'u.aa': layerRecord('A card of my own.') },
    own: false,
    now: NOW,
  });
  const text = await emitCourseYaml(file.document, file.header);
  const header = text.split('\n').filter((line) => line.startsWith('#'));
  ok(header.length === 4 && header[0] === '# Cards you wrote in keep club, from RYA Day Skipper.',
    `the header names the deck the cards came from (${header[0]})`);
  ok(header.some((line) => /no review history/.test(line)),
    'and says there is no review history in here, because the file outlives the screen');
  ok(text.startsWith('#') && /\nschemaVersion: 2\n/.test(text),
    'the comment sits above the document rather than inside it');
}

/* What the header says about the file it is inside.
 *
 * It is the part that travels: the screen says what a file would hold once, to
 * the person who pressed the button, and the header says it to whoever the file
 * is handed on to afterwards. So a claim the file cannot keep is worse here than
 * anywhere else on the screen it came from. */
{
  const shipped = { courseId: 'knot-basics', title: 'Knot basics', cards: [] };
  const second = (file) => file.header[1];
  const hidden = await buildDeckExport({
    kind: 'whole',
    stored: knots,
    shipped,
    layer: { 'reef-knot': { at: 1, ed: 1, front: '', back: '', hidden: true } },
    own: false,
    now: NOW,
  });
  ok(!/as they came in/.test(second(hidden)) && /you hid/.test(second(hidden)),
    `a deck with a card taken out of it is not "exactly as they came in" (${second(hidden)})`);

  const untouched = await buildDeckExport({
    kind: 'whole', stored: knots, shipped, layer: {}, own: false, now: NOW,
  });
  ok(/3 cards, exactly as they came in/.test(second(untouched)),
    `and one with nothing taken out of it says so (${second(untouched)})`);

  const one = {
    schemaVersion: 2,
    courseId: 'local-mfx3k2a1',
    title: 'Rope work',
    cards: [{ cardId: 'aabbccddee', front: 'What is a bowline for?' }],
  };
  const own = await buildDeckExport({
    kind: 'whole',
    stored: one,
    shipped: { courseId: one.courseId, title: one.title, cards: [] },
    layer: {},
    own: true,
    now: NOW,
  });
  ok(/^1 card, /.test(second(own)),
    `one card is one card, and a deck of your own starts at exactly one (${second(own)})`);
  ok(!/came in/.test(second(own)) && /yours/.test(second(own)),
    'and nothing came in to a deck you wrote here');

  const layerOnly = await buildDeckExport({
    kind: 'layer',
    stored: null,
    shipped: shippedDeck([]),
    layer: { 'u.aa': layerRecord('A card of my own.') },
    own: false,
    now: NOW,
  });
  ok(!/\b0\b/.test(second(layerOnly)),
    `silent at nought, like every other line in this app that has nothing to count (${
      second(layerOnly)})`);
}

/* A title carrying a newline would end the comment and put the rest of it into
 * the document as YAML. Deck titles are written by whoever made the deck. */
{
  const file = await buildDeckExport({
    kind: 'layer',
    stored: null,
    shipped: shippedDeck([], { title: 'Hostile\ntitle:\n  cards: []' }),
    layer: { 'u.aa': layerRecord('A card of my own.') },
    own: false,
    now: NOW,
  });
  const text = await emitCourseYaml(file.document, file.header);
  const escaped = text.split('\n').every((line, index) =>
    index > 3 || line === '' || line.startsWith('#'));
  const read = await readCourseFile(text, { fileName: file.fileName });
  ok(escaped && !!read.course,
    'a deck title with a newline in it cannot break out of the comment header');
}

/* ── the screen ── */

const b = await chromium.launch({ executablePath: EXE });

/** A page with every file it hands over kept, so the test can read what a
 *  person would have got. The anchor click is real; this only remembers the
 *  Blob on its way past. */
async function coursePage(id = 'day-skipper', options = {}) {
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block',
    acceptDownloads: true,
    ...options,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    globalThis.__files = [];
    const make = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      if (blob && /yaml/.test(blob.type || '')) globalThis.__files.push(blob);
      return make(blob);
    };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function named() {
      if (this.download) globalThis.__files.names = (globalThis.__files.names || []).concat(this.download);
      return click.call(this);
    };
  });
  await page.goto(URL_ + '?course=' + id, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  return { ctx, page, errors };
}

/** The deck-file section, open, with its line settled.
 *
 * It sits under Backup, and Backup is inside the settings sheet: the way to it
 * is the header's settings mark from whichever screen you are on, then the
 * group that holds both. Left open, because every block below it only reads the
 * line and presses the button, and then closes the window it did that in. */
async function progress(page) {
  if (!await page.locator('#setup:not([hidden])').count()) {
    await page.click('.setup-btn:visible');
    await page.waitForSelector('#setup:not([hidden])');
  }
  if (await page.evaluate(() => !document.getElementById('setup-keeping').parentElement.open)) {
    await page.click('#setup-keeping');
  }
  await page.waitForFunction(() => {
    const btn = document.getElementById('deck-export-btn');
    return btn && !btn.hidden && btn.textContent.length > 0;
  });
}

const lastFile = (page) => page.evaluate(() => {
  const files = globalThis.__files;
  return files.length
    ? files[files.length - 1].text().then((text) => ({ text, name: (files.names || []).at(-1) }))
    : null;
});

const toastText = (page) => page.textContent('#toast');

/* A built-in course: the cards you wrote and the ones you changed, and not one
 * card of the author's. */
{
  const { ctx, page, errors } = await coursePage();
  const ids = await page.evaluate(async () => {
    const first = await writeCard({
      front: 'What shape does a vessel at anchor show?',
      back: 'One **black ball**, forward.  \nBy night, an all-round white light.',
    });
    const second = await writeCard({ front: 'Which way does the tide set through the Swinge?' });
    const shippedId = DECK.cards[0].cardId;
    await editCard(shippedId, { front: 'An edit over the course’s own card.', back: 'Mine.' });
    await hideCard(DECK.cards[1].cardId);
    writeNow();
    return { first: first.id, second: second.id, shipped: shippedId };
  });
  await progress(page);
  const said = await page.textContent('#deck-file-state');
  const label = await page.textContent('#deck-export-btn');
  ok(/the 2 cards you wrote and the 1 of this course’s that you changed/.test(said),
    `the line says what a file would hold before the button (${said})`);
  ok(/Day Skipper’s own cards are its author’s work, so they stay here/.test(said),
    'and why the rest of a built-in course is not in it');
  ok(label.trim().toLowerCase() === 'export the cards you wrote',
    `the button is the short version of the same thing (${label.trim()})`);

  await page.click('#deck-export-btn');
  await page.waitForFunction(() => globalThis.__files.length > 0);
  const file = await lastFile(page);
  ok(file.name === 'rya-day-skipper-cards-you-wrote.keep.yml',
    `the file is named for what is in it (${file.name})`);
  const read = await readCourseFile(file.text, { fileName: file.name });
  const cards = read.authoredCourse.cards;
  ok(!!read.course && cards.length === 3,
    `the file the app handed over is a course file the app reads (${cards.length} cards)`);
  ok(cards[0].cardId === ids.shipped && cards[0].front === 'An edit over the course’s own card.',
    'the card you changed keeps the course’s own id, so the file can be diffed against it');
  ok(cards[1].cardId === ids.first.slice(2) && cards[2].cardId === ids.second.slice(2),
    `and the cards you wrote lose the reserved prefix (${cards[1].cardId})`);
  ok(cards[1].back === 'One **black ball**, forward.  \nBy night, an all-round white light.',
    'a hard break written into a card survives the file byte for byte');
  ok(!read.authoredCourse.sections && !read.authoredCourse.groups,
    'a layer export declares no sections: a course’s structure is the course’s');
  ok(!/hid|hidden/i.test(file.text),
    'and the card you hid is not in it, because a course file cannot say "not this card"');
  ok(/Exported the 3 cards you have written or edited, as rya-day-skipper-cards-you-wrote\.keep\.yml\./
    .test(await toastText(page)), `the receipt names the file (${await toastText(page)})`);
  ok(errors.length === 0, `exporting raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Nothing of yours yet. The button is never disabled, for the reason "Write a
 * card" is never hidden: a control that is not there cannot say why. */
{
  const { ctx, page, errors } = await coursePage();
  await progress(page);
  const said = await page.textContent('#deck-file-state');
  const disabled = await page.getAttribute('#deck-export-btn', 'disabled');
  ok(/You have not written or changed a card in this deck yet/.test(said)
      && /Browse is where you write one/.test(said),
  `the line says there is nothing of yours and where one comes from (${said})`);
  ok(disabled === null, 'and the button is still there to be pressed');
  await page.click('#deck-export-btn');
  await page.waitForTimeout(300);
  const toast = await toastText(page);
  ok(/so a file of your cards would be empty/.test(toast)
      && /Browse is where you write one/.test(toast),
  `pressing it refuses in the same words (${toast})`);
  ok((await page.evaluate(() => globalThis.__files.length)) === 0, 'and writes no file');
  ok(errors.length === 0, `the refusal raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* THE REFUSAL THAT MATTERS. A cards document that will not open is not an empty
 * one: exporting over it writes a short file that then looks like proof there
 * was nothing there. */
{
  const { ctx, page, errors } = await coursePage();
  await page.evaluate(async () => {
    await writeCard({ front: 'A card that is about to become unreadable.' });
    writeNow();
  });
  await page.evaluate(() => localStorage.setItem(CARDS_KEY, '{'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  await progress(page);
  await page.click('#deck-export-btn');
  await page.waitForTimeout(300);
  const state = await page.evaluate(() => ({
    loaded: cardLayerLoaded,
    files: globalThis.__files.length,
    toast: document.getElementById('toast').textContent,
    line: document.getElementById('deck-file-state').textContent,
  }));
  ok(!state.loaded, 'the layer is unloaded, which is not the same as empty');
  ok(/could not be read/.test(state.toast) && /Nothing was exported/.test(state.toast),
    `and the export refuses rather than writing a short file (${state.toast})`);
  ok(state.files === 0, 'nothing at all was handed over');
  ok(!/have not written or changed a card/.test(state.toast),
    'and it is never mistaken for "you have written nothing", which would be a lie');
  /* The same lie one step earlier. The line above the button is read first, and
   * it is drawn from the same layer the app knows it could not read — so it
   * said the cards were never written, and then sent the person to Browse,
   * where the first card written replaces the document that would not open. */
  ok(/could not be read/.test(state.line),
    `the line above the button says the same thing the button does (${state.line})`);
  ok(!/have not written or changed a card/.test(state.line)
      && !/Browse is where you write one/.test(state.line),
  'rather than telling somebody who wrote a card that they wrote none, and sending them to Browse');
  ok(errors.length === 0, `the refusal raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The keyboard keeps its place.
 *
 * Disabling the button somebody is standing on hands focus to the body, and
 * enabling it again does not hand it back — so the next Tab restarts at the top
 * of the document, one press after the control they were on. The sibling backup
 * button never disables at all, so this was new behaviour on this screen. */
{
  const { ctx, page, errors } = await coursePage();
  await page.evaluate(async () => {
    await writeCard({ front: 'A card written before the file was.' });
    writeNow();
  });
  await progress(page);
  await page.focus('#deck-export-btn');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => globalThis.__files.length > 0);
  await page.waitForFunction(() => !document.getElementById('deck-export-btn').disabled);
  const where = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
  ok(where === 'deck-export-btn',
    `focus comes back to the button that wrote the file (${where})`);
  ok(errors.length === 0, `exporting from the keyboard raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Export while another tab is studying.
 *
 * The export writes nothing — it reads COURSE.deck and cardLayer, both already
 * in memory — so it needs no refuseForeignWrite(), no writeNow() flush and no
 * study lease, and the button is refused by nothing. It must also not re-read
 * the layer on the way, which would replace it without the rebuild that keeps
 * DECK in step: the file is what this tab is showing, which is the only thing
 * it can honestly be. */
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true,
  });
  const errors = [];
  const studying = await ctx.newPage();
  const idle = await ctx.newPage();
  for (const page of [studying, idle]) {
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      globalThis.__files = [];
      const make = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        if (blob && /yaml/.test(blob.type || '')) globalThis.__files.push(blob);
        return make(blob);
      };
    });
  }
  await studying.goto(URL_ + '?course=day-skipper', { waitUntil: 'networkidle' });
  await studying.waitForFunction(() => document.getElementById('boot').hidden);
  await studying.evaluate(async () => {
    await writeCard({ front: 'A card written before the session.' });
    writeNow();
  });
  await studying.evaluate((sk) => startSession(sk, {}), null);
  await studying.waitForFunction(() => !!session);
  const lease = await studying.evaluate(() =>
    JSON.parse(localStorage.getItem(STUDY_LOCK_KEY)).owner);

  await idle.goto(URL_ + '?course=day-skipper', { waitUntil: 'networkidle' });
  await idle.waitForFunction(() => document.getElementById('boot').hidden);
  const deckBefore = await idle.evaluate(() => ({
    fingerprint: DECK.buildFingerprint, cards: DECK.cards.length,
  }));
  await progress(idle);
  await idle.click('#deck-export-btn');
  await idle.waitForFunction(() => globalThis.__files.length > 0);
  const after = await idle.evaluate(() => ({
    fingerprint: DECK.buildFingerprint,
    cards: DECK.cards.length,
    toast: document.getElementById('toast').textContent,
    lease: JSON.parse(localStorage.getItem(STUDY_LOCK_KEY) || 'null')?.owner,
  }));
  const stillStudying = await studying.evaluate(() => !!session && current === 'study');
  ok(!/another tab/i.test(after.toast) && /^Exported /.test(after.toast),
    `an idle tab may export while another studies (${after.toast})`);
  ok(after.lease === lease, 'without taking or dropping the study lease');
  ok(stillStudying, 'and the tab that was studying is still studying');
  ok(after.fingerprint === deckBefore.fingerprint && after.cards === deckBefore.cards,
    `while the deck the export read out of is untouched (${after.cards} cards)`);
  ok(errors.length === 0,
    `exporting beside a session raises no page errors (${errors.slice(0, 2).join(' | ') || 'none'})`);
  await ctx.close();
}

/* A deck of your own. Its document is the cards, no file holds them, and this
 * is the only one that ever will. */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    globalThis.__files = [];
    const make = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      if (blob && /yaml/.test(blob.type || '')) globalThis.__files.push(blob);
      return make(blob);
    };
  });
  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.waitForSelector('.shelf.on');
  await page.click('[data-byo]');
  await page.waitForSelector('#imp-mine');
  await page.click('#imp-mine');
  await page.waitForSelector('#byo-deck-name');
  await page.fill('#byo-deck-name', 'Rope work');
  await page.fill('#byo-card-front', 'What is a bowline for?');
  await page.fill('#byo-card-back', 'A loop that will not slip.');
  await page.click('#byo-card-save');
  await page.waitForSelector('[data-open]', { timeout: 15000 });
  await Promise.all([page.waitForEvent('load'), page.click('[data-open]')]);
  await page.waitForFunction(() => document.getElementById('boot').hidden, null, { timeout: 20000 });
  await page.evaluate(async () => {
    await writeCard({ front: 'What is a *sheet bend* for?', back: 'Two ropes of unequal size.' });
    writeNow();
  });

  await progress(page);
  const said = await page.textContent('#deck-file-state');
  const label = await page.textContent('#deck-export-btn');
  ok(/A file now would hold all 2 cards in this deck/.test(said)
      && /It is the only file that does/.test(said),
  `a deck you made says this is the only file that holds it (${said})`);
  ok(label.trim().toLowerCase() === 'export this deck',
    `and the button offers the whole deck (${label.trim()})`);

  await page.click('#deck-export-btn');
  await page.waitForFunction(() => globalThis.__files.length > 0);
  const text = await page.evaluate(() => globalThis.__files.at(-1).text());
  const read = await readCourseFile(text, { fileName: 'rope-work.keep.yml' });
  const fronts = (read.authoredCourse?.cards || []).map((card) => card.front);
  ok(!!read.course && fronts.length === 2,
    `the file holds the deck's own card and the one written into its layer (${fronts.length})`);
  ok(fronts.includes('What is a bowline for?') && fronts.includes('What is a *sheet bend* for?'),
    'both come back word for word, asterisks and all');
  ok(read.authoredCourse.courseId === (await page.evaluate(() => COURSE.id)),
    'a deck you made keeps its own id: you are its author, and no file can be an update to it');
  ok(errors.length === 0,
    `exporting a deck of your own raises no page errors (${errors.slice(0, 2).join(' | ') || 'none'})`);

  /* The same deck, grown past the size this app will read a course file back
   * in at. The file still comes out, and the one sentence that says why it will
   * not open here is stuck on screen rather than flashed — while this deck is
   * the one whose cards have no other copy anywhere, which is what the refusal
   * that used to happen here cost. */
  await page.evaluate(() => {
    const filler = 'a very long clause that keeps going and going '.repeat(40);
    for (let index = 0; index < 1500; index++) {
      COURSE.deck.cards.push({
        cardId: String(index).padStart(10, '0'),
        front: `Question ${index}. ${filler}`,
        back: `Answer ${index}. ${filler}`,
      });
    }
  });
  const beforeBig = await page.evaluate(() => globalThis.__files.length);
  await page.click('#deck-export-btn');
  await page.waitForFunction((was) => globalThis.__files.length > was, beforeBig, { timeout: 30000 });
  const big = await page.evaluate(async () => ({
    toast: document.getElementById('toast').textContent,
    sticky: !document.getElementById('toast').hidden,
    bytes: (await globalThis.__files.at(-1).text()).length,
  }));
  ok(/^Exported all /.test(big.toast) && big.bytes > 5 * 1024 * 1024,
    `a deck over the reader's ceiling is still handed over (${big.bytes} bytes)`);
  ok(/will not read a course file over 5 MB back in/.test(big.toast)
      && /text editor/.test(big.toast),
  `with the caveat that says where it will open and where it will not (${big.toast.slice(-120)})`);
  ok(!/could not write a course file/.test(big.toast),
    'and nothing in it reads as a refusal, or as a bug in keep club');
  ok(errors.length === 0,
    `a file over the ceiling raises no page errors (${errors.slice(0, 2).join(' | ') || 'none'})`);
  await ctx.close();
}

/* A stored document that no longer validates, on the screen: the refusal names
 * the exporter rather than the person, and nothing is handed over. */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    globalThis.__files = [];
    const make = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      if (blob && /yaml/.test(blob.type || '')) globalThis.__files.push(blob);
      return make(blob);
    };
  });
  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.waitForSelector('.shelf.on');
  await page.click('[data-byo]');
  await page.waitForSelector('#imp-mine');
  await page.click('#imp-mine');
  await page.waitForSelector('#byo-deck-name');
  await page.fill('#byo-deck-name', 'Broken deck');
  await page.fill('#byo-card-front', 'A question.');
  await page.click('#byo-card-save');
  await page.waitForSelector('[data-open]', { timeout: 15000 });
  await Promise.all([page.waitForEvent('load'), page.click('[data-open]')]);
  await page.waitForFunction(() => document.getElementById('boot').hidden, null, { timeout: 20000 });
  await progress(page);
  // The document IndexedDB is holding, as an older build or a hand edit could
  // leave it: two cards under one id.
  await page.evaluate(() => {
    COURSE.deck.cards.push({ cardId: COURSE.deck.cards[0].cardId, front: 'A duplicate.' });
  });
  await page.click('#deck-export-btn');
  await page.waitForTimeout(600);
  const toast = await toastText(page);
  ok(/keep club could not write a course file from this deck, so nothing was downloaded/.test(toast),
    `the refusal blames the exporter rather than the person (${toast})`);
  ok(/repeated/i.test(toast) && /unique/i.test(toast),
    'and carries the reader’s own message and correction');
  ok((await page.evaluate(() => globalThis.__files.length)) === 0,
    'and nothing was handed over');
  ok((await page.getAttribute('#deck-export-btn', 'disabled')) === null
      && /export this deck/i.test(await page.textContent('#deck-export-btn')),
  'the button comes back rather than staying on "Writing the file…"');
  ok(errors.length === 0, `a refused export raises no page errors (${errors.slice(0, 2).join(' | ') || 'none'})`);
  await ctx.close();
}

await b.close();
console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
