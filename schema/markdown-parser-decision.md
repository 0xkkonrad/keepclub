# Browser Markdown parser decision

Course format 2 uses
[`commonmark.js` 0.31.2](https://github.com/commonmark/commonmark.js), the
JavaScript reference implementation of CommonMark 0.31.2. The parser is
bundled locally; course rendering never depends on a CDN or network request.

Only the parser is bundled. Keep club walks its AST, diagnoses nodes outside
the documented subset, escapes raw HTML as visible text, and emits a fixed tag
vocabulary. Generated markup then passes through `web/lib/html.js`. This keeps
the public contract narrower than the trusted legacy HTML path.

The bundle contains commonmark 0.31.2, entities 3.0.1, and mdurl 1.0.1, built
with esbuild 0.28.1. It is 153,114 bytes uncompressed and 46,421 bytes at gzip
level 9. `scripts/vendor-commonmark.sh` pins and verifies every package
tarball plus the final ESM bundle. Complete licenses sit beside the bundle.
