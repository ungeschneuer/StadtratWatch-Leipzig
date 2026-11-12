import { describe, expect, test } from 'vitest';
import {
  calcSeatsHistoryOfFaction,
  calcSeatsHistoryOfParty,
} from '@data-analysis/Seats.ts';
import type { Registry, RegistrySession } from '@models/registry.ts';
import type { SessionInput } from '@models/SessionInput.ts';

function session(date: string): SessionInput {
  const registrySession: RegistrySession = {
    id: date,
    date,
    title: 'Ratsversammlung',
    youtubeUrl: '',
    meetingMinutesUrl: null,
    approved: true,
  };
  return { session: registrySession, votings: [], speeches: [] };
}

const registry: Registry = {
  id: 'leipzig-8',
  name: 'Leipzig – Wahlperiode VIII',
  lastUpdate: '2026-11-12',
  sessions: [],
  factions: [
    { id: 'spd', name: 'SPD', seats: 1 },
    { id: 'cdu', name: 'CDU', seats: 1 },
  ],
  parties: [{ id: 'spd', name: 'SPD', seats: 2 }],
  persons: [
    {
      id: 'abraham',
      name: 'Getu Abraham',
      factionId: 'cdu',
      partyId: 'spd',
      start: null,
      end: null,
      factionMemberships: [
        { factionId: 'spd', start: '2024-09-18', end: '2024-11-08' },
        { factionId: 'cdu', start: '2024-11-09', end: null },
      ],
    },
    {
      id: 'zenker',
      name: 'Christopher Zenker',
      factionId: 'spd',
      partyId: 'spd',
      start: null,
      end: '2025-01-31',
    },
  ],
};

const sessions = ['2024-10-01', '2024-12-01', '2025-01-15', '2025-03-01'].map(
  session,
);

describe('Seats', () => {
  test('gives the seats of a faction on the sessions where they changed', () => {
    expect(
      calcSeatsHistoryOfFaction(registry, registry.factions[0], sessions),
    ).toEqual([
      { date: '2024-10-01', value: 2 },
      { date: '2024-12-01', value: 1 },
      { date: '2025-03-01', value: 0 },
    ]);
    expect(
      calcSeatsHistoryOfFaction(registry, registry.factions[1], sessions),
    ).toEqual([
      { date: '2024-10-01', value: 0 },
      { date: '2024-12-01', value: 1 },
    ]);
  });

  test('counts a party by the members sitting on the day', () => {
    expect(
      calcSeatsHistoryOfParty(registry, registry.parties[0], sessions),
    ).toEqual([
      { date: '2024-10-01', value: 2 },
      { date: '2025-03-01', value: 1 },
    ]);
  });
});
