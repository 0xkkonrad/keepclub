/* Check the German sailing drawings in the real renderer, including the longer
 * labels at phone width and the accessible text used for highlighted terms. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.MUNIN_URL || 'http://127.0.0.1:8777/projects/keepclub/web/index.html';
const browser = await chromium.launch({ executablePath:
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath() });
const page = await browser.newPage({ viewport: { width: 320, height: 844 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
try {
  await page.goto(`${base}?course=sailing-in-german`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  await page.evaluate(() => document.fonts.ready);
  const cards = await page.evaluate(() => DECK.cards.filter(c => c.figure).map(c => c.cardId));
  assert.equal(cards.length, 25);
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => MuninTheme.set(theme), theme);
    for (const id of cards) {
      const result = await page.evaluate(id => {
        const card = byId.get(id);
        const def = FIGURES[card.figure.figureId];
        const host = document.createElement('div');
        host.style.cssText = 'width:288px;position:absolute;top:0;left:0';
        host.innerHTML = figureSVG(card);
        document.body.append(host);
        litFigure(host, card);
        const svg = host.querySelector('svg');
        const bounds = svg.getBoundingClientRect();
        const clipped = [...svg.querySelectorAll('text')].filter(t => {
          const r = t.getBoundingClientRect();
          return r.left < bounds.left - 0.5 || r.right > bounds.right + 0.5
            || r.top < bounds.top - 0.5 || r.bottom > bounds.bottom + 0.5;
        }).map(t => t.textContent);
        const active = card.figure.highlightedLabels || def.l;
        const expected = active.map(id => def.labelNames[id]);
        const alt = svg.getAttribute('aria-label');
        const result = { clipped, lang: svg.getAttribute('lang'), alt,
          translated: expected.every(text => text && alt.includes(text)),
          highlights: [...svg.querySelectorAll('[data-l].on')]
            .every(node => active.includes(node.dataset.l)) };
        host.remove();
        return result;
      }, id);
      assert.deepEqual(result.clipped, [], `${theme} ${id}: clipped German labels`);
      assert.equal(result.lang, 'de');
      assert.ok(result.alt.includes('Beschriftet:') && result.translated, `${id}: German accessible labels`);
      assert.ok(result.highlights, `${id}: highlighted geometry`);
    }
  }
  const fallback = await page.evaluate(() => figureAlt(
    { figure: { highlightedLabels: ['bow-line'] } }, { cap: 'A boat.', l: ['bow-line'] }));
  assert.equal(fallback, 'A boat. Labelled: bow line.');
  assert.deepEqual(errors, []);
  console.log('PASS  25 illustrated cards: German labels, accessibility and phone bounds in both themes; English fallback preserved');
} finally {
  await browser.close();
}
