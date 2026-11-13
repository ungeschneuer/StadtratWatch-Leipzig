#!/usr/bin/env bash
# Pushes the checked-out data branch. Reviewers commit corrections from the review UI while a run is working, so a
# rejected push merges their commits and tries again. Merge rather than rebase: the branch carries merges from main,
# which a rebase would flatten. Their commits touch only corrections-*.json, the runs only generated files; whatever
# they changed is applied by the run their own push starts.
set -euo pipefail

branch="${LEIPZIG_DATA_BRANCH:-data/leipzig-votings}"

for attempt in 1 2 3 4 5; do
  if git push origin "HEAD:$branch"; then
    exit 0
  fi
  echo "Push auf $branch abgelehnt (Versuch $attempt), übernehme die neuen Commits."
  sleep $((2 ** attempt))
  git fetch origin "$branch"
  if ! git merge --no-edit "origin/$branch"; then
    echo "::error::Neue Commits auf $branch lassen sich nicht konfliktfrei übernehmen; bitte von Hand zusammenführen."
    exit 1
  fi
done

echo "::error::Push auf $branch nach mehreren Versuchen abgelehnt."
exit 1
