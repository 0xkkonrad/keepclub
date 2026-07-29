# RYA Day Skipper — course source

537 cards across 24 sections, 24 diagrams, 14 labelled figures, 28 chrome
doodles and 54 video clips. keep club ships what this builds; nothing under
`web/courses/day-skipper/` is hand-edited.

This lived in its own repo (`0xkkonrad/rya-day-skipper`) with a standalone app
in front of it until **28 July 2026**, when the app was retired and keep club took
the course over. Competent Crew's 60 pointer cards resolve against this tree,
so both courses now rebuild from a clone of keep club alone — which they could not
while this was somewhere else.

```
cards/NN-<key>.md      the cards — the source of truth, and the only one
cards/deck.md          the deck's name, and the 24 sections gathered into 7 themes
src/diagrams.py        generates media/*.png, the 24 full-page diagrams
src/figures.py         the 14 labelled drawings -> build/figures.json
src/doodles.py         the 28 chrome doodles -> build/doodles.js
src/rough.py           re-draws both by hand at build time (seeded)
src/web_build.py       validates and emits build/cards.json and build/img/
src/build.py           validates and emits build/decks/ and build/STUDY-GUIDE.md
video/                 the clip pipeline — see below
media/                 the 24 diagrams at full size, plus 2 Competent Crew ones
CORRECTIONS.md         errata found against the syllabus, and what was changed
supabase/              schema and migrations for keep club's device-key sync
```

## Building

```bash
python3 content/day-skipper/src/web_build.py   # cards.json, figures.json, doodles.js, img/
python3 content/day-skipper/video/build.py     # videos.json, and copies the clips
python3 content/day-skipper/src/build.py       # decks/*.tsv and STUDY-GUIDE.md
./scripts/refresh-courses.sh --write           # ship it into web/courses/
```

`build/` is gitignored. Two builds of the same source are byte identical — the
hand-drawing pass is seeded — so a diff means somebody changed a card or a
drawing.

The cards were authored as python literals until 28 July 2026, when the whole
repo moved to the markdown course source format (`course-source.md` at the
repo root; parsed by `content/mdc.py`). The migration was byte-faithful:
`cards/` compiles to exactly the cards.json the python emitted, so no card id
— and no one's review history — moved.

## The video clips

`video/clips/` holds the 54 encoded clips and is **committed**, which is not
how the rest of `build/` works and is deliberate: their originals are 156 MB of
downloaded TikTok that has never been in a repo, so the encodes are the only
copy of the material. `video/build.py` re-encodes only when a clip is missing
from `clips/`, and tells you to point `TIKTOK_SRC` at the originals if it is.

`video/sources.csv` is in the repo for the same reason — every clip must carry
a link back to the original and the uploader's name, and that file is where
both come from. Losing it means shipping someone else's video unattributed.

## What did not come across

The standalone app (`web/`), its eight browser test suites, its PWA icon
generator and its deploy script stayed behind. keep club has its own of each. What
moved is the course and everything that makes it.
