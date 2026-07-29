# Permanent format-1 compatibility mapping

This is the complete map of deployed compact data and trusted presentation
surfaces observed on 29 July 2026. It is input-only compatibility. New
format-2 authoring and runtime code must not use these compact names.

The adapter receives `courseId` and the course base path from the registry or
IndexedDB metadata because a built-in `cards.json` does not reliably carry
either.

## `cards.json` / imported deck object

| Legacy location | Meaning | Normalized descriptive value |
| --- | --- | --- |
| root `format` | Compact format major; absent also means 1 | `schemaVersion: 2` after adaptation; `sourceFormat: legacy-v1` returned beside the course |
| root `name` | Deck display name | `title` |
| root `course` | Some generated builds repeat course ID | `courseId`, but caller context must agree and wins only after mismatch is diagnosed |
| root `sections` | Ordered section list | `sections` |
| root `groups` | Ordered complete group list; optional | `groups` |
| root `cards` | Review cards | `cards` |
| root `build` | Eight-character generated content fingerprint | internal `buildFingerprint`; never creator-authored |
| root `ds` | Competent Crew provenance hash for Day Skipper source | internal compatibility provenance, e.g. `buildProvenance.daySkipperSource`; not public v2 |
| section `k` | Stable section key | `sectionId` |
| section `t` | Section title | `title` |
| section `n` | Author-supplied card count | verify against cards, then derive `cardCount` |
| section `o` | Numeric display order | discard only after verifying it agrees with array order; order is then derived from the array |
| group `k` | Stable group key | `groupId` |
| group `t` | Group title | `title` |
| group `s` | Ordered section keys | `sectionIds` |
| group `n` | Author-supplied card count | verify against member cards, then derive `cardCount` |
| card `i` | Stable scheduling ID | `cardId`, byte-for-byte |
| card `s` | Section key | `sectionId` |
| card `q` | Sanitized/rendered question HTML | `front`; mark content as already trusted legacy-rendered HTML so it is not interpreted as author Markdown |
| card `a` | Sanitized/rendered answer HTML | `back`; legacy validator still requires it |
| card `m` | Image filename resolved below course `img/` | `media[].source: img/<m>` with `side: back`, `mediaType: image` |
| card `d[0]` | Legacy image width | matching media `width` |
| card `d[1]` | Legacy image height | matching media `height` |
| card `f.n` | Trusted labelled-figure key | compatibility-only `figure.figureId` |
| card `f.on` | Labels highlighted for that figure | compatibility-only `figure.highlightedLabels` |
| card `r` | Source section of a compiled cross-course pointer | compatibility-only `reference.sourceSectionId`; provenance only, never runtime resolution |

Anki import additionally stores `{format: 1, name, sections, groups, cards}`
inside IndexedDB. Its card IDs and `munin-media:<index>` URLs remain
byte-identical; media blobs and MIME mappings stay in their existing stores.
Normalize on read, store new v2 imports as v2, and do not bulk-rewrite or bump
the database solely for this migration.

## `course.json` and registry

| Legacy field/surface | Meaning | Format-2 disposition |
| --- | --- | --- |
| registry `format` | Registry contract version | Shell compatibility only; not a course field |
| registry `courses[]` | Built-in folder/course IDs | Supplies `courseId` and base path |
| `id` | Course ID | `courseId`, must match registry/folder |
| `title` | Full title | `title` |
| `short` | Shelf title | `shortTitle` |
| `tagline` | Shelf subtitle | `tagline` |
| `accent.light/dark` | Accent colors | `theme.accentColor` / `theme.accentColorDark` |
| `accent.inkLight/inkDark` | Contrast ink drawn on the accent | `theme.accentInkColor` / `theme.accentInkColorDark` |
| `boot.art`, `boot.line` | Named trusted boot drawing and copy | line → `theme.loadingText`; art remains built-in compatibility unless converted to packaged raster artwork |
| `fallback` | Default named doodle | Built-in compatibility; format 2 uses keep club default |
| `shelfArt` | Named trusted doodle | Built-in compatibility; format 2 may use `theme.shelfArtwork` packaged raster |
| `shelfPath` | Inline SVG path used on shelf | Built-in compatibility only; never copy into public v2 |
| `sectionArt` | section ID → named trusted doodle | Built-in compatibility until a safe per-section artwork field is designed |
| `groupArt` | group ID → named trusted doodle | Built-in compatibility until a safe per-group artwork field is designed |
| `friezeArt` | ordered named doodles | Built-in compatibility only |
| `hoard` | achievement threshold/copy/art records | Built-in compatibility; achievement naming is a separate product decision |
| `figures` | figures manifest filename | Built-in compatibility only |
| `credit` | built-in course credit block | Normalize to `authors`, `source`, and/or media `credit` where meaning is unambiguous; otherwise preserve as compatibility metadata |
| `notice` | trusted course-specific notice | Built-in compatibility until a safe notice vocabulary is specified |

## Trusted sidecar surfaces

| Surface | Current shape/use | Disposition |
| --- | --- | --- |
| `doodles.js` | Executable classic script declaring named SVG path strings | Never accepted from public v2; current built-ins only |
| `boot.html` | Arbitrary inline loading HTML/SVG | Never accepted from public v2; convert to packaged raster + named animation or retain built-in path |
| `boot.css` | Arbitrary CSS and keyframes | Never accepted; format 2 selects only app-owned animation names |
| `figures.json` | Figure key → trusted inline SVG body `b`, caption `cap`, label set `l`, note, viewBox `vb` | Never accept unsanitized; current built-ins remain compatibility-only pending declarative figure decision |
| `figures.css` | Trusted styling for inline figures | Never accepted from public v2 |
| `videos.json` | `clips`, card→clip IDs, and credit; MP4 files live below `video/` | Normalize views to back-side video media with relative sources, but preserve current lazy built-in loading/offline behavior until the unified media phase |
| `img/` | Built-in raster files reached by card `m` | Normalize to explicit image media; preserve exact bytes and dimensions |
| `video/` | Built-in MP4 files reached through `videos.json` | Normalize to explicit video media; no autoplay and no false offline claim |

## Invariants while adapting

- `cardId`, `courseId`, section/group membership, text, media identity, and
  ordering are preserved exactly.
- Compact keys appear only in this mapping, the adapter, and legacy fixtures.
- Normalization is pure and writes no localStorage or IndexedDB.
- Existing `munin/...` keys, `munin-*` cache names, manifest ID `/munin/`,
  runtime filenames, backups, and retired-origin migration payloads do not
  change.
- Unsupported or inconsistent legacy data produces a diagnostic; it is never
  silently omitted.

## Existing markdown authoring source

The shipped courses are currently authored below `content/<course>/cards/`.
This source is not the public package contract, but migration must map every
construct mechanically:

| Existing source construct | Format-2 value |
| --- | --- |
| `deck.md` frontmatter `name` | `title` |
| `deck.md` `## Title {#key}` | group `title` and `groupId` |
| list below a group heading | ordered `sectionIds` |
| section filename `NN-section-id.md` | `sectionId`; `NN` is checked, then order comes from arrays |
| section `# NN Title` | section `title`; numeric prefix may be retained as display text only by explicit content choice |
| card `## Front` | `front` |
| optional card `{#id}` | `cardId`; otherwise preserve the builder's existing SHA-1-derived ID during migration |
| card body | `back`; no body becomes an intentional front-only card unless it is a pointer |
| lone `![diagram](file.png)` | back-side image media with source, derived width, and derived height |
| lone `![figure](fig:name@labels)` | compatibility-only `figure` until a safe declarative replacement exists |
| heading `{ref=section}` | build-time provenance `reference.sourceSectionId`; resolved front/back/media are stored concretely |
| heading `nofig` | omit the inherited compatibility figure |
| media below a pointer | explicit replacement back-side media |

Existing HTML fragments in migrated card text are already builder-validated and
must render byte-faithfully. Public v2 author input does not inherit that trust:
it is CommonMark with raw HTML escaped.
