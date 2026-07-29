import assert from 'node:assert/strict';
import {
  normalizeCourseAssetPath,
  readCourseFile,
  sniffCourseAsset,
} from '../web/lib/course-package.js';

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
      && result.course.cards[0].front.includes('<strong>one</strong>'),
  'its CommonMark is rendered and sanitized before runtime storage');
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
  assert.equal(normalizeCourseAssetPath('media/bird.png'), 'media/bird.png');
  for (const path of ['/root.png', '../up.png', 'a/../b.png', 'a\\\\b.png', 'a//b.png']) {
    ok(normalizeCourseAssetPath(path) === null, `unsafe path is inert: ${path}`);
  }
  ok(sniffCourseAsset(png)?.mimeType === 'image/png',
    'media type is established from bytes, not a filename');
}

console.log([...passed, ...failed].join('\n'));
console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
