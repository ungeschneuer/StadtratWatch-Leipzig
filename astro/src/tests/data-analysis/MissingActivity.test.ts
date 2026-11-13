import { describe, expect, test } from 'vitest';
import { missingActivityOf } from '@data-analysis/MissingActivity.ts';
import type { RegistryPerson } from '@models/registry.ts';
import type { SessionInput } from '@models/SessionInput.ts';
import type { VoteCode } from '@models/Session.ts';

function session(date: string, votes: [string, VoteCode][] = []): SessionInput {
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

function person(name: string, end: string | null): RegistryPerson {
  return { id: name, name, factionId: 'f', partyId: 'p', start: null, end };
}

const sessions = [
  session('2025-12-17', [
    ['Aktiv', 'J'],
    ['Abwesend', 'O'],
  ]),
  session('2026-01-28'),
];

describe('missingActivityOf', () => {
  test('is nothing for a member who voted', () => {
    expect(missingActivityOf(person('Aktiv', null), sessions)).toBeNull();
  });

  test('explains a member who left before the first recorded session', () => {
    expect(
      missingActivityOf(person('Ehemalig', '2025-01-31'), sessions),
    ).toEqual({
      reason: 'left-before-recordings',
      end: '2025-01-31',
      firstRecordedSession: '2025-12-17',
    });
  });

  test('counts the recorded sessions of a member who voted in none of them', () => {
    expect(
      missingActivityOf(person('Abwesend', '2026-01-27'), sessions),
    ).toEqual({
      reason: 'no-vote-while-member',
      recordedSessions: 1,
    });
  });
});
