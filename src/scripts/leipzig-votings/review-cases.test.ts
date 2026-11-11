import { describe, expect, it } from 'bun:test';

import type { ExtractedVoting, SeatVote } from './extract-session.ts';
import { buildReviewCases, type ReviewInputs } from './review-cases.ts';
import { seatChangesForAnnouncement, seatsNamedIn } from './seat-changes.ts';

function seat(boardName: string, vote: SeatVote['vote'], attendance: SeatVote['attendance'] = 'present'): SeatVote {
  return { column: 0, row: 0, boardName, personId: `id-${boardName.split(',')[0]}`, vote, attendance };
}

const seats = [
  seat('Stange, Enrico', 'O'),
  seat('Dr. Reinhold, Klaus-Peter', 'O'),
  seat('Weickert, Michael', 'J'),
  seat('Nagel, Juliane', 'N'),
  seat('Dossin, Falk', 'O', 'absent'),
];

function voting(overrides: Partial<ExtractedVoting> = {}): ExtractedVoting {
  return {
    index: 2,
    videoSeconds: { start: 2700, end: 2710, frames: [2703, 2707] },
    heading: { raw: '19.10.2 Antrag', agendaItemNumber: '19.10.2', paperReference: null, title: 'Antrag' },
    oparl: null,
    board: { presentMembers: 4, castVotes: 2, resultBars: { J: 1, N: 1, E: 0 } },
    tally: { J: 1, N: 1, E: 0, present: 2, absent: 1, unknown: 0 },
    announced: null,
    votes: seats,
    checks: [],
    checkStatus: 'needs-review',
    status: 'needs-review',
    ...overrides,
  };
}

function inputs(votings: ExtractedVoting[], overrides: Partial<ReviewInputs> = {}): ReviewInputs {
  return {
    sessionId: '2026-10-29',
    oparlMeetingId: 'https://www.leipzig.sitzung-online.de/oparl/meetings/2004612',
    hlsUrl: 'https://stream.example/playlist.m3u8',
    mediathekUrl: 'https://www.leipzig.de/mediathek/video/aufzeichnung',
    videoAvailable: true,
    votings,
    cues: null,
    imageNames: new Set(),
    imageBaseUrl: 'https://example.org/evidence',
    now: new Date('2026-11-11T10:00:00Z'),
    ...overrides,
  };
}

describe('seatsNamedIn', () => {
  it('finds members by family name, titles aside', () => {
    expect(seatsNamedIn('Herr Stange wird hinzugezählt, Dr. Reinhold als Nein', seats).map((s) => s.boardName)).toEqual(
      ['Stange, Enrico', 'Dr. Reinhold, Klaus-Peter'],
    );
  });

  it('finds a family name in the genitive', () => {
    expect(seatsNamedIn('Herr Weickerts Ja-Stimme kommt noch dazu', seats).map((s) => s.boardName)).toEqual([
      'Weickert, Michael',
    ]);
  });

  it('does not match a family name inside another word', () => {
    expect(seatsNamedIn('die Nagelprobe', seats)).toEqual([]);
  });
});

describe('seatChangesForAnnouncement', () => {
  it('gives named members without vote the option the announcement has more of', () => {
    const result = seatChangesForAnnouncement(voting(), { J: 2, N: 1, E: 0 }, [seats[0]]);

    expect(result).toEqual({
      changes: [{ personId: 'id-Stange', boardName: 'Stange, Enrico', vote: 'J' }],
      complete: true,
    });
  });

  it('reports an incomplete change when the named members do not explain the difference', () => {
    expect(seatChangesForAnnouncement(voting(), { J: 3, N: 1, E: 0 }, [seats[0]]).complete).toBe(false);
  });

  it('takes back a vote the official result does not count', () => {
    const result = seatChangesForAnnouncement(voting(), { J: 0, N: 1, E: 0 }, [seats[2]]);

    expect(result).toEqual({
      changes: [{ personId: 'id-Weickert', boardName: 'Weickert, Michael', vote: 'O' }],
      complete: true,
    });
  });

  it('moves a named member whose vote the announcement counts elsewhere', () => {
    const result = seatChangesForAnnouncement(voting(), { J: 0, N: 2, E: 0 }, [seats[2]]);

    expect(result.changes).toEqual([{ personId: 'id-Weickert', boardName: 'Weickert, Michael', vote: 'N' }]);
    expect(result.complete).toBe(true);
  });
});

describe('buildReviewCases', () => {
  it('lists only votes whose checks failed and suggests the spoken correction', () => {
    const corrected = voting({
      announced: {
        J: 2,
        N: 1,
        E: 0,
        atSeconds: 2712,
        quote: 'Herr Stange wird hinzugezählt, 2 zu 1 zu 0',
        mentionsCorrection: true,
      },
      checks: [{ check: 'announcement-matches', passed: false, detail: 'announced 2/1/0' }],
    });
    const verified = voting({ index: 3, checkStatus: 'verified', status: 'verified' });
    const cues = [{ startSeconds: 2712, endSeconds: 2716, text: 'Herr Stange wird hinzugezählt, 2 zu 1 zu 0' }];

    const file = buildReviewCases(inputs([corrected, verified], { cues }));

    expect(file.summary).toEqual({ cases: 1, open: 1, reviewed: 0 });
    const [reviewCase] = file.cases;
    expect(reviewCase.priority).toEqual('hoch');
    expect(reviewCase.problems[0].message).toEqual('Die Sitzungsleitung korrigiert das Ergebnis mündlich.');
    expect(reviewCase.transcript).toEqual([
      { seconds: 2712, timecode: '0:45:12', text: 'Herr Stange wird hinzugezählt, 2 zu 1 zu 0', highlight: true },
    ]);
    expect(reviewCase.suggestions[0].correction).toMatchObject({
      voting: { videoSeconds: 2700, agendaItemNumber: '19.10.2' },
      seats: [{ personId: 'id-Stange', vote: 'J' }],
    });
    expect(reviewCase.candidates.map((candidate) => candidate.reason)).toEqual([
      'in der Ansage genannt',
      'anwesend, ohne Stimme',
    ]);
  });

  it('suggests agenda items for a board without TOP from the transcript and the neighbours', () => {
    const before = voting({
      index: 4,
      checkStatus: 'verified',
      status: 'verified',
      heading: { raw: '', agendaItemNumber: '18.19', paperReference: null, title: '' },
    });
    const withoutTop = voting({
      index: 5,
      videoSeconds: { start: 6240, end: 6250, frames: [6242] },
      heading: { raw: 'ABSTIMMUNG', agendaItemNumber: null, paperReference: null, title: 'ABSTIMMUNG' },
      checks: [{ check: 'agenda-item-in-oparl', passed: false, detail: 'heading TOP unreadable' }],
    });
    const cues = [{ startSeconds: 6200, endSeconds: 6205, text: 'Antrag auf Schluss der Debatte zu 18.20' }];

    const [reviewCase] = buildReviewCases(inputs([before, withoutTop], { cues })).cases;

    expect(reviewCase.priority).toEqual('niedrig');
    expect(reviewCase.suggestions.map((suggestion) => suggestion.correction.agendaItemNumber)).toEqual([
      '18.20',
      '18.19',
    ]);
  });

  it('marks reviewed cases as closed and keeps the review', () => {
    const reviewed = voting({
      status: 'reviewed',
      review: [{ reason: 'geprüft', source: null, reviewer: 'reviewer-login', reviewedAt: '2026-11-11T09:00:00Z' }],
      checks: [{ check: 'paper-matches-oparl', passed: false, detail: '' }],
    });

    const file = buildReviewCases(inputs([reviewed]));

    expect(file.summary).toEqual({ cases: 1, open: 0, reviewed: 1 });
    expect(file.cases[0].reviews[0].reviewer).toEqual('reviewer-login');
  });

  it('links images only when they exist', () => {
    const failed = voting({ checks: [{ check: 'paper-matches-oparl', passed: false, detail: '' }] });

    const [reviewCase] = buildReviewCases(
      inputs([failed], { imageNames: new Set(['2026-10-29-002-heading.png']) }),
    ).cases;

    expect(reviewCase.images).toEqual([
      { label: 'Überschrift', url: 'https://example.org/evidence/2026-10-29-002-heading.png' },
    ]);
  });
});
