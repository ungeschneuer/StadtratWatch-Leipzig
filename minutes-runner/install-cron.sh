#!/usr/bin/env bash
# Installs the minutes runner as a daily cron job, for servers without systemd user services (e.g. shared hosting).
# Everything lives in one folder: `./install-cron.sh ~/bots/stadtratwatch-leipzig`. Run again to update;
# `./install-cron.sh <folder> --uninstall` removes the cron job. Needs git, curl and crontab.
set -euo pipefail

runner_home="${1:?Ordner angeben, z. B. ~/bots/stadtratwatch-leipzig}"
runner_home="$(mkdir -p "$runner_home" && cd "$runner_home" && pwd)"
deploy_key="$HOME/.ssh/stadtratwatch-leipzig-deploy"
time="${LEIPZIG_MINUTES_TIME:-07:17}"
cron_marker='# stadtratwatch-leipzig-minutes'

# The job is a block of three lines: marker, CRON_TZ (applies to the lines after it) and the job.
without_runner_job() { crontab -l 2>/dev/null | awk -v marker="$cron_marker" '$0 == marker { skip = 3 } skip > 0 { skip--; next } { print }'; }

if [ "${2:-}" = '--uninstall' ]; then
  other_jobs="$(without_runner_job)"
  printf '%s\n' "$other_jobs" | sed '/^$/d' | crontab -
  echo "Cronjob entfernt. $runner_home und $deploy_key bleiben."
  exit 0
fi

if ! command -v bun >/dev/null && [ ! -x "$HOME/.bun/bin/bun" ]; then
  version="$(sed -n 's/.*"packageManager": *"bun@\([^"]*\)".*/\1/p' "$(dirname "$0")/../package.json")"
  curl -fsSL https://bun.sh/install | bash -s "bun-v$version" >/dev/null
fi

if [ ! -f "$deploy_key" ]; then
  ssh-keygen -q -t ed25519 -N '' -C "stadtratwatch-leipzig-minutes@$(hostname)" -f "$deploy_key"
  echo "Neuer Deploy-Key, mit Schreibzugriff im Repository eintragen:"
  cat "$deploy_key.pub"
fi
grep -q '^github.com ' "$HOME/.ssh/known_hosts" 2>/dev/null || ssh-keyscan -t ed25519 github.com >>"$HOME/.ssh/known_hosts" 2>/dev/null

mkdir -p "$runner_home/logs"
# cron runs a copy outside the repository, so a checkout of another branch cannot change the job.
cp "$(dirname "$0")/leipzig-minutes.sh" "$runner_home/leipzig-minutes.sh"
chmod +x "$runner_home/leipzig-minutes.sh"

cat >"$runner_home/run.sh" <<RUN
#!/usr/bin/env bash
export PATH="\$HOME/.bun/bin:/usr/local/bin:/usr/bin:/bin"
export LEIPZIG_RUNNER_DIR="$runner_home/state"
export LEIPZIG_DEPLOY_KEY="$deploy_key"
if [ -f "$runner_home/env" ]; then set -a; . "$runner_home/env"; set +a; fi
exec "$runner_home/leipzig-minutes.sh" "\$@"
RUN
chmod +x "$runner_home/run.sh"

hour="${time%%:*}"
minute="${time##*:}"
other_jobs="$(without_runner_job)"
{
  printf '%s\n' "$other_jobs" | sed '/^$/d'
  echo "$cron_marker"
  echo 'CRON_TZ=Europe/Berlin'
  echo "$((10#$minute)) $((10#$hour)) * * * $runner_home/run.sh >>$runner_home/logs/minutes.log 2>&1"
} | crontab -

printf 'Installiert: täglich %s Uhr (Europe/Berlin).\nSofort: %s/run.sh\nLog: %s/logs/minutes.log\n' \
  "$time" "$runner_home" "$runner_home"
