# Cold read — RYA Competent Crew deck

Read: `build/STUDY-GUIDE.md`, front to back, before anything else in the project. 202 items, 14 sections. No other project file was opened first.

Reader I read it as: never been on a yacht, five-day course booked, revising on a phone.

**Headline.** The writing is better than most instructional material. Sections 03 (ropework, back half), 04, 06, 09, 10, 12 and 14 are genuinely well-pitched at a first-timer and I would not touch them. The deck's problem is not quality, it is that it teaches vocabulary it never anchors to objects, and that a Day Skipper layer sits on top of it in four identifiable places.

---

## 1. Assumed knowledge

### MUST FIX

**The deck never says what a boom, a mast or a winch is.** Section 01 is titled "Sea terms, **parts of the boat**, rigging and sails" and it teaches directions, spaces and sail vocabulary — but there is no card you can point at a boat with. Counts in the built file:

- `boom` — 23 uses, first at line 97 ("the leeward side is the boom's side"), never defined
- `mast` — 19 uses, first at line 38 ("the deck forward of the mast"), never defined
- `winch` — 27 uses, first at line 193, never defined; the reader meets it as "lead both sheets outside the shrouds through the fairleads to the winches"
- `rudder` — 3 uses, first at line 1011, never defined
- `block` — 4 uses, first at line 319, never defined
- `shroud` / `spreader` — appear only inside the standing-rigging list (line 145), then load-bearing at line 520 ("never to a shroud"), line 684 ("starboard spreader"), line 818 ("hold the shrouds")

This is the most valuable thing in this report. The reader can recite that a halyard hoists and a sheet trims, and still not know which object either is attached to. **Fix:** one card early in 01 — "Point at these: mast, boom, mainsail, headsail, keel, rudder, tiller or wheel, winch, block." Three lines, no theory. The keel already gets a proper introduction in "Why does a yacht not tip over when she heels?" (line 79) — do the same for the rest.

**Three cards in 01 use terms that 01 defines later.**

- Line 19, **"Amidships"** — "both fore-and-aft and athwartships". Both terms are defined in the *next* card (line 26).
- Line 24, **"Beam (two meanings)"** — "at right angles to the fore-and-aft line". Same problem.
- Line 109, **"on the wind"** — "sheets hard in". `sheet` is defined at line 155, four cards later.

**Fix:** move the "Forward, aft, fore-and-aft, athwartships" card to position 2, immediately after bow/stern/port/starboard. Move "Halyard versus sheet" ahead of every card that uses either word.

**"Bulkhead" is defined in jargon** (line 56): "a transverse structural partition." *Transverse* has not been introduced (*athwartships* has, and is not the same register). **Fix:** "a wall running across the boat — it holds the hull's shape and divides it into cabins."

**"Heave to" appears once, unexplained** (line 227, slab reefing: "Head up or heave to"). It is a whole manoeuvre, one word, no gloss, and it never appears again. **Fix:** cut it from that card, or one clause: "or heave to — park the boat by backing the headsail; the skipper will do this."

**"Cringle" appears twice, both inside the reefing procedure** (lines 231, 244) and is never defined. The reader is being told to "hook or pull down the luff cringle at the tack" having never seen a reinforced eye in a sail.

**"Gooseneck" appears once** (line 182) inside the very first card of section 02. First card of a new section, brand-new part name, no gloss.

**"Watch" is used 11 times and never explained.** Line 1107 says "what the wind and the weather have done in **your two hours**" — the reader does not know they will be split into watches, that a watch is a shift, that they will be woken in the dark, or that the boat runs day and night. See gap 4.2.

**"Call her the moment you spot her"** (line 803, big ship in a channel) assumes the reader can operate a VHF radio. `VHF` appears twice in the whole deck, both as a grab-bag / forecast item. `Mayday` appears zero times. See gap 4.1.

### WOULD IMPROVE

- Line 15 — "**Port** = the left side facing forward (**red**)". The colours arrive with no explanation and are never picked up. One clause: "red and green are the boat's night lights and the sides of a channel."
- Line 796 — "'Fishing boat on the port **quarter**'". *Quarter* is the one sector word 01 does not teach; the direction cards give ahead/astern/abeam/abaft but not bow/beam/quarter as the three sectors.
- Line 407 — "Braided rope prefers a **figure-of-eight flake**"; line 292 — "**flake** the sail from side to side". Two different senses of *flake*, neither defined.
- Line 701, 720, 403 — `toerail`, and `guardwires` (720, 729) where 01 taught `guardrails`. Pick one word.
- Line 165 — "A **jib**'s clew does not reach past the mast." Correct, but a beginner reads this as geometry homework. "The headsail is the sail in front of the mast; a genoa is the big one that overlaps it" is the crew version.

---

## 2. Pitched too high — the Day Skipper layer

Four clusters read as if written for someone with a theory certificate.

### MUST FIX

**2a. Section 05, "Lifejacket or buoyancy aid" (line 484).** "150 N for coastal and offshore use, 275 N for extreme conditions... 50 N inshore, 100 N sheltered water with prompt rescue at hand... preferably an AIS beacon or PLB." This is a card about *buying* a lifejacket. The Competent Crew reader is handed one on day one. The distinction that matters — a lifejacket turns an unconscious person face-up, a buoyancy aid does not — is buried in a newton table. **Fix:** keep the face-up distinction and "cruising wants 150N with a crotch strap"; drop the four-value matrix and the AIS beacon.

**2b. Section 08, flag etiquette — five cards, roughly 1,000 words** (ensign line 670, colours 676, burgee 682, courtesy flag 687, Q flag 693). Content includes defaced ensigns and warrants, colours struck at sunset with the 1 November–14 February variation, "one burgee at a time", the 12-mile limit and the penalty for getting Q wrong. None of this is assessed on a Competent Crew course and none of it is the crew's job — the Q flag one is the skipper's legal duty. That is 5 of 202 cards, in the longest prose in the deck, on the least load-bearing topic. **Fix:** collapse to two — "the ensign goes at the stern and comes down at night" and "the courtesy flag and the Q flag both go on the starboard spreader; the skipper says when."

**2c. Section 02, "How do you bend a mainsail on?" (line 182) and "How do you rig a headsail correctly?" (line 190).** These are the second and third cards the reader meets after section 01. Between them they use gooseneck, boom groove, outhaul, luff slides, bolt rope, mast track, spreaders, hank on, foil, fairleads, shrouds and stopper knots — twelve unexplained nouns in nine lines, placed at card 33 of 202. The syllabus does cover bending on sails, but as an assisted task. **Fix:** reframe both as "what you'll be handed and what you'll be asked to do" rather than a procedure to reproduce from memory, and move them later in the section, after the winch cards.

**2d. Section 13, "What is weather helm and lee helm?" (line 1006).** "You hold the **tiller to windward** (wheel to leeward)... usually means too much headsail or too little main." This is a Day Skipper theory answer, and it is immediately followed by "The tiller is pulling hard against your hand. What is the boat telling you?" (line 1010) which says the same thing in crew language, better, and tells the reader what to *do*. **Fix:** cut the weather/lee helm card, fold the phrase "that pull is called weather helm" into the card that follows.

### WOULD IMPROVE

- Line 211, "**How much halyard tension does the mainsail want?**" — "Hard vertical wrinkles up the luff mean you have over-tightened it." Sail trim. The card even ends "Set it, then ask the skipper to look," which concedes the point.
- Line 226, slab reefing — a ten-step procedure. A Competent Crew member assists with a reef; they do not run one. Keep the card (the reader will be pulling on one of these lines) but cut it to the three things they will personally be asked to do.
- Line 251, **preventer** — "Rig it whenever you are running or on a broad reach." Uses points of sail, which are not taught until section 13, and rigging a preventer is a decision, not a crew task.
- Line 99, **weather shore / lee shore** — anchorage selection. Pure pilotage.
- Line 65/69, **draught / air draught** — bridge clearance and depth planning are the skipper's numbers. *Freeboard* is the one of the three that earns its place, and it gets re-defined in the tender card anyway (line 814).
- Section 03 teaches eight knots including **rolling hitch** and **double sheet bend**. The syllabus wants four or five. Harmless, but it is where the extra knots came from.
- Line 418, **"How do you rig for a lock?"** — canal and inland work. Very few Competent Crew courses go through a lock.
- Section 07 gives flares **five cards** (595–616) for a crew member whose entire job is "fire one when the skipper says to". The hot-slag card (line 610) is excellent and earns its place; the "how do you fire each type" card (606) is skipper detail.

### NOTICED BUT FINE

- "Why lift a MOB casualty horizontally?" (line 588) reads advanced but is load-bearing — it stops the crew hauling someone up by the armpits.
- "Why does a sail pull the boat along, even going upwind?" (line 986) is theory, but it is the question every first-timer actually asks, and the answer is three plain sentences.

---

## 3. Pitched too low, padded, or restating itself

### MUST FIX

**The Beaufort scale is split across four cards** (lines 875, 884, 892, 900) — forces 0–3, then 4/6/8, then 5/7/9, then 10–12 — each carrying the same diagram. That is 4 of the section's 9 cards, and it is one table cut into quarters to make a section look bigger. Worse, it is the wrong information: the reader does not need "force 11 violent storm, 56–63 kn". They need to know that force 4 is a nice sailing day, force 6 means reefed and uncomfortable, force 8 is a gale and the boat stays in. **Fix:** one card for the scale 0–12 with names and speeds, one card for "what each force means for your day". The card that already does this well — "How do you read it off the sea?" (line 928), white horses / spray / streaks / spindrift — is the model.

**The same diagram is inserted three times inside one section.** `media/ds-knots-ropes.png` appears at lines 321, 335 and 372. `media/ds-beaufort.png` appears five times. `media/ds-points-of-sail.png` three times. Twelve image tags, four unique images.

**And every one of them is broken.** There is no `build/media/` directory and no `.png` anywhere in the project tree. All twelve references resolve to nothing. The reader sees twelve broken-image icons.

### WOULD IMPROVE

- Line 85, "**The three rotational motions of a boat at sea**" — roll, pitch, yaw. `yaw` is used nowhere else in the deck and the card carries no consequence. Either cut it or make it earn its place by tying to the thing the reader cares about: the motion is worst at the ends of the boat and that is why the forepeak is where you get sick.
- Line 32, "**Ahead, astern, abeam, abaft, forward of the beam**" — five terms, and *abaft the beam* / *forward of the beam* are sector names a crew member uses once a week at most. Overlaps the beam card directly above it.
- Line 311, "the extreme end is the **tail**; strictly, the **bitter end** means the inboard end of the anchor cable, made fast at the bitts" — trivia, flagged as trivia by its own "strictly".
- Line 363, "**Do you finish a cleat with a locking hitch?**" — the writing is good but the answer is a 100-word essay ending in "it depends, ask, and here is what the British and North Americans each do." That is unlearnable as a flashcard. Cut to: "Ask. Normal on a mooring warp that will sit for a week; wrong on anything you may need to release under load."
- **"Ask the skipper" is the whole answer in at least ten cards** (lines 365, 622 area, 737, 751, 914, 922, 822, 488, 697, 1064). Each one is individually right. Cumulatively the deck teaches the reader that the answer is always "someone else decides", which is not what a flashcard is for. Where it appears, it should be the *last* line, not the substance.

### NOTICED BUT FINE

- The one-word prompt cards ("Amidships", "Draught", "Freeboard", "Riding turn", "Topping lift") are terse next to the essay cards, but as a phone-revision format that mix is fine and probably good.

---

## 4. What is missing before day one

Ordered by how much it would have helped me.

### MUST FIX

**4.1 — VHF and how to call for help.** `VHF` appears twice, both incidentally. `Mayday` appears zero times. `Channel 16` appears nowhere. Yet line 646 tells the reader to "send a distress alert first", line 803 tells them to "call her the moment you spot her", and line 864 puts a handheld radio in the tender. The reader is being told to use a radio the deck has never mentioned. A crew member can and will be told "get on the radio". **Add one card:** what the VHF is, that channel 16 is the distress and calling channel, that "Mayday Mayday Mayday" means life in danger and "Pan-Pan" means urgent but not life-threatening, and the four things to say — who you are, where you are, what is wrong, how many on board.

**4.2 — What a day actually looks like: watches, sleep, meals.** The deck asks "You are on watch at night while the skipper sleeps" (line 1092) and "Your watch is over. What do you hand over?" (line 1103) without ever telling the reader that there *are* watches. Nobody has explained that they will be woken at 0300, that "your two hours" means a shift, where they will sleep, or who cooks. This is the single biggest source of pre-course anxiety and the deck does not touch it. **Add:** "What is a watch system, and what does a day on board look like?"

**4.3 — What to pack and what to wear.** "Why is staying warm and dry a safety matter rather than a comfort one?" (line 539) is one of the best cards in the deck, and it ends at "Layers and waterproofs go on before you need them... and wear a hat." It never says *what*. The reader is packing tonight. **Add:** a kit card — soft bag not a suitcase, base layer plus fleece plus waterproofs, no jeans, no cotton, boots or deck shoes with a real sole, hat and gloves, sunglasses on a cord, a full second dry set, everything in a drybag, seasickness tablets bought before you travel.

**4.4 — How to move about the boat and where to sit.** Your brief names "not knowing where to put their hands" and the deck answers only half of it. "One hand for yourself" (line 530) and the hands-and-feet card (line 534) are excellent as far as they go. What is missing: sit to windward not to leeward; do not sit under the boom or on the mainsheet; move along the windward sidedeck; hold the shrouds and the coachroof handrails, not the guardrails and not a stanchion; stay out of the cockpit sole where the ropes are; crouch, do not walk upright. Line 818 already says "hold something above your waist: the shrouds, not a stanchion" — in the *tender* card. That principle belongs on deck.

**4.5 — What to do when you do not understand, and being shouted at.** Nothing anywhere in 202 cards tells the reader that shouting on a boat is volume against wind, not anger; that "say again" is the correct response and guessing is not; that "I can't reach it" said now is worth more than a failure in thirty seconds; or that "I don't understand" is an acceptable sentence. This is the fear your brief names and the deck is silent on it. **Add one card.** It may be the most reassuring card in the deck.

### WOULD IMPROVE

**4.6 — Peeing over the side.** The heads cards (1056, 1060) are very good on plumbing and say nothing about the human problem: go before it gets rough, tell somebody you are going below, and never pee over the side — it is a recognisable pattern in man-overboard fatalities. The deck has a whole MOB section and does not mention the commonest way a man ends up in the water at night.

**4.7 — The day-one boat tour.** Four separate cards tell the reader to "find yours on day one" (seacocks line 93, extinguishers 460, flares 604, lifejacket 515). There is no card that collects them. **Add:** "What do you find and touch before you leave the pontoon?" — heads and sink seacocks, extinguishers and blanket, flares, liferaft, bilge pump handle, engine stop, main switch, VHF, first aid kit, where your lifejacket lives.

**4.8 — What the instructor is assessing.** No card explains what Competent Crew certifies, that it is continuous assessment, that there is no exam (the intro says so, no card does), or that the instructor is watching for willingness and safety awareness rather than technique. A reader who knows they are not being marked on knots relaxes.

**4.9 — Being frightened, and heeling.** "Why does a yacht not tip over when she heels?" (line 77) is the right card and it is well done. Nothing follows it: what the noise is, why the boat bangs, that everything sounds worse below, that it is normal to be scared on the first afternoon.

### NOTICED BUT FINE

- Seasickness (3 cards) fully answers "being sick" and I would not add to it.
- Needing the toilet is answered mechanically and well.
- Being cold is answered as a *safety* argument, which is the right frame.

---

## 5. Contradictions and overlaps

### MUST FIX — cards that would leave you unsure which one you got wrong

- **"Northerly" is asked twice, near-identically.** Line 103 "The forecast says 'northerly'. Where is the wind coming from?" and line 924 "A **northerly** wind — which way is it blowing?" Same question, same answer, sections 01 and 11. Cut one.
- **"Bowline — use" (line 331) already contains its own duplicate.** It says "Used to attach a sheet to a clew" — and line 349 is "Which knot for a jib sheet to the clew of a headsail? A bowline." Two cards, one fact.
- **"Rolling hitch — use" (line 327)** says "the standard fix for a riding turn on a winch" — and line 353 is "Which knot takes the load off a jammed, loaded sheet? A rolling hitch." Same pair problem. And line 271 ("Riding turn") gives the rolling-hitch fix a *third* time.
- **"Riding turn" (line 269) and "What causes a riding turn?" (line 273)** are adjacent and the second contains the first.
- **Tethers and jackstays get four cards.** Line 58 (01, jackstay in the pulpit/pushpit card), line 517 "Where may you clip a tether", line 522 "What is a jackstay and how should a tether be used", line 526 "Why does a tether have two hooks". 522 restates 58's definition and 517's rule. Merge 517 and 522.
- **"Ease" is defined twice.** Line 173 ("Ease — let rope out, slowly and still under your control") and line 283 ("Ease — let rope out slowly with the turns still on the winch"). Near-identical wording, two sections.
- **Sail-shape correction is taught three times in section 13.** Line 992 "ease until the luff just lifts, then pull in until it stops"; line 996 telltales, "steer to the windward one"; line 1000 luffing, "bear away, or pull the sheet in". Three cards, one behaviour, and the reader cannot tell which one a question is aiming at.

### Word collisions

- **"Painter" means two different objects and neither card knows about the other.** Line 659: "The painter is the long line out of the **liferaft**." Line 828: "The **painter** is the tender's bow line." Both correct; a reader meeting them 170 lines apart will think one is wrong. **Fix:** one clause — "painter is the general word for a small boat's bow line; the liferaft has one too."
- **Freeboard defined twice** — line 73 ("waterline to the deck edge") and line 814 ("the height of the side above the water"). Compatible, but the second re-teaches as if new.
- **Snub defined twice** — line 309 and line 380.
- **"Never put a hand through a coil"** — line 387 and line 396, adjacent cards.
- **Gas off at the bottle** — line 444 (precise: burn the hose empty) and line 1073 (imprecise: "off at the bottle when you are finished"). Not contradictory, but 14 loses the reason 04 gave.
- **Manual vs automatic lifejacket** — line 513 is neutral; line 826 recommends manual in a tender. Correct, but worth a cross-reference so it does not read as a reversal.

### Overlaps I would leave alone

- Furling out / furling in (215, 217) mirror each other on purpose and both are concrete.
- Reefing in / shaking out (225, 238) — same.
- Kill cord ×3 (840, 844, 850) is one more than needed, but the Camel Estuary detail earns its card.

### No true contradictions found

I looked for them specifically. Winch turns (three before load, fourth after) is consistent across lines 255, 263 and 275. Bilge pump advice is consistent between the gas card (442) and the bilge check (1086). Nothing in the deck tells the reader two opposite things.

---

## 6. Voice

**What works.** It reads as one person, and that person is worth listening to. Short declaratives, second person, concrete objects, no "it is important to note", no "in this section we will", no hedging throat-clears. "A genoa sheet in a gust does not stop for a finger" (267). "It does not blow away. It sits there and waits for a spark" (438). "Because the inflated jacket floats and you do not" (501). "Judgement goes first, then balance, then any interest in their own safety" (963). This is not generated-sounding prose. Do not sand it down.

### MUST FIX

**The epigrammatic last line is the deck's one real tell.** A large share of cards close on an aphorism, and by card 60 you can feel the shape coming before you read it:

- "nothing about a bad lead improves by pulling harder" (392)
- "Nobody jumps with a rope in their hand" (388)
- "a jam has to be picked out at the moment you least have time" (365)
- "the gel coat is cheaper than a hand" (1133)
- "Rudder is a brake as much as a steering wheel" (1019)
- "No skipper minds being woken; every skipper minds being woken too late" (1101)
- "A lookout who sees a ship and says nothing has not kept a lookout" (775)
- "Pumping it dry and saying nothing hides the one thing the skipper needs to know" (1086)

Every one of these is *good*. The problem is that there are forty of them and the rhythm is identical: statement, then inverted or antithetical closer. That regularity is what reads as machine-made, not any individual sentence. **Fix:** strip the closer from roughly a third of the cards — the ones where the body already made the point — and let those cards just stop.

### WOULD IMPROVE

- **Three separate cards tell the reader they are the beginner making the classic mistake.** "the classic beginner's throw puts the whole rope in the water" (384); "rowing into a moored yacht because nobody turned round is the standard beginner's arrival" (834); "This is the beginner mistake, and it happens hardest when something is going wrong" (1015). Each is fine alone. Together they talk down. Keep one, rephrase the others as the thing to do rather than the thing beginners get wrong.
- **Appended clauses that add nothing.** "which is the entire point of it" (746); "which is the reassurance she is waiting for" (722); "which is the opposite of what easing needs" (263) — the last is actually good; the first two are rhythm-filler.
- "Do it up every time, however much it annoys you" (501) — mild nannying on an otherwise excellent card.
- Boat gender is inconsistent — mostly "she", but "the boat" elsewhere in the same card, and line 30's "Athwartships means across **her**" is jarring in a definitional card.

### Formatting artefacts that make it read as generated

- **The standing/running rigging card is broken** (lines 143–153). It renders as: "Standing rigging is fixed and holds the mast up: forestay, / backstay, / shrouds, / spreaders, / **chainplates. Running rigging** moves and controls the sails: halyards, / sheets, / ..." A comma-list has been exploded onto separate lines by a list-splitting rule, and the second sentence has been glued onto the last item. **Must fix.**
- The same split, less harmfully, on lines 755–760 (wash and speed) and 764–767 (wildlife), where single sentences are broken into pseudo-bullets.
- **Raw HTML in markdown, inconsistently.** `<i>or off</i>` (442), `<b>Q</b>` (693), `<b>gale warning</b>` (920), `<b>northerly</b>` (924) — everywhere else uses `**`.
- **HTML entities mixed with literal characters.** `&mdash;` and `&deg;` in some cards, literal `—` in others, sometimes within a few lines of each other (compare lines 54 and 63). Fine in a rendered card, ugly if anyone reads the markdown.
- **The image filenames leak the Day Skipper provenance into the shipped artefact** — `ds-points-of-sail.png`, `ds-beaufort.png`, `ds-mob.png`, `ds-knots-ropes.png`, and the alt text says `cc-seaterms diagram` against a `ds-` file. Cosmetic, but it is the one place the reader can see where the deck came from.

### Question–answer mismatch

- Line 626: "**What goes in a grab bag? Name eight items.**" The answer lists **fifteen**. A card that asks for a number and answers with a different number is unusable for self-testing. **Must fix:** either ask "what goes in a grab bag" or cut the list to eight.

---

## 7. Order

### Is section 01 a sane place to start?

Yes in principle — you cannot do anything until you can name things — but it is the section that most needs re-sequencing, and it is doing two jobs at once. Roughly two-thirds of it (directions, spaces, wind vocabulary) is what a first-timer needs on the train. The other third (standing vs running rigging with chainplates and cunningham, draught and air draught, the three rotational motions, abaft the beam) is reference material that could sit at the back.

Specific ordering faults inside 01, in the order they hurt:

1. `athwartships` and `fore-and-aft` are used two cards before they are defined (19, 24 vs 26).
2. `sheet` is used at line 109, defined at line 155.
3. No card introduces the physical objects — see §1.
4. **The points-of-sail diagram is placed in section 01** (line 126, after the tacking-commands card) while points of sail are not taught until section 13, card 171 of 202. The diagram is meaningless where it sits.

### Front to back — could I follow it?

Not comfortably, and the reason is one decision. **The steepest material in the deck is at position 33.** Section 02 opens with "How do you bend a mainsail on?" — twelve unexplained parts — immediately after a vocabulary section that never showed the reader a mast. If a phone reviser bounces off this deck, they bounce here.

Meanwhile **section 14 "General duties" is where almost all the day-one survival content lives** — the heads, stowing, hot drinks, washboards, watches, the bilge, fenders and warps — and it is last. A reader working front to back on the commute reaches it on the morning of the course, or never.

**Recommended resequence** (the deck currently follows G158's syllabus order, which is a defensible reason to keep it — but the cost is real):

1. **01 Sea terms**, with the "point at these" card added and the internal order fixed
2. **A new "your first day"** — or move 14 here: watches, heads, stowing, kit, moving about, what happens when you don't understand
3. **05 Personal safety** — lifejackets, tethers, hands and feet, staying warm; before anything asks you to touch a rope
4. **03 Ropework** — with the winch cards from 02 pulled in alongside
5. **02 Sail handling**
6. **13 Helmsmanship** — and move points of sail (and its diagram) here or up to 01, but not both
7. Then 04, 06, 07, 09, 10, 11, 12, 08

If the syllabus order must stand, the minimum change is: move the winch cluster (lines 253–279) to the front of 02 ahead of bending on sails, and add the "point at these" card to 01.

### Section sizes

| § | Cards | Read |
|---|---|---|
| 01 Sea terms | 32 | Largest; a third could move to a reference tail |
| 02 Sail handling | 21 | Front half too advanced, winch cluster excellent |
| 03 Ropework | 26 | Best section; three duplicate diagrams, two duplicate pairs |
| 04 Fire | 11 | Right size, right pitch, no changes |
| 05 Personal safety | 12 | Good, minus the newton table; tether cards over-count |
| 06 MOB | 10 | Excellent throughout |
| 07 Emergency equipment | 12 | Five flare cards, no VHF card — wrong balance |
| 08 Manners | 15 | Five flag cards is the deck's biggest misallocation |
| 09 Rules of the road | 5 | Best-targeted section in the deck — see note below |
| 10 Tender | 13 | Very strong; one card of kill-cord overlap |
| 11 Meteorology | 9 | Four of nine are one Beaufort table quartered |
| 12 Seasickness | 3 | Perfect. Do not touch. |
| 13 Helmsmanship | 18 | Strong, minus weather helm and one trim card |
| 14 General duties | 15 | Excellent content, wrong position |

**One note on section 09, within your "do not expand" instruction.** All five cards are well-pitched crew cards and I would keep every one. But the section is called "Rules of the road" and contains no rule — and there is one that is load-bearing for a beginner on day one: **another yacht will shout "STARBOARD!" at you and the reader will not know what it means or what happens next.** One card — "what does 'starboard!' mean, and what will the skipper do?" — covering starboard tack has right of way, power gives way to sail except a ship in a channel, and if in doubt tell the skipper. That is the specific, load-bearing gap; I am not asking for a sixth through to a twelfth card.

Meteorology and Seasickness I would leave at their current size. The only meteorology gap that is load-bearing: line 916 tells the reader "write it down word for word as it is read out" — and no card teaches the vocabulary they will be writing down. *Imminent* (within 6 hours), *soon* (6–12), *later* (more than 12), and *good / moderate / poor / fog* for visibility. That is one card, and it makes an existing card work.

---

## Summary of MUST FIX

1. No card introduces mast, boom, winch, rudder, block, shroud — the deck names parts it never points at (§1)
2. Section 01 defines `athwartships`, `fore-and-aft` and `sheet` after using them (§1, §7)
3. No VHF or Mayday card, in a deck that three times tells you to use the radio (§4.1)
4. Nothing on watches, sleep and what a day looks like (§4.2)
5. Nothing on what to pack (§4.3), how to move about the deck (§4.4), or what to do when you don't understand an order (§4.5)
6. Beaufort split across four cards; five duplicate diagram inserts (§3)
7. All twelve diagram references are broken — no `media/` directory exists (§3)
8. Duplicate pairs: northerly ×2, bowline/jib sheet, rolling hitch/jammed sheet, riding turn ×2, tether/jackstay ×4, ease ×2, sail-trim ×3 (§5)
9. "Painter" means two different things in two sections (§5)
10. "Name eight items" answered with fifteen (§6)
11. Standing/running rigging card is structurally broken (§6)
12. Day Skipper layer: newton ratings, five flag cards, bending on sails at position 33, weather helm (§2)
