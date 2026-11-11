import type { ReviewCase, VotingCorrection } from '@srw-astro/models/leipzig-review';

// Mirrors the pipeline: a correction names its vote by the video second of the result, within this tolerance.
const VIDEO_SECONDS_TOLERANCE = 15;

export function correctionsForCase(corrections: VotingCorrection[], reviewCase: ReviewCase): VotingCorrection[] {
  return corrections.filter(
    (correction) => Math.abs(correction.voting.videoSeconds - reviewCase.videoSeconds) <= VIDEO_SECONDS_TOLERANCE,
  );
}

export function replaceCorrectionsForCase(
  corrections: VotingCorrection[],
  reviewCase: ReviewCase,
  correction: VotingCorrection,
): VotingCorrection[] {
  const others = corrections.filter((existing) => !correctionsForCase([existing], reviewCase).length);
  return [...others, correction].sort((a, b) => a.voting.videoSeconds - b.voting.videoSeconds);
}

export function describeCorrection(correction: VotingCorrection): string {
  const parts: string[] = [];
  if (correction.approve) parts.push('bestätigt');
  if (correction.discard) parts.push('verworfen');
  if (correction.agendaItemNumber) parts.push(`TOP ${correction.agendaItemNumber}`);
  if (correction.seats?.length) parts.push(`${correction.seats.length} Stimme(n) geändert`);
  return parts.join(', ');
}
