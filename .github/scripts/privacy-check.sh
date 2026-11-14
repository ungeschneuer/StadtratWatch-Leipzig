#!/bin/bash
# Keeps private details of the operator out of the public history: the server the runners use, its login, the hosting
# provider and private e-mail addresses. Checks commit identities, messages and added lines.
#
#   privacy-check.sh commits <rev-list args>     the commits git rev-list selects (CI, pre-push)
#   privacy-check.sh staged                      the staged change and the configured identity (pre-commit)
#   privacy-check.sh message <file>              a commit message (commit-msg)
#   privacy-check.sh ref <name>                  a branch or tag name (pre-push, CI)
#
# The patterns themselves must not be in the repository, or the check would publish what it protects. They come from
# PRIVATE_PATTERNS (one extended regular expression per line; a repository secret in CI) or, locally, from
# ~/.config/stadtratwatch/private-patterns. Findings name the commit and file, never the matching text.
set -euo pipefail

patterns="${PRIVATE_PATTERNS:-}"
local_patterns_file="${HOME}/.config/stadtratwatch/private-patterns"
if [ -z "$patterns" ] && [ -f "$local_patterns_file" ]; then
  patterns="$(cat "$local_patterns_file")"
fi
patterns="$(printf '%s\n' "$patterns" | sed -e 's/[[:space:]]*$//' -e '/^$/d' -e '/^#/d')"

if [ -n "${GITHUB_ACTIONS:-}" ]; then
  while IFS= read -r pattern; do
    [ -n "$pattern" ] && echo "::add-mask::$pattern"
  done <<<"$patterns"
fi

findings=0
report() {
  findings=$((findings + 1))
  echo "✗ $1"
}

matches_private() {
  [ -n "$patterns" ] && grep -iE -f <(printf '%s\n' "$patterns") >/dev/null
}

# Only noreply addresses (GitHub users, GitHub itself, bots): a personal address in a commit is public for good.
public_email() {
  [[ "$1" == *@users.noreply.github.com || "$1" == noreply@* ]]
}

check_identity() {
  local where="$1" name="$2" email="$3"
  public_email "$email" || report "$where: e-mail address is not a noreply address"
  printf '%s %s\n' "$name" "$email" | matches_private && report "$where: name or e-mail address contains a private detail"
  return 0
}

# Prints the files whose added lines contain a private detail, from a patch on stdin.
files_with_private_additions() {
  [ -z "$patterns" ] && return 0
  awk '/^\+\+\+ b\// { file = substr($0, 7); next } /^\+/ && !/^\+\+\+/ { print file "\t" substr($0, 2) }' |
    grep -iE -f <(printf '%s\n' "$patterns") | cut -f1 | sort -u || true
}

check_commits() {
  local commit
  for commit in $(git rev-list "$@"); do
    local short
    short="$(git rev-parse --short "$commit")"
    check_identity "$short author" "$(git log -1 --format=%an "$commit")" "$(git log -1 --format=%ae "$commit")"
    check_identity "$short committer" "$(git log -1 --format=%cn "$commit")" "$(git log -1 --format=%ce "$commit")"
    git log -1 --format=%B "$commit" | matches_private && report "$short: commit message contains a private detail"
    while IFS= read -r file; do
      [ -n "$file" ] && report "$short: $file adds a private detail"
    done < <(git show --unified=0 --no-color --format= "$commit" | files_with_private_additions)
  done
}

check_staged() {
  check_identity "author" "$(git config user.name)" "$(git config user.email)"
  while IFS= read -r file; do
    [ -n "$file" ] && report "$file adds a private detail"
  done < <(git diff --cached --unified=0 --no-color | files_with_private_additions)
}

check_ref() {
  printf "%s\n" "$1" | matches_private && report "branch or tag name contains a private detail"
  return 0
}

check_message() {
  grep -v '^#' "$1" | matches_private && report "commit message contains a private detail"
  return 0
}

case "${1:-}" in
  commits)
    shift
    check_commits "$@"
    ;;
  staged) check_staged ;;
  message) check_message "$2" ;;
  ref) check_ref "$2" ;;
  *)
    echo "Usage: privacy-check.sh commits <range> | staged | message <file> | ref <name>" >&2
    exit 2
    ;;
esac

if [ -z "$patterns" ]; then
  echo "Note: no private patterns configured (PRIVATE_PATTERNS or $local_patterns_file); only e-mail addresses checked."
fi
if [ "$findings" -gt 0 ]; then
  echo "❌ Privacy check: $findings finding(s). Rewrite the commit (amend or rebase) before it is pushed."
  exit 1
fi
echo "✓ Privacy check"
