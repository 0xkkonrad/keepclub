/* The progress merge, proved without a server.
 *
 * A bad merge can silently destroy reviews from a device the learner is not
 * looking at. These checks assert the algebra the transport depends on:
 * commutative, idempotent, and never decreasing review history.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
new Function(fs.readFileSync(path.join(HERE, '..', 'web', 'sync.js'), 'utf8'))
  .call(globalThis);

const S = globalThis.DSSync;
const { mergeState, stable, normaliseKey, formatKey, hashKey } = S;
const passed = [];
const failed = [];
const ok = (condition, message) =>
  (condition ? passed : failed).push((condition ? 'PASS  ' : 'FAIL  ') + message);
const same = (a, b) => stable(a) === stable(b);

function state(overrides = {}) {
  return Object.assign({
    v: 1,
    recs: {},
    day: '2026-07-29',
    newDone: 0,
    revDone: 0,
    streak: 0,
    lastDay: null,
    days: {},
    revTotal: 0,
    revGood: 0,
    answers: 0,
    ach: {},
    settings: {
      newPerDay: 20,
      maxRev: 120,
      shuffle: true,
      examDate: '',
      examSkipped: false,
      at: 0,
    },
  }, overrides);
}

const rec = (overrides = {}) => Object.assign({
  st: 'r',
  step: 0,
  ivl: 4,
  ea: 2.5,
  due: 100,
  rp: 1,
  lp: 0,
  pv: 0,
}, overrides);

{
  const phone = state({
    recs: { a: rec({ rp: 8, ivl: 30, due: 300 }), b: rec({ rp: 1 }) },
    days: { '2026-07-27': 12, '2026-07-29': 4 },
    lastDay: '2026-07-29',
    streak: 1,
    answers: 16,
    revTotal: 12,
    revGood: 10,
    ach: { first: 200 },
    settings: { newPerDay: 5, maxRev: 120, at: 900 },
  });
  const laptop = state({
    recs: { a: rec({ rp: 3, ivl: 8, due: 900 }), c: rec({ rp: 5 }) },
    days: { '2026-07-28': 9, '2026-07-29': 2 },
    lastDay: '2026-07-29',
    streak: 2,
    answers: 11,
    revTotal: 9,
    revGood: 9,
    ach: { first: 100, week: 500 },
    settings: { newPerDay: 40, maxRev: 80, at: 100 },
  });

  const merged = mergeState(phone, laptop);
  ok(same(merged, mergeState(laptop, phone)), 'merge is commutative');
  ok(same(merged, mergeState(merged, phone)), 'merging the phone twice changes nothing');
  ok(same(merged, mergeState(merged, laptop)), 'merging the laptop twice changes nothing');
  ok(merged.recs.a.rp === 8 && merged.recs.a.ivl === 30,
    'the whole card record with more reviews wins');
  ok(Object.keys(merged.recs).sort().join() === 'a,b,c',
    'cards seen on only one device are retained');
  ok(merged.days['2026-07-29'] === 4,
    'same-day counts take the maximum rather than inflating');
  ok(merged.streak === 3, 'a streak split across devices is reconstructed');
  ok(merged.answers >= phone.answers && merged.answers >= laptop.answers,
    'the lifetime answer count never goes backwards');
  ok(merged.ach.first === 100 && merged.ach.week === 500,
    'milestones retain their earliest unlock');
  ok(merged.settings.newPerDay === 5,
    'the most recently changed settings block wins as a block');

  let repeated = merged;
  for (let i = 0; i < 25; i++) {
    repeated = mergeState(repeated, i % 2 ? phone : laptop);
  }
  ok(same(repeated, merged), '25 repeated rounds introduce no drift');
}

{
  const long = {};
  for (let i = 0; i < 150; i++) {
    const date = new Date(2026, 0, 1 + i).toISOString().slice(0, 10);
    long[date] = 2;
  }
  const merged = mergeState(state({ days: long }), state());
  ok(Object.keys(merged.days).length === 90, 'long histories prune to 90 retained days');
}

{
  const key = S.makeKey();
  ok(key.length === S.KEY_CHARS, `generated keys contain ${S.KEY_CHARS} characters`);
  ok(normaliseKey(formatKey(key).toLowerCase()) === key,
    'display dashes and lower case normalise back to the same key');
  ok(normaliseKey(key.slice(1)) === null, 'a short key is refused');
  const hash = await hashKey(key);
  ok(/^[0-9a-f]{64}$/.test(hash), 'only a lower-case SHA-256 hash is sent');
  ok(hash === await hashKey(key), 'the same key hashes consistently');
}

console.log([...passed, ...failed].join('\n'));
console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
