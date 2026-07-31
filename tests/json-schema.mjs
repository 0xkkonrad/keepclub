/* The small JSON Schema evaluator the fixture gate has always used, lifted out
 * of it so that a second suite can hold a document to the same schema.
 *
 * It covers only the standard keywords schema/course-v2.schema.json actually
 * uses. That is the point of it: the shipped schema is the contract creators
 * are handed, and anything this app writes has to satisfy it as well as satisfy
 * the reader — the two are meant to say the same thing, and a document that
 * passes one and fails the other is a bug wherever it is.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const courseSchema = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'schema', 'course-v2.schema.json'), 'utf8'));

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const kind = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
};

/** Every way `value` fails `rule`, as strings. Empty means it validates. */
export function validate(value, rule, at = '$', schema = courseSchema) {
  if (rule === true) return [];
  if (rule === false) return [`${at}: forbidden`];
  if (rule.$ref) {
    assert.match(rule.$ref, /^#\//, `only local schema refs are allowed: ${rule.$ref}`);
    const target = rule.$ref.slice(2).split('/').reduce(
      (node, part) => node[part.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
    return validate(value, target, at, schema);
  }

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
    for (const child of rule.allOf) errors.push(...validate(value, child, at, schema));
  }
  if (rule.anyOf && !rule.anyOf.some((child) => validate(value, child, at, schema).length === 0)) {
    errors.push(`${at}: no anyOf branch matched`);
  }
  if (rule.oneOf && rule.oneOf.filter((child) => validate(value, child, at, schema).length === 0).length !== 1) {
    errors.push(`${at}: expected exactly one oneOf match`);
  }
  if (rule.not && validate(value, rule.not, at, schema).length === 0) errors.push(`${at}: matched forbidden schema`);

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
    if (rule.items) value.forEach((item, index) => errors.push(...validate(item, rule.items, `${at}[${index}]`, schema)));
    if (rule.contains && !value.some((item, index) => validate(item, rule.contains, `${at}[${index}]`, schema).length === 0)) {
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
      if (rule.propertyNames) errors.push(...validate(key, rule.propertyNames, `${at} key ${JSON.stringify(key)}`, schema));
      let matched = false;
      if (rule.properties && Object.hasOwn(rule.properties, key)) {
        matched = true;
        errors.push(...validate(value[key], rule.properties[key], `${at}.${key}`, schema));
      }
      for (const [pattern, child] of Object.entries(rule.patternProperties || {})) {
        if (new RegExp(pattern, 'u').test(key)) {
          matched = true;
          errors.push(...validate(value[key], child, `${at}.${key}`, schema));
        }
      }
      if (!matched && rule.additionalProperties === false) errors.push(`${at}: unknown property ${key}`);
      else if (!matched && rule.additionalProperties && typeof rule.additionalProperties === 'object') {
        errors.push(...validate(value[key], rule.additionalProperties, `${at}.${key}`, schema));
      }
    }
  }

  return errors;
}
