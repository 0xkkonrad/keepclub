#!/usr/bin/env bash
# Copy web/ into the keepclub.app site repo, which serves the app at the DOMAIN
# ROOT. The retired kkonrad.com/munin copy is not a deployment target.
#
#   ./scripts/deploy-to-keepclub.sh          # stage the files, show the diff
#   ./scripts/deploy-to-keepclub.sh --commit # stage, commit and push
#
# The flattened Pages repository is separate from the source repository.
# sw.js is stamped from the exact content copied here, because a cache-first
# shell that is not restamped strands returning visitors for good.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE="${SITE:-/workspaces/sandbox/projects/keepclub-pages}"
DOMAIN="keepclub.app"

[ -d "$SITE/.git" ] || { echo "no site repo at $SITE (override with SITE=…)"; exit 1; }
[ -f "$HERE/web/munin.js" ] || { echo "no app at $HERE/web"; exit 1; }
node "$HERE/scripts/build-docs.mjs" --check \
  || { echo "docs reference is stale; run node scripts/build-docs.mjs --write"; exit 1; }

# Everything that can refuse to deploy refuses BEFORE anything is copied: rsync
# overwrites the stamped sw.js, so a failure between copy and stamp would leave
# `shell: 'dev'` deployed, naming one cache for ever.
hash_of() { (cd "$1" && find . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-10); }

IDS=$(python3 -c "import json;print(' '.join(json.load(open('$HERE/web/courses/index.json'))['courses']))")
for id in $IDS; do
  [ -d "$HERE/web/courses/$id" ] || { echo "registered course '$id' has no folder"; exit 1; }
done
grep -q "^const BUILD = {" "$HERE/web/sw.js" || { echo "no BUILD line in web/sw.js to stamp"; exit 1; }

# --delete keeps the tree honest, so .git and the CNAME that claims the domain
# must be held back explicitly. Losing CNAME un-claims keepclub.app on the next
# Pages build and the domain goes dark until someone notices.
rsync -a --delete \
  --exclude '.git' --exclude 'CNAME' --exclude 'README.md' --exclude '_*' \
  "$HERE/web/" "$SITE/"

echo "$DOMAIN" > "$SITE/CNAME"
# Jekyll would otherwise skip web/lib/vendor and anything else it dislikes.
touch "$SITE/.nojekyll"

SHELL_STAMP=$( (cd "$SITE" && find . -type f ! -name sw.js -not -path './courses/*' -not -path './.git/*' -print0 \
    | sort -z | xargs -0 sha256sum; sha256sum "$SITE/courses/index.json") \
  | sha256sum | cut -c1-10)

COURSE_STAMPS=""
for id in $IDS; do
  h=$(hash_of "$SITE/courses/$id")
  COURSE_STAMPS="$COURSE_STAMPS '$id': '$h',"
  echo "course $id: $h"
done

python3 - "$SITE/sw.js" "$SHELL_STAMP" "$COURSE_STAMPS" <<'PY'
import os, re, sys
path, shell, courses = sys.argv[1], sys.argv[2], sys.argv[3].rstrip(',')
src = open(path).read()
line = "const BUILD = { shell: '%s', courses: {%s } };" % (shell, courses)
new, n = re.subn(r"^const BUILD = \{.*?\};$", line, src, count=1, flags=re.M)
if n != 1:
    sys.exit("sw stamp failed: BUILD line not found")
tmp = path + '.tmp'
open(tmp, 'w').write(new)
os.replace(tmp, path)
PY
grep -q "shell: '$SHELL_STAMP'" "$SITE/sw.js" || { echo "sw stamp failed"; exit 1; }
echo "sw shell cache: munin-shell-$SHELL_STAMP"

cd "$SITE"
git add -A
git status --short | head -20 || true
if [ "${1:-}" = "--commit" ]; then
  SRC=$(git -C "$HERE" rev-parse --short HEAD)
  git commit -q -m "Deploy the app to $DOMAIN root (from keepclub@$SRC)"
  git push -q origin main
  echo "pushed — Pages will rebuild"
fi
