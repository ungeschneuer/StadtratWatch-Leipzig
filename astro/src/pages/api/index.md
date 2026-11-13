---
layout: ../../layouts/BlogPostLayout.astro
---

# StadtratWatch Leipzig API

StadtratWatch Leipzig hat eine öffentliche Schnittstelle, die es Entwickler:innen und Bürger:innen ermöglicht, direkt auf die Daten zuzugreifen. Die API v1 bietet strukturierten Zugang zu Legislaturperioden, Redebeiträgen und Abstimmungsergebnissen.

## Verfügbare Endpunkte

Felder, Beispiele und Fehlercodes beschreibt die [Dokumentation der API v1](v1/README/).

**Legislaturperioden**

- `GET /api/v1/parliament-periods.json` - Liste aller Legislaturperioden
- `GET /api/v1/parliament-periods/[id].json` - Details zu einer spezifischen Legislaturperiode

**Redebeiträge**

- `GET /api/v1/parliament-periods/[id]/speeches/[sessionId].json` - Redebeiträge einer Sitzung

**Abstimmungen**

- `GET /api/v1/parliament-periods/[id]/votings/[sessionId].json` - Abstimmungsergebnisse einer Sitzung

## Lizenz und Nutzung

Die selbst erhobenen Stimmen stehen unter CC0 1.0 und können ohne Einschränkungen genutzt werden. Angaben aus OParl stammen von der Stadt Leipzig (CC BY 4.0); die Texte der Redebeiträge aus dem Verlaufsprotokoll fallen nicht unter CC0. Die API ist kostenlos und erfordert keine Authentifizierung.

## Technische Details

Die API nutzt statische Generierung für optimale Performance und liefert strukturierte JSON-Antworten. Jede Antwort enthält Metadaten zur API-Version und Lizenzinformationen. Bei Abstimmungen sagt `reviewStatus`, ob die Prüfung abgeschlossen ist.
