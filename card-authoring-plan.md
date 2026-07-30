# Writing cards in the app — scope

Written 30 Jul 2026 against `4f8c07b`. Nothing here is built. This is the scope for
§4b of `project.md` ("you can fix a card from wherever you hit it"), which is the one
piece of the brief with no implementation at all.

Today a card can enter a deck two ways and neither is authoring: a built-in course
ships its `cards.json` (`web/app.js:4914`), or the importer reads a `.keep.yml`/`.apkg`
into IndexedDB (`web/import.js:265-337`). There is no card editor on any screen. The
Backup file input (`web/index.html:390`) looks like one and is not — it restores review
history and notes, and refuses a file with no review history (`web/app.js:4529`).

---

## The decision everything hangs from

**Can you write a card into a built-in course, or only into a deck of your own?**

The brief says you can fix a card wherever you hit it, and the card you hit is usually
a Day Skipper card. But `web/courses/<id>/cards.json` is a shipped file, fetched
network-first (`web/sw.js:429-451`) and re-deployed as courses improve. Nothing in the
app writes to it, and per-user state holds only `recs`, `notes`, `settings`
(`web/app.js:188-216`).

Both answers are buildable and they produce different products:

- **Yes, built-ins too** — user cards live in a per-course document *beside* the state
  document, merged over `DECK.cards` at boot before `byId` is built (`web/app.js:4957`).
  A course update replaces the official half and leaves yours alone, because the two
  halves are never in the same file. Costs a reserved id namespace, four registration
  points, and a conditional orphan sweep (below).
- **Your own decks only** — authoring writes into the IndexedDB deck document that
  imported decks already use (`web/lib/store.js:83-110`). Much less new machinery,
  reuses `bootLocal`, the shelf tile and the receipt. But the wrong card you actually
  hit, in the course you actually study, stays wrong.

**Recommended: yes, built-ins too.** It is what the brief promises, it is the only
version that reaches a person who never imports anything, and the added machinery is
small and testable. The section below assumes it.

---

## Where user cards live

`munin/<id>/cards/v1` — a sibling of the state document, same per-course key template
(`web/munin.js:25-30`), merged into `DECK.cards` in `boot()` before the indexes are
built.

Not inside `state/v1`, for one decisive reason: `mergeState` builds a fresh object and
copies only the keys it knows (`web/sync.js:373-428`). A `cards` key it has never heard
of is not merged — it is dropped, and `adoptSynced` then persists the loss
(`web/app.js:3471-3478`). Putting cards in the synced document means that forgetting to
edit `sync.js` does not degrade to "cards don't sync"; it degrades to **cards are
silently destroyed on the first sync**. A sibling document is off the wire by
construction, because the uploader sends `state` and nothing else (`web/app.js:478`).

The cost is real and bounded: `sweepOrphans` (`web/munin.js:1225-1240`), `store.remove`
(`web/lib/store.js:131`), the backup payload (`web/app.js:4472`) and the erase path
(`web/app.js:4674-4681`) each have to learn the new key, and there is a two-document
atomicity gap to honour by respecting `save()`'s return value the way `commitNotes`
already does (`web/app.js:2132-2140`).

**Id namespace, permanent in both directions.** Official ids are `sha1(question)[:10]`
— ten lowercase hex characters, shared deliberately across courses so both RYA courses
share history for shared facts (`content/competent-crew/src/build.py:19-22`). User ids
take a reserved prefix (`u.` validates under the v2 grammar at `web/lib/course.js:9`
and cannot collide with a hex hash), the user layer accepts only that shape, and the
course reader **rejects** any shipped course using it. Without the second half, a future
official card can quietly capture a user card's review history: `byId` is a `Map` built
by `DECK.cards.map` (`web/app.js:4957`), so the last card with an id silently wins.

---

## The five things that will bite

1. **The boot orphan sweep is a data-loss trap.** `web/app.js:4978` deletes review
   records for cards not in `byId`, silently, on every boot. If the user-cards document
   fails to read — quota, corruption, a private window — every user card's history is
   destroyed permanently. Sweep only when the layer loaded successfully. `sweepOrphans`
   already states the discipline: null means the question could not be answered, and an
   unanswered question is not the answer "none of them exist" (`web/munin.js:1219-1224`).
2. **Two content representations.** `readCourseForRuntime` renders CommonMark only when
   the document says `authored-commonmark` (`web/lib/course-runtime.js:44`). Built-in
   courses and Anki imports are `sanitized-html` (`web/lib/course.js:1234`,
   `web/import.js:313-335`). User cards must be rendered to sanitized HTML before the
   merge, or `**bold**` shows up as literal asterisks on a Day Skipper card while the
   same text renders correctly in a `.keep` deck.
3. **`store.put` is media-destructive.** It clears a deck's whole media range before
   rewriting (`web/lib/store.js:88-100`). Any future save path into an imported deck
   that passes an empty media array deletes every picture in it.
4. **Re-import silently discards user cards.** The replace path rewrites the whole deck
   record (`web/import.js:416-448`) and the receipt's "keeping progress" promise
   (`web/lib/receipt.js:258`) is about progress, but reads as a promise about content.
   Needs a receipt line before the button.
5. **Backups do not hold cards.** Export writes `state` plus a stamp
   (`web/app.js:4472-4482`); cards are not in it, and restore drops unknown ids
   (`web/app.js:4585`). Today that is fine because the cards came from a file the user
   still has. The moment cards are hand-written, **one browser profile is the only copy**.

---

## The editor

Two text boxes and, only when the deck declares more than one section, a select.

- **Question** — required. The app's word is question, not front (`web/index.html:78`).
- **Answer** — optional, and this is the best thing the editor inherits. A card with no
  back is a supported type that goes straight to self-grading, handled end to end
  already (`web/app.js:1049-1056`, `web/app.js:2486-2487`, `web/lib/receipt.js:183-186`).
- **Card id** — generated, never shown. Ids are opaque by contract
  (`schema/course-v2.md:42-45`).

**Markdown without a mode.** Card content is CommonMark against a deliberately small
subset — paragraphs, breaks, emphasis, strong, lists, `https:`/`mailto:` links, and
everything else is an error with a message and a correction attached
(`web/lib/course-markdown.js:29-72`). So: no preview pane, no toggle, one textarea per
side like `#notes-text`, one muted line of fineprint naming what works, and errors
reported after Save in the sheet's status line using the diagnostics the parser already
produces — the shape the importer already uses (`web/import.js:239-254`). The preview is
the card itself.

**Validation is not hand-written.** The editor builds a one-card v2 document and runs it
through `readCourse`. `web/lib/validate.js:1-10` is a standing note about what happened
last time a second hand-written validator existed.

**Out of v1, deliberately:** media, tags (nothing in the app reads one), card ordering,
section create/rename/reorder, card-kind stamps (§4b's "changing the stamp changes the
cards" is the unbuilt M1+M3 model), bulk edit, and undo.

**Entry points.** Primary is Browse (`web/index.html:237-243`): it is already one row per
card, already scoped by section, already re-rendered on every state change
(`web/app.js:3261`), so a new card is one re-render and the section defaults to the
active filter. Secondary is the study dock foot — "this card is wrong" — which §4b calls
the path that matters. Editing text mid-session is safe because the queue holds ids and
resolves through `byId` on each draw (`web/app.js:2391-2392`); **deleting** the card you
are on would silently end the session (`web/app.js:2397`), so delete is refused from
Study in v1.

**Structural refusals**, both hard errors in the validator today: a course must hold at
least one card (`web/lib/course.js:903-908`), and a declared section must hold at least
one (`:1080-1088`). Deleting the last card in a section takes the section with it, and
says so first.

---

## Draft copy

Entry: `Write a card` (Browse), `Edit` (row footer), `Fix this card` (study dock).

Sheet: `New card` / `Edit card`; `Question`; `Answer` with the placeholder *Leave this
empty for a card you grade yourself, with nothing to reveal.*; fineprint *Plain text
works. \*Emphasis\*, \*\*strong\*\*, lists and https links also work; nothing else does.*

Delete confirm, native, mirroring `web/app.js:4210`:

> Delete this card?
>
> There is no undo. You have answered it 14 times, and that history goes with it.

Refusals: `A card needs a question.` · `This is the only card in this deck. A deck needs
at least one, so remove the whole deck from the courses screen instead.` · `This is the
last card in Ropework and knots, so the section goes with it.` · `This card is in the
session you have open. End the session first.` · `Another tab is studying this deck.
Finish there before changing cards.` · storage refusals reuse the importer's words
verbatim (`web/import.js:456`).

---

## Phases

| | Ships | Size |
|---|---|---|
| **A** | **"I can write a card."** The `munin/<id>/cards/v1` layer, sanitise-on-load with caps and a drop counter, reserved ids, validation by round-trip through `readCourse`, markdown rendered on save *and* on load, merged before `byId`, conditional orphan sweep, one sheet cloned from the notes panel, entry from Browse. No edit, no delete, no media, no sync, no undo. | S/M |
| **B** | **Edit and delete**, from Browse and from the answer screen. Edit keeps the record and re-indexes the one card (`web/app.js:2911-2915`); delete removes card and record in one write and names the cost first. | S |
| **C** | **Lifecycle** — cards in the backup payload and in restore under the notes merge algebra (`web/app.js:2088-2095`), carried through erase, registered in `sweepOrphans` and `store.remove`. | M |
| **D** | **A deck of your own** — created by its first card, since an empty deck is an invalid document (`web/lib/course.js:903-908`). The `+ your own deck` tile becomes a two-way choice on the importer's own pick screen. | M |
| **E** | **Media** — forces the layer into IndexedDB and a store version bump; permanently answers sync as no for those cards. | L |
| **F** | **Sync** — a `cards` block in `mergeState` reusing `pickNote`'s record picking, on a budget shared with notes rather than a second independent cap. Needs the server blob's real size bound, which is asserted (`web/sync.js:8`) but written down nowhere in this repo. | L |

Phase A commits to three things every later phase needs anyway and none of which
forecloses D/E/F: user cards live outside `state/v1`; ids are namespaced and reserved in
both directions; cards are authored as CommonMark and merged as sanitized HTML.

Test suites to extend: a new `tests/authoring.mjs` built on `notes.mjs`'s shape (add →
read back → reload → sanitiser → corrupt block still boots → foreign tab refused → modal
history and Tab containment), `course-schema-v2.mjs` for the reserved prefix, a gate that
no shipped course uses it, `qa-regressions.mjs` for single-writer and modal behaviour,
`achievements.mjs` because a deck you can grow makes per-section denominators move
(`web/achievements.js:666-712`).

---

## Open decisions

1. **Built-in courses editable, or your own decks only?** Everything above follows from
   this. Recommendation: editable, via the sibling layer.
2. **Anki-imported decks editable?** Refuse (small, but reaches almost nobody, since most
   imported decks are Anki decks), convert the deck to authored format 2 on first edit
   (one-way, loses the safe non-CommonMark constructs at `web/import.js:331-334`), or
   per-card overrides. This fork decides how big the feature is.
3. **Is markdown exposed, or is a card plain text like a note?** Plain text matches the
   notes ruling (`web/app.js:2048-2054`) and promises nothing. The subset costs one line
   of fineprint and a class of errors the app then owns.
4. **Does deck export ship in the same release?** Without it, hand-written cards exist in
   exactly one browser profile and the backup fineprint (`web/index.html:381-385`) is
   misleading.
5. **Does an edit ever reset scheduling?** Still open in §4b; default assumption no.
   Cheap now, expensive after people have edited.
6. **Undo.** §4b promises 30 days of reversibility. v1 with a `confirm()` and no undo is
   a smaller product than the brief, and undo changes the record shape, so it is decided
   before the first card is written, not after.
