// The candidates of the 2024 council election from the Open Data portal of the city: one row per candidate with the list
// they stood on. It is the only public source that ties every councillor to a party, as the list they were elected on.
export const CANDIDATES_CSV_URL =
  'https://opendata.leipzig.de/dataset/4aa2ce25-04c8-40de-a25e-80a6cefc5d1e/resource/f0e95083-4b10-466e-b5f3-55e564a3d30e/download/stadtratswahl_leipzig_2024_kandidaten.csv';
export const CANDIDATES_DATASET_URL =
  'https://opendata.leipzig.de/dataset/stadtratswahl-2024-bewerberinnen-und-bewerber';

export type Candidate = {
  familyName: string;
  givenName: string;
  listShortName: string;
  listName: string;
};

export function parseCandidatesCsv(csv: string): Candidate[] {
  const [header, ...rows] = parseCsv(csv.replace(/^﻿/, ''));
  const column = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`Candidates CSV has no column ${name}`);
    return index;
  };
  const [family, given, short, long] = [
    column('kandidat_name'),
    column('kandidat_vorname'),
    column('kandidat_partei_kurzname'),
    column('kandidat_partei_langname'),
  ];
  return rows
    .filter((row) => row.length >= header.length)
    .map((row) => ({ familyName: row[family], givenName: row[given], listShortName: row[short], listName: row[long] }));
}

export type CandidateMatch =
  { candidate: Candidate; match: 'name' | 'former-name' } | { candidate: null; reason: string };

// Family name and first given name decide. A councillor who has since taken a double name („Schreyer-Krieg“, candidate
// „Schreyer“) is found by one part of it, if that gives exactly one candidate.
export function matchCandidate(
  person: { familyName: string; givenName: string },
  candidates: Candidate[],
): CandidateMatch {
  const given = firstGivenName(person.givenName);
  const sameGivenName = candidates.filter((candidate) => firstGivenName(candidate.givenName) === given);
  const exact = sameGivenName.filter((candidate) => nameKey(candidate.familyName) === nameKey(person.familyName));
  if (exact.length === 1) return { candidate: exact[0], match: 'name' };
  if (exact.length > 1) return { candidate: null, reason: `${exact.length} candidates with this name` };
  const parts = person.familyName
    .split(/[-\s]+/)
    .map(nameKey)
    .filter((part) => part.length > 0);
  const byPart =
    parts.length > 1 ? sameGivenName.filter((candidate) => parts.includes(nameKey(candidate.familyName))) : [];
  if (byPart.length === 1) return { candidate: byPart[0], match: 'former-name' };
  return {
    candidate: null,
    reason: byPart.length > 1 ? 'several candidates match a part of the name' : 'no candidate',
  };
}

function firstGivenName(givenName: string): string {
  return nameKey(givenName.trim().split(/[\s-]+/)[0] ?? '');
}

export function nameKey(text: string): string {
  return text
    .normalize('NFKD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .replaceAll('ß', 'ss')
    .toLowerCase()
    .replaceAll(/[^a-z]/g, '');
}

// RFC 4180: fields in double quotes may hold commas, line breaks and doubled quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  if (field !== '' || row.length > 0) rows.push([...row, field]);
  return rows.filter((candidate) => !(candidate.length === 1 && candidate[0] === ''));
}
