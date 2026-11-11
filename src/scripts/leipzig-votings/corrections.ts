import type { VotingCorrection } from '@srw-astro/models/leipzig-review';
import { isVoteCode } from '@srw-astro/models/session';

import type { ExtractedVoting } from './extract-session.ts';

export type Correction = VotingCorrection;

export class CorrectionsError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join('\n'));
  }
}

// A rescan may shift a vote's start by a few seconds, so corrections address it by time within this tolerance.
const VIDEO_SECONDS_TOLERANCE = 15;

export function parseCorrections(json: unknown, source: string): Correction[] {
  if (!Array.isArray(json)) {
    throw new CorrectionsError([`${source}: expected a JSON array of corrections`]);
  }
  const problems: string[] = [];
  json.forEach((entry, index) => {
    const at = `${source} entry ${index}`;
    if (typeof entry?.voting?.videoSeconds !== 'number') problems.push(`${at}: voting.videoSeconds must be a number`);
    if (typeof entry?.reason !== 'string' || entry.reason.trim() === '') problems.push(`${at}: reason is required`);
    const changesSeats = Array.isArray(entry?.seats) && entry.seats.length > 0;
    if (!entry?.approve && !entry?.discard && !changesSeats && typeof entry?.agendaItemNumber !== 'string') {
      problems.push(`${at}: needs seats to change, an agendaItemNumber, "approve": true or "discard": true`);
    }
    if (entry?.discard && (entry?.approve || changesSeats)) {
      problems.push(`${at}: a discarded voting cannot also be approved or changed`);
    }
    for (const seat of Array.isArray(entry?.seats) ? entry.seats : []) {
      if (typeof seat?.personId !== 'string' || !isVoteCode(String(seat?.vote))) {
        problems.push(`${at}: every seat needs a personId and a vote of J, N, E or O`);
      }
    }
  });
  if (problems.length > 0) throw new CorrectionsError(problems);
  return json as Correction[];
}

// Corrections are applied to the board reading every time, so editing or deleting a correction takes effect on the
// next run and the board reading itself is never lost.
export function applyCorrections(votings: ExtractedVoting[], corrections: Correction[]): ExtractedVoting[] {
  const result = votings.map(restoreBoardReading);
  const problems: string[] = [];

  corrections.forEach((correction, index) => {
    const matches = result.filter((voting) => addresses(correction, voting));
    if (matches.length !== 1) {
      problems.push(
        `correction ${index} (${correction.voting.videoSeconds}s${correction.voting.agendaItemNumber ? `, TOP ${correction.voting.agendaItemNumber}` : ''}): ` +
          (matches.length === 0 ? 'matches no voting' : `matches ${matches.length} votings`),
      );
      return;
    }
    const voting = matches[0];
    for (const seat of correction.seats ?? []) {
      const vote = voting.votes.find((candidate) => candidate.personId === seat.personId);
      if (!vote) {
        problems.push(`correction ${index}: ${seat.personId} has no seat in voting #${voting.index}`);
        continue;
      }
      vote.boardVote ??= vote.vote;
      vote.boardAttendance ??= vote.attendance;
      vote.vote = seat.vote;
      if (seat.vote !== 'O') vote.attendance = 'present';
    }
    if (correction.agendaItemNumber) {
      voting.boardAgendaItemNumber ??= voting.heading.agendaItemNumber;
      voting.heading = { ...voting.heading, agendaItemNumber: correction.agendaItemNumber };
    }
    voting.status = correction.discard ? 'discarded' : 'reviewed';
    voting.review = [
      ...(voting.review ?? []),
      {
        reason: correction.reason,
        source: correction.source ?? null,
        reviewer: correction.reviewer ?? null,
        reviewedAt: correction.reviewedAt ?? null,
      },
    ];
  });

  if (problems.length > 0) throw new CorrectionsError(problems);
  return result;
}

function addresses(correction: Correction, voting: ExtractedVoting): boolean {
  const nearStart = Math.abs(voting.videoSeconds.start - correction.voting.videoSeconds) <= VIDEO_SECONDS_TOLERANCE;
  const sameAgendaItem =
    correction.voting.agendaItemNumber === undefined ||
    correction.voting.agendaItemNumber === voting.heading.agendaItemNumber;
  return nearStart && sameAgendaItem;
}

function restoreBoardReading(voting: ExtractedVoting): ExtractedVoting {
  const { review: _review, boardAgendaItemNumber, ...rest } = voting;
  return {
    ...rest,
    heading:
      boardAgendaItemNumber === undefined
        ? voting.heading
        : { ...voting.heading, agendaItemNumber: boardAgendaItemNumber },
    status: voting.checkStatus,
    votes: voting.votes.map(({ boardVote, boardAttendance, ...vote }) => {
      const board = { ...vote, vote: boardVote ?? vote.vote, attendance: boardAttendance ?? vote.attendance };
      // A member the Verlaufsprotokoll names as added by hand gets the official vote; the board reading is kept.
      const added = voting.official?.correction?.seats.find((seat) => seat.personId === vote.personId);
      if (!added) return board;
      return {
        ...board,
        vote: added.vote,
        attendance: added.vote === 'O' ? board.attendance : 'present',
        boardVote: board.vote,
        boardAttendance: board.attendance,
      };
    }),
  };
}
