import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type JsonStore = {
  read<T>(key: string): Promise<T | null>;
  write(key: string, value: unknown): Promise<void>;
};

// One JSON file per key. A missing or unreadable file reads as null, so a lost cache only costs a full download.
export function createJsonFileStore(directory: string): JsonStore {
  const pathOf = (key: string) => join(directory, `${key.replace(/[^A-Za-z0-9._-]+/g, '_')}.json`);
  return {
    async read<T>(key: string) {
      const json = await readFile(pathOf(key), 'utf-8').catch(() => null);
      if (json === null) return null;
      try {
        return JSON.parse(json) as T;
      } catch {
        return null;
      }
    },
    async write(key, value) {
      await mkdir(directory, { recursive: true });
      await writeFile(pathOf(key), JSON.stringify(value));
    },
  };
}

export function createMemoryJsonStore(): JsonStore & { entries: Map<string, unknown> } {
  const entries = new Map<string, unknown>();
  return {
    entries,
    read: <T>(key: string) => Promise.resolve((entries.get(key) as T | undefined) ?? null),
    write(key, value) {
      entries.set(key, structuredClone(value));
      return Promise.resolve();
    },
  };
}
