import { describe, expect, it } from 'bun:test';

import type { ExtractedVoting } from '../leipzig-votings/extract-session.ts';
import { itemNumberOf, type Recusal, recusalsOf } from './special-cases.ts';

const naumov: Recusal = {
  sessionId: '2025-12-17',
  agendaItemNumbers: ['18.4', '18.5', '18.6'],
  personOparlId: 'p/naumov',
  quote: 'Frau Dr. Naumov hat sich als befangen gemeldet.',
  sourceUrl: 'https://ratsinformation.leipzig.de/',
};

function official(...labels: [string, string][]): Pick<ExtractedVoting, 'official'> {
  return {
    official: {
      J: 1,
      N: 0,
      E: 0,
      agendaItemNumber: '18.10.2',
      paperReference: null,
      procedural: false,
      sources: labels.map(([kind, label]) => ({
        kind,
        label,
        agendaItemNumbers: [],
        paperReference: null,
        J: 1,
        N: 0,
        E: 0,
      })),
    },
  } as unknown as Pick<ExtractedVoting, 'official'>;
}

describe('recusalsOf', () => {
  it('finds the recusal on the agenda item and its sub-items of that session', () => {
    expect(recusalsOf([naumov], '2025-12-17', '18.6.1')).toEqual([naumov]);
    expect(recusalsOf([naumov], '2025-12-17', '18.4')).toEqual([naumov]);
  });

  it('does not take a neighbouring item or another session for it', () => {
    expect(recusalsOf([naumov], '2025-12-17', '18.60')).toEqual([]);
    expect(recusalsOf([naumov], '2025-12-17', '18.7')).toEqual([]);
    expect(recusalsOf([naumov], '2026-01-28', '18.4')).toEqual([]);
  });
});

describe('itemNumberOf', () => {
  it('reads the point from the minutes', () => {
    expect(itemNumberOf(official(['beschlussprotokoll', 'Abstimmungsergebnis zu Punkt 4:']))).toBe('4');
    expect(itemNumberOf(official(['agenda-item-pages', 'Abstimmungsergebnis zu Punkt 1 und  2:']))).toBe('1 und 2');
  });

  it('ignores the Verlaufsprotokoll and votes without point', () => {
    expect(itemNumberOf(official(['verlaufsprotokoll', 'Damit ist der Punkt 1 beschlossen.']))).toBeUndefined();
    expect(itemNumberOf(official(['beschlussprotokoll', 'Abstimmungsergebnis:']))).toBeUndefined();
    expect(itemNumberOf({ official: undefined })).toBeUndefined();
  });
});
