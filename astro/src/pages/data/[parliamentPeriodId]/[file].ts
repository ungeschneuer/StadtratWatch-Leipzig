import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getCollection } from 'astro:content';

// The bulk downloads that leipzig-site-data writes next to the registry, served as they are. datapackage.json names
// them relative to itself, so all of them sit in one folder.
const DOWNLOADS = {
  'datapackage.json': 'application/json',
  'votings.csv': 'text/csv; charset=utf-8',
  'votes.csv': 'text/csv; charset=utf-8',
  'sessions.csv': 'text/csv; charset=utf-8',
  'persons.csv': 'text/csv; charset=utf-8',
  'faction-memberships.csv': 'text/csv; charset=utf-8',
} as const;

type Download = keyof typeof DOWNLOADS;

const dataDirectory = join(process.cwd(), '..', 'data');

export async function getStaticPaths() {
  const parliamentPeriods = await getCollection('parliamentPeriods');
  return parliamentPeriods.flatMap((parliamentPeriod) =>
    (Object.keys(DOWNLOADS) as Download[])
      .filter((file) =>
        existsSync(join(dataDirectory, parliamentPeriod.id, file)),
      )
      .map((file) => ({
        params: { parliamentPeriodId: parliamentPeriod.id, file },
      })),
  );
}

export async function GET({
  params,
}: {
  params: { parliamentPeriodId: string; file: Download };
}) {
  const content = await readFile(
    join(dataDirectory, params.parliamentPeriodId, params.file),
    'utf-8',
  );
  return new Response(content, {
    status: 200,
    headers: { 'Content-Type': DOWNLOADS[params.file] },
  });
}
