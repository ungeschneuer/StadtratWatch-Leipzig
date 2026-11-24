#!/usr/bin/env bash
# Waits for CI on a commit and fails unless it passes. Starts CI on the branch if no run exists: commits pushed with
# the workflow token start no workflow by themselves.
# Usage: wait-for-ci.sh <branch> <commit>
set -euo pipefail

branch="$1"
commit="$2"
timeout_seconds="${CI_TIMEOUT_SECONDS:-1200}"

# A pull request opened with the workflow token leaves a CI run on the commit that has no jobs and never runs
# (action_required or failure). Such a run neither passes nor fails the commit, so it counts as no run at all: it must
# neither hide a successful run nor keep CI from being started.
run_has_jobs() {
  [ "$(gh api "repos/{owner}/{repo}/actions/runs/$1/jobs" --jq '.total_count')" -gt 0 ]
}

ci_state() {
  local runs run_id
  runs="$(gh run list --workflow ci.yml --commit "$commit" --limit 20 --json databaseId,status,conclusion)"
  if jq -e 'any(.[]; .conclusion == "success")' <<<"$runs" >/dev/null; then
    echo success
  elif jq -e 'any(.[]; .status != "completed")' <<<"$runs" >/dev/null; then
    echo pending
  else
    for run_id in $(jq -r '.[].databaseId' <<<"$runs"); do
      if run_has_jobs "$run_id"; then
        jq -r --argjson id "$run_id" '.[] | select(.databaseId == $id) | .conclusion' <<<"$runs"
        return
      fi
    done
    echo none
  fi
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
