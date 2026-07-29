# Built-in source migration status

The two shipped courses remain byte-for-byte format 1 in this branch and pass
through the permanent read-time adapter. That is an intentional compatibility
hold, not unfinished key renaming.

Their Markdown source predates public course format 2 and deliberately contains
legacy rendered HTML and entities. There are 515 authored lines containing
constructs such as `<b>`, `<br>`, `<sub>`, `<sup>`, `<u>`, and legacy entities.
The old compiler preserves those constructs as trusted sanitized HTML. Public
format 2 treats raw HTML as visible text and supports a smaller CommonMark
subset. Relabelling the generated `q`/`a` strings as `front`/`back` would
therefore show markup to learners or change rendered wording. It would also
misrepresent trusted labelled figures as general creator media.

What is safe and complete now:

- runtime consumers receive descriptive cards, sections, groups, media, and
  figures through `web/lib/legacy-course.js`;
- the compact shipped files are immutable rollback inputs;
- `schema/built-in-migration-report.json` maps all 737 old/new card identities,
  rendered-side hashes, section memberships, and media/figure views;
- `tests/course-migration.mjs` proves every ID, rendered front/back, membership,
  derived count, and seeded queue remains identical;
- generator output and shipped course bytes have not been rewritten under a
  false format-2 label.

The eventual source migration should:

1. add authored CommonMark fields to `content/mdc.py` without changing the
   existing compiled fields used to derive unpinned IDs;
2. convert legacy inline HTML/entities to the documented CommonMark subset,
   pinning the existing ID before any front wording/compiler change;
3. give labelled figures a documented declarative compatibility representation
   rather than exposing arbitrary SVG;
4. make both Python builders emit format 2;
5. regenerate the machine report and require zero unexplained ID, rendered
   content, membership, media, or queue differences before replacing the
   shipped files.

Until those conditions hold, the adapter is the safer and more accurate format
migration. Removing it is never part of the source conversion.
