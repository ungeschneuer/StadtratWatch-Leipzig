# Daten von StadtratWatch Leipzig

Wie jedes Mitglied der Leipziger Ratsversammlung abstimmt, für alle Sitzungen der Wahlperiode VIII, zu denen es eine
Aufzeichnung gibt (seit 17.12.2025). Die Stimmen werden aus der Abstimmungstafel im Video gelesen und mit den
Protokollen der Stadt abgeglichen.

## Downloads

Unter `https://ungeschneuer.github.io/StadtratWatch-Leipzig/data/leipzig-8/`, beschrieben als
[Frictionless Data Package](https://datapackage.org) in `datapackage.json` (Spalten, Typen, Schlüssel, Lizenzen,
Quellen):

| Datei | Eine Zeile je | Schlüssel |
|---|---|---|
| `votings.csv` | veröffentlichter Abstimmung | `votingId` |
| `votes.csv` | Person und Abstimmung | `votingId`, `personId` |
| `sessions.csv` | Sitzungstag mit Aufzeichnung | `sessionId` |
| `persons.csv` | Mitglied in der Wahlperiode | `personId` |
| `faction-memberships.csv` | Fraktionszugehörigkeit mit Zeitraum | `personId`, `factionId`, `start` |

Die Tabellen enthalten genau, was Seite und API zeigen. Die Arbeitsdateien der Auswertung (`votings-<datum>.json` mit
allen Prüfungen, `votes-<datum>.csv` mit Tafelnamen und Sitzstatus, Korrekturen, Protokollauszüge) liegen im
Repository unter [`data/leipzig-8/`](data/leipzig-8/). Die API ist in
[`astro/src/pages/api/v1/README.md`](astro/src/pages/api/v1/README.md) beschrieben.

## Felder

Die Beschreibung jeder Spalte steht in `datapackage.json`. Was mehr als einen Satz braucht:

### Stimme (`vote`)

| Code | Bedeutung |
|---|---|
| `J` | Ja |
| `N` | Nein |
| `E` | Enthaltung |
| `O` | keine Stimme: anwesend ohne Stimmabgabe oder abwesend |

`votings.csv` zählt sie in `yes`, `no`, `abstentions` und `notVoted`. `presentMembers` ist die Zahl der Anwesenden
laut Tafel, einschließlich derer, die nicht abgestimmt haben. Ob jemand mit `O` anwesend oder abwesend war, steht in
`votes-<datum>.csv` (`attendance`).

### Fraktion und Partei (`factionId`, `partyId`)

In `votes.csv` gelten beide **am Sitzungstag**: Wer die Fraktion gewechselt hat, zählt dort, wo er an dem Tag war.
`persons.csv` nennt den Stand heute, `faction-memberships.csv` den Verlauf. Die Fraktionen stammen aus den
Mitgliedschaften in OParl, der Oberbürgermeister hat die Pseudo-Fraktion `oberbuergermeister`, Lücken sind
`fraktionslos`.

**„Partei“ ist die Liste, auf der jemand 2024 kandidiert hat**, nicht die Parteimitgliedschaft: Auch Parteilose stehen
auf Listen, und spätere Austritte kennt die Wahlliste nicht. Abweichungen mit Quelle (Presse, Fraktion) stehen in
[`member-overrides.json`](data/leipzig-8/member-overrides.json) und beginnen einen neuen Zeitraum; `partySource` in
`persons.csv` sagt, woher die Partei kommt.

### Ergebnis und erforderliche Mehrheit (`result`, `majorityRequirement`)

`result` ist berechnet, nicht abgeschrieben: aus den Stimmen und der erforderlichen Mehrheit. Grundlage ist die
Recherche [`docs/research/2026-11-12-mehrheitserfordernisse-leipzig.md`](docs/research/2026-11-12-mehrheitserfordernisse-leipzig.md).

| `majorityRequirement` | angenommen, wenn | Auslöser |
|---|---|---|
| `simple` | Ja > Nein; Enthaltungen zählen nicht, Gleichstand ist abgelehnt | Regelfall (§ 39 Abs. 6 SächsGemO) |
| `majority-of-members` | Ja > 35,5, also mindestens 36 von 71 | Hauptsatzung (§ 4 Abs. 2 SächsGemO) |
| `two-thirds-of-members` | Ja ≥ 2/3 von 71, also mindestens 48 | Ehrenbürgerrecht, Ehrenmedaille, Ratsbürgerentscheid |
| `majority-of-present` | Ja > Hälfte von `presentMembers` | Wahlen (§ 39 Abs. 7 SächsGemO) |

Die Ratsversammlung hat 71 Mitglieder: 70 Stadträtinnen und Stadträte und den Oberbürgermeister (Sitz 71 der Tafel).
Bestellungen und Entsendungen beschließt die Stadt mit einfacher Mehrheit, sie sind keine Wahlen.

### Prüfstatus (`reviewStatus`)

| Wert | Bedeutung |
|---|---|
| `final` | Alle Prüfungen bestanden und mit dem amtlichen Ergebnis abgeglichen, oder von einem Menschen geprüft |
| `provisional` | Alle Prüfungen bestanden, das amtliche Ergebnis ist noch nicht veröffentlicht |
| `needs-review` | Mindestens eine Prüfung ist fehlgeschlagen; ein Mensch muss entscheiden |

`provisional` und `needs-review` sind veröffentlicht, aber **nicht abschließend geprüft**. Die Seite kennzeichnet sie.
Wer nur geprüfte Stimmen auswerten will, filtert auf `final`. `sessions.csv` nennt in `approved`, ob ein Sitzungstag
vollständig geprüft ist.

## Methodik

1. **Aufzeichnung finden:** Die Mediathek der Stadt wird täglich nach neuen Aufzeichnungen durchsucht; Stream und
   Untertitel kommen vom Video-Hoster der Stadt.
2. **Tafel lesen:** Die ganze Aufzeichnung wird in niedriger Auflösung nach der Abstimmungstafel durchsucht. Am Ende
   jeder Abstimmung werden zwei Bilder in voller Auflösung gelesen: die **Farbe** jedes Sitzfelds ergibt die Stimme
   (grün Ja, rot Nein, gelb Enthaltung, weiß keine Stimme), Texterkennung liest Kopfzeile, Anwesende, abgegebene
   Stimmen und die Zahlen der Ergebnisbalken. Sitze werden über die Namen auf der Tafel den Personen aus OParl
   zugeordnet. Kein Sprachmodell, keine bezahlte Schnittstelle.
3. **Prüfen:** Jede Abstimmung wird gegen unabhängige Quellen geprüft: Farben gegen Ergebnisbalken und abgegebene
   Stimmen, zweites Bild gegen das erste, Ansage der Sitzungsleitung in den Untertiteln, amtliches Ergebnis aus
   Beschlussprotokoll, Tagesordnungsseiten und Verlaufsprotokoll. Was nicht passt, prüft ein Mensch.
4. **Zuordnen:** Kopfzeile und Drucksachennummer verknüpfen die Abstimmung mit Tagesordnungspunkt und Vorlage in OParl.
5. **Veröffentlichen:** Neue Daten und jede Prüfentscheidung kommen als Commit auf den Daten-Branch und per Pull
   Request auf die Seite. Die Git-Historie ist das Änderungsprotokoll.

Belegbilder: Zu jeder veröffentlichten Abstimmung zeigt die Seite die Tafel als Zitat (§ 51 UrhG). Die Bilder liegen in
den GitHub-Releases `evidence-<datum>`, sie gehören **nicht** zum Datenpaket und stehen nicht unter CC0.

## Bekannte Grenzen

- **Mündliche Korrekturen:** Die Sitzungsleitung zählt manchmal Mitglieder von Hand hinzu, deren Stimme die Tafel nicht
  zeigt. Nennt das Protokoll sie, wird die Stimme korrigiert (die Tafel bleibt in `boardVote` in
  `votes-<datum>.csv`); sonst entscheidet ein Mensch.
- **Abstimmungen ohne Tafel** (Handzeichen, geheime Wahl, ausgefallene Anlage) sind nicht erfasst.
- **Nur Sitzungen mit Aufzeichnung:** Die Stadt zeichnet seit Dezember 2025 auf. Ältere Sitzungen der Wahlperiode
  fehlen.
- **Verfügbarkeit der Videos:** Verschwindet eine Aufzeichnung aus der Mediathek, entfällt der Videolink; die Stimmen
  und Belegbilder bleiben. `recordings.csv` hält fest, seit wann eine Aufzeichnung fehlt.
- **Anwesenheitszählungen** zur Beschlussfähigkeit und vor Wahlen sehen auf der Tafel aus wie Abstimmungen; sie werden
  verworfen und sind nicht veröffentlicht.
- **Partei:** siehe oben, die Wahlliste 2024 ist nicht die Parteimitgliedschaft.
- **Vorlagen mit mehreren Beschlusspunkten** werden punktweise abgestimmt; welcher Punkt welche Tafel ist, steht nicht
  in den Daten der Stadt.
- **Befangenheit, en-bloc-Abstimmungen und die Stimme des Oberbürgermeisters** sind nicht eigens gekennzeichnet.

## Lizenzen und Quellen

| Was | Lizenz | Quelle |
|---|---|---|
| Stimmen, Ergebnisse, Prüfstatus, Zuordnungen | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | StadtratWatch Leipzig |
| Personen, Mitgliedschaften, Sitzungen, Tagesordnung, Drucksachen | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Stadt Leipzig, [OParl](https://www.leipzig.sitzung-online.de/oparl/system) |
| Partei (Wahlliste 2024) | [dl-de/by-2-0](https://www.govdata.de/dl-de/by-2-0) | Stadt Leipzig, [Open-Data-Portal](https://opendata.leipzig.de/dataset/stadtratswahl-2024-bewerberinnen-und-bewerber) |
| Texte der Reden (nur API und Seite) | nicht CC0, § 48 UrhG | Stadt Leipzig, Verlaufsprotokoll |
| Belegbilder (nur Releases und Seite) | nicht CC0, Zitat nach § 51 UrhG | Stadt Leipzig, Aufzeichnungen |

Wer die Tabellen weitergibt, nennt für die Angaben aus OParl und der Wahlliste die Stadt Leipzig als Quelle.

## Aktualität

Die Abläufe laufen täglich auf GitHub Actions: neue Aufzeichnungen, Mitglieder, Prüfentscheidungen. Amtliche
Ergebnisse und Verlaufsprotokolle holt ein eigener Server, weil das Ratsinformationssystem GitHub nicht antwortet
([`minutes-runner/`](minutes-runner/README.md)). Die Protokolle erscheinen etwa zwei Monate nach der Sitzung; bis dahin
sind die Abstimmungen `provisional`.
