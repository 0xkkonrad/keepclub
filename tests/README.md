# Munin tests

`separation.mjs` — the T6 ruling as a gate: every course folder is
self-contained (no cross-course references, own course.json/doodles/cards,
own accent pair and loading screen), and the shell never statically loads a
course file.

`shell-and-courses.mjs` — the shell driven like a person on a fresh profile:
shelf → Day Skipper (indigo) → courses overlay → Competent Crew (slate) →
two cards answered → per-course storage asserted (and `rya-ds/v1`, the live
Day Skipper app's key, asserted UNTOUCHED) → cold open resumes the course.

Run: serve the sandbox on :8765 (`bash /workspaces/sandbox/.preview-serve.sh`),
`npm install` once, `npm test`. `MUNIN_URL` overrides the target (e.g. the
live site). Gotchas encoded in the test, learned the hard way: app chrome is
lowercased by CSS so compare `textContent` case-insensitively; `DECK` is a
top-level `let` in a classic script and never reaches `globalThis` — wait on
`#boot`'s hidden flag instead; state writes are debounced — flush with the
app's own `writeNow()` before asserting localStorage.

The parity gate (project.md T7) means porting Day Skipper's four suites onto
Munin; this file is the seed.
