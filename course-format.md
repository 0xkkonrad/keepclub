# The course format

What a course *is*, to the shipped app: one folder under `web/courses/<id>/`,
fetched over HTTP, no build step at runtime. This documents the contract as it
stands — what every course must provide, and what it may. The may-column is
long on purpose: everything visual is optional, and a course that ships nothing
but cards gets Munin's own ravens, colours and boot line. Chrome is a gift, not
a toll.

This is the *shipped* format. The question of what authoring source should
compile into it — markdown, Anki, something else — is treated separately in
`schema-research.md`.

## The folder

```
web/courses/<id>/
  course.json      required   identity + theme hooks
  cards.json       required   the deck — shape gated by web/lib/validate.js
  img/             required only if any card has "m"
  doodles.js       optional   line-art set; absent → Munin's raven set
  boot.html/.css   optional   the course's loading screen; absent → Munin's raven
  figures.json     optional   labelled drawings; absent → figure cards show no drawing
  videos.json      optional   clips per card; absent → no video UI at all
  video/           required only if videos.json names files
```

Registration is the one step outside the folder: add the id to
`web/courses/index.json` — the single registry the shell, the service worker
and `scripts/refresh-courses.sh` all read (a registered course with no
refresh rule stops that script on purpose). The folder name is the course's
identity; progress is keyed on it. `?course=<id>` in the URL selects a course
and becomes the resume pointer.

Decks imported from `.apkg` bypass all of this — they live in IndexedDB, not in
a folder, and the shell hands `app.js` the deck object directly with Munin's own
theme. This document is about *authored* courses.

## course.json — required part

```json
{
  "id": "day-skipper",
  "title": "RYA Day Skipper",
  "accent": { "light": "#0e7490", "dark": "#22d3ee",
              "inkLight": "#ffffff", "inkDark": "#083344" }
}
```

- `id` — must equal the folder name. Keys the review state
  (`localStorage['munin/<id>/state/v1']`) and the export filename. Changing it
  orphans everyone's progress; treat it as permanent.
- `title` — document title and course header. A leading `RYA ` is stripped in
  the header, kept in the document title.
- `accent` — read unguarded at boot (`injectAccent`, `munin.js`). Omitting the
  whole object is a boot failure; omitting one of the four keys boots but
  writes the string `undefined` into the theme CSS, silently breaking colours.
  Either way it belongs in the required column, while everything prettier does
  not.

## course.json — optional part (chrome)

Every field below has a shipped fallback — since the 28 Jul seam refactor,
Munin's own theme is the *default layer*, filled in slot by slot, not a
special case. A course that stops after `accent` is a complete, studyable
course. (The loading screen is the one piece that moved out of course.json:
a course ships `boot.html` + `boot.css` files, written as a starter by
`scripts/make-boot.mjs` and hand-tuned from there; `boot.{art,anim,line}`
stay as the fallback for a course without them.)

| field | what it does | absent → |
|---|---|---|
| `tagline` | one line under the title on the shelf tile | no tagline |
| `boot.line` | text under the boot doodle | `Loading…` |
| `boot.anim` | boot doodle animation, `sail` or `hop` | `sail` |
| `boot.art` | doodle name drawn on the boot screen | `fallback`, then first doodle |
| `fallback` | default doodle name wherever art is looked up | first entry in the doodle set |
| `short` | short course name for tight chrome | `title` |
| `shelfPath` | shelf-tile emblem, an SVG path written by `scripts/make-boot.mjs` from the course's own doodles | Munin's raven |
| `notice` | the course's fineprint line | none |
| `credit` | `{name, href}` for licensed material (video clips) | none |
| `hoard` | achievement names/art over Munin's fourteen rules | raven vocabulary |
| `sectionArt` | `{sectionKey: doodleName}`, per-section badge | `{}` — no badges |
| `groupArt` | `{groupKey: doodleName}`, done-screen badge | `{}` |
| `friezeArt` | array of doodle names for the decorative frieze | `[]` — no frieze |
| `examDate` | `YYYY-MM-DD`, seeds the exam-countdown setting | feature stays quiet |

## cards.json

```json
{
  "name": "RYA Day Skipper",
  "sections": [ { "k": "terms", "t": "01 Boat and nautical terms", "n": 34, "o": 1 } ],
  "groups":   [ { "k": "hull", "t": "The boat and how she handles",
                  "s": ["terms", "ropework"], "n": 121 } ],
  "cards":    [ ... ],
  "build": "8ca01ff2"
}
```

- `sections` — `k` key, `t` display title, `n` card count, `o` order. Titles
  conventionally start `NN ` — the app splits a leading number off for display.
- `groups` — **optional.** Named runs of sections, used for the syllabus view
  and done-screen badges. Absent or empty, the app synthesises one unnamed
  group holding every section, and nothing else changes.
- `build` — short hash of the deck content. Shown on the Progress screen and
  stamped into progress exports, so a bug report can say which deck it saw.
- `name`, and Competent Crew's `course` / `ds` (the Day Skipper commit it was
  built against) — provenance for humans reading the file. The app reads none
  of them.

### A card

```json
{ "i": "0d0f0d21f2",
  "s": "terms",
  "q": "Draught",
  "a": "The vertical distance from the waterline to the lowest point of the keel…",
  "m": "ds-hull.png", "d": [1800, 1744],
  "f": { "n": "hull-profile", "on": ["draught", "waterline"] } }
```

| field | req | meaning |
|---|---|---|
| `i` | yes | card id, ten hex chars — see *Identity* below |
| `s` | yes | section key; must match a `sections[].k` |
| `q`, `a` | yes | question and answer, restricted HTML |
| `m` | no | raster diagram, bare filename resolved against `img/` |
| `d` | with `m` | `[width, height]` intrinsic px — the app reserves the aspect ratio before the file loads, so the answer never jumps. A card with `m` and no `d` renders, but its layout jumps; the builds always emit both. |
| `f` | no | labelled figure: `n` names an entry in `figures.json`, `on` lists the labels to light. Missing `on` lights all of them. |
| `r` | no | authoring provenance: which Day Skipper section this card was pointed at (see *Identity*). Unread by the app. |

`q` and `a` are injected as HTML. The builds allow `<b> <i> <u> <br> <sub>
<sup>`, lists (`<ul> <ol> <li>`) and safe links (`<a>` with exactly
`href="https…|mailto…" target="_blank" rel="noopener"` — the one tag that may
carry attributes), entities for everything else. This is `WHITELIST` in
`content/mdc.py`, widened from the original six tags by the 28 Jul 2026
ruling. The app trusts the build, so anything writing cards.json by hand
inherits that whitelist as an obligation, not a suggestion.

### Identity

`i = sha1(question)[:10]`. Two consequences, both deliberate:

- **Editing a question makes a new card.** Review history is keyed on `i`; a
  reworded question is a different memory and starts over. Fixing a typo in an
  answer changes nothing.
- **The same question in two courses is the same card.** A Competent Crew
  *pointer* card — one that names a Day Skipper card by its exact question and
  inherits the answer at build time, see that course's README — shares an id
  with its original, so a person studying
  both learns each shared fact once — per course state is still separate, but
  ids line up by construction.

Imported Anki decks use a different regime (Anki's card row id, base36). The
two never collide in practice and never share a state store.

### What is *not* in cards.json

Scheduling. No due dates, no ease, no intervals — the content files are pure
content. All SRS state lives in `localStorage['munin/<id>/state/v1']` and is
owned by the app; a deck refresh never touches it, and records for card ids no
longer in the deck are dropped at boot.

## doodles.js — optional

```js
const DOODLE = { boat: 'M3.2 22.6C…', anchor: 'M16 4…', … };
```

One `const`, name → a single SVG path `d` string, drawn in a 32×32 viewBox,
stroked in `currentColor`. This is the course's entire visual vocabulary:
boot art, shelf art, section badges, frieze — all of them are names into this
set. If the file is missing the shell installs its own raven set, and every
art field in `course.json` then indexes into ravens; a name that misses falls
back to `fallback`, then to the first doodle. **A slot is never a hole** — the
worst a course can do by omitting art is look like Munin instead of itself.

The two shipped courses have byte-identical doodles.js by coincidence, not by
reference — each course owns its copy and they may drift. Never deduplicate
them.

## figures.json — optional

```json
{ "hull-profile": { "b": "<path …/><g data-l=\"draught\">…</g>",
                    "cap": "Hull, in profile.",
                    "l": ["air-draught", "draught", "freeboard", "waterline"],
                    "vb": "0 0 460 306" } }
```

Named line drawings with labelled parts. `b` is trusted SVG inner markup
(build-generated — same trust rule as card HTML), `l` the full label list,
`vb` the viewBox. A card's `f.on` lights a subset of labels; the rest stay
dimmed as context, which is how one drawing serves many cards without the
first card answering the rest. The file is fetched non-blocking and every
lookup is guarded: absent or failing, figure cards simply show no drawing.

## videos.json — optional

```json
{ "clips": { "clip-01": { "f": "20250228_bowline.mp4", "d": 30,
                          "t": "Tying a bowline at the bow.",
                          "u": "https://…", "by": "maritimemaster" } },
  "cards": { "0d0f0d21f2": ["clip-01"] },
  "credit": { "name": "Maritime Master", "url": "https://…" } }
```

`clips` describes files under `video/` (`f` filename, `d` duration in seconds,
`t` caption, `u` source link); `cards` attaches clips by card id. The file is
adopted only if both `clips` and `cards` parse; otherwise — or when absent, as
in Competent Crew — the video UI does not exist. Clips are fetched on tap and
never precached.

## The authoring side

Courses are authored in markdown under `content/<id>/cards/` — one file per
section, parsed by `content/mdc.py`, compiled by each course's build into the
folder documented above. `course-source.md` is the full spec: card syntax,
inline markup, `{#id}` pins, `{ref=…}` pointer cards, media and figure lines.
`scripts/refresh-courses.sh --write` copies `build/` → `web/courses/`.

`build/` is gitignored; what ships is the committed copy under `web/courses/`.
The builds are where validation lives — the HTML whitelist, duplicate ids,
missing images, unknown figure labels — so the app can stay trusting; the one
check the app repeats at boot is the structural one in `web/lib/validate.js`.
