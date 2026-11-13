import { isVoteCode, type VoteCode } from './Session.ts';
import { getVoteCounts } from './voting-breakdown.ts';

export type SessionScan = SessionScanItem[];

export type SessionScanItem = {
  votingFilename: string;
  videoTimestamp: string;
  votingSubject: SessionScanVotingSubject;
  votes: SessionScanVote[];
  majorityRequirement?: MajorityRequirement;
  presentMembers?: number;
  reviewStatus?: VotingReviewStatus;
  // Members who declared a conflict of interest (§ 20 SächsGemO, Befangenheit) and took no part, named as in votes.
  recusedPersons?: string[];
  // A reviewer found the vote cannot be settled: the votes are the board's, the outcome follows the official result.
  unresolved?: UnresolvedVoting;
};

export type UnresolvedVoting = {
  reason: string;
  officialCounts?: { J: number; N: number; E: number };
};

// A vote without a review status is final. The others are published while their check is not finished: a provisional
// vote passed every automatic check but its official result is not out yet; a vote in review failed a check and waits
// for a reviewer's decision.
export const votingReviewStatuses = ['provisional', 'needs-review'] as const;

export type VotingReviewStatus = (typeof votingReviewStatuses)[number];

export const majorityRequirements = [
  'simple',
  'majority-of-present',
  'two-thirds-of-present',
  'majority-of-members',
  'two-thirds-of-members',
  'three-quarters-of-members',
] as const;

export type MajorityRequirement = (typeof majorityRequirements)[number];

export function getMajorityRequirement(
  voting: SessionScanItem,
): MajorityRequirement {
  return voting.majorityRequirement ?? 'simple';
}

export const majorityRequirementDisplayNames: Record<
  MajorityRequirement,
  string
> = {
  simple: 'Einfache Mehrheit',
  'majority-of-present': 'Mehrheit der anwesenden Mitglieder',
  'two-thirds-of-present': 'Zwei Drittel der anwesenden Mitglieder',
  'majority-of-members': 'Mehrheit der Mitglieder',
  'two-thirds-of-members': 'Zwei Drittel der Mitglieder',
  'three-quarters-of-members': 'Drei Viertel der Mitglieder',
};

export function getQualifiedMajorityRequirementName(
  majorityRequirement: MajorityRequirement,
): string | undefined {
  return majorityRequirement === 'simple'
    ? undefined
    : majorityRequirementDisplayNames[majorityRequirement];
}

export function isMajorityRequirement(
  value: string,
): value is MajorityRequirement {
  return (majorityRequirements as readonly string[]).includes(value);
}

const requirementsMeasuredAgainstPresentMembers: readonly MajorityRequirement[] =
  ['majority-of-present', 'two-thirds-of-present'];

// Shared by the Astro schema and the script check so both reject the same scans.
export function findPresentMembersViolation(
  voting: SessionScanItem,
): string | undefined {
  if (
    voting.majorityRequirement &&
    requirementsMeasuredAgainstPresentMembers.includes(
      voting.majorityRequirement,
    ) &&
    voting.presentMembers === undefined
  ) {
    return `majority requirement "${voting.majorityRequirement}" needs presentMembers`;
  }

  const castVotes = countCastVotes(voting);
  if (
    voting.presentMembers !== undefined &&
    voting.presentMembers < castVotes
  ) {
    return `presentMembers ${voting.presentMembers} is below the ${castVotes} cast votes`;
  }

  return undefined;
}

export type SessionScanVotingSubject = {
  agendaItem: string;
  motionId: string;
  title: string;
  type: string | null; // TODO: remove null?
  authors: string[];
  paperUrl?: string;
  // Stable keys of the agenda item and the paper in the council's OParl, where the city publishes one.
  oparlAgendaItemId?: string;
  oparlPaperId?: string;
  // Set when the council voted on the points of a paper one by one: the point this vote decided („4“, „1 und 2“).
  itemNumber?: string;
};

export type SessionScanVote = {
  name: string;
  vote: VoteCode;
};

function countCastVotes(voting: SessionScanItem): number {
  const { J: yes, N: no, E: abstentions } = getVoteCounts(voting);
  return yes + no + abstentions;
}

// Scans are corrected by hand, so their JSON can hold values the type rules out.
export function assertValidSessionScan(
  sessionScan: SessionScan,
  source: string,
): void {
  for (const voting of sessionScan) {
    const violation = findVotingViolation(voting);
    if (violation) {
      throw new Error(`${source}: ${violation} in ${voting.votingFilename}`);
    }
  }
}

function findVotingViolation(voting: SessionScanItem): string | undefined {
  const unknownVote = voting.votes.find((vote) => !isVoteCode(vote.vote));
  if (unknownVote) {
    return `unknown vote code "${unknownVote.vote}" for ${unknownVote.name}`;
  }

  if (
    voting.majorityRequirement !== undefined &&
    !isMajorityRequirement(voting.majorityRequirement)
  ) {
    return `unknown majority requirement "${voting.majorityRequirement}"`;
  }

  if (
    voting.presentMembers !== undefined &&
    !Number.isInteger(voting.presentMembers)
  ) {
    return `presentMembers ${voting.presentMembers} is not a whole number`;
  }

  return findPresentMembersViolation(voting);
}
