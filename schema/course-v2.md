# keep club course format 2

Status: frozen implementation contract for schema version 2.

Canonical schema: `course-v2.schema.json`

Canonical authored file: `course.keep.yml` (UTF-8, YAML 1.2). JSON is a YAML
1.2 subset, so the checked-in JSON fixtures are also valid course files after
they are named `course.keep.yml`. A `.keep` file is a ZIP containing exactly
one root `course.keep.yml` plus its declared relative assets.

## Smallest useful course

```yaml
schemaVersion: 2
courseId: daily-prompts

cards:
  - cardId: plan-tomorrow
    front: Write down tomorrow's three priorities.

  - cardId: recall-the-day
    front: Recall three things you learned today.
```

This is complete. It receives the keep club title treatment, tower mark,
colors, one generated section, and other app defaults. Both cards are
front-only and proceed directly to self-grading.

## Contract rules

- Required course fields are `schemaVersion: 2`, `courseId`, and at least one
  card.
- A card requires a stable `cardId` and a renderable front. The front may be
  non-blank CommonMark, one or more front-side media objects, or both.
- `back` is optional. `back: ""` is accepted only so the normalizer can remove
  it with `field.empty_back`; whitespace-only back text behaves the same.
- Optional strings normally must be omitted rather than supplied blank. Empty
  optional arrays are accepted, normalize to omission with
  `field.empty_optional`, and never create a second course tier. Empty
  identities are always errors.
- IDs are 1–128 lowercase ASCII characters. They begin with a letter or digit;
  subsequent characters may also be dot, underscore, or hyphen. Allowing a
  trailing hyphen preserves IDs produced for duplicate legacy Anki rows. IDs
  are opaque: never derive meaning, ordering, or storage paths from them.
- Array order is presentation order. Counts, numeric order, and build
  fingerprints are derived and are not author fields.
- Every object is strict. Unknown fields are errors except below `extensions`.
  Extension keys use a reverse-domain namespace such as
  `org.example.generator`; extension values are inert JSON-compatible data.
- Course artifacts contain content and presentation, never scheduling state.

## Fields and defaults

| Location | Field | Required | Meaning / default when absent |
| --- | --- | --- | --- |
| course | `schemaVersion` | yes | Integer `2`. |
| course | `courseId` | yes | Stable creator-owned course identity. |
| course | `cards` | yes | One or more review cards. |
| course | `title` | no | Replace runs of `.`, `_`, and `-` in `courseId` with one space, then uppercase its first ASCII letter (`daily-prompts` → `Daily prompts`). |
| course | `shortTitle` | no | Compact title; default is `title`, clipped only in the UI. |
| course | `tagline` | no | No tagline is shown. |
| course | `description` | no | No description is shown. |
| course | `contentLanguage` | no | Unknown/undetermined; never guessed from device locale. |
| course | `instructionLanguage` | no | Defaults to `contentLanguage`, otherwise undetermined. |
| course | `authors` | no | No author claim. |
| course | `license` | no | No license claim; required by keep club publication policy. |
| course | `source` | no | No source links. HTTPS only. |
| course | `sections` | no | Generate one `all-cards` section titled “All cards”; an empty list does the same after warning. |
| course | `groups` | no | Sections display directly with no group layer. |
| course | `theme` | no | Exact keep club defaults below. |
| course | `extensions` | no | Empty object. |
| section | `sectionId`, `title` | yes | Stable identity and display title. |
| section | `description` | no | No section description. |
| group | `groupId`, `title`, `sectionIds` | yes | Stable identity, title, and ordered membership. |
| group | `description` | no | No group description. |
| card | `cardId` | yes | Stable progress identity within the course. |
| card | `front` | conditional | CommonMark prompt; may be replaced or supplemented by front media. |
| card | `back` | no | CommonMark answer. Absence creates a front-only card unless back-side media exists. |
| card | `sectionId` | no | Generated default section, or the only declared section; ambiguous omission with multiple declared sections is an error. |
| card | `tags` | no | No tags. Tags do not imply section membership. |
| card | `media` | no | No attachments. |
| card | `extensions` | no | Empty object. |

Defaults are applied only after structural and semantic validation. A malformed
present value never falls back to a default.

## Markdown

`front`, `back`, descriptions, captions, and transcripts use the same
documented CommonMark subset: paragraphs, hard/soft line breaks, emphasis,
strong emphasis, ordered and unordered lists, and links using `https:` or
`mailto:`. Raw HTML is escaped. Images are not embedded with Markdown image
syntax; use explicit media objects so packaging, accessibility, offline state,
and validation remain honest. Inline code, heading levels, fenced or indented
code, block quotes, thematic breaks, and tables are not format-2 constructs.
Unsupported constructs produce an error and an inert preview; pipe-table
syntax remains literal paragraph text. Ordered-list start numbers currently
normalize to `1`, matching the sanitizer. Further constructs may be added only
by a later schema-major revision or documented compatible expansion.

The importer renders and sanitizes before storage. A side containing only
markup removed by sanitization is blank.

## Sections, groups, and tags

Declared section and group IDs are unique. Every declared section must contain
at least one card. With one declared section, omitted card `sectionId` defaults
to it. With two or more, each card must name one.

When groups exist, each declared section occurs in exactly one group.
`sectionIds` has no duplicates and references only declared sections. Empty
groups and partial grouping are errors. Tags retain display spelling; duplicate
comparison uses Unicode normalization and case folding. Duplicate tags on one
card are warnings and normalize to the first spelling.

## Media

`side`, `mediaType`, and `source` are required. `side` is `front` or `back`;
`mediaType` is `image`, `audio`, or `video`. `source`, poster images, and
caption tracks are NFC-normalized relative package paths. They may not contain
absolute roots, URL schemes, backslashes, empty components, `.`/`..`
components, control characters, ambiguous Unicode normalization, or resolve
outside the package. Paths compare after NFC normalization and ASCII
case-folding so packages behave consistently on common filesystems.

Media type is established by byte sniffing, then checked against
`mediaType`, optional `mimeType`, and extension. Filenames never override
content. Every referenced asset must exist and every package asset must either
be referenced or produce an explicit warning.

Images support `alternativeText`, `decorative`, `width`, and `height`.
Published images require useful alternative text unless `decorative: true`,
and require dimensions (the local importer may derive dimensions). Audio and
video support `transcript`, `durationSeconds`, and credit. Video additionally
supports `posterImage` and WebVTT `captionTracks`; published video requires a
transcript or at least one caption track. Video never autoplays.

Remote URLs are never media sources. A bundled asset is stored for offline use;
future hosted-media support requires a new explicit contract.

## Theme

Format 2 theme is inert data: six light/dark color tokens, three packaged
raster artwork paths, loading text, and one of three app-owned animation names.
Colors are six/eight-digit hex. Artwork is validated like other media.

The defaults are `accentColor: #0e3f39`, `accentColorDark: #35917f`,
`accentInkColor: #fffdf7`, `accentInkColorDark: #141519`,
`paperColor: #fffdf7`, `paperColorDark: #1c1e25`, keep club tower/app artwork,
`loadingText: Loading…`, and the app's gentle motion where motion is allowed.
Accent ink means text/icons drawn on the accent, not general body ink. Preview
warns when a supplied color pair has weak contrast.

JavaScript, arbitrary HTML, CSS/keyframes, remote fonts, unsanitized SVG, and
arbitrary SVG path data are not format-2 theme fields. Existing built-in
doodles, boot markup, and labelled figures stay behind the legacy compatibility
path until safely represented.

## Limits

Limits are checked before expensive parsing or decompression. They are release
constants; reducing one requires compatibility analysis.

| Resource | Limit |
| --- | ---: |
| `course.keep.yml` UTF-8 bytes | 5 MiB |
| YAML nesting depth | 24 |
| any YAML scalar | 1 MiB |
| entries in any YAML list or mapping | 50,000 |
| YAML syntax nodes | 500,000 |
| `front`, `back`, or Markdown field | 256 KiB |
| cards | 50,000 |
| sections | 1,000 |
| groups | 250 |
| tags per card | 64 |
| media objects per card | 16 |
| media objects per course | 2,000 |
| authors | 32 |
| normalized asset path | 240 Unicode code points |
| compressed `.keep` archive | 250 MiB |
| expanded archive | 500 MiB |
| files in archive | 2,500 |
| expansion ratio per file or archive | 100:1 |
| image file | 25 MiB |
| audio file | 50 MiB |
| video file | 200 MiB |
| caption/poster file | 25 MiB |

The 50,000-card ceiling preserves compatibility with large Anki imports while
the 5 MiB YAML ceiling and 256 KiB side ceiling bound browser parsing and
rendering. The archive limits fit a media-rich course on contemporary mobile
storage without treating available quota as permission; the preview must also
show estimated installed size and fail honestly when quota is insufficient.

Accepted v2 package containers are PNG, JPEG, WebP, GIF (non-animated
preferred), MP3, Ogg, WAV, M4A/AAC, MP4, WebM, and WebVTT. SVG remains blocked
until a sanitizer exists. Import checks bounded magic bytes, extension,
declared media type, and optional MIME type before storage; this is container
validation, not a complete codec or payload decoder. Decode failures surface
as unavailable media rather than a blank card. A publication pipeline should
probe or transcode the complete payload for its target browsers.

## Validation and import

Validation runs in three levels:

1. Parse/schema: safe YAML profile, known fields, types, lengths, and shape.
2. Semantics/assets: unique identities, references, renderability, paths,
   package contents, media bytes, and limits.
3. Quality: non-blocking advice such as missing local attribution, weak alt
   text, long sides, duplicate-looking content, and front-only answer cues.

Errors block the whole import atomically; nothing is saved from a course with
errors. Warnings require preview and explicit continuation, and the receipt
lists what landed together with every warning; a course is never partially
imported and a card or asset is never silently dropped. Diagnostic codes and
paths are defined in `diagnostics.md`.

## Evolution

`schemaVersion` is an integer major. Version 2 is immutable at
`https://docs.keepclub.app/schema/course-v2.schema.json`. Additive behavior
that does not make an accepted file mean something different may be documented
without changing the major. New fields or changed meaning require a new major.
The compact deployed format remains permanent input compatibility, not public
format-2 authoring syntax.
