# Toki Pona

A Keep Club memory course covering essentially the complete core vocabulary
(<b>nimi pu</b>, ~120 words) and grammar of Toki Pona, the minimalist
constructed language.

## Shape

- 22 sections in six groups
- 151 independently answerable cards
- No figures yet &mdash; v1 ships text-only, deliberately, to get the content
  live before any drawing work starts

The source of truth is `cards/`. `src/build.py` parses it through the shared
`content/mdc.py` compiler and writes the compact built-in deck the app reads.

## Build

From the repository root:

```bash
python3 content/toki-pona/src/build.py
./scripts/refresh-courses.sh --write
node tests/separation.mjs
```

The first command writes ignored build artifacts under
`content/toki-pona/build/`. The refresh command copies those artifacts into
the committed, self-contained `web/courses/toki-pona/` package.

## Reference basis

Checked on 2026-08-07 against community-standard glosses for the ~120
official <b>pu</b> words (from <i>Toki Pona: The Language of Good</i>,
Sonja Lang, 2014) &mdash; not against any single external source, since the
vocabulary and grammar rules are stable and widely documented. Where a word
has real dialectal variation (<b>laso</b> covering blue and green; <b>kule</b>'s
modern queer-identity sense), the card says so rather than picking one
reading silently.

Left for later, on purpose: <b>sitelen pona</b> (the pictogram script),
example-sentence figures, a course theme, and <b>nimi ku suli</b> (the
community's widely adopted post-pu vocabulary).
