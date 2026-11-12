#!/usr/bin/env bash
# Fetches the minutes of the Leipzig council from ALLRIS and commits them to the data branch. ALLRIS drops connections
# from GitHub's runners, so this step runs on a server it answers; everything else stays in GitHub Actions. The
# workflows then work with the stored minutes (leipzig-review-recheck updates the review issues every night).
set -euo pipefail

repository_url="${LEIPZIG_REPOSITORY_URL:-git@github.com:ungeschneuer/StadtratWatch-Leipzig.git}"
repository_slug="$(basename "$(dirname "${repository_url#*:}")")/$(basename "$repository_url" .git)"
state_dir="${LEIPZIG_RUNNER_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/stadtratwatch-leipzig}"
working_copy="$state_dir/repository"
deploy_key="${LEIPZIG_DEPLOY_KEY:-$HOME/.ssh/stadtratwatch-leipzig-deploy}"
data_branch="${LEIPZIG_DATA_BRANCH:-data/leipzig-votings}"
dry_run=false
[ "${1:-}" = '--dry-run' ] && dry_run=true

export GIT_SSH_COMMAND="ssh -i $deploy_key -o IdentitiesOnly=yes -o BatchMode=yes"

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

report_failure() {
  log "Fehlgeschlagen: $1"
  if [ -n "${LEIPZIG_FAILURE_COMMAND:-}" ]; then
    LEIPZIG_FAILURE_MESSAGE="$1" bash -c "$LEIPZIG_FAILURE_COMMAND" || true
  fi
}
trap 'report_failure "Zeile $LINENO, siehe journalctl --user -u stadtratwatch-leipzig-minutes"' ERR

# A clone of its own: the runner resets it to the data branch on every run.
prepare_working_copy() {
  if [ ! -d "$working_copy/.git" ]; then
    log "Klone $repository_url"
    mkdir -p "$state_dir"
    git clone --quiet "$repository_url" "$working_copy"
    git -C "$working_copy" config user.name "${LEIPZIG_COMMIT_NAME:-StadtratWatch Leipzig (ALLRIS-Runner)}"
    git -C "$working_copy" config user.email "${LEIPZIG_COMMIT_EMAIL:-$(id -un)@$(hostname -f)}"
  fi
  cd "$working_copy"
  git fetch --quiet origin main "$data_branch"
  git checkout --quiet -B "$data_branch" "origin/$data_branch"
  git reset --quiet --hard "origin/$data_branch"
  git clean --quiet -fd -- data/
  if ! git merge --quiet --no-edit origin/main; then
    git merge --abort
    report_failure "main lässt sich nicht konfliktfrei in $data_branch übernehmen"
    exit 1
  fi
}

fetch_minutes() {
  bun install --frozen-lockfile >/dev/null
  bun src/scripts/leipzig-votings/index.ts --corrections-only \
    --image-base-url "https://github.com/$repository_slug/releases/download/evidence-{session}"
  bun src/scripts/leipzig-site-data/index.ts
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
  report_failure "Push auf $data_branch abgelehnt"
  exit 1
}

log "Start"
prepare_working_copy
fetch_minutes
commit_and_push
log "Fertig"
