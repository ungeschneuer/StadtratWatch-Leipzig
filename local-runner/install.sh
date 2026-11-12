#!/usr/bin/env bash
# Installs the minutes runner as a launchd job of the logged-in user: daily, and after waking if the Mac slept through
# the time. Run again to update; `./install.sh --uninstall` removes it.
set -euo pipefail

label='online.schneuer.stadtratwatch-leipzig.minutes'
runner_dir="$HOME/Library/Application Support/StadtratWatch-Leipzig"
plist="$HOME/Library/LaunchAgents/$label.plist"
log_file="$HOME/Library/Logs/StadtratWatch-Leipzig/minutes.log"
hour="${LEIPZIG_MINUTES_HOUR:-7}"
minute="${LEIPZIG_MINUTES_MINUTE:-17}"

launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
if [ "${1:-}" = '--uninstall' ]; then
  rm -f "$plist" "$runner_dir/leipzig-minutes.sh"
  echo "Entfernt. Arbeitskopie und Log bleiben: $runner_dir, $log_file"
  exit 0
fi

mkdir -p "$runner_dir" "$(dirname "$plist")" "$(dirname "$log_file")"
# launchd runs a copy outside the repository, so switching branches in a working copy cannot change the job.
cp "$(dirname "$0")/leipzig-minutes.sh" "$runner_dir/leipzig-minutes.sh"

cat >"$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$runner_dir/leipzig-minutes.sh</string></array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>$hour</integer><key>Minute</key><integer>$minute</integer></dict>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$HOME/.bun/bin:$HOME/.n/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StandardOutPath</key><string>$log_file</string>
  <key>StandardErrorPath</key><string>$log_file</string>
  <key>ProcessType</key><string>Background</string>
</dict>
</plist>
PLIST

launchctl bootstrap "gui/$(id -u)" "$plist"
printf 'Installiert: täglich %02d:%02d Uhr. Log: %s\nSofort ausführen: launchctl kickstart gui/%s/%s\n' \
  "$hour" "$minute" "$log_file" "$(id -u)" "$label"
