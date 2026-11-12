# Rechte an Belegbildern aus den Aufzeichnungen der Ratsversammlung Leipzig

Datum: 2026-11-12
Bezug: `TODO.md`, Abschnitt „Video und Belege“, Punkt „Rechte an den Belegbildern“
Frage: Darf StadtratWatch Leipzig (ehrenamtlich, nicht kommerziell, ohne Kontakt zur Stadt) Standbilder der
elektronischen Abstimmungstafel aus den Aufzeichnungen der Stadt Leipzig öffentlich als GitHub-Release-Assets
bereitstellen und auf der Website verlinken? Die Bilder sollen die aus dem Video gelesenen Einzelstimmen belegen, auch
nachdem die Aufzeichnung aus der Mediathek verschwunden ist.

> **Keine Rechtsberatung.** Das ist eine Recherche von Laien anhand von Primärquellen und veröffentlichter
> Rechtsprechung. Wo eine Aussage nur eine Einschätzung ist, steht **(Einschätzung)** dabei. Vor einer Veröffentlichung
> mit Restrisiko kann eine kostenlose Erstberatung helfen, etwa bei einer Rechtsberatungsstelle für gemeinnützige
> Projekte.

## Fazit

**Veröffentlichen ja, aber nur eingeschränkt, als Zitat und nicht als freies Bildarchiv.** Ein rechtlich sauberes „Ja“
gibt es nicht, weil die Stadt Leipzig die Weiterverwendung nirgends erlaubt (keine Nutzungsbedingungen, keine Lizenz).
Das Risiko ist aber gering bis mäßig und lässt sich mit den folgenden Bedingungen deutlich senken **(Einschätzung)**:

1. **Nur die Tafel, keine Personen.** Nur Bilder, auf denen ausschließlich die Bildschirmgrafik der Abstimmungsanlage zu
   sehen ist. Überblendungen und Bilder mit Saal oder Personen fallen weg (oder werden auf die Tafel zugeschnitten).
2. **Zitat mit Belegfunktion (§ 51 UrhG).** Jedes Bild hängt an der eigenen Aussage, die es belegt: Die Seite oder der
   API-Eintrag einer Abstimmung zeigt bzw. verlinkt genau das Bild dieser Abstimmung neben den gelesenen Stimmen. Keine
   Galerie, kein Sammel-Download als Selbstzweck, nur ein Bild je Abstimmung (Endstand).
3. **Quellenangabe je Bild (§ 63 UrhG):** z. B. „Standbild: Stadt Leipzig, Aufzeichnung der Ratsversammlung vom
   29.10.2026, 01:23:45“ mit Link auf die Mediathek-Seite, solange sie besteht. Im Release-Text dasselbe.
4. **Keine eigene Lizenz.** Kein CC0 und keine andere freie Lizenz für die Bilder; im `datapackage.json`, in der API und
   im Release ausdrücklich von der CC0-Lizenz der Daten ausnehmen (wie bei den Redetexten).
5. **Nicht ändern außer Ausschnitt und Verkleinerung (§ 62 UrhG).** Zuschneiden auf Tabelle und Ergebnis, Verkleinern und
   Palettenreduktion sind unproblematisch; keine Markierungen ins Bild malen (Hervorhebungen gehören neben das Bild).
6. **Löschung auf Verlangen.** Im Impressum und im Release-Text einen Kontakt nennen und zusagen, Bilder auf Hinweis der
   Stadt oder betroffener Personen zu entfernen. Bei einem Hinweis sofort löschen und nicht streiten.
7. **Nicht kommerziell, keine Werbung**, und keine Einbindung des städtischen Players auf der eigenen Seite (nur Links).

**Risikoärmere Alternative**, falls das Restrisiko zu hoch erscheint: Die Rohbilder nicht öffentlich ablegen, sondern in
einem privaten GitHub-Repository (Releases dort sind nur für Mitglieder sichtbar) für die Prüfenden aufbewahren und
öffentlich nur die SHA-256-Prüfsummen der Bilder plus die eigenen Daten zeigen. Dann ist die Prüfung durch das Team
möglich, die Öffentlichkeit kann aber nicht selbst nachsehen.

## Was die Bilder zeigen

Ein Belegbild aus `output/leipzig-votings/evidence/2026-09-30/2026-09-30-000-board.png` (1920 × 1080) zeigt die
Bildschirmausgabe der Abstimmungssoftware, nicht eine Kamera-Aufnahme: Tagesordnungspunkt, vier Spalten mit Fraktion,
Sitznummer und Name, Farben je Stimme, „Anwesende“ und „Abgegebene Stimmen“, unten die Bedienknöpfe der Software
(„Start“, „Stopp“, „Löschen“, „Setup…“) und der Mauszeiger. Die Stadt blendet diese Grafik vollflächig in den Stream ein
(siehe `src/scripts/leipzig-votings/README.md`, „the voting board that the city shows full-screen in its recording“).
Daraus folgt: Auf den Endstand-Bildern sind normalerweise keine Personen zu sehen, nur Namen.

## 1. Urheberrecht

### 1.1 Die Tafel selbst: kein Werk (§ 2 UrhG)

- [§ 2 Abs. 2 UrhG](https://www.gesetze-im-internet.de/urhg/__2.html) schützt nur „persönliche geistige Schöpfungen“.
- Eine Bedienoberfläche kann zwar urheberrechtlich geschützt sein, aber nicht, soweit ihre Gestaltung durch die
  technische Funktion vorgegeben ist ([EuGH, 22.12.2010, C-393/09, BSA](https://curia.europa.eu/juris/liste.jsf?num=C-393/09)).
- Die Tafel ist eine Tabelle aus Namen, Sitznummern und Ampelfarben in Standardschrift. Das ist reine Datenanzeige ohne
  Gestaltungsspielraum, der eine eigene geistige Schöpfung erkennen ließe **(Einschätzung)**. Ein Recht des Herstellers
  der Abstimmungsanlage an der Bildschirmgestaltung ist deshalb sehr unwahrscheinlich.
- Die Daten selbst (wer wie abgestimmt hat) sind nicht geschützt. Eine Datenbank im Sinne von §§ 4, 87a UrhG liegt nicht
  vor: Ein einzelnes Bild ist keine Sammlung unabhängiger Elemente mit wesentlicher Investition in deren Beschaffung
  **(Einschätzung)**.

### 1.2 Lichtbildschutz für Einzelbilder (§ 72 UrhG): hier eher nicht

- Einzelbilder eines Films sind grundsätzlich als Lichtbilder nach
  [§ 72 UrhG](https://www.gesetze-im-internet.de/urhg/__72.html) geschützt, unabhängig vom Schutz des Films
  ([BGH, 06.02.2014, I ZR 86/12, Peter Fechter](https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Datum=06.02.2014&Aktenzeichen=I+ZR+86%2F12),
  Leitsatz 1). Gilt für Bilder von Kameras im Saal.
- Lichtbildschutz setzt ein „Mindestmaß an … persönlicher geistiger Leistung“ voraus; die bloße Reproduktion eines
  vorhandenen Bildes reicht nicht
  ([BGH, 20.12.2018, I ZR 104/17, Museumsfotos](https://www.jurpc.de/dokument/20190026), mit Verweis auf die frühere
  Entscheidung „Bibel-Reproduktion“, BGH GRUR 1990, 669).
- Am Computer erzeugte Bilder sind nach herrschender Meinung kein Erzeugnis, das „ähnlich wie Lichtbilder hergestellt“
  wird; maßgeblich ist das Herstellungsverfahren
  ([KG Berlin, 16.01.2020, 2 U 12/16 Kart](https://www.online-und-recht.de/urteile/abbildung-eines-virtuellen-gegenstandes-kein-lichtbild-kammergericht-berlin-20200116/)).
- Die Tafel ist eine direkt eingespeiste Bildschirmgrafik, kein Kamerabild. Ein Bildschirmabgriff ist kein Lichtbild,
  und selbst wenn man das anders sähe, fehlte die persönliche Leistung (keine Wahl von Ausschnitt, Licht, Standort)
  **(Einschätzung; ein Urteil speziell zu Bildschirmaufnahmen wurde nicht gefunden)**. Für Bilder mit Kameraaufnahmen
  des Saals gilt das nicht, ein weiterer Grund, sie wegzulassen.

### 1.3 Laufbilder und Filmhersteller (§§ 94, 95 UrhG): das eigentliche Hindernis

- Die Aufzeichnung ist mindestens eine Bild- und Tonfolge; deren Hersteller hat die Rechte des Filmherstellers aus
  [§ 94 UrhG](https://www.gesetze-im-internet.de/urhg/__94.html) über
  [§ 95 UrhG](https://www.gesetze-im-internet.de/urhg/__95.html): Vervielfältigen und öffentlich Zugänglichmachen des
  Bildträgers sind ihm vorbehalten.
- Geschützt sind auch Teile, „unabhängig von der Größe oder der Länge des Filmausschnitts“
  ([BGH, 20.12.2007, I ZR 42/05, TV-Total, Rn. 22](https://www.bundesgerichtshof.de/SharedDocs/Entscheidungen/DE/Zivilsenate/I_ZS/2005/I_ZR__42-05.pdf?__blob=publicationFile&v=1)).
  Ein einzelnes Standbild ist danach ein geschützter Teil **(Einschätzung; dass auch ein Einzelbild erfasst ist, sagt
  das Urteil nicht ausdrücklich, folgt aber aus „unabhängig von der Größe“)**.
- Herstellerin ist vermutlich die Stadt Leipzig (Referat Kommunikation) oder ein beauftragter Dienstleister. Die
  Datenschutzerklärung der Stadt spricht von „unsere[n] über VSH übertragenen Inhalte[n]“
  ([leipzig.de/datenschutz](https://www.leipzig.de/datenschutz), Abschnitt „Videostreaming und Datenverkehr über
  Video-Stream-Hosting.de“). Wer filmt und schneidet, ist nicht öffentlich bekannt **(offen)**.
- Ergebnis: Ohne Erlaubnis oder Schranke ist das öffentliche Bereitstellen eines Standbilds ein Eingriff in das
  Laufbildherstellerrecht. Die Schranken (§§ 50, 51) gelten aber entsprechend, § 94 Abs. 4 verweist auf Abschnitt 6
  von Teil 1 (so auch TV-Total, Leitsatz zu §§ 50, 51).

### 1.4 Sendeunternehmen (§ 87 UrhG): Nebenaspekt

- [§ 87 Abs. 1 Nr. 2 UrhG](https://www.gesetze-im-internet.de/urhg/__87.html) behält dem Sendeunternehmen ausdrücklich
  vor, „Lichtbilder von seiner Funksendung herzustellen“ und zu vervielfältigen.
- Die Belegbilder stammen aber aus der abrufbaren Aufzeichnung (HLS-Datei), nicht aus dem Live-Stream. Ob ein
  kommunaler Live-Stream überhaupt eine Funksendung eines Sendeunternehmens ist, ist ungeklärt. Neben §§ 94, 95 bringt
  § 87 praktisch kein zusätzliches Risiko **(Einschätzung)**.

### 1.5 Amtliches Werk (§ 5 UrhG): eher nicht

- [§ 5 Abs. 1 UrhG](https://www.gesetze-im-internet.de/urhg/__5.html) erfasst Gesetze, Verordnungen, Erlasse,
  Bekanntmachungen und Entscheidungen; eine Videoaufzeichnung ist nichts davon.
- § 5 Abs. 2 erfasst „andere amtliche Werke, die im amtlichen Interesse zur allgemeinen Kenntnisnahme veröffentlicht“
  wurden. Der BGH legt das eng aus: Es muss ein besonderes Interesse gerade daran bestehen, die Verwertung für jedermann
  freizugeben; ein allgemeines Informationsinteresse reicht nicht
  ([BGH, 20.07.2006, I ZR 185/03, Bodenrichtwertsammlung](https://lexetius.com/2006,3016)).
- Gegen eine Freigabe spricht hier: Die Stadt darf nach
  [§ 37 Abs. 3 SächsGemO](https://www.revosax.sachsen.de/vorschrift/2754-Saechsische-Gemeindeordnung) nur mit
  Einwilligung aufzeichnen und zum Abruf anbieten, Ratsmitglieder können widersprechen, und die Aufzeichnung wird nach
  einer gewissen Zeit gelöscht. Das ist eine begrenzte, kontrollierte Bereitstellung, keine Freigabe zur beliebigen
  Weiterverwendung **(Einschätzung)**.
- Hinzu kommt: § 72 verweist auf Teil 1 (also auch auf § 5), § 94 Abs. 4 dagegen nicht. Ob § 5 auf Laufbilder überhaupt
  anwendbar ist, ist offen **(Einschätzung)**.
- Auf § 5 sollte man sich deshalb nicht verlassen. Es bleibt ein Argument im Streitfall.

### 1.6 Zitat (§ 51 UrhG): die tragende Schranke

- [§ 51 UrhG](https://www.gesetze-im-internet.de/urhg/__51.html) erlaubt Vervielfältigung und öffentliche Wiedergabe
  eines veröffentlichten Werks „zum Zweck des Zitats, sofern die Nutzung in ihrem Umfang durch den besonderen Zweck
  gerechtfertigt ist“; Satz 3 erstreckt das auf Abbildungen, die selbst durch ein Leistungsschutzrecht geschützt sind.
  Über § 94 Abs. 4 gilt es für Laufbilder entsprechend.
- Der EuGH verlangt, dass das Zitat in einer Beziehung zu den eigenen Ausführungen steht, etwa um eine Aussage zu
  erläutern oder zu belegen, und dass das zitierte Werk rechtmäßig öffentlich zugänglich gemacht wurde
  ([EuGH, 29.07.2019, C-516/17, Spiegel Online](https://curia.europa.eu/juris/liste.jsf?num=C-516/17)).
- Die Belegfunktion ist hier der klassische Fall: Die eigene Aussage „Person X hat bei Abstimmung Y mit Nein
  gestimmt“ wird durch das Bild belegt. Die Mediathek ist eine rechtmäßige Veröffentlichung durch die Stadt.
- Schwachstellen **(Einschätzung)**:
  - Ein Release mit allen Bildern einer Sitzung ohne eigenen Text ist kein Zitat, sondern eine Bildsammlung. Tragfähig
    wird es nur, wenn jedes Bild an der Abstimmung hängt, die es belegt (Seite bzw. API verlinkt das konkrete Bild), und
    der Release-Text das so beschreibt.
  - Umfang: ein Bild (Endstand) je Abstimmung, verkleinert, möglichst nur der Tafelausschnitt. Mehrere Bilder je
    Abstimmung nur, wo die Prüfung sie braucht.
  - Ob das zitierende Angebot selbst ein urheberrechtlich geschütztes Werk sein muss, ist umstritten. Eine Datenseite mit
    eigener Auswertung und Prüfprotokoll spricht eher für eine eigenständige Leistung, sicher ist das nicht.
- Quellenangabe ist Pflicht ([§ 63 UrhG](https://www.gesetze-im-internet.de/urhg/__63.html)). Nach
  [§ 62 Abs. 2 UrhG](https://www.gesetze-im-internet.de/urhg/__62.html) sind Auszüge zulässig, soweit der Zweck es
  erfordert; Größenänderungen erlaubt Abs. 3 ausdrücklich nur für Lichtbildwerke und Werke der bildenden Künste. Für das
  Verkleinern eines Laufbild-Standbilds sollte das entsprechend gelten **(Einschätzung)**.

### 1.7 Weitere Schranken: tragen nicht

- **§ 50 (Tagesereignisse)**, [Normtext](https://www.gesetze-im-internet.de/urhg/__50.html): erlaubt die Wiedergabe von
  Werken, die bei der Berichterstattung über ein Tagesereignis wahrnehmbar werden. Ein dauerhaftes Belegarchiv ist keine
  aktuelle Berichterstattung **(Einschätzung)**.
- **§ 48 (öffentliche Reden)** deckt die Redetexte (siehe TODO.md, M5), aber keine Bilder.
- **§ 44b (Text und Data Mining)**, [Normtext](https://www.gesetze-im-internet.de/urhg/__44b.html): deckt das Auslesen
  der Stimmen aus dem Video. Die Kopien „sind zu löschen, wenn sie für das Text und Data Mining nicht mehr erforderlich
  sind“; das dauerhafte Veröffentlichen der Belegbilder deckt § 44b also nicht. § 60d (wissenschaftliche Forschung)
  passt für ein Civic-Tech-Projekt nicht sicher und erlaubt ebenfalls keine Veröffentlichung.
- **§ 24 a. F. / § 51a (Pastiche)**: kein Thema, die Bilder werden unverändert übernommen.

## 2. Nutzungsbedingungen von Stadt und Hoster

- **Mediathek-Seite** (z. B.
  [Aufzeichnung vom 29.10.2026](https://www.leipzig.de/mediathek/video/aufzeichnung-der-ratsversammlung-vom-29-oktober-2026)):
  nur Titel, Datum, Länge und „Die Untertitel in diesem Video sind automatisiert mit KI generiert.“ Kein Hinweis auf
  Nutzungsrechte oder Lizenz; in der Fußzeile „© 2026 Stadt Leipzig“.
- **[Impressum leipzig.de](https://www.leipzig.de/impressum):** keine Aussage zu Urheberrecht oder Weiterverwendung. Es
  gibt nur „Regeln für Links“: Links müssen „zu einem vollständig neuen Laden der Seite“ führen, „Der Inhalt verlinkter
  Seiten darf nicht als Teil anderer Seiten eingebunden werden.“ Daraus folgt für uns: auf die Mediathek verlinken, den
  Player nicht einbetten. Eine Erlaubnis für Standbilder ergibt sich daraus nicht.
- **Geschäftsordnung der Ratsversammlung**
  ([Satzung 1-04, Beschluss vom 15.12.2022, zuletzt geändert 21.04.2024](https://www.leipzig.de/service-portal/satzungen/details/satzung/1-04/download)),
  § 11:
  - Abs. 8 Satz 1: Die Sitzungen „werden in der Regel in Bild und Ton live im Internet nach den gültigen gesetzlichen
    Bestimmungen übertragen (Live-Stream) und sind in einem Archiv rechtskonform bis zum Ende der Wahlperiode öffentlich
    verfügbar.“
  - Abs. 8 Satz 2 und 3: Teilnehmende können der Übertragung ihrer Redebeiträge widersprechen; dann wird Bild und Ton
    abgeschaltet.
  - Abs. 9 und 10: Mitschnitte im Saal nur für Medien nach Anmeldung bzw. mit Genehmigung des Oberbürgermeisters. Das
    regelt das Aufnehmen in der Sitzung (Hausrecht), nicht die Nutzung der städtischen Aufzeichnung.
  - Bemerkenswert: Nach Abs. 8 sollen die Aufzeichnungen **bis zum Ende der Wahlperiode** (2029) abrufbar sein. Die
    Annahme „Löschung nach etwa 12 Monaten“ in `TODO.md` sollte geprüft werden (siehe „Offen“).
- **Video-Stream-Hosting** (Sören und Linda Steinmann GbR, Herford;
  [Impressum](https://www.video-stream-hosting.com/impressum/)): Die
  [AGB (Stand August 2023)](https://www.video-stream-hosting.com/agb/) regeln nur das Verhältnis zum Kunden: „Alle
  Rechte … (z.B. die Urheber-, Nutzungs- und Senderechte) der zu übertragenen Videoinhalte (Bild und Ton) liegen in der
  Verantwortung des Kunden.“ Der Hoster beansprucht keine Rechte an den Inhalten. Rechteinhaberin gegenüber uns ist also
  die Stadt (bzw. wer für sie produziert).
- **Ergebnis:** Es gibt keine Erlaubnis, aber auch kein ausdrückliches Verbot. Maßgeblich sind allein die gesetzlichen
  Schranken.

## 3. Persönlichkeitsrecht und Datenschutz

### 3.1 Recht am eigenen Bild (KUG)

- [§ 22 KUG](https://www.gesetze-im-internet.de/kunsturhg/__22.html): Bildnisse nur mit Einwilligung.
  [§ 23 Abs. 1 KUG](https://www.gesetze-im-internet.de/kunsturhg/__23.html): ohne Einwilligung u. a. Bildnisse aus dem
  Bereich der Zeitgeschichte (Nr. 1), Personen als Beiwerk (Nr. 2), Bilder von Versammlungen (Nr. 3), jeweils nur, wenn
  kein berechtigtes Interesse der abgebildeten Person verletzt wird (Abs. 2).
- Die Endstand-Bilder der Tafel enthalten **kein Bildnis**, nur Namen. Das KUG greift dann nicht.
- Sollte doch ein Saalbild dabei sein: Ratsmitglieder in öffentlicher Sitzung fallen unter Nr. 1. Publikum auf der
  Empore und Beschäftigte der Verwaltung sind keine Personen der Zeitgeschichte; für sie bliebe nur „Beiwerk“. Die
  Sächsische Datenschutzbeauftragte hält schon das Erfassen von Beschäftigten im Stream für „problematisch“ und die
  Aufnahme von Personen, die nicht am Plenum teilnehmen, solle „sehr restriktiv erfolgen“
  ([datenschutz.sachsen.de](https://www.datenschutz.sachsen.de/datenschutz-in-der-gemeinderats-stadtrats-und-kreistagsarbeit-7882.html)).
  Deshalb: keine Bilder mit Personen.

### 3.2 DSGVO

- Die Tafel zeigt personenbezogene Daten (Name, Sitz, Stimme). Das sind genau die Daten, die das Projekt ohnehin
  veröffentlicht; das Bild fügt außer dem Beleg nichts hinzu. Rechtsgrundlage wäre wie für die Daten selbst Art. 6
  Abs. 1 lit. f DSGVO (berechtigtes Interesse an Transparenz des Abstimmungsverhaltens von Mandatsträgern in
  öffentlicher Sitzung) **(Einschätzung)**.
- Stützend: Die Sitzungen sind öffentlich ([§ 37 Abs. 1 SächsGemO](https://www.revosax.sachsen.de/vorschrift/2754-Saechsische-Gemeindeordnung));
  bei namentlicher Abstimmung wird das Ergebnis „mit den Namen der Stadträtinnen und Stadträte in die
  Sitzungsniederschrift aufgenommen“ (GO § 21 Abs. 5).
- Das Medienprivileg hilft wenig: [§ 11a SächsPresseG](https://www.revosax.sachsen.de/vorschrift/4197-SaechsPresseG)
  gilt für „Unternehmen und Hilfsunternehmen der Presse“, für Telemedien gilt die entsprechende Regel im
  Medienstaatsvertrag. Ob ein Datenprojekt „journalistische Zwecke“ verfolgt, ist offen; darauf sollte man nicht bauen
  **(Einschätzung)**.
- Widerspruch nach Art. 21 DSGVO: Wer widerspricht, bekommt sein Bild entfernt bzw. geschwärzt; das deckt die
  Bedingung „Löschung auf Verlangen“ ab.

### 3.3 Einwilligung nach § 37 Abs. 3 SächsGemO

- § 37 Abs. 3 Satz 3 SächsGemO: „Eine Aufzeichnung von Bild und Ton sowie eine entsprechende Abrufmöglichkeit sind nur
  zulässig, wenn diese von der Einwilligung ausdrücklich umfasst sind.“ Die Norm richtet sich an die Gemeinde, nicht an
  Dritte (so die [Sächsische Datenschutzbeauftragte](https://www.datenschutz.sachsen.de/datenschutz-in-der-gemeinderats-stadtrats-und-kreistagsarbeit-7882.html)).
- Die Einwilligungen der Ratsmitglieder decken die Bereitstellung durch die Stadt, nicht unsere Weiterverbreitung. Für
  die reine Tafel (Namen, kein „Bild und Ton“ der Person) spielt das keine Rolle; für Saalbilder wäre es ein weiteres
  Argument gegen die Veröffentlichung **(Einschätzung)**.

## 4. Praxis vergleichbarer Projekte

- **StadtratWatch Magdeburg (upstream):** veröffentlicht **keine** Original-Screenshots. Die Roh-Screenshots liegen als
  „Zwischenartefakte“ im S3-Bucket „stadtrat-watch“; öffentlich über CloudFront (`web-assets/`) liegen nur selbst
  erzeugte Abstimmungsgrafiken (`generate-image-assets`, 1200 × 630, „subject, motion, result and the votes per
  faction“). Quelle: `docs/guides/session-processing/session-processing-pipeline.md` und
  `src/scripts/generate-image-assets/README.md` auf `main`. Ob der Bucket öffentlich lesbar ist, lässt sich aus dem Repo
  nicht feststellen. Die API-Daten stehen unter CC0 (README auf `main`, „Daten-Lizenz“). Ein Hinweis zu Rechten an den
  Videobildern fehlt.
- **Deutscher Bundestag** als Vergleich für eine Stelle, die die Weiterverwendung ausdrücklich regelt: Die
  [Nutzungsbedingungen für das Audio- und Videomaterial](https://www.bundestag.de/nutzungsbedingungen)
  ([PDF, 25.03.2021](https://www.bundestag.de/static/appdata/mediathek/Nutzungsbedingungen_de.pdf)) erlauben die
  kostenlose Nutzung u. a. für parlamentarische Berichterstattung, auch von kurzen Sequenzen und Standbildern, mit
  Quellenangabe „Deutscher Bundestag“, ohne kommerzielle oder werbliche Nutzung und ohne inhaltliche Veränderung. Diese
  Bedingungen sind ein guter Maßstab dafür, was eine Parlamentsverwaltung für angemessen hält; die Empfehlung oben
  orientiert sich daran **(Einschätzung)**. Für Leipzig gelten sie nicht.
- **FragDenStaat:** hat sich gegen Unterlassungsansprüche einer Behörde aus Urheberrecht („Zensurheberrecht“) bis zum
  BGH durchgesetzt ([FragDenStaat, 03/2022](https://fragdenstaat.de/artikel/klagen/2022/03/zensurheberrecht-geklart-sieg-fur-die-informationsfreiheit/);
  [LTO zu BGH I ZR 84/21](https://www.lto.de/recht/nachrichten/n/bgh-Izr8421-glyphosat-revision-gutachten-fragdenstaat-nichtzulassungsbeschwerde-abgewiesen-zensurheberrecht)).
  Der Fall betraf ein Gutachten, das an über 43.000 Personen herausgegeben worden war, und ist auf Videobilder nicht
  übertragbar. Er zeigt aber, dass Behörden Urheberrecht gegen Transparenzprojekte einsetzen können und dass Gerichte
  das nicht ohne Weiteres mittragen.
- **abgeordnetenwatch.de:** nicht geprüft.

## 5. Restrisiken

- **Laufbildrecht ohne Erlaubnis.** Hält ein Gericht § 51 nicht für erfüllt (z. B. weil die Releases als Bildarchiv ohne
  eigenen Text gesehen werden), ist jedes Bild ein Eingriff in §§ 94, 95. Folge wäre im schlimmsten Fall eine Abmahnung
  mit Unterlassungserklärung und Kosten. Bei einer Kommune, einem nicht kommerziellen Projekt und Bildern ohne
  wirtschaftlichen Wert ist das unwahrscheinlich, aber nicht ausgeschlossen **(Einschätzung)**.
- **GitHub-Löschung.** Die Stadt kann über die
  [DMCA-Richtlinie von GitHub](https://docs.github.com/en/site-policy/content-removal-policies/dmca-takedown-policy)
  die Entfernung verlangen; GitHub sperrt dann ggf. das ganze Repository, bis reagiert wird. Gegenmittel: Belegbilder
  in einem eigenen, kleinen Repository statt im Haupt-Repository ablegen.
- **Verhältnis zur Stadt.** Das Projekt sucht bewusst keinen Kontakt. Ein Konflikt über Bilder könnte die spätere
  Zusammenarbeit (z. B. Daten, Hinweise auf Fehler) belasten.
- **Bilder mit Personen.** Ein übersehenes Saalbild mit Publikum oder Beschäftigten wäre der heikelste Fall
  (Persönlichkeitsrecht, DSGVO). Gegenmittel: automatisch prüfen, dass das Bild „mostly white“ ist und die Tabelle
  enthält, sonst nicht veröffentlichen.
- **Rechtslage nicht entschieden.** Es gibt keine Rechtsprechung zu Standbildern aus kommunalen Ratsaufzeichnungen,
  zu Bildschirmgrafiken als Lichtbild oder zu § 51 bei Datenprojekten.

## 6. Offen

- **Wie lange bleibt die Aufzeichnung online?** GO § 11 Abs. 8 sagt „bis zum Ende der Wahlperiode“. Die ältesten
  bekannten Aufzeichnungen stammen von Dezember 2025; vielleicht wird erst seitdem aufgezeichnet, und es wird gar nicht
  nach 12 Monaten gelöscht. Beobachten: Verschwindet die Aufzeichnung vom 17./18.12.2025 im Dezember 2026, stimmt die
  12-Monats-Annahme. Wenn nicht, sinkt der Bedarf, Belege selbst dauerhaft zu veröffentlichen, bis 2029.
- **Wer ist Laufbildherstellerin?** Stadt Leipzig selbst oder ein Dienstleister (Kamera, Regie). Ohne Kontakt zur Stadt
  nicht zu klären; für das Risiko macht es wenig Unterschied.
- **Hersteller der Abstimmungsanlage** und ob deren Bedienoberfläche geschützt sein soll: nicht ermittelt; Risiko gering
  (siehe 1.1).
- **Kommen Personen je in Endstand-Bildern vor?** An einem Bild geprüft (2026-09-30, Abstimmung 000): nein. Für alle
  Sitzungen automatisch prüfen.
- **Leipziger Ortsrecht:** Außer der Geschäftsordnung wurde keine Satzung mit Regeln zu Aufzeichnung oder
  Weiterverwendung gefunden; die Hauptsatzung wurde nicht durchgesehen.
- **Medienprivileg für Civic Tech** (Art. 85 DSGVO, Medienstaatsvertrag): nicht geprüft; die einschlägige Norm des Medienstaatsvertrags wurde nicht nachgeschlagen.

## Quellen (Auswahl, abgerufen 12.11.2026)

- UrhG: [§ 2](https://www.gesetze-im-internet.de/urhg/__2.html), [§ 5](https://www.gesetze-im-internet.de/urhg/__5.html),
  [§ 44b](https://www.gesetze-im-internet.de/urhg/__44b.html), [§ 50](https://www.gesetze-im-internet.de/urhg/__50.html),
  [§ 51](https://www.gesetze-im-internet.de/urhg/__51.html), [§ 62](https://www.gesetze-im-internet.de/urhg/__62.html),
  [§ 63](https://www.gesetze-im-internet.de/urhg/__63.html), [§ 72](https://www.gesetze-im-internet.de/urhg/__72.html),
  [§ 87](https://www.gesetze-im-internet.de/urhg/__87.html), [§ 94](https://www.gesetze-im-internet.de/urhg/__94.html),
  [§ 95](https://www.gesetze-im-internet.de/urhg/__95.html)
- KUG: [§ 22](https://www.gesetze-im-internet.de/kunsturhg/__22.html), [§ 23](https://www.gesetze-im-internet.de/kunsturhg/__23.html)
- [SächsGemO (REVOSax)](https://www.revosax.sachsen.de/vorschrift/2754-Saechsische-Gemeindeordnung), § 37;
  [SächsPresseG (REVOSax)](https://www.revosax.sachsen.de/vorschrift/4197-SaechsPresseG), § 11a
- [Geschäftsordnung der Ratsversammlung Leipzig (Satzung 1-04)](https://www.leipzig.de/service-portal/satzungen/details/satzung/1-04/download),
  §§ 11, 21
- [Impressum leipzig.de](https://www.leipzig.de/impressum), [Datenschutzerklärung leipzig.de](https://www.leipzig.de/datenschutz),
  [Ratsversammlung](https://www.leipzig.de/rathaus/stadtrat/ratsversammlung)
- [AGB](https://www.video-stream-hosting.com/agb/) und [Impressum](https://www.video-stream-hosting.com/impressum/)
  Video-Stream-Hosting
- [Sächsische Datenschutzbeauftragte: Datenschutz in der Gemeinderatsarbeit](https://www.datenschutz.sachsen.de/datenschutz-in-der-gemeinderats-stadtrats-und-kreistagsarbeit-7882.html)
- Rechtsprechung: BGH I ZR 86/12 (Peter Fechter), BGH I ZR 104/17 (Museumsfotos), BGH I ZR 42/05 (TV-Total),
  BGH I ZR 185/03 (Bodenrichtwertsammlung), KG 2 U 12/16 Kart, EuGH C-516/17 (Spiegel Online), EuGH C-393/09 (BSA);
  Links jeweils im Text
- [Bundestag: Nutzungsbedingungen Audio- und Videomaterial](https://www.bundestag.de/nutzungsbedingungen)
