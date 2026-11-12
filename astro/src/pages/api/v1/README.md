# StadtratWatch Leipzig API v1 Dokumentation

Die API v1 bietet Zugang zu strukturierten Daten über die Sitzungen der Leipziger Ratsversammlung, Abstimmungen und Redebeiträge. Alle Endpunkte geben statisches JSON zurück. Die selbst erhobenen Stimmen stehen unter CC0 1.0; Angaben aus OParl stammen von der Stadt Leipzig (CC BY 4.0), die Texte der Redebeiträge aus dem Verlaufsprotokoll (siehe `speeches_source`).

## Basis-URL

```
https://ungeschneuer.github.io/StadtratWatch-Leipzig/api/v1/
```

## Authentifizierung

Die API benötigt keine Authentifizierung. Alle Endpunkte sind öffentlich zugänglich.

## Antwortformat

Alle API-Antworten folgen diesem grundlegenden Format:

```json
{
  "meta": {
    "stadtratwatch_api": {
      "version": "1.0",
      "license": "CC0 1.0",
      "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
      "license_note": "CC0 gilt für Stimmen, Ergebnisse und Zuordnungen …",
      "attribution": [
        { "source": "Stadt Leipzig, OParl-Schnittstelle …", "url": "…", "license": "CC BY 4.0", "license_url": "…" },
        { "source": "Stadt Leipzig, Stadtratswahl 2024 …", "url": "…", "license": "Datenlizenz Deutschland – Namensnennung – Version 2.0", "license_url": "…" }
      ]
    }
  },
  "data": [...] // oder andere Datenfelder
}
```

## Endpunkte

### 1. Legislaturperioden auflisten

```
GET /api/v1/parliament-periods.json
```

Gibt eine Liste aller verfügbaren Legislaturperioden zurück.

**Antwort:**

```json
{
  "meta": { ... },
  "data": [
    {
      "id": "leipzig-8",
      "name": "Wahlperiode VIII",
      "lastUpdate": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Felder:**

- `id`: Eindeutige ID der Legislaturperiode
- `name`: Anzeigename der Legislaturperiode
- `lastUpdate`: Zeitstempel der letzten Aktualisierung

### 2. Einzelne Legislaturperiode abrufen

```
GET /api/v1/parliament-periods/{parliamentPeriodId}.json
```

Gibt detaillierte Informationen zu einer spezifischen Legislaturperiode zurück.

**Parameter:**

- `parliamentPeriodId`: ID der Legislaturperiode (z.B. "leipzig-8")

**Antwort:**

```json
{
  "meta": { ... },
  "parliamentPeriod": {
    "id": "leipzig-8",
    "name": "Wahlperiode VIII",
    "sessions": [...],
    "persons": [...],
    "factions": [...],
    "lastUpdate": "2024-01-15T10:30:00Z"
  }
}
```

### 3. Redebeiträge einer Sitzung abrufen

```
GET /api/v1/parliament-periods/{parliamentPeriodId}/speeches/{sessionId}.json
```

Gibt alle Redebeiträge einer spezifischen Stadtratssitzung zurück.

**Parameter:**

- `parliamentPeriodId`: ID der Legislaturperiode
- `sessionId`: ID der Sitzung

**Antwort:**

```json
{
  "meta": { ... },
  "data": [
    {
      "personId": "max-mustermann",
      "speaker": "Max Mustermann",
      "start": "00:15:30",
      "duration": "00:03:45",
      "onBehalfOf": "Ausschuss für Stadtentwicklung, Bauen und Verkehr",
      "transcription": "Meine Damen und Herren, ich möchte zu diesem Punkt folgendes sagen..."
    }
  ]
}
```

**Felder:**

- `personId`: ID der sprechenden Person (kann `null` sein)
- `speaker`: Name der sprechenden Person
- `start`: Startzeit des Redebeitrags im Video in Sekunden
- `duration`: Dauer des Redebeitrags in Sekunden
- `onBehalfOf`: Name des Gremiums, für das die Person spricht (bspw. ein Ausschuss, optional)
- `transcription`: Text des Redebeitrags laut Verlaufsprotokoll der Stadt Leipzig. Er fällt nicht unter CC0; die Quelle steht in `meta.speeches_source`.

**Hinweise:**

- Nur Redebeiträge mit verfügbaren Transkriptionen werden zurückgegeben
- Redebeiträge der Sitzungsleitung werden herausgefiltert
- personId kann `null` sein. Das kann der Fall sein, wenn der Redebeitrag von einer Person stammt, die kein Stadtratsmitglied ist. Bspw. eine Beigeordnete oder wenn Person auf Einladung des Stadtrats spricht.

### 4. Abstimmungen einer Sitzung abrufen

```
GET /api/v1/parliament-periods/{parliamentPeriodId}/votings/{sessionId}.json
```

Gibt alle Abstimmungen einer spezifischen Stadtratssitzung zurück.

**Parameter:**

- `parliamentPeriodId`: ID der Legislaturperiode
- `sessionId`: ID der Sitzung

**Antwort:**

```json
{
  "meta": { ... },
  "data": [
    {
      "id": 1,
      "videoTimestamp": 1800,
      "votingSubject": "Antrag zur Verkehrsberuhigung in der Innenstadt",
      "votes": [
        {
          "personId": "person-123",
          "personOparlId": "https://www.leipzig.sitzung-online.de/oparl/persons/1000067",
          "vote": "yes"
        },
        {
          "personId": "person-456",
          "personOparlId": "https://www.leipzig.sitzung-online.de/oparl/persons/73",
          "vote": "no"
        },
        {
          "personId": "person-789",
          "personOparlId": "https://www.leipzig.sitzung-online.de/oparl/persons/2001498",
          "vote": "yes"
        }
      ],
      "majorityRequirement": "simple",
      "presentMembers": null,
      "result": "accepted",
      "reviewStatus": null
    }
  ]
}
```

**Felder:**

- `id`: Eindeutige ID der Abstimmung. (Eindeutigkeit innerhalb der Sitzung)
- `videoTimestamp`: Zeitstempel im Video in Sekunden
- `votingSubject`: Beschreibung des Abstimmungsthemas
- `votes`: Array mit den einzelnen Stimmen. `personId` ist der lesbare Schlüssel der Seite (ändert sich mit dem Namen), `personOparlId` der stabile Schlüssel aus OParl (`null`, wenn die Person keine OParl-ID hat)
- `votingSubject.oparlAgendaItemId`, `votingSubject.oparlPaperId`: Tagesordnungspunkt und Drucksache in OParl, soweit die Stadt sie führt
- `majorityRequirement`: Mehrheitserfordernis der Abstimmung, immer gesetzt. Standard ist `"simple"`, wenn kein anderes Erfordernis erfasst ist. Mögliche Werte:
  - `simple`: Einfache Mehrheit
  - `majority-of-present`: Mehrheit der anwesenden Mitglieder
  - `two-thirds-of-present`: Zwei Drittel der anwesenden Mitglieder
  - `majority-of-members`: Mehrheit der Mitglieder
  - `two-thirds-of-members`: Zwei Drittel der Mitglieder
  - `three-quarters-of-members`: Drei Viertel der Mitglieder

  Mitglieder meint die gesetzliche Mitgliederzahl, also alle Sitze in der Ratsversammlung einschließlich des Oberbürgermeisters. Ein unbesetzter Sitz senkt sie nicht.

- `presentMembers`: Zahl der anwesenden Mitglieder („Anwesende“ auf der Abstimmungstafel) oder `null`, wo sie nicht erfasst ist. Bei `majority-of-present` und `two-thirds-of-present` ist sie immer gesetzt. Bei den anderen Mehrheitserfordernissen kann sie gesetzt sein, geht dann aber nicht in das Ergebnis ein.
- `result`: Abstimmungsergebnis, `"accepted"` (angenommen) oder `"rejected"` (abgelehnt). Es wird aus den Stimmen, dem Mehrheitserfordernis und dessen Bezugsgröße berechnet.
- `reviewStatus`: `null`, wenn die Abstimmung abschließend geprüft ist. `"provisional"`: alle automatischen Prüfungen bestanden, das amtliche Ergebnis steht noch aus. `"needs-review"`: eine Prüfung ist fehlgeschlagen, einzelne Stimmen können falsch gelesen sein; Prüfende entscheiden den Fall.
- `votingSubject.paperUrl`: Link zur Drucksache im Ratsinformationssystem (optional).

**Abstimmungsoptionen:**

- `yes`: Ja-Stimme
- `no`: Nein-Stimme
- `abstain`: Enthaltung
- `no_show`: Nicht abgestimmt

## Fehlerbehandlung

### 404 - Nicht gefunden

Wenn eine angeforderte Ressource nicht existiert:

```json
{
  "status": 404,
  "statusText": "Session speeches not found"
}
```

## Beispiele

### Alle Legislaturperioden abrufen

```bash
curl -X GET https://ungeschneuer.github.io/StadtratWatch-Leipzig/api/v1/parliament-periods.json
```

### Redebeiträge einer Sitzung abrufen

```bash
curl -X GET https://ungeschneuer.github.io/StadtratWatch-Leipzig/api/v1/parliament-periods/leipzig-8/speeches/2026-10-29.json
```

### Abstimmungen einer Sitzung abrufen

```bash
curl -X GET https://ungeschneuer.github.io/StadtratWatch-Leipzig/api/v1/parliament-periods/leipzig-8/votings/2026-10-29.json
```

## Bulk-Downloads

Alle veröffentlichten Abstimmungen als Tabellen, im Long-Format und als [Frictionless Data Package](https://datapackage.org) beschrieben (Spalten, Typen, Schlüssel, Lizenzen, Quellen):

```
https://ungeschneuer.github.io/StadtratWatch-Leipzig/data/leipzig-8/datapackage.json
https://ungeschneuer.github.io/StadtratWatch-Leipzig/data/leipzig-8/votings.csv               # eine Zeile je Abstimmung
https://ungeschneuer.github.io/StadtratWatch-Leipzig/data/leipzig-8/votes.csv                 # eine Zeile je Person und Abstimmung
https://ungeschneuer.github.io/StadtratWatch-Leipzig/data/leipzig-8/sessions.csv              # eine Zeile je Sitzungstag
https://ungeschneuer.github.io/StadtratWatch-Leipzig/data/leipzig-8/persons.csv               # Mitglieder
https://ungeschneuer.github.io/StadtratWatch-Leipzig/data/leipzig-8/faction-memberships.csv   # Fraktionen mit Zeiträumen
```

Sie enthalten genau, was Seite und API zeigen. Bedeutung der Felder, Stimmcodes, Methodik und Grenzen: [`DATA.md`](https://github.com/ungeschneuer/StadtratWatch-Leipzig/blob/main/DATA.md).

## Lizenz

Die selbst erhobenen Abstimmungsdaten stehen unter CC0 1.0 (Public Domain). Für Angaben aus OParl (Sitzungen, Personen, Vorlagen) gilt CC BY 4.0 mit der Namensnennung „Stadt Leipzig“; die Texte der Redebeiträge stammen aus dem Verlaufsprotokoll der Stadt Leipzig (§ 48 UrhG) und fallen nicht unter CC0.
