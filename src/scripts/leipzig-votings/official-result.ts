import type { VoteCode } from '@srw-astro/models/session';

import type { ExtractedVoting } from './extract-session.ts';
import type { MinutesFile, MinutesVote } from './minutes.ts';
import { seatChangesForAnnouncement, seatsNamedIn } from './seat-changes.ts';
import type { SubtitleCue } from './subtitle-announcements.ts';
import type { VerlaufResult } from './verlaufsprotokoll.ts';
import { samePaper } from './voting-checks.ts';

// The order of sources, from what decides to what only helps:
// 1. The board is the only source for the vote of each person; its own checks decide whether it can be used.
// 2. The official result comes from the minutes (Beschlussprotokoll) or, until they appear, from the ALLRIS agenda item
//    pages; the Verlaufsprotokoll states the same results in the order of the session.
// 3. If the official result differs from the board, someone was added by hand. The Verlaufsprotokoll names who; the
//    seats it names become a correction when they explain the difference exactly.
// 4. The spoken announcement in the AI subtitles only stands in while no official result is published.

export type OfficialSource = {
  kind: MinutesFile['kind'] | 'verlaufsprotokoll';
  agendaItemNumbers: string[];
  paperReference: string | null;
  label: string;
  J: number;
  N: number;
  E: number;
};

export type OfficialResult = {
  J: number;
  N: number;
  E: number;
  agendaItemNumber: string | null;
  paperReference: string | null;
  procedural: boolean;
  sources: OfficialSource[];
  // Seats changed to reach the official result, with the words of the Verlaufsprotokoll that name them.
  // basis: named in the protocol or announcement, or inferred as the only members present without a vote.
  correction: {
    seats: { personId: string; boardName: string; vote: VoteCode }[];
    quote: string;
    basis: 'named' | 'only-non-voters';
  } | null;
};

export type OfficialSources = {
  minutes: { kind: MinutesFile['kind']; votes: MinutesVote[] } | null;
  verlauf: VerlaufResult[] | null;
  // The AI subtitles, to tell a procedural motion where no protocol says what was voted on.
  cues?: SubtitleCue[] | null;
};

// Checks the official result settles when it equals the board: the counts, the agenda item and paper, and that the
// board showed the final result. Reading checks (seats, names, second frame) stay.
const SETTLED_BY_OFFICIAL_RESULT = new Set([
  'colours-match-result-bars',
  'colours-match-cast-votes',
  'seat-numbers-match-present-members',
  'agenda-item-in-oparl',
  'paper-matches-oparl',
  'outcome-matches-oparl',
  'result-shown-long-enough',
  'most-present-members-voted',
  'not-repeated',
]);

const NEAR_DIFFERENCE = 2;

export function applyOfficialResults(votings: ExtractedVoting[], sources: OfficialSources): ExtractedVoting[] {
  const cleared = votings.map(withoutOfficialResult);
  const verlaufMatches = sources.verlauf ? alignVerlauf(cleared, sources.verlauf) : new Map<number, VerlaufResult>();
  const minutesMatches = sources.minutes
    ? matchMinutes(cleared, sources.minutes.votes, verlaufMatches)
    : new Map<number, MinutesVote>();
  return cleared.map((voting, position) =>
    withStatus(
      withProcedural(
        withOfficialResult(
          voting,
          minutesMatches.get(voting.index) ?? null,
          sources.minutes?.kind ?? null,
          verlaufMatches.get(voting.index) ?? null,
        ),
        verlaufMatches.get(voting.index)?.context ?? spokenBefore(sources.cues ?? null, cleared, position),
      ),
    ),
  );
}

// --- Verlaufsprotokoll: both lists follow the course of the session, so they are aligned in order. ---

const ALIGN_SKIP = -2;

export function alignVerlauf(votings: ExtractedVoting[], results: VerlaufResult[]): Map<number, VerlaufResult> {
  const rows = votings.length;
  const columns = results.length;
  const score: number[][] = Array.from({ length: rows + 1 }, (_, row) =>
    Array.from({ length: columns + 1 }, (_, column) => (row + column) * ALIGN_SKIP),
  );
  for (let row = 1; row <= rows; row++) {
    for (let column = 1; column <= columns; column++) {
      score[row][column] = Math.max(
        score[row - 1][column] + ALIGN_SKIP,
        score[row][column - 1] + ALIGN_SKIP,
        score[row - 1][column - 1] + pairScore(votings[row - 1], results[column - 1]),
      );
    }
  }
  const matches = new Map<number, VerlaufResult>();
  for (let row = rows, column = columns; row > 0 && column > 0;) {
    const pair = pairScore(votings[row - 1], results[column - 1]);
    if (pair > 0 && score[row][column] === score[row - 1][column - 1] + pair) {
      matches.set(votings[row - 1].index, results[column - 1]);
      row--;
      column--;
    } else if (score[row][column] === score[row - 1][column] + ALIGN_SKIP) row--;
    else column--;
  }
  return matches;
}

function pairScore(voting: ExtractedVoting, result: VerlaufResult): number {
  const difference = countDifference(voting, result);
  if (difference > NEAR_DIFFERENCE) return Number.NEGATIVE_INFINITY;
  const counts = difference === 0 ? 10 : 6 - difference;
  const board = voting.heading.agendaItemNumber;
  if (!board || result.agendaItemNumbers.length === 0) return counts;
  return counts + (result.agendaItemNumbers.some((number) => related(number, board)) ? 3 : -4);
}

// --- Minutes: matched by structure first (agenda item, paper), then by counts. ---

export function matchMinutes(
  votings: ExtractedVoting[],
  minutes: MinutesVote[],
  verlaufMatches: Map<number, VerlaufResult>,
): Map<number, MinutesVote> {
  const used = new Set<number>();
  const matches = new Map<number, MinutesVote>();
  for (const allowedDifference of [0, NEAR_DIFFERENCE]) {
    votings.forEach((voting, position) => {
      if (matches.has(voting.index)) return;
      const agendaItems = agendaItemsOf(voting, votings, position, verlaufMatches.get(voting.index));
      const candidate = minutes.find(
        (vote) =>
          !used.has(vote.order) &&
          countDifference(voting, vote) <= allowedDifference &&
          fitsStructure(voting, vote, agendaItems, allowedDifference > 0),
      );
      if (candidate) {
        used.add(candidate.order);
        matches.set(voting.index, candidate);
      }
    });
  }
  return matches;
}

type AgendaItems = { numbers: string[]; strict: boolean };

// The agenda items a board can belong to: its own heading; without heading, the items the Verlaufsprotokoll places it
// under, or else the items of the neighbouring votes.
function agendaItemsOf(
  voting: ExtractedVoting,
  votings: ExtractedVoting[],
  position: number,
  verlauf: VerlaufResult | undefined,
): AgendaItems {
  const own = [voting.heading.agendaItemNumber, voting.oparl?.number ?? null].filter(
    (number): number is string => number !== null,
  );
  if (own.length > 0) return { numbers: own, strict: true };
  if (verlauf && verlauf.agendaItemNumbers.length > 0) return { numbers: verlauf.agendaItemNumbers, strict: true };
  const previous = votings.slice(0, position).findLast(hasAgendaItem)?.heading.agendaItemNumber ?? null;
  const next = votings.slice(position + 1).find(hasAgendaItem)?.heading.agendaItemNumber ?? null;
  return { numbers: [previous, next].filter((number): number is string => number !== null), strict: false };
}

function fitsStructure(voting: ExtractedVoting, vote: MinutesVote, agendaItems: AgendaItems, near: boolean): boolean {
  const samePaperReference =
    voting.heading.paperReference !== null &&
    vote.paperReference !== null &&
    samePaper(voting.heading.paperReference, vote.paperReference);
  if (samePaperReference) return true;
  // A near result is only taken for the very item: on a parent item another vote's counts often lie close.
  if (near && hasAgendaItem(voting)) return agendaItems.numbers.includes(vote.agendaItemNumber);
  if (agendaItems.numbers.some((number) => related(number, vote.agendaItemNumber))) return true;
  // A board without heading and without Verlaufsprotokoll can still be a procedural motion of the neighbouring items.
  return !agendaItems.strict && vote.procedural && !near;
}

// --- Decision ---

function withOfficialResult(
  voting: ExtractedVoting,
  minutes: MinutesVote | null,
  minutesKind: MinutesFile['kind'] | null,
  verlauf: VerlaufResult | null,
): ExtractedVoting {
  if (!minutes && !verlauf) return voting;
  const sources: OfficialSource[] = [];
  if (minutes && minutesKind) {
    sources.push({
      kind: minutesKind,
      agendaItemNumbers: [minutes.agendaItemNumber],
      paperReference: minutes.paperReference,
      label: minutes.label,
      J: minutes.J,
      N: minutes.N,
      E: minutes.E,
    });
  }
  if (verlauf) {
    sources.push({
      kind: 'verlaufsprotokoll',
      agendaItemNumbers: verlauf.agendaItemNumbers,
      paperReference: null,
      label: verlauf.line,
      J: verlauf.J,
      N: verlauf.N,
      E: verlauf.E,
    });
  }
  const decisive = sources[0];
  const official = { J: decisive.J, N: decisive.N, E: decisive.E };
  const checks = [...voting.checks];

  if (sources.length === 2) {
    const agree = sources[0].J === sources[1].J && sources[0].N === sources[1].N && sources[0].E === sources[1].E;
    checks.push({
      check: 'official-sources-agree',
      passed: agree,
      detail: sources.map((source) => `${source.kind} ${source.J}/${source.N}/${source.E}`).join(', '),
    });
  }

  const boardMatches = voting.tally.J === official.J && voting.tally.N === official.N && voting.tally.E === official.E;
  const correction = boardMatches
    ? null
    : (correctionFromNames(voting, official, verlauf) ?? correctionFromNonVoters(voting, official));
  const where = minutes
    ? `TOP ${minutes.agendaItemNumber}${minutes.paperReference ? ` (${minutes.paperReference})` : ''}`
    : `TOP ${verlauf?.agendaItemNumbers.join('/') || '?'}`;
  checks.push({
    check: 'matches-official',
    passed: boardMatches || correction !== null,
    detail: boardMatches
      ? `official ${official.J}/${official.N}/${official.E} for ${where}`
      : correction
        ? `official ${official.J}/${official.N}/${official.E} for ${where}; added by hand: ${correction.seats.map((seat) => `${seat.boardName} ${seat.vote}`).join(', ')}`
        : `official ${official.J}/${official.N}/${official.E} for ${where} differs from the board`,
  });

  return {
    ...voting,
    official: {
      ...official,
      agendaItemNumber:
        minutes?.agendaItemNumber ?? (verlauf?.agendaItemNumbers.length === 1 ? verlauf.agendaItemNumbers[0] : null),
      paperReference: minutes?.paperReference ?? null,
      procedural: minutes?.procedural ?? false,
      sources,
      correction,
    },
    checks: checks.map((check) =>
      settles(check.check, boardMatches || correction !== null) && !check.passed
        ? {
            ...check,
            passed: true,
            settledByOfficialResult: true,
            detail: `${check.detail}; settled by the official result`,
          }
        : check,
    ),
  };
}

// The announcement only stands in for the official result; once that is there, a differing announcement is settled.
function settles(check: string, resultAccepted: boolean): boolean {
  if (check === 'announcement-matches') return true;
  return resultAccepted && SETTLED_BY_OFFICIAL_RESULT.has(check);
}

// Who was added by hand: the Verlaufsprotokoll names them („Frau Nagel noch nicht. Es kommt einmal Rot dazu.“); until
// it is there, the announcement in the subtitles may („Herr Stange wird hinzugezählt“). Only names that explain the
// whole difference become a correction.
function correctionFromNames(
  voting: ExtractedVoting,
  official: { J: number; N: number; E: number },
  verlauf: VerlaufResult | null,
): OfficialResult['correction'] {
  const texts = [verlauf?.context, voting.announced?.quote].filter((text): text is string => Boolean(text));
  for (const text of texts) {
    const named = seatsNamedIn(text, voting.votes);
    const { changes, complete } = seatChangesForAnnouncement(voting, official, named);
    // Only an unambiguous text corrects: as many named members who could have been added or taken back as changes.
    // „Herr Frommhold hat Frau Möbius' Abstimmgerät bedient“ names two who voted for one vote too many.
    const eligible = named.filter(
      (seat) => seat.vote === 'O' || countFor(official, seat.vote) < countFor(voting.tally, seat.vote),
    );
    if (complete && changes.length > 0 && eligible.length === changes.length) {
      return { seats: changes, quote: text.slice(-240), basis: 'named' };
    }
  }
  return null;
}

const OFFICIAL_CHECKS = new Set(['matches-official', 'official-sources-agree']);

// Nobody named, but exactly as many members are present without a vote as the official result has more: they are the
// ones added by hand. Only additions are inferred; a vote taken back always needs a name.
function correctionFromNonVoters(
  voting: ExtractedVoting,
  official: { J: number; N: number; E: number },
): OfficialResult['correction'] {
  const missing = [official.J - voting.tally.J, official.N - voting.tally.N, official.E - voting.tally.E];
  if (missing.some((count) => count < 0)) return null;
  const added = missing.reduce((sum, count) => sum + count, 0);
  const nonVoters = voting.votes.filter((seat) => seat.vote === 'O' && seat.attendance === 'present' && seat.personId);
  if (added === 0 || nonVoters.length !== added) return null;
  const { changes, complete } = seatChangesForAnnouncement(voting, official, nonVoters);
  if (!complete) return null;
  return {
    seats: changes,
    quote: `Nur ${nonVoters.map((seat) => seat.boardName).join(', ')} anwesend ohne Stimme`,
    basis: 'only-non-voters',
  };
}

function countFor(counts: { J: number; N: number; E: number }, vote: VoteCode): number {
  return vote === 'O' ? 0 : counts[vote];
}

function withoutOfficialResult(voting: ExtractedVoting): ExtractedVoting {
  const { official: _official, procedural: _procedural, ...rest } = voting;
  return {
    ...rest,
    // The official result is decided on the board reading, not on seats an earlier run or a reviewer changed.
    votes: voting.votes.map(({ boardVote, boardAttendance, ...vote }) => ({
      ...vote,
      vote: boardVote ?? vote.vote,
      attendance: boardAttendance ?? vote.attendance,
    })),
    checks: voting.checks
      .filter((check) => !OFFICIAL_CHECKS.has(check.check))
      .map(({ settledByOfficialResult, ...check }) =>
        settledByOfficialResult ? { ...check, passed: false, detail: withoutSettledNote(check.detail) } : check,
      ),
  };
}

// The note is added each time the official result settles a check, so it is removed before the result is applied
// again. „minutes confirm the board“ is the same note as written by earlier versions.
const SETTLED_NOTE = /(?:; (?:settled by the official result|minutes confirm the board))+$/;

export function withoutSettledNote(detail: string): string {
  return detail.replace(SETTLED_NOTE, '');
}

// verified: the board equals the official result; corrected: the Verlaufsprotokoll explains the difference;
// provisional: no official result yet, the board and, if found, the announcement agree.
// Boards that are no result of their own are discarded: bars that only flashed up or a count in progress, a vote the
// chair had repeated (the repetition counts), and the same board shown twice. An official result that equals the
// board settles these checks first, so a real result is never discarded.
const NO_RESULT_OF_ITS_OWN = new Set([
  'result-shown-long-enough',
  'most-present-members-voted',
  'not-repeated',
  'distinct-from-previous',
]);

function withStatus(voting: ExtractedVoting): ExtractedVoting {
  const failed = voting.checks.filter((check) => !check.passed).map((check) => check.check);
  const discarded = failed.some((check) => NO_RESULT_OF_ITS_OWN.has(check));
  const checkStatus = discarded
    ? 'discarded'
    : failed.length > 0
      ? voting.procedural
        ? 'skipped'
        : 'needs-review'
      : voting.official
        ? voting.official.correction
          ? 'corrected'
          : 'verified'
        : 'provisional';
  return { ...voting, checkStatus, status: checkStatus };
}

// Procedural motions (postponement, closing the debate, order of the agenda) are not reviewed. The minutes mark them;
// a board without heading counts as one when the chair calls the vote with such words.
const PROCEDURAL_CALL =
  /Geschäftsordnung|Geschäftsantrag|Vertagung|vertagen|verschieben|verlegen|Absetzung|absetzen|Rückverweis|zurückverweis|Rednerliste|Redezeit|Ende der Debatte|Schluss der Debatte|Schließung der Debatte|unterbrechen|Unterbrechung|Fragestunde|Anfragestunde|Reihenfolge|TO-Antrag/i;
const CALL_CHARACTERS = 300;

function withProcedural(voting: ExtractedVoting, spoken: string | null): ExtractedVoting {
  const byMinutes = voting.official?.procedural === true;
  const byCall = !hasAgendaItem(voting) && spoken !== null && PROCEDURAL_CALL.test(spoken.slice(-CALL_CHARACTERS));
  return byMinutes || byCall ? { ...voting, procedural: true } : voting;
}

// What was said between the previous board and this one, from the subtitles.
function spokenBefore(cues: SubtitleCue[] | null, votings: ExtractedVoting[], position: number): string | null {
  if (!cues) return null;
  const from = votings[position - 1]?.videoSeconds.end ?? 0;
  const to = votings[position].videoSeconds.start;
  const text = cues
    .filter((cue) => cue.startSeconds >= from && cue.startSeconds <= to)
    .map((cue) => cue.text)
    .join(' ');
  return text || null;
}

function hasAgendaItem(voting: ExtractedVoting): boolean {
  return voting.heading.agendaItemNumber !== null;
}

function countDifference(voting: ExtractedVoting, counts: { J: number; N: number; E: number }): number {
  return (
    Math.abs(voting.tally.J - counts.J) + Math.abs(voting.tally.N - counts.N) + Math.abs(voting.tally.E - counts.E)
  );
}

// The same item, or one is a sub-item of the other (the board's 19.5.3 under the minutes' 19.5).
function related(a: string, b: string): boolean {
  return a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);
}
