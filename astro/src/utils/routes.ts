import type { SessionScanItem } from '@models/session-scan';
import { getVotingId } from '@models/voting-breakdown';
import { sitePath } from '@utils/site-path';

// The addresses of the site, in German and readable. The data keeps its own keys: the parliament period „leipzig-8“
// is „/wahlperiode-8“ here, persons, factions and parties keep the slugs of the registry.
export function parliamentPeriodNumberOf(parliamentPeriodId: string): string {
  const number = /(\d+)$/.exec(parliamentPeriodId)?.[1];
  if (!number)
    throw new Error(`parliament period „${parliamentPeriodId}“ has no number`);
  return number;
}

export function parliamentPeriodSegment(parliamentPeriodId: string): string {
  return `wahlperiode-${parliamentPeriodNumberOf(parliamentPeriodId)}`;
}

export function siteRoutes(parliamentPeriodId: string) {
  const base = `/${parliamentPeriodSegment(parliamentPeriodId)}`;
  return {
    parliamentPeriod: () => sitePath(base),
    sessions: () => sitePath(`${base}/sitzungen`),
    session: (sessionId: string) => sitePath(`${base}/sitzung/${sessionId}`),
    voting: (sessionId: string, votingSlug: string) =>
      sitePath(`${base}/sitzung/${sessionId}/abstimmung/${votingSlug}`),
    persons: () => sitePath(`${base}/personen`),
    person: (personId: string) => sitePath(`${base}/person/${personId}`),
    factions: () => sitePath(`${base}/fraktionen`),
    faction: (factionId: string) => sitePath(`${base}/fraktion/${factionId}`),
    parties: () => sitePath(`${base}/parteien`),
    party: (partyId: string) => sitePath(`${base}/partei/${partyId}`),
  };
}

export type SiteRoutes = ReturnType<typeof siteRoutes>;

// A vote is addressed by its agenda item, so the address says what was voted on: „19.10“. Several votes on one item
// (amendments, point by point) count on in the order of the session: „19.10-2“. Agenda item numbers have no hyphen, so
// the two never meet. A vote without agenda item (a procedural motion the board names only „ABSTIMMUNG“) keeps its
// number in the session: „nr-29“.
export function votingSlugs(votings: SessionScanItem[]): Map<string, string> {
  const seen = new Map<string, number>();
  const slugs = new Map<string, string>();
  for (const voting of votings) {
    const agendaItem = agendaItemKey(voting.votingSubject.agendaItem);
    if (!agendaItem) {
      slugs.set(voting.votingFilename, `nr-${getVotingId(voting)}`);
      continue;
    }
    const occurrence = (seen.get(agendaItem) ?? 0) + 1;
    seen.set(agendaItem, occurrence);
    slugs.set(
      voting.votingFilename,
      occurrence === 1 ? agendaItem : `${agendaItem}-${occurrence}`,
    );
  }
  return slugs;
}

export function votingSlugOf(
  votings: SessionScanItem[],
  voting: SessionScanItem,
): string {
  const slug = votingSlugs(votings).get(voting.votingFilename);
  if (!slug)
    throw new Error(`${voting.votingFilename} is not a vote of this session`);
  return slug;
}

function agendaItemKey(agendaItem: string): string {
  return agendaItem
    .trim()
    .toLowerCase()
    .replaceAll(/[^0-9a-z.]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
}
