# Regression check — after the 50-change edit pass

Checked `build/STUDY-GUIDE.md` (199 cards) against `research/dry-audit.md` and
`research/coldread.md`, plus all fourteen `src/sec_*.py` sources. `build.py`
runs clean: 199 cards, 60 pointers, 139 original, no errors, no warnings.

**The pass came through largely clean.** All seven merges read standing alone.
All three deletions left nothing dangling. The four new cards and the radio card
match the voice and stay in scope — the radio card stops at "it is a VHF set,
channel 16 is the distress and calling channel, sending the call is the
skipper's job", with no Mayday, no Pan-Pan and no call format. Every seam the
audit named came out clean on containment: winches sail-handling × ropework 23%,
lifejackets safety × tender 14%, gas fire × duties 0%, painters emergency ×
tender 19%. No trailing `<br>`, no dangling connective, no answer left without
terminal punctuation, no "as above" or "the card before" anywhere in the deck.
The epigram strip did not damage a single sentence mechanically.

Three broken, four awkward.

---

## BROKEN

### 1. "What is a knot?" is now a circular definition · `src/sec_seaterms.py:87`

Audit finding 1.1 converted this to `ref("position", "What is a knot?")`, whose
whole answer is **"One nautical mile per hour."** The phrase *nautical mile*
occurs exactly once in the 199 cards — inside that answer. The deck now defines
a unit with a unit it never explains, for a reader whose stated profile is "never
been on a yacht".

The audit was right that the old card copied Day Skipper's five words verbatim,
and right that the boat-speed sentence it added was not enough to justify an
original. What it did not check was whether anything downstream still needed
*nautical mile*. Day Skipper's `position` card that would cover it carries the
latitude-scale chain and is correctly not pointed at.

**Fix.** Keep the pointer, and add one original immediately after it:

```python
 ref("position", "What is a knot?"),

 ("How far is a nautical mile, and why is everything measured in knots?",
  "About 1.15 land miles, or a little under 2 km &mdash; it is the unit every "
  "distance at sea is given in. Speed through the water is knots, and so is wind "
  "speed, so 'six knots' on the log and 'twenty knots' in the forecast are the "
  "same unit. Six knots is roughly a brisk walk, and that is about what a "
  "cruising yacht does."),
```

Scores 29% containment against its nearest Day Skipper card (`position`, "The
three quantities in every speed, time and distance sum") and carries none of the
latitude chain, so it does not re-open finding 1.1.

### 2. The liferaft painter is explained after the card that uses it · `src/sec_emergency.py:47`

Section 07 order is: `ref("safety", "How do you launch and board a liferaft?")`
— which says *"Secure the painter to a strong point"*, *"cut the painter"* — and
**then** the merged original *"The liferaft's painter — what is it, and why does
it go on first?"*. Built file: painter first used at line 677, first explained at
line 686. Section 10 defines the word too, but section 10 comes later.

The merge (audit 3.4) did not create this ordering — the pointer was already
above the two originals it collapsed. But collapsing two cards into one was the
moment to fix it, and it is now the only use-before-definition the resequence
brief left standing.

**Fix.** Swap the two entries so the painter card comes first:

```python
 ("The liferaft's painter &mdash; what is it, and why does it go on first?",
  ...unchanged...),

 ref("safety", "How do you launch and board a liferaft?"),
```

This also separates the two cards' shared "fast first, cut last" clauses, which
are currently consecutive.

### 3. `SECTIONS.md` still forbids the card the pass just wrote · `SECTIONS.md:45`

Line 40 reads **"Hard exclusions (zero cards, whatever Day Skipper has)"** and
line 45 lists `VHF / Mayday / DSC`. The deck now contains a VHF card. The
justification lives only in the `sec_emergency.py` docstring; the governing
document says the card should not exist, which is how a future author deletes it.

**Fix.** Replace line 45:

```
Mayday, Pan-Pan, DSC and distress-call format &middot; towing &middot;
helicopter rescue &middot; victualling &middot; night cruising &middot;
```

and add under the list:

> One exception, taken deliberately: `cc-emergency` carries a single VHF card,
> because three other cards referred to a radio the deck had never introduced.
> It stops at what the set is, that channel 16 is the distress and calling
> channel, and that making the call is the skipper's job. Distress procedure
> stays out.

---

## AWKWARD

### 4. The new kit card re-teaches the footwear rule · `src/sec_safetygear.py:44`

*"What do you pack for a week aboard"* says **"Deck shoes or boots with a soft
non-marking sole. No trainers with black soles."** Two cards earlier, *"What
should be on your hands and feet on deck?"* says **"deck shoes or boots with a
soft non-marking sole and a real grip pattern... Never smooth soles on a wet
deck."** Same rule, same words, same section. The audit's predicted failure mode,
arriving from a new card rather than a merge.

**Fix.** In the kit card, replace that line with:

```
<b>Deck shoes or boots</b>, and thick socks &mdash; wet feet are the first part
of you to get cold.<br>
```

The sole rule stays where it belongs, on the hands-and-feet card.

### 5. "One at a time." is orphaned by the strip · `src/sec_manners.py:23`

The burgee card now ends: *"...and it shifts to the **port** spreader when a
courtesy flag needs the starboard one. One at a time."* The coldread quotes the
pre-strip wording as *"one burgee at a time"*. Stripped to four words, the
subject reads as the courtesy flag mentioned in the sentence before it.

**Fix.** Replace `One at a time.` with `Only one burgee flies at a time.`

### 6. The flare card clears the duplication guard by 0.3 points · `src/sec_emergency.py:26`

*"You have been handed a flare and told to fire it. What do your hands do?"* —
the merge of audit findings 2.1 and 3.5 — scores **69.8%** containment against
Day Skipper `safety` "How do you fire a hand flare, and how do you fire a
parachute rocket?". `build.py` warns at `score > 0.7`. It is the highest
original-to-Day-Skipper score in the deck by 13 points, and it does not warn.

The card itself is defensible: it drops the cloud-base decision, which was the
reason for writing it, and the hot-slag paragraph is genuinely new. But the guard
the audit asked for in "What the build could catch that it does not" has a
threshold this card sits just under, so nothing will flag it if it drifts further.

**Fix.** `src/build.py:157` — `if score > 0.7:` → `if score > 0.65:`, and if the
card then warns, cut *"A **parachute rocket** is braced against your body and
fired upwards, never held out over the water and never near the rig."* — the
Day Skipper card carries the rocket technique and this section's own card says
you fire one when the skipper says to.

### 7. A `<br>` splits one sentence in two · `src/sec_duties.py:37`

*"When is a deck job actually finished?"* ends:

```
A line in a heap goes over the side and round the propeller;<br>a bight lying
across the deck trips you at the exact moment the boat rolls.
```

A semicolon-joined sentence rendered as two pseudo-bullets (built file lines
1104–1105). Same list-splitting artefact the coldread flagged in §6, in a card
the pass edited.

**Fix.** `propeller;<br>a bight lying` → `propeller. A bight lying`

---

## FINE

Verified and not a problem:

- All seven merges stand alone. Bollard, chafe/split-hose, over-pressed
  (sail-handling keeps the symptom list, helming keeps only weather helm), gas,
  winch turns, courtesy/Q flags, painter — each carries its own point.
- All three deletions are clean: the rolling-hitch and bowline pointers are gone
  from `cc-ropework` and both facts survive in the "— use" cards; the duplicate
  northerly card is gone from `cc-weather` and `cc-seaterms` owns it.
- Section 01 resequence works. `fore-and-aft` and `athwartships` are defined at
  line 29 and first used at line 36; `sheet` is defined at line 128 and first
  used at line 156. Both coldread ordering faults are fixed.
- The new parts-of-the-boat, watch-system, "say again" and kit cards read in the
  deck's voice — short declaratives, second person, concrete objects, no
  epigram tail.
- The pointer-imported problems are gone: no distress alert in the liferaft
  cards, no cloud-base decision in the flare card, no sewage over-claim in
  `cc-manners`.

**Carryovers, not caused by this pass.** Listed once so they are not re-found:
Beaufort is still four cards; the grab-bag pointer still asks for eight items and
answers with fifteen (only fixable by dropping the pointer, since Day Skipper is
read-only); the standing/running rigging card is still exploded into
pseudo-bullets with `chainplates. Running rigging` glued together;
`toerail`/`guardwires` still collide with section 01's `guardrails`; `quarter`,
`heave to`, `cringle` and `gooseneck` are still used undefined; `freeboard` is
still defined twice. All were in the coldread and none was in this pass's brief.
