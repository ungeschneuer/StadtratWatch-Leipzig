import process from 'node:process';
import { parseArgs } from 'node:util';

export type LeipzigSiteDataArgs = {
  help: boolean;
  dataDir: string;
  parliamentPeriodId: string;
  parliamentPeriodName: string;
};

export function parseCliArgs(args: string[]): LeipzigSiteDataArgs {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      'data-dir': { type: 'string', short: 'd', default: 'data/leipzig-8/' },
      'parliament-period': { type: 'string', default: 'leipzig-8' },
      'parliament-period-name': { type: 'string', default: 'Leipzig – Wahlperiode VIII' },
    },
  });
  return {
    help: values.help,
    dataDir: values['data-dir'],
    parliamentPeriodId: values['parliament-period'],
    parliamentPeriodName: values['parliament-period-name'],
  };
}

export function checkArgs(args: LeipzigSiteDataArgs) {
  if (!/^[a-z0-9-]+$/.test(args.parliamentPeriodId)) {
    console.error('--parliament-period must be an ID such as leipzig-8. See --help for usage.');
    process.exit(1);
  }
}

export function printHelpText() {
  console.log(`
Usage: bun index.ts [-d <data-dir>] [--parliament-period <id>] [--parliament-period-name <name>]

Turns the Leipzig data of one parliament period into the files the StadtratWatch site reads: registry.json from
members.json and the recordings with a votings file, and session-scan-<date>.json per session from votings-<date>.json.
Reads only local files. Exits with code 1 if a seat has no member; the files are written anyway.

-h, --help                     Show this help message and exit.
-d, --data-dir                 Directory of the parliament period. Default: data/leipzig-8/
    --parliament-period        ID of the parliament period. Default: leipzig-8
    --parliament-period-name   Name shown on the site. Default: Leipzig – Wahlperiode VIII
  `);
}
