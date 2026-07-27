/* The SQLite reader against databases SQLite wrote.
 * usage:  python3 fixtures/make-sqlite.py && node sqlite.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { openDb, SqliteError } from '../web/lib/sqlite.js';

const out = [], fails = [];
const ok = (c, m) => (c ? out : fails).push((c ? 'PASS  ' : 'FAIL  ') + m);

const b64 = (u8) => Buffer.from(u8).toString('base64');

/* One string per value, so a BigInt from our reader and the same number out of
 * Python's JSON compare equal instead of by their JavaScript types. */
const norm = (v) => {
  if (v === null || v === undefined) return '∅';
  if (v instanceof Uint8Array) return 'b:' + b64(v);
  if (v && typeof v === 'object' && 'b64' in v) return 'b:' + v.b64;
  if (typeof v === 'bigint') return 'n:' + v;
  if (typeof v === 'number') return 'n:' + (Number.isInteger(v) ? BigInt(v) : v);
  return 't:' + v;
};
const rowKey = (r) => Object.values(r).map(norm).join('\u001f');

function compare(file, tables) {
  if (!existsSync(new URL(`./fixtures/${file}.db`, import.meta.url))) {
    ok(false, `${file}.db is missing — run fixtures/make-sqlite.py`);
    return;
  }
  const bytes = new Uint8Array(readFileSync(new URL(`./fixtures/${file}.db`, import.meta.url)));
  const want = JSON.parse(readFileSync(new URL(`./fixtures/${file}.json`, import.meta.url), 'utf8'));
  const db = openDb(bytes);

  for (const t of tables) {
    let got;
    try { got = db.rows(t); } catch (e) { ok(false, `${file}.${t}: ${e.message}`); continue; }
    const expect = want[t];
    if (got.length !== expect.length) {
      ok(false, `${file}.${t}: ${got.length} rows, expected ${expect.length}`);
      continue;
    }
    // A b-tree walk is in key order, which for these tables is insertion order;
    // sort anyway so the check is about content, not about ordering luck.
    const a = got.map(rowKey).sort();
    const b = expect.map(rowKey).sort();
    let bad = -1;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { bad = i; break; }
    if (bad >= 0) {
      ok(false, `${file}.${t}: row ${bad} differs\n      got  ${a[bad].slice(0, 160)}\n      want ${b[bad].slice(0, 160)}`);
    } else {
      ok(true, `${file}.${t}: ${got.length} rows read exactly`);
    }
  }
}

compare('sql-basics', ['kinds']);
compare('sql-wide', ['many', 'big']);
compare('sql-norowid', ['pairs', 'lead']);
compare('sql-small-pages', ['many', 'big']);
compare('sql-big-pages', ['many', 'big']);

/* Column names and the rowid alias. */
{
  const bytes = new Uint8Array(readFileSync(new URL('./fixtures/sql-basics.db', import.meta.url)));
  const db = openDb(bytes);
  ok(JSON.stringify(db.columnsOf('kinds')) === JSON.stringify(['id', 't', 'b', 'f', 'n', 'z', 'nul']),
    'column names come off the CREATE TABLE');
  const ids = db.rows('kinds').map((r) => r.id).sort((x, y) => x - y);
  ok(JSON.stringify(ids) === '[1,2,3,4,5,6]', 'integer primary key resolves to the rowid');
  ok(db.rows('kinds').every((r) => r.nul === null), 'a NULL column stays null');
  const three = db.rows('kinds').find((r) => r.id === 3);
  ok(three.b instanceof Uint8Array && three.b.length === 300, 'blobs come back as bytes');
  // Past 2^53 a Number would round, so the reader hands back a BigInt instead
  // of a plausible-looking wrong answer. Anki's own ids are milliseconds and
  // never get near it.
  const huge = db.rows('kinds').find((r) => r.id === 6).n;
  ok(typeof huge === 'bigint' && huge.toString() === '-9223372036854775808',
    'an integer too big for a double comes back exact, as a BigInt');
  ok(db.rows('kinds').find((r) => r.id === 2).t.includes('🐦'), 'text is decoded as UTF-8');
}

/* The DDL a hand-written parser gets wrong. Every one of these was a real
 * defect: the first two are in every Anki collection ever exported. */
compare('sql-ddl', ['config', 'commented', 'words', 'late', 'coll', 'altered']);
{
  const db = openDb(new Uint8Array(readFileSync(new URL('./fixtures/sql-ddl.db', import.meta.url))));
  ok(db.columnsOf('config')[0] === 'KEY',
    `a column called KEY is a column, not a constraint (${db.columnsOf('config')[0]})`);
  ok(JSON.stringify(db.columnsOf('commented')) === JSON.stringify(['id', 'flds', 'sfld', 'csum']),
    `a comment inside CREATE TABLE invents no columns (${db.columnsOf('commented')})`);
  const alt = db.rows('altered').find((r) => r.id === 3);
  ok(alt.b === 7 && alt.c === 'hello',
    `a column added by ALTER reads as its default, not as null (${alt.b}/${alt.c})`);
  const late = db.rows('late')[0];
  ok(late.v.startsWith('val') && late.k.startsWith('key'),
    'a WITHOUT ROWID key that is not the first column still orders the record');
}

/* Rowids past the eight-byte varint. Anki never mints one, but reading it as
 * exactly double the real value is the kind of wrong that never announces
 * itself. */
{
  const db = openDb(new Uint8Array(readFileSync(new URL('./fixtures/sql-rowids.db', import.meta.url))));
  const rows = db.rows('wide');
  const bad = rows.filter((r) => r.s !== 'row' + r.id);
  ok(bad.length === 0, `every rowid reads back exactly (${bad.length ? bad[0].id + ' vs ' + bad[0].s : '9 of 9'})`);
  ok(rows.some((r) => String(r.id) === '9223372036854775807'), 'including the largest one there is');
  ok(rows.some((r) => String(r.id) === '-1'), 'and a negative one');
}

/* Refusals: the reader must say what is wrong rather than loop or lie. */
{
  const junk = new Uint8Array(4096);
  let threw = null;
  try { openDb(junk); } catch (e) { threw = e; }
  ok(threw instanceof SqliteError, 'a non-database is refused by name');

  const bytes = new Uint8Array(readFileSync(new URL('./fixtures/sql-wide.db', import.meta.url)));
  const cut = bytes.slice(0, Math.floor(bytes.length / 2));
  let caught = false;
  try { for (const _ of openDb(cut).each('many')) { /* drain */ } } catch { caught = true; }
  ok(caught, 'a half-downloaded database is refused, not half-read');

  let missing = false;
  try { openDb(bytes).rows('nope'); } catch { missing = true; }
  ok(missing, 'asking for a table that is not there is an error');
}

console.log(out.concat(fails).join('\n'));
if (fails.length) { console.error(`\n${fails.length} failing`); process.exit(1); }
console.log(`\nall ${out.length} green`);
