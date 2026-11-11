export type AgendaHeading = {
  agendaItemNumber: string | null;
  paperReference: string | null;
  title: string;
};

// Board headings look like "19.14.3 VIII-DS-02149-ÄA-03 Rahmenrichtlinie …". OCR often reads the roman numeral's
// last I as l or 1, so the period prefix is matched loosely and written back canonically.
const HEADING_PATTERN =
  /^\s*(\d+(?:\s?\.\s?\d+)*)\.?\s+(?:(V[Il1|]{1,4})\s?-\s?([A-Za-zÄÖÜäöü]{1,4})\s?-\s?(\d{4,5})((?:\s?-\s?[A-Za-zÄÖÜäöü]{1,4}\s?-\s?\d{1,3})*))?\s*(.*)$/;

export function parseAgendaHeading(heading: string): AgendaHeading {
  const match = heading.match(HEADING_PATTERN);
  if (!match) {
    return { agendaItemNumber: null, paperReference: null, title: heading.trim() };
  }
  const [, number, period, kind, serial, suffixes, title] = match;
  const paperReference = period
    ? ['VIII', canonicalKind(kind), serial, ...splitSuffixes(suffixes)].join('-').replaceAll(/\s/g, '')
    : null;
  return { agendaItemNumber: number.replaceAll(/\s/g, ''), paperReference, title: title.trim() };
}

function splitSuffixes(suffixes: string): string[] {
  return [...suffixes.matchAll(/([A-Za-zÄÖÜäöü]{1,4})\s?-\s?(\d{1,3})/g)].map((match) => `${match[1]}-${match[2]}`);
}

// Paper kinds of the Leipzig council information system. OCR sometimes doubles a letter („Iffo“).
const PAPER_KINDS = ['DS', 'A', 'AS', 'DF', 'Ifo', 'EF', 'VSP', 'HP'];

function canonicalKind(kind: string): string {
  const known = (candidate: string) =>
    PAPER_KINDS.find((paperKind) => paperKind.toLowerCase() === candidate.toLowerCase());
  return known(kind) ?? known(kind.replaceAll(/(.)\1+/g, '$1')) ?? kind;
}
