# Audit — figures and cards, 2026-07-27

Every one of the 200 built Competent Crew cards was rendered in the real app CSS
and screenshotted, and every screenshot was read by an independent reviewer.
27 reviewers: 21 covering the deck section by section, 5 on the 30 cards that
carry a labelled figure, 1 on the 12 that carry a reference PNG, and a
whole-deck pass looking only for cross-section defects.

**Reviewers read the render, not the source.** The three worst defects below do
not exist in the card text at all — a missing line break, two paragraphs printed
on top of each other inside a diagram, and diagrams that teach material the
course excludes. None of them would have been found by reading `cards_cc.py`.

Harness: `/workspaces/sandbox/preview/cc-cards/` (`index.html`, `review.js`,
`shot.mjs`); one PNG per card in `shots-light/`, named `<NN>-<section>-<id>.png`.
Rebuild with `node tests/_ccshot.mjs light` from the Day Skipper `tests/`
directory — that is where `playwright-core` is installed.

## The headline

The card *text* is in good shape. Six of the 21 section batches came back
completely clean and most of the rest is small.

**The defects that matter are in the pictures.** The 140 cards written here and
the 60 pointers were both triaged against the Competent Crew exclusion list.
**The four inherited diagrams never were.** They came across from Day Skipper as
attachments and carry Day Skipper's syllabus with them. Three of the four ship
material `SECTIONS.md` excludes by name: a card about keeping the propeller away
from a casualty ships a Mayday procedure, three cards about points of sail ship
the sailing right-of-way rules, and five weather cards ship Shipping Forecast
interpretation. The fourth is a wall of text with no knot drawn on it, on a deck
whose third-largest section is knots.

The triage rule in `SECTIONS.md` was applied to every card and to no diagram.
That is the one systemic gap this audit found.

## Status — fixed 2026-07-27

Everything under **High**, and most of **Medium**, is fixed. Day Skipper's share
is commit `ec49508` in that repo; the Competent Crew share is in `src/` here and
rebuilds clean against it. What each fix was is in the sections below, marked
**FIXED**. What is left is listed under *Not fixed* at the end, with why.

The mechanism for the diagram problem is new and worth knowing about:
`ref(..., media=False)` drops the Day Skipper diagram a pointer would inherit,
and `ref(..., media="cc-….png")` swaps in the Competent Crew cut of the same
sheet. Two such cuts now exist — `cc-points-of-sail.png` and `cc-beaufort.png` —
generated in Day Skipper's `src/diagrams.py`, because that is where the drawing
code lives, and skipped by its `web_build.py` so that app does not ship two
images it never shows.

## Severity

**high** = teaches something wrong, unsafe, or plainly outside the course ·
**medium** = a real defect a student trips on · **low** = fix when the file is
open anyway. `pointer` means the fix lands in `projects/rya-day-skipper/`.

---

## High

### 1. The MOB diagram teaches a Mayday and a sail recovery plan · card #112 · pointer · **FIXED**
`a6cf00d22a` · *"Why should the engine be out of gear before anyone comes
alongside the hull?"* · attaches `ds-mob.png`.

The card's own answer is two crew-level sentences about the propeller. The
diagram bolted under it teaches: *"DSC distress alert and MAYDAY on VHF channel
16"*, *"Press the MOB button on the GNSS / chart plotter"*, and a full
*"Recovery under sail — reach, tack, reach"* plan. `SECTIONS.md` excludes
Mayday/DSC format and electronic navigation outright, and recovery-under-sail is
the skipper's decision, not the crew's.

At card width the diagram's body text renders at roughly 5px and is unreadable
without tapping to enlarge — so its only real effect on a student is when they
*do* enlarge it, which is exactly when the excluded material lands.

**Fix:** drop `m: ds-mob.png` from this pointer's entry in the Competent Crew
build. The card does not need it.

### 2. The points-of-sail diagram teaches right of way · cards #30, #167, #170 · **FIXED**
`b1bf695f7e`, `e4177cb0db`, `20bbd1d00f` · attaches `ds-points-of-sail.png`.

The sheet is otherwise a good fit — it even carries a tacking/gybing row that
matches card #30. But the two most visually prominent items on it, set in red
and green, are **"You have RIGHT OF WAY over a boat on port tack"** and **"You
GIVE WAY to a boat on starboard tack."** IRPCS steering-and-sailing rules are a
hard exclusion.

**Fix:** generate a Competent Crew variant of the diagram with the two
right-of-way call-outs removed, keeping the points of sail and the tack naming.

### 3. `ds-beaufort.png` has two paragraphs printed on top of each other · cards #156–159, #163 · **FIXED**
Inside the source PNG, not the card. *"force 11 · Hurricane force = force 12"*
is overprinted on *"Timing: Imminent = within 6 hours of the time of issue"*,
and *"is a term in the weather element, and means visibility below 1,000 m"* is
overprinted on *"Pressure change over the 3 hours before the observation…"*.
Both are illegible at any zoom. The *"Probable wave ht (m)"* column header is
also clipped mid-word at the canvas edge.

This is Day Skipper's asset, so **it is broken in that deck too**, on every card
that shows it.

**Fix:** in `projects/rya-day-skipper/src/diagrams.py`, in the Beaufort figure —
the wrapped paragraphs are being laid out at a fixed y rather than flowed, and
the table is wider than the canvas.

**And the same sheet is the fourth out-of-scope diagram.** Its whole footer is
Shipping Forecast interpretation — visibility bands, pressure-trend jargon
(*rising or falling QUICKLY / VERY RAPIDLY*), gale-warning naming — which
`SECTIONS.md` excludes by name. The Competent Crew bar for meteorology is the
Beaufort scale and where to get a forecast, which is the table alone. Crop the
footer off for the Competent Crew build.

### 3b. A weather card contradicts the table printed directly beneath it · card #163 · **FIXED**
`3d3477176e` says *"a few white horses breaking here and there — **about force
4**"*. The table on the same screen gives force 4 as *"small waves, fairly
frequent white horses"* and force 3 as *"scattered white horses"*. The card's
own description is force 3. A student reading the card and the table together
sees the deck disagree with itself on the one scale the section exists to teach.

**Fix:** change the card to force 3, or reword it to the table's force-4 wording.

### 4. A card asks for eight items and answers with fifteen · card #121 · pointer · **FIXED**
`b6046ec657` · *"What goes in a grab bag? Name eight items."* The answer lists
about fifteen. As a recall exercise the card cannot be self-marked.

**Fix:** `projects/rya-day-skipper/src/cards_a.py:187` — either drop "Name eight
items" from the question or cut the answer to eight.

### 5. The rigging card runs two lists together · card #19 · pointer · **FIXED**
`11c6257de7`. Every item in the answer is separated by `<br>` **except** the
join between the two lists, so on screen the student reads
*"…spreaders, chainplates. **Running rigging** moves and controls the sails:
halyards,"* as one continuous line while everything around it is a column.

**Fix:** `projects/rya-day-skipper/src/cards_a.py:45` — add `<br>` before
`<b>Running rigging</b>`. (Known previously; still present, and it reaches both
decks.)

### 6. 100 N is called a buoyancy aid · card #92 · pointer · **FIXED**
`9d57f97860`. *"A buoyancy aid — 50 N inshore, 100 N sheltered water with prompt
rescue at hand."* Under EN ISO 12402, level 100 is a **lifejacket** (12402-4);
the buoyancy aid is level 50 (12402-5). The card misstates the very distinction
it is asking the student to learn, on safety kit.

**Fix:** `projects/rya-day-skipper/src/cards_a.py:168` — move the 100 N clause
under the lifejacket half, or name it as the lowest lifejacket level.

### 7. The crew is told to fix a riding turn with a knot the deck has not taught · cards #50 → #62 · **not fixed, see below**
`9793bce0fc` says *"Take the load off with a rolling hitch onto a spare line."*
The rolling hitch is not defined until card #62, twelve cards later in a
different section — and a riding turn under load is precisely when a student
cannot go looking it up.

**Fix:** either move the rolling-hitch card ahead of section 02, or have #50 say
what to do rather than name a knot.

---

## Medium

| # | card | problem | fix |
|---|------|---------|-----|
| #33 | `3ccddf343d` | *"Six knots is roughly a brisk walk"* — 6 kn is 6.9 mph, about double a brisk walk. | "about a gentle jog", or drop the analogy. |
| #56 | `6d2dbd6718` | Figure has no `on` list, so **fenders** light at full strength on a card that never mentions them. | Add an `on` list. |
| #57 | `872e3aaa88` | Asks about fenders, fairleads, cleats **and bollards**; the deck-fittings drawing contains only a cleat and a fairlead. | Add a fender and a bollard to the figure, or trim the question. |
| #67 | `f9b0851b56` | Question is the belaying *sequence*; the figure shows only where the cleat sits on the hull. | Needs a close-up of the turns, or no figure. |
| #103 | `85bd7c1e01` | A general packing list sitting in *05 Personal safety equipment*, whose bar is harnesses, lifejackets and buoyancy aids. | Move to `cc-duties`. |
| #115 | `d1c851e7f3` | Asks how to tell flares apart **in the dark**; the white flare is identified by *"is marked white"* — reading a label. | Give a shape or size cue. |
| #116 | `d29ceac166` | Answer handles *"a hand flare **or an orange smoke**"*; the figure lights `handheld, parachute` and leaves **smoke** dimmed. | Add `smoke` to the `on` list. |
| #127 | `bfc964df17` | Question is about the **starboard** spreader; the rigging drawing has no port/starboard cue and draws the spreader as one symmetric bar. | Add a bow-direction cue. |
| #19–#21, #23, #127 | `rigging` figure | **The drawing's own legend is wrong.** It prints *"green = standing, it holds the mast up / indigo = running, it moves"* — but indigo is the colour of the **hull, mast and sail outline**, and every running-rigging line and label renders black when lit and grey when dimmed. A student colour-matching against the legend reads the boat itself as running rigging. Three reviewers hit this independently. `figures.py` *intends* this — every running-rigging `mark()` and `txt()` carries `c-acc` — so the class is not resolving to the accent colour on these elements. | Fix the `c-acc` resolution, or drop that half of the legend. |
| #129 | `5a2a23392a` | Frames accepting or declining a raft-up as the reader's call — that is the skipper's berthing judgment. Also *"you may **be** come alongside"* is ungrammatical. | Reframe to what the crew rigs once the skipper has agreed; fix the typo. |
| #130 | `24c8d3a145` | *"You are rafting onto another yacht"* — the figure shows one yacht against a **pontoon**. It contradicts the card, which says you are fending off topsides *"and not a wall"*. | Needs a two-hull drawing, or no figure. |
| #178 | `fb7c54dfab` | Offers **"a ship"** as a steering mark. A ship moves, and a vessel holding a steady bearing ahead is the classic collision signature. | Drop "a ship". |
| #191 | `6d0cd9a98a` | *"Smell or **taste** it"* — bilges collect diesel and engine oil. | Smell and appearance only. |
| #3 | `77eaafde73` | Asks about forward, aft, fore-and-aft, athwartships; none of those words appear on the hull-plan figure — only bow, stern, beam. | Add the words, or drop the figure. |
| #60, #63 | `4b34b6921d`, `9125177b70` | `ds-knots-ropes.png` is a **text table with no knot drawn on it**. On a ropework card its first row simply restates the answer, and a student cannot learn a knot from it. | A ropework deck needs knot drawings; the sheet is not one. |
| #69 | `601ad0c534` | Teaches a *geometry* — the crossed figure-of-eight over two bollard heads, and why turns dropped straight over one head lift off — and attaches the same all-text knot sheet, which draws no bollard at all. The one card in the deck that most needs a picture has the least useful one. | A single post and a double bollard, drawn. |
| #167 | `e4177cb0db` | *"Name the points of sail, **from head to wind** round to dead downwind"* — the diagram has no head-to-wind marker at all, just the wind arrow and the shaded no-go zone. The card enumerates six points; the picture shows five. | Add a boat at the top of the wheel marked *head to wind*. |
| #30 | `b1bf695f7e` | Beyond the right-of-way problem above: the card asks only for the tacking and gybing *commands*, and those are two small lines at the very bottom of a large unrelated wheel. | The text answer stands alone; drop the sheet from this card. |
| #59 | `33cfb6947d` | Asks for three parts of a rope, answers with five plus an anchor-cable aside. | Cut after "working end". · pointer |
| #35, #43, #44, #36 | — | **gooseneck**, **cringle**, **foil**, **hank** each appear exactly once in the deck, undefined. | Gloss at first use. #43/#44 are pointer-owned. |
| #170 | `20bbd1d00f` | **goosewinged** / **poled out** — no card ever mentions a pole. | Gloss or cut. · pointer |
| #36 → #57 | — | Sheets led *"through the fairleads"* 21 cards before a fairlead is defined. | One-clause gloss on #36. |

## Low

Stray *"112.5° from ahead"* annotation on the bearings figure with no matching
term on the card (#6) · "transverse" used where the deck already taught
"athwartships" (#9) · **stem** and **transom** drawn full-weight on the
deck-fittings figure but never taught (#10) · British-vs-North-American cleat
trivia (#68) · **drogue** (#107), **binnacle** (#179), **gimbals** (#188),
**gland** (#197) each used once, undefined · figure caption calls orange smoke a
floating signal while the card body groups it with handhelds (#115) ·
**defaced ensign** and **warrant** unexplained (#125) · freeboard gets a bare
glyph where draught and air draught get dimension arrows (#13) · the two spring
lines cross with no leader tying each label to its own line (#56) · the rigging
answer names twelve components and the drawing carries eight (#19) · the SOLAS
500 m blind-sector figure is regulation detail in a section meant to be one line
(#142) — debatable, the actionable half of that card is right.

## Reported and rejected

Kept here so the same three do not get re-raised.

- **"leech is undefined" (#55)** — defined on card #18, *"leech (trailing
  edge)"*, in section 01.
- **"seacock is undefined" (#187)** — card #17 is entirely about seacocks.
- **"the VHF card teaches distress procedure" (#119)** — it says somebody will
  tell you what to say. That is inside the exception `SECTIONS.md` grants.

## Two harness bugs found mid-audit, both mine

Recorded because three reviewers reported them as deck defects before the fix.
`review.js` handled only the `f` field and never `m`, so the 12 reference-PNG
cards rendered text-only; and once fixed, the PNGs rendered at natural size and
overflowed the card, because the sheet had dropped the app's
`.fig-btn img { width: 100% }` wrapper. Both fixed and re-shot. **Neither was a
defect in the deck** — but a review sheet that silently omits a whole class of
card is worse than no review sheet, so this one now renders exactly what the app
renders.

## Structural checks that passed

- `python3 src/build.py` is clean against Day Skipper HEAD `04119a6`, four
  commits past the pinned `de2efa3` — every one of the 60 pointers still
  resolves, so the text-not-index pointer design has now survived a real drift.
- No label on any figure is drawn outside its viewBox (spill check in
  `_ccshot.mjs`), and no page errors on any of the 200 renders.
- No contradictions were found between any two cards, in any section or across
  sections — the winch-card class of defect that the earlier passes caught has
  not come back.


## Not fixed, and why

**The riding-turn forward reference (#50 → #62).** Real, but this is a
flashcard deck with a scheduler, not a linear book — cards do not arrive in
file order, so "twelve cards later" is not what a student experiences. Moving
the rolling hitch out of Ropework to fix a reading order nobody reads in would
cost more than it buys. Left alone deliberately.

**The knots sheet (#60, #63, #69).** `ds-knots-ropes.png` is a text table with
no knot drawn on it. Card #69 in particular teaches a *geometry* — the crossed
figure-of-eight over two bollard heads — and the sheet cannot show it. The fix
is a drawing that does not exist yet, in a deck whose third-largest section is
knots. This is the biggest remaining gap and it is a drawing job, not an edit.

**Figure-level gaps that need new drawing:** the deck-fittings figure has no
fender and no bollard though card #57 asks about both (medium); #67 and #76
want close-ups of a cleat hitch and of chafe protection at a fairlead, and get
a hull profile instead; #3 asks about forward/aft/athwartships and the hull-plan
figure carries none of those words; the rigging figure has no port/starboard
cue for #127's starboard spreader; freeboard gets a bare glyph where draught and
air draught get dimension arrows (#13).

**The low list**, other than the items already fixed. All small, none wrong.

**Two reviewer findings judged not worth acting on:** the 500 m blind-sector
detail on #142 (regulation framing in a thin section, but the actionable half of
the card is right), and the "lit: beam also lights abeam" report on #5 — the
card teaches both meanings of beam, so lighting both is correct and only the
metadata line is coarse.
