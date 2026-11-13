import { describe, expect, it, vi } from 'vitest';
import type { SessionScanItem } from '@models/session-scan';
import { parliamentPeriodNumberOf, siteRoutes, votingSlugs } from './routes';

function voting(index: number, agendaItem: string): SessionScanItem {
  return {
    votingFilename: `2026-02-25-${String(index).padStart(3, '0')}.png`,
    videoTimestamp: '00:00:00',
    votingSubject: {
      agendaItem,
      motionId: '',
      title: '',
      type: null,
      authors: [],
    },
    votes: [],
  };
}

describe('siteRoutes', () => {
  it('builds German addresses below the base path', () => {
    vi.stubEnv('BASE_URL', '/StadtratWatch-Leipzig/');
    const routes = siteRoutes('leipzig-8');
    expect(routes.parliamentPeriod()).toBe(
      '/StadtratWatch-Leipzig/wahlperiode-8',
    );
    expect(routes.sessions()).toBe(
      '/StadtratWatch-Leipzig/wahlperiode-8/sitzungen',
    );
    expect(routes.voting('2026-03-25', '19.10')).toBe(
      '/StadtratWatch-Leipzig/wahlperiode-8/sitzung/2026-03-25/abstimmung/19.10',
    );
    expect(routes.person('getu-abraham')).toBe(
      '/StadtratWatch-Leipzig/wahlperiode-8/person/getu-abraham',
    );
    expect(routes.faction('cdu')).toBe(
      '/StadtratWatch-Leipzig/wahlperiode-8/fraktion/cdu',
    );
    expect(routes.party('cdu')).toBe(
      '/StadtratWatch-Leipzig/wahlperiode-8/partei/cdu',
    );
    vi.unstubAllEnvs();
  });

  it('refuses a parliament period without number', () => {
    expect(() => parliamentPeriodNumberOf('leipzig')).toThrow();
  });
});

describe('votingSlugs', () => {
  it('names a vote by its agenda item and counts on for further votes on the same item', () => {
    const slugs = votingSlugs([
      voting(30, '19.1'),
      voting(31, '19.1'),
      voting(32, '19.1'),
      voting(33, '19.1.1'),
    ]);
    expect([...slugs.values()]).toEqual(['19.1', '19.1-2', '19.1-3', '19.1.1']);
  });

  it('keeps the number in the session for a vote without agenda item', () => {
    expect([...votingSlugs([voting(19, '')]).values()]).toEqual(['nr-19']);
  });
});
