import { describe, expect, it } from 'bun:test';

import { isPlausibleParse } from './official-sources.ts';

describe('isPlausibleParse', () => {
  function context(boardCount: number) {
    const warnings: string[] = [];
    return { warnings, sessionId: '2026-10-29', boardCount, warn: (message: string) => warnings.push(message) };
  }

  it('accepts about as many results as boards', () => {
    const session = context(33);

    expect(isPlausibleParse(session, 'Beschlussprotokoll', 28)).toBe(true);
    expect(session.warnings).toEqual([]);
  });

  it('rejects an empty or far too short parse with a warning', () => {
    const session = context(33);

    expect(isPlausibleParse(session, 'Beschlussprotokoll', 0)).toBe(false);
    expect(isPlausibleParse(session, 'Verlaufsprotokoll', 10)).toBe(false);
    expect(session.warnings[1]).toBe(
      '2026-10-29: Verlaufsprotokoll yields 10 results for 33 boards; not stored, its layout may have changed',
    );
  });
});
