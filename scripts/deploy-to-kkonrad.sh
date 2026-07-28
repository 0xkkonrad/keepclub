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

# Stamp the service worker's cache names from the content actually shipped —
# a cache-first shell only ever updates when these strings change. (Same rule
# as Day Skipper's web_build.py; forgetting it strands returning users on
# the old app for good.)
#
# One stamp for the shell and one per course, so editing a card in one course
# no longer evicts the app and every other course for every user. The course
# list comes from courses/index.json like everywhere else.
hash_of() { (cd "$1" && find . -type f ${2:-} -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-10); }

SHELL_STAMP=$(cd "$DEST" && find . -type f ! -name sw.js -not -path './courses/*' -print0 \
  | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-10)

IDS=$(python3 -c "import json,sys;print(' '.join(json.load(open('$DEST/courses/index.json'))['courses']))")
COURSE_STAMPS=""
for id in $IDS; do
  [ -d "$DEST/courses/$id" ] || { echo "registered course '$id' has no folder"; exit 1; }
  h=$(hash_of "$DEST/courses/$id")
  COURSE_STAMPS="$COURSE_STAMPS '$id': '$h',"
  echo "course $id: $h"
done

python3 - "$DEST/sw.js" "$SHELL_STAMP" "${COURSE_STAMPS% }" <<'PY'
import re, sys
path, shell, courses = sys.argv[1], sys.argv[2], sys.argv[3].rstrip(',')
src = open(path).read()
line = "const BUILD = { shell: '%s', courses: {%s } };" % (shell, courses)
new, n = re.subn(r"^const BUILD = \{.*?\};$", line, src, count=1, flags=re.M)
if n != 1:
    sys.exit("sw stamp failed: BUILD line not found")
open(path, 'w').write(new)
PY
grep -q "shell: '$SHELL_STAMP'" "$DEST/sw.js" || { echo "sw stamp failed"; exit 1; }
echo "sw shell cache: munin-shell-$SHELL_STAMP"

cd "$SITE"
git add -A static/munin
git status --short static/munin | head -20
if [ "${1:-}" = "--commit" ]; then
  SRC=$(git -C "$HERE" rev-parse --short HEAD)
  git commit -m "Munin: deploy web app (from munin@$SRC)"
  echo "committed — push to publish"
fi
