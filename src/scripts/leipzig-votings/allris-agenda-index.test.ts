import { describe, expect, it } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LEIPZIG_OPARL_COUNCIL_MEETINGS_URL } from '../leipzig-recordings/council-meetings.ts';
import {
  ALLRIS_AGENDA_INDEX_FILE,
  readAllrisAgendaIndex,
  refreshAllrisAgendaIndex,
  serializeAllrisAgendaIndex,
} from './allris-agenda-index.ts';
import { type AllrisClient, AllrisUnreachableError } from './allris.ts';

const meetingUrl = (id: string) => `https://www.leipzig.sitzung-online.de/oparl/meetings/${id}`;

const councilMeetings = {
  data: [
    { id: meetingUrl('2004603'), name: 'Ratsversammlung', start: '2026-11-19T14:00:00+01:00' },
    { id: meetingUrl('2004610'), name: 'Ratsversammlung', start: '2026-12-16T14:00:00+01:00' },
    { id: meetingUrl('2004500'), name: 'Ratsversammlung', start: '2026-09-30T14:00:00+02:00' },
  ],
};

const agendaPages: Record<string, string> = {
  'to010?SILFDNR=2004603': '<a href="./to020?TOLFDNR=2218888">3.1</a><a href="./to020?TOLFDNR=2219001">18.2</a>',
  'to010?SILFDNR=2004610': '<p>Die Tagesordnung ist noch nicht veröffentlicht.</p>',
};

function allrisAnswering(pages: Record<string, string>): AllrisClient {
  return {
    getText: (path) => (path in pages ? Promise.resolve(pages[path]) : Promise.reject(new Error(`no page ${path}`))),
    getBytes: () => Promise.reject(new Error('not used')),
  };
}

const fetchJson = (url: string) =>
  url === LEIPZIG_OPARL_COUNCIL_MEETINGS_URL ? Promise.resolve(councilMeetings) : Promise.reject(new Error(url));

async function dataDirWith(stored: Record<string, string[]>): Promise<string> {
  const dataDir = await mkdtemp(join(tmpdir(), 'allris-agenda-index-'));
  await writeFile(join(dataDir, ALLRIS_AGENDA_INDEX_FILE), serializeAllrisAgendaIndex({ meetings: stored }));
  return dataDir;
}

describe('refreshAllrisAgendaIndex', () => {
  const today = new Date('2026-11-25T06:17:00Z');

  it('stores the agenda page ids of the council meetings around today', async () => {
    const dataDir = await dataDirWith({});

    await refreshAllrisAgendaIndex({ dataDir, fetchJson, allris: allrisAnswering(agendaPages), today, warn: () => {} });

    expect((await readAllrisAgendaIndex(dataDir)).meetings).toEqual({
      [meetingUrl('2004603')]: ['2218888', '2219001'],
    });
  });

  it('keeps stored lists of older meetings and does not replace a list by an unpublished agenda', async () => {
    const dataDir = await dataDirWith({ [meetingUrl('2004500')]: ['2100000'], [meetingUrl('2004610')]: ['2230000'] });

    await refreshAllrisAgendaIndex({ dataDir, fetchJson, allris: allrisAnswering(agendaPages), today, warn: () => {} });

    expect((await readAllrisAgendaIndex(dataDir)).meetings).toEqual({
      [meetingUrl('2004500')]: ['2100000'],
      [meetingUrl('2004603')]: ['2218888', '2219001'],
      [meetingUrl('2004610')]: ['2230000'],
    });
  });

  it('leaves the stored lists as they are when ALLRIS does not answer', async () => {
    const dataDir = await dataDirWith({ [meetingUrl('2004603')]: ['2218888'] });
    const unreachable: AllrisClient = {
      getText: () => Promise.reject(new AllrisUnreachableError(new Error('The operation timed out.'))),
      getBytes: () => Promise.reject(new Error('not used')),
    };
    const warnings: string[] = [];

    await refreshAllrisAgendaIndex({
      dataDir,
      fetchJson,
      allris: unreachable,
      today,
      warn: (message) => warnings.push(message),
    });

    expect((await readAllrisAgendaIndex(dataDir)).meetings).toEqual({ [meetingUrl('2004603')]: ['2218888'] });
    expect(warnings).toHaveLength(1);
  });
});
