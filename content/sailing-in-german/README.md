# Sailing in German

100 essential German sailing terms, taught German → English in 87 cards.
The 20 short sections contain two to five cards each. Most cards teach one
term; the largest set is the four points of sail. Articles accompany nouns,
and the answers distinguish nautical meanings from everyday German where useful.
English uses British sailing terms with common US alternatives.

This is a practical beginner selection, not a frequency-ranked corpus.
Alternate spellings, plurals and sample commands do not increase the 100-term count.

## Build

```sh
python3 content/sailing-in-german/src/build.py
./scripts/refresh-courses.sh --write
node tests/separation.mjs
```

Markdown under `cards/` is the source of truth. Pinned card IDs preserve
progress when wording changes. Generated files under `build/` are ignored;
the self-contained copies under `web/courses/sailing-in-german/` are deployed.

The builder selects seven existing labelled diagrams from the committed
Competent Crew package. It copies their SVG geometry and style into this
course; learners never fetch another course's files. Only labels relevant
to the current card are highlighted. The mainsail caption is shortened to
remove an assumption about other diagrams. No new raster artwork is needed.

The small nautical doodle set is copied from the same course for the shelf
and loading screen. Other courses' card content is unchanged.

## References and review

Terminology was checked against sailing-school definitions and bilingual
references; see [sources.md](research/sources.md). Independent subagents
review every card for German usage, sailing meaning, recall size and diagram
fit. The review ledger and resolutions live under `research/`.
