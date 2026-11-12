import type { LeipzigMembersFile } from '@srw-astro/models/leipzig-members';
import type { SessionScan, SessionScanItem } from '@srw-astro/models/session-scan';

import type { ExtractedVoting } from '../leipzig-votings/extract-session.ts';

// The board reading of these votes is confirmed or, while no official result is published, unchallenged. A vote that
// waits for a human, was found to be no valid result, or is a procedural motion whose checks failed stays off the site
// until a reviewer decides it.
const PUBLISHED_STATUSES = new Set<ExtractedVoting['status']>(['verified', 'corrected', 'reviewed', 'provisional']);
const PENDING_STATUSES = new Set<ExtractedVoting['status']>(['needs-review', 'provisional']);

export type SessionScanResult = { scan: SessionScan; pending: number; problems: string[] };

export function toSessionScan(
  sessionId: string,
  votings: ExtractedVoting[],
  members: LeipzigMembersFile,
): SessionScanResult {
  const namesByOparlId = new Map(members.persons.map((person) => [person.oparlId, person.name]));
  const problems: string[] = [];
  const scan = votings
    .filter((voting) => PUBLISHED_STATUSES.has(voting.status))
    .map((voting): SessionScanItem => {
      const votes = voting.votes.flatMap((seat) => {
        const name = seat.personId ? namesByOparlId.get(seat.personId) : undefined;
        if (name) return [{ name, vote: seat.vote }];
        problems.push(`${sessionId} #${voting.index}: seat "${seat.boardName}" has no member in members.json`);
        return [];
      });
      return {
        votingFilename: `${sessionId}-${String(voting.index + 1).padStart(3, '0')}.png`,
        videoTimestamp: formatTimestamp(voting.videoSeconds.start),
        votingSubject: {
          agendaItem: voting.heading.agendaItemNumber ?? voting.official?.agendaItemNumber ?? '',
          motionId: paperReferenceOf(voting) ?? '',
          title: titleOf(voting),
          type: subjectType(voting),
          authors: [],
        },
        votes,
        presentMembers: voting.votes.filter((seat) => seat.attendance === 'present').length,
      };
    });
  return { scan, pending: votings.filter((voting) => PENDING_STATUSES.has(voting.status)).length, problems };
}

// The board names the paper voted on; OParl names the paper of the agenda item, which for an amendment is its parent.
function paperReferenceOf(voting: ExtractedVoting): string | null {
  const oparlPaper = voting.oparl && !voting.oparl.isParentAgendaItem ? voting.oparl.paperReference : null;
  return voting.heading.paperReference ?? oparlPaper ?? voting.official?.paperReference ?? null;
}

// The OParl name of the agenda item is the clean title; the board's heading is read by OCR and only stands in.
function titleOf(voting: ExtractedVoting): string {
  if (voting.oparl && !voting.oparl.isParentAgendaItem && voting.oparl.name) return voting.oparl.name;
  return voting.heading.title;
}

// The kinds StadtratWatch shows, from the Leipzig paper reference („VIII-A-01234-ÄA-02“).
export function subjectType(
  voting: Pick<ExtractedVoting, 'procedural'> & { heading: { paperReference: string | null } },
): string | null {
  if (voting.procedural) return 'Geschäftsordnung';
  const reference = voting.heading.paperReference;
  if (!reference) return null;
  if (/-ÄA-\d+/.test(reference)) return 'Änderungsantrag';
  const kind = reference.split('-')[1];
  if (kind === 'A') return 'Antrag';
  if (kind === 'DS') return 'Beschlussvorlage';
  return 'Sonstige';
}

export function formatTimestamp(seconds: number): string {
  const whole = Math.floor(seconds);
  return [Math.floor(whole / 3600), Math.floor((whole % 3600) / 60), whole % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}
