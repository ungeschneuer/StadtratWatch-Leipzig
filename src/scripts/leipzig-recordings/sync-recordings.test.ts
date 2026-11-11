import { describe, expect, it } from 'bun:test';

import { LEIPZIG_OPARL_COUNCIL_MEETINGS_URL } from './council-meetings.ts';
import type { HttpClient, HttpResponse } from './http-client.ts';
import { MEDIATHEK_LISTING_URL } from './mediathek.ts';
import { createEmptyManifest, type RecordingsManifest } from './recordings-manifest.ts';
import { PLAYER_PARAMETERS_URL } from './stream-hosting.ts';
import { type SubtitleStore, syncRecordings } from './sync-recordings.ts';

const PAGE_PREFIX = 'https://www.leipzig.de/mediathek/video/aufzeichnung-der-ratsversammlung-vom-';
const HLS_HOST = 'h056.video-stream-hosting.de';

function recordingPage(germanDate: string, streamName: string): string {
  const src = `https://start.video-stream-hosting.de/player.html?serverip=1.2.3.4&amp;serverapp=stadtleipzig-vod&amp;smil=${streamName}`;
  return `<title>Aufzeichnung der Ratsversammlung vom ${germanDate} - Stadt Leipzig</title><iframe class="media-player-iframe" src="${src}"></iframe>`;
}

function hlsUrl(streamName: string): string {
  return `https://${HLS_HOST}/stadtleipzig-vod/_definst_/smil:${streamName}/playlist.m3u8`;
}

type FakeWeb = { pages: Record<string, string>; requestedUrls: string[] };

function createFakeHttp(listedPaths: string[], pages: Record<string, string>): HttpClient & FakeWeb {
  const meetings = {
    data: [
      { id: 'https://oparl/meetings/1', name: 'Ratsversammlung', start: '2026-10-28T14:00:00+01:00' },
      { id: 'https://oparl/meetings/2', name: 'Ratsversammlung (Fortsetzung)', start: '2026-10-29T16:00:00+01:00' },
      { id: 'https://oparl/meetings/3', name: 'Ratsversammlung', start: '2026-11-19T14:00:00+01:00' },
      { id: 'https://oparl/meetings/4', name: 'Ratsversammlung', start: '2026-10-01T14:00:00+01:00', cancelled: true },
    ],
    links: {},
  };
  const web: FakeWeb = {
    pages: {
      [LEIPZIG_OPARL_COUNCIL_MEETINGS_URL]: JSON.stringify(meetings),
      [MEDIATHEK_LISTING_URL]: listedPaths.map((path) => `<a href="/mediathek/video/${path}">x</a>`).join(''),
      ...pages,
    },
    requestedUrls: [],
  };
  return {
    ...web,
    getText(url) {
      web.requestedUrls.push(url);
      return Promise.resolve(respond(url));
    },
    postJson(url, payload) {
      expect(url).toEqual(PLAYER_PARAMETERS_URL);
      const streamName = (payload as { smil: string }).smil;
      return Promise.resolve({
        hlshttpsdomain: HLS_HOST,
        untertitelDateien: [{ untertitelDatei: `https://vtt/${streamName}.vtt`, untertitelLand: 'de' }],
      });
    },
  };

  function respond(url: string): HttpResponse {
    if (url.endsWith('/playlist.m3u8')) {
      return { status: 200, body: '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=550\nchunklist_b550.m3u8\n' };
    }
    if (url.endsWith('/chunklist_b550.m3u8')) {
      return { status: 200, body: '#EXTM3U\n#EXTINF:10.0,\na.ts\n#EXTINF:5.0,\nb.ts\n' };
    }
    if (url.endsWith('.vtt')) {
      return { status: 200, body: `WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n${url}\n` };
    }
    const body = web.pages[url];
    return body === undefined ? { status: 404, body: 'not found' } : { status: 200, body };
  }
}

function createMemorySubtitles(): SubtitleStore & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    read: (path) => Promise.resolve(files.get(path) ?? null),
    write: (path, content) => {
      files.set(path, content);
      return Promise.resolve();
    },
  };
}

const silentLog = { info: () => {}, warn: () => {} };
const options = { today: '2026-11-10', firstSessionDate: '2024-09-18', probeSlugsSinceDate: '2026-09-01' };

async function sync(http: HttpClient, manifest: RecordingsManifest = createEmptyManifest(), today = options.today) {
  const subtitles = createMemorySubtitles();
  const result = await syncRecordings(http, subtitles, manifest, { ...options, today }, silentLog);
  return { ...result, subtitles };
}

describe('syncRecordings', () => {
  it('links listed recordings to their OParl meeting and archives the subtitles', async () => {
    const http = createFakeHttp(['aufzeichnung-der-ratsversammlung-vom-29-oktober-2026'], {
      [`${PAGE_PREFIX}29-oktober-2026`]: recordingPage('29.10.2026', '2026/b.smil'),
    });

    const { manifest, failures, subtitles } = await sync(http);

    expect(failures).toEqual([]);
    expect(manifest.recordings).toHaveLength(1);
    expect(manifest.recordings[0]).toMatchObject({
      sessionId: '2026-10-29',
      oparlMeetingId: 'https://oparl/meetings/2',
      meetingName: 'Ratsversammlung (Fortsetzung)',
      hlsUrl: hlsUrl('2026/b.smil'),
      durationSeconds: 15,
      subtitleFile: '2026-10-29/subtitles-2026-10-29.vtt',
      firstSeen: '2026-11-10',
      goneSince: null,
    });
    expect(subtitles.files.get('2026-10-29/subtitles-2026-10-29.vtt')).toStartWith('WEBVTT');
  });

  it('finds unlisted recordings of recent meetings by guessing the page address', async () => {
    const http = createFakeHttp([], { [`${PAGE_PREFIX}28102026`]: recordingPage('28.10.2026', '2026/a.smil') });

    const { manifest } = await sync(http);

    expect(manifest.recordings.map((recording) => recording.sessionId)).toEqual(['2026-10-28']);
    expect(http.requestedUrls).toContain(`${PAGE_PREFIX}29102026`);
    expect(http.requestedUrls.some((url) => url.includes('01102026'))).toBe(false);
  });

  it('does not guess addresses of meetings before the probe window', async () => {
    const http = createFakeHttp([], {});

    await syncRecordings(
      http,
      createMemorySubtitles(),
      createEmptyManifest(),
      {
        ...options,
        probeSlugsSinceDate: '2026-10-29',
      },
      silentLog,
    );

    expect(http.requestedUrls.some((url) => url.includes('28102026'))).toBe(false);
  });

  it('marks a known recording as gone once its page disappears', async () => {
    const pageUrl = `${PAGE_PREFIX}28102026`;
    const first = await sync(
      createFakeHttp(['aufzeichnung-der-ratsversammlung-vom-28102026'], {
        [pageUrl]: recordingPage('28.10.2026', '2026/a.smil'),
      }),
    );

    const second = await sync(createFakeHttp([], {}), first.manifest, '2027-11-01');

    expect(second.manifest.recordings[0]).toMatchObject({ firstSeen: '2026-11-10', goneSince: '2027-11-01' });
  });

  it('reports a broken page without touching the others', async () => {
    const http = createFakeHttp(
      ['aufzeichnung-der-ratsversammlung-vom-28102026', 'aufzeichnung-der-ratsversammlung-vom-29102026'],
      {
        [`${PAGE_PREFIX}28102026`]: '<title>Aufzeichnung der Ratsversammlung vom 28.10.2026</title>',
        [`${PAGE_PREFIX}29102026`]: recordingPage('29.10.2026', '2026/b.smil'),
      },
    );

    const { manifest, failures } = await sync(http);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('28102026');
    expect(manifest.recordings.map((recording) => recording.sessionId)).toEqual(['2026-10-29']);
  });
});
