import type { MajorityRequirement } from '@srw-astro/models/session-scan';

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
// „Beschlusspunkte 1, 2 und 4“ names several, „Punkt 1b bis 6“ and „6b)“ carry a letter.
const POINT = /Punkte?\s+(\d+[a-z]?(?:\s*(?:,|und|bis|-)\s*\d+[a-z]?)*)/i;

export function itemNumberOf(voting: Pick<ExtractedVoting, 'official'>): string | undefined {
  const label = voting.official?.sources
    .filter((source) => source.kind !== 'verlaufsprotokoll')
    .map((source) => POINT.exec(source.label ?? ''))
    .find((match) => match !== null);
  return label ? label[1].replaceAll(/\s+/g, ' ') : undefined;
}

// An editorial entry of data/<period>/majority-overrides.json: the majority one point of a paper needs when the title
// cannot say it. A paper that also changes the Hauptsatzung in one of its points („… und Satzungsbeschluss zur
// verbundenen Änderung der Hauptsatzung“) is voted on point by point; only the Verlaufsprotokoll names which point is
// the statute, which needs the majority of all members (§ 4 Abs. 2 SächsGemO).
export type MajorityOverride = {
  sessionId: string;
  agendaItemNumber: string;
  itemNumber: string;
  majorityRequirement: MajorityRequirement;
  quote: string;
  sourceUrl: string;
};

export function majorityOverrideOf(
  overrides: MajorityOverride[],
  sessionId: string,
  agendaItemNumber: string,
  itemNumber: string | undefined,
): MajorityRequirement | undefined {
  return overrides.find(
    (override) =>
      override.sessionId === sessionId &&
      override.agendaItemNumber === agendaItemNumber &&
      override.itemNumber === itemNumber,
  )?.majorityRequirement;
}
