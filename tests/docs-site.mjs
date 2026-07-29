import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readCourse } from '../web/lib/course.js';
import { parseCourseYaml } from '../web/lib/course-yaml.js';
import { normalizeLegacyCourse } from '../web/lib/legacy-course.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const DOCS = path.join(WEB, 'docs');
const GUIDE = path.join(DOCS, 'index.html');
const ERRORS = path.join(DOCS, 'reference', 'errors', 'index.html');
const SCHEMA = path.join(DOCS, 'schema', 'course-v2.schema.json');
const passed = [], failed = [];
const ok = (condition, message) =>
  (condition ? passed : failed).push(`${condition ? 'PASS' : 'FAIL'}  ${message}`);
const read = (file) => fs.readFileSync(file, 'utf8');

const generated = spawnSync(process.execPath, [
  path.join(ROOT, 'scripts', 'build-docs.mjs'), '--check',
], { cwd: ROOT, encoding: 'utf8' });
ok(generated.status === 0,
  `generated docs references match source (${generated.stderr.trim() || 'current'})`);
ok(fs.readFileSync(SCHEMA).equals(
  fs.readFileSync(path.join(ROOT, 'schema', 'course-v2.schema.json'))),
'the downloadable schema is byte-identical to the frozen source schema');

const guide = read(GUIDE);
const errors = read(ERRORS);
for (const [name, html, canonical] of [
  ['creator guide', guide, 'https://keepclub.app/docs/'],
  ['error reference', errors, 'https://keepclub.app/docs/reference/errors/'],
]) {
  ok(/<!doctype html>/i.test(html) && /<html lang="en">/.test(html)
      && /<meta name="viewport"/.test(html),
  `${name} has a complete responsive document`);
  ok(html.includes(`<link rel="canonical" href="${canonical}">`),
    `${name} declares its canonical same-site URL`);
  ok(/<a class="skip" href="#content">/.test(html)
      && /<nav\b/.test(html) && /<main id="content">/.test(html),
  `${name} has keyboard skip, navigation, and main landmarks`);
}

const requiredGuideSections = [
  'quick-start', 'optional-by-default', 'cards', 'markdown', 'organization',
  'media', 'validation', 'fields', 'identity', 'tooling', 'evolution',
];
for (const id of requiredGuideSections) {
  ok(guide.includes(`id="${id}"`), `creator journey includes #${id}`);
}
for (const phrase of [
  'schemaVersion: 2',
  'two front-only cards',
  'everything else can be omitted',
  'One record is one scheduled review card',
  'directly to self-grading',
  'Bring your own tools',
  'Errors block the whole import',
  'Stable IDs protect progress',
  'Scheduling, streaks, due dates, and learner history never belong',
  'Section and group',
  'Attribution and provenance',
  'Namespaced extensions',
  'loadingAnimation',
]) {
  ok(guide.includes(phrase), `creator guide covers “${phrase}”`);
}

const examples = [...guide.matchAll(
  /<pre data-course-example><code>([\s\S]*?)<\/code><\/pre>/g,
)].map((match) => match[1]
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&'));
ok(examples.length === 3, 'creator guide exposes three complete course examples');
for (let index = 0; index < examples.length; index++) {
  const parsed = await parseCourseYaml(examples[index]);
  const course = parsed.value && readCourse(parsed.value);
  ok(parsed.diagnostics.length === 0 && !!course?.course,
    `creator example ${index + 1} parses and passes the shipped reader`);
}

const diagnostics = read(path.join(ROOT, 'schema', 'diagnostics.md'));
const diagnosticCodes = [...diagnostics.matchAll(/^\| `([^`]+)` \|/gm)]
  .map((match) => match[1]);
for (const code of diagnosticCodes) {
  const id = code.replace(/[._]/g, '-');
  ok(errors.includes(`id="${id}"`), `error reference owns #${id}`);
}
ok(errors.includes('id="legacy-compatibility"')
    && errors.includes('This is not a public authoring format.')
    && errors.includes('format-2 <code>.keep.yml</code>'),
  'the error reference separates legacy troubleshooting from the public authoring contract');

const legacyFailure = normalizeLegacyCourse({
  format: 1,
  sections: [],
  cards: [],
});
const legacyDiagnostic = legacyFailure.diagnostics.find((item) => item.severity === 'error');
const legacyDocsUrl = new URL(legacyDiagnostic.docsUrl);
ok(legacyDocsUrl.hostname === 'docs.keepclub.app'
    && legacyDocsUrl.pathname === '/reference/errors/'
    && legacyDocsUrl.hash === '#legacy-compatibility'
    && errors.includes(`id="${legacyDocsUrl.hash.slice(1)}"`),
  'a generated legacy diagnostic resolves to the deployed compatibility anchor');

function idsOf(html) {
  return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
}

function resolveDocument(file, value) {
  const [withoutFragment, fragment = ''] = value.split('#', 2);
  const pathname = withoutFragment.split('?', 1)[0];
  let target = value.startsWith('/')
    ? path.join(WEB, decodeURIComponent(pathname))
    : path.resolve(path.dirname(file), decodeURIComponent(pathname));
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, 'index.html');
  }
  return { target, fragment };
}

for (const file of [GUIDE, ERRORS]) {
  const html = read(file);
  const attributes = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1]);
  for (const value of attributes) {
    if (/^(?:https?:|mailto:)/.test(value)) continue;
    if (value.startsWith('#')) {
      ok(idsOf(html).has(value.slice(1)),
        `${path.relative(ROOT, file)} resolves ${value}`);
      continue;
    }
    const { target, fragment } = resolveDocument(file, value);
    ok(fs.existsSync(target),
      `${path.relative(ROOT, file)} resolves ${value}`);
    if (fragment && fs.existsSync(target) && target.endsWith('.html')) {
      ok(idsOf(read(target)).has(fragment),
        `${path.relative(ROOT, target)} owns #${fragment}`);
    }
  }
}

const publicSchema = JSON.parse(read(SCHEMA));
const schemaUrl = new URL(publicSchema.$id);
ok(schemaUrl.hostname === 'docs.keepclub.app'
    && fs.existsSync(path.join(DOCS, schemaUrl.pathname)),
'the immutable docs-host schema URL maps to a deployed same-tree artifact');

const serviceWorker = read(path.join(WEB, 'sw.js'));
const docsBypass = serviceWorker.indexOf("url.pathname === SCOPE + 'docs'");
const navigation = serviceWorker.indexOf("if (req.mode === 'navigate')");
ok(docsBypass >= 0 && docsBypass < navigation,
  'the app service worker leaves docs routing alone before navigation fallback');
const deploy = read(path.join(ROOT, 'scripts', 'deploy-to-keepclub.sh'));
ok(deploy.includes('scripts/build-docs.mjs" --check')
    && deploy.indexOf('scripts/build-docs.mjs" --check') < deploy.indexOf('rsync -a'),
'deployment refuses stale docs references before copying any site files');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let file = path.resolve(WEB, `.${decodeURIComponent(url.pathname)}`);
  if (!file.startsWith(`${WEB}/`) && file !== WEB) return res.writeHead(403).end();
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    const contents = fs.readFileSync(file);
    res.writeHead(200, {
      'content-type': contentTypes[path.extname(file)] || 'application/octet-stream',
    });
    res.end(contents);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [route, expectedType] of [
    ['/docs/', 'text/html'],
    ['/docs/reference/errors/', 'text/html'],
    ['/docs/docs.css', 'text/css'],
    ['/docs/tower.svg', 'image/svg+xml'],
    ['/docs/schema/course-v2.schema.json', 'application/json'],
  ]) {
    const response = await fetch(origin + route);
    ok(response.ok && response.headers.get('content-type')?.startsWith(expectedType),
      `${route} serves locally as ${expectedType}`);
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log([...passed, ...failed].join('\n'));
console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
