#!/usr/bin/env bash
# Installs the minutes runner as a systemd user service with a daily timer, on the server it should run on. Run again
# to update; `./install.sh --uninstall` removes it. Needs git and bun (installed to ~/.bun if missing).
set -euo pipefail

unit='stadtratwatch-leipzig-minutes'
units_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
program_dir="$HOME/.local/lib/stadtratwatch-leipzig"
deploy_key="$HOME/.ssh/stadtratwatch-leipzig-deploy"
time="${LEIPZIG_MINUTES_TIME:-07:17}"

if [ "${1:-}" = '--uninstall' ]; then
  systemctl --user disable --now "$unit.timer" 2>/dev/null || true
  rm -f "$units_dir/$unit.service" "$units_dir/$unit.timer" "$program_dir/leipzig-minutes.sh"
  systemctl --user daemon-reload
  echo "Entfernt. Arbeitskopie und Deploy-Key bleiben: ~/.local/state/stadtratwatch-leipzig, $deploy_key"
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

mkdir -p "$units_dir" "$program_dir"
# systemd runs a copy outside the repository, so a checkout of another branch cannot change the job.
cp "$(dirname "$0")/leipzig-minutes.sh" "$program_dir/leipzig-minutes.sh"
chmod +x "$program_dir/leipzig-minutes.sh"

cat >"$units_dir/$unit.service" <<UNIT
[Unit]
Description=StadtratWatch Leipzig: Niederschriften aus ALLRIS
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
Environment=PATH=$HOME/.bun/bin:/usr/local/bin:/usr/bin:/bin
EnvironmentFile=-%h/.config/stadtratwatch-leipzig.env
ExecStart=$program_dir/leipzig-minutes.sh
TimeoutStartSec=2h
Nice=10
UNIT

cat >"$units_dir/$unit.timer" <<UNIT
[Unit]
Description=StadtratWatch Leipzig: Niederschriften täglich

[Timer]
OnCalendar=*-*-* $time:00 Europe/Berlin
RandomizedDelaySec=10min
Persistent=true

[Install]
WantedBy=timers.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now "$unit.timer"
loginctl enable-linger "$(id -un)" 2>/dev/null ||
  echo "Hinweis: 'loginctl enable-linger $(id -un)' braucht Root; ohne Linger läuft der Timer nur bei Anmeldung."
printf 'Installiert: täglich %s Uhr (Europe/Berlin).\nSofort: systemctl --user start %s\nLog: journalctl --user -u %s\n' \
  "$time" "$unit" "$unit"
