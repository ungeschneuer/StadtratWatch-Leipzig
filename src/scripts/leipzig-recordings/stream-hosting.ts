import type { PlayerReference } from './mediathek.ts';

export const PLAYER_PARAMETERS_URL = 'https://start.video-stream-hosting.de/player/playerparameter';

export type ResolvedStream = {
  hlsUrl: string;
  subtitleUrl: string | null;
};

type PlayerParametersResponse = {
  hlshttpsdomain?: string;
  serverip?: string;
  serverapp?: string;
  smil?: string;
  streamname?: string;
  untertitelDateien?: { untertitelDatei?: string; untertitelLand?: string }[];
  fehler?: string;
};

// The embedded player asks this undocumented endpoint for the HLS host and the subtitle files; we send the same request.
export function buildPlayerParametersRequest(player: PlayerReference): object {
  return {
    serverip: player.serverIp,
    serverapp: player.serverApp,
    smil: player.streamName,
    streamname: player.streamName,
    streamnameHLS: '',
    hlshttpsdomain: '',
    ref: 'https://www.leipzig.de/',
  };
}

export function resolveStream(player: PlayerReference, response: PlayerParametersResponse): ResolvedStream {
  if (response.fehler) {
    throw new Error(`Player parameters report an error: ${response.fehler}`);
  }
  const host = response.hlshttpsdomain || response.serverip || player.serverIp;
  const serverApp = response.serverapp || player.serverApp;
  const streamName = response.smil || response.streamname || player.streamName;
  return {
    hlsUrl: buildHlsUrl(host, serverApp, streamName),
    subtitleUrl: findGermanSubtitleUrl(response),
  };
}

export function buildHlsUrl(host: string, serverApp: string, streamName: string): string {
  const prefixedStreamName = streamName.endsWith('.smil') ? `smil:${streamName}` : `mp4:${streamName}`;
  return `https://${host}/${serverApp}/_definst_/${prefixedStreamName}/playlist.m3u8`;
}

export function listVariantUrlsByBandwidth(masterPlaylist: string, masterUrl: string): string[] {
  const lines = masterPlaylist.split(/\r?\n/);
  const variants: { bandwidth: number; url: string }[] = [];
  lines.forEach((line, index) => {
    const bandwidth = line.match(/^#EXT-X-STREAM-INF:.*\bBANDWIDTH=(\d+)/)?.[1];
    const uri = lines[index + 1]?.trim();
    if (bandwidth && uri) {
      variants.push({ bandwidth: Number(bandwidth), url: new URL(uri, masterUrl).toString() });
    }
  });
  return variants.sort((a, b) => a.bandwidth - b.bandwidth).map((variant) => variant.url);
}

export function findLowestBandwidthVariantUrl(masterPlaylist: string, masterUrl: string): string | undefined {
  return listVariantUrlsByBandwidth(masterPlaylist, masterUrl)[0];
}

export function sumSegmentDurationSeconds(mediaPlaylist: string): number {
  let total = 0;
  for (const match of mediaPlaylist.matchAll(/^#EXTINF:([\d.]+)/gm)) {
    total += Number(match[1]);
  }
  return Math.round(total);
}

function findGermanSubtitleUrl(response: PlayerParametersResponse): string | null {
  const subtitles = (response.untertitelDateien ?? []).filter((file) => file.untertitelDatei);
  const german = subtitles.find((file) => file.untertitelLand === 'de') ?? subtitles[0];
  return german?.untertitelDatei ?? null;
}
