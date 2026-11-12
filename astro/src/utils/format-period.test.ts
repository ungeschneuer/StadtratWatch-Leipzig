import { describe, expect, it } from 'vitest';
import { formatPeriod } from './format-period.ts';

describe('formatPeriod', () => {
  it('names start, end or both', () => {
    expect(formatPeriod('2025-03-13', '2026-09-22')).toEqual(
      '13.03.2025 – 22.09.2026',
    );
    expect(formatPeriod('2026-09-23', null)).toEqual('seit 23.09.2026');
    expect(formatPeriod(null, '2025-01-31')).toEqual('bis 31.01.2025');
    expect(formatPeriod(null, null)).toEqual('');
  });
});
