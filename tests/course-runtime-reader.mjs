import assert from 'node:assert/strict';
import { readCourseForRuntime } from '../web/lib/course-runtime.js';

const passed = [];
const failed = [];
const ok = (condition, message) =>
  (condition ? passed : failed).push((condition ? 'PASS  ' : 'FAIL  ') + message);

{
  const source = {
    schemaVersion: 2,
    courseId: 'rendered',
    cards: [{
      cardId: 'one',
      front: 'Remember **this** and <img src=x onerror=attack()>.',
      back: '[Safe](https://keepclub.app).',
    }],
  };
  const before = JSON.stringify(source);
  const result = await readCourseForRuntime(source);
  ok(result.course?.cards[0].front.includes('<strong>this</strong>')
      && result.course.cards[0].front.includes('&lt;img'),
  'format-2 fronts become sanitized runtime HTML');
  ok(result.course?.cards[0].back.includes('href="https://keepclub.app"'),
    'safe links render with the shared sanitizer');
  ok(result.contentRepresentation === 'sanitized-html',
    'the runtime result states its content representation');
  ok(JSON.stringify(source) === before,
    'runtime preparation does not mutate authored input');
}

{
  const result = await readCourseForRuntime({
    schemaVersion: 2,
    courseId: 'unsafe-link',
    cards: [{ cardId: 'one', front: '[label](javascript:attack%28%29)' }],
  });
  ok(result.course === null
      && result.diagnostics.some((item) => item.code === 'markdown.unsafe_link'),
  'unsafe links block runtime admission rather than reaching HTML consumers');
}

{
  const result = await readCourseForRuntime({
    schemaVersion: 2,
    courseId: 'unsupported',
    cards: [{ cardId: 'one', front: '# Unsupported heading' }],
  });
  ok(result.course === null
      && result.diagnostics.some((item) =>
        item.code === 'markdown.unsupported_construct'
          && item.path === '$.cards[0].front'),
  'unsupported Markdown blocks the course with a field path');
}

{
  const result = await readCourseForRuntime({
    format: 1,
    name: 'Legacy',
    sections: [{ k: 'all', t: 'All', n: 1 }],
    cards: [{ i: 'stable', s: 'all', q: '<b>Front</b>', a: 'Back' }],
  }, { courseId: 'legacy' });
  ok(result.course?.cards[0].front === '<b>Front</b>'
      && result.contentRepresentation === 'sanitized-html',
  'legacy sanitized HTML passes through without Markdown reinterpretation');
}

assert.equal(failed.length, 0, failed.join('\n'));
console.log([...passed, ...failed].join('\n'));
console.log(`\n${passed.length} passed, ${failed.length} failed`);
