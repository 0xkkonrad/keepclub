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
const publicSchema = readJson('schema', 'course-v2.schema.json');
const sectionLimit = publicSchema.properties.sections.maxItems;
const groupLimit = publicSchema.properties.groups.maxItems;
const groupSectionLimit = publicSchema.$defs.group.properties.sectionIds.maxItems;
const tagLimit = publicSchema.$defs.card.properties.tags.maxItems;
const tagLengthLimit = publicSchema.$defs.card.properties.tags.items.maxLength;
const titleLengthLimit = publicSchema.$defs.title.maxLength;
const languageLengthLimit = publicSchema.$defs.languageTag.maxLength;
const urlLengthLimit = publicSchema.$defs.httpsUrl.maxLength;
const passed = [];
const failed = [];
const ok = (condition, message) =>
  (condition ? passed : failed).push((condition ? 'PASS  ' : 'FAIL  ') + message);
const codes = (result) => new Set(result.diagnostics.map((diagnostic) => diagnostic.code));
const hasDiagnostic = (result, code, path) => result.diagnostics.some((diagnostic) =>
  diagnostic.code === code && diagnostic.path === path);

for (const name of fs.readdirSync(validDir).filter((name) => name.endsWith('.json')).sort()) {
  const source = readJson('schema', 'fixtures', 'valid', name);
  const before = JSON.stringify(source);
  const result = readCourse(source);
  ok(!!result.course, `${name}: accepted by the composed reader`);
  ok(result.sourceFormat === 'course-v2'
      && result.contentRepresentation === 'authored-commonmark',
  `${name}: v2 text is marked authored CommonMark, not runtime HTML`);
  ok(result.diagnostics.every((diagnostic) =>
    diagnostic.docsUrl === 'https://docs.keepclub.app/reference/errors/#'
      + diagnostic.code.replace(/[._]/g, '-')),
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
    courseId: 'empty-optionals',
    authors: [],
    sections: [],
    groups: [],
    cards: [{
      cardId: 'one',
      front: 'Prompt',
      tags: [],
      media: [],
    }],
  });
  ok(!!result.course
      && !Object.hasOwn(result.course, 'authors')
      && result.course.sections.length === 1
      && result.course.groups.length === 0
      && !Object.hasOwn(result.course.cards[0], 'tags')
      && !Object.hasOwn(result.course.cards[0], 'media')
      && result.diagnostics.filter((item) => item.code === 'field.empty_optional').length === 5,
  'documented empty optional arrays warn and normalize to their absent defaults');
}

{
  const result = readCourse({
    schemaVersion: 2,
    courseId: 'strict-readable-fields',
    sections: [{ sectionId: 'all', title: 'All', description: 7 }],
    groups: [{
      groupId: 'everything',
      title: 'Everything',
      description: [],
      sectionIds: ['all'],
    }],
    cards: [
      { cardId: 'bad-tags-list', sectionId: 'all', front: 'One', tags: 'memory' },
      { cardId: 'bad-tag-type', sectionId: 'all', front: 'Two', tags: [7] },
      { cardId: 'blank-tag', sectionId: 'all', front: 'Three', tags: [' '] },
      {
        cardId: 'long-tag',
        sectionId: 'all',
        front: 'Four',
        tags: ['x'.repeat(tagLengthLimit + 1)],
      },
    ],
  });
  ok(result.course === null
      && hasDiagnostic(result, 'field.invalid_type', '$.sections[0].description')
      && hasDiagnostic(result, 'field.invalid_type', '$.groups[0].description')
      && hasDiagnostic(result, 'field.invalid_type', '$.cards[0].tags')
      && hasDiagnostic(result, 'field.invalid_type', '$.cards[1].tags[0]')
      && hasDiagnostic(result, 'field.empty', '$.cards[2].tags[0]')
      && hasDiagnostic(result, 'field.empty', '$.cards[3].tags[0]'),
  'runtime validation matches schema types and meaningful optional-string rules');
}

{
  const exactTitle = '🗼'.repeat(titleLengthLimit);
  const exact = readCourse({
    schemaVersion: 2,
    courseId: 'unicode-title-limit',
    sections: [{ sectionId: 'all', title: exactTitle }],
    groups: [{
      groupId: 'all',
      title: exactTitle,
      sectionIds: ['all'],
    }],
    cards: [{ cardId: 'one', sectionId: 'all', front: 'Prompt' }],
  });
  const tooLong = readCourse({
    schemaVersion: 2,
    courseId: 'unicode-title-over-limit',
    sections: [{ sectionId: 'all', title: `${exactTitle}🗼` }],
    cards: [{ cardId: 'one', sectionId: 'all', front: 'Prompt' }],
  });
  ok(!!exact.course && exact.course.sections[0].title === exactTitle
      && exact.course.groups[0].title === exactTitle
      && tooLong.course === null
      && hasDiagnostic(tooLong, 'field.empty', '$.sections[0].title'),
  'title bounds use JSON Schema Unicode code points rather than UTF-16 units');
}

{
  const sections = Array.from({ length: sectionLimit }, (_, index) => ({
    sectionId: `section-${index}`,
    title: `Section ${index}`,
  }));
  const cards = sections.map((section, index) => ({
    cardId: `card-${index}`,
    sectionId: section.sectionId,
    front: `Prompt ${index}`,
    ...(index === 0 ? {
      tags: Array.from({ length: tagLimit }, (_, tag) => `tag-${tag}`),
    } : {}),
  }));
  const result = readCourse({
    schemaVersion: 2,
    courseId: 'exact-list-limits',
    sections,
    groups: [{
      groupId: 'all-sections',
      title: 'All sections',
      sectionIds: sections.map((section) => section.sectionId),
    }],
    cards,
  });
  ok(!!result.course
      && result.course.sections.length === sectionLimit
      && result.course.groups[0].sectionIds.length === groupSectionLimit
      && result.course.cards[0].tags.length === tagLimit,
  'runtime accepts the JSON Schema section, membership, and tag bounds exactly');
}

{
  const sections = Array.from({ length: groupLimit }, (_, index) => ({
    sectionId: `section-${index}`,
    title: `Section ${index}`,
  }));
  const result = readCourse({
    schemaVersion: 2,
    courseId: 'exact-group-limit',
    sections,
    groups: sections.map((section, index) => ({
      groupId: `group-${index}`,
      title: `Group ${index}`,
      sectionIds: [section.sectionId],
    })),
    cards: sections.map((section, index) => ({
      cardId: `card-${index}`,
      sectionId: section.sectionId,
      front: `Prompt ${index}`,
    })),
  });
  ok(!!result.course && result.course.groups.length === groupLimit,
    'runtime accepts the JSON Schema group bound exactly');
}

{
  const tooManySections = Array.from({ length: sectionLimit + 1 }, (_, index) => ({
    sectionId: `section-${index}`,
    title: `Section ${index}`,
  }));
  const sectionResult = readCourse({
    schemaVersion: 2,
    courseId: 'too-many-sections',
    sections: tooManySections,
    cards: tooManySections.map((section, index) => ({
      cardId: `card-${index}`,
      sectionId: section.sectionId,
      front: `Prompt ${index}`,
    })),
  });

  const groupSections = Array.from({ length: groupLimit + 1 }, (_, index) => ({
    sectionId: `section-${index}`,
    title: `Section ${index}`,
  }));
  const groupResult = readCourse({
    schemaVersion: 2,
    courseId: 'too-many-groups',
    sections: groupSections,
    groups: groupSections.map((section, index) => ({
      groupId: `group-${index}`,
      title: `Group ${index}`,
      sectionIds: [section.sectionId],
    })),
    cards: groupSections.map((section, index) => ({
      cardId: `card-${index}`,
      sectionId: section.sectionId,
      front: `Prompt ${index}`,
    })),
  });

  const memberSections = Array.from({ length: groupSectionLimit }, (_, index) => ({
    sectionId: `section-${index}`,
    title: `Section ${index}`,
  }));
  const memberResult = readCourse({
    schemaVersion: 2,
    courseId: 'too-many-members',
    sections: memberSections,
    groups: [{
      groupId: 'all-sections',
      title: 'All sections',
      sectionIds: [
        ...memberSections.map((section) => section.sectionId),
        memberSections[0].sectionId,
      ],
    }],
    cards: memberSections.map((section, index) => ({
      cardId: `card-${index}`,
      sectionId: section.sectionId,
      front: `Prompt ${index}`,
    })),
  });

  const tagResult = readCourse({
    schemaVersion: 2,
    courseId: 'too-many-tags',
    cards: [{
      cardId: 'one',
      front: 'Prompt',
      tags: Array.from({ length: tagLimit + 1 }, (_, index) => `tag-${index}`),
    }],
  });

  ok(sectionResult.course === null
      && hasDiagnostic(sectionResult, 'field.invalid_type', '$.sections')
      && groupResult.course === null
      && hasDiagnostic(groupResult, 'field.invalid_type', '$.groups')
      && memberResult.course === null
      && hasDiagnostic(memberResult, 'field.invalid_type', '$.groups[0].sectionIds')
      && tagResult.course === null
      && hasDiagnostic(tagResult, 'field.invalid_type', '$.cards[0].tags'),
  'runtime rejects one-over-limit collections at the JSON Schema paths');
}

{
  const longFront = 'L'.repeat(4001);
  const result = readCourse({
    schemaVersion: 2,
    courseId: 'quality-advice',
    title: 'Quality advice',
    description: 'Exercises deterministic quality warnings.',
    authors: [{ name: 'keep club' }],
    cards: [
      {
        cardId: 'first',
        front: ' Reveal the answer below. ',
        back: ' ',
        tags: ['Maße', 'MASSE', 'ＭＡＳＳＥ'],
        media: [{
          side: 'front',
          mediaType: 'image',
          source: 'media/prompt.png',
          alternativeText: 'prompt.png',
        }],
      },
      { cardId: 'duplicate', front: 'reveal the answer below.' },
      { cardId: 'long', front: longFront, tags: [] },
      {
        cardId: 'has-back-media',
        front: 'Flip this card over.',
        media: [{
          side: 'back',
          mediaType: 'image',
          source: 'media/answer.png',
          alternativeText: 'A labeled answer diagram',
        }],
      },
    ],
  });
  const diagnosticsByCode = (code) =>
    result.diagnostics.filter((diagnostic) => diagnostic.code === code);
  ok(!!result.course
      && diagnosticsByCode('card.long_side')[0]?.path === '$.cards[2].front'
      && diagnosticsByCode('card.front_only_answer_cue').length === 2
      && diagnosticsByCode('card.duplicate_looking_content')[0]?.path === '$.cards[1]'
      && diagnosticsByCode('media.alt_weak')[0]?.path
        === '$.cards[0].media[0].alternativeText',
  'quality warnings cover long sides, answer cues, duplicate-looking text, and weak alt text');
  ok(diagnosticsByCode('card.duplicate_tag').length === 2
      && result.course?.cards[0].tags.join(',') === 'Maße'
      && !Object.hasOwn(result.course?.cards[2] || {}, 'tags')
      && codes(result).has('field.empty_optional'),
  'duplicate tags use Unicode compatibility/case folding and retain the first spelling');
  ok(!result.diagnostics.some((diagnostic) =>
    diagnostic.code === 'card.front_only_answer_cue'
      && diagnostic.path === '$.cards[3].front'),
  'back-side media suppresses the front-only answer-cue warning');
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
  const longLanguage = `aa-${'a-'.repeat(31)}a`;
  const longWebsite = `https://example.com/${'x'.repeat(urlLengthLimit)}`;
  const result = readCourse({
    schemaVersion: 2,
    courseId: 'bounded-media-metadata',
    cards: [{
      cardId: 'one',
      front: 'Prompt',
      media: [{
        side: 'back',
        mediaType: 'video',
        source: 'media/example.webm',
        credit: { name: 'Creator', website: longWebsite },
        captionTracks: [{
          source: 'media/captions.vtt',
          language: longLanguage,
        }],
      }],
    }],
  });
  ok(longLanguage.length > languageLengthLimit
      && result.course === null
      && hasDiagnostic(result, 'field.invalid_type',
        '$.cards[0].media[0].captionTracks[0].language')
      && hasDiagnostic(result, 'field.invalid_type',
        '$.cards[0].media[0].credit.website'),
  'caption language and credit URL bounds match the reusable JSON Schema definitions');
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
    courseId: 'bounded-quality-advice',
    cards: Array.from({ length: 150 }, (_, index) => ({
      cardId: `card-${index}`,
      front: `Prompt ${index}`,
      tags: ['Memory', 'memory'],
    })),
  });
  ok(!!result.course && result.diagnostics.length === 100
      && result.diagnostics.every((diagnostic) => diagnostic.severity === 'warning')
      && !codes(result).has('document.too_many_errors'),
  'warning overflow stays bounded without turning an accepted course into an error');
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

{
  const topLevel = JSON.parse(`{
    "schemaVersion": 2,
    "courseId": "prototype-data",
    "cards": [{ "cardId": "one", "front": "Safe" }],
    "__proto__": { "title": "Inherited title" }
  }`);
  const cardLevel = JSON.parse(`{
    "schemaVersion": 2,
    "courseId": "prototype-card",
    "cards": [{
      "cardId": "one",
      "__proto__": { "front": "Inherited prompt" }
    }]
  }`);
  const nestedLevel = JSON.parse(`{
    "schemaVersion": 2,
    "courseId": "prototype-author",
    "authors": [{
      "__proto__": { "name": "Inherited author" }
    }],
    "cards": [{ "cardId": "one", "front": "Safe" }]
  }`);
  const inheritedCard = Object.create({ front: 'Inherited prompt' });
  inheritedCard.cardId = 'one';
  const topResult = readCourse(topLevel);
  const cardResult = readCourse(cardLevel);
  const nestedResult = readCourse(nestedLevel);
  const inheritedResult = readCourse({
    schemaVersion: 2,
    courseId: 'inherited-card',
    cards: [inheritedCard],
  });
  ok(topResult.course === null
      && hasDiagnostic(topResult, 'field.unknown', '$.__proto__')
      && cardResult.course === null
      && hasDiagnostic(cardResult, 'field.unknown', '$.cards[0].__proto__')
      && codes(cardResult).has('card.front_empty')
      && nestedResult.course === null
      && hasDiagnostic(nestedResult, 'field.unknown', '$.authors[0].__proto__')
      && hasDiagnostic(nestedResult, 'field.empty', '$.authors[0].name')
      && inheritedResult.course === null
      && codes(inheritedResult).has('card.front_empty')
      && !Object.hasOwn(Object.prototype, 'title')
      && !Object.hasOwn(Object.prototype, 'front')
      && !Object.hasOwn(Object.prototype, 'name'),
  'special and inherited object data cannot satisfy fields or mutate prototypes');
}

console.log([...passed, ...failed].join('\n'));
console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
