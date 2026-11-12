# Lokaler Runner: Niederschriften aus ALLRIS

ALLRIS (`ratsinformation.leipzig.de`) nimmt von GitHub Actions keine Verbindung an: Der Verbindungsaufbau läuft in den
Timeout, auch ohne User-Agent, während OParl, Open Data, Mediathek und Video-Hoster antworten (geprüft am 12.11.2026).
Amtliche Ergebnisse (to020) und Verlaufsprotokolle kommen deshalb von einem Rechner, dem ALLRIS antwortet. Alles andere
läuft weiter in GitHub Actions.

`leipzig-minutes.sh` arbeitet in einer eigenen Arbeitskopie unter
`~/Library/Application Support/StadtratWatch-Leipzig/repository`:

1. Daten-Branch `data/leipzig-votings` holen und `main` hineinführen (wie `.github/scripts/leipzig-data-branch.sh`).
2. `leipzig-votings --corrections-only` mit Netz: liest fehlende Niederschriften und wendet sie mit den Korrekturen an.
3. `leipzig-site-data` erzeugt die Seitendaten neu.
4. Gibt es Änderungen unter `data/leipzig-8`, ein Commit mit deiner Git-Identität und Push auf den Daten-Branch. Der
   Pull Request des Daten-Branches nimmt ihn auf; `leipzig-review-recheck` aktualisiert nachts die Prüf-Issues.

Bei einem Fehler zeigt macOS eine Mitteilung, Einzelheiten stehen im Log.

## Einrichten

Voraussetzungen: Git mit Zugang zum Repository (Schlüsselbund), Node (für `npx`) oder Bun.

```bash
local-runner/install.sh                      # täglich 07:17 Uhr; LEIPZIG_MINUTES_HOUR/_MINUTE ändern die Zeit
launchctl kickstart gui/$(id -u)/online.schneuer.stadtratwatch-leipzig.minutes   # sofort ausführen
tail -f ~/Library/Logs/StadtratWatch-Leipzig/minutes.log
local-runner/install.sh --uninstall          # entfernen
```

launchd holt einen verpassten Lauf nach, wenn der Mac zur geplanten Zeit geschlafen hat. Ist er ausgeschaltet, fällt
der Lauf aus; der nächste holt alles nach, was fehlt. Die Protokolle erscheinen etwa zwei Monate nach der Sitzung, ein
Tag Verzögerung ist also unkritisch.

`install.sh` legt eine Kopie des Skripts neben die Arbeitskopie: Branch-Wechsel in deiner Entwicklungs-Arbeitskopie
ändern den Job nicht. Nach Änderungen am Skript `install.sh` erneut ausführen.

Probelauf ohne Push: `local-runner/leipzig-minutes.sh --dry-run`.
