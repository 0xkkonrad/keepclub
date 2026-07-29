/*
 * The single pure boundary between course artifacts and the descriptive app
 * model. Parsed format-2 text is still authored CommonMark here: callers must
 * render and sanitize it before it can reach innerHTML.
 */

import { detectCourseFormat, normalizeLegacyCourse } from './legacy-course.js';

const ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const DOCS = 'https://docs.keepclub.app/reference/errors/';
const MAX_DIAGNOSTICS = 100;
const MEDIA_TYPES = new Set(['image', 'audio', 'video']);
const TOP_FIELDS = new Set([
  'schemaVersion', 'courseId', 'title', 'shortTitle', 'tagline', 'description',
  'contentLanguage', 'instructionLanguage', 'authors', 'license', 'source',
  'sections', 'groups', 'cards', 'theme', 'extensions',
]);
const CARD_FIELDS = new Set([
  'cardId', 'front', 'back', 'sectionId', 'tags', 'media', 'extensions',
]);
const SECTION_FIELDS = new Set(['sectionId', 'title', 'description', 'extensions']);
const GROUP_FIELDS = new Set([
  'groupId', 'title', 'description', 'sectionIds', 'extensions',
]);

class UnreadableData extends Error {
  constructor(path, message) {
    super(message);
    this.path = path;
  }
}

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function ownKeys(value, path) {
  try {
    return Object.keys(value);
  } catch {
    throw new UnreadableData(path, 'This value cannot be inspected safely.');
  }
}

function ownValue(value, key, path) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new UnreadableData(path, 'This value cannot be inspected safely.');
  }
  if (!descriptor) return undefined;
  if (!Object.hasOwn(descriptor, 'value')) {
    throw new UnreadableData(path, 'Accessor properties are not course data.');
  }
  return descriptor.value;
}

/* Clone only inert JSON-compatible data. This makes normalization independent
 * of later caller mutation and bounds hostile cyclic/accessor inputs. */
function cloneData(value, path = '$', ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object') {
    throw new UnreadableData(path, 'Course values must be JSON-compatible data.');
  }
  if (ancestors.has(value)) {
    throw new UnreadableData(path, 'Cyclic values are not valid course data.');
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const length = ownValue(value, 'length', path);
      if (!Number.isSafeInteger(length) || length < 0) {
        throw new UnreadableData(path, 'This list has an unreadable length.');
      }
      const result = [];
      for (let i = 0; i < length; i++) {
        result.push(cloneData(ownValue(value, String(i), `${path}[${i}]`),
          `${path}[${i}]`, ancestors));
      }
      return result;
    }
    const result = {};
    for (const key of ownKeys(value, path)) {
      result[key] = cloneData(ownValue(value, key, `${path}.${key}`),
        `${path}.${key}`, ancestors);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

function diagnosticsCollector() {
  const diagnostics = [];
  let truncated = false;
  const add = (code, severity, path, message, correction) => {
    if (diagnostics.length < MAX_DIAGNOSTICS) {
      diagnostics.push({
        code,
        severity,
        path,
        message,
        correction,
        docsUrl: DOCS + code.replaceAll('.', '-'),
      });
      return;
    }
    if (truncated) return;
    truncated = true;
    diagnostics.push({
      code: 'document.too_many_errors',
      severity: 'error',
      path: '',
      message: 'More than 100 validation errors exist.',
      correction: 'Fix the reported set, then validate the course again.',
      docsUrl: DOCS + 'document-too-many-errors',
    });
  };
  return {
    diagnostics,
    error: (code, path, message, correction) =>
      add(code, 'error', path, message, correction),
    warning: (code, path, message, correction) =>
      add(code, 'warning', path, message, correction),
  };
}

function unknownFields(value, allowed, path, out) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      out.error('field.unknown', `${path}.${key}`,
        `Field "${key}" is not part of course format 2.`,
        'Remove it or move intentional third-party data into a namespaced extension.');
    }
  }
}

function validId(value, path, missingCode, out) {
  if (value === undefined) {
    out.error(missingCode, path, 'A stable ID is required.',
      'Add a stable lowercase ID before importing.');
    return false;
  }
  if (typeof value !== 'string' || !ID.test(value)) {
    out.error('course.invalid_id', path,
      'This ID does not match the lowercase stable-ID grammar.',
      'Use 1–128 lowercase letters, digits, dots, underscores, or hyphens.');
    return false;
  }
  return true;
}

function requiredTitle(value, path, out) {
  if (typeof value !== 'string') {
    out.error('field.invalid_type', path, 'A display title must be text.',
      'Provide a non-empty title.');
    return false;
  }
  if (!value.length || value.length > 200) {
    out.error('field.empty', path, 'A display title must contain 1–200 characters.',
      'Provide a meaningful title or remove the containing object.');
    return false;
  }
  return true;
}

function stableString(value) {
  if (Array.isArray(value)) return `[${value.map(stableString).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stableString(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value) {
  const text = stableString(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function normalizeV2(input) {
  const out = diagnosticsCollector();
  let source;
  try {
    source = cloneData(input);
  } catch (error) {
    const path = error instanceof UnreadableData ? error.path : '$';
    out.error('field.invalid_type', path,
      error instanceof UnreadableData ? error.message : 'The course cannot be inspected safely.',
      'Use ordinary parsed YAML/JSON data without accessors, proxies, or cycles.');
    return {
      course: null,
      diagnostics: out.diagnostics,
      sourceFormat: 'course-v2',
      contentRepresentation: 'authored-commonmark',
    };
  }

  if (!isObject(source)) {
    out.error('course.not_object', '$', 'The course root is not an object.',
      'Make the document root a course mapping.');
    return {
      course: null,
      diagnostics: out.diagnostics,
      sourceFormat: 'course-v2',
      contentRepresentation: 'authored-commonmark',
    };
  }
  unknownFields(source, TOP_FIELDS, '$', out);
  if (source.schemaVersion !== 2) {
    out.error('course.unsupported_schema_version', '$.schemaVersion',
      'schemaVersion must be the integer 2.',
      'Set schemaVersion to 2 and use the format-2 contract.');
  }
  validId(source.courseId, '$.courseId', 'course.missing_id', out);

  if (!Array.isArray(source.cards) || source.cards.length < 1
      || source.cards.length > 50000) {
    out.error('course.cards_required', '$.cards',
      'cards must be a list containing 1–50,000 cards.',
      'Provide at least one card, or split a course above the limit.');
  }

  const declaredSections = Array.isArray(source.sections) && source.sections.length > 0;
  if (source.sections !== undefined && !Array.isArray(source.sections)) {
    out.error('field.invalid_type', '$.sections', 'sections must be a list.',
      'Use a list of section objects or omit sections.');
  }
  const sections = [];
  const sectionIds = new Set();
  if (declaredSections) {
    for (let i = 0; i < source.sections.length; i++) {
      const raw = source.sections[i];
      const path = `$.sections[${i}]`;
      if (!isObject(raw)) {
        out.error('field.invalid_type', path, 'A section must be an object.',
          'Use a section object with sectionId and title.');
        continue;
      }
      unknownFields(raw, SECTION_FIELDS, path, out);
      const idOk = validId(raw.sectionId, `${path}.sectionId`, 'course.invalid_id', out);
      requiredTitle(raw.title, `${path}.title`, out);
      if (idOk && sectionIds.has(raw.sectionId)) {
        out.error('section.duplicate_id', `${path}.sectionId`,
          `Section ID "${raw.sectionId}" is repeated.`,
          'Give every section one unique stable ID.');
      }
      if (idOk) sectionIds.add(raw.sectionId);
      sections.push({ ...raw, cardCount: 0 });
    }
  } else {
    sections.push({ sectionId: 'all-cards', title: 'All cards', cardCount: 0 });
    sectionIds.add('all-cards');
  }

  const cards = [];
  const cardIds = new Set();
  if (Array.isArray(source.cards)) {
    for (let i = 0; i < source.cards.length; i++) {
      const raw = source.cards[i];
      const path = `$.cards[${i}]`;
      if (!isObject(raw)) {
        out.error('field.invalid_type', path, 'A card must be an object.',
          'Use a card object with a stable cardId.');
        continue;
      }
      unknownFields(raw, CARD_FIELDS, path, out);
      const idOk = validId(raw.cardId, `${path}.cardId`, 'card.missing_id', out);
      if (idOk && cardIds.has(raw.cardId)) {
        out.error('card.duplicate_id', `${path}.cardId`,
          `Card ID "${raw.cardId}" is repeated.`,
          'Give every review card one unique stable ID.');
      }
      if (idOk) cardIds.add(raw.cardId);

      if (raw.front !== undefined && typeof raw.front !== 'string') {
        out.error('field.invalid_type', `${path}.front`, 'front must be CommonMark text.',
          'Use text, or omit front and provide valid front-side media.');
      }
      if (raw.back !== undefined && typeof raw.back !== 'string') {
        out.error('field.invalid_type', `${path}.back`, 'back must be CommonMark text.',
          'Use text or omit back.');
      }
      if (raw.media !== undefined && !Array.isArray(raw.media)) {
        out.error('field.invalid_type', `${path}.media`, 'media must be a list.',
          'Use a list of media objects or omit media.');
      }
      const hasFrontText = typeof raw.front === 'string' && raw.front.trim().length > 0;
      const hasFrontMedia = Array.isArray(raw.media)
        && raw.media.some((media) => isObject(media)
          && media.side === 'front'
          && MEDIA_TYPES.has(media.mediaType)
          && typeof media.source === 'string'
          && media.source.length > 0);
      if (!hasFrontText && !hasFrontMedia) {
        out.error('card.front_empty', path,
          'Neither front text nor front-side media can render a prompt.',
          'Add non-blank front text or at least one front-side media object.');
      }

      const card = { ...raw };
      if (typeof card.back === 'string' && !card.back.trim()) {
        delete card.back;
        out.warning('field.empty_back', `${path}.back`,
          'A blank back was removed; this is a front-only card.',
          'Omit back to state front-only intent explicitly.');
      }

      let sectionId = card.sectionId;
      if (sectionId !== undefined && !validId(
        sectionId, `${path}.sectionId`, 'course.invalid_id', out,
      )) {
        sectionId = null;
      } else if (sectionId === undefined) {
        if (!declaredSections || sections.length === 1) {
          sectionId = sections[0]?.sectionId;
        } else {
          out.error('section.ambiguous_default', `${path}.sectionId`,
            'This card omits sectionId while multiple sections are declared.',
            'Name exactly which declared section owns this card.');
        }
      }
      if (sectionId && !sectionIds.has(sectionId)) {
        out.error('section.unknown', `${path}.sectionId`,
          `Section "${sectionId}" is not declared.`,
          'Declare the section or correct this card’s sectionId.');
      } else if (sectionId) {
        card.sectionId = sectionId;
        const section = sections.find((candidate) => candidate.sectionId === sectionId);
        if (section) section.cardCount++;
      }
      cards.push(card);
    }
  }

  if (declaredSections) {
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].cardCount === 0) {
        out.error('section.empty', `$.sections[${i}]`,
          `Section "${sections[i].sectionId || i}" contains no cards.`,
          'Remove the section or place at least one card in it.');
      }
    }
  }

  if (source.groups !== undefined && !Array.isArray(source.groups)) {
    out.error('field.invalid_type', '$.groups', 'groups must be a list.',
      'Use a list of group objects or omit groups.');
  }
  const groups = [];
  const groupIds = new Set();
  const groupedSections = new Set();
  if (Array.isArray(source.groups)) {
    for (let i = 0; i < source.groups.length; i++) {
      const raw = source.groups[i];
      const path = `$.groups[${i}]`;
      if (!isObject(raw)) {
        out.error('field.invalid_type', path, 'A group must be an object.',
          'Use a group object with groupId, title, and sectionIds.');
        continue;
      }
      unknownFields(raw, GROUP_FIELDS, path, out);
      const idOk = validId(raw.groupId, `${path}.groupId`, 'course.invalid_id', out);
      requiredTitle(raw.title, `${path}.title`, out);
      if (idOk && groupIds.has(raw.groupId)) {
        out.error('group.duplicate_id', `${path}.groupId`,
          `Group ID "${raw.groupId}" is repeated.`,
          'Give every group one unique stable ID.');
      }
      if (idOk) groupIds.add(raw.groupId);
      if (!Array.isArray(raw.sectionIds) || raw.sectionIds.length < 1) {
        out.error('field.invalid_type', `${path}.sectionIds`,
          'sectionIds must be a non-empty list.',
          'List every section in this group.');
        groups.push({ ...raw, sectionIds: [], cardCount: 0 });
        continue;
      }
      const local = new Set();
      let cardCount = 0;
      for (let j = 0; j < raw.sectionIds.length; j++) {
        const sectionId = raw.sectionIds[j];
        const memberPath = `${path}.sectionIds[${j}]`;
        if (!validId(sectionId, memberPath, 'course.invalid_id', out)) continue;
        if (!sectionIds.has(sectionId)) {
          out.error('group.unknown_section', memberPath,
            `Section "${sectionId}" is not declared.`,
            'Remove it or declare that section.');
          continue;
        }
        if (local.has(sectionId) || groupedSections.has(sectionId)) {
          out.error('group.duplicate_section', memberPath,
            `Section "${sectionId}" occurs more than once in groups.`,
            'Keep each declared section in exactly one group.');
        }
        local.add(sectionId);
        groupedSections.add(sectionId);
        cardCount += sections.find((section) => section.sectionId === sectionId)?.cardCount || 0;
      }
      groups.push({ ...raw, cardCount });
    }
  }
  if (groups.length) {
    for (const section of sections) {
      if (!groupedSections.has(section.sectionId)) {
        out.error('group.ungrouped_section', '$.groups',
          `Section "${section.sectionId}" is not in any group.`,
          'Place every declared section in exactly one group.');
      }
    }
  }

  const course = {
    ...source,
    sections,
    groups,
    cards,
    cardCount: cards.length,
  };
  course.buildFingerprint = fingerprint(course);
  const failed = out.diagnostics.some((diagnostic) => diagnostic.severity === 'error');
  return {
    course: failed ? null : course,
    diagnostics: out.diagnostics,
    sourceFormat: 'course-v2',
    contentRepresentation: 'authored-commonmark',
  };
}

/**
 * @param {unknown} input already-parsed JSON/YAML data
 * @param {{courseId?: string}} [options] legacy identity context
 */
export function readCourse(input, options = {}) {
  const sourceFormat = detectCourseFormat(input);
  let hasDescriptiveIdentity = false;
  let hasExplicitLegacyMarker = false;
  try {
    if (isObject(input)) {
      hasDescriptiveIdentity = !!Object.getOwnPropertyDescriptor(input, 'courseId');
      const format = Object.getOwnPropertyDescriptor(input, 'format');
      hasExplicitLegacyMarker = !!format && Object.hasOwn(format, 'value') && format.value === 1;
    }
  } catch { /* hostile values are handled below */ }
  // An unversioned descriptive object that declares sections can otherwise
  // resemble the original unmarked cards.json shape. A public courseId is the
  // disambiguator; missing schemaVersion must be reported, never read as v1.
  if (sourceFormat === 'legacy-v1'
      && (hasExplicitLegacyMarker || !hasDescriptiveIdentity)) {
    const result = normalizeLegacyCourse(input, options);
    return {
      ...result,
      diagnostics: result.diagnostics.map(({ docs, ...diagnostic }) => ({
        ...diagnostic,
        docsUrl: diagnostic.docsUrl || docs,
      })),
      contentRepresentation: 'sanitized-html',
    };
  }
  if (sourceFormat === 'course-v2') return normalizeV2(input);

  const out = diagnosticsCollector();
  let rootIsObject = false;
  try { rootIsObject = isObject(input); } catch { /* revoked proxy */ }
  if (!rootIsObject) {
    out.error('course.not_object', '$', 'The course root is not an object.',
      'Provide one parsed course mapping.');
  } else {
    out.error('course.unsupported_schema_version', '$.schemaVersion',
      'schemaVersion is missing or unsupported.',
      'Use schemaVersion: 2, or a deployed compact format-1 course.');
  }
  return {
    course: null,
    diagnostics: out.diagnostics,
    sourceFormat,
    contentRepresentation: 'unknown',
  };
}
