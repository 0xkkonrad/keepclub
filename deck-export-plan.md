# Exporting a deck — scope

Written 31 Jul 2026 against `93320b2`, on `feat/deck-export`. Nothing here is built.

This is the feature the card-authoring release closes on: *"Making the promise true is a
deck exporter, which is a feature and not a wording, and it is the obvious next thing this
release asks for"* (`card-authoring-plan.md:436`). Cards someone writes live in
`munin/<id>/cards/v1` (`web/munin.js:36`) and in the backup file, and nowhere else. For a
deck they created here, the deck's own cards live in IndexedDB under an id minted on the
device (`web/import.js:460-527`) and **no file holds them at all** — the backup is stamped
`munin/<course id>` (`web/app.js:86`) and refused by any other deck.

**One direction only.** This release writes files. It does not change what the importer
reads, and it deliberately produces nothing the importer cannot already take: the format
is `.keep.yml`, the reader is the one already on the boot path, and the round trip is
gated by a test rather than asserted.

---

## What ships

- **A course file from any deck**, written on the device, in the documented format
  (`schema/course-v2.md`), valid against the shipped reader.
- **Two shapes**, decided by the deck rather than by a control: the whole deck, or the
  cards you wrote and changed. Which one this deck can honestly produce is said on screen
  before the button, and the file says which one it is on its second line.
- **A file a person can read.** Block scalars, one card per stanza, a comment header
  naming what this is — the format is human-readable and that is the feature.

Explicitly not in this release: `.keep` packages (media), exporting review history in any
form, exporting notes, importing an export as an update to the deck it came from, and any
change to how the importer matches a file to a deck. See *Settled* below for each.

---

## Settled decisions

| | Ruling | Why |
|---|---|---|
| What decides the shape | **The deck's stored content representation, not its provenance** | Three deck types is the person's taxonomy; the code has four documents. A deck exports whole only when its stored document is authored CommonMark and references no packaged asset. Everything else exports the layer. |
| Built-in courses | **Your cards and your overrides only** | Both reasons hold and either would be enough: the course is its author's work, and `boot()` never keeps the authored document to write back — `rawCourse` is local to it and only the rendered `shippedCourse` survives (`web/app.js:6868-6902`). |
| Anki imports | **Your cards and your overrides only** | Their stored document is format-1 sanitized HTML (`web/lib/legacy-course.js:494-551`). Re-authoring it as CommonMark runs every card through `htmlToCardSource()`, which reports what it cannot carry rather than dropping it (`web/app.js:3417-3498`) — and what it cannot carry includes every picture. The `.apkg` is still on their disk; the cards they wrote are not. |
| `.keep` / `.keep.yml` imports and decks you created | **The whole deck, unless it carries assets** | `readCourseFile()` stores `parsed.value` — the exact authored document (`web/lib/course-package.js:583-590`), so this is a copy rather than a conversion. |
| A deck carrying media | **Layer only, and say the number** | A `.keep.yml` is text. Emitting the document with its `media` blocks intact produces a file that fails `validateAssets` on the way back in (`schema/course-v2.md:131-133`); stripping them silently mutilates the deck. There is always still something to get — the cards a person writes have no media (`card-authoring-plan.md:32`). |
| Format | **`.keep.yml`, v2, nothing else** | It is what the importer reads (`web/import.js:28`, `web/lib/course-package.js:487-495`), what the docs teach, and what `schema/course-v2.md` specifies. A private export format would be a second thing to keep in step with the reader. |
| Media in v1 | **No, with a named reason** | There is no ZIP writer in this repo — `web/lib/unzip.js` only reads — and a `.keep` writer is CRC32, local headers, a central directory and a memory story for a 250 MiB archive. That is a feature, not a corner of this one. |
| Review history in the file | **Never** | *"Course artifacts contain content and presentation, never scheduling state"* (`schema/course-v2.md:54`). The backup already carries it and is the only thing that should. |
| The exported `courseId` **and title** | **The deck's own when nothing of yours is in the file; `<courseId>.yours` and `<title> — with your cards` when something is** | A course id is the author's claim on the course. A file with your cards folded in is no longer only theirs — and keeping the id is actively dangerous: the next genuine update from the author matches on `sourceCourseId` (`web/import.js:756-771`) and rewrites the whole deck record (`web/import.js:810-828`), deleting every card you had folded in, silently. **Amended after the build:** the id alone does not do it. `match()` falls back to the title (`web/import.js:772-778`), and that fallback is the destructive one — "a different deck under the same name" clears the state document and the layer. A fork has to differ in both. |
| Re-importing your own export | **A file with your cards in it, a second deck. A plain copy of a deck you imported, an update to it.** | ~~It follows from the ruling above and needs no importer change.~~ **Amended after the build:** it did not follow, and the flat promise on screen was false twice. A file with nothing of yours in it keeps the deck's `courseId` and *is* that course, so it takes the update path — which keeps everything and is the right answer; the fineprint says so rather than denying it. A file with your cards in it is a different course and lands as a second deck, which the title fork above is what delivers. A deck you created is excluded from replacement either way (`web/import.js:755`). |
| Written card ids | **`u.` stripped, deterministically** | `u.` ids are refused outright by the reader, for cards *and* for sections (`schema/course-v2.md:46-48`, verified: `course.reserved_id` at `$.cards[0].cardId` and `$.sections[0].sectionId`). `newCardId()` mints `u.` + 12 hex (`web/app.js:2438-2442`), so `id.slice(2)` is already a valid id under `COURSE_CARD_ID` (`web/app.js:79`) and cannot collide with the ten-hex ids the courses ship. Deterministic so two exports of one deck name the same cards. |
| Override card ids | **Kept exactly** | They are the course's own ids and ids are opaque by contract (`schema/course-v2.md:44-45`). Keeping them is what lets a person diff their file against the course they came from. Nothing bleeds: a separate deck is a separate state document (`web/munin.js:28`). |
| Where it lives | **Progress, its own section under Backup** | Below. |
| Who validates | **The reader, before the file is written** | `web/lib/validate.js` is the standing note about the last hand-written second validator. The exporter builds a document and runs `readCourse()` over it; a document that will not validate is not downloaded. |

---

## 1. What can be exported

### The taxonomy the code actually has

Three deck types is the person's view. The seam that decides what can be written is the
**content representation of the stored document**, and there are four:

| Deck | Stored document | Representation | Whole deck? |
|---|---|---|---|
| Built-in course | `courses/<id>/cards.json`, fetched at boot and not retained (`web/app.js:6872-6877`) | compact format-1, sanitized HTML, plus `figures.json`, `img/`, `videos.json` (`schema/legacy-v1-mapping.md:11-46,72-83`) | **No** |
| `.apkg` import | `rec.deck` = `projectDescriptiveCourseToLegacy(...)` (`web/import.js:681-701`) | format-1, sanitized HTML, `munin-media:<n>` inside the HTML (`schema/legacy-v1-mapping.md:42-44`) | **No** |
| `.keep` / `.keep.yml` import | `rec.deck` = `result.authoredCourse` (`web/import.js:637-651`) | **authored CommonMark, v2** | **Yes**, unless it references assets |
| Deck you created | `rec.deck` = the one-card document as typed (`web/import.js:167-176, 526`) | **authored CommonMark, v2** | **Yes** |

`RUNTIME_SOURCE_FORMAT` is already the discriminator: it is set from the reader on every
boot (`web/app.js:143, 6860`) and `course-v2` means authored CommonMark, `legacy-v1` means
sanitized HTML. The exporter reads it and asks one more question — does the document
reference a packaged asset — and that is the whole decision.

### What each file contains

**Layer export** (built-in, Anki, any deck carrying assets):

- every live written record — `CARD_ID.test(id) && rec.front` (`web/app.js:2734-2736`), id
  `u.`-stripped, `front`/`back` as the Markdown that is stored;
- every live override — a record under a shipped id with a `front` — under the shipped id,
  with the Markdown that is stored;
- nothing else. No `sections`, so all of it lands in the generated `all-cards` section
  (`schema/course-v2.md:72`). The course's section titles are the course's structure, and a
  file declaring three of a course's twelve sections is a skeleton of somebody else's work
  for no gain.

Hides are not in it: a hide is an emptied record (`web/app.js:3094-3107`) and a course file
has no way to say "not this card of a course I am not shipping". Deletes are not in it for
the same reason. This is the one place the file is quieter than the layer, and the
guarantee in §3 says so.

**Whole-deck export** (v2-authored decks with no assets):

- the stored document, key for key, minus its own `extensions['app.keepclub/export']` if a
  previous export left one there;
- with hidden cards removed, overrides applied over the card's `front`/`back` in place, and
  written cards appended — the merge `cardsWithLayer()` already performs, in the order it
  already performs it (`web/app.js:2702-2754`);
- with a section added only when a written card needs one (below).

### The honest residue, written down

An override is the Markdown in the box at the moment of Save. For a card someone rewrote,
that is their sentence. For a card someone fixed one word of, it is the course's sentence
with one word fixed — the first fill writes the shipped card back out through
`htmlToCardSource()` (`web/app.js:3676-3685`), so most of those characters came from the
course. Konrad's steer takes overrides, and it is right to: it is the text stored under
that person's hand, in their document, and refusing to give it back would make an edit the
one thing in the app you cannot get out. But the file is not free of the course, and the
line above the button does not pretend it is.

The second residue: on a built-in course the two RYA decks share card ids deliberately
(`content/competent-crew/src/build.py:19-22`), so an override exported from Day Skipper
carries an id Competent Crew also uses. Nothing follows from it — the file's `courseId` is
`day-skipper.yours` and a deck imported from it is its own state document — and it is
recorded here so the next reader does not find it and think it is a bug.

---

## 2. The format

**`.keep.yml`, schema version 2, valid against `schema/course-v2.schema.json`.** Written
with the vendored `yaml` 2.9.0, which is already precached in the shell (`web/sw.js:132,
134`) and already loaded on the `.keep` import path, and which exports `stringify` and
`Document` alongside the parser the reader uses.

Verified end to end against the real reader, not asserted:

```
readCourseFile(text, {fileName: 'day-skipper.yours.keep.yml'})
  → course? true   sourceKind keep-yaml
  → warning course.missing_description  $.description
  → warning metadata.missing_attribution $
```

Four emitter rules, each of them a refusal I reproduced rather than a precaution:

1. **`aliasDuplicateObjects: false`.** The reader refuses any anchor or alias outright —
   `document.disallowed_anchor` (`web/lib/course-yaml.js:216-231`) — and `stringify`
   emits them by default for any repeated object reference.
2. **Never emit `undefined`.** `{groups: undefined}` fails as `field.invalid_type — Course
   values must be JSON-compatible data`. Omit the key.
3. **Never emit a blank optional.** `back: ''` parses but warns
   (`schema/course-v2.md:36-41`); omit `back` when the card has none, which is also what
   makes a front-only card front-only.
4. **`lineWidth: 0`.** Default folding rewraps long plain scalars, and a Markdown hard
   break is two trailing spaces (`web/app.js:3435`). At width 0 with block scalars, a card
   with a hard break round-trips byte for byte — checked.

**The two warnings above are expected and are not bugs.** `course.missing_description`
fires on any document without one; `metadata.missing_attribution` fires without `authors`
or `source` (`web/lib/course.js:483-487`), and keep club does not know who is at the
keyboard. Inventing an author claim to silence a warning is the worse outcome. They land
under *worth checking* in the receipt (`web/lib/receipt.js:210-215`), which is where a
warning belongs. Where the source document already carries `authors`, `license` or
`source`, the whole-deck export carries them through untouched and neither warning fires.

**Media is out of scope, and a media-carrying deck is not refused.** The whole-deck export
is withheld and the layer export offered in its place, with the count of pictures as the
reason. The alternatives were both worse: a `.keep.yml` naming assets that are not beside
it produces a file that fails on the way back in, and stripping the `media` blocks is the
silent picture-deletion the card release spent a whole ruling preventing
(`web/app.js:3500-3510`).

---

## 3. Round trip

### What the importer does with ids it has seen before

`match()` never looks at card ids for a `.keep` file. It matches on
`sourceCourseId === built.sourceCourseId` (`web/import.js:756-771`), then falls back to the
title (`:772-778`); the card-overlap heuristic below that is reachable only for Anki
imports (`:779-792`). So:

- **A built-in course is not in `store.list()`** and can never be matched. A file exported
  from Day Skipper always lands as a new local deck, whatever ids are in it.
- **A file with the deck's own `courseId` is an update**: same deck, progress kept, and the
  layer kept — deliberately, because that is what makes an override survive a course update
  (`web/import.js:849-856`).
- **A file with a different `courseId` and the same title** is *"a different deck under the
  same name"*: the start-over path, which clears the state document and the layer
  (`web/import.js:840-867`), and says so before the button (`web/lib/receipt.js:266-274`).

This is why the `.yours` suffix is not cosmetic. Had the whole-deck export kept the
original `courseId`, re-importing it onto the deck it came from would take the update path,
which keeps the layer — so every written card would be in the deck twice, once as a card
of the document and once from the layer, and every override would have a `was` fingerprint
of a card that had just been replaced by the override's own text, firing *"The author
rewrote this card after you edited it"* on every one of them
(`web/app.js:3136-3141, 4614-4619`). And it would have been worse in the friend's hands:
the deck's real author ships v2, `match()` recognises it, `store.put` rewrites the whole
record, and the fourteen cards folded into the fork are gone with no sentence anywhere.

### What survives

| | Survives |
|---|---|
| Card text, both sides | **Yes**, exactly — Markdown out, Markdown in, checked byte for byte including hard breaks |
| Card ids | **Yes** for overrides and for a whole deck; **derived** for written cards (`u.` stripped), stable across exports |
| Sections, groups, theme, licence, authors | **Yes** on a whole-deck export; **not emitted** on a layer export |
| Review history | **No.** Course files never carry it (`schema/course-v2.md:54`) |
| Notes | **No.** They are not course content |
| Hides and deletes | **No.** A file cannot say "not this card" about a course it does not ship |
| The `was` fingerprint | **No.** It is an answer about a course card this file is not shipping |

**The guarantee, in one sentence:**

> Every card in a file keep club writes comes back word for word and under the same id, and
> nothing else in it does — a course file carries no review history, no notes, and no
> record of what you hid.

### An override whose card the course has since dropped

`liveCardCount()` already refuses to count an override with no shipped card under it
(`web/app.js:2473-2488`), and the export counts through the same function, so such a record
is neither counted nor exported. That is the right answer and it is the existing one: it is
in no list, Browse cannot draw it, and a file is not the place to resurrect it.

---

## 4. Where it lives

**Progress, its own section, directly under Backup.** Not the shelf and not Browse.

- **The shelf is expensive and duplicative.** `localTile()` runs in `munin.js` over the
  picker, where no course is open, `app.js` is not loaded, and the deck's document is not
  in memory (`web/munin.js:1366-1387`). Everything the exporter needs — the layer, the
  reader, the YAML writer, the merge — would have to be reached a second way from there.
  The shelf already reads the layer by hand for one integer and comments on why
  (`web/munin.js:1345-1364`); a whole export is not that. Built-in courses have no shelf
  control at all beyond opening them.
- **Browse is the wrong screen.** It is where you write a card, correctly
  (`web/index.html:241-247`), but its action row already carries seven controls and export
  is not a browsing act.
- **Progress already holds every "getting this off the device" facility** — Sync, Backup,
  Erase — and it is the screen the deck-creation copy already points at
  (`web/import.js:564-566`).

**It must not read as a second Backup, so the copy leads with the difference.** Backup is
this deck's history going back into this deck on this device (`web/index.html:398-404`); a
deck file is the cards, going anywhere.

```html
<h2 class="h-sect">Deck file</h2>
<p class="fineprint">
  A backup goes back into this deck on this device. A deck file is the cards themselves,
  in the format keep club reads and writes, so it opens on another device, in another
  browser, or in a text editor. It carries no review history and no notes: course files
  never do. Importing one is not a restore. A file with your cards in it comes back as a
  second deck. A file that is only the deck as it came in is the same course, so importing
  it here updates this deck instead.
</p>
<p class="backup-state" id="deck-file-state"></p>
<div class="btn-row"><button class="ghost" id="deck-export-btn"></button></div>
```

`#deck-file-state` is rendered by a `renderDeckFileState()` beside `renderBackupState()`
(`web/app.js:5041-5075`) and re-rendered from `renderDeckChanged()` (`web/app.js:2907-2923`)
so the count moves the moment a card is written, like every other derived number.

---

## 5. The copy

**The control**, which is the short version of what you are getting:

- `Export this deck` — whole-deck export.
- `Export the cards you wrote` — layer export.

**While working**: the button's own label, disabled, `Writing the file…`. No spinner and no
progress bar — a bar with nothing behind it is worse than a word, and the only deck big
enough to need one is the Anki import, which never takes this path.

**`#deck-file-state`**, the line that says what the file does and does not hold. One per
case, with the reason before the consequence:

- built-in — *A file now would hold the 14 cards you wrote and the 3 of this course’s that
  you changed. Day Skipper’s own cards are its author’s work, so they stay here.*
- Anki import — *A file now would hold the 14 cards you wrote and the 3 you changed. The
  rest came out of an Anki file and keep club keeps it as it was drawn rather than as it
  was written, so it cannot be written back out. The .apkg you imported is still that
  copy.*
- any deck carrying media — *A file now would hold the 14 cards you wrote and the 3 you
  changed. The deck’s own cards carry 37 pictures, and a course file written here is text
  only.*
- whole deck, nothing of yours in it — *A file now would hold all 212 cards in this deck,
  exactly as they came in.*
- whole deck, with your cards in it — *A file now would hold all 212 cards in this deck:
  the deck’s own, and the 14 you have written or edited. It goes out under a course ID of
  its own, so that an update from the deck’s author can never replace it and take yours
  with it.*
- a deck you created — *A file now would hold all 212 cards in this deck. It is the only
  file that does: a backup holds what you have answered and what you have written, never
  the deck.*
- nothing of yours yet, layer case — *You have not written or changed a card in this deck
  yet, so there is nothing of yours to put in a file. Browse is where you write one.*
- appended where the source names an author or a licence — *This deck is Jane Roe’s work,
  under CC BY-SA 4.0. The file carries that with it.*

**The receipt afterwards**, one non-sticky toast in the shape the backup toast already uses
(`web/app.js:6353-6362`), naming the file because the next thing a person does is look for
it:

- *Exported the 17 cards you have written or edited, as
  `rya-day-skipper-cards-you-wrote.keep.yml`.*
- *Exported all 212 cards in this deck, including the 14 you wrote, as
  `knot-basics-with-your-cards.keep.yml`.*

**Amended after the build:** the name is the slug of the file's own title and carries no
suffix of its own. Both files that are not the author's course say so in that title already,
and the `.yours` the plan first put in the name was the one thing that let a fork of a fork
come back out wearing the author's own filename.

**The refusals**, each naming the cause and the way out:

- *You have not written or changed a card in this deck, so a file of your cards would be
  empty. Browse is where you write one.* — the button is never disabled, for the reason
  `Write a card` is never hidden (`web/index.html:243-246`).
- *The cards you wrote into this deck could not be read, so a file made now would be
  missing them. Nothing was exported.* — when `cardLayerLoaded` is false
  (`web/app.js:2615-2644`). **This one is the important refusal**: exporting over an
  unreadable layer writes a file that silently omits everything the person wrote, and the
  file then looks like proof there was nothing there.
- *This browser will not let keep club hand you a file. Some in-app browsers block
  downloads; opening keep club in your own browser will work.* — when
  `URL.createObjectURL` is missing, the guard `web/share.js:367-372` already makes.
- *keep club could not write a course file from this deck, so nothing was downloaded.
  `<message> <correction>`* — the reader's own words, the shape the sheet and the importer
  both print (`web/app.js:3529-3535`, `web/import.js:486-491`). Reaching this is a bug in
  the exporter, which is exactly why it is a sentence and not a thrown error.
- Not a refusal, a caveat, sticky: *That file is 6.4 MB. keep club will not read a course
  file over 5 MB back in, so it will open in a text editor but not in this app.* — the file
  still downloads. `COURSE_YAML_LIMITS.inputBytes` is 5 MiB (`web/lib/course-yaml.js:8-14`),
  and withholding somebody's own words over a limit of ours is not on. **Amended after the
  build:** the gate above this one has to move out of the way for it, or this caveat can
  never fire. `readCourseFile()` refuses the bytes before it parses them, so over the
  ceiling its verdict is a foregone `limit.input_bytes` and the export took it for a bug in
  itself and withheld the file — which is the opposite of the ruling, on the one deck whose
  cards have no other copy. Over the ceiling the gate is `readCourse()` over the document,
  which is the same reader without the input bound in front of it.

---

## 6. The file

**Name: the slug of the file's own title, capped at 60 characters, then `.keep.yml`**;
the `courseId` when the title slugs to nothing. `isKeepFile()` accepts any name ending
`.keep.yml` (`web/import.js:28`), so the name is free to be for the human.

- `rya-day-skipper-cards-you-wrote.keep.yml`
- `knot-basics.keep.yml`

Not the `courseId`, which the backup uses (`web/app.js:6344`): for a deck someone created
that is `local-mfx3k2a1`, which tells a Downloads folder nothing. The identity is on line 2
of the file, where the format puts it. **No date in the name.** The backup is a snapshot of
a moving thing and is dated for it; a course file is content, and dating it invites the
belief that the format tracks versions when the id is what does. Two exports in a day are
then byte-identical, which is a property worth having.

**Open in a text editor, this is the whole file:**

```yaml
# Cards you wrote in keep club, from RYA Day Skipper.
# 14 you wrote, 3 of the course's that you changed. Exported 31 July 2026.
# There is no review history in here: keep club course files never carry any.
# The format: https://keepclub.app/docs/

schemaVersion: 2
courseId: day-skipper.yours
title: RYA Day Skipper — cards you wrote

cards:
  - cardId: 4a1c9e2b31
    front: What shape does a vessel at anchor show?
    back: |-
      One **black ball**, forward, where it is best seen.
      By night, an all-round white light.

  - cardId: a1b2c3d4e5f6
    front: Which way does the tide set through the Swinge?

extensions:
  app.keepclub/export:
    kind: your-cards
    from: day-skipper
    exportedOn: '2026-07-31'
```

Every part of that is checked:

- **The comment header.** Comments are not nodes, so the reader neither sees nor objects to
  them, and `YAML.Document.commentBefore` puts them there. It is the only part of the file
  that can say what it is in a sentence, and it is the part a person reads first.
- **Block scalars for anything with a newline**, plain scalars otherwise, quotes only where
  the value would otherwise change meaning. The vendored `stringify` chooses this itself and
  round-trips identically, trailing hard-break spaces included.
- **A blank line between cards**, set with `spaceBefore` on each item after the first. It is
  how the docs' own example reads (`schema/course-v2.md:14-24`) and it is the difference
  between a file you can scan and a wall.
- **Key order is emission order**: `schemaVersion`, `courseId`, `title`, then the metadata a
  whole-deck export carries through, then `sections`/`groups` where there are any, then
  `cards`, then `extensions` last — machine noise at the bottom.
- **`extensions['app.keepclub/export']`** passes `normalizeExtensions` (`web/lib/course.js:
  305-324`); the reverse-domain-with-path key was checked against the real validator. It is
  the only machine-readable statement that this file is not the author's own, and it
  survives an import, which is why the exporter **replaces** any it finds in the source
  document rather than leaving a stale claim from an earlier export.
- `exportedOn` is a date, not a timestamp. It is going into a file somebody may hand to
  another person; the day is the useful part and the clock is not.

---

## 7. The seven things that will bite

1. **A written card cannot keep its id, and a section cannot either.** `u.` is refused for
   `cardId` *and* for `sectionId` — I reproduced both. So the export must strip the prefix
   from every written card, and `LOOSE_SECTION` (`web/app.js:83`) — literally `u.loose` —
   can never appear in a file. A whole-deck export whose written cards have no live section
   must declare one of its own, `cards-you-wrote`, and if the source document declares
   groups it must also declare a group for it: an ungrouped section is
   `group.ungrouped_section`, and a group with `title: ''` is `field.empty`. Both
   reproduced. `applyCardLayer()` does exactly this in memory today with an empty group
   title (`web/app.js:2766-2777`) — that shape is legal in `DECK` and illegal in a file.
2. **A huge deck blocks the main thread.** The layer is bounded at `WRITTEN_LIVE` = 200
   (`web/app.js:54`), so a layer export is small by construction. A whole-deck export is
   bounded only by the 50,000-card format ceiling (`schema/course-v2.md:174`). Build it the
   way `indexDeck()` already handles the same problem — yield every 500 cards
   (`web/app.js:4407-4421`) — with the button disabled and reading `Writing the file…`.
3. **It writes nothing, and that settles the lease question.** Export reads `COURSE.deck`
   and `cardLayer`, both already in memory, and touches neither. It needs no
   `refuseForeignWrite()` (`web/app.js:453-474`), no `writeNow()` flush — the backup needs
   one because `state` is debounced; the layer is written synchronously on every commit
   (`web/app.js:2874-2882`) — and no study lease. **Export during an open session is
   allowed.** It must *not* re-read the layer first: `loadCardLayer()` mid-session would
   replace `cardLayer` without the `applyCardLayer()` that keeps `DECK` in step, which is
   the one thing the storage listener already refuses to do while a session is open
   (`web/app.js:601-614`). The file is what this tab is showing, which is the only thing it
   can honestly be.
4. **Quota is not a risk; memory is a small one.** Nothing is stored, so there is no quota
   path and no `store.put` — which matters, because `put` clears a deck's whole media range
   before writing (`web/lib/store.js:86-100`) and the card release had to write that
   warning in capitals (`web/import.js:497-505`). The exporter never calls it. Peak memory
   is the YAML string plus the Blob, roughly twice a document already bounded at 5 MiB.
5. **The download mechanics already exist twice.** `web/app.js:6341-6348` — Blob, anchor,
   `download`, click, revoke after 4s — is the sibling twenty lines above the new button and
   is the shape to copy. `web/share.js:367-388` is the hardened version, and the one thing
   worth taking from it is its guard: it returns false rather than throwing when
   `createObjectURL` is missing. MIME type `text/yaml;charset=utf-8`, which is what the
   app's own file input already names (`web/index.html:312`).
6. **The file invites three wrong beliefs, and each needs a sentence.** That it is a
   backup — answered by the fineprint's first line. That importing it restores this deck —
   answered by its last. That it holds what you have answered — answered in the middle, and
   again by the comment header inside the file, because the file outlives the screen.
7. **Handing on somebody else's course.** A whole-deck export of an imported `.keep` course
   is that author's content in a file with no keep club claim on it. Where the source
   document carries `license`, `authors` or `source` they are carried through untouched and
   the state line names them. Where it carries none, the app says nothing rather than
   inventing something — but it also never offers a whole-deck export of a built-in course,
   which is the only content in the app whose author is us.

---

## Work breakdown

Roughly in dependency order.

1. **The document builder**, in a module of its own — `web/lib/course-export.js`, beside the
   reader that will check it. Pure: deck document plus layer in, v2 document out, no DOM and
   no storage. Both shapes, the id rules, the synthetic section and group, the metadata
   carried through, the `extensions` block replaced rather than appended.
2. **The emitter**: `YAML.Document`, the comment header, `spaceBefore` between cards,
   `{lineWidth: 0, aliasDuplicateObjects: false}`.
3. **The gate**: run the emitted text back through `readCourseFile()` before it reaches a
   Blob, refuse in the reader's words if it does not come back clean.
4. **The screen**: the Progress section, `renderDeckFileState()`, the label and state line
   per case, the download, the toast, the four refusals, and the re-render hook in
   `renderDeckChanged()`.
5. **Docs**: one paragraph in `web/docs/index.html` saying the app writes this format as
   well as reading it, and what an export is not.

## Tests

- **`deck-export.mjs`**, new, on `authoring.mjs`'s shape: a built-in course with written
  cards and overrides exports a file, that file imports, and the cards come back word for
  word under the same ids; hard breaks, ordered-list-looking questions
  (`web/app.js:3407-3411`) and emoji survive; a written card's id loses `u.` and keeps its
  value across two exports; a deck with nothing of yours refuses in the stated words; an
  unreadable cards document refuses rather than exporting a short file; a whole-deck export
  of a created deck round-trips every card including the one in the deck's own document.
- **`importer-ui.mjs`**: an export re-imported lands as a second deck and never as an update;
  a whole-deck export of a media-carrying deck is not offered, and the layer export of the
  same deck is; the receipt's warning list holds the two expected warnings and no errors.
- **`course-schema-v2.mjs`**: a gate that no emitted document can carry a reserved id in
  `cardId` or `sectionId`, and that the emitter never produces an anchor, an alias, an
  `undefined` or a blank optional.
- **`qa-regressions.mjs`**: exporting during an open session neither ends it nor changes
  `DECK`, and the button is refused by nothing.
- **`docs-site.mjs`**: the new paragraph's example, if it gains one, validates like every
  other example on that page.

---

## Where this argues with the steer

**One disagreement, one refinement.**

- **Anki imports do not export whole.** The steer was *"for decks they imported or created
  export the whole deck"*. An `.apkg` import is stored as format-1 sanitized HTML
  (`web/lib/legacy-course.js:494-551`), so writing it as a `.keep.yml` means running every
  card through the down-converter the card sheet uses one card at a time — the one whose
  entire design is that it *names* what it cannot carry rather than dropping it
  (`web/app.js:3379-3383`), and what it cannot carry starts with every picture in the deck.
  The stronger argument is the one the release itself makes: the exporter exists because
  written cards have no other copy. An Anki deck has one — the `.apkg` the person imported
  is still on their disk. So the Anki case sits with the built-in case, and the layer is
  what comes out.
- **A deck carrying media does not export whole either**, for the same class of reason:
  there is no ZIP writer, and a `.keep.yml` naming assets that are not beside it is a file
  that fails on the way back in. This narrows "decks they imported" further, and it is why
  the ruling is written against the stored representation rather than against where the
  deck came from — provenance and representability agree in three cases out of four and the
  fourth is the one that would have shipped a broken file.

The steer on built-in courses is taken exactly as given, and the code turned out to agree
with it twice over: `boot()` does not even keep the document that would be needed
(`web/app.js:6872-6877`).
