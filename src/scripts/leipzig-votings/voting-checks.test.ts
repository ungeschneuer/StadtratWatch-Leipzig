import { describe, expect, it } from 'bun:test';

import { checkVoting, type VotingEvidence } from './voting-checks.ts';

function evidence(overrides: Partial<VotingEvidence> = {}): VotingEvidence {
  return {
    seatCount: 71,
    expectedSeatCount: 71,
    tally: { J: 13, N: 33, E: 13, present: 1, absent: 11, unknown: 0 },
    readingsAgree: true,
    resultBars: { J: 13, N: 33, E: 13 },
    presentMembers: 60,
    castVotes: 59,
    unmatchedSeats: [],
    agendaItemNumber: '19.14.3',
    agendaItemKnown: true,
    paperReference: 'VIII-DS-02149-ÄA-03',
    oparlPaperReference: 'VIII-DS-02149-ÄA-03',
    oparlResult: 'abgelehnt',
    votingsOnAgendaItem: 1,
    announced: { J: 13, N: 33, E: 13, atSeconds: 10, quote: '13 zu 33 zu 13', mentionsCorrection: false },
    distinctFromPrevious: null,
    ...overrides,
  };
}

function failedChecks(overrides: Partial<VotingEvidence>): string[] {
  return checkVoting(evidence(overrides))
    .checks.filter((check) => !check.passed)
    .map((check) => check.check);
}

describe('checkVoting', () => {
  it('passes a voting that agrees with every source and keeps it provisional until the official result', () => {
    expect(checkVoting(evidence()).status).toEqual('provisional');
  });

  it('marks a voting without official result as provisional', () => {
    expect(checkVoting(evidence({ announced: null })).status).toEqual('provisional');
  });

  it('needs review when the colours disagree with the printed numbers', () => {
    expect(failedChecks({ resultBars: { J: 14, N: 32, E: 13 } })).toEqual(['colours-match-result-bars']);
    expect(failedChecks({ castVotes: 58 })).toEqual(['colours-match-cast-votes']);
    expect(failedChecks({ presentMembers: 61 })).toEqual(['seat-numbers-match-present-members']);
  });

  it('treats an unreadable number as a failure unless cast votes and announcement confirm the colours', () => {
    expect(failedChecks({ resultBars: { J: null, N: 33, E: 13 }, announced: null })).toEqual([
      'colours-match-result-bars',
    ]);
    expect(failedChecks({ resultBars: { J: null, N: 33, E: 13 } })).toEqual([]);
  });

  it('needs review when a spoken correction changes the result', () => {
    const announced = {
      J: 14,
      N: 33,
      E: 13,
      atSeconds: 10,
      quote: 'Herr X wird hinzugezählt',
      mentionsCorrection: true,
    };

    expect(checkVoting(evidence({ announced })).status).toEqual('needs-review');
  });

  it('compares the outcome with OParl only for a single voting on the agenda item', () => {
    expect(failedChecks({ oparlResult: 'beschlossen' })).toEqual(['outcome-matches-oparl']);
    expect(failedChecks({ oparlResult: 'beschlossen', votingsOnAgendaItem: 2 })).toEqual([]);
    expect(failedChecks({ oparlResult: 'teilweise beschlossen' })).toEqual([]);
  });

  it('needs review for unknown seats, unmatched names and unknown agenda items', () => {
    expect(failedChecks({ tally: { J: 13, N: 33, E: 13, present: 0, absent: 11, unknown: 1 } })).toContain(
      'seats-complete',
    );
    expect(failedChecks({ unmatchedSeats: ['no roster name close to "X"'] })).toEqual(['names-match-roster']);
    expect(failedChecks({ agendaItemKnown: false })).toEqual(['agenda-item-in-oparl']);
    expect(failedChecks({ paperReference: 'VIII-DS-02149-ÄA-02' })).toEqual(['paper-matches-oparl']);
    expect(failedChecks({ readingsAgree: false })).toEqual(['second-frame-agrees']);
    expect(failedChecks({ distinctFromPrevious: false })).toEqual(['distinct-from-previous']);
    expect(failedChecks({ distinctFromPrevious: true })).toEqual([]);
  });

  it('accepts a board that names the original paper where OParl links its revision', () => {
    expect(failedChecks({ paperReference: 'VIII-DS-02011', oparlPaperReference: 'VIII-DS-02011-NF-01' })).toEqual([]);
    expect(
      failedChecks({ paperReference: 'VIII-DS-07720-DS-03-NF-02', oparlPaperReference: 'VIII-DS-07720-DS-03-NF-03' }),
    ).toEqual(['paper-matches-oparl']);
  });

  it('accepts a paper from the previous period, whose numeral OCR reads as VIII', () => {
    expect(
      failedChecks({ paperReference: 'VIII-DS-07720-DS-02-NF-02', oparlPaperReference: 'VII-DS-07720-DS-02-NF-02' }),
    ).toEqual([]);
  });

  it('accepts an amendment sub-item missing in OParl when its paper derives from the parent item', () => {
    const subItem = {
      agendaItemNumber: '18.16.1',
      agendaItemIsParent: true,
      paperReference: 'VIII-DS-01232-NF-02-ÄA-01',
      oparlPaperReference: 'VIII-DS-01232-NF-02',
      oparlResult: 'beschlossen',
    };

    expect(failedChecks(subItem)).toEqual([]);
    expect(failedChecks({ ...subItem, paperReference: 'VIII-DS-01299-ÄA-01' })).toEqual(['agenda-item-in-oparl']);
    expect(failedChecks({ ...subItem, paperReference: null })).toEqual(['agenda-item-in-oparl']);
    expect(failedChecks({ ...subItem, paperReference: 'VIII-DS-01232-ÄA-01' })).toEqual([]);
  });

  it("falls back to the board's paper of the parent item when OParl only has a placeholder", () => {
    const subItem = {
      agendaItemNumber: '18.16.1',
      agendaItemIsParent: true,
      paperReference: 'VIII-DS-01609-ÄA-01',
      oparlPaperReference: null,
      oparlResult: null,
    };

    expect(failedChecks({ ...subItem, boardParentPaperReference: 'VIII-DS-01609' })).toEqual([]);
    expect(failedChecks({ ...subItem, boardParentPaperReference: null })).toEqual(['agenda-item-in-oparl']);
  });

  it('accepts colours over bar numbers that do not add up, if cast votes and announcement confirm them', () => {
    const misreadBar = {
      tally: { J: 11, N: 47, E: 0, present: 0, absent: 13, unknown: 0 },
      resultBars: { J: 11, N: 48, E: 0 },
      castVotes: 58,
      presentMembers: 58,
      announced: { J: 11, N: 47, E: 0, atSeconds: 10, quote: '11 zu 47 zu 0', mentionsCorrection: false },
      oparlResult: 'abgelehnt',
    };

    expect(failedChecks(misreadBar)).toEqual([]);
    expect(failedChecks({ ...misreadBar, announced: null })).toEqual(['colours-match-result-bars']);
    expect(failedChecks({ ...misreadBar, resultBars: { J: 12, N: 46, E: 0 } })).toEqual(['colours-match-result-bars']);
  });

  it("accepts a TOP whose number OParl gives another item, when the linked item has the board's paper", () => {
    expect(
      failedChecks({
        agendaItemNumber: '19.5.3',
        agendaItemMatchedByPaper: true,
        oparlAgendaItemNumber: '19.5.2',
        paperReference: 'VIII-DS-01619-NF-02-ÄA-02',
        oparlPaperReference: 'VIII-DS-01619-NF-02-ÄA-02',
      }),
    ).toEqual([]);
  });

  it('accepts an announcement without abstentions when Ja and Nein agree', () => {
    const announced = { J: 13, N: 33, E: null, atSeconds: 10, quote: '13 zu 33', mentionsCorrection: false };
    expect(failedChecks({ announced })).toEqual([]);
    expect(failedChecks({ announced: { ...announced, N: 32 } })).toEqual(['announcement-matches']);
  });

  it('needs review for a count in progress: bars only flashed up or few members voted', () => {
    expect(failedChecks({ resultPhaseSeconds: 0 })).toEqual(['result-shown-long-enough']);
    expect(failedChecks({ resultPhaseSeconds: 4 })).toEqual([]);
    expect(
      failedChecks({
        tally: { J: 3, N: 2, E: 0, present: 55, absent: 11, unknown: 0 },
        resultBars: { J: 3, N: 2, E: 0 },
        castVotes: 5,
        announced: null,
        oparlResult: null,
      }),
    ).toEqual(['most-present-members-voted']);
  });
});
