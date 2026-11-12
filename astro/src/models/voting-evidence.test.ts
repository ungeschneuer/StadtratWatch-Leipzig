import { describe, expect, it } from 'vitest';
import { quotationImageNameOf, votingFilenameOf } from './voting-evidence';

describe('voting evidence names', () => {
  it('names the quotation image after the vote', () => {
    const votingFilename = votingFilenameOf('2026-10-29', 4);

    expect(votingFilename).toBe('2026-10-29-005.png');
    expect(quotationImageNameOf(votingFilename)).toBe(
      '2026-10-29-005-zitat.png',
    );
  });
});
