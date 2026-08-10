# Toki Pona

A Keep Club memory course covering essentially the complete core vocabulary
(<b>nimi pu</b>, ~120 words) and grammar of Toki Pona, the minimalist
constructed language.

## Shape

- 22 sections in seven groups
- 181 cards, including phrase and sentence application practice
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

Checked on 2026-08-10 against <i>Toki Pona: The Language of Good</i> (Sonja
Lang, 2014), Lang's later official notes, and established community usage.
The cards distinguish the <b>pu</b> foundation from later or dialectal patterns
instead of presenting every widespread form as one fixed rule.

Left for later, on purpose: <b>sitelen pona</b> (the pictogram script),
example-sentence figures, a course theme, and full teaching coverage of
<b>nimi ku suli</b> (widely used words documented beyond the core set).
