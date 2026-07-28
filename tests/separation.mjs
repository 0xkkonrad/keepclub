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
/** A drawing is a string. `doodles[name]` alone is truthy for "constructor". */
const path_ = (set, name) => (typeof set[name] === 'string' ? set[name] : null);
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

  /* REQUIRED is the short list, and deliberately so: a course brings its cards
   * and whatever theme it has, and Munin dresses every slot it leaves empty.
   * This gate used to demand doodles.js, boot.html, boot.css, an accent pair
   * and a boot line — which is the engine saying "bring what you like" and the
   * build saying "bring all of it or die". */
  const has = (f) => fs.existsSync(path.join(dir, f));
  for (const req of ['course.json', 'cards.json']) {
    ok(has(req), `${c} ships its own ${req}`);
  }
  if (!has('course.json') || !has('cards.json')) continue;   // nothing else can be said

  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'), 'utf8'));
  // The folder is the identity. These used to be free to disagree, and
  // progress is keyed on it — a rename forked everyone's history in silence.
  ok(meta.id === undefined || meta.id === c, `${c}: course.json id matches its folder`);

  // Brought or not; if brought, it has to be a colour — an accent reaches a
  // style attribute and a stylesheet, where a `;` is a way out of it.
  const colour = (v) => v === undefined || /^#[0-9a-f]{3,8}$/i.test(v);
  ok(['light', 'dark', 'inkLight', 'inkDark'].every((k) => colour(meta.accent?.[k])),
    `${c}: what it calls an accent is a colour`);

  // The hoard's rules are Munin's; a course may only rename and redraw them.
  const items = meta.hoard?.items || {};
  ok(Object.values(items).every((i) => !('test' in i)),
    `${c}: its hoard supplies no rules, only names and drawings`);

  if (has('doodles.js')) {
    const doodles = doodlesIn(fs.readFileSync(path.join(dir, 'doodles.js'), 'utf8'), 'DOODLE');
    // The shelf reads this instead of parsing 43 KB of the course's doodle
    // file with a regular expression on every draw.
    ok(meta.shelfPath === undefined || meta.shelfPath === path_(doodles, meta.shelfArt),
      `${c}: shelfPath is its own ${meta.shelfArt} drawing (run scripts/make-boot.mjs ${c})`);

    /* Every drawing a course asks for, it has. A name its set does not hold is
     * not an error at runtime — it falls back — but the fallback is what made
     * fourteen achievements draw the same picture. */
    const wanted = new Set([meta.boot?.art, meta.shelfArt, meta.fallback]
      .concat(Object.values(meta.sectionArt || {}))
      .concat(Object.values(meta.groupArt || {}))
      .concat(meta.friezeArt || [])
      .concat(Object.values(items).map((i) => i.art))
      .filter((n) => typeof n === 'string'));
    const missing = [...wanted].filter((n) => !path_(doodles, n));
    ok(missing.length === 0, `${c}: every drawing it asks for is in its own set ${missing.join(', ')}`);

    /* Munin's own drawings are the fallback for a name a course does not hold,
     * so the two sets must not collide: a course drawing its own `perch` would
     * silently win inside Munin's default hoard and nothing would fail. */
    const clash = Object.keys(MUNIN_DOODLE).filter((k) => k in doodles);
    ok(clash.length === 0, `${c}: its drawings do not collide with Munin's own ${clash.join(', ')}`);
  }

  /* A course's loading screen moves in its own keyframes. They used to be
   * named in app.css, so "the course owns its loading screen" meant picking
   * from the two the engine happened to declare. */
  if (has('boot.html')) {
    const bootHtml = fs.readFileSync(path.join(dir, 'boot.html'), 'utf8');
    // pathLength="1" renormalises any path, so one rule draws any drawing on.
    ok(/pathLength="1"/.test(bootHtml), `${c}: its boot scene is drawable (pathLength="1")`);
    // It is injected as markup and cached in localStorage. munin.js strips
    // these on the way back out; a course should not be shipping them at all.
    ok(!/<script|\son[a-z]+\s*=/i.test(bootHtml), `${c}: its boot scene carries no script`);
    ok(has('boot.css'), `${c}: a boot scene brings the stylesheet that moves it`);
  }
  if (has('boot.css')) {
    const bootCss = fs.readFileSync(path.join(dir, 'boot.css'), 'utf8');
    const declared = new Set([...bootCss.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
    const used = [...bootCss.matchAll(/animation(?:-name)?:\s*([\w-]+)/g)].map((m) => m[1])
      .filter((n) => n !== 'none');
    const borrowed = used.filter((n) => !declared.has(n));
    ok(borrowed.length === 0, `${c}: its boot animation is its own ${borrowed.join(', ')}`);
  }

  /* The deck itself, against the one description of what a deck is. */
  const deck = JSON.parse(fs.readFileSync(path.join(dir, 'cards.json'), 'utf8'));
  const v = validateDeck(deck);
  ok(v.ok, `${c}: its cards.json is a deck Munin can read ${v.errors.slice(0, 3).join('; ')}`);
}

/* ── engine → course ────────────────────────────────────────────────────── */

const ENGINE = ['app.js', 'app.css', 'index.html', 'munin.js', 'sw.js', 'import.js',
  'doodles-munin.js'].concat(
  fs.readdirSync(path.join(WEB, 'lib')).filter((f) => f.endsWith('.js')).map((f) => 'lib/' + f));

/* Words that belong to a course and were found in Munin's own files. The list
 * is what has actually leaked, not a guess: each of these shipped over every
 * course and every imported deck before the seam was cleaned up. Matched
 * without case, because `rya` and `TikTok` are the same leak as `RYA`. */
const COURSE_WORDS = [
  'day skipper', 'day-skipper', 'competent crew', 'competent-crew', 'rya',
  'almanac', 'maritime master', 'tiktok', "ship's log",
];

for (const f of ENGINE) {
  const code = codeOf(read(f)).toLowerCase();
  const found = COURSE_WORDS.filter((w) => code.includes(w))
    // Every registered course's own id, too: a blocklist of what leaked once
    // says nothing about the next course to be added, and `if (COURSE.id ===
    // 'spanish')` in app.js used to pass this gate clean.
    .concat(COURSES.filter((id) => code.includes(id.toLowerCase())));
  ok(found.length === 0, `${f} says nothing only one course would say ${[...new Set(found)].join(', ')}`);
}

/* The figure language is Munin's; a course's own nouns are the course's.
 *
 * app.css carried ~50 rules of one syllabus — f-sail, f-boom, f-warp,
 * f-fender, f-pontoon, f-jack — and applied them over every deck anybody
 * imported. The split is by meaning: what a dash is, what a leader line is,
 * what a swept arc is, and the colour tokens, are true of any subject drawn
 * this way. Anything naming a thing in one subject's world is not. */
const FIGURE_LANGUAGE = new Set(['f-thin', 'f-dash', 'f-dash-acc', 'f-dash-red',
  'f-lead', 'f-meas', 'f-cut', 'f-arc', 'f-arc-on', 'f-note', 'meas-on']);
const figureClasses = (src) => [...src.matchAll(/\.figure\s+(?:text)?\.([\w-]+)/g)]
  .map((m) => m[1]).filter((c) => !/^(c-|fill-|on$)/.test(c));

const engineFigures = figureClasses(read('app.css'));
const subjectInEngine = [...new Set(engineFigures)].filter((c) => !FIGURE_LANGUAGE.has(c));
ok(subjectInEngine.length === 0,
  `app.css draws no course's own nouns ${subjectInEngine.join(', ')}`);

for (const c of COURSES) {
  const f = path.join(WEB, 'courses', c, 'figures.css');
  const meta = JSON.parse(read('courses', c, 'course.json'));
  if (!fs.existsSync(f)) {
    ok(!meta.figures, `${c}: no figures block without a figures.css to back it`);
    continue;
  }
  const own = new Set(figureClasses(fs.readFileSync(f, 'utf8')));
  ok(own.size > 0, `${c}: its figures.css declares its own classes`);
  // Its stylesheet may not redefine the shared language out from under Munin.
  const stolen = [...own].filter((k) => FIGURE_LANGUAGE.has(k));
  ok(stolen.length === 0, `${c}: it does not redefine the figure language ${stolen.join(', ')}`);
  // And every class it says cannot take a pen is one it actually draws.
  const noPen = (meta.figures && meta.figures.noPen) || [];
  const unknown = noPen.filter((k) => !own.has(k));
  ok(unknown.length === 0, `${c}: every class it exempts from the pen is its own ${unknown.join(', ')}`);
}

/* The hoard's own drawings are Munin's, or the defaults are unreachable.
 * Read out of the HOARD literal by name and tolerant of how it is formatted —
 * a version of this that insisted on one line shape failed the build with
 * "found 0" the first time the array was reflowed. */
const hoardSrc = /const HOARD = \[([\s\S]*?)\n\];/.exec(read('app.js'));
ok(!!hoardSrc, 'the hoard can be found in app.js');
const hoardArts = hoardSrc
  ? [...hoardSrc[1].matchAll(/\bart:\s*'([\w-]+)'/g)].map((m) => m[1]) : [];
ok(hoardArts.length >= 10, `the hoard is a list of entries (found ${hoardArts.length})`);
const strayArt = hoardArts.filter((a) => !path_(MUNIN_DOODLE, a));
ok(strayArt.length === 0, `every hoard default is drawn in Munin's own set ${strayArt.join(', ')}`);
/* And each of them is a DIFFERENT drawing. The set held ten for a while and the
 * hoard has fourteen entries, so four of them doubled up — which on an imported
 * deck, where Munin's defaults are all you get, is four visible duplicate pairs
 * down the Progress screen. */
ok(new Set(hoardArts).size === hoardArts.length,
  `no two hoard defaults are the same drawing (${hoardArts.length - new Set(hoardArts).size} repeated)`);

/* The frieze is ten and no more — it has to fit a 320px screen without a
 * sideways scrollbar — and every one of them is a drawing Munin holds. */
const frieze = /friezeArt: \[([^\]]*)\]/.exec(read('munin.js'));
const friezeArt = frieze ? [...frieze[1].matchAll(/'([\w-]+)'/g)].map((m) => m[1]) : [];
ok(friezeArt.length === 10, `Munin's frieze is ten drawings (found ${friezeArt.length})`);
ok(friezeArt.every((a) => path_(MUNIN_DOODLE, a)), 'and every one of them is in its own set');

/* One raven list. It lived in four files, and the two the importer uses
 * drifting apart would give a deck a shelf tile from outside its own set. */
ok(RAVENS.length === Object.keys(MUNIN_DOODLE).length
  && RAVENS.every((r) => !!MUNIN_DOODLE[r]),
  'lib/deck.js names exactly the drawings doodles-munin.js holds');

/* Chrome is not character. The theme toggle's three states are drawn through
 * the same pipeline and live in the same file, but putting them in the raven
 * set would hand an imported deck a sun for an emblem and give the hoard a
 * fifteenth default it has no entry for. Gated in both directions. */
const MUNIN_GLYPH = doodlesIn(read('doodles-munin.js'), 'MUNIN_GLYPH');
const glyphNames = Object.keys(MUNIN_GLYPH);
ok(glyphNames.length === 3 && glyphNames.every((g) => path_(MUNIN_GLYPH, g)),
  `the theme's three states are drawn (${glyphNames.join(', ')})`);
const mixed = glyphNames.filter((g) => g in MUNIN_DOODLE);
ok(mixed.length === 0, `no theme glyph is also a raven ${mixed.join(', ')}`);
ok(!RAVENS.some((r) => r in MUNIN_GLYPH), 'and no raven is handed out as a theme glyph');

/* Munin's default loading screen is markup, not something app.js fills in:
 * the screen exists to cover the window before app.js runs. */
const html = read('index.html');
ok(/id="boot-scene"/.test(html) && /pathLength="1"/.test(html),
  'index.html carries a boot scene that can paint before app.js');
// index.html holds a copy of one drawing, because the default scene has to be
// markup. make-boot.mjs does NOT write index.html — redrawing the raven means
// pasting the new `perch` path into the boot scene by hand.
ok(html.includes(MUNIN_DOODLE.perch),
  "the boot scene is Munin's own perch drawing (paste the new path into index.html)");
ok(!/boot-art/.test(read('app.js')), 'app.js does not draw the loading screen it is too late for');

// The shell may FETCH course files at runtime, never <script src> them statically.
ok(!/script[^>]*src="courses\//.test(html), 'index.html loads no course file statically');

console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
