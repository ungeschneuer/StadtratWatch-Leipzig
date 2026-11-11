import { createHash } from 'node:crypto';

import { type CouncilMeeting, fetchCouncilMeetings } from './council-meetings.ts';
import { getTextOrThrow, type HttpClient } from './http-client.ts';
import {
  findRecordingPageUrls,
  MEDIATHEK_LISTING_URL,
  parseRecordingPage,
  type RecordingPage,
  recordingPageUrlCandidates,
} from './mediathek.ts';
import {
  markRecordingGone,
  type ObservedRecording,
  type RecordingsManifest,
  upsertObservedRecording,
} from './recordings-manifest.ts';
import {
  buildPlayerParametersRequest,
  findLowestBandwidthVariantUrl,
  PLAYER_PARAMETERS_URL,
  resolveStream,
  sumSegmentDurationSeconds,
} from './stream-hosting.ts';

export type SubtitleStore = {
  read(relativePath: string): Promise<string | null>;
  write(relativePath: string, content: string): Promise<void>;
};

export type SyncLog = { info(message: string): void; warn(message: string): void };

export type SyncOptions = {
  today: string;
  firstSessionDate: string;
  probeSlugsSinceDate: string;
};

export type SyncResult = {
  manifest: RecordingsManifest;
  failures: string[];
};

type PageVisit = { kind: 'found'; page: RecordingPage } | { kind: 'missing' };

export async function syncRecordings(
  http: HttpClient,
  subtitles: SubtitleStore,
  manifest: RecordingsManifest,
  options: SyncOptions,
  log: SyncLog,
): Promise<SyncResult> {
  const meetings = await fetchCouncilMeetings(
    async (url) => JSON.parse(await getTextOrThrow(http, url)),
    options.firstSessionDate,
    options.today,
  );
  log.info(`${meetings.length} council meetings in OParl since ${options.firstSessionDate}`);

  const listedUrls = findRecordingPageUrls(await getTextOrThrow(http, MEDIATHEK_LISTING_URL));
  const knownUrls = manifest.recordings
    .filter((recording) => recording.goneSince === null)
    .map((recording) => recording.mediathekUrl);

  let currentManifest = manifest;
  const failures: string[] = [];
  const coveredDates = new Set<string>();
  const visitedUrls = new Set<string>();

  async function processPage(url: string): Promise<PageVisit | undefined> {
    visitedUrls.add(url);
    try {
      const visit = await visitPage(http, url);
      if (visit.kind === 'found') {
        coveredDates.add(visit.page.date);
        const observed = await observeRecording(http, subtitles, url, visit.page, meetings, currentManifest, log);
        currentManifest = upsertObservedRecording(currentManifest, observed, options.today);
      }
      return visit;
    } catch (error) {
      failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  for (const url of unique([...listedUrls, ...knownUrls])) {
    const visit = await processPage(url);
    const knownRecording = currentManifest.recordings.find((recording) => recording.mediathekUrl === url);
    if (visit?.kind === 'missing' && knownRecording) {
      log.warn(`Recording of ${knownRecording.sessionId} is no longer available: ${url}`);
      currentManifest = markRecordingGone(currentManifest, knownRecording.sessionId, options.today);
    }
  }

  // Pages that dropped off the listing can only be found by guessing their address; this is bounded by date to spare the server.
  const meetingsToProbe = meetings.filter(
    (meeting) =>
      meeting.date >= options.probeSlugsSinceDate &&
      !coveredDates.has(meeting.date) &&
      !currentManifest.recordings.some((recording) => recording.sessionId === meeting.date),
  );
  for (const meeting of meetingsToProbe) {
    for (const url of recordingPageUrlCandidates(meeting.date).filter((candidate) => !visitedUrls.has(candidate))) {
      const visit = await processPage(url);
      if (visit?.kind === 'found') {
        break;
      }
    }
  }

  return { manifest: currentManifest, failures };
}

async function visitPage(http: HttpClient, url: string): Promise<PageVisit> {
  const response = await http.getText(url);
  if (response.status === 404 || response.status === 410) {
    return { kind: 'missing' };
  }
  if (response.status !== 200) {
    throw new Error(`GET ${url} answered ${response.status}`);
  }
  return { kind: 'found', page: parseRecordingPage(response.body) };
}

async function observeRecording(
  http: HttpClient,
  subtitles: SubtitleStore,
  url: string,
  page: RecordingPage,
  meetings: CouncilMeeting[],
  manifest: RecordingsManifest,
  log: SyncLog,
): Promise<ObservedRecording> {
  const meeting = meetings.find((candidate) => candidate.date === page.date);
  if (!meeting) {
    log.warn(`No OParl council meeting on ${page.date} for ${url}`);
  }

  const stream = resolveStream(
    page.player,
    (await http.postJson(PLAYER_PARAMETERS_URL, buildPlayerParametersRequest(page.player))) as Parameters<
      typeof resolveStream
    >[1],
  );
  const durationSeconds = await measureDurationSeconds(http, stream.hlsUrl);
  const subtitle = stream.subtitleUrl ? await storeSubtitle(http, subtitles, page.date, stream.subtitleUrl) : null;
  if (!stream.subtitleUrl) {
    log.warn(`No subtitles published for ${page.date}`);
  }

  const previous = manifest.recordings.find((recording) => recording.sessionId === page.date);
  if (!previous) {
    log.info(`New recording ${page.date}: ${url}`);
  }

  return {
    sessionId: page.date,
    date: page.date,
    oparlMeetingId: meeting?.oparlMeetingId ?? null,
    meetingName: meeting?.name ?? null,
    mediathekUrl: url,
    pageTitle: page.title,
    serverApp: page.player.serverApp,
    streamName: page.player.streamName,
    hlsUrl: stream.hlsUrl,
    durationSeconds,
    subtitleUrl: stream.subtitleUrl,
    subtitleFile: subtitle?.file ?? null,
    subtitleSha256: subtitle?.sha256 ?? null,
  };
}

async function measureDurationSeconds(http: HttpClient, hlsUrl: string): Promise<number> {
  const masterPlaylist = await getTextOrThrow(http, hlsUrl);
  const variantUrl = findLowestBandwidthVariantUrl(masterPlaylist, hlsUrl);
  if (!variantUrl) {
    throw new Error(`HLS playlist without variants: ${hlsUrl}`);
  }
  return sumSegmentDurationSeconds(await getTextOrThrow(http, variantUrl));
}

async function storeSubtitle(
  http: HttpClient,
  subtitles: SubtitleStore,
  sessionDate: string,
  subtitleUrl: string,
): Promise<{ file: string; sha256: string }> {
  const content = await getTextOrThrow(http, subtitleUrl);
  if (!content.startsWith('WEBVTT')) {
    throw new Error(`Subtitle file is not WebVTT: ${subtitleUrl}`);
  }
  const file = `${sessionDate}/subtitles-${sessionDate}.vtt`;
  if ((await subtitles.read(file)) !== content) {
    await subtitles.write(file, content);
  }
  return { file, sha256: createHash('sha256').update(content).digest('hex') };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
