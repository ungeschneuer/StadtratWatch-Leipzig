# StadtratWatch Leipzig

Beobachtung der Leipziger Ratsversammlung: Abstimmungen werden von der Abstimmungstafel der Video-Aufzeichnungen gelesen, mit OParl-Daten und Protokollen abgeglichen und als statische Website veröffentlicht; Redebeiträge stammen aus dem Verlaufsprotokoll.

## Language

### Abstimmungen

**Stimme**:
Das, was ein Ratsmitglied in einer Abstimmung abgibt: Ja, Nein, Enthaltung oder nicht abgestimmt. „Nicht abgestimmt“ umfasst Abwesenheit und Anwesenheit ohne Stimmabgabe; die Tafel unterscheidet beides (Feld mit oder ohne Nummer), die Seite zählt beides als nicht abgestimmt.
_Avoid_: Votum, Vote (außer im Code), Abstimmungsverhalten

**Mehrheitserfordernis**:
Die Mehrheit, die eine Abstimmung braucht, um angenommen zu sein. Im Regelfall die einfache Mehrheit (mehr Ja- als Nein-Stimmen, Enthaltungen zählen nicht); für bestimmte Abstimmungen schreibt die Geschäftsordnung eine qualifizierte Mehrheit vor, etwa zwei Drittel der anwesenden Mitglieder bei der Erweiterung der Tagesordnung.
_Avoid_: Quorum, Mehrheitsregel, Schwelle

**Bezugsgröße**:
Die Zahl, an der ein Mehrheitserfordernis gemessen wird: die Ja- und Nein-Stimmen, die anwesenden Mitglieder oder die gesetzliche Mitgliederzahl.
_Avoid_: Basis, Grundgesamtheit

**Anwesende Mitglieder**:
Die Zahl der Mitglieder, die bei einer Abstimmung anwesend sind, wie die Abstimmungstafel sie als „Anwesende“ anzeigt. Sie schließt Enthaltende und Anwesende ohne Stimmabgabe ein und kann sich im Lauf einer Sitzung ändern.
_Avoid_: Anwesenheit (für die Zahl), abgegebene Stimmen

**Gesetzliche Mitgliederzahl**:
Die Zahl der Sitze in der Ratsversammlung einschließlich des Oberbürgermeisters, in Leipzig 71. Ein unbesetzter Sitz senkt sie nicht.
_Avoid_: Mitgliederzahl (ohne Zusatz), Ratsgröße

**Abstimmungsergebnis**:
Angenommen oder abgelehnt. Eine Abstimmung ist angenommen, wenn ihre Stimmen das Mehrheitserfordernis der Abstimmung erfüllen.
_Avoid_: Ergebnis (ohne Zusatz), Voting-Ergebnis

**Abstimmungserfolg**:
Wie oft die Stimme eines Ratsmitglieds mit dem Abstimmungsergebnis übereinstimmt. Für eine Fraktion oder Partei zählt die Mehrheit der Ja- und Nein-Stimmen ihrer Mitglieder.
_Avoid_: Erfolgsquote, Votum

**Antragsergebnis**:
Angenommen, teilweise angenommen oder abgelehnt. Ein Antrag mit mehreren Abstimmungen ist teilweise angenommen, wenn nur ein Teil seiner Abstimmungen angenommen ist.
_Avoid_: Antragserfolg, Motion-Ergebnis

### Redebeiträge

**Redebeitrag**:
Ein zusammenhängender Wortbeitrag einer Person in einer Sitzung, identifiziert durch Sitzung und Startzeitpunkt; sein Text stammt aus dem Verlaufsprotokoll, die Zeit aus den Untertiteln der Aufzeichnung.
_Avoid_: Rede, Speech (außer im Code), Wortmeldung

### Daten

**Prüfstatus**:
Wie weit eine Abstimmung geprüft ist: geprüft (Tafel stimmt mit dem amtlichen Ergebnis oder ist entschieden), vorläufig (alle Prüfungen bestanden, amtliches Ergebnis steht aus) oder in Prüfung (eine Prüfung schlug fehl, Prüfende entscheiden). Im Code `status` bzw. `reviewStatus`.
_Avoid_: Freigabe (für eine einzelne Abstimmung), Qualität

**Wahlliste**:
Die Liste, auf der ein Ratsmitglied 2024 gewählt wurde; auf der Seite als „Partei“ geführt, solange keine Quelle einen Wechsel belegt.
_Avoid_: Parteimitgliedschaft
