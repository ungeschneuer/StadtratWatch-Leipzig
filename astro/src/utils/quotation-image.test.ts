import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { quotationImageUrl } from './quotation-image';

describe('quotationImageUrl', () => {
  it('links the image of a vote only when it was fetched', () => {
    vi.stubEnv('BASE_URL', '/StadtratWatch-web/');
    const publicDirectory = mkdtempSync(join(tmpdir(), 'public-'));
    mkdirSync(join(publicDirectory, 'evidence', '2026-10-29'), {
      recursive: true,
    });
    writeFileSync(
      join(
        publicDirectory,
        'evidence',
        '2026-10-29',
        '2026-10-29-005-zitat.png',
      ),
      '',
    );

    expect(
      quotationImageUrl('2026-10-29', '2026-10-29-005.png', publicDirectory),
    ).toBe('/StadtratWatch-web/evidence/2026-10-29/2026-10-29-005-zitat.png');
    expect(
      quotationImageUrl('2026-10-29', '2026-10-29-006.png', publicDirectory),
    ).toBeNull();
    vi.unstubAllEnvs();
  });
});
