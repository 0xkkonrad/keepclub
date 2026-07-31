/* Contract-only JSON Schema fixture gate.
 *
 * Production YAML parsing/semantic validation belongs to later phases. The
 * evaluator this leans on covers only the standard keywords
 * schema/course-v2.schema.json uses, so Phase 0 examples cannot drift while the
 * runtime dependency is still being chosen. It lives in json-schema.mjs because
 * the export suite holds the documents keep club writes to the same schema.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { courseSchema as schema, validate } from './json-schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_DIR = path.join(ROOT, 'schema');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const failures = [];
let passed = 0;

function check(condition, label, detail = '') {
  if (condition) {
    passed++;
    process.stdout.write(`PASS  ${label}\n`);
  } else {
    failures.push(`${label}${detail ? `\n      ${detail}` : ''}`);
    process.stdout.write(`FAIL  ${label}\n`);
  }
}

assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
assert.equal(schema.$id, 'https://docs.keepclub.app/schema/course-v2.schema.json');
for (const pattern of JSON.stringify(schema).matchAll(/"pattern":"((?:\\.|[^"])*)"/g)) {
  // JSON.parse turns the captured JSON string back into the exact regex.
  assert.doesNotThrow(() => new RegExp(JSON.parse(`"${pattern[1]}"`), 'u'));
}

const validDir = path.join(SCHEMA_DIR, 'fixtures', 'valid');
for (const name of fs.readdirSync(validDir).filter((name) => name.endsWith('.json')).sort()) {
  const errors = validate(readJson(path.join(validDir, name)), schema);
  check(errors.length === 0, `valid fixture ${name}`, errors.slice(0, 4).join('; '));
}

const invalidDir = path.join(SCHEMA_DIR, 'fixtures', 'invalid');
const diagnosticDocs = fs.readFileSync(path.join(SCHEMA_DIR, 'diagnostics.md'), 'utf8');
for (const name of fs.readdirSync(invalidDir).filter((name) => name.endsWith('.json')).sort()) {
  const fixture = readJson(path.join(invalidDir, name));
  if (fixture.schemaValid !== undefined) {
    const errors = validate(fixture.course, schema);
    check((errors.length === 0) === fixture.schemaValid, `schema expectation ${name}`, errors.slice(0, 4).join('; '));
  }
  for (const code of fixture.expectedDiagnostics || []) {
    check(diagnosticDocs.includes(`\`${code}\``), `${name} documents ${code}`);
  }
}

const forbiddenCompactFields = new Set(['i', 's', 'q', 'a', 'm', 'd', 'f', 'r', 'k', 't', 'n', 'o']);
const publicPropertyNames = new Set();
function collectProperties(rule) {
  for (const name of Object.keys(rule.properties || {})) publicPropertyNames.add(name);
  for (const value of Object.values(rule)) {
    if (value && typeof value === 'object') collectProperties(value);
  }
}
collectProperties(schema);
for (const field of forbiddenCompactFields) {
  check(!publicPropertyNames.has(field), `public schema excludes compact field ${field}`);
}

const limits = readJson(path.join(invalidDir, 'limits.json')).limits;
check(schema.properties.cards.maxItems === limits.cards, 'card limit agrees with fixture');
check(schema.properties.sections.maxItems === limits.sections, 'section limit agrees with fixture');
check(schema.properties.groups.maxItems === limits.groups, 'group limit agrees with fixture');
check(schema.$defs.card.properties.tags.maxItems === limits.tagsPerCard, 'tag limit agrees with fixture');
check(schema.$defs.card.properties.media.maxItems === limits.mediaPerCard, 'per-card media limit agrees with fixture');
check(schema.$defs.markdown.maxLength === limits.markdownCodePoints, 'Markdown limit agrees with fixture');
for (const source of [
  'https:remote.png', 'data:image.png', 'mailto:asset.png',
  '../up.png', 'a//b.png', 'a\\b.png', 'a/%2e%2e/b.png',
]) {
  check(validate(source, schema.$defs.assetPath).length > 0,
    `asset-path schema rejects ${source}`);
}

const mediaFieldValues = {
  mediaId: 'sample-media',
  side: 'front',
  source: 'media/sample.png',
  mimeType: 'image/png',
  alternativeText: 'A useful visual description.',
  decorative: false,
  caption: 'A **caption**.',
  posterImage: 'media/poster.webp',
  transcript: 'A complete transcript.',
  captionTracks: [{
    source: 'media/captions.vtt',
    language: 'en',
    label: 'English',
    default: true,
  }],
  durationSeconds: 12.5,
  width: 640,
  height: 480,
  credit: { name: 'Example creator', website: 'https://example.com/creator' },
  extensions: { 'org.example/course-field': true },
};
const commonMediaFields = [
  'mediaId', 'side', 'mediaType', 'source', 'mimeType', 'caption', 'credit',
  'extensions',
];
const mediaFieldsByType = {
  image: [
    ...commonMediaFields, 'alternativeText', 'decorative', 'width', 'height',
  ],
  audio: [
    ...commonMediaFields, 'transcript', 'durationSeconds',
  ],
  video: [
    ...commonMediaFields, 'posterImage', 'transcript', 'captionTracks',
    'durationSeconds', 'width', 'height',
  ],
};
const sourceByType = {
  image: ['media/sample.png', 'image/png'],
  audio: ['media/sample.mp3', 'audio/mpeg'],
  video: ['media/sample.webm', 'video/webm'],
};
const documentedMediaFields = new Set(Object.values(mediaFieldsByType).flat());
check(JSON.stringify([...documentedMediaFields].sort())
  === JSON.stringify(Object.keys(schema.$defs.media.properties).sort()),
'media schema exposes exactly the runtime-documented field union');

for (const [mediaType, allowedFields] of Object.entries(mediaFieldsByType)) {
  const allowed = new Set(allowedFields);
  const candidate = Object.fromEntries(allowedFields.map((field) => {
    if (field === 'mediaType') return [field, mediaType];
    if (field === 'source') return [field, sourceByType[mediaType][0]];
    if (field === 'mimeType') return [field, sourceByType[mediaType][1]];
    return [field, mediaFieldValues[field]];
  }));
  const validErrors = validate(candidate, schema.$defs.media);
  check(validErrors.length === 0, `${mediaType} accepts every applicable media field`,
    validErrors.slice(0, 4).join('; '));

  for (const field of documentedMediaFields) {
    if (allowed.has(field)) continue;
    const invalid = {
      side: 'front',
      mediaType,
      source: sourceByType[mediaType][0],
      [field]: mediaFieldValues[field],
    };
    check(validate(invalid, schema.$defs.media).length > 0,
      `${mediaType} rejects inapplicable field ${field}`);
  }
}

if (failures.length) {
  process.stderr.write(`\n${failures.length} course schema contract failure(s):\n- ${failures.join('\n- ')}\n`);
  process.exit(1);
}
process.stdout.write(`\n${passed} course schema contract checks passed\n`);
