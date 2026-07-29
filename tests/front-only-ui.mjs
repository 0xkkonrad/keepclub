/* Front-only cards through the real Study and Browse surfaces.
 *
 * The built-in courses intentionally remain backed format-1 fixtures, so this
 * suite substitutes one valid format-2 course at the fetch boundary.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const EXE = process.env.HOME
  + '/.cache/ms-playwright/chromium_headless_shell-1217/'
  + 'chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = process.env.MUNIN_URL
  || 'http://127.0.0.1:8777/projects/keepclub/web/';
const out = [], fails = [];
const ok = (condition, message) =>
  (condition ? out : fails).push((condition ? 'PASS  ' : 'FAIL  ') + message);

const COURSE = {
  schemaVersion: 2,
  courseId: 'day-skipper',
  title: 'Front-only QA',
  cards: [
    { cardId: 'front-text', front: 'A reminder with **no hidden answer**.' },
    {
      cardId: 'front-image',
      media: [{
        side: 'front',
        mediaType: 'image',
        source: 'media/prompt.png',
        alternativeText: 'A simple image prompt.',
        width: 1,
        height: 1,
      }],
    },
    {
      cardId: 'front-audio',
      front: 'Listen to this audio prompt.',
      media: [{
        side: 'front',
        mediaType: 'audio',
        source: 'media/prompt.mp3',
        caption: 'Audio prompt',
      }],
    },
    {
      cardId: 'front-video',
      front: 'Watch this video prompt.',
      media: [{
        side: 'front',
        mediaType: 'video',
        source: 'media/prompt.mp4',
        caption: 'Video prompt',
      }],
    },
    { cardId: 'backed', front: 'A backed prompt.', back: 'The concealed solution.' },
    {
      cardId: 'back-media',
      front: 'A prompt with an audio answer.',
      media: [{
        side: 'back',
        mediaType: 'audio',
        source: 'media/answer.mp3',
        caption: 'Audio answer',
      }],
    },
  ],
};

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZfH0AAAAASUVORK5CYII=',
  'base64',
);

const browser = await chromium.launch({ executablePath: EXE });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  serviceWorkers: 'block',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
await page.route('**/courses/day-skipper/cards.json', (route) => route.fulfill({
  contentType: 'application/json',
  body: JSON.stringify(COURSE),
}));
await page.route('**/courses/day-skipper/media/*', (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path.endsWith('.png')) {
    return route.fulfill({ contentType: 'image/png', body: PNG });
  }
  return route.fulfill({
    contentType: path.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4',
    body: '',
  });
});

await page.goto(BASE + '?course=day-skipper', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.getElementById('boot').hidden);

const predicate = await page.evaluate(() => ({
  empty: hasBackContent({ cardId: 'empty', front: 'Front' }),
  frontMedia: hasBackContent({
    cardId: 'front-media',
    media: [{ side: 'front', mediaType: 'audio', source: 'media/a.mp3' }],
  }),
  backMedia: hasBackContent({
    cardId: 'back-media',
    media: [{ side: 'back', mediaType: 'audio', source: 'media/a.mp3' }],
  }),
  backText: hasBackContent({ cardId: 'back-text', back: 'Answer' }),
  figure: hasBackContent({ cardId: 'figure', figure: { figureId: 'one' } }),
}));
ok(!predicate.empty && !predicate.frontMedia && predicate.backMedia
    && predicate.backText && predicate.figure,
'one back-content predicate distinguishes prompts from every second-side presentation');

const show = async (cardId, tail = 'backed') => {
  await page.evaluate(({ cardId, tail }) => {
    if (!session) startSession(null, {});
    session.queue = [cardId, tail];
    session.total = 2;
    session.done = 0;
    session.revealed = false;
    showCard();
    settleDock(false);
  }, { cardId, tail });
};

await show('front-text');
const immediate = await page.evaluate(() => ({
  answerHidden: $('#answer-wrap').hidden,
  answerText: $('#card-a').textContent,
  revealHidden: $('#reveal-btn').hidden,
  gradesHidden: $('#grade-row').hidden,
  ready: session.revealed,
  instruction: $('#grade-ask').textContent,
  liveRole: $('#grade-ask').getAttribute('role'),
  labelledBy: $('#grade-row').getAttribute('aria-labelledby'),
  focusGrade: document.activeElement?.dataset.g,
  hint: $('#keyhint').textContent,
}));
ok(immediate.answerHidden && !immediate.answerText && immediate.revealHidden
    && !immediate.gradesHidden && immediate.ready,
'a text-only front has no visible answer region or reveal control and is grade-ready');
ok(/no answer to reveal/i.test(immediate.instruction)
    && immediate.liveRole === 'status' && immediate.labelledBy === 'grade-ask'
    && immediate.focusGrade === '3',
'front-only grading has a live instruction and useful Good-button focus');
ok(/Space\/Enter grades Good/i.test(immediate.hint),
'the visible keyboard policy says Space/Enter grades Good');

/* Mouse grading and Undo use the unchanged answer/snapshot path. */
await page.click('.grade[data-g="1"]');
let mouse = await page.evaluate(() => ({
  current: currentCard()?.cardId,
  stored: !!state.recs['front-text'],
  undo: !$('#undo-btn').disabled,
}));
ok(mouse.current === 'backed' && mouse.stored && mouse.undo,
'mouse grading records a front-only card through the ordinary scheduler');
await page.click('#undo-btn');
const undone = await page.evaluate(() => ({
  current: currentCard()?.cardId,
  stored: !!state.recs['front-text'],
  grades: !$('#grade-row').hidden,
  focus: document.activeElement?.dataset.g,
}));
ok(undone.current === 'front-text' && !undone.stored && undone.grades
    && undone.focus === '3',
'Undo restores the front-only prompt, schedule, controls, and focus');

/* 1–4 are live immediately. Good-button focus gives Space/Enter their native,
 * deliberate meaning without a hidden reveal state. */
await page.keyboard.press('2');
ok(await page.evaluate(() => currentCard()?.cardId === 'backed'
    && !!state.recs['front-text']),
'number keys grade before any reveal on a front-only card');
await show('front-audio');
await page.keyboard.press('Space');
ok(await page.evaluate(() => currentCard()?.cardId === 'backed'
    && !!state.recs['front-audio']),
'Space activates the focused Good grade on a front-only card');
await show('front-video');
await page.keyboard.press('Enter');
ok(await page.evaluate(() => currentCard()?.cardId === 'backed'
    && !!state.recs['front-video']),
'Enter activates the focused Good grade on a front-only card');

await show('front-video');
await page.locator('.grade[data-g="4"]').tap();
ok(await page.evaluate(() => currentCard()?.cardId === 'backed'),
'touch can grade a front-only prompt immediately');

/* A media-only front is still a prompt, never an answer. */
await show('front-image');
const imagePrompt = await page.evaluate(() => ({
  question: $('#card-q').textContent,
  images: $('#card-front-media').querySelectorAll('img').length,
  alt: $('#card-front-media img')?.alt,
  answerHidden: $('#answer-wrap').hidden,
  revealHidden: $('#reveal-btn').hidden,
}));
ok(!imagePrompt.question && imagePrompt.images === 1
    && imagePrompt.alt === 'A simple image prompt.'
    && imagePrompt.answerHidden && imagePrompt.revealHidden,
'a front-side image alone renders as a front-only prompt');
await page.click('#card-front-media .side-media-image');
ok(await page.locator('#lightbox').isVisible(),
'a front-side prompt image opens independently');
await page.click('#lb-close');

await show('front-audio');
ok(await page.locator('#card-front-media audio[controls]').count() === 1,
'a front-side audio prompt renders native controls');
await show('front-video');
ok(await page.locator('#card-front-media video[controls]').count() === 1,
'a front-side video prompt renders native controls without becoming a back');

/* A back-side attachment is a real second side even without back text, and the
 * absent text node does not receive focus. */
await show('back-media');
ok(await page.locator('#reveal-btn').isVisible()
    && await page.locator('#grade-row').isHidden(),
'back-side media keeps the two-step reveal interaction');
await page.click('#reveal-btn');
const mediaBack = await page.evaluate(() => ({
  audio: $('#card-back-media').querySelectorAll('audio[controls]').length,
  answerText: $('#card-a').textContent,
  focus: document.activeElement?.tagName,
}));
ok(mediaBack.audio === 1 && !mediaBack.answerText && mediaBack.focus === 'AUDIO',
'a media-only back renders on reveal and focuses its useful control, not an empty answer');

/* Backed cards keep the old two-step path. One grade through each path produces
 * the same scheduler record shape. */
await show('backed', 'front-image');
const beforeReveal = await page.evaluate(() => ({
  reveal: !$('#reveal-btn').hidden,
  grades: !$('#grade-row').hidden,
  answer: !$('#answer-wrap').hidden,
  stored: !!state.recs.backed,
}));
await page.keyboard.press('1');
ok(beforeReveal.reveal && !beforeReveal.grades && !beforeReveal.answer
    && !beforeReveal.stored && !await page.evaluate(() => !!state.recs.backed),
'a backed card still ignores 1–4 until its answer is revealed');
await page.keyboard.press('Space');
const revealed = await page.evaluate(() => ({
  answer: !$('#answer-wrap').hidden,
  text: $('#card-a').textContent,
  focus: document.activeElement?.id,
}));
ok(revealed.answer && /concealed solution/i.test(revealed.text)
    && revealed.focus === 'card-a',
'Space still reveals and focuses an ordinary backed answer');
await page.keyboard.press('Enter');
ok(await page.evaluate(() => !!state.recs.backed),
'Enter after reveal still grades Good on a backed card');

/* Use two untouched cards so both records are new-card Good records. */
await page.evaluate(() => {
  delete state.recs['front-image'];
  delete state.recs['back-media'];
});
await show('front-image', 'backed');
await page.click('.grade[data-g="3"]');
const frontRecord = await page.evaluate(() => ({ ...state.recs['front-image'] }));
await show('back-media', 'backed');
await page.click('#reveal-btn');
await page.click('.grade[data-g="3"]');
const backedRecord = await page.evaluate(() => ({ ...state.recs['back-media'] }));
ok(JSON.stringify(frontRecord) === JSON.stringify(backedRecord),
'front-only and backed Good grades produce identical scheduler record shapes');

/* Browse: front-only rows have no disclosure/answer/snippet, while metadata and
 * front media remain reachable. Backed rows preserve disclosure and snippets. */
await page.evaluate(() => {
  releaseStudyLock();
  session = null;
  go('browse');
  $('#sect-filter').value = 'all-cards';
  $('#search').value = '';
  renderBrowse();
});
const browse = await page.evaluate(() => {
  const front = document.querySelector('[data-card="front-text"]');
  const media = document.querySelector('[data-card="front-image"]');
  const backed = document.querySelector('[data-card="backed"]');
  return {
    order: browseHits.map((hit) => hit.c.cardId),
    frontDetails: front.querySelectorAll('details').length,
    frontAnswers: front.querySelectorAll('.browse-ans').length,
    frontSnippet: front.querySelectorAll('.b-why:not([hidden])').length,
    frontMeta: front.querySelector('.b-sect')?.textContent,
    mediaImage: media.querySelectorAll('.b-front-media img').length,
    backedDetails: backed.querySelectorAll('details').length,
    backedAnswers: backed.querySelectorAll('.browse-ans').length,
  };
});
ok(JSON.stringify(browse.order) === JSON.stringify(COURSE.cards.map((card) => card.cardId)),
'Browse preserves authored card order');
ok(!browse.frontDetails && !browse.frontAnswers && !browse.frontSnippet
    && /all cards/i.test(browse.frontMeta),
'Browse omits empty front-only disclosures/snippets while keeping metadata visible');
ok(browse.mediaImage === 1,
'Browse keeps front-side media reachable outside an answer disclosure');
ok(browse.backedDetails === 1 && browse.backedAnswers === 1,
'Browse retains the answer disclosure for backed cards');

await page.fill('#search', 'concealed solution');
await page.waitForTimeout(300);
const search = await page.evaluate(() => ({
  ids: browseHits.map((hit) => hit.c.cardId),
  snippet: document.querySelector('#browse-list .b-why:not([hidden])')?.textContent || '',
}));
ok(search.ids.length === 1 && search.ids[0] === 'backed'
    && /concealed solution/i.test(search.snippet),
'back-answer search ordering and explanatory snippets remain intact');

ok(errors.length === 0, `front-only browser coverage raises no page errors (${errors.join(' | ') || 'none'})`);

await context.close();
await browser.close();
assert.equal(fails.length, 0, fails.join('\n'));
console.log([...out, ...fails].join('\n'));
console.log(`\n${out.length} passed, ${fails.length} failed`);
