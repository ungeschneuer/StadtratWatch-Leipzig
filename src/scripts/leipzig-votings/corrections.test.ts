import { describe, expect, it } from 'bun:test';

import { applyCorrections, CorrectionsError, parseCorrections } from './corrections.ts';
import type { ExtractedVoting, SeatVote } from './extract-session.ts';

function seat(personId: string, vote: SeatVote['vote'], attendance: SeatVote['attendance'] = 'present'): SeatVote {
  return { column: 0, row: 0, boardName: personId, personId, vote, attendance };
}

function voting(index: number, start: number, agendaItemNumber: string): ExtractedVoting {
  return {
    index,
    videoSeconds: { start, end: start + 4, frames: [start + 1, start + 3] },
    heading: { raw: '', agendaItemNumber, paperReference: null, title: '' },
    oparl: null,
    board: { presentMembers: 3, castVotes: 2, resultBars: { J: 1, N: 1, E: 0 } },
    tally: { J: 1, N: 1, E: 0, present: 1, absent: 1, unknown: 0 },
    announced: null,
    votes: [seat('stange', 'O'), seat('weickert', 'J'), seat('nagel', 'N'), seat('dossin', 'O', 'absent')],
    checks: [],
    checkStatus: 'needs-review',
    status: 'needs-review',
  };
}

const votings = [voting(0, 2700, '19.10.2'), voting(1, 2850, '19.10.3')];

describe('parseCorrections', () => {
  it('accepts seat changes and approvals', () => {
    const json = [
      { voting: { videoSeconds: 2700 }, seats: [{ personId: 'stange', vote: 'J' }], reason: 'mündlich hinzugezählt' },
      { voting: { videoSeconds: 2850, agendaItemNumber: '19.10.3' }, approve: true, reason: 'Belegbild geprüft' },
    ];

    expect(parseCorrections(json, 'corrections.json')).toHaveLength(2);
  });

  it('rejects entries without reason, without effect or with an unknown vote code', () => {
    const json = [
      { voting: { videoSeconds: 2700 }, approve: true },
      { voting: { videoSeconds: 2700 }, reason: 'nichts' },
      { voting: { videoSeconds: 2700 }, seats: [{ personId: 'stange', vote: 'Ja' }], reason: 'x' },
    ];

    expect(() => parseCorrections(json, 'c.json')).toThrow(CorrectionsError);
    try {
      parseCorrections(json, 'c.json');
    } catch (error) {
      expect((error as CorrectionsError).problems).toHaveLength(3);
    }
  });
});

describe('applyCorrections', () => {
  it('changes a seat, keeps the board reading and marks the voting as reviewed', () => {
    const [corrected] = applyCorrections(votings, [
      {
        voting: { videoSeconds: 2705 },
        seats: [{ personId: 'stange', vote: 'J' }],
        reason: 'hinzugezählt',
        source: 'VTT 00:45:12',
      },
    ]);

    expect(corrected.votes[0]).toMatchObject({ vote: 'J', boardVote: 'O', attendance: 'present' });
    expect(corrected.status).toEqual('reviewed');
    expect(corrected.checkStatus).toEqual('needs-review');
    expect(corrected.review).toEqual([
      { reason: 'hinzugezählt', source: 'VTT 00:45:12', reviewer: null, reviewedAt: null },
    ]);
    expect(corrected.tally.J).toEqual(1);
  });

  it('marks absent members as present when a correction gives them a vote', () => {
    const [corrected] = applyCorrections(votings, [
      { voting: { videoSeconds: 2700 }, seats: [{ personId: 'dossin', vote: 'N' }], reason: 'Stimme nachgetragen' },
    ]);

    expect(corrected.votes[3]).toMatchObject({ vote: 'N', attendance: 'present', boardAttendance: 'absent' });
  });

  it('approves without changing votes', () => {
    const [, approved] = applyCorrections(votings, [
      { voting: { videoSeconds: 2850 }, approve: true, reason: 'geprüft' },
    ]);

    expect(approved.status).toEqual('reviewed');
    expect(approved.votes.every((vote) => vote.boardVote === undefined)).toBe(true);
  });

  it('marks a vote that cannot be settled as unresolved and keeps the board reading', () => {
    const [unresolved] = applyCorrections(votings, [
      { voting: { videoSeconds: 2700 }, unresolved: true, reason: 'Nachgezählte Person nicht belegt' },
    ]);

    expect(unresolved.status).toEqual('unresolved');
    expect(unresolved.votes.map((vote) => vote.vote)).toEqual(['O', 'J', 'N', 'O']);
    expect(unresolved.review?.[0].reason).toEqual('Nachgezählte Person nicht belegt');
  });

  it('refuses an unresolved vote that is also approved or changed', () => {
    expect(() =>
      parseCorrections(
        [{ voting: { videoSeconds: 2700 }, unresolved: true, approve: true, reason: 'x' }],
        'corrections.json',
      ),
    ).toThrow(CorrectionsError);
  });

  it('discards a voting that was no valid vote and restores it when the correction goes', () => {
    const [discarded] = applyCorrections(votings, [
      { voting: { videoSeconds: 2700 }, discard: true, reason: 'Zwischenstand während der Abstimmung' },
    ]);

    expect(discarded.status).toEqual('discarded');
    expect(applyCorrections([discarded], [])[0].status).toEqual('needs-review');
  });

  it('rejects a discard combined with an approval', () => {
    expect(() =>
      parseCorrections([{ voting: { videoSeconds: 2700 }, discard: true, approve: true, reason: 'x' }], 'c.json'),
    ).toThrow('cannot also be approved');
  });

  it('assigns an agenda item to a vote whose board names none', () => {
    const withoutHeading = [
      {
        ...voting(0, 6240, ''),
        heading: { raw: 'ABSTIMMUNG', agendaItemNumber: null, paperReference: null, title: 'ABSTIMMUNG' },
      },
    ];
    const [assigned] = applyCorrections(withoutHeading, [
      { voting: { videoSeconds: 6240 }, agendaItemNumber: '18.20', reason: 'Geschäftsordnungsantrag zu TOP 18.20' },
    ]);

    expect(assigned.heading.agendaItemNumber).toEqual('18.20');
    expect(assigned.boardAgendaItemNumber).toBeNull();
    expect(applyCorrections([assigned], [])[0].heading.agendaItemNumber).toBeNull();
  });

  it('restores the board reading when a correction is removed', () => {
    const once = applyCorrections(votings, [
      { voting: { videoSeconds: 2700 }, seats: [{ personId: 'stange', vote: 'J' }], reason: 'hinzugezählt' },
    ]);
    const [restored] = applyCorrections(once, []);

    expect(restored.votes[0]).toEqual(seat('stange', 'O'));
    expect(restored.status).toEqual('needs-review');
    expect(restored.review).toBeUndefined();
  });

  it('gives the same result when applied twice', () => {
    const corrections = [
      { voting: { videoSeconds: 2700 }, seats: [{ personId: 'stange', vote: 'J' as const }], reason: 'x' },
    ];
    const once = applyCorrections(votings, corrections);

    expect(applyCorrections(once, corrections)).toEqual(once);
  });

  it('fails instead of dropping corrections that match no voting or the wrong agenda item', () => {
    expect(() => applyCorrections(votings, [{ voting: { videoSeconds: 5000 }, approve: true, reason: 'x' }])).toThrow(
      'matches no voting',
    );
    expect(() =>
      applyCorrections(votings, [
        { voting: { videoSeconds: 2700, agendaItemNumber: '19.10.3' }, approve: true, reason: 'x' },
      ]),
    ).toThrow('matches no voting');
  });

  it('fails for persons without a seat', () => {
    expect(() =>
      applyCorrections(votings, [
        { voting: { videoSeconds: 2700 }, seats: [{ personId: 'unknown', vote: 'J' }], reason: 'x' },
      ]),
    ).toThrow('has no seat');
  });
});
