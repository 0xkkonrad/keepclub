#!/usr/bin/env bash
# Copy web/ into the kkonrad.com Hugo site's static tree → kkonrad.com/munin/.
#
#   ./scripts/deploy-to-kkonrad.sh          # stage the files, show the diff
#   ./scripts/deploy-to-kkonrad.sh --commit # stage and commit on master
#
# Hugo passes static/ through untouched. Pushing is deliberately left to you —
# the site deploys on push to master. /day-skipper is NOT touched here; it
# redirects to /munin only at the parity gate (see web/README.md).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE="${SITE:-/workspaces/sandbox/projects/kkonrad.github.io}"
DEST="$SITE/static/munin"

[ -d "$SITE/.git" ] || { echo "no Hugo site at $SITE (override with SITE=…)"; exit 1; }
[ -f "$HERE/web/munin.js" ] || { echo "no app at $HERE/web"; exit 1; }

mkdir -p "$DEST"
rsync -a --delete --exclude 'README.md' --exclude '_*' "$HERE/web/" "$DEST/"

# Stamp the service worker's cache name from the content actually shipped —
# a cache-first shell only ever updates when this string changes. (Same rule
# as Day Skipper's web_build.py; forgetting it strands returning users on
# the old app for good.)
STAMP=$(cd "$DEST" && find . -type f ! -name sw.js -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-10)
sed -i "s/^const V = 'munin-[^']*';/const V = 'munin-$STAMP';/" "$DEST/sw.js"
grep -q "munin-$STAMP" "$DEST/sw.js" || { echo "sw stamp failed"; exit 1; }
echo "sw cache: munin-$STAMP"

cd "$SITE"
git add -A static/munin
git status --short static/munin | head -20
if [ "${1:-}" = "--commit" ]; then
  SRC=$(git -C "$HERE" rev-parse --short HEAD)
  git commit -m "Munin: deploy web app (from munin@$SRC)"
  echo "committed — push to publish"
fi
