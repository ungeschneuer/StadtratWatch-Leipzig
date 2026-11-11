# StadtratWatch Leipzig: Todoliste

Ziel: einen Fork von [StadtratWatch](https://github.com/JensWinter/StadtratWatch-web) (Magdeburg) für die Leipziger Ratsversammlung bauen. Der Umfang sind **nur die Abstimmungen** pro Person, für **alle Sitzungen mit verfügbarem Video**. Der Betrieb läuft ausschließlich über **kostenlose Dienste**. Alle erzeugten Daten sind maschinenlesbar und werden automatisch aktuell gehalten.

Stand: 10.11.2026

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
- [ ] **Lizenzen:** Daten aus OParl und dem Open-Data-Portal stehen unter CC BY 4.0, die Namensnennung „Stadt Leipzig“ gehört in `datapackage.json` und in die API-Metadaten. Die selbst aus dem Video erhobenen Stimmen können unter CC0 stehen. Code MIT wie upstream.
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

### Aufgaben
- [ ] **OParl-Client** für `persons`, `memberships`, `organizations` mit Paginierung (`size=100`, `links.next`) und `modified_since`. Vorher prüfen, ob `src/scripts/scrape-oparl` aus StadtratWatch mit der Leipziger Basis-URL funktioniert.
- [ ] **Aktuelle und ehemalige Ratsmitglieder** aus den Mitgliedschaften in `organizations/gr/2387` ableiten, mit Beginn und Ende. Damit sind Ausgeschiedene und Nachrücker:innen der Wahlperiode VIII enthalten.
- [ ] **Fraktion** über Mitgliedschaften mit `classification == "Fraktion"` ableiten, mit Zeitraum, damit Fraktionswechsel sichtbar werden. Ohne Fraktionsmitgliedschaft gilt die Person als „fraktionslos“.
- [ ] **Partei, Stufe 1: Open-Data-CSV**
  - [ ] CSV laden, Namen normalisieren (Unicode-NFKD, Kleinschreibung, Titel wie `Dr.`, `Prof.`, `med.` entfernen).
  - [ ] Zuordnen über Nachname + erster Vorname. Fallback für Doppelnamen: Teil eines Doppelnamens stimmt überein und der Vorname stimmt (Fall „Schreyer“ → „Schreyer-Krieg“). Solche Treffer bekommen eine niedrigere `confidence`.
  - [ ] Mehrdeutige oder fehlende Treffer gehen ins Issue.
  - [ ] Das Feld heißt ehrlich `electionListParty` (Liste bei der Wahl 2024), nicht „Parteimitglied“.
- [ ] **Partei, Stufe 2: Fraktionswebseiten** (nur ergänzend, wenn die Seite eine Partei nennt, z. B. bei der Freien Fraktion oder Parteilosen):
  - [ ] Je Seite ein kleiner Parser (Kodierung erkennen, Latin-1 bei der CDU; AfD möglichst über `wp-json` statt HTML).
  - [ ] Ein Treffer setzt `currentParty` nur, wenn die Seite die Partei ausdrücklich nennt. Widersprüche zur CSV gehen ins Issue.
  - [ ] Bricht ein Parser (Struktur geändert), schlägt der Job **nicht** fehl. Es entsteht ein Hinweis, die bisherigen Daten bleiben.
- [ ] **Override-Datei** `data/leipzig-8/overrides.yaml` für Parteiwechsel, Schreibweisen (z. B. „CHristoph“), fehlende Fraktionsmitgliedschaften. Jeder Eintrag mit Begründung und Quelle, angewendet nach dem Import.
- [ ] **Plausibilitätsprüfungen:** genau 70 Stadträt:innen + OB aktiv; jede aktive Person hat genau eine Fraktion oder ist fraktionslos; jede aktive Person hat eine Partei oder einen dokumentierten Override; Namens-Abgleich mit der Abstimmungstafel (siehe M3).
- [ ] **Ausgabe:** `persons.json|csv`, `factions.json|csv`, `memberships.json|csv` sowie daraus generiert `registry.json` (Personen, Fraktionen, Parteien mit Sitzzahlen).

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
- [ ] **1. Zeitfenster aus der VTT:** Phrasen wie „Votum“, „bitte ich um Ihr …“, „Ergebnis“, `\d+ zu \d+ zu \d+`, „abgelehnt“, „beschlossen“, „angenommen“. Es werden nur diese Abschnitte dekodiert.
  - Fallback ohne VTT: die ganze Sitzung in 360p mit 0,5 fps scannen und die Tafel an einer festen Pixel-Signatur erkennen.
- [ ] **2. Endstand finden:** den letzten Frame **mit Ergebnisbalken** vor dem Wechsel der Kopfzeile wählen. Nur diesen Frame in 1080p laden (`ffmpeg -ss <t> -i <chunklist_1080p> -frames:v 1`).
- [ ] **3. Tafel auslesen:**
  - [ ] Layout-Konfiguration pro Wahlperiode: Zellkoordinaten von 4 Spalten × 22 Zeilen bei 1920×1080.
  - [ ] Farbe je Nummernfeld klassifizieren (Median-RGB, dann der nächste Wert unter grün/rot/gelb/weiß). Abgebildet auf J/N/E/O.
  - [ ] Tesseract (`deu`) für die **Kopfzeile** (TOP-Nummer, Drucksache `VIII-DS-\d{5}(-ÄA-\d+|-NF-\d+)?`, Titel) und für **Anwesende** / **Abgegebene Stimmen**.
  - [ ] Namens-OCR einmal pro Sitzung, um die Zuordnung **Sitznummer → OParl-Person** zu prüfen. Die Sitznummern ändern sich bei Nachrücker:innen.
- [ ] **4. Plausibilitätsprüfungen:**
  - [ ] Zahl der farbigen Felder gleich „Abgegebene Stimmen“
  - [ ] Zählung J/N/E gleich dem Ergebnisbalken
  - [ ] Tafel gleich dem **mündlich verkündeten Ergebnis** aus der VTT. Die KI-Untertitel können Zahlen falsch schreiben („13.33.13“, „44.0“), deshalb tolerant parsen.
  - [ ] Korrekturen wie „wird hinzugezählt“ erkennen. Dann **beides speichern:** `boardVotes` und `announcedResult` mit `corrections[]` (Person, Stimme, Zeitstempel, Zitat).
- [ ] **5. Zuordnung zu TOP und Vorlage:** Kopfzeile → OParl-`agendaItem.number` der jeweiligen Sitzung. Drucksache → OParl-`paper.reference`. Änderungsanträge (`-ÄA-`) und Neufassungen (`-NF-`) ihrer Hauptvorlage zuordnen. Antragsteller:innen aus `paper.originatorOrganization`. Fortsetzungstage sind eigene OParl-Sitzungen.
- [ ] **6. Sonderfälle** als `votingMethod` erfassen: keine Tafel (Handzeichen, Anlage ausgefallen), geheime Wahl, en-bloc, punktweise Abstimmung, Befangenheit (§ 20 SächsGemO), Stimme des OB (Sitz 71), `majorityRequirement`.
- [x] **7. Prüfung durch Menschen:** Route `/leipzig` in `session-review` (GitHub Pages), Prüffälle in `review-<datum>.json`, Benachrichtigung per Issue je Sitzung, Speichern als Commit in `corrections-<datum>.json`, Nachprüfung per Workflow. Freigabe per PR-Merge.
  - [ ] Einmalig einrichten: GitHub Pages (Quelle „GitHub Actions“), Schreibrechte der Prüfenden, Variable `LEIPZIG_REVIEWERS`.
  - [ ] Workflows einmal auf GitHub durchlaufen lassen (bisher nur lokal getestet).
- [ ] **8. Regressionstest:** 1–2 Sitzungen von Hand prüfen (z. B. 28./29.10.2026) und als „goldenen Datensatz“ ablegen.
- [ ] **Ausgabe:** `session-scan-YYYY-MM-DD.json` (StadtratWatch-kompatibel, erweitert um `personId`, `agendaItemId`, `paperId`, `announcedResult`, `corrections`, `evidenceImage`, `confidence`) sowie `votings.csv` und `votes.csv`.

### Ressourcen (Schätzung pro Sitzung)
- 60–120 Abstimmungen. Dekodiert werden nur die Zeitfenster in 360p, dazu ein 1080p-Frame pro Abstimmung.
- ffmpeg und Tesseract laufen auf dem Standard-Runner von GitHub Actions in wenigen Minuten.

## M4: Umsetzung im Fork

- [ ] **Stadt-Konfiguration** (Name, OParl-URL, Wahlperiode, Texte) statt fest verdrahtetem Magdeburg. Dadurch bleiben Merges von upstream möglich.
- [ ] **Video-Abstraktion:** `youtubeUrl` ersetzen durch `video: { provider: "youtube" | "leipzig-mediathek", pageUrl, hlsUrl? }`. Betroffen sind ca. 15 Dateien (Modelle, Session- und Voting-Seiten, session-review). Wiedergabe als Link auf die Mediathek mit Zeitstempel oder als eingebetteter Player. Ist das Video offline, bleibt das Belegbild.
- [ ] **Reden-Funktionen deaktivieren:** Speech-Seiten, Redezeit-Statistiken, `speech-to-text`, `speaker-diarization`, `detect-ai-text` werden nicht genutzt, per Konfiguration ausblenden.
- [ ] **Registry `data/leipzig-8/registry.json`** aus M1 generieren.
- [ ] **OParl-Pipeline schlank halten:** nur Sitzungen, TOPs und die **in Abstimmungen vorkommenden** Vorlagen (Titel, Nummer, Link zum Ratsinfo). Kein Download aller PDFs, kein Tika, kein Typesense.
- [ ] **Adapter M3 → `session-scan-*.json`** mit optionalem `personId` (abwärtskompatibel zu upstream).
- [ ] **S3/CloudFront ersetzen:**
  - [ ] Abstimmungs-PNGs (`generate-image-assets`) beim Build erzeugen oder als GitHub-Release-Assets ablegen
  - [ ] `paper-votings` als statische JSON-Dateien im Build
- [ ] **Partei-Metadaten** redaktionell prüfen, einschließlich `EXTREMIST_CLASSIFICATION`. Bezug ist das LfV **Sachsen** (nicht Sachsen-Anhalt), mit Quellenangabe.
- [ ] **Offene Daten ausliefern:**
  - [ ] API v1 unverändert (`/api/v1/parliament-periods/leipzig-8/votings/{session}.json`)
  - [ ] Bulk-Downloads `/data/leipzig-8/*.csv` + `datapackage.json`
  - [ ] Lizenz und Provenienz in jeder Antwort
- [ ] **Hosting:** GitHub Pages über Actions (empfohlen: keine Build-Minuten-Grenze wie bei Netlify Free) oder Netlify Free.
- [ ] **Workflows:** `members.yml`, `recordings.yml`, `votings.yml`, `deploy.yml` entsprechend dem Zeitplan. Daten kommen per PR, Fehler als Issue.
- [ ] **Dokumentation:** README (Fork-Hinweis, Leipzig), `DATA.md` (Codebook, Methodik, Grenzen: mündliche Korrekturen, Abstimmungen ohne Tafel, Liste ≠ Parteimitgliedschaft, Videos nur ca. 12 Monate verfügbar).

---

## Reihenfolge (Vorschlag)

1. M0 (Fork, Grundgerüst)
2. M2, nur Manifest und VTT sichern für die 16 vorhandenen Sitzungstage. Das hat Vorrang, weil das Archiv rollierend gelöscht wird.
3. M1 (Mitglieder, Parteien, Sitzplan)
4. M3 (Prototyp an einer Sitzung, dann Backfill aller Sitzungen mit Video)
5. M4 (Frontend, Deployment, Automatisierung)
