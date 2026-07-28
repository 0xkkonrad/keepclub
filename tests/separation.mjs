/* The seam, as a gate.
 *
 * Two directions, and until July 2026 only one of them was checked.
 *
 *   course → course   no course folder references another (the T6 ruling).
 *   course → self     every course ships the files it is made of.
 *   engine → course   nothing in Munin's own files names a course, a subject,
 *                     or a drawing out of one course's set.
 *
 * The third is the one that was actually leaking: the hoard was fourteen
 * nautical captions drawn from Day Skipper's doodles, the fineprint named an
 * almanac and a TikTok account, and the offline note counted a deck that only
 * one course has. All of it shipped over every course and over every deck
 * anyone imported.
 *
 * usage: node separation.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { validateDeck } from '../web/lib/validate.js';
import { RAVENS } from '../web/lib/deck.js';

const WEB = new URL('../web/', import.meta.url).pathname;
const out = [], fails = [];
const ok = (c, m) => (c ? out : fails).push((c ? 'PASS  ' : 'FAIL  ') + m);
const read = (...p) => fs.readFileSync(path.join(WEB, ...p), 'utf8');

/** A doodle file is a classic script declaring one object. */
function doodlesIn(src, name) {
  return new Function(`${src}\nreturn ${name};`)();
}

const MUNIN_DOODLE = doodlesIn(read('doodles-munin.js'), 'MUNIN_DOODLE');

/* ── the registry ───────────────────────────────────────────────────────── */

const registry = JSON.parse(read('courses', 'index.json'));
const COURSES = registry.courses;
const folders = fs.readdirSync(path.join(WEB, 'courses'))
  .filter((f) => fs.statSync(path.join(WEB, 'courses', f)).isDirectory());

ok(Array.isArray(COURSES) && COURSES.length > 0, 'courses/index.json lists the courses');
for (const f of folders) ok(COURSES.includes(f), `${f} is registered in courses/index.json`);
for (const id of COURSES) ok(folders.includes(id), `registered course ${id} has a folder`);

/** Comments may name a course to explain what went wrong; code may not. */
const codeOf = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ');

// The one list. A second copy of it is the bug this registry replaced.
for (const f of ['munin.js', 'sw.js']) {
  const named = COURSES.filter((id) => codeOf(read(f)).includes(id));
  ok(named.length === 0, `${f} names no course ${named.join(', ')}`);
}

/* ── each course ────────────────────────────────────────────────────────── */

for (const c of COURSES) {
  const dir = path.join(WEB, 'courses', c);
  const others = COURSES.filter((o) => o !== c);
  const crossRefs = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) continue;
    const text = fs.readFileSync(full, 'utf8');
    for (const o of others) if (text.includes(o)) crossRefs.push(`${c}/${f} → ${o}`);
  }
  ok(crossRefs.length === 0, `${c} references no other course ${crossRefs.join(', ')}`);

  for (const req of ['course.json', 'doodles.js', 'cards.json', 'boot.html', 'boot.css']) {
    ok(fs.existsSync(path.join(dir, req)), `${c} ships its own ${req}`);
  }

  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'), 'utf8'));
  const doodles = doodlesIn(fs.readFileSync(path.join(dir, 'doodles.js'), 'utf8'), 'DOODLE');

  ok(meta.accent?.light && meta.accent?.dark, `${c} owns an accent pair`);
  ok(!!meta.boot?.art && !!meta.boot?.line, `${c} owns its loading screen`);
  // The folder is the identity. These used to be free to disagree, and
  // progress is keyed on it — a rename forked everyone's history in silence.
  ok(meta.id === undefined || meta.id === c, `${c}: course.json id matches its folder`);

  // The shelf reads this instead of parsing 43 KB of the course's doodle file
  // with a regular expression on every draw.
  ok(meta.shelfPath === doodles[meta.shelfArt],
    `${c}: shelfPath is its own ${meta.shelfArt} drawing (run scripts/make-boot.mjs)`);

  /* Every drawing a course asks for, it has. A name its set does not hold is
   * not an error at runtime — it falls back — but the fallback is what made
   * fourteen achievements draw the same picture. */
  const wanted = new Set([meta.boot.art, meta.shelfArt, meta.fallback]
    .concat(Object.values(meta.sectionArt || {}))
    .concat(Object.values(meta.groupArt || {}))
    .concat(meta.friezeArt || [])
    .concat(Object.values(meta.hoard?.items || {}).map((i) => i.art))
    .filter(Boolean));
  const missing = [...wanted].filter((n) => !doodles[n]);
  ok(missing.length === 0, `${c}: every drawing it asks for is in its own set ${missing.join(', ')}`);

  // The hoard's rules are Munin's; a course may only rename and redraw them.
  const items = meta.hoard?.items || {};
  const banned = Object.values(items).filter((i) => 'test' in i);
  ok(banned.length === 0, `${c}: its hoard supplies no rules, only names and drawings`);

  /* A course's loading screen moves in its own keyframes. They used to be
   * named in app.css, so "the course owns its loading screen" meant picking
   * from the two the engine happened to declare. */
  const bootCss = fs.readFileSync(path.join(dir, 'boot.css'), 'utf8');
  const bootHtml = fs.readFileSync(path.join(dir, 'boot.html'), 'utf8');
  const declared = new Set([...bootCss.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
  const used = [...bootCss.matchAll(/animation:\s*([\w-]+)/g)].map((m) => m[1])
    .filter((n) => n !== 'none');
  const borrowed = used.filter((n) => !declared.has(n));
  ok(borrowed.length === 0, `${c}: its boot animation is its own ${borrowed.join(', ')}`);
  // pathLength="1" renormalises any path, so one rule draws any drawing on.
  ok(/pathLength="1"/.test(bootHtml), `${c}: its boot scene is drawable (pathLength="1")`);

  /* The deck itself, against the one description of what a deck is. */
  const deck = JSON.parse(fs.readFileSync(path.join(dir, 'cards.json'), 'utf8'));
  const v = validateDeck(deck);
  ok(v.ok, `${c}: its cards.json is a deck Munin can read ${v.errors.slice(0, 3).join('; ')}`);
}

/* ── engine → course ────────────────────────────────────────────────────── */

const ENGINE = ['app.js', 'app.css', 'index.html', 'munin.js', 'sw.js', 'import.js'];

/* Words that belong to a course and were found in Munin's own files. The list
 * is what has actually leaked, not a guess: each of these shipped over every
 * course and every imported deck before the seam was cleaned up. */
const COURSE_WORDS = [
  'Day Skipper', 'day-skipper', 'Competent Crew', 'competent-crew', 'RYA',
  'almanac', 'Maritime Master', 'tiktok', "Ship's log",
];

for (const f of ENGINE) {
  const found = COURSE_WORDS.filter((w) => codeOf(read(f)).includes(w));
  ok(found.length === 0, `${f} says nothing only one course would say ${found.join(', ')}`);
}

/* The hoard's own drawings are Munin's, or the defaults are unreachable. */
const hoardArts = [...read('app.js').matchAll(/\{ id: '[\w-]+', art: '([\w-]+)'/g)].map((m) => m[1]);
ok(hoardArts.length === 14, `the hoard has fourteen entries (found ${hoardArts.length})`);
const strayArt = hoardArts.filter((a) => !MUNIN_DOODLE[a]);
ok(strayArt.length === 0, `every hoard default is drawn in Munin's own set ${strayArt.join(', ')}`);

/* One raven list. It lived in four files, and the two the importer uses
 * drifting apart would give a deck a shelf tile from outside its own set. */
ok(RAVENS.length === Object.keys(MUNIN_DOODLE).length
  && RAVENS.every((r) => !!MUNIN_DOODLE[r]),
  'lib/deck.js names exactly the drawings doodles-munin.js holds');

/* Munin's default loading screen is markup, not something app.js fills in:
 * the screen exists to cover the window before app.js runs. */
const html = read('index.html');
ok(/id="boot-scene"/.test(html) && /pathLength="1"/.test(html),
  'index.html carries a boot scene that can paint before app.js');
ok(html.includes(MUNIN_DOODLE.perch),
  'the boot scene is Munin\'s own perch drawing (re-run scripts/make-boot.mjs after redrawing it)');
ok(!/boot-art/.test(read('app.js')), 'app.js does not draw the loading screen it is too late for');

// The shell may FETCH course files at runtime, never <script src> them statically.
ok(!/script[^>]*src="courses\//.test(html), 'index.html loads no course file statically');

console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
