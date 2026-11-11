#!/usr/bin/env bash
# Opens, updates, reopens or closes one GitHub issue per session with review cases, from the bodies that
# src/scripts/leipzig-votings/review-issues.ts wrote. Issues are found again by the marker in their body.
# Usage: leipzig-review-issues.sh <issues.json>
# Optional repository variable LEIPZIG_REVIEWERS: comma-separated GitHub logins assigned to new issues, so they are
# notified.
set -euo pipefail

issues_file="$1"
label='leipzig-review'

gh label create "$label" --color FBCA04 --description 'Leipziger Abstimmungen prüfen' 2>/dev/null || true
existing="$(gh issue list --label "$label" --state all --limit 500 --json number,state,body)"

# The list is read from its own descriptor, so a gh call cannot swallow the remaining lines from stdin.
while read -r issue <&3; do
  session="$(jq -r '.sessionId' <<<"$issue")"
  title="$(jq -r '.title' <<<"$issue")"
  open="$(jq -r '.open' <<<"$issue")"
  body_file="$(jq -r '.bodyFile' <<<"$issue")"
  marker="<!-- leipzig-review:$session -->"
  match="$(jq -c --arg marker "$marker" '[.[] | select(.body | startswith($marker))][0] // empty' <<<"$existing")"

  if [ -z "$match" ]; then
    [ "$open" -eq 0 ] && continue
    assignees=()
    [ -n "${LEIPZIG_REVIEWERS:-}" ] && assignees=(--assignee "$LEIPZIG_REVIEWERS")
    gh issue create --title "$title" --body-file "$body_file" --label "$label" ${assignees[@]+"${assignees[@]}"}
    continue
  fi

  number="$(jq -r '.number' <<<"$match")"
  state="$(jq -r '.state' <<<"$match")"
  gh issue edit "$number" --title "$title" --body-file "$body_file"
  if [ "$open" -eq 0 ] && [ "$state" = 'OPEN' ]; then
    gh issue close "$number" --comment 'Alle Fälle dieser Sitzung sind entschieden.'
  elif [ "$open" -gt 0 ] && [ "$state" = 'CLOSED' ]; then
    gh issue reopen "$number" --comment "Es sind wieder $open Fälle offen."
  fi
done 3< <(jq -c '.[]' "$issues_file")
