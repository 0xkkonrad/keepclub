# Competent Crew deck — fact-check

Checked 2026-07-27. Scope: the **140 original Competent Crew cards** only. The 62 cards that also
appear in `/workspaces/sandbox/projects/rya-day-skipper/STUDY-GUIDE.md` were identified
mechanically (heading match) and excluded — see the note at the very end for the one exclusion
that troubled me.

Every URL below is a page I opened with WebFetch in this session and read the returned text of.
Where I relied on a search engine's extraction rather than a clean fetch, I say so. `rnli.org`
returns HTTP 403 to automated fetching (confirmed again on `https://rnli.org/safety/float`), so no
RNLI page is cited directly; the RNLI's float advice is cited via the **RYA's** page, which I did
open.

Severity key: **ERROR** = the card states something untrue or self-contradictory.
**IMPRECISION** = loose but not misleading on its own. Taste is not listed.

---

## Findings, most serious first

### 1. ERROR — cold water shock: "within a couple of minutes your hands stop working"

**Card:** *Cold water shock — what does it do, and why does it kill before hypothermia does?*
(`src/sec_mob.py:23`)

**What it says:** "Within a couple of minutes your hands stop working, so you cannot hold a rope
thrown to you. Hypothermia takes half an hour or more."

**What is actually true:** The standard model is **1-10-1**: about **1 minute** of cold shock, then
approximately **10 minutes** of cold incapacitation before you lose useful movement, then about
**1 hour** before unconsciousness from hypothermia. Verbatim from the page I opened:
*"Over approximately the next 10 minutes you will lose the effective use of your fingers, arms and
legs for any meaningful movement"* and *"Even in ice water it could take approximately 1 hour
before becoming unconscious due to Hypothermia."*

Two minutes is not merely imprecise, it inverts the practical lesson. The 10-minute window is
precisely the window in which a casualty is meant to *do* something — grab a line, get to the
ladder, secure themselves. Telling a beginner their hands are gone in two minutes teaches them
that self-rescue is hopeless at the moment it is still possible, and it makes the crew card
opposite it ("a line ready with a big bowline already tied in it") look pointless.

**URL opened:** https://csbc.ca/1-10-1-principle/

**Proposed replacement (whole answer):**

> The first minute is the one that kills. Cold water makes you **gasp involuntarily** and then
> breathe fast and hard, and you cannot stop either; if your head is under when you gasp, you
> inhale water. Remember **1-10-1**: roughly **one minute** of gasping, then about **ten minutes**
> in which your hands and arms still work well enough to grab a line or a ladder — use them —
> and around **an hour** before hypothermia takes your consciousness. Cold shock kills in seconds
> and hypothermia in hours, which is why the first minute is the dangerous one. Being a strong
> swimmer barely helps.

---

### 2. ERROR (self-contradiction) — two winch cards give opposite instructions on adding turns

**Cards:** *How many turns go on a winch, and which way round?* (`src/sec_sailhandling.py:47`) and
*What causes a riding turn, and how do you keep from making one?* (`src/sec_sailhandling.py:61`)

**What they say:** Card 1: "Put the turns on while the rope is slack. **Adding a turn to a loaded
winch is how fingers get dragged in.**" Card 2: "start with three turns and **add the fourth only
once the load is already on**."

One card forbids exactly what the other instructs, twelve cards apart in the same section. A
beginner cannot obey both.

**What is actually true:** Card 2 is the trade practice — three turns to pull the slack in by hand,
then more turns added as the load comes on and before you wind. Safe Skipper's winch page (opened):
*"Wind the rope around the drum three or four times"*, *"wrap the rope around the barrel of the
winch in a clockwise direction"*, *"Pull all the slack in before you load the winch to avoid a
riding turn."* Card 1's blanket prohibition is a safety simplification that is stated as a fact and
is not one. The real rule is *how* you add the turn: hand flat, back of the hand to the drum,
fingers out of the nip.

**URL opened:** https://www.safe-skipper.com/how-to-operate-a-winch-on-a-yacht/

**Proposed replacement for card 1's last two sentences:**

> Put the first turns on while the rope is slack. Extra turns go on **as the load builds** — that
> is normal and you will be asked to do it — but add them with the back of your hand to the drum
> and your fingers well clear of where the rope feeds on.

(and leave card 2 as it stands.)

---

### 3. ERROR — big ship blind sector "well over a mile"

**Card:** *A big ship is coming up the channel. Why does that matter to you on the foredeck?*
(`src/sec_lookout.py:27`)

**What it says:** "there is a blind sector ahead of the bow that runs to several hundred metres, on
the biggest ships **well over a mile**".

**What is actually true:** SOLAS Chapter V regulation 22 caps it. For ships of not less than 55 m
built on or after 1 July 1998: *"The view of the sea surface from the conning position shall not be
obscured by more than two ship lengths or 500 m whichever is less forward of the bow to 10 degrees
on either side under all conditions of draught, trim and deck cargo."* Two ship lengths of a 400 m
ship is 800 m, but the 500 m cap is the binding figure. "Several hundred metres" is right; "well
over a mile" is a yachting-magazine number with no regulatory basis, and it is the one figure in
this card a beginner is likeliest to repeat.

**URL opened:** https://marinegyaan.com/what-is-navigation-bridge-visibility-requirements-as-per-solas/
(I also tried `https://navsregs.wordpress.com/2017/10/18/bridge-visibility-regulation-22-of-solas-v/`,
which paraphrases the same limits but gives the construction date as 1988; and the MAIB annex PDF
at `assets.publishing.service.gov.uk/media/555b2a3340f0b666a2000004/AnnexestoMAIBInvReport_10_2015.pdf`,
which would not render as text. `solasv.mcga.gov.uk` no longer resolves.)

**Proposed replacement for that sentence:**

> And she may genuinely not be able to see you: the rules allow a blind sector ahead of her bow of
> up to **500 metres** — a quarter of a mile of sea in which a small yacht is simply not visible
> from the bridge — and a small fibreglass yacht is a poor radar target as well.

---

### 4. ERROR — "Every recreational craft carries a builder's plate"

**Card:** *What does the tender's plate tell you, and how do you use it?* (`src/sec_tender.py:15`)

**What it says:** "**Every** recreational craft carries a **builder's plate**, and on a tender the
two numbers that matter are the maximum number of persons and the maximum load in kilograms. The
load figure counts everything, not just people: **outboard**, fuel can, water, shopping, kit bags."

**What is actually true, in two parts:**

(a) The Recreational Craft Regulations 2017 define recreational craft as *"any watercraft of any
type, excluding personal watercraft, intended for sports and leisure purposes **of hull length from
2.5 metres to 24 metres**, regardless of the means of propulsion."* A great many yacht tenders —
2.0 m, 2.3 m, 2.4 m inflatables and prams — are **below 2.5 m and outside the Regulations
entirely**, and carry no builder's plate. The card sends a beginner to look for two numbers that
may not exist on the boat in front of them, and gives no fallback when they are not there. That is
the wrong-for-a-beginner failure: the whole loading rule collapses if the plate is missing.

(b) The plate's maximum recommended load is defined as *"(fuel, water, provisions, miscellaneous
equipment and people (in kilograms))"*, and on the plate it is stated *"excluding the weight of the
contents of the fixed tanks when full."* The **outboard** is not part of that figure — engine mass
sits in the craft's light condition, not the payload. Listing the outboard as part of the load is
conservative rather than dangerous, but it is not what the plate means.

**URLs opened:** https://www.legislation.gov.uk/uksi/2017/737/regulation/2/made (definition of
recreational craft and the 2.5–24 m range) and
https://www.legislation.gov.uk/uksi/2004/1464/schedule/1/made?view=plain (builder's plate contents
and the maximum-recommended-load wording). Regulation 4 of the 2017 Regulations
(https://www.legislation.gov.uk/uksi/2017/737/regulation/4/made) lists the excluded craft and does
not restore small tenders to scope.

**Proposed replacement (whole answer):**

> **Most** tenders carry a **builder's plate**, and the two numbers that matter are the **maximum
> number of persons** and the **maximum load in kilograms** — people, fuel, water, shopping and kit
> bags. Small tenders under 2.5 m are outside the regulations and often have no plate at all: if
> there is no plate, ask the skipper what the boat is rated for and treat freeboard as the test —
> if the side is close to the water, take somebody or something out. Either way the plate figure is
> a maximum in calm water on a good day, not a target. If it is choppy, cold, dark, or any
> distance, take less and make two trips.

---

### 5. ERROR — burgee card says the masthead is "the most senior position of all"

**Card:** *What is a burgee, and where does it fly?* (`src/sec_manners.py:27`)

**What it says:** "Traditionally at the **masthead**, which is the most senior position of all".

**What is actually true:** The RYA's flag etiquette page, verbatim: *"The most senior position for a
flag on a vessel is reserved for the **Ensign** — this is as close to the stern of the vessel as
possible."* The same page says only *"Traditionally, the burgee is flown at the main masthead"* — it
does not call the masthead senior. The deck's own ensign card two cards earlier says the ensign
"takes the most senior position on the boat", so the deck contradicts itself and the RYA in the same
section.

**URL opened:** https://www.rya.org.uk/regulations/flag-etiquette/

**Proposed replacement for that clause:**

> Traditionally at the **masthead**, the burgee's own place of honour — though the *senior*
> position on any boat belongs to the ensign at the stern. In practice the masthead is full of
> instruments and a wind vane, so most boats fly the burgee from the **starboard spreader**
> instead …

---

### 6. IMPRECISION — gale warning defined by mean force only

**Card:** *A gale warning is broadcast for the sea area you are in. What does that mean to you?*
(`src/sec_weather.py:28`)

**What it says:** "Wind of **force 8** or more is expected."

**What is actually true:** The Met Office marine glossary defines a gale as *"Winds of at least
Beaufort force 8 (34-40 knots) **or gusts reaching 43-51 knots**"*, and severe gale as *"Winds of
force 9 (41-47 knots) or gusts reaching 52-60 knots"*. A gale warning can therefore be issued on the
gust criterion alone, with a mean wind below force 8. Not misleading, but the card is a
definition card and the definition has two halves.

**URL opened:** https://weather.metoffice.gov.uk/guides/coast-and-sea/glossary

**Proposed replacement for the first sentence:**

> A mean wind of **force 8** or more, **or gusts of 43 knots or more**, is expected in that sea
> area within the forecast period.

---

### 7. IMPRECISION — colours "struck at sunset" omits the 2100 cut-off

**Card:** *When is the ensign up, and when does it come down?* (`src/sec_manners.py:24`)

**What it says:** "hoisted at 0800, or 0900 from 1 November to 14 February, **struck at sunset**."

**What is actually true:** The club sources give *"Colours are raised … in harbour from the hours of
0800 (0900 in the winter months from 1 November to 14 February inclusive). Colours are struck
(lowered) at **sunset or 2100 if earlier**."* In a British midsummer that is a difference of over an
hour, and it is the half the deck's own research file specifically told it to write in. The card is
otherwise excellently hedged ("naval and club tradition", "the RYA publishes no times at all") and
that hedge is correct behaviour — only the number is short.

**URL opened:** https://rnyc.org.uk/sailing/flag-etiquette/

**Proposed replacement for that clause:**

> hoisted at 0800, or 0900 from 1 November to 14 February, and struck at **sunset or 2100,
> whichever is earlier**.

---

### 8. IMPRECISION — liferaft-to-leeward card has the drift the wrong way round

**Card:** *Why does a liferaft go over the leeward side?* (`src/sec_emergency.py:38`)

**What it says:** "Thrown to windward, **the boat drifts down onto it**."

**What is actually true:** The conclusion is right and the practice is right — the raft goes to
leeward. The mechanism is backwards. A liferaft is all windage and no draught; it drifts downwind
faster than a keelboat does. A raft launched to windward is **blown down onto the yacht**, rather
than the yacht drifting onto it. A beginner who reasons from the card's mechanism will get the wrong
answer for a raft in any tide. Could not find a page stating this in these words; it follows from
the relative drift rates and is not contested by anything I read.

**Proposed replacement for that sentence:**

> Launched to windward it blows straight back down onto the yacht: it ends up against the topsides,
> under the hull or up on the deck — and the raft is the one thing on board you cannot afford to
> damage.

---

## Outside my remit, but flagged because it is safety-critical

**Card:** *Lifejacket or buoyancy aid: what is the difference, and what rating do you want for
cruising?* — this is one of the 62 Day Skipper pointer cards, so I did not re-litigate it and did
not verify it against a standards page. But reading it cold: it lists **"a buoyancy aid — 50 N
inshore, 100 N sheltered water with prompt rescue at hand"**. Under EN ISO 12402, **100 N is a
lifejacket level, not a buoyancy aid**, and "help close at hand" is the descriptor attached to
**50 N**, not 100 N. If that is wrong it is wrong in the Day Skipper deck too, and it is the sort of
error the brief ranks first. Worth one person opening the ISO 12402 levels and checking, at Day
Skipper level rather than here.

---

## Checked and found correct

**Man overboard and cold water (beyond finding 1).** "MAN OVERBOARD" as the shout; the pointer doing
nothing else; throwing everything that floats immediately; the MOB button marking position and time
and anyone pressing it; back to the waves, lean back, float, then HELP position; do not swim after
the boat; nobody enters the water; boarding ladder and pre-tied bowline; clip on before going to the
rail. The float duration is given as "roughly a minute"; the RYA (citing the RNLI) says *"float for
around 60 to 90 seconds"* — I would write 60–90 seconds, but "roughly a minute" is not wrong.
"A strong swimming ability will have no impact on your body's involuntary response to cold water
shock" is the RYA's own wording and the deck's "being a strong swimmer barely helps" matches it.
Opened: https://www.rya.org.uk/on-water-safety/cold-water-shock-safety/cold-water-shock/

**Kill cord (all three cards).** Coiled red lanyard; engine stops if the driver is displaced; worn
round the leg/thigh clipped back on itself; jet ski to the buoyancy-aid webbing; never wrist, never
console, never clothing; test at the start of each day by starting the engine and pulling the cord;
attached before the engine starts and certainly before going into gear; **stop the engine to change
driver**; spare cord aboard in a known place. The Camel Estuary account checks out: *"5 May 2013"*,
*"Camel Estuary, off Padstow"*, six ejected, two killed and two seriously injured, and the MAIB's
instructions *"always attach the cord securely to the driver, ideally before the engine is started"*
and *"stop the engine before transferring the kill cord to another driver."* The MAIB bulletin page
does not itself state that nobody was wearing the cord or that the boat circled — those come from the
fuller report and from MBY, so the deck's "the boat circled back into them" is the widely reported
account rather than a quote from the page I opened.
Opened: https://www.gov.uk/maib-reports/safety-warning-issued-after-the-ejection-of-family-of-6-from-rigid-inflatable-boat-in-the-camel-estuary-cornwall-england-results-in-2-people-seriously-injured-and-loss-of-2-lives

**Flares.** Red parachute for over-the-horizon at night burning about 40 seconds; red hand flare to
pinpoint for a close rescuer; orange smoke by day for aircraft; white flare not a distress signal.
Hand flare held at arm's length over the side on the downwind/leeward side, gloves on, don't look at
it, hot slag drips. Parachute rocket: back to the wind, near vertical, about 15° downwind in strong
wind, never near the rig or the raft, use a hand flare under low cloud. All consistent with the
manufacturer/instructor guidance: *"Hold the launcher downwind at an angle (around 15-45 degrees
from vertical, check instructions)"*, altitude ~300 m, burn ~40–60 s under parachute; hand flare
*"downwind, outboard, and tilted away from your body"*.
Opened: https://www.safe-skipper.com/distress-flares-flare-use/
(The Pains Wessex Mk8A datasheet PDF at painswessex.com would not render as text; its figures are
therefore corroborated only through Safe Skipper and search extraction.)

**Distress signal with no equipment.** "Slowly raise and lower both outstretched arms at your sides"
is the IRPCS Annex IV signal, correctly described.

**Q flag.** Hoist on entering UK waters at the **12-mile limit**, keep it up until reporting is
finished, penalty for non-compliance, don't go ashore before clearance. gov.uk, verbatim:
*"For journeys that you must report, you must fly the yellow 'Q' flag as soon as you enter UK waters
(the 12-mile limit)"*, *"do not take it down until you've finished reporting to customs
authorities"*, *"If you do not comply you will be liable to a penalty."* Page last updated 20 July
2026. Permission *"must be received … before disembarking your vessel."*
Opened: https://www.gov.uk/guidance/sailing-a-pleasure-craft-that-is-arriving-in-the-uk

**Ensign and courtesy flag (apart from findings 5 and 7).** Ensign shows country of registry, takes
the most senior position as near the stern as possible, is *worn* not flown, Red Ensign for UK boats,
blue/defaced only under warrant. Courtesy flag at the starboard spreaders, nothing above it on that
halyard, **no legal requirement** to fly one, Red Ensign is the courtesy flag for visitors to any
part of the UK. Burgee moves to the port spreader when a courtesy flag takes starboard; one burgee at
a time; special ensign and its burgee go together.
Opened: https://www.rya.org.uk/regulations/flag-etiquette/ and https://rnyc.org.uk/sailing/flag-etiquette/

**Heads and holding tanks.** Never on UK inland waterways (*"Sewage discharge is prohibited by law on
inland waterways in the UK"*); avoid marinas and poor tidal flushing and shellfish beds; *"Try to
discharge more than 3 miles off the coastline"*; and the deck's explicit statement that the 3-mile
figure is **best practice, not UK law** is correct and is exactly the right hedge.
Opened: https://thegreenblue.org.uk/you-and-your-boat/info-and-advice/water-pollution-prevention/blackwater-disposal-and-pump-out-locations/

**Cleating a warp.** "A full turn round the base of the cleat first, taken to the **far** horn" is
right and matches Animated Knots: *"Initially the rope must be led round the most distant horn of the
cleat followed by a turn in the same direction round the other horn. Starting round the wrong horn
increases the risk of a Cleat Hitch jamming."* Note the near-collision of terminology: Animated
Knots warns against a "complete round turn", but by that it means going round the base a **second**
time — *"Jamming is a risk if the initial turn continues around and under the first horn a second
time"* — not against the single turn the deck describes. The deck's "three or four" figure-of-eights
in modern line is consistent with *"two crossovers is the bare minimum, and only for temporary use in
sheltered conditions. In all other situations, always add more."*
Opened: https://www.animatedknots.com/cleat-hitch-knot-dock-line

**The locking hitch card.** Correctly refuses to resolve a live disagreement, and the two sides it
gives match the source: *"Large vessels and towing situations should never add a final Half Hitch"*
while *"in other situations a Cleat Hitch is commonly completed with a locking hitch, e.g., the dock
lines for a yacht left in a harbor for long periods."* This is the hedge working as intended — not a
finding.

**Winch direction, hands, self-tailer, riding turns** (apart from finding 2). Clockwise on every
winch; hands flat on top of the turns, never wrapped, never at the nip; out of the self-tailing jaw
before easing under load; riding turn cleared with a rolling hitch to a second winch; slack pulled in
before loading. All matches Safe Skipper and the deck's own research on the rolling hitch.

**Dipping the eye, bollards, slipped lines, throwing a line, chafe, never inside a bight.** All
consistent with the research file and with ordinary practice; nothing contradicted by anything I
opened.

**Fire section.** Fire triangle; LPG heavier than air so it collects in the bilge; nothing electrical
touched on smelling gas including the bilge pump; gas off at the bottle first and burn the hose
empty; fire blanket and never water on burning fat; kill the power before a dry powder extinguisher
on an electrical fire; do not open the engine box; smoking on deck and to leeward; and the crew's
order on finding a fire (shout, lifejackets, everyone on deck and upwind, pass the extinguisher up,
count heads, skipper decides whether to fight it). That order is standard RYA crew teaching and I
found nothing contradicting it.

**Personal safety equipment.** No general UK statute requiring lifejackets on a private boat — the
binding thing is the skipper's rule, and charter companies and some countries do require them.
Crotch strap; pre-sail check list; automatic versus manual and both having a toggle and an oral tube;
tether to a jackstay or a dedicated strongpoint and never to a guardrail or stanchion; two hooks so
you are never unclipped while moving; short leg on the foredeck.

**Lookout section** (apart from finding 3). Rule 5's "sight and hearing … all available means";
scanning astern and under the foot of the genoa; the constant-bearing test against a shroud with the
head held still, and forward-of-the-shroud = passes ahead, aft = passes astern, unchanged and growing
= risk of collision; report it even if unsure; clock bearings running round the boat with twelve
ahead; report what you see, not what you conclude; report again especially when nothing has changed.
All matches the deck's own sourced research on IRPCS Rules 5 and 7(d).

**Tender section** (apart from finding 4). Freeboard as the margin and swamping as the failure mode;
hard dinghy worse than an inflatable; weight low and central; bags on the floor not on your back; one
person at a time, step into the middle never the tube, hold something above your waist, shoulder not
a hand; painter made fast before anybody gets in, kept short and inboard, shortened before going
astern; lifejacket every time including the short row ashore and the manual-inflation nuance in a wet
dinghy; rowing facing aft, rowlocks secured, look over your shoulder, pull one and push the other to
spin; aim up-tide and judge against a transit ashore; oars carried even with an outboard; torch,
bailer, spare kill cord, means of calling for help, fuel checked; tell someone where you are going.

**Meteorology.** Forecast sources (Shipping Forecast, Inshore Waters, VHF from the coastguard,
Navtex, apps, the office wall); forecast checked before departure and again under way, written down
verbatim; "northerly" means from the north; reading force off the sea by white horses, spray, streaks
and spindrift. The sea-state descriptions match the Beaufort observational criteria in the Met Office
glossary I opened.

**Seasickness.** Sensory conflict; what makes it worse; horizon, helm, small food often, sips of
water, tablets **before** you sail and tried ashore first; dehydration as the real danger and
rehydration salts; clipped on, on deck, sitting down, to leeward, not left alone; below is the worst
place.

**Helmsmanship.** Points of sail; ~45° close-hauled and a ~90° no-go zone; ease until the luff lifts
then pull in until it stops; telltales — windward one lifting means bear away, leeward one means come
up; luffing versus flogging; tiller away from the turn and a wheel like a car; small corrections; the
wake as feedback; read the course number back; steer to a mark and check the compass; nothing metal
by the compass; steering under power with no sail to balance her and no steerage in neutral; keeping
the stern square running; warning the foredeck crew before anything changes.

**General duties.** What may go down the heads and the pump-through drill; seacocks left as the
skipper set them; gimballed cooker and one hand for the kettle; stowage below; deck clear before a job
is finished; bilge checked and *reported before pumping*, salt versus fresh; washboards in; the night
watch and what gets the skipper woken; the handover; the log written in ink at the time and not
rounded; fenders and warps rigged early, outside the guardrails; lines in the water before starting
the engine; cooling water at the exhaust.

---

## Could not verify either way

1. **"The boat circled back through them" at the Camel Estuary.** The MAIB safety bulletin page I
   opened does not say the boat circled, and does not say nobody was wearing the kill cord. Both are
   in the fuller MAIB report and in MBY's coverage, which I did not open. The claim is very likely
   right; it is not sourced to a page I read.
2. **RNLI anything.** `rnli.org` 403s to automated fetching, confirmed again this session on
   `https://rnli.org/safety/float`. The float-to-live guidance in this deck is verified only through
   the RYA's page, which quotes it.
3. **The Pains Wessex Para Red Rocket Mk8A datasheet.** The PDF at painswessex.com returned binary
   that would not render. The 40-second burn and the 15°-downwind instruction are corroborated by
   Safe Skipper and by search extraction of the datasheet, not by the datasheet itself.
4. **The SOLAS V/22 text as enacted.** I could only read it through third-party reproductions
   (marinegyaan, navsregs), which disagree on the construction date (1998 vs 1988). The 500 m /
   two-ship-lengths cap is identical across both and across the MAIB annex's table of contents. The
   old MCA site `solasv.mcga.gov.uk` no longer resolves.
5. **Whether the outboard's mass is inside or outside the plate's maximum recommended load.** The
   regulation lists *"fuel, water, provisions, miscellaneous equipment and people"* and excludes
   full fixed tanks; it does not say where an outboard sits. My reading is that engine mass is in the
   light condition, but "miscellaneous equipment" is arguably elastic enough to cover a portable
   outboard. Treat finding 4(b) as the weaker half of that finding.
6. **The fire card's ordering (lifejackets before the extinguisher).** I found nothing contradicting
   it and nothing stating it in those words. It is standard instructor teaching; I could not put a
   page behind it.
7. **"Force 9 strong gale versus severe gale."** The Met Office glossary I opened names force 9
   *"Severe Gale"*; the Beaufort cards that hedge this are Day Skipper pointers and were not in
   scope, but the hedge as written ("which is the name on the Beaufort scale, though gale warnings
   and the shipping forecast call it severe gale 9") is consistent with what I read.
