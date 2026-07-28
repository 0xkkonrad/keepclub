/* Fill in the mechanical half of a course's theme: the shelf emblem's path, and
 * a starter loading screen drawn from the course's own doodle set.
 *
 *   node scripts/make-boot.mjs [course-id ...]
 *
 * The shelf used to fetch 43 KB of a course's doodles.js and mine one path out
 * of it with a regular expression, on every draw. The path belongs in
 * course.json, where the shell already looks — this puts it there.
 *
 * The boot scene it writes is deliberately the plain one: the course's own
 * drawing, drawn on and then moving, in the course's own keyframes. A real
 * per-course scene (project.md, "Boot screens") is a drawing job and replaces
 * boot.html by hand; nothing here overwrites a boot.html that has been edited
 * unless you pass --force.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const WEB = new URL('../web/', import.meta.url).pathname;
const force = process.argv.includes('--force');
const asked = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const registry = JSON.parse(fs.readFileSync(path.join(WEB, 'courses/index.json'), 'utf8'));
const ids = asked.length ? asked : registry.courses;

/** A course's doodles.js is a classic script declaring `const DOODLE = {…}`. */
function doodlesOf(dir) {
  const src = fs.readFileSync(path.join(dir, 'doodles.js'), 'utf8');
  const fn = new Function(src + '\nreturn DOODLE;');
  return fn();
}

for (const id of ids) {
  const dir = path.join(WEB, 'courses', id);
  const metaPath = path.join(dir, 'course.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const doodles = doodlesOf(dir);

  const shelfPath = doodles[meta.shelfArt];
  if (!shelfPath) throw new Error(`${id}: shelfArt "${meta.shelfArt}" is not in its doodle set`);
  meta.shelfPath = shelfPath;
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 1) + '\n');
  console.log(`${id}: shelfPath ← ${meta.shelfArt} (${shelfPath.length} chars)`);

  const bootArt = doodles[meta.boot?.art];
  if (!bootArt) throw new Error(`${id}: boot.art "${meta.boot?.art}" is not in its doodle set`);
  const html = path.join(dir, 'boot.html');
  const css = path.join(dir, 'boot.css');
  if (fs.existsSync(html) && !force) {
    console.log(`${id}: boot.html exists, left alone (--force to redraw)`);
    continue;
  }
  const cls = `boot-${id}`;
  fs.writeFileSync(html, `<!-- ${id}'s loading screen. Munin swaps this in for its own raven and keeps
     it in localStorage, so every visit after the first paints this before
     anything else runs. pathLength="1" is what lets one rule draw it on. -->
<svg class="${cls}" viewBox="0 0 32 32" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path pathLength="1" d="${bootArt}"/>
</svg>
`);
  fs.writeFileSync(css, `/* ${id} — how its loading screen moves. Its own keyframes: the animation
 * vocabulary belongs to the course, not to Munin's stylesheet, or a course
 * could only ever pick from the two names app.css happened to declare. */
.${cls} { width: 52px; height: 52px; color: var(--accent);
  animation: ${cls}-move 2.2s ease-in-out infinite; }
.${cls} path { stroke-dasharray: 1; stroke-dashoffset: 1;
  animation: ${cls}-draw 1.5s ease-out forwards; }
@keyframes ${cls}-draw { to { stroke-dashoffset: 0; } }
@keyframes ${cls}-move { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
/* Reduced motion leaves the drawing finished, not half-drawn. */
@media (prefers-reduced-motion: reduce) {
  .${cls}, .${cls} path { animation: none; }
  .${cls} path { stroke-dashoffset: 0; }
}
`);
  console.log(`${id}: boot.html + boot.css ← ${meta.boot.art}`);
}
