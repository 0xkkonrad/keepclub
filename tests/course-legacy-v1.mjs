/* Permanent format-1 compatibility: old cards, IDs, and progress survive the
 * move to descriptive runtime objects without touching their source records. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  detectCourseFormat,
  normalizeLegacyCourse,
} from '../web/lib/legacy-course.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const LEGACY_DOCS =
  'https://docs.keepclub.app/reference/errors/#legacy-compatibility';
const passed = [];
const failed = [];
const ok = (condition, message) =>
  (condition ? passed : failed).push((condition ? 'PASS  ' : 'FAIL  ') + message);

function readJson(...parts) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, ...parts), 'utf8'));
}

function errors(result) {
  return result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return value;
}

let builtInCards = 0;
for (const courseFolder of ['day-skipper', 'competent-crew']) {
  const meta = readJson('web', 'courses', courseFolder, 'course.json');
  const legacy = readJson('web', 'courses', courseFolder, 'cards.json');
  const before = JSON.stringify(legacy);
  deepFreeze(legacy);

  const result = normalizeLegacyCourse(legacy, { courseId: meta.id || courseFolder });
  const normalized = result.course;
  ok(result.sourceFormat === 'legacy-v1',
    `${courseFolder}: an unmarked shipped cards.json is detected as legacy v1`);
  ok(errors(result).length === 0,
    `${courseFolder}: all shipped cards normalize (${errors(result).map((e) => e.code).join(', ')})`);
  ok(!!normalized && normalized.courseId === (meta.id || courseFolder),
    `${courseFolder}: its surrounding course ID is preserved`);
  ok(JSON.stringify(legacy) === before,
    `${courseFolder}: normalization does not mutate the frozen source object`);

  if (!normalized) continue;
  const oldIds = legacy.cards.map((card) => card.i);
  const newIds = normalized.cards.map((card) => card.cardId);
  ok(JSON.stringify(newIds) === JSON.stringify(oldIds),
    `${courseFolder}: every card ID is byte-identical and in the same order`);
  ok(new Set(newIds).size === oldIds.length,
    `${courseFolder}: every normalized card ID remains unique`);
  ok(normalized.sections.every((section) =>
    section.cardCount === normalized.cards.filter((card) =>
      card.sectionId === section.sectionId).length),
  `${courseFolder}: section counts are derived from normalized cards`);
  ok(normalized.groups.every((group) =>
    group.cardCount === normalized.cards.filter((card) =>
      group.sectionIds.includes(card.sectionId)).length),
  `${courseFolder}: group counts are derived from normalized cards`);

  const legacyImage = legacy.cards.find((card) => card.m);
  const imageCard = normalized.cards.find((card) => card.cardId === legacyImage?.i);
  ok(!legacyImage || (imageCard?.media?.[0]?.side === 'back'
      && imageCard.media[0].mediaType === 'image'
      && imageCard.media[0].source === `img/${legacyImage.m}`
      && imageCard.media[0].width === legacyImage.d[0]
      && imageCard.media[0].height === legacyImage.d[1]),
  `${courseFolder}: legacy diagrams become explicit descriptive back-side media`);

  const legacyFigure = legacy.cards.find((card) => card.f);
  const figureCard = normalized.cards.find((card) => card.cardId === legacyFigure?.i);
  ok(!legacyFigure || (figureCard?.figure?.figureId === legacyFigure.f.n
      && JSON.stringify(figureCard.figure.highlightedLabels)
        === JSON.stringify(legacyFigure.f.on || [])),
  `${courseFolder}: trusted built-in figure references retain their labels`);

  const legacyReference = legacy.cards.find((card) => card.r);
  const referenceCard = normalized.cards.find((card) => card.cardId === legacyReference?.i);
  ok(!legacyReference
      || referenceCard?.reference?.sourceSectionId === legacyReference.r,
  `${courseFolder}: legacy source references use a descriptive compatibility field`);
  builtInCards += normalized.cards.length;
}
ok(builtInCards === 737, `all 737 built-in cards cross the adapter (${builtInCards})`);

{
  // Shape produced by the existing Anki importer and stored as the `deck`
  // property of an IndexedDB/backup record. IDs intentionally include suffixes
  // and a value derived from an integer above JavaScript's safe range.
  const imported = {
    format: 1,
    name: 'Imported navigation',
    sections: [
      { k: 'facts', t: 'Facts', n: 2, o: 1 },
      { k: 'sounds', t: 'Sounds', n: 1, o: 2 },
    ],
    groups: [],
    cards: [
      { i: '2gosa7pa2gv', s: 'facts', q: 'Front', a: 'Back' },
      { i: '2gosa7pa2gv-', s: 'facts', q: 'Duplicate row', a: 'Still distinct' },
      {
        i: 'anki-audio',
        s: 'sounds',
        q: 'Call',
        a: '<audio controls src="munin-media:7"></audio>',
      },
    ],
    build: '00ff33aa',
  };
  const backupRecord = {
    id: 'local-backup1',
    ids: imported.cards.map((card) => card.i),
    deck: imported,
  };
  const before = JSON.stringify(backupRecord);
  const result = normalizeLegacyCourse(backupRecord.deck, { courseId: backupRecord.id });
  ok(errors(result).length === 0,
    `an imported/backup format-1 record normalizes (${errors(result).map((e) => e.code).join(', ')})`);
  ok(result.course?.courseId === backupRecord.id,
    'an imported course keeps its IndexedDB/backup record ID');
  ok(JSON.stringify(result.course?.cards.map((card) => card.cardId))
      === JSON.stringify(backupRecord.ids),
  'Anki card IDs remain byte-identical through backup normalization');
  ok(result.course?.cards[2].back === imported.cards[2].a,
    'existing imported media references remain byte-identical in rendered content');
  ok(JSON.stringify(backupRecord) === before,
    'normalizing a backup record deck performs no persistent-object mutation');
}

{
  const embedded = {
    format: 1,
    course: 'local-embedded',
    sections: [{ k: 'all', t: 'All', n: 1 }],
    cards: [{ i: 'stable-card', s: 'all', q: 'Front', a: 'Back' }],
  };
  const result = normalizeLegacyCourse(embedded);
  ok(result.course?.courseId === 'local-embedded',
    'an embedded legacy course ID is preserved when context is absent');
  const mismatch = normalizeLegacyCourse(embedded, { courseId: 'local-other' });
  ok(mismatch.course === null
      && mismatch.diagnostics.some((diagnostic) => diagnostic.code === 'course.id_mismatch'),
  'a surrounding/embedded ID mismatch is blocked instead of forking progress');
}

{
  const withoutId = {
    sections: [{ k: 'all', t: 'All', n: 1 }],
    cards: [{ i: 'stable-card', s: 'all', q: 'Front', a: 'Back' }],
  };
  const result = normalizeLegacyCourse(withoutId);
  const diagnostic = result.diagnostics.find((item) => item.code === 'course.missing_id');
  ok(result.course === null && diagnostic?.path === '$.course'
      && diagnostic.correction.includes('options.courseId'),
  'a missing legacy course ID gets an actionable error instead of a title-derived ID');
  ok(diagnostic?.docsUrl === LEGACY_DOCS,
    'legacy diagnostics point to one honest compatibility reference, not a missing public-code anchor');
}

{
  const v2 = { schemaVersion: 2, courseId: 'new', cards: [] };
  const result = normalizeLegacyCourse(v2);
  ok(detectCourseFormat(v2) === 'course-v2'
      && result.course === null
      && result.diagnostics[0]?.code === 'format.not_legacy',
  'the legacy reader never passes arbitrary format-2 input through as validated');
  ok(detectCourseFormat({ schemaVersion: 99 }) === 'unsupported',
    'an unknown descriptive schema version is explicitly unsupported');
  ok(detectCourseFormat({ format: 7 }) === 'unsupported',
    'an unknown compact format is explicitly unsupported');
}

{
  const cycle = {
    format: 1,
    name: 'Cyclic extension',
    sections: [{ k: 'all', t: 'All', n: 1 }],
    cards: [{ i: 'cycle-safe', s: 'all', q: 'Front', a: 'Back' }],
  };
  cycle.thirdParty = cycle;
  let result;
  assert.doesNotThrow(() => { result = normalizeLegacyCourse(cycle, { courseId: 'cycle' }); });
  ok(result.course?.cards[0].cardId === 'cycle-safe'
      && result.diagnostics.some((diagnostic) => diagnostic.code === 'legacy.unknown_field'),
  'a cyclic unknown extension cannot recurse or disappear silently');
}

{
  const hostile = {
    format: 1,
    sections: [{ k: 'all', t: 'All', n: 1 }],
  };
  Object.defineProperty(hostile, 'cards', {
    enumerable: true,
    get() { throw new Error('getter ran'); },
  });
  let result;
  assert.doesNotThrow(() => { result = normalizeLegacyCourse(hostile, { courseId: 'hostile' }); });
  ok(result.course === null
      && result.diagnostics.some((diagnostic) =>
        diagnostic.code === 'course.unreadable' && diagnostic.path === '$.cards'),
  'a throwing accessor becomes a bounded diagnostic and is never invoked');

  const revocable = Proxy.revocable({}, {});
  revocable.revoke();
  assert.doesNotThrow(() => { result = normalizeLegacyCourse(revocable.proxy); });
  ok(result.course === null
      && result.diagnostics.some((diagnostic) => diagnostic.code === 'course.unreadable'),
  'a revoked proxy cannot make the adapter throw');
}

console.log([...passed, ...failed].join('\n'));
console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
