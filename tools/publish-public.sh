#!/usr/bin/env bash
# Publish the current main to the public repo (remote "public") as a single
# fresh commit, without the files .gitignore keeps private (copied reviews and
# quotes). The full history lives in the private repo (remote "origin").
#
#   bash tools/publish-public.sh "message"
set -euo pipefail
msg="${1:-Publish Byte Acres}"
root="$(git rev-parse --show-toplevel)"
tmp="$(mktemp -d)"
git -C "$root" worktree add --detach "$tmp" main >/dev/null
cd "$tmp"
git checkout -q --orphan public-snapshot
# drop everything .gitignore now lists, even where the private repo still tracks it
git ls-files -ci --exclude-standard -z | xargs -0 -r git rm -q --cached
git commit -q -m "$msg"
git push -f public public-snapshot:main
cd "$root"
git worktree remove --force "$tmp"
git branch -D public-snapshot >/dev/null 2>&1 || true
echo "published to $(git remote get-url public)"
