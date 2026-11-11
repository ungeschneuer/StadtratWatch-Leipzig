#!/usr/bin/env bash
# Checks out the branch that collects the Leipzig voting data and the reviewers' corrections, brought up to date with
# main. Reviewers commit to this branch from the review UI, so it is never reset; new data is committed on top.
set -euo pipefail

branch="${LEIPZIG_DATA_BRANCH:-data/leipzig-votings}"

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

if git ls-remote --exit-code --heads origin "$branch" >/dev/null; then
  git fetch origin "$branch" main
  git checkout -B "$branch" "origin/$branch"
  if ! git merge --no-edit origin/main; then
    echo "::error::main lässt sich nicht konfliktfrei in $branch übernehmen; bitte von Hand zusammenführen."
    exit 1
  fi
else
  git checkout -B "$branch"
fi
