import { describe, expect, it } from 'bun:test';

import type { Registry } from '@srw-astro/models/registry';
import type { SessionScanItem } from '@srw-astro/models/session-scan';

import { dataPackage, sessionsToCsv, votesToCsv, votingsToCsv } from './open-data.ts';

const registry: Registry = {
  id: 'leipzig-8',
  name: 'Wahlperiode VIII',
  lastUpdate: '2026-11-12',
  sessions: [
    {
      id: '2026-03-25',
      date: '2026-03-25',
      title: 'Ratsversammlung',
      youtubeUrl: '',
      video: { url: 'https://www.leipzig.de/mediathek/video/aufzeichnung', label: 'Mediathek' },
      meetingMinutesUrl: 'https://ratsinformation.leipzig.de/minutes',
      approved: true,
    },
  ],
  factions: [
    { id: 'cdu', name: 'CDU', seats: 36 },
    { id: 'spd', name: 'SPD', seats: 35 },
  ] as Registry['factions'],
  parties: [],
  persons: [
    {
      id: 'getu-abraham',
      name: 'Getu Abraham',
      factionId: 'fraktionslos',
      partyId: 'parteilos',
      start: null,
      end: null,
      factionMemberships: [
        { factionId: 'spd', start: '2024-09-18', end: '2024-11-08' },
        { factionId: 'fraktionslos', start: '2024-11-09', end: null },
      ],
    },
    { id: 'karsten-albrecht', name: 'Karsten Albrecht', factionId: 'cdu', partyId: 'cdu', start: null, end: null },
  ] as Registry['persons'],
};

const hauptsatzung: SessionScanItem = {
  votingFilename: '2026-03-25-029.png',
  videoTimestamp: '05:12:40',
  votingSubject: {
    agendaItem: '19.10',
    motionId: 'VIII-DS-02011-NF-01-DS-01',
    title: '5. Satzung zur Änderung der Hauptsatzung, „Bauturbo“',
    type: 'Beschlussvorlage',
    authors: ['Stadtplanungsamt'],
    paperUrl: 'https://ratsinformation.leipzig.de/vo020?VOLFDNR=1',
  },
  votes: [
    { name: 'Getu Abraham', vote: 'J' },
    { name: 'Karsten Albrecht', vote: 'O' },
  ],
  majorityRequirement: 'majority-of-members',
  presentMembers: 2,
  reviewStatus: 'provisional',
};

const scans = new Map([['2026-03-25', [hauptsatzung]]]);

describe('votingsToCsv', () => {
  it('writes one row per published vote with counts, requirement, result and check status', () => {
    expect(votingsToCsv(registry, scans)).toBe(
      'sessionId,votingId,agendaItem,paperReference,title,type,paperUrl,videoTimestamp,yes,no,abstentions,notVoted,presentMembers,majorityRequirement,result,reviewStatus\n' +
        '2026-03-25,2026-03-25-029,19.10,VIII-DS-02011-NF-01-DS-01,"5. Satzung zur Änderung der Hauptsatzung, „Bauturbo“",Beschlussvorlage,https://ratsinformation.leipzig.de/vo020?VOLFDNR=1,05:12:40,1,0,0,1,2,majority-of-members,rejected,provisional\n',
    );
  });
});

describe('votesToCsv', () => {
  it('writes one row per person and vote, with faction and party of the session day', () => {
    expect(votesToCsv(registry, scans)).toBe(
      'sessionId,votingId,personId,name,vote,factionId,partyId\n' +
        '2026-03-25,2026-03-25-029,getu-abraham,Getu Abraham,J,fraktionslos,parteilos\n' +
        '2026-03-25,2026-03-25-029,karsten-albrecht,Karsten Albrecht,O,cdu,cdu\n',
    );
  });
});

describe('sessionsToCsv', () => {
  it('writes one row per session with its sources and how many votes are published', () => {
    expect(sessionsToCsv(registry, scans)).toBe(
      'sessionId,date,title,approved,publishedVotings,videoUrl,meetingMinutesUrl,speechesSourceUrl\n' +
        '2026-03-25,2026-03-25,Ratsversammlung,true,1,https://www.leipzig.de/mediathek/video/aufzeichnung,https://ratsinformation.leipzig.de/minutes,\n',
    );
  });
});

describe('dataPackage', () => {
  const csvHeaders = {
    'votings.csv': votingsToCsv(registry, scans).split('\n')[0],
    'votes.csv': votesToCsv(registry, scans).split('\n')[0],
    'sessions.csv': sessionsToCsv(registry, scans).split('\n')[0],
  };
  const descriptor = dataPackage(registry, '2026-11-12');

  it('describes every column of the tables it writes, in their order', () => {
    for (const [path, header] of Object.entries(csvHeaders)) {
      const resource = descriptor.resources.find((candidate) => candidate.path === path);
      expect(resource?.schema.fields.map((field) => field.name).join(',')).toBe(header);
    }
  });

  it('names the city as source of the data it takes from OParl and the election list', () => {
    expect(descriptor.licenses.map((license) => license.name)).toEqual(['CC0-1.0', 'CC-BY-4.0', 'dl-de-by-2.0']);
    expect(descriptor.sources.map((source) => source.title).join(' ')).toContain('Stadt Leipzig');
  });
});
