#!/usr/bin/env bash
# Waits for CI on a commit and fails unless it passes. Starts CI on the branch if no run exists: commits pushed with
# the workflow token start no workflow by themselves.
# Usage: wait-for-ci.sh <branch> <commit>
set -euo pipefail

branch="$1"
commit="$2"
timeout_seconds="${CI_TIMEOUT_SECONDS:-1200}"

# A pull request opened with the workflow token also leaves a CI run on the commit that has no jobs and never runs
# (action_required or failure). It must not hide the run the workflows started, so any successful run counts.
ci_state() {
  gh run list --workflow ci.yml --commit "$commit" --limit 20 --json status,conclusion --jq '
    if length == 0 then "none"
    elif any(.[]; .conclusion == "success") then "success"
    elif any(.[]; .status != "completed") then "pending"
    else .[0].conclusion end'
}

if [ "$(ci_state)" = none ]; then
  gh workflow run ci.yml --ref "$branch"
fi
waited=0
state="$(ci_state)"
while [ "$state" = none ] || [ "$state" = pending ]; do
  if [ "$waited" -ge "$timeout_seconds" ]; then
    echo "::error::CI für $commit ist nicht rechtzeitig fertig geworden."
    exit 1
  fi
  sleep 30
  waited=$((waited + 30))
  state="$(ci_state)"
done
if [ "$state" != success ]; then
  echo "::error::CI für $commit ist nicht grün ($state)."
  exit 1
fi
