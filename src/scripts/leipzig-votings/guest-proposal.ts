import type { VotingCorrection } from '@srw-astro/models/leipzig-review';

import { parseCorrections } from './corrections.ts';

export type GuestProposal = { sessionId: string; correction: VotingCorrection };

export class GuestProposalError extends Error {}

// Mirrors the review UI: a correction names its vote by the video second of the result, within this tolerance.
const VIDEO_SECONDS_TOLERANCE = 15;

// The review UI opens a guest's proposal as an issue titled "Prüfvorschlag <date> #<index>" with the correction as a
// JSON code block. Anyone can edit that issue, so everything in it is checked like a corrections file.
export function parseGuestProposal(title: string, body: string): GuestProposal {
  const sessionId = title.match(/^Prüfvorschlag (\d{4}-\d{2}-\d{2}) #\d+$/)?.[1];
  if (!sessionId) throw new GuestProposalError('Titel hat nicht die Form „Prüfvorschlag JJJJ-MM-TT #Nummer“.');
  const codeBlocks = [...body.matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
  if (codeBlocks.length !== 1) throw new GuestProposalError('Text braucht genau einen ```json-Block.');
  let entry: unknown;
  try {
    entry = JSON.parse(codeBlocks[0][1]);
  } catch (error) {
    throw new GuestProposalError(`JSON-Block ist ungültig: ${(error as Error).message}`);
  }
  try {
    const [correction] = parseCorrections([entry], 'Vorschlag');
    return { sessionId, correction };
  } catch (error) {
    throw new GuestProposalError((error as Error).message);
  }
}

export function acceptGuestProposal(
  correction: VotingCorrection,
  accepted: { reviewer: string; reviewedAt: string; issueUrl: string },
): VotingCorrection {
  const proposalSource = `Gastvorschlag ${accepted.issueUrl}`;
  return {
    ...correction,
    source: correction.source ? `${correction.source}; ${proposalSource}` : proposalSource,
    reviewer: accepted.reviewer,
    reviewedAt: accepted.reviewedAt,
  };
}

export function replaceCorrectionOfVoting(
  corrections: VotingCorrection[],
  correction: VotingCorrection,
): VotingCorrection[] {
  const others = corrections.filter(
    (existing) => Math.abs(existing.voting.videoSeconds - correction.voting.videoSeconds) > VIDEO_SECONDS_TOLERANCE,
  );
  return [...others, correction].sort((a, b) => a.voting.videoSeconds - b.voting.videoSeconds);
}
