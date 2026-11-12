# StadtratWatch Leipzig

Wie stimmen die Mitglieder der Leipziger Ratsversammlung ab? StadtratWatch Leipzig liest die Stimmen jedes
Ratsmitglieds aus der Abstimmungstafel der Video-Aufzeichnungen, gleicht sie mit den Protokollen der Stadt ab und
veröffentlicht sie als Website, als API und als offene Daten. Dazu kommen die Redebeiträge aus dem Verlaufsprotokoll.

**Website:** <https://ungeschneuer.github.io/StadtratWatch-web/>

StadtratWatch Leipzig ist ein unabhängiges, ehrenamtliches Projekt und keine Seite der Stadt Leipzig. Es ist ein Fork
von [StadtratWatch](https://github.com/JensWinter/StadtratWatch-web) für den Magdeburger Stadtrat
([stadtratwatch.de](https://www.stadtratwatch.de), [Code for Magdeburg](https://codefor.de/magdeburg/)) und übernimmt
dessen Web-Anwendung und Auswertungen.

## Was die Seite zeigt

- Abstimmungen jeder Sitzung mit Aufzeichnung, Stimme je Person, Fraktion und Wahlliste am Sitzungstag
- Auswertungen je Person, Fraktion und Partei: Teilnahme, Enthaltungen, Abstimmungserfolg, Geschlossenheit, Redezeit
- Redebeiträge aus dem Verlaufsprotokoll mit Zeitsprung in die Aufzeichnung
- Öffentliche API v1 ([Dokumentation](./astro/src/pages/api/v1/README.md))

Erfasst sind nur Sitzungen mit Aufzeichnung und nur Abstimmungen über die elektronische Tafel. Vorläufige Ergebnisse
und Abstimmungen, deren Prüfung noch läuft, sind auf der Seite gekennzeichnet.

## Wie die Daten entstehen

| Schritt | Skript | Ergebnis |
| --- | --- | --- |
| Aufzeichnungen finden, Untertitel sichern | [`leipzig-recordings`](./src/scripts/leipzig-recordings/README.md) | `recordings.json`, `subtitles-*.vtt` |
| Mitglieder, Fraktionen, Wahllisten | [`leipzig-members`](./src/scripts/leipzig-members/README.md) | `members.json` |
| Stimmen von der Tafel lesen und prüfen | [`leipzig-votings`](./src/scripts/leipzig-votings/README.md) | `votings-*.json`, `votes-*.csv` |
| Vorlagen und Einreichende | [`leipzig-papers`](./src/scripts/leipzig-papers/README.md) | `papers.json` |
| Dateien für die Seite | [`leipzig-site-data`](./src/scripts/leipzig-site-data/README.md) | `registry.json`, `session-scan-*.json`, `session-speeches-*.json` |

Die Workflows unter `.github/workflows/` führen die Schritte aus. Neue Daten und Korrekturen kommen über den Branch
`data/leipzig-votings` und dessen Pull Request; Abstimmungen, deren Prüfung fehlschlägt, entscheiden Prüfende in der
[Prüfoberfläche](./session-review/README.md). Die Architektur beschreibt [`docs/arc42/`](./docs/arc42/index.adoc),
den Stand der Arbeit [TODO.md](./TODO.md).

## Entwicklung

```bash
bun install                       # Abhängigkeiten der Skripte
bun run test                      # Tests der Skripte
cd astro && npm install && npm run dev   # Website lokal
```

Mehr in [AGENTS.md](./AGENTS.md).

## Lizenzen

- **Code:** MIT, siehe [LICENSE](LICENSE). Der Urheberrechtsvermerk von StadtratWatch bleibt erhalten.
- **Daten aus OParl und dem Open-Data-Portal:** © Stadt Leipzig, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
  bzw. [Datenlizenz Deutschland – Namensnennung 2.0](https://www.govdata.de/dl-de/by-2-0).
- **Selbst erhobene Stimmen:** [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- **Redetexte:** aus dem Verlaufsprotokoll der Stadt Leipzig (§ 48 UrhG), nicht unter CC0.

## Kontakt

Marcel Schneuer, [hallo@schneuer.online](mailto:hallo@schneuer.online) ·
[Issues](https://github.com/ungeschneuer/StadtratWatch-web/issues)
