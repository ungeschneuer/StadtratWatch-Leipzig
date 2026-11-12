import { describe, expect, it } from 'bun:test';

import { matchCandidate, parseCandidatesCsv, parseCsv } from './election-candidates.ts';

const CSV = `﻿"kandidat_partei_langname","kandidat_partei_kurzname","kandidat_name","kandidat_vorname"
"BÜNDNIS 90/DIE GRÜNEN","GRÜNE","Schreyer","Nicole"
"Sozialdemokratische Partei Deutschlands","SPD","Müller","Anna Maria"
"DIE LINKE","DIE LINKE","Müller","Anna"
"Freie Wählergemeinschaft Baumann „Garten 24“","","Baumann","Michael"
`;

describe('parseCandidatesCsv', () => {
  it('reads name and list of every candidate', () => {
    const candidates = parseCandidatesCsv(CSV);

    expect(candidates).toHaveLength(4);
    expect(candidates[0]).toEqual({
      familyName: 'Schreyer',
      givenName: 'Nicole',
      listShortName: 'GRÜNE',
      listName: 'BÜNDNIS 90/DIE GRÜNEN',
    });
  });

  it('fails on a CSV without the expected columns', () => {
    expect(() => parseCandidatesCsv('"name"\n"x"\n')).toThrow('no column kandidat_name');
  });
});

describe('parseCsv', () => {
  it('keeps commas, quotes and line breaks inside quoted fields', () => {
    expect(parseCsv('a,"b, ""c""\nd"\r\n1,2\n')).toEqual([
      ['a', 'b, "c"\nd'],
      ['1', '2'],
    ]);
  });
});

describe('matchCandidate', () => {
  const candidates = parseCandidatesCsv(CSV);

  it('matches family name and first given name, ignoring case and accents', () => {
    expect(matchCandidate({ familyName: 'BAUMANN', givenName: 'Michael' }, candidates)).toMatchObject({
      match: 'name',
      candidate: { familyName: 'Baumann' },
    });
  });

  it('finds a candidate by the former part of a double name', () => {
    expect(matchCandidate({ familyName: 'Schreyer-Krieg', givenName: 'Nicole' }, candidates)).toMatchObject({
      match: 'former-name',
      candidate: { listShortName: 'GRÜNE' },
    });
  });

  it('gives no match when two candidates share the name', () => {
    expect(matchCandidate({ familyName: 'Müller', givenName: 'Anna' }, candidates)).toEqual({
      candidate: null,
      reason: '2 candidates with this name',
    });
  });
});
