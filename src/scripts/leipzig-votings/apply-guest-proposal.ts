import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { VotingCorrection } from '@srw-astro/models/leipzig-review';

import {
  acceptGuestProposal,
  GuestProposalError,
  parseGuestProposal,
  replaceCorrectionOfVoting,
} from './guest-proposal.ts';

// Adds the guest proposal of an issue to the corrections file of its session. The workflow passes the issue through
// the environment, never through the command line, because its text comes from anyone.
const dataDir = process.env.LEIPZIG_DATA_DIR ?? 'data/leipzig-8';
const { ISSUE_TITLE, ISSUE_BODY, ISSUE_URL, ACCEPTED_BY } = process.env;
if (!ISSUE_TITLE || ISSUE_BODY === undefined || !ISSUE_URL || !ACCEPTED_BY) {
  console.error('ISSUE_TITLE, ISSUE_BODY, ISSUE_URL and ACCEPTED_BY are required');
  process.exit(2);
}

try {
  const { sessionId, correction } = parseGuestProposal(ISSUE_TITLE, ISSUE_BODY);
  const correctionsPath = join(dataDir, sessionId, `corrections-${sessionId}.json`);
  await readFile(join(dataDir, sessionId, `votings-${sessionId}.json`)).catch(() => {
    throw new GuestProposalError(`Zur Sitzung ${sessionId} gibt es keine Abstimmungen.`);
  });
  const existing = JSON.parse(await readFile(correctionsPath, 'utf-8').catch(() => '[]')) as VotingCorrection[];
  const accepted = acceptGuestProposal(correction, {
    reviewer: ACCEPTED_BY,
    reviewedAt: new Date().toISOString(),
    issueUrl: ISSUE_URL,
  });
  await writeFile(correctionsPath, `${JSON.stringify(replaceCorrectionOfVoting(existing, accepted), null, 2)}\n`);
  console.log(correctionsPath);
} catch (error) {
  if (!(error instanceof GuestProposalError)) throw error;
  console.error(error.message);
  process.exit(1);
}
