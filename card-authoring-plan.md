# Writing cards in the app — scope

Written 30 Jul 2026 against `4f8c07b`, decisions settled the same day. Nothing here is
built. This is §4b of `project.md` ("you can fix a card from wherever you hit it"), the
one piece of the brief with no implementation at all.

Today a card can enter a deck two ways and neither is authoring: a built-in course ships
its `cards.json` (`web/app.js:4914`), or the importer reads a `.keep.yml`/`.apkg` into
IndexedDB (`web/import.js:265-337`). There is no card editor on any screen. The Backup
file input (`web/index.html:390`) looks like one and is not — it restores review history
and notes, and refuses a file with no review history (`web/app.js:4529`).

**One release, not a ladder.** Adding, editing and deleting ship together, in every deck
type, because a release that only adds cards does not fix the wrong card you just hit,
which is the whole point of §4b.

---

## What ships

- **Write a card** into any deck: a built-in course, an Anki import, a `.keep` import, or
  a deck of your own.
- **Edit any card**, including a course's own cards, from Browse and from the card you
  just answered.
- **Delete** a card you wrote; **hide** a course card that should not exist; **revert**
  either, because both are a layer over the shipped deck rather than a change to it.
- **A deck of your own**, created by its first card.
- **Your cards follow you** between devices on courses that already sync.
- **Your cards are in the backup file**, so the browser profile is not the only copy.

Explicitly not in this release: media on hand-written cards, tags, card ordering, card
kinds/stamps (the unbuilt M1+M3 model), bulk edit, and the 30-day undo log — see
*Settled* below.

---

## Settled decisions

| | Ruling | Why |
|---|---|---|
| Built-in courses editable | **Yes** | The brief promises it, and it is the only version that reaches someone who never imports. Additions are a union over the shipped deck; edits are per-card overrides in the same layer, so a course update replaces the official half and leaves yours alone. |
| Anki decks editable | **Yes, with no conversion** | The editor renders markdown to sanitized HTML *before* the merge, so the layer is representation-agnostic and drops into a `sanitized-html` deck (`web/lib/course-runtime.js:44`, `web/lib/course.js:1234`) as readily as an authored one. This is what made the question look expensive; it dissolves. |
| Markdown or plain text | **Markdown**, the existing small subset | Course cards already carry bold and lists. Editing one as plain text would flatten it on exactly the "fix this card" path. Subset and diagnostics already exist (`web/lib/course-markdown.js:29-72`). |
| Cards in the backup | **Yes** | Far cheaper than a `.keep.yml` exporter and it closes the "one browser profile is the only copy" hole. |
| Edits reset scheduling | **No** | The brief's default. Reword freely, history survives; the destructive option is the one you cannot take back. |
| Undo | **Confirm, plus revert** | Deleting a card you wrote is permanent behind a confirm that names how many times you answered it. Anything done to a *course* card is always reversible for free, because dropping the override restores the shipped card. The brief's 30-day log is a later, separate feature. |
| Sync | **Yes, on courses that already sync** | Notes already sync; a card you fix on your phone still being wrong on your laptop is the odd gap. Reuses the notes tombstone algebra. |
| A deck of your own | **Yes, created by its first card** | An empty deck is an invalid document (`web/lib/course.js:903-908`), so it cannot exist before then. |
| Does a deck of your own sync | **No, and it says so** | Nothing local syncs today (`web/app.js:5034`, `web/sync.js:7-8`), and syncing a whole deck — cards, media, no size bound — is a different problem from syncing a layer of edits. The creation copy states it plainly, and the backup file is the way to move one. |

---

## Where the cards live

`munin/<id>/cards/v1` — a per-course document, sibling to the state document, sharing the
key template (`web/munin.js:25-30`), merged into `DECK.cards` in `boot()` before the
indexes are built (`web/app.js:4957`).

**Not inside `state/v1`.** `mergeState` builds a fresh object and copies only the keys it
knows (`web/sync.js:373-428`). A `cards` key it has never heard of is not skipped — it is
dropped, and `adoptSynced` then persists the loss (`web/app.js:3471-3478`). Cards in the
state document would mean that a mistake in `sync.js` destroys them silently. The sibling
document is uploaded deliberately, as its own block, or not at all.

**Three record kinds, one shape.** `{at, ed, …}` like a note, keyed by id:

- **written** — a card of your own: `front`, `back`, `section`.
- **override** — a replacement for a course card, keyed by *that card's* id, carrying
  `was`: a fingerprint of the official front/back at the moment you edited it.
- **hidden / deleted** — the tombstone, an emptied record with a newer `ed`, exactly as
  notes do it (`web/sync.js:266-297`).

The merge is: shipped cards, minus tombstoned ids, with overrides applied by id, plus
written cards appended.

**`was` is the field that cannot be added later.** When the deck author rewrites a card
you have edited, the fingerprint is the only way the app can tell — otherwise your
override silently pins you to a stale card, which is a bitter outcome for a feature about
fixing wrong cards. It costs one hash now; retrofitting it means every existing override
has an unknown provenance for ever. The release surfaces it as a line in Browse offering
to keep yours or take theirs.

**Ids are namespaced, permanently, in both directions.** Official ids are
`sha1(question)[:10]` — ten lowercase hex characters, deliberately shared across both RYA
courses so they share review history (`content/competent-crew/src/build.py:19-22`).
Written cards take a reserved prefix (`u.`, which validates under the grammar at
`web/lib/course.js:9` and cannot collide with a hex hash), the layer accepts only that
shape, and **the course reader rejects any shipped course that uses it** — without that
second half, a future official card silently captures a user card's review history,
because `byId` is a `Map` built from `DECK.cards.map` and the last id wins.

**Known asymmetry:** because official ids are shared between the two RYA courses but the
layer is per-course, editing a shared card in Day Skipper does not change it in Competent
Crew, though both still share its review history. Per-course is the right default — the
edit belongs where you made it — and it is written down here so the next reader does not
discover it as a bug.

---

## Sync

Cards travel as their own block in the merged state, alongside notes, on courses that
already sync. The notes algebra transfers wholesale: newest `ed` wins per record, earliest
`at` preserved so lists do not re-order after a merge, deletes as tombstones because a
plain union resurrects them, and a total eviction order so a three-device merge cannot
depend on pairing order (`web/sync.js:266-369`).

Three things are genuinely different from notes and have to be designed, not inherited:

1. **The budget is joint, not a second independent cap.** Notes already reserve 200 live
   records and 400 entries (`web/sync.js:299-302`, mirrored in `web/app.js:44-48`).
   Cards share one budget with them, because the thing that loses when the blob overflows
   is review history.
2. **The blob's real size bound is not written down anywhere in this repo.** `sync.js:8`
   and `:287` assert it exists; no number appears. **Establishing it is the first task of
   the release**, before the caps are chosen, because guessing here is how you find out in
   the field.
3. **Card merging must never delete a review record.** Records are keyed by card id and
   five code paths already drop records for unknown ids (`web/app.js:414, 561, 3472,
   4585, 4978`). A tombstone arriving from another device must not take review history
   with it in the same tick; that stays a local, bounded, spoken sweep.

A hidden or deleted card that another device has answered is the sharp edge: the honest
behaviour is that the card goes and the history goes with it, said out loud once, rather
than a silent disappearance at the next boot.

---

## The five things that will bite

1. **The boot orphan sweep is a data-loss trap.** `web/app.js:4978` deletes review records
   for cards not in `byId`, silently, on every boot. If the cards document fails to read —
   quota, corruption, a private window — every written card's history is destroyed
   permanently. Sweep only when the layer loaded successfully. `sweepOrphans` already
   states the discipline: null means the question could not be answered, and an unanswered
   question is not the answer "none of them exist" (`web/munin.js:1219-1224`).
2. **Two content representations.** `readCourseForRuntime` renders CommonMark only when the
   document says `authored-commonmark` (`web/lib/course-runtime.js:44`); built-in courses
   and Anki imports are `sanitized-html`. The layer renders on save *and* on load, so
   `**bold**` cannot show up as literal asterisks on a course card, and a hand-edited
   document cannot smuggle raw markup past.
3. **`store.put` is media-destructive.** It clears a deck's whole media range before
   rewriting (`web/lib/store.js:88-100`). The deck-creation path and any future write into
   an imported deck must carry existing media through, or editing one card's wording
   deletes every picture in it.
4. **Re-import silently discards written cards.** The replace path rewrites the whole deck
   record (`web/import.js:416-448`) and the receipt's "keeping progress" promise
   (`web/lib/receipt.js:258`) is about progress but reads as a promise about content. It
   needs a line before the button: *You have written 7 cards into this deck. Replacing it
   removes them.*
5. **Editing an official HTML card loses what markdown cannot express.** The subset covers
   emphasis, strong, lists, breaks and links; a course card using anything else simplifies
   when edited. Say it once, in the sheet, before the first such edit — do not discover it
   silently.

---

## The editor

Two boxes and, only when the deck declares more than one section, a select.

- **Question** — required. The app's word is question, not front (`web/index.html:78`).
- **Answer** — optional, and the best thing the editor inherits: a card with no back is a
  supported type that self-grades, handled end to end already (`web/app.js:1049-1056`,
  `:2486-2487`, `web/lib/receipt.js:183-186`).
- **Card id** — generated, never shown; ids are opaque by contract
  (`schema/course-v2.md:42-45`).

**Markdown without a mode.** No preview, no toggle: one textarea per side like
`#notes-text`, one muted line of fineprint naming what works, and errors reported after
Save in the sheet's status line using the message and correction the parser already
produces (`web/lib/course-markdown.js:43-72`) — the shape the importer already uses
(`web/import.js:239-254`). The preview is the card itself.

**Validation is not hand-written.** The editor builds a one-card v2 document and runs it
through `readCourse`. `web/lib/validate.js:1-10` is a standing note about what happened
last time a second hand-written validator existed.

**Entry points.** Browse is primary — one row per card, already scoped by section, already
re-rendered on every state change (`web/app.js:3261`) — with `Write a card` in
`.browse-acts` and `Edit` on each row. The study dock gets `Fix this card`, the path §4b
calls the one that matters. Editing mid-session is safe because the queue holds ids and
resolves through `byId` on each draw (`web/app.js:2391-2392`); **deleting the card you are
on** would silently end the session (`web/app.js:2397`), so that one is refused with a
reason.

**Structural refusals**, both hard errors in the validator today: a course must hold at
least one card (`web/lib/course.js:903-908`) and a declared section at least one
(`:1080-1088`). Deleting the last card in a section takes the section with it, and says so
first.

**A deck of your own** is created from the importer's own pick screen, which already says
*your own deck* and *stays on this device* (`web/import.js:89`), as a second path beside
choosing a file. It asks for a name and the first card in one sheet and writes nothing
until that card is saved, so a cancelled attempt leaves no tile behind. The shelf tile is
`localTile` unchanged (`web/munin.js:1319-1338`).

---

## Draft copy

Entry: `Write a card` · `Edit` · `Fix this card`.

Sheet: `New card` / `Edit card`; `Question`; `Answer`, placeholder *Leave this empty for a
card you grade yourself, with nothing to reveal.*; fineprint *Plain text works.
\*Emphasis\*, \*\*strong\*\*, lists and https links also work; nothing else does.*

Deck creation: *What is this deck called?* — *A deck you write stays on this device. It
does not sync, and the backup file is how you move it.*

Delete confirm, native, mirroring `web/app.js:4210`:

> Delete this card?
>
> There is no undo. You have answered it 14 times, and that history goes with it.

Course card, edited: `Edited by you. Show the original.` · when the author has since
rewritten it: `The author rewrote this card after you edited it. Keep yours · Take theirs.`

Refusals: `A card needs a question.` · `This is the only card in this deck. A deck needs at
least one, so remove the whole deck from the courses screen instead.` · `This is the last
card in Ropework and knots, so the section goes with it.` · `This card is in the session
you have open. End the session first.` · `Another tab is studying this deck. Finish there
before changing cards.` · storage refusals reuse the importer's words verbatim
(`web/import.js:456`).

---

## Work breakdown

Roughly in dependency order; the first item gates the sync design.

1. **Establish the sync blob's real size bound** and set the joint notes+cards budget from
   it. Everything about caps is a guess until this exists.
2. **The layer**: document, record kinds, sanitise-on-load with caps and a drop counter
   modelled on notes (`web/app.js:331-367`), reserved ids, the reader's rejection of
   reserved ids in shipped courses, markdown rendered on save and load, merge before
   `byId`, conditional orphan sweep.
3. **The sheet**: cloned from the notes panel's modal contract (`web/app.js:2262-2299`),
   validation by round-trip, diagnostics in the status line.
4. **Entry points and rendering**: Browse add/edit/delete/revert, study-dock fix, the
   author-rewrote-it line, and the derived numbers that move when a deck grows — search
   placeholder, browse counts, stats, exam pacing, the frieze, and per-section achievement
   denominators (`web/achievements.js:666-712`).
5. **Sync**: the cards block in `mergeState`, joint budget, the rule that a card tombstone
   never deletes a record in the same tick.
6. **Lifecycle**: cards in the backup payload and in restore under the notes merge algebra
   (`web/app.js:2088-2095`), carried through erase, registered in `sweepOrphans`
   (`web/munin.js:1229`) and `store.remove` (`web/lib/store.js:131`).
7. **Deck creation**: the second path on the pick screen, a media-safe `store.put` call
   site, the re-import warning line.

**Built so far.** Item 2, the layer, is in `web/app.js` under *cards you write*, with
`MUNIN.cardsKey` in `web/munin.js` and the reader's half of the reserved-prefix rule in
`web/lib/legacy-course.js` (`RESERVED_ID_PREFIX`, `isReservedId`) and `web/lib/course.js`
(`validId`, diagnostic `course.reserved_id`, documented in `schema/diagnostics.md`).
Ceilings: 2,000 characters a side, 200 live records per deck, 400 stored entries —
conservative, because item 1 above is still the number nobody has. Two things this
document did not settle, decided in the build:

- **Revert needed a representation of its own.** An emptied record means the layer
  contributes nothing for that id: for a card you wrote that is the delete, and for a
  course card it is the revert — the shipped card coming back. Hiding a course card is a
  different outcome from reverting one, so a hide is an emptied record carrying
  `hidden: true`. Both settle under the notes algebra, newest `ed` winning.
- **`was` is a 32-bit hash and a length, not a digest.** `crypto.subtle` does not exist
  outside a secure context and would put a promise per card on the boot path. It is a
  change detector and is asked to be nothing else.

Items 3 and 4 — **the sheet and the entry points** — are in `web/app.js` under *the card
sheet*, with `#card-sheet` beside the notes panel in `web/index.html` and a `.sheet` block
in `web/app.css` drawn entirely from the theme variables. `Write a card` and `Edit` are in
Browse, `Fix this card` is in the study dock, and the sheet owns Delete, Hide and
`Show the original`. Four more things this document did not settle, decided in that build:

- **The first fill for an untouched course card is a down-converter that names what it
  cannot carry.** `htmlToCardSource()` writes back only the constructs the subset has —
  emphasis, strong, breaks, lists, https and mailto links, `<p>` and `<div>` as paragraphs,
  `<span>` as nothing — and returns everything else in `lost`. The sheet then says it
  before the first save: a card whose picture lives inside its own HTML as
  `munin-media:<n>` gets *"This card keeps a picture inside its words, and these boxes hold
  text. Save and your words replace the card, without it."* A converter that stepped over
  the `<img>` in silence would delete somebody's picture the moment they fixed a typo
  underneath it. Card-level media and figures are untouched either way: `cardsWithLayer()`
  spreads the shipped card and replaces only the two sides.
- **Taking a card out lives in the sheet, not on the Browse row.** One confirm, one set of
  refusals, and one place that knows a session is open. The row carries Edit and the layer's
  own line — *Written by you.* / *Edited by you. Show the original.* / *The author rewrote
  this card after you edited it. Keep yours · Take theirs.*
- **`Keep yours` re-stamps `was` and bumps `ed`.** Not a word changes; what changes is the
  answer to "is this still the card I edited?". The edit stamp has to move with it or the
  device that never saw the choice wins the merge and puts the question back.
- **A hidden card needs a list of its own.** Hiding takes the card out of `DECK.cards`, so
  it is in no list Browse draws and there would be nowhere to undo it from — and hiding is
  only free if undoing it is reachable. `Cards you hid (n)` in the browse actions opens a
  list directly under them, each row offering `Bring it back`.
- **A section that ends up empty is dropped from `DECK`.** The course reader refuses a
  declared section with no cards; `applyCardLayer()` now agrees with it, so hiding the last
  card in a section takes the section, as the copy says it will. The filter's rebuild key
  includes the section count for the same reason.

Item 5, **sync**, is in `web/sync.js` under *what you write* and in `web/app.js` in
`syncPayload()`, `sanitiseSynced()`, `adoptMerged()` and `sweepDeletedCardHistory()`. Seven
things this document left open, settled in that build:

- **The blob's size bound was discoverable after all, and it is 262,144 bytes.** It is in
  this repo: `sync.apps.max_bytes` in
  `content/day-skipper/supabase/migrations/20260727080812_sync_blobs.sql`, the migration
  that defines the backend `web/sync.js` talks to, enforced by `sync_put` as
  `octet_length(p_data::text) > v_max` with SQLSTATE 22023. Both built-in courses are
  inserted at the column default, so it is the number and not an assumption.
  `tests/sync-merge.mjs` reads the migration and fails if the client's copy drifts from it.
- **One budget, and it had to be a count.** Day Skipper fully answered is 57 KB of review
  records and the calendar another 6 KB, so about 66 KB of the blob is spoken for before
  anybody writes anything. Notes and cards therefore share the 200 live records and 400
  stored entries the notes had to themselves — `WRITTEN_LIVE` and `WRITTEN_SLOTS`, the same
  numbers in both files — rather than holding 200 each, because two independent ceilings
  describe far more writing than the blob can carry and what loses when it will not fit is
  the review history beside it. Nothing on any device today is dropped by the change: 200
  notes still fit exactly, and no cards have ever been uploaded.
- **The ceiling cannot be a byte ceiling.** Eviction has to be a prefix of a total order or
  a three-device merge stops converging — drop a long record and a shorter one behind it
  moves up into the space, so merging a with b then c can keep a different set from merging
  b with c then a. Records are counted; the bytes are enforced once, exactly, in
  `syncOnce()`, which refuses to send a blob over the bound and says which way out there
  is. A count cap and a length cap cannot bound bytes on their own, and pretending
  otherwise is how you find out in the field.
- **What the server counts is not `JSON.stringify`.** `p_data::text` is the *jsonb* text
  form: Postgres parses the document and writes it back with a space after every colon and
  every comma, so a blob of five thousand keys measures five thousand bytes larger there
  than here. `blobBytes()` therefore renders the document the way Postgres does rather
  than the way we sent it. It errs towards refusing slightly early, which costs nobody
  anything — the refusal is local and every word is still on the device — where the other
  direction costs a round trip and returns a sentence nobody can act on.
- **The single-writer lease covers a merge, not only a keystroke.** `adoptMerged()` asks it
  once, at the top, instead of letting each write ask in turn. Refused halfway was the bad
  shape: `writeNow()` put the review document back and said why, `writeCardLayer()` then
  said the same sentence again, and the deleted-history sweep between them had already
  counted against a state that never landed. Nothing is lost by refusing — the server is
  still holding the merge.
- **A tombstone never takes review history inside the merge.** `mergeState` does not touch
  `recs` for any reason, because it is the one place that cannot tell a deleted card from a
  cards document that failed to load. The history goes locally instead, in
  `sweepDeletedCardHistory()`: bounded by the records this deck holds, only for a card of
  your own whose record says deleted, and spoken once in a sticky toast — *A card you had
  answered was deleted on another device, so its history went with it.* A hidden course
  card keeps its history, because otherwise un-hiding it would not be the free thing the
  layer promises. `deleteCard()` now takes the record on the device that did the deleting,
  which is what its confirm has always said it would. The sentence is said by the adoption
  itself, not by the button that asked for a sync: most syncs are not asked for — one is
  scheduled five seconds after every session — and a sentence only a button could print
  would leave the commonest case silent. `runSync()` therefore withholds *Synced.* when
  something costlier has been said, because a round trip that had to drop somebody's
  writing is not a successful sync with a footnote.
- **`sanitise()` had to be taught to drop one key.** It copies everything it does not name,
  which is how a key from a newer build survives an older one — and it is the sanitiser the
  state half of a merged blob goes through, so a `cards` key would have been written
  straight into the document this design keeps them out of, and left there as a staler
  second copy.

Item 6, **the lifecycle**, is the cards block in the exported payload and in restore, the
erase confirm, `sweepOrphans()` in `web/munin.js`, `remove()` in `web/lib/store.js`, and
the replace path in `web/import.js` with its line in `web/lib/receipt.js`. Three things
this document did not settle, decided in that build:

- **Every sentence about the file counts the whole layer, not the cards with no shipped
  card under them.** A deck whose entire history with a person is five of its own cards
  they fixed has a file worth taking, and the earlier count said there was nothing here to
  back up while the file held all five. `liveCardCount()` therefore drives the backup line,
  the export message, the restore message and the erase confirm, all in one phrase — *the
  N cards you have written or edited* — because four sentences about one thing that count
  it differently are four chances to be wrong. `writtenCardCount()` survives as the file
  header's `cardsWritten`, where "how many of these were typed by hand" is the question a
  person opening the JSON actually has.
- **Re-import is two rulings, not one.** *This deck again* keeps the layer — that is the
  whole reason an edit is a layer over the deck rather than a change to it, and it is what
  makes a course update replace the official half and leave yours alone. *A different deck
  under the same name*, which is the explicit start-over path, takes it: the records are
  keyed by the outgoing deck's card ids, so what would survive is overrides that apply to
  nothing and cards written into a deck that is not on the device any more. The receipt
  says which of the two this one is before the button, and names the backup file as the way
  out of the second.
- **Removing a deck is the one thing that takes both documents; erasing progress is the one
  thing that keeps one.** `store.remove()` deletes the layer beside the history, and
  `sweepOrphans()` catches either of them written back by a tab that was still open —
  from a list it actually has, never from an empty one.

Item 7, **deck creation**, is the second path on the importer's pick screen in
`web/import.js` under *a deck of your own*, with `own` carried through `bootLocal()` in
`web/munin.js` and read once in `cardsWithLayer()`. Four things this document did not
settle, decided in that build:

- **The card that made the deck stays in the deck's document, and every card after it is
  in the layer.** That is not two models: the deck's document is what this deck *ships*,
  the same way `cards.json` is what Day Skipper ships, and the layer goes over the top of
  it exactly as it does anywhere else. What it costs is one honest asymmetry — the card
  the deck was made by is taken out by hiding it, not by deleting it, because it is still
  in the document underneath and bringing it back is therefore free. What it buys is that
  no screen, no count, no sweep and no sync path has a branch in it for a deck of your
  own. `cardsWithLayer()` is the one place the two homes meet, and all it does there is
  answer the only question the screens actually ask, which is whether you wrote this card.
- **`store.put` is called once, ever, on a deck that does not exist yet.** It clears a
  deck's whole media range before it writes, and the creation path hands it an empty media
  list — which is safe *by construction* and only by construction: the id was minted a
  moment earlier and checked against every deck in the database, so the range being
  cleared is empty. The constraint is written above the call in capitals, because a second
  save path into an existing deck added underneath it would delete every picture in that
  deck the first time somebody fixed a typo.
- **The sheet is the card sheet's, cloned.** `#card-sheet .sheet-card` is copied out of
  `index.html`, its ids renamed, and the three parts that are about a card which already
  exists removed. The labels, the 2,000-character cap, the placeholder for a card you
  grade yourself and the line naming what Markdown does are one definition, and a second
  copy of them in `import.js` is a second copy to drift. The node itself cannot be
  borrowed: the shelf opens over a course whose `app.js` is loaded and still listening to
  that sheet.
- **Validation is the reader, one level up.** The screen builds a one-card v2 course and
  runs it through `readCourseForRuntime` — the whole document, not the card, because the
  document is what is being made — and prints the reader's own message and correction with
  the box named. What is stored is the document as it was typed, not what the reader
  returned: boot owns the one render pass, and the reader's output carries derived fields
  a later boot would hand back to a validator that has never heard of them.
- **A deck of one card made every "N cards" in the app reachable at one.** Home's subtitle,
  the Browse count and its section tiles, the search placeholder, the exam pitch and the
  shelf row all said "1 cards"; the exam pitch also offered to work out how many of these
  1 cards a day you need. They are counted through `plural()` now, and the pitch has a
  branch for a deck with nothing yet to pace.

**Tests.** A new `tests/authoring.mjs` built on `notes.mjs`'s shape (write → read back →
reload → sanitiser → corrupt block still boots → foreign tab refused → modal history and
Tab containment), plus the override and revert cases and the author-rewrote-it detection.
`sync-merge.mjs` for the cards block, the shared budget, three-device convergence, the
migration gate on the byte bound, and the refusal above it.
`course-schema-v2.mjs` for the reserved prefix, with a gate that no shipped course uses it.
`qa-regressions.mjs` for single-writer and modal behaviour. `achievements.mjs` for moving
denominators. `importer-ui.mjs` for creation, re-import and removal — including the layer
kept by one replace, taken by the other, and the deck's two documents going together.
`authoring.mjs` for the lifecycle: the file carrying the layer as its own block, a restore
merging rather than clobbering, an older file that cannot resurrect a deleted card but
whose review history for it goes and is said, erase keeping the layer, and the shelf's
orphan sweep. Both files again for a deck of your own — `importer-ui.mjs` for the making
of one (the second path on the pick screen, a creation called off leaving no tile, the
reader's refusals, the neighbouring imported deck keeping every picture across the save,
studying it immediately, the second card landing in the layer while the document keeps
its one, and removal taking both documents), and `authoring.mjs` for the model over it
(one card refused outright, hide-and-bring-back on the deck's own card against
delete-for-good on the layer's, Browse naming the writer of each wherever it lives, and an
edit of the card the deck was made by leaving that document untouched).
