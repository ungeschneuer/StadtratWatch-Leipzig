import process from 'node:process';
import { parseArgs } from 'node:util';

export type LeipzigMembersArgs = {
  help: boolean;
  dataDir: string;
  parliamentPeriodId: string;
  periodStart: string;
  cacheDir: string;
};

export function parseCliArgs(args: string[]): LeipzigMembersArgs {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      'data-dir': { type: 'string', short: 'd', default: 'data/leipzig-8/' },
      'parliament-period': { type: 'string', default: 'leipzig-8' },
      'period-start': { type: 'string', default: '2024-09-18' },
      'cache-dir': { type: 'string', default: '.cache/leipzig-sources/' },
    },
  });
  return {
    help: values.help,
    dataDir: values['data-dir'],
    parliamentPeriodId: values['parliament-period'],
    periodStart: values['period-start'],
    cacheDir: values['cache-dir'],
  };
}

export function checkArgs(args: LeipzigMembersArgs) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.periodStart)) {
    console.error('--period-start must be an ISO date (YYYY-MM-DD). See --help for usage.');
    process.exit(1);
  }
}

export function printHelpText() {
  console.log(`
Usage: bun index.ts [-d <data-dir>] [--parliament-period <id>] [--period-start <YYYY-MM-DD>] [--cache-dir <dir>]

Builds the members of the Leipzig city council for one parliament period: council membership and faction history from
the city's OParl API, the party from the list each member stood on at the 2024 election (Open Data portal), corrected
by <data-dir>/member-overrides.json. Writes members.json, persons.csv and faction-memberships.csv into <data-dir>.
Exits with code 1 if a plausibility check fails; the files are written anyway.

The OParl lists and the candidates file are kept in <cache-dir>. A later run only asks OParl for the objects changed
since (modified_since) and the Open Data portal whether the file changed (ETag, Last-Modified); once a week, or without
a cache, everything is downloaded again.

-h, --help                Show this help message and exit.
-d, --data-dir            Directory of the parliament period. Default: data/leipzig-8/
    --parliament-period   ID of the parliament period. Default: leipzig-8
    --period-start        Day of the constituent session. Default: 2024-09-18
    --cache-dir           Directory of the download cache. Default: .cache/leipzig-sources/
  `);
}
