import { describe, expect, it } from 'bun:test';

import { deriveCouncilMembers, mergeSpans, type OparlMembership } from './council-members.ts';

const COUNCIL = 'org/council';
const SPD = 'org/spd';
const CDU = 'org/cdu';
const SPORT = 'org/sport';
const BAEDER = 'org/baeder';
const organizations = [
  { id: COUNCIL, name: 'Ratsversammlung', classification: 'Ebene 1' },
  { id: SPD, name: 'SPD-Fraktion', classification: 'Fraktion' },
  { id: CDU, name: 'CDU-Fraktion', classification: 'Fraktion' },
  { id: SPORT, name: 'FA Sport', classification: 'Ausschuss' },
  { id: BAEDER, name: 'Aufsichtsrat Sportbäder Leipzig GmbH', classification: 'Aufsichtsrat' },
];
const persons = [
  { id: 'p/abraham', name: 'Prof. Dr. Getu Abraham', familyName: 'Abraham', givenName: 'Getu' },
  { id: 'p/jung', name: 'Oberbürgermeister Burkhard Jung', familyName: 'Jung', givenName: 'Burkhard' },
];

function membership(person: string, organization: string, startDate: string, endDate?: string, role = 'Mitglied') {
  return { id: `${person}/${organization}/${startDate}`, person, organization, startDate, endDate, role };
}

function derive(memberships: OparlMembership[]) {
  return deriveCouncilMembers({ memberships, persons, organizations }, COUNCIL, '2024-09-18');
}

describe('deriveCouncilMembers', () => {
  it('keeps faction changes and fills the time without a faction', () => {
    const { members, problems } = derive([
      membership('p/abraham', COUNCIL, '2019-09-18'),
      membership('p/abraham', SPD, '2019-09-18', '2024-11-08'),
      membership('p/abraham', CDU, '2025-03-13', '2026-09-22'),
    ]);

    expect(problems).toEqual([]);
    expect(members[0]).toMatchObject({ start: '2024-09-18', end: null, isMayor: false });
    expect(members[0].factionPeriods).toEqual([
      { organizationId: SPD, start: '2024-09-18', end: '2024-11-08' },
      { organizationId: null, start: '2024-11-09', end: '2025-03-12' },
      { organizationId: CDU, start: '2025-03-13', end: '2026-09-22' },
      { organizationId: null, start: '2026-09-23', end: null },
    ]);
  });

  it('merges memberships that a new role in the same faction split', () => {
    const { members } = derive([
      membership('p/abraham', COUNCIL, '2014-12-18'),
      membership('p/abraham', SPD, '2014-12-18', '2024-12-11', 'Fraktionsmitglied'),
      membership('p/abraham', SPD, '2024-12-12', undefined, 'stv. Vorsitzender'),
    ]);

    expect(members[0].factionPeriods).toEqual([{ organizationId: SPD, start: '2024-09-18', end: null }]);
  });

  it('marks the mayor and leaves out memberships that ended before the period', () => {
    const { members } = derive([
      membership('p/jung', COUNCIL, '2006-03-29', undefined, 'Oberbürgermeister'),
      membership('p/abraham', COUNCIL, '2009-11-11', '2019-09-17'),
    ]);

    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ isMayor: true, factionPeriods: [{ organizationId: null }] });
  });

  it('reports overlapping faction memberships instead of choosing one', () => {
    const { problems } = derive([
      membership('p/abraham', COUNCIL, '2024-09-18'),
      membership('p/abraham', SPD, '2024-09-18', '2025-01-31'),
      membership('p/abraham', CDU, '2025-01-01'),
    ]);

    expect(problems).toEqual([
      'Prof. Dr. Getu Abraham: faction memberships overlap (org/spd until 2025-01-31, org/cdu from 2025-01-01)',
    ]);
  });
});

describe('mergeSpans', () => {
  it('keeps spans apart that a gap separates', () => {
    expect(
      mergeSpans([
        { start: '2024-09-18', end: '2024-10-01' },
        { start: '2024-10-03', end: null },
      ]),
    ).toHaveLength(2);
  });

  it('lists the committees and boards a member sits in during the period, without faction and council', () => {
    const { members } = derive([
      membership('p/abraham', COUNCIL, '2019-09-18'),
      membership('p/abraham', SPD, '2019-09-18'),
      membership('p/abraham', SPORT, '2014-12-18', undefined, 'Ausschussmitglied'),
      membership('p/abraham', BAEDER, '2010-01-21', '2015-01-21', 'Aufsichtsrat'),
      membership('p/abraham', BAEDER, '2025-02-01', undefined, 'Vorsitzender'),
    ]);

    expect(members[0].bodyMemberships).toEqual([
      { organizationId: SPORT, role: 'Ausschussmitglied', start: '2024-09-18', end: null },
      { organizationId: BAEDER, role: 'Vorsitzender', start: '2025-02-01', end: null },
    ]);
  });
});
