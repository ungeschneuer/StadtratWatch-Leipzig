import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

import type { LeipzigMembersFile } from '@srw-astro/models/leipzig-members';

import type { PapersFile } from '../leipzig-papers/voting-papers.ts';
import type { RecordingsManifest } from '../leipzig-recordings/recordings-manifest.ts';
import type { MinutesFile } from '../leipzig-votings/minutes.ts';
import type { SessionVotingsFile } from '../leipzig-votings/session-votings-file.ts';
import { parseVtt } from '../leipzig-votings/subtitle-announcements.ts';
import type { VerlaufFile } from '../leipzig-votings/verlaufsprotokoll.ts';
import { checkArgs, parseCliArgs, printHelpText } from './cli.ts';
import { buildRegistry, type RegistrySessionInput } from './registry.ts';
import { toSessionScan } from './session-scan.ts';
import { toSessionSpeeches } from './session-speeches.ts';

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
  const warnings: string[] = [];
  const sessions: RegistrySessionInput[] = [];
  let published = 0;
  let speechSessions = 0;
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
    const speechesSourceUrl = await writeSessionSpeeches(recording, sessionDir, members, warnings);
    if (speechesSourceUrl) speechSessions++;
    sessions.push({
      recording,
      pendingVotings: result.pending,
      meetingMinutesUrl: minutes?.kind === 'beschlussprotokoll' ? minutes.source : null,
      speechesSourceUrl,
    });
  }

  const registry = buildRegistry({ id: args.parliamentPeriodId, name: args.parliamentPeriodName }, members, sessions);
  await writeFile(join(args.dataDir, 'registry.json'), `${JSON.stringify(registry, null, 2)}\n`);
  // The map links votes to the paper pages of the site, which only exist for papers in data/paper-index.json. Leipzig
  // papers are not there yet; an empty map says so, where a missing one makes the build warn on every page.
  await writeFile(join(args.dataDir, 'voting-paper-map.json'), '{}\n');
  const approved = registry.sessions.filter((session) => session.approved).length;
  console.log(
    `${registry.sessions.length} sessions (${approved} approved), ${published} votings published, speeches of ${speechSessions} sessions`,
  );
  warnings.forEach((warning) => console.warn(`warning: ${warning}`));

  if (problems.length > 0) {
    console.error(`leipzig-site-data found ${problems.length} problem(s):`);
    problems.forEach((problem) => console.error(`- ${problem}`));
    process.exit(1);
  }
} catch (error) {
  console.error(`leipzig-site-data failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

// The speeches of a session need its Verlaufsprotokoll (about two months after the session) and subtitles.
async function writeSessionSpeeches(
  recording: RecordingsManifest['recordings'][number],
  sessionDir: string,
  members: LeipzigMembersFile,
  warnings: string[],
): Promise<string | null> {
  const verlauf = await readJson<VerlaufFile>(join(sessionDir, `verlaufsprotokoll-${recording.sessionId}.json`));
  if (!verlauf?.contributions || !recording.subtitleFile) return null;
  const cues = parseVtt(await readFile(join(args.dataDir, recording.subtitleFile), 'utf-8'));
  const result = toSessionSpeeches(recording.date, verlauf.contributions, cues, members);
  warnings.push(...result.warnings);
  const { contributions, tied } = result.stats;
  console.log(
    `${recording.sessionId}: ${result.speeches.length} speeches, ${tied} of ${contributions} contributions tied`,
  );
  await writeFile(
    join(sessionDir, `session-speeches-${recording.sessionId}.json`),
    `${JSON.stringify(result.speeches, null, 2)}\n`,
  );
  return verlauf.source;
}

function readJson<T>(path: string): Promise<T | null> {
  return readFile(path, 'utf-8')
    .then((json) => JSON.parse(json) as T)
    .catch(() => null);
}
