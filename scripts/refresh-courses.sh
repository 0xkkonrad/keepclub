#!/usr/bin/env bash
# Re-copy course DATA from the upstream builds into the self-contained course
# folders. Data only — app.js/app.css/index.html are Munin's own and diverge
# deliberately until the parity-gate re-extraction.
#
#   ./scripts/refresh-courses.sh            # show what would change
#   ./scripts/refresh-courses.sh --write    # copy
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DS="${DS:-/workspaces/sandbox/projects/rya-day-skipper/web}"
# Competent Crew is authored in this repo (content/competent-crew) but its build
# is not committed — every card either points at a Day Skipper card or is checked
# against one, so `python3 content/competent-crew/src/build.py` needs that
# checkout present. Run it before this script, or there is nothing to copy.
CC="${CC:-$HERE/content/competent-crew/build}"
FLAG="${1:-}"

copy() { # src dst
  if [ "$FLAG" = "--write" ]; then cp "$1" "$2"; echo "wrote $2";
  else cmp -s "$1" "$2" && echo "same  $2" || echo "DIFF  $2"; fi
}

for f in cards.json figures.json videos.json doodles.js; do
  copy "$DS/$f" "$HERE/web/courses/day-skipper/$f"
done
if [ "$FLAG" = "--write" ]; then rsync -a --delete "$DS/img/" "$HERE/web/courses/day-skipper/img/";
else rsync -an --delete --out-format='img   %n' "$DS/img/" "$HERE/web/courses/day-skipper/img/" | head -5; fi

copy "$CC/cards.json" "$HERE/web/courses/competent-crew/cards.json"
# CC's figures are its own copy of the Day Skipper drawings (T6: separated files)
copy "$DS/figures.json" "$HERE/web/courses/competent-crew/figures.json"
# --delete, like the Day Skipper copy above: when a card stops using a diagram
# the file has to go too, or the course ships images nothing references. Three
# were left behind when Competent Crew dropped the Day Skipper sheets that
# carried material its syllabus excludes.
if [ "$FLAG" = "--write" ]; then rsync -a --delete "$CC/media/" "$HERE/web/courses/competent-crew/img/";
else rsync -an --delete --out-format='img   %n' "$CC/media/" "$HERE/web/courses/competent-crew/img/" | head -5; fi

echo "done. Remember: doodles.js copies may drift apart on purpose — review DIFFs, don't blind-write."
