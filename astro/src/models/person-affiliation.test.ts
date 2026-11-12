import { describe, expect, it } from 'vitest';
import {
  affiliationMembers,
  factionHistory,
  factionIdOn,
  partyHistory,
  partyIdOn,
} from './person-affiliation.ts';
import type { RegistryPerson } from './registry.ts';

const abraham: RegistryPerson = {
  id: 'getu-abraham',
  name: 'Prof. Dr. Getu Abraham',
  factionId: 'fraktionslos',
  partyId: 'spd',
  start: null,
  end: null,
  factionMemberships: [
    { factionId: 'spd', start: '2024-09-18', end: '2024-11-08' },
    { factionId: 'fraktionslos', start: '2024-11-09', end: '2025-03-12' },
    { factionId: 'cdu', start: '2025-03-13', end: '2026-09-22' },
    { factionId: 'fraktionslos', start: '2026-09-23', end: null },
  ],
};

const unchanged: RegistryPerson = {
  id: 'beate-bettecken',
  name: 'Dr. Beate Bettecken',
  factionId: 'cdu-fdp',
  partyId: 'cdu',
  start: null,
  end: '2026-04-15',
};

describe('factionIdOn', () => {
  it('gives the faction of the day', () => {
    expect(factionIdOn(abraham, '2024-10-01')).toEqual('spd');
    expect(factionIdOn(abraham, '2025-03-13')).toEqual('cdu');
    expect(factionIdOn(abraham, '2026-09-22')).toEqual('cdu');
    expect(factionIdOn(abraham, '2026-10-29')).toEqual('fraktionslos');
  });

  it('falls back to the one faction without history', () => {
    expect(factionIdOn(unchanged, '2025-01-01')).toEqual('cdu-fdp');
  });
});

describe('partyIdOn', () => {
  it('gives the party of the day and falls back without history', () => {
    const changed: RegistryPerson = {
      ...unchanged,
      partyId: 'parteilos',
      partyMemberships: [
        { partyId: 'cdu', start: '2024-07-08', end: '2025-06-30' },
        { partyId: 'parteilos', start: '2025-07-01', end: null },
      ],
    };

    expect(partyIdOn(changed, '2025-06-30')).toEqual('cdu');
    expect(partyIdOn(changed, '2025-07-01')).toEqual('parteilos');
    expect(partyIdOn(unchanged, '2025-07-01')).toEqual('cdu');
  });
});

describe('history', () => {
  it('lists every faction in order', () => {
    expect(factionHistory(abraham).map((period) => period.id)).toEqual([
      'spd',
      'fraktionslos',
      'cdu',
      'fraktionslos',
    ]);
  });

  it('gives one period with the membership dates without history', () => {
    expect(factionHistory(unchanged)).toEqual([
      { id: 'cdu-fdp', start: null, end: '2026-04-15' },
    ]);
    expect(partyHistory(unchanged)).toEqual([
      { id: 'cdu', start: null, end: '2026-04-15' },
    ]);
  });
});

describe('affiliationMembers', () => {
  it('lists former members after current ones and marks who changed', () => {
    const steady: RegistryPerson = {
      ...unchanged,
      id: 'a',
      name: 'Anna Albrecht',
      factionId: 'cdu',
      end: null,
    };
    const members = affiliationMembers(
      [abraham, unchanged, steady],
      factionHistory,
      'cdu',
    );

    expect(
      members.map(({ person, isCurrent, changed, periods }) => [
        person.name,
        isCurrent,
        changed,
        periods.length,
      ]),
    ).toEqual([
      ['Anna Albrecht', true, false, 1],
      ['Prof. Dr. Getu Abraham', false, true, 1],
    ]);
  });
});
