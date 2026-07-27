#!/usr/bin/env python3
"""Databases written by SQLite itself, so the reader is checked against the real
format rather than against my reading of the spec.

Each database is paired with a .json file holding exactly what a full scan of
each table should return, dumped through the same sqlite3 that wrote it."""
import base64
import json
import os
import random
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def dump(con, path, tables):
    out = {}
    for t in tables:
        cur = con.execute(f'select * from "{t}"')
        cols = [d[0] for d in cur.description]
        rows = []
        for r in cur.fetchall():
            row = {}
            for c, v in zip(cols, r):
                if isinstance(v, bytes):
                    row[c] = {'b64': base64.b64encode(v).decode()}
                else:
                    row[c] = v
            rows.append(row)
        out[t] = rows
    with open(path, 'w') as f:
        json.dump(out, f)


def build(name, page_size, fn, tables):
    db = os.path.join(HERE, name + '.db')
    if os.path.exists(db):
        os.remove(db)
    con = sqlite3.connect(db)
    con.execute(f'pragma page_size={page_size}')
    con.execute('pragma journal_mode=delete')
    fn(con)
    con.commit()
    con.execute('vacuum')
    dump(con, os.path.join(HERE, name + '.json'), tables)
    con.close()
    print(f'  {name}.db  ({os.path.getsize(db)} bytes, page_size={page_size})')


def basics(con):
    con.execute('create table kinds (id integer primary key, t text, b blob, f real, '
                'n integer, z integer, nul text)')
    rows = [
        (1, 'plain', b'\x00\x01\x02', 1.5, 0, 1, None),
        (2, 'unicode — ümlaut 漢字 🐦', b'', -1.25e300, -1, 1, None),
        (3, '', b'\xff' * 300, 0.0, 2 ** 31, 0, None),
        (4, 'x' * 5, None, None, -(2 ** 47), 1, None),
        (5, None, None, 3.25, 9007199254740991, 0, None),
        (6, 'edge', b'\x7f', -0.0, -(2 ** 63), 1, None),
    ]
    con.executemany('insert into kinds values (?,?,?,?,?,?,?)', rows)


def wide(con):
    """Enough rows to force interior pages, and payloads that straddle the
    overflow boundary in both directions."""
    con.execute('create table many (id integer primary key, s text)')
    random.seed(7)
    con.executemany('insert into many values (?,?)',
                    [(i, f'row-{i}-' + 'abcdefgh' * (i % 17)) for i in range(1, 6001)])
    con.execute('create table big (id integer primary key, body text, tail blob)')
    # Sizes chosen around usable-35 (the local-payload limit) for a 4096-byte
    # page, plus one that needs several overflow pages.
    for i, n in enumerate([3900, 4000, 4050, 4061, 4062, 4063, 4100, 9000, 200000]):
        con.execute('insert into big values (?,?,?)',
                    (i + 1, 'z' * n, bytes((j * 7 + i) % 256 for j in range(n // 3))))


def norowid(con):
    """WITHOUT ROWID stores rows in an index b-tree, keyed by the primary key —
    and the key columns come first in the record whatever order they were
    declared in."""
    con.execute('create table pairs (a text not null, b integer not null, c text, '
                'primary key (b, a)) without rowid')
    con.executemany('insert into pairs values (?,?,?)',
                    [(f'k{i:04}', i, 'v' * (i % 300)) for i in range(400)])
    con.execute('create table lead (k text primary key, v blob) without rowid')
    con.executemany('insert into lead values (?,?)',
                    [(f'key-{i}', bytes([i % 256]) * (i * 37 % 5000)) for i in range(300)])


def ddl(con):
    """The declarations that a hand-written DDL parser gets wrong."""
    # Anki's own config table, at every schema >= 14. `KEY` is a column name.
    con.execute('create table config (KEY text not null primary key, usn integer not null, '
                'mtime_secs integer not null, val blob not null) without rowid')
    con.executemany('insert into config values (?,?,?,?)',
                    [(f'k{i}', i, i * 2, bytes([i % 256]) * 3) for i in range(40)])
    # A comment in the middle of the column list, as in Anki's notes table.
    con.execute("""create table commented (
      id integer primary key,
      flds text not null,
      -- The use of type integer for sfld is deliberate, because it means that integer values
      -- in this field will sort numerically.
      sfld integer not null, /* and a block comment, with a comma, and a ( paren */
      csum integer not null
    )""")
    con.executemany('insert into commented values (?,?,?,?)',
                    [(i, f'f{i}', f's{i}', i) for i in range(30)])
    # Columns whose names are keywords, unquoted.
    con.execute('create table words (check_ text, "primary" text, unique_ text, id integer primary key)')
    con.execute('insert into words values (?,?,?,?)', ('c', 'p', 'u', 1))
    # A WITHOUT ROWID table whose key is neither first nor plainly spelled.
    con.execute('create table late (v text not null, k text not null primary key, w integer) '
                'without rowid')
    con.executemany('insert into late values (?,?,?)', [(f'val{i}', f'key{i:03}', i) for i in range(50)])
    con.execute('create table coll (v text, k text not null, primary key (k collate nocase)) '
                'without rowid')
    con.executemany('insert into coll values (?,?)', [(f'v{i}', f'K{i:03}') for i in range(50)])
    # Columns added after the rows were written read as their default, not null.
    con.execute('create table altered (id integer primary key, a text)')
    con.executemany('insert into altered values (?,?)', [(i, f'a{i}') for i in range(10)])
    con.execute("alter table altered add column b integer not null default 7")
    con.execute("alter table altered add column c text not null default 'hello'")


def rowids(con):
    """Rowids big enough to need the eight- and nine-byte varint."""
    con.execute('create table wide (id integer primary key, s text)')
    for v in [2 ** 20, 2 ** 48, 2 ** 49, 2 ** 55, 2 ** 56, 2 ** 62, 2 ** 63 - 1, -1, -(2 ** 62)]:
        con.execute('insert into wide values (?,?)', (v, f'row{v}'))


if __name__ == '__main__':
    print('sqlite fixtures:')
    build('sql-basics', 4096, basics, ['kinds'])
    build('sql-wide', 4096, wide, ['many', 'big'])
    build('sql-norowid', 4096, norowid, ['pairs', 'lead'])
    build('sql-small-pages', 512, wide, ['many', 'big'])
    build('sql-big-pages', 65536, wide, ['many', 'big'])
    build('sql-ddl', 4096, ddl, ['config', 'commented', 'words', 'late', 'coll', 'altered'])
    build('sql-rowids', 4096, rowids, ['wide'])
