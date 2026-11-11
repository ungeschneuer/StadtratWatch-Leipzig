import { describe, expect, it } from 'bun:test';

import type { ExtractedVoting, SeatVote } from './extract-session.ts';
import type { MinutesVote } from './minutes.ts';
import { alignVerlauf, applyOfficialResults, matchMinutes } from './official-result.ts';
import type { VerlaufResult } from './verlaufsprotokoll.ts';

function seat(boardName: string, vote: SeatVote['vote']): SeatVote {
  return { column: 0, row: 0, boardName, personId: `id-${boardName.split(',')[0]}`, vote, attendance: 'present' };
}

function voting(
  index: number,
  agendaItemNumber: string | null,
  [J, N, E]: [number, number, number],
  options: { failed?: string[]; votes?: SeatVote[] } = {},
): ExtractedVoting {
  const checks = [
    { check: 'colours-match-result-bars', passed: true, detail: '' },
    ...(options.failed ?? []).map((check) => ({ check, passed: false, detail: check })),
  ];
  const status = checks.every((check) => check.passed) ? 'provisional' : 'needs-review';
  return {
    index,
    videoSeconds: { start: index * 100, end: index * 100 + 5, frames: [index * 100 + 1] },
    heading: { raw: agendaItemNumber ?? 'ABSTIMMUNG', agendaItemNumber, paperReference: null, title: '' },
    oparl: null,
    board: { presentMembers: J + N + E, castVotes: J + N + E, resultBars: { J, N, E } },
    tally: { J, N, E, present: 0, absent: 0, unknown: 0 },
    announced: null,
    votes: options.votes ?? [],
    checks,
    checkStatus: status,
    status,
  };
}

function minutesVote(order: number, agendaItemNumber: string, [J, N, E]: [number, number, number], procedural = false) {
  return {
    order,
    agendaItemNumber,
    paperReference: null,
    label: 'Abstimmungsergebnis:',
    procedural,
    J,
    N,
    E,
  } satisfies MinutesVote;
}

function verlauf(
  order: number,
  agendaItemNumbers: string[],
  [J, N, E]: [number, number, number],
  context = '',
): VerlaufResult {
  return { order, agendaItemNumbers, J, N, E, line: `Abstimmung: ${J} - ${N} - ${E}.`, context };
}

describe('alignVerlauf', () => {
  it('pairs the results in order and skips a board the Verlaufsprotokoll does not have', () => {
    const votings = [voting(0, '14.1', [40, 14, 9]), voting(1, '14.2', [3, 2, 0]), voting(2, '14.2', [41, 21, 3])];
    const results = [verlauf(0, ['14.1'], [41, 14, 9]), verlauf(1, ['14.2'], [41, 21, 3])];

    const aligned = alignVerlauf(votings, results);

    expect(aligned.get(0)?.order).toEqual(0);
    expect(aligned.has(1)).toBe(false);
    expect(aligned.get(2)?.order).toEqual(1);
  });
});

describe('matchMinutes', () => {
  it('matches by agenda item before counts, so equal counts on another item are not taken', () => {
    const matches = matchMinutes(
      [voting(0, '19.7', [54, 0, 0])],
      [minutesVote(0, '13.2', [54, 0, 0]), minutesVote(1, '19.7', [54, 0, 0])],
      new Map(),
    );

    expect(matches.get(0)?.agendaItemNumber).toEqual('19.7');
  });

  it('places a board without heading by the Verlaufsprotokoll', () => {
    const board = voting(0, null, [28, 31, 1]);
    const matches = matchMinutes(
      [board],
      [minutesVote(0, '13.1', [28, 31, 1]), minutesVote(1, '19.5.6', [28, 31, 1])],
      new Map([[0, verlauf(0, ['19.5'], [28, 31, 1])]]),
    );

    expect(matches.get(0)?.agendaItemNumber).toEqual('19.5.6');
  });

  it('takes a near result only on the very same item', () => {
    const matches = matchMinutes(
      [voting(0, '14.1', [40, 14, 9]), voting(1, '12.6.2', [61, 1, 0])],
      [minutesVote(0, '14.1', [41, 14, 9]), minutesVote(1, '12.6', [62, 0, 0])],
      new Map(),
    );

    expect(matches.get(0)?.J).toEqual(41);
    expect(matches.has(1)).toBe(false);
  });
});

describe('applyOfficialResults', () => {
  it('verifies a board equal to the official result and settles checks that failed on the board alone', () => {
    const [applied] = applyOfficialResults([voting(0, null, [28, 31, 1], { failed: ['agenda-item-in-oparl'] })], {
      minutes: { kind: 'beschlussprotokoll', votes: [minutesVote(0, '19.5.6', [28, 31, 1])] },
      verlauf: [verlauf(0, ['19.5'], [28, 31, 1])],
    });

    expect(applied.status).toEqual('verified');
    expect(applied.official?.agendaItemNumber).toEqual('19.5.6');
    expect(applied.checks.find((check) => check.check === 'agenda-item-in-oparl')?.settledByOfficialResult).toBe(true);
  });

  it('corrects the seats the Verlaufsprotokoll names as added by hand', () => {
    const votes = [seat('Nagel, Juliane', 'O'), seat('Weickert, Michael', 'O')];
    const [applied] = applyOfficialResults([voting(0, '14.17.1', [33, 32, 0], { votes })], {
      minutes: { kind: 'beschlussprotokoll', votes: [minutesVote(0, '14.17.1', [33, 33, 0])] },
      verlauf: [
        verlauf(
          0,
          ['14.17'],
          [33, 33, 0],
          'Konnten alle abstimmen? - Frau Nagel noch nicht. Es kommt einmal Rot dazu.',
        ),
      ],
    });

    expect(applied.status).toEqual('corrected');
    expect(applied.official?.correction?.seats).toEqual([
      { personId: 'id-Nagel', boardName: 'Nagel, Juliane', vote: 'N' },
    ]);
  });

  it('does not correct when the text names more members than the difference allows', () => {
    const votes = [seat('Frommhold, Marvin', 'J'), seat('Möbius, Anna-Lisa', 'J')];
    const [applied] = applyOfficialResults([voting(0, '19.4', [39, 10, 11], { votes })], {
      minutes: null,
      verlauf: [
        verlauf(
          0,
          ['19.4'],
          [38, 10, 11],
          "Frau Möbius ist nicht da, aber Herr Frommhold hat Frau Möbius' Abstimmgerät bedient.",
        ),
      ],
    });

    expect(applied.status).toEqual('needs-review');
  });

  it('takes the only member present without a vote as added by hand when nobody is named', () => {
    const [applied] = applyOfficialResults([voting(0, '13.1', [18, 39, 2], { votes: [seat('Nagel, Juliane', 'O')] })], {
      minutes: null,
      verlauf: [verlauf(0, ['13.1'], [19, 39, 2], 'Konnten alle abstimmen? Eine Pro-Stimme dazu.')],
    });

    expect(applied.status).toEqual('corrected');
    expect(applied.official?.correction).toMatchObject({
      basis: 'only-non-voters',
      seats: [{ boardName: 'Nagel, Juliane', vote: 'J' }],
    });
  });

  it('needs review when more members than added are present without a vote', () => {
    const votes = [seat('Nagel, Juliane', 'O'), seat('Weickert, Michael', 'O')];
    const [applied] = applyOfficialResults([voting(0, '13.1', [18, 39, 2], { votes })], {
      minutes: null,
      verlauf: [verlauf(0, ['13.1'], [19, 39, 2], 'Eine Pro-Stimme dazu.')],
    });

    expect(applied.status).toEqual('needs-review');
  });

  it('needs review when minutes and Verlaufsprotokoll differ', () => {
    const [applied] = applyOfficialResults([voting(0, '18.21.2', [29, 29, 2])], {
      minutes: { kind: 'beschlussprotokoll', votes: [minutesVote(0, '18.21.2', [28, 28, 2])] },
      verlauf: [verlauf(0, ['18.21'], [29, 29, 2])],
    });

    expect(applied.checks.find((check) => check.check === 'official-sources-agree')?.passed).toBe(false);
    expect(applied.status).toEqual('needs-review');
  });

  it('stays provisional without official result and can be applied again', () => {
    const once = applyOfficialResults([voting(0, '14.17.1', [33, 32, 0], { votes: [seat('Nagel, Juliane', 'O')] })], {
      minutes: { kind: 'beschlussprotokoll', votes: [minutesVote(0, '14.17.1', [33, 33, 0])] },
      verlauf: [verlauf(0, ['14.17'], [33, 33, 0], 'Frau Nagel noch nicht. Es kommt einmal Rot dazu.')],
    });
    const without = applyOfficialResults(once, { minutes: null, verlauf: null });

    expect(without[0].status).toEqual('provisional');
    expect(without[0].official).toBeUndefined();
  });

  it('skips the review of a procedural motion', () => {
    const [byMinutes] = applyOfficialResults([voting(0, '19.20', [25, 27, 0], { failed: ['names-match-roster'] })], {
      minutes: { kind: 'beschlussprotokoll', votes: [minutesVote(0, '19.20', [25, 28, 0], true)] },
      verlauf: null,
    });
    expect(byMinutes).toMatchObject({ procedural: true, status: 'skipped' });

    const [, byCall] = applyOfficialResults(
      [voting(0, '12.14', [40, 20, 0]), voting(1, null, [24, 38, 5], { failed: ['agenda-item-in-oparl'] })],
      {
        minutes: null,
        verlauf: null,
        cues: [{ startSeconds: 70, endSeconds: 80, text: 'Ich bitte Sie um Ihr Votum zum Vertagungsantrag.' }],
      },
    );
    expect(byCall).toMatchObject({ procedural: true, status: 'skipped' });
  });

  it('reviews a vote on the substance without heading as before', () => {
    const [, substance] = applyOfficialResults(
      [voting(0, '13.29', [40, 20, 0]), voting(1, null, [49, 5, 4], { failed: ['agenda-item-in-oparl'] })],
      {
        minutes: null,
        verlauf: null,
        cues: [{ startSeconds: 70, endSeconds: 80, text: 'Ihr Votum zum Änderungsantrag der CDU.' }],
      },
    );
    expect(substance.status).toEqual('needs-review');
  });

  it('discards a board that is no result of its own, unless the official result equals it', () => {
    const flash = voting(0, '12.12', [3, 2, 0], { failed: ['result-shown-long-enough', 'most-present-members-voted'] });
    const repeated = voting(1, null, [46, 11, 1], { failed: ['not-repeated'] });
    const [discardedFlash, discardedRepeat] = applyOfficialResults([flash, repeated], { minutes: null, verlauf: null });
    expect(discardedFlash.status).toEqual('discarded');
    expect(discardedRepeat.status).toEqual('discarded');

    const [realResult] = applyOfficialResults(
      [voting(0, '9.2', [61, 0, 5], { failed: ['result-shown-long-enough'] })],
      { minutes: { kind: 'beschlussprotokoll', votes: [minutesVote(0, '9.2', [61, 0, 5])] }, verlauf: null },
    );
    expect(realResult.status).toEqual('verified');
  });
});
