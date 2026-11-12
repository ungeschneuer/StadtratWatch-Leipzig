import { parseArgs } from 'node:util';

export type LeipzigVotingsArgs = {
  help: boolean;
  dataDir: string;
  cacheDir: string;
  sessions: string[];
  rescan: boolean;
  force: boolean;
  correctionsOnly: boolean;
  quotationImagesOnly: boolean;
  imageBaseUrl: string;
  offline: boolean;
};

// Evidence images are published as assets of one GitHub release per session.
export const DEFAULT_IMAGE_BASE_URL =
  'https://github.com/ungeschneuer/StadtratWatch-web/releases/download/evidence-{session}';

export function parseCliArgs(args: string[]): LeipzigVotingsArgs {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      'data-dir': { type: 'string', short: 'd', default: 'data/leipzig-8/' },
      'cache-dir': { type: 'string', short: 'c', default: 'output/leipzig-votings/' },
      session: { type: 'string', short: 's', multiple: true, default: [] },
      rescan: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      'corrections-only': { type: 'boolean', default: false },
      'quotation-images-only': { type: 'boolean', default: false },
      'image-base-url': { type: 'string', default: DEFAULT_IMAGE_BASE_URL },
      offline: { type: 'boolean', default: false },
    },
  });
  return {
    help: values.help,
    dataDir: values['data-dir'],
    cacheDir: values['cache-dir'],
    sessions: values.session,
    rescan: values.rescan,
    force: values.force,
    correctionsOnly: values['corrections-only'],
    quotationImagesOnly: values['quotation-images-only'],
    imageBaseUrl: values['image-base-url'],
    offline: values.offline,
  };
}

export function checkArgs(args: LeipzigVotingsArgs) {
  const invalid = args.sessions.filter((session) => !/^\d{4}-\d{2}-\d{2}$/.test(session));
  if (invalid.length > 0) {
    console.error(`Invalid session id(s) ${invalid.join(', ')}; use YYYY-MM-DD. See --help for usage.`);
    process.exit(1);
  }
}

export function printHelpText() {
  console.log(`
Usage: bun index.ts [-d <data-dir>] [-c <cache-dir>] [-s <YYYY-MM-DD> …] [--rescan] [--force] [--corrections-only]
                    [--quotation-images-only]

Reads every vote of a Leipzig council session from the voting board shown in the recording. The video is scanned at
low resolution for the phases in which the board shows its result bars; two full-HD frames of each phase are read and
cross-checked against the board's printed numbers, the OParl agenda and the spoken announcement in the subtitles.
Writes votings-<date>.json and votes-<date>.csv into <data-dir>/<date>/, after applying the human corrections in
corrections-<date>.json. Needs ffmpeg (FFMPEG_PATH or PATH).

-h, --help              Show this help message and exit.
-d, --data-dir          Directory of the parliament period with recordings.json. Default: data/leipzig-8/
-c, --cache-dir         Directory for scan results, which spare a rescan. Default: output/leipzig-votings/
-s, --session           Session to process; repeatable. Default: every available recording without votings file.
    --rescan            Scan the video again even if a cached scan exists.
    --force             Process sessions that already have a votings file.
    --corrections-only  Re-apply corrections-<date>.json to existing votings files without reading the video.
    --quotation-images-only
                        Only write the quotation image of every published vote of existing votings files into
                        <cache-dir>/evidence/<date>/, from the frame the vote was read from.
    --offline           Do not look for minutes that are not stored yet.
    --image-base-url    Where the evidence images are published; {session} is replaced by the session date.
                        Default: the release evidence-{session} of the fork on GitHub.

Also writes review-<date>.json with the cases a human has to check, review-index.json for the review UI, and the
evidence images into <cache-dir>/evidence/<date>/: the board of every case, and the quotation image of every vote.
  `);
}
