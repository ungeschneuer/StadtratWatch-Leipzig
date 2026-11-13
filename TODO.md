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
| Betrieb | Nur kostenlose Dienste: GitHub Actions, GitHub Pages, Git als Datenspeicher. Kein S3, kein Typesense. Vorerst keine eigene Domain. Ausnahme: ALLRIS nimmt von GitHub Actions keine Verbindung an, deshalb holt der vorhandene Server des Betreibers die Niederschriften (`minutes-runner/`, 12.11.2026). |
| Betreiber | Marcel Schneuer, Impressum wie schneuer.online (12.11.2026). |
| Veröffentlichung | Sitzungen ohne Video und Abstimmungen ohne Tafel werden nicht erfasst. `provisional` und `needs-review` erscheinen mit Hinweis, wie der Fall behoben wird, und Link zum Daten-PR (12.11.2026). |
| Stadt Leipzig | Wird nicht kontaktiert. Es wird nur mit öffentlich zugänglichen Daten gearbeitet. |
| Mitgliederquellen | leipzig.de wird ignoriert. Mitglieder und Fraktionen kommen aus OParl, Parteien aus dem Open-Data-Datensatz der Wahl 2024, Abweichungen als Override mit Quelle. Fraktionswebseiten werden nicht genutzt (12.11.2026). |

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
- [x] **Stabile IDs:** OParl-IDs für Personen, Fraktionen, Sitzungen, TOPs und Vorlagen in Downloads und API (13.11.2026). Namen sind nie der Schlüssel; die Adressen der Seite bleiben lesbar (Entscheidung 12.11.2026).
- [x] **Lesbare Links:** deutsche Adressen (`/wahlperiode-8/sitzung/<datum>/abstimmung/<top>`), Abstimmungen nach TOP statt laufender Nummer, sprechende Linktexte; alte Adressen leiten weiter (Entscheidung 12.11.2026, umgesetzt 13.11.2026; auch `/datenschutz`, `/kontakt`).
- [x] **CSV im Long-Format:** `votings.csv`, `votes.csv`, `sessions.csv`, `persons.csv`, `faction-memberships.csv` unter `/data/leipzig-8/`, geschrieben von `leipzig-site-data` (12.11.2026).
- [x] **Frictionless `datapackage.json`** mit Spalten, Typen, Schlüsseln, Lizenzen und Quellen; lokal mit `frictionless validate` geprüft (alle Tabellen VALID), ein Test hält Beschreibung und CSV-Köpfe gleich (12.11.2026).
- [ ] **Provenienz pro Datensatz:** `source_url`, `retrieved_at`, `method` (`oparl` | `opendata-csv` | `faction-website` | `video-board` | `subtitle` | `manual`), `confidence`, `reviewed`.
- [x] **Git als Änderungsprotokoll** („Git Scraping“): jede Aktualisierung ein Commit.
- [x] **Lizenzen:** OParl steht unter CC BY 4.0 (`oparl/system`), der Open-Data-Datensatz der Bewerber:innen unter Datenlizenz Deutschland – Namensnennung 2.0. Die Namensnennung „Stadt Leipzig“ gehört in `datapackage.json` und in die API-Metadaten (in `members.json` bereits unter `sources`). Die selbst aus dem Video erhobenen Stimmen können unter CC0 stehen. Code MIT wie upstream.
- [x] **Codebook** `DATA.md`: Downloads, Felder, Stimmcodes, Mehrheiten, Prüfstatus, Methodik, Grenzen, Lizenzen (12.11.2026).

### Ressourcenschonung und Aktualität (nur kostenlose Dienste)
- [x] **GitHub Actions mit `schedule`**: Das öffentliche Repo bekommt unbegrenzt Minuten auf Standard-Runnern. Ein Job darf bis zu 6 h laufen.
- [ ] **Inkrementell abrufen** über OParl `modified_since` und HTTP `ETag`/`If-Modified-Since`. Nur committen, wenn sich etwas geändert hat.
- [x] **Höflich abrufen:** User-Agent mit Projekt-URL, 0,3–1 s Pause zwischen Requests.
- [x] **Keine Videos speichern.** Gespeichert werden nur Metadaten, die VTT (ca. 270 KB pro Sitzung) und kleine Belegbilder.
- [x] **Belegbilder:** je veröffentlichter Abstimmung ein Zitatbild (960 px, 16 Farbstufen, ca. 135 KB statt der ursprünglich angepeilten 50 KB, zugunsten der Lesbarkeit) in GitHub Releases, nicht im Git (Entscheidung 12.11.2026).
- [x] **Bei Fehlern ein Issue öffnen** statt still falsche Daten zu schreiben. Neue Daten kommen als **Pull Request**, nicht als direkter Push.
- [x] **Keepalive:** GitHub deaktiviert `schedule`-Workflows nach 60 Tagen ohne Aktivität. `keepalive.yml` aktiviert sie monatlich über die API wieder, ohne Commit (12.11.2026).

### Zeitplan

| Job | Häufigkeit | Aufwand pro Lauf |
|---|---|---|
| OParl inkrementell (Personen, Mitgliedschaften, Sitzungen, TOPs, betroffene Vorlagen) | täglich, nachts | < 1 min |
| Neue Aufzeichnungen suchen | täglich in den 21 Tagen nach einem Sitzungstermin (aus OParl), sonst wöchentlich | Sekunden |
| Abstimmungen aus dem Video extrahieren | einmal pro neuer Aufzeichnung | ca. 5–15 min |
| Statische Seite bauen und veröffentlichen | bei jedem Merge auf `main` | wenige Minuten |

---

## M0: Fork und Grundgerüst

- [x] `JensWinter/StadtratWatch-web` geforkt, seit 12.11.2026 als eigenständiges Repository (kein GitHub-Fork) https://github.com/ungeschneuer/StadtratWatch-Leipzig, Upstream als Remote `upstream`. Hinweis auf den Ursprung steht in der README.
- [x] ADR-0008 (Fork nur für Leipzig, GitHub Pages) und ADR-0009 (Tafel, Prüfung, Freigabe per PR); arc42 für Leipzig neu geschrieben (12.11.2026).
- [x] Magdeburg entfernt: Daten, Pipeline-Skripte, Docker, Typesense, Netlify, Vorlagen-, Such- und KI-Seiten, Magdeburger Ansichten der Prüfoberfläche. Wahlperiode `leipzig-8` angelegt.
- [x] CI auf GitHub grün (`ci.yml`: Deno-Lint, Bun- und Astro-Checks; PR #3 und #4, 12.11.2026).
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
- [x] **Partei, Stufe 2: Fraktionswebseiten** entfällt: Overrides mit Quelle decken die Ausnahmen ab (Entscheidung 12.11.2026).
- [x] **Override-Datei** `data/leipzig-8/member-overrides.json` (JSON wie die Korrekturen der Abstimmungen): Ausschluss, Schreibweise, Partei. Jeder Eintrag mit Begründung und Quelle, bei jedem Lauf angewendet. Bisher: Partei des OB (OB-Wahl 2020), „CHristoph“ Neumann, Franziska Kießling (Mitgliedschaft nur am 18.09.2024, auf keiner Tafel).
- [x] **Plausibilitätsprüfungen:** genau 70 Stadträt:innen + OB aktiv; jede aktive Person hat eine Fraktion oder ist fraktionslos; jede Person hat eine Partei; Overrides treffen Mitglieder; IDs eindeutig; Abgleich mit der Abstimmungstafel (wer auf der Tafel steht, ist an dem Tag Mitglied; Vereidigung bis 7 Tage vor dem OParl-Beginn verschiebt den Beginn).
- [x] **Ausgabe:** `members.json` (Fraktionen, Parteien, Personen im Format der StadtratWatch-Registry, erweitert um `oparlId`, `factionMemberships`, `partySource`; Typ `LeipzigMembersFile`), `persons.csv`, `faction-memberships.csv`. `votes-<datum>.csv` hat die Spalten `factionId` (am Sitzungstag) und `partyId`.
- [x] **`registry.json`** schreibt `leipzig-site-data` (M4).

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
- [x] **6. Sonderfälle** (13.11.2026): punktweise Abstimmung als `itemNumber` aus Beschlussprotokoll/ALLRIS (144 Abstimmungen), Stimme des OB entscheidend (`decidedByMayor`, 12), Befangenheit (§ 20 SächsGemO) aus `recusals.json` mit Zitat aus dem Verlaufsprotokoll (3 Fälle mit Tafel, Möbius 28.01.2026 TOP 9.4.1 ohne Tafel). Keine Tafel und geheime Wahl werden nicht erfasst (Entscheidung 12.11.2026); en bloc kam nicht vor. `majorityRequirement` siehe M4.
- [x] **Statuspunkt im 1080p-Frame:** Ein Ergebnisbalken muss mindestens drei Viertel einer Tabellenzeile hoch sein (Balken 32–38 px, Punkt 13–17 px). Testbild `board-2026-09-status-dot.png`.
- [x] **Irreführender Kommentar in `extract-session.ts`:** richtiggestellt (360p und 1080p zeitgleich), Suche als Rückfall für Überblendungen behalten.
- [x] **7. Prüfung durch Menschen:** Route `/leipzig` in `session-review` (GitHub Pages), Prüffälle in `review-<datum>.json`, Benachrichtigung per Issue je Sitzung, Speichern als Commit in `corrections-<datum>.json`, Nachprüfung per Workflow. Freigabe per PR-Merge.
  - [x] Einmalig einrichten: GitHub Pages (Quelle „GitHub Actions“), Variable `LEIPZIG_REVIEWERS=ungeschneuer` (12.11.2026; vorerst prüft nur der Betreiber, weitere Prüfende brauchen Schreibrechte).
  - [x] Workflows auf GitHub gelaufen: members, recordings, votings, recheck, deploy (12.11.2026).
  - [ ] Die 17 offenen Fälle entscheiden.
- [ ] **8. Regressionstest:** 1–2 Sitzungen von Hand prüfen (z. B. 28./29.10.2026) und als „goldenen Datensatz“ ablegen.
- [x] **Ausgabe:** `votings-<datum>.json` und `votes-<datum>.csv` (mit `personId`, Fraktion und Partei).
  - [x] StadtratWatch-kompatible `session-scan-YYYY-MM-DD.json` (Adapter, siehe M4) und `votings.csv`.

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
  - [x] `majorityRequirement` aus dem Titel (`leipzig-site-data/majority-requirement.ts`, Recherche `docs/research/2026-11-12-mehrheitserfordernisse-leipzig.md`): Hauptsatzung 36 Ja, Ehrenbürger/Ehrenmedaille und Ratsbürgerentscheid 48 Ja, Wahlen Mehrheit der Anwesenden. Bisher ein Fall: 25.03.2026 TOP 19.10 (12.11.2026).
- [x] **S3/CloudFront entfallen:** keine Abstimmungs-PNGs und Vorschaubilder mehr, Belegbilder in GitHub Releases.
- [x] **Zeitverlauf von Fraktion und Partei in Auswertungen und Datenverarbeitung** (12.11.2026):
  - [x] **Datenmodell:** `RegistryPerson.factionMemberships` und `partyMemberships` (optional, Magdeburg unverändert); `factionIdOn()`/`partyIdOn()` in `astro/src/models/person-affiliation.ts`. `members.json` führt die Parteizugehörigkeit mit Zeiträumen und Quelle je Zeitraum; ein Override mit `party` und `since` beginnt einen neuen Zeitraum. Die Wahlliste 2024 ist der Ausgangswert.
  - [x] **Datenverarbeitung:** Die Registry trägt den Verlauf, deshalb braucht `session-scan-*.json` keine Fraktion je Stimme. `votes-<datum>.csv` hat Fraktion und Partei am Sitzungstag.
  - [x] **Auswertungen:** Teilnahme, Enthaltungen, Abstimmungserfolg, Geschlossenheit und Redezeit je Fraktion und Partei (über `getPersonsOfSessionAndFaction`/`…Party`), die Fraktionsaufteilung jeder Abstimmung und die Abstimmungsseite rechnen mit der Zugehörigkeit am Sitzungstag. Die Ähnlichkeitsgrafik und die Personenliste zeigen bewusst die aktuelle Fraktion.
  - [x] **Anzeige:** Personenseite mit Verlauf („Fraktionen in der Wahlperiode: …“), Fraktions- und Parteiseiten mit allen, die je dazugehörten, mit Zeitraum bei Wechsel; Parteiseite zeigt die Fraktion statt nochmals die Partei.
  - [x] Sitzzahlen je Zeitpunkt: `seats` bleibt der Stand heute; die Fraktionsaufteilung jeder Abstimmung ordnet nach den Mitgliedern am Sitzungstag und lässt Fraktionen ohne Mitglieder an dem Tag weg; Fraktions- und Parteiseiten zeigen den Sitzverlauf (`astro/src/data-analysis/Seats.ts`).
  - [x] Parteiwechsel mit Quelle: Getu Abraham seit 09.11.2024 parteilos (Leipziger Zeitung, 8.11.2024). Weitere, sobald eine Quelle vorliegt (siehe Offene Fragen: Butz).
- [ ] **Partei-Metadaten:** `EXTREMIST_CLASSIFICATION` nach Einstufung durch das LfV **Sachsen** mit Quellenangabe (Recherche läuft, 12.11.2026). „Partei“ meint die Wahlliste 2024, erklärt auf Partei- und Personenseite und in `DATA.md` (Entscheidung 12.11.2026).
- [ ] **Offene Daten ausliefern:**
  - [x] API v1 (`/api/v1/parliament-periods/leipzig-8/votings/{session}.json`), mit `reviewStatus` und `paperUrl`
  - [x] Bulk-Downloads `/data/leipzig-8/*.csv` + `datapackage.json` (12.11.2026)
  - [x] Lizenz und Herkunft in jeder Antwort: `meta.license_note` und `meta.attribution` nennen CC BY 4.0 (OParl) und dl-de/by-2-0 (Wahlliste) (12.11.2026)
- [x] **Hosting:** GitHub Pages über `deploy.yml`, Seite und Prüfoberfläche (`/review/`) in einem Artefakt; Basispfad über `SITE_BASE`, alle Links über `sitePath()`.
  - [x] Einmalig eingerichtet: private Sicherheitsmeldungen, Pages-Quelle, erster Lauf von `deploy.yml` (12.11.2026).
- [x] **Workflows:** `leipzig-members`, `leipzig-recordings`, `leipzig-votings`, `leipzig-review-recheck`, `leipzig-review-reminder`, `deploy`. Daten kommen per PR, Fehler als Issue.
- [x] README, AGENTS.md, GLOSSARY.md, API-Doku und arc42 für Leipzig (12.11.2026).
- [x] **Dokumentation:** `DATA.md` (12.11.2026).

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
- [x] **Suche:** statisch mit Pagefind, im Build erzeugt (`npm run build`), auf GitHub Pages ausgeliefert, im Browser durchsucht; Seite `/suche`. Indexiert sind die Inhaltsseiten (642), nicht die Namenslisten jeder Abstimmung und nicht die Weiterleitungen (13.11.2026). Die Reden stehen im Index wie auf der Sitzungsseite.
- [x] **Verfügbarkeit:** Das Verlaufsprotokoll erscheint etwa zwei Monate nach der Sitzung. Der ALLRIS-Runner (`minutes-runner/`, täglich auf dem Server) liest es, sobald es da ist, und `leipzig-site-data` erzeugt danach die Reden.
  - [x] ALLRIS-Runner auf einem Server des Betreibers eingerichtet (cron, `minutes-runner/install-cron.sh`), Deploy-Key mit Schreibzugriff eingetragen, Probelauf (13.11.2026).

---

## Gestaltung (DaisyUI richtig einsetzen)

Befund vom 13.11.2026: Die Oberfläche stammte aus einer Admin-Vorlage ohne Lizenzangabe (eigenes Seitenleisten-Layout statt `drawer`, fünf Themes, Styles für ApexCharts, FilePond und eine Landing-Page). Tabellen liefen über, der Inhalt scrollte in einem inneren Kasten, Stimmen waren nur an der Farbe erkennbar. DaisyUI bleibt; die Vorlage wird ersetzt, damit keine Zeile ungeklärter Herkunft im öffentlichen Repository bleibt.

- [x] **1. Aufräumen:** Vorlagendateien entfernt (`custom/*`, `daisyui.css`, `typography.css`); zwei eigene Themes (hell, dunkel bei Systemeinstellung) mit Kontrast ≥ 4,5:1, DM Sans über `@fontsource` (OFL), wenige eigene Regeln (13.11.2026).
- [x] **2. Layout:** `drawer` mit `lg:drawer-open`, `navbar` mit Seitenname unter 1024 px, `menu` mit `menu-active` und `aria-current`, Seite scrollt wieder selbst, Inhaltsbreite begrenzt, „Zum Inhalt springen“ (13.11.2026).
- [x] **3. Tabellen** (13.11.2026): Spalten nach Wichtigkeit über Container-Abfragen (`@container`, `@2xl:table-cell` …), weil die Seitenleiste die Breite bestimmt, nicht das Fenster; Name als feste erste Spalte (`table-pin-cols`, `<th scope="row">`); kompakte Zeilen unter `md`; Sortierknöpfe dürfen umbrechen, lange Überschriften mit weichem Trennstrich, Titel mit Silbentrennung, Zahlen in einer Zeile; Hinweis „Weitere Kennzahlen …“ auf schmalen Bildschirmen. Von 360 bis 1920 px läuft keine Tabelle mehr über.
- [x] **4. Bausteine** (13.11.2026): Stimmen als beschriftete `badge` (`VoteBadge`: Ja, Nein, Enth., –; Screenreader hören das ganze Wort) statt Farbpunkt mit `aria-label="status"`; Sitzungsliste nennt je Fraktion die Zahl der Ja, Nein und Enthaltungen statt Punkten mit Namen nur beim Überfahren; Erläuterungen der Kennzahlen (11 auf Fraktionen- und Parteienseite) sichtbar statt Tooltip; Legende des Personengraphen sichtbar unter der Grafik; Seitentitel als `h1` (vorher `h3`), Rechtsseiten mit derselben Skala; Kopf der Personenseite „Fraktion: … · Partei (Wahlliste 2024): …“ (vorher „Fraktionfraktionslos“). Links in Tabellen und Kopfzeilen ohne Dauerunterstreichung, im Fließtext weiter unterstrichen.
- [x] **5. Diagramme:** Farben und Schrift aus dem Theme, keine geglätteten Kurven über 100 %, waagerechte Achsenbeschriftung, Balkenbeschriftung außerhalb der Balken, Dunkelmodus.
- [x] **6. Prüfoberfläche `/review/`:** Tailwind und DaisyUI mit denselben Themes statt eigenem CSS (347 Zeilen).



Fragen, die eine Entscheidung oder eine Quelle brauchen. Gesammelt am 12.11.2026.

### Mitglieder und Parteien
- [x] **Partei von Getu Abraham:** Austritt aus SPD-Fraktion und SPD am 8. November 2024 ([Leipziger Zeitung](https://www.l-iz.de/politik/leipzig/2024/11/leipziger-stadtrat-prof-getu-abrahamn-fraktion-spd-608264)), seitdem parteilos; als Override mit `since: 2024-11-09` erfasst. Ob er inzwischen CDU-Mitglied war, ist offen („Wir werden sehen“, kreuzer 05/2025); 2027 tritt er als unabhängiger OB-Kandidat an.
- [x] **Jürgen Günter Butz** (12.11.2026 recherchiert): bleibt bei FREIE SACHSEN. Leipziger Zeitung und Kreuzer führen ihn durchgehend als „Freien Sachsen“, auch nach dem Wechsel in die AfD-Fraktion; ein Austritt wird nirgends genannt. Eine Mitgliedschaft belegt keine Quelle, nur die AfD-Fraktion nennt ihn „parteilos“. Als Override mit allen Quellen festgehalten; bei einer belastbaren Quelle neu entscheiden.
- [x] **Weitere Parteiwechsel:** keine weiteren gefunden (Tagesordnungen aller Sitzungen 18.09.2024–19.11.2026, Presse); Droese hat sein Mandat niedergelegt, bleibt AfD. Recherche `docs/research/2026-11-13-parteiwechsel-und-kiessling.md` (13.11.2026). Klaus-Peter Reinhold, 2024 parteilos auf der FDP-Liste gewählt, bleibt bei „FDP“ (Liste), weil „Partei“ die Wahlliste meint (Entscheidung 13.11.2026).
- [x] **Franziska Kießling:** gewählt (DIE LINKE), Mandat nicht angenommen, Beschluss nach § 18 SächsGemO am 18.09.2024 (VIII-DS-00026); Enrico Stange rückte nach (13.11.2026).
- [x] **Bezeichnung „Partei“:** bleibt „Partei“ und meint die Wahlliste 2024; Hinweis auf der Parteien- und Personenseite, Erklärung in `DATA.md` (Entscheidung 12.11.2026).
- [x] **Fraktionswebseiten:** werden nicht genutzt (Entscheidung 12.11.2026).
- [x] **`EXTREMIST_CLASSIFICATION`:** Quelle ist das LfV Sachsen; welche Parteien und welcher Wortlaut, klärt die Recherche `docs/research/2026-11-12-lfv-sachsen-einstufungen.md` (Entscheidung 12.11.2026).

### Was veröffentlicht wird
- [x] **Vorläufige Abstimmungen:** `provisional` erscheint mit Kennzeichnung „vorläufig“, Erklärung und Link zum Daten-PR (12.11.2026).
- [x] **Abstimmungen in Prüfung:** `needs-review` erscheint mit Kennzeichnung „in Prüfung“, Erklärung, Link zur Prüfoberfläche und zum Daten-PR; die Stimmen zählen in den Auswertungen mit (12.11.2026).
- [x] **Abstimmungen ohne Tafel** (Handzeichen, geheime Wahl): werden nicht aufgenommen (12.11.2026).
- [x] **Sitzungen ohne Video** (18.09.2024 bis Anfang Dezember 2025): werden nicht aufgenommen (12.11.2026).
- [x] **Vorlagen auf der Seite:** keine eigenen Seiten; Abstimmungen verlinken die Drucksache im Ratsinformationssystem (12.11.2026).
- [x] **Erforderliche Mehrheit:** aus dem Titel nach SächsGemO, Hauptsatzung, GO und Ehrenbürgersatzung; Regelfall Ja > Nein, Enthaltungen zählen nicht, Gleichstand abgelehnt; keine Zwei-Drittel-Regel für die Tagesordnung (Recherche 12.11.2026). Offen: Änderungsanträge zur Hauptsatzung, Vorlagen mit mehreren Beschlusspunkten.

### Reden (M5)
- [x] **Rechte am Verlaufsprotokoll** (recherchiert 12.11.2026, keine Rechtsberatung):
  - **Reden:** [§ 48 Abs. 1 Nr. 2 UrhG](https://www.gesetze-im-internet.de/urhg/__48.html) erlaubt Vervielfältigung, Verbreitung und öffentliche Wiedergabe von Reden, die bei öffentlichen Verhandlungen vor kommunalen Organen gehalten wurden. Das deckt die Redebeiträge der öffentlichen Ratsversammlung.
  - **Grenze:** § 48 Abs. 2 verbietet Sammlungen, die überwiegend Reden desselben Urhebers enthalten. Die upstream-Personenseite zeigt alle Reden einer Person im Volltext, das wäre so eine Sammlung. Für Leipzig: Volltexte nur auf der Sitzungsseite (Reden aller Sprecher), auf der Personenseite nur Liste mit Datum, TOP, Redezeit und Link zur Sitzung.
  - **Protokoll als Dokument:** Als amtliches Werk nach [§ 5 Abs. 2 UrhG](https://www.gesetze-im-internet.de/urhg/__5.html) gemeinfrei wäre es nur, wenn es im amtlichen Interesse zur allgemeinen Kenntnisnahme veröffentlicht ist; der Begriff wird eng ausgelegt, eine Entscheidung zu Ratsprotokollen gibt es nicht. Dann gelten Änderungsverbot und Quellenangabe (§§ 62, 63). Die redaktionelle Bearbeitung durch die Stadt erreicht kaum Schöpfungshöhe. Daraus folgt: Quelle je Rede angeben, Text nicht inhaltlich ändern (nur Silbentrennung und Seitenköpfe entfernen).
  - **Leipzig selbst:** Das [Impressum des Ratsinformationssystems](https://ratsinformation.leipzig.de/allris_leipzig_impressum/) nennt keine Nutzungsbedingungen. Die OParl-Lizenz CC BY 4.0 steht am System-Objekt; das Verlaufsprotokoll ist dort aber nicht als Datei verlinkt (nur Beschlussprotokoll und „Alle Anlagen öffentlich“).
- [x] **Whisper lokal:** `whisper-cpp` per Homebrew, Modell `ggml-large-v3-turbo.bin` (1,6 GB, SHA-256 `1fc70f77…e2bc69`) in `output/whisper/`. Test 12.11.2026 an 10 Minuten von 2026-09-03: 78,5 s Rechenzeit (7,6-fach schneller als Echtzeit); 96 % Wortübereinstimmung mit den Untertiteln des Hosters, 74 % mit dem redigierten Verlaufsprotokoll (Hoster: 73 %).

### Video und Belege
- [x] **Nach Ablauf der Mediathek:** Verschwindet eine Aufzeichnung, entfällt der Video-Link (laut GO § 11 Abs. 8 erst mit Ende der Wahlperiode, beobachtet wird `last_seen`); die Abstimmungsseite zeigt weiter das Zitatbild.
- [x] **Rechte an den Belegbildern** (recherchiert 12.11.2026, keine Rechtsberatung): `docs/research/2026-11-12-rechte-belegbilder.md`. Die Tafel selbst ist eine Bildschirmgrafik ohne Werk- oder Lichtbildschutz; Hindernis ist das Recht des Laufbildherstellers (§§ 94, 95 UrhG), das schon kleinste Teile schützt. Tragfähig ist nur das Zitat (§ 51): je Abstimmung ein verkleinerter Ausschnitt nur der Tafel, ohne Personen, an der Abstimmung, die er belegt, mit Quelle „Stadt Leipzig, Aufzeichnung vom …“, ohne eigene Lizenz, Löschung auf Verlangen. Kein Bildarchiv.
  - [x] Entschieden: als Zitat veröffentlichen (12.11.2026). Je veröffentlichter Abstimmung `<abstimmung>-zitat.png` (960 px breit, 16 Farbstufen je Kanal, ca. 135 KB, sonst unverändert), auf der Abstimmungsseite mit „Zitiert von StadtratWatch Leipzig (Kontakt)“ und Quelle Stadt Leipzig; Release-Text `.github/evidence-release-notes.md` nennt zuerst das Projekt, nimmt die Bilder von CC0 aus und bietet Entfernung an.
  - [x] Zitatbilder für die 16 Sitzungen erzeugt: 527 Bilder in 16 Releases, auf der Seite (12.11.2026).
  - [x] Bilder gehören nicht zum Datenpaket; `DATA.md` nimmt sie ausdrücklich von CC0 aus (12.11.2026).
  - [x] Tafelbilder der Prüffälle bleiben in voller Auflösung öffentlich, weil die Prüfung sie braucht (Entscheidung 12.11.2026). Für die 17 offenen Fälle fehlen sie noch (der Lauf vom 12.11.2026 erzeugte nur Zitatbilder).

### Lizenz, Betrieb, Recht
- [x] **Lizenz der eigenen Daten:** CC0 1.0 für alles, was StadtratWatch Leipzig selbst erhebt (Stimmen, Ergebnisse, Prüfstatus, Zuordnungen) (Entscheidung 12.11.2026). Namensnennung für OParl (CC BY 4.0) und Bewerberliste (dl-de/by-2-0) bleibt, Reden und Belegbilder sind ausgenommen.
- [x] **Betreiber und Impressum:** Marcel Schneuer, Angaben wie schneuer.online; Impressum, Datenschutz (GitHub Pages, keine Cookies) und Kontakt umgestellt (12.11.2026).
- [x] **Magdeburg-Daten:** nur Leipzig, Magdeburg entfernt, Hinweis auf upstream bleibt (12.11.2026).
- [x] **Name der Wahlperiode:** „Wahlperiode VIII“ (Entscheidung 12.11.2026).
- [x] **Hosting und Adresse:** GitHub Pages ohne eigene Domain; CloudFront- und Typesense-Variablen entfallen (12.11.2026).
- [x] **Prüfende:** vorerst nur Marcel Schneuer (`LEIPZIG_REVIEWERS=ungeschneuer`, 12.11.2026).

### Arbeitsweise im Repository
- [x] **Branches und Pull Requests:** Code getrennt per PR nach `main` (`leipzig/code`), Daten über `data/leipzig-votings` (12.11.2026). Die Bereinigung der Prüfvermerke betrifft Daten, die nie veröffentlicht waren, und bleibt deshalb im Daten-PR.
- [x] **Architekturdoku:** arc42 für Leipzig neu geschrieben, ADR-0008 und ADR-0009 (12.11.2026).

---

## Prüfung: nicht zuordenbare Stimmen (14.11.2026)

Anlass: Durchsicht der 18 Prüfentscheidungen vom 13.11.2026. „Nicht klärbar“ galt nur für ganze Abstimmungen, obwohl
meist eine einzelne nachgezählte Stimme keinen Namen hat; widersprüchliche Protokolle wurden unterschiedlich entschieden.

- [x] **1. Teilweise zuordnen:** „Nicht klärbar“ lässt sich mit „Stimmen ändern“ kombinieren. Die Pipeline errechnet die
  nicht zugeordneten Stimmen (amtlich minus Tafel mit Änderungen) und veröffentlicht sie mit `unresolved`.
- [x] **2. Mögliche Betroffene:** Wer bei einer solchen Abstimmung anwesend war, aber ohne Stimme auf der Tafel steht, wird
  als „unklar“ statt „keine Stimme“ gezeigt; die Abstimmung zählt nicht gegen die Teilnahmequote dieser Personen.
- [x] **3. Prüfoberfläche:** Feld „Rest nicht zuzuordnen“ zusammen mit Stimmänderungen, Vorschau der verbleibenden Stimmen.
- [x] **4. Abstimmungsseite, API, Doku:** Hinweis nennt die nicht zugeordneten Stimmen und die möglichen Betroffenen;
  API-Felder und README beschreiben sie.
- [x] **5. Feste Regel für widersprüchliche Protokolle:** Stimmen Verlaufsprotokoll und (falls vorhanden) Ansage mit der
  Tafel überein und weicht nur Niederschrift oder ALLRIS ab, gilt die Tafel als bestätigt.
- [ ] **6. Prüfentscheidungen neu fassen (eigener Daten-PR):** 30.09.2026 #18 Lehmann → Nein, Rest 1 Ja nicht zuzuordnen;
  28.10.2026 #10 und #18 Tafel bestätigen wie 03.09.2026 #4.

## Reihenfolge (Vorschlag)

1. M0 (Fork, Grundgerüst)
2. M2, nur Manifest und VTT sichern für die 16 vorhandenen Sitzungstage. Das hat Vorrang, weil das Archiv rollierend gelöscht wird.
3. M1 (Mitglieder, Parteien, Sitzplan)
4. M3 (Prototyp an einer Sitzung, dann Backfill aller Sitzungen mit Video)
5. M4 (Frontend, Deployment, Automatisierung)
