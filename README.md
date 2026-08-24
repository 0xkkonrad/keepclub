# keep club

Membership pays in memories.

keep club is a local-first progressive web app. It ships built-in courses,
imports public `.keep.yml` / `.keep` courses and Anki `.apkg` decks, keeps
study progress in the current browser profile, and works offline after the
first visit.

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
achievement scope and privacy, local share-card fallbacks, notifications, and
transactional PWA updates.

## Repository map

- `web/` — the PWA and shipped courses
- `content/` — authored course sources and generators
- `design/` — naming and visual-system source
- `schema/` — public course format, diagnostics, and fixtures
- `web/docs/` — learner guide, creator guide, and generated public references
- `tests/` — Node and Playwright regression suites
- `scripts/` — course refresh, asset generation, and deployment

The public [learner guide](https://keepclub.app/docs/studying/) explains grades,
scheduling, exam mode, Practice Ahead, and exactly what “solid” progress means.
Its maintainer-facing rules and drift checklist live in
[`docs/scheduler.md`](docs/scheduler.md).

The [course creator guide](https://keepclub.app/docs/) is deployed beside it.
Refresh its generated schema download and diagnostic reference after changing
the public contract:

```sh
node scripts/build-docs.mjs --write
```

The deployment script refuses to continue if those public copies have drifted.

The `munin/...` storage keys, `munin-*` cache names, the `/munin/` manifest id,
and the `munin.js`/`doodles-munin.js` filenames are permanent compatibility
identifiers. They are not the public brand. Renaming the storage or PWA
identity would orphan existing progress and installs for no user-visible gain.

## Sync

Built-in courses can sync progress across devices without an account. Turn it
on in Settings → Keeping your progress and protect the 25-character key like a
password. One key follows every built-in course in that browser profile;
possession grants access to the synced progress, notes, and user-written cards
for all of them. Only the key's SHA-256 hash is sent to the server.

Imported decks remain local because their cards and media live in IndexedDB
and can be much larger than the bounded progress-sync payload. Their backups
are point-in-time restores for the exact local deck while it remains in that
browser profile; they cannot transfer imported-deck review history. Keep the
original `.apkg` or course file to recreate the deck elsewhere.

Club-wide totals are derived from the course records present in the browser
profile. Sync remains deliberately namespaced per built-in course, so in a new
profile open each course once to pull it before expecting the club total to
include it.

## Achievements and sharing

`web/achievements.js` is the single source of truth for achievement ids,
rules, club-versus-course scope, share policy, and repeatable moments. It is a
pure engine: `app.js` supplies progress facts and owns storage and rendering,
while courses may change only achievement wording and art.

Share cards are rendered on the device by `web/share.js`; progress documents,
Sync keys, imported deck names, and card content are never inputs. System
achievement notifications are explicitly opt-in and are used only while the
installed app is in the background. A static PWA cannot promise scheduled
reminders without a push service, so the UI says that plainly.

## Licensing

keep club's original software and project documentation are available under
the [MIT License](LICENSE).

Third-party dependencies and assets retain their own licenses or copyrights;
see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). In particular, the
third-party course videos are not covered by the MIT License. Their creators
and original posts are recorded in `content/day-skipper/video/sources.csv`.
