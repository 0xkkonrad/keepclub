/* The T6 ruling as a gate: course folders are self-contained. No file in one
 * course folder references another course folder, and munin's shell never
 * statically imports a course theme file. usage: node separation.mjs */
import fs from 'node:fs';
import path from 'node:path';

const WEB = new URL('../web/', import.meta.url).pathname;
const COURSES = fs.readdirSync(path.join(WEB, 'courses'));
const out = [], fails = [];
const ok = (c, m) => (c ? out : fails).push((c ? 'PASS  ' : 'FAIL  ') + m);

for (const c of COURSES) {
  const dir = path.join(WEB, 'courses', c);
  const others = COURSES.filter((o) => o !== c);
  let crossRefs = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) continue;
    const text = fs.readFileSync(full, 'utf8');
    for (const o of others) if (text.includes(o)) crossRefs.push(`${c}/${f} → ${o}`);
  }
  ok(crossRefs.length === 0, `${c} references no other course ${crossRefs.join(', ')}`);
  for (const req of ['course.json', 'doodles.js', 'cards.json']) {
    ok(fs.existsSync(path.join(dir, req)), `${c} ships its own ${req}`);
  }
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'), 'utf8'));
  ok(meta.accent?.light && meta.accent?.dark, `${c} owns an accent pair`);
  ok(!!meta.boot?.art && !!meta.boot?.line, `${c} owns its loading screen`);
}

// The shell may FETCH course files at runtime, never <script src> them statically.
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
ok(!/script[^>]*src="courses\//.test(html), 'index.html loads no course file statically');

console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
