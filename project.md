# Munin

Spaced repetition that doesn't make you learn the app first.

Anki's scheduler is the best thing in the category and its interface is the reason most
people who try it stop. Munin keeps the first and replaces the second.

Named for Odin's raven of memory — a small friendly raven who remembers things for you.
(Huginn was thought. We only need the other one.) A hundred-name sweep across Slavic,
Germanic and Egyptian myth is in `naming-research.md`; it ran after the name was locked,
came out at the same answer, and is kept as a bench for naming everything else.

Status: **v0 live at kkonrad.com/munin** (27 Jul). The shell + themes engine over the
extracted Day Skipper engine, both courses playable, per-course state, sync stubbed off
until the parity gate. `web/README.md` documents the boot order and what differs from
Day Skipper's app.js. /day-skipper is untouched and still the app of record.

The `.apkg` importer (phase 3) is built on `feat/anki-importer`: drop a deck on the shelf,
read the receipt, study it. Both Anki export formats, cloze and reversed cards, pictures
and sound, stored in IndexedDB and never leaving the device.

---

## Where this came from

A research pass over the field (Mochi, Noji/ex-AnkiPro, RemNote, Skola, MintDeck, Lexie,
Traverse, kian) and a 19-option mockup picker. All seven decisions locked 26 July 2026.
The picker lives at `preview/anki-ux-mockups/` in the sandbox and holds the reasoning,
the costs, and — more usefully — the fourteen options that were rejected.

The one position nobody occupies is *Anki-compatible data and sync with a modern UI*.
We looked at it and are deliberately not taking it: the sync protocol and the note-type
model are where that plan dies. Munin is greenfield with one-way import.

## The six failures we're answering

Every one of these is a documented, repeated complaint about Anki, not a hunch.

1. **Deck options** — ~25 controls across 6 tabs, most made obsolete by FSRS.
2. **Onboarding and sync** — no login menu item; "Full Sync" reads as *sync everything*
   and means *destroy one side*.
3. **Add-on dependency** — occlusion, progress, better editors all live in third-party
   Python add-ons that break on upgrade.
4. **Note types / templates / fields** — the real power and the steepest cliff.
5. **Stats** — plenty of charts, and true retention buried under them.
6. **Import and deck updates** — duplicate subdecks, lost scheduling, no preview.

## The character

Munin is a raven. The visual language is inherited wholesale from the RYA Day Skipper app
— DM Mono on paper, 2px ink outlines with a 4px hard offset shadow, one indigo accent
(#3A30D8), flag yellow (#FFD54A), hand-drawn inline-SVG doodles stroked in `currentColor`
so dark mode is free — and then **re-drawn corvid**.

The nautical doodle set is replaced, not recoloured:

| Day Skipper | Munin |
|---|---|
| boat, buoy, gull, wave | raven, feather, egg, branch |
| compass rose | crow's feet — three-toed prints, used as progress marks |
| ship's log badges | the hoard — shiny things Munin has collected |
| anchor, knot | worm, nest, cracked shell |

Crow's-feet prints are the workhorse: they mark a card seen, a day done, a streak. A
trail of prints across the screen is the progress bar.

Tone follows Day Skipper's: lowercase for the app's own chrome, never for card content.

---

## Locked

| # | Decision | Pick |
|---|---|---|
| 0 | What we're building | **Greenfield, import only.** Own schema, own sync. One-way `.apkg` import so people can get their cards in; no ongoing Anki compatibility. |
| 1 | Home | **One session.** One number, one button. Decks demote to a filter chip row, not a hierarchy. |
| 2 | Review | **Flick the card.** Direction and distance give the grade, with a live ghost label showing what you're about to commit. Buttons stay as the fallback. |
| 3 | Deck options | **Pick a mode.** Four postures — cramming for a date / learning properly / keeping it warm / on hold. The hood stays shut behind one dotted link. |
| 4 | Making cards | **Markdown body + card-kind stamps.** Both, not either. The note is one markdown box; the stamp decides how many cards it makes. |
| 4b | Editing cards | **Edit from where you found it.** See below. |
| 5 | Progress | **One number and one sentence.** True retention, in words, with the consequence spelled out. Forecast underneath. |
| 6 | Import | **Drop it, get a receipt.** Plain accounting of what landed, what was already there, what couldn't be read. |

Konrad on #2: *"i love the strength of flipping being the how-easy-it-was ux."* That is the
distinguishing interaction of the product — treat it as load-bearing, not a gesture
shortcut over a button row.

### Theme & shell — locked 27 Jul 2026

Picker: `design/theme-picker/` (artifact linked in its README). The layering, in
Konrad's words: **munin** is infra with the themes engine; **courses** bring colour +
thematic doodles + loading screen + other thematic elements; **cards** are content,
with tags/categories at the engine level.

| # | Decision | Pick |
|---|---|---|
| T1 | Munin's logo | **perch** — the plain standing raven (candidates + geometry in `design/theme-picker/ravens.py`; runners-up seed the raven doodle set). |
| T2 | Munin's accent | **Ink teal #0E3F39 / #35917F** — corvid sheen, much darker than round 1 (locked 27 Jul, round 2). |
| T3 | App entry | **Resume last course.** Cold open = the course you left off in, full theme; the shelf is one tap away behind the course name in the header, and greets first-run. H1's one-number-one-button applies *within* a course. |
| T4 | Install | **One PWA.** The raven on the home screen; one service worker, one cache. Courses are screens inside. |
| T5 | Competent Crew accent | **Harbor slate #33608D / #7FB2E8.** |
| T6 | Competent Crew doodles | **Colour-only reskin — but physically separated.** CC ships its own doodle files that *happen* to coincide with Day Skipper's; theme files are never imported across courses. |
| T7 | Deployment | **kkonrad.com/munin now.** /day-skipper stays untouched until Munin passes the five test suites + a state-migration check, then 301s in. |

A course theme is exactly: accent pair (light+dark) + doodle set + figure vocabulary
(`figures.css` + `figures.noPen` — the nouns; the figure *language* of dashes, leaders,
arcs and colour tokens stays Munin's) + section art +
**loading screen** (its scene, how it moves, and what it says — Day Skipper's rocking
boat and "Loading deck…" stay Day Skipper's; the raven default gets its own) + **what
the hoard is called and what its fourteen entries are called and drawn as** + its
`notice` (the fineprint), `credit` and `short` header title. Everything else — type,
layout, grade flags, flag yellow, review UX, and the hoard's *rules* — is Munin, shared
by every course. Every course folder is self-contained, and brings only what it has: course.json
and cards.json are required, and **everything else is offered** — doodles.js,
boot.html + boot.css, figures.json, videos.json, and every optional field in
course.json. A course with a title and two hundred cards works and wears Munin.
Missing doodle slot → raven fallback, never a hole.

### The seam — audited and closed, 28 Jul 2026

An audit of the course/Munin seam found eleven leaks. Konrad's rulings on them:
achievement names and loading-screen text become **per-course customisation surfaces
over Munin defaults** (not engine constants, not required of a course); **Munin's own
theme is the default layer**, not a special case for imported decks — a course that
brings no accent, no doodles or no scene is dressed by Munin, slot by slot; everything
else fixed. What changed:

- **One registry.** `web/courses/index.json`. It was a literal in munin.js, a second
  in the service worker's precache and a third in refresh-courses.sh — and a course
  missing from the second worked online and 404'd offline.
- **The picker cannot be taken down by a course.** Per-course try/catch, a tile that
  says which one would not load. It was a bare `Promise.all` with no catch: one
  mistyped course.json was a blank page with no way back.
- **The shelf reads no theme file.** `shelfPath` in course.json, written by
  `scripts/make-boot.mjs`. It used to fetch 43 KB of each course's `doodles.js` and
  mine one path out with a regex, on every draw.
- **The folder name is the identity.** `course.json`'s `id` is ignored on boot and
  gated in tests; the two could disagree, and progress is keyed on it.
- **The hoard** (`renderAch`) keeps its fourteen rules and takes its names and
  drawings from `course.json.hoard`. The defaults are Munin's raven vocabulary: they
  were nautical, drawn from one course's set, so every imported deck showed fourteen
  identical ravens under fourteen sailing captions, headed "Ship's log".
- **Course content out of the shell**: the almanac fineprint, the Maritime Master
  credit, "the 24 diagrams are about 2 MB" and the `RYA ` prefix strip were all in
  Munin's own files and printed over every deck.
- **`lib/validate.js`** — one description of what a deck is, run by app.js at boot, by
  the importer, and by the gate over every cards.json.
- **Per-course service-worker caches.** One shared cache meant editing one card
  evicted the app and every other course for everyone.
- **One copy of each constant**: `MUNIN.stateKey` / `MUNIN.lastKey`, and the raven
  list exported from `lib/deck.js` and gated against `doodles-munin.js`.
- **The gate points the right way.** `tests/separation.mjs` tested course → course; it
  now also tests engine → course, which is the direction that was leaking. 69 checks.

**Two follow-ups, both closed 28 Jul on Konrad's call:**

- **Four more ravens.** The hoard has fourteen entries and Munin's set held ten, so an
  imported deck showed four duplicate pairs. `prints`, `nest`, `worm` and `shell` are
  drawn — the subjects the character notes above already called for — and each takes
  over the entry it belongs to. The set now has a generator,
  `design/raven-doodles/build.py`, which rebuilds the original ten byte-for-byte; it
  had none, so redrawing one meant hand-editing the shipped file. The frieze stays ten
  (it has to fit a 320px screen) and names its ten explicitly.
- **The figure vocabulary is separated.** ~50 `.f-*` rules naming one syllabus's
  rigging, sails, fenders and pontoons moved out of app.css into
  `courses/<id>/figures.css`, and `FIG_NO_PEN` split into the engine's half and the
  course's `figures.noPen`. Gated both ways: app.css may draw no course's nouns, and a
  course may not redefine the shared language.

### Boot screens — per-course, mechanism built 28 Jul

The mechanism is in place: `courses/<id>/boot.html` + `boot.css`, swapped in by
munin.js and **replayed out of localStorage before the first paint**, with Munin's
raven as the markup default. What each course ships today is still the minimum —
its own drawing, drawn on and then moving. **A real per-course boot scene is still
wanted** — an animated drawing that belongs to the course the way its accent and
doodles do; that is now a drawing job in one file, not a change to the engine. What
was wrong before, and is fixed:

**It drew too late** — `app.js` filled the doodle in `boot()`, *after* the `cards.json`
fetch resolved, so the window the screen exists to cover was the window in which it was
blank. Fixed: Munin's default scene is markup in `index.html`, and a course's own scene
is replayed from `munin/boot/<id>` at parse time, before the first paint. app.js no
longer touches the boot screen at all, and the gate fails if it does again.

**Its animation was Munin's, not the course's** — `boot.anim` named a keyframe declared
in `app.css`, so a course could only pick from the two names the engine happened to
have. Fixed: `boot.css` per course, its own keyframes, gated.

**It is still a spinner, not a scene.** A course theme is meant to be felt before the
first card. Day Skipper and Competent Crew share a sea: a horizon line that draws
itself, then a boat drawn onto it and sailing its length, with sun, drifting cloud,
gulls, a buoy to pass. The raven default gets its own. This is the part still to do —
and it is now `boot.html` + `boot.css` in one course folder.

A prototype (*Horizon*, built and picked July 2026, since deleted) settled six things
worth not rediscovering:

- **`pathLength="1"` on every path.** It renormalises the path whatever its real
  geometry, so *one* CSS rule — `stroke-dashoffset: 1 → 0` — draws any doodle on.
  Without it every doodle needs its own measured length, and re-drawing a doodle
  silently breaks its own animation.
- **All motion in CSS, including any rotating captions.** A caption that starts moving
  when `app.js` parses is a caption that never moves when it matters.
- **Link the fonts, never inline them.** The app self-hosts and preloads these faces
  already; shipping 65 KB of base64 font before first paint argues against the whole
  point of the screen. That was the difference between 73 KB and 16 KB.
- **A keyframe selector cannot take `calc()`.** A rotating-caption cycle has to have
  its percentages and its caption count agree by hand — they cannot be derived.
- **The doodle set's `flag` is a flagpole**, not a signal flag. Four hung off a halyard
  read as flagpoles dangling in mid-air. A signal-flag hoist needs a new doodle, which
  is a decision about the doodle set rather than about a boot screen.
- **`prefers-reduced-motion` leaves the drawing finished**, not half-drawn.

### 4b — editing cards

Anki's browser is a spreadsheet with a query language attached, which is why nobody edits
a bad card; they suffer it for years instead. Munin's rule: **you can fix a card from
wherever you hit it.**

- **From review.** The card you just answered is one tap from an editor, and answering
  continues where it left off. This is the path that matters — a wrong card is discovered
  in review, not in a browser.
- **From browse.** A plain list, searchable by text, filterable by deck and by state
  (leech / never-answered / due). No query language.
- **Editing is markdown**, the same box as authoring — there is no separate "edit" UI.
- **Changing the stamp changes the cards.** Front/back → both directions adds a sibling
  card and keeps the existing one's history. Removing a stamp archives its card rather
  than deleting the scheduling.
- **Undo.** Every edit is reversible for 30 days, same mechanism as the import receipt.

Open: whether an edit ever resets scheduling. Default assumption is **no** — reword freely,
history survives — with an explicit "this is a different card now, start it over" action.

---

### Where a course's source lives

`web/courses/<id>/` is shipped data — committed, self-contained, and all the app
ever reads. Where the *authoring* source sits depends on whether the course has a
repo of its own.

Both courses are authored here now.

- **Competent Crew** never had a repo of its own, so its source moved out of
  `_temp` into `content/competent-crew/` on 28 July 2026.
- **Day Skipper** followed it the same day, into `content/day-skipper/`, when its
  standalone app was retired and kkonrad.com/day-skipper came down. Its clips
  came with it — `web/courses/day-skipper/` had been shipping a `videos.json`
  naming 54 files nothing had ever copied across.

Both rebuilds reproduce the shipped `cards.json` byte for byte.

`content/*/build/` is gitignored. Competent Crew's cards are pointers into Day
Skipper's — `ref(section, question_text)`, resolved at build time — which used to
mean a clone of Munin could not rebuild it. Now that both are here, it can.
That is a maintenance dependency, not a runtime one: the shipped `cards.json`
carries the resolved text. `scripts/refresh-courses.sh` copies build output into
`web/courses/`.

## Shape

Local-first PWA, Supabase behind it.

- **On device:** IndexedDB is the source of truth. The app works fully offline; sync is a
  background nicety, never a gate. (Day Skipper's single-localStorage-key state does not
  survive this — thousands of cards plus media need a real store.)
- **Supabase:** auth, sync, and media storage. Row-level security per user. A deck is
  rows, not a blob, so a partial sync is a normal state and not a corruption.
- **Scheduler:** FSRS (`ts-fsrs`). Day Skipper's tuned SM-2 does not come across. What
  *does* come across is its exam-date interval clamp — that's what makes mode 1
  ("cramming for a date") real rather than a label.
- **No accounts required to start.** Sign-in is what turns on sync, not what turns on the
  app. Anki's onboarding failure is a decision we get to not repeat.

### Keeping Supabase awake

Supabase pauses free projects after **7 days without database activity**. A paused project
takes ~30 seconds to wake, but the real damage is quieter: sync stops, the app keeps
working offline because it's local-first, and nobody finds out for a week.

**Requirement: ping it once a day from the Hetzner box** (`shadow-server`, 78.47.227.135),
alongside the vault sync jobs already running there.

Two things that make this actually work rather than look like it works:

- **It has to be a database query, not an HTTP request.** A REST call that returns a
  cached response does not reset the inactivity timer. Do a real round trip — `select` or
  `upsert` one row on a dedicated `keepalive` table.
- **Log the outcome, and make a failure visible.** A keepalive that has itself been dead
  for a month is the standard way this bug presents. It should complain somewhere Konrad
  reads — Telegram via hermes is right there.

Once a day is deliberate overkill against a 7-day window: it means six consecutive silent
failures before anything is actually at risk.

**Not wired yet** — blocked on the Supabase project existing. It's a cron line and a
five-line script once there are keys.

## Phases

**Phase 0 — extract the engine out of Day Skipper. This comes first.**

Day Skipper is progressing well and must keep working; the extraction is a refactor of a
live app, not a fork left to rot. It has four headless test suites — those are the safety
net that says the extraction was clean.

Comes across: the theme and doodle system, the review-loop UI, the lightbox, the figures
renderer, the PWA/service-worker shell, the test harness.

Does not: the SM-2 scheduler, the localStorage state layer, the Python card-authoring
build (`src/cards_*.py` now lives at `content/day-skipper/` — see *Where a course's source lives*).

The end state is that **Day Skipper becomes the first Munin deck** — same engine, its own
content and its own deployment.

**Phase 1 — storage and scheduler.** IndexedDB schema (decks / notes / cards / reviews /
media), FSRS in place of SM-2. No new screens. This is the phase that turns a study app
into a product.

**Phase 2 — the new screens.** H1 home, R2 flick-grading with a real distance→grade
mapping and its desktop fallback, the M1+M3 editor and the 4b edit paths, T1 progress.

**Phase 3 — `.apkg` import.** Built on `feat/anki-importer`, ahead of phases 1 and 2:
the import is what makes Munin usable by anyone who is not studying for the RYA, and it
turned out to be a week rather than the month budgeted here. `web/README.md` documents it.

Two decisions worth keeping.

**Not sql.js.** Every query the importer makes is "give me every row of this table",
which is a b-tree walk against a published, stable file format. A megabyte of WebAssembly
to run SELECT statements we do not need is the wrong trade for an app whose whole claim is
that it works offline and starts fast. `lib/sqlite.js` is 250 lines and was written against
databases SQLite itself wrote. Writing it caught two bugs that a library would have hidden
— index pages have a different local-payload limit from table pages, and a WITHOUT ROWID
record stores its primary key columns first regardless of declaration order — both of which
are exactly the modern Anki schema.

**One dependency, and it is a compression codec.** `lib/vendor/fzstd.js` (MIT, 24 KB) is
the only third-party code in Munin. Anki has written its payloads zstd-compressed since
2.1.50 and no browser exposes a zstd decoder; hand-rolling one would have been the one
place in this project where writing it myself was clearly worse than not.

The import does not go through the M1+M3 markdown model — that model does not exist yet.
It renders Anki's own templates and stores the result as Munin cards. When phase 2 lands,
re-importing is the migration path, which is the same mechanism as replacing a deck.

**Phase 4 — Supabase sync.** Auth, per-user RLS, conflict policy, media to Storage.

## Not doing

- Anki sync-protocol compatibility, in either direction.
- Ongoing deck updates. Import is a one-time migration, so there is no diff-before-apply
  and no subscribe-to-a-deck. **This is a known hole** — the update path was the loudest
  complaint in the ecosystem and we're choosing not to answer it. Revisit if shared decks
  ever matter.
- AI card generation. Card-making is part of learning; Skola's reasoning holds.
- A shared-deck marketplace.
- Anything named after Anki. AnkiPro was forced to rename to Noji in June 2025 under
  trademark pressure.

## Open

- **Supabase project** — personal, or under an existing org? Keys not chosen. This also
  gates the daily keepalive above.
- **Flick-grading on desktop.** Buttons are the stated fallback, but the best interaction
  in the product being mobile-only is a real cost. Trackpad gesture? Arrow keys with the
  same ghost label?
- **Distance→grade mapping.** Needs to be tuned on a real thumb, not designed on paper.
- **Do edits ever reset scheduling** (see 4b).

~~Does Day Skipper stay separately deployed~~ — resolved 27 Jul: T7 above.
