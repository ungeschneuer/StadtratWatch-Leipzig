import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

import { createPoliteHttpClient, DEFAULT_USER_AGENT, getTextOrThrow } from '../leipzig-recordings/http-client.ts';
import { followOparlPages } from '../leipzig-recordings/oparl-pages.ts';
import { checkArgs, parseCliArgs, printHelpText } from './cli.ts';
import {
  deriveCouncilMembers,
  type OparlMembership,
  type OparlOrganization,
  type OparlPerson,
} from './council-members.ts';
import { CANDIDATES_CSV_URL, CANDIDATES_DATASET_URL, parseCandidatesCsv, parseCsv } from './election-candidates.ts';
import { parseMemberOverrides } from './member-overrides.ts';
import { buildMembersFile, factionMembershipsToCsv, personsToCsv } from './members-file.ts';

const OPARL_BODY_URL = 'https://www.leipzig.sitzung-online.de/oparl/bodies/2387';
const COUNCIL_ORGANIZATION_ID = 'https://www.leipzig.sitzung-online.de/oparl/organizations/gr/2387';

const args = parseCliArgs(Bun.argv.slice(2));

if (args.help) {
  printHelpText();
  process.exit(0);
}

checkArgs(args);

const http = createPoliteHttpClient(process.env.SCRAPER_USER_AGENT || DEFAULT_USER_AGENT, 300);
const fetchJson = async (url: string) => JSON.parse(await getTextOrThrow(http, url));

try {
  const [memberships, persons, organizations] = [
    await fetchAll<OparlMembership>(`${OPARL_BODY_URL}/memberships?size=100`),
    await fetchAll<OparlPerson>(`${OPARL_BODY_URL}/persons?size=100`),
    await fetchAll<OparlOrganization>(`${OPARL_BODY_URL}/organizations?size=100`),
  ];
  const candidates = parseCandidatesCsv(await getTextOrThrow(http, CANDIDATES_CSV_URL));
  const overridesPath = join(args.dataDir, 'member-overrides.json');
  const overridesJson = await readFile(overridesPath, 'utf-8').catch(() => null);
  const overrides = overridesJson ? parseMemberOverrides(JSON.parse(overridesJson), overridesPath) : [];

  const council = deriveCouncilMembers(
    { memberships, persons, organizations },
    COUNCIL_ORGANIZATION_ID,
    args.periodStart,
  );
  const { file, problems } = buildMembersFile({
    parliamentPeriodId: args.parliamentPeriodId,
    periodStart: args.periodStart,
    today: berlinDate(new Date()),
    generatedAt: new Date().toISOString(),
    members: council.members,
    organizations,
    candidates,
    overrides,
    boardSessionDays: await readBoardSessionDays(args.dataDir),
    sources: [
      {
        name: 'Ratsinformationssystem der Stadt Leipzig (OParl): Mitgliedschaften, Personen, Fraktionen',
        url: OPARL_BODY_URL,
        license: 'CC BY 4.0, Stadt Leipzig',
      },
      {
        name: 'Open-Data-Portal Leipzig: Stadtratswahl 2024, Bewerberinnen und Bewerber',
        url: CANDIDATES_DATASET_URL,
        license: 'Datenlizenz Deutschland – Namensnennung 2.0, Stadt Leipzig',
      },
    ],
  });

  await writeIfChanged(join(args.dataDir, 'members.json'), file);
  await writeFile(join(args.dataDir, 'persons.csv'), personsToCsv(file));
  await writeFile(join(args.dataDir, 'faction-memberships.csv'), factionMembershipsToCsv(file));
  console.log(
    `${file.persons.length} members, ${file.factions.length} factions, ${file.parties.length} parties ` +
      `(${candidates.length} candidates, ${overrides.length} overrides)`,
  );

  const allProblems = [...council.problems, ...problems];
  if (allProblems.length > 0) {
    console.error(`leipzig-members found ${allProblems.length} problem(s):`);
    allProblems.forEach((problem) => console.error(`- ${problem}`));
    process.exit(1);
  }
} catch (error) {
  console.error(`leipzig-members failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

// The votes read from the boards by leipzig-votings, as the session days on which each person voted or was present.
async function readBoardSessionDays(dataDir: string): Promise<Map<string, string[]>> {
  const days = new Map<string, string[]>();
  const sessions = (await readdir(dataDir, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  for (const session of sessions) {
    const csv = await readFile(join(dataDir, session.name, `votes-${session.name}.csv`), 'utf-8').catch(() => null);
    if (!csv) continue;
    const [header, ...rows] = parseCsv(csv);
    const personColumn = header.indexOf('personId');
    for (const personId of new Set(rows.map((row) => row[personColumn]).filter(Boolean))) {
      days.set(personId, [...(days.get(personId) ?? []), session.name]);
    }
  }
  return days;
}

async function fetchAll<T>(firstPageUrl: string): Promise<T[]> {
  const items: T[] = [];
  for await (const page of followOparlPages<T>(fetchJson, firstPageUrl)) items.push(...page.data);
  return items;
}

// The generation time alone is no change; without this, every run would produce a commit.
async function writeIfChanged(path: string, file: { generatedAt: string }) {
  const previous = await readFile(path, 'utf-8')
    .then((json) => JSON.parse(json) as { generatedAt: string })
    .catch(() => null);
  const unchanged =
    previous !== null &&
    JSON.stringify({ ...previous, generatedAt: '' }) === JSON.stringify({ ...file, generatedAt: '' });
  if (!unchanged) await writeFile(path, `${JSON.stringify(file, null, 2)}\n`);
}

function berlinDate(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
}
