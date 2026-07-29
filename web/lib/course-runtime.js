/*
 * Async course boundary for consumers that render card text as HTML.
 *
 * `readCourse()` deliberately leaves format-2 CommonMark authored and inert.
 * This layer renders and sanitizes it once, after validation, while legacy
 * format-1 content passes through unchanged because the adapter has already
 * sanitized it.
 */

import { readCourse } from './course.js';
import { renderCourseMarkdown } from './course-markdown.js';

const MAX_DIAGNOSTICS = 100;

function addDiagnostics(target, additions) {
  if (target.some((item) => item.code === 'document.too_many_errors'
      || item.code === 'markdown.too_many_errors')) return;
  for (const item of additions) {
    if (target.length < MAX_DIAGNOSTICS) {
      target.push(item);
      continue;
    }
    target.push({
      code: 'document.too_many_errors',
      severity: 'error',
      path: '',
      message: 'More than 100 validation errors exist.',
      correction: 'Fix the reported set, then validate the course again.',
      docsUrl: 'https://docs.keepclub.app/reference/errors/#document-too-many-errors',
    });
    return;
  }
}

/**
 * Validate and prepare one parsed course for safe runtime HTML consumption.
 *
 * @param {unknown} input already-parsed JSON/YAML data
 * @param {{courseId?: string}} [options] legacy identity context
 * @returns {Promise<ReturnType<typeof readCourse>>}
 */
export async function readCourseForRuntime(input, options = {}) {
  const result = readCourse(input, options);
  if (!result.course || result.contentRepresentation !== 'authored-commonmark') {
    return result;
  }

  const diagnostics = [...result.diagnostics];
  const cards = [];
  for (let index = 0; index < result.course.cards.length; index++) {
    const source = result.course.cards[index];
    const card = { ...source };
    for (const side of ['front', 'back']) {
      if (typeof source[side] !== 'string') continue;
      const rendered = await renderCourseMarkdown(source[side], {
        path: `$.cards[${index}].${side}`,
      });
      card[side] = rendered.html;
      addDiagnostics(diagnostics, rendered.diagnostics);
    }
    cards.push(card);
    if (diagnostics.some((item) =>
      item.code === 'document.too_many_errors'
        || item.code === 'markdown.too_many_errors')) break;
  }

  const failed = diagnostics.some((item) => item.severity === 'error');
  return {
    ...result,
    course: failed ? null : { ...result.course, cards },
    diagnostics,
    contentRepresentation: 'sanitized-html',
  };
}
