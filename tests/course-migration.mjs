import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

execFileSync(process.execPath, ['../scripts/build-course-migration-report.mjs', '--check'], {
  cwd: new URL('.', import.meta.url),
  stdio: 'inherit',
});
const report = JSON.parse(fs.readFileSync(
  new URL('../schema/built-in-migration-report.json', import.meta.url), 'utf8',
));
const registry = JSON.parse(fs.readFileSync(
  new URL('../web/courses/index.json', import.meta.url), 'utf8',
));
const cards = report.courses.flatMap((course) => course.cards);

assert.equal(report.summary.courses, registry.courses.length);
assert.equal(report.summary.cards, cards.length);
assert.equal(report.summary.unchangedCardIds, cards.length);
assert.equal(report.summary.unchangedRenderedFronts, cards.length);
assert.equal(report.summary.unchangedRenderedBacks, cards.length);
assert.equal(report.summary.unchangedSectionMemberships, cards.length);
assert.ok(report.courses.every((course) =>
  course.courseIdUnchanged
    && course.sections.every((section) =>
      section.idUnchanged && section.titleUnchanged
        && section.oldCardCount === section.derivedCardCount)
    && course.groups.every((group) =>
      group.idUnchanged && group.membershipUnchanged
        && group.oldCardCount === group.derivedCardCount)));

/* Scheduling queues consume identity and deck order, neither card bodies nor
 * compact field names. Same seeded shuffle over both sides must stay exact. */
function seededOrder(ids, seed) {
  const result = [...ids];
  let state = seed >>> 0;
  for (let index = result.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const other = state % (index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
for (const course of report.courses) {
  const oldIds = course.cards.map((card) => card.oldCardId);
  const newIds = course.cards.map((card) => card.newCardId);
  assert.deepEqual(seededOrder(newIds, 0x4b454550), seededOrder(oldIds, 0x4b454550));
}

console.log(`PASS  migration report proves ${cards.length} stable built-in cards`);
console.log('PASS  course, section, group, content, media mapping and seeded queue invariants hold');
