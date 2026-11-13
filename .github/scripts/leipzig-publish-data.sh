#!/usr/bin/env bash
# Publishes the data branch: merges the data pull request and deploys the site once every review decision is applied
# and CI is green. New sessions go online with the check status of each vote; the reviewers are told what was
# published, so that they can look at it.
set -euo pipefail

branch="${LEIPZIG_DATA_BRANCH:-data/leipzig-votings}"
owner="${GITHUB_REPOSITORY%%/*}"
site_url="https://${owner}.github.io/${GITHUB_REPOSITORY#*/}"

git fetch --quiet origin main "$branch"
head_sha="$(git rev-parse "origin/$branch")"

if git diff --quiet origin/main "origin/$branch" -- data/leipzig-8; then
  echo "Keine neuen Daten auf $branch."
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
  echo "::notice::Die letzte Prüfentscheidung ($last_decision) ist noch nicht angewendet; nächster Versuch beim nächsten Lauf."
  exit 0
fi

.github/scripts/wait-for-ci.sh "$branch" "$head_sha"

session_ids_of() {
  git diff --name-only --diff-filter="$1" origin/main..."origin/$branch" -- "data/leipzig-8/*/$2-*.json" |
    sed -E 's#^data/leipzig-8/([0-9-]+)/.*#\1#' | sort -u
}
new_sessions="$(session_ids_of A votings)"
decided_sessions="$(session_ids_of AM corrections | grep -vxF -f <(printf '%s\n' "$new_sessions") || true)"

open_cases_of() {
  git show "origin/$branch:data/leipzig-8/review-index.json" |
    jq --arg session "$1" '[.sessions[] | select(.sessionId == $session) | .open] | add // 0'
}
summary="$(
  echo "Veröffentlicht: Daten-PR mit ${head_sha:0:7}."
  if [ -n "$new_sessions" ]; then
    echo
    echo '**Neue Sitzungen** – ungeprüfte Abstimmungen erscheinen „in Prüfung“, bitte ansehen:'
    for session in $new_sessions; do
      votings="$(git show "origin/$branch:data/leipzig-8/$session/votings-$session.json" | jq '.votings | length')"
      echo "- [$session]($site_url/wahlperiode-8/sitzung/$session/): $votings Abstimmungen, $(open_cases_of "$session") offene Prüffälle ([Prüfseite]($site_url/review/leipzig/$session))"
    done
  fi
  if [ -n "$decided_sessions" ]; then
    echo
    echo '**Prüfentscheidungen** zu:'
    for session in $decided_sessions; do
      echo "- [$session]($site_url/wahlperiode-8/sitzung/$session/)"
    done
  fi
  if [ -n "${LEIPZIG_REVIEWERS:-}" ]; then
    echo
    echo "$LEIPZIG_REVIEWERS" | tr ',' '\n' | sed -E 's/^ *(.+)$/@\1/' | paste -sd ' ' -
  fi
)"

pull_request="$(gh pr list --head "$branch" --base main --state open --json number --jq '.[0].number // empty')"
if [ -z "$pull_request" ]; then
  pull_request="$(gh pr create --base main --head "$branch" \
    --title "data(leipzig): Daten vom $(date +%d.%m.%Y)" \
    --body 'Automatisch erzeugt vom Workflow „Leipzig data publish“.' | grep -oE '[0-9]+$')"
fi

# --match-head-commit refuses the merge if a reviewer saved after the checks above.
gh pr merge "$pull_request" --merge --match-head-commit "$head_sha"
# A merge with the workflow token starts no other workflow, so the deployment is started here.
gh workflow run deploy.yml --ref main
# A mention in a comment notifies the reviewers by GitHub notification and e-mail.
gh pr comment "$pull_request" --body "$summary"
echo "$summary"
