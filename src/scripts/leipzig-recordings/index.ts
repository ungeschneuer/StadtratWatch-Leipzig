import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { checkArgs, parseCliArgs, printHelpText } from './cli.ts';
import { createPoliteHttpClient, DEFAULT_USER_AGENT } from './http-client.ts';
import {
  createEmptyManifest,
  manifestToCsv,
  type RecordingsManifest,
  serializeManifest,
} from './recordings-manifest.ts';
import { type SubtitleStore, syncRecordings } from './sync-recordings.ts';

const args = parseCliArgs(Bun.argv.slice(2));

if (args.help) {
  printHelpText();
  process.exit(0);
}

checkArgs(args);

const manifestPath = join(args.outDir, 'recordings.json');
const today = berlinDate(new Date());
const probeSlugsSinceDate = args.backfill
  ? args.firstSessionDate
  : berlinDate(new Date(Date.now() - args.probeDays * 24 * 60 * 60 * 1000));

const http = createPoliteHttpClient(process.env.SCRAPER_USER_AGENT || DEFAULT_USER_AGENT, 500);
const subtitles: SubtitleStore = {
  read: (relativePath) => readFile(join(args.outDir, relativePath), 'utf-8').catch(() => null),
  async write(relativePath, content) {
    const path = join(args.outDir, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  },
};
const log = { info: (message: string) => console.log(message), warn: (message: string) => console.warn(message) };

try {
  const { manifest, failures } = await syncRecordings(
    http,
    subtitles,
    await readManifest(manifestPath),
    { today, firstSessionDate: args.firstSessionDate, probeSlugsSinceDate },
    log,
  );
  await mkdir(args.outDir, { recursive: true });
  await writeFile(manifestPath, serializeManifest(manifest));
  await writeFile(join(args.outDir, 'recordings.csv'), manifestToCsv(manifest));
  const available = manifest.recordings.filter((recording) => recording.goneSince === null).length;
  console.log(`${manifest.recordings.length} recordings in manifest, ${available} available`);

  if (failures.length > 0) {
    console.error(`leipzig-recordings could not process ${failures.length} page(s):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
} catch (error) {
  console.error(`leipzig-recordings failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

async function readManifest(path: string): Promise<RecordingsManifest> {
  const content = await readFile(path, 'utf-8').catch(() => null);
  return content ? (JSON.parse(content) as RecordingsManifest) : createEmptyManifest();
}

function berlinDate(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
}
