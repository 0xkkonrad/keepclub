/* Notes, as a person meets them: the panel inside a deck, the words that come
 * back after a reload, the words that never become markup, and what happens to
 * all of them when the deck itself is removed.
 *
 * Browser-level, like the rest of the UI suites, because none of this lives in
 * one function: a note is written through the single-writer rule, stored in the
 * per-deck review document, re-validated by the load sanitiser, and drawn by a
 * modal that owns a history entry and the Tab key.
 */
import { chromium } from 'playwright-core';

const EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || chromium.executablePath();
const URL = process.env.MUNIN_URL || 'http://127.0.0.1:8777/projects/keepclub/web/';
const out = [], fails = [];
const ok = (c, m) => (c ? out : fails).push((c ? 'PASS  ' : 'FAIL  ') + m);
const b = await chromium.launch({ executablePath: EXE });

async function coursePage(options = {}, id = 'day-skipper') {
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block', ...options,
  });
  const page = await ctx.newPage();
  const errors = [];
  const dialogs = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Deleting a note asks first, like every other destructive control here. The
  // wording is kept as well as accepted: what a confirm box promises about the
  // notes is half of what restore is being tested for below.
  page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
  await page.goto(URL + '?course=' + id, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  return { ctx, page, errors, dialogs };
}

/* State writes are debounced, so anything that reads localStorage has to flush
 * with the app's own writeNow() first — the same gotcha every other suite here
 * records. */
const flush = (page) => page.evaluate(() => writeNow());

const write = async (page, text) => {
  await page.fill('#notes-text', text);
  await page.click('#notes-save');
  await flush(page);
};

/** Add a note and then delete it, and hand back the id of the marker it left.
 *  A delete is what the tombstone half of the merge is about, so a restore that
 *  cannot be shown one has not been tested. */
async function writeAndDelete(page, text) {
  await write(page, text);
  const id = await page.evaluate((words) => Object.entries(state.notes)
    .find(([, note]) => note.text === words)[0], text);
  await page.click(`[data-note="${id}"] [data-note-delete]`);
  await page.waitForFunction((value) => !state.notes[value].text, id);
  await flush(page);
  return id;
}

/** Hand a JSON document to the restore <input>, which is what picking a file in
 *  the dialog resolves to. The toast is emptied first so waiting for one is
 *  waiting for this restore rather than seeing the last one's. */
async function restore(page, payload) {
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await page.setInputFiles('#import-file', {
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  await page.waitForFunction(
    () => document.getElementById('toast').textContent.length > 0);
  await flush(page);
}

/** A backup of this deck holding whatever is passed in, stamped the way the
 *  exporter stamps one. `notes` is deliberately absent unless asked for: a file
 *  written before this app had notes is the case that lost them. */
const backupOf = (page, extra) => page.evaluate((over) => Object.assign({
  app: EXPORT_APP,
  format: 1,
  exportedAt: '2026-07-01T00:00:00.000Z',
  v: 1,
  day: '2026-07-01',
  days: { '2026-07-01': 3 },
  lastDay: '2026-07-01',
  streak: 1,
  answers: 3,
  revTotal: 3,
  revGood: 3,
  newDone: 3,
  revDone: 0,
  bestClean: 3,
  ach: {},
  settings: { newPerDay: 20, maxRev: 120, shuffle: true },
  recs: Object.fromEntries(DECK.cards.slice(0, 3).map((card) => [card.cardId, {
    st: 'r', step: 0, ivl: 4, ea: 2.5, due: Date.now() + 4 * 86400000,
    rp: 2, lp: 0, pv: 0,
  }])),
}, over), extra || {});

/* Add, read back, edit, delete — the whole tool, through the controls. */
{
  const { ctx, page, errors } = await coursePage();
  await page.click('#notes-open');
  await page.waitForSelector('#notes:not([hidden])');
  const empty = await page.evaluate(() => ({
    rows: document.querySelectorAll('.notes-list li').length,
    saying: !document.getElementById('notes-empty').hidden,
    focus: document.activeElement?.id,
  }));
  ok(empty.rows === 0 && empty.saying && empty.focus === 'notes-text',
    'a deck with no notes opens on an empty list with the cursor in the box');

  await write(page, 'Springs and neaps are a fortnight apart');
  await write(page, 'Second note');
  const two = await page.evaluate(() => ({
    texts: [...document.querySelectorAll('.note-text')].map((el) => el.textContent),
    row: document.getElementById('notes-row-say').textContent,
    box: document.getElementById('notes-text').value,
    stored: JSON.parse(localStorage.getItem(KEY)).notes,
  }));
  ok(two.texts[0] === 'Second note'
      && two.texts[1] === 'Springs and neaps are a fortnight apart',
  'notes list newest first and the box empties for the next one');
  ok(two.box === '' && /2 notes/.test(two.row),
    `Home counts this deck's notes (${two.row})`);
  const ids = Object.keys(two.stored);
  ok(ids.length === 2 && ids.every((id) => /^[a-z0-9]{1,64}$/.test(id))
      && ids.every((id) => two.stored[id].at > 0 && two.stored[id].ed > 0),
  'each stored note carries its own written and edited stamps under a hex id');

  await page.click('.notes-list li:first-child [data-note-edit]');
  const editing = await page.evaluate(() => ({
    box: document.getElementById('notes-text').value,
    save: document.getElementById('notes-save').textContent,
    cancel: !document.getElementById('notes-cancel').hidden,
  }));
  await write(page, 'Second note, corrected');
  const edited = await page.evaluate(() => ({
    texts: [...document.querySelectorAll('.note-text')].map((el) => el.textContent),
    save: document.getElementById('notes-save').textContent,
    stored: Object.values(JSON.parse(localStorage.getItem(KEY)).notes)
      .filter((note) => note.text).length,
  }));
  ok(editing.box === 'Second note' && /save/i.test(editing.save) && editing.cancel,
    'Edit loads the note into the box and offers to save rather than to add');
  ok(edited.texts[0] === 'Second note, corrected' && edited.texts.length === 2
      && edited.stored === 2,
  'editing changes that note in place instead of writing a second one');
  ok(/add/i.test(edited.save), 'the box goes back to adding once the edit is saved');

  await page.click('.notes-list li:first-child [data-note-delete]');
  await page.waitForTimeout(80);
  await flush(page);
  const gone = await page.evaluate(() => ({
    texts: [...document.querySelectorAll('.note-text')].map((el) => el.textContent),
    row: document.getElementById('notes-row-say').textContent,
    stored: JSON.parse(localStorage.getItem(KEY)).notes,
  }));
  const marker = Object.values(gone.stored).find((note) => !note.text);
  ok(gone.texts.length === 1 && gone.texts[0] === 'Springs and neaps are a fortnight apart',
    'deleting a note takes that note and leaves the other one');
  ok(/1 note\b/.test(gone.row), `Home follows the deletion (${gone.row})`);
  ok(!!marker && marker.ed > marker.at,
    'a deleted note stays as an emptied record so a sync cannot hand it back');
  ok(errors.length === 0, `the notes panel raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The words are still there after a reload, and they came back through the same
 * sanitiser everything else in the document goes through. */
{
  const { ctx, page, errors } = await coursePage({}, 'competent-crew');
  await page.click('#notes-open');
  await write(page, 'Two lines\nsecond line');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  const back = await page.evaluate(() => ({
    row: document.getElementById('notes-row-say').textContent,
    notes: liveNotes().map((note) => note.text),
  }));
  await page.click('#notes-open');
  const drawn = await page.evaluate(() => ({
    text: document.querySelector('.note-text')?.textContent,
    wrap: getComputedStyle(document.querySelector('.note-text')).whiteSpace,
  }));
  ok(back.notes.length === 1 && back.notes[0] === 'Two lines\nsecond line',
    'a note survives a reload through the load sanitiser with its line break');
  ok(drawn.text === 'Two lines\nsecond line' && drawn.wrap === 'pre-wrap',
    'the panel draws the line break rather than collapsing it');
  ok(errors.length === 0, `reloading with notes raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* A note is text a person typed, which makes it the one text in the app that
 * someone can type markup into. It never becomes markup. */
{
  const { ctx, page, errors } = await coursePage();
  const HOSTILE = '<img src=x onerror="window.__owned=1"><script>window.__owned=1</script>'
    + ' & "quoted" \'and\' <b>bold</b>';
  await page.click('#notes-open');
  await write(page, HOSTILE);
  const rendered = await page.evaluate(() => ({
    text: document.querySelector('.note-text').textContent,
    elements: document.querySelector('.note-text').querySelectorAll('*').length,
    owned: !!window.__owned,
    stored: Object.values(JSON.parse(localStorage.getItem(KEY)).notes)[0].text,
  }));
  ok(rendered.text === HOSTILE && rendered.elements === 0 && !rendered.owned,
    'a note that looks like markup is shown as the characters that were typed');
  ok(rendered.stored === HOSTILE,
    'and is stored as those same characters — nothing is stripped on the way in');

  // Control characters and an over-long paste are cut on the way in, not left
  // for the next load to disagree about.
  const long = await page.evaluate(() => {
    addNote('ab\u0001c\td\ne\u0007f' + 'x'.repeat(4000));
    const note = Object.values(state.notes).find((value) => value.text.startsWith('a'));
    return { head: note.text.slice(0, 8), length: note.text.length };
  });
  ok(long.head === 'abc\td\nef',
    `invisible control characters go while tabs and newlines stay (${JSON.stringify(long.head)})`);
  ok(long.length === 2000, `a note is cut to its stored length once (${long.length})`);

  const refused = await page.evaluate(() => ({
    empty: addNote('   \n  '),
    notes: liveNotes().length,
  }));
  ok(refused.empty === false && refused.notes === 2,
    'whitespace is not a note — an empty record is what a delete looks like');
  ok(errors.length === 0, `hostile note text raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Whatever is in storage, the app opens. */
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL + '?course=day-skipper', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  // Written into the live document rather than straight into localStorage: this
  // page rewrites the key from memory on pagehide, so a value planted behind its
  // back is gone before the reload that was meant to read it.
  await page.evaluate(() => {
    // Everything a corrupt file, an older build or a hand-edited backup can put
    // here: the wrong type for the whole block, the wrong type for one note,
    // ids that are not ids, text that is not a string, and stamps that are not
    // numbers. The prototype key exists only via JSON, which is the one route
    // it could actually arrive by.
    state.notes = JSON.parse(`{
      "__proto__": {"at": 1, "ed": 1, "text": "prototype"},
      "Not An Id": {"at": 1, "ed": 1, "text": "rejected"},
      "aa11": "a string, not a note",
      "bb22": {"at": "soon", "ed": null, "text": "kept, with sane stamps"},
      "cc33": {"at": 5, "ed": 9, "text": 12345},
      "dd44": {"at": 5, "text": "no edit stamp"}
    }`);
    writeNow();
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  const survived = await page.evaluate(() => ({
    booted: document.getElementById('boot').hidden,
    ids: Object.keys(state.notes).sort(),
    proto: Object.getPrototypeOf(state.notes) === Object.prototype
      && !('at' in Object.prototype),
    bb: state.notes.bb22,
    cc: state.notes.cc33,
    dd: state.notes.dd44,
    live: liveNotes().length,
  }));
  ok(survived.booted && survived.ids.join() === 'bb22,cc33,dd44',
    `a corrupt notes block does not stop the deck opening (${survived.ids.join()})`);
  ok(survived.proto, 'a "__proto__" note id cannot reach the prototype');
  ok(survived.bb && survived.bb.at === 0 && survived.bb.ed === 0
      && survived.bb.text.startsWith('kept'),
  'unreadable stamps become zero rather than NaN');
  ok(survived.cc && survived.dd && survived.cc.text === ''
      && survived.dd.ed === survived.dd.at,
  'a non-string note is emptied, and a missing edit stamp falls back to the written one');
  ok(survived.live === 2,
    `only what is actually a note is listed (${survived.live})`);

  await page.evaluate(() => { state.notes = 'nope'; writeNow(); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  const blunt = await page.evaluate(() => ({
    booted: document.getElementById('boot').hidden,
    notes: JSON.stringify(state.notes),
  }));
  ok(blunt.booted && blunt.notes === '{}',
    'notes stored as a string are replaced by no notes at all');
  ok(errors.length === 0, `corrupt notes raise no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The panel is a dialog: one history entry, the Tab key, and the control that
 * opened it gets the focus back. */
{
  const { ctx, page, errors } = await coursePage();
  await page.click('#notes-open');
  await page.waitForSelector('#notes:not([hidden])');
  const open = await page.evaluate(() => ({
    app: document.getElementById('app').inert,
    skip: document.querySelector('.skip').inert,
    shelf: document.querySelector('.shelf-btn')?.inert,
    role: document.getElementById('notes').getAttribute('role'),
    modal: document.getElementById('notes').getAttribute('aria-modal'),
  }));
  let trapped = true;
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    trapped &&= await page.evaluate(() =>
      document.getElementById('notes').contains(document.activeElement));
  }
  ok(open.app && open.skip && open.shelf && open.role === 'dialog' && open.modal === 'true',
    'the open panel inerts every control behind it and says it is modal');
  ok(trapped, 'Tab stays inside the notes panel');

  await page.evaluate(() => history.back());
  await page.waitForFunction(() => document.getElementById('notes').hidden);
  const closed = await page.evaluate(() => ({
    focus: document.activeElement?.id,
    app: document.getElementById('app').inert,
    overflow: document.body.style.overflow,
  }));
  ok(closed.focus === 'notes-open' && !closed.app && closed.overflow === '',
    'browser Back closes the panel and hands focus back to the row that opened it');

  await page.click('#notes-open');
  await page.waitForSelector('#notes:not([hidden])');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('notes').hidden);
  const afterEscape = await page.evaluate(() => ({
    focus: document.activeElement?.id,
    screen: current,
  }));
  ok(afterEscape.focus === 'notes-open' && afterEscape.screen === 'home',
    'Escape closes the panel and does not take a screen with it');

  // Closing from inside must consume its own history entry, or the next Back
  // press is eaten by a panel that is no longer there.
  await page.click('#notes-open');
  await page.waitForSelector('#notes:not([hidden])');
  await page.click('#notes-close');
  await page.waitForFunction(() => document.getElementById('notes').hidden);
  // The panel hides synchronously and calls history.back() on its way out; the
  // pop that unwinds the entry lands a tick later, and pressing a tab before it
  // arrives would hand that press to the tab instead.
  await page.waitForTimeout(200);
  await page.click('[data-go="browse"]');
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => current === 'home');
  ok(await page.evaluate(() => current) === 'home',
    'a closed panel leaves no stray history entry behind it');
  ok(errors.length === 0, `panel chrome raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* One writer per deck, notes included: the review document is one JSON value. */
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
  });
  const studying = await ctx.newPage();
  const idle = await ctx.newPage();
  await Promise.all([
    studying.goto(URL + '?course=competent-crew', { waitUntil: 'networkidle' }),
    idle.goto(URL + '?course=competent-crew', { waitUntil: 'networkidle' }),
  ]);
  await Promise.all([
    studying.waitForFunction(() => document.getElementById('boot').hidden),
    idle.waitForFunction(() => document.getElementById('boot').hidden),
  ]);
  await idle.evaluate(() => { addNote('written before the other tab started'); writeNow(); });
  // The other tab adopts that note through the storage event before it takes
  // the lease, or the answer below would be writing over a note it never had.
  await studying.waitForFunction(() => liveNotes().length === 1);
  await studying.evaluate(() => {
    startSession(null, {});
    reveal();
    answer(3);
    writeNow();
  });
  await idle.evaluate(() => { openNotes(null); addNote('written while another tab studies'); });
  await idle.waitForTimeout(150);
  const refused = await idle.evaluate(() => ({
    say: document.getElementById('notes-say').textContent,
    live: liveNotes().map((note) => note.text),
    stored: Object.values(JSON.parse(localStorage.getItem(KEY)).notes)
      .filter((note) => note.text).map((note) => note.text),
  }));
  const kept = await studying.evaluate(() => ({
    answers: state.answers,
    notes: liveNotes().map((note) => note.text),
  }));
  ok(/another tab/i.test(refused.say),
    `the panel says why the note was not written (${refused.say})`);
  ok(refused.live.length === 1 && refused.stored.length === 1
      && refused.live[0] === 'written before the other tab started',
  'a note from an idle tab cannot overwrite the studying tab\'s document');
  ok(kept.answers === 1 && kept.notes.length === 1,
    'the tab that holds the lease keeps both its answer and the earlier note');
  await ctx.close();
}

/* Notes go where the deck goes. Removing an imported deck removes its whole
 * review document, and the shell sweeps the record whenever the shelf draws. */
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.shelf');
  const note = { at: 1, ed: 1, text: 'a note about a deck that is going away' };
  await page.evaluate((value) => {
    localStorage.setItem('munin/local-abcdef12/state/v1',
      JSON.stringify({ v: 1, recs: {}, notes: { aa11: value } }));
    localStorage.setItem('munin/day-skipper/state/v1',
      JSON.stringify({ v: 1, recs: {}, notes: { bb22: value } }));
  }, note);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.shelf');
  let swept = false;
  try {
    await page.waitForFunction(
      () => localStorage.getItem('munin/local-abcdef12/state/v1') === null,
      null, { timeout: 5000 });
    swept = true;
  } catch (e) { swept = false; }
  const builtIn = await page.evaluate(() =>
    localStorage.getItem('munin/day-skipper/state/v1'));
  ok(swept,
    'the notes of a deck that is no longer here are removed with its progress');
  ok(builtIn && JSON.parse(builtIn).notes.bb22.text === note.text,
    'a course that is still here keeps its notes when the shelf sweeps');
  ok(errors.length === 0, `the orphan sweep raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Erasing progress is not the way to delete a note, and does not pretend to be. */
{
  const { ctx, page, errors } = await coursePage({}, 'competent-crew');
  await page.click('#notes-open');
  await write(page, 'Kept across an erase');
  await page.click('#notes-close');
  await page.evaluate(() => {
    startSession(null, {});
    reveal();
    answer(3);
    writeNow();
  });
  await page.evaluate(() => leaveStudy(false));
  await page.click('[data-go="stats"]');
  await page.click('.setup-btn:visible');
  await page.click('#setup-keeping');
  await page.click('#reset-btn');
  await page.waitForFunction(() => state.answers === 0);
  await flush(page);
  const after = await page.evaluate(() => ({
    answers: state.answers,
    records: Object.keys(state.recs).length,
    notes: liveNotes().map((note) => note.text),
    stored: Object.values(JSON.parse(localStorage.getItem(KEY)).notes)
      .filter((note) => note.text).map((note) => note.text),
  }));
  ok(after.answers === 0 && after.records === 0,
    'erasing progress still erases every review');
  ok(after.notes.join() === 'Kept across an erase'
      && after.stored.join() === 'Kept across an erase',
  'erasing review history keeps the notes it never offered to destroy');
  ok(errors.length === 0, `erase-with-notes raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Restoring a backup replaces review history. It does not replace notes, and
 * the older the file the more that matters: a backup exported before this app
 * had notes carries no `notes` key at all, so a restore that took the file's
 * document whole answered "put my reviews back" by deleting every word written
 * since. */
{
  const { ctx, page, errors, dialogs } = await coursePage({}, 'competent-crew');
  await page.click('#notes-open');
  await write(page, 'Kept across a restore');
  const deletedId = await writeAndDelete(page, 'Deleted here, and it stays deleted');
  await page.click('#notes-close');
  await page.waitForTimeout(200);

  const legacy = await backupOf(page);
  ok(!('notes' in legacy), 'the file under test carries no notes key at all');
  await restore(page, legacy);
  const after = await page.evaluate(() => ({
    records: Object.keys(state.recs).length,
    notes: liveNotes().map((note) => note.text),
    stored: JSON.parse(localStorage.getItem(KEY)).notes,
    row: document.getElementById('notes-row-say').textContent,
    toast: document.getElementById('toast').textContent,
  }));
  ok(after.records === 3, `the review history in the file is restored (${after.records})`);
  ok(after.notes.join() === 'Kept across a restore',
    `a backup from before notes existed does not take this device's (${after.notes.length} left)`);
  ok(after.stored[deletedId] && after.stored[deletedId].text === '',
    'and the delete marker crosses the restore with them, so a sync cannot undo the delete');
  ok(/1 note\b/.test(after.row) && /1 note\b/.test(after.toast),
    `Home and the message both count the notes that are still here (${after.toast})`);
  ok(/note/i.test(dialogs.join(' ')) && /kept/i.test(dialogs.join(' ')),
    `the confirm says what the restore does to the notes (${dialogs.join(' | ')})`);
  ok(errors.length === 0, `restoring over notes raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* Two sets of notes meeting is the same meeting a sync is, so it is settled the
 * same way: words from both sides survive, and a delete on either side is not
 * undone by the copy the other side still has. */
{
  const { ctx, page, errors, dialogs } = await coursePage({}, 'competent-crew');
  await page.click('#notes-open');
  await write(page, 'Only on this device');
  const deletedId = await writeAndDelete(page, 'Deleted on this device');
  await page.click('#notes-close');
  await page.waitForTimeout(200);

  const file = await backupOf(page, {
    notes: {
      ff11: { at: 1000, ed: 1000, text: 'Only in the file' },
      // The same note, alive in a file written before it was deleted here.
      [deletedId]: { at: 500, ed: 500, text: 'The file has not heard about the delete' },
    },
  });
  await restore(page, file);
  const after = await page.evaluate(() => ({
    notes: liveNotes().map((note) => note.text).sort(),
    marker: JSON.parse(localStorage.getItem(KEY)).notes,
  }));
  ok(after.notes.join(' | ') === 'Only in the file | Only on this device',
    `a restore keeps the words on both sides (${after.notes.join(' | ')})`);
  ok(after.marker[deletedId] && after.marker[deletedId].text === '',
    'an older live copy in the file does not resurrect a note deleted on this device');
  ok(/merged/i.test(dialogs.join(' ')),
    `and the confirm said the notes would be merged rather than replaced (${dialogs.join(' | ')})`);
  ok(errors.length === 0, `merging notes on restore raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* A deck somebody has written about but not yet studied is worth backing up,
 * the app says so, and the file it produces can be restored on the next device.
 * All three used to fail at a different point: the line said there was nothing
 * to back up, the message said nought cards were exported, and restore refused
 * a file with no card ids it recognised. */
{
  const { ctx, page, errors } = await coursePage({}, 'day-skipper');
  await page.click('#notes-open');
  await write(page, 'A deck I have only written about');
  await write(page, 'Second thought');
  await page.click('#notes-close');
  await page.waitForTimeout(200);
  await page.click('[data-go="stats"]');
  const offer = await page.evaluate(() =>
    document.getElementById('backup-state').textContent);
  ok(/2 notes/.test(offer) && !/nothing to back up/i.test(offer),
    `the backup line counts the notes it would hold (${offer})`);

  // The anchor's click is stubbed rather than the Blob URL: the file the app
  // hands the browser is exactly what is read back here, which is the point.
  const exported = await page.evaluate(async () => {
    let captured = null;
    const create = URL.createObjectURL;
    const click = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => { captured = blob; return create.call(URL, blob); };
    HTMLAnchorElement.prototype.click = function () {};
    document.getElementById('export-btn').click();
    URL.createObjectURL = create;
    HTMLAnchorElement.prototype.click = click;
    return {
      text: await captured.text(),
      toast: document.getElementById('toast').textContent,
      line: document.getElementById('backup-state').textContent,
    };
  });
  const payload = JSON.parse(exported.text);
  const written = Object.values(payload.notes || {}).filter((note) => note.text);
  ok(Object.keys(payload.recs).length === 0 && written.length === 2,
    `an unstudied deck exports the notes it does have (${written.length})`);
  ok(/2 notes/.test(exported.toast) && !/^Exported 0/.test(exported.toast),
    `and the app says that is what it exported (${exported.toast})`);
  ok(errors.length === 0, `exporting notes raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();

  const next = await coursePage({}, 'day-skipper');
  await restore(next.page, payload);
  const landed = await next.page.evaluate(() => ({
    notes: liveNotes().map((note) => note.text).sort(),
    toast: document.getElementById('toast').textContent,
  }));
  ok(landed.notes.join(' | ') === 'A deck I have only written about | Second thought',
    `a notes-only backup restores onto a deck with no history (${landed.notes.length})`);
  ok(!/nothing/i.test(landed.toast) && /2 notes/.test(landed.toast),
    `and is not refused as somebody else's file (${landed.toast})`);
  ok(next.errors.length === 0,
    `restoring a notes-only backup raises no page errors (${next.errors.join(' | ') || 'none'})`);
  await next.ctx.close();
}

/* A file with neither cards of this deck nor notes is still somebody else's. */
{
  const { ctx, page } = await coursePage({}, 'competent-crew');
  const foreign = await backupOf(page, { recs: { 'not-a-card-here': {
    st: 'r', step: 0, ivl: 4, ea: 2.5, due: 100, rp: 2, lp: 0, pv: 0,
  } } });
  await restore(page, foreign);
  const said = await page.evaluate(() => ({
    toast: document.getElementById('toast').textContent,
    records: Object.keys(state.recs).length,
  }));
  ok(/nothing/i.test(said.toast) && said.records === 0,
    `a file with nothing of this deck in it is still refused (${said.toast})`);
  await ctx.close();
}

/* The scrim is a dimming layer, and it has to dim in both themes. Derived from
 * --stroke it was not: that variable is the ink colour, and the ink is nearly
 * white in the dark theme, so the backdrop came out brighter than the panel it
 * was sitting behind. */
{
  const { ctx, page, errors } = await coursePage();
  const read = () => page.evaluate(() => {
    const parse = (value) => (value.match(/[\d.]+/g) || []).map(Number);
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const scrim = parse(getComputedStyle(document.getElementById('notes')).backgroundColor);
    const card = parse(getComputedStyle(document.querySelector('.notes-card')).backgroundColor);
    return {
      theme: document.documentElement.dataset.theme || 'light',
      scrim: lum(scrim),
      card: lum(card),
      alpha: scrim.length > 3 ? scrim[3] : 1,
    };
  });
  await page.click('#notes-open');
  await page.waitForSelector('#notes:not([hidden])');
  const light = await read();
  await page.click('#notes-close');
  await page.waitForTimeout(200);
  await page.click('.setup-btn:visible');
  await page.click('#theme-btn');
  await page.keyboard.press('Escape');
  await page.click('#notes-open');
  await page.waitForSelector('#notes:not([hidden])');
  const dark = await read();
  ok(light.scrim < light.card && light.alpha > 0 && light.alpha < 1,
    `the light theme's scrim is a partly transparent darkening (${light.scrim.toFixed(0)} behind ${light.card.toFixed(0)})`);
  ok(dark.theme === 'dark' && dark.scrim < dark.card && dark.alpha > 0 && dark.alpha < 1,
    `the dark theme's scrim darkens rather than washing the page white (${dark.scrim.toFixed(0)} behind ${dark.card.toFixed(0)})`);
  ok(errors.length === 0, `the scrim raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

/* The panel refuses the 201st note, so nothing that arrives holding more than
 * 200 may be kept quietly at whatever number it came in at — and nothing that
 * arrives holding more than 200 may lose the difference without a word. */
{
  const { ctx, page, errors } = await coursePage({}, 'competent-crew');
  await page.evaluate(() => {
    const now = Date.now();
    state.notes = {};
    for (let i = 0; i < 250; i++) {
      // Newest edit first, so what the ceiling drops is the oldest writing.
      state.notes['n' + i.toString(36).padStart(4, '0')] =
        { at: now - i * 1000, ed: now - i * 1000, text: 'note ' + i };
    }
    writeNow();
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('boot').hidden);
  await page.waitForFunction(() =>
    /notes and cards of your own together at most/i
      .test(document.getElementById('toast').textContent));
  const capped = await page.evaluate(() => {
    const live = liveNotes();
    return {
      count: live.length,
      newest: live[0].text,
      oldest: live[live.length - 1].text,
      toast: document.getElementById('toast').textContent,
      away: document.getElementById('toast').classList.contains('away'),
    };
  });
  ok(capped.count === 200 && capped.newest === 'note 0' && capped.oldest === 'note 199',
    `a document over the live ceiling comes back at it (${capped.count})`);
  ok(/50 notes/.test(capped.toast) && !capped.away,
    `and the app says the words went instead of losing them quietly (${capped.toast})`);
  ok(errors.length === 0, `the note ceiling raises no page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

await b.close();
console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
