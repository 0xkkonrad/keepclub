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
deck removal. Then the other path on that screen: a deck of your own, made by
its first card — the card sheet's own boxes borrowed without two elements ever
sharing an id, a creation called off leaving no deck and no tile, the reader's
refusals in the reader's own words, an imported deck standing beside it keeping
every picture across the save that makes the new one, studying it straight away,
the second card landing in the layer while the deck's document keeps its one,
and removal taking both documents.

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
key validation, and the guarantee that only a SHA-256 hash is transported. Then
the two blocks a person writes: notes and cards travelling as separately
stamped records, tombstones that beat older words in either direction, a card
written again after a delete, three devices converging whatever order they meet
in, the one ceiling notes and cards share evicting by one total order across
both, and the rule the feature turns on — a card tombstone arriving from
another device deletes no review record in the merge. The blob's byte bound is
gated rather than assumed: the client's number is read out of the backend's own
migration, the measurement is asserted against the jsonb text form the server
actually counts rather than against our own JSON, and a blob over it is refused
before it is sent.

`notes.mjs` — the per-deck notes tool as a person meets it: add, read back,
edit and delete through the panel's own controls, the words surviving a reload
and the load sanitiser, markup typed into a note staying characters, a
deliberately corrupt notes block still opening the deck, the panel's history
entry and Tab containment, an idle tab refused while another studies, notes
swept with the deck they belong to, and notes kept by the erase that only
offered to take review history. Then backup and restore: a file from before
notes existed that must not take them, two note sets merged rather than one
clobbering the other, a notes-only backup that exports and restores, a foreign
file still refused, the scrim darkening in both themes, and a document over the
live ceiling coming back at it with the app saying what it cost. The merge
algebra behind them — commutative, idempotent, a delete that is not
resurrected, and a live ceiling that three devices converge on — is in
`sync-merge.mjs`.

`authoring.mjs` — the card editor, and the layer under it. First the layer: a card of your own written
into a shipped course, an edit over a course card with the fingerprint that
notices the author rewriting it afterwards, a hide and a revert, a delete that
leaves a marker rather than a hole, both halves of the reserved `u.` namespace
(the layer accepts nothing else, the course readers refuse a shipped course
that uses it), a deliberately corrupt cards document still opening the deck,
Markdown rendered to sanitized HTML in a deck that is already sanitized HTML,
the shared ceiling and what it costs — and the one that matters most: a cards document
that will not parse stops the boot orphan sweep instead of feeding it, because
the sweep deletes review history for every card it cannot find. Then the editor
over the top of it, driven the way a person meets it: writing a card from Browse
through two boxes, fixing a course card from the row it is on, the reader's own
diagnostics after Save, the sheet's dialog contract (inert background, Tab
containment, Back, Escape, focus return, no stray history entry), Fix this card
mid-session — where an edit is safe and a delete is refused with the reason —
the last card in a section taking the section with it, the only card in a deck
refused outright, an author rewriting a card you had edited and the
keep-yours/take-theirs choice that follows, a hidden card found again from its
own list, the first fill for a card written in markup the two boxes cannot
write, and every number the app counts off the deck moving when the deck does.
The structural cases substitute one course of our own at the fetch boundary, the
way `front-only-ui.mjs` does. Last, the half that crosses between devices: the
blob assembled as two blocks with the state document still holding no cards key,
a card arriving from another device and landing in the deck and its indexes, a
card deleted over there taking its review history here and saying so out loud
once — said by the adoption itself, because most syncs are not asked for — a
card only hidden over there keeping it, the ceiling notes and cards share
counted from both sides, a merge arriving while another tab studies refused
whole rather than in pieces, and a deck that stays on this device where the
sync path is inert and the screen says why. Last of all, a deck of your own
made through the screen a person makes one on, because a card written into one
has two homes and the app has one model for them: the card that made the deck
lives in the deck's own document and every card after it in the layer, both
read as cards you wrote, the document's one is hidden and brought back for free
while the layer's is deleted for good, the last card standing is refused
whichever of the two it is, and an edit of the card the deck was made by is an
override that leaves that document alone.

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
