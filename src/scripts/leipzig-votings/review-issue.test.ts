import { describe, expect, it } from 'bun:test';

import type { ReviewCase, ReviewCasesFile } from '@srw-astro/models/leipzig-review';

import { issueMarker, renderReviewIssue } from './review-issue.ts';

function reviewCase(votingIndex: number, open: boolean, videoSeconds: number): ReviewCase {
  return {
    votingIndex,
    open,
    priority: open ? 'hoch' : 'niedrig',
    videoSeconds,
    timecode: '0:45:12',
    agendaItemNumber: open ? '19.10.2' : null,
    paperReference: null,
    title: '',
    problems: [
      { check: 'announcement-matches', message: 'Die Sitzungsleitung korrigiert das Ergebnis mündlich.', detail: '' },
    ],
    board: { J: 1, N: 1, E: 0, castVotes: 2, presentMembers: 2 },
    official: null,
    announced: null,
    transcript: [],
    neighbours: { previous: null, next: null },
    links: [],
    images: [],
    seats: [],
    candidates: [],
    suggestions: [],
    reviews: [],
  };
}

const file: ReviewCasesFile = {
  sessionId: '2026-10-29',
  generatedAt: '2026-11-11T10:00:00Z',
  video: { hlsUrl: '', mediathekUrl: '', available: true },
  summary: { cases: 2, open: 1, reviewed: 1 },
  cases: [reviewCase(5, false, 6000), reviewCase(2, true, 2700)],
};

describe('renderReviewIssue', () => {
  const issue = renderReviewIssue(file, 'https://example.github.io/StadtratWatch-Leipzig/review/');

  it('names the date and the open count in the title', () => {
    expect(issue.title).toEqual('Prüfung Ratsversammlung 29. Oktober 2026: 1 offen');
  });

  it('carries the marker and a checklist in video order with links to the cases', () => {
    expect(issue.body.startsWith(issueMarker('2026-10-29'))).toBe(true);
    const checklist = issue.body.split('\n').filter((line) => line.startsWith('- ['));
    expect(checklist).toEqual([
      '- [ ] **#2**, TOP 19.10.2, 0:45:12, Priorität hoch: Die Sitzungsleitung korrigiert das Ergebnis mündlich. [prüfen](https://example.github.io/StadtratWatch-Leipzig/review/leipzig/2026-10-29#fall-2)',
      '- [x] **#5**, ohne TOP, 0:45:12, Priorität niedrig: Die Sitzungsleitung korrigiert das Ergebnis mündlich. [prüfen](https://example.github.io/StadtratWatch-Leipzig/review/leipzig/2026-10-29#fall-5)',
    ]);
  });

  it('reports a session without open cases as done', () => {
    const done = renderReviewIssue({ ...file, summary: { cases: 2, open: 0, reviewed: 2 } }, 'https://x/');
    expect(done.title).toEqual('Prüfung Ratsversammlung 29. Oktober 2026: erledigt');
  });
});
