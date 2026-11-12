import type { LeipzigMembersFile } from '@srw-astro/models/leipzig-members';
import type { SessionScan, SessionScanItem, VotingReviewStatus } from '@srw-astro/models/session-scan';
import { votingFilenameOf } from '@srw-astro/models/voting-evidence';

import type { LeipzigPaper, PapersFile } from '../leipzig-papers/voting-papers.ts';
import type { ExtractedVoting } from '../leipzig-votings/extract-session.ts';
import { majorityRequirementOf } from './majority-requirement.ts';

// The board reading of these votes is confirmed or, while no official result is published, unchallenged; or a check
// failed and a reviewer has not decided yet. The last two are published with their review status, so the site can say
// how they get fixed. A vote found to be no valid result, or a procedural motion whose checks failed, stays off the site.
const PUBLISHED_STATUSES = new Set<ExtractedVoting['status']>([
  'verified',
  'corrected',
  'reviewed',
  'provisional',
  'needs-review',
]);
const PENDING_STATUSES = new Set<ExtractedVoting['status']>(['needs-review', 'provisional']);

export type SessionScanResult = { scan: SessionScan; pending: number; problems: string[] };

export function toSessionScan(
  sessionId: string,
  votings: ExtractedVoting[],
  members: LeipzigMembersFile,
  papers: PapersFile | null = null,
): SessionScanResult {
  const namesByOparlId = new Map(members.persons.map((person) => [person.oparlId, person.name]));
  const problems: string[] = [];
  const scan = votings
    .filter((voting) => PUBLISHED_STATUSES.has(voting.status))
    .map((voting): SessionScanItem => {
      const paperId = papers?.votings[sessionId]?.[String(voting.index)];
      const paper = paperId ? papers?.papers[paperId] : undefined;
      const title = titleOf(voting);
      const motionId = paper?.reference || paperReferenceOf(voting) || '';
      const majorityRequirement = majorityRequirementOf({
        title,
        paperReference: motionId || null,
        procedural: voting.procedural ?? false,
      });
      const votes = voting.votes.flatMap((seat) => {
        const name = seat.personId ? namesByOparlId.get(seat.personId) : undefined;
        if (name) return [{ name, vote: seat.vote }];
        problems.push(`${sessionId} #${voting.index}: seat "${seat.boardName}" has no member in members.json`);
        return [];
      });
      return {
        votingFilename: votingFilenameOf(sessionId, voting.index),
        videoTimestamp: formatTimestamp(voting.videoSeconds.start),
        votingSubject: {
          agendaItem: voting.heading.agendaItemNumber ?? voting.official?.agendaItemNumber ?? '',
          motionId,
          title,
          type: subjectType(voting),
          authors: paper ? authorsOf(paper, members) : [],
          ...(paper?.web ? { paperUrl: paper.web } : {}),
        },
        votes,
        presentMembers: voting.votes.filter((seat) => seat.attendance === 'present').length,
        ...(majorityRequirement ? { majorityRequirement } : {}),
        ...reviewStatusOf(voting),
      };
    });
  return { scan, pending: votings.filter((voting) => PENDING_STATUSES.has(voting.status)).length, problems };
}

function reviewStatusOf(voting: ExtractedVoting): { reviewStatus: VotingReviewStatus } | Record<string, never> {
  if (voting.status === 'provisional' || voting.status === 'needs-review') return { reviewStatus: voting.status };
  return {};
}

// The board names the paper voted on; OParl names the paper of the agenda item, which for an amendment is its parent.
function paperReferenceOf(voting: ExtractedVoting): string | null {
  const oparlPaper = voting.oparl && !voting.oparl.isParentAgendaItem ? voting.oparl.paperReference : null;
  return voting.heading.paperReference ?? oparlPaper ?? voting.official?.paperReference ?? null;
}

// The site credits a motion to a faction by its name. OParl names the faction's office, and spells it differently from
// the faction („Geschäftsstelle der Fraktion Die Linke“ for „Fraktion DIE LINKE“, „BSW-Fraktion“ for „Fraktion BSW“,
// „Freien Fraktion“ for „Die Freie Fraktion“), so both are compared without these words and case. Offices of the
// administration keep their name without the number of the office („02.8 Dezernat Wirtschaft, Arbeit und Digitales“).
export function authorsOf(
  paper: Pick<LeipzigPaper, 'originators'>,
  members: Pick<LeipzigMembersFile, 'factions'>,
): string[] {
  return paper.originators.map(({ name }) => {
    const office = name.replace(/^Geschäftsstelle der\s+/, '');
    const faction = members.factions.find(
      (candidate) => candidate.oparlName !== null && factionKey(candidate.oparlName) === factionKey(office),
    );
    return faction?.name ?? office.replace(/^\d+(?:\.\d+)*\s+/, '');
  });
}

export function factionKey(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/\bfreien\b/g, 'freie')
    .replaceAll(/\b(?:fraktion|die)\b/g, '')
    .replaceAll(/[^\p{L}\d]/gu, '');
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
