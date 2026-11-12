import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { toQuotationImage } from './evidence-images.ts';
import { decodePngFrame } from './rgb-frame.ts';

describe('toQuotationImage', () => {
  it('halves a full-HD board frame and keeps it unmarked', async () => {
    const board = new Uint8Array(await readFile(join(import.meta.dir, 'test-fixtures', 'board-42-16-1.png')));
    const original = decodePngFrame(board);

    const quotation = decodePngFrame(toQuotationImage(board));

    expect(original.width).toBe(1920);
    expect([quotation.width, quotation.height]).toEqual([960, 540]);
    const centre = (frame: typeof original, x: number, y: number) => {
      const offset = (y * frame.width + x) * 3;
      return [...frame.data.subarray(offset, offset + 3)];
    };
    expect(centre(quotation, 480, 270)).toEqual(
      centre(original, 960, 540).map((_, channel) => {
        const values = [0, 1].flatMap((dy) => [0, 1].map((dx) => centre(original, 960 + dx, 540 + dy)[channel]));
        return Math.round(values.reduce((sum, value) => sum + value, 0) / 4);
      }),
    );
  });
});
