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
  const meetingId = 'https://www.leipzig.sitzung-online.de/oparl/meetings/2004593';
  const item = (id: number, number: string, meeting = meetingId) => ({
    id: `https://www.leipzig.sitzung-online.de/oparl/agendaItems/${id}`,
    number,
    meeting,
  });
  const objects: Record<string, unknown> = {
    [meetingId]: { agendaItem: [item(2186135, '15.10')], web: 'https://ratsinformation.example/TO010?SILFDNR=2004593' },
    'https://www.leipzig.sitzung-online.de/oparl/agendaItems/2185538': item(2185538, '18.10'),
    'https://www.leipzig.sitzung-online.de/oparl/agendaItems/2190000': item(2190000, '3', 'other-meeting'),
    'https://www.leipzig.sitzung-online.de/oparl/agendaItems/2208634': {
      id: 'https://www.leipzig.sitzung-online.de/oparl/agendaItems/2208634',
      deleted: true,
    },
  };
  const agendaPage =
    '<a href="./to020?TOLFDNR=2186135&amp;SILFDNR=2004593">15.10</a>' +
    '<a href="./to020?TOLFDNR=2185538&amp;SILFDNR=2004593">18.10</a>' +
    '<a href="./vo020?refresh=false&amp;TOLFDNR=2185538">VIII-DS-01727</a>' +
    '<a href="./to020?TOLFDNR=2190000">3</a>' +
    '<a href="./to020?TOLFDNR=2208634">gelöscht</a>';

  it('adds the items that OParl leaves out of the meeting, taken from the agenda page', async () => {
    const agenda = await fetchMeetingAgenda(
      (url) => Promise.resolve(objects[url]),
      () => Promise.resolve(agendaPage),
      meetingId,
    );

    expect(agenda.map((entry) => entry.number)).toEqual(['15.10', '18.10']);
  });
});
