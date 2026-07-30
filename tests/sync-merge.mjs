/* The progress merge, proved without a server.
 *
 * A bad merge can silently destroy reviews from a device the learner is not
 * looking at. These checks assert the algebra the transport depends on:
 * commutative, idempotent, and never decreasing review history.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

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
    bestClean: 0,
    ach: {},
    notes: {},
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
    bestClean: 18,
    ach: { first: 200 },
    settings: { newPerDay: 5, maxRev: 120, fontSize: 'large', at: 900 },
  });
  const laptop = state({
    recs: { a: rec({ rp: 3, ivl: 8, due: 900 }), c: rec({ rp: 5 }) },
    days: { '2026-07-28': 9, '2026-07-29': 2 },
    lastDay: '2026-07-29',
    streak: 2,
    answers: 11,
    revTotal: 9,
    revGood: 9,
    bestClean: 42,
    ach: { first: 100, week: 500 },
    settings: { newPerDay: 40, maxRev: 80, fontSize: 'default', at: 100 },
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
  ok(merged.bestClean === 42, 'the best clean run survives device merges');
  ok(merged.ach.first === 100 && merged.ach.week === 500,
    'milestones retain their earliest unlock');
  ok(merged.settings.newPerDay === 5,
    'the most recently changed settings block wins as a block');
  // Text size is in the block rather than beside it, so it crosses with the
  // rest of it and nothing in the merge has to know the field exists.
  ok(merged.settings.fontSize === 'large',
    'the text size travels with the settings block it belongs to');

  let repeated = merged;
  for (let i = 0; i < 25; i++) {
    repeated = mergeState(repeated, i % 2 ? phone : laptop);
  }
  ok(same(repeated, merged), '25 repeated rounds introduce no drift');
}

{
  const lapsed = rec({ rp: 6, lp: 1, st: 'l', due: 100, ivl: 8 });
  const easy = rec({ rp: 6, lp: 0, st: 'r', due: 900, ivl: 30 });
  const merged = mergeState(state({ recs: { a: lapsed } }),
    state({ recs: { a: easy } }));
  ok(merged.recs.a.lp === 1 && merged.recs.a.due === 100,
    'an equal-review conflict keeps the lapse and the conservative schedule');
}

{
  const earlierReview = state({
    recs: { a: rec({ rp: 10, lp: 0, st: 'r', due: 100, ivl: 30 }) },
  });
  const olderLapses = state({
    recs: { a: rec({ rp: 9, lp: 5, st: 'r', due: 900, ivl: 8 }) },
  });
  const newestReview = state({
    recs: { a: rec({ rp: 10, lp: 3, st: 'r', due: 50, ivl: 20 }) },
  });
  const left = mergeState(mergeState(earlierReview, olderLapses), newestReview);
  const right = mergeState(earlierReview, mergeState(olderLapses, newestReview));
  ok(same(left, right) && left.recs.a.due === 50 && left.recs.a.lp === 5,
    'card scheduling merge is associative across three devices');
}

{
  const oldDate = state({
    settings: { newPerDay: 20, maxRev: 120, examDate: '2026-08-01', at: 100 },
  });
  const cleared = state({
    settings: { newPerDay: 20, maxRev: 120, examDate: '', at: 200 },
  });
  const later = state({
    settings: { newPerDay: 30, maxRev: 120, examDate: '', at: 300 },
  });
  const merged = mergeState(oldDate, cleared);
  ok(merged.settings.examDate === '',
    'a newer explicit exam-date clear is not resurrected');
  ok(same(mergeState(mergeState(oldDate, cleared), later),
    mergeState(oldDate, mergeState(cleared, later))),
  'settings merge is associative across three devices');
}

{
  const long = {};
  for (let i = 0; i < 450; i++) {
    const date = new Date(2026, 0, 1 + i).toISOString().slice(0, 10);
    long[date] = 2;
  }
  const merged = mergeState(state({ days: long }), state());
  ok(Object.keys(merged.days).length === 400,
    'long histories retain enough calendar evidence for a one-year club streak');
}

/* Notes are a set of separately-stamped records, not one last-write-wins block:
 * two devices that both wrote something between syncs must both keep it. */
{
  const note = (overrides = {}) =>
    Object.assign({ at: 100, ed: 100, text: 'a note' }, overrides);
  const phone = state({
    notes: { aa: note({ text: 'written on the phone' }), bb: note({ at: 50, ed: 50 }) },
  });
  const laptop = state({
    notes: { cc: note(), bb: note({ at: 50, ed: 400, text: 'fixed on the laptop' }) },
  });
  const merged = mergeState(phone, laptop);
  ok(same(merged, mergeState(laptop, phone)), 'the note merge is commutative');
  ok(same(merged, mergeState(merged, phone)) && same(merged, mergeState(merged, laptop)),
    'merging the same notes again changes nothing');
  ok(Object.keys(merged.notes).sort().join() === 'aa,bb,cc',
    'a note written on one device only is kept');
  ok(merged.notes.bb.text === 'fixed on the laptop' && merged.notes.bb.at === 50,
    'the later edit of a note wins while it keeps the moment it was written');
}

{
  const written = state({ notes: { aa: { at: 100, ed: 100, text: 'the note' } } });
  const deleted = state({ notes: { aa: { at: 100, ed: 500, text: '' } } });
  const merged = mergeState(written, deleted);
  ok(merged.notes.aa.text === '',
    'a deleted note is not resurrected by the device that still has it');
  ok(same(merged, mergeState(deleted, written)) && same(merged, mergeState(merged, written)),
    'the delete marker survives repeated merges in either order');
  const again = state({ notes: { aa: { at: 100, ed: 900, text: 'written again' } } });
  ok(mergeState(merged, again).notes.aa.text === 'written again',
    'a note written again after a delete is not held down by the marker');
  const third = state({ notes: { aa: { at: 100, ed: 700, text: 'from a third device' } } });
  ok(same(mergeState(mergeState(written, deleted), third),
    mergeState(written, mergeState(deleted, third))),
  'the note merge is associative across three devices');
}

{
  const many = {};
  for (let i = 0; i < 300; i++) many['x' + i.toString(36)] = { at: i, ed: i, text: '' };
  for (let i = 0; i < 250; i++) {
    many['n' + i.toString(36)] = { at: i, ed: i, text: 'kept ' + i };
  }
  const merged = mergeState(state({ notes: many }), state());
  const kept = Object.values(merged.notes);
  ok(kept.length === 400 && kept.filter((value) => value.text).length === 250,
    'an over-long note set is capped, and delete markers go before anyone\'s words');
}

{
  // An own "__proto__" key only exists in JSON, which is exactly where a synced
  // blob comes from. Written as an object literal it would set a prototype and
  // prove nothing.
  const hostile = JSON.parse('{"__proto__":{"at":1,"ed":1,"text":"x"},'
    + '"Upper":{"at":1,"ed":1,"text":"y"},"ok1":{"at":1,"ed":1,"text":"z"}}');
  const merged = mergeState(state({ notes: hostile }), state());
  ok(Object.keys(merged.notes).join() === 'ok1'
      && Object.getPrototypeOf(merged.notes) === Object.prototype,
  'a note id that is not an id this app writes never becomes an object key');
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

{
  storage.clear();
  S.init({ app: 'day-skipper', supported: true });
  const setItem = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('storage blocked'); };
  ok(S.turnOn('0123456789ABCDEFGHJKMNPQR') === null && !S.enabled(),
    'Sync does not claim to turn on when its identity cannot be stored');
  localStorage.setItem = setItem;

  S.turnOn('0123456789ABCDEFGHJKMNPQR');
  const removeItem = localStorage.removeItem;
  localStorage.removeItem = () => {};
  ok(S.turnOff() === false && S.enabled(),
    'Sync does not claim to turn off when its stored identity remains');
  localStorage.removeItem = removeItem;
  S.turnOff();
}

{
  storage.clear();
  let adopted = false;
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    calls++;
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError')), { once: true });
    });
  };
  S.init({
    app: 'day-skipper',
    supported: true,
    sanitise: (value) => value,
    onMerged: () => { adopted = true; },
  });
  S.turnOn('0123456789ABCDEFGHJKMNPQR');
  const inFlight = S.sync(state());
  await new Promise((resolve) => setTimeout(resolve, 0));
  const off = S.turnOff();
  await inFlight;
  ok(off && !S.enabled() && localStorage.getItem(S.KEY) === null,
    'turning Sync off during a request cannot restore the old identity');
  ok(!adopted && calls === 1,
    'turning Sync off aborts the old transport before it uploads or merges');
  globalThis.fetch = originalFetch;
}

{
  storage.clear();
  const originalFetch = globalThis.fetch;
  const local = state({ recs: { phone: rec({ rp: 2 }) } });
  const remote = state({ recs: { laptop: rec({ rp: 3 }) } });
  const calls = [];
  let puts = 0;
  const reply = (value, status = 200) => Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(value),
  });
  globalThis.fetch = (url, options) => {
    const fn = url.split('/').pop();
    calls.push(fn);
    if (fn === 'sync_get') return reply([]);
    puts++;
    if (puts === 1) {
      return reply({ code: '23505', message: 'duplicate key value' }, 409);
    }
    if (puts === 2) {
      return reply([{ ok: false, rev: 1, data: remote }]);
    }
    return reply([{ ok: true, rev: 2, data: JSON.parse(options.body).p_data }]);
  };
  let adopted = null;
  S.init({
    app: 'day-skipper',
    supported: true,
    sanitise: (value) => value,
    onMerged: (value) => { adopted = value; },
  });
  S.turnOn('0123456789ABCDEFGHJKMNPQR');
  const merged = await S.sync(local);
  ok(calls.join(',') === 'sync_get,sync_put,sync_put,sync_put',
    'a concurrent first-write collision retries through the revision conflict');
  ok(merged.recs.phone && merged.recs.laptop && same(merged, adopted),
    'the first-write retry retains progress from both devices');
  S.turnOff();
  globalThis.fetch = originalFetch;
}

console.log([...passed, ...failed].join('\n'));
console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
