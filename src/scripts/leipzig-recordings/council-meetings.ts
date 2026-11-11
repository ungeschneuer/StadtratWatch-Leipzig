import { followOparlPages } from './oparl-pages.ts';

export const LEIPZIG_OPARL_COUNCIL_MEETINGS_URL =
  'https://www.leipzig.sitzung-online.de/oparl/organizations/gr/2387/meetings?size=100';

export type CouncilMeeting = {
  oparlMeetingId: string;
  date: string;
  name: string;
};

type OparlMeetingPage = {
  data: { id: string; name?: string; start?: string; cancelled?: boolean; deleted?: boolean }[];
  links?: { next?: string };
};

export type FetchJson = (url: string) => Promise<unknown>;

export async function fetchCouncilMeetings(
  fetchJson: FetchJson,
  firstDate: string,
  lastDate: string,
): Promise<CouncilMeeting[]> {
  const meetings: CouncilMeeting[] = [];
  for await (const page of followOparlPages<OparlMeetingPage['data'][number]>(
    fetchJson,
    LEIPZIG_OPARL_COUNCIL_MEETINGS_URL,
  )) {
    meetings.push(...selectHeldMeetings(page, firstDate, lastDate));
  }
  return meetings.sort((a, b) => a.date.localeCompare(b.date));
}

function selectHeldMeetings(page: OparlMeetingPage, firstDate: string, lastDate: string): CouncilMeeting[] {
  return page.data
    .filter((meeting) => meeting.start && !meeting.cancelled && !meeting.deleted)
    .map((meeting) => ({
      oparlMeetingId: meeting.id,
      date: (meeting.start as string).slice(0, 10),
      name: meeting.name ?? '',
    }))
    .filter((meeting) => meeting.date >= firstDate && meeting.date <= lastDate);
}
