import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { createPoliteHttpClient, DEFAULT_USER_AGENT, getTextOrThrow } from '../leipzig-recordings/http-client.ts';
import type { RecordingsManifest } from '../leipzig-recordings/recordings-manifest.ts';
import type { SessionVotingsFile } from '../leipzig-votings/session-votings-file.ts';
import { addSessionPapers, createPaperLookup, type PapersFile } from './voting-papers.ts';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    help: { type: 'boolean', short: 'h', default: false },
    'data-dir': { type: 'string', short: 'd', default: 'data/leipzig-8/' },
  },
});

if (values.help) {
  console.log(`
Usage: bun index.ts [-d <data-dir>]

Links every vote in <data-dir>/<date>/votings-<date>.json to the OParl paper it was about, with its submitters, and
writes <data-dir>/papers.json. Votes linked before are not fetched again.

-h, --help       Show this help message and exit.
-d, --data-dir   Directory of the parliament period. Default: data/leipzig-8/
  `);
  process.exit(0);
}

const dataDir = values['data-dir'];
const http = createPoliteHttpClient(process.env.SCRAPER_USER_AGENT || DEFAULT_USER_AGENT, 300);
const lookup = createPaperLookup(async (url) => JSON.parse(await getTextOrThrow(http, url)));
const papersPath = join(dataDir, 'papers.json');

try {
  const manifest = JSON.parse(await readFile(join(dataDir, 'recordings.json'), 'utf-8')) as RecordingsManifest;
  const file: PapersFile = await readFile(papersPath, 'utf-8')
    .then((json) => JSON.parse(json) as PapersFile)
    .catch(() => ({ papers: {}, votings: {} }));
  for (const recording of manifest.recordings) {
    const json = await readFile(
      join(dataDir, recording.sessionId, `votings-${recording.sessionId}.json`),
      'utf-8',
    ).catch(() => null);
    if (!json) continue;
    const { votings } = JSON.parse(json) as SessionVotingsFile;
    const { linked, unlinked } = await addSessionPapers(file, recording.sessionId, votings, lookup);
    console.log(`${recording.sessionId}: ${linked} votes linked to a paper, ${unlinked} without paper`);
    // Written after each session, so an interrupted run keeps what it found.
    await writeFile(papersPath, `${JSON.stringify(sorted(file), null, 2)}\n`);
  }
  console.log(`${Object.keys(file.papers).length} papers`);
} catch (error) {
  console.error(`leipzig-papers failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

// Stable key order keeps the diffs of the committed file small.
function sorted(file: PapersFile): PapersFile {
  const byKey = <T>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
  return {
    papers: byKey(file.papers),
    votings: Object.fromEntries(Object.entries(byKey(file.votings)).map(([day, votings]) => [day, byKey(votings)])),
  };
}
