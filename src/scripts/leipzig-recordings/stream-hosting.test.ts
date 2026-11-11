import { describe, expect, it } from 'bun:test';

import {
  buildHlsUrl,
  findLowestBandwidthVariantUrl,
  resolveStream,
  sumSegmentDurationSeconds,
} from './stream-hosting.ts';

const player = { serverIp: '62.113.221.14', serverApp: 'stadtleipzig-vod', streamName: '2026/session.smil' };

describe('resolveStream', () => {
  it('uses the HLS host and the German subtitles the hoster returns', () => {
    const stream = resolveStream(player, {
      hlshttpsdomain: 'h056.video-stream-hosting.de',
      untertitelDateien: [{ untertitelDatei: 'https://hd001.video-stream-hosting.de/vtt/x.vtt', untertitelLand: 'de' }],
    });

    expect(stream).toEqual({
      hlsUrl: 'https://h056.video-stream-hosting.de/stadtleipzig-vod/_definst_/smil:2026/session.smil/playlist.m3u8',
      subtitleUrl: 'https://hd001.video-stream-hosting.de/vtt/x.vtt',
    });
  });

  it('falls back to the server of the page when the hoster names none', () => {
    expect(resolveStream(player, {}).hlsUrl).toStartWith('https://62.113.221.14/');
    expect(resolveStream(player, {}).subtitleUrl).toBeNull();
  });

  it('rejects a response that reports an error', () => {
    expect(() => resolveStream(player, { fehler: 'nicht gefunden' })).toThrow('nicht gefunden');
  });
});

describe('buildHlsUrl', () => {
  it('prefixes plain files with mp4', () => {
    expect(buildHlsUrl('host', 'app', 'video.mp4')).toEqual('https://host/app/_definst_/mp4:video.mp4/playlist.m3u8');
  });
});

describe('findLowestBandwidthVariantUrl', () => {
  it('picks the smallest variant and resolves it against the master playlist', () => {
    const master = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=6500,RESOLUTION=1920x1080',
      'chunklist_b6500.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=550,RESOLUTION=640x360',
      'chunklist_b550.m3u8',
    ].join('\n');

    expect(findLowestBandwidthVariantUrl(master, 'https://host/app/smil:x.smil/playlist.m3u8')).toEqual(
      'https://host/app/smil:x.smil/chunklist_b550.m3u8',
    );
  });

  it('returns undefined without variants', () => {
    expect(findLowestBandwidthVariantUrl('#EXTM3U', 'https://host/playlist.m3u8')).toBeUndefined();
  });
});

describe('sumSegmentDurationSeconds', () => {
  it('adds up the segment durations', () => {
    expect(sumSegmentDurationSeconds('#EXTM3U\n#EXTINF:10.0,\na.ts\n#EXTINF:9.6,\nb.ts\n')).toEqual(20);
  });
});
