import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright-core';
import {
  COURSE_MARKDOWN_LIMITS,
  renderCourseMarkdown,
} from '../web/lib/course-markdown.js';

const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const WEB = path.join(ROOT, 'web');
const EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || chromium.executablePath();
const fixture = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'schema', 'fixtures', 'markdown.json'), 'utf8'));
const out = [], failures = [];
const ok = (condition, message) => {
  (condition ? out : failures).push(`${condition ? 'PASS' : 'FAIL'}  ${message}`);
};
const codes = (result) => result.diagnostics.map((item) => item.code);

for (const test of fixture.cases) {
  const result = await renderCourseMarkdown(test.source, {
    path: `cards[0].${test.id}`,
    ...test.options,
  });
  ok(result.html === test.html && result.text === test.text,
    `${test.id} matches the shared sanitized HTML/text fixture`);
  ok(JSON.stringify(codes(result)) === JSON.stringify(test.diagnostics),
    `${test.id} matches the shared diagnostic fixture`);
  ok(result.diagnostics.every((item) =>
    item.path === `cards[0].${test.id}`
      && item.severity === 'error'
      && item.line >= 1 && item.column >= 1
      && item.message && item.correction && item.docsUrl),
  `${test.id} diagnostics are stable and actionable`);
}

const hostileLinks = [
  '[x](data:text/html,attack)',
  '[x](http://example.com)',
  '[x](/relative)',
  '[x](//evil.example)',
];
for (const source of hostileLinks) {
  const result = await renderCourseMarkdown(source);
  ok(codes(result).includes('markdown.unsafe_link')
      && result.text === 'x' && !result.html.includes('<a'),
  `${source} remains inert without losing its label`);
}

const oversized = await renderCourseMarkdown(
  'x'.repeat(COURSE_MARKDOWN_LIMITS.inputCodePoints + 1));
ok(codes(oversized).includes('markdown.too_long'),
  'oversized input stops before parsing');
const start = performance.now();
const complex = await renderCourseMarkdown('*a* '.repeat(51000));
const elapsed = performance.now() - start;
ok(codes(complex).includes('markdown.too_complex') && !complex.html,
  `syntax-node budget stops complex input (${Math.round(elapsed)}ms)`);
ok(elapsed < 5000, `complex input completes under 5s (${Math.round(elapsed)}ms)`);

const vendor = fs.readFileSync(path.join(
  WEB, 'lib', 'vendor', 'commonmark-parser-0.31.2.min.js'));
ok(vendor.byteLength === 153114
    && crypto.createHash('sha256').update(vendor).digest('hex')
      === '71e8fc088e76312d850f05f8d7105d9d75904ded0cabd7b8b7c85e183d584dd6',
  'the local parser bundle has the pinned size and SHA-256');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/markdown-test.html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><main id="preview"></main>');
    return;
  }
  const file = path.resolve(WEB, `.${decodeURIComponent(url.pathname)}`);
  if (!file.startsWith(`${WEB}/`)) return res.writeHead(403).end();
  try {
    const contents = fs.readFileSync(file);
    res.writeHead(200, {
      'content-type': path.extname(file) === '.js'
        ? 'application/javascript' : 'application/octet-stream',
    });
    res.end(contents);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/markdown-test.html`);
  const result = await page.evaluate(async (limit) => {
    window.attacked = 0;
    const module = await import('/lib/course-markdown.js');
    const resources = () => performance.getEntriesByType('resource')
      .map((entry) => new URL(entry.name).pathname);
    const before = resources();
    await module.renderCourseMarkdown(' ');
    await module.renderCourseMarkdown('x'.repeat(limit + 1));
    const preflight = resources();
    const rendered = await module.renderCourseMarkdown(
      '[keep club](https://keepclub.app) <img src=x onerror="window.attacked=1">');
    const preview = document.querySelector('#preview');
    preview.innerHTML = rendered.html;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const anchor = preview.querySelector('a');
    return {
      before, preflight, after: resources(),
      text: rendered.text,
      anchor: [anchor?.textContent, anchor?.target, anchor?.rel],
      hostile: !!preview.querySelector('img,script,svg,iframe'),
      attacked: window.attacked,
    };
  }, COURSE_MARKDOWN_LIMITS.inputCodePoints);
  ok(!result.before.some((item) => item.includes('commonmark-parser'))
      && !result.preflight.some((item) => item.includes('commonmark-parser'))
      && result.after.some((item) => item.endsWith('commonmark-parser-0.31.2.min.js')),
  'browser loads the parser lazily from the local vendor path');
  ok(result.anchor[0] === 'keep club' && result.anchor[1] === '_blank'
      && result.anchor[2].includes('noopener') && result.anchor[2].includes('noreferrer'),
  'browser links retain labels and isolation attributes');
  ok(!result.hostile && result.attacked === 0 && result.text.includes('<img'),
    'hostile raw HTML stays visible and inert in a browser');
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log(out.concat(failures).join('\n'));
if (failures.length) process.exit(1);
console.log(`\nall ${out.length} green`);
