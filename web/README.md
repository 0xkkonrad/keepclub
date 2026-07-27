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
