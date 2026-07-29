/* Contract-only JSON Schema fixture gate.
 *
 * Production YAML parsing/semantic validation belongs to later phases. This
 * small evaluator covers only the standard JSON Schema keywords used by
 * schema/course-v2.schema.json, so Phase 0 examples cannot drift while the
 * runtime dependency is still being chosen.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_DIR = path.join(ROOT, 'schema');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const schema = readJson(path.join(SCHEMA_DIR, 'course-v2.schema.json'));
const failures = [];
let passed = 0;

function resolveRef(ref) {
  assert.match(ref, /^#\//, `only local schema refs are allowed: ${ref}`);
  return ref.slice(2).split('/').reduce((value, part) => value[part.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
}

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const kind = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
};

function validate(value, rule, at = '$') {
  if (rule === true) return [];
  if (rule === false) return [`${at}: forbidden`];
  if (rule.$ref) return validate(value, resolveRef(rule.$ref), at);

  const errors = [];
  if (rule.const !== undefined && !equal(value, rule.const)) errors.push(`${at}: not the constant value`);
  if (rule.enum && !rule.enum.some((item) => equal(value, item))) errors.push(`${at}: not in enum`);

  if (rule.type) {
    const types = Array.isArray(rule.type) ? rule.type : [rule.type];
    const actual = kind(value);
    const compatible = types.includes(actual) || (actual === 'integer' && types.includes('number'));
    if (!compatible) return errors.concat(`${at}: expected ${types.join('|')}, got ${actual}`);
  }

  if (rule.allOf) {
    for (const child of rule.allOf) errors.push(...validate(value, child, at));
  }
  if (rule.anyOf && !rule.anyOf.some((child) => validate(value, child, at).length === 0)) {
    errors.push(`${at}: no anyOf branch matched`);
  }
  if (rule.oneOf && rule.oneOf.filter((child) => validate(value, child, at).length === 0).length !== 1) {
    errors.push(`${at}: expected exactly one oneOf match`);
  }
  if (rule.not && validate(value, rule.not, at).length === 0) errors.push(`${at}: matched forbidden schema`);

  if (typeof value === 'string') {
    const length = [...value].length;
    if (rule.minLength !== undefined && length < rule.minLength) errors.push(`${at}: shorter than ${rule.minLength}`);
    if (rule.maxLength !== undefined && length > rule.maxLength) errors.push(`${at}: longer than ${rule.maxLength}`);
    if (rule.pattern !== undefined && !(new RegExp(rule.pattern, 'u')).test(value)) {
      errors.push(`${at}: does not match ${rule.pattern}`);
    }
  }

  if (typeof value === 'number') {
    if (rule.minimum !== undefined && value < rule.minimum) errors.push(`${at}: below minimum`);
    if (rule.maximum !== undefined && value > rule.maximum) errors.push(`${at}: above maximum`);
    if (rule.exclusiveMinimum !== undefined && value <= rule.exclusiveMinimum) errors.push(`${at}: below exclusive minimum`);
    if (rule.exclusiveMaximum !== undefined && value >= rule.exclusiveMaximum) errors.push(`${at}: above exclusive maximum`);
  }

  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < rule.minItems) errors.push(`${at}: too few items`);
    if (rule.maxItems !== undefined && value.length > rule.maxItems) errors.push(`${at}: too many items`);
    if (rule.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) {
      errors.push(`${at}: duplicate items`);
    }
    if (rule.items) value.forEach((item, index) => errors.push(...validate(item, rule.items, `${at}[${index}]`)));
    if (rule.contains && !value.some((item, index) => validate(item, rule.contains, `${at}[${index}]`).length === 0)) {
      errors.push(`${at}: no item matched contains`);
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (rule.minProperties !== undefined && keys.length < rule.minProperties) errors.push(`${at}: too few properties`);
    if (rule.maxProperties !== undefined && keys.length > rule.maxProperties) errors.push(`${at}: too many properties`);
    for (const required of rule.required || []) {
      if (!Object.hasOwn(value, required)) errors.push(`${at}: missing ${required}`);
    }
    for (const key of keys) {
      if (rule.propertyNames) errors.push(...validate(key, rule.propertyNames, `${at} key ${JSON.stringify(key)}`));
      let matched = false;
      if (rule.properties && Object.hasOwn(rule.properties, key)) {
        matched = true;
        errors.push(...validate(value[key], rule.properties[key], `${at}.${key}`));
      }
      for (const [pattern, child] of Object.entries(rule.patternProperties || {})) {
        if (new RegExp(pattern, 'u').test(key)) {
          matched = true;
          errors.push(...validate(value[key], child, `${at}.${key}`));
        }
      }
      if (!matched && rule.additionalProperties === false) errors.push(`${at}: unknown property ${key}`);
      else if (!matched && rule.additionalProperties && typeof rule.additionalProperties === 'object') {
        errors.push(...validate(value[key], rule.additionalProperties, `${at}.${key}`));
      }
    }
  }

  return errors;
}

function check(condition, label, detail = '') {
  if (condition) {
    passed++;
    process.stdout.write(`PASS  ${label}\n`);
  } else {
    failures.push(`${label}${detail ? `\n      ${detail}` : ''}`);
    process.stdout.write(`FAIL  ${label}\n`);
  }
}

assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
assert.equal(schema.$id, 'https://docs.keepclub.app/schema/course-v2.schema.json');
for (const pattern of JSON.stringify(schema).matchAll(/"pattern":"((?:\\.|[^"])*)"/g)) {
  // JSON.parse turns the captured JSON string back into the exact regex.
  assert.doesNotThrow(() => new RegExp(JSON.parse(`"${pattern[1]}"`), 'u'));
}

const validDir = path.join(SCHEMA_DIR, 'fixtures', 'valid');
for (const name of fs.readdirSync(validDir).filter((name) => name.endsWith('.json')).sort()) {
  const errors = validate(readJson(path.join(validDir, name)), schema);
  check(errors.length === 0, `valid fixture ${name}`, errors.slice(0, 4).join('; '));
}

const invalidDir = path.join(SCHEMA_DIR, 'fixtures', 'invalid');
const diagnosticDocs = fs.readFileSync(path.join(SCHEMA_DIR, 'diagnostics.md'), 'utf8');
for (const name of fs.readdirSync(invalidDir).filter((name) => name.endsWith('.json')).sort()) {
  const fixture = readJson(path.join(invalidDir, name));
  if (fixture.schemaValid !== undefined) {
    const errors = validate(fixture.course, schema);
    check((errors.length === 0) === fixture.schemaValid, `schema expectation ${name}`, errors.slice(0, 4).join('; '));
  }
  for (const code of fixture.expectedDiagnostics || []) {
    check(diagnosticDocs.includes(`\`${code}\``), `${name} documents ${code}`);
  }
}

const forbiddenCompactFields = new Set(['i', 's', 'q', 'a', 'm', 'd', 'f', 'r', 'k', 't', 'n', 'o']);
const publicPropertyNames = new Set();
function collectProperties(rule) {
  for (const name of Object.keys(rule.properties || {})) publicPropertyNames.add(name);
  for (const value of Object.values(rule)) {
    if (value && typeof value === 'object') collectProperties(value);
  }
}
collectProperties(schema);
for (const field of forbiddenCompactFields) {
  check(!publicPropertyNames.has(field), `public schema excludes compact field ${field}`);
}

const limits = readJson(path.join(invalidDir, 'limits.json')).limits;
check(schema.properties.cards.maxItems === limits.cards, 'card limit agrees with fixture');
check(schema.properties.sections.maxItems === limits.sections, 'section limit agrees with fixture');
check(schema.properties.groups.maxItems === limits.groups, 'group limit agrees with fixture');
check(schema.$defs.card.properties.tags.maxItems === limits.tagsPerCard, 'tag limit agrees with fixture');
check(schema.$defs.card.properties.media.maxItems === limits.mediaPerCard, 'per-card media limit agrees with fixture');
check(schema.$defs.markdown.maxLength === limits.markdownCodePoints, 'Markdown limit agrees with fixture');
for (const source of [
  'https:remote.png', 'data:image.png', 'mailto:asset.png',
  '../up.png', 'a//b.png', 'a\\b.png', 'a/%2e%2e/b.png',
]) {
  check(validate(source, schema.$defs.assetPath).length > 0,
    `asset-path schema rejects ${source}`);
}

if (failures.length) {
  process.stderr.write(`\n${failures.length} course schema contract failure(s):\n- ${failures.join('\n- ')}\n`);
  process.exit(1);
}
process.stdout.write(`\n${passed} course schema contract checks passed\n`);
