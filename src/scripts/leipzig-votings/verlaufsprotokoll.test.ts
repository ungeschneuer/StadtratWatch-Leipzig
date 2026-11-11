import { describe, expect, it } from 'bun:test';

import { parseVerlaufsprotokoll } from './verlaufsprotokoll.ts';

// Lines as the Verlaufsprotokoll of 28.01.2026 has them, shortened.
const lines = [
  'RATSVERSAMMLUNG VOM 28. JANUAR 2026',
  '14.17 Einführung der „Brötchentaste“ in',
  'Leipzig',
  '14.17.1 dazu Änderungsantrag (VIII-A-01935-',
  'Oberbürgermeister Jung: Herr Kriegel, bitte.',
  'Stadtrat Kriegel (AfD): 99 Prozent der Bäcker',
  'Oberbürgermeister Jung: Ihr Votum bitte zum Än-',
  'derungsantrag der BSW-Fraktion. - Frau Nagel',
  'noch nicht. Es kommt einmal Rot dazu.',
  'Abstimmung: 33 - 33 - 0. Damit abgelehnt.',
  'V e r l a u f s p r o t o k o l l v o m 2 8 . 0 1 . 2 0 2 6 S e i t e | 3 4',
  'Ich bitte um Ihr Votum zum Ursprungsantrag.',
  'Abstimmung: 32 - 34 - 0. Ebenfalls abgelehnt.',
  'Abstimmung: Einstimmig so beschlossen.',
];

describe('parseVerlaufsprotokoll', () => {
  const results = parseVerlaufsprotokoll(lines, new Set(['14', '14.17', '14.17.1']));

  it('reads every numbered result in order with the agenda items before it', () => {
    expect(results.map((result) => [result.agendaItemNumbers, `${result.J}/${result.N}/${result.E}`])).toEqual([
      [['14.17'], '33/33/0'],
      [['14.17'], '32/34/0'],
    ]);
  });

  it('keeps what was said before the result, without hyphenation and page headers', () => {
    expect(results[0].context).toContain(
      'Ihr Votum bitte zum Änderungsantrag der BSW-Fraktion. - Frau Nagel noch nicht.',
    );
    expect(results[1].context).toEqual('Ich bitte um Ihr Votum zum Ursprungsantrag.');
  });

  it('takes a number at the start of a text line for a heading only if the agenda has it', () => {
    expect(results.every((result) => !result.agendaItemNumbers.includes('99'))).toBe(true);
  });
});
