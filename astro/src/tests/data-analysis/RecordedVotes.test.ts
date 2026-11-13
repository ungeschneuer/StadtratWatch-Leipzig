import { expect, test } from 'vitest';
import {
  hasRecordedVote,
  personsWithRecordedVotes,
} from '@data-analysis/RecordedVotes.ts';
import type { Registry, RegistryPerson } from '@models/registry.ts';
import type { SessionInput } from '@models/SessionInput.ts';
import type { VoteCode } from '@models/Session.ts';

function session(date: string, votes: [string, VoteCode][]): SessionInput {
  return {
    session: {
      id: date,
      date,
      title: 'Ratsversammlung',
      youtubeUrl: '',
      meetingMinutesUrl: null,
      approved: true,
    },
    votings: [
      {
        votingFilename: `${date}-001.png`,
        videoTimestamp: '00:00:00',
        votingSubject: {
          agendaItem: '1',
          motionId: '',
          title: '',
          type: null,
          authors: [],
        },
        votes: votes.map(([name, vote]) => ({ name, vote })),
      },
    ],
    speeches: [],
  };
}

function person(name: string): RegistryPerson {
  return {
    id: name,
    name,
    factionId: 'f',
    partyId: 'p',
    start: null,
    end: null,
  };
}

const sessions = [
  session('2025-12-17', [
    ['Aktiv', 'J'],
    ['Enthalten', 'E'],
    ['Nur abwesend', 'O'],
  ]),
];

test('a yes, no or abstention is a recorded vote', () => {
  expect(hasRecordedVote(person('Aktiv'), sessions)).toBe(true);
  expect(hasRecordedVote(person('Enthalten'), sessions)).toBe(true);
});

test('being on the board without a vote, or not at all, is none', () => {
  expect(hasRecordedVote(person('Nur abwesend'), sessions)).toBe(false);
  expect(
    hasRecordedVote(person('Vor den Aufzeichnungen ausgeschieden'), sessions),
  ).toBe(false);
});

test('keeps only the members with a recorded vote, in their order', () => {
  const parliamentPeriod = {
    persons: [person('Nur abwesend'), person('Enthalten'), person('Aktiv')],
  } as Registry;
  expect(
    personsWithRecordedVotes(parliamentPeriod, sessions).map(
      (member) => member.name,
    ),
  ).toEqual(['Enthalten', 'Aktiv']);
});
