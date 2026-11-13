import type { ExtractedVoting } from '../leipzig-votings/extract-session.ts';

// An editorial entry of data/<period>/recusals.json: a member who declared a conflict of interest (§ 20 SächsGemO,
// Befangenheit) and took part in neither debate nor vote, with the words of the Verlaufsprotokoll. agendaItemNumbers
// covers the sub-items (amendments): „18.6“ also stands for 18.6.1.
export type Recusal = {
  sessionId: string;
  agendaItemNumbers: string[];
  personOparlId: string;
  quote: string;
  sourceUrl: string;
};

export function recusalsOf(recusals: Recusal[], sessionId: string, agendaItemNumber: string): Recusal[] {
  return recusals.filter(
    (recusal) =>
      recusal.sessionId === sessionId &&
      recusal.agendaItemNumbers.some(
        (number) => agendaItemNumber === number || agendaItemNumber.startsWith(`${number}.`),
      ),
  );
}

// Where the council votes on the points of a paper one by one, the minutes and the ALLRIS page of the agenda item name
// the point of each result („Abstimmungsergebnis zu Punkt 4:“). The Verlaufsprotokoll does not, so it is not asked.
const POINT = /Punkt\s+(\d+(?:\s*(?:,|und|bis|-)\s*\d+)*)/i;

export function itemNumberOf(voting: Pick<ExtractedVoting, 'official'>): string | undefined {
  const label = voting.official?.sources
    .filter((source) => source.kind !== 'verlaufsprotokoll')
    .map((source) => POINT.exec(source.label ?? ''))
    .find((match) => match !== null);
  return label ? label[1].replaceAll(/\s+/g, ' ') : undefined;
}
