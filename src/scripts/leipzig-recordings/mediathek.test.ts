import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { findRecordingPageUrls, parseGermanDate, parseRecordingPage, recordingPageUrlCandidates } from './mediathek.ts';

function fixture(name: string): string {
  return readFileSync(join(import.meta.dir, 'test-fixtures', name), 'utf-8');
}

describe('findRecordingPageUrls', () => {
  it('keeps only council recording pages of the Mediathek listing', () => {
    expect(findRecordingPageUrls(fixture('mediathek-listing.html'))).toEqual([
      'https://www.leipzig.de/mediathek/video/aufzeichnung-der-ratsversammlung-vom-28102026',
      'https://www.leipzig.de/mediathek/video/aufzeichnung-der-ratsversammlung-vom-29-oktober-2026',
      'https://www.leipzig.de/mediathek/video/aufzeichnung-der-ratsversammlung-vom-30092026',
    ]);
  });
});

describe('recordingPageUrlCandidates', () => {
  it('tries the numeric and the written month slug', () => {
    expect(recordingPageUrlCandidates('2026-03-05').map((url) => url.split('-vom-')[1])).toEqual([
      '05032026',
      '5-maerz-2026',
      '05-maerz-2026',
    ]);
  });

  it('does not repeat a slug when the day has two digits', () => {
    expect(recordingPageUrlCandidates('2026-10-29').map((url) => url.split('-vom-')[1])).toEqual([
      '29102026',
      '29-oktober-2026',
    ]);
  });
});

describe('parseGermanDate', () => {
  it('reads numeric dates', () => {
    expect(parseGermanDate('Aufzeichnung der Ratsversammlung vom 2.7.2026')).toEqual('2026-07-02');
  });

  it('reads written months', () => {
    expect(parseGermanDate('Aufzeichnung der Ratsversammlung vom 26. März 2026')).toEqual('2026-03-26');
  });

  it('returns undefined without a date', () => {
    expect(parseGermanDate('Aufzeichnung der Ratsversammlung')).toBeUndefined();
  });
});

describe('parseRecordingPage', () => {
  it('reads the session date from the title, not from the address', () => {
    const page = parseRecordingPage(fixture('recording-page.html'));

    expect(page.date).toEqual('2026-10-29');
    expect(page.title).toEqual('Aufzeichnung der Ratsversammlung vom 29.10.2026 - Stadt Leipzig');
  });

  it('reads the player reference from the embedded iframe', () => {
    expect(parseRecordingPage(fixture('recording-page.html')).player).toEqual({
      serverIp: '62.113.221.14',
      serverApp: 'stadtleipzig-vod',
      streamName: '2026/Livestream_Stadtrat_Leipzig_-_29_Oktober_2026_-_04-05-14.smil',
    });
  });

  it('keeps the player page, decoded, for links to a moment', () => {
    expect(parseRecordingPage(fixture('recording-page.html')).playerUrl).toStartWith(
      'https://start.video-stream-hosting.de/player_videojs_stadtleipzig_vorlesen_untertitel2.html?serverip=62.113.221.14&serverapp=stadtleipzig-vod&smil=',
    );
  });

  it('fails loudly when the player is missing', () => {
    expect(() => parseRecordingPage('<title>Aufzeichnung vom 29.10.2026</title>')).toThrow('media player iframe');
  });
});
