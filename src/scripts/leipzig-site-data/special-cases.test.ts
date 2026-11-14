import { describe, expect, it } from 'bun:test';

import type { ExtractedVoting } from '../leipzig-votings/extract-session.ts';
import { itemNumberOf, type MajorityOverride, majorityOverrideOf, type Recusal, recusalsOf } from './special-cases.ts';

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

describe('majorityOverrideOf', () => {
  const hauptsatzung: MajorityOverride = {
    sessionId: '2026-02-25',
    agendaItemNumber: '19.1',
    itemNumber: '3',
    majorityRequirement: 'majority-of-members',
    quote: 'Jetzt komme ich zu Punkt 3, wo wir die Satzung beschließen gemäß Anlage 1.',
    sourceUrl: 'https://ratsinformation.leipzig.de/allris_leipzig_public/to010?SILFDNR=1',
  };

  it('finds the requirement of one point of a paper voted on point by point', () => {
    expect(majorityOverrideOf([hauptsatzung], '2026-02-25', '19.1', '3')).toBe('majority-of-members');
    expect(majorityOverrideOf([hauptsatzung], '2026-02-25', '19.1', '1, 2 und 4')).toBeUndefined();
    expect(majorityOverrideOf([hauptsatzung], '2026-02-25', '19.1.2', '3')).toBeUndefined();
  });
});

describe('itemNumberOf', () => {
  it('reads the point from the minutes', () => {
    expect(itemNumberOf(official(['beschlussprotokoll', 'Abstimmungsergebnis zu Punkt 4:']))).toBe('4');
    expect(itemNumberOf(official(['agenda-item-pages', 'Abstimmungsergebnis zu Punkt 1 und  2:']))).toBe('1 und 2');
  });

  // 25.02.2026 TOP 19.1: „Beschlusspunkte 1, 2 und 4“, „Beschlusspunkte 5 bis 7“; elsewhere „Punkt 1b bis 6“, „6b)“.
  it('reads several points and points with a letter', () => {
    const label = (text: string) => itemNumberOf(official(['beschlussprotokoll', text]));
    expect(label('Abstimmungsergebnis: Beschlusspunkte 1, 2 und 4:')).toBe('1, 2 und 4');
    expect(label('Abstimmungsergebnis: Beschlusspunkte 5 bis 7:')).toBe('5 bis 7');
    expect(label('Abstimmungsergebnis: Beschlusspunkt 3:')).toBe('3');
    expect(label('Abstimmungsergebnis: zu Punkt 1b bis 6:')).toBe('1b bis 6');
    expect(label('Abstimmungsergebnis: Beschlusspunkt 6b):')).toBe('6b');
  });

  it('ignores the Verlaufsprotokoll and votes without point', () => {
    expect(itemNumberOf(official(['verlaufsprotokoll', 'Damit ist der Punkt 1 beschlossen.']))).toBeUndefined();
    expect(itemNumberOf(official(['beschlussprotokoll', 'Abstimmungsergebnis:']))).toBeUndefined();
    expect(itemNumberOf({ official: undefined })).toBeUndefined();
  });
});
