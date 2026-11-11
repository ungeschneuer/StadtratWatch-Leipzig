import type { AnnouncedResult } from './subtitle-announcements.ts';

export type Tally = { J: number; N: number; E: number; present: number; absent: number; unknown: number };

// settledByOfficialResult: the check failed on the board reading, but the official result settles it.
export type CheckResult = { check: string; passed: boolean; detail: string; settledByOfficialResult?: boolean };

export type VotingEvidence = {
  seatCount: number;
  expectedSeatCount: number;
  tally: Tally;
  readingsAgree: boolean;
  resultBars: { J: number | null; N: number | null; E: number | null };
  presentMembers: number | null;
  castVotes: number | null;
  unmatchedSeats: string[];
  agendaItemNumber: string | null;
  agendaItemKnown: boolean | null;
  agendaItemIsParent?: boolean;
  agendaItemMatchedByPaper?: boolean;
  oparlAgendaItemNumber?: string | null;
  boardParentPaperReference?: string | null;
  paperReference: string | null;
  oparlPaperReference: string | null;
  oparlResult: string | null;
  votingsOnAgendaItem: number;
  announced: AnnouncedResult | null;
  distinctFromPrevious: boolean | null;
  // How long the scan saw the result bars.
  resultPhaseSeconds?: number;
  // The chair called for this vote to be repeated before the next board.
  repeatCall?: { seconds: number; quote: string } | null;
};

// verified: the board equals the official result. corrected: the official result differs, and the Verlaufsprotokoll
// names the members added by hand. provisional: no official result yet; the board's checks and, where found, the
// spoken announcement agree. needs-review: a check failed. skipped: a check failed on a procedural motion, which is not
// reviewed. discarded: the board is no result of its own (a flash, a count in progress, a repeated or duplicated vote).
export type VotingStatus = 'verified' | 'corrected' | 'provisional' | 'needs-review' | 'skipped' | 'discarded';

// Every check compares the colour reading with an independent source: the board's own printed numbers, a second
// video frame, the OParl agenda, or the chair's spoken announcement.
export function checkVoting(evidence: VotingEvidence): { checks: CheckResult[]; status: VotingStatus } {
  const { tally } = evidence;
  const cast = tally.J + tally.N + tally.E;
  const checks: CheckResult[] = [
    {
      check: 'seats-complete',
      passed: evidence.seatCount === evidence.expectedSeatCount && tally.unknown === 0,
      detail: `${evidence.seatCount} seats of ${evidence.expectedSeatCount}, ${tally.unknown} unreadable`,
    },
    {
      check: 'second-frame-agrees',
      passed: evidence.readingsAgree,
      detail: evidence.readingsAgree ? 'two frames read identically' : 'two frames of the result differ',
    },
    resultBarsCheck(evidence, cast),
    {
      check: 'colours-match-cast-votes',
      passed: evidence.castVotes === cast,
      detail: `colours ${cast}, board says ${evidence.castVotes ?? 'unreadable'}`,
    },
    {
      check: 'seat-numbers-match-present-members',
      passed: evidence.presentMembers === cast + tally.present,
      detail: `numbered seats ${cast + tally.present}, board says ${evidence.presentMembers ?? 'unreadable'}`,
    },
    {
      check: 'names-match-roster',
      passed: evidence.unmatchedSeats.length === 0,
      detail: evidence.unmatchedSeats.length === 0 ? 'every seat matched' : evidence.unmatchedSeats.join('; '),
    },
    agendaItemCheck(evidence),
    ...finalResultChecks(evidence, cast),
  ];

  if (evidence.repeatCall) {
    checks.push({
      check: 'not-repeated',
      passed: false,
      detail: `the chair had the vote repeated: "${evidence.repeatCall.quote}"`,
    });
  }

  if (evidence.distinctFromPrevious !== null) {
    checks.push({
      check: 'distinct-from-previous',
      passed: evidence.distinctFromPrevious,
      detail: evidence.distinctFromPrevious
        ? 'same result as the previous vote, but the board was reset in between'
        : 'same board as the previous vote without a reset in between; possibly shown twice',
    });
  }

  if (evidence.paperReference && evidence.oparlPaperReference && !evidence.agendaItemIsParent) {
    checks.push({
      check: 'paper-matches-oparl',
      passed: samePaper(evidence.paperReference, evidence.oparlPaperReference),
      detail: `heading ${evidence.paperReference}, OParl ${evidence.oparlPaperReference}`,
    });
  }

  const expectedOutcome = outcomeOfOparlResult(evidence.oparlResult);
  if (expectedOutcome && evidence.votingsOnAgendaItem === 1 && !evidence.agendaItemIsParent) {
    const boardOutcome = tally.J > tally.N ? 'accepted' : 'rejected';
    checks.push({
      check: 'outcome-matches-oparl',
      passed: boardOutcome === expectedOutcome,
      detail: `board ${boardOutcome} (simple majority), OParl "${evidence.oparlResult}"`,
    });
  }

  if (evidence.announced) {
    const { J, N, E } = evidence.announced;
    checks.push({
      check: 'announcement-matches',
      passed: J === tally.J && N === tally.N && (E ?? tally.E) === tally.E && !evidence.announced.mentionsCorrection,
      detail: `announced ${J}/${N}/${E ?? '–'}${evidence.announced.mentionsCorrection ? ' with a spoken correction' : ''}: "${evidence.announced.quote}"`,
    });
  }

  if (!checks.every((check) => check.passed)) {
    return { checks, status: 'needs-review' };
  }
  return { checks, status: 'provisional' };
}

function outcomeOfOparlResult(result: string | null): 'accepted' | 'rejected' | null {
  if (!result) return null;
  const normalized = result.toLowerCase();
  if (/teilweise|punktweise|vertagt|zurück|verwiesen|kenntnis/.test(normalized)) return null;
  if (/abgelehnt/.test(normalized)) return 'rejected';
  if (/beschlossen|angenommen|zugestimmt/.test(normalized)) return 'accepted';
  return null;
}

function formatBars(bars: VotingEvidence['resultBars']): string {
  return (['J', 'N', 'E'] as const).map((vote) => bars[vote] ?? '?').join('/');
}

// OCR cannot tell the period numerals VII and VIII apart reliably, and papers from the previous period are still voted
// on. The serial number and suffixes identify the paper within an agenda item well enough.
function withoutPeriod(paperReference: string): string {
  return paperReference.replace(/^V[IVX]*-/, '');
}

// OParl leaves out the sub-items for amendments (18.16.1 under 18.16). Such a sub-item is accepted when the board's paper
// belongs to the same paper as the parent's: an amendment may refer to an earlier version (VIII-DS-01405-ÄA-01 under
// VIII-DS-01405-NF-01), so kind and serial number decide.
function agendaItemCheck(evidence: VotingEvidence): CheckResult {
  const heading = `heading TOP ${evidence.agendaItemNumber ?? 'unreadable'}`;
  if (evidence.agendaItemNumber === null || evidence.agendaItemKnown !== true) {
    return { check: 'agenda-item-in-oparl', passed: false, detail: heading };
  }
  if (evidence.agendaItemMatchedByPaper) {
    return {
      check: 'agenda-item-in-oparl',
      passed: true,
      detail: `${heading} is OParl TOP ${evidence.oparlAgendaItemNumber}, which has the board's paper ${evidence.paperReference}`,
    };
  }
  if (!evidence.agendaItemIsParent) {
    return { check: 'agenda-item-in-oparl', passed: true, detail: heading };
  }
  const parentPaper = evidence.oparlPaperReference ?? evidence.boardParentPaperReference ?? null;
  const parentSource = evidence.oparlPaperReference ? 'OParl' : 'board';
  const derived =
    evidence.paperReference !== null &&
    parentPaper !== null &&
    paperCore(evidence.paperReference) === paperCore(parentPaper);
  return {
    check: 'agenda-item-in-oparl',
    passed: derived,
    detail: `${heading} is not in OParl; paper ${evidence.paperReference ?? 'unreadable'} ${derived ? 'derives from' : 'does not derive from'} the parent's paper ${parentPaper ? `${parentPaper} (${parentSource})` : 'unknown'}`,
  };
}

function paperCore(paperReference: string): string {
  return withoutPeriod(paperReference).split('-').slice(0, 2).join('-');
}

// The longest bar always has the same length, so a misread number next to it cannot be caught by the bar lengths. If the
// bar numbers do not even add up to the cast votes, or one could not be read at all, the colours stand if both the cast
// votes and the spoken announcement confirm them.
function resultBarsCheck(evidence: VotingEvidence, cast: number): CheckResult {
  const { tally, resultBars, announced } = evidence;
  const detail = `colours ${tally.J}/${tally.N}/${tally.E}, bars ${formatBars(resultBars)}`;
  if ((['J', 'N', 'E'] as const).every((vote) => resultBars[vote] === tally[vote])) {
    return { check: 'colours-match-result-bars', passed: true, detail };
  }
  const barSum = (resultBars.J ?? 0) + (resultBars.N ?? 0) + (resultBars.E ?? 0);
  const unread = Object.values(resultBars).some((count) => count === null);
  const barsUnusable = unread || barSum !== evidence.castVotes;
  const confirmedElsewhere =
    evidence.castVotes === cast &&
    announced !== null &&
    !announced.mentionsCorrection &&
    announced.J === tally.J &&
    announced.N === tally.N &&
    (announced.E ?? tally.E) === tally.E;
  return barsUnusable && confirmedElsewhere
    ? {
        check: 'colours-match-result-bars',
        passed: true,
        detail: `${detail}; bar numbers ${unread ? 'unread' : `misread (sum ${barSum}, cast ${evidence.castVotes})`}, colours confirmed by cast votes and announcement`,
      }
    : { check: 'colours-match-result-bars', passed: false, detail };
}

// The board may still name the original paper where OParl links its revision (VIII-DS-02011 vs. VIII-DS-02011-NF-01).
// Two different revisions remain a mismatch.
export function samePaper(boardReference: string, oparlReference: string): boolean {
  const board = withoutPeriod(boardReference);
  const oparl = withoutPeriod(oparlReference);
  return board === oparl || (/^-NF-\d+$/.test(oparl.slice(board.length)) && oparl.startsWith(board));
}

// The board also shows bars while members are still voting. A final result stays up for at least a few seconds and
// carries the votes of most members present; a flash of bars or a board with only a handful of votes is a count in
// progress (12.12 with 3/2/0 on 2026-07-01) and needs a human look.
const MINIMUM_RESULT_PHASE_SECONDS = 1.5;
const MINIMUM_SHARE_OF_PRESENT_VOTING = 0.5;

function finalResultChecks(evidence: VotingEvidence, cast: number): CheckResult[] {
  const checks: CheckResult[] = [];
  if (evidence.resultPhaseSeconds !== undefined) {
    checks.push({
      check: 'result-shown-long-enough',
      passed: evidence.resultPhaseSeconds >= MINIMUM_RESULT_PHASE_SECONDS,
      detail: `result bars visible for ${evidence.resultPhaseSeconds}s`,
    });
  }
  if (evidence.presentMembers !== null && evidence.presentMembers > 0) {
    checks.push({
      check: 'most-present-members-voted',
      passed: cast >= evidence.presentMembers * MINIMUM_SHARE_OF_PRESENT_VOTING,
      detail: `${cast} votes from ${evidence.presentMembers} present`,
    });
  }
  return checks;
}
