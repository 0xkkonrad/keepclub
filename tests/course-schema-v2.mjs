/* The composed reader: parsed v2 validation/defaults plus permanent v1 dispatch. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCourse } from '../web/lib/course.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (...parts) => JSON.parse(fs.readFileSync(path.join(ROOT, ...parts), 'utf8'));
const validDir = path.join(ROOT, 'schema', 'fixtures', 'valid');
const invalidDir = path.join(ROOT, 'schema', 'fixtures', 'invalid');
const passed = [];
const failed = [];
const ok = (condition, message) =>
  (condition ? passed : failed).push((condition ? 'PASS  ' : 'FAIL  ') + message);
const codes = (result) => new Set(result.diagnostics.map((diagnostic) => diagnostic.code));

for (const name of fs.readdirSync(validDir).filter((name) => name.endsWith('.json')).sort()) {
  const source = readJson('schema', 'fixtures', 'valid', name);
  const before = JSON.stringify(source);
  const result = readCourse(source);
  ok(!!result.course, `${name}: accepted by the composed reader`);
  ok(result.sourceFormat === 'course-v2'
      && result.contentRepresentation === 'authored-commonmark',
  `${name}: v2 text is marked authored CommonMark, not runtime HTML`);
  ok(result.diagnostics.every((diagnostic) =>
    diagnostic.docsUrl?.startsWith('https://docs.keepclub.app/reference/errors/#')),
  `${name}: every diagnostic uses docsUrl`);
  ok(JSON.stringify(source) === before, `${name}: validation does not mutate its input`);
}

{
  const source = readJson('schema', 'fixtures', 'valid', 'minimal-front-only.json');
  const first = readCourse(source);
  const reordered = {
    cards: source.cards.map((card) => ({ front: card.front, cardId: card.cardId })),
    courseId: source.courseId,
    schemaVersion: source.schemaVersion,
  };
  const second = readCourse(reordered);
  ok(first.course?.sections.length === 1
      && first.course.sections[0].sectionId === 'all-cards'
      && first.course.sections[0].cardCount === 2,
  'a course without sections gets one derived all-cards section');
  ok(first.course?.cards.every((card) => card.sectionId === 'all-cards'),
    'cards without organization are assigned to the derived section');
  ok(first.course?.groups.length === 0 && first.course.cardCount === 2,
    'groups and course cardCount are derived');
  ok(first.course?.buildFingerprint === second.course?.buildFingerprint,
    'build fingerprint is deterministic across object key order');
}

{
  const sectioned = readCourse(readJson(
    'schema', 'fixtures', 'valid', 'sectioned.json',
  )).course;
  ok(sectioned?.sections.map((section) => section.cardCount).join(',') === '1,1',
    'declared section counts are derived');
  ok(sectioned?.groups[0].cardCount === 2,
    'declared group counts are derived from section membership');
}

for (const name of [
  'structural-empty-course.json',
  'structural-identities.json',
  'structural-no-front.json',
  'structural-unknown-field.json',
  'semantic-ambiguous-section.json',
  'semantic-identities-and-references.json',
]) {
  const fixture = readJson('schema', 'fixtures', 'invalid', name);
  const result = readCourse(fixture.course);
  const actual = codes(result);
  const expected = fixture.expectedDiagnostics.filter((code) => [
    'course.cards_required', 'course.invalid_id', 'card.missing_id',
    'card.front_empty', 'field.unknown', 'section.ambiguous_default',
    'section.empty', 'card.duplicate_id', 'section.duplicate_id',
    'section.unknown', 'group.duplicate_id', 'group.unknown_section',
    'group.duplicate_section', 'group.ungrouped_section',
  ].includes(code));
  ok(result.course === null, `${name}: core errors block the whole course`);
  ok(expected.every((code) => actual.has(code)),
    `${name}: emits its core diagnostics (${expected.filter((code) => !actual.has(code)).join(', ')})`);
}

{
  const result = readCourse({
    schemaVersion: 2,
    courseId: 'front-only',
    cards: [{ cardId: 'one', front: 'Recall it.', back: '   ' }],
  });
  ok(!!result.course && !Object.hasOwn(result.course.cards[0], 'back')
      && codes(result).has('field.empty_back'),
  'a blank back warns and normalizes to intentional absence');
}

{
  const result = readCourse({
    schemaVersion: 2,
    courseId: 'broken-media-front',
    cards: [{ cardId: 'one', media: [{ side: 'front' }] }],
  });
  ok(result.course === null && codes(result).has('card.front_empty'),
  'an incomplete media object cannot make an otherwise blank front renderable');
}

{
  const result = readCourse({
    schemaVersion: 2,
    courseId: 'media-only',
    contentLanguage: 'en',
    cards: [{
      cardId: 'one',
      media: [
        {
          mediaId: 'prompt',
          side: 'front',
          mediaType: 'image',
          source: 'media/prompt.png',
          alternativeText: 'A prompt diagram',
          width: 640,
          height: 480,
        },
        {
          side: 'back',
          mediaType: 'audio',
          source: 'media/answer.mp3',
          transcript: 'The **spoken** answer.',
          durationSeconds: 3.5,
          credit: { name: 'Example', website: 'https://example.com/audio' },
        },
        {
          side: 'back',
          mediaType: 'video',
          source: 'media/demo.webm',
          posterImage: 'media/poster.webp',
          captionTracks: [{
            source: 'media/en.vtt', language: 'en', label: 'English', default: true,
          }],
        },
      ],
    }],
  });
  ok(!!result.course && result.course.cards[0].media.length === 3,
    'image, audio, and video media normalize without compacting descriptive fields');
  ok(result.course?.cards[0].front === undefined
      && result.course.cards[0].media[0].source === 'media/prompt.png',
  'front-side media alone is a renderable prompt and retains its authored source');
  ok(result.course?.title === 'Media only'
      && result.course.shortTitle === 'Media only'
      && result.course.instructionLanguage === 'en'
      && result.course.theme.loadingAnimation === 'gentle-bob',
  'frozen title, language, and keep club theme defaults are applied');
}

{
  const invalidMedia = readCourse({
    schemaVersion: 2,
    courseId: 'unsafe-media',
    cards: [{
      cardId: 'one',
      front: 'Prompt',
      media: [
        { side: 'back', mediaType: 'image', source: 'https://evil.example/x.png' },
        { side: 'back', mediaType: 'audio', source: '../answer.mp3', width: 5 },
        { side: 'back', mediaType: 'video', source: 'media/not-video.png', decorative: true },
      ],
    }],
  });
  const invalidCodes = codes(invalidMedia);
  ok(invalidMedia.course === null && invalidCodes.has('media.invalid_path')
      && invalidCodes.has('media.type_mismatch') && invalidCodes.has('field.unknown'),
  'remote/traversing sources, type mismatches, and per-type fields are rejected');

  const publication = readCourse({
    schemaVersion: 2,
    courseId: 'publish-media',
    cards: [{
      cardId: 'one',
      media: [{ side: 'front', mediaType: 'image', source: 'prompt.png' }],
    }],
  }, { publication: true });
  const publicationCodes = codes(publication);
  ok(publication.course === null
      && publicationCodes.has('publication.image_alt_required')
      && publicationCodes.has('publication.image_dimensions_required')
      && publicationCodes.has('publication.license_required'),
  'publication mode requires image accessibility metadata and a license');
}

{
  const result = readCourse({
    schemaVersion: 2,
    courseId: 'strict-metadata',
    theme: { accentColor: 'red', script: 'attack()' },
    authors: [{ name: 'Creator', social: '@creator' }],
    source: { repository: 'http://example.com/repo' },
    extensions: { unnamespaced: true },
    cards: [{ cardId: 'one', front: 'Prompt' }],
  });
  ok(result.course === null
      && result.diagnostics.filter((item) => item.code === 'field.unknown').length >= 2
      && codes(result).has('field.invalid_type')
      && codes(result).has('extension.invalid_namespace'),
  'nested metadata, theme, and extension objects are strict');
}

{
  const result = readCourse({
    schemaVersion: 2,
    courseId: 'bounded-diagnostics',
    cards: Array.from({ length: 150 }, (_, index) => ({
      cardId: `card-${index}`,
      front: 'Prompt',
      unknown: true,
    })),
  });
  ok(result.diagnostics.length === 101
      && result.diagnostics.at(-1)?.code === 'document.too_many_errors',
  'v2 validation caps diagnostics at 100 and records that more errors exist');
}

{
  const result = readCourse({
    schemaVersion: 2,
    courseId: 'strict-fields',
    extra: true,
    sections: [{ sectionId: 'one', title: 'One', extra: true }],
    groups: [{
      groupId: 'all', title: 'All', sectionIds: ['one'], extra: true,
    }],
    cards: [{ cardId: 'one', sectionId: 'one', front: 'Prompt', q: 'old' }],
  });
  ok([...codes(result)].includes('field.unknown')
      && result.diagnostics.filter((diagnostic) => diagnostic.code === 'field.unknown').length === 4,
  'course, section, group, and card objects reject unknown fields');
}

{
  const result = readCourse({
    courseId: 'missing-version',
    sections: [{ sectionId: 'all', title: 'All' }],
    cards: [{ cardId: 'one', sectionId: 'all', front: 'Prompt' }],
  });
  ok(result.course === null && codes(result).has('course.unsupported_schema_version'),
    'an unversioned descriptive course is not mistaken for unmarked legacy v1');
}

{
  const legacy = {
    format: 1,
    name: 'Imported',
    sections: [{ k: 'all', t: 'All', n: 1 }],
    cards: [{ i: 'stable-', s: 'all', q: 'Front', a: 'Back' }],
  };
  const result = readCourse(legacy, { courseId: 'local-imported' });
  ok(result.course?.courseId === 'local-imported'
      && result.course.cards[0].cardId === 'stable-',
  'legacy dispatch preserves surrounding course and card identities');
  ok(result.sourceFormat === 'legacy-v1'
      && result.contentRepresentation === 'sanitized-html',
  'legacy text is marked as already rendered/sanitized HTML');
  ok(result.diagnostics.every((diagnostic) => 'docsUrl' in diagnostic && !('docs' in diagnostic)),
    'legacy diagnostics are composed into the docsUrl contract');
}

{
  const cycle = { schemaVersion: 2, courseId: 'cycle', cards: [] };
  cycle.extensions = { 'org.example.loop': cycle };
  let result;
  assert.doesNotThrow(() => { result = readCourse(cycle); });
  ok(result.course === null && codes(result).has('field.invalid_type'),
    'cyclic v2 input is refused without throwing');

  const accessor = { schemaVersion: 2, courseId: 'getter' };
  Object.defineProperty(accessor, 'cards', {
    enumerable: true,
    get() { throw new Error('must not run'); },
  });
  assert.doesNotThrow(() => { result = readCourse(accessor); });
  ok(result.course === null && codes(result).has('field.invalid_type'),
    'accessor input is refused without invoking the getter');

  const revocable = Proxy.revocable({}, {});
  revocable.revoke();
  assert.doesNotThrow(() => { result = readCourse(revocable.proxy); });
  ok(result.course === null, 'a revoked proxy cannot make readCourse throw');
}

console.log([...passed, ...failed].join('\n'));
console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
