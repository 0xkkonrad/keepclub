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
    cards: {},
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
  const newerLapseEpoch = state({
    recs: { a: rec({ rp: 9, lp: 5, st: 'r', due: 900, ivl: 8 }) },
  });
  const newestReview = state({
    recs: { a: rec({ rp: 10, lp: 3, st: 'r', due: 50, ivl: 20 }) },
  });
  const left = mergeState(mergeState(earlierReview, newerLapseEpoch), newestReview);
  const right = mergeState(earlierReview, mergeState(newerLapseEpoch, newestReview));
  ok(same(left, right) && left.recs.a.due === 900 && left.recs.a.lp === 5
      && left.recs.a.rp === 10 && left.recs.a.sr === 9,
    'card scheduling merge is associative and keeps the newest lapse epoch');
}

/* `pv` is the uncapped interval a review has proved. Released clients wrote
 * zero there, so a review card's ivl is its legacy proof. Proof is monotonic
 * only within one lapse epoch: a later lapse deliberately starts lower. */
{
  const legacy = rec({ rp: 14, lp: 2, st: 'r', ivl: 6, pv: 0, due: 200 });
  const proved = rec({ rp: 14, lp: 2, st: 'r', ivl: 6, pv: 38, due: 200 });
  const forward = S.pickRec(legacy, proved);
  const reverse = S.pickRec(proved, legacy);
  ok(forward.pv === 38 && same(forward, reverse),
    'same-epoch sync keeps new proof when the other client still writes pv=0');
  ok(same(S.pickRec(forward, legacy), forward)
      && same(S.pickRec(forward, forward), forward),
  'the upgraded proof is idempotent under repeated legacy and self merges');

  const oldEpoch = rec({ rp: 20, lp: 2, st: 'r', ivl: 6, pv: 55, due: 300 });
  const lapsedAgain = rec({ rp: 21, lp: 3, st: 'l', ivl: 1, pv: 9, due: 100 });
  const demoted = S.pickRec(oldEpoch, lapsedAgain);
  ok(demoted.lp === 3 && demoted.pv === 9 && demoted.st === 'l',
    'a higher lapse epoch demotes proof instead of inheriting an older high-water mark');
}

{
  const oldEpoch = rec({ rp: 10, lp: 1, st: 'r', ivl: 6, pv: 70, due: 300 });
  const relearning = rec({ rp: 10, lp: 2, st: 'l', ivl: 2, pv: 12, due: 100 });
  const legacyReview = rec({ rp: 10, lp: 2, st: 'r', ivl: 25, pv: 0, due: 200 });
  const records = [oldEpoch, relearning, legacyReview];
  const permutations = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2],
    [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  const merged = permutations.map((order) => order
    .map((index) => records[index])
    .reduce((left, right) => S.pickRec(left, right)));
  const regrouped = [
    S.pickRec(S.pickRec(oldEpoch, relearning), legacyReview),
    S.pickRec(oldEpoch, S.pickRec(relearning, legacyReview)),
    S.pickRec(S.pickRec(oldEpoch, legacyReview), relearning),
  ];
  ok(merged.every((value) => same(value, merged[0]))
      && regrouped.every((value) => same(value, merged[0])),
  'proof merge is commutative and associative across every three-device permutation');
  ok(merged[0].st === 'l' && merged[0].due === 100
      && merged[0].lp === 2 && merged[0].pv === 25,
  'the existing schedule winner survives while newest-epoch proof takes its maximum');

  const upgradedLegacy = S.pickRec(legacyReview, null);
  ok(upgradedLegacy.pv === 25
      && same(S.pickRec(upgradedLegacy, null), upgradedLegacy),
  'a lone legacy review upgrades from ivl once and is then idempotent');
}

{
  const lowerSchedule = rec({ rp: 7, lp: 4, pv: 90, step: 1, due: 500 });
  const higherSchedule = rec({ rp: 7, lp: 4, pv: 10, step: 2, due: 500 });
  const merged = S.pickRec(lowerSchedule, higherSchedule);
  ok(merged.step === 1 && merged.pv === 90,
    'derived pv is blanked for stable schedule ties, then restored as proof');
}

/* Schedule provenance is separate from the aggregate answer-history floor.
 * Otherwise a high-rp branch from before the newest lapse steals that lapse's
 * learning stage, then the derived lp makes the bad record look current. */
{
  const olderReview = rec({
    st: 'r', step: 0, ivl: 90, due: 999999, rp: 20, lp: 1, pv: 90,
  });
  const newerLapse = rec({
    st: 'l', step: 1, ivl: 1, due: 100, rp: 19, lp: 2, pv: 12,
  });
  const forward = S.pickRec(olderReview, newerLapse);
  const reverse = S.pickRec(newerLapse, olderReview);
  ok(same(forward, reverse) && forward.st === 'l' && forward.step === 1
      && forward.ivl === 1 && forward.due === 100 && forward.lp === 2
      && forward.pv === 12 && forward.rp === 20 && forward.sr === 19,
    'a newer lapse keeps its learning schedule while older history keeps its count');
}

/* A canonical zero proof cannot be mistaken for a legacy review interval on a
 * later merge. That distinction is what closes the old grouping-order hole. */
{
  const legacy = rec({ st: 'r', ivl: 30, rp: 7, lp: 2, pv: 0 });
  const canonicalZero = rec({ st: 'r', ivl: 30, rp: 7, sr: 7, lp: 2, pv: 0 });
  const migrated = S.pickRec(legacy, null);
  const retained = S.pickRec(canonicalZero, null);
  ok(migrated.pv === 30 && migrated.sr === 7,
    'a genuine legacy review migrates zero proof from its surviving interval');
  ok(retained.pv === 0 && retained.sr === 7,
    'a canonical review keeps an explicit zero proof instead of inventing 30 days');

  const a = rec({ st: 'r', ivl: 1, due: 300, rp: 2, sr: 2, lp: 2, pv: 1 });
  const b = rec({ st: 'r', ivl: 30, due: 900, rp: 2, sr: 2, lp: 0, pv: 30 });
  const c = rec({ st: 'l', step: 1, ivl: 0, due: 100, rp: 2, sr: 2, lp: 2, pv: 0 });
  const records = [a, b, c];
  const permutations = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2],
    [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  const outputs = permutations.map((order) => order
    .map((index) => records[index])
    .reduce((left, right) => S.pickRec(left, right)));
  const grouped = [
    S.pickRec(S.pickRec(a, b), c),
    S.pickRec(a, S.pickRec(b, c)),
    S.pickRec(S.pickRec(a, c), b),
  ];
  ok(outputs.concat(grouped).every((value) => same(value, outputs[0]))
      && outputs[0].st === 'l' && outputs[0].due === 100
      && outputs[0].rp === 2 && outputs[0].sr === 2
      && outputs[0].lp === 2 && outputs[0].pv === 1,
    'the canonical zero-proof vector converges across every order and grouping');
}

{
  const valid = rec({
    st: 'r', ivl: 30, due: 900, rp: 10, sr: 10, lp: 2, pv: 30,
  });
  const impossible = rec({
    st: 'l', step: 1, ivl: 1, due: 100, rp: 0, sr: 0, lp: 999999, pv: 0,
  });
  const merged = S.pickRec(valid, impossible);
  ok(S.pickRec(impossible, null).lp === 0
      && merged.lp === 2 && merged.st === 'r' && merged.pv === 30,
  'an impossible lapse count is bounded by its causal schedule revision');

  const malformed = [null, false, '', '8', 'not-a-number'].map((sr) => S.pickRec(rec({
    st: 'r', ivl: 30, rp: 8, sr, lp: 2, pv: 0,
  }), null));
  ok(malformed.every((migrated) => migrated.sr === 8
      && migrated.lp === 2 && migrated.pv === 30),
  'coercible and nonnumeric sr presence cannot suppress a legacy review interval');
}

/* Deterministic property sweep over canonical production-shaped records. The
 * seed and first bad triple are included in the failure so a fuzz result is a
 * regression vector, not a ghost. */
{
  const seed = 0x5eedc0de;
  let randomState = seed;
  const random = () => {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    return randomState >>> 0;
  };
  const values = [0, 1, 20, 21, 30, 90];
  const generated = () => {
    const rp = random() % 16;
    const sr = random() % (rp + 1);
    const lp = random() % (sr + 1);
    const st = random() % 3 === 0 ? 'l' : 'r';
    return rec({
      st,
      step: random() % 3,
      ivl: values[random() % values.length],
      ea: 1.3 + (random() % 16) / 10,
      due: random() % 100000,
      rp,
      sr,
      lp,
      pv: values[random() % values.length],
    });
  };
  const schedule = (record) => stable({
    st: record.st, step: record.step, ivl: record.ivl,
    ea: record.ea, due: record.due, sr: record.sr,
  });
  let failure = null;
  for (let i = 0; i < 50000 && !failure; i++) {
    const records = [generated(), generated(), generated()];
    const [a, b, c] = records;
    const ab = S.pickRec(a, b);
    const left = S.pickRec(ab, c);
    const right = S.pickRec(a, S.pickRec(b, c));
    const epoch = Math.max(...records.map((record) => record.lp));
    const current = records.filter((record) => record.lp === epoch);
    const invariant = same(ab, S.pickRec(b, a))
      && same(S.pickRec(a, a), a)
      && same(left, right)
      && left.lp === epoch
      && left.rp === Math.max(...records.map((record) => record.rp))
      && left.pv === Math.max(...current.map((record) => record.pv))
      && current.some((record) => schedule(record) === schedule(left));
    if (!invariant) failure = { index: i, records, left, right };
  }
  ok(!failure,
    `50,000 seeded schedule/proof merges satisfy the algebra (seed ${seed}`
      + `${failure ? `; ${stable(failure)}` : ''})`);
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
  S.takeNoteDrops();
  const merged = mergeState(state({ notes: many }), state());
  const kept = Object.values(merged.notes);
  ok(kept.length === 400 && kept.filter((value) => value.text).length === S.WRITTEN_LIVE,
    `an over-long note set is capped at ${S.WRITTEN_LIVE} live notes, and delete markers`
    + ' take only what is left of the entry budget');
  ok(S.takeNoteDrops() === 50 && S.takeNoteDrops() === 0,
    'the words the cap could not keep are counted once, for the app to say so');
}

/* Three devices at the live ceiling merge to the ceiling, not to three times
 * it — the count app.js enforces as you type is the count the merge arrives at
 * — and the same set whichever pair meets first. Eviction inside the ceiling is
 * by the edit stamp, so a device can lose everything it wrote to two devices
 * that wrote later; that is why the drops are counted rather than left silent. */
{
  const deck = (prefix, base) => {
    const notes = {};
    for (let i = 0; i < 150; i++) {
      notes[prefix + i.toString(36).padStart(3, '0')] =
        { at: base + i, ed: base + i, text: prefix + ' note ' + i };
    }
    return state({ notes });
  };
  const phone = deck('a', 1000);
  const laptop = deck('b', 5000);
  const tablet = deck('c', 9000);

  const left = mergeState(mergeState(phone, laptop), tablet);
  const right = mergeState(phone, mergeState(laptop, tablet));
  const other = mergeState(tablet, mergeState(laptop, phone));
  const live = Object.values(left.notes).filter((note) => note.text);
  ok(same(left, right) && same(left, other),
    'three devices over the live ceiling converge whatever order they meet in');
  ok(live.length === S.WRITTEN_LIVE,
    `450 live notes across three devices become ${S.WRITTEN_LIVE} (${live.length})`);
  ok(live.every((note) => !note.text.startsWith('a')),
    'the ceiling evicts by the edit stamp, so the oldest writing goes first');
  ok(same(left, mergeState(left, phone)) && same(left, mergeState(left, tablet)),
    'a capped set stays put when the same devices sync again');
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

/* ────────────────────── the cards you write ────────────────────── */

/* The blob's size bound is not a number anybody chose here: it is the backend's
 * own, and this is the gate that keeps the two the same. If the migration is
 * ever raised or an app is given a ceiling of its own, the caps cut from it
 * have to be recut, and a client that quietly kept the old number would find
 * out in the field. */
{
  const dir = path.join(HERE, '..', 'content', 'day-skipper', 'supabase', 'migrations');
  const file = fs.readdirSync(dir).find((name) => name.endsWith('_sync_blobs.sql'));
  const sql = fs.readFileSync(path.join(dir, file), 'utf8');
  const allSql = fs.readdirSync(dir).sort()
    .map((name) => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
  const repairName = '20260822170000_progress_writer_fence_repair.sql';
  const repairSql = fs.existsSync(path.join(dir, repairName))
    ? fs.readFileSync(path.join(dir, repairName), 'utf8') : '';
  const getV2 = /create or replace function public\.sync_get_v2([\s\S]*?)create or replace function public\.sync_put_v2/.exec(allSql)?.[1] || '';
  const putV2 = /create or replace function public\.sync_put_v2([\s\S]*?)revoke execute/.exec(allSql)?.[1] || '';
  const repairedLegacyPut = /create or replace function public\.sync_put\([\s\S]*?\)([\s\S]*?)create or replace function public\.sync_get_v2/.exec(repairSql)?.[1] || '';
  const column = /max_bytes\s+integer\s+not null\s+default\s+(\d+)/.exec(sql);
  ok(!!column && Number(column[1]) === S.MAX_BYTES,
    `the client's blob ceiling is the backend's own (${column && column[1]} = ${S.MAX_BYTES})`);
  ok(/insert into sync\.apps \(app\) values/.test(sql)
      && /'day-skipper'/.test(sql) && /'competent-crew'/.test(sql),
  'both built-in courses are inserted at that default rather than a ceiling of their own');
  ok(/octet_length\(p_data::text\) > v_max/.test(sql),
    'and the server measures the bytes it was sent, which is what blobBytes() counts');
  ok(/writer_version\s+smallint\s+not null\s+default 1/.test(allSql)
      && /create or replace function public\.sync_get_v2/.test(allSql)
      && /create or replace function public\.sync_put_v2/.test(allSql),
    'progress v2 has a separate backend writer capability and durable row fence');
  ok(/and b\.writer_version < 2/.test(allSql)
      && /if v_cur\.writer_version >= 2 then\s+raise exception 'sync client update required'/s.test(allSql),
    'legacy readers cannot receive a v2 row and legacy writers cannot overwrite it');
  ok(/update sync\.blobs b\s+set writer_version = 2/s.test(getV2)
      && /p_writer_version is distinct from 2/.test(getV2),
    'the first v2 read durably fences an equal-state legacy row and rejects NULL capability');
  ok(/p_writer_version is distinct from 2/.test(putV2)
      && /v_cur\.rev is distinct from p_rev/.test(putV2),
    'the v2 writer rejects NULL capability and NULL revision rather than bypassing CAS');
  ok(/update sync\.blobs b\s+set writer_version = 2/s.test(repairSql)
      && /p_writer_version is distinct from 2/.test(repairSql)
      && /v_cur\.rev is distinct from p_rev/.test(repairedLegacyPut),
    'a fresh migration version repairs already-ledgered v2 functions and legacy NULL CAS');
}

/* `p_data::text` is the jsonb text form, not the JSON we sent: Postgres parses
 * the document and writes it back with a space after every colon and every
 * comma. A client that measured JSON.stringify would read a blob of five
 * thousand keys as five thousand bytes smaller than the server does, wave it
 * through, and collect the refusal a round trip later. */
{
  const shaped = { a: 1, b: [1, 2], c: { d: 'x' }, e: null };
  ok(S.blobBytes(shaped) === '{"a": 1, "b": [1, 2], "c": {"d": "x"}, "e": null}'.length,
    `blobBytes counts the document as Postgres writes it back (${S.blobBytes(shaped)})`);
  ok(S.blobBytes(shaped) > JSON.stringify(shaped).length,
    'which is larger than our own JSON, so the check errs towards refusing early');
  ok(S.blobBytes({ note: 'ü€𝄞' }) === new TextEncoder().encode('{"note": "ü€𝄞"}').length,
    'and it counts bytes rather than characters, the way octet_length does');
}

/* A blob over the bound is refused before it is sent. The counted ceilings hold
 * records, not bytes, so a deck full of maximum-length cards can still be too
 * big for the blob — and the honest answer to that is a sentence, not a silent
 * eviction of somebody's writing. */
{
  storage.clear();
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = (url) => {
    calls.push(url.split('/').pop());
    return Promise.resolve({ ok: true, status: 200, text: async () => '[]' });
  };
  const cards = {};
  for (let i = 0; i < 100; i++) {
    cards['u.' + i.toString(16).padStart(12, '0')] =
      { at: i, ed: i, front: 'q'.repeat(2000), back: 'a'.repeat(2000) };
  }
  const huge = state({ cards });
  ok(S.blobBytes(huge) > S.MAX_BYTES,
    `100 cards at their length ceiling already outgrow the blob (${S.blobBytes(huge)} bytes)`);
  S.init({ app: 'day-skipper', supported: true, sanitise: (value) => value });
  S.turnOn('0123456789ABCDEFGHJKMNPQR');
  let refusal = '';
  await S.sync(huge).catch((error) => { refusal = error.message; });
  ok(calls.join() === 'sync_get_v2' && /more than sync can carry/.test(refusal),
    `an over-large blob is refused here rather than sent to be refused there (${refusal})`);
  ok(/deleting some of them/.test(refusal),
    'and the refusal names the way out rather than only the problem');
  S.turnOff();
  globalThis.fetch = originalFetch;
}

/* The cards you write are the second thing in this document nothing else can
 * reproduce, and they travel by the same algebra as the notes: stamped records,
 * merged id by id, deletes recorded rather than dropped. */
{
  const card = (overrides = {}) =>
    Object.assign({ at: 100, ed: 100, front: 'a question', back: 'an answer' }, overrides);
  const phone = state({
    cards: {
      'u.aaaa': card({ front: 'written on the phone' }),
      c3e8a945bb: card({ at: 50, ed: 50, front: 'my wording', was: '1a2b3c4d.z' }),
    },
    recs: { 'u.aaaa': rec({ rp: 4 }) },
  });
  const laptop = state({
    cards: {
      'u.bbbb': card(),
      c3e8a945bb: card({ at: 50, ed: 400, front: 'my better wording', was: '1a2b3c4d.z' }),
    },
  });
  const merged = mergeState(phone, laptop);
  ok(same(merged, mergeState(laptop, phone)), 'the card merge is commutative');
  ok(same(merged, mergeState(merged, phone)) && same(merged, mergeState(merged, laptop)),
    'merging the same cards again changes nothing');
  ok(Object.keys(merged.cards).sort().join() === 'c3e8a945bb,u.aaaa,u.bbbb',
    'a card written on one device only travels to the other');
  ok(merged.cards.c3e8a945bb.front === 'my better wording'
      && merged.cards.c3e8a945bb.at === 50,
  'the later edit of a course card wins while it keeps the moment it was first made');
  ok(merged.cards.c3e8a945bb.was === '1a2b3c4d.z',
    'the fingerprint of the card the author shipped travels with the edit');
  ok(merged.recs['u.aaaa'].rp === phone.recs['u.aaaa'].rp
      && merged.recs['u.aaaa'].ivl === phone.recs['u.aaaa'].ivl
      && merged.recs['u.aaaa'].pv === phone.recs['u.aaaa'].ivl,
    'and its review history crosses while legacy proof upgrades from the review interval');
}

{
  const written = state({ cards: { 'u.aaaa': { at: 100, ed: 100, front: 'the card' } } });
  const deleted = state({ cards: { 'u.aaaa': { at: 100, ed: 500, front: '', back: '' } } });
  const hidden = state({
    cards: { c3e8a945bb: { at: 100, ed: 500, front: '', back: '', hidden: true } },
  });
  const merged = mergeState(written, deleted);
  ok(!merged.cards['u.aaaa'].front,
    'a deleted card is not resurrected by the device that still has it');
  ok(same(merged, mergeState(deleted, written)) && same(merged, mergeState(merged, written)),
    'the delete marker survives repeated merges in either order');
  const again = state({ cards: { 'u.aaaa': { at: 100, ed: 900, front: 'written again' } } });
  ok(mergeState(merged, again).cards['u.aaaa'].front === 'written again',
    'a card written again after a delete is not held down by the marker');
  ok(mergeState(hidden, state()).cards.c3e8a945bb.hidden === true,
    'a hidden course card travels as a hide rather than as a plain delete');
  const third = state({ cards: { 'u.aaaa': { at: 100, ed: 700, front: 'from a third device' } } });
  ok(same(mergeState(mergeState(written, deleted), third),
    mergeState(written, mergeState(deleted, third))),
  'the card merge is associative across three devices');
}

/* The rule the whole feature turns on. A tombstone takes a card out of every
 * deck it reaches, and the record of answering that card is keyed by the same
 * id — but the merge is the one place with no way to tell a deleted card from a
 * cards document that failed to load, so it never touches one. */
{
  const answered = state({
    cards: { 'u.aaaa': { at: 100, ed: 100, front: 'the card' } },
    recs: { 'u.aaaa': rec({ rp: 14, ivl: 30 }) },
  });
  const deleted = state({ cards: { 'u.aaaa': { at: 100, ed: 500, front: '', back: '' } } });
  const merged = mergeState(answered, deleted);
  ok(!merged.cards['u.aaaa'].front && merged.recs['u.aaaa'].rp === 14,
    'a card tombstone arriving from another device deletes no review record in the merge');
  ok(same(merged, mergeState(deleted, answered)),
    'in either direction');
}

/* The tie-break, on the one field the merge writes itself.
 *
 * pickWritten carries the EARLIEST `at` forward so a list does not re-order
 * after a sync, which makes `at` a value neither device holds — and comparing
 * the whole record on an `ed` tie fed that derived value straight back into the
 * comparison. It sorts ahead of `front`, so a rewritten stamp decided which
 * words won, and the answer then depended on which pair of devices met first.
 * pickRec settles the same problem one screen up by comparing with the lapse
 * count blanked; this is the same move for the same reason. */
{
  const first = state({ cards: { 'u.c0': { at: 100, ed: 100, front: 'yours', back: '' } } });
  const kept = state({ cards: { 'u.c0': { at: 100, ed: 200, front: 'yours', back: '' } } });
  const hidden = state({
    cards: { 'u.c0': { at: 200, ed: 200, front: '', back: '', hidden: true } },
  });
  const left = mergeState(mergeState(first, kept), hidden);
  const right = mergeState(mergeState(first, hidden), kept);
  ok(same(left, right),
    'an exact edit-stamp tie on one card converges whichever pair of devices meets first');
  ok(!!left.cards['u.c0'].front === !!right.cards['u.c0'].front,
    'so a hide is not undone, or applied, by the order the devices reached the server');
  const tie = (a, b) => S.pickWritten(a, b);
  const x = { at: 1, ed: 5, front: 'x' };
  const y = { at: 9, ed: 5, front: 'y' };
  ok(stable(tie(x, y)) === stable(tie(y, x)),
    'and the tie-break itself gives one answer whichever way round it is asked');
}

/* Three devices, all of them over the shared ceiling, converging on one set
 * whichever pair meets first. */
{
  const deck = (prefix, base) => {
    const cards = {};
    for (let i = 0; i < 120; i++) {
      cards['u.' + prefix + i.toString(16).padStart(10, '0')] =
        { at: base + i, ed: base + i, front: prefix + ' card ' + i };
    }
    return state({ cards });
  };
  const phone = deck('a', 1000);
  const laptop = deck('b', 5000);
  const tablet = deck('c', 9000);
  const left = mergeState(mergeState(phone, laptop), tablet);
  const right = mergeState(phone, mergeState(laptop, tablet));
  const other = mergeState(tablet, mergeState(laptop, phone));
  const live = Object.values(left.cards).filter((card) => card.front);
  ok(same(left, right) && same(left, other),
    'three devices over the ceiling converge on cards whatever order they meet in');
  ok(live.length === S.WRITTEN_LIVE,
    `360 written cards across three devices become ${S.WRITTEN_LIVE} (${live.length})`);
  ok(live.every((card) => !card.front.startsWith('a')),
    'the ceiling evicts by the edit stamp, so the oldest writing goes first');
  ok(same(left, mergeState(left, phone)) && same(left, mergeState(left, tablet)),
    'a capped set stays put when the same devices sync again');
}

/* The ceiling is one budget, not one each. Notes and cards are evicted against
 * each other by the one total order, because the document that carries them is
 * one document and what loses when it will not fit is the review history. */
{
  const notes = {};
  const cards = {};
  for (let i = 0; i < 150; i++) {
    // Interleaved stamps: every card is newer than the note before it and older
    // than the note after it, so a budget that kept kinds apart would show.
    notes['n' + i.toString(36).padStart(4, '0')] = { at: 2 * i, ed: 2 * i, text: 'note ' + i };
    cards['u.' + i.toString(16).padStart(12, '0')] =
      { at: 2 * i + 1, ed: 2 * i + 1, front: 'card ' + i };
  }
  S.takeNoteDrops();
  S.takeCardDrops();
  const merged = mergeState(state({ notes, cards }), state());
  const liveNotes = Object.values(merged.notes).filter((note) => note.text);
  const liveCards = Object.values(merged.cards).filter((card) => card.front);
  ok(liveNotes.length + liveCards.length === S.WRITTEN_LIVE,
    `300 notes and cards come back at the ${S.WRITTEN_LIVE} they share`
    + ` (${liveNotes.length} + ${liveCards.length})`);
  ok(liveNotes.length === 100 && liveCards.length === 100,
    'and the survivors are the newest across both kinds, not the newest of each');
  ok(liveNotes.every((note) => Number(note.ed) >= 100)
      && liveCards.every((card) => Number(card.ed) >= 100),
  'the eviction reads one total order over the two blocks');
  ok(S.takeNoteDrops() === 50 && S.takeCardDrops() === 50,
    'and what the shared ceiling could not keep is counted by kind, for the app to say so');
  ok(S.takeNoteDrops() === 0 && S.takeCardDrops() === 0,
    'counted once: a loss said twice is its own kind of wrong');
}

/* Markers fill what the live records leave, and the entry budget is shared too:
 * three hundred deletes on top of two hundred live records cannot push the blob
 * past the entries it is allowed. */
{
  const notes = {};
  const cards = {};
  for (let i = 0; i < 150; i++) {
    notes['n' + i.toString(36).padStart(4, '0')] = { at: i, ed: i, text: 'note ' + i };
    cards['u.' + i.toString(16).padStart(12, '0')] = { at: i, ed: i, front: 'card ' + i };
  }
  for (let i = 0; i < 200; i++) {
    cards['u.f' + i.toString(16).padStart(11, '0')] = { at: i, ed: i, front: '', back: '' };
  }
  const merged = mergeState(state({ notes, cards }), state());
  const kept = Object.keys(merged.notes).length + Object.keys(merged.cards).length;
  ok(kept === S.WRITTEN_SLOTS, `the entry budget is shared as well (${kept})`);
}

{
  // An own "__proto__" key only exists in JSON, which is exactly where a synced
  // blob comes from — and a card id has two shapes to police rather than one.
  const hostile = JSON.parse('{"__proto__":{"at":1,"ed":1,"front":"x"},'
    + '"u.NOTHEX":{"at":1,"ed":1,"front":"y"},"-leading-dash":{"at":1,"ed":1,"front":"z"},'
    + '"u.abc123":{"at":1,"ed":1,"front":"mine"},"c3e8a945bb":{"at":1,"ed":1,"front":"theirs"}}');
  const merged = mergeState(state({ cards: hostile }), state());
  ok(Object.keys(merged.cards).sort().join() === 'c3e8a945bb,u.abc123'
      && Object.getPrototypeOf(merged.cards) === Object.prototype,
  'a card id that is not an id this app writes never becomes an object key');
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
  const identical = state({
    recs: { card: rec({ st: 'l', rp: 20, sr: 20, lp: 1, pv: 15 }) },
  });
  const calls = [];
  globalThis.fetch = async (url) => {
    const fn = url.split('/').pop();
    calls.push(fn);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ rev: 7, data: identical }]),
    };
  };
  S.init({
    app: 'day-skipper',
    supported: true,
    sanitise: (value) => value,
  });
  S.turnOn('0123456789ABCDEFGHJKMNPQR');
  const merged = await S.sync(identical);
  ok(calls.join() === 'sync_get_v2' && same(merged, identical),
    'an equal-state adoption needs only the v2 read that durably fences the backend row');
  S.turnOff();
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
    if (fn === 'sync_get_v2') return reply([]);
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
  ok(calls.join(',') === 'sync_get_v2,sync_put_v2,sync_put_v2,sync_put_v2',
    'a concurrent first-write collision retries through the revision conflict');
  ok(S.WRITER_VERSION === 2,
    'the client identifies itself with the fenced progress writer version');
  ok(merged.recs.phone && merged.recs.laptop && same(merged, adopted),
    'the first-write retry retains progress from both devices');
  S.turnOff();
  globalThis.fetch = originalFetch;
}

/* A blob over the bound is refused before it is sent, and marked as a failure
 * only the person can clear: every other failure here is worth another go on
 * its own, and a screen promising that it will try again is a screen telling
 * somebody to wait for something that cannot happen. */
{
  const originalFetch = globalThis.fetch;
  const big = state({ notes: {} });
  for (let i = 0; i < 200; i++) {
    big.notes['n' + i.toString(36).padStart(4, '0')] =
      { at: 1, ed: 1, text: 'x'.repeat(2000) };
  }
  globalThis.fetch = async () => ({
    ok: true, status: 200, text: async () => JSON.stringify([]),
  });
  S.init({ app: 'day-skipper', supported: true, sanitise: (v) => v, onMerged: () => {} });
  S.turnOn('0123456789ABCDEFGHJKMNPQR');
  let message = '';
  try {
    await S.sync(big);
  } catch (error) {
    message = error.message;
  }
  const status = S.status();
  ok(S.blobBytes(big) > S.MAX_BYTES && /more than sync can carry/.test(message),
    `a blob over the bound is refused before it is sent (${message})`);
  ok(status.errYours === true,
    'and recorded as a failure trying again cannot clear');
  S.turnOff();
  globalThis.fetch = originalFetch;
}

/* An app-level invariant can depend on fields that merge independently. The
 * transport must reconcile the completed document before deciding whether it
 * differs from the server and before uploading it. */
{
  storage.clear();
  const originalFetch = globalThis.fetch;
  const remote = state({
    settings: { examDate: '2026-08-27', at: 2 },
    recs: { card: rec({ st: 'r', ivl: 30, due: 900, rp: 6, sr: 6, pv: 30 }) },
  });
  const calls = [];
  let uploaded = null;
  globalThis.fetch = async (url, options) => {
    const fn = url.split('/').pop();
    calls.push(fn);
    if (fn === 'sync_get_v2') {
      return { ok: true, status: 200, text: async () => JSON.stringify([{ rev: 7, data: remote }]) };
    }
    uploaded = JSON.parse(options.body).p_data;
    return { ok: true, status: 200, text: async () => JSON.stringify([{
      ok: true, rev: 8, data: uploaded,
    }]) };
  };
  S.init({
    app: 'day-skipper',
    supported: true,
    sanitise: (value) => value,
    reconcile: (value) => {
      value.recs.card.ivl = 1;
      value.recs.card.due = 100;
      return value;
    },
    onMerged: () => {},
  });
  S.turnOn('0123456789ABCDEFGHJKMNPQR');
  const merged = await S.sync(remote);
  ok(calls.join(',') === 'sync_get_v2,sync_put_v2'
      && uploaded.recs.card.ivl === 1 && uploaded.recs.card.due === 100
      && merged.recs.card.pv === 30,
    'cross-field reconciliation runs before equality and upload without lowering proof');
  S.turnOff();
  globalThis.fetch = originalFetch;
}

console.log([...passed, ...failed].join('\n'));
console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
