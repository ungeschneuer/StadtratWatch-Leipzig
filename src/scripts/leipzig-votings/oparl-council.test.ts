import { describe, expect, it } from 'bun:test';

import {
  COUNCIL_ORGANIZATION_ID,
  fetchCouncilRoster,
  fetchMeetingAgenda,
  LEIPZIG_OPARL_BODY_URL,
} from './oparl-council.ts';

const pages: Record<string, unknown> = {
  [`${LEIPZIG_OPARL_BODY_URL}/memberships?size=100`]: {
    data: [
      { person: 'droese', organization: COUNCIL_ORGANIZATION_ID, startDate: '2019-09-18', endDate: '2026-01-27' },
      { person: 'reinhardt', organization: COUNCIL_ORGANIZATION_ID, startDate: '2026-02-26' },
      { person: 'jung', organization: COUNCIL_ORGANIZATION_ID, startDate: '2020-01-01' },
      { person: 'later', organization: COUNCIL_ORGANIZATION_ID, startDate: '2026-04-01' },
    ],
  },
  [`${LEIPZIG_OPARL_BODY_URL}/persons?size=100`]: {
    data: ['droese', 'reinhardt', 'jung', 'later'].map((id) => ({ id, name: id })),
  },
};

const roster = await fetchCouncilRoster((url) => Promise.resolve(pages[url]));

describe('fetchCouncilRoster', () => {
  it('lists the members of a day', () => {
    expect(roster.membersOn('2026-01-28').map((person) => person.personId)).toEqual(['jung']);
  });

  it('adds successors whose membership starts within a week after the session', () => {
    expect(roster.sessionRoster('2026-02-25')).toEqual([
      { personId: 'jung', name: 'jung', familyName: 'jung', givenName: '' },
      { personId: 'reinhardt', name: 'reinhardt', familyName: 'reinhardt', givenName: '', joinsAfterSessionDay: true },
    ]);
  });
});

describe('fetchMeetingAgenda', () => {
  const meetingId = 'https://www.leipzig.sitzung-online.de/oparl/meetings/2004603';
  const now = new Date('2026-11-25T09:00:00Z');
  const item = (order: number, number: string, meeting = meetingId) => ({
    id: `https://www.leipzig.sitzung-online.de/oparl/agendaItems/${2_200_000 + order}`,
    order,
    number,
    meeting,
  });
  const embedded = Array.from({ length: 131 }, (_, index) => item(100_001 + index, `1.${index + 1}`));
  const listPageUrl = (page: number) =>
    `${LEIPZIG_OPARL_BODY_URL}/agendaItems?modified_since=2026-10-05T13%3A00%3A00%2B00%3A00` +
    `&modified_until=2026-11-25T09%3A00%3A00%2B00%3A00&size=100&page=${page}`;
  const listPages: Record<string, unknown> = {
    [listPageUrl(1)]: {
      data: [item(100_131, '1.131'), item(100_132, '18.2'), item(100_005, '3', 'other-meeting')],
      pagination: { totalPages: 2 },
    },
    [listPageUrl(2)]: {
      data: [item(200_001, '20'), { ...item(100_133, '18.3'), deleted: true }, item(100_133, '19')],
      pagination: { totalPages: 2 },
    },
  };

  it('adds the items OParl leaves out of the meeting from the body list filtered by modification time', async () => {
    const requested: string[] = [];
    const agenda = await fetchMeetingAgenda(
      (url) => {
        requested.push(url);
        return Promise.resolve(
          url === meetingId ? { start: '2026-11-19T14:00:00+01:00', agendaItem: embedded } : listPages[url],
        );
      },
      meetingId,
      now,
    );

    expect(agenda.slice(129).map((entry) => entry.number)).toEqual(['1.130', '1.131', '18.2', '19', '20']);
    expect(requested).toEqual([meetingId, listPageUrl(1), listPageUrl(2)]);
  });

  it('reads no list when OParl embeds fewer items than its limit', async () => {
    const requested: string[] = [];
    const agenda = await fetchMeetingAgenda(
      (url) => {
        requested.push(url);
        return Promise.resolve({ start: '2026-11-19T14:00:00+01:00', agendaItem: embedded.slice(0, 3) });
      },
      meetingId,
      now,
    );

    expect(agenda.map((entry) => entry.number)).toEqual(['1.1', '1.2', '1.3']);
    expect(requested).toEqual([meetingId]);
  });
});
