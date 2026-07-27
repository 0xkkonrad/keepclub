# Munin — the app

The shell in front of the courses. Extracted from the Day Skipper app
(`projects/rya-day-skipper/web/`, commit 04119a6) per the locked theme & shell
decisions in `../project.md`.

## Boot order

`index.html` loads `doodles-munin.js` (the raven set) + `munin.js`. munin.js:

1. `?course=<id>` deep-links a course and becomes the resume target.
2. `munin/last-course` in localStorage → fetch `courses/<id>/course.json`,
   inject the accent (4 CSS scopes), set the boot screen from `course.boot`,
   load the course's own `doodles.js`, then `app.js`.
3. No course → the shelf (Munin ink teal #0E3F39, perch mark). Inside a course
   the "courses" pill overlays the shelf without clearing resume state.

## Courses are self-contained

`courses/<id>/` = course.json (accent pair, boot art/anim/line, section/group/
frieze art maps, fallback doodle) + doodles.js + cards.json (+ figures.json,
videos.json, img/). **No file in one course folder ever references another
course folder** — identical files are coincidences, per the 27 Jul ruling.
The shelf mines each course's emblem out of that course's own doodles.js.

## The theme belongs to Munin

Light by default — the app is paper first, dark is a choice. One key,
`munin/theme` (light / dark / auto), read before the first paint and shared by
the shelf and every course: a course cannot hold its own, or you would change
colour by changing deck. The button sits on the picker as well as in each
course header, and every `[data-theme-glyph]` on the page says the same thing.

## Installing

`beforeinstallprompt` is captured in `munin.js` **at parse time** — the shell is
the only script that always runs. On the picker there is no course yet, so an
`app.js` listener would register long after Chrome had fired and dropped the
event (it does not queue), and the offer would never appear anywhere.

Two places draw the one captured event: the picker, under the tiles, so first
run can make the case before anything is picked; and Settings, for people who
go looking. The offer leads with why — spacing only pays if you turn up, and an
icon is what makes you turn up — and the verb is *install* in both places. Both vanish once installed. A browser that can neither prompt nor
be told how is shown nothing; iOS, which has no install API, gets the two
steps instead of a button.

## What differs from Day Skipper's app.js

- The theme moved out of `state.settings` to `munin/theme` (above).
- `KEY` is `munin/<course>/state/v1` — per-course progress, fresh store.
  (kkonrad.com is one origin: the live /day-skipper keys stay untouched.)
- Art maps + fallback doodle come from `COURSE`, not consts.
- Deck/media fetches go through `COURSE.base`.
- **Sync is off** — `munin.js` ships a DSSync stub. The live Day Skipper app
  shares this origin and its Supabase rows; Munin joins sync only at the
  parity gate with a state migration. Settings still shows the sync panel;
  its buttons are inert until then.

## Deploy

kkonrad.com/munin (locked). /day-skipper 301s here only at parity: four green
test suites + a state-migration check. Not deployed yet if this line survives.

## Importing an Anki deck

`+ your own deck` on the shelf loads `import.js`, which is the only code here
that is not on the boot path — the parsers are a fair chunk of JavaScript and
nobody studying a built-in course should pay for them.

```
import.js        the screen: drop → progress → receipt → keep or throw away
lib/unzip.js     the zip directory, and DecompressionStream for the members
lib/sqlite.js    a read-only SQLite reader: b-trees, overflow, WITHOUT ROWID
lib/anki.js      which collection is the real one, and the two schemas
lib/template.js  Anki's card templates, including cloze
lib/html.js      an allow-list sanitiser that re-writes rather than passes through
lib/deck.js      collection → Munin deck, and the receipt
lib/store.js     IndexedDB: one row per deck, one per media file
lib/vendor/      fzstd (MIT) — the only third-party code in Munin
```

Four things worth knowing before changing any of it.

**The newest collection wins.** A modern .apkg contains a decoy
`collection.anki2` whose only content is a note telling old Anki to upgrade.
Take the first file that looks like a collection and you import an empty deck
and tell the user it worked.

**Everything is written, nothing is passed through.** Card text goes into
`innerHTML`, and a shared deck is a file from a stranger. `lib/html.js` parses
to tokens and serialises fresh, so anything it fails to understand becomes
visible text rather than markup. Media never keeps its own URL: it becomes
`munin-media:<n>`, resolved to a blob at boot, so no card can reach the network.

**The receipt is the feature.** Decision #6 in project.md is *drop it, get a
receipt* — what landed, what didn't and why, and what is different now. Every
drop is counted with a reason. A silent skip is the bug this screen exists to
prevent.

**Re-importing keeps your progress.** Card ids are Anki's own, so a second
import of the same deck produces the same ids; replacing a deck reuses its
record id and leaves `munin/<id>/state/v1` alone. That is the whole mechanism.

Fixtures and tests: `tests/fixtures/make-apkg.py` builds packages to Anki's own
DDL; `npm test` in `tests/` runs the lot.
