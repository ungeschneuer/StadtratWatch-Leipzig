import { describe, expect, it } from 'bun:test';

import {
  AllrisUnreachableError,
  createAllrisClient,
  findAttachmentPath,
  listAgendaItemIds,
  pageLines,
} from './allris.ts';
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

describe('ALLRIS client', () => {
  function timingOutFetch() {
    const calls: string[] = [];
    const fetchImplementation = (url: string) => {
      calls.push(String(url));
      return Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'));
    };
    return { calls, fetchImplementation };
  }

  it('gives up on the first timeout instead of retrying it', async () => {
    const { calls, fetchImplementation } = timingOutFetch();
    const allris = createAllrisClient('test', { fetchImplementation, pauseMilliseconds: 0 });

    await expect(allris.getText('to010?SILFDNR=1')).rejects.toBeInstanceOf(AllrisUnreachableError);
    expect(calls).toHaveLength(1);
  });

  it('asks ALLRIS no more once it has not answered in this run', async () => {
    const { calls, fetchImplementation } = timingOutFetch();
    const allris = createAllrisClient('test', { fetchImplementation, pauseMilliseconds: 0 });

    await allris.getText('to010?SILFDNR=1').catch(() => {});
    await expect(allris.getText('to010?SILFDNR=2')).rejects.toBeInstanceOf(AllrisUnreachableError);
    expect(calls).toHaveLength(1);
  });

  it('keeps retrying a server error', async () => {
    const statuses = [503, 200];
    const fetchImplementation = () => Promise.resolve(new Response('ok', { status: statuses.shift() }));
    const allris = createAllrisClient('test', { fetchImplementation, pauseMilliseconds: 0, retryPauseMilliseconds: 0 });

    expect(await allris.getText('to010?SILFDNR=1')).toBe('ok');
  });
});
