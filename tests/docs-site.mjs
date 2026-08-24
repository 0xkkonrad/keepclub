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
const LEARNER = path.join(DOCS, 'studying', 'index.html');
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
const learner = read(LEARNER);
const learnerText = learner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const errors = read(ERRORS);
const docsCss = read(path.join(DOCS, 'docs.css'));
ok(docsCss.includes('.mobile-nav:not([open]) nav')
    && /\.mobile-nav:not\(\[open\]\) nav\s*\{\s*display: none;/s.test(docsCss),
  'closed mobile documentation menus do not overlap the page they disclose');
ok(docsCss.includes('.top-links a:not(:last-child)')
    && learner.includes('<a href="../">Create a course</a>'),
  'phone headers stay one line while the mobile guide retains cross-doc navigation');
ok(/@media \(max-width: 760px\)[\s\S]*?html\s*\{[\s\S]*?scroll-padding-top:\s*7\.5rem;/s.test(docsCss),
  'narrow deep links clear the wrapped sticky documentation header');
for (const [name, html, canonical] of [
  ['creator guide', guide, 'https://keepclub.app/docs/'],
  ['learner guide', learner, 'https://keepclub.app/docs/studying/'],
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
  ok(html.includes('<summary>Guides and this page</summary>'),
    `${name} names its mobile sibling-guide navigation honestly`);
}

const requiredGuideSections = [
  'quick-start', 'optional-by-default', 'cards', 'markdown', 'organization',
  'media', 'validation', 'fields', 'identity', 'tooling', 'evolution',
];
for (const id of requiredGuideSections) {
  ok(guide.includes(`id="${id}"`), `creator journey includes #${id}`);
  ok(guide.includes(`href="#${id}"`), `creator mobile navigation reaches #${id}`);
}
for (const phrase of [
  'schemaVersion: 2',
  'two front-only cards',
  'everything else can be omitted',
  'One record is one scheduled review card',
  'directly to self-grading',
  'Use any editor or generator',
  'Errors block the whole import',
  'Keep IDs stable',
  'Scheduling, streaks, due dates, and learner history never belong',
  'Section and group',
  'Attribution and provenance',
  'Namespaced extensions',
  'loadingAnimation',
]) {
  ok(guide.includes(phrase), `creator guide covers “${phrase}”`);
}

const requiredLearnerSections = [
  'daily-study', 'grades', 'learning', 'daily-plan', 'exam', 'progress',
  'practice', 'slipping', 'details',
];
for (const id of requiredLearnerSections) {
  ok(learner.includes(`id="${id}"`), `learner journey includes #${id}`);
  ok(learner.includes(`href="#${id}"`), `learner mobile navigation reaches #${id}`);
}
for (const phrase of [
  'Hard is still a correct answer',
  'retains roughly 40% of its ordinary spacing',
  'behind about four other cards',
  'third Hard moves it into ordinary reviews',
  'a second moves it back to roughly the ordinary spacing',
  'Another Again during relearning resets that step',
  'Good and Easy can graduate to the same retained gap',
  'first 60% of the remaining time',
  'about one fifth of the whole days left',
  'existing schedules from the date each current interval was originally earned',
  'can make an older card due immediately',
  'daily repeat limit still decides',
  'Due repeats can still be waiting outside a spent repeat limit',
  'ordinary spacing has reached at least 21 days',
  'receives no half-credit',
  'old 50% can become 0%',
  'manufactured exactly 50%',
  'does not delete your answers',
  'up to 20 of the soonest future reviews',
  'Practice even while due cards remain',
  'Practice does not change due dates',
  'cumulative history flag',
  'spread by about 5%',
  'random roll can still land on the original day',
  'month and year labels are rounded summaries',
  'simplified SM-2-inspired scheduler',
  '400 days',
  'browser profile on this device',
  'One Sync key is permission',
  'cannot move imported-deck review history',
]) {
  ok(learnerText.includes(phrase), `learner guide explains “${phrase}”`);
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
for (const title of [...diagnostics.matchAll(/^## (.+)$/gm)].map((match) => match[1])) {
  const id = title.toLowerCase().replace(/[._\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
  ok(errors.includes(`href="#${id}"`), `error mobile navigation reaches #${id}`);
}
ok(errors.includes('id="legacy-compatibility"')
    && errors.includes('This is not a public authoring format.')
    && errors.includes('format-2 <code>.keep.yml</code>'),
  'the error reference separates legacy troubleshooting from the public authoring contract');
ok(errors.includes('.diagnostics dt code { overflow-wrap: anywhere; }'),
  'long diagnostic codes wrap instead of widening a phone-sized document');

const legacyFailure = normalizeLegacyCourse({
  format: 1,
  sections: [],
  cards: [],
});
const legacyDiagnostic = legacyFailure.diagnostics.find((item) => item.severity === 'error');
const legacyDocsUrl = new URL(legacyDiagnostic.docsUrl);
ok(legacyDocsUrl.hostname === 'keepclub.app'
    && legacyDocsUrl.pathname === '/docs/reference/errors/'
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

for (const file of [GUIDE, LEARNER, ERRORS]) {
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
const docsHandling = serviceWorker.indexOf("const docsRoot = SCOPE + 'docs'");
const navigation = serviceWorker.indexOf("if (req.mode === 'navigate')");
ok(docsHandling >= 0 && docsHandling < navigation
    && serviceWorker.includes("'docs/'")
    && serviceWorker.includes("'docs/studying/'")
    && serviceWorker.includes("'docs/reference/errors/'")
    && serviceWorker.includes('hit || Response.error()'),
  'the service worker gives cached docs their own offline path before app navigation fallback');
const appHtml = read(path.join(WEB, 'index.html'));
const shelf = read(path.join(WEB, 'munin.js'));
const appCode = read(path.join(WEB, 'app.js'));
const achievements = read(path.join(WEB, 'achievements.js'));
const importCode = read(path.join(WEB, 'import.js'));
const importReceipt = read(path.join(WEB, 'lib', 'receipt.js'));
ok(/id="studying-guide"[^>]+href="docs\/studying\/"/.test(appHtml)
    && /id="about-study-guide"[^>]+href="docs\/studying\/"/.test(appHtml)
    && /id="progress-guide"[^>]+href="docs\/studying\/#progress"/.test(appHtml)
    && /href="docs\/studying\/"[^>]*>Read the full/.test(shelf),
  'Progress, Settings, About, and first-run help all lead to the learner guide');
ok(!/Cards you find hard come back within minutes/.test(shelf)
    && !/Every card comes back at least once before you sit it/.test(appCode)
    && !/Anything over this waits until tomorrow/.test(appHtml)
    && !/cards that keep slipping|No cards are slipping yet/.test(appCode)
    && !/kept slipping is solid again/.test(achievements),
  'known misleading scheduler promises are absent from shipped copy');
const settingsText = appHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
ok(settingsText.includes('same key covers every built-in course')
    && settingsText.includes('cannot move review history to another browser or phone')
    && shelf.includes('cannot move that history to another browser or phone')
    && appCode.includes('browser profile only'),
  'in-app help states the Sync capability and browser-profile backup boundary');
ok(!/shares your deck|no file holds the deck|Nothing is due\. Practice/.test(
  `${appHtml}\n${appCode}`)
    && !/imported reviews|kept a memory over lunch/.test(achievements)
    && achievements.includes('local-deck answers')
    && achievements.includes('studied over lunch'),
  'shipped progress and achievement copy does not overclaim its underlying metric');
ok(importCode.includes('stays in this browser profile')
    && importCode.includes('Settings → Deck file')
    && importCode.includes('Backup separately protects')
    && importReceipt.includes('studying starts in this browser profile')
    && !/stays on this device|no backup file holds|only place it exists|studying stays on this device/.test(
      `${importCode}\n${importReceipt}`),
  'import and creation help distinguishes browser storage, Deck file, and local backup');
const rootReadme = read(path.join(ROOT, 'README.md'));
ok(rootReadme.includes('Settings → Keeping your progress')
    && rootReadme.includes('docs/scheduler.md')
    && guide.includes('Settings →\n          Keeping your progress → Deck file'),
  'repository and creator docs point to the current controls and scheduler contract');
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
    ['/docs/studying/', 'text/html'],
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
