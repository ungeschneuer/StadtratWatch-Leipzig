import { readFile, writeFile } from 'node:fs/promises';

export type GeneratedFile = { generatedAt: string };

// The generation time alone is no change; without this, every run would produce a commit.
export async function writeGeneratedFile<File extends GeneratedFile>(path: string, file: File): Promise<void> {
  const previous = await readFile(path, 'utf-8')
    .then((json) => JSON.parse(json) as GeneratedFile)
    .catch(() => null);
  const unchanged =
    previous !== null &&
    JSON.stringify({ ...previous, generatedAt: '' }) === JSON.stringify({ ...file, generatedAt: '' });
  if (!unchanged) await writeFile(path, `${JSON.stringify(file, null, 2)}\n`);
}
