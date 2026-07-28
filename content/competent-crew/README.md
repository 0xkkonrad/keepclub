# RYA Competent Crew — deck

Flashcards for the RYA **Competent Crew** practical course, built to sit
alongside the Day Skipper deck without duplicating it and without touching it.

**This is content, not app.** It is the authoring source for the course that
ships at `web/courses/competent-crew/`. Nothing in here runs in the browser: it
produces `cards.json` and its images, and `scripts/refresh-courses.sh` copies
them across. Day Skipper's equivalent source stays in the Day Skipper repo,
which is why this folder is `content/competent-crew` rather than the top level —
it is one course's authoring, not Munin's.

## The two design rules

**No conflict.** Nothing here writes to, or is written into, the Day Skipper
repo. `src/ds.py` is the only file that knows where that checkout is, and it
opens it read-only. That matters more than it sounds: while this deck was being
built, a parallel session was committing to that repo.

**One fact, one author.** Competent Crew and Day Skipper share a lot — a bowline
is a bowline. A shared card is a **pointer**, not a copy:

```python
("cc-ropework", "03 Ropework", [
    ref("ropework", "Bowline — what is it for?"),      # Day Skipper's wording
    ("Why do we coil a halyard tail?", "So it runs …"),  # written here
]),
```

`ref(section, front)` names a Day Skipper card by its section key and its exact
question text. `build.py` resolves it and copies the answer into the built deck
only. No Day Skipper wording is ever stored in this repo, so a fix to a shared
card happens once, in Day Skipper, and both decks get it.

The pointer is question text rather than an index on purpose: an index silently
re-points at a different card the moment someone inserts one above it, and a
wrong-but-plausible answer is the worst failure a deck can have. Text fails
loudly instead — edit a Day Skipper question and this build stops.

## Where a card is original instead

Konrad's ruling: **point when it fits, write new when Day Skipper is too deep.**
Competent Crew teaches the crew member; Day Skipper teaches the skipper. Where
Day Skipper explains the physics, cites an IRPCS rule number, or asks for a
decision, Competent Crew gets its own genuinely simpler card and the two decks
carry the same fact at two depths. That is accepted duplication of *subject*,
not of *wording* — `build.py` fails a card whose question already exists in Day
Skipper, and warns on one whose answer is a reworded Day Skipper answer.

## Where it stands

**200 cards across 14 sections: 60 pointers into Day Skipper, 140 written here.**
Sections 01, 02, 03 and 13 carry the deck; 09, 11 and 12 are deliberately thin.

The content has been through four independent passes — a fact-check against
RYA, MAIB, MCA, Met Office and gov.uk sources, a cold read as a complete
beginner, a duplication audit against all 537 Day Skipper cards, and a
regression check after the fixes. All four reports are in `research/`.

That found, among other things: a cold-water-shock card that taught a casualty
their hands stop working in two minutes when the usable window is nearer ten,
two winch cards giving opposite instructions twelve cards apart, and one card
that had copied a Day Skipper answer verbatim and scored only 47% on the
duplicate check because Jaccard divides by the union. The check now measures
containment instead, and compares cards **within** this deck as well as against
Day Skipper — see `duplication_pass()` in `src/build.py`.

## Layout

```
SECTIONS.md            the 14 sections, the triage rule, the hard exclusions
research/syllabus.md   the syllabus research, every claim tagged with the URL it came from
research/reuse-*.json  the card-by-card triage of all 537 Day Skipper cards
src/ds.py              read-only view of the Day Skipper card source; ref()
src/cards_cc.py        the deck — the only file with content in it
src/build.py           resolves pointers, validates, emits build/
build/                 generated, gitignored; cards.json, decks/*.tsv, STUDY-GUIDE.md, REUSE.md
```

## Building

```bash
python3 content/competent-crew/src/build.py   # writes content/competent-crew/build/
./scripts/refresh-courses.sh --write          # copies it into web/courses/
```

`build/` is **not committed** — every card either points at a Day Skipper card or
is checked against one, so a rebuild needs that checkout and a clone of Munin
alone cannot do it. What ships is the copy under `web/courses/competent-crew/`,
which is committed, so the app never depends on Day Skipper being present.

It fails on: an unresolvable pointer, a duplicate question, an HTML tag outside
the tiny allowed set, a figure or label that does not exist, a missing image,
and an original card that restates a Day Skipper question. It warns on: an
answer that reads as a reworded Day Skipper answer, and wording that belongs to
a topic Competent Crew does not cover.

Set `DS_ROOT` if the Day Skipper checkout is not where `src/ds.py` expects it.

## Card ids

`sha1(question)[:10]`, the same scheme Day Skipper uses, which means a pointer
card and the card it points at have the **same id**. When the two decks share
one app they share one review history for the facts they share — learning what a
bowline is for should not need doing twice.

## Scope

The 14-section Competent Crew practical syllabus and nothing else. The syllabus
is in the RYA's **G158** logbook (not G4, which is the dinghy scheme); the RYA
does not publish it at bullet level online, so `research/syllabus.md`
cross-checks seven training-centre reproductions and flags where two generations
of the wording disagree.

Sections 09 (Rules of the road), 11 (Meteorology) and 12 (Seasickness) are
**deliberately thin**. Competent Crew's entire rules-of-the-road requirement is
one line — *"is able to keep an efficient lookout at sea"*. Padding those
sections turns this into Day Skipper.

## Status

**Shipped.** The course is live in Munin. This source was authored in
`_temp/rya-competent-crew/` and moved here on 28 July 2026; the rebuild in its
new home reproduces the shipped `cards.json` byte for byte.
