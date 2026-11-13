# ALLRIS-Runner: Niederschriften vom eigenen Server

ALLRIS (`ratsinformation.leipzig.de`) nimmt von GitHub Actions keine Verbindung an: Der Verbindungsaufbau läuft in den
Timeout, auch ohne User-Agent, während OParl, Open Data, Mediathek und Video-Hoster antworten (geprüft am 12.11.2026).
Amtliche Ergebnisse (to020) und Verlaufsprotokolle holt deshalb ein Linux-Server, dem ALLRIS antwortet. Alles andere
läuft weiter in GitHub Actions. Seit 13.11.2026 läuft der Runner per cron auf einem Server des Betreibers.

`leipzig-minutes.sh` arbeitet in einer eigenen Arbeitskopie unter `~/.local/state/stadtratwatch-leipzig/repository`:

1. Daten-Branch `data/leipzig-votings` holen und `main` hineinführen (wie `.github/scripts/leipzig-data-branch.sh`).
2. `leipzig-votings --corrections-only` mit Netz: liest fehlende Niederschriften und wendet sie mit den Korrekturen an.
3. `leipzig-site-data` erzeugt die Seitendaten neu.
4. Gibt es Änderungen unter `data/leipzig-8`, ein Commit „StadtratWatch Leipzig (ALLRIS-Runner)“ und Push auf den
   Daten-Branch. Der Pull Request des Daten-Branches nimmt ihn auf; `leipzig-review-recheck` aktualisiert nachts die
   Prüf-Issues.

Gepusht wird mit einem Deploy-Key, der nur dieses Repository erreicht.

## Einrichten

Auf dem Server, als normaler Benutzer (Voraussetzungen: `git`, `curl`, `unzip`, systemd):

```bash
git clone https://github.com/ungeschneuer/StadtratWatch-Leipzig.git ~/stadtratwatch-leipzig-setup
~/stadtratwatch-leipzig-setup/minutes-runner/install.sh
```

`install.sh` installiert Bun nach `~/.bun` (Version aus `package.json`), erzeugt den Deploy-Key
`~/.ssh/stadtratwatch-leipzig-deploy`, legt den systemd-User-Dienst mit Timer an (täglich 07:17 Uhr Europe/Berlin,
holt verpasste Läufe nach) und schaltet Linger ein, damit der Timer ohne Anmeldung läuft.

Den ausgegebenen öffentlichen Schlüssel im Repository eintragen: Settings → Deploy keys → Add deploy key, „Allow write
access“ an. Danach:

```bash
~/.local/lib/stadtratwatch-leipzig/leipzig-minutes.sh --dry-run   # Probelauf ohne Push
systemctl --user start stadtratwatch-leipzig-minutes              # echter Lauf
journalctl --user -u stadtratwatch-leipzig-minutes                # Log
systemctl --user list-timers stadtratwatch-leipzig-minutes        # nächster Lauf
~/stadtratwatch-leipzig-setup/minutes-runner/install.sh --uninstall
```

Nach Änderungen am Skript: `git -C ~/stadtratwatch-leipzig-setup pull` und `install.sh` erneut ausführen.

### Ohne systemd: cron (z. B. Shared Hosting)

Hat der Server keine systemd-User-Dienste, legt `install-cron.sh` alles in einen Ordner und richtet einen Cronjob ein
(täglich 07:17 Uhr, `CRON_TZ=Europe/Berlin`). Bun und Deploy-Key wie oben:

```bash
mkdir -p ~/bots/stadtratwatch-leipzig
git clone https://github.com/ungeschneuer/StadtratWatch-Leipzig.git ~/bots/stadtratwatch-leipzig/setup
~/bots/stadtratwatch-leipzig/setup/minutes-runner/install-cron.sh ~/bots/stadtratwatch-leipzig
```

Im Ordner liegen dann `run.sh` (setzt Pfade und liest `env`), die Kopie von `leipzig-minutes.sh`, die Arbeitskopie
unter `state/` und das Log `logs/minutes.log`.

```bash
~/bots/stadtratwatch-leipzig/run.sh --dry-run    # Probelauf ohne Push
~/bots/stadtratwatch-leipzig/run.sh              # echter Lauf
tail -f ~/bots/stadtratwatch-leipzig/logs/minutes.log
~/bots/stadtratwatch-leipzig/setup/minutes-runner/install-cron.sh ~/bots/stadtratwatch-leipzig --uninstall
```

Nach Änderungen am Skript: `git -C ~/bots/stadtratwatch-leipzig/setup pull` und `install-cron.sh` erneut ausführen.

### Laufzeit

Fertige Sitzungen (Beschlussprotokoll und Verlaufsprotokoll gespeichert) kosten je eine Anfrage an ALLRIS. Teuer sind
nur Sitzungen ohne Beschlussprotokoll: Ihre Tagesordnungsseiten werden höchstens alle 20 Stunden neu gelesen, etwa 100
Anfragen je Sitzung. Der erste Lauf dauert länger, weil die Arbeitskopie noch keinen PDF-Cache hat.

## Einstellungen

Optional in `~/.config/stadtratwatch-leipzig.env` (systemd) bzw. `<ordner>/env` (cron):

| Variable | Bedeutung |
|---|---|
| `LEIPZIG_FAILURE_COMMAND` | Befehl bei einem Fehler, die Meldung steht in `$LEIPZIG_FAILURE_MESSAGE` (z. B. `curl -fsS -d "$LEIPZIG_FAILURE_MESSAGE" https://ntfy.sh/<thema>`) |
| `LEIPZIG_COMMIT_NAME`, `LEIPZIG_COMMIT_EMAIL` | Git-Identität der Commits beim ersten Klonen |
| `LEIPZIG_DATA_BRANCH` | Daten-Branch, Standard `data/leipzig-votings` |

`LEIPZIG_MINUTES_TIME` (Standard `07:17`) beim Aufruf von `install.sh` oder `install-cron.sh` setzt die Uhrzeit.

Die Protokolle erscheinen etwa zwei Monate nach der Sitzung; fällt ein Lauf aus, holt der nächste alles nach.
