import { describe, expect, it } from 'bun:test';

import { findAttachmentPath, listAgendaItemIds, pageLines } from './allris.ts';
import { parseAgendaItemPage } from './minutes.ts';
import { agendaNumbersOf } from './official-sources.ts';

const meetingPage = `
  <a href="./to010?0--anlagenHeaderPanel-attachmentsList-1-attachment-link&amp;SILFDNR=2004593&amp;refresh=true" class="attlink pdf">Tagesordnung</a>
  <a href="./to010?0--anlagenHeaderPanel-attachmentsList-2-attachment-link&amp;SILFDNR=2004593&amp;refresh=true" class="attlink pdf">Verlaufsprotokoll öffentlich</a>
  <a href="./to020?TOLFDNR=2185538&amp;SILFDNR=2004593">Ö 18.10</a>
  <td><a href="#">Ö 19.5.6</a></td>
  <a href="./to020?TOLFDNR=2185538&amp;SILFDNR=2004593">Einrichtung einer Außenstelle</a>`;

const agendaItemPage = `<dl><dt>TOP:</dt><dd>Ö 19.5.6</dd><dt>Vorlage:</dt><dd>VIII-DS-01619-NF-02-ÄA-06 Eigenheime</dd></dl>
  <h3>Dokumente</h3><div>Abstimmungsergebnis</div><div>Zuständigkeit/Ergebnis:</div><div>geändert beschlossen</div>
  <div>Abstimmungsergebnis zu Punkt 1:</div><div>Ja-Stimmen: 28</div><div>Nein-Stimmen: 31</div><div>Enthaltungen: 1</div>
  <div>Abstimmungsergebnis zu Punkt 2:</div><div>Ja-Stimmen: 29</div><div>Nein-Stimmen: 31</div><div>Enthaltungen: 0</div>`;

describe('ALLRIS pages', () => {
  it('finds an attachment of the meeting page by its title', () => {
    expect(findAttachmentPath(meetingPage, /Verlaufsprotokoll/)).toEqual(
      './to010?0--anlagenHeaderPanel-attachmentsList-2-attachment-link&SILFDNR=2004593&refresh=true',
    );
  });

  it('lists the agenda items and their numbers', () => {
    expect(listAgendaItemIds(meetingPage)).toEqual(['2185538']);
    expect([...agendaNumbersOf(meetingPage)]).toEqual(['18', '18.10', '19', '19.5', '19.5.6']);
  });

  it('reads the results of an agenda item page', () => {
    expect(parseAgendaItemPage(pageLines(agendaItemPage))).toMatchObject([
      {
        agendaItemNumber: '19.5.6',
        paperReference: 'VIII-DS-01619-NF-02-ÄA-06',
        label: 'Abstimmungsergebnis zu Punkt 1:',
        J: 28,
      },
      { agendaItemNumber: '19.5.6', J: 29, N: 31, E: 0 },
    ]);
  });
});
