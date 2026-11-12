import { describe, expect, it } from 'bun:test';

import type { LeipzigMembersFile } from '@srw-astro/models/leipzig-members';

import type { Recording } from '../leipzig-recordings/recordings-manifest.ts';
import { buildRegistry } from './registry.ts';

const members = {
  generatedAt: '2026-11-12T09:00:00.000Z',
  factions: [{ id: 'spd', name: 'SPD', seats: 7, oparlId: 'org/spd', oparlName: 'SPD-Fraktion' }],
  parties: [{ id: 'spd', name: 'SPD', seats: 9 }],
  persons: [
    {
      id: 'christopher-zenker',
      name: 'Christopher Zenker',
      factionId: 'spd',
      partyId: 'spd',
      start: null,
      end: '2025-01-31',
      oparlId: 'p/zenker',
      familyName: 'Zenker',
      givenName: 'Christopher',
      factionMemberships: [{ factionId: 'spd', start: '2024-09-18', end: '2025-01-31' }],
      partyMemberships: [
        {
          partyId: 'spd',
          start: '2024-09-18',
          end: '2025-01-31',
          source: { method: 'election-list', match: 'name', listName: 'SPD' },
        },
      ],
      partySource: { method: 'election-list', match: 'name', listName: 'SPD' },
    },
  ],
} as unknown as LeipzigMembersFile;

function recording(date: string, goneSince: string | null = null): Recording {
  return {
    sessionId: date,
    date,
    meetingName: 'Ratsversammlung',
    mediathekUrl: `https://www.leipzig.de/mediathek/video/${date}`,
    playerUrl: `https://player/${date}.html`,
    goneSince,
  } as Recording;
}

describe('buildRegistry', () => {
  const registry = buildRegistry({ id: 'leipzig-8', name: 'Leipzig – Wahlperiode VIII' }, members, [
    { recording: recording('2026-10-29'), pendingVotings: 1, meetingMinutesUrl: null, speechesSourceUrl: null },
    {
      recording: recording('2025-12-17', '2026-12-20'),
      pendingVotings: 0,
      meetingMinutesUrl: 'https://ratsinfo/x.pdf',
      speechesSourceUrl: 'https://ratsinfo/to010?SILFDNR=1',
    },
  ]);

  it('lists the sessions in date order, approved once nothing is pending, with the source of their speeches', () => {
    expect(registry.sessions).toEqual([
      {
        id: '2025-12-17',
        date: '2025-12-17',
        title: 'Ratsversammlung',
        youtubeUrl: '',
        meetingMinutesUrl: 'https://ratsinfo/x.pdf',
        approved: true,
        speechesSource: {
          label: 'Verlaufsprotokoll der Ratsversammlung, Stadt Leipzig',
          url: 'https://ratsinfo/to010?SILFDNR=1',
        },
      },
      {
        id: '2026-10-29',
        date: '2026-10-29',
        title: 'Ratsversammlung',
        youtubeUrl: '',
        video: {
          url: 'https://www.leipzig.de/mediathek/video/2026-10-29',
          label: 'Mediathek',
          playerUrl: 'https://player/2026-10-29.html',
        },
        meetingMinutesUrl: null,
        approved: false,
      },
    ]);
  });

  it('keeps the registry fields of members with their history, without the sources', () => {
    expect(registry.persons).toEqual([
      {
        id: 'christopher-zenker',
        name: 'Christopher Zenker',
        factionId: 'spd',
        partyId: 'spd',
        start: null,
        end: '2025-01-31',
        factionMemberships: [{ factionId: 'spd', start: '2024-09-18', end: '2025-01-31' }],
        partyMemberships: [{ partyId: 'spd', start: '2024-09-18', end: '2025-01-31' }],
      },
    ]);
    expect(registry.factions).toEqual([{ id: 'spd', name: 'SPD', seats: 7 }]);
    expect(registry.lastUpdate).toEqual('2026-11-12T00:00:00Z');
  });
});
