#!/usr/bin/env node
/*
 * Deterministic evidence for the permanent built-in compatibility migration.
 *
 * The shipped files deliberately remain format 1 until their HTML-authored
 * source can move to CommonMark without a render change. This report proves
 * what the read-time adapter does today, card by card, and becomes the exact
 * comparison oracle when builders eventually emit public format 2.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLegacyCourse } from '../web/lib/legacy-course.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'schema', 'built-in-migration-report.json');
const mode = process.argv.includes('--write') ? 'write'
  : process.argv.includes('--check') ? 'check' : null;
if (!mode) {
  console.error('usage: node scripts/build-course-migration-report.mjs --check|--write');
  process.exit(2);
}

const sha256 = (value) =>
  crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');

const courseIds = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'web', 'courses', 'index.json'), 'utf8',
)).courses.map((entry) => typeof entry === 'string' ? entry : entry.id).sort();

const report = {
  reportVersion: 1,
  status: 'read-time-legacy-adapter',
  note: 'Shipped format-1 bytes remain the rollback source; every mapping below is the pure in-memory descriptive view.',
  compatibilityInvariants: {
    localStorageKeysRenamed: false,
    cacheNamesRenamed: false,
    manifestIdChanged: false,
  },
  courses: [],
};

for (const courseId of courseIds) {
  const legacy = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'web', 'courses', courseId, 'cards.json'), 'utf8',
  ));
  const result = normalizeLegacyCourse(legacy, { courseId });
  const errors = result.diagnostics.filter((item) => item.severity === 'error');
  if (!result.course || errors.length) {
    throw new Error(`${courseId}: adapter errors: ${errors.map((item) => item.code).join(', ')}`);
  }
  const modern = result.course;
  if (legacy.cards.length !== modern.cards.length) {
    throw new Error(`${courseId}: card count changed`);
  }
  const cards = legacy.cards.map((oldCard, index) => {
    const newCard = modern.cards[index];
    const oldFrontHash = sha256(oldCard.q);
    const newFrontHash = sha256(newCard.front);
    const oldBackHash = sha256(oldCard.a);
    const newBackHash = sha256(newCard.back);
    return {
      index,
      oldCardId: oldCard.i,
      newCardId: newCard.cardId,
      idUnchanged: oldCard.i === newCard.cardId,
      oldSectionId: oldCard.s,
      newSectionId: newCard.sectionId,
      sectionUnchanged: oldCard.s === newCard.sectionId,
      renderedFront: {
        oldSha256: oldFrontHash,
        newSha256: newFrontHash,
        unchanged: oldFrontHash === newFrontHash,
      },
      renderedBack: {
        oldSha256: oldBackHash,
        newSha256: newBackHash,
        unchanged: oldBackHash === newBackHash,
      },
      media: {
        oldImage: oldCard.m || null,
        normalized: newCard.media || [],
        oldFigure: oldCard.f || null,
        normalizedFigure: newCard.figure || null,
      },
    };
  });
  const sections = legacy.sections.map((oldSection, index) => {
    const next = modern.sections[index];
    return {
      oldSectionId: oldSection.k,
      newSectionId: next.sectionId,
      idUnchanged: oldSection.k === next.sectionId,
      oldTitleSha256: sha256(oldSection.t),
      newTitleSha256: sha256(next.title),
      titleUnchanged: oldSection.t === next.title,
      oldCardCount: oldSection.n,
      derivedCardCount: next.cardCount,
    };
  });
  const legacyGroups = legacy.groups || [];
  const groups = legacyGroups.map((oldGroup, index) => {
    const next = modern.groups[index];
    return {
      oldGroupId: oldGroup.k,
      newGroupId: next.groupId,
      idUnchanged: oldGroup.k === next.groupId,
      oldSectionIds: oldGroup.s,
      newSectionIds: next.sectionIds,
      membershipUnchanged: JSON.stringify(oldGroup.s) === JSON.stringify(next.sectionIds),
      oldCardCount: oldGroup.n,
      derivedCardCount: next.cardCount,
    };
  });
  report.courses.push({
    courseId,
    normalizedCourseId: modern.courseId,
    courseIdUnchanged: courseId === modern.courseId,
    cardCount: cards.length,
    sectionCount: sections.length,
    groupCount: groups.length,
    cards,
    sections,
    groups,
  });
}

const allCards = report.courses.flatMap((course) => course.cards);
report.summary = {
  courses: report.courses.length,
  cards: allCards.length,
  unchangedCardIds: allCards.filter((card) => card.idUnchanged).length,
  unchangedRenderedFronts: allCards.filter((card) => card.renderedFront.unchanged).length,
  unchangedRenderedBacks: allCards.filter((card) => card.renderedBack.unchanged).length,
  unchangedSectionMemberships: allCards.filter((card) => card.sectionUnchanged).length,
};

const text = `${JSON.stringify(report, null, 2)}\n`;
if (mode === 'write') {
  fs.writeFileSync(OUTPUT, text);
  console.log(`wrote ${path.relative(ROOT, OUTPUT)} (${report.summary.cards} cards)`);
} else {
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : '';
  if (current !== text) {
    console.error('schema/built-in-migration-report.json is stale; run: '
      + 'node scripts/build-course-migration-report.mjs --write');
    process.exit(1);
  }
  console.log(`migration report current (${report.summary.cards} cards)`);
}
