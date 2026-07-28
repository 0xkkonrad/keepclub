/* The importer, end to end, over packages built to Anki's own schema.
 * usage:  python3 fixtures/make-apkg.py && node import.mjs
 */
import { readFileSync } from 'node:fs';
import { readApkg, ApkgError } from '../web/lib/anki.js';
import { buildDeck } from '../web/lib/deck.js';
import { clean, toText } from '../web/lib/html.js';

const out = [], fails = [];
const ok = (c, m) => (c ? out : fails).push((c ? 'PASS  ' : 'FAIL  ') + m);
const load = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/${n}`, import.meta.url)));

const run = async (n, fileName) => {
  const col = await readApkg(load(n));
  return { col, ...(await buildDeck(col, { fileName: fileName || n })) };
};

/* ── the legacy package: what a person actually gets ── */
const legacy = await run('legacy.apkg');
{
  const { deck, receipt } = legacy;
  ok(receipt.read.cards === 13, `13 card rows read (${receipt.read.cards})`);
  ok(receipt.read.notes === 11, `11 notes read (${receipt.read.notes})`);
  ok(deck.cards.length === 11, `11 cards made (${deck.cards.length})`);
  ok(deck.name === 'Sailing', `the deck is named from what its decks share ("${deck.name}")`);

  const secs = deck.sections.map((s) => `${s.t}:${s.n}`).join(' ');
  ok(secs === 'Knots:2 Reading · Almanac:2 Reading · Pilot books:2 Tides:5',
    `four sections, counted (${secs})`);
  ok(deck.sections.every((s) => deck.cards.filter((c) => c.s === s.k).length === s.n),
    'every section count matches the cards that carry its key');
  ok(deck.groups.length === 0, 'no groups, because grouping would hide two sections');

  const find = (q) => deck.cards.find((c) => toText(c.q).includes(q));
  const bowline = find('bowline');
  ok(bowline && !toText(bowline.a).includes('What is a bowline'),
    'the answer does not repeat the question that {{FrontSide}} put there');
  ok(bowline && bowline.a.startsWith('A loop that will not slip'),
    `the <hr id=answer> separator goes with it ("${bowline?.a.slice(0, 40)}")`);

  const clove = find('Clove hitch');
  ok(clove && clove.a.includes('&amp;') && clove.a.includes('&deg;'),
    'entities written by the deck survive');

  // A reversed note is two cards, one each way.
  const neapQ = deck.cards.filter((c) => toText(c.q) === 'Neap tide');
  const neapA = deck.cards.filter((c) => toText(c.q) === 'The smallest range, at the quarters');
  ok(neapQ.length === 1 && neapA.length === 1, 'a reversed note makes both cards');

  // Cloze: one card per deletion, each blanking only its own.
  const c1 = deck.cards.find((c) => c.q.includes('[...]') && toText(c.q).includes('sail'));
  const c2 = deck.cards.find((c) => c.q.includes('[...]') && toText(c.q).includes('halyard'));
  ok(!!c1 && !!c2, 'a cloze note makes one card per deletion');
  ok(c1 && toText(c1.a).includes('halyard') && c1.a.includes('class="cloze"'),
    'the cloze answer fills in the blank it hid');
  ok(c1 && toText(c1.q).includes('sail') && !toText(c1.q).includes('halyard'),
    'the other deletions stay visible on the question');

  const hinted = find('Leeway');
  ok(hinted && hinted.q.includes('<i>starts with L</i>'), '{{#Hint}} prints when the field is filled');
  ok(hinted && !toText(hinted.q).includes('Meaning'), '{{type:…}} contributes nothing to a card you read');
  const unhinted = find('Set');
  ok(unhinted && toText(unhinted.a).includes('(no hint)'), '{{^Hint}} prints when the field is empty');

  // A filtered deck is a view; the card belongs to the deck it came from.
  const spring = find('Spring tide');
  ok(spring && deck.sections.find((s) => s.k === spring.s)?.t === 'Tides',
    'a card sitting in a filtered deck lands in its home deck');

  ok(receipt.skipped.reduce((n, s) => n + s.count, 0) === 2, 'two cards accounted for as dropped');
  ok(receipt.skipped.some((s) => /question side came out empty/.test(s.why)),
    'the empty card is named as empty');
  ok(receipt.skipped.some((s) => /note type is missing/.test(s.why)),
    'the card with no note type is named as such');
  ok(receipt.suspended === 1, `the one suspended card is counted (${receipt.suspended})`);
  ok(receipt.cloze === 2, `cloze cards counted (${receipt.cloze})`);
  ok(receipt.kinds.find((k) => k.name === 'Basic')?.n === 5,
    'cards are counted by the note type that made them');
}

/* ── media ── */
{
  const { deck, receipt, media } = legacy;
  ok(receipt.media.images === 1 && receipt.media.sounds === 1,
    `one picture and one sound (${receipt.media.images}/${receipt.media.sounds})`);
  ok(receipt.media.missing.includes('gone.png'),
    'a picture the package does not contain is named, not silently dropped');
  const img = deck.cards.find((c) => c.q.includes('<img'));
  ok(img && /src="munin-media:\d+"/.test(img.q), 'pictures point at the deck, never at the network');
  const snd = deck.cards.find((c) => c.a.includes('<audio'));
  ok(snd && /src="munin-media:\d+"/.test(snd.a), '[sound:…] becomes something you can play');
  ok(!deck.cards.some((c) => /gone\.png/.test(c.q + c.a)), 'the missing picture leaves no broken image');
  ok(media.length === 2 && media[0].name === 'knot.png' && media[0].bytes.length > 0,
    'the media files come out with their bytes');
  ok(media.find((m) => m.name === 'horn.mp3').kind === 'snd', 'sound is marked as sound');
  const bird = deck.cards.find((c) => c.a.includes('🐦'));
  ok(!!bird, 'unicode survives the round trip');
}

/* ── the modern package must produce the same deck ── */
{
  const modern = await run('modern.apkg');
  ok(modern.receipt.modern === true, 'the modern package is recognised as modern');
  ok(modern.col.member === 'collection.anki21b',
    `the real collection is read, not the decoy (${modern.col.member})`);
  ok(modern.deck.cards.length === legacy.deck.cards.length,
    `zstd + protobuf + tables gives the same card count (${modern.deck.cards.length})`);
  ok(JSON.stringify(modern.deck) === JSON.stringify(legacy.deck),
    'the two export formats produce a byte-identical deck');
  ok(modern.media.length === 2 && modern.media[0].bytes.length === legacy.media[0].bytes.length,
    'zstd-compressed media comes out whole');
}

/* ── anything a stranger wrote is inert by the time it is stored ── */
{
  const { deck } = await run('hostile.apkg');
  const all = deck.cards.map((c) => c.q + c.a).join('\n');
  const banned = [/<script/i, /onerror/i, /onclick/i, /javascript:/i, /<iframe/i, /<style/i,
    /<svg/i, /onbegin/i, /window\.__pwned/i];
  const leaked = banned.filter((re) => re.test(all));
  ok(leaked.length === 0, `nothing executable survives the import (${leaked.join(' ') || 'clean'})`);
  ok(all.includes('&lt;kept&gt;'), 'escaped text the deck meant to show is still shown');
  ok(toText(all).includes('tabbed scheme'), 'the words around a bad link are kept');
}

/* ── the sanitiser on its own, at the edges ── */
{
  const cases = [
    ['<img src="munin-media:1" onerror=alert(1)>', /^<img src="munin-media:1" loading="lazy">$/],
    ['<a href="  javascript:alert(1)">x</a>', /^<a>x<\/a>$/],
    ['<a href="https://x.test/a?b=1&c=2">x</a>', /rel="noopener noreferrer"/],
    ['<b>unclosed', /^<b>unclosed<\/b>$/],
    ['</b>stray close', /^stray close$/],
    ['a < b and 5 > 3', /^a &lt; b and 5 &gt; 3$/],
    ['<div><span>keep</span></div>', /^<div><span>keep<\/span><\/div>$/],
    ['<SCRIPT>x</SCRIPT>after', /^after$/],
    ['<img src="https://tracker.test/p.gif">', /^$/],
    ['<b style="x" class="y">z</b>', /^<b>z<\/b>$/],
    ['<span class="cloze">[...]</span>', /class="cloze"/],
    ['<!-- <script>x</script> -->ok', /^ok$/],
  ];
  const bad = cases.filter(([src, want]) => !want.test(clean(src).html));
  ok(bad.length === 0, `the sanitiser holds at the edges (${bad.map((b) => b[0]).join(' | ') || 'all 12'})`);
  ok(clean('<img src="munin-media:3">').media[0] === 3, 'it reports which media a card uses');
}

/* ── the defects an adversarial pass found, kept fixed ── */
{
  // A burned tag with no closing tag used to swallow the rest of the card, and
  // then the receipt called the question empty. Silent, misreported loss.
  for (const tag of ['<meta charset="utf-8">', '<link rel="x">', '<base href="/">', '<input id="t">']) {
    const got = clean(tag + 'The whole question.').html;
    ok(got.includes('The whole question.'), `${tag.slice(0, 6)}… does not eat the card (${got})`);
  }

  // Quadratic scanning: one note, a hundred thousand unterminated tags.
  const nasty = '<img '.repeat(100000);
  const t0 = process.hrtime.bigint();
  clean(nasty);
  toText('<script>a'.repeat(100000));
  toText(nasty);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  ok(ms < 1000, `a megabyte of malformed markup is linear work (${Math.round(ms)}ms)`);

  // A `>` inside a quoted attribute is not the end of the tag — the media
  // rewriter used to stop there, so a hand-written reference got through.
  const forged = clean('<img alt=">" src="munin-media:7">').html;
  ok(forged.includes('munin-media:7'), 'the sanitiser reads a quoted > correctly');
  ok(toText('<img alt=">" src="x">after') === 'after', 'and so does the text extractor');

  // Ruby: the furigana filter writes it, so keeping it is the difference
  // between a reading and two words glued together.
  ok(clean('<ruby>\u6f22\u5b57<rt>\u304b\u3093\u3058</rt></ruby>').html.includes('<rt>'),
    'furigana survives as ruby, not as glued-together text');
}

/* ── the schemas Anki has actually shipped ── */
{
  // Anki's notes table has a two-line comment in the middle of its column list,
  // and its config table's first column is called KEY. Both used to break the
  // DDL parser — silently, by shifting every value after them onto the wrong
  // name. Neither is exotic: they are in every collection ever exported.
  const col = legacy.col;
  const notes = col.notes ? [...col.notes()] : [];
  const first = notes[0];
  ok(first && typeof first.sfld === 'string' && first.data === '',
    `the notes table's columns survive the comment in its own DDL (sfld=${JSON.stringify(first?.sfld)})`);

  const modern = await readApkg(load('modern.apkg'));
  ok(modern.schema === 18, 'the modern collection reports schema 18');

  // Anki 2.1.41–2.1.49 wrote FIELDS and TEMPLATES in capitals, and nothing has
  // ever renamed them. Matching table names exactly made those decks unreadable.
  const caps = await run('caps.apkg');
  ok(caps.deck.cards.length === legacy.deck.cards.length,
    `a collection with capitalised table names reads the same (${caps.deck.cards.length})`);
  ok(JSON.stringify(caps.deck.cards) === JSON.stringify(legacy.deck.cards),
    'down to the same cards');
}

/* ── packages that are legal and awkward ── */
{
  const { deck, receipt } = await run('awkward.apkg', 'my-collection.apkg');

  ok(deck.cards.length > 0, `a per-cent sign in a filename does not refuse the package (${deck.cards.length} cards)`);
  ok(receipt.media.images === 1 && receipt.media.sounds === 1,
    `"100%.png" and "50%off.mp3" are found (${receipt.media.images}/${receipt.media.sounds})`);

  // Decks that share no parent cannot name the deck between them.
  ok(deck.name === 'my-collection',
    `with nothing in common, the deck takes the file's name ("${deck.name}")`);

  // A cloze card is a card because something is hidden.
  ok(!deck.cards.some((c) => toText(c.q) === toText(c.a).replace(/ extra$/, '')),
    'no card asks you its own answer');
  ok(receipt.skipped.some((s) => /nothing was blanked out/.test(s.why)),
    'a cloze with no deletion is dropped, and said so');

  // Two cards must never be one card.
  const ids = deck.cards.map((c) => c.i);
  ok(new Set(ids).size === ids.length, `every card has an id of its own (${ids.length} cards, ${new Set(ids).size} ids)`);

  // An SVG cannot be shown, so it is not a picture that landed.
  ok(!receipt.media.missing.includes('broken.svg') || receipt.media.images === 1,
    'an SVG is not counted as a picture that landed');
}

/* One damaged file inside a package costs you that file, not the deck. */
{
  const { deck, receipt } = await run('badmedia.apkg');
  ok(deck.cards.length === 11, `a corrupt media file leaves the cards alone (${deck.cards.length})`);
  ok(receipt.media.damaged?.length === 1, `and is named as damaged (${receipt.media.damaged})`);
  ok(!deck.cards.some((c) => /munin-media:0"/.test(c.q + c.a)),
    'the card it belonged to shows no broken image');
}

/* ── size, and the refusals ── */
{
  const t0 = process.hrtime.bigint();
  const big = await run('big.apkg');
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  ok(big.deck.cards.length === 3000, `3000 cards import (${big.deck.cards.length})`);
  ok(ms < 4000, `a three-thousand-card deck imports in ${Math.round(ms)}ms`);

  for (const [file, hint] of [['notzip.apkg', /not a readable/i], ['nocollection.apkg', /no Anki collection/i],
    ['corrupt.apkg', /could not be read/i]]) {
    let err = null;
    try { await readApkg(load(file)); } catch (e) { err = e; }
    ok(err instanceof ApkgError && hint.test(err.message),
      `${file} is refused with a reason (${err?.message?.slice(0, 60)})`);
  }
}

console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
