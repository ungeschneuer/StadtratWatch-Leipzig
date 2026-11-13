import { describe, expect, test } from 'bun:test';

import {
  acceptGuestProposal,
  GuestProposalError,
  parseGuestProposal,
  replaceCorrectionOfVoting,
} from './guest-proposal.ts';

const proposalBody = [
  'Vorschlag zur Abstimmung #12 der Ratsversammlung vom 2026-01-28.',
  '',
  '```json',
  JSON.stringify(
    {
      voting: { videoSeconds: 7972.5, agendaItemNumber: '14.4' },
      seats: [{ personId: 'https://www.leipzig.sitzung-online.de/oparl/persons/67', vote: 'J' }],
      reason: 'Amtliches Ergebnis 41/23/1',
    },
    null,
    2,
  ),
  '```',
].join('\n');

describe('parseGuestProposal', () => {
  test('reads session and correction from the issue the review UI opens', () => {
    const proposal = parseGuestProposal('Prüfvorschlag 2026-01-28 #12', proposalBody);
    expect(proposal.sessionId).toBe('2026-01-28');
    expect(proposal.correction.voting.videoSeconds).toBe(7972.5);
    expect(proposal.correction.seats).toHaveLength(1);
  });

  test('rejects a title without a session date', () => {
    expect(() => parseGuestProposal('Vorschlag', proposalBody)).toThrow(GuestProposalError);
  });

  test('rejects a body without exactly one JSON block', () => {
    expect(() => parseGuestProposal('Prüfvorschlag 2026-01-28 #12', 'kein Block')).toThrow(GuestProposalError);
    expect(() => parseGuestProposal('Prüfvorschlag 2026-01-28 #12', proposalBody + proposalBody)).toThrow(
      GuestProposalError,
    );
  });

  test('rejects a correction the pipeline would reject', () => {
    const withoutReason = '```json\n{"voting":{"videoSeconds":1},"approve":true}\n```';
    expect(() => parseGuestProposal('Prüfvorschlag 2026-01-28 #12', withoutReason)).toThrow(GuestProposalError);
  });
});

test('acceptGuestProposal names the accepting reviewer and links the issue as source', () => {
  const { correction } = parseGuestProposal('Prüfvorschlag 2026-01-28 #12', proposalBody);
  const accepted = acceptGuestProposal(correction, {
    reviewer: 'maintainer',
    reviewedAt: '2026-11-14T10:00:00.000Z',
    issueUrl: 'https://github.com/example/repo/issues/48',
  });
  expect(accepted.reviewer).toBe('maintainer');
  expect(accepted.source).toBe('Gastvorschlag https://github.com/example/repo/issues/48');
});

test('replaceCorrectionOfVoting replaces the decision on the same vote and keeps the others', () => {
  const existing = [
    { voting: { videoSeconds: 100 }, approve: true, reason: 'a' },
    { voting: { videoSeconds: 7970 }, approve: true, reason: 'alt' },
  ];
  const result = replaceCorrectionOfVoting(existing, {
    voting: { videoSeconds: 7972.5 },
    approve: true,
    reason: 'neu',
  });
  expect(result.map((correction) => correction.reason)).toEqual(['a', 'neu']);
});
