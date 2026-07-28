# Course source format — Anki-compatible or markdown-first?

> **Ruled, 28 Jul 2026 (Konrad, via the schema picker).** Markdown-first,
> Anki at the edges. Identity: sha1 default with an optional `{#id}` pin.
> Markdown subset: **wider than the old whitelist — lists and links are in**
> (open decision 3's recommendation was overruled). Migration: **both shipped
> courses move to the new format now** (open decision 4's recommendation was
> overruled). The format itself is specified in `course-source.md`; the
> analysis below is the record of why.

**Question.** More courses need to exist than the two we hand-built, some
authored here, some imported. What format should a course's *source* be — and
specifically, should it be Anki-compatible, or optimised for authoring (plain
markdown, flexible schema), when those pull apart?

**Recommendation, up front.** Markdown-first source, compiled to the shipped
folder format documented in `course-format.md`. Anki lives at the edges as
converters — the `.apkg` importer inbound (already shipped), TSV/`.apkg`
export outbound (TSV already shipped) — and never in the source of truth.
Four decisions are open and listed at the end: the ratification itself, and
three details of the markdown format.

## The dilemma is narrower than it looks

Two of the decisions locked in `project.md` on 26 Jul already fence this in:

- **Decision #0:** own schema, own sync, one-way `.apkg` import, no ongoing
  Anki compatibility. The reasoning stands on the sync protocol and the
  note-type model — "where that plan dies".
- **Decision #4:** the planned in-app authoring model is **markdown body +
  card-kind stamps** — one markdown box per note, the stamp decides how many
  cards it makes. Declared, not yet built.

So "Anki-compatible course format" cannot mean compatibility as a live
contract — that's already rejected. The only version of it still on the table
is: *use Anki's file formats as the authoring source* for new courses
(`.apkg`, or its TSV import format, or its note model re-expressed as text).
The real question is where Anki sits: in the core schema, or at the boundary.

Worth naming: the inbound half of Anki compatibility is a **solved problem in
this repo**. The shipped importer reads both collection generations, actually
renders note templates rather than guessing field 1 is the front, preserves
cloze per-ordinal, sanitises HTML, rewrites media so nothing touches the
network, and hands back a receipt for every card it dropped. 145 of the
repo's 185 tests cover it.
Any existing Anki deck is already thirty seconds away from being studyable
in Munin. The dilemma is only about what *we author in*.

## Option A — Anki as the source (.apkg, or the note model)

What it would buy:

- Anki desktop becomes the course editor; its ecosystem (genanki, shared-deck
  tooling, decades of decks) authors for us.
- Any existing `.apkg` *is* a course, no conversion.
- No new format to design or document.

What it costs, and why each cost is structural rather than incidental:

1. **The note model is the wrong altitude.** Notetypes, per-notetype HTML
   templates, per-template CSS, protobuf config blobs — the importer's core
   spends its ~1,500 lines flattening exactly this into `{q, a}`. Making it
   the source means authoring *into* the complexity we built machinery to
   strip out. This is the precise spot `project.md` already identified as
   where the plan dies; nothing has changed since.

2. **Munin's features don't fit in it.** Labelled figures with per-card label
   subsets, cross-course `ref()` pointers (a Competent Crew card that *names*
   a Day Skipper card instead of restating it, so each shared fact has one
   author), video clips with credits, section/group art — none of these have
   an Anki
   representation. They would need a sidecar file regardless, at which point
   the `.apkg` is no longer the source of truth and the compatibility is
   decorative: a *subset* of the course would round-trip, silently.

3. **Identity breaks.** Anki ids are collection-local timestamps. Munin's
   `sha1(question)` is what makes a Competent Crew pointer and its Day Skipper
   original *the same card* with one review history. Anki-as-source either
   abandons that or maintains an id-mapping table forever — a wart in the
   schema's most load-bearing spot.

4. **Binary SQLite in git.** No diffs, no review, no blame, merge conflicts
   resolved by picking a side blind. The Competent Crew deck went through four
   audit passes (fact-check, cold read, duplication, regression) that were
   only possible because the source is text a reviewer — human or model — can
   read. That workflow is the actual quality mechanism of this project;
   Option A deletes it.

A softer variant — Anki's **TSV import format** as source — fixes "binary" and
nothing else: one escaped-HTML line per card, no room for figures, pointers,
or metadata without inventing column conventions, i.e. a worse markdown. It
survives here only as an *export* target, which it already is
(`content/*/build/decks/*.tsv`, importable into Anki today).

## Option B — markdown-first source

A course is a folder of text: frontmatter for what's structured, markdown
body for what's prose, sidecar files for the optional chrome. What it buys:

- **The authoring UX is the point.** Any editor. Git-native: diffable,
  reviewable, blame-able, PR-able. LLM-friendly in both directions — which is
  not a nicety here, it is how these courses actually get written and audited.
- **It compiles onto the shipped schema 1:1.** Heading → question, body →
  answer, standard image syntax → the diagram and its dimensions (`m`/`d`,
  derived at build as of cf1c7c5), a small directive → the labelled-figure
  hook (`f`) — the card fields as documented in `course-format.md`, whose
  folder contract doesn't move.
- **The extensions stay separated and optional by construction.** Doodles,
  boot screen, accents are sidecar files a course simply doesn't include —
  and the runtime already answers absence with Munin's raven set, default
  boot line, default art — the raven doodles Munin itself ships. "Submit no
  doodles, get ours" is shipped behaviour,
  not future work; the format only has to not fight it.
- **It converges with decision #4.** The in-app editor's planned model (one
  markdown box, card-kind stamps) and the on-disk course source become the
  same model, one parser, instead of two authoring formats.

What it costs:

- A format to specify: the markdown subset, the card delimiter, the id rule.
  Bounded, and mostly decided already: the existing six-tag HTML whitelist
  survives unchanged, markdown is just a kinder way to type it — open
  decision 3 spells out the mapping.
- A build step — which every course already has, and which is where
  validation lives regardless of format.
- It is not *directly* openable in Anki — covered by keeping the TSV/`.apkg`
  export, below.

### Sketch, for reaction rather than ratification

```
content/knots-101/
  course.md            # frontmatter: id, title, tagline; accent optional —
                       # the build fills in Munin's own when absent, since
                       # the shipped course.json requires one
  01-basics.md         # one file per section
  media/bowline.png
  doodles.py           # optional; omit → ravens
```

```markdown
---
section: basics
title: 01 The basics
---

## Bowline — what is it for?

A fixed loop that neither slips nor jams — the knot for anything that
must hold and then let go: sheets to a headsail, a warp to a ring.

![](media/bowline.png)

## The rabbit comes out of the hole… {#4f2a91c03b}

…round the tree, and back down. The tail ends **inside** the loop.
```

One `##` heading per card: heading is the question, body is the answer,
standard image syntax attaches media, an optional `{#id}` pins identity (see
open decision 2). Card-kind stamps (cloze, reversed) attach to the heading
when phase-2 needs them. Everything above the first heading is section
frontmatter. Nothing here is exotic; the build stays the place that says no.

## Option C — both, with a blessed converter

Keep Anki as a *peer* source: author in either, convert freely. Rejected as a
steady state: two source formats means every schema addition (figures,
pointers, art) lands twice or — realistically — only in one, and the other
silently forks. The importer already gives us the only half of this worth
having: inbound, one-way, with a receipt.

## Payoffs, side by side

| | A: Anki source | A′: TSV source | B: markdown |
|---|---|---|---|
| authoring/editing UX | Anki desktop | poor | any editor |
| git diff / review / audit workflow | none | poor | native |
| LLM authoring & audit passes | poor | poor | native |
| existing Anki decks usable | native | partial | via importer (shipped) |
| decks usable *in* Anki | native | native | via TSV export (shipped) |
| figures, pointers, chrome, videos | sidecar anyway | sidecar anyway | first-class, optional |
| cross-course shared identity | broken | broken | preserved |
| fidelity of "compatible" claim | partial, silent | partial | honest: import/export |
| new code to write | writer for .apkg | column conventions | parser + spec |

The asymmetry that decides it: **Option B loses nothing that decision #0
hadn't already surrendered** — Anki users still get in through the importer
and out through the TSV — while Option A gives up the audit workflow, the
shared-identity scheme, and first-class extensions to buy a compatibility
that the unrepresentable features make partial anyway.

## Open decisions (the actual ask)

1. **Ratify the shape:** markdown-first source compiled to the shipped folder
   format; Anki strictly at the edges — importer in, TSV export out, both
   already shipped. (An `.apkg` *writer* would be optional later work; saying
   yes here does not commit to it.)
2. **Identity policy.** Today `i = sha1(question)`: rewording a question
   resets its history, deliberately and loudly. Markdown makes rewording
   cheap, which sharpens the trade. Options: keep pure sha1 (simplest, status
   quo); or allow an optional `{#id}` pin that survives rewording, sha1 as
   the default when absent — recommended, because it changes nothing for
   authors who don't ask for it.
3. **Markdown subset.** Recommend: exactly today's whitelist expressed in
   markdown (`**bold**`, `*italic*`, underline via `<u>`, explicit line
   breaks, `~sub~`/`^sup^`), no lists, no headings inside answers, no links.
   Anything the whitelist rejects today, the parser rejects tomorrow.
4. **Do the shipped courses migrate?** Recommend no, for now: Day Skipper and
   Competent Crew keep their Python builds (already declared "Day Skipper's
   own" in `project.md`), the markdown format proves itself on the *next*
   course, and migration is a mechanical export the day it looks worth it.

Separately noted, not part of this decision: the shell's course list is
hardcoded (`MUNIN.courses`, `web/munin.js:21`), so every new course edits the
shell. A `courses.json` manifest is a fifteen-minute follow-up that makes
"add a course" a pure content operation.
