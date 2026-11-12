# StadtratWatch Leipzig: Todoliste

Ziel: einen Fork von [StadtratWatch](https://github.com/JensWinter/StadtratWatch-web) (Magdeburg) für die Leipziger Ratsversammlung bauen. Der Umfang sind **nur die Abstimmungen** pro Person, für **alle Sitzungen mit verfügbarem Video**. Der Betrieb läuft ausschließlich über **kostenlose Dienste**. Alle erzeugten Daten sind maschinenlesbar und werden automatisch aktuell gehalten.

Stand: 12.11.2026 (abends)

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Repository | Fork, kein Kontakt zum Upstream. Seit 12.11.2026 nur Leipzig: alles Magdeburger ist entfernt, der Hinweis auf StadtratWatch Magdeburg und dessen MIT-Vermerk bleiben (ADR-0008). Merges von upstream nur noch von Hand. |
| Branches | Code per PR nach `main`, Daten über `data/leipzig-votings` und dessen PR (12.11.2026). |
| Umfang | Abstimmungen, dazu seit 12.11.2026 Reden aus dem Verlaufsprotokoll (siehe M5). Keine Volltextsuche. |
| Zeitraum | Alle Sitzungen, zu denen es ein Video gibt. |
| Betrieb | Nur kostenlose Dienste: GitHub Actions, GitHub Pages, Git als Datenspeicher. Kein S3, kein VPS, kein Typesense. Vorerst keine eigene Domain. |
| Betreiber | Marcel Schneuer, Impressum wie schneuer.online (12.11.2026). |
| Veröffentlichung | Sitzungen ohne Video und Abstimmungen ohne Tafel werden nicht erfasst. `provisional` und `needs-review` erscheinen mit Hinweis, wie der Fall behoben wird, und Link zum Daten-PR (12.11.2026). |
| Stadt Leipzig | Wird nicht kontaktiert. Es wird nur mit öffentlich zugänglichen Daten gearbeitet. |
| Mitgliederquellen | leipzig.de wird ignoriert. Mitglieder und Fraktionen kommen aus OParl, Parteien aus dem Open-Data-Datensatz und ggf. aus den Fraktionswebseiten. |

---

## Recherche-Ergebnisse

| Thema | Befund |
|---|---|
| **OParl-API** | `https://www.leipzig.sitzung-online.de/oparl/system` (OParl 1.1, ALLRIS, CC BY 4.0). Die Ratsversammlung ist `organizations/gr/2387` im Body `bodies/2387`. Aktuell gibt es 71 aktive Mitgliedschaften (70 Stadträt:innen + OB). Ein Vollabruf von Personen und Mitgliedschaften dauert ca. 45 s, `modified_since` wird unterstützt. Fraktionen sind Organisationen mit `classification: "Fraktion"`. Die TOPs haben Nummern wie `19.10.2`, passend zur Abstimmungstafel. Die Adresse `ratsinformation.leipzig.de/allris_leipzig_public/oparl` meldet „Oparl-Modul ist deaktiviert“. |
| **Parteien** | Open-Data-Datensatz „Stadtratswahl 2024: Bewerberinnen und Bewerber“ (CSV, 657 Zeilen, Spalten u. a. `kandidat_partei_kurzname`, `kandidat_name`, `kandidat_vorname`, `kandidat_akadgrad`). Test: **69 von 70** aktuellen Ratsmitgliedern ließen sich eindeutig über Nachname + erster Vorname zuordnen. Die Ausnahme ist eine Namensänderung: „Nicole Schreyer“ (Kandidatin) ist heute „Dr. med. Nicole Schreyer-Krieg“. Vorsicht: Die CSV nennt die **Liste**, auf der jemand kandidiert hat, nicht zwingend die Parteimitgliedschaft (Parteilose auf Listen, spätere Austritte). |
| **Datenqualität OParl** | Tippfehler wie „CHristoph Neumann“. Bei Prof. Dr. Getu Abraham fehlt eine Fraktionsmitgliedschaft, OParl und Abstimmungstafel führen ihn als fraktionslos. Die CDU-Webseite listet ihn nicht. |
| **Fraktionswebseiten** | Uneinheitlich aufgebaut. Die CDU-Seite ist Latin-1-kodiert, die AfD-Seite ist WordPress mit nachgeladenem Inhalt (die `wp-json`-API wäre nutzbar), die übrigen sind statisches HTML. Sie taugen nur als Zusatzquelle, nicht als Primärquelle. |
| **Mediathek** | Es gibt Seiten `leipzig.de/mediathek/video/aufzeichnung-der-ratsversammlung-vom-{slug}`. Der Slug ist meist `DDMMYYYY`, einmal aber `29-oktober-2026`. Das Video wird über einen Wowza-Player von video-stream-hosting.de eingebettet. `POST start.video-stream-hosting.de/player/playerparameter` liefert den HLS-Host und eine **VTT-Untertiteldatei** (KI-generiert, `large-v3-turbo-german`). Der HLS-Stream ist in 360p, 480p, 720p und 1080p verfügbar. |
| **Archivtiefe** | Von 34 Sitzungstagen seit 18.09.2024 haben nur **16 eine Video-Seite**, alle ab dem **17.12.2025**. Ältere Seiten existieren nicht mehr, und die Wayback Machine hat nur eine einzige Aufzeichnungsseite archiviert. Vermutlich hält die Stadt die Videos nur rollierend etwa 12 Monate vor. Die Geschäftsordnung (§ 11 Abs. 8, Fassung 2024) sagt dagegen „bis zum Ende der Wahlperiode öffentlich verfügbar“; vermutlich begann die Aufzeichnung erst im Dezember 2025 (siehe `docs/research/2026-11-12-rechte-belegbilder.md`). Ob die Aufzeichnung vom 17.12.2025 im Dezember 2026 noch abrufbar ist, zeigt `recordings.json`. |
| **Abstimmungstafel** | Die Tafel wird vollbildig eingeblendet. Die Kopfzeile enthält TOP, Drucksache und Titel (`19.10.2 VIII-DS-02186-ÄA-02 Masterplan Grün …`). Darunter stehen 4 Spalten nach Fraktionen mit festen Sitznummern 1–71. Die **Farbe** im Nummernfeld zeigt die Stimme: grün = Ja, rot = Nein, gelb = Enthaltung, weiß = keine Stimme. Unten stehen „Anwesende“ und „Abgegebene Stimmen“, nach Schluss erscheint ein Ergebnisbalken. |
| **Mündliche Korrekturen** | Beispiel: „Herr Stange wird hinzugezählt, 21 zu 36 zu 0“. Auf der Tafel ist Stange weiß, die Tafel zeigt 20 Ja. Die Tafel entspricht also nicht immer dem amtlichen Ergebnis. |
| **StadtratWatch (upstream, Stand 10.11.2026)** | Astro (statisch) + Bun/Deno-Skripte. `registry.json` ist die Quelle der Wahrheit, Abstimmungen liegen in `session-scan-YYYY-MM-DD.json`. YouTube ist in ca. 15 Dateien fest verdrahtet. Binärdaten (Abstimmungs-PNGs, Drucksachen) werden über S3/CloudFront ausgeliefert, die Suche läuft über Typesense auf einem VPS. Es gibt keinen Scheduler. |

**Wichtigste Folge der Archivtiefe:** Die 16 verfügbaren Videos sollten **so bald wie möglich** verarbeitet und die Belege gesichert werden. Die ältesten (Dezember 2025) könnten bald verschwinden. Danach läuft die Verarbeitung neuer Sitzungen laufend weiter, damit keine Sitzung verloren geht.

---

## Querschnitt: Grundsätze

### Maschinenlesbarkeit
- [ ] **Kanonisch JSON** im StadtratWatch-Format, erweitert um stabile IDs.
- [ ] **Stabile IDs:** OParl-IDs für Personen, Fraktionen, Sitzungen, TOPs und Vorlagen. Namen sind nie der Schlüssel.
- [ ] **CSV im Long-Format** für jede Tabelle: `persons.csv`, `memberships.csv`, `sessions.csv`, `votings.csv`, `votes.csv` (`session_id, voting_id, person_id, vote`).
- [ ] **JSON Schema** je Datei und ein **Frictionless `datapackage.json`** (Beschreibung, Lizenz, Quellen). Die Pakete werden in CI automatisch validiert (`frictionless validate`).
- [ ] **Provenienz pro Datensatz:** `source_url`, `retrieved_at`, `method` (`oparl` | `opendata-csv` | `faction-website` | `video-board` | `subtitle` | `manual`), `confidence`, `reviewed`.
- [ ] **Git als Änderungsprotokoll** („Git Scraping“): jede Aktualisierung ein Commit.
- [ ] **Lizenzen:** OParl steht unter CC BY 4.0 (`oparl/system`), der Open-Data-Datensatz der Bewerber:innen unter Datenlizenz Deutschland – Namensnennung 2.0. Die Namensnennung „Stadt Leipzig“ gehört in `datapackage.json` und in die API-Metadaten (in `members.json` bereits unter `sources`). Die selbst aus dem Video erhobenen Stimmen können unter CC0 stehen. Code MIT wie upstream.
- [ ] **Codebook** (`DATA.md`): Bedeutung aller Felder, Stimmcodes J/N/E/O, Methodik und bekannte Grenzen.

### Ressourcenschonung und Aktualität (nur kostenlose Dienste)
- [ ] **GitHub Actions mit `schedule`**: Das öffentliche Repo bekommt unbegrenzt Minuten auf Standard-Runnern. Ein Job darf bis zu 6 h laufen.
- [ ] **Inkrementell abrufen** über OParl `modified_since` und HTTP `ETag`/`If-Modified-Since`. Nur committen, wenn sich etwas geändert hat.
- [ ] **Höflich abrufen:** User-Agent mit Projekt-URL, 0,3–1 s Pause zwischen Requests.
- [ ] **Keine Videos speichern.** Gespeichert werden nur Metadaten, die VTT (ca. 270 KB pro Sitzung) und kleine Belegbilder.
- [ ] **Belegbilder sparsam:** nur den Endstand jeder Abstimmung, verkleinert bzw. als PNG mit reduzierter Palette (Ziel: < 50 KB pro Bild). Sie kommen nicht ins Git, sondern in **GitHub Releases** (ein Release pro Sitzung, kostenlos, keine Repo-Aufblähung). Das ersetzt S3.
- [ ] **Bei Fehlern ein Issue öffnen** statt still falsche Daten zu schreiben. Neue Daten kommen als **Pull Request**, nicht als direkter Push.
- [ ] **Keepalive:** GitHub deaktiviert `schedule`-Workflows nach 60 Tagen ohne Repo-Aktivität. Die regelmäßigen Daten-Commits verhindern das, in der Sommerpause hilft ein Keepalive-Commit.

### Zeitplan

| Job | Häufigkeit | Aufwand pro Lauf |
|---|---|---|
| OParl inkrementell (Personen, Mitgliedschaften, Sitzungen, TOPs, betroffene Vorlagen) | täglich, nachts | < 1 min |
| Parteien-Abgleich (Fraktionswebseiten) | wöchentlich | < 1 min |
| Neue Aufzeichnungen suchen | täglich in den 21 Tagen nach einem Sitzungstermin (aus OParl), sonst wöchentlich | Sekunden |
| Abstimmungen aus dem Video extrahieren | einmal pro neuer Aufzeichnung | ca. 5–15 min |
| Statische Seite bauen und veröffentlichen | bei jedem Merge auf `main` | wenige Minuten |

---

## M0: Fork und Grundgerüst

- [x] `JensWinter/StadtratWatch-web` geforkt: https://github.com/ungeschneuer/StadtratWatch-web. Hinweis auf den Ursprung steht in der README.
- [x] ADR-0008 (Fork nur für Leipzig, GitHub Pages) und ADR-0009 (Tafel, Prüfung, Freigabe per PR); arc42 für Leipzig neu geschrieben (12.11.2026).
- [x] Magdeburg entfernt: Daten, Pipeline-Skripte, Docker, Typesense, Netlify, Vorlagen-, Such- und KI-Seiten, Magdeburger Ansichten der Prüfoberfläche. Wahlperiode `leipzig-8` angelegt.
- [ ] CI des Forks auf GitHub zum Laufen bringen (`ci.yml`: Deno-Lint, Bun- und Astro-Checks; lokal grün am 12.11.2026).
- [x] Leipzig-Skripte als eigene Bun-Ordner `src/scripts/leipzig-*` (in `tsconfig.json` registriert; Deno lintet nur noch).

## M1: Mitgliederliste mit Partei

Umgesetzt in `src/scripts/leipzig-members` (siehe README dort), Workflow `.github/workflows/leipzig-members.yml` täglich 04:43 UTC.

### Aufgaben
- [x] **OParl-Abruf** von `persons`, `memberships`, `organizations` mit Paginierung (`size=100`, `links.next`). Ein Vollabruf dauert gut eine Minute, deshalb ohne `modified_since`.
- [x] **Aktuelle und ehemalige Ratsmitglieder** aus den Mitgliedschaften in `organizations/gr/2387`, mit Beginn und Ende (77 Personen in der Wahlperiode VIII, 71 aktiv).
- [x] **Fraktion** über Mitgliedschaften mit `classification == "Fraktion"`, mit Zeiträumen (`factionMemberships`). Rollenwechsel (Vorsitz) werden zusammengeführt, Lücken sind „fraktionslos“, der OB ist die Pseudo-Fraktion `oberbuergermeister` wie upstream. Beispiele: Getu Abraham SPD → fraktionslos → CDU → fraktionslos; Jürgen Günter Butz (Liste FREIE SACHSEN) seit 18.09.2025 in der AfD-Fraktion.
- [x] **Partei, Stufe 1: Open-Data-CSV**
  - [x] CSV laden, Namen normalisieren (Unicode-NFKD, Kleinschreibung, Titel weg).
  - [x] Zuordnen über Nachname + erster Vorname, Fallback über einen Teil des Doppelnamens (`match: former-name`, Fall „Schreyer“ → „Schreyer-Krieg“).
  - [x] Mehrdeutige oder fehlende Treffer werden gemeldet (Exit 1, Issue im Workflow).
  - [x] Die Herkunft steht in `partySource` (`election-list` mit Listenname oder `override` mit Quelle), nicht als „Parteimitglied“.
- [ ] **Partei, Stufe 2: Fraktionswebseiten** (nur ergänzend, wenn die Seite eine Partei nennt, z. B. bei der Freien Fraktion oder Parteilosen):
  - [ ] Je Seite ein kleiner Parser (Kodierung erkennen, Latin-1 bei der CDU; AfD möglichst über `wp-json` statt HTML).
  - [ ] Ein Treffer setzt die Partei nur, wenn die Seite sie ausdrücklich nennt. Widersprüche zur CSV werden gemeldet.
  - [ ] Bricht ein Parser (Struktur geändert), schlägt der Job **nicht** fehl. Es entsteht ein Hinweis, die bisherigen Daten bleiben.
- [x] **Override-Datei** `data/leipzig-8/member-overrides.json` (JSON wie die Korrekturen der Abstimmungen): Ausschluss, Schreibweise, Partei. Jeder Eintrag mit Begründung und Quelle, bei jedem Lauf angewendet. Bisher: Partei des OB (OB-Wahl 2020), „CHristoph“ Neumann, Franziska Kießling (Mitgliedschaft nur am 18.09.2024, auf keiner Tafel).
- [x] **Plausibilitätsprüfungen:** genau 70 Stadträt:innen + OB aktiv; jede aktive Person hat eine Fraktion oder ist fraktionslos; jede Person hat eine Partei; Overrides treffen Mitglieder; IDs eindeutig; Abgleich mit der Abstimmungstafel (wer auf der Tafel steht, ist an dem Tag Mitglied; Vereidigung bis 7 Tage vor dem OParl-Beginn verschiebt den Beginn).
- [x] **Ausgabe:** `members.json` (Fraktionen, Parteien, Personen im Format der StadtratWatch-Registry, erweitert um `oparlId`, `factionMemberships`, `partySource`; Typ `LeipzigMembersFile`), `persons.csv`, `faction-memberships.csv`. `votes-<datum>.csv` hat die Spalten `factionId` (am Sitzungstag) und `partyId`.
- [ ] **`registry.json`** erst mit M4 schreiben: Astro lädt jede `registry.json` unter `data/` sofort, und die Sitzungen brauchen dafür die Video-Abstraktion und `session-scan-*.json`.

## M2: Aufzeichnungen beziehen

### Aufgaben
- [x] **Sitzungstermine aus OParl** (`organizations/gr/2387/meetings`) ab 18.09.2024 laden. Sie sind die Grundlage für die Suche nach Videos.
- [x] **Video-Seite finden**, zweistufig:
  1. Übersicht `https://www.leipzig.de/mediathek/video` nach Links mit `aufzeichnung-der-ratsversammlung` durchsuchen.
  2. Zusätzlich für jeden OParl-Termin die Slug-Varianten prüfen (`DDMMYYYY`, `D-monat-YYYY`, `DD-monat-YYYY`).
  - Das Datum kommt aus dem Seitentitel („vom 29.10.2026“), nicht aus dem Slug.
- [x] **Stream auflösen:**
  1. `iframe.media-player-iframe` auslesen, daraus `serverapp` und `smil`.
  2. `POST https://start.video-stream-hosting.de/player/playerparameter` mit `{serverip, serverapp, smil, streamname}` aufrufen. Die Antwort enthält `hlshttpsdomain` und `untertitelDateien[].untertitelDatei`.
  3. Daraus `https://{hlshttpsdomain}/{serverapp}/_definst_/smil:{smil}/playlist.m3u8` bilden.
  4. Fallback: Player-HTML parsen bzw. den letzten bekannten Host verwenden. Schlägt beides fehl, wird ein Issue geöffnet.
- [x] **Manifest** `recordings.json|csv` mit `session_id`, `oparl_meeting_id`, `mediathek_url`, `smil`, `hls_url`, `vtt_url`, `duration`, `vtt_sha256`, `first_seen`, `last_seen`, `available`.
- [x] **VTT archivieren** im Repo (klein; dient in M3 als Index für Abstimmungen und als Beleg für mündliche Ergebnisse).
- [x] **Verfügbarkeit überwachen:** Verschwindet eine Seite, wird `available: false` gesetzt und `last_seen` bleibt erhalten. Daraus lässt sich die tatsächliche Vorhaltedauer ablesen.
- [x] **Deep-Links:** Der Player des Hosters (die Seite, die leipzig.de als iframe einbindet, in `recordings.json` als `playerUrl`) springt mit `startsekunde=<s>` an die Stelle; `videostartoffset` schneidet dagegen den Anfang weg (an 4 Tagen 11–15 Minuten Wartezeit). Gemessen 12.11.2026: mit `startpos=660` ist der Stream genau 660 s kürzer, die Zeit im Player läuft also um den Schnitt hinter unseren Zeiten; `sessionVideoLink` rechnet ihn heraus. Im Browser bestätigt (12.11.2026).
- [x] **Backfill:** 16 Sitzungstage (17.12.2025–29.10.2026) erfasst, 13 davon mit Untertiteln. Für 2025-12-18, 2026-01-28 und 2026-02-25 veröffentlicht der Hoster keine VTT, dort braucht M3 den Frame-Scan-Fallback.
- [x] **Workflow** `.github/workflows/leipzig-recordings.yml`: täglich 05:17 UTC, Daten per PR, Fehler als Issue.
- [x] **Belegframes sichern:** Tafelbilder jeder zu prüfenden Abstimmung als Assets des Releases `evidence-<datum>`.

## M3: Abstimmungen pro Person aus dem Video

**Ansatz:** Die Stimmen werden über die Farbe im Nummernfeld erkannt, OCR nur für Kopfzeile und Zahlen. Keine GPU, kein LLM, keine kostenpflichtige API.

### Pipeline
Umgesetzt in `src/scripts/leipzig-votings` (siehe README dort). Stand 12.11.2026: 547 Abstimmungen aus 16 Sitzungstagen, davon 476 verified, 23 corrected, 11 provisional, 15 discarded, 5 skipped, 17 needs-review.
- [x] **1. Ergebnisphasen finden:** anders als geplant nicht über die VTT, sondern die ganze Aufzeichnung in 360p mit 2 fps (160×90 px), Tafel = überwiegend weiß, Ergebnis = farbige Balken. Robuster, und drei Sitzungen haben keine VTT. 360p und 1080p sind zeitgleich (geprüft am 12.11.2026).
- [x] **2. Endstand lesen:** zwei 1080p-Frames je Ergebnisphase, bei Abweichung entscheidet ein dritter.
- [x] **3. Tafel auslesen:**
  - [x] Raster je Frame vermessen statt fester Koordinaten (bis Anfang 2026 5 × 19, seitdem 4 × 22).
  - [x] Farbe je Nummernfeld (Median-RGB) → J/N/E, weißes Feld mit Nummer = anwesend ohne Stimme, ohne Nummer = abwesend.
  - [x] Tesseract (`deu`) für Kopfzeile, „Anwesende“, „Abgegebene Stimmen“ und die Zahlen an den Ergebnisbalken.
  - [x] Namens-OCR, wenn sich die Namensspalten ändern, Zuordnung zur OParl-Person; zwei Sitze auf derselben Person gehen in die Prüfung.
- [x] **4. Plausibilitätsprüfungen:** Tafelzahlen, zweiter Frame, Ansage aus der VTT, amtliches Ergebnis aus Beschlussprotokoll, ALLRIS-TOP-Seiten und Verlaufsprotokoll. Von Hand hinzugezählte Mitglieder werden aus dem Verlaufsprotokoll übernommen (`corrected`, Tafelstand in `boardVote`).
- [x] **5. Zuordnung zu TOP und Vorlage:** Kopfzeile → OParl-`agendaItem.number`, Drucksache → `paper.reference`, Änderungsanträge und Neufassungen zur Hauptvorlage, Fortsetzungstage durchsucht.
  - [x] Antragsteller:innen: Leipzig füllt nur `underDirectionOf` (Geschäftsstelle einer Fraktion oder Amt/Dezernat). Skript `src/scripts/leipzig-papers` verknüpft jede Abstimmung mit ihrer Vorlage (auch Änderungsanträge über `subordinatedPaper`), `data/leipzig-8/papers.json`: 453 Abstimmungen, 352 Vorlagen. OParl nennt je Vorlage genau eine einreichende Stelle, gemeinsame Anträge mehrerer Fraktionen zählen nur für die genannte.
- [ ] **6. Sonderfälle** als `votingMethod` erfassen: keine Tafel (Handzeichen, Anlage ausgefallen), geheime Wahl, en-bloc, punktweise Abstimmung, Befangenheit (§ 20 SächsGemO), Stimme des OB (Sitz 71), `majorityRequirement`. Bisher erkannt: Geschäftsordnungsanträge (`procedural`), ungültige Tafeln (`discarded`).
- [x] **Statuspunkt im 1080p-Frame:** Ein Ergebnisbalken muss mindestens drei Viertel einer Tabellenzeile hoch sein (Balken 32–38 px, Punkt 13–17 px). Testbild `board-2026-09-status-dot.png`.
- [x] **Irreführender Kommentar in `extract-session.ts`:** richtiggestellt (360p und 1080p zeitgleich), Suche als Rückfall für Überblendungen behalten.
- [x] **7. Prüfung durch Menschen:** Route `/leipzig` in `session-review` (GitHub Pages), Prüffälle in `review-<datum>.json`, Benachrichtigung per Issue je Sitzung, Speichern als Commit in `corrections-<datum>.json`, Nachprüfung per Workflow. Freigabe per PR-Merge.
  - [ ] Einmalig einrichten: GitHub Pages (Quelle „GitHub Actions“), Schreibrechte der Prüfenden, Variable `LEIPZIG_REVIEWERS`.
  - [ ] Workflows einmal auf GitHub durchlaufen lassen (bisher nur lokal getestet).
  - [ ] Die 17 offenen Fälle entscheiden.
- [ ] **8. Regressionstest:** 1–2 Sitzungen von Hand prüfen (z. B. 28./29.10.2026) und als „goldenen Datensatz“ ablegen.
- [x] **Ausgabe:** `votings-<datum>.json` und `votes-<datum>.csv` (mit `personId`, Fraktion und Partei).
  - [ ] StadtratWatch-kompatible `session-scan-YYYY-MM-DD.json` (Adapter, siehe M4) und `votings.csv`.

### Ressourcen (Schätzung pro Sitzung)
- 60–120 Abstimmungen. Dekodiert werden nur die Zeitfenster in 360p, dazu ein 1080p-Frame pro Abstimmung.
- ffmpeg und Tesseract laufen auf dem Standard-Runner von GitHub Actions in wenigen Minuten.

## M4: Umsetzung im Fork

- [x] **Seitenkonfiguration** `astro/src/utils/site-config.ts` (Name, Kontakt, Repository, Daten-PR, Hinweis auf upstream); Texte, Impressum, Kontakt und Datenschutz für Leipzig (12.11.2026).
- [x] **Video-Abstraktion:** `RegistrySession.video` (`url`, `label`) neben `youtubeUrl` (abwärtskompatibel, Magdeburg unverändert); `sessionVideoLink()` in `astro/src/models/session-video.ts` wählt den Link für Sitzungs- und Abstimmungsseite. Leipzig verlinkt die Mediathek-Seite, solange sie online ist.
  - [x] Zeitgenaue Links für Reden und Abstimmungen über `video.playerUrl` (siehe M2, Deep-Links).
  - [x] `Speech.astro` nutzt `sessionVideoLink()`.
- [x] **Reden-Funktionen:** Speech-Seiten und Redezeit-Statistiken werden mit M5 gefüllt statt ausgeblendet. `speech-to-text`, `speaker-diarization` und `detect-ai-text` aus upstream werden nicht genutzt. `Speech.astro` braucht dafür `sessionVideoLink()` statt `youtubeUrl`.
- [x] **Registry `data/leipzig-8/registry.json`** aus `members.json` und den Sitzungen mit Abstimmungen, Skript `src/scripts/leipzig-site-data`. `approved`, sobald keine Abstimmung mehr auf Prüfung oder amtliches Ergebnis wartet (Stand 12.11.2026: 5 von 16).
- [x] **OParl schlank:** nur Sitzungen, TOPs und die in Abstimmungen vorkommenden Vorlagen; Drucksachen verlinken das Ratsinformationssystem (`paperUrl`). Keine PDFs, kein Tika, kein Typesense.
- [x] **Adapter M3 → `session-scan-*.json`** (`src/scripts/leipzig-site-data`): veröffentlicht `verified`, `corrected`, `reviewed`, `provisional` (510 von 547), Namen wie in der Registry, Titel aus OParl, Typ aus der Drucksachennummer. Läuft in den Workflows `leipzig-votings` und `leipzig-review-recheck`. Site-Build mit Leipzig geprüft (12.11.2026, 4878 Seiten, keine Fehler).
  - [x] `authors` aus `papers.json`: Fraktionen unter ihrem Namen auf der Seite, Ämter und Dezernate ohne Nummer; `motionId` aus OParl (behebt VII/VIII aus der OCR).
  - [ ] `majorityRequirement` (siehe M3, Schritt 6).
- [x] **S3/CloudFront entfallen:** keine Abstimmungs-PNGs und Vorschaubilder mehr, Belegbilder in GitHub Releases.
- [x] **Zeitverlauf von Fraktion und Partei in Auswertungen und Datenverarbeitung** (12.11.2026):
  - [x] **Datenmodell:** `RegistryPerson.factionMemberships` und `partyMemberships` (optional, Magdeburg unverändert); `factionIdOn()`/`partyIdOn()` in `astro/src/models/person-affiliation.ts`. `members.json` führt die Parteizugehörigkeit mit Zeiträumen und Quelle je Zeitraum; ein Override mit `party` und `since` beginnt einen neuen Zeitraum. Die Wahlliste 2024 ist der Ausgangswert.
  - [x] **Datenverarbeitung:** Die Registry trägt den Verlauf, deshalb braucht `session-scan-*.json` keine Fraktion je Stimme. `votes-<datum>.csv` hat Fraktion und Partei am Sitzungstag.
  - [x] **Auswertungen:** Teilnahme, Enthaltungen, Abstimmungserfolg, Geschlossenheit und Redezeit je Fraktion und Partei (über `getPersonsOfSessionAndFaction`/`…Party`), die Fraktionsaufteilung jeder Abstimmung und die Abstimmungsseite rechnen mit der Zugehörigkeit am Sitzungstag. Die Ähnlichkeitsgrafik und die Personenliste zeigen bewusst die aktuelle Fraktion.
  - [x] **Anzeige:** Personenseite mit Verlauf („Fraktionen in der Wahlperiode: …“), Fraktions- und Parteiseiten mit allen, die je dazugehörten, mit Zeitraum bei Wechsel; Parteiseite zeigt die Fraktion statt nochmals die Partei.
  - [x] Sitzzahlen je Zeitpunkt: `seats` bleibt der Stand heute; die Fraktionsaufteilung jeder Abstimmung ordnet nach den Mitgliedern am Sitzungstag und lässt Fraktionen ohne Mitglieder an dem Tag weg; Fraktions- und Parteiseiten zeigen den Sitzverlauf (`astro/src/data-analysis/Seats.ts`).
  - [x] Parteiwechsel mit Quelle: Getu Abraham seit 09.11.2024 parteilos (Leipziger Zeitung, 8.11.2024). Weitere, sobald eine Quelle vorliegt (siehe Offene Fragen: Butz).
- [ ] **Partei-Metadaten** redaktionell prüfen, einschließlich `EXTREMIST_CLASSIFICATION`. Die Seite zeigt die Wahlliste 2024 als „Partei“; bei Fraktionswechseln (z. B. Abraham: Liste SPD, heute fraktionslos) prüfen, ob ein Override mit Quelle nötig ist. Bezug ist das LfV **Sachsen** (nicht Sachsen-Anhalt), mit Quellenangabe.
- [ ] **Offene Daten ausliefern:**
  - [x] API v1 (`/api/v1/parliament-periods/leipzig-8/votings/{session}.json`), mit `reviewStatus` und `paperUrl`
  - [ ] Bulk-Downloads `/data/leipzig-8/*.csv` + `datapackage.json`
  - [ ] Lizenz und Provenienz in jeder Antwort: `meta` nennt noch pauschal CC0, auch für Angaben aus OParl (CC BY 4.0)
- [x] **Hosting:** GitHub Pages über `deploy.yml`, Seite und Prüfoberfläche (`/review/`) in einem Artefakt; Basispfad über `SITE_BASE`, alle Links über `sitePath()`.
  - [ ] Einmalig einrichten: Pages-Quelle „GitHub Actions“, erster Lauf von `deploy.yml`, private Sicherheitsmeldungen aktivieren (`SECURITY.md`).
- [x] **Workflows:** `leipzig-members`, `leipzig-recordings`, `leipzig-votings`, `leipzig-review-recheck`, `leipzig-review-reminder`, `deploy`. Daten kommen per PR, Fehler als Issue.
- [x] README, AGENTS.md, GLOSSARY.md, API-Doku und arc42 für Leipzig (12.11.2026).
- [ ] **Dokumentation:** `DATA.md` (Codebook, Methodik, Grenzen: mündliche Korrekturen, Abstimmungen ohne Tafel, Liste ≠ Parteimitgliedschaft, Verfügbarkeit der Videos).

---

## M5: Reden aus dem Verlaufsprotokoll

**Ansatz:** Das Verlaufsprotokoll ist ein redigiertes Wortprotokoll mit Sprecher und Fraktion je Beitrag (28.01.2026: rund 55.000 Wörter, 366 Beiträge). Es liefert Sprecher und Text, die Untertitel bzw. ein lokales Whisper-Modell liefern die Zeiten. Kein LLM, keine kostenpflichtige API. Ziel ist das upstream-Format `session-speeches-<datum>.json` (`SessionSpeech`: `speaker`, `start`, `duration`, `isChairPerson`, `onBehalfOf`, `transcription`), damit Reden-Tab und Redezeiten je Person, Fraktion und Partei funktionieren.

### Aufgaben
- [x] **Beiträge parsen:** `parseContributions` in `leipzig-votings/verlaufsprotokoll.ts`, gespeichert in `verlaufsprotokoll-<datum>.json` (Parser-Version 2). Sprecherzeile mit Titel, Name und Fraktion/Rolle in Klammern, auch umbrochen; TOP-Überschriften, „Eingereicht von“, Seitenköpfe und Unterschriften entfernt; Text nach Überschrift oder Abstimmung gehört der Sitzungsleitung, die mit „(Übergabe der Sitzungsleitung an …)“ wechselt. 13 Protokolle, 4.400 Beiträge, jede Abstimmungszeile in genau einem Beitrag.
- [x] **Sprecher zuordnen:** Nachname (auch ein Teil eines Doppelnamens) plus Fraktion oder Partei → Person aus `members.json` am Sitzungstag; Oberbürgermeister als Mitglied, Sitzungsleitung `isChairPerson`; Bürgermeister:innen und Gäste mit Namen laut Protokoll und Rolle in `onBehalfOf`; Einwohner:innen nicht veröffentlicht (Privatpersonen). Nicht zuordenbar: nur „Stadtrat Wehmann (DIE LINKE)“ am 28.05.2026, kein Ratsmitglied (Warnung, Name laut Protokoll).
- [x] **Zeiten über die Untertitel:** Fünf-Wort-Folgen, die im Protokoll und in den Untertiteln je genau einmal vorkommen, als Anker, davon die längste Folge in gleicher Reihenfolge (6.000 bis 26.000 Anker je Sitzung, rund 70 % der Beiträge mit eigenem Anker). Dazwischen interpoliert; Lücken mit viel mehr Zeit als Wörtern (Pause, Abstimmung) werden nicht auf den Beitrag verteilt.
- [x] **Feste Anker als Prüfung:** Die Abstimmungszeilen des Protokolls liegen bei 433 von 434 Abstimmungen höchstens 90 s von der Tafel derselben Abstimmung entfernt. Stichprobe 03.09.2026: Beginn auf wenige Sekunden genau.
- [x] **Lokales Whisper für die Sitzungen ohne Untertitel** (2025-12-18, 2026-01-28, 2026-02-25, zusammen 16,7 Stunden):
  - [x] Nur die Tonspur laden (AAC im HLS-Stream), als 16 kHz mono für Whisper.
  - [x] `whisper.cpp` mit `large-v3-turbo` auf dem Mac mit Metal, gemessen: 7,6-fach schneller als Echtzeit.
  - [x] Erster Lauf ohne VAD: Halluzinationen in der Stille vor Sitzungsbeginn und Schleifen in Pausen (35 Minuten „Und ich schließe auch hier.“). Zweiter Lauf mit Silero-VAD und `-mc 0`: keine Schleifen, gleiche Übereinstimmung mit dem Hoster (96 %). Anleitung: `docs/guides/leipzig-whisper.md`.
  - [x] Ergebnis als `subtitles-<datum>.vtt` mit Herkunft im Kopf ablegen und in `recordings.json` eintragen, danach Abstimmungsprüfung (Ansagen) und Reden neu erzeugen. Stand 12.11.2026: alle 13 Sitzungen mit Protokoll haben Reden; 63 von 64 Abstimmungen der drei Whisper-Tage liegen im Protokoll höchstens 90 s neben der Tafel (eine 4 Minuten, 25.02.2026).
  - [x] Bleibt lokal: Auf GitHub Actions ohne GPU zu langsam, und für neue Sitzungen liefert der Hoster Untertitel.
- [x] **Ausgabe:** `session-speeches-<datum>.json` je Sitzung mit Verlaufsprotokoll und Untertiteln, erzeugt von `leipzig-site-data`; die Registry nennt das Protokoll als `speechesSource`.
- [x] **Rechte umgesetzt (§ 48 UrhG):** Volltexte nur auf der Sitzungsseite mit Quellenhinweis; die Personenseite listet Datum und Dauer mit Link; die API nennt die Quelle und nimmt die Texte von CC0 aus. Videolink der Reden über `sessionVideoLink` (Mediathek, ohne Zeitsprung).
- [ ] **Stichprobe von Hand** an einer Sitzung auf der Seite (Sprecher, Text, Zeit), z. B. 28./29.10.2026, sobald das Protokoll da ist.
- [ ] **Suche:** gibt es nicht (Typesense ist kein kostenloser Dienst, die Suchseite ist mit Magdeburg entfallen). Eine statische Suche (z. B. Pagefind) wäre kostenlos möglich; das Indexieren ganzer Protokolltexte ist rechtlich wie die Sitzungsseite zu sehen, aber nicht geprüft.
- [x] **Verfügbarkeit:** Das Verlaufsprotokoll erscheint etwa zwei Monate nach der Sitzung. Der tägliche Recheck (`--corrections-only`) liest es, sobald es da ist, und `leipzig-site-data` erzeugt danach die Reden.

---

## Offene Fragen

Fragen, die eine Entscheidung oder eine Quelle brauchen. Gesammelt am 12.11.2026.

### Mitglieder und Parteien
- [x] **Partei von Getu Abraham:** Austritt aus SPD-Fraktion und SPD am 8. November 2024 ([Leipziger Zeitung](https://www.l-iz.de/politik/leipzig/2024/11/leipziger-stadtrat-prof-getu-abrahamn-fraktion-spd-608264)), seitdem parteilos; als Override mit `since: 2024-11-09` erfasst. Ob er inzwischen CDU-Mitglied war, ist offen („Wir werden sehen“, kreuzer 05/2025); 2027 tritt er als unabhängiger OB-Kandidat an.
- [x] **Jürgen Günter Butz** (12.11.2026 recherchiert): bleibt bei FREIE SACHSEN. Leipziger Zeitung und Kreuzer führen ihn durchgehend als „Freien Sachsen“, auch nach dem Wechsel in die AfD-Fraktion; ein Austritt wird nirgends genannt. Eine Mitgliedschaft belegt keine Quelle, nur die AfD-Fraktion nennt ihn „parteilos“. Als Override mit allen Quellen festgehalten; bei einer belastbaren Quelle neu entscheiden.
- [ ] **Weitere Parteiwechsel:** Gibt es weitere Mitglieder, deren Partei sich seit der Wahl geändert hat? Welche Quellen sind zulässig, wenn leipzig.de ignoriert wird (bisher: Presse, Fraktionsseiten)?
- [ ] **Franziska Kießling:** ausgeschlossen, weil OParl sie nur am 18.09.2024 als Mitglied führt und sie auf keiner Tafel steht. Gibt es eine Quelle, dass sie das Mandat nicht angetreten hat (z. B. Niederschrift der konstituierenden Sitzung)?
- [ ] **Bezeichnung „Partei“:** Die Seite nennt die Wahlliste 2024 „Partei“. Reicht das mit Erklärung in `DATA.md`, oder soll die Seite „Wahlliste 2024“ zeigen, solange keine andere Quelle vorliegt?
- [ ] **Fraktionswebseiten (M1, Stufe 2):** Werden sie überhaupt gebraucht, wenn Overrides mit Quelle die Ausnahmen abdecken?
- [ ] **`EXTREMIST_CLASSIFICATION`:** Welche Parteien bekommen den Hinweis, mit welcher Quelle (LfV Sachsen) und welchem Wortlaut? Redaktionelle Entscheidung.

### Was veröffentlicht wird
- [x] **Vorläufige Abstimmungen:** `provisional` erscheint mit Kennzeichnung „vorläufig“, Erklärung und Link zum Daten-PR (12.11.2026).
- [x] **Abstimmungen in Prüfung:** `needs-review` erscheint mit Kennzeichnung „in Prüfung“, Erklärung, Link zur Prüfoberfläche und zum Daten-PR; die Stimmen zählen in den Auswertungen mit (12.11.2026).
- [x] **Abstimmungen ohne Tafel** (Handzeichen, geheime Wahl): werden nicht aufgenommen (12.11.2026).
- [x] **Sitzungen ohne Video** (18.09.2024 bis Anfang Dezember 2025): werden nicht aufgenommen (12.11.2026).
- [x] **Vorlagen auf der Seite:** keine eigenen Seiten; Abstimmungen verlinken die Drucksache im Ratsinformationssystem (12.11.2026).
- [ ] **Erforderliche Mehrheit:** Woher kommt `majorityRequirement` (Zweidrittelmehrheit u. a.)? Aus den Protokollen, aus der Vorlage oder von Hand?

### Reden (M5)
- [x] **Rechte am Verlaufsprotokoll** (recherchiert 12.11.2026, keine Rechtsberatung):
  - **Reden:** [§ 48 Abs. 1 Nr. 2 UrhG](https://www.gesetze-im-internet.de/urhg/__48.html) erlaubt Vervielfältigung, Verbreitung und öffentliche Wiedergabe von Reden, die bei öffentlichen Verhandlungen vor kommunalen Organen gehalten wurden. Das deckt die Redebeiträge der öffentlichen Ratsversammlung.
  - **Grenze:** § 48 Abs. 2 verbietet Sammlungen, die überwiegend Reden desselben Urhebers enthalten. Die upstream-Personenseite zeigt alle Reden einer Person im Volltext, das wäre so eine Sammlung. Für Leipzig: Volltexte nur auf der Sitzungsseite (Reden aller Sprecher), auf der Personenseite nur Liste mit Datum, TOP, Redezeit und Link zur Sitzung.
  - **Protokoll als Dokument:** Als amtliches Werk nach [§ 5 Abs. 2 UrhG](https://www.gesetze-im-internet.de/urhg/__5.html) gemeinfrei wäre es nur, wenn es im amtlichen Interesse zur allgemeinen Kenntnisnahme veröffentlicht ist; der Begriff wird eng ausgelegt, eine Entscheidung zu Ratsprotokollen gibt es nicht. Dann gelten Änderungsverbot und Quellenangabe (§§ 62, 63). Die redaktionelle Bearbeitung durch die Stadt erreicht kaum Schöpfungshöhe. Daraus folgt: Quelle je Rede angeben, Text nicht inhaltlich ändern (nur Silbentrennung und Seitenköpfe entfernen).
  - **Leipzig selbst:** Das [Impressum des Ratsinformationssystems](https://ratsinformation.leipzig.de/allris_leipzig_impressum/) nennt keine Nutzungsbedingungen. Die OParl-Lizenz CC BY 4.0 steht am System-Objekt; das Verlaufsprotokoll ist dort aber nicht als Datei verlinkt (nur Beschlussprotokoll und „Alle Anlagen öffentlich“).
- [x] **Whisper lokal:** `whisper-cpp` per Homebrew, Modell `ggml-large-v3-turbo.bin` (1,6 GB, SHA-256 `1fc70f77…e2bc69`) in `output/whisper/`. Test 12.11.2026 an 10 Minuten von 2026-09-03: 78,5 s Rechenzeit (7,6-fach schneller als Echtzeit); 96 % Wortübereinstimmung mit den Untertiteln des Hosters, 74 % mit dem redigierten Verlaufsprotokoll (Hoster: 73 %).

### Video und Belege
- [ ] **Nach Ablauf der Mediathek:** Verschwindet eine Aufzeichnung, entfällt der Video-Link (laut GO § 11 Abs. 8 erst mit Ende der Wahlperiode, beobachtet wird `last_seen`). Soll die Seite dann auf die Belegbilder im Release `evidence-<datum>` verlinken? Bisher gibt es Belegbilder nur für Prüffälle.
- [x] **Rechte an den Belegbildern** (recherchiert 12.11.2026, keine Rechtsberatung): `docs/research/2026-11-12-rechte-belegbilder.md`. Die Tafel selbst ist eine Bildschirmgrafik ohne Werk- oder Lichtbildschutz; Hindernis ist das Recht des Laufbildherstellers (§§ 94, 95 UrhG), das schon kleinste Teile schützt. Tragfähig ist nur das Zitat (§ 51): je Abstimmung ein verkleinerter Ausschnitt nur der Tafel, ohne Personen, an der Abstimmung, die er belegt, mit Quelle „Stadt Leipzig, Aufzeichnung vom …“, ohne eigene Lizenz, Löschung auf Verlangen. Kein Bildarchiv.
  - [ ] Entscheiden: Belegbilder so veröffentlichen, oder nur für Prüfende in einem privaten Repository und öffentlich nur Prüfsummen.
  - [ ] Release-Texte und `datapackage.json`: Bilder ausdrücklich von CC0 ausnehmen, Quelle nennen.

### Lizenz, Betrieb, Recht
- [ ] **Lizenz der eigenen Daten:** CC0 für die aus dem Video gelesenen Stimmen, wie in den Grundsätzen vorgeschlagen? Die Namensnennungen für OParl (CC BY 4.0) und die Bewerberliste (dl-de/by-2-0) bleiben ohnehin.
- [x] **Betreiber und Impressum:** Marcel Schneuer, Angaben wie schneuer.online; Impressum, Datenschutz (GitHub Pages, keine Cookies) und Kontakt umgestellt (12.11.2026).
- [x] **Magdeburg-Daten:** nur Leipzig, Magdeburg entfernt, Hinweis auf upstream bleibt (12.11.2026).
- [ ] **Name der Wahlperiode:** Vorläufig „Leipzig – Wahlperiode VIII“, damit sie sich von Magdeburgs „Wahlperiode VIII“ unterscheidet. Passt das, oder wird mit nur einer Stadt „Wahlperiode VIII“ daraus?
- [x] **Hosting und Adresse:** GitHub Pages ohne eigene Domain; CloudFront- und Typesense-Variablen entfallen (12.11.2026).
- [ ] **Prüfende:** Wer prüft die offenen Fälle (`LEIPZIG_REVIEWERS`), und wer bekommt Schreibrechte?

### Arbeitsweise im Repository
- [x] **Branches und Pull Requests:** Code getrennt per PR nach `main` (`leipzig/code`), Daten über `data/leipzig-votings` (12.11.2026). Die Bereinigung der Prüfvermerke betrifft Daten, die nie veröffentlicht waren, und bleibt deshalb im Daten-PR.
- [x] **Architekturdoku:** arc42 für Leipzig neu geschrieben, ADR-0008 und ADR-0009 (12.11.2026).

---

## Reihenfolge (Vorschlag)

1. M0 (Fork, Grundgerüst)
2. M2, nur Manifest und VTT sichern für die 16 vorhandenen Sitzungstage. Das hat Vorrang, weil das Archiv rollierend gelöscht wird.
3. M1 (Mitglieder, Parteien, Sitzplan)
4. M3 (Prototyp an einer Sitzung, dann Backfill aller Sitzungen mit Video)
5. M4 (Frontend, Deployment, Automatisierung)
