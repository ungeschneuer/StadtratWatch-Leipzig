import { expect, test } from 'vitest';
import { unassignedAfterChanges, type ReviewCase } from './leipzig-review';

// 30.09.2026 #18: „Herr Lehmann einen Rot dazu und ein Grün dazu, macht 52 zu 10 zu 0“ on a board of 51/9/0.
const reviewCase: Pick<ReviewCase, 'board' | 'official' | 'seats'> = {
  board: { J: 51, N: 9, E: 0, castVotes: 60, presentMembers: 66 },
  official: {
    J: 52,
    N: 10,
    E: 0,
    agendaItemNumber: '12.6.2',
    paperReference: null,
    procedural: false,
    sources: [],
    correction: null,
  },
  seats: [
    {
      column: 0,
      row: 0,
      boardName: 'Lehmann, Jens',
      personId: 'p/lehmann',
      vote: 'O',
      attendance: 'present',
    },
    {
      column: 0,
      row: 1,
      boardName: 'Nowak, Andreas',
      personId: 'p/nowak',
      vote: 'J',
      attendance: 'present',
    },
  ],
};

test('without changes the whole difference is unassigned', () => {
  expect(unassignedAfterChanges(reviewCase, [])).toEqual({ J: 1, N: 1, E: 0 });
});

test('a named vote leaves only the unnamed one', () => {
  expect(
    unassignedAfterChanges(reviewCase, [{ personId: 'p/lehmann', vote: 'N' }]),
  ).toEqual({ J: 1, N: 0, E: 0 });
});

test('changing a vote on the board moves it between the counts', () => {
  expect(
    unassignedAfterChanges(reviewCase, [{ personId: 'p/nowak', vote: 'N' }]),
  ).toEqual({ J: 2, N: 0, E: 0 });
});
