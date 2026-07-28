# DRY audit — Competent Crew against Day Skipper

Resolved against Day Skipper `de2efa3`. 202 Competent Crew cards (62 pointers,
140 original) checked card-by-card against all 537 Day Skipper cards, and
against each other.

`build.py` passes clean, and that is the finding behind the finding: **not one
of the duplications below scores above 60% word overlap**, and the highest
Jaccard score anywhere in the deck between an original card and a Day Skipper
card is 38%. Two cards can state the same seven facts in entirely different
sentences. The crude check cannot see that, and it is the only check there is.

31 findings.

| recommendation | count |
|---|---:|
| make it a pointer | 4 |
| make it original | 3 |
| merge | 7 |
| delete | 3 |
| leave it — justified | 14 |

---

## 1. Original cards that should have been pointers

### 1.1 A knot — the one place Day Skipper wording was copied · **make it a pointer**

- CC `cc-seaterms` — *"'We are doing six knots' — what is a knot?"*
- DS `position` — *"What is a knot?"* → **"One nautical mile per hour."**

The Day Skipper answer is five words long. The Competent Crew answer **opens
with those five words, verbatim**, and then adds one sentence. This is not a
paraphrase; it is a copy, and the README's rule — *"No Day Skipper wording is
ever stored in this repo"* — is broken by it.

The triage rationale in `MANIFEST.md` reads: *"CC version: a knot is one
nautical mile per hour ... no chart-measurement chain behind it."* There is no
chart-measurement chain in the Day Skipper card. The rationale describes the
**adjacent** card, `position` / *"What is a nautical mile, and how does it
relate to latitude?"* — which does carry the latitude-scale chain, and which is
correctly not pointed at. The triage simplified the wrong card.

**Point at `ref("position", "What is a knot?")`.** If the boat-speed-and-wind-speed
sentence is worth keeping, it belongs in Day Skipper, where it is equally true.

### 1.2 Where a forecast comes from · **make it a pointer**

- CC `cc-weather` — *"Where does the weather forecast on board come from?"*
- DS `meteo` — *"Where can you get a marine forecast at sea?"*

Six sources against six sources, in the same order: Shipping and Inshore Waters
on the radio, Coastguard VHF, NAVTEX, websites and apps, the marina office wall.
The manifest justified writing a new one as *"no frequencies, no long-wave
history"* — but the frequencies are not what would have made the Day Skipper
card too deep. The **fact** is the list of sources, and the list is identical.
Stripping `518 kHz` from it produced a reword, not a simplification.

The Competent Crew bullet is *"understands the forecasting services and where to
obtain a suitable weather forecast"* — which is exactly what the Day Skipper
card answers. Point at it. If the frequencies really are unwanted, then cut the
Competent Crew card to three sources so that it is visibly a different card, not
the same one with the numbers filed off.

### 1.3 The seasick crew member · **make it a pointer**

- CC `cc-seasickness` — *"Why is a badly seasick crew member a safety problem rather than a joke?"*
- DS `safety` — *"How do you deal with a crew member who is seriously seasick?"*

Point for point, in different words:

| fact | Day Skipper | Competent Crew |
|---|---|---|
| casualty, not a nuisance | "treat them as a casualty, not a nuisance" | "they stop being crew and become a casualty" |
| judgement goes | "poor judgement and accidents" | "Judgement goes first, then balance" |
| dehydration | "it causes dehydration" | "**Dehydration is the real danger**" |
| on deck, low, warm | "on deck in the fresh air, low down and warm" | "kept on deck, low down and warm" |
| clip them on | "Clip them on" | "lifejacket on and **clipped on**" |
| keep fluids going | "keep fluids going" | "Keep fluid going in" |

The manifest deferred this Day Skipper card on the grounds that it is *"written
as the skipper managing a casualty"*, and specified the replacement: *"CC card:
what to do when you feel sick — stay on deck, low and warm, eyes on the horizon,
eat something, take the helm, take tablets before you sail."* That card exists —
it is `cc-seasickness` *"What actually helps?"*, and it is correct. This **third**
card then re-created the very card the triage had decided not to write.

Point at the Day Skipper card and keep the two first-person cards. Looking after
a shipmate who is being sick is crew work, not skipper work; the deferral was
wrong about who that card is addressed to.

### 1.4 Where a mooring warp breaks · **merge**

- CC `cc-ropework` — *"Where does a mooring warp actually break, and what do you do about it?"*
- DS `terms` — *"Chafe — why is it the thing that actually breaks mooring lines?"*

46% containment, and the shared part includes the rhetorical framing — both
cards are built on the phrase *"actually breaks mooring lines"*. Both carry: it
wears where it rubs, it happens overnight and unseen, lead it through a
fairlead, use a chafe sleeve or hose, watch the toe rail.

One thing in the Competent Crew card is genuinely new and genuinely crew-level:
**the protection goes on the rope, at the point that touches, and is taped
there — padding the fitting achieves nothing.** Day Skipper does not say that.

Merge: point at the Day Skipper card, and keep a short original that carries
only the jacket-goes-on-the-rope rule. As written, one new sentence is paying
for a whole restated card.

### 1.5 Weather shore and lee shore · **make it a pointer**

- CC `cc-seaterms` — *"Weather shore or lee shore — which is which?"*
- DS `terms` — *"Lee shore — and why it matters"*

55% containment. The manifest's reason for simplifying: *"the danger/shelter
framing is a skipper's anchorage decision."* That does not survive reading the
Day Skipper card — *"the wind and waves push you towards it, and it gives no
shelter"* is not a decision, it is the reason the two words are worth
distinguishing. Removing it left the Competent Crew card as a naming mnemonic
with nothing behind it, which is the version a beginner forgets.

The Day Skipper card is four lines, has no tide, no chart and no rule number,
and would have been fine as it stands. Point at it. The `windward-lee` figure
can be attached to the pointer's landing just as easily.

### 1.6 The bollard card restates two pointers above it · **merge**

- CC `cc-ropework` — *"How do you make a line fast to a bollard?"*
- DS `ropework` — *"Round turn and two half hitches — use"* (56% containment) — **already a pointer six cards earlier in the same section**
- DS `ropework` — *"Bowline — use"* — **also already a pointer in the same section**

DS: *"The round turn takes the load, so it can be tied and untied while the line
is under tension."* CC, in the same section: *"a round turn and two half hitches,
which can be tied, eased and let go with the line loaded."* Same for the bowline
(*"drop a loop over a post"* / *"drop a bowline over the top"*).

The card has two things worth teaching that nothing else in either deck carries:
which of the two knots suits a single bollard, and the figure-of-eight on a
double bollard. Cut the knot rationales — the reader met them six cards ago —
and let the card be about the bollards.

### 1.7 The signs of being over-pressed, taught twice · **merge**

- CC `cc-sailhandling` — *"What does reefing do, and what will you feel before the skipper calls for one?"*
- CC `cc-helming` — *"The tiller is pulling hard against your hand. What is the boat telling you?"*
- DS `handling` — *"What are the signs you are over-canvassed and should reef?"*

Day Skipper's list: excessive heel, heavy weather helm, slowing and slamming
rather than accelerating, leeward rail down, helm working hard. The sail-handling
card carries all five. The helming card carries heel, heavy helm and *"the first
sign of a reef being wanted"*. Two sections, two authors, one Day Skipper card.

The deferral itself was right — the Day Skipper card ends in *"if you are
wondering whether to reef, reef"*, which is the skipper's call. But it should
have produced **one** Competent Crew card. Merge: leave the symptom list in
`cc-sailhandling` (where reefing lives) and cut it from the helming card, which
should keep only what is actually about the helm — that a loaded tiller is a
dragging rudder, so you are steering hard and going slower.

### 1.8 The engine bay fire · **leave it — justified**

- CC `cc-fire` — *"The engine bay is alight. What is the one thing you must not do?"*
- DS `safety` — *"How do you fight an engine compartment fire?"*

41% containment, and both say: stop the engine, shut off the fuel, do not open
the compartment, leave it closed. Thin margin — but the Day Skipper card's
operative instruction is *"discharge the extinguisher through the dedicated
port"*, which is fitted equipment most charter boats do not have and which no
crew member operates. Strip that and you are left with a prohibition, which is
what the Competent Crew card is. Genuinely simpler, genuinely differently
framed. Keep both.

### 1.9 The MOB immediate actions · **leave it — justified**

- CC `cc-mob` — four originals: *"What do you shout?"*, *"What is the pointer's job?"*, *"What goes over the side, and how soon?"*, *"What does the MOB button do, and who presses it?"*
- DS `emergencies` — *"What are the immediate actions for a man overboard?"*

This is the case the design is for, and it works. The Day Skipper card is a
six-item list ending *"start the engine, checking for lines over the side; and
manoeuvre back to the casualty"* — the last two items are the skipper's, and
the first four are compressed to a phrase each. Each Competent Crew card adds
something the list cannot: *why* the pointer does nothing else (a head shows for
a second at a time between waves), *why* you throw even if it lands nowhere near
(it drifts with the water they are in), *who* presses the button (whoever is
nearest, and press it twice). Four cards at crew depth against one line each at
skipper depth. Correct.

### 1.10 Rafting etiquette · **leave it — justified**, with a drift warning

- CC `cc-manners` — three originals: *"Another yacht asks to raft alongside you"*, *"You are rafting onto another yacht"*, *"You are on the outside of a raft"*
- DS `handling` — *"How do you raft up alongside another yacht?"*

Every one of Day Skipper's seven etiquette points reappears across the three
Competent Crew cards: ask permission, fenders high at the widest point, lines
onto the inside boat, your own shore lines, cross the foredeck and never the
cockpit, stagger the masts, agree who is leaving when. The only skipper clause
in the Day Skipper card is *"approach into the stronger of wind and tide"*.

Kept, because the Competent Crew cards add real crew content the Day Skipper
card has no room for — fenders at **toerail** height rather than "high", fenders
already out as the signal that you may be come alongside, saying out loud once
your own shore lines are on, and going quietly across a foredeck after dark. But
this is now the deck's largest unshared overlap: **a change to rafting etiquette
has to be made in four places, and three of them are here.** See 5.6.

### 1.11 Anchoring and seagrass · **leave it — justified**

- CC `cc-manners` — *"Why does it matter where the anchor goes down?"*
- DS `environment` — *"How should you avoid damaging the seabed when anchoring?"*

Both: seagrass, chain scours it, use the eco-moorings. The Competent Crew card
adds why it matters (nursery ground, the bare circle a swinging mooring wears)
and closes on exactly the right division of labour — *"Finding the seagrass is
the skipper's job. Knowing why it is being avoided is yours."* That sentence is
the justification, and it is the difference between the two cards. Keep both.
Note that *"use the eco-moorings where they are laid"* is now authored twice.

---

## 2. Pointers that should have been original cards

The triage was told to be conservative and mostly was. 58 of the 62 pointers
are clean: an order the crew is given, no rule number, no calculation, no
decision. `cc-lookout` takes **zero** pointers because every Day Skipper
`colregs` card names a rule — that call is correct and should not be revisited.

Four exceptions.

### 2.1 Firing flares · **make it original**

`cc-emergency` → `ref("safety", "How do you fire a hand flare, and how do you fire a parachute rocket?")`

The pointed-at answer contains:

> *"fire it near vertically, angled about 15&deg; downwind in strong wind ...
> **Under low cloud a rocket disappears into the cloud, so use a hand flare
> instead.**"*

That last sentence is a decision — read the cloud base, choose which flare to
fire — imported into a section whose own card says *"You fire one when the
skipper says to, and for nothing else."* The deck contradicts itself two cards
apart. The angle figure is a firing judgement of the same kind.

Write the crew version: how each is held or braced, gloves, leeward and
downwind, never look at it, never over anything inflated, read the case. This
also resolves 3.5.

### 2.2 Getting into the liferaft · **make it original**

`cc-emergency` → `ref("safety", "When do you actually get into the liferaft?")`

Imports **"Send a distress alert first"**. VHF / Mayday / DSC is on the hard
exclusion list in `SECTIONS.md` and appears nowhere else in the deck; a crew
member reading this card is told to do something the deck has deliberately never
taught them. The card also turns on *"only when you are certain you must step
**up** into it"* — the abandon-ship judgement, which is the skipper's alone.

The teaching line ("step up into it, the yacht is your best liferaft") is worth
keeping. Write it without the distress alert. Fixing it upstream is not
available: the no-write rule forbids touching the Day Skipper tree, and the
clause is correct for Day Skipper.

### 2.3 Slab reefing · **leave it — justified**, minor

`cc-sailhandling` → `ref("handling", "How do you put a reef in with slab reefing?")`

Step one is *"Head up or heave to"*. Heaving to is a skipper's manoeuvre and is
defined nowhere in the Competent Crew deck, so a first-timer meets an undefined
instruction in the first three words of a sequence they are otherwise meant to
follow with their hands. Everything after it is crew work. Not worth losing the
pointer over — but if the card is ever rewritten in Day Skipper, that clause is
the one to watch.

### 2.4 Lifejacket versus buoyancy aid · **leave it — justified**, deepest pointer in the deck

`cc-safetygear` → `ref("safety", "Lifejacket or buoyancy aid: what is the difference, and what rating do you want for cruising?")`

*"What rating do you want"* is a buying decision, and the answer runs to four
newton ratings (50 / 100 / 150 / 275) plus a recommendation for an AIS beacon or
PLB. That is the deepest card in the 62. It stays because the syllabus bullet
names buoyancy aids explicitly and the newton ratings **are** the difference
between the two things — a crew member who does not know 50 N will not turn them
face-up does not understand the guidance they are being asked to comply with.

---

## 3. Duplication within the Competent Crew deck

The five parallel authors converged on the seams the brief predicted, and on two
it did not.

### 3.1 The rolling hitch, four times · **delete**

Four cards in the built deck teach "a rolling hitch takes the load off a riding
turn or a jammed sheet":

1. `cc-sailhandling` → `ref("terms", "Riding turn")` — *"Take the load off with a rolling hitch onto a spare line, then clear it."*
2. `cc-ropework` → `ref("ropework", "Rolling hitch — use")` — *"The standard fix for a riding turn on a winch or a jammed sheet: tie it to the loaded line and lead it to another winch."*
3. `cc-ropework` → `ref("ropework", "Which knot takes the load off a jammed, loaded sheet?")` — *"A rolling hitch on the loaded line, led to a spare winch or cleat."*
4. `cc-sailhandling` — original, *"What causes a riding turn, and how do you keep from making one?"*

(2) and (3) are the same card twice, 44% containment, zero new information.
Day Skipper can carry both because they sit in different sections a hundred
cards apart and serve different recall prompts. Competent Crew puts them **six
cards apart in one section**, where the reader sees the answer twice in a
minute — and the manifest marked both `reuse` without noticing.

Delete pointer (3) from `cc-ropework`. Keep (1), (2) and the causes/prevention
original, which is genuinely different — nothing in Day Skipper says how to
avoid making one.

### 3.2 The bowline, twice in one section · **delete**

- `cc-ropework` → `ref("ropework", "Bowline — use")` — *"Used to attach a sheet to a clew, drop a loop over a post, or make a temporary loop anywhere."*
- `cc-ropework` → `ref("ropework", "Which knot for a jib sheet to the clew of a headsail?")` — *"A bowline. It holds securely under load and can still be undone afterwards."*

The second is a strict subset of the first, seven cards later. Same inherited
pattern as 3.1. Delete the second; the knot's correct use is already stated.

### 3.3 A northerly wind, twice · **delete**

- `cc-seaterms` — *"The forecast says 'northerly'. Where is the wind coming from?"*
- `cc-weather` — *"A **northerly** wind &mdash; which way is it blowing?"*

Same fact, same worked example, both original, two sections apart, written by
two authors. And `MANIFEST.md` planned **exactly one** — *simplify from `meteo`
"Which direction is a wind named for?"* — placed in section 01. Section 11 wrote
it again without knowing.

This is the clearest single instance of the failure the whole design exists to
prevent, and it is worse than a two-way duplication: Day Skipper's `meteo` card
states the same fact a third time, so **one fact has three authors** (see 5.1).

Delete the `cc-weather` card. Section 01 owns wind-direction naming; it is
introduced before the reader reaches meteorology.

### 3.4 The liferaft painter, three times in twelve cards · **merge**

- `cc-emergency` → `ref("safety", "How do you launch and board a liferaft?")` — *"Secure the painter to a strong point on the boat, throw the raft over the **leeward** side ... cut the painter [when everyone is aboard]"*
- `cc-emergency` → `ref("safety", "When do you actually get into the liferaft?")` — *"never cut the painter until everyone is aboard"*
- `cc-emergency` — original, *"The painter — what is it, and what happens if it is not made fast first?"*
- `cc-emergency` — original, *"Why does a liferaft go over the leeward side?"*

The two originals restate two clauses of the pointer three cards above them. In
their favour, both carry a *why* that Day Skipper does not have and that is the
thing that makes the rule stick — the painter is also the lanyard that fires the
gas bottle, and a raft thrown to windward ends up under the hull.

Merge the two originals into one card: what the painter is, why it is made fast
first and cut last, and why the raft goes to leeward. Three statements of "fast
first, cut last" across twelve cards is one too many at any depth.

### 3.5 Hand flare technique, twice in one section · **merge**

- `cc-emergency` → `ref("safety", "How do you fire a hand flare...")` — *"hold it at arm's length over the side on the **downwind, leeward** side, angled away from you, the boat and the rig, gloves on"*
- `cc-emergency` — original, *"A red hand flare is burning in your hand. What is coming off the end of it?"* — *"Gloves on, arm straight out over the water on the downwind side"*

The original's real content is the **hot slag** — that it drips, and what it
drips through. That is not in Day Skipper and is exactly the sort of concrete
reason the authoring guide asks for. The technique sentence attached to it is a
restatement.

Cut the technique from the original and let it teach the slag. If 2.1 is taken
and the pointer becomes original, merge the two into one flare-handling card
instead.

### 3.6 Gas off at the bottle — twice, and the two versions disagree · **merge**

- `cc-fire` — *"What is the routine every time you finish at the cooker?"* — *"Turn the gas off **at the bottle first** and leave the burner alight until the flame dies on its own, then turn the ring off. That empties the hose."*
- `cc-duties` — *"You are asked to make hot drinks under way. How do you do it safely?"* — *"Gas **on at the bottle** before you light it and **off at the bottle** when you are finished."*

The `cc-duties` version is the same rule with the burn-off removed — and the
burn-off *is* the rule. Emptying the hose is the entire reason the sequence is
bottle-first, and a crew member who reads only the general-duties card learns
the ritual without the point of it.

This is the exact failure mode the design is meant to stop, arriving from inside
the deck instead of across it: two authors, two versions, and the shorter,
lossier one sits on the card a crew member actually reads while making tea.

Cut the gas line from `cc-duties` — the card is already eight instructions long
— and let `cc-fire` own it. (Day Skipper's `safety` LPG card states it a third
time; see 5.9.)

### 3.7 Which way the turns go on a winch, twice · **merge**

- `cc-sailhandling` — *"How many turns go on a winch, and which way round?"* — *"**Three turns** ... and **clockwise** — every winch on the boat turns the same way."*
- `cc-ropework` — *"How do you spot a rope that has gone on the wrong way round?"* — *"A winch takes turns **clockwise** only, so if the drum fights the handle, or the turns lift and go slack as you wind, they are on backwards."*

50% containment. The ropework card is about diagnosing a bad lead before the
load comes on, which is a good card and is nowhere else; the winch clause is
borrowed from the section next door. This is precisely the winch-technique seam
between sail handling and ropework the brief flagged.

Narrow the ropework card to cleats, fairleads and leads in general — it already
has the strongest material there (*"a rope that will not **render** when you
ease it is telling you the same thing"*) — and let sail handling own the winch.

### 3.8 Letting a rope run under control · **leave it — justified**

- `cc-ropework` — *"You are told to let a warp out under control while the boat moves. How?"*
- `cc-ropework` → `ref("terms", "What does 'make fast', 'belay', 'surge' and 'snub' mean?")`
- `cc-sailhandling` — *"What is the difference between 'ease the sheet' and 'let it fly'?"*

The pointer defines *surge* and *snub* in six words each; the original is the
procedure — how many turns, lean back, feed it, where your hands go relative to
the cleat. A definition and a drill, not two definitions. The sail-handling card
is about a sheet on a winch under sail, which is a different set of hands.
Keep all three.

### 3.9 Lifejackets in the tender · **leave it — justified**

- `cc-safetygear` → `ref("safety", "When should the crew wear lifejackets and harnesses?")` — the list already includes *"in a dinghy"*
- `cc-safetygear` — *"Automatic or manual inflation — which have you got, and why does it matter?"*
- `cc-tender` — *"Do you really wear a lifejacket for a two-minute row ashore?"*

The predicted seam, and it holds up. The tender card carries the thing that
actually kills people — the short familiar trip, at night, coming back, after a
drink, with nobody watching — and that is in neither of the others. The
manual-inflation nuance is stated in both sections, but the tender card's version
is a different claim (*manual can be the better choice in a wet dinghy*), not a
restatement. Keep.

### 3.10 Rope tails and propellers · **leave it — justified**

- `cc-ropework` — *"The line is made fast. What happens to the rest of the rope?"*
- `cc-duties` — *"When is a deck job actually finished?"*
- `cc-tender` — *"What are the rules about the painter?"*
- `cc-duties` → `ref("engine", "Why should you check for lines in the water before starting the engine?")`

Four cards land on "a rope in the water finds a propeller". One is about a single
line just made fast, one about the state of the whole deck at the end of a job,
one about a painter trailing astern, one about the moment before start-up.
Different actions, different moments, one consequence. This is repetition doing
its job on a deck — the consequence is the reason all four rules exist, and a
learner meeting it four times in four contexts is the point.

### Seams that came out clean

Worth recording, because the brief expected them to fail:

- **MOB kit** is not duplicated between `cc-mob` and `cc-emergency`. Section 06
  owns the danbuoy, lifebuoy and what goes over the side; section 07 confines
  itself to flares, the beacon, the grab bag and the raft. No overlap at all.
- **Winch technique** appears in `cc-sailhandling` only, apart from 3.7.
- **Fire** and **general duties** overlap only on the gas line (3.6). Extinguisher
  location, the fire triangle, smoking and the shout-order are in `cc-fire` alone.

---

## 4. Pointers whose Day Skipper card has drifted

### 4.1 Discharge overboard — the pointer contradicts the card next to it · **make it original**

`cc-manners` → `ref("environment", "What may you not discharge overboard?")`

The pointed-at answer states:

> *"Sewage discharge is regulated and prohibited in many harbours and marinas —
> use pump-out facilities where they exist."*

The `cc-manners` module docstring says, in terms, that this is over-claimed:

> *"**Sewage discharge** — there is no general UK prohibition in coastal waters
> and no recent UK change; the offshore figure is The Green Blue's best practice,
> and it is the rules abroad that have been tightening."*

And the section's own original, *"Where may the heads be emptied?"*, hedges it
carefully — *"that is best practice, not UK law"*, *"Abroad it very often **is**
law"*. So the built deck asserts a regulatory claim in one card and disowns it
two cards later, and the author of the second card had already decided the first
one was wrong.

This is the most serious drift in the deck, because it is not a scope problem —
it is a **correctness** problem that the pointer mechanism carried in silently.
It is also unfixable upstream: the no-write rule forbids editing the Day Skipper
card, and the clause is defensible in a Day Skipper context.

Replace the pointer with an original covering the part that is not contested —
oil, oily mixtures, plastics absolutely, garbage other than food waste, chemical
toilet contents ashore — and let the existing heads card carry sewage with its
hedge intact.

### 4.2 Liferaft pointer imports a distress alert

`ref("safety", "When do you actually get into the liferaft?")` — *"Send a
distress alert first."* VHF / Mayday / DSC is a hard exclusion. Same finding as
2.2; recorded here because the mechanism is drift rather than depth — the
excluded topic arrives inside a card that is otherwise in scope.

### 4.3 Flare pointer imports a cloud-base decision

`ref("safety", "How do you fire a hand flare, and how do you fire a parachute
rocket?")` — *"Under low cloud a rocket disappears into the cloud, so use a hand
flare instead."* Same finding as 2.1.

**Both predicted candidates confirmed.** The man-overboard pointers, by
contrast, are clean: `ref("emergencies", "Why should the engine be out of
gear...")` and `ref("emergencies", "Why lift a MOB casualty horizontally if you
can?")` carry no rule number, no tidal concept and no decision. `ref("safety",
"What is a danbuoy for?")` likewise.

### 4.4 The bitter end · **leave it — justified**

`cc-ropework` → `ref("ropework", "What are the three parts of a rope...")` ends:
*"strictly, the **bitter end** means the inboard end of the anchor cable, made
fast at the bitts."* Anchoring is not a Competent Crew topic and "bitts" is
defined nowhere in the deck. One clause, no harm done, and the manifest called
it (*"the bitter-end aside is one clause and harmless"*). Leave.

### 4.5 Cunningham and chainplates · **leave it — justified**

`cc-seaterms` → `ref("terms", "Standing rigging versus running rigging")` names
*chainplates* and *cunningham*, neither defined anywhere in Competent Crew and
neither on the figure-label list in `AUTHORING.md`. Two unexplained words inside
a naming card whose job is naming. Tolerable — the reader is meeting fourteen
words at once and these are the two they will not be asked about — but it is
drift, and it will grow if the Day Skipper card ever gains a third.

### 4.6 Severe gale 9 · **leave it — justified**

`cc-weather` → `ref("meteo", "What are the wind speeds for Beaufort forces 5, 7
and 9?")` adds *"though gale warnings and the shipping forecast call it **severe
gale 9**"*. `SECTIONS.md` excludes Shipping Forecast interpretation. This is
terminology rather than interpretation, and the section's own gale-warning card
needs the vocabulary. Leave.

### 4.7 AIS beacon and PLB in the lifejacket card · **leave it — justified**

`cc-safetygear` → `ref("safety", "Lifejacket or buoyancy aid...")` closes on
*"preferably an AIS beacon or PLB"*, which is equipment `cc-emergency` covers in
its own card. A one-clause overlap between two sections, on kit the crew does
not operate. Leave.

---

## 5. Facts that should be shared and are not

Each of these is now authored in two or three places with no pointer between
them. A correction to one leaves the others silently wrong — and because the two
decks are going into one app with one review history keyed on `sha1(question)`,
a learner can be taught both versions and never see the conflict.

| # | fact | authored in | see |
|---|------|-------------|-----|
| 5.1 | a wind is named for where it blows **from** | DS `meteo` + `cc-seaterms` + `cc-weather` — **three** | 1.x / 3.3 |
| 5.2 | a knot is one nautical mile per hour | DS `position` + `cc-seaterms` — and the CC sentence is verbatim | 1.1 |
| 5.3 | mooring lines fail by chafe, overnight, at a fairlead or toe rail | DS `terms` + `cc-ropework` | 1.4 |
| 5.4 | where a marine forecast comes from | DS `meteo` + `cc-weather` | 1.2 |
| 5.5 | how to look after a badly seasick crew member | DS `safety` + `cc-seasickness` | 1.3 |
| 5.6 | rafting etiquette | DS `handling` + `cc-manners` × 3 — **four places** | 1.10 |
| 5.7 | the signs of being over-canvassed | DS `handling` + `cc-sailhandling` + `cc-helming` — **three** | 1.7 |
| 5.8 | seacocks — and the two decks **disagree** | DS `terms` + `cc-seaterms` + `cc-duties` × 2 | below |
| 5.9 | gas off at the bottle when you finish cooking | DS `safety` + `cc-fire` + `cc-duties` — **three** | 3.6 |
| 5.10 | assume a ship has not seen you | DS `fog` + DS `safety` + `cc-lookout` — **three** | below |

### 5.8 deserves a ruling, not just a note

Day Skipper `terms`: *"They are your first defence against flooding, so **every
crew member should know their location and how to shut them**, and softwood
bungs should be stowed nearby."*

Competent Crew `cc-seaterms`: *"Find the heads and sink ones on your boat before
you sail, and **leave every seacock exactly as the skipper set it**."*
`cc-duties` repeats the same instruction twice more.

One deck tells the crew to know how to shut them; the other tells them not to
touch. Both are defensible teaching positions and neither points at the other.
Recommendation: **leave the split** — the Competent Crew framing is right for
someone on their first weekend, and "leave it as the skipper set it" is the
safer default for a person who cannot yet tell a heads seacock from an engine
intake. But this is a substantive disagreement between two decks that will share
one screen, and it should be a recorded decision rather than an accident of
parallel authorship.

### 5.10 is smaller and needs no action

*"Assume you have not been seen"* is in Day Skipper twice already (`fog` and
`safety`, both radar-reflector cards) and once in `cc-lookout`. The Competent
Crew version earns its place — it adds the blind sector ahead of a large ship's
bow and the mile-plus stopping distance, neither of which is in either Day
Skipper card. Leave it.

---

## What the build could catch that it does not

Not asked for, but it falls straight out of the above. All three would have
caught findings in this audit and none needs a Day Skipper edit:

1. **Containment, not Jaccard.** `near_duplicate` divides by the union, so a
   long Competent Crew card that swallows a short Day Skipper card whole scores
   low — finding 1.1, a verbatim copy of a five-word answer, scores 47% on
   Jaccard and 100% on containment. Dividing by the *shorter* card's word count
   and dropping stop-words surfaces 1.1, 1.5, 1.4, 1.7 and 3.1.
2. **Check pointer against pointer, and pointer against original, inside a
   section.** The build only ever compares originals to Day Skipper. Findings
   3.1, 3.2, 3.4 and 3.5 are all pairs where at least one side is a pointer,
   which is why every one of them passed.
3. **Warn when a Competent Crew card's question is missing from
   `manifest.json`.** Finding 3.3 was planned as one card and written as two;
   the manifest already knew the right answer and nothing checked against it.
