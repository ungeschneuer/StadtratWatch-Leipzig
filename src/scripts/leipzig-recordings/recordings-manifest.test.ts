import { describe, expect, it } from 'bun:test';

import {
  createEmptyManifest,
  manifestToCsv,
  markRecordingGone,
  type ObservedRecording,
  upsertObservedRecording,
} from './recordings-manifest.ts';

function observed(sessionId: string, overrides: Partial<ObservedRecording> = {}): ObservedRecording {
  return {
    sessionId,
    date: sessionId,
    oparlMeetingId: `https://oparl/meetings/${sessionId}`,
    meetingName: 'Ratsversammlung',
    mediathekUrl: `https://www.leipzig.de/mediathek/video/${sessionId}`,
    pageTitle: `Aufzeichnung vom ${sessionId}`,
    playerUrl: `https://player/${sessionId}.html?serverip=1`,
    serverApp: 'stadtleipzig-vod',
    streamName: `${sessionId}.smil`,
    hlsUrl: `https://host/${sessionId}/playlist.m3u8`,
    durationSeconds: 3600,
    subtitleUrl: `https://host/${sessionId}.vtt`,
    subtitleFile: `${sessionId}/subtitles-${sessionId}.vtt`,
    subtitleSha256: 'abc',
    ...overrides,
  };
}

describe('upsertObservedRecording', () => {
  it('records the first sighting of a new recording', () => {
    const manifest = upsertObservedRecording(createEmptyManifest(), observed('2026-10-28'), '2026-11-10');

    expect(manifest.recordings).toEqual([{ ...observed('2026-10-28'), firstSeen: '2026-11-10', goneSince: null }]);
  });

  it('keeps the first sighting and sorts by session', () => {
    let manifest = upsertObservedRecording(createEmptyManifest(), observed('2026-10-29'), '2026-11-01');
    manifest = upsertObservedRecording(manifest, observed('2026-10-28'), '2026-11-02');
    manifest = upsertObservedRecording(manifest, observed('2026-10-29', { durationSeconds: 7200 }), '2026-11-03');

    expect(manifest.recordings.map((recording) => [recording.sessionId, recording.firstSeen])).toEqual([
      ['2026-10-28', '2026-11-02'],
      ['2026-10-29', '2026-11-01'],
    ]);
    expect(manifest.recordings[1].durationSeconds).toEqual(7200);
  });

  it('keeps the archived subtitles when the hoster stops publishing them', () => {
    let manifest = upsertObservedRecording(createEmptyManifest(), observed('2026-10-28'), '2026-11-01');
    manifest = upsertObservedRecording(
      manifest,
      observed('2026-10-28', { subtitleUrl: null, subtitleFile: null, subtitleSha256: null }),
      '2026-11-02',
    );

    expect(manifest.recordings[0].subtitleFile).toEqual('2026-10-28/subtitles-2026-10-28.vtt');
  });

  it('marks a recording as available again when it reappears', () => {
    let manifest = upsertObservedRecording(createEmptyManifest(), observed('2026-10-28'), '2026-11-01');
    manifest = markRecordingGone(manifest, '2026-10-28', '2026-11-05');
    manifest = upsertObservedRecording(manifest, observed('2026-10-28'), '2026-11-06');

    expect(manifest.recordings[0].goneSince).toBeNull();
  });
});

describe('markRecordingGone', () => {
  it('keeps the first day the recording was missing', () => {
    let manifest = upsertObservedRecording(createEmptyManifest(), observed('2026-10-28'), '2026-11-01');
    manifest = markRecordingGone(manifest, '2026-10-28', '2026-11-05');
    manifest = markRecordingGone(manifest, '2026-10-28', '2026-11-06');

    expect(manifest.recordings[0].goneSince).toEqual('2026-11-05');
  });
});

describe('manifestToCsv', () => {
  it('writes one row per recording and quotes fields with commas', () => {
    const manifest = upsertObservedRecording(
      createEmptyManifest(),
      observed('2026-10-28', { pageTitle: 'Aufzeichnung, Teil 1', subtitleUrl: null }),
      '2026-11-10',
    );
    const [header, row] = manifestToCsv(manifest).trimEnd().split('\n');

    expect(header.split(',')[0]).toEqual('sessionId');
    expect(row).toContain('"Aufzeichnung, Teil 1"');
    expect(row).toContain('3600,,2026-10-28/subtitles-2026-10-28.vtt');
    expect(row.endsWith(',2026-11-10,')).toBe(true);
  });
});
