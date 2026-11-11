import { describe, expect, it } from 'bun:test';

import type { ExtractedVoting } from './extract-session.ts';
import { sessionVotesToCsv, summarizeStatuses } from './session-votings-file.ts';

function voting(index: number, status: ExtractedVoting['status']): ExtractedVoting {
  return {
    index,
    videoSeconds: { start: 100 * index, end: 100 * index + 4, frames: [100 * index + 1] },
    heading: { raw: '', agendaItemNumber: '19.1', paperReference: null, title: '' },
    oparl: null,
    board: { presentMembers: 1, castVotes: 1, resultBars: { J: 1, N: 0, E: 0 } },
    tally: { J: 1, N: 0, E: 0, present: 0, absent: 0, unknown: 0 },
    announced: null,
    votes: [{ column: 0, row: 0, boardName: 'Stange, Enrico', personId: 'stange', vote: 'J', attendance: 'present' }],
    checks: [],
    checkStatus: 'verified',
    status,
  };
}

describe('session votings file', () => {
  const votings = [voting(0, 'verified'), voting(1, 'discarded')];

  it('leaves discarded votings out of the votes table', () => {
    const rows = sessionVotesToCsv('2026-10-29', votings).trim().split('\n');

    expect(rows).toHaveLength(2);
    expect(rows[1].startsWith('2026-10-29,0,')).toBe(true);
  });

  it('counts discarded votings in the summary', () => {
    expect(summarizeStatuses(votings)).toMatchObject({ votings: 2, verified: 1, discarded: 1 });
  });
});
