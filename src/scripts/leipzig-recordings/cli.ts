import { parseArgs } from 'node:util';

export type LeipzigRecordingsArgs = {
  help: boolean;
  outDir: string;
  firstSessionDate: string;
  probeDays: number;
  backfill: boolean;
};

export function parseCliArgs(args: string[]): LeipzigRecordingsArgs {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      'out-dir': { type: 'string', short: 'o', default: 'data/leipzig-8/' },
      'first-session-date': { type: 'string', default: '2024-09-18' },
      'probe-days': { type: 'string', default: '60' },
      backfill: { type: 'boolean', default: false },
    },
  });
  return {
    help: values.help,
    outDir: values['out-dir'],
    firstSessionDate: values['first-session-date'],
    probeDays: Number(values['probe-days']),
    backfill: values.backfill,
  };
}

export function checkArgs(args: LeipzigRecordingsArgs) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.firstSessionDate)) {
    console.error('--first-session-date must be an ISO date (YYYY-MM-DD). See --help for usage.');
    process.exit(1);
  }
  if (!Number.isInteger(args.probeDays) || args.probeDays < 0) {
    console.error('--probe-days must be a whole number of days. See --help for usage.');
    process.exit(1);
  }
}

export function printHelpText() {
  console.log(`
Usage: bun index.ts [-o <out-dir>] [--first-session-date <YYYY-MM-DD>] [--probe-days <days>] [--backfill]

Finds the recordings of the Leipzig city council (Ratsversammlung) in the city's Mediathek, resolves their HLS stream
and subtitle file, archives the subtitles and writes recordings.json and recordings.csv into <out-dir>. Council meeting
dates come from the city's OParl API. Exits with code 1 if any recording could not be processed.

-h, --help                  Show this help message and exit.
-o, --out-dir               Directory of the parliament period. Default: data/leipzig-8/
    --first-session-date    First session date of the parliament period. Default: 2024-09-18
    --probe-days            Guess page addresses only for meetings of the last <days> days. Default: 60
    --backfill              Guess page addresses for every meeting since --first-session-date.
  `);
}
