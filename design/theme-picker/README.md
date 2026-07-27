# Theme & shell picker — 27 Jul 2026

Locks the seven choices left open after the theme abstraction was specced:
Munin's logo (10 raven candidates) and accent, what opening the app lands on,
PWA install identity, Competent Crew's accent + doodle scope, and deployment.

Live picker: https://claude.ai/code/artifact/2a7ed902-7574-47cb-99d4-3904f0d83cef
(picks save in the browser under `munin-theme-picker-v1`; Copy summary → paste
back to Claude, the implementation plan gets built from it).

- `ravens.py` — the ten logo candidates as clean 32×32 geometry, re-drawn by
  Day Skipper's `src/rough.py` (read-only import of that checkout; path is
  hard-coded to this machine). Writes `ravens.json`.
- `build_picker.py` — assembles `munin-picker.html` from `picker-body.html`,
  `ravens.json`, two Day Skipper doodles (boat, lifering) and inlined DM Mono.
- `munin-picker.html` — the built page, committed so the artifact has a
  permanent source of record.

Whichever raven wins becomes the app mark; the runners-up seed the raven
doodle set (empty states, badges, progress marks).
