/* Pure contract tests for web/achievements.js.
 *
 * The production file is a browser classic script. Loading it into a fresh VM
 * proves it has no DOM, storage, module-loader, or ambient app dependencies.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(HERE, '..', 'web', 'achievements.js'), 'utf8');
const realm = { console };
vm.createContext(realm);
vm.runInContext(source, realm, { filename: 'web/achievements.js' });
const A = realm.KeepClubAchievements;

const passes = [];
const failures = [];
function ok(condition, message) {
  (condition ? passes : failures).push(`${condition ? 'PASS' : 'FAIL'}  ${message}`);
}
function same(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  ok(a === e, `${message}${a === e ? '' : `\n  expected ${e}\n  received ${a}`}`);
}
function ids(records) {
  return Array.from(records, (record) => record.id);
}

ok(!!A && A.VERSION === 1, 'the engine installs one versioned browser global');
ok(typeof realm.document === 'undefined' && typeof realm.localStorage === 'undefined',
  'the engine loads without a DOM or storage');

const legacyIds = [
  'cast-off', 'underway', 'offshore', 'blue-water',
  'streak-3', 'streak-7', 'streak-14', 'clean-run',
  'night-watch', 'dawn-patrol', 'all-sections', 'section-swept',
  'knot-untangled', 'deck-met',
];
ok(legacyIds.every((id) => A.isKnownId(id)), 'every shipped achievement id remains valid');
ok(new Set(Array.from(A.IDS)).size === A.IDS.length, 'achievement ids are unique');
ok(Object.isFrozen(A.catalog({})), 'the resolved catalog is immutable');
ok(A.DEFINITIONS.every((definition) => (
  definition.id && definition.title && definition.description && definition.art
  && ['private', 'available', 'prompt'].includes(definition.share)
  && ['club', 'course'].includes(definition.scope)
)), 'every definition carries complete presentation and sharing policy');
ok(A.DEFINITIONS.every(Object.isFrozen),
  'every scoped definition is immutable');

{
  const course = {
    id: 'day-skipper',
    hoard: {
      title: "Ship's log",
      items: {
        'streak-7': {
          t: 'a week at sea',
          d: 'seven days under sail',
          art: 'anchor',
          rule: { metric: 'answers', gte: 0 },
          share: 'private',
          scope: 'course',
        },
      },
    },
    achievements: {
      items: {
        'streak-7': { title: 'seven days aboard' },
        invented: { title: 'not a real rule' },
      },
    },
  };
  const item = A.catalog(course).find((definition) => definition.id === 'streak-7');
  ok(item.title === 'seven days aboard' && item.description === 'seven days under sail'
    && item.art === 'anchor', 'modern and legacy course theme fields layer predictably');
  ok(item.share === 'prompt' && item.rule.metric === 'clubStreak',
    'a course cannot override achievement rules or sharing policy');
  ok(item.scope === 'club', 'a course cannot override achievement scope');
  ok(!A.catalog(course).some((definition) => definition.id === 'invented'),
    'a course cannot add an achievement');
  ok(A.collectionTitle(course) === "Ship's log", 'the legacy collection title remains supported');

  const privateItem = A.catalog({
    id: 'local-secret',
    hoard: { items: { 'streak-7': { t: 'Private anatomy phrase', art: 'secret' } } },
  }).find((definition) => definition.id === 'streak-7');
  ok(privateItem.title === 'a week in the club' && privateItem.art === 'roost',
    'imported metadata cannot leak into achievement presentation');
}

{
  const inputUnlocked = { 'cast-off': 10, 'future-device-id': 11, broken: 'yes' };
  const inputContext = { answers: 50, clubStreak: 7, hour: 8, weekday: 2 };
  const result = A.evaluate({
    at: 123456,
    unlocked: inputUnlocked,
    context: inputContext,
  });
  same(ids(result.newlyUnlocked), ['underway', 'streak-3', 'streak-7'],
    'evaluation unlocks all crossed rules in catalog order');
  ok(result.unlocked['cast-off'] === 10 && result.unlocked['future-device-id'] === 11
    && result.unlocked.underway === 123456, 'old, forward-version, and new unlocks are preserved');
  ok(!('underway' in inputUnlocked) && !('streak' in inputContext),
    'evaluation does not mutate either input');
  ok(result.newlyUnlocked.find((record) => record.id === 'streak-7').sharePrompt,
    'share-prompt metadata travels with an unlock record');
  ok(result.newlyUnlocked.find((record) => record.id === 'streak-7').scope === 'club',
    'unlock records carry their immutable storage scope');
  ok(result.newlyUnlocked.every(Object.isFrozen),
    'unlock records and their scope are immutable');

  const repeated = A.evaluate({
    at: 999999,
    unlocked: result.unlocked,
    context: inputContext,
  });
  ok(repeated.newlyUnlocked.length === 0 && repeated.unlocked['streak-7'] === 123456,
    'evaluation is idempotent and keeps the first unlock timestamp');
}

{
  let threw = false;
  try {
    A.evaluate({ context: { answers: 1 } });
  } catch (error) {
    threw = error instanceof TypeError || error?.name === 'TypeError';
  }
  ok(threw, 'evaluation requires an explicit clock');
}

{
  const result = A.evaluate({
    at: 1000,
    context: {
      answers: 1,
      streak: 14,
      totalCards: 100,
      solidCards: 50,
      hour: 2,
      weekday: 6,
    },
  });
  const got = new Set(ids(result.newlyUnlocked));
  ok(got.has('streak-3') && got.has('streak-7') && got.has('streak-14'),
    'a course streak remains the fallback until a club-wide streak is supplied');
  ok(got.has('solid-10') && got.has('solid-25') && got.has('solid-50')
    && got.has('solid-pct-25') && got.has('solid-pct-50'),
  'memory counts and deck percentages unlock independently');
  ok(got.has('night-watch') && got.has('weekend-club'),
    'fun time achievements come from the same engine');
  ok(!got.has('dawn-patrol') && !got.has('solid-pct-75'),
    'nearby time and mastery thresholds do not unlock early');
}

{
  const result = A.evaluate({
    at: 1000,
    context: { answers: 1 },
  });
  const got = new Set(ids(result.newlyUnlocked));
  ok(!got.has('night-watch') && !got.has('weekend-club'),
    'a partial context does not masquerade as Sunday at midnight');
}

{
  const result = A.evaluate({
    at: 1000,
    context: {
      answers: 1000,
      totalCards: 20,
      solidCards: 20,
      sections: 2,
      touchedSections: 2,
      sweptSections: 2,
      keptSections: 2,
      deckSeen: true,
      deckKept: true,
      tamed: true,
      personalBest: 50,
      sessionSections: 3,
      repeatAnswers: 100,
      repeatGood: 91,
      imported: true,
      importedReviews: 1000,
    },
    course: { id: 'local-private', title: 'Private medical terms' },
  });
  const got = new Set(ids(result.newlyUnlocked));
  for (const expected of [
    'all-sections', 'section-swept', 'section-kept', 'deck-met', 'deck-kept',
    'knot-untangled', 'clean-run', 'personal-best-50', 'club-tour',
    'steady-hand', 'anki-keeper-100', 'anki-keeper-500', 'anki-keeper-1000',
  ]) {
    ok(got.has(expected), `${expected} is evaluated by the central rule set`);
  }
  const imported = result.newlyUnlocked.find((record) => record.id === 'anki-keeper-1000');
  ok(imported.payload.imported && imported.payload.courseId === null
    && imported.payload.courseTitle === null,
  'default imported-deck share payloads omit the private deck name and id');
  ok(A.bestMoment(result.newlyUnlocked)?.id === 'deck-kept',
    'the highest-value simultaneous achievement becomes the session hero');
  ok(result.newlyUnlocked.find((record) => record.id === 'deck-kept').scope === 'course'
    && result.newlyUnlocked.find((record) => record.id === 'solid-10').scope === 'club'
    && result.newlyUnlocked.find((record) => record.id === 'solid-pct-100').scope === 'course',
  'absolute memory counts stay club-wide while deck completion and percentages stay course-local');
}

{
  const deck = {
    sections: [{ sectionId: 'one', cardCount: 2 }, { sectionId: 'two', cardCount: 2 }],
    cards: [
      { cardId: 'a', sectionId: 'one' },
      { cardId: 'b', sectionId: 'one' },
      { cardId: 'c', sectionId: 'two' },
      { cardId: 'd', sectionId: 'two' },
    ],
  };
  const state = {
    answers: 14,
    streak: 3,
    revTotal: 100,
    revGood: 90,
    recs: {
      a: { st: 'r', ivl: 30, lp: 0 },
      b: { st: 'r', ivl: 21, lp: 3 },
      c: { st: 'r', ivl: 7, lp: 3 },
    },
  };
  const context = A.contextFromDeck({
    at: new Date(2026, 6, 29, 13, 0, 0).getTime(),
    state,
    deck,
    course: { id: 'built-in' },
    session: { maxClean: 22, good: 9, again: 1, sectionKeys: ['one', 'two', 'two'] },
    previousLastDay: '2026-07-14',
  });
  ok(context.totalCards === 4 && context.solidCards === 2 && context.solidPercent === 50,
    'deck context derives the exact three-week solid definition');
  ok(context.touchedSections === 2 && context.sweptSections === 1
    && context.keptSections === 1, 'section exploration and mastery are derived in one pass');
  same(Array.from(context.keptSectionKeys), ['one'],
    'deck context identifies the exact section whose every card is solid');
  ok(Object.isFrozen(context.keptSectionKeys),
    'exact kept-section keys are immutable');
  ok(!context.deckSeen && !context.deckKept && context.tamed,
    'deck completion and leech recovery preserve scheduler semantics');
  ok(context.personalBest === 22 && context.sessionAnswers === 10
    && context.sessionSections === 2, 'session facts are normalised');
  ok(context.absenceDays === 14, 'calendar-day absence excludes the return day');
}

{
  const mature = { st: 'r', ivl: 21 };
  const context = A.contextFromDeck({
    at: 1000,
    state: { answers: 2, recs: { a: mature, b: mature } },
    deck: {
      sections: [{ sectionId: 'one', cardCount: 999 }],
      cards: [{ cardId: 'a', sectionId: 'one' }, { cardId: 'b', sectionId: 'one' }],
    },
    course: { id: 'local-abc' },
  });
  ok(context.keptSections === 1 && context.deckKept,
    'actual cards, not stale section metadata, determine completion');
  ok(context.imported && context.importedReviews === 2,
    'local course ids derive imported-deck progress without card content');
}

{
  const aggregate = A.aggregateClubStates([
    {
      answers: 12,
      days: {
        '2026-07-26': 2,
        '2026-07-27': 1,
        '2026-07-29': 3,
      },
      recs: {
        solidA: { st: 'r', ivl: 21 },
        solidB: { st: 'r', ivl: 45 },
        young: { st: 'r', ivl: 20 },
      },
      revTotal: 10,
      revGood: 8,
      bestClean: 24,
      lastDay: '2026-07-29',
      ach: {
        'streak-7': 200,
        'future-achievement': { at: 900 },
      },
    },
    {
      answers: 8,
      days: {
        '2026-07-27': 4,
        '2026-07-28': 2,
      },
      recs: {
        solidC: { st: 'r', ivl: 90 },
        learning: { st: 'l', ivl: 99 },
      },
      revTotal: 7,
      revGood: 999,
      bestClean: 31,
      lastDay: '2026-07-28',
      ach: {
        'streak-7': { at: 100 },
        'future-achievement': 700,
        broken: 'yesterday',
      },
    },
  ]);
  same(aggregate.days, {
    '2026-07-26': 2,
    '2026-07-27': 5,
    '2026-07-29': 3,
    '2026-07-28': 2,
  }, 'club aggregation unions study days and sums same-day answers across courses');
  ok(aggregate.lastDay === '2026-07-29' && aggregate.clubStreak === 4,
    'the club streak follows the consecutive union of all course days');
  ok(aggregate.answers === 20 && aggregate.solidCards === 3
    && aggregate.repeatAnswers === 17 && aggregate.repeatGood === 15
    && aggregate.personalBest === 31 && aggregate.courseCount === 2,
  'club aggregation sums activity, solid, and repeat facts while retaining the best clean run');
  same(aggregate.unlocked, {
    'streak-7': 100,
    'future-achievement': 700,
  }, 'club aggregation retains the earliest valid timestamp for each unlock');
  ok(Object.isFrozen(aggregate) && Object.isFrozen(aggregate.days)
    && Object.isFrozen(aggregate.unlocked),
  'the club aggregate and its nested maps are immutable');
}

{
  let aggregate = null;
  let threw = false;
  try {
    aggregate = A.aggregateClubStates([
      null,
      'old string state',
      [],
      {},
      {
        answers: 'not a number',
        days: 'not a map',
        recs: null,
        revTotal: -9,
        revGood: Infinity,
        bestClean: {},
        lastDay: 42,
        ach: {
          invalid: 'yes',
          zero: 0,
          negative: -100,
        },
      },
    ]);
  } catch (error) {
    threw = true;
  }
  ok(!threw, 'club aggregation tolerates malformed and partial old states');
  ok(aggregate && aggregate.answers === 0 && aggregate.solidCards === 0
    && aggregate.repeatAnswers === 0 && aggregate.repeatGood === 0
    && aggregate.personalBest === 0 && aggregate.courseCount === 0
    && aggregate.lastDay === null && aggregate.clubStreak === 0,
  'malformed old counters collapse to safe empty club facts');
  same(aggregate?.days, {}, 'malformed day history contributes no club activity');
  same(aggregate?.unlocked, {}, 'malformed unlock timestamps are discarded');
}

{
  const aggregate = A.aggregateClubStates([
    { days: { '2026-07-28': 1, '2026-07-29': 1 }, lastDay: '2099-01-01' },
  ]);
  ok(aggregate.lastDay === '2026-07-29' && aggregate.clubStreak === 2,
    'a corrupt future lastDay cannot erase a valid club streak');
}

{
  const days = {};
  for (let i = 0; i < 90; i++) {
    const date = new Date(Date.UTC(2026, 6, 29 - i));
    days[date.toISOString().slice(0, 10)] = 1;
  }
  const aggregate = A.aggregateClubStates([{
    days,
    lastDay: '2026-07-29',
    streak: 365,
    ach: { 'clean-run': 100 },
  }, {
    days: { '9999-99-99': 9 },
    lastDay: '9999-99-99',
  }]);
  ok(aggregate.clubStreak === 365,
    'a proven legacy streak survives its old 90-day history window');
  ok(aggregate.lastDay === '2026-07-29' && !('9999-99-99' in aggregate.days),
    'calendar-impossible day keys cannot take over the club cursor');
  ok(aggregate.personalBest === 20,
    'a legacy clean-run unlock preserves the minimum personal best it proves');
}

{
  const record = A.record({
    id: 'solid-25',
    at: 123456,
    context: { clubSolid: 40 },
    course: { id: 'day-skipper', title: 'Day Skipper' },
  });
  ok(record?.id === 'solid-25' && record.scope === 'club'
    && record.at === 123456 && record.sharePrompt,
  'record() rehydrates a known unlock with its club scope and presentation policy');
  same(record?.payload, {
    metric: 'solidCards',
    value: 40,
    target: 25,
    imported: false,
    courseId: 'day-skipper',
    courseTitle: 'Day Skipper',
  }, 'record() rebuilds deterministic aggregate payload metadata');
  ok(Object.isFrozen(record) && Object.isFrozen(record.payload),
    'rehydrated records and payloads are immutable');

  const courseRecord = A.record({
    id: 'deck-kept',
    at: 654321,
    context: { deckKept: true },
    course: { id: 'competent-crew', title: 'Competent Crew' },
  });
  ok(courseRecord?.scope === 'course' && courseRecord.payload.metric === 'deckKept'
    && courseRecord.payload.value === true && courseRecord.payload.target === null,
  'record() preserves course scope and boolean-rule payloads');
  ok(A.record({ id: 'not-real', at: 1 }) === null
    && A.record({ id: 'solid-25', at: 'not-a-time' }) === null,
  'record() safely refuses unknown ids and invalid timestamps');
}

{
  const source = {
    at: 777,
    answers: 1,
    solidCards: 3,
    clubStreak: 4,
    courseCount: 2,
  };
  const membership = A.buildMembershipMoment(source);
  ok(membership.id === 'membership' && membership.scope === 'club'
    && membership.kind === 'repeatable' && membership.eligible
    && membership.shareable && !membership.sharePrompt,
  'a learner with activity gets an available, repeatable membership moment');
  same(membership.payload, {
    answers: 1,
    solidCards: 3,
    clubStreak: 4,
    courseCount: 2,
  }, 'membership payload contains only aggregate club facts');
  ok(membership.description === '3 solid · 1 answer · 4 day streak',
    'membership copy handles a singular answer and includes an active streak');
  ok(Object.isFrozen(membership) && Object.isFrozen(membership.payload)
    && Object.isFrozen(membership.surfaces),
  'membership records, payloads, and surfaces are immutable');
  same(source, {
    at: 777,
    answers: 1,
    solidCards: 3,
    clubStreak: 4,
    courseCount: 2,
  }, 'building a membership moment does not mutate its input');

  const empty = A.buildMembershipMoment({
    at: 888,
    answers: 'bad',
    solidCards: -2,
    clubStreak: Infinity,
    courseCount: {},
  });
  ok(!empty.eligible && !empty.shareable && empty.payload.answers === 0
    && empty.payload.solidCards === 0 && empty.payload.clubStreak === 0
    && empty.payload.courseCount === 0,
  'an empty or malformed club does not expose an eligible membership share');
}

{
  const best = A.buildPersonalBestMoment({
    at: 999,
    bestClean: 37,
    previousBestClean: 24,
    course: { id: 'day-skipper', title: 'Day Skipper' },
  });
  ok(best.id === 'personal-best:37' && best.scope === 'club'
    && best.title === '37 remembered cleanly' && best.payload.value === 37,
  'the durable personal-best builder preserves the exact current record');
  ok(Object.isFrozen(best) && Object.isFrozen(best.payload),
    'durable personal-best records remain immutable');
  ok(A.buildPersonalBestMoment({ at: 1000, bestClean: 19 }) === null,
    'small clean runs stay out of the persistent share surface');
}

{
  const at = new Date(2026, 7, 15, 12, 0, 0).getTime();
  ok(A.previousMonthKey(at) === '2026-07', 'the previous month crosses a calendar boundary');
  const recap = A.buildMonthlyRecap({
    at,
    days: {
      '2026-07-01': 5,
      '2026-07-02': 0,
      '2026-07-10': 7,
      '2026-07-31': 3,
      '2026-08-01': 99,
      malformed: 100,
    },
    solidCards: 81,
    clubStreak: 7,
    courseCount: 2,
  });
  ok(recap.id === 'monthly-recap-2026-07' && recap.eligible,
    'a completed studied month gets one stable recap id');
  same(recap.payload, {
    month: '2026-07',
    studyDays: 3,
    answers: 15,
    solidCards: 81,
    courseCount: 2,
    clubStreak: 7,
  }, 'monthly recap aggregate figures are exact');
  ok(recap.sharePrompt && recap.title === 'July 2026 at the club',
    'a meaningful monthly recap is presentation-ready');
  ok(!A.isMonthlyRecapEligible({
    at,
    month: '2026-08',
    days: { '2026-08-01': 1 },
  }), 'the current month is not recapped before it is complete');
}

{
  const context = A.normaliseContext({
    totalCards: 10,
    solidCards: 999,
    revTotal: 10,
    revGood: 999,
  });
  ok(context.solidCards === 10 && context.solidPercent === 100
    && context.repeatGood === 10 && context.repeatAccuracy === 100,
  'restored or imported counters are bounded before rules see them');
}

{
  const aliases = A.normaliseContext({
    clubAnswers: 200,
    clubSolid: 40,
    totalCards: 10,
    solidPct: 75,
    solidSections: 2,
    bestClean: 31,
    previousBestClean: 22,
    returnGapDays: 18,
  });
  ok(aliases.answers === 200 && aliases.solidCards === 40 && aliases.solidPercent === 75,
    'shell-wide activity and mastery aliases map onto stable rule metrics');
  ok(aliases.keptSections === 2 && aliases.personalBest === 31
    && aliases.previousPersonalBest === 22 && aliases.absenceDays === 18,
  'integration aliases keep session, section, and comeback facts explicit');
}

{
  const at = new Date(2026, 7, 1, 10, 0, 0).getTime();
  const moments = A.sessionMoments({
    at,
    course: {
      id: 'day-skipper',
      title: 'Day Skipper',
      sectionArt: { rules: 'crossing' },
    },
    context: {
      bestClean: 31,
      previousBestClean: 22,
      sessionAnswers: 31,
      newlyKeptSections: [
        { key: 'rules', title: 'Rules of the road' },
        { key: 'rules', title: 'duplicate event' },
      ],
    },
    monthly: {
      month: '2026-07',
      days: { '2026-07-03': 4, '2026-07-10': 6, '2026-07-20': 8 },
      solidCards: 12,
    },
  });
  same(ids(moments), [
    'personal-best:31',
    'section-kept:rules',
    'monthly-recap-2026-07',
  ], 'repeatable personal-best, section, and monthly moments share one pure API');
  ok(moments[0].sharePrompt && moments[0].payload.previous === 22,
    'a newly exceeded personal best carries comparison metadata');
  ok(moments[0].scope === 'club' && moments[1].scope === 'course'
    && moments[2].scope === 'club',
  'repeatable personal best, section, and recap records carry the correct scope');
  ok(moments.every(Object.isFrozen),
    'repeatable records and their scope are immutable');
  ok(moments[1].title === 'Rules of the road — kept' && moments[1].art === 'crossing',
    'repeatable section mastery uses safe course title and art theme');
  ok(moments.every((moment) => moment.dedupeKey || moment.id.startsWith('monthly-recap-')),
    'repeatable moments have stable presentation dedupe identities');
}

{
  const moments = A.sessionMoments({
    at: 1000,
    course: { id: 'local-secret', title: 'Private deck' },
    context: {
      bestClean: 40,
      previousBestClean: 20,
      sessionAnswers: 40,
      newlyKeptSections: [{ key: 'diagnoses', title: 'Private diagnoses', art: 'worm' }],
    },
  });
  ok(moments.length === 2 && moments.every((moment) => (
    moment.payload.courseId === null && moment.payload.courseTitle === null
  )), 'a local course id makes repeatable moments omit the private course identity');
  ok(moments[1].title === 'section kept' && moments[1].payload.sectionKey === null
    && moments[1].payload.sectionTitle === null,
  'repeatable imported section moments omit the private section identity');
}

{
  const moments = A.sessionMoments({
    at: 1000,
    context: {
      bestClean: 19,
      previousBestClean: 0,
      sessionAnswers: 19,
    },
  });
  ok(moments.length === 0, 'small clean runs do not become noisy share moments');
}

for (const line of passes) console.log(line);
for (const line of failures) console.error(line);
console.log(`\n${passes.length} passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
