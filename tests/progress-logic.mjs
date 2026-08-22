/* End-to-end regressions for the progress plateau repair.
 *
 * This suite runs unchanged against localhost or the deployed site through
 * MUNIN_URL. It exercises stored records, the real scheduler, both progress
 * surfaces, and their accessible output in Chromium.
 */
import { chromium } from 'playwright-core';

const EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || chromium.executablePath();
const URL = process.env.MUNIN_URL || 'http://127.0.0.1:8777/projects/keepclub/web/';
const NOW = Date.parse('2026-08-22T11:18:43.458Z');
const out = [], fails = [];
const ok = (condition, message) =>
  (condition ? out : fails).push(`${condition ? 'PASS' : 'FAIL'}  ${message}`);

const fakeClock = (initial) => {
  const RealDate = Date;
  globalThis.__muninNow = initial;
  class FakeDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [globalThis.__muninNow])); }
    static now() { return globalThis.__muninNow; }
  }
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  globalThis.Date = FakeDate;
};

const browser = await chromium.launch({ executablePath: EXE });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  timezoneId: 'UTC',
  serviceWorkers: 'block',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
await page.addInitScript(fakeClock, NOW);
await page.goto(URL + (URL.includes('?') ? '&' : '?') + 'course=competent-crew', {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => document.getElementById('boot').hidden);

/* The reported shape: every card seen, every interval young, near-term exam.
 * It must be honestly zero solid rather than synthetic half-credit. */
const plateau = await page.evaluate(() => {
  const recs = {};
  for (const [index, card] of DECK.cards.entries()) {
    recs[card.cardId] = {
      st: 'r', step: 0, ivl: 2 + (index % 6), ea: 2.5,
      due: addCalendarDays(Date.now(), 1 + (index % 5)),
      rp: 2 + (index % 10), lp: 0, pv: 0,
    };
  }
  const cleaned = sanitise({
    ...state,
    recs,
    settings: { ...state.settings, examDate: '2026-09-19' },
  });
  state = cleaned;
  writeNow();
  renderHome();
  const home = Array.from(document.querySelectorAll('#section-list .sections > li button'))
    .map((button) => ({
      meta: button.querySelector('.sect-meta')?.textContent || '',
      label: button.getAttribute('aria-label') || '',
      meter: button.querySelector('.sect-meter')?.getAttribute('aria-hidden') || '',
    }));
  go('stats');
  return {
    cards: DECK.cards.length,
    sections: DECK.sections.length,
    proofs: Object.values(state.recs).map((rec) => rec.pv),
    intervals: Object.values(state.recs).map((rec) => rec.ivl),
    home,
    tiles: Array.from(document.querySelectorAll('#stat-tiles .tile'))
      .map((tile) => tile.textContent.replace(/\s+/g, ' ').trim()),
    rows: Array.from(document.querySelectorAll('#mastery .m-n'))
      .map((row) => row.textContent.replace(/\s+/g, ' ').trim()),
  };
});
ok(plateau.cards === 200 && plateau.sections === 14,
  `the concrete fixture covers all ${plateau.cards} cards and ${plateau.sections} sections`);
ok(plateau.proofs.every((proof, index) => proof === plateau.intervals[index]),
  'legacy review records migrate pv=0 to their surviving interval without inventing history');
ok(plateau.home.length === 14
    && plateau.home.every(({ meta, label }) => /0% known well/.test(meta)
      && /0% known well/.test(label)),
  'all-young Home rows report an accessible 0% known well, never 50%');
ok(plateau.home.every(({ meter }) => meter === ''),
  'zero-solid rows do not draw a misleading half-width meter');
ok(plateau.tiles.some((tile) => /^0solid/.test(tile))
    && plateau.tiles.some((tile) => /^200seen, not solid yet/.test(tile)),
  'Progress agrees: 0 solid and 200 seen, not solid yet');
ok(plateau.rows.length === 14 && plateau.rows.every((row) => /^0 solid/.test(row)),
  'every expanded section agrees that zero cards are solid');

/* A proven 30-day card keeps that proof while exam mode pulls only its next
 * review forward. Clearing the date cannot erase the proof. */
const examMutation = await page.evaluate(() => {
  const id = DECK.cards[0].cardId;
  state.settings.examDate = '';
  state.recs = {
    [id]: {
      st: 'r', step: 0, ivl: 30, ea: 2.5,
      due: addCalendarDays(Date.now(), 30), rp: 8, lp: 0, pv: 0,
    },
  };
  const cleaned = sanitise(state);
  state = cleaned;
  const before = { ...state.recs[id], state: stateOf(id) };
  const input = document.getElementById('set-exam');
  input.value = '2026-09-19';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  const capped = { ...state.recs[id], state: stateOf(id), cap: ceiling() };
  input.value = '';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  const cleared = { ...state.recs[id], state: stateOf(id), cap: ceiling() };
  return { before, capped, cleared };
});
ok(examMutation.before.pv === 30 && examMutation.before.state === 'mature',
  'a legacy 30-day review migrates as proven before exam mode touches it');
ok(examMutation.capped.cap === 6 && examMutation.capped.ivl === 6
    && examMutation.capped.pv === 30 && examMutation.capped.state === 'mature',
  'setting the exam caps only the next gap and keeps the card solid');
ok(examMutation.cleared.ivl === 6 && examMutation.cleared.pv === 30
    && examMutation.cleared.state === 'mature',
  'clearing the exam cannot demote the stored proof');

/* On the date itself there is no positive interval that can still land before
 * the exam. It must not manufacture a one-day cap and move cards to tomorrow. */
const examToday = await page.evaluate(() => {
  const id = DECK.cards[0].cardId;
  state.settings.examDate = '';
  const due = addCalendarDays(Date.now(), 30);
  state.recs = Object.fromEntries(DECK.cards.map((card) => [card.cardId, {
      st: 'r', step: 0, ivl: 30, ea: 2.5,
      due, rp: 8, sr: 8, lp: 0, pv: 30,
    }]));
  const input = document.getElementById('set-exam');
  input.value = '2026-08-22';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  renderHome();
  const todayBanner = document.getElementById('exam-banner').textContent
    .replace(/\s+/g, ' ').trim();
  const recordAfterToday = { ...state.recs[id] };

  state.recs[id].ivl = MAX_IVL;
  state.recs[id].pv = MAX_IVL;
  state.recs[id].due = Date.now();
  session = { ahead: false };
  prepareGradeControls(DECK.cards[0]);
  const todayLabels = Array.from(document.querySelectorAll('#grade-row .iv'))
    .map((label) => label.textContent);

  input.value = '2026-08-21';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  renderHome();
  const pastBanner = document.getElementById('exam-banner').textContent
    .replace(/\s+/g, ' ').trim();
  renderSetup();
  const pastHint = document.getElementById('exam-hint').textContent;
  prepareGradeControls(DECK.cards[0]);
  const pastLabels = Array.from(document.querySelectorAll('#grade-row .iv'))
    .map((label) => label.textContent);

  state = freshState();
  state.settings.examDate = '2026-08-22';
  renderHome();
  const freshBanner = document.getElementById('exam-banner').textContent
    .replace(/\s+/g, ' ').trim();
  const freshSession = buildSession(null, {});
  session = null;
  return {
    days: daysToExam(),
    cap: ceiling(),
    max: MAX_IVL,
    due,
    record: recordAfterToday,
    todayBanner,
    pastBanner,
    pastHint,
    freshBanner,
    freshSessionSize: freshSession.total,
    todayLabels,
    pastLabels,
  };
});
ok(examToday.cap === examToday.max
    && examToday.record.ivl === 30 && examToday.record.pv === 30
    && examToday.record.due === examToday.due,
  'an exam date of today does not move a next review to after the exam');
ok(/spacing window has ended/i.test(examToday.todayBanner)
    && !/comes back.*before/i.test(examToday.todayBanner)
    && /normal due, learning, and new-card rules/i.test(examToday.freshBanner)
    && !/only cards already due/i.test(examToday.freshBanner)
    && examToday.freshSessionSize === 20,
  'exam-day Home copy does not promise a review the inactive cap cannot schedule');
ok(/normal spacing is already back/i.test(examToday.pastBanner)
    && /normal spacing is already active/i.test(examToday.pastHint)
    && examToday.todayLabels.concat(examToday.pastLabels)
      .every((label) => !/max/i.test(label)),
  'past/today dates agree across Home and Settings and do not label the hard limit as an exam max');

/* Correct reviews under the cap must now make mastery advance. The deterministic
 * random midpoint makes the expected natural sequence 6 -> 15 -> 38. */
const scheduling = await page.evaluate(() => {
  const id = DECK.cards[0].cardId;
  const realRandom = Math.random;
  Math.random = () => 0.5;
  state.settings.examDate = '2026-09-19';
  state.recs[id] = {
    st: 'r', step: 0, ivl: 6, ea: 2.5,
    due: Date.now(), rp: 4, lp: 0, pv: 6,
  };
  const firstPlan = schedulePlan(state.recs[id], 3);
  grade(id, 3, firstPlan.ivl, false, firstPlan.natural);
  const first = { ...state.recs[id], state: stateOf(id) };
  const secondPlan = schedulePlan(state.recs[id], 3);
  grade(id, 3, secondPlan.ivl, false, secondPlan.natural);
  const second = { ...state.recs[id], state: stateOf(id) };

  session = { ahead: false };
  prepareGradeControls(DECK.cards[0]);
  const shown = document.getElementById('iv2').textContent;
  const hardPlan = {
    ivl: session.ivls[2], natural: session.naturalIvls[2],
  };
  grade(id, 2, hardPlan.ivl, false, hardPlan.natural);
  const hard = { ...state.recs[id], shown };
  session = null;

  const againPlan = schedulePlan(state.recs[id], 1);
  grade(id, 1, againPlan.ivl, false, againPlan.natural);
  const again = { ...state.recs[id], state: stateOf(id) };

  state.settings.examDate = '';
  const ordinary = {
    st: 'r', step: 0, ivl: 10, ea: 2.5,
    due: Date.now(), rp: 3, lp: 0, pv: 10,
  };
  const ordinaryGood = schedulePlan(ordinary, 3);
  const explicitDemotion = sanitise({
    ...freshState(),
    recs: { x: { ...ordinary, ivl: 30, pv: 6 } },
    settings: { ...freshState().settings, examDate: '' },
  }).recs.x;
  const canonicalZero = sanitise({
    ...freshState(),
    recs: { x: { ...ordinary, ivl: 30, pv: 0, sr: ordinary.rp } },
    settings: { ...freshState().settings, examDate: '' },
  }).recs.x;
  const mergedHistory = {
    ...ordinary, rp: 20, sr: 19,
  };
  state.recs[id] = mergedHistory;
  const mergedPlan = schedulePlan(mergedHistory, 3);
  grade(id, 3, mergedPlan.ivl, false, mergedPlan.natural);
  const afterMergedGrade = { ...state.recs[id] };
  Math.random = realRandom;
  return {
    firstPlan, first, secondPlan, second, hardPlan, hard, again,
    ordinaryGood,
    explicitDemotion: {
      ...explicitDemotion,
      proof: provenInterval(explicitDemotion),
    },
    canonicalZero: {
      ...canonicalZero,
      proof: provenInterval(canonicalZero),
    },
    afterMergedGrade,
  };
});
ok(scheduling.firstPlan.ivl === 6 && scheduling.first.pv === 15
    && scheduling.first.state === 'young',
  'first Good stays within the six-day exam gap while proof advances 6 to 15');
ok(scheduling.secondPlan.ivl === 6 && scheduling.second.pv === 38
    && scheduling.second.state === 'mature',
  'a second Good reaches 38-day proof and crosses the unchanged 21-day threshold');
ok(scheduling.hardPlan.ivl === 6 && scheduling.hardPlan.natural === 38
    && scheduling.hard.ivl === 6 && scheduling.hard.pv === 38
    && /6 days max/.test(scheduling.hard.shown),
  'Hard stores the exact six-day button promise without lowering proven mastery');
ok(scheduling.again.st === 'l' && scheduling.again.pv === 15
    && scheduling.again.state === 'learning',
  'Again remains genuine evidence of forgetting and reduces 38-day proof to 15');
ok(scheduling.ordinaryGood.ivl === 25 && scheduling.ordinaryGood.natural === 25,
  'ordinary no-exam Good scheduling remains the existing 10 to 25 days');
ok(scheduling.explicitDemotion.ivl === 30 && scheduling.explicitDemotion.pv === 6
    && scheduling.explicitDemotion.proof === 6,
  'an explicit positive pv is authoritative and is not resurrected by a larger ivl');
ok(scheduling.canonicalZero.ivl === 30 && scheduling.canonicalZero.pv === 0
    && scheduling.canonicalZero.proof === 0,
  'a canonical zero pv stays zero instead of masquerading as a legacy interval');
ok(scheduling.afterMergedGrade.rp === 21 && scheduling.afterMergedGrade.sr === 20,
  'a local answer advances its schedule revision without copying a merged history floor');

/* Malformed provenance cannot erase the only surviving proof or manufacture a
 * lapse epoch newer than the answers that could have caused it. */
const sanitation = await page.evaluate(() => {
  const malformedSr = [null, false, '', '8', 'not-a-number'].map((sr) => {
    const record = sanitise({
      ...freshState(),
      recs: { x: {
        st: 'r', step: 0, ivl: 30, ea: 2.5, due: 300,
        rp: 8, sr, lp: 2, pv: 0,
      } },
    }).recs.x;
    return { ...record, proof: provenInterval(record) };
  });
  const valid = sanitise({
    ...freshState(),
    recs: { x: {
      st: 'r', step: 0, ivl: 30, ea: 2.5, due: 900,
      rp: 10, sr: 10, lp: 2, pv: 30,
    } },
  }).recs.x;
  const impossible = sanitise({
    ...freshState(),
    recs: { x: {
      st: 'l', step: 1, ivl: 1, ea: 2.5, due: 100,
      rp: 0, sr: 0, lp: 999999, pv: 0,
    } },
  }).recs.x;
  return {
    malformedSr,
    impossible,
    merged: DSSync.pickRec(valid, impossible),
    exportApp: EXPORT_APP,
    legacyExportApp: LEGACY_EXPORT_APP,
    exportFormat: EXPORT_FORMAT,
  };
});
ok(sanitation.malformedSr.length === 5
    && sanitation.malformedSr.every((record) => record.sr === 8
      && record.lp === 2 && record.pv === 30 && record.proof === 30),
  'coercible and nonnumeric sr markers are legacy-shaped and keep the review interval as proof');
ok(sanitation.impossible.lp === 0 && sanitation.merged.lp === 2
    && sanitation.merged.pv === 30 && sanitation.merged.st === 'r',
  'an impossible lapse epoch is bounded by its schedule history and cannot poison sync');
ok(sanitation.exportFormat === 2
    && sanitation.exportApp === `${sanitation.legacyExportApp}:progress-v2`,
  'new backups carry an app stamp cached pre-v2 builds must refuse');

/* Flooring remains right for milestone gates, but a real first solid card in a
 * very large section must not be rendered or announced as zero. */
const subPercent = await page.evaluate(() => {
  const section = DECK.sections[0];
  const originalCount = section.cardCount;
  const group = Array.from(groupOf.values())
    .find((candidate) => candidate.sectionIds.includes(section.sectionId));
  const originalTitle = group.title;
  // Competent Crew's one legacy group is untitled. Give that existing group a
  // temporary title so this fixture exercises the real titled-group renderer.
  group.title = 'Progress QA theme';
  const first = DECK.cards.find((card) => card.sectionId === section.sectionId);
  section.cardCount = 200;
  state.recs = {
    [first.cardId]: {
      st: 'r', step: 0, ivl: 6, ea: 2.5,
      due: addCalendarDays(Date.now(), 6), rp: 5, sr: 5, lp: 0, pv: 21,
    },
  };
  renderHome();
  const button = document.querySelector('#section-list .sections > li button');
  const home = {
    label: button.getAttribute('aria-label'),
    width: button.querySelector('.sect-meter i')?.style.width || '',
    hidden: button.querySelector('.sect-meter')?.getAttribute('aria-hidden') || '',
  };
  renderStats();
  const result = {
    ...home,
    progressHeading: document.querySelector('#mastery .h-part-n')?.textContent || '',
    homePhrase: progressPercent(1, 200, 'known well'),
    groupPhrase: progressPercent(1, 200, 'solid'),
    zeroPhrase: progressPercent(0, 200, 'solid'),
    completePhrase: progressPercent(200, 200, 'solid'),
  };
  section.cardCount = originalCount;
  group.title = originalTitle;
  return result;
});
ok(/less than 1% known well/.test(subPercent.label)
    && subPercent.homePhrase === 'less than 1% known well'
    && subPercent.groupPhrase === 'less than 1% solid'
    && subPercent.zeroPhrase === '0% solid'
    && subPercent.completePhrase === '100% solid',
  'one of 200 is described as non-zero while zero and complete stay exact');
ok(subPercent.width === '0.5%' && subPercent.hidden === 'true',
  'one of 200 draws a decorative half-percent sliver instead of no meter');
ok(/less than 1% solid/.test(subPercent.progressHeading),
  'the real Progress heading exposes a non-zero sub-one-percent value');

/* Boundary and accessibility: the exact 21-day line is unchanged, and a
 * partial visible meter is represented once in the button's accessible name. */
const surface = await page.evaluate(() => {
  const [matureCard, youngCard] = DECK.cards.filter((card) =>
    card.sectionId === DECK.sections[0].sectionId).slice(0, 2);
  state.settings.examDate = '2026-09-19';
  state.recs = {
    [matureCard.cardId]: {
      st: 'r', step: 0, ivl: 6, ea: 2.5, due: Date.now(), rp: 5, lp: 0, pv: 21,
    },
    [youngCard.cardId]: {
      st: 'r', step: 0, ivl: 6, ea: 2.5, due: Date.now(), rp: 3, lp: 0, pv: 20,
    },
  };
  const boundary = [stateOf(youngCard.cardId), stateOf(matureCard.cardId)];
  renderHome();
  const button = document.querySelector('#section-list .sections > li button');
  const meter = button.querySelector('.sect-meter');
  return {
    boundary,
    label: button.getAttribute('aria-label'),
    meta: button.querySelector('.sect-meta').textContent,
    width: meter?.querySelector('i')?.style.width,
    hidden: meter?.getAttribute('aria-hidden'),
    roundedThreshold: wholePercent(25, 101),
  };
});
ok(surface.boundary[0] === 'young' && surface.boundary[1] === 'mature',
  '20 days remains young and exactly 21 days remains solid');
ok(surface.meta === '34 cards' && /2% known well/.test(surface.label)
    && surface.width === '2%' && surface.hidden === 'true',
  'a partial pending section exposes its 2% value and marks the visual meter decorative');
ok(surface.roundedThreshold === 24,
  '25 of 101 displays 24%, so a 25% milestone is never shown early');

// Assert through the accessibility tree, then operate the real control. Direct
// DOM attributes alone still pass when an inert ancestor hides every control.
await page.evaluate(() => go('home'));
const progressButton = page.getByRole('button', { name: /2% known well/i }).first();
ok(await progressButton.count() === 1 && await progressButton.isVisible(),
  'partial progress is exposed as one visible section button in the accessibility tree');
await progressButton.click();
ok(await page.locator('#s-study').isVisible(),
  'the accessible partial-progress section control starts a real study session');
ok(errors.length === 0, `the progress flow raises no page errors (${errors.join(' | ') || 'none'})`);

await context.close();
await browser.close();
console.log(out.concat(fails).join('\n'));
if (fails.length) {
  console.error(`\n${fails.length} failing`);
  process.exit(1);
}
console.log(`\nall ${out.length} green`);
