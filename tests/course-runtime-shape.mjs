/**
 * Ratchet for the format-1 single-letter course shape.
 *
 * The v2 migration is intentionally staged, so this test accepts the exact
 * compact accesses that existed when the migration began. It does not accept
 * a higher count or a new source fingerprint. Removing or rewriting an access
 * is immediately safe; after a batch lands, run with `--print-current` and
 * shrink the checked-in baseline.
 *
 * Private one-letter shapes that are not course data (the HTML tokenizer, for
 * example) have exact fingerprints and reasons in the same baseline. They are
 * not migration debt, but changing one still makes this test ask for review.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const BASELINE_PATH = path.join(HERE, 'course-runtime-shape-baseline.json');
const COMPACT = 'isqamdfktnor';
const EXCLUDED = new Set([
  // Permanent compatibility boundary: this is the only production module
  // allowed to understand format-1 card/section/group keys after migration.
  'web/lib/legacy-course.js',
]);

async function jsFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(ROOT, abs).replaceAll(path.sep, '/');
    if (entry.isDirectory()) {
      if (rel === 'web/lib/vendor') continue;
      out.push(...await jsFiles(abs));
    } else if (entry.isFile() && entry.name.endsWith('.js') && !EXCLUDED.has(rel)) {
      out.push(abs);
    }
  }
  return out;
}

function normalise(line) {
  return line.trim().replace(/\s+/g, ' ');
}

function collectLine(out, rel, line, lineNumber) {
  const source = normalise(line);
  const patterns = [
    // Negative lookbehind distinguishes a real member from `...a`.
    ['member', new RegExp(`(?<!\\.)\\.\\s*([${COMPACT}])\\b`, 'g'), 1],
    ['bracket', new RegExp(`\\[\\s*(['"])([${COMPACT}])\\1\\s*\\]`, 'g'), 2],
    // Compact properties emitted into objects. This intentionally catches
    // template/raw-text lookalikes too; exact allowlisting keeps that noise
    // reviewed instead of creating a parser-shaped blind spot.
    ['property', new RegExp(`(?:^|[,{])\\s*([${COMPACT}])\\s*:`, 'g'), 1],
  ];
  for (const [kind, regex, keyGroup] of patterns) {
    for (const match of line.matchAll(regex)) {
      const key = match[keyGroup];
      const signature = `${rel}|${kind}:${key}|${source}`;
      out.push({
        signature,
        fingerprint: createHash('sha256').update(signature).digest('hex').slice(0, 20),
        path: rel,
        line: lineNumber,
        kind,
        key,
        source,
      });
    }
  }
}

async function scan() {
  const out = [];
  for (const abs of (await jsFiles(path.join(ROOT, 'web'))).sort()) {
    const rel = path.relative(ROOT, abs).replaceAll(path.sep, '/');
    const lines = (await readFile(abs, 'utf8')).split(/\r?\n/);
    lines.forEach((line, i) => collectLine(out, rel, line, i + 1));
  }
  return out;
}

function counts(items) {
  const out = new Map();
  for (const item of items) {
    out.set(item.fingerprint, (out.get(item.fingerprint) || 0) + (item.count || 1));
  }
  return out;
}

function parseLedger(value, name) {
  assert.equal(typeof value, 'string', `${name} must be a compact fingerprint ledger`);
  const out = new Map();
  if (!value) return out;
  for (const entry of value.split(',')) {
    const [fingerprint, rawCount] = entry.split(':');
    const count = Number(rawCount);
    assert.match(fingerprint, /^[a-f0-9]{20}$/, `${name} has a bad fingerprint`);
    assert.ok(Number.isInteger(count) && count > 0, `${name} has a bad count`);
    assert.ok(!out.has(fingerprint), `${name} repeats ${fingerprint}`);
    out.set(fingerprint, count);
  }
  return out;
}

const formatLedger = (entries) => [...entries].sort(([a], [b]) => a.localeCompare(b))
  .map(([fingerprint, count]) => `${fingerprint}:${count}`).join(',');

const total = (entries) => [...entries.values()].reduce((n, count) => n + count, 0);

function formatted(items) {
  return items.map((item) =>
    `  ${item.path}:${item.line} [${item.kind}:${item.key}] ${item.fingerprint} ${item.source}`);
}

const baseline = JSON.parse(await readFile(BASELINE_PATH, 'utf8'));
assert.equal(baseline.version, 1, 'course runtime compact-field baseline has an unknown version');
assert.equal(typeof baseline.remaining, 'string',
  'baseline.remaining must be a compact fingerprint ledger');
assert.ok(Array.isArray(baseline.allowedPrivateShapes), 'baseline.allowedPrivateShapes must be an array');

const observed = await scan();
const observedCounts = counts(observed);
const signatures = new Map();
for (const item of observed) {
  const old = signatures.get(item.fingerprint);
  assert.ok(!old || old === item.signature, `compact-field fingerprint collision: ${item.fingerprint}`);
  signatures.set(item.fingerprint, item.signature);
}
const remainingCounts = parseLedger(baseline.remaining, 'baseline.remaining');
const allowedCounts = new Map();
for (const group of baseline.allowedPrivateShapes) {
  assert.equal(typeof group.reason, 'string', 'every private-shape group needs a reason');
  for (const [fingerprint, count] of parseLedger(
    group.fingerprints, `private shapes: ${group.reason}`,
  )) {
    allowedCounts.set(fingerprint, (allowedCounts.get(fingerprint) || 0) + count);
  }
}
const unexpected = [];

for (const item of observed) {
  const allowed = allowedCounts.get(item.fingerprint) || 0;
  const expected = remainingCounts.get(item.fingerprint) || 0;
  const seen = observedCounts.get(item.fingerprint) || 0;
  if (seen > allowed + expected && !unexpected.some((x) => x.fingerprint === item.fingerprint)) {
    unexpected.push(item);
  }
}

if (process.argv.includes('--print-current')) {
  const current = {};
  for (const [fingerprint, count] of observedCounts) {
    const privateCount = allowedCounts.get(fingerprint) || 0;
    if (count > privateCount) current[fingerprint] = count - privateCount;
  }
  process.stdout.write(JSON.stringify({
    version: 1,
    note: baseline.note,
    remaining: formatLedger(Object.entries(current)),
    allowedPrivateShapes: baseline.allowedPrivateShapes,
  }, null, 2) + '\n');
  process.exit(0);
}

if (process.argv.includes('--list-current')) {
  const privateFingerprints = new Set(allowedCounts.keys());
  const current = observed.filter((item) => !privateFingerprints.has(item.fingerprint));
  process.stdout.write(formatted(current).join('\n') + '\n');
  process.exit(0);
}

assert.deepEqual(
  unexpected,
  [],
  [
    'New format-1-style production access(es) appeared outside web/lib/legacy-course.js.',
    ...formatted(unexpected),
    'Use descriptive course fields. If this is genuinely unrelated private data,',
    'add only its exact fingerprint and a reason to allowedPrivateShapes.',
    'Never grow remaining; after migrations, shrink it with:',
    '  node course-runtime-shape.mjs --print-current',
  ].join('\n'),
);

const remainingNow = [...observedCounts].reduce((n, [signature, count]) =>
  n + Math.min(count, remainingCounts.get(signature) || 0), 0);
const baselineTotal = total(remainingCounts);
const removed = baselineTotal - remainingNow;
const summary = `${remainingNow}/${baselineTotal} compact production accesses remain`;
console.log(`ok - course runtime shape ratchet (${summary}${removed ? `, ${removed} removed` : ''})`);
