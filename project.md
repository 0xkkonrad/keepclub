# Munin

Spaced repetition that doesn't make you learn the app first.

Anki's scheduler is the best thing in the category and its interface is the reason most
people who try it stop. Munin keeps the first and replaces the second.

Named for Odin's raven of memory — a small friendly raven who remembers things for you.
(Huginn was thought. We only need the other one.)

Status: **scope only**. Nothing is built. Nothing here is committed to code yet.

---

## Where this came from

A research pass over the field (Mochi, Noji/ex-AnkiPro, RemNote, Skola, MintDeck, Lexie,
Traverse, kian) and a 19-option mockup picker. All seven decisions locked 26 July 2026.
The picker lives at `preview/anki-ux-mockups/` in the sandbox and holds the reasoning,
the costs, and — more usefully — the fourteen options that were rejected.

The one position nobody occupies is *Anki-compatible data and sync with a modern UI*.
We looked at it and are deliberately not taking it: the sync protocol and the note-type
model are where that plan dies. Munin is greenfield with one-way import.

## The six failures we're answering

Every one of these is a documented, repeated complaint about Anki, not a hunch.

1. **Deck options** — ~25 controls across 6 tabs, most made obsolete by FSRS.
2. **Onboarding and sync** — no login menu item; "Full Sync" reads as *sync everything*
   and means *destroy one side*.
3. **Add-on dependency** — occlusion, progress, better editors all live in third-party
   Python add-ons that break on upgrade.
4. **Note types / templates / fields** — the real power and the steepest cliff.
5. **Stats** — plenty of charts, and true retention buried under them.
6. **Import and deck updates** — duplicate subdecks, lost scheduling, no preview.

## The character

Munin is a raven. The visual language is inherited wholesale from the RYA Day Skipper app
— DM Mono on paper, 2px ink outlines with a 4px hard offset shadow, one indigo accent
(#3A30D8), flag yellow (#FFD54A), hand-drawn inline-SVG doodles stroked in `currentColor`
so dark mode is free — and then **re-drawn corvid**.

The nautical doodle set is replaced, not recoloured:

| Day Skipper | Munin |
|---|---|
| boat, buoy, gull, wave | raven, feather, egg, branch |
| compass rose | crow's feet — three-toed prints, used as progress marks |
| ship's log badges | the hoard — shiny things Munin has collected |
| anchor, knot | worm, nest, cracked shell |

Crow's-feet prints are the workhorse: they mark a card seen, a day done, a streak. A
trail of prints across the screen is the progress bar.

Tone follows Day Skipper's: lowercase for the app's own chrome, never for card content.

---

## Locked

| # | Decision | Pick |
|---|---|---|
| 0 | What we're building | **Greenfield, import only.** Own schema, own sync. One-way `.apkg` import so people can get their cards in; no ongoing Anki compatibility. |
| 1 | Home | **One session.** One number, one button. Decks demote to a filter chip row, not a hierarchy. |
| 2 | Review | **Flick the card.** Direction and distance give the grade, with a live ghost label showing what you're about to commit. Buttons stay as the fallback. |
| 3 | Deck options | **Pick a mode.** Four postures — cramming for a date / learning properly / keeping it warm / on hold. The hood stays shut behind one dotted link. |
| 4 | Making cards | **Markdown body + card-kind stamps.** Both, not either. The note is one markdown box; the stamp decides how many cards it makes. |
| 4b | Editing cards | **Edit from where you found it.** See below. |
| 5 | Progress | **One number and one sentence.** True retention, in words, with the consequence spelled out. Forecast underneath. |
| 6 | Import | **Drop it, get a receipt.** Plain accounting of what landed, what was already there, what couldn't be read. |

Konrad on #2: *"i love the strength of flipping being the how-easy-it-was ux."* That is the
distinguishing interaction of the product — treat it as load-bearing, not a gesture
shortcut over a button row.

### 4b — editing cards

Anki's browser is a spreadsheet with a query language attached, which is why nobody edits
a bad card; they suffer it for years instead. Munin's rule: **you can fix a card from
wherever you hit it.**

- **From review.** The card you just answered is one tap from an editor, and answering
  continues where it left off. This is the path that matters — a wrong card is discovered
  in review, not in a browser.
- **From browse.** A plain list, searchable by text, filterable by deck and by state
  (leech / never-answered / due). No query language.
- **Editing is markdown**, the same box as authoring — there is no separate "edit" UI.
- **Changing the stamp changes the cards.** Front/back → both directions adds a sibling
  card and keeps the existing one's history. Removing a stamp archives its card rather
  than deleting the scheduling.
- **Undo.** Every edit is reversible for 30 days, same mechanism as the import receipt.

Open: whether an edit ever resets scheduling. Default assumption is **no** — reword freely,
history survives — with an explicit "this is a different card now, start it over" action.

---

## Shape

Local-first PWA, Supabase behind it.

- **On device:** IndexedDB is the source of truth. The app works fully offline; sync is a
  background nicety, never a gate. (Day Skipper's single-localStorage-key state does not
  survive this — thousands of cards plus media need a real store.)
- **Supabase:** auth, sync, and media storage. Row-level security per user. A deck is
  rows, not a blob, so a partial sync is a normal state and not a corruption.
- **Scheduler:** FSRS (`ts-fsrs`). Day Skipper's tuned SM-2 does not come across. What
  *does* come across is its exam-date interval clamp — that's what makes mode 1
  ("cramming for a date") real rather than a label.
- **No accounts required to start.** Sign-in is what turns on sync, not what turns on the
  app. Anki's onboarding failure is a decision we get to not repeat.

## Phases

**Phase 0 — extract the engine out of Day Skipper. This comes first.**

Day Skipper is progressing well and must keep working; the extraction is a refactor of a
live app, not a fork left to rot. It has four headless test suites — those are the safety
net that says the extraction was clean.

Comes across: the theme and doodle system, the review-loop UI, the lightbox, the figures
renderer, the PWA/service-worker shell, the test harness.

Does not: the SM-2 scheduler, the localStorage state layer, the Python card-authoring
build (`src/cards_*.py` stays Day Skipper's own).

The end state is that **Day Skipper becomes the first Munin deck** — same engine, its own
content and its own deployment.

**Phase 1 — storage and scheduler.** IndexedDB schema (decks / notes / cards / reviews /
media), FSRS in place of SM-2. No new screens. This is the phase that turns a study app
into a product.

**Phase 2 — the new screens.** H1 home, R2 flick-grading with a real distance→grade
mapping and its desktop fallback, the M1+M3 editor and the 4b edit paths, T1 progress.

**Phase 3 — `.apkg` import.** sql.js over the collection's SQLite, media unzip, note-type
flattening onto the markdown+stamp model, ending in the I3 receipt. This is the phase that
can eat a month; everything before it is a working app without it.

**Phase 4 — Supabase sync.** Auth, per-user RLS, conflict policy, media to Storage.

## Not doing

- Anki sync-protocol compatibility, in either direction.
- Ongoing deck updates. Import is a one-time migration, so there is no diff-before-apply
  and no subscribe-to-a-deck. **This is a known hole** — the update path was the loudest
  complaint in the ecosystem and we're choosing not to answer it. Revisit if shared decks
  ever matter.
- AI card generation. Card-making is part of learning; Skola's reasoning holds.
- A shared-deck marketplace.
- Anything named after Anki. AnkiPro was forced to rename to Noji in June 2025 under
  trademark pressure.

## Open

- **Supabase project** — personal, or under an existing org? Keys not chosen.
- **Flick-grading on desktop.** Buttons are the stated fallback, but the best interaction
  in the product being mobile-only is a real cost. Trackpad gesture? Arrow keys with the
  same ghost label?
- **Distance→grade mapping.** Needs to be tuned on a real thumb, not designed on paper.
- **Does Day Skipper stay separately deployed** at kkonrad.com/day-skipper, or become a
  deck inside Munin with a redirect?
- **Do edits ever reset scheduling** (see 4b).
- **Repo name.** Created as `munin` — the raven of memory, matching the character. The
  brief said "mumin" once and "munin" once; renaming is one command if that was the wrong
  read.
