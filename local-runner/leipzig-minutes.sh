#!/usr/bin/env bash
# Fetches the minutes of the Leipzig council from ALLRIS and commits them to the data branch. ALLRIS drops connections
# from GitHub's runners, so this step runs on a machine it answers; everything else stays in GitHub Actions. The
# workflows then work with the stored minutes (leipzig-review-recheck updates the review issues every night).
set -euo pipefail

repository_url="${LEIPZIG_REPOSITORY_URL:-https://github.com/ungeschneuer/StadtratWatch-Leipzig.git}"
repository_slug="$(basename "$(dirname "$repository_url")")/$(basename "$repository_url" .git)"
working_copy="${LEIPZIG_RUNNER_DIR:-$HOME/Library/Application Support/StadtratWatch-Leipzig}/repository"
data_branch="${LEIPZIG_DATA_BRANCH:-data/leipzig-votings}"
dry_run=false
[ "${1:-}" = '--dry-run' ] && dry_run=true

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

notify_failure() {
  log "Fehlgeschlagen: $1"
  osascript -e "display notification \"$1\" with title \"StadtratWatch Leipzig\" subtitle \"Niederschriften\"" 2>/dev/null || true
}
trap 'notify_failure "Zeile $LINENO, siehe Log"' ERR

bun_command() {
  if command -v bun >/dev/null; then
    bun "$@"
  else
    npx -y "$(node -p 'require("./package.json").packageManager')" "$@"
  fi
}

# A clone of its own: the runner resets it to the data branch and never touches a working copy someone develops in.
prepare_working_copy() {
  if [ ! -d "$working_copy/.git" ]; then
    log "Klone $repository_url"
    mkdir -p "$(dirname "$working_copy")"
    git clone --quiet "$repository_url" "$working_copy"
  fi
  cd "$working_copy"
  git fetch --quiet origin main "$data_branch"
  git checkout --quiet -B "$data_branch" "origin/$data_branch"
  git reset --quiet --hard "origin/$data_branch"
  git clean --quiet -fd -- data/
  if ! git merge --quiet --no-edit origin/main; then
    git merge --abort
    notify_failure "main lässt sich nicht konfliktfrei in $data_branch übernehmen"
    exit 1
  fi
}

fetch_minutes() {
  bun_command install --frozen-lockfile >/dev/null
  bun_command src/scripts/leipzig-votings/index.ts --corrections-only \
    --image-base-url "https://github.com/$repository_slug/releases/download/evidence-{session}"
  bun_command src/scripts/leipzig-site-data/index.ts
}

# Reviewers commit to the data branch from the review UI at any time, so a rejected push is retried on top of theirs.
commit_and_push() {
  git add data/leipzig-8
  if git diff --cached --quiet; then
    log "Keine neuen Niederschriften"
    return
  fi
  git commit --quiet -m 'data(leipzig): Niederschriften aus ALLRIS übernehmen'
  if $dry_run; then
    log "Probelauf, nicht gepusht: $(git log -1 --format=%h), $(git diff --stat HEAD~1 | tail -1)"
    return
  fi
  for attempt in 1 2 3 4; do
    if git push --quiet origin "HEAD:$data_branch"; then
      log "Neue Niederschriften auf $data_branch: $(git log -1 --format=%h)"
      return
    fi
    sleep $((2 ** attempt))
    git pull --quiet --rebase origin "$data_branch"
  done
  notify_failure "Push auf $data_branch abgelehnt"
  exit 1
}

log "Start"
prepare_working_copy
fetch_minutes
commit_and_push
log "Fertig"
