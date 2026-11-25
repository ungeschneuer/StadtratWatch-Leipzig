import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { fetchCouncilMeetings, type FetchJson } from '../leipzig-recordings/council-meetings.ts';
import { type AllrisClient, AllrisUnreachableError, meetingPagePath } from './allris.ts';
import { listAgendaItemIdsOfAgendaPage } from './oparl-council.ts';

// ALLRIS does not answer GitHub Actions, but OParl embeds at most 131 agenda items in a meeting. The ALLRIS runner on
// the operator's server therefore stores the item ids of each council meeting's agenda page here, and the extraction in
// Actions reads them instead of the page.
export const ALLRIS_AGENDA_INDEX_FILE = 'allris-agenda-items.json';

export type AllrisAgendaIndex = {
  // OParl meeting id to the ALLRIS agenda item ids (TOLFDNR) of its agenda page, in page order.
  meetings: Record<string, string[]>;
};

// The agenda is published about two weeks before a session and can change until the session day; recordings appear a
// day or more after it. Meetings in this window are read again on every run, older ones keep their stored list.
const DAYS_BEFORE_TODAY = 14;
const DAYS_AFTER_TODAY = 28;

export async function readAllrisAgendaIndex(dataDir: string): Promise<AllrisAgendaIndex> {
  const json = await readFile(join(dataDir, ALLRIS_AGENDA_INDEX_FILE), 'utf-8').catch(() => null);
  return json ? (JSON.parse(json) as AllrisAgendaIndex) : { meetings: {} };
}

export type AgendaIndexRefresh = {
  dataDir: string;
  fetchJson: FetchJson;
  allris: AllrisClient;
  today: Date;
  warn: (message: string) => void;
};

export async function refreshAllrisAgendaIndex(refresh: AgendaIndexRefresh): Promise<void> {
  const index = await readAllrisAgendaIndex(refresh.dataDir);
  const meetings = await fetchCouncilMeetings(
    refresh.fetchJson,
    isoDateOffset(refresh.today, -DAYS_BEFORE_TODAY),
    isoDateOffset(refresh.today, DAYS_AFTER_TODAY),
  ).catch((error: unknown) => {
    refresh.warn(`OParl council meetings not readable (${error instanceof Error ? error.message : String(error)})`);
    return [];
  });
  for (const meeting of meetings) {
    const meetingNumericId = meeting.oparlMeetingId.slice(meeting.oparlMeetingId.lastIndexOf('/') + 1);
    try {
      const itemIds = listAgendaItemIdsOfAgendaPage(await refresh.allris.getText(meetingPagePath(meetingNumericId)));
      // An agenda that is not published yet lists nothing; a stored list must never be replaced by that.
      if (itemIds.length > 0) index.meetings[meeting.oparlMeetingId] = itemIds;
    } catch (error) {
      refresh.warn(
        `${meeting.date}: ALLRIS agenda page not readable (${error instanceof Error ? error.message : String(error)})`,
      );
      if (error instanceof AllrisUnreachableError) return;
    }
  }
  await writeFile(join(refresh.dataDir, ALLRIS_AGENDA_INDEX_FILE), serializeAllrisAgendaIndex(index));
}

export function serializeAllrisAgendaIndex(index: AllrisAgendaIndex): string {
  const meetings = Object.fromEntries(Object.entries(index.meetings).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify({ meetings }, null, 2)}\n`;
}

function isoDateOffset(day: Date, offsetDays: number): string {
  return new Date(day.getTime() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
