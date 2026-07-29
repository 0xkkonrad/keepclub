# keep club

Membership pays in memories.

keep club is a local-first progressive web app. It ships built-in courses,
imports Anki `.apkg` decks, keeps study progress on the device, and works
offline after the first visit.

- App: [keepclub.app](https://keepclub.app/)
- Source: [github.com/0xkkonrad/keepclub](https://github.com/0xkkonrad/keepclub)
- Made by [kkonrad](https://kkonrad.com/)

## Run locally

Serve the workspace root on port 8777:

```sh
python3 -m http.server 8777 --directory /workspaces/sandbox
```

Then open:

```text
http://127.0.0.1:8777/projects/keepclub/web/index.html
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

The `munin/...` storage keys, `munin-*` cache names, the `/munin/` manifest id,
and the `munin.js`/`doodles-munin.js` filenames are permanent compatibility
identifiers. They are not the public brand. Renaming the storage or PWA
identity would orphan existing progress and installs for no user-visible gain.

## Sync

Built-in courses can sync progress across devices without an account. Turn it
on in Progress and keep the 25-character key: the same key follows every
built-in course on that device, and only its SHA-256 hash is sent to the
server.

Imported decks remain local because their cards and media live in IndexedDB
and can be much larger than the bounded progress-sync payload. Exported backup
files remain the recovery path for every deck.

## Licensing

keep club's original software and project documentation are available under
the [MIT License](LICENSE).

Third-party dependencies and assets retain their own licenses or copyrights;
see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). In particular, the
third-party course videos are not covered by the MIT License. Their creators
and original posts are recorded in `content/day-skipper/video/sources.csv`.
