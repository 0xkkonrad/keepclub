import assert from 'node:assert/strict';
import {
  COURSE_PACKAGE_LIMITS,
  normalizeCourseAssetPath,
  readCourseFile,
  sniffCourseAsset,
} from '../web/lib/course-package.js';
import { receiptHtml } from '../web/lib/receipt.js';

const passed = [];
const failed = [];
const ok = (condition, message) =>
  (condition ? passed : failed).push((condition ? 'PASS  ' : 'FAIL  ') + message);
const codes = (result) => new Set(result.diagnostics.map((item) => item.code));

function storedZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const body = Buffer.from(entry.bytes);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    locals.push(local, body);
    centrals.push(central);
    offset += local.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, directory, end]));
}

function centralOffset(archive, wanted) {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  for (let index = 0; index + 46 <= archive.length; index++) {
    if (view.getUint32(index, true) !== 0x02014b50) continue;
    const nameLength = view.getUint16(index + 28, true);
    const name = Buffer.from(archive.subarray(index + 46, index + 46 + nameLength)).toString();
    if (name === wanted) return index;
  }
  throw new Error(`central entry not found: ${wanted}`);
}

const minimal = `schemaVersion: 2
courseId: tiny-club
cards:
  - cardId: first
    front: Remember **one** thing.
  - cardId: second
    front: Notice another.
`;

{
  const result = await readCourseFile(minimal, { fileName: 'tiny.keep.yml' });
  ok(!!result.course && result.sourceKind === 'keep-yaml',
    'a minimal text-only .keep.yml is accepted');
  ok(result.course?.cards.length === 2
      && result.course.cards[0].front === 'Remember **one** thing.'
      && result.runtimeCourse.cards[0].front.includes('<strong>one</strong>'),
  'authored CommonMark is stored while a one-pass sanitized runtime preview is prepared');
  ok(result.authoredCourse?.cards[0].front === 'Remember **one** thing.'
      && result.authoredCourse.cardCount === undefined
      && result.authoredCourse.sections === undefined,
  'the canonical authored document excludes derived runtime fields');
  ok(!result.course?.cards.some((card) => Object.hasOwn(card, 'back')),
    'front-only intent remains an absent back');
  ok(result.media.length === 0 && Object.keys(result.mediaIndexBySource).length === 0,
    'a text-only course creates no media storage records');
}

{
  const source = `${minimal}
`;
  const result = await readCourseFile(source, { fileName: 'tiny.txt' });
  ok(result.course === null && codes(result).has('document.unsupported_file_type'),
    'an ambiguous extension is refused instead of guessed');
}

{
  const withMedia = `schemaVersion: 2
courseId: picture-club
cards:
  - cardId: bird
    media:
      - side: front
        mediaType: image
        source: media/bird.png
        alternativeText: A small bird
`;
  const result = await readCourseFile(withMedia, { fileName: 'picture.keep.yml' });
  ok(result.course === null && codes(result).has('media.missing'),
    'plain .keep.yml is honestly text-only when it declares a local asset');
}

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00,
]);
const mediaYaml = `schemaVersion: 2
courseId: picture-club
title: Picture club
cards:
  - cardId: bird
    media:
      - side: front
        mediaType: image
        source: media/bird.png
        alternativeText: A small bird
`;

{
  const archive = storedZip([
    { name: 'course.keep.yml', bytes: mediaYaml },
    { name: 'media/bird.png', bytes: png },
  ]);
  const result = await readCourseFile(archive, { fileName: 'picture.keep' });
  ok(!!result.course && result.sourceKind === 'keep-package',
    'a canonical .keep ZIP with its declared asset is accepted');
  ok(result.media.length === 1 && result.media[0].storageIndex === 0
      && result.media[0].source === 'media/bird.png'
      && result.media[0].mimeType === 'image/png',
  'media bytes are sniffed and prepared under a descriptive storage record');
  ok(result.mediaIndexBySource['media/bird.png'] === 0,
    'the package produces a source-to-storage index without compact card keys');
}

{
  const caseVariant = `${mediaYaml.replace('media/bird.png', 'Media/Bird.png')}
  - cardId: bird-again
    media:
      - side: front
        mediaType: image
        source: media/bird.png
        alternativeText: The same small bird
`;
  const archive = storedZip([
    { name: 'course.keep.yml', bytes: caseVariant },
    { name: 'media/bird.png', bytes: png },
  ]);
  const result = await readCourseFile(archive, { fileName: 'case-variant.keep' });
  ok(!!result.course && result.media.length === 1
      && result.mediaIndexBySource['Media/Bird.png'] === 0
      && result.mediaIndexBySource['media/bird.png'] === 0
      && !codes(result).has('media.unreferenced_asset'),
  'ASCII-case-equivalent shared references resolve to one stored asset without a false warning');
}

{
  const archive = storedZip([
    { name: 'course.keep.yml', bytes: mediaYaml },
    { name: 'media/bird.jpg', bytes: png },
  ]);
  const result = await readCourseFile(archive, { fileName: 'picture.keep' });
  ok(result.course === null
      && codes(result).has('media.missing'),
  'asset lookup uses the declared exact path');
}

{
  const wrongExtension = mediaYaml.replace('bird.png', 'bird.jpg');
  const archive = storedZip([
    { name: 'course.keep.yml', bytes: wrongExtension },
    { name: 'media/bird.jpg', bytes: png },
  ]);
  const result = await readCourseFile(archive, { fileName: 'picture.keep' });
  ok(result.course === null && codes(result).has('media.type_mismatch'),
    'file bytes, extension, and declared media type must agree');
}

{
  const wrongMime = mediaYaml.replace(
    'source: media/bird.png',
    'source: media/bird.png\n        mimeType: image/jpeg',
  );
  const archive = storedZip([
    { name: 'course.keep.yml', bytes: wrongMime },
    { name: 'media/bird.png', bytes: png },
  ]);
  const result = await readCourseFile(archive, { fileName: 'picture.keep' });
  ok(result.course === null && codes(result).has('media.type_mismatch'),
    'optional declared MIME must agree with sniffed bytes');
}

{
  const archive = storedZip([
    { name: 'course.keep.yml', bytes: minimal },
    { name: 'unused.png', bytes: png },
  ]);
  const result = await readCourseFile(archive, { fileName: 'extra.keep' });
  ok(!!result.course && codes(result).has('media.unreferenced_asset'),
    'an unreferenced package asset warns but is never silently stored');
}

{
  const noRoot = storedZip([{ name: 'nested/course.keep.yml', bytes: minimal }]);
  const result = await readCourseFile(noRoot, { fileName: 'nested.keep' });
  ok(result.course === null && codes(result).has('package.root_manifest_missing'),
    'the manifest must be exactly at the archive root');
}

{
  const traversal = storedZip([
    { name: 'course.keep.yml', bytes: minimal },
    { name: '../outside.png', bytes: png },
  ]);
  const result = await readCourseFile(traversal, { fileName: 'unsafe.keep' });
  ok(result.course === null && codes(result).has('package.unsafe_path'),
    'archive traversal is rejected before any member is extracted');
}

{
  const collision = storedZip([
    { name: 'course.keep.yml', bytes: minimal },
    { name: 'Media/Bird.png', bytes: png },
    { name: 'media/bird.png', bytes: png },
  ]);
  const result = await readCourseFile(collision, { fileName: 'collision.keep' });
  ok(result.course === null && codes(result).has('package.duplicate_path'),
    'case-folding path collisions are refused across filesystems');
}

{
  const distinctUnicode = storedZip([
    { name: 'course.keep.yml', bytes: minimal },
    { name: 'media/Ä.png', bytes: png },
    { name: 'media/ä.png', bytes: png },
  ]);
  const result = await readCourseFile(distinctUnicode, { fileName: 'unicode.keep' });
  ok(!!result.course && !codes(result).has('package.duplicate_path'),
    'path comparison folds ASCII only and does not invent non-ASCII collisions');
}

{
  const duplicate = storedZip([
    { name: 'course.keep.yml', bytes: minimal },
    { name: 'course.keep.yml', bytes: minimal },
  ]);
  const result = await readCourseFile(duplicate, { fileName: 'duplicate.keep' });
  ok(result.course === null && codes(result).has('package.duplicate_path'),
    'duplicate ZIP directory names are refused rather than last-one-wins');
}

{
  const encrypted = storedZip([{ name: 'course.keep.yml', bytes: minimal }]);
  const view = new DataView(encrypted.buffer, encrypted.byteOffset, encrypted.byteLength);
  let central = -1;
  for (let index = 0; index + 46 <= encrypted.length; index++) {
    if (view.getUint32(index, true) === 0x02014b50) { central = index; break; }
  }
  view.setUint16(central + 8, view.getUint16(central + 8, true) | 0x1, true);
  const result = await readCourseFile(encrypted, { fileName: 'encrypted.keep' });
  ok(result.course === null && codes(result).has('package.unsupported_feature'),
    'encrypted ZIP members are refused before manifest parsing');
}

{
  const locallyEncrypted = storedZip([{ name: 'course.keep.yml', bytes: minimal }]);
  const view = new DataView(
    locallyEncrypted.buffer, locallyEncrypted.byteOffset, locallyEncrypted.byteLength,
  );
  view.setUint16(6, view.getUint16(6, true) | 0x1, true);
  const result = await readCourseFile(locallyEncrypted, { fileName: 'local-encrypted.keep' });
  ok(result.course === null && codes(result).has('package.unsupported_feature'),
    'encryption declared only in a local ZIP header is still refused before reading');
}

{
  const splitMethod = storedZip([{ name: 'course.keep.yml', bytes: minimal }]);
  const view = new DataView(splitMethod.buffer, splitMethod.byteOffset, splitMethod.byteLength);
  view.setUint16(8, 8, true);
  const result = await readCourseFile(splitMethod, { fileName: 'split-method.keep' });
  ok(result.course === null && codes(result).has('package.unsupported_feature'),
    'contradictory local and directory compression methods are refused');
}

{
  const oversizedManifest = storedZip([{ name: 'course.keep.yml', bytes: minimal }]);
  const view = new DataView(
    oversizedManifest.buffer, oversizedManifest.byteOffset, oversizedManifest.byteLength,
  );
  const central = centralOffset(oversizedManifest, 'course.keep.yml');
  const claimed = COURSE_PACKAGE_LIMITS.manifestBytes + 1;
  view.setUint32(central + 20, claimed, true);
  view.setUint32(central + 24, claimed, true);
  const result = await readCourseFile(oversizedManifest, { fileName: 'large-manifest.keep' });
  ok(result.course === null && codes(result).has('limit.input_bytes')
      && !codes(result).has('package.root_manifest_missing'),
  'an oversized manifest is refused from metadata before its member is read');
}

{
  const oversizedAsset = storedZip([
    { name: 'course.keep.yml', bytes: mediaYaml },
    { name: 'media/bird.png', bytes: png },
  ]);
  const view = new DataView(
    oversizedAsset.buffer, oversizedAsset.byteOffset, oversizedAsset.byteLength,
  );
  const central = centralOffset(oversizedAsset, 'media/bird.png');
  const claimed = COURSE_PACKAGE_LIMITS.imageBytes + 1;
  view.setUint32(central + 20, claimed, true);
  view.setUint32(central + 24, claimed, true);
  const result = await readCourseFile(oversizedAsset, { fileName: 'large-image.keep' });
  ok(result.course === null && codes(result).has('media.too_large')
      && !codes(result).has('media.missing'),
  'an oversized asset is refused from metadata before decompression or allocation');
}

{
  const hostileMarkdown = `schemaVersion: 2
courseId: hostile
cards:
  - cardId: first
    front: "# unsupported heading"
`;
  const result = await readCourseFile(hostileMarkdown, { fileName: 'hostile.keep.yml' });
  ok(result.course === null && codes(result).has('markdown.unsupported_construct'),
    'unsupported authored Markdown blocks the atomic import');
}

{
  class ClaimedLargeBlob extends Blob {
    constructor(claimedSize) {
      super(['small']);
      this.claimedSize = claimedSize;
      this.materialized = false;
    }
    get size() { return this.claimedSize; }
    async arrayBuffer() {
      this.materialized = true;
      return super.arrayBuffer();
    }
  }
  const hugeArchive = new ClaimedLargeBlob(COURSE_PACKAGE_LIMITS.compressedBytes + 1);
  const archiveResult = await readCourseFile(hugeArchive, { fileName: 'huge.keep' });
  const hugeYaml = new ClaimedLargeBlob(COURSE_PACKAGE_LIMITS.manifestBytes + 1);
  const yamlResult = await readCourseFile(hugeYaml, { fileName: 'huge.keep.yml' });
  ok(codes(archiveResult).has('package.too_large') && !hugeArchive.materialized
      && codes(yamlResult).has('limit.input_bytes') && !hugeYaml.materialized,
  'oversized Blob inputs are rejected from size without materializing their contents');
}

{
  const repeated = Array.from({ length: 105 }, (_, index) =>
    `  - cardId: repeated\n    front: Card ${index}`).join('\n');
  const result = await readCourseFile(
    `schemaVersion: 2\ncourseId: diagnostic-cap\ncards:\n${repeated}\n`,
    { fileName: 'diagnostic-cap.keep.yml' },
  );
  ok(result.course === null && result.diagnostics.length === 101
      && result.diagnostics.at(-1)?.code === 'document.too_many_errors',
  'composed package diagnostics keep the explicit 100-error truncation marker');
}

{
  const aac = Buffer.from([0xff, 0xf1, 0x50, 0x80, 0x00, 0x1f, 0xfc]);
  const source = `schemaVersion: 2
courseId: audio-club
cards:
  - cardId: tone
    media:
      - side: front
        mediaType: audio
        source: media/tone.aac
        mimeType: audio/aac
`;
  const result = await readCourseFile(storedZip([
    { name: 'course.keep.yml', bytes: source },
    { name: 'media/tone.aac', bytes: aac },
  ]), { fileName: 'audio.keep' });
  ok(!!result.course && result.media[0]?.mimeType === 'audio/aac',
    'documented raw AAC is distinguished from an MP3 frame by its ADTS header');
}

{
  const warnings = Array.from({ length: 21 }, (_, index) => ({
    message: `warning number ${index + 1}`,
    correction: `correction ${index + 1}`,
  }));
  const html = receiptHtml({
    type: 'keep',
    title: 'Warnings',
    courseId: 'warnings',
    sourceKind: 'keep-package',
    read: { cards: 1 },
    made: { cards: 1, sections: 1, groups: 0 },
    frontOnly: 1,
    media: { images: 0, audio: 0, video: 0, bytes: 0 },
    warnings,
  });
  ok(html.includes('warning number 1') && html.includes('warning number 21'),
    'the bounded preview lists every warning instead of silently hiding warnings after 20');
}

{
  assert.equal(normalizeCourseAssetPath('media/bird.png'), 'media/bird.png');
  for (const path of [
    '/root.png', '../up.png', 'a/../b.png', 'a\\\\b.png', 'a//b.png',
    'https:remote.png', 'data:image.png', 'mailto:asset.png',
  ]) {
    ok(normalizeCourseAssetPath(path) === null, `unsafe path is inert: ${path}`);
  }
  ok(sniffCourseAsset(png)?.mimeType === 'image/png',
    'media type is established from bytes, not a filename');
}

console.log([...passed, ...failed].join('\n'));
console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
