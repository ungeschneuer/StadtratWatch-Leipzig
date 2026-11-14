import { expect, test } from 'vitest';
import { calcParticipationRateOfPerson } from '@data-analysis/ParticipationRate.ts';
import type { RegistryPerson } from '@models/registry.ts';
import type { SessionInput } from '@models/SessionInput.ts';
import type { SessionScanItem } from '@models/session-scan.ts';

function voting(
  votes: SessionScanItem['votes'],
  unresolved?: SessionScanItem['unresolved'],
): SessionScanItem {
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
    votes,
    ...(unresolved ? { unresolved } : {}),
  };
}

const session: SessionInput = {
  session: {
    id: 's',
    date: '2026-09-30',
    title: 'Ratsversammlung',
    youtubeUrl: '',
    meetingMinutesUrl: null,
    approved: true,
  },
  votings: [
    voting([{ name: 'Lehmann', vote: 'J' }]),
    // One yes was counted by hand without a name; Lehmann was present without a vote and may have cast it.
    voting([{ name: 'Lehmann', vote: 'O' }], {
      reason: 'Ein Ja ohne Namen',
      officialCounts: { J: 1, N: 0, E: 0 },
      unassignedCounts: { J: 1, N: 0, E: 0 },
      possibleVoters: ['Lehmann'],
    }),
    voting([{ name: 'Lehmann', vote: 'O' }]),
  ],
  speeches: [],
};

const lehmann: RegistryPerson = {
  id: 'l',
  name: 'Lehmann',
  factionId: 'f',
  partyId: 'p',
  start: null,
  end: null,
};

test('a vote the member may have cast by hand does not count against the participation', () => {
  expect(calcParticipationRateOfPerson(lehmann, [session])).toBe(0.5);
});
