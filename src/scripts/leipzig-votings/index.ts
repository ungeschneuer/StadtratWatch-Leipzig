import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { LeipzigMembersFile } from '@srw-astro/models/leipzig-members';
import type { ReviewCasesFile, ReviewIndex } from '@srw-astro/models/leipzig-review';
import { createWorker, PSM } from 'tesseract.js';

import { createPoliteHttpClient, DEFAULT_USER_AGENT, getTextOrThrow } from '../leipzig-recordings/http-client.ts';
import type { Recording, RecordingsManifest } from '../leipzig-recordings/recordings-manifest.ts';
import { listVariantUrlsByBandwidth } from '../leipzig-recordings/stream-hosting.ts';
import { createAllrisClient } from './allris.ts';
import type { TextWorkers } from './board-text.ts';
import { checkArgs, parseCliArgs, printHelpText } from './cli.ts';
import { applyCorrections, parseCorrections } from './corrections.ts';
import { cropEvidence } from './evidence-images.ts';
import { type ExtractedVoting, extractSessionVotings } from './extract-session.ts';
import { createFfmpegVideoReader } from './ffmpeg.ts';
import type { MinutesFile } from './minutes.ts';
import { applyOfficialResults } from './official-result.ts';
import { loadOfficialSources } from './official-sources.ts';
import { type CouncilRoster, fetchCouncilRoster, fetchMeetingAgenda } from './oparl-council.ts';
import { buildReviewCases, evidenceImageNames } from './review-cases.ts';
import { scanVoteEvents } from './scan-session.ts';
import {
  serializeSessionVotings,
  sessionVotesToCsv,
  type SessionVotingsFile,
  summarizeStatuses,
} from './session-votings-file.ts';
import { parseVtt } from './subtitle-announcements.ts';
import type { VoteEvent } from './vote-events.ts';

// A session takes 15 to 25 minutes; one that takes this long hangs and fails, so the next session still gets its turn.
const SESSION_DEADLINE_MILLISECONDS = 2 * 60 * 60 * 1000;

const args = parseCliArgs(Bun.argv.slice(2));

if (args.help) {
  printHelpText();
  process.exit(0);
}

checkArgs(args);

const http = createPoliteHttpClient(process.env.SCRAPER_USER_AGENT || DEFAULT_USER_AGENT, 300);
const fetchJson = async (url: string) => JSON.parse(await getTextOrThrow(http, url));
const video = createFfmpegVideoReader(process.env.FFMPEG_PATH || 'ffmpeg');
const allris = createAllrisClient(process.env.SCRAPER_USER_AGENT || DEFAULT_USER_AGENT);
const log = { info: (message: string) => console.log(message), warn: (message: string) => console.warn(message) };

// Written by leipzig-members; without it the votes table has no faction and party.
const members = await readFile(join(args.dataDir, 'members.json'), 'utf-8')
  .then((json) => JSON.parse(json) as LeipzigMembersFile)
  .catch(() => null);
const manifest = JSON.parse(await readFile(join(args.dataDir, 'recordings.json'), 'utf-8')) as RecordingsManifest;
const failures: string[] = [];

async function runForSession(recording: Recording, run: () => Promise<void>) {
  try {
    await run();
  } catch (error) {
    const failure = `${recording.sessionId}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`failed ${failure}`);
    failures.push(failure);
  }
}

async function extractRecording(
  recording: Recording,
  councilRoster: CouncilRoster,
  workers: TextWorkers,
  signal: AbortSignal,
) {
  const variants = listVariantUrlsByBandwidth(await getTextOrThrow(http, recording.hlsUrl), recording.hlsUrl);
  if (variants.length === 0) {
    throw new Error(`No HLS variants in ${recording.hlsUrl}`);
  }
  const events = await loadOrScanEvents(recording.sessionId, variants[0]);
  const boardImages = new Map<number, Uint8Array>();
  const votings = await extractSessionVotings(
    {
      sessionId: recording.sessionId,
      hdVideoUrl: variants[variants.length - 1],
      events,
      roster: councilRoster.sessionRoster(recording.date),
      agenda: await fetchSessionAgenda(recording),
      cues: recording.subtitleFile
        ? parseVtt(await readFile(join(args.dataDir, recording.subtitleFile), 'utf-8'))
        : null,
    },
    { video, workers, fetchJson, log, signal, onBoardRead: (index, png) => boardImages.set(index, png) },
  );
  await saveEvidenceFrames(recording.sessionId, votings, boardImages);
  await writeSessionVotings(recording, votings);
}

// Sessions over two days share one agenda that OParl splits between two meetings, and a first day often runs on into
// items OParl lists under the continuation. The session's own meeting comes first, so its items win on equal numbers.
async function fetchSessionAgenda(recording: Recording) {
  const meetingIds = [
    recording,
    ...manifest.recordings.filter((other) => isNeighbouringDay(other.date, recording.date)),
  ]
    .map((candidate) => candidate.oparlMeetingId)
    .filter((meetingId): meetingId is string => meetingId !== null);
  const agendas = await Promise.all(
    [...new Set(meetingIds)].map((meetingId) =>
      fetchMeetingAgenda(fetchJson, (url) => getTextOrThrow(http, url), meetingId),
    ),
  );
  const agenda = agendas.flat();
  console.log(`${recording.sessionId}: agenda with ${agenda.length} items from ${agendas.length} OParl meeting(s)`);
  return agenda;
}

function isNeighbouringDay(date: string, other: string): boolean {
  return Math.abs(Date.parse(date) - Date.parse(other)) === 24 * 60 * 60 * 1000;
}

// Recordings disappear from the Mediathek after a while. The board frame of every vote that needs a human look is kept,
// so the review can still be done from the image once the video is gone.
async function saveEvidenceFrames(sessionId: string, votings: ExtractedVoting[], boardImages: Map<number, Uint8Array>) {
  const directory = evidenceDirectory(sessionId);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  for (const voting of votings.filter((candidate) => candidate.checkStatus === 'needs-review')) {
    const png = boardImages.get(voting.index);
    if (png) await writeFile(join(directory, evidenceImageNames(sessionId, voting.index).board), png);
  }
}

function evidenceDirectory(sessionId: string): string {
  return join(args.cacheDir, 'evidence', sessionId);
}

// Cuts heading and result out of each saved board frame. Frames saved before the fixed naming
// („<date>-<index>-<seconds>s.png“) are renamed first.
async function prepareEvidenceImages(sessionId: string, votings: ExtractedVoting[]): Promise<Set<string>> {
  const directory = evidenceDirectory(sessionId);
  const files = await readdir(directory).catch(() => [] as string[]);
  for (const voting of votings.filter((candidate) => candidate.checkStatus === 'needs-review')) {
    const names = evidenceImageNames(sessionId, voting.index);
    const legacy = files.find((file) =>
      new RegExp(`^${sessionId}-${String(voting.index).padStart(3, '0')}-\\d+s\\.png$`).test(file),
    );
    if (!files.includes(names.board) && legacy) {
      await rename(join(directory, legacy), join(directory, names.board));
      files.push(names.board);
    }
    if (!files.includes(names.board) || (files.includes(names.heading) && files.includes(names.bars))) continue;
    const crops = cropEvidence(new Uint8Array(await readFile(join(directory, names.board))));
    if (!crops) continue;
    await writeFile(join(directory, names.heading), crops.heading);
    await writeFile(join(directory, names.bars), crops.bars);
    files.push(names.heading, names.bars);
  }
  return new Set(files);
}

// Corrections that no longer match fail the session before anything is written, so they are never dropped silently.
async function writeSessionVotings(recording: Recording, votings: ExtractedVoting[]) {
  const correctionsPath = join(args.dataDir, recording.sessionId, `corrections-${recording.sessionId}.json`);
  const correctionsJson = await readFile(correctionsPath, 'utf-8').catch(() => null);
  const corrections = correctionsJson ? parseCorrections(JSON.parse(correctionsJson), correctionsPath) : [];
  const sources = await loadOfficialSources({
    sessionId: recording.sessionId,
    oparlMeetingId: recording.oparlMeetingId,
    dataDir: args.dataDir,
    cacheDir: args.cacheDir,
    offline: args.offline,
    boardCount: votings.length,
    fetchJson,
    allris,
    warn: log.warn,
    now: new Date(),
  });
  const cues = recording.subtitleFile
    ? parseVtt(await readFile(join(args.dataDir, recording.subtitleFile), 'utf-8'))
    : null;
  const corrected = applyCorrections(applyOfficialResults(votings, { ...sources, cues }), corrections);

  await mkdir(join(args.dataDir, recording.sessionId), { recursive: true });
  await writeFile(votingsPath(recording), serializeSessionVotings(recording, corrected));
  await writeFile(
    join(args.dataDir, recording.sessionId, `votes-${recording.sessionId}.csv`),
    sessionVotesToCsv(recording.sessionId, corrected, members),
  );
  await writeReviewCases(recording, corrected);
  const summary = Object.entries(summarizeStatuses(corrected))
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');
  console.log(`${recording.sessionId}: ${summary}`);
}

async function writeReviewCases(recording: Recording, votings: ExtractedVoting[]) {
  const review = buildReviewCases({
    sessionId: recording.sessionId,
    oparlMeetingId: recording.oparlMeetingId,
    hlsUrl: recording.hlsUrl,
    mediathekUrl: recording.mediathekUrl,
    videoAvailable: recording.goneSince === null,
    votings,
    cues: recording.subtitleFile ? parseVtt(await readFile(join(args.dataDir, recording.subtitleFile), 'utf-8')) : null,
    imageNames: new Set([
      ...(await prepareEvidenceImages(recording.sessionId, votings)),
      ...(await publishedImageNames(recording.sessionId)),
    ]),
    imageBaseUrl: args.imageBaseUrl.replaceAll('{session}', recording.sessionId),
    officialLinks: await officialLinksOf(recording.sessionId),
    now: new Date(),
  });
  await writeFile(reviewPath(recording.sessionId), `${JSON.stringify(review, null, 2)}\n`);
}

// A recheck in CI has no evidence folder; the images already published stay linked.
async function publishedImageNames(sessionId: string): Promise<string[]> {
  const json = await readFile(reviewPath(sessionId), 'utf-8').catch(() => null);
  if (!json) return [];
  const previous = JSON.parse(json) as ReviewCasesFile;
  return previous.cases.flatMap((reviewCase) =>
    reviewCase.images.map((image) => image.url.slice(image.url.lastIndexOf('/') + 1)),
  );
}

async function officialLinksOf(sessionId: string): Promise<{ label: string; url: string }[]> {
  const links: { label: string; url: string }[] = [];
  const minutes = await readFile(join(args.dataDir, sessionId, `minutes-${sessionId}.json`), 'utf-8')
    .then((json) => JSON.parse(json) as MinutesFile)
    .catch(() => null);
  if (minutes?.source) {
    links.push({
      label:
        minutes.kind === 'beschlussprotokoll'
          ? 'Niederschrift (Beschlussprotokoll)'
          : 'Sitzung in ALLRIS (Ergebnisse je TOP)',
      url: minutes.source,
    });
  }
  const verlauf = await readFile(join(args.dataDir, sessionId, `verlaufsprotokoll-${sessionId}.json`), 'utf-8')
    .then((json) => JSON.parse(json) as { source?: string })
    .catch(() => null);
  if (verlauf?.source) links.push({ label: 'Verlaufsprotokoll (Anlage der Sitzung in ALLRIS)', url: verlauf.source });
  return links;
}

function reviewPath(sessionId: string): string {
  return join(args.dataDir, sessionId, `review-${sessionId}.json`);
}

// The review UI starts from this list of sessions with their open cases.
async function writeReviewIndex() {
  const sessions: ReviewIndex['sessions'] = [];
  for (const recording of manifest.recordings) {
    const json = await readFile(reviewPath(recording.sessionId), 'utf-8').catch(() => null);
    if (!json) continue;
    const review = JSON.parse(json) as ReviewCasesFile;
    sessions.push({ sessionId: recording.sessionId, videoAvailable: recording.goneSince === null, ...review.summary });
  }
  await writeFile(
    join(args.dataDir, 'review-index.json'),
    `${JSON.stringify({ sessions } satisfies ReviewIndex, null, 2)}\n`,
  );
}

function votingsPath(recording: Recording): string {
  return join(args.dataDir, recording.sessionId, `votings-${recording.sessionId}.json`);
}

async function loadOrScanEvents(sessionId: string, lowResolutionUrl: string): Promise<VoteEvent[]> {
  const cachePath = join(args.cacheDir, `vote-events-${sessionId}.json`);
  if (!args.rescan) {
    const cached = await readFile(cachePath, 'utf-8').catch(() => null);
    if (cached) return JSON.parse(cached) as VoteEvent[];
  }
  console.log(`${sessionId}: scanning video for result phases`);
  const events = await scanVoteEvents(video, lowResolutionUrl);
  await mkdir(args.cacheDir, { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(events, null, 2)}\n`);
  return events;
}

function requestedRecordings(all: Recording[]): Recording[] {
  const missing = args.sessions.filter((session) => !all.some((recording) => recording.sessionId === session));
  if (missing.length > 0) {
    console.error(`No recording for session(s) ${missing.join(', ')} in recordings.json`);
    process.exit(1);
  }
  return args.sessions.length > 0 ? all.filter((recording) => args.sessions.includes(recording.sessionId)) : all;
}

async function selectRecordingsToExtract(all: Recording[]): Promise<Recording[]> {
  const selected: Recording[] = [];
  for (const recording of requestedRecordings(all).filter((candidate) => candidate.goneSince === null)) {
    if (args.force || !(await fileExists(votingsPath(recording)))) selected.push(recording);
  }
  return selected;
}

async function selectRecordingsWithVotings(all: Recording[]): Promise<Recording[]> {
  const selected: Recording[] = [];
  for (const recording of requestedRecordings(all)) {
    if (await fileExists(votingsPath(recording))) selected.push(recording);
  }
  return selected;
}

function fileExists(path: string): Promise<boolean> {
  return readFile(path)
    .then(() => true)
    .catch(() => false);
}

// The run starts after every declaration above, so no constant is used before it is initialised.
await main();

async function main() {
  if (args.correctionsOnly) {
    for (const recording of await selectRecordingsWithVotings(manifest.recordings)) {
      await runForSession(recording, async () => {
        const file = JSON.parse(await readFile(votingsPath(recording), 'utf-8')) as SessionVotingsFile;
        await writeSessionVotings(recording, file.votings);
      });
    }
  } else {
    const recordings = await selectRecordingsToExtract(manifest.recordings);
    if (recordings.length === 0) {
      console.log('No sessions to process.');
      process.exit(0);
    }
    const workers = { text: await createWorker('deu'), digits: await createWorker('deu') };
    await workers.digits.setParameters({
      tessedit_char_whitelist: '0123456789()% ',
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
    });
    try {
      const roster = await fetchCouncilRoster(fetchJson);
      for (const recording of recordings) {
        await runForSession(recording, async () => {
          const deadline = AbortSignal.timeout(SESSION_DEADLINE_MILLISECONDS);
          await extractRecording(recording, roster, workers, deadline);
        });
      }
    } finally {
      await Promise.all([workers.text.terminate(), workers.digits.terminate()]);
    }
  }

  await writeReviewIndex();

  if (failures.length > 0) {
    console.error(`leipzig-votings failed for ${failures.length} session(s):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
}
