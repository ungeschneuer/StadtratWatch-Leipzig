import { describe, expect, it } from 'bun:test';

import { parseMinutes, type PdfTextItem } from './minutes.ts';

// Rows as the Leipzig minutes lay them out: number column at x = 45, text at 71, paper reference at 435.
function row(page: number, y: number, parts: { x: number; text: string }[]): PdfTextItem[] {
  return parts.map((part) => ({ page, y, ...part }));
}

const items: PdfTextItem[] = [
  ...row(1, 700, [
    { x: 45, text: '19.5' },
    { x: 71, text: 'Eigenheime für Leipzig' },
  ]),
  ...row(1, 698, [{ x: 435, text: 'VIII-DS-01619-NF-02' }]),
  ...row(1, 660, [{ x: 71, text: 'Abstimmungsergebnis:' }]),
  ...row(1, 640, [{ x: 71, text: 'Ja-Stimmen: 38' }]),
  ...row(1, 627, [{ x: 71, text: 'Nein-Stimmen: 7' }]),
  ...row(1, 614, [{ x: 71, text: 'Enthaltungen: 15' }]),
  // A number wrapping onto the next page, a paper reference wrapping onto the next line.
  ...row(1, 66, [
    { x: 45, text: '19.5' },
    { x: 71, text: 'Eigenheime für Leipzig' },
  ]),
  ...row(1, 69, [{ x: 435, text: 'VIII-DS-01619-NF-02-' }]),
  ...row(2, 760, [
    { x: 45, text: '.6' },
    { x: 511, text: 'ÄA-06' },
  ]),
  ...row(2, 700, [{ x: 71, text: 'Abstimmungsergebnis zu Punkt 1:' }]),
  ...row(2, 688, [{ x: 71, text: 'Ja-Stimmen: 28' }]),
  ...row(2, 676, [{ x: 71, text: 'Nein-Stimmen: 31' }]),
  ...row(2, 664, [{ x: 71, text: 'Enthaltungen: 1' }]),
  // A numbered point of a resolution is no agenda item.
  ...row(2, 640, [
    { x: 53, text: '3.' },
    { x: 71, text: 'Als Vorbild der Umgestaltung wird geprüft.' },
  ]),
  ...row(2, 620, [{ x: 71, text: 'Abstimmungsergebnis zu Punkt 2:' }]),
  ...row(2, 608, [{ x: 71, text: 'Ja-Stimmen: 29' }]),
  ...row(2, 596, [{ x: 71, text: 'Nein-Stimmen: 31' }]),
  ...row(2, 584, [{ x: 71, text: 'Enthaltungen: 0' }]),
  ...row(2, 500, [
    { x: 45, text: '19.2' },
    { x: 71, text: 'Rückzahlung der Ausgleichsbeträge' },
  ]),
  ...row(2, 488, [{ x: 45, text: '0' }]),
  ...row(2, 470, [
    {
      x: 71,
      text: 'Ein Antrag von Stadträtin Frau Krefft zur Vertagung des Tagesordnungspunktes wird abgelehnt (25/28/0).',
    },
  ]),
];

describe('parseMinutes', () => {
  const votes = parseMinutes(items);

  it('reads every result with its agenda item and paper', () => {
    expect(votes.map((vote) => [vote.agendaItemNumber, vote.paperReference, `${vote.J}/${vote.N}/${vote.E}`])).toEqual([
      ['19.5', 'VIII-DS-01619-NF-02', '38/7/15'],
      ['19.5.6', 'VIII-DS-01619-NF-02-ÄA-06', '28/31/1'],
      ['19.5.6', 'VIII-DS-01619-NF-02-ÄA-06', '29/31/0'],
      ['19.20', null, '25/28/0'],
    ]);
  });

  it('labels point results and recognises procedural motions', () => {
    expect(votes[1].label).toEqual('Abstimmungsergebnis zu Punkt 1:');
    expect(votes[1].procedural).toBe(false);
    expect(votes[3].procedural).toBe(true);
    expect(votes[3].label).toContain('zur Vertagung des Tagesordnungspunktes');
  });
});
