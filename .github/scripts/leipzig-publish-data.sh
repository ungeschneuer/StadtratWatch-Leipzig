#!/usr/bin/env bash
# Publishes the reviewers' decisions of the day: merges the data pull request and deploys the site, but only when the
# decisions are applied and checked. A new session waits for the operator, who decides on its first publication.
set -euo pipefail

branch="${LEIPZIG_DATA_BRANCH:-data/leipzig-votings}"
ci_timeout_seconds=1200

git fetch --quiet origin main "$branch"
head_sha="$(git rev-parse "origin/$branch")"

if git diff --quiet origin/main "origin/$branch" -- data/leipzig-8; then
  echo "Keine neuen Daten auf $branch."
  exit 0
fi

new_sessions="$(git diff --name-only --diff-filter=A origin/main..."origin/$branch" -- 'data/leipzig-8/*/votings-*.json')"
if [ -n "$new_sessions" ]; then
  echo "::notice::$branch enthält neue Sitzungen; die erste Veröffentlichung bleibt dem Betreiber überlassen:"
  echo "$new_sessions"
  exit 0
fi

# A decision is applied once a successful recheck run started on it or on a later commit. A run that ended in a
# rejected push or was cancelled has not applied it.
last_decision="$(git log -1 --format=%H "origin/$branch" -- 'data/leipzig-8/*/corrections-*.json')"
decision_applied() {
  local run_commit
  for run_commit in $(gh run list --workflow leipzig-review-recheck.yml --branch "$branch" --status success --limit 30 \
    --json headSha --jq '.[].headSha'); do
    git merge-base --is-ancestor "$last_decision" "$run_commit" 2>/dev/null && return 0
  done
  return 1
}
if [ -n "$last_decision" ] && ! git merge-base --is-ancestor "$last_decision" origin/main && ! decision_applied; then
  echo "::notice::Die letzte Prüfentscheidung ($last_decision) ist noch nicht angewendet; nächster Versuch morgen."
  exit 0
fi

ci_conclusion() {
  gh run list --workflow ci.yml --commit "$head_sha" --limit 1 --json status,conclusion \
    --jq '.[0] | if . == null then "none" elif .status != "completed" then "pending" else .conclusion end'
}

if [ "$(ci_conclusion)" = none ]; then
  gh workflow run ci.yml --ref "$branch"
fi
waited=0
while [ "$(ci_conclusion)" = none ] || [ "$(ci_conclusion)" = pending ]; do
  if [ "$waited" -ge "$ci_timeout_seconds" ]; then
    echo "::error::CI für $head_sha ist nicht rechtzeitig fertig geworden."
    exit 1
  fi
  sleep 30
  waited=$((waited + 30))
done
if [ "$(ci_conclusion)" != success ]; then
  echo "::error::CI für $head_sha ist nicht grün; die Daten werden nicht veröffentlicht."
  exit 1
fi

pull_request="$(gh pr list --head "$branch" --base main --state open --json number --jq '.[0].number // empty')"
if [ -z "$pull_request" ]; then
  pull_request="$(gh pr create --base main --head "$branch" \
    --title "data(leipzig): Prüfentscheidungen vom $(date +%d.%m.%Y)" \
    --body 'Automatisch erzeugt vom Workflow „Leipzig data publish“: Prüfentscheidungen und Niederschriften des Tages, ohne neue Sitzungen.' |
    grep -o '[0-9]*$')"
fi

# --match-head-commit refuses the merge if a reviewer saved after the checks above.
gh pr merge "$pull_request" --merge --match-head-commit "$head_sha"
# A merge with the workflow token starts no other workflow, so the deployment is started here.
gh workflow run deploy.yml --ref main
echo "Daten-PR #$pull_request gemergt, Deployment gestartet."
