# The course source format

How a Munin course is *written*, as ruled on 28 Jul 2026 (`schema-research.md`
has the analysis and the picker record): markdown-first, compiled to the
shipped folder format that `course-format.md` documents. Anki stays at the
edges — the `.apkg` importer inbound, the Anki-ready TSVs outbound — and never
in the source of truth. One parser, `content/mdc.py`, reads this format for
every build, so the outputs cannot drift from each other.

Both shipped courses migrated to this format the day it was ruled; the
migration was byte-faithful — every compiled card identical to the python
pipeline's output, every id and its review history preserved.

## Layout

```
content/<course>/
  cards/
    deck.md          the deck's name; groups, if the course has them
    01-<key>.md      one file per section, numbered in teaching order
    02-<key>.md
  media/             the PNG diagrams the cards reference
  src/               build entry points and drawing code (python)
```

`cards/` is the content; `src/` is machinery. An author never opens `src/`.

## deck.md

```markdown
---
name: RYA Day Skipper
---

## The boat and how she handles {#hull}
- terms
- ropework
```

Frontmatter carries the deck's display name. Each `##` heading is a group —
the syllabus-level clustering Browse shows — with its key in `{#…}` and its
member sections as a list. Groups are optional; if any are declared, every
section must be in exactly one, or the build stops (a partial grouping hides
the sections it left out).

## A section file

The filename is `NN-<key>.md`: `NN` is the section's order, `<key>` its
stable key. The file opens with the section title as an `# ` heading, whose
leading number must agree with the filename — two places can't disagree
silently. Then the cards:

```markdown
# 03 Ropework

## Bowline — what is it for?

A fixed loop that neither slips nor jams &mdash; the knot for anything
that must hold and then let go.

![diagram](ds-knots-ropes.png)

## Which knot takes the load off a riding turn?

A <b>rolling hitch</b>, onto the loaded part of the sheet...

![figure](fig:rigging@sheet)
```

- **A card is a `##` heading and everything under it.** The heading is the
  question; the body paragraphs are the answer.
- **A lone image paragraph declares the card's media**, not answer content:
  a bare filename from `media/`, or `fig:<name>` / `fig:<name>@<label>,<label>`
  for a labelled drawing (only the named labels light up; no `@` lights all
  of them). One media declaration per card. Image dimensions are read at
  build time and shipped alongside, so the app can reserve layout.
- Anything else — prose outside a card, a second media line, an unknown
  heading attribute — is a build error with a file and line on it.

## Inline markup

`**bold**` → `<b>`, `*italic*` → `<i>`, `[text](https://…)` →
`<a href="…" target="_blank" rel="noopener">` (https and mailto only). The
legacy inline tags `<b> <i> <u> <br> <sub> <sup>` and HTML entities
(`&mdash;` `&deg;` …) pass through verbatim — that passthrough is what made
the migration byte-faithful. Attributes on anything except the compiled `<a>`
are rejected; so is a bare `&`, a TAB, or an unbalanced angle bracket.

Blocks: paragraphs join with `<br><br>`. A run of `- ` lines becomes `<ul>`,
a run of `1. ` lines becomes `<ol>` (lists and links are the 28 Jul widening
of the original six-tag whitelist — see `mdc.WHITELIST`). A line that
genuinely starts with a list marker escapes it CommonMark-style: `1\. `,
`\- `. `\*`, `\[`, `\]`, `\_` likewise escape emphasis and link characters.

## Card identity

`i = sha1(question html)[:10]`. Review history is keyed on it, so editing a
question makes a new card — deliberately: a reworded prompt is a different
memory. When a rewording should *keep* its history, pin the id first:

```markdown
## The rabbit comes out of the hole and round the tree {#4f2a91c03b}
```

A pin is the card's existing id (ten hex chars), stated in the heading; after
that the wording can change freely. Without a pin, sha1 applies — nothing
changes for authors who never use one. The build rejects a pin that collides
with another card.

The same question in two courses is the same id — which is what makes a
pointer card and its original share one review history.

## Pointer cards

Competent Crew reuses Day Skipper facts without copying them. A pointer is a
heading with a `ref` attribute and **no body**:

```markdown
## Bowline — use {ref=ropework}
```

`ref=` names the section of the *other* deck; the heading must match that
card's question character for character. The build resolves the answer (and
inherits the card's diagram) at compile time — no shared wording is ever
stored in the pointing course, so a fix happens once, upstream. A miss stops
the build with a did-you-mean hint; text fails loudly where an index would
silently re-point.

Two knobs for the inherited diagram, because the words can be in scope while
the picture is not: `{ref=… nofig}` drops it; a media line under the pointer
replaces it with this course's own cut:

```markdown
## What are Beaufort forces 0 to 3? {ref=meteo}

![diagram](cc-beaufort.png)
```

## What the builds do with it

- `content/day-skipper/src/web_build.py` — cards.json + quantised images
  (+ figures.json, doodles.js from the drawing code in `src/`)
- `content/day-skipper/src/build.py` — Anki TSVs + STUDY-GUIDE.md
- `content/competent-crew/src/build.py` — all of the above for CC, plus the
  pointer resolution and the editorial passes (duplication containment,
  out-of-scope wording, restated-question refusal)
- `scripts/refresh-courses.sh --write` — copies `build/` into `web/courses/`

Every build parses through `content/mdc.py` and stops on the first structural
problem. Provenance: CC's cards.json records the hash of the Day Skipper
`cards/` files it resolved against (`ds`), so a built deck can be traced to
the exact wording it inherited.
