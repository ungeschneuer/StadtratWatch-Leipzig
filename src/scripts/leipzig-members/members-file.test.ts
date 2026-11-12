import { describe, expect, it } from 'bun:test';

import type { CouncilMember } from './council-members.ts';
import type { Candidate } from './election-candidates.ts';
import {
  buildMembersFile,
  COUNCIL_SEATS,
  factionMembershipsToCsv,
  type MembersInputs,
  shortFactionName,
  slug,
} from './members-file.ts';

const SPD = 'org/spd';
const organizations = [{ id: SPD, name: 'SPD-Fraktion', classification: 'Fraktion' }];
const candidates: Candidate[] = [
  { familyName: 'Zenker', givenName: 'Christopher', listShortName: 'SPD', listName: 'Sozialdemokratische Partei' },
  { familyName: 'Wittwer', givenName: 'Marius', listShortName: 'SPD', listName: 'Sozialdemokratische Partei' },
];

function member(
  id: string,
  givenName: string,
  familyName: string,
  overrides: Partial<CouncilMember> = {},
): CouncilMember {
  return {
    person: { id, name: `${givenName} ${familyName}`, givenName, familyName },
    isMayor: false,
    start: '2024-09-18',
    end: null,
    factionPeriods: [{ organizationId: SPD, start: overrides.start ?? '2024-09-18', end: overrides.end ?? null }],
    ...overrides,
  };
}

function inputs(changes: Partial<MembersInputs>): MembersInputs {
  return {
    parliamentPeriodId: 'leipzig-8',
    periodStart: '2024-09-18',
    today: '2026-11-12',
    generatedAt: '2026-11-12T10:00:00.000Z',
    members: [],
    organizations,
    candidates,
    overrides: [],
    sources: [],
    boardSessionDays: new Map(),
    ...changes,
  };
}

describe('buildMembersFile', () => {
  it('links each person to faction and party in registry form', () => {
    const { file } = buildMembersFile(
      inputs({
        members: [
          member('p/zenker', 'Christopher', 'Zenker', { end: '2025-01-31' }),
          member('p/wittwer', 'Marius', 'Wittwer', { start: '2025-02-12' }),
        ],
      }),
    );

    expect(
      file.persons.map(({ id, factionId, partyId, start, end }) => ({ id, factionId, partyId, start, end })),
    ).toEqual([
      { id: 'christopher-zenker', factionId: 'spd', partyId: 'spd', start: null, end: '2025-01-31' },
      { id: 'marius-wittwer', factionId: 'spd', partyId: 'spd', start: '2025-02-12', end: null },
    ]);
    expect(file.factions).toEqual([{ id: 'spd', name: 'SPD', seats: 1, oparlId: SPD, oparlName: 'SPD-Fraktion' }]);
    expect(file.parties).toEqual([{ id: 'spd', name: 'SPD', seats: 1 }]);
    expect(file.persons[0].partySource).toEqual({
      method: 'election-list',
      match: 'name',
      listName: 'Sozialdemokratische Partei',
    });
  });

  it('applies overrides: excluded person, corrected name, party with its source', () => {
    const { file, problems } = buildMembersFile(
      inputs({
        members: [
          member('p/zenker', 'CHristopher', 'Zenker'),
          member('p/gone', 'Franziska', 'Kießling'),
          {
            ...member('p/jung', 'Burkhard', 'Jung'),
            isMayor: true,
            factionPeriods: [{ organizationId: null, start: '2024-09-18', end: null }],
          },
        ],
        overrides: [
          {
            personOparlId: 'p/zenker',
            name: 'Christopher Zenker',
            givenName: 'Christopher',
            reason: 'Tippfehler',
            source: 'Tafel',
          },
          { personOparlId: 'p/gone', exclude: true, reason: 'Mandat nicht angetreten', source: 'OParl' },
          { personOparlId: 'p/jung', party: 'SPD', reason: 'nicht auf der Liste', source: 'OB-Wahl 2020' },
        ],
      }),
    );

    expect(file.persons.map((person) => [person.name, person.factionId, person.partyId])).toEqual([
      ['Christopher Zenker', 'spd', 'spd'],
      ['Burkhard Jung', 'oberbuergermeister', 'spd'],
    ]);
    expect(file.persons[1].partySource).toEqual({
      method: 'override',
      reason: 'nicht auf der Liste',
      source: 'OB-Wahl 2020',
    });
    expect(problems).toEqual([`2 members sit in the council on 2026-11-12, expected ${COUNCIL_SEATS}`]);
  });

  it('reports a member without party and an override for no member', () => {
    const { file, problems } = buildMembersFile(
      inputs({
        members: [member('p/new', 'Nora', 'Reinhardt')],
        overrides: [{ personOparlId: 'p/unknown', party: 'SPD', reason: 'x', source: 'y' }],
      }),
    );

    expect(file.persons).toEqual([]);
    expect(problems.slice(0, 2)).toEqual([
      'override for p/unknown: no council member of the period has this OParl ID',
      'Nora Reinhardt: no party: no candidate in the candidates list; add an override with party, reason and source',
    ]);
  });

  it('starts a membership on the session where the board shows the member, shortly before OParl', () => {
    const { file, problems } = buildMembersFile(
      inputs({
        members: [member('p/wittwer', 'Marius', 'Wittwer', { start: '2025-02-13' })],
        boardSessionDays: new Map([['p/wittwer', ['2025-02-12', '2025-03-26']]]),
      }),
    );

    expect(file.persons[0].start).toEqual('2025-02-12');
    expect(file.persons[0].factionMemberships[0].start).toEqual('2025-02-12');
    expect(problems.filter((problem) => problem.includes('voting board'))).toEqual([]);
  });

  it('reports a member on the board outside their membership', () => {
    const { problems } = buildMembersFile(
      inputs({
        members: [member('p/zenker', 'Christopher', 'Zenker', { end: '2025-01-31' })],
        boardSessionDays: new Map([['p/zenker', ['2025-03-26']]]),
      }),
    );

    expect(problems).toContain(
      'Christopher Zenker: on the voting board on 2025-03-26, outside the council membership 2024-09-18 to 2025-01-31',
    );
  });

  it('writes one row per faction membership', () => {
    const { file } = buildMembersFile(inputs({ members: [member('p/zenker', 'Christopher', 'Zenker')] }));

    expect(factionMembershipsToCsv(file)).toEqual(
      'personId,oparlId,factionId,start,end\nchristopher-zenker,p/zenker,spd,2024-09-18,\n',
    );
  });
});

describe('names', () => {
  it('shortens OParl faction names and builds IDs without umlauts', () => {
    expect(['Fraktion DIE LINKE', 'CDU-Fraktion', 'Die Freie Fraktion'].map(shortFactionName)).toEqual([
      'DIE LINKE',
      'CDU',
      'Die Freie Fraktion',
    ]);
    expect(slug('Bündnis 90/Die Grünen')).toEqual('buendnis-90-die-gruenen');
    expect(slug('Jörg Kühne')).toEqual('joerg-kuehne');
  });
});
