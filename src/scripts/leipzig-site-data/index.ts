import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

import type { LeipzigMembersFile } from '@srw-astro/models/leipzig-members';

import type { PapersFile } from '../leipzig-papers/voting-papers.ts';
import type { RecordingsManifest } from '../leipzig-recordings/recordings-manifest.ts';
import type { MinutesFile } from '../leipzig-votings/minutes.ts';
import type { SessionVotingsFile } from '../leipzig-votings/session-votings-file.ts';
import { checkArgs, parseCliArgs, printHelpText } from './cli.ts';
import { buildRegistry, type RegistrySessionInput } from './registry.ts';
import { toSessionScan } from './session-scan.ts';

const args = parseCliArgs(Bun.argv.slice(2));

if (args.help) {
  printHelpText();
  process.exit(0);
}

checkArgs(args);

try {
  const manifest = await readJson<RecordingsManifest>(join(args.dataDir, 'recordings.json'));
  const members = await readJson<LeipzigMembersFile>(join(args.dataDir, 'members.json'));
  if (!manifest || !members) throw new Error(`recordings.json and members.json are needed in ${args.dataDir}`);
  // Written by leipzig-papers; without it the votes have no authors.
  const papers = await readJson<PapersFile>(join(args.dataDir, 'papers.json'));

  const problems: string[] = [];
  const sessions: RegistrySessionInput[] = [];
  let published = 0;
  for (const recording of manifest.recordings) {
    const sessionDir = join(args.dataDir, recording.sessionId);
    const votings = await readJson<SessionVotingsFile>(join(sessionDir, `votings-${recording.sessionId}.json`));
    if (!votings) continue;
    const result = toSessionScan(recording.sessionId, votings.votings, members, papers);
    problems.push(...result.problems);
    published += result.scan.length;
    await writeFile(
      join(sessionDir, `session-scan-${recording.sessionId}.json`),
      `${JSON.stringify(result.scan, null, 2)}\n`,
    );
    const minutes = await readJson<MinutesFile>(join(sessionDir, `minutes-${recording.sessionId}.json`));
    sessions.push({
      recording,
      pendingVotings: result.pending,
      meetingMinutesUrl: minutes?.kind === 'beschlussprotokoll' ? minutes.source : null,
    });
  }

  const registry = buildRegistry({ id: args.parliamentPeriodId, name: args.parliamentPeriodName }, members, sessions);
  await writeFile(join(args.dataDir, 'registry.json'), `${JSON.stringify(registry, null, 2)}\n`);
  // The map links votes to the paper pages of the site, which only exist for papers in data/paper-index.json. Leipzig
  // papers are not there yet; an empty map says so, where a missing one makes the build warn on every page.
  await writeFile(join(args.dataDir, 'voting-paper-map.json'), '{}\n');
  const approved = registry.sessions.filter((session) => session.approved).length;
  console.log(`${registry.sessions.length} sessions (${approved} approved), ${published} votings published`);

  if (problems.length > 0) {
    console.error(`leipzig-site-data found ${problems.length} problem(s):`);
    problems.forEach((problem) => console.error(`- ${problem}`));
    process.exit(1);
  }
} catch (error) {
  console.error(`leipzig-site-data failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

function readJson<T>(path: string): Promise<T | null> {
  return readFile(path, 'utf-8')
    .then((json) => JSON.parse(json) as T)
    .catch(() => null);
}
