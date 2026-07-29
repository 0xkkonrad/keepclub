# keep club

Spaced repetition for people who want to learn the material, not the app.

keep club is a local-first progressive web app. It ships built-in courses,
imports Anki `.apkg` decks, keeps study progress on the device, and works
offline after the first visit.

- App: [keepclub.app](https://keepclub.app/)
- Mirror: [kkonrad.com/munin](https://kkonrad.com/munin/)
- Made by [kkonrad](https://kkonrad.com/)

## Run locally

Serve the workspace root on port 8765:

```sh
bash /workspaces/sandbox/.preview-serve.sh
```

Then open:

```text
http://127.0.0.1:8765/projects/munin/web/
```

The app has no production build step. The files under `web/` are the deployed
site.

## Test

```sh
cd tests
npm install
npm test
```

The test gate covers the scheduler and state model, Anki import, course
separation, browser interactions, accessibility regressions, pull-to-refresh,
and transactional PWA updates.

## Repository map

- `web/` — the PWA and shipped courses
- `content/` — authored course sources and generators
- `design/` — naming and visual-system source
- `tests/` — Node and Playwright regression suites
- `scripts/` — course refresh, asset generation, and deployment

The `munin/...` storage keys, `munin-*` cache names, and manifest id are retained
for compatibility with existing installs. Renaming them would orphan users'
progress.

## Licensing

keep club's original software and project documentation are available under
the [MIT License](LICENSE).

Third-party dependencies and assets retain their own licenses or copyrights;
see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). In particular, the
third-party course videos are not covered by the MIT License. Their creators
and original posts are recorded in `content/day-skipper/video/sources.csv`.
