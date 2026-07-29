# Course format 2 diagnostics

Every diagnostic has a stable `code`, `severity`, data `path`, plain-language
`message`, actionable `correction`, and `docsUrl`. YAML diagnostics also carry
one-based `line` and `column` where the parser can locate the value. Codes are
API: wording may improve, codes do not change meaning.

## Parse and shape errors

| Code | Meaning / correction |
| --- | --- |
| `document.invalid_yaml` | YAML 1.2 cannot be parsed; fix the syntax at the reported location. |
| `document.multiple_documents` | More than one YAML document was supplied; keep exactly one. |
| `document.duplicate_key` | A mapping repeats a key; remove one rather than relying on parser precedence. |
| `document.disallowed_tag` | A custom YAML tag was used; use plain YAML data. |
| `document.disallowed_anchor` | An anchor, alias, or merge key was used; write the value explicitly. |
| `document.unsupported_yaml_version` | A `%YAML` directive selects a version other than 1.2; remove it or select 1.2. |
| `document.non_plain_value` | A mapping key or numeric value cannot be represented safely as plain course data; use string keys and finite, safe numbers. |
| `document.too_many_errors` | More than 100 parser/safety errors exist; fix the reported set, then validate again. |
| `limit.input_bytes` | The UTF-8 manifest exceeds 5 MiB; split or reduce the course. |
| `limit.nesting` | YAML nesting exceeds 24 levels; flatten the data. |
| `limit.scalar_length` | A scalar exceeds 1 MiB; split or reduce the content. |
| `limit.collection_items` | A list or mapping exceeds 50,000 entries; split or reduce it. |
| `limit.node_count` | The document exceeds 500,000 syntax nodes; split or simplify it. |
| `markdown.too_long` | One Markdown field exceeds 256 KiB; split or shorten it. |
| `markdown.too_deep` | Markdown nesting exceeds 64 levels; flatten nested lists or formatting. |
| `markdown.too_complex` | One Markdown field exceeds 100,000 syntax nodes; split or simplify it. |
| `markdown.unsupported_construct` | Markdown outside the format-2 subset was used; replace it with a supported construct. |
| `markdown.unsafe_link` | A link is not HTTPS or mailto; correct it or leave its label as plain text. |
| `markdown.empty` | A caller-required Markdown field has no visible content; add content or omit the optional field. |
| `markdown.too_many_errors` | More than 100 Markdown errors exist; fix the reported set, then validate again. |
| `course.not_object` | The root is not a mapping; make the document a course mapping. |
| `course.unsupported_schema_version` | `schemaVersion` is absent or not `2`; use the documented major. |
| `course.missing_id` | `courseId` is absent; add a stable creator-owned ID. |
| `course.invalid_id` | An ID is blank or violates the lowercase stable-ID grammar; correct it, never auto-generate it during import. |
| `course.cards_required` | `cards` is absent, not a list, or empty; provide at least one card. |
| `card.missing_id` | A card lacks `cardId`; assign a stable ID before import. |
| `field.unknown` | An object has an unknown field; use a documented field or namespaced extension. |
| `field.invalid_type` | A value has the wrong type; use the type shown in the reference. |
| `field.empty` | An optional value that must be meaningful is blank/empty; omit it or provide content. |
| `extension.invalid_namespace` | An extension key is not reverse-domain namespaced; use e.g. `org.example.tool`. |

## Semantic and asset errors

| Code | Meaning / correction |
| --- | --- |
| `card.front_empty` | Neither sanitized front text nor valid front media renders; add one. |
| `card.duplicate_id` | Two cards share a `cardId`; give each review card stable unique identity. |
| `section.duplicate_id` | Two sections share a `sectionId`; rename one and update references. |
| `section.unknown` | A card names an undeclared section; declare it or correct `sectionId`. |
| `section.ambiguous_default` | A card omits `sectionId` while multiple sections exist; name its section. |
| `section.empty` | A declared section contains no cards; remove it or add cards. |
| `group.duplicate_id` | Two groups share a `groupId`; rename one. |
| `group.unknown_section` | A group names an undeclared section; correct `sectionIds`. |
| `group.duplicate_section` | A section occurs twice in one or more groups; keep one membership. |
| `group.ungrouped_section` | Groups exist but omit a declared section; place every section exactly once. |
| `media.invalid_path` | An asset path is unsafe or ambiguous; use one normalized relative path. |
| `media.missing` | A declared asset is absent; add it or remove the reference. |
| `media.type_mismatch` | Declared type, optional MIME, extension, and bytes disagree; correct the declaration/file. |
| `media.unsupported` | The media container/codec cannot be rendered safely on target browsers; transcode it. |
| `media.too_many` | Per-card or course media count exceeds the documented limit; split/reduce it. |
| `media.too_large` | A file exceeds its type limit; compress, transcode, or split it. |
| `package.root_manifest_missing` | A `.keep` archive has no root `course.keep.yml`; add exactly that file. |
| `package.duplicate_path` | Two entries normalize to the same path; rename one. |
| `package.unsafe_path` | An entry is absolute, traverses, uses backslashes/control characters, or is otherwise unsafe; rebuild the archive. |
| `package.too_many_files` | The archive exceeds 2,500 files; reduce it. |
| `package.too_large` | Compressed or expanded archive limits are exceeded; reduce it. |
| `package.expansion_ratio` | A file/archive expands over 100:1; rebuild without dangerous compression behavior. |
| `publication.license_required` | Publication was requested without a license; declare one. |
| `publication.image_alt_required` | A published non-decorative image lacks useful alternative text; add it. |
| `publication.image_dimensions_required` | A published image lacks known dimensions; add or derive them. |
| `publication.video_text_alternative_required` | Published video lacks captions and transcript; add one. |

## Quality warnings

| Code | Meaning / correction |
| --- | --- |
| `field.empty_back` | `back` is blank and will normalize to absent; omit it to state front-only intent. |
| `field.empty_optional` | An allowed empty optional collection/value will normalize away; omit it. |
| `course.missing_title` | A title will be derived from `courseId`; add a deliberate display title if publishing. |
| `course.missing_description` | The course has no description; consider adding one for discovery. |
| `card.long_side` | A side is unusually long though within the hard limit; split or tighten it. |
| `card.front_only_answer_cue` | A front-only prompt implies an answer will be revealed; reword it or add a back. |
| `card.duplicate_looking_content` | Two cards appear equivalent after text normalization; confirm both are intentional. |
| `card.duplicate_tag` | Tags duplicate after Unicode normalization/case folding; the first spelling wins. |
| `media.alt_missing` | A local non-decorative image has no alternative text; add it before sharing. |
| `media.alt_weak` | Alternative text is filename-like or uninformative; describe the useful content. |
| `media.transcript_missing` | Local audio/video has no transcript; add one for accessibility. |
| `media.large_file` | Media is valid but large enough to affect install/offline quota; optimize it. |
| `media.unreferenced_asset` | A package file is not declared by the course; remove it or declare it. |
| `metadata.missing_attribution` | Local content has no author/source attribution; add it before sharing. |
| `theme.low_contrast` | A custom paper/ink or accent/ink pair has weak contrast; choose a more legible pair. |

Parser/shape diagnostics are emitted first, capped only after recording that
more errors exist. Semantic validation does not run through structurally
unreadable subtrees. Quality warnings never turn a failed import into a partial
one.
