import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { overdueMinutes, overdueReport, type SessionMinutes } from './overdue-minutes.ts';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    help: { type: 'boolean', short: 'h', default: false },
    'data-dir': { type: 'string', short: 'd', default: 'data/leipzig-8/' },
    today: { type: 'string', default: new Date().toISOString().slice(0, 10) },
  },
});

if (values.help) {
  console.log(`
Usage: bun index.ts [-d <data-dir>] [--today YYYY-MM-DD]

Prints, as Markdown, the sessions whose minutes from ALLRIS are overdue, or nothing when all are in time. The weekly
workflow turns the text into an issue, so a stopped ALLRIS runner is noticed.

-h, --help       Show this help message and exit.
-d, --data-dir   Directory of the parliament period on the data branch. Default: data/leipzig-8/
    --today      Day to measure from. Default: today
  `);
  process.exit(0);
}

const dataDir = values['data-dir'];
const readJson = <T>(path: string): Promise<T | null> =>
  readFile(path, 'utf-8')
    .then((json) => JSON.parse(json) as T)
    .catch(() => null);

const sessionIds = (await readdir(dataDir)).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name)).sort();
const sessions: SessionMinutes[] = [];
for (const sessionId of sessionIds) {
  // Only sessions with votes: a day without a votings file was not read and needs no minutes yet.
  const votings = await readJson(join(dataDir, sessionId, `votings-${sessionId}.json`));
  if (!votings) continue;
  const minutes = await readJson<{ kind: SessionMinutes['minutesKind'] }>(
    join(dataDir, sessionId, `minutes-${sessionId}.json`),
  );
  const verlauf = await readJson(join(dataDir, sessionId, `verlaufsprotokoll-${sessionId}.json`));
  sessions.push({ sessionId, minutesKind: minutes?.kind ?? null, hasVerlaufsprotokoll: verlauf !== null });
}

process.stdout.write(overdueReport(overdueMinutes(sessions, values.today)));
