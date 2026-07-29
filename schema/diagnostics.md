# Course format 2 diagnostics

Every diagnostic includes a stable `code`, `severity`, data `path`, `message`,
suggested `correction`, and `docsUrl`. When the YAML parser can locate the
problem, it also reports a one-based `line` and `column`. Wording may be
clarified, but the meaning of a code will not change.

This file covers the format-2 reader only. Diagnostics from the legacy
format-1 compatibility reader (codes such as `card.missing_front` or
`section.count_mismatch`) are intentionally not itemized here; they all link
to the Legacy compatibility section of the built error reference.

## Parse and shape errors

| Code | Meaning / correction |
| --- | --- |
| `document.invalid_yaml` | The document could not be parsed as YAML 1.2, or the selected file or its `.keep` archive could not be read at all. Fix the syntax at the reported location, or rebuild the archive. |
| `document.unsupported_file_type` | This file is not `.keep.yml`, `.keep`, or another supported import format. Choose a supported course file. |
| `document.multiple_documents` | The file contains more than one YAML document. Keep exactly one. |
| `document.duplicate_key` | A mapping contains the same key twice. Remove one of the entries. |
| `document.disallowed_tag` | The file uses a custom YAML tag. Use plain YAML data instead. |
| `document.disallowed_anchor` | The file uses an anchor, alias, or merge key. Write the value out in full. |
| `document.unsupported_yaml_version` | A `%YAML` directive selects a version other than 1.2. Remove the directive or select 1.2. |
| `document.non_plain_value` | A mapping key, number, or other scalar value cannot be stored safely as course data. Use string keys and plain string, number, boolean, or null values. |
| `document.too_many_errors` | The parser found more than 100 errors. Fix the reported errors, then validate again. |
| `limit.input_bytes` | The UTF-8 manifest is larger than 5 MiB. Split the course or reduce its size. |
| `limit.nesting` | The YAML is nested more than 24 levels deep. Flatten the data. |
| `limit.scalar_length` | A single value is larger than 1 MiB. Split or shorten it. |
| `limit.collection_items` | A list or mapping has more than 50,000 entries. Split or reduce it. |
| `limit.node_count` | The document has more than 500,000 syntax nodes. Split or simplify it. |
| `markdown.too_long` | A Markdown field is larger than 256 KiB. Split or shorten it. |
| `markdown.too_deep` | Markdown is nested more than 64 levels deep. Flatten the lists or formatting. |
| `markdown.too_complex` | A Markdown field has more than 100,000 syntax nodes. Split or simplify it. |
| `markdown.unsupported_construct` | This Markdown is not part of the format-2 subset. Replace it with one of the supported constructs. |
| `markdown.unsafe_link` | A link does not use HTTPS or mailto. Fix the URL or leave the label as plain text. |
| `markdown.empty` | A required Markdown field has no visible content. Add content, or omit the field if it is optional. Reserved: the standard import path does not currently emit this code. |
| `markdown.too_many_errors` | The parser found more than 100 Markdown errors. Fix the reported errors, then validate again. |
| `course.not_object` | The document root is not a mapping. Make it a course mapping. |
| `course.unsupported_schema_version` | `schemaVersion` is missing or is not `2`. Set it to the documented major version. |
| `course.missing_id` | `courseId` is missing. Add a stable ID that you control. |
| `course.invalid_id` | An ID is blank or does not follow the lowercase stable-ID format. Correct it; importers must not generate one automatically. |
| `course.cards_required` | `cards` is missing, empty, not a list, or has more than 50,000 entries. Add at least one card, or split a course above the limit. |
| `card.missing_id` | A card has no `cardId`. Give it a stable ID before importing. |
| `field.unknown` | An object contains an unknown field. Use a documented field or a namespaced extension. |
| `field.invalid_type` | A value has the wrong data type, or a list or object exceeds its documented size limit. Use the type listed in the field reference and stay within the limits. |
| `field.empty` | A value is missing or blank where non-blank content is required. Add meaningful content, or remove the field if it is optional. |
| `extension.invalid_namespace` | An extension key does not use a reverse-domain namespace. Use a name such as `org.example.tool`. |

## Semantic and asset errors

| Code | Meaning / correction |
| --- | --- |
| `card.front_empty` | The card has no front text or valid front media to show. Add at least one. |
| `card.duplicate_id` | Two cards have the same `cardId`. Give every review card its own stable ID. |
| `section.duplicate_id` | Two sections have the same `sectionId`. Rename one and update its references. |
| `section.unknown` | A card refers to a section that is not declared. Declare it or correct the `sectionId`. |
| `section.ambiguous_default` | A card has no `sectionId`, but the course has several sections. Name the card’s section. |
| `section.empty` | A declared section has no cards. Remove the section or add cards to it. |
| `group.duplicate_id` | Two groups have the same `groupId`. Rename one. |
| `group.unknown_section` | A group refers to a section that is not declared. Correct its `sectionIds`. |
| `group.duplicate_section` | A section appears more than once across the groups. Keep one membership. |
| `group.ungrouped_section` | A declared section is missing from the groups. Put every section in exactly one group. |
| `media.invalid_path` | An asset path is unsafe or ambiguous. Use one normalized relative path. |
| `media.missing` | A declared asset is not in the package, or could not be safely read from it. Add or replace the file, or remove the reference. |
| `media.type_mismatch` | The declared type, MIME type, extension, and file contents do not agree. Correct the declaration or replace the file. |
| `media.unsupported` | The media container is not supported in a `.keep` package. Transcode the file. |
| `media.too_many` | A card, course, or single media item (for example its caption tracks) has more attached media than the documented limit. Split it or remove some media. |
| `media.too_large` | A media file is larger than its type allows. Compress, transcode, or split it. |
| `package.root_manifest_missing` | The `.keep` archive has no root `course.keep.yml`. Add that file at the archive root. |
| `package.duplicate_path` | Two archive entries resolve to the same path. Rename one. |
| `package.unsafe_path` | An archive path is absolute, traverses directories, uses backslashes or control characters, or is otherwise unsafe. Rebuild the archive with safe relative paths. |
| `package.too_many_files` | The archive contains more than 2,500 files. Reduce the number of files. |
| `package.too_large` | The archive is too large when compressed or expanded, or a member declares an impossible size. Reduce its size or rebuild it with a standard ZIP tool. |
| `package.expansion_ratio` | A file or archive expands by more than 100:1. Rebuild it without extreme compression. |
| `package.unsupported_feature` | An entry is encrypted or uses an unsupported ZIP method. Rebuild it with unencrypted stored or deflated entries. |
| `publication.license_required` | A course cannot be published without a license. Add one. |
| `publication.image_alt_required` | A published non-decorative image has no useful alternative text. Add it. |
| `publication.image_dimensions_required` | A published image has no known dimensions. Add or derive them. |
| `publication.video_text_alternative_required` | A published video has neither captions nor a transcript. Add one. |

## Quality warnings

| Code | Meaning / correction |
| --- | --- |
| `field.empty_back` | `back` is blank and will be treated as absent. Remove it to make the front-only card explicit. |
| `field.empty_optional` | An optional value or collection is empty and will be removed during import. You can omit it from the file. |
| `course.missing_title` | The title will be made from `courseId`. Add a display title if you plan to publish the course. |
| `course.missing_description` | The course has no description. Consider adding one so people can find and understand it. |
| `card.long_side` | One side of the card is unusually long. Consider splitting or shortening it. |
| `card.front_only_answer_cue` | A front-only prompt sounds as if an answer will be revealed. Reword it or add a back. |
| `card.duplicate_looking_content` | Two cards look the same after text normalization. Check that you meant to include both. |
| `card.duplicate_tag` | Two tags become the same after Unicode normalization and case folding. The first spelling will be kept. |
| `media.alt_missing` | A local non-decorative image has no alternative text. Add it before sharing the course. |
| `media.alt_weak` | The alternative text looks like a filename or does not explain the image. Describe the useful content. |
| `media.transcript_missing` | A local audio or video file has no transcript. Add one for accessibility. |
| `media.large_file` | A valid media file is large enough to affect installation or offline storage. Consider optimizing it. |
| `media.unreferenced_asset` | A file in the package is not declared by the course. Remove it or add a media reference. |
| `metadata.missing_attribution` | Local content has no author or source attribution. Add it before sharing the course. |
| `theme.low_contrast` | A custom color pair has weak contrast. Choose colors that are easier to read. |

Parse and shape errors are reported first. Once 100 have been reported, keep
club records that more exist and stops listing them. It does not run semantic
checks on parts of the file it cannot read. Quality warnings never turn a
failed import into a partial import.
