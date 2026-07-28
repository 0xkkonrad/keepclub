#!/usr/bin/env bash
# Re-copy course DATA from the upstream builds into the self-contained course
# folders. Data only — app.js/app.css/index.html are Munin's own and diverge
# deliberately until the parity-gate re-extraction.
#
#   ./scripts/refresh-courses.sh            # show what would change
#   ./scripts/refresh-courses.sh --write    # copy
#
# The course list comes from web/courses/index.json — the one registry the
# shell and the service worker also read. A course registered there with no
# rule below stops this script rather than being skipped silently: a course
# nobody refreshes is a course that quietly stops matching its source.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Day Skipper is authored in this repo too since its standalone app was retired
# (28 July 2026). Like Competent Crew, its build/ is not committed — run
# `python3 content/day-skipper/src/web_build.py` before this script.
DS="${DS:-$HERE/content/day-skipper/build}"
# Competent Crew is authored in this repo (content/competent-crew) but its build
# is not committed — every card either points at a Day Skipper card or is checked
# against one, so `python3 content/competent-crew/src/build.py` needs that
# checkout present. Run it before this script, or there is nothing to copy.
CC="${CC:-$HERE/content/competent-crew/build}"
FLAG="${1:-}"

copy() { # src dst
  if [ ! -f "$1" ]; then echo "MISS  $1"; return; fi
  if [ "$FLAG" = "--write" ]; then cp "$1" "$2"; echo "wrote $2";
  else cmp -s "$1" "$2" && echo "same  $2" || echo "DIFF  $2"; fi
}

# --delete matters: when a card stops using a diagram the file has to go too,
# or the course ships images nothing references. Three were left behind when
# Competent Crew dropped the Day Skipper sheets its syllabus excludes.
sync_dir() { # label src dst
  if [ ! -d "$2" ]; then echo "MISS  $2"; return; fi
  if [ "$FLAG" = "--write" ]; then rsync -a --delete "$2" "$3";
  # Checksums avoid a page of false drift from mtimes, and the complete list is
  # intentional: truncating at five hid the real changed file farther down.
  else rsync -rnc --delete --itemize-changes --out-format="$1 %i %n" "$2" "$3"; fi
}

MISSING_RULE=0
IDS=$(python3 -c "import json;print(' '.join(json.load(open('$HERE/web/courses/index.json'))['courses']))")

for id in $IDS; do
  DEST="$HERE/web/courses/$id"
  [ -d "$DEST" ] || { echo "registered course '$id' has no folder"; exit 1; }
  echo "── $id"
  case "$id" in
    day-skipper)
      for f in cards.json figures.json videos.json doodles.js; do copy "$DS/$f" "$DEST/$f"; done
      sync_dir 'img  ' "$DS/img/" "$DEST/img/"
      # The 54 clips. They were never copied across when the course was first
      # imported, so videos.json shipped naming files the app could not fetch
      # and every thumbnail was a dead request.
      sync_dir 'video' "$DS/video/" "$DEST/video/"
      ;;
    competent-crew)
      copy "$CC/cards.json" "$DEST/cards.json"
      # CC's figures are its own copy of the Day Skipper drawings (T6: the
      # files are separated, and being identical is a coincidence). Its
      # figures.css is hand-authored and not copied — that one is the course's
      # own vocabulary, and the two courses' copies may drift apart on purpose.
      copy "$DS/figures.json" "$DEST/figures.json"
      sync_dir 'img  ' "$CC/media/" "$DEST/img/"
      ;;
    *)
      # Not fatal: a course authored somewhere else — an .apkg-derived deck
      # committed by hand, say — is a legitimate course that this script has
      # nothing to say about. Dying here also skipped make-boot.mjs below, so
      # one such course stopped every other course being refreshed.
      echo "no refresh rule — left alone (add one here if it has an upstream build)"
      MISSING_RULE=1
      ;;
  esac
done

# The mechanical half of a course's theme is derived from its own doodle set
# rather than hand-copied: the shelf emblem's path into course.json, and a
# starter loading screen for a course that has none.
if [ "$FLAG" = "--write" ]; then node "$HERE/scripts/make-boot.mjs"; fi

if [ "$MISSING_RULE" = "1" ]; then
  echo "note: one or more registered courses have no refresh rule (see above)"
fi

echo "done. Remember: doodles.js copies may drift apart on purpose — review DIFFs, don't blind-write."
