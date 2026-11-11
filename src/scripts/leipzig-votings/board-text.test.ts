import { describe, expect, it } from 'bun:test';

import type { ResultBar } from './board-reader.ts';
import {
  CAST_VOTES_LABEL,
  discardCountsContradictingBarLengths,
  findNumberAfter,
  inferUnreadCountsFromBarLengths,
  parseBarCount,
  plausibleCount,
} from './board-text.ts';

function bar(vote: ResultBar['vote'], length: number): ResultBar {
  return { vote, top: 0, bottom: 30, left: 342, right: 342 + length - 1 };
}

// Lengths of the 46/11/1 vote on 2026-10-29: 18.3 px per vote.
const bars = [bar('J', 843), bar('N', 201), bar('E', 18)];

describe('discardCountsContradictingBarLengths', () => {
  it('keeps counts that fit the bar lengths', () => {
    expect(discardCountsContradictingBarLengths({ J: 46, N: 11, E: 1 }, bars)).toEqual({ J: 46, N: 11, E: 1 });
  });

  it('discards a misread count', () => {
    expect(discardCountsContradictingBarLengths({ J: 46, N: 1, E: 1 }, bars)).toEqual({ J: 46, N: null, E: 1 });
    expect(discardCountsContradictingBarLengths({ J: 46, N: 11, E: 7 }, bars)).toEqual({ J: 46, N: 11, E: null });
  });

  it('cannot check without the count of the longest bar', () => {
    expect(discardCountsContradictingBarLengths({ J: null, N: 11, E: 7 }, bars)).toEqual({ J: null, N: 11, E: 7 });
  });
});

describe('inferUnreadCountsFromBarLengths', () => {
  it('derives a missing count from its bar length', () => {
    // 56/5/0 on 2025-12-17: the lone 5 was not recognised.
    const shortBar = [bar('J', 938), bar('N', 82)];

    expect(inferUnreadCountsFromBarLengths({ J: 56, N: null, E: 0 }, shortBar)).toEqual({ J: 56, N: 5, E: 0 });
  });

  it('leaves a count unread when the bar length falls between two counts', () => {
    expect(inferUnreadCountsFromBarLengths({ J: 46, N: null, E: 1 }, [bar('J', 843), bar('N', 192)])).toEqual({
      J: 46,
      N: null,
      E: 1,
    });
  });

  it('cannot derive anything without the count of the longest bar', () => {
    expect(inferUnreadCountsFromBarLengths({ J: null, N: 11, E: 1 }, bars)).toEqual({ J: null, N: 11, E: 1 });
  });
});

describe('parseBarCount', () => {
  it('reads the count with or without the share', () => {
    expect(parseBarCount('46\n')).toEqual(46);
    expect(parseBarCount('14 (22 %)')).toEqual(14);
    expect(parseBarCount('0 (0 %)')).toEqual(0);
    expect(parseBarCount('50(78%)')).toEqual(50);
    expect(parseBarCount('50 78 %)')).toEqual(50);
  });

  it('rejects digits that ran together or noise', () => {
    expect(parseBarCount('1422')).toBeNull();
    expect(parseBarCount('')).toBeNull();
    expect(parseBarCount('(%)')).toBeNull();
  });
});

describe('plausibleCount', () => {
  it('keeps a count within the seats and reads a larger one again', async () => {
    expect(await plausibleCount(52, () => Promise.resolve(99))).toEqual(52);
    expect(await plausibleCount(582, () => Promise.resolve(52))).toEqual(52);
    expect(await plausibleCount(582, () => Promise.resolve(582))).toBeNull();
    expect(await plausibleCount(null, () => Promise.resolve(null))).toBeNull();
  });
});

describe('findNumberAfter', () => {
  it('reads the number after a label', () => {
    expect(findNumberAfter('33 Abgegebene Stimmen: 59\nAnwesende: 60', /Abgegebene\s*Stimmen/i)).toEqual(59);
    expect(findNumberAfter('Anwesende:', /Anwesende/i)).toBeNull();
  });

  it('finds the cast votes when the mouse pointer covers part of the label', () => {
    expect(findNumberAfter('Anwesende: 65\nAbg%gebene Stimmen: 65', CAST_VOTES_LABEL)).toEqual(65);
    expect(findNumberAfter('Anwesende: 65\nAb ¥ Stimmen: 59', CAST_VOTES_LABEL)).toEqual(59);
  });
});
