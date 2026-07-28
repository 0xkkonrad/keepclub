#!/usr/bin/env python3
"""Anki packages, built to Anki's own schema.

The DDL here is copied from rslib/src/storage/schema11.sql and the schema15/18
upgrade files in ankitects/anki; the protobuf field numbers from
proto/anki/notetypes.proto and import_export.proto. That is the closest thing to
an authoritative fixture available without installing Anki itself.

Two packages matter:

  legacy.apkg   collection.anki2, schema 11, note types and decks as JSON,
                deflated by the zip, media map as JSON. This is what the
                "support older Anki versions" checkbox writes.
  modern.apkg   collection.anki21b, schema 18, zstd, note types across tables
                with their formats in protobuf — plus the decoy collection.anki2
                that real exports include to tell old Anki to upgrade.
"""
import json
import os
import shutil
import sqlite3
import subprocess
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))

# Copied verbatim from rslib/src/storage/schema11.sql — including the comment in
# the middle of the notes table, which is the point: a fixture that tidies the
# real DDL up is a fixture that cannot catch a DDL parser getting it wrong.
SCHEMA11 = """
CREATE TABLE col (id integer PRIMARY KEY, crt integer NOT NULL, mod integer NOT NULL,
  scm integer NOT NULL, ver integer NOT NULL, dty integer NOT NULL, usn integer NOT NULL,
  ls integer NOT NULL, conf text NOT NULL, models text NOT NULL, decks text NOT NULL,
  dconf text NOT NULL, tags text NOT NULL);
CREATE TABLE notes (
  id integer PRIMARY KEY,
  guid text NOT NULL,
  mid integer NOT NULL,
  mod integer NOT NULL,
  usn integer NOT NULL,
  tags text NOT NULL,
  flds text NOT NULL,
  -- The use of type integer for sfld is deliberate, because it means that integer values in this
  -- field will sort numerically.
  sfld integer NOT NULL,
  csum integer NOT NULL,
  flags integer NOT NULL,
  data text NOT NULL
);
CREATE TABLE cards (id integer PRIMARY KEY, nid integer NOT NULL, did integer NOT NULL,
  ord integer NOT NULL, mod integer NOT NULL, usn integer NOT NULL, type integer NOT NULL,
  queue integer NOT NULL, due integer NOT NULL, ivl integer NOT NULL, factor integer NOT NULL,
  reps integer NOT NULL, lapses integer NOT NULL, left integer NOT NULL, odue integer NOT NULL,
  odid integer NOT NULL, flags integer NOT NULL, data text NOT NULL);
CREATE TABLE revlog (id integer PRIMARY KEY, cid integer NOT NULL, usn integer NOT NULL,
  ease integer NOT NULL, ivl integer NOT NULL, lastIvl integer NOT NULL, factor integer NOT NULL,
  time integer NOT NULL, type integer NOT NULL);
CREATE TABLE graves (usn integer NOT NULL, oid integer NOT NULL, type integer NOT NULL);
CREATE INDEX ix_notes_usn ON notes (usn);
CREATE INDEX ix_cards_usn ON cards (usn);
CREATE INDEX ix_cards_nid ON cards (nid);
CREATE INDEX ix_notes_csum ON notes (csum);
"""

SCHEMA18_EXTRA = """
CREATE TABLE fields (ntid integer NOT NULL, ord integer NOT NULL,
  name text NOT NULL COLLATE unicase, config blob NOT NULL,
  PRIMARY KEY (ntid, ord)) without rowid;
CREATE UNIQUE INDEX idx_fields_name_ntid ON fields (name, ntid);
CREATE TABLE templates (ntid integer NOT NULL, ord integer NOT NULL,
  name text NOT NULL COLLATE unicase, mtime_secs integer NOT NULL, usn integer NOT NULL,
  config blob NOT NULL, PRIMARY KEY (ntid, ord)) without rowid;
CREATE UNIQUE INDEX idx_templates_name_ntid ON templates (name, ntid);
CREATE TABLE notetypes (id integer NOT NULL PRIMARY KEY, name text NOT NULL COLLATE unicase,
  mtime_secs integer NOT NULL, usn integer NOT NULL, config blob NOT NULL);
CREATE UNIQUE INDEX idx_notetypes_name ON notetypes (name);
CREATE TABLE decks (id integer PRIMARY KEY NOT NULL, name text NOT NULL COLLATE unicase,
  mtime_secs integer NOT NULL, usn integer NOT NULL, common blob NOT NULL, kind blob NOT NULL);
CREATE UNIQUE INDEX idx_decks_name ON decks (name);
CREATE TABLE tags (tag text NOT NULL PRIMARY KEY COLLATE unicase, usn integer NOT NULL,
  collapsed boolean NOT NULL, config blob NULL) without rowid;
CREATE TABLE config (
  KEY text NOT NULL PRIMARY KEY,
  usn integer NOT NULL,
  mtime_secs integer NOT NULL,
  val blob NOT NULL
) without rowid;
"""

# ── protobuf, by hand ──────────────────────────────────────────────────────


def varint(n):
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        out.append(b | (0x80 if n else 0))
        if not n:
            return bytes(out)


def pb_var(no, n):
    return varint(no << 3) + varint(n)


def pb_len(no, body):
    return varint((no << 3) | 2) + varint(len(body)) + body


def pb_str(no, s):
    return pb_len(no, s.encode())


def notetype_config(cloze):
    return pb_var(1, 1 if cloze else 0) + pb_str(3, '.card { font-size: 20px; }')


def template_config(qfmt, afmt):
    return pb_str(1, qfmt) + pb_str(2, afmt)


def media_entries(names):
    body = b''
    for n in names:
        body += pb_len(1, pb_str(1, n) + pb_var(2, 10) + pb_len(3, b'\x00' * 20))
    return body


# ── the content both packages share ────────────────────────────────────────

BASIC = 1600000000001
REVERSED = 1600000000002
CLOZE = 1600000000003
HINTED = 1600000000004

NOTETYPES = {
    BASIC: dict(name='Basic', cloze=False, fields=['Front', 'Back'], templates=[
        ('Card 1', '{{Front}}', '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}')]),
    REVERSED: dict(name='Basic (and reversed card)', cloze=False, fields=['Front', 'Back'],
                   templates=[
        ('Card 1', '{{Front}}', '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}'),
        ('Card 2', '{{Back}}', '{{FrontSide}}\n\n<hr id=answer>\n\n{{Front}}')]),
    CLOZE: dict(name='Cloze', cloze=True, fields=['Text', 'Extra'], templates=[
        ('Cloze', '{{cloze:Text}}', '{{cloze:Text}}<br>{{Extra}}')]),
    # A conditional and a type-in box: both common, both change what a card says.
    HINTED: dict(name='Hinted', cloze=False, fields=['Term', 'Meaning', 'Hint'], templates=[
        ('Card 1', '{{Term}}{{#Hint}}<br><i>{{Hint}}</i>{{/Hint}}{{type:Meaning}}',
         '{{FrontSide}}<hr id=answer>{{Meaning}}{{^Hint}}<br>(no hint){{/Hint}}')]),
}

DECKS = {
    1: 'Default',
    1700000000001: 'Sailing::Knots',
    1700000000002: 'Sailing::Tides',
    1700000000003: 'Sailing::Reading::Almanac',
    1700000000004: 'Sailing::Reading::Pilot books',
    1700000000009: 'Filtered study',
}

US = '\x1f'

# (id, mid, deck, fields, tags, cards[(ord, queue, odid)])
NOTES = [
    (2000001, BASIC, 1700000000001, ['What is a bowline?',
     'A loop that will not slip.<br><b>Under load</b>'], 'knots', [(0, 0, 0)]),
    (2000002, BASIC, 1700000000001, ['Clove hitch — what is it for?',
     'Fenders &amp; temporary ties — 45&deg; pull is fine.'], '', [(0, -1, 0)]),
    (2000003, REVERSED, 1700000000002, ['Neap tide', 'The smallest range, at the quarters'],
     'tides marked', [(0, 0, 0), (1, 0, 0)]),
    (2000004, CLOZE, 1700000000002, [
        'The {{c1::halyard}} raises the {{c2::sail}}.', 'Running rigging'], '', [(0, 0, 0), (1, 0, 0)]),
    (2000005, BASIC, 1700000000003, ['<img src="knot.png"> Which knot?',
     '[sound:horn.mp3] A bowline. — ümlaut 漢字 🐦'], '', [(0, 0, 0)]),
    (2000006, BASIC, 1700000000003, ['<img src="gone.png"> Which chart?', 'Missing picture'],
     '', [(0, 0, 0)]),
    # An empty front: Anki keeps the card row, and it renders to nothing.
    (2000007, BASIC, 1700000000004, ['', 'An answer with no question'], '', [(0, 0, 0)]),
    (2000008, HINTED, 1700000000004, ['Leeway', 'Sideways drift from wind', 'starts with L'],
     '', [(0, 0, 0)]),
    (2000009, HINTED, 1700000000004, ['Set', 'The direction a stream runs', ''], '', [(0, 0, 0)]),
    # In a filtered deck: the home deck is odid, and that is where it belongs.
    (2000010, BASIC, 1700000000009, ['Spring tide', 'The biggest range, at full and new moon'],
     '', [(0, 0, 1700000000002)]),
    # A card whose note type is not in the file at all.
    (2000011, 1600000009999, 1700000000001, ['Orphan', 'x'], '', [(0, 0, 0)]),
]

MEDIA = {'knot.png': b'\x89PNG\r\n\x1a\n' + b'fake-png-bytes' * 4,
         'horn.mp3': b'ID3\x03\x00\x00\x00' + b'fake-mp3-bytes' * 4}

HOSTILE = [
    (3000001, BASIC, 1700000000001, [
        'Script tag <script>window.__pwned=1</script> here',
        '<img src="x" onerror="window.__pwned=2"> and <a href="javascript:window.__pwned=3">a link</a>'],
     '', [(0, 0, 0)]),
    (3000002, BASIC, 1700000000001, [
        '<svg><animate onbegin="window.__pwned=4" attributeName="x"></svg>gone?',
        '<iframe src="https://example.com"></iframe><style>body{display:none}</style>ok'],
     '', [(0, 0, 0)]),
    (3000003, BASIC, 1700000000001, [
        '<a href="jav&#x09;ascript:window.__pwned=5">tabbed scheme</a>',
        '<b onclick="window.__pwned=6" style="color:red">styled</b> &amp; entities &lt;kept&gt;'],
     '', [(0, 0, 0)]),
]


def unicase(a, b):
    a, b = a.lower(), b.lower()
    return (a > b) - (a < b)


def new_db(path, schema18):
    if os.path.exists(path):
        os.remove(path)
    con = sqlite3.connect(path)
    con.create_collation('unicase', unicase)
    con.executescript(SCHEMA11)
    if schema18:
        con.executescript(SCHEMA18_EXTRA)
    return con


def fill(con, schema18, notes, decks=DECKS, notetypes=NOTETYPES):
    if schema18:
        for mid, m in notetypes.items():
            con.execute('insert into notetypes values (?,?,?,?,?)',
                        (mid, m['name'], 0, 0, notetype_config(m['cloze'])))
            for i, f in enumerate(m['fields']):
                con.execute('insert into fields values (?,?,?,?)', (mid, i, f, b''))
            for i, (name, q, a) in enumerate(m['templates']):
                con.execute('insert into templates values (?,?,?,?,?,?)',
                            (mid, i, name, 0, 0, template_config(q, a)))
        for did, name in decks.items():
            con.execute('insert into decks values (?,?,?,?,?,?)',
                        (did, name.replace('::', US), 0, 0, b'', b''))
        con.execute('insert into config values (?,?,?,?)', ('curDeck', 0, 0, b'\x01\x02\x03'))
        models = decks_json = '{}'
    else:
        models = json.dumps({str(mid): {
            'id': mid, 'name': m['name'], 'type': 1 if m['cloze'] else 0, 'sortf': 0,
            'css': '.card { font-size: 20px; }',
            'flds': [{'name': f, 'ord': i} for i, f in enumerate(m['fields'])],
            'tmpls': [{'name': n, 'ord': i, 'qfmt': q, 'afmt': a}
                      for i, (n, q, a) in enumerate(m['templates'])],
        } for mid, m in notetypes.items()})
        decks_json = json.dumps({str(d): {'id': d, 'name': n} for d, n in decks.items()})

    con.execute('insert into col values (1,0,0,0,?,0,0,0,?,?,?,?,?)',
                (18 if schema18 else 11, '{}', models, decks_json, '{}', '{}'))

    cid = 5000000
    for nid, mid, did, flds, tags, cards in notes:
        con.execute('insert into notes values (?,?,?,?,?,?,?,?,?,?,?)',
                    (nid, f'g{nid}', mid, 0, 0, f' {tags} ' if tags else '',
                     US.join(flds), flds[0][:60], 0, 0, ''))
        for ordi, queue, odid in cards:
            cid += 1
            con.execute('insert into cards values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                        (cid, nid, did, ordi, 0, 0, 0, queue, 0, 0, 2500, 0, 0, 0, 0, odid, 0, ''))
    con.commit()


def zstd(data):
    return subprocess.run(['zstd', '-q', '-c', '-19'], input=data,
                          stdout=subprocess.PIPE, check=True).stdout


def build_legacy(name, notes, media=MEDIA):
    db = os.path.join(HERE, '_tmp.anki2')
    con = new_db(db, False)
    fill(con, False, notes)
    con.close()
    out = os.path.join(HERE, name)
    names = list(media)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(db, 'collection.anki2')
        z.writestr('media', json.dumps({str(i): n for i, n in enumerate(names)}))
        for i, n in enumerate(names):
            z.writestr(str(i), media[n])
    os.remove(db)
    return out


def build_modern(name, notes, media=MEDIA):
    db = os.path.join(HERE, '_tmp.anki21b')
    con = new_db(db, True)
    fill(con, True, notes)
    con.close()
    with open(db, 'rb') as f:
        raw = f.read()
    os.remove(db)
    out = os.path.join(HERE, name)
    names = list(media)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_STORED) as z:
        z.writestr('meta', pb_var(1, 3))                 # Version::Latest
        z.writestr('collection.anki21b', zstd(raw))
        # Real exports ship this so that old Anki says "please upgrade" rather
        # than importing nothing. Anything reading the package must ignore it.
        decoy = new_db(os.path.join(HERE, '_decoy.anki2'), False)
        decoy.execute("insert into col values (1,0,0,0,11,0,0,0,'{}','{}','{}','{}','{}')")
        decoy.commit()
        decoy.close()
        with open(os.path.join(HERE, '_decoy.anki2'), 'rb') as f:
            z.writestr('collection.anki2', f.read())
        os.remove(os.path.join(HERE, '_decoy.anki2'))
        z.writestr('media', zstd(media_entries(names)))
        for i, n in enumerate(names):
            z.writestr(str(i), zstd(media[n]))
    return out


def build_caps(name):
    """A collection upgraded under Anki 2.1.41–2.1.49, which ran a schema15
    upgrade that spelled the tables FIELDS and TEMPLATES. There is no migration
    that renames them, so those capitals are in the file for ever."""
    db = os.path.join(HERE, '_caps.anki21b')
    con = new_db(db, True)
    fill(con, True, NOTES)
    con.execute('alter table fields rename to FIELDS_TMP')
    con.execute('alter table FIELDS_TMP rename to FIELDS')
    con.execute('alter table templates rename to TEMPLATES_TMP')
    con.execute('alter table TEMPLATES_TMP rename to TEMPLATES')
    con.commit()
    con.close()
    with open(db, 'rb') as f:
        raw = f.read()
    os.remove(db)
    out = os.path.join(HERE, name)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_STORED) as z:
        z.writestr('meta', pb_var(1, 3))
        z.writestr('collection.anki21b', zstd(raw))
        z.writestr('media', zstd(media_entries(list(MEDIA))))
        for i, n in enumerate(MEDIA):
            z.writestr(str(i), zstd(MEDIA[n]))
    return out


def build_big(name, count=3000):
    """Enough notes to cross into interior b-tree pages inside a real package."""
    notes = []
    for i in range(count):
        nid = 4000000 + i
        notes.append((nid, BASIC, 1700000000001 + (i % 2),
                      [f'Question {i} ' + 'padding ' * (i % 40), f'Answer {i}'],
                      '', [(0, 0, 0)]))
    return build_legacy(name, notes, media={})


# Packages that are legal, and awkward. Every one of these is a defect that
# reached a user as lost work, a wrong number, or a card that teaches nothing.
AWKWARD_DECKS = {
    1: 'Default',
    1700000000021: 'Chemistry',
    1700000000022: 'Physics',
    1700000000023: '::',
}

AWKWARD = [
    # A per-cent sign in a filename: decodeURIComponent throws on it.
    (2100001, BASIC, 1700000000021, ['<img src="100%.png"> which flask?', 'the round one'],
     '', [(0, 0, 0)]),
    (2100002, BASIC, 1700000000021, ['[sound:50%off.mp3] what note?', 'a flat one'], '', [(0, 0, 0)]),
    # A cloze note type with nothing hidden, and a cloze card whose ordinal has
    # no deletion: both render the answer on the question side.
    (2100003, CLOZE, 1700000000022, ['No deletions at all here.', 'extra'], '', [(0, 0, 0)]),
    (2100004, CLOZE, 1700000000022, ['The {{c1::halyard}} raises it.', 'extra'], '', [(7, 0, 0)]),
    # Two cards with the same id, and two ids that collapse onto one double.
    (2100005, BASIC, 1700000000022, ['Twin', 'one'], '', [(0, 0, 0)]),
    (2100006, BASIC, 1700000000022, ['Big id 1', 'two'], '', [(0, 0, 0)]),
    (2100007, BASIC, 1700000000023, ['Under a deck called colon-colon', 'three'], '', [(0, 0, 0)]),
]

BIG_IDS = [9007199254740993, 9007199254740992]


def build_awkward(name):
    db = os.path.join(HERE, '_awkward.anki2')
    con = new_db(db, False)
    fill(con, False, AWKWARD, decks=AWKWARD_DECKS)
    # Rewrite the ids of the last few cards by hand: sequential ids cannot
    # express "the same id twice" or "two ids one double apart".
    rows = [r[0] for r in con.execute('select id from cards order by id').fetchall()]
    con.execute('update cards set id=? where id=?', (7777777, rows[-3]))
    con.execute('update cards set id=? where id=?', (BIG_IDS[0], rows[-2]))
    con.commit()
    con.close()
    out = os.path.join(HERE, name)
    media = {'100%.png': b'\x89PNG\r\n\x1a\n' + b'pct', '50%off.mp3': b'ID3' + b'pct',
             'broken.svg': b'<svg xmlns="http://www.w3.org/2000/svg"></svg>'}
    names = list(media)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(db, 'collection.anki2')
        z.writestr('media', json.dumps({str(i): n for i, n in enumerate(names)}))
        for i, n in enumerate(names):
            z.writestr(str(i), media[n])
    os.remove(db)
    return out


def build_badmedia(name):
    """A modern package with one media file whose zstd body is garbage."""
    db = os.path.join(HERE, '_badmedia.anki21b')
    con = new_db(db, True)
    fill(con, True, NOTES)
    con.close()
    with open(db, 'rb') as f:
        raw = f.read()
    os.remove(db)
    out = os.path.join(HERE, name)
    names = list(MEDIA)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_STORED) as z:
        z.writestr('meta', pb_var(1, 3))
        z.writestr('collection.anki21b', zstd(raw))
        z.writestr('media', zstd(media_entries(names)))
        # The zstd magic is intact and the body is nonsense — a half-downloaded
        # file, which used to refuse the whole package.
        z.writestr('0', b'\x28\xb5\x2f\xfd' + b'\xde\xad\xbe\xef' * 4)
        z.writestr('1', zstd(MEDIA[names[1]]))
    return out


def build_junk():
    with open(os.path.join(HERE, 'notzip.apkg'), 'wb') as f:
        f.write(b'this is not a zip file, it is a disappointment' * 20)
    with zipfile.ZipFile(os.path.join(HERE, 'nocollection.apkg'), 'w') as z:
        z.writestr('readme.txt', 'no collection in here')
    # A package whose collection is present but shredded.
    with zipfile.ZipFile(os.path.join(HERE, 'corrupt.apkg'), 'w') as z:
        z.writestr('collection.anki2', b'SQLite format 3\x00' + bytes(2000))


if __name__ == '__main__':
    print('apkg fixtures:')
    for f in [build_legacy('legacy.apkg', NOTES),
              build_modern('modern.apkg', NOTES),
              build_legacy('hostile.apkg', HOSTILE, media={}),
              build_caps('caps.apkg'),
              build_awkward('awkward.apkg'),
              build_badmedia('badmedia.apkg'),
              build_big('big.apkg')]:
        print(f'  {os.path.basename(f)}  ({os.path.getsize(f)} bytes)')
    build_junk()
    print('  notzip.apkg, nocollection.apkg, corrupt.apkg')
