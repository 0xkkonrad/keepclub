# keep club course schema v2 — implementation plan

Status: proposed implementation plan

Branch: `feat/course-schema-v2-plan`

Prepared: 29 July 2026

## Outcome

Ship one public, human-readable course contract that a person or external tool
can produce without using a keep club editor.

A course may be as small as:

```yaml
schemaVersion: 2
courseId: daily-prompts

cards:
  - cardId: plan-tomorrow
    front: Write down tomorrow's three priorities.

  - cardId: recall-the-day
    front: Recall three things you learned today.
```

That is a complete course. It receives keep club's default title treatment,
tower identity, colors, section, loading state, achievements, and other
presentation. A back is optional; front-only cards are self-graded.

The same contract may optionally add descriptions, sections, tags, images,
audio, video, authorship, licensing, source links, theme fields, and other
course presentation.

## Decisions carried into implementation

1. **One course schema.** There is no deck layer below a course and no themed
   course layer above it. Optional enrichment does not change what the object
   is.
2. **Structured YAML is the canonical authored artifact.** `front` and `back`
   values contain a documented CommonMark subset. Text-only courses use
   `course.keep.yml`; courses with files use a `.keep` ZIP containing that
   same file and relative media.
3. **Names are descriptive throughout.** Format 2 replaces runtime
   `i/s/q/a/m/d/f` and `k/t/n/o` vocabulary with readable parameters. Compact
   format 1 remains accepted only by a compatibility reader.
4. **Stable identity is required.** `schemaVersion`, `courseId`, `cards`,
   `cardId`, and a renderable front are the minimal structural core. `back` is
   optional.
5. **Absence gets a default; malformed emptiness does not.** Optional fields
   should normally be omitted. Empty identities are errors. Empty collections
   may normalize to omission. An empty back normalizes to an absent back with
   a quality warning.
6. **One record is one review card.** Reverse and cloze generators emit
   concrete review cards with their own IDs. The runtime does not execute
   arbitrary card templates.
7. **Sections are optional; tags are independent.** No section means one
   generated "all cards" section. Counts and ordering metadata are derived.
8. **Media is explicit and may be image, audio, or video.**
9. **Validation has three levels:** schema, cross-field/asset semantics, and
   non-blocking quality advice. Errors block installation atomically; warnings
   may proceed after preview.
10. **Known fields are strict.** Intentional third-party data lives under
    namespaced `extensions`.
11. **Authorship/source fields are optional for local use.** Publication may
    require attribution and a license.
12. **The docs are journey-first with a conventional technical body inside the
    keep club visual shell.**
13. **App, landing page, schema, and docs source stay in this repository.** No
    new source repository is part of this plan.

## Why this is schema version 2

Format 1 is already deployed:

- Day Skipper: 537 built-in cards.
- Competent Crew: 200 built-in cards.
- Imported Anki decks stored in IndexedDB.
- Backups and the retired-origin migration payload can carry the same deck
  objects.

Built-in `cards.json` files omit `format`, which `validateDeck()` interprets as
format 1. The Anki builder explicitly writes `format: 1`.

Using `schemaVersion: 1` for an incompatible descriptive object would make one
version number mean two shapes. The first public contract is therefore version
2 even though it is the first documented creator format.

## Compatibility invariants

These are release blockers, not best-effort goals:

- Do not rename any `munin/...` localStorage key.
- Do not rename `munin-*` service-worker cache families.
- Do not change the manifest ID `/munin/`.
- Do not change existing course IDs or any of the 737 built-in card IDs.
- Do not change imported Anki card IDs.
- Do not clear or bulk-rewrite IndexedDB during an upgrade.
- Do not put scheduling state in a course artifact.
- Do not silently drop cards, media, sections, or unsupported fields.
- A format-1 backup or imported deck must remain restorable.
- The retired-origin migration must continue accepting format-1 records.

The format-1 reader is permanent compatibility code. It should be small,
isolated, fixture-tested, and excluded from new authoring documentation.

## Target object model

### Course

Proposed parameter vocabulary:

```yaml
schemaVersion: 2
courseId: nautical-knots
title: Nautical knots
shortTitle: Knots
tagline: Learn the knots that hold.
description: |
  A practical introduction to essential knots.

contentLanguage: en-GB
instructionLanguage: en-GB

authors:
  - name: Example Author
    website: https://example.org/

license:
  identifier: CC-BY-4.0
  attribution: Example Author, 2026

source:
  website: https://example.org/knots
  repository: https://github.com/example/knots

sections: []
groups: []
cards: []
theme: {}
extensions: {}
```

Only `schemaVersion`, `courseId`, and a non-empty `cards` array are required.
Optional strings must be non-empty when present.

### Card

```yaml
cardId: bowline-purpose
front: What is a bowline used for?
back: |
  Making a **fixed loop** that neither slips nor jams.
sectionId: practical-knots
tags:
  - bowline
  - loops
media: []
extensions: {}
```

Rules:

- `cardId` is unique within the course and remains stable across edits.
- The front must contain renderable Markdown or at least one valid front-side
  media object.
- `back` may be omitted.
- An omitted/empty `sectionId` maps to the generated default section when no
  section table is declared.
- If `sections` is declared, an unknown `sectionId` is an error.
- Tags are normalized for duplicate comparison but retain their display
  spelling unless the final schema explicitly splits tag ID and title.
- There are no author-supplied card counts, section counts, group counts, build
  hashes, or numeric ordering fields. The app derives them.

### Section and group

```yaml
sections:
  - sectionId: foundations
    title: Foundations

groups:
  - groupId: essentials
    title: Essential skills
    sectionIds:
      - foundations
```

Array order is display order. Empty sections and duplicate membership are
semantic errors. Groups are optional; if groups exist, every declared section
must remain reachable.

### Media

```yaml
media:
  - side: back
    mediaType: video
    source: media/bowline.mp4
    alternativeText: Hands tying a bowline around a rail
    caption: Tying a bowline step by step
    posterImage: media/bowline-poster.webp
    transcript: |
      Form a loop in the standing part...
    durationSeconds: 58
    width: 1920
    height: 1080
    credit:
      name: Example Instructor
      website: https://example.org/
```

Rules to settle in the schema specification:

- `side`: `front` or `back`.
- `mediaType`: `image`, `audio`, or `video`.
- `source`: normalized relative path inside the folder/archive. No schemes,
  absolute paths, traversal, control characters, or ambiguous Unicode forms.
- Raster dimensions are required for published images and posters so layout
  does not jump; the importer may derive them for local packages.
- Published images require useful alternative text unless explicitly marked
  decorative.
- Published video requires captions or a transcript.
- Video never autoplays.
- Hosted video is fetched on demand and is not silently represented as fully
  offline. Bundled video is stored locally, subject to quota.
- Supported containers/codecs and per-file/archive size limits must be stated
  before the schema is frozen.

### Theme and advanced presentation

The public course file is untrusted. It must not execute:

- JavaScript such as today's `doodles.js`.
- Arbitrary boot HTML.
- Arbitrary CSS or keyframes.
- Unsanitized SVG markup such as today's trusted `figures.json` bodies.

Format 2 theme fields must be declarative. Initial safe surfaces should include
colors, text, named raster assets, and validated SVG path data where needed.
The loading screen should become data such as art name, supported animation
name, and line of text—not an HTML/CSS injection surface.

Inventory every current `course.json`, `doodles.js`, `boot.html/.css`,
`figures.json/.css`, and `videos.json` capability. For each, choose one:

1. Represent safely and declaratively in format 2.
2. Replace it with a simpler media representation.
3. Keep it temporarily behind the built-in format-1 compatibility path.

No "trusted third-party course" exception should be added. That would recreate
conformance layers and make sharing a security boundary users cannot see.

## Parsing and validation architecture

### Canonical sources

Add:

```text
schema/
  course-v2.schema.json
  fixtures/
    valid/
    invalid/
```

The JSON Schema describes the parsed YAML data model and is published at an
immutable URL:

```text
https://docs.keepclub.app/schema/course-v2.schema.json
```

The semantic validator adds constraints JSON Schema cannot express cleanly:
unique IDs, references, derived section membership, archive/media existence,
safe normalized paths, renderable sides, attribution requirements for
publication, and limits.

Quality checks produce warnings: empty optional values normalized away,
missing descriptions, extremely long sides, missing local attribution,
oversized media, weak alternative text, duplicate-looking content, and
front-only cards whose wording still says "see answer below."

Every diagnostic has:

- Stable code, for example `card.duplicate_id`.
- Severity: error or warning.
- YAML path such as `cards[12].cardId`.
- Source line/column when the parser supplies it.
- Plain-language explanation.
- Specific correction.
- Stable docs link.

### YAML

Use a maintained YAML 1.2 parser, loaded only when course import/loading needs
it. Do not implement a home-grown YAML parser.

Configure a strict safe profile:

- One document only.
- Unique keys.
- No custom tags.
- No anchors, aliases, or merge keys.
- No executable types.
- Bounded nesting, scalar size, item count, and total input size.
- Preserve source locations for diagnostics.

The dependency and its license must be recorded in
`THIRD_PARTY_NOTICES.md`. Benchmark the browser bundle and parse time before
choosing the library.

### Markdown

Render the documented CommonMark subset once, before storage/runtime use.
Raw HTML is escaped. Rendered output is passed through the existing
rewrite-and-sanitize model; no input HTML is trusted.

Keep one shared fixture corpus for the browser renderer and the course build so
links, lists, emphasis, line breaks, entities, and hostile input do not drift.
If the Python build remains during migration, it must consume the same fixtures.

### Normalization boundary

Create one entry point conceptually equivalent to:

```js
readCourse(input) -> {
  course,       // normalized descriptive format-2 object
  diagnostics,  // errors and warnings
  sourceFormat  // legacy-v1 or course-v2
}
```

Only this boundary knows compact format-1 keys. `app.js`, scheduling, Browse,
Progress, search, import receipts, and new code operate exclusively on
descriptive objects.

## Implementation phases

### Phase 0 — Freeze specification and fixtures

Deliver:

- `schema/course-v2.schema.json`.
- A prose contract covering defaults and every field.
- Minimal, normal, front-only, sectioned, media-rich, and themed valid fixtures.
- Invalid fixtures for every diagnostic family.
- A checked-in mapping from every legacy field/surface to format 2 or a stated
  temporary compatibility path.
- Limits: input bytes, cards, fields, nesting, media count/bytes, video policy.

Gate:

- Another implementer can construct a valid course without reading app code.
- No compact single-letter parameter appears in the format-2 schema.
- Examples and schema agree mechanically.

### Phase 1 — Legacy adapter and format-2 validator

Add a pure course module, likely under `web/lib/`, with:

- Format detection.
- Strict v2 structural validation.
- Semantic validation and diagnostics.
- Compact v1 → descriptive v2 normalization.
- Default application after validation.
- Derived sections, groups, counts, ordering, and build fingerprint.

Do not change app call sites yet. Prove the adapter against:

- Both built-in courses.
- Generated legacy and modern Anki fixtures.
- Existing backup/mirror migration records.
- Hostile/cyclic JS objects at the validator boundary.

Gate:

- All 737 built-in card IDs and course IDs are byte-identical after
  normalization.
- A normalized format-1 course and its original render/search/schedule
  identically.
- No persistent data is written by normalization.

### Phase 2 — Descriptive runtime migration

Change the live runtime to consume only descriptive objects:

- `i` → `cardId`
- `s` → `sectionId`
- `q` → `front`
- `a` → optional `back`
- `m/d/f` → descriptive media/figure fields
- section/group `k/t/s/n/o` → descriptive names and derived values

Update:

- `web/app.js`
- `web/munin.js`
- `web/import.js`
- `web/lib/deck.js`
- `web/lib/store.js`
- validation, receipts, backup/mirror handling, and every test/fixture consumer

IndexedDB strategy:

- Existing records remain format 1 on disk.
- `store.get()` normalizes them on read.
- New imports are stored as format 2.
- Do not bump the database version merely to rewrite card objects.
- A later background/lazy rewrite is allowed only after validated read and
  atomic replacement, and is not required for launch.

Gate:

- No production runtime code accesses compact card/section/group fields outside
  the isolated legacy adapter.
- All current tests remain green before any built-in file changes.
- Existing imported decks open, study, re-import, back up, restore, migrate
  origins, and delete with unchanged progress.

### Phase 3 — Front-only card UX

Schema behavior:

- Back is omitted when absent.
- Empty back text plus no back media normalizes to omission with a warning.
- A card is valid when its front has text or front-side media.

Review behavior:

- Do not render a blank rule or answer region.
- Do not present "Show answer" when there is nothing to reveal.
- Present the grade controls with clear self-assessment copy.
- Preserve keyboard grades 1–4 and Undo.
- Browse and search do not create empty answer containers.
- Export/backup retains the intentional absence.

Gate:

- Front-only text, image, audio, and video prompts are usable with mouse,
  keyboard, touch, and assistive technology.
- Scheduling behavior is identical to backed cards after a grade.

### Phase 4 — Unified media path

Create one runtime media model for image, audio, and video attachments on
either side.

Tasks:

- Map legacy built-in images, figures, and videos into normalized media views.
- Map existing Anki image/audio imports without changing stored media IDs.
- Add safe package media resolution.
- Add video controls, poster, caption/transcript presentation, failure copy, and
  quota accounting.
- Decide whether existing labelled figures remain a specialized declarative
  type or become generated images.
- Keep hosted video lazy and explicit about offline availability.
- Never allow a course media reference to reach an undeclared network origin.

Gate:

- Missing/corrupt media produces a preview diagnostic and honest runtime state.
- No media-only card becomes blank after sanitization.
- Video does not regress app boot, service-worker install, or offline course
  behavior.

### Phase 5 — Migrate built-in sources and outputs

Migrate Day Skipper and Competent Crew mechanically:

- Preserve all 737 card IDs.
- Preserve course IDs and progress keys.
- Preserve wording and rendered Markdown output unless an audited correction is
  intentional.
- Replace compact shipped objects with descriptive format-2 objects.
- Remove redundant author-supplied counts/order fields.
- Convert course metadata and safe presentation fields.
- Leave advanced trusted theme/figure surfaces on the explicit compatibility
  list until their declarative replacements are ready.

Update course build/refresh scripts to emit and validate format 2. Generate a
machine-readable migration report:

- old ID → new ID (must be identity)
- old rendered front/back → new rendered front/back
- old section/group membership → new membership
- old media attachment → new attachment

Gate:

- Zero unexplained card-ID changes.
- Zero unexplained rendered-content changes.
- Both courses produce the same study queues from the same seeded state.
- Offline cache stamping includes the new files correctly.

### Phase 6 — Public `.keep.yml` / `.keep` import

Extend the existing `+ your own deck` flow rather than adding a separate
creator tool.

Accept:

- `.keep.yml` for text-only or externally referenced local-folder development.
- `.keep` ZIP with root `course.keep.yml` and declared relative assets.
- Existing `.apkg` unchanged.

Flow:

1. Detect file type.
2. Bound size before parsing/unzipping.
3. Parse YAML safely.
4. Validate structure and semantics.
5. Resolve and validate every declared asset.
6. Render/sanitize Markdown.
7. Show preview/receipt before storage.
8. Block atomically on errors.
9. Allow explicit continuation with warnings.
10. Store normalized format 2 and media in one transaction.

The receipt shows what was read, created, defaulted, warned, and rejected. It
must distinguish "front-only by design" from "back was lost."

Re-import matches stable `courseId` and `cardId`, preserves progress, and shows
the update delta before replacement.

Gate:

- Minimal two-card YAML imports and studies successfully.
- Media-rich package works offline after import.
- Path traversal, zip bombs, duplicate keys/IDs, hostile Markdown, oversized
  scalars, unsupported codecs, and missing assets fail with actionable errors.

### Phase 7 — Documentation and examples

Keep source in this repository:

```text
docs/
  index.md or index.html
  getting-started/
  reference/
  recipes/
  schema/
  examples/
web/
  docs/                 # published output, if docs have a build step
schema/
  course-v2.schema.json # canonical source
```

Information architecture:

1. What a course is.
2. Five-minute minimal course.
3. Validate and import it.
4. Front-only and ordinary Q/A cards.
5. Sections and tags.
6. Images, audio, and video.
7. Stable IDs and safe updates.
8. Packaging `.keep`.
9. Publication metadata and licensing.
10. Theme/defaults.
11. Complete reference.
12. Error catalog and versioning.
13. Integration recipes for scripts, spreadsheets, LLMs, and Anki conversion.

Every example is a test fixture or is generated from one; prose must not drift
from accepted syntax.

Visual direction: keep club paper/ink/tower shell, conventional persistent docs
navigation, deep anchors, readable code, copy buttons, and responsive tables.

### Phase 8 — One-repository hosting and domain

Do not create a new source repository.

The existing deploy script already publishes `web/` into the established
`keepclub-pages` deployment repository. Initially add docs under the same
published tree:

```text
https://keepclub.app/docs/
```

Do not move the current app root or alter its PWA scope/manifest ID in this
project. A future landing-page route change needs its own install-migration
decision.

`docs.keepclub.app` cannot be mapped to `/docs/` by DNS alone. Before DNS work,
choose one of these one-repository routes:

- **Redirect:** the DNS/edge provider redirects
  `docs.keepclub.app/*` to `https://keepclub.app/docs/*`. Simplest; the visible
  canonical URL becomes the path.
- **Edge rewrite/proxy:** keep `docs.keepclub.app` visible while serving the
  `/docs/` files from the same deployment. More infrastructure, no second repo.
- **Two hosting projects from this repository:** app and docs deploy from
  different directories to distinct custom domains. Still one source repo.

Update the DNS handoff only after this choice. Test that the root-scoped app
service worker neither intercepts nor stale-caches docs navigation.

Gate:

- App, future landing source, schema, and docs remain in this repository.
- `docs.keepclub.app` has valid HTTPS and no takeover window.
- Schema URLs are immutable and cacheable.
- App deployment cannot delete docs output accidentally.

### Phase 9 — QA, staged rollout, and publication

Add dedicated suites:

- `course-schema-v2.mjs`: schema, semantic rules, defaults, diagnostics.
- `course-yaml.mjs`: strict YAML profile and source locations.
- `course-package.mjs`: ZIP/media safety and limits.
- `course-migration.mjs`: 737 ID/content/membership invariants.
- Browser tests for front-only review and `.keep` import/update.
- Docs link/schema/example validation.

Expand existing suites:

- `separation.mjs`: one minimal course with no theme/section/media works.
- `shell-and-courses.mjs`: v1 and v2 courses can coexist during rollout.
- `importer-ui.mjs`: `.apkg`, `.keep.yml`, and `.keep` receipts.
- `mirror-migration.mjs`: legacy compact imported deck remains readable.
- `pwa.mjs`: new course assets update transactionally and docs remain outside
  inappropriate app-cache handling.
- `qa-regressions.mjs`: front-only modal/keyboard/history/accessibility cases.

Rollout order:

1. Ship the legacy adapter and descriptive in-memory runtime while all built-ins
   remain format 1.
2. Observe and verify production compatibility.
3. Ship format-2 built-ins and package importer with the reader already live.
4. Publish docs and immutable schema only when the shipped importer accepts the
   documented examples.
5. Configure `docs.keepclub.app`.

Do not deploy a content generation that the previous service worker/app cannot
read. Preserve transactional cache-generation behavior.

## Pull-request and commit shape

Implementation should use a new branch, recommended:

```text
feat/course-schema-v2
```

Keep commits reviewable:

1. Add v2 schema, fixtures, and diagnostics contract.
2. Add strict YAML/Markdown parser dependencies and tests.
3. Add legacy adapter and normalized model.
4. Rename runtime consumers to descriptive fields.
5. Add front-only review behavior.
6. Unify image/audio/video media.
7. Migrate built-in builders and course data.
8. Add `.keep` import/update receipts.
9. Add docs and published schema.
10. Add domain/deployment wiring after the hosting gate is chosen.

Never stage unrelated workspace changes. Do not use `git add -A`.

## Definition of done

- A two-card, front-only `course.keep.yml` imports and studies with no theme or
  organizational metadata.
- A fully themed media course uses the same schema.
- The live runtime uses descriptive parameters throughout.
- Compact fields exist only inside the isolated format-1 compatibility reader
  and its fixtures.
- All 737 built-in card IDs and every course ID are unchanged.
- Existing localStorage, IndexedDB, backups, installs, and imported-deck
  progress survive.
- Sections/tags/defaults behave as documented.
- Image, audio, and video packages have accessible, safe, honest behavior.
- Schema, examples, importer, and docs are mechanically consistent.
- App, landing source, docs, and schema remain in one source repository.
- All existing and new automated suites pass locally and against the deployed
  site.
- `docs.keepclub.app` serves or intentionally redirects to the versioned docs
  over HTTPS with a documented rollback.

## Rollback

- Revert format-2 built-in content before removing any reader support.
- Keep the format-1 adapter even after full migration.
- A failed format-2 import never writes partial deck/media state.
- A failed lazy IndexedDB rewrite leaves the original record intact.
- Roll back the docs subdomain by removing only its host/redirect configuration;
  do not change apex, `www`, app PWA identity, or existing Pages records.
- Revert deployments through normal commits so Pages/service-worker generations
  advance transactionally; do not force-reset deployed repositories.
