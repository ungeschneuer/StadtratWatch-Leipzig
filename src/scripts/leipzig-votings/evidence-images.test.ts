import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { toQuotationImage } from './evidence-images.ts';
import { decodePngFrame } from './rgb-frame.ts';

describe('toQuotationImage', () => {
  it('halves a full-HD board frame and reduces its colour levels', async () => {
    const board = new Uint8Array(await readFile(join(import.meta.dir, 'test-fixtures', 'board-42-16-1.png')));
    const original = decodePngFrame(board);

    const quotation = decodePngFrame(toQuotationImage(board));

    expect(original.width).toBe(1920);
    expect([quotation.width, quotation.height]).toEqual([960, 540]);
    const colourLevels = new Set(quotation.data);
    expect(colourLevels.size).toBeLessThanOrEqual(16);
  });
});
