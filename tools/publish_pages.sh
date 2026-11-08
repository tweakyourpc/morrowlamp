#!/usr/bin/env bash
# Publish the website to GitHub Pages: https://tweakyourpc.github.io/morrowlamp/
#
#   tools/publish_pages.sh            build dist/, commit it to the gh-pages branch, push
#
# The site is what tools/publish_site.py puts in dist/ (the classic editions at the
# root, the remaster at remastered.html). It goes out on its own orphan branch, built
# in a temporary worktree, so the working branch is never touched. Free, and far
# under GitHub Pages' limits (1 GB a site, 100 MB a file); Netlify's free plan only
# takes a zip under 10 MB, which the voices alone exceed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${MORROW_PAGES_REMOTE:-origin}"
BRANCH=gh-pages
cd "$ROOT"

python3 tools/publish_site.py
touch dist/.nojekyll                     # serve every file as it is

work="$(mktemp -d)"
trap 'git worktree remove --force "$work" >/dev/null 2>&1 || true; rm -rf "$work"' EXIT
if git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
  git fetch -q "$REMOTE" "$BRANCH"
  git worktree add -q -B "$BRANCH" "$work" "$REMOTE/$BRANCH"
else
  git worktree add -q --detach "$work"
  git -C "$work" checkout -q --orphan "$BRANCH"
fi
git -C "$work" rm -rqf --ignore-unmatch . >/dev/null
git -C "$work" clean -fdxq
cp -a dist/. "$work/"
git -C "$work" add -A
if git -C "$work" diff --cached --quiet; then
  echo "gh-pages already matches dist/"
else
  git -C "$work" commit -qm "Publish the site ($(git rev-parse --short HEAD), $(date +%Y-%m-%d))" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
fi
git -C "$work" push -q "$REMOTE" "$BRANCH"
echo "pushed $BRANCH: https://tweakyourpc.github.io/morrowlamp/remastered.html"
