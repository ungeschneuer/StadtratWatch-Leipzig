# StadtratWatch Leipzig: Todoliste

Ziel: einen Fork von [StadtratWatch](https://github.com/JensWinter/StadtratWatch-web) (Magdeburg) für die Leipziger Ratsversammlung bauen. Der Umfang sind **nur die Abstimmungen** pro Person, für **alle Sitzungen mit verfügbarem Video**. Der Betrieb läuft ausschließlich über **kostenlose Dienste**. Alle erzeugten Daten sind maschinenlesbar und werden automatisch aktuell gehalten.

Stand: 12.11.2026

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Repository | Fork, kein Kontakt zum Upstream. Änderungen sollen konfigurierbar bleiben, damit spätere Merges von upstream möglich sind. |
| Umfang | Nur Abstimmungen. Keine Reden, keine Transkripte, keine Volltextsuche. |
| Zeitraum | Alle Sitzungen, zu denen es ein Video gibt. |
| Betrieb | Nur kostenlose Dienste: GitHub Actions, GitHub Pages bzw. Netlify Free, Git als Datenspeicher. Kein S3, kein VPS, kein Typesense. |
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
| **Archivtiefe** | Von 34 Sitzungstagen seit 18.09.2024 haben nur **16 eine Video-Seite**, alle ab dem **17.12.2025**. Ältere Seiten existieren nicht mehr, und die Wayback Machine hat nur eine einzige Aufzeichnungsseite archiviert. Vermutlich hält die Stadt die Videos nur rollierend etwa 12 Monate vor. |
| **Abstimmungstafel** | Die Tafel wird vollbildig eingeblendet. Die Kopfzeile enthält TOP, Drucksache und Titel (`19.10.2 VIII-DS-02186-ÄA-02 Masterplan Grün …`). Darunter stehen 4 Spalten nach Fraktionen mit festen Sitznummern 1–71. Die **Farbe** im Nummernfeld zeigt die Stimme: grün = Ja, rot = Nein, gelb = Enthaltung, weiß = keine Stimme. Unten stehen „Anwesende“ und „Abgegebene Stimmen“, nach Schluss erscheint ein Ergebnisbalken. |
| **Mündliche Korrekturen** | Beispiel: „Herr Stange wird hinzugezählt, 21 zu 36 zu 0“. Auf der Tafel ist Stange weiß, die Tafel zeigt 20 Ja. Die Tafel entspricht also nicht immer dem amtlichen Ergebnis. |
| **StadtratWatch** | Astro (statisch) + Bun/Deno-Skripte. `registry.json` ist die Quelle der Wahrheit, Abstimmungen liegen in `session-scan-YYYY-MM-DD.json`. YouTube ist in ca. 15 Dateien fest verdrahtet. Binärdaten (Abstimmungs-PNGs, Drucksachen) werden über S3/CloudFront ausgeliefert, die Suche läuft über Typesense auf einem VPS. Es gibt keinen Scheduler. |

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
- [ ] Datei `LEIPZIG.md` bzw. ein ADR anlegen: Fork-Strategie, Abweichungen von upstream, Entscheidungen von oben.
- [ ] Magdeburg-Daten (`data/magdeburg-*`) entfernen oder ausblenden, Wahlperiode `leipzig-8` anlegen (Beginn 18.09.2024).
- [ ] CI des Forks zum Laufen bringen (`ci.yml`: Deno-, Bun- und Astro-Checks).
- [x] Leipzig-Skripte als eigene Bun-Ordner `src/scripts/leipzig-*` (in `tsconfig.json` und `deno.json` registriert wie upstream).

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
- [ ] **Deep-Links:** Prüfen, ob der Player-Parameter `videostartoffset` zeitgenaue Links auf die Mediathek erlaubt. Das ersetzt die YouTube-Zeitstempel, solange das Video online ist.
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
  - [ ] Antragsteller:innen aus `paper.originatorOrganization`.
- [ ] **6. Sonderfälle** als `votingMethod` erfassen: keine Tafel (Handzeichen, Anlage ausgefallen), geheime Wahl, en-bloc, punktweise Abstimmung, Befangenheit (§ 20 SächsGemO), Stimme des OB (Sitz 71), `majorityRequirement`. Bisher erkannt: Geschäftsordnungsanträge (`procedural`), ungültige Tafeln (`discarded`).
- [ ] **Statuspunkt im 1080p-Frame:** Der runde grüne Punkt während der Abstimmung wird manchmal als Ja-Balken gelesen. Betrifft nur Ergebnisse unter einer Sekunde (alle verworfen); Abhilfe: Seitenverhältnis prüfen.
- [ ] **Irreführender Kommentar in `extract-session.ts`:** Die Suche `searchResultFrames` begründet sich mit „1080p läuft einige Sekunden versetzt“. Gemessen am 12.11.2026: 360p und 1080p sind zeitgleich, die Suche wurde in keiner der 547 Abstimmungen gebraucht. Kommentar richtigstellen, Suche als Rückfall für Überblendungen behalten.
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

- [ ] **Stadt-Konfiguration** (Name, OParl-URL, Wahlperiode, Texte) statt fest verdrahtetem Magdeburg. Beispiele im Build: Fußzeile „keine offizielle Seite der Stadt Magdeburg … Code for Magdeburg“, YouTube-Kanal der Stadt Magdeburg auf der Übersicht der Wahlperiode. Dadurch bleiben Merges von upstream möglich.
- [x] **Video-Abstraktion:** `RegistrySession.video` (`url`, `label`) neben `youtubeUrl` (abwärtskompatibel, Magdeburg unverändert); `sessionVideoLink()` in `astro/src/models/session-video.ts` wählt den Link für Sitzungs- und Abstimmungsseite. Leipzig verlinkt die Mediathek-Seite, solange sie online ist.
  - [ ] Zeitgenaue Links auf die Mediathek (hängt an `videostartoffset`, siehe M2) oder eingebetteter Player.
  - [ ] `Speech.astro` nutzt noch `youtubeUrl` (betrifft nur Reden, siehe nächster Punkt).
- [ ] **Reden-Funktionen deaktivieren:** Speech-Seiten, Redezeit-Statistiken, `speech-to-text`, `speaker-diarization`, `detect-ai-text` werden nicht genutzt, per Konfiguration ausblenden.
- [x] **Registry `data/leipzig-8/registry.json`** aus `members.json` und den Sitzungen mit Abstimmungen, Skript `src/scripts/leipzig-site-data`. `approved`, sobald keine Abstimmung mehr auf Prüfung oder amtliches Ergebnis wartet (Stand 12.11.2026: 5 von 16).
- [ ] **OParl-Pipeline schlank halten:** nur Sitzungen, TOPs und die **in Abstimmungen vorkommenden** Vorlagen (Titel, Nummer, Link zum Ratsinfo). Kein Download aller PDFs, kein Tika, kein Typesense.
- [x] **Adapter M3 → `session-scan-*.json`** (`src/scripts/leipzig-site-data`): veröffentlicht `verified`, `corrected`, `reviewed`, `provisional` (510 von 547), Namen wie in der Registry, Titel aus OParl, Typ aus der Drucksachennummer. Läuft in den Workflows `leipzig-votings` und `leipzig-review-recheck`. Site-Build mit Leipzig geprüft (12.11.2026, 4878 Seiten, keine Fehler).
  - [ ] `authors` aus `paper.originatorOrganization` (siehe M3, Schritt 5), `majorityRequirement` (siehe M3, Schritt 6).
  - [ ] `voting-paper-map.json` ist leer, bis Leipziger Vorlagen eigene Seiten haben.
- [ ] **S3/CloudFront ersetzen:**
  - [ ] Abstimmungs-PNGs (`generate-image-assets`) beim Build erzeugen oder als GitHub-Release-Assets ablegen
  - [ ] `paper-votings` als statische JSON-Dateien im Build
- [ ] **Zeitverlauf von Fraktion und Partei in Auswertungen und Datenverarbeitung:** Heute ordnet die Seite jede Person für alle Abstimmungen ihrer aktuellen Fraktion und einer festen Partei zu (`RegistryPerson.factionId`, `partyId`). Fraktions- und Parteiwechsel (z. B. Abraham: SPD → fraktionslos → CDU → fraktionslos; Butz: Liste FREIE SACHSEN, seit 18.09.2025 AfD-Fraktion) verfälschen damit die Auswertungen.
  - [ ] **Datenmodell:** Parteizugehörigkeit mit Zeiträumen (`partyMemberships` wie `factionMemberships`), Quellen und Overrides für Parteiwechsel; die Wahlliste 2024 bleibt der Ausgangswert.
  - [ ] **Datenverarbeitung:** Fraktion und Partei am Sitzungstag in jede Stimme übernehmen (`session-scan-*.json`, optional und abwärtskompatibel, z. B. `factionId`/`partyId` je Stimme); `votes-<datum>.csv` hat die Fraktion bereits, die Partei noch fest.
  - [ ] **Auswertungen** (`astro/src/data-analysis/`: VotingMatrix, UniformityScore, MotionsSuccess, PersonsForces, Fraktions- und Parteiseiten, Abstimmungsseite nach Fraktionen) rechnen mit der Zugehörigkeit am Abstimmungstag statt der aktuellen; Sitzzahlen je Zeitpunkt.
  - [ ] **Anzeige:** Wechsel auf der Personenseite als Verlauf (Fraktion/Partei mit Zeitraum), auf Fraktions- und Parteiseiten auch ehemalige Mitglieder.
- [ ] **Partei-Metadaten** redaktionell prüfen, einschließlich `EXTREMIST_CLASSIFICATION`. Die Seite zeigt die Wahlliste 2024 als „Partei“; bei Fraktionswechseln (z. B. Abraham: Liste SPD, heute fraktionslos) prüfen, ob ein Override mit Quelle nötig ist. Bezug ist das LfV **Sachsen** (nicht Sachsen-Anhalt), mit Quellenangabe.
- [ ] **Offene Daten ausliefern:**
  - [ ] API v1 unverändert (`/api/v1/parliament-periods/leipzig-8/votings/{session}.json`)
  - [ ] Bulk-Downloads `/data/leipzig-8/*.csv` + `datapackage.json`
  - [ ] Lizenz und Provenienz in jeder Antwort
- [ ] **Hosting:** GitHub Pages über Actions (empfohlen: keine Build-Minuten-Grenze wie bei Netlify Free) oder Netlify Free.
- [ ] **Workflows:** `members.yml`, `recordings.yml`, `votings.yml`, `deploy.yml` entsprechend dem Zeitplan. Daten kommen per PR, Fehler als Issue.
- [ ] **Dokumentation:** README (Fork-Hinweis, Leipzig), `DATA.md` (Codebook, Methodik, Grenzen: mündliche Korrekturen, Abstimmungen ohne Tafel, Liste ≠ Parteimitgliedschaft, Videos nur ca. 12 Monate verfügbar).

---

## Offene Fragen

Fragen, die eine Entscheidung oder eine Quelle brauchen. Gesammelt am 12.11.2026.

### Mitglieder und Parteien
- [ ] **Partei von Getu Abraham:** Gewählt auf der SPD-Liste, SPD-Fraktion bis 08.11.2024, CDU-Fraktion 13.03.2025–22.09.2026, seitdem fraktionslos. Ist er noch SPD-Mitglied? Ohne Quelle zeigt die Seite „Partei SPD“. Falls nicht: Override mit Quelle.
- [ ] **Weitere Parteiwechsel:** Gibt es außer Abraham Mitglieder, deren Partei sich seit der Wahl geändert hat (z. B. Butz, Liste FREIE SACHSEN, jetzt AfD-Fraktion)? Welche Quelle ist zulässig, wenn leipzig.de ignoriert wird (Fraktionsseiten, Presse, Parteiseiten)?
- [ ] **Franziska Kießling:** ausgeschlossen, weil OParl sie nur am 18.09.2024 als Mitglied führt und sie auf keiner Tafel steht. Gibt es eine Quelle, dass sie das Mandat nicht angetreten hat (z. B. Niederschrift der konstituierenden Sitzung)?
- [ ] **Bezeichnung „Partei“:** Die Seite nennt die Wahlliste 2024 „Partei“. Reicht das mit Erklärung in `DATA.md`, oder soll die Seite „Wahlliste 2024“ zeigen, solange keine andere Quelle vorliegt?
- [ ] **Fraktionswebseiten (M1, Stufe 2):** Werden sie überhaupt gebraucht, wenn Overrides mit Quelle die Ausnahmen abdecken?
- [ ] **`EXTREMIST_CLASSIFICATION`:** Welche Parteien bekommen den Hinweis, mit welcher Quelle (LfV Sachsen) und welchem Wortlaut? Redaktionelle Entscheidung.

### Was veröffentlicht wird
- [ ] **Vorläufige Abstimmungen:** `provisional` (Prüfungen bestanden, aber noch kein amtliches Ergebnis) erscheint schon auf der Seite, mit dem Hinweis „Prüfung nicht abgeschlossen“. So lassen oder erst nach dem amtlichen Ergebnis veröffentlichen?
- [ ] **Abstimmungen in Prüfung:** `needs-review` fehlt auf der Seite, bis entschieden ist. Lieber mit Kennzeichnung zeigen?
- [ ] **Abstimmungen ohne Tafel** (Handzeichen, geheime Wahl): Die Protokolle nennen das Ergebnis, aber nicht die Stimmen je Person. Als Abstimmung ohne Einzelstimmen aufnehmen oder weglassen?
- [ ] **Sitzungen ohne Video** (18.09.2024 bis Anfang Dezember 2025): Für sie gibt es nur die Ergebnisse aus den Protokollen. Bleibt es bei „nur Sitzungen mit Video“?
- [ ] **Vorlagen auf der Seite:** Sollen Leipziger Vorlagen eigene Seiten bekommen (Paper-Index aus OParl, ohne PDFs), damit Abstimmungen auf sie verlinken? Bisher ist `voting-paper-map.json` leer.
- [ ] **Erforderliche Mehrheit:** Woher kommt `majorityRequirement` (Zweidrittelmehrheit u. a.)? Aus den Protokollen, aus der Vorlage oder von Hand?

### Video und Belege
- [ ] **Nach Ablauf der Mediathek:** Die Stadt löscht Aufzeichnungen nach etwa einem Jahr, danach entfällt der Video-Link. Soll die Seite dann auf die Belegbilder im Release `evidence-<datum>` verlinken? Bisher gibt es Belegbilder nur für Prüffälle.
- [ ] **Rechte an den Belegbildern:** Dürfen Standbilder aus den Aufzeichnungen der Stadt öffentlich in GitHub Releases liegen? Klären, bevor die Releases öffentlich sind.

### Lizenz, Betrieb, Recht
- [ ] **Lizenz der eigenen Daten:** CC0 für die aus dem Video gelesenen Stimmen, wie in den Grundsätzen vorgeschlagen? Die Namensnennungen für OParl (CC BY 4.0) und die Bewerberliste (dl-de/by-2-0) bleiben ohnehin.
- [ ] **Betreiber und Impressum:** Wer betreibt StadtratWatch Leipzig? Impressum, Datenschutz und Kontakt der Seite verweisen noch auf Code for Magdeburg.
- [ ] **Magdeburg-Daten:** Eine Seite mit beiden Städten (wie jetzt im Build) oder nur Leipzig? Davon hängen M0 (Magdeburg entfernen oder ausblenden) und die Stadt-Konfiguration ab.
- [ ] **Name der Wahlperiode:** Vorläufig „Leipzig – Wahlperiode VIII“, damit sie sich von Magdeburgs „Wahlperiode VIII“ unterscheidet. Passt das, oder wird mit nur einer Stadt „Wahlperiode VIII“ daraus?
- [ ] **Hosting und Adresse:** GitHub Pages oder Netlify Free, eigene Domain? Was ersetzt `AWS_CLOUDFRONT_BASE_URL` (Pflichtvariable des Builds, heute für Vorschaubilder und Vorlagen) und die Typesense-Variablen, wenn es keine Suche gibt?
- [ ] **Prüfende:** Wer prüft die offenen Fälle (`LEIPZIG_REVIEWERS`), und wer bekommt Schreibrechte?

### Arbeitsweise im Repository
- [ ] **Branches und Pull Requests:** Auf `data/leipzig-votings` liegen bisher Code- und Datencommits gemeinsam, nichts ist gepusht. Code getrennt per PR nach `main` und die Daten über den Daten-Branch? AGENTS.md verlangt für Korrekturen an geprüften Daten einen eigenen PR (betrifft `fe5e413`, Bereinigung der Prüfvermerke).
- [ ] **Architekturdoku:** `docs/arc42/` beschreibt Leipzig noch nicht. Als eigenes ADR (siehe M0, `LEIPZIG.md` bzw. ADR) oder in die bestehenden Kapitel?

---

## Reihenfolge (Vorschlag)

1. M0 (Fork, Grundgerüst)
2. M2, nur Manifest und VTT sichern für die 16 vorhandenen Sitzungstage. Das hat Vorrang, weil das Archiv rollierend gelöscht wird.
3. M1 (Mitglieder, Parteien, Sitzplan)
4. M3 (Prototyp an einer Sitzung, dann Backfill aller Sitzungen mit Video)
5. M4 (Frontend, Deployment, Automatisierung)
