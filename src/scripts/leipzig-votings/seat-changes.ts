import type { VoteCode } from '@srw-astro/models/session';

import type { ExtractedVoting, SeatVote } from './extract-session.ts';

// Council members the chair names around the vote, by family name as printed on the board („Stange, Enrico“).
export function seatsNamedIn(text: string, seats: SeatVote[]): SeatVote[] {
  return seats.filter((seat) => {
    const familyName = seat.boardName
      .split(',')[0]
      .replace(/^(?:Prof\.\s*)?(?:Dr\.\s*)?/, '')
      .trim();
    // Also the genitive: „Herr Fiedlers Ja-Stimme“, „Frau Möbius' Abstimmgerät“.
    return (
      familyName.length >= 3 &&
      new RegExp(`(?<![\\p{L}])${escapeRegExp(familyName)}(?:s|')?(?![\\p{L}])`, 'u').test(text)
    );
  });
}

type SeatChange = { personId: string; boardName: string; vote: VoteCode };

// Named members are moved to the option the announcement has more of than the board, until the counts agree.
export function seatChangesForAnnouncement(
  voting: ExtractedVoting,
  announced: { J: number; N: number; E: number | null },
  namedSeats: SeatVote[],
): { changes: SeatChange[]; complete: boolean } {
  const missing = {
    J: announced.J - voting.tally.J,
    N: announced.N - voting.tally.N,
    E: (announced.E ?? voting.tally.E) - voting.tally.E,
  };
  const changes: SeatChange[] = [];
  for (const seat of namedSeats) {
    if (!seat.personId) continue;
    const from = seat.vote;
    const surplus = from !== 'O' && missing[from] < 0;
    // A named member is moved to an option the official result has more of; a vote the result does not count
    // („Herr Frommhold hat Frau Möbius' Abstimmgerät bedient“) is taken back.
    const target = (['J', 'N', 'E'] as const).find((code) => missing[code] > 0) ?? (surplus ? 'O' : undefined);
    if (!target) continue;
    if (from !== 'O' && !surplus) continue;
    if (target !== 'O') missing[target]--;
    if (from !== 'O') missing[from]++;
    changes.push({ personId: seat.personId, boardName: seat.boardName, vote: target });
  }
  return { changes, complete: Object.values(missing).every((count) => count === 0) };
}

function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
