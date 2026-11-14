import type { LeipzigMembersFile } from '@srw-astro/models/leipzig-members';
import type {
  PaperAncestor,
  SessionScan,
  SessionScanItem,
  UnresolvedVoting,
  VotingReviewStatus,
} from '@srw-astro/models/session-scan';
import { votingFilenameOf } from '@srw-astro/models/voting-evidence';

import type { LeipzigPaper, PapersFile } from '../leipzig-papers/voting-papers.ts';
import type { ExtractedVoting } from '../leipzig-votings/extract-session.ts';
import { majorityRequirementOf } from './majority-requirement.ts';
import { itemNumberOf, type MajorityOverride, majorityOverrideOf, type Recusal, recusalsOf } from './special-cases.ts';

// The board reading of these votes is confirmed or, while no official result is published, unchallenged; or a check
// failed and a reviewer has not decided yet. The last two are published with their review status, so the site can say
// how they get fixed. A vote a reviewer found cannot be settled is published with the board's votes and the official
// result. A vote found to be no valid result, or a procedural motion whose checks failed, stays off the site.
const PUBLISHED_STATUSES = new Set<ExtractedVoting['status']>([
  'verified',
  'corrected',
  'reviewed',
  'unresolved',
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
  recusals: Recusal[] = [],
  reviewCaseIndices: ReadonlySet<number> = new Set(),
  majorityOverrides: MajorityOverride[] = [],
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
      const agendaItemNumber = voting.heading.agendaItemNumber ?? voting.official?.agendaItemNumber ?? '';
      const majorityRequirement =
        majorityOverrideOf(majorityOverrides, sessionId, agendaItemNumber, itemNumberOf(voting)) ??
        majorityRequirementOf({
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
          ...oparlIdsOf(voting, paper),
          ...paperAncestorsOf(paper, papers),
          ...withItemNumber(itemNumberOf(voting)),
        },
        votes,
        presentMembers: voting.votes.filter((seat) => seat.attendance === 'present').length,
        ...(majorityRequirement ? { majorityRequirement } : {}),
        ...recusedPersonsOf(sessionId, voting, recusals, namesByOparlId, problems),
        ...unresolvedOf(voting, namesByOparlId),
        ...reviewStatusOf(voting),
        ...(reviewCaseIndices.has(voting.index) ? { reviewCase: true } : {}),
      };
    });
  return { scan, pending: votings.filter((voting) => PENDING_STATUSES.has(voting.status)).length, problems };
}

// A vote a reviewer could not settle completely: the votes they could assign are in the seats, the rest of the
// difference to the official result is published as unassigned. Added votes can only come from members who were
// present without a vote on the board, so they are named as possible voters.
function unresolvedOf(voting: ExtractedVoting, namesByOparlId: Map<string, string>): { unresolved?: UnresolvedVoting } {
  if (voting.status !== 'unresolved') return {};
  const reason = voting.review?.at(-1)?.reason ?? '';
  if (!voting.official) return { unresolved: { reason } };
  const officialCounts = { J: voting.official.J, N: voting.official.N, E: voting.official.E };
  const assigned = countVotes(voting);
  const unassignedCounts = {
    J: officialCounts.J - assigned.J,
    N: officialCounts.N - assigned.N,
    E: officialCounts.E - assigned.E,
  };
  const votesAdded = Object.values(unassignedCounts).some((count) => count > 0);
  const possibleVoters = votesAdded
    ? voting.votes
        .filter((seat) => seat.vote === 'O' && seat.attendance === 'present' && seat.personId)
        .flatMap((seat) => namesByOparlId.get(seat.personId as string) ?? [])
    : [];
  return {
    unresolved: {
      reason,
      officialCounts,
      unassignedCounts,
      ...(possibleVoters.length > 0 ? { possibleVoters } : {}),
    },
  };
}

function countVotes(voting: ExtractedVoting): { J: number; N: number; E: number } {
  const count = (code: 'J' | 'N' | 'E') => voting.votes.filter((seat) => seat.vote === code).length;
  return { J: count('J'), N: count('N'), E: count('E') };
}

function withItemNumber(itemNumber: string | undefined): { itemNumber?: string } {
  return itemNumber ? { itemNumber } : {};
}

// A member who declared a conflict of interest has no vote on the board; one who has points to a wrong entry.
function recusedPersonsOf(
  sessionId: string,
  voting: ExtractedVoting,
  recusals: Recusal[],
  namesByOparlId: Map<string, string>,
  problems: string[],
): { recusedPersons?: string[] } {
  const agendaItemNumber = voting.heading.agendaItemNumber ?? voting.official?.agendaItemNumber ?? '';
  const names = recusalsOf(recusals, sessionId, agendaItemNumber).flatMap((recusal) => {
    const name = namesByOparlId.get(recusal.personOparlId);
    const seat = voting.votes.find((vote) => vote.personId === recusal.personOparlId);
    if (!name) {
      problems.push(`recusals.json: ${recusal.personOparlId} is no member`);
      return [];
    }
    if (seat && seat.vote !== 'O') {
      problems.push(`${sessionId} #${voting.index}: ${name} is recused at ${agendaItemNumber} but voted ${seat.vote}`);
    }
    return [name];
  });
  return names.length > 0 ? { recusedPersons: names } : {};
}

// The board's sub-items (amendments such as 18.16.1) are not in OParl; their parent is no key of the vote.
function oparlIdsOf(
  voting: ExtractedVoting,
  paper: LeipzigPaper | undefined,
): { oparlAgendaItemId?: string; oparlPaperId?: string } {
  return {
    ...(voting.oparl && !voting.oparl.isParentAgendaItem ? { oparlAgendaItemId: voting.oparl.agendaItemId } : {}),
    ...(paper ? { oparlPaperId: paper.oparlId } : {}),
  };
}

// The chain of papers above the voted one, main paper first, so the site can show a paper's family: the original of a
// revision, the main paper of an amendment.
function paperAncestorsOf(
  paper: LeipzigPaper | undefined,
  papers: PapersFile | null,
): { paperAncestors?: PaperAncestor[] } {
  const ancestors: PaperAncestor[] = [];
  const seen = new Set<string>();
  let parentId = paper?.superordinatedPaperIds?.[0];
  while (parentId && papers?.papers[parentId] && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = papers.papers[parentId];
    ancestors.unshift({
      oparlPaperId: parent.oparlId,
      reference: parent.reference,
      name: parent.name,
      paperType: parent.paperType,
      ...(parent.web ? { paperUrl: parent.web } : {}),
    });
    parentId = parent.superordinatedPaperIds?.[0];
  }
  return ancestors.length > 0 ? { paperAncestors: ancestors } : {};
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
