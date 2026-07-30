# keep club tests

`sqlite.mjs` — the read-only SQLite reader against databases SQLite itself
wrote (`fixtures/make-sqlite.py`): interior pages, overflow chains, WITHOUT
ROWID tables stored as index b-trees, three page sizes, and the refusals. Two
bugs were caught here before anything was built on top — index pages have a
different local-payload limit from table pages, and a WITHOUT ROWID record
stores its primary key columns first whatever order they were declared in.

`import.mjs` — the .apkg importer end to end over packages built to Anki's own
schema (`fixtures/make-apkg.py`, DDL and protobuf field numbers taken from
ankitects/anki). Both export formats, and the invariant that matters: the
legacy package and the modern zstd/protobuf one produce a byte-identical deck.
Also the sanitiser, against a package written to attack the app.

`importer-ui.mjs` — the importer as a person meets it: the tile, a real file,
the receipt, keeping it, studying it, the pictures and sound coming off the
device, re-importing over the top with progress kept, the refusals, and
removing the deck again. It also covers unrelated same-title replacement,
lazy media and BFCache restoration, native audio controls, modal history/focus
containment, recoverable storage failures, and stale-tab safety after reset or
deck removal.

`qa-regressions.mjs` — cross-surface browser regressions from the deep QA pass:
single-writer study tabs, midnight and DST scheduling, held keys, session
summary/Undo state, settings conflicts, the text-size setting (applied before
the app is shown, stamped for sync, and any other value read back as the
default), modal Back/focus behavior, lightbox
containment, removed optional assets, late video metadata, cached-scene
sanitization, and chunked large-deck indexing.

`pwa.mjs` — a disposable local server that changes deploy generations under a
real service worker: transactional page/code and course updates, partial-cache
cleanup, captive-portal and wrong-MIME rejection, closed-client completion, and
per-request/per-tab diagram prefetch progress.

`separation.mjs` — the T6 ruling as a gate: every course folder is
self-contained (no cross-course references, own course.json/doodles/cards,
own accent pair and loading screen), and the shell never statically loads a
course file.

`shell-and-courses.mjs` — the shell driven like a person on a fresh profile:
shelf → Day Skipper (indigo) → courses overlay → Competent Crew (slate) →
two cards answered → per-course storage asserted (and `rya-ds/v1`, the live
Day Skipper app's key, asserted UNTOUCHED) → cold open resumes the course.

`sync-merge.mjs` — the cross-device merge algebra without a server:
commutativity, idempotence, monotonic review history, streak reconstruction,
key validation, and the guarantee that only a SHA-256 hash is transported.

`notes.mjs` — the per-deck notes tool as a person meets it: add, read back,
edit and delete through the panel's own controls, the words surviving a reload
and the load sanitiser, markup typed into a note staying characters, a
deliberately corrupt notes block still opening the deck, the panel's history
entry and Tab containment, an idle tab refused while another studies, notes
swept with the deck they belong to, and notes kept by the erase that only
offered to take review history. The merge algebra behind them — commutative,
idempotent, and a delete that is not resurrected — is in `sync-merge.mjs`.

`deploy-script.mjs` — destructive deployment preflights in disposable Git
repositories: wrong branches, dirty Pages work and an unexpected remote are
all refused before the copy begins.

`mirror-migration.mjs` — a real two-origin browser move from the retired
kkonrad.com mirror into keepclub.app: built-in progress, an imported deck,
its review history and media all cross, while the originals remain untouched.

Run: serve the sandbox on :8777
(`python3 -m http.server 8777 --directory /workspaces/sandbox`),
`npm install` once, `npm test` — which builds the fixtures first and runs all
ten suites. The fixtures
are generated and gitignored: a binary blob in the history is a binary blob
nobody can review. `MUNIN_URL` overrides the target (e.g. the
live site). Gotchas encoded in the test, learned the hard way: app chrome is
lowercased by CSS so compare `textContent` case-insensitively; `DECK` is a
top-level `let` in a classic script and never reaches `globalThis` — wait on
`#boot`'s hidden flag instead; state writes are debounced — flush with the
app's own `writeNow()` before asserting localStorage.

The original parity gate ported Day Skipper's suites into keep club; this file
records the resulting gate.

Verified out-of-suite (network-dependent, so not wired into `npm test`):
an offline reload of the live site — SW controlled, precache warm, network
cut via CDP — boots Day Skipper fully. Sequence that matters: a fresh SW
controls pages only after one controlled navigation, so reload online once
before going offline. Day Skipper's own eight suites also run green against
its checkout after the extraction (its repo untouched).
