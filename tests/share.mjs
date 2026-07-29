/* Privacy, rendering, and browser-fallback contract for achievement sharing. */
import { File } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [source, doodleSource, daySkipperSource] = await Promise.all([
  readFile(new URL('../web/share.js', import.meta.url), 'utf8'),
  readFile(new URL('../web/doodles-munin.js', import.meta.url), 'utf8'),
  readFile(new URL('../web/courses/day-skipper/course.json', import.meta.url), 'utf8'),
]);
const sandbox = {
  Blob,
  File,
  URL,
  console,
  setTimeout,
  clearTimeout,
};
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename: 'web/share.js' });
const Share = sandbox.KeepShare;
const doodleSandbox = { globalThis: null };
doodleSandbox.globalThis = doodleSandbox;
vm.runInNewContext(doodleSource, doodleSandbox, { filename: 'web/doodles-munin.js' });
const productionTower = doodleSandbox.MUNIN_DOODLE.tower;
const daySkipper = JSON.parse(daySkipperSource);
const out = [], fails = [];
const ok = (condition, message) =>
  (condition ? out : fails).push((condition ? 'PASS  ' : 'FAIL  ') + message);

ok(Share && ['normalizeModel', 'shareUrl', 'renderSvg', 'safeFilename',
  'createAsset', 'share'].every((name) => typeof Share[name] === 'function'),
'the classic script publishes one small KeepShare API');

const hostile = {
  title: '<script>alert("x")</script> & kept',
  body: 'a < b & "quoted"',
  stat: '30\u202edays',
  label: 'club\nstreak',
  accent: 'url(javascript:alert(1))',
  towerPath: 'M0 0"><script>alert(1)</script>',
  url: 'https://example.com/?sync=secret',
  syncKey: 'must-never-leave',
  progress: { answers: ['private'] },
};
const clean = Share.normalizeModel(hostile);
const hostileSvg = Share.renderSvg(hostile);
ok(clean.brand === 'keep club' && clean.accent === '#e26443'
    && clean.tower === null && !('syncKey' in clean) && !('progress' in clean)
    && !('url' in clean),
'normalization allow-lists display fields and rejects unsafe colours and paths');
ok(!hostileSvg.includes('<script>') && !hostileSvg.includes('javascript:')
    && hostileSvg.includes('&lt;script&gt;') && hostileSvg.includes('&amp; kept')
    && hostileSvg.includes('&quot;quoted&quot;'),
'all caller text is XML-escaped in the deterministic SVG');
ok(!hostileSvg.includes('\u202e') && hostileSvg === Share.renderSvg(hostile),
'directional controls are stripped and identical models render identically');
ok(hostileSvg.includes('font-family="&quot;DM Mono&quot;, ui-monospace, '
    + '&quot;SFMono-Regular&quot;, Menlo, Consolas, monospace"'),
'cards explicitly use Keep Club’s mono typography instead of renderer-dependent serif defaults');

const tower = 'M6.7 11.8C7.5 11.7 9.6 11.4 11.3 11.5Z';
const builtIn = {
  title: '30 days in the club',
  stat: '184',
  statLabel: 'memories kept',
  towerPath: tower,
  course: {
    kind: 'built-in',
    id: 'day-skipper',
    title: 'Day Skipper',
    accent: '#12aBcD',
    artPath: 'M0 0L10 10Z',
  },
};
const card = Share.normalizeModel(builtIn);
const illustratedSvg = Share.renderSvg(builtIn);
ok(card.course.id === 'day-skipper' && card.course.accent === '#12abcd'
    && card.course.art.d === 'M0 0L10 10Z' && card.tower.d === tower,
'validated tower and built-in course art remain available to the renderer');
ok(illustratedSvg.includes('Day Skipper')
    && illustratedSvg.includes('184')
    && illustratedSvg.includes(tower)
    && illustratedSvg.includes('keepclub.app/?course=day-skipper'),
'the card carries its approved course label, stat, tower mark, and durable course path');
ok(illustratedSvg.includes(
  'viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" fill="none" '
  + 'stroke="#17332c" stroke-width="2" stroke-linecap="round" '
  + 'stroke-linejoin="round" overflow="visible"')
    && illustratedSvg.includes(
      'viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" fill="none" '
      + 'stroke="#146b7a" stroke-width="2" stroke-linecap="round" '
      + 'stroke-linejoin="round" overflow="visible"'),
'tower and course doodles use Keep Club’s rounded, unfilled pen-line contract');
ok(!illustratedSvg.includes(`<path d="${tower}" fill=`)
    && !illustratedSvg.includes('<path d="M0 0L10 10Z" fill='),
'real doodle paths never collapse into filled silhouettes');

const productionArt = Share.normalizeModel({
  title: 'A real drawing',
  towerPath: productionTower,
  course: {
    kind: 'built-in',
    id: daySkipper.id,
    title: daySkipper.short,
    accent: daySkipper.accent.light,
    artPath: daySkipper.shelfPath,
  },
});
const productionSvg = Share.renderSvg(productionArt);
ok(productionTower.length > 1000 && daySkipper.shelfPath.length > 1000
    && productionArt.tower.d === productionTower
    && productionArt.course.art.d === daySkipper.shelfPath,
'the production tower and Day Skipper emblem pass the restricted path grammar intact');
ok(productionSvg.includes(`<path d="${productionTower}" opacity="1"/>`)
    && productionSvg.includes(`<path d="${daySkipper.shelfPath}" opacity="0.18"/>`)
    && !productionSvg.includes(`<path d="${productionTower}" fill=`)
    && !productionSvg.includes(`<path d="${daySkipper.shelfPath}" fill=`),
'the actual shipped doodles render as strokes rather than closed-path silhouettes');

const dirtyBase = 'https://keepclub.app/?sync=SECRET&progress=PRIVATE#card-text';
const courseUrl = new URL(Share.shareUrl(builtIn, dirtyBase));
ok(courseUrl.origin === 'https://keepclub.app'
    && courseUrl.pathname === '/'
    && courseUrl.search === '?course=day-skipper'
    && !courseUrl.href.includes('SECRET') && !courseUrl.hash,
'a built-in deep link contains only its validated course id');

const imported = {
  title: 'A deck milestone',
  course: {
    kind: 'imported',
    id: 'private-deck',
    title: 'Secret medical deck',
    artPath: 'M0 0L1 1',
  },
};
const importedModel = Share.normalizeModel(imported);
const importedUrl = Share.shareUrl(imported, dirtyBase);
const importedSvg = Share.renderSvg(imported);
ok(importedModel.course === null
    && importedUrl === 'https://keepclub.app/'
    && !importedSvg.includes('Secret medical deck'),
'imported deck metadata is dropped and imported achievements link only to root');

for (const id of ['../sync', 'Day-Skipper', 'day_skipper', 'day--skipper',
  'day-skipper?sync=bad', 'x'.repeat(65)]) {
  const candidate = {
    title: 'test',
    course: { kind: 'built-in', id, title: 'Should not render' },
  };
  ok(Share.shareUrl(candidate, dirtyBase) === 'https://keepclub.app/'
      && !Share.renderSvg(candidate).includes('Should not render'),
  `invalid course id "${id.slice(0, 18)}" cannot enter a link or card`);
}
ok(Share.shareUrl(builtIn, 'javascript:alert(1)')
    === 'https://keepclub.app/?course=day-skipper',
'non-HTTP base URLs fall back to the canonical safe origin');
ok(Share.shareUrl(builtIn, 'https://user:password@keepclub.app/?course=x')
    === 'https://keepclub.app/?course=day-skipper',
'URL credentials are stripped even when a caller supplies an authenticated base');

ok(Share.safeFilename({ title: '  Héllo / <World>?!  ' }, 'png')
    === 'keep-club-hello-world.png'
    && Share.safeFilename({ title: '../../' }, 'svg')
      === 'keep-club-achievement.svg',
'filenames are stable, portable, extension-controlled, and path-safe');

const svgAsset = await Share.createAsset(builtIn, { document: null, File });
ok(svgAsset.format === 'svg'
    && svgAsset.blob.type.startsWith('image/svg+xml')
    && svgAsset.file instanceof File
    && svgAsset.filename === 'keep-club-30-days-in-the-club.svg',
'SVG remains a real local File when canvas rasterization is unavailable');

const pngBlob = new Blob(['png'], { type: 'image/png' });
const pngFile = new File([pngBlob], 'keep-club-streak.png',
  { type: 'image/png', lastModified: 0 });
const pngAsset = {
  blob: pngBlob,
  file: pngFile,
  filename: pngFile.name,
  format: 'png',
};

const nativeCalls = [];
const native = {
  canShare: (data) => Array.isArray(data.files) && data.files.length === 1,
  share: async (data) => nativeCalls.push(data),
};
const nativeResult = await Share.share(builtIn, {
  baseUrl: dirtyBase,
  asset: pngAsset,
  navigator: native,
  document: null,
});
ok(nativeResult.status === 'shared' && nativeResult.method === 'native-file'
    && nativeCalls.length === 1 && nativeCalls[0].files[0] === pngFile
    && nativeCalls[0].url === 'https://keepclub.app/?course=day-skipper',
'native file sharing receives the card and the privacy-safe deep link');
ok(!JSON.stringify(nativeCalls[0]).includes('SECRET'),
'native share payloads do not inherit existing URL state');

const limitedNativeCalls = [];
const limitedNative = await Share.share(builtIn, {
  baseUrl: dirtyBase,
  asset: pngAsset,
  navigator: {
    canShare: (data) => !data.url && data.files?.length === 1,
    share: async (data) => limitedNativeCalls.push(data),
  },
  document: null,
});
ok(limitedNative.method === 'native-file'
    && limitedNativeCalls[0].files[0] === pngFile
    && limitedNativeCalls[0].text.endsWith('https://keepclub.app/?course=day-skipper'),
'file-only Web Share implementations keep the image and put the safe link in its text');

let clipboardAfterAbort = false;
const aborted = await Share.share(builtIn, {
  asset: pngAsset,
  navigator: {
    canShare: () => true,
    share: async () => {
      const error = new Error('closed');
      error.name = 'AbortError';
      throw error;
    },
    clipboard: { writeText: async () => { clipboardAfterAbort = true; } },
  },
  document: null,
});
ok(aborted.status === 'cancelled' && !clipboardAfterAbort,
'closing the native share sheet never causes an unsolicited clipboard write');

let copiedText = '';
const clipboardResult = await Share.share(imported, {
  baseUrl: dirtyBase,
  asset: svgAsset,
  navigator: {
    share: async () => { throw new Error('native share unavailable'); },
    clipboard: { writeText: async (value) => { copiedText = value; } },
  },
  document: null,
});
ok(clipboardResult.status === 'copied'
    && clipboardResult.method === 'clipboard-text'
    && copiedText.endsWith('\nhttps://keepclub.app/')
    && !copiedText.includes('Secret medical deck')
    && !copiedText.includes('SECRET'),
'failed native sharing falls back to a root-only imported-deck clipboard payload');

let clipboardItemData = null;
class FakeClipboardItem {
  constructor(data) {
    clipboardItemData = data;
  }
}
const imageClipboard = await Share.share(builtIn, {
  asset: pngAsset,
  navigator: {
    clipboard: { write: async () => {} },
  },
  ClipboardItem: FakeClipboardItem,
  document: null,
});
ok(imageClipboard.status === 'copied'
    && imageClipboard.method === 'clipboard-image'
    && clipboardItemData['image/png'] === pngBlob
    && clipboardItemData['text/plain'] instanceof Blob,
'the fallback clipboard carries both the local PNG and safe accompanying text');

let imageOnlyWrites = 0;
class ImageOnlyClipboardItem {
  constructor(data) {
    if (data['text/plain']) throw new Error('one MIME type only');
    this.data = data;
  }
}
const imageOnlyClipboard = await Share.share(builtIn, {
  asset: pngAsset,
  navigator: {
    clipboard: { write: async () => { imageOnlyWrites += 1; } },
  },
  ClipboardItem: ImageOnlyClipboardItem,
  document: null,
});
ok(imageOnlyClipboard.method === 'clipboard-image' && imageOnlyWrites === 1,
'PNG-only clipboard implementations still receive the card');

let clicked = false;
let downloadedAs = '';
let revoked = '';
const anchor = {
  click: () => { clicked = true; },
  remove: () => {},
  set download(value) { downloadedAs = value; },
  get download() { return downloadedAs; },
};
const fakeDocument = {
  body: { appendChild: () => {} },
  createElement: (tag) => tag === 'a' ? anchor : {
    style: {},
    select: () => {},
    remove: () => {},
  },
  execCommand: () => false,
};
const fakeURL = {
  createObjectURL: () => 'blob:local-card',
  revokeObjectURL: (value) => { revoked = value; },
};
const downloaded = await Share.share(builtIn, {
  asset: pngAsset,
  navigator: {},
  document: fakeDocument,
  urlApi: fakeURL,
});
await new Promise((done) => setTimeout(done, 0));
ok(downloaded.status === 'downloaded' && downloaded.method === 'download'
    && clicked && downloadedAs === 'keep-club-streak.png'
    && revoked === 'blob:local-card',
'when sharing and copying are absent, the card downloads and its Blob URL is revoked');

console.log(out.concat(fails).join('\n'));
if (fails.length) {
  console.error(`\n${fails.length} failing`);
  process.exit(1);
}
console.log(`\nall ${out.length} green`);
