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
node tests/sailing-german-ui.mjs
```

Markdown under `cards/` is the source of truth. Pinned card IDs preserve
progress when wording changes. Generated files under `build/` are ignored;
the self-contained copies under `web/courses/sailing-in-german/` are deployed.

The builder regenerates all seven diagrams from the existing sailing SVG
artwork, using the German labels, annotations and captions in
[`illustrations.json`](illustrations.json). Each translation records sailing
dictionary sources and its nautical meaning. The build rejects missing
translations or changed English source text that needs a new review.

The course owns its compiled SVG and style files. Only labels relevant to the
current card are highlighted. German lettering has its own layout adjustments
and accessible descriptions; the boat geometry and label IDs stay intact.
The course's decorative icons contain no English text.

The course emblem is a boat with a billowing ß-shaped sail (the selected B2 design).
An umlaut anchor appears in the supporting illustrations.
Its five original icons live in `web/courses/sailing-in-german/doodles.js`;
`course.json` assigns them to the shelf, loading screen, frieze and sections.
Burgundy in light mode and rose in dark mode colour the icons and controls.
After editing the main emblem, regenerate its shelf path and loading scene:

```sh
node scripts/make-boot.mjs sailing-in-german --force
```

## References and review

Terminology was checked against sailing-school definitions and bilingual
references; see [sources.md](research/sources.md). Independent subagents
review every card for German usage, sailing meaning, recall size and diagram
fit. The review ledger and resolutions live under `research/`.

The September 2026 illustration review assigns each translation to a second
agent, checks all 68 label and annotation occurrences plus seven captions,
and inspects the regenerated drawings in both themes. Results and resolved
findings are in [`research/illustrations-verification.json`](research/illustrations-verification.json)
and [`research/illustrations-visual-review.md`](research/illustrations-visual-review.md).
