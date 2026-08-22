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
  Math.random = realRandom;
  return {
    firstPlan, first, secondPlan, second, hardPlan, hard, again,
    ordinaryGood,
    explicitDemotion: {
      ...explicitDemotion,
      proof: provenInterval(explicitDemotion),
    },
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
ok(errors.length === 0, `the progress flow raises no page errors (${errors.join(' | ') || 'none'})`);

await context.close();
await browser.close();
console.log(out.concat(fails).join('\n'));
if (fails.length) {
  console.error(`\n${fails.length} failing`);
  process.exit(1);
}
console.log(`\nall ${out.length} green`);
