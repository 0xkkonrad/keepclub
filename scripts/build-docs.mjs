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
const learnerSource = path.join(ROOT, 'web', 'docs', 'studying', 'index.html');
const schedulerSource = path.join(ROOT, 'docs', 'scheduler.md');
const schedulerCode = path.join(ROOT, 'web', 'app.js');

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
  const mobileNavigation = groups.map((group) =>
    `<a href="#${anchor(group.title.toLowerCase())}">${escapeHtml(group.title)}</a>`
  ).join('\n          ');

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
    .diagnostics dt code { overflow-wrap: anywhere; }
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
      <nav class="top-links" aria-label="Documentation links">
        <a href="https://github.com/0xkkonrad/keepclub">source</a>
        <a href="../../studying/">how studying works</a>
        <a href="https://keepclub.app/">open the app ↗</a>
      </nav>
    </div>
  </header>
  <div class="layout">
    <nav class="side" aria-label="Diagnostic groups">
      <strong>Learners</strong>
      <a href="../../studying/">How studying works</a>
      <strong>Course format 2</strong>
      <a href="../../">Creator guide</a>
      <a href="../../schema/course-v2.schema.json">JSON Schema ↧</a>
      <strong>On this page</strong>
      ${navigation}
        <a href="#legacy-compatibility">Legacy compatibility</a>
    </nav>
    <main id="content">
      <details class="mobile-nav">
        <summary>Guides and this page</summary>
        <nav aria-label="Mobile diagnostic reference">
          <a href="../../studying/">Learner study guide</a>
          <a href="../../">Creator guide</a>
          <a href="../../schema/course-v2.schema.json">JSON Schema ↧</a>
          ${mobileNavigation}
          <a href="#legacy-compatibility">Legacy compatibility</a>
        </nav>
      </details>
      <p class="eyebrow">Reference · stable API</p>
      <h1>Diagnostic codes</h1>
      <p class="lede">Tools can rely on each code, its severity, data path,
        correction, and documentation URL. The wording may be clarified, but
        a code will not be reused for a different problem.</p>
      <div class="callout">
        <p><strong>An error stops the whole import.</strong> keep club will not
          import only part of a course. You can continue past quality warnings
          after reviewing them.</p>
      </div>
${sections}
      <section id="legacy-compatibility">
        <h2>Legacy compatibility</h2>
        <div class="callout warning">
          <p><strong>This is not a public authoring format.</strong> These
            diagnostics come from the internal reader used for bundled courses
            and existing Anki imports. New courses should use format 2.</p>
        </div>
        <p>Check the diagnostic’s code, path, message, and suggested fix. For an
          Anki import, export a new <code>.apkg</code> or <code>.colpkg</code>
          from a current Anki version and try again. If a bundled course or
          previously working deck fails, reload once. If it still fails, report
          the code and path; the cached or stored copy may be damaged.</p>
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

function behavioralContractProblems(code) {
  const problems = [];
  const ahead = /if \(opts\.ahead\) \{([\s\S]*?)\n  \} else \{/.exec(code)?.[1] || '';
  const cappedAheadCategories = (ahead.match(/\.slice\(0, AHEAD_BATCH\)/g) || []).length;
  if (cappedAheadCategories !== 2) {
    problems.push('both Practice Ahead additions must use the 20-card batch');
  }

  const gradeBody = /function grade\([^)]*\) \{([\s\S]*?)\n\}\n\n\/\* One learner vocabulary/.exec(code)?.[1] || '';
  const practiceReturn = gradeBody.indexOf('if (practising) return outcome;');
  const durableTail = [
    'state.newDone++',
    'state.revDone++',
    'noteAnswered();',
    'save();',
  ];
  if (practiceReturn < 0 || durableTail.some((token) => {
    const at = gradeBody.indexOf(token);
    return at < 0 || at < practiceReturn;
  })) {
    problems.push('Practice must return before every durable counter/save operation');
  }
  return problems;
}

/** Fail the same pre-deploy command that checks generated references when a
 * scheduler constant changes without the learner and maintainer explanations.
 * These are observable product rules, not implementation trivia. */
function learnerContractCurrent() {
  const code = fs.readFileSync(schedulerCode, 'utf8');
  const learner = fs.readFileSync(learnerSource, 'utf8')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const maintainer = fs.readFileSync(schedulerSource, 'utf8')
    .replace(/\s+/g, ' ');
  const rules = [
    ['Again retains prior spacing', /provenInterval\(rec\) \* 0\.4/, /roughly 40%/i, /retain 40%/i],
    ['Hard is correct and holds', /if \(g === 2\) return lim\(Math\.max\(1, base\)\)/, /Hard is still a correct answer/i, /Hard \| Correct but slow/i],
    ['learning reinsertion uses queue positions', /const gap = g === 1 \? 4 : 8/, /behind about four other cards.*Hard puts it behind about eight/i, /behind about four cards and Hard behind about eight/i],
    ['learning and relearning Hard use different exits', /g === 2 && rec\.step < 2/, /third Hard moves it into ordinary reviews.*a second moves it back/i, /third Hard.*Relearning starts at step 1.*second uninterrupted Hard/i],
    ['Again resets a relearning sequence', /if \(g === 1\) \{ rec\.step = 0; outcome = 'stay'; \}/, /Again during relearning resets.*three Hards/i, /Again resets the step to 0.*three Hards/i],
    ['learning Easy can share retained spacing without raising ease', /return lim\(rec && rec\.pv \? Math\.max\(rec\.pv, 2\) : 4\)/, /Good and Easy can graduate.*same retained gap.*Easy does not always/i, /same retained spacing as Good and does not raise ease/i],
    ['progress statuses use one vocabulary', /new: 'not started',\s+learning: 'learning',\s+young: 'bedding in',\s+mature: 'solid'/, /Not started.*Learning.*Bedding in.*Solid/i, /not started.*learning.*bedding in.*solid/i],
    ['learning takes precedence over solid', /if \(r\.st === 'l'\) return 'learning';\s+return provenInterval\(r\) >= 21/, /Learning takes priority over the spacing label/i, /Learning state takes precedence/i],
    ['solid starts at 21 days', /provenInterval\(r\) >= 21/, /at least 21 days/i, /at least 21 days/i],
    ['exam introductions use 60%', /Math\.round\(d \* 0\.6\)/, /first 60%/i, /first 60%/i],
    ['zero new cards is an absolute pause', /if \(manual <= 0\) return 0/, /Zero remains an absolute pause/i, /Zero remains an absolute pause/i],
    ['exam review ceiling uses 20%', /Math\.round\(d \* 0\.2\)/, /about one fifth/i, /roughly 20%/i],
    ['existing exam projections retain their answer anchor', /const anchor = scheduleOrigin\(record\)/, /existing schedules from the date each current interval was originally earned.*due immediately/i, /projects that cap from `scheduleOrigin\(\)`.*immediately due/i],
    ['today and past exam dates are inactive', /d === null \|\| d <= 0\) return MAX_IVL/, /today or in the past does not cap newly calculated spacing/i, /Today and past dates are inactive/i],
    ['daily repeats still cap exam work', /state\.settings\.maxRev - state\.revDone/, /daily repeat limit still decides/i, /daily repeat limit decides/i],
    ['repeated-miss threshold is three', /const LEECH_AT = 3/, /after three Again/i, /Three lifetime Again/i],
    ['ahead batches are twenty', /const AHEAD_BATCH = 20/, /up to 20/i, /Up to 20 future reviews/i],
    ['empty sections may add counted cards', /\{ allNew: true \}/, /may start up to 20 extra unseen cards.*Due repeats can still be waiting/i, /may introduce up to 20 extra counted cards.*due repeats remain/i],
    ['interval spread is five percent', /Math\.round\(days \* 0\.05\)/, /about 5%/i, /about ±5%/i],
    ['interval labels summarize exact stored days', /if \(d < 365\).*Math\.round\(m\)/, /exact day count behind the button label.*month and year labels only summarize/i, /exact day count behind a revealed label.*month\/year labels are rounded summaries/i],
    ['Hard spread depends on review state', /const jitter = !\(rec && rec\.st === 'r' && g === 2\)/, /Hard on an ordinary review is not spread.*Hard that finishes relearning/i, /ordinary-review Hard is not spread; a graduating relearning Hard is/i],
    ['practice may include due backlog', /reviews = reviews\.concat\(notYet\)/, /Practice includes every learning and due card.*large due backlog/i, /All learning and due cards in scope.*spent daily cap/i],
    ['practice answers do not persist', /if \(practising\) return outcome/, /Practice does not change due dates/i, /all answers are non-recording/i],
    ['maximum interval is 400 days', /MAX_IVL = 400/, /400 days/i, /Maximum interval \| 400 days/i],
  ];
  let current = true;
  for (const [name, codeRule, learnerRule, maintainerRule] of rules) {
    const missing = [];
    if (!codeRule.test(code)) missing.push('scheduler code');
    if (!learnerRule.test(learner)) missing.push('learner guide');
    if (!maintainerRule.test(maintainer)) missing.push('maintainer contract');
    if (!missing.length) continue;
    current = false;
    console.error(`learner contract drift: ${name} missing from ${missing.join(', ')}`);
  }
  for (const problem of behavioralContractProblems(code)) {
    current = false;
    console.error(`learner contract drift: ${problem}`);
  }

  // Prove the pre-deploy tripwire rejects the two easy semantic drifts that
  // token-presence checks used to miss. These probes alter only strings in
  // memory; source files are never touched.
  const probes = [
    code.replace('.slice(0, AHEAD_BATCH);', '.slice(0, AHEAD_BATCH * 2);'),
    code.replace('if (practising) return outcome;',
      'state.revDone++;\n  if (practising) return outcome;'),
  ];
  if (probes.some((probe) => probe === code || !behavioralContractProblems(probe).length)) {
    current = false;
    console.error('learner contract drift: behavioral mutation self-probe escaped');
  }
  if (current) console.log('current scheduler learner contract');
  return current;
}

const outputs = new Map([
  [schemaTarget, fs.readFileSync(schemaSource)],
  [errorsTarget, Buffer.from(errorsPage(readDiagnosticGroups()))],
]);

let stale = !learnerContractCurrent();
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
