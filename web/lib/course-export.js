/*
 * Writing a deck out as a file, in the one format this app already reads.
 *
 * One direction. Nothing here decides what a course file is: the document this
 * builds goes back through readCourseFile() — the reader the importer uses —
 * before it reaches a Blob, and a document that does not come back clean is not
 * written. That gate is the whole safety story, for the reason web/lib/
 * validate.js is a standing note about: a second opinion about what a course
 * file is would be a second thing to keep in step with the reader, and only one
 * of them could be right.
 *
 * Two shapes, and the deck decides which rather than a control on the screen. A
 * deck whose stored document is authored CommonMark goes out whole, because
 * writing it is copying it. A deck stored as sanitized HTML — a built-in
 * course, an Anki import — cannot: re-authoring it would put every card through
 * the down-converter the card sheet uses one card at a time, and what that
 * converter cannot carry starts with every picture in the deck. Those decks
 * give up the layer instead — the cards a person wrote and the edits they made,
 * which are the only things in a deck with no other copy anywhere, and the
 * whole reason this exists.
 *
 * No DOM, no storage, no clock: the day is handed in. The one place this yields
 * is the card loop, because a whole-deck export is bounded only by the format's
 * 50,000 cards and a phone must not stop while one is written.
 */

import { COURSE_YAML_LIMITS } from './course-yaml.js';
import { readCourseFile } from './course-package.js';

/** The only machine-readable statement that a file is not its author's own.
 *  Reverse-domain with a path, which is the shape normalizeExtensions takes. */
export const EXPORT_KEY = 'app.keepclub/export';

/* A card written in the app takes an id under the prefix both course readers
 * refuse — for cardId and for sectionId alike — so the prefix comes off on the
 * way into a file. It comes off the same way every time: two exports of one
 * deck have to name the same cards, or somebody diffing them sees every card
 * change. What is left is 1–32 hex, which is already a valid ID. */
const WRITTEN_ID = /^u\.[a-f0-9]{1,32}$/;
const RESERVED = 'u.';
/* Where a written card goes when the deck's own document declares sections and
 * names none that it can join. It cannot be LOOSE_SECTION: that is `u.loose`,
 * legal in DECK and refused in a file. */
const SYNTHETIC_SECTION = 'cards-you-wrote';
const SYNTHETIC_TITLE = 'Cards you wrote';
/* How many cards go by before the thread is handed back. indexDeck() uses the
 * same number against the same problem. */
const YIELD_EVERY = 500;
/* Emission order: identity at the top, the metadata a whole-deck export carries
 * through under it, then the structure, then the cards, then machine noise at
 * the bottom. This is the list of what a whole-deck export copies across
 * untouched — including a licence and an authors block, which is what stops a
 * file being somebody else's course with the credit taken off. */
const CARRIED = [
  'title', 'shortTitle', 'tagline', 'description', 'contentLanguage',
  'instructionLanguage', 'authors', 'license', 'source', 'theme',
];
/* The top-level blocks a blank line goes before, so the file is scannable
 * rather than a wall. */
const SPACED_BLOCKS = new Set(['sections', 'groups', 'cards', 'extensions']);

const isPlainObject = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const record = (layer, id) =>
  (isPlainObject(layer) && Object.hasOwn(layer, id) && isPlainObject(layer[id]))
    ? layer[id] : null;

/** Every live card of somebody's own, oldest first — the order Browse draws
 *  them in, and the order that makes the derived ids below stable. */
function writtenCards(layer) {
  return Object.entries(isPlainObject(layer) ? layer : {})
    .filter(([id, rec]) => WRITTEN_ID.test(id) && isPlainObject(rec) && !!rec.front)
    .sort((a, b) => (Number(a[1].at) || 0) - (Number(b[1].at) || 0)
      || (a[0] < b[0] ? -1 : 1));
}

/** An id nothing in this document has taken yet, reached the same way every
 *  time. Two ten-hex course ids and a twelve-hex written one do not collide in
 *  practice; a document with a duplicate id is refused outright, so "in
 *  practice" is not good enough to rest a file on. */
function freeId(wanted, taken) {
  if (!taken.has(wanted)) return wanted;
  for (let suffix = 1; ; suffix++) {
    const candidate = `${wanted}.${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Every asset a stored document names.
 *
 * A .keep.yml is text: the assets live beside it inside a .keep archive, and
 * this app has no ZIP writer. A file naming assets that are not beside it fails
 * validateAssets on the way back in, and stripping the media blocks is the
 * silent picture-deletion the card release spent a ruling preventing — so a
 * deck carrying any of this is offered the layer instead, with the count as the
 * reason. Counted by kind rather than all called pictures: a deck of bird calls
 * would otherwise be told it carries 40 pictures.
 */
export function assetsIn(document) {
  // `onCards` is what makes the sentence on the screen true: a deck whose only
  // assets are its shelf and loading pictures does not have cards that carry
  // any, and saying it did would be describing somebody else's deck.
  const counts = { pictures: 0, sounds: 0, clips: 0, total: 0, onCards: 0 };
  const seen = new Set();
  let inCards = true;
  const add = (source, kind) => {
    if (typeof source !== 'string' || !source || !Object.hasOwn(counts, kind)) return;
    if (seen.has(`${kind} ${source}`)) return;
    seen.add(`${kind} ${source}`);
    counts[kind]++;
    counts.total++;
    if (inCards) counts.onCards++;
  };
  const cards = isPlainObject(document) && Array.isArray(document.cards)
    ? document.cards : [];
  for (const card of cards) {
    const media = isPlainObject(card) && Array.isArray(card.media) ? card.media : [];
    for (const item of media) {
      if (!isPlainObject(item)) continue;
      add(item.source, item.mediaType === 'audio' ? 'sounds'
        : item.mediaType === 'video' ? 'clips' : 'pictures');
      add(item.posterImage, 'pictures');
      // A caption track cannot exist without the video it belongs to, which is
      // already counted. Counting it again would describe one clip as two
      // things.
    }
  }
  inCards = false;
  const theme = isPlainObject(document) && isPlainObject(document.theme) ? document.theme : {};
  for (const field of ['shelfArtwork', 'sectionArtwork', 'loadingArtwork']) {
    add(theme[field], 'pictures');
  }
  return counts;
}

/** What this deck can honestly be written out as, and why.
 *
 * The seam is the content representation of the stored document, not where the
 * deck came from. RUNTIME_SOURCE_FORMAT is already that discriminator — it is
 * set from the reader on every boot — and the one further question is whether
 * the document references a packaged asset. Provenance and representability
 * agree in three cases out of four; the fourth is a deck carrying media, and it
 * is the one where going by provenance would have written a broken file.
 */
export function deckFileShape({ sourceFormat, stored, own }) {
  const authored = sourceFormat === 'course-v2' && isPlainObject(stored);
  const assets = authored ? assetsIn(stored)
    : { pictures: 0, sounds: 0, clips: 0, total: 0, onCards: 0 };
  const why = !isPlainObject(stored) ? 'built-in'
    : !authored ? 'anki'
      : assets.total ? 'media'
        : own ? 'own' : 'authored';
  return { kind: authored && !assets.total ? 'whole' : 'layer', why, assets, own: !!own };
}

/* ── the document ── */

/** The cards you wrote and the edits you made, and nothing else.
 *
 * No sections: they are the course's structure, and a file declaring three of a
 * course's twelve is a skeleton of somebody else's work for no gain. Everything
 * lands in the generated all-cards section instead.
 *
 * Hides are not in it, and neither are deletes: a hide is an emptied record,
 * and a course file has no way to say "not this card" about a course it is not
 * shipping. §3's guarantee says so out loud rather than leaving it to be found.
 */
async function layerDocument({ shipped, layer }) {
  const cards = [];
  const source = Array.isArray(shipped.cards) ? shipped.cards : [];
  for (let index = 0; index < source.length; index++) {
    if (index && index % YIELD_EVERY === 0) await new Promise((r) => setTimeout(r, 0));
    const rec = record(layer, source[index].cardId);
    if (!rec || !rec.front) continue;
    // The course's own id, kept exactly. Ids are opaque by contract, and
    // keeping them is what lets a person diff their file against the course it
    // came from.
    const card = { cardId: source[index].cardId, front: rec.front };
    if (rec.back) card.back = rec.back;
    cards.push(card);
  }
  const overridden = cards.length;
  const taken = new Set(cards.map((card) => card.cardId));
  const written = writtenCards(layer);
  for (const [id, rec] of written) {
    const cardId = freeId(id.slice(RESERVED.length), taken);
    taken.add(cardId);
    const card = { cardId, front: rec.front };
    if (rec.back) card.back = rec.back;
    cards.push(card);
  }
  return {
    cards,
    counts: { cards: cards.length, written: written.length, overridden, hidden: 0 },
  };
}

/** The deck's own document, with your layer folded into it.
 *
 * The merge cardsWithLayer() already performs, in the order it already performs
 * it, against the authored Markdown rather than the rendered HTML: hidden cards
 * out, overrides over the card's front and back in place, written cards
 * appended. Each card is spread rather than rebuilt, so a card's tags and its
 * key order are the author's still.
 */
async function wholeDocument({ stored, layer }) {
  const sourceCards = Array.isArray(stored.cards) ? stored.cards : [];
  const sourceSections = Array.isArray(stored.sections)
    ? stored.sections.filter(isPlainObject) : [];
  const declared = sourceSections.length > 0;
  const sectionIds = new Set(sourceSections
    .map((section) => section.sectionId)
    .filter((id) => typeof id === 'string'));
  /* A card may leave sectionId out while there is exactly one section to leave
   * out. Adding a second takes that away — section.ambiguous_default — so the
   * one this document resolves to is remembered here and written in below, but
   * only where a second section actually appears. */
  const impliedSection = declared && sourceSections.length === 1
    ? sourceSections[0].sectionId : '';

  const cards = [];
  let overridden = 0;
  let hidden = 0;
  for (let index = 0; index < sourceCards.length; index++) {
    if (index && index % YIELD_EVERY === 0) await new Promise((r) => setTimeout(r, 0));
    const card = sourceCards[index];
    if (!isPlainObject(card)) continue;
    const rec = record(layer, card.cardId);
    if (rec && !rec.front) {
      // An emptied record is a hide or a taken-back edit. The first takes the
      // card out of the file; the second leaves the author's card exactly as it
      // was, which is what taking an edit back means.
      if (rec.hidden === true) { hidden++; continue; }
      cards.push({ ...card });
      continue;
    }
    if (!rec) { cards.push({ ...card }); continue; }
    const yours = { ...card, front: rec.front };
    if (rec.back) yours.back = rec.back; else delete yours.back;
    overridden++;
    cards.push(yours);
  }

  const taken = new Set(cards.map((card) => card.cardId));
  const written = writtenCards(layer);
  let synthetic = '';
  for (const [id, rec] of written) {
    const cardId = freeId(id.slice(RESERVED.length), taken);
    taken.add(cardId);
    const card = { cardId };
    if (declared) {
      if (sectionIds.has(rec.section)) card.sectionId = rec.section;
      else {
        synthetic ||= freeId(SYNTHETIC_SECTION, sectionIds);
        sectionIds.add(synthetic);
        card.sectionId = synthetic;
      }
    }
    card.front = rec.front;
    if (rec.back) card.back = rec.back;
    cards.push(card);
  }
  if (synthetic && impliedSection) {
    for (const card of cards) {
      if (typeof card.sectionId !== 'string') card.sectionId = impliedSection;
    }
  }

  let sections;
  let groups;
  if (declared) {
    const live = new Map();
    for (const card of cards) {
      const id = typeof card.sectionId === 'string' ? card.sectionId : impliedSection;
      if (id) live.set(id, (live.get(id) || 0) + 1);
    }
    // A declared section with nothing left in it is section.empty, and hiding
    // the last card of one is exactly how that happens.
    sections = sourceSections
      .filter((section) => live.get(section.sectionId) > 0)
      .map((section) => ({ ...section }));
    if (synthetic) sections.push({ sectionId: synthetic, title: SYNTHETIC_TITLE });
    const sourceGroups = Array.isArray(stored.groups)
      ? stored.groups.filter(isPlainObject) : [];
    if (sourceGroups.length) {
      const kept = new Set(sections.map((section) => section.sectionId));
      groups = sourceGroups
        .map((group) => ({
          ...group,
          sectionIds: (Array.isArray(group.sectionIds) ? group.sectionIds : [])
            .filter((id) => kept.has(id)),
        }))
        .filter((group) => group.sectionIds.length);
      // A section in no group is group.ungrouped_section, so the synthetic one
      // brings a group of its own — titled, because a group with an empty title
      // is field.empty. applyCardLayer() gives the same group an empty title in
      // memory, which is legal in DECK and illegal in a file.
      if (synthetic) {
        groups.push({
          groupId: freeId(SYNTHETIC_SECTION, new Set(groups.map((g) => g.groupId))),
          title: SYNTHETIC_TITLE,
          sectionIds: [synthetic],
        });
      }
    }
  }

  return {
    cards,
    sections,
    groups,
    counts: { cards: cards.length, written: written.length, overridden, hidden },
  };
}

/** The day, as a file that somebody may hand to another person wants it: the
 *  date rather than the clock, and the local day rather than UTC's. */
function isoDay(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${
    String(now.getDate()).padStart(2, '0')}`;
}

/** Anything of ours that ends up inside a comment, on one line.
 *
 * A deck is titled by whoever wrote it, and a title carrying a newline would
 * end the comment and put the rest of it in the document. */
const oneLine = (value) => String(value == null ? '' : value)
  .replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

/** The part of the file a person reads first.
 *
 * Comments are not nodes, so the reader neither sees these nor objects to them.
 * It is the only place the file can say what it is in a sentence, and the file
 * outlives the screen that said it once. */
function headerFor({ kind, title, deckTitle, counts, now }) {
  const on = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const yours = [];
  if (counts.written) yours.push(`${counts.written} you wrote`);
  if (counts.overridden) yours.push(`${counts.overridden} you changed`);
  const what = kind === 'whole'
    ? [
      `${oneLine(title)}, written out of keep club.`,
      yours.length
        ? `${counts.cards} cards, ${yours.join(' and ')}. Exported ${on}.`
        : `${counts.cards} cards, exactly as they came in. Exported ${on}.`,
    ]
    : [
      `Cards you wrote in keep club, from ${oneLine(deckTitle)}.`,
      `${counts.written} you wrote, ${counts.overridden} of the course's that `
        + `you changed. Exported ${on}.`,
    ];
  return what.concat([
    'There is no review history in here: keep club course files never carry any.',
    'The format: https://keepclub.app/docs/',
  ]);
}

/** A title that will not be refused for its length. Cut in code points, the
 *  rule this repo writes down wherever text is cut: an emoji is two code units
 *  and half of one is a replacement character. */
function clipTitle(value, max) {
  const points = [...String(value == null ? '' : value)];
  return points.length <= max ? points.join('') : points.slice(0, max).join('');
}

/**
 * The document to write, from the deck's own and the layer over it.
 *
 * @param {{kind: 'whole'|'layer', stored: object|null, shipped: object,
 *          layer: object, own: boolean, now: Date}} input
 */
export async function buildDeckExport(input) {
  const { shipped, layer, own } = input;
  // A whole deck can only come out of a stored document. Asking for one without
  // it would write a file holding nothing but the layer under the deck's own
  // name, which is the shape of a lie rather than a crash.
  const stored = isPlainObject(input.stored) ? input.stored : null;
  const kind = input.kind === 'whole' && stored ? 'whole' : 'layer';
  const now = input.now instanceof Date ? input.now : new Date();
  const day = isoDay(now);
  const built = kind === 'whole'
    ? await wholeDocument({ stored, layer })
    : await layerDocument({ shipped, layer });
  const from = (stored && typeof stored.courseId === 'string')
    ? stored.courseId : shipped.courseId;
  const yours = built.counts.written + built.counts.overridden + built.counts.hidden;

  /* A file with your cards folded in goes out under an id of its own.
   *
   * Keeping the deck's would let its real author ship an update that match()
   * recognises and store.put rewrites wholesale, deleting every card folded in
   * with nothing said anywhere — and on this device the same file would
   * re-import as an update, duplicating every written card and firing "the
   * author rewrote this card" on every override, against text that had just
   * been replaced by the override's own.
   *
   * Never for a deck somebody made here. You are its author, the record carries
   * no sourceCourseId for any file to match on, and the id is already your
   * claim; a suffix there would be noise guarding against nobody.
   */
  const courseId = (yours && !own) ? clipTitle(`${from}.yours`, 128) : from;

  const document = { schemaVersion: 2, courseId };
  let title;
  if (kind === 'whole') {
    for (const field of CARRIED) {
      if (stored[field] !== undefined) document[field] = stored[field];
    }
    title = typeof stored.title === 'string' ? stored.title : shipped.title;
    if (built.sections) document.sections = built.sections;
    if (built.groups && built.groups.length) document.groups = built.groups;
  } else {
    title = clipTitle(shipped.title, 200 - ' — cards you wrote'.length)
      + ' — cards you wrote';
    document.title = title;
  }
  document.cards = built.cards;
  // The author's own extensions, minus the stamp a previous export may have
  // left there: a stale claim about where a file came from survives an import,
  // and is worse than no claim at all.
  const extensions = (stored && isPlainObject(stored.extensions))
    ? { ...stored.extensions } : {};
  delete extensions[EXPORT_KEY];
  extensions[EXPORT_KEY] = {
    kind: kind === 'whole' ? 'whole-deck' : 'your-cards',
    from,
    exportedOn: day,
  };
  document.extensions = extensions;

  return {
    document,
    kind,
    courseId,
    title,
    counts: built.counts,
    header: headerFor({ kind, title, deckTitle: shipped.title, counts: built.counts, now }),
    // `.yours` on the file too, but only where the whole deck went out under a
    // forked id: the layer file's own title already says in words that it is
    // the cards you wrote, and a downloads folder does not need it twice.
    fileName: exportFileName(title, courseId, kind === 'whole' && courseId !== from),
  };
}

/* ── the file ── */

/**
 * The slug of the file's own title, capped, then `.keep.yml`.
 *
 * Not the courseId, which the backup uses: for a deck somebody made here that
 * is `local-mfx3k2a1`, which tells a Downloads folder nothing. The identity is
 * on line two of the file, where the format puts it. And no date — the backup
 * is a snapshot of a moving thing and is dated for it, while a course file is
 * content, and dating it invites the belief that the format tracks versions
 * when the id is what does. Two exports in a day are then byte-identical.
 */
export function exportFileName(title, courseId, forked = false) {
  let slug = '';
  try {
    slug = String(title == null ? '' : title).normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '');
  } catch { slug = String(title == null ? '' : title); }
  slug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60).replace(/^-+|-+$/g, '');
  // A title that slugs to nothing \u2014 one written in a script with no ASCII in
  // it \u2014 falls back to the courseId, which already carries any fork suffix.
  if (!slug) return `${courseId}.keep.yml`;
  return `${slug}${forked ? '.yours' : ''}.keep.yml`;
}

/**
 * The document as text, with the parts a person reads.
 *
 * Four emitter rules, each of them a refusal the reader actually makes:
 * `aliasDuplicateObjects: false`, because an anchor or an alias is refused
 * outright and stringify emits one for any object reference that appears twice;
 * never a key whose value is undefined, which fails as field.invalid_type;
 * never a blank optional, which is why an absent back is an absent key; and
 * `lineWidth: 0`, because folding rewraps long plain scalars and a Markdown
 * hard break is two trailing spaces.
 */
export async function emitCourseYaml(document, header) {
  const YAML = await import('./vendor/yaml-2.9.0.min.js');
  const doc = new YAML.Document(document, null, {
    aliasDuplicateObjects: false,
    version: '1.2',
  });
  doc.commentBefore = (Array.isArray(header) ? header : [])
    .map((line) => ` ${oneLine(line)}`).join('\n');
  for (const pair of doc.contents.items) {
    if (SPACED_BLOCKS.has(String(pair.key.value))) pair.key.spaceBefore = true;
  }
  const cards = doc.get('cards', true);
  // A blank line between cards. It is how the docs' own example reads, and it
  // is the difference between a file you can scan and a wall.
  for (let index = 1; index < (cards?.items?.length || 0); index++) {
    cards.items[index].spaceBefore = true;
  }
  // A bare 2026-07-31 is a string under YAML 1.2 core and a date under 1.1, and
  // this file is meant to survive other people's tools.
  const exportedOn = doc.getIn(['extensions', EXPORT_KEY, 'exportedOn'], true);
  if (exportedOn) exportedOn.type = 'QUOTE_SINGLE';
  return doc.toString({ lineWidth: 0 });
}

/**
 * Build it, write it, and read it back before anybody is handed it.
 *
 * A file this app cannot re-read is a bug in here rather than anything the
 * person did, which is exactly why reaching that answer is a sentence and not a
 * thrown error.
 */
export async function writeCourseFile(input) {
  const built = await buildDeckExport(input);
  const text = await emitCourseYaml(built.document, built.header);
  const read = await readCourseFile(text, { fileName: built.fileName });
  const errors = read.diagnostics.filter((item) => item.severity === 'error');
  if (!read.course || errors.length) {
    return {
      ...built,
      ok: false,
      text: '',
      bytes: 0,
      overLimit: false,
      diagnostics: read.diagnostics,
      say: errors[0] ? `${errors[0].message} ${errors[0].correction}` : '',
    };
  }
  /* Answered here rather than measured again on the screen, so that the size a
   * caveat is written against and the size the reader refuses are one number.
   * The file still goes out: withholding somebody's own words over a limit of
   * ours is not on. */
  const bytes = new TextEncoder().encode(text).byteLength;
  return {
    ...built,
    ok: true,
    text,
    bytes,
    overLimit: bytes > COURSE_YAML_LIMITS.inputBytes,
    diagnostics: read.diagnostics,
    say: '',
  };
}
