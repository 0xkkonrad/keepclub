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
MODE="${1:-}"

[ -d "$SITE/.git" ] || { echo "no site repo at $SITE (override with SITE=…)"; exit 1; }
[ -f "$HERE/web/munin.js" ] || { echo "no app at $HERE/web"; exit 1; }
case "$MODE" in
  ""|--commit) ;;
  *) echo "usage: $0 [--commit]"; exit 1 ;;
esac

# Refuse every repository-state problem before rsync --delete gets a chance to
# overwrite it. A deployment is a fast-forward of the dedicated Pages main,
# not a place to collect somebody else's edits or a commit on a feature branch
# while an unchanged main is pushed.
[ "$(git -C "$SITE" branch --show-current)" = "main" ] \
  || { echo "site repo must be on main"; exit 1; }
[ -z "$(git -C "$SITE" status --porcelain)" ] \
  || { echo "site repo has uncommitted work; refusing to overwrite it"; exit 1; }
SITE_REMOTE=$(git -C "$SITE" remote get-url origin 2>/dev/null || true)
[[ "$SITE_REMOTE" =~ (^|[:/])0xkkonrad/keepclub-pages(\.git)?$ ]] \
  || { echo "site origin is not 0xkkonrad/keepclub-pages"; exit 1; }
SITE_HEAD=$(git -C "$SITE" rev-parse HEAD)
SITE_MAIN=$(git -C "$SITE" rev-parse refs/remotes/origin/main 2>/dev/null || true)
[ -n "$SITE_MAIN" ] && [ "$SITE_HEAD" = "$SITE_MAIN" ] \
  || { echo "site main is not exactly origin/main; pull or resolve it first"; exit 1; }

if [ "$MODE" = "--commit" ]; then
  [ "$(git -C "$HERE" branch --show-current)" = "main" ] \
    || { echo "source repo must be on main for a committed deployment"; exit 1; }
  [ -z "$(git -C "$HERE" status --porcelain)" ] \
    || { echo "source repo has uncommitted work; commit it before deploying"; exit 1; }
fi

# The database migration is additive but the row fence is one-way: once a v2
# client adopts a key, a pre-v2 frontend must fail closed rather than erase its
# progress proof. Gate both staging and committed deploys before either can
# mutate Pages. Clear the test-only checker overrides so this always probes the
# endpoint and public key embedded in the exact sync.js being copied.
env -u KEEPCLUB_SYNC_ENDPOINT -u KEEPCLUB_SYNC_ANON \
  node "$HERE/scripts/check-progress-sync-v2.mjs" \
  || { echo "apply the progress sync migration before deploying the web app"; exit 1; }
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
if [ "$MODE" = "--commit" ]; then
  SRC=$(git -C "$HERE" rev-parse --short HEAD)
  if git diff --cached --quiet; then
    echo "nothing changed — Pages is already at keepclub@$SRC"
    exit 0
  fi
  git commit -q -m "Deploy the app to $DOMAIN root (from keepclub@$SRC)"
  git push -q origin HEAD:main
  echo "pushed — Pages will rebuild"
fi
