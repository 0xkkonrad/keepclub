# Course schema v2 runtime migration audit

Prepared: 29 July 2026

Scope: runtime, Anki import, IndexedDB, origin migration, built-in builders,
service worker integration, and tests. This is an ownership map for phases 2–5
of `course-schema-v2-plan.md`; it does not change production behavior.

## Headline findings

- The browser runtime does not have a course-shape boundary today. `app.js`,
  validation, Anki conversion, import matching, IndexedDB handoff, and the
  retired-origin bridge all see format-1 objects directly.
- The static ratchet records **275 compact production accesses** in seven
  browser files. `web/app.js` owns 206 of them.
- A separate exact allowlist covers **45 occurrences** belonging to private
  HTML/template/search/undo/gesture shapes. They are not course objects. An
  edit to one is still reviewed because its source fingerprint must continue
  to match.
- The two built-in builders emit compact JSON directly. Competent Crew also
  emits the undocumented compact `r` provenance field on 60 cards.
- A back is structurally mandatory in `validateDeck()`, operationally mandatory
  in the Anki builder, and assumed by every Study and Browse presentation path.
- Progress data itself does not contain card bodies. It is keyed by card ID.
  That makes a read-time adapter viable, but only if every ID reaches `byId`
  unchanged.
- Progress backup/restore is course-shape agnostic except for the deck build
  stamp and the set of known IDs. The retired-origin bridge is not: it copies
  raw deck and media records and must permanently accept format 1.
- The service worker does not inspect card fields. It is affected by file names,
  validation timing, cache-generation ordering, and docs routing, not by the
  descriptive rename itself.

## Static baseline

`tests/course-runtime-shape.mjs` scans every production `web/**/*.js` file for
single-letter member, bracket, and emitted-property forms.

Excluded production paths:

- `web/lib/legacy-course.js`: the permanent format-1 compatibility boundary.
- `web/lib/vendor/**`: third-party implementation internals.

No test or fixture directory is scanned. Tests must be able to construct legacy
fixtures deliberately. Shipped JSON and Python builders are covered by the
phase-5 migration/identity test rather than this JavaScript runtime guard.

Current migration debt:

| File | Occurrences | Responsibility |
| --- | ---: | --- |
| `web/app.js` | 206 | schedule, achievements, Study, Browse, Progress, figures, video, boot |
| `web/lib/validate.js` | 39 | format-1 structural validation |
| `web/lib/deck.js` | 23 | Anki conversion and compact output |
| `web/munin.js` | 3 | legacy-origin media records |
| `web/import.js` | 2 | replacement matching and metadata |
| `web/lib/receipt.js` | 1 | compact receipt kind count |
| `web/lib/store.js` | 1 | compact imported-media index |
| **Total** | **275** | |

The field totals are `t` 48, `i` 46, `k` 34, `s` 31, `n` 31, `d` 28,
`f` 18, `q` 16, `m` 13, `a` 9, and `o` 1. The `r` provenance field is
present in generated built-in JSON but is not read by the browser.

The baseline is a fingerprint/count ledger, not a loose file count:

- a new expression fails even if an old expression was removed elsewhere;
- duplicating an accepted expression beyond its recorded count fails;
- moving an unchanged line does not create churn;
- a removal passes immediately;
- the baseline update command prints only what remains:

  ```sh
  cd tests
  node course-runtime-shape.mjs --print-current
  ```

`remaining` may only shrink. A genuinely unrelated private one-letter shape
must use an exact fingerprint under `allowedPrivateShapes` with a reason.

## Existing format-1 vocabulary

### Cards

| Key | Meaning today | Format-2 destination |
| --- | --- | --- |
| `i` | scheduling-stable card ID | `cardId` |
| `s` | section key | `sectionId` or derived default section |
| `q` | sanitized/rendered question HTML | `front` in the public artifact; one named rendered-front field internally |
| `a` | sanitized/rendered answer HTML | optional `back`; one named optional rendered-back field internally |
| `m` | built-in answer-side image filename | a descriptive media attachment |
| `d` | image `[width, height]` | `width` and `height` on that attachment |
| `f` | trusted labelled-figure specification | named declarative figure/media compatibility view |
| `r` | Competent Crew source-section provenance | descriptive provenance/extension or migration-only report data |

`f` contains another compact structure: `{n, on}` means figure name and lit
labels. It is trusted built-in presentation and cannot become a general
third-party escape hatch.

### Sections and groups

| Key | Meaning today | Format-2 destination |
| --- | --- | --- |
| `k` | stable key | `sectionId` / `groupId` |
| `t` | display title | `title` |
| `s` | group section keys | `sectionIds` |
| `n` | authored card count | derived `cardCount`, not artifact input |
| `o` | numeric ordering | array order, not artifact input |

### Other compact course-adjacent structures

- `videos.json` clip `f/t/d` means filename, description/title, and duration.
- imported-media record `i` is its storage index; origin migration preserves it.
- receipt kind `n` is a private count emitted by the Anki converter.
- achievement items use `t/d` for title and description, including course
  overrides. They should become descriptive in the runtime pass even though
  they are not card fields.

Private parser/search/gesture tokens are deliberately not part of this
migration. Their exact fingerprints are documented in the test baseline.

## Runtime ownership map

### Normalization and boot

Owner: compatibility adapter + runtime integrator.

Relevant paths:

- `web/app.js`: `boot()`, the `COURSE.deck` handoff, fetched `cards.json`,
  `validateDeck()`, `byId`, `sectionOf`, `groupOf`, history pruning.
- `web/munin.js`: `bootLocal()` and `startCourse()`.
- `web/lib/store.js`: `get()`.
- `web/lib/validate.js`: permanent v1 validation should move behind the adapter.

Required shape:

1. `store.get()` returns metadata plus a normalized descriptive course while
   leaving the stored record untouched.
2. Fetched built-in format 1 passes through the same `readCourse()` boundary
   before `app.js` sees it.
3. `app.js` receives only one normalized object shape.
4. `sourceFormat` and diagnostics remain available for receipts/debugging but
   are not consulted throughout the UI.
5. `byId` is built from `card.cardId`; history pruning still compares the same
   byte-identical IDs.

Do not normalize twice in two different layers. `store.get()` may call the
shared pure reader, while built-in fetch calls it directly.

### Scheduling and progress

Owner: runtime batch A.

Functions:

- `newBudget()`
- `byGroup()` / `counts()`
- `achContext()`
- `renderFrieze()`
- `buildSession()` / `aheadSize()`
- `nextDueLine()`
- `renderStats()`
- boot-time ID and section maps

Only identity and membership matter here. Rename reads mechanically:

- `card.i` to `card.cardId`
- `card.s` to `card.sectionId`
- `section.k/t/n` to `sectionId/title/cardCount`
- `group.k/t/s/n` to `groupId/title/sectionIds/cardCount`

Counts must come from normalized derivation, not copied author input. Schedule
records remain under the old `munin/...` localStorage keys and remain keyed by
the unchanged card ID.

### Study and front-only behavior

Owner: front-only UX batch after normalized runtime fields land.

Current assumptions:

- `showCard()` always writes `card.a`, always creates/hydrates `#card-a`, hides
  `#answer-wrap`, shows `#reveal-btn`, and focuses the reveal button.
- `reveal()` is the only path that marks `session.revealed`, displays grades,
  hydrates back media, starts a figure, renders video, and focuses the answer.
- `answer()` refuses every grade while `session.revealed` is false.
- Space/Enter reveals first and grades Good only after reveal; 1–4 are inert
  before reveal.
- `index.html` always contains an answer wrapper, rule, answer focus target,
  “Show answer”, and an initially hidden grade row.
- legacy built-in images, figures, and videos are answer-side presentation.

The implementation needs one derived predicate such as
`hasBackContent(card)`, covering back Markdown and every back-side attachment.
Do not use truthiness of one string once media is unified.

For a front-only card:

- do not render an empty rule, answer region, or “Show answer” control;
- show grade controls immediately with explicit self-assessment copy;
- make 1–4, mouse, and touch grading available;
- preserve Undo and the exact scheduling path after a grade;
- define Space/Enter deliberately. Reusing `session.revealed = true` makes one
  Space press grade Good; if a separate `gradeReady` state is introduced, all
  keyboard and held-key regression tests must follow it;
- put focus on a useful grade/control target and expose a live instruction to
  assistive technology;
- do not call `showAnswerRegion()`, focus `#card-a`, animate a hidden figure, or
  hydrate absent back media.

Backed-card behavior must remain byte-for-byte equivalent from the scheduler's
point of view.

### Browse and search

Owner: runtime batch B, integrated with front-only UX.

Functions:

- `indexDeck()`
- `scopeName()` / `scopeSections()` / `scopeTest()`
- `browseRow()`
- `renderBrowseIndex()` / `renderBrowse()`

Current assumptions:

- search always indexes `c.q + c.a`;
- answer text always supplies the result snippet;
- every Browse card is a `<details>` with `.browse-ans`;
- answer media/figure/lightbox controls live inside that answer container.

For an absent back:

- index front plus an empty back without materializing an empty string on the
  stored course object;
- omit answer snippets cleanly;
- do not create `.browse-ans`, an empty disclosure, or a meaningless toggle;
- keep section/state metadata reachable;
- allow front-side media to open independently;
- preserve search ordering and chunked indexing.

### Built-in figures, images, and video

Owner: media worker, after the card rename.

Functions:

- `clipsFor()`, `thumbHtml()`, `playerHtml()`, `renderCardVideo()`
- `figureSVG()`, `litFigure()`, `renderCardFigure()`, `openLightbox()`
- offline image prefetch in `renderOffline()`

Do not mechanically rename `m/d/f` to three unrelated card properties. Map
them into the unified descriptive media view. Preserve current hosted paths and
lazy-video behavior until the new view has equivalent tests.

The phase-2 runtime migration may temporarily expose named legacy views
(`legacyFigure`, for example), but they must be produced at normalization and
must not leak compact keys.

### Anki import and replacement

Owner: importer worker.

Paths:

- `web/lib/deck.js`
- `web/import.js`
- `web/lib/receipt.js`
- `tests/import.mjs`
- `tests/importer-ui.mjs`

`buildDeck()` currently:

- drops an Anki card whose rendered question is empty;
- tries the FrontSide fallback when the answer is empty;
- still drops the card if the resulting answer is empty;
- drops a card after missing-media cleanup if either side becomes empty;
- emits compact cards, sections, groups, and receipt counts.

The v2 behavior should keep a renderable front with no back as an intentional
front-only card. The receipt must distinguish:

- no back by design;
- an Anki template that rendered no back;
- back content lost because referenced media was missing/corrupt.

The last case must remain an error or explicit warning; it must not silently
turn loss into an intentional front-only card.

`import.js` replacement matching currently compares compact `i` values. Change
it to `cardId` only after `buildDeck()` returns format 2. Matching thresholds,
stable Anki IDs, atomic `store.put()`, and progress reset behavior must not
change in the same commit.

### IndexedDB, backup, and retired-origin migration

Owner: storage compatibility worker.

`web/lib/store.js` uses IndexedDB database `munin`, version 1, with separate
`decks`, `cards`, and `media` stores.

Required strategy:

- no database version bump merely for the shape rename;
- existing cards stay format 1 on disk;
- `get()` normalizes on read;
- new imports are stored as format 2;
- media keys `[deckId, index]` stay readable;
- replacement remains one transaction;
- no background/bulk rewrite is required.

Progress export/restore in `app.js` stores state, not the course. It depends on:

- unchanged `COURSE.id`;
- unchanged card IDs;
- `DECK.build` becoming a descriptive derived build fingerprint;
- `byId.has(id)` continuing to filter old-card history.

`importLegacyPayload()` in `munin.js` copies raw imported records and media from
the retired origin. It must accept format 1 forever and write the copied record
without data loss. The next `store.get()` normalizes it. Do not require the old
origin to understand or emit format 2.

### Builders and generated built-ins

Owner: built-in migration worker, after the runtime reader ships.

Paths:

- `content/mdc.py`
- `content/day-skipper/src/web_build.py`
- `content/competent-crew/src/build.py`
- `scripts/refresh-courses.sh`
- `web/courses/*/cards.json`

`mdc.py` already represents authoring concepts descriptively in Python
(`key`, `title`, `order`, `q`, `a`, `img`, `fig`, `ref`) but compiles every
non-pointer body into an answer. Empty bodies become empty output and are
ultimately rejected by the v1 validator.

Migration requirements:

- omit `back` when the compiled body is empty;
- preserve the existing front-derived IDs and every pinned ID;
- preserve pointer resolution;
- map image/figure/provenance fields descriptively;
- remove authored counts/order from emitted course artifacts;
- produce an identity/content/membership/media report before replacing
  `cards.json`;
- account explicitly for Competent Crew's 60 `r` provenance values.

Do not modify `refresh-courses.sh` until the new generated output is accepted by
the already-landed reader.

### Service worker and deployment seam

Owner: PWA integration reviewer.

`web/sw.js` names `course.json`, `cards.json`, `figures.json`, `videos.json`,
and optional presentation assets. It validates response status/MIME and swaps
course cache generations transactionally, but does not inspect card fields.

Keep:

- cache family names;
- required-course file names during this migration;
- transactional generation behavior;
- old-reader/new-content rollout order.

Add only the tests needed to prove that a v2 content generation cannot be
paired with old code and that `/docs/` is outside inappropriate app handling.

## Test ownership and sequence

Recommended integration batches:

1. **Reader gate:** legacy adapter tests, 737-ID proof, store/fetch normalization.
2. **Scheduling core:** identity, membership, queue, achievements, stats.
3. **Study core:** descriptive front/back with all existing backed-card tests.
4. **Front-only:** text and media prompts, keyboard/touch/focus/Undo.
5. **Browse/search:** no empty answer DOM, snippets, scopes, large-deck yield.
6. **Importer/storage:** Anki format 2, re-import matching, read-time v1,
   backups, mirror migration.
7. **Media:** named attachment views and offline/lazy behavior.
8. **Built-ins:** generated format 2 plus ID/content/membership/media report.

Existing suites that directly encode compact fields:

- `tests/import.mjs`
- `tests/importer-ui.mjs`
- `tests/qa-regressions.mjs`
- `tests/pwa.mjs`
- `tests/separation.mjs`
- `tests/shell-and-courses.mjs`

Update those assertions in the same batch as their production consumer. Keep
format-1 fixture assertions in the legacy adapter suite.

The current test harness is plain executable scripts with no `skip`/`todo`
facility. A pending front-only browser suite would either fail the branch or
silently not run, so this audit does not add one before production support.
When the normalized model lands, add an executable Playwright case that proves:

- no reveal or empty answer DOM for front-only text;
- immediate accessible grading;
- 1–4, Space/Enter policy, touch, and mouse;
- Undo;
- identical scheduled record shape after grading;
- Browse/search without empty disclosures;
- front-side image, audio, and video;
- backed cards retain two-step reveal behavior.

## Release blockers

- Any compact course access outside `web/lib/legacy-course.js`.
- Any change to a built-in/imported card ID.
- `store.get()` mutating or rewriting an existing record.
- An empty/lost back being treated as intentional without a diagnostic.
- Partial import or replacement.
- Front-only cards presenting an empty reveal.
- A v2 generated `cards.json` reaching a deployed old reader.
- Renaming storage keys, cache families, manifest ID, runtime files, or course
  file names as part of this migration.
