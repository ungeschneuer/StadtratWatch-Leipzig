import { expect, test } from 'vitest';
import { calcFactionAgreement } from '@data-analysis/FactionAgreement.ts';
import type { Registry, RegistryPerson } from '@models/registry.ts';
import type { SessionInput } from '@models/SessionInput.ts';
import type { VoteCode } from '@models/Session.ts';

function person(name: string, factionId: string): RegistryPerson {
  return { id: name, name, factionId, partyId: 'p', start: null, end: null };
}

const parliamentPeriod = {
  factions: [
    { id: 'spd', name: 'SPD', seats: 2 },
    { id: 'cdu', name: 'CDU', seats: 2 },
    { id: 'afd', name: 'AfD', seats: 1 },
    { id: 'fraktionslos', name: 'fraktionslos', seats: 1 },
  ],
  persons: [
    person('A', 'spd'),
    person('B', 'spd'),
    person('C', 'cdu'),
    person('D', 'cdu'),
    person('E', 'afd'),
    person('F', 'fraktionslos'),
  ],
} as unknown as Registry;

function voting(
  votes: Record<string, VoteCode>,
): SessionInput['votings'][number] {
  return {
    votingFilename: 'v.png',
    videoTimestamp: '00:00:00',
    votingSubject: {
      agendaItem: '1',
      motionId: '',
      title: '',
      type: null,
      authors: [],
    },
    votes: Object.entries(votes).map(([name, vote]) => ({ name, vote })),
  };
}

const sessions: SessionInput[] = [
  {
    session: {
      id: 's',
      date: '2026-01-28',
      title: '',
      youtubeUrl: '',
      meetingMinutesUrl: null,
      approved: true,
    },
    votings: [
      voting({ A: 'J', B: 'J', C: 'J', D: 'J', E: 'N', F: 'J' }),
      voting({ A: 'N', B: 'N', C: 'J', D: 'J', E: 'J', F: 'J' }),
      // CDU split evenly: no majority, the vote does not count for its pairs.
      voting({ A: 'J', B: 'J', C: 'J', D: 'N', E: 'J', F: 'N' }),
    ],
    speeches: [],
  },
];

test('compares the majorities of every pair of factions', () => {
  const agreement = calcFactionAgreement(parliamentPeriod, sessions);

  expect(agreement.factions.map((faction) => faction.id)).toEqual([
    'spd',
    'cdu',
    'afd',
  ]);
  expect(agreement.pair('spd', 'cdu')).toEqual({ agreeing: 1, counted: 2 });
  expect(agreement.pair('cdu', 'afd')).toEqual({ agreeing: 1, counted: 2 });
  expect(agreement.pair('spd', 'afd')).toEqual({ agreeing: 1, counted: 3 });
  expect(agreement.pair('afd', 'spd')).toEqual({ agreeing: 1, counted: 3 });
});
