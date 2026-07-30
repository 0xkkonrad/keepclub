# keep club — the app

The shell in front of the courses. Extracted from the Day Skipper app
(`projects/rya-day-skipper/web/`, commit 04119a6) per the locked theme & shell
decisions in `../project.md`.

## The seam

**A course owns its cards and its theme. keep club owns the app.**

| The course brings | keep club brings |
|---|---|
| cards.json, figures.json, videos.json, img/, video/ | the review engine, the scheduler, every screen |
| its accent pair, its doodle set, its section/group/frieze art | the picker, the importer, the light/dark theme |
| its loading screen — boot.html + boot.css + boot.line | the hoard's *rules*, and defaults for every slot below |
| what the hoard is called and what its fourteen entries are called and drawn as | the type, the layout, the grade flags, the mastery bars |
| its `notice` (the fineprint) and `credit`, its `short` header title | offline, backup, sync, install |
| its figure vocabulary — `figures.css` + `figures.noPen` | the figure *language*: dashes, leaders, arcs, colour tokens |

Anything a course does not bring, it gets from keep club — slot by slot, in
`withDefaults()`. **keep club's own theme is not a special case for imported
decks; it is the default layer.** A deck someone dropped in brings none of the
left-hand column and is dressed entirely by the right.

## Boot order

`index.html` loads `doodles-munin.js` (the raven set) + `munin.js`. munin.js:

1. Replays the loading screen the resume course drew last time, out of
   localStorage, **before the first paint** (see below).
2. `?course=<id>` deep-links a course and becomes the resume target. The id is
   checked as a shape, not against the registry — the resume path must not wait
   for a list to load before it can boot.
3. `munin/last-course` → fetch `courses/<id>/course.json`, fill its empty slots
   from keep club's defaults, inject the accent (4 CSS scopes), fetch the course's
   boot scene, load its `doodles.js`, then `app.js`.
4. No course → the shelf (keep club ink teal #0E3F39, tower mark). Inside a course
   the "courses" pill overlays the shelf without clearing resume state.
5. Which of those two the bare URL means is read off `history.state`: entering
   a course is a fresh load, so the picker and the course are two entries over
   one address. `{munin:'shelf'}` is the picker, `{munin:'course'}` is the
   resume target, and a cold open (no state at all) resumes. That is what lets
   Back out of a course land on the picker instead of re-opening the course.
   The screens inside a course stack on top of these — `stops` in app.js.

**The folder name is the course's identity.** `course.json`'s own `id` is
ignored on boot and gated in tests: progress is keyed on it, and the two being
free to disagree meant a renamed folder silently forked every user's history
into a key nothing reads again.

## One registry

`courses/index.json` is the list of courses. The shell reads it to draw the
picker, the service worker reads it to decide what to precache and which
caches are still live, and `scripts/refresh-courses.sh` loops over it. It used
to be a literal in three of those places, and a course missing from the
service worker's copy worked online and 404'd offline — the failure you find
last.

**One course cannot take the picker down.** Every `course.json` is fetched in
its own try/catch; one that will not load leaves a tile saying so and the rest
of the shelf intact.

## Courses are self-contained, and bring only what they have

**Required:** `course.json` (a title, and whatever else it wants to say) and
`cards.json`. That is the whole list.

**Offered:** `doodles.js`, `boot.html` + `boot.css`, `figures.json`,
`figures.css`, `videos.json`, `img/`, `video/`, and every optional field in
course.json —
`accent`, `short`, `tagline`, `boot.line`, `boot.art`, `shelfArt`,
`shelfPath`, `fallback`, `sectionArt`, `groupArt`, `friezeArt`, `examDate`,
`notice`, `credit`, `hoard`, `figures`. Anything absent comes from keep club. A course with
a title and two hundred cards works, looks like keep club, and is not a
second-class citizen — that is the ruling, and `tests/separation.mjs` requires
exactly the two files above and no more.

Add one: drop the folder in, add its id to `courses/index.json`, and — if it
has an upstream build to copy from — add a rule to `scripts/refresh-courses.sh`
(that script is the one place a new course still needs a per-course edit, and
only if it is generated rather than authored in place).

**No file in one course folder ever references another course folder** —
identical files are coincidences, per the 27 Jul ruling. The shelf draws each
course's emblem from `shelfPath` in its course.json, written there by
`scripts/make-boot.mjs` out of that course's own doodle set; it used to fetch
all 43 KB of `doodles.js` and mine one path out of it with a regular
expression, on every draw.

## The loading screen

A course owns it: `boot.html` is the scene, `boot.css` is how it moves —
**its own keyframes**, so the animation vocabulary is the course's and not
whatever names app.css happened to declare — and `course.json`'s `boot.line`
is what it says.

The catch this solves: the course's scene cannot be known until course.json
has been fetched, which is the entire window the screen exists to cover. So
the scene the course drew last time is kept under `munin/boot/<id>` and
replayed synchronously at parse time. First-ever open of a course gets Munin's
raven, which is markup in index.html; every open after that gets the course's
own. Nothing on this screen is filled in by app.js — that is by definition too
late, and it was the bug.

`pathLength="1"` on every path: it renormalises the path whatever its real
geometry, so one CSS rule draws any drawing on. `prefers-reduced-motion`
leaves the drawing finished, not half-drawn.

**What ships is still a spinner, not a scene** — each course's boot.html holds
one of its own drawings, drawn on and then moving. The mechanism is finished;
the drawing is not. See project.md, "Boot screens", for what it should be.

## Figures: the language is Munin's, the nouns are the course's

`app.css` says what a dash means, what a leader line is, what a swept arc is,
and holds the colour tokens — true of any subject drawn this way. A course's
own nouns live in `courses/<id>/figures.css`: its rigging, its sails, its
pontoons. About fifty rules of one syllabus used to be in app.css, applied over
every deck anybody imported, and `FIG_NO_PEN` in app.js named two of them by
hand. The pen exemption is now the engine's half (dashes, cuts, arcs, fills)
plus whatever the course lists in `course.json`'s `figures.noPen` — the class
list and the stylesheet that styles it are the same course's business, and they
used to be able to disagree.

The shell links `figures.css` when course.json has a `figures` block, so a
course that draws nothing asks for nothing.

## What a deck has to be

`lib/validate.js` is the one description of a deck. Two things build one — the
python that authors a course, and the .apkg importer — and nothing used to
check either against the other. app.js runs it at boot, the importer runs it
over what it just built, and the separation gate runs it over every cards.json
in the repo. `format` is optional; absent means 1.

## The theme belongs to Munin

Light by default — the app is paper first, dark is a choice. One key,
`munin/theme` (light / dark / auto), read before the first paint and shared by
the shelf and every course: a course cannot hold its own, or you would change
colour by changing deck. The button sits on the picker as well as in each
course header, and every `[data-theme-glyph]` on the page says the same thing.
(This is the light/dark *mode*, which is the reader's; the accent pair is the
course's.)

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

## Offline

One cache for the shell (`munin-shell-<stamp>`) and one per course
(`munin-course-<id>-<stamp>`), both stamped by the deploy script from the
content actually shipped. They used to share a single cache named after a hash
of *everything*, so editing one card in one course evicted the app and every
other course for every user.

The worker is registered by `munin.js`, not from inside a course: it used to be
`app.js`, which never runs on the picker, so a visitor who landed on the shelf
installed nothing at all.

**Nothing is ever deleted from a list we could not read.** `readCourses()`
returns `null` rather than `[]` when the registry will not load, and the
activate sweep skips every course cache when it is `null`; the same rule holds
in `munin.js`, where `sweepOrphans` is given `null` rather than `[]` when
IndexedDB will not open. Both of these deleted real things — the megabytes of
diagrams somebody saved for a flight, and every imported deck's study history
in a private window — because an unanswerable question was being read as the
answer "none of them exist".

## What differs from Day Skipper's app.js

- The theme moved out of `state.settings` to `munin/theme` (above).
- `KEY` is `munin/<course>/state/v1` — per-course progress, fresh store.
  (kkonrad.com is one origin: the live /day-skipper keys stay untouched.)
  Every storage key is spelled once, in `MUNIN.stateKey` / `MUNIN.lastKey`.
- Art maps + fallback doodle come from `COURSE`, not consts.
- The hoard's names and drawings come from `COURSE.hoard`; the fourteen rules
  stay in app.js. The defaults are written in Munin's raven vocabulary — they
  used to be nautical, drawn from one course's doodle set, so an imported deck
  showed fourteen identical ravens under fourteen sailing captions.
- The fineprint, the video credit and the offline note come from the course
  and from the deck's own picture count. They were markup, and so were printed
  over every course and every imported deck.
- **Notes.** A deck holds plain-text notes of your own, written from the panel
  behind the Notes row on Home. They live in the same per-deck document as the
  review history (`state.notes`, id → `{at, ed, text}`), so they survive a
  reload, the load sanitiser and a restored backup, they obey the single-writer
  study lease, and they go with the deck when it is removed. An emptied record
  is a delete, which is what stops a sync handing back a note you deleted on
  the other device — `mergeNotes` in `sync.js` says why at length. Erasing
  progress does *not* take them: that button offers to erase review history.
- Deck/media fetches go through `COURSE.base`.
- **Sync is on for built-in courses** — `sync.js` uses one device key across
  course-specific progress blobs. The merge is commutative and idempotent;
  imported deck cards/media remain local and every deck still has file backup.

## Deploy

`keepclub.app` is canonical and deploys through
`scripts/deploy-to-keepclub.sh`. The old `kkonrad.com/munin` copy was retired
on 29 July 2026 and now exists only as a progress/deck migration landing page.

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
lib/deck.js      collection → keep club deck, and the receipt
lib/store.js     IndexedDB: one row per deck, one per media file
lib/vendor/      fzstd (MIT) — the only third-party code in keep club
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
