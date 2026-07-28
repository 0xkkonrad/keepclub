# How to write a Competent Crew section

Every section lives in its own file, `src/sec_<name>.py`, so that several people
can write at once without touching each other's work. `src/cards_cc.py` collects
them in syllabus order.

## The file

```python
# -*- coding: utf-8 -*-
"""03 Ropework — the seven named knots, cleating, coiling, warps."""
from ds import ref

SECTION = ("cc-ropework", "03 Ropework", [

 ref("ropework", "Bowline — what is it for?"),

 ("Which knot takes the load off a riding turn, and why that one?",
  "A <b>rolling hitch</b>, onto the loaded part of the sheet and led to a spare winch. It is the one knot that grips when the pull is <i>along</i> the rope rather than across it &mdash; a clove hitch in the same place would slide.",
  "fig:rigging@sheet"),

])
```

A card is either:

- **`ref(ds_section, front)`** — a pointer to a Day Skipper card. Its answer is
  never copied here; the build resolves it. `front` must be the Day Skipper
  question **character for character**, entities and all.
- **a tuple** `(question, answer)` or `(question, answer, figure)` — content
  written for Competent Crew.

## The bar

Competent Crew teaches the **crew member**, not the skipper. The reader has
never been on a yacht. Before writing a card, ask the triage question:

> Would a crew member be *given* this as an order, or must they *decide* it?

Write the card only if the answer is "given as an order". No calculations, no
chart, no almanac, no tide table, no IRPCS rule numbers, no light characters, no
buoy shapes. `src/build.py` warns on wording from those topics.

## Rules the build enforces

- **A question that already exists in Day Skipper is an error.** Use `ref()`.
  There is one author per fact.
- **An answer that reads as a reworded Day Skipper answer is a warning**
  (>60% word overlap). If you hit it, either point at the card instead, or make
  the crew-level version genuinely different — shorter, concrete, no theory.
- Only these tags: `<b> <i> <u> <br> <sub> <sup>`. **No attributes on anything.**
- No bare `&`. Use entities: `&amp; &deg; &times; &frac12; &mdash; &radic;`.
- No tab and no newline inside a field. One card is one line of prose.

## Voice

Match the Day Skipper deck. Read a few cards in
`projects/rya-day-skipper/src/cards_a.py` before you start.

- Plain, concrete, direct. No throat-clearing, no "it is important to note",
  no "essentially", no triads-for-rhythm, no summarising sentence at the end.
- Bold the term being defined, with `<b>`.
- A list of items separates with `<br>`, at the item boundary — not mid-clause.
- Give the reason when the reason is what makes it stick: *"never fend off with
  your hands or feet"* is a rule; *"a hull moving at walking pace weighs more
  than your leg"* is why it is remembered.
- A question is a real question, not a topic label — but a bare term as a prompt
  ("Freeboard") is fine when the card is a definition.
- Where practice genuinely varies, say so on the card rather than picking one.

## Figures

A third field attaches one of Day Skipper's 14 drawings and lights only the
labels you name: `"fig:hull-profile@draught,waterline"`. Everything else on the
drawing stays dimmed as context. **Only these are in Competent Crew scope:**

| figure | labels |
|---|---|
| `hull-plan` | amidships, beam, bow, port, starboard, stern |
| `hull-profile` | air-draught, draught, freeboard, waterline |
| `sail-parts` | boom, clew, foot, head, leech, luff, mast, tack |
| `rigging` | backstay, forestay, halyard, kicker, sheet, shrouds, spreaders, topping-lift |
| `deck-fittings` | cleat, fairlead, guardrails, jackstay, pulpit, pushpit, stanchions |
| `mooring-lines` | back-spring, bow-line, breast-line, fenders, fore-spring, stern-line |
| `motions` | pitch, roll, yaw |
| `windward-lee` | lee-shore, leeward, weather-shore, wind, windward |
| `bearings` | abaft-22, abaft-beam, abeam, ahead, astern, forward-beam |
| `flares` | handheld, parachute, smoke, white |

Do **not** use `latlong`, `prop-walk`, `standing-turn` or `engine-cooling` —
they belong to topics Competent Crew does not cover.

A figure is worth attaching only when the answer is **a place or a shape**. A
picture of a sentence is decoration, and decoration on a flashcard costs
attention and returns nothing.

Full-page diagrams are attached the same way with a bare filename instead. Only
four are in scope: `ds-beaufort.png`, `ds-knots-ropes.png`, `ds-mob.png`,
`ds-points-of-sail.png`.

## Length

Cards are not essays. The Day Skipper median answer is one or two sentences;
the longest are lists of named things. If an answer needs three sentences of
build-up before the fact, the card is asking the wrong question — split it.
