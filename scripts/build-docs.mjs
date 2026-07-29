#!/usr/bin/env node

/* Keep deployable reference artifacts byte-for-byte derived from the public
 * contract. The docs themselves are static; this script has no dependency
 * install and is safe to run before a Pages deploy.
 *
 *   node scripts/build-docs.mjs --write
 *   node scripts/build-docs.mjs --check
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
if (!['--write', '--check'].includes(mode)) {
  console.error('usage: node scripts/build-docs.mjs --write|--check');
  process.exit(2);
}

const schemaSource = path.join(ROOT, 'schema', 'course-v2.schema.json');
const schemaTarget = path.join(
  ROOT, 'web', 'docs', 'schema', 'course-v2.schema.json');
const diagnosticsSource = path.join(ROOT, 'schema', 'diagnostics.md');
const errorsTarget = path.join(
  ROOT, 'web', 'docs', 'reference', 'errors', 'index.html');

const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const inline = (value) => escapeHtml(value)
  .replace(/`([^`]+)`/g, '<code>$1</code>');
const anchor = (value) => value.toLowerCase()
  .replace(/[._\s]+/g, '-')
  .replace(/[^a-z0-9-]/g, '')
  .replace(/-+/g, '-');

function readDiagnosticGroups() {
  const groups = [];
  let group = null;
  for (const line of fs.readFileSync(diagnosticsSource, 'utf8').split('\n')) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      group = { title: heading[1], entries: [] };
      groups.push(group);
      continue;
    }
    const row = /^\| `([^`]+)` \| (.+) \|$/.exec(line);
    if (row && group) group.entries.push({ code: row[1], meaning: row[2] });
  }
  return groups.filter((item) => item.entries.length);
}

function errorsPage(groups) {
  const navigation = groups.map((group) =>
    `<a href="#${anchor(group.title.toLowerCase())}">${escapeHtml(group.title)}</a>`
  ).join('\n        ');
  const sections = groups.map((group) => `
      <section id="${anchor(group.title.toLowerCase())}">
        <h2>${escapeHtml(group.title)}</h2>
        <dl class="diagnostics">
${group.entries.map(({ code, meaning }) => `          <div id="${anchor(code)}">
            <dt><code>${escapeHtml(code)}</code></dt>
            <dd>${inline(meaning)}</dd>
          </div>`).join('\n')}
        </dl>
      </section>`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Stable diagnostic codes for keep club course format 2.">
  <link rel="canonical" href="https://keepclub.app/docs/reference/errors/">
  <link rel="icon" href="../../../icon-192.png">
  <link rel="stylesheet" href="../../docs.css">
  <title>Diagnostic codes · keep club course docs</title>
  <style>
    .diagnostics { margin: 0; }
    .diagnostics > div { padding: 1rem 0; border-bottom: 1px solid var(--line); scroll-margin-top: 6rem; }
    .diagnostics dt { font-weight: 600; }
    .diagnostics dd { max-width: 76ch; margin: .35rem 0 0; color: var(--muted); }
  </style>
</head>
<body>
  <a class="skip" href="#content">Skip to the reference</a>
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="../../" aria-label="keep club course docs home">
        <img src="../../tower.svg" alt="" width="36" height="36">
        <span>keep club <small>course docs</small></span>
      </a>
      <nav class="top-links" aria-label="External">
        <a href="https://github.com/0xkkonrad/keepclub">source</a>
        <a href="https://keepclub.app/">open the app ↗</a>
      </nav>
    </div>
  </header>
  <div class="layout">
    <nav class="side" aria-label="Diagnostic groups">
      <strong>Course format 2</strong>
      <a href="../../">Creator guide</a>
      <a href="../../schema/course-v2.schema.json">JSON Schema ↧</a>
      <strong>On this page</strong>
      ${navigation}
        <a href="#legacy-compatibility">Legacy compatibility</a>
    </nav>
    <main id="content">
      <p class="eyebrow">Reference · stable API</p>
      <h1>Diagnostic codes</h1>
      <p class="lede">Codes do not change meaning. Wording may become clearer,
        but tools can depend on the code, severity, data path, correction, and
        documentation URL.</p>
      <div class="callout">
        <p><strong>Errors are atomic.</strong> They block the course rather than
          dropping part of it. Quality warnings may proceed through an explicit
          preview.</p>
      </div>
${sections}
      <section id="legacy-compatibility">
        <h2>Legacy compatibility</h2>
        <div class="callout warning">
          <p><strong>This is not a public authoring format.</strong> Legacy
            diagnostics come from the internal reader that keeps bundled
            courses and existing Anki imports working. Do not edit compact
            legacy fields to make a course.</p>
        </div>
        <p>Use the diagnostic’s own code, path, message, and correction as the
          specific account of what failed. For an Anki import, export a fresh
          <code>.apkg</code> or <code>.colpkg</code> from a current Anki version
          and try again. For a bundled course or a deck that used to open,
          reload once; if it still fails, report the code and path because the
          shipped/cache copy or stored import may be damaged.</p>
        <p>Course creators should use the documented
          <a href="../../#quick-start">format-2 <code>.keep.yml</code> and
          <code>.keep</code> contract</a>.</p>
      </section>
      <footer class="footer">
        <p>The format-2 tables are generated from
          <code>schema/diagnostics.md</code> in the keep club source tree.
          Edit the contract, then rebuild this reference.</p>
      </footer>
    </main>
  </div>
</body>
</html>
`;
}

const outputs = new Map([
  [schemaTarget, fs.readFileSync(schemaSource)],
  [errorsTarget, Buffer.from(errorsPage(readDiagnosticGroups()))],
]);

let stale = false;
for (const [target, wanted] of outputs) {
  const relative = path.relative(ROOT, target);
  if (mode === '--write') {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, wanted);
    console.log(`wrote ${relative}`);
    continue;
  }
  let actual = null;
  try {
    actual = fs.readFileSync(target);
  } catch {
    // Reported uniformly below.
  }
  if (!actual?.equals(wanted)) {
    stale = true;
    console.error(`${relative} is stale; run: node scripts/build-docs.mjs --write`);
  } else {
    console.log(`current ${relative}`);
  }
}
process.exit(stale ? 1 : 0);
