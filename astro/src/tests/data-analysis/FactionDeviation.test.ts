import { expect, test } from 'vitest';
import { calcFactionDeviationOfPerson } from '@data-analysis/FactionDeviation.ts';
import type { Registry, RegistryPerson } from '@models/registry.ts';
import type { SessionInput } from '@models/SessionInput.ts';
import type { VoteCode } from '@models/Session.ts';

function person(name: string, factionId: string): RegistryPerson {
  return { id: name, name, factionId, partyId: 'p', start: null, end: null };
}

const persons = [
  person('A', 'spd'),
  person('B', 'spd'),
  person('C', 'spd'),
  person('D', 'cdu'),
  person('E', 'cdu'),
  person('Allein', 'fraktionslos'),
];
const parliamentPeriod = { persons } as unknown as Registry;

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
      voting({ A: 'J', B: 'J', C: 'N', D: 'J', E: 'N', Allein: 'J' }),
      // A abstains while the faction votes yes: also a different vote.
      voting({ A: 'E', B: 'J', C: 'J', D: 'J', E: 'J', Allein: 'N' }),
      // A did not vote: not counted.
      voting({ A: 'O', B: 'N', C: 'N', D: 'J', E: 'J', Allein: 'N' }),
      voting({ A: 'J', B: 'J', C: 'J', D: 'J', E: 'J', Allein: 'J' }),
    ],
    speeches: [],
  },
];

test('counts the cast votes that differ from the majority of the own faction', () => {
  expect(
    calcFactionDeviationOfPerson(parliamentPeriod, persons[2], sessions),
  ).toEqual({ deviating: 1, counted: 4 });
  expect(
    calcFactionDeviationOfPerson(parliamentPeriod, persons[0], sessions),
  ).toEqual({ deviating: 1, counted: 3 });
});

test('a tie in the faction has no majority to deviate from', () => {
  // CDU: D yes, E no in the first vote.
  expect(
    calcFactionDeviationOfPerson(parliamentPeriod, persons[3], sessions),
  ).toEqual({ deviating: 0, counted: 3 });
});

test('has no value for members without faction', () => {
  expect(
    calcFactionDeviationOfPerson(parliamentPeriod, persons[5], sessions),
  ).toBeNull();
});
