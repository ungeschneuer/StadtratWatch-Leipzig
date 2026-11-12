import { describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { writeGeneratedFile } from './generated-file.ts';

async function existingFile(content: object): Promise<string> {
  const path = join(await mkdtemp(join(tmpdir(), 'generated-file-')), 'file.json');
  await writeFile(path, `${JSON.stringify(content, null, 2)}\n`);
  return path;
}

describe('writeGeneratedFile', () => {
  it('keeps the file when only the generation time differs', async () => {
    const path = await existingFile({ generatedAt: '2026-11-01T00:00:00.000Z', cases: [1] });

    await writeGeneratedFile(path, { generatedAt: '2026-11-12T00:00:00.000Z', cases: [1] });

    expect(JSON.parse(await readFile(path, 'utf-8')).generatedAt).toBe('2026-11-01T00:00:00.000Z');
  });

  it('writes the file when the content differs', async () => {
    const path = await existingFile({ generatedAt: '2026-11-01T00:00:00.000Z', cases: [1] });

    await writeGeneratedFile(path, { generatedAt: '2026-11-12T00:00:00.000Z', cases: [1, 2] });

    expect(JSON.parse(await readFile(path, 'utf-8'))).toEqual({
      generatedAt: '2026-11-12T00:00:00.000Z',
      cases: [1, 2],
    });
  });
});
