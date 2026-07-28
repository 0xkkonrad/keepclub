# Corrections log

A record of what independent verification passes found and what was changed, so
you can see where the deck has been stress-tested and where it has not.

## Round 1 — diagram QA (24 diagrams reviewed)

Seven factual errors found and fixed:

1. **`ds-lights-recognition` — sidelights were on the wrong sides.** Every
   head-on panel showed red on the viewer's left. Looking at a vessel from
   ahead you see her **green to your left and red to your right**. All panels
   corrected, and the diagram retitled "as seen from ahead" with an explicit
   heading line. This was the most serious defect in the set: it taught the
   wrong answer to the most common night-recognition question there is.
2. **`ds-points-of-sail` — port and starboard tack were swapped.** With the wind
   drawn from the top, the boats on the right-hand side have the wind on their
   **port** side and so are on port tack, and give way. The labels, and with
   them the right-of-way statements, were the wrong way round. Corrected, and a
   boom added to every hull so the tack can be read off the drawing — the boom
   always lies on the leeward side, which is the whole basis of the rule.
3. **`ds-beaufort` — the table header row was invisible.** The header used a
   `fill` presentation attribute, which CSS `text { fill: … }` overrides, so it
   rendered dark-on-dark and the table had no column labels. Now a `.hdr` class.
4. **`ds-light-characteristics` — the group-flashing row contradicted itself.**
   Labelled `Fl(3) 15s` but drawn with the group repeating at 7.5 s. Relabelled
   `Fl(3) 10s` and the timeline redrawn to match.
5. **`ds-sound-signals` — a signal that does not exist internationally.** The
   one-prolonged-blast row claimed a "leaving a berth" meaning under Rule
   34(e)/(f). Rule 34(e) covers only a blind bend or obstruction; the
   leaving-a-berth signal is a US Inland rule. Clause removed.
6. **`ds-variation-deviation` — a garbled line.** A half-finished "CadET"
   sentence read "Compass ← add Deviation ← add Easterly? no — use the rule
   below." Replaced with a coherent statement.
7. **`ds-fronts` — the "system tracks NE" arrow pointed south-east.** Reversed.

Layout defects fixed structurally rather than one at a time: `svg()` now
measures every text element and **auto-widens the canvas** so nothing can run off
the right edge, and warns if a diagram grows past 1400 px — which means its text
needs re-wrapping, not more canvas. Four diagrams (`colregs-sail`, `beaufort`,
`anchoring`, `mob`) were re-wrapped on that signal. `ds-tidal-datums` was
re-laid from scratch: every measurement now has its own vertical lane, the drying
rock stands above chart datum as it must, and the equations sit in their own
panel clear of the drawing.

Also changed: `ds-cardinal-marks` topmark geometry was rebuilt so East reads as
a diamond (bases meeting) and West as an hourglass (points meeting);
`ds-iala-lateral` cone colour bands are now clipped to the cone and topmarks
added; `ds-knots-ropes` retitled "quick reference" because it is a text table,
not illustrations — an honest label rather than a promise the card does not keep.

## Round 2 — content verification

Four reviewers checked all 488 cards against primary sources — IRPCS 1972 as
amended, the IALA Maritime Buoyage System, Admiralty NP5011 chart conventions,
the Met Office marine glossary, gov.uk, the RNLI and the RYA. They returned
**92 findings** (19 tides and chartwork, 15 buoyage and meteorology, 31 IRPCS and
lights, 27 seamanship and safety), every one of which was applied, plus **55 new cards** for
syllabus gaps. The deck went from 488 to **537 cards**.

### Errors that taught the wrong answer

- **Weather helm was inverted.** The card said you hold the helm *to leeward*.
  You hold the **tiller to windward** — that is where the name comes from. Worse,
  the deck's own heave-to card correctly says "lash the helm to leeward", so it
  contradicted itself three cards apart.
- **Port entry traffic signals were inverted.** Three *flashing* reds is the
  serious-emergency signal (IPTS 1); three *fixed* reds means do not proceed
  (IPTS 2). The card had them the other way round.
- **The reason given for leeward MOB recovery was the argument for windward
  recovery.** Leeward is correct — but because a yacht blows downwind far faster
  than a person in the water, so a casualty left to windward is one you drift
  *away* from. The card had said leeward "keeps the boat from being blown on top
  of the casualty".
- **Springing off a pontoon paired the wrong end with the wrong spring.** Ahead
  against a bow spring takes the *stern* out, not the bow.
- **"Buoyage runs clockwise around the British Isles" is wrong.** It runs *north*
  up the west coast and through the Irish Sea, *east* through the Channel, and
  *north* through the North Sea — not a circuit. Fixed in the card and the diagram.
- **Rule 18's opening qualifier was missing** — "except where Rules 9, 10 and 13
  otherwise require". Without it the card taught that sail beats power
  everywhere, which is the most dangerous simplification available in the
  section. Rule 13's "notwithstanding" override was missing for the same reason:
  a sailing vessel overtaking a power-driven vessel keeps clear.
- **The estimated-position construction put leeway into the DR**, contradicting
  the deck's own definition of dead reckoning.
- **A depth contour is the position line** — it does not give one "at right
  angles to your track".
- **The lee-bow tide card taught the free-windward-gain myth.** The tidal vector
  is identical on either tack; what the lee-bow tack buys you is that the stream
  carries you *towards* the objective.

### Out of date, and worth knowing

- **HM Coastguard no longer accepts out-of-date flares.** The card still listed
  Coastguard collection points. Disposal is the owner's legal responsibility.
- **BBC Radio 4's 198 kHz long wave closed on 27 June 2026**, so the shipping
  forecast now goes out on FM, DAB and BBC Sounds.
- **Vertical clearances under bridges and cables are above HAT** on new-edition
  Admiralty charts, not MHWS. Heights of lights and land features are still MHWS.
- **CG66 was withdrawn** — RYA SafeTrx or a person ashore, not the Coastguard.
- **UK arrival reporting is via Border Force's sPCR**, with the Q flag flown from
  the 12-mile limit.
- **100 N is a buoyancy aid, not a lifejacket** in current RYA guidance: only
  150 N and 275 N are designed to turn an unconscious wearer face-up.
- **Competent Crew has no pre-course experience requirement**, so describing the
  Day Skipper practical prerequisites as "the Competent Crew level of experience"
  was wrong.

### Precision the exam actually tests

Roughly fifty findings were omitted thresholds, exemptions and day shapes:
Rule 22 light visibility ranges by length (added as a card — the largest single
gap); Rule 23(d)(ii), where a power-driven vessel under 7 m doing 7 knots or less
may show one all-round white light and no sidelights at all; the Rule 27(g) and
30(e)/(f) small-vessel exemptions; Rule 25(c), which forbids showing the
red-over-green with a tricolour; that Rule 28's constrained-by-draught lights are
permissive; that Rule 34(a)'s one/two/three blasts apply only to a power-driven
vessel underway and in sight of another; that Rule 19(d)'s two prohibited
alterations are scoped to a vessel detected by radar alone; that lateral marks
may show any rhythm *except* Fl(2+1), which is reserved; that on a sectored light
the first range figure is white and the last green; that force 9 is a *strong*
gale on the Beaufort scale and a *severe* gale in warnings; that the bottom
visibility band is "very poor", not "fog"; and MARPOL Annex V's actual 3-mile and
12-mile limits.

Two arithmetic inconsistencies were fixed: 8.3 M at 5.5 kn is 1 h 30½ min, and
the barometric correction needs its 1013 mb reference to mean anything.

One claim was **removed for being unsourceable**: that "occasional" or "patches"
in a forecast means less than half the time. The Met Office publishes no
numerical definition, so the card now says so instead of inventing one.

Safety warnings were added where the procedure could hurt someone: diesel at
injection pressure can inject through skin, so injector unions get slackened half
a turn and cranked in short bursts; a hot coolant header cap must not be opened;
a towline goes round a *keel-stepped* mast only; and the RNLI **Float to Live**
advice was missing entirely from the cold-water-shock card, which had covered
only the rescuer's job.

One thing the reviewers explicitly confirmed as correct and warned against
"fixing": the motor-sailing cone has **no** length exemption in the international
rules. The under-12 m exemption that appears all over the internet is US Inland
only.

## Round 3 — diagram re-check

A second diagram reviewer confirmed **all seven round-1 fixes landed correctly**,
verifying the points-of-sail booms by pixel measurement (all four right-hand
boats boom-to-starboard, all four left-hand boats boom-to-port). It then found a
further 40-odd defects, of which these mattered:

- **`ds-cts-triangle` and `ds-ep-plot` described a convention they did not draw.**
  Both captioned the plotting convention — one arrowhead for the water track, two
  for the ground track, three for the tidal stream — while drawing a single
  arrowhead on every vector. Both diagrams were rebuilt around a new `vector()`
  helper that draws the right number of chevrons, so the convention is now
  visible rather than merely asserted. The captions had also been struck through
  by the very vectors they named.
- **`ds-fix-pilotage` had half a caption painted over.** The right-hand panel
  rectangle was drawn on top of the left panel's text, cutting "take the
  fastest-changing bearing las…" dead mid-word. The leading line also missed both
  of the marks it was supposed to pass through, which is the one thing a transit
  diagram has to get right. Rebuilt: the line runs through both marks, all
  captions now sit outside the panels where nothing can overpaint them, and the
  clearing bearing is explained in text rather than illustrated badly.
- **`ds-colregs-power`'s head-on panel contradicted its own caption.** The two
  vessels were offset laterally, so as drawn they were already set to pass
  starboard-to-starboard, and the two "alter to starboard" arrows converged
  towards each other. They are now bow to bow on one line, so the turns diverge
  into a port-to-port pass. "Each turns right" was also wrong for the
  southbound vessel and now reads "alters to starboard".
- **`ds-rule-of-twelfths` printed two lines on top of each other** — the
  "1-2-3-3-2-1 twelfths" line landed on the wrapped intro. Both were illegible.
- **`ds-other-marks` drew the special mark as a yellow cone** — the Region A
  starboard-hand shape, which is exactly the confusion the card warns against.
  Now a pillar.
- **`ds-fronts`**: the occlusion was a bare arc floating detached from the low; it
  now runs from the centre with alternating semicircle-and-triangle symbols, and
  the warm front's symbols are semicircles rather than full circles. "Wind backing
  (SE–S)" described a *veer*, and now reads "backing (SW towards SE)".
- **`ds-sound-signals`** gave the Rule 34 manoeuvring signals with no "in sight of
  one another" qualifier, directly above a restricted-visibility block — so a
  reader could have sounded one, two or three short blasts in fog. Qualifier added.
- **`ds-vhf-distress`**: the two columns of the Annex IV distress-signal list
  collided, one swallowing the other. Both are now wrapped independently.

A second structural guard was added while fixing these: putting `<tspan>` markup
inside `wrap()` splits the tag across lines and produces invalid XML, which
Chrome renders as a blank page. That happened once, silently, because the old
size check only failed below 3 KB. The threshold is now 30 KB — a real diagram is
always tens of KB — so a blank render fails the build instead of shipping.

Known and accepted: `ds-knots-ropes` is a text reference table, not knot
illustrations. Drawing topologically wrong knots would be worse than drawing
none, so the card is titled "quick reference" and says what it is.
