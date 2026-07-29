import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright-core';
import {
  COURSE_YAML_LIMITS,
  parseCourseYaml,
} from '../web/lib/course-yaml.js';

const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const WEB = path.join(ROOT, 'web');
const FIXTURES = path.join(ROOT, 'schema', 'fixtures');
const EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || chromium.executablePath();
const out = [], failures = [];
const ok = (condition, message) => {
  (condition ? out : failures).push(`${condition ? 'PASS' : 'FAIL'}  ${message}`);
};
const codes = (result) => new Set(result.diagnostics.map((item) => item.code));
const has = (result, code) => codes(result).has(code);
const frozenLimits = JSON.parse(fs.readFileSync(
  path.join(FIXTURES, 'invalid', 'limits.json'), 'utf8')).limits;
ok(COURSE_YAML_LIMITS.inputBytes === frozenLimits.inputBytes
    && COURSE_YAML_LIMITS.nestingDepth === frozenLimits.nestingDepth
    && COURSE_YAML_LIMITS.scalarBytes === frozenLimits.scalarBytes
    && COURSE_YAML_LIMITS.collectionItems === frozenLimits.collectionItems
    && COURSE_YAML_LIMITS.totalNodes === frozenLimits.totalNodes,
  'parser limits agree with the frozen public contract fixture');

const minimalSource = fs.readFileSync(
  path.join(FIXTURES, 'valid', 'minimal-front-only.keep.yml'), 'utf8');
const minimal = await parseCourseYaml(minimalSource);
ok(minimal.diagnostics.length === 0
    && minimal.value.courseId === 'daily-prompts'
    && minimal.value.cards.length === 2
    && !Object.hasOwn(minimal.value.cards[0], 'back'),
'minimal front-only YAML becomes plain course data');
const pollution = await parseCourseYaml(
  '__proto__: inert\nconstructor: also-inert\ncards:\n  - cardId: safe\n    front: Safe\n');
ok(Object.hasOwn(pollution.value, '__proto__')
    && pollution.value.__proto__ === 'inert'
    && pollution.value.constructor === 'also-inert'
    && !Object.hasOwn({}, 'inert'),
'special mapping keys remain inert own data and do not pollute prototypes');

const fromBytes = await parseCourseYaml(new TextEncoder().encode(minimalSource));
const fromBlob = await parseCourseYaml(new Blob([minimalSource], { type: 'text/yaml' }));
ok(fromBytes.value?.courseId === 'daily-prompts' && fromBlob.value?.cards.length === 2,
  'typed-array and Blob inputs parse through the same boundary');

const markdown = await parseCourseYaml(`schemaVersion: 2
courseId: markdown
cards:
  - cardId: block
    front: |
      First paragraph.

      - one
      - two
`);
ok(markdown.value?.cards[0].front.includes('- one\n- two\n'),
  'literal Markdown scalars retain their line structure');

for (const name of ['parser-duplicate-key', 'parser-disallowed-features', 'parser-plain-data']) {
  const source = fs.readFileSync(path.join(FIXTURES, 'invalid', `${name}.keep.yml`), 'utf8');
  const expected = JSON.parse(fs.readFileSync(
    path.join(FIXTURES, 'invalid', `${name}.expected.json`), 'utf8')).expectedDiagnostics;
  const result = await parseCourseYaml(source);
  ok(result.value === null && expected.every((code) => has(result, code)),
    `${name} fails with ${expected.join(', ')}`);
  ok(result.diagnostics.every((item) =>
    item.severity === 'error'
      && Number.isInteger(item.line) && item.line >= 1
      && Number.isInteger(item.column) && item.column >= 1
      && typeof item.path === 'string'
      && item.message && item.correction
      && item.docsUrl.endsWith(`#${item.code.replace(/[._]/g, '-')}`)),
  `${name} diagnostics carry stable locations, paths, corrections, and links`);
}

const duplicate = await parseCourseYaml('schemaVersion: 2\ncourseId: first\ncourseId: second\ncards: []\n');
const duplicateDiagnostic = duplicate.diagnostics.find((item) => item.code === 'document.duplicate_key');
ok(duplicateDiagnostic?.line === 3 && duplicateDiagnostic.column === 1,
  `duplicate key points to line 3, column 1 (${duplicateDiagnostic?.line}:${duplicateDiagnostic?.column})`);

const standardTag = await parseCourseYaml('schemaVersion: !!int 2\ncourseId: tagged\ncards: []\n');
ok(standardTag.diagnostics.length === 0 && standardTag.value.schemaVersion === 2,
  'standard YAML 1.2 core tags remain inert and accepted');
const nonCoreTag = await parseCourseYaml('value: !!binary SGVsbG8=\n');
ok(has(nonCoreTag, 'document.disallowed_tag'),
  'non-core standard tags are rejected with custom tags');

const errorFlood = await parseCourseYaml(
  Array.from({ length: 140 }, (_, index) => `key${index}: &a${index} value`).join('\n'));
ok(errorFlood.diagnostics.length === 101
    && errorFlood.diagnostics.at(-1).code === 'document.too_many_errors',
  'parser diagnostics cap at 100 and explicitly report truncation');

const invalidUtf8 = await parseCourseYaml(new Uint8Array([0x73, 0x3a, 0x20, 0xc3, 0x28]));
ok(has(invalidUtf8, 'document.invalid_yaml'), 'invalid UTF-8 fails before parsing values');
const empty = await parseCourseYaml('# comments are not a course document\n');
ok(has(empty, 'document.invalid_yaml') && !has(empty, 'document.multiple_documents'),
  'a comment-only file is missing a document rather than containing multiple documents');

const oversized = await parseCourseYaml('x'.repeat(COURSE_YAML_LIMITS.inputBytes + 1));
ok(has(oversized, 'limit.input_bytes') && oversized.diagnostics[0].line === 1,
  'input over 5 MiB is rejected before YAML parsing');

const longScalar = await parseCourseYaml(`value: ${'x'.repeat(COURSE_YAML_LIMITS.scalarBytes + 1)}\n`);
ok(has(longScalar, 'limit.scalar_length'), 'scalar over 1 MiB is rejected');

let nested = 'value';
for (let i = 0; i < COURSE_YAML_LIMITS.nestingDepth + 1; i++) nested = `[${nested}]`;
const tooDeep = await parseCourseYaml(`x: ${nested}\n`);
ok(has(tooDeep, 'limit.nesting'), 'collection nesting beyond 24 is rejected');

const tooManyItems = await parseCourseYaml(
  `x:\n${'  - 0\n'.repeat(COURSE_YAML_LIMITS.collectionItems + 1)}`);
ok(has(tooManyItems, 'limit.collection_items'), 'a collection over 50,000 items is rejected');

const manyNodesSource =
  `x:\n${'  - [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]\n'.repeat(COURSE_YAML_LIMITS.collectionItems)}`;
const manyNodesStart = performance.now();
const tooManyNodes = await parseCourseYaml(manyNodesSource);
const manyNodesMs = performance.now() - manyNodesStart;
ok(has(tooManyNodes, 'limit.node_count'),
  `a document over 500,000 nodes is rejected (${Math.round(manyNodesMs)}ms)`);
ok(manyNodesMs < 10000, `bounded 500,000-node hostile input finishes under 10s (${Math.round(manyNodesMs)}ms)`);

const normalCards = Array.from({ length: 50000 }, (_, i) =>
  `  - { cardId: card-${i}, front: Prompt ${i} }\n`).join('');
const normalStart = performance.now();
const normal = await parseCourseYaml(`schemaVersion: 2\ncourseId: benchmark\ncards:\n${normalCards}`);
const normalMs = performance.now() - normalStart;
ok(normal.diagnostics.length === 0 && normal.value.cards.length === 50000,
  `the schema-maximum 50,000-card YAML parses successfully (${Math.round(normalMs)}ms)`);
ok(normalMs < 10000, `50,000-card parse remains under 10s (${Math.round(normalMs)}ms)`);

const vendorPath = path.join(WEB, 'lib', 'vendor', 'yaml-2.9.0.min.js');
const vendor = fs.readFileSync(vendorPath);
ok(vendor.byteLength === 103322, `vendored parser size is pinned (${vendor.byteLength} bytes)`);
ok(crypto.createHash('sha256').update(vendor).digest('hex')
    === '1a39585f38b5184a2e1284d77ed10ca1f6c9413593589ef6a54eae9ed6d8fc71',
  'vendored parser matches reproducible SHA-256');

const requests = [];
const mime = { '.html': 'text/html', '.js': 'application/javascript' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  requests.push(url.pathname);
  if (url.pathname === '/yaml-test.html') {
    res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
    res.end('<!doctype html><title>YAML module test</title>');
    return;
  }
  const file = path.resolve(WEB, `.${decodeURIComponent(url.pathname)}`);
  if (!file.startsWith(`${WEB}/`)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.writeHead(200, {
      'content-type': mime[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/yaml-test.html`);
  const browserResult = await page.evaluate(async () => {
    const module = await import('/lib/course-yaml.js');
    const before = performance.getEntriesByType('resource')
      .map((entry) => new URL(entry.name).pathname);
    const oversized = await module.parseCourseYaml(
      'x'.repeat(module.COURSE_YAML_LIMITS.inputBytes + 1));
    const between = performance.getEntriesByType('resource')
      .map((entry) => new URL(entry.name).pathname);
    const start = performance.now();
    const parsed = await module.parseCourseYaml(
      'schemaVersion: 2\ncourseId: browser\ncards:\n  - cardId: one\n    front: Hello\n');
    return {
      before,
      between,
      after: performance.getEntriesByType('resource')
        .map((entry) => new URL(entry.name).pathname),
      elapsed: performance.now() - start,
      courseId: parsed.value?.courseId,
      errors: parsed.diagnostics,
      oversized: oversized.diagnostics.map((item) => item.code),
    };
  });
  ok(!browserResult.before.some((item) => item.includes('yaml-2.9.0'))
      && !browserResult.between.some((item) => item.includes('yaml-2.9.0'))
      && browserResult.after.some((item) => item.endsWith('/lib/vendor/yaml-2.9.0.min.js')),
  'browser imports the parser only after a size-valid parse is requested');
  ok(browserResult.oversized.includes('limit.input_bytes'),
    'browser rejects oversized text before loading the parser');
  ok(browserResult.courseId === 'browser' && browserResult.errors.length === 0,
    `browser ESM parser returns plain course data (${browserResult.elapsed.toFixed(1)}ms)`);
  await page.close();
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log(out.concat(failures).join('\n'));
if (failures.length) {
  console.error(`\n${failures.length} failing`);
  process.exit(1);
}
console.log(`\nall ${out.length} green`);
